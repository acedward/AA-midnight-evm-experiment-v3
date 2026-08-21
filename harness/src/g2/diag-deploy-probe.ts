// Diagnostic: WHERE is the deploy ceiling? Deploy a bracket of contract variants on one stack.
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// WHY. Manager v4 (14 verifier keys, `bytesWritten` = 64.3% of the per-block ceiling) is refused
// 4/4 with `Transaction would exhaust the block limits`, while Manager v3 (12 keys, 55.1%) deployed
// fine throughout project 00005 and a Minter (4 keys, 22.7%) deploys fine here. So a ceiling exists
// somewhere between 55% and 64%, and the DESIGN depends on where: "free one circuit" and "free two"
// are different contracts.
//
// Guessing the accounting from the node's source got as far as "gas = max(normalized cost) *
// max_block_weight, checked against the Normal dispatch class" and no further — the arithmetic says
// 64.7% should fit under a 75% ceiling and it demonstrably does not, so something in the block's
// running weight is unaccounted for. Rather than keep reading, measure: several variants, one funded
// stack, one answer.
//
// Usage: tsx src/g2/diag-deploy-probe.ts <contract-name> [contract-name ...]
// Each name must have artifacts under `harness/generated-zk/<name>/`.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import * as ledger from '@midnightntwrk/ledger-v9';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { fundWithNight, log, registerForDust, syncedState, units } from '../night.js';
import { makeProviders } from '../g3/providers.js';
import { errorChain } from '../g3/actions.js';

const BYTES_WRITTEN_LIMIT = 50_000;

const keyBytes = (name: string): { count: number; bytes: number } => {
  const dir = join(REPO_ROOT, 'harness', 'generated-zk', name, 'keys');
  let bytes = 0;
  let count = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.verifier')) continue;
    bytes += statSync(join(dir, f)).size;
    count += 1;
  }
  return { count, bytes };
};

const main = async () => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const names = process.argv.slice(2);
  if (names.length === 0) throw new Error('usage: diag-deploy-probe.ts <contract-name> ...');
  console.log(`# DIAG deploy-probe — ${LANE_STAMP}`);
  console.log(`# probing: ${names.join(', ')}`);

  const psDir = mkdtempSync(join(tmpdir(), 'aa00006-probe-'));
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

    const params = (ledger as any).LedgerParameters.initialParameters();
    const rows: Array<Record<string, unknown>> = [];

    for (const name of names) {
      const zk = join(REPO_ROOT, 'harness', 'generated-zk', name);
      const keys = keyBytes(name);
      const mod: any = await import(`../../generated-zk/${name}/contract/index.js`);
      const compiledContract = (CompiledContract.make as any)(`probe-${name}`, mod.Contract).pipe(
        (CompiledContract as any).withWitnesses({
          localOwnerSecret: (ctx: any): [any, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
        }),
        (CompiledContract as any).withCompiledFileAssets(zk),
      );
      const providers = makeProviders(fee, `probe-${name}`, psDir, zk);
      let submittedBytesWritten = 0;
      const realSubmit = providers.midnightProvider.submitTx;
      providers.midnightProvider.submitTx = async (tx: any) => {
        try {
          submittedBytesWritten = Number(tx.cost(params, true).bytesWritten ?? 0);
        } catch {
          /* diagnostics only */
        }
        return realSubmit(tx);
      };

      console.log(`\n## ${name} — ${keys.count} verifier keys, ${keys.bytes} bytes of keys`);
      let ok = false;
      let error: string | undefined;
      try {
        const d: any = await deployContract(providers, {
          compiledContract,
          privateStateId: `probe-${name}`,
          initialPrivateState: { ownerSecret: new Uint8Array(32) },
        } as any);
        ok = true;
        console.log(`   DEPLOYED at ${d.deployTxData.public.contractAddress}`);
      } catch (e) {
        error = errorChain(e);
        console.log(`   REFUSED: ${error}`);
      }
      const pct = ((submittedBytesWritten / BYTES_WRITTEN_LIMIT) * 100).toFixed(1);
      console.log(`   submitted bytesWritten: ${submittedBytesWritten} / ${BYTES_WRITTEN_LIMIT} = ${pct}%`);
      rows.push({ name, keys: keys.count, keyBytes: keys.bytes, bytesWritten: submittedBytesWritten, pct, deployed: ok, error });
      log('pausing 15s so the next probe lands in a fresh block');
      await new Promise((r) => setTimeout(r, 15_000));
    }

    console.log('\n## RESULT');
    console.log('| contract | keys | key bytes | submitted bytesWritten | % of ceiling | deployed |');
    console.log('|---|---|---|---|---|---|');
    for (const r of rows) {
      console.log(`| ${r.name} | ${r.keys} | ${r.keyBytes} | ${r.bytesWritten} | ${r.pct}% | ${r.deployed ? 'YES' : '**NO**'} |`);
    }
    const pass = rows.filter((r) => r.deployed).map((r) => Number(r.pct));
    const fail = rows.filter((r) => !r.deployed).map((r) => Number(r.pct));
    if (pass.length && fail.length) {
      console.log(`\nCEILING is between ${Math.max(...pass)}% (largest that deployed) and ${Math.min(...fail)}% (smallest refused).`);
    } else if (pass.length) {
      console.log(`\nEvery probe deployed; the ceiling is above ${Math.max(...pass)}%.`);
    } else {
      console.log(`\nEvery probe was refused; the ceiling is below ${Math.min(...fail)}%.`);
    }
    console.log(JSON.stringify(rows, null, 2));
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
