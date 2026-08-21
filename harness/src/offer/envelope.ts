// FR-306 — the offer envelope. 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// WHY 00006 DEFINES ITS OWN FORMAT
//
// MIP-0005's `zswapoffer` bech32 envelope carries a bare zswap `Offer` and CANNOT carry this project's
// offers: a contract maker offer is a whole `Transaction` — the Intent holds the contract call, and
// the call is what authorizes the pool coin's movement. So the envelope wraps
// `Transaction.serialize()` bytes directly.
//
// WHY THE CONTENT ADDRESS IS SHA-256 OF THE RAW BYTES, and not a chain identifier
//
// Decision D-306 (Plan 01 spike S3) publishes the UNBOUND form, and the unbound form has NO canonical
// transaction hash — `transactionHash()` is defined only for proven, signed AND bound transactions.
// SHA-256 of the serialized bytes is therefore the only stable name available. It is also the right
// one: `finalizeRecipe` merges the offer into a LARGER transaction whose hash the maker cannot know in
// advance, so no chain identifier could name the offer as distributed anyway.
//
// FRAMING — one self-contained file, and why not two
//
//   line 1   `AA00006-OFFER/1`         magic + format version
//   line 2   the terms, as ONE line of JSON (JSON.stringify never emits a raw newline)
//   rest     the raw `Transaction.serialize()` bytes, byte-for-byte, nothing appended
//
// FR-306 asks for a SELF-CONTAINED artifact, so terms and bytes travel together or not at all: a
// `.json` beside a `.bin` can be separated in transit and then the terms are unverifiable. The reader
// splits on the first two newlines only, so the payload can contain any bytes at all.
//
// The reader RECOMPUTES the content address and REFUSES on a mismatch. That makes the envelope its own
// first line of tamper defence (NC-304's outermost layer) and it is deliberately cheap and local: a
// flipped byte is rejected before a wallet, a proof server or a node is ever contacted.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { LANE_STAMP } from '../lane.js';
import type { PlacementReport } from '../g1/maker.js';

export const OFFER_MAGIC = 'AA00006-OFFER/1';
const NL = 0x0a;

/** The ledger's hard cap on an intent's lifetime: `global_ttl` = 3600 s. midnight-js uses all of it. */
export const TTL_CAP_SECONDS = 3600;

/** Which maker shape produced the offer (FR-308's ladder). Reported separately, never conflated. */
export type OfferShape = 'named-taker' | 'floating-surplus' | 'bearer-key';

/** The artifact form the bytes are in — decision D-306 selects `pre-binding`. */
export type OfferForm = 'pre-binding' | 'binding';

/** One leg of the swap, as the terms declare it. */
export type OfferLeg = {
  /** 32-byte colour, hex. */
  colour: string;
  /** Amount, decimal string (JSON has no bigint). */
  value: string;
};

/**
 * The bearer secret of FR-308 v2(b), published ON PURPOSE inside the envelope.
 *
 * This is not a leak, it is the mechanism: the maker paid A to a key it generated and threw away, and
 * anyone holding the envelope can sweep that payout. The consequence is a real property of the shape,
 * not a bug, and it is recorded rather than smoothed over: after settlement, EVERY holder of the
 * envelope can race to sweep A, and only the first wins. `note` carries that warning into the
 * artifact itself so it cannot be lost in transit.
 */
export type BearerKeyMaterial = {
  note: string;
  /** The throwaway WALLET seed, hex. Whoever has this can open a facade and spend the payout. */
  seedHex: string;
  /** How the shielded keys come from the seed, so a holder can reproduce them. */
  derivation: string;
  coinPublicKey: string;
  encryptionPublicKey: string;
};

export type OfferTerms = {
  version: 1;
  /** `EXPERIMENTAL_LANE / LANE-DEV-1` — FR-309 requires it on every artifact. */
  label: string;
  shape: OfferShape;
  /** Manager v4 carries ONE swap circuit; the shape is chosen by its `recipientA` argument (F-307). */
  circuitId: 'openSwapShielded';
  form: OfferForm;
  managerAddress: string;
  /** What leaves custody. `recipient` is absent for the floating-surplus shape — that is the point. */
  gives: OfferLeg & { recipient?: string; recipientKind?: 'user-coin-public-key' | 'contract-address' };
  /** What must arrive in custody. `nonce` is the coin the circuit claimed, fixed at proving time. */
  wants: OfferLeg & { nonce: string };
  /** The account credited with `wants`. */
  creditAccount: string;
  /** The account debited for `gives` — always the maker's witness owner, never a parameter. */
  makerAccount: string;
  createdAt: string;
  /** The moment after which a taker must refuse locally, ISO-8601. */
  expiresAt: string;
  ttlSeconds: number;
  /** SHA-256 of the raw transaction bytes — the content address (FR-306). */
  contentAddress: string;
  transactionBytes: number;
  /** The FR-302 placement assert as measured at build time, carried for the taker to re-check. */
  placement: PlacementReport;
  /** Whether the maker attached any DUST action (FR-301 requires false). */
  makerAttachedDust: boolean;
  bearerKey?: BearerKeyMaterial;
};

