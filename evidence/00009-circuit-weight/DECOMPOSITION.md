# 00009 Phase 4 — per-circuit row decomposition

**MEASUREMENT-ONLY.** Every number here comes from `compactc --feature-zkir-v3 --skip-zk` followed
by `zkir-v3 mock-compile`, under the bounds in `PROTOCOL.md`. Zero prover keys, zero verifier keys,
zero proofs, zero deployments. `contracts/manager.compact` was never modified (SHA-256
`85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` throughout).

**Scope note (owner direction, 2026-08-24).** The owner has explicitly DEFERRED the Q3 route
decision until this decomposition lands. This document therefore **enumerates and prices
optimization opportunities and does NOT select or recommend any of them, or any route.** Where an
opportunity would change bytes that are currently frozen, that is stated; it is not weighed.

Mechanical sources: `scripts/00009/unit-model.py` → `raw/unit-model.txt` (unit costs);
`scripts/00009/decompose.py` → `raw/decomposition.txt` (every table below). Per-arm runner logs are
in `raw/`, per-arm diffs in `diffs/`.

---

## 0. The headline

| | |
|---|---|
| `execute` | **k=20, 974,572 rows — 94.3% of every provable row in the contract** |
| All eight other provable circuits combined | 58,892 rows, every one already at k≤16 |
| Largest single cross-cutting cost | **byte-order reversal: 272,847 rows = 28.00% of `execute`** |
| Largest single named sub-component | the 1024-byte FR-031 final preimage: 260,752 rows = 26.76% |
| Total validation logic (envelope, auth, deadline, registration, nonce) | **661 rows = 0.07%** |

**The Phase 2 cost model was wrong and is superseded by this phase.** It held that a keccak-f
permutation costs ≈19,500 rows and a hash CALL ≈30,000. Measured directly: a permutation is
**4,176** rows and a call is **free**. What actually costs is *moving bytes*: a `Bytes<32>` is held
packed, and any operation that touches its individual bytes — splicing it into a hash preimage,
reversing it, slicing it — forces a full byte decomposition. `execute` is not an expensive circuit
because it hashes a lot. It is expensive because it *serialises* a lot.

---

## 1. All provable circuits (task 4.1)

Mock-compiled from the retained w0-baseline compile output; `execute` reuses the Phase 1 gate
measurement. All exit `0`, `WATCHDOG_TIMEOUT=0`, `KEY_FILES=0`.

| Circuit | K | Rows | % of `execute` | Real s |
|---|---:|---:|---:|---:|
| `execute` | 20 | 974,572 | 100.00% | 97.19 |
| `depositShielded` | 16 | 42,239 | 4.33% | 0.83 |
| `depositUnshielded` | 13 | 7,918 | 0.81% | 0.23 |
| `shieldedAccountBalance` | 13 | 4,001 | 0.41% | 0.17 |
| `unshieldedAccountBalance` | 13 | 4,001 | 0.41% | 0.16 |
| `accountRecord` | 9 | 316 | 0.03% | 0.18 |
| `poolValue` | 8 | 159 | 0.02% | 0.10 |
| `isRegistered` | 8 | 129 | 0.01% | 0.11 |
| `poolHasColour` | 8 | 129 | 0.01% | 0.12 |

Total provable rows in the contract: **1,033,464**. The K problem is `execute` and nothing else.

---

## 2. The unit-cost model (task 4.2)

110 probe circuits across `contracts/variants/probe-{hashing,plumbing,state}.compact`. Because a
circuit that reads no ledger state compiles to no ZKIR, **every probe carries exactly one
`probeSet.member(...)` ledger touch** whose argument is the probe's result — that forces a ZKIR and
keeps the measured work live. A matched CONTROL of identical shape and identical argument types
measures that touch, so every unit below is `rows(probe) − rows(control)`.

**The control's own cost is 129 rows**, and it measures identically in all three probe files — and
identically to the product's own `isRegistered`, which is exactly that shape. That is what makes
unit costs from different probe files directly comparable.

### 2.1 Cost laws

| Law | Value | Fit quality |
|---|---|---|
| `keccak256` over N bytes | `−55 + 4,176·ceil((N+1)/136) + 0.25·N` rows | **max error 8 rows** across a 32→1024 B sweep |
| one keccak-f permutation | **4,176 rows** | from the (135 B, 136 B) pair — one permutation apart, one byte apart |
| per-hash-CALL overhead | **≈0** | `h_kec_64` / `_x2` / `_x3` are exactly linear |
| splicing one VARIABLE 32-byte word into a preimage | **≈4,514 rows** (≈141 rows/byte) | 4,576 / 4,527 / 4,517 / 4,512 at 2 / 4 / 8 / 16 words |
| splicing a CONSTANT word into a preimage | **0 rows** | `p_asm_n16_half_const` pays for 8 words, not 16 |

The word-splice figure decomposes further: roughly half is DECOMPOSING the packed word into bytes
(paid once per word per circuit, and shared between every preimage that word appears in) and
roughly half is ABSORBING it into one specific preimage (paid per preimage). This is why an
in-situ ablation of one hash removes less than the isolated unit suggests — see §5.

### 2.2 Unit table

