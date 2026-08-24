# Phase 4R results

- Date: 2026-08-24
- Starting source: branch `00008-AA-v3-evm-w2-contract` at
  `8cd4c954a79a7a7cd4c471d45da9b587350db403`
- Compiler: Compact `0.33.0`, language `0.25.0`
- Compiler image:
  `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`
- Node image for regression tests:
  `node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e`
- Package manager: pnpm `11.5.1`
- Step 1 Manager source SHA-256:
  `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858`
- Semantic no-op source SHA-256:
  `1c57f35c77e73f03454e556adcd092c37d30f26c15e410e2278ffaca11981679`
- ECDSA no-op source SHA-256:
  `156785e77a2ca52d668661568ba9e3555c3a33148fcf5b50041d1224c609bfe2`

## Product result

| Circuit | Source status | K | Rows | Text ZKIR bytes | Text ZKIR SHA-256 |
|---|---|---:|---:|---:|---|
| Historical shipped `execute` | preserved u13 baseline | 22 | 4,073,135 | n/a (retained BZKIR) | n/a |
| Step 1 `execute` | regression GREEN product | 20 | 974,572 | 1,336,032 | `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` |
| Semantic-emission no-op | measurement-only diagnostic | 20 | 618,472 | 808,797 | `76afd4cc9fba9b365be8ced548fd6f3b33e18c6efb538120ce7a4a989b1e3f17` |
| ECDSA no-op | measurement-only diagnostic | 22 | 4,056,656 | 8,391,409 | `df75f6bf2d95bbc2bf238d693982f368b529f63d967b580443031c2ae1e0496f` |

Step 1 clears the plan's `k<22` stop condition. Step 2a and Step 3 were not attempted. Neither
diagnostic variant was promoted. The public generated `index.d.ts` remained byte-identical at
SHA-256 `92c251d34d3f875b80f238acee3244919d255a630531b0a47da50850ba2f8fc5`.

## Product compile

Container `aa00008-phase4r-step1-compile-u2`, confirmed-free port marker `35794`:

```sh
docker run --rm --name aa00008-phase4r-step1-compile-u2 \
  -e PHASE4R_PORT=35794 -v "$PWD:/work" -w /work \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  compactc --feature-zkir-v3 --skip-zk \
  contracts/manager.compact harness/generated-phase4r/step1/manager
```

Exit `0`; exactly nine ZKIR files and one `execute.zkir`; zero matching container/volume residue.
This command did not generate keys or measure K/rows.

## Regression gate

The authoritative whole-volume Docker run was `aa00008-phase4r-step1-tests-u8`, using confirmed-free
port marker `58199`, the pinned Node digest above, and disposable
`scripts/phase4r/pnpm-workspace.test.yaml`. The exact test commands inside the disposable volume
were:

```sh
corepack prepare pnpm@11.5.1 --activate
pnpm install --frozen-lockfile
pnpm run auth:fixtures:check
pnpm run typecheck:auth
pnpm run test:auth
pnpm exec vitest run \
  src/test/manager.test.ts src/test/minter.test.ts \
  src/test/step-ledger.test.ts src/test/swap.test.ts
```

Every command exited `0`. Auth/byte/dual-mode/refusal tests passed 36/36 across six files, including
the EVM/native-witness and native/dummy-EVM-transport independence cases. The inherited Manager,
Minter, step-ledger, and swap suites passed 95/95 (25 + 17 + 14 + 39), for 131 total passing tests.
The outer Docker run exited `0`; teardown left zero project containers and zero volumes.

Pre-product apparatus was not treated as a product result: u3, u4, and u6 failed before collection
and are VOID; u7 collected 34 passing/2 invalid-test-precondition failures before the comparison
simulators were pinned to one Manager address, then left zero residue. The canonical SP02 plan
contains each apparatus diagnosis.

## K/rows commands

The historical baseline is the retained prior result `(k=22, rows=4073135)`. No unchanged-product
key generation was run. A read-only baseline `mock-compile` apparatus u10 was stopped after 262.90
seconds because rerunning the retained baseline was unnecessary; exit `137` is VOID/apparatus, and
no u13 byte changed.

Step 1, container `aa00008-phase4r-step1-measure-u12`, confirmed-free port marker `45221`:

```sh
/usr/bin/time -lp docker run --rm \
  --name aa00008-phase4r-step1-measure-u12 --cpus 4 \
  -e RAYON_NUM_THREADS=4 -e PHASE4R_PORT=45221 \
  -v "$PWD/harness/generated-phase4r/step1:/measure" -w /measure \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  /opt/compactc/zkir-v3 mock-compile manager/zkir/execute.zkir
```

