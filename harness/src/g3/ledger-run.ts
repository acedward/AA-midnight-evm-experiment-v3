// G3 — the spec's 14-row step ledger (steps 0 through 13) plus every negative control and both
// mixed-colour probes, in ONE scripted process. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// After every step the harness reads every observation point, asserts the spec's expected 16-cell
// table EXACTLY, asserts both shielded pool values and both unshielded contract-ledger balances,
// asserts the per-colour invariant `custody[c] == AA_A[c] + AA_B[c]`, asserts the ledger
// conservation identity per colour, and halts on the first divergence. Per-step evidence lands in
// `evidence/g3-ledger/step-N/`; every row, control and probe records itself into
// `evidence/g3-ledger/cells.json`, from which `CELLS.md` is rendered.
//
// The step table, the amounts and the final table are NORMATIVE in the specification — the
// `EXPECTED` map below is a transcription of it and must not be "fixed" to match an observation.
//
// F-104 discipline: no balance in this run is ever read from a wallet that submitted a transaction.
// User cells come from read-only OBSERVER wallets, cross-checked against the indexer (unshielded)
// and against ledger conservation (shielded); every user-submitted transaction is built by a
// FRESH spender wallet that is closed immediately afterwards. See `setup.ts`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, resultOf, type Rig, type Spender } from './setup.js';
import { metricsReport } from './metrics.js';
import { withDustRetry } from '../night.js';
import {
  accountWithdrawShielded,
  accountWithdrawUnshielded,
  errorChain,
  mintShieldedToUser,
  mintUnshieldedToUser,
  mixedColourDeposit,
  transferInternal,
  userDepositShielded,
  userDepositUnshielded,
  type MixedResult,
} from './actions.js';
import {
  assertAll,
  observe,
  renderCustody,
  renderMarkdownTable,
  renderTable,
  snapshotObject,
  waitForTable,
  withIndexerCheck,
  type Custody,
  type ExpectedState,
  type Observation,
  type Table,
} from './table.js';
import { AA_PARTIES, COLOURS, type ColourName, type PartyName } from './observe.js';
import { runControls, type ControlResult } from './controls.js';
// The spec's step table lives in ONE place — `expected.ts` — because it is the only thing in this
// harness copied from a document rather than derived, and the offline suite checks that
// transcription against itself (and against the spec's separately written final table) before any
// stack is booted. `ExpectedStep` there is structurally the `ExpectedState` asserted against here.
import { ACTIONS, EXPECTED } from './expected.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}` : v);

/** Running totals the Minters have issued of each configured colour. */
const minted: Custody = { S1: 0n, S2: 0n, U1: 0n, U2: 0n };

// ---------------------------------------------------------------------------------------------
// Cell records — one per step row / control / probe, written out for CELLS.md
// ---------------------------------------------------------------------------------------------
export type CellRecord = {
  id: string;
  label: string;
  step: number | string;
  txs: string[];
  level: 'LEDGER' | 'SDK' | 'derived';
  points: string;
  status: 'GREEN' | 'RED';
  evidence: string;
  note?: string;
};
const cells: CellRecord[] = [];
const cell = (c: CellRecord) => {
  cells.push(c);
  console.log(`  CELL ${c.status.padEnd(5)} ${c.id} — ${c.label}`);
};

// ---------------------------------------------------------------------------------------------
// The rotating on-chain spot check: one real `accountBalance` circuit call per step, cycling
// through all eight (AA account, colour) cells so every one of them is confirmed at least once by
// a mechanism completely independent of the state decode (FR-108).
// ---------------------------------------------------------------------------------------------
const SPOT_ORDER: Array<[PartyName, ColourName]> = [];
for (const p of AA_PARTIES) for (const c of COLOURS) SPOT_ORDER.push([p, c]);

const spotCheck = async (rig: Rig, step: number, o: Observation): Promise<Observation> => {
  const [account, colour] = SPOT_ORDER[step % SPOT_ORDER.length]!;
  const id = rig.raw[account as 'AA_A' | 'AA_B'];
  await rig.ctx.actAs(rig.ctx.managerFee, new Uint8Array(32));
  const r: any = await withDustRetry(rig.fee, `accountBalance(${account}, ${colour})`, () =>
    rig.managerDeployed.callTx.accountBalance(id, rig.colours.raw[colour]),
  );
  const onChain = resultOf<bigint>(r);
  const txish = String(r?.public?.txId ?? r?.public?.txHash ?? '');
  log(`  spot check: on-chain accountBalance(${account}, ${colour}) = ${onChain} (tx ${txish})`);
  return { ...o, spotCheck: { account, colour, onChain, ledgerState: o.table[account][colour], txish } };
};