| Unit | Rows | Note |
|---|---:|---|
| ledger touch (`Set.member` + one `Bytes<32>` argument) | **129** | the canonical minimum provable circuit |
| unused `Bytes<32>` circuit argument | 88 | ≈2.375 rows/byte + ~12 fixed |
| `keccak256` 32 B / 136 B / 384 B / 1024 B | 4,127 / 8,327 / 12,565 / 33,601 | 1 / 2 / 3 / 8 permutations |
| **`reverseBytes32`** | **9,426** | byte-level access to a packed `Bytes<32>` |
| **`slice<32>(Bytes<32>, 0)`** | **9,426** | identical cost — the permutation itself is free wiring |
| `uint64Word` / `uint128Word` / `uint8Word` | **9,423** each | the `as Bytes<32>` cast alone is 113 |
| `addressWord` (`Bytes<20>` → word) | 2,939 | |
| `bytes32LexicographicLt` | 38,205 | four 16-byte reversals |
| `persistentHash<Vector<3,Bytes<32>>>` (`shieldedKey`) | **3,767** | 1/2/8-element forms: 1,883 / 3,661 / 9,401 |
| `persistentCommit<Bytes<21>>` (`ownerCommitment`) | 1,895 | |
| `persistentHash<SwapCoinPreimage>` (coin commitment) | 5,659 | |
| `sendShielded` | 22,945 | |
| `mergeCoinImmediate` | 17,228 | 2 zswap inputs + 2 nullifiers + output + commitment |
| `receiveShielded` / `coin-Map.insertCoin` | 5,665 / 5,691 | |
| `secp256k1EcdsaVerify` / `secp256k1EthereumAddress` | 28,731 / 31,588 | additive: both = 59,987 |
| `Bytes<32>` equality / mux | 7 / 2 | **free** |
| `Uint<128>` comparison / mux | 2 / 25 | **free** |
| 6-way constant mux (`frozenTypeHash` shape) | 18 | **free** |
| `blockTimeGte` + `blockTimeLt` | 52 | **free** |
| `Map`/`Set` `member` / guarded lookup / `insert` / `remove` | 19 / 52 / 17 / 12 | **free** |
| `kernel.self()` | 19 | **free** |
| `createZswapInput` / `createZswapOutput` / kernel claims / `evolveNonce` | 28 / 0 / 15–30 / 188 | **free** |
| `receiveUnshielded` / `sendUnshielded` / `unshieldedBalanceGte` | 35 / 44 / 53 | **free** |

### 2.3 Two findings that fall out of the probes

**(a) The compiler does NOT common-subexpression identical pure circuit calls.** `s_balance_debit`
calls the same `probeKey(a, c)` three times and pays 3 × 3,767 rows. The product has exactly this
shape everywhere: `shieldedBalanceOf` derives the key, and the caller then derives it again for the
`insert`.

**(b) Constant preimage words are free.** Domain tags, type hashes and zero padding cost nothing to
splice. Only variable words are charged.

---

## 3. `execute` — the decomposition (tasks 4.3, 4.4)

31 nested ablation arms (`d01`–`d31`), each a minimal anchored diff over the product source with a
conspicuous non-shipping header; all compile exit `0` with the nine-circuit provable surface intact
and all stay k=20. Diffs in `diffs/d*.diff`.

### 3.1 Disjoint decomposition — no part counted twice

| Group | Sub-component | Rows | Measured/Derived | % of circuit | Arm | Why (primitive counts) |
|---|---|---:|---|---:|---|---|
| FR-031 semantic | semantic commitment chain (incl. `nativeAuthResult`) | 366,831 | Measured | 37.64% | `w2-semantic-noop` | 3 keccak calls, 13 permutations, ~50 variable words, 19 endianness encoders — split in §3.2 |
| EIP-712 | `evmStructHashFor` (all four branches) | 267,303 | Measured | 27.43% | `d07` | 39 words across 4 branches + 4 `addressWord` + 13 `uintNWord` + keccak(12 perms) |
| custody | five-way custody dispatch, all legs | 189,284 | Measured | 19.42% | `w4-custody-noop` | 21 key derivations + 2 `sendShielded`-class ops — split in §3.4 |
| EIP-712 | `evmDomainSeparatorFor` | 34,562 | Measured | 3.55% | `d06` | keccak(32 B) + `slice<20>` + `addressWord` + 5-word/160 B preimage (3 const, 2 var) + keccak(2 perms) |
| secp256k1 | `secp256k1EthereumAddress` | 27,622 | Measured | 2.83% | `d15` | pubkey decode + keccak(1 perm) + `slice<20>` |
| secp256k1 | `secp256k1EcdsaVerify` | 21,282 | Measured | 2.18% | `d14` | one guarded secp verify, compiled straight-line |
| EIP-712 | `eip712Digest` (the `0x1901` step) | 13,175 | Measured | 1.35% | `d08` | 2-word/66 B preimage + keccak(1 perm) |
| EIP-712 | `evmAccountIdFor` | 9,133 | Measured | 0.94% | `d13` | 4-word/128 B preimage (1 const) + `addressWord` + keccak(1 perm) |
| envelope + auth | `ownerCommitment(localOwnerSecret())` | 1,970 | Measured | 0.20% | `d19` | 1 witness read + 1 `persistentCommit` |
| envelope + auth | `authenticatedActionAccount` + `gatewayAccount` | 255 | Measured | 0.03% | `d18` | 7 map member/lookup + 4 equality asserts |
| envelope + auth | `assertActionEnvelope` (all 7 selector shapes) | 204 | Measured | 0.02% | `d16` | ~60 equality/zero asserts on packed fields |
| envelope + auth | `registerAccount` + `evmOwners.insert` | 99 | Measured | 0.01% | `d21` | 3 asserts + 3 ledger inserts |
| envelope + auth | `assertLiveDeadline` | 58 | Measured | 0.01% | `d17` | 1 subtraction + `blockTimeGte` + `blockTimeLt` |
| envelope + auth | checked nonce increment + `evmNonces.insert` | 45 | Measured | 0.00% | `d22` | 1 add + 1 assert + 1 mux + 1 insert |
| — | **unattributed residual** | **42,749** | **Derived** (by subtraction) | 4.39% | — | payload argument encoding, the recipient muxes, `disclose` of the 16-field envelope, and the SHARED byte decompositions that survive every individual ablation (see §5) |

