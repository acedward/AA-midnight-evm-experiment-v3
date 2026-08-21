# Swap step ledger — STAGE A

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T15:52:57.422Z

**VERDICT: GREEN**

**Carries:** rows 0–6, row 10 (NC-304), NC-305, P-F310

Manager `ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

> This is NOT the spec's literal single-Manager 13-row table and is never presented as one.
> What every row asserts IS the spec's: the same amounts, the same expected changes.

## Rows

| Row | What | Status | Checks |
|---|---|---|---|
| **0** `row-0` | Manager v4 deployed; AA_A and AA_B registered | PASS | 4/4 |
| **1** `row-1` | Minters TOKA/TOKB deployed; S_A 10 → OwnerN, S_B 10 → OwnerT | PASS | 10/10 |
| **2** `row-2` | OwnerN deposits S_A 6 → AA_A | PASS | 11/11 |
| `nc-305` | unauthorized make: OwnerN's witness attempts an offer on AA_A's S_A | PASS | 7/7 |
| **3** `row-3` | OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 → AA_A | PASS | 12/12 |
| **4** `row-4` | OFFER-1 submitted DIRECTLY (unbalanced) — NC-301 | PASS | 7/7 |
| **5** `row-5` | OwnerT takes OFFER-1: stock balance → merge → submit | PASS | 20/20 |
| `final-table-v1` | the spec's final table, v1-only column (in parentheses there) | PASS | 12/12 |
| **6** `row-6` | Double-take: OFFER-1 balanced and submitted again — NC-302 | PASS | 6/6 |
| **10** `row-10` | Tamper: OFFER-1's retained bytes, one byte flipped, taken — NC-304 | PASS | 7/7 |
| `p-f310` | D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells | MEASURED | 7/7 |
| `closing` | Stage A closing state, both observation points | PASS | 13/13 |

## Row 0 — Manager v4 deployed; AA_A and AA_B registered (`row-0`) — PASS

- **Spec action:** Manager v4 deployed; AA_A, AA_B registered
- **Spec expects:** all maps size 0
- **As run (D-307):** run three times — once per stage — because each stage needs its own ≤1-cell budget (F-310)

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | both accounts are registered | PASS | accounts: 2 |
| 2 | exact map sizes 0/0/0 | PASS | {"pools":0,"shieldedCells":0,"unshieldedCells":0} |
| 3 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | (no colours yet) |
| 4 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |

**After** (2026-08-20T15:42:55.344Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

## Row 1 — Minters TOKA/TOKB deployed; S_A 10 → OwnerN, S_B 10 → OwnerT (`row-1`) — PASS

- **Spec action:** Minters TOKA, TOKB deployed; mint S_A 10 → OwnerN; mint S_B 10 → OwnerT
- **Spec expects:** Manager state unchanged
- **As run (D-307):** per stage, with that stage's own fresh colours; stage C mints S_A 12 so its five negatives each have a give to make
- **Transactions:** `00eb6fdafff4edfc15fe3add3cc58ef1baa3d9548168c668980d17854a062ebbf2`, `00a07a4f2f7ca5730ad19847470bae25a6807b2c944d4c1646b09ffc951f4ac40c`

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Manager state UNCHANGED by minting: all three maps are still size 0 | PASS | {"pools":0,"shieldedCells":0,"unshieldedCells":0} |
| 2 | pool(S_A) = absent | PASS | observed absent |
| 3 | pool(S_B) = absent | PASS | observed absent |
| 4 | cell AA_A/S_A = absent | PASS | observed absent |
| 5 | cell AA_A/S_B = absent | PASS | observed absent |
| 6 | OwnerN holds 10 S_A | PASS | observed 10 |
| 7 | OwnerT holds 10 S_B | PASS | observed 10 |
| 8 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 0 vs cells 0; S_B: pool 0 vs cells 0 |
| 9 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 10 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 10 + pool 0; S_B: minted 10 = users 10 + pool 0 |

**After** (2026-08-20T15:45:20.255Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | absent | — |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | absent | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"10","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

## Row 2 — OwnerN deposits S_A 6 → AA_A (`row-2`) — PASS

- **Spec action:** OwnerN deposits S_A 6 → AA_A
- **Spec expects:** pool S_A=6; AA_A: S_A=6; maps 1/1/0
- **Transactions:** `0005aed2f2bf50390defa028b8c1085287677bfa8259ae0b1e6498230c930acaa7`

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | pool(S_A) = 6 | PASS | observed 6 |
| 2 | pool(S_B) = absent | PASS | observed absent |
| 3 | cell AA_A/S_A = 6 | PASS | observed 6 |
| 4 | cell AA_A/S_B = absent | PASS | observed absent |
| 5 | cell AA_B/S_A = absent | PASS | observed absent |
| 6 | exact map sizes 1/1/0 | PASS | {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| 7 | OwnerN holds 4 S_A | PASS | observed 4 |
| 8 | OP1 and OP2 agree on every cell | PASS | agree |
| 9 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 6 vs cells 6; S_B: pool 0 vs cells 0 |
| 10 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 11 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 4 + pool 6; S_B: minted 10 = users 10 + pool 0 |

**After** (2026-08-20T15:46:57.635Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | 6 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

## unauthorized make: OwnerN's witness attempts an offer on AA_A's S_A (`nc-305`) — PASS

- **Spec action:** NC-305: OwnerN's witness (unregistered for AA_A) attempts to open an offer on AA_A's S_A
- **Spec expects:** refused at the choke point; no state

> the maker process classified the refusal as `circuit-guard-refusal`

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the offer build was REFUSED | PASS | ok=false |
| 2 | refused at THE WITNESS CHOKE POINT — the verbatim error names the unregistered witness | PASS | failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'openSwapShielded' |
| 3 | nothing was published | PASS | published=false |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
failed assert: caller's owner witness matches no registered account | cause: Error executing circuit 'openSwapShielded'
```

