// THE LIVE MATRIX — the S5b dose-response, on a real chain, over CONTRACT VARIANTS.
// 00006 Plan 05 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// ================================================================================================
// WHAT THIS MEASURES, AND WHY IT IS THE EVIDENCE OF RECORD
// ================================================================================================
//
// The offline sweep (F-313) computes the same partition decision in milliseconds and is what ranked
// the arms — but it runs against a SIMULATED contract state under whichever `LedgerParameters` it was
// given, and F-313 records that with the ledger crate's defaults it puts stock v4's boundary at 17
// cells where the chain puts it at 2. So the offline model is the design instrument and THIS is the
// measurement: a real deploy, real deposits, real proofs, and the FR-302 placement of a real artifact.
//
// The run also CAPTURES THE CHAIN'S OWN `LedgerParameters` (`rig.ts` fetches them from the indexer the
// way `midnight-js-contracts` does) and writes them to `evidence/g5-mitigation/chain-params.json`, so
// the offline sweep can be re-run under the real numbers and calibrated point by point against these
// live observations.
//
// PROTOCOL, per variant, identical for every arm so a difference between arms is a difference between
// contracts:
//
//   1. deploy the variant; capture the chain parameters (once, from the first variant that boots);
//   2. deploy ONE issuer for the GIVE colour G and ONE for the WANTED colour W;
//   3. mint enough G to a wallet that is not the maker, and enough W to nobody in particular — the
//      wanted colour is never actually supplied, because nothing is submitted;
//   4. register N accounts and deposit G to each in turn, so CELLS rise while POOLS stay at one. That
//      is the only way to separate the two dimensions, and it is what made step 2 of F-310's table the
//      load-bearing row;
//   5. at each requested cell count, BUILD AND PROVE one offer per FR-308 shape and read its FR-302
//      placement through the shipped instrument. Nothing is balanced, signed or submitted.
//
// WHY ONE WANTED COLOUR SUFFICES, where spike S5b used a fresh one per point. S5b's caution was that
// `claimWantedColour` takes a MERGE branch when the wanted colour already has a pool, which adds a
// zswap input, a nullifier claim and a Merkle read — and that would confound the dose. But a pool for
// the wanted colour is only created by a SETTLEMENT, and this matrix settles nothing: every offer is
// built, read and discarded. So the merge branch is never reachable and one wanted colour is sound.
// Recorded rather than silently optimised, because it is the kind of shortcut that would be a real
// error if anything here were submitted.
//
// ARM (e) is the one protocol difference, and it is unavoidable: `openSwap` needs a coin in the escrow
// cell, so `stageOffer` MUST really be submitted (it is self-balanced, so the maker submits it alone —
// which is the arm's whole claim, and submitting it here is what makes that claim evidence).
//
// It is staged ONCE for the whole dose, not once per point, and relaxation R5'' is why: there is no
// `cancelStage` circuit, so a staged coin can only leave the escrow through a SETTLED `openSwap` — and
// this matrix settles nothing, so a second `stageOffer` would be refused with "an offer is already
// staged". Measuring every point against one staged coin is the RIGHT measurement rather than a
// workaround: `openSwap` reads the escrow cells and the `accounts` Set and nothing else, so its cost
// cannot depend on how custody grew after the staging. What this run consequently cannot show is how
// `stageOffer` ITSELF scales — that curve is in the offline sweep's self-balanced-phases table, and one
// live `stageOffer` at the winner's larger custody size is submitted by the end-to-end run.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { captureParams } from './placement-model.js';
import { actAs, bootstrapG5Rig, shieldedKeysOf, type Account, type Colour, type G5Rig } from './rig.js';
import { buildG5Offer, offerCircuitOf } from './offer.js';
import { variantById, VARIANTS, type VariantSpec } from './variants.js';
import { matrixVerdict, printVerdictErrors } from './verdicts.js';

const EVID = join(REPO_ROOT, 'evidence', 'g5-mitigation');
const stamp = () => new Date().toISOString();
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const GIVE_PER_CELL = 8n;
const GIVE = 1n;
const WANT = 1n;

export type LivePoint = {
  variant: string;
  arm: string;
  shape: 'named-taker' | 'floating-surplus';
  cells: number;
  pools: number;
  /** FALSE for the nested layouts — the count is over registered accounts only (F-315). */
  cellsExact: boolean;
  built: boolean;
  placement: 'GUARANTEED' | 'FALLIBLE';
  segments?: number[];
  intentSegments?: number[];
  fallibleOfferSegments?: number[];
  imbalancesAtSegment0?: Record<string, string>;
  imbalancesElsewhere?: Record<string, Record<string, string>>;
  buildMs?: number;
  proveMs?: number;
  offerBytes?: number;
  error?: string;
};

