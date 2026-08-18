// G3 — render `evidence/g3-ledger/CELLS.md` from the records the three live runs wrote.
//
// Nothing here computes a result: it joins `cells.json` (the ordered ledger), `negative-controls
// .json` and `atomicity.json` against the spec's 26-item checklist and fails if any item has no
// record. A cell the runs never reached is a GAP, and a gap is a hard error — the spec forbids
// silent omissions (SC-002, FR-010).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';

const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

/** The spec's checklist, in the spec's own order and wording. */
const CHECKLIST: Array<{ id: string; label: string }> = [
  { id: 'mint-shielded-user', label: 'Mint shielded → user (step 1)' },
  { id: 'mint-shielded-account', label: 'Mint shielded → manager account (step 1)' },
  { id: 'mint-unshielded-user', label: 'Mint unshielded → user (step 2)' },
  { id: 'mint-unshielded-account', label: 'Mint unshielded → manager account (step 2)' },
  { id: 'send-shielded-user-user', label: 'Send shielded user→user (step 3)' },
  { id: 'internal-shielded', label: 'Shielded account→account internal ownership transfer, no ledger movement (step 3)' },
  { id: 'send-shielded-user-account', label: 'Send shielded user→account (step 4)' },
  { id: 'send-shielded-account-user', label: 'Send shielded account→user (step 4)' },
  { id: 'send-unshielded-user-user', label: 'Send unshielded user→user (step 5)' },
  { id: 'internal-unshielded', label: 'Unshielded account→account internal ownership transfer, no ledger movement (step 5)' },
  { id: 'send-unshielded-user-account', label: 'Send unshielded user→account (step 6)' },
  { id: 'send-unshielded-account-user', label: 'Send unshielded account→user (step 6)' },
  { id: 'provenance-user-resends-shielded', label: 'Provenance: user re-sends AA-originated shielded coins (step 7)' },
  { id: 'provenance-account-resends-shielded', label: 'Provenance: AA account re-sends user-originated shielded value (step 7)' },
  { id: 'provenance-user-resends-unshielded', label: 'Provenance: user re-sends AA-originated unshielded tokens (step 8)' },
  { id: 'provenance-account-resends-unshielded', label: 'Provenance: AA account re-sends user-originated unshielded tokens (step 8)' },
  { id: 'selfsend-user-shielded', label: 'Self-send: user shielded to own key (step 9)' },
  { id: 'selfsend-user-unshielded', label: 'Self-send: user unshielded UTXO self-split (step 9)' },
  { id: 'selfsend-pool-shielded', label: 'Self-send: pool shielded to `kernel.self()` via auto-receive (step 9)' },
  { id: 'selfsend-pool-unshielded', label: 'Self-send: pool unshielded to self via auto-receive (step 9)' },
  { id: 'split-shielded-user-change', label: 'Split: shielded user wallet change (step 3, OwnerN)' },
  { id: 'split-shielded-contract-change', label: 'Split: shielded contract change coin retained in pool (step 4)' },
  { id: 'split-unshielded-user-utxo', label: 'Split: unshielded user UTXO split into sent + change (step 5, OwnerN)' },
  { id: 'split-unshielded-partial-pool', label: 'Split: unshielded partial pooled-balance spend (step 6)' },
  { id: 'merge-pool-deposit', label: 'Merge: pool combines deposited coin with held coin (step 4)' },
  { id: 'invariant-pool-equals-accounts', label: 'Invariant: `pooled holdings = AA_A + AA_B` per family, asserted after **every** step' },
];

const readJson = (name: string): any => {
  const p = join(EVID, name);
  if (!existsSync(p)) throw new Error(`missing evidence file ${p} — run the corresponding G3 script first`);
  return JSON.parse(readFileSync(p, 'utf-8'));
};

