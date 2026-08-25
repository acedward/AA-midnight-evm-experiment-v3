// G2 simulator/unit suite for Manager v4's SWAP MAKER circuit (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// 00006 Plan 02 Phase 1. 00005's suite (`manager.test.ts`) is left untouched and still runs, so
// "v4 extends v3, never weakens it" is a fact about a passing file rather than a claim.
//
// ONE CIRCUIT, TWO SHAPES. Manager v4 adds a single provable circuit, `openSwapShielded`, whose
// `recipientA: Maybe<Either<ZswapCoinPublicKey, ContractAddress>>` argument selects which FR-308 shape
// the offer takes. That is a MEASURED lane constraint, finding F-307, not a stylistic choice: a
// bracket of probe contracts deployed live puts the deploy ceiling between 13 and 14 provable
// circuits, and v3 already had 12. The alternative was deleting v3 circuits to make room, which Plan
// 02 Phase 1 forbids.
//
// WHAT THIS FILE PROVES WITHOUT A CHAIN, AND WHY THAT IS WORTH DOING
//
// A swap offer's correctness is, at bottom, a statement about ZSWAP STRUCTURE:
//
//   some(key)   the A leg is INTERNALLY BALANCED (input, payout, change), so the only imbalance the
//               offer carries is the −B deficit.
//   none        the A leg leaves a POSITIVE imbalance addressed to nobody, which is what lets a taker
//               whose keys the maker never knew sweep it.
//
// The pinned `@midnight-ntwrk/compact-runtime` records exactly that — every zswap input, every output
// with its recipient, and the effects the circuit claimed — so both statements are measured here,
// offline, per colour. That matters for two reasons. First, `imbalances(0)` on a live artifact (the
// FR-302 assert) tells you the NET per colour but not the shape that produced it; a circuit that
// accidentally paid the surplus to a fixed key would still show a plausible net. Second, when a live
// spike is refused, having the offline structure pinned lets the refusal be attributed to a layer —
// proof server, `wellFormed`, node — instead of guessed at.
//
// It also proves the piece of v4 most likely to be silently wrong: the surplus branch transcribes the
// standard library's PRIVATE `coinNullifier` and `coinCommitment` (unexported at
// `standard-library.compact:252`/`:265`), because `sendShielded` is the only exported route to a
// zswap input and it always creates an output for the value it moves. The first test compares the
// transcription against the values the STDLIB ITSELF claims for the same coin. A wrong domain
// separator or a reordered field fails there rather than three layers away in a proof server.
//
// PORTED (2026-08-25, repo reorganization). This suite predates the v5 Manager: it calls the
// contract by the PER-SELECTOR circuit names that v5 deleted (`withdrawShielded`,
// `transferInternalShielded`, `openSwapShielded`, `registerAccount`, ...). It still exercises the
// CURRENT contract, because `tests/lib/sim.ts` translates each of those names into the equivalent
// `execute` action envelope and drives v5's single gateway with it. So the vocabulary is historical
// and the coverage is live: every assertion below is checked against today's compiled Manager.
import { describe, expect, it } from 'vitest';
import {
  hex,
  managerPure,
  ManagerSim,
  mapSizes,
  secretOf,
  snapshotLedger,
  zswapDeltas,
  type CallDetail,
} from '../lib/sim.js';

// Colours are 32-byte values the Manager has never been told anything about.
const S_A = new Uint8Array(32).fill(0x11);
const S_B = new Uint8Array(32).fill(0x12);
/** A colour nobody ever deposits — the dormant-colour make (missing cell reads 0). */
const S_DORMANT = new Uint8Array(32).fill(0x13);

const A = hex(S_A);
const B = hex(S_B);

const OWNER_A = secretOf('OwnerA');
const OWNER_B = secretOf('OwnerB');
const OWNER_X = secretOf('OwnerX-unregistered');

const nonce = (n: number) => new Uint8Array(32).fill(n);
const coin = (colour: Uint8Array, value: bigint, n: number) => ({ nonce: nonce(n), color: colour, value });

