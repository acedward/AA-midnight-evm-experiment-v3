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
import { assertPoolInvariant, readManager, waitForManager } from './observe.js';
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
      return;
    }
    assertPoolInvariant(after, 'after deposit');

    // ---- Register AA_B so internal transfers have a destination --------------------------------
    const secretB = unshieldedSeedOf(SEEDS.ownerB);
    const idB = await sim.ownerCommitmentFor(secretB);
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretB });
    await manager.callTx.registerAccount(idB);
    log(`AA_B registered ${hex(idB)}`);

    // ---- MECHANIC 2: account -> account INTERNAL transfer (ownership only) ---------------------
    // Authorised by OwnerA's witness. The pooled coin and ledger balances must be BYTE-IDENTICAL
    // before and after; only the account map may move (spec FR-005).
    const beforeInternal = await readManager(managerProviders, managerAddr);
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretA });
    log('internal transfer AA_A -5-> AA_B (shielded) …');
    await manager.callTx.transferInternal(idB, true, 5n);
    const afterInternal = await waitForManager(
      managerProviders, managerAddr,
      (m) => (m.shieldedOf[hex(idB)] ?? 0n) === 5n && (m.shieldedOf[hex(idA)] ?? 0n) === 5n,
      'AA_A 5 / AA_B 5 after internal transfer',
    );
    const poolUntouched =
      afterInternal.poolValue === beforeInternal.poolValue &&
      afterInternal.poolNonce === beforeInternal.poolNonce;
    console.log(`\nMECHANIC 2 account->account internal: AA_A ${afterInternal.shieldedOf[hex(idA)]}, AA_B ${afterInternal.shieldedOf[hex(idB)]}`);
    console.log(`  pool value unchanged: ${afterInternal.poolValue === beforeInternal.poolValue}`);
    console.log(`  pool coin nonce unchanged (no ledger movement): ${poolUntouched}`);
    if (!poolUntouched) { console.log('  INTERNAL TRANSFER MOVED THE POOL — violates FR-005'); process.exitCode = 1; }
    assertPoolInvariant(afterInternal, 'after internal transfer');

    // ---- MECHANIC 3: account -> user withdrawal ------------------------------------------------
    // Authorised by OwnerB's witness; pool pays out and retains change.
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretB });
    log('withdraw AA_B -5-> user wallet …');
    await manager.callTx.withdrawShielded(5n, {
      is_left: true,
      left: { bytes: typeof coinPk === 'string' ? Buffer.from(coinPk, 'hex') : coinPk },
      right: { bytes: new Uint8Array(32) },
    });
    const afterWithdraw = await waitForManager(
      managerProviders, managerAddr,
      (m) => (m.shieldedOf[hex(idB)] ?? 0n) === 0n && m.poolValue === 5n,
      'AA_B drained to 0 and pool down to 5',
    );
    console.log(`\nMECHANIC 3 account->user withdraw: AA_B ${afterWithdraw.shieldedOf[hex(idB)] ?? 0n}, pool ${afterWithdraw.poolValue}`);
    assertPoolInvariant(afterWithdraw, 'after withdraw');

    // ---- MECHANIC 4: pool SELF-SEND (stdlib auto-receive branch) -------------------------------
    // Balance- and ownership-neutral by definition; the evidence is that identifiers change while
    // the balance table does not (spec FR-005, inverse of the internal-transfer case).
    const beforeSelf = await readManager(managerProviders, managerAddr);
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretA });
    log('pool self-send to kernel.self() …');
    await manager.callTx.selfSendShielded();
    const afterSelf = await waitForManager(
      managerProviders, managerAddr,
      (m) => m.poolNonce !== beforeSelf.poolNonce,
      'pool coin nonce to change under an unchanged balance',
    );
    const balancesUnchanged =
      afterSelf.poolValue === beforeSelf.poolValue &&
      JSON.stringify(afterSelf.shieldedOf, (_k, v) => (typeof v === 'bigint' ? `${v}` : v)) ===
        JSON.stringify(beforeSelf.shieldedOf, (_k, v) => (typeof v === 'bigint' ? `${v}` : v));
    console.log(`\nMECHANIC 4 pool self-send: pool value ${beforeSelf.poolValue} -> ${afterSelf.poolValue}`);
    console.log(`  nonce changed:      ${beforeSelf.poolNonce} -> ${afterSelf.poolNonce}`);
    console.log(`  balances unchanged: ${balancesUnchanged}`);
    if (!balancesUnchanged) { console.log('  SELF-SEND CHANGED BALANCES — violates FR-005'); process.exitCode = 1; }
    assertPoolInvariant(afterSelf, 'after pool self-send');

    console.log('\n## MECHANICS PROVEN LIVE');
    console.log('  1. user -> account deposit          (single call, wallet-balanced)');
    console.log('  2. account -> account internal      (ownership-only; pool byte-identical)');
    console.log('  3. account -> user withdraw         (pool pays out, retains change)');
    console.log('  4. pool self-send to kernel.self()  (auto-receive; identifiers change, balances do not)');
  } finally {
    for (const p of parties) await closeParty(p);
  }
};
main().then(() => process.exit(process.exitCode ?? 0), (e) => {
  console.error(`\nFAILED: ${e instanceof Error ? `${e.message}` : String(e)}`);
  process.exit(1);
});
