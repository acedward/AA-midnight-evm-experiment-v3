# Step 2 — Mint unshielded 10 to AA_A and 10 to OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 10/10 | 10/10 |
| OwnerN | 10/10 | 10/10 |
| AA_B | 0/0 | 0/0 |
| OwnerM | 0/0 | 0/0 |

Manager pooled shielded coin: **10** (nonce `70766988b69b5e89761e110d2f39b0c938d4b4896a0fa19117a537bb7522705c`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=10, OwnerM=0.

## Operations

- **mint unshielded 10 -> AA_A** (LEDGER) — tx `0051b5ea962ab7d7d393066d9153c1ca385530b5a2986e6ad2ea52c9477fc4ee02`
- **mint unshielded 10 -> OwnerN** (SDK) — tx `00386c9b07abfc21ddf610caab1029a5e03a9264b8479ef399cc18c615c3d938e2`
