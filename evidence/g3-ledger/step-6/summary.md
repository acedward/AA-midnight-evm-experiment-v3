# Step 6 — OwnerN deposits U1 5 -> AA_A

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 0 |
| OwnerM | 0 | 10 | 0 | 10 |
| AA_A | 6 | 0 | 5 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=6 | poolS2=0 | ledgerU1=5 | ledgerU2=0 |

Per-colour invariant: S1: 6 == 6+0; S2: 0 == 0+0; U1: 5 == 5+0; U2: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 0+0+10; U1: minted 10 == 5+5+0; U2: minted 10 == 0+0+10

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0, OwnerM U1=0 U2=10.

On-chain spot check: `accountBalance(AA_B, U1)` = 0 (ledger state says 0).

## Operations

- **OwnerN deposits U1 5 -> AA_A** (SDK) — tx `004cd8706ac5c7d175b376fb878408fd2a93805173ba2305636e71f27ef598900b`

