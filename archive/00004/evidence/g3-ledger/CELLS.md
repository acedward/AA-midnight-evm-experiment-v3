# Step-ledger cell index — 00004-multi-token-custody, gate G3

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.
No result here may be extrapolated to a supported or production lane.

Generated 2026-08-18T23:24:21.582Z from the retained run.

| What | Value |
|---|---|
| Manager | `10ea8ca47a36e89a6534148161355156ce2b1cd372ac748502cb273b29cba901` |
| Minter1 (tag `TOKA`) | `8ff81b38627d0a611c3c558eed28b859b0b5e1b9ea88159caee4ae6bc257e692` |
| Minter2 (tag `TOKB`) | `4cf57bdd66fa67d51305194bf68b6611b14261f31e21cfcfee8593cee742a0a0` |
| Minter3 (tag `TOKC`) | `c4b9aec02d9d45d75ffcb7a5bc1d5223658d6130232fcdd09752ab9fa3b4b14f` |
| S1 (shielded, Minter1) | `9c77d2fb6250482c9c7bff6f8ceedc71f687b8d502383b33012f9602d711d888` |
| S2 (shielded, Minter2) | `6dda5d892a426e5776ecb97c6b6ff0131f1bb3f39da6457f8b1d32cc5c0032ab` |
| U1 (unshielded, Minter1) | `888080b72e0f350e6599b3d146a26585a4462a6ec08cea9424b5144785ec0ad3` |
| U2 (unshielded, Minter2) | `90c789c4d6d5bfe7d01f9084e8d337b1a096b4fa272d0eca3958db9404603ca0` |
| control, never configured (Minter3 shielded) | `e9325f1bfbc367ffbd60b40342b9d4f0b6783e1e611a32ccd700aac7fa2c22bd` |
| control, never configured (Minter3 unshielded) | `783bdd8bbde7ee60f214bab51531e268391e5c8e9939d4f593a45c3954e8579b` |
| AA_A account id | `67105e92521d24ccd0b0ee9d2ff842aec4b0dbfb81123b2143c9512fe6f114e7` |
| AA_B account id | `e01c3be2d447aa46f6b9a9d8ab6b0f5fef285782b0b6af40bea330a59de33e92` |
| Total minted | S1 10, S2 10, U1 10, U2 10 |
| M1 transaction | `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` |
| M1 composition shape (decision D-102) | sdk-scoped batch (one transaction, one segment per call, state threaded) |

**25 of 25 items GREEN**, 0 RED, no gaps.

## Final observed table

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 2 |
| OwnerM | 3 | 2 | 0 | 3 |
| AA_A | 3 | 0 | 5 | 0 |
| AA_B | 0 | 8 | 0 | 5 |
| pool / ledger | poolS1=3 | poolS2=8 | ledgerU1=5 | ledgerU2=5 |

Every colour sums to 10 (= minted); each pool/ledger balance equals the sum of its AA column cells.

## Observation points (FR-108)

| Cell class | Point 1 | Point 2 | Point 3 |
|---|---|---|---|
| AA_A / AA_B, per colour | the Manager `balances` map decoded from contract state, every key reproduced by the contract's own pure `balanceKey` circuit | the custody side of the same colour — pooled zswap coin (shielded) or the ledger kernel's unshielded balance — via the per-colour invariant | a real on-chain `accountBalance` circuit call, rotating across all eight AA cells |
| OwnerN / OwnerM, unshielded | a read-only OBSERVER wallet facade that never submitted a transaction (finding F-104) | the UTXO set reconstructed from the indexer's own transaction history, per colour | — |
| OwnerN / OwnerM, shielded | the same observer wallet, coin by coin | the ledger conservation identity `minted[c] == custody[c] + OwnerN[c] + OwnerM[c]` | — |

**Finding F-104 is why the observer wallets exist.** On this pinned lane a wallet that SUBMITTED a
transaction under-reports its own balance afterwards and does not self-correct, while still
returning `progress.isStrictlyComplete() === true`. No submitting wallet is an observation point
anywhere in this gate, and every user-submitted transaction is built by a fresh spender wallet
that is closed immediately afterwards.

