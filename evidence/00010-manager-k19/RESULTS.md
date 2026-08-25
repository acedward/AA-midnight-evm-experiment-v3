# 00010-manager-k19 — RESULTS

Project: implement the owner-selected route (e1 + o2 + Tier-3) in the product Manager, measure it,
prove security parity, audit the Tier-3 consumers, and test the actual 00008-Q2 loader mechanism
with one gated bounded key generation.

**Headline: every gate passed.**

| # | Gate | Result |
|---|---|---|
| SC-101 | Composed Manager measured `k<=19` | **PASS — `k=19`, 382,770 rows**, 27.0% under the 2^19 ceiling |
| SC-102 | EIP-712 KATs, custody/negative parity, oracle equality | **PASS — 45/45 keyless tests**, A/B against the real k=20 artifact |
| SC-103 | Consumer audit: zero event-trusting consumers | **PASS** |
| SC-104 | One bounded keygen; key < 2 GiB; pinned loader reads it | **PASS — 1,141,041,775 B, loader `OVERALL=PASS`** |
| SC-105 | No push; sibling clones untouched; zero residue; organizer files current | **PASS** |

---

## 1. The 00008-Q2 story, end to end

Blocker 00008-Q2: the k=20 Manager's `execute.prover` is **2,282,126,073 bytes**, and the pinned
Node loader (`@midnight-ntwrk/midnight-js-node-zk-config-provider@5.0.0-beta.6`, whose `readFile`
returns `fs/promises.readFile(target)` as one Buffer) refuses any file above 2,147,483,648 bytes with
`RangeError [ERR_FS_FILE_TOO_LARGE]`. The overshoot was only **6.3%**.

| Stage | k=20 (the blocker) | k=19 (this project) |
|---|---:|---:|
| `execute` rows | 974,572 | **382,770** (−60.72%) |
| `execute` k | 20 | **19** |
| `execute.prover` bytes | 2,282,126,073 | **1,141,041,775** |
| …as a fraction of the 2 GiB ceiling | **106.3% — REFUSED** | **53.1% — LOADS** |
| Pinned loader `getProverKey` | `ERR_FS_FILE_TOO_LARGE` | **OK** (4,266 ms) |
| `ZKConfigRegistry.buildConfig` | never reached | **OK** (4,041 ms) |

**The mechanism is demonstrated fixed.** And it is demonstrated, not inferred: the verification runs
a **control** in the same process, same Node build (v22.18.0) and same API — `fs/promises.readFile`
pointed at a file of the k=20 key's exact size — which still fails with the exact recorded error:

```
CONTROL_BYTES=2282126073
CONTROL_VERDICT=ERR_FS_FILE_TOO_LARGE: File size (2282126073) is greater than 2 GiB
CONTROL_REPRODUCES_THE_BLOCKER=true
```

So the ceiling is intact and unpatched; what changed is the key. No loader was modified, no heap flag
raised, no streaming shim written.

**Still out of scope, and still the owner's next call:** live proving and deployment. This project
proved the key can be *generated and loaded*. It did not submit a proof or deploy anything.

---

## 2. What was built (Phase 1)

Three measured levers composed into `contracts/manager.compact`. Source SHA-256
`6bf07eb3221a1e0b0bb3d95f5413620f352e01d4a29eb24181609a3115591664`; diff vs the k=20 product in
`diffs/manager-k20-to-k19.diff`.

| Lever | What changed | Standalone measurement (00009) |
|---|---|---:|
| **e1** | `uint8Word`/`uint64Word`/`uint128Word` become big-endian-native — same bytes out, but only the significant bytes are decomposed instead of a full 32-byte word. All 32 call sites benefit. | −267,216 rows |
| **o2** | The five-way per-selector custody dispatch becomes one `custodyDispatch` with one debit leg, one credit leg and shared sends, FR-204 guard order preserved as a topological superset. | −100,929 rows |
| **Tier-3** | `execute` no longer computes or emits the FR-031 semantic commitment. The recipe stays normative as the exported PURE oracle `semanticCommitmentFor` (pure ⇒ no proving key ⇒ free). **The contract now emits no events at all.** | ablation −366,831 rows |

The e1 encoder bodies and the o2 `custodyDispatch` block were verified **byte-identical to the
measured 00009 arms**, so the composition inherits their measurements rather than re-deriving them.

Static evidence that nothing outside `execute` moved:

- **8 of the 9 ZKIRs are byte-identical to the k=20 product.** Only `execute.zkir` changed
  (1,336,032 → 605,053 bytes).
- The exported TypeScript surface `contract/index.d.ts` is **byte-identical** (same 21 entries).
- The compiler's circuit metadata (name, `pure`, `proof`) is identical, including
  `semanticCommitmentFor: pure=true, proof=false` — the oracle still costs no key.

