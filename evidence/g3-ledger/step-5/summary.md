# Step 5 — OwnerN deposits S1 6 -> AA_A

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 10 | 0 |
| OwnerM | 0 | 10 | 0 | 10 |
| AA_A | 6 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=6 | poolS2=0 | ledgerU1=0 | ledgerU2=0 |

Per-colour invariant: S1: 6 == 6+0; S2: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 0+0+10; U1: minted 10 == 0+10+0; U2: minted 10 == 0+0+10

Indexer reconstruction (independent of every wallet): OwnerN U1=10 U2=0, OwnerM U1=0 U2=10.

On-chain spot check: `accountBalance(AA_B, S2)` = 0 (ledger state says 0).

## Operations

- **OwnerN deposits S1 6 -> AA_A** (SDK) — tx `006aab4592c20b63ca8bf11cd0d93ad93d65c95acf37d276b761a5cd49b7e16250`

