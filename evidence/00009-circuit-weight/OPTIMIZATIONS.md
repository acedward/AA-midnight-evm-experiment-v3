# 00009 Phase 2 — optimization arms, measured and priced

**MEASUREMENT-ONLY.** Compile (`--skip-zk`) plus `zkir-v3 mock-compile`, under the bounds in
`PROTOCOL.md`, plus a keyless simulator parity suite. Zero prover keys, zero verifier keys, zero
proofs, zero deployments, zero promotions. `contracts/manager.compact` stayed byte-identical
(`85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858`) throughout.

Baseline: **k=20, 974,572 rows**. k=19 requires **rows ≤ 524,288**.

## Complete results

| Arm | Class | Altered frozen surface | K | Rows | Δrows | % saved | Parity (29 tests) | Verdict |
|---|---|---|---:|---:|---:|---:|---|---|
| **o2-custody-mux** | SEMANTICS-PRESERVING | none | 20 | 873,643 | 100,929 | 10.36% | **29/29 PASS** | **VALID — the only promotable saving measured** |
| o1-domain-sep-ledger | claimed preserving | none *intended* | 20 | 944,270 | 30,302 | 3.11% | 7 FAIL | **REJECTED — semantically wrong (see below)** |
| o3-combo-conservative | o1 + o2 | none *intended* | 20 | 843,341 | 131,231 | 13.47% | 7 FAIL | contains o1; unusable as stated |
| o4-unified-eip712 | SPEC-CHANGE | wallet-signed bytes | 20 | 818,327 | 156,245 | 16.03% | 8 fail (expected) | largest single spec lever |
| o5-semantic-snark-hash | SPEC-CHANGE | emitted event bytes | 20 | 846,291 | 128,281 | 13.16% | 4 fail (expected) | far weaker than assumed |
| o6-semantic-slim-preimage | SPEC-CHANGE | emitted event bytes | 20 | 928,683 | 45,889 | 4.71% | 4 fail (expected) | keeps keccak recomputability |
| **o7-combo-max** | SPEC-CHANGE | both | 20 | **558,814** | 415,758 | **42.66%** | 9 fail (expected) | **lowest K demonstrable — still k=20** |

Every arm: compile exit `0`, measure exit `0`, `WATCHDOG_TIMEOUT=0`, `KEY_FILES=0`, nine provable
circuits (surface unchanged). No arm failed to compile.

## The headline: k≤19 is NOT reachable with this set

| Configuration | Rows | K | vs 2^19 = 524,288 |
|---|---:|---:|---:|
| Product baseline | 974,572 | 20 | +450,284 |
| Best with **no spec change** (o2) | 873,643 | 20 | +349,355 |
| Best with **every** measured optimization (o7) | **558,814** | **20** | **+34,526 (6.18% short)** |
| o7 with the invalid o1 removed (derived) | ≈589,116 | 20 | ≈+64,828 |

Even composing every spec change this project measured — a unified EIP-712 type *and* a
SNARK-friendly semantic commitment *and* the custody mux — `execute` lands **34,526 rows above**
the k=19 ceiling. The 2 GiB prover-key loader threshold behind blocker 00008-Q2 is therefore **not
reachable by in-circuit optimization of the single `execute` gateway alone**, on this toolchain.

## o1 / brief Step 2a — REJECTED, and the reason matters

The optimization brief flags Step 2a as conditional: *"Only possible if `kernel.self()` is usable
in the constructor at the pinned compactc — verify; if not, skip."* The arm **compiles cleanly**,
which reads as a pass. It is not one.

`kernel.self()` inside a constructor returns the **zero address**. Proved directly in the
simulator against the o1 build:

```
CONTRACT_ADDRESS        = f5f031eec2be82744756f7effdaf24e8d9dd42007bcc39c0b07c12ebdd406451
STORED_IN_CONSTRUCTOR   = 9264a688a40c2a33f8356546a6b87abc7b346dffcd17cce7ef57ee38ff06e489
CORRECT_FOR_ADDRESS     = 28426f40fb890b65a814d4186108cc62ab2cc7267f5233aed1cb0296bd87995c
MATCH                   = false
SEPARATOR_FOR_ZERO_ADDR = 9264a688a40c2a33f8356546a6b87abc7b346dffcd17cce7ef57ee38ff06e489
STORED_EQUALS_ZERO_ADDR = true
```