const ZERO_EITHER = {
  is_left: true,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: new Uint8Array(32) },
};
/** `some(taker's coin public key)` — the NAMED shapes (FR-308 v1 and v2b). */
const named = (b: number) => ({
  is_some: true,
  value: { is_left: true, left: { bytes: new Uint8Array(32).fill(b) }, right: { bytes: new Uint8Array(32) } },
});
/** `none` — the OPEN shape (FR-308 v2a). No recipient is fixed at proving time at all. */
const OPEN = { is_some: false, value: ZERO_EITHER };
/** A plain `Either` recipient, for v3's own `withdrawShielded`. */
const takerKey = (b: number) => ({
  is_left: true,
  left: { bytes: new Uint8Array(32).fill(b) },
  right: { bytes: new Uint8Array(32) },
});

/**
 * A Manager v4 with AA_A and AA_B registered and `deposited` of S_A pooled to AA_A.
 * The witness is left set to OwnerA — the MAKER — so a test that does not call `actAs` is testing
 * the authorized path.
 */
const setup = async (deposited: bigint = 6n) => {
  const sim = await ManagerSim.create(OWNER_A);
  const idA = await sim.ownerCommitmentFor(OWNER_A);
  const idB = await sim.ownerCommitmentFor(OWNER_B);
  await sim.call('registerAccount', idA);
  await sim.call('registerAccount', idB);
  if (deposited > 0n) await sim.call('depositShielded', coin(S_A, deposited, 1), idA);
  return { sim, idA, idB };
};

const cell = (sim: ManagerSim, acct: Uint8Array, colour: Uint8Array): bigint =>
  sim.ledger.shieldedBalances.member(managerPure.shieldedKey(acct, colour))
    ? BigInt(sim.ledger.shieldedBalances.lookup(managerPure.shieldedKey(acct, colour)))
    : 0n;

const pool = (sim: ManagerSim, colour: Uint8Array): bigint =>
  sim.ledger.pools.member(colour) ? BigInt(sim.ledger.pools.lookup(colour).value) : 0n;

/** The pooled coin as a plain `ShieldedCoinInfo` — the preimage the nullifier is taken over. */
const pooledCoin = (sim: ManagerSim, colour: Uint8Array) => {
  const p = sim.ledger.pools.lookup(colour);
  return { nonce: p.nonce, color: p.color, value: BigInt(p.value) };
};

const contractAddr = (sim: ManagerSim) => ({ bytes: Buffer.from(sim.address, 'hex') });
const selfRecipient = (sim: ManagerSim) => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: Buffer.from(sim.address, 'hex') },
});

const commitmentOf = (sim: ManagerSim, o: { nonce: string; colour: string; value: bigint; toContract: boolean; recipient: string }) =>
  hex(
    managerPure.zswapCommitmentOf(
      { nonce: Buffer.from(o.nonce, 'hex'), color: Buffer.from(o.colour, 'hex'), value: o.value },
      o.toContract
        ? selfRecipient(sim)
        : { is_left: true, left: { bytes: Buffer.from(o.recipient, 'hex') }, right: { bytes: new Uint8Array(32) } },
    ),
  );

/** Outputs addressed to a contract, as hex commitments — the set the ledger requires to be claimed. */
const contractOutputCommitments = (sim: ManagerSim, call: CallDetail<unknown>): string[] =>
  call.outputs.filter((o) => o.toContract).map((o) => commitmentOf(sim, o)).sort();

