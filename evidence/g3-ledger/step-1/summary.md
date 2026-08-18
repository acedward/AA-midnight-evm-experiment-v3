# Step 1 — Mint shielded 10 to AA_A and 10 to OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 10/0 | 10/0 |
| OwnerN | 10/0 | 10/0 |
| AA_B | 0/0 | 0/0 |
| OwnerM | 0/0 | 0/0 |

Manager pooled shielded coin: **10** (nonce `f6485e5cb5d77030ede1e81cf276051773c15faabecdaf5410d637ca017721d7`)
Manager unshielded ledger balance: **0**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=0, OwnerM=0.

## Operations

- **mint shielded 10 -> AA_A** (LEDGER) — tx `00b17fa731c6778f2691f3d34e44220692c2798adb1749fee33872d4466cf6de06`
- **mint shielded 10 -> OwnerN** (SDK) — tx `001c0dc9cf0169448d6a7df4101132b02818aa960bda50d23a06d83dacd18a4992`
