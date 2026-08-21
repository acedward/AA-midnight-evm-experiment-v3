// The TAKER side of an offer: read the envelope, check what is being asked, settle with STOCK calls.
// 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// FR-303 says the taker uses ONLY stock facade calls, and the honest test of that claim is that this
// file contains no transaction surgery at all: it reads an envelope, decides whether to proceed, and
// then hands the deserialized transaction to `settleAsTaker`, which is nothing but
// `validateTransaction` → balance → `signRecipe` → `finalizeRecipe` → `submitTransaction`.
//
// THE FOUR GATES, in the order they run, and why each one is where it is
//
//   1. ENVELOPE      the content address is recomputed from the payload. A flipped byte dies here,
//                    offline, before a wallet, a proof server or a node is touched. Cheapest possible
//                    place to catch NC-304.
//   2. EXPIRY        the declared TTL is compared to the local clock and an expired offer is refused
//                    LOCALLY (FR-307b). The node would also refuse it, but "the taker never tried"
//                    is a better property than "the node said no", and it is the only form of the
//                    check available to a holder who is offline.
//   3. FUNDABILITY   the deserialized transaction's own `imbalances(0)` is read and compared to the
//                    terms. This is the taker's protection against a lying envelope: the terms are
//                    just JSON the maker wrote, while the imbalances are what the taker will actually
//                    be asked to fund. A mismatch, or an imbalance that cannot be read at all, is a
//                    REFUSAL — never a pass. That is the Offer Files `nonDustImbalances` /
//                    `ImbalanceUnreadableError` pattern, ported.
//   4. PRE-SUBMIT    the MERGED transaction is checked for any remaining non-dust DEFICIT before
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
  decodeEnvelope,
  offerExpired,
  offerSecondsLeft,
  OfferEnvelopeError,
  readEnvelope,
  type DecodedEnvelope,
  type OfferTerms,
} from './envelope.js';

const tokenLabel = (t: any): string =>
  t?.tag === 'dust' ? 'dust' : `${t?.tag ?? 'unknown'}:${String(t?.raw ?? '').toLowerCase()}`;

/** Where a take stopped. Every value except `settled` means nothing was submitted. */
export type TakeStage =
  | 'envelope'
  | 'expired'
  | 'deserialize'
  | 'fundability'
  | 'presubmit'
  | 'settlement'
  | 'settled';

export type ImbalanceReading = Record<string, Record<string, string>>;

/** Raised when an imbalance cannot be READ. Unreadable is a refusal, never a pass. */
export class ImbalanceUnreadableError extends Error {}
/** Raised when the transaction asks for something the terms did not declare. */
export class OfferTermsMismatchError extends Error {}
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
  /** The terms' declared legs, rendered in the same key space, for a direct comparison. */
  declared: { wants: string; gives?: string };
  matchesTerms: boolean;
};

/**
 * Gate 3 — does the artifact ask for exactly what the terms say it asks for?
 *
 * The comparison is on the DESERIALIZED transaction, so it is a statement about the bytes the taker
 * holds rather than about the JSON beside them. It also re-checks FR-302 from the taker's side: no
 * segment other than 0 may carry anything, because a taker can only reach segment 0.
 */
export const assertFundable = (tx: any, terms: OfferTerms): FundabilityReport => {
  const imbalances = readAllImbalances(tx, `offer ${terms.contentAddress.slice(0, 16)}…`);
  const deficits = nonDustDeficits(imbalances);
  const surpluses = nonDustSurpluses(imbalances);

  const wantsKey = `0/shielded:${terms.wants.colour.toLowerCase()}`;
  const givesKey = `0/shielded:${terms.gives.colour.toLowerCase()}`;
  const declared: FundabilityReport['declared'] = { wants: wantsKey };

  const problems: string[] = [];
  for (const [seg, m] of Object.entries(imbalances)) {
    if (seg !== '0' && Object.keys(m).length > 0) {
      problems.push(
        `segment ${seg} carries ${JSON.stringify(m)} — a leg outside the guaranteed section is ` +
          'unsettleable by an independent taker (FR-302 / lane issue 0003)',
      );
    }
  }
  if (deficits[wantsKey] !== String(-BigInt(terms.wants.value))) {
    problems.push(
      `the terms want ${terms.wants.value} of ${terms.wants.colour} but the transaction's deficit at ` +
        `${wantsKey} is ${deficits[wantsKey] ?? '(absent)'}`,
    );
  }
  if (Object.keys(deficits).length !== 1) {
    problems.push(`expected exactly ONE non-dust deficit, found ${JSON.stringify(deficits)}`);
  }
  if (terms.shape === 'floating-surplus') {
    declared.gives = givesKey;
    if (surpluses[givesKey] !== terms.gives.value) {
      problems.push(
        `a floating-surplus offer must leave +${terms.gives.value} of ${terms.gives.colour} at ` +
          `${givesKey}; found ${surpluses[givesKey] ?? '(absent)'}`,
      );
    }
    if (Object.keys(surpluses).length !== 1) {
      problems.push(`expected exactly ONE non-dust surplus, found ${JSON.stringify(surpluses)}`);
    }
  } else if (Object.keys(surpluses).length !== 0) {
    problems.push(
      `a ${terms.shape} offer pays colour A to a named key, so it must leave NO surplus; found ` +
        `${JSON.stringify(surpluses)}`,
    );
  }

  const report: FundabilityReport = { imbalances, deficits, surpluses, declared, matchesTerms: problems.length === 0 };
  if (problems.length) {
    throw new OfferTermsMismatchError(
      `offer ${terms.contentAddress.slice(0, 16)}… does not match its own terms:\n  - ${problems.join('\n  - ')}`,
    );
  }
  return report;
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
 * Gate 4 — the merged transaction must carry no non-dust deficit.
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
  terms?: OfferTerms;
  contentAddress?: string;
  secondsLeft?: number;
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
  /** Override the balancing entry point. Defaults to the form the envelope declares (D-306). */
  route?: TakerRoute;
  /** Skip the local expiry gate — used only to measure what the NODE does with an expired offer. */
  ignoreExpiry?: boolean;
  now?: Date;
};

