// G3 — the four-party balance table: the spec's core assertion artifact.
//
// After every step the harness records AA_A, OwnerN, AA_B, OwnerM as `shielded/unshielded` of the
// MINTER's colors only (never NIGHT/DUST — spec FR-006), plus the Manager's pooled holdings, and
// asserts the spec's expected row exactly.
//
// TWO INDEPENDENT OBSERVATION POINTS PER PARTY (spec FR-004):
//
//   AA_A / AA_B  (contract-held)
//     1. the Manager's internal ACCOUNT MAP, decoded from contract state
//     2. the Manager's POOLED LEDGER HOLDINGS — the zswap pool coin's value (shielded) and the
//        contract's kernel-maintained ledger balance map (unshielded). Both are
//        maintained by kernel machinery that never touches the account map, so the standing
//        invariant `pool = AA_A + AA_B` per family IS the cross-check, and a disagreement fails
//        the run instead of passing silently.
//
//   OwnerN / OwnerM  (user-held)
//     unshielded — 1. the wallet SDK's synced state
//                  2. the UTXO set RECONSTRUCTED from the indexer's own transaction history —
//                     every created output of the colour, minus those the indexer reports as
//                     spent. Independent of the wallet's bookkeeping. (The pinned indexer has no
//                     per-address balance query at all — Finding G3-4.)
//     shielded   — 1. the wallet SDK's synced state
//                  2. the LEDGER CONSERVATION IDENTITY: the Minter's total minted supply of the
//                     colour equals the Manager's pooled holdings plus every user's holdings.
//                     The pooled side comes from contract/ledger state, so a wallet that
//                     mis-reported its shielded balance would break the identity. A shielded
//                     coin is private by construction — the indexer cannot attribute it to an
//                     owner — so this ledger-side identity, not an indexer balance query, is the
//                     honest second point for shielded user holdings.
import { indexerUnshieldedByOwner, type ManagerView } from './observe.js';
import type { Party } from '../wallet.js';
import * as rx from 'rxjs';

export type Row = { shielded: bigint; unshielded: bigint };
export type Table = { AA_A: Row; OwnerN: Row; AA_B: Row; OwnerM: Row };

export const row = (shielded: bigint, unshielded: bigint): Row => ({ shielded, unshielded });

export type Colors = { shielded: string; unshielded: string };

export type Ids = { idA: string; idB: string };

/** Everything the harness reads at one point in time, for assertion and for evidence. */
export type Observation = {
  table: Table;
  manager: ManagerView;
  /** Manager's unshielded ledger balance of the Minter colour — observation point 2. */
  managerUnshieldedLedger: bigint;
  /**
   * OwnerN / OwnerM unshielded balances reconstructed from the indexer — observation point 2.
   * Filled in only at assertion points: it costs one query per submitted transaction, so the
   * polling loops that wait for finality deliberately skip it.
   */
  indexerUnshielded?: { OwnerN: bigint; OwnerM: bigint };
  /** Individual shielded coins per user wallet: the coin-level detail FR-004 asks for. */
  coins: { OwnerN: CoinDetail[]; OwnerM: CoinDetail[] };
  /** Individual unshielded UTXOs per user wallet. */
  utxos: { OwnerN: UtxoDetail[]; OwnerM: UtxoDetail[] };
};

export type CoinDetail = { nonce: string; value: string; commitment: string; nullifier: string };
export type UtxoDetail = { value: string; intentHash?: string; outputNo?: string };

const walletState = async (p: Party): Promise<any> => rx.firstValueFrom(p.wallet.state());

const shieldedOfWallet = (s: any, color: string): bigint =>
  BigInt(s?.shielded?.balances?.[color] ?? 0n);

const unshieldedOfWallet = (s: any, color: string): bigint =>
  BigInt(s?.unshielded?.balances?.[color] ?? 0n);

const coinDetails = (s: any, color: string): CoinDetail[] =>
  (s?.shielded?.availableCoins ?? [])
    .filter((c: any) => String(c?.coin?.color ?? c?.coin?.type) === color)
    .map((c: any) => ({
      nonce: String(c.coin.nonce),
      value: String(c.coin.value),
      commitment: String(c.commitment),
      nullifier: String(c.nullifier),
    }))
    .sort((a: CoinDetail, b: CoinDetail) => a.commitment.localeCompare(b.commitment));

const utxoDetails = (s: any, color: string): UtxoDetail[] =>
  (s?.unshielded?.availableCoins ?? [])
    .filter((u: any) => String(u?.utxo?.type) === color)
    .map((u: any) => ({
      value: String(u.utxo.value),
      intentHash: u.utxo.intentHash === undefined ? undefined : String(u.utxo.intentHash),
      outputNo: u.utxo.outputNo === undefined ? undefined : String(u.utxo.outputNo),
    }))
    .sort((a: UtxoDetail, b: UtxoDetail) => `${a.value}${a.intentHash}`.localeCompare(`${b.value}${b.intentHash}`));

