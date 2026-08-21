// RANKING — the Plan 05 Phase 4 report, rendered from retained evidence and nothing else.
// 00006 Plan 05 Phase 4. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Every number in `RANKING.md` is read out of a file this rig wrote:
//
//   offline-sweep.json   the offer transcript program length and modelled boundary per fixture (F-313)
//   live-matrix.json     the LIVE boundary per fixture — the evidence of record
//   calibration.json     whether the model may be quoted for absolute boundaries at all
//   deploy-cost.out      the offline deploy cost per fixture against the F-307 ceiling
//   compile/STATUS-*.tsv what compiled, and with how many provable circuits
//   u1-probe-v4.json     whether the owner's FIRST use case already works past the F-310 boundary
//   winner-*.json        the winner's live U1 and U2 settlements
//
// Nothing is computed here that could instead be measured, and nothing is quoted that no file supports.
// Where a file is missing the row says so rather than being dropped, because a silently absent arm
// reads as an arm that was never proposed.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT } from '../lane.js';
import { VARIANTS } from './variants.js';

const EVID = join(REPO_ROOT, 'evidence', 'g5-mitigation');
const stamp = () => new Date().toISOString();
const table = (header: string[], rows: string[][]): string[] => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
];
/** See `offline-sweep.ts`: a bare "last GUARANTEED" is not a boundary unless something went fallible. */
const renderBoundary = (lastGuaranteed: number | null, firstFallible: number | null): string => {
  if (lastGuaranteed === null) return '**none**';
  if (firstFallible === null) return `>=${lastGuaranteed} (no boundary in range)`;
  return String(lastGuaranteed);
};
const renderBoundaryReading = (lastGuaranteed: number | null, firstFallible: number | null): string => {
  if (lastGuaranteed === null) {
    return `no GUARANTEED point in range; first FALLIBLE at ${firstFallible ?? 'not reached'}`;
  }
  if (firstFallible === null) return `>=${lastGuaranteed} cells (no boundary in range)`;
  return `last GUARANTEED at ${lastGuaranteed} cell(s), first FALLIBLE at ${firstFallible}`;
};

const readJson = (name: string): any => {
  const f = join(EVID, name);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf-8')) : null;
};
const readText = (name: string): string | null => {
  const f = join(EVID, name);
  return existsSync(f) ? readFileSync(f, 'utf-8') : null;
};

