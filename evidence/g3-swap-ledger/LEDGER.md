# The swap step ledger — what ran, where, and with what verdict

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T13:02:51.192Z

## Overall: **GREEN**

> **Read `DEVIATION.md` first.** The spec's step ledger is normative and single-Manager. Finding F-310 makes it unreachable past row 6 at these pins, so the demonstration was PARTITIONED across three fresh Managers on one chain (deviation **D-307**), every row keeping its exact amounts and assertions. This page is that mapping. It is not the spec's literal table and is never presented as one.

| Stage | Manager | Carries | Verdict | Evidence |
|---|---|---|---|---|
| **A** | `1f8f7b515d8da46148…` | rows 0–6, row 10 (NC-304), NC-305, P-F310 | GREEN | `stage-a.json` / `STAGE-A.md` |
| **B** | `95fb94dc5df1d64070…` | rows 7–8 (P-OPEN — the owner-REQUIRED open offer) | GREEN | `stage-b.json` / `STAGE-B.md` |
| **C** | `f6eb885f4760142781…` | rows 9 (NC-303), 11 (P-104), 12 (P-CXL, both forms), NC-306, P-F310 replication | GREEN | `stage-c.json` / `STAGE-C.md` |


## The spec's thirteen rows

| Row | Spec action | Stage | Row id | Status | Checks |
|---|---|---|---|---|---|
| 0 | Manager v4 deployed; AA_A, AA_B registered | A | `row-0` | PASS | 4/4 |
| 1 | Minters TOKA, TOKB deployed; mint S_A 10 → OwnerN; mint S_B 10 → OwnerT | A | `row-1` | PASS | 10/10 |
| 2 | OwnerN deposits S_A 6 → AA_A | A | `row-2` | PASS | 11/11 |
| 3 | OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 credited to AA_A; proven; serialized to file; no DUST | A | `row-3` | PASS | 12/12 |
| 4 | OFFER-1 submitted DIRECTLY (unbalanced) | A | `row-4` | PASS | 7/7 |
| 5 | OwnerT takes OFFER-1: stock balance → merge → submit | A | `row-5` | PASS | 20/20 |
| 6 | Double-take: OFFER-1 balanced and submitted again | A | `row-6` | PASS | 6/6 |
| 7 | OFFER-2 built (v2 OPEN shape — floating surplus): give S_A 2 to no one the maker knows, want S_B 3 to AA_A | B | `row-7` | PASS | 13/13 |
| 8 | OwnerT — whose keys the maker never knew — takes OFFER-2 | B | `row-8` | PASS | 18/18 |
| 9 | Expiry negative: OFFER-3 (small give) held past its TTL, then taken | C | `row-9` | PASS | 9/9 |
| 10 | Tamper negative: OFFER-1's retained bytes, one byte flipped, taken | A | `row-10` | PASS | 7/7 |
| 11 | Staleness probe (FR-311): OFFER-4 built on a live colour, then an ordinary deposit lands on that colour, then OFFER-4 taken | C | `row-11` | MEASURED | 6/6 |
| 12 | Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken | C, C | `row-12a`, `row-12b` | MEASURED, MEASURED | 7/7, 7/7 |

### Where a row was run differently, and why

