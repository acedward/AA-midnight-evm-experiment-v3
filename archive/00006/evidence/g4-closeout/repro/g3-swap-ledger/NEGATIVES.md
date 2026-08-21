# Negative controls and probes — verbatim refusals, with the layer that answered

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T16:15:18.346Z

The spec keeps its own checkboxes unticked forever (series convention); this is the product-repo record they refer to.

| Control | What it establishes | Rows | Status |
|---|---|---|---|
| **NC-301** | direct submission of the unbalanced maker tx refused (row 4) | A/`row-4` | PASS |
| **NC-302** | double-take refused after settlement (row 6) | A/`row-6` | PASS |
| **NC-303** | expiry refused past TTL (row 9) | C/`row-9` | PASS |
| **NC-304** | tamper refused (row 10) | A/`row-10` | PASS |
| **NC-305** | unauthorized make: OwnerN's witness (unregistered for AA_A) attempts to open an offer on AA_A's S_A | A/`nc-305` | PASS |
| **NC-306** | unbacked make: an offer giving more S_A than AA_A's cell holds while the pool WOULD cover it via another account | C/`nc-306` | PASS |
| **P-104** | staleness probe (row 11) — measured lane behaviour, FR-311 | C/`row-11` | MEASURED |
| **P-CXL** | cancellation-by-spend (row 12), both forms | C/`row-12a`, C/`row-12b` | MEASURED, MEASURED |
| **P-OPEN** | the open-offer take (rows 7–8) — floating surplus; GREEN if it settles for a previously-unknown holder | B/`row-7`, B/`row-8` | PASS, PASS |
| **P-F310** | D-307's own evidence: the spec's LITERAL row 7 attempted at two custody cells must FAIL CLOSED on FR-302 (the designed-against form of lane issue 0003), replicated at F-310's deciding 1-pool/2-cell configuration | A/`p-f310`, C/`p-f310` | MEASURED, MEASURED |

## NC-301 — direct submission of the unbalanced maker tx refused (row 4)

### stage A / `row-4` — OFFER-1 submitted DIRECTLY (unbalanced) — NC-301 — **PASS**

> the NODE itself refused 1 of 2 attempt(s): as-published (unbound, D-306) -> Custom error: 1 (LedgerApiError::Deserialization(DeserializationError::Transaction) (types.rs:363))

| Check | Result | Detail |
|---|---|---|
| NO submission of the unbalanced offer was accepted | PASS | 0 accepted |
| the LEDGER's own offline verdict refuses it, verbatim | PASS | invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive |
| every submission attempt was refused with a verbatim error (the spec asks for node OR ledger) | PASS | as-published (unbound, D-306): node (submitted and refused, Custom error: 1) \| bound: unclassified — the facade replaced the cause with its own wrapper; see errorDump |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive
```

```
[as-published (unbound, D-306)] 1010: Invalid Transaction: Custom error: 1
```

```
[bound] Transaction submission error
```

## NC-302 — double-take refused after settlement (row 6)

### stage A / `row-6` — Double-take: OFFER-1 balanced and submitted again — NC-302 — **PASS**

> FIXTURE (not a spec row): minted 7 more S_B to OwnerT so the double take can reach the NODE. Without it the taker cannot fund the deficit and its own balancer refuses first, which would be a weaker result than the spec asks for.
> node code observed: 244 (TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414)). Plan 02 measured 239 = NullifierAlreadyPresent for a spent backing coin.

| Check | Result | Detail |
|---|---|---|
| the double take was REFUSED | PASS | stage=settlement |
| the refusal came from the NODE (the backing coin is spent), with a numeric code | PASS | code 244 — TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 244
```

## NC-303 — expiry refused past TTL (row 9)

### stage C / `row-9` — Expiry: OFFER-3 held past its TTL, then taken — NC-303 — **PASS**

