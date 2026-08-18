# Step 4 — Send shielded remaining half crossed: OwnerN→AA_B deposit; AA_A→OwnerM payout

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 0/10 | 0/10 |
| OwnerN | 0/10 | 0/10 |
| AA_B | 10/0 | 10/0 |
| OwnerM | 10/0 | 10/0 |

Manager pooled shielded coin: **10** (nonce `9ff6eef0e2c327d3dd0eac2ad93344c20ba3d2877908731b4bc1101b1e238900`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=10, OwnerM=0.

## Operations

- **OwnerN -5-> AA_B (shielded deposit, merged into the pool)** (SDK) — tx `002959d6e210ded9bc901665c00ee233583485289eb5d86eed0bb86bcae95986a7`
- **AA_A -5-> OwnerM (shielded payout from the pool)** (SDK) — tx `006a801072dc462c473c1e1b97dc120fd4cc7456129d73c1d62c2a375d6c65b571`
