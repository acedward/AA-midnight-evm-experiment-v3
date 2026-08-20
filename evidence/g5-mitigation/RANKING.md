# G5 RANKING — the five F-310 mitigation arms, measured

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T17:54:58.643Z

Owner direction, 2026-08-20 (verbatim): *"OK lets update the plan to test these
alternatives."* — with the top goal *"to be able to create valid, unbalanced, zswaps from the
coins the user has in the contract; That can be merged by the user and sent to the node; or
published on internet for example as a file to later be merged by another user and sent."*

The shipped Manager v4 is UNCHANGED by this work and gates G1-G4 stand exactly as closed.
Every fixture below is a measurement fixture under `contracts/variants/`, deployed only on
disposable stacks by this rig.

## The ranking

| fixture | arm | offer transcript ops | Δ vs v4 | circuits | deploy `bytesWritten` | % of ceiling | LIVE last GUARANTEED (cells) | modelled last GUARANTEED | relaxations |
|---|---|---|---|---|---|---|---|---|---|
| `manager` | baseline | 117 | 0 | 13 | 29,846 | 59.7% | not run | 16 | 0 |
| `v4-slim` | control | 117 | 0 | 9 | 19,676 | 39.4% | not run | 16 | 1 |
| `arm-a-dedupe` | a | 98 | **-19** | 9 | 19,676 | 39.4% | not run | 16 | 1 |
| `arm-b-nested` | b | 139 | **+22** | 9 | 18,908 | 37.8% | not run | 1 | 2 |
| `arm-c-both` | c | 108 | **-9** | 9 | 18,908 | 37.8% | not run | 16 | 2 |
| `arm-d-unified` | d | 89 | **-28** | 8 | 16,351 | 32.7% | not run | 16 | 4 |
| `arm-e-escrow` | e | 55 | **-62** | 11 | 25,064 | 50.1% | not run | 16 | 5 |

**`offer transcript ops` is the number that ranks the arms.** It is the OFFER circuit's
transcript program length — how many VM operations the offer records — and it is a property of
the contract alone: independent of ledger parameters, of the chain, and of how much custody is
held. Everything else in the table depends on at least one of those.

The F-307 deploy ceiling is between 60.1% and 64.7% of the 50,000-byte per-block
`bytesWritten` limit, measured live in Plan 02. Every fixture here is under it, and every one
was costed OFFLINE before anything was deployed.

## The owner's two use cases

### U1 — NOT MEASURED in this run (`u1-probe-v4.json` absent).

### The winner end-to-end — NOT RUN in this run (no `winner-*.json`).

## Per-arm reading

### `manager` — Manager v4 (SHIPPED, unchanged)

the F-310 anchor. Present in the matrix so the arms are compared against a re-measurement of the boundary rather than against a quoted number.