| Check | Result | Detail |
|---|---|---|
| OFFER-3 was built and proven | PASS | 7569 ms |
| the intent TTL rewrite took effect BEFORE proving (F-306) | PASS | 2026-08-20T16:10:43.000Z |
| the taker's OWN gate refuses the expired offer OFFLINE, with no network contact | PASS | stage=expired offline=true |
| and with that gate forced off, the NODE refuses it too | PASS | stage=settlement code 228 |
| the node's code is 228 (IntentTtlExpired) — the code Plan 02 measured | PASS | 228 — MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
offer expired 35 s ago (expiresAt 2026-08-20T16:10:50.765Z); refused locally without contacting the chain
```

```
1010: Invalid Transaction: Custom error: 228
```

## NC-304 — tamper refused (row 10)

### stage A / `row-10` — Tamper: OFFER-1's retained bytes, one byte flipped, taken — NC-304 — **PASS**

> arm (b) was refused at stage `settlement` with node code 235 — this is the layer the spec anticipated (deserialize/validate); arm (a) is a STRONGER refusal, one layer earlier.

| Check | Result | Detail |
|---|---|---|
| arm (a): the tampered offer was REFUSED | PASS | stage=envelope |
| arm (a): refused OFFLINE by the envelope content-address check — no wallet, proof server or node contacted | PASS | stage=envelope offline=true |
| arm (b): the re-addressed tampered offer was ALSO refused | PASS | stage=settlement |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"}} |

Verbatim (F-202 clean):

```
offer content address mismatch: terms declare sha256 ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6, payload hashes to a8f010ee567fed7f8e4bc0e50b31f09051eece4c91322ec57ce4bd1a85e14566
```

```
Transaction submission error
```

## NC-305 — unauthorized make: OwnerN's witness (unregistered for AA_A) attempts to open an offer on AA_A's S_A

### stage A / `nc-305` — unauthorized make: OwnerN's witness attempts an offer on AA_A's S_A — **PASS**

> the maker process classified the refusal as `circuit-guard-refusal`

| Check | Result | Detail |
|---|---|---|
| the offer build was REFUSED | PASS | ok=false |
| refused at THE WITNESS CHOKE POINT — the verbatim error names the unregistered witness | PASS | failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'openSwapShielded' |
| nothing was published | PASS | published=false |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
failed assert: caller's owner witness matches no registered account | cause: Error executing circuit 'openSwapShielded'
```

## NC-306 — unbacked make: an offer giving more S_A than AA_A's cell holds while the pool WOULD cover it via another account

### stage C / `nc-306` — unbacked make: AA_A asks for more S_A than its cell holds, while the pool COULD cover it — **PASS**

> premise: the pool holds 5 S_A (enough), AA_A's own cell holds 2 (not enough), and the request is for 5. Planned amount was 5; the live value is used so the premise holds regardless of what the earlier rows did.

| Check | Result | Detail |
|---|---|---|
| the premise holds: the pool WOULD cover the request | PASS | pool 5 >= 5 |
| the premise holds: AA_A's own cell would NOT | PASS | cell 2 < 5 |
| the build was REFUSED | PASS | ok=false |
| refused by THE PER-(ACCOUNT, COLOUR) GUARD — the verbatim error names the account balance, not the pool | PASS | failed assert: account colour balance too low \| cause: Error executing circuit 'openSwapShielded' |
| nothing was published | PASS | published=false |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
failed assert: account colour balance too low | cause: Error executing circuit 'openSwapShielded'
```

## P-104 — staleness probe (row 11) — measured lane behaviour, FR-311

### stage C / `row-11` — Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken — **MEASURED**

> intervention: OwnerN deposited 1 more S_A into AA_A; pool(S_A) 6 -> 7, which MERGES the pooled coin
> MEASURED, not judged (FR-311). The mechanism: the maker's call pins the pooled coin it spends — the coin's Merkle index enters the transcript — and an ordinary deposit MERGES that coin, which SPENDS it. 239 names that precisely; 104 would only have said "a transcript did not match".

| Check | Result | Detail |
|---|---|---|
| the live offer was INVALIDATED — the take was refused | PASS | stage=settlement |
| the MEASURED code is 239 (NullifierAlreadyPresent) — FR-311 predicted 104 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 239
```

## P-CXL — cancellation-by-spend (row 12), both forms

### stage C / `row-12a` — Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL — **MEASURED**

> cancellation: the owner withdrew 2 S_A to its own wallet; pool(S_A) 7 -> 5, and the POOLED COIN CHANGED (8098646c3d0b… -> f8f35c5ebd1b…) because `sendShielded` spends it and re-pools the change

| Check | Result | Detail |
|---|---|---|
| the cancelled offer was REFUSED | PASS | stage=settlement |
| the pooled coin really did move (so this is cancellation BY SPEND) | PASS | 8098646c3d0bb00d… -> f8f35c5ebd1bfac9… |
| the node's code is 239 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 239
```

### stage C / `row-12b` — Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL — **MEASURED**

> intervention: AA_A transferred 3 S_A to AA_B INSIDE the Manager. AA_A's cell 5 -> 2, AA_B's cell created at 3; custody is now 1 pool(s) / 2 cells
> So FR-307(d) holds for BOTH forms the spec names, but by two different mechanisms — and only the withdraw is literally "moving the backing pool coin".

| Check | Result | Detail |
|---|---|---|
| the pooled coin is BYTE-IDENTICAL — no token operation happened | PASS | f8f35c5ebd1bfac9…/51 vs f8f35c5ebd1bfac9…/51 |
| the offer was refused even though no coin moved | PASS | stage=settlement |
| the code is 104 (Transcript) — the expectation, not an assertion | PASS | 104 — InvalidError::Transcript (types.rs:406) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 104
```

## P-OPEN — the open-offer take (rows 7–8) — floating surplus; GREEN if it settles for a previously-unknown holder

### stage B / `row-7` — OFFER-2 built (v2 OPEN — floating surplus): give S_A 2 to no one, want S_B 3 → AA_A — **PASS**

