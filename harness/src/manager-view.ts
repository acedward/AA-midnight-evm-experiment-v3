// Reading the multi-colour Manager (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// Promoted out of `src/g2/` in Plan 03 because G3 needs exactly the same reader: one definition of
// "what the Manager holds" serves both gates, so the two can never disagree about a cell.
// `src/g2/manager-view.ts` is now a re-export shim — the same promotion Plan 02 made for
// `src/contracts.ts`, so that one `CompiledContract.make` tag serves every gate.
//
// Two independent observation points, per FR-108:
//
//   OP1  the Manager's own LEDGER STATE, fetched from the indexer and decoded with the generated
//        `ledger()` reader. Cheap, complete, and it is what the node enforces against.
//   OP2  real ON-CHAIN CIRCUIT CALLS (`accountBalance`, `poolValue`, `poolHasColour`,
//        `isRegistered`) — a different mechanism entirely: each one is a proved transaction whose
//        result comes back through the SDK, not through a state decode.
//
// A THIRD, kernel-maintained view rides along for the unshielded family: `kernelUnshielded` is the
// contract's balance map as the LEDGER keeps it (`receiveUnshielded` / `sendUnshielded` move it),
// decoded from the same fetched state through `@midnightntwrk/ledger-v9` rather than through the
// contract's own accessors. It is maintained by machinery that never touches `balances`, so the
// per-colour invariant `kernelUnshielded[c] == Σ balances[(account, c)]` is a genuine cross-check
// between two mechanisms and not a restatement of one.
//
// NOTE (00003 finding G3-3, still true on this lane): the indexer convenience view
// `publicDataProvider.queryUnshieldedBalances(contractAddress)` returns an EMPTY list for a
// contract that verifiably holds unshielded tokens, so it cannot serve as this observation point.
//
// The whole (account, colour) table is enumerable because `registerAccount` seeds all four
// configured colours at zero, so `balances.size() == accounts.size() * 4` always holds, and because
// the compiled artifact exposes `balanceKey` as a PURE circuit — the harness derives each cell's key
// by running the contract's own code in process, never by reimplementing the hashing scheme.
import * as ledgerV9 from '@midnightntwrk/ledger-v9';

// @ts-ignore — generated artifact
import { ledger as managerLedger, pureCircuits as managerPure } from '../generated-zk/manager/contract/index.js';

const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');

export type PooledCoin = { nonce: string; color: string; value: bigint; mt_index: bigint };

export type ManagerView = {
  configured: boolean;
  colours: { S1: string; S2: string; U1: string; U2: string };
  accounts: string[];
  /** colour (hex) -> the single pooled coin for that colour */
  pools: Record<string, PooledCoin>;
  poolCount: bigint;
  /** raw `balances` map: composite key (hex) -> amount */
  balances: Record<string, bigint>;
  balanceCount: bigint;
  /**
   * The contract's UNSHIELDED holdings as the LEDGER KERNEL maintains them: colour (hex) -> value.
   * Independent of `balances`; the per-colour invariant compares the two.
   */
  kernelUnshielded: Record<string, bigint>;
};

/** The `balances` key for one cell, derived by RUNNING the compiled contract's own pure circuit. */
export const balanceKeyOf = (account: Uint8Array, colour: Uint8Array): string =>
  hex((managerPure as any).balanceKey(account, colour));

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

  const balances: Record<string, bigint> = {};
  for (const [k, v] of l.balances) balances[hex(k)] = v as bigint;

  // The kernel's own view of the same contract, decoded through the ledger library rather than
  // through the contract's accessors.
  const kernelUnshielded: Record<string, bigint> = {};
  const kernelState: any = (ledgerV9 as any).ContractState.deserialize(state.serialize());
  for (const [tokenType, value] of kernelState.balance) {
    if (tokenType?.tag === 'unshielded') kernelUnshielded[String(tokenType.raw).toLowerCase()] = BigInt(value);
  }

  return {
    configured: l.configured,
    colours: {
      S1: hex(l.colourS1),
      S2: hex(l.colourS2),
      U1: hex(l.colourU1),
      U2: hex(l.colourU2),
    },
    accounts,
    pools,
    poolCount: l.pools.size() as bigint,
    balances,
    balanceCount: l.balances.size() as bigint,
    kernelUnshielded,
  };
};

/**
 * A byte-comparable snapshot of EVERYTHING the Manager holds. Used by the negative controls: a
 * rejection must leave this string identical, so a call that moved any cell at all — not merely the
 * cell the control was looking at — fails the control.
 */
export const snapshot = (m: ManagerView): string =>
  JSON.stringify(m, (_k, v) => (typeof v === 'bigint' ? `${v}` : v));

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
