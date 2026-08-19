// Plan 01 Phase 2 — the maker half, and the FIRST exercise of the FR-302 placement assert.
// EXPERIMENTAL_LANE / LANE-DEV-1.
//
// The maker's whole job is: BUILD a contract call, PROVE it, and STOP. No balancing, no signing, no
// DUST, no submission. That is the seam 00005 already had (`g3/actions.ts:89-97` proves and then
// hands the artifact to `walletProvider.balanceTx`); the new thing is that nobody on the maker side
// ever calls the next line.
//
// The spike shape is `depositShielded`, on purpose. `receiveShielded(coin)` makes the contract claim
// a coin NOBODY IN THE TRANSACTION FUNDED, which is exactly — structurally, at the ledger's balancing
// layer — the swap offer's −B leg: a shielded DEFICIT at some segment that a counterparty must fill.
// So S1 can answer the single most load-bearing unknown ("will a FOREIGN wallet balance a transaction
// containing a contract call?") against 00005's UNCHANGED Manager v3, without waiting for Manager v4.
//
// FR-302 discipline, implemented here rather than asserted later, because lane issue 0003 says
// guaranteed/fallible placement is STATE-DEPENDENT and must never be assumed:
//   * `imbalances(s)` is read for EVERY segment the transaction has, not just segment 0;
//   * segment 0 must carry EXACTLY the intended deltas;
//   * every other segment must carry NOTHING. A fallible-section leg is unsettleable by any
//     independent taker, so this fails CLOSED.
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { randomBytes } from 'node:crypto';
import { compiledManager } from '../contracts.js';
import { log } from '../night.js';

/** One segment's imbalance map, rendered for evidence: token label -> signed delta as a string. */
export type ImbalanceMap = Record<string, string>;

export type PlacementReport = {
  /** Every segment the transaction actually has, per `Transaction.segments()` (0 is always present). */
  segments: number[];
  /** The physical segment ids of the transaction's intents. */
  intentSegments: number[];
  /** segment -> (token -> signed delta). */
  imbalances: Record<string, ImbalanceMap>;
  /** What segment 0 was required to carry. */
  expectedAtSegment0: ImbalanceMap;
  /** Segment 0 matched exactly. */
  segment0Exact: boolean;
  /** No segment other than 0 carried any delta. */
  otherSegmentsEmpty: boolean;
  /** Segments other than 0 that DID carry a delta (evidence toward lane issue 0003 if non-empty). */
  offendingSegments: string[];
  ok: boolean;
};

const tokenLabel = (t: any): string =>
  t?.tag === 'dust' ? 'dust' : `${t?.tag ?? 'unknown'}:${String(t?.raw ?? '').toLowerCase()}`;

const readImbalances = (tx: any, segment: number): ImbalanceMap => {
  const out: ImbalanceMap = {};
  for (const [token, delta] of tx.imbalances(segment) as Map<unknown, bigint>) {
    out[tokenLabel(token)] = String(delta);
  }
  return out;
};

/**
 * FR-302: assert the offer's legs sit in the GUARANTEED section and nowhere else.
 *
 * `expected` is keyed by the same `tag:raw` labels `tokenLabel` produces, e.g.
 * `{ 'shielded:ab12…': '-4' }`. An empty expectation means "segment 0 must be empty too".
 */
export const assertPlacement = (tx: any, expected: ImbalanceMap): PlacementReport => {
  const segments: number[] = Array.from(tx.segments?.() ?? [0]).map((s: any) => Number(s));
  const intentSegments: number[] = Array.from((tx.intents?.keys?.() ?? []) as Iterable<number>).map((s) => Number(s));
  const imbalances: Record<string, ImbalanceMap> = {};
  for (const s of segments) imbalances[String(s)] = readImbalances(tx, s);

  const seg0 = imbalances['0'] ?? {};
  const segment0Exact =
    Object.keys(seg0).length === Object.keys(expected).length &&
    Object.entries(expected).every(([k, v]) => seg0[k] === v);

  const offendingSegments = segments
    .filter((s) => s !== 0)
    .filter((s) => Object.keys(imbalances[String(s)] ?? {}).length > 0)
    .map((s) => `${s}: ${JSON.stringify(imbalances[String(s)])}`);

  return {
    segments,
    intentSegments,
    imbalances,
    expectedAtSegment0: expected,
    segment0Exact,
    otherSegmentsEmpty: offendingSegments.length === 0,
    offendingSegments,
    ok: segment0Exact && offendingSegments.length === 0,
  };
};

