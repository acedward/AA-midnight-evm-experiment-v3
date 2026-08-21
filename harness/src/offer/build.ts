// The MAKER side of an offer: build, prove, assert, publish — and then STOP.
// 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// FR-301's whole content is what this module does NOT do. It never balances, never signs, never
// attaches DUST and never submits. `proveTx` is the last thing that happens to a maker artifact on
// the maker's side; everything after that belongs to whoever holds the envelope.
//
// Three offer shapes, one code path, because the FR-308 ladder must be reported as three separate
// results and the only honest way to do that is to build all three the same way. Manager v4 carries a
// SINGLE swap circuit and the shape is chosen by its `recipientA` argument (finding F-307 — the
// deploy budget is thirteen provable circuits, so the shapes had to share one):
//
//   named-taker        v1     `some(the taker's own coin public key)`.
//   floating-surplus   v2(a)  `none` — A is released with no output at all.
//   bearer-key         v2(b)  `some(a THROWAWAY key)` whose secret ships in the envelope, so any
//                             holder can settle and then sweep the payout.
//
// FR-302 is enforced here and it FAILS CLOSED. `requirePlacement` throws unless segment 0 carries
// exactly the intended deltas and no other segment carries anything at all — a leg outside the
// guaranteed section is unsettleable by any independent taker, so an offer that lands one is not
// published, it is retained as issue-0003 evidence. The segment set comes from `segmentsOf`, never
// from `tx.segments()`, which is not bound to JS at these pins (finding F-304); using the accessor
// would silently degrade the assert to "segment 0 looks right".
import { randomBytes } from 'node:crypto';
import * as ledger from '@midnightntwrk/ledger-v9';
import { buildCall } from '../g3/compose.js';
import { shieldedToUser } from '../g3/actions.js';
import { shieldedSeedOf } from '../wallet.js';
import { log } from '../night.js';
import { requirePlacement, assertPlacement, type ImbalanceMap, type PlacementReport } from '../g1/maker.js';
import {
  makeTerms,
  TTL_CAP_SECONDS,
  type BearerKeyMaterial,
  type OfferForm,
  type OfferShape,
  type OfferTerms,
} from './envelope.js';

const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');

/** The imbalance-map key the ledger's own token labels produce for a shielded colour. */
export const shieldedLabel = (colourHex: string): string => `shielded:${colourHex.toLowerCase()}`;

/** Raised when the SDK shape cannot prove whether the maker attached DUST. */
export class MakerDustInspectionError extends Error {
  constructor(detail: string) {
    super(`FR-301 INSPECTION FAILED [maker-dust-shape-unreadable]: ${detail}`);
    this.name = 'MakerDustInspectionError';
  }
}

const actionCount = (value: unknown, what: string): number => {
  if (!Array.isArray(value)) {
    throw new MakerDustInspectionError(`${what} is not a readable array`);
  }
  return value.length;
};

/**
 * Does this transaction carry ANY dust action? FR-301 requires `false` on every maker artifact.
 *
 * This inspection fails closed. `Intent.dustActions === undefined` is the SDK's explicit encoding
 * for an intent with no DUST interactions, but a missing/throwing accessor, an absent/non-iterable
 * intents collection, or a malformed DustActions object is not evidence of absence and is refused.
 */
