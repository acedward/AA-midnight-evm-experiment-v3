// G5 END-TO-END — the owner's two use cases, settled LIVE, on a chosen variant at a chosen custody size.
// 00006 Plan 05 Phase 2 (the U1 probe) and Phase 3 (the winner). EXPERIMENTAL_LANE / LANE-DEV-1.
//
// ================================================================================================
// THE OWNER'S TOP GOAL, DECOMPOSED — and the one experimental design decision that matters
// ================================================================================================
//
// Owner, 2026-08-20, verbatim: "The top goal is to be able to create valid, unbalanced, zswaps from the
// coins the user has in the contract; That can be merged by the user and sent to the node; or published
// on internet for example as a file to later be merged by another user and sent."
//
//   U1  SELF-MERGE     the maker builds the offer, holds it, then balances it with its OWN wallet and
//                      submits. Nothing is published.
//   U2  PUBLISHED FILE the offer is serialized (D-306 unbound), written to a file, read back IN
//                      ANOTHER PROCESS, and a FOREIGN wallet balances and submits it.
//
// THE DESIGN DECISION: U1 and U2 use the SAME OFFER SHAPE — floating surplus — and differ in nothing
// but WHO SETTLES. That is deliberate. If U1 used the named shape and U2 the surplus shape, a
// difference in outcome could be attributed to either the settler or the shape, and the whole point of
// running both is to isolate the settler.
//
// WHY U1 MIGHT WORK WHERE U2 CANNOT, which is the hypothesis this file exists to test. F-310 says an
// offer whose legs land in the FALLIBLE section is unsettleable by an INDEPENDENT taker, because
// balancing is per (token, segment) and a foreign wallet can only reach segment 0. A maker balancing its
// OWN offer is not obviously under that constraint. If U1 works past the boundary, the owner's first use
// case needs no contract change at all — which is a result worth having whichever way it goes.
//
// U1 THEREFORE DELIBERATELY BYPASSES THE FR-302 PUBLICATION GATE, and that is recorded in the evidence
// rather than buried: `takeOffer`'s third gate refuses any offer carrying a delta outside segment 0,
// which is correct for anything PUBLISHED (publishing a fallible offer would be publishing a lie) but
// would make the U1 question unanswerable. So U1 calls the stock facade pipeline
// (`settleAsTaker` = validate -> balanceUnbound -> signRecipe -> finalizeRecipe -> submit) directly, and
// every U1 record carries `fr302GateBypassed: true` plus the placement that was bypassed. U2 always
// goes through the full four-gate published path, with no bypass anywhere.
//
// A CONTROL RUNS ALONGSIDE. U1 is measured at the requested custody size AND at one cell, where
// placement is known-guaranteed. Without the control, a U1 failure at two cells could be the
// self-merge mechanism rather than the placement — and those are completely different findings.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { log } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { settleAsTaker } from '../g1/taker.js';
import { takeOffer, type TakeResult } from '../offer/take.js';
import { writeEnvelope } from '../offer/envelope.js';
import { classifyRefusal } from '../g2/swap-rig.js';
import { actAs, bootstrapG5Rig, shieldedKeysOf, type Account, type Colour, type G5Rig } from './rig.js';
import { buildG5Offer, offerCircuitOf, type G5Offer } from './offer.js';
import { variantById, type VariantSpec } from './variants.js';
import { assertMergedBalanced } from '../offer/take.js';
import { execFileSync } from 'node:child_process';

const EVID = join(REPO_ROOT, 'evidence', 'g5-mitigation');
const OFFERS = join(EVID, 'offers');
const stamp = () => new Date().toISOString();
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const G_PER_CELL = 8n;
const GIVE = 2n;
const WANT = 3n;
const MINT_B = 12n;

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/**
 * A cell reading as a number. `rig.read` reports a zero-or-missing cell as `absent-or-zero` because
 * "the cell reads zero" and "the cell does not exist" are different claims and the no-state-created
 * proofs depend on the difference — but an arithmetic check on a DELTA does not care which it was.
 */
const cellNum = (v: string | undefined): bigint => (v === undefined || v === 'absent-or-zero' ? 0n : BigInt(v));

