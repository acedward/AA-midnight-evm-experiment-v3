// The spec's normative step ledger, transcribed, plus the D-307 stage partition. IMPORT-FREE.
// 00006 Plan 03 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Nothing is imported here on purpose: this file is the single place where the demonstration's
// numbers live, so the amounts the run asserts and the amounts the evidence prints are ONE object.
// A stage that hard-coded its own `4n` beside a table that said `4` would be two claims that happen
// to agree today.
//
// WHY THERE IS A STAGE PARTITION AT ALL — deviation D-307, and it is not a preference.
//
// Finding F-310 (Plan 02 spike S5b, replicated across three independent runs) measured a hard lane
// boundary: a swap offer is only PUBLISHABLE while the Manager holds at most ONE shielded custody
// cell. With two cells the transcript exceeds the ledger's guaranteed-section cost budget
// (`partition_transcripts`, budget derived from `params.limits.min_time_to_dismiss`), the value leg
// lands in the FALLIBLE section where no independent taker can reach it, and FR-302 refuses to
// publish it — fail-closed, by design. The spec's row 5 SETTLES, which leaves custody at two pools
// and two cells, so rows 7 through 12 as literally written would every one of them fail at build.
//
// So the ledger is partitioned across three FRESH Managers on ONE chain in ONE scripted run. Every
// row, control and probe keeps its exact amounts and assertions; the final table is asserted PER
// STAGE with the mapping recorded; and the deviation is EVIDENCED rather than asserted — P-F310
// attempts the spec's literal row 7 on Manager #1 at two cells and records the fail-closed refusal.
//
// Rows 5 and 8 each need a SETTLEMENT and a settlement is exactly what exhausts a Manager's
// publishability budget, so two Managers are unavoidable. The third exists so the refusal-only
// negatives (9, 11, 12) never have to interleave with a settlement whose live offer their own
// interventions would destroy. See Plan 03 "Deviation D-307" for the rejected two-stage packing.

/** FR-309: every artifact this project writes carries the lane labels. Kept here for import-free use. */
export const LEDGER_LABEL = 'EXPERIMENTAL_LANE / LANE-DEV-1';

export type SpecRow = {
  row: number;
  /** The spec's own words for the action. */
  action: string;
  /** The spec's own words for the expected change. */
  expected: string;
  /** Which stage runs it, under D-307. */
  stage: 'A' | 'B' | 'C';
  /** Empty when the row runs exactly as written. */
  asRun?: string;
};

/**
 * The spec's step ledger (`spec/00006-unbalanced-zswap.md`, "Demonstration scenario"), transcribed.
 *
 * `asRun` is filled in ONLY where D-307 changes something, and it says what and why. A row with no
 * `asRun` runs exactly as the spec writes it.
 */
