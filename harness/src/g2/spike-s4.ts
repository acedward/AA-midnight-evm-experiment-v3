// SPIKE S4 — the FLOATING-SURPLUS open offer. Can a holder whose keys the maker never knew settle it?
// 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// THIS IS THE OWNER-REQUIRED OUTCOME. Owner Q1, 2026-08-19, verbatim: "we need a way to make this
// zswap useful in real cases - so that it can be used somehow by any user that has access to it."
// FR-308 v2 encodes that as a REQUIRED result with two shapes: floating surplus (this spike) and, if
// it is refuted, the bearer-key fallback (S4b). Both refuted = openness RED, reported prominently and
// never silently downgraded to the v1 named-taker result.
//
// WHAT MAKES THE SHAPE OPEN, precisely
//
// A contract-sent shielded coin's recipient is fixed at PROVING time — it enters the claimed
// commitment inside the proof — so a contract cannot `sendShielded` to "whoever takes this offer".
// `openSwapShielded` with `recipientA = none` sidesteps that by never creating an output for the
// value it gives: the pooled coin is consumed as a zswap input, its nullifier is claimed, only the
// change goes back to the pool, and the released amount stands as a POSITIVE imbalance at the
// guaranteed segment, addressed to nobody. Surplus is legal in zswap balancing where a deficit is
// fatal, so the taker's STOCK balancer can sweep it into an output of its own while funding the
// −B deficit. (One circuit serves both FR-308 shapes — finding F-307, a measured deploy-budget
// constraint — so what is under test here is the `none` BRANCH, not a separate contract entry point.)
//
// The taker-side half of that mechanism is already proven at these exact pins, wallet to wallet: the
// pinned SDK's own `swap.undeployed.test.ts` has wallet A give a token as a surplus and want another
// as a deficit, and wallet B's `balanceUnboundTransaction` funds the deficit and sweeps the surplus.
// What S4 adds is that the surplus comes from a CONTRACT's pooled coin.
//
// WHAT WAS ALREADY ESTABLISHED BEFORE THIS SPIKE RAN, so a refusal can be attributed rather than guessed
//   * the circuit compiles, with a verifier key (Plan 02 Phase 1);
//   * the `none` branch's zswap structure is {+A, −B} measured from the compiled circuit offline,
//     with every output addressed to the contract itself, and differing from the named branch in
//     EXACTLY one output — the payout (`swap.test.ts`);
//   * its claimed nullifier and commitments equal the STANDARD LIBRARY's for the same coin, so the
//     hand-written zswap hashes are not a source of error;
//   * the ledger's effects rules permit claiming no spend for a value with no output
//     (`verify.rs:1528`/`:1548`/`:1599`).
// So if this spike is refused, the interesting question is WHICH LAYER, and that is recorded.
//
// OBSERVATION (F-104: a wallet that submitted is never an observation point)
//   OP1  the Manager's ledger state from the indexer, decoded.
//   OP2  a proved on-chain circuit call, `shieldedAccountBalance`.
//   taker/maker balances: FRESH facades that have never submitted.
import { LANE_STAMP, SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { buildSwapOffer, type SwapOffer } from '../offer/build.js';
import { takeOffer, type TakeResult } from '../offer/take.js';
import { bootstrapSwapRig, classifyRefusal, stamp, type SwapRig } from './swap-rig.js';
import {
  custodyTable,
  observationPointsAgree,
  observeCustody,
  publishAndReread,
  table,
  writeEvidence,
  writeFatal,
  type CustodyObservation,
} from './spike-common.js';

const MINT_A_TO_OWNERN = 6n;
const MINT_B_TO_TAKER = 10n;
const DEPOSIT_A = 6n;
const GIVE_A = 2n;
const WANT_B = 3n;

const main = async () => {
  console.log(`# SPIKE S4 — floating-surplus OPEN offer — ${LANE_STAMP} — ${stamp()}`);
  let rig: SwapRig | undefined;
  const partial: Record<string, unknown> = {};

  try {
    rig = await bootstrapSwapRig();
    const AA_A = { label: 'AA_A', id: rig.base.raw.AA_A };
    const AA_B = { label: 'AA_B', id: rig.base.raw.AA_B };

    // --- two colours, two holders --------------------------------------------------------------
    const S_A = await rig.addColour('S_A', 'TOKA');
    const S_B = await rig.addColour('S_B', 'TOKB');
    partial.colours = { S_A: S_A.hex, S_B: S_B.hex };

    const mintA = await rig.mintTo(S_A, MINT_A_TO_OWNERN, SEEDS.ownerN);
    const mintB = await rig.mintTo(S_B, MINT_B_TO_TAKER, SEEDS.ownerT);

    // --- custody is funded the ORDINARY way: an unrelated user deposits ------------------------
    const depositTx = await rig.depositFrom(SEEDS.ownerN, 'OwnerN', S_A, DEPOSIT_A, AA_A.id);
    await rig.base.waitForManagerNow(
      (m) => (m.pools[S_A.hex]?.value ?? 0n) === DEPOSIT_A,
      `pool(S_A) to reach ${DEPOSIT_A} after OwnerN's deposit`,
    );

    const before = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
    const takerBefore = {
      S_A: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_A.hex),
      S_B: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_B.hex),
    };
    const makerDustBefore = await rig.observeDust('OwnerA', SEEDS.ownerA);
    log(
      `before: pools ${JSON.stringify(before.observation.pools)}; OwnerT holds ${takerBefore.S_A} S_A / ` +
        `${takerBefore.S_B} S_B; maker DUST ${makerDustBefore}`,
    );
    if (makerDustBefore <= 0n) {
      throw new Error('the maker holds NO dust — "the maker paid no fees" would be true by accident, proving nothing');
    }

    // --- BUILD the open offer. No recipient exists anywhere in it. -----------------------------
    let offer: SwapOffer;
    let buildError: string | undefined;
    try {
      offer = await buildSwapOffer({
        providers: rig.makerProviders,
        compiledManager: rig.compiledManager(),
        managerAddress: rig.base.managerAddress,
        shape: 'floating-surplus',
        gives: { colourRaw: S_A.raw, value: GIVE_A },
        wants: { colourRaw: S_B.raw, value: WANT_B },
        creditAccount: AA_A.id,
        makerAccount: AA_A.id,
      });
    } catch (e) {
      buildError = errorChain(e);
      const layer = classifyRefusal('build', buildError);
      log(`S4: the offer could not even be BUILT/PROVEN — layer: ${layer}`);
      const md = [
        '# SPIKE S4 — floating-surplus OPEN offer',
        '',
        `\`${LANE_STAMP}\` · recorded ${stamp()}`,
        '',
        '**VERDICT: REFUTED — the offer could not be built or proven.**',
        '',
        `**Refusing layer: ${layer}.**`,
        '',
        'Verbatim (F-202 clean — stack frames stripped):',
        '',
        '```',
        buildError,
        '```',
        '',
        'What this does and does not mean: the circuit COMPILES and has a verifier key, and its zswap',
        'structure was measured offline as `{+A, −B}` with every output addressed to the contract',
        '(`harness/src/test/swap.test.ts`). So this refusal is about producing or proving the',
        'transaction, not about the circuit being wrong shape. The bearer-key fallback (S4b) is the',
        'next rung of the FR-308 ladder and runs regardless.',
      ];
      writeEvidence(
        'S4',
        {
          spike: 'S4',
          label: LANE_STAMP,
          utc: stamp(),
          question: 'can a holder whose keys the maker never knew settle a floating-surplus contract offer?',
          verdict: 'REFUTED',
          stage: 'build',
          refusingLayer: layer,
          error: buildError,
          ...partial,
        },
        md,
      );
      console.log('\n## S4 VERDICT: REFUTED (build/prove) — see evidence/g2-spikes/S4.md');
      // A refuted S4 is a RESULT, not a harness failure: exit 0 so the gate goes on to S4b.
      return;
    }

    log(`S4: offer proven. imbalances(0) = ${JSON.stringify(offer.placement.imbalances['0'])}`);
    if (offer.terms.gives.recipient !== undefined) {
      throw new Error('a floating-surplus offer must name NO recipient — the terms carry one');
    }

    // --- PUBLISH as a file and re-read it in another process (FR-306) --------------------------
    const published = publishAndReread(offer, 's4-surplus');
    log(
      `S4: published ${published.file.split('/').pop()}; reader pid ${published.reader.process?.pid} ` +
        `verified=${published.reader.envelopeVerified} byteIdentical=${published.reader.roundTripByteIdentical} ` +
        `surpluses=${JSON.stringify(published.reader.surpluses)}`,
    );

    // Nothing may have changed on chain from building and proving alone.
    const midway = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
    const provingChangedState =
      JSON.stringify(midway.observation.pools) !== JSON.stringify(before.observation.pools) ||
      JSON.stringify(midway.observation.mapSizes) !== JSON.stringify(before.observation.mapSizes);
    if (provingChangedState) throw new Error('building and proving the offer changed on-chain state');

    // --- SETTLE with a wallet the maker never knew, using stock calls only ---------------------
    const spender = await rig.base.openSpender('OwnerT', SEEDS.ownerT, [
      { colour: S_B.hex, shielded: true, amount: WANT_B },
    ]);
    let take: TakeResult;
    try {
      take = await takeOffer(spender.party, published.file, { label: 'S4' });
    } finally {
      await spender.close();
    }

    let after: { observation: CustodyObservation } = midway;
    let takerAfter = takerBefore;
    let makerDustAfter = makerDustBefore;
    let opProblems: string[] = [];
    const expected = {
      poolA: DEPOSIT_A - GIVE_A,
      poolB: WANT_B,
      cellA: DEPOSIT_A - GIVE_A,
      cellB: WANT_B,
      takerA: takerBefore.S_A + GIVE_A,
      takerB: takerBefore.S_B - WANT_B,
    };

    if (take.ok) {
      log(`S4: SETTLED in ${take.settlement?.txId}`);
      await rig.base.waitForManagerNow(
        (m) => (m.pools[S_A.hex]?.value ?? 0n) === expected.poolA && (m.pools[S_B.hex]?.value ?? 0n) === expected.poolB,
        `pool(S_A) to reach ${expected.poolA} and pool(S_B) to reach ${expected.poolB}`,
      );
      after = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
      takerAfter = {
        S_A: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_A.hex),
        S_B: await rig.observeShielded('OwnerT', SEEDS.ownerT, S_B.hex),
      };
      makerDustAfter = await rig.observeDust('OwnerA', SEEDS.ownerA);
      opProblems = observationPointsAgree(after.observation);
    } else {
      log(`S4: REFUSED at ${take.stage} — ${take.error}`);
      after = await observeCustody(rig, [S_A, S_B], [AA_A, AA_B]);
    }

    // --- the verdict ---------------------------------------------------------------------------
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [
      {
        name: 'FR-302 placement: segment 0 carries exactly +A and −B, no other segment carries anything',
        ok: offer.placement.ok,
        detail: JSON.stringify(offer.placement.imbalances),
      },
      {
        name: 'the offer names NO recipient for colour A',
        ok: offer.terms.gives.recipient === undefined,
        detail: 'terms.gives.recipient absent',
      },
      {
        name: 'FR-301: the maker attached no DUST',
        ok: offer.terms.makerAttachedDust === false,
        detail: `makerAttachedDust=${offer.terms.makerAttachedDust}`,
      },
      {
        name: 'FR-306: the envelope round-tripped a real process boundary byte-identically',
        ok: Boolean(published.reader.envelopeVerified && published.reader.roundTripByteIdentical && published.reader.contentAddressMatches),
        detail: `reader pid ${published.reader.process?.pid}, ${published.reader.payloadBytes} bytes, sha ${String(published.reader.payloadSha256).slice(0, 16)}…`,
      },
      {
        name: 'the offer is unsubmittable alone (positively established offline)',
        ok: Boolean(published.reader.unsubmittableAlone?.proven),
        detail: String(published.reader.unsubmittableAlone?.error ?? published.reader.unsubmittableAlone?.note ?? ''),
      },
      {
        name: 'a reader with no network sees the +A surplus the terms declare',
        ok: published.reader.surpluses?.[`0/shielded:${S_A.hex}`] === String(GIVE_A),
        detail: JSON.stringify(published.reader.surpluses),
      },
      { name: 'proving alone changed no on-chain state', ok: !provingChangedState, detail: '' },
      { name: 'the take SETTLED', ok: take.ok, detail: take.settlement?.txId ?? take.error ?? '' },
      {
        name: `custody gave ${GIVE_A} S_A (pool ${DEPOSIT_A} -> ${expected.poolA})`,
        ok: take.ok && after.observation.pools.S_A === String(expected.poolA),
        detail: `pool(S_A)=${after.observation.pools.S_A}`,
      },
      {
        name: `custody gained ${WANT_B} S_B (pool created)`,
        ok: take.ok && after.observation.pools.S_B === String(expected.poolB),
        detail: `pool(S_B)=${after.observation.pools.S_B}`,
      },
      {
        name: 'the maker account was debited A and credited B',
        ok:
          take.ok &&
          after.observation.cells['AA_A/S_A'] === String(expected.cellA) &&
          after.observation.cells['AA_A/S_B'] === String(expected.cellB),
        detail: `AA_A/S_A=${after.observation.cells['AA_A/S_A']} AA_A/S_B=${after.observation.cells['AA_A/S_B']}`,
      },
      {
        name: 'THE OPEN CLAIM: the taker SWEPT the surplus — a wallet the maker never knew gained A',
        ok: take.ok && takerAfter.S_A === expected.takerA,
        detail: `OwnerT S_A ${takerBefore.S_A} -> ${takerAfter.S_A} (expected ${expected.takerA})`,
      },
      {
        name: 'the taker funded the deficit out of its own coins',
        ok: take.ok && takerAfter.S_B === expected.takerB,
        detail: `OwnerT S_B ${takerBefore.S_B} -> ${takerAfter.S_B} (expected ${expected.takerB})`,
      },
      {
        name: 'the MAKER spent no DUST (and it held some, so it could have)',
        ok: take.ok && makerDustAfter >= makerDustBefore,
        detail: `maker DUST ${makerDustBefore} -> ${makerDustAfter}`,
      },
      { name: 'OP1 and OP2 agree on every cell', ok: opProblems.length === 0, detail: opProblems.join('; ') },
      {
        name: 'exact map sizes after settlement',
        ok: take.ok && JSON.stringify(after.observation.mapSizes) === JSON.stringify({ pools: 2, shieldedCells: 2, unshieldedCells: 0 }),
        detail: JSON.stringify(after.observation.mapSizes),
      },
    ];
    const failed = checks.filter((c) => !c.ok);
    const verdict = failed.length === 0 ? 'GREEN' : take.ok ? 'RED' : 'REFUTED';
    const layer = take.ok ? 'none' : classifyRefusal(take.stage, take.error);

    const md: string[] = [];
    md.push('# SPIKE S4 — the FLOATING-SURPLUS open offer (FR-308 v2a, owner-REQUIRED)');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    if (verdict === 'GREEN') {
      md.push(
        `A contract released ${GIVE_A} of colour S_A as a floating surplus addressed to NOBODY, and ` +
          'OwnerT — a wallet whose keys appear nowhere in the maker\'s providers and which the maker ' +
          'never named — swept it with STOCK facade calls while funding the offer\'s −S_B deficit. ' +
          'The whole swap settled under ONE transaction id and the maker paid no DUST.',
      );
    } else if (verdict === 'REFUTED') {
      md.push(`The settlement was refused at stage \`${take.stage}\`. **Refusing layer: ${layer}.**`);
    } else {
      md.push('The settlement was accepted but one or more assertions failed — see the check table.');
    }
    md.push('');
    md.push('## The offer');
    md.push('');
    md.push(
      ...table(
        ['Field', 'Value'],
        [
          ['circuit', `\`${offer.circuitId}\``],
          ['shape', `\`${offer.terms.shape}\``],
          ['gives', `${offer.terms.gives.value} of S_A \`${S_A.hex}\``],
          ['recipient for A', offer.terms.gives.recipient ?? '**none — that is the point**'],
          ['wants', `${offer.terms.wants.value} of S_B \`${S_B.hex}\``],
          ['credited to', `AA_A \`${offer.terms.creditAccount}\``],
          ['form (D-306)', `\`${offer.terms.form}\``],
          ['content address', `\`${offer.terms.contentAddress}\``],
          ['bytes', String(offer.terms.transactionBytes)],
          ['proving time', `${offer.proveMs} ms`],
          ['imbalances(0)', `\`${JSON.stringify(offer.placement.imbalances['0'])}\``],
          ['other segments', offer.placement.offendingSegments.length ? offer.placement.offendingSegments.join('; ') : 'none'],
          ['maker attached DUST', String(offer.terms.makerAttachedDust)],
        ],
      ),
    );
    md.push('');
    md.push('## Custody, observed at TWO points');
    md.push('');
    md.push(...custodyTable(before.observation, after.observation));
    md.push('');
    md.push('## The independent wallet');
    md.push('');
    md.push(
      ...table(
        ['Holder', 'S_A before', 'S_A after', 'S_B before', 'S_B after'],
        [
          ['OwnerT (taker)', String(takerBefore.S_A), String(takerAfter.S_A), String(takerBefore.S_B), String(takerAfter.S_B)],
        ],
      ),
    );
    md.push('');
    md.push(`Maker (OwnerA) DUST: ${makerDustBefore} → ${makerDustAfter}. The maker is funded and`);
    md.push('DUST-registered on purpose, so "the maker paid no fees" is a measurement rather than a');
    md.push('consequence of the maker being unable to pay at all.');
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
      md.push(`Refusing layer: **${layer}**.`);
      md.push('');
    }
    md.push('## `validateTransaction` outcomes — recorded, never gating (finding F-303)');
    md.push('');
    md.push(
      ...table(
        ['flags', 'passed', 'error'],
        (take.settlement?.validations ?? []).map((v) => [
          `\`${JSON.stringify(v.flags)}\``,
          String(v.passed),
          v.error ? `\`${v.error}\`` : '—',
        ]),
      ),
    );
    md.push('');
    md.push('On this lane the pinned facade validates against a BLANK `LedgerState`, so every offer that');
    md.push('calls a deployed contract is refused with `call to non-existant contract …` even at the');
    md.push('strictest flags — and the very same transactions commit. Recorded, never gating.');
    md.push('');
    md.push('## The reader process (FR-306)');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify({ ...published.reader, terms: '(see s4.json)' }, null, 2));
    md.push('```');

    writeEvidence(
      'S4',
      {
        spike: 'S4',
        label: LANE_STAMP,
        utc: stamp(),
        question: 'can a holder whose keys the maker never knew settle a floating-surplus contract offer?',
        verdict,
        refusingLayer: layer,
        managerAddress: rig.base.managerAddress,
        accounts: rig.base.ids,
        colours: { S_A: S_A.hex, S_B: S_B.hex },
        mints: { S_A: mintA, S_B: mintB },
        depositTx,
        amounts: { deposited: String(DEPOSIT_A), gives: String(GIVE_A), wants: String(WANT_B) },
        offer: { terms: offer.terms, placement: offer.placement, proveMs: offer.proveMs, file: published.file.replace(`${process.cwd()}/`, '') },
        readerProcess: published.reader,
        before: before.observation,
        midway: midway.observation,
        after: after.observation,
        taker: { before: takerBefore, after: takerAfter },
        makerDust: { before: String(makerDustBefore), after: String(makerDustAfter) },
        take,
        observationPointProblems: opProblems,
        checks,
      },
      md,
    );

    console.log(`\n## S4 VERDICT: ${verdict}${verdict === 'GREEN' ? '' : ` (layer: ${layer})`}`);
    for (const f of failed) console.log(`   FAILED: ${f.name} — ${f.detail}`);
    // A REFUTED S4 is a result the plan expects and S4b answers; only a RED (settled but wrong)
    // is a failure of this spike.
    if (verdict === 'RED') process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS4 FAILED: ${err}`);
    writeFatal('S4', err, partial);
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
