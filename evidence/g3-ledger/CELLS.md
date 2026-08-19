# Step-ledger cell index — 00005-open-colour-custody, gate G3

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot.
No result here may be extrapolated to a supported or production lane.

Generated 2026-08-19T05:20:56.442Z from the retained run.

| What | Value |
|---|---|
| Manager | `b1f34f0469b0c29e0a61e931be21a1d335d33953367bf3fc9c633b0d8372076d` |
| Manager deploy block | 45 (chain tip before ANY deploy: 42) |
| Minter1 (tag `TOKA`) | `0bb842c5b867d73242056d975699037a145c2515cc56e4883441c531691995f2` — block 57 |
| Minter2 (tag `TOKB`) | `6b2a58fee518a9d8b37b3efe7f2f7b19d9189d8a2f48fb9f17356da2fdc665aa` — block 67 |
| Minter3 (tag `TOKC`) | `398524288ec4b0e3907170d9f6bfb22445e98b467546485a29b44f8b811a98b5` — block 76 |
| Minter4 (tag `TOKD`) | `24319339d7d1886f9d780f873f1c22e1c9127de9115e6a24fa2f8c4b89df72b0` — block 172 |
| Minter5 (tag `TOKE`) | `4dd07d275346219ceda9e918ee70b7c226fe759e9d7450e95aba6fa6983e9fa4` — block 213 |
| MinterCollide (tag `TOKX`) | `91d2f65440db34c57dd5f7b3538d759fa798519d94932fe3b9b699cb596c7b67` — block 222 |
| S1 (shielded, Minter1) | `af0cf3315634a046dab2734b721b8d3f923e346d878a3d414edcd2164cec8a31` |
| U1 (unshielded, Minter1) | `df6c4aa1b76bd3b559685a2dbabd38ab5ca5250b40a9e591783ff52ef34a71b6` |
| S2 (shielded, Minter2) | `22d2a436b6554a4eb773a6b9222f09b2901af4e34473bb40e7f0499ca75c690d` |
| U2 (unshielded, Minter2) | `945184e96f853231a70e09a5210a252cdff6ede55f5a871c87ac0417efa24e37` |
| S3 (shielded, Minter3) | `560e94176de2b692c51c516a7daff0ae8c13c9e244834e4296093aaa91361a90` |
| U3 (unshielded, Minter3) | `027dcccf6a6def7577ebe335efe2a1aa1eaa0ab7a5d5d869ed3ef1cfab279ff8` |
| S4 (shielded, Minter4) | `1830d810691419a4a0aacae99deb76d5bc59c881178d559a9be0fb674b9c5337` |
| U4 (unshielded, Minter4) | `21472fe902aa4a4fb7b528b9d96464d7b3091b2baeed8d07ee55841af4a43d6a` |
| S5 (shielded, Minter5) | `5646230bed383e0dffae1c1442f2152118cffa8761a3f0b347cdf017c9a7300e` |
| U5 (unshielded, Minter5) | `cd56842f5052d16b8b220698637f5d54d7bd7d72539a85034fc5eb98641b3a50` |
| XS (shielded, MinterCollide) | `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd` |
| XU (unshielded, MinterCollide) | `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd` |
| AA_A account id | `009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b` |
| AA_B account id | `755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904` |
| Total minted | S1 10, U1 10, S2 10, S3 10, U2 10, S4 7, U4 4, S5 3, U5 3, XS 3, XU 2 |
| End-state map sizes (walk) | `{"pools":4,"shieldedCells":5,"unshieldedCells":3}` — spec says `{"pools":4,"shieldedCells":5,"unshieldedCells":3}` |
| M3 transaction(s) | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` |
| M3 composition shape (decision D-203) | sdk-scoped batch (one transaction, one segment per call, state threaded) |

**30 of 30 items GREEN**, 0 RED, no gaps.

## Deploy order — the Manager exists before anything that can mint

| Contract | Deploy block | Strictly after the Manager | Existed at the Manager's block |
|---|---|---|---|
| **Manager** | 45 | — (control) | yes (control) |
| Minter1 (`TOKA`) | 57 | yes | **no — did not exist** |
| Minter2 (`TOKB`) | 67 | yes | **no — did not exist** |
| Minter3 (`TOKC`) | 76 | yes | **no — did not exist** |
| Minter4 (`TOKD`) | 172 | yes | **no — did not exist** |
| Minter5 (`TOKE`) | 213 | yes | **no — did not exist** |
| MinterCollide (`TOKX`) | 222 | yes | **no — did not exist** |

The right-hand column is the strong form: the indexer's answer to *"what contract action does this
address have at block 45?"* — `null` for every issuing contract, and the
deploy action for the Manager itself, which is the discriminating control. TOKD is the sharpest case:
it did not exist while the Manager processed the first fourteen rows of this ledger.

## Final observed table (end of the 18-row walk)

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 0 | 5 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 0 |
| AA_A | 3 | 0 | 4 | 7 | 3 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 4 |
| pool / ledger | 6 | 4 | 4 | 7 | 3 | 5 | 0 | 4 |

Exact map sizes: `{"pools":4,"shieldedCells":5,"unshieldedCells":3}`. Every minted colour sums to its mint total; each pool / ledger balance equals the sum of its AA column cells. U3 is dormant: minted by no one, deposited by no one, absent from every map.

## Observation points (FR-208)

| Cell class | Point 1 | Point 2 | Point 3 |
|---|---|---|---|
| AA_A / AA_B, per colour | the Manager's `shieldedBalances` / `unshieldedBalances` maps decoded from contract state, every key reproduced by the contract's own pure `shieldedKey` / `unshieldedKey` circuits | the custody side of the same colour — pooled zswap coin (shielded) or the ledger kernel's unshielded balance — via the per-colour invariant | a real on-chain `shieldedAccountBalance` / `unshieldedAccountBalance` circuit call, rotating across the (account, colour) cells |
| OwnerN / OwnerM, unshielded | a read-only OBSERVER wallet facade that never submitted a transaction (finding F-104) | the UTXO set reconstructed from the indexer's own transaction history, per colour | — |
| OwnerN / OwnerM, shielded | the same observer wallet, coin by coin | the ledger conservation identity `minted[c] == custody[c] + OwnerN[c] + OwnerM[c]` | — |

**Finding F-104 is why the observer wallets exist.** On this pinned lane a wallet that SUBMITTED a
transaction under-reports its own balance afterwards and does not self-correct, while still returning
`progress.isStrictlyComplete() === true`. No submitting wallet is an observation point anywhere in this
gate, and every user-submitted transaction is built by a fresh spender wallet that is closed
immediately afterwards.

## Step rows, controls and probes

| # | Item | Step | Level | Transaction id(s) | Observation points | Status |
|---|---|---|---|---|---|---|
| 1 | Step 0 — **Manager deployed, no Minter exists on this chain**; AA_A, AA_B registered; all maps size 0 | 0 | SDK | `00a6e21ecae834c8bfbacb11bd76bcb3f9b2a206924979baa010c7ad5a1127c86a` | decoded Manager ledger state (accounts 2, pools 0, shielded cells 0, unshielded cells 0) + an on-chain balance call for a colour that does not exist, which answered 0 and created nothing | **GREEN** |
| 2 | Step 1 — Minters TOKA, TOKB, TOKC deployed; 6 colours read on-chain, pairwise distinct; Manager byte-identical to step 0 | 1 | SDK | `6f32d9ecfa86442e1b734f93fefae5e023a8d3bc507e3b9bfb19dc125d3ab380`<br>`8a37dc4e0b45e169c90066d078276b6171145d02fad1f1a0f2b48508aa6efaa0`<br>`eaf15a6c2510f12f13ce88b2ec156b1db034986d77eb7c1277c8e6940a25dd3a` | indexer block ordering (Manager 45 < 57/67/76) plus a point-in-time existence query answering null for every Minter address at block 45, with the Manager itself as the discriminating control; 15/15 colours distinct from on-chain reads | **GREEN** |
| 3 | Step 2 — mint S1 `10` → OwnerN | 2 | SDK | `0036fc1244c795898ae5fcd9f659262fa83c50e693177d04df8d90d16e8a044072` | OwnerN observer wallet + ledger conservation for S1; every other cell unchanged; all three custody maps still size 0 | **GREEN** |
| 4 | Step 3 — mint U1 `10` → OwnerN | 3 | SDK | `00508dc138dc8f23418e3da1f30cf9e2c3a6d917150506b1205c0f59df5719bdc0` | OwnerN observer wallet + indexer UTXO reconstruction for U1; every other cell unchanged; all three custody maps still size 0 | **GREEN** |
| 5 | Step 4 — mint S2 `10` → OwnerM | 4 | SDK | `004f1b2a8e3875c680d4de24326c36e5969eb670bfe3178925c62d148a40971cc0` | OwnerM observer wallet + ledger conservation for S2; every other cell unchanged; all three custody maps still size 0 | **GREEN** |
| 6 | Step 5 — mint S3 `10` → OwnerM | 5 | SDK | `009c86c467fe275f88b91d79c82e0c973a3f99976380487eda8b36ee182ea58c27` | OwnerM observer wallet + ledger conservation for S3; every other cell unchanged; all three custody maps still size 0 | **GREEN** |
| 7 | Step 6 — mint U2 `10` → OwnerM | 6 | SDK | `006586549a9e7e4453fc6681b90b9441c00851ffc285c6870280a3d409e2f87fdf` | OwnerM observer wallet + indexer UTXO reconstruction for U2; every other cell unchanged; all three custody maps still size 0 | **GREEN** |
| 8 | Step 7 — OwnerN deposits S1 `6` → AA_A (first pool EVER) | 7 | SDK | `00884ad837335921eb97601b32ce5bdb4b01a17e3b2cadd96ae6927ef85da65e4e` | map sizes {"pools":0,"shieldedCells":0,"unshieldedCells":0} -> {"pools":1,"shieldedCells":1,"unshieldedCells":0} (lazy creation, exactly as specced); AA_A S1 0->6 with that colour's pooled coin matching | **GREEN** |
| 9 | Step 8 — OwnerN deposits U1 `5` → AA_A | 8 | SDK | `0040400c7e3bae1de2b3b8c790538046dad5f8b8a71af631a98df74a0bdec7bdc4` | map sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} -> {"pools":1,"shieldedCells":1,"unshieldedCells":1} (lazy creation, exactly as specced); AA_A U1 0->5 with the ledger kernel's unshielded balance matching | **GREEN** |
| 10 | Step 9 — OwnerM deposits S2 `6` → AA_B | 9 | SDK | `0066922c578116c333e14e5b88d6b4461a1b9f49a1e18cc318ca99f0af3a4a07c6` | map sizes {"pools":1,"shieldedCells":1,"unshieldedCells":1} -> {"pools":2,"shieldedCells":2,"unshieldedCells":1} (lazy creation, exactly as specced); AA_B S2 0->6 with that colour's pooled coin matching | **GREEN** |
| 11 | Step 10 — OwnerM deposits S3 `4` → **AA_A** (depositor ≠ credited owner) | 10 | SDK | `0006b2b4c7d8d5ef248e517c59152922e3183dd84afa6d883edb78a576b0a87de4` | map sizes {"pools":2,"shieldedCells":2,"unshieldedCells":1} -> {"pools":3,"shieldedCells":3,"unshieldedCells":1} (lazy creation, exactly as specced); AA_A S3 0->4 with that colour's pooled coin matching | **GREEN** |
| 12 | Step 11 — OwnerM deposits U2 `5` → AA_B | 11 | SDK | `003ea0637e2197236bf16fbc182a45810a9f6d8f57ca12e73fb4a3c5b3db3fbe5a` | map sizes {"pools":3,"shieldedCells":3,"unshieldedCells":1} -> {"pools":3,"shieldedCells":3,"unshieldedCells":2} (lazy creation, exactly as specced); AA_B U2 0->5 with the ledger kernel's unshielded balance matching | **GREEN** |
| 13 | Step 12 — internal transfer S1 `3`: AA_A → AA_B (credit-side lazy cell; pool UNCHANGED) | 12 | SDK | `00f9be9a8b26c7da1a49e0f475e7de1f34c0552d2e3e116ebba984f2ead3b728a9` | shielded cells 3->4: the (AA_B,S1) cell was created by an INTERNAL TRANSFER, not a deposit; EVERY pooled coin (value AND nonce) and every custody figure byte-identical before/after | **GREEN** |
| 14 | Step 13 — AA_B withdraws S2 `2` → OwnerN | 13 | SDK | `00d65f7a9c3000bd786a74c907032f70084a6fe263e7b3e4fbd48d8b7e220a101d` | Manager cells (AA_B S2 6->4) + poolS2 6->4 (change coin retained); OwnerN observer wallet 0->2 — a user now holds a colour it never minted; every other pool byte-identical; map sizes unchanged | **GREEN** |
| 15 | Step 14 — AA_A withdraws U1 `2` → OwnerM | 14 | SDK | `007f4b71e7eb49371ef6982b7202ef5970f1fc81dc58a949d63fb11cc92507dcd2` | Manager cells (AA_A U1 5->3) + the ledger kernel's U1 balance 5->3; OwnerM observer wallet AND the indexer reconstruction both 0->2; map sizes unchanged (a spend creates nothing) | **GREEN** |
| 16 | Step 15 — **TOKD deployed mid-ledger**; mint S4 `7` → OwnerN, U4 `4` → OwnerM | 15 | SDK | `008235b1d8e48c66cef6e4b07ca5040b1d833e9be21e8d081eb0fe4e0c016c5eec`<br>`00b3dd19b95b1178bef9edb6c853df8e829fbc33dd951535335e8025432499a318`<br>`00e3b6e3883081bb9c4ad8d9f0cbc5ce7da0b56091226eef0031ed6ecdb00c0c20` | TOKD deployed in block 172, 127 blocks after the Manager, and absent from the indexer at the Manager's deploy block; the Manager's whole decoded state is byte-identical across this row | **GREEN** |
| 17 | Step 16 — **HEADLINE**: OwnerN deposits S4 `7` → AA_A; pools 3→4 | 16 | SDK | `000b61ae6a4a78f81cbbb13e03fa8833c2ad9439cfcde7fe8f4ae8ea910eb48cbd` | pools 3->4 and shielded cells 4->5: poolS4 = 7 with (AA_A,S4) = 7, for a colour whose issuing contract was deployed in block 172 against the Manager's 45 | **GREEN** |
| 18 | Step 17 — OwnerM deposits U4 `4` → AA_B | 17 | SDK | `000ebd3bf2d2aa10df4b313b956d88e3f3619601073691179a83aa9f1563f58880` | unshielded cells 2->3; the contract's ledger balance for U4 = 4 with (AA_B,U4) = 4 — the unshielded half of the mid-ledger colour claim | **GREEN** |
| 19 | NC-1 — unregistered witness | NC-1 | SDK | — | circuit execution (no transaction built); full table + every pool + every ledger balance byte-identical before/after; map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} -> {"pools":4,"shieldedCells":5,"unshieldedCells":3}; no cell was created for the unregistered witness: accounts still 2, map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} | **GREEN** |
| 20 | NC-2 — missing-cell spend (pool covers it; no (AA_B,S3) cell is created) | NC-2 | SDK | — | circuit execution (no transaction built); full table + every pool + every ledger balance byte-identical before/after; map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} -> {"pools":4,"shieldedCells":5,"unshieldedCells":3}; (AA_B,S3) cell absent before: yes; (AA_B,S3) cell absent after: yes | **GREEN** |
| 21 | NC-3 — dormant colour U3 (absent from EVERY map afterwards) | NC-3 | SDK | — | circuit execution (no transaction built); full table + every pool + every ledger balance byte-identical before/after; map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} -> {"pools":4,"shieldedCells":5,"unshieldedCells":3}; U3 absent from every map before: yes; U3 absent from every map after: yes | **GREEN** |
| 22 | NC-4 — unregistered credit | NC-4 | SDK | — | circuit execution (no transaction built); full table + every pool + every ledger balance byte-identical before/after; map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} -> {"pools":4,"shieldedCells":5,"unshieldedCells":3}; account set unchanged: yes; no cell for the bogus account, no pool for the colour: yes ({"pools":4,"shieldedCells":5,"unshieldedCells":3}) | **GREEN** |
| 23 | NC-5 — internal transfer of an unheld colour | NC-5 | SDK | — | circuit execution (no transaction built); full table + every pool + every ledger balance byte-identical before/after; map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} -> {"pools":4,"shieldedCells":5,"unshieldedCells":3}; (AA_A,S2) cell absent before: yes; (AA_A,S2) cell absent after: yes; poolS2 unchanged: yes (4) | **GREEN** |
| 24 | P-COLL — byte-identical colour tracked independently per family (pool 3 vs ledger 2) | probe | SDK | `00b66bd35c1bbd81a5f1040656b62759e1614aee225cc7c67c83a5df05be50e5f1`<br>`00713f1fcd3747fa437a1786029b23d39c75b0a3ae3503491e562badc81f9b2269`<br>`00c10656f1923b64cdce84e714cf7c72249079904421baf094bc615b8e2cf2e955`<br>`0080fc7064f4887536eedc935e88602478b87f0e07efd5ea09775e04c99d5fe33d`<br>`00504ec1f7fd5ae0d31342efff6bd4473d44e5fd1d6ba3e3091180d4ada70f728f`<br>`0047ba5b249baf3a3a21601d77c3fdbf89d713d6236e82a64c0a1fa61f3c2bb82a` | same 32 bytes (9d27bcf49db7cd1b…): pool = 3 while the contract's unshielded ledger balance = 2, under two DIFFERENT key domains; one unit withdrawn from each side left the other side byte-identical; and two ON-CHAIN circuit calls taking the IDENTICAL colour argument answered 2 (shielded) vs 1 (unshielded) | **GREEN** |
| 25 | M3 — first deposits of TWO brand-new colours create one pool and two cells | probe | SDK | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` | map sizes {"pools":5,"shieldedCells":6,"unshieldedCells":4} -> {"pools":6,"shieldedCells":7,"unshieldedCells":5}; poolS5 = 3, (AA_B,S5) = 3, (AA_B,U5) = 3, the contract's unshielded ledger balance for U5 = 3; confirmed a second way by on-chain circuit calls (3 / 3) | **GREEN** |
| 26 | M3 — both first deposits under ONE transaction id (FR-207 / D-203) | probe | SDK | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` | ONE transaction id 00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a carries depositShielded(S5) + depositUnshielded(U5); shape: sdk-scoped batch (one transaction, one segment per call, state threaded) | **GREEN** |
| 27 | Distinctness — 45/45 pairwise over TOKA–TOKE, plus the INVERTED MinterCollide equality | probe | SDK | — | 45/45 pairwise comparisons distinct over the ten TOKA–TOKE colours, every one read from an on-chain circuit call; MinterCollide's two family colours byte-EQUAL (9d27bcf49db7cd1b…) and colliding with none of the ten | **GREEN** |
| 28 | Invariant — `custody[c] == AA_A[c] + AA_B[c]` after EVERY step, over the DISCOVERED colour set | 0-17 + probes | derived | — | asserted in `assertAll` after every row and every probe step, per colour, between two independently maintained mechanisms (the Manager's balance maps vs the pooled zswap coin / ledger-kernel unshielded balance) | **GREEN** |
| 29 | Exact map sizes after EVERY step, zero unaccounted keys (dynamic) | 0-17 + probes | derived | — | every row asserts {pools, shieldedCells, unshieldedCells} exactly against the spec's transcription (0/0/0 at rows 0-6 … {"pools":4,"shieldedCells":5,"unshieldedCells":3} at row 17), and every key in the raw ledger maps is reproduced from (AA account x registered colour) by the contract's own pure key circuits | **GREEN** |
| 30 | FR-206 — U3 never minted, never deposited, absent from every map at every row | 0-17 | derived | — | asserted after every row: U3 reads 0 for all four parties and for custody, and has no pool, no cell in either family map, and no entry in the ledger kernel's balance map | **GREEN** |

### Notes

- **1. step-0** — Manager deployed in block 45; chain tip before any deploy was block 42.
- **2. step-1** — The whole decoded Manager state is byte-identical to step 0 — deploying an issuer touches nothing.
- **8. step-7** — the FIRST pool this Manager has ever held
- **9. step-8** — the first unshielded cell
- **10. step-9** — a second pool, created lazily
- **11. step-10** — DEPOSITOR != CREDITED OWNER — credit is open, spend is not (FR-204)
- **12. step-11** — a second unshielded cell
- **13. step-12** — The spec's "credit-side lazy cell / poolS1 UNCHANGED" row, asserted over the whole custody surface rather than one colour. The circuit is `transferInternalShielded` — owner decision D-204.
- **16. step-15** — The colour set grows from 6 to 8 here — dynamically, with no configuration step of any kind.
- **19. NC-1** — failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'withdrawShielded'
- **20. NC-2** — failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'
- **21. NC-3** — failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawUnshielded'
- **22. NC-4** — failed assert: credit account is not registered \| cause: Error executing circuit 'depositShielded'
- **23. NC-5** — failed assert: account colour balance too low \| cause: Error executing circuit 'transferInternalShielded'
- **24. P-COLL** — G2 proved the fixture COMPILES, DEPLOYS and reads back byte-identical. This is its TOKEN half: the colour is actually minted, deposited, custodied and spent in both families.
- **25. M3-lazy-init** — This half is INDEPENDENT of the composition half below, per FR-207.
- **26. M3-composition** — D-203 RESOLVED: sdk-scoped batch (one transaction, one segment per call, state threaded). The one-ledger-Intent shape was not re-attempted — 00004's probe M1 already recorded its refusal verbatim on this lane (the 223 same-address rule), and D-203 names the scoped batch as the proven legal composition.
- **27. distinctness** — The equality is the inverted assertion: MinterCollide derives ONE separator and feeds it to both mint families, so its two colours are the same 32 bytes by construction. Every other colour comparison in this project asserts INEQUALITY.

Per-step evidence: `evidence/g3-ledger/step-N/step.json` (expected vs observed, every observation
point, exact map sizes, the unaccounted-key report, the per-colour invariant, the conservation
identity, the spot check and every operation) and `step-N/summary.md`.

## Negative controls — verbatim

Each proves FOUR things: the rejection happened; it was the CONTRACT'S OWN assert; the full table,
every pool (value AND nonce), every unshielded ledger balance and both users' coins/UTXOs are
byte-identical before and after, re-read after a settle delay; and **no state was created** — all
three map sizes identical, with the specific cell the control is about proven absent afterwards.

| Id | Status | Refused at | Verbatim error | Expected message | Funds byte-identical | Map sizes |
|---|---|---|---|---|---|---|
| `NC-1` | **GREEN** | circuit execution (no transaction built) | `failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'withdrawShielded'` | `/matches no registered account/` matched | yes | {"pools":4,"shieldedCells":5,"unshieldedCells":3} → {"pools":4,"shieldedCells":5,"unshieldedCells":3} (unchanged) |
| `NC-2` | **GREEN** | circuit execution (no transaction built) | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'` | `/account colour balance too low/` matched | yes | {"pools":4,"shieldedCells":5,"unshieldedCells":3} → {"pools":4,"shieldedCells":5,"unshieldedCells":3} (unchanged) |
| `NC-3` | **GREEN** | circuit execution (no transaction built) | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawUnshielded'` | `/account colour balance too low/` matched | yes | {"pools":4,"shieldedCells":5,"unshieldedCells":3} → {"pools":4,"shieldedCells":5,"unshieldedCells":3} (unchanged) |
| `NC-4` | **GREEN** | circuit execution (no transaction built) | `failed assert: credit account is not registered \| cause: Error executing circuit 'depositShielded'` | `/credit account is not registered/` matched | yes | {"pools":4,"shieldedCells":5,"unshieldedCells":3} → {"pools":4,"shieldedCells":5,"unshieldedCells":3} (unchanged) |
| `NC-5` | **GREEN** | circuit execution (no transaction built) | `failed assert: account colour balance too low \| cause: Error executing circuit 'transferInternalShielded'` | `/account colour balance too low/` matched | yes | {"pools":4,"shieldedCells":5,"unshieldedCells":3} → {"pools":4,"shieldedCells":5,"unshieldedCells":3} (unchanged) |

