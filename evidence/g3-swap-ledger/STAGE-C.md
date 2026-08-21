# Swap step ledger — STAGE C

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:57:21.977Z

**VERDICT: GREEN**

**Carries:** rows 9 (NC-303), 11 (P-104), 12 (P-CXL, both forms), NC-306, P-F310 replication

Manager `f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

> This is NOT the spec's literal single-Manager 13-row table and is never presented as one.
> What every row asserts IS the spec's: the same amounts, the same expected changes.

## Rows

| Row | What | Status | Checks |
|---|---|---|---|
| `setup` | fresh Manager; mint; OwnerN deposits S_A 6 → AA_A | PASS | 10/10 |
| **9** `row-9` | Expiry: OFFER-3 held past its TTL, then taken — NC-303 | PASS | 9/9 |
| **11** `row-11` | Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken | MEASURED | 6/6 |
| **12** `row-12a` | Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL | MEASURED | 7/7 |
| `row-12b` | Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL | MEASURED | 7/7 |
| `nc-306` | unbacked make: AA_A asks for more S_A than its cell holds, while the pool COULD cover it | PASS | 9/9 |
| `p-f310` | P-F310 replication: a FULLY BACKED offer at two custody cells | MEASURED | 5/5 |
| `closing` | Stage C closing state, both observation points | PASS | 4/4 |

## fresh Manager; mint; OwnerN deposits S_A 6 → AA_A (`setup`) — PASS

- **Spec action:** the stage-local equivalent of spec rows 0–2
- **Spec expects:** all maps size 0 → pool S_A=6; AA_A: S_A=6; maps 1/1/0
- **As run (D-307):** S_A 12 is minted (not 10) so all five negatives have a give to make from one deposit
- **Transactions:** `007bc62fd5ad445960b1574b909e724e9a01c00d1a6869d0fcb28cc0be91995a99`, `00575bc77016b55833e92ba6cf6b9b1f5113642bc1b6d90b101b17459d5ebe0729`, `0054d64b1b2691dc5afbb42e5516b58e3bb853ae905c51e0770802701300c44fe6`

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | both accounts registered | PASS | accounts 2 |
| 2 | exact map sizes 0/0/0 | PASS | {"pools":0,"shieldedCells":0,"unshieldedCells":0} |
| 3 | pool(S_A) = 6 | PASS | observed 6 |
| 4 | cell AA_A/S_A = 6 | PASS | observed 6 |
| 5 | cell AA_B/S_A = absent | PASS | observed absent |
| 6 | exact map sizes 1/1/0 | PASS | {"pools":1,"shieldedCells":1,"unshieldedCells":0} |
| 7 | OP1 and OP2 agree on every cell | PASS | agree |
| 8 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 6 vs cells 6; S_B: pool 0 vs cells 0 |
| 9 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 10 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 12 = users 6 + pool 6; S_B: minted 10 = users 10 + pool 0 |

**Before** (2026-08-20T12:46:38.794Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

**After** (2026-08-20T12:50:39.315Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `7a83d444cb4fe8e0…` / 46 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | 6 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | absent | 0 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

## Row 9 — Expiry: OFFER-3 held past its TTL, then taken — NC-303 (`row-9`) — PASS

- **Spec action:** Expiry negative: OFFER-3 (small give) held past its TTL, then taken
- **Spec expects:** REFUSED; no state
- **As run (D-307):** the intent TTL is rewritten to 120 s while the transaction is still UNPROVEN (F-306: rewriting a PROVEN transaction's intents invalidates its zswap proofs), because midnight-js hardcodes `ttlOneHour()` and the literal form costs an hour per observation. BOTH layers measured: the taker's own gate refuses OFFLINE, and with that gate forced off the node refuses with 228

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | OFFER-3 was built and proven | PASS | 7522 ms |
| 2 | the intent TTL rewrite took effect BEFORE proving (F-306) | PASS | 2026-08-20T12:52:42.000Z |
| 3 | the taker's OWN gate refuses the expired offer OFFLINE, with no network contact | PASS | stage=expired offline=true |
| 4 | and with that gate forced off, the NODE refuses it too | PASS | stage=settlement code 228 |
| 5 | the node's code is 228 (IntentTtlExpired) — the code Plan 02 measured | PASS | 228 — MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487) |
| 6 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 7 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 8 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 9 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
offer expired 35 s ago (expiresAt 2026-08-20T12:52:50.044Z); refused locally without contacting the chain
```

