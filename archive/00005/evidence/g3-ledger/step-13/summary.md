# Step 13 — AA_B withdraws S2 2 -> OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (6): `S1`, `S2`, `S3`, `U1`, `U2`, `U3`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | U1 | U2 | U3 |
|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 5 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 5 | 0 |
| AA_A | 3 | 0 | 4 | 5 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 5 | 0 |
| pool / ledger | 6 | 4 | 4 | 5 | 5 | 0 |

Exact map sizes: **pools=3 shieldedCells=4 unshieldedCells=2** (expected pools=3 shieldedCells=4 unshieldedCells=2).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 3+3; S2: 4 == 0+4; S3: 4 == 4+0; U1: 5 == 5+0; U2: 5 == 0+5; U3: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 4+2+4; S3: minted 10 == 4+0+6; U1: minted 10 == 5+5+0; U2: minted 10 == 5+0+5; U3: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0, OwnerM U1=0 U2=5 U3=0.

On-chain spot check: `unshieldedAccountBalance(AA_A, U1)` = 5 (ledger state says 5).

## Operations

- **AA_B withdraws S2 2 -> OwnerN** (SDK) — tx `00d65f7a9c3000bd786a74c907032f70084a6fe263e7b3e4fbd48d8b7e220a101d`

