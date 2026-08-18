# Step 5 — Send unshielded half: OwnerN→OwnerM (UTXO split); AA_A→AA_B (internal)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 0/5 | 0/5 |
| OwnerN | 0/5 | 0/5 |
| AA_B | 10/5 | 10/5 |
| OwnerM | 10/5 | 10/5 |

Manager pooled shielded coin: **10** (nonce `9ff6eef0e2c327d3dd0eac2ad93344c20ba3d2877908731b4bc1101b1e238900`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=5, OwnerM=5.

## Operations

- **OwnerN -5-> OwnerM (unshielded)** (wallet) — tx `000bc261150d906f1eb0684e2db12b90690dc8cbbfad704eb3fec56e07473509d1`
- **AA_A -5-> AA_B (internal, unshielded)** (SDK) — tx `0073d02d7b0076a2e3d5ef9f229467cf2b03f3d8358e45f349cc5555c46c00026f`
