# Phase 4R preserved baseline

- Date: 2026-08-24
- Source branch: `00008-AA-v3-evm-w2-contract`
- Source HEAD: `8cd4c954a79a7a7cd4c471d45da9b587350db403`
- Upstream: none
- Compiler: Compact `0.33.0`, language `0.25.0`
- Compiler image: `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`
- Historical product `execute`: `k=22`, `rows=4073135`
- Historical `execute.bzkir`: 2,684,508 bytes, SHA-256 `df7818f6cdd133f0a84efb157d38016a41cad28ca94ec1e7969e88f79cb974b5`
- Preserved u13 tree: 17 files, 102,204 KiB by `du -sk`
- SHA-256 of the sorted `shasum -a 256` manifest stream: `f23958eaf9de9add483c037e9867f315ce36c9e5fc93221a71e8bed0886a7a78`
- Full per-file manifest: `U13-SHA256SUMS.txt`

The u13 tree is historical input/evidence only. Phase 4R never writes an output below
`harness/generated-zk-u13/`. Diagnostic, optimized, and final-key outputs use distinct new paths.

## Initial read-only commands and exits

All commands ran from the source root.

| Command | Exit | Result |
|---|---:|---|
| `git rev-parse HEAD` | 0 | expected full SHA above |
| `git branch --show-current` | 0 | expected branch above |
| `git status --short --untracked-files=all` | 0 | only nine preserved u13 BZKIR entries; no tracked diff |
| `find harness/generated-zk-u13 -type f -print0 \| sort -z \| xargs -0 shasum -a 256` | 0 | 17 hashes recorded in the manifest |
| `find harness/generated-zk-u13 -type f -print0 \| sort -z \| xargs -0 stat -f '%z %m %N'` | 0 | sizes and mtimes pinned before source work |
| `docker image inspect aa00006-compactc:0.33.0 --format '{{index .RepoDigests 0}} {{.Id}}'` | 0 | digest matched the pinned image |
| `docker run --rm --name aa00008-phase4r-pin-u1 aa00006-compactc:0.33.0 compactc --version` | 0 | `0.33.0` |
| matching post-run container count | 0 | zero |
| matching post-run volume count | 0 | zero |

The historical key attempts are not repeated here. Their exact prior commands/exits are retained in
the canonical SP02 plan: the u13 full compile ended with `zkir` status `-9`; the isolated u19
single-circuit key attempt reported `(k=22, rows=4073135)`, received Docker OOM, and exited `137`
after 2,413 seconds. Unchanged `k=22` key generation is prohibited.
