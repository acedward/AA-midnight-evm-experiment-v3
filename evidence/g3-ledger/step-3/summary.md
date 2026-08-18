# Step 3 — Send shielded half: OwnerN→OwnerM (wallet split); AA_A→AA_B (internal)

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

| party | expected | observed |
|---|---|---|
| AA_A | 5/10 | 5/10 |
| OwnerN | 5/10 | 5/10 |
| AA_B | 5/0 | 5/0 |
| OwnerM | 5/0 | 5/0 |

Manager pooled shielded coin: **10** (nonce `70766988b69b5e89761e110d2f39b0c938d4b4896a0fa19117a537bb7522705c`)
Manager unshielded ledger balance: **10**
Invariant `pool = AA_A + AA_B` asserted in BOTH families.
Indexer reconstruction of user unshielded balances (independent of the wallet): OwnerN=10, OwnerM=0.

## Operations

- **OwnerN -5-> OwnerM (shielded)** (wallet) — tx `00251e6da2e81dc7fa0496c812e3828d0968e916e0c70d2926356d589c6e19fca2`
- **AA_A -5-> AA_B (internal, shielded)** (SDK) — tx `0027122ab1bc8c1e61c46bccdc66159efeae59476b0f63285bda350e77de2a1146`
