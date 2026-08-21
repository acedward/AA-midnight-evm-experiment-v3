// The G5 VARIANT REGISTRY — one place that knows what each mitigation fixture is and how to read it.
// 00006 Plan 05 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// WHY A REGISTRY AND NOT SIX COPIES OF THE RIG. The shipped harness is hard-wired to ONE contract in
// three places, and each of them would otherwise need a per-arm fork:
//
//   1. `src/contracts.ts::compiledManager()` static-imports `generated-zk/manager/...`;
//   2. `src/manager-view.ts` static-imports that same artifact's `ledger()` and `pureCircuits`;
//   3. `src/g1/spike-rig.ts` deploys `compiledManager()` with `zkDir('manager')` and asserts v4's
//      THREE-map emptiness after registration.
//
// The arms differ in exactly the things those three places assume: which ledger fields exist, how a
// custody cell is addressed, and (for arm e) how many circuits an offer takes. So the registry carries,
// per variant, everything a caller needs to treat it generically: the artifact directory, a loader that
// wraps it as a `CompiledContract`, a reader that counts pools and cells whatever the layout, and the
// recorded list of RELAXATIONS the fixture takes relative to the shipped Manager v4.
//
// The loader is `diag-deploy-cost.ts::loadArbitrary` promoted from a diagnostic to harness code — that
// function already proved the pattern works when F-307's deploy budget had to be bracketed against four
// throwaway probe contracts.
//
// NOTHING HERE TOUCHES THE SHIPPED CONTRACT. `manager` is in the registry as the BASELINE so the same
// code path measures it, and its entry points at the same `generated-zk/manager` artifacts G1-G4 used.
import { join } from 'node:path';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { REPO_ROOT } from '../lane.js';

/** How a variant lays out its custody state — decides how the reader counts cells. */
export type Layout =
  /** v4's: `pools: colour -> coin` + `shieldedBalances: hash(acct,colour) -> amount`. */
  | 'flat'
  /** arm b/c: `pools` unchanged, `shieldedBalances: acct -> (colour -> amount)`. */
  | 'nested-balances'
  /** arm d: `pools: acct -> (colour -> coin)`, no `shieldedBalances` at all. */
  | 'unified-coins';

/** How many circuits an OFFER takes on this variant. */
export type OfferProtocol =
  /** ONE circuit, `openSwapShielded(colourA, valA, recipientA, coinB, creditAccount)`. */
  | 'single'
  /** THREE circuits: `stageOffer(colour, value)` -> `openSwap(recipientA, coinB)` -> `consolidate()`. */
  | 'staged';

export type VariantSpec = {
  /** Registry id, also the `generated{,-zk}/<id>` artifact directory name. */
  id: string;
  /** Which issue-0004 arm this is: `baseline` (shipped v4), `control` (v4-slim), or `a`..`e`. */
  arm: 'baseline' | 'control' | 'a' | 'b' | 'c' | 'd' | 'e';
  title: string;
  /** One line on what the arm does differently. */
  thesis: string;
  layout: Layout;
  offer: OfferProtocol;
  /** Source file, relative to the repo root. `undefined` for the shipped Manager. */
  source: string;
  /**
   * Relaxations relative to the shipped Manager v4, recorded per Plan 05's binding constraint
   * ("variants NEED NOT preserve v3 compatibility ... but every relaxation is recorded per variant").
   */
  relaxations: string[];
};