```
1010: Invalid Transaction: Custom error: 228
```

**Before** (2026-08-20T12:50:51.544Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `7a83d444cb4fe8e0…` / 46 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:53:31.223Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `7a83d444cb4fe8e0…` / 46 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "OFFER-3",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:50:41.862Z",
    "process": {
      "pid": 47443,
      "ppid": 47429
    },
    "spec": {
      "label": "OFFER-3",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "ttlSeconds": 120,
      "rewriteIntentTtlSeconds": 120,
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row9-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1",
        "nonce": "fc47e44fb2c369b44a9d448f946ec401926555674a83d45d0cf6dc056259fc67"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:50:50.044Z",
      "expiresAt": "2026-08-20T12:52:50.044Z",
      "ttlSeconds": 120,
      "placement": {
        "segments": [
          0,
          25629
        ],
        "intentSegments": [
          25629
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "25629": {}
        },
        "expectedAtSegment0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "3737cbe6a97e374f00cb41bcc63d59566a206fc347422cf33114140fc7449144",
      "transactionBytes": 26820
    },
    "placement": {
      "segments": [
        0,
        25629
      ],
      "intentSegments": [
        25629
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "25629": {}
      },
      "expectedAtSegment0": {
        "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 7522,
    "transactionBytes": 26820,
    "contentAddress": "3737cbe6a97e374f00cb41bcc63d59566a206fc347422cf33114140fc7449144",
    "intentTtlRewrite": "2026-08-20T12:52:42.000Z",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer"
  },
  "localGateTake": {
    "kind": "taker",
    "label": "row-9-local",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:53:24.075Z",
    "process": {
      "pid": 48126,
      "ppid": 48120
    },
    "opts": {
      "label": "row-9-local",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "amount": "1"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row9-taker-local.report.json"
    },
    "ok": false,
    "take": {
      "stage": "expired",
      "ok": false,
      "terms": {
        "version": 1,
        "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
        "shape": "named-taker",
        "circuitId": "openSwapShielded",
        "form": "pre-binding",
        "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
        "gives": {
          "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "value": "1",
          "nonce": "fc47e44fb2c369b44a9d448f946ec401926555674a83d45d0cf6dc056259fc67"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:50:50.044Z",
        "expiresAt": "2026-08-20T12:52:50.044Z",
        "ttlSeconds": 120,
        "placement": {
          "segments": [
            0,
            25629
          ],
          "intentSegments": [
            25629
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
            },
            "25629": {}
          },
          "expectedAtSegment0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "3737cbe6a97e374f00cb41bcc63d59566a206fc347422cf33114140fc7449144",
        "transactionBytes": 26820
      },
      "contentAddress": "3737cbe6a97e374f00cb41bcc63d59566a206fc347422cf33114140fc7449144",
      "secondsLeft": -35,
      "error": "offer expired 35 s ago (expiresAt 2026-08-20T12:52:50.044Z); refused locally without contacting the chain",
      "offlineRefusal": true
    },
    "tookMs": 568
  },
  "nodeTake": {
    "kind": "taker",
    "label": "row-9-node",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:53:26.684Z",
    "process": {
      "pid": 48196,
      "ppid": 48190
    },
    "opts": {
      "label": "row-9-node",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "amount": "1"
        }
      ],
      "ignoreExpiry": true,
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row9-taker-node.report.json"
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
        "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
        "gives": {
          "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "value": "1",
          "nonce": "fc47e44fb2c369b44a9d448f946ec401926555674a83d45d0cf6dc056259fc67"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:50:50.044Z",
        "expiresAt": "2026-08-20T12:52:50.044Z",
        "ttlSeconds": 120,
        "placement": {
          "segments": [
            0,
            25629
          ],
          "intentSegments": [
            25629
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
            },
            "25629": {}
          },
          "expectedAtSegment0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "3737cbe6a97e374f00cb41bcc63d59566a206fc347422cf33114140fc7449144",
        "transactionBytes": 26820
      },
      "contentAddress": "3737cbe6a97e374f00cb41bcc63d59566a206fc347422cf33114140fc7449144",
      "secondsLeft": -37,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "25629": {}
        },
        "deficits": {
          "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25"
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
            "error": "transaction application error detected during verification: Intent TTL has expired. TTL: Timestamp(1787230362), Current block: Timestamp(1787230407)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "transaction application error detected during verification: Intent TTL has expired. TTL: Timestamp(1787230362), Current block: Timestamp(1787230408)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1074445877017746"
            },
            "1": {},
            "25629": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "25629": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            25629
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 228,
          "decoded": "MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487)",
          "verbatim": "1010: Invalid Transaction: Custom error: 228",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 228\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1074445877017746"
          },
          "1": {},
          "25629": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "25629": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          25629
        ]
      },
      "error": "Transaction submission error",
      "nodeRefusal": {
        "code": 228,
        "decoded": "MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487)",
        "verbatim": "1010: Invalid Transaction: Custom error: 228",
        "beforeSubmission": false
      }
    },
    "tookMs": 3070
  }
}
```

</details>

## Row 11 — Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken (`row-11`) — MEASURED

- **Spec action:** Staleness probe (FR-311): OFFER-4 built on a live colour, then an ordinary deposit lands on that colour, then OFFER-4 taken
- **Spec expects:** expected refusal (Custom error: 104 — Transcript); verbatim + no-state; MEASURED, not judged
- **As run (D-307):** the MEASURED code is 239 = ZswapInvalidErrorCode::NullifierAlreadyPresent, not the predicted 104 (finding F-309, 3/3 in Plan 02): an ordinary deposit MERGES the pooled coin and merging SPENDS it, so the offer's pinned coin is already nullified. FR-311 asks for the measured rule, so the measured rule is asserted and the divergence recorded
- **Transactions:** `0088c3e553fabdef2af419d1ceb9dca2f70b7db0541db40b1c2400bc0c013ee8dd`

> intervention: OwnerN deposited 1 more S_A into AA_A; pool(S_A) 6 -> 7, which MERGES the pooled coin
> MEASURED, not judged (FR-311). The mechanism: the maker's call pins the pooled coin it spends — the coin's Merkle index enters the transcript — and an ordinary deposit MERGES that coin, which SPENDS it. 239 names that precisely; 104 would only have said "a transcript did not match".

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the live offer was INVALIDATED — the take was refused | PASS | stage=settlement |
| 2 | the MEASURED code is 239 (NullifierAlreadyPresent) — FR-311 predicted 104 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| 3 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 4 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 5 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 6 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 239
```

