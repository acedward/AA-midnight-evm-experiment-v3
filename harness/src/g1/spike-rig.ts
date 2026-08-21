// Plan 01 Phase 2 — the minimal live rig the three spikes share. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This is DELIBERATELY not `g3/setup.ts`. That bootstrap builds the whole 18-row 00005 rig (five
// issuers, observer/spender pairs for two named users, the colour registry, the table machinery) and
// its `openSpender` is typed to OwnerN | OwnerM. The spikes need one Manager, one issuer, and a
// wallet the builder is NOT — nothing else — so a lean rig is both cheaper and easier to read than a
// parameterised version of the big one. `g3/setup.ts` is untouched; Plan 02/03 rework it for the
// swap ledger.
//
// WHAT THE SPIKES NEED, and why each piece is here:
//
//   fee wallet        submits the deploys, the mints and every on-chain read. Never an observation
//                     point and never holds a demonstration colour (fee isolation).
//   Manager v3        UNCHANGED from 00005. The spikes must not depend on a contract that does not
//                     exist yet: `depositShielded`'s `receiveShielded` deficit has EXACTLY the shape
//                     of the swap offer's −B leg, so S1 answers "can a foreign wallet balance a
//                     contract-call transaction?" without waiting for Manager v4.
//   Minter (TOKA)     supplies one real shielded colour, S_A, minted from a contract.
//   BUILDER wallet    OwnerN. It builds and proves the maker artifact and then STOPS — it never
//                     balances, never signs and never submits it.
//   FOREIGN wallet    OwnerT. Funded, DUST-registered, holds S_A, and is the wallet that balances
//                     and submits. Its seed appears nowhere in the builder's providers.
//
// F-104 discipline: a wallet that submitted is never read for its own balance. Every user-balance
// read in the spikes goes through `openObserver`, a FRESH facade on the same seed that has never
// submitted anything.
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
import { ManagerSim } from '../test/sim.js';
import { hex, mapSizes, readManager, waitForManager, type ManagerView } from '../manager-view.js';
import { makeProviders, zkDir } from '../g3/providers.js';
import type { Ctx, MinterHandle } from '../g3/actions.js';

/** `pad(32, s)` on the TypeScript side — the Minter's constructor tag. */
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
export const actAs = async (providers: any, secret: Uint8Array): Promise<void> => {
  await providers.privateStateProvider.set('manager', { ownerSecret: secret });
};

export type MinterInfo = {
  label: string;
  tagText: string;
  address: string;
  shieldedColour: string;
  shieldedRaw: Uint8Array;
  unshieldedColour: string;
  unshieldedRaw: Uint8Array;
  deployed: any;
  providers: any;
};

export type SpikeRig = {
  fee: Party;
  /** The BUILDER: proves the maker artifact and stops. It never submits anything. */
  builder: Party;
  builderManagerProviders: any;
  managerAddress: string;
  managerDeployed: any;
  managerFee: any;
  /**
   * The 00005 `g3/actions.ts` context, so the spikes drive mints and deposits through the SAME code
   * paths the 18-row ledger used — a spike that re-implemented minting would be testing its own
   * re-implementation.
   */
  ctx: Ctx;
  ids: { AA_A: string; AA_B: string };
  raw: { AA_A: Uint8Array; AA_B: Uint8Array; secretA: Uint8Array; secretB: Uint8Array };
  /** Deploy one more issuer and read its two colours back from ON-CHAIN circuit calls. */
  deployMinter: (label: string, tagText: string) => Promise<MinterInfo>;
  /** A FRESH read-only facade on `seed`, for reading a wallet balance that a submitter must not report. */
  openObserver: (name: string, seed: string) => Promise<Party>;
  /**
   * A FRESH spender facade on `seed` plus Manager providers, for ONE submission, closed afterwards.
   *
   * `require` is the F-107 remedy: wait until this brand-new wallet can actually SEE the funds it is
   * about to spend. Without it `balanceUnboundTransaction` happily produces a transaction the node
   * then refuses with a bare `1010: … Custom error: 223`.
   */
  openSpender: (
    name: string,
    seed: string,
    require?: Array<{ colour: string; shielded: boolean; amount: bigint }>,
  ) => Promise<{ party: Party; managerProviders: any; close: () => Promise<void> }>;
  readManagerNow: () => Promise<ManagerView>;
  waitForManagerNow: (p: (m: ManagerView) => boolean, what: string) => Promise<ManagerView>;
  /** OP2 — a real proved on-chain circuit read of one custody cell. */
  onChainShieldedCell: (account: Uint8Array, colour: Uint8Array) => Promise<{ value: bigint; txish: string }>;
  psDir: string;
  close: () => Promise<void>;
};

