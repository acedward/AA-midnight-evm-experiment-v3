# Step 0 — baseline — deploy 3 Minters + 1 Manager, configure S1/S2/U1/U2, register AA_A and AA_B

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 0 | 0 | 0 | 0 |
| OwnerM | 0 | 0 | 0 | 0 |
| AA_A | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |
| pool / ledger | poolS1=0 | poolS2=0 | ledgerU1=0 | ledgerU2=0 |

Per-colour invariant: S1: 0 == 0+0; S2: 0 == 0+0; U1: 0 == 0+0; U2: 0 == 0+0

Conservation: S1: minted 0 == 0+0+0; S2: minted 0 == 0+0+0; U1: minted 0 == 0+0+0; U2: minted 0 == 0+0+0

Indexer reconstruction (independent of every wallet): OwnerN U1=0 U2=0, OwnerM U1=0 U2=0.

On-chain spot check: `accountBalance(AA_A, S1)` = 0 (ledger state says 0).

## Operations

- **deploy 3 Minters + Manager, configure, register both accounts** (SDK) — tx `0029a2766ea4c8fbc58497859c4c37c3cdbd81258e1e807cb3e3ab53e75d8ef831`, `008c3011bccf86f4d1d86e3aae057c0ee2b414ccca14d191cd84d57fa8855188d6`, `003295a2fda3d280b84b014ec69afe2382853fadf6ea937224e393e28cad5bba69`, `00b54b63ca2f701f3905e0ed9f4d111086370375090f734bd64f146d23406aeb4b`

