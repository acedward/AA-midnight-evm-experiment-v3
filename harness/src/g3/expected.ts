// G3 — the specification's step table, transcribed. NORMATIVE: do not "fix" anything here to match
// an observation. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This module is deliberately STANDALONE — no imports at all — for two reasons:
//   1. the offline suite (`src/test/step-ledger.test.ts`) checks this transcription against itself
//      before any stack is booted, and must not need the generated ZK artifacts to do it;
//   2. the expected table is the one thing in the harness that is copied from a document rather than
//      derived, so it is worth keeping in a file that can be read against the spec side by side.
//
// Three things are transcribed:
//   EXPECTED  the full state after each of the 14 rows: 16 cells + the four custody figures
//             (poolS1, poolS2, ledgerU1, ledgerU2).
//   ACTIONS   the spec's "Action" column, verbatim in substance.
//   CHANGED   the spec's "(all other cells UNCHANGED)" column, made checkable: the exact set of
//             places row N is allowed to differ from row N-1.

export type ColourKey = 'S1' | 'S2' | 'U1' | 'U2';
export type PartyKey = 'OwnerN' | 'OwnerM' | 'AA_A' | 'AA_B';

export type Quad = Record<ColourKey, bigint>;
export type ExpectedStep = { table: Record<PartyKey, Quad>; custody: Quad };

const q = (S1: bigint, S2: bigint, U1: bigint, U2: bigint): Quad => ({ S1, S2, U1, U2 });

const st = (
  n: [bigint, bigint, bigint, bigint],
  m: [bigint, bigint, bigint, bigint],
  a: [bigint, bigint, bigint, bigint],
  b: [bigint, bigint, bigint, bigint],
  custody: [bigint, bigint, bigint, bigint],
): ExpectedStep => ({
  table: { OwnerN: q(...n), OwnerM: q(...m), AA_A: q(...a), AA_B: q(...b) },
  custody: q(...custody),
});

const Z: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];

/** Row N of the spec's step ledger: the state that must hold AFTER step N. */
export const EXPECTED: Record<number, ExpectedStep> = {
  //         OwnerN [S1 S2 U1 U2]  OwnerM              AA_A                AA_B                custody [pS1 pS2 lU1 lU2]
  0:  st(Z,                  Z,                  Z,                  Z,                  Z),
  1:  st([10n, 0n, 0n, 0n],  Z,                  Z,                  Z,                  Z),
  2:  st([10n, 0n, 10n, 0n], Z,                  Z,                  Z,                  Z),
  3:  st([10n, 0n, 10n, 0n], [0n, 10n, 0n, 0n],  Z,                  Z,                  Z),
  4:  st([10n, 0n, 10n, 0n], [0n, 10n, 0n, 10n], Z,                  Z,                  Z),
  5:  st([4n, 0n, 10n, 0n],  [0n, 10n, 0n, 10n], [6n, 0n, 0n, 0n],   Z,                  [6n, 0n, 0n, 0n]),
  6:  st([4n, 0n, 5n, 0n],   [0n, 10n, 0n, 10n], [6n, 0n, 5n, 0n],   Z,                  [6n, 0n, 5n, 0n]),
  7:  st([4n, 0n, 5n, 0n],   [0n, 4n, 0n, 10n],  [6n, 0n, 5n, 0n],   [0n, 6n, 0n, 0n],   [6n, 6n, 5n, 0n]),
  8:  st([4n, 0n, 5n, 0n],   [0n, 4n, 0n, 5n],   [6n, 0n, 5n, 0n],   [0n, 6n, 0n, 5n],   [6n, 6n, 5n, 5n]),
  9:  st([4n, 0n, 5n, 0n],   [0n, 4n, 0n, 5n],   [3n, 0n, 5n, 0n],   [3n, 6n, 0n, 5n],   [6n, 6n, 5n, 5n]),
  10: st([4n, 0n, 5n, 0n],   [0n, 4n, 0n, 5n],   [3n, 0n, 5n, 2n],   [3n, 6n, 0n, 3n],   [6n, 6n, 5n, 5n]),
  11: st([4n, 0n, 5n, 0n],   [3n, 4n, 0n, 5n],   [3n, 0n, 5n, 2n],   [0n, 6n, 0n, 3n],   [3n, 6n, 5n, 5n]),
  12: st([4n, 0n, 5n, 2n],   [3n, 4n, 0n, 5n],   [3n, 0n, 5n, 0n],   [0n, 6n, 0n, 3n],   [3n, 6n, 5n, 3n]),
  13: st([4n, 0n, 5n, 2n],   [3n, 2n, 0n, 3n],   [3n, 0n, 5n, 0n],   [0n, 8n, 0n, 5n],   [3n, 8n, 5n, 5n]),
};

