// Exact-input loader and fail-closed validator for the G5 ranking report.
// 00006 Plan 06. EXPERIMENTAL_LANE / LANE-DEV-1.
import { basename } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { LANE_STAMP } from '../lane.js';
import { VARIANTS } from './variants.js';
import { e2eVerdict, matrixVerdict, type Verdict } from './verdicts.js';

export type RankingInputPaths = {
  offline: string;
  matrix: string;
  calibration: string;
  u1: string;
  winner: string;
  deployCost: string;
  compileFast: string;
  compileZk: string;
  runStart: string;
  expectedWinner: string;
  winnerCells: number;
};

export type DeployCost = Record<string, { keys: string; bytesWritten: string; pct: string }>;

export type RankingInputs = {
  offline: any;
  liveDoc: any;
  cal: any;
  u1: any;
  winner: any;
  deployCostText: string;
  compileFastText: string;
  compileZkText: string;
};

export type RankingInputResult = Verdict & { inputs?: RankingInputs };

const record = (value: unknown): Record<string, any> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, any>) : null;

const duplicateValues = (values: string[]): string[] =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();

const exactVariantIds = (label: string, values: unknown, expected: string[], errors: string[]) => {
  if (!Array.isArray(values)) {
    errors.push(`${label} is missing or not an array`);
    return;
  }
  const ids = values.map((value) => String(record(value)?.variant ?? ''));
  const dup = duplicateValues(ids.filter(Boolean));
  const missing = expected.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => id && !expected.includes(id));
  if (dup.length) errors.push(`${label} contains duplicate variant(s): ${dup.join(', ')}`);
  if (missing.length) errors.push(`${label} is missing variant(s): ${missing.join(', ')}`);
  if (extra.length) errors.push(`${label} contains unexpected variant(s): ${[...new Set(extra)].join(', ')}`);
};

