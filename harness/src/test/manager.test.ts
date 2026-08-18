// G2 simulator/unit suite for the multi-colour Manager (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// Covers, at unit level, every guard the spec's live negative controls depend on:
//
//   FR-102  one-time configure, reconfiguration and duplicate colours rejected
//   FR-103  colour-keyed custody: one pooled coin PER shielded colour, per-(account, colour)
//           balances, exact `balances.size() == accounts * 4`
//   FR-104  owner-only spend: witness choke point (NC-1), per-account guard with a RICH pool
//           (NC-2), cross-colour poverty (NC-3), colour-scoped internal transfer (NC-5)
//   FR-105  cross-colour isolation: every operation leaves every other colour byte-identical
//   FR-106  wrong colour rejected wherever it is named or carried (NC-4)
//
// Every rejection is asserted with `expectReject`, which additionally requires the WHOLE ledger
// snapshot — configured colours, every pooled coin's identity and value, every balance entry — to
// be byte-identical before and after.
import { describe, expect, it } from 'vitest';
import { hex, ManagerSim, secretOf, snapshotLedger } from './sim.js';

// Four configured colours plus one that is never configured (the Minter3 control shape).
const S1 = new Uint8Array(32).fill(0x11);
const S2 = new Uint8Array(32).fill(0x12);
const U1 = new Uint8Array(32).fill(0x21);
const U2 = new Uint8Array(32).fill(0x22);
const UNCONFIGURED = new Uint8Array(32).fill(0x99);

const OWNER_A = secretOf('OwnerA');
const OWNER_B = secretOf('OwnerB');
const OWNER_X = secretOf('OwnerX-unregistered');

const nonce = (n: number) => new Uint8Array(32).fill(n);
const coin = (colour: Uint8Array, value: bigint, n: number) => ({ nonce: nonce(n), color: colour, value });

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

/** A configured Manager with AA_A and AA_B registered. */
const setup = async () => {
  const sim = await ManagerSim.create(OWNER_A);
  await sim.call('configure', S1, S2, U1, U2);
  const idA = await sim.ownerCommitmentFor(OWNER_A);
  const idB = await sim.ownerCommitmentFor(OWNER_B);
  await sim.call('registerAccount', idA);
  await sim.call('registerAccount', idB);
  return { sim, idA, idB };
};

/** The full 2-account x 4-colour table as the Manager sees it. */
const table = async (sim: ManagerSim, idA: Uint8Array, idB: Uint8Array) => {
  const out: Record<string, Record<string, bigint>> = { AA_A: {}, AA_B: {} };
  for (const [name, colour] of [
    ['S1', S1],
    ['S2', S2],
    ['U1', U1],
    ['U2', U2],
  ] as const) {
    out.AA_A[name] = await sim.call<bigint>('accountBalance', idA, colour);
    out.AA_B[name] = await sim.call<bigint>('accountBalance', idB, colour);
  }
  return out;
};

describe('Manager — configuration (FR-102)', () => {
  it('configures once and rejects reconfiguration', async () => {
    const sim = await ManagerSim.create(OWNER_A);
    await sim.call('configure', S1, S2, U1, U2);
    expect(sim.ledger.configured).toBe(true);
    expect(hex(sim.ledger.colourS1)).toBe(hex(S1));
    expect(hex(sim.ledger.colourU2)).toBe(hex(U2));

    const msg = await sim.expectReject('configure', S1, S2, U1, U2);
    expect(msg).toMatch(/already configured/);
  });

  it('rejects a duplicate colour in any of the six pairwise positions', async () => {
    // Same colour offered twice must never be admitted, in any pair of slots.
    for (const args of [
      [S1, S1, U1, U2],
      [S1, S2, S1, U2],
      [S1, S2, U1, S1],
      [S1, S2, S2, U2],
      [S1, S2, U1, S2],
      [S1, S2, U1, U1],
    ] as const) {
      const sim = await ManagerSim.create(OWNER_A);
      const msg = await sim.expectReject('configure', ...args);
      expect(msg).toMatch(/duplicate colour in configure/);
      expect(sim.ledger.configured).toBe(false);
    }
  });

  it('refuses registration before configuration', async () => {
    const sim = await ManagerSim.create(OWNER_A);
    const idA = await sim.ownerCommitmentFor(OWNER_A);
    const msg = await sim.expectReject('registerAccount', idA);
    expect(msg).toMatch(/manager not configured/);
  });
});

