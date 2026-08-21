# Step 6 — mint U2 10 -> OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (6): `S1`, `S2`, `S3`, `U1`, `U2`, `U3`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | U1 | U2 | U3 |
|---|---|---|---|---|---|---|
| OwnerN | 10 | 0 | 0 | 10 | 0 | 0 |
| OwnerM | 0 | 10 | 10 | 0 | 10 | 0 |
| AA_A | 0 | 0 | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 | 0 | 0 |
| pool / ledger | 0 | 0 | 0 | 0 | 0 | 0 |

Exact map sizes: **pools=0 shieldedCells=0 unshieldedCells=0** (expected pools=0 shieldedCells=0 unshieldedCells=0).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; S3: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0; U3: 0 == 0+0

Conservation: S1: minted 10 == 0+10+0; S2: minted 10 == 0+0+10; S3: minted 10 == 0+0+10; U1: minted 10 == 0+10+0; U2: minted 10 == 0+0+10; U3: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=10 U2=0 U3=0, OwnerM U1=0 U2=10 U3=0.

On-chain spot check: `shieldedAccountBalance(AA_B, S1)` = 0 (ledger state says 0).

## Operations

- **Minter2 mints U2 10 -> OwnerM** (SDK) — tx `006586549a9e7e4453fc6681b90b9441c00851ffc285c6870280a3d409e2f87fdf`

