# Step 15 — TOKD deployed MID-LEDGER; mint S4 7 -> OwnerN, U4 4 -> OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (8): `S1`, `S2`, `S3`, `S4`, `U1`, `U2`, `U3`, `U4`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 7 | 5 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 4 |
| AA_A | 3 | 0 | 4 | 0 | 3 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 0 |
| pool / ledger | 6 | 4 | 4 | 0 | 3 | 5 | 0 | 0 |

Exact map sizes: **pools=3 shieldedCells=4 unshieldedCells=2** (expected pools=3 shieldedCells=4 unshieldedCells=2).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: S1: 6 == 3+3; S2: 4 == 0+4; S3: 4 == 4+0; S4: 0 == 0+0; U1: 3 == 3+0; U2: 5 == 0+5; U3: 0 == 0+0; U4: 0 == 0+0

Conservation: S1: minted 10 == 6+4+0; S2: minted 10 == 4+2+4; S3: minted 10 == 4+0+6; S4: minted 7 == 0+7+0; U1: minted 10 == 3+5+2; U2: minted 10 == 5+0+5; U3: minted 0 == 0+0+0; U4: minted 4 == 0+0+4

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=0 U3=0 U4=0, OwnerM U1=2 U2=5 U3=0 U4=4.

On-chain spot check: `unshieldedAccountBalance(AA_B, U4)` = 0 (ledger state says 0).

## Operations

- **deploy Minter4 (TOKD) MID-LEDGER, then mint S4 7 -> OwnerN and U4 4 -> OwnerM** (SDK) — tx `008235b1d8e48c66cef6e4b07ca5040b1d833e9be21e8d081eb0fe4e0c016c5eec`, `00b3dd19b95b1178bef9edb6c853df8e829fbc33dd951535335e8025432499a318`, `00e3b6e3883081bb9c4ad8d9f0cbc5ce7da0b56091226eef0031ed6ecdb00c0c20`

