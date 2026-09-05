// G2 simulator/unit suite for Manager v3, the OPEN custodian (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// Covers, at unit level, every guard and every lazy-creation claim the live gates depend on:
//
//   FR-201  no colour knowledge, no authority — there is no `configure` circuit to call at all
//   FR-202  lazy creation on FIRST CREDIT only; a refused operation creates NO state
//   FR-203  family-scoped storage — BYTE-IDENTICAL colours in the two families do not alias
//   FR-204  owner-only spend: the witness choke point (NC-1), the per-(account, colour) guard with a
//           MISSING CELL READ AS 0 (NC-2, NC-3), colour-scoped internal transfer (NC-5)
//   FR-205  colours unknown at deploy — a colour invented after the Manager exists is custodied
//   FR-206  a dormant colour reads 0 everywhere and is absent from every map
//
// Every rejection is asserted with `expectReject`, which additionally requires the WHOLE ledger
// snapshot — the account set, every pooled coin's identity and value, every cell in BOTH family maps
// and all three map SIZES — to be byte-identical before and after. Size is what makes it a
// no-state-created proof and not merely a no-value-changed one.
// Custody-guard suite for the open custodian: no colour registry, lazy creation, family separation,
// and the guard order that owner-only spending rests on. Runs entirely in the circuit simulator.
//
// PORTED (2026-08-25, repo reorganization). This suite predates the v5 Manager: it calls the
// contract by the PER-SELECTOR circuit names that v5 deleted (`withdrawShielded`,
// `transferInternalShielded`, `openSwapShielded`, `registerAccount`, ...). It still exercises the
// CURRENT contract, because `tests/lib/sim.ts` translates each of those names into the equivalent
// `execute` action envelope and drives v5's single gateway with it. So the vocabulary is historical
// and the coverage is live: every assertion below is checked against today's compiled Manager.
import { describe, expect, it } from 'vitest';
import { hex, ManagerSim, mapSizes, secretOf, snapshotLedger } from '../lib/sim.js';

// Colours are just 32-byte values to the Manager; it has never been told anything about them.
// S*/U* below are mathematical fixture labels, never outward token names.
const S1 = new Uint8Array(32).fill(0x11);
const S2 = new Uint8Array(32).fill(0x12);
const S3 = new Uint8Array(32).fill(0x13);
const U1 = new Uint8Array(32).fill(0x21);
const U2 = new Uint8Array(32).fill(0x22);
/** The dormant colour: minted by no one, deposited by no one (spec's U3 / NC-3). */
const U3 = new Uint8Array(32).fill(0x23);
/** A colour that will only be invented AFTER the Manager has processed other steps (FR-205). */
const LATE = new Uint8Array(32).fill(0x44);
/** The P-COLL shape: ONE value used as both a shielded and an unshielded colour (FR-203). */
const COLLIDING = new Uint8Array(32).fill(0x55);

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

/** A Manager with AA_A and AA_B registered — and, deliberately, nothing else. */
const setup = async () => {
  const sim = await ManagerSim.create(OWNER_A);
  const idA = await sim.ownerCommitmentFor(OWNER_A);
  const idB = await sim.ownerCommitmentFor(OWNER_B);
  await sim.call('registerAccount', idA);
  await sim.call('registerAccount', idB);
  return { sim, idA, idB };
};

/** Both families' cells for the given colours, as the Manager answers them. */
const table = async (
  sim: ManagerSim,
  ids: Record<string, Uint8Array>,
  shielded: Record<string, Uint8Array>,
  unshielded: Record<string, Uint8Array>,
) => {
  const out: Record<string, Record<string, bigint>> = {};
  for (const [acct, id] of Object.entries(ids)) {
    out[acct] = {};
    for (const [name, colour] of Object.entries(shielded)) {
      out[acct]![name] = await sim.call<bigint>('shieldedAccountBalance', id, colour);
    }
    for (const [name, colour] of Object.entries(unshielded)) {
      out[acct]![name] = await sim.call<bigint>('unshieldedAccountBalance', id, colour);
    }
  }
  return out;
};

