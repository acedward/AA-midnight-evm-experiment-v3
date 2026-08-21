# SPIKE S5b — how much custody state still allows a PUBLISHABLE offer? (issue 0003, FR-302)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T09:47:09.100Z

**VERDICT: MEASURED — the publishability boundary lies between step 1 (pools 1, cells 1) and step 2 (pools 1, cells 2)**

## Why this matters in one sentence

Balancing is per (token, segment) and an independent taker can only reach segment 0, so an
offer whose value leg sits in the FALLIBLE section cannot be settled by anyone. Publishability
is therefore a precondition for the whole step ledger — not a quality of the offer but a
property of how much state the Manager is holding when the offer is built.

## The dose-response

| step | what changed | pools | cells | named-taker | floating-surplus | imbalances(0) observed |
|---|---|---|---|---|---|---|
| 1 | deposit 8 G to AA_A — the state S4/S6 published from | 1 | 1 | GUARANTEED | GUARANTEED | `{"shielded:c8ecdb0aa48efe96c16e0c46e3ece2a60185f6a5fd1fe8148821a72ea89fb502":"-1"}` |
| 2 | deposit 2 G to AA_B — ONE MORE CELL, pool count unchanged | 1 | 2 | **FALLIBLE** | **FALLIBLE** | `{}` |
| 3 | deposit 2 F1 to AA_A — ONE MORE POOL | 2 | 3 | **FALLIBLE** | **FALLIBLE** | `{}` |
| 4 | deposit 2 F2 to AA_A — ONE MORE POOL | 3 | 4 | **FALLIBLE** | **FALLIBLE** | `{}` |

Every offer gives the same colour and wants a FRESH colour with no pool, so
`claimWantedColour`'s merge branch is never taken and the only thing varying across steps is
how much state the transcript reads. Step 2 adds a CELL without adding a POOL, which is the
only way to tell those two dimensions apart.

## What this corrects

The first version of this spike hypothesised that the trigger was the merge branch you pay
for when the WANTED colour already has a pool, and tested a 2×2 of {shape} × {wanted pool
exists}. **All four cells came back FALLIBLE**, including the two the hypothesis said should
be fine — because that 2×2 held constant the thing that actually mattered: it ran with two
pools and two cells already in custody, while S4 and S6, whose offers were guaranteed and
settled, ran with one of each. The hypothesis was wrong and the design could not see it.
Recorded because a refuted hypothesis that looked confirmed for the wrong reason is exactly
the kind of thing that quietly becomes folklore.

## The mechanism, from the pinned sources

The SDK does not choose the split. It asks which half of the PARTITIONED TRANSCRIPT claims
each zswap item (`midnight-js-contracts/dist/index.mjs:810-830`) and buckets accordingly. The
partition is the ledger's: `partition_transcripts`
(`midnight-ledger/ledger/src/construct.rs:1009`) cuts the transcript at `Op::Ckpt`
checkpoints, derives a guaranteed budget from `params.limits.min_time_to_dismiss` (15 ms) less
a per-transaction reserve, and fits as many sections as it can — **and if none fit, ZERO are
guaranteed and everything goes fallible.** That is why the failing rows read
`imbalances(0) = {}` rather than showing a partially-placed offer: it is all-or-nothing.

A larger custody map means deeper Merkle paths and more hashing per read, so transcript cost
rises with state size. The table above is where that cost crosses the budget.

## Consequences — read before writing the step ledger

- **The Manager can publish offers while it holds 1 pool(s) and 1 cell(s), and cannot
  once it holds 1 pool(s) and 2 cell(s).** That is a very tight budget, and it is a
  property of the lane's cost model, not of the contract's logic.
- **The spec's step ledger is affected beyond step 6.** Step 5 settles and leaves custody
  holding two pools and two cells, which is at or past this boundary — so OFFER-2 (step 7) and
  the offers in steps 9–12 may not be publishable at all. Plan 03 has to establish the
  reachable subset first and record the rest as measured lane limits, not as failures.
- **It does not touch the openness result.** S4 built at one pool and one cell, placed exactly
  at segment 0, and settled — as did S6. Those results stand exactly as reported.
- **The lever, if one is wanted, is transcript COST.** The budget is a ceiling, so anything
  that makes the transcript cheaper moves the boundary: fewer map reads per circuit, or a
  `Ckpt` placed before the expensive part so the partitioner has somewhere to cut. Both are
  contract/compiler design questions, recorded here rather than attempted.

## Checks

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the dose-response is MONOTONE (once unpublishable, it stays unpublishable) | PASS | s1(1p/1c):G s2(1p/2c):F s3(2p/3c):F s4(3p/4c):F |
| 2 | both offer SHAPES flip together — placement is about state, not shape | PASS | s1:n=G,s=G s2:n=F,s=F s3:n=F,s=F s4:n=F,s=F |
| 3 | a boundary was actually located (otherwise the dose range was too narrow) | PASS | between step 1 (pools 1, cells 1) and step 2 (pools 1, cells 2) |
| 4 | every offer either built or failed ONLY on placement (no unrelated build errors) | PASS | all built |

## Verbatim placement reports for the unpublishable offers

- **step 2 (1p/2c), named-taker**: segments `[0,48077]`,
  fallible-offer segments `[48077]`, observed at segment 0
  `{}`, elsewhere `{"48077":{"shielded:a7ec91b77fb3b1ecb5d968467c3c84c11250fd547d66ea7af3bc284b7ce5143c":"-1"}}`.
- **step 2 (1p/2c), floating-surplus**: segments `[0,61571]`,
  fallible-offer segments `[61571]`, observed at segment 0
  `{}`, elsewhere `{"61571":{"shielded:16859d0bc6378154a414d2ae09283fd3393c5b9d27170f91aa0b04c24ce35c75":"1","shielded:47266487be621773c298b3dfbffe6d060ad9e6f1e3e80319175889b819c64dd6":"-1"}}`.
- **step 3 (2p/3c), named-taker**: segments `[0,64697]`,
  fallible-offer segments `[64697]`, observed at segment 0
  `{}`, elsewhere `{"64697":{"shielded:f99a8d5dd610eb3e97d5810f0b5fba8550f4fe65c2d568ef60cf5344716cf790":"-1"}}`.
- **step 3 (2p/3c), floating-surplus**: segments `[0,33496]`,
  fallible-offer segments `[33496]`, observed at segment 0
  `{}`, elsewhere `{"33496":{"shielded:16859d0bc6378154a414d2ae09283fd3393c5b9d27170f91aa0b04c24ce35c75":"1","shielded:1f7af74a9e9ef1a062c3212105fc39802640afa780e351f2fee9ebe7798707a0":"-1"}}`.
