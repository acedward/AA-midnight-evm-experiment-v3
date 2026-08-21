// G5 — ADDENDUM A1: multi-input coin selection (EXPERIMENTAL_LANE / LANE-DEV-1 / ADDENDUM-A1).
//
// THE QUESTION. The ordered step ledger (G3) never forced a sender to COMBINE pieces: every
// amount it sent was coverable by a single held coin/UTXO, and the retained evidence shows the
// pinned wallet SDK spending exactly one piece whenever it held two (steps 7/8 — the survivor kept
// its original identifier). So whether `@midnightntwrk/wallet-sdk@2.0.0-beta.2` can select TWO OR
// MORE inputs of a CONTRACT-MINTED colour in ONE transaction is genuinely unknown on this lane.
//
// THE PROBE, per family (shielded first, then unshielded — identical choreography):
//
//   1. deploy (the existing G3 bootstrap; the Manager is deployed but its accounts stay unused)
//   2. mint 2 -> OwnerN and 3 -> OwnerN as TWO SEPARATE TRANSACTIONS, so OwnerN holds two
//      discrete pieces; assert the held set is exactly {2, 3} with DISTINCT identifiers
//   3. send 4: OwnerN -> OwnerM in ONE transaction (the wallet-sdk transfer flow G3 already used)
//   4. assert, from two observation points:
//        - OwnerM holds exactly 4, OwnerN holds exactly 1 (the change)
//        - BOTH original identifiers are gone from OwnerN's held set, and the change piece
//          carries a NEW identifier
//        - one transaction id covers the send
//        - shielded  point 2: the ledger conservation identity minted(5) = pool + OwnerN + OwnerM
//        - unshielded point 2: the indexer's own UTXO reconstruction agrees with both wallets, and
//          the indexer additionally shows BOTH consumed outputs spent by the SAME transaction and
//          BOTH new outputs (4 to OwnerM, 1 back to OwnerN) created by it
//
// FAILURE DISCIPLINE. If the transfer cannot be built, balanced or submitted, the exact error is
// captured, OwnerN is proven to still hold {2, 3} byte-identically (the same funds-unchanged
// discipline as the G3 negative controls), and the outcome is recorded as a NAMED RED — a valid,
// publishable answer. No work-around by pre-merging is attempted. A single-input control (send 3,
// which one held piece covers) then runs as a SEPARATELY LABELLED observation, to show whether the
// failure is specific to multi-input selection or general to the flow. It is never a substitute.
//
// EXIT CODE. This harness exits 0 when every family reached a DEFINITE, fully evidenced verdict —
// PROVEN or a named RED with the funds-unchanged proof. It exits nonzero only when it could not
// establish either (the probe could not be constructed, or an evidence check itself failed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MidnightBech32m } from '@midnightntwrk/wallet-sdk-address-format';
import { endpoints, readLaneEnv, REPO_ROOT } from '../lane.js';
import { bootstrap, type Rig } from '../g3/setup.js';
import { mintShieldedToUser, mintUnshieldedToUser, userSend } from '../g3/actions.js';
import {
  assertAll,
  observe,
  renderTable,
  row,
  snapshot,
  waitUntil,
  withIndexerCheck,
  type Observation,
  type Table,
} from '../g3/table.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g5-multi-input');
const LABEL = 'EXPERIMENTAL_LANE / LANE-DEV-1 / ADDENDUM-A1';

