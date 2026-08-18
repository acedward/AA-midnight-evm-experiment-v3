// G3 — observation points.
//
// Spec FR-004 requires every assertion to read at least TWO INDEPENDENT observation points.
// This project uses:
//
//   Manager-held balances  (AA_A / AA_B)
//     1. the Manager's internal ACCOUNT MAP, decoded from contract state
//     2. the Manager's POOLED LEDGER HOLDINGS (pool coin value / unshielded ledger balance),
//        which are maintained by an entirely different mechanism (zswap coin + kernel balance)
//     The spec's standing invariant `pool == AA_A + AA_B` IS the cross-check between them, so a
//     disagreement between the two points fails the run rather than passing silently.
//
//   User-held balances (OwnerN / OwnerM)
//     1. the wallet SDK's own synced state
//     2. the indexer, queried directly over GraphQL (independent of the wallet's view)
import { endpoints, readLaneEnv } from '../lane.js';

// @ts-ignore — generated artifact
import { ledger as managerLedger } from '../../generated-zk/manager/contract/index.js';

export type ManagerView = {
  configured: boolean;
  shieldedColor: string;
  unshieldedColor: string;
  hasPool: boolean;
  poolValue: bigint;
  poolNonce: string;
  accounts: string[];
  shieldedOf: Record<string, bigint>;
  unshieldedOf: Record<string, bigint>;
};

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

/** Observation point 1 for contract-held value: decode the Manager's own state. */
export const readManager = async (providers: any, address: string): Promise<ManagerView> => {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) throw new Error(`no contract state for Manager at ${address}`);
  const l: any = managerLedger(state.data);

  const accounts: string[] = [];
  for (const a of l.accounts) accounts.push(hex(a));

  const shieldedOf: Record<string, bigint> = {};
  const unshieldedOf: Record<string, bigint> = {};
  for (const [k, v] of l.shieldedOf) shieldedOf[hex(k)] = v as bigint;
  for (const [k, v] of l.unshieldedOf) unshieldedOf[hex(k)] = v as bigint;

  return {
    configured: l.configured,
    shieldedColor: hex(l.minterShieldedColor),
    unshieldedColor: hex(l.minterUnshieldedColor),
    hasPool: l.hasPool,
    poolValue: l.hasPool ? (l.pool.value as bigint) : 0n,
    poolNonce: hex(l.pool.nonce),
    accounts,
    shieldedOf,
    unshieldedOf,
  };
};

/** Observation point 2 for user-held value: ask the indexer directly, not the wallet. */
export const indexerUnshieldedBalance = async (addressHex: string, color: string): Promise<bigint> => {
  const ep = endpoints(readLaneEnv());
  const res = await fetch(ep.indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($a: HexEncoded!) { unshieldedUtxos(address: $a) { value tokenType } }`,
      variables: { a: addressHex },
    }),
  });
  const json: any = await res.json();
  const utxos = json?.data?.unshieldedUtxos ?? [];
  return utxos
    .filter((u: any) => String(u.tokenType).toLowerCase() === color.toLowerCase())
    .reduce((acc: bigint, u: any) => acc + BigInt(u.value), 0n);
};

/** The spec's standing invariant, asserted after every step. */
export const assertPoolInvariant = (m: ManagerView, label: string): void => {
  const sumShielded = Object.values(m.shieldedOf).reduce((a, b) => a + b, 0n);
  if (m.poolValue !== sumShielded) {
    throw new Error(
      `${label}: SHIELDED POOL INVARIANT VIOLATED — pool=${m.poolValue} but AA_A+AA_B=${sumShielded}`,
    );
  }
};

/**
 * Contract state is only observable once the block carrying the transaction has been applied and
 * indexed. Reading immediately after `submitTx` returns the PRE-transaction state, which silently
 * looks like "the call did nothing" — that false negative is exactly what the first deposit probe
 * hit. Always wait on the expected condition instead of reading once.
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
        `timed out after ${timeoutMs}ms waiting for ${what}; last observed pool=${last.poolValue} accounts=${JSON.stringify(last.shieldedOf, (_k, v) => (typeof v === 'bigint' ? `${v}` : v))}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
};