// =================================================================================================
describe('Manager v4 — the swap circuit transcribes the stdlib’s private zswap hashes EXACTLY', () => {
  // This is the test that makes the surplus branch trustworthy. It cannot use the standard library's
  // `coinNullifier`/`coinCommitment` (both unexported) and cannot use `sendShielded` (which always
  // creates an output for the value it moves), so it recomputes both. If the recomputation were wrong
  // the node would refuse the offer with an effects-check failure that says nothing about which field
  // was wrong.
  it('reimplemented coinNullifier == the nullifier the STDLIB claims for the same pooled coin', async () => {
    const { sim } = await setup(6n);
    const pooled = pooledCoin(sim, S_A);

    // `withdrawShielded` goes through the stdlib's `sendShielded`, which claims the stdlib's own
    // nullifier for the pooled coin.
    const w = await sim.callDetailed('withdrawShielded', S_A, 2n, takerKey(0xaa));

    expect(w.effects.claimedNullifiers).toHaveLength(1);
    expect(w.effects.claimedNullifiers[0]).toBe(hex(managerPure.zswapNullifierOf(pooled, contractAddr(sim))));
  });

  it('reimplemented coinCommitment == every commitment the STDLIB claims, user- and contract-addressed', async () => {
    const { sim } = await setup(6n);
    const w = await sim.callDetailed('withdrawShielded', S_A, 2n, takerKey(0xaa));

    // Two outputs: the payout to a USER coin public key (is_left) and the change to the CONTRACT
    // (right). Both discriminant branches of the preimage are therefore exercised.
    expect(w.outputs).toHaveLength(2);
    expect(w.effects.claimedShieldedSpends).toEqual(w.outputs.map((o) => commitmentOf(sim, o)).sort());
  });

  it('and the SURPLUS branch’s own claims agree with the same reimplementation', async () => {
    const { sim, idA } = await setup(6n);
    const pooled = pooledCoin(sim, S_A);
    const call = await sim.callDetailed('openSwapShielded', S_A, 2n, OPEN, coin(S_B, 3n, 2), idA);

    // The nullifier the surplus branch claims for the pooled coin is computed by the CONTRACT's own
    // transcription; the stdlib computed the identical value for the identical coin two tests up.
    expect(call.effects.claimedNullifiers).toEqual([hex(managerPure.zswapNullifierOf(pooled, contractAddr(sim)))]);
  });
});

// =================================================================================================
describe('Manager v4 — FR-308 named shapes (`some(key)`): the A leg is internally balanced', () => {
  it('carries EXACTLY the −B deficit and no A imbalance at all (the spec’s step 3 shape)', async () => {
    const { sim, idA } = await setup(6n);
    const pooled = pooledCoin(sim, S_A);

    const call = await sim.callDetailed('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), idA);

    // THE offer's imbalance: the wanted colour only. A is fully accounted for inside the call.
    expect(zswapDeltas(call)).toEqual({ [B]: -7n });

    // The shape that produced it: one input, three outputs.
    expect(call.inputs).toEqual([{ nonce: hex(pooled.nonce), colour: A, value: 6n, mtIndex: 0n }]);
    expect(call.outputs.map((o) => ({ colour: o.colour, value: o.value, toContract: o.toContract }))).toEqual([
      { colour: A, value: 4n, toContract: false }, // the payout, to the NAMED recipient
      { colour: A, value: 2n, toContract: true }, // change, back to the pool
      { colour: B, value: 7n, toContract: true }, // the wanted coin, claimed but unfunded
    ]);
    expect(call.outputs[0]!.recipient).toBe(hex(new Uint8Array(32).fill(0xaa)));
  });

  it('satisfies the ledger’s effects rules exactly (verify.rs:1528 / :1548 / :1599)', async () => {
    const { sim, idA } = await setup(6n);
    const pooled = pooledCoin(sim, S_A);
    const call = await sim.callDetailed('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), idA);

    // Contract-associated nullifiers must EQUAL the claimed nullifiers — exactly one here.
    expect(call.effects.claimedNullifiers).toEqual([hex(managerPure.zswapNullifierOf(pooled, contractAddr(sim)))]);
    // Contract-addressed output commitments must EQUAL the claimed receives — the change and coinB.
    expect(call.effects.claimedShieldedReceives).toEqual(contractOutputCommitments(sim, call));
    expect(call.effects.claimedShieldedReceives).toHaveLength(2);
    // Claimed spends must be a SUBSET of all commitments. `receiveShielded` claims no spend for the
    // wanted coin — that unclaimed commitment is precisely what makes the offer unbalanced.
    const allCommitments = new Set(call.outputs.map((o) => commitmentOf(sim, o)));
    for (const s of call.effects.claimedShieldedSpends) expect(allCommitments.has(s)).toBe(true);
    expect(call.effects.claimedShieldedSpends).toHaveLength(2); // payout + change, NOT coinB
  });

  it('moves custody atomically: A debited, B credited, pools and cells exact', async () => {
    const { sim, idA } = await setup(6n);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });

    await sim.call('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), idA);

    expect(pool(sim, S_A)).toBe(2n);
    expect(pool(sim, S_B)).toBe(7n);
    expect(cell(sim, idA, S_A)).toBe(2n);
    expect(cell(sim, idA, S_B)).toBe(7n);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 2, shieldedCells: 2, unshieldedCells: 0 });
  });

  it('drops the colour from the pool map when the swap gives the WHOLE pooled coin', async () => {
    const { sim, idA } = await setup(6n);
    const call = await sim.callDetailed('openSwapShielded', S_A, 6n, named(0xaa), coin(S_B, 7n, 2), idA);

    // No change output at all, so still no A imbalance.
    expect(zswapDeltas(call)).toEqual({ [B]: -7n });
    expect(call.outputs.map((o) => ({ colour: o.colour, value: o.value }))).toEqual([
      { colour: A, value: 6n },
      { colour: B, value: 7n },
    ]);
    expect(sim.ledger.pools.member(S_A)).toBe(false);
    expect(cell(sim, idA, S_A)).toBe(0n);
    // The CELL survives at zero — only the pool entry is removed (v3 behaviour, unchanged).
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 2, unshieldedCells: 0 });
  });

  it('credits the wanted colour to a DIFFERENT registered account when asked', async () => {
    const { sim, idA, idB } = await setup(6n);
    await sim.call('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), idB);

    expect(cell(sim, idA, S_A)).toBe(2n); // the WITNESS owner is always the one debited
    expect(cell(sim, idA, S_B)).toBe(0n);
    expect(cell(sim, idB, S_B)).toBe(7n);
  });

  it('merges into an EXISTING pool for the wanted colour (the spec’s step 8 shape)', async () => {
    const { sim, idA } = await setup(6n);
    await sim.call('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), idA);
    expect(pool(sim, S_B)).toBe(7n);

    // A second swap wanting the SAME colour B must merge, not replace.
    await sim.call('openSwapShielded', S_A, 2n, named(0xbb), coin(S_B, 3n, 3), idA);
    expect(pool(sim, S_B)).toBe(10n);
    expect(cell(sim, idA, S_B)).toBe(10n);
    expect(sim.ledger.pools.member(S_A)).toBe(false);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 2, unshieldedCells: 0 });
  });
});

