// G3 probe — does a USER -> CONTRACT deposit balance at SDK level?
//
// Finding G3-2 showed a MINTING CONTRACT -> contract transfer will not balance. The ledger prior
// art (token_vault_shielded.rs) deposits from a USER wallet, which is a different shape: the
// contract's depositShielded declares receiveShielded, and the DEPOSITOR'S WALLET balances the
// transaction by supplying the input. That needs no cross-contract intent at all — it is a single
// contract call balanced by the sender's wallet.
//
// This probe mints the demo color to the fee wallet (which already holds DUST for fees), then has
// that same wallet deposit half into AA_A.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdtempSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { compiledManager, compiledMinter } from './contracts.js';
import { ManagerSim } from '../test/sim.js';
import { readManager, waitForManager } from './observe.js';
import { makeProviders } from './providers.js';
import { buildCall } from './compose.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

const main = async () => {
  console.log(`# G3 probe: user -> contract deposit — ${stamp()}`);
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
    const idA = await sim.ownerCommitmentFor(secretA);
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretA });
    await manager.callTx.registerAccount(idA);
    log(`AA_A registered ${hex(idA)}`);

    // 1) mint the demo color TO THE FEE WALLET (a user recipient) — known to work.
    const nonce = randomBytes(32);
    const coinPk = fee.shieldedSecretKeys.coinPublicKey;
    const encPk = fee.shieldedSecretKeys.encryptionPublicKey;
    log('minting shielded 10 -> feePayer wallet …');
    await minter.callTx.mintShieldedTo(
      10n,
      nonce,
      { is_left: true, left: { bytes: typeof coinPk === 'string' ? Buffer.from(coinPk, 'hex') : coinPk },
        right: { bytes: new Uint8Array(32) } },
    );
    log('  minted');

    // 2) THE PROBE: a single Manager.depositShielded call, balanced by the depositor's wallet.
    log('depositing shielded 10 -> AA_A as a single call balanced by the wallet …');
    const before = await readManager(managerProviders, managerAddr);
    const built = await buildCall({
      providers: managerProviders,
      compiledContract: compiledManager(),
      contractAddress: managerAddr,
      circuitId: 'depositShielded',
      args: [{ nonce, color: shieldedColor, value: 10n }, idA],
      privateStateId: 'manager',
    });
    const proven = await managerProviders.proofProvider.proveTx(built.private.unprovenTx);
    const toSubmit = await managerProviders.walletProvider.balanceTx(proven);
    const txId = await managerProviders.midnightProvider.submitTx(toSubmit);
    log(`  deposit tx ${String(txId)}`);

    // Wait for the block to apply and be indexed — never read once (see waitForManager).
    const after = await waitForManager(
      managerProviders,
      managerAddr,
      (m) => (m.shieldedOf[hex(idA)] ?? 0n) === 10n && m.poolValue === 10n,
      'AA_A to be credited 10 and pool to reach 10',
    );
    console.log('\n## PROBE RESULT');
    console.log(`AA_A before: ${before.shieldedOf[hex(idA)] ?? 0n}   after: ${after.shieldedOf[hex(idA)] ?? 0n}`);
    console.log(`pool  before: ${before.poolValue}   after: ${after.poolValue}`);
    if ((after.shieldedOf[hex(idA)] ?? 0n) === 10n && after.poolValue === 10n) {
      console.log('\nUSER -> CONTRACT DEPOSIT WORKS at SDK level (single call, wallet-balanced).');
    } else {
      console.log('\nDeposit did not credit as expected.');
      process.exitCode = 1;
    }
  } finally {
    for (const p of parties) await closeParty(p);
  }
};
main().then(() => process.exit(process.exitCode ?? 0), (e) => {
  console.error(`\nFAILED: ${e instanceof Error ? `${e.message}` : String(e)}`);
  process.exit(1);
});