**Before** (2026-08-20T15:46:57.635Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | 6 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:47:01.903Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "NC-305",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:47:00.581Z",
    "process": {
      "pid": 64630,
      "ppid": 64624
    },
    "spec": {
      "label": "NC-305",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "witness": "ownerN",
      "shape": "named-taker",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "4"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/nc305-maker.report.json"
    },
    "ok": false,
    "error": "failed assert: caller's owner witness matches no registered account | cause: Error executing circuit 'openSwapShielded'",
    "errorKind": "circuit-guard-refusal",
    "published": false
  }
}
```

</details>

## Row 3 — OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 → AA_A (`row-3`) — PASS

- **Spec action:** OFFER-1 built (v1 named-taker): give S_A 4 to OwnerT, want S_B 7 credited to AA_A; proven; serialized to file; no DUST
- **Spec expects:** NO on-chain change; envelope round-trips byte-identically; imbalances(0) = exactly −7 S_B (the A leg is internally balanced); no other segment has deltas

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | OFFER-1 was built and proven | PASS | 10346 ms |
| 2 | the maker ran in a DIFFERENT OS PROCESS from this stage | PASS | maker pid 64793, stage pid 53579 |
| 3 | FR-302: imbalances(0) is EXACTLY {"shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-7"} | PASS | {"shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-7"} |
| 4 | FR-302: no other segment carries any delta | PASS | [] |
| 5 | FR-301: the maker attached NO DUST | PASS | — |
| 6 | FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 65111, 26819 bytes, sha ba9c7f69231f7567… |
| 7 | a reader with NO NETWORK sees exactly the deficit the terms declare | PASS | {"0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-7"} |
| 8 | the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive |
| 9 | building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} pools {"S_A":"6","S_B":"absent"} |
| 10 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 6 vs cells 6; S_B: pool 0 vs cells 0 |
| 11 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 12 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 4 + pool 6; S_B: minted 10 = users 10 + pool 0 |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive
```

**Before** (2026-08-20T15:46:57.635Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | 6 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:47:17.747Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "OFFER-1",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:47:04.020Z",
    "process": {
      "pid": 64793,
      "ppid": 64780
    },
    "spec": {
      "label": "OFFER-1",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "4"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row3-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "4",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "7",
        "nonce": "c5fa646e611c175dc83034cfbe973b55910a2336e67dbd3fe2f0fcdc82880010"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T15:47:14.882Z",
      "expiresAt": "2026-08-20T16:47:14.882Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          32816
        ],
        "intentSegments": [
          32816
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "32816": {}
        },
        "expectedAtSegment0": {
          "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
      "transactionBytes": 26819
    },
    "placement": {
      "segments": [
        0,
        32816
      ],
      "intentSegments": [
        32816
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
        },
        "32816": {}
      },
      "expectedAtSegment0": {
        "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 10346,
    "transactionBytes": 26819,
    "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
    "published": true,
    "envelopeFile": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1.offer"
  },
  "readerProcess": {
    "process": {
      "pid": 65111,
      "ppid": 65105,
      "network": "none used"
    },
    "file": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1.offer",
    "envelopeBytes": 28217,
    "envelopeVerified": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "4",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "7",
        "nonce": "c5fa646e611c175dc83034cfbe973b55910a2336e67dbd3fe2f0fcdc82880010"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T15:47:14.882Z",
      "expiresAt": "2026-08-20T16:47:14.882Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          32816
        ],
        "intentSegments": [
          32816
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "32816": {}
        },
        "expectedAtSegment0": {
          "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
      "transactionBytes": 26819
    },
    "payloadBytes": 26819,
    "payloadSha256": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
    "contentAddressMatches": true,
    "deserialized": true,
    "roundTripByteIdentical": true,
    "imbalances": {
      "0": {
        "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
      },
      "32816": {}
    },
    "deficits": {
      "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
    },
    "surpluses": {},
    "intentSegments": [
      32816
    ],
    "fallibleOfferSegments": [],
    "unsubmittableAlone": {
      "proven": true,
      "error": "invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive"
    },
    "ok": true
  }
}
```

</details>

## Row 4 — OFFER-1 submitted DIRECTLY (unbalanced) — NC-301 (`row-4`) — PASS

- **Spec action:** OFFER-1 submitted DIRECTLY (unbalanced)
- **Spec expects:** REFUSED — verbatim node/ledger error recorded; no state created
- **As run (D-307):** submitted by a THIRD process holding nothing but the envelope file and its own seed, in two forms (unbound as published, and bound) — plus the ledger's own offline `wellFormed` verdict

> the NODE itself refused 1 of 2 attempt(s): as-published (unbound, D-306) -> Custom error: 1 (LedgerApiError::Deserialization(DeserializationError::Transaction) (types.rs:363))

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | NO submission of the unbalanced offer was accepted | PASS | 0 accepted |
| 2 | the LEDGER's own offline verdict refuses it, verbatim | PASS | invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive |
| 3 | every submission attempt was refused with a verbatim error (the spec asks for node OR ledger) | PASS | as-published (unbound, D-306): node (submitted and refused, Custom error: 1) \| bound: unclassified — the facade replaced the cause with its own wrapper; see errorDump |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive
```

