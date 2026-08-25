# Removal manifest — 2026-08-25 repository reorganization

This repository used to be a research workspace: four frozen predecessor projects, the measurement
records behind every number, twenty-odd contract variants compiled only to count circuit rows, and
five generations of live-node apparatus. It is now the product's source code.

**Nothing was lost.** Everything listed below is reachable in this repository's own history at the
annotated tag:

```
research/pre-reorg          -> commit 0846438 (the PR #7 merge, pre-reorganization main)
```

Browse it on GitHub, or get any of it back locally:

```sh
git show research/pre-reorg:evidence/00010-manager-k19/PROTOCOL.md
git checkout research/pre-reorg -- contracts/variants   # a whole tree
git log --follow -- <path>                              # a file's history, moves included
```

`1,101` tracked files before, `42` after (plus the untracked build output under
`tests/generated/`). Everything removed is enumerated here — no path was dropped without a line in
this file.

---

## Removed: predecessor snapshots and measurement records

| path | files | what it was |
|---|---:|---|
| `archive/00003/` … `archive/00006/` | 773 | Complete frozen snapshots of the four predecessor projects — their contracts, harnesses, evidence and reports, copied wholesale so each project could be re-read without checking out an old commit. Git does that job better. |
| `evidence/00008-AA-v3-evm/`, `evidence/00009-circuit-weight/`, `evidence/00010-manager-k19/` | 105 | Measurement and verification records: the circuit-weight study that found where `execute`'s rows went, the k=19 gate results, the keygen and loader-ceiling proofs, the tag-rename verification. Their conclusions are now stated in the README as facts about the contract; the working papers behind them belong in history. |

The SRS parameter pins the README quotes (five `bls_midnight_2p{8,9,13,16,19}` files, 114,968,468
bytes total) were recorded in `evidence/00010-manager-k19/PROTOCOL.md`; `scripts/keygen.sh` now
carries the same list in its header, so the pin survives the removal.

## Removed: measurement variants

| path | files | what it was |
|---|---:|---|
| `contracts/variants/` | 62 | Contract arms that exist only to be compiled and measured, never deployed: `w1`–`w9` (ablation — delete one mechanism, see the row count fall), `d01`–`d31` (per-mechanism decomposition), `o1`–`o7` (optimization candidates), `e1` (big-endian encoders — the winning arm, since folded into the product), `probe-*` (unit-cost probes), `v4-slim`. They answered "where do the rows go?"; the answer is in the product. |

## Removed: live-node research apparatus

None of this is test code — it is programs run with `tsx` against a real chain.

| path | files | what it was |
|---|---:|---|
| `harness/src/g1/` | 11 | Wallet creation and funding, UTXO diagnostics, the first swap spikes |
| `harness/src/g2/` | 12 | Deploy ordering, deploy-cost diagnostics, the Manager view helpers, spikes S4–S6 |
| `harness/src/g3/` | 14 | The 18-row ledger walk against a live chain: providers, observers, metrics, rendering |
| `harness/src/g4/` | 1 | Swap run report generator |
| `harness/src/g5/` | 11 | The mitigation matrix: variant loading, placement model, ranking and fail-closed verdicts |
| `harness/src/swap/` | 10 | Maker/taker processes and the staged swap runner |
| `harness/src/offer/` | 4 | The proof-carrying offer envelope kit and its taker gates |
| `harness/src/phase4/`, `harness/src/phase4s/` | 2 | The Phase 4 live matrix and its measurement shim |
| `harness/src/*.ts` | 6 | `contracts.ts`, `lane.ts`, `manager-view.ts`, `night.ts`, `node-error.ts`, `wallet.ts` — the plumbing underneath all of the above. Removed **only after checking mechanically that every importer was one of the directories above**. |
| `scripts/g1/`–`scripts/g5/` | 13 | Gate wrappers that drove those rigs |
| `scripts/phase4/`, `scripts/phase4r/` | 2 | Phase 4 live runner and its pnpm workspace override |
| `docker/phase4/compose.yml` | 1 | A second stack definition with a different proof-server digest, for one experiment |

