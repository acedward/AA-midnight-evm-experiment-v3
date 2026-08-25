# 00010-Q4 — the domain-separator tag rename

**Date:** 2026-08-25 · **Branch:** `00010-manager-comments` · **Commits:** `3f98c01` (contract),
`544ba46` (suite), `<evidence>` (this document) — all local-only, never pushed.
**Authorization:** owner, `plans/00010-manager-k19-questions.md` **Q4** (RESOLVED 2026-08-25).
**Project state:** unchanged — still **COMPLETED**. This is a follow-up, not a reopening.

---

## 0. THIS CHANGE IS BREAKING BY DESIGN — put this in the PR description

Renaming the three domain separators changes **every native account id** and **every
`(account, colour)` storage key** the Manager derives. Concretely:

| What breaks | Why |
|---|---|
| Native account ids | `ownerCommitment(sk) = persistentCommit<Bytes<21>>(OWNER_TAG, sk)` — the tag is a preimage input |
| Shielded custody cells | `shieldedKey(a, c) = persistentHash([a, c, SHIELDED_TAG])` |
| Unshielded custody cells | `unshieldedKey(a, c) = persistentHash([a, c, UNSHIELDED_TAG])` |
| The previously generated k=19 proving/verifier key set | five of the nine circuits' ZKIRs changed, so their keys are invalid |
| Any fixture pinning a tag-derived value | derived from tags that no longer exist |

**Nothing is deployed and no live state exists**, which is the ground on which the owner accepted
this. Any state written under the old tags would be unreachable under the new ones — there is no
migration path and none was built, because there is nothing to migrate.

**What is NOT affected**, verified by executed tests rather than asserted:
the EIP-712 domain separator, struct hash, digest and **EVM** account id (keccak over frozen type
hashes — no Manager tag participates); the semantic-commitment recipe; every refusal message; every
zswap nullifier and commitment; every balance, pool value and map size.

---

## 1. The rename

| # | Circuit | Old tag | New tag | Length rule |
|---|---|---|---|---|
| 1 | `ownerCommitment` | `aa00005:manager:owner` (21 B) | **`aa:manager:owner:v1.0`** (21 B) | `persistentCommit<Bytes<21>>` type parameter — **exactly 21 bytes, before and after** |
| 2 | `shieldedFamilyTag` | `aa00005:manager:shielded` (24 B) | **`aa:manager:shielded:v1`** (22 B) | inside `pad(32, …)` — any length ≤ 32 |
| 3 | `unshieldedFamilyTag` | `aa00005:manager:unshielded` (26 B) | **`aa:manager:unshielded:v1`** (24 B) | inside `pad(32, …)` — any length ≤ 32 |

The compiled artifact's own literals confirm the bytes reached the circuit
(`harness/generated-00010/k19-tagrename/manager/contract/index.js`):

```
_ownerCommitment_0(sk_0) {
  return this._persistentCommit_0(new Uint8Array([97,97,58,109,97,110,97,103,101,114,58,111,119,110,101,114,58,118,49,46,48]), sk_0);
}                                                //  a  a  :   m   a   n   a   g   e   r  :   o   w   n   e   r  :   v  1  .  0   — 21 bytes
_shieldedFamilyTag_0()   { return new Uint8Array([97,97,58,109,97,110,97,103,101,114,58,115,104,105,101,108,100,101,100,58,118,49, 0,0,0,0,0,0,0,0,0,0]); }
_unshieldedFamilyTag_0() { return new Uint8Array([97,97,58,109,97,110,97,103,101,114,58,117,110,115,104,105,101,108,100,101,100,58,118,49, 0,0,0,0,0,0,0,0]); }
```

### Deliberately NOT touched