- offer transcript ops: **117** (+0 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 13 provable circuits, 29,846 `bytesWritten` (59.7% of ceiling)
- relaxations: none (this is the shipped contract)

### `v4-slim` — v4-slim — v4 minus the unshielded family

the arms TRUE baseline. Every arm needed the four circuits the unshielded family occupies, so the price of that relaxation is measured on its own before any arm effect is attributed.

- offer transcript ops: **117** (+0 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 9 provable circuits, 19,676 `bytesWritten` (39.4% of ceiling)
- relaxation: R1: the unshielded family is deleted (ledger field `unshieldedBalances`, key domain `unshieldedKey`, circuits `depositUnshielded` / `withdrawUnshielded` / `transferInternalUnshielded` / `unshieldedAccountBalance`). Breaks v3 raw-state layout compatibility and makes FR-203 family separation and the P-COLL probe inapplicable.

### `arm-a-dedupe` — arm (a) dedupe-flat

issue 0004 mitigation 1: read every ledger entry ONCE into a local. Semantics-preserving, the only arm adoptable without a Manager redesign.

- offer transcript ops: **98** (-19 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 9 provable circuits, 19,676 `bytesWritten` (39.4% of ceiling)
- relaxation: R1 (inherited from v4-slim). No further relaxation: behaviour-preserving.

### `arm-b-nested` — arm (b) nested-balances

issue 0004 mitigation 1b (owner-proposed): `shieldedBalances: acct -> (colour -> amount)`. Trades one map traversal for the composite-key `persistentHash`.

- offer transcript ops: **139** (+22 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 9 provable circuits, 18,908 `bytesWritten` (37.8% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R2: the `shieldedBalances` map layout changes. Breaks (i) v3/v4 raw-state decoders, (ii) the `shieldedKey` pure-circuit key-reproduction tooling that makes 00005 "zero unaccounted keys" assertion an enumeration of real state, and (iii) the domain-separator half of FR-203 family separation.

### `arm-c-both` — arm (c) nested + deduped

arms (a) and (b) together — and the arm that measures how much of (a) SURVIVES nesting, given F-314 (an ADT-typed intermediate cannot be bound to a local at these pins).

- offer transcript ops: **108** (-9 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 9 provable circuits, 18,908 `bytesWritten` (37.8% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R2 (from arm b).

### `arm-d-unified` — arm (d) unified per-account coin map

issue 0004 mitigation 1c (owner-proposed): `pools[account][colour] = coin`, `shieldedBalances` DELETED. The offer touches ONE ledger field, and "a rich pool never rescues a poor account" becomes structural instead of guard-ordered.

- offer transcript ops: **89** (-28 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 8 provable circuits, 16,351 `bytesWritten` (32.7% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R2': BOTH custody fields change — `shieldedBalances` deleted, `pools` re-keyed to account -> colour -> coin. Every v3/v4 decoder breaks and FR-205 conservation becomes vacuous as written (the two sides are the same number), so it is restated as credited-minus-debited.
- relaxation: R3': `poolValue` / `poolHasColour` removed (no per-colour pool exists), replaced by `accountHasColour`. The v3/v4 reader API is not preserved.
- relaxation: R4': `transferInternalShielded` stops being free — it becomes a real zswap split and merge. Measured as this arm price rather than excluded.

### `arm-e-escrow` — arm (e) two-phase escrow Cell

issue 0004 mitigation 1d in its stronger form: the OFFER circuit reads escrow CELLS and no map, so its cost cannot depend on custody size. The only arm whose payoff could be SIZE-INDEPENDENT rather than merely larger.

- offer transcript ops: **55** (-62 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at not run cell(s), first FALLIBLE at not reached
- deploy: 11 provable circuits, 25,064 `bytesWritten` (50.1% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R3'': the escrow is a SINGLE GLOBAL SLOT — one staged offer per Manager at a time. Keying it by account restores a map traversal, so this measures the BEST CASE and is quoted as an upper bound on what the approach can buy.
- relaxation: R4'': the give amount is fixed at staging time (`openSwap` gives the whole staged coin).
- relaxation: R5'': no `cancelStage` circuit — a staged coin can only leave through `openSwap`. A real gap for any product, not a design position.
- relaxation: R6'': the received colour attribution is DELAYED to `consolidate`, so FR-205 conservation holds only BETWEEN phases and must be restated as `pool + escrowed + received == cells + staged`.

## What every number here rests on

| claim | file | present? |
|---|---|---|
| offer transcript ops, modelled boundary | `offline-sweep.json` | yes |
| LIVE boundary per fixture | `live-matrix.json` | **NO** |
| may the model be quoted absolutely? | `calibration.json` | **NO** |
| deploy cost vs the F-307 ceiling | `deploy-cost.out` | yes |
| U1 on the shipped v4 | `u1-probe-v4.json` | **NO** |
| the winner, both use cases, live | `winner-*.json` | **NO** |
| what compiled, and with how many circuits | `compile/STATUS-*.tsv` | yes |

A missing file is reported rather than worked around: a silently absent arm reads as an arm
nobody proposed, which is the one reporting failure this rig must not commit.
