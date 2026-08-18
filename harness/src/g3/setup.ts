// G3 — bootstrap for the four-colour step ledger: wallets, fees, three Minters, one Manager, the
// six colours, `configure`, and the two accounts. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Everything here happens BEFORE spec step 0 is asserted, except the deployment, configuration and
// account registration, which ARE step 0. The runner asserts; this module only builds.
//
// **Finding F-104 shapes the wallet layout.** On this pinned lane a wallet that SUBMITTED a
// transaction under-reports its own balance afterwards and does not self-correct, while still
// returning `progress.isStrictlyComplete() === true` (evidence:
// `evidence/g1-lane/FINDING-F104-sender-wallet-underreports.md`). So this rig keeps the two roles
// apart for the user parties:
//
//   OBSERVER wallets  one long-lived facade per user, opened here, which NEVER submits anything.
//                     Every user cell of the 16-cell table is read from these. They can be
//                     re-opened on demand (`refreshObservers`) if one ever falls behind.
//   SPENDER wallets   opened FRESH for each user-submitted transaction and closed afterwards, so no
//                     transaction is ever built from a view that a previous submission may have
//                     corrupted. Each gets its own private-state store, so two instances of the
//                     same seed never contend for one LevelDB.
//
// The fee wallet submits everything else (deploys, mints, owner-authorized Manager calls and the
// rotating on-chain spot checks) and is never an observation point either — it holds none of the
// four colours.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { fundWithNight, log, registerForDust, report, syncedState, units, waitFor, withDustRetry } from '../night.js';
import { compiledManager, compiledMinter } from '../contracts.js';
import { ManagerSim, MinterSim } from '../test/sim.js';
import { balanceKeyOf, hex, waitForManager } from '../manager-view.js';
import { makeComposedProofProvider, makeProviders } from './providers.js';
import type { Ctx, MinterLabel } from './actions.js';
import type { ColourSet } from './observe.js';
import type { ObserveDeps } from './table.js';

// @ts-ignore — generated artifact
import { ledger as minterLedger } from '../../generated-zk/minter/contract/index.js';

/** `pad(32, s)` on the TypeScript side: right-pad the UTF-8 bytes with zeros to 32. */
const pad32 = (s: string): Uint8Array => {
  const b = Buffer.from(s, 'utf-8');
  if (b.length > 32) throw new Error(`tag "${s}" exceeds 32 bytes`);
  const out = new Uint8Array(32);
  out.set(b);
  return out;
};

/** Unwrap a circuit call result (the SDK returns the value under `private.result`). */
export const resultOf = <T>(r: any): T => (r?.private?.result ?? r?.result) as T;

/** Set the owner secret the Manager's witness reads on the next call made through `providers`. */
const actAs = async (providers: any, secret: Uint8Array): Promise<void> => {
  await providers.privateStateProvider.set('manager', { ownerSecret: secret });
};

export type MinterDeployment = {
  label: MinterLabel;
  tagText: string;
  tagIn: string;
  address: string;
  ledgerTag: string;
  shieldedSep: string;
  unshieldedSep: string;
  simShieldedSep: string;
  simUnshieldedSep: string;
  shieldedColour: string;
  unshieldedColour: string;
};

export type Spender = { party: Party; managerProviders: any; close: () => Promise<void> };

export type Rig = {
  fee: Party;
  /** Observer wallets — read-only, never submit (F-104). */
  observers: { OwnerN: Party; OwnerM: Party };
  /** Open a FRESH spender wallet for one user-submitted transaction. Always close it afterwards. */
  openSpender: (
    who: 'OwnerN' | 'OwnerM',
    tag: string,
    /** Wait until the fresh wallet can see EVERY leg's funds before it builds anything. */
    require?: Array<{ colour: string; shielded: boolean; amount: bigint }>,
  ) => Promise<Spender>;
  refreshObservers: () => Promise<void>;
  ctx: Ctx;
  colours: ColourSet;
  minters: MinterDeployment[];
  managerAddress: string;
  /** The deployed Manager handle, for the rotating on-chain `accountBalance` spot checks. */
  managerDeployed: any;
  ids: { AA_A: string; AA_B: string };
  raw: { AA_A: Uint8Array; AA_B: Uint8Array; secretA: Uint8Array; secretB: Uint8Array };
  addresses: { OwnerN: string; OwnerM: string };
  deps: ObserveDeps;
  deployTxs: Record<string, string>;
  fundingTxs: Record<string, string>;
  distinctness: { comparisons: number; distinct: number; collisions: string[] };
  close: () => Promise<void>;
};

