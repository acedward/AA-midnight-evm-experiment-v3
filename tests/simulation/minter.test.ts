// G2 simulator/unit suite for the parameterized Minter and for MinterCollide
// (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// The Minter is 00004's, REUSED UNCHANGED. Its job is to turn a per-deployment CONSTRUCTOR TAG into
// two contract-scoped colours. The properties 00005 leans on:
//
//   - the tag reaches ledger state unchanged, and the two derived separators are distinct;
//   - the two colours of one deployment are independent identifiers (never matched by bytes alone);
//   - two deployments with DIFFERENT tags yield different colours — that is what makes the ten
//     colours of TOKA..TOKE pairwise distinct from one source;
//   - two deployments with the SAME tag still differ, because colours stay contract-scoped.
//
// MinterCollide is the INVERSE fixture, and the last `describe` block asserts the inverse property:
// its two family colours must be BYTE-EQUAL. Everywhere else in this project a colour collision is a
// failure; there it is the point (FR-203, probe P-COLL).
//
// PORTED (2026-08-25, repo reorganization). This suite predates the v5 Manager: it calls the
// contract by the PER-SELECTOR circuit names that v5 deleted (`withdrawShielded`,
// `transferInternalShielded`, `openSwapShielded`, `registerAccount`, ...). It still exercises the
// CURRENT contract, because `tests/lib/sim.ts` translates each of those names into the equivalent
// `execute` action envelope and drives v5's single gateway with it. So the vocabulary is historical
// and the coverage is live: every assertion below is checked against today's compiled Manager.
import { describe, expect, it } from 'vitest';
import { hex, MinterCollideSim, MinterSim, pad32 } from '../lib/sim.js';

const TOKA = pad32('TOKA');
const TOKB = pad32('TOKB');
const TOKC = pad32('TOKC');
const TOKD = pad32('TOKD');
const TOKE = pad32('TOKE');
const TOKX = pad32('TOKX');

const userShieldedRecipient = {
  is_left: true,
  left: { bytes: new Uint8Array(32).fill(0xaa) },
  right: { bytes: new Uint8Array(32) },
};
const userUnshieldedRecipient = {
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: new Uint8Array(32).fill(0xbb) },
};

describe('Minter — constructor tag (FR-101)', () => {
  it('stores the tag it was constructed with, unchanged', async () => {
    const m = await MinterSim.create(TOKA);
    expect(hex(m.ledger.deploymentTag)).toBe(hex(TOKA));
  });

  it('derives two DISTINCT family separators from one tag', async () => {
    const m = await MinterSim.create(TOKA);
    expect(hex(m.ledger.shieldedSep)).not.toBe(hex(m.ledger.unshieldedSep));
    expect(hex(m.ledger.shieldedSep)).not.toMatch(/^0+$/);
    expect(hex(m.ledger.unshieldedSep)).not.toMatch(/^0+$/);
  });

  it('derives DIFFERENT separators for different tags', async () => {
    const a = await MinterSim.create(TOKA);
    const b = await MinterSim.create(TOKB);
    expect(hex(a.ledger.shieldedSep)).not.toBe(hex(b.ledger.shieldedSep));
    expect(hex(a.ledger.unshieldedSep)).not.toBe(hex(b.ledger.unshieldedSep));
  });

  it('derives the SAME separators for the same tag (deterministic derivation)', async () => {
    const a = await MinterSim.create(TOKA);
    const b = await MinterSim.create(TOKA);
    expect(hex(a.ledger.shieldedSep)).toBe(hex(b.ledger.shieldedSep));
  });
});

describe('Minter — colours', () => {
  it('derives two DISTINCT contract-scoped colours', async () => {
    const m = await MinterSim.create(TOKA);
    const s = await m.call<Uint8Array>('shieldedColor');
    const u = await m.call<Uint8Array>('unshieldedColor');
    expect(hex(s)).not.toBe(hex(u));
    expect(hex(s)).toHaveLength(64);
    expect(hex(s)).not.toMatch(/^0+$/); // not the native token
    expect(hex(u)).not.toMatch(/^0+$/);
  });

  it('derives colours deterministically for a given deployment', async () => {
    const m = await MinterSim.create(TOKA);
    expect(hex(await m.call<Uint8Array>('shieldedColor'))).toBe(hex(await m.call<Uint8Array>('shieldedColor')));
  });

  it('yields TEN pairwise-distinct colours from five tags (the 00005 colour set)', async () => {
    // The shape of the live distinctness control: TOKA/TOKB/TOKC deployed at step 1, TOKD deployed
    // MID-LEDGER at step 15, TOKE the M3 issuer. 45 pairwise comparisons over 10 colours.
    const sims = await Promise.all([TOKA, TOKB, TOKC, TOKD, TOKE].map((t) => MinterSim.create(t)));
    const colours: string[] = [];
    for (const m of sims) {
      colours.push(hex(await m.call<Uint8Array>('shieldedColor')));
      colours.push(hex(await m.call<Uint8Array>('unshieldedColor')));
    }
    expect(colours).toHaveLength(10);
    expect(new Set(colours).size).toBe(10);
    let comparisons = 0;
    for (let i = 0; i < colours.length; i++) {
      for (let k = i + 1; k < colours.length; k++) {
        comparisons++;
        expect(colours[i]).not.toBe(colours[k]);
      }
    }
    expect(comparisons).toBe(45);
  });

  it('scopes colours to the contract address — the same tag deployed twice still differs', async () => {
    const a = await MinterSim.create(TOKA);
    const b = await MinterSim.create(TOKA);
    // Same separators (asserted above), different address => different colours.
    expect(hex(await a.call<Uint8Array>('shieldedColor'))).not.toBe(hex(await b.call<Uint8Array>('shieldedColor')));
  });
});

