// Reading Manager v3 — the open, lazily-populated custodian (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// ONE definition of "what the Manager holds", shared by every gate, so two gates can never disagree
// about a cell. `src/g2/manager-view.ts` is a re-export shim.
//
// Two independent observation points, per FR-208:
//
//   OP1  the Manager's own LEDGER STATE, fetched from the indexer and decoded with the generated
//        `ledger()` reader. Cheap, complete, and it is what the node enforces against.
//   OP2  real ON-CHAIN CIRCUIT CALLS (`shieldedAccountBalance`, `unshieldedAccountBalance`,
//        `poolValue`, `poolHasColour`, `isRegistered`) — a different mechanism entirely: each one is
//        a proved transaction whose result comes back through the SDK, not through a state decode.
//
// A THIRD, kernel-maintained view rides along for the unshielded family: `kernelUnshielded` is the
// contract's balance map as the LEDGER keeps it (`receiveUnshielded` / `sendUnshielded` move it),
// decoded from the same fetched state through `@midnightntwrk/ledger-v9` rather than through the
// contract's own accessors. It is maintained by machinery that never touches `unshieldedBalances`,
// so the per-colour invariant `kernelUnshielded[c] == Σ unshieldedBalances[(account, c)]` is a
// genuine cross-check between two mechanisms and not a restatement of one.
//
// NOTE (00003 finding G3-3, still true on this lane): the indexer convenience view
// `publicDataProvider.queryUnshieldedBalances(contractAddress)` returns an EMPTY list for a contract
// that verifiably holds unshielded tokens, so it cannot serve as this observation point.
//
// WHAT CHANGED FROM 00004's READER, and why it matters:
//
//   - there is no `configured` flag and no `colourS1..U2` to read: v3 has NO colour knowledge, so
//     the colour set is DISCOVERED — from the pools map, from the cells the harness can account for,
//     and from the kernel balance map — never read out of a configuration cell;
//   - `balances` split into `shieldedBalances` and `unshieldedBalances`, keyed under DIFFERENT
//     domain separators (FR-203), so `balanceKeyOf` became `shieldedKeyOf` / `unshieldedKeyOf`;
//   - 00004 could assert `balances.size() == accounts.size() * 4` because registration seeded every
//     configured colour. v3 seeds nothing. Exactness is therefore asserted the other way round: the
//     harness derives the key of every cell it can explain and requires the map to contain EXACTLY
//     those keys — `unaccountedShielded` / `unaccountedUnshielded` must both be empty.
import * as ledgerV9 from '@midnightntwrk/ledger-v9';

// @ts-ignore — generated artifact
import { ledger as managerLedger, pureCircuits as managerPure } from '../generated-zk/manager/contract/index.js';

const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');

export type PooledCoin = { nonce: string; color: string; value: bigint; mt_index: bigint };

export type ManagerView = {
  accounts: string[];
  /** colour (hex) -> the single pooled coin for that colour. A colour is here only if credited. */
  pools: Record<string, PooledCoin>;
  poolCount: bigint;
  /** raw `shieldedBalances` map: composite key (hex) -> amount */
  shieldedBalances: Record<string, bigint>;
  shieldedCount: bigint;
  /** raw `unshieldedBalances` map: composite key (hex) -> amount */
  unshieldedBalances: Record<string, bigint>;
  unshieldedCount: bigint;
  /**
   * The contract's UNSHIELDED holdings as the LEDGER KERNEL maintains them: colour (hex) -> value.
   * Independent of `unshieldedBalances`; the per-colour invariant compares the two.
   */
  kernelUnshielded: Record<string, bigint>;
};

/** The `shieldedBalances` key for one cell, by RUNNING the compiled contract's own pure circuit. */
export const shieldedKeyOf = (account: Uint8Array, colour: Uint8Array): string =>
  hex((managerPure as any).shieldedKey(account, colour));

/** The `unshieldedBalances` key for the same (account, colour) — a DIFFERENT value by construction. */
export const unshieldedKeyOf = (account: Uint8Array, colour: Uint8Array): string =>
  hex((managerPure as any).unshieldedKey(account, colour));

/** OP1 (+ the kernel balance map) — one state fetch, everything the harness needs decoded from it. */
export const readManager = async (providers: any, address: string): Promise<ManagerView> => {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) throw new Error(`no contract state for Manager at ${address}`);
  const l: any = managerLedger(state.data);

  const accounts: string[] = [];
  for (const a of l.accounts) accounts.push(hex(a));
  accounts.sort();

  const pools: Record<string, PooledCoin> = {};
  for (const [k, v] of l.pools) {
    pools[hex(k)] = {
      nonce: hex(v.nonce),
      color: hex(v.color),
      value: v.value as bigint,
      mt_index: v.mt_index as bigint,
    };
  }

  const shieldedBalances: Record<string, bigint> = {};
  for (const [k, v] of l.shieldedBalances) shieldedBalances[hex(k)] = v as bigint;
  const unshieldedBalances: Record<string, bigint> = {};
  for (const [k, v] of l.unshieldedBalances) unshieldedBalances[hex(k)] = v as bigint;

  // The kernel's own view of the same contract, decoded through the ledger library rather than
  // through the contract's accessors.
  const kernelUnshielded: Record<string, bigint> = {};
  const kernelState: any = (ledgerV9 as any).ContractState.deserialize(state.serialize());
  for (const [tokenType, value] of kernelState.balance) {
    if (tokenType?.tag === 'unshielded') kernelUnshielded[String(tokenType.raw).toLowerCase()] = BigInt(value);
  }

  return {
    accounts,
    pools,
    poolCount: l.pools.size() as bigint,
    shieldedBalances,
    shieldedCount: l.shieldedBalances.size() as bigint,
    unshieldedBalances,
    unshieldedCount: l.unshieldedBalances.size() as bigint,
    kernelUnshielded,
  };
};

/**
 * A byte-comparable snapshot of EVERYTHING the Manager holds, map SIZES included. Used by the
 * negative controls: a rejection must leave this string identical, so a call that moved any cell —
 * or merely CREATED an empty one, which is the failure mode FR-202 exists to rule out — fails the
 * control even though a value-only comparison would have passed it.
 */
export const snapshot = (m: ManagerView): string =>
  JSON.stringify(m, (_k, v) => (typeof v === 'bigint' ? `${v}` : v));

/** The three custody map sizes — the spec's "exact map sizes" bookkeeping, in one place. */
export const mapSizes = (m: ManagerView) => ({
  pools: Number(m.poolCount),
  shieldedCells: Number(m.shieldedCount),
  unshieldedCells: Number(m.unshieldedCount),
});

/**
 * Contract state is only observable once the block carrying the transaction has been applied AND
 * indexed. Reading once, immediately after submission, returns the PRE-transaction state, which
 * looks exactly like "the call did nothing" (00003 finding). Always wait on the expected condition.
 */
export const waitForManager = async (
  providers: any,
  address: string,
  predicate: (m: ManagerView) => boolean,
  what: string,
  timeoutMs = 180_000,
): Promise<ManagerView> => {
  const deadline = Date.now() + timeoutMs;
  let last: ManagerView | undefined;
  for (;;) {
    last = await readManager(providers, address);
    if (predicate(last)) return last;
    if (Date.now() > deadline) {
      throw new Error(
        `timed out after ${timeoutMs}ms waiting for ${what}; last observed ${snapshot(last)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
};

export { hex };