/** The harness already depends on this replacer everywhere: bigints are not JSON-serialisable. */
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}` : v);

type Family = 'shielded' | 'unshielded';
type Who = 'OwnerN' | 'OwnerM';

/** The two mints and the send, in units of the Minter's colour under test. */
const MINT_A = 2n;
const MINT_B = 3n;
const SEND = 4n;
const CHANGE = MINT_A + MINT_B - SEND; // 1

// ---------------------------------------------------------------------------------------------
// Held pieces — the identifier sets the whole probe turns on
// ---------------------------------------------------------------------------------------------

/**
 * One held piece and the identifier the probe tracks it by:
 *   shielded   — the coin NONCE (the commitment is recorded too, as corroboration)
 *   unshielded — `intentHash:outputNo`, the UTXO's chain identity
 */
type Piece = { id: string; value: bigint; detail: Record<string, unknown> };

const piecesOf = (o: Observation, who: Who, family: Family): Piece[] => {
  const ps: Piece[] =
    family === 'shielded'
      ? o.coins[who].map((c) => ({
          id: c.nonce,
          value: BigInt(c.value),
          detail: { nonce: c.nonce, value: c.value, commitment: c.commitment, nullifier: c.nullifier },
        }))
      : o.utxos[who].map((u) => ({
          id: `${u.intentHash}:${u.outputNo}`,
          value: BigInt(u.value),
          detail: { intentHash: u.intentHash, outputNo: u.outputNo, value: u.value },
        }));
  return ps.slice().sort((a, b) => (a.value === b.value ? a.id.localeCompare(b.id) : a.value < b.value ? -1 : 1));
};

const totalOf = (o: Observation, who: Who, family: Family): bigint =>
  family === 'shielded' ? o.table[who].shielded : o.table[who].unshielded;

const valuesOf = (ps: readonly Piece[]): string => `{${ps.map((p) => p.value).join(', ')}}`;
const idsOf = (ps: readonly Piece[]): string[] => ps.map((p) => p.id);

// ---------------------------------------------------------------------------------------------
// Indexer queries — observation point 2 for the unshielded family
// ---------------------------------------------------------------------------------------------

const gql = async (query: string, variables: Record<string, unknown>): Promise<any> => {
  const ep = endpoints(readLaneEnv());
  const res = await fetch(ep.indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json: any = await res.json();
  if (json?.errors) throw new Error(`indexer query failed: ${JSON.stringify(json.errors).slice(0, 400)}`);
  return json?.data;
};

type IndexerOutput = {
  owner: string;
  tokenType: string;
  value: string;
  intentHash: string;
  outputIndex: string;
  spentAtTransaction: { hash: string } | null;
};

/**
 * Every unshielded output of `color` created by the transaction with this identifier, with the
 * indexer's own record of whether it has since been spent and by which transaction. Exactly the
 * fields `observe.ts` already relies on, so no new schema assumption is introduced.
 */
const outputsOfTx = async (identifier: string, color: string): Promise<IndexerOutput[]> => {
  const data = await gql(
    'query($i: HexEncoded!) { transactions(offset: {identifier: $i}) { ' +
      'unshieldedCreatedOutputs { owner tokenType value intentHash outputIndex spentAtTransaction { hash } } } }',
    { i: identifier },
  );
  const out: IndexerOutput[] = [];
  for (const t of data?.transactions ?? []) {
    for (const u of t?.unshieldedCreatedOutputs ?? []) {
      if (String(u.tokenType).toLowerCase() !== color.toLowerCase()) continue;
      out.push(u as IndexerOutput);
    }
  }
  return out;
};

/**
 * The indexer reports UTXO owners bech32m-encoded; `observe.ts` decodes them the same way, and
 * `setup.ts` stores the wallets' unshielded addresses as lower-case hex. An owner that cannot be
 * decoded is compared verbatim rather than silently dropped.
 */
const ownerHex = (owner: string): string => {
  try {
    return MidnightBech32m.parse(String(owner)).data.toString('hex').toLowerCase();
  } catch {
    return String(owner).toLowerCase();
  }
};

/** The transaction's own hash, used only to corroborate "the same transaction spent both". */
const hashOfTx = async (identifier: string): Promise<string | null> => {
  try {
    const data = await gql('query($i: HexEncoded!) { transactions(offset: {identifier: $i}) { hash } }', {
      i: identifier,
    });
    const h = data?.transactions?.[0]?.hash;
    return h === undefined || h === null ? null : String(h);
  } catch {
    // Not load-bearing: the multi-input claim rests on the two consumed outputs reporting the SAME
    // spending transaction, which needs no top-level hash field. Absence is recorded, not hidden.
    return null;
  }
};

// ---------------------------------------------------------------------------------------------
// The evidence record for one family
// ---------------------------------------------------------------------------------------------

type Verdict = 'PROVEN' | 'RED';

type FamilyRecord = {
  label: string;
  addendum: 'A1';
  family: Family;
  color: string;
  utc: string;
  verdict: Verdict;
  headline: string;
  amounts: { mintA: string; mintB: string; send: string; expectedChange: string };
  mintTxs: { a: string; b: string };
  sendTx?: string;
  sendError?: string;
  /** The held set before the send: the two discrete pieces the probe requires. */
  heldBefore: { total: string; pieces: Piece[]; distinctIdentifiers: boolean; noSinglePieceCovers: boolean };
  heldAfter?: { ownerN: { total: string; pieces: Piece[] }; ownerM: { total: string; pieces: Piece[] } };
  /** The multi-input claim, stated as identifier-set facts rather than as balances. */
  consumedInputs?: {
    originalIds: string[];
    bothGoneFromOwnerN: boolean;
    changeIdIsNew: boolean;
    changeId?: string;
    ownerMIdsAreNew: boolean;
  };
  observationPoints: { point1: string; point2: string; point2Detail?: unknown };
  fundsUnchangedProof?: { checked: boolean; unchanged: boolean; before: string; after: string };
  singleInputControl?: { label: string; amount: string; txId?: string; error?: string; note: string };
  findings: string[];
  tableBefore: Record<string, string>;
  tableAfter?: Record<string, string>;
};

const tableOf = (o: Observation): Record<string, string> => ({
  AA_A: `${o.table.AA_A.shielded}/${o.table.AA_A.unshielded}`,
  OwnerN: `${o.table.OwnerN.shielded}/${o.table.OwnerN.unshielded}`,
  AA_B: `${o.table.AA_B.shielded}/${o.table.AA_B.unshielded}`,
  OwnerM: `${o.table.OwnerM.shielded}/${o.table.OwnerM.unshielded}`,
});

// ---------------------------------------------------------------------------------------------
// The probe
// ---------------------------------------------------------------------------------------------

/** Running model of what each user wallet should hold, so the expected table is never guessed. */
type Model = { OwnerN: { shielded: bigint; unshielded: bigint }; OwnerM: { shielded: bigint; unshielded: bigint } };

const expectedTable = (m: Model): Table => ({
  AA_A: row(0n, 0n),
  OwnerN: row(m.OwnerN.shielded, m.OwnerN.unshielded),
  AA_B: row(0n, 0n),
  OwnerM: row(m.OwnerM.shielded, m.OwnerM.unshielded),
});

const probeFamily = async (
  rig: Rig,
  family: Family,
  model: Model,
  minted: { shielded: bigint; unshielded: bigint },
  tx: (id: string) => string,
): Promise<FamilyRecord> => {
  const { ctx, deps } = rig;
  const color = family === 'shielded' ? rig.colors.shielded : rig.colors.unshielded;
  const mintToUser = family === 'shielded' ? mintShieldedToUser : mintUnshieldedToUser;
  const findings: string[] = [];

  console.log(`\n## ${family.toUpperCase()} — multi-input probe (mint ${MINT_A} + ${MINT_B} to OwnerN, send ${SEND})`);

  // --- 1. two discrete pieces, from two separate transactions ----------------------------------
  const mintA = tx(await mintToUser(ctx, MINT_A, rig.ownerN, rig.fee));
  minted[family] += MINT_A;
  model.OwnerN[family] += MINT_A;
  log(`  mint ${MINT_A} ${family} -> OwnerN: tx ${mintA}`);
  await waitUntil(deps, (o) => totalOf(o, 'OwnerN', family) === model.OwnerN[family], `OwnerN to hold ${MINT_A}`);

  const mintB = tx(await mintToUser(ctx, MINT_B, rig.ownerN, rig.fee));
  minted[family] += MINT_B;
  model.OwnerN[family] += MINT_B;
  log(`  mint ${MINT_B} ${family} -> OwnerN: tx ${mintB}`);

  // Wait for the TOTAL and for TWO discrete pieces. Reading once after submit would return
  // pre-transaction state (the pitfall paid for in G3), so every wait is on the expected condition.
  let before: Observation;
  try {
    before = await waitUntil(
      deps,
      (o) => totalOf(o, 'OwnerN', family) === model.OwnerN[family] && piecesOf(o, 'OwnerN', family).length >= 2,
      `OwnerN to hold ${model.OwnerN[family]} as two discrete pieces`,
    );
  } catch {
    // The wallet may have auto-merged on receipt. That is itself a finding — record it, then let
    // the precondition check below report precisely why the probe cannot be constructed.
    before = await observe(deps);
    findings.push(
      `A1-MERGE (${family}): OwnerN's held set never showed two discrete pieces — observed ` +
        `${valuesOf(piecesOf(before, 'OwnerN', family))} totalling ${totalOf(before, 'OwnerN', family)}`,
    );
  }
  before = await withIndexerCheck(deps, before);

  const heldPieces = piecesOf(before, 'OwnerN', family);
  const heldTotal = totalOf(before, 'OwnerN', family);
  const ids = idsOf(heldPieces);
  const distinct = new Set(ids).size === ids.length && ids.length >= 2;
  const maxPiece = heldPieces.reduce((a, p) => (p.value > a ? p.value : a), 0n);
  const noSingleCovers = maxPiece < SEND;
  log(`  OwnerN holds ${valuesOf(heldPieces)} = ${heldTotal}; ids ${JSON.stringify(ids)}`);

  const record: FamilyRecord = {
    label: LABEL,
    addendum: 'A1',
    family,
    color,
    utc: stamp(),
    verdict: 'RED',
    headline: '(not yet determined)',
    amounts: { mintA: `${MINT_A}`, mintB: `${MINT_B}`, send: `${SEND}`, expectedChange: `${CHANGE}` },
    mintTxs: { a: mintA, b: mintB },
    heldBefore: {
      total: `${heldTotal}`,
      pieces: heldPieces,
      distinctIdentifiers: distinct,
      noSinglePieceCovers: noSingleCovers,
    },
    observationPoints: {
      point1: 'the wallet SDK synced state of OwnerN and OwnerM (balances AND per-piece identifiers)',
      point2:
        family === 'shielded'
          ? "the ledger conservation identity — the Minter's total minted supply equals the Manager's pooled holdings plus every user's holdings, read from contract/ledger state"
          : "the indexer's own UTXO reconstruction, plus the indexer's per-output spent/created records for the send transaction",
    },
    findings,
    tableBefore: tableOf(before),
  };

  // The probe is only meaningful if NO single held piece covers the send.
  if (!distinct || !noSingleCovers || heldTotal !== model.OwnerN[family]) {
    record.headline =
      `PROBE NOT CONSTRUCTIBLE (${family}): OwnerN holds ${valuesOf(heldPieces)}; a send of ${SEND} is not ` +
      `larger than every single held piece (max ${maxPiece}), so the probe would not test multi-input selection`;
    findings.push(record.headline);
    throw new Error(`${record.headline} — see evidence/g5-multi-input/${family}.json`);
  }

  // Full assertion of the pre-send state through both observation points.
  assertAll(before, expectedTable(model), `A1-${family}-before`, minted);
  log(`  pre-send table asserted — ${renderTable(before.table)}`);
  const beforeSnap = snapshot(before);

  // --- 2. the send: 4 in ONE transaction, which no single piece can cover ----------------------
  let sendTx: string | undefined;
  let sendError: string | undefined;
  try {
    sendTx = tx(await userSend(rig.ownerN, rig.ownerM, family, color, SEND));
    record.sendTx = sendTx;
    log(`  OwnerN -${SEND}-> OwnerM (${family}): tx ${sendTx}`);
  } catch (e) {
    const err = e as any;
    const cause = err?.cause ? ` | cause: ${String(err.cause?.message ?? err.cause)}` : '';
    sendError = `${e instanceof Error ? e.message : String(e)}${cause}`;
    record.sendError = sendError.slice(0, 2000);
    log(`  SEND FAILED (${family}): ${sendError.split('\n')[0]}`);
  }

  // --- 3a. RED path: prove the funds are unchanged, then take a single-input control ------------
  if (sendError !== undefined) {
    // Give the chain time to apply anything that might (wrongly) have gone through, so "unchanged"
    // is a real observation and not a race we won — the G3 negative-control discipline verbatim.
    await new Promise((r) => setTimeout(r, 12_000));
    const after = await withIndexerCheck(deps, await observe(deps));
    const afterSnap = snapshot(after);
    const unchanged = beforeSnap === afterSnap;
    record.fundsUnchangedProof = { checked: true, unchanged, before: beforeSnap, after: afterSnap };
    record.verdict = 'RED';
    record.headline =
      `RED (${family}): the pinned wallet SDK could not send ${SEND} from a held set of ` +
      `${valuesOf(heldPieces)} — ${sendError.split('\n')[0].slice(0, 240)}`;
    record.tableAfter = tableOf(after);
    record.heldAfter = {
      ownerN: { total: `${totalOf(after, 'OwnerN', family)}`, pieces: piecesOf(after, 'OwnerN', family) },
      ownerM: { total: `${totalOf(after, 'OwnerM', family)}`, pieces: piecesOf(after, 'OwnerM', family) },
    };
    if (!unchanged) {
      findings.push(
        `A1-FUNDS-MOVED (${family}): the send failed but the observed state is NOT byte-identical — ` +
          'the funds-unchanged proof does not hold and the RED is not clean',
      );
    }

    // Separately labelled observation — NOT a substitute for the probe, and it runs only after the
    // funds-unchanged proof has been taken. It isolates the failure to multi-input selection.
    const controlAmount = MINT_B; // 3 — covered by one single held piece
    try {
      const cTx = tx(await userSend(rig.ownerN, rig.ownerM, family, color, controlAmount));
      model.OwnerN[family] -= controlAmount;
      model.OwnerM[family] += controlAmount;
      await waitUntil(
        deps,
        (o) => totalOf(o, 'OwnerM', family) === model.OwnerM[family],
        `single-input control: OwnerM to hold ${model.OwnerM[family]}`,
      );
      record.singleInputControl = {
        label: 'SINGLE-INPUT CONTROL (separately labelled observation, not part of the A1 probe)',
        amount: `${controlAmount}`,
        txId: cTx,
        note:
          `a send of ${controlAmount} IS covered by one held piece and SUCCEEDED, so the flow itself works — ` +
          'the failure above is specific to combining inputs',
      };
    } catch (e) {
      record.singleInputControl = {
        label: 'SINGLE-INPUT CONTROL (separately labelled observation, not part of the A1 probe)',
        amount: `${controlAmount}`,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 600),
        note: 'even a single-input send failed, so the failure is NOT specific to multi-input selection',
      };
    }
    return record;
  }

  // --- 3b. the send was submitted: wait for the expected post-send state -----------------------
  model.OwnerN[family] -= SEND;
  model.OwnerM[family] += SEND;
  let after: Observation;
  try {
    after = await waitUntil(
      deps,
      (o) =>
        totalOf(o, 'OwnerM', family) === model.OwnerM[family] &&
        totalOf(o, 'OwnerN', family) === model.OwnerN[family],
      `OwnerM to hold ${model.OwnerM[family]} and OwnerN ${model.OwnerN[family]} (${family})`,
    );
  } catch (e) {
    const observed = await withIndexerCheck(deps, await observe(deps));
    record.verdict = 'RED';
    record.sendError = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    record.headline =
      `RED (${family}): the send of ${SEND} was submitted as tx ${sendTx} but the expected post-send ` +
      `state never appeared — observed [${renderTable(observed.table)}]`;
    record.tableAfter = tableOf(observed);
    record.heldAfter = {
      ownerN: { total: `${totalOf(observed, 'OwnerN', family)}`, pieces: piecesOf(observed, 'OwnerN', family) },
      ownerM: { total: `${totalOf(observed, 'OwnerM', family)}`, pieces: piecesOf(observed, 'OwnerM', family) },
    };
    const afterSnap = snapshot(observed);
    record.fundsUnchangedProof = {
      checked: true,
      unchanged: beforeSnap === afterSnap,
      before: beforeSnap,
      after: afterSnap,
    };
    findings.push(
      `A1-NOT-SETTLED (${family}): the transaction was accepted for submission but the ledger never ` +
        'reached the expected state; the observed state is recorded above',
    );
    return record;
  }

  after = await withIndexerCheck(deps, after);
  const afterN = piecesOf(after, 'OwnerN', family);
  const afterM = piecesOf(after, 'OwnerM', family);
  log(`  after: OwnerN ${valuesOf(afterN)}, OwnerM ${valuesOf(afterM)}`);

  // --- 4. the multi-input claim, as identifier-set facts ---------------------------------------
  const originalIds = ids;
  const afterNIds = idsOf(afterN);
  const bothGone = originalIds.every((i) => !afterNIds.includes(i));
  const changeId = afterN.length === 1 ? afterN[0]!.id : undefined;
  const changeIsNew = changeId !== undefined && !originalIds.includes(changeId);
  const ownerMIdsAreNew = idsOf(afterM).every((i) => !originalIds.includes(i));
  record.consumedInputs = {
    originalIds,
    bothGoneFromOwnerN: bothGone,
    changeIdIsNew: changeIsNew,
    changeId,
    ownerMIdsAreNew,
  };
  record.heldAfter = {
    ownerN: { total: `${totalOf(after, 'OwnerN', family)}`, pieces: afterN },
    ownerM: { total: `${totalOf(after, 'OwnerM', family)}`, pieces: afterM },
  };
  record.tableAfter = tableOf(after);

  const fail = (m: string): never => {
    record.headline = `EVIDENCE CHECK FAILED (${family}): ${m}`;
    findings.push(record.headline);
    throw new Error(`${record.headline} — see evidence/g5-multi-input/${family}.json`);
  };
  if (afterN.length !== 1) fail(`OwnerN should hold exactly one change piece, holds ${valuesOf(afterN)}`);
  if (afterN[0]!.value !== CHANGE) fail(`OwnerN's change piece is ${afterN[0]!.value}, expected ${CHANGE}`);
  if (!bothGone) fail(`not both original identifiers are gone from OwnerN's held set (${JSON.stringify(afterNIds)})`);
  if (!changeIsNew) fail("OwnerN's change piece reuses an original identifier — it is not a new piece");
  if (afterM.reduce((a, p) => a + p.value, 0n) !== SEND) fail(`OwnerM's pieces sum to something other than ${SEND}`);
  if (!ownerMIdsAreNew) fail("OwnerM's received piece reuses one of OwnerN's original identifiers");

  // Both observation points, and both halves of the standing invariant, in one assertion.
  assertAll(after, expectedTable(model), `A1-${family}-after`, minted);

  // --- observation point 2 -----------------------------------------------------------------------
  if (family === 'shielded') {
    // A shielded coin is private by construction, so the indexer cannot attribute it to an owner.
    // The honest second point is the ledger conservation identity, computed here explicitly and
    // also enforced by `assertAll` above.
    const conservation = {
      mintedShielded: `${minted.shielded}`,
      managerPool: `${after.manager.poolValue}`,
      ownerN: `${after.table.OwnerN.shielded}`,
      ownerM: `${after.table.OwnerM.shielded}`,
      identityHolds:
        after.manager.poolValue + after.table.OwnerN.shielded + after.table.OwnerM.shielded === minted.shielded,
    };
    if (!conservation.identityHolds) fail(`shielded conservation identity broken: ${JSON.stringify(conservation)}`);
    record.observationPoints.point2Detail = conservation;
  } else {
    // The indexer's own view: the two consumed outputs must report the SAME spending transaction,
    // and that transaction must have created both new outputs (SEND to OwnerM, CHANGE to OwnerN).
    const spentBy = new Set<string>();
    const consumed: IndexerOutput[] = [];
    for (const mintTx of [mintA, mintB]) {
      for (const u of await outputsOfTx(mintTx, color)) {
        consumed.push(u);
        if (u.spentAtTransaction) spentBy.add(String(u.spentAtTransaction.hash));
      }
    }
    const created = await outputsOfTx(sendTx!, color);
    const sendHash = await hashOfTx(sendTx!);
    const createdValues = created.map((u) => BigInt(u.value)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const toOwnerM = created.filter(
      (u) => ownerHex(u.owner) === rig.addresses.OwnerM && BigInt(u.value) === SEND,
    ).length;
    const toOwnerN = created.filter(
      (u) => ownerHex(u.owner) === rig.addresses.OwnerN && BigInt(u.value) === CHANGE,
    ).length;

    const detail = {
      consumedOutputs: consumed.map((u) => ({
        value: u.value,
        intentHash: u.intentHash,
        outputIndex: u.outputIndex,
        spentAtTransaction: u.spentAtTransaction ? u.spentAtTransaction.hash : null,
      })),
      distinctSpendingTransactions: [...spentBy],
      sendTransactionHash: sendHash,
      createdOutputsOfSendTx: created.map((u) => ({
        value: u.value,
        owner: ownerHex(u.owner),
        intentHash: u.intentHash,
        outputIndex: u.outputIndex,
      })),
      indexerReconstruction: {
        OwnerN: `${after.indexerUnshielded?.OwnerN}`,
        OwnerM: `${after.indexerUnshielded?.OwnerM}`,
      },
    };
    record.observationPoints.point2Detail = detail;

    if (consumed.length !== 2) fail(`the indexer shows ${consumed.length} minted outputs of the colour, expected 2`);
    if (consumed.some((u) => !u.spentAtTransaction)) fail('the indexer still reports one of the two inputs as unspent');
    if (spentBy.size !== 1) {
      fail(`the two inputs were spent by ${spentBy.size} different transactions — this is not one transaction`);
    }
    if (sendHash !== null && !spentBy.has(sendHash)) {
      fail(`the inputs were spent by ${[...spentBy]} but the send transaction hash is ${sendHash}`);
    }
    if (sendHash === null) {
      findings.push(
        `A1-INDEXER-HASH (${family}): the indexer did not expose a top-level transaction hash, so the ` +
          'spending transaction is identified only by the hash both consumed outputs agree on (which is ' +
          'exactly the single-transaction claim). The claim itself is unaffected.',
      );
    }
    if (toOwnerM !== 1 || toOwnerN !== 1) {
      fail(
        `the send transaction created ${createdValues.join('+')} of the colour; expected exactly ` +
          `${SEND} to OwnerM and ${CHANGE} back to OwnerN`,
      );
    }
  }

  record.verdict = 'PROVEN';
  record.headline =
    `PROVEN (${family}): OwnerN held ${valuesOf(heldPieces)} — no single piece covers ${SEND} — and ONE ` +
    `transaction (${sendTx}) consumed BOTH inputs, paid ${SEND} to OwnerM and returned ${CHANGE} as change ` +
    'under a NEW identifier';
  record.utc = stamp();
  log(`  ${record.headline}`);
  return record;
};

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const renderSummary = (records: FamilyRecord[], rig: Rig): string => {
  const verdictLine = (r: FamilyRecord) => `| ${r.family} | **${r.verdict}** | ${r.headline} |`;
  const lines: string[] = [
    '# Addendum A1 — multi-input coin selection',
    '',
    `**Label:** \`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\` / \`ADDENDUM-A1\``,
    '',
    'This addendum is **outside the 26-cell combination matrix**. It claims no spec cell, and the',
    'approved specification is unchanged. Gates G1–G4 and their evidence are untouched.',
    '',
    '**The question.** Can the pinned wallet SDK select **two or more inputs** of a contract-minted',
    'colour in ONE transaction? The ordered ledger never forced it: every amount it sent was',
    'coverable by a single held piece.',
    '',
    `**The probe.** OwnerN is minted ${MINT_A} and ${MINT_B} of the Minter's colour as TWO separate`,
    `transactions, so it holds two discrete pieces and **no single piece covers ${SEND}**. OwnerN then`,
    `sends ${SEND} to OwnerM in one transaction. Both families, identical choreography.`,
    '',
    '| family | verdict | result |',
    '|---|---|---|',
    ...records.map(verdictLine),
    '',
    '## Deployment of record',
    '',
    `- Minter: \`${rig.minterAddress}\``,
    `- Manager: \`${rig.managerAddress}\` (deployed by the shared bootstrap; **its accounts stay unused** —`,
    '  the addendum is entirely wallet-side)',
    `- shielded colour: \`${rig.colors.shielded}\``,
    `- unshielded colour: \`${rig.colors.unshielded}\``,
    '',
  ];

  for (const r of records) {
    lines.push(
      `## ${r.family}`,
      '',
      `**Verdict: ${r.verdict}.** ${r.headline}`,
      '',
      `| what | value |`,
      `|---|---|`,
      `| mint ${r.amounts.mintA} → OwnerN | \`${r.mintTxs.a}\` |`,
      `| mint ${r.amounts.mintB} → OwnerN | \`${r.mintTxs.b}\` |`,
      `| held set before the send | ${valuesOf(r.heldBefore.pieces)} (total ${r.heldBefore.total}) |`,
      `| distinct identifiers | ${r.heldBefore.distinctIdentifiers} |`,
      `| no single piece covers ${r.amounts.send} | ${r.heldBefore.noSinglePieceCovers} |`,
      `| send ${r.amounts.send} OwnerN → OwnerM | ${r.sendTx ? `\`${r.sendTx}\`` : '**failed**'} |`,
      `| OwnerN after | ${r.heldAfter ? `${valuesOf(r.heldAfter.ownerN.pieces)} (total ${r.heldAfter.ownerN.total})` : '—'} |`,
      `| OwnerM after | ${r.heldAfter ? `${valuesOf(r.heldAfter.ownerM.pieces)} (total ${r.heldAfter.ownerM.total})` : '—'} |`,
      `| both inputs consumed | ${r.consumedInputs ? r.consumedInputs.bothGoneFromOwnerN : '—'} |`,
      `| change carries a NEW identifier | ${r.consumedInputs ? r.consumedInputs.changeIdIsNew : '—'} |`,
      '',
      `**Observation point 1** — ${r.observationPoints.point1}.`,
      '',
      `**Observation point 2** — ${r.observationPoints.point2}.`,
      '',
      '```json',
      JSON.stringify(r.observationPoints.point2Detail ?? {}, bigints, 2),
      '```',
      '',
    );
    if (r.sendError) {
      lines.push('**Failure captured verbatim:**', '', '```', r.sendError.slice(0, 1200), '```', '');
    }
    if (r.fundsUnchangedProof) {
      lines.push(
        `**Funds-unchanged proof:** the full observation (balances, per-piece identifiers, pooled coin,` +
          ` contract ledger balance) is byte-identical before and after: **${r.fundsUnchangedProof.unchanged}**.`,
        '',
      );
    }
    if (r.singleInputControl) {
      lines.push(
        `**${r.singleInputControl.label}** — send ${r.singleInputControl.amount}: ` +
          `${r.singleInputControl.txId ? `tx \`${r.singleInputControl.txId}\`` : `failed (${r.singleInputControl.error})`}. ` +
          `${r.singleInputControl.note}`,
        '',
      );
    }
    if (r.findings.length > 0) {
      lines.push('**Findings:**', '', ...r.findings.map((f) => `- ${f}`), '');
    }
    lines.push(`Machine-readable record: [\`${r.family}.json\`](${r.family}.json)`, '');
  }

  return lines.join('\n');
};

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

