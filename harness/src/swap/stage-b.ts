// STAGE B — spec rows 7–8: the OPEN offer, taken by a wallet whose keys the maker never knew.
// 00006 Plan 03 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// THIS IS THE OWNER-REQUIRED OUTCOME. Owner Q1, 2026-08-19, verbatim: "we need a way to make this
// zswap useful in real cases - so that it can be used somehow by any user that has access to it."
// FR-308 v2 encodes it, Plan 02's spike S4 established it, and this stage puts it in the step ledger
// with the spec's own amounts: give S_A 2 to nobody, want S_B 3, settled by OwnerT.
//
// WHY IT NEEDS ITS OWN MANAGER (deviation D-307). An open offer is publishable only while custody
// holds one shielded cell (F-310), and the spec's row 5 — which stage A ran — leaves two. So rows 7–8
// get a fresh Manager, funded with EXACTLY the give amount so that the release empties the pool and
// row 8's "pool removed" is reproduced rather than approximated. The S_B totals differ from the
// spec's (absent→3 instead of 7→10) because the +7 they carry happened on stage A's Manager; every
// delta and the exact end-state map sizes 1/2/0 are identical.
//
// WHAT MAKES IT OPEN, and how that is checked rather than asserted. The maker process is started with
// a JSON spec that has NO recipient field at all — retained verbatim in the evidence — so the taker's
// keys were not merely unused, they were unavailable. The released value stands as a POSITIVE
// imbalance at segment 0 addressed to nobody, and the taker's STOCK balancer sweeps it into an output
// of its own while funding the −B deficit.
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { hex } from '../manager-view.js';
import { bootstrapSwapRig, type Colour, type SwapRig } from '../g2/swap-rig.js';
import { SPEC_ROWS, STAGE_B } from './expected.js';
import { observeSwap, type SwapObservation, type UserRef } from './observe.js';
import { EVIDENCE_DIR, OFFERS_DIR, Row, Stage, runMaker, runReader, runTaker, stamp } from './stage.js';

const specOf = (n: number) => {
  const r = SPEC_ROWS.find((x) => x.row === n)!;
  return { specRow: r.row, specAction: r.action, specExpected: r.expected, asRun: r.asRun };
};

const attempt = async (r: Row, body: () => Promise<void>): Promise<void> => {
  try {
    await body();
  } catch (e) {
    const err = errorChain(e);
    r.check('the row completed without a harness failure', false, err).verbatim(err);
  }
};

