# Deviation D-307 — the demonstration ledger is PARTITIONED across three fresh Managers on one chain

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T16:15:18.346Z

## Cause

F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built

## What was preserved

every row, control and probe runs with the spec's exact amounts and assertions, in one scripted run on one chain; the final table is asserted per stage with the mapping recorded

## What is NOT claimed

this is NOT the spec's literal single-Manager 13-row table, and it is never presented as one. No claim is made that a 13-row single-Manager sequence is reachable at these pins — the opposite is measured, by P-F310

## Why three stages is the minimum

rows 5 and 8 each require a settlement and a settlement exhausts the budget, so TWO Managers are unavoidable. The third keeps the refusal-only negatives from interleaving with — and destroying — the live offers rows 5 and 8 must settle. A two-stage packing is arithmetically possible and was rejected: it would make the owner-REQUIRED rows 7–8 depend on five prior interventions each landing exactly right

## The evidence FOR the deviation, not just the assertion of it

### stage A / `p-f310` — **MEASURED**

> This is the measurement deviation D-307 rests on. Both arms were FULLY BACKED — AA_A holds 2 S_A and the pool holds 2 — so the only thing that can refuse them is placement, which is exactly what did.
> It also replicates F-310 a fourth time, on a Manager it was never measured on, and separates the two candidate mechanisms: the wanted colour having a pool (F-308) is NOT necessary; two custody cells are enough.

| Check | Result | Detail |
|---|---|---|
| the spec's LITERAL row 7 FAILS CLOSED here — FR-302 refuses to publish it | PASS | ok=false kind=fr302-placement-fail-closed |
| and the measured placement shows why: segment 0 carries NOTHING, the whole transcript went fallible | PASS | segment 0 = {}; fallible-offer segments [29459] |
| the same offer wanting a colour with NO pool ALSO fails closed — so it is the CELL COUNT, not F-308’s pool effect | PASS | ok=false kind=fr302-placement-fail-closed |
| the fresh-colour arm’s placement is fallible too | PASS | segment 0 = {} |
| nothing was published by any arm | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"},"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"}} |

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 8be4fc7513e8…): segments present: [0,19167] intent segments: [19167] fallible-offer segments: [19167] expected 0: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 19167: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 7f2c1a65e1d5…): segments present: [0,52464] intent segments: [52464] fallible-offer segments: [52464] expected 0: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 52464: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

### stage C / `p-f310` — **MEASURED**

> custody configuration at the time: 1 pool(s) / 2 shielded cells. The offer gives 2 S_A with AA_A's cell at 2 and the pool at 5 — fully backed, so no guard can refuse it and placement is the only thing left.

| Check | Result | Detail |
|---|---|---|
| the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated | PASS | ok=false kind=fr302-placement-fail-closed |
| the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [39338] |
| nothing was published | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 9ae23435fce1… / want 1 99e9425a10a2…): segments present: [0,4807] intent segments: [4807] fallible-offer segments: [4807] expected 0: {"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 4807: {"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

## Ratification

owner ratification wanted as a spec amendment — Plan 03 question Q03-1. The spec file is byte-identical

The spec file is byte-identical and its checkboxes are unticked, per the series convention. The option table for the owner is in the plan, not here.