```
[as-published (unbound, D-306)] 1010: Invalid Transaction: Custom error: 1
```

```
[bound] Transaction submission error
```

**Before** (2026-08-20T15:47:17.747Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:47:22.613Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "directSubmitReport": {
    "kind": "direct-submit",
    "label": "row-4",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:47:20.071Z",
    "process": {
      "pid": 65234,
      "ppid": 65224
    },
    "opts": {
      "label": "row-4",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1.offer",
      "submitterSeedName": "feePayer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row4-direct.report.json"
    },
    "attempts": [
      {
        "form": "as-published (unbound, D-306)",
        "submitted": false,
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 1,
          "decoded": "LedgerApiError::Deserialization(DeserializationError::Transaction) (types.rs:363)",
          "verbatim": "1010: Invalid Transaction: Custom error: 1",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 1\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMe",
        "layer": "node (submitted and refused, Custom error: 1)"
      },
      {
        "form": "bound",
        "submitted": false,
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": null,
          "decoded": "(no numeric code found)",
          "verbatim": null,
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27 {\n    [cause]: Error: disconnected from ws://127.0.0.1:42147/: 1000:: Normal Closure\n        at #onSocketClose (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:371:23)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onSocketClose (node:internal/deps/undici/undici:13911:9)\n        at Socket.onSocketClose (node:internal/deps/undici/undici:13611:72)\n        at Socket.emit (node:events:520:35)\n        at TCP.<anonymous> (node:net:346:12)\n  }\n}",
        "layer": "unclassified — the facade replaced the cause with its own wrapper; see errorDump"
      }
    ],
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "4",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "7",
        "nonce": "c5fa646e611c175dc83034cfbe973b55910a2336e67dbd3fe2f0fcdc82880010"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T15:47:14.882Z",
      "expiresAt": "2026-08-20T16:47:14.882Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          32816
        ],
        "intentSegments": [
          32816
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "32816": {}
        },
        "expectedAtSegment0": {
          "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
      "transactionBytes": 26819
    },
    "payloadBytes": 26819,
    "imbalances": {
      "0": {
        "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
      },
      "32816": {}
    },
    "deficits": {
      "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
    },
    "offlineWellFormed": {
      "refused": true,
      "verbatim": "invalid balance -7 for token Shielded(ShieldedTokenType(8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206)) in segment 0; balance must be positive"
    },
    "ok": true
  }
}
```

</details>

## Row 5 — OwnerT takes OFFER-1: stock balance → merge → submit (`row-5`) — PASS

- **Spec action:** OwnerT takes OFFER-1: stock balance → merge → submit
- **Spec expects:** HEADLINE — ONE tx id: pool S_A 6→2; pool S_B created =7; AA_A: S_A 6→2, S_B 0→7; OwnerT: +4 S_A, −7 S_B, paid ALL DUST; maker DUST spend 0; maps 2/2/0
- **As run (D-307):** maker DUST spend 0 is read from the settled transaction's PER-INTENT dust actions, not from `dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably paying fees (Plan 02 S6)
- **Transactions:** `00b917f91daaad575d082753019d47df8a21d8cc50a56b9d7d347214229109e987`

