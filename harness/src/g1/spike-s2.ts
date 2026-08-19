// SPIKE S2 — is node `Custom error: 104` the SEGMENT-ORDER bug F-301 predicts?
// Plan 01 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1. Feeds organizer issue 0001.
//
// THE HYPOTHESIS (master plan F-301), and why it is worth an experiment rather than a guess:
//
//   1. `104` is DECODED. `midnight-node/ledger/src/versions/common/types.rs:406` maps
//      `InvalidError::Transcript` to 104. Issue 0001's "future investigation" step 1 asked for
//      exactly this decode and it is now done from the pinned source.
//   2. Each call in an SDK contract-scoped batch becomes its OWN transaction, built with
//      `Transaction.fromPartsRandomized` — `midnight-js-contracts/dist/index.mjs:1025` — which picks a
//      RANDOM physical segment id. The scope then merges them:
//      `mergeSubmitTxOptions` = `current.unprovenTx.merge(next.unprovenTx)` (`:1228`).
//   3. The ledger applies a transaction's intents in ASCENDING PHYSICAL SEGMENT ORDER:
//      `tx.intents.sorted_iter()` in `midnight-ledger/ledger/src/semantics.rs:1097`, and
//      `structure.rs:1826` documents Segment as the "logical segment index used in ... ledger
//      application order".
//
//   => if the SECOND call's random segment is LOWER than the first's, the ledger runs call 2 BEFORE
//      call 1, so call 2's recorded transcript is replayed against a state it never saw, and the
//      transcript check fails: `InvalidError::Transcript` = 104. Random segments make that a coin
//      flip, which is precisely the "first attempt refused, identical retry sometimes accepted"
//      signature issue 0001 records and could not explain.
//
// THE EXPERIMENT
//   N attempts of 00005's OWN M3 circuit pair — `depositShielded` + `depositUnshielded` into AA_B in
//   ONE `withContractScopedTransaction` — recording, per attempt, the physical segment each CALL
//   landed in (captured from inside the scope, so attribution is by construction and not inferred),
//   the resulting order, and accept/refuse with the verbatim node error.
//
//   CONFIRMED  every refusal is a descending pair and every ascending pair is accepted.
//   REFUTED    any counterexample. Reported either way; the correlation table is the evidence.
//
//   If CONFIRMED, the fix is then DEMONSTRATED, not merely proposed: re-key the merged (still
//   unproven, still unbound) transaction's intents to segments 1 and 2 IN CALL ORDER before it is
//   proved and submitted, and run the same N again.
//
// COST NOTE, recorded so the numbers are not over-read: all attempts use ONE issuer and one colour
// pair, so attempt 1 is a true double LAZY-INIT (both cells created) while later attempts credit
// colours the Manager has already seen. The data dependency between the two calls — call 2 reads the
// cell and pool call 1 wrote — holds for EVERY attempt either way, and that dependency is the whole
// mechanism under test. Each attempt's `lazyInit` flag is recorded so no row is misread.
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { submitCallTx, withContractScopedTransaction } from '@midnight-ntwrk/midnight-js-contracts';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { log, withDustRetry } from '../night.js';
import { errorChain, mintShieldedToUser, mintUnshieldedToUser } from '../g3/actions.js';
import { mapSizes, shieldedKeyOf, unshieldedKeyOf } from '../manager-view.js';
import { bootstrapSpikeRig, type SpikeRig } from './spike-rig.js';

const EVID = join(REPO_ROOT, 'evidence', 'g1-spikes');
const stamp = () => new Date().toISOString();
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const ATTEMPTS = Number(process.env.S2_ATTEMPTS ?? 12);

type Attempt = {
  attempt: number;
  variant: 'random-segments' | 'call-order-segments';
  lazyInit: boolean;
  call1Segment: number | null;
  call2Segment: number | null;
  order: 'ascending' | 'descending' | 'unknown';
  resegmented?: { from: number[]; to: number[] } | { failed: string };
  ok: boolean;
  txId?: string;
  error?: string;
  is104: boolean;
};

