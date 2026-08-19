# Step probe-M3-mints-S5-3-and-U5-3-to-OwnerM- — M3 mints (S5 3 and U5 3 to OwnerM)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (12): `S1`, `S2`, `S3`, `S4`, `U1`, `U2`, `U3`, `U4`, `S5`, `U5`, `XS`, `XU`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 | S5 | U5 | XS | XU |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 0 | 3 | 3 | 1 | 1 |
| AA_A | 3 | 0 | 4 | 7 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 4 | 0 | 0 | 2 | 1 |
| pool / ledger | 6 | 4 | 4 | 7 | 3 | 5 | 0 | 4 | 0 | 0 | 2 | 1 |

Exact map sizes: **pools=5 shieldedCells=6 unshieldedCells=4** (expected pools=5 shieldedCells=6 unshieldedCells=4).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 3+3; S2: 4 == 0+4; S3: 4 == 4+0; S4: 7 == 7+0; U1: 3 == 3+0; U2: 5 == 0+5; U3: 0 == 0+0; U4: 4 == 0+4; S5: 0 == 0+0; U5: 0 == 0+0; XS: 2 == 0+2; XU: 1 == 0+1

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 4+2+4; S3: minted 10 == 4+0+6; S4: minted 7 == 7+0+0; U1: minted 10 == 3+5+2; U2: minted 10 == 5+0+5; U3: minted 0 == 0+0+0; U4: minted 4 == 4+0+0; S5: minted 3 == 0+0+3; U5: minted 3 == 0+0+3; XS: minted 3 == 2+0+1; XU: minted 2 == 1+0+1

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0 U4=0 U5=0 XU=0, OwnerM U1=2 U2=5 U3=0 U4=0 U5=3 XU=1.

No on-chain spot check this step.

## Operations

- (none — this row asserts a state, not an operation)

