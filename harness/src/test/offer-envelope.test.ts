// Unit suite for the FR-306 offer envelope and the taker's fail-closed gates.
// 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Everything here runs with no chain, no wallet and no proof server, because everything here is
// SUPPOSED to: an envelope that needed a node to be checkable would not be an off-chain distributable
// artifact, and a taker gate that needed the network to refuse a tampered file would have already
// leaked the attempt.
//
// The transaction stubs are deliberate. Gates 3 and 4 are decision logic over `imbalances`, and the
// question they answer — "does this artifact ask for exactly what its terms claim?" — is independent
// of who produced the numbers. The REAL numbers are checked in two other places: `swap.test.ts`
// measures them from the compiled circuit's own zswap inputs and outputs, and the live spikes read
// them off a proven artifact. So the stubs test the guard, not the ledger, and cannot paper over a
// wrong circuit.
import { describe, expect, it, vi } from 'vitest';
import {
  decodeEnvelope,
  encodeEnvelope,
  makeTerms,
  offerExpired,
  offerSecondsLeft,
  OfferEnvelopeError,
  OFFER_MAGIC,
  sha256Hex,
  TTL_CAP_SECONDS,
  type OfferTerms,
  type OfferTermsDraft,
} from '../offer/envelope.js';
import {
  MakerDustInspectionError,
  makerAttachedDust,
} from '../offer/build.js';
import {
  assertFundable,
  assertMergedBalanced,
  ImbalanceUnreadableError,
  MergedTransactionUnbalancedError,
  nonDustDeficits,
  nonDustSurpluses,
  OfferTermsMismatchError,
  readAllImbalances,
  takeStageForSettlement,
} from '../offer/take.js';
import { settleAsTaker } from '../g1/taker.js';

const A = 'aa'.repeat(32);
const B = 'bb'.repeat(32);

/** Bytes that are deliberately NOT valid UTF-8 and DO contain newlines, to exercise the framing. */
const payload = (n = 512): Uint8Array => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 7 + 0x0a) % 256;
  return b;
};

const draft = (over: Partial<OfferTermsDraft> = {}): OfferTermsDraft => ({
  shape: 'named-taker',
  circuitId: 'openSwapShielded',
  form: 'pre-binding',
  managerAddress: 'cc'.repeat(32),
  gives: { colour: A, value: '4', recipient: 'taker-coin-pk', recipientKind: 'user-coin-public-key' },
  wants: { colour: B, value: '7', nonce: 'dd'.repeat(32) },
  creditAccount: 'ee'.repeat(32),
  makerAccount: 'ff'.repeat(32),
  createdAt: '2026-08-20T00:00:00.000Z',
  expiresAt: '2026-08-20T01:00:00.000Z',
  ttlSeconds: 3600,
  placement: {
    segments: [0, 1234],
    intentSegments: [1234],
    fallibleOfferSegments: [],
    imbalances: { '0': { [`shielded:${B}`]: '-7' }, '1234': {} },
    expectedAtSegment0: { [`shielded:${B}`]: '-7' },
    segment0Exact: true,
    otherSegmentsEmpty: true,
    offendingSegments: [],
    ok: true,
  },
  makerAttachedDust: false,
  ...over,
});

/** A stub transaction exposing exactly the surface the taker's gates use. */
const stubTx = (imb: Record<number, Record<string, bigint>>, opts: { unreadable?: number[] } = {}) => ({
  intents: { keys: () => Object.keys(imb).map(Number).filter((s) => s !== 0) },
  fallibleOffer: { keys: () => [] as number[] },
  imbalances: (segment: number) => {
    if (opts.unreadable?.includes(segment)) throw new Error('cannot read imbalances for a segment like this');
    const m = imb[segment];
    if (!m) throw new Error(`transaction has no segment ${segment}`);
    return new Map(Object.entries(m).map(([k, v]) => [{ tag: k.split(':')[0], raw: k.split(':')[1] }, v]));
  },
});