| Left alone | Reason |
|---|---|
| `midnight:zswap-cc[v1]`, `midnight:zswap-cn[v1]` | They **reproduce the standard library's own** coin-commitment and nullifier preimages. Renaming them would not "version" anything — it would make this contract's coins unrecognisable to the ledger. Their continued byte-equality with the k=20 oracle is an executed assertion in the suite, so the rename provably did not spill into them. |
| Every hex byte constant (EIP-712 type hashes, semantic-commitment tags) | Out of scope; the EIP-712 KATs would have caught any change and did not move. |
| `contracts/variants/*.compact` (~60 files) | The **frozen 00009 measurement variants** — they must stay byte-identical to what was measured. |
| `contracts/minter-collide.compact` (`aa00005:collide`) | A different contract's own separator. The owner's Q4 named exactly three tags in `manager.compact`. |

### Repo-wide `aa00005` sweep

Every residual occurrence was inspected. **No TypeScript constant or fixture hardcoded any of the
three renamed tags**, so no TS constant needed editing.

| Residual | What it is | Action |
|---|---|---|
| `contracts/variants/*.compact` | frozen 00009 measurement variants | left alone (must not change) |
| `contracts/minter-collide.compact` | a different contract's separator | left alone (out of scope) |
| `harness/src/contracts.ts` (`aa00005-manager`, `aa00005-minter`, `aa00005-minter-collide`) | harness contract-registry **names** | left alone — not domain separators; nothing is derived from them |
| `harness/src/g2/deploy-order.ts`, `harness/src/g3/{actions,setup}.ts` | temp-dir prefixes and one scope name | left alone — apparatus strings |
| `scripts/g1/verify-g1-lane.sh`, `scripts/g3/verify-g3-ledger.sh`, `scripts/g5/compile-variants.sh` | compose project names and one comment | left alone — apparatus strings |
| `archive/00005/**`, `evidence/**` | historical records of past runs | left alone — must not be rewritten |
| `scripts/00010/strip-comments.py` docstring | named the old owner tag as its worked example | **updated** to the new tag (docstring only) |

### The FROZEN BYTES comment

Rewritten to name the new tags and to **drop the "the `aa00005` prefix is HISTORICAL" caveat** — the
names are current now. Two things were added that a reader cannot see from the strings themselves:
the owner tag must be exactly 21 bytes because it is the `persistentCommit<Bytes<21>>` type
parameter, and the two family tags must stay **distinct** or the custody families would alias. A
paragraph now records why the zswap separators are the one group that must never be versioned.

---

## 2. GATE — the code change is EXACTLY three string literals

The string-literal-aware stripper (`scripts/00010/strip-comments.py`) run before and after gives
**752 code-bearing lines both times**, and the ENTIRE code diff is:

```
71c71
< return persistentCommit<Bytes<21>>("aa00005:manager:owner", disclose(sk));
> return persistentCommit<Bytes<21>>("aa:manager:owner:v1.0", disclose(sk));
80c80
< return pad(32, "aa00005:manager:shielded");
> return pad(32, "aa:manager:shielded:v1");
83c83
< return pad(32, "aa00005:manager:unshielded");
> return pad(32, "aa:manager:unshielded:v1");
```

Stripped-code SHA-256 `bd32b3dd…` → `21a7af74…`. Source SHA-256 `222cd2c8…` → **`29a4f10b…`**
(`29a4f10b79a8f91910b0e2ab9235ba9596cd4742a4499fab30988e22ab8452b6`).

---

## 3. Compile — 5 of 9 ZKIRs differ, and they are exactly the tag consumers

ZKIRs were **expected** to differ; the constants changed. What matters is that the changed set is
exactly the set of circuits that read a renamed tag. Pinned compile into a NEW arm `k19-tagrename`
(a new name preserves `k19-comments` for the comparison — the runner `rm -rf`s its own output
directory): image `aa00006-compactc@sha256:f57ca2d8…`, `--feature-zkir-v3 --skip-zk`, Docker
`--network none`, `cpus:2, memory:8g, memory-swap:8g, rayon:2, wall-seconds:600`. Exit `0`, real
`0.72` s, `WATCHDOG_TIMEOUT=0`, `KEY_FILES=0`, nine ZKIRs, unchanged name set.