- **NC-1** — Unregistered witness: OwnerN's witness opens no Manager account. Expectation: refused at the WITNESS CHOKE POINT, before any per-account, pool or ledger guard is reached
  - fixture read from chain: `poolS1` = `6`, `AA_A.S1` = `3`, `AA_B.S1` = `3`, `note` = `OwnerN is a pure user: its secret opens no account, though S1 is amply pooled`
  - no state created: no cell was created for the unregistered witness — **accounts still 2, map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3}**
- **NC-2** — Missing-cell spend: OwnerB withdraws S3, which AA_B has never held, from a pool that covers it. Expectation: refused by the PER-(account, colour) GUARD reading an ABSENT cell as 0, before the pool guard; and NO (AA_B, S3) cell is created by the attempt
  - fixture read from chain: `AA_B.S3` = `0`, `AA_A.S3` = `4`, `poolS3` = `4`, `(AA_B,S3) cell exists before` = `false`
  - no state created: (AA_B,S3) cell absent before — **yes**; (AA_B,S3) cell absent after — **yes**
- **NC-3** — Dormant colour: OwnerA withdraws U3, a colour no one ever minted or deposited. Expectation: refused; and U3 remains absent from EVERY map afterwards — a failed operation creates no state
  - fixture read from chain: `U3` = `027dcccf6a6def7577ebe335efe2a1aa1eaa0ab7a5d5d869ed3ef1cfab279ff8`, `U3 issuer` = `Minter3`, `AA_A.U3` = `0`, `AA_A.U1 (what AA_A does hold)` = `3`, `U3 present anywhere before` = `nowhere`
  - no state created: U3 absent from every map before — **yes**; U3 absent from every map after — **yes**
