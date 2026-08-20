// SPIKE S4b — the BEARER-KEY open offer (FR-308 v2b). The fallback rung of the openness ladder.
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Runs when S4 (floating surplus) is REFUTED. Openness is GREEN if EITHER shape settles for a holder
// whose keys the maker never knew; only if BOTH are refuted is openness RED.
//
// THE SHAPE, and its honest cost
//
// A contract-sent shielded coin's recipient is fixed at proving time, so the maker must name SOMEBODY.
// The bearer trick is to name a key the maker generates and immediately throws away, and to publish
// its secret inside the offer envelope. Any holder of the envelope can then settle the offer with
// stock calls, and afterwards sweep the A payout using the published secret.
//
// It needs NO new circuit — it is `openSwapShielded` with an unusual recipient — which is exactly why
// it is the fallback: it costs nothing to try and it cannot be blocked by a circuit-level refusal.
//
// The cost is real and is recorded rather than smoothed over: the payout is protected by a secret that
// travels with the offer, so after settlement EVERY holder of the envelope can race to sweep it and
// only the first wins. The envelope carries that warning in its own `note` field so it cannot be lost
// in transit, and this spike MEASURES the window rather than describing it.
//
// WHAT "OPEN" MEANS HERE, precisely, and what it does not
//   * The maker never knew the taker: the payout goes to the throwaway key, and OwnerT — whose seed
//     appears nowhere in the maker's providers — settles the offer and ends up with A.
//   * The maker DID fix a recipient. So this is openness by publishing a secret, not by leaving the
//     recipient unfixed, and the two must never be reported as the same thing.
import { LANE_STAMP, SEEDS } from '../lane.js';
import { closeParty, openParty } from '../wallet.js';
import { log, syncedState } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { buildSwapOffer, mintBearerKey } from '../offer/build.js';
import { takeOffer, type TakeResult } from '../offer/take.js';
import {
  bootstrapSwapRig,
  classifyRefusal,
  shieldedAddressOf,
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

const MINT_A_TO_OWNERN = 6n;
const MINT_B_TO_TAKER = 10n;
const DEPOSIT_A = 6n;
const GIVE_A = 2n;
const WANT_B = 3n;

const main = async () => {
  console.log(`# SPIKE S4b — bearer-key OPEN offer — ${LANE_STAMP} — ${stamp()}`);
  let rig: SwapRig | undefined;
  const partial: Record<string, unknown> = {};

  try {
    rig = await bootstrapSwapRig();
    const AA_A = { label: 'AA_A', id: rig.base.raw.AA_A };
    const AA_B = { label: 'AA_B', id: rig.base.raw.AA_B };

    const S_A = await rig.addColour('S_A', 'TOKA');
    const S_B = await rig.addColour('S_B', 'TOKB');
    const mintA = await rig.mintTo(S_A, MINT_A_TO_OWNERN, SEEDS.ownerN);
    const mintB = await rig.mintTo(S_B, MINT_B_TO_TAKER, SEEDS.ownerT);
    const depositTx = await rig.depositFrom(SEEDS.ownerN, 'OwnerN', S_A, DEPOSIT_A, AA_A.id);
    await rig.base.waitForManagerNow(
      (m) => (m.pools[S_A.hex]?.value ?? 0n) === DEPOSIT_A,
      `pool(S_A) to reach ${DEPOSIT_A}`,
    );

    // --- the throwaway key, and a funded wallet on it so it can pay for its own sweep -----------
    const bearer = mintBearerKey();
    partial.bearerCoinPublicKey = bearer.material.coinPublicKey;
    log(`bearer key generated: coinPk ${bearer.material.coinPublicKey.slice(0, 24)}…`);
    await rig.provisionWallet('bearer', bearer.seed);

    const before = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
    const takerBefore = {
      S_A: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_A.hex),
      S_B: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_B.hex),
    };
    const bearerBefore = await rig.observeShielded('bearer', bearer.seed, S_A.hex);
    const makerFeesBefore = await rig.observeFeeCapacity('OwnerA', SEEDS.ownerA);

    // --- build the offer, paying A to the throwaway key ----------------------------------------
    const offer = await buildSwapOffer({
      providers: rig.makerProviders,
      compiledManager: rig.compiledManager(),
      managerAddress: rig.base.managerAddress,
      shape: 'bearer-key',
      gives: { colourRaw: S_A.raw, value: GIVE_A },
      wants: { colourRaw: S_B.raw, value: WANT_B },
      creditAccount: AA_A.id,
      makerAccount: AA_A.id,
      bearer,
    });
    log(`S4b: offer proven. imbalances(0) = ${JSON.stringify(offer.placement.imbalances['0'])}`);

    const published = publishAndReread(offer, 's4b-bearer');
    // The envelope MUST carry the secret — that is the mechanism, and a reader with no other
    // information has to be able to find it.
    const secretTravelled = published.reader.terms?.bearerKey?.seedHex === bearer.seed;

    // --- settle: OwnerT, a wallet the maker never knew ------------------------------------------
    const spender = await rig.base.openSpender('OwnerT', SEEDS.ownerT, [
      { colour: S_B.hex, shielded: true, amount: WANT_B },
    ]);
    let take: TakeResult;
    try {
      take = await takeOffer(spender.party, published.file, { label: 'S4b' });
    } finally {
      await spender.close();
    }

    let afterSettle = before;
    let bearerAfterSettle = bearerBefore;
    let takerAfterSettle = takerBefore;
    let sweep: { txId: string; feesSpecks?: string } | undefined;
    let sweepError: string | undefined;
    let takerAfterSweep = takerBefore;
    let bearerAfterSweep = bearerBefore;
    let sweepSeconds: number | undefined;

    if (take.ok) {
      log(`S4b: SETTLED in ${take.settlement?.txId}`);
      await rig.base.waitForManagerNow(
        (m) => (m.pools[S_A.hex]?.value ?? 0n) === DEPOSIT_A - GIVE_A && (m.pools[S_B.hex]?.value ?? 0n) === WANT_B,
        `pool(S_A) to reach ${DEPOSIT_A - GIVE_A} and pool(S_B) to reach ${WANT_B}`,
      );
      afterSettle = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
      takerAfterSettle = {
        S_A: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_A.hex),
        S_B: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_B.hex),
      };
      // The payout is addressed to the PUBLISHED key, so it must appear in a wallet opened on the
      // published seed — and NOT in the taker's own wallet. That difference is the shape.
      bearerAfterSettle = await rig.observeShielded('bearer', bearer.seed, S_A.hex);
      log(`S4b: after settlement the bearer key holds ${bearerAfterSettle} S_A; OwnerT holds ${takerAfterSettle.S_A}`);

      // --- THE SWEEP: whoever read the envelope spends the payout -----------------------------
      const settleAt = Date.now();
      const sweeper = await openParty('bearer-sweeper', bearer.seed);
      try {
        await syncedState(sweeper);
        const takerObs = await rig.base.openObserver('OwnerT-sweep-target', SEEDS.ownerT);
        let takerAddress: unknown;
        try {
          takerAddress = await shieldedAddressOf(takerObs);
        } finally {
          await closeParty(takerObs);
        }
        sweep = await sweepShieldedTo(sweeper, takerAddress, S_A.hex, GIVE_A);
        sweepSeconds = Math.round((Date.now() - settleAt) / 1000);
      } catch (e) {
        sweepError = errorChain(e);
        log(`S4b: the SWEEP failed — ${sweepError}`);
      } finally {
        await closeParty(sweeper);
      }

      if (sweep) {
        takerAfterSweep = {
          S_A: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_A.hex),
          S_B: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_B.hex),
        };
        bearerAfterSweep = await rig.observeShielded('bearer', bearer.seed, S_A.hex);
        log(`S4b: after the sweep OwnerT holds ${takerAfterSweep.S_A} S_A; bearer holds ${bearerAfterSweep}`);
      }
    } else {
      log(`S4b: REFUSED at ${take.stage} — ${take.error}`);
      afterSettle = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
    }

    const makerFeesAfter = await rig.observeFeeCapacity('OwnerA', SEEDS.ownerA);
    const opProblems = take.ok ? observationPointsAgree(afterSettle.observation) : [];

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [
      {
        name: 'FR-302 placement: segment 0 carries exactly the −B deficit (the A leg is internally balanced)',
        ok: offer.placement.ok && Object.keys(offer.placement.imbalances['0'] ?? {}).length === 1,
        detail: JSON.stringify(offer.placement.imbalances['0']),
      },
      {
        name: 'the offer names the THROWAWAY key as A\'s recipient',
        ok: offer.terms.gives.recipient === bearer.material.coinPublicKey,
        detail: String(offer.terms.gives.recipient).slice(0, 40),
      },
      {
        name: 'the envelope carries the bearer SECRET across the process boundary',
        ok: secretTravelled,
        detail: `reader saw seedHex=${String(published.reader.terms?.bearerKey?.seedHex).slice(0, 16)}…`,
      },
      {
        name: 'FR-306: the envelope round-tripped byte-identically',
        ok: Boolean(published.reader.envelopeVerified && published.reader.roundTripByteIdentical),
        detail: `reader pid ${published.reader.process?.pid}`,
      },
      {
        name: 'the offer is unsubmittable alone (positively established offline)',
        ok: Boolean(published.reader.unsubmittableAlone?.proven),
        detail: String(published.reader.unsubmittableAlone?.error ?? ''),
      },
      { name: 'FR-301: the maker attached no DUST', ok: offer.terms.makerAttachedDust === false, detail: '' },
      { name: 'a wallet the maker never knew SETTLED the offer', ok: take.ok, detail: take.settlement?.txId ?? take.error ?? '' },
      {
        name: `custody moved: pool(S_A) ${DEPOSIT_A} -> ${DEPOSIT_A - GIVE_A}, pool(S_B) created = ${WANT_B}`,
        ok:
          take.ok &&
          afterSettle.observation.pools.S_A === String(DEPOSIT_A - GIVE_A) &&
          afterSettle.observation.pools.S_B === String(WANT_B),
        detail: JSON.stringify(afterSettle.observation.pools),
      },
      {
        name: 'the payout landed on the PUBLISHED key, not on the taker',
        ok: take.ok && bearerAfterSettle === bearerBefore + GIVE_A && takerAfterSettle.S_A === takerBefore.S_A,
        detail: `bearer S_A ${bearerBefore} -> ${bearerAfterSettle}; OwnerT S_A ${takerBefore.S_A} -> ${takerAfterSettle.S_A}`,
      },
      {
        name: 'THE OPEN CLAIM: the published secret SPENDS the payout (control, not just receipt)',
        ok: Boolean(sweep) && takerAfterSweep.S_A === takerBefore.S_A + GIVE_A && bearerAfterSweep === bearerBefore,
        detail: sweep
          ? `sweep ${sweep.txId}; OwnerT S_A -> ${takerAfterSweep.S_A}; bearer S_A -> ${bearerAfterSweep}`
          : `sweep failed: ${sweepError ?? 'not attempted'}`,
      },
      {
        name: 'the taker funded the deficit from its own coins',
        ok: take.ok && takerAfterSettle.S_B === takerBefore.S_B - WANT_B,
        detail: `OwnerT S_B ${takerBefore.S_B} -> ${takerAfterSettle.S_B}`,
      },
      {
        name: 'the MAKER attached no dust action to the settled transaction (and it COULD have paid)',
        ok:
          makerFeesBefore.registeredNightUtxos > 0 &&
          offer.placement.intentSegments.every((seg) => (take.merged?.dustActions?.[String(seg)]?.spends ?? 0) === 0),
        detail:
          `maker intent segment(s) ${JSON.stringify(offer.placement.intentSegments)}; settled dust actions ` +
          `${JSON.stringify(take.merged?.dustActions ?? {})}; maker NIGHT registered for dust: ` +
          `${makerFeesBefore.registeredNightUtxos}`,
      },
      { name: 'OP1 and OP2 agree on every cell', ok: opProblems.length === 0, detail: opProblems.join('; ') },
    ];
    const failed = checks.filter((c) => !c.ok);
    const settledAndSwept = take.ok && Boolean(sweep) && takerAfterSweep.S_A === takerBefore.S_A + GIVE_A;
    const verdict = failed.length === 0 ? 'GREEN' : settledAndSwept ? 'RED' : take.ok ? 'PARTIAL' : 'REFUTED';
    const layer = take.ok ? (sweepError ? 'the sweep transaction' : 'none') : classifyRefusal(take.stage, take.error, take.nodeRefusal);

    const md: string[] = [];
    md.push('# SPIKE S4b — the BEARER-KEY open offer (FR-308 v2b, the fallback rung)');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    if (verdict === 'GREEN') {
      md.push(
        'The maker paid colour A to a key it generated and discarded, published the secret inside the ' +
          'offer envelope, and OwnerT — a wallet whose keys appear nowhere in the maker\'s providers — ' +
          'settled the offer with stock facade calls and then SPENT the payout using the published ' +
          'secret. Openness is achieved by publishing a secret, **not** by leaving the recipient ' +
          'unfixed; those are different properties and must not be reported as the same one.',
      );
    } else if (verdict === 'PARTIAL') {
      md.push(
        'The offer SETTLED but the payout could not be swept with the published secret, so the offer ' +
          'is takeable without being fully usable by an arbitrary holder. See the check table.',
      );
    } else if (verdict === 'REFUTED') {
      md.push(`The settlement was refused at stage \`${take.stage}\`. **Refusing layer: ${layer}.**`);
    } else {
      md.push('Settled and swept, but an assertion failed — see the check table.');
    }
    md.push('');
    md.push('## The offer');
    md.push('');
    md.push(
      ...table(
        ['Field', 'Value'],
        [
          ['circuit', `\`${offer.circuitId}\` (**no new circuit** — that is why this is the cheap fallback)`],
          ['gives', `${offer.terms.gives.value} of S_A \`${S_A.hex}\``],
          ['recipient for A', `the THROWAWAY key \`${String(offer.terms.gives.recipient).slice(0, 32)}…\``],
          ['wants', `${offer.terms.wants.value} of S_B \`${S_B.hex}\``],
          ['content address', `\`${offer.terms.contentAddress}\``],
          ['bytes / prove time', `${offer.terms.transactionBytes} / ${offer.proveMs} ms`],
          ['imbalances(0)', `\`${JSON.stringify(offer.placement.imbalances['0'])}\``],
          ['bearer secret in envelope', `\`${bearer.material.seedHex.slice(0, 24)}…\` (${bearer.material.derivation})`],
        ],
      ),
    );
    md.push('');
    md.push('## Where colour A went, in two steps');
    md.push('');
    md.push(
      ...table(
        ['Holder', 'before', 'after settlement', 'after the sweep'],
        [
          ['bearer key (throwaway)', String(bearerBefore), String(bearerAfterSettle), String(bearerAfterSweep)],
          ['OwnerT (the taker)', String(takerBefore.S_A), String(takerAfterSettle.S_A), String(takerAfterSweep.S_A)],
        ],
      ),
    );
    md.push('');
    md.push('The two-step shape is the whole difference from the floating-surplus offer: A arrives at a');
    md.push('key, not at a wallet, and a SECOND transaction is needed to move it. That second transaction');
    md.push(sweep ? `is \`${sweep.txId}\`, submitted ${sweepSeconds} s after settlement.` : 'did not succeed here.');
    md.push('');
    md.push('## The race window, measured rather than described');
    md.push('');
    md.push(
      `The payout sat spendable-by-anyone-with-the-envelope from settlement until the sweep — ` +
        `**${sweepSeconds ?? 'n/a'} s** in this run, and unbounded in principle. Every holder of the ` +
        'envelope can attempt the same sweep and only the first wins. Consequences, stated plainly:',
    );
    md.push('');
    md.push('- Distributing a bearer offer to N holders means the A payout is a first-come prize among');
    md.push('  all N after any one of them settles, not a payment to the settler.');
    md.push('- The settler pays the fees but has no privileged claim on the payout.');
    md.push('- The floating-surplus shape does not have this property at all, because the surplus is');
    md.push('  swept inside the settling transaction by the settler\'s own balancer.');
    md.push('');
    md.push('## Custody, observed at TWO points');
    md.push('');
    md.push(...custodyTable(before.observation, afterSettle.observation));
    md.push('');
    md.push('## Checks');
    md.push('');
    md.push(...table(['#', 'Check', 'Result', 'Detail'], checks.map((c, i) => [String(i + 1), c.name, c.ok ? 'PASS' : '**FAIL**', c.detail || '—'])));
    md.push('');
    if (!take.ok || sweepError) {
      md.push('## Verbatim refusal (F-202 clean)');
      md.push('');
      md.push('```');
      md.push(String(take.error ?? sweepError));
      md.push('```');
      md.push('');
    }

    writeEvidence(
      'S4b',
      {
        spike: 'S4b',
        label: LANE_STAMP,
        utc: stamp(),
        question: 'can a holder whose keys the maker never knew settle a bearer-key contract offer and spend the payout?',
        verdict,
        refusingLayer: layer,
        managerAddress: rig.base.managerAddress,
        accounts: rig.base.ids,
        colours: { S_A: S_A.hex, S_B: S_B.hex },
        mints: { S_A: mintA, S_B: mintB },
        depositTx,
        bearer: bearer.material,
        offer: { terms: offer.terms, placement: offer.placement, proveMs: offer.proveMs, file: published.file },
        readerProcess: { ...published.reader },
        before: before.observation,
        afterSettle: afterSettle.observation,
        holders: {
          bearer: { before: String(bearerBefore), afterSettle: String(bearerAfterSettle), afterSweep: String(bearerAfterSweep) },
          taker: {
            before: { S_A: String(takerBefore.S_A), S_B: String(takerBefore.S_B) },
            afterSettle: { S_A: String(takerAfterSettle.S_A), S_B: String(takerAfterSettle.S_B) },
            afterSweep: { S_A: String(takerAfterSweep.S_A), S_B: String(takerAfterSweep.S_B) },
          },
        },
        makerFeeCapacity: { before: makerFeesBefore, after: makerFeesAfter },
        settledIntentDustActions: take.merged?.dustActions ?? {},
        take,
        sweep: sweep ?? { error: sweepError },
        raceWindowSeconds: sweepSeconds ?? null,
        observationPointProblems: opProblems,
        checks,
      },
      md,
    );

    console.log(`\n## S4b VERDICT: ${verdict}${verdict === 'GREEN' ? '' : ` (layer: ${layer})`}`);
    for (const f of failed) console.log(`   FAILED: ${f.name} — ${f.detail}`);
    // REFUTED and PARTIAL are RESULTS the FR-308 ladder expects; only a settled-and-swept run with a
    // broken assertion is this spike's own failure.
    if (verdict === 'RED') process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS4b FAILED: ${err}`);
    writeFatal('S4b', err, partial);
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
