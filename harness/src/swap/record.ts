// The evidence INDEX for the swap step ledger: one page per question, no gaps.
// 00006 Plan 03. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Gate G3 is green only if the evidence index has no gaps, so the index is generated from the three
// stage JSONs rather than written by hand — a row that did not run cannot be described as passing,
// and a row that ran cannot be forgotten. Four pages, because four different readers want four
// different things:
//
//   LEDGER.md      the spec's thirteen rows, each mapped to the stage that ran it and the verdict.
//                  This is the page that answers "was the spec's ledger demonstrated?" — honestly,
//                  including where the answer is "in a restructured form, and here is exactly how".
//   CELLS.md       every row's custody table, in order: pools with coin identity, cells, map sizes.
//   NEGATIVES.md   NC-301..306, P-104, P-CXL, P-OPEN and P-F310 with their verbatim refusals.
//   DEVIATION.md   D-307 in full: why the literal table is unreachable, what was run instead, what
//                  is NOT claimed, and the owner ratification question.
//
// Usage: tsx src/swap/record.ts
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP } from '../lane.js';
import { DEVIATION_D307, NEGATIVE_CONTROLS, SPEC_FINAL_TABLE, SPEC_ROWS } from './expected.js';
import { EVIDENCE_DIR, table } from './stage.js';

type Stored = {
  stage: 'A' | 'B' | 'C';
  utc: string;
  managerAddress: string;
  carries: string;
  colours: Record<string, string>;
  minted: Record<string, string>;
  verdict: 'GREEN' | 'RED';
  fatal: string | null;
  rows: Array<{
    id: string;
    specRow?: number | null;
    title: string;
    status: string;
    txIds: string[];
    notes: string[];
    verbatim: string[];
    checks: Array<{ name: string; ok: boolean; detail: string }>;
    before?: any;
    after?: any;
  }>;
};

const load = (stage: string): Stored | undefined => {
  const f = join(EVIDENCE_DIR, `stage-${stage}.json`);
  if (!existsSync(f)) return undefined;
  return JSON.parse(readFileSync(f, 'utf-8')) as Stored;
};

