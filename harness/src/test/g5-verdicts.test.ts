// Non-vacuous offline regressions for Plan 06's G5 fail-closed verdicts.
import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../lane.js';
import { e2eVerdict, matrixVerdict, parseRequiredUseCases, type G5UseCase } from '../g5/verdicts.js';
import { loadRankingInputs, type RankingInputPaths } from '../g5/ranking-inputs.js';

const EVID = join(REPO_ROOT, 'evidence', 'g5-mitigation');
const RUN_START = '2026-08-21T00:20:41Z';
const VARIANTS = ['manager', 'v4-slim', 'arm-a-dedupe', 'arm-b-nested', 'arm-c-both', 'arm-d-unified', 'arm-e-escrow'];
const readJson = (name: string): any => JSON.parse(readFileSync(join(EVID, name), 'utf-8'));

describe('matrix verdict is fail-closed', () => {
  const valid = () => readJson('live-matrix.json');

  it('accepts the retained run-5 success fixture', () => {
    expect(matrixVerdict(valid(), VARIANTS)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ['missing baseline', (doc: any) => {
      doc.runs = doc.runs.filter((run: any) => run.variant !== 'manager');
      doc.summary = doc.summary.filter((row: any) => row.variant !== 'manager');
    }],
    ['fatal baseline', (doc: any) => { doc.runs.find((run: any) => run.variant === 'manager').fatal = 'apparatus broke'; }],
    ['F-310 contradiction', (doc: any) => { doc.f310Reproduced = false; }],
    ['allBuilt false', (doc: any) => { doc.summary[0].named.allBuilt = false; }],
    ['a deployed point not built', (doc: any) => { doc.runs[0].points[0].built = false; }],
  ] as Array<[string, (doc: any) => void]>)('rejects %s with a RED validator outcome', (_name, mutate) => {
    const doc = valid();
    mutate(doc);
    const verdict = matrixVerdict(doc, VARIANTS);
    expect(verdict.ok).toBe(false);
    expect(verdict.errors.length).toBeGreaterThan(0);
  });
});

describe('end-to-end verdict is fail-closed', () => {
  const u1Expectation = { variant: 'manager', cells: 2, requested: ['u1'] as G5UseCase[] };
  const winnerExpectation = { variant: 'arm-e-escrow', cells: 4, requested: ['u1', 'u2'] as G5UseCase[] };

  it('accepts the retained U1 and selected-winner success fixtures', () => {
    expect(e2eVerdict(readJson('u1-probe-v4.json'), u1Expectation)).toEqual({ ok: true, errors: [] });
    expect(e2eVerdict(readJson('winner-arm-e-escrow-4c.json'), winnerExpectation)).toEqual({ ok: true, errors: [] });
  });

  it.each(['', 'u1,u1', 'u1,unknown'])('rejects an invalid required-case CLI selection %j', (selection) => {
    expect(() => parseRequiredUseCases(selection)).toThrow();
  });

  it.each([
    ['missing case', (doc: any) => { doc.results = doc.results.filter((result: any) => result.label !== 'u2-4cell'); }],
    ['duplicate case', (doc: any) => { doc.results.push(structuredClone(doc.results.find((r: any) => r.label === 'u2-4cell'))); }],
    ['unsettled case', (doc: any) => { doc.results.find((r: any) => r.label === 'u2-4cell').settled = false; }],
    ['apparatus error', (doc: any) => { doc.results.find((r: any) => r.label === 'u2-4cell').apparatusError = 'reader crashed'; }],
    ['failed check', (doc: any) => { doc.results.find((r: any) => r.label === 'u2-4cell').checks[0].ok = false; }],
  ] as Array<[string, (doc: any) => void]>)('rejects a %s with a RED validator outcome', (_name, mutate) => {
    const doc = readJson('winner-arm-e-escrow-4c.json');
    mutate(doc);
    const verdict = e2eVerdict(doc, winnerExpectation);
    expect(verdict.ok).toBe(false);
    expect(verdict.errors.length).toBeGreaterThan(0);
  });
});

describe('ranking requires the exact current-run artifact set', () => {
  const scratch: string[] = [];
  afterEach(() => {
    for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
  });

  const makeInputs = (): RankingInputPaths => {
    const dir = mkdtempSync(join(tmpdir(), 'aa00006-g5-verdicts-'));
    scratch.push(dir);
    mkdirSync(join(dir, 'compile'));
    const copies: Array<[string, string]> = [
      ['offline-sweep.json', 'offline-sweep.json'],
      ['live-matrix.json', 'live-matrix.json'],
      ['calibration.json', 'calibration.json'],
      ['u1-probe-v4.json', 'u1-probe-v4.json'],
      ['winner-arm-e-escrow-4c.json', 'winner-arm-e-escrow-4c.json'],
      ['12-deploy-cost.out', '12-deploy-cost.out'],
      ['compile/STATUS-skip-zk.tsv', 'compile/STATUS-skip-zk.tsv'],
      ['compile/STATUS-zk.tsv', 'compile/STATUS-zk.tsv'],
    ];
    for (const [source, target] of copies) copyFileSync(join(EVID, source), join(dir, target));
    return {
      offline: join(dir, 'offline-sweep.json'),
      matrix: join(dir, 'live-matrix.json'),
      calibration: join(dir, 'calibration.json'),
      u1: join(dir, 'u1-probe-v4.json'),
      winner: join(dir, 'winner-arm-e-escrow-4c.json'),
      deployCost: join(dir, '12-deploy-cost.out'),
      compileFast: join(dir, 'compile', 'STATUS-skip-zk.tsv'),
      compileZk: join(dir, 'compile', 'STATUS-zk.tsv'),
      runStart: RUN_START,
      expectedWinner: 'arm-e-escrow',
      winnerCells: 4,
    };
  };

  it('accepts the exact retained run-5 artifact set', () => {
    const result = loadRankingInputs(makeInputs());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it.each(['offline', 'matrix', 'calibration', 'u1', 'winner', 'deployCost', 'compileFast', 'compileZk'] as const)(
    'rejects a missing %s input independently',
    (key) => {
      const inputs = makeInputs();
      unlinkSync(inputs[key]);
      const result = loadRankingInputs(inputs);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    },
  );

  it.each([
    ['offline', '{}'],
    ['matrix', '{}'],
    ['calibration', '{}'],
    ['u1', '{}'],
    ['winner', '{}'],
    ['deployCost', '## manager\nFAILED'],
    ['compileFast', 'arm-a-dedupe\tFAILED\t0\t9\n'],
    ['compileZk', 'arm-a-dedupe\tCOMPILED\t0\t9\n'],
  ] as Array<[keyof RankingInputPaths, string]>)('rejects a corrupt %s input independently', (key, content) => {
    const inputs = makeInputs();
    writeFileSync(inputs[key] as string, content);
    const result = loadRankingInputs(inputs);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('ignores a stale alternative winner beside the explicitly selected winner', () => {
    const inputs = makeInputs();
    writeFileSync(join(inputs.winner, '..', 'winner-arm-a-dedupe-4c.json'), '{not-json');
    expect(loadRankingInputs(inputs).ok).toBe(true);
  });

  it('rejects a missing selected winner even when an alternative winner exists', () => {
    const inputs = makeInputs();
    copyFileSync(inputs.winner, join(inputs.winner, '..', 'winner-arm-a-dedupe-4c.json'));
    unlinkSync(inputs.winner);
    expect(loadRankingInputs(inputs).ok).toBe(false);
  });

  it('rejects a selected winner whose document predates the wrapper run', () => {
    const inputs = makeInputs();
    const winner = JSON.parse(readFileSync(inputs.winner, 'utf-8'));
    winner.utc = '2026-08-20T23:59:59Z';
    writeFileSync(inputs.winner, `${JSON.stringify(winner)}\n`);
    expect(loadRankingInputs(inputs).ok).toBe(false);
  });

  it('makes the actual ranking process GREEN for exact inputs and non-zero when one is removed', () => {
    const inputs = makeInputs();
    const out = join(inputs.winner, '..', 'RANKING.md');
    const argv = [
      '--import', 'tsx', 'src/g5/ranking.ts',
      '--offline', inputs.offline,
      '--matrix', inputs.matrix,
      '--calibration', inputs.calibration,
      '--u1', inputs.u1,
      '--winner-evidence', inputs.winner,
      '--expected-winner', inputs.expectedWinner,
      '--winner-cells', String(inputs.winnerCells),
      '--deploy-cost', inputs.deployCost,
      '--compile-fast', inputs.compileFast,
      '--compile-zk', inputs.compileZk,
      '--run-start', inputs.runStart,
      '--out', out,
    ];
    const green = spawnSync(process.execPath, argv, { cwd: join(REPO_ROOT, 'harness'), encoding: 'utf-8' });
    expect(green.status, `${green.stdout}\n${green.stderr}`).toBe(0);
    unlinkSync(inputs.matrix);
    const red = spawnSync(process.execPath, argv, { cwd: join(REPO_ROOT, 'harness'), encoding: 'utf-8' });
    expect(red.status).not.toBe(0);
  });
});
