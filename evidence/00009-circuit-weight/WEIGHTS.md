# 00009 Phase 1 — per-function weight table for the product `execute`

**MEASUREMENT-ONLY.** Every number below comes from `compactc --feature-zkir-v3 --skip-zk`
followed by `zkir-v3 mock-compile`, under the bounds recorded in `PROTOCOL.md`. Zero prover keys,
zero verifier keys, zero proofs, zero deployments. `contracts/manager.compact` was never modified
(SHA-256 `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` throughout).

Method: each arm is the product source plus a conspicuous non-shipping header and exactly ONE
minimal stub, so

> weight(component) = rows(w0-baseline) − rows(arm).

Per-arm diffs are in `diffs/<arm>.diff`; raw runner logs are in `raw/<arm>.{compile,measure}.log`.

## Baseline gate — GREEN

The product source compiled in this clone reproduces the retained Phase 4R result **exactly**, and
not merely numerically: the generated `execute.zkir` and the transient `execute.bzkir` are
byte-identical to the 4R artifacts.

| Property | Value | Matches 4R? |
|---|---|---|
| K / rows | **k=20, rows=974,572** | yes |
| `execute.zkir` | 1,336,032 B / `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` | yes |
| `execute.bzkir` | 417,826 B / `1ddbbf0b77ec17e06f44b8a8e48de25291dce84eb28421c67ee9988e735dc808` | yes |
| Provable circuits | 9 | yes |
| Wall time | 97.19 s at 2 CPUs (4R: 147.36 s at 4 CPUs) | n/a |

## Complete weight table

K target context: **k=19 requires rows ≤ 524,288**. Every arm below is a single ablation, and none
of them alone crosses that line — which is itself the headline Phase 1 finding.

| Arm | Ablated component | K | Rows | Δrows | % of baseline | ΔK | Real s |
|---|---|---:|---:|---:|---:|---:|---:|
| **w0-baseline** | — (product) | 20 | 974,572 | — | 100.00% | — | 97.19 |
| w2-semantic-noop | FR-031 semantic commitment emission | 20 | 607,741 | **366,831** | 62.36% | 0 | 53.49 |
| w3-eip712-noop | whole EIP-712 chain in `execute` | 20 | 663,767 | **310,805** | 68.11% | 0 | 59.73 |
| w4-custody-noop | entire five-way custody dispatch | 20 | 785,288 | 189,284 | 80.58% | 0 | 91.21 |
| w9-action-openswap-noop | `openSwapShielded` leg (selector 6) | 20 | 875,219 | 99,353 | 89.81% | 0 | 90.70 |
| w1-ecdsa-noop | secp256k1 verify + address recovery | 20 | 925,440 | 49,132 | 94.96% | 0 | 90.50 |
| w5-action-withdraw-shielded-noop | `withdrawShielded` leg (selector 2) | 20 | 934,360 | 40,212 | 95.87% | 0 | 97.28 |
| w7-action-transfer-shielded-noop | `transferInternalShielded` leg (4) | 20 | 955,529 | 19,043 | 98.05% | 0 | 98.07 |
| w8-action-transfer-unshielded-noop | `transferInternalUnshielded` leg (5) | 20 | 955,529 | 19,043 | 98.05% | 0 | 97.66 |
| w6-action-withdraw-unshielded-noop | `withdrawUnshielded` leg (selector 3) | 20 | 962,959 | 11,613 | 98.81% | 0 | 97.38 |

Every arm: compile exit `0`, measure exit `0`, `WATCHDOG_TIMEOUT=0`, `KEY_FILES=0`, nine provable
circuits emitted (surface unchanged).

## Where the rows are — ranked

| Rank | Component | Rows | Share of `execute` |
|---:|---|---:|---:|
| 1 | FR-031 semantic commitment (keccak<1024> + keccak<256> + keccak<384>) | 366,831 | 37.64% |
| 2 | EIP-712 chain (domain separator + struct hash + 0x1901 digest) | 310,805 | 31.89% |
| 3 | Custody dispatch, all five legs | 189,284 | 19.42% |
| 4 | secp256k1 verify + Ethereum address recovery | 49,132 | 5.04% |
| — | Unattributed remainder | 58,520 | 6.00% |

