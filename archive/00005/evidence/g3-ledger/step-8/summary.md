# Step 8 — OwnerN deposits U1 5 -> AA_A

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (6): `S1`, `S2`, `S3`, `U1`, `U2`, `U3`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | U1 | U2 | U3 |
|---|---|---|---|---|---|---|
| OwnerN | 4 | 0 | 0 | 5 | 0 | 0 |
| OwnerM | 0 | 10 | 10 | 0 | 10 | 0 |
| AA_A | 6 | 0 | 0 | 5 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 | 0 | 0 |
| pool / ledger | 6 | 0 | 0 | 5 | 0 | 0 |

Exact map sizes: **pools=1 shieldedCells=1 unshieldedCells=1** (expected pools=1 shieldedCells=1 unshieldedCells=1).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 6+0; S2: 0 == 0+0; S3: 0 == 0+0; U1: 5 == 5+0; U2: 0 == 0+0; U3: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 0+0+10; S3: minted 10 == 0+0+10; U1: minted 10 == 5+5+0; U2: minted 10 == 0+0+10; U3: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0, OwnerM U1=0 U2=10 U3=0.

On-chain spot check: `shieldedAccountBalance(AA_B, S2)` = 0 (ledger state says 0).

## Operations

- **OwnerN deposits U1 5 -> AA_A** (SDK) — tx `0040400c7e3bae1de2b3b8c790538046dad5f8b8a71af631a98df74a0bdec7bdc4`

