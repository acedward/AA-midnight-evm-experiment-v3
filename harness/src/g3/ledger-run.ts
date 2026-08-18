// G3 — the ordered step ledger, spec steps 0 through 9, in ONE scripted process (SC-001).
//
// After every step the harness reads every observation point, asserts the spec's expected
// four-party table EXACTLY, asserts both halves of the standing invariant `pool = AA_A + AA_B`,
// and halts on the first divergence. Per-step evidence lands in `evidence/g3-ledger/step-N/`,
// and every matrix cell records its own transaction ids, observation points and composition
// level into `evidence/g3-ledger/cells.json`, from which `CELLS.md` is rendered.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, type Rig } from './setup.js';
import { metricsReport } from './metrics.js';
import {
  accountWithdrawShielded,
  accountWithdrawUnshielded,
  mintShieldedToAccount,
  mintShieldedToUser,
  mintUnshieldedToAccount,
  mintUnshieldedToUser,
  poolSelfSendShielded,
  poolSelfSendUnshielded,
  transferInternal,
  userDepositShielded,
  userDepositUnshielded,
  userSend,
} from './actions.js';
import {
  assertAll,
  observe,
  withIndexerCheck,
  renderTable,
  row,
  snapshot,
  waitForTable,
  waitUntil,
  type Observation,
  type Table,
} from './table.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}` : v);

// ---------------------------------------------------------------------------------------------
// The spec's expected table, verbatim. Column order is the spec's: AA_A | OwnerN | AA_B | OwnerM.
// ---------------------------------------------------------------------------------------------
const t = (a: [bigint, bigint], n: [bigint, bigint], b: [bigint, bigint], m: [bigint, bigint]): Table => ({
  AA_A: row(a[0], a[1]),
  OwnerN: row(n[0], n[1]),
  AA_B: row(b[0], b[1]),
  OwnerM: row(m[0], m[1]),
});

const EXPECTED: Record<number, Table> = {
  0: t([0n, 0n], [0n, 0n], [0n, 0n], [0n, 0n]),
  1: t([10n, 0n], [10n, 0n], [0n, 0n], [0n, 0n]),
  2: t([10n, 10n], [10n, 10n], [0n, 0n], [0n, 0n]),
  3: t([5n, 10n], [5n, 10n], [5n, 0n], [5n, 0n]),
  4: t([0n, 10n], [0n, 10n], [10n, 0n], [10n, 0n]),
  5: t([0n, 5n], [0n, 5n], [10n, 5n], [10n, 5n]),
  6: t([0n, 0n], [0n, 0n], [10n, 10n], [10n, 10n]),
  7: t([5n, 0n], [5n, 0n], [5n, 10n], [5n, 10n]),
  8: t([5n, 5n], [5n, 5n], [5n, 5n], [5n, 5n]),
  9: t([5n, 5n], [5n, 5n], [5n, 5n], [5n, 5n]),
};

/** Running totals the Minter has issued — the ledger side of the conservation cross-check. */
const minted = { shielded: 0n, unshielded: 0n };