- **NC-4** — Unregistered credit: a deposit naming an account commitment that was never registered. Expectation: refused with "credit account is not registered"; credit is open to REGISTERED accounts only, and the refusal creates no pool and no cell
  - fixture read from chain: `bogus account commitment` = `7777777777777777777777777777777777777777777777777777777777777777`, `registered accounts` = `009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b,755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904`, `OwnerN.S1 (real funds offered)` = `4`
  - no state created: account set unchanged — **yes**; no cell for the bogus account, no pool for the colour — **yes ({"pools":4,"shieldedCells":5,"unshieldedCells":3})**
- **NC-5** — Internal transfer of an unheld colour: AA_A moves S2 it does not hold, while rich in others. Expectation: refused by the per-(account, colour) guard; an internal transfer performs no token operation, so nothing else could have absorbed it, and the DESTINATION cell is not created
  - fixture read from chain: `AA_A.S2` = `0`, `AA_A.S1` = `3`, `AA_A.S3` = `4`, `AA_A.S4` = `7`, `AA_A.U1` = `3`, `poolS2` = `4`, `AA_B.S2 (the destination already holds S2)` = `4`
  - no state created: (AA_A,S2) cell absent before — **yes**; (AA_A,S2) cell absent after — **yes**; poolS2 unchanged — **yes (4)**