- **Row 0** — run three times — once per stage — because each stage needs its own ≤1-cell budget (F-310)
- **Row 1** — per stage, with that stage's own fresh colours; stage C mints S_A 12 so its five negatives each have a give to make
- **Row 4** — submitted by a THIRD process holding nothing but the envelope file and its own seed, in two forms (unbound as published, and bound) — plus the ledger's own offline `wellFormed` verdict
- **Row 5** — maker DUST spend 0 is read from the settled transaction's PER-INTENT dust actions, not from `dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably paying fees (Plan 02 S6)
- **Row 6** — preceded by ONE labelled fixture mint of S_B 7 to OwnerT: after row 5 the taker holds only 3 S_B and could not balance at all, so the refusal would come from its own wallet instead of the NODE. The spec's v1-only final table is asserted BEFORE the fixture, where it applies
- **Row 7** — on a FRESH Manager whose AA_A holds exactly 2 S_A, so the give is the pool's whole balance and row 8's "pool removed" is reproduced exactly. The spec's literal row 7 is ALSO attempted on Manager #1 at two cells, where it fails closed — that is P-F310, the deviation's own evidence
- **Row 8** — the S_B TOTALS differ (absent→3, AA_A 0→3) because the +7 they carry happened on Manager #1. Every DELTA (−2 S_A with the pool REMOVED, +3 S_B, OwnerT +2/−3, maker dust 0) and the exact end-state map sizes 1/2/0 are reproduced identically
- **Row 9** — the intent TTL is rewritten to 120 s while the transaction is still UNPROVEN (F-306: rewriting a PROVEN transaction's intents invalidates its zswap proofs), because midnight-js hardcodes `ttlOneHour()` and the literal form costs an hour per observation. BOTH layers measured: the taker's own gate refuses OFFLINE, and with that gate forced off the node refuses with 228
- **Row 10** — TWO arms. (a) the flip alone is refused OFFLINE by the envelope's content-address check, before a wallet, a proof server or a node is contacted — STRONGER than the node refusal the spec anticipated, and recorded as such. (b) the flip with the content address REPAIRED reaches the layer the spec named
- **Row 11** — the MEASURED code is 239 = ZswapInvalidErrorCode::NullifierAlreadyPresent, not the predicted 104 (finding F-309, 3/3 in Plan 02): an ordinary deposit MERGES the pooled coin and merging SPENDS it, so the offer's pinned coin is already nullified. FR-311 asks for the measured rule, so the measured rule is asserted and the divergence recorded
- **Row 12** — BOTH forms the spec names are measured separately, because they are not the same mechanism: a WITHDRAW spends the pooled coin, while `transferInternalShielded` performs NO token operation at all (the pooled coin is byte-identical afterwards) and can only invalidate an offer through the account cell its transcript read

## Every row that ran, in order

| Stage | Row id | Spec row | What | Status | Checks | Transactions |
|---|---|---|---|---|---|---|
| A | `row-0` | 0 | Manager v4 deployed; AA_A and AA_B registered | PASS | 4/4 | — |
| A | `row-1` | 1 | Minters TOKA/TOKB deployed; S_A 10 → OwnerN, S_B 10 → OwnerT | PASS | 10/10 | `004f6ad0f34fd16d…` `00dacbc0548265e4…` |
| A | `row-2` | 2 | OwnerN deposits S_A 6 → AA_A | PASS | 11/11 | `003ae71f98806ee9…` |
| A | `nc-305` | — | unauthorized make: OwnerN's witness attempts an offer on AA_A's S_A | PASS | 7/7 | — |
| A | `row-3` | 3 | OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 → AA_A | PASS | 12/12 | — |
| A | `row-4` | 4 | OFFER-1 submitted DIRECTLY (unbalanced) — NC-301 | PASS | 7/7 | — |
| A | `row-5` | 5 | OwnerT takes OFFER-1: stock balance → merge → submit | PASS | 20/20 | `00a3036cec400892…` |
| A | `final-table-v1` | — | the spec's final table, v1-only column (in parentheses there) | PASS | 12/12 | — |
| A | `row-6` | 6 | Double-take: OFFER-1 balanced and submitted again — NC-302 | PASS | 6/6 | `00187fe4c8c2cfc0…` |
| A | `row-10` | 10 | Tamper: OFFER-1's retained bytes, one byte flipped, taken — NC-304 | PASS | 7/7 | — |
| A | `p-f310` | — | D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells | MEASURED | 7/7 | — |
| A | `closing` | — | Stage A closing state, both observation points | PASS | 13/13 | — |
| B | `setup` | — | fresh Manager; mint; OwnerN deposits S_A 2 → AA_A | PASS | 13/13 | `00b1d8eb37215c2d…` `00862395c60a462d…` `001942131969e45d…` |
| B | `row-7` | 7 | OFFER-2 built (v2 OPEN — floating surplus): give S_A 2 to no one, want S_B 3 → AA_A | PASS | 13/13 | — |
| B | `row-8` | 8 | OwnerT — whose keys the maker never knew — takes OFFER-2 | PASS | 18/18 | `00f642666cfa697e…` |
| C | `setup` | — | fresh Manager; mint; OwnerN deposits S_A 6 → AA_A | PASS | 10/10 | `007bc62fd5ad4459…` `00575bc77016b558…` `0054d64b1b2691dc…` |
| C | `row-9` | 9 | Expiry: OFFER-3 held past its TTL, then taken — NC-303 | PASS | 9/9 | — |
| C | `row-11` | 11 | Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken | MEASURED | 6/6 | `0088c3e553fabdef…` |
| C | `row-12a` | 12 | Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL | MEASURED | 7/7 | `001cdab03b554127…` |
| C | `row-12b` | — | Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL | MEASURED | 7/7 | `00052ba09dc6bd98…` |
| C | `nc-306` | — | unbacked make: AA_A asks for more S_A than its cell holds, while the pool COULD cover it | PASS | 9/9 | — |
| C | `p-f310` | — | P-F310 replication: a FULLY BACKED offer at two custody cells | MEASURED | 5/5 | — |
| C | `closing` | — | Stage C closing state, both observation points | PASS | 4/4 | — |

## FAILED rows

None. Every row that ran passed every check it asserted.

## The spec's final table

Asserted PER STAGE under D-307: stage A's closing state matches the v1-only column (in parentheses in the spec) at the moment row 5 lands, and stage B reproduces every DELTA of the v2 column plus the exact end-state map sizes 1/2/0.

|  | S_A | S_B |
|---|---|---|
| OwnerN | 4 | 0 |
| OwnerT | 6 (4) | 0 (3) |
| AA_A | 0 (2) | 10 (7) |
| pool | 0 (2) | 10 (7) |

End-state map sizes, per the spec: 1 pool (2), 2 shielded cells, 0 unshielded — exactly.

Stage A asserts the v1-only column (the figures in parentheses) in its `final-table-v1` row, at the moment row 5 lands. Stage B asserts every DELTA of the v2 column plus the exact end-state map sizes 1 pool / 2 shielded cells / 0 unshielded. The two S_B TOTALS differ by the +7 that row 5 created on stage A's Manager, which is D-307 and nothing else.