| Circuit | Reads a renamed tag? | `k19-comments` → `k19-tagrename` | Bytes |
|---|---|---|---|
| `execute` | yes — `ownerCommitment` + both family tags | **DIFFERS** `524c32a2…` → `b43fd707…` | 605,053 → 605,037 (−16) |
| `depositShielded` | yes — `shieldedKey` | **DIFFERS** `0d1c276a…` → `7cf9e1c7…` | 17,241 → 17,233 (−8) |
| `depositUnshielded` | yes — `unshieldedKey` | **DIFFERS** `00edc610…` → `b6606d0a…` | 5,140 → 5,132 (−8) |
| `shieldedAccountBalance` | yes — `shieldedKey` | **DIFFERS** `4080d5c8…` → `1cd73ab6…` | 2,156 → 2,152 (−4) |
| `unshieldedAccountBalance` | yes — `unshieldedKey` | **DIFFERS** `27f8c50d…` → `9705f1fb…` | 2,160 → 2,156 (−4) |
| `accountRecord` | no | **BYTE-IDENTICAL** `85e6e17a…` | 6,066 |
| `isRegistered` | no | **BYTE-IDENTICAL** `df0d50c7…` | 945 |
| `poolHasColour` | no | **BYTE-IDENTICAL** `f02c677c…` | 951 |
| `poolValue` | no | **BYTE-IDENTICAL** `1781e52f…` | 2,001 |

Every changed ZKIR **shrank by exactly the number of bytes the tags shortened by** — the signature of
a constant edit, not a structural one. `contract/index.d.ts` is **BYTE-IDENTICAL** (`92c251d3…`): the
exported TypeScript surface did not move.

Log: `raw/compile-k19-tagrename.log`.

---

## 4. GATE — k and rows: PASS, and rows are IDENTICAL, not merely non-worse

`execute` measures **`k=19, rows=382770`** — the exact number recorded in Phase 2. Every other
changed circuit holds its previous k **and** its previous row count exactly. The constants added
zero rows, as the owner's decision predicted; same-width `pad(32, …)` and a same-length owner tag are
why.

| Circuit | Phase 2 | `k19-tagrename` | Δ rows |
|---|---|---|---:|
| **`execute`** | **k=19 / 382,770** | **k=19 / 382,770** | **0** |
| `depositShielded` | k=16 / 42,239 | k=16 / 42,239 | 0 |
| `depositUnshielded` | k=13 / 7,918 | k=13 / 7,918 | 0 |
| `shieldedAccountBalance` | k=13 / 4,001 | k=13 / 4,001 | 0 |
| `unshieldedAccountBalance` | k=13 / 4,001 | k=13 / 4,001 | 0 |

382,770 rows against the 2^19 = 524,288 ceiling leaves **141,518 rows (27.0%) of headroom**,
unchanged. All exits `0`, `WATCHDOG_TIMEOUT=0`, bounds `cpus:2, memory:8g, memory-swap:8g, rayon:2,
wall-seconds:900, network:none`; `execute` real `41.53` s, BZKIR `79f9226a…` (184,200 B).
The four unchanged circuits were not re-measured — their ZKIRs are byte-identical, the same
reasoning the Q1/Q3 follow-ups used.

Logs: `raw/measure-k19-tagrename-execute.log`, `raw/measure-k19-tagrename-changed.log`.

---

## 5. Key regeneration — one bounded attempt, offline, from the pinned SRS

The nine key pairs were regenerated because five ZKIRs changed. **The old key set was NOT deleted**:
the runner's hard single-attempt guard (exit 97 on an existing output directory) is honoured by
writing to a NEW directory, `harness/generated-00010/k19-keys-tagrename/`, leaving
`k19-keys-srs-prefetched/` (18 files) intact.

**SRS verified before use.** All five locally pinned parameter files were re-hashed and **match
`PROTOCOL.md` byte for byte** — `bls_midnight_2p8` `909b7075…`, `2p9` `b9009f10…`, `2p13`
`d3324910…`, `2p16` `09c87721…`, `2p19` `8e8dc15c…`. They were mounted via `MIDNIGHT_PP`, so **the
keygen container itself kept `--network none`** (the standing Q2-B practice).

