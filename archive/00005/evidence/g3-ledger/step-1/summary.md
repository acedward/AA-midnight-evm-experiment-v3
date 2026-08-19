# Step 1 — Minters TOKA, TOKB, TOKC deployed; 6 colours read on-chain, pairwise distinct

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (6): `S1`, `S2`, `S3`, `U1`, `U2`, `U3`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | U1 | U2 | U3 |
|---|---|---|---|---|---|---|
| OwnerN | 0 | 0 | 0 | 0 | 0 | 0 |
| OwnerM | 0 | 0 | 0 | 0 | 0 | 0 |
| AA_A | 0 | 0 | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 | 0 | 0 |
| pool / ledger | 0 | 0 | 0 | 0 | 0 | 0 |

Exact map sizes: **pools=0 shieldedCells=0 unshieldedCells=0** (expected pools=0 shieldedCells=0 unshieldedCells=0).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; S3: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0; U3: 0 == 0+0

Conservation: S1: minted 0 == 0+0+0; S2: minted 0 == 0+0+0; S3: minted 0 == 0+0+0; U1: minted 0 == 0+0+0; U2: minted 0 == 0+0+0; U3: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=0 U2=0 U3=0, OwnerM U1=0 U2=0 U3=0.

On-chain spot check: `unshieldedAccountBalance(AA_A, U1)` = 0 (ledger state says 0).

## Operations

- **deploy Minter1 (TOKA), Minter2 (TOKB), Minter3 (TOKC)** (SDK) — tx `6f32d9ecfa86442e1b734f93fefae5e023a8d3bc507e3b9bfb19dc125d3ab380`, `8a37dc4e0b45e169c90066d078276b6171145d02fad1f1a0f2b48508aa6efaa0`, `eaf15a6c2510f12f13ce88b2ec156b1db034986d77eb7c1277c8e6940a25dd3a`