The four measured components account for **916,052 of 974,572 rows = 94.00%**. The 58,520-row
remainder is envelope validation (`assertActionEnvelope`), `ownerCommitment`, `evmAccountIdFor`,
`nativeAuthResult`, the registration/nonce logic, and disclosure overhead.

**Keccak dominates.** Components 1 and 2 are pure keccak hashing and together are **677,636 rows =
69.5%** of the circuit. `execute` compiles roughly 29 keccak-f permutations in these two components
(13 semantic + 16 EIP-712), which prices a permutation at about **23,000 rows**. Every optimization
in Phase 2 is ultimately a count of permutations removed.

### Custody legs, ranked

| Leg | Selector | Rows | Share of `execute` | Share of custody |
|---|---:|---:|---:|---:|
| `openSwapShielded` | 6 | 99,353 | 10.19% | 52.5% |
| `withdrawShielded` | 2 | 40,212 | 4.13% | 21.2% |
| `transferInternalShielded` | 4 | 19,043 | 1.95% | 10.1% |
| `transferInternalUnshielded` | 5 | 19,043 | 1.95% | 10.1% |
| `withdrawUnshielded` | 3 | 11,613 | 1.19% | 6.1% |

`openSwapShielded` is the heaviest leg by 2.5×, which is consistent with Phase 4S measuring its
standalone gateway at k=20 / 620,754 rows while all six other gateways reached k≤19.

The two internal-transfer legs measure **identical** row counts (955,529). They are structurally
the same circuit differing only in which map and which family tag they use, so this is the expected
result and a useful sanity signal.

### Additivity cross-check — GREEN

The plan requires sum(w5..w9 Δ) ≈ w4's Δ within 10%:

```
sum(w5..w9 Δ) = 40,212 + 11,613 + 19,043 + 19,043 + 99,353 = 189,264
w4 Δ                                                        = 189,284
residual                                                    =      20 rows  (0.011%)
```

A 20-row residual out of 189,284 is three orders of magnitude inside the tolerance. This is strong
independent confirmation of the model the optimization brief rests on: **Compact compiles every
branch of every `if`, so the legs share essentially nothing and their costs are additive.** That is
precisely why muxing arguments instead of duplicating calls (arm o2) is expected to pay.

## Recorded toolchain finding — constant-zero digest breaks the secp lowering

The natural w3 stub is `const digest = default<Bytes<32>>;`. On the pinned compiler that fails to
compile, verbatim:

```
Internal error (please report): Exception in check-types/Lflattened: detected at
compiler/circuit-passes.ss line 3870 char 26: downstream type-check failure:
Exception: <standard library>:
  incompatible arguments in call to mul;
    supplied argument types:
      (Uint<0..1>, Secp256k1Scalar);
    declared argument types:
      <standard library>: (Secp256k1Scalar, Secp256k1Scalar)
```

A constant-zero `Bytes<32>` is folded to the narrow type `Uint<0..1>`, and the standard library's
secp256k1 scalar multiply then rejects it. The arm therefore uses `p.account` — a runtime
`Bytes<32>` that adds no constraints of its own, and which is all-zero for selector 0 anyway, so
the ablation still costs nothing to produce. Recorded because it will bite anyone stubbing a digest
feeding `secp256k1EcdsaVerify` on this toolchain.

## Artifact provenance

