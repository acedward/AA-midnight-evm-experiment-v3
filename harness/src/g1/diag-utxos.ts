import * as rx from 'rxjs';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { nightBalance, syncedState } from '../night.js';

const main = async () => {
  const parties: Party[] = [];
  try {
    for (const name of ['genesis', 'feePayer'] as const) {
      const p = await openParty(name, (SEEDS as any)[name]);
      parties.push(p);
      const s: any = await syncedState(p);
      const coins = s?.unshielded?.availableCoins ?? [];
      console.log(`\n=== ${name}: balance=${nightBalance(s)} availableCoins=${coins.length}`);
      console.log(`    balances map: ${JSON.stringify(s?.unshielded?.balances, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))}`);
      for (const c of coins) {
        const u = c?.utxo ?? c;
        console.log(`    utxo value=${u?.value} type=${String(u?.type).slice(0, 18)} registeredForDustGeneration=${u?.registeredForDustGeneration ?? c?.registeredForDustGeneration}`);
      }
      const pend = s?.unshielded?.pendingCoins ?? s?.unshielded?.pending ?? null;
      if (pend) console.log(`    pending: ${JSON.stringify(pend, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))}`);
    }
  } finally {
    for (const p of parties) await closeParty(p);
  }
};
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