const readRequired = (label: string, path: string, runStartMs: number, errors: string[]): string | null => {
  try {
    const stat = statSync(path);
    // Filesystems can expose only one-second timestamp precision. A file strictly older by more than
    // that tolerance is from another run and must never satisfy the current gate.
    if (stat.mtimeMs + 1_000 < runStartMs) {
      errors.push(`${label} is stale: mtime ${stat.mtime.toISOString()} precedes run start`);
    }
    return readFileSync(path, 'utf-8');
  } catch (error) {
    errors.push(`${label} is missing or unreadable at ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const parseJson = (label: string, text: string | null, errors: string[]): any | null => {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const validateJsonStamp = (label: string, doc: any, runStartMs: number, errors: string[]) => {
  if (!doc) return;
  if (doc.label !== LANE_STAMP) errors.push(`${label} lane stamp must be '${LANE_STAMP}'`);
  const utcMs = Date.parse(String(doc.utc ?? ''));
  if (!Number.isFinite(utcMs)) errors.push(`${label} has no valid utc timestamp`);
  else if (utcMs < runStartMs) errors.push(`${label} is stale: document utc ${doc.utc} precedes run start`);
};

/** Pull `verifier keys: N, X bytes` and bytesWritten fullness per contract from coster output. */
export const parseDeployCost = (out: string | null): DeployCost => {
  const res: DeployCost = {};
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

const validateDeployCost = (text: string | null, expected: string[], errors: string[]) => {
  if (text === null) return;
  const parsed = parseDeployCost(text);
  const sections = new Map(
    text
      .split(/^## /mu)
      .slice(1)
      .map((section) => {
        const newline = section.indexOf('\n');
        return newline < 0 ? [section.trim(), ''] : [section.slice(0, newline).trim(), section.slice(newline + 1)];
      }),
  );
  const ids = Object.keys(parsed);
  const missing = expected.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !expected.includes(id));
  if (missing.length) errors.push(`deploy cost is missing variant(s): ${missing.join(', ')}`);
  if (extra.length) errors.push(`deploy cost contains unexpected variant(s): ${extra.join(', ')}`);
  for (const id of expected) {
    const row = parsed[id];
    if (!row || !row.keys || !row.bytesWritten || !row.pct) errors.push(`deploy cost for ${id} is incomplete`);
    const section = sections.get(id) ?? '';
    if (!section.includes('normalizeFullness: OK') || !section.includes('=> within every block limit.')) {
      errors.push(`deploy cost for ${id} is not an explicit within-limit success`);
    }
    if (/FAILED|\*\*OVER\*\*|normalizeFullness THREW/u.test(section)) {
      errors.push(`deploy cost for ${id} contains a failure/over-limit marker`);
    }
  }
};

const validateCompileStatus = (
  label: string,
  text: string | null,
  expected: string[],
  kind: 'fast' | 'zk',
  errors: string[],
) => {
  if (text === null) return;
  const rows = text.split('\n').filter(Boolean).map((line) => line.split('\t'));
  const ids = rows.map((row) => row[0] ?? '');
  const dup = duplicateValues(ids.filter(Boolean));
  const missing = expected.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => id && !expected.includes(id));
  if (dup.length) errors.push(`${label} contains duplicate variant(s): ${dup.join(', ')}`);
  if (missing.length) errors.push(`${label} is missing variant(s): ${missing.join(', ')}`);
  if (extra.length) errors.push(`${label} contains unexpected variant(s): ${[...new Set(extra)].join(', ')}`);
  rows.forEach((row, index) => {
    if (row.length !== 4) {
      errors.push(`${label} row ${index + 1} must have four tab-separated fields`);
      return;
    }
    const [id, status, compiledRaw, circuitsRaw] = row;
    const compiled = Number(compiledRaw);
    const circuits = Number(circuitsRaw);
    if (status !== 'COMPILED') errors.push(`${label} ${id} status must be COMPILED`);
    if (!Number.isInteger(circuits) || circuits <= 0) errors.push(`${label} ${id} circuit count must be positive`);
    if (kind === 'fast' && compiled !== 0) errors.push(`${label} ${id} fast compiled-key count must be 0`);
    if (kind === 'zk' && (!Number.isInteger(compiled) || compiled <= 0 || compiled !== circuits)) {
      errors.push(`${label} ${id} ZK compiled-key count must equal its positive circuit count`);
    }
  });
};

/** Load every explicitly selected ranking input and reject missing, stale, malformed, or RED data. */
export const loadRankingInputs = (paths: RankingInputPaths): RankingInputResult => {
  const errors: string[] = [];
  const runStartMs = Date.parse(paths.runStart);
  if (!Number.isFinite(runStartMs)) errors.push(`--run-start must be an ISO timestamp (got ${paths.runStart})`);
  if (!Number.isInteger(paths.winnerCells) || paths.winnerCells < 1) {
    errors.push(`--winner-cells must be a positive integer (got ${paths.winnerCells})`);
  }
  const effectiveStart = Number.isFinite(runStartMs) ? runStartMs : Number.POSITIVE_INFINITY;

  const texts = {
    offline: readRequired('offline sweep', paths.offline, effectiveStart, errors),
    matrix: readRequired('live matrix', paths.matrix, effectiveStart, errors),
    calibration: readRequired('calibration', paths.calibration, effectiveStart, errors),
    u1: readRequired('U1 probe', paths.u1, effectiveStart, errors),
    winner: readRequired('selected winner', paths.winner, effectiveStart, errors),
    deployCost: readRequired('deploy cost', paths.deployCost, effectiveStart, errors),
    compileFast: readRequired('fast compile status', paths.compileFast, effectiveStart, errors),
    compileZk: readRequired('ZK compile status', paths.compileZk, effectiveStart, errors),
  };
  const docs = {
    offline: parseJson('offline sweep', texts.offline, errors),
    matrix: parseJson('live matrix', texts.matrix, errors),
    calibration: parseJson('calibration', texts.calibration, errors),
    u1: parseJson('U1 probe', texts.u1, errors),
    winner: parseJson('selected winner', texts.winner, errors),
  };
  validateJsonStamp('offline sweep', docs.offline, effectiveStart, errors);
  validateJsonStamp('live matrix', docs.matrix, effectiveStart, errors);
  validateJsonStamp('calibration', docs.calibration, effectiveStart, errors);
  validateJsonStamp('U1 probe', docs.u1, effectiveStart, errors);
  validateJsonStamp('selected winner', docs.winner, effectiveStart, errors);

  const variantIds = VARIANTS.map((variant) => variant.id);
  const compileVariantIds = variantIds.filter((id) => id !== 'manager');
  if (docs.offline) {
    exactVariantIds('offline summary', docs.offline.summary, variantIds, errors);
    if (!Array.isArray(docs.offline.points) || docs.offline.points.length === 0) {
      errors.push('offline sweep points are missing or empty');
    }
  }
  if (docs.matrix) errors.push(...matrixVerdict(docs.matrix, variantIds).errors.map((e) => `live matrix: ${e}`));
  if (docs.calibration) {
    if (!['CALIBRATED', 'DIVERGENT', 'NO OVERLAP'].includes(String(docs.calibration.verdict))) {
      errors.push(`calibration verdict is invalid: ${String(docs.calibration.verdict)}`);
    }
    if (!Number.isInteger(docs.calibration.compared) || docs.calibration.compared <= 0) {
      errors.push('calibration compared count must be a positive integer');
    }
    if (!Number.isInteger(docs.calibration.agreed) || docs.calibration.agreed < 0) {
      errors.push('calibration agreed count must be a non-negative integer');
    }
    if (!Array.isArray(docs.calibration.disagreements)) errors.push('calibration disagreements must be an array');
    else if (docs.calibration.agreed + docs.calibration.disagreements.length !== docs.calibration.compared) {
      errors.push('calibration agreed + disagreements must equal compared');
    }
  }
  if (docs.u1) {
    errors.push(
      ...e2eVerdict(docs.u1, { variant: 'manager', cells: 2, requested: ['u1'] }).errors.map(
        (e) => `U1 probe: ${e}`,
      ),
    );
  }
  if (basename(paths.winner) !== `winner-${paths.expectedWinner}-${paths.winnerCells}c.json`) {
    errors.push(
      `selected winner filename must be winner-${paths.expectedWinner}-${paths.winnerCells}c.json (got ${basename(paths.winner)})`,
    );
  }
  if (docs.winner) {
    errors.push(
      ...e2eVerdict(docs.winner, {
        variant: paths.expectedWinner,
        cells: paths.winnerCells,
        requested: ['u1', 'u2'],
      }).errors.map((e) => `selected winner: ${e}`),
    );
  }
  validateDeployCost(texts.deployCost, variantIds, errors);
  validateCompileStatus('fast compile status', texts.compileFast, compileVariantIds, 'fast', errors);
  validateCompileStatus('ZK compile status', texts.compileZk, compileVariantIds, 'zk', errors);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    inputs: {
      offline: docs.offline,
      liveDoc: docs.matrix,
      cal: docs.calibration,
      u1: docs.u1,
      winner: docs.winner,
      deployCostText: texts.deployCost!,
      compileFastText: texts.compileFast!,
      compileZkText: texts.compileZk!,
    },
  };
};
