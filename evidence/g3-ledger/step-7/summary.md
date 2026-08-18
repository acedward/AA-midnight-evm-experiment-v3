# Step 7 — OwnerM deposits S2 6 -> AA_B

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 0 |
| OwnerM | 0 | 4 | 0 | 10 |
| AA_A | 6 | 0 | 5 | 0 |
| AA_B | 0 | 6 | 0 | 0 |
| pool / ledger | poolS1=6 | poolS2=6 | ledgerU1=5 | ledgerU2=0 |

Per-colour invariant: S1: 6 == 6+0; S2: 6 == 0+6; U1: 5 == 5+0; U2: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 6+0+4; U1: minted 10 == 5+5+0; U2: minted 10 == 0+0+10

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0, OwnerM U1=0 U2=10.

On-chain spot check: `accountBalance(AA_B, U2)` = 0 (ledger state says 0).

## Operations

- **OwnerM deposits S2 6 -> AA_B** (SDK) — tx `000390604bdd75c95d41f8d9ac14826eaf4a43dbb1075c980d4e688bd5be4b49ec`

