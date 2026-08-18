// G1 Phase 4 — fund the fee wallet with NIGHT from genesis, register it for DUST generation,
// and prove a fee-paying smoke transaction.
//
// Mirrors the pinned SDK's own active e2e flow (dustRegistration.undeployed.test.ts,
// facadeTransfer.undeployed.test.ts at wallet-sdk 2.0.0-beta.2):
//   transferTransaction -> signRecipe -> finalizeRecipe -> submitTransaction
import * as ledger from '@midnightntwrk/ledger-v9';
import * as rx from 'rxjs';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';

const NIGHT = () => ledger.nativeToken().raw;
const units = (v: bigint): bigint => v * 10n ** 6n; // pinned SDK helpers/primitives.ts :: tokenValue

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);

const syncedState = async (p: Party): Promise<any> => {
  await (p.wallet as any).waitForSyncedState();
  return rx.firstValueFrom(p.wallet.state());
};

const nightBalance = (s: any): bigint => BigInt(s?.unshielded?.balances?.[NIGHT()] ?? 0n);
/**
 * DUST accrues continuously, so the wallet balance is a function of time; `state.dust.balance`
 * alone reads `undefined`. Try the capability accessor with and without a timestamp, and fall
 * back to the raw wasm state's `walletBalance`.
 */
const dustBalance = (s: any): bigint => {
  const now = BigInt(Date.now());
  const cb = s?.dust?.capabilities?.coinsAndBalances;
  for (const args of [[now], [], [new Date()]]) {
    try {
      const v = cb?.getWalletBalance?.(...(args as []));
      if (typeof v === 'bigint') return v;
    } catch {
      /* try the next shape */
    }
  }
  for (const args of [[now], []]) {
    try {
      const v = s?.dust?.state?.state?.walletBalance?.(...(args as []));
      if (typeof v === 'bigint') return v;
    } catch {
      /* not readable in this shape */
    }
  }
  const d = s?.dust?.balance;
  return typeof d === 'bigint' ? d : 0n;
};

const unregisteredNightUtxos = (s: any): any[] =>
  (s?.unshielded?.availableCoins ?? []).filter(
    (c: any) => c?.meta?.registeredForDustGeneration === false && c?.utxo?.type === NIGHT(),
  );

const report = (label: string, s: any) => {
  const utxos = s?.unshielded?.availableCoins ?? [];
  log(
    `${label}: NIGHT=${nightBalance(s)} DUST=${dustBalance(s)} utxos=${utxos.length} ` +
      `unregisteredNightUtxos=${unregisteredNightUtxos(s).length}`,
  );
};

/** transferTransaction -> signRecipe -> finalizeRecipe -> submitTransaction */
const sendUnshielded = async (from: Party, toAddress: unknown, amount: bigint): Promise<string> => {
  const transfers: any[] = [
    { type: 'unshielded', outputs: [{ amount, receiverAddress: toAddress, type: NIGHT() }] },
  ];
  const ttl = new Date(Date.now() + 30 * 60 * 1000);

  const recipe = await (from.wallet as any).transferTransaction(
    transfers,
    { shieldedSecretKeys: from.shieldedSecretKeys, dustSecretKey: from.dustSecretKey },
    { ttl },
  );
  const signed = await (from.wallet as any).signRecipe(recipe, (from.unshieldedKeystore as any).signDataAsync);
  const finalized = await (from.wallet as any).finalizeRecipe(signed);
  const hash = finalized.transactionHash().toString();
  const submitted = await (from.wallet as any).submitTransaction(finalized);
  log(`  submitted tx ${String(submitted)} (hash ${hash})`);
  return hash;
};

const waitFor = async (p: Party, pred: (s: any) => boolean, what: string, timeoutMs = 180_000) => {
  log(`  waiting for ${what} …`);
  return rx.firstValueFrom(
    p.wallet.state().pipe(
      rx.filter((s: any) => {
        try {
          return pred(s);
        } catch {
          return false;
        }
      }),
      rx.timeout({ first: timeoutMs }),
    ),
  );
};

