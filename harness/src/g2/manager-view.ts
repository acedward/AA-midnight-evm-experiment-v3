// G2 — reading the multi-colour Manager (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// Two independent observation points, per FR-108:
//
//   OP1  the Manager's own LEDGER STATE, fetched from the indexer and decoded with the generated
//        `ledger()` reader. Cheap, complete, and it is what the node enforces against.
//   OP2  real ON-CHAIN CIRCUIT CALLS (`accountBalance`, `poolValue`, `poolHasColour`,
//        `isRegistered`) — a different mechanism entirely: each one is a proved transaction whose
//        result comes back through the SDK, not through a state decode.
//
// The whole (account, colour) table is enumerable because `registerAccount` seeds all four
// configured colours at zero, so `balances.size() == accounts.size() * 4` always holds, and because
// the compiled artifact exposes `balanceKey` as a PURE circuit — the harness derives each cell's key
// by running the contract's own code in process, never by reimplementing the hashing scheme.
//
// @ts-ignore — generated artifact
import { ledger as managerLedger, pureCircuits as managerPure } from '../../generated-zk/manager/contract/index.js';

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
};

/** The `balances` key for one cell, derived by RUNNING the compiled contract's own pure circuit. */
export const balanceKeyOf = (account: Uint8Array, colour: Uint8Array): string =>
  hex((managerPure as any).balanceKey(account, colour));

/** OP1 — decode the Manager's ledger state. */
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