The stored separator is exactly `evmDomainSeparatorFor(0x00…00, domain)`. The keyless parity suite
caught the same thing independently: 7 of 29 tests fail with
`failed assert: EVM registration signature does not verify`.

This is **architecturally inherent, not a compiler bug**: a contract's address is derived from its
initial state, and the constructor is what produces that state, so the address cannot exist while
the constructor runs. The simulator makes the same distinction structurally —
`contract.initialState(createConstructorContext(ps, COIN_PK), …)` carries no address, while circuit
calls go through `createCircuitContext(circuitId, address, …)`.

Step 2a as written is therefore **worse than a no-op**. It would invalidate every existing
signature *and* silently drop the contract-address binding out of the EIP-712 domain separator,
which is what makes the separator cross-contract-replay-resistant in the first place. Its 30,302
rows could only be bought some other way — e.g. a one-time post-deploy `initialize` circuit, which
costs an extra verifier key and is outside this project's scope.

**Consequence for the other arms:** o3 and o7 both embed o1. Because the arms are additive to
within one row (see below), the valid figures are o3 → o2 alone (873,643, measured) and o7 →
≈589,116 (derived). Neither changes the k≤19 verdict.

## o5 — the "SNARK-friendly hash" premise is largely refuted

Questions-file Option C rested on the assumption that computing the FR-031 commitment with
`persistentHash` instead of keccak256 would be the largest available lever, because the semantic
commitment is the heaviest component (366,831 rows, 37.6%).

Measured, it removes only **128,281 rows**. The `persistentHash` versions of the same three hashes
still cost **238,550 rows — 65% of what keccak cost**. `persistentHash` is SHA-256-based on this
backend, so replacing one Merkle–Damgård family with another over the same 1,664 bytes of preimage
buys much less than "SNARK-friendly" suggests. Anyone reasoning about a spec amendment on the
strength of that phrase should read this number first.

## What the measurements say about where cost actually lives

Combining Phase 1 and Phase 2:

| Observation | Evidence |
|---|---|
| Keccak dominates: 69.5% of `execute` is two hashing components | w2 (366,831) + w3 (310,805) |
| A keccak-f permutation costs ≈19,500 rows | o4 removed 8 permutations for 156,245 rows |
| Preimage WIDTH costs ≈90 rows/byte | o6 removed 512 bytes for 45,889 rows |
| Per-CALL overhead is ≈30,000 rows | o4 removed 3 calls + 736 bytes for 156,245 rows |
| Swapping keccak → `persistentHash` saves only ≈35% | o5: 128,281 of 366,831 |
| Branch duplication is real and exactly additive | w5..w9 sum within 20 rows of w4; o3 exact; o7 within 1 row |

The practical rule this yields: **removing a hash CALL is worth ~30k rows plus ~90 rows per byte of
its preimage; changing which hash function you call is worth much less.** That is why o4 (three
fewer calls) beats o5 (same call count, cheaper function) despite the semantic commitment being the
heavier component.

## Additivity — verified three independent times

| Check | Predicted | Measured | Error |
|---|---:|---:|---:|
| w5..w9 legs vs w4 total custody | 189,264 | 189,284 | 20 rows (0.011%) |
| o1 + o2 vs o3 | 131,231 | 131,231 | **0 rows** |
| o1 + o2 + o4 + o5 vs o7 | 558,815 | 558,814 | **1 row** |

This is the model the whole optimization brief rests on — Compact compiles every branch, so costs
add — and it is now measured rather than assumed. It also means K for any untried combination of
these arms can be predicted to within a handful of rows.

## FR-907 frozen-surface check

`scripts/00009/check-frozen-surface.py` extracts all 34 circuits that produce frozen bytes (the
byte codec, the EIP-712 type/domain constants and hashing, and the FR-031 commitment chain) and
compares them verbatim against the product.