describe('Manager — registration seeds the whole table (FR-103)', () => {
  it('seeds four zero balances per account and rejects duplicates', async () => {
    const { sim, idA } = await setup();
    expect(sim.ledger.accounts.size()).toBe(2n);
    // The exactness that makes the table enumerable: 2 accounts x 4 colours, nothing else.
    expect(sim.ledger.balances.size()).toBe(8n);
    expect(await sim.call<boolean>('isRegistered', idA)).toBe(true);

    const msg = await sim.expectReject('registerAccount', idA);
    expect(msg).toMatch(/already registered/);
    expect(sim.ledger.accounts.size()).toBe(2n);
    expect(sim.ledger.balances.size()).toBe(8n);
  });

  it('starts every cell of the table at zero with no pools', async () => {
    const { sim, idA, idB } = await setup();
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 0n, S2: 0n, U1: 0n, U2: 0n },
      AA_B: { S1: 0n, S2: 0n, U1: 0n, U2: 0n },
    });
    expect(sim.ledger.pools.size()).toBe(0n);
    expect(await sim.call<boolean>('poolHasColour', S1)).toBe(false);
    expect(await sim.call<bigint>('poolValue', S2)).toBe(0n);
  });
});

describe('Manager — per-colour shielded custody (FR-103, FR-105)', () => {
  it('pools each shielded colour separately and credits only the coin’s own colour', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);

    expect(sim.ledger.pools.size()).toBe(2n);
    expect(await sim.call<bigint>('poolValue', S1)).toBe(6n);
    expect(await sim.call<bigint>('poolValue', S2)).toBe(4n);
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 6n, S2: 0n, U1: 0n, U2: 0n },
      AA_B: { S1: 0n, S2: 4n, U1: 0n, U2: 0n },
    });
  });

  it('merges a second deposit of the SAME colour and leaves the other colour byte-identical', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);

    const before = snapshotLedger(sim.ledger);
    const s1NonceBefore = before.pools[hex(S1)] as any;

    await sim.call('depositShielded', coin(S2, 4n, 3), idB);

    const after = snapshotLedger(sim.ledger);
    // S2 merged into ONE coin of the combined value, with a new identity …
    expect(await sim.call<bigint>('poolValue', S2)).toBe(8n);
    expect(sim.ledger.pools.size()).toBe(2n);
    expect((after.pools[hex(S2)] as any).nonce).not.toBe((before.pools[hex(S2)] as any).nonce);
    // … while S1's pooled coin did not move at all — that is the cross-colour isolation claim.
    expect(after.pools[hex(S1)]).toEqual(s1NonceBefore);
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 6n, S2: 0n, U1: 0n, U2: 0n },
      AA_B: { S1: 0n, S2: 8n, U1: 0n, U2: 0n },
    });
  });

  it('pays out of one colour, retains change, and leaves the sibling colour untouched', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);
    const s2Before = snapshotLedger(sim.ledger).pools[hex(S2)];

    sim.actAs(OWNER_A);
    await sim.call('withdrawShielded', S1, 2n, userRecipient(0xaa));

    expect(await sim.call<bigint>('poolValue', S1)).toBe(4n);
    expect(await sim.call<bigint>('poolValue', S2)).toBe(4n);
    expect(snapshotLedger(sim.ledger).pools[hex(S2)]).toEqual(s2Before);
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 4n, S2: 0n, U1: 0n, U2: 0n },
      AA_B: { S1: 0n, S2: 4n, U1: 0n, U2: 0n },
    });
  });

  it('removes a fully-spent colour from the pool map (empty-change arm) without touching the other', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);

    sim.actAs(OWNER_A);
    await sim.call('withdrawShielded', S1, 6n, userRecipient(0xaa));

    // The colour LEAVES the map — no companion presence flag to fall out of step.
    expect(await sim.call<boolean>('poolHasColour', S1)).toBe(false);
    expect(sim.ledger.pools.size()).toBe(1n);
    expect(await sim.call<boolean>('poolHasColour', S2)).toBe(true);
    expect(await sim.call<bigint>('poolValue', S2)).toBe(4n);
    // The emptied account stays registered and reusable, with its four cells intact.
    expect(await sim.call<boolean>('isRegistered', idA)).toBe(true);
    expect(sim.ledger.balances.size()).toBe(8n);
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 0n, S2: 0n, U1: 0n, U2: 0n },
      AA_B: { S1: 0n, S2: 4n, U1: 0n, U2: 0n },
    });
  });
});

