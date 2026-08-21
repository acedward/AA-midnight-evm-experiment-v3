// Diagnostic: measure the BALANCED Manager deploy transaction against the node's weight check, live.
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// WHY. Manager v4's first live deploy was refused with
//   1010: Invalid Transaction: Transaction would exhaust the block limits
// which comes from `pallet-midnight`'s own early weight check
// (`midnight-node/pallets/midnight/src/lib.rs:536-561` -> `InvalidTransaction::ExhaustsResources`).
// The weight of a midnight extrinsic is NOT its byte length: it is
//   gas = max(normalized cost over the five dimensions) * max_block_weight
// (`midnight-node/ledger/src/versions/common/mod.rs:765-785` and `:1165-1177`), and the check refuses
// when the running block weight plus this extrinsic exceeds the Normal dispatch class's ceiling —
// `NORMAL_DISPATCH_RATIO = 75%` of `max_block` (`midnight-node/runtime/src/lib.rs:307`).
//
// TWO HYPOTHESES, and this script exists to separate them:
//
//   HARD       Manager v4's own cost now exceeds the class ceiling on its own, so no amount of
//              waiting or retrying will ever land it. The fix is to make the contract cheaper.
//   TRANSIENT  the deploy is affordable but arrived while the block already carried other weight
//              (the run before it had just submitted a DUST registration). The fix is to retry with
//              spacing — and the failure says nothing about the contract at all.
//
// `diag-deploy-cost.ts` already measured the UNBALANCED deploy offline: 64.3% of `bytesWritten`, the
// dominant dimension, with everything else under 14%. What is missing is the BALANCED figure, because
// what actually gets submitted is `merge(deploy tx, the fee wallet's balancing tx)` and the balancing
// side writes dust and zswap state of its own. So this script wraps `submitTx`, prints the real
// submitted transaction's five dimensions and its gas-vs-ceiling ratio, and then tries the deploy
// several times with spacing so a transient failure is visible as one.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import * as ledger from '@midnightntwrk/ledger-v9';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LANE_STAMP, SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { fundWithNight, log, registerForDust, syncedState, units } from '../night.js';
import { makeProviders } from '../g3/providers.js';
import { errorChain } from '../g3/actions.js';
import { compiledManager, compiledMinter } from '../contracts.js';

/** `INITIAL_LIMITS.block_limits` — `midnight-ledger/ledger/src/structure.rs:1271-1283`. */
const BLOCK_LIMITS: Record<string, bigint> = {
  readTime: 1_000_000_000_000n,
  computeTime: 1_000_000_000_000n,
  blockUsage: 200_000n,
  bytesWritten: 50_000n,
  bytesChurned: 1_000_000n,
};
/** `NORMAL_DISPATCH_RATIO` — `midnight-node/runtime/src/lib.rs:307`. */
const NORMAL_DISPATCH_RATIO = 0.75;

const ATTEMPTS = Number(process.env.DIAG_ATTEMPTS ?? 4);
const SPACING_MS = Number(process.env.DIAG_SPACING_MS ?? 20_000);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const describeCost = (label: string, tx: any): Record<string, unknown> => {
  const params = (ledger as any).LedgerParameters.initialParameters();
  const out: Record<string, unknown> = { label };
  try {
    out.bytes = tx.serialize().length;
  } catch {
    /* not fatal for a diagnostic */
  }
  for (const enforce of [false, true]) {
    try {
      const cost = tx.cost(params, enforce);
      const dims: Record<string, string> = {};
      let max = 0;
      for (const [k, limit] of Object.entries(BLOCK_LIMITS)) {
        const v = BigInt((cost as any)[k] ?? 0);
        const ratio = Number(v) / Number(limit);
        if (ratio > max) max = ratio;
        dims[k] = `${v} / ${limit} = ${(ratio * 100).toFixed(1)}%`;
      }
      out[`cost_enforceTimeToDismiss_${enforce}`] = dims;
      out[`maxRatio_${enforce}`] = `${(max * 100).toFixed(1)}%`;
      out[`fitsNormalClass_${enforce}`] = max <= NORMAL_DISPATCH_RATIO;
      out[`headroomToNormalCeiling_${enforce}`] = `${((NORMAL_DISPATCH_RATIO - max) * 100).toFixed(1)} percentage points`;
    } catch (e) {
      out[`cost_enforceTimeToDismiss_${enforce}`] = `unavailable: ${errorChain(e)}`;
    }
  }
  return out;
};

