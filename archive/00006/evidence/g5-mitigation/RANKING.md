# G5 RANKING — the five F-310 mitigation arms, measured

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-21T04:43:00.729Z

Owner direction, 2026-08-20 (verbatim): *"OK lets update the plan to test these
alternatives."* — with the top goal *"to be able to create valid, unbalanced, zswaps from the
coins the user has in the contract; That can be merged by the user and sent to the node; or
published on internet for example as a file to later be merged by another user and sent."*

The shipped Manager v4 is UNCHANGED by this work and gates G1-G4 stand exactly as closed.
Every fixture below is a measurement fixture under `contracts/variants/`, deployed only on
disposable stacks by this rig.

## The ranking

| fixture | arm | offer transcript ops | Δ vs v4 | circuits | deploy `bytesWritten` | % of ceiling | LIVE last GUARANTEED (cells) | modelled last GUARANTEED | fixture relaxations |
|---|---|---|---|---|---|---|---|---|---|
| `manager` | baseline | 117 | 0 | 13 | 29,846 | 59.7% | 1 | 1 | 0 |
| `v4-slim` | control | 117 | 0 | 9 | 19,676 | 39.4% | 1 | 1 | 1 |
| `arm-a-dedupe` | a | 98 | **-19** | 9 | 19,676 | 39.4% | 4 | 2 | 1 |
| `arm-b-nested` | b | 139 | **+22** | 9 | 18,908 | 37.8% | **none** | 1 | 2 |
| `arm-c-both` | c | 108 | **-9** | 9 | 18,908 | 37.8% | 1 | 1 | 2 |
| `arm-d-unified` | d | 89 | **-28** | 8 | 16,351 | 32.7% | 2 | 2 | 4 |
| `arm-e-escrow` | e | 55 | **-62** | 11 | 25,064 | 50.1% | >=16 (no boundary in range) | >=16 (no boundary in range) | 5 |

**`offer transcript ops` ranks transcript cost; the LIVE column ranks demonstrated
publishability.** Ops are the OFFER circuit's
transcript program length — how many VM operations the offer records — and it is a property of
the contract alone: independent of ledger parameters, of the chain, and of how much custody is
held. It does not predict the live boundary monotonically: arm (d) records fewer ops than
arm (a), yet reaches only 2 cells live where arm (a) reaches 4. Both columns are required for
the design decision; everything else in the table depends on at least one of those contexts.

**Calibration of the modelled column: DIVERGENT** (65/70 overlapping
points agree — see `CALIBRATION.md`).

So the `modelled last GUARANTEED` column is **not** a lane fact and must not be quoted as
one. The `LIVE` column is. The ops column is unaffected either way.

The F-307 deploy ceiling is between 60.1% and 64.7% of the 50,000-byte per-block
`bytesWritten` limit, measured live in Plan 02. Every fixture here is under it, and every one
was costed OFFLINE before anything was deployed.

## The owner's two use cases

### U1 — self-merge, measured on the SHIPPED Manager v4

The question Plan 05 asks by name: does the owner's FIRST use case already work past the
F-310 boundary, without any contract change at all? A 1-cell control runs beside the
2-cell case, so a failure can be attributed to placement rather than to the self-merge
mechanism.

| case | cells | placement | settled | tx id / refusal | checks |
|---|---|---|---|---|---|
| U1 `u1-control-1cell` | 1 | GUARANTEED | **YES** | `00cec2b4d60ea00f06c3ebb09e436a40d6aa26190002728b1c5b6cc9009367e66f` | 9/9 |
| U1 `u1-2cell` | 2 | **FALLIBLE** | **YES** | `00a9f25afaf630d7f0089dac554fee7f8b350774cda4289d0907d50883cf303fb4` | 9/9 |

**A FALLIBLE-placement offer SETTLED for its own maker.** So U1 — "merged by the user and
sent to the node" — is NOT capped by F-310, and the owner's first use case works on the
shipped contract as it stands. F-310 constrains PUBLICATION, which is U2.

Note the FR-302 publication gate was bypassed for U1 on purpose, and every U1 record says
so: the gate refuses to publish a non-guaranteed offer, which is right for U2 and would
make the U1 question unanswerable.

