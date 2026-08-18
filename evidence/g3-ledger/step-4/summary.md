# Step 4 — Send shielded remaining half crossed: OwnerN→AA_B deposit; AA_A→OwnerM payout

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 0/10 | 0/10 |
| OwnerN | 0/10 | 0/10 |
| AA_B | 10/0 | 10/0 |
| OwnerM | 10/0 | 10/0 |

Manager pooled shielded coin: **10** (nonce `e18edd0a3e453388eaf033544e345202a4dd43f223bc515ebf9ded9f34723700`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=10, OwnerM=0.

## Operations

- **OwnerN -5-> AA_B (shielded deposit, merged into the pool)** (SDK) — tx `00840033b61dae10cea6dbd9af3637bb69b3463ddee2069231367f10e9acac00be`
- **AA_A -5-> OwnerM (shielded payout from the pool)** (SDK) — tx `00dbe07636c98b82e7a8910de56f24e12b3ee7f711bb1772e485991a5aa9834351`
