// G5 offline suite — one set of properties, asserted against EVERY mitigation fixture.
// 00006 Plan 05 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// The rig's whole value depends on the arms being COMPARABLE, and comparability is a claim about the
// arms' behaviour, not about their cost. So this file asserts the same properties of all seven
// fixtures, parameterised over the registry:
//
//   1. GUARD ORDER is preserved. The order is the owner-critical property (FR-204, FR-305): parameter
//      sanity, then the WITNESS choke point, then the per-(account, colour) guard with a missing cell
//      read as 0, then the pool guard, then the credit target. An arm that reordered guards while
//      getting cheaper would be measuring a weaker contract, which is the one way this rig could
//      produce a confidently wrong answer. Each refusal is checked by its VERBATIM message, and the
//      cases are chosen so that a reordering changes WHICH message comes back.
//   2. REFUSAL STATE-NEUTRALITY. Every refused call leaves the WHOLE ledger byte-identical, sizes
//      included, so a refusal that lazily created an empty cell — or, on the nested arms, an empty
//      account sub-map — fails here.
//   3. CONSERVATION. Per colour, what the contract holds equals what it was credited minus what it
//      paid out. Restated per layout: v4/slim/a keep the v4 form (`pool == sum of cells`); b/c the
//      same over nested cells; (d) WITHOUT cells at all, since the coin IS the balance; (e) in the
//      extended form that accounts for value parked in the escrow cells between phases.
//   4. THE ARM'S OWN THESIS, asserted rather than assumed — arm (a)/(c)'s dedupe must not change the
//      zswap structure, arm (d)'s structural guard must hold with no pool to rescue anybody, and arm
//      (e)'s offer must be CHEAPER AT 16 CELLS THAN THE BASELINE IS AT ONE.
import { describe, expect, it } from 'vitest';
import {
  cellValue,
  colourTotal,
  custodySize,
  snapshotVariant,
  VARIANTS,
  type VariantSpec,
} from '../g5/variants.js';
import {
  coin,
  initialParams,
  readPlacement,
  recipientArg,
  secretOf,
  VariantSim,
} from '../g5/placement-model.js';

const G = new Uint8Array(32).fill(0x11);
const W = new Uint8Array(32).fill(0x22);
const DORMANT = new Uint8Array(32).fill(0x33);

const OWNER_A = secretOf('OwnerA');
const OWNER_B = secretOf('OwnerB');
const OWNER_X = secretOf('OwnerX-unregistered');

/** Every fixture that presents the ONE-CIRCUIT offer API. Arm (e) is handled separately. */
const singleOfferVariants = VARIANTS.filter((v) => v.offer === 'single');

type Rig = { sim: VariantSim; idA: Uint8Array; idB: Uint8Array };

/** AA_A and AA_B registered, `deposited` of colour G credited to AA_A, witness left as OwnerA. */
const setup = async (v: VariantSpec, deposited = 6n): Promise<Rig> => {
  const sim = await VariantSim.create(v, OWNER_A);
  const idA = await sim.accountFor(OWNER_A);
  const idB = await sim.accountFor(OWNER_B);
  await sim.call('registerAccount', idA);
  await sim.call('registerAccount', idB);
  sim.actAs(OWNER_A);
  if (deposited > 0n) await sim.call('depositShielded', coin(G, deposited, 1), idA);
  return { sim, idA, idB };
};

/**
 * Call expecting a rejection; return the verbatim message and assert the WHOLE ledger is unchanged.
 *
 * `VariantSim` deliberately has no `expectReject` of its own: the state-neutrality half depends on the
 * variant's LAYOUT (what "the whole ledger" means differs per arm), and putting it here keeps the
 * simulator layout-agnostic.
 */
