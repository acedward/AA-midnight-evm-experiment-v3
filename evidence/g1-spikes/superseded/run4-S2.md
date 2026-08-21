# SPIKE S2 — what causes node `Custom error: 104`? (F-301 and its revision)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T02:59:35.993Z

**VERDICT: CONFIRMED, FIX INCOMPLETE**

shape B's correlation held perfectly, but re-keying still left 12/12 refusals — segment order is A cause, not the only one. ACROSS EVERY SHAPE: ascending pairs refused 7/19, descending pairs refused 17/25 — so descending order is a NECESSARY condition for 104 in this family. Whether it is also SUFFICIENT depends on the pair: for a genuine read-after-write (shape B) it is; for disjoint pairs (shapes A+D) descending refused 3/11 and ascending 0/9, so something further is needed there. Either way the MITIGATION is the same and is deterministic: assign segments in call order, never randomly, and a descending pair can never arise.

## Shared-host guards (added after G1 run 1 was VOIDed)

G1 run 1 of this spike died under host starvation: the 1-minute load average reached **21.7 on 16 cores**
(other tenants of this shared machine), one attempt took 12.5 minutes where its neighbours took ~24 s, and
the next died with `'prove' returned an error: AbortError: The user aborted a request.` That is a starved
proof server, not a node refusal — but in an evidence table it would look exactly like one. That run is
**VOID** and none of its numbers appear anywhere. Three guards now stand between host noise and the data:

| Guard | Setting in this run | Why |
|---|---|---|
| load gate before the run and every attempt | 1-min load must be ≤ **16** (this host has 16 cores) | at load = cores the CPUs are fully committed but not oversubscribed; above it, runnable work QUEUES and the proof server starts missing its client's deadline. Waiting costs wall clock; measuring through it costs the result |
| per-attempt timeout | 240 s (healthy attempts take ~20–30 s) | one starved proof cannot stall the whole run |
| infrastructure retries | up to 3 per attempt | host noise costs wall clock, not sample size |

A failure counts as INFRASTRUCTURE only if it matches a deliberately narrow list (`AbortError`, `'prove'
returned an error`, socket errors, the timeout itself). Everything else — every node refusal, every `104` —
is recorded untouched. The guards can discard host noise; they cannot launder a real refusal. A VOID
attempt is also CHECKED against the chain afterwards, because a timeout can in principle fire after the
node already accepted the transaction; if custody moved, the attempt is reclassified as landed.

**VOID attempts are excluded from every figure below and from the N of the sample.** Each shape table
reports `attemptsRun`, `voided` and `attempts` (the counting ones) separately.

## The decode — regardless of the verdict

`104` = `InvalidError::Transcript`, `midnight-node/ledger/src/versions/common/types.rs:406`, read from the
pinned reference. Issue 0001 listed decoding 104 as step 1 of any future investigation into it. Done.
For the record `171` (issue 0002) is still undecoded — it is not in the `InvalidError` arm of that enum.

## The predicted mechanism, from source

| Step | Source |
|---|---|
| each scoped call becomes its own transaction with a RANDOM physical segment | `midnight-js-contracts/dist/index.mjs:1025` (`Transaction.fromPartsRandomized`) |
| the scope merges those transactions | `midnight-js-contracts/dist/index.mjs:1228` (`current.unprovenTx.merge(next.unprovenTx)`) |
| the ledger applies intents in ASCENDING segment order | `midnight-ledger/ledger/src/semantics.rs:1097` (`tx.intents.sorted_iter()`) |
| Segment is documented as the ledger APPLICATION ORDER index | `midnight-ledger/ledger/src/structure.rs:1826` |

All four statements are true of the pinned sources. The prediction that FOLLOWS from them is what the
experiment tests, and the sources being right does not make the prediction right.

## Why four shapes

| Shape | What it is | Why |
|---|---|---|
| A | `depositShielded(S5)` + `depositUnshielded(U5)` → AA_B | 00005's probe M3 — the shape issue 0001 is about. But its calls touch **disjoint** state (`pools`+`shieldedBalances` vs `unshieldedBalances`, sharing only the unmodified `accounts` set), so replaying them in either order is expected to work: **A has no power to detect an ordering bug** |
| B | `depositShielded(S5 → AA_B)` then `transferInternalShielded(AA_B → AA_A, S5, 1)` | a genuine read-after-write: call 2's guard `assert(shieldedBalanceOf(acct, col) >= amt)` reads the very cell call 1 wrote |
| D | shape A with a **brand-new issuer and colour pair per attempt** | every attempt is a true double lazy-init (new `pools` key + two new cells), which is what M3 actually was. It characterises **when a disjoint pair inherits** the ordering problem; it does not decide the verdict, because a disjoint pair's coupling is structural rather than a value read |
| C | **shape B** with intents re-keyed to 1,2 in CALL order | the fix, demonstrated on the shape whose mechanism is confirmed. Run only if B confirms, because demonstrating a fix for an unconfirmed mechanism is theatre |

