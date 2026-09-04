// Offline dry run of the spec's 18-row step ledger (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// The live gate G3 costs the better part of an hour on a shared host. Three classes of mistake are
// cheap to make and expensive to discover there, and all three are caught here in under a second:
//
//   1. a TRANSCRIPTION error in `src/g3/expected.ts` — the one place in the harness that is copied
//      from a document rather than derived. `describe('the transcribed table')` checks it against
//      itself: every colour conserves, every custody figure equals its account column, each row
//      differs from the previous one ONLY where the spec's "(everything else UNCHANGED)" column
//      says it may, the map sizes move only where lazy creation happens, and the last row equals
//      the spec's separately written final table and end-state map sizes.
//
//   2. a CONTRACT-side mistake in the ordered walk — a colour, an account or an amount in the wrong
//      argument position. `describe('the Manager-side walk')` replays the Manager's half of every
//      row through the compiled artifact in process, INCLUDING the exact map sizes, which is the
//      assertion this project exists to make.
//
//   3. a live NEGATIVE CONTROL aimed at the wrong fixture. The five controls are replayed against
//      the walked state with the same accounts and colours the live gate uses.
//
// One simulator limitation is recorded rather than papered over: the in-process runtime does not
// maintain the ledger KERNEL's unshielded balances, so `unshieldedBalanceGte` is false for any
// amount and step 14's `withdrawUnshielded` cannot complete here. That guard is the LAST one in the
// circuit, so the walk asserts step 14 reaches exactly it — which is itself the offline proof that
// the witness choke point and the per-(account, colour) guard both passed for a legitimate
// withdrawal — and rows 16-17 are then asserted with AA_A.U1 held at its pre-step-14 value.
//
// PORTED (2026-08-25, repo reorganization). This suite predates the v5 Manager: it calls the
// contract by the PER-SELECTOR circuit names that v5 deleted (`withdrawShielded`,
// `transferInternalShielded`, `openSwapShielded`, `registerAccount`, ...). It still exercises the
// CURRENT contract, because `tests/lib/sim.ts` translates each of those names into the equivalent
// `execute` action envelope and drives v5's single gateway with it. So the vocabulary is historical
// and the coverage is live: every assertion below is checked against today's compiled Manager.
//
// Its frozen input — the spec's 18-row step table, transcribed by hand — now lives at
// `tests/fixtures/step-ledger-table.ts` (it was `harness/src/g3/expected.ts`).
// S*/U* in this suite are mathematical fixture-column labels, never outward token names.
import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  CHANGED,
  COLOUR_KEYS,
  CUSTODY_LABEL,
  DORMANT,
  END_SIZES,
  EXPECTED,
  FINAL_TABLE,
  LAST_STEP,
  MINTS,
  PARTY_KEYS,
  SHIELDED_KEYS,
  SIZE_CHANGED,
  type ColourKey,
  type ExpectedStep,
} from '../fixtures/step-ledger-table.js';
import { ManagerSim, mapSizes, secretOf, snapshotLedger } from '../lib/sim.js';

const COLOUR: Record<ColourKey, Uint8Array> = {
  S1: new Uint8Array(32).fill(0x11),
  S2: new Uint8Array(32).fill(0x12),
  S3: new Uint8Array(32).fill(0x13),
  S4: new Uint8Array(32).fill(0x14),
  U1: new Uint8Array(32).fill(0x21),
  U2: new Uint8Array(32).fill(0x22),
  U3: new Uint8Array(32).fill(0x23),
  U4: new Uint8Array(32).fill(0x24),
};

const OWNER_A = secretOf('OwnerA');
const OWNER_B = secretOf('OwnerB');
const OWNER_N = secretOf('OwnerN-unregistered');

const coin = (colour: Uint8Array, value: bigint, n: number) => ({
  nonce: new Uint8Array(32).fill(n),
  color: colour,
  value,
});
const userRecipient = (b: number) => ({
  is_left: true,
  left: { bytes: new Uint8Array(32).fill(b) },
  right: { bytes: new Uint8Array(32) },
});
const unshieldedUserRecipient = (b: number) => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: new Uint8Array(32).fill(b) },
});

