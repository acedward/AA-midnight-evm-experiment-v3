// STAGE A — the v1 named-taker lifecycle: spec rows 0–6, plus NC-304, NC-305 and P-F310.
// 00006 Plan 03 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This is the spec's step ledger from row 0 to row 6 on ONE Manager, exactly as written — deploy,
// register, mint, deposit, build the named-taker offer, refuse it when it is submitted alone, settle
// it with an independent wallet under ONE transaction id, and refuse the double take. It is the half
// of the demonstration that F-310 leaves fully reachable, and it ends where F-310 says it must.
//
// It then does the thing that makes deviation D-307 evidence rather than an excuse: **P-F310**
// ATTEMPTS THE SPEC'S LITERAL ROW 7 on this very Manager, now that row 5 has left custody at two
// cells, and records the fail-closed refusal verbatim. Two arms, because two different mechanisms
// could explain a failure and only one of them is F-310:
//
//   literal   want S_B, whose pool row 5 just created. Fails for F-308's reason as well as F-310's.
//   fresh     want a colour with NO pool at all, so `claimWantedColour` takes its cheap branch. If
//             this fails too, the wanted colour's pool is not the binding constraint — the CELL
//             COUNT is, which is exactly F-310's claim.
//
// Both arms are run twice: once with FR-302 armed (the fail-closed refusal, which is the result) and
// once in `measureOnly` mode (the placement report, which is the diagnosis). The measured artifacts
// are never published.
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { hex } from '../manager-view.js';
import { bootstrapSwapRig, type Colour, type SwapRig } from '../g2/swap-rig.js';
import { SPEC_ROWS, STAGE_A } from './expected.js';
import { observeSwap, type SwapObservation, type UserRef } from './observe.js';
import {
  EVIDENCE_DIR,
  OFFERS_DIR,
  Row,
  Stage,
  runDirectSubmit,
  runMaker,
  runReader,
  runTaker,
  stamp,
  tamperAndRepairAddress,
  tamperOneByte,
} from './stage.js';

const specOf = (n: number) => {
  const r = SPEC_ROWS.find((x) => x.row === n)!;
  return { specRow: r.row, specAction: r.action, specExpected: r.expected, asRun: r.asRun };
};

/** Run a row body without letting one row's harness failure abandon the rest of the stage. */
const attempt = async (r: Row, body: () => Promise<void>): Promise<void> => {
  try {
    await body();
  } catch (e) {
    const err = errorChain(e);
    r.check('the row completed without a harness failure', false, err).verbatim(err);
  }
};

