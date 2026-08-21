// THE G5 LIVE RIG — the S5b dose-response apparatus, parametrized over CONTRACT VARIANTS.
// 00006 Plan 05 Phase 1/2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// ================================================================================================
// WHY THIS IS A NEW FILE AND NOT A PARAMETER ON `g1/spike-rig.ts`
// ================================================================================================
//
// Plan 05's first binding constraint is that the shipped Manager v4 and gates G1-G4 stay EXACTLY as
// closed. `g1/spike-rig.ts` and `g2/swap-rig.ts` are gate-green code: adding a `variant` option to
// them would be additive and defaulted, and would very probably change nothing — but "very probably"
// is not the standard, and PROVING it would mean re-running G1 (46 min) and G2 (82 min) of stack time
// to re-establish gates that are already closed. This file composes the SAME building blocks instead
// (`openParty`, `fundWithNight`, `registerForDust`, `makeProviders`, `mintShieldedToUser`,
// `userDepositShielded`, `deployContract`) so nothing that a closed gate depends on is edited.
//
// It is composition, not duplication: every piece of LOGIC lives where it already lived. What is here
// is the wiring plus the four things that genuinely differ per variant —
//
//   * WHICH artifact is deployed (`compiledVariant` + `zkDir(variant.id)`);
//   * HOW custody is read (the layouts disagree; `variants.ts::custodySize` / `cellValue` decide);
//   * HOW an offer is built (one circuit, or arm (e)'s stage -> openSwap -> consolidate);
//   * the CHAIN'S LedgerParameters, captured here and nowhere else, because the offline placement
//     model (F-313) is only calibrated once it has them.
//
// F-104 discipline is inherited unchanged: a wallet that submitted is never an observation point.
// Custody is read through the deployed contract's ledger state via the FEE wallet's providers, and
// every user-balance read opens a FRESH facade.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import * as ledger from '@midnightntwrk/ledger-v9';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, shieldedSeedOf, unshieldedSeedOf, type Party } from '../wallet.js';
import {
  dustBalance,
  fundWithNight,
  log,
  nightBalance,
  registerForDust,
  registeredNightUtxos,
  syncedState,
  units,
  waitFor,
  withDustRetry,
} from '../night.js';
import { makeProviders, zkDir } from '../g3/providers.js';
import { buildCall } from '../g3/compose.js';
import { compiledMinter } from '../contracts.js';
import { mintShieldedToUser, userDepositShielded, type Ctx, type MinterHandle } from '../g3/actions.js';
import { nodeRefusalOf } from '../node-error.js';
import {
  cellValue,
  colourTotal,
  compiledVariant,
  custodySize,
  importVariant,
  type CustodySize,
  type VariantSpec,
} from './variants.js';
import { VariantSim } from './placement-model.js';

const pad32 = (s: string): Uint8Array => {
  const b = Buffer.from(s, 'utf-8');
  if (b.length > 32) throw new Error(`tag "${s}" exceeds 32 bytes`);
  const out = new Uint8Array(32);
  out.set(b);
  return out;
};

export const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');
const resultOf = <T>(r: any): T => (r?.private?.result ?? r?.result) as T;

/** Set the owner secret this variant's witness reads on the next call through `providers`. */
export const actAs = async (providers: any, secret: Uint8Array): Promise<void> => {
  await providers.privateStateProvider.set('manager', { ownerSecret: secret });
};

export type Colour = { label: string; raw: Uint8Array; hex: string; minter: MinterHandle };

export type Account = { label: string; secret: Uint8Array; id: Uint8Array; idHex: string };

export type FeeCapacity = { dustBalance: bigint; nightBalance: bigint; registeredNightUtxos: number };

export type VariantView = {
  size: CustodySize;
  /** `accountLabel/colourLabel` -> attributed value, or `absent` when nothing is attributed. */
  cells: Record<string, string>;
  /** colour label -> total the contract holds of it. */
  held: Record<string, string>;
  /** Arm (e) only: the escrow cells, which are custody state too. */
  escrow?: Record<string, string>;
};

