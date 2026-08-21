// THE OFFLINE PLACEMENT MODEL — computing the F-310 guaranteed/fallible decision with no chain.
// 00006 Plan 05 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1. Finding F-313.
//
// ================================================================================================
// WHAT THIS IS, AND EXACTLY HOW FAR IT MAY BE TRUSTED
// ================================================================================================
//
// `partitionTranscripts(calls: PreTranscript[], params: LedgerParameters): PartitionedTranscript[]` IS
// BOUND TO JS in the pinned `@midnightntwrk/ledger-v9` (`ledger-v9.d.ts:2641`). It is the SAME function
// the ledger uses to decide which half of a transcript is guaranteed — the decision F-308 and F-310
// are both about — so the decision can be computed offline from a simulator run.
//
// The feeding recipe is not invented here; it is transcribed from the pinned SDK's own code path,
// `@midnight-ntwrk/compact-js/dist/esm/effect/ContractExecutable.js:49-70` (`asLedgerQueryContext` and
// `partitionAllTranscripts`). That matters: a hand-rolled approximation of the partitioner's input
// would measure something adjacent to the real decision, whereas this measures the decision.
//
// THE ONE PLACE THE OFFLINE MODEL IS KNOWN TO DIVERGE, stated up front because everything downstream
// depends on it. `partitionAllTranscripts` is called live with `circuitContext.ledgerParameters`, which
// `midnight-js-contracts` FETCHES FROM THE CHAIN
// (`publicDataProvider.queryZSwapAndContractState` returns `[zswapChainState, contractState,
// ledgerParameters]`, `dist/index.mjs:1402`). With `LedgerParameters.initialParameters()` this model
// puts stock Manager v4's boundary at SEVENTEEN custody cells; the chain puts it at TWO (F-310). So:
//
//   * this model is used for RELATIVE comparison between arms measured under IDENTICAL parameters and
//     identical simulator conditions — which is exactly what the five arms differ in;
//   * `params` is INJECTABLE, and `captureParams`/`loadParams` below let a live run pin the chain's own
//     parameters into a file the offline sweep then uses;
//   * no ABSOLUTE boundary from this model is reported as a lane fact unless the live matrix agrees at
//     the points both cover. `calibrate()` performs that comparison explicitly and its result is
//     recorded beside every ranking.
//
// ================================================================================================
// THE DECISION RULE, read from the pinned ledger rather than inferred
// ================================================================================================
//
// `midnight-ledger/ledger/src/construct.rs::partition_transcripts` (`:1009`), for the single-call,
// no-`Op::Ckpt` case every variant here produces:
//
//     budget   = min_time_to_dismiss - per_tx_cost_reserve(full_runs)
//     required = QueryResults::gas_heuristic(params, true, program.field_size() + 2).max_time()
//     guaranteed if required <= budget, else ZERO sections are guaranteed
//
// (The per-call `guaranteed_budget` is added to the closure budget and then subtracted again by the
// `spare_min_time_to_dismiss` term, so it cancels for one root.) `min_time_to_dismiss` is 15 ms and
// `time_to_dismiss_per_byte` is 2 us/B at `INITIAL_LIMITS` (`structure.rs:1274-1275`).
//
// NEITHER SIDE OF THAT INEQUALITY IS READABLE FROM JS. What IS readable is `Transcript.gas`, which
// `split_at` sets to `gas_heuristic(params, false, 0)` = the raw transcript gas x 1.2, WITHOUT the
// proof-verification and application terms. So this module reports `gas` as a PROXY (labelled as one)
// and takes the placement verdict from the partitioner itself, which is the authoritative answer.
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  ChargedState as LedgerChargedState,
  LedgerParameters,
  partitionTranscripts,
  PreTranscript,
  QueryContext as LedgerQueryContext,
  StateValue as LedgerStateValue,
} from '@midnightntwrk/ledger-v9';
import { readFileSync, writeFileSync } from 'node:fs';
import { custodySize, importVariant, type CustodySize, type VariantSpec } from './variants.js';

const COIN_PK = '0'.repeat(64);

export const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');

/** A deterministic 32-byte value from a label, as `src/test/sim.ts::secretOf`. */
export const secretOf = (label: string): Uint8Array => {
  const b = new Uint8Array(32);
  const src = Buffer.from(label, 'utf-8');
  if (src.length > 32) throw new Error(`label "${label}" exceeds 32 bytes`);
  b.set(src.subarray(0, 32));
  return b;
};

