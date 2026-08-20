# 00006-unbalanced-zswap — final report

`EXPERIMENTAL_LANE / LANE-DEV-1`

**Contract custody as the MAKER of an atomic swap.** The Manager emits a proven, serialized
transaction whose net custody effect is **−A +B with zero DUST attached**, which is refused if
submitted alone, and which one independent stock wallet balances (**+A −B, all DUST**) and lands
under **ONE transaction id**. Two halves are reported, never conflated: **v1**, a named taker,
and **v2**, the OPEN offer — usable by a holder whose keys the maker never knew, which is the
owner's REQUIRED outcome (spec FR-308, owner Q1 2026-08-19).

Generated 2026-08-20T16:38:38.239Z from retained evidence in `evidence/`. Nothing in this
report is restated by hand; every figure is read from the file named beside it.

## The two headline results

### v1 — the named-taker settlement (spec row 5, stage A) — **PASS**, 20/20 checks

| What | Measured |
|---|---|
| transaction ids | **1** — `00a3036cec400892e7094212b30796f7fec39982859dfcead5604cb4cee6e73bcb` |
| custody pool S_A | observed 2 |
| custody pool S_B | observed 7 |
| maker account cells | S_A observed 2, S_B observed 7 |
| exact map sizes | {"pools":2,"shieldedCells":2,"unshieldedCells":0} |
| taker wallet | S_A observed 4, S_B observed 3 |
| maker's per-intent DUST spends | maker segments ["6653"] -> 0 dust spends; full map {"1":{"spends":1,"registrations":0},"6653":{"spends":0,"registrations":0}} |
| who paid | other segments ["1"] -> 1 dust spends |
| nothing left unswept | {} |
| two observation points agree | agree |
| maker and taker were different OS processes | taker pid 37604 vs maker pid 37354 |

### v2 — the OPEN offer, settled by a stranger (spec rows 7–8, stage B) — **PASS**, 18/18 checks

**FR-308 openness is GREEN**, via the PREFERRED floating-surplus shape (FR-308 v2a).

| What | Measured |
|---|---|
| transaction ids | **1** — `00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164` |
| the offer named no recipient at all | terms.gives.recipient absent |
| placement, FR-302 | {"shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532":"2","shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2":"-3"} |
| pool S_A | observed absent |
| pool S_B | observed 3 |
| exact map sizes | {"pools":1,"shieldedCells":2,"unshieldedCells":0} |
| the stranger swept the surplus | OwnerT S_A 0 -> 2 (expected 2) |
| maker's per-intent DUST spends | maker segments ["47625"] -> 0; full map {"1":{"spends":1,"registrations":0},"47625":{"spends":0,"registrations":0}} |

The claim "a wallet the maker never knew" is CHECKABLE rather than asserted: the maker process
runs in its own OS process, its input is retained verbatim in the evidence, and that input carries
no recipient field of any kind.

## Read this before quoting anything above: what is NOT claimed

### Deviation D-307 — the step ledger ran PARTITIONED across three fresh Managers

**Cause.** F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

**Preserved.** every row, control and probe runs with the spec's exact amounts and assertions, in one scripted run on one chain; the final table is asserted per stage with the mapping recorded.

**NOT claimed.** this is NOT the spec's literal single-Manager 13-row table, and it is never presented as one. No claim is made that a 13-row single-Manager sequence is reachable at these pins — the opposite is measured, by P-F310.

**Why three.** rows 5 and 8 each require a settlement and a settlement exhausts the budget, so TWO Managers are unavoidable. The third keeps the refusal-only negatives from interleaving with — and destroying — the live offers rows 5 and 8 must settle. A two-stage packing is arithmetically possible and was rejected: it would make the owner-REQUIRED rows 7–8 depend on five prior interventions each landing exactly right.

**Status as recorded by the run.** owner ratification wanted as a spec amendment — Plan 03 question Q03-1. The spec file is byte-identical.

**Status now (owner decision, 2026-08-20): D-307 STANDS AS THE RECORD** — "record what really was
tested", with a full re-run left for later. The line above is what the run itself wrote, kept
verbatim because it is generated from the same committed expectation table the run asserted
against; the decision supersedes only its last clause. The spec file remains byte-identical.

| Stage | Manager | Carries | Verdict | Rows | Checks |
|---|---|---|---|---|---|
| **A** | `1f8f7b515d8da4614829…` | rows 0–6, row 10 (NC-304), NC-305, P-F310 | GREEN | 12 | 116 |
| **B** | `95fb94dc5df1d640705f…` | rows 7–8 (P-OPEN — the owner-REQUIRED open offer) | GREEN | 3 | 44 |
| **C** | `f6eb885f4760142781e6…` | rows 9 (NC-303), 11 (P-104), 12 (P-CXL, both forms), NC-306, P-F310 replication | GREEN | 8 | 57 |

### The two owner questions this project raised — both now decided (2026-08-20)