// =================================================================================================
describe('FR-306 — the offer envelope round-trips and is content-addressed', () => {
  it('carries terms and raw bytes in one file, and decodes both back byte-identically', () => {
    const bytes = payload();
    const terms = makeTerms(draft(), bytes);
    const env = encodeEnvelope(terms, bytes);

    // The magic line is readable without parsing anything.
    expect(Buffer.from(env).subarray(0, OFFER_MAGIC.length).toString('utf-8')).toBe(OFFER_MAGIC);

    const back = decodeEnvelope(env);
    expect(Buffer.compare(Buffer.from(back.bytes), Buffer.from(bytes))).toBe(0);
    expect(back.terms).toEqual(terms);
  });

  it('content-addresses by SHA-256 of the RAW TRANSACTION BYTES, not of the envelope', () => {
    const bytes = payload();
    const terms = makeTerms(draft(), bytes);
    expect(terms.contentAddress).toBe(sha256Hex(bytes));
    expect(terms.transactionBytes).toBe(bytes.length);
    // Changing the terms leaves the content address alone: it names the OFFER, not the wrapper.
    const relabelled = makeTerms(draft({ createdAt: '2026-01-01T00:00:00.000Z' }), bytes);
    expect(relabelled.contentAddress).toBe(terms.contentAddress);
  });

  it('carries the FR-309 lane label on every artifact', () => {
    expect(makeTerms(draft(), payload()).label).toBe('EXPERIMENTAL_LANE / LANE-DEV-1');
  });

  it('survives a payload containing newlines and invalid UTF-8 (the framing is byte-safe)', () => {
    const bytes = new Uint8Array([0x0a, 0x0a, 0xff, 0xfe, 0x00, 0x0a, 0x80]);
    const terms = makeTerms(draft(), bytes);
    const back = decodeEnvelope(encodeEnvelope(terms, bytes));
    expect(Buffer.compare(Buffer.from(back.bytes), Buffer.from(bytes))).toBe(0);
  });
});

// =================================================================================================
describe('FR-307c / NC-304 — a tampered envelope is refused OFFLINE, before any network contact', () => {
  const build = () => {
    const bytes = payload();
    const terms = makeTerms(draft(), bytes);
    return { bytes, terms, env: Buffer.from(encodeEnvelope(terms, bytes)) };
  };

  it('refuses a single flipped byte in the payload', () => {
    const { env } = build();
    // Flip a byte well inside the transaction payload.
    env[env.length - 40] ^= 0x01;
    expect(() => decodeEnvelope(env)).toThrow(OfferEnvelopeError);
    expect(() => decodeEnvelope(env)).toThrow(/content address mismatch/);
  });

  it('refuses a truncated payload by LENGTH before it even hashes it', () => {
    const { env } = build();
    expect(() => decodeEnvelope(env.subarray(0, env.length - 1))).toThrow(/payload length mismatch/);
  });

  it('refuses an appended byte', () => {
    const { env } = build();
    expect(() => decodeEnvelope(Buffer.concat([env, Buffer.from([0x00])]))).toThrow(/payload length mismatch/);
  });

  it('refuses terms whose declared content address does not match the payload', () => {
    const { bytes, terms } = build();
    const lying: OfferTerms = { ...terms, contentAddress: 'ab'.repeat(32) };
    expect(() => decodeEnvelope(encodeEnvelope(lying, bytes))).toThrow(/content address mismatch/);
  });

  it('refuses a wrong magic line and an unsupported version', () => {
    const { bytes, terms } = build();
    const env = Buffer.from(encodeEnvelope(terms, bytes));
    const wrongMagic = Buffer.concat([Buffer.from('AA00006-OFFER/9\n'), env.subarray(OFFER_MAGIC.length + 1)]);
    expect(() => decodeEnvelope(wrongMagic)).toThrow(/magic mismatch/);
    expect(() => decodeEnvelope(encodeEnvelope({ ...terms, version: 2 as 1 }, bytes))).toThrow(/unsupported offer envelope version/);
  });

  it('refuses a file with no terms line at all', () => {
    expect(() => decodeEnvelope(Buffer.from(`${OFFER_MAGIC}\n`))).toThrow(/no terms line/);
    expect(() => decodeEnvelope(Buffer.from('not an offer'))).toThrow(/no magic line/);
  });
});

