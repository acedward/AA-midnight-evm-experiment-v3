// G3 Step 0 — deploy Minter + Manager, bind the Manager to the Minter's colors, register
// AA_A (OwnerA) and AA_B (OwnerB), and assert the empty baseline table.
//
// Spec step 0 expects: AA_A 0/0, OwnerN 0/0, AA_B 0/0, OwnerM 0/0, and pool = AA_A + AA_B = 0.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { compiledManager, compiledMinter } from './contracts.js';
import { ManagerSim } from '../test/sim.js';
import { assertPoolInvariant, readManager } from './observe.js';
import { makeProviders } from './providers.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

const main = async () => {
  console.log(`# G3 step 0 — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00003-ps-'));

  const parties: Party[] = [];
  try {
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    await (fee.wallet as any).waitForSyncedState();

    // --- deploy -------------------------------------------------------------------------------
    log('deploying Minter …');
    const minterProviders = makeProviders(fee, 'minter', psDir);
    const minter: any = await deployContract(minterProviders, { compiledContract: compiledMinter() } as any);
    const minterAddr = minter.deployTxData.public.contractAddress;
    log(`Minter  ${minterAddr}`);

    log('deploying Manager …');
    const managerProviders = makeProviders(fee, 'manager', psDir);
    const manager: any = await deployContract(managerProviders, {
      compiledContract: compiledManager(),
      privateStateId: 'manager',
      initialPrivateState: { ownerSecret: new Uint8Array(32) },
    } as any);
    const managerAddr = manager.deployTxData.public.contractAddress;
    log(`Manager ${managerAddr}`);

    // --- read the Minter's two colors ---------------------------------------------------------
    log('reading Minter colors …');
    const scRes = await minter.callTx.shieldedColor();
    const ucRes = await minter.callTx.unshieldedColor();
    const shieldedColor: Uint8Array = scRes.private?.result ?? scRes.result;
    const unshieldedColor: Uint8Array = ucRes.private?.result ?? ucRes.result;
    log(`  shielded color:   ${hex(shieldedColor)}`);
    log(`  unshielded color: ${hex(unshieldedColor)}`);
    if (hex(shieldedColor) === hex(unshieldedColor)) {
      throw new Error('Minter colors are identical — families must be independent identifiers');
    }

    // --- bind the Manager to those colors ------------------------------------------------------
    log('configuring Manager …');
    await manager.callTx.configure(shieldedColor, unshieldedColor);

    // --- register AA_A and AA_B ----------------------------------------------------------------
    // `myAccount` is ledger-free, so the compiler emits no proving key for it and it is not a
    // callTx transaction. The account id is therefore derived IN PROCESS by running the very same
    // compiled circuit through the simulator — the artifact stays the single source of truth for
    // the commitment scheme, which is never reimplemented off-chain.
    const sim = await ManagerSim.create(new Uint8Array(32));

    const registerFor = async (label: string, secretSeed: string): Promise<string> => {
      const ownerSecret = unshieldedSeedOf(secretSeed);
      const id = await sim.ownerCommitmentFor(ownerSecret);
      log(`  ${label} account id ${hex(id)}`);
      // The Manager's witness reads `ownerSecret` from private state; set it before the call.
      await managerProviders.privateStateProvider.set('manager', { ownerSecret });
      await manager.callTx.registerAccount(id);
      return hex(id);
    };

    const idA = await registerFor('ownerA', SEEDS.ownerA);
    const idB = await registerFor('ownerB', SEEDS.ownerB);

    // --- assert the step-0 baseline -------------------------------------------------------------
    const m = await readManager(managerProviders, managerAddr);
    console.log('\n## STEP 0 — observed');
    console.log(`configured:      ${m.configured}`);
    console.log(`shieldedColor:   ${m.shieldedColor}`);
    console.log(`unshieldedColor: ${m.unshieldedColor}`);
    console.log(`accounts:        ${m.accounts.length} -> ${m.accounts.join(', ')}`);
    console.log(`AA_A shielded/unshielded: ${m.shieldedOf[idA] ?? 0n}/${m.unshieldedOf[idA] ?? 0n}`);
    console.log(`AA_B shielded/unshielded: ${m.shieldedOf[idB] ?? 0n}/${m.unshieldedOf[idB] ?? 0n}`);
    console.log(`pool:            ${m.poolValue} (hasPool=${m.hasPool})`);

    const fail = (msg: string) => { throw new Error(`STEP 0 DIVERGENCE — ${msg}`); };
    if (!m.configured) fail('Manager is not configured');
    if (m.shieldedColor !== hex(shieldedColor)) fail('Manager shielded color != Minter shielded color');
    if (m.unshieldedColor !== hex(unshieldedColor)) fail('Manager unshielded color != Minter unshielded color');
    if (m.accounts.length !== 2) fail(`expected 2 registered accounts, saw ${m.accounts.length}`);
    if ((m.shieldedOf[idA] ?? 0n) !== 0n || (m.unshieldedOf[idA] ?? 0n) !== 0n) fail('AA_A is not 0/0');
    if ((m.shieldedOf[idB] ?? 0n) !== 0n || (m.unshieldedOf[idB] ?? 0n) !== 0n) fail('AA_B is not 0/0');
    if (m.poolValue !== 0n) fail(`pool is ${m.poolValue}, expected 0`);
    assertPoolInvariant(m, 'step 0');

    console.log('\n## RESULT');
    console.log(`minter_address:  ${minterAddr}`);
    console.log(`manager_address: ${managerAddr}`);
    console.log(`shielded_color:  ${hex(shieldedColor)}`);
    console.log(`unshielded_color:${hex(unshieldedColor)}`);
    console.log(`aa_a_account_id: ${idA}`);
    console.log(`aa_b_account_id: ${idB}`);
    console.log('\nSTEP 0 ASSERTED: all four parties 0/0; pool = AA_A + AA_B = 0');
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
