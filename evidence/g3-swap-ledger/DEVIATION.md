# Deviation D-307 — the demonstration ledger is PARTITIONED across three fresh Managers on one chain

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T13:02:51.192Z

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
| and the measured placement shows why: segment 0 carries NOTHING, the whole transcript went fallible | PASS | segment 0 = {}; fallible-offer segments [63946] |
| the same offer wanting a colour with NO pool ALSO fails closed — so it is the CELL COUNT, not F-308’s pool effect | PASS | ok=false kind=fr302-placement-fail-closed |
| the fresh-colour arm’s placement is fallible too | PASS | segment 0 = {} |
| nothing was published by any arm | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"},"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"}} |

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 586d312ace6d… / want 3 94144f1ff0b0…): segments present: [0,22533] intent segments: [22533] fallible-offer segments: [22533] expected 0: {"shielded:586d312ace6d4a995a37b7bd1495c2a3f467e4192dbc8b76bf52b4180c7a9d31":"2","shielded:94144f1ff0b060425ddc65bb2c4740255fd306efa64463fc14350cc3d5ba8096":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 22533: {"shielded:586d312ace6d4a995a37b7bd1495c2a3f467e4192dbc8b76bf52b4180c7a9d31":"2","shielded:94144f1ff0b060425ddc65bb2c4740255fd306efa64463fc14350cc3d5ba8096":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 586d312ace6d… / want 3 eb6596b6fc84…): segments present: [0,8558] intent segments: [8558] fallible-offer segments: [8558] expected 0: {"shielded:586d312ace6d4a995a37b7bd1495c2a3f467e4192dbc8b76bf52b4180c7a9d31":"2","shielded:eb6596b6fc8481fceeebf0cb7af9610d6241f13cd48d2ade0c7e9ee18b0562ea":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 8558: {"shielded:586d312ace6d4a995a37b7bd1495c2a3f467e4192dbc8b76bf52b4180c7a9d31":"2","shielded:eb6596b6fc8481fceeebf0cb7af9610d6241f13cd48d2ade0c7e9ee18b0562ea":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

### stage C / `p-f310` — **MEASURED**

> custody configuration at the time: 1 pool(s) / 2 shielded cells. The offer gives 2 S_A with AA_A's cell at 2 and the pool at 5 — fully backed, so no guard can refuse it and placement is the only thing left.

| Check | Result | Detail |
|---|---|---|
| the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated | PASS | ok=false kind=fr302-placement-fail-closed |
| the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [1466] |
| nothing was published | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 3ee0a9b91f70… / want 1 4fde155ea51f…): segments present: [0,17855] intent segments: [17855] fallible-offer segments: [17855] expected 0: {"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 17855: {"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

## Ratification

owner ratification wanted as a spec amendment — Plan 03 question Q03-1. The spec file is byte-identical

The spec file is byte-identical and its checkboxes are unticked, per the series convention. The option table for the owner is in the plan, not here.