export const VARIANTS: VariantSpec[] = [
  {
    id: 'manager',
    arm: 'baseline',
    title: 'Manager v4 (SHIPPED, unchanged)',
    thesis:
      'the F-310 anchor. Present in the matrix so the arms are compared against a re-measurement of ' +
      'the boundary rather than against a quoted number.',
    layout: 'flat',
    offer: 'single',
    source: 'contracts/manager.compact',
    relaxations: [],
  },
  {
    id: 'v4-slim',
    arm: 'control',
    title: 'v4-slim — v4 minus the unshielded family',
    thesis:
      'the arms TRUE baseline. Four of the five redesign arms needed room beyond v4\'s circuit budget, ' +
      'so every measurement fixture used the same slim control and the price of R1 is isolated before ' +
      'any arm effect is attributed. Arm (a) itself does not require R1.',
    layout: 'flat',
    offer: 'single',
    source: 'contracts/variants/v4-slim.compact',
    relaxations: [
      'R1: the unshielded family is deleted (ledger field `unshieldedBalances`, key domain ' +
        '`unshieldedKey`, circuits `depositUnshielded` / `withdrawUnshielded` / ' +
        '`transferInternalUnshielded` / `unshieldedAccountBalance`). Breaks v3 raw-state layout ' +
        'compatibility and makes FR-203 family separation and the P-COLL probe inapplicable.',
    ],
  },
  {
    id: 'arm-a-dedupe',
    arm: 'a',
    title: 'arm (a) dedupe-flat',
    thesis:
      'issue 0004 mitigation 1: read every ledger entry ONCE into a local. The deduplication itself is ' +
      'semantics-preserving and is the only arm adoptable without a Manager redesign; this measurement ' +
      'fixture inherits R1 only to share the other arms\' control.',
    layout: 'flat',
    offer: 'single',
    source: 'contracts/variants/arm-a-dedupe.compact',
    relaxations: [
      'R1 is inherited by this measurement fixture solely for the common v4-slim control. Arm (a) ' +
        'adds no relaxation and its deduplication can be applied to the shipped v4 without deleting ' +
        'the unshielded family.',
    ],
  },
  {
    id: 'arm-b-nested',
    arm: 'b',
    title: 'arm (b) nested-balances',
    thesis:
      'issue 0004 mitigation 1b (owner-proposed): `shieldedBalances: acct -> (colour -> amount)`. ' +
      'Trades one map traversal for the composite-key `persistentHash`.',
    layout: 'nested-balances',
    offer: 'single',
    source: 'contracts/variants/arm-b-nested.compact',
    relaxations: [
      'R1 (inherited).',
      'R2: the `shieldedBalances` map layout changes. Breaks (i) v3/v4 raw-state decoders, ' +
        '(ii) the `shieldedKey` pure-circuit key-reproduction tooling that makes 00005 "zero ' +
        'unaccounted keys" assertion an enumeration of real state, and (iii) the domain-separator ' +
        'half of FR-203 family separation.',
    ],
  },
  {
    id: 'arm-c-both',
    arm: 'c',
    title: 'arm (c) nested + deduped',
    thesis:
      'arms (a) and (b) together — and the arm that measures how much of (a) SURVIVES nesting, given ' +
      'F-314 (an ADT-typed intermediate cannot be bound to a local at these pins).',
    layout: 'nested-balances',
    offer: 'single',
    source: 'contracts/variants/arm-c-both.compact',
    relaxations: ['R1 (inherited).', 'R2 (from arm b).'],
  },
  {
    id: 'arm-d-unified',
    arm: 'd',
    title: 'arm (d) unified per-account coin map',
    thesis:
      'issue 0004 mitigation 1c (owner-proposed): `pools[account][colour] = coin`, `shieldedBalances` ' +
      'DELETED. The offer touches ONE ledger field, and "a rich pool never rescues a poor account" ' +
      'becomes structural instead of guard-ordered.',
    layout: 'unified-coins',
    offer: 'single',
    source: 'contracts/variants/arm-d-unified.compact',
    relaxations: [
      'R1 (inherited).',
      "R2': BOTH custody fields change — `shieldedBalances` deleted, `pools` re-keyed to " +
        'account -> colour -> coin. Every v3/v4 decoder breaks and FR-205 conservation becomes ' +
        'vacuous as written (the two sides are the same number), so it is restated as ' +
        'credited-minus-debited.',
      "R3': `poolValue` / `poolHasColour` removed (no per-colour pool exists), replaced by " +
        '`accountHasColour`. The v3/v4 reader API is not preserved.',
      "R4': `transferInternalShielded` stops being free — it becomes a real zswap split and merge. " +
        'Measured as this arm price rather than excluded.',
    ],
  },
  {
    id: 'arm-e-escrow',
    arm: 'e',
    title: 'arm (e) two-phase escrow Cell',
    thesis:
      'issue 0004 mitigation 1d in its stronger form: the OFFER circuit reads escrow CELLS and no map, ' +
      'so custody growth adds no custody-map reads. One authorization Set read remains; in retained ' +
      'run-5 evidence the offer stays GUARANTEED through 16 cells with no boundary found. The only arm ' +
      'whose payoff could be SIZE-INDEPENDENT rather than merely larger.',
    layout: 'flat',
    offer: 'staged',
    source: 'contracts/variants/arm-e-escrow.compact',
    relaxations: [
      'R1 (inherited).',
      "R3'': the escrow is a SINGLE GLOBAL SLOT — one staged offer per Manager at a time. Keying it " +
        'by account restores a map traversal, so this measures the BEST CASE and is quoted as an ' +
        'upper bound on what the approach can buy.',
      "R4'': the give amount is fixed at staging time (`openSwap` gives the whole staged coin).",
      "R5'': no `cancelStage` circuit — a staged coin can only leave through `openSwap`. A real gap " +
        'for any product, not a design position.',
      "R6'': the received colour attribution is DELAYED to `consolidate`, so FR-205 conservation " +
        'holds only BETWEEN phases and must be restated as ' +
        '`pool + escrowed + received == cells + staged`.',
    ],
  },
];