| Arm | Variant SHA-256 | `execute.zkir` bytes / SHA-256 | `execute.bzkir` bytes / SHA-256 | Marker port |
|---|---|---|---|---:|
| w0-baseline | `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858` (product) | 1,336,032 / `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` | 417,826 / `1ddbbf0b77ec17e06f44b8a8e48de25291dce84eb28421c67ee9988e735dc808` | 37944 |
| w1-ecdsa-noop | `620cf3b340484714480ebf9523ba56ce521f4d1583bced2b2a89bd78bd774623` | 1,307,202 / `2b142fb830ce0f4c2e23c7cc3d6922004ab483dc0a3f0248a9ff87e87885c737` | 409,121 / `e7f38ac383186b29b4d43c8a981bbe7bcc8ede0795333d0330a2876062a1be15` | 23215 |
| w2-semantic-noop | `7969eabb56a9b2097b10f4ac7a58a449a058cee5f721e0ff8d8620027e066016` | 790,957 / `4949694e8de02c65d68680aba6bf772ad3b6694587df4474a81a5ca6d399353f` | 245,763 / `71aaf37b53e2e9b4e48ef2f639ff556e1390d099232c35eff9af4847bc86182b` | 40053 |
| w3-eip712-noop | `6f38d81869fc90366c209071448c9e11cbf7aceeb8c56610d67d0111f360c884` | 749,283 / `33ce5dc9ec0801ce08db6437fad526b0efa170d1bab48254269f3eaab3387875` | 229,124 / `4699fb10a7c0adacf0f30d31ef4ea49cba2dd4a0b150e94099e9e4368a016d7f` | 22326 |
| w4-custody-noop | `5d31731567221f556d8d0e75f44588149416fb70f406a25ca82004c3d3f8a8df` | 1,237,588 / `802529cea0e5bb9f344eecc337fdf3b640eb40eb4a2ca347163864ee0d8988e5` | 382,748 / `99e720cb61d8767acf433a523ece66c39e16768b9390cf6e4fcda06e230d99c6` | 39164 |
| w5-action-withdraw-shielded-noop | `6b84871017c863299af62466837013a45333fc4a24d1de172e7bc2027b933d56` | 1,316,103 / `10ff1418434bbcca268f12f97fd18ce3b002b060121c3cc6032f08f4006fc24a` | 410,798 / `50906fe01ddde69a3cc54ffd95e2e76055d19ec48c926526db85b9d5a1e2add1` | 35066 |
| w6-action-withdraw-unshielded-noop | `0fe13516057c983081e0d62f3cd2f32c397eda296242d4870dc71e18157e581f` | 1,324,167 / `75f7ab4a5dfdbe6a9f7524e8ea7b0e9a81969d450215ff59171ce8508f09f450` | 413,401 / `fd19661734aeda607a5abe5f27b60ee917f381048d742659576ddde3954be6e4` | 19137 |
| w7-action-transfer-shielded-noop | `e14adfef7183adf5b8295ffadd92b54af541a56fe74fe2b2911da186e78cedd8` | 1,326,571 / `a62521e78f8cfd4e404fbd62900ce40aee1afe04d3548f7d139e425d4d63479c` | 414,464 / `5657b48ea819dee52bbd9a02d17d3aab6a1c4e32a4bdad524b0be6dff4b85925` | 40538 |
| w8-action-transfer-unshielded-noop | `c21e9e2861315338d853864bba1f2ed7f8c3912d8ff893f5956894e2441c3cf2` | 1,326,551 / `adaa62a2cb9b7b1dd3e7dbd634e0997ed0e36f77354f790ef159babb8be7e48d` | 414,444 / `059665116e1e3b3c01cbb044743ffb37b628109af26e49ad0fd087ba05e56c73` | 24608 |
| w9-action-openswap-noop | `66307ddcf350e422a6457ca9285df245b4f5b578b77d73de923e130e07ba05eb` | 1,289,489 / `db2a76d337989585c6a8ba1bd710326120bc61082883bb844625cc7068574a4a` | 401,317 / `5917a16fa06e000b641ab9a56934e18fc823a640dc405eca774196c46bb80309` | 16818 |

## Phase 1 integrity

| Check | Result |
|---|---|
| Product Manager SHA-256 before/after | `85b538bc…` unchanged |
| Prover/verifier files generated | **0** |
| Live proofs / deploys / keygen / remote mutation | none |
| Provable-circuit surface, every arm | exactly the product's nine names |
| Docker residue (containers/volumes/networks/processes) | `0/0/0/0` |
| Watchdog timeouts / OOM / retries | none — every run exited `0` first time |
| Measurement concurrency | never more than two at a time |
