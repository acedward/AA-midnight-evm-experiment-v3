// Pure fail-closed verdicts for the G5 live measurement programs.
// 00006 Plan 06. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// These functions deliberately know nothing about wallets, Docker, or the chain. The live runners
// write their evidence first and then pass the exact document through the same verdict used by the
// offline corruption suite. A measured FALLIBLE placement is data; missing/contradictory evidence or
// a caught apparatus failure is RED.

export type Verdict = { ok: boolean; errors: string[] };

const record = (value: unknown): Record<string, any> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, any>) : null;

const duplicates = (values: string[]): string[] =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();

const exactIds = (label: string, values: unknown[], expected: string[], errors: string[]) => {
  const ids = values.map((value) => String(record(value)?.variant ?? ''));
  const dup = duplicates(ids.filter(Boolean));
  if (dup.length) errors.push(`${label} contains duplicate variant(s): ${dup.join(', ')}`);
  const missing = expected.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => id && !expected.includes(id));
  if (missing.length) errors.push(`${label} is missing variant(s): ${missing.join(', ')}`);
  if (extra.length) errors.push(`${label} contains unexpected variant(s): ${[...new Set(extra)].join(', ')}`);
};

/** The live matrix is usable only when its baseline anchors F-310 and every deployed point built. */
export const matrixVerdict = (value: unknown, expectedVariants?: string[]): Verdict => {
  const errors: string[] = [];
  const doc = record(value);
  if (!doc) return { ok: false, errors: ['matrix evidence is not an object'] };

  const runs = Array.isArray(doc.runs) ? doc.runs : [];
  const summary = Array.isArray(doc.summary) ? doc.summary : [];
  if (!Array.isArray(doc.runs)) errors.push('matrix runs are missing or not an array');
  if (!Array.isArray(doc.summary)) errors.push('matrix summary is missing or not an array');
  if (expectedVariants) {
    exactIds('matrix runs', runs, expectedVariants, errors);
    exactIds('matrix summary', summary, expectedVariants, errors);
  }

  const baselineRuns = runs.filter((run) => record(run)?.variant === 'manager');
  const baselineSummaries = summary.filter((entry) => record(entry)?.variant === 'manager');
  if (baselineRuns.length !== 1 || baselineSummaries.length !== 1) {
    errors.push(
      `matrix baseline must appear exactly once in runs and summary (runs=${baselineRuns.length}, summary=${baselineSummaries.length})`,
    );
  }
  const baselineRun = record(baselineRuns[0]);
  const baselineSummary = record(baselineSummaries[0]);
  if (baselineRun && baselineRun.fatal !== null && baselineRun.fatal !== undefined) {
    errors.push(`matrix baseline run is fatal: ${String(baselineRun.fatal)}`);
  }
  if (baselineSummary && baselineSummary.fatal !== null && baselineSummary.fatal !== undefined) {
    errors.push(`matrix baseline summary is fatal: ${String(baselineSummary.fatal)}`);
  }
  if (doc.f310Reproduced !== true) errors.push(`matrix f310Reproduced must be true (got ${String(doc.f310Reproduced)})`);

  for (const entryValue of summary) {
    const entry = record(entryValue);
    const id = String(entry?.variant ?? '(unknown)');
    if (record(entry?.named)?.allBuilt !== true) errors.push(`matrix ${id} named allBuilt must be true`);
    if (record(entry?.surplus)?.allBuilt !== true) errors.push(`matrix ${id} surplus allBuilt must be true`);
  }

  for (const runValue of runs) {
    const run = record(runValue);
    if (!run || typeof run.contractAddress !== 'string' || run.contractAddress.length === 0) continue;
    const id = String(run.variant ?? '(unknown)');
    const points = Array.isArray(run.points) ? run.points : [];
    if (points.length === 0) errors.push(`deployed matrix variant ${id} has no points`);
    points.forEach((pointValue, index) => {
      if (record(pointValue)?.built !== true) errors.push(`deployed matrix point ${id}[${index}] built must be true`);
    });
  }

  return { ok: errors.length === 0, errors };
};

