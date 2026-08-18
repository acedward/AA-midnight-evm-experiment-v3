# Step 3 — Send shielded half: OwnerN→OwnerM (wallet split); AA_A→AA_B (internal)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/10 | 5/10 |
| OwnerN | 5/10 | 5/10 |
| AA_B | 5/0 | 5/0 |
| OwnerM | 5/0 | 5/0 |

Manager pooled shielded coin: **10** (nonce `f6485e5cb5d77030ede1e81cf276051773c15faabecdaf5410d637ca017721d7`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=10, OwnerM=0.

## Operations

- **OwnerN -5-> OwnerM (shielded)** (wallet) — tx `0015122e6c0e8c56c11916fd92d80f851daac575fda81e42ec2f0924aebf6f5e1e`
- **AA_A -5-> AA_B (internal, shielded)** (SDK) — tx `00750fac57ef7742d794cc35c1443e3f4b2d9faf25fe880d2dea841158e62ae3be`