### The winner end-to-end — `arm-e-escrow` at 4 custody cell(s)

| case | cells | placement | settled | tx id / refusal | checks |
|---|---|---|---|---|---|
| U1 `u1-control-1cell` | 1 | GUARANTEED | **YES** | `0000c87b77eea48c3eef4cfe29f3dc4a3f976bf86f7727cc931a0b5b04da62a0a9` | 10/10 |
| U1 `u1-4cell` | 4 | GUARANTEED | **YES** | `0092fe283a8dd8158956ace123c7fa4a43baa70c6cac941553a9617eaaf4a2f230` | 10/10 |
| U2 `u2-4cell` | 4 | GUARANTEED | **YES** | `00504bfc5cad733cbd7e7d39a7cf511808be44608764fd43631aedc0bd5d39c548` | 12/12 |

**U2 SETTLED at 4 custody cells** — a foreign wallet, whose keys the maker never
knew, read the offer from a published file in another process and settled it. That is the
F-310 boundary lifted from ONE cell to at least this size, demonstrated rather than
modelled.

## Decision input — recommendation versus measurement

The retained live evidence makes arm (a) the strongest map-based arm at 4 cells, while arm (e) is the only arm with no observed boundary (>=16 (no boundary in range)).
Arm (e) also settled the published-file U2 case for a foreign wallet at 4 cells. Those are
the measured inputs behind Plan 05's recommendation to productize arm (a) + arm (e).

**The combination itself was NOT a fixture in this rig.** No `(a)+(e)` contract was compiled,
deploy-costed or measured. Arm (a) adds no circuit or protocol step, and arm (e) alone costed
at 11 circuits / 50.1% of the 50,000-byte limit, so the combination is a supported design
direction, not a measured combined-arm result. Project 00007 must compile, cost and re-measure
the actual keyed/cancellable escrow design before making a product claim.

## Per-arm reading

### `manager` — Manager v4 (SHIPPED, unchanged)

the F-310 anchor. Present in the matrix so the arms are compared against a re-measurement of the boundary rather than against a quoted number.

