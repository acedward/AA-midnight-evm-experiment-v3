// Diagnostic: what does DEPLOYING each contract cost against the ledger's per-block limits?
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1. Runs entirely OFFLINE.
//
// WHY THIS EXISTS. Manager v4's first live deploy attempt was refused by the node with
//   1010: Invalid Transaction: Transaction would exhaust the block limits
// which is `FeeCalculation`'s `BlockLimitExceeded`: `Transaction::fees` computes a SyntheticCost and
// then `normalize`s it against `params.limits.block_limits`, and normalize returns `None` — killing
// fee calculation, and with it the transaction — the moment ANY ONE of the five cost dimensions
// exceeds its per-block ceiling (`base-crypto/src/cost_model.rs:277-297`).
//
// A refusal like that says nothing about which dimension, and guessing is how a project ends up
// deleting the wrong thing. `createUnprovenDeployTxFromVerifierKeys` needs only a ZK config provider
// and a coin public key, so the whole measurement can be made from the compiled artifacts with no
// chain, no wallet and no proof server — which also makes it fast enough to iterate against.
//
// Usage: tsx src/g2/diag-deploy-cost.ts [contract ...]     (default: manager minter minter-collide)
import { createUnprovenDeployTxFromVerifierKeys } from '@midnight-ntwrk/midnight-js-contracts';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import * as ledger from '@midnightntwrk/ledger-v9';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { compiledManager, compiledMinter, compiledMinterCollide } from '../contracts.js';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';

const COIN_PK = '0'.repeat(64);
const ENC_PK = '0'.repeat(64);

const compiled: Record<string, () => any> = {
  manager: compiledManager,
  minter: compiledMinter,
  'minter-collide': compiledMinterCollide,
};

/**
 * Wrap ANY compiled artifact directory under `generated-zk/` so a candidate contract shape can be
 * costed without being wired into `contracts.ts` first. This is what makes the deploy budget
 * iterable: compile a variant under its own name, measure it, keep or discard it — no chain, no
 * wallet, seconds per iteration.
 */
