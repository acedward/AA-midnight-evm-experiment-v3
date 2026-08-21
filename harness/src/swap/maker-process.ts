// THE MAKER, as its own OS process. It builds, proves, asserts FR-302, writes the envelope — and EXITS.
// 00006 Plan 03 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Plan 03 asks for the maker and the taker to be SEPARATE PROCESSES, so that FR-306's process
// boundary is real rather than simulated. This is the maker half: it is started with a JSON spec,
// it opens a facade on its OWN seed, and when it exits nothing of the offer survives in memory —
// the taker process that follows has the file and nothing else.
//
// TWO PROPERTIES THIS SHAPE ESTABLISHES that an in-process build could not:
//
//   1. the offer really is an artifact. No wasm object, no provider and no wallet is handed across;
//      the next process reads bytes off disk.
//   2. a maker needs NO wallet state to publish an offer. This process deliberately does NOT wait
//      for its wallet to sync: building and proving a contract call touches the indexer, the proof
//      server and the private-state store, never the maker's own coins. It attaches no DUST and
//      pays no fee, so there is nothing for it to be short of.
//
// A build REFUSAL is a RESULT, not a failure of this process: NC-305 and NC-306 are refusals at the
// circuit's guards, and P-F310 is a refusal at the FR-302 placement assert. So the process writes its
// report and exits 0 in every one of those cases, and the STAGE decides what the refusal means. It
// exits nonzero only when it could not produce a report at all.
//
// Usage: tsx src/swap/maker-process.ts <spec.json>
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as ledger from '@midnightntwrk/ledger-v9';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { LANE_STAMP, SEEDS, type PartyName } from '../lane.js';
import { closeParty, openParty, shieldedSeedOf, unshieldedSeedOf } from '../wallet.js';
import { compiledManager } from '../contracts.js';
import { makeProviders } from '../g3/providers.js';
import { errorChain } from '../g3/actions.js';
import { buildSwapOffer, type SwapOffer } from '../offer/build.js';
import { writeEnvelope } from '../offer/envelope.js';
import { log } from '../night.js';
import type { OfferShape } from '../offer/envelope.js';

export type MakerSpec = {
  /** Human label used in logs and evidence, e.g. `OFFER-1`. */
  label: string;
  managerAddress: string;
  /** Whose owner witness signs the debit. `ownerA` is the maker; anything else is NC-305. */
  witness: PartyName;
  shape: OfferShape;
  gives: { colour: string; value: string };
  wants: { colour: string; value: string };
  creditAccount: string;
  makerAccount: string;
  /**
   * The named taker, by SEED NAME. Only the public keys are derived, in THIS process — the maker
   * learns a coin public key and an encryption key, nothing else. Absent for the open shape, which
   * is the whole point of that shape.
   */
  recipientSeedName?: PartyName;
  ttlSeconds?: number;
  /**
   * Rewrite the intent's `ttl` while the transaction is still UNPROVEN (F-306), so node-side expiry
   * can be observed in minutes instead of the hardcoded hour.
   */
  rewriteIntentTtlSeconds?: number;
  /** Record the FR-302 placement instead of failing closed on it. Never publishes an envelope. */
  measureOnly?: boolean;
  /** Where to write the envelope. Ignored when `measureOnly`. */
  envelopeOut?: string;
  /** Where to write this process's report. */
  out: string;
};

const hexToBytes = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, 'hex'));
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

/** The shielded PUBLIC keys of a seed — derived here, so no wallet is opened for the recipient. */
const shieldedKeysOf = (seed: string) => {
  const keys = (ledger as any).ZswapSecretKeys.fromSeed(shieldedSeedOf(seed));
  return { coinPublicKey: keys.coinPublicKey, encryptionPublicKey: keys.encryptionPublicKey };
};

/**
 * A `mutateUnproven` hook that rewrites every intent's TTL, verified by reading it back.
 *
 * Lifted from Plan 02's spike S5, where it was measured to reach the node (refusal `228`,
 * `IntentTtlExpired`). Comparison is at SECOND granularity because the ledger stores a TTL to the
 * second, and a millisecond-exact comparison reports "not applied" for a rewrite that applied
 * perfectly.
 */
const ttlRewriter = (seconds: number, record: (s: string) => void) => (unproven: any) => {
  const when = new Date(Date.now() + seconds * 1000);
  try {
    const entries: Array<[number, any]> = Array.from((unproven.intents ?? new Map()) as Map<number, any>).map(
      ([k, v]) => [Number(k), v],
    );
    const rebuilt = new Map<number, any>();
    for (const [seg, intent] of entries) {
      intent.ttl = when;
      rebuilt.set(seg, intent);
    }
    try {
      unproven.intents = rebuilt;
    } catch {
      for (const [seg, intent] of rebuilt) unproven.intents.set(seg, intent);
    }
    const sec = (d: unknown) => Math.floor(new Date(d as any).getTime() / 1000);
    const readBack = Array.from((unproven.intents ?? new Map()) as Map<number, any>).map(([, i]) => i?.ttl);
    const took = readBack.length > 0 && readBack.every((t) => sec(t) === sec(when));
    record(
      took
        ? new Date(sec(when) * 1000).toISOString()
        : `NOT APPLIED (read back ${JSON.stringify(readBack.map((t) => new Date(sec(t) * 1000).toISOString()))})`,
    );
  } catch (e) {
    record(`REWRITE FAILED: ${errorChain(e)}`);
  }
};

