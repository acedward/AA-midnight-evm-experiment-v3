# Step 7 — Provenance re-send, shielded: OwnerM→AA_A; AA_B→OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/0 | 5/0 |
| OwnerN | 5/0 | 5/0 |
| AA_B | 5/10 | 5/10 |
| OwnerM | 5/10 | 5/10 |

Manager pooled shielded coin: **10** (nonce `a40cc158897547c85852cf1aef69e37fb312472986b9932af29ddb62e6244f00`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=0, OwnerM=10.

## Operations

- **OwnerM -5-> AA_A (shielded, AA-originated coins)** (SDK) — tx `00c237ea4b07884ec2c2ca101d3127006cff0afe5f67dfea77ed1d815cb28a81bd`
- **AA_B -5-> OwnerN (shielded, user-originated value)** (SDK) — tx `0042254eed7b69486aa8e56e1863a68338aafcda360fac81a2977b6b9ec33a61c8`