// --- ledger parameters ---------------------------------------------------------------------------

/**
 * Persist a `LedgerParameters` (hex of its own `serialize()`) so a LIVE run can hand the chain's real
 * parameters to the offline model. Written as JSON rather than raw bytes so it can live in committed
 * evidence and be read by eye.
 */
export const captureParams = (params: any, file: string, note: string): void => {
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        note,
        capturedUtc: new Date().toISOString(),
        source: 'publicDataProvider.queryZSwapAndContractState(...)[2] — the CHAIN parameters',
        rendered: String(params).slice(0, 20000),
        serializedHex: Buffer.from(params.serialize()).toString('hex'),
      },
      null,
      2,
    )}\n`,
  );
};

export const loadParams = (file: string): any =>
  (LedgerParameters as any).deserialize(Buffer.from(JSON.parse(readFileSync(file, 'utf-8')).serializedHex, 'hex'));

export const initialParams = (): any => (LedgerParameters as any).initialParameters();

// --- the partitioner, fed exactly as the SDK feeds it --------------------------------------------

/**
 * The compact-runtime uses `@midnightntwrk/onchain-runtime-v4` query contexts; `partitionTranscripts`
 * wants `@midnightntwrk/ledger-v9` ones. Transcribed from compact-js's `asLedgerQueryContext`: the
 * conversion carries only the STATE, so `block` and `effects` are re-assigned by hand.
 */
const asLedgerQueryContext = (qc: any): any => {
  const sv = (LedgerStateValue as any).decode(qc.state.state.encode());
  const lqc = new (LedgerQueryContext as any)(new (LedgerChargedState as any)(sv), qc.address);
  lqc.block = qc.block;
  lqc.effects = qc.effects;
  return lqc;
};

export type TranscriptGas = {
  readTime: string;
  computeTime: string;
  bytesWritten: string;
  bytesDeleted: string;
};

export type HalfReport = {
  ops: number;
  /** PROXY ONLY — `gas_heuristic(params, false, 0)`, not the quantity the partitioner compares. */
  gas: TranscriptGas;
  claimedNullifiers: number;
  claimedShieldedReceives: number;
  claimedShieldedSpends: number;
};

export type PlacementReading = {
  /** GUARANTEED = everything in the guaranteed half; FALLIBLE = zero sections guaranteed. */
  placement: 'GUARANTEED' | 'FALLIBLE' | 'SPLIT';
  guaranteed?: HalfReport;
  fallible?: HalfReport;
  /** Total program ops across both halves — a layout-independent size measure for the circuit. */
  totalOps: number;
};

const gasOf = (t: any): TranscriptGas => ({
  readTime: String(t.gas.readTime),
  computeTime: String(t.gas.computeTime),
  bytesWritten: String(t.gas.bytesWritten),
  bytesDeleted: String(t.gas.bytesDeleted),
});

const halfOf = (t: any): HalfReport => ({
  ops: t.program.length,
  gas: gasOf(t),
  claimedNullifiers: t.effects.claimedNullifiers.length,
  claimedShieldedReceives: t.effects.claimedShieldedReceives.length,
  claimedShieldedSpends: t.effects.claimedShieldedSpends.length,
});

/** Partition one simulator call's trace and read the placement of its LAST (root) call. */
export const readPlacement = (trace: any[], params: any): PlacementReading => {
  const pre = trace.map(
    (e) =>
      new (PreTranscript as any)(
        Array.from(e.finalQueryContext.comIndices as Map<any, any>).reduce(
          (qc: any, com: any) => qc.insertCommitment(com[0], com[1]),
          asLedgerQueryContext(e.initialQueryContext),
        ),
        e.publicTranscript,
        e.commCommData?.commComm,
      ),
  );
  const parts = (partitionTranscripts as any)(pre, params);
  const [g, f] = parts[parts.length - 1];
  const guaranteed = g ? halfOf(g) : undefined;
  const fallible = f ? halfOf(f) : undefined;
  const placement = guaranteed && !fallible ? 'GUARANTEED' : !guaranteed && fallible ? 'FALLIBLE' : 'SPLIT';
  return {
    placement,
    ...(guaranteed ? { guaranteed } : {}),
    ...(fallible ? { fallible } : {}),
    totalOps: (guaranteed?.ops ?? 0) + (fallible?.ops ?? 0),
  };
};

// --- a variant-generic simulator ----------------------------------------------------------------

export type CallResult = { result: unknown; trace: any[] };

/**
 * A simulator over ANY G5 variant, with the two things the matrix needs that `src/test/sim.ts` does
 * not expose: the `callProofDataTrace` (which is what the partitioner eats) and a DRY-RUN mode that
 * runs a circuit without committing its state, so an offer can be measured at a given custody size
 * without perturbing that size.
 */
export class VariantSim {
  readonly address: string;
  private readonly contract: any;
  private readonly mod: any;
  private state: any;
  private ps: any;

  private constructor(mod: any, contract: any, address: string, state: any, ps: any) {
    this.mod = mod;
    this.contract = contract;
    this.address = address;
    this.state = state;
    this.ps = ps;
  }

  static async create(v: VariantSpec, initialSecret: Uint8Array = secretOf('g5')): Promise<VariantSim> {
    const mod = await importVariant(v, 'generated');
    const witnesses = {
      localOwnerSecret: (ctx: any): [any, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
    };
    const contract = new mod.Contract(witnesses);
    const address = sampleContractAddress();
    const ps = { ownerSecret: initialSecret };
    const init = await contract.initialState(createConstructorContext(ps, COIN_PK));
    return new VariantSim(mod, contract, address, init.currentContractState.data, init.currentPrivateState ?? ps);
  }

  get ledger(): any {
    return this.mod.ledger(this.state);
  }

  get pure(): any {
    return this.mod.pureCircuits;
  }

  actAs(secret: Uint8Array): void {
    this.ps = { ...this.ps, ownerSecret: secret };
  }

  private ctx(circuitId: string): any {
    return createCircuitContext<any>(circuitId as any, this.address, COIN_PK, this.state, this.ps);
  }

  /** Run a circuit and COMMIT its state. */
  async call<T = unknown>(circuitId: string, ...args: unknown[]): Promise<T> {
    const res = await this.contract.impureCircuits[circuitId](this.ctx(circuitId), ...args);
    const qc = res.context?.queryContexts?.[this.address];
    if (qc?.state) this.state = qc.state;
    const np = res.context?.callContext?.currentPrivateState;
    if (np) this.ps = np;
    return res.result as T;
  }

  /**
   * Run a circuit and THROW AWAY its state, returning the trace.
   *
   * This is what makes the dose-response cheap and non-destructive: the offer at each custody size is
   * measured against exactly that size, and measuring it does not change it. The live rig has to build
   * and prove a real offer per point and discard it; here the discard is free.
   */
  async dryRun(circuitId: string, ...args: unknown[]): Promise<CallResult> {
    const res = await this.contract.impureCircuits[circuitId](this.ctx(circuitId), ...args);
    return { result: res.result, trace: res.context.callProofDataTrace };
  }

  /** Run a circuit, commit, AND return its trace — for measuring the self-balanced phases of arm (e). */
  async callTraced<T = unknown>(circuitId: string, ...args: unknown[]): Promise<{ result: T; trace: any[] }> {
    const res = await this.contract.impureCircuits[circuitId](this.ctx(circuitId), ...args);
    const trace = res.context.callProofDataTrace;
    const qc = res.context?.queryContexts?.[this.address];
    if (qc?.state) this.state = qc.state;
    const np = res.context?.callContext?.currentPrivateState;
    if (np) this.ps = np;
    return { result: res.result as T, trace };
  }

  async accountFor(secret: Uint8Array): Promise<Uint8Array> {
    const prev = this.ps;
    this.ps = { ...this.ps, ownerSecret: secret };
    try {
      return await this.call<Uint8Array>('myAccount');
    } finally {
      this.ps = prev;
    }
  }
}

// --- offer arguments, per FR-308 shape ----------------------------------------------------------

export type Shape = 'named-taker' | 'floating-surplus';

const ZERO_EITHER = {
  is_left: true,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: new Uint8Array(32) },
};

/** `Maybe<Either<ZswapCoinPublicKey, ContractAddress>>` — the argument that selects the shape. */
export const recipientArg = (shape: Shape, keyByte = 0xaa) =>
  shape === 'floating-surplus'
    ? { is_some: false, value: ZERO_EITHER }
    : {
        is_some: true,
        value: { is_left: true, left: { bytes: new Uint8Array(32).fill(keyByte) }, right: { bytes: new Uint8Array(32) } },
      };

export const coin = (colour: Uint8Array, value: bigint, nonceByte: number) => ({
  nonce: new Uint8Array(32).fill(nonceByte % 256),
  color: colour,
  value,
});

// --- the dose-response, offline ------------------------------------------------------------------

export type DosePoint = {
  variant: string;
  arm: string;
  shape: Shape;
  targetCells: number;
  observed: CustodySize;
  offer: PlacementReading;
  /**
   * For arm (e) only: the SELF-BALANCED phases, measured too. They are not offers, so their placement
   * does not constrain publishability — but their cost is what the arm is trading away and Plan 05
   * requires it measured rather than assumed.
   */
  stagePhase?: PlacementReading;
  consolidatePhase?: PlacementReading;
  error?: string;
};

export type DoseOptions = {
  /** Custody sizes to measure at, in CELLS. */
  cells: number[];
  shapes: Shape[];
  params: any;
  /** Value per deposit; also the give amount ceiling. */
  depositValue?: bigint;
  give?: bigint;
  want?: bigint;
};

/**
 * Grow one variant's custody CELL BY CELL and measure an offer's placement at each requested size.
 *
 * Custody is grown exactly as spike S5b grew it — deposits of the SAME colour credited to DIFFERENT
 * accounts, so the cell count rises while the pool count stays at one. That is the only way to
 * separate the two dimensions, and it is what made step 2 of F-310's table the load-bearing row.
 * Every offer gives that colour and wants a FRESH colour with no pool, so the merge branch of
 * `claimWantedColour` is never taken and the only thing varying across points is how much state the
 * transcript reads.
 */
export const doseResponse = async (v: VariantSpec, opts: DoseOptions): Promise<DosePoint[]> => {
  const depositValue = opts.depositValue ?? 8n;
  const give = opts.give ?? 1n;
  const want = opts.want ?? 1n;
  const points: DosePoint[] = [];
  const G = new Uint8Array(32).fill(0x11);

  /**
   * A FRESH simulator grown to exactly `n` cells.
   *
   * One sim per measurement point, not one sim walked up the ladder — and that is a correctness fix,
   * not tidiness. Arm (e)'s offer protocol CANNOT be dry-run: `openSwap` needs a coin in the escrow
   * cell, so `stageOffer` must really commit, and `consolidate` then credits the WANTED colour into
   * custody. Walking one sim up the ladder therefore let arm (e) grow its own pool and cell counts as
   * a side effect of being measured (the first run of this sweep reported `cells=24 pools=9` for a
   * point that asked for 16 cells and 1 pool, and eventually drained the maker's own balance —
   * `failed assert: account colour balance too low`). Rebuilding is cheap offline, and it makes every
   * point a statement about exactly the custody size it claims.
   */
  const grownTo = async (n: number): Promise<{ sim: VariantSim; secrets: Uint8Array[]; ids: Uint8Array[] }> => {
    const sim = await VariantSim.create(v);
    const secrets: Uint8Array[] = [];
    const ids: Uint8Array[] = [];
    for (let i = 0; i < n; i++) {
      const s = secretOf(`g5-owner-${i}`);
      secrets.push(s);
      const id = await sim.accountFor(s);
      ids.push(id);
      await sim.call('registerAccount', id);
    }
    // Deposits of the SAME colour to DIFFERENT accounts: cells rise, pools stay at one. The maker is
    // always account 0 and is credited first, so the maker's own cell exists at every size.
    sim.actAs(secrets[0]!);
    for (let i = 0; i < n; i++) {
      await sim.call('depositShielded', coin(G, depositValue, i + 1), ids[i]!);
    }
    sim.actAs(secrets[0]!);
    return { sim, secrets, ids };
  };

  let wantSeq = 100;
  for (const n of opts.cells) {
    for (const shape of opts.shapes) {
      const W = new Uint8Array(32).fill((0x40 + (wantSeq % 100)) % 256);
      wantSeq++;
      const { sim, ids } = await grownTo(n);
      const observed = custodySize(v, sim.ledger);
      try {
        if (v.offer === 'staged') {
          // Arm (e): stage (self-balanced, map-heavy) -> openSwap (THE OFFER, cells only) ->
          // consolidate (self-balanced). All three are measured; only `openSwap` is an offer.
          const staged = await sim.callTraced('stageOffer', G, give);
          const offer = await sim.callTraced('openSwap', recipientArg(shape), coin(W, want, 200));
          const consolidated = await sim.callTraced('consolidate');
          points.push({
            variant: v.id,
            arm: v.arm,
            shape,
            targetCells: n,
            observed,
            offer: readPlacement(offer.trace, opts.params),
            stagePhase: readPlacement(staged.trace, opts.params),
            consolidatePhase: readPlacement(consolidated.trace, opts.params),
          });
        } else {
          const { trace } = await sim.dryRun(
            'openSwapShielded',
            G,
            give,
            recipientArg(shape),
            coin(W, want, 200),
            ids[0]!,
          );
          points.push({
            variant: v.id,
            arm: v.arm,
            shape,
            targetCells: n,
            observed,
            offer: readPlacement(trace, opts.params),
          });
        }
      } catch (e) {
        points.push({
          variant: v.id,
          arm: v.arm,
          shape,
          targetCells: n,
          observed,
          offer: { placement: 'FALLIBLE', totalOps: 0 },
          error: e instanceof Error ? e.message.split('\n')[0] : String(e),
        });
      }
    }
  }

  return points;
};

/** Where a variant's placement flips, read from its own dose points. */
export type Boundary = {
  variant: string;
  arm: string;
  shape: Shape;
  lastGuaranteedCells: number | null;
  firstFallibleCells: number | null;
  monotone: boolean;
};

export const boundaryOf = (points: DosePoint[], shape: Shape): Boundary => {
  const mine = points.filter((p) => p.shape === shape).sort((a, b) => a.observed.cells - b.observed.cells);
  const g = mine.filter((p) => p.offer.placement === 'GUARANTEED').map((p) => p.observed.cells);
  const f = mine.filter((p) => p.offer.placement !== 'GUARANTEED').map((p) => p.observed.cells);
  const firstFallible = f.length ? Math.min(...f) : null;
  return {
    variant: mine[0]?.variant ?? '(none)',
    arm: mine[0]?.arm ?? '(none)',
    shape,
    lastGuaranteedCells: g.length ? Math.max(...g) : null,
    firstFallibleCells: firstFallible,
    monotone:
      firstFallible === null ||
      mine.filter((p) => p.observed.cells >= firstFallible).every((p) => p.offer.placement !== 'GUARANTEED'),
  };
};

/**
 * Compare the offline model against LIVE observations, point by point.
 *
 * This is the gate on every claim the model is allowed to make. `live` is a list of
 * (variant, shape, cells, placement) tuples read from the live matrix; agreement means the model may
 * be quoted for absolute boundaries too, disagreement means it may only be quoted for relative
 * ordering — and either way the comparison itself is recorded.
 */
export type LiveObservation = { variant: string; shape: Shape; cells: number; placement: string };

export type Calibration = {
  compared: number;
  agreed: number;
  disagreements: Array<{ variant: string; shape: Shape; cells: number; offline: string; live: string }>;
  verdict: 'CALIBRATED' | 'DIVERGENT' | 'NO OVERLAP';
};

export const calibrate = (offline: DosePoint[], live: LiveObservation[]): Calibration => {
  const disagreements: Calibration['disagreements'] = [];
  let compared = 0;
  let agreed = 0;
  for (const o of live) {
    const m = offline.find((p) => p.variant === o.variant && p.shape === o.shape && p.observed.cells === o.cells);
    if (!m) continue;
    compared++;
    if (m.offer.placement === o.placement) agreed++;
    else
      disagreements.push({
        variant: o.variant,
        shape: o.shape,
        cells: o.cells,
        offline: m.offer.placement,
        live: o.placement,
      });
  }
  return {
    compared,
    agreed,
    disagreements,
    verdict: compared === 0 ? 'NO OVERLAP' : disagreements.length === 0 ? 'CALIBRATED' : 'DIVERGENT',
  };
};