- offer transcript ops: **117** (+0 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at 1 cell(s), first FALLIBLE at 2
- deploy: 13 provable circuits, 29,846 `bytesWritten` (59.7% of ceiling)
- relaxations: none (this is the shipped contract)

### `v4-slim` — v4-slim — v4 minus the unshielded family

the arms TRUE baseline. Four of the five redesign arms needed room beyond v4's circuit budget, so every measurement fixture used the same slim control and the price of R1 is isolated before any arm effect is attributed. Arm (a) itself does not require R1.

- offer transcript ops: **117** (+0 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at 1 cell(s), first FALLIBLE at 2
- deploy: 9 provable circuits, 19,676 `bytesWritten` (39.4% of ceiling)
- relaxation: R1: the unshielded family is deleted (ledger field `unshieldedBalances`, key domain `unshieldedKey`, circuits `depositUnshielded` / `withdrawUnshielded` / `transferInternalUnshielded` / `unshieldedAccountBalance`). Breaks v3 raw-state layout compatibility and makes FR-203 family separation and the P-COLL probe inapplicable.

### `arm-a-dedupe` — arm (a) dedupe-flat

issue 0004 mitigation 1: read every ledger entry ONCE into a local. The deduplication itself is semantics-preserving and is the only arm adoptable without a Manager redesign; this measurement fixture inherits R1 only to share the other arms' control.

- offer transcript ops: **98** (-19 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at 4 cell(s), first FALLIBLE at 8
- deploy: 9 provable circuits, 19,676 `bytesWritten` (39.4% of ceiling)
- relaxation: R1 is inherited by this measurement fixture solely for the common v4-slim control. Arm (a) adds no relaxation and its deduplication can be applied to the shipped v4 without deleting the unshielded family.

### `arm-b-nested` — arm (b) nested-balances

issue 0004 mitigation 1b (owner-proposed): `shieldedBalances: acct -> (colour -> amount)`. Trades one map traversal for the composite-key `persistentHash`.

- offer transcript ops: **139** (+22 vs shipped v4)
- LIVE boundary (floating surplus): no GUARANTEED point in range; first FALLIBLE at 1
- deploy: 9 provable circuits, 18,908 `bytesWritten` (37.8% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R2: the `shieldedBalances` map layout changes. Breaks (i) v3/v4 raw-state decoders, (ii) the `shieldedKey` pure-circuit key-reproduction tooling that makes 00005 "zero unaccounted keys" assertion an enumeration of real state, and (iii) the domain-separator half of FR-203 family separation.

### `arm-c-both` — arm (c) nested + deduped

arms (a) and (b) together — and the arm that measures how much of (a) SURVIVES nesting, given F-314 (an ADT-typed intermediate cannot be bound to a local at these pins).

- offer transcript ops: **108** (-9 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at 1 cell(s), first FALLIBLE at 2
- deploy: 9 provable circuits, 18,908 `bytesWritten` (37.8% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R2 (from arm b).

### `arm-d-unified` — arm (d) unified per-account coin map

issue 0004 mitigation 1c (owner-proposed): `pools[account][colour] = coin`, `shieldedBalances` DELETED. The offer touches ONE ledger field, and "a rich pool never rescues a poor account" becomes structural instead of guard-ordered.

- offer transcript ops: **89** (-28 vs shipped v4)
- LIVE boundary (floating surplus): last GUARANTEED at 2 cell(s), first FALLIBLE at 4
- deploy: 8 provable circuits, 16,351 `bytesWritten` (32.7% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R2': BOTH custody fields change — `shieldedBalances` deleted, `pools` re-keyed to account -> colour -> coin. Every v3/v4 decoder breaks and FR-205 conservation becomes vacuous as written (the two sides are the same number), so it is restated as credited-minus-debited.
- relaxation: R3': `poolValue` / `poolHasColour` removed (no per-colour pool exists), replaced by `accountHasColour`. The v3/v4 reader API is not preserved.
- relaxation: R4': `transferInternalShielded` stops being free — it becomes a real zswap split and merge. Measured as this arm price rather than excluded.

### `arm-e-escrow` — arm (e) two-phase escrow Cell

issue 0004 mitigation 1d in its stronger form: the OFFER circuit reads escrow CELLS and no map, so custody growth adds no custody-map reads. One authorization Set read remains; in retained run-5 evidence the offer stays GUARANTEED through 16 cells with no boundary found. The only arm whose payoff could be SIZE-INDEPENDENT rather than merely larger.

- offer transcript ops: **55** (-62 vs shipped v4)
- LIVE boundary (floating surplus): >=16 cells (no boundary in range)
- deploy: 11 provable circuits, 25,064 `bytesWritten` (50.1% of ceiling)
- relaxation: R1 (inherited).
- relaxation: R3'': the escrow is a SINGLE GLOBAL SLOT — one staged offer per Manager at a time. Keying it by account restores a map traversal, so this measures the BEST CASE and is quoted as an upper bound on what the approach can buy.
- relaxation: R4'': the give amount is fixed at staging time (`openSwap` gives the whole staged coin).
- relaxation: R5'': no `cancelStage` circuit — a staged coin can only leave through `openSwap`. A real gap for any product, not a design position.
- relaxation: R6'': the received colour attribution is DELAYED to `consolidate`, so FR-205 conservation holds only BETWEEN phases and must be restated as `pool + escrowed + received == cells + staged`.

## What every number here rests on

| claim | file | present? |
|---|---|---|
| offer transcript ops, modelled boundary | `offline-sweep.json` | yes — exact current-run input |
| LIVE boundary per fixture | `live-matrix.json` | yes — exact current-run input |
| may the model be quoted absolutely? | `calibration.json` | yes — exact current-run input |
| deploy cost vs the F-307 ceiling | `12-deploy-cost.out` | yes — exact current-run input |
| U1 on the shipped v4 | `u1-probe-v4.json` | yes — exact current-run input |
| the winner, both use cases, live | `winner-arm-e-escrow-4c.json` | yes — explicitly selected |
| what compiled, and with how many circuits | `compile/STATUS-{skip-zk,zk}.tsv` | yes — exact current-run inputs |

Every row above was validated before this report was written. A missing, stale, corrupt, or
contradictory input is a non-zero gate result; no directory scan can select another winner.