## Step rows, probes and controls

| # | Item | Step | Level | Transaction id(s) | Observation points | Status |
|---|---|---|---|---|---|---|
| 1 | Step 0 — baseline: all 16 cells 0; no pools; no contract balances | 0 | SDK | `00542cbc80ba05c1617401201af6cb0a45825cd2e3de62f734638d83a6f5058303`<br>`004a6bed745684b9917ee6f222ed55cac3f35284c8b06ca3c0fb46bb1dc07f8673`<br>`00b74f8069638b56e7980166218959546c5f7730c87939efe49ff1fd39731b2c52`<br>`00b2901bb9133826430be1db4c632338401fc0652f60758ab2b2685a4b231da2a1` | Manager ledger state (8 seeded cells, 0 pools) + on-chain accountBalance spot check | **GREEN** |
| 2 | Step 1 — Minter1 mints S1 `10` → OwnerN | 1 | SDK | `0045181cb47aedb1844393713a0f31d400936cf568fcef792a05e8f1ddd20b2355` | OwnerN observer wallet + ledger conservation for S1; all 15 other cells unchanged | **GREEN** |
| 3 | Step 2 — Minter1 mints U1 `10` → OwnerN | 2 | SDK | `008a147ce27f42faf4bf6a4f0742bed37bccc29359379ab4b4d5d404a18e92e6b0` | OwnerN observer wallet + indexer UTXO reconstruction for U1; all 15 other cells unchanged | **GREEN** |
| 4 | Step 3 — Minter2 mints S2 `10` → OwnerM | 3 | SDK | `0086d01bd3b658f8f067eb0e01752a0a528e50a5872c94a37cb77a10ebf849c0ab` | OwnerM observer wallet + ledger conservation for S2; all 15 other cells unchanged | **GREEN** |
| 5 | Step 4 — Minter2 mints U2 `10` → OwnerM | 4 | SDK | `002b24b97c2c2df2227dbb1cc4e599661099bd51fbcd9f063a6aa8d94a81529104` | OwnerM observer wallet + indexer UTXO reconstruction for U2; all 15 other cells unchanged | **GREEN** |
| 6 | Step 5 — OwnerN deposits S1 `6` → AA_A | 5 | SDK | `0057e73c1475975b379ed58c260e6d621b531f20a7ea68cbd078badb9b068bc047` | Manager balances (AA_A S1 0->6) + that colour's pooled coin; the OTHER shielded pool byte-identical | **GREEN** |
| 7 | Step 6 — OwnerN deposits U1 `5` → AA_A | 6 | SDK | `00469a8269b3b43a46fb26199a7255d5510aa616867c71fd9cbb34d6fd70c73162` | Manager balances (AA_A U1 0->5) + the ledger kernel's unshielded balance for U1 | **GREEN** |
| 8 | Step 7 — OwnerM deposits S2 `6` → AA_B | 7 | SDK | `00216963a7f4cdcae2294a234989730e8ba51fffdf44b221f8702e759a97ce455d` | Manager balances (AA_B S2 0->6) + that colour's pooled coin; the OTHER shielded pool byte-identical | **GREEN** |
| 9 | Step 8 — OwnerM deposits U2 `5` → AA_B | 8 | SDK | `0086ae50203ff22ae3659888abb8bf6d663a7f954574f415468761dabe5919b437` | Manager balances (AA_B U2 0->5) + the ledger kernel's unshielded balance for U2 | **GREEN** |
| 10 | Step 9 — internal transfer S1 `3`: AA_A → AA_B (pool UNCHANGED) | 9 | SDK | `0086407dadb4024f765779716a66662228701e654b38c7cc32dcbf1b0d985ddf96` | Manager balances moved for S1 only; EVERY pooled coin (value AND nonce) and all four custody figures byte-identical before/after | **GREEN** |
| 11 | Step 10 — internal transfer U2 `2`: AA_B → AA_A (ledger UNCHANGED) | 10 | SDK | `00660b98f793ce3a494e31e96253d79289906cf9b8a9968db2acf57e27b2c8b4f2` | Manager balances moved for U2 only; EVERY pooled coin (value AND nonce) and all four custody figures byte-identical before/after | **GREEN** |
| 12 | Step 11 — AA_B withdraws S1 `3` → OwnerM | 11 | SDK | `00d39ad68196e8426254c45c9f59382cf0f161a1dad69aad0eebad4b55d9fb9850` | Manager balances (AA_B S1 3->0) + poolS1 6->3 (change coin retained); OwnerM observer wallet 0->3; poolS2 byte-identical | **GREEN** |
| 13 | Step 12 — AA_A withdraws U2 `2` → OwnerN | 12 | SDK | `00954729ff02920dbd2f91eca1a1aa20cf546f53e6e2c7101f2597be0a51290bc9` | Manager balances (AA_A U2 2->0) + the ledger kernel's U2 balance 5->3; OwnerN observer wallet AND indexer reconstruction both 0->2; ledgerU1 unchanged at 5 | **GREEN** |
| 14 | Step 13 — M1: OwnerM deposits S2 `2` AND U2 `2` → AA_B in ONE transaction | 13 | SDK | `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` | ONE transaction id carries BOTH effects: S2 pool 6->8 (merge) with AA_B S2 6->8, AND the ledger kernel U2 balance 3->5 with AA_B U2 3->5 | **GREEN** |
| 15 | M1 — mixed-colour composition, both effects in ONE transaction id (FR-107) | 13 | SDK | `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` | shape "sdk-scoped batch (one transaction, one segment per call, state threaded)"; both effects observed after a single transaction id | **GREEN** |
| 16 | NC-1 — owner-only / unregistered witness | NC-1 | SDK | — | circuit execution (no transaction built); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 17 | NC-2 — owner-only / cross-account, with a pool that covers the request | NC-2 | SDK | — | circuit execution (no transaction built); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 18 | NC-3 — cross-colour / rich-in-X-broke-in-Y | NC-3 | SDK | — | circuit execution (no transaction built); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 19 | NC-4a — wrong colour / unconfigured, NAMED (unshielded deposit) | NC-4a | SDK | — | circuit execution (no transaction built); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 20 | NC-4b — wrong colour / unconfigured, CARRIED (a real Minter3 shielded coin) | NC-4b | SDK | `00699894645fd54957523e2105d038abbf6de94cf7c10965df7de509ea7851d002` | circuit execution (no transaction built); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 21 | NC-5 — internal transfer colour guard | NC-5 | SDK | — | circuit execution (no transaction built); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 22 | M2 — mixed-colour atomicity negative: the whole transaction fails | M2 | SDK | — | circuit execution of the second leg (the composed transaction is discarded, never submitted); full 16-cell table + both pools + both ledger balances byte-identical before/after | **GREEN** |
| 23 | Distinctness — 15 pairwise comparisons over 6 colours, from on-chain reads | 0 | SDK | — | 15/15 comparisons; Minter3's two colours confirmed ABSENT from the configured set | **GREEN** |
| 24 | Invariant — `custody[c] == AA_A[c] + AA_B[c]`, after EVERY step | 0-13 | derived | — | asserted in `assertAll` after all fourteen rows, per colour, between two independently maintained mechanisms (contract `balances` map vs pooled zswap coin / ledger-kernel unshielded balance) | **GREEN** |
| 25 | FR-105 exactness — `balances.size() == accounts x 4`, zero unaccounted keys, every step | 0-13 | derived | — | every key in raw ledger state reproduced by the contract's own pure `balanceKey` circuit; a cell moving that the step did not name is a step failure | **GREEN** |

