// G3 probe — LEDGER-LEVEL composition of a mint into the Manager (master Q3 / Finding G3-2).
//
// Proves, live and in both families, the one shape midnight-js cannot express at SDK level:
// a minting CONTRACT's spend claim and a second CONTRACT's receive claim balancing inside ONE
// transaction. Both calls are placed in a single ledger `Intent` (see `ledger-compose.ts`).
//
// Success criterion is the spec's own: AA_A is credited and the Manager's pooled holdings move,
// asserted from two independent observation points (account map / pooled ledger holdings) with
// the standing invariant `pool = AA_A + AA_B` holding after each transfer.
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
import { makeComposedProofProvider, makeProviders } from './providers.js';
import { composeOneIntent, proveBalanceSubmit } from './ledger-compose.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

const contractRecipientRight = (addr: string) => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: Buffer.from(addr, 'hex') },
});
const contractRecipientLeft = (addr: string) => ({
  is_left: true,
  left: { bytes: Buffer.from(addr, 'hex') },
  right: { bytes: new Uint8Array(32) },
});

const main = async () => {
  console.log(`# G3 probe: LEDGER-LEVEL mint -> Manager composition — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00003-ps-'));
  const parties: Party[] = [];

  try {
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    await (fee.wallet as any).waitForSyncedState();
    log('feePayer synced');

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

    const composedProof = makeComposedProofProvider();

    // ---------------------------------------------------------------------------------------
    // SHIELDED: Minter.mintShieldedTo(10, nonce, Manager) + Manager.depositShielded(coin, AA_A)
    // ---------------------------------------------------------------------------------------
    // The mint nonce is chosen HERE, and `mintShieldedToken` uses it verbatim (pinned stdlib
    // L125: `ShieldedCoinInfo { nonce, color: tokenType(...), value }`), so the coin the Manager
    // must claim is known exactly before either call is executed.
    const nonceS = randomBytes(32);
    const beforeS = await readManager(managerProviders, managerAddr);
    log('composing mint -> Manager (shielded) into ONE ledger intent …');
    const composedS = await composeOneIntent(
      {
        providers: minterProviders,
        compiledContract: compiledMinter(),
        contractAddress: minterAddr,
        circuitId: 'mintShieldedTo',
        args: [10n, nonceS, contractRecipientRight(managerAddr)],
      },
      [
        {
          providers: managerProviders,
          compiledContract: compiledManager(),
          contractAddress: managerAddr,
          circuitId: 'depositShielded',
          args: [{ nonce: nonceS, color: shieldedColor, value: 10n }, idA],
          privateStateId: 'manager',
        },
      ],
    );
    log(`  one intent in segment ${composedS.segment}: ${composedS.circuits.join(' + ')}`);
    const txS = await proveBalanceSubmit(composedS.tx, composedProof, minterProviders);
    log(`  composed shielded tx ${txS}`);

    const afterS = await waitForManager(
      managerProviders,
      managerAddr,
      (m) => (m.shieldedOf[hex(idA)] ?? 0n) === 10n && m.poolValue === 10n,
      'AA_A credited 10 shielded and pool at 10 from a CONTRACT mint',
    );
    console.log('\n## SHIELDED mint -> Manager (ledger-level composition)');
    console.log(`tx:                 ${txS}`);
    console.log(`AA_A shielded:      ${beforeS.shieldedOf[hex(idA)] ?? 0n} -> ${afterS.shieldedOf[hex(idA)] ?? 0n}`);
    console.log(`pool (2nd point):   ${beforeS.poolValue} -> ${afterS.poolValue}`);
    console.log(`pool coin nonce:    ${afterS.poolNonce} (== mint nonce: ${afterS.poolNonce === hex(nonceS)})`);
    assertPoolInvariant(afterS, 'after ledger-composed shielded mint');

    // ---------------------------------------------------------------------------------------
    // UNSHIELDED: Minter.mintUnshieldedTo(10, Manager) + Manager.depositUnshielded(color, 10, AA_A)
    // ---------------------------------------------------------------------------------------
    // No zswap output is involved at all here: the mint records `claimUnshieldedCoinSpend` to the
    // Manager and the Manager's `receiveUnshielded` records `incUnshieldedInputs`. Both are
    // transcript effects, so they offset only if the two calls share one intent.
    const beforeU = afterS;
    log('composing mint -> Manager (unshielded) into ONE ledger intent …');
    const composedU = await composeOneIntent(
      {
        providers: minterProviders,
        compiledContract: compiledMinter(),
        contractAddress: minterAddr,
        circuitId: 'mintUnshieldedTo',
        args: [10n, contractRecipientLeft(managerAddr)],
      },
      [
        {
          providers: managerProviders,
          compiledContract: compiledManager(),
          contractAddress: managerAddr,
          circuitId: 'depositUnshielded',
          args: [unshieldedColor, 10n, idA],
          privateStateId: 'manager',
        },
      ],
    );
    log(`  one intent in segment ${composedU.segment}: ${composedU.circuits.join(' + ')}`);
    const txU = await proveBalanceSubmit(composedU.tx, composedProof, minterProviders);
    log(`  composed unshielded tx ${txU}`);

    const afterU = await waitForManager(
      managerProviders,
      managerAddr,
      (m) => (m.unshieldedOf[hex(idA)] ?? 0n) === 10n,
      'AA_A credited 10 unshielded from a CONTRACT mint',
    );
    console.log('\n## UNSHIELDED mint -> Manager (ledger-level composition)');
    console.log(`tx:                 ${txU}`);
    console.log(`AA_A unshielded:    ${beforeU.unshieldedOf[hex(idA)] ?? 0n} -> ${afterU.unshieldedOf[hex(idA)] ?? 0n}`);
    console.log(`shielded untouched: ${afterU.poolValue === beforeU.poolValue}`);
    assertPoolInvariant(afterU, 'after ledger-composed unshielded mint');

    console.log('\n## RESULT');
    console.log('LEDGER-LEVEL COMPOSITION WORKS for mint(contract) -> Manager in BOTH families.');
    console.log(`minter_address:   ${minterAddr}`);
    console.log(`manager_address:  ${managerAddr}`);
    console.log(`aa_a_account_id:  ${hex(idA)}`);
    console.log(`shielded_tx:      ${txS}`);
    console.log(`unshielded_tx:    ${txU}`);
  } finally {
    for (const p of parties) await closeParty(p);
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
