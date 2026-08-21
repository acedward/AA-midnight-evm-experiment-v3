# 00008-AA-v3-evm namespace manifest

This manifest reserves collision-free package, lane, Compose, and evidence names before parallel
Wave 1 work begins. Inherited 00006 result files live only under `archive/00006/`; no 00008 runner
may write there.

## Project and package names

| Use | Canonical name |
|---|---|
| Project slug | `00008-AA-v3-evm` |
| npm/package prefix | `aa00008-aa-v3-evm` |
| Existing harness package | `aa00008-aa-v3-evm-harness` |
| Reserved browser package | `aa00008-aa-v3-evm-site` |
| Reserved batcher package | `aa00008-aa-v3-evm-batcher` |
| Compose project prefix | `aa00008` |

## Lane names

| Lane | Canonical name | Status at Phase 0 |
|---|---|---|
| Pinned inherited baseline | `aa00008-baseline-inherited-rc4-ledger9` | active baseline: node `2.0.0-rc.4`, ledger runtime `9.1.0.0-rc.3`, ledger package `1.0.0-rc.3`, plain proof server `9.0.0-rc.3` |
| Required feasibility candidate | `aa00008-candidate-zkir-v3-rc4-ledger9` | candidate: same node/ledger package family, Compact `--feature-zkir-v3`, expected experimental proof-server `9.0.0-rc.5_experimental`; immutable proof image pin must be resolved and verified by F-CRYPTO-DEPLOY |

The inherited baseline image digests remain recorded in the canonical master plan and
`archive/00006/evidence/g1-lane/LANE.md`. A Wave 1 runner must not change a pin to manufacture a
GREEN result.

## Evidence ownership

Each Wave 1 branch writes only its reserved subtree:

| Gate | Evidence root |
|---|---|
| F-CRYPTO-DEPLOY | `evidence/00008-AA-v3-evm/f-crypto-deploy/` |
| F-CODEC | `evidence/00008-AA-v3-evm/f-codec/` |
| F-WASM | `evidence/00008-AA-v3-evm/f-wasm/` |
| F-BATCHER | `evidence/00008-AA-v3-evm/f-batcher/` |

Gate output must include exact commands, exit codes, full source SHA, dirty state, lane/package
pins, raw evidence paths, teardown where applicable, and an explicit GREEN/RED verdict. A runner
must preserve RED/VOID output rather than reset or reuse another gate's directory.
