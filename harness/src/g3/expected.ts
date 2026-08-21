// G3 — the specification's 18-row step table, transcribed. NORMATIVE: nothing here may be "fixed"
// to match an observation. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This module is deliberately STANDALONE — no imports at all — for two reasons:
//   1. the offline suite (`src/test/step-ledger.test.ts`) checks this transcription against itself
//      before any stack is booted, and must not need the generated ZK artifacts to do it;
//   2. the expected table is the one thing in the harness that is COPIED FROM A DOCUMENT rather
//      than derived, so it is worth keeping in a file that can be read against the spec side by
//      side.
//
// Five things are transcribed:
//   EXPECTED  the full state after each of the 18 rows: every (party, colour) cell, every custody
//             figure (pool for a shielded colour, contract ledger balance for an unshielded one),
//             the EXACT size of all three custody maps, and the set of colours that EXIST at that
//             row.
//   ACTIONS   the spec's "Action" column, verbatim in substance.
//   CHANGED   the spec's "(everything else UNCHANGED)" column, made checkable: the exact set of
//             places row N is allowed to differ from row N-1.
//   MINTS     which colour is minted at which row, and how much — the conservation identity's
//             right-hand side.
//   FINAL_TABLE / END_SIZES  the spec's separately written final table and end-state map sizes,
//             so the walk is checked AGAINST them rather than deriving them from itself.
//
// What is new relative to 00004's transcription, and why:
//   - `sizes`: v3 seeds nothing, so the three map sizes are a statement about LAZY CREATION itself
//     and are asserted after every row (FR-202, FR-205).
//   - `colours`: at row 0 NO colour exists anywhere — the Manager is deployed before any Minter.
//     TOKD's two colours come into existence at row 15, mid-ledger. The colour set is therefore
//     part of the transcription rather than a constant.
//   - U3 is present in every row at 0: it is the DORMANT colour (minted by no one, deposited by no
//     one), and the harness asserts it stays absent from every map (FR-206, NC-3).

export type ColourKey = 'S1' | 'S2' | 'S3' | 'S4' | 'U1' | 'U2' | 'U3' | 'U4';
export type PartyKey = 'OwnerN' | 'OwnerM' | 'AA_A' | 'AA_B';

export type Cells = Record<ColourKey, bigint>;
export type Sizes = { pools: number; shieldedCells: number; unshieldedCells: number };
export type ExpectedStep = {
  table: Record<PartyKey, Cells>;
  custody: Cells;
  /** The spec's "exact map sizes after every step" bookkeeping. */
  sizes: Sizes;
  /** The colours that EXIST on chain at this row — the dynamic colour set, transcribed. */
  colours: readonly ColourKey[];
};

export const COLOUR_KEYS: readonly ColourKey[] = ['S1', 'S2', 'S3', 'S4', 'U1', 'U2', 'U3', 'U4'] as const;
export const SHIELDED_KEYS: readonly ColourKey[] = ['S1', 'S2', 'S3', 'S4'] as const;
export const UNSHIELDED_KEYS: readonly ColourKey[] = ['U1', 'U2', 'U3', 'U4'] as const;
export const PARTY_KEYS: readonly PartyKey[] = ['OwnerN', 'OwnerM', 'AA_A', 'AA_B'] as const;
export const AA_KEYS: readonly PartyKey[] = ['AA_A', 'AA_B'] as const;
export const USER_KEYS: readonly PartyKey[] = ['OwnerN', 'OwnerM'] as const;

/** The DORMANT colour: minted by no one, deposited by no one (spec Participants, FR-206, NC-3). */
export const DORMANT: ColourKey = 'U3';

export const CUSTODY_LABEL: Record<ColourKey, string> = {
  S1: 'poolS1',
  S2: 'poolS2',
  S3: 'poolS3',
  S4: 'poolS4',
  U1: 'ledgerU1',
  U2: 'ledgerU2',
  U3: 'ledgerU3',
  U4: 'ledgerU4',
};

