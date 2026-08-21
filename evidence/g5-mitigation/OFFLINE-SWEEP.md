# G5 offline sweep — the F-310 placement decision computed with no chain (F-313)

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-21T03:41:22.499Z

## What this is, and what it is not

`partitionTranscripts` — the ledger function that decides which half of a transcript is
GUARANTEED, and therefore the function F-308 and F-310 are both about — is bound to JS in the
pinned `@midnightntwrk/ledger-v9`. Feeding it a simulator run the way the pinned SDK feeds it
(`@midnight-ntwrk/compact-js` → `ContractExecutable.js::partitionAllTranscripts`) computes the
same decision offline, in milliseconds. That is finding **F-313**.

**Parameters used: CHAIN parameters captured at evidence/g5-mitigation/chain-params.json**

This sweep is a DESIGN AND RANKING instrument. Every fixture is measured under identical
parameters in an identical simulator with custody grown identically, so a difference between
two rows is a difference between two CONTRACTS. Absolute boundaries are only lane facts where
the LIVE matrix agrees; that comparison is `CALIBRATION.md`.

## Per-arm summary

| variant | arm | layout | offer | offer ops @ 2 cells | Δ ops vs v4 | last GUARANTEED (named) | last GUARANTEED (surplus) | monotone |
|---|---|---|---|---|---|---|---|---|
| `manager` | baseline | flat | single | 117 | 0 | 1 | 1 | yes |
| `v4-slim` | control | flat | single | 117 | 0 | 1 | 1 | yes |
| `arm-a-dedupe` | a | flat | single | 98 | -19 | 2 | 2 | yes |
| `arm-b-nested` | b | nested-balances | single | 139 | +22 | 1 | 1 | yes |
| `arm-c-both` | c | nested-balances | single | 108 | -9 | 1 | 1 | yes |
| `arm-d-unified` | d | unified-coins | single | 89 | -28 | 2 | 2 | yes |
| `arm-e-escrow` | e | flat | staged | 55 | -62 | >=16 (no boundary in range) | >=16 (no boundary in range) | yes |

`offer ops` is the OFFER transcript program length — the number of VM operations the offer
circuit records. It is parameter-independent, so it is the one number in this table that is a
property of the contract alone. For arm (e) it is the `openSwap` circuit only; its
self-balanced `stageOffer` and `consolidate` phases are tabulated separately below, because
they are not offers and F-310 does not constrain them.

## The full dose-response