### Notes

- **1. step-0** — 15/15 pairwise colour comparisons distinct, read from on-chain circuit calls
- **6. step-5** — A SINGLE wallet-balanced call: the Manager declares the receive and the depositor's wallet supplies the input, so sender spend and Manager receive share one transaction by construction.
- **7. step-6** — A SINGLE wallet-balanced call: the Manager declares the receive and the depositor's wallet supplies the input, so sender spend and Manager receive share one transaction by construction.
- **8. step-7** — A SINGLE wallet-balanced call: the Manager declares the receive and the depositor's wallet supplies the input, so sender spend and Manager receive share one transaction by construction.
- **9. step-8** — A SINGLE wallet-balanced call: the Manager declares the receive and the depositor's wallet supplies the input, so sender spend and Manager receive share one transaction by construction.
- **10. step-9** — The spec's "pool UNCHANGED (no token op)" row, asserted over the whole custody surface rather than one colour.
- **11. step-10** — The spec's "pool UNCHANGED (no token op)" row, asserted over the whole custody surface rather than one colour.
- **14. step-13** — D-102 resolved to: sdk-scoped batch (one transaction, one segment per call, state threaded). one-intent (two same-contract calls in ONE ledger Intent) -> FAILED: Transaction submission error \| sdk-scoped batch (one transaction, one segment per call, state threaded) -> OK
- **16. NC-1** — failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'withdrawShielded'
- **17. NC-2** — failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'
- **18. NC-3** — failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'
- **19. NC-4a** — failed assert: colour is not a configured unshielded colour \| cause: Error executing circuit 'depositUnshielded'
- **20. NC-4b** — failed assert: colour is not a configured shielded colour \| cause: Error executing circuit 'depositShielded'
- **21. NC-5** — failed assert: account colour balance too low \| cause: Error executing circuit 'transferInternal'
- **22. M2** — Unexpected error executing scoped transaction 'aa00004-mixed-colour': Error: failed assert: colour is not a configured unshielded colour \| cause: failed assert: colour is not a configured unshielded colour \| cause: Error executing circuit 'depositUnshielded'