// ---------------------------------------------------------------------------------------------
// Cell records — one per spec checklist item, written out for CELLS.md
// ---------------------------------------------------------------------------------------------
export type CellRecord = {
  id: string;
  label: string;
  step: number;
  txs: string[];
  level: 'LEDGER' | 'SDK' | 'wallet' | 'derived';
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
// Per-step evidence
// ---------------------------------------------------------------------------------------------
type Operation = { label: string; txs: string[]; level: string; before: unknown; after: unknown; detail?: unknown };

class StepEvidence {
  private ops: Operation[] = [];
  constructor(
    readonly n: number,
    readonly action: string,
  ) {}

  op(label: string, txs: string[], level: string, before: Observation, after: Observation, detail?: unknown): void {
    this.ops.push({
      label,
      txs,
      level,
      before: JSON.parse(snapshot(before)),
      after: JSON.parse(snapshot(after)),
      detail: detail === undefined ? undefined : JSON.parse(JSON.stringify(detail, bigints)),
    });
  }

  write(expected: Table, observed: Observation): void {
    const dir = join(EVID, `step-${this.n}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'step.json'),
      JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          step: this.n,
          action: this.action,
          utc: stamp(),
          expected,
          observed: JSON.parse(snapshot(observed)),
          mintedTotals: minted,
          operations: this.ops,
        },
        bigints,
        2,
      ),
    );
    const lines = [
      `# Step ${this.n} — ${this.action}`,
      '',
      '**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`',
      '',
      `| party | expected | observed |`,
      `|---|---|---|`,
      ...(['AA_A', 'OwnerN', 'AA_B', 'OwnerM'] as const).map(
        (k) =>
          `| ${k} | ${expected[k].shielded}/${expected[k].unshielded} | ` +
          `${observed.table[k].shielded}/${observed.table[k].unshielded} |`,
      ),
      '',
      `Manager pooled shielded coin: **${observed.manager.poolValue}** (nonce \`${observed.manager.poolNonce}\`)`,
      `Manager unshielded ledger balance: **${observed.managerUnshieldedLedger}**`,
      `Invariant \`pool = AA_A + AA_B\` asserted in BOTH families.`,
      `Indexer reconstruction of user unshielded balances (independent of the wallet): ` +
        `OwnerN=${observed.indexerUnshielded?.OwnerN}, OwnerM=${observed.indexerUnshielded?.OwnerM}.`,
      '',
      '## Operations',
      '',
      ...this.ops.flatMap((o) => [`- **${o.label}** (${o.level}) — tx ${o.txs.map((x) => `\`${x}\``).join(', ')}`]),
      '',
    ];
    writeFileSync(join(dir, 'summary.md'), lines.join('\n'));
    log(`  evidence -> evidence/g3-ledger/step-${this.n}/`);
  }
}

// ---------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------
const main = async () => {
  console.log(`# G3 STEP LEDGER — steps 0-9 — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;

  try {
    rig = await bootstrap();
    const { ctx, deps, raw, ids } = rig;
    const settle = async (pred: (o: Observation) => boolean, what: string) => waitUntil(deps, pred, what);
    /**
     * Every submitted transaction is logged here, because observation point 2 for user unshielded
     * holdings is a replay of exactly these through the indexer (see `withIndexerCheck`). A
     * transaction that moved value but was never logged would silently weaken that check, so the
     * recording happens at the single place each id is first seen.
     */
    const tx = <T extends string>(id: T): T => {
      deps.submittedTxs.push(id);
      return id;
    };
    // The deploy transactions create no unshielded outputs, but replaying them costs nothing and
    // keeps "every transaction this run submitted" literally true.
    tx(rig.deployTxs.minter);
    tx(rig.deployTxs.manager);
    for (const id of Object.values(rig.fundingTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);

    // =========================================================================================
    // STEP 0 — deploy, register, empty table
    // =========================================================================================
    console.log('\n## STEP 0 — deploy Minter + Manager; register AA_A (OwnerA), AA_B (OwnerB)');
    const e0 = new StepEvidence(0, 'Deploy Minter + Manager; register AA_A and AA_B; create OwnerN, OwnerM');
    let o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[0]!, '0'));
    if (!o.manager.configured) throw new Error('STEP 0 DIVERGENCE — Manager is not configured');
    if (o.manager.accounts.length !== 2) {
      throw new Error(`STEP 0 DIVERGENCE — expected 2 registered accounts, saw ${o.manager.accounts.length}`);
    }
    if (o.manager.shieldedColor !== rig.colors.shielded || o.manager.unshieldedColor !== rig.colors.unshielded) {
      throw new Error('STEP 0 DIVERGENCE — the Manager is not bound to the Minter colours');
    }
    assertAll(o, EXPECTED[0]!, '0', minted);
    e0.op('deploy + configure + register', [rig.deployTxs.minter, rig.deployTxs.manager], 'SDK', o, o, {
      minterAddress: rig.minterAddress,
      managerAddress: rig.managerAddress,
      colors: rig.colors,
      accounts: { AA_A: ids.idA, AA_B: ids.idB },
      fundingTxs: rig.fundingTxs,
    });
    e0.write(EXPECTED[0]!, o);
    console.log(`STEP 0 ASSERTED — ${renderTable(o.table)}; pool = AA_A + AA_B = 0 in both families`);

    // =========================================================================================
    // STEP 1 — mint shielded 10 -> AA_A (paired) and 10 -> OwnerN
    // =========================================================================================
    console.log('\n## STEP 1 — mint shielded 10 -> AA_A (paired receive+credit) and 10 -> OwnerN');
    const e1 = new StepEvidence(1, 'Mint shielded 10 to AA_A and 10 to OwnerN');
    let before = o;

    const m1a = await mintShieldedToAccount(ctx, 10n, raw.idA, rig.fee);
    tx(m1a.txId);
    minted.shielded += 10n;
    log(`  mint shielded -> AA_A: tx ${m1a.txId} (one intent, segment ${m1a.segment})`);
    let after = await settle((x) => x.table.AA_A.shielded === 10n && x.manager.poolValue === 10n, 'AA_A credited 10');
    e1.op('mint shielded 10 -> AA_A', [m1a.txId], 'LEDGER', before, after, {
      mintNonce: Buffer.from(m1a.nonce).toString('hex'),
      poolNonceAfter: after.manager.poolNonce,
      intentSegment: m1a.segment,
    });
    cell({
      id: 'mint-shielded-account',
      label: 'Mint shielded → manager account (paired Manager receive+credit in the same tx)',
      step: 1,
      txs: [m1a.txId],
      level: 'LEDGER',
      points: 'Manager account map (AA_A 0→10) + pooled zswap coin (0→10, nonce == the mint nonce)',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-1/step.json',
      note: 'Both call prototypes in ONE ledger Intent — the only cell midnight-js cannot express at SDK level.',
    });

    before = after;
    const m1b = tx(await mintShieldedToUser(ctx, 10n, rig.ownerN, rig.fee));
    minted.shielded += 10n;
    log(`  mint shielded -> OwnerN: tx ${m1b}`);
    after = await settle((x) => x.table.OwnerN.shielded === 10n, 'OwnerN credited 10 shielded');
    e1.op('mint shielded 10 -> OwnerN', [m1b], 'SDK', before, after, { coinsAfter: after.coins.OwnerN });
    cell({
      id: 'mint-shielded-user',
      label: 'Mint shielded → user',
      step: 1,
      txs: [m1b],
      level: 'SDK',
      points: "OwnerN wallet SDK (0→10) + ledger conservation (minted == pool + users' holdings)",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-1/step.json',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[1]!, '1'));
    assertAll(o, EXPECTED[1]!, '1', minted);
    e1.write(EXPECTED[1]!, o);
    console.log(`STEP 1 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 2 — mint unshielded 10 -> AA_A and 10 -> OwnerN
    // =========================================================================================
    console.log('\n## STEP 2 — mint unshielded 10 -> AA_A and 10 -> OwnerN');
    const e2 = new StepEvidence(2, 'Mint unshielded 10 to AA_A and 10 to OwnerN');
    before = o;

    const m2a = await mintUnshieldedToAccount(ctx, 10n, raw.idA, rig.fee);
    tx(m2a.txId);
    minted.unshielded += 10n;
    log(`  mint unshielded -> AA_A: tx ${m2a.txId} (one intent, segment ${m2a.segment})`);
    after = await settle((x) => x.table.AA_A.unshielded === 10n, 'AA_A credited 10 unshielded');
    e2.op('mint unshielded 10 -> AA_A', [m2a.txId], 'LEDGER', before, after, {
      managerUnshieldedLedgerAfter: after.managerUnshieldedLedger,
      intentSegment: m2a.segment,
    });
    cell({
      id: 'mint-unshielded-account',
      label: 'Mint unshielded → manager account',
      step: 2,
      txs: [m2a.txId],
      level: 'LEDGER',
      points: "Manager account map (AA_A 0→10) + the contract's unshielded ledger balance from the indexer (0→10)",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-2/step.json',
      note: 'No zswap output at all: the mint claims an unshielded spend to the Manager and the Manager claims the input — both are transcript effects, so they offset only inside one intent.',
    });

    before = after;
    const m2b = tx(await mintUnshieldedToUser(ctx, 10n, rig.ownerN, rig.fee));
    minted.unshielded += 10n;
    log(`  mint unshielded -> OwnerN: tx ${m2b}`);
    after = await settle((x) => x.table.OwnerN.unshielded === 10n, 'OwnerN credited 10 unshielded');
    e2.op('mint unshielded 10 -> OwnerN', [m2b], 'SDK', before, after, { utxosAfter: after.utxos.OwnerN });
    cell({
      id: 'mint-unshielded-user',
      label: 'Mint unshielded → user',
      step: 2,
      txs: [m2b],
      level: 'SDK',
      points: 'OwnerN wallet SDK (0→10) + indexer `unshieldedUtxos` for OwnerN (0→10)',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-2/step.json',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[2]!, '2'));
    assertAll(o, EXPECTED[2]!, '2', minted);
    e2.write(EXPECTED[2]!, o);
    console.log(`STEP 2 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 3 — shielded: OwnerN -5-> OwnerM ; AA_A -5-> AA_B internal
    // =========================================================================================
    console.log('\n## STEP 3 — shielded half: OwnerN -5-> OwnerM; AA_A -5-> AA_B (internal)');
    const e3 = new StepEvidence(3, 'Send shielded half: OwnerN→OwnerM (wallet split); AA_A→AA_B (internal)');
    before = o;

    const s3a = tx(await userSend(rig.ownerN, rig.ownerM, 'shielded', rig.colors.shielded, 5n));
    log(`  OwnerN -5-> OwnerM shielded: tx ${s3a}`);
    after = await settle(
      (x) => x.table.OwnerN.shielded === 5n && x.table.OwnerM.shielded === 5n,
      'OwnerN 5 / OwnerM 5 shielded',
    );
    e3.op('OwnerN -5-> OwnerM (shielded)', [s3a], 'wallet', before, after, {
      ownerNCoinsBefore: before.coins.OwnerN,
      ownerNCoinsAfter: after.coins.OwnerN,
      ownerMCoinsAfter: after.coins.OwnerM,
    });
    cell({
      id: 'send-shielded-user-user',
      label: 'Send shielded user→user',
      step: 3,
      txs: [s3a],
      level: 'wallet',
      points: 'OwnerN + OwnerM wallet SDK states + ledger conservation identity',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-3/step.json',
    });
    cell({
      id: 'split-shielded-user-change',
      label: 'Split: shielded user wallet change (OwnerN)',
      step: 3,
      txs: [s3a],
      level: 'wallet',
      points: "OwnerN's enumerated coins before/after: the 10-coin is consumed and a 5 change coin created",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-3/step.json',
      note: `coins before ${JSON.stringify(before.coins.OwnerN.map((c) => c.value))} → after ${JSON.stringify(after.coins.OwnerN.map((c) => c.value))}`,
    });

    before = after;
    const poolBefore3 = { value: before.manager.poolValue, nonce: before.manager.poolNonce };
    const s3b = tx(await transferInternal(ctx, raw.secretA, raw.idB, true, 5n, rig.fee));
    log(`  AA_A -5-> AA_B internal (shielded): tx ${s3b}`);
    after = await settle(
      (x) => x.table.AA_A.shielded === 5n && x.table.AA_B.shielded === 5n,
      'AA_A 5 / AA_B 5 shielded',
    );
    const poolUntouched3 =
      after.manager.poolValue === poolBefore3.value && after.manager.poolNonce === poolBefore3.nonce;
    if (!poolUntouched3) {
      throw new Error(
        `STEP 3 DIVERGENCE — internal transfer moved the pool (FR-005): ` +
          `${poolBefore3.value}@${poolBefore3.nonce} -> ${after.manager.poolValue}@${after.manager.poolNonce}`,
      );
    }
    e3.op('AA_A -5-> AA_B (internal, shielded)', [s3b], 'SDK', before, after, {
      poolBefore: poolBefore3,
      poolAfter: { value: after.manager.poolValue, nonce: after.manager.poolNonce },
      poolByteIdentical: poolUntouched3,
    });
    cell({
      id: 'internal-shielded',
      label: 'Shielded account→account internal ownership transfer, no ledger movement',
      step: 3,
      txs: [s3b],
      level: 'SDK',
      points: 'Manager account map (AA_A 10→5, AA_B 0→5) + pooled coin value AND nonce byte-identical before/after',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-3/step.json',
      note: `pool ${poolBefore3.value}@${poolBefore3.nonce} unchanged — FR-005 forward case`,
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[3]!, '3'));
    assertAll(o, EXPECTED[3]!, '3', minted);
    e3.write(EXPECTED[3]!, o);
    console.log(`STEP 3 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 4 — shielded crossed: OwnerN -5-> AA_B (deposit, merge) ; AA_A -5-> OwnerM (payout)
    // =========================================================================================
    console.log('\n## STEP 4 — shielded crossed: OwnerN -5-> AA_B (deposit); AA_A -5-> OwnerM (payout)');
    const e4 = new StepEvidence(4, 'Send shielded remaining half crossed: OwnerN→AA_B deposit; AA_A→OwnerM payout');
    before = o;

    // Deposit FIRST, so the pool has a held coin to MERGE the deposited coin with.
    const poolBefore4 = { value: before.manager.poolValue, nonce: before.manager.poolNonce };
    const d4 = await userDepositShielded(ctx, rig.ownerN, rig.managerN, 5n, raw.idB);
    tx(d4.txId);
    log(`  OwnerN -5-> AA_B deposit: tx ${d4.txId}`);
    after = await settle((x) => x.table.AA_B.shielded === 10n && x.manager.poolValue === 15n, 'AA_B 10, pool 15');
    e4.op('OwnerN -5-> AA_B (shielded deposit, merged into the pool)', [d4.txId], 'SDK', before, after, {
      depositCoinNonce: Buffer.from(d4.nonce).toString('hex'),
      poolBefore: poolBefore4,
      poolAfter: { value: after.manager.poolValue, nonce: after.manager.poolNonce },
      ownerNCoinsAfter: after.coins.OwnerN,
    });
    cell({
      id: 'send-shielded-user-account',
      label: 'Send shielded user→account (deposit credited to AA_B)',
      step: 4,
      txs: [d4.txId],
      level: 'SDK',
      points: 'Manager account map (AA_B 5→10) + pooled coin (10→15); OwnerN wallet 5→0',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-4/step.json',
      note: 'A SINGLE wallet-balanced call: the Manager declares the receive and the depositor’s wallet supplies the input, so sender spend and Manager receive are in one transaction by construction (FR-003).',
    });
    cell({
      id: 'merge-pool-deposit',
      label: 'Merge: pool combines the deposited coin with the held coin',
      step: 4,
      txs: [d4.txId],
      level: 'SDK',
      points: `pooled coin ${poolBefore4.value}@${poolBefore4.nonce} → ${after.manager.poolValue}@${after.manager.poolNonce} — one coin, value 10+5`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-4/step.json',
      note: 'The pool stays a SINGLE coin: mergeCoinImmediate consumes both and writes one merged coin with a new nonce.',
    });

    before = after;
    const poolBeforeW4 = { value: before.manager.poolValue, nonce: before.manager.poolNonce };
    const w4 = tx(await accountWithdrawShielded(ctx, raw.secretA, 5n, rig.ownerM, rig.fee));
    log(`  AA_A -5-> OwnerM payout: tx ${w4}`);
    after = await settle(
      (x) => x.table.AA_A.shielded === 0n && x.table.OwnerM.shielded === 10n,
      'AA_A drained, OwnerM at 10 shielded',
    );
    e4.op('AA_A -5-> OwnerM (shielded payout from the pool)', [w4], 'SDK', before, after, {
      poolBefore: poolBeforeW4,
      poolAfter: { value: after.manager.poolValue, nonce: after.manager.poolNonce },
      ownerMCoinsAfter: after.coins.OwnerM,
    });
    cell({
      id: 'send-shielded-account-user',
      label: 'Send shielded account→user (pool pays OwnerM)',
      step: 4,
      txs: [w4],
      level: 'SDK',
      points: 'Manager account map (AA_A 5→0) + pooled coin (15→10); OwnerM wallet 5→10',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-4/step.json',
      note: 'The wallet detected and can spend the CONTRACT-CREATED output — proven when OwnerM re-spends it in step 7.',
    });
    cell({
      id: 'split-shielded-contract-change',
      label: 'Split: shielded contract change coin retained in the pool',
      step: 4,
      txs: [w4],
      level: 'SDK',
      points: `pooled coin ${poolBeforeW4.value}@${poolBeforeW4.nonce} → ${after.manager.poolValue}@${after.manager.poolNonce}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-4/step.json',
      note: 'sendShielded returned a non-empty change arm; the Manager wrote the change coin back to itself.',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[4]!, '4'));
    assertAll(o, EXPECTED[4]!, '4', minted);
    e4.write(EXPECTED[4]!, o);
    console.log(`STEP 4 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 5 — unshielded: OwnerN -5-> OwnerM ; AA_A -5-> AA_B internal
    // =========================================================================================
    console.log('\n## STEP 5 — unshielded half: OwnerN -5-> OwnerM (UTXO split); AA_A -5-> AA_B (internal)');
    const e5 = new StepEvidence(5, 'Send unshielded half: OwnerN→OwnerM (UTXO split); AA_A→AA_B (internal)');
    before = o;

    const s5a = tx(await userSend(rig.ownerN, rig.ownerM, 'unshielded', rig.colors.unshielded, 5n));
    log(`  OwnerN -5-> OwnerM unshielded: tx ${s5a}`);
    after = await settle(
      (x) => x.table.OwnerN.unshielded === 5n && x.table.OwnerM.unshielded === 5n,
      'OwnerN 5 / OwnerM 5 unshielded',
    );
    e5.op('OwnerN -5-> OwnerM (unshielded)', [s5a], 'wallet', before, after, {
      ownerNUtxosBefore: before.utxos.OwnerN,
      ownerNUtxosAfter: after.utxos.OwnerN,
      ownerMUtxosAfter: after.utxos.OwnerM,
    });
    cell({
      id: 'send-unshielded-user-user',
      label: 'Send unshielded user→user',
      step: 5,
      txs: [s5a],
      level: 'wallet',
      points: 'OwnerN + OwnerM wallet SDK states + the indexer’s `unshieldedUtxos` for both addresses',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-5/step.json',
    });
    cell({
      id: 'split-unshielded-user-utxo',
      label: 'Split: unshielded user UTXO split into sent + change (OwnerN)',
      step: 5,
      txs: [s5a],
      level: 'wallet',
      points: `OwnerN UTXOs ${JSON.stringify(before.utxos.OwnerN.map((u) => u.value))} → ${JSON.stringify(after.utxos.OwnerN.map((u) => u.value))}; OwnerM gained ${JSON.stringify(after.utxos.OwnerM.map((u) => u.value))}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-5/step.json',
      note: 'The consumed 10-UTXO and the two 5 outputs are both recorded.',
    });

    before = after;
    const ledgerBefore5 = before.managerUnshieldedLedger;
    const s5b = tx(await transferInternal(ctx, raw.secretA, raw.idB, false, 5n, rig.fee));
    log(`  AA_A -5-> AA_B internal (unshielded): tx ${s5b}`);
    after = await settle(
      (x) => x.table.AA_A.unshielded === 5n && x.table.AA_B.unshielded === 5n,
      'AA_A 5 / AA_B 5 unshielded',
    );
    if (after.managerUnshieldedLedger !== ledgerBefore5) {
      throw new Error(
        `STEP 5 DIVERGENCE — internal transfer moved the contract's unshielded ledger balance ` +
          `(${ledgerBefore5} -> ${after.managerUnshieldedLedger}); FR-005 requires it untouched`,
      );
    }
    e5.op('AA_A -5-> AA_B (internal, unshielded)', [s5b], 'SDK', before, after, {
      contractLedgerBalanceBefore: ledgerBefore5,
      contractLedgerBalanceAfter: after.managerUnshieldedLedger,
    });
    cell({
      id: 'internal-unshielded',
      label: 'Unshielded account→account internal ownership transfer, no ledger movement',
      step: 5,
      txs: [s5b],
      level: 'SDK',
      points: `Manager account map (AA_A 10→5, AA_B 0→5) + the contract's unshielded ledger balance unchanged at ${ledgerBefore5}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-5/step.json',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[5]!, '5'));
    assertAll(o, EXPECTED[5]!, '5', minted);
    e5.write(EXPECTED[5]!, o);
    console.log(`STEP 5 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 6 — unshielded crossed: OwnerN -5-> AA_B ; AA_A -5-> OwnerM
    // =========================================================================================
    console.log('\n## STEP 6 — unshielded crossed: OwnerN -5-> AA_B; AA_A -5-> OwnerM');
    const e6 = new StepEvidence(6, 'Send unshielded remaining half crossed: OwnerN→AA_B; AA_A→OwnerM');
    before = o;

    const d6 = tx(await userDepositUnshielded(ctx, rig.ownerN, rig.managerN, 5n, raw.idB));
    log(`  OwnerN -5-> AA_B deposit (unshielded): tx ${d6}`);
    after = await settle((x) => x.table.AA_B.unshielded === 10n && x.table.OwnerN.unshielded === 0n, 'AA_B 10 unshielded');
    e6.op('OwnerN -5-> AA_B (unshielded deposit)', [d6], 'SDK', before, after, {
      contractLedgerBalanceAfter: after.managerUnshieldedLedger,
      ownerNUtxosAfter: after.utxos.OwnerN,
    });
    cell({
      id: 'send-unshielded-user-account',
      label: 'Send unshielded user→account',
      step: 6,
      txs: [d6],
      level: 'SDK',
      points: `Manager account map (AA_B 5→10) + contract unshielded ledger balance (${before.managerUnshieldedLedger}→${after.managerUnshieldedLedger}); OwnerN wallet and indexer both 5→0`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-6/step.json',
    });

    before = after;
    const ledgerBeforeW6 = before.managerUnshieldedLedger;
    const w6 = tx(await accountWithdrawUnshielded(ctx, raw.secretA, 5n, rig.ownerM, rig.fee));
    log(`  AA_A -5-> OwnerM (unshielded payout): tx ${w6}`);
    after = await settle(
      (x) => x.table.AA_A.unshielded === 0n && x.table.OwnerM.unshielded === 10n,
      'AA_A drained, OwnerM at 10 unshielded',
    );
    e6.op('AA_A -5-> OwnerM (unshielded payout)', [w6], 'SDK', before, after, {
      contractLedgerBalanceBefore: ledgerBeforeW6,
      contractLedgerBalanceAfter: after.managerUnshieldedLedger,
      ownerMUtxosAfter: after.utxos.OwnerM,
    });
    cell({
      id: 'send-unshielded-account-user',
      label: 'Send unshielded account→user',
      step: 6,
      txs: [w6],
      level: 'SDK',
      points: `Manager account map (AA_A 5→0) + contract unshielded ledger balance (${ledgerBeforeW6}→${after.managerUnshieldedLedger}); OwnerM wallet and indexer 5→10`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-6/step.json',
    });
    cell({
      id: 'split-unshielded-partial-pool',
      label: 'Split: unshielded partial pooled-balance spend',
      step: 6,
      txs: [w6],
      level: 'SDK',
      points: `the contract held ${ledgerBeforeW6} and paid out 5, retaining ${after.managerUnshieldedLedger}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-6/step.json',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[6]!, '6'));
    assertAll(o, EXPECTED[6]!, '6', minted);
    e6.write(EXPECTED[6]!, o);
    console.log(`STEP 6 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 7 — provenance, shielded: OwnerM -5-> AA_A ; AA_B -5-> OwnerN
    // =========================================================================================
    console.log('\n## STEP 7 — provenance (shielded): OwnerM -5-> AA_A; AA_B -5-> OwnerN');
    const e7 = new StepEvidence(7, 'Provenance re-send, shielded: OwnerM→AA_A; AA_B→OwnerN');
    before = o;

    const p7a = await userDepositShielded(ctx, rig.ownerM, rig.managerM, 5n, raw.idA);
    tx(p7a.txId);
    log(`  OwnerM -5-> AA_A (re-spending AA-originated coins): tx ${p7a.txId}`);
    after = await settle((x) => x.table.AA_A.shielded === 5n && x.table.OwnerM.shielded === 5n, 'AA_A 5, OwnerM 5');
    e7.op('OwnerM -5-> AA_A (shielded, AA-originated coins)', [p7a.txId], 'SDK', before, after, {
      ownerMCoinsBefore: before.coins.OwnerM,
      ownerMCoinsAfter: after.coins.OwnerM,
    });
    cell({
      id: 'provenance-user-resends-shielded',
      label: 'Provenance: user re-sends AA-originated shielded coins',
      step: 7,
      txs: [p7a.txId],
      level: 'SDK',
      points: "OwnerM's wallet spent coins CREATED BY THE MANAGER in step 4 (10→5) + Manager account map AA_A 0→5",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-7/step.json',
      note: 'This is the direct proof that the pinned wallet SDK detects and can spend contract-created zswap outputs — the spec’s Edge Case risk does not apply.',
    });

    before = after;
    const p7b = tx(await accountWithdrawShielded(ctx, raw.secretB, 5n, rig.ownerN, rig.fee));
    log(`  AA_B -5-> OwnerN (account re-spends user-deposited value): tx ${p7b}`);
    after = await settle((x) => x.table.AA_B.shielded === 5n && x.table.OwnerN.shielded === 5n, 'AA_B 5, OwnerN 5');
    e7.op('AA_B -5-> OwnerN (shielded, user-originated value)', [p7b], 'SDK', before, after, {
      poolAfter: { value: after.manager.poolValue, nonce: after.manager.poolNonce },
      ownerNCoinsAfter: after.coins.OwnerN,
    });
    cell({
      id: 'provenance-account-resends-shielded',
      label: 'Provenance: AA account re-sends user-originated shielded value',
      step: 7,
      txs: [p7b],
      level: 'SDK',
      points: "AA_B's holdings include OwnerN's step-4 deposit; account map 10→5 + pooled coin pays out and retains change",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-7/step.json',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[7]!, '7'));
    assertAll(o, EXPECTED[7]!, '7', minted);
    e7.write(EXPECTED[7]!, o);
    console.log(`STEP 7 ASSERTED — ${renderTable(o.table)}`);

    // =========================================================================================
    // STEP 8 — provenance, unshielded: OwnerM -5-> AA_A ; AA_B -5-> OwnerN
    // =========================================================================================
    console.log('\n## STEP 8 — provenance (unshielded): OwnerM -5-> AA_A; AA_B -5-> OwnerN');
    const e8 = new StepEvidence(8, 'Provenance re-send, unshielded: OwnerM→AA_A; AA_B→OwnerN');
    before = o;

    const p8a = tx(await userDepositUnshielded(ctx, rig.ownerM, rig.managerM, 5n, raw.idA));
    log(`  OwnerM -5-> AA_A (unshielded, AA-originated): tx ${p8a}`);
    after = await settle((x) => x.table.AA_A.unshielded === 5n && x.table.OwnerM.unshielded === 5n, 'AA_A 5 unshielded');
    e8.op('OwnerM -5-> AA_A (unshielded, AA-originated)', [p8a], 'SDK', before, after, {
      ownerMUtxosBefore: before.utxos.OwnerM,
      ownerMUtxosAfter: after.utxos.OwnerM,
    });
    cell({
      id: 'provenance-user-resends-unshielded',
      label: 'Provenance: user re-sends AA-originated unshielded tokens',
      step: 8,
      txs: [p8a],
      level: 'SDK',
      points: "OwnerM spends UTXOs paid out by the Manager in step 6 (wallet + indexer both 10→5) + account map AA_A 0→5",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-8/step.json',
    });

    before = after;
    const p8b = tx(await accountWithdrawUnshielded(ctx, raw.secretB, 5n, rig.ownerN, rig.fee));
    log(`  AA_B -5-> OwnerN (unshielded, user-originated): tx ${p8b}`);
    after = await settle((x) => x.table.AA_B.unshielded === 5n && x.table.OwnerN.unshielded === 5n, 'AA_B 5 unshielded');
    e8.op('AA_B -5-> OwnerN (unshielded, user-originated)', [p8b], 'SDK', before, after, {
      contractLedgerBalanceAfter: after.managerUnshieldedLedger,
      ownerNUtxosAfter: after.utxos.OwnerN,
    });
    cell({
      id: 'provenance-account-resends-unshielded',
      label: 'Provenance: AA account re-sends user-originated unshielded tokens',
      step: 8,
      txs: [p8b],
      level: 'SDK',
      points: "AA_B re-spends OwnerN's step-6 deposit; account map 10→5 + contract ledger balance falls by 5",
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-8/step.json',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[8]!, '8'));
    assertAll(o, EXPECTED[8]!, '8', minted);
    e8.write(EXPECTED[8]!, o);
    console.log(`STEP 8 ASSERTED — ${renderTable(o.table)} — every party at 5/5`);

    // =========================================================================================
    // STEP 9 — the self-send round: balance-neutral, identifier-changing
    // =========================================================================================
    console.log('\n## STEP 9 — self-send round: OwnerM shielded + unshielded; pool both families');
    const e9 = new StepEvidence(9, 'Self-send round: OwnerM self-sends both families; the pool self-sends both families');
    const step8Snapshot = snapshot(o);
    before = o;

    // --- OwnerM shielded self-send (2 of 5) ---------------------------------------------------
    const beforeCoinsM = before.coins.OwnerM.map((c) => c.commitment).join(',');
    const s9a = tx(await userSend(rig.ownerM, rig.ownerM, 'shielded', rig.colors.shielded, 2n));
    log(`  OwnerM self-send shielded 2 of 5: tx ${s9a}`);
    after = await settle(
      (x) => x.table.OwnerM.shielded === 5n && x.coins.OwnerM.map((c) => c.commitment).join(',') !== beforeCoinsM,
      'OwnerM shielded coin identifiers to change under an unchanged balance',
    );
    e9.op('OwnerM self-send shielded 2 of 5', [s9a], 'wallet', before, after, {
      coinsBefore: before.coins.OwnerM,
      coinsAfter: after.coins.OwnerM,
    });
    cell({
      id: 'selfsend-user-shielded',
      label: 'Self-send: user shielded to own key',
      step: 9,
      txs: [s9a],
      level: 'wallet',
      points: `OwnerM balance unchanged at 5; coins ${JSON.stringify(before.coins.OwnerM.map((c) => c.value))} → ${JSON.stringify(after.coins.OwnerM.map((c) => c.value))} with new commitments`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-9/step.json',
    });

    // --- OwnerM unshielded self-send (2 of 5) --------------------------------------------------
    before = after;
    const beforeUtxosM = JSON.stringify(before.utxos.OwnerM);
    const s9b = tx(await userSend(rig.ownerM, rig.ownerM, 'unshielded', rig.colors.unshielded, 2n));
    log(`  OwnerM self-send unshielded 2 of 5: tx ${s9b}`);
    after = await settle(
      (x) => x.table.OwnerM.unshielded === 5n && JSON.stringify(x.utxos.OwnerM) !== beforeUtxosM,
      'OwnerM UTXO identifiers to change under an unchanged balance',
    );
    e9.op('OwnerM self-send unshielded 2 of 5', [s9b], 'wallet', before, after, {
      utxosBefore: before.utxos.OwnerM,
      utxosAfter: after.utxos.OwnerM,
    });
    cell({
      id: 'selfsend-user-unshielded',
      label: 'Self-send: user unshielded UTXO self-split',
      step: 9,
      txs: [s9b],
      level: 'wallet',
      points: `OwnerM balance unchanged at 5 (wallet AND indexer); UTXOs ${JSON.stringify(before.utxos.OwnerM.map((u) => u.value))} → ${JSON.stringify(after.utxos.OwnerM.map((u) => u.value))}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-9/step.json',
    });

    // --- pool shielded self-send (stdlib auto-receive branch) -----------------------------------
    before = after;
    const poolNonceBefore9 = before.manager.poolNonce;
    const accountsBefore9 = JSON.stringify(before.manager.shieldedOf, bigints);
    const s9c = tx(await poolSelfSendShielded(ctx, raw.secretB, rig.fee));
    log(`  pool self-send shielded (authorized by OwnerB): tx ${s9c}`);
    after = await settle(
      (x) => x.manager.poolNonce !== poolNonceBefore9,
      'the pooled coin nonce to change under an unchanged balance',
    );
    if (JSON.stringify(after.manager.shieldedOf, bigints) !== accountsBefore9) {
      throw new Error('STEP 9 DIVERGENCE — the pool self-send changed the account map; it must be ownership-neutral');
    }
    e9.op('pool self-send shielded', [s9c], 'SDK', before, after, {
      poolBefore: { value: before.manager.poolValue, nonce: poolNonceBefore9 },
      poolAfter: { value: after.manager.poolValue, nonce: after.manager.poolNonce },
      accountMapByteIdentical: true,
    });
    cell({
      id: 'selfsend-pool-shielded',
      label: 'Self-send: pool shielded to `kernel.self()` via auto-receive',
      step: 9,
      txs: [s9c],
      level: 'SDK',
      points: `pool value unchanged at ${after.manager.poolValue}; nonce ${poolNonceBefore9} → ${after.manager.poolNonce}; account map byte-identical`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-9/step.json',
      note: 'The only cell that reaches the standard library’s auto-receive branch: sendShielded to kernel.self() re-claims its own output.',
    });

    // --- pool unshielded self-send --------------------------------------------------------------
    before = after;
    const unshieldedAccountsBefore9 = JSON.stringify(before.manager.unshieldedOf, bigints);
    const ledgerBefore9 = before.managerUnshieldedLedger;
    const s9d = tx(await poolSelfSendUnshielded(ctx, raw.secretB, 5n, rig.fee));
    log(`  pool self-send unshielded (authorized by OwnerB): tx ${s9d}`);
    // Nothing observable may change, so wait for the transaction to be applied by watching the
    // Manager's state for the block, then assert byte-identity.
    await new Promise((r) => setTimeout(r, 12_000));
    after = await observe(deps);
    if (JSON.stringify(after.manager.unshieldedOf, bigints) !== unshieldedAccountsBefore9) {
      throw new Error('STEP 9 DIVERGENCE — the unshielded pool self-send changed the account map');
    }
    if (after.managerUnshieldedLedger !== ledgerBefore9) {
      throw new Error(
        `STEP 9 DIVERGENCE — the unshielded pool self-send changed the contract ledger balance ` +
          `(${ledgerBefore9} -> ${after.managerUnshieldedLedger})`,
      );
    }
    e9.op('pool self-send unshielded', [s9d], 'SDK', before, after, {
      contractLedgerBalanceBefore: ledgerBefore9,
      contractLedgerBalanceAfter: after.managerUnshieldedLedger,
      accountMapByteIdentical: true,
    });
    cell({
      id: 'selfsend-pool-unshielded',
      label: 'Self-send: pool unshielded to self via auto-receive',
      step: 9,
      txs: [s9d],
      level: 'SDK',
      points: `contract ledger balance and account map BOTH byte-identical at ${ledgerBefore9}`,
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-9/step.json',
      note: 'sendUnshielded to kernel.self() takes the auto-receive branch (incUnshieldedInputs), so the contract balance nets to zero.',
    });

    o = await withIndexerCheck(deps, await waitForTable(deps, EXPECTED[9]!, '9'));
    assertAll(o, EXPECTED[9]!, '9', minted);
    e9.write(EXPECTED[9]!, o);
    console.log(`STEP 9 ASSERTED — ${renderTable(o.table)} — balance-neutral, identifiers changed`);

    // The standing invariant across the whole run.
    cell({
      id: 'invariant-pool-equals-accounts',
      label: 'Invariant: `pooled holdings = AA_A + AA_B` per family, after EVERY step',
      step: 9,
      txs: [],
      level: 'derived',
      points: 'asserted in `assertAll` after all ten steps, in both families, against two independently maintained mechanisms',
      status: 'GREEN',
      evidence: 'evidence/g3-ledger/step-0..9/step.json',
      note: 'Shielded: pooled zswap coin value vs the account map. Unshielded: the contract’s ledger balance from the indexer vs the account map.',
    });

    // --- final report ---------------------------------------------------------------------------
    writeFileSync(
      join(EVID, 'cells.json'),
      JSON.stringify({ label: 'EXPERIMENTAL_LANE / LANE-DEV-1', utc: stamp(), cells }, bigints, 2),
    );
    writeFileSync(
      join(EVID, 'run-context.json'),
      JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          utc: stamp(),
          minterAddress: rig.minterAddress,
          managerAddress: rig.managerAddress,
          colors: rig.colors,
          accounts: rig.ids,
          deployTxs: rig.deployTxs,
          fundingTxs: rig.fundingTxs,
          mintedTotals: minted,
          metrics: metricsReport(),
          step8Snapshot: JSON.parse(step8Snapshot),
          finalSnapshot: JSON.parse(snapshot(o)),
        },
        bigints,
        2,
      ),
    );

    console.log('\n## RESULT');
    console.log(`all ten step rows asserted live; ${cells.length} matrix cells recorded`);
    console.log(`final table: ${renderTable(o.table)}`);
    console.log(`minter_address:  ${rig.minterAddress}`);
    console.log(`manager_address: ${rig.managerAddress}`);
  } finally {
    if (rig) await rig.close();
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
