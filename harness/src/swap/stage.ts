// Stage machinery for the swap step ledger: row bookkeeping, the child-process seam, evidence.
// 00006 Plan 03. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Three stages assert three disjoint parts of the spec's ledger (deviation D-307), and the parts they
// share are exactly the parts that must not differ between them: what a row RECORDS, what a refusal
// has to prove, and how the maker and taker processes are started. Sharing them is what makes stage
// A's "PASS" and stage C's "PASS" statements of the same standard.
//
// THE CHILD-PROCESS SEAM. Every maker, taker and direct submission runs as its own OS process,
// started with a JSON file and reporting into a JSON file. Nothing is handed across in memory. That
// is Plan 03's requirement, and it also gives the evidence something an in-process run could not: the
// maker's INPUT is retained verbatim, so "the maker never knew the taker's keys" is checkable rather
// than asserted — for the open shape the input simply has no recipient field.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LANE_STAMP, REPO_ROOT } from '../lane.js';
import { log } from '../night.js';
import type { MakerSpec } from './maker-process.js';
import type { TakerOpts } from './taker-process.js';
import type { DirectSubmitOpts } from './direct-submit-process.js';
import {
  custodyFingerprint,
  custodyUnchanged,
  fundsFingerprint,
  fundsUnchanged,
  op2Problems,
  structuralChecks,
  type SwapObservation,
} from './observe.js';
import { DEVIATION_D307 } from './expected.js';

export const EVIDENCE_DIR = join(REPO_ROOT, 'evidence', 'g3-swap-ledger');
export const OFFERS_DIR = join(EVIDENCE_DIR, 'offers');
export const IO_DIR = join(EVIDENCE_DIR, 'io');
const HARNESS = join(REPO_ROOT, 'harness');

export const stamp = () => new Date().toISOString();
export const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

export type Check = { name: string; ok: boolean; detail: string };
export type RowStatus = 'PENDING' | 'PASS' | 'FAIL' | 'MEASURED' | 'SKIPPED';

export type RowRecord = {
  id: string;
  specRow?: number;
  title: string;
  specAction?: string;
  specExpected?: string;
  asRun?: string;
  status: RowStatus;
  txIds: string[];
  notes: string[];
  verbatim: string[];
  checks: Check[];
  artifacts: Record<string, unknown>;
  before?: SwapObservation;
  after?: SwapObservation;
};

/** One row of the demonstration, accumulating its own evidence. */
export class Row {
  constructor(readonly rec: RowRecord) {}

  check(name: string, ok: boolean, detail = ''): this {
    this.rec.checks.push({ name, ok, detail });
    if (!ok) log(`  CHECK FAILED [${this.rec.id}] ${name} — ${detail}`);
    return this;
  }

  note(s: string): this {
    this.rec.notes.push(s);
    return this;
  }

  tx(id: string | undefined): this {
    if (id) this.rec.txIds.push(id);
    return this;
  }

  verbatim(s: string | undefined): this {
    if (s) this.rec.verbatim.push(s);
    return this;
  }

  artifact(key: string, value: unknown): this {
    this.rec.artifacts[key] = value;
    return this;
  }

  observedBefore(o: SwapObservation): this {
    this.rec.before = o;
    return this;
  }

  observedAfter(o: SwapObservation): this {
    this.rec.after = o;
    return this;
  }

  /** The 00005 structural discipline: invariant, conservation, zero unaccounted keys. */
  structural(o: SwapObservation): this {
    for (const c of structuralChecks(o)) this.check(c.name, c.ok, c.detail);
    return this;
  }

  /** Exact map sizes — the spec's own bookkeeping. */
  sizes(o: SwapObservation, expected: { pools: number; shieldedCells: number; unshieldedCells: number }): this {
    return this.check(
      `exact map sizes ${expected.pools}/${expected.shieldedCells}/${expected.unshieldedCells}`,
      JSON.stringify(o.mapSizes) === JSON.stringify(expected),
      JSON.stringify(o.mapSizes),
    );
  }