**Attributed: 931,823 of 974,572 rows = 95.61%. Residual 42,749 = 4.39%, inside the <5% target.**

### 3.2 FR-031 semantic chain — nested split (366,831 rows total)

`d02` strictly contains `d01`; `d03` strictly contains `d02`. "Own" rows subtract the nested arm.

| Sub-component | Rows | M/D | % of chain | Arms | Why (primitive counts) |
|---|---:|---|---:|---|---|
| `semanticCommitmentFromSlots` (own) | **260,752** | Measured | 71.08% | `d03` − `d02` | 32-word/1024 B preimage (2 const, 30 var) + 9 `uintNWord` + 1 `addressWord` + keccak(8 perms) |
| `actionUnionHash` | 40,960 | Measured | 11.17% | `d01` | 12-word/384 B preimage (all var) + 1 `addressWord` + 4 `uintNWord` + keccak(3 perms) |
| `bytes32LexicographicLt` (open-swap slot ordering) | 37,817 | Measured | 10.31% | `d05` | 4 × 16-byte endianness reversals |
| `semanticCallTranscriptHash` (own) | 18,237 | Measured | 4.97% | `d02` − `d01` | 8-word/256 B preimage (2 const, 6 var) + 1 `uint8Word` + 6-way constant mux + keccak(2 perms) |
| `Misc` event payload assembly | 13,312 | Measured | 3.63% | `d04` | 8-word/256 B splice (7 const, 1 var), no hash — `Misc.payload` is fixed at `Bytes<256>` |
| `nativeAuthResult` | 4,441 | Measured | 1.21% | `d20` | 2-word/64 B preimage (1 const) + keccak(1 perm) |
| | **375,519** | | | | vs w2's 366,831 — **residual −8,688 (−2.37%)**, over-attribution from shared decompositions (§5) |

### 3.3 EIP-712 struct hash — per-selector branches (267,303 rows total)

Every branch compiles unconditionally, so all four are always paid.

| Branch | Rows | M/D | % of struct hash | Arm | Why |
|---|---:|---|---:|---|---|
| selector 6 — open swap (448 B, 4 perms) | **92,636** | Measured | 34.66% | `d12` | 14 words: 1 const type hash, 1 `addressWord`, 2 `uint64Word`, 2 `uint128Word`, 1 `uint8Word` |
| selector 2/3 — withdraw (320 B, 3 perms) | 78,329 | Measured | 29.30% | `d10` | 10 words: 1 muxed type hash, 1 `addressWord`, 2 `uint64Word`, 1 `uint128Word`, 1 `uint8Word` |
| selector 4/5 — transfer (288 B, 3 perms) | 64,401 | Measured | 24.09% | `d11` | 9 words: 1 muxed type hash, 1 `addressWord`, 2 `uint64Word`, 1 `uint128Word` |
| selector 1 — register (192 B, 2 perms) | 27,670 | Measured | 10.35% | `d09` | 6 words: 2 const, 1 `addressWord`, 1 `uint64Word` |
| **sum of branches** | 263,036 | | | | vs `d07`'s 267,303 — **residual +4,267 (+1.60%)** |

Whole EIP-712 chain: domain separator 34,562 + struct hash 267,303 + digest 13,175 = **315,040**
vs Phase 1's w3 at **310,805** — **residual −4,235 (−1.36%)**.

### 3.4 Custody dispatch (189,284 rows total)

Per leg — an exact partition (Phase 1; leg sum 189,264 vs w4 189,284, residual **20 rows**):

| Leg | Rows | M/D | % of custody | % of `execute` |
|---|---:|---|---:|---:|
| `openSwapShielded` (selector 6) | 99,353 | Measured | 52.49% | 10.19% |
| `withdrawShielded` (selector 2) | 40,212 | Measured | 21.24% | 4.13% |
| `transferInternalShielded` (selector 4) | 19,043 | Measured | 10.06% | 1.95% |
| `transferInternalUnshielded` (selector 5) | 19,043 | Measured | 10.06% | 1.95% |
| `withdrawUnshielded` (selector 3) | 11,613 | Measured | 6.14% | 1.19% |

