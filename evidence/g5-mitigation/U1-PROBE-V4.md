# G5 end-to-end — `manager` at 2 custody cell(s)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T21:39:23.806Z

U1 (self-merge) and U2 (published file) use the SAME offer shape — floating surplus — and
differ in nothing but WHO SETTLES, so a difference in outcome is attributable to the settler.

| case | cells | placement | settled | tx id / refusal | FR-302 gate | checks passed |
|---|---|---|---|---|---|---|
| U1 `u1-control-1cell` | 1 | GUARANTEED | YES | `0092342af5b84b7ab0cf10000e48865eacda8f561ac83b715fadf4c9071649ca9e` | BYPASSED on purpose (U1) | 9/9 |
| U1 `u1-2cell` | 2 | **FALLIBLE** | YES | `00904e54833c0a609016c54f62dec4fa5e3b319ac5e6e867efa4050d26cb1786bd` | BYPASSED on purpose (U1) | 9/9 |

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
| imbalances(0) | `{"shielded:1a4e7f7934912b7f75d168505ef7c40d7b11b4b1cc4b4c0240637295c33fdf9b":"2","shielded:d75feb7d4fece756b7b3e079ac2d11db3b211f665f22513aca5b10e5793a97ba":"-3"}` |
| fallible-offer segments | `[]` |
| bytes / sha256 | 21583 / `3b235defc44f14743004478d…` |
| prove ms | 6875 |
| maker attached DUST | false |
| stage tx (arm e) | — |
| consolidate tx (arm e) | — |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 21583 B in 6875 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 0092342af5b84b7ab0cf10000e48865eacda8f561ac83b715fadf4c9071649ca9e |
| 4 | custody gave 2 of G | PASS | held(G) 8 -> 6 (expected 6) |
| 5 | custody gained 3 of B | PASS | held(B) 0 -> 3 (expected 3) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 8 -> 6; AA_A/B absent-or-zero -> 3 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 0 -> 2, B 12 -> 9 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [14090]; settled dust actions {"1":{"spends":1,"registrations":0},"14090":{"spends":0,"registrations":0}} |

## U1 — `u1-2cell` (2 cell(s), 2 pool(s))

**The FR-302 publication gate was DELIBERATELY BYPASSED for this case.** U1 asks whether a
maker can settle its OWN offer past the F-310 boundary, and the gate — correctly — refuses
to publish anything not placed at segment 0, which would make the question unanswerable.
Placement that was bypassed: **FALLIBLE**, fallible segments
`[52261]`.

| field | value |
|---|---|
| offer circuit | `openSwapShielded` |
| shape | `floating-surplus` |
| imbalances(0) | `{}` |
| fallible-offer segments | `[52261]` |
| bytes / sha256 | 37103 / `f27102821a3103c19fbc3c61…` |
| prove ms | 7580 |
| maker attached DUST | false |
| stage tx (arm e) | — |
| consolidate tx (arm e) | — |

| # | check | result | detail |
|---|---|---|---|
| 1 | the offer was BUILT and PROVEN | PASS | 37103 B in 7580 ms |
| 2 | FR-301: the maker attached no DUST to its own artifact | PASS | makerAttachedDust=false |
| 3 | the settlement landed under ONE transaction id | PASS | 00904e54833c0a609016c54f62dec4fa5e3b319ac5e6e867efa4050d26cb1786bd |
| 4 | custody gave 2 of G | PASS | held(G) 6 -> 4 (expected 4) |
| 5 | custody gained 3 of B | PASS | held(B) 3 -> 6 (expected 6) |
| 6 | the maker's own cell was debited G and credited B | PASS | AA_A/G 6 -> 4; AA_A/B 3 -> 6 (expected +3 B, -2 G) |
| 7 | the SETTLER swept the 2 G surplus and funded the 3 B deficit | PASS | OwnerA-self G 2 -> 4, B 9 -> 6 |
| 8 | OP1 and OP2 agree on every cell this case claims (FR-208, two observation points) | PASS | OP1 == OP2 for AA_A/G, AA_A/B |
| 9 | the MAKER attached no dust action to the SETTLED transaction | PASS | maker intent segment(s) [52261]; settled dust actions {"1":{"spends":1,"registrations":0},"52261":{"spends":0,"registrations":0}} |

