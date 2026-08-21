// G3 — raw indexer access for the deploy-order evidence (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// Deliberately a raw GraphQL POST rather than an SDK convenience call: the claim being proven is
// about what the CHAIN records, so the evidence should come from the chain's own index, in a form a
// reader can re-run with `curl`.
//
// This duplicates the query helpers in `src/g2/deploy-order.ts` ON PURPOSE. G2 is a GREEN gate whose
// script and evidence are committed together; editing it to extract a shared module would leave
// committed evidence that no longer matches the code that produced it (the same reasoning that made
// Plan 01 RE-RUN G1 rather than hand-edit one line of its output). The duplication is ~40 lines and
// is confined to read-only queries.
//
// Spec success criterion 2, first half: "Step 0/1 prove deploy order (Manager before any Minter,
// on-chain block/tx ordering evidence)". G3 therefore re-establishes it inside its OWN run rather
// than pointing at G2's.
import { endpoints, readLaneEnv } from '../lane.js';

export const gql = async (query: string, variables: Record<string, unknown> = {}): Promise<any> => {
  const url = endpoints(readLaneEnv()).indexerHttpUrl;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body: any = await res.json();
  if (body.errors) throw new Error(`indexer GraphQL error: ${JSON.stringify(body.errors)}`);
  return body.data;
};

const DEPLOY_QUERY = `
  query DeployAction($addr: HexEncoded!) {
    contractAction(address: $addr) {
      address
      transaction { id hash block { height hash timestamp } }
    }
  }`;

/** "What action does this address have at block `height`?" — null means it did not exist. */
const AT_BLOCK_QUERY = `
  query ActionAtBlock($addr: HexEncoded!, $height: Int!) {
    contractAction(address: $addr, offset: { blockOffset: { height: $height } }) {
      address
      transaction { id hash block { height } }
    }
  }`;

/**
 * The same question through a DIFFERENT query whose documented semantics are unambiguous: the
 * schema says `contract(address, offset)` "Returns null if the contract has no action AT OR BEFORE
 * that block". `contractAction`'s own offset semantics are not spelled out, so both are run and
 * both recorded — one is precise about "at or before", the other is not `@beta`.
 */
const CONTRACT_AT_BLOCK_QUERY = `
  query ContractAtBlock($addr: HexEncoded!, $height: Int!) {
    contract(address: $addr, offset: { height: $height }) { address }
  }`;

const TIP_QUERY = `query Tip { block { height hash timestamp } }`;

export const chainTip = async (): Promise<{ height: number; hash: string; timestamp: unknown }> =>
  (await gql(TIP_QUERY)).block;

export type DeployRecord = {
  label: string;
  address: string;
  txId: number | null;
  txHash: string | null;
  blockHeight: number | null;
  blockHash: string | null;
  blockTimestamp: number | null;
  /** verbatim from the SDK — a third, independent record of the same deployment */
  sdk: Record<string, unknown>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until the indexer can answer for this address, then record its DEPLOY action. */
export const recordDeploy = async (label: string, address: string, sdkPublic: any): Promise<DeployRecord> => {
  let action: any = null;
  for (let i = 0; i < 90 && !action; i++) {
    action = (await gql(DEPLOY_QUERY, { addr: address })).contractAction;
    if (!action) await sleep(2000);
  }
  if (!action) throw new Error(`indexer never reported a contract action for ${label} at ${address}`);
  return {
    label,
    address,
    txId: action.transaction?.id ?? null,
    txHash: action.transaction?.hash ?? null,
    blockHeight: action.transaction?.block?.height ?? null,
    blockHash: action.transaction?.block?.hash ?? null,
    blockTimestamp: action.transaction?.block?.timestamp ?? null,
    sdk: JSON.parse(JSON.stringify(sdkPublic, (_k, v) => (typeof v === 'bigint' ? String(v) : v))),
  };
};

/** Both existence questions at once, each recorded with whether it could be asked at all. */
export const existenceAtBlock = async (
  addr: string,
  height: number,
): Promise<{ action: unknown; contract: unknown; contractQueryError: string | null }> => {
  const action = (await gql(AT_BLOCK_QUERY, { addr, height })).contractAction;
  let contract: unknown = undefined;
  let contractQueryError: string | null = null;
  try {
    contract = (await gql(CONTRACT_AT_BLOCK_QUERY, { addr, height })).contract;
  } catch (e) {
    // `contract` is @beta on this indexer; if it is not served, say so rather than silently
    // treating an unanswerable question as a negative answer.
    contractQueryError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }
  return { action, contract, contractQueryError };
};