const loadArbitrary = async (name: string): Promise<() => any> => {
  const mod: any = await import(`../../generated-zk/${name}/contract/index.js`);
  const witnesses = (mod.Contract?.prototype ?? {}) && {
    localOwnerSecret: (ctx: any): [any, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
  };
  return () =>
    (CompiledContract.make as any)(`probe-${name}`, mod.Contract).pipe(
      (CompiledContract as any).withWitnesses(witnesses),
      (CompiledContract as any).withCompiledFileAssets(join(REPO_ROOT, 'harness', 'generated-zk', name)),
    );
};

const fmt = (n: number): string => n.toLocaleString('en-US');

/**
 * `INITIAL_LIMITS.block_limits`, read from the pinned ledger source
 * (`midnight-ledger/ledger/src/structure.rs:1271-1283`). The JS `LedgerParameters` does not expose
 * `limits`, only `normalizeFullness`, which throws when a ceiling is crossed but does not say WHICH
 * one — so the numbers are transcribed here to turn a thrown error into a diagnosis. The authoritative
 * verdict still comes from `normalizeFullness`; these values only attribute it.
 */
const BLOCK_LIMITS = {
  readTime: 1_000_000_000_000n, // CostDuration::SECOND, in picoseconds
  computeTime: 1_000_000_000_000n,
  blockUsage: 200_000n,
  bytesWritten: 50_000n,
  bytesChurned: 1_000_000n,
};

const main = async () => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const params = (ledger as any).LedgerParameters.initialParameters();

  console.log('# deploy cost against the ledger block limits — EXPERIMENTAL_LANE / LANE-DEV-1');
  console.log('# block limits (from midnight-ledger/ledger/src/structure.rs:1271-1283):');
  console.log(`#   ${JSON.stringify(BLOCK_LIMITS, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}`);
  console.log('# transaction_byte_limit: 1 MiB (same source) — not the binding constraint here');
  console.log('');

  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(compiled);
  for (const name of names) {
    let factory = compiled[name];
    if (!factory) {
      try {
        factory = await loadArbitrary(name);
      } catch (e) {
        console.log(`## ${name}: no compiled artifacts under generated-zk/${name} — ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
        continue;
      }
    }
    const zkDir = join(REPO_ROOT, 'harness', 'generated-zk', name);
    const keysDir = join(zkDir, 'keys');
    let vkBytes = 0;
    const perKey: Array<[string, number]> = [];
    try {
      for (const f of readdirSync(keysDir).sort()) {
        if (!f.endsWith('.verifier')) continue;
        const b = statSync(join(keysDir, f)).size;
        vkBytes += b;
        perKey.push([f.replace('.verifier', ''), b]);
      }
    } catch {
      /* reported below as zero */
    }

    console.log(`## ${name}`);
    console.log(`   verifier keys: ${perKey.length}, ${fmt(vkBytes)} bytes total`);

    try {
      const zk = new NodeZkConfigProvider(zkDir);
      const built: any = await (createUnprovenDeployTxFromVerifierKeys as any)(
        zk,
        COIN_PK,
        { compiledContract: factory(), ...(name.startsWith('minter') ? { args: [new Uint8Array(32)] } : {}) },
        ENC_PK,
      );
      const tx = built.private?.unprovenTx ?? built.unprovenTx ?? built.public?.tx;
      if (!tx) {
        console.log(`   could not locate the unproven transaction on the result: ${Object.keys(built).join(', ')}`);
        continue;
      }
      const bytes = tx.serialize().length;
      console.log(`   unproven deploy transaction: ${fmt(bytes)} bytes`);

      const cost = tx.cost(params, false);
      const dims: Array<[string, bigint, bigint]> = [
        ['readTime', BigInt(cost.readTime ?? 0), BLOCK_LIMITS.readTime],
        ['computeTime', BigInt(cost.computeTime ?? 0), BLOCK_LIMITS.computeTime],
        ['blockUsage', BigInt(cost.blockUsage ?? 0), BLOCK_LIMITS.blockUsage],
        ['bytesWritten', BigInt(cost.bytesWritten ?? 0), BLOCK_LIMITS.bytesWritten],
        ['bytesChurned', BigInt(cost.bytesChurned ?? 0), BLOCK_LIMITS.bytesChurned],
      ];
      console.log('   | dimension | cost | block limit | ratio | verdict |');
      console.log('   |---|---|---|---|---|');
      const over: string[] = [];
      for (const [label, c, l] of dims) {
        const ratio = Number(c) / Number(l);
        const bad = c > l;
        if (bad) over.push(label);
        console.log(
          `   | ${label} | ${fmt(Number(c))} | ${fmt(Number(l))} | ${(ratio * 100).toFixed(1)}% | ${bad ? '**OVER**' : 'ok'} |`,
        );
      }
      // The authoritative check: `normalizeFullness` throws exactly when `normalize` returns None.
      let normalizes: string;
      try {
        params.normalizeFullness(cost);
        normalizes = 'normalizeFullness: OK';
      } catch (e) {
        normalizes = `normalizeFullness THREW: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`;
      }
      console.log(`   ${normalizes}`);
      if (over.length > 0) {
        console.log(`   => OVER on: ${over.join(', ')}.`);
        console.log('      `normalize()` returns None, fee calculation fails with BlockLimitExceeded, and');
        console.log('      the node refuses the deploy with "Transaction would exhaust the block limits".');
      } else {
        console.log('   => within every block limit.');
      }
      try {
        console.log(`   fees: ${String(tx.fees(params))} SPECKs`);
      } catch (e) {
        console.log(`   fees: unavailable — ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
      }
    } catch (e) {
      console.log(`   FAILED to build or cost the deploy transaction: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    }

    console.log('   per-circuit verifier keys:');
    for (const [k, b] of perKey.sort((a, b) => b[1] - a[1])) console.log(`     ${String(b).padStart(6)}  ${k}`);
    console.log('');
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