Per-step evidence: `evidence/g3-ledger/step-N/step.json` (expected vs observed, every
observation point, the per-colour invariant, the conservation identity, the spot check and
every operation) and `step-N/summary.md`.

## Negative controls and probe M2 — verbatim

Each proves THREE things: the rejection happened, it was the CONTRACT'S OWN assert (an
unrelated failure recorded as "the guard did its job" would be worthless), and the full
16-cell table, both pools (value AND nonce), both unshielded contract-ledger balances and both
users' coins/UTXOs are byte-identical before and after — re-read after a settle delay, so
"unchanged" is an observation rather than a race.

| Id | Status | Refused at | Verbatim error | Expected message | Funds byte-identical |
|---|---|---|---|---|---|
| `NC-1` | **GREEN** | circuit execution (no transaction built) | `failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'withdrawShielded'` | `/matches no registered account/` matched | yes |
| `NC-2` | **GREEN** | circuit execution (no transaction built) | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'` | `/account colour balance too low/` matched | yes |
| `NC-3` | **GREEN** | circuit execution (no transaction built) | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'` | `/account colour balance too low/` matched | yes |
| `NC-4a` | **GREEN** | circuit execution (no transaction built) | `failed assert: colour is not a configured unshielded colour \| cause: Error executing circuit 'depositUnshielded'` | `/colour is not a configured unshielded colour/` matched | yes |
| `NC-4b` | **GREEN** | circuit execution (no transaction built) | `failed assert: colour is not a configured shielded colour \| cause: Error executing circuit 'depositShielded'` | `/colour is not a configured shielded colour/` matched | yes |
| `NC-5` | **GREEN** | circuit execution (no transaction built) | `failed assert: account colour balance too low \| cause: Error executing circuit 'transferInternal'` | `/account colour balance too low/` matched | yes |
| `M2` | **GREEN** | circuit execution of the second leg (the composed transaction is discarded, never submitted) | `Unexpected error executing scoped transaction 'aa00004-mixed-colour': Error: failed assert: colour is not a configured unshielded colour \| cause: failed assert: colour is not a configured unshielded colour \| cause: Error executing circuit 'depositUnshielded'` | `/colour is not a configured unshielded colour/` matched | yes |

- **NC-1** — Owner-only / unregistered: OwnerN's witness opens no Manager account. Expectation: rejected at the authorization choke point, before any colour, balance or pool guard is reached
  - fixture read from chain: `poolS1` = `3`, `AA_A.S1` = `3`