export type CaseResult = {
  useCase: 'U1' | 'U2';
  label: string;
  variant: string;
  cells: number;
  pools: number;
  placement: 'GUARANTEED' | 'FALLIBLE';
  /** U1 only, and always recorded: the publication gate was skipped on purpose. */
  fr302GateBypassed?: boolean;
  offer?: {
    circuitId: string;
    shape: string;
    bytes: number;
    contentAddress: string;
    imbalancesAtSegment0: Record<string, string>;
    fallibleOfferSegments: number[];
    proveMs: number;
    makerAttachedDust: boolean;
  };
  /** U2 only: proof the artifact crossed a real process boundary (FR-306). */
  readerProcess?: Record<string, unknown>;
  settled: boolean;
  txId?: string;
  refusingLayer?: string;
  error?: string;
  /** Arm (e) only: the self-balanced transactions around the offer. */
  stageTxId?: string;
  consolidateTxId?: string;
  before?: unknown;
  after?: unknown;
  settlerBefore?: Record<string, string>;
  settlerAfter?: Record<string, string>;
  /** OP2 — the same cells read through a proved on-chain circuit call (FR-208's second point). */
  onChainCells?: Record<string, string>;
  /** How many times an OP2 read had to be retried past a `Custom error: 104` (F-301's flake). */
  op2Retries?: Record<string, number>;
  makerDustActions?: unknown;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
};