export const SPEC_ROWS: readonly SpecRow[] = [
  {
    row: 0,
    action: 'Manager v4 deployed; AA_A, AA_B registered',
    expected: 'all maps size 0',
    stage: 'A',
    asRun: 'run three times — once per stage — because each stage needs its own ≤1-cell budget (F-310)',
  },
  {
    row: 1,
    action: 'Minters TOKA, TOKB deployed; mint S_A 10 → OwnerN; mint S_B 10 → OwnerT',
    expected: 'Manager state unchanged',
    stage: 'A',
    asRun: 'per stage, with that stage\'s own fresh colours; stage C mints S_A 12 so its five negatives each have a give to make',
  },
  {
    row: 2,
    action: 'OwnerN deposits S_A 6 → AA_A',
    expected: 'pool S_A=6; AA_A: S_A=6; maps 1/1/0',
    stage: 'A',
  },
  {
    row: 3,
    action:
      'OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 credited to AA_A; proven; serialized to file; no DUST',
    expected:
      'NO on-chain change; envelope round-trips byte-identically; imbalances(0) = exactly −7 S_B (the A leg is internally balanced); no other segment has deltas',
    stage: 'A',
  },
  {
    row: 4,
    action: 'OFFER-1 submitted DIRECTLY (unbalanced)',
    expected: 'REFUSED — verbatim node/ledger error recorded; no state created',
    stage: 'A',
    asRun:
      'submitted by a THIRD process holding nothing but the envelope file and its own seed, in two forms (unbound as published, and bound) — plus the ledger\'s own offline `wellFormed` verdict',
  },
  {
    row: 5,
    action: 'OwnerT takes OFFER-1: stock balance → merge → submit',
    expected:
      'HEADLINE — ONE tx id: pool S_A 6→2; pool S_B created =7; AA_A: S_A 6→2, S_B 0→7; OwnerT: +4 S_A, −7 S_B, paid ALL DUST; maker DUST spend 0; maps 2/2/0',
    stage: 'A',
    asRun:
      'maker DUST spend 0 is read from the settled transaction\'s PER-INTENT dust actions, not from `dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably paying fees (Plan 02 S6)',
  },
  {
    row: 6,
    action: 'Double-take: OFFER-1 balanced and submitted again',
    expected: 'REFUSED (backing coin spent); no state',
    stage: 'A',
    asRun:
      'preceded by ONE labelled fixture mint of S_B 7 to OwnerT: after row 5 the taker holds only 3 S_B and could not balance at all, so the refusal would come from its own wallet instead of the NODE. The spec\'s v1-only final table is asserted BEFORE the fixture, where it applies',
  },
  {
    row: 7,
    action:
      'OFFER-2 built (v2 OPEN shape — floating surplus): give S_A 2 to no one the maker knows, want S_B 3 to AA_A',
    expected: 'surplus shape: imbalances(0) = +2 S_A, −3 S_B',
    stage: 'B',
    asRun:
      'on a FRESH Manager whose AA_A holds exactly 2 S_A, so the give is the pool\'s whole balance and row 8\'s "pool removed" is reproduced exactly. The spec\'s literal row 7 is ALSO attempted on Manager #1 at two cells, where it fails closed — that is P-F310, the deviation\'s own evidence',
  },
  {
    row: 8,
    action: 'OwnerT — whose keys the maker never knew — takes OFFER-2',
    expected:
      'pool S_A 2→0 (pool removed), pool S_B 7→10; AA_A: S_A→0, S_B→10; OwnerT: +2 S_A (swept), −3 S_B, all DUST; maps 1/2/0',
    stage: 'B',
    asRun:
      'the S_B TOTALS differ (absent→3, AA_A 0→3) because the +7 they carry happened on Manager #1. Every DELTA (−2 S_A with the pool REMOVED, +3 S_B, OwnerT +2/−3, maker dust 0) and the exact end-state map sizes 1/2/0 are reproduced identically',
  },
  {
    row: 9,
    action: 'Expiry negative: OFFER-3 (small give) held past its TTL, then taken',
    expected: 'REFUSED; no state',
    stage: 'C',
    asRun:
      'the intent TTL is rewritten to 120 s while the transaction is still UNPROVEN (F-306: rewriting a PROVEN transaction\'s intents invalidates its zswap proofs), because midnight-js hardcodes `ttlOneHour()` and the literal form costs an hour per observation. BOTH layers measured: the taker\'s own gate refuses OFFLINE, and with that gate forced off the node refuses with 228',
  },
  {
    row: 10,
    action: "Tamper negative: OFFER-1's retained bytes, one byte flipped, taken",
    expected: 'REFUSED at deserialize/validate; no state',
    stage: 'A',
    asRun:
      'TWO arms. (a) the flip alone is refused OFFLINE by the envelope\'s content-address check, before a wallet, a proof server or a node is contacted — STRONGER than the node refusal the spec anticipated, and recorded as such. (b) the flip with the content address REPAIRED reaches the layer the spec named',
  },
  {
    row: 11,
    action:
      'Staleness probe (FR-311): OFFER-4 built on a live colour, then an ordinary deposit lands on that colour, then OFFER-4 taken',
    expected: 'expected refusal (Custom error: 104 — Transcript); verbatim + no-state; MEASURED, not judged',
    stage: 'C',
    asRun:
      'the MEASURED code is 239 = ZswapInvalidErrorCode::NullifierAlreadyPresent, not the predicted 104 (finding F-309, 3/3 in Plan 02): an ordinary deposit MERGES the pooled coin and merging SPENDS it, so the offer\'s pinned coin is already nullified. FR-311 asks for the measured rule, so the measured rule is asserted and the divergence recorded',
  },
  {
    row: 12,
    action:
      'Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken',
    expected: 'REFUSED; no state — cancellation-by-spend works',
    stage: 'C',
    asRun:
      'BOTH forms the spec names are measured separately, because they are not the same mechanism: a WITHDRAW spends the pooled coin, while `transferInternalShielded` performs NO token operation at all (the pooled coin is byte-identical afterwards) and can only invalidate an offer through the account cell its transcript read',
  },
];

