// G3 — bootstrap for the 18-row open-colour step ledger. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// What this module builds, in the order the SPECIFICATION requires it:
//
//   1. wallets and fees;
//   2. a record of the chain tip BEFORE any contract of this demonstration exists;
//   3. **the Manager, deployed FIRST** — knowing no colours, with nothing on this chain able to
//      mint one — and both accounts registered. That IS spec step 0, and the assertion that all
//      three custody maps are still size 0 belongs to the runner;
//   4. `deployMinter(...)`, the factory the runner uses for step 1 (TOKA/TOKB/TOKC), for step 15
//      (**TOKD, mid-ledger**) and for the probes (TOKE, MinterCollide). Every deployment registers
//      its colours into the COLOUR REGISTRY from ON-CHAIN CIRCUIT READS.
//
// Nothing here configures anything: there is no `configure` circuit to call, and registration seeds
// no cell. Every colour the Manager ever holds arrives through a credit.
//
// **Finding F-104 shapes the wallet layout.** On this pinned lane a wallet that SUBMITTED a
// transaction under-reports its own balance afterwards and does not self-correct, while still
// returning `progress.isStrictlyComplete() === true`. So this rig keeps the two roles apart:
//
//   OBSERVER wallets  one long-lived facade per user, opened here, which NEVER submits anything.
//                     Every user cell of the table is read from these; they can be re-opened on
//                     demand (`refreshObservers`) if one ever falls behind.
//   SPENDER wallets   opened FRESH for each user-submitted transaction and closed afterwards, so no
//                     transaction is ever built from a view a previous submission may have
//                     corrupted. Each gets its own private-state store.
//
// The fee wallet submits everything else (deploys, mints, owner-authorized Manager calls and the
// rotating on-chain spot checks) and is never an observation point either — it holds none of the
// demonstration's colours.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { fundWithNight, log, registerForDust, report, syncedState, units, waitFor, withDustRetry } from '../night.js';
import { compiledManager, compiledMinter, compiledMinterCollide } from '../contracts.js';
import { ManagerSim, MinterCollideSim, MinterSim } from '../test/sim.js';
import { hex, mapSizes, waitForManager } from '../manager-view.js';
import { makeProviders, zkDir } from './providers.js';
import { chainTip, recordDeploy, type DeployRecord } from './chain.js';
import { ColourRegistry, type ColourInfo } from './observe.js';
import type { Ctx, MinterHandle, MinterKind } from './actions.js';
import type { ObserveDeps } from './table.js';

// @ts-ignore — generated artifact
import { ledger as minterLedger } from '../../generated-zk/minter/contract/index.js';
// @ts-ignore — generated artifact
import { ledger as minterCollideLedger } from '../../generated-zk/minter-collide/contract/index.js';

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
  label: string;
  kind: MinterKind;
  tagText: string;
  tagIn: string;
  address: string;
  ledgerTag: string;
  /** For MinterCollide both of these are the ONE separator — that is the fixture. */
  shieldedSep: string;
  unshieldedSep: string;
  simShieldedSep: string;
  simUnshieldedSep: string;
  shieldedColour: string;
  unshieldedColour: string;
  /** The harness names given to the two colours (`S1`/`U1`, …, `XS`/`XU`). */
  shieldedName: string;
  unshieldedName: string;
  deploy: DeployRecord;
};

export type Spender = { party: Party; managerProviders: any; close: () => Promise<void> };

export type DeployMinterOptions = {
  label: string;
  tagText: string;
  kind: MinterKind;
  shieldedName: string;
  unshieldedName: string;
};

export type Rig = {
  fee: Party;
  /** Observer wallets — read-only, never submit (F-104). */
  observers: { OwnerN: Party; OwnerM: Party };
  /** Open a FRESH spender wallet for one user-submitted transaction. Always close it afterwards. */
  openSpender: (
    who: 'OwnerN' | 'OwnerM',
    tag: string,
    /** Wait until the fresh wallet can see EVERY leg's funds before it builds anything (F-107). */
    require?: Array<{ colour: string; shielded: boolean; amount: bigint }>,
  ) => Promise<Spender>;
  refreshObservers: () => Promise<void>;
  ctx: Ctx;
  registry: ColourRegistry;
  minters: MinterDeployment[];
  /** Deploy one more issuing contract and register its colours. Used mid-run for TOKD. */
  deployMinter: (opts: DeployMinterOptions) => Promise<MinterDeployment>;
  managerAddress: string;
  /** The deployed Manager handle, for the rotating on-chain balance spot checks. */
  managerDeployed: any;
  managerDeploy: DeployRecord;
  chainTipBeforeAnyDeploy: { height: number; hash: string; timestamp: unknown };
  ids: { AA_A: string; AA_B: string };
  raw: { AA_A: Uint8Array; AA_B: Uint8Array; secretA: Uint8Array; secretB: Uint8Array };
  addresses: { OwnerN: string; OwnerM: string };
  deps: ObserveDeps;
  deployTxs: Record<string, string>;
  fundingTxs: Record<string, string>;
  close: () => Promise<void>;
};