| Field | Value |
|---|---|
| Bounds | `cpus:4, memory:20g, memory-swap:20g, wall-seconds:7200, network:none` |
| Authorized commit / tree | `3f98c016…`, `GIT_PORCELAIN_LINES=0` |
| Source SHA-256 | `29a4f10b79a8f91910b0e2ab9235ba9596cd4742a4499fab30988e22ab8452b6` |
| Exit / watchdog | `0` / `WATCHDOG_TIMEOUT=0` |
| Wall time | **154.81 s** of the 7,200 s allowance (2.2%) |
| Peak observed memory | **2.075 GiB** of the 20 GiB cap (10.4%) |
| Key files outside the gitignored path | **0** |

### The nine key pairs — sizes and SHA-256

| Circuit | `.prover` bytes | `.prover` SHA-256 | `.verifier` bytes | `.verifier` SHA-256 |
|---|---:|---|---:|---|
| `accountRecord` | 446,985 | `36a9339105c0b372314a65829678cad1e8f6ba2cf1d982dbc0dfcca874ea32a8` | 1,353 | `dc43025d98eb7da0e27e3fe19b32cde6e519c4f4ab35359bcda43733d08d4e11` |
| `depositShielded` | 90,187,154 | `44211c123eae614267b92cadc6aae0cebca7511735368fd264951b797966b3ae` | 2,121 | `2f17d8e034f994b3b316fbddcc06027e44a50a83a9810eccdbed36fb657c92c4` |
| `depositUnshielded` | 11,278,142 | `1dac2a1f2a0aec3508d01c6cd5073f6f7f425764377fc3f6013bb443feab400a` | 2,121 | `018cde461dccc08f30d71d9ec3ede07f963a416cbc022b69ec901fb640e317b7` |
| **`execute`** | **1,141,041,759** | **`24e409fbb106d908ba0eac68e4115bf5e89f9344a4b0212a29441dd94f9cc0e8`** | 3,321 | `93a7bb012381e25cd8d9cdd8910f10b2dbd9de6e4767899be50864bff091eb52` |
| `isRegistered` | 224,194 | `1bb405a59b63325d6aaaf4dad9d3fa5046d3ea17c2c28ccbc8fce706495d7ca4` | 1,353 | `019ca5542d19acc4af7bafcc1282614f5e711eec154a69b8e17111fb6097af13` |
| `poolHasColour` | 224,200 | `e5fe0ec27b199963cba4c700973f639f039153e76dfc52293ff0e470950e0d53` | 1,353 | `7eec7a11c0ba74b04679ac2f7ab7fac5d2ec63e33e2fb4b3eb820e7f452a05dd` |
| `poolValue` | 224,482 | `d44259956257388f936d012667b5498700e11e03f532c9b7e4483c3cc9ff5568` | 1,353 | `1be4f099c530e6003c12036b9cad0671bc09570b15a18e94dd01c8fba76d3453` |
| `shieldedAccountBalance` | 11,277,132 | `3b3cdaf93def01f8a30e3890981b7f37091ccc7dee9bb27648d04771c4c0eb01` | 2,121 | `4f1aa0249d811e212964237eeded560e5e84234447f2a972798ee2facc3d03c8` |
| `unshieldedAccountBalance` | 11,277,136 | `a2f00144c0d7ca9540e1934bde865e6ee1b8c14bfc553f3171a68c14b1d0f37e` | 2,121 | `9f7cdb72648d69e38a11cdbe089b59df381737821b81f42d33bdb16d9c1236a9` |

`TOTAL_KEY_BYTES=1,266,198,401`.

### The size prediction held to 16 bytes

| Quantity | Old key set | New key set | Δ |
|---|---:|---:|---:|
| `execute.prover` | 1,141,041,775 | **1,141,041,759** | **−16 B** |
| Total key bytes | 1,266,198,441 | 1,266,198,401 | −40 B |