| Arm | Result |
|---|---|
| o1-domain-sep-ledger | all 34 verbatim |
| o2-custody-mux | all 34 verbatim |
| o3-combo-conservative | all 34 verbatim |
| o4-unified-eip712 | 1 modified: `evmStructHashFor` |
| o5-semantic-snark-hash | 3 modified: `actionUnionHash`, `semanticCallTranscriptHash`, `semanticCommitmentFromSlots` |
| o6-semantic-slim-preimage | 1 modified: `semanticCommitmentFromSlots` |
| o7-combo-max | 4 modified: the union of o4 and o5 |

Each spec-change arm modifies exactly and only the circuits its header names — no arm changes a
frozen surface silently.

Note that o1 passes this source check while still being semantically wrong: it changes no frozen
*circuit*, it changes the *value fed into one*. That is precisely why the executed parity suite was
worth running and why source inspection alone would have shipped a broken optimization.

## o2 — why it is semantics-preserving

The five-way dispatch compiles a full copy of every helper per branch: 21 `persistentHash` key
derivations, two `sendShielded` sites, duplicated pool guards. o2 muxes the ARGUMENTS instead:
**2** key derivations, one shielded send, one unshielded send, one want-claim.

Preserved, and checked:

- **FR-204 order, for every selector.** The muxed assert sequence — swap sanity → transfer
  destination checks → the per-(account, colour) guard → the pool guard → the swap credit target —
  is a *topological superset* of all five per-selector orders, so no selector's relative assert
  order changes. Every guard still precedes every write; the pool lookup stays inside its guard, so
  selectors 3/4/5 never touch `pools`.
- **The refusal set and every assert message.** The only asserts not carried over are the
  recipient-kind asserts inside `shieldedRecipient` / `unshieldedRecipient` / `swapRecipient`, which
  are already **unreachable** in the product: `assertActionEnvelope` constrains `recipientKind <= 1`
  for selectors 2/3 and `<= 2` for selector 6 before dispatch is reached. Dropping unreachable
  asserts leaves the refusal set identical.
- **Missing cells still read 0** and create nothing.
- **The nine-circuit provable surface**, unchanged.
- **All 34 frozen-byte circuits**, verbatim.
- **Executed byte-equality**: 29/29 parity tests pass.

Also recorded: the brief's Step 4 deduplications (`assertActionEnvelope` ×5→×1, `assertLiveDeadline`,
`ownerCommitment`, `registerAccount`, `evmNonces.insert`, `nativeAuthResult`) are **already applied
in the current product source** — the brief was written against the k=22 source. Only Step 3
remained, and o2 is that step.

## Keyless simulator parity apparatus

- Suites: `src/auth/test/{manager,semantic,compact,codec}.test.ts` — 29 tests covering EIP-712
  alias/account/domain/struct/digest fixtures, MetaMask V4 cross-checks, and deterministic semantic
  commitments for every selector and recipient shape.
- Image: `node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e`
  (`node:22.18.0-bookworm-slim`), pnpm `11.5.1`, `--frozen-lockfile`.
- **Keyless and proofless**: the arms were compiled `--skip-zk`, so no key exists; the runner
  asserts `find generated -name '*.prover' -o -name '*.verifier'` is empty before starting.
- The Manager under test is the only thing that varies; both Minter contracts are the product's own
  sources, compiled once and shared.
- Dependencies were installed into a disposable Docker volume `aa00009_parity_work`, labelled
  `com.docker.compose.project=aa00009_parity`, and removed at teardown. The install step is the
  only network access in the project and is not a measurement.
- Runner: `scripts/00009/parity-suite.sh {setup|run <arm>|teardown}`.

An earlier attempt to reuse the 00008 clone's installed `node_modules` by read-only bind mount was
abandoned: those modules are macOS/arm64 native builds and cannot load in a Linux container. The
frozen-lockfile install is the correct route and takes ~7 s.

## Phase 2 integrity

| Check | Result |
|---|---|
| Product Manager SHA-256 before/after | `85b538bc…` unchanged |
| Prover/verifier files generated | **0** |
| Live proofs / deploys / keygen / remote mutation | none |
| Provable-circuit surface, every arm | exactly the product's nine names |
| Spec-change arms labelled in source header + results | yes, each naming its altered surface |
| Docker residue (containers/volumes/networks/processes) | `0/0/0/0` |
| Measurement concurrency | never more than two at a time |
