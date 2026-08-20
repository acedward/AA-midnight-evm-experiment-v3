// Shared machinery for the Plan 02 spikes. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Four spikes measure four different things about the same rig, and the parts they share are exactly
// the parts that must not differ between them: how custody is observed (two independent observation
// points, never the submitting wallet), how an offer crosses a process boundary, and how evidence is
// written. Sharing them means S4's "GREEN" and S5's "refused" are statements about the same
// measurements.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT } from '../lane.js';
import { mapSizes, shieldedKeyOf, type ManagerView } from '../manager-view.js';
import { writeEnvelope } from '../offer/envelope.js';
import type { SwapOffer } from '../offer/build.js';
import { bigints, EVIDENCE_DIR, OFFERS_DIR, stamp, type Colour, type SwapRig } from './swap-rig.js';

const HARNESS = join(REPO_ROOT, 'harness');

export type CustodyObservation = {
  mapSizes: Record<string, number>;
  /** colour label -> pooled value ('absent' when the colour is not in the pool map at all). */
  pools: Record<string, string>;
  /** `account/colour` -> cell value ('absent' when the cell does not exist). */
  cells: Record<string, string>;
  /** OP2: the same cells read again through a PROVED ON-CHAIN circuit call. */
  onChainCells: Record<string, string>;
};

/**
 * Observe custody at TWO independent points, per the series rule.
 *
 * OP1 is the Manager's ledger state fetched from the indexer and decoded; OP2 is a real proved
 * on-chain circuit call, `shieldedAccountBalance`. Neither is a wallet that submitted anything
 * (F-104). Absence is reported as `absent` rather than `0`, because "the cell reads zero" and "the
 * cell does not exist" are different claims and the no-state-created proofs depend on the difference.
 */
export const observeCustody = async (
  rig: SwapRig,
  colours: Colour[],
  accounts: Array<{ label: string; id: Uint8Array }>,
): Promise<{ view: ManagerView; observation: CustodyObservation }> => {
  const view = await rig.base.readManagerNow();
  const pools: Record<string, string> = {};
  for (const c of colours) pools[c.label] = view.pools[c.hex] ? String(view.pools[c.hex]!.value) : 'absent';
  const cells: Record<string, string> = {};
  const onChainCells: Record<string, string> = {};
  for (const a of accounts) {
    for (const c of colours) {
      const key = shieldedKeyOf(a.id, c.raw);
      const has = Object.prototype.hasOwnProperty.call(view.shieldedBalances, key);
      cells[`${a.label}/${c.label}`] = has ? String(view.shieldedBalances[key]) : 'absent';
      const onChain = await rig.base.onChainShieldedCell(a.id, c.raw);
      onChainCells[`${a.label}/${c.label}`] = String(onChain.value);
    }
  }
  return { view, observation: { mapSizes: mapSizes(view), pools, cells, onChainCells } };
};

/** Are OP1 and OP2 consistent? A missing cell reads 0 on chain, which is not a disagreement. */
export const observationPointsAgree = (o: CustodyObservation): string[] => {
  const problems: string[] = [];
  for (const [k, v] of Object.entries(o.cells)) {
    const expected = v === 'absent' ? '0' : v;
    if (o.onChainCells[k] !== expected) {
      problems.push(`${k}: OP1 says ${v}, OP2 (on-chain circuit call) says ${o.onChainCells[k]}`);
    }
  }
  return problems;
};

export type ReaderReport = Record<string, any>;

/**
 * Publish an offer as a file and read it back IN ANOTHER PROCESS with no network.
 *
 * The returned path is what the taker is given, so the taker also reads the artifact off disk rather
 * than receiving a live object — the maker/taker seam is a file, as FR-306 requires.
 */