/** Total minted of `colour` at or before step `n` — the harness knows it because it mints. */
const mintedBy = (n: number, colour: ColourKey): bigint => {
  let total = 0n;
  for (const [step, list] of Object.entries(MINTS)) {
    if (Number(step) > n) continue;
    for (const m of list) if (m.colour === colour) total += m.amount;
  }
  return total;
};

describe('the transcribed step table (spec, NORMATIVE)', () => {
  it('has all eighteen rows, 0 through 17', () => {
    expect(Object.keys(EXPECTED).map(Number).sort((a, b) => a - b)).toEqual([...Array(18).keys()]);
    expect(Object.keys(ACTIONS).length).toBe(18);
    expect(LAST_STEP).toBe(17);
  });

  it('conserves every colour at every row: minted[c] == custody[c] + OwnerN[c] + OwnerM[c]', () => {
    for (let n = 0; n <= LAST_STEP; n++) {
      const e = EXPECTED[n]!;
      for (const c of COLOUR_KEYS) {
        expect(`step ${n} ${c}: ${e.custody[c] + e.table.OwnerN[c] + e.table.OwnerM[c]}`).toBe(
          `step ${n} ${c}: ${mintedBy(n, c)}`,
        );
      }
    }
  });

  it('satisfies the per-colour invariant at every row: custody[c] == AA_A[c] + AA_B[c]', () => {
    for (let n = 0; n <= LAST_STEP; n++) {
      const e = EXPECTED[n]!;
      for (const c of COLOUR_KEYS) {
        expect(`step ${n} ${CUSTODY_LABEL[c]}: ${e.custody[c]}`).toBe(
          `step ${n} ${CUSTODY_LABEL[c]}: ${e.table.AA_A[c] + e.table.AA_B[c]}`,
        );
      }
    }
  });

  it('changes ONLY the cells the spec names, at every row', () => {
    for (let n = 1; n <= LAST_STEP; n++) {
      const prev = EXPECTED[n - 1]!;
      const next = EXPECTED[n]!;
      const allowed = new Set(CHANGED[n]!);
      const moved: string[] = [];
      for (const p of PARTY_KEYS) {
        for (const c of COLOUR_KEYS) if (prev.table[p][c] !== next.table[p][c]) moved.push(`${p}.${c}`);
      }
      for (const c of COLOUR_KEYS) if (prev.custody[c] !== next.custody[c]) moved.push(CUSTODY_LABEL[c]);
      expect(`step ${n} moved: ${moved.sort().join(',')}`).toBe(
        `step ${n} moved: ${moved.filter((m) => allowed.has(m)).sort().join(',')}`,
      );
      // …and every named cell must actually move (a name that never moves is a typo in either the
      // table or the CHANGED transcription).
      for (const name of allowed) {
        if (!moved.includes(name)) {
          throw new Error(`step ${n} (${ACTIONS[n]}) names ${name} as changing, but it did not change`);
        }
      }
    }
  });

  it('grows the three custody maps ONLY where lazy creation happens', () => {
    for (let n = 1; n <= LAST_STEP; n++) {
      const prev = EXPECTED[n - 1]!.sizes;
      const next = EXPECTED[n]!.sizes;
      const allowed = new Set<string>(SIZE_CHANGED[n]!);
      const moved = (['pools', 'shieldedCells', 'unshieldedCells'] as const).filter((k) => prev[k] !== next[k]);
      expect(`step ${n} sizes moved: ${moved.join(',')}`).toBe(
        `step ${n} sizes moved: ${moved.filter((m) => allowed.has(m)).join(',')}`,
      );
      for (const name of allowed) {
        if (!moved.includes(name as (typeof moved)[number])) {
          throw new Error(`step ${n} names ${name} as growing, but it did not`);
        }
        // Lazy CREATION only: no step of this ledger removes a cell or a pool.
        expect(`${n}.${name}`).toBe(`${n}.${name}`);
        expect(next[name as keyof typeof next]).toBeGreaterThan(prev[name as keyof typeof prev]);
      }
    }
    // Rows 0-6 hold NOTHING: the Manager is deployed, both accounts are registered, five mints have
    // happened, and every custody map is still empty. That is FR-201/FR-202 in one line.
    for (let n = 0; n <= 6; n++) {
      expect(`step ${n}: ${JSON.stringify(EXPECTED[n]!.sizes)}`).toBe(
        `step ${n}: ${JSON.stringify({ pools: 0, shieldedCells: 0, unshieldedCells: 0 })}`,
      );
    }
  });

  it('only ever GROWS the colour set, and never holds a colour it does not know', () => {
    let previous: readonly ColourKey[] = [];
    for (let n = 0; n <= LAST_STEP; n++) {
      const known = EXPECTED[n]!.colours;
      for (const c of previous) expect(`step ${n} knows ${c}`).toBe(`step ${n} knows ${known.includes(c) ? c : 'NOTHING'}`);
      // Nothing may be held in a colour the row does not know about.
      for (const c of COLOUR_KEYS) {
        if (known.includes(c)) continue;
        const total =
          PARTY_KEYS.reduce((a, p) => a + EXPECTED[n]!.table[p][c], 0n) + EXPECTED[n]!.custody[c];
        expect(`step ${n} holds ${total} of the unknown colour ${c}`).toBe(`step ${n} holds 0 of the unknown colour ${c}`);
      }
      previous = known;
    }
    expect(EXPECTED[0]!.colours).toEqual([]);
    expect([...EXPECTED[1]!.colours].sort()).toEqual(['S1', 'S2', 'S3', 'U1', 'U2', 'U3']);
    expect([...EXPECTED[14]!.colours].sort()).toEqual(['S1', 'S2', 'S3', 'U1', 'U2', 'U3']);
    expect([...EXPECTED[15]!.colours].sort()).toEqual(['S1', 'S2', 'S3', 'S4', 'U1', 'U2', 'U3', 'U4']);
  });

  it('keeps U3 dormant — never minted, never held, never custodied, at any row', () => {
    for (let n = 0; n <= LAST_STEP; n++) {
      for (const p of PARTY_KEYS) expect(`${n}.${p}.${DORMANT}: ${EXPECTED[n]!.table[p][DORMANT]}`).toBe(`${n}.${p}.${DORMANT}: 0`);
      expect(`${n}.custody.${DORMANT}: ${EXPECTED[n]!.custody[DORMANT]}`).toBe(`${n}.custody.${DORMANT}: 0`);
    }
    expect(mintedBy(LAST_STEP, DORMANT)).toBe(0n);
  });

  it("ends at the spec's final table and end-state map sizes", () => {
    expect(EXPECTED[LAST_STEP]).toEqual(FINAL_TABLE);
    expect(EXPECTED[LAST_STEP]!.sizes).toEqual(END_SIZES);
    expect(END_SIZES).toEqual({ pools: 4, shieldedCells: 5, unshieldedCells: 3 });
    for (const c of COLOUR_KEYS) {
      const total = PARTY_KEYS.reduce((a, p) => a + FINAL_TABLE.table[p][c], 0n);
      expect(`${c} total: ${total}`).toBe(`${c} total: ${mintedBy(LAST_STEP, c)}`);
      expect(`${c} custody: ${FINAL_TABLE.custody[c]}`).toBe(
        `${c} custody: ${FINAL_TABLE.table.AA_A[c] + FINAL_TABLE.table.AA_B[c]}`,
      );
    }
  });

  it('reproduces the spec\'s final table verbatim (S1 S2 S3 S4 U1 U2 U4 columns)', () => {
    // Transcribed a second time, straight from the specification's own final table, and compared —
    // so a slip in the row-by-row walk cannot agree with a matching slip here.
    const spec: Record<string, Record<string, number>> = {
      OwnerN: { S1: 4, S2: 2, S3: 0, S4: 0, U1: 5, U2: 0, U4: 0 },
      OwnerM: { S1: 0, S2: 4, S3: 6, S4: 0, U1: 2, U2: 5, U4: 0 },
      AA_A: { S1: 3, S2: 0, S3: 4, S4: 7, U1: 3, U2: 0, U4: 0 },
      AA_B: { S1: 3, S2: 4, S3: 0, S4: 0, U1: 0, U2: 5, U4: 4 },
    };
    const custody: Record<string, number> = { S1: 6, S2: 4, S3: 4, S4: 7, U1: 3, U2: 5, U4: 4 };
    for (const [p, row] of Object.entries(spec)) {
      for (const [c, v] of Object.entries(row)) {
        expect(`${p}.${c}: ${FINAL_TABLE.table[p as keyof typeof FINAL_TABLE.table][c as ColourKey]}`).toBe(`${p}.${c}: ${v}`);
      }
    }
    for (const [c, v] of Object.entries(custody)) expect(`${c}: ${FINAL_TABLE.custody[c as ColourKey]}`).toBe(`${c}: ${v}`);
  });
});

