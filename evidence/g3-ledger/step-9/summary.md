# Step 9 — Self-send round: OwnerM self-sends both families; the pool self-sends both families

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/5 | 5/5 |
| OwnerN | 5/5 | 5/5 |
| AA_B | 5/5 | 5/5 |
| OwnerM | 5/5 | 5/5 |

Manager pooled shielded coin: **10** (nonce `07d6c3f1d1fcdb8669cee8bc0c542146b7bcf3226f2959a9c0277497678e3b00`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=5, OwnerM=5.

## Operations

- **OwnerM self-send shielded 2 of 5** (wallet) — tx `0008b3f3e108ea950e7ad5ec06c2b5f5cec9525e3f47646b45a4c4ac5abf13eac2`
- **OwnerM self-send unshielded 2 of 5** (wallet) — tx `0019d4c01f5c78829e191cb903e0bee5a82dd36f84ca9176d8b51b0952a5d0b471`
- **pool self-send shielded** (SDK) — tx `00231ac50fa8c55026a7f3e63804ddf1fdf7f64e8a389ea3d13c8ddcf83d2dd750`
- **pool self-send unshielded** (SDK) — tx `00cf15e008a2778dac37ef52a5b16ee582e2285f095cf4c8caf7afe6e1790b1f5b`
