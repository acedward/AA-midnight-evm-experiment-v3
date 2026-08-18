// G3 — negative controls (spec Edge Cases, FR-007, SC-003).
//
// Every control must prove BOTH that the operation is rejected AND that state and funds are
// unchanged, and the harness itself must exit ZERO when the expected rejections all happen.
//
//   1. omitted claim, shielded    — a mint into the Manager with the Manager's receive call left out
//   2. omitted claim, unshielded  — the same on the unshielded side
//   3. wrong-owner witness        — OwnerB's key cannot reach AA_A's balance, even though the POOL
//                                   holds enough: the debited account is derived from the witness
//                                   and is never a caller-supplied parameter
//   4. unregistered witness       — a key that opens no registered account is refused outright
//   5. per-account overdraw       — an account may not spend more than it owns even when the pool
//                                   holds more (the ownership-integrity case)
//
// Where a control is rejected matters and is recorded per control: an omitted claim survives local
// construction and is refused when the transaction is assembled/submitted, whereas an owner or
// balance guard is a circuit `assert` and refuses at circuit execution, so no transaction is ever
// built. Both are real refusals; the evidence says which, rather than blurring them.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, type Rig } from './setup.js';
import {
  accountWithdrawShielded,
  mintShieldedToAccount,
  mintToManagerWithoutClaim,
  mintUnshieldedToAccount,
} from './actions.js';
import { observe, snapshot, waitUntil, type Observation } from './table.js';
import { unshieldedSeedOf } from '../wallet.js';
import { SEEDS } from '../lane.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

export type ControlResult = {
  id: string;
  label: string;
  expectation: string;
  rejectedAt: 'circuit execution (no transaction built)' | 'transaction assembly / submission';
  reason: string;
  stateUnchanged: boolean;
  fundsUnchanged: boolean;
  status: 'GREEN' | 'RED';
};

const results: ControlResult[] = [];

/**
 * Run `attempt`, require it to throw, and require the full observation — account map, pooled coin
 * (value AND nonce), the contract's unshielded ledger balance, and every wallet's coins/UTXOs — to
 * be byte-identical before and after.
 */
const expectRejection = async (
  deps: any,
  id: string,
  label: string,
  expectation: string,
  rejectedAt: ControlResult['rejectedAt'],
  attempt: () => Promise<string>,
): Promise<void> => {
  const before = await observe(deps);
  const beforeSnap = snapshot(before);
  let reason = '';
  let rejected = false;
  try {
    const txId = await attempt();
    reason = `NOT REJECTED — the operation was accepted and returned tx ${txId}`;
  } catch (e) {
    rejected = true;
    reason = e instanceof Error ? e.message : String(e);
  }

  // Give the chain a chance to apply anything that might (wrongly) have gone through, so
  // "unchanged" is a real observation rather than a race we won.
  await new Promise((r) => setTimeout(r, 12_000));
  const after = await observe(deps);
  const afterSnap = snapshot(after);
  const unchanged = beforeSnap === afterSnap;

  results.push({
    id,
    label,
    expectation,
    rejectedAt,
    reason: reason.split('\n')[0]!.slice(0, 400),
    stateUnchanged: unchanged,
    fundsUnchanged: unchanged,
    status: rejected && unchanged ? 'GREEN' : 'RED',
  });
  console.log(`  ${rejected && unchanged ? 'GREEN' : 'RED  '} ${id} — ${reason.split('\n')[0]!.slice(0, 160)}`);
  if (!unchanged) {
    console.log(`    BEFORE ${beforeSnap}`);
    console.log(`    AFTER  ${afterSnap}`);
  }
};