Full before/after state in `evidence/g3-ledger/negative-controls.json`.

## P-COLL — one colour, two families, no aliasing

- colliding colour (byte-identical in both families): `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd`
- issuer: MinterCollide at `91d2f65440db34c57dd5f7b3538d759fa798519d94932fe3b9b699cb596c7b67`
- `shieldedKey(AA_B, X)`   = `10e27aacb3f07384fc2a97bbb9056abc4c051798583374b79523a393fc771fb1`
- `unshieldedKey(AA_B, X)` = `92903947a5d86664fb6b677db7681fc2a6da9618652c1db97346a91bb343ac3f`
- keys differ: **yes**

| After | pool (shielded) | contract ledger balance (unshielded) | AA_B shielded cell | AA_B unshielded cell |
|---|---|---|---|---|
| both deposits | 3 | 2 | 3 | 2 |
| one independent withdrawal from each side | 2 | 1 | 2 | 1 |

The same 32 bytes hold 3 in one family and 2 in the other, under two different key domains, and a
withdrawal from either side leaves the other byte-identical.

Second observation point — two REAL ON-CHAIN CIRCUIT CALLS taking the IDENTICAL colour argument:

- `shieldedAccountBalance(AA_B, X)` = `2`
- `unshieldedAccountBalance(AA_B, X)` = `1`

