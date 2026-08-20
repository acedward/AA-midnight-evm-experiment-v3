# Swap step ledger — STAGE C

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T16:15:16.267Z

**VERDICT: GREEN**

**Carries:** rows 9 (NC-303), 11 (P-104), 12 (P-CXL, both forms), NC-306, P-F310 replication

Manager `bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

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
- **Transactions:** `003ad562ef6bc49af4e0fd52f9271830c28249a988018fbc64297bfa47bbf4e51d`, `004c578c48c979135324ac9846eea1e00f8b1b7a9cb2ba19f05f3dffe71870ec5d`, `009e09ff55473f01d0d168c346cbc5c118c051c834886427f96cce4a7e86875bdf`

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

**Before** (2026-08-20T16:04:37.511Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

**After** (2026-08-20T16:08:39.851Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `9d6a4e8e7f73eb99…` / 47 |
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
| 1 | OFFER-3 was built and proven | PASS | 7569 ms |
| 2 | the intent TTL rewrite took effect BEFORE proving (F-306) | PASS | 2026-08-20T16:10:43.000Z |
| 3 | the taker's OWN gate refuses the expired offer OFFLINE, with no network contact | PASS | stage=expired offline=true |
| 4 | and with that gate forced off, the NODE refuses it too | PASS | stage=settlement code 228 |
| 5 | the node's code is 228 (IntentTtlExpired) — the code Plan 02 measured | PASS | 228 — MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487) |
| 6 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 7 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 8 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 9 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"0","S_B":"0"},"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
offer expired 35 s ago (expiresAt 2026-08-20T16:10:50.765Z); refused locally without contacting the chain
```

```
1010: Invalid Transaction: Custom error: 228
```

