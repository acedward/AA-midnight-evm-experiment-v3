// G3 — the probes of spec "Negative controls and probes": P-COLL, M3 and Distinctness.
// EXPERIMENTAL_LANE / LANE-DEV-1.
//
// They run after the 18-row walk and after the negative controls, in the SAME process and against
// the SAME Manager, so every probe inherits the full custody state the walk built and the standing
// per-step machinery (exact map sizes, dynamic zero-unaccounted-keys, per-colour invariant,
// conservation, two observation points) applies to every probe step as well.
//
//   P-COLL  MinterCollide (TOKX) derives ONE separator and hands it to BOTH mint families, so its
//           shielded and unshielded colours are the SAME 32 BYTES by construction. G2 proved the
//           fixture compiles, deploys and reads back byte-identical. What G2 did NOT exercise is its
//           TOKEN half, and that is this probe: mint 3 shielded and 2 unshielded of that one colour,
//           deposit both to AA_B, and require the Manager to track them INDEPENDENTLY — pool 3 vs
//           contract ledger balance 2, two cells under two different key domains — then spend one
//           unit from each side and require the other side not to move.
//
//   M3      TOKE's S5 and U5 are brand new. Their FIRST deposits — one per family — go in ONE
//           transaction, so a single transaction id creates one new pool and two new cells. The
//           shape is the SDK contract-scoped batch (decision D-203), which is the composition
//           00004's probe M1 PROVED legal for two calls on one address on this lane; a
//           same-address sequence assembled into one ledger Intent is refused by the 223 rule.
//           FR-207's fallback is implemented literally in `actions.doubleLazyInitDeposit`.
//
//   Distinctness  45 pairwise comparisons over the ten TOKA–TOKE colours, all read from ON-CHAIN
//           circuit calls, plus the ONE INVERTED assertion: MinterCollide's two family colours must
//           be byte-EQUAL, and must still collide with none of the ten.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SDK_SCOPED,
  SEPARATE_TXS,
  accountWithdrawShielded,
  accountWithdrawUnshielded,
  mintShieldedToUser,
  mintUnshieldedToUser,
  separateDoubleDeposit,
  tryScopedDoubleDeposit,
  userDepositShielded,
  userDepositUnshielded,
  type DoubleLazyInitAttempt,
  type DoubleLazyInitLegs,
} from './actions.js';
import { shieldedKeyOf, unshieldedKeyOf } from '../manager-view.js';
import { observe, type Observation, type ExpectedState, type Custody } from './table.js';
import { resultOf, type Rig, type Spender } from './setup.js';
import { withDustRetry } from '../night.js';
import type { CellSink } from './cells.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}` : v);

/**
 * A real ON-CHAIN balance read: a proved transaction whose result comes back through the SDK, not a
 * decode of fetched state (FR-208's third observation point).
 *
 * The probes use it for the two claims where a second, mechanically different answer matters most:
 * P-COLL's "the SAME 32 bytes answer 2 in one family and 1 in the other" — which is far more
 * convincing when the two answers come from two circuit calls taking an identical colour argument —
 * and M3's "both brand-new colours really are custodied".
 */
const onChainBalance = async (
  rig: Rig,
  family: 'shielded' | 'unshielded',
  account: Uint8Array,
  colourRaw: Uint8Array,
  what: string,
): Promise<{ value: bigint; circuit: string; txish: string }> => {
  await rig.ctx.actAs(rig.ctx.managerFee, new Uint8Array(32));
  const circuit = family === 'shielded' ? 'shieldedAccountBalance' : 'unshieldedAccountBalance';
  const r: any = await withDustRetry(rig.fee, `${circuit}(${what})`, () =>
    (rig.managerDeployed.callTx as any)[circuit](account, colourRaw),
  );
  return {
    value: resultOf<bigint>(r),
    circuit,
    txish: String(r?.public?.txId ?? r?.public?.txHash ?? ''),
  };
};

export type Requirement = { colour: string; shielded: boolean; amount: bigint };

