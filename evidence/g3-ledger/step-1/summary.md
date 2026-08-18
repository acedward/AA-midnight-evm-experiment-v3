# Step 1 — Mint shielded 10 to AA_A and 10 to OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 10/0 | 10/0 |
| OwnerN | 10/0 | 10/0 |
| AA_B | 0/0 | 0/0 |
| OwnerM | 0/0 | 0/0 |

Manager pooled shielded coin: **10** (nonce `9c7f5b06a9e6ffa58294fa1ed68c15c2a9367e5d53ec3ecc786d3ce4b434c0a2`)
Manager unshielded ledger balance: **0**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer cross-check of user unshielded balances: OwnerN=0, OwnerM=0.

## Operations

- **mint shielded 10 -> AA_A** (LEDGER) — tx `00a18abc4ebbd4e5e6367e3cf877b84574d6ba13cf582fc1b2a19e5d56d0ae369c`
- **mint shielded 10 -> OwnerN** (SDK) — tx `00b312d681706098b52f80574410a91b937158893a8ac7cdedba96fb510b690bf2`