| variant | cells | pools | shape | placement | offer ops | proxy read ms | proxy compute ms | note |
|---|---|---|---|---|---|---|---|---|
| `manager` | 1 | 1 | named-taker | GUARANTEED | 126 | 3.468 | 6.592 | — |
| `manager` | 1 | 1 | floating-surplus | GUARANTEED | 117 | 3.468 | 6.484 | — |
| `manager` | 2 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 7.712 | — |
| `manager` | 2 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 7.604 | — |
| `manager` | 4 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 7.998 | — |
| `manager` | 4 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 7.889 | — |
| `manager` | 8 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 8.008 | — |
| `manager` | 8 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 8.092 | — |
| `manager` | 16 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 8.019 | — |
| `manager` | 16 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 7.911 | — |
| `v4-slim` | 1 | 1 | named-taker | GUARANTEED | 126 | 3.468 | 6.592 | — |
| `v4-slim` | 1 | 1 | floating-surplus | GUARANTEED | 117 | 3.468 | 6.484 | — |
| `v4-slim` | 2 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 7.712 | — |
| `v4-slim` | 2 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 7.604 | — |
| `v4-slim` | 4 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 7.998 | — |
| `v4-slim` | 4 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 7.889 | — |
| `v4-slim` | 8 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 8.008 | — |
| `v4-slim` | 8 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 8.092 | — |
| `v4-slim` | 16 | 1 | named-taker | **FALLIBLE** | 126 | 4.386 | 8.019 | — |
| `v4-slim` | 16 | 1 | floating-surplus | **FALLIBLE** | 117 | 4.386 | 7.911 | — |
| `arm-a-dedupe` | 1 | 1 | named-taker | GUARANTEED | 107 | 2.652 | 5.645 | — |
| `arm-a-dedupe` | 1 | 1 | floating-surplus | GUARANTEED | 98 | 2.652 | 5.537 | — |
| `arm-a-dedupe` | 2 | 1 | named-taker | GUARANTEED | 107 | 3.366 | 6.562 | — |
| `arm-a-dedupe` | 2 | 1 | floating-surplus | GUARANTEED | 98 | 3.366 | 6.453 | — |
| `arm-a-dedupe` | 4 | 1 | named-taker | **FALLIBLE** | 107 | 3.366 | 6.847 | — |
| `arm-a-dedupe` | 4 | 1 | floating-surplus | **FALLIBLE** | 98 | 3.366 | 6.738 | — |
| `arm-a-dedupe` | 8 | 1 | named-taker | **FALLIBLE** | 107 | 3.366 | 6.857 | — |
| `arm-a-dedupe` | 8 | 1 | floating-surplus | **FALLIBLE** | 98 | 3.366 | 6.941 | — |
| `arm-a-dedupe` | 16 | 1 | named-taker | **FALLIBLE** | 107 | 3.366 | 6.868 | — |
| `arm-a-dedupe` | 16 | 1 | floating-surplus | **FALLIBLE** | 98 | 3.366 | 6.760 | — |
| `arm-b-nested` | 1 | 1 | named-taker | GUARANTEED | 148 | 5.202 | 8.607 | — |
| `arm-b-nested` | 1 | 1 | floating-surplus | GUARANTEED | 139 | 5.202 | 8.499 | — |
| `arm-b-nested` | 2 | 1 | named-taker | **FALLIBLE** | 148 | 6.630 | 10.239 | — |
| `arm-b-nested` | 2 | 1 | floating-surplus | **FALLIBLE** | 139 | 6.630 | 10.131 | — |
| `arm-b-nested` | 4 | 1 | named-taker | **FALLIBLE** | 148 | 6.630 | 10.526 | — |
| `arm-b-nested` | 4 | 1 | floating-surplus | **FALLIBLE** | 139 | 6.630 | 10.418 | — |
| `arm-b-nested` | 8 | 1 | named-taker | **FALLIBLE** | 148 | 6.630 | 11.005 | — |
| `arm-b-nested` | 8 | 1 | floating-surplus | **FALLIBLE** | 139 | 6.630 | 10.896 | — |
| `arm-b-nested` | 16 | 1 | named-taker | **FALLIBLE** | 148 | 6.630 | 11.018 | — |
| `arm-b-nested` | 16 | 1 | floating-surplus | **FALLIBLE** | 139 | 6.630 | 10.909 | — |
| `arm-c-both` | 1 | 1 | named-taker | GUARANTEED | 117 | 3.570 | 6.760 | — |
| `arm-c-both` | 1 | 1 | floating-surplus | GUARANTEED | 108 | 3.570 | 6.652 | — |
| `arm-c-both` | 2 | 1 | named-taker | **FALLIBLE** | 117 | 4.488 | 7.882 | — |
| `arm-c-both` | 2 | 1 | floating-surplus | **FALLIBLE** | 108 | 4.488 | 7.774 | — |
| `arm-c-both` | 4 | 1 | named-taker | **FALLIBLE** | 117 | 4.488 | 8.169 | — |
| `arm-c-both` | 4 | 1 | floating-surplus | **FALLIBLE** | 108 | 4.488 | 8.061 | — |
| `arm-c-both` | 8 | 1 | named-taker | **FALLIBLE** | 117 | 4.488 | 8.648 | — |
| `arm-c-both` | 8 | 1 | floating-surplus | **FALLIBLE** | 108 | 4.488 | 8.539 | — |
| `arm-c-both` | 16 | 1 | named-taker | **FALLIBLE** | 117 | 4.488 | 8.660 | — |
| `arm-c-both` | 16 | 1 | floating-surplus | **FALLIBLE** | 108 | 4.488 | 8.552 | — |
| `arm-d-unified` | 1 | 1 | named-taker | GUARANTEED | 98 | 2.652 | 5.590 | — |
| `arm-d-unified` | 1 | 1 | floating-surplus | GUARANTEED | 89 | 2.652 | 5.482 | — |
| `arm-d-unified` | 2 | 1 | named-taker | GUARANTEED | 98 | 3.672 | 6.814 | — |
| `arm-d-unified` | 2 | 1 | floating-surplus | GUARANTEED | 89 | 3.672 | 6.706 | — |
| `arm-d-unified` | 4 | 1 | named-taker | **FALLIBLE** | 98 | 3.672 | 7.101 | — |
| `arm-d-unified` | 4 | 1 | floating-surplus | **FALLIBLE** | 89 | 3.672 | 6.993 | — |
| `arm-d-unified` | 8 | 1 | named-taker | **FALLIBLE** | 98 | 3.672 | 7.305 | — |
| `arm-d-unified` | 8 | 1 | floating-surplus | **FALLIBLE** | 89 | 3.672 | 7.197 | — |
| `arm-d-unified` | 16 | 1 | named-taker | **FALLIBLE** | 98 | 3.672 | 7.592 | — |
| `arm-d-unified` | 16 | 1 | floating-surplus | **FALLIBLE** | 89 | 3.672 | 7.484 | — |
| `arm-e-escrow` | 1 | 1 | named-taker | GUARANTEED | 64 | 1.530 | 3.927 | — |
| `arm-e-escrow` | 1 | 1 | floating-surplus | GUARANTEED | 55 | 1.530 | 3.819 | — |
| `arm-e-escrow` | 2 | 1 | named-taker | GUARANTEED | 64 | 1.632 | 4.029 | — |
| `arm-e-escrow` | 2 | 1 | floating-surplus | GUARANTEED | 55 | 1.632 | 3.921 | — |
| `arm-e-escrow` | 4 | 1 | named-taker | GUARANTEED | 64 | 1.632 | 4.495 | — |
| `arm-e-escrow` | 4 | 1 | floating-surplus | GUARANTEED | 55 | 1.632 | 4.386 | — |
| `arm-e-escrow` | 8 | 1 | named-taker | GUARANTEED | 64 | 1.632 | 4.495 | — |
| `arm-e-escrow` | 8 | 1 | floating-surplus | GUARANTEED | 55 | 1.632 | 4.386 | — |
| `arm-e-escrow` | 16 | 1 | named-taker | GUARANTEED | 64 | 1.632 | 4.029 | — |
| `arm-e-escrow` | 16 | 1 | floating-surplus | GUARANTEED | 55 | 1.632 | 3.921 | — |

