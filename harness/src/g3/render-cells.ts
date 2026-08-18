// G3 — render `evidence/g3-ledger/CELLS.md` from the records the live run wrote.
//
// Nothing here computes a result: it joins `cells.json`, `negative-controls.json` and
// `run-context.json` against the spec's own checklist and FAILS if any item has no record. An item
// the run never reached is a GAP, and a gap is a hard error — the specification forbids silent
// omissions.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';

const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

/** The spec's step ledger and its controls, in the spec's own order and wording. */
const CHECKLIST: Array<{ id: string; label: string }> = [
  { id: 'step-0', label: 'Step 0 — baseline: all 16 cells 0; no pools; no contract balances' },
  { id: 'step-1', label: 'Step 1 — Minter1 mints S1 `10` → OwnerN' },
  { id: 'step-2', label: 'Step 2 — Minter1 mints U1 `10` → OwnerN' },
  { id: 'step-3', label: 'Step 3 — Minter2 mints S2 `10` → OwnerM' },
  { id: 'step-4', label: 'Step 4 — Minter2 mints U2 `10` → OwnerM' },
  { id: 'step-5', label: 'Step 5 — OwnerN deposits S1 `6` → AA_A' },
  { id: 'step-6', label: 'Step 6 — OwnerN deposits U1 `5` → AA_A' },
  { id: 'step-7', label: 'Step 7 — OwnerM deposits S2 `6` → AA_B' },
  { id: 'step-8', label: 'Step 8 — OwnerM deposits U2 `5` → AA_B' },
  { id: 'step-9', label: 'Step 9 — internal transfer S1 `3`: AA_A → AA_B (pool UNCHANGED)' },
  { id: 'step-10', label: 'Step 10 — internal transfer U2 `2`: AA_B → AA_A (ledger UNCHANGED)' },
  { id: 'step-11', label: 'Step 11 — AA_B withdraws S1 `3` → OwnerM' },
  { id: 'step-12', label: 'Step 12 — AA_A withdraws U2 `2` → OwnerN' },
  { id: 'step-13', label: 'Step 13 — M1: OwnerM deposits S2 `2` AND U2 `2` → AA_B in ONE transaction' },
  { id: 'M1', label: 'M1 — mixed-colour composition, both effects in ONE transaction id (FR-107)' },
  { id: 'NC-1', label: 'NC-1 — owner-only / unregistered witness' },
  { id: 'NC-2', label: 'NC-2 — owner-only / cross-account, with a pool that covers the request' },
  { id: 'NC-3', label: 'NC-3 — cross-colour / rich-in-X-broke-in-Y' },
  { id: 'NC-4a', label: 'NC-4a — wrong colour / unconfigured, NAMED (unshielded deposit)' },
  { id: 'NC-4b', label: 'NC-4b — wrong colour / unconfigured, CARRIED (a real Minter3 shielded coin)' },
  { id: 'NC-5', label: 'NC-5 — internal transfer colour guard' },
  { id: 'M2', label: 'M2 — mixed-colour atomicity negative: the whole transaction fails' },
  { id: 'distinctness', label: 'Distinctness — 15 pairwise comparisons over 6 colours, from on-chain reads' },
  { id: 'invariant-per-colour', label: 'Invariant — `custody[c] == AA_A[c] + AA_B[c]`, after EVERY step' },
  { id: 'enumeration', label: 'FR-105 exactness — `balances.size() == accounts x 4`, zero unaccounted keys, every step' },
];

const readJson = (name: string): any => {
  const p = join(EVID, name);
  if (!existsSync(p)) throw new Error(`missing evidence file ${p} — run src/g3/ledger-run.ts first`);
  return JSON.parse(readFileSync(p, 'utf-8'));
};