---

## 3. The k gate (Phase 2)

Pinned `zkir-v3 mock-compile`, bounds `cpus:2, memory:8g, memory-swap:8g, rayon:2,
wall-seconds:900, network:none`.

```
Mock compiling circuit "execute.zkir" (k=19, rows=382770)
```

| Quantity | Value |
|---|---:|
| Measured | **k=19 / 382,770 rows** |
| k=19 ceiling (2^19) | 524,288 |
| **Headroom** | **141,518 rows — 27.0% free, 73.0% used** |
| k=20 baseline, re-measured in THIS clone as a control | **k=20 / 974,572** — reproduces 00009 exactly |
| Reduction | **591,802 rows, −60.72%** |
| Mock-compile wall time | 31.91 s, vs 91.66 s for k=20 (2.9× faster) |

ZKIR `524c32a2414b98e6cf348b17e4b76000222930982d4aa6eb287e7df9d0061f42` (605,053 B);
BZKIR `c5b0db2c52bb28507eb84e8f5af615531de240fd532847952c5c0e7e4eff8389` (184,216 B).

### 3.1 Measured vs predicted — both available predictions bracket the result

| Prediction | Value | Measured | Error |
|---|---:|---:|---:|
| Spec headline, "overlap-corrected ≈357k" | ~357,000 | 382,770 | **+25,770 (+7.2%)** |
| 00009 additive unit model (reconstructed below) | 417,144 | 382,770 | **−34,374 (−8.24%)** |

The unit-model reconstruction, stated so it can be checked:

```
974,572  baseline
-366,831  Tier-3 (w2 measured)            = 607,741   (exactly w2's measured value — consistent)
-100,929  o2 (measured)                   = 506,812
- 89,668  e1 on the 13 SURVIVING encoder sites       = 417,144
```

e1 applies only to the 13 sites in `evmStructHashFor` (2 u8, 7 u64, 4 u128); the other 19 vanish
with the semantic chain Tier-3 removes. The site inventory was re-verified mechanically on the
composed source and matches 00009 exactly: 32 sites, 12 u8 / 10 u64 / 10 u128, split
`evmStructHashFor` 13 · `semanticCommitmentFromSlots` 14 · `actionUnionHash` 4 ·
`semanticCallTranscriptHash` 1. In-situ per-site savings from DECOMPOSITION §8.2
(13,973 / 6,938 / 4,702) give 95,320 raw × e1's measured 0.9407 realisation factor = 89,668.

