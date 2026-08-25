# 00010 — measurement protocol and Phase 0 pin record

Project: `00010-manager-k19` (spec `spec/00010-manager-k19.md`, plan `plans/00010-manager-k19.md`
in the organizer workspace `/Users/edwardalvarado/todo/AA`).

**IMPLEMENTATION + MEASUREMENT + ONE GATED KEYGEN.** This project differs from 00009 in exactly one
authorized respect: it MAY modify `contracts/manager.compact` **in this clone only**, and — only
after every earlier gate is GREEN — it runs exactly ONE bounded proving-key generation attempt plus
a local pinned-loader read verification. It does NOT deploy, does NOT prove against a network, and
does NOT push or mutate any remote. The 00008 and 00009 clones are read-only references.

## Workspace pin

| Item | Value |
|---|---|
| Clone path | `/Users/edwardalvarado/todo/AA/experiments/00010-manager-k19` |
| `origin` (fetch) | `https://github.com/acedward/AA-midnight-evm-experiment-v3.git` |
| `origin` (push) | disabled — set to the non-URL sentinel `NO_PUSH_FORBIDDEN_00010` |
| `local00009` (fetch) | `/Users/edwardalvarado/todo/AA/experiments/00009-circuit-weight-optimization` |
| `local00009` (push) | disabled — same sentinel |
| Branch | `00010-manager-k19` |
| Base commit | `42824004d7cfe5c012505900b573b8d8d478ed2a` ("docs(00009): add the d31-vs-e1 anchor to the Phase 5 record") |
| Base tree | `e93b320ecc376df447c92cf8b7b8b14dcc0a0129` |
| Working tree at branch creation | clean (`git status --porcelain` empty) |

### Where the base commit came from (same deviation as 00009, one link further down the chain)

The base commit is **not on the GitHub remote** — branch `00009-circuit-weight-optimization` was
never pushed, and neither was its own base `00008-AA-v3-evm-w2-contract`. `origin` is therefore kept
as the real GitHub remote for provenance, and the base commit was fetched **read-only** from the
local 00009 clone as a second remote `local00009`. Push is disabled on both remotes via a non-URL
sentinel, so `git push` cannot resolve a destination at all.

The 00009 clone was verified unchanged across the fetch (a `git fetch` from a path is read-only on
the source):

| Check | Before fetch | After fetch |
|---|---|---|
| `git rev-parse HEAD` | `42824004d7cfe5c012505900b573b8d8d478ed2a` | same |
| `git status --porcelain` line count | `0` | `0` |

## Toolchain pin

| Item | Value |
|---|---|
| Image digest | `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b` |
| Local tag | `aa00006-compactc:0.33.0` |
| Image size | 40,997,255 bytes |
| Compact / language version | `0.33.0` / `0.25.0` |

The image **cannot be rebuilt** (finding F-316 — the upstream archive was removed). If it is ever
lost, recover it with `docker save` / `docker load` from a sibling tag; never re-pin to a different
digest, because every K/rows number in this project is only comparable within one compiler.

## SRS (KZG structured reference string) pin — **STANDING WORKSPACE BASELINE**

**Owner resolution 00010-Q2 → option B, ratified 2026-08-25.** Proving-key generation needs the
public Kate/KZG universal parameters (`bls_midnight_2p<k>`), which `compactc`/`zkir` otherwise
fetches over the network at runtime — the one input to keygen that was neither pinned by digest nor
frozen by lockfile. It is now pinned here **alongside the compiler image digest**, on the same
footing.

**The rule, for this project and every future one in this workspace: fetched once, hash-pinned,
reused; never silently re-fetched.** The fetch is confined to one isolated, hash-recorded container;
**the keygen container itself keeps `--network none`** together with every other bound.

| SRS artifact | Bytes | SHA-256 |
|---|---:|---|
| `bls_midnight_2p8` | 49,540 | `909b707551eaaea79828e883cde6fc46ab15986c3b1d791bed462c9e2805c933` |
| `bls_midnight_2p9` | 98,692 | `b9009f1098bcefffec3c461ab3a5e3a17f7e5599f0f08c70fcdc55a89227bcbd` |
| `bls_midnight_2p13` | 1,573,252 | `d3324910969c4cc54143b8045b649e5c3a4bd5fb7b8f85fe1b770f640ce1c803` |
| `bls_midnight_2p16` | 12,583,300 | `09c877216d6589b370263e18af40a030a901b41a7a7c37ef58c9901db41f05c6` |
| `bls_midnight_2p19` | 100,663,684 | `8e8dc15c4362f05c912f1e770559a3945db3e58a374def416ed5d3e65ad5b10e` |

Total 114,968,468 B (109.6 MiB). Those are exactly the `k` values this contract's nine circuits
need (8, 9, 13, 16, 19).