> maker DUST spend 0 is read from the settled transaction's PER-INTENT dust actions, never from `dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably paying fees (Plan 02 finding, spike S6). The maker is funded and DUST-registered on purpose, so the claim is about a wallet that COULD have paid.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the swap SETTLED | PASS | 00b917f91daaad575d082753019d47df8a21d8cc50a56b9d7d347214229109e987 |
| 2 | ONE transaction id settled the whole swap | PASS | tx 00b917f91daaad575d082753019d47df8a21d8cc50a56b9d7d347214229109e987; merged intent segments [1,32816] |
| 3 | pool(S_A) = 2 | PASS | observed 2 |
| 4 | pool(S_B) = 7 | PASS | observed 7 |
| 5 | cell AA_A/S_A = 2 | PASS | observed 2 |
| 6 | cell AA_A/S_B = 7 | PASS | observed 7 |
| 7 | cell AA_B/S_A = absent | PASS | observed absent |
| 8 | cell AA_B/S_B = absent | PASS | observed absent |
| 9 | exact map sizes 2/2/0 | PASS | {"pools":2,"shieldedCells":2,"unshieldedCells":0} |
| 10 | OwnerT holds 4 S_A | PASS | observed 4 |
| 11 | OwnerT holds 3 S_B | PASS | observed 3 |
| 12 | OwnerN holds 4 S_A | PASS | observed 4 |
| 13 | the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["32816"] -> 0 dust spends; full map {"1":{"spends":1,"registrations":0},"32816":{"spends":0,"registrations":0}} |
| 14 | ANOTHER intent DID attach dust, so the fee was really paid — by the taker | PASS | other segments ["1"] -> 1 dust spends |
| 15 | the merged transaction balanced with nothing left unswept | PASS | {} |
| 16 | the taker ran in a DIFFERENT OS PROCESS from the maker | PASS | taker pid 65392 vs maker pid 64793 |
| 17 | OP1 and OP2 agree on every cell | PASS | agree |
| 18 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 7 vs cells 7 |
| 19 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 20 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 3 + pool 7 |

**Before** (2026-08-20T15:47:22.613Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `270ee3ea99e99ce6…` / 30 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:48:56.696Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | 7 | 7 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"3"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "takeReport": {
    "kind": "taker",
    "label": "row-5",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:47:24.788Z",
    "process": {
      "pid": 65392,
      "ppid": 65386
    },
    "opts": {
      "label": "row-5",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
          "amount": "7"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row5-taker.report.json"
    },
    "ok": true,
    "take": {
      "stage": "settled",
      "ok": true,
      "terms": {
        "version": 1,
        "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
        "shape": "named-taker",
        "circuitId": "openSwapShielded",
        "form": "pre-binding",
        "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
        "gives": {
          "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
          "value": "4",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
          "value": "7",
          "nonce": "c5fa646e611c175dc83034cfbe973b55910a2336e67dbd3fe2f0fcdc82880010"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T15:47:14.882Z",
        "expiresAt": "2026-08-20T16:47:14.882Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            32816
          ],
          "intentSegments": [
            32816
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
            },
            "32816": {}
          },
          "expectedAtSegment0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
        "transactionBytes": 26819
      },
      "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
      "secondsLeft": 3590,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "32816": {}
        },
        "deficits": {
          "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206"
        },
        "matchesTerms": true
      },
      "settlement": {
        "route": "unbound",
        "ok": true,
        "txId": "00b917f91daaad575d082753019d47df8a21d8cc50a56b9d7d347214229109e987",
        "txHash": "8dc9e918f2149f0e1f2f2c7fc75ab88f0564f35d500d00113200ae775a410b60",
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "974301746642504"
            },
            "1": {},
            "32816": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "32816": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            32816
          ]
        },
        "identifiers": [
          "00b4bb798198278e5a6236947ff1405caf7998a6f0784f8c41f3e71020e1593b67",
          "006cbb710ea324c474118994b1f8a3022d3b804715ab0ae7a105a6420caaf45fb3",
          "004a1b69e5559104b56b9b2ab438f4d02febb3b7629d216890dae8836e62e62090",
          "00d598438fae26f6ece0d4cd0d05c40b1df92397a3e9872f4903f1df6b14b7a8ef",
          "0029946b756da462888da5f58730bebf9be8c2cf45f11cd56b039ac162bbc22a2e",
          "006b714c6771efc76b81496927eebd76230f5abc718c4b077f3d7e5be8e251e5af",
          "006d5a2d0a4692f42ffbd3ba4a41aed23afba620ba400e218a17daf637e9081dab",
          "00b917f91daaad575d082753019d47df8a21d8cc50a56b9d7d347214229109e987"
        ],
        "validations": [
          {
            "flags": {
              "enforceBalancing": false,
              "verifySignatures": false,
              "enforceLimits": false
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a)"
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
            "height": 98,
            "hash": "9a2c2650f26a33f0fb"
          }
        },
        "finalizedIntentSegments": [
          1,
          32816
        ],
        "feesSpecks": "776272588353431"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "974301746642504"
          },
          "1": {},
          "32816": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "32816": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          32816
        ]
      }
    },
    "tookMs": 19061
  }
}
```

</details>

## the spec's final table, v1-only column (in parentheses there) (`final-table-v1`) — PASS

- **Spec expects:** OwnerN 4 S_A / 0 S_B; OwnerT (4) S_A / (3) S_B; AA_A (2) S_A / (7) S_B; pool (2) S_A / (7) S_B; sizes 2 pools / 2 shielded cells / 0 unshielded
- **As run (D-307):** asserted HERE, immediately after row 5 — before the labelled fixture that makes row 6 a node refusal. Under D-307 the v2 column belongs to stage B

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | OwnerN holds 4 S_A | PASS | observed 4 |
| 2 | OwnerN holds 0 S_B | PASS | observed 0 |
| 3 | OwnerT holds 4 S_A | PASS | observed 4 |
| 4 | OwnerT holds 3 S_B | PASS | observed 3 |
| 5 | cell AA_A/S_A = 2 | PASS | observed 2 |
| 6 | cell AA_A/S_B = 7 | PASS | observed 7 |
| 7 | pool(S_A) = 2 | PASS | observed 2 |
| 8 | pool(S_B) = 7 | PASS | observed 7 |
| 9 | exact map sizes 2/2/0 | PASS | {"pools":2,"shieldedCells":2,"unshieldedCells":0} |
| 10 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 7 vs cells 7 |
| 11 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 12 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 3 + pool 7 |

**After** (2026-08-20T15:48:56.696Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | 7 | 7 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"3"},"OwnerA":{"S_A":"0","S_B":"0"}}`

