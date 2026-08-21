# G5 end-to-end — `manager` at 2 custody cell(s)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-21T02:39:48.600Z

U1 (self-merge) and U2 (published file) use the SAME offer shape — floating surplus — and
differ in nothing but WHO SETTLES, so a difference in outcome is attributable to the settler.

| case | cells | placement | settled | tx id / refusal | FR-302 gate | checks passed |
|---|---|---|---|---|---|---|
| U1 `u1-control-1cell` | 1 | GUARANTEED | YES | `00cec2b4d60ea00f06c3ebb09e436a40d6aa26190002728b1c5b6cc9009367e66f` | BYPASSED on purpose (U1) | 9/9 |
| U1 `u1-2cell` | 2 | **FALLIBLE** | YES | `00a9f25afaf630d7f0089dac554fee7f8b350774cda4289d0907d50883cf303fb4` | BYPASSED on purpose (U1) | 9/9 |

## U1 — `u1-control-1cell` (1 cell(s), 1 pool(s))

**The FR-302 publication gate was DELIBERATELY BYPASSED for this case.** U1 asks whether a
maker can settle its OWN offer past the F-310 boundary, and the gate — correctly — refuses
to publish anything not placed at segment 0, which would make the question unanswerable.
Placement that was bypassed: **GUARANTEED**, fallible segments
`[]`.

| field | value |
|---|---|
| offer circuit | `openSwapShielded` |
| shape | `floating-surplus` |
| imbalances(0) | `{"shielded:035b6dd088dc1ed295e2ccd9d5184a2b251ced5d5665bb185d23b5b42fa696e0":"-3","shielded:44d3040a5a5407e264cb770e5f340f9f389b62ecdba4e585bde6e0c7a9f70485":"2"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 21583 / `f89980d24826bf986413c68a…` |
| prove ms | 9184 |
| maker attached DUST | false |
| stage tx (arm e) | — |
| consolidate tx (arm e) | — |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 21583 B in 9184 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 00cec2b4d60ea00f06c3ebb09e436a40d6aa26190002728b1c5b6cc9009367e66f |
| 4 | custody gave 2 of G | PASS | held(G) 8 -> 6 (expected 6) |
| 5 | custody gained 3 of B | PASS | held(B) 0 -> 3 (expected 3) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 8 -> 6; AA_A/B absent-or-zero -> 3 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 0 -> 2, B 12 -> 9 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [34001]; settled dust actions {"1":{"spends":1,"registrations":0},"34001":{"spends":0,"registrations":0}} |

## U1 — `u1-2cell` (2 cell(s), 2 pool(s))

**The FR-302 publication gate was DELIBERATELY BYPASSED for this case.** U1 asks whether a
maker can settle its OWN offer past the F-310 boundary, and the gate — correctly — refuses
to publish anything not placed at segment 0, which would make the question unanswerable.
Placement that was bypassed: **FALLIBLE**, fallible segments
`[10743]`.

| field | value |
|---|---|
| offer circuit | `openSwapShielded` |
| shape | `floating-surplus` |
| imbalances(0) | `{}` |
| fallible-offer segments | `[10743]` |
| bytes / sha256 | 37155 / `117624545b68010f6e8f2680…` |
| prove ms | 7954 |
| maker attached DUST | false |
| stage tx (arm e) | — |
| consolidate tx (arm e) | — |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 37155 B in 7954 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 00a9f25afaf630d7f0089dac554fee7f8b350774cda4289d0907d50883cf303fb4 |
| 4 | custody gave 2 of G | PASS | held(G) 6 -> 4 (expected 4) |
| 5 | custody gained 3 of B | PASS | held(B) 3 -> 6 (expected 6) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 6 -> 4; AA_A/B 3 -> 6 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 2 -> 4, B 9 -> 6 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [10743]; settled dust actions {"1":{"spends":1,"registrations":0},"10743":{"spends":0,"registrations":0}} |

