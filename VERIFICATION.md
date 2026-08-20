# VERIFICATION — 00006-unbalanced-zswap

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

The append-only ledger of what was run, when, with what result — **including every run that was
VOIDed, went RED or was superseded**, because a project that only records its green runs is not
reproducible and its green runs cannot be trusted. Every canonical run's authoritative record is the
gate's own `run.log`; this file indexes them and says what each one settled.

A gate is GREEN **only if its wrapper exits 0 including teardown**, and every teardown asserts that
no container, volume or network of this project survived it. `final_exit: 0` in a `run.log` means
exactly that.

## Contents

- [Lane and its inheritance](#lane-and-its-inheritance)
- [Gate G1 — workspace, lane, spikes S1–S3](#gate-g1--workspace-lane-spikes-s1s3)
- [Gate G2 — Manager v4, the offer kit, spikes S4–S6](#gate-g2--manager-v4-the-offer-kit-spikes-s4s6)
- [Gate G3 — the swap step ledger](#gate-g3--the-swap-step-ledger)
- [Gate G4 — clean-clone reproduction and closeout](#gate-g4--clean-clone-reproduction-and-closeout)
- [Deviations, findings and workarounds, with where each was established](#deviations-findings-and-workarounds-with-where-each-was-established)
- [What is NOT verified](#what-is-not-verified)

## Lane and its inheritance

The lane is **not re-pinned by this project**. `scripts/lib/lane-pins.sh` walks the whole inheritance
chain and compares, at EVERY hop, the three container image digests, the compactc archive pin and
`harness/pnpm-lock.yaml`:

```
00003 a8ebff9  (the original pinning act)
  → 00004 f066a09
    → 00005 e9701e9   (this project's base commit)
      → 00006 (here)
```

Generalising from "unchanged since my base" to a hop-by-hop walk was deliberate: 00006 is three
projects removed from the pinning act, so a check against the base alone would pass even if 00004 or
00005 had silently re-pinned something.

| What | Where |
|---|---|
| pin manifest, with both labels | `evidence/g1-lane/LANE.md` |
| the hop-by-hop proof, verbatim | `evidence/g1-lane/03-lane-reuse.out` |
| `LANE-DEV-1` (compactc `0.33.0` substituted for `-rc.2`, owner-approved) | `evidence/g1-lane/04-lane-dev-1.out` |
| the same proof re-run at G2 and G3 | `evidence/g2-contracts/03-lane-reuse.out`, `evidence/g3-swap-ledger/03-lane-reuse.out` |

The approved specification's SHA-256 is
`6441f8ed216a4f6b48306d171a5230e33f4ec3ed2739ff04f6c055f77b672bea`, verified byte-identical by G4
step `03-spec-hash` on the authoring host. The specification lives in the organizer repository, not
here, so a clone on another machine reports it as NOT PRESENT rather than silently skipping it.

## Gate G1 — workspace, lane, spikes S1–S3

Wrapper: `scripts/g1/verify-g1-spikes.sh` (`--smoke` runs the Phase-1 half only).
**Canonical: run 5, GREEN, `final_exit: 0`, product commit `aa0f8e5`.**

### Every G1 run, in order

| Run | Outcome | What it settled, or why it did not count |
|---|---|---|
| `--smoke` | **GREEN** | lane proven inherited across all three hops; W-1 adopted; one disposable stack booted, funded and torn down clean. Evidence: `evidence/g1-smoke/` |
| run 1 (full) | **VOID — not RED** | steps 01–15 passed (S1 GREEN). `16-spike-s2` was starved: the shared host's 1-minute load reached **21.7 on 16 cores**, one attempt took 12.5 min where the first six took ~24 s, and the next died with `'prove' returned an error: AbortError`. A proof-server abort under host starvation is evidence about the HOST, not the ledger — and in an evidence table it looks exactly like a refusal. Terminated deliberately; teardown held. **No conclusion about the 104 hypothesis was drawn from it.** Led to S2's load gate, per-attempt timeouts and incremental evidence writes |
| run 2 (full) | **VOID — not RED** | the host **idle-slept mid-gate** (the same failure mode 00005's G4 run 1 recorded). Led to **W-2** (`scripts/lib/nosleep.sh`) |
| run 3 (full) | **RED — a bug of mine, correctly caught** | S2's shape **C** tested `o.shape === 'dependent'`, which is false for `'dependent-fixed'`, so C silently ran the INDEPENDENT specs — measuring the wrong thing under the right name — and exhausted the unshielded mint budget. Teardown held; host verified clean. Console log retained: `evidence/g1-spikes/superseded/run3-console-RED-shapeC-bug.log` |
| run 4 (full) | **GREEN, but its S2 REPORT was withdrawn** | every measurement was valid (0 VOIDs; shape B 3/3 ascending accepted vs 9/9 descending refused), but the report inferred "segment order is a cause, not the only one" from shape C's failures, when the truth is that the *rewrite* is invalid (F-306), and it pooled the intervention arm into the necessity figure. Both defects fixed; raw data retained as a genuine independent replication: `evidence/g1-spikes/superseded/run4-{S2.md,s2-segment-order.json}` |
| **run 5 (full)** | **GREEN — canonical** | `final_exit: 0` including teardown, `stack_assert_clean` and `w1_cleanup`; **0 VOIDs and 0 infrastructure retries in all four S2 shapes** |

### Run 5, step by step (`evidence/g1-lane/run.log`)

started `2026-08-20T03:04:35Z`, finished `2026-08-20T03:44:56Z`, `final_exit: 0`, teardown exit 0.

| Step | Duration | Step | Duration |
|---|---|---|---|
| `01-w1-docker-config` | 0 s | `10-boot` | 8 s |
| `02-probe-ports` | 0 s | `11-health` | 2 s |
| `03-lane-reuse` | 1 s | `12-wallets` | 5 s |
| `04-lane-dev-1` | 1 s | `13-funding` | 148 s |
| `05-compile-fast` | 1 s | `14-record-lane` | 0 s |
| `06-install` | 0 s | **`15-spike-s1`** | **349 s** |
| `07-compile-zk` | 61 s | **`16-spike-s2`** | **1617 s** |
| `08-typecheck` | 1 s | **`17-spike-s3`** | **223 s** |
| `09-pull` | 2 s | `18-record-spikes` | 1 s |

### What G1 established

| Spike | Verdict | The load-bearing detail |
|---|---|---|
| **S1** — can a FOREIGN wallet balance and submit a contract-call transaction? | **GREEN** | both entry points work: `balanceUnboundTransaction` (S1a) and, after `bind()`, `balanceFinalizedTransaction` (S1b). The builder held **none** of the deposited colour, so it could not have funded the coin. Merged intent segments `[1, <maker's random>]` — the taker's intent lands first, benignly. **No refusals to record: zero.** The prior art's proof-server death (`Failed to check: bad input`) **did not reproduce** |
| **S2** — is node code `104` caused by descending merged segment order? | **CONFIRMED, with the post-hoc fix REFUTED as implemented** | shape B (a genuine read-after-write) across all four runs: **23/23 ascending accepted, 25/25 descending refused** — 48 attempts, no counterexample either way. Pooled over the observation shapes an ascending pair was never once refused. The fix (re-keying the merged transaction's intents) was refused 12/12 with `235`, including on originally-ascending draws (F-306), so the mitigation belongs upstream at construction time |
| **S3** — bound or unbound? | **GREEN → decision D-306 = UNBOUND (`pre-binding`)** | both forms round-trip a real process boundary byte-identically (unbound 10 657 B, bound 10 726 B, SHA-256 stable in both directions, read by a separate `tsx` process with **no network**), both keep FR-302 placement exact, and both settled in S1. Unbound is chosen because it is the entry point the pinned SDK's own shielded-swap e2e test uses and because `bind()` freezes segment id and contents — precisely what an OPEN offer must not do. The unbound form has **no canonical transaction hash**, which is why FR-306's SHA-256-of-bytes content address is the only stable name available |

## Gate G2 — Manager v4, the offer kit, spikes S4–S6

Wrapper: `scripts/g2/verify-g2-contracts.sh` (`--offline` runs the compile/unit/typecheck half).
**Canonical: run 3, GREEN, `final_exit: 0`, product commit `3b9070c`.**

### Every G2 run and pilot, in order

| Run | Outcome | What it settled, or why it did not count |
|---|---|---|
| `--offline` | **GREEN** in 1 m 47 s | Manager v4 compiled, 115 offline assertions green, typecheck clean, F-201 verifier-key discipline clean |
| smoke (one spike) | **the two-circuit Manager was REFUSED ON DEPLOY** | `1010: Invalid Transaction: Transaction would exhaust the block limits`, **4/4 across spaced attempts** — caught deliberately before committing to the ~100-minute full gate. Diagnosed rather than guessed: finding **F-307**. Evidence: `evidence/g2-deploy-budget/01-deploy-live-4-attempts.out`, and the four-probe bracket in `02-deploy-probe-bracket.out` |
| smoke (again) | **a bad assertion of mine, not a lane problem** | S4's precondition was "the maker holds DUST" and it threw, because `dustBalance` reads 0 on this lane even for wallets demonstrably paying fees. Replaced with something observable: the maker must hold NIGHT REGISTERED for dust generation (so it COULD pay), and the decisive evidence is the settled transaction's per-intent dust actions |
| S4 pilot | **GREEN, 16/16** | the floating-surplus OPEN offer proved (9.4 s, 21 581 B), read `imbalances(0) = {+2 S_A, −3 S_B}`, was proven unsubmittable alone offline, and was SETTLED by a wallet whose seed appears nowhere in the maker's providers |
| gate run 1 | **RED on S5** | `17-spike-s5` failed identically on the initial attempt and both bounded retries. The wrapper classified them as infrastructure and VOIDed them; **that classification was wrong** — the failures were deterministic and the rxjs `Timeout has occurred` string that matched the signature was incidental. The matcher was narrowed. The run is nevertheless the source of findings **F-308** and **F-309**. Evidence: `evidence/g2-contracts/run1-superseded/` |
| gate run 2 | **VOID — agent infrastructure** | steps 01–17 GREEN, **S4 GREEN again on a second independent stack**, and **S5b replicated the F-310 boundary exactly**. Then `18-spike-s5` was killed 29 minutes into its 1800-second arm because the executing agent's background shell was stopped and the signal reached the wrapper's process group. The fail-safe contract held: `final_exit: 130`, teardown exit 0, host verified clean. **No conclusion is drawn from the interrupted arm.** Run 3 was launched in its own session so an agent-side signal could not reach a half-hour measurement again |
| — | session interruption (VOID-class) | the executing session was killed mid-wait by a transient server-side API error (529 Overloaded) while the gate ran. The gate is a detached host process and ran to completion unaffected. Recorded so a reader knows why the transcript has a seam, and so it can never be mistaken for a lane observation |
| **gate run 3** | **GREEN — canonical** | `final_exit: 0`, 21 steps, teardown exit 0 with `stack_assert_clean` and `w1_cleanup`; host verified free of every `aa00006-*` container, volume and network. **0 VOIDs, 0 infrastructure retries** |

### Run 3, step by step (`evidence/g2-contracts/run.log`)

started `2026-08-20T09:16:50Z`, finished `2026-08-20T10:38:49Z`, `final_exit: 0`, teardown exit 0.

| Step | Duration | Result |
|---|---|---|
| `01`–`14` (W-1, ports, lane, compile, install, units, typecheck, ZK+F-201, pull, boot, health, reset, load gate) | 96 s total | all exit 0 |
| **`15-spike-s4`** | **749 s** | **GREEN, 16/16** — the floating-surplus OPEN offer settles |
| `16` (S4b) | — | **NOT RUN**, with the reason recorded in `evidence/g2-spikes/S4b.md` |
| **`17-spike-s5b`** | **972 s** | **MEASURED, 4/4** — the publishability boundary, replicated a third time |
| **`18-spike-s5`** | **2538 s** | **MEASURED, 7/7** — `239` for the intervening deposit, `228` for expiry, and an untouched offer still settling after **1800 s** |
| **`19-spike-s6`** | **559 s** | **GREEN, 9/9** — maker intent 0 dust spends, taker's 1; settlement **3.03×** a plain transfer |
| `20-record-artifacts`, `21-record-spikes` | 1 s | the artifact record and the spike index, incl. `OPENNESS.md` |

### Offline verification carried by every gate from G2 onward

| What | Result |
|---|---|
| unit assertions (`npx vitest run`) | **121 passing** — 00005's **56 unchanged** (so "v4 extends v3, never weakens it" is a fact about a green file) plus 39 for the swap circuit and 26 for the envelope kit |
| guard ORDER | 4 dedicated tests plus a per-shape table, pinning the order so no future edit can move a state-reading guard ahead of the witness choke point |
| no-state-on-refusal | every negative runs through `expectReject`, which requires the WHOLE ledger snapshot — the account set, each pooled coin's identity AND value, every cell in both family maps, and all three map SIZES — to be byte-identical afterwards. The sizes are what make it a no-state-**created** proof |
| the reimplemented `coinNullifier` / `coinCommitment` | compared not against hand-copied vectors but against the values the **standard library itself** claims for the same pooled coin inside `withdrawShielded`; exact match, and on both recipient discriminants of the commitment |
| the two FR-308 branches | proven to differ in **exactly one zswap output**, with its own test — the whole difference between "a swap with somebody" and "a swap with anybody" |
| typecheck (`scripts/typecheck.sh`) | **PASS**, 1 of 1 inherited baseline errors matched, **zero new type errors** (F-302) |
| F-201 verifier-key discipline | clean: the only shared verifier keys are the expected MinterCollide mirror, which shares its prover key too |

## Gate G3 — the swap step ledger

Wrapper: `scripts/g3/verify-g3-swap-ledger.sh` (`--offline`, and `--only <A|B|C>` for a pilot).
**Canonical: run 2, GREEN, `final_exit: 0`, product commit `51266a3` plus `1a007ae` for one
index-completeness fix. 23 rows, 217 checks, zero failures.**

> Run under deviation **D-307**: the ledger is PARTITIONED across three fresh Managers on one chain,
> because **F-310** makes the spec's single-Manager sequence unreachable past row 6. Every row keeps
> the spec's exact amounts and assertions; the final table is asserted per stage; the deviation is
> evidenced by **P-F310**, which attempts the spec's literal row 7 at two cells and records the
> fail-closed refusal. Full statement: `evidence/g3-swap-ledger/DEVIATION.md`.

| Run | Outcome | What it settled, or why it did not count |
|---|---|---|
| `--offline` | **GREEN** | 121/121 unit assertions, typecheck PASS with zero new errors, F-201 clean |
| pilot `--only B` | **GREEN on the first attempt, 664 s** | the cheapest full exercise of every new piece — maker process → published envelope → reader process → taker process → settlement → two-point observation → evidence — and it banked the owner-REQUIRED result early. All 44 checks passed. **A pilot is never a gate result and the wrapper says so** |
| gate run 1 | **RED on ONE comparison bug of mine** | stages B (529 s) and C (817 s) GREEN; stage A RED on exactly two checks, both in the P-F310 row. The row deploys a THIRD issuer mid-row, so its `before` snapshot watched two colours and its `after` watched three, and the no-state comparison read the added `absent` entries as differences. **The map sizes were byte-identical on both sides (2/2/0)** — the check that would catch a real creation — so the fingerprint was merely scoped wrongly. Fixed by comparing over the keys both observations reported, with `mapSizes` and the account set still compared in full. Evidence retained: `evidence/g3-swap-ledger/run1-superseded/` |
| **gate run 2** | **GREEN — canonical** | `final_exit: 0` at `2026-08-20T12:57:26Z`, 18 steps, teardown exit 0 with `stack_assert_clean` and `w1_cleanup`; host verified free of every `aa00006-*` container, volume and network. **0 VOIDs, 0 infrastructure retries** |

### Run 2, step by step (`evidence/g3-swap-ledger/run.log`)

started `2026-08-20T12:17:25Z`, finished `2026-08-20T12:57:26Z`.

| Step | Duration | Result |
|---|---|---|
| `01`–`14` (W-1, W-2, ports, lane, compile, install, units, typecheck, ZK, pull, boot, health, evidence reset, load gate) | 98 s total | all exit 0 |
| **`15-stage-a`** | **935 s** | **GREEN** — 12 rows, 116 checks |
| **`16-stage-b`** | **534 s** | **GREEN** — 3 rows, 44 checks |
| **`17-stage-c`** | **829 s** | **GREEN** — 8 rows, 57 checks |
| `18-record` | 2 s | index written with no gaps: `LEDGER.md`, `CELLS.md`, `NEGATIVES.md`, `DEVIATION.md` |

### The numbers a reader should be able to find without opening anything

- **row 5 — the v1 HEADLINE:** tx `00a3036cec400892e7094212b30796f7fec39982859dfcead5604cb4cee6e73bcb`;
  pool S_A 6→2, pool S_B created =7, AA_A S_A 6→2 / S_B 0→7, map sizes **2/2/0**; OwnerT +4 S_A /
  −7 S_B; dust actions `{"1":{"spends":1},"6653":{"spends":0}}` — the maker's intent carries **zero**;
  settlement fee 776 272 289 111 633 SPECKs.
- **row 8 — the OPEN offer:** tx `00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164`;
  `imbalances(0)` exactly `{+2 S_A, −3 S_B}`; pool S_A **REMOVED** while the cell stays at 0, pool
  S_B =3, map sizes **1/2/0** — exactly the spec's row 8 sizes; OwnerT 0→2 S_A (swept by its own
  balancer), 10→7 S_B; `unswept {}`; maker intent 0 dust spends.
- **four refusal codes, each verbatim in the evidence:** `1` (deserialization — the offer submitted as
  published), `228` (TTL expiry), `239` (a merged or spent pooled coin — both the staleness probe and
  the withdraw cancellation), `104` (transcript — the internal-transfer cancellation). Plus `244`
  (`ReplayProtectionViolation(IntentAlreadyExists)`) for the double take.
- **P-F310:** the spec's literal row 7 at 2 pools/2 cells — `segments present: [0, N]`,
  `fallible-offer segments: [N]`, `observed at segment 0: {}` — replicated at 1 pool/2 cells,
  F-310's own deciding configuration.

## Gate G4 — clean-clone reproduction and closeout

Wrapper: `scripts/g4/verify-g4-closeout.sh` (`--offline` for everything but the three reproduced
gates). Comparator: `scripts/g4/compare-swap-runs.py`. Authoritative record:
`evidence/g4-closeout/run.log`; the reproduction's own evidence is copied to
`evidence/g4-closeout/repro/` **before the clone is deleted**, because whatever is not copied is gone.

### What the gate does, and why each step is there

| Step | What it proves |
|---|---|
| `01-w1-docker-config` | W-1 (and W-2's status recorded) before anything touches docker |
| `02-clean-clone` | a `git clone` into `mktemp -d` at exactly this working tree's commit, asserted to carry **no** `docker/.env`, `node_modules`, `toolchain/` or generated artifacts, to carry the contracts, offer kit, three stages and gate wrappers, and to carry the committed original evidence the next step needs |
| `03-spec-hash` | the approved specification is byte-identical to `6441f8ed…672bea` |
| `04-freshness-selftest` | **the freshness guard is NON-VACUOUS.** The original is fed in as its own "reproduction" and the comparison MUST reject it with exit code 2 — every substantive check passing and freshness the sole objection. A guard that cannot produce that outcome is not a guard |
| `05`/`06`/`07-reproduce-g1/g2/g3` | the three gate wrappers run **inside the clone**, in series, each against a fresh disposable stack of its own |
| `08-copy-repro-evidence` | the clone's JSON records and index pages are copied out before teardown destroys them |
| `09-compare` | verdict-and-shape comparison against the retained original: **zero** shared transaction ids, Manager addresses, colours or pooled-coin nonces, and exact equality of every pool, cell, wallet holding, map size, invariant row and conservation row |
| `10-report` | `REPORT.md` is re-rendered from retained evidence plus the clone's own |
| `11-docs` | `REPORT.md`, `README.md` and `VERIFICATION.md` exist, carry both lane labels, disclose **D-307** and **F-310**, surface owner questions **Q02-2** and **Q03-1**, state the FR-308 openness verdict in so many words, carry the findings this project owes a reader, keep the three archives intact, prove `contracts/minter.compact` is still byte-identical to `f066a09`, and prove no generated artifact, key or `docker/.env` is tracked by git |
| teardown | the temporary clone is removed (after validating the path really is a temporary one), then no `aa00006*` container, volume or network is left, then W-1's scratch config is removed |

### What the comparator deliberately does NOT demand

The specification states some outcomes as **disjunctions** and some as **measurements**, and a
comparator stricter than the specification is a comparator bug:

- **FR-308 openness** must be GREEN in both runs; WHICH shape delivered it (floating surplus or
  bearer key) may differ, and a difference is reported as a FINDING.
- **The MEASURED rows** — FR-311's staleness, both cancellation forms, P-F310 — must have measured:
  refused, no state created, funds unchanged. A different refusal CODE is a FINDING, not a failure.
- **Spike S2** measures accept/refuse ratios over random draws and feeds sibling issue 0001; its
  verdict is reported, never required to match.
- Numbers embedded in check NAMES are compared structurally (digits normalised) — while the numbers
  that carry the specification's claims are compared for exact equality out of each row's own custody
  observation. Nothing about the ledger's arithmetic is relaxed.

### G4 runs

| Run | Outcome | Notes |
|---|---|---|
| `--offline` preflight | **GREEN** | clone, spec hash, the non-vacuous freshness self-test (exit **2**, every substantive check passing), report render, document checks; `final_exit: 0` including teardown, clone removal and the residue proof. Retained separately at `evidence/g4-closeout/offline-preflight/`, because the full run overwrites that directory and a preflight that established the guard is not vacuous is evidence in its own right |
| full run | see `evidence/g4-closeout/run.log` (`final_exit`) and `09-compare.out` | the authoritative record. `evidence/g4-closeout/repro/` holds the reproduction's own evidence |

## Deviations, findings and workarounds, with where each was established

| Id | What | Established by |
|---|---|---|
| **LANE-DEV-1** | compactc `0.33.0` substituted for `-rc.2`; inherited, owner-approved, never re-pinned | `evidence/*/04-lane-dev-1.out` |
| **D-306** | offers publish as the **UNBOUND** (`pre-binding`) form; the bound form is a proven fallback | G1 spike S3, cross-checked against S1 |
| **D-307** | the step ledger is PARTITIONED across three fresh Managers on one chain | G3, forced by F-310; **owner ratification wanted (Q03-1)** |
| **F-301** | node `104` = `InvalidError::Transcript`; descending merged segment order is NECESSARY (and sufficient for a genuine read-after-write); for disjoint pairs refusals concentrate on new-key insertion | G1 spike S2, replicated across four runs (shape B: 23/23 ascending accepted, 25/25 descending refused) |
| **F-306** (amended by G4) | post-hoc re-keying of a merged transaction's segments is **state-dependent**: refused **12/12** with `235` in the canonical G1 run, **accepted 12/12** in the G4 clean-clone reproduction of the same code. Mechanism (hypothesis, with support): a re-key moves `fallibleOffer` entries only if they exist, so it is harmless when the zswap items are GUARANTEED and fatal when they are FALLIBLE — i.e. it is governed by the same cost budget as F-308/F-310. Conclusion unchanged and stronger: segment assignment is a build-time decision and the mitigation belongs upstream | G1 spike S2 + the G4 reproduction |
| **F-302** | the inherited tree does not typecheck at the base commit — a defect in the pinned TYPES, reproduced identically in the 00005 clone. Handled by subtracting exactly that one baseline error and failing if it stops reproducing | G1 Phase 1 |
| **F-303** | `validateTransaction` cannot validate a contract-call transaction on this lane; its refusal is a FALSE NEGATIVE, so the step is recorded and **never gates** | G1 spike S1 |
| **F-304** | `Transaction.segments()` is not bound to JS, so the FR-302 "no other segment" assert had to reimplement it — the first version silently degraded to "segment 0 looks right" | G1 spike S1 |
| **F-305** | two shielded deposits of the SAME colour cannot be built in one contract-scoped batch | G1 spike S2 |
| **F-307** | a contract DEPLOY budget on this lane is ~**13 provable circuits** (60.1% of the per-block `bytesWritten` ceiling; 14 circuits at 64.7% is refused). v3 had 12, so v4's budget was ONE new circuit and the two FR-308 shapes were merged into it | G2, four probe contracts deployed live |
| **F-308** | lane issue 0003 observed LIVE: an offer's value leg goes fallible once the wanted colour already has a pool, and FR-302 failed closed | G2 gate run 1 |
| **F-309** | refusal codes decoded from the pinned node source: `239`, `228`, `104`, plus `118`/`129`/`167` | G2 gate run 1 |
| **F-310** | **an offer is publishable only while custody holds ONE shielded cell** — dose-response, monotone, both shapes flipping together, the deciding step adding a CELL with the pool count held at 1 | G2 spike S5b, replicated in three independent runs; **owner decision wanted (Q02-2)** |
| **F-311** | NC-301 is sharper than the spec expected: the published (unbound) offer is refused by the node at DESERIALIZATION (`1`), and the row records refusals at three non-overlapping layers | G3 stage A row 4 |
| **F-312** | the double take (NC-302) is refused with `244` = `ReplayProtectionViolation(IntentAlreadyExists)` — replay protection fires before the spent coin's nullifier is consulted, so the spec's parenthetical "backing coin spent" names a mechanism that is real but second in line | G3 stage A row 6, decoded from `types.rs:411-414` |
| **W-1** | scratch `DOCKER_CONFIG` for every gate (a credential helper can hang). HOST workaround | inherited, step 01 everywhere |
| **W-2** | every gate re-execs under `caffeinate -is`, because this Mac idle-slept mid-gate and the resulting `AbortError` is indistinguishable from a real refusal in an evidence table. A process wrapper around the gate's own tree: no system setting written, nothing asserted changed. **HOST workaround, not a lane property** | 00006 G1 run 2 |

## What is NOT verified

Stated plainly, because a verification document that only lists successes is a marketing document:

1. **The specification's literal 13-row single-Manager step ledger did not run, and cannot at these
   pins.** F-310 caps publishability at one shielded custody cell and row 5's settlement creates the
   second. What ran is D-307's three-stage partition, with every row's exact amounts and assertions.
   The limit itself is evidenced by P-F310 rather than asserted. **Owner ratification is wanted.**
2. **The bearer-key shape (FR-308 v2b) was implemented but NOT RUN.** FR-308 makes openness GREEN if
   EITHER shape settles, and the floating surplus settled. Nothing here says the bearer shape would
   fail; it answers no open question and would have spent a shared host's proof server for nothing.
   Recorded in `evidence/g2-spikes/S4b.md`.
3. **The unshielded swap family is out of scope** (FR-310, owner Q3 → A): it is an EXTENDED GOAL for a
   follow-up numbered project. No unshielded swap circuit exists in this contract.
4. **Whether pool COUNT alone crosses the publishability boundary was not isolated.** S5b's steps 3–4
   grow pools and cells together; only the cell-count sufficiency is claimed (step 2 holds the pool
   count at 1).
5. **The transcript-cost reduction that might buy more cells was not attempted** — it changes the
   contract the owner-REQUIRED openness result rests on, and its payoff is unmeasured. That is
   question **Q02-2**, left for the owner.
6. **`104` for the staleness case, as FR-311 predicted, was not observed** — the lane answers `239`,
   3/3 in G2 and again in G3. The measured rule is what is asserted.
7. **The S5 timing arm at T600 was not measured** and is not claimed. T60 (accepted) and T1800
   (accepted) were; a timing arm must SETTLE to answer its question, and a settlement exhausts the
   one-cell budget, so only one long arm is possible per Manager — which is itself F-310.
8. **`171`** (sibling issue 0002) remains undecoded: it is not in the `InvalidError` arm of the
   pinned node's error enum.
9. **The mechanism behind F-306's amendment is a HYPOTHESIS, not a measurement.** Spike S2's
   post-hoc segment rewrite was refused 12/12 in the canonical run and accepted 12/12 in the
   clean-clone reproduction of the same code. The explanation offered — that a re-key is harmless when
   the pair's zswap items are in the guaranteed section and fatal when they are fallible, i.e. the same
   cost budget as F-310 — is supported by the code path and by the two runs' state-growth figures, but
   the discriminating measurement (placement recorded per rewrite attempt) was **not taken**. Nothing
   the specification asks for depends on it: 00006's maker transaction is a single call.
9. **Nothing here is a statement about a supported lane.** `EXPERIMENTAL_LANE` / `LANE-DEV-1`
   throughout, on a local fresh dev chain, with two HOST workarounds active.

`EXPERIMENTAL_LANE` / `LANE-DEV-1`