| Question | What it asked | Owner decision |
|---|---|---|
| **Q02-2** | F-310: an offer is publishable only while custody holds ONE shielded cell. Accept the limit, or reduce the circuit's transcript cost and re-measure? | **Measure the alternatives.** A follow-up measurement plan (Plan 05, "F-310 mitigation rig") runs five contract variants against two use cases — self-merge and published-file — at custody sizes past the current boundary. **The Manager v4 shipped here does not change**, and productizing any winner is a separate numbered project with its own spec |
| **Q03-1** | ratify D-307 — the ledger ran per-stage, not as one 13-row single-Manager sequence | **D-307 stands as the record**: "record what really was tested", with a full re-run left for later. The spec file stays byte-identical and this report is that record |

So nothing in this report is waiting on a decision. What is *not* settled is the engineering
question behind Q02-2 — whether transcript cost can be cut far enough to lift the one-cell
boundary — and that is a measurement, now scheduled, not an unknown in what was proven here.

### The lane

This is an **EXPERIMENTAL_LANE** result under deviation **LANE-DEV-1**, on pins inherited from
00005 and never re-pinned (proven hop by hop at every gate: 00003 `a8ebff9` → 00004 `f066a09` →
00005 `e9701e9` → here). Nothing here extrapolates to a supported or production lane, and no
statement about node, ledger, indexer or SDK behaviour may be read from the two HOST workarounds
(W-1, W-2) described at the end of this report.

## The specification's step ledger, row by row, as it ran

Overall: **GREEN** — 23 run rows, 217 checks, 0 failing.