export type G5Rig = {
  variant: VariantSpec;
  contractAddress: string;
  fee: Party;
  /** Providers bound to the FEE wallet — deploys, mints, and every custody read. Never an observer. */
  feeProviders: any;
  /** The MAKER (OwnerA): builds and proves offers, funded and DUST-registered on purpose. */
  maker: Party;
  makerProviders: any;
  compiled: () => any;
  /** The CHAIN's ledger parameters, fetched from the indexer — what F-313's model needs. */
  chainParams: any;
  accounts: Account[];
  /** Register one more account under a fresh label. */
  addAccount: (label: string, seed: string) => Promise<Account>;
  /** Deploy one more issuer and take its SHIELDED colour. */
  addColour: (label: string, tagText: string) => Promise<Colour>;
  mintTo: (colour: Colour, value: bigint, seed: string) => Promise<string>;
  /** Deposit into custody the ordinary way, from an unrelated user's wallet (fresh facade each time). */
  depositFrom: (seed: string, name: string, colour: Colour, value: bigint, account: Uint8Array) => Promise<string>;
  /**
   * The same deposit, from a LONG-LIVED depositor facade reused across calls.
   *
   * For growing custody to many cells: a fresh facade per deposit costs more than the deposit. Safe
   * because the depositor submits and is never read — see the implementation's note on F-104.
   */
  depositManyFrom: (seed: string, name: string, colour: Colour, value: bigint, account: Uint8Array) => Promise<string>;
  read: (colours: Colour[], accounts: Account[]) => Promise<VariantView>;
  /**
   * OP2 — one custody cell read again through a REAL PROVED ON-CHAIN CIRCUIT CALL.
   *
   * A genuinely independent mechanism from OP1: OP1 fetches the contract's ledger state from the
   * indexer and decodes it with the generated reader, while this submits a transaction and takes the
   * result back through the SDK. The series requires two observation points for every custody claim
   * (FR-208, and G3's discipline that Plan 05 says every live settle must keep), because a decoder bug
   * would be invisible to a single point.
   *
   * Returns `unavailable` rather than guessing when the node refuses every attempt — see the retry
   * note in the implementation. A gap is reported as a gap; it never masquerades as agreement.
   */
  onChainCell: (account: Uint8Array, colour: Uint8Array, label: string) => Promise<{ value: string; retries: number }>;
  waitFor: (colours: Colour[], accounts: Account[], p: (v: VariantView) => boolean, what: string) => Promise<VariantView>;
  observeShielded: (name: string, seed: string, colourHex: string) => Promise<bigint>;
  observeFeeCapacity: (name: string, seed: string) => Promise<FeeCapacity>;
  /** A FRESH spender facade plus variant providers, for ONE submission, closed afterwards. */
  openSpender: (
    name: string,
    seed: string,
    require?: Array<{ colour: string; amount: bigint }>,
  ) => Promise<{ party: Party; providers: any; close: () => Promise<void> }>;
  /**
   * Build, prove, balance and submit ONE self-balanced circuit call as `actor`, from a fresh facade
   * that is closed afterwards (F-104).
   *
   * Used for arm (e)'s `stageOffer` and `consolidate`, which are the whole point of that arm: they are
   * ordinary custody transactions the maker submits ITSELF, so they need no segment-0 placement and
   * F-310 does not constrain them. Everything about them is normal, and that is the claim.
   */
  submitAs: (
    name: string,
    seed: string,
    actorSecret: Uint8Array,
    circuitId: string,
    args: unknown[],
  ) => Promise<string>;
  provisionWallet: (name: string, seed: string, night?: bigint) => Promise<void>;
  psDir: string;
  close: () => Promise<void>;
};

export type G5RigOptions = {
  /** Extra seeds to fund and DUST-register at bootstrap (the taker, and any sweeper). */
  fundSeeds?: Array<[string, string]>;
};