const main = () => {
  const cellsDoc = readJson('cells.json');
  const controlsDoc = readJson('negative-controls.json');
  const atomicityDoc = readJson('atomicity.json');
  const ctx = readJson('run-context.json');

  const byId = new Map<string, any>(cellsDoc.cells.map((c: any) => [c.id, c]));
  const missing = CHECKLIST.filter((c) => !byId.has(c.id));
  const extra = cellsDoc.cells.filter((c: any) => !CHECKLIST.some((x) => x.id === c.id));

  const green = CHECKLIST.filter((c) => byId.get(c.id)?.status === 'GREEN').length;
  const red = CHECKLIST.filter((c) => byId.get(c.id)?.status === 'RED');

  const out: string[] = [];
  out.push('# Combination-matrix cell index — 00003-contract-token-custody');
  out.push('');
  out.push('**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.');
  out.push('No result here may be extrapolated to a supported or production lane.');
  out.push('');
  out.push(`Generated ${cellsDoc.utc} from the retained run.`);
  out.push('');
  out.push('| What | Value |');
  out.push('|---|---|');
  out.push(`| Minter | \`${ctx.minterAddress}\` |`);
  out.push(`| Manager | \`${ctx.managerAddress}\` |`);
  out.push(`| Shielded colour | \`${ctx.colors.shielded}\` |`);
  out.push(`| Unshielded colour | \`${ctx.colors.unshielded}\` |`);
  out.push(`| AA_A account id | \`${ctx.accounts.idA}\` |`);
  out.push(`| AA_B account id | \`${ctx.accounts.idB}\` |`);
  out.push(`| Total minted | shielded ${ctx.mintedTotals.shielded}, unshielded ${ctx.mintedTotals.unshielded} |`);
  out.push('');
  out.push(`**${green} of ${CHECKLIST.length} cells GREEN**` + (red.length ? `, ${red.length} named RED` : ', 0 RED') + (missing.length ? `, ${missing.length} MISSING` : ', no gaps') + '.');
  out.push('');
  out.push('## Composition level');
  out.push('');
  out.push('Recorded per cell, as the master plan requires:');
  out.push('');
  out.push('- **LEDGER** — the paired mint→Manager cells. midnight-js cannot express a minting');
  out.push("  contract's spend claim and a second contract's receive claim in one transaction, so both");
  out.push('  `ContractCallPrototype`s are assembled into ONE ledger `Intent` (`src/g3/ledger-compose.ts`),');
  out.push('  mirroring `midnight-ledger/ledger/tests/token_vault_shielded.rs`. Each call\'s transcript still');
  out.push('  comes from executing the real compiled circuit; only the assembly is at ledger level.');
  out.push('- **SDK** — a single midnight-js contract call, balanced by the relevant wallet. This covers every');
  out.push('  user→Manager deposit: the Manager declares the receive and the depositor\'s wallet supplies the');
  out.push('  input, so sender spend and Manager receive are in one transaction by construction (FR-003).');
  out.push('- **wallet** — no contract at all: a wallet-to-wallet (or wallet-to-self) transfer.');
  out.push('- **derived** — an invariant asserted over other cells\' observations rather than its own transaction.');
  out.push('');
  out.push('## Cells');
  out.push('');
  out.push('| # | Cell | Step | Level | Transaction id(s) | Observation points | Status |');
  out.push('|---|---|---|---|---|---|---|');
  CHECKLIST.forEach((c, i) => {
    const r = byId.get(c.id);
    if (!r) {
      out.push(`| ${i + 1} | ${c.label} | — | — | — | — | **MISSING** |`);
      return;
    }
    const txs = r.txs.length ? r.txs.map((t: string) => `\`${t}\``).join('<br>') : '—';
    out.push(
      `| ${i + 1} | ${c.label} | ${r.step} | ${r.level} | ${txs} | ${r.points} | **${r.status}** |`,
    );
  });
  out.push('');
  out.push('### Notes');
  out.push('');
  CHECKLIST.forEach((c, i) => {
    const r = byId.get(c.id);
    if (r?.note) out.push(`- **${i + 1}. ${c.id}** — ${r.note}`);
  });
  out.push('');
  out.push('Per-cell evidence: `evidence/g3-ledger/step-N/step.json` (full before/after observation for');
  out.push('every operation, including coin- and UTXO-level detail) and `step-N/summary.md`.');
  out.push('');

  // --- negative controls -------------------------------------------------------------------------
  out.push('## Negative controls');
  out.push('');
  out.push('Each proves BOTH the rejection AND that state and funds are byte-identical before and after.');
  out.push('Where a control is refused is recorded rather than blurred: a claim-mechanics failure survives');
  out.push('local construction and is refused when the transaction is assembled or submitted, while an owner');
  out.push('or balance guard is a circuit `assert` and refuses during circuit execution, so no transaction is');
  out.push('ever built.');
  out.push('');
  out.push('| Control | Expectation | Refused at | State + funds unchanged | Status |');
  out.push('|---|---|---|---|---|');
  for (const c of controlsDoc.controls) {
    out.push(`| ${c.label} | ${c.expectation} | ${c.rejectedAt} | ${c.stateUnchanged ? 'yes' : '**NO**'} | **${c.status}** |`);
  }
  out.push('');
  out.push('Reasons recorded verbatim in `evidence/g3-ledger/negative-controls.json`.');
  out.push('');

  // --- atomicity ---------------------------------------------------------------------------------
  out.push('## Atomicity probes');
  out.push('');
  out.push(`Method: ${atomicityDoc.method}`);
  out.push('');
  out.push('| Family | Prepared operation | Displacing tx | Submission outcome | Nothing survived | Status |');
  out.push('|---|---|---|---|---|---|');
  for (const p of atomicityDoc.probes) {
    const outcome = p.submission.accepted
      ? `accepted for inclusion (\`${p.submission.txIdOrError}\`), fallible section rolled back`
      : `refused at submission: ${String(p.submission.txIdOrError).slice(0, 120)}`;
    out.push(`| ${p.family} | ${p.preparedFor} | \`${p.displacingTx}\` | ${outcome} | ${p.stateUnchanged ? 'yes' : '**NO**'} | **${p.status}** |`);
  }
  out.push('');
  out.push('Full before/after observations in `evidence/g3-ledger/atomicity.json`.');
  out.push('');

  writeFileSync(join(EVID, 'CELLS.md'), out.join('\n'));
  console.log(`wrote evidence/g3-ledger/CELLS.md — ${green}/${CHECKLIST.length} GREEN`);

  if (extra.length) console.log(`note: ${extra.length} recorded cell(s) not in the checklist: ${extra.map((c: any) => c.id).join(', ')}`);
  if (missing.length) {
    console.error(`\nGAP: ${missing.length} checklist cell(s) have no record: ${missing.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
  if (red.length) {
    console.error(`\n${red.length} cell(s) RED: ${red.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
  const badControls = controlsDoc.controls.filter((c: any) => c.status !== 'GREEN');
  const badProbes = atomicityDoc.probes.filter((p: any) => p.status !== 'GREEN');
  if (badControls.length || badProbes.length) {
    console.error(`\n${badControls.length} negative control(s) and ${badProbes.length} atomicity probe(s) not GREEN`);
    process.exit(1);
  }
  console.log('26/26 cells GREEN, all negative controls and atomicity probes GREEN, no gaps');
};

main();
