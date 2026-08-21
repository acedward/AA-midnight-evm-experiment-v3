# Swap step ledger — STAGE B

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:43:33.682Z

**VERDICT: GREEN**

**Carries:** rows 7–8 (P-OPEN — the owner-REQUIRED open offer)

Manager `95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

> This is NOT the spec's literal single-Manager 13-row table and is never presented as one.
> What every row asserts IS the spec's: the same amounts, the same expected changes.

## Rows

| Row | What | Status | Checks |
|---|---|---|---|
| `setup` | fresh Manager; mint; OwnerN deposits S_A 2 → AA_A | PASS | 13/13 |
| **7** `row-7` | OFFER-2 built (v2 OPEN — floating surplus): give S_A 2 to no one, want S_B 3 → AA_A | PASS | 13/13 |
| **8** `row-8` | OwnerT — whose keys the maker never knew — takes OFFER-2 | PASS | 18/18 |

## fresh Manager; mint; OwnerN deposits S_A 2 → AA_A (`setup`) — PASS

- **Spec action:** the stage-local equivalent of spec rows 0–2, at the amounts rows 7–8 need
- **Spec expects:** all maps size 0 → pool S_A=2; AA_A: S_A=2; maps 1/1/0
- **As run (D-307):** deposit is EXACTLY the give amount (2), so row 7's release empties the pool and row 8's "pool removed" is reproduced exactly rather than approximated
- **Transactions:** `00b1d8eb37215c2d1e1fc0fa62d88ad4f3c5379e914dc6c0d2ef53b89d6f07a837`, `00862395c60a462d56bda7c628907ad71113ba36693ff08d863a490347336c1f0c`, `001942131969e45d1588542d4efb925f761707cfcac74bd2b080ae3aa860a8fc22`

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | both accounts registered | PASS | accounts 2 |
| 2 | exact map sizes 0/0/0 | PASS | {"pools":0,"shieldedCells":0,"unshieldedCells":0} |
| 3 | pool(S_A) = 2 | PASS | observed 2 |
| 4 | pool(S_B) = absent | PASS | observed absent |
| 5 | cell AA_A/S_A = 2 | PASS | observed 2 |
| 6 | cell AA_A/S_B = absent | PASS | observed absent |
| 7 | exact map sizes 1/1/0 | PASS | {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| 8 | OwnerN holds 8 S_A | PASS | observed 8 |
| 9 | OwnerT holds 10 S_B | PASS | observed 10 |
| 10 | OP1 and OP2 agree on every cell | PASS | agree |
| 11 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 0 vs cells 0 |
| 12 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 13 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 10 + pool 0 |

**Before** (2026-08-20T12:37:43.034Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

**After** (2026-08-20T12:41:45.318Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `35703d447ba757d7…` / 40 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

## Row 7 — OFFER-2 built (v2 OPEN — floating surplus): give S_A 2 to no one, want S_B 3 → AA_A (`row-7`) — PASS

- **Spec action:** OFFER-2 built (v2 OPEN shape — floating surplus): give S_A 2 to no one the maker knows, want S_B 3 to AA_A
- **Spec expects:** surplus shape: imbalances(0) = +2 S_A, −3 S_B
- **As run (D-307):** on a FRESH Manager whose AA_A holds exactly 2 S_A, so the give is the pool's whole balance and row 8's "pool removed" is reproduced exactly. The spec's literal row 7 is ALSO attempted on Manager #1 at two cells, where it fails closed — that is P-F310, the deviation's own evidence

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | OFFER-2 was built and proven | PASS | 6701 ms |
| 2 | FR-302: imbalances(0) is EXACTLY +2 S_A and −3 S_B | PASS | {"shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532":"2","shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2":"-3"} |
| 3 | FR-302: no other segment carries any delta | PASS | [] |
| 4 | THE OPEN PROPERTY: the offer names NO recipient for colour A | PASS | terms.gives.recipient absent |
| 5 | THE OPEN PROPERTY, structurally: the maker process was never GIVEN a recipient — its input has no such field | PASS | maker input: {"label":"OFFER-2","managerAddress":"95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21","witness":"ownerA","shape":"floating-surplus","gives":{"colour":"b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532","value":"2"},"wants":{"colour":"bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2","value":"3"},"creditAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","makerAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","envelopeOut":"/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer","out":"/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row7-maker.report.json"} |
| 6 | FR-301: the maker attached NO DUST | PASS | — |
| 7 | FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 42109, 16346 bytes, sha 0fa8a7e463c27185… |
| 8 | a reader with NO NETWORK sees the +A surplus the terms declare | PASS | {"0/shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532":"2"} |
| 9 | the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -3 for token Shielded(ShieldedTokenType(bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2)) in segment 0; balance must be positive |
| 10 | building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| 11 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 0 vs cells 0 |
| 12 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 13 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 10 + pool 0 |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -3 for token Shielded(ShieldedTokenType(bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2)) in segment 0; balance must be positive
```