| Item | Value |
|---|---|
| Retained at (this clone, **gitignored**) | `harness/generated-00010/zk-params/` |
| Absolute path | `/Users/edwardalvarado/todo/AA/experiments/00010-manager-k19/harness/generated-00010/zk-params/` |
| Mounted into keygen as | `MIDNIGHT_PP` directory; keygen container runs `--network none` |
| Source | `https://srs.midnight.network/bls_midnight_2p<k>` |
| Fetched with | the **pinned compiler image's own `curl`** — no new image was introduced |
| Tracked in git | **no** (`.gitignore:39` `harness/generated-00010/`); hashes are the durable record |

**Verification is not merely these records.** `zkir` checks each parameter file against its own
built-in expected hash, so a corrupted or substituted file is rejected by the compiler itself. The
hashes above are the workspace's *reuse* baseline: a future project copies this directory and
confirms these hashes before use, rather than re-fetching.

**Owner FYI, recorded 2026-08-25:** the owner independently fetched
`https://srs.midnight.network/bls_midnight_2p9` and confirms it succeeds — an independent
confirmation of the parameter source for k=19-class keys. The hashes recorded here remain the
verification baseline going forward.

## Host / Docker VM

| Item | Value |
|---|---|
| `docker info` MemTotal | 25,159,294,976 B = **23.43 GiB** |
| `docker info` NCPU | 12 |

This is the number the Phase 5 keygen memory cap (20 GiB) is set against.

## Resource bounds

### Compile and mock-compile (inherited verbatim from 00009)

| Bound | Value |
|---|---|
| Network | `--network none` |
| CPU | `--cpus 2` |
| Memory | `--memory 8g --memory-swap 8g` |
| Rayon threads | `RAYON_NUM_THREADS=2` |
| Wall watchdog — compile | 600 s |
| Wall watchdog — `mock-compile` | 900 s |
| Concurrency | at most 2 measurements at a time |
| Marker port | one random confirmed-free loopback TCP port > 10000 per run, passed as `AA00010_PORT`; nothing ever listens on it |

### Phase 5 keygen (single bounded attempt — see plan Phase 5)

| Bound | Value |
|---|---|
| Network | `--network none` |
| CPU | `--cpus 4` |
| Memory | `--memory 20g --memory-swap 20g` (host VM has 23.43 GiB) |
| Wall watchdog | 7,200 s |
| Attempts | exactly ONE — a bounded failure is a recorded result, never a retry license |

## Runners

`scripts/00010/{free-port.sh,compile-arm.sh,measure-arm.sh,parity-suite.sh}` are the 00009 runners
with the project namespace changed (`00009` -> `00010`, `AA00009_PORT` -> `AA00010_PORT`, output
under `harness/generated-00010/`, containers named `aa00010-*`). Verified byte-identical to their
00009 originals modulo that substitution:

```sh
diff <(sed 's/00010/00009/g' scripts/00010/<f>) scripts/00009/<f>   # empty for all four
```

Exact compile invocation (as issued by `compile-arm.sh`):

```sh
/usr/bin/time -p docker run --rm --network none \
  --name aa00010-compile-<arm> --cpus 2 --memory 8g --memory-swap 8g \
  -e RAYON_NUM_THREADS=2 -e AA00010_PORT=<port> \
  -v "<repo>/contracts:/work/contracts:ro" \
  -v "<repo>/harness/generated-00010/<arm>:/out" \
  -w /work \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  compactc --feature-zkir-v3 --skip-zk /work/<src-rel> /out/manager
```

Exact measurement invocation (as issued by `measure-arm.sh`):

```sh
/usr/bin/time -p docker run --rm --network none \
  --name aa00010-measure-<arm> --cpus 2 --memory 8g --memory-swap 8g \
  -e RAYON_NUM_THREADS=2 -e AA00010_PORT=<port> \
  -v "<repo>/harness/generated-00010/<arm>/manager/zkir:/measure" -w /measure \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  /opt/compactc/zkir-v3 mock-compile <circuit>.zkir
```

## Output layout

- `harness/generated-00010/<arm>/manager/{compiler,contract,zkir}` — gitignored compiler output.
- `harness/generated-00010/k19-keys/` — gitignored Phase 5 key output (multi-GB; hashes recorded in
  evidence, files never committed).
- `evidence/00010-manager-k19/` — committed evidence (this file, `RESULTS.md`, `CONSUMER-AUDIT.md`,
  `diffs/`).

## Arms in this project

| Arm | Source | Role |
|---|---|---|
| `product-k20` | `contracts/manager.compact` at base commit | the **reference oracle**: the k=20 product, kept compiled for byte-parity comparison |
| `k19` | `contracts/manager.compact` after Phase 1 | the composed e1 + o2 + Tier-3 product — **retained as the PRE-DELETION baseline** for the Q1-B byte-identity check |
| `k19-q1b` | `contracts/manager.compact` after the Q1-B dead-code deletion (2026-08-25) | the shipping source; its nine ZKIRs are **byte-identical** to `k19`'s |
| `aux-minter`, `aux-minter-collide` | `contracts/minter*.compact` | unchanged auxiliaries the simulator loads |