describe('Manager — wrong colour is rejected (FR-106, NC-4)', () => {
  it('rejects a shielded deposit carrying an unconfigured colour', async () => {
    const { sim, idA } = await setup();
    const msg = await sim.expectReject('depositShielded', coin(UNCONFIGURED, 10n, 1), idA);
    expect(msg).toMatch(/colour is not a configured shielded colour/);
  });

  it('rejects a shielded deposit carrying a configured UNSHIELDED colour', async () => {
    // U1 is configured, but not as a shielded colour: the families are not interchangeable.
    const { sim, idA } = await setup();
    const msg = await sim.expectReject('depositShielded', coin(U1, 10n, 1), idA);
    expect(msg).toMatch(/colour is not a configured shielded colour/);
  });

  it('rejects an unshielded deposit naming an unconfigured colour', async () => {
    const { sim, idA } = await setup();
    const msg = await sim.expectReject('depositUnshielded', UNCONFIGURED, 10n, idA);
    expect(msg).toMatch(/colour is not a configured unshielded colour/);
  });

  it('rejects a withdrawal naming an unconfigured colour', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('withdrawShielded', UNCONFIGURED, 1n, userRecipient(0xaa))).toMatch(
      /colour is not a configured shielded colour/,
    );
    expect(await sim.expectReject('withdrawUnshielded', UNCONFIGURED, 1n, unshieldedUserRecipient(0xbb))).toMatch(
      /colour is not a configured unshielded colour/,
    );
  });

  it('rejects an internal transfer naming an unconfigured colour', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('transferInternal', idB, UNCONFIGURED, 1n);
    expect(msg).toMatch(/colour is not configured/);
  });

  it('rejects a deposit crediting an unregistered account', async () => {
    const { sim } = await setup();
    const unknown = new Uint8Array(32).fill(0x77);
    const msg = await sim.expectReject('depositShielded', coin(S1, 10n, 1), unknown);
    expect(msg).toMatch(/not registered/);
  });
});

describe('Manager — owner-only spend (FR-104, the critical requirement)', () => {
  it('NC-1 shape: a witness that opens no registered account is refused at the choke point', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);

    sim.actAs(OWNER_X); // never registered
    const msg = await sim.expectReject('withdrawShielded', S1, 1n, userRecipient(0xaa));
    expect(msg).toMatch(/matches no registered account/);
    expect(await sim.call<bigint>('poolValue', S1)).toBe(6n);
  });

  it('NC-2 shape: the PER-ACCOUNT guard bites even though the POOL covers the request', async () => {
    const { sim, idA, idB } = await setup();
    // Pool S1 = 9, but AA_B owns 3 of it. AA_B must not be able to take 6.
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S1, 3n, 2), idB);
    expect(await sim.call<bigint>('poolValue', S1)).toBe(9n);

    sim.actAs(OWNER_B);
    const msg = await sim.expectReject('withdrawShielded', S1, 6n, userRecipient(0xaa));
    expect(msg).toMatch(/account colour balance too low/);

    // Funds AND attribution unchanged.
    expect(await sim.call<bigint>('poolValue', S1)).toBe(9n);
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 6n, S2: 0n, U1: 0n, U2: 0n },
      AA_B: { S1: 3n, S2: 0n, U1: 0n, U2: 0n },
    });
  });

  it('NC-3 shape: rich in one colour, broke in another — the wealth is unspendable', async () => {
    const { sim, idA, idB } = await setup();
    // AA_A is rich in S1 and in U1; AA_B holds all of S2. AA_A must not reach S2 at all.
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);

    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('withdrawShielded', S2, 1n, userRecipient(0xaa));
    expect(msg).toMatch(/account colour balance too low/);

    // …and the S2 pool, which demonstrably HAS the value, is untouched.
    expect(await sim.call<bigint>('poolValue', S2)).toBe(4n);
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 6n, S2: 0n, U1: 5n, U2: 0n },
      AA_B: { S1: 0n, S2: 4n, U1: 0n, U2: 0n },
    });
  });

  it('debits the WITNESS owner, never a caller-supplied account (wrong-owner witness)', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);

    // OwnerB is registered but owns nothing of S1; B's witness must not reach A's balance.
    sim.actAs(OWNER_B);
    const msg = await sim.expectReject('withdrawShielded', S1, 1n, userRecipient(0xaa));
    expect(msg).toMatch(/account colour balance too low/);
    expect(await sim.call<bigint>('accountBalance', idA, S1)).toBe(6n);
    expect(await sim.call<bigint>('accountBalance', idB, S1)).toBe(0n);
  });

  it('guards the unshielded family per account too', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositUnshielded', U1, 10n, idA);
    await sim.call('depositUnshielded', U1, 5n, idB);
    expect(await sim.call<bigint>('accountBalance', idA, U1)).toBe(10n);

    // AA_B owns 5 while the contract holds 15: the per-account guard must still bite.
    sim.actAs(OWNER_B);
    const msg = await sim.expectReject('withdrawUnshielded', U1, 6n, unshieldedUserRecipient(0xbb));
    expect(msg).toMatch(/account colour balance too low/);
    expect(await sim.call<bigint>('accountBalance', idB, U1)).toBe(5n);
  });
});