export const sha256Hex = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

/** Terms as they are written, minus the content address — which is derived, never supplied. */
export type OfferTermsDraft = Omit<OfferTerms, 'version' | 'label' | 'contentAddress' | 'transactionBytes'>;

export const makeTerms = (draft: OfferTermsDraft, bytes: Uint8Array): OfferTerms => ({
  version: 1,
  label: LANE_STAMP,
  ...draft,
  contentAddress: sha256Hex(bytes),
  transactionBytes: bytes.length,
});

export const encodeEnvelope = (terms: OfferTerms, bytes: Uint8Array): Uint8Array => {
  const json = JSON.stringify(terms);
  if (json.includes('\n')) throw new Error('offer terms serialized with a raw newline — the framing would break');
  const head = Buffer.from(`${OFFER_MAGIC}\n${json}\n`, 'utf-8');
  return Buffer.concat([head, Buffer.from(bytes)]);
};

export class OfferEnvelopeError extends Error {}

export type DecodedEnvelope = { terms: OfferTerms; bytes: Uint8Array };

/**
 * Decode and VERIFY an envelope. Every failure is an `OfferEnvelopeError` — this function never
 * returns a half-trusted result, because the whole point of the content address is to fail before a
 * tampered artifact reaches a wallet.
 */
export const decodeEnvelope = (raw: Uint8Array): DecodedEnvelope => {
  const buf = Buffer.from(raw);
  const firstNl = buf.indexOf(NL);
  if (firstNl < 0) throw new OfferEnvelopeError('offer envelope has no magic line');
  const magic = buf.subarray(0, firstNl).toString('utf-8');
  if (magic !== OFFER_MAGIC) {
    throw new OfferEnvelopeError(`offer envelope magic mismatch: expected "${OFFER_MAGIC}", read "${magic}"`);
  }
  const secondNl = buf.indexOf(NL, firstNl + 1);
  if (secondNl < 0) throw new OfferEnvelopeError('offer envelope has no terms line');

  let terms: OfferTerms;
  try {
    terms = JSON.parse(buf.subarray(firstNl + 1, secondNl).toString('utf-8')) as OfferTerms;
  } catch (e) {
    throw new OfferEnvelopeError(`offer terms are not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (terms?.version !== 1) throw new OfferEnvelopeError(`unsupported offer envelope version: ${String(terms?.version)}`);

  const bytes = new Uint8Array(buf.subarray(secondNl + 1));
  if (bytes.length !== terms.transactionBytes) {
    throw new OfferEnvelopeError(
      `offer payload length mismatch: terms declare ${terms.transactionBytes} bytes, envelope carries ${bytes.length}`,
    );
  }
  const actual = sha256Hex(bytes);
  if (actual !== terms.contentAddress) {
    throw new OfferEnvelopeError(
      `offer content address mismatch: terms declare sha256 ${terms.contentAddress}, payload hashes to ${actual}`,
    );
  }
  return { terms, bytes };
};

export const writeEnvelope = (path: string, terms: OfferTerms, bytes: Uint8Array): string => {
  writeFileSync(path, encodeEnvelope(terms, bytes));
  return path;
};

export const readEnvelope = (path: string): DecodedEnvelope => decodeEnvelope(readFileSync(path));

/** Has the offer's declared TTL passed? The taker checks this LOCALLY, before touching the chain. */
export const offerExpired = (terms: OfferTerms, now: Date = new Date()): boolean =>
  now.getTime() >= Date.parse(terms.expiresAt);

/** Seconds of life left, negative once expired. Recorded in evidence so expiry is measured, not guessed. */
export const offerSecondsLeft = (terms: OfferTerms, now: Date = new Date()): number =>
  Math.round((Date.parse(terms.expiresAt) - now.getTime()) / 1000);