// =================================================================================================
describe('FR-307b — TTL is bounded by the ledger cap and checked locally', () => {
  it('knows the ledger cap', () => {
    expect(TTL_CAP_SECONDS).toBe(3600);
  });

  it('reports remaining life and expiry against a supplied clock', () => {
    const terms = makeTerms(draft(), payload());
    const inLife = new Date('2026-08-20T00:30:00.000Z');
    const after = new Date('2026-08-20T01:00:01.000Z');
    expect(offerExpired(terms, inLife)).toBe(false);
    expect(offerSecondsLeft(terms, inLife)).toBe(1800);
    expect(offerExpired(terms, after)).toBe(true);
    expect(offerSecondsLeft(terms, after)).toBe(-1);
  });

  it('treats the expiry instant itself as expired', () => {
    const terms = makeTerms(draft(), payload());
    expect(offerExpired(terms, new Date('2026-08-20T01:00:00.000Z'))).toBe(true);
  });
});

// =================================================================================================
describe('Taker gate 3 — fundability, fail-closed', () => {
  it('accepts a named-taker offer whose ONLY imbalance is the declared −B deficit', () => {
    const terms = makeTerms(draft(), payload());
    const r = assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n }, 1234: {} }), terms);
    expect(r.matchesTerms).toBe(true);
    expect(r.deficits).toEqual({ [`0/shielded:${B}`]: '-7' });
    expect(r.surpluses).toEqual({});
  });

  it('accepts a floating-surplus offer with +A beside −B, and reports the sweepable surplus', () => {
    const terms = makeTerms(
      draft({ shape: 'floating-surplus', gives: { colour: A, value: '2' } }),
      payload(),
    );
    const r = assertFundable(stubTx({ 0: { [`shielded:${A}`]: 2n, [`shielded:${B}`]: -3n }, 1234: {} }), {
      ...terms,
      wants: { ...terms.wants, value: '3' },
    });
    expect(r.matchesTerms).toBe(true);
    expect(r.surpluses).toEqual({ [`0/shielded:${A}`]: '2' });
  });

  it('REFUSES a named-taker offer that leaves a surplus — that would be A paid to nobody', () => {
    const terms = makeTerms(draft(), payload());
    expect(() =>
      assertFundable(stubTx({ 0: { [`shielded:${A}`]: 4n, [`shielded:${B}`]: -7n }, 1234: {} }), terms),
    ).toThrow(OfferTermsMismatchError);
  });

  it('REFUSES a surplus offer whose surplus is not the declared give', () => {
    const terms = makeTerms(
      draft({ shape: 'floating-surplus', gives: { colour: A, value: '2' } }),
      payload(),
    );
    expect(() =>
      assertFundable(stubTx({ 0: { [`shielded:${A}`]: 1n, [`shielded:${B}`]: -7n }, 1234: {} }), terms),
    ).toThrow(/must leave \+2/);
  });

  it('REFUSES an offer whose deficit differs from the terms — the terms are only JSON the maker wrote', () => {
    const terms = makeTerms(draft(), payload());
    expect(() => assertFundable(stubTx({ 0: { [`shielded:${B}`]: -70n }, 1234: {} }), terms)).toThrow(
      /the terms want 7 .* but the transaction's deficit/,
    );
  });

  it('REFUSES an offer with a leg outside the guaranteed section (FR-302 / issue 0003)', () => {
    const terms = makeTerms(draft(), payload());
    expect(() =>
      assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n }, 1234: { [`shielded:${A}`]: -1n } }), terms),
    ).toThrow(/outside the guaranteed section/);
  });

  it('REFUSES an offer asking for more than one thing', () => {
    const terms = makeTerms(draft(), payload());
    expect(() =>
      assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n, [`shielded:${A}`]: -1n }, 1234: {} }), terms),
    ).toThrow(/exactly ONE non-dust deficit/);
  });

  it('treats an UNREADABLE imbalance as a refusal, never as a pass', () => {
    const terms = makeTerms(draft(), payload());
    const tx = stubTx({ 0: { [`shielded:${B}`]: -7n }, 1234: {} }, { unreadable: [1234] });
    expect(() => assertFundable(tx, terms)).toThrow(ImbalanceUnreadableError);
    expect(() => readAllImbalances(tx, 'probe')).toThrow(/An unreadable imbalance is a refusal/);
  });

  it('ignores DUST when deciding what must be funded', () => {
    const terms = makeTerms(draft(), payload());
    const r = assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n, dust: -12345n }, 1234: {} }), terms);
    expect(r.matchesTerms).toBe(true);
    expect(nonDustDeficits(r.imbalances)).toEqual({ [`0/shielded:${B}`]: '-7' });
    expect(nonDustSurpluses(r.imbalances)).toEqual({});
  });
});