describe('Manager — internal transfer is colour-scoped and ledger-neutral (FR-105, NC-5)', () => {
  it('moves attribution in ONE colour while every pooled coin stays byte-identical', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);
    await sim.call('depositUnshielded', U1, 5n, idA);

    const before = snapshotLedger(sim.ledger);
    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, S1, 3n);
    const after = snapshotLedger(sim.ledger);

    // Attribution moved …
    expect(await table(sim, idA, idB)).toEqual({
      AA_A: { S1: 3n, S2: 0n, U1: 5n, U2: 0n },
      AA_B: { S1: 3n, S2: 4n, U1: 0n, U2: 0n },
    });
    // … while NO pooled coin moved: no token operation happens in an internal transfer.
    expect(after.pools).toEqual(before.pools);
    expect(after.balanceCount).toBe(before.balanceCount);
  });

  it('NC-5 shape: refuses a colour the sender does not hold, while it holds others', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);

    sim.actAs(OWNER_A); // AA_A holds S1=6 and U1=5, but S2=0
    const msg = await sim.expectReject('transferInternal', idB, S2, 1n);
    expect(msg).toMatch(/account colour balance too low/);
    expect(await sim.call<bigint>('accountBalance', idA, S1)).toBe(6n);
    expect(await sim.call<bigint>('accountBalance', idA, U1)).toBe(5n);
  });

  it('rejects an internal transfer to an unregistered account and to self', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 3n, 1), idA);
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('transferInternal', new Uint8Array(32).fill(0x66), S1, 1n)).toMatch(
      /destination account is not registered/,
    );
    expect(await sim.expectReject('transferInternal', idA, S1, 1n)).toMatch(/internal transfer to the same account/);
  });

  it('moves unshielded attribution internally without touching the contract’s holdings', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositUnshielded', U2, 5n, idA);
    const before = snapshotLedger(sim.ledger);

    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, U2, 2n);

    expect(await sim.call<bigint>('accountBalance', idA, U2)).toBe(3n);
    expect(await sim.call<bigint>('accountBalance', idB, U2)).toBe(2n);
    expect(snapshotLedger(sim.ledger).pools).toEqual(before.pools);
  });
});

describe('Manager — the per-colour invariant holds cell by cell (FR-105)', () => {
  it('pool[c] equals the sum of the account column for c, after every operation', async () => {
    const { sim, idA, idB } = await setup();

    const invariant = async (label: string) => {
      for (const colour of [S1, S2]) {
        const pool = await sim.call<bigint>('poolValue', colour);
        const sum =
          (await sim.call<bigint>('accountBalance', idA, colour)) +
          (await sim.call<bigint>('accountBalance', idB, colour));
        expect(`${label}/${hex(colour).slice(0, 4)}: ${pool}`).toBe(`${label}/${hex(colour).slice(0, 4)}: ${sum}`);
      }
    };

    await invariant('empty');
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await invariant('after S1 deposit');
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);
    await invariant('after S2 deposit');
    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, S1, 3n);
    await invariant('after internal S1 transfer');
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', S1, 3n, userRecipient(0xaa));
    await invariant('after S1 withdrawal');
    await sim.call('depositShielded', coin(S2, 2n, 3), idB);
    await invariant('after S2 merge deposit');
  });
});
