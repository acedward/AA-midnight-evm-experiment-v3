// G2 simulator/unit suite for the Minter (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// The Minter's whole job is to define two contract-scoped colors and mint them. The property the
// spec leans on is that the two colors are INDEPENDENT identifiers with independent family tags —
// assertions must never match by color bytes alone.
import { describe, expect, it } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
// @ts-ignore — generated artifact
import { Contract as MinterContract } from '../../generated/minter/contract/index.js';

const COIN_PK = '0'.repeat(64);

class MinterSim {
  readonly address = sampleContractAddress();
  private contract: any;
  private state: any;

  private constructor(contract: any, state: any) {
    this.contract = contract;
    this.state = state;
  }

  static async create(): Promise<MinterSim> {
    const contract = new MinterContract({});
    const res = await contract.initialState(createConstructorContext({}, COIN_PK));
    return new MinterSim(contract, res.currentContractState.data);
  }

  async call<T = unknown>(circuitId: string, ...args: unknown[]): Promise<T> {
    const ctx = createCircuitContext<any>(circuitId as any, this.address, COIN_PK, this.state, {});
    const res = await this.contract.impureCircuits[circuitId](ctx, ...args);
    const qc = res.context?.queryContexts?.[this.address];
    if (qc?.state) this.state = qc.state;
    return res.result as T;
  }

  async expectReject(circuitId: string, ...args: unknown[]): Promise<string> {
    try {
      const ctx = createCircuitContext<any>(circuitId as any, this.address, COIN_PK, this.state, {});
      await this.contract.impureCircuits[circuitId](ctx, ...args);
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    throw new Error(`expected ${circuitId} to reject, but it succeeded`);
  }
}

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
const userShieldedRecipient = { is_left: true, left: { bytes: new Uint8Array(32).fill(0xaa) }, right: { bytes: new Uint8Array(32) } };
const userUnshieldedRecipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes: new Uint8Array(32).fill(0xbb) } };

describe('Minter — colors', () => {
  it('derives two DISTINCT contract-scoped colors', async () => {
    const m = await MinterSim.create();
    const s = await m.call<Uint8Array>('shieldedColor');
    const u = await m.call<Uint8Array>('unshieldedColor');
    expect(hex(s)).not.toBe(hex(u));
    expect(hex(s)).toHaveLength(64);
    expect(hex(s)).not.toMatch(/^0+$/); // not the native token
    expect(hex(u)).not.toMatch(/^0+$/);
  });

  it('derives colors deterministically for a given contract', async () => {
    const m = await MinterSim.create();
    expect(hex(await m.call<Uint8Array>('shieldedColor'))).toBe(hex(await m.call<Uint8Array>('shieldedColor')));
  });

  it('scopes colors to the contract address (different deployments differ)', async () => {
    const a = await MinterSim.create();
    const b = await MinterSim.create();
    expect(hex(await a.call<Uint8Array>('shieldedColor'))).not.toBe(hex(await b.call<Uint8Array>('shieldedColor')));
  });
});

describe('Minter — minting', () => {
  it('mints a shielded coin carrying the shielded color', async () => {
    const m = await MinterSim.create();
    const color = await m.call<Uint8Array>('shieldedColor');
    const c = await m.call<any>('mintShieldedTo', 10n, new Uint8Array(32).fill(7), userShieldedRecipient);
    expect(c.value).toBe(10n);
    expect(hex(c.color)).toBe(hex(color));
  });

  it('mints unshielded and returns the unshielded color', async () => {
    const m = await MinterSim.create();
    const color = await m.call<Uint8Array>('unshieldedColor');
    const returned = await m.call<Uint8Array>('mintUnshieldedTo', 10n, userUnshieldedRecipient);
    expect(hex(returned)).toBe(hex(color));
  });

  it('rejects a zero mint in both families', async () => {
    const m = await MinterSim.create();
    expect(await m.expectReject('mintShieldedTo', 0n, new Uint8Array(32).fill(7), userShieldedRecipient))
      .toMatch(/mint value must be positive/);
    expect(await m.expectReject('mintUnshieldedTo', 0n, userUnshieldedRecipient))
      .toMatch(/mint amount must be positive/);
  });
});