## M3 and decision D-203 — atomic double lazy-init

- transaction id(s): `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a`
- shape used: **sdk-scoped batch (one transaction, one segment per call, state threaded)**
- circuits: `depositShielded` + `depositUnshielded`
- both colours brand new before the call: `{"pool for S5 exists":"false","(AA_B,S5) cell exists":"false","(AA_B,U5) cell exists":"false","kernel holds U5":"false","mapSizesBefore":"{\"pools\":5,\"shieldedCells\":6,\"unshieldedCells\":4}"}`
- map sizes `{"pools":5,"shieldedCells":6,"unshieldedCells":4}` → `{"pools":6,"shieldedCells":7,"unshieldedCells":5}`
- on-chain circuit reads: `shieldedAccountBalance(AA_B, S5)` = `3`, `unshieldedAccountBalance(AA_B, U5)` = `3`
- refused composition created no state: (the composition was accepted)
- **D-203: RESOLVED — SDK contract-scoped batch; one transaction id carried both first deposits**

| # | Shape attempted | Outcome |
|---|---|---|
| 1 | sdk-scoped batch (one transaction, one segment per call, state threaded) | refused — `Unexpected error submitting scoped transaction 'aa00005-double-lazy-init': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } \| cause: Transaction submission error` |
| 2 | sdk-scoped batch (one transaction, one segment per call, state threaded) | **used** |

