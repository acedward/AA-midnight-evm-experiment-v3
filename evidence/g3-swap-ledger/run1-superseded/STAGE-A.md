# Swap step ledger — STAGE A

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T11:52:56.901Z

**VERDICT: RED**

**Carries:** rows 0–6, row 10 (NC-304), NC-305, P-F310

Manager `6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

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
| `p-f310` | D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells | **FAIL** | 5/7 |
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

**After** (2026-08-20T11:42:56.112Z)

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
- **Transactions:** `00320ce50fb995b349dc415a733631f88c998094f961f7cbe1b7c506dbeb15e1c7`, `0000a5d7f2954ccfddcbc07fdd7c2c4625b7838c274046dc43b43911f15ff51981`

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

**After** (2026-08-20T11:45:19.629Z)

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
- **Transactions:** `0064a2a0a7b11bc73724459fe625367a1b1ee8e0aad912fc986ed40c3ecb65f393`

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

**After** (2026-08-20T11:46:57.027Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
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
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
failed assert: caller's owner witness matches no registered account | cause: Error executing circuit 'openSwapShielded'
```

**Before** (2026-08-20T11:46:57.027Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | 6 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:47:01.183Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
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
    "utc": "2026-08-20T11:46:59.869Z",
    "process": {
      "pid": 26034,
      "ppid": 26020
    },
    "spec": {
      "label": "NC-305",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "witness": "ownerN",
      "shape": "named-taker",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "4"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/nc305-maker.report.json"
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
| 1 | OFFER-1 was built and proven | PASS | 10104 ms |
| 2 | the maker ran in a DIFFERENT OS PROCESS from this stage | PASS | maker pid 26104, stage pid 23712 |
| 3 | FR-302: imbalances(0) is EXACTLY {"shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-7"} | PASS | {"shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-7"} |
| 4 | FR-302: no other segment carries any delta | PASS | [] |
| 5 | FR-301: the maker attached NO DUST | PASS | — |
| 6 | FR-306: the envelope round-tripped a real process boundary byte-identically | PASS | reader pid 26210, 26819 bytes, sha bd365c1bbd9936c5… |
| 7 | a reader with NO NETWORK sees exactly the deficit the terms declare | PASS | {"0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-7"} |
| 8 | the offer is positively UNSUBMITTABLE ALONE (the ledger says so, offline) | PASS | invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive |
| 9 | building and proving changed NO on-chain state | PASS | sizes {"pools":1,"shieldedCells":1,"unshieldedCells":0} pools {"S_A":"6","S_B":"absent"} |
| 10 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 6 vs cells 6; S_B: pool 0 vs cells 0 |
| 11 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 12 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 4 + pool 6; S_B: minted 10 = users 10 + pool 0 |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive
```

**Before** (2026-08-20T11:46:57.027Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | 6 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:47:16.527Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
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
    "utc": "2026-08-20T11:47:03.250Z",
    "process": {
      "pid": 26104,
      "ppid": 26098
    },
    "spec": {
      "label": "OFFER-1",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "4"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row3-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "4",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "7",
        "nonce": "f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T11:47:13.889Z",
      "expiresAt": "2026-08-20T12:47:13.889Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          58343
        ],
        "intentSegments": [
          58343
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "58343": {}
        },
        "expectedAtSegment0": {
          "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
      "transactionBytes": 26819
    },
    "placement": {
      "segments": [
        0,
        58343
      ],
      "intentSegments": [
        58343
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
        },
        "58343": {}
      },
      "expectedAtSegment0": {
        "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 10104,
    "transactionBytes": 26819,
    "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1.offer"
  },
  "readerProcess": {
    "process": {
      "pid": 26210,
      "ppid": 26204,
      "network": "none used"
    },
    "file": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1.offer",
    "envelopeBytes": 28217,
    "envelopeVerified": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "4",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "7",
        "nonce": "f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T11:47:13.889Z",
      "expiresAt": "2026-08-20T12:47:13.889Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          58343
        ],
        "intentSegments": [
          58343
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "58343": {}
        },
        "expectedAtSegment0": {
          "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
      "transactionBytes": 26819
    },
    "payloadBytes": 26819,
    "payloadSha256": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
    "contentAddressMatches": true,
    "deserialized": true,
    "roundTripByteIdentical": true,
    "imbalances": {
      "0": {
        "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
      },
      "58343": {}
    },
    "deficits": {
      "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
    },
    "surpluses": {},
    "intentSegments": [
      58343
    ],
    "fallibleOfferSegments": [],
    "unsubmittableAlone": {
      "proven": true,
      "error": "invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive"
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

> the NODE itself refused 1 of 2 attempt(s): as-published (unbound, D-306) -> Custom error: 1 (1 — NOT DECODED at these pins)

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | NO submission of the unbalanced offer was accepted | PASS | 0 accepted |
| 2 | the LEDGER's own offline verdict refuses it, verbatim | PASS | invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive |
| 3 | every submission attempt was refused with a verbatim error (the spec asks for node OR ledger) | PASS | as-published (unbound, D-306): node (submitted and refused, Custom error: 1) \| bound: facade (refused to send it) |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive
```

```
[as-published (unbound, D-306)] 1010: Invalid Transaction: Custom error: 1
```

```
[bound] Transaction submission error
```

**Before** (2026-08-20T11:47:16.527Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:47:21.079Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
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
    "utc": "2026-08-20T11:47:18.600Z",
    "process": {
      "pid": 26281,
      "ppid": 26273
    },
    "opts": {
      "label": "row-4",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1.offer",
      "submitterSeedName": "feePayer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row4-direct.report.json"
    },
    "attempts": [
      {
        "form": "as-published (unbound, D-306)",
        "submitted": false,
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 1,
          "decoded": "1 — NOT DECODED at these pins",
          "verbatim": "1010: Invalid Transaction: Custom error: 1",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 1\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}",
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
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27 {\n    [cause]: Error: disconnected from ws://127.0.0.1:27216/: 1000:: Normal Closure\n        at #onSocketClose (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:371:23)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onSocketClose (node:internal/deps/undici/undici:13911:9)\n        at Socket.onSocketClose (node:internal/deps/undici/undici:13611:72)\n        at Socket.emit (node:events:520:35)\n        at TCP.<anonymous> (node:net:346:12)\n  }\n}",
        "layer": "facade (refused to send it)"
      }
    ],
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "4",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "7",
        "nonce": "f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T11:47:13.889Z",
      "expiresAt": "2026-08-20T12:47:13.889Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          58343
        ],
        "intentSegments": [
          58343
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "58343": {}
        },
        "expectedAtSegment0": {
          "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
      "transactionBytes": 26819
    },
    "payloadBytes": 26819,
    "imbalances": {
      "0": {
        "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
      },
      "58343": {}
    },
    "deficits": {
      "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
    },
    "offlineWellFormed": {
      "refused": true,
      "verbatim": "invalid balance -7 for token Shielded(ShieldedTokenType(55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1)) in segment 0; balance must be positive"
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
- **Transactions:** `0057b7afe637a6f09ccbf0c1b852c87d7c352e01b67dafea85e85fcf52950173d8`

> maker DUST spend 0 is read from the settled transaction's PER-INTENT dust actions, never from `dustBalance` — that accessor reads 0 for every wallet on this lane, including ones demonstrably paying fees (Plan 02 finding, spike S6). The maker is funded and DUST-registered on purpose, so the claim is about a wallet that COULD have paid.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the swap SETTLED | PASS | 0057b7afe637a6f09ccbf0c1b852c87d7c352e01b67dafea85e85fcf52950173d8 |
| 2 | ONE transaction id settled the whole swap | PASS | tx 0057b7afe637a6f09ccbf0c1b852c87d7c352e01b67dafea85e85fcf52950173d8; merged intent segments [1,58343] |
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
| 13 | the MAKER's intent in the settled transaction has ZERO dust spends | PASS | maker segments ["58343"] -> 0 dust spends; full map {"1":{"spends":1,"registrations":0},"58343":{"spends":0,"registrations":0}} |
| 14 | ANOTHER intent DID attach dust, so the fee was really paid — by the taker | PASS | other segments ["1"] -> 1 dust spends |
| 15 | the merged transaction balanced with nothing left unswept | PASS | {} |
| 16 | the taker ran in a DIFFERENT OS PROCESS from the maker | PASS | taker pid 26360 vs maker pid 26104 |
| 17 | OP1 and OP2 agree on every cell | PASS | agree |
| 18 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 2 vs cells 2; S_B: pool 7 vs cells 7 |
| 19 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 20 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 10 = users 8 + pool 2; S_B: minted 10 = users 3 + pool 7 |

**Before** (2026-08-20T11:47:21.079Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `33b009e17bb10831…` / 31 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:48:57.411Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

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
    "utc": "2026-08-20T11:47:23.118Z",
    "process": {
      "pid": 26360,
      "ppid": 26354
    },
    "opts": {
      "label": "row-5",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
          "amount": "7"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row5-taker.report.json"
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
        "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
        "gives": {
          "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
          "value": "4",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
          "value": "7",
          "nonce": "f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T11:47:13.889Z",
        "expiresAt": "2026-08-20T12:47:13.889Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            58343
          ],
          "intentSegments": [
            58343
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
            },
            "58343": {}
          },
          "expectedAtSegment0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
        "transactionBytes": 26819
      },
      "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
      "secondsLeft": 3590,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "58343": {}
        },
        "deficits": {
          "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1"
        },
        "matchesTerms": true
      },
      "settlement": {
        "route": "unbound",
        "ok": true,
        "txId": "0057b7afe637a6f09ccbf0c1b852c87d7c352e01b67dafea85e85fcf52950173d8",
        "txHash": "51c64ad440b5d6983916e2cd02f32d5df91e08ccd790bab8ffc8356007c53c6b",
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "974304881957970"
            },
            "1": {},
            "58343": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "58343": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            58343
          ]
        },
        "identifiers": [
          "00dbee2e087223e63177c5622cbc13eb916fa4ef0b6a375c9ee17afccfaa1340ab",
          "0030b8dbc7f564b41306847ac1c40db52d065dfd1b2f573583c14749196a8494a8",
          "00e7d2c4d95cee92839c7f3b361597d5a8f5b8f719890389d4b623c8caf71c9b32",
          "005976c722ef6e05c726627d3de0c094cb523eb9f589a3ff2f564ac3eb0da17621",
          "0017171991849a222470ea4ffdb4b9f047b04c67d95ab33f25c46be5de4d094093",
          "00f85a572c556214e34c3e601a36dddd135e21c26002a4fa699de70ab71d6972c0",
          "00afca29b3740a72b3d54d77aa4c0c9a4373b6064a2a97d577d077187b760bd092",
          "0057b7afe637a6f09ccbf0c1b852c87d7c352e01b67dafea85e85fcf52950173d8"
        ],
        "validations": [
          {
            "flags": {
              "enforceBalancing": false,
              "verifySignatures": false,
              "enforceLimits": false
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642)"
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
            "height": 108,
            "hash": "c5e3470b3d5cc398b2"
          }
        },
        "finalizedIntentSegments": [
          1,
          58343
        ],
        "feesSpecks": "776275074370134"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "974304881957970"
          },
          "1": {},
          "58343": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "58343": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          58343
        ]
      }
    },
    "tookMs": 20124
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

