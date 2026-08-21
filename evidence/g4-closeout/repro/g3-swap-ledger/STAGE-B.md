# Swap step ledger — STAGE B

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T16:01:45.439Z

**VERDICT: GREEN**

**Carries:** rows 7–8 (P-OPEN — the owner-REQUIRED open offer)

Manager `eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

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
- **Transactions:** `00a621480993fb039bc0f85c1723f6027f0790503b16624bb438b01f472751cac1`, `00a3f5d900bd32e52164bc964a959328350fa3997393aa2540101b0c2be80ea1d0`, `00c877df40562e891514dc0b2876430876a13515729a24555d4fdb7d224a207eeb`

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

**Before** (2026-08-20T15:55:57.286Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

**After** (2026-08-20T15:59:58.148Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `ed903a77a0fc2d67…` / 39 |
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
| 1 | OFFER-2 was built and proven | PASS | 6694 ms |
| 2 | FR-302: imbalances(0) is EXACTLY +2 S_A and −3 S_B | PASS | {"shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9":"-3","shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e":"2"} |
| 3 | FR-302: no other segment carries any delta | PASS | [] |
| 4 | THE OPEN PROPERTY: the offer names NO recipient for colour A | PASS | terms.gives.recipient absent |
| 5 | THE OPEN PROPERTY, structurally: the maker process was never GIVEN a recipient — its input has no such field | PASS | maker input: {"label":"OFFER-2","managerAddress":"eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195","witness":"ownerA","shape":"floating-surplus","gives":{"colour":"d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e","value":"2"},"wants":{"colour":"afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9","value":"3"},"creditAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","makerAccount":"009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","envelopeOut":"/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-2-open.offer","out":"/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row7-maker.report.json"} |
| 6 | FR-301: the maker attached NO DUST | PASS | — |
| 7 | FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 80922, 16346 bytes, sha 5330ab5a75b13aed… |
| 8 | a reader with NO NETWORK sees the +A surplus the terms declare | PASS | {"0/shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e":"2"} |
| 9 | the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -3 for token Shielded(ShieldedTokenType(afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9)) in segment 0; balance must be positive |
| 10 | building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| 11 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 0 vs cells 0 |
| 12 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 13 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 10 + pool 0 |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -3 for token Shielded(ShieldedTokenType(afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9)) in segment 0; balance must be positive
```

