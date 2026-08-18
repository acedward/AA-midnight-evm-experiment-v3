// DIAGNOSTIC (throwaway, not a gate step) — why does the sender's settled-change wait not finish?
//
// G1 step `10-funding` timed out twice waiting for genesis's NIGHT balance to become EXACTLY
// `before - amount`. This script performs the same transfer, then samples genesis's balance every
// 5s and prints it, so the failure mode is visible rather than inferred:
//
//   * balance converges to the expected value, just slowly   -> host-load lag
//   * balance settles on a DIFFERENT value                   -> the predicate is wrong
//   * balance never changes at all                           -> the wallet is not seeing the tx
import { SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { log, nightBalance, sendUnshielded, syncedState, units, withDustRetry } from '../night.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const parties: Party[] = [];
  try {
    const genesis = await openParty('genesis', SEEDS.genesis);
    parties.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);

    const before = nightBalance(await syncedState(genesis));
    const beforeFee = nightBalance(await syncedState(fee));
    const amount = units(1_000_000n);
    const expected = before - amount;
    log(`genesis before:  ${before}`);
    log(`feePayer before: ${beforeFee}`);
    log(`amount:          ${amount}`);
    log(`EXPECTED after:  ${expected}`);

    const address = await (fee.wallet as any).unshielded.getAddress();
    const hash = await withDustRetry(genesis, 'fund feePayer', () => sendUnshielded(genesis, address, amount));
    log(`submitted: ${hash}`);

    for (let i = 1; i <= 36; i++) {
      await sleep(5_000);
      const g: any = await (await import('rxjs')).firstValueFrom(genesis.wallet.state());
      const f: any = await (await import('rxjs')).firstValueFrom(fee.wallet.state());
      const gn = nightBalance(g);
      const fn = nightBalance(f);
      const gp = g?.unshielded?.progress;
      log(
        `t+${i * 5}s genesis=${gn} ${gn === expected ? '== EXPECTED' : `(delta ${gn - expected})`}` +
          ` feePayer=${fn} utxos=${(g?.unshielded?.availableCoins ?? []).length}` +
          ` progress applied=${gp?.appliedId} highest=${gp?.highestTransactionId}` +
          ` strictlyComplete=${gp?.isStrictlyComplete?.()}`,
      );
      if (gn === expected) {
        log(`CONVERGED after ~${i * 5}s`);
        return;
      }
    }
    log('DID NOT CONVERGE within 180s of sampling');
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
