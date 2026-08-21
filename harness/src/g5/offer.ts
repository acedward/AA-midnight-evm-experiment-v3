// Building a LIVE offer on any G5 variant — one code path, two offer protocols.
// 00006 Plan 05 Phase 2/3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// `src/offer/build.ts` is the shipped builder and it stays untouched: it hardcodes
// `openSwapShielded(colourA, valA, recipientA, coinB, creditAccount)`, which is right for v4 and for
// arms (a)-(d) but cannot express arm (e)'s `stageOffer` -> `openSwap(recipientA, coinB)` split. This
// module is the variant-aware equivalent, and it keeps every property the shipped one is trusted for:
//
//   * FR-302 placement is read through the SAME instrument, `g1/maker.ts::assertPlacement` /
//     `requirePlacement`, over the segment set `segmentsOf` derives (never `tx.segments()`, which is
//     not bound to JS — finding F-304, and using the accessor would silently degrade the assert to
//     "segment 0 looks right");
//   * FR-301 holds: build, prove, STOP. No balancing, no signing, no DUST, no submission;
//   * `measureOnly` records placement instead of failing closed, for the matrix — and an offer built
//     that way is never published;
//   * the envelope is the shipped `offer/envelope.ts`, so a G5 offer is the same artifact a G3 offer
//     was and the taker path is unchanged.
//
// WHAT THE TWO PROTOCOLS EXPECT AT SEGMENT 0, and why the expectation is derived from the circuit
// rather than read off the artifact:
//
//   named-taker (both protocols)  `sendShielded` balances the give leg internally, so the ONLY
//                                 imbalance is the -B deficit a taker must fund.
//   floating-surplus (both)       the given value has no output at all, so it stands as a POSITIVE
//                                 imbalance beside the -B deficit. That positive number IS the open
//                                 offer.
//
// For arm (e) the given value is whatever `stageOffer` put in the escrow cell, because `openSwap`
// gives the WHOLE staged coin (relaxation R4''). The caller passes that amount as `gives.value`, and a
// mismatch shows up immediately as an FR-302 failure rather than as a silent difference.
import { randomBytes } from 'node:crypto';
import { buildCall } from '../g3/compose.js';
import { shieldedToUser } from '../g3/actions.js';
import { log } from '../night.js';
// The FR-302 instrument itself, imported rather than reimplemented: `assertPlacement` reads
// `imbalances(s)` for EVERY segment `segmentsOf` derives, and `requirePlacement` is the fail-closed
// half. Reimplementing either would mean the G5 matrix and the G3 ledger could disagree about what
// "placed at segment 0" means, which is the one disagreement this rig cannot afford.
import { assertPlacement, requirePlacement, type ImbalanceMap, type PlacementReport } from '../g1/maker.js';
import { makerAttachedDust } from '../offer/build.js';
import { makeTerms, TTL_CAP_SECONDS, type OfferForm, type OfferShape, type OfferTerms } from '../offer/envelope.js';
import type { VariantSpec } from './variants.js';

const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');
export const shieldedLabel = (colourHex: string): string => `shielded:${colourHex.toLowerCase()}`;

const ZERO_EITHER = {
  is_left: true,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: new Uint8Array(32) },
};

/** `Maybe<Either<ZswapCoinPublicKey, ContractAddress>>` — the argument that selects the shape. */
const maybeRecipient = (coinPk: unknown | null) =>
  coinPk === null ? { is_some: false, value: ZERO_EITHER } : { is_some: true, value: shieldedToUser(coinPk) };

export type G5OfferSpec = {
  variant: VariantSpec;
  /** The MAKER's providers, with the maker's owner secret already set through `actAs`. */
  providers: any;
  compiled: any;
  contractAddress: string;
  shape: Extract<OfferShape, 'named-taker' | 'floating-surplus'>;
  /** What leaves custody. For arm (e) this MUST equal what `stageOffer` staged. */
  gives: { colourRaw: Uint8Array; value: bigint };
  wants: { colourRaw: Uint8Array; value: bigint; nonce?: Uint8Array };
  /** Credited with the wanted colour. Ignored by arm (e), which records the owner at staging time. */
  creditAccount: Uint8Array;
  makerAccount: Uint8Array;
  recipient?: { coinPublicKey: unknown; encryptionPublicKey: unknown };
  ttlSeconds?: number;
  form?: OfferForm;
  /** MEASUREMENT ONLY: record placement instead of failing closed. Such offers are never published. */
  measureOnly?: boolean;
};

export type G5Offer = {
  proven: any;
  bytes: Uint8Array;
  terms: OfferTerms;
  placement: PlacementReport;
  circuitId: string;
  wantedCoin: { nonce: Uint8Array; color: Uint8Array; value: bigint };
  proveMs: number;
  buildMs: number;
};

