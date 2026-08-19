// G3 — the spec's 18-row step ledger (steps 0 through 17), the five negative controls and both
// probes, in ONE scripted process. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// After every step the harness reads every observation point and asserts, against the spec's
// NORMATIVE transcription in `expected.ts`:
//
//   * the FULL table over every colour that exists at that row x four parties;
//   * every shielded pool value and every unshielded contract-ledger balance;
//   * the EXACT size of all three custody maps — the lazy-creation bookkeeping;
//   * ZERO UNACCOUNTED KEYS, dynamically: every key in the Manager's raw maps must be reproducible
//     from (AA account x registered colour) by the contract's OWN pure key circuits, so an extra
//     colour or an extra cell is a hard failure;
//   * the per-colour invariant `custody[c] == AA_A[c] + AA_B[c]`, over the DISCOVERED colour set;
//   * the ledger conservation identity per colour;
//   * the dormant colour U3, absent from every map;
//
// and halts on the first divergence. Per-step evidence lands in `evidence/g3-ledger/step-N/`; every
// row, control and probe records itself into `evidence/g3-ledger/cells.json`, from which `CELLS.md`
// is rendered.
//
// The step table, the amounts, the final table and the end-state map sizes are NORMATIVE in the
// specification — `expected.ts` is a transcription of them and must not be "fixed" to match an
// observation.
//
// F-104 discipline: no balance in this run is ever read from a wallet that submitted a transaction.
// User cells come from read-only OBSERVER wallets, cross-checked against the indexer (unshielded)
// and against ledger conservation (shielded); every user-submitted transaction is built by a FRESH
// spender wallet that is closed immediately afterwards. See `setup.ts`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, resultOf, type Rig, type Spender } from './setup.js';
import { metricsReport } from './metrics.js';
import { withDustRetry } from '../night.js';
import { existenceAtBlock } from './chain.js';
import {
  accountWithdrawShielded,
  accountWithdrawUnshielded,
  mintShieldedToUser,
  mintUnshieldedToUser,
  transferInternalShielded,
  userDepositShielded,
  userDepositUnshielded,
} from './actions.js';
import {
  assertAll,
  emptyRow,
  observe,
  renderCustody,
  renderMarkdownTable,
  renderSizes,
  renderTable,
  snapshotObject,
  waitForTable,
  withIndexerCheck,
  type Custody,
  type ExpectedState,
  type Observation,
  type Table,
} from './table.js';
import { snapshot as managerSnapshot } from '../manager-view.js';
import { AA_PARTIES, PARTIES, type ColourInfo, type PartyName } from './observe.js';
import { runControls, type ControlResult } from './controls.js';
import { runProbes, type ProbeHarness, type ProbeResults, type Requirement } from './probes.js';
import { makeCellSink, type CellRecord } from './cells.js';
// The spec's step table lives in ONE place — `expected.ts` — because it is the only thing in this
// harness copied from a document rather than derived, and the offline suite checks that
// transcription against itself (and against the spec's separately written final table and
// end-state map sizes) before any stack is booted.
import { ACTIONS, DORMANT, END_SIZES, EXPECTED, FINAL_TABLE, LAST_STEP, MINTS } from './expected.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}` : v);

/** Running totals the Minters have issued of each colour, by harness name. */
const minted: Custody = {};

const cells: CellRecord[] = [];
const cell = makeCellSink(cells);

/** The spec's transcription for row `n`, in the generic shape `assertAll` consumes. */
const expectedOf = (n: number): ExpectedState => {
  const e = EXPECTED[n]!;
  const colours = [...e.colours] as string[];
  const table = {} as Table;
  for (const p of PARTIES) {
    table[p] = emptyRow(colours);
    for (const c of colours) table[p][c] = e.table[p as keyof typeof e.table][c as keyof typeof e.custody];
  }
  const custody: Custody = {};
  for (const c of colours) custody[c] = e.custody[c as keyof typeof e.custody];
  return { colours, table, custody, sizes: { ...e.sizes } };
};

// ---------------------------------------------------------------------------------------------
// The rotating on-chain spot check: one real balance circuit call per step, cycling through every
// (AA account, colour) cell that exists, so each is confirmed at least once by a mechanism entirely
// independent of the state decode (FR-208).
// ---------------------------------------------------------------------------------------------
const spotCheck = async (rig: Rig, step: number, o: Observation): Promise<Observation> => {
  const pairs: Array<[PartyName, ColourInfo | null]> = [];
  for (const p of AA_PARTIES) for (const c of rig.registry.list()) pairs.push([p, c]);
  await rig.ctx.actAs(rig.ctx.managerFee, new Uint8Array(32));

  if (pairs.length === 0) {
    // Row 0: no colour exists anywhere. The discriminating on-chain read is therefore a balance for
    // a colour the Manager has never been told about — it must answer 0, and must create nothing.
    const unknownColour = new Uint8Array(32);
    const r: any = await withDustRetry(rig.fee, 'shieldedAccountBalance(AA_A, <no colour exists>)', () =>
      rig.managerDeployed.callTx.shieldedAccountBalance(rig.raw.AA_A, unknownColour),
    );
    const onChain = resultOf<bigint>(r);
    const txish = String(r?.public?.txId ?? r?.public?.txHash ?? '');
    log(`  spot check: on-chain shieldedAccountBalance(AA_A, <a colour that does not exist>) = ${onChain} (tx ${txish})`);
    return {
      ...o,
      spotCheck: {
        account: 'AA_A',
        colour: '<a colour that does not exist>',
        circuit: 'shieldedAccountBalance',
        onChain,
        ledgerState: 0n,
        txish,
      },
    };
  }

  const [account, colour] = pairs[step % pairs.length]!;
  const id = rig.raw[account as 'AA_A' | 'AA_B'];
  const circuit = colour!.family === 'shielded' ? 'shieldedAccountBalance' : 'unshieldedAccountBalance';
  const r: any = await withDustRetry(rig.fee, `${circuit}(${account}, ${colour!.name})`, () =>
    (rig.managerDeployed.callTx as any)[circuit](id, colour!.raw),
  );
  const onChain = resultOf<bigint>(r);
  const txish = String(r?.public?.txId ?? r?.public?.txHash ?? '');
  log(`  spot check: on-chain ${circuit}(${account}, ${colour!.name}) = ${onChain} (tx ${txish})`);
  return {
    ...o,
    spotCheck: {
      account,
      colour: colour!.name,
      circuit,
      onChain,
      ledgerState: o.table[account][colour!.name] ?? 0n,
      txish,
    },
  };
};

