// SPIKE S5 — the STALENESS WINDOW (FR-311). How long does a published offer stay takeable, and what
// kills it? 00006 Plan 02 Phase 3. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// FR-311 is explicit that this is a property to MEASURE, not a failure to judge. A contract offer
// pins the pooled coin it spends (`mt_index` enters the call's transcript), so intervening activity on
// the same colour can invalidate a live offer that is otherwise perfectly good. Quantifying that is
// what makes the offer format honest about what it is: a short-lived quote, not a standing order.
//
// FOUR ARMS, and why each is separate
//
//   INTERVENE   build an offer, land an ORDINARY deposit on the same colour, then take. This is the
//               arm FR-311 names; the expected refusal is `1010 … Custom error: 104`
//               (`InvalidError::Transcript`, decoded from the pinned node source by Plan 01).
//   SHORT-TTL   an offer whose INTENT ttl is a couple of minutes instead of the hardcoded hour, so
//               node-side expiry can be observed at all. Measured twice: once with the taker's LOCAL
//               expiry gate on (it must refuse without touching the chain) and once with it forced
//               off (so the NODE's own verdict is recorded verbatim). This arm exists as much for
//               Plan 03 step 9 as for FR-311 — without it the expiry negative costs an hour of
//               waiting per observation.
//   TIME-ONLY   the same offer shape, taken after T seconds with NOTHING ELSE HAPPENING. This is the
//               control that stops the INTERVENE result being read as "offers just go stale".
//
// WHY THE ARMS ARE STRICTLY SEQUENTIAL. Each arm's settlement writes the pool for both colours, which
// would invalidate any other live offer on those colours — the very effect being measured. Running
// two arms concurrently would therefore confound the intervention with the control. So exactly one
// offer is alive at a time, and each arm's take completes before the next offer is built. That costs
// wall-clock (the waits are real) and buys an unconfounded reading.
import { LANE_STAMP, SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { buildSwapOffer, type SwapOffer } from '../offer/build.js';
import { takeOffer, type TakeResult } from '../offer/take.js';
import { bootstrapSwapRig, classifyRefusal, shieldedKeysOf, stamp, type SwapRig } from './swap-rig.js';
import {
  custodyTable,
  decodeNodeError,
  nodeErrorCode,
  observeCustody,
  publishAndReread,
  table,
  writeEvidence,
  writeFatal,
  type CustodyObservation,
} from './spike-common.js';

const MINT_A = 16n;
const MINT_B = 16n;
const DEPOSIT_A = 12n;
const GIVE_A = 1n;
const WANT_B = 1n;
/** Pinned by the gate wrapper; the plan asks for 60 / 600 / 1800. */
const WAITS = (process.env.S5_WAITS ?? '60,600,1800').split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
const SHORT_TTL_SECONDS = Number(process.env.S5_SHORT_TTL ?? 90);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type ArmResult = {
  arm: string;
  question: string;
  offer: { contentAddress: string; imbalances0: unknown; proveMs: number; intentTtl?: string };
  waitedSeconds: number;
  intervention?: string;
  take: TakeResult;
  localRefusal?: TakeResult;
  nodeErrorCode: number | null;
  nodeErrorDecoded: string;
  refusingLayer: string;
  custodyUnchangedOnRefusal?: boolean;
  before: CustodyObservation;
  after: CustodyObservation;
};

const main = async () => {
  console.log(`# SPIKE S5 — staleness window (FR-311) — ${LANE_STAMP} — ${stamp()}`);
  console.log(`# waits: ${WAITS.join(', ')} s; short-TTL arm: ${SHORT_TTL_SECONDS} s`);
  let rig: SwapRig | undefined;
  const arms: ArmResult[] = [];

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

    const mkOffer = async (
      name: string,
      opts: { intentTtlSeconds?: number } = {},
    ): Promise<{ offer: SwapOffer; file: string; intentTtl?: string }> => {
      let intentTtl: string | undefined;
      const offer = await buildSwapOffer({
        providers: rig!.makerProviders,
        compiledManager: rig!.compiledManager(),
        managerAddress: rig!.base.managerAddress,
        shape: 'named-taker',
        gives: { colourRaw: S_A.raw, value: GIVE_A },
        wants: { colourRaw: S_B.raw, value: WANT_B },
        creditAccount: AA_A.id,
        makerAccount: AA_A.id,
        // The named taker is OwnerT, addressed by its PUBLIC keys only.
        recipient: shieldedKeysOf(SEEDS.ownerT),
        ...(opts.intentTtlSeconds ? { ttlSeconds: opts.intentTtlSeconds } : {}),
        ...(opts.intentTtlSeconds
          ? {
              // BEFORE proving, per F-306: rewriting a PROVEN transaction's intents invalidates its
              // zswap proofs. Whether this takes effect is itself a measurement.
              mutateUnproven: (unproven: any) => {
                try {
                  const when = new Date(Date.now() + opts.intentTtlSeconds! * 1000);
                  for (const [seg, intent] of unproven.intents as Map<number, any>) {
                    intent.ttl = when;
                    unproven.intents.set(seg, intent);
                  }
                  intentTtl = when.toISOString();
                  log(`  intent TTL rewritten to ${intentTtl} (was the hardcoded one hour)`);
                } catch (e) {
                  intentTtl = `REWRITE FAILED: ${errorChain(e)}`;
                  log(`  intent TTL rewrite FAILED — ${intentTtl}`);
                }
              },
            }
          : {}),
      });
      const published = publishAndReread(offer, name);
      return { offer, file: published.file, intentTtl };
    };

    const takeWith = async (file: string, label: string, ignoreExpiry = false): Promise<TakeResult> => {
      const spender = await rig!.base.openSpender('OwnerT', SEEDS.ownerT, [
        { colour: S_B.hex, shielded: true, amount: WANT_B },
      ]);
      try {
        return await takeOffer(spender.party, file, { label, ignoreExpiry });
      } finally {
        await spender.close();
      }
    };

    const runArm = async (
      arm: string,
      question: string,
      opts: {
        waitSeconds?: number;
        intentTtlSeconds?: number;
        intervene?: () => Promise<string>;
        alsoTakeLocallyFirst?: boolean;
      },
    ): Promise<ArmResult> => {
      console.log(`\n## arm ${arm}`);
      const before = await observeCustody(rig!, [S_A, S_B], [AA_A, AA_B]);
      const { offer, file, intentTtl } = await mkOffer(`s5-${arm.toLowerCase()}`, {
        intentTtlSeconds: opts.intentTtlSeconds,
      });

      let intervention: string | undefined;
      if (opts.intervene) intervention = await opts.intervene();

      const wait = opts.waitSeconds ?? 0;
      if (wait > 0) {
        log(`arm ${arm}: waiting ${wait} s with NO other activity on this stack`);
        await sleep(wait * 1000);
      }

      // For the short-TTL arm, first prove the taker's own gate refuses locally, then force it off so
      // the NODE's verdict is on the record too.
      let localRefusal: TakeResult | undefined;
      if (opts.alsoTakeLocallyFirst) {
        localRefusal = await takeWith(file, `${arm}-local`, false);
        log(`arm ${arm}: local gate -> stage=${localRefusal.stage} ok=${localRefusal.ok}`);
      }
      const take = await takeWith(file, arm, Boolean(opts.alsoTakeLocallyFirst));

      const code = nodeErrorCode(take.error);
      let after = await observeCustody(rig!, [S_A, S_B], [AA_A, AA_B]);
      if (take.ok) {
        // Wait for the settlement to be visible before observing, or "after" is just "before".
        await rig!.base.waitForManagerNow(
          (m) => (m.pools[S_B.hex]?.value ?? 0n) > (before.observation.pools.S_B === 'absent' ? 0n : BigInt(before.observation.pools.S_B!)),
          `arm ${arm}: pool(S_B) to grow after settlement`,
        );
        after = await observeCustody(rig!, [S_A, S_B], [AA_A, AA_B]);
      }
      const custodyUnchangedOnRefusal = take.ok
        ? undefined
        : JSON.stringify(after.observation) === JSON.stringify(before.observation);

      const result: ArmResult = {
        arm,
        question,
        offer: {
          contentAddress: offer.terms.contentAddress,
          imbalances0: offer.placement.imbalances['0'],
          proveMs: offer.proveMs,
          ...(intentTtl ? { intentTtl } : {}),
        },
        waitedSeconds: wait,
        intervention,
        take,
        localRefusal,
        nodeErrorCode: code,
        nodeErrorDecoded: decodeNodeError(code),
        refusingLayer: take.ok ? 'none' : classifyRefusal(take.stage, take.error),
        custodyUnchangedOnRefusal,
        before: before.observation,
        after: after.observation,
      };
      log(
        `arm ${arm}: ${take.ok ? `ACCEPTED (${take.settlement?.txId})` : `REFUSED at ${take.stage}, code ${code ?? 'none'}`}` +
          `${custodyUnchangedOnRefusal === undefined ? '' : `; custody unchanged: ${custodyUnchangedOnRefusal}`}`,
      );
      arms.push(result);
      return result;
    };

    // --- arm 1: the intervening deposit, FR-311's own shape -------------------------------------
    await runArm('INTERVENE', 'does an ordinary deposit on the offered colour invalidate a live offer?', {
      intervene: async () => {
        const tx = await rig!.depositFrom(SEEDS.ownerN, 'OwnerN-intervene', S_A, 1n, AA_A.id);
        await rig!.base.waitForManagerNow(
          (m) => (m.pools[S_A.hex]?.value ?? 0n) === DEPOSIT_A + 1n,
          `pool(S_A) to reach ${DEPOSIT_A + 1n} after the intervening deposit`,
        );
        return `OwnerN deposited 1 more S_A into AA_A (tx ${tx}); pool(S_A) ${DEPOSIT_A} -> ${DEPOSIT_A + 1n}`;
      },
    });

    // --- arm 2: node-side expiry, made observable ------------------------------------------------
    await runArm('SHORT-TTL', 'what happens when an offer outlives its intent TTL?', {
      intentTtlSeconds: SHORT_TTL_SECONDS,
      waitSeconds: SHORT_TTL_SECONDS + 30,
      alsoTakeLocallyFirst: true,
    });

    // --- arms 3..n: time only, nothing else happening -------------------------------------------
    for (const t of WAITS) {
      await runArm(`T${t}`, `does an untouched offer still settle after ${t} s?`, { waitSeconds: t });
    }

    // --- the reading ----------------------------------------------------------------------------
    const timeArms = arms.filter((a) => a.arm.startsWith('T'));
    const survived = timeArms.filter((a) => a.take.ok);
    const intervene = arms.find((a) => a.arm === 'INTERVENE')!;
    const shortTtl = arms.find((a) => a.arm === 'SHORT-TTL')!;

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [
      {
        name: 'an intervening same-colour deposit INVALIDATES a live offer',
        ok: !intervene.take.ok,
        detail: intervene.take.ok ? `it settled anyway (${intervene.take.settlement?.txId})` : `code ${intervene.nodeErrorCode ?? 'none'}`,
      },
      {
        name: 'that refusal is FR-311\'s expected `Custom error: 104` (InvalidError::Transcript)',
        ok: intervene.nodeErrorCode === 104,
        detail: `${intervene.nodeErrorCode ?? 'none'} — ${intervene.nodeErrorDecoded}`,
      },
      {
        name: 'the invalidated take created NO state',
        ok: intervene.custodyUnchangedOnRefusal === true,
        detail: String(intervene.custodyUnchangedOnRefusal),
      },
      {
        name: 'an expired offer is refused LOCALLY by the taker, with no network contact',
        ok: shortTtl.localRefusal?.stage === 'expired' && shortTtl.localRefusal?.offlineRefusal === true,
        detail: `stage=${shortTtl.localRefusal?.stage}, offline=${shortTtl.localRefusal?.offlineRefusal}`,
      },
      {
        name: 'and the NODE also refuses it once the local gate is forced off',
        ok: !shortTtl.take.ok,
        detail: shortTtl.take.ok ? 'it settled — the intent TTL rewrite did not take effect' : `code ${shortTtl.nodeErrorCode ?? 'none'}`,
      },
      {
        name: 'every UNTOUCHED offer still settled, at every tested age',
        ok: survived.length === timeArms.length && timeArms.length > 0,
        detail: `${survived.length}/${timeArms.length} — ${timeArms.map((a) => `${a.arm}:${a.take.ok ? 'ok' : 'refused'}`).join(' ')}`,
      },
    ];
    const failed = checks.filter((c) => !c.ok);
    // S5 MEASURES; it does not pass or fail a hypothesis. It is RED only if it could not measure.
    const verdict = failed.length === 0 ? 'MEASURED — as FR-311 predicted' : 'MEASURED — with departures from the prediction';

    const md: string[] = [];
    md.push('# SPIKE S5 — the staleness window (FR-311)');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}**`);
    md.push('');
    md.push('FR-311 calls this a property to measure, not a failure to judge, so this file reports what');
    md.push('happened and names the departures rather than scoring them.');
    md.push('');
    md.push('## The observed rule');
    md.push('');
    md.push(
      ...table(
        ['Arm', 'What happened to the offer', 'Waited', 'Outcome', 'Node code', 'Meaning'],
        arms.map((a) => [
          a.arm,
          a.intervention ?? (a.offer.intentTtl ? `intent TTL set to \`${a.offer.intentTtl}\`` : 'nothing at all'),
          `${a.waitedSeconds} s`,
          a.take.ok ? `**settled** \`${String(a.take.settlement?.txId).slice(0, 18)}…\`` : `refused at \`${a.take.stage}\``,
          a.nodeErrorCode === null ? '—' : `\`${a.nodeErrorCode}\``,
          a.take.ok ? '—' : a.nodeErrorDecoded,
        ]),
      ),
    );
    md.push('');
    md.push('### In words');
    md.push('');
    md.push(
      `- **A same-colour pool write kills a live offer.** ${
        intervene.take.ok ? 'NOT observed here — the offer settled despite the intervening deposit.' : `Observed: the offer was refused with \`${intervene.nodeErrorCode}\` (${intervene.nodeErrorDecoded}).`
      } The mechanism is that the maker's call pins the pooled coin it spends — the coin's Merkle index enters the call's transcript — so a deposit that merges the pool changes exactly what the transcript asserted.`,
    );
    md.push(
      `- **Age alone does not.** ${survived.length}/${timeArms.length} untouched offers settled at ages ${timeArms
        .map((a) => `${a.waitedSeconds} s`)
        .join(', ')}. So the offer's lifetime is bounded by ACTIVITY on its colours and by its intent TTL, not by elapsed time as such.`,
    );
    md.push(
      `- **The TTL ceiling is the ledger's, not this project's:** \`global_ttl\` = 3600 s, and midnight-js hardcodes \`ttlOneHour()\` for every intent it builds (\`midnight-js-contracts/dist/index.mjs:990\`). An offer therefore cannot be published with a longer life, whatever the envelope says.`,
    );
    md.push('');
    md.push('## Making expiry observable — a technique Plan 03 needs');
    md.push('');
    md.push('Because every intent gets a hardcoded one-hour TTL, observing node-side expiry would cost an');
    md.push('hour of waiting per observation. The SHORT-TTL arm rewrites the intent\'s `ttl` while the');
    md.push('transaction is still UNPROVEN and then proves it, which brings the expiry negative inside a');
    md.push('few minutes. Doing it before proving is not incidental: finding F-306 established that');
    md.push('rewriting a PROVEN transaction\'s intents invalidates its zswap proofs (`Custom error: 235`,');
    md.push('12/12, including on transactions that would have been accepted untouched).');
    md.push('');
    md.push(
      ...table(
        ['Observation', 'Result'],
        [
          ['intent TTL rewrite took effect', String(shortTtl.offer.intentTtl ?? '(not attempted)')],
          [
            'taker\'s LOCAL expiry gate',
            `stage \`${shortTtl.localRefusal?.stage}\`, offline refusal: ${String(shortTtl.localRefusal?.offlineRefusal)}`,
          ],
          [
            'the NODE, with the local gate forced off',
            shortTtl.take.ok ? '**settled** — the rewrite did not reach the node' : `refused, code \`${shortTtl.nodeErrorCode ?? 'none'}\` (${shortTtl.nodeErrorDecoded})`,
          ],
        ],
      ),
    );
    md.push('');
    md.push('## Custody across the whole spike');
    md.push('');
    md.push(...custodyTable(arms[0]!.before, arms[arms.length - 1]!.after));
    md.push('');
    md.push('## Verbatim refusals (F-202 clean)');
    md.push('');
    for (const a of arms.filter((x) => !x.take.ok)) {
      md.push(`- **${a.arm}** (layer: ${a.refusingLayer}): \`${a.take.error}\``);
      if (a.localRefusal && !a.localRefusal.ok) md.push(`  - local gate first: \`${a.localRefusal.error}\``);
    }
    if (arms.every((a) => a.take.ok)) md.push('None — every arm settled.');
    md.push('');
    md.push('## Checks');
    md.push('');
    md.push(...table(['#', 'Check', 'Result', 'Detail'], checks.map((c, i) => [String(i + 1), c.name, c.ok ? 'PASS' : '**DEPARTURE**', c.detail || '—'])));
    md.push('');
    md.push('A DEPARTURE is a measurement that differs from FR-311\'s prediction. It is recorded as lane');
    md.push('behaviour, not treated as a failure — that is what "measured, not judged" means.');

    writeEvidence(
      'S5',
      {
        spike: 'S5',
        label: LANE_STAMP,
        utc: stamp(),
        question: 'how long does a published contract offer stay takeable, and what invalidates it?',
        verdict,
        managerAddress: rig.base.managerAddress,
        colours: { S_A: S_A.hex, S_B: S_B.hex },
        parameters: { deposited: String(DEPOSIT_A), gives: String(GIVE_A), wants: String(WANT_B), waits: WAITS, shortTtlSeconds: SHORT_TTL_SECONDS },
        arms,
        checks,
      },
      md,
    );

    console.log(`\n## S5: ${verdict}`);
    for (const f of failed) console.log(`   DEPARTURE: ${f.name} — ${f.detail}`);
    // S5 is green as long as it MEASURED. Only a crash (the catch below) makes it red.
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS5 FAILED: ${err}`);
    writeFatal('S5', err, { arms });
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