FR-207's rule is applied literally: the LAZY-INIT half and the COMPOSITION half are separate
checklist rows, so a refused composition is never recorded as a lazy-init failure and never
borrows the other half's green.

## Distinctness

**45/45 distinct** (no collisions) over the ten TOKA–TOKE colours, all read from on-chain circuit calls.

| Role | Colour |
|---|---|
| Minter1(TOKA).S1 | `af0cf3315634a046dab2734b721b8d3f923e346d878a3d414edcd2164cec8a31` |
| Minter1(TOKA).U1 | `df6c4aa1b76bd3b559685a2dbabd38ab5ca5250b40a9e591783ff52ef34a71b6` |
| Minter2(TOKB).S2 | `22d2a436b6554a4eb773a6b9222f09b2901af4e34473bb40e7f0499ca75c690d` |
| Minter2(TOKB).U2 | `945184e96f853231a70e09a5210a252cdff6ede55f5a871c87ac0417efa24e37` |
| Minter3(TOKC).S3 | `560e94176de2b692c51c516a7daff0ae8c13c9e244834e4296093aaa91361a90` |
| Minter3(TOKC).U3 | `027dcccf6a6def7577ebe335efe2a1aa1eaa0ab7a5d5d869ed3ef1cfab279ff8` |
| Minter4(TOKD).S4 | `1830d810691419a4a0aacae99deb76d5bc59c881178d559a9be0fb674b9c5337` |
| Minter4(TOKD).U4 | `21472fe902aa4a4fb7b528b9d96464d7b3091b2baeed8d07ee55841af4a43d6a` |
| Minter5(TOKE).S5 | `5646230bed383e0dffae1c1442f2152118cffa8761a3f0b347cdf017c9a7300e` |
| Minter5(TOKE).U5 | `cd56842f5052d16b8b220698637f5d54d7bd7d72539a85034fc5eb98641b3a50` |
| MinterCollide(TOKX).shielded | `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd` |
| MinterCollide(TOKX).unshielded | `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd` |