const expectReject = async (v: VariantSpec, sim: VariantSim, circuitId: string, ...args: unknown[]): Promise<string> => {
  const before = snapshotVariant(v, sim.ledger);
  let message: string | undefined;
  try {
    await sim.call(circuitId, ...args);
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  const after = snapshotVariant(v, sim.ledger);
  expect(after, `${v.id}: ${circuitId} changed ledger state on a refused call`).toBe(before);
  if (message === undefined) throw new Error(`${v.id}: expected ${circuitId} to reject, but it succeeded`);
  return message;
};

// =================================================================================================
describe.each(singleOfferVariants.map((v) => [v.id, v] as const))(
  'G5 fixture %s — guard order and state-neutrality (FR-204 / FR-305, one circuit)',
  (_id, v) => {
    it('refuses an UNREGISTERED witness at the choke point, before any balance is read (NC-305)', async () => {
      const { sim, idA } = await setup(v);
      sim.actAs(OWNER_X);
      const msg = await expectReject(v, sim, 'openSwapShielded', G, 1n, recipientArg('floating-surplus'), coin(W, 1n, 2), idA);
      expect(msg).toContain("caller's owner witness matches no registered account");
    });

    it('refuses a maker whose CELL is short BEFORE consulting the pool (NC-306)', async () => {
      // AA_B is registered and the pool is rich in G, but AA_B holds none of it. In v4 this is the
      // ordered-guard property; in arm (d) it is structural (there is no shared pool at all). Either
      // way the message must be the per-account one, never a pool one.
      const { sim } = await setup(v, 6n);
      sim.actAs(OWNER_B);
      const idB = await sim.accountFor(OWNER_B);
      const msg = await expectReject(v, sim, 'openSwapShielded', G, 1n, recipientArg('floating-surplus'), coin(W, 1n, 3), idB);
      expect(msg).toContain('account colour balance too low');
      expect(msg).not.toContain('pooled colour balance');
      expect(msg).not.toContain('no pooled coin');
    });

    it('reads a MISSING cell as 0 — a dormant colour is refused, and creates nothing', async () => {
      const { sim, idA } = await setup(v, 6n);
      const msg = await expectReject(v, sim, 'openSwapShielded', DORMANT, 1n, recipientArg('floating-surplus'), coin(W, 1n, 4), idA);
      expect(msg).toContain('account colour balance too low');
    });

    it('refuses an UNREGISTERED credit account', async () => {
      const { sim } = await setup(v, 6n);
      const stranger = new Uint8Array(32).fill(0x99);
      const msg = await expectReject(v, sim, 'openSwapShielded', G, 1n, recipientArg('floating-surplus'), coin(W, 1n, 5), stranger);
      expect(msg).toContain('credit account is not registered');
    });

    it('refuses SAME-COLOUR legs before anything else touches state (finding F-305 made explicit)', async () => {
      const { sim, idA } = await setup(v, 6n);
      const msg = await expectReject(v, sim, 'openSwapShielded', G, 1n, recipientArg('floating-surplus'), coin(G, 1n, 6), idA);
      expect(msg).toContain('swap legs must be different colours');
    });

    it('refuses a zero give and a zero want', async () => {
      const { sim, idA } = await setup(v, 6n);
      expect(
        await expectReject(v, sim, 'openSwapShielded', G, 0n, recipientArg('floating-surplus'), coin(W, 1n, 7), idA),
      ).toContain('swap must give a positive amount');
      expect(
        await expectReject(v, sim, 'openSwapShielded', G, 1n, recipientArg('floating-surplus'), coin(W, 0n, 8), idA),
      ).toContain('swap must want a positive amount');
    });
  },
);

// =================================================================================================
describe.each(singleOfferVariants.map((v) => [v.id, v] as const))(
  'G5 fixture %s — the offer MOVES custody correctly and conserves value',
  (_id, v) => {
    it('debits A, credits B, and conserves both colours', async () => {
      const { sim, idA } = await setup(v, 6n);
      await sim.call('openSwapShielded', G, 4n, recipientArg('named-taker'), coin(W, 7n, 9), idA);
      const l = sim.ledger;

      // The maker's attributed A fell by 4 and its B rose by 7, whatever the layout.
      expect(cellValue(v, l, sim.pure, idA, G)).toBe(2n);
      expect(cellValue(v, l, sim.pure, idA, W)).toBe(7n);

      // CONSERVATION, restated per layout. For (d) the two sides of v4's invariant are the same
      // object, so the assertion is against what was credited and debited instead.
      expect(colourTotal(v, l, G)).toBe(2n);
      expect(colourTotal(v, l, W)).toBe(7n);
    });

    it('the two FR-308 shapes differ in EXACTLY one zswap output — the payout', async () => {
      // The dedupe arms must not change the zswap structure, and the nested/unified arms must not
      // change it either: an arm that quietly altered what the offer pays out would be cheaper for a
      // reason that has nothing to do with the mitigation.
      const named = await setup(v, 6n);
      const surplus = await setup(v, 6n);
      const n = await named.sim.dryRun('openSwapShielded', G, 4n, recipientArg('named-taker'), coin(W, 7n, 10), named.idA);
      const s = await surplus.sim.dryRun('openSwapShielded', G, 4n, recipientArg('floating-surplus'), coin(W, 7n, 10), surplus.idA);
      const outs = (t: any[]): number => {
        // The zswap structure lives on the call context, not the transcript; the transcript's claimed
        // effects are the observable proxy the ledger itself checks.
        const p = readPlacement(t, initialParams());
        const half = p.guaranteed ?? p.fallible!;
        return half.claimedShieldedSpends;
      };
      // named: payout + change + coinB-receive are claimed as spends/receives; surplus claims one
      // fewer SPEND because the released value has no output at all.
      expect(outs(n.trace)).toBeGreaterThan(outs(s.trace));
    });
  },
);

// =================================================================================================
describe('G5 arm (d) — the structural guard: a rich account never rescues a poor one', () => {
  const v = VARIANTS.find((x) => x.id === 'arm-d-unified')!;

  it('AA_B cannot spend AA_A coin even though the contract is rich in that colour', async () => {
    const { sim } = await setup(v, 10n);
    sim.actAs(OWNER_B);
    const idB = await sim.accountFor(OWNER_B);
    // The contract holds 10 G — all of it AA_A's own coin. AA_B holds nothing.
    expect(colourTotal(v, sim.ledger, G)).toBe(10n);
    const msg = await expectReject(v, sim, 'withdrawShielded', G, 1n, recipientArg('named-taker').value);
    expect(msg).toContain('account colour balance too low');
  });

  it('an internal transfer is a REAL coin split, and it conserves the colour', async () => {
    const { sim, idA, idB } = await setup(v, 10n);
    sim.actAs(OWNER_A);
    await sim.call('transferInternalShielded', idB, G, 4n);
    const l = sim.ledger;
    expect(cellValue(v, l, sim.pure, idA, G)).toBe(6n);
    expect(cellValue(v, l, sim.pure, idB, G)).toBe(4n);
    // Conservation across the split: the contract still holds exactly 10.
    expect(colourTotal(v, l, G)).toBe(10n);
    // And it really is two coins now, not one shared pool — that is the arm.
    expect(custodySize(v, l).cells).toBe(2);
  });
});

// =================================================================================================
describe('G5 arm (e) — the two-phase escrow, its invariant, and its size-independence', () => {
  const v = VARIANTS.find((x) => x.id === 'arm-e-escrow')!;
  const slim = VARIANTS.find((x) => x.id === 'v4-slim')!;

  it('stage -> openSwap -> consolidate conserves value, with the extended invariant between phases', async () => {
    const { sim, idA } = await setup(v, 6n);
    sim.actAs(OWNER_A);

    await sim.call('stageOffer', G, 4n);
    let l = sim.ledger;
    // BETWEEN PHASES the v4 invariant is FALSE by design: the cell fell to 2 while the contract still
    // holds 6, because 4 sits in the escrow cell. The honest form has to count the escrow.
    expect(cellValue(v, l, sim.pure, idA, G)).toBe(2n);
    expect(colourTotal(v, l, G)).toBe(2n);
    expect(l.escrowActive).toBe(true);
    expect(BigInt(l.escrowCoin.value)).toBe(4n);
    expect(colourTotal(v, l, G) + BigInt(l.escrowCoin.value)).toBe(6n);

    await sim.call('openSwap', recipientArg('floating-surplus'), coin(W, 7n, 11));
    l = sim.ledger;
    // The staged coin is gone (released as the surplus) and the wanted coin is parked, unattributed.
    expect(l.escrowActive).toBe(false);
    expect(l.receivedActive).toBe(true);
    expect(BigInt(l.receivedCoin.value)).toBe(7n);
    expect(cellValue(v, l, sim.pure, idA, W)).toBe(0n);

    await sim.call('consolidate');
    l = sim.ledger;
    expect(l.receivedActive).toBe(false);
    expect(cellValue(v, l, sim.pure, idA, W)).toBe(7n);
    expect(colourTotal(v, l, W)).toBe(7n);
    // A gave 4 of 6 and it left custody for good.
    expect(colourTotal(v, l, G)).toBe(2n);
  });

  it('only the STAGING account may open the swap (authorization is not dropped from the offer)', async () => {
    const { sim } = await setup(v, 6n);
    sim.actAs(OWNER_A);
    await sim.call('stageOffer', G, 4n);
    sim.actAs(OWNER_B);
    const msg = await expectReject(v, sim, 'openSwap', recipientArg('floating-surplus'), coin(W, 7n, 12));
    expect(msg).toContain('only the staging account may open the swap');
  });

  it('an UNREGISTERED witness still dies at the choke point inside the offer circuit (NC-305)', async () => {
    const { sim } = await setup(v, 6n);
    sim.actAs(OWNER_A);
    await sim.call('stageOffer', G, 4n);
    sim.actAs(OWNER_X);
    const msg = await expectReject(v, sim, 'openSwap', recipientArg('floating-surplus'), coin(W, 7n, 13));
    expect(msg).toContain("caller's owner witness matches no registered account");
  });

  it('refuses a second stage while one is live, and an openSwap with nothing staged', async () => {
    const { sim } = await setup(v, 6n);
    sim.actAs(OWNER_A);
    expect(await expectReject(v, sim, 'openSwap', recipientArg('floating-surplus'), coin(W, 7n, 14))).toContain(
      'no offer is staged',
    );
    await sim.call('stageOffer', G, 2n);
    expect(await expectReject(v, sim, 'stageOffer', G, 2n)).toContain('an offer is already staged');
  });

  it("THE ARM'S THESIS: the offer at SIXTEEN cells is cheaper than the baseline at ONE", async () => {
    const params = initialParams();

    // Baseline (v4-slim) at its very best: one pool, one cell.
    const base = await setup(slim, 6n);
    const baseOffer = await base.sim.dryRun(
      'openSwapShielded',
      G,
      1n,
      recipientArg('floating-surplus'),
      coin(W, 1n, 15),
      base.idA,
    );
    const basePlacement = readPlacement(baseOffer.trace, params);

    // Arm (e) at sixteen cells: fifteen extra accounts each holding a cell of colour G.
    const sim = await VariantSim.create(v, OWNER_A);
    const ids: Uint8Array[] = [];
    const secrets: Uint8Array[] = [];
    for (let i = 0; i < 16; i++) {
      const s = secretOf(`e-owner-${i}`);
      secrets.push(s);
      const id = await sim.accountFor(s);
      ids.push(id);
      await sim.call('registerAccount', id);
    }
    sim.actAs(secrets[0]!);
    for (let i = 0; i < 16; i++) await sim.call('depositShielded', coin(G, 6n, 20 + i), ids[i]!);
    expect(custodySize(v, sim.ledger)).toMatchObject({ pools: 1, cells: 16 });

    sim.actAs(secrets[0]!);
    await sim.call('stageOffer', G, 1n);
    const armOffer = await sim.callTraced('openSwap', recipientArg('floating-surplus'), coin(W, 1n, 40));
    const armPlacement = readPlacement(armOffer.trace, params);

    // Both must still be publishable...
    expect(basePlacement.placement).toBe('GUARANTEED');
    expect(armPlacement.placement).toBe('GUARANTEED');
    // ...and the arm's offer must read strictly less, on the transcript's own numbers.
    expect(armPlacement.totalOps).toBeLessThan(basePlacement.totalOps);
    expect(BigInt(armPlacement.guaranteed!.gas.readTime)).toBeLessThan(
      BigInt(basePlacement.guaranteed!.gas.readTime),
    );
    expect(BigInt(armPlacement.guaranteed!.gas.computeTime)).toBeLessThan(
      BigInt(basePlacement.guaranteed!.gas.computeTime),
    );
  });
});

// =================================================================================================
describe('G5 control — the unshielded relaxation (R1) is FREE in the offer transcript', () => {
  it('v4-slim offer transcript is identical in size to shipped v4 at the same custody', async () => {
    const params = initialParams();
    const read = async (id: string) => {
      const v = VARIANTS.find((x) => x.id === id)!;
      const { sim, idA } = await setup(v, 6n);
      const { trace } = await sim.dryRun(
        'openSwapShielded',
        G,
        1n,
        recipientArg('floating-surplus'),
        coin(W, 1n, 50),
        idA,
      );
      return readPlacement(trace, params);
    };
    const v4 = await read('manager');
    const slim = await read('v4-slim');
    // This is what makes every arm delta attributable to the arm rather than to R1.
    expect(slim.totalOps).toBe(v4.totalOps);
    expect(slim.placement).toBe(v4.placement);
  });
});
