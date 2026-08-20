// SPIKE S3, the OTHER SIDE OF THE PROCESS BOUNDARY. Plan 01 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This file exists to be a DIFFERENT OS PROCESS. FR-306 requires the offer artifact to round-trip a
// real process boundary byte-identically, and a round-trip inside one Node process would prove only
// that a wasm object survives being handed to itself. So the maker writes bytes to a file and this
// program — started from scratch, with no shared heap, no shared wasm instance and NO NETWORK AT ALL —
// reads them back and reports what it can establish from the bytes alone.
//
// Deliberately offline: an "off-chain distributable offer" that needed an indexer to be readable
// would not be off-chain distributable. Everything here comes from `@midnightntwrk/ledger-v9` plus
// the file.
//
// Usage: tsx src/g1/spike-s3-reader.ts <file> <markerB: pre-binding|binding> <expectedSha256>
// Emits ONE line of JSON on stdout. Exit code 0 means the report was produced, not that it passed.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as ledger from '@midnightntwrk/ledger-v9';

const NETWORK_ID = 'undeployed';

const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

const tokenLabel = (t: any): string =>
  t?.tag === 'dust' ? 'dust' : `${t?.tag ?? 'unknown'}:${String(t?.raw ?? '').toLowerCase()}`;

const imbalancesFor = (tx: any, segment: number): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [token, delta] of tx.imbalances(segment) as Map<unknown, bigint>) out[tokenLabel(token)] = String(delta);
  return out;
};

/**
 * The transaction's segment ids. `Transaction::segments()` exists in Rust
 * (`midnight-ledger/ledger/src/structure.rs:1817`) but IS NOT BOUND TO JS at these pins (finding
 * F-304), so it is recomputed here from the two maps that are bound — the same union the Rust does:
 * `{0} ∪ intents.keys() ∪ fallible_coins.keys()`.
 */
const segmentsOf = (tx: any): number[] => {
  const set = new Set<number>([0]);
  for (const k of ((tx.intents?.keys?.() ?? []) as Iterable<number>)) set.add(Number(k));
  for (const k of ((tx.fallibleOffer?.keys?.() ?? []) as Iterable<number>)) set.add(Number(k));
  return [...set].sort((a, b) => a - b);
};

/** Every `wellFormed` variant worth trying on an UNBALANCED third-party artifact. */
const STRICTNESS_CASES: Array<{ name: string; flags: Record<string, boolean> }> = [
  {
    // What the pinned facade's own `validateTransaction` can express. Its docstring states the
    // proof-verification flags are deliberately omitted because they "require the complete ledger
    // state" — which a taker holding only an offer file does not have.
    name: 'facade-equivalent (enforceBalancing:false, verifySignatures:true, enforceLimits:false)',
    flags: { enforceBalancing: false, verifySignatures: true, enforceLimits: false },
  },
  {
    name: 'plan-01 S3 flags (+verifyContractProofs, +verifyNativeProofs)',
    flags: {
      enforceBalancing: false,
      verifySignatures: true,
      verifyContractProofs: true,
      verifyNativeProofs: true,
      enforceLimits: false,
    },
  },
  {
    // The control: an UNBALANCED offer must FAIL this one, or "unsubmittable alone" is not a claim
    // the artifact supports.
    name: 'CONTROL enforceBalancing:true (an unbalanced offer MUST fail this)',
    flags: { enforceBalancing: true, verifySignatures: true, enforceLimits: false },
  },
];

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
  const [file, markerB, expectedSha] = process.argv.slice(2);
  const report: Record<string, unknown> = {
    process: { pid: process.pid, ppid: process.ppid, argv: process.argv.slice(1), network: 'none used' },
    file,
    markerB,
  };
  try {
    if (!file || !markerB) throw new Error('usage: spike-s3-reader.ts <file> <pre-binding|binding> [expectedSha256]');
    const raw = new Uint8Array(readFileSync(file));
    const readSha = sha256(raw);
    report.bytesRead = raw.length;
    report.sha256OfFile = readSha;
    report.expectedSha256 = expectedSha ?? null;
    report.shaMatchesMaker = expectedSha ? readSha === expectedSha : null;

    const tx: any = (ledger as any).Transaction.deserialize('signature', 'proof', markerB, raw);
    report.deserialized = true;

    const reserialized: Uint8Array = tx.serialize();
    report.bytesReserialized = reserialized.length;
    report.sha256OfReserialized = sha256(reserialized);
    report.roundTripByteIdentical =
      reserialized.length === raw.length && Buffer.compare(Buffer.from(reserialized), Buffer.from(raw)) === 0;

    const segments: number[] = segmentsOf(tx);
    report.segments = segments;
    report.segmentsAccessorBound = typeof tx.segments === 'function';
    report.intentSegments = Array.from((tx.intents?.keys?.() ?? []) as Iterable<number>).map(Number);
    report.fallibleOfferSegments = Array.from((tx.fallibleOffer?.keys?.() ?? []) as Iterable<number>).map(Number);
    const imb: Record<string, Record<string, string>> = {};
    for (const s of segments) {
      try {
        imb[String(s)] = imbalancesFor(tx, s);
      } catch (e) {
        imb[String(s)] = { '<unreadable>': strip(e instanceof Error ? e.message : String(e)) };
      }
    }
    report.imbalances = imb;
    try {
      report.transactionHash = String(tx.transactionHash());
    } catch (e) {
      report.transactionHash = `unavailable: ${strip(e instanceof Error ? e.message : String(e))}`;
    }
    try {
      report.identifiers = Array.from(tx.identifiers() as Iterable<string>).map(String);
    } catch (e) {
      report.identifiers = `unavailable: ${strip(e instanceof Error ? e.message : String(e))}`;
    }
    try {
      report.feesSpecks = String(tx.fees((ledger as any).LedgerParameters.initialParameters()));
    } catch (e) {
      report.feesSpecks = `unavailable: ${strip(e instanceof Error ? e.message : String(e))}`;
    }

    // wellFormed against a BLANK reference state carrying the initial ledger parameters — exactly the
    // state shape the pinned facade builds for `validateTransaction`
    // (`wallet-sdk-capabilities/dist/validation/validationService.js:28-31`).
    const wf: Array<Record<string, unknown>> = [];
    for (const c of STRICTNESS_CASES) {
      const st = (ledger as any).LedgerState.blank(NETWORK_ID);
      st.parameters = (ledger as any).LedgerParameters.initialParameters();
      const strictness = new (ledger as any).WellFormedStrictness();
      for (const [k, v] of Object.entries(c.flags)) (strictness as any)[k] = v;
      const effective = {
        enforceBalancing: strictness.enforceBalancing,
        verifySignatures: strictness.verifySignatures,
        verifyContractProofs: strictness.verifyContractProofs,
        verifyNativeProofs: strictness.verifyNativeProofs,
        enforceLimits: strictness.enforceLimits,
      };
      try {
        tx.wellFormed(st, strictness, new Date());
        wf.push({ case: c.name, requested: c.flags, effective, passed: true });
      } catch (e) {
        wf.push({
          case: c.name,
          requested: c.flags,
          effective,
          passed: false,
          error: strip(e instanceof Error ? e.message : String(e)),
        });
      }
    }
    report.wellFormed = wf;
    report.ok = true;
  } catch (e) {
    report.ok = false;
    report.error = strip(e instanceof Error ? e.message : String(e));
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
};

main();
