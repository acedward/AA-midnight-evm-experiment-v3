# 00009 — measurement protocol and Phase 0 pin record

Project: `00009-circuit-weight-optimization` (spec `spec/00009-circuit-weight-optimization.md`
in the organizer workspace `/Users/edwardalvarado/todo/AA`).

**MEASUREMENT-ONLY.** Every command in this project is either `compactc --feature-zkir-v3
--skip-zk` (which emits ZKIR + JS/TS artifacts and never a key) or `zkir-v3 mock-compile`
(which reports `(k=NN, rows=NNNNNN)` and writes a transient BZKIR, and never a key). No proving
key, verifier key, live proof, deployment, remote mutation, or product promotion occurs, and
`contracts/manager.compact` is never modified.

## Workspace pin

| Item | Value |
|---|---|
| Clone path | `/Users/edwardalvarado/todo/AA/experiments/00009-circuit-weight-optimization` |
| `origin` (fetch) | `https://github.com/acedward/AA-midnight-evm-experiment-v3.git` |
| `origin` (push) | disabled — set to the non-URL sentinel `NO_PUSH_FORBIDDEN_00009` |
| `local00008` (fetch) | `/Users/edwardalvarado/todo/AA/experiments/00008-AA-v3-evm-w2-contract` |
| `local00008` (push) | disabled — same sentinel |
| Branch | `00009-circuit-weight-optimization` |
| Base commit | `5de5d52d29253684de3230b5330bd43126d05741` ("diag: record split entrypoint K results") |
| Working tree at branch creation | clean (`git status --porcelain` empty) |

### Deviation: where the base commit came from

The plan specifies cloning `origin` and branching from `5de5d52d…`. The clone from
`https://github.com/acedward/AA-midnight-evm-experiment-v3.git` succeeded (network was fine), but
that commit is **not on the remote** — branch `00008-AA-v3-evm-w2-contract` was never pushed, and
the remote's newest relevant tip is `origin/00008-AA-v3-evm` at `13a87fe`. Rather than re-point
`origin` at a local path, `origin` was kept as the real GitHub remote for provenance and the base
commit was fetched read-only from the local 00008 clone as a second remote `local00008`. The
00008 clone was not modified in any way (a `git fetch` from a path is read-only on the source);
its `git status` before and after showed the same single untracked entry
`harness/generated-zk-u13/`. Push is disabled on both remotes as a hard guard.

## Toolchain pin

| Item | Value |
|---|---|
| Image digest | `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b` |
| Local tag | `aa00006-compactc:0.33.0` |
| Image size | 40,997,255 bytes |
| `compactc --version` | `0.33.0` (exit 0) |
| `compactc --language-version` | `0.25.0` (exit 0) |

The image **cannot be rebuilt** (finding F-316 — the upstream archive was removed). If it is ever
lost, recover it with `docker save` / `docker load` from a sibling tag; never re-pin to a
different digest, because every K/rows number in this project is only comparable within one
compiler.

## Resource bounds (every measurement container)

| Bound | Value |
|---|---|
| Network | `--network none` |
| CPU | `--cpus 2` |
| Memory | `--memory 8g --memory-swap 8g` |
| Rayon threads | `RAYON_NUM_THREADS=2` |
| Wall watchdog — compile | 600 s |
| Wall watchdog — `mock-compile` | 900 s |
| Concurrency | at most 2 measurements at a time |
| Marker port | one random confirmed-free loopback TCP port > 10000 per run, passed as `AA00009_PORT`; nothing ever listens on it |

The 900 s `mock-compile` watchdog is deliberately larger than Phase 4S's 600 s: the 4S runs used
4 CPUs and the product `execute` baseline alone took 147.36 s there, so a 2-CPU run of an
`execute`-sized circuit needs headroom. A bounded failure (watchdog kill or OOM) is **recorded as
that arm's verdict** and never retried unbounded.

## Runners

| Script | Purpose |
|---|---|
| `scripts/00009/free-port.sh` | print one confirmed-free marker port > 10000 |
| `scripts/00009/compile-arm.sh <arm> <src-rel> <port>` | pinned `--skip-zk` compile into `harness/generated-00009/<arm>/` |
| `scripts/00009/measure-arm.sh <arm> <port> [circuit] [timeout]` | pinned `zkir-v3 mock-compile` of `harness/generated-00009/<arm>/manager/zkir/<circuit>.zkir` |