**After** (2026-08-20T11:48:57.411Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

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
- **Transactions:** `0079be9e9604688bc817005ad47427a9b291dd0ffe2f1131dc6ce953a8904321ef`

> FIXTURE (not a spec row): minted 7 more S_B to OwnerT so the double take can reach the NODE. Without it the taker cannot fund the deficit and its own balancer refuses first, which would be a weaker result than the spec asks for.
> node code observed: 244 (TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414)). Plan 02 measured 239 = NullifierAlreadyPresent for a spent backing coin.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the double take was REFUSED | PASS | stage=settlement |
| 2 | the refusal came from the NODE (the backing coin is spent), with a numeric code | PASS | code 244 — TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414) |
| 3 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 4 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 5 | the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 244
```

**Before** (2026-08-20T11:49:13.807Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:49:20.690Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

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
    "utc": "2026-08-20T11:49:15.883Z",
    "process": {
      "pid": 26833,
      "ppid": 26827
    },
    "opts": {
      "label": "row-6",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
          "amount": "7"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row6-taker.report.json"
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
        "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
        "gives": {
          "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
          "value": "4",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
          "value": "7",
          "nonce": "f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T11:47:13.889Z",
        "expiresAt": "2026-08-20T12:47:13.889Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            58343
          ],
          "intentSegments": [
            58343
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
            },
            "58343": {}
          },
          "expectedAtSegment0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
        "transactionBytes": 26819
      },
      "contentAddress": "bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c",
      "secondsLeft": 3478,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "58343": {}
        },
        "deficits": {
          "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1"
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
            "error": "call to non-existant contract ContractAddress(6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1061678662222199"
            },
            "1": {},
            "58343": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "58343": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            58343
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 244,
          "decoded": "TransactionApplicationErrorCode::IntentAlreadyExists (types.rs:414)",
          "verbatim": "1010: Invalid Transaction: Custom error: 244",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 244\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1061678662222199"
          },
          "1": {},
          "58343": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "58343": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          58343
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
    "tookMs": 3914
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
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
offer content address mismatch: terms declare sha256 bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c, payload hashes to 552193aed5a172a41bea4bee2a2d4dfcfd69f38a30952f5b7d3881b4cdbad0ee
```

