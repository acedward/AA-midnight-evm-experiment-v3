// The TAKER side of an offer: read the authoritative transaction bytes, settle with STOCK calls.
// 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// FR-303 says the taker uses ONLY stock facade calls, and the honest test of that claim is that this
// file contains no transaction surgery at all: it reads an envelope, decides whether to proceed, and
// then hands the deserialized transaction to `settleAsTaker`, which is nothing but
// `validateTransaction` → balance → `signRecipe` → `finalizeRecipe` → `submitTransaction`.
//
// THE THREE LOCAL GATES, in the order they run, and why each one is where it is
//
//   1. ENVELOPE      the OFFER/1 framing is parsed and payload identity is computed FROM THE BYTES.
//                    Amendment A-308 makes every JSON terms field advisory, so no field comparison
//                    can authorize, block or alter settlement.
//   2. FUNDABILITY   the deserialized transaction's own imbalances are read fail-closed. The actual
//                    bytes must contain exactly one segment-0 deficit, at most one surplus, and no
//                    relevant leg in a fallible segment. No JSON economic label participates.
//   3. PRE-SUBMIT    the MERGED transaction is checked for any remaining non-dust DEFICIT before
//                    `submitTransaction`. A deficit means the merge did not actually balance and the
//                    node will refuse it; catching it here keeps a harness bug from being recorded as
//                    a lane refusal. A remaining SURPLUS is legal, so it is recorded as value left on
//                    the table rather than treated as an error.
//
// `validateTransaction` is deliberately NOT a gate — finding F-303. On this lane it cannot validate a
// contract-call transaction at all: the pinned facade validates against a BLANK `LedgerState`
// (`wallet-sdk-capabilities/dist/validation/validationService.js:28-31`), so every offer that calls a
// deployed contract is refused with `call to non-existant contract ContractAddress(…)` — including at
// the strictest flags — and the very same transactions then committed on chain in spike S1. Reading
// FR-303 literally and failing closed there would refuse every offer this project exists to settle.
// Its outcome is recorded on every take and it never decides anything.
import * as ledger from '@midnightntwrk/ledger-v9';
import { errorChain } from '../g3/actions.js';
import { log } from '../night.js';
import { segmentsOf } from '../g1/maker.js';
import { settleAsTaker, type SettlementResult, type TakerRoute } from '../g1/taker.js';
import type { Party } from '../wallet.js';
import type { NodeRefusal } from '../node-error.js';
import {
  advisoryOfferSecondsLeft,
  decodeEnvelope,
  OfferEnvelopeError,
  readEnvelope,
  type AdvisoryOfferTerms,
  type DecodedEnvelope,
  type OfferForm,
} from './envelope.js';

const tokenLabel = (t: any): string =>
  t?.tag === 'dust' ? 'dust' : `${t?.tag ?? 'unknown'}:${String(t?.raw ?? '').toLowerCase()}`;

/** Where a take stopped. Every value except `settled` means nothing was submitted. */
export type TakeStage =
  | 'envelope'
  | 'deserialize'
  | 'fundability'
  | 'presubmit'
  | 'settlement'
  | 'settled';

export type ImbalanceReading = Record<string, Record<string, string>>;

/** Raised when an imbalance cannot be READ. Unreadable is a refusal, never a pass. */
export class ImbalanceUnreadableError extends Error {}
/** Raised when authoritative transaction bytes do not have a safely fundable offer shape. */
export class OfferFundabilityError extends Error {}
/** Raised when the serialized transaction form cannot be inferred from its own bytes. */
export class OfferTransactionDeserializeError extends Error {}
/** Raised when a merged transaction still carries a non-dust deficit. */
export class MergedTransactionUnbalancedError extends Error {}

/**
 * Read `imbalances` for EVERY segment the transaction has. Throws on an unreadable segment.
 *
 * The segment set comes from `segmentsOf` because `Transaction::segments()` is not bound to JS at
 * these pins (F-304). Reading only segment 0 would miss a leg parked in a fallible segment, which is
 * exactly the failure lane issue 0003 says to expect.
 */