**−16 B and −40 B are exactly the ZKIR shrinkages** (execute −16; 16+8+8+4+4 = 40 across the five
changed circuits). Same k, so the key size was expected to be unchanged to within the constant
delta, and it is.

Against the ceiling: **1,141,041,759 B is 53.1% of the 2,147,483,648 B limit — 1,006,441,889 B
spare.** Log: `raw/keygen-k19-tagrename.log`.

---

## 6. Loader verification — PASS, with the control still reproducing the blocker

The exact pinned 00008-Q2 path, `--network none`, Node **v22.18.0**, no raised heap flag,
`@midnight-ntwrk/midnight-js-node-zk-config-provider@5.0.0-beta.6` from the frozen lockfile.

| Step | Verdict |
|---|---|
| **CONTROL** — same `fs/promises.readFile`, same process, file of the k=20 key's EXACT size (2,282,126,073 B) | **`ERR_FS_FILE_TOO_LARGE: File size (2282126073) is greater than 2 GiB`** — reproduces verbatim |
| `NodeZkConfigProvider.getProverKey('execute')` | **OK**, 5,043.9 ms, 1,141,041,759 B, SHA-256 matches the file |
| `ZKConfigProvider.get('execute')` (prover + verifier + ZKIR) | **OK** |
| `ZKConfigRegistry.buildConfig` | **OK**, 4,623.6 ms, 1,141,229,280 B in memory |
| All nine circuits through `buildConfig` | **OK** — 1,266,181,184 prover bytes total |
| Process RSS after loading | 3,590,901,760 B |
| **`OVERALL`** | **PASS** |

The control is what keeps the result attributable: in the *same process, same Node build, same API
call*, a file of the k=20 key's exact size still fails with the exact recorded error. Log:
`raw/loader-verify-tagrename.log`.

---

## 7. The keyless suite — 49/49, with every re-pointed assertion listed

**Result: `Test Files 6 passed (6)` / `Tests 49 passed (49)`**, duration 8.15 s. Same count as
before the rename — no test was dropped, and no test was added. Arm `k19-tagrename`,
`contract/index.js` `3375eb23…`, `index.d.ts` `92c251d3…`, k=20 oracle `1a6cf20d…` (unchanged).
Pinned Node image `node@sha256:752ea8a2…`, `pnpm@11.5.1 --frozen-lockfile`, `--cpus 2 --memory 8g
--memory-swap 8g`, the runner's in-container zero-key-file assertion passing, volume torn down
(`residual_volumes=0`). Log: `raw/parity-k19-tagrename.log`.

**Auth fixtures regenerated** with the established generator (`pnpm auth:fixtures`, i.e.
`tsx src/auth/fixtures/generate.ts --write`): `v1.json` came back **BYTE-IDENTICAL**,
SHA-256 `83381f7741138472d9632d56d0ceb628a34a176de93f7e6239d1d0788bcfe67b`, 310,192 B, before and
after. That is the executed confirmation that the EIP-712 fixture surface has no dependence on the
Manager's domain tags — the generator is pure off-chain TypeScript over the frozen type hashes.

### 7.1 The three re-pointed assertions, one by one

Only assertions that **compared a tag-derived value against the frozen k=20 oracle** were touched.
Each replacement is strictly stronger than what it replaced, because it says **which value is right**
rather than only that two artifacts agree.

