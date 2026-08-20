// SPIKE S5b — HOW MUCH custody state can the Manager hold and still make a PUBLISHABLE offer?
// (lane issue 0003, FR-302.) 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// WHY THIS SPIKE EXISTS. Gate run 1 hit lane issue 0003 for real: an offer's whole value leg landed in
// the FALLIBLE section and FR-302 failed closed rather than publish an offer no taker could settle. A
// fallible offer is not a worse offer, it is not an offer — balancing is per (token, segment) and an
// independent taker can only reach segment 0. So "which offers can be published" is a precondition for
// the entire step ledger, and it has to be measured.
//
// THE FIRST ATTEMPT AT THIS SPIKE GOT THE WRONG ANSWER, AND THAT IS WHY IT IS NOW SHAPED LIKE THIS.
// It hypothesised that the trigger was `claimWantedColour`'s merge branch — the extra zswap input and
// nullifier claim you pay when the WANTED colour already has a pool — and tested a 2x2 of
// {shape} x {wanted pool exists}. All four cells came back FALLIBLE, including the two that should have
// been fine by that hypothesis. The hypothesis was wrong, and the 2x2 could not see why, because it
// held constant the thing that actually mattered: it ran with TWO pools and TWO cells already in
// custody, while S4 and S6 — whose offers were guaranteed and settled — ran with ONE of each.
//
// So the variable is the SIZE of the Manager's custody state, and the honest experiment is a
// DOSE-RESPONSE: grow the state one step at a time and build an offer at every step, until placement
// flips. That also separates the two dimensions, which the 2x2 could not:
//
//   step 1   deposit G to AA_A          pools 1, cells 1     <- the state S4/S6 published from
//   step 2   deposit G to AA_B          pools 1, cells 2     <- +1 CELL, pools held constant
//   step 3   deposit F1 to AA_A         pools 2, cells 3     <- +1 POOL
//   step 4   deposit F2 to AA_A         pools 3, cells 4     <- +1 POOL again, to confirm monotonicity
//
// Every offer gives colour G and wants a FRESH colour with no pool, so the merge branch is never taken
// and the only thing changing between steps is how much state the transcript reads.
//
// THE MECHANISM, read from the pinned sources so this measures something specific. The SDK does not
// choose the split: it asks which HALF of the PARTITIONED TRANSCRIPT claims each zswap item
// (`midnight-js-contracts/dist/index.mjs:810-830`). The partition is the ledger's —
// `partition_transcripts`, `midnight-ledger/ledger/src/construct.rs:1009` — and it is a COST BUDGET
// decision: the transcript is cut into sections at `Op::Ckpt`, the guaranteed budget derives from
// `params.limits.min_time_to_dismiss` (15 ms) less a per-transaction reserve, and the partitioner fits
// as many sections as it can. **If none fit, ZERO sections are guaranteed and everything goes
// fallible** — which is exactly the `observed at segment 0: {}` the failures show. A bigger custody map
// means deeper Merkle paths and more hashing per read, so cost rises with state size. That is the
// thing being dosed.
//
// NOTHING IS SUBMITTED BY THE MEASUREMENT. The deposits are real (they are the dose), but every offer
// is build + prove only, read for its placement, and discarded — `measureOnly` so the report survives
// for the fallible cases too.
import { LANE_STAMP, SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { buildSwapOffer } from '../offer/build.js';
import { bootstrapSwapRig, shieldedKeysOf, stamp, type Colour, type SwapRig } from './swap-rig.js';
import { observeCustody, table, writeEvidence, writeFatal } from './spike-common.js';

const MINT_G = 40n;
const DEPOSIT_G_AA_A = 8n;
const DEPOSIT_G_AA_B = 2n;
const MINT_FILLER = 6n;
const DEPOSIT_FILLER = 2n;
const GIVE = 1n;
const WANT = 1n;
/** How many POOL-adding steps to take after the cell-only step. */
const FILLER_STEPS = Number(process.env.S5B_FILLER_STEPS ?? 2);

type Step = {
  step: number;
  what: string;
  pools: number;
  cells: number;
  /** One measurement per offer shape at this state size. */
  offers: Array<{
    shape: 'named-taker' | 'floating-surplus';
    built: boolean;
    guaranteed: boolean;
    segments?: number[];
    intentSegments?: number[];
    fallibleOfferSegments?: number[];
    imbalancesAtSegment0?: Record<string, string>;
    imbalancesElsewhere?: Record<string, Record<string, string>>;
    proveMs?: number;
    error?: string;
  }>;
};

const main = async () => {
  console.log(`# SPIKE S5b — how much custody state still allows a PUBLISHABLE offer? — ${LANE_STAMP} — ${stamp()}`);
  let rig: SwapRig | undefined;
  const steps: Step[] = [];

  try {
    rig = await bootstrapSwapRig();
    const AA_A = { label: 'AA_A', id: rig.base.raw.AA_A };
    const AA_B = { label: 'AA_B', id: rig.base.raw.AA_B };

    // The GIVE colour. Deposited to AA_A in step 1 and to AA_B in step 2, so step 2 adds a CELL
    // without adding a POOL — the only way to tell the two dimensions apart.
    const G = await rig.addColour('G', 'TOKG');
    await rig.mintTo(G, MINT_G, SEEDS.ownerN);

    const colours: Colour[] = [G];
    let wantSeq = 0;

    /** Build one offer of each shape at the CURRENT state size, measuring placement without publishing. */
    const measureHere = async (step: number, what: string): Promise<Step> => {
      const view = await observeCustody(rig!, colours, [AA_A, AA_B], { op2: false });
      const sizes = view.observation.mapSizes;
      const record: Step = { step, what, pools: sizes.pools!, cells: sizes.shieldedCells!, offers: [] };
      console.log(`\n## step ${step} — ${what} (pools ${record.pools}, shielded cells ${record.cells})`);

      for (const shape of ['named-taker', 'floating-surplus'] as const) {
        // A FRESH wanted colour every time, so `claimWantedColour` never takes its merge branch and the
        // only thing varying across steps is how much state the transcript reads.
        const wanted = await rig!.addColour(`W${++wantSeq}`, `TOKW${wantSeq}`);
        try {
          const offer = await buildSwapOffer({
            providers: rig!.makerProviders,
            compiledManager: rig!.compiledManager(),
            managerAddress: rig!.base.managerAddress,
            shape,
            gives: { colourRaw: G.raw, value: GIVE },
            wants: { colourRaw: wanted.raw, value: WANT },
            creditAccount: AA_A.id,
            makerAccount: AA_A.id,
            ...(shape === 'named-taker' ? { recipient: shieldedKeysOf(SEEDS.ownerT) } : {}),
            measureOnly: true, // read the placement even when it is wrong; never published
          });
          const p = offer.placement;
          const elsewhere: Record<string, Record<string, string>> = {};
          for (const [seg, m] of Object.entries(p.imbalances)) {
            if (seg !== '0' && Object.keys(m).length > 0) elsewhere[seg] = m;
          }
          record.offers.push({
            shape,
            built: true,
            guaranteed: p.ok,
            segments: p.segments,
            intentSegments: p.intentSegments,
            fallibleOfferSegments: p.fallibleOfferSegments,
            imbalancesAtSegment0: p.imbalances['0'],
            imbalancesElsewhere: elsewhere,
            proveMs: offer.proveMs,
          });
          log(
            `  ${shape}: ${p.ok ? 'GUARANTEED — publishable' : 'FALLIBLE — NOT publishable'}; ` +
              `imbalances(0) = ${JSON.stringify(p.imbalances['0'])}; fallible segments ${JSON.stringify(p.fallibleOfferSegments)}`,
          );
        } catch (e) {
          const err = errorChain(e);
          record.offers.push({ shape, built: false, guaranteed: false, error: err });
          log(`  ${shape}: could not be built at all — ${err.slice(0, 160)}`);
        }
      }
      steps.push(record);
      return record;
    };

    // --- step 1: the state S4 and S6 published from --------------------------------------------
    await rig.depositFrom(SEEDS.ownerN, 'OwnerN-g-a', G, DEPOSIT_G_AA_A, AA_A.id);
    await rig.base.waitForManagerNow((m) => (m.pools[G.hex]?.value ?? 0n) === DEPOSIT_G_AA_A, `pool(G) = ${DEPOSIT_G_AA_A}`);
    await measureHere(1, `deposit ${DEPOSIT_G_AA_A} G to AA_A — the state S4/S6 published from`);

    // --- step 2: +1 CELL, pools unchanged --------------------------------------------------------
    await rig.depositFrom(SEEDS.ownerN, 'OwnerN-g-b', G, DEPOSIT_G_AA_B, AA_B.id);
    await rig.base.waitForManagerNow(
      (m) => (m.pools[G.hex]?.value ?? 0n) === DEPOSIT_G_AA_A + DEPOSIT_G_AA_B,
      `pool(G) = ${DEPOSIT_G_AA_A + DEPOSIT_G_AA_B}`,
    );
    await measureHere(2, `deposit ${DEPOSIT_G_AA_B} G to AA_B — ONE MORE CELL, pool count unchanged`);

    // --- steps 3..: +1 POOL each ----------------------------------------------------------------
    for (let i = 1; i <= FILLER_STEPS; i++) {
      const filler = await rig.addColour(`F${i}`, `TOKF${i}`);
      colours.push(filler);
      await rig.mintTo(filler, MINT_FILLER, SEEDS.ownerN);
      await rig.depositFrom(SEEDS.ownerN, `OwnerN-f${i}`, filler, DEPOSIT_FILLER, AA_A.id);
      await rig.base.waitForManagerNow(
        (m) => (m.pools[filler.hex]?.value ?? 0n) === DEPOSIT_FILLER,
        `pool(${filler.label}) = ${DEPOSIT_FILLER}`,
      );
      await measureHere(2 + i, `deposit ${DEPOSIT_FILLER} ${filler.label} to AA_A — ONE MORE POOL`);
    }

    // --- the reading -----------------------------------------------------------------------------
    const flat = steps.flatMap((s) => s.offers.map((o) => ({ ...o, pools: s.pools, cells: s.cells, step: s.step })));
    const guaranteed = flat.filter((o) => o.guaranteed);
    const fallible = flat.filter((o) => !o.guaranteed);
    const lastGuaranteedStep = guaranteed.length ? Math.max(...guaranteed.map((o) => o.step)) : null;
    const firstFallibleStep = fallible.length ? Math.min(...fallible.map((o) => o.step)) : null;
    const shapesAgreeEverywhere = steps.every((s) => new Set(s.offers.map((o) => o.guaranteed)).size === 1);
    const monotone =
      firstFallibleStep === null ||
      steps.filter((s) => s.step >= firstFallibleStep).every((s) => s.offers.every((o) => !o.guaranteed));

    const boundary =
      firstFallibleStep === null
        ? `no boundary found within ${steps.length} steps — every offer was publishable`
        : lastGuaranteedStep === null
          ? `every offer was already unpublishable at step 1 (pools ${steps[0]!.pools}, cells ${steps[0]!.cells})`
          : `between step ${lastGuaranteedStep} (pools ${steps.find((s) => s.step === lastGuaranteedStep)!.pools}, cells ${steps.find((s) => s.step === lastGuaranteedStep)!.cells}) and step ${firstFallibleStep} (pools ${steps.find((s) => s.step === firstFallibleStep)!.pools}, cells ${steps.find((s) => s.step === firstFallibleStep)!.cells})`;

    const verdict = `MEASURED — the publishability boundary lies ${boundary}`;

    const checks = [
      {
        name: 'the dose-response is MONOTONE (once unpublishable, it stays unpublishable)',
        ok: monotone,
        detail: steps.map((s) => `s${s.step}(${s.pools}p/${s.cells}c):${s.offers.every((o) => o.guaranteed) ? 'G' : 'F'}`).join(' '),
      },
      {
        name: 'both offer SHAPES flip together — placement is about state, not shape',
        ok: shapesAgreeEverywhere,
        detail: steps
          .map((s) => `s${s.step}:${s.offers.map((o) => `${o.shape === 'named-taker' ? 'n' : 's'}=${o.guaranteed ? 'G' : 'F'}`).join(',')}`)
          .join(' '),
      },
      {
        name: 'a boundary was actually located (otherwise the dose range was too narrow)',
        ok: firstFallibleStep !== null && lastGuaranteedStep !== null,
        detail: boundary,
      },
      {
        name: 'every offer either built or failed ONLY on placement (no unrelated build errors)',
        ok: flat.every((o) => o.built),
        detail: flat.filter((o) => !o.built).map((o) => String(o.error).slice(0, 90)).join('; ') || 'all built',
      },
    ];
    const notAsPredicted = checks.filter((c) => !c.ok);

    const md: string[] = [];
    md.push('# SPIKE S5b — how much custody state still allows a PUBLISHABLE offer? (issue 0003, FR-302)');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    md.push('## Why this matters in one sentence');
    md.push('');
    md.push('Balancing is per (token, segment) and an independent taker can only reach segment 0, so an');
    md.push('offer whose value leg sits in the FALLIBLE section cannot be settled by anyone. Publishability');
    md.push('is therefore a precondition for the whole step ledger — not a quality of the offer but a');
    md.push('property of how much state the Manager is holding when the offer is built.');
    md.push('');
    md.push('## The dose-response');
    md.push('');
    md.push(
      ...table(
        ['step', 'what changed', 'pools', 'cells', 'named-taker', 'floating-surplus', 'imbalances(0) observed'],
        steps.map((s) => [
          String(s.step),
          s.what,
          String(s.pools),
          String(s.cells),
          s.offers.find((o) => o.shape === 'named-taker')?.guaranteed ? 'GUARANTEED' : '**FALLIBLE**',
          s.offers.find((o) => o.shape === 'floating-surplus')?.guaranteed ? 'GUARANTEED' : '**FALLIBLE**',
          `\`${JSON.stringify(s.offers[0]?.imbalancesAtSegment0 ?? {})}\``,
        ]),
      ),
    );
    md.push('');
    md.push('Every offer gives the same colour and wants a FRESH colour with no pool, so');
    md.push('`claimWantedColour`\'s merge branch is never taken and the only thing varying across steps is');
    md.push('how much state the transcript reads. Step 2 adds a CELL without adding a POOL, which is the');
    md.push('only way to tell those two dimensions apart.');
    md.push('');
    md.push('## What this corrects');
    md.push('');
    md.push('The first version of this spike hypothesised that the trigger was the merge branch you pay');
    md.push('for when the WANTED colour already has a pool, and tested a 2×2 of {shape} × {wanted pool');
    md.push('exists}. **All four cells came back FALLIBLE**, including the two the hypothesis said should');
    md.push('be fine — because that 2×2 held constant the thing that actually mattered: it ran with two');
    md.push('pools and two cells already in custody, while S4 and S6, whose offers were guaranteed and');
    md.push('settled, ran with one of each. The hypothesis was wrong and the design could not see it.');
    md.push('Recorded because a refuted hypothesis that looked confirmed for the wrong reason is exactly');
    md.push('the kind of thing that quietly becomes folklore.');
    md.push('');
    md.push('## The mechanism, from the pinned sources');
    md.push('');
    md.push('The SDK does not choose the split. It asks which half of the PARTITIONED TRANSCRIPT claims');
    md.push('each zswap item (`midnight-js-contracts/dist/index.mjs:810-830`) and buckets accordingly. The');
    md.push('partition is the ledger\'s: `partition_transcripts`');
    md.push('(`midnight-ledger/ledger/src/construct.rs:1009`) cuts the transcript at `Op::Ckpt`');
    md.push('checkpoints, derives a guaranteed budget from `params.limits.min_time_to_dismiss` (15 ms) less');
    md.push('a per-transaction reserve, and fits as many sections as it can — **and if none fit, ZERO are');
    md.push('guaranteed and everything goes fallible.** That is why the failing rows read');
    md.push('`imbalances(0) = {}` rather than showing a partially-placed offer: it is all-or-nothing.');
    md.push('');
    md.push('A larger custody map means deeper Merkle paths and more hashing per read, so transcript cost');
    md.push('rises with state size. The table above is where that cost crosses the budget.');
    md.push('');
    md.push('## Consequences — read before writing the step ledger');
    md.push('');
    if (firstFallibleStep !== null && lastGuaranteedStep !== null) {
      const g = steps.find((s) => s.step === lastGuaranteedStep)!;
      const f = steps.find((s) => s.step === firstFallibleStep)!;
      md.push(`- **The Manager can publish offers while it holds ${g.pools} pool(s) and ${g.cells} cell(s), and cannot`);
      md.push(`  once it holds ${f.pools} pool(s) and ${f.cells} cell(s).** That is a very tight budget, and it is a`);
      md.push('  property of the lane\'s cost model, not of the contract\'s logic.');
      md.push('- **The spec\'s step ledger is affected beyond step 6.** Step 5 settles and leaves custody');
      md.push('  holding two pools and two cells, which is at or past this boundary — so OFFER-2 (step 7) and');
      md.push('  the offers in steps 9–12 may not be publishable at all. Plan 03 has to establish the');
      md.push('  reachable subset first and record the rest as measured lane limits, not as failures.');
      md.push('- **It does not touch the openness result.** S4 built at one pool and one cell, placed exactly');
      md.push('  at segment 0, and settled — as did S6. Those results stand exactly as reported.');
      md.push('- **The lever, if one is wanted, is transcript COST.** The budget is a ceiling, so anything');
      md.push('  that makes the transcript cheaper moves the boundary: fewer map reads per circuit, or a');
      md.push('  `Ckpt` placed before the expensive part so the partitioner has somewhere to cut. Both are');
      md.push('  contract/compiler design questions, recorded here rather than attempted.');
    } else if (firstFallibleStep === null) {
      md.push('- No boundary was found in this range. The dose needs to go further before any limit is');
      md.push('  claimed; do not read this as "there is no limit".');
    } else {
      md.push('- Even the smallest state tested could not publish an offer, which contradicts S4 and S6');
      md.push('  having published and settled. Something differs between this rig and theirs; the boundary');
      md.push('  is NOT established and must not be quoted.');
    }
    md.push('');
    md.push('## Checks');
    md.push('');
    md.push(...table(['#', 'Check', 'Result', 'Detail'], checks.map((c, i) => [String(i + 1), c.name, c.ok ? 'PASS' : '**NOT AS PREDICTED**', c.detail || '—'])));
    md.push('');
    md.push('## Verbatim placement reports for the unpublishable offers');
    md.push('');
    let shown = 0;
    for (const s of steps) {
      for (const o of s.offers) {
        if (o.guaranteed || shown >= 4) continue;
        shown++;
        md.push(`- **step ${s.step} (${s.pools}p/${s.cells}c), ${o.shape}**: segments \`${JSON.stringify(o.segments)}\`,`);
        md.push(`  fallible-offer segments \`${JSON.stringify(o.fallibleOfferSegments)}\`, observed at segment 0`);
        md.push(`  \`${JSON.stringify(o.imbalancesAtSegment0 ?? {})}\`, elsewhere \`${JSON.stringify(o.imbalancesElsewhere ?? {})}\`.`);
      }
    }
    if (shown === 0) md.push('None — every offer placed in the guaranteed section.');

    writeEvidence(
      'S5b',
      {
        spike: 'S5b',
        label: LANE_STAMP,
        utc: stamp(),
        question: 'how much custody state can the Manager hold and still build a PUBLISHABLE (guaranteed-section) offer?',
        verdict,
        boundary,
        lastGuaranteedStep,
        firstFallibleStep,
        managerAddress: rig.base.managerAddress,
        parameters: {
          giveColour: G.hex,
          depositedToAA_A: String(DEPOSIT_G_AA_A),
          depositedToAA_B: String(DEPOSIT_G_AA_B),
          fillerSteps: FILLER_STEPS,
          gives: String(GIVE),
          wants: String(WANT),
        },
        steps,
        checks,
        supersedes:
          'an earlier 2x2 of {shape} x {wanted colour has a pool}, whose hypothesis (the merge branch) ' +
          'was REFUTED: all four cells were fallible because that design ran at two pools / two cells ' +
          'throughout and so held the real variable constant.',
      },
      md,
    );

    console.log(`\n## S5b: ${verdict}`);
    for (const c of notAsPredicted) console.log(`   NOT AS PREDICTED: ${c.name} — ${c.detail}`);
    // S5b MEASURES. It is red only if it could not measure — i.e. an offer failed to build for a reason
    // that was not placement, which would mean the dose-response is reading something else.
    if (!flat.every((o) => o.built)) process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS5b FAILED: ${err}`);
    writeFatal('S5b', err, { steps });
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