export type ObserveDeps = {
  managerProviders: any;
  managerAddress: string;
  colors: Colors;
  ids: Ids;
  ownerN: Party;
  ownerM: Party;
  readManager: (providers: any, address: string) => Promise<ManagerView>;
  managerUnshieldedLedger: (providers: any, address: string, color: string) => Promise<bigint>;
  /** Unshielded addresses (hex) of the two user wallets, for the indexer reconstruction. */
  addresses: { OwnerN: string; OwnerM: string };
  /** Every transaction identifier this run has submitted; grows as the run proceeds. */
  submittedTxs: string[];
};

/** Read every observation point once. Never call this and assume finality — use `waitForTable`. */
export const observe = async (d: ObserveDeps): Promise<Observation> => {
  const manager = await d.readManager(d.managerProviders, d.managerAddress);
  const mUnshielded = await d.managerUnshieldedLedger(d.managerProviders, d.managerAddress, d.colors.unshielded);

  const [sN, sM] = await Promise.all([walletState(d.ownerN), walletState(d.ownerM)]);

  return {
    table: {
      AA_A: row(manager.shieldedOf[d.ids.idA] ?? 0n, manager.unshieldedOf[d.ids.idA] ?? 0n),
      OwnerN: row(shieldedOfWallet(sN, d.colors.shielded), unshieldedOfWallet(sN, d.colors.unshielded)),
      AA_B: row(manager.shieldedOf[d.ids.idB] ?? 0n, manager.unshieldedOf[d.ids.idB] ?? 0n),
      OwnerM: row(shieldedOfWallet(sM, d.colors.shielded), unshieldedOfWallet(sM, d.colors.unshielded)),
    },
    manager,
    managerUnshieldedLedger: mUnshielded,
    coins: { OwnerN: coinDetails(sN, d.colors.shielded), OwnerM: coinDetails(sM, d.colors.shielded) },
    utxos: { OwnerN: utxoDetails(sN, d.colors.unshielded), OwnerM: utxoDetails(sM, d.colors.unshielded) },
  };
};

export const tableEquals = (a: Table, b: Table): boolean =>
  (['AA_A', 'OwnerN', 'AA_B', 'OwnerM'] as const).every(
    (k) => a[k].shielded === b[k].shielded && a[k].unshielded === b[k].unshielded,
  );

export const renderTable = (t: Table): string =>
  (['AA_A', 'OwnerN', 'AA_B', 'OwnerM'] as const)
    .map((k) => `${k}=${t[k].shielded}/${t[k].unshielded}`)
    .join('  ');

/**
 * Poll until the observed table matches `expected`, then return the observation.
 *
 * Reading once immediately after `submitTx` returns PRE-transaction state and would report a false
 * divergence, so the wait is on the expected condition. A timeout is the halt-on-first-divergence
 * failure the spec requires, and it reports exactly what was observed instead.
 */