- **NC-2** — Owner-only / cross-account: OwnerB's witness cannot reach AA_A's S1, though the pool covers it. Expectation: rejected by the PER-ACCOUNT guard, which sits BEFORE the pool guard (FR-104)
  - fixture read from chain: `AA_B.S1` = `0`, `poolS1` = `3`, `AA_A.S1` = `3`
- **NC-3** — Cross-colour: AA_A is rich in U1 (and S1) but holds no S2 at all. Expectation: rejected — wealth in one colour is unspendable in another, however rich the S2 pool is
  - fixture read from chain: `AA_A.U1` = `5`, `AA_A.S1` = `3`, `AA_A.S2` = `0`, `poolS2` = `8`
- **NC-4a** — Wrong colour / named: an unshielded deposit naming Minter3's colour, which `configure` never admitted. Expectation: `configure` is the only gate that admits a colour; an unconfigured one is refused where it is named
  - fixture read from chain: `Minter3.unshielded` = `783bdd8bbde7ee60f214bab51531e268391e5c8e9939d4f593a45c3954e8579b`
- **NC-4b** — Wrong colour / carried: a REAL shielded coin minted by Minter3 offered to `depositShielded`. Expectation: refused by the colour guard before the coin is ever received, so no pool is created for it
  - fixture read from chain: `Minter3.shielded` = `e9325f1bfbc367ffbd60b40342b9d4f0b6783e1e611a32ccd700aac7fa2c22bd`, `minted to OwnerM` = `5`
  - fixture transactions: `00699894645fd54957523e2105d038abbf6de94cf7c10965df7de509ea7851d002`
- **NC-5** — Internal transfer colour guard: AA_A moves S2 it does not hold, while holding S1 and U1. Expectation: rejected by the per-(account, colour) guard; an internal transfer performs no token operation, so nothing else could have absorbed it
  - fixture read from chain: `AA_A.S2` = `0`, `AA_A.S1` = `3`, `AA_A.U1` = `5`
- **M2** — M2 — mixed-colour atomicity negative: the step-13-shaped transaction with the second leg wrong-coloured. Expectation: the WHOLE transaction fails; no partial credit for the valid leg; funds byte-identical
  - fixture read from chain: `valid leg (depositShielded S2 2) built successfully before the failure` = `recorded below`, `wrong colour used for the second leg` = `783bdd8bbde7ee60f214bab51531e268391e5c8e9939d4f593a45c3954e8579b`, `validLegBuilt` = `true`, `shape` = `sdk-scoped batch (one transaction, one segment per call, state threaded)`

Full before/after state in `evidence/g3-ledger/negative-controls.json`.

## M1 and decision D-102 — mixed-colour one-transaction composition

- transaction: `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6`
- shape used: **sdk-scoped batch (one transaction, one segment per call, state threaded)**
- circuits in that transaction: `depositShielded` + `depositUnshielded`

| Shape attempted | Outcome |
|---|---|
| one-intent (two same-contract calls in ONE ledger Intent) | failed — `Transaction submission error` |
| sdk-scoped batch (one transaction, one segment per call, state threaded) | **used** |

## Run metrics