**The error direction is the one 00009 predicted.** Its §5 documents that ablations share byte
decompositions and therefore over-attribute (the semantic chain's parts summed to 375,519 against
w2's measured 366,831, a −2.37% residual), and its 42,749-row unattributed residual is explicitly
"shared byte decompositions that survive every individual ablation". Removing two large consumers at
once collapses more shared cost than either ablation alone reveals, so the additive model
over-predicts. The composed circuit is **smaller** than the sum of its parts suggested.

### 3.2 No regression anywhere else

All eight other circuits measure **identical** to their 00009 values — necessarily, since their
ZKIRs are byte-identical.

| Circuit | k / rows | 00009 | Δ |
|---|---|---:|---:|
| `depositShielded` | k=16 / 42,239 | 42,239 | 0 |
| `depositUnshielded` | k=13 / 7,918 | 7,918 | 0 |
| `shieldedAccountBalance` | k=13 / 4,001 | 4,001 | 0 |
| `unshieldedAccountBalance` | k=13 / 4,001 | 4,001 | 0 |
| `accountRecord` | k=9 / 316 | 316 | 0 |
| `poolValue` | k=8 / 159 | 159 | 0 |
| `isRegistered` | k=8 / 129 | 129 | 0 |
| `poolHasColour` | k=8 / 129 | 129 | 0 |

---

## 4. Security (Phase 3) — 45/45, proven against the real k=20 artifact

The runner mounts the **compiled k=20 product alongside the k=19 build**, and the suites load both
contracts in one process and drive them with identical inputs. FR-1003/FR-1004 byte-equality is
therefore an executed A/B, not a comparison against transcribed numbers.

Arm `contract/index.js` `893df04d…`; reference `1a6cf20d…`.

| Suite | Tests | Result |
|---|---:|---|
| `manager.test.ts` (the pre-existing product suite, event assertions replaced) | 12 | PASS |
| `semantic.test.ts` (independent TS recipe, golden fixtures) | 5 | PASS, unmodified |
| `compact.test.ts` (AuthCodec reference contract) | 5 | PASS, unmodified |
| `codec.test.ts` (MetaMask V4 agreement) | 7 | PASS, unmodified |
| `k20-parity.test.ts` (**new** — A/B vs the k=20 artifact) | 7 | PASS |
| `tier3.test.ts` (**new** — the four Tier-3 claims) | 9 | PASS |
| **Total** | **45** | **45 PASS** |

Keyless throughout: the runner asserts no `.prover`/`.verifier` exists under `generated/` before
vitest starts, and both builds were compiled `--skip-zk`.

### 4.1 What the new suites actually prove

- **EIP-712 byte surface (FR-1003).** Over all 51 fixture cases, `evmAccountIdFor`,
  `evmDomainSeparatorFor`, `evmStructHashFor` and `evmDigestFor` are byte-equal between the two
  artifacts **and** equal to the frozen off-chain codec — so this is not two copies of one drift.
  All six EVM selectors exercised; the native selector-0 shape checked separately.
- **Custody semantics (FR-1004).** Seven custody actions (selector 2 × 2 recipient kinds, 4, 5,
  6 × 3 recipient kinds) run on both builds from identical funded state, comparing the full ledger
  snapshot plus zswap inputs, outputs and effects after every action. The EVM-authorized path
  (registration, withdrawal, nonce-after-custody, replay refusal, expired deadline, wrong-domain
  signature) is compared the same way.
- **Refusals.** A 13-case cross-build negative set requires the **same refusal with the same message
  text** on both builds, byte-identical state before/after on each, and cross-build state equality.
- **Oracle equality.** For every fixture the k=19 oracle, the k=20 oracle and the independent TS
  recipe agree; where `assertActionEnvelope` refuses, **both builds refuse with the same message**.
  The test asserts both halves are non-empty (>40 accepted, >0 refused) so it cannot pass vacuously.
  Six single-field perturbations confirm the commitment binds each transcript field.
- **The one intended difference is asserted, not waved through.** k=20 emits the semantic event,
  k=19 emits nothing — **and the value k=20 emitted is exactly what the k=19 transcript recomputes
  to.** Removing the event lost no information.

### 4.2 Negative control — the new assertions are not vacuous

The identical suite re-run with the **k=20 build as the arm** fails **8 tests, and all 8 are exactly
the "emits no events" assertions**; the other 37 pass. The Tier-3 tests discriminate the two builds
on the intended property and on nothing else.

---

## 5. Tier-3 consumer audit (Phase 4) — SC-103

Full inventory, search commands and per-consumer verdicts in `CONSUMER-AUDIT.md`.

**Verdict: zero event-trusting consumers remain.** Exactly one existed. It was rewritten so that
trusting an event is *not expressible*: `manager-events.ts` now exports only
`assertManagerEmitsNoEvents` (throws on any emitted event, checking the removed name against both
the decoded and degraded raw representations) and `recomputeSemanticCommitment` (computes the
commitment twice — pure oracle and independent TS recipe — and refuses to return unless they agree).
A test pins `Object.keys()` of the module so no reading API can be added silently.

Proven by execution: a **genuine k=20 emitted event** handed to the k=19 reader raises; the
disagreement guard raises when fed a drifted recomputation.

No batcher/browser/relayer/indexer code is tracked at this base commit; those clones were audited
read-only and contain **no semantic-event consumer at all**.

---

## 6. Key generation and the loader (Phase 5)

### 6.1 Authorization, recorded before the attempt

Gates 2/3/4 GREEN; authorized commit `9d36884` with a clean tree; source
`6bf07eb3…`; zero key files in the clone beforehand.

### 6.2 Attempt 1 — failed on an apparatus bound, not on resources

Under the plan's suggested `network:none`, keygen failed in **78.27 s**:

```
Error: Failed to fetch data from https://srs.midnight.network/bls_midnight_2p9 after 3 attempts. Giving up.
```

It had used 436.4 MiB of the 20 GiB cap and 1.1% of the wall allowance. Key generation — unlike
`--skip-zk` compilation and `mock-compile` — needs the universal KZG parameters `bls_midnight_2p<k>`,
which `zkir` fetches on a cold cache. **This is the first operation in this lineage that cannot run
offline from a cold cache**, which is why the bound was inherited from the measurement protocol
without anyone noticing. Filed as question **00010-Q2**; the spec's no-retry rule names the
OOM/timeout class, which this was not.

### 6.3 Attempt 2 — same bounds, parameters pre-supplied, network still none

Resolution: fetch the SRS once in an isolated hash-recorded container, mount it via `MIDNIGHT_PP`,
and keep `--network none` on the keygen container itself. The fetch used the **pinned compiler
image's own `curl`**, so no new image entered the toolchain.

| SRS artifact | Bytes | SHA-256 |
|---|---:|---|
| `bls_midnight_2p8` | 49,540 | `909b707551eaaea79828e883cde6fc46ab15986c3b1d791bed462c9e2805c933` |
| `bls_midnight_2p9` | 98,692 | `b9009f1098bcefffec3c461ab3a5e3a17f7e5599f0f08c70fcdc55a89227bcbd` |
| `bls_midnight_2p13` | 1,573,252 | `d3324910969c4cc54143b8045b649e5c3a4bd5fb7b8f85fe1b770f640ce1c803` |
| `bls_midnight_2p16` | 12,583,300 | `09c877216d6589b370263e18af40a030a901b41a7a7c37ef58c9901db41f05c6` |
| `bls_midnight_2p19` | 100,663,684 | `8e8dc15c4362f05c912f1e770559a3945db3e58a374def416ed5d3e65ad5b10e` |

Exactly the `k` values this contract's nine circuits need. `zkir` verifies each against its own
built-in expected hash, so a substituted file is rejected by the compiler, not merely by these
records.

**Result: exit 0**, wall **128.70 s** of 7,200 s (1.8%), peak observed memory **6.842 GiB of the
20 GiB cap** (34%), `WATCHDOG_TIMEOUT=0`.

### 6.4 The generated key set

Location `harness/generated-00010/k19-keys-srs-prefetched/manager/keys/` — **gitignored, never
committed**; `KEY_FILES_OUTSIDE_GITIGNORED_PATH=0`.

| Circuit | `.prover` bytes | `.prover` SHA-256 | `.verifier` bytes | `.verifier` SHA-256 |
|---|---:|---|---:|---|
| `execute` | **1,141,041,775** | `b021aecaaea714feda07bed44a1870ecf188dac440f097917b25cd2afb7e2010` | 3,321 | `bfda34a7448e9499903cd5dd83527ed988b297b94db196111ccb6f2f04ccc01a` |
| `depositShielded` | 90,187,162 | `e0c31e64795936b1a4a2373d9600a54609ae989e1582d74ea6d896c09a92f7ff` | 2,121 | `95d13f1430248822b5ef28dc0c8b0489286c3497545345a320f740add0a48815` |
| `depositUnshielded` | 11,278,150 | `8b9a9231b98e154b0f6d395d388dc5cb309f109f608f7bec5a359cbdb583419b` | 2,121 | `60b40ab991b61977f1fc9faf121b44061533c22790d391e3d8c98b70f8c17e56` |
| `shieldedAccountBalance` | 11,277,136 | `4f040082ead98faf3c9290dbe9c4ebf71e40b70c61455edc422f55c89f45167e` | 2,121 | `34eac2f1e215a7b955e9b58a2c7d81823fa2c6b1430de6c6d2bd2ae98942b65c` |
| `unshieldedAccountBalance` | 11,277,140 | `e920b6fc8a33a5a753b21d3d1c6c53fabe82b92daffb79a4d6f9c9e14f48aa8a` | 2,121 | `2124b10cd0bdad6af7be02b3b7c5809aee5e3a9f1ad762a7db3ac5abc3eb5b03` |
| `accountRecord` | 446,985 | `36a9339105c0b372314a65829678cad1e8f6ba2cf1d982dbc0dfcca874ea32a8` | 1,353 | `dc43025d98eb7da0e27e3fe19b32cde6e519c4f4ab35359bcda43733d08d4e11` |
| `poolValue` | 224,482 | `d44259956257388f936d012667b5498700e11e03f532c9b7e4483c3cc9ff5568` | 1,353 | `1be4f099c530e6003c12036b9cad0671bc09570b15a18e94dd01c8fba76d3453` |
| `poolHasColour` | 224,200 | `e5fe0ec27b199963cba4c700973f639f039153e76dfc52293ff0e470950e0d53` | 1,353 | `7eec7a11c0ba74b04679ac2f7ab7fac5d2ec63e33e2fb4b3eb820e7f452a05dd` |
| `isRegistered` | 224,194 | `1bb405a59b63325d6aaaf4dad9d3fa5046d3ea17c2c28ccbc8fce706495d7ca4` | 1,353 | `019ca5542d19acc4af7bafcc1282614f5e711eec154a69b8e17111fb6097af13` |

**Total key bytes: 1,266,198,441.**

### 6.5 The loader verification

Node v22.18.0, container `--network none`, no raised heap flag, pinned packages
`midnight-js-node-zk-config-provider@5.0.0-beta.6` and `midnight-js-types@5.0.0-beta.6`.

| Step | Verdict |
|---|---|
| **CONTROL** — `fs/promises.readFile` on a file of the k=20 key's exact size | `ERR_FS_FILE_TOO_LARGE: File size (2282126073) is greater than 2 GiB` — **the ceiling is intact** |
| `NodeZkConfigProvider.getProverKey('execute')` | **OK**, 4,266 ms, 1,141,041,775 B, hash matches the file |
| `ZKConfigProvider.get('execute')` | **OK** — prover 1,141,041,775 · verifier 3,321 · ZKIR 184,216 |
| `ZKConfigRegistry.buildConfig` (`Promise.all`) | **OK**, 4,041 ms, 1,141,229,312 B in memory |
| All nine circuits via `buildConfig` | **OK** — 1,266,181,224 prover bytes total |
| Process RSS after loading | 3,594,788,864 B |
| `OVERALL` | **PASS** |

Artifact integrity was exercised, not bypassed: the provider verifies every artifact against
`compiler/contract-manifest.json` in `mode: 'require'`, and all nine passed.

---

## 7. Integrity

| Check | Result |
|---|---|
| Push to any remote | **none** — push disabled on both remotes via the non-URL sentinel `NO_PUSH_FORBIDDEN_00010`, so `git push` cannot resolve a destination |
| 00009 clone | `4282400`, porcelain 0, `manager.compact` still `85b538bc…` — **untouched** |
| 00008 `w2-contract` clone | `910be31`, porcelain 1 = the pre-existing untracked `harness/generated-zk-u13/` 00009 also recorded — **untouched** |
| 00008 `w2-batcher` / `w2-browser` clones | `3f75193` / `42ad93d`, porcelain 0 — **untouched** (read-only greps only) |
| Key files outside the gitignored path | **0** |
| Key files committed | **0** — `harness/generated-00010/` is gitignored |
| Deployment / live proof / proof submission / remote mutation | **none** |
| New Docker images introduced | **none** — the one probe image pulled while investigating was removed again |
| Toolchain | pinned `aa00006-compactc@sha256:f57ca2d8…` throughout; never re-pinned |

Docker residue is reported as a **delta** because this is a shared machine carrying unrelated state.

| Snapshot | Containers | Volumes | Custom networks | `aa00010*` objects |
|---|---:|---:|---:|---:|
| Baseline before Phase 0 | 15 | 36 | 3 | 0 |
| After Phase 6 teardown | 15 | 36 | 3 | **0** |

---

## 8. Open questions

| # | Question | Status |
|---|---|---|
| 00010-Q1 | After the o2 mux, five leg circuits and three recipient helpers are uncalled dead code. Delete or retain? | **RESOLVED (owner 2026-08-25): option B — DELETE.** Implemented and verified; see §9. |
| 00010-Q2 | Keygen cannot run under `--network none` — it needs the public SRS. How should it obtain it? | **RESOLVED (owner 2026-08-25): option B RATIFIED**, and made the standing workspace practice. SRS now pinned in `PROTOCOL.md`; see §9. |
| 00010-Q3 | `assertSwapPreconditions` / `claimWantedColour` lost their only caller with `openSwapShielded`. Delete them too? | **RESOLVED (owner 2026-08-25): delete — CONDITIONALLY, on first verifying the logic is present in the live mux.** Condition DISCHARGED (10/10 guards and effects mapped, no wiring gap) and option C implemented; see §10 and `Q3-WIRING-VERIFICATION.md`. |

---

## 9. Follow-up: implementing the Q1/Q2 resolutions (2026-08-25)

### 9.1 Q1 → option B: the eight uncalled private circuits are DELETED

Deleted from `contracts/manager.compact`: `withdrawShielded`, `withdrawUnshielded`,
`transferInternalShielded`, `transferInternalUnshielded`, `openSwapShielded`, `shieldedRecipient`,
`unshieldedRecipient`, `swapRecipient`, plus the comment blocks that described only them.

**Call-graph verification BEFORE deleting** (mechanical, comments stripped, not eyeballed): each of
the eight had **zero callers**; every other occurrence of their names was a comment. Reachability
from the 19 exported roots was **62 of 75** circuits before, and **62 of 67** after — the reachable
set is unchanged, and the deletion newly orphaned **nothing**.

**Diff:** `contracts/manager.compact` 1,609 → 1,405 lines; **40 insertions, 244 deletions**.
Source SHA-256 `6bf07eb3…` → `9fb3ae3e6c28bd4d3c3fc923cf21193f95b66f2770d1808b80aa78ca3a83e62f`.
Every one of the 40 added lines is a **comment or blank** — no new code was introduced; the
insertions are the corrections to comments that the deletion made factually false (see below).
Stored as `diffs/manager-k19-q1b-deletion.diff`.

**The predicted cost of option B is now visible and is recorded rather than glossed:** the
`diffs/manager-k20-to-k19.diff` product diff was regenerated against the shipping source and grew
from **453 to 757 lines**, exactly the "the k=20-to-v5 diff gets larger and less legible" cons entry
in the Q1 option table. The old leg bodies are now recoverable only from git history — commit
`56faa51` is the last one that carries them.

**Comments corrected (not merely deleted), because the deletion made them false:** the "RETAINED BUT
NOT LIVE" block now records the deletion and its zero-row verification; the o2 rationale's reference
to the three `*Recipient` helpers is past-tense; the v4 design narrative carries an explicit
"NOTE FOR v5 READERS" that `openSwapShielded` no longer exists as a separate circuit and the shape
lives on in `custodyDispatch` selector 6; the `transferInternal` family-split rationale now points at
the `custodyDispatch` family mux; and the zswap-transcription comment points at the live shielded
payout leg instead of the deleted `withdrawShielded`. Historical references explicitly framed as
describing **v3 or v4** were left intact.

**The acceptance gate — ZKIR byte-identity — PASSED 9/9.** Recompiled under the pinned image
(`--feature-zkir-v3 --skip-zk`, exit `0`, real `1.42` s, `WATCHDOG_TIMEOUT=0`, `KEY_FILES=0`,
nine ZKIRs, unchanged name set) into a **new** arm `k19-q1b`, leaving the pre-deletion `k19` build
intact for comparison:

| Artifact | Pre-deletion (`k19`) vs post-deletion (`k19-q1b`) |
|---|---|
| All nine `zkir/*.zkir` | **BYTE-IDENTICAL — 9/9**, same SHA-256 (`execute.zkir` = `524c32a2…`, 605,053 B) |
| `contract/index.d.ts` | **BYTE-IDENTICAL** (`92c251d3…`) — exported surface unchanged |
| `contract/index.js` | Differs **only** in `manager.compact line N char N` provenance strings inside type-error messages. **Zero** non-provenance changed lines; after normalising those strings the two files are byte-identical (`3654cdd6…`) |

Because the nine ZKIRs are byte-identical, **the measured `k=19 / 382,770 rows`, the 45/45 keyless
suite results and the nine generated proving/verifier keys all carry over unchanged** — no
re-measurement and no re-keygen were required, exactly as the owner's resolution anticipated.

**Re-run anyway, because the executed artifact was not byte-identical:** `index.js` did change (line
numbers only), and the suite executes that file, so the keyless suite was re-run rather than assumed.
**45/45 pass across the same 6 files** on the post-deletion build, against the same k=20 reference
oracle (`1a6cf20d…`). Log: `raw/parity-k19-q1b.log`; compile log `raw/compile-k19-q1b.log`.

### 9.2 Q2 → option B ratified: the SRS is pinned as the standing workspace baseline

The five SRS parameter files' sizes and SHA-256 hashes are now recorded in `PROTOCOL.md` **alongside
the compiler image digest**, under the standing rule *"fetched once, hash-pinned, reused; never
silently re-fetched."* The files themselves are retained on disk at
`harness/generated-00010/zk-params/` (gitignored; 114,968,468 B total) and re-verified byte-for-byte
against the Phase 5 evidence. The owner independently confirmed
`https://srs.midnight.network/bls_midnight_2p9` fetches successfully.

### 9.3 Integrity

Docker residue `aa00010*` **0/0/0/0**; the machine's unrelated baseline (15 containers / 36 volumes /
3 custom networks) returned with **byte-identical** container and volume lists. Zero key files
outside the gitignored path. No push, no deploy, no proving, no keygen re-run. The 00008/00009
clones were not touched.

