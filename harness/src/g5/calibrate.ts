// CALIBRATION — is the offline placement model (F-313) allowed to speak about ABSOLUTE boundaries?
// 00006 Plan 05 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// The offline model computes the ledger's own partition decision, which makes it exact about the thing
// it computes — but only as exact as its INPUTS. Two inputs can differ from the live path: the
// `LedgerParameters` (the live path uses the CHAIN's, fetched from the indexer; the model defaults to
// the ledger crate's) and the contract STATE (a simulator's charged state versus one written by real
// transactions and read back from the indexer).
//
// F-313 records the consequence measured before any of this ran: with `initialParameters()` the model
// put stock Manager v4's boundary at SEVENTEEN cells where the chain puts it at TWO. So the model's
// absolute numbers are not lane facts until this comparison says they are.
//
// THIS FILE IS THE GATE ON THAT CLAIM. It joins the offline sweep and the live matrix on
// (variant, shape, cells) and reports:
//
//   CALIBRATED  every overlapping point agrees. Absolute boundaries from the model may be quoted, and
//               the model may be used to extend the matrix beyond what was measured live.
//   DIVERGENT   at least one overlapping point disagrees. The model may then be quoted ONLY for
//               RELATIVE ordering between arms measured under identical conditions — which is still
//               the ranking's primary evidence, because the arms differ only in the contract.
//   NO OVERLAP  the two runs share no point. Nothing may be concluded either way.
//
// The distinction matters for the RANKING: a DIVERGENT verdict does not weaken "arm (e) reads 53% fewer
// operations than v4" (that is a program-length fact, parameter-independent), but it does forbid
// "arm (e) is publishable up to N cells" from being quoted off the model alone.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT } from '../lane.js';
import { calibrate, type DosePoint, type LiveObservation, type Shape } from './placement-model.js';

const EVID = join(REPO_ROOT, 'evidence', 'g5-mitigation');
const stamp = () => new Date().toISOString();
const table = (header: string[], rows: string[][]): string[] => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
];