export type SpikeRigOptions = {
  /** Fund the taker (default true). S2 needs no taker, so it can skip a wallet and its funding. */
  withTaker?: boolean;
};

export const bootstrapSpikeRig = async (opts: SpikeRigOptions = {}): Promise<SpikeRig> => {
  const withTaker = opts.withTaker ?? true;
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00006-g1-'));
  const opened: Party[] = [];
  const closeAll = async () => {
    for (const p of opened) await closeParty(p);
    try {
      rmSync(psDir, { recursive: true, force: true });
    } catch {
      /* teardown must not mask the real result */
    }
  };

  try {
    // --- wallets and fees -------------------------------------------------------------------------
    const genesis = await openParty('genesis', SEEDS.genesis);
    opened.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    opened.push(fee);
    log('wallets open; syncing genesis …');
    report('genesis', await syncedState(genesis));

    await fundWithNight(genesis, fee, units(2_000_000n));
    await registerForDust(fee);

    // The funding instances of the user wallets submit their own DUST registration, so they are
    // closed immediately and never reused (F-104).
    const users: Array<[string, string]> = [['OwnerN', SEEDS.ownerN]];
    if (withTaker) users.push(['OwnerT', SEEDS.ownerT]);
    for (const [who, seed] of users) {
      const funding = await openParty(`${who}-funding`, seed);
      try {
        await fundWithNight(fee, funding, units(400_000n));
        await registerForDust(funding);
      } finally {
        await closeParty(funding);
      }
    }

    // --- the working wallets ---------------------------------------------------------------------
    // The BUILDER is long-lived: it only ever builds and proves, so F-104 (a wallet that SUBMITTED
    // under-reports its own state) cannot apply to it. Every wallet that SUBMITS is opened fresh per
    // submission through `openSpender` and closed straight after — including the taker, which is why
    // there is deliberately no long-lived taker facade here.
    const builder = await openParty('OwnerN-builder', SEEDS.ownerN);
    opened.push(builder);
    await syncedState(builder);

    // --- Manager v3, deployed by the fee wallet --------------------------------------------------
    const managerFee = makeProviders(fee, 'manager', psDir);
    log('deploying Manager v3 (UNCHANGED from 00005) …');
    const managerDeployed: any = await withDustRetry(fee, 'deploy Manager', () =>
      deployContract(managerFee, {
        compiledContract: compiledManager(),
        privateStateId: 'manager',
        initialPrivateState: { ownerSecret: new Uint8Array(32) },
      } as any),
    );
    const managerAddress: string = managerDeployed.deployTxData.public.contractAddress;
    log(`  Manager at ${managerAddress}`);

    // --- register AA_A (OwnerA's witness) and AA_B (OwnerB's witness) ----------------------------
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
    log(`AA_A ${hex(idA)} / AA_B ${hex(idB)} registered; custody maps ${JSON.stringify(sizes)}`);
    await actAs(managerFee, new Uint8Array(32));

    // --- issuer factory --------------------------------------------------------------------------
    const minterHandles: Record<string, MinterHandle> = {};
    const deployMinter = async (label: string, tagText: string): Promise<MinterInfo> => {
      const tag = pad32(tagText);
      const providers = makeProviders(fee, label.toLowerCase(), psDir, zkDir('minter'));
      log(`deploying ${label} (${tagText}) …`);
      const deployed: any = await withDustRetry(fee, `deploy ${label}`, () =>
        deployContract(providers, { compiledContract: compiledMinter(), args: [tag] } as any),
      );
      const address = deployed.deployTxData.public.contractAddress;
      const sc = await withDustRetry(fee, `${label}.shieldedColor()`, () => deployed.callTx.shieldedColor());
      const uc = await withDustRetry(fee, `${label}.unshieldedColor()`, () => deployed.callTx.unshieldedColor());
      const shieldedRaw = resultOf<Uint8Array>(sc);
      const unshieldedRaw = resultOf<Uint8Array>(uc);
      const info: MinterInfo = {
        label,
        tagText,
        address,
        shieldedColour: hex(shieldedRaw),
        shieldedRaw,
        unshieldedColour: hex(unshieldedRaw),
        unshieldedRaw,
        deployed,
        providers,
      };
      if (info.shieldedColour === info.unshieldedColour) {
        throw new Error(`${label}: an ordinary Minter must NOT produce two identical family colours`);
      }
      log(`  ${label} at ${address}: shielded ${info.shieldedColour} / unshielded ${info.unshieldedColour}`);
      minterHandles[label] = { label, kind: 'minter', address, providers, deployed };
      return info;
    };

    // --- observers and spenders ------------------------------------------------------------------
    let seq = 0;
    const openObserver = async (name: string, seed: string): Promise<Party> => {
      const p = await openParty(`${name}-observer-${++seq}`, seed);
      await syncedState(p);
      return p;
    };
    const openSpender = async (
      name: string,
      seed: string,
      require?: Array<{ colour: string; shielded: boolean; amount: bigint }>,
    ) => {
      const party = await openParty(`${name}-spender-${++seq}`, seed);
      await syncedState(party);
      for (const need of require ?? []) {
        const held = (st: any): bigint =>
          BigInt(
            (need.shielded ? st?.shielded?.balances?.[need.colour] : st?.unshielded?.balances?.[need.colour]) ?? 0n,
          );
        await waitFor(
          party,
          (st) => held(st) >= need.amount,
          `${party.name} to see ${need.amount} of ${need.shielded ? 'shielded' : 'unshielded'} ${need.colour.slice(0, 12)}… before spending it`,
          300_000,
        );
      }
      const managerProviders = makeProviders(party, 'manager', psDir);
      managerProviders.privateStateProvider.setContractAddress(managerAddress);
      await actAs(managerProviders, new Uint8Array(32));
      return { party, managerProviders, close: async () => closeParty(party) };
    };

    const builderManagerProviders = makeProviders(builder, 'manager', psDir);
    builderManagerProviders.privateStateProvider.setContractAddress(managerAddress);
    await actAs(builderManagerProviders, new Uint8Array(32));

    const onChainShieldedCell = async (account: Uint8Array, colour: Uint8Array) => {
      await actAs(managerFee, new Uint8Array(32));
      const r: any = await withDustRetry(fee, 'shieldedAccountBalance', () =>
        (managerDeployed.callTx as any).shieldedAccountBalance(account, colour),
      );
      return { value: resultOf<bigint>(r), txish: String(r?.public?.txId ?? r?.public?.txHash ?? '') };
    };

    const ctx: Ctx = {
      managerAddress,
      minters: minterHandles,
      compiledMinter,
      // 00006 uses no MinterCollide fixture; a caller that asks for it is a bug, not a fallback.
      compiledMinterCollide: () => {
        throw new Error('the spike rig deploys no MinterCollide — 00006 has no P-COLL fixture');
      },
      compiledManager,
      managerFee,
      actAs,
    };

    return {
      fee,
      builder,
      builderManagerProviders,
      managerAddress,
      managerDeployed,
      managerFee,
      ctx,
      ids: { AA_A: hex(idA), AA_B: hex(idB) },
      raw: { AA_A: idA, AA_B: idB, secretA, secretB },
      deployMinter,
      openObserver,
      openSpender,
      readManagerNow: () => readManager(managerFee, managerAddress),
      waitForManagerNow: (p, what) => waitForManager(managerFee, managerAddress, p, what),
      onChainShieldedCell,
      psDir,
      close: closeAll,
    };
  } catch (e) {
    await closeAll();
    throw e;
  }
};

export { waitFor };
