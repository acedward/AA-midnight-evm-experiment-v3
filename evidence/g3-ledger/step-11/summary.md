# Step 11 — AA_B withdraws S1 3 -> OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 0 |
| OwnerM | 3 | 4 | 0 | 5 |
| AA_A | 3 | 0 | 5 | 2 |
| AA_B | 0 | 6 | 0 | 3 |
| pool / ledger | poolS1=3 | poolS2=6 | ledgerU1=5 | ledgerU2=5 |

Per-colour invariant: S1: 3 == 3+0; S2: 6 == 0+6; U1: 5 == 5+0; U2: 5 == 2+3

Conservation: S1: minted 10 == 3+4+3; S2: minted 10 == 6+0+4; U1: minted 10 == 5+5+0; U2: minted 10 == 5+0+5

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0, OwnerM U1=0 U2=5.

On-chain spot check: `accountBalance(AA_A, U2)` = 2 (ledger state says 2).

## Operations

- **AA_B withdraws S1 3 -> OwnerM** (SDK) — tx `00d39ad68196e8426254c45c9f59382cf0f161a1dad69aad0eebad4b55d9fb9850`