| # | File / test | WAS | IS NOW |
|---|---|---|---|
| **1** | `k20-parity.test.ts` → *"derives the RENAMED key domains correctly…"* (was *"agrees on the shielded/unshielded key domains and the zswap transcriptions"*) | `k19Pure.shieldedKey(a,c) == k20Pure.shieldedKey(a,c)` and the same for `unshieldedKey` | (a) `k19Pure.shieldedKey/unshieldedKey` == an **independent TypeScript recomputation** `persistentHash<Vector<3,Bytes<32>>>([a, c, pad(32, NEW_TAG)])` through the pinned runtime's own primitive; (b) they must now **DIFFER** from the k=20 oracle's; (c) the k=20 oracle must reproduce the **OLD** tag's value under the same recomputation — so neither direction can pass vacuously; (d) tag lengths asserted (owner **21 B**, families 32 B after padding); (e) **KEPT**: the two families must still not alias, on **both** builds; (f) **added**: the derivation is injective in both the account and the colour argument |
| **2** | `k20-parity.test.ts` → `pair()`, used by all seven state-driving tests | `bytesToHex(await k19.ownerCommitmentFor(NATIVE)) == bytesToHex(await k20.ownerCommitmentFor(NATIVE))`, and the same for `NATIVE_B` | (a) the two builds must now **DIFFER** for both secrets — if they ever coincided the label normalisation below would be silently vacuous, so this assertion is what keeps the whole file honest; (b) the k=19 id == `persistentCommit<Bytes<21>>(OWNER_TAG, secret)` **recomputed in TypeScript from the declared 21-byte tag**; (c) **added**: distinct secrets still give distinct accounts, on **both** builds |
| **3** | `k20-parity.test.ts` → *"registers, deposits and runs all five custody actions…"* | the k=20 **emitted event** == a recomputation over the **k=19** transcript (worked only while both builds derived the same account id) | The semantic commitment **binds the account id**, so the two builds now legitimately commit to different accounts. Information preservation is a **per-build** property and is asserted that way: (a) the k=20 emitted value == the TS recipe over **k20's own** transcript; (b) **NEW** — the k=19 pure oracle == the TS recipe over **k19's own** transcript (before, only the k=20 side was checked at all); (c) **NEW** — the **recipe itself did not drift**: fed the k=19 transcript, the **k=20** oracle returns the k=19 value, so the two commitments differ *only* because of the account id they bind |

### 7.2 What was NOT re-pointed, and still matches the k=20 oracle A/B

| Still an exact cross-build match | Note |
|---|---|
| `evmAccountIdFor`, `evmDomainSeparatorFor`, `evmStructHashFor`, `evmDigestFor` over all 51 fixture cases and all six selectors | keccak over frozen type hashes — no Manager tag participates. Also still equal to the frozen off-chain codec's, so it is not two copies of one drift. |
| `semanticCommitmentFor` over every fixture case, accepting **and** refusing identically | the recipe takes the account id as an *argument*, so the fixture-driven comparison is untouched |
| the native selector-0 shape | unchanged |
| `zswapNullifierOf` / `zswapCommitmentOf` | the `midnight:zswap-*` separators were deliberately not renamed — **their continued byte-equality is the executed proof the rename did not spill into them** |
| every refusal message, on all 13 negatives + 4 swap-guard cases | compared **raw**, no normalisation |
| state neutrality of every refusal, per build | compared **raw** (a build against itself) |
| zswap `inputs` / `outputs` / `effects` after every custody action | compared **raw** |
| all balances, pool contents and map sizes | compared through the normaliser, which touches only *keys*, never values |
| `manager.test.ts` (12), `semantic.test.ts` (5), `compact.test.ts` (5), `codec.test.ts` (7), `tier3.test.ts` (9) | **not modified at all** — 38 of the 49 tests are untouched |

### 7.3 How ledger state is compared now

Snapshots are compared after rewriting each build's **own** derived account ids and storage keys to
build-independent labels (`<account:NATIVE>`, `<shieldedKey:NATIVE/A>`, …).

**Normalisation renames what is known-derived; it never hides a difference.** A derived value the
alias map does not know stays raw hex and therefore still fails the comparison. Only *keys and
account ids* are rewritten — every balance, pool value and map size is compared unchanged. The
`accounts` array is re-sorted after aliasing, because it is sorted on raw hex and two builds can
legitimately list the same accounts in a different order.

Native payloads are now rendered **per build**, because `execute` derives the account from the owner
witness and then asserts it equals the transcript's `p.account`
(`authenticatedActionAccount`) — a payload carrying the other build's id would be refused at the
choke point instead of executed. The action itself (selector, colours, amounts, recipients, nonces)
is identical on both sides.