export const makerAttachedDust = (tx: any): boolean => {
  let intents: unknown;
  try {
    intents = tx?.intents;
  } catch (e) {
    throw new MakerDustInspectionError(`transaction.intents threw while being read: ${String(e)}`);
  }
  if (intents === undefined || intents === null) {
    throw new MakerDustInspectionError('transaction.intents is absent');
  }
  if (typeof (intents as any)[Symbol.iterator] !== 'function') {
    throw new MakerDustInspectionError('transaction.intents is not iterable');
  }

  let seen = 0;
  try {
    for (const entry of intents as Iterable<unknown>) {
      if (!Array.isArray(entry) || entry.length < 2) {
        throw new MakerDustInspectionError('transaction.intents yielded a malformed entry');
      }
      const [segment, intent] = entry;
      seen += 1;
      if ((typeof intent !== 'object' && typeof intent !== 'function') || intent === null) {
        throw new MakerDustInspectionError(`intent ${String(segment)} is not an object`);
      }
      if (!('dustActions' in intent)) {
        throw new MakerDustInspectionError(`intent ${String(segment)} has no dustActions accessor`);
      }

      const da = (intent as any).dustActions;
      if (da === undefined) continue;
      if ((typeof da !== 'object' && typeof da !== 'function') || da === null) {
        throw new MakerDustInspectionError(`intent ${String(segment)} returned malformed dustActions`);
      }
      if (!('spends' in da) || !('registrations' in da)) {
        throw new MakerDustInspectionError(
          `intent ${String(segment)} dustActions lacks spends or registrations`,
        );
      }
      if (
        actionCount((da as any).spends, `intent ${String(segment)} dustActions.spends`) > 0 ||
        actionCount((da as any).registrations, `intent ${String(segment)} dustActions.registrations`) > 0
      ) {
        return true;
      }
    }
  } catch (e) {
    if (e instanceof MakerDustInspectionError) throw e;
    throw new MakerDustInspectionError(`intent/DUST accessor threw while being read: ${String(e)}`);
  }
  if (seen === 0) throw new MakerDustInspectionError('transaction.intents is empty');
  return false;
};

/**
 * A throwaway key for the v2(b) bearer shape. The secret is published ON PURPOSE.
 *
 * It is generated as a WALLET seed, not a bare zswap seed, and `keys` is derived from it exactly as
 * `openParty` derives a wallet's shielded keys. That is what makes the published secret usable: a
 * holder can open a real facade on the seed, see the payout as its own coin, and SPEND it — which is
 * the only convincing demonstration that the bearer shape actually transfers control rather than
 * merely addressing a coin to a key nobody can use. It also means the throwaway wallet has its own
 * NIGHT/DUST keys, so it can be funded to pay for its own sweep transaction.
 */
export const mintBearerKey = (): { material: BearerKeyMaterial; keys: any; seed: string } => {
  const seed = randomBytes(32).toString('hex');
  const keys = (ledger as any).ZswapSecretKeys.fromSeed(shieldedSeedOf(seed));
  return {
    keys,
    seed,
    material: {
      note:
        'BEARER OFFER (FR-308 v2b). This seed is published deliberately: the maker paid colour A to a ' +
        'key it generated and discarded, so ANY holder of this envelope can settle the offer and then ' +
        'sweep the payout. After settlement every holder can race for it and only the first wins — ' +
        'that race is a property of this shape, not a defect, and it is recorded rather than hidden. ' +
        'The value is a WALLET seed for this harness (shielded keys = wallet-sdk-hd Roles.Zswap of it).',
      seedHex: seed,
      derivation: 'wallet-sdk-hd Roles.Zswap',
      coinPublicKey: String(keys.coinPublicKey),
      encryptionPublicKey: String(keys.encryptionPublicKey),
    },
  };
};

export type SwapOfferSpec = {
  /**
   * The MAKER's Manager providers. The caller must already have set the maker's owner secret through
   * `actAs`, because the debited account is derived from the witness and never from a parameter.
   */
  providers: any;
  compiledManager: any;
  managerAddress: string;
  shape: OfferShape;
  /** What leaves custody. */
  gives: { colourRaw: Uint8Array; value: bigint };
  /** What must arrive. `nonce` defaults to fresh randomness. */
  wants: { colourRaw: Uint8Array; value: bigint; nonce?: Uint8Array };
  /** The account credited with the wanted colour. */
  creditAccount: Uint8Array;
  /** The maker's own account id — recorded in the terms; the contract derives it from the witness. */
  makerAccount: Uint8Array;
  /**
   * Who colour A is paid to. REQUIRED for `named-taker`, forbidden for `floating-surplus`, and
   * supplied from the throwaway key for `bearer-key`.
   */
  recipient?: { coinPublicKey: unknown; encryptionPublicKey: unknown };
  /** Pre-generated bearer material, for `bearer-key`. Generated here when absent. */
  bearer?: { material: BearerKeyMaterial; keys: any; seed: string };
  /** Offer lifetime; capped at the ledger's `global_ttl` of 3600 s. */
  ttlSeconds?: number;
  form?: OfferForm;
  /**
   * A hook on the UNPROVEN transaction, between building and proving.
   *
   * It exists for exactly one experiment: midnight-js hardcodes `ttlOneHour()` for every intent it
   * builds (`midnight-js-contracts/dist/index.mjs:990`), so an offer's INTENT expires an hour after
   * it is built and observing node-side expiry would otherwise cost an hour of waiting per
   * observation. Rewriting the intent's `ttl` while the transaction is still unproven lets S5 measure
   * that behaviour in minutes — and it is done BEFORE proving on purpose, because finding F-306
   * established that rewriting a PROVEN transaction's intents invalidates its zswap proofs
   * (`Custom error: 235`, 12/12, including on transactions that would have been accepted untouched).
   *
   * Nothing else uses it. Whether it works is itself a measurement, so callers must treat a failure
   * as data rather than assuming the mutation took effect.
   */
  mutateUnproven?: (unprovenTx: any) => void;
  /**
   * MEASUREMENT ONLY: record the FR-302 placement instead of failing closed on it.
   *
   * FR-302 is fail-closed by design and must stay that way for anything that gets PUBLISHED — an offer
   * whose value leg is outside the guaranteed section is unsettleable by any taker, so publishing one
   * would be publishing a lie. But a spike whose whole subject is *when* placement goes wrong needs the
   * placement report for the failing cases too, and `requirePlacement` throws before it can be read.
   *
   * Offers built with this flag are never published: the callers are spikes that read the report and
   * discard the artifact. `SwapOffer.placement.ok` still tells the truth, so a caller that ignored it
   * would be making its own mistake rather than inheriting one.
   */
  measureOnly?: boolean;
};