**Before** (2026-08-20T12:54:10.359Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 7 | `dae9843f24eaef2a…` / 49 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 7 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:54:17.346Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 7 | `dae9843f24eaef2a…` / 49 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 7 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "OFFER-4",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:53:33.214Z",
    "process": {
      "pid": 48276,
      "ppid": 48270
    },
    "spec": {
      "label": "OFFER-4",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row11-maker.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row11-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1",
        "nonce": "d525a4113009201668311604f068734d42ce8a9e9be98df12d3ac18e6f6ff41f"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:53:39.894Z",
      "expiresAt": "2026-08-20T13:53:39.894Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          27782
        ],
        "intentSegments": [
          27782
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "27782": {}
        },
        "expectedAtSegment0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "2aeed62ebb79e4aaa1f5dcf04e19996b39d5b1804920873efd36ef07cf18a4ba",
      "transactionBytes": 26819
    },
    "placement": {
      "segments": [
        0,
        27782
      ],
      "intentSegments": [
        27782
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "27782": {}
      },
      "expectedAtSegment0": {
        "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6036,
    "transactionBytes": 26819,
    "contentAddress": "2aeed62ebb79e4aaa1f5dcf04e19996b39d5b1804920873efd36ef07cf18a4ba",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row11-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-11",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:54:12.448Z",
    "process": {
      "pid": 48514,
      "ppid": 48508
    },
    "opts": {
      "label": "row-11",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row11-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "amount": "1"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row11-taker.report.json"
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
        "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
        "gives": {
          "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "value": "1",
          "nonce": "d525a4113009201668311604f068734d42ce8a9e9be98df12d3ac18e6f6ff41f"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:53:39.894Z",
        "expiresAt": "2026-08-20T13:53:39.894Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            27782
          ],
          "intentSegments": [
            27782
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
            },
            "27782": {}
          },
          "expectedAtSegment0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "2aeed62ebb79e4aaa1f5dcf04e19996b39d5b1804920873efd36ef07cf18a4ba",
        "transactionBytes": 26819
      },
      "contentAddress": "2aeed62ebb79e4aaa1f5dcf04e19996b39d5b1804920873efd36ef07cf18a4ba",
      "secondsLeft": 3567,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "27782": {}
        },
        "deficits": {
          "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25"
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
            "error": "call to non-existant contract ContractAddress(f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1077798426101200"
            },
            "1": {},
            "27782": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "27782": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            27782
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 239,
          "decoded": "ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400)",
          "verbatim": "1010: Invalid Transaction: Custom error: 239",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 239\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1077798426101200"
          },
          "1": {},
          "27782": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "27782": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          27782
        ]
      },
      "error": "Transaction submission error",
      "nodeRefusal": {
        "code": 239,
        "decoded": "ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400)",
        "verbatim": "1010: Invalid Transaction: Custom error: 239",
        "beforeSubmission": false
      }
    },
    "tookMs": 3423
  }
}
```

</details>

## Row 12 — Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL (`row-12a`) — MEASURED

- **Spec action:** Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken
- **Spec expects:** REFUSED; no state — cancellation-by-spend works
- **As run (D-307):** BOTH forms the spec names are measured separately, because they are not the same mechanism: a WITHDRAW spends the pooled coin, while `transferInternalShielded` performs NO token operation at all (the pooled coin is byte-identical afterwards) and can only invalidate an offer through the account cell its transcript read
- **Transactions:** `001cdab03b55412753f3d5d75bf4bca095b79c8d6c85ae2d639ba4e55628c04843`

> cancellation: the owner withdrew 2 S_A to its own wallet; pool(S_A) 7 -> 5, and the POOLED COIN CHANGED (dae9843f24ea… -> 8f5330048066…) because `sendShielded` spends it and re-pools the change

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the cancelled offer was REFUSED | PASS | stage=settlement |
| 2 | the pooled coin really did move (so this is cancellation BY SPEND) | PASS | dae9843f24eaef2a… -> 8f5330048066432c… |
| 3 | the node's code is 239 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 239
```