describe('Manager v3 — no colour knowledge, no authority (FR-201)', () => {
  it('exposes NO configure circuit and no colour or admin state', async () => {
    const sim = await ManagerSim.create(OWNER_A);
    const circuits = Object.keys((sim as any).contract?.impureCircuits ?? {});
    // The removal is asserted against the COMPILED ARTIFACT, not against the source text: if a
    // colour-binding circuit were reintroduced under any name, these would have to be updated.
    expect(circuits).not.toContain('configure');
    expect(circuits.filter((c) => /configure|admin|allow|colour[SU]|colorS/i.test(c))).toEqual([]);
    const l: any = sim.ledger;
    expect(l.configured).toBeUndefined();
    expect(l.colourS1).toBeUndefined();
    expect(l.colourU1).toBeUndefined();
  });

  it('registers accounts with no configuration step, and seeds NOTHING', async () => {
    const { sim, idA, idB } = await setup();
    expect(sim.ledger.accounts.size()).toBe(2n);
    expect(await sim.call<boolean>('isRegistered', idA)).toBe(true);
    expect(await sim.call<boolean>('isRegistered', idB)).toBe(true);
    // THE visible difference from 00004, which seeded `accounts x 4` cells here.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 0 });
  });

  it('still refuses a duplicate registration, leaving state byte-identical', async () => {
    const { sim, idA } = await setup();
    expect(await sim.expectReject('registerAccount', idA)).toMatch(/account already registered/);
    expect(sim.ledger.accounts.size()).toBe(2n);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 0 });
  });
});

describe('Manager v3 — lazy custody creation (FR-202)', () => {
  it('creates the first pool and the first cell on the FIRST CREDIT, and only then', async () => {
    const { sim, idA } = await setup();
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 0 });

    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });
    expect(await sim.call<bigint>('poolValue', S1)).toBe(6n);

    // A SECOND deposit of the same colour to the same account creates nothing new: it merges.
    await sim.call('depositShielded', coin(S1, 4n, 2), idA);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });
    expect(await sim.call<bigint>('poolValue', S1)).toBe(10n);
  });

  it('creates an unshielded cell — and no pool — on the first unshielded credit', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositUnshielded', U1, 5n, idA);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 1 });
    expect(await sim.call<bigint>('unshieldedAccountBalance', idA, U1)).toBe(5n);
  });

  it('creates the destination cell from the CREDIT SIDE of an internal transfer (spec step 12)', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });

    sim.actAs(OWNER_A);
    await sim.call('transferInternalShielded', idB, S1, 3n);

    // The (AA_B, S1) cell exists now, and it was NOT created by a deposit.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 2, unshieldedCells: 0 });
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, S1)).toBe(3n);
    // …while the pool did not move at all: no token operation occurs in an internal transfer.
    expect(await sim.call<bigint>('poolValue', S1)).toBe(6n);
  });

  it('custodies a colour invented AFTER it has already processed other operations (FR-205)', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    const before = mapSizes(sim.ledger);
    expect(before).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 1 });

    // LATE is a colour the Manager has never seen and could not have been told about.
    await sim.call('depositShielded', coin(LATE, 7n, 9), idA);

    expect(mapSizes(sim.ledger)).toEqual({ pools: 2, shieldedCells: 2, unshieldedCells: 1 });
    expect(await sim.call<bigint>('poolValue', LATE)).toBe(7n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, LATE)).toBe(7n);
    // Nothing already custodied moved.
    expect(await sim.call<bigint>('poolValue', S1)).toBe(6n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idA, U1)).toBe(5n);
  });

  it('removes a fully-spent colour from the pool map without touching the other', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idA);

    sim.actAs(OWNER_A);
    await sim.call('withdrawShielded', S1, 6n, userRecipient(0xaa));

    // The colour LEAVES the pool map …
    expect(await sim.call<boolean>('poolHasColour', S1)).toBe(false);
    expect(await sim.call<boolean>('poolHasColour', S2)).toBe(true);
    // … but its now-zero attribution cell remains, because zero is a value the Manager wrote.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 2, unshieldedCells: 0 });
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, S1)).toBe(0n);
  });
});