const main = async () => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  console.log(`# DIAG deploy-live — ${LANE_STAMP}`);
  console.log(`# gas = max(normalized cost) * max_block_weight; Normal class ceiling = ${NORMAL_DISPATCH_RATIO * 100}% of max_block`);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00006-diag-'));
  const opened: Party[] = [];
  const close = async () => {
    for (const p of opened) await closeParty(p);
    try {
      rmSync(psDir, { recursive: true, force: true });
    } catch {
      /* teardown must not mask the result */
    }
  };

  try {
    const genesis = await openParty('genesis', SEEDS.genesis);
    opened.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    opened.push(fee);
    await syncedState(genesis);
    await fundWithNight(genesis, fee, units(2_000_000n));
    await registerForDust(fee);

    const measured: Array<Record<string, unknown>> = [];
    const providers = makeProviders(fee, 'manager', psDir);
    const realSubmit = providers.midnightProvider.submitTx;
    providers.midnightProvider.submitTx = async (tx: any) => {
      const d = describeCost('BALANCED manager deploy (as submitted)', tx);
      measured.push(d);
      console.log(`\n--- ${d.label}`);
      console.log(JSON.stringify(d, null, 2));
      return realSubmit(tx);
    };

    // A Minter deploy for scale: it is known-good on this lane (00004/00005 deployed five of them),
    // so it calibrates the reading rather than leaving "64%" as a number with no reference.
    const minterProviders = makeProviders(fee, 'minter-diag', psDir, join(process.cwd(), 'generated-zk', 'minter'));
    const realMinterSubmit = minterProviders.midnightProvider.submitTx;
    minterProviders.midnightProvider.submitTx = async (tx: any) => {
      const d = describeCost('BALANCED minter deploy (known-good reference)', tx);
      measured.push(d);
      console.log(`\n--- ${d.label}`);
      console.log(JSON.stringify(d, null, 2));
      return realMinterSubmit(tx);
    };
    try {
      const m: any = await deployContract(minterProviders, {
        compiledContract: compiledMinter(),
        args: [new Uint8Array(32)],
      } as any);
      console.log(`minter deployed at ${m.deployTxData.public.contractAddress}`);
    } catch (e) {
      console.log(`minter deploy FAILED: ${errorChain(e)}`);
    }

    let ok = false;
    const failures: string[] = [];
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      console.log(`\n## Manager v4 deploy attempt ${attempt}/${ATTEMPTS}`);
      try {
        const deployed: any = await deployContract(providers, {
          compiledContract: compiledManager(),
          privateStateId: 'manager',
          initialPrivateState: { ownerSecret: new Uint8Array(32) },
        } as any);
        console.log(`DEPLOYED at ${deployed.deployTxData.public.contractAddress} on attempt ${attempt}`);
        ok = true;
        break;
      } catch (e) {
        const err = errorChain(e);
        failures.push(`attempt ${attempt}: ${err}`);
        console.log(`attempt ${attempt} FAILED: ${err}`);
        if (attempt < ATTEMPTS) {
          log(`waiting ${SPACING_MS / 1000}s so the next attempt lands in a quieter block`);
          await sleep(SPACING_MS);
        }
      }
    }

    console.log('\n## VERDICT');
    if (ok) {
      console.log(`TRANSIENT: the Manager v4 deploy SUCCEEDED after ${failures.length} failure(s).`);
      console.log('The earlier refusal was block pressure, not contract size. The fix is spacing/retry.');
    } else {
      console.log(`HARD (as far as ${ATTEMPTS} spaced attempts can tell): every attempt was refused.`);
      console.log('If the measured maxRatio above is at or above the Normal-class ceiling, the contract');
      console.log('itself is too expensive to deploy at these pins and must be made cheaper.');
    }
    for (const f of failures) console.log(`  ${f}`);
    console.log('\n## measurements');
    console.log(JSON.stringify(measured, null, 2));
  } finally {
    await close();
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
