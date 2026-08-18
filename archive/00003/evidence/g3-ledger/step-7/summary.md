# Step 7 — Provenance re-send, shielded: OwnerM→AA_A; AA_B→OwnerN

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/0 | 5/0 |
| OwnerN | 5/0 | 5/0 |
| AA_B | 5/10 | 5/10 |
| OwnerM | 5/10 | 5/10 |

Manager pooled shielded coin: **10** (nonce `c4c651a534477e79461a9f4e2974c67ae245f58cb75b078d4b7f0088a236a800`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=0, OwnerM=10.

## Operations

- **OwnerM -5-> AA_A (shielded, AA-originated coins)** (SDK) — tx `009e72100fcfeb95fb3dba5c79a80ba1bdfc9fa3f59ee6188ac2a6886dbdd3201b`
- **AA_B -5-> OwnerN (shielded, user-originated value)** (SDK) — tx `000d138dc876a51acb3cd8ebd69572f171da6e4698ee7adcc0a0ea755332763d13`