**Before** (2026-08-20T16:08:52.271Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `9d6a4e8e7f73eb99…` / 47 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T16:11:32.130Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `9d6a4e8e7f73eb99…` / 47 |
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
    "utc": "2026-08-20T16:08:42.456Z",
    "process": {
      "pid": 90745,
      "ppid": 90731
    },
    "spec": {
      "label": "OFFER-3",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "ttlSeconds": 120,
      "rewriteIntentTtlSeconds": 120,
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row9-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1",
        "nonce": "26ac2f88ffa3235a41bbaaa751ec938b6ecc7ee5160b9c68c435b56736769cc2"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:08:50.765Z",
      "expiresAt": "2026-08-20T16:10:50.765Z",
      "ttlSeconds": 120,
      "placement": {
        "segments": [
          0,
          58396
        ],
        "intentSegments": [
          58396
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "58396": {}
        },
        "expectedAtSegment0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "3bcb6503fa12b247cbfbc4ad48db618296eae643b0fd1d856071888822f1c55e",
      "transactionBytes": 26820
    },
    "placement": {
      "segments": [
        0,
        58396
      ],
      "intentSegments": [
        58396
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "58396": {}
      },
      "expectedAtSegment0": {
        "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 7569,
    "transactionBytes": 26820,
    "contentAddress": "3bcb6503fa12b247cbfbc4ad48db618296eae643b0fd1d856071888822f1c55e",
    "intentTtlRewrite": "2026-08-20T16:10:43.000Z",
    "published": true,
    "envelopeFile": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row9-maker.offer"
  },
  "localGateTake": {
    "kind": "taker",
    "label": "row-9-local",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T16:11:24.918Z",
    "process": {
      "pid": 93834,
      "ppid": 93828
    },
    "opts": {
      "label": "row-9-local",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "amount": "1"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row9-taker-local.report.json"
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
        "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
        "gives": {
          "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "value": "1",
          "nonce": "26ac2f88ffa3235a41bbaaa751ec938b6ecc7ee5160b9c68c435b56736769cc2"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T16:08:50.765Z",
        "expiresAt": "2026-08-20T16:10:50.765Z",
        "ttlSeconds": 120,
        "placement": {
          "segments": [
            0,
            58396
          ],
          "intentSegments": [
            58396
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
            },
            "58396": {}
          },
          "expectedAtSegment0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "3bcb6503fa12b247cbfbc4ad48db618296eae643b0fd1d856071888822f1c55e",
        "transactionBytes": 26820
      },
      "contentAddress": "3bcb6503fa12b247cbfbc4ad48db618296eae643b0fd1d856071888822f1c55e",
      "secondsLeft": -35,
      "error": "offer expired 35 s ago (expiresAt 2026-08-20T16:10:50.765Z); refused locally without contacting the chain",
      "offlineRefusal": true
    },
    "tookMs": 598
  },
  "nodeTake": {
    "kind": "taker",
    "label": "row-9-node",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T16:11:27.575Z",
    "process": {
      "pid": 93962,
      "ppid": 93956
    },
    "opts": {
      "label": "row-9-node",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "amount": "1"
        }
      ],
      "ignoreExpiry": true,
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row9-taker-node.report.json"
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
        "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
        "gives": {
          "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "value": "1",
          "nonce": "26ac2f88ffa3235a41bbaaa751ec938b6ecc7ee5160b9c68c435b56736769cc2"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T16:08:50.765Z",
        "expiresAt": "2026-08-20T16:10:50.765Z",
        "ttlSeconds": 120,
        "placement": {
          "segments": [
            0,
            58396
          ],
          "intentSegments": [
            58396
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
            },
            "58396": {}
          },
          "expectedAtSegment0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "3bcb6503fa12b247cbfbc4ad48db618296eae643b0fd1d856071888822f1c55e",
        "transactionBytes": 26820
      },
      "contentAddress": "3bcb6503fa12b247cbfbc4ad48db618296eae643b0fd1d856071888822f1c55e",
      "secondsLeft": -37,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "58396": {}
        },
        "deficits": {
          "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b"
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
            "error": "transaction application error detected during verification: Intent TTL has expired. TTL: Timestamp(1787242243), Current block: Timestamp(1787242288)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "transaction application error detected during verification: Intent TTL has expired. TTL: Timestamp(1787242243), Current block: Timestamp(1787242289)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1074271698261483"
            },
            "1": {},
            "58396": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "58396": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            58396
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 228,
          "decoded": "MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487)",
          "verbatim": "1010: Invalid Transaction: Custom error: 228",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 228\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1074271698261483"
          },
          "1": {},
          "58396": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "58396": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          58396
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
    "tookMs": 3096
  }
}
```

</details>

## Row 11 — Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken (`row-11`) — MEASURED

- **Spec action:** Staleness probe (FR-311): OFFER-4 built on a live colour, then an ordinary deposit lands on that colour, then OFFER-4 taken
- **Spec expects:** expected refusal (Custom error: 104 — Transcript); verbatim + no-state; MEASURED, not judged
- **As run (D-307):** the MEASURED code is 239 = ZswapInvalidErrorCode::NullifierAlreadyPresent, not the predicted 104 (finding F-309, 3/3 in Plan 02): an ordinary deposit MERGES the pooled coin and merging SPENDS it, so the offer's pinned coin is already nullified. FR-311 asks for the measured rule, so the measured rule is asserted and the divergence recorded
- **Transactions:** `007958a8a995e043ea1ff29db3d19df2c80e2815f77e447b62e3117693b448d9bb`

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

**Before** (2026-08-20T16:12:11.171Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 7 | `8098646c3d0bb00d…` / 49 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 7 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T16:12:18.279Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 7 | `8098646c3d0bb00d…` / 49 |
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
    "utc": "2026-08-20T16:11:34.159Z",
    "process": {
      "pid": 94153,
      "ppid": 94147
    },
    "spec": {
      "label": "OFFER-4",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row11-maker.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row11-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1",
        "nonce": "823fdf11f1d843d1f70cb29d5fa1a95bec4a758d18646b3ddf0095000639c751"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:11:40.748Z",
      "expiresAt": "2026-08-20T17:11:40.748Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          40763
        ],
        "intentSegments": [
          40763
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "40763": {}
        },
        "expectedAtSegment0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "7022f98a52c13223b7cfb46cfa65027482c9a6bb7e297aa517c659b91ebdea22",
      "transactionBytes": 26878
    },
    "placement": {
      "segments": [
        0,
        40763
      ],
      "intentSegments": [
        40763
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "40763": {}
      },
      "expectedAtSegment0": {
        "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 5985,
    "transactionBytes": 26878,
    "contentAddress": "7022f98a52c13223b7cfb46cfa65027482c9a6bb7e297aa517c659b91ebdea22",
    "published": true,
    "envelopeFile": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row11-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-11",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T16:12:13.461Z",
    "process": {
      "pid": 94963,
      "ppid": 94957
    },
    "opts": {
      "label": "row-11",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row11-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "amount": "1"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row11-taker.report.json"
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
        "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
        "gives": {
          "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "value": "1",
          "nonce": "823fdf11f1d843d1f70cb29d5fa1a95bec4a758d18646b3ddf0095000639c751"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T16:11:40.748Z",
        "expiresAt": "2026-08-20T17:11:40.748Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            40763
          ],
          "intentSegments": [
            40763
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
            },
            "40763": {}
          },
          "expectedAtSegment0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "7022f98a52c13223b7cfb46cfa65027482c9a6bb7e297aa517c659b91ebdea22",
        "transactionBytes": 26878
      },
      "contentAddress": "7022f98a52c13223b7cfb46cfa65027482c9a6bb7e297aa517c659b91ebdea22",
      "secondsLeft": 3567,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "40763": {}
        },
        "deficits": {
          "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b"
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
            "error": "call to non-existant contract ContractAddress(bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1078485262003705"
            },
            "1": {},
            "40763": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "40763": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            40763
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 239,
          "decoded": "ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400)",
          "verbatim": "1010: Invalid Transaction: Custom error: 239",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 239\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1078485262003705"
          },
          "1": {},
          "40763": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "40763": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          40763
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
    "tookMs": 3361
  }
}
```

