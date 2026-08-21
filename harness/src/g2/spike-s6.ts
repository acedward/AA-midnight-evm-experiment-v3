// SPIKE S6 — MERGED-FEE DUST: does the maker really pay nothing, and what does the taker pay?
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// "The maker attached no DUST" is a claim this project makes in three different places (FR-301, the
// spec's headline, and the step ledger's per-step assertion), so it is worth establishing on more than
// one line of evidence. S6 uses three, of increasing directness:
//
//   1. THE MAKER'S ARTIFACT carries no dust actions at all. Necessary, but weak on its own: it says
//      nothing about what the settled transaction ended up looking like.
//   2. THE SETTLED TRANSACTION'S INTENTS. This is the decisive one. Fees are paid by dust actions,
//      dust actions belong to an INTENT, and the maker's intent is identifiable — it is the one
//      carrying the contract call. So "the maker paid nothing" becomes "the maker's intent has zero
//      dust spends while another intent has some", which is a structural fact about the committed
//      transaction rather than an inference.
//   3. THE MAKER WALLET'S OWN STATE, before and after, read from a FRESH facade (F-104). Listed LAST
//      because it is the weakest, and deliberately NOT the assertion a reader expects ("the maker's
//      dust balance is unchanged"), for two reasons. First, that number is not readable: the pinned
//      facade's dust accessors return 0 even for a wallet actively paying fees — 00005's own wallet
//      report printed `DUST=0` for the genesis wallet while it was funding the entire run. Second,
//      dust is GENERATED over time from registered NIGHT, so a real maker balance can legitimately
//      RISE across a settlement it did not pay for. What IS asserted is that the maker COULD have
//      paid — it holds NIGHT registered for dust generation — and that its own NIGHT is untouched.
//
// The maker is funded and DUST-registered on purpose. A maker that could not pay proves nothing: the
// claim would be true by accident, which is the failure mode this whole series exists to avoid.
//
// AND WHAT DOES SETTLEMENT COST? The plan asks for the fee magnitude against a plain transfer, so the
// spike measures an ordinary shielded transfer by the same taker on the same stack first. Watch for
// the known upstream fee-calculation cliff, `FeeCalculation(OutsideTimeToDismiss)` — the pinned SDK's
// own unshielded swap test is skipped because of it — and record size/time verbatim if it appears.
import { LANE_STAMP, SEEDS } from '../lane.js';
import * as ledger from '@midnightntwrk/ledger-v9';
import { closeParty } from '../wallet.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { buildSwapOffer } from '../offer/build.js';
import { takeOffer, type TakeResult } from '../offer/take.js';
import {
  bootstrapSwapRig,
  classifyRefusal,
  shieldedAddressOf,
  shieldedKeysOf,
  stamp,
  sweepShieldedTo,
  type SwapRig,
} from './swap-rig.js';
import {
  custodyTable,
  observationPointsAgree,
  observeCustody,
  publishAndReread,
  table,
  writeEvidence,
  writeFatal,
} from './spike-common.js';

const MINT_A = 8n;
const MINT_B = 12n;
const DEPOSIT_A = 6n;
const GIVE_A = 2n;
const WANT_B = 3n;
const BASELINE_TRANSFER = 1n;