**Before** (2026-08-20T12:54:53.176Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 5 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:55:00.495Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 5 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "OFFER-5",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:54:19.425Z",
    "process": {
      "pid": 48595,
      "ppid": 48589
    },
    "spec": {
      "label": "OFFER-5",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12a-maker.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row12a-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1",
        "nonce": "222d52b9f38912541f110e6fcfd40c2c18dc160b2652c015cccfeff16e792209"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:54:26.260Z",
      "expiresAt": "2026-08-20T13:54:26.260Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          31884
        ],
        "intentSegments": [
          31884
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "31884": {}
        },
        "expectedAtSegment0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "cef95e44eea4a328b4fb832e8c7ba5275fd7df9be81bbecedabdc8dd0ec1c011",
      "transactionBytes": 26818
    },
    "placement": {
      "segments": [
        0,
        31884
      ],
      "intentSegments": [
        31884
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "31884": {}
      },
      "expectedAtSegment0": {
        "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6158,
    "transactionBytes": 26818,
    "contentAddress": "cef95e44eea4a328b4fb832e8c7ba5275fd7df9be81bbecedabdc8dd0ec1c011",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12a-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-12a",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:54:55.447Z",
    "process": {
      "pid": 48783,
      "ppid": 48777
    },
    "opts": {
      "label": "row-12a",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12a-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "amount": "1"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row12a-taker.report.json"
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
        "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
        "gives": {
          "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "value": "1",
          "nonce": "222d52b9f38912541f110e6fcfd40c2c18dc160b2652c015cccfeff16e792209"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:54:26.260Z",
        "expiresAt": "2026-08-20T13:54:26.260Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            31884
          ],
          "intentSegments": [
            31884
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
            },
            "31884": {}
          },
          "expectedAtSegment0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "cef95e44eea4a328b4fb832e8c7ba5275fd7df9be81bbecedabdc8dd0ec1c011",
        "transactionBytes": 26818
      },
      "contentAddress": "cef95e44eea4a328b4fb832e8c7ba5275fd7df9be81bbecedabdc8dd0ec1c011",
      "secondsLeft": 3570,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "31884": {}
        },
        "deficits": {
          "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25"
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
            "error": "call to non-existant contract ContractAddress(f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1081556396209363"
            },
            "1": {},
            "31884": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "31884": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            31884
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 239,
          "decoded": "ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400)",
          "verbatim": "1010: Invalid Transaction: Custom error: 239",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 239\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1081556396209363"
          },
          "1": {},
          "31884": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "31884": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          31884
        ]
      },
      "error": "Transaction submission error",
      "nodeRefusal": {
        "code": 239,
        "decoded": "ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400)",
        "verbatim": "1010: Invalid Transaction: Custom error: 239",
        "beforeSubmission": false
      }
    },
    "tookMs": 3552
  }
}
```

</details>

## Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL (`row-12b`) — MEASURED

- **Spec action:** Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken
- **Spec expects:** REFUSED; no state — cancellation-by-spend works
- **As run (D-307):** the spec names "internal transfer / withdraw" as if they were interchangeable. They are not: `transferInternalShielded` performs NO token operation — the pooled coin must be byte-identical afterwards — so it can only invalidate an offer through the ACCOUNT CELL the transcript read. MEASURED separately for that reason. It is also the row that takes custody to two cells, which is why it runs after every other publishable offer
- **Transactions:** `00052ba09dc6bd987dc0462430c6ad5b2c26bbf99f6e3db17fe1c1fc8284dea89a`

> intervention: AA_A transferred 3 S_A to AA_B INSIDE the Manager. AA_A's cell 5 -> 2, AA_B's cell created at 3; custody is now 1 pool(s) / 2 cells
> So FR-307(d) holds for BOTH forms the spec names, but by two different mechanisms — and only the withdraw is literally "moving the backing pool coin".

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the pooled coin is BYTE-IDENTICAL — no token operation happened | PASS | 8f5330048066432c…/51 vs 8f5330048066432c…/51 |
| 2 | the offer was refused even though no coin moved | PASS | stage=settlement |
| 3 | the code is 104 (Transcript) — the expectation, not an assertion | PASS | 104 — InvalidError::Transcript (types.rs:406) |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 104
```

