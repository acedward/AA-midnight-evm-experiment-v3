# Step 5 — Send unshielded half: OwnerN→OwnerM (UTXO split); AA_A→AA_B (internal)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 0/5 | 0/5 |
| OwnerN | 0/5 | 0/5 |
| AA_B | 10/5 | 10/5 |
| OwnerM | 10/5 | 10/5 |

Manager pooled shielded coin: **10** (nonce `e18edd0a3e453388eaf033544e345202a4dd43f223bc515ebf9ded9f34723700`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=5, OwnerM=5.

## Operations

- **OwnerN -5-> OwnerM (unshielded)** (wallet) — tx `006014fa982cadce175b0fe63b569f1982d04aa2a667b3d2eae137a3bc9f9f3706`
- **AA_A -5-> AA_B (internal, unshielded)** (SDK) — tx `00d790d6eda6036dda9858164d60ba43db9c470eee636e9b70978f649b41734985`