const main = () => {
  const offlineFile = join(EVID, 'offline-sweep.json');
  const liveFile = join(EVID, 'live-matrix.json');
  const missing = [offlineFile, liveFile].filter((f) => !existsSync(f));
  if (missing.length) {
    console.error(`cannot calibrate: missing ${missing.join(', ')}`);
    process.exit(1);
  }

  const offlineDoc = JSON.parse(readFileSync(offlineFile, 'utf-8'));
  const liveDoc = JSON.parse(readFileSync(liveFile, 'utf-8'));
  const offline: DosePoint[] = offlineDoc.points ?? [];
  const live: LiveObservation[] = (liveDoc.runs ?? []).flatMap((r: any) =>
    (r.points ?? [])
      .filter((p: any) => p.built)
      .map((p: any) => ({
        variant: p.variant as string,
        shape: p.shape as Shape,
        cells: p.cells as number,
        placement: p.placement as string,
      })),
  );

  const cal = calibrate(offline, live);

  const md: string[] = [];
  md.push('# G5 calibration — may the offline placement model be quoted for ABSOLUTE boundaries?');
  md.push('');
  md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
  md.push('');
  md.push(`Offline sweep parameters: **${offlineDoc.paramsSource ?? '(not recorded)'}**`);
  md.push('');
  md.push(`## VERDICT: ${cal.verdict}`);
  md.push('');
  md.push(`${cal.agreed} of ${cal.compared} overlapping (variant, shape, cells) points agree.`);
  md.push('');
  if (cal.verdict === 'CALIBRATED') {
    md.push('Every point both runs cover agrees, so the offline model reproduces the live partition');
    md.push('decision under these parameters. It may therefore be quoted for absolute boundaries, and');
    md.push('used to extend the matrix past what was measured live — with the caveat that it has only');
    md.push('been checked at the points listed below.');
  } else if (cal.verdict === 'DIVERGENT') {
    md.push('At least one overlapping point disagrees, so **no absolute boundary from the offline model');
    md.push('is a lane fact**. What survives, and is still the ranking\'s primary evidence:');
    md.push('');
    md.push('- the OFFER TRANSCRIPT PROGRAM LENGTH per variant, which is a property of the contract and');
    md.push('  does not depend on parameters or on state at all;');
    md.push('- the RELATIVE ordering of arms measured under identical parameters, identical simulator');
    md.push('  conditions and identical custody growth — the only difference between two such rows is');
    md.push('  the contract;');
    md.push('- every LIVE boundary, which is measured rather than modelled.');
    md.push('');
    md.push('What does NOT survive: any statement of the form "arm X is publishable up to N cells" taken');
    md.push('from the model rather than from the live matrix.');
  } else {
    md.push('The two runs share no (variant, shape, cells) point, so the model is neither confirmed nor');
    md.push('refuted. Nothing may be concluded from this file.');
  }
  md.push('');
  if (cal.disagreements.length) {
    md.push('## Disagreements');
    md.push('');
    md.push(
      ...table(
        ['variant', 'shape', 'cells', 'offline model', 'live chain'],
        cal.disagreements.map((d) => [`\`${d.variant}\``, d.shape, String(d.cells), d.offline, `**${d.live}**`]),
      ),
    );
    md.push('');
    md.push('Two candidate causes, and they are separable by further measurement rather than by argument:');
    md.push('(i) the parameters differ — re-running the sweep with `--params` on the captured');
    md.push('`chain-params.json` removes this one; (ii) the real on-chain contract state is more');
    md.push('expensive to read than the simulator\'s equivalent state, which would show up as the model');
    md.push('being systematically OPTIMISTIC at every point rather than at some.');
    md.push('');
    const optimistic = cal.disagreements.filter((d) => d.offline === 'GUARANTEED' && d.live !== 'GUARANTEED').length;
    const pessimistic = cal.disagreements.filter((d) => d.offline !== 'GUARANTEED' && d.live === 'GUARANTEED').length;
    md.push(
      `Direction of the disagreements: **${optimistic} optimistic** (model says publishable, chain says not) ` +
        `and **${pessimistic} pessimistic**. A purely optimistic set is consistent with cause (ii); a mixed ` +
        'set is not, and would point at something the model is getting wrong structurally.',
    );
    md.push('');
  }
  md.push('## Every compared point');
  md.push('');
  md.push(
    ...table(
      ['variant', 'shape', 'cells', 'offline', 'live', 'agree'],
      live
        .map((o) => {
          const m = offline.find(
            (p) => p.variant === o.variant && p.shape === o.shape && p.observed.cells === o.cells,
          );
          if (!m) return null;
          return [
            `\`${o.variant}\``,
            o.shape,
            String(o.cells),
            m.offer.placement,
            o.placement,
            m.offer.placement === o.placement ? 'yes' : '**NO**',
          ];
        })
        .filter((r): r is string[] => r !== null),
    ),
  );

  mkdirSync(EVID, { recursive: true });
  writeFileSync(
    join(EVID, 'calibration.json'),
    `${JSON.stringify(
      { label: LANE_STAMP, utc: stamp(), offlineParamsSource: offlineDoc.paramsSource ?? null, ...cal },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(EVID, 'CALIBRATION.md'), `${md.join('\n')}\n`);
  console.log(`calibration: ${cal.verdict} (${cal.agreed}/${cal.compared} agree)`);
  for (const d of cal.disagreements) {
    console.log(`   disagree: ${d.variant}/${d.shape}@${d.cells} — offline ${d.offline}, live ${d.live}`);
  }
  console.log(`wrote ${join(EVID, 'CALIBRATION.md')}`);
  // Calibration REPORTS. A divergence is a finding about the model, not a gate failure — the live
  // matrix is the evidence of record either way.
};

main();
