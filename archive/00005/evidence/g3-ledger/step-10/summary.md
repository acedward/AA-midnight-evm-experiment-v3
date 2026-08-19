# Step 10 — OwnerM deposits S3 4 -> AA_A (depositor != credited owner)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (6): `S1`, `S2`, `S3`, `U1`, `U2`, `U3`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | U1 | U2 | U3 |
|---|---|---|---|---|---|---|
| OwnerN | 4 | 0 | 0 | 5 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 10 | 0 |
| AA_A | 6 | 0 | 4 | 5 | 0 | 0 |
| AA_B | 0 | 6 | 0 | 0 | 0 | 0 |
| pool / ledger | 6 | 6 | 4 | 5 | 0 | 0 |

Exact map sizes: **pools=3 shieldedCells=3 unshieldedCells=1** (expected pools=3 shieldedCells=3 unshieldedCells=1).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 6+0; S2: 6 == 0+6; S3: 4 == 4+0; U1: 5 == 5+0; U2: 0 == 0+0; U3: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 6+0+4; S3: minted 10 == 4+0+6; U1: minted 10 == 5+5+0; U2: minted 10 == 0+0+10; U3: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0, OwnerM U1=0 U2=10 U3=0.

On-chain spot check: `shieldedAccountBalance(AA_B, S3)` = 0 (ledger state says 0).

## Operations

- **OwnerM deposits S3 4 -> AA_A** (SDK) — tx `0006b2b4c7d8d5ef248e517c59152922e3183dd84afa6d883edb78a576b0a87de4`

