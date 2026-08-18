// G3 Step 0 (part 1) — deploy Minter and Manager on the live pinned lane.
//
// This is also the outstanding check of LANE-DEV-1: artifacts produced by `compactc 0.33.0` must
// be ACCEPTED ON-CHAIN by the pinned ledger-9.1.0.0-rc.3 node. A successful deploy plus a real
// circuit call is that proof.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { makeProviders } from './providers.js';

// @ts-ignore — generated artifact
import { Contract as MinterContract } from '../../generated-zk/minter/contract/index.js';
// @ts-ignore — generated artifact
import { Contract as ManagerContract } from '../../generated-zk/manager/contract/index.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);

const main = async () => {
  console.log(`# G3 deploy — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  setNetworkId(NetworkId.NetworkId.Undeployed as any);

  const psDir = mkdtempSync(join(tmpdir(), 'aa00003-ps-'));
  log(`private-state dir: ${psDir}`);

  const parties: Party[] = [];
  try {
    // The fee payer funds every deployment; demo colors never pay fees.
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    await (fee.wallet as any).waitForSyncedState();
    log('feePayer synced');

    log('deploying Minter …');
    const minter = await deployContract(makeProviders(fee, 'minter', psDir), {
      contract: new MinterContract({}),
      privateStateId: 'minter',
      initialPrivateState: {},
    } as any);
    const minterAddr = minter.deployTxData.public.contractAddress;
    log(`Minter deployed at ${minterAddr}`);
    log(`  deploy tx: ${minter.deployTxData.public.txId ?? minter.deployTxData.public.txHash ?? '(id not exposed)'}`);

    log('deploying Manager …');
    const managerWitnesses = {
      localOwnerSecret: (ctx: any): [any, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
    };
    const manager = await deployContract(makeProviders(fee, 'manager', psDir), {
      contract: new ManagerContract(managerWitnesses),
      privateStateId: 'manager',
      initialPrivateState: { ownerSecret: new Uint8Array(32) },
    } as any);
    const managerAddr = manager.deployTxData.public.contractAddress;
    log(`Manager deployed at ${managerAddr}`);

    console.log('\n## RESULT');
    console.log(`minter_address:  ${minterAddr}`);
    console.log(`manager_address: ${managerAddr}`);
    console.log('\nLANE-DEV-1 on-chain check: artifacts from compactc 0.33.0 ACCEPTED by ledger-9.1.0.0-rc.3');
  } finally {
    for (const p of parties) await closeParty(p);
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
