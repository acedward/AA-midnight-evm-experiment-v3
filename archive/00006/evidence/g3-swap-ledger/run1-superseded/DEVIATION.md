# Deviation D-307 — the demonstration ledger is PARTITIONED across three fresh Managers on one chain

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:15:24.503Z

## Cause

F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built

## What was preserved

every row, control and probe runs with the spec's exact amounts and assertions, in one scripted run on one chain; the final table is asserted per stage with the mapping recorded

## What is NOT claimed

this is NOT the spec's literal single-Manager 13-row table, and it is never presented as one. No claim is made that a 13-row single-Manager sequence is reachable at these pins — the opposite is measured, by P-F310

## Why three stages is the minimum

rows 5 and 8 each require a settlement and a settlement exhausts the budget, so TWO Managers are unavoidable. The third keeps the refusal-only negatives from interleaving with — and destroying — the live offers rows 5 and 8 must settle. A two-stage packing is arithmetically possible and was rejected: it would make the owner-REQUIRED rows 7–8 depend on five prior interventions each landing exactly right

## The evidence FOR the deviation, not just the assertion of it

### stage A / `p-f310` — **FAIL**

> This is the measurement deviation D-307 rests on. Both arms were FULLY BACKED — AA_A holds 2 S_A and the pool holds 2 — so the only thing that can refuse them is placement, which is exactly what did.
> It also replicates F-310 a fourth time, on a Manager it was never measured on, and separates the two candidate mechanisms: the wanted colour having a pool (F-308) is NOT necessary; two custody cells are enough.
> DEPARTURE from the prediction: funds unchanged: every wallet holds exactly what it held — {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} -> {"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"},"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"}}

| Check | Result | Detail |
|---|---|---|
| the spec's LITERAL row 7 FAILS CLOSED here — FR-302 refuses to publish it | PASS | ok=false kind=fr302-placement-fail-closed |
| and the measured placement shows why: segment 0 carries NOTHING, the whole transcript went fallible | PASS | segment 0 = {}; fallible-offer segments [63006] |
| the same offer wanting a colour with NO pool ALSO fails closed — so it is the CELL COUNT, not F-308’s pool effect | PASS | ok=false kind=fr302-placement-fail-closed |
| the fresh-colour arm’s placement is fallible too | PASS | segment 0 = {} |
| nothing was published by any arm | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | **FAIL** | before {"mapSizes":{"pools":2,"shieldedCells":2,"unshieldedCells":0},"accounts":["009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904"],"pools":{"S_A":"2","S_B":"7"},"poolCoins":{"S_A":{"nonce":"2ddf527d69101213d86cb9658ccd7023a1e633ba20a3c127cf3b11320d20d600","mtIndex":"33"},"S_B":{"nonce":"f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e","mtIndex":"34"}},"cells":{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"absent","AA_B/S_B":"absent"},"onChain":{}} vs after {"mapSizes":{"pools":2,"shieldedCells":2,"unshieldedCells":0},"accounts":["009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904"],"pools":{"S_A":"2","S_B":"7","S_C":"absent"},"poolCoins":{"S_A":{"nonce":"2ddf527d69101213d86cb9658ccd7023a1e633ba20a3c127cf3b11320d20d600","mtIndex":"33"},"S_B":{"nonce":"f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e","mtIndex":"34"},"S_C":null},"cells":{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent","AA_B/S_C":"absent"},"onChain":{}} |
| funds unchanged: every wallet holds exactly what it held | **FAIL** | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} -> {"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"},"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"}} |

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 55fcabf0eae2…): segments present: [0,28531] intent segments: [28531] fallible-offer segments: [28531] expected 0: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 28531: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 7062dc1579e3…): segments present: [0,55549] intent segments: [55549] fallible-offer segments: [55549] expected 0: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 55549: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

### stage C / `p-f310` — **MEASURED**

> custody configuration at the time: 1 pool(s) / 2 shielded cells. The offer gives 2 S_A with AA_A's cell at 2 and the pool at 5 — fully backed, so no guard can refuse it and placement is the only thing left.

| Check | Result | Detail |
|---|---|---|
| the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated | PASS | ok=false kind=fr302-placement-fail-closed |
| the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [27917] |
| nothing was published | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 016b86faa3e6… / want 1 8919b48e8691…): segments present: [0,20880] intent segments: [20880] fallible-offer segments: [20880] expected 0: {"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 20880: {"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

## Ratification

owner ratification wanted as a spec amendment — Plan 03 question Q03-1. The spec file is byte-identical

The spec file is byte-identical and its checkboxes are unticked, per the series convention. The option table for the owner is in the plan, not here.