export const variantById = (id: string): VariantSpec => {
  const v = VARIANTS.find((x) => x.id === id);
  if (!v) throw new Error(`unknown G5 variant '${id}'; known: ${VARIANTS.map((x) => x.id).join(', ')}`);
  return v;
};

/** Every arm except the shipped baseline and the control. */
export const ARMS = VARIANTS.filter((v) => v.arm !== 'baseline' && v.arm !== 'control');

export const zkDirOf = (v: VariantSpec): string => join(REPO_ROOT, 'harness', 'generated-zk', v.id);

/**
 * Import a variant's compiled module. `kind` selects the fast (`generated`, ZKIR only — what the
 * simulator and the offline placement model use) or the full (`generated-zk`, with prover/verifier
 * keys — what deploy costing and a live deploy need) build.
 */
export const importVariant = async (v: VariantSpec, kind: 'generated' | 'generated-zk'): Promise<any> =>
  await import(`../../${kind}/${v.id}/contract/index.js`);

/**
 * Wrap a variant as a midnight-js `CompiledContract`.
 *
 * The `make` tag is per-variant so two variants can never share a proof-key resolution entry, and the
 * witness set is v3's single `localOwnerSecret` for every arm (no arm changes the witness interface —
 * that is deliberate: an arm that also changed authorization would confound the measurement).
 */
