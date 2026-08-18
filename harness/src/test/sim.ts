// Minimal in-process simulator for the compiled contracts (EXPERIMENTAL_LANE, LANE-DEV-1).
//
// Uses only the pinned `@midnight-ntwrk/compact-runtime@0.18.0-rc.1` — the same runtime version
// the compiler stamped into the artifacts and the same one the pinned midnight-js depends on.
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';

// The compiled Manager. Built by scripts/g2/compile.sh into harness/generated/manager.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated artifact, present after compilation
import { Contract as ManagerContract, ledger as managerLedger } from '../../generated/manager/contract/index.js';

/** Private state: just the owner secret the witness hands to the circuit. */
export type ManagerPS = { ownerSecret: Uint8Array };

export const secretOf = (label: string): Uint8Array => {
  const b = new Uint8Array(32);
  const src = Buffer.from(label, 'utf-8');
  b.set(src.subarray(0, Math.min(32, src.length)));
  return b;
};

const COIN_PK = '0'.repeat(64);

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

  /** Act as a given owner for the next call (drives the wrong-owner-witness test). */
  actAs(secret: Uint8Array): void {
    this.privateState = { ...this.privateState, ownerSecret: secret };
  }

  get ledger() {
    return managerLedger(this.state);
  }

  private ctx(circuitId: string): CircuitContext<ManagerPS> {
    return createCircuitContext<ManagerPS>(
      circuitId as any,
      this.address,
      COIN_PK,
      this.state,
      this.privateState,
    );
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

  /** Call expecting a rejection; returns the error message. Asserts state is unchanged. */
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

/** Byte-comparable snapshot used by the "state and funds unchanged" assertions. */
export const snapshotLedger = (l: any) => ({
  configured: l.configured,
  minterShieldedColor: Buffer.from(l.minterShieldedColor).toString('hex'),
  minterUnshieldedColor: Buffer.from(l.minterUnshieldedColor).toString('hex'),
  hasPool: l.hasPool,
  pool: {
    nonce: Buffer.from(l.pool.nonce).toString('hex'),
    color: Buffer.from(l.pool.color).toString('hex'),
    value: String(l.pool.value),
    mt_index: String(l.pool.mt_index),
  },
  accountsSize: String(l.accounts.size()),
});
