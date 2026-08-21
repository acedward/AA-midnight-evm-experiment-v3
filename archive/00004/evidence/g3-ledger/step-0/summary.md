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

- **deploy 3 Minters + Manager, configure, register both accounts** (SDK) — tx `00542cbc80ba05c1617401201af6cb0a45825cd2e3de62f734638d83a6f5058303`, `004a6bed745684b9917ee6f222ed55cac3f35284c8b06ca3c0fb46bb1dc07f8673`, `00b74f8069638b56e7980166218959546c5f7730c87939efe49ff1fd39731b2c52`, `00b2901bb9133826430be1db4c632338401fc0652f60758ab2b2685a4b231da2a1`