// =================================================================================================
describe('Manager v4 — FR-308 v2(a), the OPEN shape (`none`): A is released to NOBODY', () => {
  it('leaves a POSITIVE A imbalance and a negative B one (the spec’s step 7 shape)', async () => {
    const { sim, idA } = await setup(6n);
    const pooled = pooledCoin(sim, S_A);

    const call = await sim.callDetailed('openSwapShielded', S_A, 2n, OPEN, coin(S_B, 3n, 2), idA);

    // THE claim the whole open-offer goal rests on: +A surplus, −B deficit, at the same segment.
    expect(zswapDeltas(call)).toEqual({ [A]: 2n, [B]: -3n });

    // And the shape: the pooled coin is consumed, but NOTHING is output for the released 2.
    expect(call.inputs).toEqual([{ nonce: hex(pooled.nonce), colour: A, value: 6n, mtIndex: 0n }]);
    expect(call.outputs.map((o) => ({ colour: o.colour, value: o.value, toContract: o.toContract }))).toEqual([
      { colour: A, value: 4n, toContract: true }, // change only
      { colour: B, value: 3n, toContract: true }, // the wanted coin
    ]);
    // No output is addressed to a user key at all — there is no recipient to fix at proving time,
    // which is exactly what makes this offer open.
    expect(call.outputs.every((o) => o.toContract)).toBe(true);
  });

  it('satisfies the ledger’s effects rules while claiming NO spend for the released value', async () => {
    const { sim, idA } = await setup(6n);
    const pooled = pooledCoin(sim, S_A);
    const call = await sim.callDetailed('openSwapShielded', S_A, 2n, OPEN, coin(S_B, 3n, 2), idA);

    // Nullifiers: exact equality with the contract's inputs (verify.rs:1528).
    expect(call.effects.claimedNullifiers).toEqual([hex(managerPure.zswapNullifierOf(pooled, contractAddr(sim)))]);
    // Receives: exact equality with the contract-addressed outputs (verify.rs:1548).
    expect(call.effects.claimedShieldedReceives).toEqual(contractOutputCommitments(sim, call));
    // Spends: only the change coin. A subset of the commitments, which is all the ledger asks
    // (verify.rs:1599) — and the released 2 of A is claimed by nobody, so it is free for a taker.
    expect(call.effects.claimedShieldedSpends).toHaveLength(1);
    expect(contractOutputCommitments(sim, call)).toContain(call.effects.claimedShieldedSpends[0]);
  });

  it('releases the WHOLE pooled coin with no change output, removing the colour', async () => {
    const { sim, idA } = await setup(6n);
    const call = await sim.callDetailed('openSwapShielded', S_A, 6n, OPEN, coin(S_B, 3n, 2), idA);

    expect(zswapDeltas(call)).toEqual({ [A]: 6n, [B]: -3n });
    expect(call.outputs.map((o) => ({ colour: o.colour, value: o.value }))).toEqual([{ colour: B, value: 3n }]);
    expect(call.effects.claimedShieldedSpends).toEqual([]); // nothing at all was spent to a recipient
    expect(sim.ledger.pools.member(S_A)).toBe(false);
    expect(pool(sim, S_B)).toBe(3n);
  });

  it('keeps the SAME custody bookkeeping as the named shape — only the zswap shape differs', async () => {
    const namedRun = await setup(6n);
    await namedRun.sim.call('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), namedRun.idA);

    const surplus = await setup(6n);
    await surplus.sim.call('openSwapShielded', S_A, 4n, OPEN, coin(S_B, 7n, 2), surplus.idA);

    // Same pools, same cells, same sizes. The two shapes differ ONLY in who gets the A value, and
    // that is a zswap-layer fact, not a custody-layer one.
    const strip = (s: ReturnType<typeof snapshotLedger>) => ({
      poolCount: s.poolCount,
      shieldedCount: s.shieldedCount,
      unshieldedCount: s.unshieldedCount,
      shieldedBalances: s.shieldedBalances,
      poolValues: Object.fromEntries(Object.entries(s.pools).map(([k, v]) => [k, (v as any).value])),
    });
    expect(strip(snapshotLedger(surplus.sim.ledger))).toEqual(strip(snapshotLedger(namedRun.sim.ledger)));
  });

  it('the two shapes differ in EXACTLY one output — the payout', async () => {
    // Stated as its own assertion because it is the whole difference between "a swap with somebody"
    // and "a swap with anybody", and a future edit that quietly added an output to the open branch
    // would destroy the openness property while leaving every custody assertion passing.
    const n = await setup(6n);
    const nc = await n.sim.callDetailed('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), n.idA);
    const o = await setup(6n);
    const oc = await o.sim.callDetailed('openSwapShielded', S_A, 4n, OPEN, coin(S_B, 7n, 2), o.idA);

    expect(nc.inputs.map((i) => i.value)).toEqual(oc.inputs.map((i) => i.value));
    expect(nc.outputs).toHaveLength(oc.outputs.length + 1);
    const extra = nc.outputs.filter((x) => !x.toContract);
    expect(extra).toHaveLength(1);
    expect(extra[0]!.value).toBe(4n);
    expect(oc.outputs.filter((x) => !x.toContract)).toHaveLength(0);
  });
});

// =================================================================================================
describe('Manager v4 — a refused swap creates NO state, in BOTH shapes (FR-305, NC-305/NC-306)', () => {
  // `expectReject` asserts the WHOLE ledger snapshot — the account set, every pooled coin's identity
  // and value, every cell in both family maps, and all three map SIZES — is byte-identical
  // afterwards. Size is what makes each of these a no-state-CREATED proof rather than a
  // no-value-changed one.
  //
  // Every negative runs against BOTH shapes from one table, so the branches cannot drift apart.
  const shapes: Array<{ name: string; recipient: unknown }> = [
    { name: 'named (some(key))', recipient: named(0xaa) },
    { name: 'open (none)', recipient: OPEN },
  ];

  for (const shape of shapes) {
    describe(shape.name, () => {
      const args = (idA: Uint8Array): [string, ...unknown[]] => [
        'openSwapShielded',
        S_A,
        4n,
        shape.recipient,
        coin(S_B, 7n, 2),
        idA,
      ];

      it('NC-305 — an unregistered witness dies at the CHOKE POINT', async () => {
        const { sim, idA } = await setup(6n);
        sim.actAs(OWNER_X);
        expect(await sim.expectReject(...args(idA))).toMatch(/owner witness matches no registered account/);
        expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 1, unshieldedCells: 0 });
      });

      it('NC-306 — the per-(account,colour) guard bites even though the POOL covers the give', async () => {
        // AA_A holds 2 of S_A; AA_B holds 4 more of the SAME colour, so the pool holds 6 — enough for
        // the requested 4. Only the per-account guard can refuse this, and it must, BEFORE the pool
        // guard is consulted.
        const { sim, idA, idB } = await setup(0n);
        await sim.call('depositShielded', coin(S_A, 2n, 1), idA);
        await sim.call('depositShielded', coin(S_A, 4n, 2), idB);
        expect(pool(sim, S_A)).toBe(6n);

        sim.actAs(OWNER_A);
        expect(await sim.expectReject(...args(idA))).toMatch(/account colour balance too low/);
        expect(pool(sim, S_A)).toBe(6n);
        expect(mapSizes(sim.ledger)).toEqual({ pools: 1, shieldedCells: 2, unshieldedCells: 0 });
      });

      it('a DORMANT colour make is refused by the same guard — a missing cell reads 0, uncreated', async () => {
        const { sim, idA } = await setup(6n);
        const a = args(idA);
        a[1] = S_DORMANT;
        expect(await sim.expectReject(...a)).toMatch(/account colour balance too low/);
        expect(sim.ledger.pools.member(S_DORMANT)).toBe(false);
        expect(sim.ledger.shieldedBalances.member(managerPure.shieldedKey(idA, S_DORMANT))).toBe(false);
      });

      it('refuses a zero GIVE', async () => {
        const { sim, idA } = await setup(6n);
        const a = args(idA);
        a[2] = 0n;
        expect(await sim.expectReject(...a)).toMatch(/swap must give a positive amount/);
      });

      it('refuses a zero WANT', async () => {
        const { sim, idA } = await setup(6n);
        const a = args(idA);
        a[4] = coin(S_B, 0n, 2);
        expect(await sim.expectReject(...a)).toMatch(/swap must want a positive amount/);
      });

      it('refuses a swap whose two legs are the SAME colour (finding F-305, failing closed)', async () => {
        // Two same-colour shielded credits cannot be assembled in one transaction at these pins: the
        // second needs the first coin's Merkle index, which does not exist until the first is really
        // inserted on chain. Without this guard the failure would surface as an opaque
        // `invalid index into sparse merkle tree` from inside the proving path.
        const { sim, idA } = await setup(6n);
        const a = args(idA);
        a[4] = coin(S_A, 3n, 2);
        expect(await sim.expectReject(...a)).toMatch(/swap legs must be different colours/);
      });

      it('refuses crediting the wanted colour to an UNREGISTERED account', async () => {
        const { sim, idA } = await setup(6n);
        const a = args(idA);
        a[5] = new Uint8Array(32).fill(0x99);
        expect(await sim.expectReject(...a)).toMatch(/credit account is not registered/);
      });

      it('refuses giving more than the POOL holds, once the account guard is satisfied', async () => {
        // Reaching the pool guard at all requires an account cell that covers the request while the
        // pool does not — which the per-colour invariant makes impossible through ordinary deposits.
        // So this asserts the guard ORDER instead: with cell == pool == 6, asking for 7 is refused by
        // the ACCOUNT guard, and the pool guard is never reached. That is FR-204's ordering, and the
        // reason the pool guard is a backstop rather than the control.
        const { sim, idA } = await setup(6n);
        const a = args(idA);
        a[2] = 7n;
        expect(await sim.expectReject(...a)).toMatch(/account colour balance too low/);
      });
    });
  }
});