Exit `0`, real `147.36` seconds, `(k=20, rows=974572)`. Maximum live checkpoint: `100.01%` CPU,
`977 MiB / 23.43 GiB`, five PIDs. The isolated transient `execute.bzkir` is 417,826 bytes at SHA-256
`1ddbbf0b77ec17e06f44b8a8e48de25291dce84eb28421c67ee9988e735dc808`.

Semantic no-op, container `aa00008-phase4r-diag-semantic-measure-u15`, confirmed-free port marker
`60123`:

```sh
/usr/bin/time -lp docker run --rm \
  --name aa00008-phase4r-diag-semantic-measure-u15 --cpus 4 \
  -e RAYON_NUM_THREADS=4 -e PHASE4R_PORT=60123 \
  -v "$PWD/harness/generated-phase4r/diagnostics/semantic-noop:/measure" -w /measure \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  /opt/compactc/zkir-v3 mock-compile manager/zkir/execute.zkir
```

Exit `0`, real `53.81` seconds, `(k=20, rows=618472)`. The isolated transient BZKIR is 250,937
bytes at SHA-256 `e7fc07c0f29ad8a34fddfc869330a120d8f8012589580b6f28483144b98a8691`.

ECDSA no-op, container `aa00008-phase4r-diag-ecdsa-measure-u16`, confirmed-free port marker `51887`:

```sh
/usr/bin/time -lp docker run --rm \
  --name aa00008-phase4r-diag-ecdsa-measure-u16 --cpus 4 \
  -e RAYON_NUM_THREADS=4 -e PHASE4R_PORT=51887 \
  -v "$PWD/harness/generated-phase4r/diagnostics/ecdsa-noop:/measure" -w /measure \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  /opt/compactc/zkir-v3 mock-compile manager/zkir/execute.zkir
```

After Step 1 cleared the product gate, this optional diagnostic was capped at ten elapsed minutes or
8 GiB. It completed inside both caps: exit `0`, real `560.71` seconds, maximum observed 5.453 GiB,
`(k=22, rows=4056656)`. The isolated transient BZKIR is 2,692,566 bytes at SHA-256
`949788df5d905e6f9c239193eda94350b3e23144d543760ad79083871a979bc6`.

All measurement containers/volumes/processes were absent after exit. The 17-file u13 manifest was
rechecked after every product/diagnostic transition and remained fully GREEN.

## Final-key gate

Changed source commit: `7b0d03d97679efe5eaf2756a25d42e4ac7da569b`.

The exact sole final command was:

```sh
/usr/bin/time -lp docker run --rm \
  --name aa00008-phase4r-final-keys-u17 --cpus 4 \
  --memory 20g --memory-swap 20g \
  -e RAYON_NUM_THREADS=4 -e PHASE4R_PORT=47639 \
  -v "$PWD:/work:ro" \
  -v "$PWD/harness/generated-phase4r/final-7b0d03d:/out" \
  -w /work \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  compactc --feature-zkir-v3 contracts/manager.compact /out/manager
```

A shell watchdog stopped the named container if elapsed time reached 1,800 seconds. The compiler
exited `0` after real `521.55` seconds; wrapper elapsed time was 525 seconds and
`WATCHDOG_TIMED_OUT=0`.

The fresh output contains 41 files: five compiler/contract files, 18 non-empty prover/verifier files,
and nine text plus nine binary ZKIRs. Total size is 2,379,840 KiB by `du -sk`. The execute artifacts
are:

| File | Bytes | SHA-256 |
|---|---:|---|
| `keys/execute.prover` | 2,282,126,073 | `06fd33a9368185081d345bce748aa59c34a96aba8e4f5c056a697f128bd28993` |
| `keys/execute.verifier` | 3,321 | `a119a3c2d65f5741e72055f9f976f22ca3963b87f5b5b01b3701680914cf4117` |
| `zkir/execute.bzkir` | 417,826 | `1ddbbf0b77ec17e06f44b8a8e48de25291dce84eb28421c67ee9988e735dc808` |
| `zkir/execute.zkir` | 1,336,032 | `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` |

The full 41-file content-address manifest is `FINAL-SHA256SUMS.txt`. Post-run checks found zero
matching containers, volumes, or worker processes. The preserved u13 manifest passed 17/17 after
the run. No retry and no unchanged-k22 key generation occurred.