export const readAllImbalances = (tx: any, what: string): ImbalanceReading => {
  const out: ImbalanceReading = {};
  for (const s of segmentsOf(tx)) {
    try {
      const seg: Record<string, string> = {};
      for (const [token, delta] of tx.imbalances(s) as Map<unknown, bigint>) seg[tokenLabel(token)] = String(delta);
      out[String(s)] = seg;
    } catch (e) {
      throw new ImbalanceUnreadableError(
        `${what}: imbalances(${s}) could not be read — ${errorChain(e)}. An unreadable imbalance is a refusal.`,
      );
    }
  }
  return out;
};

/** Non-dust entries with a NEGATIVE delta: what somebody must fund. */
export const nonDustDeficits = (imb: ImbalanceReading): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [segment, m] of Object.entries(imb)) {
    for (const [token, delta] of Object.entries(m)) {
      if (token === 'dust') continue;
      if (BigInt(delta) < 0n) out[`${segment}/${token}`] = delta;
    }
  }
  return out;
};

/** Non-dust entries with a POSITIVE delta: value nobody has claimed — the open offer's payload. */
export const nonDustSurpluses = (imb: ImbalanceReading): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [segment, m] of Object.entries(imb)) {
    for (const [token, delta] of Object.entries(m)) {
      if (token === 'dust') continue;
      if (BigInt(delta) > 0n) out[`${segment}/${token}`] = delta;
    }
  }
  return out;
};

export type FundabilityReport = {
  imbalances: ImbalanceReading;
  /** What the taker must supply, `segment/token` → signed delta. */
  deficits: Record<string, string>;
  /** What the taker may sweep. Non-empty for the floating-surplus shape and empty otherwise. */
  surpluses: Record<string, string>;
  /** Shape inferred from authoritative imbalances, never from advisory JSON. */
  inferredShape: 'named-output' | 'floating-surplus';
};

/**
 * Gate 2 — is the authoritative transaction shape fundable by an independent taker?
 * No JSON term is accepted as an input. This re-checks FR-302 from the taker's side: no segment other
 * than 0 may carry anything, because an independent taker can only reach segment 0.
 */
export const assertFundable = (tx: any, what = 'offer transaction'): FundabilityReport => {
  const imbalances = readAllImbalances(tx, what);
  const deficits = nonDustDeficits(imbalances);
  const surpluses = nonDustSurpluses(imbalances);

  const problems: string[] = [];
  for (const [seg, m] of Object.entries(imbalances)) {
    if (seg !== '0' && Object.keys(m).length > 0) {
      problems.push(
        `segment ${seg} carries ${JSON.stringify(m)} — a leg outside the guaranteed section is ` +
          'unsettleable by an independent taker (FR-302 / lane issue 0003)',
      );
    }
  }
  if (Object.keys(deficits).length !== 1) {
    problems.push(`expected exactly ONE non-dust deficit, found ${JSON.stringify(deficits)}`);
  }
  if (Object.keys(surpluses).length > 1) {
    problems.push(`expected at most ONE non-dust surplus, found ${JSON.stringify(surpluses)}`);
  }

  if (problems.length) {
    throw new OfferFundabilityError(
      `${what} is not a safely fundable transaction shape:\n  - ${problems.join('\n  - ')}`,
    );
  }
  return {
    imbalances,
    deficits,
    surpluses,
    inferredShape: Object.keys(surpluses).length === 1 ? 'floating-surplus' : 'named-output',
  };
};

/** Per-intent DUST actions on a transaction: `segment` → how many spends and registrations. */
export type DustActionsBySegment = Record<string, { spends: number; registrations: number }>;

/**
 * Which intents attached DUST. This is the DIRECT form of "the maker paid no fees".
 *
 * A dust balance is a weak witness because dust is GENERATED over time from registered NIGHT, so a
 * maker's balance can rise across a settlement it did not pay for. The intent-level reading has no
 * such ambiguity: fees live in dust actions, dust actions live in an intent, and the maker's intent
 * is identifiable — it is the one carrying the contract call.
 */
