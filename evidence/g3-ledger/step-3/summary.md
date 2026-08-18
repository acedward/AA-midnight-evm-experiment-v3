# Step 3 — Minter2 mints S2 10 -> OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 10 | 0 | 10 | 0 |
| OwnerM | 0 | 10 | 0 | 0 |
| AA_A | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=0 | poolS2=0 | ledgerU1=0 | ledgerU2=0 |

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0

Conservation: S1: minted 10 == 0+10+0; S2: minted 10 == 0+0+10; U1: minted 10 == 0+10+0; U2: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=10 U2=0, OwnerM U1=0 U2=0.

On-chain spot check: `accountBalance(AA_A, U2)` = 0 (ledger state says 0).

## Operations

- **Minter2 mints S2 10 -> OwnerM** (SDK) — tx `0086d01bd3b658f8f067eb0e01752a0a528e50a5872c94a37cb77a10ebf849c0ab`

