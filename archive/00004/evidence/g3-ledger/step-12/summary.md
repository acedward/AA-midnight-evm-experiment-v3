# Step 12 — AA_A withdraws U2 2 -> OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 2 |
| OwnerM | 3 | 4 | 0 | 5 |
| AA_A | 3 | 0 | 5 | 0 |
| AA_B | 0 | 6 | 0 | 3 |
| pool / ledger | poolS1=3 | poolS2=6 | ledgerU1=5 | ledgerU2=3 |

Per-colour invariant: S1: 3 == 3+0; S2: 6 == 0+6; U1: 5 == 5+0; U2: 3 == 0+3

Conservation: S1: minted 10 == 3+4+3; S2: minted 10 == 6+0+4; U1: minted 10 == 5+5+0; U2: minted 10 == 3+2+5

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=2, OwnerM U1=0 U2=5.

On-chain spot check: `accountBalance(AA_B, S1)` = 0 (ledger state says 0).

## Operations

- **AA_A withdraws U2 2 -> OwnerN** (SDK) — tx `00954729ff02920dbd2f91eca1a1aa20cf546f53e6e2c7101f2597be0a51290bc9`

