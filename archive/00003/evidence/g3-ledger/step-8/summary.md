# Step 8 — Provenance re-send, unshielded: OwnerM→AA_A; AA_B→OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/5 | 5/5 |
| OwnerN | 5/5 | 5/5 |
| AA_B | 5/5 | 5/5 |
| OwnerM | 5/5 | 5/5 |

Manager pooled shielded coin: **10** (nonce `c4c651a534477e79461a9f4e2974c67ae245f58cb75b078d4b7f0088a236a800`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=5, OwnerM=5.

## Operations

- **OwnerM -5-> AA_A (unshielded, AA-originated)** (SDK) — tx `008a159ecf14df721a79ba52c12a2c555ec1896a99fb8287dab8e76e45c3f3593e`
- **AA_B -5-> OwnerN (unshielded, user-originated)** (SDK) — tx `001c9cdf26b00b74d437fc59f8012f35e8f46b2f5afbb2ee81dce911d93c8bfb2f`