const main = async () => {
  console.log(`# STAGE A — spec rows 0–6 + NC-304/305 + P-F310 — ${stamp()}`);
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
      stage: 'A',
      carries: STAGE_A.carries,
      managerAddress: rig.base.managerAddress,
      accounts: { AA_A: rig.base.ids.AA_A, AA_B: rig.base.ids.AA_B },
      colours: {},
      minted: {},
    });

    // --- ROW 0 ---------------------------------------------------------------------------------
    let o0: SwapObservation | undefined;
    const r0 = stage.row('row-0', 'Manager v4 deployed; AA_A and AA_B registered', specOf(0));
    await attempt(r0, async () => {
      o0 = await obs({ users: false });
      r0.observedAfter(o0)
        .check('both accounts are registered', o0.accounts.length === 2, `accounts: ${o0.accounts.length}`)
        .sizes(o0, { pools: 0, shieldedCells: 0, unshieldedCells: 0 })
        .structural(o0);
    });
    r0.done();

    // --- ROW 1 ---------------------------------------------------------------------------------
    let S_A: Colour | undefined;
    let S_B: Colour | undefined;
    const r1 = stage.row('row-1', 'Minters TOKA/TOKB deployed; S_A 10 → OwnerN, S_B 10 → OwnerT', specOf(1));
    await attempt(r1, async () => {
      S_A = await rig!.addColour('S_A', 'TOKA');
      S_B = await rig!.addColour('S_B', 'TOKB');
      colours = [S_A, S_B];
      stage!.meta.colours = { S_A: S_A.hex, S_B: S_B.hex };
      r1.tx(await rig!.mintTo(S_A, STAGE_A.mint.S_A, SEEDS.ownerN));
      minted.S_A = STAGE_A.mint.S_A;
      r1.tx(await rig!.mintTo(S_B, STAGE_A.mint.S_B, SEEDS.ownerT));
      minted.S_B = STAGE_A.mint.S_B;
      stage!.meta.minted = { S_A: String(minted.S_A), S_B: String(minted.S_B) };
      const o1 = await obs({ users: true });
      r1.observedAfter(o1)
        .check(
          'Manager state UNCHANGED by minting: all three maps are still size 0',
          JSON.stringify(o1.mapSizes) === JSON.stringify({ pools: 0, shieldedCells: 0, unshieldedCells: 0 }),
          JSON.stringify(o1.mapSizes),
        )
        .pool(o1, 'S_A', 'absent')
        .pool(o1, 'S_B', 'absent')
        .cell(o1, 'AA_A/S_A', 'absent')
        .cell(o1, 'AA_A/S_B', 'absent')
        .user(o1, 'OwnerN', 'S_A', String(STAGE_A.mint.S_A))
        .user(o1, 'OwnerT', 'S_B', String(STAGE_A.mint.S_B))
        .structural(o1);
    });
    r1.done();

    // --- ROW 2 ---------------------------------------------------------------------------------
    let o2: SwapObservation | undefined;
    const r2 = stage.row('row-2', `OwnerN deposits S_A ${STAGE_A.deposit} → AA_A`, specOf(2));
    await attempt(r2, async () => {
      if (!S_A || !S_B) throw new Error('row 1 did not produce the colours');
      r2.tx(await rig!.depositFrom(SEEDS.ownerN, 'OwnerN', S_A, STAGE_A.deposit, AA_A.id));
      await rig!.base.waitForManagerNow(
        (m) => (m.pools[S_A!.hex]?.value ?? 0n) === STAGE_A.deposit,
        `pool(S_A) to reach ${STAGE_A.deposit}`,
      );
      o2 = await obs({ users: true, op2: true });
      r2.observedAfter(o2)
        .pool(o2, 'S_A', String(STAGE_A.deposit))
        .pool(o2, 'S_B', 'absent')
        .cell(o2, 'AA_A/S_A', String(STAGE_A.deposit))
        .cell(o2, 'AA_A/S_B', 'absent')
        .cell(o2, 'AA_B/S_A', 'absent')
        .sizes(o2, { pools: 1, shieldedCells: 1, unshieldedCells: 0 })
        .user(o2, 'OwnerN', 'S_A', String(STAGE_A.mint.S_A - STAGE_A.deposit))
        .op2Agrees(o2)
        .structural(o2);
    });
    r2.done();

    // --- NC-305 — unauthorized make -------------------------------------------------------------
    const rNc305 = stage.row('nc-305', "unauthorized make: OwnerN's witness attempts an offer on AA_A's S_A", {
      specAction: "NC-305: OwnerN's witness (unregistered for AA_A) attempts to open an offer on AA_A's S_A",
      specExpected: 'refused at the choke point; no state',
    });
    await attempt(rNc305, async () => {
      if (!S_A || !S_B || !o2) throw new Error('row 2 did not complete');
      const before = o2;
      const rep = runMaker(
        {
          label: 'NC-305',
          managerAddress: rig!.base.managerAddress,
          witness: STAGE_A.nc305.witness,
          shape: 'named-taker',
          gives: { colour: S_A.hex, value: String(STAGE_A.nc305.gives) },
          wants: { colour: S_B.hex, value: String(STAGE_A.nc305.wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          recipientSeedName: 'ownerT',
        },
        'nc305-maker',
      );
      const after = await obs({ users: true });
      rNc305.observedBefore(before)
        .observedAfter(after)
        .artifact('makerReport', rep)
        .verbatim(rep.error)
        .check('the offer build was REFUSED', rep.ok === false, `ok=${rep.ok}`)
        .check(
          'refused at THE WITNESS CHOKE POINT — the verbatim error names the unregistered witness',
          /witness matches no registered account/.test(String(rep.error)),
          String(rep.error).slice(0, 200),
        )
        .check('nothing was published', rep.published === false, `published=${rep.published}`)
        .note(`the maker process classified the refusal as \`${rep.errorKind}\``)
        .noStateCreated(before, after, ['AA_A/S_B', 'AA_B/S_A']);
    });
    rNc305.done();

    // --- ROW 3 — OFFER-1 ------------------------------------------------------------------------
    let offer1File: string | undefined;
    let offer1Report: any;
    let o3: SwapObservation | undefined;
    const r3 = stage.row(
      'row-3',
      `OFFER-1 built (v1 named-taker): give S_A ${STAGE_A.offer1.gives} to OwnerT, want S_B ${STAGE_A.offer1.wants} → AA_A`,
      specOf(3),
    );
    await attempt(r3, async () => {
      if (!S_A || !S_B || !o2) throw new Error('row 2 did not complete');
      const target = join(OFFERS_DIR, 'offer-1.offer');
      offer1Report = runMaker(
        {
          label: 'OFFER-1',
          managerAddress: rig!.base.managerAddress,
          witness: 'ownerA',
          shape: 'named-taker',
          gives: { colour: S_A.hex, value: String(STAGE_A.offer1.gives) },
          wants: { colour: S_B.hex, value: String(STAGE_A.offer1.wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          recipientSeedName: 'ownerT',
          envelopeOut: target,
        },
        'row3-maker',
      );
      if (offer1Report.ok !== true) {
        r3.check('OFFER-1 was built and proven', false, String(offer1Report.error)).verbatim(offer1Report.error);
        return;
      }
      offer1File = offer1Report.envelopeFile;
      const reader = runReader(offer1File!, 'row3-reader');
      o3 = await obs({ users: true });

      const expectedImbalance = { [`shielded:${S_B.hex}`]: String(-STAGE_A.offer1.wants) };
      r3.observedBefore(o2)
        .observedAfter(o3)
        .artifact('makerReport', offer1Report)
        .artifact('readerProcess', reader)
        .check('OFFER-1 was built and proven', offer1Report.ok === true, `${offer1Report.proveMs} ms`)
        .check(
          'the maker ran in a DIFFERENT OS PROCESS from this stage',
          offer1Report.process?.pid !== process.pid,
          `maker pid ${offer1Report.process?.pid}, stage pid ${process.pid}`,
        )
        .check(
          `FR-302: imbalances(0) is EXACTLY ${JSON.stringify(expectedImbalance)}`,
          JSON.stringify(offer1Report.placement.imbalances['0']) === JSON.stringify(expectedImbalance),
          JSON.stringify(offer1Report.placement.imbalances['0']),
        )
        .check(
          'FR-302: no other segment carries any delta',
          offer1Report.placement.otherSegmentsEmpty === true && offer1Report.placement.offendingSegments.length === 0,
          JSON.stringify(offer1Report.placement.offendingSegments),
        )
        .check('FR-301: the maker attached NO DUST', offer1Report.terms.makerAttachedDust === false, '')
        .check(
          'FR-306: the envelope round-tripped a real process boundary byte-identically',
          Boolean(reader.envelopeFramingParsed && reader.roundTripByteIdentical),
          `reader pid ${reader.process?.pid}, ${reader.payloadIdentity?.transactionBytes} bytes, sha ${String(reader.payloadIdentity?.contentAddress).slice(0, 16)}… computed from payload`,
        )
        .check(
          'a reader with NO NETWORK sees exactly the deficit the terms declare',
          reader.deficits?.[`0/shielded:${S_B.hex}`] === String(-STAGE_A.offer1.wants),
          JSON.stringify(reader.deficits),
        )
        .check(
          'the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline)',
          Boolean(reader.unsubmittableAlone?.proven),
          String(reader.unsubmittableAlone?.error ?? reader.unsubmittableAlone?.note ?? ''),
        )
        .check(
          'building and proving changed NO on-chain state',
          JSON.stringify(o3.mapSizes) === JSON.stringify(o2.mapSizes) &&
            JSON.stringify(o3.pools) === JSON.stringify(o2.pools) &&
            JSON.stringify(o3.cells) === JSON.stringify(o2.cells),
          `sizes ${JSON.stringify(o3.mapSizes)} pools ${JSON.stringify(o3.pools)}`,
        )
        .structural(o3)
        .verbatim(reader.unsubmittableAlone?.error);
    });
    r3.done();

    // --- ROW 4 / NC-301 — submitted directly, unbalanced ---------------------------------------
    let o4: SwapObservation | undefined;
    const r4 = stage.row('row-4', 'OFFER-1 submitted DIRECTLY (unbalanced) — NC-301', specOf(4));
    await attempt(r4, async () => {
      if (!offer1File || !o3) {
        r4.skip('OFFER-1 was not published, so there is nothing to submit');
        return;
      }
      const rep = runDirectSubmit(
        { label: 'row-4', envelope: offer1File, submitterSeedName: 'feePayer' },
        'row4-direct',
      );
      o4 = await obs({ users: true });
      const accepted = (rep.attempts ?? []).filter((a: any) => a.submitted === true);
      const nodeRefusals = (rep.attempts ?? []).filter((a: any) => a.nodeRefusal?.code != null);
      r4.observedBefore(o3)
        .observedAfter(o4)
        .artifact('directSubmitReport', rep)
        .verbatim(rep.offlineWellFormed?.verbatim)
        .check('NO submission of the unbalanced offer was accepted', accepted.length === 0, `${accepted.length} accepted`)
        .check(
          "the LEDGER's own offline verdict refuses it, verbatim",
          rep.offlineWellFormed?.refused === true,
          String(rep.offlineWellFormed?.verbatim ?? '').slice(0, 240),
        )
        .check(
          'every submission attempt was refused with a verbatim error (the spec asks for node OR ledger)',
          (rep.attempts ?? []).length > 0 && (rep.attempts ?? []).every((a: any) => Boolean(a.error)),
          (rep.attempts ?? []).map((a: any) => `${a.form}: ${a.layer}`).join(' | '),
        )
        .note(
          nodeRefusals.length > 0
            ? `the NODE itself refused ${nodeRefusals.length} of ${(rep.attempts ?? []).length} attempt(s): ` +
                nodeRefusals.map((a: any) => `${a.form} -> Custom error: ${a.nodeRefusal.code} (${a.nodeRefusal.decoded})`).join('; ')
            : 'no attempt reached the node: the facade/ledger refused the unbalanced artifact before it was sent — ' +
                'which is the same refusal one layer earlier, and the spec accepts a node OR ledger error',
        )
        .noStateCreated(o3, o4, ['AA_A/S_B', 'AA_B/S_A']);
      for (const a of rep.attempts ?? []) r4.verbatim(`[${a.form}] ${a.nodeRefusal?.verbatim ?? a.error}`);
    });
    if (r4.rec.status === 'PENDING') r4.done();

    // --- ROW 5 — THE HEADLINE -------------------------------------------------------------------
    let o5: SwapObservation | undefined;
    let take5: any;
    const r5 = stage.row('row-5', 'OwnerT takes OFFER-1: stock balance → merge → submit', specOf(5));
    await attempt(r5, async () => {
      const beforeRow5 = o4 ?? o3;
      if (!offer1File || !S_A || !S_B || !beforeRow5) {
        r5.skip('OFFER-1 was not published, so there is nothing to settle');
        return;
      }
      const rep = runTaker(
        {
          label: 'row-5',
          envelope: offer1File,
          takerSeedName: 'ownerT',
          require: [{ colour: S_B.hex, amount: String(STAGE_A.offer1.wants) }],
        },
        'row5-taker',
      );
      take5 = rep.take;
      if (rep.harnessFailure) throw new Error(`taker process failed: ${rep.harnessFailure}`);
      if (take5?.ok) {
        await rig!.base.waitForManagerNow(
          (m) =>
            (m.pools[S_A!.hex]?.value ?? 0n) === STAGE_A.afterRow5.poolA &&
            (m.pools[S_B!.hex]?.value ?? 0n) === STAGE_A.afterRow5.poolB,
          `pool(S_A) to reach ${STAGE_A.afterRow5.poolA} and pool(S_B) to reach ${STAGE_A.afterRow5.poolB}`,
        );
      }
      o5 = await obs({ users: true, op2: true });
      const makerSegments: string[] = (offer1Report.placement.intentSegments ?? []).map(String);
      const dustActions: Record<string, { spends: number }> = take5?.merged?.dustActions ?? {};
      const makerSpends = makerSegments.reduce((n, s) => n + (dustActions[s]?.spends ?? 0), 0);
      const otherSegments = Object.keys(dustActions).filter((s) => !makerSegments.includes(s));
      const otherSpends = otherSegments.reduce((n, s) => n + (dustActions[s]?.spends ?? 0), 0);

      r5.observedBefore(beforeRow5)
        .observedAfter(o5)
        .tx(take5?.settlement?.txId)
        .artifact('takeReport', rep)
        .check('the swap SETTLED', take5?.ok === true, take5?.settlement?.txId ?? take5?.error ?? '')
        .check(
          'ONE transaction id settled the whole swap',
          Boolean(take5?.settlement?.txId) && (take5?.settlement?.finalizedIntentSegments ?? []).length >= 1,
          `tx ${take5?.settlement?.txId}; merged intent segments ${JSON.stringify(take5?.settlement?.finalizedIntentSegments)}`,
        )
        .pool(o5, 'S_A', String(STAGE_A.afterRow5.poolA))
        .pool(o5, 'S_B', String(STAGE_A.afterRow5.poolB))
        .cell(o5, 'AA_A/S_A', String(STAGE_A.afterRow5.cellA))
        .cell(o5, 'AA_A/S_B', String(STAGE_A.afterRow5.cellB))
        .cell(o5, 'AA_B/S_A', 'absent')
        .cell(o5, 'AA_B/S_B', 'absent')
        .sizes(o5, STAGE_A.afterRow5.sizes)
        .user(o5, 'OwnerT', 'S_A', String(STAGE_A.afterRow5.ownerT_A))
        .user(o5, 'OwnerT', 'S_B', String(STAGE_A.afterRow5.ownerT_B))
        .user(o5, 'OwnerN', 'S_A', String(STAGE_A.afterRow5.ownerN_A))
        .check(
          "the MAKER's intent in the settled transaction has ZERO dust spends",
          take5?.ok === true && makerSpends === 0,
          `maker segments ${JSON.stringify(makerSegments)} -> ${makerSpends} dust spends; full map ${JSON.stringify(dustActions)}`,
        )
        .check(
          'ANOTHER intent DID attach dust, so the fee was really paid — by the taker',
          take5?.ok === true && otherSpends > 0,
          `other segments ${JSON.stringify(otherSegments)} -> ${otherSpends} dust spends`,
        )
        .check(
          'the merged transaction balanced with nothing left unswept',
          take5?.ok === true && Object.keys(take5?.merged?.unswept ?? {}).length === 0,
          JSON.stringify(take5?.merged?.unswept ?? {}),
        )
        .check(
          'the taker ran in a DIFFERENT OS PROCESS from the maker',
          rep.process?.pid !== offer1Report.process?.pid,
          `taker pid ${rep.process?.pid} vs maker pid ${offer1Report.process?.pid}`,
        )
        .op2Agrees(o5)
        .structural(o5)
        .note(
          "maker DUST spend 0 is read from the settled transaction's PER-INTENT dust actions, never from " +
            '`dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably ' +
            'paying fees (Plan 02 finding, spike S6). The maker is funded and DUST-registered on purpose, so ' +
            'the claim is about a wallet that COULD have paid.',
        );
    });
    if (r5.rec.status === 'PENDING') r5.done();

    // --- the spec's v1-only FINAL TABLE, asserted where it applies -----------------------------
    const rTable = stage.row('final-table-v1', "the spec's final table, v1-only column (in parentheses there)", {
      specExpected:
        'OwnerN 4 S_A / 0 S_B; OwnerT (4) S_A / (3) S_B; AA_A (2) S_A / (7) S_B; pool (2) S_A / (7) S_B; sizes 2 pools / 2 shielded cells / 0 unshielded',
      asRun:
        'asserted HERE, immediately after row 5 — before the labelled fixture that makes row 6 a node refusal. ' +
        'Under D-307 the v2 column belongs to stage B',
    });
    await attempt(rTable, async () => {
      if (!o5) {
        rTable.skip('row 5 did not complete');
        return;
      }
      rTable.observedAfter(o5)
        .user(o5, 'OwnerN', 'S_A', '4')
        .user(o5, 'OwnerN', 'S_B', '0')
        .user(o5, 'OwnerT', 'S_A', '4')
        .user(o5, 'OwnerT', 'S_B', '3')
        .cell(o5, 'AA_A/S_A', '2')
        .cell(o5, 'AA_A/S_B', '7')
        .pool(o5, 'S_A', '2')
        .pool(o5, 'S_B', '7')
        .sizes(o5, { pools: 2, shieldedCells: 2, unshieldedCells: 0 })
        .structural(o5);
    });
    if (rTable.rec.status === 'PENDING') rTable.done();

    // --- FIXTURE + ROW 6 / NC-302 — the double take --------------------------------------------
    let o6: SwapObservation | undefined;
    const r6 = stage.row('row-6', 'Double-take: OFFER-1 balanced and submitted again — NC-302', specOf(6));
    await attempt(r6, async () => {
      if (!offer1File || !S_B) {
        r6.skip('OFFER-1 was not published');
        return;
      }
      // FIXTURE, labelled as such: after row 5 the taker holds 3 S_B and could not balance a 7 S_B
      // deficit at all, so the refusal would come from its own wallet rather than from the node.
      r6.tx(await rig!.mintTo(S_B, STAGE_A.doubleTakeTopUpB, SEEDS.ownerT));
      minted.S_B = (minted.S_B ?? 0n) + STAGE_A.doubleTakeTopUpB;
      stage!.meta.minted = { ...stage!.meta.minted, S_B: String(minted.S_B) };
      r6.note(
        `FIXTURE (not a spec row): minted ${STAGE_A.doubleTakeTopUpB} more S_B to OwnerT so the double take can ` +
          'reach the NODE. Without it the taker cannot fund the deficit and its own balancer refuses first, ' +
          'which would be a weaker result than the spec asks for.',
      );
      const before = await obs({ users: true });
      const rep = runTaker(
        {
          label: 'row-6',
          envelope: offer1File,
          takerSeedName: 'ownerT',
          require: [{ colour: S_B.hex, amount: String(STAGE_A.offer1.wants) }],
        },
        'row6-taker',
      );
      const take = rep.take;
      o6 = await obs({ users: true });
      r6.observedBefore(before)
        .observedAfter(o6)
        .artifact('takeReport', rep)
        .verbatim(take?.nodeRefusal?.verbatim ?? take?.error)
        .check('the double take was REFUSED', take?.ok === false, `stage=${take?.stage}`)
        .check(
          'the refusal came from the NODE (the backing coin is spent), with a numeric code',
          take?.nodeRefusal?.code != null,
          `code ${take?.nodeRefusal?.code} — ${take?.nodeRefusal?.decoded}`,
        )
        .noStateCreated(before, o6, ['AA_B/S_A', 'AA_B/S_B'])
        .note(
          `node code observed: ${take?.nodeRefusal?.code ?? 'none'} (${take?.nodeRefusal?.decoded ?? '—'}). ` +
            'Plan 02 measured 239 = NullifierAlreadyPresent for a spent backing coin.',
        );
    });
    if (r6.rec.status === 'PENDING') r6.done();

    // --- ROW 10 / NC-304 — tamper ---------------------------------------------------------------
    const r10 = stage.row('row-10', "Tamper: OFFER-1's retained bytes, one byte flipped, taken — NC-304", specOf(10));
    await attempt(r10, async () => {
      if (!offer1File) {
        r10.skip('OFFER-1 was not published');
        return;
      }
      const before = await obs({ users: true });
      // arm (a): the flip alone; its stale JSON hash is advisory under A-308.
      const fileA = join(OFFERS_DIR, 'offer-1-tampered.offer');
      const flipA = tamperOneByte(offer1File, fileA);
      const repA = runTaker({ label: 'row-10a', envelope: fileA, takerSeedName: 'ownerT' }, 'row10a-taker');
      // arm (b): the SAME flip with the advisory hash repaired. Its decision must match arm (a).
      const fileB = join(OFFERS_DIR, 'offer-1-tampered-repaired.offer');
      const flipB = tamperAndRepairAddress(offer1File, fileB);
      const repB = runTaker({ label: 'row-10b', envelope: fileB, takerSeedName: 'ownerT' }, 'row10b-taker');
      const after = await obs({ users: true });

      r10.observedBefore(before)
        .observedAfter(after)
        .artifact('armA', { flip: flipA, report: repA })
        .artifact('armB', { flip: flipB, report: repB })
        .verbatim(repA.take?.error)
        .verbatim(repB.take?.error)
        .check('arm (a): the tampered offer was REFUSED', repA.take?.ok === false, `stage=${repA.take?.stage}`)
        .check(
          'A-308: stale versus repaired advisory hash produces the same byte-derived take decision',
          repA.take?.stage === repB.take?.stage && repA.take?.contentAddress === repB.take?.contentAddress,
          `armA stage/hash=${repA.take?.stage}/${repA.take?.contentAddress}; armB=${repB.take?.stage}/${repB.take?.contentAddress}`,
        )
        .check('arm (b): the re-addressed tampered offer was ALSO refused', repB.take?.ok === false, `stage=${repB.take?.stage}`)
        .note(
          `both invalid serialized payloads were refused at byte-derived stage \`${repB.take?.stage}\`` +
            `${repB.take?.nodeRefusal?.code != null ? ` with node code ${repB.take.nodeRefusal.code}` : ' (offline)'}; ` +
            'repairing advisory JSON granted no authority.',
        )
        .noStateCreated(before, after, ['AA_B/S_A', 'AA_B/S_B']);
    });
    if (r10.rec.status === 'PENDING') r10.done();

    // --- P-F310 — the deviation's own evidence -------------------------------------------------
    const rF = stage.row('p-f310', "D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells", {
      specAction:
        "spec row 7 as literally written: OFFER-2 (floating surplus) give S_A 2 to no one the maker knows, want S_B 3 to AA_A",
      specExpected: 'imbalances(0) = +2 S_A, −3 S_B',
      asRun:
        'attempted on THIS Manager, where row 5 has left custody at two pools and two cells. F-310 predicts the ' +
        'value leg lands in the FALLIBLE section and FR-302 refuses to publish it. MEASURED: what happens is the result',
    });
    await attempt(rF, async () => {
      if (!S_A || !S_B) throw new Error('the colours do not exist');
      const before = await obs({ users: true });
      const mk = (label: string, wantColour: string, ioName: string, measureOnly = false) =>
        runMaker(
          {
            label,
            managerAddress: rig!.base.managerAddress,
            witness: 'ownerA',
            shape: 'floating-surplus',
            gives: { colour: S_A!.hex, value: String(STAGE_A.pf310Literal.gives) },
            wants: { colour: wantColour, value: String(STAGE_A.pf310Literal.wants) },
            creditAccount: hex(AA_A.id),
            makerAccount: hex(AA_A.id),
            ...(measureOnly ? { measureOnly: true } : { envelopeOut: join(OFFERS_DIR, `${ioName}.offer`) }),
          },
          ioName,
        );

      const literal = mk('P-F310-literal', S_B.hex, 'pf310-literal');
      const literalMeasured = mk('P-F310-literal-measured', S_B.hex, 'pf310-literal-measured', true);

      // The second arm needs a colour with NO pool, so a fresh issuer is deployed for it. It is
      // never minted or deposited: the arm is about placement, not about value.
      const S_C = await rig!.addColour('S_C', 'TOKC');
      colours = [S_A, S_B, S_C];
      minted.S_C = 0n;
      stage!.meta.colours = { ...stage!.meta.colours, S_C: S_C.hex };
      const fresh = mk('P-F310-fresh-colour', S_C.hex, 'pf310-fresh');
      const freshMeasured = mk('P-F310-fresh-colour-measured', S_C.hex, 'pf310-fresh-measured', true);

      const after = await obs({ users: true });
      const failedClosed = (r: any) => r.ok === false && r.errorKind === 'fr302-placement-fail-closed';
      const seg0Empty = (r: any) => JSON.stringify(r.placement?.imbalances?.['0'] ?? {}) === '{}';

      rF.observedBefore(before)
        .observedAfter(after)
        .artifact('literal', literal)
        .artifact('literalMeasured', literalMeasured)
        .artifact('freshColour', fresh)
        .artifact('freshColourMeasured', freshMeasured)
        .verbatim(literal.error)
        .verbatim(fresh.error)
        .check(
          "the spec's LITERAL row 7 FAILS CLOSED here — FR-302 refuses to publish it",
          failedClosed(literal),
          `ok=${literal.ok} kind=${literal.errorKind}`,
        )
        .check(
          'and the measured placement shows why: segment 0 carries NOTHING, the whole transcript went fallible',
          literalMeasured.ok === true && literalMeasured.placement?.ok === false && seg0Empty(literalMeasured),
          `segment 0 = ${JSON.stringify(literalMeasured.placement?.imbalances?.['0'])}; fallible-offer segments ` +
            `${JSON.stringify(literalMeasured.placement?.fallibleOfferSegments)}`,
        )
        .check(
          'the same offer wanting a colour with NO pool ALSO fails closed — so it is the CELL COUNT, not F-308’s pool effect',
          failedClosed(fresh),
          `ok=${fresh.ok} kind=${fresh.errorKind}`,
        )
        .check(
          'the fresh-colour arm’s placement is fallible too',
          freshMeasured.ok === true && freshMeasured.placement?.ok === false,
          `segment 0 = ${JSON.stringify(freshMeasured.placement?.imbalances?.['0'])}`,
        )
        .check(
          'nothing was published by any arm',
          [literal, literalMeasured, fresh, freshMeasured].every((r) => r.published === false),
          '',
        )
        .noStateCreated(before, after)
        .note(
          'This is the measurement deviation D-307 rests on. Both arms were FULLY BACKED — AA_A holds 2 S_A and ' +
            'the pool holds 2 — so the only thing that can refuse them is placement, which is exactly what did.',
        )
        .note(
          'It also replicates F-310 a fourth time, on a Manager it was never measured on, and separates the two ' +
            'candidate mechanisms: the wanted colour having a pool (F-308) is NOT necessary; two custody cells are enough.',
        );
    });
    rF.measured([
      'nothing was published by any arm',
      'NO state created: the whole custody snapshot is byte-identical',
      'the row completed without a harness failure',
    ]);

    // --- closing table --------------------------------------------------------------------------
    const rClose = stage.row('closing', 'Stage A closing state, both observation points', {
      specExpected: 'unchanged by rows 6, 10 and P-F310 — all three are refusals',
    });
    await attempt(rClose, async () => {
      const o = await obs({ users: true, op2: true });
      rClose.observedAfter(o)
        .pool(o, 'S_A', String(STAGE_A.afterRow5.poolA))
        .pool(o, 'S_B', String(STAGE_A.afterRow5.poolB))
        .pool(o, 'S_C', 'absent')
        .cell(o, 'AA_A/S_A', String(STAGE_A.afterRow5.cellA))
        .cell(o, 'AA_A/S_B', String(STAGE_A.afterRow5.cellB))
        .cell(o, 'AA_B/S_A', 'absent')
        .sizes(o, STAGE_A.afterRow5.sizes)
        .user(o, 'OwnerT', 'S_A', String(STAGE_A.afterRow5.ownerT_A))
        .user(o, 'OwnerT', 'S_B', String(STAGE_A.afterRow5.ownerT_B + STAGE_A.doubleTakeTopUpB))
        .op2Agrees(o)
        .structural(o)
        .note(
          `OwnerT's S_B is ${STAGE_A.afterRow5.ownerT_B} + ${STAGE_A.doubleTakeTopUpB} = ` +
            `${STAGE_A.afterRow5.ownerT_B + STAGE_A.doubleTakeTopUpB} because of the labelled row-6 fixture; the spec's ` +
            "v1-only figure of 3 is asserted in the `final-table-v1` row, before the fixture.",
        );
    });
    rClose.done();

    stage.write();
    console.log(`\n## STAGE A VERDICT: ${stage.verdict}`);
    for (const r of stage.failedRows) console.log(`   FAILED ROW: ${r.id} — ${r.title}`);
    if (stage.verdict !== 'GREEN') process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nSTAGE A FATAL: ${err}`);
    if (stage) {
      stage.fatal = err;
      stage.write();
    }
    process.exitCode = 1;
  } finally {
    if (rig) await rig.close();
    log(`stage A finished; evidence in ${EVIDENCE_DIR}`);
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
