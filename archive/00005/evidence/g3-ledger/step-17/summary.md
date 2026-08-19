# Step 17 — OwnerM deposits U4 4 -> AA_B

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (8): `S1`, `S2`, `S3`, `S4`, `U1`, `U2`, `U3`, `U4`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 0 | 5 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 0 |
| AA_A | 3 | 0 | 4 | 7 | 3 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 4 |
| pool / ledger | 6 | 4 | 4 | 7 | 3 | 5 | 0 | 4 |

Exact map sizes: **pools=4 shieldedCells=5 unshieldedCells=3** (expected pools=4 shieldedCells=5 unshieldedCells=3).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 3+3; S2: 4 == 0+4; S3: 4 == 4+0; S4: 7 == 7+0; U1: 3 == 3+0; U2: 5 == 0+5; U3: 0 == 0+0; U4: 4 == 0+4

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 4+2+4; S3: minted 10 == 4+0+6; S4: minted 7 == 7+0+0; U1: minted 10 == 3+5+2; U2: minted 10 == 5+0+5; U3: minted 0 == 0+0+0; U4: minted 4 == 4+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0 U4=0, OwnerM U1=2 U2=5 U3=0 U4=0.

On-chain spot check: `unshieldedAccountBalance(AA_A, U1)` = 3 (ledger state says 3).

## Operations

- **OwnerM deposits U4 4 -> AA_B** (SDK) — tx `000ebd3bf2d2aa10df4b313b956d88e3f3619601073691179a83aa9f1563f58880`