**Before** (2026-08-20T12:55:34.603Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:55:41.712Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "OFFER-6",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:55:02.538Z",
    "process": {
      "pid": 48864,
      "ppid": 48858
    },
    "spec": {
      "label": "OFFER-6",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12b-maker.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row12b-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1",
        "nonce": "0b831ba31a451ba43ceb7eb100f8d2ddcfee236eae641fc24653c2d037a1e772"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:55:09.147Z",
      "expiresAt": "2026-08-20T13:55:09.147Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          169
        ],
        "intentSegments": [
          169
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "169": {}
        },
        "expectedAtSegment0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "f478f1ed538a692876293f2c9f0b135d7a3d73ac51d8210a57443553b34a461a",
      "transactionBytes": 26818
    },
    "placement": {
      "segments": [
        0,
        169
      ],
      "intentSegments": [
        169
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "169": {}
      },
      "expectedAtSegment0": {
        "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 5924,
    "transactionBytes": 26818,
    "contentAddress": "f478f1ed538a692876293f2c9f0b135d7a3d73ac51d8210a57443553b34a461a",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12b-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-12b",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:55:36.712Z",
    "process": {
      "pid": 49049,
      "ppid": 49043
    },
    "opts": {
      "label": "row-12b",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12b-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "amount": "1"
        }
      ],
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/row12b-taker.report.json"
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
        "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
        "gives": {
          "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
          "value": "1",
          "nonce": "0b831ba31a451ba43ceb7eb100f8d2ddcfee236eae641fc24653c2d037a1e772"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:55:09.147Z",
        "expiresAt": "2026-08-20T13:55:09.147Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            169
          ],
          "intentSegments": [
            169
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
            },
            "169": {}
          },
          "expectedAtSegment0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "f478f1ed538a692876293f2c9f0b135d7a3d73ac51d8210a57443553b34a461a",
        "transactionBytes": 26818
      },
      "contentAddress": "f478f1ed538a692876293f2c9f0b135d7a3d73ac51d8210a57443553b34a461a",
      "secondsLeft": 3572,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          },
          "169": {}
        },
        "deficits": {
          "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25"
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
            "error": "call to non-existant contract ContractAddress(f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1082094011688714"
            },
            "1": {},
            "169": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "169": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            169
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 104,
          "decoded": "InvalidError::Transcript (types.rs:406)",
          "verbatim": "1010: Invalid Transaction: Custom error: 104",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104\n        at checkError (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1082094011688714"
          },
          "1": {},
          "169": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "169": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          169
        ]
      },
      "error": "Transaction submission error",
      "nodeRefusal": {
        "code": 104,
        "decoded": "InvalidError::Transcript (types.rs:406)",
        "verbatim": "1010: Invalid Transaction: Custom error: 104",
        "beforeSubmission": false
      }
    },
    "tookMs": 3488
  }
}
```

</details>

## unbacked make: AA_A asks for more S_A than its cell holds, while the pool COULD cover it (`nc-306`) — PASS

- **Spec action:** NC-306: OwnerA attempts an offer giving more S_A than AA_A's cell holds (pool would cover it via other accounts)
- **Spec expects:** refused by the per-(account,colour) guard; no state
- **As run (D-307):** run after row 12b, which is what gives AA_B a share of the pool — the spec's premise needs the pool to be covered VIA ANOTHER ACCOUNT, and that is exactly what an internal transfer produces. The amount is taken from the live state so the premise holds whatever the earlier rows did

> premise: the pool holds 5 S_A (enough), AA_A's own cell holds 2 (not enough), and the request is for 5. Planned amount was 5; the live value is used so the premise holds regardless of what the earlier rows did.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the premise holds: the pool WOULD cover the request | PASS | pool 5 >= 5 |
| 2 | the premise holds: AA_A's own cell would NOT | PASS | cell 2 < 5 |
| 3 | the build was REFUSED | PASS | ok=false |
| 4 | refused by THE PER-(ACCOUNT, COLOUR) GUARD — the verbatim error names the account balance, not the pool | PASS | failed assert: account colour balance too low \| cause: Error executing circuit 'openSwapShielded' |
| 5 | nothing was published | PASS | published=false |
| 6 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 7 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 8 | the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| 9 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
failed assert: account colour balance too low | cause: Error executing circuit 'openSwapShielded'
```