const main = async () => {
  console.log(`# G1 Phase 4 — funding + DUST + smoke tx — EXPERIMENTAL_LANE — ${stamp()}`);
  const parties: Party[] = [];
  try {
    const genesis = await openParty('genesis', SEEDS.genesis);
    parties.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    const ownerN = await openParty('ownerN', SEEDS.ownerN);
    parties.push(ownerN);

    log('syncing genesis + feePayer …');
    report('genesis(before)', await syncedState(genesis));
    const feeBefore = await syncedState(fee);
    report('feePayer(before)', feeBefore);
    const feeNightBefore = nightBalance(feeBefore);

    // --- 1. genesis -> feePayer NIGHT ---------------------------------------------------------
    const feeAddress = await (fee.wallet as any).unshielded.getAddress();
    // DUST accrues in proportion to NIGHT held, and the registration transaction itself costs
    // DUST. Fund generously so generation reaches the registration fee quickly.
    const fundAmount = units(1_000_000n);
    log(`funding feePayer with ${fundAmount} NIGHT from genesis`);
    const fundHash = await sendUnshielded(genesis, feeAddress, fundAmount);

    // Wait for an increase over the pre-existing balance, so reruns don't pass instantly.
    const feeFunded = await waitFor(
      fee,
      (s) => nightBalance(s) >= feeNightBefore + fundAmount,
      'feePayer NIGHT to arrive',
    );
    report('feePayer(funded)', feeFunded);

    // --- 2. register feePayer's NIGHT for DUST generation ---------------------------------------
    const utxos = unregisteredNightUtxos(feeFunded);
    const alreadyRegistered = (feeFunded?.unshielded?.availableCoins ?? []).filter(
      (c: any) => c?.utxo?.type === NIGHT() && c?.meta?.registeredForDustGeneration === true,
    );
    if (utxos.length === 0 && alreadyRegistered.length === 0) {
      throw new Error('feePayer has no NIGHT UTXOs at all — funding did not land');
    }
    let regHash: unknown = '(skipped — already registered)';
    if (utxos.length === 0) {
      log(`all ${alreadyRegistered.length} NIGHT utxo(s) already registered for DUST — skipping registration`);
    } else {
      log(`registering ${utxos.length} NIGHT utxo(s) for DUST generation`);

    // The registration transaction is itself paid in DUST, which accrues over time from the
    // freshly received NIGHT. The SDK reports the exact shortfall, so wait for that amount via
    // the documented API and retry rather than guessing a sleep.
    const registerWithWait = async (attempt = 1): Promise<any> => {
      try {
        return await (fee.wallet as any).registerNightUtxosForDustGeneration(
          utxos,
          (fee.unshieldedKeystore as any).getPublicKey(),
          (fee.unshieldedKeystore as any).signDataAsync,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const need = /need (\d+)/.exec(msg)?.[1];
        if (!need || attempt > 6) throw e;
        log(`  attempt ${attempt}: insufficient DUST, waiting for ${need} …`);
        await (fee.wallet as any).waitForGeneratedDust(utxos, BigInt(need), { timeoutMs: 300_000 });
        return registerWithWait(attempt + 1);
      }
    };
      const regRecipe = await registerWithWait();
      const regFinal = await (fee.wallet as any).finalizeRecipe(regRecipe);
      regHash = await (fee.wallet as any).submitTransaction(regFinal);
      log(`  DUST registration tx ${String(regHash)}`);
    }

    // The authoritative proof that DUST generation works is not a balance read (DUST is a
    // function of time and the getter shape varies) — it is that the UTXOs are now registered
    // and that a later transaction's fees are actually payable from generated DUST.
    const dusted = await waitFor(
      fee,
      (s) =>
        (s?.unshielded?.availableCoins ?? []).some(
          (c: any) => c?.utxo?.type === NIGHT() && c?.meta?.registeredForDustGeneration === true,
        ),
      'feePayer NIGHT utxos to show registeredForDustGeneration=true',
      300_000,
    );
    report('feePayer(registered)', dusted);

    // --- 3. smoke transaction paid for by generated DUST ----------------------------------------
    const ownerNAddress = await (ownerN.wallet as any).unshielded.getAddress();
    const smokeAmount = units(1n);
    log(`smoke transfer: feePayer -> OwnerN ${smokeAmount} NIGHT (fees paid from generated DUST)`);
    const before = await syncedState(ownerN);
    report('ownerN(before)', before);

    // Retry on DUST shortfall using the SDK's own wait API — this is the assertion that fees
    // are genuinely payable from generated DUST.
    const smokeWithWait = async (attempt = 1): Promise<string> => {
      try {
        return await sendUnshielded(fee, ownerNAddress, smokeAmount);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const need = /need (\d+)/.exec(msg)?.[1];
        if (!need || attempt > 6) throw e;
        log(`  smoke attempt ${attempt}: insufficient DUST, waiting for ${need} …`);
        const utxosNow = (await rx.firstValueFrom(fee.wallet.state()) as any)?.unshielded?.availableCoins ?? [];
        await (fee.wallet as any).waitForGeneratedDust(
          utxosNow.filter((c: any) => c?.utxo?.type === NIGHT()),
          BigInt(need),
          { timeoutMs: 300_000 },
        );
        return smokeWithWait(attempt + 1);
      }
    };
    const smokeHash = await smokeWithWait();
    const after = await waitFor(ownerN, (s) => nightBalance(s) >= smokeAmount, 'OwnerN NIGHT to arrive');
    report('ownerN(after)', after);

    console.log('\n## RESULT');
    console.log(`fund_tx:             ${fundHash}`);
    console.log(`dust_registration_tx:${String(regHash)}`);
    console.log(`smoke_tx:            ${smokeHash}`);
    console.log(`feePayer_night:      ${nightBalance(dusted)}`);
    console.log(`feePayer_dust:       ${dustBalance(dusted)}`);
    console.log(`ownerN_night:        ${nightBalance(after)}`);
    console.log('\nG1 Phase 4: fee wallet funded, DUST generated, smoke transaction confirmed');
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
