// Offline dry run of the spec's 14-row step ledger (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// The live gate G3 costs the better part of an hour on a shared host. Two classes of mistake are
// cheap to make and expensive to discover there, and both are caught here in under a second:
//
//   1. a TRANSCRIPTION error in `src/g3/expected.ts` — the one place in the harness that is copied
//      from a document rather than derived. `describe('the transcribed table')` checks it against
//      itself: every colour conserves, every custody figure equals its account column, each row
//      differs from the previous one ONLY where the spec's "(all other cells UNCHANGED)" column
//      says it may, and the last row equals the spec's separately written final table.
//
//   2. a CONTRACT-side mistake in the ordered walk — a colour, an account or an amount in the wrong
//      argument position. `describe('the Manager-side walk')` replays the Manager's half of every
//      row through the compiled artifact in process.
//
// One simulator limitation is recorded rather than papered over: the in-process runtime does not
// maintain the ledger KERNEL's unshielded balances, so `unshieldedBalanceGte` is false for any
// amount and step 12's `withdrawUnshielded` cannot complete here. That guard is the LAST one in the
// circuit, so the walk asserts step 12 reaches exactly it — which is itself the offline proof that
// the witness choke point, the colour check and the per-account guard all passed for a legitimate
// withdrawal — and step 13 is then asserted as a delta, since it touches no cell step 12 changed.
import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  CHANGED,
  COLOUR_KEYS,
  CUSTODY_LABEL,
  EXPECTED,
  FINAL_TABLE,
  MINTED_TOTAL,
  MINTS,
  PARTY_KEYS,
  type ColourKey,
  type ExpectedStep,
} from '../g3/expected.js';
import { ManagerSim, secretOf, snapshotLedger } from './sim.js';

const S1 = new Uint8Array(32).fill(0x11);
const S2 = new Uint8Array(32).fill(0x12);
const U1 = new Uint8Array(32).fill(0x21);
const U2 = new Uint8Array(32).fill(0x22);
const COLOUR: Record<ColourKey, Uint8Array> = { S1, S2, U1, U2 };

const OWNER_A = secretOf('OwnerA');
const OWNER_B = secretOf('OwnerB');

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
  for (const [step, m] of Object.entries(MINTS)) {
    if (Number(step) <= n && m.colour === colour) total += m.amount;
  }
  return total;
};

describe('the transcribed step table (spec, NORMATIVE)', () => {
  it('has all fourteen rows, 0 through 13', () => {
    expect(Object.keys(EXPECTED).map(Number).sort((a, b) => a - b)).toEqual([...Array(14).keys()]);
    expect(Object.keys(ACTIONS).length).toBe(14);
  });

  it('conserves every colour at every row: minted[c] == custody[c] + OwnerN[c] + OwnerM[c]', () => {
    for (let n = 0; n <= 13; n++) {
      const e = EXPECTED[n]!;
      for (const c of COLOUR_KEYS) {
        expect(`step ${n} ${c}: ${e.custody[c] + e.table.OwnerN[c] + e.table.OwnerM[c]}`).toBe(
          `step ${n} ${c}: ${mintedBy(n, c)}`,
        );
      }
    }
  });

  it('satisfies the per-colour invariant at every row: custody[c] == AA_A[c] + AA_B[c]', () => {
    for (let n = 0; n <= 13; n++) {
      const e = EXPECTED[n]!;
      for (const c of COLOUR_KEYS) {
        expect(`step ${n} ${CUSTODY_LABEL[c]}: ${e.custody[c]}`).toBe(
          `step ${n} ${CUSTODY_LABEL[c]}: ${e.table.AA_A[c] + e.table.AA_B[c]}`,
        );
      }
    }
  });

  it('changes ONLY the cells the spec names, at every row', () => {
    for (let n = 1; n <= 13; n++) {
      const prev = EXPECTED[n - 1]!;
      const next = EXPECTED[n]!;
      const allowed = new Set(CHANGED[n]!);
      const moved: string[] = [];
      for (const p of PARTY_KEYS) {
        for (const c of COLOUR_KEYS) if (prev.table[p][c] !== next.table[p][c]) moved.push(`${p}.${c}`);
      }
      for (const c of COLOUR_KEYS) if (prev.custody[c] !== next.custody[c]) moved.push(CUSTODY_LABEL[c]);
      // Every observed move must be allowed …
      expect(`step ${n} moved: ${moved.sort().join(',')}`).toBe(
        `step ${n} moved: ${moved.filter((m) => allowed.has(m)).sort().join(',')}`,
      );
      // … and every named cell must actually be reachable (a name that never moves is a typo in
      // either the table or the CHANGED transcription).
      for (const name of allowed) {
        if (!moved.includes(name)) {
          throw new Error(`step ${n} (${ACTIONS[n]}) names ${name} as changing, but it did not change`);
        }
      }
    }
  });

  it('ends at the spec\'s final table, and every colour sums to 10', () => {
    expect(EXPECTED[13]).toEqual(FINAL_TABLE);
    for (const c of COLOUR_KEYS) {
      const total =
        FINAL_TABLE.table.OwnerN[c] + FINAL_TABLE.table.OwnerM[c] + FINAL_TABLE.table.AA_A[c] + FINAL_TABLE.table.AA_B[c];
      expect(`${c} total: ${total}`).toBe(`${c} total: ${MINTED_TOTAL[c]}`);
      expect(`${c} custody: ${FINAL_TABLE.custody[c]}`).toBe(
        `${c} custody: ${FINAL_TABLE.table.AA_A[c] + FINAL_TABLE.table.AA_B[c]}`,
      );
    }
  });

  it('exercises each rail in at least one colour per family (the spec\'s deliberate non-goals)', () => {
    const named = Object.values(CHANGED).flat();
    // deposits into both accounts, both families
    expect(named).toContain('AA_A.S1');
    expect(named).toContain('AA_B.S2');
    expect(named).toContain('AA_A.U1');
    expect(named).toContain('AA_B.U2');
    // an internal transfer in each family (S1 shielded, U2 unshielded)
    expect(CHANGED[9]).toEqual(['AA_A.S1', 'AA_B.S1']);
    expect(CHANGED[10]).toEqual(['AA_B.U2', 'AA_A.U2']);
    // a withdrawal in each family (S1 shielded, U2 unshielded)
    expect(CHANGED[11]).toContain('poolS1');
    expect(CHANGED[12]).toContain('ledgerU2');
    // step 13 moves TWO colours at once — the mixed-colour probe
    expect(CHANGED[13]).toContain('poolS2');
    expect(CHANGED[13]).toContain('ledgerU2');
  });
});