**Before** (2026-08-20T12:41:45.318Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `35703d447ba757d7…` / 40 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:41:58.024Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `35703d447ba757d7…` / 40 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "OFFER-2",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:41:47.857Z",
    "process": {
      "pid": 41960,
      "ppid": 41954
    },
    "spec": {
      "label": "OFFER-2",
      "managerAddress": "95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532",
        "value": "2"
      },
      "wants": {
        "colour": "bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row7-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21",
      "gives": {
        "colour": "b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532",
        "value": "2"
      },
      "wants": {
        "colour": "bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2",
        "value": "3",
        "nonce": "879ffca44804585c747bafbdd1a51f2864684f15aa0bed6084abf8deee5a7073"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:41:55.151Z",
      "expiresAt": "2026-08-20T13:41:55.151Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          47625
        ],
        "intentSegments": [
          47625
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
            "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
          },
          "47625": {}
        },
        "expectedAtSegment0": {
          "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
          "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "0fa8a7e463c271853983886384aef13a6fd112138eb8e14d721250ac51bf078e",
      "transactionBytes": 16346
    },
    "placement": {
      "segments": [
        0,
        47625
      ],
      "intentSegments": [
        47625
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
          "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
        },
        "47625": {}
      },
      "expectedAtSegment0": {
        "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
        "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6701,
    "transactionBytes": 16346,
    "contentAddress": "0fa8a7e463c271853983886384aef13a6fd112138eb8e14d721250ac51bf078e",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer"
  },
  "readerProcess": {
    "process": {
      "pid": 42109,
      "ppid": 42101,
      "network": "none used"
    },
    "file": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer",
    "envelopeBytes": 17791,
    "envelopeVerified": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21",
      "gives": {
        "colour": "b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532",
        "value": "2"
      },
      "wants": {
        "colour": "bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2",
        "value": "3",
        "nonce": "879ffca44804585c747bafbdd1a51f2864684f15aa0bed6084abf8deee5a7073"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:41:55.151Z",
      "expiresAt": "2026-08-20T13:41:55.151Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          47625
        ],
        "intentSegments": [
          47625
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
            "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
          },
          "47625": {}
        },
        "expectedAtSegment0": {
          "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
          "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "0fa8a7e463c271853983886384aef13a6fd112138eb8e14d721250ac51bf078e",
      "transactionBytes": 16346
    },
    "payloadBytes": 16346,
    "payloadSha256": "0fa8a7e463c271853983886384aef13a6fd112138eb8e14d721250ac51bf078e",
    "contentAddressMatches": true,
    "deserialized": true,
    "roundTripByteIdentical": true,
    "imbalances": {
      "0": {
        "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
        "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
      },
      "47625": {}
    },
    "deficits": {
      "0/shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
    },
    "surpluses": {
      "0/shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2"
    },
    "intentSegments": [
      47625
    ],
    "fallibleOfferSegments": [],
    "unsubmittableAlone": {
      "proven": true,
      "error": "invalid balance -3 for token Shielded(ShieldedTokenType(bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2)) in segment 0; balance must be positive"
    },
    "ok": true
  }
}
```

</details>

## Row 8 — OwnerT — whose keys the maker never knew — takes OFFER-2 (`row-8`) — PASS

- **Spec action:** OwnerT — whose keys the maker never knew — takes OFFER-2
- **Spec expects:** pool S_A 2→0 (pool removed), pool S_B 7→10; AA_A: S_A→0, S_B→10; OwnerT: +2 S_A (swept), −3 S_B, all DUST; maps 1/2/0
- **As run (D-307):** the S_B TOTALS differ (absent→3, AA_A 0→3) because the +7 they carry happened on Manager #1. Every DELTA (−2 S_A with the pool REMOVED, +3 S_B, OwnerT +2/−3, maker dust 0) and the exact end-state map sizes 1/2/0 are reproduced identically
- **Transactions:** `00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164`

> The pool for S_A is REMOVED, not zeroed: the release took the whole pooled coin, so the colour leaves the pool map entirely — while the ACCOUNT CELL stays at 0. That is why the end-state map sizes are 1 pool / 2 shielded cells / 0 unshielded, exactly as the spec's row 8 says.
> Deltas match the spec exactly; the S_B TOTALS do not, because the +7 the spec's figures carry was created by row 5 on stage A's Manager. That is deviation D-307 and nothing else.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the OPEN swap SETTLED | PASS | 00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164 |
| 2 | ONE transaction id settled it | PASS | 00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164 |
| 3 | THE OPEN CLAIM: a wallet the maker never named SWEPT the surplus | PASS | OwnerT S_A 0 -> 2 (expected 2) |
| 4 | the taker funded the −B deficit out of its own coins | PASS | OwnerT S_B 10 -> 7 |
| 5 | pool(S_A) = absent | PASS | observed absent |
| 6 | pool(S_B) = 3 | PASS | observed 3 |
| 7 | cell AA_A/S_A = 0 | PASS | observed 0 |
| 8 | cell AA_A/S_B = 3 | PASS | observed 3 |
| 9 | cell AA_B/S_A = absent | PASS | observed absent |
| 10 | exact map sizes 1/2/0 | PASS | {"pools":1,"shieldedCells":2,"unshieldedCells":0} |
| 11 | OwnerN holds 8 S_A | PASS | observed 8 |
| 12 | the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["47625"] -> 0; full map {"1":{"spends":1,"registrations":0},"47625":{"spends":0,"registrations":0}} |
| 13 | ANOTHER intent attached the dust, so the taker really paid | PASS | other segments ["1"] -> 1 |
| 14 | the taker's own balancer swept the surplus — nothing was left unswept | PASS | {} |
| 15 | OP1 and OP2 agree on every cell | PASS | agree |
| 16 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 0 vs cells 0; S_B: pool 3 vs cells 3 |
| 17 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 18 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 10 + pool 0; S_B: minted 10 = users 7 + pool 3 |

**Before** (2026-08-20T12:41:58.024Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `35703d447ba757d7…` / 40 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:43:33.681Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | absent | — |
| S_B | 3 | `879ffca44804585c…` / 41 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 0 | 0 |
| AA_A/S_B | 3 | 3 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"2","S_B":"7"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "takeReport": {
    "kind": "taker",
    "label": "row-8",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:42:00.126Z",
    "process": {
      "pid": 42224,
      "ppid": 42217
    },
    "opts": {
      "label": "row-8",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2",
          "amount": "3"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row8-taker.report.json"
    },
    "ok": true,
    "take": {
      "stage": "settled",
      "ok": true,
      "terms": {
        "version": 1,
        "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
        "shape": "floating-surplus",
        "circuitId": "openSwapShielded",
        "form": "pre-binding",
        "managerAddress": "95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21",
        "gives": {
          "colour": "b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532",
          "value": "2"
        },
        "wants": {
          "colour": "bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2",
          "value": "3",
          "nonce": "879ffca44804585c747bafbdd1a51f2864684f15aa0bed6084abf8deee5a7073"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:41:55.151Z",
        "expiresAt": "2026-08-20T13:41:55.151Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            47625
          ],
          "intentSegments": [
            47625
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
              "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
            },
            "47625": {}
          },
          "expectedAtSegment0": {
            "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
            "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "0fa8a7e463c271853983886384aef13a6fd112138eb8e14d721250ac51bf078e",
        "transactionBytes": 16346
      },
      "contentAddress": "0fa8a7e463c271853983886384aef13a6fd112138eb8e14d721250ac51bf078e",
      "secondsLeft": 3595,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2",
            "shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
          },
          "47625": {}
        },
        "deficits": {
          "0/shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2": "-3"
        },
        "surpluses": {
          "0/shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532": "2"
        },
        "declared": {
          "wants": "0/shielded:bf3656a8eb2d34b5250209000249d89c5fe634ed9ec4dee47b7b830c650fcfa2",
          "gives": "0/shielded:b4044b0c0bcf51955c683a8854c07243d1fbd6f6a900293f8ec8c8ef38f96532"
        },
        "matchesTerms": true
      },
      "settlement": {
        "route": "unbound",
        "ok": true,
        "txId": "00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164",
        "txHash": "a2aa8f41682ecb4f395ab5312d829adfbbf0b6a00456aac96cc1d0a0aeaef1f8",
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "760955388634170"
            },
            "1": {},
            "47625": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "47625": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            47625
          ]
        },
        "identifiers": [
          "006f0f527ea1f7b2643f7afabb2d0481fb2dfccd73fd953d717f2c7e7ca1786a27",
          "0081448c39d57281a70f8cfdb49e474f1c77867eee8c698df30e53657f272dfe41",
          "00bfcd04715455898e131b347a12d067595106187938920c7b43165d84e521020d",
          "00ec4eaca948f6614a6cc84a238d9ebb9860477c8c0fdbc05a2f937eb7c9ff0a30",
          "00a2cc64acfdff87a18f324d16fb34b14afb98043eb0c6b67857792e6fc93d528f",
          "00f415fe659457efc74799c8e1e433bdbaefe75f907b676386edc4bf2f30b326eb",
          "00f642666cfa697ea6e802c243423b440d7ee572a7e900fcb0f2614826de411164"
        ],
        "validations": [
          {
            "flags": {
              "enforceBalancing": false,
              "verifySignatures": false,
              "enforceLimits": false
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21)"
          }
        ],
        "recipeShape": {
          "keys": [
            "balancingTransaction",
            "baseTransaction",
            "blockData",
            "type"
          ],
          "baseTransaction": "present",
          "balancingTransaction": "present",
          "blockData": {
            "height": 228,
            "hash": "4263c6f663b19705d3"
          }
        },
        "finalizedIntentSegments": [
          1,
          47625
        ],
        "feesSpecks": "605881604603524"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "760955388634170"
          },
          "1": {},
          "47625": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "47625": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          47625
        ]
      }
    },
    "tookMs": 19052
  }
}
```

</details>