</details>

## Row 12 — Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL (`row-12a`) — MEASURED

- **Spec action:** Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken
- **Spec expects:** REFUSED; no state — cancellation-by-spend works
- **As run (D-307):** BOTH forms the spec names are measured separately, because they are not the same mechanism: a WITHDRAW spends the pooled coin, while `transferInternalShielded` performs NO token operation at all (the pooled coin is byte-identical afterwards) and can only invalidate an offer through the account cell its transcript read
- **Transactions:** `005d10fba8ec5b0d0edc6a3580b6ed0341be326eb7d0d4b5a7adc26aa70c6fa182`

> cancellation: the owner withdrew 2 S_A to its own wallet; pool(S_A) 7 -> 5, and the POOLED COIN CHANGED (8098646c3d0b… -> f8f35c5ebd1b…) because `sendShielded` spends it and re-pools the change

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the cancelled offer was REFUSED | PASS | stage=settlement |
| 2 | the pooled coin really did move (so this is cancellation BY SPEND) | PASS | 8098646c3d0bb00d… -> f8f35c5ebd1bfac9… |
| 3 | the node's code is 239 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 239
```

**Before** (2026-08-20T16:12:52.677Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 5 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T16:12:59.808Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
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
    "utc": "2026-08-20T16:12:20.366Z",
    "process": {
      "pid": 95153,
      "ppid": 95147
    },
    "spec": {
      "label": "OFFER-5",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row12a-maker.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row12a-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1",
        "nonce": "9ed1c82a709e49d86831a9dfcb66ab07a85317c4f3a9075b1b700535e197089d"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:12:27.168Z",
      "expiresAt": "2026-08-20T17:12:27.168Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          62558
        ],
        "intentSegments": [
          62558
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "62558": {}
        },
        "expectedAtSegment0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "bd47e1d80e00c5ab01510c735728b1d5c77e5d87510e613718e9d73503d120cc",
      "transactionBytes": 26818
    },
    "placement": {
      "segments": [
        0,
        62558
      ],
      "intentSegments": [
        62558
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "62558": {}
      },
      "expectedAtSegment0": {
        "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6183,
    "transactionBytes": 26818,
    "contentAddress": "bd47e1d80e00c5ab01510c735728b1d5c77e5d87510e613718e9d73503d120cc",
    "published": true,
    "envelopeFile": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row12a-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-12a",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T16:12:54.887Z",
    "process": {
      "pid": 95875,
      "ppid": 95869
    },
    "opts": {
      "label": "row-12a",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row12a-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "amount": "1"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row12a-taker.report.json"
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
        "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
        "gives": {
          "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "value": "1",
          "nonce": "9ed1c82a709e49d86831a9dfcb66ab07a85317c4f3a9075b1b700535e197089d"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T16:12:27.168Z",
        "expiresAt": "2026-08-20T17:12:27.168Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            62558
          ],
          "intentSegments": [
            62558
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
            },
            "62558": {}
          },
          "expectedAtSegment0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "bd47e1d80e00c5ab01510c735728b1d5c77e5d87510e613718e9d73503d120cc",
        "transactionBytes": 26818
      },
      "contentAddress": "bd47e1d80e00c5ab01510c735728b1d5c77e5d87510e613718e9d73503d120cc",
      "secondsLeft": 3572,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "62558": {}
        },
        "deficits": {
          "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b"
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
            "error": "call to non-existant contract ContractAddress(bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1081546023421332"
            },
            "1": {},
            "62558": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "62558": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            62558
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 239,
          "decoded": "ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400)",
          "verbatim": "1010: Invalid Transaction: Custom error: 239",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 239\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1081546023421332"
          },
          "1": {},
          "62558": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "62558": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          62558
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
    "tookMs": 3430
  }
}
```