const main = async () => {
  console.log(`# G3 NEGATIVE CONTROLS — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;

  try {
    rig = await bootstrap();
    const { ctx, deps, raw } = rig;

    // --- fixture: AA_A holds 10 shielded, AA_B holds nothing; the pool therefore holds 10 --------
    log('fixture: minting shielded 10 -> AA_A');
    await mintShieldedToAccount(ctx, 10n, raw.idA, rig.fee);
    await waitUntil(deps, (x: Observation) => x.table.AA_A.shielded === 10n, 'AA_A at 10 shielded');

    // --- 3. wrong-owner witness ------------------------------------------------------------------
    // OwnerB authorizes a withdrawal while AA_B holds 0 and the POOL holds 10. The Manager derives
    // the debited account from the witness, so OwnerB is acting as AA_B and cannot reach AA_A's
    // balance — the pool being rich enough is irrelevant.
    await expectRejection(
      deps,
      'wrong-owner-witness',
      "Wrong-owner witness: OwnerB's key cannot spend AA_A's balance",
      "rejected with 'account shielded balance too low' — AA_B owns 0 while the pool holds 10",
      'circuit execution (no transaction built)',
      () => accountWithdrawShielded(ctx, raw.secretB, 5n, rig!.ownerM, rig!.fee),
    );

    // --- 4. unregistered witness -------------------------------------------------------------------
    await expectRejection(
      deps,
      'unregistered-witness',
      'A witness that opens no registered account is refused',
      "rejected with 'caller\\'s owner witness matches no registered account'",
      'circuit execution (no transaction built)',
      () => accountWithdrawShielded(ctx, unshieldedSeedOf(SEEDS.ownerN), 1n, rig!.ownerM, rig!.fee),
    );

    // --- 1. omitted claim, shielded ----------------------------------------------------------------
    // The stdlib auto-receives only for kernel.self(), so a mint INTO the Manager without the
    // Manager's paired receive call has no one to claim the coin.
    await expectRejection(
      deps,
      'omitted-claim-shielded',
      'Mint shielded into the Manager with the receive call omitted',
      'rejected as imbalanced; no account credited and the pool untouched',
      'transaction assembly / submission',
      () => mintToManagerWithoutClaim(ctx, 'shielded', 10n),
    );

    // --- 2. omitted claim, unshielded ---------------------------------------------------------------
    await expectRejection(
      deps,
      'omitted-claim-unshielded',
      'Mint unshielded into the Manager with the receive call omitted',
      'rejected as imbalanced; no account credited and the ledger balance untouched',
      'transaction assembly / submission',
      () => mintToManagerWithoutClaim(ctx, 'unshielded', 10n),
    );

    // --- 5. per-account overdraw with a SUFFICIENT pool ----------------------------------------------
    // Credit AA_B too, so the pool holds 20 while AA_A still owns only 10. A 15 withdrawal by
    // OwnerA is well within the pool and must still be refused by the per-account guard.
    log('fixture: minting shielded 10 -> AA_B so the pool (20) exceeds AA_A (10)');
    await mintShieldedToAccount(ctx, 10n, raw.idB, rig.fee);
    const funded = await waitUntil(
      deps,
      (x: Observation) => x.manager.poolValue === 20n && x.table.AA_A.shielded === 10n,
      'pool at 20 with AA_A still at 10',
    );
    log(`  pool=${funded.manager.poolValue}, AA_A=${funded.table.AA_A.shielded}, AA_B=${funded.table.AA_B.shielded}`);

    await expectRejection(
      deps,
      'per-account-overdraw',
      'Per-account overdraw while the pool holds MORE than the requested amount',
      "rejected with 'account shielded balance too low' — AA_A owns 10, requested 15, pool holds 20",
      'circuit execution (no transaction built)',
      () => accountWithdrawShielded(ctx, raw.secretA, 15n, rig!.ownerM, rig!.fee),
    );

    // --- report ---------------------------------------------------------------------------------------
    writeFileSync(
      join(EVID, 'negative-controls.json'),
      JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          utc: stamp(),
          minterAddress: rig.minterAddress,
          managerAddress: rig.managerAddress,
          accounts: rig.ids,
          controls: results,
        },
        (_k, v) => (typeof v === 'bigint' ? `${v}` : v),
        2,
      ),
    );

    const red = results.filter((r) => r.status === 'RED');
    console.log('\n## RESULT');
    for (const r of results) console.log(`  ${r.status.padEnd(5)} ${r.id}: ${r.expectation}`);
    if (red.length > 0) {
      console.error(`\n${red.length} negative control(s) did not behave as the specification requires`);
      process.exitCode = 1;
      return;
    }
    console.log(`\nall ${results.length} negative controls passed with state AND funds proven unchanged`);
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