const main = () => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const stages = ['a', 'b', 'c'].map(load);
  const present = stages.filter((s): s is Stored => Boolean(s));
  const byStage = new Map(present.map((s) => [s.stage, s]));
  const allRows = present.flatMap((s) => s.rows.map((r) => ({ ...r, stage: s.stage })));
  /**
   * Every run row belonging to one spec row.
   *
   * The id prefix is matched as well as `specRow`, because a spec row can need MORE THAN ONE run row:
   * the spec's row 12 names two cancellation mechanisms ("internal transfer / withdraw") that turn out
   * to be genuinely different, so it runs as `row-12a` and `row-12b`. Matching on `specRow` alone left
   * the second one out of this table, which is exactly the kind of gap the index exists to prevent.
   */
  const rowFor = (n: number) =>
    allRows.filter((r) => r.specRow === n || new RegExp(`^row-${n}[a-z]?$`).test(r.id));

  const overall = present.length === 3 && present.every((s) => s.verdict === 'GREEN') ? 'GREEN' : 'RED';
  const stamp = new Date().toISOString();

  // --- LEDGER.md ---------------------------------------------------------------------------------
  const ledger: string[] = [];
  ledger.push('# The swap step ledger — what ran, where, and with what verdict');
  ledger.push('');
  ledger.push(`\`${LANE_STAMP}\` · recorded ${stamp}`);
  ledger.push('');
  ledger.push(`## Overall: **${overall}**`);
  ledger.push('');
  ledger.push(
    '> **Read `DEVIATION.md` first.** The spec\'s step ledger is normative and single-Manager. Finding ' +
      'F-310 makes it unreachable past row 6 at these pins, so the demonstration was PARTITIONED across ' +
      'three fresh Managers on one chain (deviation **D-307**), every row keeping its exact amounts and ' +
      'assertions. This page is that mapping. It is not the spec\'s literal table and is never presented ' +
      'as one.',
  );
  ledger.push('');
  ledger.push(
    ...table(
      ['Stage', 'Manager', 'Carries', 'Verdict', 'Evidence'],
      present.map((s) => [
        `**${s.stage}**`,
        `\`${s.managerAddress.slice(0, 18)}…\``,
        s.carries,
        s.verdict === 'GREEN' ? 'GREEN' : '**RED**',
        `\`stage-${s.stage.toLowerCase()}.json\` / \`STAGE-${s.stage}.md\``,
      ]),
    ),
  );
  ledger.push('');
  for (const st of ['A', 'B', 'C'] as const) {
    if (!byStage.has(st)) ledger.push(`- **Stage ${st}: NOT PRODUCED** — no evidence file. This is a gap.`);
  }
  ledger.push('');
  ledger.push('## The spec\'s thirteen rows');
  ledger.push('');
  ledger.push(
    ...table(
      ['Row', 'Spec action', 'Stage', 'Row id', 'Status', 'Checks'],
      SPEC_ROWS.map((sr) => {
        const runs = rowFor(sr.row);
        return [
          String(sr.row),
          sr.action,
          runs.length ? runs.map((r) => r.stage).join(', ') : `(${sr.stage})`,
          runs.length ? runs.map((r) => `\`${r.id}\``).join(', ') : '—',
          runs.length
            ? runs.map((r) => (r.status === 'FAIL' ? '**FAIL**' : r.status)).join(', ')
            : '**NOT RUN**',
          runs.map((r) => `${r.checks.filter((c) => c.ok).length}/${r.checks.length}`).join(', ') || '—',
        ];
      }),
    ),
  );
  ledger.push('');
  ledger.push('### Where a row was run differently, and why');
  ledger.push('');
  for (const sr of SPEC_ROWS) {
    if (!sr.asRun) continue;
    ledger.push(`- **Row ${sr.row}** — ${sr.asRun}`);
  }
  ledger.push('');
  ledger.push('## Every row that ran, in order');
  ledger.push('');
  ledger.push(
    ...table(
      ['Stage', 'Row id', 'Spec row', 'What', 'Status', 'Checks', 'Transactions'],
      allRows.map((r) => [
        r.stage,
        `\`${r.id}\``,
        r.specRow === undefined || r.specRow === null ? '—' : String(r.specRow),
        r.title,
        r.status === 'FAIL' ? '**FAIL**' : r.status,
        `${r.checks.filter((c) => c.ok).length}/${r.checks.length}`,
        r.txIds.length ? r.txIds.map((t) => `\`${t.slice(0, 16)}…\``).join(' ') : '—',
      ]),
    ),
  );
  ledger.push('');
  const failed = allRows.filter((r) => r.status === 'FAIL');
  if (failed.length) {
    ledger.push('## FAILED rows — read these before quoting anything else');
    ledger.push('');
    for (const r of failed) {
      ledger.push(`### stage ${r.stage} / \`${r.id}\` — ${r.title}`);
      ledger.push('');
      for (const c of r.checks.filter((x) => !x.ok)) ledger.push(`- **FAILED:** ${c.name} — ${c.detail}`);
      ledger.push('');
    }
  } else {
    ledger.push('## FAILED rows');
    ledger.push('');
    ledger.push('None. Every row that ran passed every check it asserted.');
    ledger.push('');
  }
  ledger.push("## The spec's final table");
  ledger.push('');
  ledger.push(SPEC_FINAL_TABLE.note);
  ledger.push('');
  ledger.push(
    ...table(
      ['', 'S_A', 'S_B'],
      SPEC_FINAL_TABLE.rows.map((r) => [r.who, r.S_A, r.S_B]),
    ),
  );
  ledger.push('');
  ledger.push(`End-state map sizes, per the spec: ${SPEC_FINAL_TABLE.endStateMapSizes}.`);
  ledger.push('');
  ledger.push(
    'Stage A asserts the v1-only column (the figures in parentheses) in its `final-table-v1` row, at the ' +
      'moment row 5 lands. Stage B asserts every DELTA of the v2 column plus the exact end-state map sizes ' +
      '1 pool / 2 shielded cells / 0 unshielded. The two S_B TOTALS differ by the +7 that row 5 created on ' +
      'stage A\'s Manager, which is D-307 and nothing else.',
  );
  writeFileSync(join(EVIDENCE_DIR, 'LEDGER.md'), `${ledger.join('\n')}\n`);

  // --- CELLS.md ----------------------------------------------------------------------------------
  const cells: string[] = [];
  cells.push('# Custody after every row — pools, cells, map sizes, both observation points');
  cells.push('');
  cells.push(`\`${LANE_STAMP}\` · recorded ${stamp}`);
  cells.push('');
  cells.push(
    'One row per demonstration row, in run order. `absent` and `0` are DIFFERENT claims: a cell that does ' +
      'not exist is what a no-state-created proof turns on. OP2 is a proved on-chain circuit call and is ' +
      'consulted at the settlement rows and the closing tables; elsewhere the claim is that state did not ' +
      'change, which OP1 establishes by being byte-identical.',
  );
  cells.push('');
  for (const s of present) {
    cells.push(`## Stage ${s.stage} — Manager \`${s.managerAddress}\``);
    cells.push('');
    cells.push(`Colours: ${Object.entries(s.colours).map(([k, v]) => `${k}=\`${v.slice(0, 16)}…\``).join(', ') || '—'}`);
    cells.push(`Minted: ${JSON.stringify(s.minted)}`);
    cells.push('');
    const rowsWithState = s.rows.filter((r) => r.after);
    cells.push(
      ...table(
        ['Row', 'Status', 'Map sizes', 'Pools', 'Cells (OP1)', 'OP2'],
        rowsWithState.map((r) => [
          `\`${r.id}\``,
          r.status === 'FAIL' ? '**FAIL**' : r.status,
          `\`${JSON.stringify(r.after.mapSizes)}\``,
          `\`${JSON.stringify(r.after.pools)}\``,
          `\`${JSON.stringify(r.after.cells)}\``,
          r.after.op2Consulted ? `\`${JSON.stringify(r.after.onChainCells)}\`` : '(not consulted)',
        ]),
      ),
    );
    cells.push('');
    cells.push('Pooled coin identity (a withdraw must change it; an internal transfer must not):');
    cells.push('');
    cells.push(
      ...table(
        ['Row', 'pooled coins'],
        rowsWithState.map((r) => [
          `\`${r.id}\``,
          `\`${JSON.stringify(
            Object.fromEntries(
              Object.entries(r.after.poolCoins ?? {}).map(([k, v]: [string, any]) => [
                k,
                v ? `${String(v.nonce).slice(0, 12)}…/${v.mtIndex}` : null,
              ]),
            ),
          )}\``,
        ]),
      ),
    );
    cells.push('');
  }
  writeFileSync(join(EVIDENCE_DIR, 'CELLS.md'), `${cells.join('\n')}\n`);

  // --- NEGATIVES.md ------------------------------------------------------------------------------
  const negIds: Record<string, string[]> = {
    'NC-301': ['row-4'],
    'NC-302': ['row-6'],
    'NC-303': ['row-9'],
    'NC-304': ['row-10'],
    'NC-305': ['nc-305'],
    'NC-306': ['nc-306'],
    'P-104': ['row-11'],
    'P-CXL': ['row-12a', 'row-12b'],
    'P-OPEN': ['row-7', 'row-8'],
    'P-F310': ['p-f310'],
  };
  const neg: string[] = [];
  neg.push('# Negative controls and probes — verbatim refusals, with the layer that answered');
  neg.push('');
  neg.push(`\`${LANE_STAMP}\` · recorded ${stamp}`);
  neg.push('');
  neg.push(
    'The spec keeps its own checkboxes unticked forever (series convention); this is the product-repo ' +
      'record they refer to.',
  );
  neg.push('');
  neg.push(
    ...table(
      ['Control', 'What it establishes', 'Rows', 'Status'],
      NEGATIVE_CONTROLS.map((nc) => {
        const rows = allRows.filter((r) => (negIds[nc.id] ?? []).includes(r.id));
        return [
          `**${nc.id}**`,
          nc.what,
          rows.map((r) => `${r.stage}/\`${r.id}\``).join(', ') || '—',
          rows.length ? rows.map((r) => (r.status === 'FAIL' ? '**FAIL**' : r.status)).join(', ') : '**NOT RUN**',
        ];
      }),
    ),
  );
  neg.push('');
  for (const nc of NEGATIVE_CONTROLS) {
    const rows = allRows.filter((r) => (negIds[nc.id] ?? []).includes(r.id));
    if (!rows.length) continue;
    neg.push(`## ${nc.id} — ${nc.what}`);
    neg.push('');
    for (const r of rows) {
      neg.push(`### stage ${r.stage} / \`${r.id}\` — ${r.title} — **${r.status}**`);
      neg.push('');
      for (const n of r.notes) neg.push(`> ${n}`);
      if (r.notes.length) neg.push('');
      neg.push(
        ...table(
          ['Check', 'Result', 'Detail'],
          r.checks.map((c) => [c.name, c.ok ? 'PASS' : '**FAIL**', c.detail || '—']),
        ),
      );
      neg.push('');
      if (r.verbatim.length) {
        neg.push('Verbatim (F-202 clean):');
        neg.push('');
        for (const v of r.verbatim) {
          neg.push('```');
          neg.push(v);
          neg.push('```');
          neg.push('');
        }
      }
    }
  }
  writeFileSync(join(EVIDENCE_DIR, 'NEGATIVES.md'), `${neg.join('\n')}\n`);

  // --- DEVIATION.md ------------------------------------------------------------------------------
  const dev: string[] = [];
  dev.push(`# Deviation ${DEVIATION_D307.id} — ${DEVIATION_D307.title}`);
  dev.push('');
  dev.push(`\`${LANE_STAMP}\` · recorded ${stamp}`);
  dev.push('');
  dev.push('## Cause');
  dev.push('');
  dev.push(DEVIATION_D307.cause);
  dev.push('');
  dev.push('## What was preserved');
  dev.push('');
  dev.push(DEVIATION_D307.preserved);
  dev.push('');
  dev.push('## What is NOT claimed');
  dev.push('');
  dev.push(DEVIATION_D307.notClaimed);
  dev.push('');
  dev.push('## Why three stages is the minimum');
  dev.push('');
  dev.push(DEVIATION_D307.minimality);
  dev.push('');
  dev.push('## The evidence FOR the deviation, not just the assertion of it');
  dev.push('');
  const pf = allRows.filter((r) => r.id === 'p-f310');
  if (!pf.length) {
    dev.push('**MISSING** — P-F310 did not run, so the deviation is asserted rather than evidenced. That is a gap.');
  } else {
    for (const r of pf) {
      dev.push(`### stage ${r.stage} / \`${r.id}\` — **${r.status}**`);
      dev.push('');
      for (const n of r.notes) dev.push(`> ${n}`);
      dev.push('');
      dev.push(
        ...table(
          ['Check', 'Result', 'Detail'],
          r.checks.map((c) => [c.name, c.ok ? 'PASS' : '**FAIL**', c.detail || '—']),
        ),
      );
      dev.push('');
      for (const v of r.verbatim) {
        dev.push('```');
        dev.push(v);
        dev.push('```');
        dev.push('');
      }
    }
  }
  dev.push('## Ratification');
  dev.push('');
  dev.push(DEVIATION_D307.ratification);
  dev.push('');
  dev.push(
    'The spec file is byte-identical and its checkboxes are unticked, per the series convention. The option ' +
      'table for the owner is in the plan, not here.',
  );
  writeFileSync(join(EVIDENCE_DIR, 'DEVIATION.md'), `${dev.join('\n')}\n`);

  console.log(`wrote LEDGER.md, CELLS.md, NEGATIVES.md and DEVIATION.md into ${EVIDENCE_DIR}`);
  console.log(`overall: ${overall}`);
  for (const s of present) console.log(`  stage ${s.stage}: ${s.verdict}${s.fatal ? ` (fatal: ${s.fatal.slice(0, 120)})` : ''}`);
  const gaps = ['A', 'B', 'C'].filter((st) => !byStage.has(st as any));
  if (gaps.length) console.log(`  MISSING STAGES: ${gaps.join(', ')}`);
  // The index is a report, not a gate: the wrapper decides the gate from the stage exit codes. It
  // still fails on a MISSING stage, because an index with a hole in it is not an index.
  if (gaps.length) process.exitCode = 1;
};

main();