describe('Manager v3 — a refused operation creates NO state (FR-202, NC-2/NC-3)', () => {
  it('NC-2 shape: a missing cell reads 0 and is NOT created by the refusal', async () => {
    const { sim, idA, idB } = await setup();
    // Pool S3 = 4 and every unit of it belongs to AA_A. AA_B has no (AA_B, S3) cell at all.
    await sim.call('depositShielded', coin(S3, 4n, 1), idA);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, S3)).toBe(0n);
    // …and merely READING the missing cell did not create it.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });

    sim.actAs(OWNER_B);
    expect(await sim.expectReject('withdrawShielded', S3, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );

    // NO CELL CREATED — this is the assertion 00004 could not make, because it seeded every cell.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });
    expect(await sim.call<bigint>('poolValue', S3)).toBe(4n);
  });

  it('NC-3 shape: a DORMANT colour stays absent from every map after a refused spend', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    const before = JSON.stringify(snapshotLedger(sim.ledger));

    // U3 was minted by no one and deposited by no one.
    expect(await sim.call<bigint>('unshieldedAccountBalance', idA, U3)).toBe(0n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, U3)).toBe(0n);
    expect(await sim.call<boolean>('poolHasColour', U3)).toBe(false);

    sim.actAs(OWNER_A);
    expect(await sim.expectReject('withdrawUnshielded', U3, 1n, unshieldedUserRecipient(0xbb))).toMatch(
      /account colour balance too low/,
    );

    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(before);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 1 });
  });

  it('NC-5 shape: a refused internal transfer does not create the DESTINATION cell', async () => {
    const { sim, idA, idB } = await setup();
    // AA_A is rich in S1 and U1 but holds no S2; AA_B holds all of S2.
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);
    const before = JSON.stringify(snapshotLedger(sim.ledger));

    sim.actAs(OWNER_A);
    expect(await sim.expectReject('transferInternalShielded', idB, S2, 1n)).toMatch(
      /account colour balance too low/,
    );

    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(before);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 2, shieldedCells: 2, unshieldedCells: 1 });
  });

  it('NC-4 shape: a deposit crediting an unregistered account creates nothing at all', async () => {
    const { sim } = await setup();
    const unknown = new Uint8Array(32).fill(0x77);
    expect(await sim.expectReject('depositShielded', coin(S1, 10n, 1), unknown)).toMatch(/not registered/);
    expect(await sim.expectReject('depositUnshielded', U1, 10n, unknown)).toMatch(/not registered/);
    // No pool for S1 was created on the way to discovering the account was bogus.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 0 });
  });

  it('refuses a zero-value credit in both families without creating state', async () => {
    const { sim, idA } = await setup();
    expect(await sim.expectReject('depositShielded', coin(S1, 0n, 1), idA)).toMatch(/deposit must be positive/);
    expect(await sim.expectReject('depositUnshielded', U1, 0n, idA)).toMatch(/deposit must be positive/);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 0 });
  });
});