export const waitForTable = async (
  d: ObserveDeps,
  expected: Table,
  step: string,
  timeoutMs = 240_000,
): Promise<Observation> => {
  const deadline = Date.now() + timeoutMs;
  let last: Observation | undefined;
  for (;;) {
    last = await observe(d);
    if (tableEquals(last.table, expected)) return last;
    if (Date.now() > deadline) {
      throw new Error(
        `STEP ${step} DIVERGENCE — expected [${renderTable(expected)}] but observed [${renderTable(last.table)}] ` +
          `after ${timeoutMs}ms`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
};

/**
 * Poll until an arbitrary predicate holds over a fresh observation. Used where the assertion is
 * not a balance change — the self-send cells, whose whole point is that identifiers move while
 * balances do not.
 */
export const waitUntil = async (
  d: ObserveDeps,
  pred: (o: Observation) => boolean,
  what: string,
  timeoutMs = 240_000,
): Promise<Observation> => {
  const deadline = Date.now() + timeoutMs;
  let last: Observation | undefined;
  for (;;) {
    last = await observe(d);
    if (pred(last)) return last;
    if (Date.now() > deadline) {
      throw new Error(
        `timed out after ${timeoutMs}ms waiting for ${what}; observed [${renderTable(last.table)}] ` +
          `pool=${last.manager.poolValue}@${last.manager.poolNonce}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
};

/**
 * Fill in observation point 2 for user unshielded holdings by replaying every transaction this
 * run has submitted through the indexer. Called once per assertion, never in a polling loop.
 */
export const withIndexerCheck = async (d: ObserveDeps, o: Observation): Promise<Observation> => {
  const byOwner = await indexerUnshieldedByOwner(d.submittedTxs, d.colors.unshielded);
  return {
    ...o,
    indexerUnshielded: {
      OwnerN: byOwner.get(d.addresses.OwnerN.toLowerCase()) ?? 0n,
      OwnerM: byOwner.get(d.addresses.OwnerM.toLowerCase()) ?? 0n,
    },
  };
};

/**
 * Assert everything that must hold after EVERY step: the expected table, both halves of the
 * standing pool invariant, agreement between the wallet and the indexer on unshielded user
 * balances, and the shielded conservation identity.
 *
 * `mintedShielded` / `mintedUnshielded` are the totals the Minter has minted of each colour so
 * far — the harness knows them exactly because it issues every mint.
 */
export const assertAll = (
  o: Observation,
  expected: Table,
  step: string,
  minted: { shielded: bigint; unshielded: bigint },
): void => {
  const fail = (msg: string): never => {
    throw new Error(`STEP ${step} DIVERGENCE — ${msg}`);
  };

  if (!tableEquals(o.table, expected)) {
    fail(`table is [${renderTable(o.table)}], expected [${renderTable(expected)}]`);
  }

  // --- standing invariant, both families ------------------------------------------------------
  const sumS = Object.values(o.manager.shieldedOf).reduce((a, b) => a + b, 0n);
  if (o.manager.poolValue !== sumS) {
    fail(`SHIELDED POOL INVARIANT — pool=${o.manager.poolValue} but AA_A+AA_B=${sumS}`);
  }
  const sumU = Object.values(o.manager.unshieldedOf).reduce((a, b) => a + b, 0n);
  if (o.managerUnshieldedLedger !== sumU) {
    fail(
      `UNSHIELDED POOL INVARIANT — contract ledger balance=${o.managerUnshieldedLedger} but AA_A+AA_B=${sumU}`,
    );
  }

  // --- observation point 2 for user unshielded holdings: the indexer reconstruction -------------
  // `withIndexerCheck` must have run; an assertion that silently skipped its second observation
  // point would be exactly the kind of quiet gap the specification forbids.
  if (!o.indexerUnshielded) {
    fail('the indexer reconstruction was not performed — observation point 2 is missing');
  }
  if (o.indexerUnshielded!.OwnerN !== o.table.OwnerN.unshielded) {
    fail(
      `OwnerN unshielded: wallet says ${o.table.OwnerN.unshielded}, indexer reconstruction says ${o.indexerUnshielded!.OwnerN}`,
    );
  }
  if (o.indexerUnshielded!.OwnerM !== o.table.OwnerM.unshielded) {
    fail(
      `OwnerM unshielded: wallet says ${o.table.OwnerM.unshielded}, indexer reconstruction says ${o.indexerUnshielded!.OwnerM}`,
    );
  }

  // --- observation point 2 for user shielded holdings: ledger conservation ---------------------
  const heldShielded = o.manager.poolValue + o.table.OwnerN.shielded + o.table.OwnerM.shielded;
  if (heldShielded !== minted.shielded) {
    fail(
      `SHIELDED CONSERVATION — minted ${minted.shielded} but pool+OwnerN+OwnerM = ` +
        `${o.manager.poolValue}+${o.table.OwnerN.shielded}+${o.table.OwnerM.shielded} = ${heldShielded}`,
    );
  }
  const heldUnshielded = o.managerUnshieldedLedger + o.table.OwnerN.unshielded + o.table.OwnerM.unshielded;
  if (heldUnshielded !== minted.unshielded) {
    fail(
      `UNSHIELDED CONSERVATION — minted ${minted.unshielded} but contract+OwnerN+OwnerM = ${heldUnshielded}`,
    );
  }

  // --- coin-level consistency: the enumerated coins must sum to the reported balance ------------
  const sumCoins = (cs: CoinDetail[]): bigint => cs.reduce((a, c) => a + BigInt(c.value), 0n);
  if (sumCoins(o.coins.OwnerN) !== o.table.OwnerN.shielded) {
    fail(`OwnerN shielded coins sum to ${sumCoins(o.coins.OwnerN)}, balance says ${o.table.OwnerN.shielded}`);
  }
  if (sumCoins(o.coins.OwnerM) !== o.table.OwnerM.shielded) {
    fail(`OwnerM shielded coins sum to ${sumCoins(o.coins.OwnerM)}, balance says ${o.table.OwnerM.shielded}`);
  }
};

/** A stable, byte-comparable snapshot for the "unchanged before/after" assertions (FR-005, FR-007). */
export const snapshot = (o: Observation): string =>
  JSON.stringify(
    {
      table: o.table,
      pool: { value: o.manager.poolValue, nonce: o.manager.poolNonce, hasPool: o.manager.hasPool },
      accountsShielded: o.manager.shieldedOf,
      accountsUnshielded: o.manager.unshieldedOf,
      managerUnshieldedLedger: o.managerUnshieldedLedger,
      coins: o.coins,
      utxos: o.utxos,
    },
    (_k, v) => (typeof v === 'bigint' ? `${v}` : v),
  );