export const dustActionsBySegment = (tx: any): DustActionsBySegment => {
  const out: DustActionsBySegment = {};
  try {
    for (const [segment, intent] of (tx.intents ?? new Map()) as Map<number, any>) {
      const da = intent?.dustActions;
      out[String(segment)] = { spends: da?.spends?.length ?? 0, registrations: da?.registrations?.length ?? 0 };
    }
  } catch {
    /* absence of the accessor is recorded as an empty map, never as "no dust" */
  }
  return out;
};

export type MergedReport = {
  imbalances: ImbalanceReading;
  unswept: Record<string, string>;
  dustActions: DustActionsBySegment;
  intentSegments: number[];
};

/**
 * Gate 3 — the merged transaction must carry no non-dust deficit.
 *
 * Returns what it found so the evidence can show the merge really did balance, including any surplus
 * the taker chose not to sweep (legal, but worth seeing: it is value handed to nobody) and which
 * intent attached the DUST.
 */
export const assertMergedBalanced = (finalized: any): MergedReport => {
  const imbalances = readAllImbalances(finalized, 'merged settlement transaction');
  const deficits = nonDustDeficits(imbalances);
  if (Object.keys(deficits).length > 0) {
    throw new MergedTransactionUnbalancedError(
      `the merged transaction still carries non-dust deficits ${JSON.stringify(deficits)} — refusing to submit`,
    );
  }
  return {
    imbalances,
    unswept: nonDustSurpluses(imbalances),
    dustActions: dustActionsBySegment(finalized),
    intentSegments: segmentsOf(finalized).filter((s) => s !== 0),
  };
};

export type TakeResult = {
  stage: TakeStage;
  ok: boolean;
  /** Parsed JSON carried for display/evidence compatibility only; never trusted by the take path. */
  terms?: AdvisoryOfferTerms;
  /** SHA-256 computed from the serialized transaction payload actually received. */
  contentAddress?: string;
  /** Byte length computed from the serialized transaction payload actually received. */
  transactionBytes?: number;
  /** Form inferred by deserializing the bytes, never copied from JSON. */
  serializedForm?: OfferForm;
  /** Advisory display only; actual intent TTL is enforced by the ledger. */
  advisorySecondsLeft?: number;
  fundability?: FundabilityReport;
  settlement?: SettlementResult;
  merged?: MergedReport;
  /** Verbatim, F-202-clean (stack frames stripped). */
  error?: string;
  /** True when the refusal happened with NO network contact at all. */
  offlineRefusal?: boolean;
  /** The NODE's own verdict when the node was reached and refused (see `src/node-error.ts`). */
  nodeRefusal?: NodeRefusal;
};

export type TakeOptions = {
  label?: string;
  ttlMs?: number;
  /** Override the byte-inferred balancing entry point; never sourced from advisory JSON. */
  route?: TakerRoute;
};

export type DeserializedOffer = {
  tx: any;
  form: OfferForm;
  route: TakerRoute;
};

/** Infer the transaction lifecycle form from the serialized bytes themselves. */
export const deserializeOfferBytes = (bytes: Uint8Array): DeserializedOffer => {
  const candidates: DeserializedOffer[] = [];
  const errors: string[] = [];
  for (const [form, route] of [
    ['pre-binding', 'unbound'],
    ['binding', 'bound'],
  ] as const) {
    try {
      candidates.push({
        tx: (ledger as any).Transaction.deserialize('signature', 'proof', form, bytes),
        form,
        route,
      });
    } catch (e) {
      errors.push(`${form}: ${errorChain(e)}`);
    }
  }
  if (candidates.length !== 1) {
    const detail =
      candidates.length === 0
        ? `neither supported form deserialized (${errors.join(' | ')})`
        : `both supported forms deserialized (${candidates.map((c) => c.form).join(', ')})`;
    throw new OfferTransactionDeserializeError(
      `serialized offer bytes do not identify exactly one transaction form: ${detail}`,
    );
  }
  return candidates[0];
};

export type PreparedOffer = DeserializedOffer & {
  decoded: DecodedEnvelope;
  fundability: FundabilityReport;
};