export type VariantRun = {
  variant: string;
  arm: string;
  contractAddress?: string;
  points: LivePoint[];
  /** Arm (e) only: the tx ids of the self-balanced staging transactions, and whether they landed. */
  stagingTxIds?: string[];
  fatal?: string;
};

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** Grow custody to `n` cells on one live variant, measuring at each requested size. */
const runVariant = async (v: VariantSpec, cells: number[], capture: { done: boolean }): Promise<VariantRun> => {
  const run: VariantRun = { variant: v.id, arm: v.arm, points: [] };
  const maxCells = Math.max(...cells);
  let rig: G5Rig | undefined;

  try {
    rig = await bootstrapG5Rig(v);
    run.contractAddress = rig.contractAddress;

    if (!capture.done) {
      mkdirSync(EVID, { recursive: true });
      captureParams(
        rig.chainParams,
        join(EVID, 'chain-params.json'),
        'The CHAIN LedgerParameters this run partitioned against, fetched from the indexer exactly as ' +
          'midnight-js-contracts fetches them. Feed to the offline sweep with --params to calibrate ' +
          'F-313 absolute boundaries.',
      );
      capture.done = true;
      log(`captured the chain's ledger parameters to evidence/g5-mitigation/chain-params.json`);
    }

    const G = await rig.addColour('G', 'TOKG');
    const W = await rig.addColour('W', 'TOKW');
    // Enough G for every deposit, minted to a wallet that is NOT the maker: custody is funded the
    // ordinary way, by an unrelated user.
    await rig.mintTo(G, GIVE_PER_CELL * BigInt(maxCells) + 8n, SEEDS.ownerN);

    // Account 0 is the MAKER (OwnerA) and is credited first, so the maker's own cell exists at every
    // measured size. The rest exist only to hold cells.
    const accts: Account[] = [await rig.addAccount('AA_A', SEEDS.ownerA)];
    for (let i = 1; i < maxCells; i++) {
      accts.push(await rig.addAccount(`AA_${i}`, `${SEEDS.ownerB.slice(0, 62)}${(0x10 + i).toString(16).padStart(2, '0')}`));
    }
    const maker = accts[0]!;

    const colours: Colour[] = [G, W];
    const stagingTxIds: string[] = [];

    for (let n = 1; n <= maxCells; n++) {
      const target = accts[n - 1]!;
      await rig.depositManyFrom(SEEDS.ownerN, 'OwnerN', G, GIVE_PER_CELL, target.id);
      const view = await rig.waitFor(
        colours,
        accts.slice(0, n),
        (x) => x.size.cells >= n,
        `custody to reach ${n} cell(s) on ${v.id}`,
      );
      if (!cells.includes(n)) continue;

      log(`## ${v.id}: custody at ${view.size.cells} cell(s) / ${view.size.pools} pool(s)`);

      // Arm (e): the offer needs a coin in the escrow, so `stageOffer` must really be SUBMITTED. It is
      // SELF-BALANCED, so the maker submits it alone and no segment-0 placement question arises for it
      // — which is precisely the arm's claim, and submitting it here is what turns that claim into
      // evidence rather than an argument.
      //
      // IT IS STAGED ONCE, NOT ONCE PER POINT, and the reason is relaxation R5'' biting for real:
      // there is no `cancelStage` circuit, so a staged coin can only leave the escrow through a
      // SETTLED `openSwap` — and this matrix settles nothing. A second `stageOffer` would therefore be
      // refused with "an offer is already staged". (The first version of this loop did exactly that.)
      //
      // Measuring every point against ONE staged coin is not a workaround, it is the right
      // measurement: `openSwap` reads the escrow CELLS and the `accounts` Set and nothing else, so its
      // cost cannot depend on how custody grew after the staging. What this run therefore CANNOT show
      // is how `stageOffer` itself scales — that curve is measured offline (`OFFLINE-SWEEP.md`, the
      // self-balanced-phases table) and one live `stageOffer` at the winner's larger custody size is
      // submitted by the end-to-end run. Recorded here so the gap is visible where the data is.
      const stagedValue = GIVE;
      if (v.offer === 'staged') {
        const pre = await rig.read(colours, accts.slice(0, n));
        if (pre.escrow?.active === 'true') {
          log(`   arm (e): escrow already staged (R5'': no cancelStage, and nothing settles here) — reusing it`);
        } else {
          const txId = await rig.submitAs(`OwnerA-stage-${n}`, SEEDS.ownerA, maker.secret, 'stageOffer', [G.raw, GIVE]);
          stagingTxIds.push(txId);
          await rig.waitFor(colours, accts.slice(0, n), (x) => x.escrow?.active === 'true', 'the escrow to be staged');
          log(`   arm (e): staged ${GIVE} of G in ${txId} (self-balanced — F-310 does not constrain it)`);
        }
      }

      for (const shape of ['named-taker', 'floating-surplus'] as const) {
        // The maker's own providers, acting as the maker's account.
        await actAs(rig.makerProviders, maker.secret);
        const base = {
          variant: v.id,
          arm: v.arm,
          shape,
          cells: view.size.cells,
          pools: view.size.pools,
          cellsExact: view.size.cellsExact,
        };
        try {
          const offer = await buildG5Offer({
            variant: v,
            providers: rig.makerProviders,
            compiled: rig.compiled(),
            contractAddress: rig.contractAddress,
            shape,
            gives: { colourRaw: G.raw, value: v.offer === 'staged' ? stagedValue : GIVE },
            wants: { colourRaw: W.raw, value: WANT },
            creditAccount: maker.id,
            makerAccount: maker.id,
            ...(shape === 'named-taker' ? { recipient: shieldedKeysOf(SEEDS.ownerT) } : {}),
            measureOnly: true, // read placement even when it is wrong; NEVER published
          });
          const p = offer.placement;
          const elsewhere: Record<string, Record<string, string>> = {};
          for (const [seg, m] of Object.entries(p.imbalances)) {
            if (seg !== '0' && Object.keys(m).length > 0) elsewhere[seg] = m;
          }
          run.points.push({
            ...base,
            built: true,
            placement: p.ok ? 'GUARANTEED' : 'FALLIBLE',
            segments: p.segments,
            intentSegments: p.intentSegments,
            fallibleOfferSegments: p.fallibleOfferSegments,
            imbalancesAtSegment0: p.imbalances['0'],
            imbalancesElsewhere: elsewhere,
            buildMs: offer.buildMs,
            proveMs: offer.proveMs,
            offerBytes: offer.bytes.length,
          });
        } catch (e) {
          const err = errorChain(e);
          run.points.push({ ...base, built: false, placement: 'FALLIBLE', error: err });
          log(`   ${shape}: could not be built at all — ${err.slice(0, 200)}`);
        }
      }
    }

    if (stagingTxIds.length) run.stagingTxIds = stagingTxIds;
  } catch (e) {
    run.fatal = errorChain(e);
    log(`## ${v.id}: FATAL — ${run.fatal.slice(0, 300)}`);
  } finally {
    if (rig) await rig.close();
  }
  return run;
};