/** The intent segment ids currently on the scope's accumulated transaction. */
const segmentsOnScope = (txCtx: any): number[] => {
  try {
    const tx = txCtx?.submitTxOptions?.unprovenTx;
    return Array.from((tx?.intents?.keys?.() ?? []) as Iterable<number>).map(Number);
  } catch {
    return [];
  }
};

/**
 * Re-key a merged, UNPROVEN, UNBOUND transaction's intents so ascending segment order equals CALL
 * ORDER. `orderedOld` lists the old segment ids in call order.
 *
 * This is legal exactly here and nowhere later: the ledger-9 setter refuses a bound transaction and,
 * for an unproven pre-binding one, recomputes the binding randomness itself
 * (`ledger-wasm/src/tx.rs:1150-1180`). Any fallible offer keyed by an old segment is remapped with
 * its intent, or the transaction would balance against a segment that no longer exists.
 */
const resegmentInCallOrder = (tx: any, orderedOld: number[]): { from: number[]; to: number[] } => {
  const intents: Map<number, any> = tx.intents;
  if (!intents) throw new Error('transaction has no intents to re-key');
  const fallible: Map<number, any> | undefined = tx.fallibleOffer ?? undefined;

  const nextIntents = new Map<number, any>();
  const nextFallible = new Map<number, any>();
  orderedOld.forEach((old, i) => {
    const seg = i + 1;
    const intent = intents.get(old);
    if (!intent) throw new Error(`no intent at segment ${old}`);
    nextIntents.set(seg, intent);
    const offer = fallible?.get(old);
    if (offer) nextFallible.set(seg, offer);
  });
  // Anything the caller did not name (there should be nothing) is carried over untouched.
  for (const [seg, intent] of intents) if (!orderedOld.includes(seg)) nextIntents.set(seg, intent);

  tx.intents = nextIntents;
  if (fallible && fallible.size > 0) tx.fallibleOffer = nextFallible;
  return { from: orderedOld, to: orderedOld.map((_v, i) => i + 1) };
};

type RunOpts = {
  rig: SpikeRig;
  shieldedColour: Uint8Array;
  unshieldedColour: Uint8Array;
  account: Uint8Array;
  variant: Attempt['variant'];
  attempt: number;
  lazyInit: boolean;
  shieldedColourHex: string;
  unshieldedColourHex: string;
};

const oneAttempt = async (o: RunOpts): Promise<Attempt> => {
  const nonce = randomBytes(32);
  const spender = await o.rig.openSpender('OwnerN', SEEDS.ownerN, [
    { colour: o.shieldedColourHex, shielded: true, amount: 1n },
    { colour: o.unshieldedColourHex, shielded: false, amount: 1n },
  ]);
  const providers = spender.managerProviders;

  let call1Segment: number | null = null;
  let call2Segment: number | null = null;
  let resegmented: Attempt['resegmented'];

  const specs = [
    {
      circuitId: 'depositShielded',
      args: [{ nonce, color: o.shieldedColour, value: 1n }, o.account],
    },
    {
      circuitId: 'depositUnshielded',
      args: [o.unshieldedColour, 1n, o.account],
    },
  ];

  try {
    const finalized: any = await withDustRetry(spender.party, `S2/${o.variant}/attempt-${o.attempt}`, () =>
      (withContractScopedTransaction as any)(
        providers,
        async (txCtx: any) => {
          for (const spec of specs) {
            await (submitCallTx as any)(
              providers,
              {
                compiledContract: o.rig.ctx.compiledManager(),
                circuitId: spec.circuitId,
                contractAddress: o.rig.managerAddress,
                args: spec.args,
                privateStateId: 'manager',
              },
              txCtx,
            );
            const segs = segmentsOnScope(txCtx);
            if (call1Segment === null) {
              call1Segment = segs[0] ?? null;
            } else if (call2Segment === null) {
              const added = segs.filter((s) => s !== call1Segment);
              call2Segment = added.length === 1 ? added[0]! : (segs[segs.length - 1] ?? null);
            }
          }
          if (o.variant === 'call-order-segments' && call1Segment !== null && call2Segment !== null) {
            try {
              resegmented = resegmentInCallOrder(txCtx.submitTxOptions.unprovenTx, [call1Segment, call2Segment]);
            } catch (e) {
              resegmented = { failed: errorChain(e) };
              throw e;
            }
          }
        },
        { scopeName: `aa00006-s2-${o.variant}-${o.attempt}` },
      ),
    );
    return {
      attempt: o.attempt,
      variant: o.variant,
      lazyInit: o.lazyInit,
      call1Segment,
      call2Segment,
      order:
        call1Segment === null || call2Segment === null ? 'unknown' : call1Segment < call2Segment ? 'ascending' : 'descending',
      resegmented,
      ok: true,
      txId: String(finalized?.public?.txId ?? finalized?.public?.txHash ?? finalized),
      is104: false,
    };
  } catch (e) {
    const error = errorChain(e);
    return {
      attempt: o.attempt,
      variant: o.variant,
      lazyInit: o.lazyInit,
      call1Segment,
      call2Segment,
      order:
        call1Segment === null || call2Segment === null ? 'unknown' : call1Segment < call2Segment ? 'ascending' : 'descending',
      resegmented,
      ok: false,
      error,
      is104: /Custom error: 104\b/.test(error),
    };
  } finally {
    await spender.close();
  }
};