```
Transaction submission error
```

**Before** (2026-08-20T11:49:21.555Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:49:30.833Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

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
      "from": 217,
      "to": 216
    },
    "report": {
      "kind": "taker",
      "label": "row-10a",
      "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "utc": "2026-08-20T11:49:23.602Z",
      "process": {
        "pid": 26932,
        "ppid": 26926
      },
      "opts": {
        "label": "row-10a",
        "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1-tampered.offer",
        "takerSeedName": "ownerT",
        "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row10a-taker.report.json"
      },
      "ok": false,
      "take": {
        "stage": "envelope",
        "ok": false,
        "error": "offer content address mismatch: terms declare sha256 bd365c1bbd9936c55d6593941c9bc02d4d6638e82f0e8e9662cd66607ae0700c, payload hashes to 552193aed5a172a41bea4bee2a2d4dfcfd69f38a30952f5b7d3881b4cdbad0ee",
        "offlineRefusal": true
      },
      "tookMs": 388
    }
  },
  "armB": {
    "flip": {
      "offset": 14807,
      "from": 217,
      "to": 216,
      "contentAddress": "552193aed5a172a41bea4bee2a2d4dfcfd69f38a30952f5b7d3881b4cdbad0ee"
    },
    "report": {
      "kind": "taker",
      "label": "row-10b",
      "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "utc": "2026-08-20T11:49:26.077Z",
      "process": {
        "pid": 27002,
        "ppid": 26996
      },
      "opts": {
        "label": "row-10b",
        "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/offer-1-tampered-repaired.offer",
        "takerSeedName": "ownerT",
        "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row10b-taker.report.json"
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
          "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
          "gives": {
            "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
            "value": "4",
            "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
            "recipientKind": "user-coin-public-key"
          },
          "wants": {
            "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
            "value": "7",
            "nonce": "f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e"
          },
          "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
          "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
          "createdAt": "2026-08-20T11:47:13.889Z",
          "expiresAt": "2026-08-20T12:47:13.889Z",
          "ttlSeconds": 3600,
          "placement": {
            "segments": [
              0,
              58343
            ],
            "intentSegments": [
              58343
            ],
            "fallibleOfferSegments": [],
            "imbalances": {
              "0": {
                "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
              },
              "58343": {}
            },
            "expectedAtSegment0": {
              "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
            },
            "segment0Exact": true,
            "otherSegmentsEmpty": true,
            "offendingSegments": [],
            "ok": true
          },
          "makerAttachedDust": false,
          "contentAddress": "552193aed5a172a41bea4bee2a2d4dfcfd69f38a30952f5b7d3881b4cdbad0ee",
          "transactionBytes": 26819
        },
        "contentAddress": "552193aed5a172a41bea4bee2a2d4dfcfd69f38a30952f5b7d3881b4cdbad0ee",
        "secondsLeft": 3467,
        "fundability": {
          "imbalances": {
            "0": {
              "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
            },
            "58343": {}
          },
          "deficits": {
            "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-7"
          },
          "surpluses": {},
          "declared": {
            "wants": "0/shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1"
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
                "dust": "1061678662222199"
              },
              "1": {},
              "58343": {}
            },
            "unswept": {},
            "dustActions": {
              "1": {
                "spends": 1,
                "registrations": 0
              },
              "58343": {
                "spends": 0,
                "registrations": 0
              }
            },
            "intentSegments": [
              1,
              58343
            ]
          },
          "error": "Transaction submission error",
          "nodeRefusal": {
            "code": 235,
            "decoded": "MalformedZswapErrorCode::InvalidProof (types.rs:446)",
            "verbatim": "1010: Invalid Transaction: Custom error: 235",
            "beforeSubmission": false
          },
          "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 235\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
        },
        "merged": {
          "imbalances": {
            "0": {
              "dust": "1061678662222199"
            },
            "1": {},
            "58343": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "58343": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            58343
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
      "tookMs": 3865
    }
  }
}
```

</details>

## D-307's evidence: the spec's LITERAL row 7, attempted here at TWO custody cells (`p-f310`) — FAIL

- **Spec action:** spec row 7 as literally written: OFFER-2 (floating surplus) give S_A 2 to no one the maker knows, want S_B 3 to AA_A
- **Spec expects:** imbalances(0) = +2 S_A, −3 S_B
- **As run (D-307):** attempted on THIS Manager, where row 5 has left custody at two pools and two cells. F-310 predicts the value leg lands in the FALLIBLE section and FR-302 refuses to publish it. MEASURED: what happens is the result

> This is the measurement deviation D-307 rests on. Both arms were FULLY BACKED — AA_A holds 2 S_A and the pool holds 2 — so the only thing that can refuse them is placement, which is exactly what did.
> It also replicates F-310 a fourth time, on a Manager it was never measured on, and separates the two candidate mechanisms: the wanted colour having a pool (F-308) is NOT necessary; two custody cells are enough.
> DEPARTURE from the prediction: funds unchanged: every wallet holds exactly what it held — {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} -> {"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"},"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"}}

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the spec's LITERAL row 7 FAILS CLOSED here — FR-302 refuses to publish it | PASS | ok=false kind=fr302-placement-fail-closed |
| 2 | and the measured placement shows why: segment 0 carries NOTHING, the whole transcript went fallible | PASS | segment 0 = {}; fallible-offer segments [63006] |
| 3 | the same offer wanting a colour with NO pool ALSO fails closed — so it is the CELL COUNT, not F-308’s pool effect | PASS | ok=false kind=fr302-placement-fail-closed |
| 4 | the fresh-colour arm’s placement is fallible too | PASS | segment 0 = {} |
| 5 | nothing was published by any arm | PASS | — |
| 6 | NO state created: the whole custody snapshot is byte-identical | **FAIL** | before {"mapSizes":{"pools":2,"shieldedCells":2,"unshieldedCells":0},"accounts":["009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904"],"pools":{"S_A":"2","S_B":"7"},"poolCoins":{"S_A":{"nonce":"2ddf527d69101213d86cb9658ccd7023a1e633ba20a3c127cf3b11320d20d600","mtIndex":"33"},"S_B":{"nonce":"f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e","mtIndex":"34"}},"cells":{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"absent","AA_B/S_B":"absent"},"onChain":{}} vs after {"mapSizes":{"pools":2,"shieldedCells":2,"unshieldedCells":0},"accounts":["009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b","755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904"],"pools":{"S_A":"2","S_B":"7","S_C":"absent"},"poolCoins":{"S_A":{"nonce":"2ddf527d69101213d86cb9658ccd7023a1e633ba20a3c127cf3b11320d20d600","mtIndex":"33"},"S_B":{"nonce":"f8221e9e8f84ad5a112f1348d05da44a632797d4bfe3b70faa34adaaa51ce58e","mtIndex":"34"},"S_C":null},"cells":{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent","AA_B/S_C":"absent"},"onChain":{}} |
| 7 | funds unchanged: every wallet holds exactly what it held | **FAIL** | {"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} -> {"OwnerN":{"S_A":"4","S_B":"0","S_C":"0"},"OwnerT":{"S_A":"4","S_B":"10","S_C":"0"},"OwnerA":{"S_A":"0","S_B":"0","S_C":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 55fcabf0eae2…): segments present: [0,28531] intent segments: [28531] fallible-offer segments: [28531] expected 0: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 28531: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

```
FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 7062dc1579e3…): segments present: [0,55549] intent segments: [55549] fallible-offer segments: [55549] expected 0: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae":"-3"} observed 0: {} segment-0 exact: false other segments carrying deltas: 55549: {"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d":"2","shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae":"-3"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

