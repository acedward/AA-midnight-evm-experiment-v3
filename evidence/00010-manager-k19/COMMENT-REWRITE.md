# COMMENT REWRITE — `contracts/manager.compact` documents the current snapshot only

**Date:** 2026-08-25 · **Branch:** `00010-manager-comments` (from `origin/main` @ `0eccb66`, the
merged v5) · **Scope:** comments and blank lines only. Zero code change, enforced mechanically.

## 1. What changed and why

The file's comments were a layered history: a "what v5 changes vs the k=20 Manager" block, a "what
v4 adds to v3" block, a "Manager v3" block, and inline references to project numbers, plan/spec
paths, requirement codes (`FR-xxx`), negative-case codes (`NC-x`), probe and finding codes
(`P-COLL`, `F-305`, `F-307`), owner-question dates, measurement-lane names and deploy `bytesWritten`
brackets. None of that is reachable by someone reading this repository, and all of it described how
the contract was *arrived at* rather than what it *is*.

The rewrite states the CURRENT SNAPSHOT, self-contained:

- a new header saying what the contract IS — an open-colour account-abstraction custody manager,
  family-separated attribution, dual authorization, the single `execute` gateway and its selector
  table, atomic swap-maker offers, k=19, no events, and what the `export` block means (nine provable
  circuits; every other export pure, i.e. a free oracle);
- every load-bearing security/design comment KEPT, restated in plain self-contained language: the
  witness choke point, guard-before-write / refusal-is-state-neutral, lazy custody on first credit,
  family-separated maps with distinct key domains, one pooled coin per colour with merge-on-deposit,
  the swap maker's two shapes and why the zswap commitment/nullifier are reimplemented, the
  canonical-zero envelope constraints, the guard ORDER (per-(account, colour) balance guard before
  any pool guard, missing cell reads 0), straight-line secp, nonce-after-custody, and the EIP-712
  structure including what the domain separator binds;
- a FROZEN BYTES note recording that the `aa00005:*` tags, the two `midnight:zswap-*[v1]`
  separators and every hex constant are consensus-critical and must never change even though the
  `aa00005` name is historical;
- one block on the semantic commitment and why there are no events (see §4).

## 2. Line counts

| | Total | Comment | Blank | Code-bearing |
|---|---:|---:|---:|---:|
| Before (`origin/main` @ `0eccb66`) | 1,381 | 505 | 124 | 752 |
| After | 1,317 | 443 | 122 | 752 |
| Delta | −64 (−4.6%) | −62 (−12.3%) | −2 | **0** |

The code-bearing line count is unchanged by construction. Roughly 200 of the 505 original comment
lines were version archaeology; they are gone, and the remaining budget is spent on current-snapshot
substance instead.

| | SHA-256 |
|---|---|
| `contracts/manager.compact` before | `535b16695edbfd7b06994b3546253fefc2863996b8a66cd94397dd9f207f3d50` |
| `contracts/manager.compact` after | `222cd2c8042f72f09884668badb4bc1b25c49443d51d2485af0d8315cea612f7` |

## 3. Verification

### 3.1 Strip-comments check — ZERO code difference

Method: `scripts/00010/strip-comments.py` (added by this change) removes every `//` line comment
(including `///` doc comments), drops blank lines, strips leading/trailing whitespace and collapses
internal whitespace runs to one space. It is STRING-LITERAL AWARE — a `//` inside a double-quoted
string is not treated as a comment — so the frozen domain-separator strings cannot be mangled by the
stripper. Compact has no block comments and this source contains none (the stripper aborts if it
finds one).

```
python3 scripts/00010/strip-comments.py <old> > code.before.txt
python3 scripts/00010/strip-comments.py <new> > code.after.txt
diff code.before.txt code.after.txt
```

| Artifact | Lines | SHA-256 |
|---|---:|---|
| stripped code, BEFORE | 752 | `bd32b3ddf5b743bbe6f86c8aedddd638361a0b6419e46e300762bf777ebee7bc` |
| stripped code, AFTER | 752 | `bd32b3ddf5b743bbe6f86c8aedddd638361a0b6419e46e300762bf777ebee7bc` |