const main = async () => {
  console.log(`# G5 ADDENDUM A1 — multi-input coin selection — ${LABEL} — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;
  const records: FamilyRecord[] = [];

  try {
    rig = await bootstrap();
    const { deps } = rig;
    const minted = { shielded: 0n, unshielded: 0n };
    const model: Model = { OwnerN: { shielded: 0n, unshielded: 0n }, OwnerM: { shielded: 0n, unshielded: 0n } };

    // Observation point 2 for user unshielded holdings replays exactly the transactions this run
    // submitted, so every id is recorded at the single place it is first seen.
    const tx = <T extends string>(id: T): T => {
      deps.submittedTxs.push(id);
      return id;
    };
    tx(rig.deployTxs.minter);
    tx(rig.deployTxs.manager);
    for (const id of Object.values(rig.fundingTxs)) if (/^[0-9a-f]{6,}$/i.test(id)) tx(id);

    for (const family of ['shielded', 'unshielded'] as const) {
      let rec: FamilyRecord | undefined;
      try {
        rec = await probeFamily(rig, family, model, minted, tx);
      } finally {
        if (rec) {
          records.push(rec);
          writeFileSync(join(EVID, `${family}.json`), JSON.stringify(rec, bigints, 2));
        }
      }
    }

    writeFileSync(join(EVID, 'summary.md'), renderSummary(records, rig));
    writeFileSync(
      join(EVID, 'result.json'),
      JSON.stringify(
        {
          label: LABEL,
          addendum: 'A1',
          utc: stamp(),
          outsideMatrix: true,
          specUnchanged: true,
          minterAddress: rig.minterAddress,
          managerAddress: rig.managerAddress,
          colors: rig.colors,
          families: records.map((r) => ({ family: r.family, verdict: r.verdict, headline: r.headline, sendTx: r.sendTx })),
        },
        bigints,
        2,
      ),
    );

    console.log('\n## RESULT');
    for (const r of records) console.log(`  ${r.verdict.padEnd(6)} ${r.family} — ${r.headline}`);
    console.log(`\nevidence -> evidence/g5-multi-input/ (summary.md, shielded.json, unshielded.json, result.json)`);

    // A named RED is a valid, publishable answer, so it does NOT fail the harness — but it must be
    // a CLEAN red: the exact failure plus a funds-unchanged proof that actually holds.
    for (const r of records) {
      if (r.verdict === 'RED' && r.fundsUnchangedProof?.unchanged !== true) {
        console.error(
          `\n${r.family}: RED without a holding funds-unchanged proof — the outcome is not cleanly evidenced`,
        );
        process.exitCode = 1;
      }
    }
    if (records.length !== 2) {
      console.error(`\nonly ${records.length} of 2 families reached a verdict`);
      process.exitCode = 1;
    }
  } finally {
    if (rig) await rig.close();
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
