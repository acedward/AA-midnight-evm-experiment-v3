# Step 6 — Send unshielded remaining half crossed: OwnerN→AA_B; AA_A→OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 0/0 | 0/0 |
| OwnerN | 0/0 | 0/0 |
| AA_B | 10/10 | 10/10 |
| OwnerM | 10/10 | 10/10 |

Manager pooled shielded coin: **10** (nonce `9ff6eef0e2c327d3dd0eac2ad93344c20ba3d2877908731b4bc1101b1e238900`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=0, OwnerM=10.

## Operations

- **OwnerN -5-> AA_B (unshielded deposit)** (SDK) — tx `00536295344ab906ca53c3732f5b1dd9c0727cac04e57cbc6f7252549d3393076a`
- **AA_A -5-> OwnerM (unshielded payout)** (SDK) — tx `00bdaaa54dda66a85639dca95f6377f8adff1675f9cefb0337a43f3cc059618d85`