**Before** (2026-08-20T11:49:31.689Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | 7 | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":2,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"4","S_B":"0"},"OwnerT":{"S_A":"4","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T11:51:08.553Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |
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
    "utc": "2026-08-20T11:49:33.736Z",
    "process": {
      "pid": 27085,
      "ppid": 27079
    },
    "spec": {
      "label": "P-F310-literal",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "2"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/pf310-literal.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310-literal.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 55fcabf0eae2…): segments present: [0,28531] intent segments: [28531] fallible-offer segments: [28531] expected 0: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1\":\"-3\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 28531: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1\":\"-3\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "literalMeasured": {
    "kind": "maker",
    "label": "P-F310-literal-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T11:49:44.901Z",
    "process": {
      "pid": 27204,
      "ppid": 27198
    },
    "spec": {
      "label": "P-F310-literal-measured",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "2"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "measureOnly": true,
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310-literal-measured.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "2"
      },
      "wants": {
        "colour": "55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1",
        "value": "3",
        "nonce": "8dd2fd6d45998fb3228d9ccbf18a6635dff058e8c295bcb233d1d6d0edfc867d"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T11:49:52.656Z",
      "expiresAt": "2026-08-20T12:49:52.656Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          63006
        ],
        "intentSegments": [
          63006
        ],
        "fallibleOfferSegments": [
          63006
        ],
        "imbalances": {
          "0": {},
          "63006": {
            "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
            "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-3"
          }
        },
        "expectedAtSegment0": {
          "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
          "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-3"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "63006: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1\":\"-3\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "5e2a622267b3fb7cf4cc524d5ed7fa7f20431fac94bd4f3c36530717c460a6c8",
      "transactionBytes": 31927
    },
    "placement": {
      "segments": [
        0,
        63006
      ],
      "intentSegments": [
        63006
      ],
      "fallibleOfferSegments": [
        63006
      ],
      "imbalances": {
        "0": {},
        "63006": {
          "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
          "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-3"
        }
      },
      "expectedAtSegment0": {
        "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
        "shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1": "-3"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "63006: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:55fcabf0eae229451b50521d5d344b397450d50a56832b64652ae2d437b5f5b1\":\"-3\"}"
      ],
      "ok": false
    },
    "proveMs": 7174,
    "transactionBytes": 31927,
    "contentAddress": "5e2a622267b3fb7cf4cc524d5ed7fa7f20431fac94bd4f3c36530717c460a6c8",
    "published": false,
    "publishedNote": "measureOnly — the placement report is the deliverable; the artifact is discarded unpublished"
  },
  "freshColour": {
    "kind": "maker",
    "label": "P-F310-fresh-colour",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T11:50:52.592Z",
    "process": {
      "pid": 27492,
      "ppid": 27486
    },
    "spec": {
      "label": "P-F310-fresh-colour",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "2"
      },
      "wants": {
        "colour": "7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/pf310-fresh.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310-fresh.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for floating-surplus offer (openSwapShielded, give 2 39879b5c202c… / want 3 7062dc1579e3…): segments present: [0,55549] intent segments: [55549] fallible-offer segments: [55549] expected 0: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae\":\"-3\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 55549: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae\":\"-3\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "freshColourMeasured": {
    "kind": "maker",
    "label": "P-F310-fresh-colour-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T11:51:01.889Z",
    "process": {
      "pid": 27580,
      "ppid": 27574
    },
    "spec": {
      "label": "P-F310-fresh-colour-measured",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "witness": "ownerA",
      "shape": "floating-surplus",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "2"
      },
      "wants": {
        "colour": "7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae",
        "value": "3"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "measureOnly": true,
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310-fresh-measured.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "floating-surplus",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642",
      "gives": {
        "colour": "39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d",
        "value": "2"
      },
      "wants": {
        "colour": "7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae",
        "value": "3",
        "nonce": "1df26ee2a9d6e7c372e2ee1626ccf31ee1d64781f7cb1f714fd93ea49509e327"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T11:51:07.584Z",
      "expiresAt": "2026-08-20T12:51:07.584Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          62951
        ],
        "intentSegments": [
          62951
        ],
        "fallibleOfferSegments": [
          62951
        ],
        "imbalances": {
          "0": {},
          "62951": {
            "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
            "shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae": "-3"
          }
        },
        "expectedAtSegment0": {
          "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
          "shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae": "-3"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "62951: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae\":\"-3\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "985d47bc5f25774b39a2aaca84ce64c3504c01aa391649f03af4eda233001c30",
      "transactionBytes": 16394
    },
    "placement": {
      "segments": [
        0,
        62951
      ],
      "intentSegments": [
        62951
      ],
      "fallibleOfferSegments": [
        62951
      ],
      "imbalances": {
        "0": {},
        "62951": {
          "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
          "shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae": "-3"
        }
      },
      "expectedAtSegment0": {
        "shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d": "2",
        "shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae": "-3"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "62951: {\"shielded:39879b5c202c0691c1d6b5b546ad28f6ab326e04c1de01cd5e7a503081fd149d\":\"2\",\"shielded:7062dc1579e3c65873ed0ba3afe6b7895cbd5623f2adc795e2c5b19185f9baae\":\"-3\"}"
      ],
      "ok": false
    },
    "proveMs": 5154,
    "transactionBytes": 16394,
    "contentAddress": "985d47bc5f25774b39a2aaca84ce64c3504c01aa391649f03af4eda233001c30",
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

**After** (2026-08-20T11:52:56.900Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 2 | `2ddf527d69101213…` / 33 |
| S_B | 7 | `f8221e9e8f84ad5a…` / 34 |
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

