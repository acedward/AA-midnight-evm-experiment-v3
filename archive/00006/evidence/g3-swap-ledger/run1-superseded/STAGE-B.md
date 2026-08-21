# Swap step ledger — STAGE B

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:01:45.674Z

**VERDICT: GREEN**

**Carries:** rows 7–8 (P-OPEN — the owner-REQUIRED open offer)

Manager `a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

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
- **Transactions:** `000db8cc05c73aeb0474ae9cf4a099aacb73238577199cb8a2e2ecc801827b10b9`, `00bc9a25025d3ce17c1106d64c0660ba6d531f84abe4b5831717166fc90312cf12`, `0063b931ff86293ce06bd1f99a312278a328f0319518416f9ae4ce57847a3eba9b`

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

**Before** (2026-08-20T11:55:54.995Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

**After** (2026-08-20T11:59:57.257Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a870804756663ba0…` / 39 |
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
| 1 | OFFER-2 was built and proven | PASS | 6523 ms |
| 2 | FR-302: imbalances(0) is EXACTLY +2 S_A and −3 S_B | PASS | {"shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767":"-3","shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834":"2"} |
| 3 | FR-302: no other segment carries any delta | PASS | [] |
| 4 | THE OPEN PROPERTY: the offer names NO recipient for colour A | PASS | terms.gives.recipient absent |
| 5 | THE OPEN PROPERTY, structurally: the maker process was never GIVEN a recipient — its input has no such field | PASS | maker input: {"label":"OFFER-2","managerAddress":"a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205","witness":"ownerA","shape":"floating-surplus","gives":{"colour":"bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834","value":"2"},"wants":{"colour":"2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767","value":"3"},"creditAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","makerAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","envelopeOut":"/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer","out":"/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row7-maker.report.json"} |
| 6 | FR-301: the maker attached NO DUST | PASS | — |
| 7 | FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 29621, 16346 bytes, sha 9b6929e8a59c55e1… |
| 8 | a reader with NO NETWORK sees the +A surplus the terms declare | PASS | {"0/shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834":"2"} |
| 9 | the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -3 for token Shielded(ShieldedTokenType(2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767)) in segment 0; balance must be positive |
| 10 | building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| 11 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 0 vs cells 0 |
| 12 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 13 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 10 + pool 0 |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -3 for token Shielded(ShieldedTokenType(2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767)) in segment 0; balance must be positive
```

**Before** (2026-08-20T11:59:57.257Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a870804756663ba0…` / 39 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:00:09.891Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a870804756663ba0…` / 39 |
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
    "utc": "2026-08-20T11:59:59.826Z",
    "process": {
      "pid": 29532,
      "ppid": 29518
    },
    "spec": {
      "label": "OFFER-2",
      "managerAddress": "a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834",
        "value": "2"
      },
      "wants": {
        "colour": "2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767",
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
      "managerAddress": "a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205",
      "gives": {
        "colour": "bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834",
        "value": "2"
      },
      "wants": {
        "colour": "2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767",
        "value": "3",
        "nonce": "5238c24d05e468b9b3888e92b6ed0840d1ae6a107ae90af8df7897724657183d"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:00:06.931Z",
      "expiresAt": "2026-08-20T13:00:06.931Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          45106
        ],
        "intentSegments": [
          45106
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3",
            "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
          },
          "45106": {}
        },
        "expectedAtSegment0": {
          "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2",
          "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "9b6929e8a59c55e15bbb6f044ca04279bfef8865ea003e40d3589517760d7773",
      "transactionBytes": 16346
    },
    "placement": {
      "segments": [
        0,
        45106
      ],
      "intentSegments": [
        45106
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3",
          "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
        },
        "45106": {}
      },
      "expectedAtSegment0": {
        "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2",
        "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6523,
    "transactionBytes": 16346,
    "contentAddress": "9b6929e8a59c55e15bbb6f044ca04279bfef8865ea003e40d3589517760d7773",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer"
  },
  "readerProcess": {
    "process": {
      "pid": 29621,
      "ppid": 29615,
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
      "managerAddress": "a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205",
      "gives": {
        "colour": "bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834",
        "value": "2"
      },
      "wants": {
        "colour": "2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767",
        "value": "3",
        "nonce": "5238c24d05e468b9b3888e92b6ed0840d1ae6a107ae90af8df7897724657183d"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:00:06.931Z",
      "expiresAt": "2026-08-20T13:00:06.931Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          45106
        ],
        "intentSegments": [
          45106
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3",
            "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
          },
          "45106": {}
        },
        "expectedAtSegment0": {
          "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2",
          "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "9b6929e8a59c55e15bbb6f044ca04279bfef8865ea003e40d3589517760d7773",
      "transactionBytes": 16346
    },
    "payloadBytes": 16346,
    "payloadSha256": "9b6929e8a59c55e15bbb6f044ca04279bfef8865ea003e40d3589517760d7773",
    "contentAddressMatches": true,
    "deserialized": true,
    "roundTripByteIdentical": true,
    "imbalances": {
      "0": {
        "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3",
        "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
      },
      "45106": {}
    },
    "deficits": {
      "0/shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3"
    },
    "surpluses": {
      "0/shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
    },
    "intentSegments": [
      45106
    ],
    "fallibleOfferSegments": [],
    "unsubmittableAlone": {
      "proven": true,
      "error": "invalid balance -3 for token Shielded(ShieldedTokenType(2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767)) in segment 0; balance must be positive"
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
- **Transactions:** `0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0`

> The pool for S_A is REMOVED, not zeroed: the release took the whole pooled coin, so the colour leaves the pool map entirely — while the ACCOUNT CELL stays at 0. That is why the end-state map sizes are 1 pool / 2 shielded cells / 0 unshielded, exactly as the spec's row 8 says.
> Deltas match the spec exactly; the S_B TOTALS do not, because the +7 the spec's figures carry was created by row 5 on stage A's Manager. That is deviation D-307 and nothing else.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the OPEN swap SETTLED | PASS | 0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0 |
| 2 | ONE transaction id settled it | PASS | 0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0 |
| 3 | THE OPEN CLAIM: a wallet the maker never named SWEPT the surplus | PASS | OwnerT S_A 0 -> 2 (expected 2) |
| 4 | the taker funded the −B deficit out of its own coins | PASS | OwnerT S_B 10 -> 7 |
| 5 | pool(S_A) = absent | PASS | observed absent |
| 6 | pool(S_B) = 3 | PASS | observed 3 |
| 7 | cell AA_A/S_A = 0 | PASS | observed 0 |
| 8 | cell AA_A/S_B = 3 | PASS | observed 3 |
| 9 | cell AA_B/S_A = absent | PASS | observed absent |
| 10 | exact map sizes 1/2/0 | PASS | {"pools":1,"shieldedCells":2,"unshieldedCells":0} |
| 11 | OwnerN holds 8 S_A | PASS | observed 8 |
| 12 | the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["45106"] -> 0; full map {"1":{"spends":1,"registrations":0},"45106":{"spends":0,"registrations":0}} |
| 13 | ANOTHER intent attached the dust, so the taker really paid | PASS | other segments ["1"] -> 1 |
| 14 | the taker's own balancer swept the surplus — nothing was left unswept | PASS | {} |
| 15 | OP1 and OP2 agree on every cell | PASS | agree |
| 16 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 0 vs cells 0; S_B: pool 3 vs cells 3 |
| 17 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 18 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 10 + pool 0; S_B: minted 10 = users 7 + pool 3 |

**Before** (2026-08-20T12:00:09.891Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a870804756663ba0…` / 39 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:01:45.674Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | absent | — |
| S_B | 3 | `5238c24d05e468b9…` / 43 |

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
    "utc": "2026-08-20T12:00:12.054Z",
    "process": {
      "pid": 29692,
      "ppid": 29684
    },
    "opts": {
      "label": "row-8",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-2-open.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767",
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
        "managerAddress": "a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205",
        "gives": {
          "colour": "bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834",
          "value": "2"
        },
        "wants": {
          "colour": "2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767",
          "value": "3",
          "nonce": "5238c24d05e468b9b3888e92b6ed0840d1ae6a107ae90af8df7897724657183d"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:00:06.931Z",
        "expiresAt": "2026-08-20T13:00:06.931Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            45106
          ],
          "intentSegments": [
            45106
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3",
              "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
            },
            "45106": {}
          },
          "expectedAtSegment0": {
            "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2",
            "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "9b6929e8a59c55e15bbb6f044ca04279bfef8865ea003e40d3589517760d7773",
        "transactionBytes": 16346
      },
      "contentAddress": "9b6929e8a59c55e15bbb6f044ca04279bfef8865ea003e40d3589517760d7773",
      "secondsLeft": 3594,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3",
            "shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
          },
          "45106": {}
        },
        "deficits": {
          "0/shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767": "-3"
        },
        "surpluses": {
          "0/shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834": "2"
        },
        "declared": {
          "wants": "0/shielded:2e92b0c97b9fa964f8ff302af8e43414badd56ce23b943a3ceadc3c3b51e6767",
          "gives": "0/shielded:bb2aee675bfaba80ce6a15d7b5f8d4f314ecbdf952e150c08d66d250a4e5c834"
        },
        "matchesTerms": true
      },
      "settlement": {
        "route": "unbound",
        "ok": true,
        "txId": "0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0",
        "txHash": "4c9c0eb674084b127970c19efa48f1eda6017fdc2067afd7be5d0f08bbd00d73",
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "760960014311284"
            },
            "1": {},
            "45106": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "45106": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            45106
          ]
        },
        "identifiers": [
          "00443f69e855fc81f494f9444ede25359ae6528e0bee367bbfb8a908b7b559d624",
          "00a55bd224e1555048966228964c0b9f3ac80d0d3db11497d73fd746b8c6119734",
          "0094278cc57324850b930bcadc670abca935d47530a991e3c30be4427f93c6fce4",
          "005133a19e7e967536adf577210d9e1c304c3d30aad1a827ead80983d91ad4c335",
          "0073bea8061c30f3f38fc26a36595be4ae4103a1e699bb6b1dc45200acb17235af",
          "00b1aefe71589b3c3198b65660e8e5b2a2dfdf23168217418b2658c16fecaf0e0b",
          "0068329126cd32fde8d992bc0562d2cb634e0624ba4e8d1b5413d2960e886981e0"
        ],
        "validations": [
          {
            "flags": {
              "enforceBalancing": false,
              "verifySignatures": false,
              "enforceLimits": false
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205)"
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
            "height": 236,
            "hash": "41696914d6091a909a"
          }
        },
        "finalizedIntentSegments": [
          1,
          45106
        ],
        "feesSpecks": "605875676276470"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "760960014311284"
          },
          "1": {},
          "45106": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "45106": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          45106
        ]
      }
    },
    "tookMs": 19096
  }
}
```

</details>

