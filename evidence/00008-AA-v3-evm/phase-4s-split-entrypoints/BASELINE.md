# Phase 4S split-entrypoint diagnostic baseline

- Date: 2026-08-24
- Scope: measurement-only, no product ABI/source/key/deploy/proof/remote mutation
- Origin: `https://github.com/acedward/AA-midnight-evm-experiment-v3.git`
- Branch: `00008-AA-v3-evm-w2-contract`
- Starting HEAD: `41cbd41ca4837f9677fabc1dfe5bc549498b9843`
- Upstream: none
- Tracked state before mutation: clean
- Untracked state before mutation: exactly nine preserved
  `harness/generated-zk-u13/manager/zkir/*.bzkir` files
- Product Manager SHA-256:
  `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858`
- Target lane: Midnight 2.x prerelease (`node 2.0.0-rc.4`, ledger
  `9.1.0.0-rc.3`)

## Compiler pin

- Compact compiler: `0.33.0`, language `0.25.0`
- Image:
  `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`
- Image ID:
  `sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`
- Pinned compiler archive SHA-256:
  `3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46`
- Version probe container: `aa00008-phase4s-pin-u1`, `--network none`, exit `0`
- Version probe marker port: confirmed-free `46498`; free after exit

## Preserved product artifacts

The final product `execute` is the Phase 4R K=20 result:

| Item | Value |
|---|---|
| K | `20` |
| Rows | `974572` |
| `execute.zkir` | 1,336,032 bytes; SHA-256 `3cf7204bd1e454e08baee8a0c6fcec86e83718912c2acadc036bfbefbad94b0f` |
| `execute.bzkir` | 417,826 bytes; SHA-256 `1ddbbf0b77ec17e06f44b8a8e48de25291dce84eb28421c67ee9988e735dc808` |
| `execute.prover` | 2,282,126,073 bytes; SHA-256 `06fd33a9368185081d345bce748aa59c34a96aba8e4f5c056a697f128bd28993` |
| `execute.verifier` | 3,321 bytes; SHA-256 `a119a3c2d65f5741e72055f9f976f22ca3963b87f5b5b01b3701680914cf4117` |

The actual final generated provable-circuit list is nine circuits:

1. `accountRecord`
2. `depositShielded`
3. `depositUnshielded`
4. `execute`
5. `isRegistered`
6. `poolHasColour`
7. `poolValue`
8. `shieldedAccountBalance`
9. `unshieldedAccountBalance`

Thus the product baseline is one `execute` plus eight unaffected circuits.

## Preserved u13 inventory

- Total files: 17 (nine BZKIRs plus eight retained key files)
- Exact per-file manifest: `U13-SHA256SUMS.txt`
- All 17 `shasum -a 256 -c` checks: `OK`
- SHA-256 of the sorted 17-line manifest stream:
  `f23958eaf9de9add483c037e9867f315ce36c9e5fc93221a71e8bed0886a7a78`
- SHA-256 of the sorted nine untracked BZKIR path stream:
  `5e1a4a2e2fc2f91ffdf0210c82ad57bde0f038ef0577b82632cb1c576b304fa3`

## Docker and marker-port baseline

Before the version probe, matching diagnostic containers, volumes, and networks were `0/0/0`.
A direct matching process listing was empty. After the probe, matching containers, volumes,
networks, and processes were `0/0/0/0`.

The following randomly selected loopback marker ports were checked free before use and rechecked
free after the probe: `46498`, `40057`, `22174`, `35224`, `62857`, `34792`, `54513`, `45633`,
`60992`, `41215`. Each later Docker run must recheck its marker immediately before use.

## Measured verifier-key lane ceiling

The retained live bracket at
`archive/00006/evidence/g2-deploy-budget/{DEPLOY-BUDGET.md,02-deploy-probe-bracket.out}` proves:

| Probe | Verifier keys | Key bytes | Submitted bytesWritten | Result |
|---|---:|---:|---:|---|
| `mp13` | 13 | 24,475 | 30,070 | deployed |
| `mp14` | 14 | 26,594 | 32,356 | refused with `Transaction would exhaust the block limits` |

The diagnostic therefore classifies any complete candidate above 13 verifier keys as deployment
RED on this measured lane, independently of its per-circuit K result.
