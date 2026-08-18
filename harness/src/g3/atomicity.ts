// G3 — atomicity probes, one per family (spec Edge Cases, FR-007, SC-003).
//
// The property under test: when a transaction performs a token operation AND an assertion in it
// fails, NEITHER the token effect NOR the account-state change may survive.
//
// HOW, AND WHY IT IS DONE THIS WAY. A circuit that asserts unconditionally after its token
// operation can never be *built* on this toolchain — the assert fires during local circuit
// execution, so no transaction ever exists and nothing about on-chain atomicity would be shown.
// The probe therefore uses a DEFERRED failure, which is the only way to get a real transaction
// onto the node with a failing assertion inside it:
//
//   1. build, prove and balance `withdraw*` for the FULL balance of AA_A — valid against the
//      state as it stands, and its transcript records reading AA_A's balance as 10;
//   2. move that state underneath it: an internal transfer empties AA_A into AA_B, submitted from
//      a DIFFERENT wallet so the prepared transaction's own fee inputs are untouched and the
//      rejection can only be about the assertion;
//   3. submit the prepared transaction. On replay the recorded read no longer matches the chain,
//      the balance assertion fails, and the fallible section is rejected.
//
// The harness then proves the pooled coin (value AND nonce), the contract's unshielded ledger
// balance, the account map and every wallet balance are byte-identical to the pre-submission
// state — i.e. the token operation left nothing behind.
//
// Intra-circuit ordering (guards evaluated before effects) is a separate property and is already
// covered by the G2 simulator suites; this probe is about transaction application on the node.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, type Rig } from './setup.js';
import {
  mintShieldedToAccount,
  mintUnshieldedToAccount,
  prepareCall,
  shieldedToUser,
  submitPrepared,
  unshieldedToUser,
} from './actions.js';
import type { CallSpec } from './compose.js';
import { observe, snapshot, waitUntil, type Observation } from './table.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

type ProbeResult = {
  family: 'shielded' | 'unshielded';
  preparedFor: string;
  displacingTx: string;
  submission: { accepted: boolean; txIdOrError: string };
  stateUnchanged: boolean;
  before: unknown;
  after: unknown;
  status: 'GREEN' | 'RED';
};

const probes: ProbeResult[] = [];