Both runners print their bounds, the image digest, the source/ZKIR SHA-256, start/end timestamps,
`/usr/bin/time -p` wall time, the exit status, an explicit `WATCHDOG_TIMEOUT=0|1`, and a
`KEY_FILES=` count that must always read `0`. Both force-remove their named container on exit.

The watchdog subshell redirects its own stdout/stderr to `/dev/null`. This is load-bearing: an
earlier revision let it inherit the script's stdout, so a background writer held any consuming
pipe open for the full sleep and the first smoke run stalled until the caller's own 300 s timeout
(no measurement was affected — the stall predates any arm, and its stray container was removed,
leaving zero residue).

Exact compile invocation (as issued by `compile-arm.sh`):

```sh
/usr/bin/time -p docker run --rm --network none \
  --name aa00009-compile-<arm> --cpus 2 --memory 8g --memory-swap 8g \
  -e RAYON_NUM_THREADS=2 -e AA00009_PORT=<port> \
  -v "<repo>/contracts:/work/contracts:ro" \
  -v "<repo>/harness/generated-00009/<arm>:/out" \
  -w /work \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  compactc --feature-zkir-v3 --skip-zk /work/<src-rel> /out/manager
```

Exact measurement invocation (as issued by `measure-arm.sh`):

```sh
/usr/bin/time -p docker run --rm --network none \
  --name aa00009-measure-<arm> --cpus 2 --memory 8g --memory-swap 8g \
  -e RAYON_NUM_THREADS=2 -e AA00009_PORT=<port> \
  -v "<repo>/harness/generated-00009/<arm>/manager/zkir:/measure" -w /measure \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  /opt/compactc/zkir-v3 mock-compile execute.zkir
```

## Output layout

- `harness/generated-00009/<arm>/manager/{compiler,contract,zkir}` — gitignored compiler output.
- `evidence/00009-circuit-weight/` — committed evidence (this file, `WEIGHTS.md`,
  `OPTIMIZATIONS.md`, `RESULTS.md`, and `diffs/<arm>.diff` per arm).
- `contracts/variants/w*-*.compact`, `contracts/variants/o*-*.compact` — the arms.

## Phase 0 gate results

| Check | Result |
|---|---|
| `git rev-parse HEAD` equals the recorded base | `5de5d52d29253684de3230b5330bd43126d05741` — MATCH |
| Product Manager SHA-256 | `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` — MATCH |
| `docker image inspect` by digest | exit `0`; version `0.33.0` / language `0.25.0` |
| Smoke `--skip-zk` compile of `contracts/minter.compact` | exit `0`, real `0.43` s, `WATCHDOG_TIMEOUT=0`, 4 ZKIRs, `KEY_FILES=0`, marker port `21219` |

Docker residue after Phase 0: containers/volumes/networks/processes `0/0/0/0`.

## Product provable-circuit surface (the export invariant every arm must preserve)

`--skip-zk` emits one text ZKIR per **provable** circuit. The product Manager emits exactly nine:

`accountRecord`, `depositShielded`, `depositUnshielded`, `execute`, `isRegistered`,
`poolHasColour`, `poolValue`, `shieldedAccountBalance`, `unshieldedAccountBalance`.

The pure exported circuits (`myAccount`, `shieldedKey`, `unshieldedKey`, `zswapNullifierOf`,
`zswapCommitmentOf`, `evmAccountIdFor`, `evmDomainSeparatorFor`, `evmStructHashFor`,
`evmDigestFor`, `semanticCommitmentFor`) read no ledger state, so the compiler emits no ZKIR and
no key for them.

**Plan correction (recorded deviation):** the plan's per-arm testing text says arms must keep a
"13 provable circuits" surface. That number is the measured *deploy key ceiling* from finding
F-307, not this contract's circuit count — the product compiles to **nine** provable circuits
(Phase 4R independently records "nine text plus nine binary ZKIRs"). The invariant actually
checked for every arm in this project is therefore: **the emitted ZKIR name set is exactly the
nine names above**, unchanged. That is the property the plan intends (Δrows attributes the
component, not a change in what got compiled), stated against the real number.
