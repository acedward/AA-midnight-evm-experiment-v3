// THE OFFLINE SWEEP — every variant x custody size x FR-308 shape, with no chain at all.
// 00006 Plan 05 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This is the rig's DESIGN INSTRUMENT, not its evidence of record. It runs the ledger's own
// `partitionTranscripts` against simulator runs of all seven fixtures (see F-313), so it answers "which
// arm reads the least state per offer, and by how much" in seconds instead of stack-hours — which is
// what makes it possible to know, BEFORE spending a live run, whether any arm can plausibly cross the
// boundary.
//
// The honesty rules it enforces on itself:
//
//   * every fixture is measured under IDENTICAL parameters, in an identical simulator, with custody
//     grown identically (same colour, one cell per fresh account, fresh wanted colour every time), so
//     the only difference between two rows is the contract;
//   * the placement verdict comes from the partitioner, never from a cost calculation of our own;
//   * `Transcript.gas` is reported as a PROXY and labelled as one at every point of use — the quantity
//     the partitioner actually compares (`gas_heuristic(params, true, field_size+2)`) is not bound to
//     JS;
//   * if a chain-parameters capture file is present it is USED, and the report says which parameters
//     produced it. `--params <file>` or `G5_PARAMS=<file>`.
//
// Usage:
//   tsx src/g5/offline-sweep.ts [--cells 1,2,4,8,16] [--params evidence/g5-mitigation/chain-params.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT } from '../lane.js';
import { VARIANTS, type VariantSpec } from './variants.js';
import {
  boundaryOf,
  doseResponse,
  initialParams,
  loadParams,
  type DosePoint,
  type Shape,
} from './placement-model.js';

const EVID = join(REPO_ROOT, 'evidence', 'g5-mitigation');
const stamp = () => new Date().toISOString();
const table = (header: string[], rows: string[][]): string[] => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
];
const ms = (pico: string | undefined): string =>
  pico === undefined ? '—' : `${(Number(pico) / 1e9).toFixed(3)}`;

/**
 * "Last GUARANTEED" is only a BOUNDARY if a fallible point was actually found. When the sweep ran out
 * of range while everything was still guaranteed, the honest rendering is `>=N (no boundary in range)`
 * — printing a bare `N` invites a reader to quote the largest size we happened to test as a measured
 * limit, which is the single easiest way for this evidence to be misread.
 */