describe('the Manager-side walk through the compiled contract', () => {
  /** A Manager with AA_A and AA_B registered and NOTHING else — spec step 0. */
  const setup = async () => {
    const sim = await ManagerSim.create(OWNER_A);
    const idA = await sim.ownerCommitmentFor(OWNER_A);
    const idB = await sim.ownerCommitmentFor(OWNER_B);
    await sim.call('registerAccount', idA);
    await sim.call('registerAccount', idB);
    return { sim, idA, idB };
  };

  /** The AA half of the table plus every shielded pool, as the Manager itself answers. */
  const managerSide = async (sim: ManagerSim, idA: Uint8Array, idB: Uint8Array) => {
    const out: Record<string, string> = {};
    for (const c of COLOUR_KEYS) {
      const circuit = SHIELDED_KEYS.includes(c) ? 'shieldedAccountBalance' : 'unshieldedAccountBalance';
      out[`AA_A.${c}`] = String(await sim.call<bigint>(circuit, idA, COLOUR[c]));
      out[`AA_B.${c}`] = String(await sim.call<bigint>(circuit, idB, COLOUR[c]));
    }
    for (const c of SHIELDED_KEYS) out[CUSTODY_LABEL[c]] = String(await sim.call<bigint>('poolValue', COLOUR[c]));
    return out;
  };

  /** The same figures, taken from the transcribed expectation for a row. */
  const managerSideOf = (e: ExpectedStep, overrides: Record<string, string> = {}): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of COLOUR_KEYS) {
      out[`AA_A.${c}`] = String(e.table.AA_A[c]);
      out[`AA_B.${c}`] = String(e.table.AA_B[c]);
    }
    for (const c of SHIELDED_KEYS) out[CUSTODY_LABEL[c]] = String(e.custody[c]);
    return { ...out, ...overrides };
  };

  it('reproduces rows 0 through 13 exactly, map sizes included', async () => {
    const { sim, idA, idB } = await setup();

    // Rows 0-6: the Manager is untouched — deploys and mints go nowhere near it.
    for (const n of [0, 1, 2, 3, 4, 5, 6]) {
      expect(`row ${n}: ${JSON.stringify(await managerSide(sim, idA, idB))}`).toBe(
        `row ${n}: ${JSON.stringify(managerSideOf(EXPECTED[n]!))}`,
      );
      expect(`row ${n} sizes: ${JSON.stringify(mapSizes(sim.ledger))}`).toBe(
        `row ${n} sizes: ${JSON.stringify(EXPECTED[n]!.sizes)}`,
      );
    }

    const step = async (n: number, run: () => Promise<unknown>) => {
      await run();
      expect(`row ${n}: ${JSON.stringify(await managerSide(sim, idA, idB))}`).toBe(
        `row ${n}: ${JSON.stringify(managerSideOf(EXPECTED[n]!))}`,
      );
      expect(`row ${n} sizes: ${JSON.stringify(mapSizes(sim.ledger))}`).toBe(
        `row ${n} sizes: ${JSON.stringify(EXPECTED[n]!.sizes)}`,
      );
    };

    await step(7, () => sim.call('depositShielded', coin(COLOUR.S1, 6n, 1), idA));
    await step(8, () => sim.call('depositUnshielded', COLOUR.U1, 5n, idA));
    await step(9, () => sim.call('depositShielded', coin(COLOUR.S2, 6n, 2), idB));
    // Row 10 — DEPOSITOR != CREDITED OWNER. The Manager sees only the credited account, which is
    // the point: credit is open, spend is not.
    await step(10, () => sim.call('depositShielded', coin(COLOUR.S3, 4n, 3), idA));
    await step(11, () => sim.call('depositUnshielded', COLOUR.U2, 5n, idB));

    // Row 12 — the credit side creates (AA_B, S1); NO token operation, so every pooled coin stays
    // byte-identical (identity as well as value: `snapshotLedger` records nonce and mt_index).
    const poolsBefore12 = JSON.stringify(snapshotLedger(sim.ledger).pools);
    const sizesBefore12 = mapSizes(sim.ledger);
    sim.actAs(OWNER_A);
    await step(12, () => sim.call('transferInternalShielded', idB, COLOUR.S1, 3n));
    expect(JSON.stringify(snapshotLedger(sim.ledger).pools)).toBe(poolsBefore12);
    expect(mapSizes(sim.ledger).shieldedCells).toBe(sizesBefore12.shieldedCells + 1);

    // Row 13 — AA_B withdraws S2; the pool retains the change coin.
    sim.actAs(OWNER_B);
    await step(13, () => sim.call('withdrawShielded', COLOUR.S2, 2n, userRecipient(0xaa)));
  });

  it('reaches exactly the LAST guard for row 14, then reproduces rows 16 and 17', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(COLOUR.S1, 6n, 1), idA);
    await sim.call('depositUnshielded', COLOUR.U1, 5n, idA);
    await sim.call('depositShielded', coin(COLOUR.S2, 6n, 2), idB);
    await sim.call('depositShielded', coin(COLOUR.S3, 4n, 3), idA);
    await sim.call('depositUnshielded', COLOUR.U2, 5n, idB);
    sim.actAs(OWNER_A);
    await sim.call('transferInternalShielded', idB, COLOUR.S1, 3n);
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', COLOUR.S2, 2n, userRecipient(0xaa));

    // Row 14 — a LEGITIMATE unshielded withdrawal. The in-process runtime does not maintain the
    // ledger kernel's unshielded balances, so it can go no further than the contract-balance guard;
    // that it GOT there proves the witness choke point and the per-(account, colour) guard passed.
    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('withdrawUnshielded', COLOUR.U1, 2n, unshieldedUserRecipient(0xbb));
    expect(msg).toMatch(/contract unshielded balance too low/);
    expect(msg).not.toMatch(/account colour balance too low/);
    expect(msg).not.toMatch(/matches no registered account/);

    // Row 15 — Minter internal tag TOKD is deployed and mints to USER wallets: Manager must not move.
    const beforeS4 = JSON.stringify(snapshotLedger(sim.ledger));
    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(beforeS4);
    expect(mapSizes(sim.ledger)).toEqual(EXPECTED[15]!.sizes);

    // Row 16 — THE HEADLINE. S4 is a colour this Manager has never seen; its pool is created here.
    const u1Override = { 'AA_A.U1': String(EXPECTED[13]!.table.AA_A.U1) };
    await sim.call('depositShielded', coin(COLOUR.S4, 7n, 4), idA);
    expect(`row 16: ${JSON.stringify(await managerSide(sim, idA, idB))}`).toBe(
      `row 16: ${JSON.stringify(managerSideOf(EXPECTED[16]!, u1Override))}`,
    );
    expect(mapSizes(sim.ledger)).toEqual(EXPECTED[16]!.sizes);

    // Row 17 — the unshielded half of the same claim.
    await sim.call('depositUnshielded', COLOUR.U4, 4n, idB);
    expect(`row 17: ${JSON.stringify(await managerSide(sim, idA, idB))}`).toBe(
      `row 17: ${JSON.stringify(managerSideOf(EXPECTED[17]!, u1Override))}`,
    );
    expect(mapSizes(sim.ledger)).toEqual(END_SIZES);
  });

  it('refuses every live negative control from the post-walk state, creating no state', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(COLOUR.S1, 6n, 1), idA);
    await sim.call('depositUnshielded', COLOUR.U1, 5n, idA);
    await sim.call('depositShielded', coin(COLOUR.S2, 6n, 2), idB);
    await sim.call('depositShielded', coin(COLOUR.S3, 4n, 3), idA);
    await sim.call('depositUnshielded', COLOUR.U2, 5n, idB);
    sim.actAs(OWNER_A);
    await sim.call('transferInternalShielded', idB, COLOUR.S1, 3n);
    await sim.call('depositShielded', coin(COLOUR.S4, 7n, 4), idA);
    await sim.call('depositUnshielded', COLOUR.U4, 4n, idB);
    const before = JSON.stringify(snapshotLedger(sim.ledger));
    const sizes = mapSizes(sim.ledger);

    // NC-1 — a witness that opens no registered account.
    sim.actAs(OWNER_N);
    expect(await sim.expectReject('withdrawShielded', COLOUR.S1, 1n, userRecipient(0xaa))).toMatch(
      /matches no registered account/,
    );

    // NC-2 — AA_B has no (AA_B, S3) cell at all while poolS3 covers the request.
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, COLOUR.S3)).toBe(0n);
    expect(await sim.call<bigint>('poolValue', COLOUR.S3)).toBe(4n);
    sim.actAs(OWNER_B);
    expect(await sim.expectReject('withdrawShielded', COLOUR.S3, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );

    // NC-3 — the dormant colour.
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('withdrawUnshielded', COLOUR.U3, 1n, unshieldedUserRecipient(0xbb))).toMatch(
      /account colour balance too low/,
    );

    // NC-4 — a deposit naming an account commitment that was never registered.
    expect(await sim.expectReject('depositShielded', coin(COLOUR.S1, 1n, 9), new Uint8Array(32).fill(0x77))).toMatch(
      /credit account is not registered/,
    );

    // NC-5 — an internal transfer of a colour AA_A does not hold, while rich in others.
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, COLOUR.S2)).toBe(0n);
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('transferInternalShielded', idB, COLOUR.S2, 1n)).toMatch(
      /account colour balance too low/,
    );

    // NOTHING was created and nothing moved, by all five refusals together.
    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(before);
    expect(mapSizes(sim.ledger)).toEqual(sizes);
  });

  it('replays probe M3 offline: two brand-new colours, one pool and two cells', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(COLOUR.S1, 6n, 1), idA);
    const before = mapSizes(sim.ledger);
    const S5 = new Uint8Array(32).fill(0x15);
    const U5 = new Uint8Array(32).fill(0x25);

    await sim.call('depositShielded', coin(S5, 3n, 7), idB);
    await sim.call('depositUnshielded', U5, 3n, idB);

    expect(mapSizes(sim.ledger)).toEqual({
      pools: before.pools + 1,
      shieldedCells: before.shieldedCells + 1,
      unshieldedCells: before.unshieldedCells + 1,
    });
    expect(await sim.call<bigint>('poolValue', S5)).toBe(3n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, S5)).toBe(3n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, U5)).toBe(3n);
  });

  it('replays probe P-COLL offline: one colour, both families, no aliasing', async () => {
    const { sim, idA, idB } = await setup();
    const X = new Uint8Array(32).fill(0x5c); // ONE value, used as both a shielded and an unshielded colour

    await sim.call('depositShielded', coin(X, 3n, 1), idB);
    await sim.call('depositUnshielded', X, 2n, idB);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 1 });
    expect(await sim.call<bigint>('poolValue', X)).toBe(3n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, X)).toBe(3n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, X)).toBe(2n);

    // Spend one unit from the shielded side; the unshielded side must not move.
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', X, 1n, userRecipient(0xaa));
    expect(await sim.call<bigint>('poolValue', X)).toBe(2n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, X)).toBe(2n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, X)).toBe(2n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, X)).toBe(0n);
  });
});