## 10. Follow-up: implementing the Q3 resolution (2026-08-25)

**Owner resolution Q3: delete the two orphaned swap helpers — CONDITIONALLY.** The owner's condition,
verbatim: get rid of unused code, *"unless it's unused because we forgot to wire something — then let
me know."* Executed in this clone on top of `0c4bd1f`; the commit hash is recorded in the master
plan, the questions file and `project-summary.md`. Project state remains **COMPLETED**.
No re-measurement, no re-keygen, no deployment, no proving, no push.

### 10.1 Step 1 — WIRING VERIFICATION: **PASSED, 10 of 10 mapped. NO WIRING GAP.**

Performed **before any deletion** and written up guard by guard in `Q3-WIRING-VERIFICATION.md`. The
decision rule applied was the owner's: if any guard or effect were absent from the live path, delete
nothing and report the gap. Nothing was absent.

| From | Guard / effect | Live line @ `0c4bd1f` | Where |
|---|---|---|---|
| `assertSwapPreconditions` | swap amount > 0 | 1053 (+ envelope 924) | `custodyDispatch` + `assertActionEnvelope` |
| | wanted amount > 0 | 1054 (+ envelope 932) | both |
| | colour distinctness | 1055 (+ envelope 933) | both |
| | **per-(account,colour) guard BEFORE any pool guard** | 1064–1067, and **1067 < 1070** | `custodyDispatch` |
| | `pools.member` guard | 1071 | `custodyDispatch` |
| | pool value guard | 1073 | `custodyDispatch` |
| | credit-account registration guard | 1076 | `custodyDispatch` |
| `claimWantedColour` | `receiveShielded` of the wanted coin | 1134 (before `insertCoin` 1136/1141) | `custodyDispatch` |
| | pool merge-or-create for the wanted colour | 1135–1143 | `custodyDispatch` |
| | credit-account balance write | 1147–1158 | `custodyDispatch` |