export type SwapOffer = {
  /** The proven artifact, in the form `terms.form` names. Never balanced, signed or submitted. */
  proven: any;
  /** `Transaction.serialize()` of `proven` — exactly the bytes the envelope carries. */
  bytes: Uint8Array;
  terms: OfferTerms;
  placement: PlacementReport;
  circuitId: 'openSwapShielded';
  /** The coin the circuit claimed as the WANTED coin — the deficit a taker must fund. */
  wantedCoin: { nonce: Uint8Array; color: Uint8Array; value: bigint };
  bearer?: { material: BearerKeyMaterial; keys: any; seed: string };
  /** Wall-clock proving time, for the evidence tables. */
  proveMs: number;
};

/**
 * Manager v4 carries ONE swap circuit and the SHAPE is an argument, not a circuit name (finding
 * F-307: the deploy budget is thirteen provable circuits, so the two shapes had to share one). The
 * named shapes pass `some(recipient)`; the open shape passes `none`.
 */
const CIRCUIT = 'openSwapShielded' as const;

/** `Maybe<Either<ZswapCoinPublicKey, ContractAddress>>`, the argument that selects the shape. */
const maybeRecipient = (coinPk: unknown | null) =>
  coinPk === null
    ? { is_some: false, value: { is_left: true, left: { bytes: new Uint8Array(32) }, right: { bytes: new Uint8Array(32) } } }
    : { is_some: true, value: shieldedToUser(coinPk) };

/**
 * What segment 0 MUST carry, per shape. This is the FR-302 expectation, and it is derived from the
 * circuit's structure rather than read off the artifact:
 *
 *   named-taker / bearer-key   `sendShielded` balances the A leg internally (input, payout, change),
 *                              so the only imbalance is the −B deficit.
 *   floating-surplus           A's value has no output at all, so it stands as a POSITIVE imbalance
 *                              beside the −B deficit. That positive number is the open offer.
 *
 * Both are asserted offline first: `harness/src/test/swap.test.ts` measures the same deltas from the
 * compiled circuit's own zswap inputs and outputs, so a mismatch here means the SDK or the ledger
 * disagrees with the circuit, which is worth failing on loudly.
 */
export const expectedPlacement = (spec: SwapOfferSpec): ImbalanceMap => {
  const wants = { [shieldedLabel(hex(spec.wants.colourRaw))]: String(-spec.wants.value) };
  if (spec.shape !== 'floating-surplus') return wants;
  return { [shieldedLabel(hex(spec.gives.colourRaw))]: String(spec.gives.value), ...wants };
};

