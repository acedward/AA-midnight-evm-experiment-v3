# Step 6 — Send unshielded remaining half crossed: OwnerN→AA_B; AA_A→OwnerM

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 0/0 | 0/0 |
| OwnerN | 0/0 | 0/0 |
| AA_B | 10/10 | 10/10 |
| OwnerM | 10/10 | 10/10 |

Manager pooled shielded coin: **10** (nonce `e18edd0a3e453388eaf033544e345202a4dd43f223bc515ebf9ded9f34723700`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=0, OwnerM=10.

## Operations

- **OwnerN -5-> AA_B (unshielded deposit)** (SDK) — tx `00d355860b50d061506ded0910f1c25642f43a94b5a54056e7641d699433234e88`
- **AA_A -5-> OwnerM (unshielded payout)** (SDK) — tx `0036eca8f6375d9004cf6ee219002530e91f61fd2c6db1eadc5a84377528d31aaf`
