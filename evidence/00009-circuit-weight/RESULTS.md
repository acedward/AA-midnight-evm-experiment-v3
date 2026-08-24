# 00009 — circuit weight profiling and K optimization for the AA v3 Manager: RESULTS

**Date:** 2026-08-24
**Scope:** MEASUREMENT-ONLY — `compactc --feature-zkir-v3 --skip-zk` + `zkir-v3 mock-compile`,
plus a keyless simulator parity suite. Zero prover keys, zero verifier keys, zero proofs, zero
deployments, zero remote mutations, zero product promotions.
**Product Manager:** `contracts/manager.compact` SHA-256
`85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` — byte-identical throughout.
**Toolchain:** Compact `0.33.0` / language `0.25.0`,
`aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`.
**Clone:** `experiments/00009-circuit-weight-optimization`, branch
`00009-circuit-weight-optimization` from base `5de5d52d29253684de3230b5330bd43126d05741`.

---

## Headline verdicts

### 1. Lowest K with NO spec change: **k=20, 873,643 rows** (o2-custody-mux)

A 10.36% reduction. It is the only arm in the project that is both a real saving and fully valid:
all 34 frozen-byte circuits verbatim, and **29/29 keyless parity tests pass** — byte-identity
confirmed by execution, not merely by source inspection.

The plan's intended conservative combo (o3 = o1+o2, 843,341 rows) **cannot be used**, because o1 is
rejected — see verdict 3.

### 2. Lowest K per spec-change route

| Route | Rows | K | Reduction | Altered frozen surface |
|---|---:|---:|---:|---|
| o2 only (no spec change) | 873,643 | 20 | 10.36% | none |
| + o4 unified EIP-712 | 818,327 | 20 | 16.03% | wallet-signed bytes |
| + o5 semantic via `persistentHash` | 846,291 | 20 | 13.16% | emitted event bytes |
| + o6 semantic slim preimage | 928,683 | 20 | 4.71% | emitted event bytes |
| **o7 = everything composed** | **558,814** | **20** | **42.66%** | both |