// ---------------------------------------------------------------------------------------------
// Per-step evidence
// ---------------------------------------------------------------------------------------------
type Operation = { label: string; txs: string[]; level: string; detail?: unknown };

class StepEvidence {
  private ops: Operation[] = [];
  constructor(
    readonly n: number,
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

    const flat = (t: Table) => {
      const out: Record<string, Record<string, string>> = {};
      for (const p of ['OwnerN', 'OwnerM', 'AA_A', 'AA_B'] as const) {
        out[p] = {};
        for (const c of COLOURS) out[p][c] = String(t[p][c]);
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
          expected: {
            table: flat(expected.table),
            custody: {
              poolS1: String(expected.custody.S1),
              poolS2: String(expected.custody.S2),
              ledgerU1: String(expected.custody.U1),
              ledgerU2: String(expected.custody.U2),
            },
          },
          observed: snapshotObject(observed),
          observationPoints: {
            AA_cells: 'Manager `balances` map decoded from contract state (keys derived by the contract\'s own pure balanceKey circuit)',
            AA_cells_second: 'the per-colour custody side — pooled zswap coin (shielded) / ledger-kernel unshielded balance — via the invariant custody[c] == AA_A[c] + AA_B[c]',
            AA_cells_third: observed.spotCheck
              ? `on-chain accountBalance(${observed.spotCheck.account}, ${observed.spotCheck.colour}) = ${observed.spotCheck.onChain}`
              : '(no spot check this step)',
            user_cells: 'read-only OBSERVER wallet facades (never submitters — finding F-104)',
            user_cells_second_unshielded: 'UTXO set reconstructed from the indexer transaction history, per colour',
            user_cells_second_shielded: 'ledger conservation identity minted[c] == custody[c] + OwnerN[c] + OwnerM[c]',
          },
          indexerUnshielded: observed.indexerUnshielded,
          spotCheck: observed.spotCheck,
          mintedTotals: minted,
          perColourInvariant: Object.fromEntries(
            COLOURS.map((c) => [
              c,
              `${observed.custody[c]} == ${observed.table.AA_A[c]} + ${observed.table.AA_B[c]}`,
            ]),
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
      '## Observed table (asserted equal to the spec\'s expected state)',
      '',
      ...renderMarkdownTable(observed.table, observed.custody),
      '',
      `Per-colour invariant: ${COLOURS.map((c) => `${c}: ${observed.custody[c]} == ${observed.table.AA_A[c]}+${observed.table.AA_B[c]}`).join('; ')}`,
      '',
      `Conservation: ${COLOURS.map((c) => `${c}: minted ${minted[c]} == ${observed.custody[c]}+${observed.table.OwnerN[c]}+${observed.table.OwnerM[c]}`).join('; ')}`,
      '',
      `Indexer reconstruction (independent of every wallet): OwnerN U1=${observed.indexerUnshielded?.OwnerN.U1} U2=${observed.indexerUnshielded?.OwnerN.U2}, ` +
        `OwnerM U1=${observed.indexerUnshielded?.OwnerM.U1} U2=${observed.indexerUnshielded?.OwnerM.U2}.`,
      '',
      observed.spotCheck
        ? `On-chain spot check: \`accountBalance(${observed.spotCheck.account}, ${observed.spotCheck.colour})\` = ${observed.spotCheck.onChain} (ledger state says ${observed.spotCheck.ledgerState}).`
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
  console.log(`# G3 FOUR-COLOUR STEP LEDGER — steps 0-13 + NC-1..5 + M1 + M2 — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;
  let controls: ControlResult[] = [];

  try {
    rig = await bootstrap();
    const { ctx, deps, raw, colours } = rig;

    /**
     * Every submitted transaction is logged here, because observation point 2 for user unshielded
     * holdings is a replay of exactly these through the indexer. A transaction that moved value but
     * was never logged would silently weaken that check, so the recording happens at the single
     * place each id is first seen.
     */
    const tx = <T extends string>(id: T): T => {
      if (id) deps.submittedTxs.push(id);
      return id;
    };
    for (const id of Object.values(rig.deployTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);
    for (const id of Object.values(rig.fundingTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);

    /** Run one user-submitted operation on a FRESH spender wallet, then close it (F-104). */
    const withSpender = async <T>(
      who: 'OwnerN' | 'OwnerM',
      tag: string,
      fn: (s: Spender) => Promise<T>,
      require?: Array<{ colour: string; shielded: boolean; amount: bigint }>,
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
     * a step that has post-hoc detail to record (the internal transfers compare custody across the
     * operation) adds its operations first and calls `finish` once.
     */
    const settle = async (n: number): Promise<Observation> => {
      let o = await waitForTable(deps, EXPECTED[n]!, String(n));
      o = await spotCheck(rig!, n, o);
      o = await withIndexerCheck(deps, o);
      if (o.spotCheck?.txish) tx(o.spotCheck.txish);
      assertAll(o, EXPECTED[n]!, String(n), minted, deps);
      return o;
    };

    const finish = (n: number, e: StepEvidence, o: Observation): Observation => {
      e.write(EXPECTED[n]!, o);
      console.log(`STEP ${n} ASSERTED — ${renderTable(o.table)}  ${renderCustody(o.custody)}`);
      return o;
    };

    const settleAndAssert = async (n: number, e: StepEvidence): Promise<Observation> =>
      finish(n, e, await settle(n));

    // =========================================================================================
    // STEP 0 — baseline: everything deployed and configured, all sixteen cells zero
    // =========================================================================================
    console.log(`\n## STEP 0 — ${ACTIONS[0]}`);
    const e0 = new StepEvidence(0, ACTIONS[0]!);
    e0.op('deploy 3 Minters + Manager, configure, register both accounts', Object.values(rig.deployTxs), 'SDK', {
      minters: rig.minters,
      managerAddress: rig.managerAddress,
      colours: colours.hex,
      controlColours: { shielded: colours.control.shielded, unshielded: colours.control.unshielded },
      accounts: rig.ids,
      distinctness: rig.distinctness,
      fundingTxs: rig.fundingTxs,
    });
    let o = await settleAndAssert(0, e0);
    cell({
      id: 'step-0',
      label: 'Baseline: all 16 cells 0, no pools, no contract balances',
      step: 0,
      txs: Object.values(rig.deployTxs),
      level: 'SDK',
      points: 'Manager ledger state (8 seeded cells, 0 pools) + on-chain accountBalance spot check',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0/step.json',
      note: `${rig.distinctness.distinct}/${rig.distinctness.comparisons} pairwise colour comparisons distinct, read from on-chain circuit calls`,
    });
    cell({
      id: 'distinctness',
      label: 'Distinctness: all 6 colours (4 configured + 2 control) pairwise distinct from on-chain reads',
      step: 0,
      txs: [],
      level: 'SDK',
      points: `${rig.distinctness.distinct}/${rig.distinctness.comparisons} comparisons; Minter3's two colours confirmed ABSENT from the configured set`,
      status: rig.distinctness.distinct === 15 && rig.distinctness.collisions.length === 0 ? 'GREEN' : 'RED',
      evidence: 'evidence/g3-ledger/step-0/step.json',
    });

    // =========================================================================================
    // STEPS 1-4 — the four mints, one per colour, to the two user wallets
    // =========================================================================================
    const mints: Array<[number, ColourName, 'Minter1' | 'Minter2', 'OwnerN' | 'OwnerM', bigint]> = [
      [1, 'S1', 'Minter1', 'OwnerN', 10n],
      [2, 'U1', 'Minter1', 'OwnerN', 10n],
      [3, 'S2', 'Minter2', 'OwnerM', 10n],
      [4, 'U2', 'Minter2', 'OwnerM', 10n],
    ];
    for (const [n, colour, minter, who, amount] of mints) {
      console.log(`\n## STEP ${n} — ${ACTIONS[n]}`);
      const e = new StepEvidence(n, ACTIONS[n]!);
      const shielded = colour === 'S1' || colour === 'S2';
      const id = shielded
        ? tx(await mintShieldedToUser(ctx, minter, amount, rig.observers[who], rig.fee))
        : tx(await mintUnshieldedToUser(ctx, minter, amount, rig.addresses[who], rig.fee));
      minted[colour] += amount;
      log(`  ${minter} minted ${colour} ${amount} -> ${who}: tx ${id}`);
      e.op(`${minter} mints ${colour} ${amount} -> ${who}`, [id], 'SDK', { colour: colours.hex[colour] });
      o = await settleAndAssert(n, e);
      cell({
        id: `step-${n}`,
        label: `${ACTIONS[n]}`,
        step: n,
        txs: [id],
        level: 'SDK',
        points: shielded
          ? `${who} observer wallet + ledger conservation for ${colour}; all 15 other cells unchanged`
          : `${who} observer wallet + indexer UTXO reconstruction for ${colour}; all 15 other cells unchanged`,
        status: 'GREEN',
        evidence: `evidence/g3-ledger/step-${n}/step.json`,
      });
    }

    // =========================================================================================
    // STEPS 5-8 — the four deposits into the Manager, both families, both accounts
    // =========================================================================================
    const deposits: Array<[number, ColourName, 'OwnerN' | 'OwnerM', 'AA_A' | 'AA_B', bigint]> = [
      [5, 'S1', 'OwnerN', 'AA_A', 6n],
      [6, 'U1', 'OwnerN', 'AA_A', 5n],
      [7, 'S2', 'OwnerM', 'AA_B', 6n],
      [8, 'U2', 'OwnerM', 'AA_B', 5n],
    ];
    for (const [n, colour, who, account, amount] of deposits) {
      console.log(`\n## STEP ${n} — ${ACTIONS[n]}`);
      const e = new StepEvidence(n, ACTIONS[n]!);
      const shielded = colour === 'S1' || colour === 'S2';
      const detail = await withSpender(
        who,
        `step${n}`,
        async (s) =>
          shielded
            ? await userDepositShielded(ctx, s.party, s.managerProviders, colour, amount, raw[account])
            : { txId: await userDepositUnshielded(ctx, s.party, s.managerProviders, colour, amount, raw[account]) },
        [{ colour: colours.hex[colour], shielded, amount }],
      );
      const id = tx((detail as any).txId as string);
      log(`  ${who} deposited ${colour} ${amount} -> ${account}: tx ${id}`);
      e.op(`${who} deposits ${colour} ${amount} -> ${account}`, [id], 'SDK', {
        colour: colours.hex[colour],
        depositCoinNonce: (detail as any).nonce ? Buffer.from((detail as any).nonce).toString('hex') : undefined,
      });
      o = await settleAndAssert(n, e);
      cell({
        id: `step-${n}`,
        label: `${ACTIONS[n]}`,
        step: n,
        txs: [id],
        level: 'SDK',
        points: shielded
          ? `Manager balances (${account} ${colour} 0->${amount}) + that colour's pooled coin; the OTHER shielded pool byte-identical`
          : `Manager balances (${account} ${colour} 0->${amount}) + the ledger kernel's unshielded balance for ${colour}`,
        status: 'GREEN',
        evidence: `evidence/g3-ledger/step-${n}/step.json`,
        note: 'A SINGLE wallet-balanced call: the Manager declares the receive and the depositor\'s wallet supplies the input, so sender spend and Manager receive share one transaction by construction.',
      });
    }

    // =========================================================================================
    // STEPS 9-10 — internal ownership transfers: NO token operation may occur
    // =========================================================================================
    const internals: Array<[number, ColourName, 'A' | 'B', 'AA_A' | 'AA_B', bigint]> = [
      [9, 'S1', 'A', 'AA_B', 3n],
      [10, 'U2', 'B', 'AA_A', 2n],
    ];
    for (const [n, colour, from, to, amount] of internals) {
      console.log(`\n## STEP ${n} — ${ACTIONS[n]}`);
      const e = new StepEvidence(n, ACTIONS[n]!);
      const before = o;
      const poolsBefore = JSON.stringify(before.pools, bigints);
      const custodyBefore = JSON.stringify(before.custody, bigints);
      const secret = from === 'A' ? raw.secretA : raw.secretB;
      const id = tx(await transferInternal(ctx, secret, raw[to], colour, amount, rig.fee));
      log(`  internal transfer ${colour} ${amount} -> ${to}: tx ${id}`);
      o = await settle(n);
      const poolsAfter = JSON.stringify(o.pools, bigints);
      const custodyAfter = JSON.stringify(o.custody, bigints);
      if (poolsBefore !== poolsAfter || custodyBefore !== custodyAfter) {
        throw new Error(
          `STEP ${n} DIVERGENCE — an internal transfer moved custody, which performs no token operation:\n` +
            `  pools    ${poolsBefore} -> ${poolsAfter}\n  custody  ${custodyBefore} -> ${custodyAfter}`,
        );
      }
      e.op(`internal transfer ${colour} ${amount} (owner ${from}) -> ${to}`, [id], 'SDK', {
        poolsBefore: JSON.parse(poolsBefore),
        poolsAfter: JSON.parse(poolsAfter),
        custodyBefore: JSON.parse(custodyBefore),
        custodyAfter: JSON.parse(custodyAfter),
        byteIdentical: true,
      });
      finish(n, e, o);
      cell({
        id: `step-${n}`,
        label: `${ACTIONS[n]}`,
        step: n,
        txs: [id],
        level: 'SDK',
        points: `Manager balances moved for ${colour} only; EVERY pooled coin (value AND nonce) and all four custody figures byte-identical before/after`,
        status: 'GREEN',
        evidence: `evidence/g3-ledger/step-${n}/step.json`,
        note: 'The spec\'s "pool UNCHANGED (no token op)" row, asserted over the whole custody surface rather than one colour.',
      });
    }

    // =========================================================================================
    // STEPS 11-12 — withdrawals back out to users, one per family
    // =========================================================================================
    console.log(`\n## STEP 11 — ${ACTIONS[11]}`);
    const e11 = new StepEvidence(11, ACTIONS[11]!);
    const w11 = tx(await accountWithdrawShielded(ctx, raw.secretB, 'S1', 3n, rig.observers.OwnerM, rig.fee));
    log(`  AA_B withdrew S1 3 -> OwnerM: tx ${w11}`);
    e11.op('AA_B withdraws S1 3 -> OwnerM', [w11], 'SDK', { colour: colours.hex.S1 });
    o = await settleAndAssert(11, e11);
    cell({
      id: 'step-11',
      label: ACTIONS[11]!,
      step: 11,
      txs: [w11],
      level: 'SDK',
      points: 'Manager balances (AA_B S1 3->0) + poolS1 6->3 (change coin retained); OwnerM observer wallet 0->3; poolS2 byte-identical',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-11/step.json',
    });

    console.log(`\n## STEP 12 — ${ACTIONS[12]}`);
    const e12 = new StepEvidence(12, ACTIONS[12]!);
    const w12 = tx(await accountWithdrawUnshielded(ctx, raw.secretA, 'U2', 2n, rig.addresses.OwnerN, rig.fee));
    log(`  AA_A withdrew U2 2 -> OwnerN: tx ${w12}`);
    e12.op('AA_A withdraws U2 2 -> OwnerN', [w12], 'SDK', { colour: colours.hex.U2 });
    o = await settleAndAssert(12, e12);
    cell({
      id: 'step-12',
      label: ACTIONS[12]!,
      step: 12,
      txs: [w12],
      level: 'SDK',
      points: "Manager balances (AA_A U2 2->0) + the ledger kernel's U2 balance 5->3; OwnerN observer wallet AND indexer reconstruction both 0->2; ledgerU1 unchanged at 5",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-12/step.json',
    });

    // =========================================================================================
    // STEP 13 — probe M1: two DIFFERENT colours in ONE transaction (FR-107, decision D-102)
    // =========================================================================================
    console.log(`\n## STEP 13 — ${ACTIONS[13]}`);
    const e13 = new StepEvidence(13, ACTIONS[13]!);
    // Both composition shapes are attempted inside `mixedColourDeposit`; this loop additionally
    // retries the whole thing on a FRESH spender wallet, because the failure mode this step has
    // actually shown is a node refusal that the diagnostic probe could not reproduce with a wallet
    // that had fully caught up (`evidence/g3-ledger/probe-merge.json`).
    let mixed: MixedResult | undefined;
    let lastMixedError: unknown;
    for (let tryNo = 1; tryNo <= 2 && !mixed; tryNo++) {
      try {
        mixed = await withSpender(
          'OwnerM',
          `step13-M1-try${tryNo}`,
          (s) =>
            mixedColourDeposit(ctx, s.party, s.managerProviders, {
              shieldedColour: 'S2',
              shieldedValue: 2n,
              unshieldedColour: 'U2',
              unshieldedAmount: 2n,
              accountId: raw.AA_B,
            }),
          // BOTH legs, not just one. A wallet that cannot yet see the second leg's funds does not
          // fail loudly — it balances into a transaction the node refuses with a bare
          // `1010: Invalid Transaction: Custom error: 223`, which is what took gate runs 1 and 2 RED
          // here while the probe, whose wallet saw both legs, had the identical shape ACCEPTED.
          [
            { colour: colours.hex.S2, shielded: true, amount: 2n },
            { colour: colours.hex.U2, shielded: false, amount: 2n },
          ],
        );
      } catch (e) {
        lastMixedError = e;
        log(`  M1 attempt ${tryNo} failed on BOTH shapes: ${errorChain(e)}`);
      }
    }
    if (!mixed) throw lastMixedError;
    tx(mixed.txId);
    log(`  M1: ONE transaction ${mixed.txId} — shape "${mixed.shape}", circuits ${mixed.circuits.join(' + ')}`);
    e13.op('OwnerM deposits S2 2 AND U2 2 -> AA_B in ONE transaction', [mixed.txId], 'LEDGER', mixed);
    o = await settleAndAssert(13, e13);
    cell({
      id: 'step-13',
      label: ACTIONS[13]!,
      step: 13,
      txs: [mixed.txId],
      level: mixed.shape.startsWith('one-intent') ? 'LEDGER' : 'SDK',
      points:
        'ONE transaction id carries BOTH effects: S2 pool 6->8 (merge) with AA_B S2 6->8, AND the ledger kernel U2 balance 3->5 with AA_B U2 3->5',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-13/step.json',
      note: `D-102 resolved to: ${mixed.shape}. ${mixed.attempts
        .map((a) => `${a.shape} -> ${a.ok ? 'OK' : `FAILED: ${a.error}`}`)
        .join(' | ')}`,
    });
    cell({
      id: 'M1',
      label: 'M1 — mixed-colour composition: two colours move atomically in ONE transaction (FR-107)',
      step: 13,
      txs: [mixed.txId],
      level: mixed.shape.startsWith('one-intent') ? 'LEDGER' : 'SDK',
      points: `shape "${mixed.shape}"; both effects observed after a single transaction id`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-13/step.json',
    });

    // The standing invariant, asserted after every one of the fourteen rows.
    cell({
      id: 'invariant-per-colour',
      label: 'Invariant: `custody[c] == AA_A[c] + AA_B[c]` for all four colours, after EVERY step',
      step: '0-13',
      txs: [],
      level: 'derived',
      points:
        'asserted in `assertAll` after all fourteen rows, per colour, between two independently maintained mechanisms (contract `balances` map vs pooled zswap coin / ledger-kernel unshielded balance)',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0..13/step.json',
    });
    cell({
      id: 'enumeration',
      label: 'FR-105 exactness: `balances.size() == accounts x 4` with ZERO unaccounted keys, after every step',
      step: '0-13',
      txs: [],
      level: 'derived',
      points:
        "every key in raw ledger state reproduced by the contract's own pure `balanceKey` circuit; a cell moving that the step did not name is a step failure",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0..13/step.json',
    });

    console.log(`\n## FINAL TABLE`);
    for (const line of renderMarkdownTable(o.table, o.custody)) console.log(line);

    // =========================================================================================
    // NEGATIVE CONTROLS AND M2 — run against the post-step-13 state, in this same process
    // =========================================================================================
    controls = await runControls(rig, o, tx, mixed.shape);
    for (const c of controls) {
      cell({
        id: c.id,
        label: c.label,
        step: c.id,
        txs: c.setupTxs,
        level: 'SDK',
        points: `${c.rejectedAt}; full 16-cell table + both pools + both ledger balances byte-identical before/after`,
        status: c.status,
        evidence: 'evidence/g3-ledger/negative-controls.json',
        note: c.reason,
      });
    }

    // --- final artifacts ---------------------------------------------------------------------------
    const finalObservation = await withIndexerCheck(deps, await observe(deps));
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
          minters: rig.minters,
          colours: colours.hex,
          controlColours: { shielded: colours.control.shielded, unshielded: colours.control.unshielded },
          distinctness: rig.distinctness,
          accounts: rig.ids,
          deployTxs: rig.deployTxs,
          fundingTxs: rig.fundingTxs,
          mintedTotals: minted,
          mixedColour: mixed,
          metrics: metricsReport(),
          finalTable: snapshotObject(finalObservation),
          finalTableMarkdown: renderMarkdownTable(finalObservation.table, finalObservation.custody),
        },
        bigints,
        2,
      )}\n`,
    );

    const red = cells.filter((c) => c.status === 'RED');
    console.log('\n## RESULT');
    console.log(`14/14 step rows asserted live; ${cells.length} records written`);
    console.log(`final table: ${renderTable(o.table)}  ${renderCustody(o.custody)}`);
    console.log(`manager_address: ${rig.managerAddress}`);
    console.log(`M1 transaction:  ${mixed.txId}  (${mixed.shape})`);
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