**VERDICT: `diff` empty, digests equal — ZERO code difference.** No code line, string literal, byte
constant, export, pragma or declaration order moved.

### 3.2 Pinned compile — 9/9 ZKIRs BYTE-IDENTICAL

Compiled into a new arm `k19-comments` with the pinned image, preserving `k19-q3` (the arm the
merged `main` build was produced from) for comparison.

```
IMAGE=aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b
compactc --feature-zkir-v3 --skip-zk
BOUNDS=cpus:2,memory:8g,memory-swap:8g,rayon:2,wall-seconds:600,network:none
COMPILE_EXIT=0  real 0.99s  WATCHDOG_TIMEOUT=0  KEY_FILES=0  ZKIR_CIRCUITS=9
```

Log: `evidence/00010-manager-k19/raw/compile-k19-comments.log`.

| ZKIR | SHA-256 (identical in both arms) |
|---|---|
| `accountRecord.zkir` | `85e6e17aa1ffcbe39155bdfaf7da164aba3cf3a0fb468cbe9f95e4ea24bcbe87` |
| `depositShielded.zkir` | `0d1c276a71f2e9a21048dded70be32b0123edcb3ee3d45cea63ba10e2739a530` |
| `depositUnshielded.zkir` | `00edc610844118939b34c591cf7d15bcbc0d6fdb673a406b7fd6ee050b639411` |
| `execute.zkir` | `524c32a2414b98e6cf348b17e4b76000222930982d4aa6eb287e7df9d0061f42` |
| `isRegistered.zkir` | `df0d50c70e43c0d98483c10f228198c74a434fbc454422797336f43aa0acaefb` |
| `poolHasColour.zkir` | `f02c677c55a37efe87adc2357a6eb729aa3da388d8e9dc3025a902df4584cff4` |
| `poolValue.zkir` | `1781e52f5254aab9f46e006b68ef2d714a659d782f3b2404f5337096bfc24bfd` |
| `shieldedAccountBalance.zkir` | `4080d5c83637333b372d45b5526e68463f288a99d26d4f7e2edf0091736b71cc` |
| `unshieldedAccountBalance.zkir` | `27f8c50d09f41a2d82b0c34156ced3cc025735e5d50b22c691ac3842e6309559` |

**ALL_ZKIR_IDENTICAL = 9/9.** `execute.zkir` is still `524c32a2…` at 605,053 bytes, so the measured
`k=19 / 382,770 rows` and the generated proving/verifier keys carry over unchanged. No
re-measurement and no re-keygen were performed or needed.

| Generated TypeScript | Result |
|---|---|
| `contract/index.d.ts` | **BYTE-IDENTICAL** — `92c251d34d3f875b80f238acee3244919d255a630531b0a47da50850ba2f8fc5` |
| `contract/index.js` | 160 changed lines, **every one** of the form `manager.compact line N char N`; **zero** non-provenance changed lines. Raw `9076c2a1…` → `e01ed314…`; after normalising those strings both give `5ca96d0acfd9757a6f39d02f214ab0b4bc2b4056b0d711b35094e47d896835e0` — the same normalised digest recorded for every earlier k19 build. |

### 3.3 Keyless suite — 49/49

Because `index.js` bytes differ (line/char provenance only), the established follow-up protocol
requires re-running the keyless suite, since `index.js` is what the tests execute.

```
ARM=k19-comments
CONTRACT_SHA256=e01ed31467cdaa9af49c97a8cc9e9a702af579492311f370224a8c69fb18c4a4
DTS_SHA256=92c251d34d3f875b80f238acee3244919d255a630531b0a47da50850ba2f8fc5
REFERENCE_CONTRACT_SHA256=1a6cf20dc86d73e471606456ed6e64ecea4d7d351bf39ea943d9ca53384084c3

Test Files  6 passed (6)
     Tests  49 passed (49)
```

Log: `evidence/00010-manager-k19/raw/parity-k19-comments.log`. Keyless throughout — both mounted
builds were compiled `--skip-zk`, and the runner's in-container
`test -z "$(find generated -name "*.prover" -o -name "*.verifier")"` assertion passed. Pinned Node
image `node@sha256:752ea8a2…`, `pnpm@11.5.1 --frozen-lockfile`, `--cpus 2 --memory 8g`.