// =================================================================================================
describe('Manager v4 — GUARD ORDER is the owner-critical property (FR-204 carried into FR-305)', () => {
  for (const [label, recipient] of [
    ['named', named(0xaa)],
    ['open', OPEN],
  ] as const) {
    it(`[${label}] an unauthorized AND unbacked make reports the CHOKE POINT, not the balance`, async () => {
      // OwnerX is unregistered AND has no cell for S_A. If the balance guard ran first the error
      // would be "balance too low", which would mean the contract had read a cell for an
      // unauthenticated caller before refusing it.
      const { sim, idA } = await setup(6n);
      sim.actAs(OWNER_X);
      expect(await sim.expectReject('openSwapShielded', S_A, 4n, recipient, coin(S_B, 7n, 2), idA)).toMatch(
        /owner witness matches no registered account/,
      );
    });

    it(`[${label}] an unbacked make with a RICH pool reports the ACCOUNT guard, not the pool guard`, async () => {
      const { sim, idA, idB } = await setup(0n);
      await sim.call('depositShielded', coin(S_A, 1n, 1), idA);
      await sim.call('depositShielded', coin(S_A, 9n, 2), idB);
      sim.actAs(OWNER_A);
      expect(await sim.expectReject('openSwapShielded', S_A, 5n, recipient, coin(S_B, 7n, 3), idA)).toMatch(
        /account colour balance too low/,
      );
      expect(cell(sim, idB, S_A)).toBe(9n);
    });
  }

  it('parameter sanity precedes the choke point — and that is deliberate, not an accident', async () => {
    // A zero-give from an UNREGISTERED witness reports the zero, not the authorization. This is the
    // documented order (see `assertSwapPreconditions`): guard 0 is pure arithmetic on the caller's own
    // arguments, reads no state, and so can leak nothing about registration or balances. The test
    // exists to PIN the order, so a future edit cannot silently move a state-reading guard ahead of
    // the witness choke point.
    const { sim, idA } = await setup(6n);
    sim.actAs(OWNER_X);
    expect(await sim.expectReject('openSwapShielded', S_A, 0n, named(0xaa), coin(S_B, 7n, 2), idA)).toMatch(
      /swap must give a positive amount/,
    );
  });

  it('debits the WITNESS owner, never a caller-supplied account', async () => {
    // OwnerB is registered but holds no S_A. Naming AA_A as the credit account must not cause AA_A to
    // be debited: the debit always follows the witness.
    const { sim, idA } = await setup(6n);
    sim.actAs(OWNER_B);
    expect(await sim.expectReject('openSwapShielded', S_A, 1n, named(0xaa), coin(S_B, 7n, 2), idA)).toMatch(
      /account colour balance too low/,
    );
  });
});