export type G5UseCase = 'u1' | 'u2';
export type RequiredE2ECase = { useCase: 'U1' | 'U2'; label: string };

/** Parse the CLI's required cases without accepting aliases, duplicates, or an empty selection. */
export const parseRequiredUseCases = (value: string): G5UseCase[] => {
  const requested = value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (requested.length === 0) throw new Error('at least one required case must be named with --cases');
  const unknown = requested.filter((item) => item !== 'u1' && item !== 'u2');
  if (unknown.length) throw new Error(`unknown required case(s): ${[...new Set(unknown)].join(', ')}`);
  const dup = duplicates(requested);
  if (dup.length) throw new Error(`duplicate required case(s): ${dup.join(', ')}`);
  return requested as G5UseCase[];
};

export const requiredE2ECases = (requested: G5UseCase[], cells: number): RequiredE2ECase[] => {
  if (!Number.isInteger(cells) || cells < 1) throw new Error(`cells must be a positive integer (got ${cells})`);
  const required: RequiredE2ECase[] = [];
  if (requested.includes('u1')) {
    required.push({ useCase: 'U1', label: 'u1-control-1cell' });
    if (cells > 1) required.push({ useCase: 'U1', label: `u1-${cells}cell` });
  }
  if (requested.includes('u2')) required.push({ useCase: 'U2', label: `u2-${cells}cell` });
  return required;
};

export type E2EVerdictExpectation = { variant: string; cells: number; requested: G5UseCase[] };

/** Every CLI-required U1/U2 case must exist exactly once and settle with a clean apparatus/check set. */
export const e2eVerdict = (value: unknown, expected: E2EVerdictExpectation): Verdict => {
  const errors: string[] = [];
  const doc = record(value);
  if (!doc) return { ok: false, errors: ['e2e evidence is not an object'] };

  if (doc.variant !== expected.variant) {
    errors.push(`e2e variant must be ${expected.variant} (got ${String(doc.variant)})`);
  }
  if (doc.cells !== expected.cells) errors.push(`e2e cells must be ${expected.cells} (got ${String(doc.cells)})`);
  if (doc.fatal !== null && doc.fatal !== undefined) errors.push(`e2e run is fatal: ${String(doc.fatal)}`);

  const recordedCases = Array.isArray(doc.cases) ? doc.cases.map(String) : [];
  if (!Array.isArray(doc.cases)) errors.push('e2e cases are missing or not an array');
  if (
    recordedCases.length !== expected.requested.length ||
    recordedCases.some((item, index) => item !== expected.requested[index])
  ) {
    errors.push(`e2e recorded cases must exactly equal ${expected.requested.join(',')} (got ${recordedCases.join(',')})`);
  }

  const results = Array.isArray(doc.results) ? doc.results : [];
  if (!Array.isArray(doc.results)) errors.push('e2e results are missing or not an array');
  const required = requiredE2ECases(expected.requested, expected.cells);
  for (const need of required) {
    const matches = results.filter((result) => {
      const item = record(result);
      return item?.useCase === need.useCase && item?.label === need.label;
    });
    const key = `${need.useCase}/${need.label}`;
    if (matches.length !== 1) {
      errors.push(`required e2e case ${key} must appear exactly once (got ${matches.length})`);
      continue;
    }
    const result = record(matches[0])!;
    if (result.settled !== true) errors.push(`required e2e case ${key} did not settle`);
    if (result.apparatusError !== null && result.apparatusError !== undefined) {
      errors.push(`required e2e case ${key} has apparatus error: ${String(result.apparatusError)}`);
    }
    const checks = Array.isArray(result.checks) ? result.checks : [];
    if (checks.length === 0) errors.push(`required e2e case ${key} has no checks`);
    checks.forEach((checkValue, index) => {
      if (record(checkValue)?.ok !== true) errors.push(`required e2e case ${key} check ${index + 1} failed`);
    });
  }

  return { ok: errors.length === 0, errors };
};

export const printVerdictErrors = (name: string, verdict: Verdict): void => {
  if (verdict.ok) return;
  console.error(`\nFAILED: ${name} verdict is RED:`);
  for (const error of verdict.errors) console.error(`  - ${error}`);
};