No compile, measurement, keygen, proving or deployment beyond the `--skip-zk` compile above.

### 3.4 A flake was observed once — FLAGGED, and shown not to be attributable to this change

The **first** suite run (on a freshly created volume) came back **48 passed / 1 failed**:

```
FAIL src/auth/test/k20-parity.test.ts > k20 parity — custody effects are identical, action by action
  > registers, deposits and runs all five custody actions with identical state and zswap shape
AssertionError: selector 5 — transferInternalUnshielded k20 emitted commitment:
  expected undefined to be '0x93d11ee02d17c623a640f531c2c7d7f0cef…'
  at src/auth/test/k20-parity.test.ts:442
```

That assertion is about **the k=20 REFERENCE build's emitted event** — `extractLegacySemanticCommitment`
returned `undefined` for one case, i.e. none of the k=20 build's log events matched the expected
`cell` shape, even though the preceding "k20 emits at least one event" assertion passed. The k=20
reference artifact is not touched by this change.

Characterised rather than waved through — **10 further runs, alternating arms, all green**:

| Arm | Runs | Result |
|---|---:|---|
| `k19-comments` (this change) | 6 | 5 pass, **1 fail** (the first, on a cold volume) |
| `k19-q3` (unmodified merged-`main` build) | 5 | 5 pass |

Two independent facts make the failure non-attributable to this change: (1) the failing assertion
reads the k=20 reference build, which this change cannot influence, and (2) the k=19 build under
test compiles to **byte-identical ZKIRs**, so its proved semantics are provably unchanged.

**Log-retention gap, recorded rather than papered over:** the failing run wrote to
`raw/parity-k19-comments.log`, and a later green run to the same path OVERWROTE it, so that log now
holds the final green run. The failure is therefore preserved only as the verbatim excerpt quoted
above, captured from the run output at the time. The control run is at
`raw/parity-k19-q3-control-comments.log`. (`evidence/**/raw/` is gitignored throughout this
workspace, so raw logs are on-disk artifacts and are not committed.)

**Open, not fixed here:** the root cause of the intermittent event-shape read is unresolved. It is a
latent flake in `k20-parity.test.ts`'s legacy-event decoding path, not a contract defect. Fixing it
would mean editing a test file, which is outside this comment-only change.

## 4. The no-events / semantic-commitment block, as written into the file

Placed at the head of the semantic-commitment section (where `emitSemanticCommitment` used to be
referenced), with a short restatement at the end of `execute`:

- events are disabled because computing and emitting the semantic commitment in-circuit cost about
  **367,000 rows — roughly 38% of `execute`**;
- that cost is **serializing the 1,024-byte envelope into keccak preimages**, byte by byte, not the
  hashing itself;
- instead, **the proved call transcript is the authority**: every committed field is already a
  constrained public fact of the transcript;
- the recipe stays available as the **exported pure circuit `semanticCommitmentFor`** (pure circuits
  emit no proving key), so any reader recomputes it off-circuit;
- **no consumer may trust a commitment it did not recompute.**

## 5. Hygiene

| Check | Result |
|---|---|
| Files changed | `contracts/manager.compact`, `scripts/00010/strip-comments.py` (new), this file, 3 raw logs |
| Code change | **NONE** — strip-check digests equal, 9/9 ZKIRs byte-identical |
| Push to any remote | **NONE** — the owner handles push/PR |
| Upstream tracking | **REMOVED.** `git checkout -b … origin/main` set the branch to track `main`; the upstream was unset so a bare `git push` can never target `main`. Push with `git push -u origin 00010-manager-comments`. |
| Deploy / keygen / proving / live proof | **NONE** |
| Docker residue (`aa00010*`) | **0 / 0 / 0** — containers, volumes, networks; parity volume torn down (`residual_volumes=0`) |
| Machine Docker state | 15 containers / 38 volumes / 6 networks — unchanged from the pre-run baseline |
| Key files in the clone outside the gitignored path | **0** |
| 00008 / 00009 clones | **untouched** — not accessed |
| Toolchain | pinned `aa00006-compactc@sha256:f57ca2d8…`, `--network none`; never re-pinned |