Two things make this a verification rather than a reading:

1. **Key-derivation equivalence is demonstrated, not assumed.** The per-(account,colour) guard is the
   only one whose syntax differs, because o2 derives the balance key once with the family tag muxed.
   For selector 6 `debitShielded` is true, so `debitKey` is character-for-character the body of
   `shieldedKey(account, col)`, and `shieldedBalanceAt` is `shieldedBalanceOf`'s body with the key
   supplied — the missing-cell-reads-0 property (FR-204/FR-206) is preserved, not re-implemented.
   Likewise `creditKey` ≡ `shieldedKey(p.creditAccount, p.wantColor)` for the want leg.
2. **The executed A/B parity is literally helper-vs-mux.** Both helper bodies were **byte-identical**
   to the k=20 product's (`assertSwapPreconditions` 901 B, `claimWantedColour` 644 B, exact match
   against `4282400:contracts/manager.compact`), and the k=20 artifact the 45-test suite runs against
   (`1a6cf20d…`) is compiled from that source. So the suite compares these two helpers' behaviour
   against `custodyDispatch`'s:
   * `k20-parity.test.ts:282` runs all three selector-6 shapes (recipientKind 0 OPEN / 1 named key /
     2 contract) and asserts, after each, full `snapshotLedger` equality **plus** zswap
     `inputs`/`outputs`/`effects` equality (`expectSameEffects`, lines 260–271). W3's credit write is
     observable as the `(destination, COLOR_B)` shielded cell; W2 is exercised in the **create**
     direction by the first swap and the **merge** direction by the second and third.
   * `k20-parity.test.ts:428` requires the same refusal with the same message text, state-neutrally on
     both builds and cross-build, for `NC — swap with equal give/want colours` (guard 0c),
     `NC — swap crediting an unregistered account` (guard 4) and `NC — swap wanting zero` (guard 0b).
     The shared guard-2 line is exercised by four further negatives, including the FR-204 ordering
     probe `NC — debit of a colour that was never credited`, which must refuse with
     `"account colour balance too low"` and **not** `"no pooled coin for this colour"`.