```json
{
  "proofLatencyMs": {
    "count": 42,
    "min": 0,
    "median": 604,
    "max": 6708,
    "mean": 1286
  },
  "transactionBytes": {
    "count": 42,
    "min": 6880,
    "median": 8752,
    "max": 45522,
    "mean": 12412
  },
  "proofs": [
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "shieldedColor",
      "ms": 602
    },
    {
      "circuits": "unshieldedColor",
      "ms": 639
    },
    {
      "circuits": "unknown",
      "ms": 1
    },
    {
      "circuits": "shieldedColor",
      "ms": 734
    },
    {
      "circuits": "unshieldedColor",
      "ms": 478
    },
    {
      "circuits": "unknown",
      "ms": 1
    },
    {
      "circuits": "shieldedColor",
      "ms": 495
    },
    {
      "circuits": "unshieldedColor",
      "ms": 519
    },
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "configure",
      "ms": 243
    },
    {
      "circuits": "registerAccount",
      "ms": 1918
    },
    {
      "circuits": "registerAccount",
      "ms": 790
    },
    {
      "circuits": "accountBalance",
      "ms": 643
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1421
    },
    {
      "circuits": "accountBalance",
      "ms": 458
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 850
    },
    {
      "circuits": "accountBalance",
      "ms": 504
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1672
    },
    {
      "circuits": "accountBalance",
      "ms": 574
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 530
    },
    {
      "circuits": "accountBalance",
      "ms": 448
    },
    {
      "circuits": "depositShielded",
      "ms": 5681
    },
    {
      "circuits": "accountBalance",
      "ms": 472
    },
    {
      "circuits": "depositUnshielded",
      "ms": 945
    },
    {
      "circuits": "accountBalance",
      "ms": 506
    },
    {
      "circuits": "depositShielded",
      "ms": 4601
    },
    {
      "circuits": "accountBalance",
      "ms": 555
    },
    {
      "circuits": "depositUnshielded",
      "ms": 1301
    },
    {
      "circuits": "accountBalance",
      "ms": 554
    },
    {
      "circuits": "transferInternal",
      "ms": 2030
    },
    {
      "circuits": "accountBalance",
      "ms": 460
    },
    {
      "circuits": "transferInternal",
      "ms": 1174
    },
    {
      "circuits": "accountBalance",
      "ms": 458
    },
    {
      "circuits": "withdrawShielded",
      "ms": 5688
    },
    {
      "circuits": "accountBalance",
      "ms": 604
    },
    {
      "circuits": "withdrawUnshielded",
      "ms": 1037
    },
    {
      "circuits": "accountBalance",
      "ms": 546
    },
    {
      "circuits": "depositShielded+depositUnshielded",
      "ms": 6708
    },
    {
      "circuits": "depositUnshielded+depositShielded",
      "ms": 4861
    },
    {
      "circuits": "accountBalance",
      "ms": 904
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1398
    }
  ],
  "transactions": [
    {
      "label": "feePayer/minter",
      "bytes": 12573
    },
    {
      "label": "feePayer/minter",
      "bytes": 8245
    },
    {
      "label": "feePayer/minter",
      "bytes": 8248
    },
    {
      "label": "feePayer/minter",
      "bytes": 12572
    },
    {
      "label": "feePayer/minter",
      "bytes": 8246
    },
    {
      "label": "feePayer/minter",
      "bytes": 8248
    },
    {
      "label": "feePayer/minter",
      "bytes": 12573
    },
    {
      "label": "feePayer/minter",
      "bytes": 8245
    },
    {
      "label": "feePayer/minter",
      "bytes": 8246
    },
    {
      "label": "feePayer/manager",
      "bytes": 24655
    },
    {
      "label": "feePayer/manager",
      "bytes": 6880
    },
    {
      "label": "feePayer/manager",
      "bytes": 8849
    },
    {
      "label": "feePayer/manager",
      "bytes": 8848
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/minter",
      "bytes": 13927
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/minter",
      "bytes": 8909
    },
    {
      "label": "feePayer/manager",
      "bytes": 8271
    },
    {
      "label": "feePayer/minter",
      "bytes": 13926
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/minter",
      "bytes": 8908
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "OwnerN-spender-1-step5/manager",
      "bytes": 24212
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "OwnerN-spender-2-step6/manager",
      "bytes": 9090
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "OwnerM-spender-3-step7/manager",
      "bytes": 24223
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "OwnerM-spender-4-step8/manager",
      "bytes": 9180
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/manager",
      "bytes": 8752
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/manager",
      "bytes": 9010
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/manager",
      "bytes": 24825
    },
    {
      "label": "feePayer/manager",
      "bytes": 8266
    },
    {
      "label": "feePayer/manager",
      "bytes": 9477
    },
    {
      "label": "feePayer/manager",
      "bytes": 8272
    },
    {
      "label": "OwnerM-spender-5-step13-M1-try1/manager",
      "bytes": 45257
    },
    {
      "label": "OwnerM-spender-5-step13-M1-try1/manager",
      "bytes": 45522
    },
    {
      "label": "feePayer/manager",
      "bytes": 8265
    },
    {
      "label": "feePayer/minter",
      "bytes": 13927
    }
  ]
}
```

