# Combination-matrix cell index — 00003-contract-token-custody

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.
No result here may be extrapolated to a supported or production lane.

Generated 2026-08-18T13:00:12.994Z from the retained run.

| What | Value |
|---|---|
| Minter | `b0a96ac61f4bc71de1627657dc934b11aefab199a50dc73a115b0fcc041a28ad` |
| Manager | `1d838367033c26ea83bcfde405851aeec45057390dd364ca6632299d6c39e183` |
| Shielded colour | `7178f8449769f38ece84415349504bdf39b9deab8b158f23d5cf96d60cd3a478` |
| Unshielded colour | `de7966d6923a3c3a5cb07c90991ea2d530c74584b57b87f168f9722774d07426` |
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
| 1 | Mint shielded → user (step 1) | 1 | SDK | `000802036ff2a325f1a367f27d295edc0547cde468df3d94a3f92c3d36673aa22a` | OwnerN wallet SDK (0→10) + ledger conservation (minted == pool + users' holdings) | **GREEN** |
| 2 | Mint shielded → manager account (step 1) | 1 | LEDGER | `0067f1f51f53250735484f4c64f4b932eeca3769e4d33e66c7b078ea900ffed7f2` | Manager account map (AA_A 0→10) + pooled zswap coin (0→10, nonce == the mint nonce) | **GREEN** |
| 3 | Mint unshielded → user (step 2) | 2 | SDK | `00386c9b07abfc21ddf610caab1029a5e03a9264b8479ef399cc18c615c3d938e2` | OwnerN wallet SDK (0→10) + indexer `unshieldedUtxos` for OwnerN (0→10) | **GREEN** |
| 4 | Mint unshielded → manager account (step 2) | 2 | LEDGER | `0051b5ea962ab7d7d393066d9153c1ca385530b5a2986e6ad2ea52c9477fc4ee02` | Manager account map (AA_A 0→10) + the contract's unshielded ledger balance from the indexer (0→10) | **GREEN** |
| 5 | Send shielded user→user (step 3) | 3 | wallet | `00251e6da2e81dc7fa0496c812e3828d0968e916e0c70d2926356d589c6e19fca2` | OwnerN + OwnerM wallet SDK states + ledger conservation identity | **GREEN** |
| 6 | Shielded account→account internal ownership transfer, no ledger movement (step 3) | 3 | SDK | `0027122ab1bc8c1e61c46bccdc66159efeae59476b0f63285bda350e77de2a1146` | Manager account map (AA_A 10→5, AA_B 0→5) + pooled coin value AND nonce byte-identical before/after | **GREEN** |
| 7 | Send shielded user→account (step 4) | 4 | SDK | `00840033b61dae10cea6dbd9af3637bb69b3463ddee2069231367f10e9acac00be` | Manager account map (AA_B 5→10) + pooled coin (10→15); OwnerN wallet 5→0 | **GREEN** |
| 8 | Send shielded account→user (step 4) | 4 | SDK | `00dbe07636c98b82e7a8910de56f24e12b3ee7f711bb1772e485991a5aa9834351` | Manager account map (AA_A 5→0) + pooled coin (15→10); OwnerM wallet 5→10 | **GREEN** |
| 9 | Send unshielded user→user (step 5) | 5 | wallet | `006014fa982cadce175b0fe63b569f1982d04aa2a667b3d2eae137a3bc9f9f3706` | OwnerN + OwnerM wallet SDK states + the indexer’s `unshieldedUtxos` for both addresses | **GREEN** |
| 10 | Unshielded account→account internal ownership transfer, no ledger movement (step 5) | 5 | SDK | `00d790d6eda6036dda9858164d60ba43db9c470eee636e9b70978f649b41734985` | Manager account map (AA_A 10→5, AA_B 0→5) + the contract's unshielded ledger balance unchanged at 10 | **GREEN** |
| 11 | Send unshielded user→account (step 6) | 6 | SDK | `00d355860b50d061506ded0910f1c25642f43a94b5a54056e7641d699433234e88` | Manager account map (AA_B 5→10) + contract unshielded ledger balance (10→15); OwnerN wallet and indexer both 5→0 | **GREEN** |
| 12 | Send unshielded account→user (step 6) | 6 | SDK | `0036eca8f6375d9004cf6ee219002530e91f61fd2c6db1eadc5a84377528d31aaf` | Manager account map (AA_A 5→0) + contract unshielded ledger balance (15→10); OwnerM wallet and indexer 5→10 | **GREEN** |
| 13 | Provenance: user re-sends AA-originated shielded coins (step 7) | 7 | SDK | `009e72100fcfeb95fb3dba5c79a80ba1bdfc9fa3f59ee6188ac2a6886dbdd3201b` | OwnerM's wallet spent coins CREATED BY THE MANAGER in step 4 (10→5) + Manager account map AA_A 0→5 | **GREEN** |
| 14 | Provenance: AA account re-sends user-originated shielded value (step 7) | 7 | SDK | `000d138dc876a51acb3cd8ebd69572f171da6e4698ee7adcc0a0ea755332763d13` | AA_B's holdings include OwnerN's step-4 deposit; account map 10→5 + pooled coin pays out and retains change | **GREEN** |
| 15 | Provenance: user re-sends AA-originated unshielded tokens (step 8) | 8 | SDK | `008a159ecf14df721a79ba52c12a2c555ec1896a99fb8287dab8e76e45c3f3593e` | OwnerM spends UTXOs paid out by the Manager in step 6 (wallet + indexer both 10→5) + account map AA_A 0→5 | **GREEN** |
| 16 | Provenance: AA account re-sends user-originated unshielded tokens (step 8) | 8 | SDK | `001c9cdf26b00b74d437fc59f8012f35e8f46b2f5afbb2ee81dce911d93c8bfb2f` | AA_B re-spends OwnerN's step-6 deposit; account map 10→5 + contract ledger balance falls by 5 | **GREEN** |
| 17 | Self-send: user shielded to own key (step 9) | 9 | wallet | `00a692f516cc5798c3a75478bf6b10320c85446f1033be52979b6e7d4ed112a249` | OwnerM balance unchanged at 5; coins ["5"] → ["2","3"] with new commitments | **GREEN** |
| 18 | Self-send: user unshielded UTXO self-split (step 9) | 9 | wallet | `006605e5205a05660adcf595a0e986fe4ac4de8357ad2f2248f4231ae0c3586cd7` | OwnerM balance unchanged at 5 (wallet AND indexer); UTXOs ["5"] → ["2","3"] | **GREEN** |
| 19 | Self-send: pool shielded to `kernel.self()` via auto-receive (step 9) | 9 | SDK | `005feb4dd26b63667f8c0868c7767eba78c3d7dd920c8a0eaa406539244074386f` | pool value unchanged at 10; nonce c4c651a534477e79461a9f4e2974c67ae245f58cb75b078d4b7f0088a236a800 → bb9e3d5ce419284e14935d9eb41bfaa6200e69ca84e95d1e3550eb0e52654200; account map byte-identical | **GREEN** |
| 20 | Self-send: pool unshielded to self via auto-receive (step 9) | 9 | SDK | `005e09c4f3eba61cd6f138dacad62e07cebf5217bc97b2998a5b655b2cc5fa8657` | contract ledger balance and account map BOTH byte-identical at 10 | **GREEN** |
| 21 | Split: shielded user wallet change (step 3, OwnerN) | 3 | wallet | `00251e6da2e81dc7fa0496c812e3828d0968e916e0c70d2926356d589c6e19fca2` | OwnerN's enumerated coins before/after: the 10-coin is consumed and a 5 change coin created | **GREEN** |
| 22 | Split: shielded contract change coin retained in pool (step 4) | 4 | SDK | `00dbe07636c98b82e7a8910de56f24e12b3ee7f711bb1772e485991a5aa9834351` | pooled coin 15@1c1ab8ed221db1bc6ac35558d1a408a4d87c4ba5cb95a236f5467436fc751500 → 10@e18edd0a3e453388eaf033544e345202a4dd43f223bc515ebf9ded9f34723700 | **GREEN** |
| 23 | Split: unshielded user UTXO split into sent + change (step 5, OwnerN) | 5 | wallet | `006014fa982cadce175b0fe63b569f1982d04aa2a667b3d2eae137a3bc9f9f3706` | OwnerN UTXOs ["10"] → ["5"]; OwnerM gained ["5"] | **GREEN** |
| 24 | Split: unshielded partial pooled-balance spend (step 6) | 6 | SDK | `0036eca8f6375d9004cf6ee219002530e91f61fd2c6db1eadc5a84377528d31aaf` | the contract held 15 and paid out 5, retaining 10 | **GREEN** |
| 25 | Merge: pool combines deposited coin with held coin (step 4) | 4 | SDK | `00840033b61dae10cea6dbd9af3637bb69b3463ddee2069231367f10e9acac00be` | pooled coin 10@70766988b69b5e89761e110d2f39b0c938d4b4896a0fa19117a537bb7522705c → 15@1c1ab8ed221db1bc6ac35558d1a408a4d87c4ba5cb95a236f5467436fc751500 — one coin, value 10+5 | **GREEN** |
| 26 | Invariant: `pooled holdings = AA_A + AA_B` per family, asserted after **every** step | 9 | derived | — | asserted in `assertAll` after all ten steps, in both families, against two independently maintained mechanisms | **GREEN** |

### Notes

- **2. mint-shielded-account** — Both call prototypes in ONE ledger Intent — the only cell midnight-js cannot express at SDK level.
- **4. mint-unshielded-account** — No zswap output at all: the mint claims an unshielded spend to the Manager and the Manager claims the input — both are transcript effects, so they offset only inside one intent.
- **6. internal-shielded** — pool 10@70766988b69b5e89761e110d2f39b0c938d4b4896a0fa19117a537bb7522705c unchanged — FR-005 forward case
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
| shielded | withdrawShielded(10) authorized by OwnerA, prepared while AA_A held 10 | `00e03ad92d7da1f35eff9e7f77c7ef95a167523eb874b64382daa192e0f15c8da9` | refused at submission: Transaction submission error | yes | **GREEN** |
| unshielded | withdrawUnshielded(10) authorized by OwnerA, prepared while AA_A held 10 | `0044f5da22bab3adbcf3a3cb1f47c17384253f9b2a65d09d502154c0cfa5c0cd16` | refused at submission: Transaction submission error | yes | **GREEN** |

Full before/after observations in `evidence/g3-ledger/atomicity.json`.