/** Throw with a diagnosis if FR-302 is violated. This is the "fails closed" half. */
export const requirePlacement = (what: string, report: PlacementReport): PlacementReport => {
  if (report.ok) return report;
  const lines = [
    `FR-302 VIOLATED for ${what}:`,
    `  segments present:        ${JSON.stringify(report.segments)}`,
    `  intent segments:         ${JSON.stringify(report.intentSegments)}`,
    `  expected at segment 0:   ${JSON.stringify(report.expectedAtSegment0)}`,
    `  observed at segment 0:   ${JSON.stringify(report.imbalances['0'] ?? {})}`,
    `  segment-0 exact:         ${report.segment0Exact}`,
    `  other segments carrying deltas: ${report.offendingSegments.length ? report.offendingSegments.join('; ') : '(none)'}`,
  ];
  if (report.offendingSegments.length) {
    lines.push(
      '  A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is',
      '  per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its',
      '  designed-against form — retain this output as evidence.',
    );
  }
  throw new Error(lines.join('\n'));
};

export type MakerDepositSpec = {
  /** Providers of the BUILDER wallet — used to build and to prove, never to balance. */
  providers: any;
  managerAddress: string;
  colour: Uint8Array;
  value: bigint;
  /** The registered account the credit is attributed to. */
  account: Uint8Array;
  nonce?: Uint8Array;
};

export type MakerArtifact = {
  /** `Transaction<SignatureEnabled, Proof, PreBinding>` — the UNBOUND, proven, unbalanced offer. */
  proven: any;
  /** The unproven form, kept for diagnostics only. */
  unproven: any;
  circuitId: 'depositShielded';
  nonce: Uint8Array;
  colourHex: string;
  value: bigint;
  accountHex: string;
  expectedAtSegment0: ImbalanceMap;
  placement: PlacementReport;
  /** `identifiers()` of the proven artifact, for cross-referencing the settled transaction. */
  identifiers: string[];
};

/**
 * Build + prove ONE unbalanced maker artifact and assert FR-302 on it. Never balances or submits.
 *
 * `createUnprovenCallTx` runs the real compiled circuit, so the deficit is produced by the contract's
 * own `receiveShielded`, not by hand-editing an offer.
 */
export const buildMakerDeposit = async (spec: MakerDepositSpec): Promise<MakerArtifact> => {
  const nonce = spec.nonce ?? randomBytes(32);
  const colourHex = Buffer.from(spec.colour).toString('hex');
  const accountHex = Buffer.from(spec.account).toString('hex');

  log(`maker: building depositShielded(colour ${colourHex.slice(0, 16)}…, value ${spec.value}) -> ${accountHex.slice(0, 16)}…`);
  const built: any = await (createUnprovenCallTx as any)(spec.providers, {
    compiledContract: compiledManager(),
    circuitId: 'depositShielded',
    contractAddress: spec.managerAddress,
    args: [{ nonce, color: spec.colour, value: spec.value }, spec.account],
    privateStateId: 'manager',
  });

  log('maker: proving (this is the LAST thing the maker does — no balance, no dust, no submit)');
  const proven: any = await spec.providers.proofProvider.proveTx(built.private.unprovenTx);

  // The contract claims `value` of `colour` that nothing in this transaction funded, so segment 0
  // carries exactly that shielded DEFICIT and nothing else.
  const expectedAtSegment0: ImbalanceMap = { [`shielded:${colourHex}`]: String(-spec.value) };
  const placement = requirePlacement(`maker depositShielded ${spec.value} of ${colourHex.slice(0, 16)}…`, assertPlacement(proven, expectedAtSegment0));

  let identifiers: string[] = [];
  try {
    identifiers = Array.from(proven.identifiers() as Iterable<string>).map(String);
  } catch {
    /* identifiers() is not defined for every lifecycle state; absence is not a failure here */
  }

  return {
    proven,
    unproven: built.private.unprovenTx,
    circuitId: 'depositShielded',
    nonce,
    colourHex,
    value: spec.value,
    accountHex,
    expectedAtSegment0,
    placement,
    identifiers,
  };
};
