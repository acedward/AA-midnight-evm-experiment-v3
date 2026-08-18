# Step 4 — Minter2 mints U2 10 -> OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 10 | 0 | 10 | 0 |
| OwnerM | 0 | 10 | 0 | 10 |
| AA_A | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=0 | poolS2=0 | ledgerU1=0 | ledgerU2=0 |

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0

Conservation: S1: minted 10 == 0+10+0; S2: minted 10 == 0+0+10; U1: minted 10 == 0+10+0; U2: minted 10 == 0+0+10

Indexer reconstruction (independent of every wallet): OwnerN U1=10 U2=0, OwnerM U1=0 U2=10.

On-chain spot check: `accountBalance(AA_B, S1)` = 0 (ledger state says 0).

## Operations

- **Minter2 mints U2 10 -> OwnerM** (SDK) — tx `0099cff38cba04f62b6642da620cd3fdf2b5353f95e9474418cf5b0e9f0a7ea130`

