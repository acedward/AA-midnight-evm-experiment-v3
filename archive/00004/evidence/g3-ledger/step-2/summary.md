# Step 2 — Minter1 mints U1 10 -> OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 10 | 0 | 10 | 0 |
| OwnerM | 0 | 0 | 0 | 0 |
| AA_A | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=0 | poolS2=0 | ledgerU1=0 | ledgerU2=0 |

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0

Conservation: S1: minted 10 == 0+10+0; S2: minted 0 == 0+0+0; U1: minted 10 == 0+10+0; U2: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=10 U2=0, OwnerM U1=0 U2=0.

On-chain spot check: `accountBalance(AA_A, U1)` = 0 (ledger state says 0).

## Operations

- **Minter1 mints U1 10 -> OwnerN** (SDK) — tx `008a147ce27f42faf4bf6a4f0742bed37bccc29359379ab4b4d5d404a18e92e6b0`

