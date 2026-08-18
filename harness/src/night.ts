// NIGHT / DUST helpers shared by the G1 funding step and the G3 step-ledger bootstrap.
//
// Extracted verbatim from the G1 Phase 4 script so both gates use ONE implementation of the
// fee-side mechanics. Everything here concerns NIGHT and DUST only — the demo colors under test
// never appear (spec FR-006, fee isolation).
//
// Mirrors the pinned SDK's own active e2e flow (dustRegistration.undeployed.test.ts,
// facadeTransfer.undeployed.test.ts at wallet-sdk 2.0.0-beta.2):
//   transferTransaction -> signRecipe -> finalizeRecipe -> submitTransaction
import * as ledger from '@midnightntwrk/ledger-v9';
import * as rx from 'rxjs';
import type { Party } from './wallet.js';

export const NIGHT = (): string => ledger.nativeToken().raw;

/** pinned SDK helpers/primitives.ts :: tokenValue */
export const units = (v: bigint): bigint => v * 10n ** 6n;

const stamp = () => new Date().toISOString();
export const log = (m: string) => console.log(`[${stamp()}] ${m}`);

export const syncedState = async (p: Party): Promise<any> => {
  await (p.wallet as any).waitForSyncedState();
  return rx.firstValueFrom(p.wallet.state());
};

export const nightBalance = (s: any): bigint => BigInt(s?.unshielded?.balances?.[NIGHT()] ?? 0n);

/**
 * DUST accrues continuously, so the wallet balance is a function of time; `state.dust.balance`
 * alone reads `undefined`. Try the capability accessor with and without a timestamp, and fall
 * back to the raw wasm state's `walletBalance`.
 */
export const dustBalance = (s: any): bigint => {
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

export const unregisteredNightUtxos = (s: any): any[] =>
  (s?.unshielded?.availableCoins ?? []).filter(
    (c: any) => c?.meta?.registeredForDustGeneration === false && c?.utxo?.type === NIGHT(),
  );

export const registeredNightUtxos = (s: any): any[] =>
  (s?.unshielded?.availableCoins ?? []).filter(
    (c: any) => c?.meta?.registeredForDustGeneration === true && c?.utxo?.type === NIGHT(),
  );

export const report = (label: string, s: any): void => {
  const utxos = s?.unshielded?.availableCoins ?? [];
  log(
    `${label}: NIGHT=${nightBalance(s)} DUST=${dustBalance(s)} utxos=${utxos.length} ` +
      `unregisteredNightUtxos=${unregisteredNightUtxos(s).length}`,
  );
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * DUST accrues over time from registered NIGHT, so on a freshly booted chain even the genesis
 * wallet cannot pay fees for the first seconds. Retry on the two shapes the SDK reports:
 *   - "have N, need M"            -> wait for exactly M via the documented API
 *   - "could not balance dust"    -> no figure given; back off and let DUST accrue
 * This is a deterministic wait on an observable condition, not a blind sleep-and-hope.
 */
export const withDustRetry = async <T>(
  p: Party,
  what: string,
  fn: () => Promise<T>,
  maxAttempts = 20,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isDust = /could not balance dust|InsufficientFunds|Insufficient generated dust/i.test(msg);
      if (!isDust || attempt >= maxAttempts) throw e;

      const need = /need (\d+)/.exec(msg)?.[1];
      if (need) {
        log(`  ${what}: attempt ${attempt} short of DUST, waiting for ${need} …`);
        const s: any = await rx.firstValueFrom(p.wallet.state());
        const utxos = (s?.unshielded?.availableCoins ?? []).filter((c: any) => c?.utxo?.type === NIGHT());
        try {
          await (p.wallet as any).waitForGeneratedDust(utxos, BigInt(need), { timeoutMs: 300_000 });
          continue;
        } catch {
          /* fall through to backoff */
        }
      }
      log(`  ${what}: attempt ${attempt} — DUST not yet generated, waiting 15s`);
      await sleep(15_000);
    }
  }
};

export const waitFor = async (
  p: Party,
  pred: (s: any) => boolean,
  what: string,
  timeoutMs = 180_000,
): Promise<any> => {
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

/** transferTransaction -> signRecipe -> finalizeRecipe -> submitTransaction */
export const sendUnshielded = async (from: Party, toAddress: unknown, amount: bigint): Promise<string> => {
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

/**
 * Register a wallet's NIGHT UTXOs for DUST generation, so it can pay its own fees. Idempotent:
 * already-registered UTXOs are skipped, and the wait is on the observable `registeredForDust
 * Generation` flag rather than on a DUST balance (which is a function of time).
 */
export const registerForDust = async (p: Party): Promise<string> => {
  const state = await syncedState(p);
  const utxos = unregisteredNightUtxos(state);
  if (utxos.length === 0) {
    if (registeredNightUtxos(state).length === 0) {
      throw new Error(`${p.name} has no NIGHT UTXOs at all — funding did not land`);
    }
    log(`  ${p.name}: NIGHT already registered for DUST`);
    return '(skipped — already registered)';
  }
  log(`  ${p.name}: registering ${utxos.length} NIGHT utxo(s) for DUST generation`);
  const recipe = await withDustRetry(p, `register ${p.name} for DUST`, () =>
    (p.wallet as any).registerNightUtxosForDustGeneration(
      utxos,
      (p.unshieldedKeystore as any).getPublicKey(),
      (p.unshieldedKeystore as any).signDataAsync,
    ),
  );
  const finalized = await (p.wallet as any).finalizeRecipe(recipe);
  const hash = String(await (p.wallet as any).submitTransaction(finalized));
  log(`  ${p.name}: DUST registration tx ${hash}`);
  await waitFor(
    p,
    (s) => registeredNightUtxos(s).length > 0,
    `${p.name} NIGHT utxos to show registeredForDustGeneration=true`,
    300_000,
  );
  return hash;
};

/**
 * Fund `to` with NIGHT from `from`, waiting for a strict INCREASE so reruns never pass instantly.
 *
 * It also waits for the SENDER to settle. On a freshly booted chain a wallet can hold exactly one
 * NIGHT UTXO, so a transfer consumes it and the remainder comes back as change; issuing the next
 * transfer before that change is visible fails with `Wallet.InsufficientFunds` even though the
 * wallet is nowhere near short of funds. Fees are paid in DUST, never NIGHT, so the sender's
 * settled NIGHT balance is exactly `before - amount` — a precise condition to wait on rather than
 * a sleep.
 */
export const fundWithNight = async (from: Party, to: Party, amount: bigint): Promise<string> => {
  const beforeTo = nightBalance(await syncedState(to));
  const beforeFrom = nightBalance(await syncedState(from));
  const address = await (to.wallet as any).unshielded.getAddress();
  log(`  funding ${to.name} with ${amount} NIGHT from ${from.name}`);
  const hash = await withDustRetry(from, `fund ${to.name}`, () => sendUnshielded(from, address, amount));
  await waitFor(to, (s) => nightBalance(s) >= beforeTo + amount, `${to.name} NIGHT to arrive`);
  await waitFor(
    from,
    (s) => nightBalance(s) === beforeFrom - amount,
    `${from.name} to see its change (NIGHT back to ${beforeFrom - amount})`,
  );
  return hash;
};
