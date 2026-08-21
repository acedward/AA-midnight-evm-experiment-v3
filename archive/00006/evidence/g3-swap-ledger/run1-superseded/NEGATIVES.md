# Negative controls and probes — verbatim refusals, with the layer that answered

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:15:24.503Z

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
| **P-F310** | D-307's own evidence: the spec's LITERAL row 7 attempted at two custody cells must FAIL CLOSED on FR-302 (the designed-against form of lane issue 0003), replicated at F-310's deciding 1-pool/2-cell configuration | A/`p-f310`, C/`p-f310` | **FAIL**, MEASURED |

## NC-301 — direct submission of the unbalanced maker tx refused (row 4)

### stage A / `row-4` — OFFER-1 submitted DIRECTLY (unbalanced) — NC-301 — **PASS**

> the NODE itself refused 1 of 2 attempt(s): as-published (unbound, D-306) -> Custom error: 1 (1 — NOT DECODED at these pins)

| Check | Result | Detail |
|---|---|---|
| NO submission of the unbalanced offer was accepted | PASS | 0 accepted |
| the LEDGER's own offline verdict refuses it, verbatim | PASS | invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive |
| every submission attempt was refused with a verbatim error (the spec asks for node OR ledger) | PASS | as-published (unbound, D-306): node (submitted and refused, Custom error: 1) \| bound: facade (refused to send it) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

Verbatim (F-202 clean):

```
invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive
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
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 244
```

## NC-303 — expiry refused past TTL (row 9)

### stage C / `row-9` — Expiry: OFFER-3 held past its TTL, then taken — NC-303 — **PASS**

| Check | Result | Detail |
|---|---|---|
| OFFER-3 was built and proven | PASS | 7557 ms |
| the intent TTL rewrite took effect BEFORE proving (F-306) | PASS | 2026-08-20T12:10:49.000Z |
| the taker's OWN gate refuses the expired offer OFFLINE, with no network contact | PASS | stage=expired offline=true |
| and with that gate forced off, the NODE refuses it too | PASS | stage=settlement code 228 |
| the node's code is 228 (IntentTtlExpired) — the code Plan 02 measured | PASS | 228 — MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

Verbatim (F-202 clean):

```
offer expired 35 s ago (expiresAt 2026-08-20T12:10:56.945Z); refused locally without contacting the chain
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
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

Verbatim (F-202 clean):

```
offer content address mismatch: terms declare sha256 bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c, payload hashes to 552193aed5a172a41bea4bee2a2d4dfcfd69f38a30952f5b7d3881b4cdbad0ee
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
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

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
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

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
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 239
```

## P-CXL — cancellation-by-spend (row 12), both forms

### stage C / `row-12a` — Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL — **MEASURED**

> cancellation: the owner withdrew 2 S_A to its own wallet; pool(S_A) 7 -> 5, and the POOLED COIN CHANGED (a65123abcb2e… -> 0c887cf9849d…) because `sendShielded` spends it and re-pools the change

| Check | Result | Detail |
|---|---|---|
| the cancelled offer was REFUSED | PASS | stage=settlement |
| the pooled coin really did move (so this is cancellation BY SPEND) | PASS | a65123abcb2eb6b1… -> 0c887cf9849dc8d0… |
| the node's code is 239 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 239
```

### stage C / `row-12b` — Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL — **MEASURED**

> intervention: AA_A transferred 3 S_A to AA_B INSIDE the Manager. AA_A's cell 5 -> 2, AA_B's cell created at 3; custody is now 1 pool(s) / 2 cells
> So FR-307(d) holds for BOTH forms the spec names, but by two different mechanisms — and only the withdraw is literally "moving the backing pool coin".

| Check | Result | Detail |
|---|---|---|
| the pooled coin is BYTE-IDENTICAL — no token operation happened | PASS | 0c887cf9849dc8d0…/52 vs 0c887cf9849dc8d0…/52 |
| the offer was refused even though no coin moved | PASS | stage=settlement |
| the code is 104 (Transcript) — the expectation, not an assertion | PASS | 104 — InvalidError::Transcript (types.rs:406) |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

Verbatim (F-202 clean):

```
1010: Invalid Transaction: Custom error: 104
```

## P-OPEN — the open-offer take (rows 7–8) — floating surplus; GREEN if it settles for a previously-unknown holder

### stage B / `row-7` — OFFER-2 built (v2 OPEN — floating surplus): give S_A 2 to no one, want S_B 3 → AA_A — **PASS**