### 7.4 NEGATIVE CONTROL — the new assertions are not vacuous

The identical suite re-run with the **OLD-tag build (`k19-comments`) as the arm**:

```
❯ src/auth/test/k20-parity.test.ts (11 tests | 8 failed)
  Test Files  1 failed | 5 passed (6)
       Tests  8 failed | 41 passed (49)
```

**8 of the 11 tests in the re-pointed file fail, and 0 of the other 41 do.** The failures are exactly
the re-pointed assertions — `"the rename changed the native account id"` and `"shieldedKey vs
independent recomputation from the declared tag"`. The suite therefore discriminates precisely on the
rename and on nothing else. Log: `raw/parity-k19-tagrename-negative-control.log`.

### 7.5 The flagged intermittent flake did not reproduce

The fourth follow-up flagged an intermittent `extractLegacySemanticCommitment` decode failure in
`k20-parity.test.ts` on a **cold volume**. This run was on a freshly created volume (the parity
volume was created from scratch for this task) and the test passed; the flake did **not** reproduce,
so no root-cause fix was attempted. **It remains OPEN and unexplained** — see the fourth follow-up in
the plan.

---

## 8. Integrity checklist

| Check | Result |
|---|---|
| Branch / HEAD / tracked tree | `00010-manager-comments` @ `544ba46` (+ this evidence commit), **0 porcelain lines** |
| Files changed | `contracts/manager.compact`, `scripts/00010/strip-comments.py` (docstring), `harness/src/auth/test/k20-parity.test.ts`, this document — plus gitignored raw logs |
| Code change in the contract | **EXACTLY three string literals**, proven by the strip-comments diff |
| `contract/index.d.ts` | **BYTE-IDENTICAL** — the exported surface did not move |
| k gate | **`execute` k=19 / 382,770 rows — IDENTICAL**, zero row delta on every changed circuit |
| Keys | nine pairs regenerated, sizes + SHA-256 recorded above; **old key directory preserved intact** (18 files); keys gitignored |
| Loader | **`OVERALL=PASS`**, control still `ERR_FS_FILE_TOO_LARGE` verbatim |
| Suite | **49/49**, six files, keyless, zero key files asserted in-container; negative control 8/11 fail on the old-tag build |
| Fixtures | regenerated via `auth:fixtures`; **byte-identical** (`83381f77…`) |
| SRS | five files re-hashed and **matched `PROTOCOL.md`** before use; keygen container `--network none` |
| Push to any remote | **NONE** — the coordinator handles push/PR |
| Deployment / live proof / proof submission / remote mutation | **NONE** — the only key read was the local loader verification |
| Docker residue (`aa00010*`) | **0 / 0 / 0** containers / volumes / networks; parity volume torn down (`residual_volumes=0`) |
| Machine Docker state | 16 → 21 containers, 38 → 40 volumes, 6 → 7 networks — **the entire delta is `demo-infra-*` objects created by a concurrent unrelated session, none of them `aa00010*`** |
| Key files outside the gitignored path | **0**; generated/key/SRS files tracked in git: **0** |
| Frozen 00009 variants under `contracts/variants/` | **not edited** |
| `00010-manager-k19` branch @ `918752f` | **undisturbed** — not checked out, not modified |
| 00008 / 00009 clones | **untouched** — not accessed |
| Toolchain | pinned `aa00006-compactc@sha256:f57ca2d8…` throughout; never re-pinned |

### One thing worth the owner's eye

The clone's `origin` remote **push URL is the real GitHub URL**, not the `NO_PUSH_FORBIDDEN_00010`
sentinel that earlier phases recorded (`local00009`'s push URL is still the sentinel). It was
presumably restored during the fourth follow-up, which fetched `origin/main`. **Nothing was pushed**
and the branch has no upstream, but the sentinel guard that protected the earlier phases is no longer
in place on `origin`.