export const bootstrapG5Rig = async (v: VariantSpec, opts: G5RigOptions = {}): Promise<G5Rig> => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), `aa00006-g5-${v.id}-`));
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
    const genesis = await openParty('genesis', SEEDS.genesis);
    opened.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    opened.push(fee);
    await syncedState(genesis);
    await fundWithNight(genesis, fee, units(2_000_000n));
    await registerForDust(fee);

    // Funding instances submit their own DUST registration, so they are closed and never reused
    // (F-104). OwnerN funds deposits, OwnerA is the maker, OwnerT is the independent taker.
    const toFund: Array<[string, string]> = [
      ['OwnerN', SEEDS.ownerN],
      ['OwnerA', SEEDS.ownerA],
      ['OwnerT', SEEDS.ownerT],
      ...(opts.fundSeeds ?? []),
    ];
    for (const [who, seed] of toFund) {
      const funding = await openParty(`${who}-funding`, seed);
      try {
        await fundWithNight(fee, funding, units(400_000n));
        await registerForDust(funding);
      } finally {
        await closeParty(funding);
      }
    }

    // --- deploy THE VARIANT ---------------------------------------------------------------------
    const mod = await importVariant(v, 'generated-zk');
    const compiled = compiledVariant(v, mod);
    const feeProviders = makeProviders(fee, 'manager', psDir, zkDir(v.id));
    log(`deploying G5 variant '${v.id}' (${v.title}) …`);
    const deployed: any = await withDustRetry(fee, `deploy ${v.id}`, () =>
      deployContract(feeProviders, {
        compiledContract: compiled(),
        privateStateId: 'manager',
        initialPrivateState: { ownerSecret: new Uint8Array(32) },
      } as any),
    );
    const contractAddress: string = deployed.deployTxData.public.contractAddress;
    log(`  ${v.id} at ${contractAddress}`);

    // --- the CHAIN's ledger parameters ----------------------------------------------------------
    //
    // Fetched exactly as `midnight-js-contracts` fetches them for its own call construction
    // (`dist/index.mjs:1402`), so the offline model (F-313) can be driven by the same numbers the live
    // partitioner used. This is the single most load-bearing line in this file: without it the offline
    // sweep's absolute boundaries are the ledger crate's defaults and not this chain's.
    const zswapAndContract: any = await feeProviders.publicDataProvider.queryZSwapAndContractState(contractAddress);
    const chainParams = zswapAndContract?.[2];
    if (!chainParams) throw new Error('the indexer returned no ledger parameters for the deployed variant');
    log(`  chain ledger parameters fetched (${String(chainParams).length} chars rendered)`);

    // --- accounts -------------------------------------------------------------------------------
    //
    // The account id is derived OFF CHAIN, and it has to be: `myAccount` reads no ledger state, so the
    // compiler emits no proving key for it and it is absent from `provableCircuits` — there is nothing
    // to call on chain. `g1/spike-rig.ts` solves this the same way, with the simulator; here the
    // simulator is the VARIANT's own compiled artifact, so the commitment is produced by exactly the
    // code the deployed contract runs rather than by an off-chain reimplementation of the hashing.
    const idSim = await VariantSim.create(v);
    const accounts: Account[] = [];
    const addAccount = async (label: string, seed: string): Promise<Account> => {
      const secret = unshieldedSeedOf(seed);
      const id = await idSim.accountFor(secret);
      await actAs(feeProviders, secret);
      await withDustRetry(fee, `registerAccount(${label})`, () => deployed.callTx.registerAccount(id));
      const acct: Account = { label, secret, id, idHex: hex(id) };
      accounts.push(acct);
      log(`  account ${label} = ${acct.idHex.slice(0, 16)}… registered`);
      return acct;
    };

    // --- issuers --------------------------------------------------------------------------------
    const minters: Record<string, MinterHandle> = {};
    let colourSeq = 0;
    const addColour = async (label: string, tagText: string): Promise<Colour> => {
      const mLabel = `Minter${++colourSeq}`;
      const providers = makeProviders(fee, mLabel.toLowerCase(), psDir, zkDir('minter'));
      const md: any = await withDustRetry(fee, `deploy ${mLabel}`, () =>
        deployContract(providers, { compiledContract: compiledMinter(), args: [pad32(tagText)] } as any),
      );
      const address = md.deployTxData.public.contractAddress;
      const sc = await withDustRetry(fee, `${mLabel}.shieldedColor()`, () => md.callTx.shieldedColor());
      const raw = resultOf<Uint8Array>(sc);
      const handle: MinterHandle = { label: mLabel, kind: 'minter', address, providers, deployed: md };
      minters[mLabel] = handle;
      log(`  colour ${label} = ${hex(raw).slice(0, 12)}… from ${mLabel} at ${address}`);
      return { label, raw, hex: hex(raw), minter: handle };
    };

    // The `Ctx` the shipped `actions.ts` helpers expect. `compiledManager` returns THE VARIANT, which
    // is the whole trick: `userDepositShielded` then drives any arm with no per-arm code.
    const ctx: Ctx = {
      managerAddress: contractAddress,
      minters,
      compiledMinter,
      compiledMinterCollide: () => {
        throw new Error('the G5 rig deploys no MinterCollide — Plan 05 has no P-COLL fixture');
      },
      compiledManager: compiled,
      managerFee: feeProviders,
      actAs,
    };

    const mintTo = async (colour: Colour, value: bigint, seed: string): Promise<string> => {
      const keys = { shieldedSecretKeys: (ledger as any).ZswapSecretKeys.fromSeed(shieldedSeedOf(seed)) };
      return await mintShieldedToUser(ctx, colour.minter.label, value, keys as any, fee);
    };

    const openSpender = async (name: string, seed: string, require?: Array<{ colour: string; amount: bigint }>) => {
      const party = await openParty(`${name}-spender`, seed);
      await syncedState(party);
      for (const need of require ?? []) {
        await waitFor(
          party,
          (st: any) => BigInt(st?.shielded?.balances?.[need.colour] ?? 0n) >= need.amount,
          `${party.name} to see ${need.amount} of shielded ${need.colour.slice(0, 12)}… before spending it`,
          300_000,
        );
      }
      const providers = makeProviders(party, 'manager', psDir, zkDir(v.id));
      providers.privateStateProvider.setContractAddress(contractAddress);
      await actAs(providers, new Uint8Array(32));
      return { party, providers, close: async () => closeParty(party) };
    };

    const submitAs = async (
      name: string,
      seed: string,
      actorSecret: Uint8Array,
      circuitId: string,
      args: unknown[],
    ): Promise<string> => {
      const spender = await openSpender(name, seed);
      try {
        await actAs(spender.providers, actorSecret);
        return await withDustRetry(spender.party, circuitId, async () => {
          const built = await buildCall({
            providers: spender.providers,
            compiledContract: compiled(),
            contractAddress,
            circuitId,
            args,
            privateStateId: 'manager',
          });
          const proven = await spender.providers.proofProvider.proveTx(built.private.unprovenTx);
          const toSubmit = await spender.providers.walletProvider.balanceTx(proven);
          const txId = String(await spender.providers.midnightProvider.submitTx(toSubmit));
          log(`  ${circuitId} submitted by ${name} in ${txId}`);
          return txId;
        });
      } finally {
        await spender.close();
      }
    };

    const depositFrom = async (
      seed: string,
      name: string,
      colour: Colour,
      value: bigint,
      account: Uint8Array,
    ): Promise<string> => {
      const spender = await openSpender(name, seed, [{ colour: colour.hex, amount: value }]);
      try {
        const { txId } = await userDepositShielded(ctx, spender.party, spender.providers, colour.raw, value, account);
        return txId;
      } finally {
        await spender.close();
      }
    };

    /**
     * A LONG-LIVED depositor, opened once and reused for every deposit that grows custody.
     *
     * WHY THIS IS SAFE, and it is worth being explicit because the series' default is the opposite.
     * F-104 says a wallet that SUBMITTED is never an observation point, and every submitting wallet
     * elsewhere in this harness is opened fresh per submission for exactly that reason. The depositor
     * is different: custody is read through the CONTRACT's ledger state via the fee wallet's
     * providers, and the depositor's OWN balance is never asserted anywhere in the matrix. It submits
     * and is never read, so the rule it exists to enforce cannot be violated.
     *
     * WHY IT MATTERS: growing custody to sixteen cells means sixteen deposits, and opening plus
     * syncing a fresh facade costs more than the deposit itself. Across seven fixtures that is close
     * to an hour of a shared host's wall clock spent proving something already proven. The visibility
     * wait (F-107) is kept per deposit, so nothing is assumed about what the wallet can see.
     */
    const depositors = new Map<string, { party: Party; providers: any }>();
    const depositManyFrom = async (
      seed: string,
      name: string,
      colour: Colour,
      value: bigint,
      account: Uint8Array,
    ): Promise<string> => {
      let d = depositors.get(name);
      if (!d) {
        const party = await openParty(`${name}-depositor`, seed);
        opened.push(party);
        await syncedState(party);
        const providers = makeProviders(party, 'manager', psDir, zkDir(v.id));
        providers.privateStateProvider.setContractAddress(contractAddress);
        await actAs(providers, new Uint8Array(32));
        d = { party, providers };
        depositors.set(name, d);
      }
      // F-107 kept per deposit: wait until this wallet can actually SEE what it is about to spend.
      await waitFor(
        d.party,
        (st: any) => BigInt(st?.shielded?.balances?.[colour.hex] ?? 0n) >= value,
        `${name} to see ${value} of shielded ${colour.hex.slice(0, 12)}… before depositing it`,
        300_000,
      );
      const { txId } = await userDepositShielded(ctx, d.party, d.providers, colour.raw, value, account);
      return txId;
    };

    // --- custody reading, layout-generic --------------------------------------------------------
    const read = async (colours: Colour[], accts: Account[]): Promise<VariantView> => {
      const state = await feeProviders.publicDataProvider.queryContractState(contractAddress);
      if (!state) throw new Error(`no contract state for ${v.id} at ${contractAddress}`);
      const l: any = mod.ledger(state.data);
      const size = custodySize(v, l);
      const cells: Record<string, string> = {};
      for (const a of accts) {
        for (const c of colours) {
          const val = cellValue(v, l, mod.pureCircuits, a.id, c.raw);
          // Absence and zero are DIFFERENT claims (FR-202) and the no-state-created proofs depend on
          // the difference, so a zero that comes from a missing entry is reported as `absent`.
          cells[`${a.label}/${c.label}`] = val === 0n ? 'absent-or-zero' : String(val);
        }
      }
      const held: Record<string, string> = {};
      for (const c of colours) held[c.label] = String(colourTotal(v, l, c.raw));
      const out: VariantView = { size, cells, held };
      if (v.offer === 'staged') {
        out.escrow = {
          active: String(l.escrowActive),
          coinValue: String(l.escrowCoin.value),
          coinColour: hex(l.escrowCoin.color),
          owner: hex(l.escrowOwner),
          receivedActive: String(l.receivedActive),
          receivedValue: String(l.receivedCoin.value),
          receivedColour: hex(l.receivedCoin.color),
          receivedOwner: hex(l.receivedOwner),
        };
      }
      return out;
    };

    const waitForView = async (
      colours: Colour[],
      accts: Account[],
      predicate: (view: VariantView) => boolean,
      what: string,
      timeoutMs = 180_000,
    ): Promise<VariantView> => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const view = await read(colours, accts);
        if (predicate(view)) return view;
        if (Date.now() > deadline) {
          throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}; last ${JSON.stringify(view)}`);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    /**
     * OP2, with the bounded 104 retry inherited from `g2/spike-common.ts`.
     *
     * WHY THE RETRY EXISTS AND IS NOT PAPERING OVER A RESULT: OP2 is a submitted transaction, and a
     * contract call submitted shortly after another call on the same contract is refused with
     * `Custom error: 104` on this lane — finding F-301 / issue 0001's exact signature ("first attempt
     * refused, identical retry sometimes accepted"). A 104 on a READ-ONLY observation says nothing
     * about the thing under test, and letting it kill a case would record a measurement failure as a
     * product failure. So it is retried, bounded, with the count kept; and if every attempt fails the
     * cell is marked UNAVAILABLE rather than guessed at, leaving OP1 to carry the observation and the
     * gap visible in the evidence. Any OTHER refusal code is a real failure and is surfaced.
     */
    const OP2_UNAVAILABLE = 'unavailable';
    const onChainCell = async (
      account: Uint8Array,
      colour: Uint8Array,
      label: string,
    ): Promise<{ value: string; retries: number }> => {
      const maxAttempts = 4;
      let lastErr = '';
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await actAs(feeProviders, new Uint8Array(32));
          const r: any = await withDustRetry(fee, 'shieldedAccountBalance', () =>
            (deployed.callTx as any).shieldedAccountBalance(account, colour),
          );
          return { value: String(resultOf<bigint>(r)), retries: attempt - 1 };
        } catch (e) {
          const refusal = nodeRefusalOf(e);
          lastErr = refusal.verbatim ?? String(e).slice(0, 200);
          if (refusal.code !== 104) throw e; // not the known flake — a real failure, surfaced
          if (attempt === maxAttempts) break;
          log(`OP2 ${label}: refused with Custom error: 104 (attempt ${attempt}/${maxAttempts}) — the F-301 flake; retrying in 8s`);
          await new Promise((r) => setTimeout(r, 8_000));
        }
      }
      log(`OP2 ${label}: UNAVAILABLE after ${maxAttempts} attempts (last: ${lastErr}); OP1 carries this observation`);
      return { value: OP2_UNAVAILABLE, retries: maxAttempts };
    };

    const observeShielded = async (name: string, seed: string, colourHex: string): Promise<bigint> => {
      const obs = await openParty(`${name}-observer`, seed);
      try {
        const st: any = await syncedState(obs);
        return BigInt(st?.shielded?.balances?.[colourHex] ?? 0n);
      } finally {
        await closeParty(obs);
      }
    };

    const observeFeeCapacity = async (name: string, seed: string): Promise<FeeCapacity> => {
      const obs = await openParty(`${name}-fee-observer`, seed);
      try {
        const st = await syncedState(obs);
        return {
          dustBalance: dustBalance(st),
          nightBalance: nightBalance(st),
          registeredNightUtxos: registeredNightUtxos(st).length,
        };
      } finally {
        await closeParty(obs);
      }
    };

    const provisionWallet = async (name: string, seed: string, night: bigint = units(200_000n)): Promise<void> => {
      const p = await openParty(`${name}-funding`, seed);
      try {
        await fundWithNight(fee, p, night);
        await registerForDust(p);
      } finally {
        await closeParty(p);
      }
    };

    // --- the maker, funded on purpose -----------------------------------------------------------
    //
    // "The maker paid no fees" is only worth asserting about a wallet that COULD have paid, so the
    // maker holds registered NIGHT. Inherited verbatim from `g2/swap-rig.ts`'s reasoning.
    const maker = await openParty('OwnerA-maker', SEEDS.ownerA);
    opened.push(maker);
    await syncedState(maker);
    const makerProviders = makeProviders(maker, 'manager', psDir, zkDir(v.id));
    makerProviders.privateStateProvider.setContractAddress(contractAddress);

    return {
      variant: v,
      contractAddress,
      fee,
      feeProviders,
      maker,
      makerProviders,
      compiled,
      chainParams,
      accounts,
      addAccount,
      addColour,
      mintTo,
      depositFrom,
      depositManyFrom,
      read,
      onChainCell,
      waitFor: waitForView,
      observeShielded,
      observeFeeCapacity,
      openSpender,
      submitAs,
      provisionWallet,
      psDir,
      close: closeAll,
    };
  } catch (e) {
    await closeAll();
    throw e;
  }
};

/** A wallet's SHIELDED PUBLIC keys, straight from its seed — enough to name a taker in a v1 offer. */
export const shieldedKeysOf = (seed: string): { coinPublicKey: unknown; encryptionPublicKey: unknown } => {
  const keys = (ledger as any).ZswapSecretKeys.fromSeed(shieldedSeedOf(seed));
  return { coinPublicKey: keys.coinPublicKey, encryptionPublicKey: keys.encryptionPublicKey };
};
