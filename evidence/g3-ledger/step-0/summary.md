# Step 0 — baseline — deploy 3 Minters + 1 Manager, configure S1/S2/U1/U2, register AA_A and AA_B

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 0 | 0 | 0 | 0 |
| OwnerM | 0 | 0 | 0 | 0 |
| AA_A | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=0 | poolS2=0 | ledgerU1=0 | ledgerU2=0 |

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0

Conservation: S1: minted 0 == 0+0+0; S2: minted 0 == 0+0+0; U1: minted 0 == 0+0+0; U2: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=0 U2=0, OwnerM U1=0 U2=0.

On-chain spot check: `accountBalance(AA_A, S1)` = 0 (ledger state says 0).

## Operations

- **deploy 3 Minters + Manager, configure, register both accounts** (SDK) — tx `0007c81b1792297310eb6c8157cdf402f57400faa24f421f991ca8d91a47ed6157`, `00e97feeb5353eb4c7d7300117a05671726693635621ffc120b2f15e6c95e9aaf1`, `007aeeba22b1d5d82fed54c044831d8e685276d2feebc4f505084feb802bf37a6c`, `00a7fb79a0d218e77d94cafa9117dd9b8bfca80b0b29c5d42375e05dec3401b85d`

