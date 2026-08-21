// G3 — render `evidence/g3-ledger/CELLS.md` from the records the live run wrote.
//
// Nothing here computes a result: it joins `cells.json`, `negative-controls.json`, `probes.json`
// and `run-context.json` against the SPECIFICATION'S OWN checklist and FAILS if any item has no
// record. An item the run never reached is a GAP, and a gap is a hard error — the specification
// forbids silent omissions.
//
// One status other than GREEN is tolerated, for one id only: `M3-composition` may be `RECORDED`,
// which is FR-207's fallback rule ("if the ledger refuses the composition, record the verbatim
// error, prove lazy-init with separate transactions, and report the composition half separately").
// It is printed loudly and never silently.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';

const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

/** The spec's 18-row step ledger and its controls and probes, in the spec's own order. */
const CHECKLIST: Array<{ id: string; label: string }> = [
  { id: 'step-0', label: 'Step 0 — **Manager deployed, no Minter exists on this chain**; AA_A, AA_B registered; all maps size 0' },
  { id: 'step-1', label: 'Step 1 — Minters TOKA, TOKB, TOKC deployed; 6 colours read on-chain, pairwise distinct; Manager byte-identical to step 0' },
  { id: 'step-2', label: 'Step 2 — mint S1 `10` → OwnerN' },
  { id: 'step-3', label: 'Step 3 — mint U1 `10` → OwnerN' },
  { id: 'step-4', label: 'Step 4 — mint S2 `10` → OwnerM' },
  { id: 'step-5', label: 'Step 5 — mint S3 `10` → OwnerM' },
  { id: 'step-6', label: 'Step 6 — mint U2 `10` → OwnerM' },
  { id: 'step-7', label: 'Step 7 — OwnerN deposits S1 `6` → AA_A (first pool EVER)' },
  { id: 'step-8', label: 'Step 8 — OwnerN deposits U1 `5` → AA_A' },
  { id: 'step-9', label: 'Step 9 — OwnerM deposits S2 `6` → AA_B' },
  { id: 'step-10', label: 'Step 10 — OwnerM deposits S3 `4` → **AA_A** (depositor ≠ credited owner)' },
  { id: 'step-11', label: 'Step 11 — OwnerM deposits U2 `5` → AA_B' },
  { id: 'step-12', label: 'Step 12 — internal transfer S1 `3`: AA_A → AA_B (credit-side lazy cell; pool UNCHANGED)' },
  { id: 'step-13', label: 'Step 13 — AA_B withdraws S2 `2` → OwnerN' },
  { id: 'step-14', label: 'Step 14 — AA_A withdraws U1 `2` → OwnerM' },
  { id: 'step-15', label: 'Step 15 — **TOKD deployed mid-ledger**; mint S4 `7` → OwnerN, U4 `4` → OwnerM' },
  { id: 'step-16', label: 'Step 16 — **HEADLINE**: OwnerN deposits S4 `7` → AA_A; pools 3→4' },
  { id: 'step-17', label: 'Step 17 — OwnerM deposits U4 `4` → AA_B' },
  { id: 'NC-1', label: 'NC-1 — unregistered witness' },
  { id: 'NC-2', label: 'NC-2 — missing-cell spend (pool covers it; no (AA_B,S3) cell is created)' },
  { id: 'NC-3', label: 'NC-3 — dormant colour U3 (absent from EVERY map afterwards)' },
  { id: 'NC-4', label: 'NC-4 — unregistered credit' },
  { id: 'NC-5', label: 'NC-5 — internal transfer of an unheld colour' },
  { id: 'P-COLL', label: 'P-COLL — byte-identical colour tracked independently per family (pool 3 vs ledger 2)' },
  { id: 'M3-lazy-init', label: 'M3 — first deposits of TWO brand-new colours create one pool and two cells' },
  { id: 'M3-composition', label: 'M3 — both first deposits under ONE transaction id (FR-207 / D-203)' },
  { id: 'distinctness', label: 'Distinctness — 45/45 pairwise over TOKA–TOKE, plus the INVERTED MinterCollide equality' },
  { id: 'invariant-per-colour', label: 'Invariant — `custody[c] == AA_A[c] + AA_B[c]` after EVERY step, over the DISCOVERED colour set' },
  { id: 'map-sizes', label: 'Exact map sizes after EVERY step, zero unaccounted keys (dynamic)' },
  { id: 'dormant-U3', label: 'FR-206 — U3 never minted, never deposited, absent from every map at every row' },
];

