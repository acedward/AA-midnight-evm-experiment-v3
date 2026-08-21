// SPIKE S3 — the offer artifact round-trip, and decision D-306 (publish BOUND or UNBOUND?).
// Plan 01 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Three questions, one experiment:
//
//   1. FR-306 — does a proven, UNBALANCED contract-call transaction survive `serialize()` → a file →
//      A DIFFERENT OS PROCESS → `deserialize()` byte-identically, with a stable SHA-256 content
//      address? The other process is `spike-s3-reader.ts`, started fresh, with no network at all: an
//      offer that needed an indexer to be readable would not be off-chain distributable.
//   2. FR-302 — read the FIRST-EVER offer placement assert on both forms: `imbalances(0)` must equal
//      exactly the intended deficit and NO other segment may carry a delta. Placement is
//      state-dependent on this lane (issue 0003), so it is measured, never assumed.
//   3. D-306 — WHICH FORM does 00006 publish? The unbound form (`pre-binding`) is what the pinned
//      SDK's own shielded-swap e2e test passes between wallets; the bound form is what `bind()`
//      produces and what `balanceFinalizedTransaction` takes. S1 measured which entry point actually
//      settles; this spike measures which form survives the wire. D-306 needs both answers, and this
//      file reads S1's own evidence file rather than restating its result from memory.
//
// ONE proving run, two artifacts: the unbound bytes are captured first, then `bind()` is applied to
// the very same transaction and the bound bytes are captured. So the two forms are provably the same
// offer, and nothing is submitted at any point — no balancing, no DUST, no node.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { closeParty } from '../wallet.js';
import { log } from '../night.js';
import { errorChain, mintShieldedToUser } from '../g3/actions.js';
import { mapSizes } from '../manager-view.js';
import { bootstrapSpikeRig } from './spike-rig.js';
import { assertPlacement, buildMakerDeposit } from './maker.js';
import { FLAGS, validate } from './taker.js';

const EVID = join(REPO_ROOT, 'evidence', 'g1-spikes');
const OFFERS = join(EVID, 'offers');
const HARNESS = join(REPO_ROOT, 'harness');
const stamp = () => new Date().toISOString();
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const OFFER_VALUE = 4n;
const MINT_TO_TAKER = 6n;

const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