  /** One pool, by value or by absence. */
  pool(o: SwapObservation, colour: string, expected: string): this {
    return this.check(
      `pool(${colour}) = ${expected}`,
      (o.pools[colour] ?? 'absent') === expected,
      `observed ${o.pools[colour] ?? 'absent'}`,
    );
  }

  /** One cell, by value or by absence. `absent` and `0` are DIFFERENT claims (FR-202/FR-305). */
  cell(o: SwapObservation, label: string, expected: string): this {
    return this.check(
      `cell ${label} = ${expected}`,
      (o.cells[label] ?? 'absent') === expected,
      `observed ${o.cells[label] ?? 'absent'}`,
    );
  }

  /** One user's holding of one colour, read from a fresh facade (F-104). */
  user(o: SwapObservation, who: string, colour: string, expected: string): this {
    return this.check(
      `${who} holds ${expected} ${colour}`,
      (o.users[who]?.[colour] ?? '(not read)') === expected,
      `observed ${o.users[who]?.[colour] ?? '(not read)'}`,
    );
  }

  /** Both observation points agree on every cell they both reported. */
  op2Agrees(o: SwapObservation): this {
    const problems = op2Problems(o);
    return this.check('OP1 and OP2 agree on every cell', problems.length === 0, problems.join('; ') || 'agree');
  }

  /**
   * The no-state-created proof a refusal owes: the whole ledger snapshot byte-identical, the named
   * cells still ABSENT rather than zero, and — where both observations read the wallets — funds
   * unchanged.
   */
  noStateCreated(before: SwapObservation, after: SwapObservation, absentCells: string[] = []): this {
    this.check(
      'NO state created: the whole custody snapshot is byte-identical',
      custodyUnchanged(before, after),
      custodyUnchanged(before, after)
        ? 'identical (map sizes, pools with coin identity, every cell)'
        : `before ${custodyFingerprint(before)} vs after ${custodyFingerprint(after)}`,
    );
    for (const c of absentCells) {
      this.check(
        `the named cell ${c} is still ABSENT (not zero)`,
        (after.cells[c] ?? 'absent') === 'absent',
        `observed ${after.cells[c] ?? 'absent'}`,
      );
    }
    if (before.usersConsulted && after.usersConsulted) {
      this.check(
        'funds unchanged: every wallet holds exactly what it held',
        fundsUnchanged(before, after),
        fundsUnchanged(before, after) ? fundsFingerprint(after) : `${fundsFingerprint(before)} -> ${fundsFingerprint(after)}`,
      );
    }
    return this;
  }

  /** Finish as an ASSERTED row: PASS only if every check passed. */
  done(): RowRecord {
    this.rec.status = this.rec.checks.every((c) => c.ok) ? 'PASS' : 'FAIL';
    log(`row ${this.rec.id} (${this.rec.title}): ${this.rec.status}`);
    return this.rec;
  }

  /**
   * Finish as a MEASURED row: what happened is the result.
   *
   * FR-311 is explicit that the staleness window is lane behaviour to record rather than a hypothesis
   * to score, and the same applies to the cancellation forms and to P-F310 — a row that measures
   * cannot "fail" by returning an unexpected number, only by being unable to measure. `blocking`
   * checks are the ones that would mean it measured NOTHING.
   */
  measured(blocking: string[] = []): RowRecord {
    const blockingFailed = this.rec.checks.filter((c) => !c.ok && blocking.includes(c.name));
    this.rec.status = blockingFailed.length === 0 ? 'MEASURED' : 'FAIL';
    const departures = this.rec.checks.filter((c) => !c.ok && !blocking.includes(c.name));
    for (const d of departures) this.rec.notes.push(`DEPARTURE from the prediction: ${d.name} — ${d.detail}`);
    log(
      `row ${this.rec.id} (${this.rec.title}): ${this.rec.status}` +
        `${departures.length ? ` with ${departures.length} departure(s) recorded` : ''}`,
    );
    return this.rec;
  }

  skip(why: string): RowRecord {
    this.rec.status = 'SKIPPED';
    this.rec.notes.push(`SKIPPED: ${why}`);
    log(`row ${this.rec.id} (${this.rec.title}): SKIPPED — ${why}`);
    return this.rec;
  }
}

