// Minimal in-process simulator for the compiled contracts (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// Uses only the pinned `@midnight-ntwrk/compact-runtime@0.18.0-rc.1` — the same runtime version the
// compiler stamped into the artifacts and the same one the pinned midnight-js depends on.
//
// 00005 shape: the Minter is 00004's, UNCHANGED (per-deployment tag as a constructor argument);
// MinterCollide is the P-COLL fixture with ONE separator feeding both families; and the Manager is
// v3 — no `configure`, no colour list, family-scoped maps, everything created lazily on first
// credit.
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';

// The compiled contracts. Built by scripts/g2/compile.sh into harness/generated/*.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated artifact, present after compilation
import { Contract as ManagerContract, ledger as managerLedger } from '../../generated/manager/contract/index.js';
// @ts-ignore — generated artifact, present after compilation
import { Contract as MinterContract, ledger as minterLedger } from '../../generated/minter/contract/index.js';
// @ts-ignore — generated artifact, present after compilation
import {
  Contract as MinterCollideContract,
  ledger as minterCollideLedger,
} from '../../generated/minter-collide/contract/index.js';

/** Private state: just the owner secret the witness hands to the circuit. */
export type ManagerPS = { ownerSecret: Uint8Array };

export const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');

/** A deterministic 32-byte value from a label — used for owner secrets and Minter tags. */
export const secretOf = (label: string): Uint8Array => {
  const b = new Uint8Array(32);
  const src = Buffer.from(label, 'utf-8');
  if (src.length > 32) throw new Error(`label "${label}" exceeds 32 bytes`);
  b.set(src.subarray(0, Math.min(32, src.length)));
  return b;
};

/** `pad(32, s)` on the TypeScript side — the Compact literal padding the Minter tags use. */
export const pad32 = secretOf;

const COIN_PK = '0'.repeat(64);

// --- Minter (00004, unchanged) --------------------------------------------------------------------

export class MinterSim {
  readonly address = sampleContractAddress();
  private contract: any;
  private state: any;

  private constructor(contract: any, state: any) {
    this.contract = contract;
    this.state = state;
  }

  /** `tag` is the constructor argument that decides this deployment's two colours (FR-101). */
  static async create(tag: Uint8Array): Promise<MinterSim> {
    const contract = new MinterContract({});
    const res = await contract.initialState(createConstructorContext({}, COIN_PK), tag);
    return new MinterSim(contract, res.currentContractState.data);
  }