## Shape A — INDEPENDENT pair (00005 M3: depositShielded S5 + depositUnshielded U5 -> AA_B; DISJOINT state) — 12 attempts

| # | issuer | lazy-init | call 1 seg | call 2 seg | order | re-keyed | outcome | 104 | verbatim |
|---|---|---|---|---|---|---|---|---|---|
| 1 | TOKE | true | 3597 | 15739 | ascending | — | ACCEPTED `0062f17bedac3660c82e8ea08c34179f9b965c042733c8b86ff952faebce825ca6` | — | — |
| 2 | TOKE | false | 58999 | 64772 | ascending | — | ACCEPTED `00a6b757c347371fe56327321963ecb04fa5e48a5bf06e74c5b238649ae3e9a83f` | — | — |
| 3 | TOKE | false | 41009 | 23218 | descending | — | ACCEPTED `00127f6e4b86bca5427ba1697fb31334e000cba80444f61018de7a3bd51039903b` | — | — |
| 4 | TOKE | false | 11405 | 5198 | descending | — | ACCEPTED `0032d5c0be12f43c939805cb0fa031db8fcc74a8461ea7c7fbd2d15dcf19c2155f` | — | — |
| 5 | TOKE | false | 37998 | 22519 | descending | — | ACCEPTED `00015bd381a1fbc8d289c57f5faa13086a33500022f03445a10aa4074e82623a31` | — | — |
| 6 | TOKE | false | 65476 | 28545 | descending | — | ACCEPTED `0067be1d8456e1d6e1b2bbf613a77f96a9bcb8c135813627f21decf17eefd09ab0` | — | — |
| 7 | TOKE | false | 978 | 20535 | ascending | — | ACCEPTED `0050d05fb1d8d2e68a1307a7c5564610c45415f5d725958beb705231457f5d199e` | — | — |
| 8 | TOKE | false | 61997 | 57135 | descending | — | ACCEPTED `00a0125ba20e4d4a3bb1adccf919ac57e9d6d76623e34b4fdaa787fb2e9837f73b` | — | — |
| 9 | TOKE | false | 7341 | 63233 | ascending | — | ACCEPTED `00c5bbb530581243c8f370ea90bebb4a0ede1bab9fb563fa8e5469e5c8f9b0e48b` | — | — |
| 10 | TOKE | false | 1731 | 27229 | ascending | — | ACCEPTED `0031f3f73d6bcf81d75a3b3398685c3aef75a4abd5f77524c7930c92ec7ef8fa85` | — | — |
| 11 | TOKE | false | 27025 | 9030 | descending | — | ACCEPTED `00f4e23e1a62c74de04f2da9f5f4a551afcf9c70dae7bdb37bb9a6f20bcf99fac2` | — | — |
| 12 | TOKE | false | 49361 | 28410 | descending | — | ACCEPTED `00ccaa3c79422c8c6490b2d5cfd152b10169beaad1cfee36ea089d6597833f27a5` | — | — |

Summary: `{"attemptsRun":12,"voided":0,"infraRetriesAbsorbed":0,"attempts":12,"accepted":12,"refused":0,"refusedWith104":0,"refusedBeforeSubmission":0,"ascending":{"n":5,"accepted":5,"refused":0},"descending":{"n":7,"accepted":7,"refused":0},"lazyInit":{"n":1,"accepted":1,"refused":0},"unknownOrder":0}`

## Shape B — DEPENDENT pair (depositShielded S5 -> AA_B, then transferInternalShielded AA_B -> AA_A; call 2 reads the cell call 1 wrote) — 12 attempts (THE DECIDING SHAPE)