const main = async () => {
  const cells = (arg('--cells') ?? process.env.G5_CELLS ?? '1,2,4,8,16')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const which = (arg('--variants') ?? process.env.G5_VARIANTS ?? VARIANTS.map((v) => v.id).join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`# G5 LIVE MATRIX — ${LANE_STAMP} — ${stamp()}`);
  console.log(`# variants: ${which.join(', ')}`);
  console.log(`# cells: ${cells.join(', ')}   shapes: named-taker, floating-surplus`);
  console.log('# BUILD + PROVE ONLY. Nothing in this run is balanced, signed or submitted as an offer.');

  const capture = { done: false };
  const runs: VariantRun[] = [];
  for (const id of which) {
    const v = variantById(id);
    console.log(`\n===== ${v.id} (${v.arm}) — ${v.title} =====`);
    runs.push(await runVariant(v, cells, capture));
  }

  // --- the reading ------------------------------------------------------------------------------
  const boundary = (variant: string, shape: string) => {
    const mine = runs
      .find((r) => r.variant === variant)
      ?.points.filter((p) => p.shape === shape)
      .sort((a, b) => a.cells - b.cells) ?? [];
    const g = mine.filter((p) => p.placement === 'GUARANTEED').map((p) => p.cells);
    const f = mine.filter((p) => p.placement !== 'GUARANTEED').map((p) => p.cells);
    const firstFallible = f.length ? Math.min(...f) : null;
    return {
      lastGuaranteed: g.length ? Math.max(...g) : null,
      firstFallible,
      monotone: firstFallible === null || mine.filter((p) => p.cells >= firstFallible).every((p) => p.placement !== 'GUARANTEED'),
      allBuilt: mine.every((p) => p.built),
    };
  };

  const summary = runs.map((r) => {
    const v = variantById(r.variant);
    return {
      variant: r.variant,
      arm: r.arm,
      title: v.title,
      offerCircuit: offerCircuitOf(v),
      contractAddress: r.contractAddress ?? null,
      named: boundary(r.variant, 'named-taker'),
      surplus: boundary(r.variant, 'floating-surplus'),
      relaxations: v.relaxations,
      fatal: r.fatal ?? null,
    };
  });

  // The BASELINE must reproduce F-310 or the whole matrix is untrustworthy: G5 fails only on rig or
  // infra defects, or on a baseline that CONTRADICTS F-310.
  const baseline = summary.find((s) => s.variant === 'manager');
  const f310Reproduced =
    baseline !== undefined &&
    baseline.fatal === null &&
    baseline.surplus.lastGuaranteed === 1 &&
    baseline.surplus.firstFallible === 2;

  const table = (header: string[], rows: string[][]): string[] => [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];

  const md: string[] = [];
  md.push('# G5 live matrix — the F-310 boundary, per contract variant, on a real chain');
  md.push('');
  md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
  md.push('');
  md.push('Every offer is BUILT AND PROVEN and then discarded. Nothing here is balanced, signed or');
  md.push('submitted, so no result in this table depends on a settlement, and the wanted colour never');
  md.push('acquires a pool — which is what keeps `claimWantedColour`\'s merge branch out of the dose.');
  md.push('');
  md.push(`**Baseline reproduces F-310: ${f310Reproduced ? 'YES' : '**NO — read the baseline row before quoting anything else**'}**`);
  md.push('');
  md.push('## Boundaries');
  md.push('');
  md.push(
    ...table(
      ['variant', 'arm', 'offer circuit', 'last GUARANTEED (named)', 'first FALLIBLE (named)', 'last GUARANTEED (surplus)', 'first FALLIBLE (surplus)', 'monotone', 'all built'],
      summary.map((s) => [
        `\`${s.variant}\``,
        s.arm,
        `\`${s.offerCircuit}\``,
        s.named.lastGuaranteed === null ? '**none**' : String(s.named.lastGuaranteed),
        s.named.firstFallible === null ? 'none in range' : String(s.named.firstFallible),
        s.surplus.lastGuaranteed === null ? '**none**' : String(s.surplus.lastGuaranteed),
        s.surplus.firstFallible === null ? 'none in range' : String(s.surplus.firstFallible),
        s.named.monotone && s.surplus.monotone ? 'yes' : '**NO**',
        s.named.allBuilt && s.surplus.allBuilt ? 'yes' : '**NO**',
      ]),
    ),
  );
  md.push('');
  md.push('## Every point');
  md.push('');
  md.push(
    ...table(
      ['variant', 'cells', 'exact?', 'pools', 'shape', 'placement', 'imbalances(0)', 'fallible segments', 'build ms', 'prove ms', 'bytes', 'note'],
      runs.flatMap((r) =>
        r.points.map((p) => [
          `\`${p.variant}\``,
          String(p.cells),
          p.cellsExact ? 'exact' : 'over registered accts (F-315)',
          String(p.pools),
          p.shape,
          p.placement === 'GUARANTEED' ? 'GUARANTEED' : '**FALLIBLE**',
          `\`${JSON.stringify(p.imbalancesAtSegment0 ?? {})}\``,
          `\`${JSON.stringify(p.fallibleOfferSegments ?? [])}\``,
          String(p.buildMs ?? '—'),
          String(p.proveMs ?? '—'),
          String(p.offerBytes ?? '—'),
          p.error ? `ERROR: ${p.error.slice(0, 120)}` : '—',
        ]),
      ),
    ),
  );
  md.push('');
  const fatals = summary.filter((s) => s.fatal);
  if (fatals.length) {
    md.push('## Variants that could not be measured LIVE');
    md.push('');
    md.push(...table(['variant', 'verbatim'], fatals.map((s) => [`\`${s.variant}\``, `\`${String(s.fatal).slice(0, 400)}\``])));
    md.push('');
    md.push('An arm that fails to compile or deploy is a RECORDED ARM VERDICT, not a gate failure (G5).');
    md.push('');
  }
  md.push('## Deployed addresses (this run only — disposable stack)');
  md.push('');
  md.push(...table(['variant', 'address'], summary.map((s) => [`\`${s.variant}\``, `\`${s.contractAddress ?? '(not deployed)'}\``])));

  mkdirSync(EVID, { recursive: true });
  const evidence = {
        label: LANE_STAMP,
        utc: stamp(),
        question:
          'per contract variant, at what custody size does a real proven offer stop being placed in ' +
          'the GUARANTEED section?',
        cells,
        buildAndProveOnly: true,
        f310Reproduced,
        summary,
        runs,
      };
  writeFileSync(join(EVID, 'live-matrix.json'), `${JSON.stringify(evidence, bigints, 2)}\n`);
  writeFileSync(join(EVID, 'LIVE-MATRIX.md'), `${md.join('\n')}\n`);
  console.log(`\nwrote ${join(EVID, 'live-matrix.json')} and LIVE-MATRIX.md`);
  console.log(`baseline reproduces F-310: ${f310Reproduced}`);

  // A FALLIBLE placement remains a measurement. Missing/contradictory baseline evidence or a caught
  // build/prove failure is an apparatus failure and therefore RED. Run this AFTER both evidence files
  // are written so a failed gate still leaves an auditable record.
  const verdict = matrixVerdict(evidence, which);
  printVerdictErrors('live matrix', verdict);
  if (!verdict.ok) process.exitCode = 1;
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
