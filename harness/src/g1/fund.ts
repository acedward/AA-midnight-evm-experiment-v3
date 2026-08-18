// G1 Phase 4 — fund the fee wallet with NIGHT from genesis, register it for DUST generation,
// and prove a fee-paying smoke transaction.
//
// The mechanics live in `src/night.ts`, shared with the G3 step-ledger bootstrap so both gates
// exercise one implementation.
import { SEEDS } from '../lane.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import {
  dustBalance,
  fundWithNight,
  log,
  nightBalance,
  registerForDust,
  report,
  sendUnshielded,
  syncedState,
  units,
  waitFor,
  withDustRetry,
} from '../night.js';

const stamp = () => new Date().toISOString();

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
    report('feePayer(before)', await syncedState(fee));

    // --- 1. genesis -> feePayer NIGHT ---------------------------------------------------------
    // DUST accrues in proportion to NIGHT held, and the registration transaction itself costs
    // DUST. Fund generously so generation reaches the registration fee quickly.
    const fundHash = await fundWithNight(genesis, fee, units(1_000_000n));

    // --- 2. register feePayer's NIGHT for DUST generation ---------------------------------------
    // The authoritative proof that DUST generation works is not a balance read (DUST is a function
    // of time and the getter shape varies) — it is that the UTXOs are now registered and that a
    // later transaction's fees are actually payable from generated DUST.
    const regHash = await registerForDust(fee);
    const dusted = await syncedState(fee);
    report('feePayer(registered)', dusted);

    // --- 3. smoke transaction paid for by generated DUST ----------------------------------------
    const ownerNAddress = await (ownerN.wallet as any).unshielded.getAddress();
    const smokeAmount = units(1n);
    log(`smoke transfer: feePayer -> OwnerN ${smokeAmount} NIGHT (fees paid from generated DUST)`);
    report('ownerN(before)', await syncedState(ownerN));

    const smokeHash = await withDustRetry(fee, 'smoke transfer', () =>
      sendUnshielded(fee, ownerNAddress, smokeAmount),
    );
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
