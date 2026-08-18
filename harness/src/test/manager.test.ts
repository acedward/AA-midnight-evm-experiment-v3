// G2 simulator/unit suite for the Manager (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// Covers every guard the spec's negative controls depend on:
//   registration + duplicate rejection, per-account overdraw WITH a sufficient pool,
//   wrong-owner witness, internal-transfer neutrality, self-send neutrality, merge-on-deposit,
//   the empty-change arm, and tag-aware color rejection.
import { describe, expect, it } from 'vitest';
import { ManagerSim, secretOf, snapshotLedger } from './sim.js';

const SHIELDED_COLOR = new Uint8Array(32).fill(0x11);
const UNSHIELDED_COLOR = new Uint8Array(32).fill(0x22);
const OTHER_COLOR = new Uint8Array(32).fill(0x99);

const OWNER_A = secretOf('OwnerA');
const OWNER_B = secretOf('OwnerB');
const OWNER_X = secretOf('OwnerX-unregistered');

const nonce = (n: number) => new Uint8Array(32).fill(n);
const coin = (color: Uint8Array, value: bigint, n: number) => ({ nonce: nonce(n), color, value });

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

/** A configured Manager with AA_A and AA_B registered. Returns the sim and both account ids. */
const setup = async () => {
  const sim = await ManagerSim.create(OWNER_A);
  await sim.call('configure', SHIELDED_COLOR, UNSHIELDED_COLOR);

  // Account ids are commitments to each owner secret; derive them the way the contract does by
  // registering under the id the contract computes for that witness.
  const idA = await sim.ownerCommitmentFor(OWNER_A);
  const idB = await sim.ownerCommitmentFor(OWNER_B);
  await sim.call('registerAccount', idA);
  await sim.call('registerAccount', idB);
  return { sim, idA, idB };
};

describe('Manager — configuration and registration', () => {
  it('configures once and rejects reconfiguration', async () => {
    const sim = await ManagerSim.create(OWNER_A);
    await sim.call('configure', SHIELDED_COLOR, UNSHIELDED_COLOR);
    expect(sim.ledger.configured).toBe(true);
    const msg = await sim.expectReject('configure', SHIELDED_COLOR, UNSHIELDED_COLOR);
    expect(msg).toMatch(/already configured/);
  });

  it('registers accounts and rejects duplicates', async () => {
    const { sim, idA } = await setup();
    expect(sim.ledger.accounts.size()).toBe(2n);
    expect(await sim.call<boolean>('isRegistered', idA)).toBe(true);
    const msg = await sim.expectReject('registerAccount', idA);
    expect(msg).toMatch(/already registered/);
    expect(sim.ledger.accounts.size()).toBe(2n);
  });

  it('starts every account at zero and the pool empty', async () => {
    const { sim, idA, idB } = await setup();
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(0n);
    expect(await sim.call<bigint>('accountUnshielded', idB)).toBe(0n);
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(0n);
    expect(sim.ledger.hasPool).toBe(false);
  });
});

describe('Manager — shielded custody', () => {
  it('credits a deposit to the named account and pools the coin', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(10n);
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(10n);
    expect(sim.ledger.hasPool).toBe(true);
  });

  it('merges a second deposit into the single pooled coin', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    const poolNonceBefore = Buffer.from(sim.ledger.pool.nonce).toString('hex');

    await sim.call('depositShielded', coin(SHIELDED_COLOR, 5n, 2), idB);

    // One coin, combined value, and a different coin identity: that is the merge.
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(15n);
    expect(Buffer.from(sim.ledger.pool.nonce).toString('hex')).not.toBe(poolNonceBefore);
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(10n);
    expect(await sim.call<bigint>('accountShielded', idB)).toBe(5n);
  });

  it('rejects a deposit of the wrong color (tag-aware, not byte-blind)', async () => {
    const { sim, idA } = await setup();
    const msg = await sim.expectReject('depositShielded', coin(OTHER_COLOR, 10n, 1), idA);
    expect(msg).toMatch(/wrong color/);
  });

  it('rejects a deposit crediting an unregistered account', async () => {
    const { sim } = await setup();
    const unknown = new Uint8Array(32).fill(0x77);
    const msg = await sim.expectReject('depositShielded', coin(SHIELDED_COLOR, 10n, 1), unknown);
    expect(msg).toMatch(/not registered/);
  });

  it('pays out and retains change', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    sim.actAs(OWNER_A);
    await sim.call('withdrawShielded', 4n, userRecipient(0xaa));

    expect(await sim.call<bigint>('accountShielded', idA)).toBe(6n);
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(6n);
    expect(sim.ledger.hasPool).toBe(true);
  });

  it('empties the pool on a full-value withdraw (empty-change arm)', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    sim.actAs(OWNER_A);
    await sim.call('withdrawShielded', 10n, userRecipient(0xaa));

    expect(await sim.call<bigint>('accountShielded', idA)).toBe(0n);
    expect(sim.ledger.hasPool).toBe(false);
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(0n);
    // The emptied account stays registered and reusable (spec: steps 7–8 re-credit emptied AA_A).
    expect(await sim.call<boolean>('isRegistered', idA)).toBe(true);
  });
});