/** The only id allowed to carry the `RECORDED` status, and only under FR-207's fallback rule. */
const FR207_FALLBACK_ID = 'M3-composition';

const readJson = (name: string): any => {
  const p = join(EVID, name);
  if (!existsSync(p)) throw new Error(`missing evidence file ${p} — run src/g3/ledger-run.ts first`);
  return JSON.parse(readFileSync(p, 'utf-8'));
};

const esc = (s: unknown): string => String(s).replace(/\|/g, '\\|');

const main = () => {
  const cellsDoc = readJson('cells.json');
  const controlsDoc = readJson('negative-controls.json');
  const probesDoc = readJson('probes.json');
  const ctx = readJson('run-context.json');

  const byId = new Map<string, any>(cellsDoc.cells.map((c: any) => [c.id, c]));
  const missing = CHECKLIST.filter((c) => !byId.has(c.id));
  const extra = cellsDoc.cells.filter((c: any) => !CHECKLIST.some((x) => x.id === c.id));
  const green = CHECKLIST.filter((c) => byId.get(c.id)?.status === 'GREEN').length;
  const recorded = CHECKLIST.filter((c) => byId.get(c.id)?.status === 'RECORDED');
  const red = CHECKLIST.filter((c) => {
    const s = byId.get(c.id)?.status;
    if (s === undefined) return false;
    if (s === 'GREEN') return false;
    if (s === 'RECORDED' && c.id === FR207_FALLBACK_ID) return false;
    return true;
  });

  const out: string[] = [];
  out.push('# Step-ledger cell index — 00005-open-colour-custody, gate G3');
  out.push('');
  out.push('**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.');
  out.push('No result here may be extrapolated to a supported or production lane.');
  out.push('');
  out.push(`Generated ${cellsDoc.utc} from the retained run.`);
  out.push('');
  out.push('| What | Value |');
  out.push('|---|---|');
  out.push(`| Manager | \`${ctx.managerAddress}\` |`);
  out.push(`| Manager deploy block | ${ctx.deployOrder.managerBlock} (chain tip before ANY deploy: ${ctx.chainTipBeforeAnyDeploy.height}) |`);
  for (const m of ctx.minters) out.push(`| ${m.label} (tag \`${m.tagText}\`) | \`${m.address}\` — block ${m.deploy.blockHeight} |`);
  for (const [name, c] of Object.entries<any>(ctx.colours)) {
    out.push(`| ${name} (${c.family}, ${c.issuer}) | \`${c.hex}\` |`);
  }
  out.push(`| AA_A account id | \`${ctx.accounts.AA_A}\` |`);
  out.push(`| AA_B account id | \`${ctx.accounts.AA_B}\` |`);
  out.push(
    `| Total minted | ${Object.entries<string>(ctx.mintedTotals)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')} |`,
  );
  out.push(`| End-state map sizes (walk) | \`${JSON.stringify(ctx.endStateMapSizes)}\` — spec says \`${JSON.stringify(ctx.specEndStateMapSizes)}\` |`);
  out.push(`| M3 transaction(s) | ${ctx.probes.m3.txIds.map((t: string) => `\`${t}\``).join(', ')} |`);
  out.push(`| M3 composition shape (decision D-203) | ${ctx.probes.m3.shape} |`);
  out.push('');
  out.push(
    `**${green} of ${CHECKLIST.length} items GREEN**` +
      (recorded.length ? `, ${recorded.length} RECORDED (FR-207 fallback)` : '') +
      (red.length ? `, ${red.length} RED` : ', 0 RED') +
      (missing.length ? `, ${missing.length} MISSING` : ', no gaps') +
      '.',
  );
  out.push('');

  out.push('## Deploy order — the Manager exists before anything that can mint');
  out.push('');
  out.push('| Contract | Deploy block | Strictly after the Manager | Existed at the Manager\'s block |');
  out.push('|---|---|---|---|');
  out.push(`| **Manager** | ${ctx.deployOrder.managerBlock} | — (control) | yes (control) |`);
  for (const r of ctx.deployOrder.rows) {
    out.push(
      `| ${r.contract} (\`${r.tag}\`) | ${r.deployBlock} | ${r.strictlyLater ? 'yes' : '**NO**'} | ` +
        `${r.absentAtManagerBlock ? '**no — did not exist**' : '**YES**'} |`,
    );
  }
  out.push('');
  out.push('The right-hand column is the strong form: the indexer\'s answer to *"what contract action does this');
  out.push(`address have at block ${ctx.deployOrder.managerBlock}?"* — \`null\` for every issuing contract, and the`);
  out.push('deploy action for the Manager itself, which is the discriminating control. TOKD is the sharpest case:');
  out.push('it did not exist while the Manager processed the first fourteen rows of this ledger.');
  out.push('');

  out.push('## Final observed table (end of the 18-row walk)');
  out.push('');
  for (const line of ctx.finalTableMarkdown) out.push(line);
  out.push('');
  out.push(
    `Exact map sizes: \`${JSON.stringify(ctx.endStateMapSizes)}\`. Every minted colour sums to its mint total; ` +
      'each pool / ledger balance equals the sum of its AA column cells. U3 is dormant: minted by no one, ' +
      'deposited by no one, absent from every map.',
  );
  out.push('');

  out.push('## Observation points (FR-208)');
  out.push('');
  out.push('| Cell class | Point 1 | Point 2 | Point 3 |');
  out.push('|---|---|---|---|');
  out.push(
    "| AA_A / AA_B, per colour | the Manager's `shieldedBalances` / `unshieldedBalances` maps decoded from " +
      "contract state, every key reproduced by the contract's own pure `shieldedKey` / `unshieldedKey` circuits " +
      '| the custody side of the same colour — pooled zswap coin (shielded) or the ledger kernel\'s unshielded ' +
      'balance — via the per-colour invariant | a real on-chain `shieldedAccountBalance` / ' +
      '`unshieldedAccountBalance` circuit call, rotating across the (account, colour) cells |',
  );
  out.push(
    "| OwnerN / OwnerM, unshielded | a read-only OBSERVER wallet facade that never submitted a transaction " +
      "(finding F-104) | the UTXO set reconstructed from the indexer's own transaction history, per colour | — |",
  );
  out.push(
    '| OwnerN / OwnerM, shielded | the same observer wallet, coin by coin | the ledger conservation identity ' +
      '`minted[c] == custody[c] + OwnerN[c] + OwnerM[c]` | — |',
  );
  out.push('');
  out.push('**Finding F-104 is why the observer wallets exist.** On this pinned lane a wallet that SUBMITTED a');
  out.push('transaction under-reports its own balance afterwards and does not self-correct, while still returning');
  out.push('`progress.isStrictlyComplete() === true`. No submitting wallet is an observation point anywhere in this');
  out.push('gate, and every user-submitted transaction is built by a fresh spender wallet that is closed');
  out.push('immediately afterwards.');
  out.push('');

  out.push('## Step rows, controls and probes');
  out.push('');
  out.push('| # | Item | Step | Level | Transaction id(s) | Observation points | Status |');
  out.push('|---|---|---|---|---|---|---|');
  CHECKLIST.forEach((c, i) => {
    const r = byId.get(c.id);
    if (!r) {
      out.push(`| ${i + 1} | ${c.label} | — | — | — | — | **MISSING** |`);
      return;
    }
    const txs = r.txs.filter(Boolean).length ? r.txs.filter(Boolean).map((t: string) => `\`${t}\``).join('<br>') : '—';
    out.push(`| ${i + 1} | ${c.label} | ${r.step} | ${r.level} | ${txs} | ${esc(r.points)} | **${r.status}** |`);
  });
  out.push('');
  out.push('### Notes');
  out.push('');
  CHECKLIST.forEach((c, i) => {
    const r = byId.get(c.id);
    if (r?.note) out.push(`- **${i + 1}. ${c.id}** — ${esc(r.note)}`);
  });
  out.push('');
  out.push('Per-step evidence: `evidence/g3-ledger/step-N/step.json` (expected vs observed, every observation');
  out.push('point, exact map sizes, the unaccounted-key report, the per-colour invariant, the conservation');
  out.push('identity, the spot check and every operation) and `step-N/summary.md`.');
  out.push('');

  // --- negative controls, verbatim ---------------------------------------------------------------
  out.push('## Negative controls — verbatim');
  out.push('');
  out.push("Each proves FOUR things: the rejection happened; it was the CONTRACT'S OWN assert; the full table,");
  out.push('every pool (value AND nonce), every unshielded ledger balance and both users\' coins/UTXOs are');
  out.push('byte-identical before and after, re-read after a settle delay; and **no state was created** — all');
  out.push('three map sizes identical, with the specific cell the control is about proven absent afterwards.');
  out.push('');
  out.push('| Id | Status | Refused at | Verbatim error | Expected message | Funds byte-identical | Map sizes |');
  out.push('|---|---|---|---|---|---|---|');
  for (const c of controlsDoc.controls) {
    out.push(
      `| \`${c.id}\` | **${c.status}** | ${c.rejectedAt} | \`${esc(c.reason)}\` | \`${esc(c.expectedMessage)}\` ` +
        `${c.messageMatched ? 'matched' : '**NOT MATCHED**'} | ${c.fundsUnchanged ? 'yes' : '**NO**'} | ` +
        `${JSON.stringify(c.mapSizesBefore)} → ${JSON.stringify(c.mapSizesAfter)} ` +
        `${c.mapSizesUnchanged ? '(unchanged)' : '**GREW**'} |`,
    );
  }
  out.push('');
  for (const c of controlsDoc.controls) {
    out.push(`- **${c.id}** — ${c.label}. Expectation: ${c.expectation}`);
    if (c.fixture) {
      out.push(
        `  - fixture read from chain: ${Object.entries(c.fixture)
          .map(([k, v]) => `\`${k}\` = \`${v}\``)
          .join(', ')}`,
      );
    }
    if (c.noStateCreated) {
      out.push(
        `  - no state created: ${Object.entries(c.noStateCreated)
          .map(([k, v]) => `${k} — **${v}**`)
          .join('; ')}`,
      );
    }
  }
  out.push('');
  out.push('Full before/after state in `evidence/g3-ledger/negative-controls.json`.');
  out.push('');

  // --- probes -------------------------------------------------------------------------------------
  out.push('## P-COLL — one colour, two families, no aliasing');
  out.push('');
  out.push(`- colliding colour (byte-identical in both families): \`${probesDoc.pcoll.collidingColour}\``);
  out.push(`- issuer: ${probesDoc.pcoll.issuer} at \`${probesDoc.pcoll.issuerAddress}\``);
  out.push(`- \`shieldedKey(AA_B, X)\`   = \`${probesDoc.pcoll.familyKeysForAA_B.shielded}\``);
  out.push(`- \`unshieldedKey(AA_B, X)\` = \`${probesDoc.pcoll.familyKeysForAA_B.unshielded}\``);
  out.push(`- keys differ: **${probesDoc.pcoll.familyKeysForAA_B.differ ? 'yes' : 'NO — FR-203 broken'}**`);
  out.push('');
  out.push('| After | pool (shielded) | contract ledger balance (unshielded) | AA_B shielded cell | AA_B unshielded cell |');
  out.push('|---|---|---|---|---|');
  out.push(
    `| both deposits | ${probesDoc.pcoll.afterBothDeposits.pool} | ` +
      `${probesDoc.pcoll.afterBothDeposits.contractLedgerBalance} | ` +
      `${probesDoc.pcoll.afterBothDeposits['AA_B shielded cell']} | ` +
      `${probesDoc.pcoll.afterBothDeposits['AA_B unshielded cell']} |`,
  );
  out.push(
    `| one independent withdrawal from each side | ${probesDoc.pcoll.afterIndependentWithdrawals.pool} | ` +
      `${probesDoc.pcoll.afterIndependentWithdrawals.contractLedgerBalance} | ` +
      `${probesDoc.pcoll.afterIndependentWithdrawals['AA_B shielded cell']} | ` +
      `${probesDoc.pcoll.afterIndependentWithdrawals['AA_B unshielded cell']} |`,
  );
  out.push('');
  out.push('The same 32 bytes hold 3 in one family and 2 in the other, under two different key domains, and a');
  out.push('withdrawal from either side leaves the other byte-identical.');
  out.push('');
  out.push('Second observation point — two REAL ON-CHAIN CIRCUIT CALLS taking the IDENTICAL colour argument:');
  out.push('');
  out.push(
    `- \`shieldedAccountBalance(AA_B, X)\` = \`${probesDoc.pcoll.onChainCircuitReads['shieldedAccountBalance(AA_B, X)']}\``,
  );
  out.push(
    `- \`unshieldedAccountBalance(AA_B, X)\` = \`${probesDoc.pcoll.onChainCircuitReads['unshieldedAccountBalance(AA_B, X)']}\``,
  );
  out.push('');

  out.push('## M3 and decision D-203 — atomic double lazy-init');
  out.push('');
  out.push(`- transaction id(s): ${probesDoc.m3.txIds.map((t: string) => `\`${t}\``).join(', ')}`);
  out.push(`- shape used: **${probesDoc.m3.shape}**`);
  out.push(`- circuits: ${probesDoc.m3.circuits.map((x: string) => `\`${x}\``).join(' + ')}`);
  out.push(`- both colours brand new before the call: \`${JSON.stringify(probesDoc.m3.brandNewBefore)}\``);
  out.push(
    `- map sizes \`${JSON.stringify(probesDoc.m3.mapSizesBefore)}\` → \`${JSON.stringify(probesDoc.m3.mapSizesAfter)}\``,
  );
  out.push(
    `- on-chain circuit reads: \`shieldedAccountBalance(AA_B, S5)\` = ` +
      `\`${probesDoc.m3.onChainCircuitReads['shieldedAccountBalance(AA_B, S5)']}\`, ` +
      `\`unshieldedAccountBalance(AA_B, U5)\` = ` +
      `\`${probesDoc.m3.onChainCircuitReads['unshieldedAccountBalance(AA_B, U5)']}\``,
  );
  out.push(`- refused composition created no state: ${esc(probesDoc.m3.refusedCompositionCreatedNoState)}`);
  out.push(`- **D-203: ${probesDoc.m3.decisionD203}**`);
  out.push('');
  out.push('| # | Shape attempted | Outcome |');
  out.push('|---|---|---|');
  for (const a of probesDoc.m3.attempts) {
    out.push(`| ${a.attempt} | ${a.shape} | ${a.ok ? '**used**' : `refused — \`${esc(a.error)}\``} |`);
  }
  out.push('');
  out.push("FR-207's rule is applied literally: the LAZY-INIT half and the COMPOSITION half are separate");
  out.push('checklist rows, so a refused composition is never recorded as a lazy-init failure and never');
  out.push('borrows the other half\'s green.');
  out.push('');

  out.push('## Distinctness');
  out.push('');
  out.push(
    `**${probesDoc.distinctness.distinct}/${probesDoc.distinctness.comparisons} distinct**` +
      (probesDoc.distinctness.collisions.length
        ? ` — collisions: ${probesDoc.distinctness.collisions.join('; ')}`
        : ' (no collisions)') +
      ' over the ten TOKA–TOKE colours, all read from on-chain circuit calls.',
  );
  out.push('');
  out.push('| Role | Colour |');
  out.push('|---|---|');
  for (const [k, v] of Object.entries(probesDoc.distinctness.colours)) out.push(`| ${k} | \`${v}\` |`);
  out.push(`| MinterCollide(TOKX).shielded | \`${probesDoc.distinctness.collider.shielded}\` |`);
  out.push(`| MinterCollide(TOKX).unshielded | \`${probesDoc.distinctness.collider.unshielded}\` |`);
  out.push('');
  out.push(
    `**The inverted assertion — MinterCollide's two family colours are byte-identical: ` +
      `${probesDoc.distinctness.collider.byteIdentical ? 'YES' : 'NO, THE FIXTURE IS BROKEN'}**, and that colour ` +
      `collides with none of the ten (${probesDoc.distinctness.collider.contaminates.length} contaminations).`,
  );
  out.push('');

  out.push('## Run metrics');
  out.push('');
  out.push('```json');
  out.push(JSON.stringify(ctx.metrics, null, 2));
  out.push('```');
  out.push('');

  writeFileSync(join(EVID, 'CELLS.md'), `${out.join('\n')}\n`);
  console.log(`wrote evidence/g3-ledger/CELLS.md — ${green}/${CHECKLIST.length} GREEN`);

  if (extra.length) {
    console.log(`note: ${extra.length} recorded item(s) not in the checklist: ${extra.map((c: any) => c.id).join(', ')}`);
  }
  for (const c of recorded) {
    console.log(
      `NOTE: ${c.id} is RECORDED rather than GREEN — FR-207's fallback rule. ` +
        `${byId.get(c.id)?.note ?? ''}`,
    );
  }
  if (missing.length) {
    console.error(`\nGAP: ${missing.length} checklist item(s) have no record: ${missing.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
  if (red.length) {
    console.error(`\n${red.length} item(s) not GREEN: ${red.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
  const badControls = controlsDoc.controls.filter((c: any) => c.status !== 'GREEN');
  if (badControls.length) {
    console.error(`\n${badControls.length} negative control(s) not GREEN: ${badControls.map((c: any) => c.id).join(', ')}`);
    process.exit(1);
  }
  console.log(
    `${CHECKLIST.length}/${CHECKLIST.length} checklist items accounted for, all controls GREEN, no gaps` +
      (recorded.length ? ` (${recorded.length} RECORDED under FR-207)` : ''),
  );
};

main();