| Spec row | Action | Stage | Run row | Status | Checks | As run (only where D-307 changes it) |
|---|---|---|---|---|---|---|
| 0 | Manager v4 deployed; AA_A, AA_B registered | A | `row-0` | PASS | 4/4 | run three times — once per stage — because each stage needs its own ≤1-cell budget (F-310) |
| 1 | Minters TOKA, TOKB deployed; mint S_A 10 → OwnerN; mint S_B 10 → OwnerT | A | `row-1` | PASS | 10/10 | per stage, with that stage's own fresh colours; stage C mints S_A 12 so its five negatives each have a give to make |
| 2 | OwnerN deposits S_A 6 → AA_A | A | `row-2` | PASS | 11/11 | — |
| 3 | OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 credited to AA_A; proven; serialized to file; no DUST | A | `row-3` | PASS | 12/12 | — |
| 4 | OFFER-1 submitted DIRECTLY (unbalanced) | A | `row-4` | PASS | 7/7 | submitted by a THIRD process holding nothing but the envelope file and its own seed, in two forms (unbound as published, and bound) — plus the ledger's own offline `wellFormed` verdict |
| 5 | OwnerT takes OFFER-1: stock balance → merge → submit | A | `row-5` | PASS | 20/20 | maker DUST spend 0 is read from the settled transaction's PER-INTENT dust actions, not from `dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably paying fees (Plan 02 S6) |
| 6 | Double-take: OFFER-1 balanced and submitted again | A | `row-6` | PASS | 6/6 | preceded by ONE labelled fixture mint of S_B 7 to OwnerT: after row 5 the taker holds only 3 S_B and could not balance at all, so the refusal would come from its own wallet instead of the NODE. The spec's v1-only final table is asserted BEFORE the fixture, where it applies |
| 7 | OFFER-2 built (v2 OPEN shape — floating surplus): give S_A 2 to no one the maker knows, want S_B 3 to AA_A | B | `row-7` | PASS | 13/13 | on a FRESH Manager whose AA_A holds exactly 2 S_A, so the give is the pool's whole balance and row 8's "pool removed" is reproduced exactly. The spec's literal row 7 is ALSO attempted on Manager #1 at two cells, where it fails closed — that is P-F310, the deviation's own evidence |
| 8 | OwnerT — whose keys the maker never knew — takes OFFER-2 | B | `row-8` | PASS | 18/18 | the S_B TOTALS differ (absent→3, AA_A 0→3) because the +7 they carry happened on Manager #1. Every DELTA (−2 S_A with the pool REMOVED, +3 S_B, OwnerT +2/−3, maker dust 0) and the exact end-state map sizes 1/2/0 are reproduced identically |
| 9 | Expiry negative: OFFER-3 (small give) held past its TTL, then taken | C | `row-9` | PASS | 9/9 | the intent TTL is rewritten to 120 s while the transaction is still UNPROVEN (F-306: rewriting a PROVEN transaction's intents invalidates its zswap proofs), because midnight-js hardcodes `ttlOneHour()` and the literal form costs an hour per observation. BOTH layers measured: the taker's own gate refuses OFFLINE, and with that gate forced off the node refuses with 228 |
| 10 | Tamper negative: OFFER-1's retained bytes, one byte flipped, taken | A | `row-10` | PASS | 7/7 | TWO arms. (a) the flip alone is refused OFFLINE by the envelope's content-address check, before a wallet, a proof server or a node is contacted — STRONGER than the node refusal the spec anticipated, and recorded as such. (b) the flip with the content address REPAIRED reaches the layer the spec named |
| 11 | Staleness probe (FR-311): OFFER-4 built on a live colour, then an ordinary deposit lands on that colour, then OFFER-4 taken | C | `row-11` | MEASURED | 6/6 | the MEASURED code is 239 = ZswapInvalidErrorCode::NullifierAlreadyPresent, not the predicted 104 (finding F-309, 3/3 in Plan 02): an ordinary deposit MERGES the pooled coin and merging SPENDS it, so the offer's pinned coin is already nullified. FR-311 asks for the measured rule, so the measured rule is asserted and the divergence recorded |
| 12 | Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken | C, C | `row-12a`, `row-12b` | MEASURED, MEASURED | 7/7, 7/7 | BOTH forms the spec names are measured separately, because they are not the same mechanism: a WITHDRAW spends the pooled coin, while `transferInternalShielded` performs NO token operation at all (the pooled coin is byte-identical afterwards) and can only invalidate an offer through the account cell its transcript read |

### The specification's final table

Asserted PER STAGE under D-307: stage A's closing state matches the v1-only column (in parentheses in the spec) at the moment row 5 lands, and stage B reproduces every DELTA of the v2 column plus the exact end-state map sizes 1/2/0.

|  | S_A | S_B |
|---|---|---|
| OwnerN | 4 | 0 |
| OwnerT | 6 (4) | 0 (3) |
| AA_A | 0 (2) | 10 (7) |
| pool | 0 (2) | 10 (7) |

End-state map sizes: 1 pool (2), 2 shielded cells, 0 unshielded — exactly. Stage A's v1-only assertion:
`final-table-v1` PASS
(12/12 checks). Stage B reproduces every DELTA of the v2
column plus the exact end-state map sizes: `row-8` {"pools":1,"shieldedCells":2,"unshieldedCells":0}.

## Negative controls and probes

Every refusal below carries a verbatim, F-202-clean error, a funds-unchanged proof and a
no-state-created proof (all three custody map SIZES plus the specific absent cells, named).

| Control | What it asserts | Run row(s) | Status | Node code(s) | Verbatim (first line, truncated) |
|---|---|---|---|---|---|
| **NC-301** | direct submission of the unbalanced maker tx refused (row 4) | `row-4` (A) | PASS | 1 | invalid balance -7 for token Shielded(ShieldedTokenType(94144f1ff0b060425ddc65bb2c4740255fd306efa64463fc14350c… |
| **NC-302** | double-take refused after settlement (row 6) | `row-6` (A) | PASS | 244 | 1010: Invalid Transaction: Custom error: 244 |
| **NC-303** | expiry refused past TTL (row 9) | `row-9` (C) | PASS | 228 | offer expired 35 s ago (expiresAt 2026-08-20T12:52:50.044Z); refused locally without contacting the chain |
| **NC-304** | tamper refused (row 10) | `row-10` (A) | PASS | — | offer content address mismatch: terms declare sha256 dde0ba1517179aae815ec60bf334d7d10bb050d50ac4772ed18e2a1da… |
| **NC-305** | unauthorized make: OwnerN's witness (unregistered for AA_A) attempts to open an offer on AA_A's S_A | `nc-305` (A) | PASS | — | failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'openSwap… |
| **NC-306** | unbacked make: an offer giving more S_A than AA_A's cell holds while the pool WOULD cover it via another account | `nc-306` (C) | PASS | — | failed assert: account colour balance too low \| cause: Error executing circuit 'openSwapShielded' |
| **P-104** | staleness probe (row 11) — measured lane behaviour, FR-311 | `row-11` (C) | MEASURED | 239 | 1010: Invalid Transaction: Custom error: 239 |
| **P-CXL** | cancellation-by-spend (row 12), both forms | `row-12a` (C), `row-12b` (C) | MEASURED, MEASURED | 239, 104 | 1010: Invalid Transaction: Custom error: 239 |
| **P-OPEN** | the open-offer take (rows 7–8) — floating surplus; GREEN if it settles for a previously-unknown holder | `row-7` (B), `row-8` (B) | PASS, PASS | — | invalid balance -3 for token Shielded(ShieldedTokenType(bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b83… |
| **P-F310** | D-307's own evidence: the spec's LITERAL row 7 attempted at two custody cells must FAIL CLOSED on FR-302 (the designed-against form of lane issue 0003), replicated at F-310's deciding 1-pool/2-cell configuration | `p-f310` (A), `p-f310` (C) | MEASURED, MEASURED | — | FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 586d312ace6d… / want 3 94144f1ff0b0…): se… |

### The refusal codes this project decoded (finding F-309, extended by F-311)

All read from the pinned node source `midnight-node/ledger/src/versions/common/types.rs`, not
guessed from behaviour:

| Code | Meaning | Where it was observed here |
|---|---|---|
| **1** | `DeserializationError::Transaction` (`:358-372`) | the published UNBOUND offer submitted alone — the node cannot even READ it as a transaction (F-311) |
| **104** | `InvalidError::Transcript` (`:406`) | cancellation by INTERNAL TRANSFER, where the pooled coin never moved |
| **228** | `MalformedError::TransactionApplication(IntentTtlExpired)` (`:487`) | an offer taken after its intent TTL passed |
| **239** | `ZswapInvalidErrorCode::NullifierAlreadyPresent` (`:400`) | staleness (an intervening deposit MERGED the pooled coin) and cancellation by WITHDRAW |
| **244** | `InvalidError::ReplayProtectionViolation(IntentAlreadyExists)` (`:411-414`) | the DOUBLE TAKE (NC-302) — see the note below: this is replay protection, not the spent coin |
| 242 | `InvalidError::ReplayProtectionViolation(IntentTtlExpired)` (`:411-412`) | decoded while reading; the second TTL code, not observed here |
| 235 | `MalformedZswapErrorCode::InvalidProof` (`:446`) | decoded by spike S2 — a re-keyed merged transaction (F-306) |

**The double take is refused by REPLAY PROTECTION, not by the spent backing coin (F-312).** The
specification's row 6 predicts "REFUSED (backing coin spent)" and the refusal is real and
state-neutral — but the code the node returns is `244` =
`ReplayProtectionViolation(IntentAlreadyExists)`, so the check that fires first is that the maker's
INTENT is already in the replay-protection state, before the nullifier of the pooled coin is ever
consulted. Two independent mechanisms would each refuse it; the lane tells us which one is in front.
Recorded because a reader comparing NC-302 (`244`) with the staleness probe (`239`) would otherwise
think one of them is wrong.

**FR-311 predicted `104` for the staleness case and the lane answers `239`.** That is a sharper
answer, not a failed prediction: 104 says "a transcript did not match", while 239 names the
mechanism — an ordinary deposit MERGES the pooled coin, merging SPENDS it, so the coin the offer
pinned is already nullified when a taker arrives. FR-311 asks for the measured rule, so the
measured rule is what is asserted, with the divergence recorded rather than smoothed over.

**The two cancellation forms the spec names are NOT one mechanism** (spec row 12, measured
separately here): the WITHDRAW moved the pooled coin (dae9843f24eaef2a… -> 8f5330048066432c…)
and the offer died with 239, while the INTERNAL TRANSFER left the pooled coin byte-identical
(8f5330048066432c…/51 vs 8f5330048066432c…/51) and the offer still died, with 104.
Only the withdraw literally "moves the backing pool coin"; the internal transfer can only have
invalidated the offer through the account cell its transcript read.

## The spikes, and what each one settled

| Spike | Question | Verdict | Evidence |
|---|---|---|---|
| **S1** (G1) | can a FOREIGN wallet balance and submit a contract-call transaction? | GREEN | `g1-spikes/s1-foreign-balance.json` |
| **S2** (G1) | is node code 104 caused by descending merged segment order? (feeds sibling issue 0001) | CONFIRMED — but the POST-HOC fix is REFUTED AS IMPLEMENTED | `g1-spikes/s2-segment-order.json` |
| **S3** (G1) | bound or unbound — which artifact form does an offer publish as? | GREEN → **D-306 = UNBOUND (`pre-binding`)** | `g1-spikes/s3-offer-roundtrip.json` |
| **S4** (G2) | can a holder whose keys the maker never knew settle a FLOATING-SURPLUS offer? | GREEN | `g2-spikes/s4.json`, `OPENNESS.md` |
| **S4b** (G2) | the bearer-key fallback | **NOT RUN** — S4 was GREEN and FR-308 needs either shape, not both | `g2-spikes/S4b.md` |
| **S5b** (G2) | WHICH offers are publishable at all? (lane issue 0003) | MEASURED — the publishability boundary lies between step 1 (pools 1, cells 1) and step 2 (pools 1, cells 2) | `g2-spikes/s5b.json` |
| **S5** (G2) | the staleness window and TTL behaviour (FR-311) | MEASURED — as FR-311 predicted | `g2-spikes/s5.json` |
| **S6** (G2) | does the maker really pay nothing? | GREEN | `g2-spikes/s6.json` |

**A wording caveat on S5's verdict string**, which is quoted above exactly as the evidence records
it: "as FR-311 predicted" means FR-311 asked for a MEASUREMENT and got one. The measured refusal
code is `239`, **not** the `104` FR-311 named — the divergence is stated in the spike's own file, in
finding F-309, and in this report's refusal-code section.

### Fees, measured against something rather than remembered (S6)

| Measurement | Value |
|---|---|
| a plain shielded transfer by the same wallet on the same stack | 318449910941988 SPECKs |
| the merged swap settlement | 965879907293241 SPECKs |
| ratio | **3.03×** a plain transfer |
| the OFFER'S OWN `fees()` figure vs the fee actually paid | "2.00" |
| maker's per-intent dust spends in the settled transaction | **0** |
| every other intent's dust spends | 1 |
| `FeeCalculation(OutsideTimeToDismiss)` cliff | false |

**A trap worth carrying forward:** the offer's own `fees()` is NOT the settlement fee and must
never be quoted as a price. The fee that is paid belongs to the MERGED transaction, whose size the
maker cannot know in advance. Here it errs high, which is merely wasteful; erring low would leave a
taker short at submission.

**And the maker-pays-nothing claim is structural, not inferential.** `dustBalance` reads 0 for
every wallet on this lane — including wallets demonstrably paying fees — so a "maker dust
unchanged" assertion would have passed trivially. What is asserted instead is the settled
transaction's PER-INTENT dust actions, and the maker COULD have paid: it holds NIGHT registered
for dust generation, byte-identical before and after the settlement.

## Findings — the reusable half of this project

### F-310 — a swap offer is only PUBLISHABLE while the Manager holds ONE shielded custody cell

The hard one, and the constraint that governs what any demonstration on this lane can show.
Measured as a dose-response, one deposit at a time, an offer built at every step (`g2-spikes/s5b.json`); the boundary lies between step 1 and step 2:

| Step | What changed | Pools | Shielded cells | Named-taker | Floating-surplus |
|---|---|---|---|---|---|
| 1 | deposit 8 G to AA_A — the state S4/S6 published from | 1 | 1 | **GUARANTEED** | **GUARANTEED** |
| 2 | deposit 2 G to AA_B — ONE MORE CELL, pool count unchanged | 1 | 2 | FALLIBLE | FALLIBLE |
| 3 | deposit 2 F1 to AA_A — ONE MORE POOL | 2 | 3 | FALLIBLE | FALLIBLE |
| 4 | deposit 2 F2 to AA_A — ONE MORE POOL | 3 | 4 | FALLIBLE | FALLIBLE |

Boundary, in the spike's own words: **between step 1 (pools 1, cells 1) and step 2 (pools 1, cells 2)**. Monotone; both offer shapes flip
together; every offer BUILT and failed only on placement, so nothing else is being measured. Step 2
is the load-bearing row — it adds a CELL with the pool count held at 1, so a second cell is
*sufficient* on its own to cross the boundary. Whether pool count alone would also cross it was NOT
isolated (steps 3–4 grow both) and is not claimed.

**Mechanism**, read from the pinned ledger rather than inferred: the guaranteed/fallible split is
`partition_transcripts` (`midnight-ledger/ledger/src/construct.rs:1009`) and it is a COST BUDGET —
sections are cut at `Op::Ckpt`, the budget comes from `params.limits.min_time_to_dismiss` (15 ms)
less a per-transaction reserve, and **if no section fits, ZERO are guaranteed**. A larger custody
map means deeper Merkle paths and more hashing per read, so one extra cell is enough to cross it.
A fallible-section offer is unsettleable by any independent taker (balancing is per (token,
segment) and a taker can only reach segment 0), so such an offer is not publishable at all —
which is why FR-302 fails closed rather than publishing it.

**The obvious lever is not safe.** `kernel.checkpoint()` would give the partitioner a place to cut,
but a checkpoint does not reduce cost — and every cut inside this circuit breaks the atomicity that
is the product requirement: if the fallible half failed, the zswap legs would have applied while the
custody cells went unwritten, i.e. custody would lose colour A without debiting the account. **A
partially-applied swap is worse than an unpublishable one.** Rejected with reason, not deferred.

**The safe lever is transcript COST, and it is real but unquantified** — `openSwapShielded`
re-reads the same map entries several times. Deduplicating is semantics-preserving and might buy
one cell or ten; only measuring tells. That was owner question **Q02-2**, deliberately not taken
unilaterally here, because it changes the contract the owner-REQUIRED openness result rests on —
and the owner has since decided to **measure the alternatives** in a follow-up rig (Plan 05) whose
binding constraint is that the Manager v4 shipped in this PR does not change.

### F-308 — lane issue 0003, observed live: placement is state-dependent, and FR-302 caught it

An offer's value leg goes to the FALLIBLE section once the wanted colour already has a pool,
because `claimWantedColour` takes its merge branch (a second zswap input, a second nullifier claim
and another Merkle-path read) and that pushes the transcript past the guaranteed budget. The build
FAILED CLOSED, the offer was never published, and the transcript was retained. This is the failure
the whole FR-302 apparatus was built against, behaving exactly as designed — and it is why the
assert exists at all: **placement must be asserted per offer, never assumed.**

### F-307 — a contract DEPLOY budget on this lane is about THIRTEEN provable circuits

Manager v4 was first written as TWO new circuits. It compiled, produced verifier keys and passed
the whole offline suite — and was then refused **on deploy, 4/4 across spaced attempts**, with
`1010: Invalid Transaction: Transaction would exhaust the block limits`. A bracket of four probe
contracts deployed live measured the ceiling (`g2-deploy-budget/DEPLOY-BUDGET.md`): the dominant
dimension for a deploy is `bytesWritten`, whose per-block ceiling is 50 000, and what dominates it
is the VERIFIER KEYS — one per provable circuit. 13 circuits deploy at 60.1% of the ceiling; 14 do
not, at 64.7%. Manager v3 already had 12, so v4's budget was exactly ONE new circuit, and the two
FR-308 shapes were merged into one whose `recipientA: Maybe<Either<…>>` argument selects them.

**Neither FR-308 half is weakened by the merge**: both shapes are implemented, both are separately
measured offline down to "the two branches differ in EXACTLY one zswap output" (its own test), and
both are separately reported. **The consequence for the series is the more important half:** the
Manager is now AT its ceiling, so any future plan that says "add circuits X, Y, Z" must be costed
before it is written — `harness/src/g2/diag-deploy-cost.ts` does it offline, from the compiled
artifacts, in seconds, with no chain, wallet or proof server.

### F-301 / F-306 — node code 104, and why the cheap fix does not work

Spike S2's verdict: **CONFIRMED — but the POST-HOC fix is REFUTED AS IMPLEMENTED**.
`104` = `InvalidError::Transcript` (`types.rs:406`), which closes step 1 of sibling issue 0001's
own investigation plan. The mechanism is read from four pinned sources: `fromPartsRandomized` gives
each scoped call a RANDOM physical segment, the scope merges them, and the ledger applies intents in
ASCENDING SEGMENT order — so a merged pair runs in segment order, not call order. Measured: for a
genuine read-after-write, ascending is accepted and descending is refused with 104; descending order
is therefore NECESSARY, and for a dependent pair also sufficient. For a DISJOINT pair it is
necessary but not sufficient, and refusals concentrate on attempts that create new map keys.

**The post-hoc fix is UNRELIABLE — and finding that out cost two runs (F-306, amended).** Re-keying
a merged, unproven, unbound transaction's intents into call order is accepted by the wasm setter,
and then:

- in the canonical G1 run the node **refused it 12/12** with `Custom error: 235` =
  `MalformedZswapErrorCode::InvalidProof`, *including* on originally-ascending draws that would have
  been accepted untouched;
- in **this project's own clean-clone reproduction**, running the identical spike source, the node
  **accepted it 12/12**, with five of the twelve draws descending.

Both runs were internally deterministic and neither had a VOID. So "a merged transaction's segments
cannot be rewritten" is **false as an absolute** — the rewrite is valid or fatal **depending on
state**, which for a mitigation is worse than a clean refusal, because it passes in a small state
and fails in a large one.

**The mechanism is the SAME cost budget as F-308/F-310**, which is what makes this worth carrying:
the re-keying helper moves the intents and, *only if they exist*, the `fallibleOffer` entries keyed
by those segments. Zswap items in the GUARANTEED section (segment 0, which a re-key never touches)
mean no proof moves — accepted. Items in the FALLIBLE section mean proofs bound to their segment are
moved — `235`. Which holds is `partition_transcripts`' state-dependent decision. Circumstantial
support from the two runs' own bookkeeping: the shape that creates a fresh pool plus two cells per
accepted attempt landed **7 of 8** accepted before the rewrite attempts in the canonical run versus
**1 of 8** in the reproduction, so the canonical run rewrote against a much larger custody map.
**This is a labelled HYPOTHESIS**: the discriminating measurement (placement per rewrite attempt)
was not taken, and the harness could take it in one run.

The conclusion is unchanged in direction and stronger in force: **segment assignment is a BUILD-TIME
decision on this lane** and the mitigation belongs upstream, in `midnight-js-contracts`, where each
scoped call is constructed. 00006 itself is not exposed either way — its maker transaction is a
SINGLE call.

### F-303 / F-304 — two SDK caveats anyone reusing this harness will hit

- **F-303: `validateTransaction` cannot validate a CONTRACT-CALL transaction on this lane, and its
  refusal is a FALSE NEGATIVE.** The pinned facade validates against a BLANK `LedgerState`, so no
  deployed contract exists in the reference state and `wellFormed` rejects any transaction that
  calls one — with the verbatim `call to non-existant contract ContractAddress(…)` — while the very
  same transaction is then accepted by the node and commits. FR-303 names this step in the taker
  pipeline, so it is run and RECORDED, and it **never gates**: a fail-closed reading of FR-303 as
  literally written would refuse every offer this project exists to settle.
- **F-304: `Transaction.segments()` is not bound to JS.** `tx.segments` is `undefined`, so
  `tx.segments?.() ?? [0]` silently degrades FR-302 to "segment 0 looks right" and would MISS a leg
  parked in a fallible segment — exactly the failure lane issue 0003 says to expect. The harness
  computes the same union from the two maps that ARE bound (`segmentsOf`). Use it; never
  `tx.segments()`.

### F-311 — NC-301 is sharper than the specification expected

Row 4 records **three** refusals at three different layers, and they do not overlap:

| Layer | Verbatim |
|---|---|
| the LEDGER, offline | `invalid balance -7 for token Shielded(ShieldedTokenType(94144f1ff0b060425ddc65bb2c4740255fd306efa64463fc14350cc3d5ba8096)) in segment 0; balance must …` |
| the NODE | `[as-published (unbound, D-306)] 1010: Invalid Transaction: Custom error: 1` |
| the facade | `[bound] Transaction submission error` |

The node refuses the artifact AS PUBLISHED with code `1` — a DESERIALIZATION error — which is what
D-306's pre-binding form implies: a `Transaction<…, PreBinding>` is not a submittable object and the
node says so before it ever looks at balances. The offline ledger reading is the one that says WHY
the offer needs a taker. For the BOUND form the facade wrapper yields no numeric code, so **the
layer is not claimed** for that one.

### F-302 / F-305 — two inherited-tree facts

- **F-302:** the inherited harness does not typecheck at the base commit (one pinned-TYPES defect in
  `harness/src/wallet.ts`). Handled by `scripts/typecheck.sh`, which subtracts exactly that ONE
  baseline error, fails on anything else, and **also fails if the baseline stops reproducing** — so
  the tolerance cannot quietly widen. 00006 adds zero type errors.
- **F-305:** two shielded deposits of the SAME colour cannot be built in one contract-scoped batch
  (the second needs the first coin's Merkle index, which is allocated only on real insertion). The
  swap circuit fuses withdraw and deposit into ONE circuit, so it is unaffected — and
  `colourA != coinB.color` is now an explicit guard, so a same-colour swap fails closed with a
  readable reason instead of dying inside the proving path.

## Decisions taken from evidence

| Decision | Taken | Why |
|---|---|---|
| **D-306** — published artifact form = UNBOUND (`pre-binding`) | Plan 01 spike S3, cross-checked against S1 | the unbound form round-trips byte-identically, keeps FR-302 placement, and S1 settled it through `balanceUnboundTransaction` — the same entry point the pinned SDK's own shielded-swap e2e test uses. It also leaves the taker free to merge without the maker having frozen the transaction, which is what makes an OPEN offer possible at all. The bound form ALSO works and is recorded as the fallback. |
| **D-307** — the ledger is partitioned across three fresh Managers | Plan 03, forced by F-310 | F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built |

## Host workarounds — both HOST-scoped, neither a lane property

- **W-1**: a scratch `DOCKER_CONFIG` for every gate, because a credential helper can hang.
- **W-2**: every gate wrapper re-execs itself under `caffeinate -is`. This Mac idle-slept mid-gate,
  and a 40-minute gate is almost all waiting, so it presents no user activity and the idle timer
  fires. What comes back is not a clean failure: sockets drop mid-request and the SDK reports
  whatever it was doing (e.g. `AbortError: The user aborted a request.`), which is
  **indistinguishable from a real refusal in an evidence table** — which is why this is worth a
  workaround rather than a retry. Scope: a process wrapper around the gate's own process tree. No
  system setting is written, no `pmset` value changed, the assertion disappears when the gate exits,
  and no pin, step, contract or piece of evidence was altered for it. It changes WHEN the machine
  sleeps, not WHAT is executed or asserted.

## Gate runs (each gate is green only on exit 0 INCLUDING teardown)

| Gate | Wrapper | Started (UTC) | Finished (UTC) | Steps | Wall of steps | Teardown | final_exit |
|---|---|---|---|---|---|---|---|
| **G1** | `scripts/g1/verify-g1-spikes.sh` | 2026-08-20T03:04:35Z | 2026-08-20T03:44:56Z | 18 | 40 min | exit 0 | **0** |
| **G2** | `scripts/g2/verify-g2-contracts.sh` | 2026-08-20T09:16:50Z | 2026-08-20T10:38:49Z | 20 | 82 min | exit 0 | **0** |
| **G3** | `scripts/g3/verify-g3-swap-ledger.sh` | 2026-08-20T12:17:25Z | 2026-08-20T12:57:26Z | 18 | 40 min | exit 0 | **0** |
| **G4** | `scripts/g4/verify-g4-closeout.sh` | 2026-08-20T13:27:53Z | 2026-08-20T16:15:23Z | 11 | 167 min | exit 0 | **0** |

The G4 row is written by the run that renders this report, so its `finished`/`final_exit` are
necessarily "in progress" here; the authoritative record is `evidence/g4-closeout/run.log`.

## Clean-clone reproduction (SC-306)

Reproduced from a clean `git clone` into a temporary directory, running the same three gate
wrappers against fresh stacks of their own. The clone is deleted at teardown, so the figures
below are copied into `evidence/g4-closeout/repro/` by the gate itself — otherwise they would be
gone, and a reproduction claim with no retained evidence is an assertion. This section can be
re-rendered from those committed files at any time:
`npx tsx src/g4/swap-report.ts evidence/g4-closeout/repro`.

| What | Original | Reproduction |
|---|---|---|
| stage verdicts | A:GREEN B:GREEN C:GREEN | A:GREEN B:GREEN C:GREEN |
| run rows / checks | 23 / 217 | 23 / 217 |
| Manager addresses | 1f8f7b515d… 95fb94dc5d… f6eb885f47… | ab8b2ce76d… eddac280e7… bb527a748e… |
| row 5 — the v1 settlement | `00a3036cec400892e70942…` | `00b917f91daaad575d0827…` |
| row 8 — the OPEN offer | `00f642666cfa697ea6e802…` | `003929da6f91ef0112ee71…` |
| transaction ids IN COMMON | — | **0** |
| S1 (foreign wallet balances a contract call) | GREEN | GREEN |
| FR-308 openness | GREEN | GREEN |
| S6 (the maker pays nothing) | GREEN | GREEN |
| S5b (the F-310 boundary) | 1 → 2 | 1 → 2 |
| S2 (segment order — a lane investigation, not a spec requirement) | CONFIRMED — but the POST-HOC fix is REFUTED AS IMPLEMENTED | CONFIRMED + FIX DEMONSTRATED |

> **The S2 row above does not match, and that is a RESULT rather than a defect** — read the
> amended F-306 above. S2 measures accept/refuse ratios over segment ids the SDK draws at
> random, and the post-hoc re-keying it tests turns out to be valid or fatal depending on
> where the partitioner put the transcript. The specification does not depend on S2 at any
> point, and this project's maker transaction is a single call, so nothing else in this
> report moves. The comparator reports this divergence as a finding by design: it compares
> the specification, and a comparator stricter than the specification is a comparator bug.

What the comparator requires, and what it deliberately does not: it proves the reproduction is a
DIFFERENT chain (no Manager address, colour, pooled-coin nonce or transaction id in common), then
compares every row status, every check structure, and every pool, cell, wallet holding, map size,
invariant row and conservation row for EXACT equality. It compares the specification's
DISJUNCTIONS as the specification states them — FR-308 openness is GREEN if either shape settles,
and the MEASURED rows (FR-311 staleness, the two cancellation forms, P-F310) may record a
different refusal code, which is reported as a finding rather than scored as a failure. A
comparator stricter than the specification is a comparator bug.

Full output: `evidence/g4-closeout/09-compare.out`, and the reproduction's own evidence is in
`evidence/g4-closeout/repro/`.

## Requirements and success criteria, item by item

| Id | Status | Where the evidence is |
|---|---|---|
| FR-301 maker unbalanced offer, no DUST, refused alone | **PASS** / **PASS** | `g3-swap-ledger/stage-a.json` rows `row-3`, `row-4` |
| FR-302 guaranteed-section discipline, fail closed | **held, and it FIRED** (F-308, P-F310) | `stage-a.json` `p-f310`, `stage-c.json` `p-f310`, `g2-spikes/s5b.json` |
| FR-303 stock-taker settlement | **PASS**, with `validateTransaction` non-gating (F-303) | `stage-*.json` take reports |
| FR-304 atomic settlement, exact bookkeeping | **PASS** per stage | every row's `after` block: pools, cells, sizes, invariant, conservation |
| FR-305 owner-only make | **PASS** / **PASS** | `nc-305` (choke point), `nc-306` (per-(account,colour) guard, pool provably rich) |
| FR-306 offer envelope, content-addressed, real process boundary | **PASS** | `row-3` round-trip check, `g1-spikes/s3-offer-roundtrip.json` |
| FR-307 lifecycle negatives (a–d) | **PASS / MEASURED** | rows `row-6`, `row-9`, `row-10`, `row-12a`, `row-12b` |
| FR-308 maker-shape ladder — v1 AND v2 | **v1 PASS; openness GREEN** via the PREFERRED floating-surplus shape (FR-308 v2a) | `row-5` (v1), `row-7`/`row-8` + `g2-spikes/OPENNESS.md` (v2) |
| FR-309 evidence labels | **PASS** — `EXPERIMENTAL_LANE / LANE-DEV-1` on every artifact | every JSON's `lane` field, every envelope's `label` |
| FR-310 shielded-only v1 | **held** — the unshielded family was not attempted (owner Q3: extended goal) | contract source; no unshielded swap circuit exists |
| FR-311 offer/pool exclusivity is MEASURED | **MEASURED** — 239, not the predicted 104 | `row-11`, `g2-spikes/s5.json` |
| SC-301 the headline settlement | **PASS** | `row-5` |
| SC-302 direct-submission refusal, verbatim + no state | **PASS** | `row-4` (three layers, F-311) |
| SC-303 byte-identical round-trip, stable content address | **PASS** | `row-3`, `s3-offer-roundtrip.json` |
| SC-304 NC-301..306 + P-CXL green, P-104 measured | **PASS / MEASURED** | the negative-controls table above |
| SC-305 the OPEN offer reported SEPARATELY from v1 | **GREEN**, reported separately throughout | `row-7`/`row-8`, `OPENNESS.md` |
| SC-306 clean-clone reproduction, 0 shared tx ids | **see the reproduction section** | `evidence/g4-closeout/` |
| **the spec's literal 13-row single-Manager ledger** | **NOT REACHABLE at these pins** — measured, not assumed (F-310, D-307, P-F310) | `g3-swap-ledger/DEVIATION.md` |

## How to reproduce

```bash
# each gate is green only on exit 0 INCLUDING teardown; each boots its own disposable stack
./scripts/g1/verify-g1-spikes.sh          # lane inheritance + spikes S1-S3
./scripts/g2/verify-g2-contracts.sh       # Manager v4 + offer kit + spikes S4/S4b/S5b/S5/S6
./scripts/g3/verify-g3-swap-ledger.sh     # the swap step ledger, three stages
./scripts/g4/verify-g4-closeout.sh        # clean-clone reproduction of all three, then compare
```

## Evidence index

| Path | What is in it |
|---|---|
| `evidence/g1-lane/` | G1 run log, lane-inheritance proof (every hop), `LANE.md` |
| `evidence/g1-spikes/` | S1, S2, S3 with their JSON records; `superseded/` keeps earlier, genuinely replicated runs |
| `evidence/g2-contracts/` | G2 run log, compiled-artifact record (`ARTIFACTS.md`), F-201 verifier-key discipline |
| `evidence/g2-deploy-budget/` | F-307: the four-probe deploy-cost bracket and the live refusals |
| `evidence/g2-spikes/` | S4, S4b (NOT RUN, with the reason), S5b, S5, S6, `OPENNESS.md`, `NODE-CODES.md` |
| `evidence/g3-swap-ledger/` | the three stage JSONs + `LEDGER.md`, `CELLS.md`, `NEGATIVES.md`, `DEVIATION.md`; `run1-superseded/` keeps the RED run |
| `evidence/g4-closeout/` | this gate: the clone record, the freshness self-test, the comparison, and `repro/` — the clone's own evidence, copied before the clone was deleted |
| `archive/00003..00005/` | the three earlier projects' deliverables, relocated UNMODIFIED so this project could reuse the canonical evidence paths |

`EXPERIMENTAL_LANE / LANE-DEV-1` — every artifact of this project carries both labels (FR-309).