describe('Manager v3 — family-scoped storage (FR-203, the P-COLL claim)', () => {
  it('derives DIFFERENT keys for the two families from the SAME (account, colour)', async () => {
    const { idA } = await setup();
    // Run the contract's own pure circuits — the harness never reimplements the scheme.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pureCircuits } = await import('../../generated/manager/contract/index.js' as any);
    const sk = hex((pureCircuits as any).shieldedKey(idA, COLLIDING));
    const uk = hex((pureCircuits as any).unshieldedKey(idA, COLLIDING));
    expect(sk).not.toBe(uk);
    expect(sk).toHaveLength(64);
  });

  it('tracks BYTE-IDENTICAL colours independently across the two families', async () => {
    const { sim, idA, idB } = await setup();
    // The exact P-COLL fixture: the same 32 bytes credited 3 shielded and 2 unshielded.
    await sim.call('depositShielded', coin(COLLIDING, 3n, 1), idB);
    await sim.call('depositUnshielded', COLLIDING, 2n, idB);

    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 1 });
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, COLLIDING)).toBe(3n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, COLLIDING)).toBe(2n);
    // The pool is a SHIELDED structure: it holds 3, never 5.
    expect(await sim.call<bigint>('poolValue', COLLIDING)).toBe(3n);

    // Spending one family leaves the other exactly where it was.
    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', COLLIDING, 1n, userRecipient(0xaa));
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, COLLIDING)).toBe(2n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, COLLIDING)).toBe(2n);
    expect(await sim.call<bigint>('poolValue', COLLIDING)).toBe(2n);
    // AA_A never touched this colour in either family.
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, COLLIDING)).toBe(0n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idA, COLLIDING)).toBe(0n);
  });

  it('keeps an unshielded internal transfer out of the shielded map for the same colour', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(COLLIDING, 3n, 1), idA);
    await sim.call('depositUnshielded', COLLIDING, 2n, idA);
    const poolsBefore = JSON.stringify(snapshotLedger(sim.ledger).pools);
    const shieldedBefore = JSON.stringify(snapshotLedger(sim.ledger).shieldedBalances);

    sim.actAs(OWNER_A);
    await sim.call('transferInternalUnshielded', idB, COLLIDING, 2n);

    expect(await sim.call<bigint>('unshieldedAccountBalance', idA, COLLIDING)).toBe(0n);
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, COLLIDING)).toBe(2n);
    // The SHIELDED side of the same colour is byte-identical, cells and pool alike.
    expect(JSON.stringify(snapshotLedger(sim.ledger).shieldedBalances)).toBe(shieldedBefore);
    expect(JSON.stringify(snapshotLedger(sim.ledger).pools)).toBe(poolsBefore);
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, COLLIDING)).toBe(3n);
  });

  it('refuses a shielded spend backed only by the OTHER family’s holding of the same colour', async () => {
    const { sim, idA } = await setup();
    // AA_A holds 5 UNSHIELDED of the colliding colour and 0 shielded.
    await sim.call('depositUnshielded', COLLIDING, 5n, idA);
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('withdrawShielded', COLLIDING, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );
    expect(await sim.call<bigint>('unshieldedAccountBalance', idA, COLLIDING)).toBe(5n);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 1 });
  });
});

describe('Manager v3 — owner-only spend (FR-204, the critical requirement)', () => {
  it('NC-1: a witness that opens no registered account is refused at the choke point', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);

    sim.actAs(OWNER_X); // never registered
    expect(await sim.expectReject('withdrawShielded', S1, 1n, userRecipient(0xaa))).toMatch(
      /matches no registered account/,
    );
    expect(await sim.call<bigint>('poolValue', S1)).toBe(6n);
  });

  it('the per-account guard bites even though the POOL covers the request', async () => {
    const { sim, idA, idB } = await setup();
    // Pool S1 = 9, but AA_B owns only 3 of it. AA_B must not be able to take 6.
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositShielded', coin(S1, 3n, 2), idB);
    expect(await sim.call<bigint>('poolValue', S1)).toBe(9n);

    sim.actAs(OWNER_B);
    expect(await sim.expectReject('withdrawShielded', S1, 6n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );

    expect(await sim.call<bigint>('poolValue', S1)).toBe(9n);
    expect(
      await table(sim, { AA_A: idA, AA_B: idB }, { S1 }, {}),
    ).toEqual({ AA_A: { S1: 6n }, AA_B: { S1: 3n } });
  });

  it('rich in one colour, broke in another — the wealth is unspendable', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    await sim.call('depositUnshielded', U1, 5n, idA);
    await sim.call('depositShielded', coin(S2, 4n, 2), idB);

    sim.actAs(OWNER_A);
    expect(await sim.expectReject('withdrawShielded', S2, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );
    // …and the S2 pool, which demonstrably HAS the value, is untouched.
    expect(await sim.call<bigint>('poolValue', S2)).toBe(4n);
  });

  it('debits the WITNESS owner, never a caller-supplied account', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(S1, 6n, 1), idA);

    // OwnerB is registered but owns nothing of S1; B's witness must not reach A's balance.
    sim.actAs(OWNER_B);
    expect(await sim.expectReject('withdrawShielded', S1, 1n, userRecipient(0xaa))).toMatch(
      /account colour balance too low/,
    );
    expect(await sim.call<bigint>('shieldedAccountBalance', idA, S1)).toBe(6n);
    expect(await sim.call<bigint>('shieldedAccountBalance', idB, S1)).toBe(0n);
  });

  it('guards the unshielded family per account too', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositUnshielded', U1, 10n, idA);
    await sim.call('depositUnshielded', U1, 5n, idB);

    // AA_B owns 5 while the contract holds 15: the per-account guard must still bite, BEFORE the
    // contract-balance guard the simulator cannot satisfy.
    sim.actAs(OWNER_B);
    expect(await sim.expectReject('withdrawUnshielded', U1, 6n, unshieldedUserRecipient(0xbb))).toMatch(
      /account colour balance too low/,
    );
    expect(await sim.call<bigint>('unshieldedAccountBalance', idB, U1)).toBe(5n);
  });

  it('reaches the LAST guard for a legitimate unshielded withdrawal (guard-order proof)', async () => {
    // The in-process runtime does not maintain the ledger KERNEL's unshielded balances, so
    // `unshieldedBalanceGte` is false for any amount and a legitimate withdrawal cannot complete
    // here. That it reaches exactly that guard is the offline proof that the witness choke point and
    // the per-account guard both PASSED — the ordering FR-204 requires.
    const { sim, idA } = await setup();
    await sim.call('depositUnshielded', U1, 5n, idA);
    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('withdrawUnshielded', U1, 5n, unshieldedUserRecipient(0xbb));
    expect(msg).toMatch(/contract unshielded balance too low/);
    expect(msg).not.toMatch(/account colour balance too low/);
    expect(msg).not.toMatch(/matches no registered account/);
  });

  it('rejects an internal transfer to an unregistered account and to self', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(S1, 3n, 1), idA);
    sim.actAs(OWNER_A);
    expect(await sim.expectReject('transferInternalShielded', new Uint8Array(32).fill(0x66), S1, 1n)).toMatch(
      /destination account is not registered/,
    );
    expect(await sim.expectReject('transferInternalShielded', idA, S1, 1n)).toMatch(
      /internal transfer to the same account/,
    );
  });
});

