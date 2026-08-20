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
import { log } from '../night.js';
import { nodeRefusalOf } from '../node-error.js';
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
  /**
   * How many times an OP2 read had to be retried because the node answered `Custom error: 104`.
   *
   * Recorded rather than hidden: it is a measurement of the lane, and a run where OP2 needed several
   * attempts is a run whose timing was tight.
   */
  op2Retries: Record<string, number>;
  /** Whether OP2 was consulted at all for this observation. Recorded so no reader has to assume. */
  op2Consulted: boolean;
};

/** OP2 unavailability marker. Distinct from any value, so it can never be mistaken for a balance. */
export const OP2_UNAVAILABLE = 'unavailable';

/**
 * ONE OP2 read, retried on `Custom error: 104` only.
 *
 * WHY THIS RETRY EXISTS, and why it is not papering over a result. OP2 is a real proved circuit call —
 * a submitted TRANSACTION — and a contract call submitted shortly after another call on the same
 * contract is refused with 104 on this lane. That is exactly finding F-301 / issue 0001's signature
 * ("first attempt refused, identical retry sometimes accepted"), and the S5 pilot hit it: the spike
 * DIED because its own observation of a successful settlement was refused.
 *
 * A 104 on a READ-ONLY observation says nothing about the thing under test. Letting it kill a spike
 * would be recording a measurement failure as a product failure — precisely the confusion this series
 * exists to avoid. So it is retried, bounded, with the count kept; and if every attempt fails the cell
 * is marked UNAVAILABLE rather than guessed at, leaving OP1 to carry the observation and the gap
 * visible in the evidence.
 */
const op2Read = async (
  rig: SwapRig,
  account: Uint8Array,
  colour: Uint8Array,
  label: string,
): Promise<{ value: string; retries: number }> => {
  const maxAttempts = 4;
  let lastErr = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await rig.base.onChainShieldedCell(account, colour);
      return { value: String(r.value), retries: attempt - 1 };
    } catch (e) {
      const refusal = nodeRefusalOf(e);
      lastErr = refusal.verbatim ?? String(e).slice(0, 200);
      if (refusal.code !== 104 || attempt === maxAttempts) {
        if (refusal.code !== 104) throw e; // not the known flake — a real failure, surfaced
        break;
      }
      log(`OP2 ${label}: refused with Custom error: 104 (attempt ${attempt}/${maxAttempts}) — the F-301 flake; retrying in 8s`);
      await new Promise((r) => setTimeout(r, 8_000));
    }
  }
  log(`OP2 ${label}: UNAVAILABLE after ${maxAttempts} attempts (last: ${lastErr}); OP1 carries this observation`);
  return { value: OP2_UNAVAILABLE, retries: maxAttempts };
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
  /**
   * `op2: false` takes an OP1-ONLY snapshot.
   *
   * OP2 is a real proved circuit call — a submitted TRANSACTION, ~15 s each — so a spike that
   * snapshots often pays for it in wall-clock and in exposure to the F-301 flake. A spike whose claim
   * is NOT about custody (S5 measures staleness) gains nothing from corroborating balances it is not
   * asserting, and every unnecessary transaction it submits is another chance to record a measurement
   * failure as a result. Spikes that DO make custody claims — S4, S6 — always use both points.
   */
  opts: { op2?: boolean } = {},
): Promise<{ view: ManagerView; observation: CustodyObservation }> => {
  const useOp2 = opts.op2 ?? true;
  const view = await rig.base.readManagerNow();
  const pools: Record<string, string> = {};
  for (const c of colours) pools[c.label] = view.pools[c.hex] ? String(view.pools[c.hex]!.value) : 'absent';
  const cells: Record<string, string> = {};
  const onChainCells: Record<string, string> = {};
  const op2Retries: Record<string, number> = {};
  for (const a of accounts) {
    for (const c of colours) {
      const label = `${a.label}/${c.label}`;
      const key = shieldedKeyOf(a.id, c.raw);
      const has = Object.prototype.hasOwnProperty.call(view.shieldedBalances, key);
      cells[label] = has ? String(view.shieldedBalances[key]) : 'absent';
      if (!useOp2) continue;
      const op2 = await op2Read(rig, a.id, c.raw, label);
      onChainCells[label] = op2.value;
      if (op2.retries > 0) op2Retries[label] = op2.retries;
    }
  }
  return {
    view,
    observation: { mapSizes: mapSizes(view), pools, cells, onChainCells, op2Retries, op2Consulted: useOp2 },
  };
};