/** Publish an offer as a file and READ IT BACK IN ANOTHER PROCESS with no network (FR-306). */
const publishAndReread = (offer: G5Offer, name: string): { file: string; reader: Record<string, unknown> } => {
  mkdirSync(OFFERS, { recursive: true });
  const file = join(OFFERS, `${name}-${offer.terms.contentAddress.slice(0, 16)}.offer`);
  writeEnvelope(file, offer.terms, offer.bytes);
  const out = execFileSync('npx', ['tsx', 'src/offer/reader.ts', file], {
    cwd: join(REPO_ROOT, 'harness'),
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = out.trim().split('\n').filter(Boolean).pop() ?? '{}';
  return { file, reader: JSON.parse(line) as Record<string, unknown> };
};

type CaseSpec = {
  rig: G5Rig;
  v: VariantSpec;
  useCase: 'U1' | 'U2';
  label: string;
  G: Colour;
  B: Colour;
  maker: Account;
  accts: Account[];
  /** Whose wallet settles. U1 = the maker's own (OwnerA); U2 = OwnerT, whose keys the maker never knew. */
  settlerSeed: string;
  settlerName: string;
};

const runCase = async (spec: CaseSpec): Promise<CaseResult> => {
  const { rig, v, G, B, maker, accts } = spec;
  const colours = [G, B];
  const before = await rig.read(colours, accts);
  const settlerBefore = {
    G: String(await rig.observeShielded(spec.settlerName, spec.settlerSeed, G.hex)),
    B: String(await rig.observeShielded(spec.settlerName, spec.settlerSeed, B.hex)),
  };
  const res: CaseResult = {
    useCase: spec.useCase,
    label: spec.label,
    variant: v.id,
    cells: before.size.cells,
    pools: before.size.pools,
    placement: 'FALLIBLE',
    settled: false,
    before,
    settlerBefore,
    checks: [],
  };

  try {
    // --- arm (e) phase 1: stage. Self-balanced, submitted by the maker alone. -------------------
    //
    // Reuse an already-staged coin rather than failing: relaxation R5'' means there is no way to clear
    // the escrow except by settling, so if a PREVIOUS case did not settle its offer the coin is still
    // sitting there. Re-staging would be refused with "an offer is already staged", which would make
    // this case report a staging failure when the real result is the earlier refusal.
    const giveValue = GIVE;
    if (v.offer === 'staged') {
      if (before.escrow?.active === 'true') {
        log(`  arm (e): escrow already staged from an earlier case (R5'': no cancelStage) — reusing it`);
      } else {
        res.stageTxId = await rig.submitAs(
          `OwnerA-stage-${spec.label}`,
          SEEDS.ownerA,
          maker.secret,
          'stageOffer',
          [G.raw, GIVE],
        );
        await rig.waitFor(colours, accts, (x) => x.escrow?.active === 'true', 'the escrow to be staged');
      }
    }

    // --- build + prove the offer. The maker's last act. -----------------------------------------
    await actAs(rig.makerProviders, maker.secret);
    const offer = await buildG5Offer({
      variant: v,
      providers: rig.makerProviders,
      compiled: rig.compiled(),
      contractAddress: rig.contractAddress,
      shape: 'floating-surplus',
      gives: { colourRaw: G.raw, value: giveValue },
      wants: { colourRaw: B.raw, value: WANT },
      creditAccount: maker.id,
      makerAccount: maker.id,
      // U1's whole question is whether a FALLIBLE offer settles for its own maker, so placement must
      // be READ rather than fail closed. U2 keeps the gate: an offer that would be published and is
      // not guaranteed is refused below, before any file is written.
      measureOnly: true,
    });
    res.placement = offer.placement.ok ? 'GUARANTEED' : 'FALLIBLE';
    res.offer = {
      circuitId: offer.circuitId,
      shape: offer.terms.shape,
      bytes: offer.bytes.length,
      contentAddress: offer.terms.contentAddress,
      imbalancesAtSegment0: offer.placement.imbalances['0'] ?? {},
      fallibleOfferSegments: offer.placement.fallibleOfferSegments,
      proveMs: offer.proveMs,
      makerAttachedDust: offer.terms.makerAttachedDust,
    };

    // --- settle -------------------------------------------------------------------------------
    let take: TakeResult | undefined;
    let mergedReport: unknown;
    let txId: string | undefined;

    if (spec.useCase === 'U2') {
      // FAIL CLOSED before publishing. An offer whose legs are not all at segment 0 is unsettleable
      // by any independent taker, so publishing it would be publishing something no one can take.
      if (!offer.placement.ok) {
        res.error =
          'REFUSED BEFORE PUBLICATION: the offer is not placed in the guaranteed section, so no ' +
          'independent taker could settle it (FR-302, fail-closed). Verbatim placement: ' +
          JSON.stringify(offer.placement.imbalances);
        res.refusingLayer = 'harness gate (offline, before any network contact)';
        res.checks.push({
          name: 'a non-guaranteed offer is REFUSED before it is published',
          ok: true,
          detail: `fallible segments ${JSON.stringify(offer.placement.fallibleOfferSegments)}`,
        });
        return res;
      }
      const published = publishAndReread(offer, `${v.id}-u2`);
      res.readerProcess = published.reader;
      const spender = await rig.openSpender(spec.settlerName, spec.settlerSeed, [{ colour: B.hex, amount: WANT }]);
      try {
        take = await takeOffer(spender.party, published.file, { label: `${v.id}-U2` });
      } finally {
        await spender.close();
      }
      res.settled = take.ok;
      txId = take.settlement?.txId;
      mergedReport = take.merged;
      if (!take.ok) {
        res.error = take.error;
        res.refusingLayer = classifyRefusal(take.stage, take.error, take.nodeRefusal);
      }
    } else {
      // U1: the MAKER's own wallet balances and submits, with the stock facade pipeline and NO
      // publication gate. Recorded as a bypass, with the placement it bypassed.
      res.fr302GateBypassed = true;
      const spender = await rig.openSpender(spec.settlerName, spec.settlerSeed, [{ colour: B.hex, amount: WANT }]);
      try {
        const settlement = await settleAsTaker(spender.party, offer.proven, 'unbound', {
          label: `${v.id}-U1`,
          preSubmit: (finalized) => {
            // Still fail closed on a merged transaction that does not balance — that is a harness
            // bug guard, not a publication rule, and it must stay on for U1 too.
            mergedReport = assertMergedBalanced(finalized);
            return mergedReport;
          },
        });
        res.settled = settlement.ok;
        txId = settlement.txId;
        if (!settlement.ok) {
          res.error = settlement.error;
          res.refusingLayer = classifyRefusal('settlement', settlement.error, settlement.nodeRefusal);
        }
      } finally {
        await spender.close();
      }
    }
    res.txId = txId;
    res.makerDustActions = (mergedReport as any)?.dustActions ?? {};

    // --- arm (e) phase 3: consolidate. Self-balanced, and only meaningful if the offer settled. --
    if (res.settled && v.offer === 'staged') {
      await rig.waitFor(colours, accts, (x) => x.escrow?.receivedActive === 'true', 'the received coin to land');
      res.consolidateTxId = await rig.submitAs(
        `OwnerA-consolidate-${spec.label}`,
        SEEDS.ownerA,
        maker.secret,
        'consolidate',
        [],
      );
      await rig.waitFor(colours, accts, (x) => x.escrow?.receivedActive === 'false', 'consolidation to complete');
    }

    // --- observe and assert -------------------------------------------------------------------
    const expectedHeldG = BigInt(before.held.G!) - giveValue;
    const expectedHeldB = BigInt(before.held.B!) + (res.settled ? WANT : 0n);
    if (res.settled) {
      await rig.waitFor(
        colours,
        accts,
        (x) => BigInt(x.held.G!) === expectedHeldG && BigInt(x.held.B!) === expectedHeldB,
        `custody to reach G=${expectedHeldG} B=${expectedHeldB}`,
      );
    }
    const after = await rig.read(colours, accts);
    res.after = after;

    // --- OP2: the same two cells read again through a PROVED ON-CHAIN CIRCUIT CALL --------------
    //
    // Plan 05 requires every live settle to keep the G3 discipline, and that discipline is TWO
    // INDEPENDENT OBSERVATION POINTS (FR-208). OP1 above fetched the contract's ledger state from the
    // indexer and decoded it with the generated reader; this submits a transaction and takes the answer
    // back through the SDK — a different mechanism end to end, which is the only reason the second
    // point is worth anything. A decoder bug would be invisible to OP1 alone.
    //
    // Read only AFTER the settle, and only for the two cells this case makes claims about. OP2 is a
    // real transaction (~15 s each, and exposed to the F-301 flake), so reading cells nobody is
    // asserting would spend a shared host's time to corroborate nothing.
    const op2: Record<string, string> = {};
    const op2Retries: Record<string, number> = {};
    if (res.settled) {
      for (const c of colours) {
        const label = `${maker.label}/${c.label}`;
        const r = await rig.onChainCell(maker.id, c.raw, label);
        op2[label] = r.value;
        if (r.retries > 0) op2Retries[label] = r.retries;
      }
      res.onChainCells = op2;
      if (Object.keys(op2Retries).length) res.op2Retries = op2Retries;
    }
    // Absence reads 0 on chain, which is not a disagreement; an UNAVAILABLE read is a GAP and is
    // reported as one rather than allowed to masquerade as agreement.
    const op2Problems: string[] = [];
    for (const [k, v] of Object.entries(op2)) {
      if (v === 'unavailable') {
        op2Problems.push(`${k}: OP2 UNAVAILABLE (refused with 104 on every attempt) — OP1 says ${after.cells[k]}, unconfirmed`);
        continue;
      }
      const expected = String(cellNum(after.cells[k]));
      if (v !== expected) op2Problems.push(`${k}: OP1 says ${after.cells[k]}, OP2 (on-chain call) says ${v}`);
    }
    const settlerAfter = {
      G: String(await rig.observeShielded(spec.settlerName, spec.settlerSeed, G.hex)),
      B: String(await rig.observeShielded(spec.settlerName, spec.settlerSeed, B.hex)),
    };
    res.settlerAfter = settlerAfter;

    res.checks.push(
      { name: 'the offer was BUILT and PROVEN', ok: true, detail: `${offer.bytes.length} B in ${offer.proveMs} ms` },
      {
        name: 'FR-301: the maker attached no DUST to its own artifact',
        ok: offer.terms.makerAttachedDust === false,
        detail: `makerAttachedDust=${offer.terms.makerAttachedDust}`,
      },
      { name: 'the settlement landed under ONE transaction id', ok: res.settled, detail: txId ?? res.error ?? '' },
      {
        name: `custody gave ${giveValue} of G`,
        ok: res.settled && BigInt(after.held.G!) === expectedHeldG,
        detail: `held(G) ${before.held.G} -> ${after.held.G} (expected ${expectedHeldG})`,
      },
      {
        name: `custody gained ${WANT} of B`,
        ok: res.settled && BigInt(after.held.B!) === expectedHeldB,
        detail: `held(B) ${before.held.B} -> ${after.held.B} (expected ${expectedHeldB})`,
      },
      {
        // RELATIVE, not absolute. Several cases run against ONE Manager in sequence — the 1-cell U1
        // control, then U1 at the target size, then U2 — and each settlement credits the maker another
        // WANT of B. An absolute `== WANT` check passes only for the first case and then reports a
        // spurious failure for every later one, which is exactly the kind of self-contradicting
        // evidence this rig must not produce.
        name: "the maker's own cell was debited G and credited B",
        ok:
          res.settled &&
          BigInt(cellNum(after.cells[`${maker.label}/B`])) === BigInt(cellNum(before.cells[`${maker.label}/B`])) + WANT &&
          BigInt(cellNum(after.cells[`${maker.label}/G`])) === BigInt(cellNum(before.cells[`${maker.label}/G`])) - giveValue,
        detail: `${maker.label}/G ${before.cells[`${maker.label}/G`]} -> ${after.cells[`${maker.label}/G`]}; ` +
          `${maker.label}/B ${before.cells[`${maker.label}/B`]} -> ${after.cells[`${maker.label}/B`]} ` +
          `(expected +${WANT} B, -${giveValue} G)`,
      },
      {
        name: `the SETTLER swept the ${giveValue} G surplus and funded the ${WANT} B deficit`,
        ok:
          res.settled &&
          BigInt(settlerAfter.G) === BigInt(settlerBefore.G) + giveValue &&
          BigInt(settlerAfter.B) === BigInt(settlerBefore.B) - WANT,
        detail: `${spec.settlerName} G ${settlerBefore.G} -> ${settlerAfter.G}, B ${settlerBefore.B} -> ${settlerAfter.B}`,
      },
      {
        name: 'OP1 and OP2 agree on every cell this case claims (FR-208, two observation points)',
        ok: res.settled && op2Problems.length === 0,
        detail: op2Problems.length
          ? op2Problems.join('; ')
          : res.settled
            ? `OP1 == OP2 for ${Object.keys(op2).join(', ')}${Object.keys(op2Retries).length ? ` (retries: ${JSON.stringify(op2Retries)})` : ''}`
            : 'not settled — OP2 not consulted',
      },
      {
        name: 'the MAKER attached no dust action to the SETTLED transaction',
        ok:
          res.settled &&
          offer.placement.intentSegments.every(
            (s) => ((mergedReport as any)?.dustActions?.[String(s)]?.spends ?? 0) === 0,
          ),
        detail: `maker intent segment(s) ${JSON.stringify(offer.placement.intentSegments)}; settled dust actions ${JSON.stringify(
          (mergedReport as any)?.dustActions ?? {},
        )}`,
      },
    );
    if (spec.useCase === 'U2') {
      res.checks.push({
        name: 'FR-306: the envelope crossed a REAL process boundary byte-identically',
        ok: Boolean(
          (res.readerProcess as any)?.envelopeVerified &&
            (res.readerProcess as any)?.roundTripByteIdentical &&
            (res.readerProcess as any)?.contentAddressMatches,
        ),
        detail: `reader pid ${(res.readerProcess as any)?.process?.pid}, ${(res.readerProcess as any)?.payloadBytes} bytes`,
      });
      res.checks.push({
        name: 'THE OPEN CLAIM: the settler is a wallet whose keys the maker never knew',
        ok: spec.settlerSeed === SEEDS.ownerT,
        detail: `settler seed is OwnerT, disjoint from every maker key`,
      });
    }
    if (v.offer === 'staged') {
      res.checks.push({
        name: "arm (e): the SELF-BALANCED phases landed on their own (F-310 does not constrain them)",
        ok: Boolean(res.stageTxId) && (!res.settled || Boolean(res.consolidateTxId)),
        detail: `stage ${res.stageTxId ?? '(none)'} / consolidate ${res.consolidateTxId ?? '(not reached)'}`,
      });
    }
  } catch (e) {
    res.error = errorChain(e);
    res.refusingLayer = classifyRefusal('settlement', res.error);
    res.checks.push({ name: 'the case ran to completion', ok: false, detail: res.error.slice(0, 300) });
  }

  return res;
};

const main = async () => {
  const variantId = arg('--variant') ?? 'manager';
  const cells = Number(arg('--cells') ?? '2');
  const cases = (arg('--cases') ?? 'u1').split(',').map((s) => s.trim().toLowerCase());
  const outName = arg('--out') ?? `e2e-${variantId}-${cells}c`;
  const v = variantById(variantId);

  console.log(`# G5 END-TO-END — ${LANE_STAMP} — ${stamp()}`);
  console.log(`# variant ${v.id} (${v.arm}) — ${v.title}`);
  console.log(`# custody target: ${cells} cell(s); cases: ${cases.join(', ')}; offer circuit ${offerCircuitOf(v)}`);

  let rig: G5Rig | undefined;
  const results: CaseResult[] = [];
  let fatal: string | undefined;

  try {
    rig = await bootstrapG5Rig(v);
    const G = await rig.addColour('G', 'TOKG');
    const B = await rig.addColour('B', 'TOKB');
    // Enough G for every deposit plus the top-ups between cases; B to BOTH settlers, since U1's
    // settler is the maker's own wallet and U2's is the independent taker.
    await rig.mintTo(G, G_PER_CELL * BigInt(cells + 4), SEEDS.ownerN);
    await rig.mintTo(B, MINT_B, SEEDS.ownerA);
    await rig.mintTo(B, MINT_B, SEEDS.ownerT);

    const accts: Account[] = [await rig.addAccount('AA_A', SEEDS.ownerA)];
    for (let i = 1; i < Math.max(cells, 1); i++) {
      accts.push(
        await rig.addAccount(`AA_${i}`, `${SEEDS.ownerB.slice(0, 62)}${(0x10 + i).toString(16).padStart(2, '0')}`),
      );
    }
    const maker = accts[0]!;

    /** Grow custody to at least `n` cells of colour G. */
    const growTo = async (n: number) => {
      for (let i = 0; i < n; i++) {
        const view = await rig!.read([G, B], accts);
        if (view.size.cells >= n) break;
        await rig!.depositManyFrom(SEEDS.ownerN, 'OwnerN', G, G_PER_CELL, accts[i]!.id);
        await rig!.waitFor([G, B], accts, (x) => x.size.cells >= i + 1, `custody to reach ${i + 1} cell(s)`);
      }
    };

    // --- the CONTROL: U1 at ONE cell, where placement is known-guaranteed --------------------
    //
    // Without it, a U1 failure at the target size could be the self-merge mechanism rather than the
    // placement, and those are entirely different findings.
    if (cases.includes('u1')) {
      await growTo(1);
      results.push(
        await runCase({
          rig,
          v,
          useCase: 'U1',
          label: 'u1-control-1cell',
          G,
          B,
          maker,
          accts,
          settlerSeed: SEEDS.ownerA,
          settlerName: 'OwnerA-self',
        }),
      );
    }

    // --- U1 at the requested custody size ----------------------------------------------------
    if (cases.includes('u1') && cells > 1) {
      await growTo(cells);
      results.push(
        await runCase({
          rig,
          v,
          useCase: 'U1',
          label: `u1-${cells}cell`,
          G,
          B,
          maker,
          accts,
          settlerSeed: SEEDS.ownerA,
          settlerName: 'OwnerA-self',
        }),
      );
    }

    // --- U2 at the requested custody size, through the published file -------------------------
    if (cases.includes('u2')) {
      await growTo(cells);
      results.push(
        await runCase({
          rig,
          v,
          useCase: 'U2',
          label: `u2-${cells}cell`,
          G,
          B,
          maker,
          accts,
          settlerSeed: SEEDS.ownerT,
          settlerName: 'OwnerT',
        }),
      );
    }
  } catch (e) {
    fatal = errorChain(e);
    console.error(`\nFATAL: ${fatal}`);
  } finally {
    if (rig) await rig.close();
  }

  // --- evidence ------------------------------------------------------------------------------
  const table = (header: string[], rows: string[][]): string[] => [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
  const md: string[] = [];
  md.push(`# G5 end-to-end — \`${v.id}\` at ${cells} custody cell(s)`);
  md.push('');
  md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
  md.push('');
  md.push('U1 (self-merge) and U2 (published file) use the SAME offer shape — floating surplus — and');
  md.push('differ in nothing but WHO SETTLES, so a difference in outcome is attributable to the settler.');
  md.push('');
  md.push(
    ...table(
      ['case', 'cells', 'placement', 'settled', 'tx id / refusal', 'FR-302 gate', 'checks passed'],
      results.map((r) => [
        `${r.useCase} \`${r.label}\``,
        String(r.cells),
        r.placement === 'GUARANTEED' ? 'GUARANTEED' : '**FALLIBLE**',
        r.settled ? 'YES' : '**no**',
        r.txId ? `\`${r.txId}\`` : `${r.refusingLayer ?? ''} — ${String(r.error ?? '').slice(0, 90)}`,
        r.fr302GateBypassed ? 'BYPASSED on purpose (U1)' : 'enforced',
        `${r.checks.filter((c) => c.ok).length}/${r.checks.length}`,
      ]),
    ),
  );
  md.push('');
  for (const r of results) {
    md.push(`## ${r.useCase} — \`${r.label}\` (${r.cells} cell(s), ${r.pools} pool(s))`);
    md.push('');
    if (r.fr302GateBypassed) {
      md.push('**The FR-302 publication gate was DELIBERATELY BYPASSED for this case.** U1 asks whether a');
      md.push('maker can settle its OWN offer past the F-310 boundary, and the gate — correctly — refuses');
      md.push('to publish anything not placed at segment 0, which would make the question unanswerable.');
      md.push(`Placement that was bypassed: **${r.placement}**, fallible segments`);
      md.push(`\`${JSON.stringify(r.offer?.fallibleOfferSegments ?? [])}\`.`);
      md.push('');
    }
    if (r.offer) {
      md.push(
        ...table(
          ['field', 'value'],
          [
            ['offer circuit', `\`${r.offer.circuitId}\``],
            ['shape', `\`${r.offer.shape}\``],
            ['imbalances(0)', `\`${JSON.stringify(r.offer.imbalancesAtSegment0)}\``],
            ['fallible-offer segments', `\`${JSON.stringify(r.offer.fallibleOfferSegments)}\``],
            ['bytes / sha256', `${r.offer.bytes} / \`${r.offer.contentAddress.slice(0, 24)}…\``],
            ['prove ms', String(r.offer.proveMs)],
            ['maker attached DUST', String(r.offer.makerAttachedDust)],
            ['stage tx (arm e)', r.stageTxId ? `\`${r.stageTxId}\`` : '—'],
            ['consolidate tx (arm e)', r.consolidateTxId ? `\`${r.consolidateTxId}\`` : '—'],
          ],
        ),
      );
      md.push('');
    }
    md.push(...table(['#', 'check', 'result', 'detail'], r.checks.map((c, i) => [String(i + 1), c.name, c.ok ? 'PASS' : '**FAIL**', c.detail || '—'])));
    md.push('');
    if (r.error) {
      md.push('Verbatim (F-202 clean):');
      md.push('');
      md.push('```');
      md.push(r.error);
      md.push('```');
      md.push('');
      md.push(`Refusing layer: **${r.refusingLayer ?? 'unclassified'}**.`);
      md.push('');
    }
  }
  if (fatal) {
    md.push('## FATAL');
    md.push('');
    md.push('```');
    md.push(fatal);
    md.push('```');
  }

  mkdirSync(EVID, { recursive: true });
  writeFileSync(
    join(EVID, `${outName}.json`),
    `${JSON.stringify({ label: LANE_STAMP, utc: stamp(), variant: v.id, arm: v.arm, cells, cases, results, fatal: fatal ?? null }, bigints, 2)}\n`,
  );
  writeFileSync(join(EVID, `${outName.toUpperCase()}.md`), `${md.join('\n')}\n`);
  console.log(`\nwrote ${join(EVID, `${outName}.json`)} and ${outName.toUpperCase()}.md`);
  for (const r of results) {
    const failed = r.checks.filter((c) => !c.ok);
    console.log(`## ${r.useCase} ${r.label}: placement ${r.placement}, settled=${r.settled}, ${failed.length} failed check(s)`);
    for (const f of failed) console.log(`   FAILED: ${f.name} — ${f.detail}`);
  }

  // A REFUSAL IS A RESULT. This exits nonzero only when the apparatus failed: a fatal before any case
  // ran, or a case that SETTLED and then failed its own assertions (which would mean the evidence
  // contradicts itself).
  if (fatal && results.length === 0) process.exitCode = 1;
  for (const r of results) {
    if (r.settled && r.checks.some((c) => !c.ok)) process.exitCode = 1;
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