/**
 * The complete pre-settlement decision derived from authoritative bytes. Tests mutate every JSON
 * field and call this exact helper to prove the decision does not change.
 */
export const prepareDecodedOffer = (decoded: DecodedEnvelope): PreparedOffer => {
  const deserialized = deserializeOfferBytes(decoded.bytes);
  return {
    ...deserialized,
    decoded,
    fundability: assertFundable(
      deserialized.tx,
      `offer ${decoded.payload.contentAddress.slice(0, 16)}…`,
    ),
  };
};

/** Keep a local pre-submit refusal distinct from balancing/node submission failures. */
export const takeStageForSettlement = (settlement: SettlementResult): TakeStage =>
  settlement.ok ? 'settled' : settlement.failureStage === 'presubmit' ? 'presubmit' : 'settlement';

/** Read and verify an envelope without settling — the offline half, usable with no wallet at all. */
export const inspectOffer = (source: string | Uint8Array): DecodedEnvelope =>
  typeof source === 'string' ? readEnvelope(source) : decodeEnvelope(source);

export const takeOffer = async (
  taker: Party,
  source: string | Uint8Array,
  opts: TakeOptions = {},
): Promise<TakeResult> => {
  const label = opts.label ?? 'take';

  // --- gate 1: the envelope itself ---------------------------------------------------------------
  let decoded: DecodedEnvelope;
  try {
    decoded = inspectOffer(source);
  } catch (e) {
    const offline = e instanceof OfferEnvelopeError;
    log(`taker[${label}]: REFUSED at the envelope — ${errorChain(e)}`);
    return { stage: 'envelope', ok: false, error: errorChain(e), offlineRefusal: offline };
  }
  const { terms, payload } = decoded;
  const advisorySecondsLeft = advisoryOfferSecondsLeft(terms);
  log(
    `taker[${label}]: OFFER/1 framing ok — authoritative payload ${payload.transactionBytes} bytes, ` +
      `sha256 ${payload.contentAddress.slice(0, 16)}…; every JSON term is advisory and ignored`,
  );

  // --- deserialize + gate 2: byte-derived form and fundability -----------------------------------
  let prepared: PreparedOffer;
  try {
    prepared = prepareDecodedOffer(decoded);
  } catch (e) {
    const stage: TakeStage = e instanceof OfferTransactionDeserializeError ? 'deserialize' : 'fundability';
    log(`taker[${label}]: REFUSED at ${stage} — ${errorChain(e)}`);
    return {
      stage,
      ok: false,
      terms,
      contentAddress: payload.contentAddress,
      transactionBytes: payload.transactionBytes,
      ...(advisorySecondsLeft === undefined ? {} : { advisorySecondsLeft }),
      error: errorChain(e),
      offlineRefusal: true,
    };
  }
  log(
    `taker[${label}]: byte-derived ${prepared.form} transaction is fundable — deficits ` +
      `${JSON.stringify(prepared.fundability.deficits)}, surpluses ` +
      `${JSON.stringify(prepared.fundability.surpluses)}`,
  );

  // --- settlement: stock facade calls only, with gate 3 wired in as `preSubmit` -------------------
  let merged: TakeResult['merged'];
  const settlement = await settleAsTaker(taker, prepared.tx, opts.route ?? prepared.route, {
    label,
    ttlMs: opts.ttlMs,
    preSubmit: (finalized) => {
      merged = assertMergedBalanced(finalized);
      log(
        `taker[${label}]: merged transaction balances; unswept non-dust surplus ` +
          `${JSON.stringify(merged.unswept)}`,
      );
      return merged;
    },
  });

  return {
    stage: takeStageForSettlement(settlement),
    ok: settlement.ok,
    terms,
    contentAddress: payload.contentAddress,
    transactionBytes: payload.transactionBytes,
    serializedForm: prepared.form,
    ...(advisorySecondsLeft === undefined ? {} : { advisorySecondsLeft }),
    fundability: prepared.fundability,
    settlement,
    merged,
    ...(settlement.ok ? {} : { error: settlement.error, nodeRefusal: settlement.nodeRefusal }),
  };
};