/**
 * Are OP1 and OP2 consistent? A missing cell reads 0 on chain, which is not a disagreement, and an
 * UNAVAILABLE OP2 read is a gap rather than a contradiction — it is reported separately so it cannot
 * masquerade as agreement.
 */
export const observationPointsAgree = (o: CustodyObservation): string[] => {
  if (!o.op2Consulted) return ['OP2 was not consulted for this observation (op2:false) — OP1 stands alone here'];
  const problems: string[] = [];
  for (const [k, v] of Object.entries(o.cells)) {
    const expected = v === 'absent' ? '0' : v;
    const got = o.onChainCells[k];
    if (got === OP2_UNAVAILABLE) {
      problems.push(`${k}: OP2 UNAVAILABLE (refused with 104 on every attempt) — OP1 says ${v}, unconfirmed`);
      continue;
    }
    if (got !== expected) problems.push(`${k}: OP1 says ${v}, OP2 (on-chain circuit call) says ${got}`);
  }
  return problems;
};

/**
 * The part of an observation that is a claim about LEDGER STATE, rendered comparably.
 *
 * Needed because `CustodyObservation` also carries bookkeeping about the measuring apparatus — how
 * many times OP2 had to be retried, and whether it ended up unavailable — and a "no state was
 * created" comparison must not fail because the second observation needed one more retry than the
 * first. Retries are a property of the run, not of the ledger.
 *
 * OP2 entries that are UNAVAILABLE are dropped from BOTH sides, so a gap in corroboration never reads
 * as a change in state. The gap itself is reported separately by `observationPointsAgree`.
 */
export const custodyFingerprint = (o: CustodyObservation, onlyOnChainKeys?: Set<string>): string => {
  const onChain: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.onChainCells)) {
    if (v === OP2_UNAVAILABLE) continue;
    if (onlyOnChainKeys && !onlyOnChainKeys.has(k)) continue;
    onChain[k] = v;
  }
  return JSON.stringify({ mapSizes: o.mapSizes, pools: o.pools, cells: o.cells, onChain });
};

/**
 * Did the ledger state stay byte-identical between two observations?
 *
 * OP2 keys are intersected before comparing, so an observation that skipped OP2 (or where one read
 * came back unavailable) is still comparable to one that did not. Dropping a corroboration is not the
 * same as observing a change, and conflating the two would turn apparatus noise into findings.
 */
export const custodyUnchanged = (a: CustodyObservation, b: CustodyObservation): boolean => {
  const shared = new Set(
    Object.keys(a.onChainCells).filter((k) => k in b.onChainCells),
  );
  return custodyFingerprint(a, shared) === custodyFingerprint(b, shared);
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
 * The node's numeric refusal code and its meaning.
 *
 * Delegates to `src/node-error.ts`, which is where the real work is: the wallet facade replaces the
 * node's error with the bare string `Transaction submission error` and buries the real one in an
 * Effect tagged field, so a regex over the ordinary `.cause` chain finds nothing. Prefer the
 * `nodeRefusal` a take already carries; these helpers exist for the cases where only text is at hand.
 */
export const nodeErrorCode = (error: string | undefined): number | null => nodeRefusalOf(error ?? '').code;

export const decodeNodeError = (code: number | null): string =>
  code === null ? '(no numeric code in the error)' : nodeRefusalOf(`Custom error: ${code}`).decoded;

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