</details>

## Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL (`row-12b`) — MEASURED

- **Spec action:** Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken
- **Spec expects:** REFUSED; no state — cancellation-by-spend works
- **As run (D-307):** the spec names "internal transfer / withdraw" as if they were interchangeable. They are not: `transferInternalShielded` performs NO token operation — the pooled coin must be byte-identical afterwards — so it can only invalidate an offer through the ACCOUNT CELL the transcript read. MEASURED separately for that reason. It is also the row that takes custody to two cells, which is why it runs after every other publishable offer
- **Transactions:** `00e0757ecd2f3b1d2166445e347de7337382189588b38db966fa9a9ccee9f209b5`

> intervention: AA_A transferred 3 S_A to AA_B INSIDE the Manager. AA_A's cell 5 -> 2, AA_B's cell created at 3; custody is now 1 pool(s) / 2 cells
> So FR-307(d) holds for BOTH forms the spec names, but by two different mechanisms — and only the withdraw is literally "moving the backing pool coin".

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the pooled coin is BYTE-IDENTICAL — no token operation happened | PASS | f8f35c5ebd1bfac9…/51 vs f8f35c5ebd1bfac9…/51 |
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

**Before** (2026-08-20T16:13:28.787Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T16:13:35.796Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
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
    "utc": "2026-08-20T16:13:01.916Z",
    "process": {
      "pid": 96075,
      "ppid": 96068
    },
    "spec": {
      "label": "OFFER-6",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row12b-maker.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row12b-maker.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1",
        "nonce": "f7fce958488b890ddd37a530e920aa72802f4ffeee835d73ee55d0bfb80c17af"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:13:08.789Z",
      "expiresAt": "2026-08-20T17:13:08.789Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          20665
        ],
        "intentSegments": [
          20665
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "20665": {}
        },
        "expectedAtSegment0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "b7be09ab35c9c4e7709013be6824f3ef98d1a083745efdd1c815e5b27a7d4a60",
      "transactionBytes": 26818
    },
    "placement": {
      "segments": [
        0,
        20665
      ],
      "intentSegments": [
        20665
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "20665": {}
      },
      "expectedAtSegment0": {
        "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6231,
    "transactionBytes": 26818,
    "contentAddress": "b7be09ab35c9c4e7709013be6824f3ef98d1a083745efdd1c815e5b27a7d4a60",
    "published": true,
    "envelopeFile": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row12b-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-12b",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T16:13:30.863Z",
    "process": {
      "pid": 96693,
      "ppid": 96687
    },
    "opts": {
      "label": "row-12b",
      "envelope": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/row12b-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "amount": "1"
        }
      ],
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/row12b-taker.report.json"
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
        "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
        "gives": {
          "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
          "value": "1",
          "nonce": "f7fce958488b890ddd37a530e920aa72802f4ffeee835d73ee55d0bfb80c17af"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T16:13:08.789Z",
        "expiresAt": "2026-08-20T17:13:08.789Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            20665
          ],
          "intentSegments": [
            20665
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
            },
            "20665": {}
          },
          "expectedAtSegment0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "b7be09ab35c9c4e7709013be6824f3ef98d1a083745efdd1c815e5b27a7d4a60",
        "transactionBytes": 26818
      },
      "contentAddress": "b7be09ab35c9c4e7709013be6824f3ef98d1a083745efdd1c815e5b27a7d4a60",
      "secondsLeft": 3577,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          },
          "20665": {}
        },
        "deficits": {
          "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b"
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
            "error": "call to non-existant contract ContractAddress(bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1081917201617889"
            },
            "1": {},
            "20665": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "20665": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            20665
          ]
        },
        "error": "Transaction submission error",
        "nodeRefusal": {
          "code": 104,
          "decoded": "InvalidError::Transcript (types.rs:406)",
          "verbatim": "1010: Invalid Transaction: Custom error: 104",
          "beforeSubmission": false
        },
        "errorDump": "(FiberFailure) SubmissionError: Transaction submission error\n    at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-capabilities@4.0.0-beta.2_ws@8.21.3/node_modules/@midnightntwrk/wallet-sdk-capabilities/dist/submission/submissionService.js:31:279\n    at /private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/core.ts:1078:35\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:41)\n    at body (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/Utils.ts:786:14)\n    at FiberRuntime.Sync (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1161:19)\n    at <anonymous> (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1398:53)\n    at Object.f (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/tracer.ts:101:19)\n    at FiberRuntime.runLoop (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:1384:34)\n    at FiberRuntime.evaluateEffect (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:950:27)\n    at FiberRuntime.evaluateMessageWhileSuspended (/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/effect@3.22.1/node_modules/effect/src/internal/fiberRuntime.ts:918:14) {\n  [cause]: SubmissionError: Transaction submission failed\n      at file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@midnightntwrk+wallet-sdk-node-client@2.0.0-beta.2_@midnightntwrk+ledger-v9@1.0.0-rc.3__9fdca0ce4a97c2531cda791ff76bb4dc/node_modules/@midnightntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:86:27\n      at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {\n    [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104\n        at checkError (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)\n        at RpcCoder.decodeResponse (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)\n        at #onSocketMessageResult (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)\n        at #onSocketMessage (file:///private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/harness/node_modules/.pnpm/@polkadot+rpc-provider@16.5.6/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)\n        at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)\n        at WebSocket.dispatchEvent (node:internal/event_target:762:26)\n        at fireEvent (node:internal/deps/undici/undici:12652:14)\n        at #onMessage (node:internal/deps/undici/undici:13883:9)\n        at Object.onMessage (node:internal/deps/undici/undici:13596:76)\n        at websocketMessageReceived (node:internal/deps/undici/undici:12656:15)\n  }\n}"
      },
      "merged": {
        "imbalances": {
          "0": {
            "dust": "1081917201617889"
          },
          "1": {},
          "20665": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "20665": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          20665
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
    "tookMs": 3440
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

**Before** (2026-08-20T16:13:35.796Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T16:13:39.968Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
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
    "utc": "2026-08-20T16:13:37.920Z",
    "process": {
      "pid": 96894,
      "ppid": 96888
    },
    "spec": {
      "label": "NC-306",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "5"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/nc306-maker.report.json"
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
| 2 | the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [39338] |
| 3 | nothing was published | PASS | — |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerA":{"S_A":"2","S_B":"0"},"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 9ae23435fce1… / want 1 99e9425a10a2…): segments present: [0,4807] intent segments: [4807] fallible-offer segments: [4807] expected 0: {"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 4807: {"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

**Before** (2026-08-20T16:13:39.968Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T16:13:59.246Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
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
    "utc": "2026-08-20T16:13:42.062Z",
    "process": {
      "pid": 97038,
      "ppid": 97032
    },
    "spec": {
      "label": "P-F310-armed",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "2"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/offers/pf310-c-armed.offer",
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/pf310c-armed.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 9ae23435fce1… / want 1 99e9425a10a2…): segments present: [0,4807] intent segments: [4807] fallible-offer segments: [4807] expected 0: {\"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b\":\"-1\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 4807: {\"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b\":\"-1\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "measured": {
    "kind": "maker",
    "label": "P-F310-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T16:13:51.037Z",
    "process": {
      "pid": 97275,
      "ppid": 97256
    },
    "spec": {
      "label": "P-F310-measured",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "2"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "measureOnly": true,
      "out": "/private/var/folders/_l/btc7vkzx59j_4tmlx2h02c600000gn/T/aa00006-g4-88MwCz/clone/evidence/g3-swap-ledger/io/pf310c-measured.report.json"
    },
    "ok": true,
    "terms": {
      "version": 1,
      "label": "EXPERIMENTAL_LANE / LANE-DEV-1",
      "shape": "named-taker",
      "circuitId": "openSwapShielded",
      "form": "pre-binding",
      "managerAddress": "bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65",
      "gives": {
        "colour": "9ae23435fce1f79a07fd6689eb95f2f460c326fe9ae6c35e6212eed3cd2f1422",
        "value": "2",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b",
        "value": "1",
        "nonce": "5869107a998960853bf416f2410812030809da54c744306ecbe11da8e596fdcc"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T16:13:57.724Z",
      "expiresAt": "2026-08-20T17:13:57.724Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          39338
        ],
        "intentSegments": [
          39338
        ],
        "fallibleOfferSegments": [
          39338
        ],
        "imbalances": {
          "0": {},
          "39338": {
            "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
          }
        },
        "expectedAtSegment0": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "39338: {\"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b\":\"-1\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "1b4ab165e58cbfa8b356f0bedd5cbe176b1ffaabaa7811ac7599a85fa21bfe43",
      "transactionBytes": 26869
    },
    "placement": {
      "segments": [
        0,
        39338
      ],
      "intentSegments": [
        39338
      ],
      "fallibleOfferSegments": [
        39338
      ],
      "imbalances": {
        "0": {},
        "39338": {
          "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
        }
      },
      "expectedAtSegment0": {
        "shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b": "-1"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "39338: {\"shielded:99e9425a10a245c7934cae593b4a9ff3a986b2b4ed4c53802ecc1d3b899e993b\":\"-1\"}"
      ],
      "ok": false
    },
    "proveMs": 6016,
    "transactionBytes": 26869,
    "contentAddress": "1b4ab165e58cbfa8b356f0bedd5cbe176b1ffaabaa7811ac7599a85fa21bfe43",
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

**After** (2026-08-20T16:15:16.266Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `f8f35c5ebd1bfac9…` / 51 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | 3 | 3 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