const main = async () => {
  console.log(`# G3 ATOMICITY PROBES — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;

  try {
    rig = await bootstrap();
    const { ctx, deps, raw } = rig;

    // The displacing transfer is authorized by OwnerA's witness but submitted through OwnerN's
    // providers, so it spends OwnerN's DUST rather than the fee wallet's — the prepared probe
    // transaction's inputs stay valid and the only thing that changes is AA_A's balance.
    const displaceSpec = (shieldedFamily: boolean): CallSpec => ({
      providers: rig!.managerN,
      compiledContract: ctx.compiledManager(),
      contractAddress: ctx.managerAddress,
      circuitId: 'transferInternal',
      args: [raw.idB, shieldedFamily, 10n],
      privateStateId: 'manager',
    });

    for (const family of ['shielded', 'unshielded'] as const) {
      console.log(`\n## ${family} atomicity probe`);

      // --- fixture: AA_A holds 10 of this family ------------------------------------------------
      log(`fixture: minting ${family} 10 -> AA_A`);
      if (family === 'shielded') await mintShieldedToAccount(ctx, 10n, raw.idA, rig.fee);
      else await mintUnshieldedToAccount(ctx, 10n, raw.idA, rig.fee);
      await waitUntil(
        deps,
        (x: Observation) => (family === 'shielded' ? x.table.AA_A.shielded : x.table.AA_A.unshielded) === 10n,
        `AA_A at 10 ${family}`,
      );

      // --- 1. prepare the withdrawal against the CURRENT state -----------------------------------
      await ctx.actAs(ctx.managerFee, raw.secretA);
      const coinPk = rig.ownerM.shieldedSecretKeys.coinPublicKey;
      const ownerMAddr = String((await (rig.ownerM.wallet as any).unshielded.getAddress()).hexString);
      const withdrawSpec: CallSpec =
        family === 'shielded'
          ? {
              providers: ctx.managerFee,
              compiledContract: ctx.compiledManager(),
              contractAddress: ctx.managerAddress,
              circuitId: 'withdrawShielded',
              args: [10n, shieldedToUser(coinPk)],
              privateStateId: 'manager',
              encMappings: new Map<unknown, unknown>([[coinPk, rig.ownerM.shieldedSecretKeys.encryptionPublicKey]]),
            }
          : {
              providers: ctx.managerFee,
              compiledContract: ctx.compiledManager(),
              contractAddress: ctx.managerAddress,
              circuitId: 'withdrawUnshielded',
              args: [ctx.unshieldedColor, 10n, unshieldedToUser(ownerMAddr)],
              privateStateId: 'manager',
            };
      log('  preparing the full-balance withdrawal (valid right now, and NOT submitted) …');
      const prepared = await prepareCall(withdrawSpec);

      // --- 2. move the state underneath it -------------------------------------------------------
      await ctx.actAs(rig.managerN, raw.secretA);
      log('  displacing: internal transfer empties AA_A into AA_B (submitted by OwnerN) …');
      const displaceTx = await submitPrepared(displaceSpec(family === 'shielded'), await prepareCall(displaceSpec(family === 'shielded')));
      const displaced = await waitUntil(
        deps,
        (x: Observation) => (family === 'shielded' ? x.table.AA_A.shielded : x.table.AA_A.unshielded) === 0n,
        `AA_A emptied by the displacing transfer (${displaceTx})`,
      );
      const beforeSnap = snapshot(displaced);

      // --- 3. submit the now-stale withdrawal ----------------------------------------------------
      log('  submitting the stale withdrawal — its recorded balance read no longer matches the chain …');
      let accepted = false;
      let txIdOrError = '';
      try {
        txIdOrError = await submitPrepared(withdrawSpec, prepared);
        accepted = true;
        log(`  node accepted the transaction for inclusion: ${txIdOrError}`);
      } catch (e) {
        txIdOrError = (e instanceof Error ? e.message : String(e)).split('\n')[0]!.slice(0, 400);
        log(`  rejected at submission: ${txIdOrError}`);
      }

      // Whether the node refused it outright or included it and rolled the fallible section back,
      // the assertion is the same: nothing may have survived.
      await new Promise((r) => setTimeout(r, 20_000));
      const after = await observe(deps);
      const afterSnap = snapshot(after);
      const unchanged = beforeSnap === afterSnap;

      probes.push({
        family,
        preparedFor: `withdraw${family === 'shielded' ? 'Shielded' : 'Unshielded'}(10) authorized by OwnerA, prepared while AA_A held 10`,
        displacingTx: displaceTx,
        submission: { accepted, txIdOrError },
        stateUnchanged: unchanged,
        before: JSON.parse(beforeSnap),
        after: JSON.parse(afterSnap),
        status: unchanged ? 'GREEN' : 'RED',
      });

      console.log(`  ${unchanged ? 'GREEN' : 'RED  '} ${family}: neither the token effect nor the account-state change survived`);
      if (!unchanged) {
        console.log(`    BEFORE ${beforeSnap}`);
        console.log(`    AFTER  ${afterSnap}`);
      }
    }

    writeFileSync(
      join(EVID, 'atomicity.json'),
      JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          utc: stamp(),
          method:
            'deferred failure: a full-balance withdrawal is prepared against a state where the account holds the funds, ' +
            'the account is then emptied by an internal transfer submitted from a different wallet, and the stale ' +
            'withdrawal is submitted. Its recorded balance read no longer matches the chain, so the assertion fails ' +
            'on replay.',
          minterAddress: rig.minterAddress,
          managerAddress: rig.managerAddress,
          probes,
        },
        (_k, v) => (typeof v === 'bigint' ? `${v}` : v),
        2,
      ),
    );

    const red = probes.filter((p) => p.status === 'RED');
    console.log('\n## RESULT');
    for (const p of probes) {
      console.log(`  ${p.status.padEnd(5)} ${p.family}: state and funds unchanged = ${p.stateUnchanged}`);
    }
    if (red.length > 0) {
      console.error(`\n${red.length} atomicity probe(s) left an effect behind — that is a real failure`);
      process.exitCode = 1;
      return;
    }
    console.log('\nboth atomicity probes passed: no token effect and no account-state change survived');
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