/** The spec's final table after step 8. v1-only figures in parentheses there; both are kept here. */
export const SPEC_FINAL_TABLE = {
  note:
    'Asserted PER STAGE under D-307: stage A\'s closing state matches the v1-only column (in ' +
    'parentheses in the spec) at the moment row 5 lands, and stage B reproduces every DELTA of the ' +
    'v2 column plus the exact end-state map sizes 1/2/0.',
  rows: [
    { who: 'OwnerN', S_A: '4', S_B: '0' },
    { who: 'OwnerT', S_A: '6 (4)', S_B: '0 (3)' },
    { who: 'AA_A', S_A: '0 (2)', S_B: '10 (7)' },
    { who: 'pool', S_A: '0 (2)', S_B: '10 (7)' },
  ],
  endStateMapSizes: '1 pool (2), 2 shielded cells, 0 unshielded — exactly',
} as const;

export const NEGATIVE_CONTROLS = [
  { id: 'NC-301', what: 'direct submission of the unbalanced maker tx refused (row 4)', stage: 'A' },
  { id: 'NC-302', what: 'double-take refused after settlement (row 6)', stage: 'A' },
  { id: 'NC-303', what: 'expiry refused past TTL (row 9)', stage: 'C' },
  { id: 'NC-304', what: 'tamper refused (row 10)', stage: 'A' },
  {
    id: 'NC-305',
    what: "unauthorized make: OwnerN's witness (unregistered for AA_A) attempts to open an offer on AA_A's S_A",
    stage: 'A',
  },
  {
    id: 'NC-306',
    what: 'unbacked make: an offer giving more S_A than AA_A\'s cell holds while the pool WOULD cover it via another account',
    stage: 'C',
  },
  { id: 'P-104', what: 'staleness probe (row 11) — measured lane behaviour, FR-311', stage: 'C' },
  { id: 'P-CXL', what: 'cancellation-by-spend (row 12), both forms', stage: 'C' },
  {
    id: 'P-OPEN',
    what: 'the open-offer take (rows 7–8) — floating surplus; GREEN if it settles for a previously-unknown holder',
    stage: 'B',
  },
  {
    id: 'P-F310',
    what:
      "D-307's own evidence: the spec's LITERAL row 7 attempted at two custody cells must FAIL CLOSED on FR-302 " +
      '(the designed-against form of lane issue 0003), replicated at F-310\'s deciding 1-pool/2-cell configuration',
    stage: 'A+C',
  },
] as const;

// --- the amounts, per stage --------------------------------------------------------------------
//
// Every number the run uses is here. `n` suffixes are bigints because custody values are bigints
// everywhere else and a silent Number conversion is exactly the kind of thing that makes a table
// wrong in the third decimal place of a token amount.

export const STAGE_A = {
  stage: 'A' as const,
  manager: '#1',
  carries: 'rows 0–6, row 10 (NC-304), NC-305, P-F310',
  mint: { S_A: 10n, S_B: 10n },
  deposit: 6n,
  /** OFFER-1 — the spec's row 3, v1 named taker. */
  offer1: { gives: 4n, wants: 7n },
  /** Row 5's expected end state. */
  afterRow5: {
    poolA: 2n,
    poolB: 7n,
    cellA: 2n,
    cellB: 7n,
    ownerN_A: 4n,
    ownerT_A: 4n,
    ownerT_B: 3n,
    sizes: { pools: 2, shieldedCells: 2, unshieldedCells: 0 },
  },
  /** FIXTURE, not a spec row: makes row 6 a NODE refusal instead of a taker-balancer refusal. */
  doubleTakeTopUpB: 7n,
  /** NC-305 — the same offer, built with an UNREGISTERED witness. */
  nc305: { gives: 4n, wants: 7n, witness: 'ownerN' as const },
  /** P-F310 arm 1 — the spec's literal row 7, on this Manager, at two cells. */
  pf310Literal: { gives: 2n, wants: 3n },
  /** P-F310 arm 2 — same, but wanting a colour with NO pool, isolating the cell count from F-308. */
  pf310FreshColour: { gives: 2n, wants: 3n },
};