**Recorded coverage note, not a wiring gap:** three swap guards have no *dedicated* negative case in
the 45-test suite — `"swap must give a positive amount"` and the two pool guards, the latter because
guard 2 refuses first in every constructed case, which is the intended consequence of the FR-204
order. All three are present in the live path and are exercised in the passing direction by all three
swap parity cases. Older suites `harness/src/test/swap.test.ts` and `g5-variants.test.ts` carry
explicit negatives for them, but target the v3/v4 surface and are not part of the 45-test suite, so
they are context, not evidence.

### 10.2 Step 2 — the deletion, under option C

`assertSwapPreconditions` and `claimWantedColour` removed from `contracts/manager.compact`, together
with the comment block that described only them. **1,405 → 1,381 lines; 57 insertions / 81 deletions.**
**Every one of the 57 added lines is a comment or blank — no code was added.** 33 of the removed lines
were code (the two circuit bodies); the remainder was their comment block. Source SHA-256
`9fb3ae3e…` → `535b16695edbfd7b06994b3546253fefc2863996b8a66cd94397dd9f207f3d50`.
Stored as `diffs/manager-k19-q3-deletion.diff`.

**Call-graph verification before deleting** (mechanical, comments stripped): `assertSwapPreconditions`
**0 callers**, `claimWantedColour` **0 callers**; `repoolOrRemove` has **1 caller (`custodyDispatch`)**
and therefore stays. Reachability from the 19 exported roots: **62 of 67** before, **62 of 65** after —
the reachable set is unchanged and **the deletion newly orphaned nothing**. The three circuits that
remain unreachable (`nativeAuthResult`, `nativeAuthTag`, `reverseBytes32`) were already unreachable
before this change and are out of scope; `nativeAuthResult` is retained deliberately as the normative
in-contract definition of the native-mode `authResult` slot (Phase 1).