export type StageMeta = {
  stage: 'A' | 'B' | 'C';
  carries: string;
  managerAddress: string;
  accounts: Record<string, string>;
  colours: Record<string, string>;
  minted: Record<string, string>;
};

export class Stage {
  rows: RowRecord[] = [];
  fatal?: string;
  constructor(readonly meta: StageMeta) {}

  row(id: string, title: string, extra: Partial<RowRecord> = {}): Row {
    const rec: RowRecord = {
      id,
      title,
      // PENDING until the row finishes, so a caller that forgets to close a row leaves a visible
      // hole instead of a row that silently reads as skipped.
      status: 'PENDING',
      txIds: [],
      notes: [],
      verbatim: [],
      checks: [],
      artifacts: {},
      ...extra,
    };
    this.rows.push(rec);
    log(`\n=== row ${id} — ${title}`);
    return new Row(rec);
  }

  get failedRows(): RowRecord[] {
    return this.rows.filter((r) => r.status === 'FAIL');
  }

  /** A row left PENDING is a bug in the stage script, and it must not read as green. */
  get unfinishedRows(): RowRecord[] {
    return this.rows.filter((r) => r.status === 'PENDING');
  }

  get verdict(): 'GREEN' | 'RED' {
    return this.failedRows.length === 0 && this.unfinishedRows.length === 0 && !this.fatal ? 'GREEN' : 'RED';
  }

  write(): void {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const payload = {
      ...this.meta,
      lane: LANE_STAMP,
      utc: stamp(),
      deviation: DEVIATION_D307,
      verdict: this.verdict,
      fatal: this.fatal ?? null,
      rowSummary: this.rows.map((r) => ({
        id: r.id,
        specRow: r.specRow ?? null,
        title: r.title,
        status: r.status,
        checks: `${r.checks.filter((c) => c.ok).length}/${r.checks.length}`,
      })),
      rows: this.rows,
    };
    writeFileSync(
      join(EVIDENCE_DIR, `stage-${this.meta.stage.toLowerCase()}.json`),
      `${JSON.stringify(payload, bigints, 2)}\n`,
    );
    writeFileSync(join(EVIDENCE_DIR, `STAGE-${this.meta.stage}.md`), `${renderStage(this).join('\n')}\n`);
    log(`stage ${this.meta.stage}: wrote evidence, verdict ${this.verdict}`);
  }
}

// --- rendering ----------------------------------------------------------------------------------

export const table = (header: string[], rows: string[][]): string[] => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`),
];

const custodyBlock = (o: SwapObservation, what: string): string[] => [
  `**${what}** (${o.utc})`,
  '',
  ...table(
    ['Pool (colour)', 'value', 'pooled coin (nonce / mt_index)'],
    Object.keys(o.pools)
      .sort()
      .map((k) => [
        k,
        o.pools[k] ?? '—',
        o.poolCoins[k] ? `\`${o.poolCoins[k]!.nonce.slice(0, 16)}…\` / ${o.poolCoins[k]!.mtIndex}` : '—',
      ]),
  ),
  '',
  ...table(
    ['Cell (account/colour)', 'OP1 (indexer)', 'OP2 (on-chain call)'],
    Object.keys(o.cells)
      .sort()
      .map((k) => [k, o.cells[k] ?? '—', o.onChainCells[k] ?? '(not consulted)']),
  ),
  '',
  `Map sizes: \`${JSON.stringify(o.mapSizes)}\`; accounts: ${o.accounts.length}.`,
  o.usersConsulted ? `Wallets (fresh facades, F-104): \`${JSON.stringify(o.users)}\`` : 'Wallets: not read at this point.',
  '',
];