| # | issuer | lazy-init | call 1 seg | call 2 seg | order | re-keyed | outcome | 104 | verbatim |
|---|---|---|---|---|---|---|---|---|---|
| 1 | TOKE | true | 7225 | 34028 | ascending | — | ACCEPTED `0029b67ead14fe7fc9e0650699dbd46a1e474a7acf0412c8a678dd696f0762f75a` | — | — |
| 2 | TOKE | false | 65462 | 20537 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-2': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 3 | TOKE | false | 22461 | 62875 | ascending | — | ACCEPTED `0033cc40598ed924de5100aaff7f73fa3c7dd7758d4185d6ba2a4af56a6988e106` | — | — |
| 4 | TOKE | false | 59483 | 56085 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-4': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 5 | TOKE | false | 21980 | 1414 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-5': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 6 | TOKE | false | 4217 | 40196 | ascending | — | ACCEPTED `002a89a51a4f0ad38e5079930c58d1144eebc89a7361d3986b1309ba499cc675e9` | — | — |
| 7 | TOKE | false | 56260 | 39587 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-7': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 8 | TOKE | false | 59551 | 43701 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-8': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 9 | TOKE | false | 52904 | 31216 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-9': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 10 | TOKE | false | 33239 | 22944 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-10': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 11 | TOKE | false | 57673 | 42291 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-11': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 12 | TOKE | false | 56685 | 7496 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-12': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |

Summary: `{"attemptsRun":12,"voided":0,"infraRetriesAbsorbed":0,"attempts":12,"accepted":3,"refused":9,"refusedWith104":9,"refusedBeforeSubmission":0,"ascending":{"n":3,"accepted":3,"refused":0},"descending":{"n":9,"accepted":0,"refused":9},"lazyInit":{"n":1,"accepted":1,"refused":0},"unknownOrder":0}`

## Shape D — FRESH LAZY-INIT (shape A with a brand-new issuer and colour pair per attempt: every attempt creates a new pool key and two new cells) — 8 attempts

| # | issuer | lazy-init | call 1 seg | call 2 seg | order | re-keyed | outcome | 104 | verbatim |
|---|---|---|---|---|---|---|---|---|---|
| 1 | TD01 | true | 16709 | 3287 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-fresh-lazy-init-1': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 2 | TD02 | true | 6556 | 36952 | ascending | — | ACCEPTED `004f77f47387338c98bd8ba4ed7bc3326fa2d0406e7a6502b679ac4340e91a2781` | — | — |
| 3 | TD03 | true | 6268 | 47974 | ascending | — | ACCEPTED `00b0150d7cd6396eced1c7024d0bec113a848157b3b0016d9df8e2494d3585bc6d` | — | — |
| 4 | TD04 | true | 23590 | 34927 | ascending | — | ACCEPTED `00c7e6b1c17f45f772257fc587438f01747abce9243156220e84e01a8bc6a2389f` | — | — |
| 5 | TD05 | true | 43626 | 12180 | descending | — | ACCEPTED `00825f4e2bd27dc101e344f2c373260d0ca84e877794527462103e194ddc139a3a` | — | — |
| 6 | TD06 | true | 50256 | 20761 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-fresh-lazy-init-6': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 7 | TD07 | true | 47502 | 43761 | descending | — | REFUSED | yes | `Unexpected error submitting scoped transaction 'aa00006-s2-fresh-lazy-init-7': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } | cause: Transaction submission error` |
| 8 | TD08 | true | 37705 | 63441 | ascending | — | ACCEPTED `009826cb4fba313c7e5bca225b718b47bae6e5cfc65a573e014e722092be6fc368` | — | — |

Summary: `{"attemptsRun":8,"voided":0,"infraRetriesAbsorbed":0,"attempts":8,"accepted":5,"refused":3,"refusedWith104":3,"refusedBeforeSubmission":0,"ascending":{"n":4,"accepted":4,"refused":0},"descending":{"n":4,"accepted":1,"refused":3},"lazyInit":{"n":8,"accepted":5,"refused":3},"unknownOrder":0}`

Order breakdown over this constant-lazy-init population:

| order | n | refused |
|---|---|---|
| descending | 4 | 3 |
| ascending | 4 | 0 |

## The headline number — is descending order NECESSARY?

Pooling every attempt of every shape in this run:

| segment order | attempts | refused |
|---|---|---|
| ascending (call 1 < call 2) | 19 | **7** |
| descending (call 1 > call 2) | 25 | **17** |