**The inverted assertion — MinterCollide's two family colours are byte-identical: YES**, and that colour collides with none of the ten (0 contaminations).

## Run metrics

```json
{
  "proofLatencyMs": {
    "count": 70,
    "min": 0,
    "median": 620,
    "max": 5945,
    "mean": 1050
  },
  "transactionBytes": {
    "count": 70,
    "min": 6671,
    "median": 8282,
    "max": 26760,
    "mean": 11304
  },
  "proofs": [
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "registerAccount",
      "ms": 1415
    },
    {
      "circuits": "registerAccount",
      "ms": 143
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 597
    },
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "shieldedColor",
      "ms": 692
    },
    {
      "circuits": "unshieldedColor",
      "ms": 766
    },
    {
      "circuits": "unknown",
      "ms": 1
    },
    {
      "circuits": "shieldedColor",
      "ms": 449
    },
    {
      "circuits": "unshieldedColor",
      "ms": 500
    },
    {
      "circuits": "unknown",
      "ms": 1
    },
    {
      "circuits": "shieldedColor",
      "ms": 458
    },
    {
      "circuits": "unshieldedColor",
      "ms": 472
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 593
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1419
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 612
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 581
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 574
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1107
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 587
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 962
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 471
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 592
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 620
    },
    {
      "circuits": "depositShielded",
      "ms": 5945
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 561
    },
    {
      "circuits": "depositUnshielded",
      "ms": 880
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 655
    },
    {
      "circuits": "depositShielded",
      "ms": 3486
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 600
    },
    {
      "circuits": "depositShielded",
      "ms": 2196
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 591
    },
    {
      "circuits": "depositUnshielded",
      "ms": 861
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 599
    },
    {
      "circuits": "transferInternalShielded",
      "ms": 1663
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 449
    },
    {
      "circuits": "withdrawShielded",
      "ms": 4957
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 608
    },
    {
      "circuits": "withdrawUnshielded",
      "ms": 906
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 678
    },
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "shieldedColor",
      "ms": 629
    },
    {
      "circuits": "unshieldedColor",
      "ms": 664
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 2093
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 630
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 600
    },
    {
      "circuits": "depositShielded",
      "ms": 3198
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 591
    },
    {
      "circuits": "depositUnshielded",
      "ms": 875
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 604
    },
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "shieldedColor",
      "ms": 651
    },
    {
      "circuits": "unshieldedColor",
      "ms": 620
    },
    {
      "circuits": "unknown",
      "ms": 0
    },
    {
      "circuits": "shieldedColor",
      "ms": 498
    },
    {
      "circuits": "unshieldedColor",
      "ms": 476
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1314
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 603
    },
    {
      "circuits": "depositShielded",
      "ms": 3090
    },
    {
      "circuits": "depositUnshielded",
      "ms": 954
    },
    {
      "circuits": "withdrawShielded",
      "ms": 4541
    },
    {
      "circuits": "withdrawUnshielded",
      "ms": 1114
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 629
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 588
    },
    {
      "circuits": "mintShieldedTo",
      "ms": 1276
    },
    {
      "circuits": "mintUnshieldedTo",
      "ms": 635
    },
    {
      "circuits": "depositShielded+depositUnshielded",
      "ms": 3564
    },
    {
      "circuits": "depositShielded+depositUnshielded",
      "ms": 2637
    },
    {
      "circuits": "shieldedAccountBalance",
      "ms": 610
    },
    {
      "circuits": "unshieldedAccountBalance",
      "ms": 574
    }
  ],
  "transactions": [
    {
      "label": "feePayer/manager",
      "bytes": 26760
    },
    {
      "label": "feePayer/manager",
      "bytes": 6671
    },
    {
      "label": "feePayer/manager",
      "bytes": 6671
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "feePayer/minter1",
      "bytes": 12573
    },
    {
      "label": "feePayer/minter1",
      "bytes": 8246
    },
    {
      "label": "feePayer/minter1",
      "bytes": 8248
    },
    {
      "label": "feePayer/minter2",
      "bytes": 12573
    },
    {
      "label": "feePayer/minter2",
      "bytes": 8246
    },
    {
      "label": "feePayer/minter2",
      "bytes": 8254
    },
    {
      "label": "feePayer/minter3",
      "bytes": 12573
    },
    {
      "label": "feePayer/minter3",
      "bytes": 8246
    },
    {
      "label": "feePayer/minter3",
      "bytes": 8248
    },
    {
      "label": "feePayer/manager",
      "bytes": 8214
    },
    {
      "label": "feePayer/minter1",
      "bytes": 13926
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "feePayer/minter1",
      "bytes": 8909
    },
    {
      "label": "feePayer/manager",
      "bytes": 8214
    },
    {
      "label": "feePayer/minter2",
      "bytes": 13926
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "feePayer/minter3",
      "bytes": 13927
    },
    {
      "label": "feePayer/manager",
      "bytes": 8214
    },
    {
      "label": "feePayer/minter2",
      "bytes": 8909
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "OwnerN-spender-1-step7/manager",
      "bytes": 23978
    },
    {
      "label": "feePayer/manager",
      "bytes": 8214
    },
    {
      "label": "OwnerN-spender-2-step8/manager",
      "bytes": 8910
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "OwnerM-spender-3-step9/manager",
      "bytes": 23948
    },
    {
      "label": "feePayer/manager",
      "bytes": 8213
    },
    {
      "label": "OwnerM-spender-4-step10/manager",
      "bytes": 23948
    },
    {
      "label": "feePayer/manager",
      "bytes": 8217
    },
    {
      "label": "OwnerM-spender-5-step11/manager",
      "bytes": 8909
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "feePayer/manager",
      "bytes": 8568
    },
    {
      "label": "feePayer/manager",
      "bytes": 8279
    },
    {
      "label": "feePayer/manager",
      "bytes": 24623
    },
    {
      "label": "feePayer/manager",
      "bytes": 8281
    },
    {
      "label": "feePayer/manager",
      "bytes": 9287
    },
    {
      "label": "feePayer/manager",
      "bytes": 8212
    },
    {
      "label": "feePayer/minter4",
      "bytes": 12573
    },
    {
      "label": "feePayer/minter4",
      "bytes": 8246
    },
    {
      "label": "feePayer/minter4",
      "bytes": 8248
    },
    {
      "label": "feePayer/minter4",
      "bytes": 13925
    },
    {
      "label": "feePayer/minter4",
      "bytes": 8908
    },
    {
      "label": "feePayer/manager",
      "bytes": 8214
    },
    {
      "label": "OwnerN-spender-6-step16/manager",
      "bytes": 18794
    },
    {
      "label": "feePayer/manager",
      "bytes": 8274
    },
    {
      "label": "OwnerM-spender-7-step17/manager",
      "bytes": 8833
    },
    {
      "label": "feePayer/manager",
      "bytes": 8282
    },
    {
      "label": "feePayer/minter5",
      "bytes": 12572
    },
    {
      "label": "feePayer/minter5",
      "bytes": 8246
    },
    {
      "label": "feePayer/minter5",
      "bytes": 8248
    },
    {
      "label": "feePayer/mintercollide",
      "bytes": 10388
    },
    {
      "label": "feePayer/mintercollide",
      "bytes": 8246
    },
    {
      "label": "feePayer/mintercollide",
      "bytes": 8246
    },
    {
      "label": "feePayer/mintercollide",
      "bytes": 13927
    },
    {
      "label": "feePayer/mintercollide",
      "bytes": 8904
    },
    {
      "label": "OwnerM-spender-9-pcoll-shielded/manager",
      "bytes": 18823
    },
    {
      "label": "OwnerM-spender-10-pcoll-unshielded/manager",
      "bytes": 8830
    },
    {
      "label": "feePayer/manager",
      "bytes": 24624
    },
    {
      "label": "feePayer/manager",
      "bytes": 9286
    },
    {
      "label": "feePayer/manager",
      "bytes": 8274
    },
    {
      "label": "feePayer/manager",
      "bytes": 8276
    },
    {
      "label": "feePayer/minter5",
      "bytes": 13927
    },
    {
      "label": "feePayer/minter5",
      "bytes": 8909
    },
    {
      "label": "OwnerM-spender-11-m3-compose-try1/manager",
      "bytes": 24171
    },
    {
      "label": "OwnerM-spender-12-m3-compose-try2/manager",
      "bytes": 24166
    },
    {
      "label": "feePayer/manager",
      "bytes": 8270
    },
    {
      "label": "feePayer/manager",
      "bytes": 8276
    }
  ]
}
```