export const renderStage = (s: Stage): string[] => {
  const md: string[] = [];
  md.push(`# Swap step ledger — STAGE ${s.meta.stage}`);
  md.push('');
  md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
  md.push('');
  md.push(`**VERDICT: ${s.verdict}**${s.fatal ? ' — fatal, see below' : ''}`);
  md.push('');
  md.push(`**Carries:** ${s.meta.carries}`);
  md.push('');
  md.push(
    `Manager \`${s.meta.managerAddress}\` — a FRESH deployment for this stage, per deviation **D-307**: ` +
      `${DEVIATION_D307.cause}.`,
  );
  md.push('');
  md.push('> This is NOT the spec\'s literal single-Manager 13-row table and is never presented as one.');
  md.push('> What every row asserts IS the spec\'s: the same amounts, the same expected changes.');
  md.push('');
  md.push('## Rows');
  md.push('');
  md.push(
    ...table(
      ['Row', 'What', 'Status', 'Checks'],
      s.rows.map((r) => [
        r.specRow !== undefined ? `**${r.specRow}** \`${r.id}\`` : `\`${r.id}\``,
        r.title,
        r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? '**FAIL**' : r.status,
        `${r.checks.filter((c) => c.ok).length}/${r.checks.length}`,
      ]),
    ),
  );
  md.push('');
  if (s.fatal) {
    md.push('## FATAL');
    md.push('');
    md.push('```');
    md.push(s.fatal);
    md.push('```');
    md.push('');
  }
  for (const r of s.rows) {
    md.push(`## ${r.specRow !== undefined ? `Row ${r.specRow} — ` : ''}${r.title} (\`${r.id}\`) — ${r.status}`);
    md.push('');
    if (r.specAction) md.push(`- **Spec action:** ${r.specAction}`);
    if (r.specExpected) md.push(`- **Spec expects:** ${r.specExpected}`);
    if (r.asRun) md.push(`- **As run (D-307):** ${r.asRun}`);
    if (r.txIds.length) md.push(`- **Transactions:** ${r.txIds.map((t) => `\`${t}\``).join(', ')}`);
    md.push('');
    if (r.notes.length) {
      for (const n of r.notes) md.push(`> ${n}`);
      md.push('');
    }
    if (r.checks.length) {
      md.push(
        ...table(
          ['#', 'Check', 'Result', 'Detail'],
          r.checks.map((c, i) => [String(i + 1), c.name, c.ok ? 'PASS' : '**FAIL**', c.detail || '—']),
        ),
      );
      md.push('');
    }
    if (r.verbatim.length) {
      md.push('**Verbatim (F-202 clean — stack frames stripped):**');
      md.push('');
      for (const v of r.verbatim) {
        md.push('```');
        md.push(v);
        md.push('```');
        md.push('');
      }
    }
    if (r.before) md.push(...custodyBlock(r.before, 'Before'));
    if (r.after) md.push(...custodyBlock(r.after, 'After'));
    if (Object.keys(r.artifacts).length) {
      md.push('<details><summary>Artifacts and process reports</summary>');
      md.push('');
      md.push('```json');
      md.push(JSON.stringify(r.artifacts, bigints, 2));
      md.push('```');
      md.push('');
      md.push('</details>');
      md.push('');
    }
  }
  return md;
};

// --- the child-process seam ---------------------------------------------------------------------