const main = async () => {
  console.log(`# STAGE B — spec rows 7–8 (P-OPEN, owner-REQUIRED) — ${stamp()}`);
  let rig: SwapRig | undefined;
  let stage: Stage | undefined;

  try {
    rig = await bootstrapSwapRig();
    const AA_A = { label: 'AA_A', id: rig.base.raw.AA_A };
    const AA_B = { label: 'AA_B', id: rig.base.raw.AA_B };
    const accounts = [AA_A, AA_B];
    const users: UserRef[] = [
      { label: 'OwnerN', seed: SEEDS.ownerN },
      { label: 'OwnerT', seed: SEEDS.ownerT },
      { label: 'OwnerA', seed: SEEDS.ownerA },
    ];
    let colours: Colour[] = [];
    const minted: Record<string, bigint> = {};
    const obs = (opts: { op2?: boolean; users?: boolean } = {}) =>
      observeSwap({ rig: rig!, colours, accounts, users, minted }, opts);

    stage = new Stage({
      stage: 'B',
      carries: STAGE_B.carries,
      managerAddress: rig.base.managerAddress,
      accounts: { AA_A: rig.base.ids.AA_A, AA_B: rig.base.ids.AA_B },
      colours: {},
      minted: {},
    });

    // --- setup: the stage's own rows 0–2 equivalent ---------------------------------------------
    let S_A: Colour | undefined;
    let S_B: Colour | undefined;
    let o2: SwapObservation | undefined;
    const rSetup = stage.row('setup', `fresh Manager; mint; OwnerN deposits S_A ${STAGE_B.deposit} → AA_A`, {
      specAction: 'the stage-local equivalent of spec rows 0–2, at the amounts rows 7–8 need',
      specExpected: `all maps size 0 → pool S_A=${STAGE_B.deposit}; AA_A: S_A=${STAGE_B.deposit}; maps 1/1/0`,
      asRun:
        `deposit is EXACTLY the give amount (${STAGE_B.deposit}), so row 7's release empties the pool and row 8's ` +
        '"pool removed" is reproduced exactly rather than approximated',
    });
    await attempt(rSetup, async () => {
      const o0 = await obs({ users: false });
      rSetup.observedBefore(o0)
        .check('both accounts registered', o0.accounts.length === 2, `accounts ${o0.accounts.length}`)
        .sizes(o0, { pools: 0, shieldedCells: 0, unshieldedCells: 0 });

      S_A = await rig!.addColour('S_A', 'TOKA');
      S_B = await rig!.addColour('S_B', 'TOKB');
      colours = [S_A, S_B];
      stage!.meta.colours = { S_A: S_A.hex, S_B: S_B.hex };
      rSetup.tx(await rig!.mintTo(S_A, STAGE_B.mint.S_A, SEEDS.ownerN));
      minted.S_A = STAGE_B.mint.S_A;
      rSetup.tx(await rig!.mintTo(S_B, STAGE_B.mint.S_B, SEEDS.ownerT));
      minted.S_B = STAGE_B.mint.S_B;
      stage!.meta.minted = { S_A: String(minted.S_A), S_B: String(minted.S_B) };

      rSetup.tx(await rig!.depositFrom(SEEDS.ownerN, 'OwnerN', S_A, STAGE_B.deposit, AA_A.id));
      await rig!.base.waitForManagerNow(
        (m) => (m.pools[S_A!.hex]?.value ?? 0n) === STAGE_B.deposit,
        `pool(S_A) to reach ${STAGE_B.deposit}`,
      );
      o2 = await obs({ users: true, op2: true });
      rSetup.observedAfter(o2)
        .pool(o2, 'S_A', String(STAGE_B.deposit))
        .pool(o2, 'S_B', 'absent')
        .cell(o2, 'AA_A/S_A', String(STAGE_B.deposit))
        .cell(o2, 'AA_A/S_B', 'absent')
        .sizes(o2, { pools: 1, shieldedCells: 1, unshieldedCells: 0 })
        .user(o2, 'OwnerN', 'S_A', String(STAGE_B.mint.S_A - STAGE_B.deposit))
        .user(o2, 'OwnerT', 'S_B', String(STAGE_B.mint.S_B))
        .op2Agrees(o2)
        .structural(o2);
    });
    rSetup.done();

    // --- ROW 7 — OFFER-2, the open shape --------------------------------------------------------
    let offer2File: string | undefined;
    let offer2Report: any;
    let o7: SwapObservation | undefined;
    const r7 = stage.row(
      'row-7',
      `OFFER-2 built (v2 OPEN — floating surplus): give S_A ${STAGE_B.offer2.gives} to no one, want S_B ${STAGE_B.offer2.wants} → AA_A`,
      specOf(7),
    );
    await attempt(r7, async () => {
      if (!S_A || !S_B || !o2) throw new Error('the stage setup did not complete');
      offer2Report = runMaker(
        {
          label: 'OFFER-2',
          managerAddress: rig!.base.managerAddress,
          witness: 'ownerA',
          shape: 'floating-surplus',
          gives: { colour: S_A.hex, value: String(STAGE_B.offer2.gives) },
          wants: { colour: S_B.hex, value: String(STAGE_B.offer2.wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          envelopeOut: join(OFFERS_DIR, 'offer-2-open.offer'),
        },
        'row7-maker',
      );
      if (offer2Report.ok !== true) {
        r7.check('OFFER-2 was built and proven', false, String(offer2Report.error)).verbatim(offer2Report.error);
        return;
      }
      offer2File = offer2Report.envelopeFile;
      const reader = runReader(offer2File!, 'row7-reader');
      o7 = await obs({ users: true });

      const expected = {
        [`shielded:${S_A.hex}`]: String(STAGE_B.offer2.gives),
        [`shielded:${S_B.hex}`]: String(-STAGE_B.offer2.wants),
      };
      const seg0 = offer2Report.placement.imbalances['0'] ?? {};
      const sameImbalances =
        Object.keys(seg0).length === Object.keys(expected).length &&
        Object.entries(expected).every(([k, v]) => seg0[k] === v);

      r7.observedBefore(o2)
        .observedAfter(o7)
        .artifact('makerReport', offer2Report)
        .artifact('readerProcess', reader)
        .check('OFFER-2 was built and proven', offer2Report.ok === true, `${offer2Report.proveMs} ms`)
        .check(
          `FR-302: imbalances(0) is EXACTLY +${STAGE_B.offer2.gives} S_A and −${STAGE_B.offer2.wants} S_B`,
          sameImbalances,
          JSON.stringify(seg0),
        )
        .check(
          'FR-302: no other segment carries any delta',
          offer2Report.placement.otherSegmentsEmpty === true,
          JSON.stringify(offer2Report.placement.offendingSegments),
        )
        .check(
          'THE OPEN PROPERTY: the offer names NO recipient for colour A',
          offer2Report.terms.gives.recipient === undefined,
          'terms.gives.recipient absent',
        )
        .check(
          "THE OPEN PROPERTY, structurally: the maker process was never GIVEN a recipient — its input has no such field",
          offer2Report.spec?.recipientSeedName === undefined &&
            !JSON.stringify(offer2Report.spec).includes(SEEDS.ownerT),
          `maker input: ${JSON.stringify(offer2Report.spec)}`,
        )
        .check('FR-301: the maker attached NO DUST', offer2Report.terms.makerAttachedDust === false, '')
        .check(
          'FR-306: the envelope round-tripped a real process boundary byte-identically',
          Boolean(reader.envelopeFramingParsed && reader.roundTripByteIdentical),
          `reader pid ${reader.process?.pid}, ${reader.payloadIdentity?.transactionBytes} bytes, sha ${String(reader.payloadIdentity?.contentAddress).slice(0, 16)}… computed from payload`,
        )
        .check(
          'a reader with NO NETWORK sees the +A surplus the terms declare',
          reader.surpluses?.[`0/shielded:${S_A.hex}`] === String(STAGE_B.offer2.gives),
          JSON.stringify(reader.surpluses),
        )
        .check(
          'the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline)',
          Boolean(reader.unsubmittableAlone?.proven),
          String(reader.unsubmittableAlone?.error ?? ''),
        )
        .check(
          'building and proving changed NO on-chain state',
          JSON.stringify(o7.mapSizes) === JSON.stringify(o2.mapSizes) &&
            JSON.stringify(o7.pools) === JSON.stringify(o2.pools) &&
            JSON.stringify(o7.cells) === JSON.stringify(o2.cells),
          `sizes ${JSON.stringify(o7.mapSizes)}`,
        )
        .structural(o7)
        .verbatim(reader.unsubmittableAlone?.error);
    });
    r7.done();

    // --- ROW 8 — the open take ------------------------------------------------------------------
    const r8 = stage.row('row-8', 'OwnerT — whose keys the maker never knew — takes OFFER-2', specOf(8));
    await attempt(r8, async () => {
      const before = o7 ?? o2;
      if (!offer2File || !S_A || !S_B || !before) {
        r8.skip('OFFER-2 was not published, so there is nothing to settle');
        return;
      }
      const rep = runTaker(
        {
          label: 'row-8',
          envelope: offer2File,
          takerSeedName: 'ownerT',
          require: [{ colour: S_B.hex, amount: String(STAGE_B.offer2.wants) }],
        },
        'row8-taker',
      );
      if (rep.harnessFailure) throw new Error(`taker process failed: ${rep.harnessFailure}`);
      const take = rep.take;
      if (take?.ok) {
        await rig!.base.waitForManagerNow(
          (m) => (m.pools[S_B!.hex]?.value ?? 0n) === STAGE_B.offer2.wants && m.pools[S_A!.hex] === undefined,
          `pool(S_B) to reach ${STAGE_B.offer2.wants} and pool(S_A) to be REMOVED`,
        );
      }
      const after = await obs({ users: true, op2: true });
      const makerSegments: string[] = (offer2Report.placement.intentSegments ?? []).map(String);
      const dustActions: Record<string, { spends: number }> = take?.merged?.dustActions ?? {};
      const makerSpends = makerSegments.reduce((n, s) => n + (dustActions[s]?.spends ?? 0), 0);
      const otherSegments = Object.keys(dustActions).filter((s) => !makerSegments.includes(s));
      const otherSpends = otherSegments.reduce((n, s) => n + (dustActions[s]?.spends ?? 0), 0);

      r8.observedBefore(before)
        .observedAfter(after)
        .tx(take?.settlement?.txId)
        .artifact('takeReport', rep)
        .check('the OPEN swap SETTLED', take?.ok === true, take?.settlement?.txId ?? take?.error ?? '')
        .check('ONE transaction id settled it', Boolean(take?.settlement?.txId), String(take?.settlement?.txId))
        .check(
          'THE OPEN CLAIM: a wallet the maker never named SWEPT the surplus',
          take?.ok === true && after.users.OwnerT?.S_A === String(STAGE_B.afterRow8.ownerT_A),
          `OwnerT S_A 0 -> ${after.users.OwnerT?.S_A} (expected ${STAGE_B.afterRow8.ownerT_A})`,
        )
        .check(
          'the taker funded the −B deficit out of its own coins',
          take?.ok === true && after.users.OwnerT?.S_B === String(STAGE_B.afterRow8.ownerT_B),
          `OwnerT S_B ${STAGE_B.mint.S_B} -> ${after.users.OwnerT?.S_B}`,
        )
        .pool(after, 'S_A', 'absent')
        .pool(after, 'S_B', String(STAGE_B.afterRow8.poolB))
        .cell(after, 'AA_A/S_A', String(STAGE_B.afterRow8.cellA))
        .cell(after, 'AA_A/S_B', String(STAGE_B.afterRow8.cellB))
        .cell(after, 'AA_B/S_A', 'absent')
        .sizes(after, STAGE_B.afterRow8.sizes)
        .user(after, 'OwnerN', 'S_A', String(STAGE_B.afterRow8.ownerN_A))
        .check(
          "the MAKER's intent in the settled transaction has ZERO dust spends",
          take?.ok === true && makerSpends === 0,
          `maker segments ${JSON.stringify(makerSegments)} -> ${makerSpends}; full map ${JSON.stringify(dustActions)}`,
        )
        .check(
          'ANOTHER intent attached the dust, so the taker really paid',
          take?.ok === true && otherSpends > 0,
          `other segments ${JSON.stringify(otherSegments)} -> ${otherSpends}`,
        )
        .check(
          "the taker's own balancer swept the surplus — nothing was left unswept",
          take?.ok === true && Object.keys(take?.merged?.unswept ?? {}).length === 0,
          JSON.stringify(take?.merged?.unswept ?? {}),
        )
        .op2Agrees(after)
        .structural(after)
        .note(
          'The pool for S_A is REMOVED, not zeroed: the release took the whole pooled coin, so the colour leaves ' +
            'the pool map entirely — while the ACCOUNT CELL stays at 0. That is why the end-state map sizes are ' +
            '1 pool / 2 shielded cells / 0 unshielded, exactly as the spec\'s row 8 says.',
        )
        .note(
          'Deltas match the spec exactly; the S_B TOTALS do not, because the +7 the spec\'s figures carry was ' +
            "created by row 5 on stage A's Manager. That is deviation D-307 and nothing else.",
        );
    });
    if (r8.rec.status === 'PENDING') r8.done();

    stage.write();
    console.log(`\n## STAGE B VERDICT: ${stage.verdict}`);
    for (const r of stage.failedRows) console.log(`   FAILED ROW: ${r.id} — ${r.title}`);
    if (stage.verdict !== 'GREEN') process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nSTAGE B FATAL: ${err}`);
    if (stage) {
      stage.fatal = err;
      stage.write();
    }
    process.exitCode = 1;
  } finally {
    if (rig) await rig.close();
    log(`stage B finished; evidence in ${EVIDENCE_DIR}`);
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
