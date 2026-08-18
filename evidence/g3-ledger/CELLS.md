# Combination-matrix cell index — 00003-contract-token-custody

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.
No result here may be extrapolated to a supported or production lane.

Generated 2026-08-18T12:19:30.953Z from the retained run.

| What | Value |
|---|---|
| Minter | `714b91e890473b543faa22c252b5e5ec363b9d2f1949739c127bcde7cbf84584` |
| Manager | `2d9e02fd4edf13fba3f939cf6827712ca86590a240cda621ccc61a1e07e3779c` |
| Shielded colour | `e12ca8d2ec41ec066787e117d236ff0c5948196b380aada851d35e4658631664` |
| Unshielded colour | `6cdb40587d70ea2b425904a791f57b0b71de6f2be92ddbf4d9e7d37669e7776c` |
| AA_A account id | `dcf015b07f71ae71c6ccdae873ca9a2f67cd9bb8745ea70fb58348b6d802f331` |
| AA_B account id | `bcc499e63190cb1aade1ffb6cfec52ba5b0502881343a3775ce8ad50cc02317c` |
| Total minted | shielded 20, unshielded 20 |

**26 of 26 cells GREEN**, 0 RED, no gaps.

## Composition level

Recorded per cell, as the master plan requires:

- **LEDGER** — the paired mint→Manager cells. midnight-js cannot express a minting
  contract's spend claim and a second contract's receive claim in one transaction, so both
  `ContractCallPrototype`s are assembled into ONE ledger `Intent` (`src/g3/ledger-compose.ts`),
  mirroring `midnight-ledger/ledger/tests/token_vault_shielded.rs`. Each call's transcript still
  comes from executing the real compiled circuit; only the assembly is at ledger level.
- **SDK** — a single midnight-js contract call, balanced by the relevant wallet. This covers every
  user→Manager deposit: the Manager declares the receive and the depositor's wallet supplies the
  input, so sender spend and Manager receive are in one transaction by construction (FR-003).
- **wallet** — no contract at all: a wallet-to-wallet (or wallet-to-self) transfer.
- **derived** — an invariant asserted over other cells' observations rather than its own transaction.

## Cells