const summarise = (rows: Attempt[]) => {
  const asc = rows.filter((r) => r.order === 'ascending');
  const desc = rows.filter((r) => r.order === 'descending');
  return {
    attempts: rows.length,
    accepted: rows.filter((r) => r.ok).length,
    refused: rows.filter((r) => !r.ok).length,
    refusedWith104: rows.filter((r) => r.is104).length,
    ascending: { n: asc.length, accepted: asc.filter((r) => r.ok).length, refused: asc.filter((r) => !r.ok).length },
    descending: { n: desc.length, accepted: desc.filter((r) => r.ok).length, refused: desc.filter((r) => !r.ok).length },
    unknownOrder: rows.filter((r) => r.order === 'unknown').length,
  };
};

const main = async () => {
  mkdirSync(EVID, { recursive: true });
  console.log(`# SPIKE S2 — the 104 / segment-order hypothesis (F-301) — ${LANE_STAMP} — ${stamp()}`);
  console.log(`# attempts per variant: ${ATTEMPTS}`);

  const rig = await bootstrapSpikeRig({ withTaker: false });
  const random: Attempt[] = [];
  const fixed: Attempt[] = [];
  let verdict = 'INCONCLUSIVE';
  let note = '';

  try {
    const toke = await rig.deployMinter('Minter5', 'TOKE');
    const S = toke.shieldedRaw;
    const U = toke.unshieldedRaw;

    // One mint per family covers every attempt: N units each, both to OwnerN.
    const builderObserver = await rig.openObserver('OwnerN-premint', SEEDS.ownerN);
    let mintS: string;
    let mintU: string;
    try {
      const units = BigInt(ATTEMPTS * 2 + 4);
      mintS = await mintShieldedToUser(rig.ctx, 'Minter5', units, builderObserver, rig.fee);
      const addr = String((await (builderObserver.wallet as any).unshielded.getAddress()).hexString).toLowerCase();
      mintU = await mintUnshieldedToUser(rig.ctx, 'Minter5', units, addr, rig.fee);
      log(`minted ${units} S5 (${mintS}) and ${units} U5 (${mintU}) to OwnerN`);
    } finally {
      const { closeParty } = await import('../wallet.js');
      await closeParty(builderObserver);
    }

    const cellS = shieldedKeyOf(rig.raw.AA_B, S);
    const cellU = unshieldedKeyOf(rig.raw.AA_B, U);
    const before = await rig.readManagerNow();
    log(`custody maps before S2: ${JSON.stringify(mapSizes(before))}`);

    // --- variant 1: the SDK's own random segments ---------------------------------------------------
    console.log('\n## VARIANT 1 — the SDK as it ships: `fromPartsRandomized`, random segment ids');
    for (let i = 1; i <= ATTEMPTS; i++) {
      const snap = await rig.readManagerNow();
      const lazyInit = snap.shieldedBalances[cellS] === undefined && snap.unshieldedBalances[cellU] === undefined;
      const r = await oneAttempt({
        rig,
        shieldedColour: S,
        unshieldedColour: U,
        account: rig.raw.AA_B,
        variant: 'random-segments',
        attempt: i,
        lazyInit,
        shieldedColourHex: toke.shieldedColour,
        unshieldedColourHex: toke.unshieldedColour,
      });
      random.push(r);
      log(
        `  attempt ${i}: segments call1=${r.call1Segment} call2=${r.call2Segment} (${r.order}) -> ` +
          `${r.ok ? `ACCEPTED ${r.txId}` : `REFUSED${r.is104 ? ' (104)' : ''}`}${r.error ? ` — ${r.error}` : ''}`,
      );
    }
    const s1 = summarise(random);
    log(`  variant 1 summary: ${JSON.stringify(s1)}`);

    // CONFIRMED requires the correlation to be perfect in BOTH directions and to have seen both
    // orders at all — "all 12 were ascending and all 12 passed" proves nothing about descending.
    const sawBoth = s1.ascending.n > 0 && s1.descending.n > 0;
    const perfect = sawBoth && s1.ascending.refused === 0 && s1.descending.accepted === 0;
    const anyRefusalNot104 = random.some((r) => !r.ok && !r.is104);

    // --- variant 2: the fix, only if there is something to fix --------------------------------------
    if (perfect && !anyRefusalNot104) {
      console.log('\n## VARIANT 2 — the FIX: intents re-keyed to segments 1,2 IN CALL ORDER before proving');
      for (let i = 1; i <= ATTEMPTS; i++) {
        const snap = await rig.readManagerNow();
        const lazyInit = snap.shieldedBalances[cellS] === undefined && snap.unshieldedBalances[cellU] === undefined;
        const r = await oneAttempt({
          rig,
          shieldedColour: S,
          unshieldedColour: U,
          account: rig.raw.AA_B,
          variant: 'call-order-segments',
          attempt: i,
          lazyInit,
          shieldedColourHex: toke.shieldedColour,
          unshieldedColourHex: toke.unshieldedColour,
        });
        fixed.push(r);
        log(
          `  attempt ${i}: segments call1=${r.call1Segment} call2=${r.call2Segment} re-keyed ` +
            `${JSON.stringify(r.resegmented)} -> ${r.ok ? `ACCEPTED ${r.txId}` : `REFUSED${r.is104 ? ' (104)' : ''}`}` +
            `${r.error ? ` — ${r.error}` : ''}`,
        );
      }
    } else {
      console.log('\n## VARIANT 2 — SKIPPED: the correlation is not clean, so there is no confirmed mechanism to fix');
    }
    const s2 = fixed.length ? summarise(fixed) : null;

    const after = await rig.readManagerNow();
    const acceptedTotal = random.filter((r) => r.ok).length + fixed.filter((r) => r.ok).length;
    const expectedCell = BigInt(acceptedTotal);
    const cellSValue = after.shieldedBalances[cellS] ?? 0n;
    const cellUValue = after.unshieldedBalances[cellU] ?? 0n;
    const bookkeepingOk = cellSValue === expectedCell && cellUValue === expectedCell;

    if (!sawBoth) {
      verdict = 'INCONCLUSIVE';
      note =
        `only ${s1.ascending.n ? 'ascending' : 'descending'} segment pairs occurred in ${ATTEMPTS} attempts, ` +
        'so the correlation could not be tested in both directions — rerun with a larger N';
    } else if (anyRefusalNot104) {
      verdict = 'REFUTED';
      note = 'at least one refusal was NOT error 104, so 104 is not the only failure mode of this shape';
    } else if (!perfect) {
      verdict = 'REFUTED';
      note =
        `the correlation has counterexamples: ascending refused ${s1.ascending.refused}/${s1.ascending.n}, ` +
        `descending accepted ${s1.descending.accepted}/${s1.descending.n}`;
    } else if (s2 && s2.refused === 0) {
      verdict = 'CONFIRMED + FIX DEMONSTRATED';
      note =
        `every descending pair was refused with 104 (${s1.descending.refused}/${s1.descending.n}) and every ascending ` +
        `pair was accepted (${s1.ascending.accepted}/${s1.ascending.n}); re-keying the intents into call order made ` +
        `${s2.attempts}/${s2.attempts} attempts succeed`;
    } else if (s2) {
      verdict = 'CONFIRMED, FIX INCOMPLETE';
      note =
        `the correlation held in variant 1, but re-keying still left ${s2.refused}/${s2.attempts} refusals — ` +
        'the segment order is A cause, not the only one';
    } else {
      verdict = 'CONFIRMED (fix not attempted)';
      note = 'the correlation held; the fix variant did not run';
    }

    const payload = {
      spike: 'S2',
      label: LANE_STAMP,
      utc: stamp(),
      question: 'is node `Custom error: 104` the segment-order bug F-301 predicts?',
      decode: {
        '104': 'InvalidError::Transcript — midnight-node/ledger/src/versions/common/types.rs:406 (read from the pinned reference)',
        mechanismSources: [
          'midnight-js-contracts/dist/index.mjs:1025 — each scoped call is Transaction.fromPartsRandomized (RANDOM segment)',
          'midnight-js-contracts/dist/index.mjs:1228 — the scope merges them: current.unprovenTx.merge(next.unprovenTx)',
          'midnight-ledger/ledger/src/semantics.rs:1097 — the ledger applies intents via tx.intents.sorted_iter() (ASCENDING segment)',
          'midnight-ledger/ledger/src/structure.rs:1826 — "Segment: logical segment index used in ... ledger application order"',
        ],
      },
      shape: '00005 probe M3 circuit pair: depositShielded + depositUnshielded into AA_B in ONE withContractScopedTransaction',
      caveat:
        'one issuer / one colour pair for all attempts, so only the first attempt is a true double lazy-init; the ' +
        'call-to-call data dependency (call 2 reads the cell and pool call 1 wrote) holds for every attempt. Each ' +
        'row carries its own lazyInit flag.',
      managerAddress: rig.managerAddress,
      accounts: rig.ids,
      minter: { label: toke.label, tag: toke.tagText, address: toke.address, S5: toke.shieldedColour, U5: toke.unshieldedColour },
      mintTxs: { shielded: mintS, unshielded: mintU },
      attemptsPerVariant: ATTEMPTS,
      variant1RandomSegments: { rows: random, summary: s1 },
      variant2CallOrderSegments: fixed.length ? { rows: fixed, summary: s2 } : 'skipped',
      bookkeeping: {
        acceptedTotal,
        expectedCellValue: String(expectedCell),
        'AA_B S5 cell': String(cellSValue),
        'AA_B U5 cell': String(cellUValue),
        ok: bookkeepingOk,
        mapSizesBefore: mapSizes(before),
        mapSizesAfter: mapSizes(after),
      },
      verdict,
      note,
    };
    writeFileSync(join(EVID, 's2-segment-order.json'), `${JSON.stringify(payload, bigints, 2)}\n`);

    const md: string[] = [];
    md.push('# SPIKE S2 — node `Custom error: 104` and the segment-order hypothesis (F-301)');
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}** — ${note}`);
    md.push('');
    md.push('## The decode, first');
    md.push('');
    md.push('`104` = `InvalidError::Transcript`, from `midnight-node/ledger/src/versions/common/types.rs:406` in the');
    md.push('pinned read-only reference. Issue 0001 listed decoding 104 as step 1 of any future investigation; that');
    md.push('step is now closed from source rather than from guesswork.');
    md.push('');
    md.push('## The predicted mechanism, from source');
    md.push('');
    md.push('| Step | Source |');
    md.push('|---|---|');
    md.push('| each scoped call becomes its own transaction with a RANDOM physical segment | `midnight-js-contracts/dist/index.mjs:1025` (`Transaction.fromPartsRandomized`) |');
    md.push('| the scope merges those transactions | `midnight-js-contracts/dist/index.mjs:1228` (`current.unprovenTx.merge(next.unprovenTx)`) |');
    md.push('| the ledger applies intents in ASCENDING segment order | `midnight-ledger/ledger/src/semantics.rs:1097` (`tx.intents.sorted_iter()`) |');
    md.push('| Segment is documented as the ledger APPLICATION ORDER index | `midnight-ledger/ledger/src/structure.rs:1826` |');
    md.push('');
    md.push('So a merged pair executes in SEGMENT order, not CALL order, and call 2\'s transcript is replayed against');
    md.push('a state it never saw whenever the random draw comes out descending.');
    md.push('');
    md.push(`## Variant 1 — the SDK as it ships (${ATTEMPTS} attempts)`);
    md.push('');
    md.push('| # | lazy-init | call 1 segment | call 2 segment | order | outcome | 104 | verbatim |');
    md.push('|---|---|---|---|---|---|---|---|');
    for (const r of random) {
      md.push(
        `| ${r.attempt} | ${r.lazyInit} | ${r.call1Segment ?? '—'} | ${r.call2Segment ?? '—'} | ${r.order} | ` +
          `${r.ok ? `ACCEPTED \`${r.txId}\`` : 'REFUSED'} | ${r.is104 ? 'yes' : '—'} | ${r.error ? `\`${r.error}\`` : '—'} |`,
      );
    }
    md.push('');
    md.push(`Summary: \`${JSON.stringify(s1)}\``);
    md.push('');
    if (fixed.length) {
      md.push(`## Variant 2 — the FIX: intents re-keyed to 1,2 in CALL order (${ATTEMPTS} attempts)`);
      md.push('');
      md.push('The merged transaction is still unproven and unbound at that moment, which is the only point where');
      md.push('`Transaction.intents` may be written: the ledger-9 setter refuses a bound transaction and recomputes the');
      md.push('binding randomness itself (`midnight-ledger/ledger-wasm/src/tx.rs:1150-1180`).');
      md.push('');
      md.push('| # | call 1 segment | call 2 segment | re-keyed to | outcome | verbatim |');
      md.push('|---|---|---|---|---|---|');
      for (const r of fixed) {
        md.push(
          `| ${r.attempt} | ${r.call1Segment ?? '—'} | ${r.call2Segment ?? '—'} | ${JSON.stringify(r.resegmented ?? null)} | ` +
            `${r.ok ? `ACCEPTED \`${r.txId}\`` : 'REFUSED'} | ${r.error ? `\`${r.error}\`` : '—'} |`,
        );
      }
      md.push('');
      md.push(`Summary: \`${JSON.stringify(s2)}\``);
      md.push('');
    } else {
      md.push('## Variant 2 — not run');
      md.push('');
      md.push('The variant-1 correlation was not clean, so there was no confirmed mechanism to fix.');
      md.push('');
    }
    md.push('## Bookkeeping — refusals created nothing');
    md.push('');
    md.push(`Accepted attempts: ${acceptedTotal}. Each accepted attempt credits AA_B with 1 S5 and 1 U5, so both cells`);
    md.push(`must read exactly ${expectedCell}. Observed: S5 cell \`${cellSValue}\`, U5 cell \`${cellUValue}\` —`);
    md.push(`**${bookkeepingOk ? 'MATCHES' : 'DOES NOT MATCH'}**. Custody map sizes ${JSON.stringify(mapSizes(before))} →`);
    md.push(`${JSON.stringify(mapSizes(after))}.`);
    md.push('');
    md.push('A refusal that had partially landed would break this equality, so it doubles as the state-neutrality');
    md.push('proof for every refused attempt in both variants.');
    md.push('');
    writeFileSync(join(EVID, 'S2.md'), `${md.join('\n')}\n`);

    console.log(`\n## S2 VERDICT: ${verdict} — ${note}`);
    if (!bookkeepingOk) {
      console.error('S2 FAILED: a refused attempt appears to have changed custody state');
      process.exitCode = 1;
    }
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS2 FAILED: ${err}`);
    writeFileSync(
      join(EVID, 's2-segment-order.json'),
      `${JSON.stringify({ spike: 'S2', label: LANE_STAMP, utc: stamp(), verdict: 'RED', fatal: err, random, fixed }, bigints, 2)}\n`,
    );
    writeFileSync(
      join(EVID, 'S2.md'),
      `# SPIKE S2 — node \`Custom error: 104\` and the segment-order hypothesis (F-301)\n\n\`${LANE_STAMP}\` · recorded ${stamp()}\n\n**VERDICT: RED (fatal)**\n\nVerbatim:\n\n\`\`\`\n${err}\n\`\`\`\n`,
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