/** [S1, S2, S3, S4, U1, U2, U3, U4] — the transcription's row order. */
type Octet = [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

const c = (o: Octet): Cells => ({
  S1: o[0],
  S2: o[1],
  S3: o[2],
  S4: o[3],
  U1: o[4],
  U2: o[5],
  U3: o[6],
  U4: o[7],
});

const st = (
  n: Octet,
  m: Octet,
  a: Octet,
  b: Octet,
  custody: Octet,
  sizes: Sizes,
  colours: readonly ColourKey[],
): ExpectedStep => ({
  table: { OwnerN: c(n), OwnerM: c(m), AA_A: c(a), AA_B: c(b) },
  custody: c(custody),
  sizes,
  colours,
});

const Z: Octet = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
const sz = (pools: number, shieldedCells: number, unshieldedCells: number): Sizes => ({
  pools,
  shieldedCells,
  unshieldedCells,
});

/** No colour exists at row 0: the Manager is deployed before any Minter. */
const NONE: readonly ColourKey[] = [] as const;
/** TOKA/TOKB/TOKC's six colours, from row 1. */
const SIX: readonly ColourKey[] = ['S1', 'S2', 'S3', 'U1', 'U2', 'U3'] as const;
/** …plus TOKD's two, created MID-LEDGER at row 15. */
const EIGHT: readonly ColourKey[] = ['S1', 'S2', 'S3', 'S4', 'U1', 'U2', 'U3', 'U4'] as const;

/** Row N of the spec's step ledger: the state that must hold AFTER step N. */
export const EXPECTED: Record<number, ExpectedStep> = {
  //        OwnerN                       OwnerM                       AA_A                         AA_B                         custody                      sizes          colours
  0: st(Z, Z, Z, Z, Z, sz(0, 0, 0), NONE),
  1: st(Z, Z, Z, Z, Z, sz(0, 0, 0), SIX),
  2: st([10n, 0n, 0n, 0n, 0n, 0n, 0n, 0n], Z, Z, Z, Z, sz(0, 0, 0), SIX),
  3: st([10n, 0n, 0n, 0n, 10n, 0n, 0n, 0n], Z, Z, Z, Z, sz(0, 0, 0), SIX),
  4: st([10n, 0n, 0n, 0n, 10n, 0n, 0n, 0n], [0n, 10n, 0n, 0n, 0n, 0n, 0n, 0n], Z, Z, Z, sz(0, 0, 0), SIX),
  5: st([10n, 0n, 0n, 0n, 10n, 0n, 0n, 0n], [0n, 10n, 10n, 0n, 0n, 0n, 0n, 0n], Z, Z, Z, sz(0, 0, 0), SIX),
  6: st([10n, 0n, 0n, 0n, 10n, 0n, 0n, 0n], [0n, 10n, 10n, 0n, 0n, 10n, 0n, 0n], Z, Z, Z, sz(0, 0, 0), SIX),
  7: st(
    [4n, 0n, 0n, 0n, 10n, 0n, 0n, 0n],
    [0n, 10n, 10n, 0n, 0n, 10n, 0n, 0n],
    [6n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
    Z,
    [6n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
    sz(1, 1, 0),
    SIX,
  ),
  8: st(
    [4n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 10n, 10n, 0n, 0n, 10n, 0n, 0n],
    [6n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    Z,
    [6n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    sz(1, 1, 1),
    SIX,
  ),
  9: st(
    [4n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 10n, 0n, 0n, 10n, 0n, 0n],
    [6n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 6n, 0n, 0n, 0n, 0n, 0n, 0n],
    [6n, 6n, 0n, 0n, 5n, 0n, 0n, 0n],
    sz(2, 2, 1),
    SIX,
  ),
  10: st(
    [4n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 0n, 10n, 0n, 0n],
    [6n, 0n, 4n, 0n, 5n, 0n, 0n, 0n],
    [0n, 6n, 0n, 0n, 0n, 0n, 0n, 0n],
    [6n, 6n, 4n, 0n, 5n, 0n, 0n, 0n],
    sz(3, 3, 1),
    SIX,
  ),
  11: st(
    [4n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 0n, 5n, 0n, 0n],
    [6n, 0n, 4n, 0n, 5n, 0n, 0n, 0n],
    [0n, 6n, 0n, 0n, 0n, 5n, 0n, 0n],
    [6n, 6n, 4n, 0n, 5n, 5n, 0n, 0n],
    sz(3, 3, 2),
    SIX,
  ),
  12: st(
    [4n, 0n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 0n, 5n, 0n, 0n],
    [3n, 0n, 4n, 0n, 5n, 0n, 0n, 0n],
    [3n, 6n, 0n, 0n, 0n, 5n, 0n, 0n],
    [6n, 6n, 4n, 0n, 5n, 5n, 0n, 0n],
    sz(3, 4, 2),
    SIX,
  ),
  13: st(
    [4n, 2n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 0n, 5n, 0n, 0n],
    [3n, 0n, 4n, 0n, 5n, 0n, 0n, 0n],
    [3n, 4n, 0n, 0n, 0n, 5n, 0n, 0n],
    [6n, 4n, 4n, 0n, 5n, 5n, 0n, 0n],
    sz(3, 4, 2),
    SIX,
  ),
  14: st(
    [4n, 2n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 2n, 5n, 0n, 0n],
    [3n, 0n, 4n, 0n, 3n, 0n, 0n, 0n],
    [3n, 4n, 0n, 0n, 0n, 5n, 0n, 0n],
    [6n, 4n, 4n, 0n, 3n, 5n, 0n, 0n],
    sz(3, 4, 2),
    SIX,
  ),
  15: st(
    [4n, 2n, 0n, 7n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 2n, 5n, 0n, 4n],
    [3n, 0n, 4n, 0n, 3n, 0n, 0n, 0n],
    [3n, 4n, 0n, 0n, 0n, 5n, 0n, 0n],
    [6n, 4n, 4n, 0n, 3n, 5n, 0n, 0n],
    sz(3, 4, 2),
    EIGHT,
  ),
  16: st(
    [4n, 2n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 2n, 5n, 0n, 4n],
    [3n, 0n, 4n, 7n, 3n, 0n, 0n, 0n],
    [3n, 4n, 0n, 0n, 0n, 5n, 0n, 0n],
    [6n, 4n, 4n, 7n, 3n, 5n, 0n, 0n],
    sz(4, 5, 2),
    EIGHT,
  ),
  17: st(
    [4n, 2n, 0n, 0n, 5n, 0n, 0n, 0n],
    [0n, 4n, 6n, 0n, 2n, 5n, 0n, 0n],
    [3n, 0n, 4n, 7n, 3n, 0n, 0n, 0n],
    [3n, 4n, 0n, 0n, 0n, 5n, 0n, 4n],
    [6n, 4n, 4n, 7n, 3n, 5n, 0n, 4n],
    sz(4, 5, 3),
    EIGHT,
  ),
};

/** The spec's final table, written out separately so the walk is CHECKED against it. */
export const FINAL_TABLE: ExpectedStep = st(
  [4n, 2n, 0n, 0n, 5n, 0n, 0n, 0n],
  [0n, 4n, 6n, 0n, 2n, 5n, 0n, 0n],
  [3n, 0n, 4n, 7n, 3n, 0n, 0n, 0n],
  [3n, 4n, 0n, 0n, 0n, 5n, 0n, 4n],
  [6n, 4n, 4n, 7n, 3n, 5n, 0n, 4n],
  sz(4, 5, 3),
  EIGHT,
);

/** The spec's end-state map sizes, quoted separately: "4 pools, 5 shielded cells, 3 unshielded". */
export const END_SIZES: Sizes = sz(4, 5, 3);

/** Total minted per colour once every mint of the walk has happened (10/10/10/7/10/10/-/4). */
export const MINTED_TOTAL: Cells = c([10n, 10n, 10n, 7n, 10n, 10n, 0n, 4n]);

/** Which row mints what, from which Minter, to whom. U3 appears nowhere: it is never minted. */
export const MINTS: Record<number, Array<{ colour: ColourKey; minter: string; to: 'OwnerN' | 'OwnerM'; amount: bigint }>> = {
  2: [{ colour: 'S1', minter: 'Minter1', to: 'OwnerN', amount: 10n }],
  3: [{ colour: 'U1', minter: 'Minter1', to: 'OwnerN', amount: 10n }],
  4: [{ colour: 'S2', minter: 'Minter2', to: 'OwnerM', amount: 10n }],
  5: [{ colour: 'S3', minter: 'Minter3', to: 'OwnerM', amount: 10n }],
  6: [{ colour: 'U2', minter: 'Minter2', to: 'OwnerM', amount: 10n }],
  15: [
    { colour: 'S4', minter: 'Minter4', to: 'OwnerN', amount: 7n },
    { colour: 'U4', minter: 'Minter4', to: 'OwnerM', amount: 4n },
  ],
};

export const ACTIONS: Record<number, string> = {
  0: 'Manager deployed — NO Minter exists on this chain; AA_A and AA_B registered',
  1: 'Minters TOKA, TOKB, TOKC deployed; 6 colours read on-chain, pairwise distinct',
  2: 'mint S1 10 -> OwnerN',
  3: 'mint U1 10 -> OwnerN',
  4: 'mint S2 10 -> OwnerM',
  5: 'mint S3 10 -> OwnerM',
  6: 'mint U2 10 -> OwnerM',
  7: 'OwnerN deposits S1 6 -> AA_A (first pool EVER)',
  8: 'OwnerN deposits U1 5 -> AA_A',
  9: 'OwnerM deposits S2 6 -> AA_B',
  10: 'OwnerM deposits S3 4 -> AA_A (depositor != credited owner)',
  11: 'OwnerM deposits U2 5 -> AA_B',
  12: 'internal transfer S1 3: AA_A -> AA_B (credit-side lazy cell; pool UNCHANGED)',
  13: 'AA_B withdraws S2 2 -> OwnerN',
  14: 'AA_A withdraws U1 2 -> OwnerM',
  15: 'TOKD deployed MID-LEDGER; mint S4 7 -> OwnerN, U4 4 -> OwnerM',
  16: 'OwnerN deposits S4 7 -> AA_A — HEADLINE: custody of a colour that did not exist at deploy',
  17: 'OwnerM deposits U4 4 -> AA_B',
};

/**
 * The spec's "(everything else UNCHANGED)" column, made checkable. Cells are `Party.Colour`;
 * custody entries use `CUSTODY_LABEL`. Row N may differ from row N-1 ONLY in these places.
 * Row 1 deliberately names nothing: deploying the three Minters must leave the Manager and every
 * wallet byte-identical to row 0.
 */
export const CHANGED: Record<number, readonly string[]> = {
  1: [],
  2: ['OwnerN.S1'],
  3: ['OwnerN.U1'],
  4: ['OwnerM.S2'],
  5: ['OwnerM.S3'],
  6: ['OwnerM.U2'],
  7: ['OwnerN.S1', 'AA_A.S1', 'poolS1'],
  8: ['OwnerN.U1', 'AA_A.U1', 'ledgerU1'],
  9: ['OwnerM.S2', 'AA_B.S2', 'poolS2'],
  10: ['OwnerM.S3', 'AA_A.S3', 'poolS3'],
  11: ['OwnerM.U2', 'AA_B.U2', 'ledgerU2'],
  12: ['AA_A.S1', 'AA_B.S1'],
  13: ['AA_B.S2', 'OwnerN.S2', 'poolS2'],
  14: ['AA_A.U1', 'OwnerM.U1', 'ledgerU1'],
  15: ['OwnerN.S4', 'OwnerM.U4'],
  16: ['OwnerN.S4', 'AA_A.S4', 'poolS4'],
  17: ['OwnerM.U4', 'AA_B.U4', 'ledgerU4'],
};

/** The map sizes may only change where lazy creation happens; transcribed for the offline check. */
export const SIZE_CHANGED: Record<number, readonly (keyof Sizes)[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: ['pools', 'shieldedCells'],
  8: ['unshieldedCells'],
  9: ['pools', 'shieldedCells'],
  10: ['pools', 'shieldedCells'],
  11: ['unshieldedCells'],
  12: ['shieldedCells'],
  13: [],
  14: [],
  15: [],
  16: ['pools', 'shieldedCells'],
  17: ['unshieldedCells'],
};

export const LAST_STEP = 17;
