// The live rig the Plan 02 spikes share: Manager v4, two issuers, a MAKER and a real TAKER.
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Built ON TOP of Plan 01's `bootstrapSpikeRig` rather than beside it, using only its exported
// surface. That rig already establishes everything a swap spike needs from the chain — fee wallet,
// Manager deployed, AA_A and AA_B registered with all three custody maps proven still empty, an
// issuer factory that reads each colour back from an ON-CHAIN circuit call, and the F-104 discipline
// of a fresh facade per observation and per submission. Re-deriving that here would mean maintaining
// two copies of the part most likely to go subtly wrong.
//
// WHAT THIS ADDS, and why each piece is needed
//
//   maker (OwnerA)   The witness holder for AA_A. It BUILDS and PROVES offers and never balances,
//                    signs or submits anything.
//
//                    It is nevertheless FUNDED with NIGHT and registered for DUST — deliberately.
//                    "The maker paid no fees" is only worth asserting about a wallet that COULD
//                    have paid. An unfunded maker makes the claim true by accident and proves
//                    nothing, which is precisely the kind of vacuous assertion this series exists
//                    to avoid.
//
//   TOKA / TOKB      Two ordinary 00004 Minters, unchanged, giving the two demonstration colours
//                    S_A (what custody gives) and S_B (what custody wants).
//
//   taker (OwnerT)   A real independent wallet holding S_B and DUST, whose seed appears nowhere in
//                    the maker's providers. For the v2 open shapes that is the whole point: "a
//                    holder whose keys the maker never knew" is literally true of it.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as ledger from '@midnightntwrk/ledger-v9';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { closeParty, openParty, shieldedSeedOf, type Party } from '../wallet.js';
import { fundWithNight, log, registerForDust, syncedState, units, dustBalance } from '../night.js';
import { mintShieldedToUser, userDepositShielded } from '../g3/actions.js';
import { makeProviders } from '../g3/providers.js';
import { compiledManager } from '../contracts.js';
import { actAs, bootstrapSpikeRig, type MinterInfo, type SpikeRig } from '../g1/spike-rig.js';

export const EVIDENCE_DIR = join(REPO_ROOT, 'evidence', 'g2-spikes');
export const OFFERS_DIR = join(EVIDENCE_DIR, 'offers');

export const stamp = () => new Date().toISOString();
export const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);
export const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');

export type Colour = { label: string; raw: Uint8Array; hex: string; minter: MinterInfo };

export type SwapRig = {
  base: SpikeRig;
  /** OwnerA — the MAKER. Builds and proves; never balances, signs or submits. Funded on purpose. */
  maker: Party;
  /** Manager providers for the maker, with AA_A's owner secret already set as the witness. */
  makerProviders: any;
  compiledManager: () => any;
  /** Deploy one more issuer and take its SHIELDED colour as a named demonstration colour. */
  addColour: (label: string, tagText: string) => Promise<Colour>;
  /** Mint `value` of `colour` to the wallet behind `seed` (public keys only — no facade opened). */
  mintTo: (colour: Colour, value: bigint, seed: string) => Promise<string>;
  /** Deposit `value` of `colour` from `seed`'s wallet into `account`, the ordinary v3 way. */
  depositFrom: (seed: string, name: string, colour: Colour, value: bigint, account: Uint8Array) => Promise<string>;
  /** A wallet's shielded balance, read from a FRESH facade that has never submitted (F-104). */
  observeShielded: (name: string, seed: string, colourHex: string) => Promise<bigint>;
  /** A wallet's DUST balance, read from a FRESH facade (F-104). */
  observeDust: (name: string, seed: string) => Promise<bigint>;
  /** Fund and DUST-register an extra wallet mid-run — used for the bearer sweep in S4b. */
  provisionWallet: (name: string, seed: string, night?: bigint) => Promise<void>;
  close: () => Promise<void>;
};

