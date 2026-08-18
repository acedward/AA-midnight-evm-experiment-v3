# Step 10 — internal transfer U2 2: AA_B -> AA_A (no token operation)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 0 |
| OwnerM | 0 | 4 | 0 | 5 |
| AA_A | 3 | 0 | 5 | 2 |
| AA_B | 3 | 6 | 0 | 3 |
| pool / ledger | poolS1=6 | poolS2=6 | ledgerU1=5 | ledgerU2=5 |

Per-colour invariant: S1: 6 == 3+3; S2: 6 == 0+6; U1: 5 == 5+0; U2: 5 == 2+3

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 6+0+4; U1: minted 10 == 5+5+0; U2: minted 10 == 5+0+5

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0, OwnerM U1=0 U2=5.

On-chain spot check: `accountBalance(AA_A, U1)` = 5 (ledger state says 5).

## Operations

- **internal transfer U2 2 (owner B) -> AA_A** (SDK) — tx `006315235045d7646b382656ecfe239333fdbaef93a0ad5f4f6f4534c897246b5e`