  get ledger() {
    return minterLedger(this.state);
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

// --- MinterCollide (the P-COLL fixture) -----------------------------------------------------------

/**
 * Structurally identical to `MinterSim` on purpose: MinterCollide mirrors the Minter's API so the
 * same harness code paths drive both. What differs is inside the contract — ONE separator feeds both
 * mint families, so `shieldedColor()` and `unshieldedColor()` return the SAME 32 bytes.
 */
export class MinterCollideSim {
  readonly address = sampleContractAddress();
  private contract: any;
  private state: any;

  private constructor(contract: any, state: any) {
    this.contract = contract;
    this.state = state;
  }

  static async create(tag: Uint8Array): Promise<MinterCollideSim> {
    const contract = new MinterCollideContract({});
    const res = await contract.initialState(createConstructorContext({}, COIN_PK), tag);
    return new MinterCollideSim(contract, res.currentContractState.data);
  }

  get ledger() {
    return minterCollideLedger(this.state);
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

// --- Manager v3 -----------------------------------------------------------------------------------

export class ManagerSim {
  readonly address = sampleContractAddress();
  private contract: any;
  /** The contract's charged ledger state. Updated from the query context after every call. */
  private state: any;
  private privateState: ManagerPS;

  private constructor(contract: any, state: any, privateState: ManagerPS) {
    this.contract = contract;
    this.state = state;
    this.privateState = privateState;
  }

  static async create(initialSecret: Uint8Array): Promise<ManagerSim> {
    const witnesses = {
      localOwnerSecret: (ctx: any): [ManagerPS, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
    };
    const contract = new ManagerContract(witnesses);
    const ps: ManagerPS = { ownerSecret: initialSecret };
    const res = await contract.initialState(createConstructorContext(ps, COIN_PK));
    return new ManagerSim(contract, res.currentContractState.data, res.currentPrivateState ?? ps);
  }

  /** Act as a given owner for the next call (drives the wrong-owner-witness tests). */
  actAs(secret: Uint8Array): void {
    this.privateState = { ...this.privateState, ownerSecret: secret };
  }

  get ledger() {
    return managerLedger(this.state);
  }

  private ctx(circuitId: string): CircuitContext<ManagerPS> {
    return createCircuitContext<ManagerPS>(circuitId as any, this.address, COIN_PK, this.state, this.privateState);
  }

  /** The account id the contract derives for a given owner secret. */
  async ownerCommitmentFor(secret: Uint8Array): Promise<Uint8Array> {
    const prev = this.privateState;
    this.privateState = { ...this.privateState, ownerSecret: secret };
    try {
      return await this.call<Uint8Array>('myAccount');
    } finally {
      this.privateState = prev;
    }
  }

  /** Call an impure circuit, committing the resulting state on success. */
  async call<T = unknown>(circuitId: string, ...args: unknown[]): Promise<T> {
    const res = await this.contract.impureCircuits[circuitId](this.ctx(circuitId), ...args);
    // The post-call ledger state lives in this contract's query context.
    const qc = res.context?.queryContexts?.[this.address];
    if (qc?.state) this.state = qc.state;
    const ps = res.context?.callContext?.currentPrivateState;
    if (ps) this.privateState = ps;
    return res.result as T;
  }

  /**
   * Call expecting a rejection; returns the error message. Asserts the WHOLE ledger is byte-identical
   * afterwards — which for Manager v3 is the state-neutrality proof the spec asks for by name: the
   * snapshot carries every map's SIZE as well as its contents, so a refusal that lazily created an
   * empty cell would be caught even though the cell's value is zero.
   */
  async expectReject(circuitId: string, ...args: unknown[]): Promise<string> {
    const before = JSON.stringify(snapshotLedger(this.ledger));
    try {
      await this.contract.impureCircuits[circuitId](this.ctx(circuitId), ...args);
    } catch (e) {
      const after = JSON.stringify(snapshotLedger(this.ledger));
      if (before !== after) throw new Error(`state changed on a rejected call to ${circuitId}`);
      return e instanceof Error ? e.message : String(e);
    }
    throw new Error(`expected ${circuitId} to reject, but it succeeded`);
  }
}

/**
 * Byte-comparable snapshot of the WHOLE Manager v3 ledger: the account set, every pooled coin
 * (identity as well as value), every shielded cell and every unshielded cell, plus all three map
 * SIZES. Used by the "state and funds unchanged" and "no state created" assertions, so a rejection
 * that moved — or merely CREATED — anything at all is caught, not just one that touched the cell the
 * test happened to look at (FR-202).
 */
export const snapshotLedger = (l: any) => {
  const pools: Record<string, unknown> = {};
  for (const [k, v] of l.pools) {
    pools[hex(k)] = {
      nonce: hex(v.nonce),
      color: hex(v.color),
      value: String(v.value),
      mt_index: String(v.mt_index),
    };
  }
  const shielded: Record<string, string> = {};
  for (const [k, v] of l.shieldedBalances) shielded[hex(k)] = String(v);
  const unshielded: Record<string, string> = {};
  for (const [k, v] of l.unshieldedBalances) unshielded[hex(k)] = String(v);
  const accounts: string[] = [];
  for (const a of l.accounts) accounts.push(hex(a));
  accounts.sort();

  return {
    accounts,
    poolCount: String(l.pools.size()),
    pools,
    shieldedCount: String(l.shieldedBalances.size()),
    shieldedBalances: shielded,
    unshieldedCount: String(l.unshieldedBalances.size()),
    unshieldedBalances: unshielded,
  };
};

/** The three map sizes as one comparable tuple — the "exact map sizes" assertion in miniature. */
export const mapSizes = (l: any) => ({
  pools: Number(l.pools.size()),
  shieldedCells: Number(l.shieldedBalances.size()),
  unshieldedCells: Number(l.unshieldedBalances.size()),
});
