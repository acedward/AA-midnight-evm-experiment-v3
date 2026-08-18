// G3 — step-ledger runner. One scripted process, as SC-001 requires.
//
// Currently covers step 0 (deploy/configure/register/baseline) and step 1 (shielded mints),
// including the composition probe for the paired mint + Manager receive claim.
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
import { assertPoolInvariant, readManager } from './observe.js';
import { makeProviders } from './providers.js';
import { submitComposed } from './compose.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
const fail = (step: string, msg: string): never => {
  throw new Error(`STEP ${step} DIVERGENCE — ${msg}`);
};

const main = async () => {
  console.log(`# G3 step-ledger run — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00003-ps-'));
  const parties: Party[] = [];

  try {
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    await (fee.wallet as any).waitForSyncedState();
    const ownerN = await openParty('ownerN', SEEDS.ownerN);
    parties.push(ownerN);

    // ---------------- STEP 0 ----------------
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

    // Proving a transaction that spans BOTH contracts needs a zkConfigProvider rooted where both
    // key sets are visible (scripts/g2/compile.sh --zk builds that combined view).
    const composedProviders = makeProviders(fee, '_combined', psDir);

    const scRes = await minter.callTx.shieldedColor();
    const ucRes = await minter.callTx.unshieldedColor();
    const shieldedColor: Uint8Array = scRes.private?.result ?? scRes.result;
    const unshieldedColor: Uint8Array = ucRes.private?.result ?? ucRes.result;
    if (hex(shieldedColor) === hex(unshieldedColor)) fail('0', 'Minter colors are not distinct');
    log(`colors: shielded ${hex(shieldedColor)} / unshielded ${hex(unshieldedColor)}`);

    await manager.callTx.configure(shieldedColor, unshieldedColor);

    const sim = await ManagerSim.create(new Uint8Array(32));
    const registerFor = async (label: string, seed: string): Promise<{ id: Uint8Array; secret: Uint8Array }> => {
      const secret = unshieldedSeedOf(seed);
      const id = await sim.ownerCommitmentFor(secret);
      await managerProviders.privateStateProvider.set('manager', { ownerSecret: secret });
      await manager.callTx.registerAccount(id);
      log(`  registered ${label} -> ${hex(id)}`);
      return { id, secret };
    };
    const aaA = await registerFor('AA_A (OwnerA)', SEEDS.ownerA);
    const aaB = await registerFor('AA_B (OwnerB)', SEEDS.ownerB);
    const idA = hex(aaA.id);
    const idB = hex(aaB.id);

    let m = await readManager(managerProviders, managerAddr);
    if (!m.configured) fail('0', 'Manager not configured');
    if (m.accounts.length !== 2) fail('0', `expected 2 accounts, saw ${m.accounts.length}`);
    if ((m.shieldedOf[idA] ?? 0n) !== 0n || (m.shieldedOf[idB] ?? 0n) !== 0n) fail('0', 'accounts not 0');
    if (m.poolValue !== 0n) fail('0', `pool ${m.poolValue} != 0`);
    assertPoolInvariant(m, 'step 0');
    console.log('\nSTEP 0 ASSERTED — AA_A 0/0, AA_B 0/0, pool = AA_A + AA_B = 0');

    // ---------------- STEP 1 : mint shielded 10 -> AA_A and 10 -> OwnerN ----------------
    console.log('\n## STEP 1 — mint shielded 10 -> AA_A (paired) and 10 -> OwnerN');

    // (a) mint shielded 10 -> OwnerN : a single Minter call, recipient is a user zswap key.
    // Because the recipient is not the caller, the builder needs OwnerN's ENCRYPTION public key
    // to encrypt the new coin to them.
    const nonceN = randomBytes(32);
    const ownerNCoinPk = ownerN.shieldedSecretKeys.coinPublicKey;
    const ownerNEncPk = ownerN.shieldedSecretKeys.encryptionPublicKey;
    const ownerNMappings = new Map<unknown, unknown>([[ownerNCoinPk, ownerNEncPk]]);
    log('minting shielded 10 -> OwnerN …');
    const mintNId = await submitComposed(fee, composedProviders, [
      {
        providers: minterProviders,
        compiledContract: compiledMinter(),
        contractAddress: minterAddr,
        circuitId: 'mintShieldedTo',
        args: [
          10n,
          nonceN,
          {
            is_left: true,
            left: { bytes: typeof ownerNCoinPk === 'string' ? Buffer.from(ownerNCoinPk, 'hex') : ownerNCoinPk },
            right: { bytes: new Uint8Array(32) },
          },
        ],
        encMappings: ownerNMappings,
      },
    ]);
    log(`  tx ${mintNId}`);

    // (b) mint shielded 10 -> AA_A : the Minter mints TO THE MANAGER, and the Manager's
    //     depositShielded claims it. The stdlib only auto-receives for kernel.self(), so both
    //     calls MUST land in one transaction. The mint nonce is chosen here, so the coin the
    //     Manager must claim is known exactly: {nonce, color, value}.
    const nonceA = randomBytes(32);
    const managerRecipient = {
      is_left: false,
      left: { bytes: new Uint8Array(32) },
      right: { bytes: Buffer.from(managerAddr, 'hex') },
    };
    await managerProviders.privateStateProvider.set('manager', { ownerSecret: aaA.secret });

    log('composing paired mint + Manager receive into ONE transaction …');
    const composedId = await submitComposed(fee, composedProviders, [
      {
        providers: minterProviders,
        compiledContract: compiledMinter(),
        contractAddress: minterAddr,
        circuitId: 'mintShieldedTo',
        args: [10n, nonceA, managerRecipient],
      },
      {
        providers: managerProviders,
        compiledContract: compiledManager(),
        contractAddress: managerAddr,
        circuitId: 'depositShielded',
        args: [{ nonce: nonceA, color: shieldedColor, value: 10n }, aaA.id],
        privateStateId: 'manager',
      },
    ]);
    log(`  composed tx ${composedId}`);

    // ---------------- assert the step-1 table ----------------
    m = await readManager(managerProviders, managerAddr);
    console.log('\n## STEP 1 — observed (Manager side)');
    console.log(`AA_A shielded: ${m.shieldedOf[idA] ?? 0n}`);
    console.log(`AA_B shielded: ${m.shieldedOf[idB] ?? 0n}`);
    console.log(`pool:          ${m.poolValue} (hasPool=${m.hasPool})`);

    if ((m.shieldedOf[idA] ?? 0n) !== 10n) fail('1', `AA_A shielded is ${m.shieldedOf[idA] ?? 0n}, expected 10`);
    if ((m.shieldedOf[idB] ?? 0n) !== 0n) fail('1', `AA_B shielded is ${m.shieldedOf[idB] ?? 0n}, expected 0`);
    if (m.poolValue !== 10n) fail('1', `pool is ${m.poolValue}, expected 10`);
    assertPoolInvariant(m, 'step 1');

    console.log('\nSTEP 1 ASSERTED (Manager side) — AA_A 10, AA_B 0, pool = AA_A + AA_B = 10');
    console.log('\n## COMPOSITION PROBE RESULT');
    console.log('SDK-level composition WORKS: two contract calls merged into one transaction via');
    console.log('createUnprovenCallTx + UnprovenTransaction.merge, balanced and submitted by the');
    console.log('pinned wallet facade. Master Q2 -> SDK level (no ledger-level fallback needed).');
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
