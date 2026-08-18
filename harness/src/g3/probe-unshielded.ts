// G3 probe — the UNSHIELDED mirror of the four custody mechanics proven for the shielded family.
// Same shapes: mint to a wallet, deposit into AA_A (single wallet-balanced call), move ownership
// internally, withdraw to a user, and self-send from the pool.
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
import { assertPoolInvariant, readManager, waitForManager } from './observe.js';
import { makeProviders } from './providers.js';
import { buildCall } from './compose.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

const main = async () => {
  console.log(`# G3 probe: UNSHIELDED custody mechanics — ${stamp()}`);
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00003-ps-'));
  const parties: Party[] = [];
  try {
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    await (fee.wallet as any).waitForSyncedState();

    const minterProviders = makeProviders(fee, 'minter', psDir);
    const minter: any = await deployContract(minterProviders, { compiledContract: compiledMinter() } as any);
    const minterAddr = minter.deployTxData.public.contractAddress;
    const managerProviders = makeProviders(fee, 'manager', psDir);
    const manager: any = await deployContract(managerProviders, {
      compiledContract: compiledManager(),
      privateStateId: 'manager',
      initialPrivateState: { ownerSecret: new Uint8Array(32) },
    } as any);
    const managerAddr = manager.deployTxData.public.contractAddress;
    log(`Minter ${minterAddr} / Manager ${managerAddr}`);

    const shieldedColor: Uint8Array = (await minter.callTx.shieldedColor()).private.result;
    const unshieldedColor: Uint8Array = (await minter.callTx.unshieldedColor()).private.result;
    await manager.callTx.configure(shieldedColor, unshieldedColor);

    const sim = await ManagerSim.create(new Uint8Array(32));
    const secretA = unshieldedSeedOf(SEEDS.ownerA);
    const secretB = unshieldedSeedOf(SEEDS.ownerB);
    const idA = await sim.ownerCommitmentFor(secretA);
    const idB = await sim.ownerCommitmentFor(secretB);
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretA });
    await manager.callTx.registerAccount(idA);
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretB });
    await manager.callTx.registerAccount(idB);
    log(`AA_A ${hex(idA)} / AA_B ${hex(idB)} registered`);

    // The fee wallet's unshielded address is the mint recipient and the withdraw target.
    const userAddrHex: string = (await (fee.wallet as any).unshielded.getAddress()).hexString;
    const userRecipient = {
      is_left: false,
      left: { bytes: new Uint8Array(32) },
      right: { bytes: Buffer.from(userAddrHex, 'hex') },
    };

    // 1) mint unshielded 10 -> the wallet
    log('minting unshielded 10 -> wallet …');
    await minter.callTx.mintUnshieldedTo(10n, userRecipient);

    // 2) deposit 10 -> AA_A, single call balanced by the depositor's wallet
    log('depositing unshielded 10 -> AA_A …');
    const built = await buildCall({
      providers: managerProviders,
      compiledContract: compiledManager(),
      contractAddress: managerAddr,
      circuitId: 'depositUnshielded',
      args: [unshieldedColor, 10n, idA],
      privateStateId: 'manager',
    });
    const proven = await managerProviders.proofProvider.proveTx(built.private.unprovenTx);
    const toSubmit = await managerProviders.walletProvider.balanceTx(proven);
    log(`  deposit tx ${String(await managerProviders.midnightProvider.submitTx(toSubmit))}`);
    let m = await waitForManager(managerProviders, managerAddr,
      (x) => (x.unshieldedOf[hex(idA)] ?? 0n) === 10n, 'AA_A unshielded credited 10');
    console.log(`\nMECHANIC 1u user->account deposit: AA_A unshielded ${m.unshieldedOf[hex(idA)]}`);

    // 3) internal ownership transfer AA_A -5-> AA_B (unshielded family)
    const beforeInternal = m;
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretA });
    log('internal transfer AA_A -5-> AA_B (unshielded) …');
    await manager.callTx.transferInternal(idB, false, 5n);
    m = await waitForManager(managerProviders, managerAddr,
      (x) => (x.unshieldedOf[hex(idA)] ?? 0n) === 5n && (x.unshieldedOf[hex(idB)] ?? 0n) === 5n,
      'AA_A 5 / AA_B 5 unshielded');
    console.log(`\nMECHANIC 2u account->account internal: AA_A ${m.unshieldedOf[hex(idA)]}, AA_B ${m.unshieldedOf[hex(idB)]}`);
    console.log(`  shielded pool untouched by an unshielded move: ${m.poolValue === beforeInternal.poolValue}`);

    // 4) withdraw AA_B -5-> user
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretB });
    log('withdraw AA_B -5-> user …');
    await manager.callTx.withdrawUnshielded(unshieldedColor, 5n, userRecipient);
    m = await waitForManager(managerProviders, managerAddr,
      (x) => (x.unshieldedOf[hex(idB)] ?? 0n) === 0n, 'AA_B unshielded drained to 0');
    console.log(`\nMECHANIC 3u account->user withdraw: AA_B ${m.unshieldedOf[hex(idB)] ?? 0n}`);

    // 5) pool self-send (unshielded auto-receive branch) — must be fully neutral
    const beforeSelf = m;
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretA });
    log('pool self-send unshielded …');
    await manager.callTx.selfSendUnshielded(unshieldedColor, 5n);
    const afterSelf = await readManager(managerProviders, managerAddr);
    const neutral =
      JSON.stringify(afterSelf.unshieldedOf, (_k, v) => (typeof v === 'bigint' ? `${v}` : v)) ===
      JSON.stringify(beforeSelf.unshieldedOf, (_k, v) => (typeof v === 'bigint' ? `${v}` : v));
    console.log(`\nMECHANIC 4u pool self-send unshielded: account map byte-identical: ${neutral}`);
    if (!neutral) { console.log('  SELF-SEND CHANGED BALANCES — violates FR-005'); process.exitCode = 1; }
    assertPoolInvariant(afterSelf, 'after unshielded self-send');

    console.log('\n## UNSHIELDED MECHANICS PROVEN LIVE');
    console.log('  1u user -> account deposit    2u account -> account internal');
    console.log('  3u account -> user withdraw   4u pool self-send (auto-receive)');
  } finally {
    for (const p of parties) await closeParty(p);
  }
};
main().then(() => process.exit(process.exitCode ?? 0), (e) => {
  console.error(`\nFAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
