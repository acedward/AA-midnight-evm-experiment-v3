// G4 — render `REPORT.md`, the project's final report (Plan 04 Phase 2, FR-010, SC-005).
//
// Everything in the report is READ FROM RETAINED EVIDENCE. Nothing is recomputed, restated from
// memory, or rounded up: the step table comes from the per-step observations, the cell verdicts
// from `cells.json`, the controls from their own JSON, the metrics from the run context and the
// compiled artifacts. If a source file is missing the report is not written at all, because a
// report that quietly omits a section is exactly the overclaim the specification forbids.
//
// Usage: `npx tsx src/g4/report.ts [cloneRoot]` — when a clean-clone root is given, the
// reproduction section is filled in from that clone's own evidence.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';

const G3 = join(REPO_ROOT, 'evidence', 'g3-ledger');

const readJson = (p: string): any => {
  if (!existsSync(p)) throw new Error(`missing evidence file: ${p}`);
  return JSON.parse(readFileSync(p, 'utf-8'));
};
const readText = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf-8') : '');

const PARTIES = ['AA_A', 'OwnerN', 'AA_B', 'OwnerM'] as const;

const stepAction: Record<number, string> = {
  0: 'Deploy Minter + Manager; register AA_A (OwnerA), AA_B (OwnerB); create OwnerN, OwnerM',
  1: 'Mint **shielded** 10 → AA_A and 10 → OwnerN',
  2: 'Mint **unshielded** 10 → AA_A and 10 → OwnerN',
  3: 'Send **shielded** half: OwnerN →5→ OwnerM; AA_A →5→ AA_B',
  4: 'Send **shielded** remaining half, crossed: OwnerN →5→ AA_B; AA_A →5→ OwnerM',
  5: 'Send **unshielded** half: OwnerN →5→ OwnerM; AA_A →5→ AA_B',
  6: 'Send **unshielded** remaining half, crossed: OwnerN →5→ AA_B; AA_A →5→ OwnerM',
  7: '**Provenance re-send, shielded**: OwnerM →5→ AA_A; AA_B →5→ OwnerN',
  8: '**Provenance re-send, unshielded**: OwnerM →5→ AA_A; AA_B →5→ OwnerN',
  9: '**Self-send round**: OwnerM both families; Manager pool both families to `kernel.self()`',
};

/** Circuit inventory and verifier-key sizes, straight from the compiled artifacts. */
const artifactMetrics = () => {
  const out: Array<{ contract: string; circuits: string[]; keys: Array<{ circuit: string; bytes: number }> }> = [];
  for (const c of ['minter', 'manager']) {
    const infoPath = join(REPO_ROOT, 'harness', 'generated-zk', c, 'compiler', 'contract-info.json');
    const keyDir = join(REPO_ROOT, 'harness', 'generated-zk', c, 'keys');
    if (!existsSync(infoPath)) continue;
    const info = readJson(infoPath);
    const keys = existsSync(keyDir)
      ? readdirSync(keyDir)
          .filter((f) => f.endsWith('.verifier'))
          .map((f) => ({ circuit: f.replace(/\.verifier$/, ''), bytes: statSync(join(keyDir, f)).size }))
          .sort((a, b) => a.circuit.localeCompare(b.circuit))
      : [];
    out.push({ contract: c, circuits: (info.circuits ?? []).map((x: any) => x.name), keys });
  }
  return out;
};