const main = async () => {
  const specFile = process.argv[2];
  if (!specFile) throw new Error('usage: maker-process.ts <spec.json>');
  const spec = JSON.parse(readFileSync(specFile, 'utf-8')) as MakerSpec;

  const report: Record<string, unknown> = {
    kind: 'maker',
    label: spec.label,
    lane: LANE_STAMP,
    utc: new Date().toISOString(),
    process: { pid: process.pid, ppid: process.ppid },
    // The INPUT is retained verbatim. For the open shape it is the evidence that no taker key was
    // available to the maker at all: `recipientSeedName` is simply absent.
    spec,
  };
  const writeReport = () => {
    mkdirSync(dirname(spec.out), { recursive: true });
    writeFileSync(spec.out, `${JSON.stringify(report, bigints, 2)}\n`);
  };

  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00006-maker-'));
  let party: Awaited<ReturnType<typeof openParty>> | undefined;
  try {
    // No `syncedState` on purpose — see the header. The maker needs its KEYS, not its coins.
    party = await openParty(`Maker-${spec.label}`, SEEDS[spec.witness]);
    const providers = makeProviders(party, 'manager', psDir);
    providers.privateStateProvider.setContractAddress(spec.managerAddress);
    // The debited account is derived from THIS secret inside the circuit, never from an argument —
    // which is what makes NC-305 a refusal at the witness choke point rather than a wrong debit.
    await providers.privateStateProvider.set('manager', { ownerSecret: unshieldedSeedOf(SEEDS[spec.witness]) });

    let intentTtl: string | undefined;
    const offer: SwapOffer = await buildSwapOffer({
      providers,
      compiledManager: compiledManager(),
      managerAddress: spec.managerAddress,
      shape: spec.shape,
      gives: { colourRaw: hexToBytes(spec.gives.colour), value: BigInt(spec.gives.value) },
      wants: { colourRaw: hexToBytes(spec.wants.colour), value: BigInt(spec.wants.value) },
      creditAccount: hexToBytes(spec.creditAccount),
      makerAccount: hexToBytes(spec.makerAccount),
      ...(spec.recipientSeedName ? { recipient: shieldedKeysOf(SEEDS[spec.recipientSeedName]) } : {}),
      ...(spec.ttlSeconds ? { ttlSeconds: spec.ttlSeconds } : {}),
      ...(spec.measureOnly ? { measureOnly: true } : {}),
      ...(spec.rewriteIntentTtlSeconds
        ? { mutateUnproven: ttlRewriter(spec.rewriteIntentTtlSeconds, (s) => (intentTtl = s)) }
        : {}),
    });

    report.ok = true;
    report.terms = offer.terms;
    report.placement = offer.placement;
    report.proveMs = offer.proveMs;
    report.transactionBytes = offer.bytes.length;
    report.contentAddress = offer.terms.contentAddress;
    if (intentTtl) report.intentTtlRewrite = intentTtl;

    if (spec.measureOnly) {
      // A measured offer is NEVER published: FR-302 is fail-closed for anything that goes out, and an
      // offer whose value leg is outside the guaranteed section is unsettleable by any taker.
      report.published = false;
      report.publishedNote =
        'measureOnly — the placement report is the deliverable; the artifact is discarded unpublished';
    } else if (spec.envelopeOut) {
      mkdirSync(dirname(spec.envelopeOut), { recursive: true });
      writeEnvelope(spec.envelopeOut, offer.terms, offer.bytes);
      report.published = true;
      report.envelopeFile = spec.envelopeOut;
      log(`maker[${spec.label}]: published ${spec.envelopeOut}`);
    } else {
      report.published = false;
      report.publishedNote = 'no envelopeOut given';
    }
    writeReport();
    log(`maker[${spec.label}]: DONE — placement ok=${offer.placement.ok}`);
  } catch (e) {
    const err = errorChain(e);
    report.ok = false;
    report.error = err;
    // WHICH refusal this is matters, because the three mean completely different things: a guard
    // refusal is the contract enforcing authorization, an FR-302 refusal is the harness refusing to
    // publish an unsettleable offer, and anything else is a real failure.
    //
    // The guard patterns include the Manager's OWN assert texts, not just the runtime's `failed
    // assert` wrapper: the wrapper's wording is a property of the pinned compact runtime and this
    // classification must not silently become "other" if that wording changes.
    const GUARD =
      /failed assert|assert failed|Assertion|witness matches no registered account|balance too low|is not registered|different colours|positive amount/i;
    report.errorKind = /FR-302 VIOLATED/.test(err)
      ? 'fr302-placement-fail-closed'
      : /FR-301 VIOLATED/.test(err)
        ? 'fr301-dust'
        : GUARD.test(err)
          ? 'circuit-guard-refusal'
          : 'other';
    report.published = false;
    writeReport();
    log(`maker[${spec.label}]: REFUSED (${String(report.errorKind)}) — ${err}`);
  } finally {
    if (party) await closeParty(party);
    try {
      rmSync(psDir, { recursive: true, force: true });
    } catch {
      /* teardown must not mask the result */
    }
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`maker-process FAILED before it could report: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
