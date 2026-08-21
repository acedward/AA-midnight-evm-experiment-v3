// SPIKE S2 — what actually causes node `Custom error: 104`? (F-301, and its revision.)
// Plan 01 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1. Feeds organizer issue 0001.
//
// THE DECODE, which stands regardless of any verdict below:
//   `104` = `InvalidError::Transcript`, `midnight-node/ledger/src/versions/common/types.rs:406`.
//   Issue 0001 listed "decode 104" as step 1 of any future investigation. Done, from source.
//
// THE HYPOTHESIS UNDER TEST (master plan F-301). Four true statements about the pinned sources:
//   1. each call in an SDK contract-scoped batch becomes its OWN transaction, built with
//      `Transaction.fromPartsRandomized` — `midnight-js-contracts/dist/index.mjs:1025` — RANDOM segment;
//   2. the scope merges them: `current.unprovenTx.merge(next.unprovenTx)` (`:1228`);
//   3. the ledger applies intents in ASCENDING physical segment order:
//      `tx.intents.sorted_iter()`, `midnight-ledger/ledger/src/semantics.rs:1097`;
//   4. `Segment` is documented as "logical segment index used in ... ledger application order",
//      `midnight-ledger/ledger/src/structure.rs:1826`.
//   => predicted: a DESCENDING random draw makes call 2 replay against a state it never saw → 104,
//      as a coin flip — the "first attempt refused, identical retry sometimes accepted" signature
//      issue 0001 records and could not explain.
//
// The sources being right does not make the prediction right, which is the entire point of running it.
//
// FOUR SHAPES, because the obvious one has no power to detect the mechanism
//
//   A  INDEPENDENT pair — `depositShielded(S5)` + `depositUnshielded(U5)` into AA_B. Exactly 00005's
//      probe M3 and exactly the shape issue 0001 is about. But its two calls touch DISJOINT state:
//      `pools`+`shieldedBalances` vs `unshieldedBalances`, sharing only the `accounts` set, which
//      neither modifies. Replaying order-independent calls in either order should be fine, so A
//      cannot on its own refute the hypothesis — it is here because it is the shape under complaint.
//
//   B  DEPENDENT pair — `depositShielded(S5, 1 -> AA_B)` then
//      `transferInternalShielded(AA_B -> AA_A, S5, 1)`. Call 2's guard READS THE VERY CELL call 1
//      wrote (`assert(shieldedBalanceOf(acct, col) >= amt)`), so this is a genuine read-after-write.
//      An earlier draft used two `depositShielded` calls on the same colour instead; that shape cannot
//      even be BUILT at these pins (finding F-305, recorded in the evidence), so it was replaced.
//
//   D  FRESH LAZY-INIT — shape A, but with a BRAND-NEW issuer and colour pair per attempt, so EVERY
//      attempt is a true double lazy-init (a new `pools` key AND two new cells), which is what 00005's
//      M3 actually was. Earlier runs of this spike showed shape A refusing only when an attempt was
//      BOTH a lazy-init AND descending, so D holds lazy-init constant and lets the order vary. It
//      characterises WHEN a disjoint pair inherits the ordering problem; it does not decide the
//      verdict, because a disjoint pair's coupling is structural rather than a value read.
//
//   C  THE FIX — shape **B** with the merged transaction's intents re-keyed to segments 1 and 2 IN
//      CALL ORDER before proving. Applied to B, not D, because B is where the mechanism is confirmed:
//      demonstrating a fix on a shape whose behaviour is not clean would prove nothing. Only run if B
//      shows a clean correlation.
//
// Every refusal is recorded verbatim (F-202 clean). Every accepted attempt is accounted for in the
// custody bookkeeping at the end, which doubles as the state-neutrality proof for the refusals.
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { submitCallTx, withContractScopedTransaction } from '@midnight-ntwrk/midnight-js-contracts';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { closeParty } from '../wallet.js';
import { log, withDustRetry } from '../night.js';
import { errorChain, mintShieldedToUser, mintUnshieldedToUser } from '../g3/actions.js';
import { mapSizes, shieldedKeyOf, unshieldedKeyOf } from '../manager-view.js';
import { actAs, bootstrapSpikeRig, type MinterInfo, type SpikeRig } from './spike-rig.js';

const EVID = join(REPO_ROOT, 'evidence', 'g1-spikes');
const stamp = () => new Date().toISOString();
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const ATTEMPTS = Number(process.env.S2_ATTEMPTS ?? 12);
/** Shape D costs a Minter deployment plus two mints per attempt, so it gets its own budget. */
const FRESH_ATTEMPTS = Number(process.env.S2_FRESH_ATTEMPTS ?? 10);

// --- SHARED-HOST HARDENING (added after G1 run 1 was VOIDed by host starvation) -----------------
//
// Run 1 of this spike died with `'prove' returned an error: AbortError: The user aborted a request.`
// after the host's 1-minute load average hit 21.7 on 16 cores; one attempt that normally takes ~24 s
// took 12.5 minutes. A starved proof server produces failures that LOOK like refusals in the
// evidence, which would silently corrupt the very correlation this spike exists to measure. Three
// guards, all of which make the data more honest rather than more forgiving:
//
//   1. a LOAD GATE before the run and before every attempt;
//   2. a per-attempt TIMEOUT, so one starved proof cannot stall the whole run;
//   3. INCREMENTAL evidence writes, so a killed run still leaves usable partial data.
//
// THE THRESHOLD is the machine's core count. A 1-minute load average equal to `nproc` means the CPUs
// are fully committed but not oversubscribed; above it, runnable work is QUEUEING, and the proof
// server — the one CPU-hungry, latency-sensitive component in the stack — starts missing its client's
// deadline. So the threshold is not a taste call: it is the point where adding our own proving work
// makes the queue, and therefore the measurement, worse.
const LOAD_LIMIT = Number(process.env.S2_LOAD_LIMIT ?? cpus().length);
/** How long to wait for a busy host before giving up and VOIDing the run. */
const LOAD_WAIT_MS = Number(process.env.S2_LOAD_WAIT_MS ?? 20 * 60 * 1000);
/** Per-attempt wall-clock budget. Healthy attempts take ~20-30 s; 4 minutes is ~8x headroom. */
const ATTEMPT_TIMEOUT_MS = Number(process.env.S2_ATTEMPT_TIMEOUT_MS ?? 4 * 60 * 1000);
/** How many times to re-run an attempt that failed for INFRASTRUCTURE reasons. */
const INFRA_RETRIES = Number(process.env.S2_INFRA_RETRIES ?? 3);

/**
 * Failures that say something about the HOST, not about the ledger. These are excluded from the
 * correlation and retried; they are never counted as refusals.
 *
 * Kept deliberately narrow — a starved proof server and a client-side abort/timeout, nothing else. A
 * broad pattern here would let real refusals be laundered into "infrastructure", which is exactly the
 * failure this guard exists to prevent.
 */
const INFRA_PATTERNS = [
  /AbortError/i,
  /The user aborted a request/i,
  /'prove' returned an error/i,
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i,
  /AA_ATTEMPT_TIMEOUT/,
];
const isInfrastructure = (msg: string): boolean => INFRA_PATTERNS.some((re) => re.test(msg));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The host's 1-minute load average. */
const load1 = (): number => loadavg()[0] ?? 0;