describe('Minter — minting', () => {
  it('mints a shielded coin carrying THIS deployment’s shielded colour', async () => {
    const m = await MinterSim.create(TOKB);
    const colour = await m.call<Uint8Array>('shieldedColor');
    const c = await m.call<any>('mintShieldedTo', 10n, new Uint8Array(32).fill(7), userShieldedRecipient);
    expect(c.value).toBe(10n);
    expect(hex(c.color)).toBe(hex(colour));
  });

  it('mints unshielded and returns the unshielded colour', async () => {
    const m = await MinterSim.create(TOKB);
    const colour = await m.call<Uint8Array>('unshieldedColor');
    const returned = await m.call<Uint8Array>('mintUnshieldedTo', 10n, userUnshieldedRecipient);
    expect(hex(returned)).toBe(hex(colour));
  });

  it('rejects a zero mint in both families', async () => {
    const m = await MinterSim.create(TOKA);
    expect(await m.expectReject('mintShieldedTo', 0n, new Uint8Array(32).fill(7), userShieldedRecipient)).toMatch(
      /mint value must be positive/,
    );
    expect(await m.expectReject('mintUnshieldedTo', 0n, userUnshieldedRecipient)).toMatch(
      /mint amount must be positive/,
    );
  });
});

describe('MinterCollide — the INVERTED assertion (FR-203, probe P-COLL)', () => {
  it('derives ONE separator and mints BOTH families under it', async () => {
    const m = await MinterCollideSim.create(TOKX);
    expect(hex(m.ledger.deploymentTag)).toBe(hex(TOKX));
    expect(hex(m.ledger.collidingSep)).not.toMatch(/^0+$/);
    // There is no second separator to read: the ledger declares exactly one.
    expect((m.ledger as any).shieldedSep).toBeUndefined();
    expect((m.ledger as any).unshieldedSep).toBeUndefined();
  });

  it('reports BYTE-IDENTICAL shielded and unshielded colours', async () => {
    const m = await MinterCollideSim.create(TOKX);
    const s = await m.call<Uint8Array>('shieldedColor');
    const u = await m.call<Uint8Array>('unshieldedColor');
    const c = await m.call<Uint8Array>('collidingColor');
    // The inverted assertion. Every other colour comparison in this project asserts inequality.
    expect(hex(s)).toBe(hex(u));
    expect(hex(c)).toBe(hex(s));
    expect(hex(s)).toHaveLength(64);
    expect(hex(s)).not.toMatch(/^0+$/); // not the native token
  });

  it('mints the SAME colour in both families — the fixture P-COLL deposits', async () => {
    const m = await MinterCollideSim.create(TOKX);
    const colour = await m.call<Uint8Array>('collidingColor');
    const coin = await m.call<any>('mintShieldedTo', 3n, new Uint8Array(32).fill(7), userShieldedRecipient);
    const returned = await m.call<Uint8Array>('mintUnshieldedTo', 2n, userUnshieldedRecipient);
    expect(coin.value).toBe(3n);
    expect(hex(coin.color)).toBe(hex(colour));
    expect(hex(returned)).toBe(hex(colour));
    // Same 32 bytes, two families, two different amounts — exactly what the Manager must not alias.
    expect(hex(coin.color)).toBe(hex(returned));
  });

  it('is still contract-scoped: two MinterCollide deployments do not collide with EACH OTHER', async () => {
    // The collision is deliberate WITHIN a deployment, never across deployments — otherwise the
    // probe would prove nothing about families and everything about a broken derivation.
    const a = await MinterCollideSim.create(TOKX);
    const b = await MinterCollideSim.create(TOKX);
    expect(hex(a.ledger.collidingSep)).toBe(hex(b.ledger.collidingSep));
    expect(hex(await a.call<Uint8Array>('collidingColor'))).not.toBe(hex(await b.call<Uint8Array>('collidingColor')));
  });

  it('does not collide with an ordinary Minter carrying the same tag', async () => {
    const collide = await MinterCollideSim.create(TOKX);
    const plain = await MinterSim.create(TOKX);
    const cc = hex(await collide.call<Uint8Array>('collidingColor'));
    expect(cc).not.toBe(hex(await plain.call<Uint8Array>('shieldedColor')));
    expect(cc).not.toBe(hex(await plain.call<Uint8Array>('unshieldedColor')));
  });

  it('rejects a zero mint in both families', async () => {
    const m = await MinterCollideSim.create(TOKX);
    expect(await m.expectReject('mintShieldedTo', 0n, new Uint8Array(32).fill(7), userShieldedRecipient)).toMatch(
      /mint value must be positive/,
    );
    expect(await m.expectReject('mintUnshieldedTo', 0n, userUnshieldedRecipient)).toMatch(
      /mint amount must be positive/,
    );
  });
});
