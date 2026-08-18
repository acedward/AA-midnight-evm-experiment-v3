# Step 2 — Mint unshielded 10 to AA_A and 10 to OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 10/10 | 10/10 |
| OwnerN | 10/10 | 10/10 |
| AA_B | 0/0 | 0/0 |
| OwnerM | 0/0 | 0/0 |

Manager pooled shielded coin: **10** (nonce `f6485e5cb5d77030ede1e81cf276051773c15faabecdaf5410d637ca017721d7`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=10, OwnerM=0.

## Operations

- **mint unshielded 10 -> AA_A** (LEDGER) — tx `009ccce9fe55719af78117c0ece283a0e7c8abb796142e5ee0c059f460b4c8a61a`
- **mint unshielded 10 -> OwnerN** (SDK) — tx `0082d7489eebe563457f90abda4d8d486eb952fd2a82c017a125730a0c2c4544c2`
