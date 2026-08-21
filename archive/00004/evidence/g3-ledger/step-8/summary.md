# Step 8 — OwnerM deposits U2 5 -> AA_B

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 0 |
| OwnerM | 0 | 4 | 0 | 5 |
| AA_A | 6 | 0 | 5 | 0 |
| AA_B | 0 | 6 | 0 | 5 |
| pool / ledger | poolS1=6 | poolS2=6 | ledgerU1=5 | ledgerU2=5 |

Per-colour invariant: S1: 6 == 6+0; S2: 6 == 0+6; U1: 5 == 5+0; U2: 5 == 0+5

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 6+0+4; U1: minted 10 == 5+5+0; U2: minted 10 == 5+0+5

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0, OwnerM U1=0 U2=5.

On-chain spot check: `accountBalance(AA_A, S1)` = 6 (ledger state says 6).

## Operations

- **OwnerM deposits U2 5 -> AA_B** (SDK) — tx `0086ae50203ff22ae3659888abb8bf6d663a7f954574f415468761dabe5919b437`