const runChild = (script: string, spec: unknown, ioName: string, outFile: string): any => {
  mkdirSync(IO_DIR, { recursive: true });
  const specFile = join(IO_DIR, `${ioName}.in.json`);
  writeFileSync(specFile, `${JSON.stringify(spec, bigints, 2)}\n`);
  log(`  starting child process: ${script} ${ioName}`);
  const r = spawnSync('npx', ['tsx', script, specFile], {
    cwd: HARNESS,
    encoding: 'utf-8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ''}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''}`;
  writeFileSync(join(IO_DIR, `${ioName}.log`), output);
  for (const line of output.split('\n')) if (line.trim()) console.log(`    | ${line}`);
  if (r.status !== 0) {
    throw new Error(`child ${script} (${ioName}) exited ${String(r.status)} — see evidence io/${ioName}.log`);
  }
  return JSON.parse(readFileSync(outFile, 'utf-8'));
};

/** Build + prove + publish one offer, in its own process, which then exits. */
export const runMaker = (spec: Omit<MakerSpec, 'out'>, ioName: string): any => {
  const out = join(IO_DIR, `${ioName}.report.json`);
  return runChild('src/swap/maker-process.ts', { ...spec, out }, ioName, out);
};

/** Take one offer, in a process that holds nothing but the envelope path and its own seed. */
export const runTaker = (opts: Omit<TakerOpts, 'out'>, ioName: string): any => {
  const out = join(IO_DIR, `${ioName}.report.json`);
  return runChild('src/swap/taker-process.ts', { ...opts, out }, ioName, out);
};

/** Submit an offer ALONE, unbalanced — row 4 / NC-301. */
export const runDirectSubmit = (opts: Omit<DirectSubmitOpts, 'out'>, ioName: string): any => {
  const out = join(IO_DIR, `${ioName}.report.json`);
  return runChild('src/swap/direct-submit-process.ts', { ...opts, out }, ioName, out);
};

/**
 * Read a published envelope in a process with NO NETWORK AT ALL (FR-306).
 *
 * `src/offer/reader.ts` imports no wallet, provider or indexer client, so what it reports is exactly
 * what a holder can establish from the file: the envelope verifies, the transaction deserializes and
 * re-serializes byte-identically, its imbalances match the terms, and it is positively unsubmittable
 * alone.
 */
export const runReader = (envelope: string, ioName: string): any => {
  mkdirSync(IO_DIR, { recursive: true });
  const r = spawnSync('npx', ['tsx', 'src/offer/reader.ts', envelope], {
    cwd: HARNESS,
    encoding: 'utf-8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ''}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''}`;
  writeFileSync(join(IO_DIR, `${ioName}.log`), output);
  if (r.status !== 0) throw new Error(`reader process exited ${String(r.status)} — see evidence io/${ioName}.log`);
  const line = (r.stdout ?? '').trim().split('\n').filter(Boolean).pop() ?? '{}';
  const parsed = JSON.parse(line);
  writeFileSync(join(IO_DIR, `${ioName}.report.json`), `${JSON.stringify(parsed, bigints, 2)}\n`);
  return parsed;
};

/** Flip ONE byte of a published envelope's PAYLOAD, leaving the terms untouched (row 10, arm a). */
export const tamperOneByte = (source: string, dest: string): { offset: number; from: number; to: number } => {
  const buf = Buffer.from(readFileSync(source));
  // Find the payload start: the framing is `magic\n` + `terms-json\n` + raw bytes.
  const firstNl = buf.indexOf(0x0a);
  const secondNl = buf.indexOf(0x0a, firstNl + 1);
  const payloadStart = secondNl + 1;
  const offset = payloadStart + Math.floor((buf.length - payloadStart) / 2);
  const from = buf[offset]!;
  const to = from ^ 0x01;
  buf[offset] = to;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return { offset, from, to };
};

/**
 * Flip one byte AND repair the terms' content address, so the envelope's own tamper check passes.
 *
 * Row 10 asks for a refusal "at deserialize/validate". The content-address check refuses a flipped
 * byte OFFLINE, before any of that — a stronger result, and the one this project actually gets. This
 * arm exists so the layer the spec named is exercised too: with the address repaired, the tampered
 * bytes reach the deserializer and the node.
 */
export const tamperAndRepairAddress = (
  source: string,
  dest: string,
): { offset: number; from: number; to: number; contentAddress: string } => {
  const buf = Buffer.from(readFileSync(source));
  const firstNl = buf.indexOf(0x0a);
  const secondNl = buf.indexOf(0x0a, firstNl + 1);
  const magic = buf.subarray(0, firstNl).toString('utf-8');
  const terms = JSON.parse(buf.subarray(firstNl + 1, secondNl).toString('utf-8'));
  const payload = Buffer.from(buf.subarray(secondNl + 1));
  const offset = Math.floor(payload.length / 2);
  const from = payload[offset]!;
  const to = from ^ 0x01;
  payload[offset] = to;
  const contentAddress = createHash('sha256').update(payload).digest('hex');
  terms.contentAddress = contentAddress;
  const head = Buffer.from(`${magic}\n${JSON.stringify(terms)}\n`, 'utf-8');
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.concat([head, payload]));
  return { offset: secondNl + 1 + offset, from, to, contentAddress };
};
