# Step 16 — OwnerN deposits S4 7 -> AA_A — HEADLINE: custody of a colour that did not exist at deploy

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (8): `S1`, `S2`, `S3`, `S4`, `U1`, `U2`, `U3`, `U4`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 0 | 5 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 4 |
| AA_A | 3 | 0 | 4 | 7 | 3 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 0 |
| pool / ledger | 6 | 4 | 4 | 7 | 3 | 5 | 0 | 0 |

Exact map sizes: **pools=4 shieldedCells=5 unshieldedCells=2** (expected pools=4 shieldedCells=5 unshieldedCells=2).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 3+3; S2: 4 == 0+4; S3: 4 == 4+0; S4: 7 == 7+0; U1: 3 == 3+0; U2: 5 == 0+5; U3: 0 == 0+0; U4: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 4+2+4; S3: minted 10 == 4+0+6; S4: minted 7 == 7+0+0; U1: minted 10 == 3+5+2; U2: minted 10 == 5+0+5; U3: minted 0 == 0+0+0; U4: minted 4 == 0+0+4

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0 U4=0, OwnerM U1=2 U2=5 U3=0 U4=4.

On-chain spot check: `shieldedAccountBalance(AA_A, S1)` = 3 (ledger state says 3).

## Operations

- **OwnerN deposits S4 7 -> AA_A** (SDK) — tx `000b61ae6a4a78f81cbbb13e03fa8833c2ad9439cfcde7fe8f4ae8ea910eb48cbd`