| Check | Result | Detail |
|---|---|---|
| OFFER-2 was built and proven | PASS | 6694 ms |
| FR-302: imbalances(0) is EXACTLY +2 S_A and −3 S_B | PASS | {"shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9":"-3","shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e":"2"} |
| FR-302: no other segment carries any delta | PASS | [] |
| THE OPEN PROPERTY: the offer names NO recipient for colour A | PASS | terms.gives.recipient absent |
| THE OPEN PROPERTY, structurally: the maker process was never GIVEN a recipient — its input has no such field | PASS | maker input: {"label":"OFFER-2","managerAddress":"eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195","witness":"ownerA","shape":"floating-surplus","gives":{"colour":"d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e","value":"2"},"wants":{"colour":"afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9","value":"3"},"creditAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","makerAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","envelopeOut":"/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-2-open.offer","out":"/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row7-maker.report.json"} |
| FR-301: the maker attached NO DUST | PASS | — |
| FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 80922, 16346 bytes, sha 5330ab5a75b13aed… |
| a reader with NO NETWORK sees the +A surplus the terms declare | PASS | {"0/shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e":"2"} |
| the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -3 for token Shielded(ShieldedTokenType(afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9)) in segment 0; balance must be positive |
| building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 0 vs cells 0 |
| zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 10 + pool 0 |

Verbatim (F-202 clean):

```
invalid balance -3 for token Shielded(ShieldedTokenType(afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9)) in segment 0; balance must be positive
```

### stage B / `row-8` — OwnerT — whose keys the maker never knew — takes OFFER-2 — **PASS**

> The pool for S_A is REMOVED, not zeroed: the release took the whole pooled coin, so the colour leaves the pool map entirely — while the ACCOUNT CELL stays at 0. That is why the end-state map sizes are 1 pool / 2 shielded cells / 0 unshielded, exactly as the spec's row 8 says.
> Deltas match the spec exactly; the S_B TOTALS do not, because the +7 the spec's figures carry was created by row 5 on stage A's Manager. That is deviation D-307 and nothing else.

| Check | Result | Detail |
|---|---|---|
| the OPEN swap SETTLED | PASS | 003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f |
| ONE transaction id settled it | PASS | 003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f |
| THE OPEN CLAIM: a wallet the maker never named SWEPT the surplus | PASS | OwnerT S_A 0 -> 2 (expected 2) |
| the taker funded the −B deficit out of its own coins | PASS | OwnerT S_B 10 -> 7 |
| pool(S_A) = absent | PASS | observed absent |
| pool(S_B) = 3 | PASS | observed 3 |
| cell AA_A/S_A = 0 | PASS | observed 0 |
| cell AA_A/S_B = 3 | PASS | observed 3 |
| cell AA_B/S_A = absent | PASS | observed absent |
| exact map sizes 1/2/0 | PASS | {"pools":1,"shieldedCells":2,"unshieldedCells":0} |
| OwnerN holds 8 S_A | PASS | observed 8 |
| the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["31112"] -> 0; full map {"1":{"spends":1,"registrations":0},"31112":{"spends":0,"registrations":0}} |
| ANOTHER intent attached the dust, so the taker really paid | PASS | other segments ["1"] -> 1 |
| the taker's own balancer swept the surplus — nothing was left unswept | PASS | {} |
| OP1 and OP2 agree on every cell | PASS | agree |
| per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 0 vs cells 0; S_B: pool 3 vs cells 3 |
| zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 10 + pool 0; S_B: minted 10 = users 7 + pool 3 |

## P-F310 — D-307's own evidence: the spec's LITERAL row 7 attempted at two custody cells must FAIL CLOSED on FR-302 (the designed-against form of lane issue 0003), replicated at F-310's deciding 1-pool/2-cell configuration

### stage A / `p-f310` — D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells — **MEASURED**

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

Verbatim (F-202 clean):

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 8be4fc7513e8…): segments present: [0,19167] intent segments: [19167] fallible-offer segments: [19167] expected 0: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 19167: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 7f2c1a65e1d5…): segments present: [0,52464] intent segments: [52464] fallible-offer segments: [52464] expected 0: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 52464: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

### stage C / `p-f310` — P-F310 replication: a FULLY BACKED offer at two custody cells — **MEASURED**

> custody configuration at the time: 1 pool(s) / 2 shielded cells. The offer gives 2 S_A with AA_A's cell at 2 and the pool at 5 — fully backed, so no guard can refuse it and placement is the only thing left.

| Check | Result | Detail |
|---|---|---|
| the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated | PASS | ok=false kind=fr302-placement-fail-closed |
| the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [39338] |
| nothing was published | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

Verbatim (F-202 clean):

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 9ae23435fce1… / want 1 99e9425a10a2…): segments present: [0,4807] intent segments: [4807] fallible-offer segments: [4807] expected 0: {"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 4807: {"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

