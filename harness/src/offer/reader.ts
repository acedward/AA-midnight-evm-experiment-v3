// An offer envelope, read in ANOTHER OS PROCESS with no network at all.
// 00006 Plan 02 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// FR-306 requires the artifact to cross a real process boundary byte-identically, and FR-301's
// "off-chain distributable" claim requires it to be READABLE with nothing but the file. A round-trip
// inside the maker's own process would prove only that a wasm object survives being handed to itself,
// and an offer that needed an indexer to be understood would not be distributable at all.
//
// So this program is started fresh, does not import a wallet, a provider or an indexer client, and
// reports what can be established from the bytes alone: the framing parses, payload identity is
// computed, the transaction form is inferred/deserialized, it re-serializes byte-identically, and
// its imbalances are read without consulting advisory JSON.
//
// Usage: tsx src/offer/reader.ts <envelope-file>
// Emits ONE line of JSON on stdout. Exit 0 means a report was produced, not that it passed.
import { readFileSync } from 'node:fs';
import * as ledger from '@midnightntwrk/ledger-v9';
import { readEnvelope } from './envelope.js';
import { deserializeOfferBytes, readAllImbalances, nonDustDeficits, nonDustSurpluses } from './take.js';

const strip = (raw: string): string =>
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^at\s/.test(l))
    .join(' ')
    .replace(/\s+at\s+\S+(?:\s+\([^)]*\))?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);

const main = () => {
  const file = process.argv[2];
  const report: Record<string, unknown> = {
    process: { pid: process.pid, ppid: process.ppid, network: 'none used' },
    file,
  };
  try {
    if (!file) throw new Error('usage: reader.ts <envelope-file>');
    report.envelopeBytes = readFileSync(file).length;

    const { terms, bytes, payload } = readEnvelope(file);
    report.envelopeFramingParsed = true;
    report.advisoryTerms = terms;
    report.payloadIdentity = payload;
    report.declaredPayloadIdentity = {
      contentAddress: terms.contentAddress,
      transactionBytes: terms.transactionBytes,
      note: 'advisory only; never compared as a gate (A-308)',
    };

    const { tx, form, route } = deserializeOfferBytes(bytes);
    report.deserialized = true;
    report.serializedForm = form;
    report.inferredRoute = route;
    const reserialized: Uint8Array = tx.serialize();
    report.roundTripByteIdentical =
      reserialized.length === bytes.length && Buffer.compare(Buffer.from(reserialized), Buffer.from(bytes)) === 0;

    const imb = readAllImbalances(tx, 'offer (reader process)');
    report.imbalances = imb;
    report.deficits = nonDustDeficits(imb);
    report.surpluses = nonDustSurpluses(imb);
    report.intentSegments = Array.from((tx.intents?.keys?.() ?? []) as Iterable<number>).map(Number);
    report.fallibleOfferSegments = Array.from((tx.fallibleOffer?.keys?.() ?? []) as Iterable<number>).map(Number);

    // The offer must be UNSUBMITTABLE ALONE, and that is established POSITIVELY rather than assumed:
    // `wellFormed` with `enforceBalancing:true` against a blank reference state — the same state shape
    // the pinned facade builds for `validateTransaction` — MUST fail on an unbalanced artifact.
    try {
      const st = (ledger as any).LedgerState.blank('undeployed');
      st.parameters = (ledger as any).LedgerParameters.initialParameters();
      const strictness = new (ledger as any).WellFormedStrictness();
      strictness.enforceBalancing = true;
      strictness.verifySignatures = true;
      strictness.enforceLimits = false;
      tx.wellFormed(st, strictness, new Date());
      report.unsubmittableAlone = { proven: false, note: 'enforceBalancing:true PASSED — the artifact is not unbalanced' };
    } catch (e) {
      report.unsubmittableAlone = { proven: true, error: strip(e instanceof Error ? e.message : String(e)) };
    }
    report.ok = true;
  } catch (e) {
    report.ok = false;
    report.error = strip(e instanceof Error ? e.message : String(e));
  }
  process.stdout.write(`${JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}\n`);
};

main();
