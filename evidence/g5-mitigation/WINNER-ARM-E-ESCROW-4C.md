# G5 end-to-end — `arm-e-escrow` at 4 custody cell(s)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-21T02:53:18.803Z

U1 (self-merge) and U2 (published file) use the SAME offer shape — floating surplus — and
differ in nothing but WHO SETTLES, so a difference in outcome is attributable to the settler.

| case | cells | placement | settled | tx id / refusal | FR-302 gate | checks passed |
|---|---|---|---|---|---|---|
| U1 `u1-control-1cell` | 1 | GUARANTEED | YES | `0000c87b77eea48c3eef4cfe29f3dc4a3f976bf86f7727cc931a0b5b04da62a0a9` | BYPASSED on purpose (U1) | 10/10 |
| U1 `u1-4cell` | 4 | GUARANTEED | YES | `0092fe283a8dd8158956ace123c7fa4a43baa70c6cac941553a9617eaaf4a2f230` | BYPASSED on purpose (U1) | 10/10 |
| U2 `u2-4cell` | 4 | GUARANTEED | YES | `00504bfc5cad733cbd7e7d39a7cf511808be44608764fd43631aedc0bd5d39c548` | enforced | 12/12 |

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
| imbalances(0) | `{"shielded:0ef22b23df2a06ef649fcd71edba66cb830dc553dc945a6eb873351d68256356":"-3","shielded:d2e67fdc60b585191a6dab0a1b8bb9fd5760e8cc15261002c9e463deb91fdc93":"2"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 16056 / `74be667cd6a61edc40cd71ac…` |
| prove ms | 3985 |
| maker attached DUST | false |
| stage tx (arm e) | `00625a3d90ac3d8e01a1f7d60ab3b6b87df38002cae25355049fcd296a4774800a` |
| consolidate tx (arm e) | `00fbf426bd71f43ce92d8b86e1a5c35d8f8af54da5ff155f669b7724cbdf2f4f47` |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 16056 B in 3985 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 0000c87b77eea48c3eef4cfe29f3dc4a3f976bf86f7727cc931a0b5b04da62a0a9 |
| 4 | custody gave 2 of G | PASS | held(G) 8 -> 6 (expected 6) |
| 5 | custody gained 3 of B | PASS | held(B) 0 -> 3 (expected 3) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 8 -> 6; AA_A/B absent-or-zero -> 3 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 0 -> 2, B 12 -> 9 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [37429]; settled dust actions {"1":{"spends":1,"registrations":0},"37429":{"spends":0,"registrations":0}} |
| 10 | arm (e): the SELF-BALANCED phases landed on their own (F-310 does not constrain them) | PASS | stage 00625a3d90ac3d8e01a1f7d60ab3b6b87df38002cae25355049fcd296a4774800a / consolidate 00fbf426bd71f43ce92d8b86e1a5c35d8f8af54da5ff155f669b7724cbdf2f4f47 |

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
| imbalances(0) | `{"shielded:0ef22b23df2a06ef649fcd71edba66cb830dc553dc945a6eb873351d68256356":"-3","shielded:d2e67fdc60b585191a6dab0a1b8bb9fd5760e8cc15261002c9e463deb91fdc93":"2"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 16057 / `fa2c48def959e14cfdae71ca…` |
| prove ms | 3826 |
| maker attached DUST | false |
| stage tx (arm e) | `00a3e1bcf66d5f56f2b3d61cb85b3d6d224bb03aaaa27ade70b982551b09ecd2b5` |
| consolidate tx (arm e) | `00c0d45bbef72a00f585019c8c8fd593ef1d365c81642788ccd804e91b7e78beaa` |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 16057 B in 3826 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 0092fe283a8dd8158956ace123c7fa4a43baa70c6cac941553a9617eaaf4a2f230 |
| 4 | custody gave 2 of G | PASS | held(G) 30 -> 28 (expected 28) |
| 5 | custody gained 3 of B | PASS | held(B) 3 -> 6 (expected 6) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 14 -> 12; AA_A/B 3 -> 6 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 2 -> 4, B 9 -> 6 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [31059]; settled dust actions {"1":{"spends":1,"registrations":0},"31059":{"spends":0,"registrations":0}} |
| 10 | arm (e): the SELF-BALANCED phases landed on their own (F-310 does not constrain them) | PASS | stage 00a3e1bcf66d5f56f2b3d61cb85b3d6d224bb03aaaa27ade70b982551b09ecd2b5 / consolidate 00c0d45bbef72a00f585019c8c8fd593ef1d365c81642788ccd804e91b7e78beaa |

## U2 — `u2-4cell` (4 cell(s), 2 pool(s))

| field | value |
|---|---|
| offer circuit | `openSwap` |
| shape | `floating-surplus` |
| imbalances(0) | `{"shielded:0ef22b23df2a06ef649fcd71edba66cb830dc553dc945a6eb873351d68256356":"-3","shielded:d2e67fdc60b585191a6dab0a1b8bb9fd5760e8cc15261002c9e463deb91fdc93":"2"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 16057 / `d0a1f25553015d58f7e68d37…` |
| prove ms | 3710 |
| maker attached DUST | false |
| stage tx (arm e) | `00ba214963f7d05881a0783d49602953eb21aea48d25086b327a4ecb7b277cca35` |
| consolidate tx (arm e) | `0041d4240d6b8dd1aeacc0f2db2785c560ddbff1b171076543ed53e6fbb36443e8` |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 16057 B in 3710 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 00504bfc5cad733cbd7e7d39a7cf511808be44608764fd43631aedc0bd5d39c548 |
| 4 | custody gave 2 of G | PASS | held(G) 28 -> 26 (expected 26) |
| 5 | custody gained 3 of B | PASS | held(B) 6 -> 9 (expected 9) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 12 -> 10; AA_A/B 6 -> 9 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerT G 0 -> 2, B 12 -> 9 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [48389]; settled dust actions {"1":{"spends":1,"registrations":0},"48389":{"spends":0,"registrations":0}} |
| 10 | FR-306: the envelope crossed a REAL process boundary byte-identically | PASS | reader pid 7509, 16057 bytes |
| 11 | THE OPEN CLAIM: the settler is a wallet whose keys the maker never knew | PASS | settler seed is OwnerT, disjoint from every maker key |
| 12 | arm (e): the SELF-BALANCED phases landed on their own (F-310 does not constrain them) | PASS | stage 00ba214963f7d05881a0783d49602953eb21aea48d25086b327a4ecb7b277cca35 / consolidate 0041d4240d6b8dd1aeacc0f2db2785c560ddbff1b171076543ed53e6fbb36443e8 |