export const bootstrap = async (): Promise<Rig> => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00004-g3-'));
  const opened: Party[] = [];
  const close = async () => {
    for (const p of opened) await closeParty(p);
    try {
      rmSync(psDir, { recursive: true, force: true });
    } catch {
      /* teardown must not mask the real result */
    }
  };

  try {
    // --- wallets ---------------------------------------------------------------------------------
    const genesis = await openParty('genesis', SEEDS.genesis);
    opened.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    opened.push(fee);
    log('wallets open; syncing genesis …');
    report('genesis', await syncedState(genesis));

    // --- fees: NIGHT + DUST for every wallet that submits a transaction ---------------------------
    // The user wallets submit their own deposits, so they need their own DUST. NIGHT and DUST never
    // appear in the demo table.
    const fundingTxs: Record<string, string> = {};
    fundingTxs.feePayer = await fundWithNight(genesis, fee, units(1_000_000n));
    fundingTxs.feePayerDust = await registerForDust(fee);

    // The funding instances of the user wallets submit their own DUST registration, so they are
    // closed immediately afterwards and never used again (F-104): every later user transaction gets
    // a fresh spender, and every observation goes through the read-only observers.
    for (const [who, seed] of [
      ['OwnerN', SEEDS.ownerN],
      ['OwnerM', SEEDS.ownerM],
    ] as const) {
      const funding = await openParty(`${who}-funding`, seed);
      try {
        fundingTxs[who] = await fundWithNight(fee, funding, units(200_000n));
        fundingTxs[`${who}Dust`] = await registerForDust(funding);
      } finally {
        await closeParty(funding);
      }
    }

    // --- observer wallets (read-only; F-104) --------------------------------------------------------
    // Each is synced before it is used, so "the table reads zero" can never mean "the observer has
    // not caught up yet" — at step 0 every cell IS zero, and an unsynced observer would satisfy that
    // row for the wrong reason.
    const openObservers = async () => {
      const OwnerN = await openParty('OwnerN-observer', SEEDS.ownerN);
      const OwnerM = await openParty('OwnerM-observer', SEEDS.ownerM);
      await syncedState(OwnerN);
      await syncedState(OwnerM);
      return { OwnerN, OwnerM };
    };
    let observers = await openObservers();
    const refreshObservers = async () => {
      const old = observers;
      observers = await openObservers();
      rig.observers = observers;
      deps.observers = observers;
      await closeParty(old.OwnerN);
      await closeParty(old.OwnerM);
    };

    const addresses = {
      OwnerN: String((await (observers.OwnerN.wallet as any).unshielded.getAddress()).hexString).toLowerCase(),
      OwnerM: String((await (observers.OwnerM.wallet as any).unshielded.getAddress()).hexString).toLowerCase(),
    };

    // --- fresh spenders ------------------------------------------------------------------------------
    let spenderSeq = 0;
    const openSpender = async (
      who: 'OwnerN' | 'OwnerM',
      tag: string,
      /**
       * Readiness conditions: wait until this fresh wallet can actually SEE the funds for EVERY leg
       * it is about to spend. Reading a balance from a wallet BEFORE it submits anything is not what
       * F-104 warns about (that is about a wallet's view of its own balance AFTER a send).
       *
       * It must cover every leg, not just one. A transaction whose SECOND leg's funds the wallet
       * cannot yet see does not fail loudly: `balanceTx` produces a transaction the node then
       * refuses with a bare `1010: Invalid Transaction: Custom error: 223`, which is exactly what
       * gate runs 1 and 2 hit at step 13 while the diagnostic probe — whose wallet could see both
       * legs — had the identical shape ACCEPTED.
       */
      require?: Array<{ colour: string; shielded: boolean; amount: bigint }>,
    ): Promise<Spender> => {
      const seed = who === 'OwnerN' ? SEEDS.ownerN : SEEDS.ownerM;
      const name = `${who}-spender-${++spenderSeq}-${tag}`;
      const party = await openParty(name, seed);
      await syncedState(party);
      for (const need of require ?? []) {
        const held = (st: any): bigint =>
          BigInt(
            (need.shielded ? st?.shielded?.balances?.[need.colour] : st?.unshielded?.balances?.[need.colour]) ?? 0n,
          );
        await waitFor(
          party,
          (st) => held(st) >= need.amount,
          `${name} to see ${need.amount} of ${need.shielded ? 'shielded' : 'unshielded'} ${need.colour.slice(0, 12)}… before spending it`,
          300_000,
        );
      }
      const managerProviders = makeProviders(party, 'manager', psDir);
      managerProviders.privateStateProvider.setContractAddress(managerAddress);
      await actAs(managerProviders, new Uint8Array(32));
      return {
        party,
        managerProviders,
        close: async () => closeParty(party),
      };
    };

    // --- three Minter deployments from ONE artifact (FR-101) --------------------------------------
    const deployTxs: Record<string, string> = {};
    const minterProviders = makeProviders(fee, 'minter', psDir);
    const minters: MinterDeployment[] = [];
    for (const [label, tagText] of [
      ['Minter1', 'TOKA'],
      ['Minter2', 'TOKB'],
      ['Minter3', 'TOKC'],
    ] as const) {
      const tag = pad32(tagText);
      log(`deploying ${label} with constructor tag "${tagText}" …`);
      const deployed: any = await withDustRetry(fee, `deploy ${label}`, () =>
        deployContract(minterProviders, { compiledContract: compiledMinter(), args: [tag] } as any),
      );
      const address = deployed.deployTxData.public.contractAddress;
      deployTxs[label] = String(deployed.deployTxData.public.txId ?? deployed.deployTxData.public.txHash ?? '');

      // Observation point 1 — the deployment's own ledger cells; point 2 — real circuit calls;
      // point 3 — the SEPARATELY COMPILED --skip-zk artifact re-deriving the same separators.
      const state = await minterProviders.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state for ${label} at ${address}`);
      const l: any = (minterLedger as any)(state.data);
      const sc = await withDustRetry(fee, `${label}.shieldedColor()`, () => deployed.callTx.shieldedColor());
      const uc = await withDustRetry(fee, `${label}.unshieldedColor()`, () => deployed.callTx.unshieldedColor());
      const sim = await MinterSim.create(tag);

      const d: MinterDeployment = {
        label,
        tagText,
        tagIn: hex(tag),
        address,
        ledgerTag: hex(l.deploymentTag),
        shieldedSep: hex(l.shieldedSep),
        unshieldedSep: hex(l.unshieldedSep),
        simShieldedSep: hex(sim.ledger.shieldedSep),
        simUnshieldedSep: hex(sim.ledger.unshieldedSep),
        shieldedColour: hex(resultOf<Uint8Array>(sc)),
        unshieldedColour: hex(resultOf<Uint8Array>(uc)),
      };
      minters.push(d);
      log(`  ${label} at ${address}: shielded ${d.shieldedColour} / unshielded ${d.unshieldedColour}`);

      if (d.ledgerTag !== d.tagIn) throw new Error(`${label}: stored tag ${d.ledgerTag} != argument ${d.tagIn}`);
      if (d.shieldedSep !== d.simShieldedSep || d.unshieldedSep !== d.simUnshieldedSep) {
        throw new Error(`${label}: on-chain separators disagree with the in-process artifact`);
      }
    }

    // --- distinctness: 15 pairwise comparisons over 6 colours (spec Distinctness control) ----------
    const colourList: Array<[string, string]> = [];
    for (const d of minters) {
      colourList.push([`${d.label}(${d.tagText}).shielded`, d.shieldedColour]);
      colourList.push([`${d.label}(${d.tagText}).unshielded`, d.unshieldedColour]);
    }
    let comparisons = 0;
    let distinct = 0;
    const collisions: string[] = [];
    for (let i = 0; i < colourList.length; i++) {
      for (let k = i + 1; k < colourList.length; k++) {
        comparisons++;
        if (colourList[i][1] === colourList[k][1]) collisions.push(`${colourList[i][0]} == ${colourList[k][0]}`);
        else distinct++;
      }
    }
    if (comparisons !== 15) throw new Error(`expected 15 pairwise comparisons over 6 colours, made ${comparisons}`);
    if (collisions.length > 0) throw new Error(`colour collisions: ${collisions.join('; ')}`);
    log(`pairwise colour distinctness: ${distinct}/${comparisons}`);

    const [m1, m2, m3] = minters;
    const colours: ColourSet = {
      hex: {
        S1: m1.shieldedColour,
        S2: m2.shieldedColour,
        U1: m1.unshieldedColour,
        U2: m2.unshieldedColour,
      },
      raw: {
        S1: Buffer.from(m1.shieldedColour, 'hex'),
        S2: Buffer.from(m2.shieldedColour, 'hex'),
        U1: Buffer.from(m1.unshieldedColour, 'hex'),
        U2: Buffer.from(m2.unshieldedColour, 'hex'),
      },
      control: {
        shielded: m3.shieldedColour,
        unshielded: m3.unshieldedColour,
        rawShielded: Buffer.from(m3.shieldedColour, 'hex'),
        rawUnshielded: Buffer.from(m3.unshieldedColour, 'hex'),
      },
    };

    // --- the Manager ---------------------------------------------------------------------------------
    const managerFee = makeProviders(fee, 'manager', psDir);
    log('deploying Manager …');
    const managerDeployed: any = await withDustRetry(fee, 'deploy Manager', () =>
      deployContract(managerFee, {
        compiledContract: compiledManager(),
        privateStateId: 'manager',
        initialPrivateState: { ownerSecret: new Uint8Array(32) },
      } as any),
    );
    const managerAddress: string = managerDeployed.deployTxData.public.contractAddress;
    deployTxs.Manager = String(
      managerDeployed.deployTxData.public.txId ?? managerDeployed.deployTxData.public.txHash ?? '',
    );
    log(`  Manager at ${managerAddress}`);

    log('configure(S1, S2, U1, U2) …');
    await withDustRetry(fee, 'configure', () =>
      managerDeployed.callTx.configure(colours.raw.S1, colours.raw.S2, colours.raw.U1, colours.raw.U2),
    );
    const configured = await waitForManager(managerFee, managerAddress, (m) => m.configured, 'the Manager to configure');
    for (const c of ['S1', 'S2', 'U1', 'U2'] as const) {
      if (configured.colours[c] !== colours.hex[c]) {
        throw new Error(`colour${c} is ${configured.colours[c]}, expected ${colours.hex[c]}`);
      }
    }
    for (const control of [colours.control.shielded, colours.control.unshielded]) {
      if (Object.values(configured.colours).includes(control)) {
        throw new Error(`Minter3 control colour ${control} was admitted by configure`);
      }
    }

    // --- register AA_A (OwnerA) and AA_B (OwnerB) ------------------------------------------------------
    // `myAccount` is ledger-free, so the compiler emits no proving key for it and it is not a callTx.
    // The account ids are derived IN PROCESS by running the very same compiled circuit through the
    // simulator, so the artifact stays the single source of truth for the commitment scheme.
    const sim = await ManagerSim.create(new Uint8Array(32));
    const secretA = unshieldedSeedOf(SEEDS.ownerA);
    const secretB = unshieldedSeedOf(SEEDS.ownerB);
    const idA = await sim.ownerCommitmentFor(secretA);
    const idB = await sim.ownerCommitmentFor(secretB);
    await actAs(managerFee, secretA);
    await withDustRetry(fee, 'registerAccount(AA_A)', () => managerDeployed.callTx.registerAccount(idA));
    await actAs(managerFee, secretB);
    await withDustRetry(fee, 'registerAccount(AA_B)', () => managerDeployed.callTx.registerAccount(idB));
    const registered = await waitForManager(
      managerFee,
      managerAddress,
      (m) => m.accounts.length === 2,
      'both accounts to be registered',
    );
    if (registered.balanceCount !== 8n) {
      throw new Error(`balances holds ${registered.balanceCount} entries after registration, expected 8`);
    }
    log(`AA_A ${hex(idA)} / AA_B ${hex(idB)} registered; 8 seeded cells`);
    await actAs(managerFee, new Uint8Array(32));

    const ctx: Ctx = {
      managerAddress,
      minterAddresses: {
        Minter1: m1.address,
        Minter2: m2.address,
        Minter3: m3.address,
      },
      compiledMinter,
      compiledManager,
      minterProviders,
      managerFee,
      composedProof: makeComposedProofProvider(),
      actAs,
      colours,
    };

    const deps: ObserveDeps = {
      managerProviders: managerFee,
      managerAddress,
      colours,
      ids: { AA_A: hex(idA), AA_B: hex(idB) },
      raw: { AA_A: idA, AA_B: idB },
      observers,
      refreshObservers,
      addresses,
      submittedTxs: [],
    };

    const rig: Rig = {
      fee,
      observers,
      openSpender,
      refreshObservers,
      ctx,
      colours,
      minters,
      managerAddress,
      managerDeployed,
      ids: { AA_A: hex(idA), AA_B: hex(idB) },
      raw: { AA_A: idA, AA_B: idB, secretA, secretB },
      addresses,
      deps,
      deployTxs,
      fundingTxs,
      distinctness: { comparisons, distinct, collisions },
      close: async () => {
        await closeParty(observers.OwnerN);
        await closeParty(observers.OwnerM);
        await close();
      },
    };

    // Sanity: every seeded cell must be reproducible by the contract's own pure circuit.
    for (const account of [idA, idB]) {
      for (const c of ['S1', 'S2', 'U1', 'U2'] as const) {
        const key = balanceKeyOf(account, colours.raw[c]);
        if (registered.balances[key] !== 0n) {
          throw new Error(`seeded cell (${hex(account).slice(0, 8)}…, ${c}) is ${registered.balances[key]}, expected 0`);
        }
      }
    }

    return rig;
  } catch (e) {
    await close();
    throw e;
  }
};