// =================================================================================================
describe('Taker gate 4 — the merged transaction must not still be in deficit', () => {
  it('passes a fully balanced merge and reports nothing unswept', () => {
    const r = assertMergedBalanced(stubTx({ 0: { dust: -900n }, 1: {} }));
    expect(r.unswept).toEqual({});
  });

  it('refuses to submit a merge that still carries a non-dust deficit', () => {
    expect(() => assertMergedBalanced(stubTx({ 0: { [`shielded:${B}`]: -7n }, 1: {} }))).toThrow(
      MergedTransactionUnbalancedError,
    );
  });

  it('permits a leftover SURPLUS but records it — legal, and value handed to nobody', () => {
    const r = assertMergedBalanced(stubTx({ 0: { [`shielded:${A}`]: 2n }, 1: {} }));
    expect(r.unswept).toEqual({ [`0/shielded:${A}`]: '2' });
  });

  it('refuses an unreadable merged transaction', () => {
    expect(() => assertMergedBalanced(stubTx({ 0: {}, 1: {} }, { unreadable: [0] }))).toThrow(ImbalanceUnreadableError);
  });
});

// =================================================================================================
describe('FR-301 — maker DUST inspection fails closed on SDK shape drift', () => {
  const intent = (dustActions: unknown) => ({ dustActions });

  it('accepts the SDK no-DUST representation and detects actual maker DUST', () => {
    expect(makerAttachedDust({ intents: new Map([[0, intent(undefined)]]) })).toBe(false);
    expect(
      makerAttachedDust({
        intents: new Map([[0, intent({ spends: [{}], registrations: [] })]]),
      }),
    ).toBe(true);
  });

  it('refuses missing, empty and non-iterable intent shapes', () => {
    expect(() => makerAttachedDust({})).toThrow(MakerDustInspectionError);
    expect(() => makerAttachedDust({ intents: new Map() })).toThrow(/transaction\.intents is empty/);
    expect(() => makerAttachedDust({ intents: {} })).toThrow(/transaction\.intents is not iterable/);
  });

  it('refuses missing, malformed and exception-throwing DUST accessors', () => {
    expect(() => makerAttachedDust({ intents: new Map([[0, {}]]) })).toThrow(/no dustActions accessor/);
    expect(() => makerAttachedDust({ intents: new Map([[0, intent({ spends: [], registrations: null })]]) })).toThrow(
      /registrations is not a readable array/,
    );
    const throwing = Object.defineProperty({}, 'dustActions', {
      get: () => {
        throw new Error('SDK getter exploded');
      },
    });
    expect(() => makerAttachedDust({ intents: new Map([[0, throwing]]) })).toThrow(
      /intent\/DUST accessor threw.*SDK getter exploded/,
    );
  });
});

// =================================================================================================
describe('TakeResult stage taxonomy', () => {
  it('records a throwing pre-submit guard and never contacts submitTransaction', async () => {
    const finalized = {
      transactionHash: () => 'test-hash',
      fees: () => 0n,
    };
    const wallet = {
      validateTransaction: vi.fn().mockResolvedValue(undefined),
      balanceUnboundTransaction: vi.fn().mockResolvedValue({ blockData: { ledgerParameters: {} } }),
      signRecipe: vi.fn().mockResolvedValue({}),
      finalizeRecipe: vi.fn().mockResolvedValue(finalized),
      submitTransaction: vi.fn().mockResolvedValue('must-not-submit'),
    };
    const taker = {
      wallet,
      shieldedSecretKeys: {},
      dustSecretKey: {},
      unshieldedKeystore: { signDataAsync: vi.fn() },
    };
    const settlement = await settleAsTaker(taker as any, {}, 'unbound', {
      preSubmit: () => {
        throw new MergedTransactionUnbalancedError('test gate-4 refusal');
      },
    });
    expect(settlement.ok).toBe(false);
    expect(settlement.failureStage).toBe('presubmit');
    expect(wallet.submitTransaction).not.toHaveBeenCalled();
    expect(takeStageForSettlement(settlement)).toBe('presubmit');
  });

  it('keeps node/balancing failures at settlement and success at settled', () => {
    expect(takeStageForSettlement({ route: 'unbound', ok: false, failureStage: 'settlement', validations: [] })).toBe(
      'settlement',
    );
    expect(takeStageForSettlement({ route: 'unbound', ok: true, validations: [] })).toBe('settled');
  });
});