## Phase 0 gate results

| Check | Result |
|---|---|
| `git rev-parse HEAD` equals the recorded base | `42824004d7cfe5c012505900b573b8d8d478ed2a` — MATCH |
| Product Manager SHA-256 | `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` — MATCH |
| `e1-bigendian-encoders.compact` present | SHA-256 `2b6bad26684be1f8403e57bd3f86caf0187bc9cc325a9a99238211e6f480ed2f` |
| `o2-custody-mux.compact` present | SHA-256 `c14ed2ee0adb98f4f35dc27d5fa5109b26d3d6158f011b0e626ec2fdd2fdff63` |
| 00009 evidence present | `DECOMPOSITION.md`, `OPTIMIZATIONS.md`, `PROTOCOL.md`, `RESULTS.md`, `WEIGHTS.md`, `diffs/` |
| `docker image inspect` by digest | exit `0`; `0.33.0` / `0.25.0`; 40,997,255 B |
| Smoke `--skip-zk` compile of the UNMODIFIED product Manager | exit `0`, real `0.69` s, `WATCHDOG_TIMEOUT=0`, **9 ZKIRs**, `KEY_FILES=0`, marker port `27503` |
| Aux minter compiles | `aux-minter` exit `0` (4 ZKIRs), `aux-minter-collide` exit `0` (5 ZKIRs) |
| Key files anywhere in the clone | `0` |

### Reference-oracle artifact hashes (arm `product-k20`, the k=20 product)

| Artifact | SHA-256 |
|---|---|
| `zkir/accountRecord.zkir` | `85e6e17aa1ffcbe39155bdfaf7da164aba3cf3a0fb468cbe9f95e4ea24bcbe87` |
| `zkir/depositShielded.zkir` | `0d1c276a71f2e9a21048dded70be32b0123edcb3ee3d45cea63ba10e2739a530` |
| `zkir/depositUnshielded.zkir` | `00edc610844118939b34c591cf7d15bcbc0d6fdb673a406b7fd6ee050b639411` |
| `zkir/execute.zkir` | `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` |
| `zkir/isRegistered.zkir` | `df0d50c70e43c0d98483c10f228198c74a434fbc454422797336f43aa0acaefb` |
| `zkir/poolHasColour.zkir` | `f02c677c55a37efe87adc2357a6eb729aa3da388d8e9dc3025a902df4584cff4` |
| `zkir/poolValue.zkir` | `1781e52f5254aab9f46e006b68ef2d714a659d782f3b2404f5337096bfc24bfd` |
| `zkir/shieldedAccountBalance.zkir` | `4080d5c83637333b372d45b5526e68463f288a99d26d4f7e2edf0091736b71cc` |
| `zkir/unshieldedAccountBalance.zkir` | `27f8c50d09f41a2d82b0c34156ced3cc025735e5d50b22c691ac3842e6309559` |
| `contract/index.js` | `1a6cf20dc86d73e471606456ed6e64ecea4d7d351bf39ea943d9ca53384084c3` |

## Docker residue accounting on a shared machine

This machine carries unrelated Docker state that is **not** this project's. The rule applied here is
**delta**, not absolute: the project's own containers/volumes/networks are named/labelled
`aa00010*` and must number `0/0/0/0` before and after every phase, and the pre-existing baseline
must be returned unchanged.

| Snapshot | Containers | Volumes | Custom networks | `aa000*`-named |
|---|---:|---:|---:|---:|
| Baseline before Phase 0 | 15 | 36 | 3 | 0 |
| After Phase 0 | 15 | 36 | 3 | **0** |

## Provable-circuit surface invariant

`--skip-zk` emits one text ZKIR per **provable** circuit. The product Manager emits exactly nine:

`accountRecord`, `depositShielded`, `depositUnshielded`, `execute`, `isRegistered`,
`poolHasColour`, `poolValue`, `shieldedAccountBalance`, `unshieldedAccountBalance`.

The exported PURE circuits (`myAccount`, `shieldedKey`, `unshieldedKey`, `zswapNullifierOf`,
`zswapCommitmentOf`, `evmAccountIdFor`, `evmDomainSeparatorFor`, `evmStructHashFor`, `evmDigestFor`,
`semanticCommitmentFor`) read no ledger state, so the compiler emits **no ZKIR and no key** for
them. That property is what makes Tier-3 free: keeping `semanticCommitmentFor` exported and pure
preserves the normative commitment definition at zero rows and zero keys.

**The invariant every build in this project must satisfy: the emitted ZKIR name set is exactly the
nine names above, unchanged.**