## Removed: superseded scripts

Replaced by the six self-documented scripts in `scripts/`.

| path | files | replaced by |
|---|---:|---|
| `scripts/lib/` | 7 | `compactc.sh` → folded into `scripts/compile.sh`; `stack.sh` → `scripts/test-integration.sh`; `lane-pins.sh`, `docker-w1.sh`, `failsafe.sh`, `loadgate.sh`, `nosleep.sh` → apparatus for the removed gate wrappers |
| `scripts/00009/` | 14 | Measurement drivers for the row study: arm generators, batch measurement, decomposition and unit-model analysis. The one durable capability — measuring a circuit's k and rows — is `scripts/measure-k.sh`. |
| `scripts/00010/` | 8 | `compile-arm.sh` → `scripts/compile.sh`; `measure-arm.sh` → `scripts/measure-k.sh`; `keygen.sh` → `scripts/keygen.sh`; `loader-verify.{sh,mjs}` → `scripts/verify-loader.sh` + `scripts/loader-verify.mjs`; `parity-suite.sh` → `scripts/test-sim.sh`; `free-port.sh` → inlined; `strip-comments.py` → a one-off verification tool for a comment-only edit |
| `scripts/typecheck.sh` | 1 | `pnpm --dir tests typecheck`. The script existed solely to tolerate one inherited type error in `harness/src/wallet.ts`; with that file gone the typecheck is clean, and the script would now fail its own "the expected inherited error did not appear" guard. |

## Removed: test suites (triaged individually)

Every suite under the old `harness/src/test/` was **compiled and run against the current Manager**
before a verdict was written. Four ported unchanged and are now in `tests/simulation/`; three were
retired:

| file | tests | why it was retired |
|---|---:|---|
| `offer-envelope.test.ts` | 26 | Tests the proof-carrying offer envelope format and the taker's fail-closed gates — a predecessor project's feature. No circuit in `contracts/manager.compact` knows about it, and its dependencies (`offer/envelope.ts`, `offer/take.ts`) pull in the removed node rig. |
| `g5-variants.test.ts` | 16 | Asserts guard order, refusal state-neutrality and value conservation **across the seven measurement arms**, i.e. across `contracts/variants/`. With no arms there is nothing to compare; every property it checked on the product itself is checked by the ported `swap.test.ts` and `custody-guards.test.ts`. |
| `g5-verdicts.test.ts` | 7 | Regression tests for the measurement rig's own verdict logic, driven by JSON fixtures under `evidence/g5-mitigation/`. Both the logic and the fixtures are gone. It tested the apparatus, not the contract. |

Ported instead (for completeness): `manager.test.ts` → `tests/simulation/custody-guards.test.ts`
(25 tests), `minter.test.ts` (17), `swap.test.ts` (39), `step-ledger.test.ts` (14), `sim.ts` →
`tests/lib/sim.ts`, and `harness/src/g3/expected.ts` → `tests/fixtures/step-ledger-table.ts`
(**restored** from the `g3/` removal — it is a hand-transcribed spec table with no imports, i.e. a
frozen fixture, and `step-ledger.test.ts`'s only input).

Net: the fast tier went from 49 tests in 6 files to **151 tests in 12 files**.

---

## What was kept, and why

| path | why it stays |
|---|---|
| `contracts/manager.compact` | The product. Byte-unchanged by this reorganization. |
| `contracts/test-support/` | The two Minters. Test-only, but the simulation tier cannot mint a token without them. |
| `docker/compactc.Dockerfile` | The toolchain provenance record — the pinned archive SHA-256 every artifact in the repository descends from. |
| `docker/compose.yml` | The one local Midnight stack. The only recipe here for running the contract for real. |
| `tests/**` | The suites, the shared codec/simulator library, and the frozen fixtures. |
| `scripts/**` | Six commands, each with its reasoning in its own header. |