const main = async () => {
  console.log(`# SPIKE S6 — merged-fee dust — ${LANE_STAMP} — ${stamp()}`);
  let rig: SwapRig | undefined;
  const partial: Record<string, unknown> = {};

  try {
    rig = await bootstrapSwapRig();
    const AA_A = { label: 'AA_A', id: rig.base.raw.AA_A };
    const AA_B = { label: 'AA_B', id: rig.base.raw.AA_B };
    const S_A = await rig.addColour('S_A', 'TOKA');
    const S_B = await rig.addColour('S_B', 'TOKB');

    await rig.mintTo(S_A, MINT_A, SEEDS.ownerN);
    await rig.mintTo(S_B, MINT_B, SEEDS.ownerT);
    await rig.depositFrom(SEEDS.ownerN, 'OwnerN', S_A, DEPOSIT_A, AA_A.id);
    await rig.base.waitForManagerNow(
      (m) => (m.pools[S_A.hex]?.value ?? 0n) === DEPOSIT_A,
      `pool(S_A) to reach ${DEPOSIT_A}`,
    );

    // --- BASELINE: what does an ORDINARY shielded transfer cost this taker? --------------------
    // Same wallet, same stack, same colour family — so the comparison is against something, not
    // against a remembered number from another project.
    const baselineBefore = await rig.observeFeeCapacity('OwnerT', SEEDS.ownerT);
    let baseline: { txId: string; feesSpecks?: string; dustSpent: string; error?: string };
    {
      const spender = await rig.base.openSpender('OwnerT-baseline', SEEDS.ownerT, [
        { colour: S_B.hex, shielded: true, amount: BASELINE_TRANSFER },
      ]);
      try {
        const target = await rig.base.openObserver('OwnerN-baseline-target', SEEDS.ownerN);
        let toAddress: unknown;
        try {
          toAddress = await shieldedAddressOf(target);
        } finally {
          await closeParty(target);
        }
        const sent = await sweepShieldedTo(spender.party, toAddress, S_B.hex, BASELINE_TRANSFER);
        const after = await rig.observeFeeCapacity('OwnerT', SEEDS.ownerT);
        baseline = {
          txId: sent.txId,
          feesSpecks: sent.feesSpecks,
          dustSpent: String(baselineBefore.dustBalance - after.dustBalance),
        };
        log(`baseline plain transfer: ${sent.txId}, declared fee ${sent.feesSpecks ?? 'n/a'} SPECKs`);
      } catch (e) {
        baseline = { txId: '(failed)', dustSpent: 'n/a', error: errorChain(e) };
        log(`baseline transfer FAILED — ${baseline.error}`);
      } finally {
        await spender.close();
      }
    }

    const before = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
    const makerFeesBefore = await rig.observeFeeCapacity('OwnerA', SEEDS.ownerA);
    const takerFeesBefore = await rig.observeFeeCapacity('OwnerT', SEEDS.ownerT);
    // The maker must be ABLE to pay, or the claim is vacuous. Registered NIGHT is what generates dust
    // and it IS observable; the dust balance is not reliably readable at these pins.
    if (makerFeesBefore.registeredNightUtxos <= 0) {
      throw new Error(
        'the maker has no NIGHT registered for dust generation — it could not have paid a fee, so ' +
          '"the maker paid nothing" would be vacuous',
      );
    }
    log(
      `maker fee capacity ${JSON.stringify(makerFeesBefore, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}; ` +
        `taker ${JSON.stringify(takerFeesBefore, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}`,
    );

    // --- the offer -----------------------------------------------------------------------------
    const offer = await buildSwapOffer({
      providers: rig.makerProviders,
      compiledManager: rig.compiledManager(),
      managerAddress: rig.base.managerAddress,
      shape: 'named-taker',
      gives: { colourRaw: S_A.raw, value: GIVE_A },
      wants: { colourRaw: S_B.raw, value: WANT_B },
      creditAccount: AA_A.id,
      makerAccount: AA_A.id,
      recipient: shieldedKeysOf(SEEDS.ownerT),
    });
    partial.offer = offer.terms.contentAddress;

    // The OFFER'S OWN declared fee, which is NOT the settlement fee — recorded to show it is small
    // and, more importantly, that the maker attaches no dust to cover it.
    let offerOwnFee: string;
    try {
      offerOwnFee = String(offer.proven.fees((ledger as any).LedgerParameters.initialParameters()));
    } catch (e) {
      offerOwnFee = `unavailable: ${errorChain(e)}`;
    }
    const makerIntentSegments = offer.placement.intentSegments;
    log(`offer intents at segments ${JSON.stringify(makerIntentSegments)}; own fees() = ${offerOwnFee}`);

    const published = publishAndReread(offer, 's6-namedtaker');

    // --- settle --------------------------------------------------------------------------------
    const spender = await rig.base.openSpender('OwnerT', SEEDS.ownerT, [
      { colour: S_B.hex, shielded: true, amount: WANT_B },
    ]);
    let take: TakeResult;
    try {
      take = await takeOffer(spender.party, published.file, { label: 'S6' });
    } finally {
      await spender.close();
    }

    let after = before;
    let makerFeesAfter = makerFeesBefore;
    let takerFeesAfter = takerFeesBefore;
    let opProblems: string[] = [];
    if (take.ok) {
      await rig.base.waitForManagerNow(
        (m) => (m.pools[S_B.hex]?.value ?? 0n) === WANT_B,
        `pool(S_B) to reach ${WANT_B}`,
      );
      after = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
      makerFeesAfter = await rig.observeFeeCapacity('OwnerA', SEEDS.ownerA);
      takerFeesAfter = await rig.observeFeeCapacity('OwnerT', SEEDS.ownerT);
      opProblems = observationPointsAgree(after.observation);
      log(
        `after: maker registered-NIGHT ${makerFeesBefore.registeredNightUtxos} -> ${makerFeesAfter.registeredNightUtxos}; ` +
          `taker NIGHT ${takerFeesBefore.nightBalance} -> ${takerFeesAfter.nightBalance}`,
      );
    } else {
      log(`S6: settlement REFUSED at ${take.stage} — ${take.error}`);
    }

    // --- evidence line 2: WHOSE INTENT PAID? ---------------------------------------------------
    const dustActions = take.merged?.dustActions ?? {};
    const makerSegments = makerIntentSegments.map(String);
    const makerDustSpends = makerSegments.reduce((n, s) => n + (dustActions[s]?.spends ?? 0), 0);
    const otherSegments = Object.keys(dustActions).filter((s) => !makerSegments.includes(s));
    const otherDustSpends = otherSegments.reduce((n, s) => n + (dustActions[s]?.spends ?? 0), 0);

    const feeCalcCliff = /OutsideTimeToDismiss|FeeCalculation/.test(String(take.error ?? ''));

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [
      {
        name: 'line 1 — the MAKER ARTIFACT carries no dust actions',
        ok: offer.terms.makerAttachedDust === false,
        detail: `makerAttachedDust=${offer.terms.makerAttachedDust}`,
      },
      { name: 'the settlement landed under ONE transaction id', ok: take.ok, detail: take.settlement?.txId ?? take.error ?? '' },
      {
        name: 'line 2 (decisive) — the MAKER\'S INTENT in the settled transaction has ZERO dust spends',
        ok: take.ok && makerDustSpends === 0,
        detail: `maker segments ${JSON.stringify(makerSegments)} -> ${makerDustSpends} dust spends`,
      },
      {
        name: 'line 2 (decisive) — ANOTHER intent DID attach dust, so the fee was really paid',
        ok: take.ok && otherDustSpends > 0,
        detail: `other segments ${JSON.stringify(otherSegments)} -> ${otherDustSpends} dust spends; full map ${JSON.stringify(dustActions)}`,
      },
      {
        name: 'line 3 — the maker COULD have paid: it holds NIGHT registered for dust generation',
        ok: makerFeesBefore.registeredNightUtxos > 0,
        detail: `${makerFeesBefore.registeredNightUtxos} registered NIGHT utxo(s), NIGHT ${makerFeesBefore.nightBalance}`,
      },
      {
        name: 'line 3 — the maker\'s own wallet state is unchanged by the settlement',
        ok: take.ok && makerFeesAfter.nightBalance === makerFeesBefore.nightBalance,
        detail: `maker NIGHT ${makerFeesBefore.nightBalance} -> ${makerFeesAfter.nightBalance}`,
      },
      {
        name: 'the merged transaction balanced with nothing left unswept',
        ok: take.ok && Object.keys(take.merged?.unswept ?? {}).length === 0,
        detail: JSON.stringify(take.merged?.unswept ?? {}),
      },
      { name: 'OP1 and OP2 agree on every cell', ok: opProblems.length === 0, detail: opProblems.join('; ') },
      {
        name: 'no upstream fee-calculation cliff (`FeeCalculation(OutsideTimeToDismiss)`)',
        ok: !feeCalcCliff,
        detail: feeCalcCliff ? 'OBSERVED — see the verbatim error' : 'not observed',
      },
    ];
    const failed = checks.filter((c) => !c.ok);
    const verdict = failed.length === 0 ? 'GREEN' : take.ok ? 'RED' : 'REFUSED';

    const settlementFee = take.settlement?.feesSpecks;
    // How wrong is the OFFER'S own fee estimate about the settlement? The direction matters: too high
    // is merely wasteful, too low would leave a taker short at submission.
    const offerVsSettlement =
      settlementFee && /^\d+$/.test(offerOwnFee) && BigInt(settlementFee) > 0n
        ? (Number((BigInt(offerOwnFee) * 100n) / BigInt(settlementFee)) / 100).toFixed(2)
        : null;
    const ratio =
      settlementFee && baseline.feesSpecks && BigInt(baseline.feesSpecks) > 0n
        ? (Number(BigInt(settlementFee) * 100n / BigInt(baseline.feesSpecks)) / 100).toFixed(2)
        : 'n/a';

    const md: string[] = [];
    md.push('# SPIKE S6 — merged-fee DUST: the maker pays nothing, the taker pays everything');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    md.push('## The three lines of evidence, weakest last');
    md.push('');
    md.push(
      ...table(
        ['Line', 'What it establishes', 'Reading'],
        [
          [
            '1 — the artifact',
            'the maker attached no dust when it built the offer',
            `\`makerAttachedDust = ${offer.terms.makerAttachedDust}\``,
          ],
          [
            '2 — the settled transaction\'s intents (**decisive**)',
            'fees are dust actions and dust actions belong to an intent, so this is structural, not inferred',
            `maker intent(s) ${JSON.stringify(makerSegments)}: **${makerDustSpends}** dust spends; other intent(s) ${JSON.stringify(otherSegments)}: **${otherDustSpends}**`,
          ],
          [
            '3 — the maker wallet\'s own state',
            'a consistency check only. The maker holds NIGHT REGISTERED for dust generation, so it could have paid; and its NIGHT is untouched by the settlement. The dust BALANCE is deliberately not used: the pinned facade\'s dust accessors read 0 even for a wallet that is actively paying fees',
            `registered NIGHT utxos ${makerFeesBefore.registeredNightUtxos}; NIGHT ${makerFeesBefore.nightBalance} → ${makerFeesAfter.nightBalance}`,
          ],
        ],
      ),
    );
    md.push('');
    md.push('Line 3 is listed last on purpose, and it is deliberately NOT "the maker\'s dust balance is');
    md.push('unchanged" — the assertion a reader expects. That assertion is unavailable and would be');
    md.push('misleading if it were: the pinned facade\'s dust accessors return 0 even for a wallet that is');
    md.push('demonstrably paying fees (00005\'s own wallet report printed `DUST=0` for the genesis wallet');
    md.push('while it was funding the entire run), and dust is GENERATED over time so a maker\'s real');
    md.push('balance can legitimately RISE across a settlement it did not pay for. It would also be');
    md.push('trivially satisfiable by using an unfunded maker, which would prove nothing at all. So what');
    md.push('is asserted instead is that the maker COULD have paid — it holds NIGHT registered for dust');
    md.push('generation — and that the decisive reading is line 2.');
    md.push('');
    md.push('## What settlement cost, against a plain transfer on the same stack');
    md.push('');
    md.push(
      ...table(
        ['Transaction', 'declared fee (SPECKs)', 'taker DUST spent', 'tx id'],
        [
          [
            `plain shielded transfer of ${BASELINE_TRANSFER} S_B`,
            baseline.feesSpecks ?? 'n/a',
            baseline.dustSpent,
            baseline.error ? `**failed:** \`${baseline.error}\`` : `\`${baseline.txId}\``,
          ],
          [
            'the MERGED swap settlement',
            settlementFee ?? 'n/a',
            String(takerFeesBefore.dustBalance - takerFeesAfter.dustBalance),
            take.settlement?.txId ? `\`${take.settlement.txId}\`` : '—',
          ],
        ],
      ),
    );
    md.push('');
    md.push(`Settlement fee / plain-transfer fee ≈ **${ratio}×**.`);
    md.push('');
    md.push(`The offer's OWN \`fees()\` figure is \`${offerOwnFee}\` SPECKs. That is **not** the settlement`);
    md.push('fee and must not be quoted as one: the fee actually paid belongs to the MERGED transaction the');
    md.push('taker submits, whose size the maker cannot know in advance.');
    md.push('');
    if (offerVsSettlement !== null) {
      md.push(
        `And the direction of the error matters: the offer's own figure is **${offerVsSettlement}× the fee ` +
          'actually paid**. ' +
          (Number(offerVsSettlement) > 1
            ? 'It OVERSTATES the real cost, so a maker that quoted it to a taker would be asking them to ' +
              'budget for more than the settlement needs — annoying but safe. '
            : 'It UNDERSTATES the real cost, which is the dangerous direction: a taker that budgeted from ' +
              'it would come up short at submission. '),
      );
      md.push('Either way the figure a taker should reason about is the merged transaction\'s, which only');
      md.push('exists after balancing — so an offer format cannot promise a settlement fee, and this one');
      md.push('does not try to.');
    }
    md.push('');
    md.push('## Custody, observed at TWO points');
    md.push('');
    md.push(...custodyTable(before.observation, after.observation));
    md.push('');
    md.push('## Checks');
    md.push('');
    md.push(...table(['#', 'Check', 'Result', 'Detail'], checks.map((c, i) => [String(i + 1), c.name, c.ok ? 'PASS' : '**FAIL**', c.detail || '—'])));
    md.push('');
    if (!take.ok) {
      md.push('## Verbatim refusal (F-202 clean)');
      md.push('');
      md.push('```');
      md.push(String(take.error));
      md.push('```');
      md.push('');
      md.push(`Refusing layer: **${classifyRefusal(take.stage, take.error, take.nodeRefusal)}**.`);
      if (feeCalcCliff) {
        md.push('');
        md.push('**This is the known upstream fee-calculation cliff.** The pinned wallet SDK\'s own unshielded');
        md.push('swap test is `it.skip` for `FeeCalculation(OutsideTimeToDismiss)`, so seeing it here is a');
        md.push('lane observation about the SDK, not a statement about the offer format.');
      }
    }

    writeEvidence(
      'S6',
      {
        spike: 'S6',
        label: LANE_STAMP,
        utc: stamp(),
        question: 'does the maker pay zero DUST and the taker cover the merged transaction\'s whole fee?',
        verdict,
        managerAddress: rig.base.managerAddress,
        colours: { S_A: S_A.hex, S_B: S_B.hex },
        baseline,
        offer: { terms: offer.terms, placement: offer.placement, ownFeesSpecks: offerOwnFee, proveMs: offer.proveMs },
        readerProcess: published.reader,
        feeCapacity: {
          maker: { before: makerFeesBefore, after: makerFeesAfter },
          taker: { before: takerFeesBefore, after: takerFeesAfter },
        },
        dustBalanceCaveat:
          'the pinned facade dust accessors read 0 even for wallets actively paying fees, so any dust ' +
          'balance here is "not readable", not "cannot pay". The decisive evidence is the settled ' +
          "transaction's per-intent dust actions (line 2).",
        settledIntentDustActions: dustActions,
        makerIntentSegments,
        makerDustSpends,
        otherDustSpends,
        settlementFeeSpecks: settlementFee ?? null,
        feeRatioVsPlainTransfer: ratio,
        offerOwnFeeVsSettlementFee: offerVsSettlement,
        feeCalculationCliffObserved: feeCalcCliff,
        before: before.observation,
        after: after.observation,
        take,
        observationPointProblems: opProblems,
        checks,
      },
      md,
    );

    console.log(`\n## S6 VERDICT: ${verdict}`);
    for (const f of failed) console.log(`   FAILED: ${f.name} — ${f.detail}`);
    if (verdict !== 'GREEN') process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS6 FAILED: ${err}`);
    writeFatal('S6', err, partial);
    process.exitCode = 1;
  } finally {
    if (rig) await rig.close();
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
