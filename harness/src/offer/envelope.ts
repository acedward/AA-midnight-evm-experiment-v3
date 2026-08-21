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
// Amendment A-308: the serialized transaction bytes are the ONLY authority. The JSON object is an
// advisory business note in its entirety — including its copies of payload length/hash — and cannot
// authorize, block or alter settlement. The reader therefore computes identity from the bytes it
// actually received and never compares a JSON field as a gate. Invalid transaction bytes still fail
// when the ledger deserializer/proofs/node read those bytes; a different valid payload is a different
// offer, regardless of what its advisory wrapper claims.
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
  /** Advisory business expiry note, ISO-8601. The serialized intent TTL is authoritative (A-308). */
  expiresAt: string;
  ttlSeconds: number;
  /** Advisory copy of SHA-256 written by the maker; readers compute identity from raw bytes (A-308). */
  contentAddress: string;
  /** Advisory copy of the byte length; readers compute this from the payload. */
  transactionBytes: number;
  /** The FR-302 placement assert as measured at build time, carried for the taker to re-check. */
  placement: PlacementReport;
  /** Whether the maker attached any DUST action (FR-301 requires false). */
  makerAttachedDust: boolean;
  bearerKey?: BearerKeyMaterial;
};

/**
 * The parsed JSON terms line on READ. It is deliberately partial and open: A-308 makes every field
 * advisory, so missing, added or wrong-typed fields must not affect the transaction path.
 */
export type AdvisoryOfferTerms = Record<string, unknown>;

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

export const encodeEnvelope = (terms: AdvisoryOfferTerms, bytes: Uint8Array): Uint8Array => {
  const json = JSON.stringify(terms);
  if (json.includes('\n')) throw new Error('offer terms serialized with a raw newline — the framing would break');
  const head = Buffer.from(`${OFFER_MAGIC}\n${json}\n`, 'utf-8');
  return Buffer.concat([head, Buffer.from(bytes)]);
};

export class OfferEnvelopeError extends Error {}

export type PayloadIdentity = { contentAddress: string; transactionBytes: number };

export type DecodedEnvelope = {
  /** Untrusted/advisory JSON retained for display and historical evidence compatibility only. */
  terms: AdvisoryOfferTerms;
  /** The sole authoritative envelope payload. */
  bytes: Uint8Array;
  /** Derived from `bytes`, never copied from JSON. */
  payload: PayloadIdentity;
};

/**
 * Decode the OFFER/1 framing and compute payload identity from the serialized transaction bytes.
 * JSON syntax/framing failures remain envelope errors; JSON field values never gate A-308's take path.
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.subarray(firstNl + 1, secondNl).toString('utf-8'));
  } catch (e) {
    throw new OfferEnvelopeError(`offer terms are not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new OfferEnvelopeError('offer terms line must be a JSON object (all of its fields are advisory)');
  }
  const terms = parsed as AdvisoryOfferTerms;

  const bytes = new Uint8Array(buf.subarray(secondNl + 1));
  return {
    terms,
    bytes,
    payload: { contentAddress: sha256Hex(bytes), transactionBytes: bytes.length },
  };
};

export const writeEnvelope = (path: string, terms: OfferTerms, bytes: Uint8Array): string => {
  writeFileSync(path, encodeEnvelope(terms, bytes));
  return path;
};

export const readEnvelope = (path: string): DecodedEnvelope => decodeEnvelope(readFileSync(path));

/**
 * Advisory display only. This value MUST NOT gate settlement; the serialized intent TTL and ledger
 * are authoritative. Missing/malformed annotations simply have no displayable value.
 */
export const advisoryOfferSecondsLeft = (
  terms: AdvisoryOfferTerms,
  now: Date = new Date(),
): number | undefined => {
  const expires = typeof terms.expiresAt === 'string' ? Date.parse(terms.expiresAt) : Number.NaN;
  return Number.isFinite(expires) ? Math.round((expires - now.getTime()) / 1000) : undefined;
};