**Before** (2026-08-20T15:59:58.148Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `ed903a77a0fc2d67…` / 39 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T16:00:11.434Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `ed903a77a0fc2d67…` / 39 |
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
    "utc": "2026-08-20T16:00:01.129Z",
    "process": {
      "pid": 80647,
      "ppid": 80638
    },
    "spec": {
      "label": "OFFER-2",
      "managerAddress": "eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e",
        "value": "2"
      },
      "wants": {
        "colour": "afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-2-open.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row7-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195",
      "gives": {
        "colour": "d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e",
        "value": "2"
      },
      "wants": {
        "colour": "afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9",
        "value": "3",
        "nonce": "f560ec5d0cc4b64bf8b725e8c7ae60cede0837659da6dbddf8ecbebd6b5dc4b7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:00:08.431Z",
      "expiresAt": "2026-08-20T17:00:08.431Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          31112
        ],
        "intentSegments": [
          31112
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3",
            "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
          },
          "31112": {}
        },
        "expectedAtSegment0": {
          "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2",
          "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "5330ab5a75b13aed7d14d906a50911410c13e0ef4a4a3219fb8158261215c030",
      "transactionBytes": 16346
    },
    "placement": {
      "segments": [
        0,
        31112
      ],
      "intentSegments": [
        31112
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3",
          "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
        },
        "31112": {}
      },
      "expectedAtSegment0": {
        "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2",
        "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6694,
    "transactionBytes": 16346,
    "contentAddress": "5330ab5a75b13aed7d14d906a50911410c13e0ef4a4a3219fb8158261215c030",
    "published": true,
    "envelopeFile": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-2-open.offer"
  },
  "readerProcess": {
    "process": {
      "pid": 80922,
      "ppid": 80901,
      "network": "none used"
    },
    "file": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-2-open.offer",
    "envelopeBytes": 17791,
    "envelopeVerified": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195",
      "gives": {
        "colour": "d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e",
        "value": "2"
      },
      "wants": {
        "colour": "afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9",
        "value": "3",
        "nonce": "f560ec5d0cc4b64bf8b725e8c7ae60cede0837659da6dbddf8ecbebd6b5dc4b7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:00:08.431Z",
      "expiresAt": "2026-08-20T17:00:08.431Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          31112
        ],
        "intentSegments": [
          31112
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3",
            "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
          },
          "31112": {}
        },
        "expectedAtSegment0": {
          "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2",
          "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "5330ab5a75b13aed7d14d906a50911410c13e0ef4a4a3219fb8158261215c030",
      "transactionBytes": 16346
    },
    "payloadBytes": 16346,
    "payloadSha256": "5330ab5a75b13aed7d14d906a50911410c13e0ef4a4a3219fb8158261215c030",
    "contentAddressMatches": true,
    "deserialized": true,
    "roundTripByteIdentical": true,
    "imbalances": {
      "0": {
        "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3",
        "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
      },
      "31112": {}
    },
    "deficits": {
      "0/shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3"
    },
    "surpluses": {
      "0/shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
    },
    "intentSegments": [
      31112
    ],
    "fallibleOfferSegments": [],
    "unsubmittableAlone": {
      "proven": true,
      "error": "invalid balance -3 for token Shielded(ShieldedTokenType(afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9)) in segment 0; balance must be positive"
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
- **Transactions:** `003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f`

> The pool for S_A is REMOVED, not zeroed: the release took the whole pooled coin, so the colour leaves the pool map entirely — while the ACCOUNT CELL stays at 0. That is why the end-state map sizes are 1 pool / 2 shielded cells / 0 unshielded, exactly as the spec's row 8 says.
> Deltas match the spec exactly; the S_B TOTALS do not, because the +7 the spec's figures carry was created by row 5 on stage A's Manager. That is deviation D-307 and nothing else.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the OPEN swap SETTLED | PASS | 003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f |
| 2 | ONE transaction id settled it | PASS | 003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f |
| 3 | THE OPEN CLAIM: a wallet the maker never named SWEPT the surplus | PASS | OwnerT S_A 0 -> 2 (expected 2) |
| 4 | the taker funded the −B deficit out of its own coins | PASS | OwnerT S_B 10 -> 7 |
| 5 | pool(S_A) = absent | PASS | observed absent |
| 6 | pool(S_B) = 3 | PASS | observed 3 |
| 7 | cell AA_A/S_A = 0 | PASS | observed 0 |
| 8 | cell AA_A/S_B = 3 | PASS | observed 3 |
| 9 | cell AA_B/S_A = absent | PASS | observed absent |
| 10 | exact map sizes 1/2/0 | PASS | {"pools":1,"shieldedCells":2,"unshieldedCells":0} |
| 11 | OwnerN holds 8 S_A | PASS | observed 8 |
| 12 | the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["31112"] -> 0; full map {"1":{"spends":1,"registrations":0},"31112":{"spends":0,"registrations":0}} |
| 13 | ANOTHER intent attached the dust, so the taker really paid | PASS | other segments ["1"] -> 1 |
| 14 | the taker's own balancer swept the surplus — nothing was left unswept | PASS | {} |
| 15 | OP1 and OP2 agree on every cell | PASS | agree |
| 16 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 0 vs cells 0; S_B: pool 3 vs cells 3 |
| 17 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 18 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 10 + pool 0; S_B: minted 10 = users 7 + pool 3 |

**Before** (2026-08-20T16:00:11.434Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `ed903a77a0fc2d67…` / 39 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"8","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T16:01:45.439Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | absent | — |
| S_B | 3 | `f560ec5d0cc4b64b…` / 43 |

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
    "utc": "2026-08-20T16:00:13.666Z",
    "process": {
      "pid": 81041,
      "ppid": 81035
    },
    "opts": {
      "label": "row-8",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-2-open.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9",
          "amount": "3"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row8-taker.report.json"
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
        "managerAddress": "eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195",
        "gives": {
          "colour": "d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e",
          "value": "2"
        },
        "wants": {
          "colour": "afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9",
          "value": "3",
          "nonce": "f560ec5d0cc4b64bf8b725e8c7ae60cede0837659da6dbddf8ecbebd6b5dc4b7"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T16:00:08.431Z",
        "expiresAt": "2026-08-20T17:00:08.431Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            31112
          ],
          "intentSegments": [
            31112
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3",
              "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
            },
            "31112": {}
          },
          "expectedAtSegment0": {
            "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2",
            "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "5330ab5a75b13aed7d14d906a50911410c13e0ef4a4a3219fb8158261215c030",
        "transactionBytes": 16346
      },
      "contentAddress": "5330ab5a75b13aed7d14d906a50911410c13e0ef4a4a3219fb8158261215c030",
      "secondsLeft": 3594,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3",
            "shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
          },
          "31112": {}
        },
        "deficits": {
          "0/shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9": "-3"
        },
        "surpluses": {
          "0/shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e": "2"
        },
        "declared": {
          "wants": "0/shielded:afb60d8c42ff95b2fa79d9c85f39a3ad70968fc0013704b3ff732e84c88283a9",
          "gives": "0/shielded:d9f85a58a1142a28d67ef356efafa68050932142a69339bf0ac81ef949af2d4e"
        },
        "matchesTerms": true
      },
      "settlement": {
        "route": "unbound",
        "ok": true,
        "txId": "003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f",
        "txHash": "2ba62205258d7d5acc2c5f2242b56a37ad1cd0b5416bca23d4fdb3220de84e6f",
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "761472173242474"
            },
            "1": {},
            "31112": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "31112": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            31112
          ]
        },
        "identifiers": [
          "004c84e40453d7b8da69bb53e317f06f7cd83e5f1e437c4936d3616344a91cf4c2",
          "00cbd4878e9925795b88fd4115eb0dd5e9cc777c9e90aa8b90c2a5417ec2b2db20",
          "00c6d15c7786304701099ffe5d6d473d5a855105adcc40a15162a2b28701520946",
          "001b48114a05b1c4d9e72c865ec9cb2b0c902d751728d4721c0fdcd6e15dcf180d",
          "0053ad158b43f4dc5d023d3f97db5afa466ddaa0d70b1e9ccedc39226e68c483f2",
          "000b7223238e893d1f2072bba4c463665362f09707de981b60f32a76ea66dcf4d9",
          "003929da6f91ef0112ee71dd8e9e3ce23111213c833e884e96c0bc9b7cd88d7d5f"
        ],
        "validations": [
          {
            "flags": {
              "enforceBalancing": false,
              "verifySignatures": false,
              "enforceLimits": false
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195)"
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
            "height": 226,
            "hash": "3f4d98caefcd78a9cf"
          }
        },
        "finalizedIntentSegments": [
          1,
          31112
        ],
        "feesSpecks": "606304008362030"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "761472173242474"
          },
          "1": {},
          "31112": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "31112": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          31112
        ]
      }
    },
    "tookMs": 17073
  }
}
```

</details>