const routeFor = (terms: OfferTerms): TakerRoute => (terms.form === 'binding' ? 'bound' : 'unbound');

/** Keep a local gate-4 refusal distinct from balancing/node submission failures. */
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
  const now = opts.now ?? new Date();

  // --- gate 1: the envelope itself ---------------------------------------------------------------
  let decoded: DecodedEnvelope;
  try {
    decoded = inspectOffer(source);
  } catch (e) {
    const offline = e instanceof OfferEnvelopeError;
    log(`taker[${label}]: REFUSED at the envelope — ${errorChain(e)}`);
    return { stage: 'envelope', ok: false, error: errorChain(e), offlineRefusal: offline };
  }
  const { terms, bytes } = decoded;
  const secondsLeft = offerSecondsLeft(terms, now);
  log(
    `taker[${label}]: envelope ok — ${terms.shape} offer, give ${terms.gives.value} of ` +
      `${terms.gives.colour.slice(0, 12)}…, want ${terms.wants.value} of ${terms.wants.colour.slice(0, 12)}…, ` +
      `${secondsLeft} s of life left`,
  );

  // --- gate 2: expiry, checked locally ------------------------------------------------------------
  if (!opts.ignoreExpiry && offerExpired(terms, now)) {
    const error = `offer expired ${-secondsLeft} s ago (expiresAt ${terms.expiresAt}); refused locally without contacting the chain`;
    log(`taker[${label}]: REFUSED — ${error}`);
    return { stage: 'expired', ok: false, terms, contentAddress: terms.contentAddress, secondsLeft, error, offlineRefusal: true };
  }

  // --- deserialize ------------------------------------------------------------------------------
  let tx: any;
  try {
    tx = (ledger as any).Transaction.deserialize('signature', 'proof', terms.form, bytes);
  } catch (e) {
    log(`taker[${label}]: REFUSED at deserialize — ${errorChain(e)}`);
    return {
      stage: 'deserialize',
      ok: false,
      terms,
      contentAddress: terms.contentAddress,
      secondsLeft,
      error: errorChain(e),
      offlineRefusal: true,
    };
  }

  // --- gate 3: is it fundable, and does it match its own terms? ----------------------------------
  let fundability: FundabilityReport;
  try {
    fundability = assertFundable(tx, terms);
  } catch (e) {
    log(`taker[${label}]: REFUSED at the fundability gate — ${errorChain(e)}`);
    return {
      stage: 'fundability',
      ok: false,
      terms,
      contentAddress: terms.contentAddress,
      secondsLeft,
      error: errorChain(e),
      offlineRefusal: true,
    };
  }
  log(
    `taker[${label}]: fundable — deficits ${JSON.stringify(fundability.deficits)}, ` +
      `surpluses ${JSON.stringify(fundability.surpluses)}`,
  );

  // --- settlement: stock facade calls only, with gate 4 wired in as `preSubmit` -------------------
  let merged: TakeResult['merged'];
  const settlement = await settleAsTaker(taker, tx, opts.route ?? routeFor(terms), {
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
    contentAddress: terms.contentAddress,
    secondsLeft,
    fundability,
    settlement,
    merged,
    ...(settlement.ok ? {} : { error: settlement.error, nodeRefusal: settlement.nodeRefusal }),
  };
};