**Option C applied — the FR-204 guard-order comment is rehomed onto `custodyDispatch`**, not deleted
with the helpers. It is reworded to describe the mux: step 0 names the three `!isSwap || …` sanity
lines and points the other selectors' sanity at `assertActionEnvelope`; step 1 names
`gatewayAccount`/`authenticatedActionAccount` as the witness choke point that hands the circuit an
already-derived account; step 2 states the single shared `assert(debitBalance >= val, …)` and the
key-derivation equivalence; steps 3–4 are unchanged in substance; and the F-305 colour-distinctness
rationale is carried over, noting the assert now lives in both `custodyDispatch` and
`assertActionEnvelope`. The Q3 marker comment is removed and replaced by a record of the resolution
pointing at `Q3-WIRING-VERIFICATION.md`. Two further comments the deletion made stale were corrected:
the want-leg comment referred to `coinB` (a deleted parameter name) and now says `wantCoin`, and it
absorbs the deleted `claimWantedColour` doc's load-bearing points — that `receiveShielded` is what
makes the offer unbalanced, and that it must precede `insertCoin` because receiving allocates the
Merkle-tree index. The v4 design narrative at the head of the file, already framed by Q1-B's
"NOTE FOR v5 READERS" as describing v4, was left intact.

### 10.3 THE ACCEPTANCE GATE PASSED — 9/9 ZKIRs BYTE-IDENTICAL