const main = () => {
  const cellsDoc = readJson('cells.json');
  const controlsDoc = readJson('negative-controls.json');
  const ctx = readJson('run-context.json');

  const byId = new Map<string, any>(cellsDoc.cells.map((c: any) => [c.id, c]));
  const missing = CHECKLIST.filter((c) => !byId.has(c.id));
  const extra = cellsDoc.cells.filter((c: any) => !CHECKLIST.some((x) => x.id === c.id));
  const green = CHECKLIST.filter((c) => byId.get(c.id)?.status === 'GREEN').length;
  const red = CHECKLIST.filter((c) => byId.has(c.id) && byId.get(c.id)?.status !== 'GREEN');

  const out: string[] = [];
  out.push('# Step-ledger cell index — 00004-multi-token-custody, gate G3');
  out.push('');
  out.push('**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.');
  out.push('No result here may be extrapolated to a supported or production lane.');
  out.push('');
  out.push(`Generated ${cellsDoc.utc} from the retained run.`);
  out.push('');
  out.push('| What | Value |');
  out.push('|---|---|');
  out.push(`| Manager | \`${ctx.managerAddress}\` |`);
  for (const m of ctx.minters) out.push(`| ${m.label} (tag \`${m.tagText}\`) | \`${m.address}\` |`);
  out.push(`| S1 (shielded, Minter1) | \`${ctx.colours.S1}\` |`);
  out.push(`| S2 (shielded, Minter2) | \`${ctx.colours.S2}\` |`);
  out.push(`| U1 (unshielded, Minter1) | \`${ctx.colours.U1}\` |`);
  out.push(`| U2 (unshielded, Minter2) | \`${ctx.colours.U2}\` |`);
  out.push(`| control, never configured (Minter3 shielded) | \`${ctx.controlColours.shielded}\` |`);
  out.push(`| control, never configured (Minter3 unshielded) | \`${ctx.controlColours.unshielded}\` |`);
  out.push(`| AA_A account id | \`${ctx.accounts.AA_A}\` |`);
  out.push(`| AA_B account id | \`${ctx.accounts.AA_B}\` |`);
  out.push(
    `| Total minted | S1 ${ctx.mintedTotals.S1}, S2 ${ctx.mintedTotals.S2}, U1 ${ctx.mintedTotals.U1}, U2 ${ctx.mintedTotals.U2} |`,
  );
  out.push(`| M1 transaction | \`${ctx.mixedColour.txId}\` |`);
  out.push(`| M1 composition shape (decision D-102) | ${ctx.mixedColour.shape} |`);
  out.push('');
  out.push(
    `**${green} of ${CHECKLIST.length} items GREEN**` +
      (red.length ? `, ${red.length} RED` : ', 0 RED') +
      (missing.length ? `, ${missing.length} MISSING` : ', no gaps') +
      '.',
  );
  out.push('');

  out.push('## Final observed table');
  out.push('');
  for (const line of ctx.finalTableMarkdown) out.push(line);
  out.push('');
  out.push('Every colour sums to 10 (= minted); each pool/ledger balance equals the sum of its AA column cells.');
  out.push('');

  out.push('## Observation points (FR-108)');
  out.push('');
  out.push('| Cell class | Point 1 | Point 2 | Point 3 |');
  out.push('|---|---|---|---|');
  out.push(
    '| AA_A / AA_B, per colour | the Manager `balances` map decoded from contract state, every key reproduced by the contract\'s own pure `balanceKey` circuit | the custody side of the same colour — pooled zswap coin (shielded) or the ledger kernel\'s unshielded balance — via the per-colour invariant | a real on-chain `accountBalance` circuit call, rotating across all eight AA cells |',
  );
  out.push(
    '| OwnerN / OwnerM, unshielded | a read-only OBSERVER wallet facade that never submitted a transaction (finding F-104) | the UTXO set reconstructed from the indexer\'s own transaction history, per colour | — |',
  );
  out.push(
    '| OwnerN / OwnerM, shielded | the same observer wallet, coin by coin | the ledger conservation identity `minted[c] == custody[c] + OwnerN[c] + OwnerM[c]` | — |',
  );
  out.push('');
  out.push(
    '**Finding F-104 is why the observer wallets exist.** On this pinned lane a wallet that SUBMITTED a',
  );
  out.push('transaction under-reports its own balance afterwards and does not self-correct, while still');
  out.push('returning `progress.isStrictlyComplete() === true`. No submitting wallet is an observation point');
  out.push('anywhere in this gate, and every user-submitted transaction is built by a fresh spender wallet');
  out.push('that is closed immediately afterwards.');
  out.push('');

  out.push('## Step rows, probes and controls');
  out.push('');
  out.push('| # | Item | Step | Level | Transaction id(s) | Observation points | Status |');
  out.push('|---|---|---|---|---|---|---|');
  CHECKLIST.forEach((c, i) => {
    const r = byId.get(c.id);
    if (!r) {
      out.push(`| ${i + 1} | ${c.label} | — | — | — | — | **MISSING** |`);
      return;
    }
    const txs = r.txs.length ? r.txs.map((t: string) => `\`${t}\``).join('<br>') : '—';
    out.push(`| ${i + 1} | ${c.label} | ${r.step} | ${r.level} | ${txs} | ${r.points} | **${r.status}** |`);
  });
  out.push('');
  out.push('### Notes');
  out.push('');
  CHECKLIST.forEach((c, i) => {
    const r = byId.get(c.id);
    if (r?.note) out.push(`- **${i + 1}. ${c.id}** — ${String(r.note).replace(/\|/g, '\\|')}`);
  });
  out.push('');
  out.push('Per-step evidence: `evidence/g3-ledger/step-N/step.json` (expected vs observed, every');
  out.push('observation point, the per-colour invariant, the conservation identity, the spot check and');
  out.push('every operation) and `step-N/summary.md`.');
  out.push('');

  // --- negative controls, verbatim -------------------------------------------------------------
  out.push('## Negative controls and probe M2 — verbatim');
  out.push('');
  out.push('Each proves THREE things: the rejection happened, it was the CONTRACT\'S OWN assert (an');
  out.push('unrelated failure recorded as "the guard did its job" would be worthless), and the full');
  out.push('16-cell table, both pools (value AND nonce), both unshielded contract-ledger balances and both');
  out.push('users\' coins/UTXOs are byte-identical before and after — re-read after a settle delay, so');
  out.push('"unchanged" is an observation rather than a race.');
  out.push('');
  out.push('| Id | Status | Refused at | Verbatim error | Expected message | Funds byte-identical |');
  out.push('|---|---|---|---|---|---|');
  for (const c of controlsDoc.controls) {
    out.push(
      `| \`${c.id}\` | **${c.status}** | ${c.rejectedAt} | \`${String(c.reason).replace(/\|/g, '\\|')}\` | ` +
        `\`${String(c.expectedMessage).replace(/\|/g, '\\|')}\` ${c.messageMatched ? 'matched' : '**NOT MATCHED**'} | ` +
        `${c.fundsUnchanged ? 'yes' : '**NO**'} |`,
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
    if (c.setupTxs?.length) out.push(`  - fixture transactions: ${c.setupTxs.map((t: string) => `\`${t}\``).join(', ')}`);
  }
  out.push('');
  out.push('Full before/after state in `evidence/g3-ledger/negative-controls.json`.');
  out.push('');

  // --- M1 / decision D-102 -----------------------------------------------------------------------
  out.push('## M1 and decision D-102 — mixed-colour one-transaction composition');
  out.push('');
  out.push(`- transaction: \`${ctx.mixedColour.txId}\``);
  out.push(`- shape used: **${ctx.mixedColour.shape}**`);
  out.push(`- circuits in that transaction: ${ctx.mixedColour.circuits.map((x: string) => `\`${x}\``).join(' + ')}`);
  if (ctx.mixedColour.segment !== undefined) out.push(`- intent segment: ${ctx.mixedColour.segment}`);
  out.push('');
  out.push('| Shape attempted | Outcome |');
  out.push('|---|---|');
  for (const a of ctx.mixedColour.attempts) {
    out.push(`| ${a.shape} | ${a.ok ? '**used**' : `failed — \`${String(a.error).replace(/\|/g, '\\|')}\``} |`);
  }
  out.push('');

  out.push('## Run metrics');
  out.push('');
  out.push('```json');
  out.push(JSON.stringify(ctx.metrics, null, 2));
  out.push('```');
  out.push('');

  writeFileSync(join(EVID, 'CELLS.md'), `${out.join('\n')}\n`);
  console.log(`wrote evidence/g3-ledger/CELLS.md — ${green}/${CHECKLIST.length} GREEN`);

  if (extra.length) console.log(`note: ${extra.length} recorded item(s) not in the checklist: ${extra.map((c: any) => c.id).join(', ')}`);
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
  console.log(`${CHECKLIST.length}/${CHECKLIST.length} checklist items GREEN, all controls GREEN, no gaps`);
};

main();
