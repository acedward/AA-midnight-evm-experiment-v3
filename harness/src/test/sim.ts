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
import {
  Contract as ManagerContract,
  ledger as managerLedger,
  pureCircuits as managerPureCircuits,
} from '../../generated/manager/contract/index.js';
// @ts-ignore — generated artifact, present after compilation
import { Contract as MinterContract, ledger as minterLedger } from '../../generated/minter/contract/index.js';
// @ts-ignore — generated artifact, present after compilation
import {
  Contract as MinterCollideContract,
  ledger as minterCollideLedger,
} from '../../generated/minter-collide/contract/index.js';

/** Private state: just the owner secret the witness hands to the circuit. */
export type ManagerPS = { ownerSecret: Uint8Array };

/** One zswap input a circuit consumed. */
export type ZswapInputView = { nonce: string; colour: string; value: bigint; mtIndex: bigint };
/** One zswap output a circuit created. */
export type ZswapOutputView = {
  nonce: string;
  colour: string;
  value: bigint;
  /** True when the recipient is a contract address rather than a user coin public key. */
  toContract: boolean;
  recipient: string;
};

/** A circuit call's result plus the zswap structure and effects it produced. */
export type CallDetail<T> = {
  result: T;
  inputs: ZswapInputView[];
  outputs: ZswapOutputView[];
  effects: {
    claimedNullifiers: string[];
    claimedShieldedSpends: string[];
    claimedShieldedReceives: string[];
  };
};

/**
 * The per-colour ZSWAP IMBALANCE a call contributes, computed the way the ledger does it:
 * inputs count POSITIVE, outputs count NEGATIVE. A surplus is positive, a deficit negative, and
 * balancing is legal only when nothing is negative (`ledger/src/verify.rs`; measured live by
 * 00006 spike S3, whose control case failed with `invalid balance -4 … in segment 0`).
 *
 * Colours with a net delta of 0 are omitted, so the map reads exactly like `Transaction.imbalances`.
 */
export const zswapDeltas = (call: Pick<CallDetail<unknown>, 'inputs' | 'outputs'>): Record<string, bigint> => {
  const out: Record<string, bigint> = {};
  for (const i of call.inputs) out[i.colour] = (out[i.colour] ?? 0n) + i.value;
  for (const o of call.outputs) out[o.colour] = (out[o.colour] ?? 0n) - o.value;
  for (const [k, v] of Object.entries(out)) if (v === 0n) delete out[k];
  return out;
};

/**
 * The Manager's PURE circuits, callable with no context — this is where the compiler puts a circuit
 * that touches no ledger state (which is also why they cost no proving key). 00006 exports
 * `zswapNullifierOf` / `zswapCommitmentOf` through here purely so the swap circuits' transcription of
 * the standard library's PRIVATE `coinNullifier` / `coinCommitment` can be tested for equality
 * against the values the stdlib itself claims, rather than trusted.
 */
export const managerPure = managerPureCircuits as {
  shieldedKey: (acct: Uint8Array, colour: Uint8Array) => Uint8Array;
  unshieldedKey: (acct: Uint8Array, colour: Uint8Array) => Uint8Array;
  zswapNullifierOf: (
    coin: { nonce: Uint8Array; color: Uint8Array; value: bigint },
    addr: { bytes: Uint8Array },
  ) => Uint8Array;
  zswapCommitmentOf: (
    coin: { nonce: Uint8Array; color: Uint8Array; value: bigint },
    recipient: { is_left: boolean; left: { bytes: Uint8Array }; right: { bytes: Uint8Array } },
  ) => Uint8Array;
};

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
    return (await this.callDetailed<T>(circuitId, ...args)).result;
  }

  /**
   * Call an impure circuit and return the ZSWAP SHAPE it produced as well as its result — the
   * coins the circuit consumed as zswap inputs, the coins it created as outputs, and the effects it
   * claimed (nullifiers, shielded spends, shielded receives).
   *
   * This is what makes 00006's surplus circuit testable OFFLINE. A swap offer's whole correctness
   * claim is a statement about zswap structure — "the A leg is internally balanced" (v1) versus
   * "the A leg leaves a positive imbalance addressed to nobody" (v2) — and the pinned
   * `@midnight-ntwrk/compact-runtime` records exactly that in `callContext.currentZswapLocalState`
   * and `queryContext.effects`. So the FR-302 imbalance claim and the ledger's own effects rules
   * (`ledger/src/verify.rs:1528`/`:1548`/`:1599`) can be checked before any stack is booted, and a
   * live refusal can be attributed to a layer rather than guessed at.
   */
  async callDetailed<T = unknown>(circuitId: string, ...args: unknown[]): Promise<CallDetail<T>> {
    const res = await this.contract.impureCircuits[circuitId](this.ctx(circuitId), ...args);
    // The post-call ledger state lives in this contract's query context.
    const qc = res.context?.queryContexts?.[this.address];
    if (qc?.state) this.state = qc.state;
    const ps = res.context?.callContext?.currentPrivateState;
    if (ps) this.privateState = ps;
    const zswap = res.context?.callContext?.currentZswapLocalState;
    return {
      result: res.result as T,
      inputs: (zswap?.inputs ?? []).map((c: any) => ({
        nonce: hex(c.nonce),
        colour: hex(c.color),
        value: BigInt(c.value),
        mtIndex: BigInt(c.mt_index ?? 0n),
      })),
      outputs: (zswap?.outputs ?? []).map((o: any) => ({
        nonce: hex(o.coinInfo.nonce),
        colour: hex(o.coinInfo.color),
        value: BigInt(o.coinInfo.value),
        toContract: !o.recipient.is_left,
        recipient: hex(o.recipient.is_left ? o.recipient.left.bytes : o.recipient.right.bytes),
      })),
      effects: {
        claimedNullifiers: [...((qc?.effects?.claimedNullifiers ?? []) as string[])].sort(),
        claimedShieldedSpends: [...((qc?.effects?.claimedShieldedSpends ?? []) as string[])].sort(),
        claimedShieldedReceives: [...((qc?.effects?.claimedShieldedReceives ?? []) as string[])].sort(),
      },
    };
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