| Check | Result | Detail |
|---|---|---|
| OFFER-2 was built and proven | PASS | 6523 ms |
| FR-302: imbalances(0) is EXACTLY +2 S_A and −3 S_B | PASS | {"shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767":"-3","shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834":"2"} |
| FR-302: no other segment carries any delta | PASS | [] |
| THE OPEN PROPERTY: the offer names NO recipient for colour A | PASS | terms.gives.recipient absent |
| THE OPEN PROPERTY, structurally: the maker process was never GIVEN a recipient — its input has no such field | PASS | maker input: {"label":"OFFER-2","managerAddress":"a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205","witness":"ownerA","shape":"floating-surplus","gives":{"colour":"bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834","value":"2"},"wants":{"colour":"2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767","value":"3"},"creditAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","makerAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","envelopeOut":"/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer","out":"/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row7-maker.report.json"} |
| FR-301: the maker attached NO DUST | PASS | — |
| FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 29621, 16346 bytes, sha 9b6929e8a59c55e1… |
| a reader with NO NETWORK sees the +A surplus the terms declare | PASS | {"0/shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834":"2"} |
| the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -3 for token Shielded(ShieldedTokenType(2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767)) in segment 0; balance must be positive |
| building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 0 vs cells 0 |
| zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 10 + pool 0 |

Verbatim (F-202 clean):

```
invalid balance -3 for token Shielded(ShieldedTokenType(2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767)) in segment 0; balance must be positive
```

### stage B / `row-8` — OwnerT — whose keys the maker never knew — takes OFFER-2 — **PASS**

> The pool for S_A is REMOVED, not zeroed: the release took the whole pooled coin, so the colour leaves the pool map entirely — while the ACCOUNT CELL stays at 0. That is why the end-state map sizes are 1 pool / 2 shielded cells / 0 unshielded, exactly as the spec's row 8 says.
> Deltas match the spec exactly; the S_B TOTALS do not, because the +7 the spec's figures carry was created by row 5 on stage A's Manager. That is deviation D-307 and nothing else.

| Check | Result | Detail |
|---|---|---|
| the OPEN swap SETTLED | PASS | 0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0 |
| ONE transaction id settled it | PASS | 0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0 |
| THE OPEN CLAIM: a wallet the maker never named SWEPT the surplus | PASS | OwnerT S_A 0 -> 2 (expected 2) |
| the taker funded the −B deficit out of its own coins | PASS | OwnerT S_B 10 -> 7 |
| pool(S_A) = absent | PASS | observed absent |
| pool(S_B) = 3 | PASS | observed 3 |
| cell AA_A/S_A = 0 | PASS | observed 0 |
| cell AA_A/S_B = 3 | PASS | observed 3 |
| cell AA_B/S_A = absent | PASS | observed absent |
| exact map sizes 1/2/0 | PASS | {"pools":1,"shieldedCells":2,"unshieldedCells":0} |
| OwnerN holds 8 S_A | PASS | observed 8 |
| the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["45106"] -> 0; full map {"1":{"spends":1,"registrations":0},"45106":{"spends":0,"registrations":0}} |
| ANOTHER intent attached the dust, so the taker really paid | PASS | other segments ["1"] -> 1 |
| the taker's own balancer swept the surplus — nothing was left unswept | PASS | {} |
| OP1 and OP2 agree on every cell | PASS | agree |
| per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 0 vs cells 0; S_B: pool 3 vs cells 3 |
| zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 10 + pool 0; S_B: minted 10 = users 7 + pool 3 |

## P-F310 — D-307's own evidence: the spec's LITERAL row 7 attempted at two custody cells must FAIL CLOSED on FR-302 (the designed-against form of lane issue 0003), replicated at F-310's deciding 1-pool/2-cell configuration

### stage A / `p-f310` — D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells — **FAIL**

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

Verbatim (F-202 clean):

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 55fcabf0eae2…): segments present: [0,28531] intent segments: [28531] fallible-offer segments: [28531] expected 0: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 28531: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 7062dc1579e3…): segments present: [0,55549] intent segments: [55549] fallible-offer segments: [55549] expected 0: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 55549: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

### stage C / `p-f310` — P-F310 replication: a FULLY BACKED offer at two custody cells — **MEASURED**

> custody configuration at the time: 1 pool(s) / 2 shielded cells. The offer gives 2 S_A with AA_A's cell at 2 and the pool at 5 — fully backed, so no guard can refuse it and placement is the only thing left.

| Check | Result | Detail |
|---|---|---|
| the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated | PASS | ok=false kind=fr302-placement-fail-closed |
| the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [27917] |
| nothing was published | PASS | — |
| NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

Verbatim (F-202 clean):

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 016b86faa3e6… / want 1 8919b48e8691…): segments present: [0,20880] intent segments: [20880] fallible-offer segments: [20880] expected 0: {"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 20880: {"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