const renderBoundary = (lastGuaranteed: number | null, firstFallible: number | null): string => {
  if (lastGuaranteed === null) return '**none**';
  if (firstFallible === null) return `>=${lastGuaranteed} (no boundary in range)`;
  return String(lastGuaranteed);
};

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const main = async () => {
  const cells = (arg('--cells') ?? process.env.G5_CELLS ?? '1,2,4,8,16')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const shapes: Shape[] = ['named-taker', 'floating-surplus'];

  const paramsFile = arg('--params') ?? process.env.G5_PARAMS;
  let params: any;
  let paramsSource: string;
  if (paramsFile && existsSync(paramsFile)) {
    params = loadParams(paramsFile);
    paramsSource = `CHAIN parameters captured at ${paramsFile.replace(`${REPO_ROOT}/`, '')}`;
  } else {
    params = initialParams();
    paramsSource =
      'LedgerParameters.initialParameters() — the LEDGER CRATE defaults, NOT the chain. Absolute ' +
      'boundaries from this run are not lane facts (F-313); relative ordering is.';
  }

  console.log(`# G5 OFFLINE SWEEP — ${LANE_STAMP} — ${stamp()}`);
  console.log(`# parameters: ${paramsSource}`);
  console.log(`# cells: ${cells.join(', ')}   shapes: ${shapes.join(', ')}`);

  const all: DosePoint[] = [];
  const failures: Array<{ variant: string; error: string }> = [];

  for (const v of VARIANTS) {
    process.stdout.write(`\n## ${v.id} (${v.arm}) — ${v.title}\n`);
    try {
      const pts = await doseResponse(v, { cells, shapes, params });
      all.push(...pts);
      for (const p of pts) {
        const g = p.offer.guaranteed;
        console.log(
          `   cells=${String(p.observed.cells).padStart(2)} pools=${p.observed.pools} ${p.shape.padEnd(16)} ` +
            `${p.offer.placement.padEnd(10)} ops=${String(p.offer.totalOps).padStart(3)} ` +
            `proxy read=${ms(g?.gas.readTime)}ms compute=${ms(g?.gas.computeTime)}ms` +
            (p.error ? `  ERROR: ${p.error}` : ''),
        );
      }
    } catch (e) {
      const err = e instanceof Error ? `${e.message.split('\n')[0]}` : String(e);
      failures.push({ variant: v.id, error: err });
      console.log(`   COULD NOT BE MEASURED OFFLINE: ${err}`);
    }
  }

  // --- the reading ------------------------------------------------------------------------------
  //
  // Two numbers per arm, and they answer different questions:
  //   BOUNDARY  the largest custody size at which an offer is still guaranteed under these parameters.
  //             Comparable across arms; absolute only if the live matrix agrees (F-313).
  //   OPS       the offer transcript's program length at a FIXED custody size. Parameter-independent,
  //             and the cleanest single measure of "how much state does this circuit read".
  const refCells = cells.includes(2) ? 2 : cells[0]!;
  const opsAt = (variant: string, shape: Shape): number | null => {
    const p = all.find((x) => x.variant === variant && x.shape === shape && x.targetCells === refCells);
    return p ? p.offer.totalOps : null;
  };
  const baselineOps = opsAt('manager', 'floating-surplus');

  const summary = VARIANTS.map((v) => {
    const bn = boundaryOf(all.filter((p) => p.variant === v.id), 'named-taker');
    const bs = boundaryOf(all.filter((p) => p.variant === v.id), 'floating-surplus');
    const ops = opsAt(v.id, 'floating-surplus');
    return {
      variant: v.id,
      arm: v.arm,
      title: v.title,
      offerProtocol: v.offer,
      layout: v.layout,
      named: bn,
      surplus: bs,
      offerOpsAtRef: ops,
      offerOpsDeltaVsBaseline: ops !== null && baselineOps !== null ? ops - baselineOps : null,
      relaxations: v.relaxations,
      measured: all.some((p) => p.variant === v.id),
    };
  });

  const md: string[] = [];
  md.push('# G5 offline sweep — the F-310 placement decision computed with no chain (F-313)');
  md.push('');
  md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
  md.push('');
  md.push('## What this is, and what it is not');
  md.push('');
  md.push('`partitionTranscripts` — the ledger function that decides which half of a transcript is');
  md.push('GUARANTEED, and therefore the function F-308 and F-310 are both about — is bound to JS in the');
  md.push('pinned `@midnightntwrk/ledger-v9`. Feeding it a simulator run the way the pinned SDK feeds it');
  md.push('(`@midnight-ntwrk/compact-js` → `ContractExecutable.js::partitionAllTranscripts`) computes the');
  md.push('same decision offline, in milliseconds. That is finding **F-313**.');
  md.push('');
  md.push(`**Parameters used: ${paramsSource}**`);
  md.push('');
  md.push('This sweep is a DESIGN AND RANKING instrument. Every fixture is measured under identical');
  md.push('parameters in an identical simulator with custody grown identically, so a difference between');
  md.push('two rows is a difference between two CONTRACTS. Absolute boundaries are only lane facts where');
  md.push('the LIVE matrix agrees; that comparison is `CALIBRATION.md`.');
  md.push('');
  md.push('## Per-arm summary');
  md.push('');
  md.push(
    ...table(
      [
        'variant',
        'arm',
        'layout',
        'offer',
        'offer ops @ ' + refCells + ' cells',
        'Δ ops vs v4',
        'last GUARANTEED (named)',
        'last GUARANTEED (surplus)',
        'monotone',
      ],
      summary.map((s) => [
        `\`${s.variant}\``,
        s.arm,
        s.layout,
        s.offerProtocol,
        s.offerOpsAtRef === null ? '—' : String(s.offerOpsAtRef),
        s.offerOpsDeltaVsBaseline === null
          ? '—'
          : s.offerOpsDeltaVsBaseline === 0
            ? '0'
            : s.offerOpsDeltaVsBaseline > 0
              ? `+${s.offerOpsDeltaVsBaseline}`
              : String(s.offerOpsDeltaVsBaseline),
        renderBoundary(s.named.lastGuaranteedCells, s.named.firstFallibleCells),
        renderBoundary(s.surplus.lastGuaranteedCells, s.surplus.firstFallibleCells),
        s.named.monotone && s.surplus.monotone ? 'yes' : '**NO**',
      ]),
    ),
  );
  md.push('');
  md.push('`offer ops` is the OFFER transcript program length — the number of VM operations the offer');
  md.push('circuit records. It is parameter-independent, so it is the one number in this table that is a');
  md.push('property of the contract alone. For arm (e) it is the `openSwap` circuit only; its');
  md.push('self-balanced `stageOffer` and `consolidate` phases are tabulated separately below, because');
  md.push('they are not offers and F-310 does not constrain them.');
  md.push('');
  md.push('## The full dose-response');
  md.push('');
  md.push(
    ...table(
      ['variant', 'cells', 'pools', 'shape', 'placement', 'offer ops', 'proxy read ms', 'proxy compute ms', 'note'],
      all.map((p) => [
        `\`${p.variant}\``,
        String(p.observed.cells),
        String(p.observed.pools),
        p.shape,
        p.offer.placement === 'GUARANTEED' ? 'GUARANTEED' : `**${p.offer.placement}**`,
        String(p.offer.totalOps),
        ms(p.offer.guaranteed?.gas.readTime ?? p.offer.fallible?.gas.readTime),
        ms(p.offer.guaranteed?.gas.computeTime ?? p.offer.fallible?.gas.computeTime),
        p.error ? `ERROR: ${p.error}` : '—',
      ]),
    ),
  );
  md.push('');
  md.push('`proxy read/compute ms` is `Transcript.gas`, which the ledger sets to');
  md.push('`gas_heuristic(params, false, 0)` = raw transcript gas x 1.2. It is **not** the quantity the');
  md.push('partitioner compares against the budget (that is `gas_heuristic(params, true,');
  md.push('program.field_size()+2)`, which is not bound to JS), so it is a proxy and is labelled as one');
  md.push('everywhere it appears. The PLACEMENT column is the partitioner own verdict and is exact.');
  md.push('');

  const staged = all.filter((p) => p.stagePhase || p.consolidatePhase);
  if (staged.length) {
    md.push('## Arm (e): the self-balanced phases, measured');
    md.push('');
    md.push('These are NOT offers. `stageOffer` and `consolidate` are ordinary self-balanced custody');
    md.push('transactions the maker submits itself, so their placement does not constrain publishability —');
    md.push('the arm rests on exactly that claim, so the numbers are recorded rather than assumed.');
    md.push('');
    md.push(
      ...table(
        ['cells', 'shape', 'stageOffer placement', 'stage ops', 'openSwap placement', 'openSwap ops', 'consolidate placement', 'consolidate ops'],
        staged.map((p) => [
          String(p.observed.cells),
          p.shape,
          p.stagePhase?.placement ?? '—',
          String(p.stagePhase?.totalOps ?? '—'),
          p.offer.placement,
          String(p.offer.totalOps),
          p.consolidatePhase?.placement ?? '—',
          String(p.consolidatePhase?.totalOps ?? '—'),
        ]),
      ),
    );
    md.push('');
  }

  if (failures.length) {
    md.push('## Fixtures that could not be measured offline');
    md.push('');
    md.push(...table(['variant', 'verbatim'], failures.map((f) => [`\`${f.variant}\``, `\`${f.error}\``])));
    md.push('');
    md.push('An arm that cannot be measured is a RECORDED ARM VERDICT, not a rig failure (gate G5).');
    md.push('');
  }

  md.push('## Relaxations, per fixture');
  md.push('');
  for (const s of summary) {
    md.push(`- **\`${s.variant}\`** (${s.arm}) — ${s.title}`);
    if (s.relaxations.length === 0) md.push('  - none: this is the shipped contract, unchanged.');
    for (const r of s.relaxations) md.push(`  - ${r}`);
  }

  mkdirSync(EVID, { recursive: true });
  writeFileSync(
    join(EVID, 'offline-sweep.json'),
    `${JSON.stringify(
      {
        label: LANE_STAMP,
        utc: stamp(),
        question:
          'per contract variant, at what custody size does an offer stop being placed in the ' +
          'GUARANTEED section, and how many transcript operations does its offer circuit take?',
        paramsSource,
        paramsFile: paramsFile ?? null,
        cells,
        shapes,
        referenceCells: refCells,
        summary,
        points: all,
        failures,
        instrument: {
          finding: 'F-313',
          fn: 'partitionTranscripts (ledger-v9, bound to JS)',
          fedAs: '@midnight-ntwrk/compact-js ContractExecutable.js::partitionAllTranscripts',
          proxyCaveat:
            'Transcript.gas = gas_heuristic(params, false, 0) = raw transcript gas x 1.2; the ' +
            'partitioner compares gas_heuristic(params, true, field_size+2), which is not bound to JS.',
        },
      },
      (_k, v) => (typeof v === 'bigint' ? String(v) : v),
      2,
    )}\n`,
  );
  writeFileSync(join(EVID, 'OFFLINE-SWEEP.md'), `${md.join('\n')}\n`);
  console.log(`\nwrote ${join(EVID, 'offline-sweep.json')} and OFFLINE-SWEEP.md`);

  // The sweep MEASURES. It is red only if it could not measure the baseline or the control, which
  // would mean the instrument itself is broken rather than an arm being bad.
  const mustMeasure = ['manager', 'v4-slim'];
  const missing = mustMeasure.filter((id) => !all.some((p) => p.variant === id));
  if (missing.length) {
    console.error(`\nFAILED: no offline measurement for ${missing.join(', ')} — the instrument is broken.`);
    process.exitCode = 1;
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