export const bootstrapSwapRig = async (): Promise<SwapRig> => {
  mkdirSync(OFFERS_DIR, { recursive: true });
  const base = await bootstrapSpikeRig({ withTaker: true });
  const extra: Party[] = [];
  const closeAll = async () => {
    for (const p of extra) await closeParty(p);
    await base.close();
  };

  try {
    // --- the maker: funded, DUST-registered, and then never used to submit anything -------------
    const funding = await openParty('OwnerA-funding', SEEDS.ownerA);
    try {
      await fundWithNight(base.fee, funding, units(400_000n));
      await registerForDust(funding);
    } finally {
      await closeParty(funding);
    }
    const maker = await openParty('OwnerA-maker', SEEDS.ownerA);
    extra.push(maker);
    await syncedState(maker);
    const makerProviders = makeProviders(maker, 'manager', base.psDir);
    makerProviders.privateStateProvider.setContractAddress(base.managerAddress);
    // The debited account is derived from THIS secret, never from a circuit argument.
    await actAs(makerProviders, base.raw.secretA);
    log(`maker OwnerA open (funded + DUST-registered on purpose, so "paid no fees" means something)`);

    let colourSeq = 0;
    const addColour = async (label: string, tagText: string): Promise<Colour> => {
      const minter = await base.deployMinter(`Minter${++colourSeq}`, tagText);
      return { label, raw: minter.shieldedRaw, hex: minter.shieldedColour, minter };
    };

    const mintTo = async (colour: Colour, value: bigint, seed: string): Promise<string> => {
      // Minting needs only the recipient's PUBLIC keys, both derived from the seed, so no facade is
      // opened for the recipient here.
      const keys = { shieldedSecretKeys: ledger.ZswapSecretKeys.fromSeed(shieldedSeedOf(seed)) };
      const tx = await mintShieldedToUser(base.ctx, colour.minter.label, value, keys as any, base.fee);
      log(`minted ${value} ${colour.label} (${colour.hex.slice(0, 12)}…) in ${tx}`);
      return tx;
    };

    const depositFrom = async (
      seed: string,
      name: string,
      colour: Colour,
      value: bigint,
      account: Uint8Array,
    ): Promise<string> => {
      const spender = await base.openSpender(name, seed, [{ colour: colour.hex, shielded: true, amount: value }]);
      try {
        const { txId } = await userDepositShielded(
          base.ctx,
          spender.party,
          spender.managerProviders,
          colour.raw,
          value,
          account,
        );
        log(`${name} deposited ${value} ${colour.label} into custody in ${txId}`);
        return txId;
      } finally {
        await spender.close();
      }
    };

    const observeShielded = async (name: string, seed: string, colourHex: string): Promise<bigint> => {
      const obs = await base.openObserver(name, seed);
      try {
        const st: any = await syncedState(obs);
        return BigInt(st?.shielded?.balances?.[colourHex] ?? 0n);
      } finally {
        await closeParty(obs);
      }
    };

    const observeDust = async (name: string, seed: string): Promise<bigint> => {
      const obs = await base.openObserver(name, seed);
      try {
        return dustBalance(await syncedState(obs));
      } finally {
        await closeParty(obs);
      }
    };

    const provisionWallet = async (name: string, seed: string, night: bigint = units(200_000n)): Promise<void> => {
      const p = await openParty(`${name}-funding`, seed);
      try {
        await fundWithNight(base.fee, p, night);
        await registerForDust(p);
      } finally {
        await closeParty(p);
      }
      log(`${name} funded and DUST-registered`);
    };

    return {
      base,
      maker,
      makerProviders,
      compiledManager,
      addColour,
      mintTo,
      depositFrom,
      observeShielded,
      observeDust,
      provisionWallet,
      close: closeAll,
    };
  } catch (e) {
    await closeAll();
    throw e;
  }
};

/**
 * A wallet's SHIELDED PUBLIC keys, derived straight from its seed.
 *
 * Naming a taker in a v1 offer needs only their public keys, so no facade is opened for them — which
 * also keeps the maker's side honest: it learns a coin public key and an encryption key, nothing more.
 */
export const shieldedKeysOf = (seed: string): { coinPublicKey: unknown; encryptionPublicKey: unknown } => {
  const keys = (ledger as any).ZswapSecretKeys.fromSeed(shieldedSeedOf(seed));
  return { coinPublicKey: keys.coinPublicKey, encryptionPublicKey: keys.encryptionPublicKey };
};

/** A wallet's shielded receiving address, the form `transferTransaction` wants. */
export const shieldedAddressOf = async (p: Party): Promise<unknown> => await (p.wallet as any).shielded.getAddress();

/**
 * Send `amount` of a SHIELDED colour from one wallet to another, with stock facade calls.
 *
 * Used for the S4b bearer SWEEP, where the point is not that the coin arrived but that the throwaway
 * key can SPEND it: receiving a coin proves it was addressed to the key, whereas spending it proves
 * the published secret actually confers control.
 */
export const sweepShieldedTo = async (
  from: Party,
  toShieldedAddress: unknown,
  colourHex: string,
  amount: bigint,
): Promise<{ txId: string; feesSpecks?: string }> => {
  const facade: any = from.wallet;
  const ttl = new Date(Date.now() + 30 * 60 * 1000);
  const recipe = await facade.transferTransaction(
    [{ type: 'shielded', outputs: [{ type: colourHex, amount, receiverAddress: toShieldedAddress }] }],
    { shieldedSecretKeys: from.shieldedSecretKeys, dustSecretKey: from.dustSecretKey },
    { ttl },
  );
  const signed = await facade.signRecipe(recipe, (from.unshieldedKeystore as any).signDataAsync);
  const finalized = await facade.finalizeRecipe(signed);
  let feesSpecks: string | undefined;
  try {
    feesSpecks = String(finalized.fees((recipe as any)?.blockData?.ledgerParameters));
  } catch {
    /* fee estimation is diagnostics, not an assertion */
  }
  const txId = String(await facade.submitTransaction(finalized));
  log(`  sweep submitted: ${txId}`);
  return { txId, feesSpecks };
};

/**
 * Which LAYER refused, from the stage a take stopped at plus the error text.
 *
 * Plan 02 asks every refusal to name the layer, because the four candidate walls behave completely
 * differently and the earlier prior art in this lane died in the PROOF SERVER — a fact that would
 * have been invisible from a table saying only "refused".
 */
export const classifyRefusal = (stage: string, error: string | undefined): string => {
  const e = (error ?? '').toLowerCase();
  if (/compil|circuit .* not found|unknown circuit/.test(e)) return 'compiler / generated artifact';
  if (/failed to check|proof server|proving|prove' returned|bad input/.test(e)) return 'proof server';
  if (/wellformed|invalid balance|malformed/.test(e)) return 'ledger wellFormed (offline)';
  if (/1010|custom error|invalid transaction/.test(e)) return 'node (submitted and refused)';
  if (stage === 'envelope' || stage === 'expired' || stage === 'fundability' || stage === 'deserialize') {
    return 'harness gate (offline, before any network contact)';
  }
  if (/insufficientfunds|balanc/.test(e)) return "taker's wallet balancer";
  return error ? 'unclassified — see the verbatim text' : 'no refusal';
};