/** What segment 0 MUST carry, per shape — derived from the circuit's structure, not from the artifact. */
export const expectedPlacement = (spec: G5OfferSpec): ImbalanceMap => {
  const wants = { [shieldedLabel(hex(spec.wants.colourRaw))]: String(-spec.wants.value) };
  if (spec.shape !== 'floating-surplus') return wants;
  return { [shieldedLabel(hex(spec.gives.colourRaw))]: String(spec.gives.value), ...wants };
};

/** The offer circuit's name on this variant — the only place the two protocols diverge structurally. */
export const offerCircuitOf = (v: VariantSpec): string => (v.offer === 'staged' ? 'openSwap' : 'openSwapShielded');

/**
 * Build and prove ONE offer. The maker's last act.
 *
 * For arm (e) the caller must have already submitted `stageOffer`; this builds `openSwap` only, which
 * is the circuit whose placement F-310 constrains.
 */
export const buildG5Offer = async (spec: G5OfferSpec): Promise<G5Offer> => {
  const v = spec.variant;
  const circuitId = offerCircuitOf(v);
  const form: OfferForm = spec.form ?? 'pre-binding'; // decision D-306
  const ttlSeconds = Math.min(spec.ttlSeconds ?? TTL_CAP_SECONDS, TTL_CAP_SECONDS);
  const giveHex = hex(spec.gives.colourRaw);
  const wantHex = hex(spec.wants.colourRaw);
  const wantedCoin = {
    nonce: spec.wants.nonce ?? randomBytes(32),
    color: spec.wants.colourRaw,
    value: spec.wants.value,
  };

  if (spec.shape === 'floating-surplus' && spec.recipient) {
    throw new Error('the floating-surplus shape must have NO recipient — a fixed recipient is what it exists to avoid');
  }
  if (spec.shape === 'named-taker' && !spec.recipient) {
    throw new Error('the named-taker shape needs a recipient for the given colour');
  }

  const recipientArg = maybeRecipient(spec.recipient ? spec.recipient.coinPublicKey : null);
  const args: unknown[] =
    v.offer === 'staged'
      ? [recipientArg, wantedCoin]
      : [spec.gives.colourRaw, spec.gives.value, recipientArg, wantedCoin, spec.creditAccount];

  const encMappings = spec.recipient
    ? new Map<unknown, unknown>([[spec.recipient.coinPublicKey, spec.recipient.encryptionPublicKey]])
    : undefined;

  log(
    `g5[${v.id}/${spec.shape}]: building ${circuitId}(give ${spec.gives.value} of ${giveHex.slice(0, 12)}…, ` +
      `want ${spec.wants.value} of ${wantHex.slice(0, 12)}…)`,
  );
  const t0 = Date.now();
  const built: any = await buildCall({
    providers: spec.providers,
    compiledContract: spec.compiled,
    contractAddress: spec.contractAddress,
    circuitId,
    args,
    privateStateId: 'manager',
    ...(encMappings ? { encMappings } : {}),
  });
  const buildMs = Date.now() - t0;

  const t1 = Date.now();
  const provenUnbound: any = await spec.providers.proofProvider.proveTx(built.private.unprovenTx);
  const proveMs = Date.now() - t1;
  const proven: any = form === 'binding' ? provenUnbound.bind() : provenUnbound;

  if (makerAttachedDust(proven)) {
    throw new Error(`FR-301 VIOLATED: the ${v.id}/${spec.shape} maker artifact carries DUST actions`);
  }

  const expected = expectedPlacement(spec);
  const measured = assertPlacement(proven, expected);
  const placement = spec.measureOnly
    ? measured
    : requirePlacement(`${v.id} ${spec.shape} offer (${circuitId})`, measured);

  const bytes: Uint8Array = proven.serialize();
  const createdAt = new Date();
  const terms = makeTerms(
    {
      shape: spec.shape,
      // The envelope's `circuitId` records what a taker would be settling. Arm (e)'s is `openSwap`,
      // and recording the real name matters: a taker that assumed `openSwapShielded` would be
      // reasoning about a different contract.
      circuitId: circuitId as any,
      form,
      managerAddress: spec.contractAddress,
      gives: {
        colour: giveHex,
        value: String(spec.gives.value),
        ...(spec.recipient
          ? { recipient: String(spec.recipient.coinPublicKey), recipientKind: 'user-coin-public-key' as const }
          : {}),
      },
      wants: { colour: wantHex, value: String(spec.wants.value), nonce: hex(wantedCoin.nonce) },
      creditAccount: hex(spec.creditAccount),
      makerAccount: hex(spec.makerAccount),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString(),
      ttlSeconds,
      placement,
      makerAttachedDust: false,
    },
    bytes,
  );

  log(
    `g5[${v.id}/${spec.shape}]: ${placement.ok ? 'GUARANTEED — publishable' : 'FALLIBLE — NOT publishable'}; ` +
      `built ${buildMs} ms, proved ${proveMs} ms, ${bytes.length} B; imbalances(0) = ` +
      `${JSON.stringify(placement.imbalances['0'])}`,
  );
  return { proven, bytes, terms, placement, circuitId, wantedCoin, proveMs, buildMs };
};
