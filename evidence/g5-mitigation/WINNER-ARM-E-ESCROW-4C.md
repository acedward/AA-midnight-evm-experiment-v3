# G5 end-to-end — `arm-e-escrow` at 4 custody cell(s)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T21:55:36.045Z

U1 (self-merge) and U2 (published file) use the SAME offer shape — floating surplus — and
differ in nothing but WHO SETTLES, so a difference in outcome is attributable to the settler.

| case | cells | placement | settled | tx id / refusal | FR-302 gate | checks passed |
|---|---|---|---|---|---|---|
| U1 `u1-control-1cell` | 1 | GUARANTEED | YES | `007f3a38c2947c815c855fd40aaaba5e5da28e305b17c36db2e6e8ce257136edec` | BYPASSED on purpose (U1) | 10/10 |
| U1 `u1-4cell` | 4 | GUARANTEED | YES | `00bb61ffdadfc0b7e64ecea72d53d244c19bf346acd8820c3708571ca6f0e08c05` | BYPASSED on purpose (U1) | 0/1 |
| U2 `u2-4cell` | 5 | GUARANTEED | YES | `00b25ca0109405c4ef33ccd998ca01687329e34405bc46ba850747b72299bb66ab` | enforced | 12/12 |

## U1 — `u1-control-1cell` (1 cell(s), 1 pool(s))

**The FR-302 publication gate was DELIBERATELY BYPASSED for this case.** U1 asks whether a
maker can settle its OWN offer past the F-310 boundary, and the gate — correctly — refuses
to publish anything not placed at segment 0, which would make the question unanswerable.
Placement that was bypassed: **GUARANTEED**, fallible segments
`[]`.

