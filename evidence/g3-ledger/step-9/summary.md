# Step 9 — internal transfer S1 3: AA_A -> AA_B (no token operation)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 0 |
| OwnerM | 0 | 4 | 0 | 5 |
| AA_A | 3 | 0 | 5 | 0 |
| AA_B | 3 | 6 | 0 | 5 |
| pool / ledger | poolS1=6 | poolS2=6 | ledgerU1=5 | ledgerU2=5 |

Per-colour invariant: S1: 6 == 3+3; S2: 6 == 0+6; U1: 5 == 5+0; U2: 5 == 0+5

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 6+0+4; U1: minted 10 == 5+5+0; U2: minted 10 == 5+0+5

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0, OwnerM U1=0 U2=5.

On-chain spot check: `accountBalance(AA_A, S2)` = 0 (ledger state says 0).

## Operations

- **internal transfer S1 3 (owner A) -> AA_B** (SDK) — tx `006828ed6c39f3886f8374e912f90c650a2a766e45ecb82bd579595f4a48508c5e`