| # | Cell | Step | Level | Transaction id(s) | Observation points | Status |
|---|---|---|---|---|---|---|
| 1 | Mint shielded → user (step 1) | 1 | SDK | `001c0dc9cf0169448d6a7df4101132b02818aa960bda50d23a06d83dacd18a4992` | OwnerN wallet SDK (0→10) + ledger conservation (minted == pool + users' holdings) | **GREEN** |
| 2 | Mint shielded → manager account (step 1) | 1 | LEDGER | `00b17fa731c6778f2691f3d34e44220692c2798adb1749fee33872d4466cf6de06` | Manager account map (AA_A 0→10) + pooled zswap coin (0→10, nonce == the mint nonce) | **GREEN** |
| 3 | Mint unshielded → user (step 2) | 2 | SDK | `0082d7489eebe563457f90abda4d8d486eb952fd2a82c017a125730a0c2c4544c2` | OwnerN wallet SDK (0→10) + indexer `unshieldedUtxos` for OwnerN (0→10) | **GREEN** |
| 4 | Mint unshielded → manager account (step 2) | 2 | LEDGER | `009ccce9fe55719af78117c0ece283a0e7c8abb796142e5ee0c059f460b4c8a61a` | Manager account map (AA_A 0→10) + the contract's unshielded ledger balance from the indexer (0→10) | **GREEN** |
| 5 | Send shielded user→user (step 3) | 3 | wallet | `0015122e6c0e8c56c11916fd92d80f851daac575fda81e42ec2f0924aebf6f5e1e` | OwnerN + OwnerM wallet SDK states + ledger conservation identity | **GREEN** |
| 6 | Shielded account→account internal ownership transfer, no ledger movement (step 3) | 3 | SDK | `00750fac57ef7742d794cc35c1443e3f4b2d9faf25fe880d2dea841158e62ae3be` | Manager account map (AA_A 10→5, AA_B 0→5) + pooled coin value AND nonce byte-identical before/after | **GREEN** |
| 7 | Send shielded user→account (step 4) | 4 | SDK | `002959d6e210ded9bc901665c00ee233583485289eb5d86eed0bb86bcae95986a7` | Manager account map (AA_B 5→10) + pooled coin (10→15); OwnerN wallet 5→0 | **GREEN** |
| 8 | Send shielded account→user (step 4) | 4 | SDK | `006a801072dc462c473c1e1b97dc120fd4cc7456129d73c1d62c2a375d6c65b571` | Manager account map (AA_A 5→0) + pooled coin (15→10); OwnerM wallet 5→10 | **GREEN** |
| 9 | Send unshielded user→user (step 5) | 5 | wallet | `000bc261150d906f1eb0684e2db12b90690dc8cbbfad704eb3fec56e07473509d1` | OwnerN + OwnerM wallet SDK states + the indexer’s `unshieldedUtxos` for both addresses | **GREEN** |
| 10 | Unshielded account→account internal ownership transfer, no ledger movement (step 5) | 5 | SDK | `0073d02d7b0076a2e3d5ef9f229467cf2b03f3d8358e45f349cc5555c46c00026f` | Manager account map (AA_A 10→5, AA_B 0→5) + the contract's unshielded ledger balance unchanged at 10 | **GREEN** |
| 11 | Send unshielded user→account (step 6) | 6 | SDK | `00536295344ab906ca53c3732f5b1dd9c0727cac04e57cbc6f7252549d3393076a` | Manager account map (AA_B 5→10) + contract unshielded ledger balance (10→15); OwnerN wallet and indexer both 5→0 | **GREEN** |
| 12 | Send unshielded account→user (step 6) | 6 | SDK | `00bdaaa54dda66a85639dca95f6377f8adff1675f9cefb0337a43f3cc059618d85` | Manager account map (AA_A 5→0) + contract unshielded ledger balance (15→10); OwnerM wallet and indexer 5→10 | **GREEN** |
| 13 | Provenance: user re-sends AA-originated shielded coins (step 7) | 7 | SDK | `00c237ea4b07884ec2c2ca101d3127006cff0afe5f67dfea77ed1d815cb28a81bd` | OwnerM's wallet spent coins CREATED BY THE MANAGER in step 4 (10→5) + Manager account map AA_A 0→5 | **GREEN** |
| 14 | Provenance: AA account re-sends user-originated shielded value (step 7) | 7 | SDK | `0042254eed7b69486aa8e56e1863a68338aafcda360fac81a2977b6b9ec33a61c8` | AA_B's holdings include OwnerN's step-4 deposit; account map 10→5 + pooled coin pays out and retains change | **GREEN** |
| 15 | Provenance: user re-sends AA-originated unshielded tokens (step 8) | 8 | SDK | `006b224225d66a19945cda17234a805c4eb03fb776d731f8b850977a94cfbbd2bc` | OwnerM spends UTXOs paid out by the Manager in step 6 (wallet + indexer both 10→5) + account map AA_A 0→5 | **GREEN** |
| 16 | Provenance: AA account re-sends user-originated unshielded tokens (step 8) | 8 | SDK | `000ee8337243dffb345aca2cdef32567898af968d133520198663614cce3c0b2ae` | AA_B re-spends OwnerN's step-6 deposit; account map 10→5 + contract ledger balance falls by 5 | **GREEN** |
| 17 | Self-send: user shielded to own key (step 9) | 9 | wallet | `0008b3f3e108ea950e7ad5ec06c2b5f5cec9525e3f47646b45a4c4ac5abf13eac2` | OwnerM balance unchanged at 5; coins ["5"] → ["2","3"] with new commitments | **GREEN** |
| 18 | Self-send: user unshielded UTXO self-split (step 9) | 9 | wallet | `0019d4c01f5c78829e191cb903e0bee5a82dd36f84ca9176d8b51b0952a5d0b471` | OwnerM balance unchanged at 5 (wallet AND indexer); UTXOs ["5"] → ["2","3"] | **GREEN** |
| 19 | Self-send: pool shielded to `kernel.self()` via auto-receive (step 9) | 9 | SDK | `00231ac50fa8c55026a7f3e63804ddf1fdf7f64e8a389ea3d13c8ddcf83d2dd750` | pool value unchanged at 10; nonce a40cc158897547c85852cf1aef69e37fb312472986b9932af29ddb62e6244f00 → 07d6c3f1d1fcdb8669cee8bc0c542146b7bcf3226f2959a9c0277497678e3b00; account map byte-identical | **GREEN** |
| 20 | Self-send: pool unshielded to self via auto-receive (step 9) | 9 | SDK | `00cf15e008a2778dac37ef52a5b16ee582e2285f095cf4c8caf7afe6e1790b1f5b` | contract ledger balance and account map BOTH byte-identical at 10 | **GREEN** |
| 21 | Split: shielded user wallet change (step 3, OwnerN) | 3 | wallet | `0015122e6c0e8c56c11916fd92d80f851daac575fda81e42ec2f0924aebf6f5e1e` | OwnerN's enumerated coins before/after: the 10-coin is consumed and a 5 change coin created | **GREEN** |
| 22 | Split: shielded contract change coin retained in pool (step 4) | 4 | SDK | `006a801072dc462c473c1e1b97dc120fd4cc7456129d73c1d62c2a375d6c65b571` | pooled coin 15@6e07c333425c08fa4042a95e962abd8baa2fa566bd3764b53bf2e0cc13a33800 → 10@9ff6eef0e2c327d3dd0eac2ad93344c20ba3d2877908731b4bc1101b1e238900 | **GREEN** |
| 23 | Split: unshielded user UTXO split into sent + change (step 5, OwnerN) | 5 | wallet | `000bc261150d906f1eb0684e2db12b90690dc8cbbfad704eb3fec56e07473509d1` | OwnerN UTXOs ["10"] → ["5"]; OwnerM gained ["5"] | **GREEN** |
| 24 | Split: unshielded partial pooled-balance spend (step 6) | 6 | SDK | `00bdaaa54dda66a85639dca95f6377f8adff1675f9cefb0337a43f3cc059618d85` | the contract held 15 and paid out 5, retaining 10 | **GREEN** |
| 25 | Merge: pool combines deposited coin with held coin (step 4) | 4 | SDK | `002959d6e210ded9bc901665c00ee233583485289eb5d86eed0bb86bcae95986a7` | pooled coin 10@f6485e5cb5d77030ede1e81cf276051773c15faabecdaf5410d637ca017721d7 → 15@6e07c333425c08fa4042a95e962abd8baa2fa566bd3764b53bf2e0cc13a33800 — one coin, value 10+5 | **GREEN** |
| 26 | Invariant: `pooled holdings = AA_A + AA_B` per family, asserted after **every** step | 9 | derived | — | asserted in `assertAll` after all ten steps, in both families, against two independently maintained mechanisms | **GREEN** |

### Notes

- **2. mint-shielded-account** — Both call prototypes in ONE ledger Intent — the only cell midnight-js cannot express at SDK level.
- **4. mint-unshielded-account** — No zswap output at all: the mint claims an unshielded spend to the Manager and the Manager claims the input — both are transcript effects, so they offset only inside one intent.
- **6. internal-shielded** — pool 10@f6485e5cb5d77030ede1e81cf276051773c15faabecdaf5410d637ca017721d7 unchanged — FR-005 forward case
- **7. send-shielded-user-account** — A SINGLE wallet-balanced call: the Manager declares the receive and the depositor’s wallet supplies the input, so sender spend and Manager receive are in one transaction by construction (FR-003).
- **8. send-shielded-account-user** — The wallet detected and can spend the CONTRACT-CREATED output — proven when OwnerM re-spends it in step 7.
- **13. provenance-user-resends-shielded** — This is the direct proof that the pinned wallet SDK detects and can spend contract-created zswap outputs — the spec’s Edge Case risk does not apply.
- **19. selfsend-pool-shielded** — The only cell that reaches the standard library’s auto-receive branch: sendShielded to kernel.self() re-claims its own output.
- **20. selfsend-pool-unshielded** — sendUnshielded to kernel.self() takes the auto-receive branch (incUnshieldedInputs), so the contract balance nets to zero.
- **21. split-shielded-user-change** — coins before ["10"] → after ["5"]
- **22. split-shielded-contract-change** — sendShielded returned a non-empty change arm; the Manager wrote the change coin back to itself.
- **23. split-unshielded-user-utxo** — The consumed 10-UTXO and the two 5 outputs are both recorded.
- **25. merge-pool-deposit** — The pool stays a SINGLE coin: mergeCoinImmediate consumes both and writes one merged coin with a new nonce.
- **26. invariant-pool-equals-accounts** — Shielded: pooled zswap coin value vs the account map. Unshielded: the contract’s ledger balance from the indexer vs the account map.

Per-cell evidence: `evidence/g3-ledger/step-N/step.json` (full before/after observation for
every operation, including coin- and UTXO-level detail) and `step-N/summary.md`.

## Negative controls

Each proves BOTH the rejection AND that state and funds are byte-identical before and after.
Where a control is refused is recorded rather than blurred: a claim-mechanics failure survives
local construction and is refused when the transaction is assembled or submitted, while an owner
or balance guard is a circuit `assert` and refuses during circuit execution, so no transaction is
ever built.

| Control | Expectation | Refused at | State + funds unchanged | Status |
|---|---|---|---|---|
| Wrong-owner witness: OwnerB's key cannot spend AA_A's balance | rejected with 'account shielded balance too low' — AA_B owns 0 while the pool holds 10 | circuit execution (no transaction built) | yes | **GREEN** |
| A witness that opens no registered account is refused | rejected with 'caller\'s owner witness matches no registered account' | circuit execution (no transaction built) | yes | **GREEN** |
| Per-account overdraw while the pool holds MORE than the requested amount | rejected with 'account shielded balance too low' — AA_A owns 10, requested 15, pool holds 20 | circuit execution (no transaction built) | yes | **GREEN** |
| Mint shielded into the Manager with the receive call omitted | rejected as imbalanced; no account credited and the pool untouched | transaction assembly / submission | yes | **GREEN** |
| Mint unshielded into the Manager with the receive call omitted | rejected as imbalanced; no account credited and the ledger balance untouched | transaction assembly / submission | yes | **GREEN** |

Reasons recorded verbatim in `evidence/g3-ledger/negative-controls.json`.

## Atomicity probes

Method: deferred failure: a full-balance withdrawal is prepared against a state where the account holds the funds, the account is then emptied by an internal transfer submitted from a different wallet, and the stale withdrawal is submitted. Its recorded balance read no longer matches the chain, so the assertion fails on replay.

| Family | Prepared operation | Displacing tx | Submission outcome | Nothing survived | Status |
|---|---|---|---|---|---|
| shielded | withdrawShielded(10) authorized by OwnerA, prepared while AA_A held 10 | `0015036f28b754f02450607b8d8840bad87f1be5890000fcfd3f1e2bb63d2bda82` | refused at submission: Transaction submission error | yes | **GREEN** |
| unshielded | withdrawUnshielded(10) authorized by OwnerA, prepared while AA_A held 10 | `0005bfec8d6a9c1e6f2c77305f56866c2e113d72a5138d1cebc2c879aee7dfaf86` | refused at submission: Transaction submission error | yes | **GREEN** |

Full before/after observations in `evidence/g3-ledger/atomicity.json`.