Cross-cutting attributions inside custody — these **overlap the legs above and each other** and do
NOT sum to custody:

| Sub-component | Rows | M/D | Arm | Why |
|---|---:|---|---|---|
| every `shieldedKey` derivation reached from `execute` | **48,971** | Measured | `d23` | **13** static call sites × `persistentHash<Vector<3,Bytes<32>>>` at 3,767 — no CSE |
| `claimWantedColour` (the swap's WANT leg) | 41,863 | Measured | `d27` | `receiveShielded` + merge-or-create pool + credited balance write |
| every `unshieldedKey` derivation reached from `execute` | **30,136** | Measured | `d24` | **8** static call sites × 3,767 — no CSE |
| `sendShielded` inside `withdrawShielded` | 28,716 | Measured | `d25` | zswap input + nullifier + 2 outputs + 2 coin commitments |
| open-swap surplus machinery (the `recipientA = none` shape) | 17,211 | Measured | `d26` | `createZswapInput` + nullifier transcription + `evolveNonce` + output + commitment + 2 claims |
| `mergeCoinImmediate` in the WANT leg | 17,196 | Measured | `d30` | 2 zswap inputs + 2 nullifiers + 1 output + 1 commitment |
| `repoolOrRemove` (pool write-back, both branches) | 11,413 | Measured | `d29` | `insertCoin` (5,691) + `remove` (12), both compiled |
| `assertSwapPreconditions` (the four-stage guard block) | 3,901 | Measured | `d28` | 1 `shieldedBalanceOf` (3,767 of it is the key) + 2 pool guards + 1 `Set.member` + 3 sanity asserts |

### 3.5 Cross-cutting — the endianness bill

`d31-reversebytes32-noop` makes `reverseBytes32` the identity and changes nothing else: every call
site, every preimage and every keccak still compiles.

| Sub-component | Rows | M/D | % of `execute` | Why |
|---|---:|---|---:|---|
| **every `reverseBytes32` reached from `execute`** | **272,847** | Measured | **28.00%** | 32 static `uint64Word`/`uint128Word`/`uint8Word` call sites, no CSE — 8,526 rows each in situ (9,423 in isolation) |

This cuts ACROSS §3.1: it sits inside the EIP-712 struct hash (13 sites), `actionUnionHash` (4), the
call transcript (1) and the final semantic preimage (14). It is **not** an extra 272,847 rows on top
of them. It is the single largest *mechanism* in the circuit.

---

## 4. The eight other circuits — DERIVED decompositions

No per-part ablation exists for these; every row is **DERIVED** from the §2.2 unit table and the
measured total is the check. Residuals are ≤0.9% throughout.

| Circuit | Measured | Derived sum | Residual | Dominant part |
|---|---:|---:|---:|---|
| `depositShielded` | 42,239 | 42,321 | −82 (−0.19%) | `mergeCoinImmediate` 17,228 (40.8%) + 2 `insertCoin` 11,382 + 2 `shieldedKey` 7,534 + `receiveShielded` 5,665 |
| `depositUnshielded` | 7,918 | 7,962 | −44 (−0.56%) | 2 × `unshieldedKey` = 7,534 (95.2%) |
| `shieldedAccountBalance` | 4,001 | 4,036 | −35 (−0.87%) | `shieldedKey` 3,767 (94.2%) |
| `unshieldedAccountBalance` | 4,001 | 4,036 | −35 (−0.87%) | `unshieldedKey` 3,767 (94.2%) |
| `accountRecord` | 316 | 316 | 0 | 129 frame + 187 for six map ops and three struct returns |
| `poolValue` | 159 | 159 | 0 | 129 frame + 30 guarded coin-map read |
| `isRegistered` | 129 | 129 | 0 | this circuit IS the control probe |
| `poolHasColour` | 129 | 129 | 0 | same shape, coin map |

Full per-part tables are in `raw/decomposition.txt`.

---

## 5. Reconciliation and model validation (task 4.4)

### 5.1 Residuals

| Reconciliation | Sum of parts | Whole | Residual | |
|---|---:|---:|---:|---|
| `execute` disjoint decomposition | 931,823 | 974,572 | **+42,749 (4.39%)** | under-attributed |
| FR-031 semantic nested split vs w2 | 375,519 | 366,831 | −8,688 (−2.37%) | over-attributed |
| EIP-712 branch sum vs `d07` | 263,036 | 267,303 | +4,267 (+1.60%) | under-attributed |
| EIP-712 chain (d06+d07+d08) vs w3 | 315,040 | 310,805 | −4,235 (−1.36%) | over-attributed |
| secp (d14+d15) vs w1 | 48,904 | 49,132 | +228 (+0.46%) | |
| custody legs (w5..w9) vs w4 | 189,264 | 189,284 | **20 rows (0.011%)** | |

**Every residual is inside the 5% target, and they all have one cause.** A `Bytes<32>` is
decomposed into bytes once per circuit and that decomposition is SHARED by every preimage the word
enters. So:

* an ablation that removes *one* of several consumers frees only the ABSORB half of the word cost
  (≈2,257), because the decomposition is still needed by the survivors — that is why the disjoint
  table *under*-attributes by 42,749: those shared decompositions survive every single ablation and
  are only freed when the last consumer goes;
* conversely, when several ablations are summed, each one claims the shared decompositions it
  happened to free — that is why the nested splits *over*-attribute by 1–2%.

Both signs are the same effect seen from opposite ends, and the effect is real rather than noise:
`d01` (removing `actionUnionHash` while the final preimage still needs its 12 words) measures
40,960 = 12 × 2,366 absorb + keccak(384 B) 12,565 — **within 3 rows**.

### 5.2 Unit-model validation on targets it was NOT fitted on

| Target | Predicted from §2.2 | Measured | Error | Composition used |
|---|---:|---:|---:|---|
| every `shieldedKey` reached from `execute` (`d23`) | 48,971 | 48,971 | **0 (0.00%)** | 13 static call sites × 3,767 |
| every `unshieldedKey` reached from `execute` (`d24`) | 30,136 | 30,136 | **0 (0.00%)** | 8 static call sites × 3,767 |
| `transferInternalShielded` leg (Phase 1 `w7`) | 19,044 | 19,043 | **−1 (−0.01%)** | 5 keys + 3 guarded reads + 2 `Map.insert` + 1 `Set.member` |
| `transferInternalUnshielded` leg (Phase 1 `w8`) | 19,044 | 19,043 | **−1 (−0.01%)** | same shape, other family |
| `withdrawShielded` leg (Phase 1 `w5`) | 40,181 | 40,212 | +31 (+0.08%) | 3 keys + 2 reads + `sendShielded` + pool ops + BOTH repool branches + insert |
| `withdrawUnshielded` leg (Phase 1 `w6`) | 11,519 | 11,613 | +94 (+0.81%) | 3 keys + 2 reads + `unshieldedBalanceGte` + `sendUnshielded` + insert |
| `bytes32LexicographicLt` in situ (`d05`) | 38,205 | 37,817 | −388 (−1.03%) | 4 × 16-byte reversal, from probe `p_lexlt` |
| `ownerCommitment` in situ (`d19`) | 1,895 | 1,970 | +75 (+3.81%) | 1 `persistentCommit<Bytes<21>>` |
| `shieldedAccountBalance` (product circuit) | 4,036 | 4,001 | −35 (−0.87%) | frame + 2 args + `persistentHash<V3>` + guarded read |
| `depositUnshielded` (product circuit) | 7,962 | 7,918 | −44 (−0.56%) | frame + 3 args + 2 keys + read + insert + `receiveUnshielded` |
| `h_asm_384_mixed` (= `actionUnionHash` verbatim) | 108,250 | 108,515 | +265 (+0.24%) | 12 args + 12 word splices + 5 encoders + keccak(384 B) |

The plan required predicting **at least two** arms the model was not fitted on. Eleven are recorded,
two of them exact to the row, four inside 1%.

---

## 6. Logical optimization opportunities — enumerated and priced, NOT selected

Ranked by measured ceiling. **Nothing here is a recommendation.** "Ceiling" is what the measurement
shows the sub-component costs today; the achievable fraction is stated per item and is not always
the whole ceiling. "Affected frozen surface" uses the mechanical check in
`scripts/00009/check-frozen-surface.py`, which confirms each arm modifies at most one of the 34
frozen-byte circuits.

| # | Mechanism | Ceiling (rows) | % of `execute` | Affected frozen surface | Expected from the unit model |
|---:|---|---:|---:|---|---|
| 1 | **Big-endian-native integer encoding.** `uint64Word`/`uint128Word`/`uint8Word` are `reverseBytes32(value as Bytes<32>)`; the cast costs 113 rows and the reversal 8,526 in situ, because touching a packed word at byte granularity forces a full decompose+recompose. Producing the big-endian word directly from the integer would skip the second pass. 32 call sites, no CSE. | **272,847** | 28.00% | **NONE** — confirmed by execution, not by inspection | **MEASURED IN PHASE 5 — 267,216 rows, 97.94% of the ceiling, and it changes no frozen byte.** Arm `e1-bigendian-encoders` = k=20 / **707,356 rows** (−27.42% of baseline), keyless parity **29/29 PASS**. See §8. |
| 2 | **Shrink the 1024-byte FR-031 final preimage.** 32 words, 30 variable, 9 encoders unique to it, 8 permutations. 22 of its words duplicate fields already committed through `callHash`. | 260,752 | 26.76% | **FR-031 semantic commitment bytes** (SPEC-CHANGE) | ≈4,514/word removed (≈2,257 if the word survives elsewhere) + 4,176/permutation. Phase 2's `o6` measured a partial instance at 45,889. |
| 3 | **Unify the four EIP-712 struct-hash branches into one.** All four compile unconditionally: 92,636 + 78,329 + 64,401 + 27,670. | 267,303 | 27.43% | **EVM wallet-signed bytes** (SPEC-CHANGE; this is questions-file Q1 option B) | Phase 2's `o4` measured a concrete instance at 156,245. |
| 4 | **Remove selector-6 (open swap) from this gateway.** Its EIP-712 branch (92,636) plus its custody leg (99,353) are compiled for every call regardless of selector. | 191,989 | 19.70% | NONE cryptographically; the **contract ABI** changes and deployment needs staged verifier-key registration | Structural; this is the Phase 4S split route, already measured there. |
| 5 | **De-duplicate the 21 key derivations.** 13 `shieldedKey` + 8 `unshieldedKey` static calls at 3,767 each; the compiler does not CSE them. Each leg needs 1–2 distinct keys. | 79,107 | 8.12% | **NONE** (key bytes unchanged; a hoist placed after the guard it feeds preserves FR-204 order) | Hoisting 13+8 → 5+3 leaves 30,136, i.e. **≈48,971 saved**. Phase 2's `o2` already captures much of this (measured −100,929 overall, 29/29 keyless parity). |
| 6 | **Replace `bytes32LexicographicLt` in the semantic slot ordering** with any cheaper total order. | 37,817 | 3.88% | **FR-031 semantic commitment bytes** (slot order is committed) — SPEC-CHANGE | Measured directly (`d05`); a `Bytes<32>` inequality costs 7 rows. |
| 7 | **`evmDomainSeparatorFor` computed once.** | 34,562 | 3.55% | NONE if the separator bytes are unchanged | **The obvious mechanism is closed**: `o1` stores it in a constructor cell, and `kernel.self()` returns the ZERO address in a constructor (questions-file Q2, RESOLVED). Any other mechanism costs a new circuit and a verifier key. |
| 8 | **Mux branch-duplicated stdlib coin calls.** `claimWantedColour` calls `pools.insertCoin` in BOTH arms of a merge-or-create `if`; both compile. `repoolOrRemove` has the same shape. | ≈5,691 per collapsed site | 0.58% | NONE | 5,691/`insertCoin`. Same principle as `o2`. |
| 9 | **Fewer `sendShielded` / `mergeCoinImmediate` calls.** These are stdlib compositions (coin commitment 5,659, nullifier 5,659); the only lever is calling them fewer times. | 28,716 / 17,196 | 2.95% / 1.76% | NONE, but the transaction's zswap structure changes if a call is dropped | Measured in situ (`d25`, `d30`). |
| 10 | **Drop `evmAccountIdFor` from non-registration paths.** Only selector 1 needs it. | 9,133 | 0.94% | The EVM account-id derivation is frozen; removing the CALL from an action-only gateway changes nothing | Only realisable under a split (opportunity 4). |
| 11 | **`Misc` event payload assembly.** 13,312 rows to splice one variable word into a 256-byte payload whose other 7 words are free constants. | 13,312 | 1.37% | FR-031 event encoding | **No in-circuit mechanism**: `Misc.payload` is fixed at `Bytes<256>` by the runtime. |
| 12 | **secp256k1 — IRREDUCIBLE.** `secp256k1EthereumAddress` 27,622 + `secp256k1EcdsaVerify` 21,282. | 48,904 | 5.02% | n/a | **No mechanism.** The pinned ZKIR-v3 backend cannot lower guarded secp operations, so both compile straight-line and always run. Listed so it is not proposed again. |
| 13 | **Validation logic — ALREADY FREE.** `assertActionEnvelope` 204 + `authenticatedActionAccount` 255 + `registerAccount` 99 + `assertLiveDeadline` 58 + nonce 45. | **661 total** | **0.07%** | n/a | **No opportunity exists here.** Any proposal to "simplify the asserts", trim the envelope, or relax a guard is worth at most 0.07% of the circuit — and FR-204 guard order is load-bearing. |

### 6.1 What the decomposition says that the aggregate deltas did not

1. **The dominant mechanism is serialisation, not hashing.** Opportunities 1, 2, 3 and 5 are all
   the same physics: bytes being decomposed, reversed and spliced. Keccak-f itself is 4,176 rows —
   the 13 semantic permutations total 54,288, under 15% of the semantic chain's 366,831.
2. **Opportunity 1 was invisible to Phase 1 and Phase 2** because no w- or o-arm isolated the byte
   encoders; it is the largest single mechanism in the circuit, and on its face it changes no
   frozen byte. **Phase 5 measured it: 267,216 rows — 97.94% of the ceiling — with 29/29 executed
   byte-equality.** See §8; the scope note below is superseded for opportunity 1 only.
3. **Two of the previously-assumed levers are dead ends.** "Simplify validation" is worth 0.07%,
   and "use a SNARK-friendly hash" was already measured at only −128,281 in Phase 2 — because it
   swaps the cheap part (the permutation) while leaving the expensive part (the preimage
   serialisation) untouched.
4. **The residual is not slack.** The 42,749 unattributed rows are mostly shared byte
   decompositions of the payload's own fields; they are freed only when the LAST consumer of a word
   is removed, which is why composed optimizations can beat the sum of their parts here — the
   opposite of the exact additivity Phase 2 observed for whole-component ablations.

---

## 7. Phase 4 integrity

| Check | Result |
|---|---|
| Product Manager SHA-256 before/after | `85b538bc…` unchanged |
| Prover/verifier files generated | **0** — `KEY_FILES=0` on every one of the 183 retained runs |
| Live proofs / deploys / keygen / remote mutation | none |
| Compile exits ≠ 0 | 0 of 34 retained |
| Measure exits ≠ 0 | 0 of 149 |
| Watchdog timeouts / OOM / retries | none |

**One compile failure occurred and is recorded rather than hidden.** The first revision of
`probe-plumbing.compact` failed to compile, exit `255`:

```
Exception: probe-plumbing.compact line 218 char 42:
  potential witness-value disclosure must be declared but is not:
    witness value potentially disclosed:
      the value of parameter t of exported circuit p_blocktime_gte at line 217 char 46
    nature of the disclosure:
      the call to standard-library circuit blockTimeGte might disclose the lower bound of the
      time being checked the witness value
```

`blockTimeGte` / `blockTimeLt` compare against a value the caller supplies, so the pinned compiler
requires that value to be explicitly `disclose`d. The probe was corrected to
`blockTimeGte(disclose(t))` — which is what the product's own `assertLiveDeadline` effectively does,
since its argument arrives from an already-`disclose`d payload — and recompiled exit `0`. No
measurement was affected: the failure was at authoring time, before any arm was measured.
| Provable-circuit surface, every d-arm | exactly the product's nine names |
| Measurement concurrency | never more than two at a time |
| Marker ports | one random confirmed-free loopback port > 10000 per run |
| Docker residue attributable to this project | containers/volumes/networks/processes `0/0/0/0` |
| Push to any remote | none; push URL disabled on both remotes |

---

## 8. Phase 5 — the encoder ceiling, measured (owner Q4 Option A, 2026-08-24)

Phase 4 could only price opportunity 1 as a CEILING: arm `d31` made `reverseBytes32` the identity
and measured 272,847 rows (28.00% of `execute`), but `d31` produces DIFFERENT bytes, so it priced
the mechanism without implementing it. Phase 5 implemented a big-endian-native encoder that emits
IDENTICAL bytes and measured what fraction of that ceiling is actually purchasable on Compact
0.33.0 / language 0.25.0.

**Answer: 97.94% of it, with no frozen byte moved.**

| Quantity | Value |
|---|---:|
| Baseline `execute` (`w0`) | 974,572 |
| `e1-bigendian-encoders` `execute` | **707,356** (k=20) |
| Saving | **267,216 rows = 27.42% of baseline** |
| `d31` ceiling | 272,847 |
| **Achievable fraction** | **97.94%** |
| Keyless byte-equality parity | **29/29 PASS** (control `w0` re-run 29/29 in the same session) |

### 8.1 Why the old encoder was expensive

`uintNWord(v)` is `reverseBytes32(v as Bytes<32>)`: cast the integer to a full 32-byte
little-endian word, then permute all 32 bytes. But 24, 16 or 31 of those bytes are KNOWN ZERO, and
this backend charges only for VARIABLE bytes. The product was paying a 32-byte decompose plus a
32-byte recompose to move at most 16 bytes of real content.

### 8.2 Candidates and their measured cost (40 probe circuits, `probe-encoders`)

Comparability is proven, not assumed: this probe file's canonical ledger-touch control measures
**129** (as in all three Phase 4 probe files and the product's `isRegistered`), its cast-only
controls reproduce Phase 4 exactly (**212 / 226 / 242**) and its verbatim copies of the product
encoders reproduce Phase 4 exactly (**9,635 / 9,649 / 9,665**).

Conversion cost = rows(probe) − rows(matched cast-only control), directly comparable to 9,423:

| Candidate | Construction | u8 | u64 | u128 |
|---|---|---:|---:|---:|
| baseline | `reverseBytes32(v as Bytes<32>)` | 9,423 | 9,423 | 9,423 |
| **A** | narrow cast + `Bytes[...]` with literal-zero prefix | **149** | **2,390** | **4,718** |
| B | wide cast, index only the significant bytes | 291 | 2,518 | 4,830 |
| **C** | the product's own `addressWord` idiom (`slice<32>([...pad(n,""), ...rev], 0)`) | **−145** | 3,454 | 6,998 |
| D | explicit `Vector<32, Uint<8>> as Bytes<32>` | 149 | 2,390 | 4,718 |
| W1 | witness supplies the whole `Bytes<32>`; circuit constrains all 32 bytes | 9,171 | 9,178 | 9,186 |
| W2 | witness supplies the n significant bytes; circuit constrains n | 153 | 3,416 | 6,912 |

C's negative figure at u8 is real: 31 of the 32 output bytes are compile-time constants, so the
encode-and-use is cheaper than a plain little-endian cast of the same integer. **D compiles to
exactly A** — identical row counts at all three widths.

In-situ (each encoder spliced into a 64-byte keccak preimage; control splices a ready `Bytes<32>`):

| Form | u8 | u64 | u128 |
|---|---:|---:|---:|
| control — splice a ready word | 13,531 | 13,545 | 13,561 |
| product encoder | 22,976 | 22,990 | 23,006 |
| candidate A | 9,291 | 16,052 | 18,304 |
| candidate C | **9,003** | 17,026 | 20,554 |
| E — direct splice, no `Bytes<32>` intermediate | **9,003** | **12,579** | **16,131** |

`e1` therefore uses **C for `uint8Word`, A for `uint64Word` and `uint128Word`** — the best measured
pure encoder at each width.

### 8.3 Three verdicts worth not re-discovering

1. **Arithmetic big-endian extraction (`v / 256^k % 256`) is NOT EXPRESSIBLE.** Compact 0.25's only
   binary arithmetic operators are `+`, `-`, `*`. Verbatim, from compiling
   `contracts/variants/probe-encoders-div.compact` (exit `255`):
   ```
   Exception: probe-encoders-div.compact line 19 char 21:
     parse error: found "/" looking for "||", "&&", "==", "!=", "as", "+", "-", "*", "[", ".", ",",
     ")", ":", "?", "=", "+=", "-=", "<", "<=", ">=", ">", "(", or a generic argument list
   ```
   There is no way to emit big-endian bytes without decomposing the integer into bytes; the only
   question the language leaves open is HOW MANY bytes are decomposed and repacked.
2. **The witness-hint ("verify, don't compute") encoder is expressible and REFUTED.** W1 saves only
   237–252 rows (~2.6%): pinning all 32 output bytes costs the same full decomposition the reversal
   was paying for. W2 is a genuine saving but is strictly worse than the pure candidate A at every
   width, while additionally adding a private input to the circuit's witness interface. **On this
   backend verification is not cheaper than computation, because the cost is byte decomposition and
   verification pays it too.**
3. **`d31`'s 272,847 was never a true upper bound.** `d31` removed only the byte permutation and
   still spliced a full 32-variable-byte word into every preimage; a narrow encoder additionally
   makes the SPLICE cheaper. The in-situ probes predicted 284,076 (104% of the "ceiling"); the
   measured 267,216 came in 6.31% under that prediction, with the sign and cause §5 already
   documents — isolated probes charge each site a full decomposition, while the product shares some
   decompositions between consumers.

### 8.4 The arm

`contracts/variants/e1-bigendian-encoders.compact` — 58 changed lines: the non-shipping header plus
**exactly one hunk** replacing the three encoder bodies. `reverseBytes32` itself is left
byte-for-byte in place (`bytes32LexicographicLt` still needs its 16-byte sibling). The site
inventory was verified mechanically: **32 sites — 12 `uint8Word`, 10 `uint64Word`, 10
`uint128Word`**, distributed `evmStructHashFor` 13 · `semanticCommitmentFromSlots` 14 ·
`actionUnionHash` 4 · `semanticCallTranscriptHash` 1.

`check-frozen-surface.py` reports 3/34 frozen circuits MODIFIED, and they are exactly the three
encoders. That is the correct result and not a failure: a source-verbatim check cannot certify byte
equality for a REIMPLEMENTED circuit. This is the one arm in the project where the executed parity
suite is doing the whole job — and it passed 29/29, including `pure.evmDigestFor` against the frozen
KAT digest and `pure.semanticCommitmentFor` against the independently-computed oracle.

### 8.5 DERIVED — the split `openSwapShieldedAuthorized` gateway

**Not measured.** The 4S split source belongs to project 00008 and rebuilding it was outside Phase
5's task list. Assumptions: (1) a selector-6-only gateway folds `evmStructHashFor` to its
selector-6 branch alone — supported by 4S's own numbers, where `withdrawShieldedAuthorized` is
389,808 against the monolith's 974,572; (2) the semantic chain is unchanged in every gateway.
Surviving encoder sites: **24** (`uint8Word` 11, `uint64Word` 5, `uint128Word` 8).

| Derivation | Saving | Implied gateway rows | vs 2^19 = 524,288 |
|---|---:|---:|---|
| Site model × e1's measured 0.9407 realisation factor | 212,600 | **408,154** | **116,134 under** |
| Uniform average (8,350.5 rows/site × 24) — conservative | 200,412 | **420,342** | **103,946 under** |
| FLOOR — semantic-chain sites only (14 of 24), every EIP-712 site ignored | 135,900 | **484,854** | **39,434 under** |

All three clear k=19, including the deliberately pessimistic floor, because the gateway starts only
96,466 rows (18.4%) above the ceiling. **This is DERIVED arithmetic, not a measurement, and no route
is selected — Q3 remains deferred.** The obvious next measurement is to rebuild the 4S split with
these encoders and measure it directly.

DERIVED, secondary: `e1` + `o2` composed predicts ≈**606,427** rows for the monolith — still 82,139
above 2^19. Not measured. The headline verdict is unchanged: **the monolithic `execute` does not
reach k≤19 without a spec change.** What changed is that the split route now has a large, valid,
no-spec-change lever available to it.

### 8.6 Phase 5 integrity

| Check | Result |
|---|---|
| Product Manager SHA-256 | `85b538bc…` — unchanged |
| Prover/verifier files anywhere in the clone | **0** (`KEY_FILES=0` on all Phase 5 runs) |
| Compile exits ≠ 0 | 2, both recorded: the div/mod probe (the candidate's verdict) and one authoring-time `Field`/`Uint` equality slip |
| Measure exits ≠ 0 | **0 of 42** |
| Watchdog timeouts / OOM / retries | none |
| Provable-circuit surface, `e1` | exactly the product's nine names |
| Measurement concurrency | serial — never more than one at a time |
| Marker ports | one random confirmed-free loopback port > 10000 per run |
| Parity volume | torn down, `residual_volumes=0` |
| Docker residue attributable to this project | containers/volumes/networks/processes `0/0/0/0` |
| Push to any remote | none; push URL disabled on both remotes |