export const buildSwapOffer = async (spec: SwapOfferSpec): Promise<SwapOffer> => {
  const circuitId = CIRCUIT;
  const form: OfferForm = spec.form ?? 'pre-binding'; // decision D-306
  const ttlSeconds = Math.min(spec.ttlSeconds ?? TTL_CAP_SECONDS, TTL_CAP_SECONDS);
  const giveHex = hex(spec.gives.colourRaw);
  const wantHex = hex(spec.wants.colourRaw);
  const wantedCoin = {
    nonce: spec.wants.nonce ?? randomBytes(32),
    color: spec.wants.colourRaw,
    value: spec.wants.value,
  };

  let bearer = spec.bearer;
  let recipient = spec.recipient;
  if (spec.shape === 'bearer-key') {
    bearer = bearer ?? mintBearerKey();
    recipient = { coinPublicKey: bearer.keys.coinPublicKey, encryptionPublicKey: bearer.keys.encryptionPublicKey };
  }
  if (spec.shape === 'floating-surplus' && recipient) {
    throw new Error('the floating-surplus shape must have NO recipient — a fixed recipient is what it exists to avoid');
  }
  if (spec.shape !== 'floating-surplus' && !recipient) {
    throw new Error(`the ${spec.shape} shape needs a recipient for colour A`);
  }

  // Paying a shielded coin to ANOTHER party needs that party's encryption public key, or the builder
  // fails with "Unable to resolve encryption public key for recipient". The surplus shape needs none:
  // every output it creates is addressed to the contract itself.
  const args = [
    spec.gives.colourRaw,
    spec.gives.value,
    maybeRecipient(recipient ? recipient.coinPublicKey : null),
    wantedCoin,
    spec.creditAccount,
  ];
  const encMappings = recipient
    ? new Map<unknown, unknown>([[recipient.coinPublicKey, recipient.encryptionPublicKey]])
    : undefined;

  log(
    `maker[${spec.shape}]: building ${circuitId}(give ${spec.gives.value} of ${giveHex.slice(0, 12)}…, ` +
      `want ${spec.wants.value} of ${wantHex.slice(0, 12)}…)`,
  );
  const built: any = await buildCall({
    providers: spec.providers,
    compiledContract: spec.compiledManager,
    contractAddress: spec.managerAddress,
    circuitId,
    args,
    privateStateId: 'manager',
    ...(encMappings ? { encMappings } : {}),
  });

  if (spec.mutateUnproven) spec.mutateUnproven(built.private.unprovenTx);

  log(`maker[${spec.shape}]: proving — the LAST thing the maker does (no balance, no dust, no submit)`);
  const t0 = Date.now();
  const provenUnbound: any = await spec.providers.proofProvider.proveTx(built.private.unprovenTx);
  const proveMs = Date.now() - t0;
  const proven: any = form === 'binding' ? provenUnbound.bind() : provenUnbound;

  const dust = makerAttachedDust(proven);
  if (dust) throw new Error(`FR-301 VIOLATED: the ${spec.shape} maker artifact carries DUST actions`);

  const expected = expectedPlacement(spec);
  const measured = assertPlacement(proven, expected);
  const placement = spec.measureOnly
    ? measured
    : requirePlacement(
        `${spec.shape} offer (${circuitId}, give ${spec.gives.value} ${giveHex.slice(0, 12)}… / want ${spec.wants.value} ${wantHex.slice(0, 12)}…)`,
        measured,
      );

  const bytes: Uint8Array = proven.serialize();
  const createdAt = new Date();
  const terms = makeTerms(
    {
      shape: spec.shape,
      circuitId,
      form,
      managerAddress: spec.managerAddress,
      gives: {
        colour: giveHex,
        value: String(spec.gives.value),
        ...(recipient
          ? { recipient: String(recipient.coinPublicKey), recipientKind: 'user-coin-public-key' as const }
          : {}),
      },
      wants: { colour: wantHex, value: String(spec.wants.value), nonce: hex(wantedCoin.nonce) },
      creditAccount: hex(spec.creditAccount),
      makerAccount: hex(spec.makerAccount),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString(),
      ttlSeconds,
      placement,
      makerAttachedDust: dust,
      ...(bearer ? { bearerKey: bearer.material } : {}),
    },
    bytes,
  );

  log(
    `maker[${spec.shape}]: offer proven in ${proveMs} ms; ${bytes.length} bytes, sha256 ${terms.contentAddress.slice(0, 16)}…; ` +
      `imbalances(0) = ${JSON.stringify(placement.imbalances['0'])}`,
  );
  return { proven, bytes, terms, placement, circuitId, wantedCoin, bearer, proveMs };
};