## Row 6 — Double-take: OFFER-1 balanced and submitted again — NC-302 (`row-6`) — PASS

- **Spec action:** Double-take: OFFER-1 balanced and submitted again
- **Spec expects:** REFUSED (backing coin spent); no state
- **As run (D-307):** preceded by ONE labelled fixture mint of S_B 7 to OwnerT: after row 5 the taker holds only 3 S_B and could not balance at all, so the refusal would come from its own wallet instead of the NODE. The spec's v1-only final table is asserted BEFORE the fixture, where it applies
- **Transactions:** `00a4be3a99e6678d3f61162d0eaef128fa122344c3096e7a648b6a1db448261b04`

> FIXTURE (not a spec row): minted 7 more S_B to OwnerT so the double take can reach the NODE. Without it the taker cannot fund the deficit and its own balancer refuses first, which would be a weaker result than the spec asks for.
> node code observed: 244 (TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414)). Plan 02 measured 239 = NullifierAlreadyPresent for a spent backing coin.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the double take was REFUSED | PASS | stage=settlement |
| 2 | the refusal came from the NODE (the backing coin is spent), with a numeric code | PASS | code 244 — TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414) |
| 3 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 4 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 5 | the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 244
```

**Before** (2026-08-20T15:49:14.438Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:49:22.068Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "takeReport": {
    "kind": "taker",
    "label": "row-6",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:49:17.128Z",
    "process": {
      "pid": 67658,
      "ppid": 67652
    },
    "opts": {
      "label": "row-6",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
          "amount": "7"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row6-taker.report.json"
    },
    "ok": false,
    "take": {
      "stage": "settlement",
      "ok": false,
      "terms": {
        "version": 1,
        "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
        "shape": "named-taker",
        "circuitId": "openSwapShielded",
        "form": "pre-binding",
        "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
        "gives": {
          "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
          "value": "4",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
          "value": "7",
          "nonce": "c5fa646e611c175dc83034cfbe973b55910a2336e67dbd3fe2f0fcdc82880010"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T15:47:14.882Z",
        "expiresAt": "2026-08-20T16:47:14.882Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            32816
          ],
          "intentSegments": [
            32816
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
            },
            "32816": {}
          },
          "expectedAtSegment0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
        "transactionBytes": 26819
      },
      "contentAddress": "ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6",
      "secondsLeft": 3477,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "32816": {}
        },
        "deficits": {
          "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206"
        },
        "matchesTerms": true
      },
      "settlement": {
        "route": "unbound",
        "ok": false,
        "validations": [
          {
            "flags": {
              "enforceBalancing": false,
              "verifySignatures": false,
              "enforceLimits": false
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1061674791259078"
            },
            "1": {},
            "32816": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "32816": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            32816
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 244,
          "decoded": "TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414)",
          "verbatim": "1010: Invalid Transaction: Custom error: 244",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 244\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1061674791259078"
          },
          "1": {},
          "32816": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "32816": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          32816
        ]
      },
      "error": "Transaction submission error",
      "nodeRefusal": {
        "code": 244,
        "decoded": "TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414)",
        "verbatim": "1010: Invalid Transaction: Custom error: 244",
        "beforeSubmission": false
      }
    },
    "tookMs": 4039
  }
}
```

</details>

## Row 10 — Tamper: OFFER-1's retained bytes, one byte flipped, taken — NC-304 (`row-10`) — PASS

- **Spec action:** Tamper negative: OFFER-1's retained bytes, one byte flipped, taken
- **Spec expects:** REFUSED at deserialize/validate; no state
- **As run (D-307):** TWO arms. (a) the flip alone is refused OFFLINE by the envelope's content-address check, before a wallet, a proof server or a node is contacted — STRONGER than the node refusal the spec anticipated, and recorded as such. (b) the flip with the content address REPAIRED reaches the layer the spec named