| field | value |
|---|---|
| offer circuit | `openSwap` |
| shape | `floating-surplus` |
| imbalances(0) | `{"shielded:2e23e4da8b0839459368b08cf93d1fd1d8624995b9b0888f660a930c77e60766":"2","shielded:529552f56067bbf1decf6e004ce429f2d478bb4bc42b57be4941d5b231d7b9eb":"-3"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 16056 / `68ebea479ff7b2487fef3c05…` |
| prove ms | 3772 |
| maker attached DUST | false |
| stage tx (arm e) | `00983e74e750c7c7b380cabd29db5a3ed4d5fc35de63f5988706ff73e824831141` |
| consolidate tx (arm e) | `00805a7ba0f7d1b3eef0e6e174ad854e21dec9b674a3d3a020bfb446986ebb3fb5` |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 16056 B in 3772 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 007f3a38c2947c815c855fd40aaaba5e5da28e305b17c36db2e6e8ce257136edec |
| 4 | custody gave 2 of G | PASS | held(G) 8 -> 6 (expected 6) |
| 5 | custody gained 3 of B | PASS | held(B) 0 -> 3 (expected 3) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 8 -> 6; AA_A/B absent-or-zero -> 3 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 0 -> 2, B 12 -> 9 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [19692]; settled dust actions {"1":{"spends":1,"registrations":0},"19692":{"spends":0,"registrations":0}} |
| 10 | arm (e): the SELF-BALANCED phases landed on their own (F-310 does not constrain them) | PASS | stage 00983e74e750c7c7b380cabd29db5a3ed4d5fc35de63f5988706ff73e824831141 / consolidate 00805a7ba0f7d1b3eef0e6e174ad854e21dec9b674a3d3a020bfb446986ebb3fb5 |

## U1 — `u1-4cell` (4 cell(s), 2 pool(s))

**The FR-302 publication gate was DELIBERATELY BYPASSED for this case.** U1 asks whether a
maker can settle its OWN offer past the F-310 boundary, and the gate — correctly — refuses
to publish anything not placed at segment 0, which would make the question unanswerable.
Placement that was bypassed: **GUARANTEED**, fallible segments
`[]`.

| field | value |
|---|---|
| offer circuit | `openSwap` |
| shape | `floating-surplus` |
| imbalances(0) | `{"shielded:2e23e4da8b0839459368b08cf93d1fd1d8624995b9b0888f660a930c77e60766":"2","shielded:529552f56067bbf1decf6e004ce429f2d478bb4bc42b57be4941d5b231d7b9eb":"-3"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 16056 / `8f0fa5f6564a422a5a9ac2e0…` |
| prove ms | 3816 |
| maker attached DUST | false |
| stage tx (arm e) | `0024a70a2e339642ac68dd1d008b43d6f0d194363a900a328e87a4a37ff1e18197` |
| consolidate tx (arm e) | `00c9420cbdc850f020cd6c26ba1fa9e3d2ea487d701559e3ecefb721ebd69372c6` |

| # | check | result | detail |
|---|---|---|---|
| 1 | the case ran to completion | **FAIL** | timed out after 180000ms waiting for custody to reach G=28 B=6; last {"size":{"pools":2,"cells":5,"cellsExact":true},"cells":{"AA_A/G":"12","AA_A/B":"6","AA_1/G":"8","AA_1/B":"absent-or-zero","AA_2/G":"8","AA_2/B":"absent-or-zero","AA_3/G":"8","AA_3/B":"absent-or-zero"},"held":{"G":"36","B":"6"},"es |

Verbatim (F-202 clean):

```
timed out after 180000ms waiting for custody to reach G=28 B=6; last {"size":{"pools":2,"cells":5,"cellsExact":true},"cells":{"AA_A/G":"12","AA_A/B":"6","AA_1/G":"8","AA_1/B":"absent-or-zero","AA_2/G":"8","AA_2/B":"absent-or-zero","AA_3/G":"8","AA_3/B":"absent-or-zero"},"held":{"G":"36","B":"6"},"escrow":{"active":"false","coinValue":"0","coinColour":"0000000000000000000000000000000000000000000000000000000000000000","owner":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","receivedActive":"false","receivedValue":"0","receivedColour":"0000000000000000000000000000000000000000000000000000000000000000","receivedOwner":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b"}}
```

Refusing layer: **unclassified — see the verbatim text**.

## U2 — `u2-4cell` (5 cell(s), 2 pool(s))

| field | value |
|---|---|
| offer circuit | `openSwap` |
| shape | `floating-surplus` |
| imbalances(0) | `{"shielded:2e23e4da8b0839459368b08cf93d1fd1d8624995b9b0888f660a930c77e60766":"2","shielded:529552f56067bbf1decf6e004ce429f2d478bb4bc42b57be4941d5b231d7b9eb":"-3"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 16057 / `74ed44da41995fe73f31971f…` |
| prove ms | 3608 |
| maker attached DUST | false |
| stage tx (arm e) | `00872d4c44765dc89402a4aa2c5fe2d2aafb26dd28740486c7f2ad475351e0b3b9` |
| consolidate tx (arm e) | `0012417f46aaa30c698d9f68f2346335b208eb8886c71b7a2efd66d7172166486d` |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 16057 B in 3608 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 00b25ca0109405c4ef33ccd998ca01687329e34405bc46ba850747b72299bb66ab |
| 4 | custody gave 2 of G | PASS | held(G) 36 -> 34 (expected 34) |
| 5 | custody gained 3 of B | PASS | held(B) 6 -> 9 (expected 9) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 12 -> 10; AA_A/B 6 -> 9 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerT G 0 -> 2, B 12 -> 9 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [13353]; settled dust actions {"1":{"spends":1,"registrations":0},"13353":{"spends":0,"registrations":0}} |
| 10 | FR-306: the envelope crossed a REAL process boundary byte-identically | PASS | reader pid 9343, 16057 bytes |
| 11 | THE OPEN CLAIM: the settler is a wallet whose keys the maker never knew | PASS | settler seed is OwnerT, disjoint from every maker key |
| 12 | arm (e): the SELF-BALANCED phases landed on their own (F-310 does not constrain them) | PASS | stage 00872d4c44765dc89402a4aa2c5fe2d2aafb26dd28740486c7f2ad475351e0b3b9 / consolidate 0012417f46aaa30c698d9f68f2346335b208eb8886c71b7a2efd66d7172166486d |