/** What the probes need from the runner: the rig, the running expectation, and the assert loop. */
export type ProbeHarness = {
  rig: Rig;
  tx: (id: string) => string;
  withSpender: <T>(
    who: 'OwnerN' | 'OwnerM',
    tag: string,
    fn: (s: Spender) => Promise<T>,
    require?: Requirement[],
  ) => Promise<T>;
  /** Register new colour columns (expected 0 everywhere) once their issuer is deployed. */
  addColours: (names: string[]) => void;
  /** Apply a delta to the running expectation. */
  expect: (fn: (e: ExpectedState) => void) => void;
  /** Wait for the running expectation and assert EVERYTHING; returns the observation. */
  assertNow: (label: string) => Promise<Observation>;
  minted: Custody;
  cell: CellSink;
  evidenceDir: string;
};

export type ProbeResults = {
  distinctness: {
    comparisons: number;
    distinct: number;
    collisions: string[];
    colours: Record<string, string>;
    collider: { shielded: string; unshielded: string; byteIdentical: boolean; contaminates: string[] };
    ok: boolean;
  };
  pcoll: Record<string, unknown>;
  m3: Record<string, unknown>;
};

export const runProbes = async (h: ProbeHarness): Promise<ProbeResults> => {
  const { rig } = h;
  const { ctx, raw, registry } = rig;
  const colour = (name: string) => registry.get(name);

  // =============================================================================================
  // Probe setup — TOKE and MinterCollide come into existence. Deploying them must not move a
  // single Manager cell: the assertion right after is the whole post-walk state, unchanged, with
  // four more colour columns at zero.
  // =============================================================================================
  console.log('\n## PROBE SETUP — TOKE (M3 issuer) and MinterCollide (P-COLL fixture)');
  const toke = await rig.deployMinter({
    label: 'Minter5',
    tagText: 'TOKE',
    kind: 'minter',
    shieldedName: 'S5',
    unshieldedName: 'U5',
  });
  const tokx = await rig.deployMinter({
    label: 'MinterCollide',
    tagText: 'TOKX',
    kind: 'minter-collide',
    shieldedName: 'XS',
    unshieldedName: 'XU',
  });
  h.addColours(['S5', 'U5', 'XS', 'XU']);
  await h.assertNow('probe-setup (two more issuers exist; the Manager is untouched)');

  // =============================================================================================
  // DISTINCTNESS — 45 pairwise comparisons, and the ONE inverted equality
  // =============================================================================================
  console.log('\n## DISTINCTNESS — 45 pairwise comparisons over TOKA–TOKE, from on-chain reads');
  const tenColours: Array<[string, string]> = [];
  for (const m of rig.minters.filter((x) => x.kind === 'minter')) {
    tenColours.push([`${m.label}(${m.tagText}).${m.shieldedName}`, m.shieldedColour]);
    tenColours.push([`${m.label}(${m.tagText}).${m.unshieldedName}`, m.unshieldedColour]);
  }
  let comparisons = 0;
  let distinct = 0;
  const collisions: string[] = [];
  for (let i = 0; i < tenColours.length; i++) {
    for (let k = i + 1; k < tenColours.length; k++) {
      comparisons++;
      if (tenColours[i]![1] === tenColours[k]![1]) collisions.push(`${tenColours[i]![0]} == ${tenColours[k]![0]}`);
      else distinct++;
    }
  }
  const contaminates = tenColours.filter(([, v]) => v === tokx.shieldedColour).map(([n]) => n);
  const colliderEqual = tokx.shieldedColour === tokx.unshieldedColour;
  const distinctnessOk =
    tenColours.length === 10 && comparisons === 45 && collisions.length === 0 && colliderEqual && contaminates.length === 0;
  log(`  ${distinct}/${comparisons} distinct over ${tenColours.length} colours; MinterCollide byte-equal: ${colliderEqual}`);
  h.cell({
    id: 'distinctness',
    label: 'Distinctness — 45/45 pairwise over TOKA–TOKE, plus the INVERTED MinterCollide equality',
    step: 'probe',
    txs: [],
    level: 'SDK',
    points:
      `${distinct}/${comparisons} pairwise comparisons distinct over the ten TOKA–TOKE colours, every one read ` +
      `from an on-chain circuit call; MinterCollide's two family colours byte-EQUAL (${tokx.shieldedColour.slice(0, 16)}…) ` +
      `and colliding with none of the ten`,
    status: distinctnessOk ? 'GREEN' : 'RED',
    evidence: 'evidence/g3-ledger/probes.json',
    note:
      'The equality is the inverted assertion: MinterCollide derives ONE separator and feeds it to both mint ' +
      'families, so its two colours are the same 32 bytes by construction. Every other colour comparison in ' +
      'this project asserts INEQUALITY.',
  });

  // =============================================================================================
  // P-COLL — the byte-identical colour, in both families, custodied independently
  // =============================================================================================
  console.log('\n## P-COLL — a byte-identical colour deposited into BOTH families of AA_B');
  const X = colour('XS');
  if (colour('XU').hex !== X.hex) throw new Error('P-COLL fixture broken: XS and XU are not the same bytes');
  const keyS = shieldedKeyOf(raw.AA_B, X.raw);
  const keyU = unshieldedKeyOf(raw.AA_B, X.raw);
  if (keyS === keyU) throw new Error('FR-203 broken: the two family keys for (AA_B, X) are identical');
  log(`  colliding colour ${X.hex}`);
  log(`  (AA_B,X) shielded key ${keyS}`);
  log(`  (AA_B,X) unshielded key ${keyU}  — differ: ${keyS !== keyU}`);

  const pcollTxs: string[] = [];
  // --- mints: 3 shielded, 2 unshielded, of THE SAME colour, both to OwnerM ----------------------
  pcollTxs.push(h.tx(await mintShieldedToUser(ctx, 'MinterCollide', 3n, rig.observers.OwnerM, rig.fee)));
  h.minted.XS = (h.minted.XS ?? 0n) + 3n;
  pcollTxs.push(h.tx(await mintUnshieldedToUser(ctx, 'MinterCollide', 2n, rig.addresses.OwnerM, rig.fee)));
  h.minted.XU = (h.minted.XU ?? 0n) + 2n;
  h.expect((e) => {
    e.table.OwnerM.XS = 3n;
    e.table.OwnerM.XU = 2n;
  });
  await h.assertNow('P-COLL mints (3 shielded + 2 unshielded of one colour to OwnerM)');

  // --- deposits: both to AA_B ---------------------------------------------------------------------
  const depS = await h.withSpender(
    'OwnerM',
    'pcoll-shielded',
    (s) => userDepositShielded(ctx, s.party, s.managerProviders, X.raw, 3n, raw.AA_B),
    [{ colour: X.hex, shielded: true, amount: 3n }],
  );
  pcollTxs.push(h.tx(depS.txId));
  h.expect((e) => {
    e.table.OwnerM.XS = 0n;
    e.table.AA_B.XS = 3n;
    e.custody.XS = 3n;
    e.sizes.pools += 1;
    e.sizes.shieldedCells += 1;
  });
  await h.assertNow('P-COLL shielded deposit 3 -> AA_B');

  const depU = await h.withSpender(
    'OwnerM',
    'pcoll-unshielded',
    (s) => userDepositUnshielded(ctx, s.party, s.managerProviders, X.raw, 2n, raw.AA_B),
    [{ colour: X.hex, shielded: false, amount: 2n }],
  );
  pcollTxs.push(h.tx(depU));
  h.expect((e) => {
    e.table.OwnerM.XU = 0n;
    e.table.AA_B.XU = 2n;
    e.custody.XU = 2n;
    e.sizes.unshieldedCells += 1;
  });
  const bothDeposited = await h.assertNow('P-COLL unshielded deposit 2 -> AA_B');

  // THE ASSERTION P-COLL EXISTS FOR: one 32-byte colour, two families, tracked independently.
  const poolX = bothDeposited.custody.XS;
  const ledgerX = bothDeposited.custody.XU;
  const cellS = bothDeposited.manager.shieldedBalances[keyS];
  const cellU = bothDeposited.manager.unshieldedBalances[keyU];
  const independent =
    poolX === 3n && ledgerX === 2n && cellS === 3n && cellU === 2n && keyS !== keyU;
  log(`  pool(X) = ${poolX}   contract ledger balance(X) = ${ledgerX}   cells ${cellS} / ${cellU}`);
  if (!independent) {
    throw new Error(
      `P-COLL FAILED — the same 32 bytes are NOT tracked independently: pool=${poolX} (expected 3), ` +
        `ledger=${ledgerX} (expected 2), shielded cell=${cellS}, unshielded cell=${cellU}`,
    );
  }

  // --- independent withdrawals: one unit from each side, the other side must not move -------------
  const beforeShieldedWithdraw = bothDeposited;
  pcollTxs.push(h.tx(await accountWithdrawShielded(ctx, raw.secretB, X.raw, 1n, rig.observers.OwnerM, rig.fee)));
  h.expect((e) => {
    e.table.AA_B.XS = 2n;
    e.custody.XS = 2n;
    e.table.OwnerM.XS = 1n;
  });
  const afterShieldedWithdraw = await h.assertNow('P-COLL shielded withdrawal 1 (the unshielded side must not move)');
  if (
    afterShieldedWithdraw.custody.XU !== beforeShieldedWithdraw.custody.XU ||
    afterShieldedWithdraw.table.AA_B.XU !== beforeShieldedWithdraw.table.AA_B.XU
  ) {
    throw new Error('P-COLL FAILED — a SHIELDED withdrawal moved the UNSHIELDED side of the same colour');
  }

  pcollTxs.push(h.tx(await accountWithdrawUnshielded(ctx, raw.secretB, X.raw, 1n, rig.addresses.OwnerM, rig.fee)));
  h.expect((e) => {
    e.table.AA_B.XU = 1n;
    e.custody.XU = 1n;
    e.table.OwnerM.XU = 1n;
  });
  const afterUnshieldedWithdraw = await h.assertNow('P-COLL unshielded withdrawal 1 (the shielded side must not move)');
  if (
    afterUnshieldedWithdraw.custody.XS !== afterShieldedWithdraw.custody.XS ||
    afterUnshieldedWithdraw.table.AA_B.XS !== afterShieldedWithdraw.table.AA_B.XS
  ) {
    throw new Error('P-COLL FAILED — an UNSHIELDED withdrawal moved the SHIELDED side of the same colour');
  }

  // --- the SECOND observation point for the P-COLL claim: two on-chain circuit calls taking the
  //     IDENTICAL 32-byte colour argument, which must answer differently ---------------------------
  const onChainXS = await onChainBalance(rig, 'shielded', raw.AA_B, X.raw, 'AA_B, X shielded');
  const onChainXU = await onChainBalance(rig, 'unshielded', raw.AA_B, X.raw, 'AA_B, X unshielded');
  for (const id of [onChainXS.txish, onChainXU.txish]) if (id) h.tx(id);
  log(
    `  ON-CHAIN, same 32-byte argument: shieldedAccountBalance(AA_B, X) = ${onChainXS.value}, ` +
      `unshieldedAccountBalance(AA_B, X) = ${onChainXU.value}`,
  );
  if (onChainXS.value !== afterUnshieldedWithdraw.table.AA_B.XS || onChainXU.value !== afterUnshieldedWithdraw.table.AA_B.XU) {
    throw new Error(
      `P-COLL FAILED — the on-chain circuit reads (${onChainXS.value} / ${onChainXU.value}) disagree with ledger ` +
        `state (${afterUnshieldedWithdraw.table.AA_B.XS} / ${afterUnshieldedWithdraw.table.AA_B.XU})`,
    );
  }
  if (onChainXS.value === onChainXU.value) {
    throw new Error('P-COLL FAILED — the two families answered the SAME value; the fixture proves nothing');
  }

  const pcoll = {
    collidingColour: X.hex,
    issuer: tokx.label,
    issuerAddress: tokx.address,
    familyKeysForAA_B: { shielded: keyS, unshielded: keyU, differ: keyS !== keyU },
    afterBothDeposits: {
      pool: String(poolX),
      contractLedgerBalance: String(ledgerX),
      'AA_B shielded cell': String(cellS),
      'AA_B unshielded cell': String(cellU),
      mapSizes: bothDeposited.sizes,
    },
    afterIndependentWithdrawals: {
      pool: String(afterUnshieldedWithdraw.custody.XS),
      contractLedgerBalance: String(afterUnshieldedWithdraw.custody.XU),
      'AA_B shielded cell': String(afterUnshieldedWithdraw.table.AA_B.XS),
      'AA_B unshielded cell': String(afterUnshieldedWithdraw.table.AA_B.XU),
      'OwnerM holds, per family': `shielded ${afterUnshieldedWithdraw.table.OwnerM.XS}, unshielded ${afterUnshieldedWithdraw.table.OwnerM.XU}`,
    },
    onChainCircuitReads: {
      note:
        'the SAME 32-byte colour argument, handed to two circuits on the deployed Manager — a proved ' +
        'transaction each, independent of the state decode',
      'shieldedAccountBalance(AA_B, X)': String(onChainXS.value),
      'unshieldedAccountBalance(AA_B, X)': String(onChainXU.value),
      txs: [onChainXS.txish, onChainXU.txish],
    },
    txs: pcollTxs,
  };
  h.cell({
    id: 'P-COLL',
    label: 'P-COLL — one byte-identical colour, both families, tracked independently',
    step: 'probe',
    txs: pcollTxs,
    level: 'SDK',
    points:
      `same 32 bytes (${X.hex.slice(0, 16)}…): pool = 3 while the contract's unshielded ledger balance = 2, ` +
      'under two DIFFERENT key domains; one unit withdrawn from each side left the other side byte-identical; ' +
      `and two ON-CHAIN circuit calls taking the IDENTICAL colour argument answered ${onChainXS.value} ` +
      `(shielded) vs ${onChainXU.value} (unshielded)`,
    status: 'GREEN',
    evidence: 'evidence/g3-ledger/probes.json',
    note:
      'G2 proved the fixture COMPILES, DEPLOYS and reads back byte-identical. This is its TOKEN half: the ' +
      'colour is actually minted, deposited, custodied and spent in both families.',
  });

  // =============================================================================================
  // M3 — atomic double lazy-init (FR-207, decision D-203)
  // =============================================================================================
  console.log('\n## M3 — first deposits of TWO brand-new colours in ONE transaction');
  const S5 = colour('S5');
  const U5 = colour('U5');
  const m3Txs: string[] = [];
  m3Txs.push(h.tx(await mintShieldedToUser(ctx, 'Minter5', 3n, rig.observers.OwnerM, rig.fee)));
  h.minted.S5 = (h.minted.S5 ?? 0n) + 3n;
  m3Txs.push(h.tx(await mintUnshieldedToUser(ctx, 'Minter5', 3n, rig.addresses.OwnerM, rig.fee)));
  h.minted.U5 = (h.minted.U5 ?? 0n) + 3n;
  h.expect((e) => {
    e.table.OwnerM.S5 = 3n;
    e.table.OwnerM.U5 = 3n;
  });
  const beforeM3 = await h.assertNow('M3 mints (S5 3 and U5 3 to OwnerM)');

  // Both colours must be BRAND NEW to the Manager, or "double lazy-init" would be a misnomer.
  const brandNew = {
    'pool for S5 exists': String(Boolean(beforeM3.manager.pools[S5.hex.toLowerCase()])),
    '(AA_B,S5) cell exists': String(beforeM3.manager.shieldedBalances[shieldedKeyOf(raw.AA_B, S5.raw)] !== undefined),
    '(AA_B,U5) cell exists': String(beforeM3.manager.unshieldedBalances[unshieldedKeyOf(raw.AA_B, U5.raw)] !== undefined),
    'kernel holds U5': String(beforeM3.manager.kernelUnshielded[U5.hex.toLowerCase()] !== undefined),
    mapSizesBefore: JSON.stringify(beforeM3.sizes),
  };
  if (Object.entries(brandNew).some(([k, v]) => k !== 'mapSizesBefore' && v !== 'false')) {
    throw new Error(`M3 precondition FAILED — S5/U5 are not brand new: ${JSON.stringify(brandNew)}`);
  }

  const legs: DoubleLazyInitLegs = {
    shieldedColour: S5.raw,
    shieldedValue: 3n,
    unshieldedColour: U5.raw,
    unshieldedAmount: 3n,
    accountId: raw.AA_B,
  };
  // BOTH legs, per F-107: a wallet that cannot yet see the second leg's funds does not fail loudly
  // — it balances into a transaction the node refuses with a bare `Custom error: 223`.
  const legsVisible: Requirement[] = [
    { colour: S5.hex, shielded: true, amount: 3n },
    { colour: U5.hex, shielded: false, amount: 3n },
  ];

  // --- the COMPOSITION half, attempted twice on FRESH wallets ------------------------------------
  // Two attempts, because one cannot distinguish "the ledger refuses this composition" from "this
  // wallet was not ready" — the exact ambiguity F-107 describes, and the reason 00004's probe M1
  // retried here too. Each attempt gets its own fresh spender.
  const m3Attempts: DoubleLazyInitAttempt[] = [];
  let composedTxId: string | undefined;
  let composedNonce: string | undefined;
  for (let tryNo = 1; tryNo <= 2 && !composedTxId; tryNo++) {
    const r = await h.withSpender(
      'OwnerM',
      `m3-compose-try${tryNo}`,
      (s) => tryScopedDoubleDeposit(ctx, s.party, s.managerProviders, legs),
      legsVisible,
    );
    m3Attempts.push({ shape: SDK_SCOPED, attempt: tryNo, ok: r.ok, ...(r.ok ? {} : { error: r.error }) });
    if (r.ok) {
      composedTxId = r.txId;
      composedNonce = r.nonce;
      log(`  M3 composition ACCEPTED on attempt ${tryNo}: ONE transaction ${r.txId}`);
    } else {
      log(`  M3 composition attempt ${tryNo} REFUSED — verbatim: ${r.error}`);
    }
  }

  // A refused composition must also have created NOTHING. If it had partially landed, the
  // FR-207 fallback below would double-credit and the state assertion would fail — but proving it
  // directly is cheaper to read than inferring it from a later failure.
  let refusalStateNeutral: string | undefined;
  if (!composedTxId) {
    await new Promise((r) => setTimeout(r, 12_000));
    const afterRefusal = await observe(h.rig.deps);
    refusalStateNeutral =
      JSON.stringify(afterRefusal.sizes) === JSON.stringify(beforeM3.sizes)
        ? `yes — map sizes ${JSON.stringify(afterRefusal.sizes)} unchanged across the refusal`
        : `NO — map sizes ${JSON.stringify(beforeM3.sizes)} -> ${JSON.stringify(afterRefusal.sizes)}`;
    log(`  refused composition created no state: ${refusalStateNeutral}`);
    if (refusalStateNeutral.startsWith('NO')) {
      throw new Error(`M3 FAILED — a REFUSED composition changed custody state: ${refusalStateNeutral}`);
    }
  }

  // --- FR-207's fallback, applied only if the composition never landed ---------------------------
  const m3 = composedTxId
    ? { txIds: [composedTxId], shape: SDK_SCOPED, shieldedNonce: composedNonce! }
    : await (async () => {
        console.log("  applying FR-207's fallback: proving lazy-init with SEPARATE transactions");
        const fb = await h.withSpender(
          'OwnerM',
          'm3-fallback',
          (s) => separateDoubleDeposit(ctx, s.party, s.managerProviders, legs),
          legsVisible,
        );
        m3Attempts.push({ shape: SEPARATE_TXS, attempt: m3Attempts.length + 1, ok: true });
        return { txIds: fb.txIds, shape: SEPARATE_TXS, shieldedNonce: fb.nonce };
      })();

  for (const id of m3.txIds) h.tx(id);
  h.expect((e) => {
    e.table.OwnerM.S5 = 0n;
    e.table.AA_B.S5 = 3n;
    e.custody.S5 = 3n;
    e.table.OwnerM.U5 = 0n;
    e.table.AA_B.U5 = 3n;
    e.custody.U5 = 3n;
    e.sizes.pools += 1;
    e.sizes.shieldedCells += 1;
    e.sizes.unshieldedCells += 1;
  });
  const afterM3 = await h.assertNow('M3 double lazy-init');

  // The second observation point for the lazy-init half: real on-chain circuit calls for both of
  // the brand-new colours.
  const onChainS5 = await onChainBalance(rig, 'shielded', raw.AA_B, S5.raw, 'AA_B, S5');
  const onChainU5 = await onChainBalance(rig, 'unshielded', raw.AA_B, U5.raw, 'AA_B, U5');
  for (const id of [onChainS5.txish, onChainU5.txish]) if (id) h.tx(id);
  log(`  ON-CHAIN: shieldedAccountBalance(AA_B, S5) = ${onChainS5.value}, unshieldedAccountBalance(AA_B, U5) = ${onChainU5.value}`);
  if (onChainS5.value !== afterM3.table.AA_B.S5 || onChainU5.value !== afterM3.table.AA_B.U5) {
    throw new Error(
      `M3 FAILED — on-chain reads (${onChainS5.value} / ${onChainU5.value}) disagree with ledger state ` +
        `(${afterM3.table.AA_B.S5} / ${afterM3.table.AA_B.U5})`,
    );
  }

  const composed = m3.shape === SDK_SCOPED && m3.txIds.length === 1;
  const firstRefusal = m3Attempts.find((a) => !a.ok)?.error;
  log(`  M3 shape: ${m3.shape}; transaction id(s): ${m3.txIds.join(', ')}`);
  log(
    `  map sizes ${JSON.stringify(beforeM3.sizes)} -> ${JSON.stringify(afterM3.sizes)} ` +
      `(one new pool + one new shielded cell + one new unshielded cell)`,
  );

  h.cell({
    id: 'M3-lazy-init',
    label: 'M3 — first deposits of TWO brand-new colours create exactly one pool and two cells',
    step: 'probe',
    txs: m3.txIds,
    level: 'SDK',
    points:
      `map sizes ${JSON.stringify(beforeM3.sizes)} -> ${JSON.stringify(afterM3.sizes)}; poolS5 = 3, ` +
      `(AA_B,S5) = 3, (AA_B,U5) = 3, the contract's unshielded ledger balance for U5 = 3; confirmed a second ` +
      `way by on-chain circuit calls (${onChainS5.value} / ${onChainU5.value})`,
    status: 'GREEN',
    evidence: 'evidence/g3-ledger/probes.json',
    note: 'This half is INDEPENDENT of the composition half below, per FR-207.',
  });
  h.cell({
    id: 'M3-composition',
    label: 'M3 — BOTH first deposits under ONE transaction id (FR-207, decision D-203)',
    step: 'probe',
    txs: m3.txIds,
    level: 'SDK',
    points: composed
      ? `ONE transaction id ${m3.txIds[0]} carries depositShielded(S5) + depositUnshielded(U5); shape: ${m3.shape}`
      : `composition REFUSED on ${m3Attempts.filter((a) => !a.ok).length} attempt(s), each on a FRESH wallet that ` +
        `could see both legs; ${m3.txIds.length} separate transactions were used instead (FR-207 fallback), and ` +
        `the refused composition created no state (${refusalStateNeutral})`,
    status: composed ? 'GREEN' : 'RECORDED',
    evidence: 'evidence/g3-ledger/probes.json',
    note: composed
      ? `D-203 RESOLVED: ${m3.shape}. The one-ledger-Intent shape was not re-attempted — 00004's probe M1 ` +
        'already recorded its refusal verbatim on this lane (the 223 same-address rule), and D-203 names the ' +
        'scoped batch as the proven legal composition.'
      : `D-203 RESOLVED THE OTHER WAY: the SDK scoped batch — the shape 00004's probe M1 landed — is REFUSED ` +
        `for TWO FIRST CREDITS. Verbatim: ${firstRefusal ?? '(none recorded)'}. FR-207's fallback was applied: ` +
        'lazy-init proven with SEPARATE transactions and reported as its own checklist row, never conflated ' +
        'with this one.',
  });

  const results: ProbeResults = {
    distinctness: {
      comparisons,
      distinct,
      collisions,
      colours: Object.fromEntries(tenColours),
      collider: {
        shielded: tokx.shieldedColour,
        unshielded: tokx.unshieldedColour,
        byteIdentical: colliderEqual,
        contaminates,
      },
      ok: distinctnessOk,
    },
    pcoll,
    m3: {
      issuer: toke.label,
      issuerAddress: toke.address,
      S5: S5.hex,
      U5: U5.hex,
      brandNewBefore: brandNew,
      shape: m3.shape,
      txIds: m3.txIds,
      shieldedNonce: m3.shieldedNonce,
      circuits: ['depositShielded', 'depositUnshielded'],
      attempts: m3Attempts,
      composedInOneTransaction: composed,
      refusedCompositionCreatedNoState: refusalStateNeutral ?? '(the composition was accepted)',
      onChainCircuitReads: {
        'shieldedAccountBalance(AA_B, S5)': String(onChainS5.value),
        'unshieldedAccountBalance(AA_B, U5)': String(onChainU5.value),
        txs: [onChainS5.txish, onChainU5.txish],
      },
      mapSizesBefore: beforeM3.sizes,
      mapSizesAfter: afterM3.sizes,
      decisionD203: composed
        ? 'RESOLVED — SDK contract-scoped batch; one transaction id carried both first deposits'
        : 'RESOLVED — the SDK scoped batch is REFUSED for two FIRST CREDITS on this lane; FR-207 fallback ' +
          'taken, with the verbatim refusal recorded and the lazy-init half proven separately',
    },
  };

  writeFileSync(
    join(h.evidenceDir, 'probes.json'),
    `${JSON.stringify({ label: 'EXPERIMENTAL_LANE / LANE-DEV-1', utc: stamp(), ...results }, bigints, 2)}\n`,
  );
  return results;
};