export const publishAndReread = (offer: SwapOffer, name: string): { file: string; reader: ReaderReport } => {
  mkdirSync(OFFERS_DIR, { recursive: true });
  const file = join(OFFERS_DIR, `${name}-${offer.terms.contentAddress.slice(0, 16)}.offer`);
  writeEnvelope(file, offer.terms, offer.bytes);
  const out = execFileSync('npx', ['tsx', 'src/offer/reader.ts', file], {
    cwd: HARNESS,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = out.trim().split('\n').filter(Boolean).pop() ?? '{}';
  return { file, reader: JSON.parse(line) as ReaderReport };
};

/** Every spike writes the same pair: a machine-readable JSON and a human-readable Markdown file. */
export const writeEvidence = (spike: string, payload: unknown, markdown: string[]): void => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, `${spike.toLowerCase()}.json`), `${JSON.stringify(payload, bigints, 2)}\n`);
  writeFileSync(join(EVIDENCE_DIR, `${spike}.md`), `${markdown.join('\n')}\n`);
};

/** The standard fatal-path evidence, so a crashed spike still leaves a usable record. */
export const writeFatal = (spike: string, err: string, partial: unknown): void => {
  writeEvidence(
    spike,
    { spike, label: LANE_STAMP, utc: stamp(), verdict: 'RED', fatal: err, partial },
    [
      `# SPIKE ${spike} — FATAL`,
      '',
      `\`${LANE_STAMP}\` · recorded ${stamp()}`,
      '',
      '**VERDICT: RED (fatal)** — the spike did not complete. Verbatim:',
      '',
      '```',
      err,
      '```',
    ],
  );
};

/**
 * The node's numeric refusal code, if the error carries one.
 *
 * The node reports refusals as `1010: Invalid Transaction: Custom error: NNN`, and NNN is the only
 * part that identifies WHY. Plan 01 decoded two of them from the pinned node source; the rest are
 * recorded as undecoded rather than guessed at, which is the whole reason this returns the raw number
 * alongside any decoding.
 */
export const nodeErrorCode = (error: string | undefined): number | null => {
  const m = /Custom error:\s*(\d+)/.exec(error ?? '');
  return m ? Number(m[1]) : null;
};

const NODE_ERRORS: Record<number, string> = {
  // Decoded from the pinned node source by 00006 Plan 01 spike S2.
  104: 'InvalidError::Transcript (midnight-node/ledger/src/versions/common/types.rs:406)',
  235: 'MalformedZswapErrorCode::InvalidProof (midnight-node/ledger/src/versions/common/types.rs:446)',
};

export const decodeNodeError = (code: number | null): string =>
  code === null ? '(no numeric code in the error)' : (NODE_ERRORS[code] ?? `${code} — NOT DECODED at these pins`);

/** A markdown table from a header row and body rows. */
export const table = (header: string[], rows: string[][]): string[] => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
];

/** Render a custody observation as two comparable tables. */
export const custodyTable = (before: CustodyObservation, after: CustodyObservation): string[] => {
  const keys = [...new Set([...Object.keys(before.cells), ...Object.keys(after.cells)])].sort();
  const poolKeys = [...new Set([...Object.keys(before.pools), ...Object.keys(after.pools)])].sort();
  return [
    ...table(
      ['Pool (colour)', 'before', 'after'],
      poolKeys.map((k) => [k, before.pools[k] ?? '—', after.pools[k] ?? '—']),
    ),
    '',
    ...table(
      ['Cell (account/colour)', 'before (OP1)', 'after (OP1)', 'after (OP2, on-chain call)'],
      keys.map((k) => [k, before.cells[k] ?? '—', after.cells[k] ?? '—', after.onChainCells[k] ?? '—']),
    ),
    '',
    ...table(
      ['Map sizes', 'pools', 'shielded cells', 'unshielded cells'],
      [
        ['before', String(before.mapSizes.pools), String(before.mapSizes.shieldedCells), String(before.mapSizes.unshieldedCells)],
        ['after', String(after.mapSizes.pools), String(after.mapSizes.shieldedCells), String(after.mapSizes.unshieldedCells)],
      ],
    ),
  ];
};