describe('Manager v3 — the per-colour invariant over a DYNAMIC colour set (FR-205)', () => {
  it('pool[c] equals the account column for c after every operation, colours discovered as they arrive', async () => {
    const { sim, idA, idB } = await setup();

    /** The colour set is not known up front: it is whatever the pools map has accumulated. */
    const discoveredShieldedColours = (): string[] => {
      const out: string[] = [];
      for (const [k] of sim.ledger.pools) out.push(hex(k));
      return out.sort();
    };

    const invariant = async (label: string, colours: Uint8Array[]) => {
      for (const colour of colours) {
        const pool = await sim.call<bigint>('poolValue', colour);
        const sum =
          (await sim.call<bigint>('shieldedAccountBalance', idA, colour)) +
          (await sim.call<bigint>('shieldedAccountBalance', idB, colour));
        expect(`${label}/${hex(colour).slice(0, 4)}: ${pool}`).toBe(`${label}/${hex(colour).slice(0, 4)}: ${sum}`);
      }
    };

    expect(discoveredShieldedColours()).toEqual([]);
    await invariant('empty', [S1, S2, LATE]);

    await sim.call('depositShielded', coin(S1, 6n, 1), idA);
    expect(discoveredShieldedColours()).toEqual([hex(S1)]);
    await invariant('after S1 deposit', [S1, S2, LATE]);

    await sim.call('depositShielded', coin(S2, 4n, 2), idB);
    expect(discoveredShieldedColours().length).toBe(2);
    await invariant('after S2 deposit', [S1, S2, LATE]);

    sim.actAs(OWNER_A);
    await sim.call('transferInternalShielded', idB, S1, 3n);
    await invariant('after internal S1 transfer', [S1, S2, LATE]);

    sim.actAs(OWNER_B);
    await sim.call('withdrawShielded', S1, 3n, userRecipient(0xaa));
    await invariant('after S1 withdrawal', [S1, S2, LATE]);

    // A colour that did not exist for any earlier assertion joins the set mid-walk.
    await sim.call('depositShielded', coin(LATE, 7n, 3), idA);
    expect(discoveredShieldedColours().length).toBe(3);
    await invariant('after the LATE colour arrives', [S1, S2, LATE]);

    // Exact map sizes at the end: 3 pools; cells (A,S1) (B,S1) (B,S2) (A,LATE); no unshielded.
    expect(mapSizes(sim.ledger)).toEqual({ pools: 3, shieldedCells: 4, unshieldedCells: 0 });
  });
});