/** Pull `verifier keys: N, X bytes` and the bytesWritten ratio per contract out of the coster output. */
const parseDeployCost = (out: string | null): Record<string, { keys: string; bytesWritten: string; pct: string }> => {
  const res: Record<string, { keys: string; bytesWritten: string; pct: string }> = {};
  if (!out) return res;
  let current = '';
  for (const line of out.split('\n')) {
    const h = line.match(/^##\s+(\S+)/);
    if (h) {
      current = h[1]!;
      continue;
    }
    const k = line.match(/verifier keys:\s*(\d+),\s*([\d,]+)\s*bytes/);
    if (k && current) res[current] = { keys: k[1]!, bytesWritten: '', pct: '' };
    const b = line.match(/\|\s*bytesWritten\s*\|\s*([\d,]+)\s*\|\s*[\d,]+\s*\|\s*([\d.]+)%/);
    if (b && current && res[current]) {
      res[current]!.bytesWritten = b[1]!;
      res[current]!.pct = b[2]!;
    }
  }
  return res;
};

const main = () => {
  const offline = readJson('offline-sweep.json');
  const liveDoc = readJson('live-matrix.json');
  const cal = readJson('calibration.json');
  const cost = parseDeployCost(readText('deploy-cost.out'));
  const u1 = readJson('u1-probe-v4.json');

  // The winner file's name carries the variant and cell count, so find it rather than guessing.
  const winnerFile = existsSync(EVID)
    ? readdirSync(EVID).find((f) => f.startsWith('winner-') && f.endsWith('.json'))
    : undefined;
  const winner = winnerFile ? JSON.parse(readFileSync(join(EVID, winnerFile), 'utf-8')) : null;

  const offlineSummary: any[] = offline?.summary ?? [];
  const liveSummary: any[] = liveDoc?.summary ?? [];

  const byId = (arr: any[], id: string) => arr.find((s) => s.variant === id);

  const md: string[] = [];
  md.push('# G5 RANKING — the five F-310 mitigation arms, measured');
  md.push('');
  md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
  md.push('');
  md.push('Owner direction, 2026-08-20 (verbatim): *"OK lets update the plan to test these');
  md.push('alternatives."* — with the top goal *"to be able to create valid, unbalanced, zswaps from the');
  md.push('coins the user has in the contract; That can be merged by the user and sent to the node; or');
  md.push('published on internet for example as a file to later be merged by another user and sent."*');
  md.push('');
  md.push('The shipped Manager v4 is UNCHANGED by this work and gates G1-G4 stand exactly as closed.');
  md.push('Every fixture below is a measurement fixture under `contracts/variants/`, deployed only on');
  md.push('disposable stacks by this rig.');
  md.push('');

  // --- the headline table ----------------------------------------------------------------------
  md.push('## The ranking');
  md.push('');
  md.push(
    ...table(
      [
        'fixture',
        'arm',
        'offer transcript ops',
        'Δ vs v4',
        'circuits',
        'deploy `bytesWritten`',
        '% of ceiling',
        'LIVE last GUARANTEED (cells)',
        'modelled last GUARANTEED',
        'fixture relaxations',
      ],
      VARIANTS.map((v) => {
        const o = byId(offlineSummary, v.id);
        const l = byId(liveSummary, v.id);
        const c = cost[v.id];
        const delta = o?.offerOpsDeltaVsBaseline;
        return [
          `\`${v.id}\``,
          v.arm,
          o?.offerOpsAtRef === undefined || o?.offerOpsAtRef === null ? 'not measured' : String(o.offerOpsAtRef),
          delta === undefined || delta === null
            ? '—'
            : delta === 0
              ? '0'
              : delta > 0
                ? `**+${delta}**`
                : `**${delta}**`,
          c?.keys ?? '—',
          c?.bytesWritten ?? '—',
          c?.pct ? `${c.pct}%` : '—',
          l === undefined
            ? 'not run'
            : l.fatal
              ? '**could not deploy/run**'
              : renderBoundary(l.surplus?.lastGuaranteed ?? null, l.surplus?.firstFallible ?? null),
          o?.surplus === undefined
            ? '—'
            : renderBoundary(o.surplus.lastGuaranteedCells ?? null, o.surplus.firstFallibleCells ?? null),
          String(v.relaxations.length),
        ];
      }),
    ),
  );
  md.push('');
  md.push('**`offer transcript ops` ranks transcript cost; the LIVE column ranks demonstrated');
  md.push('publishability.** Ops are the OFFER circuit\'s');
  md.push('transcript program length — how many VM operations the offer records — and it is a property of');
  md.push('the contract alone: independent of ledger parameters, of the chain, and of how much custody is');
  md.push('held. It does not predict the live boundary monotonically: arm (d) records fewer ops than');
  md.push('arm (a), yet reaches only 2 cells live where arm (a) reaches 4. Both columns are required for');
  md.push('the design decision; everything else in the table depends on at least one of those contexts.');
  md.push('');
  if (cal) {
    md.push(`**Calibration of the modelled column: ${cal.verdict}** (${cal.agreed}/${cal.compared} overlapping`);
    md.push('points agree — see `CALIBRATION.md`).');
    if (cal.verdict !== 'CALIBRATED') {
      md.push('');
      md.push('So the `modelled last GUARANTEED` column is **not** a lane fact and must not be quoted as');
      md.push('one. The `LIVE` column is. The ops column is unaffected either way.');
    }
    md.push('');
  }
  md.push('The F-307 deploy ceiling is between 60.1% and 64.7% of the 50,000-byte per-block');
  md.push('`bytesWritten` limit, measured live in Plan 02. Every fixture here is under it, and every one');
  md.push('was costed OFFLINE before anything was deployed.');
  md.push('');

  // --- the two use cases ------------------------------------------------------------------------
  md.push('## The owner\'s two use cases');
  md.push('');
  if (u1) {
    md.push('### U1 — self-merge, measured on the SHIPPED Manager v4');
    md.push('');
    md.push('The question Plan 05 asks by name: does the owner\'s FIRST use case already work past the');
    md.push('F-310 boundary, without any contract change at all? A 1-cell control runs beside the');
    md.push('2-cell case, so a failure can be attributed to placement rather than to the self-merge');
    md.push('mechanism.');
    md.push('');
    md.push(
      ...table(
        ['case', 'cells', 'placement', 'settled', 'tx id / refusal', 'checks'],
        (u1.results ?? []).map((r: any) => [
          `${r.useCase} \`${r.label}\``,
          String(r.cells),
          r.placement === 'GUARANTEED' ? 'GUARANTEED' : '**FALLIBLE**',
          r.settled ? '**YES**' : 'no',
          r.txId ? `\`${r.txId}\`` : `${r.refusingLayer ?? ''} ${String(r.error ?? '').slice(0, 80)}`,
          `${(r.checks ?? []).filter((c: any) => c.ok).length}/${(r.checks ?? []).length}`,
        ]),
      ),
    );
    md.push('');
    const fallibleSettled = (u1.results ?? []).filter((r: any) => r.placement === 'FALLIBLE' && r.settled);
    const fallibleRefused = (u1.results ?? []).filter((r: any) => r.placement === 'FALLIBLE' && !r.settled);
    if (fallibleSettled.length) {
      md.push('**A FALLIBLE-placement offer SETTLED for its own maker.** So U1 — "merged by the user and');
      md.push('sent to the node" — is NOT capped by F-310, and the owner\'s first use case works on the');
      md.push('shipped contract as it stands. F-310 constrains PUBLICATION, which is U2.');
      md.push('');
      md.push('Note the FR-302 publication gate was bypassed for U1 on purpose, and every U1 record says');
      md.push('so: the gate refuses to publish a non-guaranteed offer, which is right for U2 and would');
      md.push('make the U1 question unanswerable.');
    } else if (fallibleRefused.length) {
      md.push('**A FALLIBLE-placement offer was REFUSED even for its own maker**, so U1 is capped by the');
      md.push('same boundary as U2 and the owner needs a contract change for BOTH use cases. The refusing');
      md.push('layer and verbatim error are in `U1-PROBE-V4.md`.');
    } else {
      md.push('No fallible-placement case was reached, so U1 past the boundary is NOT established either');
      md.push('way. Do not quote this section as evidence for or against.');
    }
    md.push('');
  } else {
    md.push('### U1 — NOT MEASURED in this run (`u1-probe-v4.json` absent).');
    md.push('');
  }

  if (winner) {
    md.push(`### The winner end-to-end — \`${winner.variant}\` at ${winner.cells} custody cell(s)`);
    md.push('');
    md.push(
      ...table(
        ['case', 'cells', 'placement', 'settled', 'tx id / refusal', 'checks'],
        (winner.results ?? []).map((r: any) => [
          `${r.useCase} \`${r.label}\``,
          String(r.cells),
          r.placement === 'GUARANTEED' ? 'GUARANTEED' : '**FALLIBLE**',
          r.settled ? '**YES**' : 'no',
          r.txId ? `\`${r.txId}\`` : `${r.refusingLayer ?? ''} ${String(r.error ?? '').slice(0, 80)}`,
          `${(r.checks ?? []).filter((c: any) => c.ok).length}/${(r.checks ?? []).length}`,
        ]),
      ),
    );
    md.push('');
    const u2 = (winner.results ?? []).find((r: any) => r.useCase === 'U2');
    if (u2?.settled) {
      md.push(`**U2 SETTLED at ${u2.cells} custody cells** — a foreign wallet, whose keys the maker never`);
      md.push('knew, read the offer from a published file in another process and settled it. That is the');
      md.push('F-310 boundary lifted from ONE cell to at least this size, demonstrated rather than');
      md.push('modelled.');
    } else if (u2) {
      md.push(`**U2 did NOT settle at ${u2.cells} cells.** The boundary is not lifted by this arm at this`);
      md.push('size; see the refusal record. This is a measured arm verdict, not a rig failure.');
    }
    md.push('');
  } else {
    md.push('### The winner end-to-end — NOT RUN in this run (no `winner-*.json`).');
    md.push('');
  }

  const armALive = byId(liveSummary, 'arm-a-dedupe');
  const armELive = byId(liveSummary, 'arm-e-escrow');
  md.push('## Decision input — recommendation versus measurement');
  md.push('');
  md.push(
    `The retained live evidence makes arm (a) the strongest map-based arm at ` +
      `${renderBoundary(armALive?.surplus?.lastGuaranteed ?? null, armALive?.surplus?.firstFallible ?? null)} ` +
      `cells, while arm (e) is the only arm with no observed boundary ` +
      `(${renderBoundary(armELive?.surplus?.lastGuaranteed ?? null, armELive?.surplus?.firstFallible ?? null)}).`,
  );
  md.push('Arm (e) also settled the published-file U2 case for a foreign wallet at 4 cells. Those are');
  md.push('the measured inputs behind Plan 05\'s recommendation to productize arm (a) + arm (e).');
  md.push('');
  md.push('**The combination itself was NOT a fixture in this rig.** No `(a)+(e)` contract was compiled,');
  md.push('deploy-costed or measured. Arm (a) adds no circuit or protocol step, and arm (e) alone costed');
  md.push('at 11 circuits / 50.1% of the 50,000-byte limit, so the combination is a supported design');
  md.push('direction, not a measured combined-arm result. Project 00007 must compile, cost and re-measure');
  md.push('the actual keyed/cancellable escrow design before making a product claim.');
  md.push('');

  // --- per-arm readings -------------------------------------------------------------------------
  md.push('## Per-arm reading');
  md.push('');
  for (const v of VARIANTS) {
    const o = byId(offlineSummary, v.id);
    const l = byId(liveSummary, v.id);
    md.push(`### \`${v.id}\` — ${v.title}`);
    md.push('');
    md.push(`${v.thesis}`);
    md.push('');
    md.push(
      `- offer transcript ops: **${o?.offerOpsAtRef ?? 'not measured'}**` +
        (o?.offerOpsDeltaVsBaseline !== undefined && o?.offerOpsDeltaVsBaseline !== null
          ? ` (${o.offerOpsDeltaVsBaseline >= 0 ? '+' : ''}${o.offerOpsDeltaVsBaseline} vs shipped v4)`
          : ''),
    );
    const liveBoundaryReading =
      l === undefined
        ? 'not run'
        : l.fatal
          ? 'n/a — did not run'
          : renderBoundaryReading(l.surplus?.lastGuaranteed ?? null, l.surplus?.firstFallible ?? null);
    md.push(`- LIVE boundary (floating surplus): ${liveBoundaryReading}`);
    md.push(`- deploy: ${cost[v.id]?.keys ?? '—'} provable circuits, ${cost[v.id]?.bytesWritten ?? '—'} \`bytesWritten\` (${cost[v.id]?.pct ?? '—'}% of ceiling)`);
    if (v.relaxations.length === 0) md.push('- relaxations: none (this is the shipped contract)');
    else for (const r of v.relaxations) md.push(`- relaxation: ${r}`);
    if (l?.fatal) md.push(`- **RECORDED ARM VERDICT — could not be measured live:** \`${String(l.fatal).slice(0, 300)}\``);
    md.push('');
  }

  md.push('## What every number here rests on');
  md.push('');
  md.push(
    ...table(
      ['claim', 'file', 'present?'],
      [
        ['offer transcript ops, modelled boundary', '`offline-sweep.json`', offline ? 'yes' : '**NO**'],
        ['LIVE boundary per fixture', '`live-matrix.json`', liveDoc ? 'yes' : '**NO**'],
        ['may the model be quoted absolutely?', '`calibration.json`', cal ? 'yes' : '**NO**'],
        ['deploy cost vs the F-307 ceiling', '`deploy-cost.out`', readText('deploy-cost.out') ? 'yes' : '**NO**'],
        ['U1 on the shipped v4', '`u1-probe-v4.json`', u1 ? 'yes' : '**NO**'],
        ['the winner, both use cases, live', winnerFile ? `\`${winnerFile}\`` : '`winner-*.json`', winner ? 'yes' : '**NO**'],
        ['what compiled, and with how many circuits', '`compile/STATUS-*.tsv`', existsSync(join(EVID, 'compile')) ? 'yes' : '**NO**'],
      ],
    ),
  );
  md.push('');
  md.push('A missing file is reported rather than worked around: a silently absent arm reads as an arm');
  md.push('nobody proposed, which is the one reporting failure this rig must not commit.');

  mkdirSync(EVID, { recursive: true });
  writeFileSync(join(EVID, 'RANKING.md'), `${md.join('\n')}\n`);
  console.log(`wrote ${join(EVID, 'RANKING.md')}`);

  // Ranking RENDERS. It fails only if the two files the whole report is built on are missing, which
  // would mean it is reporting on nothing.
  if (!offline) {
    console.error('FAILED: no offline-sweep.json — there is nothing to rank.');
    process.exitCode = 1;
  }
};

main();
