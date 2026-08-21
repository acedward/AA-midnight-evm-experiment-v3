# F-CODEC Phase 1 result

**Verdict: GREEN — zero byte disagreements.**

Executed 2026-08-21 by Codex (`plan-task-runner`) in
`/Users/edwardalvarado/todo/AA/experiments/00008-AA-v3-evm-f-codec`, branch
`00008-AA-v3-evm-f-codec`, from clean starting SHA
`13a87fedcebb39ca8eacb54f4c06f33f01538b3c`. No branch was pushed and no remote was mutated.

## Frozen authority

- Technical note: `harness/src/auth/AUTH-EIP712-AA-V3-V1.md`
- Deterministic fixture: `harness/src/auth/fixtures/v1.json`
- Fixture generator: `harness/src/auth/fixtures/generate.ts`
- Pure TypeScript implementation: `harness/src/auth/{codec,semantic,signature}.ts`
- Independent implementation: pinned `@metamask/eth-sig-util` V4 path in
  `harness/src/auth/metamask.ts`
- Compact implementation: `harness/src/auth/compact/AuthCodec.compact` and checked-in generated
  pure/simulator binding

The retained corpus has one normative registration KAT, 11 boundary cases, 48 seeded random cases,
58 field/domain/type tamper cases, all seven selectors through EIP/semantic fixtures, all seven
recipient shapes, canonical inactive-field rejects, and the low-s/high-s signature twins. Random
seed: `0x8aa3e712c0dec0de`.

The normative digest remains
`50eafb056abc5461f1a87968dbf5cdfe7cfeab465c02548dde208c681ba152ce`; signature remains
`18c8c0b1a03a9d14923824f037423de763035cc9b4ae011b10519473553845fa` ||
`4b23d69e009b1b012a044d2651134524419f420f6157d333eda0b3cb2d469f81` || `1c`.

## Pins

| Component | Exact pin |
|---|---|
| Node image | `node:22.18.0-bookworm-slim@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e` |
| Node | `v22.18.0` |
| pnpm | `11.5.1` |
| Compact image ID | `sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b` |
| Compact | compiler `0.33.0`, language `0.25.0`, `--feature-zkir-v3 --skip-zk` |
| `@metamask/eth-sig-util` | `8.2.0` |
| `@noble/curves` | `2.2.0` |
| `@noble/hashes` | `2.2.0` |
| Vitest | `4.1.9` |
| TypeScript | `5.9.3` |

## Definitive clean-volume run

- Compose/project namespace: `aa00008_fcodec_20260821_gate3`
- Confirmed-free loopback port above 10000: `40127` (no service was published for this offline gate)
- Teardown was registered before the first container/volume was created.
- Source was copied read-only into a disposable Docker volume while excluding host `node_modules`
  and package-store caches.
- Compact was regenerated in that clean copy. Recursive comparison against the checked-in generated
  oracle passed; generated verifier/ZKIR count was zero because every export is pure.
- Fresh Linux dependency install with frozen lock exited `0`.
- Deterministic fixture check exited `0`.
- `vitest run src/auth/test` exited `0`: 5 files, 24 tests passed.
- `tsc --noEmit -p src/auth/tsconfig.json` exited `0`.
- Final orchestration exited `0`; residual project containers `0`; residual project volumes `0`.

Tracked artifact SHA-256 values at the definitive run:

| Artifact | SHA-256 |
|---|---|
| `harness/src/auth/fixtures/v1.json` | `83381f7741138472d9632d56d0ceb628a34a176de93f7e6239d1d0788bcfe67b` |
| `harness/src/auth/AUTH-EIP712-AA-V3-V1.md` | `ad75428310aba50f85e930c5bfec152b46c308ebaeb49ac92317d505e72c4bb4` |
| `harness/package.json` | `babf3ba3f8dd07529397626792f8e9deebb2ba68fcf62a0ac2bbf84c42776390` |
| `harness/pnpm-lock.yaml` | `6bd6566c2883da39496e660afd0cdcfc89c0384f868f20d5b13e735dc43c7d90` |

## Resolved diagnostics retained for reproducibility

- The first Compact development compile exited `255`: `prefix` is reserved in Compact. Renaming the
  local to `eipPrefix` made the same pinned compile exit `0`.
- Initial Node-container attempts reused a host-native `esbuild` tree or hit package-import
  concurrency. The definitive gate copies source into a clean volume, uses a fresh Linux install,
  and exits `0`.
- The first focused Vitest run exited `1` with 23/24 passing because one test directly called
  `JSON.stringify` on an internal BigInt-bearing object. The test was corrected to use the fixture's
  decimal-string serializer; all codec/MetaMask/Compact parity assertions in that run had already
  passed. The definitive run is 24/24.
- Clean-volume gate attempt `aa00008_fcodec_20260821_gate1` exited `127` before tests because an
  Alpine login shell reset the compiler PATH. Its registered teardown left zero residue. The
  definitive command invokes `/opt/compactc/compactc` explicitly.
- Vitest prints a non-failing warning that the generated JavaScript source map references compiler
  source files absent from the runtime copy. Checked-in versus freshly generated outputs are
  byte-identical, and tests/typecheck pass.