An ascending pair is the case where the ledger happens to apply the two calls in the order they were
built. A refusal count of zero there, over a decent N, is the strong form of the claim: **descending
segment order is a NECESSARY condition for error 104 in this shape family.** Sufficiency is shape-
dependent (see shapes A/B/D above), but necessity is what makes the mitigation deterministic rather
than statistical: assign the segments in call order and a descending pair cannot arise at all.

## Shape C — THE FIX (shape B with the merged intents re-keyed to segments 1,2 in CALL order before proving) — 12 attempts

The merged transaction is still unproven and unbound at the moment it is re-keyed, which is the only
point where `Transaction.intents` may be written: the ledger-9 setter refuses a bound transaction and
recomputes the binding randomness itself (`midnight-ledger/ledger-wasm/src/tx.rs:1150-1180`).

| # | issuer | lazy-init | call 1 seg | call 2 seg | order | re-keyed | outcome | 104 | verbatim |
|---|---|---|---|---|---|---|---|---|---|
| 1 | TOKE | false | 7396 | 7422 | ascending | {"from":[7396,7422],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-1': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 2 | TOKE | false | 37769 | 64385 | ascending | {"from":[37769,64385],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-2': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 3 | TOKE | false | 3235 | 9149 | ascending | {"from":[3235,9149],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-3': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 4 | TOKE | false | 45508 | 17492 | descending | {"from":[45508,17492],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-4': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 5 | TOKE | false | 61699 | 38872 | descending | {"from":[61699,38872],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-5': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 6 | TOKE | false | 33175 | 4430 | descending | {"from":[33175,4430],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-6': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 7 | TOKE | false | 7032 | 31918 | ascending | {"from":[7032,31918],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-7': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 8 | TOKE | false | 30257 | 61195 | ascending | {"from":[30257,61195],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-8': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 9 | TOKE | false | 45565 | 9965 | descending | {"from":[45565,9965],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-9': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 10 | TOKE | false | 41156 | 17963 | descending | {"from":[41156,17963],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-10': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 11 | TOKE | false | 8357 | 27127 | ascending | {"from":[8357,27127],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-11': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |
| 12 | TOKE | false | 48900 | 52973 | ascending | {"from":[48900,52973],"to":[1,2]} | REFUSED | — | `Unexpected error submitting scoped transaction 'aa00006-s2-dependent-fixed-12': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235 } } | cause: Transaction submission error` |

Summary: `{"attemptsRun":12,"voided":0,"infraRetriesAbsorbed":0,"attempts":12,"accepted":0,"refused":12,"refusedWith104":0,"refusedBeforeSubmission":0,"ascending":{"n":7,"accepted":0,"refused":7},"descending":{"n":5,"accepted":0,"refused":5},"lazyInit":{"n":0,"accepted":0,"refused":0},"unknownOrder":0}`

## Bookkeeping — refusals created nothing

| Cell | expected | observed | match |
|---|---|---|---|
| AA_B S5 | 12 | 12 | true |
| AA_B U5 | 12 | 12 | true |
| AA_A S5 | 3 | 3 | true |

Per-attempt cells for the fresh shapes (each accepted attempt must have credited its OWN colours with
exactly 1, each refused attempt with 0):

| shape | # | tag | accepted | shielded cell | unshielded cell | ok |
|---|---|---|---|---|---|---|
| fresh-lazy-init | 1 | TD01 | false | 0 | 0 | true |
| fresh-lazy-init | 2 | TD02 | true | 1 | 1 | true |
| fresh-lazy-init | 3 | TD03 | true | 1 | 1 | true |
| fresh-lazy-init | 4 | TD04 | true | 1 | 1 | true |
| fresh-lazy-init | 5 | TD05 | true | 1 | 1 | true |
| fresh-lazy-init | 6 | TD06 | false | 0 | 0 | true |
| fresh-lazy-init | 7 | TD07 | false | 0 | 0 | true |
| fresh-lazy-init | 8 | TD08 | true | 1 | 1 | true |

Custody map sizes {"pools":0,"shieldedCells":0,"unshieldedCells":0} → {"pools":6,"shieldedCells":7,"unshieldedCells":6}.
A refusal that had partially landed would break one of these equalities, so this table doubles as the
state-neutrality proof for every refused attempt in every shape.

## What this means for issue 0001

Written into `contract-token-custody-6d6cd3/AA/issues/0001-composed-tx-first-attempt-refused.md` in the
organizer tree, together with the decode and the refuted/confirmed status of the mechanism.

