# Step 9 — Self-send round: OwnerM self-sends both families; the pool self-sends both families

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/5 | 5/5 |
| OwnerN | 5/5 | 5/5 |
| AA_B | 5/5 | 5/5 |
| OwnerM | 5/5 | 5/5 |

Manager pooled shielded coin: **10** (nonce `bb9e3d5ce419284e14935d9eb41bfaa6200e69ca84e95d1e3550eb0e52654200`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=5, OwnerM=5.

## Operations

- **OwnerM self-send shielded 2 of 5** (wallet) — tx `00a692f516cc5798c3a75478bf6b10320c85446f1033be52979b6e7d4ed112a249`
- **OwnerM self-send unshielded 2 of 5** (wallet) — tx `006605e5205a05660adcf595a0e986fe4ac4de8357ad2f2248f4231ae0c3586cd7`
- **pool self-send shielded** (SDK) — tx `005feb4dd26b63667f8c0868c7767eba78c3d7dd920c8a0eaa406539244074386f`
- **pool self-send unshielded** (SDK) — tx `005e09c4f3eba61cd6f138dacad62e07cebf5217bc97b2998a5b655b2cc5fa8657`