describe('the Manager-side walk through the compiled contract', () => {
  /** A configured Manager with AA_A and AA_B registered — step 0. */
  const setup = async () => {
    const sim = await ManagerSim.create(OWNER_A);
    await sim.call('configure', S1, S2, U1, U2);
    const idA = await sim.ownerCommitmentFor(OWNER_A);
    const idB = await sim.ownerCommitmentFor(OWNER_B);
    await sim.call('registerAccount', idA);
    await sim.call('registerAccount', idB);
    return { sim, idA, idB };
  };

  /** The eight (account, colour) cells and the two shielded pools, as the Manager sees them. */
  const managerSide = async (sim: ManagerSim, idA: Uint8Array, idB: Uint8Array) => {
    const out: Record<string, string> = {};
    for (const c of COLOUR_KEYS) {
      out[`AA_A.${c}`] = String(await sim.call<bigint>('accountBalance', idA, COLOUR[c]));
      out[`AA_B.${c}`] = String(await sim.call<bigint>('accountBalance', idB, COLOUR[c]));
    }
    out.poolS1 = String(await sim.call<bigint>('poolValue', S1));
    out.poolS2 = String(await sim.call<bigint>('poolValue', S2));
    return out;
  };

  /** The same eight cells and two pools, taken from the transcribed expectation for row `n`. */
  const managerSideOf = (e: ExpectedStep): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of COLOUR_KEYS) {
      out[`AA_A.${c}`] = String(e.table.AA_A[c]);
      out[`AA_B.${c}`] = String(e.table.AA_B[c]);
    }
    out.poolS1 = String(e.custody.S1);
    out.poolS2 = String(e.custody.S2);
    return out;
  };

  it('reproduces rows 0 through 11 exactly', async () => {
    const { sim, idA, idB } = await setup();

    // rows 0-4: the Manager is untouched — every mint goes to a user wallet.
    for (const n of [0, 1, 2, 3, 4]) {
      expect(`row ${n}: ${JSON.stringify(await managerSide(sim, idA, idB))}`).toBe(
        `row ${n}: ${JSON.stringify(managerSideOf(EXPECTED[n]!))}`,
      );
    }

    await sim.call('depositShielded', coin(S1, 6n, 1), idA); // 5
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[5]!));

    await sim.call('depositUnshielded', U1, 5n, idA); // 6
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[6]!));

    await sim.call('depositShielded', coin(S2, 6n, 2), idB); // 7
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[7]!));

    await sim.call('depositUnshielded', U2, 5n, idB); // 8
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[8]!));

    // 9 — internal S1, AA_A -> AA_B: no token operation, so BOTH pooled coins stay byte-identical.
    // Identity as well as value: `snapshotLedger` records every pooled coin's nonce and mt_index.
    const poolsBefore9 = JSON.stringify(snapshotLedger(sim.ledger).pools);
    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, S1, 3n);
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[9]!));
    expect(JSON.stringify(snapshotLedger(sim.ledger).pools)).toBe(poolsBefore9);

    // 10 — internal U2, AA_B -> AA_A. Again no token operation: the pools do not move.
    const poolsBefore10 = JSON.stringify(snapshotLedger(sim.ledger).pools);
    sim.actAs(OWNER_B);
    await sim.call('transferInternal', idA, U2, 2n);
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[10]!));
    expect(JSON.stringify(snapshotLedger(sim.ledger).pools)).toBe(poolsBefore10);

    // 11 — AA_B withdraws S1 3 to a user; the pool retains the change coin.
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', S1, 3n, userRecipient(0xaa));
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[11]!));

    // 12 — the unshielded withdrawal reaches the LAST guard in the circuit, which is the kernel's
    // contract-balance check. The in-process runtime does not maintain kernel balances, so it can go
    // no further here; that it got there proves the witness choke point, the colour check and the
    // per-account guard (AA_A U2 = 2 >= 2) all passed.
    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('withdrawUnshielded', U2, 2n, unshieldedUserRecipient(0xbb));
    expect(msg).toMatch(/contract unshielded balance too low/);
    expect(msg).not.toMatch(/account colour balance too low/);
    expect(msg).not.toMatch(/matches no registered account/);
    expect(msg).not.toMatch(/colour is not a configured/);
    // …and the refusal left the whole table alone.
    expect(await managerSide(sim, idA, idB)).toEqual(managerSideOf(EXPECTED[11]!));
  });

  it('reproduces row 13 (M1) as a delta: two colours move, nothing else does', async () => {
    // Step 13 touches no cell that step 12 changed, so the post-step-11 state is a sound base for
    // asserting its delta even though the simulator cannot perform step 12's kernel-side spend.
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    await sim.call('depositShielded', coin(S2, 6n, 2), idB);
    await sim.call('depositUnshielded', U2, 5n, idB);
    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, S1, 3n);
    sim.actAs(OWNER_B);
    await sim.call('transferInternal', idA, U2, 2n);
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', S1, 3n, userRecipient(0xaa));

    const before = await managerSide(sim, idA, idB);
    const poolS2Before = JSON.stringify(sim.ledger.pools.member(S2));

    // The two legs of the one mixed-colour transaction.
    await sim.call('depositShielded', coin(S2, 2n, 3), idB);
    await sim.call('depositUnshielded', U2, 2n, idB);
    const after = await managerSide(sim, idA, idB);

    // AA_B gains 2 of S2 and 2 of U2; poolS2 merges 6 + 2 = 8; NOTHING else moves.
    expect(after['AA_B.S2']).toBe('8');
    expect(after['AA_B.U2']).toBe('5');
    expect(after.poolS2).toBe('8');
    expect(poolS2Before).toBe('true'); // the merge path, not a fresh pool
    for (const key of Object.keys(before)) {
      if (['AA_B.S2', 'AA_B.U2', 'poolS2'].includes(key)) continue;
      expect(`${key}: ${after[key]}`).toBe(`${key}: ${before[key]}`);
    }
    // and the final AA half of the table is exactly the spec's.
    expect(after['AA_A.S1']).toBe(String(FINAL_TABLE.table.AA_A.S1));
    expect(after['AA_A.U1']).toBe(String(FINAL_TABLE.table.AA_A.U1));
    expect(after['AA_B.S2']).toBe(String(FINAL_TABLE.table.AA_B.S2));
    expect(after.poolS1).toBe(String(FINAL_TABLE.custody.S1));
    expect(after.poolS2).toBe(String(FINAL_TABLE.custody.S2));
  });

  it('refuses every live negative control from the post-step-13 state', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    await sim.call('depositShielded', coin(S2, 6n, 2), idB);
    await sim.call('depositUnshielded', U2, 5n, idB);
    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, S1, 3n);
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', S1, 3n, userRecipient(0xaa));
    const CONTROL_COLOUR = new Uint8Array(32).fill(0x99); // stands in for a Minter3 colour

    // NC-1 — a witness that opens no registered account.
    sim.actAs(secretOf('OwnerN-unregistered'));
    expect(await sim.expectReject('withdrawShielded', S1, 1n, userRecipient(0xaa))).toMatch(
      /matches no registered account/,
    );

    // NC-2 — OwnerB's witness while AA_B holds 0 of S1 and the pool holds 3.
    expect(await sim.call<bigint>('accountBalance', idB, S1)).toBe(0n);
    expect(await sim.call<bigint>('poolValue', S1)).toBe(3n);
    sim.actAs(OWNER_B);
    expect(await sim.expectReject('withdrawShielded', S1, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );

    // NC-3 — AA_A is rich in U1 and S1 but holds no S2.
    expect(await sim.call<bigint>('accountBalance', idA, U1)).toBe(5n);
    expect(await sim.call<bigint>('accountBalance', idA, S2)).toBe(0n);
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('withdrawShielded', S2, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );

    // NC-4a / NC-4b — a colour `configure` never admitted, named and carried.
    expect(await sim.expectReject('depositUnshielded', CONTROL_COLOUR, 1n, idA)).toMatch(
      /colour is not a configured unshielded colour/,
    );
    expect(await sim.expectReject('depositShielded', coin(CONTROL_COLOUR, 2n, 9), idB)).toMatch(
      /colour is not a configured shielded colour/,
    );

    // NC-5 — the internal-transfer colour guard.
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('transferInternal', idB, S2, 1n)).toMatch(/account colour balance too low/);

    // M2's second leg, in isolation: the wrong-coloured half of the step-13 shape.
    expect(await sim.expectReject('depositUnshielded', CONTROL_COLOUR, 2n, idB)).toMatch(
      /colour is not a configured unshielded colour/,
    );
  });
});
