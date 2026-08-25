# Phase 4S split-entrypoint diagnostic results

**Verdict: DIAGNOSTIC RED.** The split proves that six specialized gateways fit at K<=19, but
`openSwapShieldedAuthorized` remains K=20. Independently, the actual complete candidate has 15
provable circuits and exceeds the measured 13-key deployment ceiling. Phase 3 keyless parity was
therefore not run, exactly as required by the RED K gate.

## Measurement protocol

- Compiler/image: Compact `0.33.0`, language `0.25.0`,
  `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`
- Compile: `--feature-zkir-v3 --skip-zk`, exit `0`; no key files generated.
- Measurement runner: `bash harness/src/phase4s/measure-one.sh <candidate> <port>`.
- Per measurement: `zkir-v3 mock-compile`, two CPUs, 8 GiB memory/swap cap, two Rayon threads,
  600-second watchdog, `--network none`, fresh candidate BZKIR, confirmed-free random marker port.
- Concurrency: batches of two, two, two, then one; never more than two concurrent measurements.
- All seven exits: `0`; no watchdog, OOM, or retry.
- Container peak memory is not exported by this Docker apparatus. One live `docker stats` sample was
  captured per run (29.28, 266.1, 116.4, 471.6, 88.05, 413.0, and 412.5 MiB respectively); these
  are observations, not claimed exact peaks. Every run stayed within its 8 GiB hard cap.

## Complete K/row and artifact table

| Circuit | Auth modes | Selector | K | Rows | ZKIR bytes / SHA-256 | BZKIR bytes / SHA-256 | Real s | Exit / status |
|---|---|---:|---:|---:|---|---|---:|---|
| Product `execute` baseline | native + EVM | dynamic 0–6 | 20 | 974,572 | 1,336,032 / `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` | 417,826 / `1ddbbf0b77ec17e06f44b8a8e48de25291dce84eb28421c67ee9988e735dc808` | 147.36 | retained Phase 4R baseline |
| `registerNativeAccount` | native witness | 0 | 17 | 102,947 | 90,842 / `0eb36a2fb6fc2c3411a75ad771596fee26c69bcf87c10b846b5d07c7e019f6c1` | 24,621 / `9cdbaaeeb86f8bbe77dd8d62b1284446a9e653f909519bb451dd41c5249e7a66` | 9.50 | 0 / GREEN |
| `registerEvmAccount` | EIP-712 | 1 | 18 | 252,349 | 273,118 / `a2f05b787cd64a436df841f41c44d95b809cf5699f7c2c959fda14586dfb7848` | 77,461 / `da9ba082c85d234bf0957c2071a3f45fc5f07de10d6ac5420dbbb8d5e999a0ca` | 25.04 | 0 / GREEN |
| `withdrawShieldedAuthorized` | native + EVM | 2 | 19 | 389,808 | 439,406 / `fb5016574151837569a61731193c55e25ad5dadb4a26298f47cd0ccedd7349e3` | 128,440 / `1e88b71febfec033cd8b9acf13c33dbfc90ab1adb6b2906d1fe7986648b2cdc4` | 39.78 | 0 / GREEN |
| `withdrawUnshieldedAuthorized` | native + EVM | 3 | 19 | 361,213 | 431,884 / `78e595bbd70c65b5584207900507d8bfb189b812234fbe62194af9dae7e27fb6` | 126,179 / `f4d99ac2871c003133dc46dd1394a73272d917affc49c7a10feea63252e09c9c` | 39.11 | 0 / GREEN |
| `transferShieldedAuthorized` | native + EVM | 4 | 19 | 345,705 | 392,413 / `b647e6d3441930012d8326e208813dd299e40edab67122c448a93820c75d2638` | 114,045 / `f55e4f6daa1b0af06e884080f6cb1f2a2548d261826c0da89848826610b43c1e` | 36.73 | 0 / GREEN |
| `transferUnshieldedAuthorized` | native + EVM | 5 | 19 | 345,707 | 392,433 / `f7bcfa631477513587f65291e83aa4b08dea55ad2f777ffb18979e6961f40d11` | 114,065 / `59517679ea37db24b2c2147bbb27d8d702f6f25cc8c004e828607374b290cea3` | 36.65 | 0 / GREEN |
| `openSwapShieldedAuthorized` | native + EVM | 6 | 20 | 620,754 | 729,985 / `514012db7510c05bd95e966ecf1de29c016737eb4de4f583318cf85cafc81d1e` | 217,850 / `b11372baaf7ba265add22db3c2c7259b50570ab2abdd18edf47489a2e03d8b47` | 62.78 | 0 / **RED (K=20)** |

## Actual verifier-count classification

The generated ZKIR list contains exactly 15 provable circuits:

- Eight unaffected: `accountRecord`, `depositShielded`, `depositUnshielded`, `isRegistered`,
  `poolHasColour`, `poolValue`, `shieldedAccountBalance`, `unshieldedAccountBalance`.
- Seven gateways: the two registration and five action circuits in the table above.

This is measured output, not the expected-count assumption. The retained live bracket proves 13
keys deploy and 14 are refused on this lane. The 15-key diagnostic candidate is therefore
deployment RED by two keys; it was not deployed, because deployment is outside diagnostic scope.

## Separate verdicts

| Gate | Verdict | Evidence |
|---|---|---|
| Proof-loader K feasibility | **RED** | Open swap is K=20; all seven must be <=19. |
| Dual-auth/static surface | PRESENT BUT NOT BEHAVIORALLY VERIFIED | All five action exports carry auth mode plus native/EVM inputs and route through the common dual-auth helper; no mode-specific debit bypass exists. |
| Keyless dual-auth/semantic/state parity | **NOT RUN** | Prohibited by the RED K gate. No success/refusal/state/semantic equivalence claim is made. |
| Deployment key count | **RED** | Actual 15 provable circuits exceeds measured ceiling 13. |
| Product promotion | **NOT AUTHORIZED** | Product Manager/ABI/keys remain byte-identical and Q2 remains unresolved. |

The conditional “K GREEN but key-count RED” follow-up-design task does not apply because K itself
is RED. The existing owner blocker Q2 remains the smallest handoff: choose a product route that
preserves the approved sole gateway and frozen bytes. This diagnostic does not choose or implement
grouping, circuit removal, a lane-limit change, or a split ABI.

## Integrity and hygiene

- Product Manager SHA-256 before/after:
  `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858`.
- Preserved u13: 17/17 hashes GREEN; sorted manifest stream SHA-256
  `f23958eaf9de9add483c037e9867f315ce36c9e5fc93221a71e8bed0886a7a78`.
- Generated prover/verifier files: zero.
- Live proof/deploy/keygen/remote mutation: none.
- Post-measurement containers/volumes/networks/processes/busy marker ports: `0/0/0/0/0`.