describe('Manager — ownership-integrity guards (the negative controls)', () => {
  it('rejects a per-account overdraw EVEN WHEN THE POOL HOLDS MORE', async () => {
    const { sim, idA, idB } = await setup();
    // Pool = 15, but AA_A owns only 5. AA_A must not be able to spend 10.
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 5n, 1), idA);
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 2), idB);
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(15n);

    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('withdrawShielded', 10n, userRecipient(0xaa));
    expect(msg).toMatch(/account shielded balance too low/);

    // Funds AND attribution unchanged.
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(15n);
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(5n);
    expect(await sim.call<bigint>('accountShielded', idB)).toBe(10n);
  });

  it('rejects an unregistered owner witness', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);

    sim.actAs(OWNER_X); // never registered
    const msg = await sim.expectReject('withdrawShielded', 1n, userRecipient(0xaa));
    expect(msg).toMatch(/matches no registered account/);
    expect(await sim.call<bigint>('poolShieldedValue')).toBe(10n);
  });

  it('debits the witness owner, never another account (wrong-owner witness)', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);

    // OwnerB is registered but owns nothing; B's witness must not reach A's balance.
    sim.actAs(OWNER_B);
    const msg = await sim.expectReject('withdrawShielded', 1n, userRecipient(0xaa));
    expect(msg).toMatch(/account shielded balance too low/);
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(10n);
    expect(await sim.call<bigint>('accountShielded', idB)).toBe(0n);
  });
});

describe('Manager — internal ownership transfer is ledger-neutral', () => {
  it('moves attribution while the pooled coin stays byte-identical', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);

    const before = snapshotLedger(sim.ledger);
    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, true, 4n);
    const after = snapshotLedger(sim.ledger);

    // Attribution moved …
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(6n);
    expect(await sim.call<bigint>('accountShielded', idB)).toBe(4n);
    // … while the pooled coin — nonce, colour, value, index — did not move at all.
    expect(after.pool).toEqual(before.pool);
    expect(after.hasPool).toBe(before.hasPool);
  });

  it('rejects an internal transfer above the sender account balance', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 3n, 1), idA);
    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('transferInternal', idB, true, 4n);
    expect(msg).toMatch(/account shielded balance too low/);
  });

  it('rejects an internal transfer to an unregistered account', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 3n, 1), idA);
    sim.actAs(OWNER_A);
    const msg = await sim.expectReject('transferInternal', new Uint8Array(32).fill(0x66), true, 1n);
    expect(msg).toMatch(/destination account is not registered/);
  });
});

describe('Manager — unshielded custody', () => {
  it('credits, pays out and guards per account', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositUnshielded', UNSHIELDED_COLOR, 10n, idA);
    await sim.call('depositUnshielded', UNSHIELDED_COLOR, 5n, idB);
    expect(await sim.call<bigint>('accountUnshielded', idA)).toBe(10n);

    // AA_B owns 5 while the contract balance is 15: the per-account guard must still bite.
    sim.actAs(OWNER_B);
    const msg = await sim.expectReject('withdrawUnshielded', UNSHIELDED_COLOR, 6n, unshieldedUserRecipient(0xbb));
    expect(msg).toMatch(/account unshielded balance too low/);
    expect(await sim.call<bigint>('accountUnshielded', idB)).toBe(5n);
  });

  it('rejects the wrong unshielded color', async () => {
    const { sim, idA } = await setup();
    const msg = await sim.expectReject('depositUnshielded', OTHER_COLOR, 10n, idA);
    expect(msg).toMatch(/wrong color/);
  });

  it('moves unshielded attribution internally without touching the ledger balance', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositUnshielded', UNSHIELDED_COLOR, 10n, idA);
    const before = snapshotLedger(sim.ledger);

    sim.actAs(OWNER_A);
    await sim.call('transferInternal', idB, false, 4n);

    expect(await sim.call<bigint>('accountUnshielded', idA)).toBe(6n);
    expect(await sim.call<bigint>('accountUnshielded', idB)).toBe(4n);
    expect(snapshotLedger(sim.ledger).pool).toEqual(before.pool);
  });
});

describe('Manager — self-send is balance- and ownership-neutral', () => {
  it('rotates the pooled coin identity while every balance stays identical (shielded)', async () => {
    const { sim, idA, idB } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 5n, 2), idB);

    const before = snapshotLedger(sim.ledger);
    const aBefore = await sim.call<bigint>('accountShielded', idA);
    const bBefore = await sim.call<bigint>('accountShielded', idB);

    sim.actAs(OWNER_B); // authorised by an account holder; ownership-neutral by construction
    await sim.call('selfSendShielded');

    const after = snapshotLedger(sim.ledger);
    // Value and attribution unchanged …
    expect(after.pool.value).toBe(before.pool.value);
    expect(await sim.call<bigint>('accountShielded', idA)).toBe(aBefore);
    expect(await sim.call<bigint>('accountShielded', idB)).toBe(bBefore);
    expect(after.hasPool).toBe(true);
    // … while the coin identifiers changed. That change IS the evidence.
    expect(after.pool.nonce).not.toBe(before.pool.nonce);
  });

  it('rejects a self-send authorised by an account with no balance', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    sim.actAs(OWNER_B); // registered but holds nothing
    const msg = await sim.expectReject('selfSendShielded');
    expect(msg).toMatch(/authorizing account holds no shielded balance/);
  });

  it('rejects a self-send when the pool is empty', async () => {
    const { sim, idA } = await setup();
    await sim.call('depositShielded', coin(SHIELDED_COLOR, 10n, 1), idA);
    sim.actAs(OWNER_A);
    await sim.call('withdrawShielded', 10n, userRecipient(0xaa)); // empties the pool
    const msg = await sim.expectReject('selfSendShielded');
    expect(msg).toMatch(/authorizing account holds no shielded balance|pool holds no shielded coin/);
  });
});
