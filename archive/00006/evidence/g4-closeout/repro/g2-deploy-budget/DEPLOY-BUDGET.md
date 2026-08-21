# Finding F-307 — the Manager's DEPLOY budget on this lane is thirteen provable circuits

`EXPERIMENTAL_LANE` / `LANE-DEV-1` · 00006-unbalanced-zswap, Plan 02 Phase 1/3 · measured 2026-08-20

## What happened

Manager v4 was first written exactly as Plan 02 Phase 1 specifies it: v3 plus **two** new circuits,
`openSwapShielded` and `openSwapShieldedSurplus`. It compiled at the first attempt, produced verifier
keys for both, passed the F-201 verifier-key discipline check, and passed 33 new offline unit tests
covering both shapes' zswap structure, effects and guard order.

It was then refused **on deploy** — not on a call, not on a settlement — with the verbatim

```
1010: Invalid Transaction: Transaction would exhaust the block limits
```

4/4 across attempts spaced 20 s apart, while a Minter deployed successfully in the same session.

## Why, read from the pinned sources

A midnight extrinsic's WEIGHT is not its byte length:

```
gas = max(normalized cost over the five dimensions) × max_block_weight
```

- the cost is computed by `Transaction::cost` and normalized against `params.limits.block_limits`
  (`midnight-node/ledger/src/versions/common/mod.rs:765-785`, `:1165-1177`);
- `normalize` returns `None` — killing fee calculation with `BlockLimitExceeded` — the moment ANY
  dimension exceeds its ceiling (`midnight-ledger/base-crypto/src/cost_model.rs:277-297`);
- `pallet-midnight` refuses earlier still, comparing the running block weight plus this extrinsic
  against the Normal dispatch class's ceiling (`midnight-node/pallets/midnight/src/lib.rs:536-561`
  → `InvalidTransaction::ExhaustsResources`; `NORMAL_DISPATCH_RATIO = 75%`,
  `midnight-node/runtime/src/lib.rs:307`).

For a contract DEPLOY the dominant dimension is `bytesWritten`, ceiling **50 000**
(`midnight-ledger/ledger/src/structure.rs:1271-1283`), and what dominates `bytesWritten` is the
contract's VERIFIER KEYS — one per provable circuit, 2 119 B for a circuit with several arguments and
1 351 B for a small one. Empirically `bytesWritten ≈ 1.077 × (verifier-key bytes) + 3 500`.

## The measurement

A refusal names no dimension, and guessing which circuit to delete is how a project deletes the wrong
thing. So the ceiling was bracketed: four probe contracts, one funded stack, one run
(`harness/src/g2/diag-deploy-probe.ts`, output `02-deploy-probe-bracket.out`).

| probe | provable circuits | verifier-key bytes | submitted `bytesWritten` | % of the 50 000 ceiling | deploys? |
|---|---|---|---|---|---|
| Minter (reference, known-good) | 4 | 8 476 | 11 345 | 22.7% | **YES** |
| Manager v3 — the inherited contract | 12 | 22 356 | 27 791 | 55.6% | **YES** |
| v3 − `poolHasColour` + both swaps | 12 | 23 124 | 28 562 | 57.1% | **YES** |
| v3 + ONE swap circuit | 13 | 24 475 | 30 070 | 60.1% | **YES** |
| v3 + TWO swap circuits | 14 | 26 594 | 32 356 | 64.7% | **NO** |

**The ceiling is between 60.1% and 64.7%.** Manager v3 already used 12 circuits, so v4's budget is
exactly one new circuit.

Two things are recorded as NOT established, rather than papered over:

- The exact accounting is unexplained. 64.7% ought to fit under a 75% class ceiling, and it
  demonstrably does not, so something in the block's running weight is unaccounted for in the model
  above. The BUDGET is what the design needed and the budget is measured; the residual arithmetic is
  left as an open question rather than guessed at.
- The refusal was verified as HARD rather than transient. `01-deploy-live-4-attempts.out` shows four
  attempts spaced 20 s apart, each printing the balanced transaction's five cost dimensions before
  submitting, all four refused identically. Block pressure would not have produced that.

## What was changed, and what was deliberately not

The two FR-308 shapes were **merged into one circuit** whose
`recipientA: Maybe<Either<ZswapCoinPublicKey, ContractAddress>>` argument selects them:

- `some(key)` → v1 named taker, and v2(b) bearer key (the key is a throwaway whose secret ships in
  the offer envelope);
- `none` → v2(a) floating surplus: A is released with no output at all.

Rejected alternatives, and why:

| Option | Why not |
|---|---|
| Delete v3 circuits to make room (e.g. the unshielded family, out of scope per FR-310) | Weakens the inherited contract, which Plan 02 Phase 1 forbids, and invalidates 00005's own negatives |
| Put the swap circuits on a second contract | The swap must debit the SAME custody state; a second contract cannot touch the Manager's ledger |
| Raise the block limits | Would mean re-pinning the lane. Forbidden (owner Q2 → A: inherited, never re-pinned) |

**No FR-308 requirement is weakened by the merge.** Both shapes are implemented, both are exercised,
and they are measured separately down to the level of *the two branches differ in exactly one zswap
output — the payout*, which has its own unit test. That test exists because it is the whole difference
between "a swap with somebody" and "a swap with anybody": an edit that quietly added an output to the
open branch would destroy openness while leaving every custody assertion passing.

## The consequence worth carrying forward

The Manager is now AT its ceiling. Any future plan proposing "add circuits X, Y and Z to the Manager"
must be costed before it is written, and growing further will require either merging more shapes into
fewer circuits or splitting custody across contracts — a design decision worth taking deliberately
rather than discovering at a deploy.

`harness/src/g2/diag-deploy-cost.ts` now does that costing **offline** from the compiled artifacts, in
seconds, with no chain, no wallet and no proof server, for any directory under `generated-zk/`. That
is the reusable output of this finding.

## Files

| File | What it is |
|---|---|
| `01-deploy-live-4-attempts.out` | The 14-circuit Manager refused 4/4 with spacing, with the balanced cost dimensions printed per attempt, and a known-good Minter deploy in the same run for calibration |
| `02-deploy-probe-bracket.out` | The four-probe bracket that located the ceiling |
| `harness/src/g2/diag-deploy-cost.ts` | Offline deploy coster (reusable) |
| `harness/src/g2/diag-deploy-live.ts` | Live balanced-deploy measurement; distinguishes a hard ceiling from block pressure |
| `harness/src/g2/diag-deploy-probe.ts` | Bracket several variants in one funded run |