export const bootstrap = async (): Promise<Rig> => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00005-g3-'));
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
    // appear in the demonstration's table.
    //
    // The amounts are larger than 00004's (1,000,000 / 200,000) for a measured reason, not caution:
    // DUST accrues in proportion to REGISTERED NIGHT, and this run submits roughly twice as many
    // transactions as 00004's did (18 rows, five negative controls, three probes, a rotating
    // on-chain spot check per row and six contract deployments). More registered NIGHT means DUST is
    // regenerated faster between calls and `withDustRetry` waits less. NIGHT and DUST never appear
    // in any assertion, so the figures affect wall-clock only.
    const fundingTxs: Record<string, string> = {};
    fundingTxs.feePayer = await fundWithNight(genesis, fee, units(3_000_000n));
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
        fundingTxs[who] = await fundWithNight(fee, funding, units(500_000n));
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

    // --- THE MANAGER GOES FIRST ----------------------------------------------------------------------
    // Nothing that can mint has been deployed on this chain. The tip is recorded before the first
    // deploy so the ordering evidence has a floor as well as a ceiling.
    const chainTipBeforeAnyDeploy = await chainTip();
    log(`chain tip before ANY contract of this demonstration: block ${chainTipBeforeAnyDeploy.height}`);

    const deployTxs: Record<string, string> = {};
    const managerFee = makeProviders(fee, 'manager', psDir);
    log('deploying the Manager FIRST — no Minter exists on this chain yet …');
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
    const managerDeploy = await recordDeploy('Manager', managerAddress, managerDeployed.deployTxData.public);
    log(`  Manager at ${managerAddress} — block ${managerDeploy.blockHeight}`);

    // --- register AA_A (OwnerA) and AA_B (OwnerB) -------------------------------------------------------
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
    const sizes = mapSizes(registered);
    if (sizes.pools !== 0 || sizes.shieldedCells !== 0 || sizes.unshieldedCells !== 0) {
      throw new Error(`registration created custody state: ${JSON.stringify(sizes)} — v3 must seed NOTHING`);
    }
    log(`AA_A ${hex(idA)} / AA_B ${hex(idB)} registered; custody maps ${JSON.stringify(sizes)} — nothing seeded`);
    await actAs(managerFee, new Uint8Array(32));

    // --- fresh spenders ------------------------------------------------------------------------------
    let spenderSeq = 0;
    const openSpender = async (
      who: 'OwnerN' | 'OwnerM',
      tag: string,
      /**
       * Readiness conditions: wait until this fresh wallet can actually SEE the funds for EVERY leg
       * it is about to spend (F-107). Reading a balance from a wallet BEFORE it submits anything is
       * not what F-104 warns about.
       *
       * It must cover every leg. A transaction whose SECOND leg's funds the wallet cannot yet see
       * does not fail loudly: `balanceTx` produces a transaction the node then refuses with a bare
       * `1010: Invalid Transaction: Custom error: 223`.
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

    // --- the issuing-contract factory ------------------------------------------------------------------
    const registry = new ColourRegistry();
    const minters: MinterDeployment[] = [];
    const minterHandles: Record<string, MinterHandle> = {};

    const deployMinter = async (opts: DeployMinterOptions): Promise<MinterDeployment> => {
      const { label, tagText, kind, shieldedName, unshieldedName } = opts;
      const tag = pad32(tagText);
      const providers = makeProviders(fee, label.toLowerCase(), psDir, zkDir(kind));
      log(`deploying ${label} (${kind}) with constructor tag "${tagText}" …`);
      const compiled = kind === 'minter' ? compiledMinter() : compiledMinterCollide();
      const deployed: any = await withDustRetry(fee, `deploy ${label}`, () =>
        deployContract(providers, { compiledContract: compiled, args: [tag] } as any),
      );
      const address = deployed.deployTxData.public.contractAddress;
      deployTxs[label] = String(deployed.deployTxData.public.txId ?? deployed.deployTxData.public.txHash ?? '');
      const deploy = await recordDeploy(label, address, deployed.deployTxData.public);

      // OP1 — the deployment's own ledger cells.
      const state = await providers.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state for ${label} at ${address}`);
      const l: any = kind === 'minter' ? (minterLedger as any)(state.data) : (minterCollideLedger as any)(state.data);

      // OP2 — real on-chain circuit calls.
      const sc = await withDustRetry(fee, `${label}.shieldedColor()`, () => deployed.callTx.shieldedColor());
      const uc = await withDustRetry(fee, `${label}.unshieldedColor()`, () => deployed.callTx.unshieldedColor());

      // OP3 — the SEPARATELY COMPILED --skip-zk artifact, run in process on the same tag.
      const simSeps =
        kind === 'minter'
          ? await (async () => {
              const s = await MinterSim.create(tag);
              return { shielded: hex(s.ledger.shieldedSep), unshielded: hex(s.ledger.unshieldedSep) };
            })()
          : await (async () => {
              const s = await MinterCollideSim.create(tag);
              return { shielded: hex(s.ledger.collidingSep), unshielded: hex(s.ledger.collidingSep) };
            })();

      const d: MinterDeployment = {
        label,
        kind,
        tagText,
        tagIn: hex(tag),
        address,
        ledgerTag: hex(l.deploymentTag),
        shieldedSep: hex(kind === 'minter' ? l.shieldedSep : l.collidingSep),
        unshieldedSep: hex(kind === 'minter' ? l.unshieldedSep : l.collidingSep),
        simShieldedSep: simSeps.shielded,
        simUnshieldedSep: simSeps.unshielded,
        shieldedColour: hex(resultOf<Uint8Array>(sc)),
        unshieldedColour: hex(resultOf<Uint8Array>(uc)),
        shieldedName,
        unshieldedName,
        deploy,
      };

      if (d.ledgerTag !== d.tagIn) throw new Error(`${label}: stored tag ${d.ledgerTag} != argument ${d.tagIn}`);
      if (d.shieldedSep !== d.simShieldedSep || d.unshieldedSep !== d.simUnshieldedSep) {
        throw new Error(`${label}: on-chain separators disagree with the in-process artifact`);
      }
      if (kind === 'minter' && d.shieldedColour === d.unshieldedColour) {
        throw new Error(`${label}: an ordinary Minter must NOT produce two identical family colours`);
      }
      if (kind === 'minter-collide' && d.shieldedColour !== d.unshieldedColour) {
        throw new Error(
          `P-COLL FIXTURE BROKEN: ${label}'s family colours are not byte-identical ` +
            `(${d.shieldedColour} vs ${d.unshieldedColour})`,
        );
      }

      const shielded: ColourInfo = {
        name: shieldedName,
        family: 'shielded',
        hex: d.shieldedColour,
        raw: Buffer.from(d.shieldedColour, 'hex'),
        issuer: label,
      };
      const unshielded: ColourInfo = {
        name: unshieldedName,
        family: 'unshielded',
        hex: d.unshieldedColour,
        raw: Buffer.from(d.unshieldedColour, 'hex'),
        issuer: label,
      };
      registry.add(shielded);
      registry.add(unshielded);

      minters.push(d);
      minterHandles[label] = { label, kind, address, providers, deployed };
      log(`  ${label} at ${address}: ${shieldedName} ${d.shieldedColour} / ${unshieldedName} ${d.unshieldedColour}`);
      return d;
    };

    const ctx: Ctx = {
      managerAddress,
      minters: minterHandles,
      compiledMinter,
      compiledMinterCollide,
      compiledManager,
      managerFee,
      actAs,
    };

    const deps: ObserveDeps = {
      managerProviders: managerFee,
      managerAddress,
      registry,
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
      registry,
      minters,
      deployMinter,
      managerAddress,
      managerDeployed,
      managerDeploy,
      chainTipBeforeAnyDeploy,
      ids: { AA_A: hex(idA), AA_B: hex(idB) },
      raw: { AA_A: idA, AA_B: idB, secretA, secretB },
      addresses,
      deps,
      deployTxs,
      fundingTxs,
      close: async () => {
        await closeParty(observers.OwnerN);
        await closeParty(observers.OwnerM);
        await close();
      },
    };

    return rig;
  } catch (e) {
    await close();
    throw e;
  }
};