> arm (b) was refused at stage `settlement` with node code 235 — this is the layer the spec anticipated (deserialize/validate); arm (a) is a STRONGER refusal, one layer earlier.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | arm (a): the tampered offer was REFUSED | PASS | stage=envelope |
| 2 | arm (a): refused OFFLINE by the envelope content-address check — no wallet, proof server or node contacted | PASS | stage=envelope offline=true |
| 3 | arm (b): the re-addressed tampered offer was ALSO refused | PASS | stage=settlement |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
offer content address mismatch: terms declare sha256 ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6, payload hashes to a8f010ee567fed7f8e4bc0e50b31f09051eece4c91322ec57ce4bd1a85e14566
```

```
Transaction submission error
```

**Before** (2026-08-20T15:49:22.935Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:49:32.591Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "armA": {
    "flip": {
      "offset": 14807,
      "from": 19,
      "to": 18
    },
    "report": {
      "kind": "taker",
      "label": "row-10a",
      "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "utc": "2026-08-20T15:49:25.143Z",
      "process": {
        "pid": 67884,
        "ppid": 67878
      },
      "opts": {
        "label": "row-10a",
        "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1-tampered.offer",
        "takerSeedName": "ownerT",
        "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row10a-taker.report.json"
      },
      "ok": false,
      "take": {
        "stage": "envelope",
        "ok": false,
        "error": "offer content address mismatch: terms declare sha256 ba9c7f69231f756795cc7dff43c333e7e92c33d2e2e53b79483248a1a79853f6, payload hashes to a8f010ee567fed7f8e4bc0e50b31f09051eece4c91322ec57ce4bd1a85e14566",
        "offlineRefusal": true
      },
      "tookMs": 410
    }
  },
  "armB": {
    "flip": {
      "offset": 14807,
      "from": 19,
      "to": 18,
      "contentAddress": "a8f010ee567fed7f8e4bc0e50b31f09051eece4c91322ec57ce4bd1a85e14566"
    },
    "report": {
      "kind": "taker",
      "label": "row-10b",
      "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "utc": "2026-08-20T15:49:27.773Z",
      "process": {
        "pid": 68003,
        "ppid": 67989
      },
      "opts": {
        "label": "row-10b",
        "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/offer-1-tampered-repaired.offer",
        "takerSeedName": "ownerT",
        "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row10b-taker.report.json"
      },
      "ok": false,
      "take": {
        "stage": "settlement",
        "ok": false,
        "terms": {
          "version": 1,
          "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
          "shape": "named-taker",
          "circuitId": "openSwapShielded",
          "form": "pre-binding",
          "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
          "gives": {
            "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
            "value": "4",
            "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
            "recipientKind": "user-coin-public-key"
          },
          "wants": {
            "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
            "value": "7",
            "nonce": "c5fa646e611c175dc83034cfbe973b55910a2336e67dbd3fe2f0fcdc82880010"
          },
          "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
          "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
          "createdAt": "2026-08-20T15:47:14.882Z",
          "expiresAt": "2026-08-20T16:47:14.882Z",
          "ttlSeconds": 3600,
          "placement": {
            "segments": [
              0,
              32816
            ],
            "intentSegments": [
              32816
            ],
            "fallibleOfferSegments": [],
            "imbalances": {
              "0": {
                "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
              },
              "32816": {}
            },
            "expectedAtSegment0": {
              "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
            },
            "segment0Exact": true,
            "otherSegmentsEmpty": true,
            "offendingSegments": [],
            "ok": true
          },
          "makerAttachedDust": false,
          "contentAddress": "a8f010ee567fed7f8e4bc0e50b31f09051eece4c91322ec57ce4bd1a85e14566",
          "transactionBytes": 26819
        },
        "contentAddress": "a8f010ee567fed7f8e4bc0e50b31f09051eece4c91322ec57ce4bd1a85e14566",
        "secondsLeft": 3467,
        "fundability": {
          "imbalances": {
            "0": {
              "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
            },
            "32816": {}
          },
          "deficits": {
            "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-7"
          },
          "surpluses": {},
          "declared": {
            "wants": "0/shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206"
          },
          "matchesTerms": true
        },
        "settlement": {
          "route": "unbound",
          "ok": false,
          "validations": [
            {
              "flags": {
                "enforceBalancing": false,
                "verifySignatures": false,
                "enforceLimits": false
              },
              "passed": false,
              "error": "Invalid proof -- while verifying Zswap proof"
            },
            {
              "flags": {
                "enforceBalancing": true,
                "verifySignatures": true,
                "enforceLimits": true
              },
              "passed": false,
              "error": "Invalid proof -- while verifying Zswap proof"
            }
          ],
          "preSubmitGuard": {
            "imbalances": {
              "0": {
                "dust": "1061674791259078"
              },
              "1": {},
              "32816": {}
            },
            "unswept": {},
            "dustActions": {
              "1": {
                "spends": 1,
                "registrations": 0
              },
              "32816": {
                "spends": 0,
                "registrations": 0
              }
            },
            "intentSegments": [
              1,
              32816
            ]
          },
          "error": "Transaction submission error",
          "nodeRefusal": {
            "code": 235,
            "decoded": "MalformedZswapErrorCode::InvalidProof (types.rs:446)",
            "verbatim": "1010: Invalid Transaction: Custom error: 235",
            "beforeSubmission": false
          },
          "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
        },
        "merged": {
          "imbalances": {
            "0": {
              "dust": "1061674791259078"
            },
            "1": {},
            "32816": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "32816": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            32816
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 235,
          "decoded": "MalformedZswapErrorCode::InvalidProof (types.rs:446)",
          "verbatim": "1010: Invalid Transaction: Custom error: 235",
          "beforeSubmission": false
        }
      },
      "tookMs": 3874
    }
  }
}
```