Recompiled under the pinned image (`--feature-zkir-v3 --skip-zk`, Docker, `--network none`,
`cpus:2, memory:8g, memory-swap:8g, rayon:2, wall-seconds:600`) into a **new arm `k19-q3`**, leaving
the `k19-q1b` build intact for the comparison — the runner `rm -rf`s its own output directory, so a
new arm name is what preserves the predecessor. Exit `0`, real **5.02 s**, `WATCHDOG_TIMEOUT=0`,
`KEY_FILES=0`, nine ZKIRs with the unchanged name set. Log: `raw/compile-k19-q3.log`.

| Artifact | `k19-q1b` vs `k19-q3` |
|---|---|
| All nine `zkir/*.zkir` | **BYTE-IDENTICAL — 9/9**, same SHA-256 (`execute.zkir` = `524c32a2414b98e6…`, 605,053 B) |
| `contract/index.d.ts` | **BYTE-IDENTICAL** (`92c251d3…`) — exported surface unchanged |
| `contract/index.js` | `8db6b55f…` → `9076c2a1…`, differing **only** in `manager.compact line N char N` provenance strings inside type-error messages (28 changed lines, all of that form). **Zero** non-provenance changed lines; identical after normalising them |

A stronger statement than Q1-B was able to make is now available: normalising the provenance strings,
the **originally measured `k19` build, the `k19-q1b` build and the `k19-q3` build all produce the same
`index.js` digest `5ca96d0a…`** — the whole chain through both deletions is functionally one artifact.

**Therefore, per the owner's stated rule and recorded explicitly: the measured `k=19 / 382,770 rows`,
the 45/45 keyless suite results, and the nine generated proving/verifier keys ALL CARRY OVER
unchanged. No re-measurement and no re-keygen were performed or needed.**

**The suite was re-run nevertheless**, because `index.js` — the file the tests actually execute — was
not byte-identical (line numbers only): **45/45 pass** across the same six files on the `k19-q3`
build, against the same k=20 reference oracle (`1a6cf20d…`). Log: `raw/parity-k19-q3.log`.

### 10.4 Cost, recorded rather than glossed

The k=20→v5 product diff grew from **757 to 875 lines** (`diffs/manager-k20-to-k19.diff`, regenerated),
continuing the trend the Q1 option table predicted for deletion. The two helper bodies are now
recoverable only from git history — **`0c4bd1f` is the last commit that carries them** (as `56faa51`
is for the eight Q1-B circuits).

### 10.5 Integrity

Docker residue `aa00010*` **0/0/0/0** (containers, volumes, networks, processes); the parity volume was
torn down (`residual_volumes=0`) and the machine's unrelated baseline (15 containers / 36 volumes /
6 networks) returned unchanged. Zero key files outside the gitignored path. Pinned image
`aa00006-compactc@sha256:f57ca2d8…` throughout, never re-pinned; the container ran `--network none`.
No push, no deploy, no proving, no keygen re-run. The 00008/00009 clones were not touched, and the
frozen 00009 measurement variants under `contracts/variants/` were not edited.