// =================================================================================================
describe('Manager v5 candidate — inherited behavior behind one gateway', () => {
  it('exposes execute as the sole registration/debit circuit and keeps only open-credit/read paths', async () => {
    const { sim } = await setup(0n);
    const impure = Object.keys((sim as any).contract.impureCircuits).sort();
    expect(impure).toEqual([
      'accountRecord',
      'depositShielded',
      'depositUnshielded',
      'execute',
      'isRegistered',
      'myAccount',
      'poolHasColour',
      'poolValue',
      'shieldedAccountBalance',
      'unshieldedAccountBalance',
    ].sort());
    for (const oldName of [
      'registerAccount',
      'withdrawShielded',
      'withdrawUnshielded',
      'transferInternalShielded',
      'transferInternalUnshielded',
      'openSwapShielded',
    ]) expect(impure).not.toContain(oldName);
    // Still no admin surface of any kind (FR-201, inherited).
    expect(impure).not.toContain('configure');
    // The two new PURE circuits cost no proving key, so they are free to export.
    expect(typeof managerPure.zswapNullifierOf).toBe('function');
    expect(typeof managerPure.zswapCommitmentOf).toBe('function');
  });

  it('registration still seeds NOTHING, with the swap circuit present', async () => {
    const sim = await ManagerSim.create(OWNER_A);
    const idA = await sim.ownerCommitmentFor(OWNER_A);
    await sim.call('registerAccount', idA);
    expect(mapSizes(sim.ledger)).toEqual({ pools: 0, shieldedCells: 0, unshieldedCells: 0 });
  });

  it('a swap and a v3 withdrawal debit the same cell in the same way', async () => {
    const viaWithdraw = await setup(6n);
    await viaWithdraw.sim.call('withdrawShielded', S_A, 4n, takerKey(0xaa));

    const viaSwap = await setup(6n);
    await viaSwap.sim.call('openSwapShielded', S_A, 4n, named(0xaa), coin(S_B, 7n, 2), viaSwap.idA);

    expect(cell(viaSwap.sim, viaSwap.idA, S_A)).toBe(cell(viaWithdraw.sim, viaWithdraw.idA, S_A));
    expect(pool(viaSwap.sim, S_A)).toBe(pool(viaWithdraw.sim, S_A));
  });
});