</details>

## D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells (`p-f310`) — MEASURED

- **Spec action:** spec row 7 as literally written: OFFER-2 (floating surplus) give S_A 2 to no one the maker knows, want S_B 3 to AA_A
- **Spec expects:** imbalances(0) = +2 S_A, −3 S_B
- **As run (D-307):** attempted on THIS Manager, where row 5 has left custody at two pools and two cells. F-310 predicts the value leg lands in the FALLIBLE section and FR-302 refuses to publish it. MEASURED: what happens is the result

> This is the measurement deviation D-307 rests on. Both arms were FULLY BACKED — AA_A holds 2 S_A and the pool holds 2 — so the only thing that can refuse them is placement, which is exactly what did.
> It also replicates F-310 a fourth time, on a Manager it was never measured on, and separates the two candidate mechanisms: the wanted colour having a pool (F-308) is NOT necessary; two custody cells are enough.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the spec's LITERAL row 7 FAILS CLOSED here — FR-302 refuses to publish it | PASS | ok=false kind=fr302-placement-fail-closed |
| 2 | and the measured placement shows why: segment 0 carries NOTHING, the whole transcript went fallible | PASS | segment 0 = {}; fallible-offer segments [29459] |
| 3 | the same offer wanting a colour with NO pool ALSO fails closed — so it is the CELL COUNT, not F-308’s pool effect | PASS | ok=false kind=fr302-placement-fail-closed |
| 4 | the fresh-colour arm’s placement is fallible too | PASS | segment 0 = {} |
| 5 | nothing was published by any arm | PASS | — |
| 6 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"},"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 8be4fc7513e8…): segments present: [0,19167] intent segments: [19167] fallible-offer segments: [19167] expected 0: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 19167: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 7f2c1a65e1d5…): segments present: [0,52464] intent segments: [52464] fallible-offer segments: [52464] expected 0: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 52464: {"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e":"2","shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

**Before** (2026-08-20T15:49:33.460Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T15:51:09.821Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |
| S_C | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_A/S_C | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |
| AA_B/S_C | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"},"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "literal": {
    "kind": "maker",
    "label": "P-F310-literal",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:49:35.742Z",
    "process": {
      "pid": 68239,
      "ppid": 68233
    },
    "spec": {
      "label": "P-F310-literal",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "2"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/pf310-literal.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/pf310-literal.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 8be4fc7513e8…): segments present: [0,19167] intent segments: [19167] fallible-offer segments: [19167] expected 0: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206\":\"-3\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 19167: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206\":\"-3\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "literalMeasured": {
    "kind": "maker",
    "label": "P-F310-literal-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:49:47.896Z",
    "process": {
      "pid": 68560,
      "ppid": 68538
    },
    "spec": {
      "label": "P-F310-literal-measured",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "2"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "measureOnly": true,
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/pf310-literal-measured.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "2"
      },
      "wants": {
        "colour": "8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206",
        "value": "3",
        "nonce": "40f58affdc25159d1fb8dd89586c299d27ea4245d844e317085c56cda53351dc"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T15:49:55.893Z",
      "expiresAt": "2026-08-20T16:49:55.893Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          29459
        ],
        "intentSegments": [
          29459
        ],
        "fallibleOfferSegments": [
          29459
        ],
        "imbalances": {
          "0": {},
          "29459": {
            "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
            "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-3"
          }
        },
        "expectedAtSegment0": {
          "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
          "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-3"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "29459: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206\":\"-3\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "8c40353b02d38549a771422d77b02427e425c595078ed7fceaaa9f829dc2ac35",
      "transactionBytes": 31927
    },
    "placement": {
      "segments": [
        0,
        29459
      ],
      "intentSegments": [
        29459
      ],
      "fallibleOfferSegments": [
        29459
      ],
      "imbalances": {
        "0": {},
        "29459": {
          "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
          "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-3"
        }
      },
      "expectedAtSegment0": {
        "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
        "shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206": "-3"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "29459: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:8be4fc7513e848343a4b63a34bce6ed4232203f4c77eb874e87379e23111d206\":\"-3\"}"
      ],
      "ok": false
    },
    "proveMs": 7393,
    "transactionBytes": 31927,
    "contentAddress": "8c40353b02d38549a771422d77b02427e425c595078ed7fceaaa9f829dc2ac35",
    "published": false,
    "publishedNote": "measureOnly — the placement report is the deliverable; the artifact is discarded unpublished"
  },
  "freshColour": {
    "kind": "maker",
    "label": "P-F310-fresh-colour",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:50:53.424Z",
    "process": {
      "pid": 69893,
      "ppid": 69887
    },
    "spec": {
      "label": "P-F310-fresh-colour",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "2"
      },
      "wants": {
        "colour": "7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/pf310-fresh.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/pf310-fresh.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 20491ce4555a… / want 3 7f2c1a65e1d5…): segments present: [0,52464] intent segments: [52464] fallible-offer segments: [52464] expected 0: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c\":\"-3\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 52464: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c\":\"-3\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "freshColourMeasured": {
    "kind": "maker",
    "label": "P-F310-fresh-colour-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T15:51:03.105Z",
    "process": {
      "pid": 70151,
      "ppid": 70145
    },
    "spec": {
      "label": "P-F310-fresh-colour-measured",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "2"
      },
      "wants": {
        "colour": "7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "measureOnly": true,
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/pf310-fresh-measured.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a",
      "gives": {
        "colour": "20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e",
        "value": "2"
      },
      "wants": {
        "colour": "7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c",
        "value": "3",
        "nonce": "659a511cf4f5a5e88c4baee8bda5c07cb15e657ba32b9edcee7616af7ca48728"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T15:51:08.840Z",
      "expiresAt": "2026-08-20T16:51:08.840Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          31765
        ],
        "intentSegments": [
          31765
        ],
        "fallibleOfferSegments": [
          31765
        ],
        "imbalances": {
          "0": {},
          "31765": {
            "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
            "shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c": "-3"
          }
        },
        "expectedAtSegment0": {
          "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
          "shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c": "-3"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "31765: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c\":\"-3\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "38932b9b90b1bedf185d6239daac63cb20f3de5c96025acd7307fe24d314d1b7",
      "transactionBytes": 16394
    },
    "placement": {
      "segments": [
        0,
        31765
      ],
      "intentSegments": [
        31765
      ],
      "fallibleOfferSegments": [
        31765
      ],
      "imbalances": {
        "0": {},
        "31765": {
          "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
          "shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c": "-3"
        }
      },
      "expectedAtSegment0": {
        "shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e": "2",
        "shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c": "-3"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "31765: {\"shielded:20491ce4555ac0049b7082d60191d2d3b624aaa0e0e47c26c0f2675aca20f80e\":\"2\",\"shielded:7f2c1a65e1d50ef0dbde2836f02da910de682598e45b16cc8def50b86c8f653c\":\"-3\"}"
      ],
      "ok": false
    },
    "proveMs": 5186,
    "transactionBytes": 16394,
    "contentAddress": "38932b9b90b1bedf185d6239daac63cb20f3de5c96025acd7307fe24d314d1b7",
    "published": false,
    "publishedNote": "measureOnly — the placement report is the deliverable; the artifact is discarded unpublished"
  }
}
```

</details>

## Stage A closing state, both observation points (`closing`) — PASS

- **Spec expects:** unchanged by rows 6, 10 and P-F310 — all three are refusals

> OwnerT's S_B is 3 + 7 = 10 because of the labelled row-6 fixture; the spec's v1-only figure of 3 is asserted in the `final-table-v1` row, before the fixture.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | pool(S_A) = 2 | PASS | observed 2 |
| 2 | pool(S_B) = 7 | PASS | observed 7 |
| 3 | pool(S_C) = absent | PASS | observed absent |
| 4 | cell AA_A/S_A = 2 | PASS | observed 2 |
| 5 | cell AA_A/S_B = 7 | PASS | observed 7 |
| 6 | cell AA_B/S_A = absent | PASS | observed absent |
| 7 | exact map sizes 2/2/0 | PASS | {"pools":2,"shieldedCells":2,"unshieldedCells":0} |
| 8 | OwnerT holds 4 S_A | PASS | observed 4 |
| 9 | OwnerT holds 10 S_B | PASS | observed 10 |
| 10 | OP1 and OP2 agree on every cell | PASS | agree |
| 11 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 7 vs cells 7; S_C: pool 0 vs cells 0 |
| 12 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 13 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 17 = users 10 + pool 7; S_C: minted 0 = users 0 + pool 0 |

**After** (2026-08-20T15:52:57.421Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `a51cddadd117a331…` / 32 |
| S_B | 7 | `c5fa646e611c175d…` / 35 |
| S_C | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | 7 | 7 |
| AA_A/S_C | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |
| AA_B/S_C | absent | 0 |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"},"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"}}`