export const compiledVariant = (v: VariantSpec, mod: any) => () =>
  (CompiledContract.make as any)(`aa00006-g5-${v.id}`, mod.Contract).pipe(
    (CompiledContract as any).withWitnesses({
      localOwnerSecret: (ctx: any): [any, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
    }),
    (CompiledContract as any).withCompiledFileAssets(zkDirOf(v)),
  );

// --- generic custody reading ------------------------------------------------------------------
//
// One function per QUESTION, branching on layout, rather than one reader per variant: the matrix asks
// exactly two things of every arm ("how many pools?" and "how many cells?") and a per-variant reader
// would let two arms answer the same question differently by accident.

export type CustodySize = {
  pools: number;
  cells: number;
  /**
   * TRUE when the cell count is EXACT (the map enumerates itself) and FALSE when it is only "the cells
   * belonging to accounts this contract has registered" — see finding F-315 below. Carried into the
   * evidence rather than dropped, because the difference is the difference between an enumeration of
   * real state and a lookup of the keys we happened to think of.
   */
  cellsExact: boolean;
};

/**
 * How much custody state a variant's decoded ledger holds, in the units F-310's table uses.
 *
 * FINDING F-315, discovered here and load-bearing for arms b, c and d: **the OUTER level of a nested
 * ledger `Map` exposes no `[Symbol.iterator]` in the generated TypeScript API.** The inner map does
 * (`generated/arm-b-nested/contract/index.d.ts:190-201`, `arm-d-unified/...:172-186`), the outer one
 * offers only `isEmpty`, `size`, `member` and `lookup`. So an off-chain reader CANNOT DISCOVER the
 * outer keys; it can only ask about keys it already holds.
 *
 * The workaround used here is sound but weaker, and the weakness is the point: enumeration goes through
 * the `accounts` Set, which IS iterable, so "how many cells" becomes "how many cells belong to
 * REGISTERED ACCOUNTS". For these fixtures that is complete, because every write path asserts the
 * account is registered before creating anything. But it is no longer an ENUMERATION OF REAL STATE the
 * way 00005's flat-map assertion was: a cell written under an unregistered or malformed outer key would
 * be invisible. That is exactly the tooling loss recorded as relaxation R2(ii) / R2', now measured
 * rather than predicted.
 */
export const custodySize = (v: VariantSpec, l: any): CustodySize => {
  if (v.layout === 'unified-coins') {
    // `pools: acct -> (colour -> coin)`. POOLS is the number of distinct colours held anywhere (the
    // v4 sense of the word), CELLS is the number of (account, colour) coins — which in this layout is
    // the same object. Counting both keeps the arm comparable to v4's table.
    let cells = 0;
    const colours = new Set<string>();
    for (const acct of l.accounts as Iterable<Uint8Array>) {
      if (!l.pools.member(acct)) continue;
      for (const [col] of l.pools.lookup(acct) as Iterable<[Uint8Array, any]>) {
        cells++;
        colours.add(Buffer.from(col).toString('hex'));
      }
    }
    return { pools: colours.size, cells, cellsExact: false };
  }
  const pools = Number(l.pools.size());
  if (v.layout === 'nested-balances') {
    let cells = 0;
    for (const acct of l.accounts as Iterable<Uint8Array>) {
      if (!l.shieldedBalances.member(acct)) continue;
      cells += Number(l.shieldedBalances.lookup(acct).size());
    }
    return { pools, cells, cellsExact: false };
  }
  return { pools, cells: Number(l.shieldedBalances.size()), cellsExact: true };
};

/** The value attributed to (account, colour), whatever the layout. Absence reads 0, as in v4. */
export const cellValue = (v: VariantSpec, l: any, pure: any, acct: Uint8Array, colour: Uint8Array): bigint => {
  if (v.layout === 'unified-coins') {
    if (!l.pools.member(acct)) return 0n;
    const inner = l.pools.lookup(acct);
    return inner.member(colour) ? BigInt(inner.lookup(colour).value) : 0n;
  }
  if (v.layout === 'nested-balances') {
    if (!l.shieldedBalances.member(acct)) return 0n;
    const inner = l.shieldedBalances.lookup(acct);
    return inner.member(colour) ? BigInt(inner.lookup(colour)) : 0n;
  }
  const k = pure.shieldedKey(acct, colour);
  return l.shieldedBalances.member(k) ? BigInt(l.shieldedBalances.lookup(k)) : 0n;
};

/** Total value this contract holds of `colour`, summed however the layout stores it (F-315 applies). */
export const colourTotal = (v: VariantSpec, l: any, colour: Uint8Array): bigint => {
  if (v.layout === 'unified-coins') {
    let total = 0n;
    for (const acct of l.accounts as Iterable<Uint8Array>) {
      if (!l.pools.member(acct)) continue;
      const inner = l.pools.lookup(acct);
      if (inner.member(colour)) total += BigInt(inner.lookup(colour).value);
    }
    return total;
  }
  return l.pools.member(colour) ? BigInt(l.pools.lookup(colour).value) : 0n;
};

/** Sum of the attributed cells for `colour`, over every registered account (F-315 applies). */
export const cellTotal = (v: VariantSpec, l: any, pure: any, colour: Uint8Array): bigint => {
  let total = 0n;
  for (const acct of l.accounts as Iterable<Uint8Array>) total += cellValue(v, l, pure, acct, colour);
  return total;
};

/**
 * A byte-comparable snapshot of EVERYTHING a variant holds, map sizes included — the instrument the
 * no-state-created proofs use.
 *
 * It carries SIZES as well as contents, so a refused call that merely CREATED an empty cell or an
 * empty account sub-map is caught even though every value is still zero. That is the failure mode
 * FR-202 exists to rule out, and the nested layouts add a second place it could happen (an outer key
 * inserted with an empty inner map), so the snapshot walks both levels.
 *
 * F-315 applies to the nested layouts: the walk goes through the `accounts` Set, so a cell under an
 * outer key that is not a registered account is INVISIBLE to this snapshot. Recorded rather than
 * hidden — it is the same limitation the cell count has, and it is a cost of those arms.
 */
export const snapshotVariant = (v: VariantSpec, l: any): string => {
  const hex = (u: Uint8Array): string => Buffer.from(u).toString('hex');
  const accounts: string[] = [];
  for (const a of l.accounts as Iterable<Uint8Array>) accounts.push(hex(a));
  accounts.sort();

  const out: Record<string, unknown> = { accounts, accountCount: String(l.accounts.size()) };

  if (v.layout === 'unified-coins') {
    const coins: Record<string, unknown> = {};
    for (const a of accounts) {
      const raw = Buffer.from(a, 'hex');
      if (!l.pools.member(raw)) continue;
      const inner = l.pools.lookup(raw);
      const per: Record<string, unknown> = {};
      for (const [col, c] of inner as Iterable<[Uint8Array, any]>) {
        per[hex(col)] = { nonce: hex(c.nonce), value: String(c.value), mt_index: String(c.mt_index) };
      }
      coins[a] = { size: String(inner.size()), entries: per };
    }
    out.poolsOuterSize = String(l.pools.size());
    out.coins = coins;
  } else {
    const pools: Record<string, unknown> = {};
    for (const [k, c] of l.pools as Iterable<[Uint8Array, any]>) {
      pools[hex(k)] = {
        nonce: hex(c.nonce),
        color: hex(c.color),
        value: String(c.value),
        mt_index: String(c.mt_index),
      };
    }
    out.poolCount = String(l.pools.size());
    out.pools = pools;

    if (v.layout === 'nested-balances') {
      const cells: Record<string, unknown> = {};
      for (const a of accounts) {
        const raw = Buffer.from(a, 'hex');
        if (!l.shieldedBalances.member(raw)) continue;
        const inner = l.shieldedBalances.lookup(raw);
        const per: Record<string, string> = {};
        for (const [col, amt] of inner as Iterable<[Uint8Array, bigint]>) per[hex(col)] = String(amt);
        cells[a] = { size: String(inner.size()), entries: per };
      }
      out.cellsOuterSize = String(l.shieldedBalances.size());
      out.cells = cells;
    } else {
      const cells: Record<string, string> = {};
      for (const [k, amt] of l.shieldedBalances as Iterable<[Uint8Array, bigint]>) cells[hex(k)] = String(amt);
      out.cellCount = String(l.shieldedBalances.size());
      out.cells = cells;
    }
  }

  // Arm (e)'s escrow cells are part of custody state and a refusal must not touch them either.
  if (v.offer === 'staged') {
    out.escrow = {
      active: String(l.escrowActive),
      owner: hex(l.escrowOwner),
      coin: {
        nonce: hex(l.escrowCoin.nonce),
        color: hex(l.escrowCoin.color),
        value: String(l.escrowCoin.value),
        mt_index: String(l.escrowCoin.mt_index),
      },
      receivedActive: String(l.receivedActive),
      receivedOwner: hex(l.receivedOwner),
      receivedCoin: {
        nonce: hex(l.receivedCoin.nonce),
        color: hex(l.receivedCoin.color),
        value: String(l.receivedCoin.value),
        mt_index: String(l.receivedCoin.mt_index),
      },
    };
  }

  return JSON.stringify(out);
};