`proxy read/compute ms` is `Transcript.gas`, which the ledger sets to
`gas_heuristic(params, false, 0)` = raw transcript gas x 1.2. It is **not** the quantity the
partitioner compares against the budget (that is `gas_heuristic(params, true,
program.field_size()+2)`, which is not bound to JS), so it is a proxy and is labelled as one
everywhere it appears. The PLACEMENT column is the partitioner own verdict and is exact.

## Arm (e): the self-balanced phases, measured

These are NOT offers. `stageOffer` and `consolidate` are ordinary self-balanced custody
transactions the maker submits itself, so their placement does not constrain publishability —
the arm rests on exactly that claim, so the numbers are recorded rather than assumed.

| cells | shape | stageOffer placement | stage ops | openSwap placement | openSwap ops | consolidate placement | consolidate ops |
|---|---|---|---|---|---|---|---|
| 1 | named-taker | GUARANTEED | 100 | GUARANTEED | 64 | GUARANTEED | 48 |
| 1 | floating-surplus | GUARANTEED | 100 | GUARANTEED | 55 | GUARANTEED | 48 |
| 2 | named-taker | GUARANTEED | 100 | GUARANTEED | 64 | GUARANTEED | 48 |
| 2 | floating-surplus | GUARANTEED | 100 | GUARANTEED | 55 | GUARANTEED | 48 |
| 4 | named-taker | FALLIBLE | 100 | GUARANTEED | 64 | GUARANTEED | 48 |
| 4 | floating-surplus | FALLIBLE | 100 | GUARANTEED | 55 | GUARANTEED | 48 |
| 8 | named-taker | FALLIBLE | 100 | GUARANTEED | 64 | GUARANTEED | 48 |
| 8 | floating-surplus | FALLIBLE | 100 | GUARANTEED | 55 | GUARANTEED | 48 |
| 16 | named-taker | FALLIBLE | 100 | GUARANTEED | 64 | GUARANTEED | 48 |
| 16 | floating-surplus | FALLIBLE | 100 | GUARANTEED | 55 | GUARANTEED | 48 |

