// G2 simulator/unit suite for the parameterized Minter (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// FR-101. The Minter's job is to turn a per-deployment CONSTRUCTOR TAG into two contract-scoped
// colours. The properties 00004 leans on:
//
//   - the tag reaches ledger state unchanged, and the two derived separators are distinct;
//   - the two colours of one deployment are independent identifiers (never matched by bytes alone);
//   - two deployments with DIFFERENT tags yield different colours — that is what makes S1/S2 and
//     U1/U2 four distinct colours from one source;
//   - two deployments with the SAME tag still differ, because colours stay contract-scoped.
import { describe, expect, it } from 'vitest';
import { hex, MinterSim, pad32 } from './sim.js';

const TOKA = pad32('TOKA');
const TOKB = pad32('TOKB');
const TOKC = pad32('TOKC');

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

  it('yields SIX pairwise-distinct colours from three tags (the 00004 colour set)', async () => {
    // The shape of the live distinctness control: Minter1(TOKA) -> S1/U1, Minter2(TOKB) -> S2/U2,
    // Minter3(TOKC) -> the two control colours that are never configured.
    const sims = await Promise.all([TOKA, TOKB, TOKC].map((t) => MinterSim.create(t)));
    const colours: string[] = [];
    for (const m of sims) {
      colours.push(hex(await m.call<Uint8Array>('shieldedColor')));
      colours.push(hex(await m.call<Uint8Array>('unshieldedColor')));
    }
    expect(new Set(colours).size).toBe(6);
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