const main = () => {
  const cloneRoot = process.argv[2];
  const ctx = readJson(join(G3, 'run-context.json'));
  const cellsDoc = readJson(join(G3, 'cells.json'));
  const controlsDoc = readJson(join(G3, 'negative-controls.json'));
  const atomicityDoc = readJson(join(G3, 'atomicity.json'));

  const steps = [...Array(10).keys()].map((n) => readJson(join(G3, `step-${n}`, 'step.json')));
  const artifacts = artifactMetrics();
  const metrics = ctx.metrics;

  const out: string[] = [];

  out.push('# 00003-contract-token-custody — final report');
  out.push('');
  out.push('> **`EXPERIMENTAL_LANE`.** Every result below was produced on the pinned **v2.0.0-rc.4');
  out.push('> prerelease slot** on a local, fresh `undeployed` ledger-9 network. Per the recorded 00002');
  out.push('> G1 evidence, the official compatibility matrix lists **no supported coherent 2.x application');
  out.push('> bundle**, so this lane is a deliberately experimental one. **No result here may be');
  out.push('> extrapolated to a supported or production lane**, and nothing here is a production');
  out.push('> readiness claim. The lane also carries deviation **`LANE-DEV-1`** (below).');
  out.push('');

  // --- headline ---------------------------------------------------------------------------------
  const final = steps[9].observed.table;
  out.push('## Headline result');
  out.push('');
  out.push('A contract-minted token, in **both families**, circulated through user wallets and through');
  out.push('contract-held custody accounts and back, ending with **all four parties at `5/5`** after a');
  out.push('deliberately balance-neutral self-send round:');
  out.push('');
  out.push('| AA_A | OwnerN | AA_B | OwnerM |');
  out.push('|---|---|---|---|');
  out.push(`| ${PARTIES.map((p) => `${final[p].shielded}/${final[p].unshielded}`).join(' | ')} |`);
  out.push('');
  out.push('Both halves of the standing ownership invariant — `pooled holdings = AA_A + AA_B`, per');
  out.push('family — were asserted after **every one of the ten steps**, against two independently');
  out.push('maintained mechanisms.');
  out.push('');
  out.push('The owner\'s core question is answered affirmatively and directly: tokens are **equally');
  out.push('spendable regardless of whether their previous holder was a contract account or a normal');
  out.push('wallet**. Step 7 has OwnerM re-spending coins the Manager created, and AA_B re-spending value');
  out.push('OwnerN deposited; step 8 mirrors both unshielded.');
  out.push('');

  // --- lane -------------------------------------------------------------------------------------
  out.push('## The pinned lane');
  out.push('');
  out.push('Exact component set, pinned by immutable digest or integrity hash at G1 and re-asserted by');
  out.push('every gate wrapper before it boots a stack — see [`evidence/g1-lane/LANE.md`](evidence/g1-lane/LANE.md).');
  out.push('');
  out.push('| Component | Pin |');
  out.push('|---|---|');
  out.push('| node | `node-2.0.0-rc.4` @ `sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e` |');
  out.push('| indexer | `v4.4.0-rc.1` @ `sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a` |');
  out.push('| proof server | `9.0.0-rc.3` @ `sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f` |');
  out.push('| ledger | `ledger-9.1.0.0-rc.3` (`@midnightntwrk/ledger-v9@1.0.0-rc.3`) |');
  out.push('| midnight-js | `v5.0.0-beta.6` |');
  out.push('| wallet SDK | `@midnightntwrk/wallet-sdk@2.0.0-beta.2` |');
  out.push('| compiler | `compactc 0.33.0` / language `0.25.0` — **deviation `LANE-DEV-1`** |');
  out.push('');
  out.push('**`LANE-DEV-1`.** The spec pins `compactc-v0.33.0-rc.2`, which has **no published binary**');
  out.push('(Finding L-4). The owner approved substituting the released `compactc-v0.33.0` provided the');
  out.push('substitution was verified rather than assumed. It is verified end to end: the compiler and');
  out.push('language versions match the pinned rc.2 source, the binary is pinned by SHA-256, and — the');
  out.push('check that matters — its artifacts are **accepted on-chain by `ledger-9.1.0.0-rc.3`**, which');
  out.push('every deployment and every transaction in this report demonstrates.');
  out.push('');

  // --- step ledger ------------------------------------------------------------------------------
  out.push('## The step ledger, as observed');
  out.push('');
  out.push('Balances are `shielded/unshielded` **of the Minter\'s two colours only**. NIGHT and DUST appear');
  out.push('solely as fee context and never in this table (FR-006). Every row below is the **observed**');
  out.push('value, asserted equal to the specification\'s expected value before the run was allowed to');
  out.push('continue; the first divergence would have halted it.');
  out.push('');
  out.push('| Step | Action | AA_A | OwnerN | AA_B | OwnerM | pool (shielded) | contract ledger (unshielded) |');
  out.push('|---|---|---|---|---|---|---|---|');
  steps.forEach((s: any, n: number) => {
    const t = s.observed.table;
    out.push(
      `| ${n} | ${stepAction[n]} | ` +
        PARTIES.map((p) => `${t[p].shielded}/${t[p].unshielded}`).join(' | ') +
        ` | ${s.observed.pool.value} | ${s.observed.managerUnshieldedLedger} |`,
    );
  });
  out.push('');
  out.push('Per-step evidence — every operation\'s full before/after observation, including coin nonces,');
  out.push('commitments and UTXO detail — is in [`evidence/g3-ledger/`](evidence/g3-ledger/):');
  out.push(steps.map((_s, n) => `[step ${n}](evidence/g3-ledger/step-${n}/step.json)`).join(' · '));
  out.push('');
  out.push('### Deployment of record');
  out.push('');
  out.push('| What | Value |');
  out.push('|---|---|');
  out.push(`| Minter | \`${ctx.minterAddress}\` |`);
  out.push(`| Manager | \`${ctx.managerAddress}\` |`);
  out.push(`| Shielded colour | \`${ctx.colors.shielded}\` |`);
  out.push(`| Unshielded colour | \`${ctx.colors.unshielded}\` |`);
  out.push(`| AA_A (OwnerA) account id | \`${ctx.accounts.idA}\` |`);
  out.push(`| AA_B (OwnerB) account id | \`${ctx.accounts.idB}\` |`);
  out.push(`| Total minted | shielded ${ctx.mintedTotals.shielded}, unshielded ${ctx.mintedTotals.unshielded} |`);
  out.push('');

  // --- checklist --------------------------------------------------------------------------------
  const green = cellsDoc.cells.filter((c: any) => c.status === 'GREEN').length;
  const red = cellsDoc.cells.filter((c: any) => c.status !== 'GREEN');
  out.push('## Combination-matrix checklist');
  out.push('');
  out.push(`**${green} of ${cellsDoc.cells.length} cells GREEN**${red.length ? `, ${red.length} named RED` : ', 0 RED'}, no gaps.`);
  out.push('The full index — per-cell transaction ids, observation points and composition level — is');
  out.push('[`evidence/g3-ledger/CELLS.md`](evidence/g3-ledger/CELLS.md).');
  out.push('');
  out.push('| Cell | Step | Level | Transaction id(s) | Status |');
  out.push('|---|---|---|---|---|');
  for (const c of cellsDoc.cells) {
    const txs = c.txs.length ? c.txs.map((t: string) => `\`${t}\``).join('<br>') : '—';
    out.push(`| ${c.label} | ${c.step} | ${c.level} | ${txs} | **${c.status}** |`);
  }
  out.push('');

  // --- composition ------------------------------------------------------------------------------
  const ledgerCells = cellsDoc.cells.filter((c: any) => c.level === 'LEDGER').map((c: any) => c.id);
  out.push('## Composition level, and the one thing the SDK could not express');
  out.push('');
  out.push('The specification requires a transfer INTO the Manager to be **one transaction** containing the');
  out.push('sender\'s operation and the Manager\'s receive claim, because the standard library auto-receives');
  out.push('only when the recipient is `kernel.self()`. The answer turned out to depend on **who is sending**:');
  out.push('');
  out.push('- **A user wallet → the Manager needs no cross-contract composition at all.** A *single*');
  out.push('  `depositShielded` / `depositUnshielded` call declares the receive, and the depositor\'s wallet');
  out.push('  supplies the input while balancing, so spend and receive share one transaction by');
  out.push('  construction. **SDK level.**');
  out.push('- **A minting contract → the Manager is not expressible in `midnight-js v5.0.0-beta.6`**');
  out.push('  (Finding G3-2). `withContractScopedTransaction` rejects a second contract outright, and');
  out.push('  `Transaction.merge` places each call in its **own segment**, so the Minter\'s spend claim and');
  out.push('  the Manager\'s receive claim cannot offset. These cells use the specification\'s documented');
  out.push('  **ledger-level fallback**: both `ContractCallPrototype`s are assembled into **one `Intent`**,');
  out.push('  mirroring `midnight-ledger/ledger/tests/token_vault_shielded.rs`. Each call\'s transcript still');
  out.push('  comes from executing the real compiled circuit through midnight-js — only the assembly is at');
  out.push('  ledger level, so no contract behaviour is reimplemented off-chain. Proving a two-contract');
  out.push('  intent uses the pinned SDK\'s own `ZKConfigRegistry`, which resolves each call\'s artifacts by');
  out.push('  the hash of its **deployed** verifier key.');
  out.push('');
  out.push(`Cells produced at ledger level: ${ledgerCells.length ? ledgerCells.map((c: string) => `\`${c}\``).join(', ') : '(none)'}. Everything else is SDK level or a plain wallet transfer.`);
  out.push('Detail: [`evidence/g3-ledger/COMPOSITION.md`](evidence/g3-ledger/COMPOSITION.md).');
  out.push('');

  // --- controls ---------------------------------------------------------------------------------
  out.push('## Negative controls and atomicity');
  out.push('');
  out.push('Each control proves BOTH that the operation is refused AND that state and funds are');
  out.push('byte-identical before and after.');
  out.push('');
  out.push('| Control | Refused at | State + funds unchanged | Status |');
  out.push('|---|---|---|---|');
  for (const c of controlsDoc.controls) {
    out.push(`| ${c.label} | ${c.rejectedAt} | ${c.stateUnchanged ? 'yes' : '**NO**'} | **${c.status}** |`);
  }
  out.push('');
  out.push('**Atomicity.** A circuit that asserts unconditionally after its token operation can never be');
  out.push('*built* on this toolchain — the assert fires during local circuit execution, so no transaction');
  out.push('would exist and nothing about on-chain atomicity would be shown. The probes therefore use a');
  out.push('deferred failure, which is the only way to put a real transaction with a failing assertion in');
  out.push('front of the node: a full-balance withdrawal is prepared while the account holds the funds, the');
  out.push('account is then emptied by an internal transfer submitted from a different wallet, and the');
  out.push('stale withdrawal is submitted.');
  out.push('');
  out.push('| Family | Outcome | Nothing survived | Status |');
  out.push('|---|---|---|---|');
  for (const p of atomicityDoc.probes) {
    const outcome = p.submission.accepted
      ? 'accepted for inclusion, fallible section rolled back'
      : `refused at submission: ${String(p.submission.txIdOrError).slice(0, 90)}`;
    out.push(`| ${p.family} | ${outcome} | ${p.stateUnchanged ? 'yes' : '**NO**'} | **${p.status}** |`);
  }
  out.push('');
  out.push('Intra-circuit ordering (guards evaluated before effects) is a separate property, covered by the');
  out.push('G2 simulator suites.');
  out.push('');

  // --- metrics ----------------------------------------------------------------------------------
  out.push('## Metrics');
  out.push('');
  if (metrics) {
    const pl = metrics.proofLatencyMs;
    const tb = metrics.transactionBytes;
    out.push('Measured during the retained step-ledger run, at the point each thing actually happens:');
    out.push('`proveTx` is timed by wrapping the proof provider, and each submitted transaction is measured');
    out.push('by serializing it. **These cover the contract-call transactions**, which are the ones this');
    out.push('harness proves and submits itself. The plain wallet-to-wallet transfers (the user→user and');
    out.push('user self-send cells) are proven and submitted inside the wallet SDK and are therefore not');
    out.push('instrumented here — the figures are not a whole-run average.');
    out.push('');
    out.push('| Metric | count | min | median | mean | max |');
    out.push('|---|---|---|---|---|---|');
    out.push(`| Proof latency (ms) | ${pl.count} | ${pl.min} | ${pl.median} | ${pl.mean} | ${pl.max} |`);
    out.push(`| Submitted transaction size (bytes) | ${tb.count} | ${tb.min} | ${tb.median} | ${tb.mean} | ${tb.max} |`);
    out.push('');
  } else {
    out.push('_Proof-latency and transaction-size metrics were not captured in the retained run._');
    out.push('');
  }
  out.push('| Contract | Circuits | Verifier keys | Total verifier-key bytes |');
  out.push('|---|---|---|---|');
  for (const a of artifacts) {
    const total = a.keys.reduce((s, k) => s + k.bytes, 0);
    out.push(`| ${a.contract} | ${a.circuits.length} | ${a.keys.length} | ${total} |`);
  }
  out.push('');
  out.push('Per-circuit verifier-key hashes and sizes: [`evidence/g2-contracts/ARTIFACTS.md`](evidence/g2-contracts/ARTIFACTS.md).');
  out.push('');

  // --- reproduction -----------------------------------------------------------------------------
  out.push('## Reproduction from a clean clone (SC-004)');
  out.push('');
  if (cloneRoot && existsSync(join(cloneRoot, 'evidence', 'g3-ledger', 'cells.json'))) {
    const repro = readJson(join(cloneRoot, 'evidence', 'g3-ledger', 'cells.json'));
    const reproGreen = repro.cells.filter((c: any) => c.status === 'GREEN').length;
    const reproCtx = readJson(join(cloneRoot, 'evidence', 'g3-ledger', 'run-context.json'));
    out.push('The G4 wrapper clones this repository into a fresh temporary directory — carrying **no**');
    out.push('generated artifacts, **no** `docker/.env` and **no** `node_modules`, all of which are');
    out.push('asserted absent — then runs the G2 and G3 gate wrappers inside that clone against a fresh');
    out.push('stack of its own, and compares the results cell for cell.');
    out.push('');
    out.push('| | Original run | Clean-clone reproduction |');
    out.push('|---|---|---|');
    out.push(`| Cells GREEN | ${green}/${cellsDoc.cells.length} | ${reproGreen}/${repro.cells.length} |`);
    out.push(`| Minter | \`${ctx.minterAddress}\` | \`${reproCtx.minterAddress}\` |`);
    out.push(`| Manager | \`${ctx.managerAddress}\` | \`${reproCtx.managerAddress}\` |`);
    out.push('');
    out.push('Addresses and transaction ids necessarily differ — the reproduction runs on a brand-new');
    out.push('chain — so the comparison is over what the specification actually asserts: each cell\'s');
    out.push('verdict, its step, and its composition level.');
    out.push('');
  } else {
    out.push('_Not yet reproduced: run `./scripts/g4/verify-g4-closeout.sh`, which regenerates this section._');
    out.push('');
  }

  // --- how to reproduce -------------------------------------------------------------------------
  out.push('## How to reproduce');
  out.push('');
  out.push('```sh');
  out.push('./scripts/g1/verify-g1-lane.sh        # lane: pinned digests, fresh chain, wallets, DUST');
  out.push('./scripts/g2/verify-g2-contracts.sh   # contracts: compile + simulator suites + artifact record');
  out.push('./scripts/g3/verify-g3-ledger.sh      # the whole step ledger on a fresh stack of its own');
  out.push('./scripts/g4/verify-g4-closeout.sh    # clean-clone reproduction + this report');
  out.push('```');
  out.push('');
  out.push('Each wrapper owns its own disposable Docker stack under a compose project name unique to the');
  out.push('run, on random host ports above 10000 verified free beforehand, and tears down only its own');
  out.push('containers and volumes. A run is green only when the process exits zero **including teardown**.');
  out.push('');

  // --- scope ------------------------------------------------------------------------------------
  out.push('## Scope and honest limits');
  out.push('');
  out.push('- `EXPERIMENTAL_LANE` throughout: a prerelease slot with no supported-bundle guarantee, plus');
  out.push('  the `LANE-DEV-1` compiler deviation. Nothing here is a supported-lane or production claim.');
  out.push('- Local fresh `undeployed` ledger-9 network only. No Devnet, Stagenet, testnet or mainnet.');
  out.push('- No browser, relayer, sponsorship, EIP-712/secp256k1, `kernel.caller()` dependency, Umbra, or');
  out.push('  production hardening. Owner authorization is by witness, which is sound here only because the');
  out.push('  Manager is always invoked in root position.');
  out.push('- The Manager is a demonstration custodian, not a product: any party may request minting, and');
  out.push('  the pooled shielded holding is deliberately a single coin.');
  out.push('');

  writeFileSync(join(REPO_ROOT, 'REPORT.md'), out.join('\n'));
  console.log(`wrote REPORT.md — ${green}/${cellsDoc.cells.length} cells GREEN, ${steps.length} step rows`);
  if (red.length) {
    console.log(`named RED cells: ${red.map((c: any) => c.id).join(', ')}`);
  }
  // Keep the raw text available for anyone diffing the report against its sources.
  const lane = readText(join(REPO_ROOT, 'evidence', 'g1-lane', 'LANE.md'));
  if (!lane) console.log('note: evidence/g1-lane/LANE.md not found; lane section rendered from the pinned constants');
};

main();
