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
import * as ledger from '@midnightntwrk/ledger-v9';
import { MidnightBech32m } from '@midnightntwrk/wallet-sdk-address-format';
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

/**
 * Observation point 2 for USER-held unshielded value: the unshielded UTXO set reconstructed from
 * the INDEXER'S OWN TRANSACTION HISTORY, independent of the wallet SDK.
 *
 * NOTE (recorded as Finding G3-4): the pinned indexer `v4.4.0-rc.1` exposes NO per-address
 * unshielded-balance query — schema introspection shows no `unshieldedUtxos` field on `Query` at
 * all. What it does expose is, per transaction, `unshieldedCreatedOutputs` with each output's
 * owner, token type, value and (crucially) whether it has since been spent. Since every movement
 * of the Minter's colours happens in a transaction this harness submitted, replaying those
 * transactions' created outputs and keeping the unspent ones reconstructs each party's UTXO set
 * from chain data alone.
 *
 * @param txIdentifiers every transaction this run has submitted, in any order
 * @param color the unshielded colour under test
 * @returns owner address (hex) -> unspent value of that colour
 */
export const indexerUnshieldedByOwner = async (
  txIdentifiers: readonly string[],
  color: string,
): Promise<Map<string, bigint>> => {
  const ep = endpoints(readLaneEnv());
  const byOwner = new Map<string, bigint>();
  const seen = new Set<string>();

  for (const identifier of txIdentifiers) {
    const res = await fetch(ep.indexerHttpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($i: HexEncoded!) { transactions(offset: {identifier: $i}) { ' +
          'unshieldedCreatedOutputs { owner tokenType value intentHash outputIndex spentAtTransaction { hash } } } }',
        variables: { i: identifier },
      }),
    });
    const json: any = await res.json();
    for (const tx of json?.data?.transactions ?? []) {
      for (const utxo of tx?.unshieldedCreatedOutputs ?? []) {
        if (String(utxo.tokenType).toLowerCase() !== color.toLowerCase()) continue;
        // One transaction can be returned under more than one identifier, so outputs are keyed by
        // their own identity rather than counted per response.
        const key = `${utxo.intentHash}:${utxo.outputIndex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (utxo.spentAtTransaction) continue;
        const owner = MidnightBech32m.parse(String(utxo.owner)).data.toString('hex');
        byOwner.set(owner, (byOwner.get(owner) ?? 0n) + BigInt(utxo.value));
      }
    }
  }
  return byOwner;
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

/**
 * Observation point 2 for CONTRACT-held unshielded value: the contract's own LEDGER BALANCE MAP,
 * decoded from its on-chain state.
 *
 * This is maintained by the kernel's unshielded-balance machinery — `receiveUnshielded` /
 * `sendUnshielded` move it — entirely separately from the `unshieldedOf` account map that the
 * contract's own ledger accessor decodes above. The spec's per-family invariant
 * `pool = AA_A + AA_B` is therefore a genuine cross-check between two independent mechanisms, and
 * a disagreement fails the run.
 *
 * NOTE (recorded as Finding G3-3): the indexer's convenience view
 * `publicDataProvider.queryUnshieldedBalances(contractAddress)` returns an EMPTY list for a
 * contract that verifiably holds unshielded tokens on this pinned lane, so it cannot serve as this
 * observation point. The ledger state is authoritative and is what the node itself enforces
 * against, so it is read directly instead.
 */
export const managerUnshieldedLedger = async (
  providers: any,
  address: string,
  color: string,
): Promise<bigint> => {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) return 0n;
  const ledgerState: any = (ledger as any).ContractState.deserialize(state.serialize());
  for (const [tokenType, value] of ledgerState.balance) {
    if (tokenType?.tag === 'unshielded' && String(tokenType.raw).toLowerCase() === color.toLowerCase()) {
      return BigInt(value);
    }
  }
  return 0n;
};

/** The unshielded half of the standing invariant. Shielded is `assertPoolInvariant`. */
export const assertUnshieldedPoolInvariant = (m: ManagerView, ledgerBalance: bigint, label: string): void => {
  const sum = Object.values(m.unshieldedOf).reduce((a, b) => a + b, 0n);
  if (ledgerBalance !== sum) {
    throw new Error(
      `${label}: UNSHIELDED POOL INVARIANT VIOLATED — contract ledger balance=${ledgerBalance} but AA_A+AA_B=${sum}`,
    );
  }
};
