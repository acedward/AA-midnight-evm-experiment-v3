// STAGE C — the lifecycle negatives: spec rows 9, 11 and 12, plus NC-306 and the P-F310 replication.
// 00006 Plan 03 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Every row here ends in a REFUSAL, which is exactly why they can share one Manager: a refusal
// creates no state, so it never spends the single-custody-cell budget that F-310 caps publishability
// at. What they could NOT do is share a Manager with a settlement — each one's intervention (a
// deposit on the offered colour, a withdraw, an internal transfer) would have invalidated the live
// offer that rows 5 and 8 must settle. That is deviation D-307's third stage and the whole reason it
// exists.
//
// ORDER IS LOAD-BEARING. Each row builds its OWN offer immediately before its own intervention, so
// the offer is valid at the moment the intervention happens and the refusal is attributable to that
// intervention and nothing else. Building an offer costs no state, so an offer built after the
// previous intervention pins the NEW pooled coin. The two rows that add a custody cell — 12b's
// internal transfer — run last, because after them nothing is publishable at all, which is what
// NC-306 and P-F310 then measure.
//
// ROW 12 IS MEASURED IN BOTH OF THE SPEC'S FORMS, because they are not the same mechanism:
//
//   withdraw           `withdrawShielded` SPENDS the pooled coin. The offer's pinned coin is gone and
//                      its nullifier is already in the tree — expect 239.
//   internal transfer  `transferInternalShielded` performs NO token operation whatsoever: the pooled
//                      coin is byte-identical afterwards (this stage asserts that). If it still kills
//                      the offer it can only be through the ACCOUNT CELL the transcript read — a
//                      different mechanism, expected to answer 104. Whether it does is a measurement,
//                      not a prediction to score.
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { log } from '../night.js';
import { accountWithdrawShielded, errorChain, transferInternalShielded } from '../g3/actions.js';
import { hex, shieldedKeyOf } from '../manager-view.js';
import { bootstrapSwapRig, type Colour, type SwapRig } from '../g2/swap-rig.js';
import { SPEC_ROWS, STAGE_C } from './expected.js';
import { observeSwap, type SwapObservation, type UserRef } from './observe.js';
import { EVIDENCE_DIR, OFFERS_DIR, Row, Stage, runMaker, runTaker, stamp } from './stage.js';

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const main = async () => {
  console.log(`# STAGE C — spec rows 9/11/12 + NC-306 + P-F310 replication — ${stamp()}`);
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
      // OwnerA holds real S_A after row 12a's cancelling WITHDRAW, so it is part of the table and of
      // the conservation sum — not a decoration.
      { label: 'OwnerA', seed: SEEDS.ownerA },
    ];
    let colours: Colour[] = [];
    const minted: Record<string, bigint> = {};
    const obs = (opts: { op2?: boolean; users?: boolean } = {}) =>
      observeSwap({ rig: rig!, colours, accounts, users, minted }, opts);

    stage = new Stage({
      stage: 'C',
      carries: STAGE_C.carries,
      managerAddress: rig.base.managerAddress,
      accounts: { AA_A: rig.base.ids.AA_A, AA_B: rig.base.ids.AA_B },
      colours: {},
      minted: {},
    });

    let S_A: Colour | undefined;
    let S_B: Colour | undefined;

    /** Build one offer in its own process. Refusals are results; the caller decides. */
    const makeOffer = (
      label: string,
      gives: bigint,
      wants: bigint,
      ioName: string,
      extra: Record<string, unknown> = {},
    ) =>
      runMaker(
        {
          label,
          managerAddress: rig!.base.managerAddress,
          witness: 'ownerA',
          shape: 'named-taker',
          gives: { colour: S_A!.hex, value: String(gives) },
          wants: { colour: S_B!.hex, value: String(wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          recipientSeedName: 'ownerT',
          envelopeOut: join(OFFERS_DIR, `${ioName}.offer`),
          ...extra,
        } as any,
        ioName,
      );

    const takeIt = (label: string, envelope: string, ioName: string, wants: bigint, ignoreExpiry = false) =>
      runTaker(
        {
          label,
          envelope,
          takerSeedName: 'ownerT',
          require: [{ colour: S_B!.hex, amount: String(wants) }],
          ...(ignoreExpiry ? { ignoreExpiry: true } : {}),
        },
        ioName,
      );

    // --- setup ----------------------------------------------------------------------------------
    let o2: SwapObservation | undefined;
    const rSetup = stage.row('setup', `fresh Manager; mint; OwnerN deposits S_A ${STAGE_C.deposit} → AA_A`, {
      specAction: 'the stage-local equivalent of spec rows 0–2',
      specExpected: `all maps size 0 → pool S_A=${STAGE_C.deposit}; AA_A: S_A=${STAGE_C.deposit}; maps 1/1/0`,
      asRun: `S_A ${STAGE_C.mint.S_A} is minted (not 10) so all five negatives have a give to make from one deposit`,
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
      rSetup.tx(await rig!.mintTo(S_A, STAGE_C.mint.S_A, SEEDS.ownerN));
      minted.S_A = STAGE_C.mint.S_A;
      rSetup.tx(await rig!.mintTo(S_B, STAGE_C.mint.S_B, SEEDS.ownerT));
      minted.S_B = STAGE_C.mint.S_B;
      stage!.meta.minted = { S_A: String(minted.S_A), S_B: String(minted.S_B) };

      rSetup.tx(await rig!.depositFrom(SEEDS.ownerN, 'OwnerN', S_A, STAGE_C.deposit, AA_A.id));
      await rig!.base.waitForManagerNow(
        (m) => (m.pools[S_A!.hex]?.value ?? 0n) === STAGE_C.deposit,
        `pool(S_A) to reach ${STAGE_C.deposit}`,
      );
      o2 = await obs({ users: true, op2: true });
      rSetup.observedAfter(o2)
        .pool(o2, 'S_A', String(STAGE_C.deposit))
        .cell(o2, 'AA_A/S_A', String(STAGE_C.deposit))
        .cell(o2, 'AA_B/S_A', 'absent')
        .sizes(o2, { pools: 1, shieldedCells: 1, unshieldedCells: 0 })
        .op2Agrees(o2)
        .structural(o2);
    });
    rSetup.done();

    // --- ROW 9 / NC-303 — expiry ----------------------------------------------------------------
    let last: SwapObservation | undefined = o2;
    const r9 = stage.row('row-9', 'Expiry: OFFER-3 held past its TTL, then taken — NC-303', specOf(9));
    await attempt(r9, async () => {
      if (!S_A || !S_B || !last) throw new Error('the stage setup did not complete');
      const rep = makeOffer('OFFER-3', STAGE_C.row9.gives, STAGE_C.row9.wants, 'row9-maker', {
        ttlSeconds: STAGE_C.row9.ttlSeconds,
        rewriteIntentTtlSeconds: STAGE_C.row9.ttlSeconds,
      });
      r9.artifact('makerReport', rep);
      if (rep.ok !== true) {
        r9.check('OFFER-3 was built and proven', false, String(rep.error)).verbatim(rep.error);
        return;
      }
      r9.check('OFFER-3 was built and proven', true, `${rep.proveMs} ms`).check(
        'the intent TTL rewrite took effect BEFORE proving (F-306)',
        typeof rep.intentTtlRewrite === 'string' && !/NOT APPLIED|FAILED/.test(rep.intentTtlRewrite),
        String(rep.intentTtlRewrite),
      );
      const preTake = await obs({ users: true });
      log(`row 9: waiting ${STAGE_C.row9.waitSeconds} s for the offer to outlive its ${STAGE_C.row9.ttlSeconds} s TTL`);
      await sleep(STAGE_C.row9.waitSeconds * 1000);

      const local = takeIt('row-9-local', rep.envelopeFile, 'row9-taker-local', STAGE_C.row9.wants);
      const node = takeIt('row-9-node', rep.envelopeFile, 'row9-taker-node', STAGE_C.row9.wants, true);
      const after = await obs({ users: true });
      last = after;

      r9.observedBefore(preTake)
        .observedAfter(after)
        .artifact('localGateTake', local)
        .artifact('nodeTake', node)
        .verbatim(local.take?.error)
        .verbatim(node.take?.nodeRefusal?.verbatim ?? node.take?.error)
        .check(
          "the taker's OWN gate refuses the expired offer OFFLINE, with no network contact",
          local.take?.stage === 'expired' && local.take?.offlineRefusal === true,
          `stage=${local.take?.stage} offline=${local.take?.offlineRefusal}`,
        )
        .check(
          'and with that gate forced off, the NODE refuses it too',
          node.take?.ok === false,
          `stage=${node.take?.stage} code ${node.take?.nodeRefusal?.code ?? 'none'}`,
        )
        .check(
          `the node's code is ${STAGE_C.row9.expectedNodeCode} (IntentTtlExpired) — the code Plan 02 measured`,
          node.take?.nodeRefusal?.code === STAGE_C.row9.expectedNodeCode,
          `${node.take?.nodeRefusal?.code ?? 'none'} — ${node.take?.nodeRefusal?.decoded ?? '—'}`,
        )
        .noStateCreated(preTake, after, ['AA_A/S_B', 'AA_B/S_A']);
    });
    if (r9.rec.status === 'PENDING') r9.done();

    // --- ROW 11 / P-104 — staleness -------------------------------------------------------------
    const r11 = stage.row('row-11', 'Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken', specOf(11));
    await attempt(r11, async () => {
      if (!S_A || !S_B) throw new Error('the stage setup did not complete');
      const rep = makeOffer('OFFER-4', STAGE_C.row11.gives, STAGE_C.row11.wants, 'row11-maker');
      r11.artifact('makerReport', rep);
      if (rep.ok !== true) {
        r11.check('OFFER-4 was built and proven', false, String(rep.error)).verbatim(rep.error);
        return;
      }
      const poolBefore = BigInt((last ?? o2)!.pools.S_A === 'absent' ? '0' : (last ?? o2)!.pools.S_A);
      r11.tx(
        await rig!.depositFrom(SEEDS.ownerN, 'OwnerN-intervene', S_A, STAGE_C.row11.interveneDeposit, AA_A.id),
      );
      await rig!.base.waitForManagerNow(
        (m) => (m.pools[S_A!.hex]?.value ?? 0n) === poolBefore + STAGE_C.row11.interveneDeposit,
        `pool(S_A) to reach ${poolBefore + STAGE_C.row11.interveneDeposit} after the intervening deposit`,
      );
      // The no-state baseline is taken HERE, after the intervention: the question a refusal answers is
      // whether the REFUSAL created state, and only this baseline can answer it.
      const preTake = await obs({ users: true });
      const take = takeIt('row-11', rep.envelopeFile, 'row11-taker', STAGE_C.row11.wants);
      const after = await obs({ users: true });
      last = after;

      r11.observedBefore(preTake)
        .observedAfter(after)
        .artifact('takeReport', take)
        .verbatim(take.take?.nodeRefusal?.verbatim ?? take.take?.error)
        .note(
          `intervention: OwnerN deposited ${STAGE_C.row11.interveneDeposit} more S_A into AA_A; ` +
            `pool(S_A) ${poolBefore} -> ${poolBefore + STAGE_C.row11.interveneDeposit}, which MERGES the pooled coin`,
        )
        .check('the live offer was INVALIDATED — the take was refused', take.take?.ok === false, `stage=${take.take?.stage}`)
        .check(
          `the MEASURED code is ${STAGE_C.row11.expectedNodeCode} (NullifierAlreadyPresent) — FR-311 predicted 104`,
          take.take?.nodeRefusal?.code === STAGE_C.row11.expectedNodeCode,
          `${take.take?.nodeRefusal?.code ?? 'none'} — ${take.take?.nodeRefusal?.decoded ?? '—'}` +
            (take.take?.nodeRefusal?.code === 104 ? ' (this run matched the ORIGINAL prediction instead)' : ''),
        )
        .noStateCreated(preTake, after, ['AA_A/S_B', 'AA_B/S_A'])
        .note(
          'MEASURED, not judged (FR-311). The mechanism: the maker\'s call pins the pooled coin it spends — the ' +
            "coin's Merkle index enters the transcript — and an ordinary deposit MERGES that coin, which SPENDS it. " +
            '239 names that precisely; 104 would only have said "a transcript did not match".',
        );
    });
    if (r11.rec.status === 'PENDING') r11.measured([
      'the live offer was INVALIDATED — the take was refused',
      'NO state created: the whole custody snapshot is byte-identical',
      'the row completed without a harness failure',
    ]);

    // --- ROW 12a / P-CXL — cancellation by WITHDRAW ---------------------------------------------
    const r12a = stage.row('row-12a', 'Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL', specOf(12));
    await attempt(r12a, async () => {
      if (!S_A || !S_B) throw new Error('the stage setup did not complete');
      const rep = makeOffer('OFFER-5', STAGE_C.row12a.gives, STAGE_C.row12a.wants, 'row12a-maker');
      r12a.artifact('makerReport', rep);
      if (rep.ok !== true) {
        r12a.check('OFFER-5 was built and proven', false, String(rep.error)).verbatim(rep.error);
        return;
      }
      const before = last ?? o2!;
      const poolBefore = BigInt(before.pools.S_A === 'absent' ? '0' : before.pools.S_A);
      const coinBefore = before.poolCoins.S_A;
      r12a.tx(
        await accountWithdrawShielded(
          rig!.base.ctx,
          rig!.base.raw.secretA,
          S_A.raw,
          STAGE_C.row12a.withdraw,
          rig!.maker,
          rig!.base.fee,
        ),
      );
      await rig!.base.waitForManagerNow(
        (m) => (m.pools[S_A!.hex]?.value ?? 0n) === poolBefore - STAGE_C.row12a.withdraw,
        `pool(S_A) to fall to ${poolBefore - STAGE_C.row12a.withdraw} after the cancelling withdraw`,
      );
      const preTake = await obs({ users: true });
      const take = takeIt('row-12a', rep.envelopeFile, 'row12a-taker', STAGE_C.row12a.wants);
      const after = await obs({ users: true });
      last = after;

      r12a.observedBefore(preTake)
        .observedAfter(after)
        .artifact('takeReport', take)
        .verbatim(take.take?.nodeRefusal?.verbatim ?? take.take?.error)
        .note(
          `cancellation: the owner withdrew ${STAGE_C.row12a.withdraw} S_A to its own wallet; pool(S_A) ` +
            `${poolBefore} -> ${preTake.pools.S_A}, and the POOLED COIN CHANGED (` +
            `${coinBefore?.nonce.slice(0, 12)}… -> ${preTake.poolCoins.S_A?.nonce.slice(0, 12)}…) because ` +
            '`sendShielded` spends it and re-pools the change',
        )
        .check('the cancelled offer was REFUSED', take.take?.ok === false, `stage=${take.take?.stage}`)
        .check(
          'the pooled coin really did move (so this is cancellation BY SPEND)',
          coinBefore?.nonce !== preTake.poolCoins.S_A?.nonce,
          `${coinBefore?.nonce.slice(0, 16)}… -> ${preTake.poolCoins.S_A?.nonce.slice(0, 16)}…`,
        )
        .check(
          `the node's code is ${STAGE_C.row12a.expectedNodeCode}`,
          take.take?.nodeRefusal?.code === STAGE_C.row12a.expectedNodeCode,
          `${take.take?.nodeRefusal?.code ?? 'none'} — ${take.take?.nodeRefusal?.decoded ?? '—'}`,
        )
        .noStateCreated(preTake, after, ['AA_A/S_B', 'AA_B/S_A']);
    });
    if (r12a.rec.status === 'PENDING') r12a.measured([
      'the cancelled offer was REFUSED',
      'the pooled coin really did move (so this is cancellation BY SPEND)',
      'NO state created: the whole custody snapshot is byte-identical',
      'the row completed without a harness failure',
    ]);

    // --- ROW 12b / P-CXL — cancellation by INTERNAL TRANSFER (no token operation) ---------------
    const r12b = stage.row(
      'row-12b',
      'Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL',
      {
        specAction: specOf(12).specAction,
        specExpected: specOf(12).specExpected,
        asRun:
          'the spec names "internal transfer / withdraw" as if they were interchangeable. They are not: ' +
          '`transferInternalShielded` performs NO token operation — the pooled coin must be byte-identical ' +
          'afterwards — so it can only invalidate an offer through the ACCOUNT CELL the transcript read. ' +
          'MEASURED separately for that reason. It is also the row that takes custody to two cells, which is ' +
          'why it runs after every other publishable offer',
      },
    );
    await attempt(r12b, async () => {
      if (!S_A || !S_B) throw new Error('the stage setup did not complete');
      const rep = makeOffer('OFFER-6', STAGE_C.row12b.gives, STAGE_C.row12b.wants, 'row12b-maker');
      r12b.artifact('makerReport', rep);
      if (rep.ok !== true) {
        r12b.check('OFFER-6 was built and proven', false, String(rep.error)).verbatim(rep.error);
        return;
      }
      const before = last ?? o2!;
      const coinBefore = before.poolCoins.S_A;
      const cellBefore = before.cells['AA_A/S_A'];
      r12b.tx(
        await transferInternalShielded(
          rig!.base.ctx,
          rig!.base.raw.secretA,
          AA_B.id,
          S_A.raw,
          STAGE_C.row12b.transfer,
          rig!.base.fee,
        ),
      );
      await rig!.base.waitForManagerNow(
        (m) => (m.shieldedBalances[shieldedKeyOf(AA_B.id, S_A!.raw)] ?? 0n) === STAGE_C.row12b.transfer,
        `AA_B's S_A cell to appear with ${STAGE_C.row12b.transfer}`,
      );
      const preTake = await obs({ users: true });
      const take = takeIt('row-12b', rep.envelopeFile, 'row12b-taker', STAGE_C.row12b.wants);
      const after = await obs({ users: true });
      last = after;

      r12b.observedBefore(preTake)
        .observedAfter(after)
        .artifact('takeReport', take)
        .verbatim(take.take?.nodeRefusal?.verbatim ?? take.take?.error)
        .note(
          `intervention: AA_A transferred ${STAGE_C.row12b.transfer} S_A to AA_B INSIDE the Manager. ` +
            `AA_A's cell ${cellBefore} -> ${preTake.cells['AA_A/S_A']}, AA_B's cell created at ` +
            `${preTake.cells['AA_B/S_A']}; custody is now ${preTake.mapSizes.pools} pool(s) / ` +
            `${preTake.mapSizes.shieldedCells} cells`,
        )
        .check(
          'the pooled coin is BYTE-IDENTICAL — no token operation happened',
          coinBefore?.nonce === preTake.poolCoins.S_A?.nonce &&
            coinBefore?.mtIndex === preTake.poolCoins.S_A?.mtIndex &&
            before.pools.S_A === preTake.pools.S_A,
          `${coinBefore?.nonce.slice(0, 16)}…/${coinBefore?.mtIndex} vs ` +
            `${preTake.poolCoins.S_A?.nonce.slice(0, 16)}…/${preTake.poolCoins.S_A?.mtIndex}`,
        )
        .check(
          'the offer was refused even though no coin moved',
          take.take?.ok === false,
          take.take?.ok ? `it SETTLED (${take.take?.settlement?.txId}) — a cell change does NOT cancel an offer` : `stage=${take.take?.stage}`,
        )
        .check(
          `the code is ${STAGE_C.row12b.expectedNodeCode} (Transcript) — the expectation, not an assertion`,
          take.take?.nodeRefusal?.code === STAGE_C.row12b.expectedNodeCode,
          `${take.take?.nodeRefusal?.code ?? 'none'} — ${take.take?.nodeRefusal?.decoded ?? '—'}`,
        )
        .note(
          take.take?.ok === false
            ? 'So FR-307(d) holds for BOTH forms the spec names, but by two different mechanisms — and only the ' +
                'withdraw is literally "moving the backing pool coin".'
            : 'MEASURED DEPARTURE: an internal transfer does NOT cancel an offer. That is a real property of the ' +
                'lane and it narrows FR-307(d) to spends that actually move the pooled coin.',
        );
      if (take.take?.ok === false) r12b.noStateCreated(preTake, after, ['AA_A/S_B', 'AA_B/S_B']);
    });
    if (r12b.rec.status === 'PENDING') r12b.measured([
      'the pooled coin is BYTE-IDENTICAL — no token operation happened',
      'the row completed without a harness failure',
    ]);

    // --- NC-306 — unbacked make (the guard ORDER) -----------------------------------------------
    const rNc306 = stage.row('nc-306', 'unbacked make: AA_A asks for more S_A than its cell holds, while the pool COULD cover it', {
      specAction:
        'NC-306: OwnerA attempts an offer giving more S_A than AA_A\'s cell holds (pool would cover it via other accounts)',
      specExpected: 'refused by the per-(account,colour) guard; no state',
      asRun:
        "run after row 12b, which is what gives AA_B a share of the pool — the spec's premise needs the pool to be " +
        'covered VIA ANOTHER ACCOUNT, and that is exactly what an internal transfer produces. The amount is taken ' +
        'from the live state so the premise holds whatever the earlier rows did',
    });
    await attempt(rNc306, async () => {
      if (!S_A || !S_B) throw new Error('the stage setup did not complete');
      const before = last ?? o2!;
      const poolA = BigInt(before.pools.S_A === 'absent' ? '0' : before.pools.S_A);
      const cellA = BigInt(before.cells['AA_A/S_A'] === 'absent' ? '0' : before.cells['AA_A/S_A']!);
      const gives = poolA; // the pool covers exactly this; AA_A's own cell does not
      const rep = runMaker(
        {
          label: 'NC-306',
          managerAddress: rig!.base.managerAddress,
          witness: 'ownerA',
          shape: 'named-taker',
          gives: { colour: S_A.hex, value: String(gives) },
          wants: { colour: S_B.hex, value: String(STAGE_C.nc306.wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          recipientSeedName: 'ownerT',
        },
        'nc306-maker',
      );
      const after = await obs({ users: true });
      last = after;
      rNc306.observedBefore(before)
        .observedAfter(after)
        .artifact('makerReport', rep)
        .verbatim(rep.error)
        .note(
          `premise: the pool holds ${poolA} S_A (enough), AA_A's own cell holds ${cellA} (not enough), and the ` +
            `request is for ${gives}. Planned amount was ${STAGE_C.nc306.gives}; the live value is used so the ` +
            'premise holds regardless of what the earlier rows did.',
        )
        .check('the premise holds: the pool WOULD cover the request', poolA >= gives, `pool ${poolA} >= ${gives}`)
        .check("the premise holds: AA_A's own cell would NOT", cellA < gives, `cell ${cellA} < ${gives}`)
        .check('the build was REFUSED', rep.ok === false, `ok=${rep.ok}`)
        .check(
          'refused by THE PER-(ACCOUNT, COLOUR) GUARD — the verbatim error names the account balance, not the pool',
          /account colour balance too low/.test(String(rep.error)),
          String(rep.error).slice(0, 200),
        )
        .check('nothing was published', rep.published === false, `published=${rep.published}`)
        .noStateCreated(before, after, ['AA_A/S_B', 'AA_B/S_B']);
    });
    rNc306.done();

    // --- P-F310 replication ---------------------------------------------------------------------
    const rF = stage.row('p-f310', 'P-F310 replication: a FULLY BACKED offer at two custody cells', {
      specAction: '(not a spec row) — deviation D-307\'s evidence, replicated on a second Manager',
      specExpected:
        'F-310 predicts that at two shielded cells the value leg lands in the FALLIBLE section and FR-302 refuses ' +
        'to publish. Here the configuration is 1 pool / 2 cells — F-310\'s own deciding row',
    });
    await attempt(rF, async () => {
      if (!S_A || !S_B) throw new Error('the stage setup did not complete');
      const before = last ?? o2!;
      const poolA = BigInt(before.pools.S_A === 'absent' ? '0' : before.pools.S_A);
      const cellA = BigInt(before.cells['AA_A/S_A'] === 'absent' ? '0' : before.cells['AA_A/S_A']!);
      const gives = cellA < poolA ? cellA : poolA; // fully backed, so ONLY placement can refuse it
      if (gives <= 0n) {
        rF.skip(`AA_A holds ${cellA} S_A and the pool ${poolA} — there is nothing fully backed left to offer`);
        return;
      }
      const armed = runMaker(
        {
          label: 'P-F310-armed',
          managerAddress: rig!.base.managerAddress,
          witness: 'ownerA',
          shape: 'named-taker',
          gives: { colour: S_A.hex, value: String(gives) },
          wants: { colour: S_B.hex, value: String(STAGE_C.pf310.wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          recipientSeedName: 'ownerT',
          envelopeOut: join(OFFERS_DIR, 'pf310-c-armed.offer'),
        },
        'pf310c-armed',
      );
      const measured = runMaker(
        {
          label: 'P-F310-measured',
          managerAddress: rig!.base.managerAddress,
          witness: 'ownerA',
          shape: 'named-taker',
          gives: { colour: S_A.hex, value: String(gives) },
          wants: { colour: S_B.hex, value: String(STAGE_C.pf310.wants) },
          creditAccount: hex(AA_A.id),
          makerAccount: hex(AA_A.id),
          recipientSeedName: 'ownerT',
          measureOnly: true,
        },
        'pf310c-measured',
      );
      const after = await obs({ users: true });
      last = after;

      rF.observedBefore(before)
        .observedAfter(after)
        .artifact('armed', armed)
        .artifact('measured', measured)
        .verbatim(armed.error)
        .note(
          `custody configuration at the time: ${before.mapSizes.pools} pool(s) / ${before.mapSizes.shieldedCells} ` +
            `shielded cells. The offer gives ${gives} S_A with AA_A's cell at ${cellA} and the pool at ${poolA} — ` +
            'fully backed, so no guard can refuse it and placement is the only thing left.',
        )
        .check(
          'the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated',
          armed.ok === false && armed.errorKind === 'fr302-placement-fail-closed',
          `ok=${armed.ok} kind=${armed.errorKind}`,
        )
        .check(
          'the measured placement shows the whole transcript went FALLIBLE (segment 0 empty)',
          measured.ok === true &&
            measured.placement?.ok === false &&
            JSON.stringify(measured.placement?.imbalances?.['0'] ?? {}) === '{}',
          `segment 0 = ${JSON.stringify(measured.placement?.imbalances?.['0'])}; fallible-offer segments ` +
            `${JSON.stringify(measured.placement?.fallibleOfferSegments)}`,
        )
        .check('nothing was published', armed.published === false && measured.published === false, '')
        .noStateCreated(before, after);
    });
    if (rF.rec.status === 'PENDING') rF.measured([
      'nothing was published',
      'NO state created: the whole custody snapshot is byte-identical',
      'the row completed without a harness failure',
    ]);

    // --- closing table --------------------------------------------------------------------------
    const rClose = stage.row('closing', 'Stage C closing state, both observation points', {
      specExpected: 'the negatives changed nothing they were not meant to; the invariant and conservation still hold',
    });
    await attempt(rClose, async () => {
      const o = await obs({ users: true, op2: true });
      rClose.observedAfter(o).op2Agrees(o).structural(o).note(
        `closing custody: pools ${JSON.stringify(o.pools)}, cells ${JSON.stringify(o.cells)}, sizes ` +
          `${JSON.stringify(o.mapSizes)}; wallets ${JSON.stringify(o.users)}`,
      );
    });
    rClose.done();

    stage.write();
    console.log(`\n## STAGE C VERDICT: ${stage.verdict}`);
    for (const r of stage.failedRows) console.log(`   FAILED ROW: ${r.id} — ${r.title}`);
    if (stage.verdict !== 'GREEN') process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nSTAGE C FATAL: ${err}`);
    if (stage) {
      stage.fatal = err;
      stage.write();
    }
    process.exitCode = 1;
  } finally {
    if (rig) await rig.close();
    log(`stage C finished; evidence in ${EVIDENCE_DIR}`);
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
