// Unit suite for the FR-306 offer envelope and the taker's fail-closed gates.
// 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Everything here runs with no chain, no wallet and no proof server, because everything here is
// SUPPOSED to: an envelope that needed a node to be checkable would not be an off-chain distributable
// artifact, and a taker gate that needed the network to refuse a tampered file would have already
// leaked the attempt.
//
// The transaction stubs are deliberate. The byte-derived fundability and merged checks are decision
// logic over `imbalances`, independent of advisory JSON. The REAL numbers are checked in two other
// places: `swap.test.ts` measures them from the compiled circuit's own zswap inputs and outputs, and
// the live spikes read
// them off a proven artifact. So the stubs test the guard, not the ledger, and cannot paper over a
// wrong circuit.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  advisoryOfferSecondsLeft,
  decodeEnvelope,
  encodeEnvelope,
  makeTerms,
  OfferEnvelopeError,
  OFFER_MAGIC,
  sha256Hex,
  TTL_CAP_SECONDS,
  type OfferTermsDraft,
} from '../offer/envelope.js';
import {
  MakerDustInspectionError,
  makerAttachedDust,
} from '../offer/build.js';
import {
  assertFundable,
  assertMergedBalanced,
  deserializeOfferBytes,
  ImbalanceUnreadableError,
  MergedTransactionUnbalancedError,
  nonDustDeficits,
  nonDustSurpluses,
  OfferFundabilityError,
  OfferTransactionDeserializeError,
  prepareDecodedOffer,
  readAllImbalances,
  takeOffer,
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
describe('FR-306 / A-308 — OFFER/1 carries advisory JSON and authoritative transaction bytes', () => {
  it('carries terms and raw bytes in one file, and decodes both back byte-identically', () => {
    const bytes = payload();
    const terms = makeTerms(draft(), bytes);
    const env = encodeEnvelope(terms, bytes);

    // The magic line is readable without parsing anything.
    expect(Buffer.from(env).subarray(0, OFFER_MAGIC.length).toString('utf-8')).toBe(OFFER_MAGIC);

    const back = decodeEnvelope(env);
    expect(Buffer.compare(Buffer.from(back.bytes), Buffer.from(bytes))).toBe(0);
    expect(back.terms).toEqual(terms);
    expect(back.payload).toEqual({ contentAddress: sha256Hex(bytes), transactionBytes: bytes.length });
  });

  it('content-addresses by SHA-256 of the RAW TRANSACTION BYTES, not of the envelope', () => {
    const bytes = payload();
    const terms = makeTerms(draft(), bytes);
    expect(terms.contentAddress).toBe(sha256Hex(bytes));
    expect(terms.transactionBytes).toBe(bytes.length);
    // Changing advisory terms leaves the byte-derived identity alone: it names the payload.
    const relabelled = makeTerms(draft({ createdAt: '2026-01-01T00:00:00.000Z' }), bytes);
    expect(relabelled.contentAddress).toBe(terms.contentAddress);
    expect(decodeEnvelope(encodeEnvelope({ contentAddress: 'advisory lie' }, bytes)).payload.contentAddress).toBe(
      terms.contentAddress,
    );
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
describe('A-308 — every JSON field is advisory; transaction bytes alone determine the take path', () => {
  const retained = (): Uint8Array =>
    new Uint8Array(
      readFileSync(new URL('../../../evidence/g3-swap-ledger/offers/offer-1.offer', import.meta.url)),
    );

  const decision = (raw: Uint8Array) => {
    const prepared = prepareDecodedOffer(decodeEnvelope(raw));
    return {
      payload: prepared.decoded.payload,
      form: prepared.form,
      route: prepared.route,
      deficits: prepared.fundability.deficits,
      surpluses: prepared.fundability.surpluses,
      inferredShape: prepared.fundability.inferredShape,
    };
  };

  const objectFieldPaths = (value: unknown, prefix: string[] = []): string[][] => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    return Object.entries(value).flatMap(([field, child]) => {
      const path = [...prefix, field];
      return [path, ...objectFieldPaths(child, path)];
    });
  };

  const editAt = (terms: Record<string, unknown>, path: string[], remove: boolean): Record<string, unknown> => {
    const copy = JSON.parse(JSON.stringify(terms)) as Record<string, unknown>;
    let target: Record<string, unknown> = copy;
    for (const field of path.slice(0, -1)) target = target[field] as Record<string, unknown>;
    if (remove) delete target[path.at(-1)!];
    else target[path.at(-1)!] = null;
    return copy;
  };

  it('keeps the exact byte-derived decision when every existing JSON field, including nested fields, is changed or removed', () => {
    const decoded = decodeEnvelope(retained());
    const expected = decision(retained());
    for (const path of objectFieldPaths(decoded.terms)) {
      const label = path.join('.');
      expect(decision(encodeEnvelope(editAt(decoded.terms, path, false), decoded.bytes)), `changed ${label}`).toEqual(expected);
      expect(decision(encodeEnvelope(editAt(decoded.terms, path, true), decoded.bytes)), `removed ${label}`).toEqual(expected);
    }
  });

  it('ignores inserted bearer/unknown metadata and malformed or expired business notes', () => {
    const decoded = decodeEnvelope(retained());
    const expected = decision(retained());
    const poisoned = {
      completelyUnknown: { nested: ['anything'] },
      bearerKey: { seedHex: 'attacker-selected' },
      expiresAt: '1900-01-01T00:00:00.000Z',
      form: 'binding',
      shape: 'floating-surplus',
      gives: { colour: '00', value: '999999' },
      wants: { colour: 'ff', value: '-1' },
      contentAddress: '00'.repeat(32),
      transactionBytes: 1,
      version: 999,
    };
    expect(decision(encodeEnvelope(poisoned, decoded.bytes))).toEqual(expected);
  });

  it('still refuses invalid serialized transaction bytes after advisory hash/length are repaired', () => {
    const decoded = decodeEnvelope(retained());
    const corrupted = decoded.bytes.slice();
    corrupted[0] ^= 0x01; // destroy the authoritative transaction header
    const repairedNotes = {
      contentAddress: sha256Hex(corrupted),
      transactionBytes: corrupted.length,
      expiresAt: '2999-01-01T00:00:00.000Z',
    };
    const reparsed = decodeEnvelope(encodeEnvelope(repairedNotes, corrupted));
    expect(reparsed.payload).toEqual({
      contentAddress: repairedNotes.contentAddress,
      transactionBytes: repairedNotes.transactionBytes,
    });
    expect(() => deserializeOfferBytes(reparsed.bytes)).toThrow(OfferTransactionDeserializeError);
    expect(() => prepareDecodedOffer(reparsed)).toThrow(OfferTransactionDeserializeError);
  });

  it('infers pre-binding and binding forms from their serialized headers, never from JSON', () => {
    const unbound = new Uint8Array(
      readFileSync(new URL('../../../evidence/g1-spikes/offers/offer-unbound-fa1b3b20b948f1ae.bin', import.meta.url)),
    );
    const bound = new Uint8Array(
      readFileSync(new URL('../../../evidence/g1-spikes/offers/offer-bound-66ae844ea66818fb.bin', import.meta.url)),
    );
    expect(deserializeOfferBytes(unbound)).toMatchObject({ form: 'pre-binding', route: 'unbound' });
    expect(deserializeOfferBytes(bound)).toMatchObject({ form: 'binding', route: 'bound' });
  });

  it('an expired/poisoned JSON note reaches the same wallet balancing call as empty JSON', async () => {
    const decoded = decodeEnvelope(retained());
    const wallet = {
      validateTransaction: vi.fn().mockResolvedValue(undefined),
      balanceUnboundTransaction: vi.fn().mockRejectedValue(new Error('sentinel stop after byte-derived decision')),
    };
    const taker = {
      wallet,
      shieldedSecretKeys: {},
      dustSecretKey: {},
      unshieldedKeystore: { signDataAsync: vi.fn() },
    } as any;
    const poisoned = await takeOffer(
      taker,
      encodeEnvelope({ expiresAt: '1900-01-01T00:00:00.000Z', form: 'binding', wants: null }, decoded.bytes),
    );
    const empty = await takeOffer(taker, encodeEnvelope({}, decoded.bytes));
    expect({ stage: poisoned.stage, route: poisoned.settlement?.route }).toEqual({
      stage: 'settlement',
      route: 'unbound',
    });
    expect({ stage: empty.stage, route: empty.settlement?.route }).toEqual({
      stage: 'settlement',
      route: 'unbound',
    });
    expect(wallet.balanceUnboundTransaction).toHaveBeenCalledTimes(2);
  });

  it('still refuses invalid framing while ignoring the advisory JSON version field', () => {
    const decoded = decodeEnvelope(retained());
    const env = Buffer.from(encodeEnvelope(decoded.terms, decoded.bytes));
    const wrongMagic = Buffer.concat([Buffer.from('AA00006-OFFER/9\n'), env.subarray(OFFER_MAGIC.length + 1)]);
    expect(() => decodeEnvelope(wrongMagic)).toThrow(/magic mismatch/);
    expect(decodeEnvelope(encodeEnvelope({ version: 999 }, decoded.bytes)).payload).toEqual(decoded.payload);
  });

  it('refuses missing, invalid or non-object JSON framing', () => {
    expect(() => decodeEnvelope(Buffer.from(`${OFFER_MAGIC}\n`))).toThrow(/no terms line/);
    expect(() => decodeEnvelope(Buffer.from('not an offer'))).toThrow(/no magic line/);
    expect(() => decodeEnvelope(Buffer.from(`${OFFER_MAGIC}\nnot-json\nbytes`))).toThrow(OfferEnvelopeError);
    expect(() => decodeEnvelope(Buffer.from(`${OFFER_MAGIC}\n[]\nbytes`))).toThrow(/JSON object/);
  });
});

// =================================================================================================
describe('FR-307b / A-308 — TTL annotations are business notes only', () => {
  it('knows the ledger cap', () => {
    expect(TTL_CAP_SECONDS).toBe(3600);
  });

  it('may report advisory seconds remaining but never turns it into a gate', () => {
    const terms = makeTerms(draft(), payload());
    const inLife = new Date('2026-08-20T00:30:00.000Z');
    const after = new Date('2026-08-20T01:00:01.000Z');
    expect(advisoryOfferSecondsLeft(terms, inLife)).toBe(1800);
    expect(advisoryOfferSecondsLeft(terms, after)).toBe(-1);
  });

  it('returns no display value for missing or malformed expiry notes', () => {
    expect(advisoryOfferSecondsLeft({})).toBeUndefined();
    expect(advisoryOfferSecondsLeft({ expiresAt: 'not-a-date' })).toBeUndefined();
  });
});

// =================================================================================================
describe('Taker gate 2 — fundability is derived from transaction bytes, fail-closed', () => {
  it('accepts a named-output transaction whose only imbalance is one deficit', () => {
    const r = assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n }, 1234: {} }));
    expect(r.deficits).toEqual({ [`0/shielded:${B}`]: '-7' });
    expect(r.surpluses).toEqual({});
    expect(r.inferredShape).toBe('named-output');
  });

  it('infers a floating surplus from +A beside −B without consulting JSON', () => {
    const r = assertFundable(stubTx({ 0: { [`shielded:${A}`]: 2n, [`shielded:${B}`]: -3n }, 1234: {} }));
    expect(r.surpluses).toEqual({ [`0/shielded:${A}`]: '2' });
    expect(r.inferredShape).toBe('floating-surplus');
  });

  it('accepts the actual deficit amount regardless of an advisory economic claim', () => {
    expect(assertFundable(stubTx({ 0: { [`shielded:${B}`]: -70n }, 1234: {} })).deficits).toEqual({
      [`0/shielded:${B}`]: '-70',
    });
  });

  it('REFUSES an offer with a leg outside the guaranteed section (FR-302 / issue 0003)', () => {
    expect(() =>
      assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n }, 1234: { [`shielded:${A}`]: -1n } })),
    ).toThrow(/outside the guaranteed section/);
  });

  it('REFUSES an offer asking for more than one thing', () => {
    expect(() =>
      assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n, [`shielded:${A}`]: -1n }, 1234: {} })),
    ).toThrow(/exactly ONE non-dust deficit/);
  });

  it('REFUSES more than one surplus because the byte-derived offer shape is ambiguous', () => {
    expect(() =>
      assertFundable(
        stubTx({ 0: { [`shielded:${A}`]: 1n, [`shielded:${'cc'.repeat(32)}`]: 2n, [`shielded:${B}`]: -7n }, 1234: {} }),
      ),
    ).toThrow(OfferFundabilityError);
  });

  it('treats an UNREADABLE imbalance as a refusal, never as a pass', () => {
    const tx = stubTx({ 0: { [`shielded:${B}`]: -7n }, 1234: {} }, { unreadable: [1234] });
    expect(() => assertFundable(tx)).toThrow(ImbalanceUnreadableError);
    expect(() => readAllImbalances(tx, 'probe')).toThrow(/An unreadable imbalance is a refusal/);
  });

  it('ignores DUST when deciding what must be funded', () => {
    const r = assertFundable(stubTx({ 0: { [`shielded:${B}`]: -7n, dust: -12345n }, 1234: {} }));
    expect(nonDustDeficits(r.imbalances)).toEqual({ [`0/shielded:${B}`]: '-7' });
    expect(nonDustSurpluses(r.imbalances)).toEqual({});
  });
});

// =================================================================================================
describe('Taker gate 3 — the merged transaction must not still be in deficit', () => {
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