/** Run the reader in a SEPARATE OS PROCESS and parse its single JSON line. */
const readInAnotherProcess = (file: string, markerB: 'pre-binding' | 'binding', expectedSha: string) => {
  const out = execFileSync('npx', ['tsx', 'src/g1/spike-s3-reader.ts', file, markerB, expectedSha], {
    cwd: HARNESS,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = out.trim().split('\n').filter(Boolean).pop() ?? '{}';
  return JSON.parse(line) as Record<string, any>;
};

const main = async () => {
  mkdirSync(OFFERS, { recursive: true });
  console.log(`# SPIKE S3 — offer artifact round-trip and decision D-306 — ${LANE_STAMP} — ${stamp()}`);

  const rig = await bootstrapSpikeRig({ withTaker: true });
  let verdict = 'RED';
  const forms: Record<string, any> = {};

  try {
    const toka = await rig.deployMinter('Minter1', 'TOKA');
    const S_A = toka.shieldedRaw;
    const S_A_hex = toka.shieldedColour;

    // The offer WANTS this colour into custody, so somebody has to be able to supply it; mint it to
    // OwnerT so the artifact is a realistic offer rather than an unfillable one. Nothing is submitted
    // in this spike — the mint only makes the fillability claim honest.
    const obs = await rig.openObserver('OwnerT-premint', SEEDS.ownerT);
    let mintTx: string;
    try {
      mintTx = await mintShieldedToUser(rig.ctx, 'Minter1', MINT_TO_TAKER, obs, rig.fee);
    } finally {
      await closeParty(obs);
    }
    log(`minted ${MINT_TO_TAKER} S_A to OwnerT in ${mintTx} (never spent by this spike)`);

    const before = await rig.readManagerNow();

    // --- the offer: built, proven, and then LEFT ALONE ---------------------------------------------
    const artifact = await buildMakerDeposit({
      providers: rig.builderManagerProviders,
      managerAddress: rig.managerAddress,
      colour: S_A,
      value: OFFER_VALUE,
      account: rig.raw.AA_A,
    });
    log(`offer proven; imbalances(0) = ${JSON.stringify(artifact.placement.imbalances['0'])}`);

    // --- form 1: UNBOUND (pre-binding) --------------------------------------------------------------
    const unboundBytes: Uint8Array = artifact.proven.serialize();
    const unboundSha = sha256(unboundBytes);
    const unboundFile = join(OFFERS, `offer-unbound-${unboundSha.slice(0, 16)}.bin`);
    writeFileSync(unboundFile, unboundBytes);
    log(`unbound form: ${unboundBytes.length} bytes, sha256 ${unboundSha}`);

    // The facade's own validator, on the network, with the flags FR-303 prescribes for this form.
    const takerFacade = await rig.openObserver('OwnerT-validator', SEEDS.ownerT);
    let unboundFacadeValidation;
    let boundFacadeValidation;
    try {
      unboundFacadeValidation = await validate(takerFacade, artifact.proven, FLAGS.beforeBalanceUnbound as any);
      log(`facade validateTransaction(unbound, ${JSON.stringify(FLAGS.beforeBalanceUnbound)}) -> ${unboundFacadeValidation.passed}`);

      // --- form 2: BOUND — the SAME offer, bind() applied ------------------------------------------
      const bound = artifact.proven.bind();
      const boundBytes: Uint8Array = bound.serialize();
      const boundSha = sha256(boundBytes);
      const boundFile = join(OFFERS, `offer-bound-${boundSha.slice(0, 16)}.bin`);
      writeFileSync(boundFile, boundBytes);
      log(`bound form: ${boundBytes.length} bytes, sha256 ${boundSha}`);

      boundFacadeValidation = await validate(takerFacade, bound, FLAGS.beforeBalanceFinalized as any);
      log(`facade validateTransaction(bound, ${JSON.stringify(FLAGS.beforeBalanceFinalized)}) -> ${boundFacadeValidation.passed}`);

      const boundPlacement = assertPlacement(bound, artifact.expectedAtSegment0);

      forms.bound = {
        marker: 'binding',
        bytes: boundBytes.length,
        sha256: boundSha,
        file: boundFile.replace(`${REPO_ROOT}/`, ''),
        placementInThisProcess: boundPlacement,
        facadeValidation: boundFacadeValidation,
      };
      forms.unbound = {
        marker: 'pre-binding',
        bytes: unboundBytes.length,
        sha256: unboundSha,
        file: unboundFile.replace(`${REPO_ROOT}/`, ''),
        placementInThisProcess: artifact.placement,
        facadeValidation: unboundFacadeValidation,
      };

      // --- the PROCESS BOUNDARY ---------------------------------------------------------------------
      console.log('\n## crossing the process boundary — a fresh `tsx` process, no network');
      forms.unbound.readerReport = readInAnotherProcess(unboundFile, 'pre-binding', unboundSha);
      forms.bound.readerReport = readInAnotherProcess(boundFile, 'binding', boundSha);
      for (const k of ['unbound', 'bound']) {
        const r = forms[k].readerReport;
        log(
          `${k}: reader pid ${r.process?.pid} deserialized=${r.deserialized} ` +
            `roundTripByteIdentical=${r.roundTripByteIdentical} shaMatchesMaker=${r.shaMatchesMaker} ` +
            `segments=${JSON.stringify(r.segments)}`,
        );
      }
    } finally {
      await closeParty(takerFacade);
    }

    // Nothing was submitted, so the Manager must be byte-identical.
    const after = await rig.readManagerNow();
    const managerUntouched = JSON.stringify(mapSizes(before)) === JSON.stringify(mapSizes(after));

    // --- S1 cross-check: which form actually SETTLES? ------------------------------------------------
    const s1File = join(EVID, 's1-foreign-balance.json');
    let s1: any = null;
    if (existsSync(s1File)) {
      try {
        s1 = JSON.parse(readFileSync(s1File, 'utf-8'));
      } catch (e) {
        s1 = { readError: errorChain(e) };
      }
    }
    const s1Routes: Record<string, boolean> = {};
    for (const leg of s1?.legs ?? []) s1Routes[String(leg.route)] = Boolean(leg?.settlement?.ok);

    // --- the round-trip verdict ---------------------------------------------------------------------
    const roundTripOk = (k: string): boolean => {
      const r = forms[k]?.readerReport;
      return Boolean(r?.ok && r?.deserialized && r?.roundTripByteIdentical && r?.shaMatchesMaker);
    };
    const placementOk = (k: string): boolean => Boolean(forms[k]?.placementInThisProcess?.ok);
    // "unsubmittable alone" must be POSITIVELY established, not assumed: the control case with
    // enforceBalancing:true has to FAIL in the reader process.
    const unbalancedProven = (k: string): boolean => {
      const cases: any[] = forms[k]?.readerReport?.wellFormed ?? [];
      const control = cases.find((c) => String(c.case).startsWith('CONTROL'));
      return Boolean(control && control.passed === false);
    };

    const perForm = ['unbound', 'bound'].map((k) => ({
      form: k,
      roundTrip: roundTripOk(k),
      placement: placementOk(k),
      unbalancedProven: unbalancedProven(k),
      settlesPerS1: s1Routes[k] ?? null,
    }));
    const anyFormOk = perForm.some((f) => f.roundTrip && f.placement);
    verdict = anyFormOk ? 'GREEN' : 'RED';

    // --- DECISION D-306 -----------------------------------------------------------------------------
    const settling = perForm.filter((f) => f.settlesPerS1 === true && f.roundTrip && f.placement);
    let d306: string;
    let d306Reason: string;
    if (settling.length === 0) {
      d306 = 'DEFERRED';
      d306Reason =
        'no form is both wire-safe here and known to settle from S1 — S1 evidence ' +
        (s1 ? 'shows no accepted route' : 'was not present when this spike ran') +
        '. Plan 02 must not pick a form until S1 is GREEN.';
    } else if (settling.some((f) => f.form === 'unbound')) {
      d306 = 'UNBOUND (`pre-binding`)';
      d306Reason =
        'the unbound form round-trips byte-identically, keeps FR-302 placement, and S1 settled it through ' +
        '`balanceUnboundTransaction` — the same entry point the pinned SDK\'s own shielded-swap e2e test uses. ' +
        'It also leaves the taker free to merge without the maker having frozen the transaction, which is what ' +
        'makes an OPEN offer possible at all.' +
        (settling.some((f) => f.form === 'bound')
          ? ' The bound form ALSO works and is recorded as the fallback.'
          : ' The bound form is not available as a fallback in this run.');
    } else {
      d306 = 'BOUND (`binding`)';
      d306Reason =
        'only the bound form both round-trips and settled in S1, so 00006 publishes `bind()`-ed offers and takers ' +
        'use `balanceFinalizedTransaction`. Recorded as a constraint on the v2 open-offer shapes: binding freezes ' +
        'segment id and contents.';
    }

    const payload = {
      spike: 'S3',
      label: LANE_STAMP,
      utc: stamp(),
      questions: [
        'FR-306: does the artifact round-trip a real process boundary byte-identically with a stable SHA-256?',
        'FR-302: does imbalances(0) carry exactly the intended deficit, with no other segment carrying deltas?',
        'D-306: which form does 00006 publish — bound or unbound?',
      ],
      offer: {
        circuit: artifact.circuitId,
        colour: S_A_hex,
        value: String(OFFER_VALUE),
        creditAccount: artifact.accountHex,
        nonce: Buffer.from(artifact.nonce).toString('hex'),
        expectedAtSegment0: artifact.expectedAtSegment0,
        identifiers: artifact.identifiers,
        submitted: false,
      },
      managerAddress: rig.managerAddress,
      minter: { label: toka.label, tag: toka.tagText, address: toka.address, shieldedColour: S_A_hex },
      mintTx,
      forms,
      perForm,
      managerUntouched,
      mapSizesBefore: mapSizes(before),
      mapSizesAfter: mapSizes(after),
      s1CrossCheck: { file: 's1-foreign-balance.json', present: Boolean(s1), routes: s1Routes, verdict: s1?.verdict ?? null },
      verdict,
      decisionD306: { choice: d306, reason: d306Reason },
    };
    writeFileSync(join(EVID, 's3-offer-roundtrip.json'), `${JSON.stringify(payload, bigints, 2)}\n`);

    const md: string[] = [];
    md.push('# SPIKE S3 — offer artifact round-trip, FR-302 placement, and decision D-306');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    md.push(`**DECISION D-306: ${d306}** — ${d306Reason}`);
    md.push('');
    md.push('## The offer under test');
    md.push('');
    md.push(`\`depositShielded\` giving the Manager ${OFFER_VALUE} of colour \`${S_A_hex}\`, credited to AA_A`);
    md.push(`(\`${artifact.accountHex}\`), nonce \`${Buffer.from(artifact.nonce).toString('hex')}\`.`);
    md.push('Built and proven by OwnerN; **never balanced, never signed, never submitted**. One proving run produced');
    md.push('both forms — the unbound bytes were captured first, then `bind()` was applied to the same transaction —');
    md.push('so the two rows below are provably the same offer.');
    md.push('');
    md.push('## FR-306 — the process boundary');
    md.push('');
    md.push('| Form | marker | bytes | SHA-256 (maker) | reader pid | deserialized | re-serialize byte-identical | SHA-256 matches |');
    md.push('|---|---|---|---|---|---|---|---|');
    for (const k of ['unbound', 'bound']) {
      const f = forms[k];
      const r = f?.readerReport ?? {};
      md.push(
        `| ${k} | \`${f?.marker}\` | ${f?.bytes} | \`${String(f?.sha256).slice(0, 24)}…\` | ${r.process?.pid ?? '—'} | ` +
          `${r.deserialized ?? false} | ${r.roundTripByteIdentical ?? false} | ${r.shaMatchesMaker ?? false} |`,
      );
    }
    md.push('');
    md.push('The reader is `harness/src/g1/spike-s3-reader.ts`, launched as a fresh `tsx` process with a different pid,');
    md.push('no shared heap, no shared wasm instance and **no network**. Its own report is embedded verbatim in');
    md.push('`s3-offer-roundtrip.json`.');
    md.push('');
    md.push('## FR-302 — placement, measured in BOTH processes');
    md.push('');
    md.push('| Form | segments | intent segments | imbalances(0) | other segments with deltas | exact |');
    md.push('|---|---|---|---|---|---|');
    for (const k of ['unbound', 'bound']) {
      const p = forms[k]?.placementInThisProcess ?? {};
      md.push(
        `| ${k} (maker process) | ${JSON.stringify(p.segments)} | ${JSON.stringify(p.intentSegments)} | ` +
          `\`${JSON.stringify(p.imbalances?.['0'])}\` | ${p.offendingSegments?.length ? p.offendingSegments.join('; ') : 'none'} | ${p.ok} |`,
      );
      const r = forms[k]?.readerReport ?? {};
      md.push(
        `| ${k} (reader process) | ${JSON.stringify(r.segments)} | ${JSON.stringify(r.intentSegments)} | ` +
          `\`${JSON.stringify(r.imbalances?.['0'])}\` | ${
            Object.entries(r.imbalances ?? {})
              .filter(([s, v]) => s !== '0' && Object.keys(v as object).length > 0)
              .map(([s, v]) => `${s}: ${JSON.stringify(v)}`)
              .join('; ') || 'none'
          } | — |`,
      );
    }
    md.push('');
    md.push('## "Unsubmittable alone", positively established');
    md.push('');
    md.push('The reader runs three `wellFormed` cases against a BLANK reference state carrying the initial ledger');
    md.push('parameters — the state shape the pinned facade itself builds for `validateTransaction`');
    md.push('(`wallet-sdk-capabilities/dist/validation/validationService.js:28-31`). The third case is a CONTROL: with');
    md.push('`enforceBalancing:true` an unbalanced offer MUST fail, or the artifact does not support the claim.');
    md.push('');
    md.push('| Form | case | requested flags | effective flags | passed | error |');
    md.push('|---|---|---|---|---|---|');
    for (const k of ['unbound', 'bound']) {
      for (const c of forms[k]?.readerReport?.wellFormed ?? []) {
        md.push(
          `| ${k} | ${c.case} | \`${JSON.stringify(c.requested)}\` | \`${JSON.stringify(c.effective)}\` | ${c.passed} | ` +
            `${c.error ? `\`${c.error}\`` : '—'} |`,
        );
      }
    }
    md.push('');
    md.push('And the facade\'s own network-backed validator, with the flags its docstring prescribes per entry point:');
    md.push('');
    md.push('| Form | flags | passed | error |');
    md.push('|---|---|---|---|');
    for (const k of ['unbound', 'bound']) {
      const v = forms[k]?.facadeValidation;
      if (v) md.push(`| ${k} | \`${JSON.stringify(v.flags)}\` | ${v.passed} | ${v.error ? `\`${v.error}\`` : '—'} |`);
    }
    md.push('');
    md.push('## Practical consequences for the FR-306 envelope');
    md.push('');
    md.push('| Fact | unbound | bound |');
    md.push('|---|---|---|');
    md.push(
      `| \`transactionHash()\` | ${JSON.stringify(String(forms.unbound?.readerReport?.transactionHash ?? '—')).slice(0, 120)} | ` +
        `${JSON.stringify(String(forms.bound?.readerReport?.transactionHash ?? '—')).slice(0, 120)} |`,
    );
    md.push(
      `| \`fees(initialParameters)\` in SPECKs | ${forms.unbound?.readerReport?.feesSpecks} | ${forms.bound?.readerReport?.feesSpecks} |`,
    );
    md.push('');
    md.push('**The unbound form has no canonical transaction hash** — `transactionHash()` is defined only for proven,');
    md.push('signed AND bound transactions. So an unbound offer cannot be named by a chain identifier, which is exactly');
    md.push('why FR-306 content-addresses the envelope by **SHA-256 of the raw `Transaction.serialize()` bytes**. That');
    md.push('is not a stylistic choice: for the form D-306 selects it is the only stable name available. It is also the');
    md.push('right one, since `finalizeRecipe` merges the offer into a LARGER transaction whose hash the maker cannot');
    md.push('know in advance.');
    md.push('');
    md.push('**The offer\'s own `fees()` figure is not the settlement fee.** It is read here only to show the maker');
    md.push('attaches no DUST of its own; the fee that is actually paid belongs to the merged transaction the taker');
    md.push('submits, and spike S6 (Plan 02) measures that.');
    md.push('');
    md.push('## D-306 inputs');
    md.push('');
    md.push('| Form | round-trips | FR-302 placement | unbalanced proven | settles (from S1 evidence) |');
    md.push('|---|---|---|---|---|');
    for (const f of perForm) {
      md.push(`| ${f.form} | ${f.roundTrip} | ${f.placement} | ${f.unbalancedProven} | ${f.settlesPerS1 === null ? 'no S1 evidence' : f.settlesPerS1} |`);
    }
    md.push('');
    md.push(`S1 evidence file present: \`${Boolean(s1)}\`; S1 verdict: \`${s1?.verdict ?? 'n/a'}\`.`);
    md.push('');
    md.push('## Nothing was submitted');
    md.push('');
    md.push(`Custody map sizes ${JSON.stringify(mapSizes(before))} → ${JSON.stringify(mapSizes(after))} — ` +
      `**${managerUntouched ? 'UNCHANGED' : 'CHANGED, which would be a failure'}**.`);
    md.push('');
    writeFileSync(join(EVID, 'S3.md'), `${md.join('\n')}\n`);

    console.log(`\n## S3 VERDICT: ${verdict}; D-306 = ${d306}`);
    if (!anyFormOk || !managerUntouched) process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS3 FAILED: ${err}`);
    writeFileSync(
      join(EVID, 's3-offer-roundtrip.json'),
      `${JSON.stringify({ spike: 'S3', label: LANE_STAMP, utc: stamp(), verdict: 'RED', fatal: err, forms }, bigints, 2)}\n`,
    );
    writeFileSync(
      join(EVID, 'S3.md'),
      `# SPIKE S3 — offer artifact round-trip and decision D-306\n\n\`${LANE_STAMP}\` · recorded ${stamp()}\n\n**VERDICT: RED (fatal)**\n\nVerbatim:\n\n\`\`\`\n${err}\n\`\`\`\n`,
    );
    process.exitCode = 1;
  } finally {
    await rig.close();
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