## Relaxations, per fixture

- **`manager`** (baseline) — Manager v4 (SHIPPED, unchanged)
  - none: this is the shipped contract, unchanged.
- **`v4-slim`** (control) — v4-slim — v4 minus the unshielded family
  - R1: the unshielded family is deleted (ledger field `unshieldedBalances`, key domain `unshieldedKey`, circuits `depositUnshielded` / `withdrawUnshielded` / `transferInternalUnshielded` / `unshieldedAccountBalance`). Breaks v3 raw-state layout compatibility and makes FR-203 family separation and the P-COLL probe inapplicable.
- **`arm-a-dedupe`** (a) — arm (a) dedupe-flat
  - R1 is inherited by this measurement fixture solely for the common v4-slim control. Arm (a) adds no relaxation and its deduplication can be applied to the shipped v4 without deleting the unshielded family.
- **`arm-b-nested`** (b) — arm (b) nested-balances
  - R1 (inherited).
  - R2: the `shieldedBalances` map layout changes. Breaks (i) v3/v4 raw-state decoders, (ii) the `shieldedKey` pure-circuit key-reproduction tooling that makes 00005 "zero unaccounted keys" assertion an enumeration of real state, and (iii) the domain-separator half of FR-203 family separation.
- **`arm-c-both`** (c) — arm (c) nested + deduped
  - R1 (inherited).
  - R2 (from arm b).
- **`arm-d-unified`** (d) — arm (d) unified per-account coin map
  - R1 (inherited).
  - R2': BOTH custody fields change — `shieldedBalances` deleted, `pools` re-keyed to account -> colour -> coin. Every v3/v4 decoder breaks and FR-205 conservation becomes vacuous as written (the two sides are the same number), so it is restated as credited-minus-debited.
  - R3': `poolValue` / `poolHasColour` removed (no per-colour pool exists), replaced by `accountHasColour`. The v3/v4 reader API is not preserved.
  - R4': `transferInternalShielded` stops being free — it becomes a real zswap split and merge. Measured as this arm price rather than excluded.
- **`arm-e-escrow`** (e) — arm (e) two-phase escrow Cell
  - R1 (inherited).
  - R3'': the escrow is a SINGLE GLOBAL SLOT — one staged offer per Manager at a time. Keying it by account restores a map traversal, so this measures the BEST CASE and is quoted as an upper bound on what the approach can buy.
  - R4'': the give amount is fixed at staging time (`openSwap` gives the whole staged coin).
  - R5'': no `cancelStage` circuit — a staged coin can only leave through `openSwap`. A real gap for any product, not a design position.
  - R6'': the received colour attribution is DELAYED to `consolidate`, so FR-205 conservation holds only BETWEEN phases and must be restated as `pool + escrowed + received == cells + staged`.