/** The spec's final table, written out separately so the walk is checked against it, not derived. */
export const FINAL_TABLE: ExpectedStep = st(
  [4n, 0n, 5n, 2n],
  [3n, 2n, 0n, 3n],
  [3n, 0n, 5n, 0n],
  [0n, 8n, 0n, 5n],
  [3n, 8n, 5n, 5n],
);

/** Total minted per colour once every mint has happened; every row of the table sums to this. */
export const MINTED_TOTAL: Quad = q(10n, 10n, 10n, 10n);

/** The step at which each colour is minted, and by which Minter. */
export const MINTS: Record<number, { colour: ColourKey; minter: 'Minter1' | 'Minter2'; to: 'OwnerN' | 'OwnerM'; amount: bigint }> = {
  1: { colour: 'S1', minter: 'Minter1', to: 'OwnerN', amount: 10n },
  2: { colour: 'U1', minter: 'Minter1', to: 'OwnerN', amount: 10n },
  3: { colour: 'S2', minter: 'Minter2', to: 'OwnerM', amount: 10n },
  4: { colour: 'U2', minter: 'Minter2', to: 'OwnerM', amount: 10n },
};

export const ACTIONS: Record<number, string> = {
  0: 'baseline — deploy 3 Minters + 1 Manager, configure S1/S2/U1/U2, register AA_A and AA_B',
  1: 'Minter1 mints S1 10 -> OwnerN',
  2: 'Minter1 mints U1 10 -> OwnerN',
  3: 'Minter2 mints S2 10 -> OwnerM',
  4: 'Minter2 mints U2 10 -> OwnerM',
  5: 'OwnerN deposits S1 6 -> AA_A',
  6: 'OwnerN deposits U1 5 -> AA_A',
  7: 'OwnerM deposits S2 6 -> AA_B',
  8: 'OwnerM deposits U2 5 -> AA_B',
  9: 'internal transfer S1 3: AA_A -> AA_B (no token operation)',
  10: 'internal transfer U2 2: AA_B -> AA_A (no token operation)',
  11: 'AA_B withdraws S1 3 -> OwnerM',
  12: 'AA_A withdraws U2 2 -> OwnerN',
  13: 'M1 mixed-colour probe: OwnerM deposits S2 2 AND U2 2 to AA_B in ONE transaction',
};

/**
 * The spec's "(all other cells UNCHANGED)" column, made checkable. Cells are `Party.Colour`;
 * custody entries are `poolS1`, `poolS2`, `ledgerU1`, `ledgerU2`. Row N may differ from row N-1
 * ONLY in these places.
 */
export const CHANGED: Record<number, readonly string[]> = {
  1: ['OwnerN.S1'],
  2: ['OwnerN.U1'],
  3: ['OwnerM.S2'],
  4: ['OwnerM.U2'],
  5: ['OwnerN.S1', 'AA_A.S1', 'poolS1'],
  6: ['OwnerN.U1', 'AA_A.U1', 'ledgerU1'],
  7: ['OwnerM.S2', 'AA_B.S2', 'poolS2'],
  8: ['OwnerM.U2', 'AA_B.U2', 'ledgerU2'],
  9: ['AA_A.S1', 'AA_B.S1'],
  10: ['AA_B.U2', 'AA_A.U2'],
  11: ['AA_B.S1', 'OwnerM.S1', 'poolS1'],
  12: ['AA_A.U2', 'OwnerN.U2', 'ledgerU2'],
  13: ['OwnerM.S2', 'AA_B.S2', 'poolS2', 'OwnerM.U2', 'AA_B.U2', 'ledgerU2'],
};

export const PARTY_KEYS: readonly PartyKey[] = ['OwnerN', 'OwnerM', 'AA_A', 'AA_B'] as const;
export const COLOUR_KEYS: readonly ColourKey[] = ['S1', 'S2', 'U1', 'U2'] as const;
export const CUSTODY_LABEL: Record<ColourKey, string> = {
  S1: 'poolS1',
  S2: 'poolS2',
  U1: 'ledgerU1',
  U2: 'ledgerU2',
};