// ---------------------------------------------------------------------------------------------
// Per-step evidence
// ---------------------------------------------------------------------------------------------
type Operation = { label: string; txs: string[]; level: string; detail?: unknown };

class StepEvidence {
  private ops: Operation[] = [];
  constructor(
    readonly n: number | string,
    readonly action: string,
  ) {}

  op(label: string, txs: string[], level: string, detail?: unknown): void {
    this.ops.push({
      label,
      txs,
      level,
      detail: detail === undefined ? undefined : JSON.parse(JSON.stringify(detail, bigints)),
    });
  }

  write(expected: ExpectedState, observed: Observation): void {
    const dir = join(EVID, `step-${this.n}`);
    mkdirSync(dir, { recursive: true });
    const cols = expected.colours;

    const flat = (t: Table) => {
      const out: Record<string, Record<string, string>> = {};
      for (const p of PARTIES) {
        out[p] = {};
        for (const c of cols) out[p][c] = String(t[p][c] ?? 0n);
      }
      return out;
    };

    writeFileSync(
      join(dir, 'step.json'),
      `${JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          step: this.n,
          action: this.action,
          utc: stamp(),
          colourSet: cols,
          expected: {
            table: flat(expected.table),
            custody: Object.fromEntries(cols.map((c) => [c, String(expected.custody[c] ?? 0n)])),
            mapSizes: expected.sizes,
          },
          observed: snapshotObject(observed),
          observedMapSizes: observed.sizes,
          unaccountedKeys: observed.unaccounted,
          observationPoints: {
            AA_cells:
              "the Manager's shieldedBalances / unshieldedBalances maps decoded from contract state, every key " +
              "derived by RUNNING the contract's own pure shieldedKey/unshieldedKey circuits",
            AA_cells_second:
              'the per-colour custody side — pooled zswap coin (shielded) / ledger-kernel unshielded balance — ' +
              'via the invariant custody[c] == AA_A[c] + AA_B[c]',
            AA_cells_third: observed.spotCheck
              ? `on-chain ${observed.spotCheck.circuit}(${observed.spotCheck.account}, ${observed.spotCheck.colour}) = ${observed.spotCheck.onChain}`
              : '(no spot check this step)',
            user_cells: 'read-only OBSERVER wallet facades (never submitters — finding F-104)',
            user_cells_second_unshielded: 'UTXO set reconstructed from the indexer transaction history, per colour',
            user_cells_second_shielded:
              'ledger conservation identity minted[c] == custody[c] + OwnerN[c] + OwnerM[c]',
          },
          indexerUnshielded: observed.indexerUnshielded,
          spotCheck: observed.spotCheck,
          mintedTotals: minted,
          perColourInvariant: Object.fromEntries(
            cols.map((c) => [c, `${observed.custody[c] ?? 0n} == ${observed.table.AA_A[c] ?? 0n} + ${observed.table.AA_B[c] ?? 0n}`]),
          ),
          operations: this.ops,
        },
        bigints,
        2,
      )}\n`,
    );

    const lines = [
      `# Step ${this.n} — ${this.action}`,
      '',
      '**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`',
      '',
      `Colour set at this row (${cols.length}): ${cols.length ? cols.map((c) => `\`${c}\``).join(', ') : '**none — no Minter exists yet**'}`,
      '',
      "## Observed table (asserted equal to the spec's expected state)",
      '',
      ...(cols.length
        ? renderMarkdownTable(observed.table, observed.custody, cols)
        : ['_(no colour exists at this row; the Manager holds nothing and knows nothing)_']),
      '',
      `Exact map sizes: **${renderSizes(observed.sizes)}** (expected ${renderSizes(expected.sizes)}).`,
      '',
      `Zero unaccounted keys: pools ${observed.unaccounted.pools.length}, shielded cells ` +
        `${observed.unaccounted.shieldedCells.length}, unshielded cells ${observed.unaccounted.unshieldedCells.length}.`,
      '',
      `Per-colour invariant: ${cols.map((c) => `${c}: ${observed.custody[c] ?? 0n} == ${observed.table.AA_A[c] ?? 0n}+${observed.table.AA_B[c] ?? 0n}`).join('; ') || '(no colours)'}`,
      '',
      `Conservation: ${cols.map((c) => `${c}: minted ${minted[c] ?? 0n} == ${observed.custody[c] ?? 0n}+${observed.table.OwnerN[c] ?? 0n}+${observed.table.OwnerM[c] ?? 0n}`).join('; ') || '(no colours)'}`,
      '',
      observed.indexerUnshielded
        ? `Indexer reconstruction (independent of every wallet): ${(['OwnerN', 'OwnerM'] as const)
            .map((p) => `${p} ${Object.entries(observed.indexerUnshielded![p]).map(([k, v]) => `${k}=${v}`).join(' ') || '—'}`)
            .join(', ')}.`
        : 'No indexer reconstruction this step.',
      '',
      observed.spotCheck
        ? `On-chain spot check: \`${observed.spotCheck.circuit}(${observed.spotCheck.account}, ${observed.spotCheck.colour})\` = ${observed.spotCheck.onChain} (ledger state says ${observed.spotCheck.ledgerState}).`
        : 'No on-chain spot check this step.',
      '',
      '## Operations',
      '',
      ...(this.ops.length
        ? this.ops.map((o) => `- **${o.label}** (${o.level}) — tx ${o.txs.map((x) => `\`${x}\``).join(', ') || '—'}`)
        : ['- (none — this row asserts a state, not an operation)']),
      '',
    ];
    writeFileSync(join(dir, 'summary.md'), `${lines.join('\n')}\n`);
    log(`  evidence -> evidence/g3-ledger/step-${this.n}/`);
  }
}

// ---------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------
const main = async () => {
  console.log(
    `# G3 OPEN-COLOUR STEP LEDGER — steps 0-17 + NC-1..5 + P-COLL + M3 — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`,
  );
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;
  let controls: ControlResult[] = [];
  let probes: ProbeResults | undefined;

  try {
    rig = await bootstrap();
    const { ctx, deps, raw, registry } = rig;

    /**
     * Every submitted transaction is logged here, because observation point 2 for user unshielded
     * holdings is a replay of exactly these through the indexer. A transaction that moved value but
     * was never logged would silently weaken that check, so the recording happens at the single
     * place each id is first seen.
     */
    const seenTxs = new Set<string>();
    const tx = <T extends string>(id: T): T => {
      // De-duplicated: the replay costs one indexer query per identifier, and an id recorded twice
      // would pay for the same answer twice without strengthening anything.
      if (id && !seenTxs.has(id)) {
        seenTxs.add(id);
        deps.submittedTxs.push(id);
      }
      return id;
    };
    for (const id of Object.values(rig.deployTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);
    for (const id of Object.values(rig.fundingTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);

    /** Run one user-submitted operation on a FRESH spender wallet, then close it (F-104). */
    const withSpender = async <T>(
      who: 'OwnerN' | 'OwnerM',
      tag: string,
      fn: (s: Spender) => Promise<T>,
      require?: Requirement[],
    ): Promise<T> => {
      const s = await rig!.openSpender(who, tag, require);
      try {
        return await fn(s);
      } finally {
        await s.close();
      }
    };

    /**
     * Wait for the step's expected state, add the rotating on-chain spot check and the indexer
     * reconstruction, then assert everything. Writing the evidence is deliberately NOT part of this:
     * a step with post-hoc detail to record (step 12 compares custody across the operation) adds its
     * operations first and calls `finish` once.
     */
    const settle = async (n: number): Promise<Observation> => {
      const expected = expectedOf(n);
      let o = await waitForTable(deps, expected, String(n));
      o = await spotCheck(rig!, n, o);
      o = await withIndexerCheck(deps, o);
      if (o.spotCheck?.txish) tx(o.spotCheck.txish);
      assertAll(o, expected, String(n), minted, deps, [DORMANT]);
      return o;
    };

    const finish = (n: number, e: StepEvidence, o: Observation): Observation => {
      const expected = expectedOf(n);
      e.write(expected, o);
      console.log(
        `STEP ${n} ASSERTED — ${renderTable(o.table, expected.colours)}  ` +
          `${renderCustody(o.custody, expected.colours, rig!.registry)}  ${renderSizes(o.sizes)}`,
      );
      return o;
    };

    const settleAndAssert = async (n: number, e: StepEvidence): Promise<Observation> => finish(n, e, await settle(n));

    // =========================================================================================
    // STEP 0 — the Manager exists; NOTHING that can mint a colour does
    // =========================================================================================
    console.log(`\n## STEP 0 — ${ACTIONS[0]}`);
    const e0 = new StepEvidence(0, ACTIONS[0]!);
    e0.op('deploy the Manager FIRST, then register AA_A and AA_B', [rig.deployTxs.Manager!], 'SDK', {
      chainTipBeforeAnyDeploy: rig.chainTipBeforeAnyDeploy,
      managerAddress: rig.managerAddress,
      managerDeploy: rig.managerDeploy,
      accounts: rig.ids,
      fundingTxs: rig.fundingTxs,
      claim:
        'the Manager was deployed before ANY minting contract of this demonstration existed, and registering ' +
        'both accounts created NO custody state at all',
    });
    let o = await settleAndAssert(0, e0);
    const step0ManagerState = managerSnapshot(o.manager);
    if (o.manager.accounts.length !== 2) throw new Error(`step 0: ${o.manager.accounts.length} accounts, expected 2`);
    cell({
      id: 'step-0',
      label: 'Step 0 — Manager deployed, NO Minter exists; AA_A and AA_B registered; all maps size 0',
      step: 0,
      txs: [rig.deployTxs.Manager!],
      level: 'SDK',
      points:
        'decoded Manager ledger state (accounts 2, pools 0, shielded cells 0, unshielded cells 0) + an on-chain ' +
        'balance call for a colour that does not exist, which answered 0 and created nothing',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0/step.json',
      note: `Manager deployed in block ${rig.managerDeploy.blockHeight}; chain tip before any deploy was block ${rig.chainTipBeforeAnyDeploy.height}.`,
    });

    // =========================================================================================
    // STEP 1 — only NOW do the Minters exist. The Manager must not move a byte.
    // =========================================================================================
    console.log(`\n## STEP 1 — ${ACTIONS[1]}`);
    const e1 = new StepEvidence(1, ACTIONS[1]!);
    for (const [label, tagText, s, u] of [
      ['Minter1', 'TOKA', 'S1', 'U1'],
      ['Minter2', 'TOKB', 'S2', 'U2'],
      ['Minter3', 'TOKC', 'S3', 'U3'],
    ] as const) {
      await rig.deployMinter({ label, tagText, kind: 'minter', shieldedName: s, unshieldedName: u });
    }
    for (const id of Object.values(rig.deployTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);

    // The deploy-order proof, from the chain's own index, inside THIS run (spec success criterion 2).
    const H = rig.managerDeploy.blockHeight!;
    const orderRows: Array<Record<string, unknown>> = [];
    for (const m of rig.minters) {
      const e = await existenceAtBlock(m.address, H);
      const row = {
        contract: m.label,
        address: m.address,
        deployBlock: m.deploy.blockHeight,
        managerBlock: H,
        strictlyLater: (m.deploy.blockHeight ?? -1) > H,
        absentAtManagerBlock: e.action === null,
        absentAtManagerBlockAtOrBefore: e.contractQueryError === null ? e.contract === null : null,
        contractQueryError: e.contractQueryError,
      };
      orderRows.push(row);
      log(
        `  ${m.label.padEnd(14)} deploy block ${String(m.deploy.blockHeight).padStart(4)} > Manager ${H}: ` +
          `${row.strictlyLater ? 'YES' : 'NO'}; existed at block ${H}: ${row.absentAtManagerBlock ? 'no' : 'YES'}`,
      );
      if (!row.strictlyLater) throw new Error(`${m.label} was NOT deployed strictly after the Manager`);
      if (!row.absentAtManagerBlock) throw new Error(`${m.label} ALREADY EXISTED at the Manager's deploy block ${H}`);
    }
    const managerSelf = await existenceAtBlock(rig.managerAddress, H);
    if (managerSelf.action === null) {
      throw new Error('the existence query returned null for the MANAGER at its own deploy block — not discriminating');
    }

    // 6 colours, pairwise distinct (15 comparisons), all from on-chain circuit reads.
    const six = registry.list();
    let sixComparisons = 0;
    let sixDistinct = 0;
    for (let i = 0; i < six.length; i++) {
      for (let k = i + 1; k < six.length; k++) {
        sixComparisons++;
        if (six[i]!.hex !== six[k]!.hex) sixDistinct++;
      }
    }
    if (six.length !== 6 || sixComparisons !== 15 || sixDistinct !== 15) {
      throw new Error(`step 1: expected 6 colours and 15/15 distinct, got ${six.length} and ${sixDistinct}/${sixComparisons}`);
    }
    e1.op('deploy Minter1 (TOKA), Minter2 (TOKB), Minter3 (TOKC)', rig.minters.map((m) => m.deploy.txHash ?? ''), 'SDK', {
      minters: rig.minters,
      deployOrder: orderRows,
      managerPresentAtOwnDeployBlock: managerSelf.action !== null,
      colours: Object.fromEntries(six.map((c) => [c.name, { hex: c.hex, family: c.family, issuer: c.issuer }])),
      distinctness: { comparisons: sixComparisons, distinct: sixDistinct },
    });
    o = await settleAndAssert(1, e1);
    if (managerSnapshot(o.manager) !== step0ManagerState) {
      throw new Error('STEP 1 DIVERGENCE — deploying the Minters changed the Manager state');
    }
    cell({
      id: 'step-1',
      label: 'Step 1 — TOKA/TOKB/TOKC deployed AFTER the Manager; 6 colours distinct; Manager byte-identical',
      step: 1,
      txs: rig.minters.map((m) => m.deploy.txHash ?? ''),
      level: 'SDK',
      points:
        `indexer block ordering (Manager ${H} < ${rig.minters.map((m) => m.deploy.blockHeight).join('/')}) plus a ` +
        `point-in-time existence query answering null for every Minter address at block ${H}, with the Manager ` +
        `itself as the discriminating control; ${sixDistinct}/${sixComparisons} colours distinct from on-chain reads`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-1/step.json',
      note: 'The whole decoded Manager state is byte-identical to step 0 — deploying an issuer touches nothing.',
    });

    // =========================================================================================
    // STEPS 2-6 — the five mints
    // =========================================================================================
    for (const n of [2, 3, 4, 5, 6]) {
      console.log(`\n## STEP ${n} — ${ACTIONS[n]}`);
      const e = new StepEvidence(n, ACTIONS[n]!);
      const ids: string[] = [];
      for (const m of MINTS[n]!) {
        const c = registry.get(m.colour);
        const id =
          c.family === 'shielded'
            ? tx(await mintShieldedToUser(ctx, m.minter, m.amount, rig.observers[m.to], rig.fee))
            : tx(await mintUnshieldedToUser(ctx, m.minter, m.amount, rig.addresses[m.to], rig.fee));
        minted[m.colour] = (minted[m.colour] ?? 0n) + m.amount;
        ids.push(id);
        log(`  ${m.minter} minted ${m.colour} ${m.amount} -> ${m.to}: tx ${id}`);
        e.op(`${m.minter} mints ${m.colour} ${m.amount} -> ${m.to}`, [id], 'SDK', { colour: c.hex, family: c.family });
      }
      o = await settleAndAssert(n, e);
      const m0 = MINTS[n]![0]!;
      cell({
        id: `step-${n}`,
        label: `Step ${n} — ${ACTIONS[n]}`,
        step: n,
        txs: ids,
        level: 'SDK',
        points:
          `${m0.to} observer wallet + ` +
          `${registry.get(m0.colour).family === 'shielded' ? 'ledger conservation' : 'indexer UTXO reconstruction'} ` +
          `for ${m0.colour}; every other cell unchanged; all three custody maps still size 0`,
        status: 'GREEN',
        evidence: `evidence/g3-ledger/step-${n}/step.json`,
      });
    }

    // =========================================================================================
    // STEPS 7-11 — the deposits, with the lazy-creation assertions
    // =========================================================================================
    const deposits: Array<{
      n: number;
      colour: string;
      who: 'OwnerN' | 'OwnerM';
      account: 'AA_A' | 'AA_B';
      amount: bigint;
      note: string;
    }> = [
      { n: 7, colour: 'S1', who: 'OwnerN', account: 'AA_A', amount: 6n, note: 'the FIRST pool this Manager has ever held' },
      { n: 8, colour: 'U1', who: 'OwnerN', account: 'AA_A', amount: 5n, note: 'the first unshielded cell' },
      { n: 9, colour: 'S2', who: 'OwnerM', account: 'AA_B', amount: 6n, note: 'a second pool, created lazily' },
      {
        n: 10,
        colour: 'S3',
        who: 'OwnerM',
        account: 'AA_A',
        amount: 4n,
        note: 'DEPOSITOR != CREDITED OWNER — credit is open, spend is not (FR-204)',
      },
      { n: 11, colour: 'U2', who: 'OwnerM', account: 'AA_B', amount: 5n, note: 'a second unshielded cell' },
    ];
    for (const dep of deposits) {
      console.log(`\n## STEP ${dep.n} — ${ACTIONS[dep.n]}`);
      const e = new StepEvidence(dep.n, ACTIONS[dep.n]!);
      const c = registry.get(dep.colour);
      const shielded = c.family === 'shielded';
      const before = o.sizes;
      const detail = await withSpender(
        dep.who,
        `step${dep.n}`,
        async (s) =>
          shielded
            ? await userDepositShielded(ctx, s.party, s.managerProviders, c.raw, dep.amount, raw[dep.account])
            : { txId: await userDepositUnshielded(ctx, s.party, s.managerProviders, c.raw, dep.amount, raw[dep.account]) },
        [{ colour: c.hex, shielded, amount: dep.amount }],
      );
      const id = tx((detail as any).txId as string);
      log(`  ${dep.who} deposited ${dep.colour} ${dep.amount} -> ${dep.account}: tx ${id}`);
      e.op(`${dep.who} deposits ${dep.colour} ${dep.amount} -> ${dep.account}`, [id], 'SDK', {
        colour: c.hex,
        family: c.family,
        depositCoinNonce: (detail as any).nonce ? Buffer.from((detail as any).nonce).toString('hex') : undefined,
        mapSizesBefore: before,
      });
      o = await settleAndAssert(dep.n, e);
      cell({
        id: `step-${dep.n}`,
        label: `Step ${dep.n} — ${ACTIONS[dep.n]}`,
        step: dep.n,
        txs: [id],
        level: 'SDK',
        points:
          `map sizes ${JSON.stringify(before)} -> ${JSON.stringify(o.sizes)} (lazy creation, exactly as specced); ` +
          `${dep.account} ${dep.colour} 0->${dep.amount} with ` +
          `${shielded ? "that colour's pooled coin" : "the ledger kernel's unshielded balance"} matching`,
        status: 'GREEN',
        evidence: `evidence/g3-ledger/step-${dep.n}/step.json`,
        note: dep.note,
      });
    }

    // =========================================================================================
    // STEP 12 — internal transfer: the CREDIT SIDE creates the (AA_B, S1) cell; no token operation
    // =========================================================================================
    console.log(`\n## STEP 12 — ${ACTIONS[12]}`);
    const e12 = new StepEvidence(12, ACTIONS[12]!);
    const poolsBefore12 = JSON.stringify(o.pools, bigints);
    const custodyBefore12 = JSON.stringify(o.custody, bigints);
    const sizesBefore12 = o.sizes;
    const t12 = tx(await transferInternalShielded(ctx, raw.secretA, raw.AA_B, registry.raw('S1'), 3n, rig.fee));
    log(`  internal transfer S1 3: AA_A -> AA_B: tx ${t12}`);
    o = await settle(12);
    const poolsAfter12 = JSON.stringify(o.pools, bigints);
    const custodyAfter12 = JSON.stringify(o.custody, bigints);
    if (poolsBefore12 !== poolsAfter12 || custodyBefore12 !== custodyAfter12) {
      throw new Error(
        'STEP 12 DIVERGENCE — an internal transfer moved custody, which performs no token operation:\n' +
          `  pools    ${poolsBefore12} -> ${poolsAfter12}\n  custody  ${custodyBefore12} -> ${custodyAfter12}`,
      );
    }
    e12.op('internal transfer S1 3 (owner A) -> AA_B', [t12], 'SDK', {
      poolsBefore: JSON.parse(poolsBefore12),
      poolsAfter: JSON.parse(poolsAfter12),
      custodyBefore: JSON.parse(custodyBefore12),
      custodyAfter: JSON.parse(custodyAfter12),
      byteIdentical: true,
      mapSizesBefore: sizesBefore12,
      mapSizesAfter: o.sizes,
      circuit: 'transferInternalShielded (owner decision D-204: the split is per family)',
    });
    finish(12, e12, o);
    cell({
      id: 'step-12',
      label: `Step 12 — ${ACTIONS[12]}`,
      step: 12,
      txs: [t12],
      level: 'SDK',
      points:
        `shielded cells ${sizesBefore12.shieldedCells}->${o.sizes.shieldedCells}: the (AA_B,S1) cell was created by ` +
        'an INTERNAL TRANSFER, not a deposit; EVERY pooled coin (value AND nonce) and every custody figure ' +
        'byte-identical before/after',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-12/step.json',
      note:
        "The spec's \"credit-side lazy cell / poolS1 UNCHANGED\" row, asserted over the whole custody surface " +
        'rather than one colour. The circuit is `transferInternalShielded` — owner decision D-204.',
    });

    // =========================================================================================
    // STEPS 13-14 — withdrawals back out to users, one per family
    // =========================================================================================
    console.log(`\n## STEP 13 — ${ACTIONS[13]}`);
    const e13 = new StepEvidence(13, ACTIONS[13]!);
    const w13 = tx(await accountWithdrawShielded(ctx, raw.secretB, registry.raw('S2'), 2n, rig.observers.OwnerN, rig.fee));
    log(`  AA_B withdrew S2 2 -> OwnerN: tx ${w13}`);
    e13.op('AA_B withdraws S2 2 -> OwnerN', [w13], 'SDK', { colour: registry.hex('S2') });
    o = await settleAndAssert(13, e13);
    cell({
      id: 'step-13',
      label: `Step 13 — ${ACTIONS[13]}`,
      step: 13,
      txs: [w13],
      level: 'SDK',
      points:
        'Manager cells (AA_B S2 6->4) + poolS2 6->4 (change coin retained); OwnerN observer wallet 0->2 — a user ' +
        'now holds a colour it never minted; every other pool byte-identical; map sizes unchanged',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-13/step.json',
    });

    console.log(`\n## STEP 14 — ${ACTIONS[14]}`);
    const e14 = new StepEvidence(14, ACTIONS[14]!);
    const w14 = tx(await accountWithdrawUnshielded(ctx, raw.secretA, registry.raw('U1'), 2n, rig.addresses.OwnerM, rig.fee));
    log(`  AA_A withdrew U1 2 -> OwnerM: tx ${w14}`);
    e14.op('AA_A withdraws U1 2 -> OwnerM', [w14], 'SDK', { colour: registry.hex('U1') });
    o = await settleAndAssert(14, e14);
    cell({
      id: 'step-14',
      label: `Step 14 — ${ACTIONS[14]}`,
      step: 14,
      txs: [w14],
      level: 'SDK',
      points:
        "Manager cells (AA_A U1 5->3) + the ledger kernel's U1 balance 5->3; OwnerM observer wallet AND the " +
        'indexer reconstruction both 0->2; map sizes unchanged (a spend creates nothing)',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-14/step.json',
    });

    // =========================================================================================
    // STEP 15 — TOKD deployed MID-LEDGER; two colours that did not exist for 14 rows
    // =========================================================================================
    console.log(`\n## STEP 15 — ${ACTIONS[15]}`);
    const e15 = new StepEvidence(15, ACTIONS[15]!);
    const managerBefore15 = managerSnapshot(o.manager);
    const tokd = await rig.deployMinter({
      label: 'Minter4',
      tagText: 'TOKD',
      kind: 'minter',
      shieldedName: 'S4',
      unshieldedName: 'U4',
    });
    tx(rig.deployTxs.Minter4!);
    const tokdOrder = await existenceAtBlock(tokd.address, H);
    const ids15: string[] = [];
    for (const m of MINTS[15]!) {
      const c = registry.get(m.colour);
      const id =
        c.family === 'shielded'
          ? tx(await mintShieldedToUser(ctx, m.minter, m.amount, rig.observers[m.to], rig.fee))
          : tx(await mintUnshieldedToUser(ctx, m.minter, m.amount, rig.addresses[m.to], rig.fee));
      minted[m.colour] = (minted[m.colour] ?? 0n) + m.amount;
      ids15.push(id);
      log(`  ${m.minter} minted ${m.colour} ${m.amount} -> ${m.to}: tx ${id}`);
    }
    e15.op('deploy Minter4 (TOKD) MID-LEDGER, then mint S4 7 -> OwnerN and U4 4 -> OwnerM', [rig.deployTxs.Minter4!, ...ids15], 'SDK', {
      minter: tokd,
      deployBlock: tokd.deploy.blockHeight,
      managerDeployBlock: H,
      absentAtManagerBlock: tokdOrder.action === null,
      claim:
        'these two colours did not exist when the Manager was deployed, and did not exist while the Manager ' +
        'processed the first 14 rows of this ledger',
    });
    o = await settleAndAssert(15, e15);
    if (managerSnapshot(o.manager) !== managerBefore15) {
      throw new Error('STEP 15 DIVERGENCE — deploying TOKD and minting to users changed Manager custody state');
    }
    cell({
      id: 'step-15',
      label: `Step 15 — ${ACTIONS[15]}`,
      step: 15,
      txs: [rig.deployTxs.Minter4!, ...ids15],
      level: 'SDK',
      points:
        `TOKD deployed in block ${tokd.deploy.blockHeight}, ${(tokd.deploy.blockHeight ?? 0) - H} blocks after the ` +
        `Manager, and absent from the indexer at the Manager's deploy block; the Manager's whole decoded state is ` +
        'byte-identical across this row',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-15/step.json',
      note: 'The colour set grows from 6 to 8 here — dynamically, with no configuration step of any kind.',
    });

    // =========================================================================================
    // STEP 16 — THE HEADLINE: custody of a colour that did not exist at Manager deploy
    // =========================================================================================
    console.log(`\n## STEP 16 — ${ACTIONS[16]}`);
    const e16 = new StepEvidence(16, ACTIONS[16]!);
    const sizesBefore16 = o.sizes;
    const d16 = await withSpender(
      'OwnerN',
      'step16',
      (s) => userDepositShielded(ctx, s.party, s.managerProviders, registry.raw('S4'), 7n, raw.AA_A),
      [{ colour: registry.hex('S4'), shielded: true, amount: 7n }],
    );
    const id16 = tx(d16.txId);
    log(`  OwnerN deposited S4 7 -> AA_A: tx ${id16}`);
    e16.op('OwnerN deposits S4 7 -> AA_A', [id16], 'SDK', {
      colour: registry.hex('S4'),
      depositCoinNonce: Buffer.from(d16.nonce).toString('hex'),
      mapSizesBefore: sizesBefore16,
      claim:
        'the Manager creates a pool for a colour that was minted by a contract deployed 15 rows after the ' +
        'Manager itself — no configuration, no admin, no allowlist',
    });
    o = await settleAndAssert(16, e16);
    cell({
      id: 'step-16',
      label: 'Step 16 — HEADLINE: custody of a colour that did not exist when the Manager was deployed',
      step: 16,
      txs: [id16],
      level: 'SDK',
      points:
        `pools ${sizesBefore16.pools}->${o.sizes.pools} and shielded cells ${sizesBefore16.shieldedCells}->` +
        `${o.sizes.shieldedCells}: poolS4 = 7 with (AA_A,S4) = 7, for a colour whose issuing contract was ` +
        `deployed in block ${tokd.deploy.blockHeight} against the Manager's ${H}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-16/step.json',
    });

    // =========================================================================================
    // STEP 17 — the unshielded half of the same claim
    // =========================================================================================
    console.log(`\n## STEP 17 — ${ACTIONS[17]}`);
    const e17 = new StepEvidence(17, ACTIONS[17]!);
    const sizesBefore17 = o.sizes;
    const id17 = tx(
      await withSpender(
        'OwnerM',
        'step17',
        (s) => userDepositUnshielded(ctx, s.party, s.managerProviders, registry.raw('U4'), 4n, raw.AA_B),
        [{ colour: registry.hex('U4'), shielded: false, amount: 4n }],
      ),
    );
    log(`  OwnerM deposited U4 4 -> AA_B: tx ${id17}`);
    e17.op('OwnerM deposits U4 4 -> AA_B', [id17], 'SDK', {
      colour: registry.hex('U4'),
      mapSizesBefore: sizesBefore17,
      note:
        '`receiveUnshielded` is SELF-ENFORCING at the ledger: a transaction that names a colour it is not ' +
        'actually carrying fails to balance and is refused by the node. This deposit committing is that ' +
        'assumption asserted rather than assumed (spec Assumptions).',
    });
    o = await settleAndAssert(17, e17);
    cell({
      id: 'step-17',
      label: `Step 17 — ${ACTIONS[17]}`,
      step: 17,
      txs: [id17],
      level: 'SDK',
      points:
        `unshielded cells ${sizesBefore17.unshieldedCells}->${o.sizes.unshieldedCells}; the contract's ledger ` +
        'balance for U4 = 4 with (AA_B,U4) = 4 — the unshielded half of the mid-ledger colour claim',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-17/step.json',
    });

    // --- the final table, against the spec's separately written one --------------------------------
    const finalExpected = expectedOf(LAST_STEP);
    console.log('\n## FINAL TABLE');
    for (const line of renderMarkdownTable(o.table, o.custody, finalExpected.colours)) console.log(line);
    console.log(`map sizes: ${renderSizes(o.sizes)}`);
    for (const p of PARTIES) {
      for (const c of finalExpected.colours) {
        const want = FINAL_TABLE.table[p as keyof typeof FINAL_TABLE.table][c as keyof typeof FINAL_TABLE.custody];
        if ((o.table[p][c] ?? 0n) !== want) {
          throw new Error(`FINAL TABLE mismatch at ${p}.${c}: observed ${o.table[p][c]}, spec says ${want}`);
        }
      }
    }
    for (const c of finalExpected.colours) {
      const want = FINAL_TABLE.custody[c as keyof typeof FINAL_TABLE.custody];
      if ((o.custody[c] ?? 0n) !== want) {
        throw new Error(`FINAL TABLE custody mismatch at ${c}: observed ${o.custody[c]}, spec says ${want}`);
      }
    }
    if (JSON.stringify(o.sizes) !== JSON.stringify(END_SIZES)) {
      throw new Error(`END-STATE MAP SIZES mismatch: observed ${JSON.stringify(o.sizes)}, spec says ${JSON.stringify(END_SIZES)}`);
    }
    const finalTableMarkdown = renderMarkdownTable(o.table, o.custody, finalExpected.colours);
    const finalWalkObservation = o;

    cell({
      id: 'invariant-per-colour',
      label: 'Invariant — `custody[c] == AA_A[c] + AA_B[c]` for every DISCOVERED colour, after EVERY step',
      step: '0-17 + probes',
      txs: [],
      level: 'derived',
      points:
        'asserted in `assertAll` after every row and every probe step, per colour, between two independently ' +
        "maintained mechanisms (the Manager's balance maps vs the pooled zswap coin / ledger-kernel unshielded " +
        'balance)',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0..17/step.json',
    });
    cell({
      id: 'map-sizes',
      label: 'Exact map sizes after EVERY step, and ZERO unaccounted keys over the dynamic colour set',
      step: '0-17 + probes',
      txs: [],
      level: 'derived',
      points:
        `every row asserts {pools, shieldedCells, unshieldedCells} exactly against the spec's transcription ` +
        `(0/0/0 at rows 0-6 … ${JSON.stringify(END_SIZES)} at row 17), and every key in the raw ledger maps is ` +
        "reproduced from (AA account x registered colour) by the contract's own pure key circuits",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0..17/step.json',
    });
    cell({
      id: 'dormant-U3',
      label: 'FR-206 — U3 is minted by no one, deposited by no one, and absent from EVERY map at every row',
      step: '0-17',
      txs: [],
      level: 'derived',
      points:
        'asserted after every row: U3 reads 0 for all four parties and for custody, and has no pool, no cell in ' +
        "either family map, and no entry in the ledger kernel's balance map",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-17/step.json',
    });

    // =========================================================================================
    // NEGATIVE CONTROLS — against the post-step-17 state (the spec's exact final table)
    // =========================================================================================
    controls = await runControls(rig, o);
    for (const c of controls) {
      cell({
        id: c.id,
        label: c.label,
        step: c.id,
        txs: c.setupTxs,
        level: 'SDK',
        points:
          `${c.rejectedAt}; full table + every pool + every ledger balance byte-identical before/after; map sizes ` +
          `${JSON.stringify(c.mapSizesBefore)} -> ${JSON.stringify(c.mapSizesAfter)}; ` +
          Object.entries(c.noStateCreated)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; '),
        status: c.status,
        evidence: 'evidence/g3-ledger/negative-controls.json',
        note: c.reason,
      });
    }

    // =========================================================================================
    // PROBES — P-COLL, M3, distinctness
    // =========================================================================================
    const probeExpected: ExpectedState = expectedOf(LAST_STEP);
    const harness: ProbeHarness = {
      rig,
      tx,
      withSpender,
      addColours: (namesToAdd) => {
        for (const name of namesToAdd) {
          if (probeExpected.colours.includes(name)) continue;
          probeExpected.colours.push(name);
          for (const p of PARTIES) probeExpected.table[p][name] = 0n;
          probeExpected.custody[name] = 0n;
          if (minted[name] === undefined) minted[name] = 0n;
        }
      },
      expect: (fn) => fn(probeExpected),
      assertNow: async (label) => {
        let obs = await waitForTable(deps, probeExpected, label);
        obs = await withIndexerCheck(deps, obs);
        assertAll(obs, probeExpected, label, minted, deps, [DORMANT]);
        console.log(
          `PROBE STEP ASSERTED (${label}) — ${renderTable(obs.table, probeExpected.colours)}  ` +
            `${renderCustody(obs.custody, probeExpected.colours, registry)}  ${renderSizes(obs.sizes)}`,
        );
        const ev = new StepEvidence(`probe-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}`, label);
        ev.write(probeExpected, obs);
        return obs;
      },
      minted,
      cell,
      evidenceDir: EVID,
    };
    probes = await runProbes(harness);

    // --- final artifacts ---------------------------------------------------------------------------
    const finalObservation = await withIndexerCheck(deps, await observe(deps));
    const allNames = registry.names();

    const deployOrderRows: Array<Record<string, unknown>> = [];
    for (const m of rig.minters) {
      const ex = await existenceAtBlock(m.address, H);
      deployOrderRows.push({
        contract: m.label,
        tag: m.tagText,
        address: m.address,
        deployBlock: m.deploy.blockHeight,
        managerBlock: H,
        strictlyLater: (m.deploy.blockHeight ?? -1) > H,
        absentAtManagerBlock: ex.action === null,
        absentAtManagerBlockAtOrBefore: ex.contractQueryError === null ? ex.contract === null : null,
        contractQueryError: ex.contractQueryError,
      });
    }

    writeFileSync(
      join(EVID, 'cells.json'),
      `${JSON.stringify({ label: 'EXPERIMENTAL_LANE / LANE-DEV-1', utc: stamp(), cells }, bigints, 2)}\n`,
    );
    writeFileSync(
      join(EVID, 'run-context.json'),
      `${JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          utc: stamp(),
          managerAddress: rig.managerAddress,
          managerDeploy: rig.managerDeploy,
          chainTipBeforeAnyDeploy: rig.chainTipBeforeAnyDeploy,
          deployOrder: {
            managerBlock: H,
            rows: deployOrderRows,
            claim:
              'the Manager was deployed in a strictly earlier block than every issuing contract, and at the ' +
              "Manager's deploy block the indexer reports NO contract action for any of their addresses",
          },
          minters: rig.minters,
          colours: Object.fromEntries(
            registry.list().map((c) => [c.name, { hex: c.hex, family: c.family, issuer: c.issuer }]),
          ),
          colourNames: allNames,
          accounts: rig.ids,
          deployTxs: rig.deployTxs,
          fundingTxs: rig.fundingTxs,
          mintedTotals: minted,
          endStateMapSizes: finalWalkObservation.sizes,
          specEndStateMapSizes: END_SIZES,
          finalWalkTable: snapshotObject(finalWalkObservation),
          finalTableMarkdown,
          probes,
          metrics: metricsReport(),
          finalObservationAfterProbes: snapshotObject(finalObservation),
          finalMarkdownAfterProbes: renderMarkdownTable(
            finalObservation.table,
            finalObservation.custody,
            registry.names(),
          ),
        },
        bigints,
        2,
      )}\n`,
    );

    const red = cells.filter((c) => c.status === 'RED');
    console.log('\n## RESULT');
    console.log(`18/18 step rows asserted live; ${cells.length} records written`);
    console.log(`final walk table: ${renderTable(finalWalkObservation.table, finalExpected.colours)}`);
    console.log(`                  ${renderCustody(finalWalkObservation.custody, finalExpected.colours, registry)}`);
    console.log(`end-state map sizes: ${renderSizes(finalWalkObservation.sizes)} (spec: ${renderSizes(END_SIZES)})`);
    console.log(`manager_address: ${rig.managerAddress}`);
    console.log(`M3 transaction(s): ${(probes.m3 as any).txIds.join(', ')} — ${(probes.m3 as any).shape}`);
    if (red.length > 0) {
      console.error(`\n${red.length} record(s) RED: ${red.map((c) => c.id).join(', ')}`);
      process.exitCode = 1;
    }
  } finally {
    if (rig) await rig.close();
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