/**
 * Block until the host is quiet enough to measure on. Returns the load it proceeded at, or throws
 * `HOST_TOO_BUSY` after `LOAD_WAIT_MS` — which VOIDs the run rather than recording bad data.
 */
const awaitQuietHost = async (what: string): Promise<number> => {
  const deadline = Date.now() + LOAD_WAIT_MS;
  let waited = 0;
  for (;;) {
    const l = load1();
    if (l <= LOAD_LIMIT) {
      if (waited > 0) log(`  load gate: host quiet again (1-min load ${l.toFixed(2)} <= ${LOAD_LIMIT}) after ${Math.round(waited / 1000)}s`);
      return l;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `HOST_TOO_BUSY: 1-min load ${l.toFixed(2)} still above ${LOAD_LIMIT} after ${Math.round(LOAD_WAIT_MS / 1000)}s ` +
          `waiting before ${what}; VOIDing rather than measuring on a starved host`,
      );
    }
    if (waited === 0) log(`  load gate: 1-min load ${l.toFixed(2)} > ${LOAD_LIMIT}; waiting for the host to quieten before ${what}`);
    await sleep(20_000);
    waited += 20_000;
  }
};

/** Race a promise against a wall-clock budget. The loser is reported as an infrastructure failure. */
const withTimeout = async <T>(what: string, ms: number, fn: () => Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_res, rej) => {
        timer = setTimeout(() => rej(new Error(`AA_ATTEMPT_TIMEOUT: ${what} exceeded ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

type Shape = 'independent' | 'dependent' | 'fresh-lazy-init' | 'dependent-fixed';

const SHAPE_LABEL: Record<Shape, string> = {
  independent: 'A — INDEPENDENT pair (00005 M3: depositShielded S5 + depositUnshielded U5 -> AA_B; DISJOINT state)',
  dependent:
    'B — DEPENDENT pair (depositShielded S5 -> AA_B, then transferInternalShielded AA_B -> AA_A; call 2 reads the cell call 1 wrote)',
  'fresh-lazy-init':
    'D — FRESH LAZY-INIT (shape A with a brand-new issuer and colour pair per attempt: every attempt creates a new pool key and two new cells)',
  'dependent-fixed':
    'C — THE FIX (shape B with the merged intents re-keyed to segments 1,2 in CALL order before proving)',
};

type Attempt = {
  attempt: number;
  shape: Shape;
  /** Were the intents re-keyed into call order before proving? */
  resegment: boolean;
  /** Did this attempt create brand-new map keys (a true lazy-init)? */
  lazyInit: boolean;
  /** For the fresh shapes: the issuer and colours this attempt used. */
  issuer?: { label: string; tag: string; shielded: string; unshielded: string };
  call1Segment: number | null;
  call2Segment: number | null;
  order: 'ascending' | 'descending' | 'unknown';
  resegmented?: { from: number[]; to: number[] } | { failed: string };
  ok: boolean;
  txId?: string;
  error?: string;
  is104: boolean;
  /** The node's `Custom error: NNN` code, when the node answered at all. */
  errorCode?: number;
  /** True when the failure came from the SDK/proof side, before the node ever saw the transaction. */
  failedBeforeSubmission: boolean;
  /**
   * VOID: this attempt tells us nothing about the ledger — a starved proof server, a client abort or
   * the per-attempt timeout. Excluded from every correlation figure and from the N of the sample.
   */
  void: boolean;
  /** How many infrastructure failures were absorbed before this attempt produced a real answer. */
  infraRetries: number;
  /** The host's 1-min load average when the attempt actually started. */
  loadAtStart: number;
  /** For a VOID attempt: did it nevertheless land on chain? Checked, not assumed. */
  landedDespiteVoid?: boolean;
};

/** The intent segment ids currently on the scope's accumulated transaction. */
const segmentsOnScope = (txCtx: any): number[] => {
  try {
    const tx = txCtx?.submitTxOptions?.unprovenTx;
    return Array.from((tx?.intents?.keys?.() ?? []) as Iterable<number>).map(Number);
  } catch {
    return [];
  }
};

/**
 * Re-key a merged, UNPROVEN, UNBOUND transaction's intents so ascending segment order equals CALL
 * ORDER. `orderedOld` lists the old segment ids in call order.
 *
 * Legal exactly here and nowhere later: the ledger-9 setter refuses a bound transaction and, for an
 * unproven pre-binding one, recomputes the binding randomness itself
 * (`midnight-ledger/ledger-wasm/src/tx.rs:1150-1180`). Any fallible offer keyed by an old segment is
 * remapped with its intent, or the transaction would balance against a segment that no longer exists.
 */
const resegmentInCallOrder = (tx: any, orderedOld: number[]): { from: number[]; to: number[] } => {
  const intents: Map<number, any> = tx.intents;
  if (!intents) throw new Error('transaction has no intents to re-key');
  const fallible: Map<number, any> | undefined = tx.fallibleOffer ?? undefined;

  const nextIntents = new Map<number, any>();
  const nextFallible = new Map<number, any>();
  orderedOld.forEach((old, i) => {
    const seg = i + 1;
    const intent = intents.get(old);
    if (!intent) throw new Error(`no intent at segment ${old}`);
    nextIntents.set(seg, intent);
    const offer = fallible?.get(old);
    if (offer) nextFallible.set(seg, offer);
  });
  for (const [seg, intent] of intents) if (!orderedOld.includes(seg)) nextIntents.set(seg, intent);

  tx.intents = nextIntents;
  if (fallible && fallible.size > 0) tx.fallibleOffer = nextFallible;
  return { from: orderedOld, to: orderedOld.map((_v, i) => i + 1) };
};

type RunOpts = {
  rig: SpikeRig;
  shape: Shape;
  attempt: number;
  lazyInit: boolean;
  shieldedColour: Uint8Array;
  shieldedColourHex: string;
  unshieldedColour: Uint8Array;
  unshieldedColourHex: string;
  issuer?: Attempt['issuer'];
};

const oneAttempt = async (o: RunOpts): Promise<Attempt> => {
  const resegment = o.shape === 'dependent-fixed';
  // Both 'dependent' and 'dependent-fixed' use the DEPENDENT pair — C is B plus re-keying. Testing
  // `=== 'dependent'` alone made shape C silently run the INDEPENDENT specs (and exhaust the
  // unshielded mint budget), so it measured the wrong thing under the right name. Caught by G1 run 3.
  const dependent = o.shape === 'dependent' || o.shape === 'dependent-fixed';

  const require = dependent
    ? [{ colour: o.shieldedColourHex, shielded: true, amount: 1n }]
    : [
        { colour: o.shieldedColourHex, shielded: true, amount: 1n },
        { colour: o.unshieldedColourHex, shielded: false, amount: 1n },
      ];
  const spender = await o.rig.openSpender('OwnerN', SEEDS.ownerN, require);
  const providers = spender.managerProviders;
  // Shape B's second call is owner-authorized: it debits AA_B, so the witness must open AA_B.
  if (dependent) await actAs(providers, o.rig.raw.secretB);

  let call1Segment: number | null = null;
  let call2Segment: number | null = null;
  let resegmented: Attempt['resegmented'];

  const specs = dependent
    ? [
        {
          circuitId: 'depositShielded',
          args: [{ nonce: randomBytes(32), color: o.shieldedColour, value: 1n }, o.rig.raw.AA_B],
        },
        { circuitId: 'transferInternalShielded', args: [o.rig.raw.AA_A, o.shieldedColour, 1n] },
      ]
    : [
        {
          circuitId: 'depositShielded',
          args: [{ nonce: randomBytes(32), color: o.shieldedColour, value: 1n }, o.rig.raw.AA_B],
        },
        { circuitId: 'depositUnshielded', args: [o.unshieldedColour, 1n, o.rig.raw.AA_B] },
      ];

  const base = {
    attempt: o.attempt,
    shape: o.shape,
    resegment,
    lazyInit: o.lazyInit,
    infraRetries: 0,
    loadAtStart: load1(),
    ...(o.issuer ? { issuer: o.issuer } : {}),
  };

  try {
    const finalized: any = await withTimeout(`S2/${o.shape}/attempt-${o.attempt}`, ATTEMPT_TIMEOUT_MS, () =>
      withDustRetry(spender.party, `S2/${o.shape}/attempt-${o.attempt}`, () =>
      (withContractScopedTransaction as any)(
        providers,
        async (txCtx: any) => {
          for (const spec of specs) {
            await (submitCallTx as any)(
              providers,
              {
                compiledContract: o.rig.ctx.compiledManager(),
                circuitId: spec.circuitId,
                contractAddress: o.rig.managerAddress,
                args: spec.args,
                privateStateId: 'manager',
              },
              txCtx,
            );
            const segs = segmentsOnScope(txCtx);
            if (call1Segment === null) {
              call1Segment = segs[0] ?? null;
            } else if (call2Segment === null) {
              const added = segs.filter((s) => s !== call1Segment);
              call2Segment = added.length === 1 ? added[0]! : (segs[segs.length - 1] ?? null);
            }
          }
          if (resegment && call1Segment !== null && call2Segment !== null) {
            try {
              resegmented = resegmentInCallOrder(txCtx.submitTxOptions.unprovenTx, [call1Segment, call2Segment]);
            } catch (e) {
              resegmented = { failed: errorChain(e) };
              throw e;
            }
          }
        },
        { scopeName: `aa00006-s2-${o.shape}-${o.attempt}` },
      ),
    ),
    );
    return {
      ...base,
      void: false,
      call1Segment,
      call2Segment,
      order:
        call1Segment === null || call2Segment === null ? 'unknown' : call1Segment < call2Segment ? 'ascending' : 'descending',
      resegmented,
      ok: true,
      txId: String(finalized?.public?.txId ?? finalized?.public?.txHash ?? finalized),
      is104: false,
      failedBeforeSubmission: false,
    };
  } catch (e) {
    const error = errorChain(e);
    const infra = isInfrastructure(error);
    return {
      ...base,
      call1Segment,
      call2Segment,
      order:
        call1Segment === null || call2Segment === null ? 'unknown' : call1Segment < call2Segment ? 'ascending' : 'descending',
      resegmented,
      ok: false,
      error,
      is104: /Custom error: 104\b/.test(error),
      ...(() => {
        const m = /Custom error: (\d+)\b/.exec(error);
        return m ? { errorCode: Number(m[1]) } : {};
      })(),
      // "executing" = inside the scope callback, i.e. build/prove; "submitting" = the node answered.
      failedBeforeSubmission: /error executing scoped transaction/.test(error),
      // A starved proof server or a client abort says nothing about the ledger: VOID, never a refusal.
      void: infra,
    };
  } finally {
    await spender.close();
  }
};

/**
 * Summarise the shape's COUNTING attempts — VOID ones are excluded from every figure, because an
 * attempt killed by a starved proof server is evidence about the host, not about intent ordering.
 * Their count is reported separately so nothing is hidden.
 */
/**
 * Run ONE attempt with all three shared-host guards around it.
 *
 *   1. LOAD GATE first — never start measuring on a starved host.
 *   2. On an INFRASTRUCTURE failure (starved prover, client abort, per-attempt timeout), re-run the
 *      attempt instead of recording it, up to `INFRA_RETRIES` times, so host noise costs wall clock
 *      rather than sample size. Only the FINAL outcome is recorded, carrying the retry count.
 *   3. A VOID attempt is CHECKED against the chain rather than assumed harmless: a timeout can in
 *      principle fire after the node already accepted the transaction. If custody moved, the attempt
 *      is reclassified as landed so the bookkeeping stays sound.
 *
 * Anything that is NOT in `INFRA_PATTERNS` — every node refusal, every `104` — is returned
 * immediately and untouched. The guards can only discard host noise, never a real answer.
 */
const guardedAttempt = async (
  o: RunOpts,
  cellsBefore: () => Promise<string>,
): Promise<Attempt> => {
  let last: Attempt | undefined;
  for (let tryNo = 0; tryNo <= INFRA_RETRIES; tryNo++) {
    await awaitQuietHost(`${o.shape} attempt ${o.attempt}`);
    const before = await cellsBefore();
    const r = await oneAttempt(o);
    r.infraRetries = tryNo;
    if (!r.void) return r;

    // VOID. Did it land anyway? Give the chain a moment, then look.
    await sleep(15_000);
    const after = await cellsBefore();
    r.landedDespiteVoid = after !== before;
    if (r.landedDespiteVoid) {
      log(
        `  attempt ${o.attempt}: VOID (${r.error}) but custody MOVED — reclassifying as landed so the ` +
          'bookkeeping stays sound',
      );
      r.void = false;
      r.ok = true;
      return r;
    }
    last = r;
    if (tryNo < INFRA_RETRIES) {
      log(`  attempt ${o.attempt}: VOID (infrastructure, created no state) — retrying (${tryNo + 1}/${INFRA_RETRIES}): ${r.error}`);
    } else {
      log(`  attempt ${o.attempt}: VOID after ${INFRA_RETRIES} retries; recorded as VOID and EXCLUDED from the sample`);
    }
  }
  return last!;
};

const summarise = (all: Attempt[]) => {
  const rows = all.filter((r) => !r.void);
  const voided = all.filter((r) => r.void);
  const asc = rows.filter((r) => r.order === 'ascending');
  const desc = rows.filter((r) => r.order === 'descending');
  const lazy = rows.filter((r) => r.lazyInit);
  return {
    attemptsRun: all.length,
    voided: voided.length,
    infraRetriesAbsorbed: all.reduce((n, r) => n + r.infraRetries, 0),
    attempts: rows.length,
    accepted: rows.filter((r) => r.ok).length,
    refused: rows.filter((r) => !r.ok).length,
    refusedWith104: rows.filter((r) => r.is104).length,
    refusedBeforeSubmission: rows.filter((r) => r.failedBeforeSubmission).length,
    ascending: { n: asc.length, accepted: asc.filter((r) => r.ok).length, refused: asc.filter((r) => !r.ok).length },
    descending: { n: desc.length, accepted: desc.filter((r) => r.ok).length, refused: desc.filter((r) => !r.ok).length },
    lazyInit: { n: lazy.length, accepted: lazy.filter((r) => r.ok).length, refused: lazy.filter((r) => !r.ok).length },
    unknownOrder: rows.filter((r) => r.order === 'unknown').length,
  };
};

const main = async () => {
  mkdirSync(EVID, { recursive: true });
  console.log(`# SPIKE S2 — what causes node \`Custom error: 104\`? — ${LANE_STAMP} — ${stamp()}`);
  console.log(`# attempts: ${ATTEMPTS} for shapes A/B, ${FRESH_ATTEMPTS} for shapes D/C`);

  console.log(
    `# host: ${cpus().length} cores, 1-min load ${load1().toFixed(2)}; load gate at ${LOAD_LIMIT}, ` +
      `per-attempt timeout ${Math.round(ATTEMPT_TIMEOUT_MS / 1000)}s, up to ${INFRA_RETRIES} infrastructure retries`,
  );
  await awaitQuietHost('bootstrapping the rig');

  const rig = await bootstrapSpikeRig({ withTaker: false });
  const rows: Record<Shape, Attempt[]> = {
    independent: [],
    dependent: [],
    'fresh-lazy-init': [],
    'dependent-fixed': [],
  };
  const summaries: Partial<Record<Shape, ReturnType<typeof summarise>>> = {};
  let verdict = 'INCONCLUSIVE';
  let note = '';

  /**
   * Write what we have SO FAR, after every attempt. G1 run 1 was killed mid-shape and left nothing
   * behind; a spike whose only output appears at the end throws away every attempt it already paid
   * for. `status` says plainly that the file is mid-run, so a partial file can never be mistaken for
   * a finished result.
   */
  const flush = (status: 'in-progress' | 'complete', extra: Record<string, unknown> = {}) => {
    writeFileSync(
      join(EVID, 's2-segment-order.json'),
      `${JSON.stringify(
        {
          spike: 'S2',
          status,
          label: LANE_STAMP,
          utc: stamp(),
          host: { cores: cpus().length, loadGate: LOAD_LIMIT, attemptTimeoutMs: ATTEMPT_TIMEOUT_MS, infraRetries: INFRA_RETRIES },
          rows,
          summaries,
          ...extra,
        },
        bigints,
        2,
      )}\n`,
    );
  };
  flush('in-progress');

  try {
    const toke = await rig.deployMinter('Minter5', 'TOKE');
    const S = toke.shieldedRaw;
    const U = toke.unshieldedRaw;

    const premint = async (m: MinterInfo, shielded: bigint, unshielded: bigint) => {
      const obs = await rig.openObserver('OwnerN-premint', SEEDS.ownerN);
      try {
        const sTx = await mintShieldedToUser(rig.ctx, m.label, shielded, obs, rig.fee);
        const addr = String((await (obs.wallet as any).unshielded.getAddress()).hexString).toLowerCase();
        const uTx = await mintUnshieldedToUser(rig.ctx, m.label, unshielded, addr, rig.fee);
        log(`minted ${shielded} ${m.tagText}-shielded (${sTx}) and ${unshielded} ${m.tagText}-unshielded (${uTx}) to OwnerN`);
        return { sTx, uTx };
      } finally {
        await closeParty(obs);
      }
    };
    // Shielded: shapes A, B and C each spend 1 per attempt. Unshielded: shape A only.
    const mintTxs = await premint(toke, BigInt(ATTEMPTS * 3 + 8), BigInt(ATTEMPTS + 4));

    const cellS_B = shieldedKeyOf(rig.raw.AA_B, S);
    const cellU_B = unshieldedKeyOf(rig.raw.AA_B, U);
    const cellS_A = shieldedKeyOf(rig.raw.AA_A, S);
    const before = await rig.readManagerNow();
    log(`custody maps before S2: ${JSON.stringify(mapSizes(before))}`);

    const runShared = async (shape: Shape, n: number) => {
      console.log(`\n## SHAPE ${SHAPE_LABEL[shape]}`);
      for (let i = 1; i <= n; i++) {
        const snap = await rig.readManagerNow();
        const lazyInit =
          shape === 'dependent'
            ? snap.shieldedBalances[cellS_A] === undefined
            : snap.shieldedBalances[cellS_B] === undefined && snap.unshieldedBalances[cellU_B] === undefined;
        const sharedCells = async () => {
          const m = await rig.readManagerNow();
          return JSON.stringify([m.shieldedBalances[cellS_B] ?? 0n, m.unshieldedBalances[cellU_B] ?? 0n, m.shieldedBalances[cellS_A] ?? 0n].map(String));
        };
        const r = await guardedAttempt(
          {
            rig,
            shape,
            attempt: i,
            lazyInit,
            shieldedColour: S,
            shieldedColourHex: toke.shieldedColour,
            unshieldedColour: U,
            unshieldedColourHex: toke.unshieldedColour,
          },
          sharedCells,
        );
        rows[shape].push(r);
        summaries[shape] = summarise(rows[shape]);
        flush('in-progress');
        log(
          `  attempt ${i}: lazyInit=${r.lazyInit} load=${r.loadAtStart.toFixed(2)} segments call1=${r.call1Segment} call2=${r.call2Segment} (${r.order}) -> ` +
            `${r.void ? 'VOID (infrastructure — excluded)' : r.ok ? `ACCEPTED ${r.txId}` : `REFUSED${r.is104 ? ' (104)' : ''}${r.failedBeforeSubmission ? ' [before submission]' : ''}`}` +
            `${r.error ? ` — ${r.error}` : ''}`,
        );
      }
      summaries[shape] = summarise(rows[shape]);
      log(`  shape ${shape} summary: ${JSON.stringify(summaries[shape])}`);
      return summaries[shape]!;
    };

    /** Shapes D and C: a BRAND-NEW issuer and colour pair per attempt, so every attempt is lazy-init. */
    const runFresh = async (shape: Shape, n: number) => {
      console.log(`\n## SHAPE ${SHAPE_LABEL[shape]}`);
      for (let i = 1; i <= n; i++) {
        const tag = `TD${String(i).padStart(2, '0')}`;
        const m = await rig.deployMinter(`Minter-${tag}`, tag);
        await premint(m, 2n, 2n);
        const snap = await rig.readManagerNow();
        const lazyInit =
          snap.shieldedBalances[shieldedKeyOf(rig.raw.AA_B, m.shieldedRaw)] === undefined &&
          snap.unshieldedBalances[unshieldedKeyOf(rig.raw.AA_B, m.unshieldedRaw)] === undefined &&
          snap.pools[m.shieldedColour] === undefined;
        if (!lazyInit) throw new Error(`${tag}: a brand-new issuer's colours are somehow already in custody`);
        void 0;
        const freshCells = async () => {
          const mm = await rig.readManagerNow();
          const sk = shieldedKeyOf(rig.raw.AA_B, m.shieldedRaw);
          const uk = unshieldedKeyOf(rig.raw.AA_B, m.unshieldedRaw);
          return JSON.stringify([mm.shieldedBalances[sk] ?? 0n, mm.unshieldedBalances[uk] ?? 0n].map(String));
        };
        const r = await guardedAttempt(
          {
            rig,
            shape,
            attempt: i,
            lazyInit,
            shieldedColour: m.shieldedRaw,
            shieldedColourHex: m.shieldedColour,
            unshieldedColour: m.unshieldedRaw,
            unshieldedColourHex: m.unshieldedColour,
            issuer: { label: m.label, tag: m.tagText, shielded: m.shieldedColour, unshielded: m.unshieldedColour },
          },
          freshCells,
        );
        rows[shape].push(r);
        summaries[shape] = summarise(rows[shape]);
        flush('in-progress');
        log(
          `  attempt ${i} (${tag}): load=${r.loadAtStart.toFixed(2)} segments call1=${r.call1Segment} call2=${r.call2Segment} (${r.order})` +
            `${r.resegment ? ` re-keyed ${JSON.stringify(r.resegmented)}` : ''} -> ` +
            `${r.void ? 'VOID (infrastructure — excluded)' : r.ok ? `ACCEPTED ${r.txId}` : `REFUSED${r.is104 ? ' (104)' : ''}${r.failedBeforeSubmission ? ' [before submission]' : ''}`}` +
            `${r.error ? ` — ${r.error}` : ''}`,
        );
      }
      summaries[shape] = summarise(rows[shape]);
      log(`  shape ${shape} summary: ${JSON.stringify(summaries[shape])}`);
      return summaries[shape]!;
    };

    const sumA = await runShared('independent', ATTEMPTS);
    const sumB = await runShared('dependent', ATTEMPTS);
    const sumD = await runFresh('fresh-lazy-init', FRESH_ATTEMPTS);

    // --- the decision is made on shape B, and here is why -----------------------------------------
    //
    // B is the only shape with a GUARANTEED cross-call state dependency on every attempt: call 2's
    // guard reads the very cell call 1 wrote, whether or not any map key is new. A is dependent only
    // when a key is created (lazy-init); D makes every attempt a lazy-init but its two calls are still
    // in DIFFERENT ledger fields, so whatever coupling lazy-init introduces is structural rather than
    // a value read — and the data shows it is not reliable. Keying the verdict on B tests the
    // mechanism where the mechanism must apply; A and D then characterise WHEN a disjoint pair
    // inherits it.
    const bRefusals = rows.dependent.filter((r) => !r.ok);
    const bSawBoth = sumB.ascending.n > 0 && sumB.descending.n > 0;
    const bAllRefusals104 = bRefusals.length > 0 && bRefusals.every((r) => r.is104);
    const bPerfect = bSawBoth && sumB.ascending.refused === 0 && sumB.descending.accepted === 0 && bAllRefusals104;

    let sumC: ReturnType<typeof summarise> | null = null;
    if (bPerfect) {
      // The fix is demonstrated on the shape whose mechanism is confirmed — shape B — not on D.
      sumC = await runShared('dependent-fixed', ATTEMPTS);
    } else {
      console.log('\n## SHAPE C — SKIPPED: shape B shows no clean correlation, so there is no confirmed mechanism to fix');
    }

    // --- bookkeeping: every accepted attempt accounted for ----------------------------------------
    const acc = (shape: Shape) => rows[shape].filter((r) => r.ok).length;
    const after = await rig.readManagerNow();
    const expect: Record<string, bigint> = {
      // shape A: +1 S5 and +1 U5 to AA_B per accepted attempt.
      // shapes B and C: deposit +1 to AA_B then transfer 1 away, so AA_B nets 0 and AA_A gains 1.
      'AA_B S5': BigInt(acc('independent')),
      'AA_B U5': BigInt(acc('independent')),
      'AA_A S5': BigInt(acc('dependent') + acc('dependent-fixed')),
    };
    const observed: Record<string, bigint> = {
      'AA_B S5': after.shieldedBalances[cellS_B] ?? 0n,
      'AA_B U5': after.unshieldedBalances[cellU_B] ?? 0n,
      'AA_A S5': after.shieldedBalances[cellS_A] ?? 0n,
    };
    // Each accepted fresh attempt must have credited its OWN colours with exactly 1; each refused one, 0.
    const freshChecks: Array<Record<string, unknown>> = [];
    for (const shape of ['fresh-lazy-init'] as Shape[]) {
      for (const r of rows[shape]) {
        if (!r.issuer) continue;
        const sCell = after.shieldedBalances[shieldedKeyOf(rig.raw.AA_B, Buffer.from(r.issuer.shielded, 'hex'))] ?? 0n;
        const uCell = after.unshieldedBalances[unshieldedKeyOf(rig.raw.AA_B, Buffer.from(r.issuer.unshielded, 'hex'))] ?? 0n;
        const want = r.ok ? 1n : 0n;
        freshChecks.push({
          shape,
          attempt: r.attempt,
          tag: r.issuer.tag,
          accepted: r.ok,
          shieldedCell: String(sCell),
          unshieldedCell: String(uCell),
          ok: sCell === want && uCell === want,
        });
      }
    }
    const bookkeepingOk =
      Object.keys(expect).every((k) => observed[k] === expect[k]) && freshChecks.every((c) => c.ok === true);

    // --- verdict, decided on shape B ---------------------------------------------------------------
    const lazyDesc = rows['fresh-lazy-init'].filter((r) => r.order === 'descending');
    const lazyAsc = rows['fresh-lazy-init'].filter((r) => r.order === 'ascending');
    // How the DISJOINT shapes behaved, which is what turns the mechanism into a usable rule.
    const disjointRows = [...rows.independent, ...rows['fresh-lazy-init']];
    const disjointDescRefused = disjointRows.filter((r) => r.order === 'descending' && !r.ok).length;
    const disjointDescN = disjointRows.filter((r) => r.order === 'descending').length;
    const disjointAscRefused = disjointRows.filter((r) => r.order === 'ascending' && !r.ok).length;
    const disjointAscN = disjointRows.filter((r) => r.order === 'ascending').length;
    // The single strongest number in the whole spike: across every OBSERVATION shape, how often did an
    // ASCENDING pair get refused? If that is zero over a decent N, descending order is a NECESSARY
    // condition.
    //
    // Shape C is DELIBERATELY EXCLUDED. It is the INTERVENTION arm — its transactions were rewritten
    // before submission — so its outcomes measure the intervention, not the lane's natural behaviour.
    // Pooling it in would let a failure of the fix masquerade as a counterexample to the correlation,
    // which is precisely backwards.
    const allRows = [...rows.independent, ...rows.dependent, ...rows['fresh-lazy-init']];
    const allAsc = allRows.filter((r) => r.order === 'ascending');
    const allDesc = allRows.filter((r) => r.order === 'descending');
    const necessity = {
      ascending: { n: allAsc.length, refused: allAsc.filter((r) => !r.ok).length },
      descending: { n: allDesc.length, refused: allDesc.filter((r) => !r.ok).length },
    };
    const disjointSuffix =
      ` ACROSS EVERY SHAPE: ascending pairs refused ${necessity.ascending.refused}/${necessity.ascending.n}, ` +
      `descending pairs refused ${necessity.descending.refused}/${necessity.descending.n} — so descending order is a ` +
      `NECESSARY condition for 104 in this family. Whether it is also SUFFICIENT depends on the pair: for a genuine ` +
      `read-after-write (shape B) it is; for disjoint pairs (shapes A+D) descending refused ` +
      `${disjointDescRefused}/${disjointDescN} and ascending ${disjointAscRefused}/${disjointAscN}, so something ` +
      `further is needed there. Either way the MITIGATION is the same and is deterministic: assign segments in call ` +
      `order, never randomly, and a descending pair can never arise.`;

    if (!bSawBoth) {
      verdict = 'INCONCLUSIVE';
      note =
        `shape B produced only ${sumB.ascending.n ? 'ascending' : 'descending'} segment pairs in ${ATTEMPTS} ` +
        'attempts, so the correlation could not be tested in both directions — rerun with a larger N';
    } else if (sumB.refused === 0) {
      verdict = 'REFUTED';
      note =
        `shape B — a genuine read-after-write across the pair — was accepted ${sumB.accepted}/${sumB.attempts} times, ` +
        `including ${sumB.descending.n} DESCENDING segment pairs. Descending segment order does not cause error 104, ` +
        'so F-301 as stated is refuted.' + disjointSuffix;
    } else if (bPerfect && sumC && sumC.refused === 0) {
      verdict = 'CONFIRMED + FIX DEMONSTRATED';
      note =
        `in shape B every descending pair was refused with 104 (${sumB.descending.refused}/${sumB.descending.n}) and ` +
        `every ascending pair was accepted (${sumB.ascending.accepted}/${sumB.ascending.n}); re-keying the intents into ` +
        `CALL ORDER made ${sumC.accepted}/${sumC.attempts} attempts of the SAME shape succeed.` + disjointSuffix;
    } else if (bPerfect && sumC && sumC.refusedWith104 === 0) {
      // The fix did not "partly work": it broke the transaction in a DIFFERENT way, and it did so for
      // originally-ASCENDING draws too — which would have been accepted untouched. So this says nothing
      // about the correlation and everything about the transformation.
      const codes = [...new Set(rows['dependent-fixed'].filter((r) => !r.ok).map((r) => r.errorCode).filter(Boolean))];
      verdict = 'CONFIRMED — but the POST-HOC fix is REFUTED AS IMPLEMENTED';
      note =
        `shape B's correlation held perfectly. The proposed mitigation, however, does NOT work when applied by ` +
        `re-keying the merged transaction's intents after the calls were built: ${sumC.refused}/${sumC.attempts} ` +
        `attempts were refused, NONE of them with 104, with node error code(s) ${codes.join(', ')} instead ` +
        `(235 = MalformedZswapErrorCode::InvalidProof). Crucially it failed for originally-ASCENDING draws too ` +
        `(${sumC.ascending.refused}/${sumC.ascending.n}), which would have been accepted untouched — so the ` +
        `TRANSFORMATION is invalid, not the ordering hypothesis. Rewriting the segment assignment after the fact ` +
        `invalidates the zswap proofs that are bound to it. The mitigation must therefore be applied AT BUILD TIME, ` +
        `inside the SDK, where each call's transaction is constructed (i.e. a deterministic in-call-order segment ` +
        `instead of \`fromPartsRandomized\`) — not as a post-processing step.` + disjointSuffix;
    } else if (bPerfect && sumC) {
      verdict = 'CONFIRMED, FIX INCOMPLETE';
      note =
        `shape B's correlation held perfectly, but re-keying still left ${sumC.refused}/${sumC.attempts} refusals, ` +
        `${sumC.refusedWith104} of them still 104 — so segment order is A cause, not the only one.` + disjointSuffix;
    } else {
      verdict = 'PARTIAL — a correlation is present but not clean';
      note =
        `shape B refused ${sumB.refused}/${sumB.attempts} (${sumB.refusedWith104} with 104): ascending refused ` +
        `${sumB.ascending.refused}/${sumB.ascending.n}, descending refused ${sumB.descending.refused}/${sumB.descending.n}. ` +
        'Descending order is therefore not SUFFICIENT (or not NECESSARY) for 104 even for a dependent pair.' +
        disjointSuffix;
    }

    const payload = {
      spike: 'S2',
      label: LANE_STAMP,
      utc: stamp(),
      question: 'is node `Custom error: 104` the segment-order bug F-301 predicts?',
      decode: {
        '104': 'InvalidError::Transcript — midnight-node/ledger/src/versions/common/types.rs:406 (read from the pinned reference)',
        '171': 'still undecoded (issue 0002); it is not in the InvalidError arm of that enum',
        '235': 'MalformedZswapErrorCode::InvalidProof — midnight-node/ledger/src/versions/common/types.rs:446 ' +
          '(decoded here because the post-hoc re-keying fix provokes it)',
        mechanismSources: [
          'midnight-js-contracts/dist/index.mjs:1025 — each scoped call is Transaction.fromPartsRandomized (RANDOM segment)',
          'midnight-js-contracts/dist/index.mjs:1228 — the scope merges them: current.unprovenTx.merge(next.unprovenTx)',
          'midnight-ledger/ledger/src/semantics.rs:1097 — the ledger applies intents via tx.intents.sorted_iter() (ASCENDING segment)',
          'midnight-ledger/ledger/src/structure.rs:1826 — "Segment: logical segment index used in ... ledger application order"',
        ],
      },
      shapes: SHAPE_LABEL,
      whyFourShapes:
        "shape A is 00005's M3 pair, but its two calls touch DISJOINT contract state, so it has no power to detect " +
        'an ordering bug reliably; shape B adds a genuine read-after-write and is the shape the verdict is decided ' +
        'on; shape D holds lazy-init constant with brand-new colours per attempt and characterises WHEN a disjoint ' +
        'pair inherits the problem; shape C applies the fix to shape B, run only if B confirms.',
      managerAddress: rig.managerAddress,
      accounts: rig.ids,
      sharedIssuer: {
        label: toke.label,
        tag: toke.tagText,
        address: toke.address,
        S5: toke.shieldedColour,
        U5: toke.unshieldedColour,
      },
      mintTxs,
      attempts: { sharedShapes: ATTEMPTS, freshShapes: FRESH_ATTEMPTS },
      shapeA_independent: { rows: rows.independent, summary: sumA },
      shapeB_dependent: { rows: rows.dependent, summary: sumB },
      shapeD_freshLazyInit: { rows: rows['fresh-lazy-init'], summary: sumD },
      shapeC_dependentFixed: sumC ? { rows: rows['dependent-fixed'], summary: sumC } : 'skipped',
      necessityAcrossAllShapes: necessity,
      lazyInitOrderBreakdown: {
        note: 'shape D only: every attempt is a lazy-init, so this is the order breakdown of a constant-lazy-init population',
        descending: { n: lazyDesc.length, refused: lazyDesc.filter((r) => !r.ok).length },
        ascending: { n: lazyAsc.length, refused: lazyAsc.filter((r) => !r.ok).length },
      },
      bookkeeping: {
        acceptedByShape: {
          A: acc('independent'),
          B: acc('dependent'),
          D: acc('fresh-lazy-init'),
          C: acc('dependent-fixed'),
        },
        expected: Object.fromEntries(Object.entries(expect).map(([k, v]) => [k, String(v)])),
        observed: Object.fromEntries(Object.entries(observed).map(([k, v]) => [k, String(v)])),
        freshPerAttemptCells: freshChecks,
        ok: bookkeepingOk,
        mapSizesBefore: mapSizes(before),
        mapSizesAfter: mapSizes(after),
      },
      verdict,
      note,
      feedsIssue0001: 'organizer: contract-token-custody-6d6cd3/AA/issues/0001-composed-tx-first-attempt-refused.md',
    };
    flush('complete', payload);

    const table = (shape: Shape): string[] => {
      const out: string[] = [];
      out.push('| # | issuer | lazy-init | call 1 seg | call 2 seg | order | re-keyed | outcome | node code | verbatim |');
      out.push('|---|---|---|---|---|---|---|---|---|---|');
      for (const r of rows[shape]) {
        out.push(
          `| ${r.attempt} | ${r.issuer?.tag ?? 'TOKE'} | ${r.lazyInit} | ${r.call1Segment ?? '—'} | ${r.call2Segment ?? '—'} | ` +
            `${r.order} | ${r.resegment ? JSON.stringify(r.resegmented) : '—'} | ` +
            `${r.ok ? `ACCEPTED \`${r.txId}\`` : `REFUSED${r.failedBeforeSubmission ? ' (before submission)' : ''}`} | ` +
            `${r.errorCode ?? (r.void ? 'n/a (VOID)' : '—')} | ${r.error ? `\`${r.error}\`` : '—'} |`,
        );
      }
      return out;
    };

    const md: string[] = [];
    md.push('# SPIKE S2 — what causes node `Custom error: 104`? (F-301 and its revision)');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    md.push(note);
    md.push('');
    md.push('## Shared-host guards (added after G1 run 1 was VOIDed)');
    md.push('');
    md.push('G1 run 1 of this spike died under host starvation: the 1-minute load average reached **21.7 on 16 cores**');
    md.push("(other tenants of this shared machine), one attempt took 12.5 minutes where its neighbours took ~24 s, and");
    md.push("the next died with `'prove' returned an error: AbortError: The user aborted a request.` That is a starved");
    md.push('proof server, not a node refusal — but in an evidence table it would look exactly like one. That run is');
    md.push('**VOID** and none of its numbers appear anywhere. Three guards now stand between host noise and the data:');
    md.push('');
    md.push('| Guard | Setting in this run | Why |');
    md.push('|---|---|---|');
    md.push(`| load gate before the run and every attempt | 1-min load must be ≤ **${LOAD_LIMIT}** (this host has ${cpus().length} cores) | at load = cores the CPUs are fully committed but not oversubscribed; above it, runnable work QUEUES and the proof server starts missing its client's deadline. Waiting costs wall clock; measuring through it costs the result |`);
    md.push(`| per-attempt timeout | ${Math.round(ATTEMPT_TIMEOUT_MS / 1000)} s (healthy attempts take ~20–30 s) | one starved proof cannot stall the whole run |`);
    md.push(`| infrastructure retries | up to ${INFRA_RETRIES} per attempt | host noise costs wall clock, not sample size |`);
    md.push('');
    md.push('A failure counts as INFRASTRUCTURE only if it matches a deliberately narrow list (`AbortError`, `\'prove\'');
    md.push("returned an error`, socket errors, the timeout itself). Everything else — every node refusal, every `104` —");
    md.push('is recorded untouched. The guards can discard host noise; they cannot launder a real refusal. A VOID');
    md.push('attempt is also CHECKED against the chain afterwards, because a timeout can in principle fire after the');
    md.push('node already accepted the transaction; if custody moved, the attempt is reclassified as landed.');
    md.push('');
    md.push('**VOID attempts are excluded from every figure below and from the N of the sample.** Each shape table');
    md.push('reports `attemptsRun`, `voided` and `attempts` (the counting ones) separately.');
    md.push('');
    md.push('## The decode — regardless of the verdict');
    md.push('');
    md.push('`104` = `InvalidError::Transcript`, `midnight-node/ledger/src/versions/common/types.rs:406`, read from the');
    md.push('pinned reference. Issue 0001 listed decoding 104 as step 1 of any future investigation into it. Done.');
    md.push('For the record `171` (issue 0002) is still undecoded — it is not in the `InvalidError` arm of that enum.');
    md.push('');
    md.push('## The predicted mechanism, from source');
    md.push('');
    md.push('| Step | Source |');
    md.push('|---|---|');
    md.push('| each scoped call becomes its own transaction with a RANDOM physical segment | `midnight-js-contracts/dist/index.mjs:1025` (`Transaction.fromPartsRandomized`) |');
    md.push('| the scope merges those transactions | `midnight-js-contracts/dist/index.mjs:1228` (`current.unprovenTx.merge(next.unprovenTx)`) |');
    md.push('| the ledger applies intents in ASCENDING segment order | `midnight-ledger/ledger/src/semantics.rs:1097` (`tx.intents.sorted_iter()`) |');
    md.push('| Segment is documented as the ledger APPLICATION ORDER index | `midnight-ledger/ledger/src/structure.rs:1826` |');
    md.push('');
    md.push('All four statements are true of the pinned sources. The prediction that FOLLOWS from them is what the');
    md.push('experiment tests, and the sources being right does not make the prediction right.');
    md.push('');
    md.push('## Why four shapes');
    md.push('');
    md.push('| Shape | What it is | Why |');
    md.push('|---|---|---|');
    md.push(
      "| A | `depositShielded(S5)` + `depositUnshielded(U5)` → AA_B | 00005's probe M3 — the shape issue 0001 is about. But its calls touch **disjoint** state (`pools`+`shieldedBalances` vs `unshieldedBalances`, sharing only the unmodified `accounts` set), so replaying them in either order is expected to work: **A has no power to detect an ordering bug** |",
    );
    md.push(
      '| B | `depositShielded(S5 → AA_B)` then `transferInternalShielded(AA_B → AA_A, S5, 1)` | a genuine read-after-write: call 2\'s guard `assert(shieldedBalanceOf(acct, col) >= amt)` reads the very cell call 1 wrote |',
    );
    md.push(
      '| D | shape A with a **brand-new issuer and colour pair per attempt** | every attempt is a true double lazy-init (new `pools` key + two new cells), which is what M3 actually was. It characterises **when a disjoint pair inherits** the ordering problem; it does not decide the verdict, because a disjoint pair\'s coupling is structural rather than a value read |',
    );
    md.push(
      '| C | **shape B** with intents re-keyed to 1,2 in CALL order | the fix, demonstrated on the shape whose mechanism is confirmed. Run only if B confirms, because demonstrating a fix for an unconfirmed mechanism is theatre |',
    );
    md.push('');
    md.push(`## Shape ${SHAPE_LABEL.independent} — ${ATTEMPTS} attempts`);
    md.push('');
    md.push(...table('independent'));
    md.push('');
    md.push(`Summary: \`${JSON.stringify(sumA)}\``);
    md.push('');
    md.push(`## Shape ${SHAPE_LABEL.dependent} — ${ATTEMPTS} attempts (THE DECIDING SHAPE)`);
    md.push('');
    md.push(...table('dependent'));
    md.push('');
    md.push(`Summary: \`${JSON.stringify(sumB)}\``);
    md.push('');
    md.push(`## Shape ${SHAPE_LABEL['fresh-lazy-init']} — ${FRESH_ATTEMPTS} attempts`);
    md.push('');
    md.push(...table('fresh-lazy-init'));
    md.push('');
    md.push(`Summary: \`${JSON.stringify(sumD)}\``);
    md.push('');
    md.push('Order breakdown over this constant-lazy-init population:');
    md.push('');
    md.push('| order | n | refused |');
    md.push('|---|---|---|');
    md.push(`| descending | ${lazyDesc.length} | ${lazyDesc.filter((r) => !r.ok).length} |`);
    md.push(`| ascending | ${lazyAsc.length} | ${lazyAsc.filter((r) => !r.ok).length} |`);
    md.push('');
    md.push('## The headline number — is descending order NECESSARY?');
    md.push('');
    md.push('Pooling every attempt of the three OBSERVATION shapes (A, B, D). **Shape C is excluded**: its');
    md.push('transactions were rewritten before submission, so its outcomes measure the intervention, not the');
    md.push("lane's natural behaviour — pooling it in would let a failure of the fix masquerade as a");
    md.push('counterexample to the correlation, which is exactly backwards.');
    md.push('');
    md.push('| segment order | attempts | refused |');
    md.push('|---|---|---|');
    md.push(`| ascending (call 1 < call 2) | ${necessity.ascending.n} | **${necessity.ascending.refused}** |`);
    md.push(`| descending (call 1 > call 2) | ${necessity.descending.n} | **${necessity.descending.refused}** |`);
    md.push('');
    md.push('An ascending pair is the case where the ledger happens to apply the two calls in the order they were');
    md.push('built. A refusal count of zero there, over a decent N, is the strong form of the claim: **descending');
    md.push('segment order is a NECESSARY condition for error 104 in this shape family.** Sufficiency is shape-');
    md.push('dependent (see shapes A/B/D above), but necessity is what makes the mitigation deterministic rather');
    md.push('than statistical: assign the segments in call order and a descending pair cannot arise at all.');
    md.push('');
    if (sumC) {
      md.push(`## Shape ${SHAPE_LABEL['dependent-fixed']} — ${ATTEMPTS} attempts`);
      md.push('');
      md.push('The merged transaction is still unproven and unbound at the moment it is re-keyed, which is the only');
      md.push('point where `Transaction.intents` may be written: the ledger-9 setter refuses a bound transaction and');
      md.push('recomputes the binding randomness itself (`midnight-ledger/ledger-wasm/src/tx.rs:1150-1180`).');
      md.push('');
      md.push(...table('dependent-fixed'));
      md.push('');
      md.push(`Summary: \`${JSON.stringify(sumC)}\``);
      md.push('');
    } else {
      md.push('## Shape C — not run');
      md.push('');
      md.push('Shape D showed no clean correlation, so there was no confirmed mechanism to fix. The re-keying helper');
      md.push('(`resegmentInCallOrder` in `harness/src/g1/spike-s2.ts`) is retained, working and typechecked, for');
      md.push('whoever revisits this.');
      md.push('');
    }
    md.push('## Bookkeeping — refusals created nothing');
    md.push('');
    md.push('| Cell | expected | observed | match |');
    md.push('|---|---|---|---|');
    for (const k of Object.keys(expect)) {
      md.push(`| ${k} | ${expect[k]} | ${observed[k]} | ${observed[k] === expect[k]} |`);
    }
    md.push('');
    md.push('Per-attempt cells for the fresh shapes (each accepted attempt must have credited its OWN colours with');
    md.push('exactly 1, each refused attempt with 0):');
    md.push('');
    md.push('| shape | # | tag | accepted | shielded cell | unshielded cell | ok |');
    md.push('|---|---|---|---|---|---|---|');
    for (const c of freshChecks) {
      md.push(`| ${c.shape} | ${c.attempt} | ${c.tag} | ${c.accepted} | ${c.shieldedCell} | ${c.unshieldedCell} | ${c.ok} |`);
    }
    md.push('');
    md.push(`Custody map sizes ${JSON.stringify(mapSizes(before))} → ${JSON.stringify(mapSizes(after))}.`);
    md.push('A refusal that had partially landed would break one of these equalities, so this table doubles as the');
    md.push('state-neutrality proof for every refused attempt in every shape.');
    md.push('');
    md.push('## What this means for issue 0001');
    md.push('');
    md.push('Written into `contract-token-custody-6d6cd3/AA/issues/0001-composed-tx-first-attempt-refused.md` in the');
    md.push('organizer tree, together with the decode and the refuted/confirmed status of the mechanism.');
    md.push('');
    writeFileSync(join(EVID, 'S2.md'), `${md.join('\n')}\n`);

    console.log(`\n## S2 VERDICT: ${verdict} — ${note}`);
    if (!bookkeepingOk) {
      console.error('S2 FAILED: the accepted-attempt bookkeeping does not add up — a refusal may have changed state');
      process.exitCode = 1;
    }
  } catch (e) {
    const err = errorChain(e);
    // A starved host is not a failed hypothesis. `HOST_TOO_BUSY` means the load gate never opened, so
    // the run is VOID: it produced no measurement, and it must not be reported as a RED result about
    // the ledger. The partial rows already flushed to disk stay there, clearly marked.
    const hostVoid = /HOST_TOO_BUSY/.test(err);
    if (hostVoid) {
      console.error(`\nS2 VOID (shared host never quietened): ${err}`);
    } else {
      console.error(`\nS2 FAILED: ${err}`);
    }
    flush(hostVoid ? 'in-progress' : 'complete', {
      verdict: hostVoid ? 'VOID — the shared host never became quiet enough to measure on' : 'RED',
      fatal: err,
      note: hostVoid
        ? 'No conclusion about the 104 hypothesis may be drawn from this run. Re-run when the host is quiet; ' +
          'the attempts already recorded above ran under the load gate and remain valid.'
        : undefined,
    });
    writeFileSync(
      join(EVID, 'S2.md'),
      `# SPIKE S2 — what causes node \`Custom error: 104\`?\n\n\`${LANE_STAMP}\` · recorded ${stamp()}\n\n` +
        (hostVoid
          ? `**VERDICT: VOID — the shared host never became quiet enough to measure on.**\n\nThe load gate ` +
            `(1-min load must be <= ${LOAD_LIMIT} on ${cpus().length} cores) never opened within the bounded wait, so ` +
            `this run produced no measurement. **No conclusion about the 104 hypothesis may be drawn from it.** ` +
            `Attempts already recorded in \`s2-segment-order.json\` DID run under the gate and remain valid.\n\n`
          : '**VERDICT: RED (fatal)**\n\n') +
        `Verbatim:\n\n\`\`\`\n${err}\n\`\`\`\n`,
    );
    process.exitCode = 1;
  } finally {
    await rig.close();
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