(Rows for o4/o5/o6 are each measured standalone against the baseline; because the arms are additive
to within one row, any combination's rows can be predicted by summing their Δ.)

### 3. Is k≤19 reached? **NO — and not by any combination measured.**

| | Rows | vs 2^19 = 524,288 |
|---|---:|---:|
| Product baseline | 974,572 | +450,284 |
| Best without spec change (o2) | 873,643 | +349,355 |
| **Best with everything (o7)** | **558,814** | **+34,526 — 6.18% short** |
| o7 with the invalid o1 removed (derived) | ≈589,116 | ≈+64,828 |

Composing a unified EIP-712 type *and* a SNARK-friendly semantic commitment *and* the custody mux
still lands **34,526 rows above** the k=19 ceiling. **The 2 GiB prover-key loader threshold behind
blocker 00008-Q2 is not reachable by in-circuit optimization of the single `execute` gateway on
this toolchain.**

What remains after o7 cannot close that gap without another spec change of similar size: ECDSA +
address recovery is 49,132 rows and is irreducible (ZKIR-v3 cannot lower guarded secp ops), and
about 58,520 rows are envelope validation, registration and nonce logic.

### 4. Brief Step 2a is REJECTED — a clean compile is not the verification it looks like

`kernel.self()` returns the **zero address** inside a constructor. Arm o1 compiles cleanly and then
silently stores `evmDomainSeparatorFor(0x00…00, domain)`. This is architecturally inherent — a
contract's address is derived from its initial state, which the constructor produces — not a
compiler bug. Adopting it would invalidate every signature *and* strip the contract-address binding
out of the EIP-712 domain separator. Details in `OPTIMIZATIONS.md`; filed as questions-file Q2.

### 5. "SNARK-friendly hash" is largely a false lever here

Replacing the entire keccak commitment chain with `persistentHash` saves only 128,281 of the
366,831 rows the chain costs. `persistentHash` is SHA-256-based on this backend and still costs
**65%** of keccak for the same preimage. The assumption behind the original questions-file Option C
is measured and largely refuted.

---

## Merged results table

Baseline `execute`: **k=20, 974,572 rows**. k=19 requires ≤ 524,288 rows.

| Arm | Kind | Class | K | Rows | Δrows | % saved | Parity (29) | Verdict |
|---|---|---|---:|---:|---:|---:|---|---|
| **w0-baseline** | baseline | product | 20 | 974,572 | — | — | 29/29 PASS | GATE GREEN — ZKIR/BZKIR byte-identical to 4R |
| w1-ecdsa-noop | ablation | — | 20 | 925,440 | 49,132 | 5.04% | — | secp verify + address recovery |
| w2-semantic-noop | ablation | — | 20 | 607,741 | **366,831** | **37.64%** | — | heaviest component |
| w3-eip712-noop | ablation | — | 20 | 663,767 | **310,805** | **31.89%** | — | second heaviest |
| w4-custody-noop | ablation | — | 20 | 785,288 | 189,284 | 19.42% | — | all five legs |
| w5-action-withdraw-shielded-noop | ablation | — | 20 | 934,360 | 40,212 | 4.13% | — | selector 2 |
| w6-action-withdraw-unshielded-noop | ablation | — | 20 | 962,959 | 11,613 | 1.19% | — | selector 3, lightest leg |
| w7-action-transfer-shielded-noop | ablation | — | 20 | 955,529 | 19,043 | 1.95% | — | selector 4 |
| w8-action-transfer-unshielded-noop | ablation | — | 20 | 955,529 | 19,043 | 1.95% | — | selector 5, identical to w7 |
| w9-action-openswap-noop | ablation | — | 20 | 875,219 | 99,353 | 10.19% | — | selector 6, heaviest leg (2.5×) |
| **o2-custody-mux** | optimization | SEMANTICS-PRESERVING | 20 | **873,643** | 100,929 | 10.36% | **29/29 PASS** | **VALID — promotable in principle** |
| o1-domain-sep-ledger | optimization | claimed preserving | 20 | 944,270 | 30,302 | 3.11% | 7 FAIL | **REJECTED — zero-address defect** |
| o3-combo-conservative | optimization | o1+o2 | 20 | 843,341 | 131,231 | 13.47% | 7 FAIL | unusable — contains o1 |
| o4-unified-eip712 | optimization | SPEC-CHANGE (wallet bytes) | 20 | 818,327 | 156,245 | 16.03% | 8 fail (expected) | largest single spec lever |
| o5-semantic-snark-hash | optimization | SPEC-CHANGE (event bytes) | 20 | 846,291 | 128,281 | 13.16% | 4 fail (expected) | premise largely refuted |
| o6-semantic-slim-preimage | optimization | SPEC-CHANGE (event bytes) | 20 | 928,683 | 45,889 | 4.71% | 4 fail (expected) | keeps keccak recomputability |
| **o7-combo-max** | optimization | SPEC-CHANGE (both) | 20 | **558,814** | 415,758 | **42.66%** | 9 fail (expected) | **lowest demonstrable — still k=20** |

Every arm: compile exit `0`, measure exit `0`, `WATCHDOG_TIMEOUT=0`, `KEY_FILES=0`, nine provable
circuits. Per-arm artifact hashes are in `WEIGHTS.md` (ablations) and the raw logs (all arms).

## Weight ranking — where the rows actually are

| Rank | Component | Rows | Share |
|---:|---|---:|---:|
| 1 | FR-031 semantic commitment | 366,831 | 37.64% |
| 2 | EIP-712 chain (domain sep + struct hash + 0x1901) | 310,805 | 31.89% |
| 3 | Custody dispatch, all five legs | 189,284 | 19.42% |
| 4 | secp256k1 verify + address recovery | 49,132 | 5.04% |
| — | Unattributed (envelope, registration, nonce, disclosure) | 58,520 | 6.00% |

**Keccak is 69.5% of the circuit.** Within custody: open swap 99,353 · withdraw-shielded 40,212 ·
transfer-shielded 19,043 · transfer-unshielded 19,043 · withdraw-unshielded 11,613.

## Cost model derived from the measurements

| Rule | Derived from |
|---|---|
| A keccak-f permutation ≈ **19,500 rows** | o4 removed 8 permutations for 156,245 rows |
| Preimage width ≈ **90 rows/byte** | o6 removed 512 bytes for 45,889 rows |
| Per-hash-CALL overhead ≈ **30,000 rows** | o4 removed 3 calls + 736 bytes for 156,245 rows |
| keccak → `persistentHash` saves only ≈35% | o5: 128,281 of 366,831 |

Practical rule: **removing a hash CALL is worth ~30k rows plus ~90 rows per preimage byte; changing
which hash function you call is worth far less.** This is why o4 (three fewer calls) beats o5 (same
call count, cheaper function) even though the semantic commitment is the heavier component.

## Additivity — verified three independent times

| Check | Predicted | Measured | Error |
|---|---:|---:|---:|
| w5..w9 legs vs w4 total custody | 189,264 | 189,284 | 20 rows (0.011%) |
| o1 + o2 vs o3 | 131,231 | 131,231 | **0** |
| o1 + o2 + o4 + o5 vs o7 | 558,815 | 558,814 | **1** |

Compact compiles every branch, so component costs add. This was the optimization brief's core
assumption; it is now measured. It also means K for any untried combination of these arms is
predictable to within a few rows.

## Relationship to the Phase 4S split route

Phase 4S measured `openSwapShieldedAuthorized` standalone at k=20 / 620,754 rows while the other
six gateways reached k≤19. 00009 independently confirms open swap is the heaviest custody leg by
2.5× (99,353 rows). Separately, the 00008 evidence correction of 2026-08-24
(`STAGED-VERIFIER-REGISTRATION.md`, commit `910be31`) reclassified that route's key count from
**RED** to **STAGED DEPLOYMENT REQUIRED / LIVE UNVERIFIED**, so key count is no longer the split's
blocker — K alone is. Whether the split becomes viable therefore reduces to one measurable
question: can `openSwapShieldedAuthorized` be brought from 620,754 rows under 524,288? o2's custody
mux and o4 are the arms to try. This project did not attempt it (out of scope).

## Integrity and hygiene

| Check | Result |
|---|---|
| Product Manager SHA-256 before/after | `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` — unchanged |
| Prover/verifier files generated | **0** |
| Live proofs / deployments / keygen / remote mutation | **none** |
| Push to any remote | **none** — push URL disabled on both remotes (`NO_PUSH_FORBIDDEN_00009`) |
| 00008 clone modified | **no** — read-only fetch only; its tracked tree and untracked state unchanged |
| Provable-circuit surface, all 16 arms | exactly the product's nine names |
| Spec-change arms labelled in source and results | yes, each naming its altered surface |
| Docker residue (containers/volumes/networks/processes) | **0/0/0/0** |
| Watchdog timeouts / OOM / unbounded retries | none |
| Measurement concurrency | never more than two |
| Marker ports | random, confirmed free, > 10000, one per run |

## Evidence index

| File | Contents |
|---|---|
| `PROTOCOL.md` | pins, bounds, exact commands, Phase 0 gates |
| `WEIGHTS.md` | Phase 1 ablation table, artifact hashes, additivity, compiler finding |
| `OPTIMIZATIONS.md` | Phase 2 arms, o1 rejection proof, cost model, parity apparatus |
| `RESULTS.md` | this file — merged table and headline verdicts |
| `diffs/<arm>.diff` | per-arm minimal diff against the product source |
| `raw/<arm>.compile.log` | pinned compile record per arm — **local only, see note** |
| `raw/<arm>.measure.log` | pinned `mock-compile` record per arm — **local only** |
| `raw/<arm>.parity.log` | keyless simulator suite output per arm — **local only** |

**Note on `raw/`:** this repository's standing convention gitignores raw container captures
(`.gitignore:19`, `evidence/**/raw/` — "curated evidence is committed, raw captures are not"). This
project followed that convention rather than overriding it, so the 44 runner logs (240 KB) are
retained in the working clone but not committed. Nothing is lost from the record: every value those
logs carry — k, rows, ZKIR/BZKIR byte counts and SHA-256, exit status, watchdog flag, key-file
count, marker port, wall time, and the exact command — is transcribed into the committed curated
files above, which is what FR-905 requires. Any log can be regenerated by re-running the two
commands at the end of this file.

Reproduce any number with:

```sh
bash scripts/00009/compile-arm.sh <arm> contracts/variants/<arm>.compact "$(bash scripts/00009/free-port.sh)"
bash scripts/00009/measure-arm.sh <arm> "$(bash scripts/00009/free-port.sh)" execute 900
```
