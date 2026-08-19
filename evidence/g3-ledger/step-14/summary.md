# Step 14 — AA_A withdraws U1 2 -> OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (6): `S1`, `S2`, `S3`, `U1`, `U2`, `U3`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | U1 | U2 | U3 |
|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 5 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 2 | 5 | 0 |
| AA_A | 3 | 0 | 4 | 3 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 5 | 0 |
| pool / ledger | 6 | 4 | 4 | 3 | 5 | 0 |

Exact map sizes: **pools=3 shieldedCells=4 unshieldedCells=2** (expected pools=3 shieldedCells=4 unshieldedCells=2).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 3+3; S2: 4 == 0+4; S3: 4 == 4+0; U1: 3 == 3+0; U2: 5 == 0+5; U3: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 4+2+4; S3: minted 10 == 4+0+6; U1: minted 10 == 3+5+2; U2: minted 10 == 5+0+5; U3: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0, OwnerM U1=2 U2=5 U3=0.

On-chain spot check: `shieldedAccountBalance(AA_A, S2)` = 0 (ledger state says 0).

## Operations

- **AA_A withdraws U1 2 -> OwnerM** (SDK) — tx `007f4b71e7eb49371ef6982b7202ef5970f1fc81dc58a949d63fb11cc92507dcd2`