export const STAGE_B = {
  stage: 'B' as const,
  manager: '#2',
  carries: 'rows 7–8 (P-OPEN — the owner-REQUIRED open offer)',
  mint: { S_A: 10n, S_B: 10n },
  /**
   * EXACTLY the give amount, so the offer releases the pool's whole balance and row 8's "pool
   * removed" is reproduced rather than approximated.
   */
  deposit: 2n,
  offer2: { gives: 2n, wants: 3n },
  afterRow8: {
    poolA: 'absent' as const,
    poolB: 3n,
    cellA: 0n,
    cellB: 3n,
    ownerN_A: 8n,
    ownerT_A: 2n,
    ownerT_B: 7n,
    sizes: { pools: 1, shieldedCells: 2, unshieldedCells: 0 },
  },
};

export const STAGE_C = {
  stage: 'C' as const,
  manager: '#3',
  carries: 'rows 9 (NC-303), 11 (P-104), 12 (P-CXL, both forms), NC-306, P-F310 replication',
  mint: { S_A: 12n, S_B: 10n },
  deposit: 6n,
  /** Row 9 — expiry. The intent TTL is rewritten before proving; the wait is TTL + margin. */
  row9: { gives: 1n, wants: 1n, ttlSeconds: 120, waitSeconds: 150, expectedNodeCode: 228 },
  /** Row 11 — staleness. The intervention is an ORDINARY deposit on the offered colour. */
  row11: { gives: 1n, wants: 1n, interveneDeposit: 1n, expectedNodeCode: 239 },
  /** Row 12a — cancellation by WITHDRAW: the pooled coin is really spent. */
  row12a: { gives: 1n, wants: 1n, withdraw: 2n, expectedNodeCode: 239 },
  /**
   * Row 12b — cancellation by INTERNAL TRANSFER: no token operation at all. The pooled coin must be
   * byte-identical afterwards, so if this cancels the offer it can only be through the account cell
   * the transcript read. MEASURED: 104 (`InvalidError::Transcript`) is the expectation, not an
   * assertion.
   */
  row12b: { gives: 1n, wants: 1n, transfer: 3n, expectedNodeCode: 104 },
  /** NC-306 — the pool covers 5; AA_A's cell holds 2 after row 12b. */
  nc306: { gives: 5n, wants: 1n },
  /** P-F310 replication — fully backed (cell 2, pool 5) at 1 pool / 2 cells. */
  pf310: { gives: 2n, wants: 1n },
};

/** The D-307 statement, written into the evidence so no reader has to reconstruct it. */
export const DEVIATION_D307 = {
  id: 'D-307',
  title: 'the demonstration ledger is PARTITIONED across three fresh Managers on one chain',
  cause:
    'F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; ' +
    "the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built",
  preserved:
    'every row, control and probe runs with the spec\'s exact amounts and assertions, in one scripted ' +
    'run on one chain; the final table is asserted per stage with the mapping recorded',
  notClaimed:
    'this is NOT the spec\'s literal single-Manager 13-row table, and it is never presented as one. ' +
    'No claim is made that a 13-row single-Manager sequence is reachable at these pins — the opposite ' +
    'is measured, by P-F310',
  minimality:
    'rows 5 and 8 each require a settlement and a settlement exhausts the budget, so TWO Managers are ' +
    'unavoidable. The third keeps the refusal-only negatives from interleaving with — and destroying — ' +
    'the live offers rows 5 and 8 must settle. A two-stage packing is arithmetically possible and was ' +
    'rejected: it would make the owner-REQUIRED rows 7–8 depend on five prior interventions each landing ' +
    'exactly right',
  ratification: 'owner ratification wanted as a spec amendment — Plan 03 question Q03-1. The spec file is byte-identical',
} as const;
