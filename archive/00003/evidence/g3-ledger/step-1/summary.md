# Step 1 — Mint shielded 10 to AA_A and 10 to OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 10/0 | 10/0 |
| OwnerN | 10/0 | 10/0 |
| AA_B | 0/0 | 0/0 |
| OwnerM | 0/0 | 0/0 |

Manager pooled shielded coin: **10** (nonce `70766988b69b5e89761e110d2f39b0c938d4b4896a0fa19117a537bb7522705c`)
Manager unshielded ledger balance: **0**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=0, OwnerM=0.

## Operations

- **mint shielded 10 -> AA_A** (LEDGER) — tx `0067f1f51f53250735484f4c64f4b932eeca3769e4d33e66c7b078ea900ffed7f2`
- **mint shielded 10 -> OwnerN** (SDK) — tx `000802036ff2a325f1a367f27d295edc0547cde468df3d94a3f92c3d36673aa22a`
