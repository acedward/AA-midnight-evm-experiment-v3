# Step 8 — Provenance re-send, unshielded: OwnerM→AA_A; AA_B→OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/5 | 5/5 |
| OwnerN | 5/5 | 5/5 |
| AA_B | 5/5 | 5/5 |
| OwnerM | 5/5 | 5/5 |

Manager pooled shielded coin: **10** (nonce `a40cc158897547c85852cf1aef69e37fb312472986b9932af29ddb62e6244f00`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=5, OwnerM=5.

## Operations

- **OwnerM -5-> AA_A (unshielded, AA-originated)** (SDK) — tx `006b224225d66a19945cda17234a805c4eb03fb776d731f8b850977a94cfbbd2bc`
- **AA_B -5-> OwnerN (unshielded, user-originated)** (SDK) — tx `000ee8337243dffb345aca2cdef32567898af968d133520198663614cce3c0b2ae`