**Before** (2026-08-20T12:55:41.712Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:55:45.994Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "makerReport": {
    "kind": "maker",
    "label": "NC-306",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:55:43.856Z",
    "process": {
      "pid": 49169,
      "ppid": 49162
    },
    "spec": {
      "label": "NC-306",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "5"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/nc306-maker.report.json"
    },
    "ok": false,
    "error": "failed assert: account colour balance too low | cause: Error executing circuit 'openSwapShielded'",
    "errorKind": "circuit-guard-refusal",
    "published": false
  }
}
```

</details>

## P-F310 replication: a FULLY BACKED offer at two custody cells (`p-f310`) — MEASURED

- **Spec action:** (not a spec row) — deviation D-307's evidence, replicated on a second Manager
- **Spec expects:** F-310 predicts that at two shielded cells the value leg lands in the FALLIBLE section and FR-302 refuses to publish. Here the configuration is 1 pool / 2 cells — F-310's own deciding row

> custody configuration at the time: 1 pool(s) / 2 shielded cells. The offer gives 2 S_A with AA_A's cell at 2 and the pool at 5 — fully backed, so no guard can refuse it and placement is the only thing left.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the fully-backed offer FAILS CLOSED on FR-302 — F-310 replicated | PASS | ok=false kind=fr302-placement-fail-closed |
| 2 | the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [1466] |
| 3 | nothing was published | PASS | — |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 3ee0a9b91f70… / want 1 4fde155ea51f…): segments present: [0,17855] intent segments: [17855] fallible-offer segments: [17855] expected 0: {"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 17855: {"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

**Before** (2026-08-20T12:55:45.994Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:56:05.425Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

<details><summary>Artifacts and process reports</summary>

```json
{
  "armed": {
    "kind": "maker",
    "label": "P-F310-armed",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:55:48.059Z",
    "process": {
      "pid": 49253,
      "ppid": 49246
    },
    "spec": {
      "label": "P-F310-armed",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "2"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/pf310-c-armed.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310c-armed.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 3ee0a9b91f70… / want 1 4fde155ea51f…): segments present: [0,17855] intent segments: [17855] fallible-offer segments: [17855] expected 0: {\"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25\":\"-1\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 17855: {\"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25\":\"-1\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "measured": {
    "kind": "maker",
    "label": "P-F310-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:55:57.222Z",
    "process": {
      "pid": 49353,
      "ppid": 49347
    },
    "spec": {
      "label": "P-F310-measured",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "2"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "measureOnly": true,
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310c-measured.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c",
      "gives": {
        "colour": "3ee0a9b91f70b37ef2bfe392b9007eb45e645f96aafe5af90b6ba7390a78e46b",
        "value": "2",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25",
        "value": "1",
        "nonce": "d049687bc9b388c7c3d1718fadb2f99cb2490f06136c460ff745517c4aa5b3ae"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:56:03.888Z",
      "expiresAt": "2026-08-20T13:56:03.888Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          1466
        ],
        "intentSegments": [
          1466
        ],
        "fallibleOfferSegments": [
          1466
        ],
        "imbalances": {
          "0": {},
          "1466": {
            "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
          }
        },
        "expectedAtSegment0": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "1466: {\"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25\":\"-1\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "c6437a71bd4a13b3ef2a229d0002e6691ac10ff1d9207a3df8dc6d078882d0ed",
      "transactionBytes": 26869
    },
    "placement": {
      "segments": [
        0,
        1466
      ],
      "intentSegments": [
        1466
      ],
      "fallibleOfferSegments": [
        1466
      ],
      "imbalances": {
        "0": {},
        "1466": {
          "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
        }
      },
      "expectedAtSegment0": {
        "shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25": "-1"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "1466: {\"shielded:4fde155ea51fe4c7a5b91f512627a55edb6865cfeac20c02e80b0966525b3f25\":\"-1\"}"
      ],
      "ok": false
    },
    "proveMs": 5959,
    "transactionBytes": 26869,
    "contentAddress": "c6437a71bd4a13b3ef2a229d0002e6691ac10ff1d9207a3df8dc6d078882d0ed",
    "published": false,
    "publishedNote": "measureOnly — the placement report is the deliverable; the artifact is discarded unpublished"
  }
}
```

</details>

## Stage C closing state, both observation points (`closing`) — PASS

- **Spec expects:** the negatives changed nothing they were not meant to; the invariant and conservation still hold

> closing custody: pools {"S_A":"5","S_B":"absent"}, cells {"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"3","AA_B/S_B":"absent"}, sizes {"pools":1,"shieldedCells":2,"unshieldedCells":0}; wallets {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | OP1 and OP2 agree on every cell | PASS | agree |
| 2 | per-colour invariant: every pool equals the sum of that colour’s cells | PASS | S_A: pool 5 vs cells 5; S_B: pool 0 vs cells 0 |
| 3 | zero unaccounted ledger keys (pools, shielded cells, unshielded cells) | PASS | {"pools":[],"shieldedCells":[],"unshieldedCells":[]} |
| 4 | conservation: minted = user holdings + custody pool, per colour | PASS | S_A: minted 12 = users 7 + pool 5; S_B: minted 10 = users 10 + pool 0 |

**After** (2026-08-20T12:57:21.976Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `8f5330048066432c…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | 3 | 3 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

