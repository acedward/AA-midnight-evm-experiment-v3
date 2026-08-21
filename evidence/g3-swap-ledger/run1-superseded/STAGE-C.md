# Swap step ledger — STAGE C

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:15:21.979Z

**VERDICT: GREEN**

**Carries:** rows 9 (NC-303), 11 (P-104), 12 (P-CXL, both forms), NC-306, P-F310 replication

Manager `57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47` — a FRESH deployment for this stage, per deviation **D-307**: F-310 — an offer is publishable only while the Manager holds at most ONE shielded custody cell; the spec's row 5 settlement creates the second, so rows 7–12 as literally written cannot be built.

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
- **Transactions:** `00a174628fd6e6214b52cfc202a8e7d86ebd08c1839671f11d805f587eead025c6`, `0031f068abfddf27b5b8b9c4fc2dca8fd91c3fa93ab4a988aed01404332ef68880`, `0086cc1b1d32c93a96c921519c260038a292a67ec9e74363995cbb3f8d2d8db6dd`

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

**Before** (2026-08-20T12:04:42.149Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|

Map sizes: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`; accounts: 2.
Wallets: not read at this point.

**After** (2026-08-20T12:08:46.032Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `633ff9e9e15d341a…` / 46 |
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
| 1 | OFFER-3 was built and proven | PASS | 7557 ms |
| 2 | the intent TTL rewrite took effect BEFORE proving (F-306) | PASS | 2026-08-20T12:10:49.000Z |
| 3 | the taker's OWN gate refuses the expired offer OFFLINE, with no network contact | PASS | stage=expired offline=true |
| 4 | and with that gate forced off, the NODE refuses it too | PASS | stage=settlement code 228 |
| 5 | the node's code is 228 (IntentTtlExpired) — the code Plan 02 measured | PASS | 228 — MalformedError::TransactionApplication(IntentTtlExpired) (types.rs:487) |
| 6 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 7 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 8 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 9 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
offer expired 35 s ago (expiresAt 2026-08-20T12:10:56.945Z); refused locally without contacting the chain
```

```
1010: Invalid Transaction: Custom error: 228
```

**Before** (2026-08-20T12:08:58.449Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `633ff9e9e15d341a…` / 46 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 6 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"6","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:11:38.225Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 6 | `633ff9e9e15d341a…` / 46 |
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
    "utc": "2026-08-20T12:08:48.662Z",
    "process": {
      "pid": 31555,
      "ppid": 31549
    },
    "spec": {
      "label": "OFFER-3",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
        "value": "1",
        "nonce": "2efa1db82d260db1c33a852448831d6f41c0e32cd3a558d6b0b65af1671ba7e7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:08:56.945Z",
      "expiresAt": "2026-08-20T12:10:56.945Z",
      "ttlSeconds": 120,
      "placement": {
        "segments": [
          0,
          2979
        ],
        "intentSegments": [
          2979
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "2979": {}
        },
        "expectedAtSegment0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "a239c3f88699131eac01e62d6baa2018a543fb05b05748e7c56acf66a4087e27",
      "transactionBytes": 26819
    },
    "placement": {
      "segments": [
        0,
        2979
      ],
      "intentSegments": [
        2979
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "2979": {}
      },
      "expectedAtSegment0": {
        "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 7557,
    "transactionBytes": 26819,
    "contentAddress": "a239c3f88699131eac01e62d6baa2018a543fb05b05748e7c56acf66a4087e27",
    "intentTtlRewrite": "2026-08-20T12:10:49.000Z",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer"
  },
  "localGateTake": {
    "kind": "taker",
    "label": "row-9-local",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:11:31.025Z",
    "process": {
      "pid": 32167,
      "ppid": 32153
    },
    "opts": {
      "label": "row-9-local",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
        "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
        "gives": {
          "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
          "value": "1",
          "nonce": "2efa1db82d260db1c33a852448831d6f41c0e32cd3a558d6b0b65af1671ba7e7"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:08:56.945Z",
        "expiresAt": "2026-08-20T12:10:56.945Z",
        "ttlSeconds": 120,
        "placement": {
          "segments": [
            0,
            2979
          ],
          "intentSegments": [
            2979
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
            },
            "2979": {}
          },
          "expectedAtSegment0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "a239c3f88699131eac01e62d6baa2018a543fb05b05748e7c56acf66a4087e27",
        "transactionBytes": 26819
      },
      "contentAddress": "a239c3f88699131eac01e62d6baa2018a543fb05b05748e7c56acf66a4087e27",
      "secondsLeft": -35,
      "error": "offer expired 35 s ago (expiresAt 2026-08-20T12:10:56.945Z); refused locally without contacting the chain",
      "offlineRefusal": true
    },
    "tookMs": 575
  },
  "nodeTake": {
    "kind": "taker",
    "label": "row-9-node",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:11:33.689Z",
    "process": {
      "pid": 32236,
      "ppid": 32222
    },
    "opts": {
      "label": "row-9-node",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row9-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
        "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
        "gives": {
          "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
          "value": "1",
          "nonce": "2efa1db82d260db1c33a852448831d6f41c0e32cd3a558d6b0b65af1671ba7e7"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:08:56.945Z",
        "expiresAt": "2026-08-20T12:10:56.945Z",
        "ttlSeconds": 120,
        "placement": {
          "segments": [
            0,
            2979
          ],
          "intentSegments": [
            2979
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
            },
            "2979": {}
          },
          "expectedAtSegment0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "a239c3f88699131eac01e62d6baa2018a543fb05b05748e7c56acf66a4087e27",
        "transactionBytes": 26819
      },
      "contentAddress": "a239c3f88699131eac01e62d6baa2018a543fb05b05748e7c56acf66a4087e27",
      "secondsLeft": -37,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "2979": {}
        },
        "deficits": {
          "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc"
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
            "error": "transaction application error detected during verification: Intent TTL has expired. TTL: Timestamp(1787227849), Current block: Timestamp(1787227894)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "transaction application error detected during verification: Intent TTL has expired. TTL: Timestamp(1787227849), Current block: Timestamp(1787227895)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1074448063128418"
            },
            "1": {},
            "2979": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "2979": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            2979
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
            "dust": "1074448063128418"
          },
          "1": {},
          "2979": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "2979": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          2979
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
    "tookMs": 3054
  }
}
```

</details>

## Row 11 — Staleness (FR-311): a deposit lands on the offered colour, then OFFER-4 is taken (`row-11`) — MEASURED

- **Spec action:** Staleness probe (FR-311): OFFER-4 built on a live colour, then an ordinary deposit lands on that colour, then OFFER-4 taken
- **Spec expects:** expected refusal (Custom error: 104 — Transcript); verbatim + no-state; MEASURED, not judged
- **As run (D-307):** the MEASURED code is 239 = ZswapInvalidErrorCode::NullifierAlreadyPresent, not the predicted 104 (finding F-309, 3/3 in Plan 02): an ordinary deposit MERGES the pooled coin and merging SPENDS it, so the offer's pinned coin is already nullified. FR-311 asks for the measured rule, so the measured rule is asserted and the divergence recorded
- **Transactions:** `005ccbaf379983d019303a74e74932e96329762b44d69681f062f2733e799e8791`

> intervention: OwnerN deposited 1 more S_A into AA_A; pool(S_A) 6 -> 7, which MERGES the pooled coin
> MEASURED, not judged (FR-311). The mechanism: the maker's call pins the pooled coin it spends — the coin's Merkle index enters the transcript — and an ordinary deposit MERGES that coin, which SPENDS it. 239 names that precisely; 104 would only have said "a transcript did not match".

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the live offer was INVALIDATED — the take was refused | PASS | stage=settlement |
| 2 | the MEASURED code is 239 (NullifierAlreadyPresent) — FR-311 predicted 104 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| 3 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 4 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 5 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 6 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 239
```

**Before** (2026-08-20T12:12:17.032Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 7 | `a65123abcb2eb6b1…` / 48 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 7 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"0","S_B":"0"}}`

**After** (2026-08-20T12:12:24.135Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 7 | `a65123abcb2eb6b1…` / 48 |
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
    "utc": "2026-08-20T12:11:40.262Z",
    "process": {
      "pid": 32320,
      "ppid": 32314
    },
    "spec": {
      "label": "OFFER-4",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
        "value": "1",
        "nonce": "8e9a1ab1c78521eda2c6b478af6a62f1b074d25d08f25ad0a7ce417bd277125f"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:11:46.939Z",
      "expiresAt": "2026-08-20T13:11:46.939Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          45968
        ],
        "intentSegments": [
          45968
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "45968": {}
        },
        "expectedAtSegment0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "1b693f7a4e1d821e4dd3dc891c82a00d825a01d812a42333d376712aae897dde",
      "transactionBytes": 26878
    },
    "placement": {
      "segments": [
        0,
        45968
      ],
      "intentSegments": [
        45968
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "45968": {}
      },
      "expectedAtSegment0": {
        "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6005,
    "transactionBytes": 26878,
    "contentAddress": "1b693f7a4e1d821e4dd3dc891c82a00d825a01d812a42333d376712aae897dde",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row11-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-11",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:12:19.139Z",
    "process": {
      "pid": 32497,
      "ppid": 32491
    },
    "opts": {
      "label": "row-11",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row11-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
        "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
        "gives": {
          "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
          "value": "1",
          "nonce": "8e9a1ab1c78521eda2c6b478af6a62f1b074d25d08f25ad0a7ce417bd277125f"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:11:46.939Z",
        "expiresAt": "2026-08-20T13:11:46.939Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            45968
          ],
          "intentSegments": [
            45968
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
            },
            "45968": {}
          },
          "expectedAtSegment0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "1b693f7a4e1d821e4dd3dc891c82a00d825a01d812a42333d376712aae897dde",
        "transactionBytes": 26878
      },
      "contentAddress": "1b693f7a4e1d821e4dd3dc891c82a00d825a01d812a42333d376712aae897dde",
      "secondsLeft": 3567,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "45968": {}
        },
        "deficits": {
          "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc"
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
            "error": "call to non-existant contract ContractAddress(57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1078521487730276"
            },
            "1": {},
            "45968": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "45968": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            45968
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
            "dust": "1078521487730276"
          },
          "1": {},
          "45968": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "45968": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          45968
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
    "tookMs": 3519
  }
}
```

</details>

## Row 12 — Cancellation by WITHDRAW: the maker moves the backing pool coin — P-CXL (`row-12a`) — MEASURED

- **Spec action:** Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken
- **Spec expects:** REFUSED; no state — cancellation-by-spend works
- **As run (D-307):** BOTH forms the spec names are measured separately, because they are not the same mechanism: a WITHDRAW spends the pooled coin, while `transferInternalShielded` performs NO token operation at all (the pooled coin is byte-identical afterwards) and can only invalidate an offer through the account cell its transcript read
- **Transactions:** `004fcad77de3d9267f0be5b7d1b7b076edf4a7a583d2beaf2539850968d644aed2`

> cancellation: the owner withdrew 2 S_A to its own wallet; pool(S_A) 7 -> 5, and the POOLED COIN CHANGED (a65123abcb2e… -> 0c887cf9849d…) because `sendShielded` spends it and re-pools the change

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the cancelled offer was REFUSED | PASS | stage=settlement |
| 2 | the pooled coin really did move (so this is cancellation BY SPEND) | PASS | a65123abcb2eb6b1… -> 0c887cf9849dc8d0… |
| 3 | the node's code is 239 | PASS | 239 — ZswapInvalidErrorCode::NullifierAlreadyPresent (types.rs:400) |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_A is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 239
```

**Before** (2026-08-20T12:12:58.528Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 5 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | absent | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":1,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:13:05.844Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
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
    "utc": "2026-08-20T12:12:26.202Z",
    "process": {
      "pid": 32588,
      "ppid": 32582
    },
    "spec": {
      "label": "OFFER-5",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
        "value": "1",
        "nonce": "b4d88fe261f531a196300b9cb4d6d2b6d024be05d849ea22f58576e510d78fd7"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:12:32.896Z",
      "expiresAt": "2026-08-20T13:12:32.896Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          17608
        ],
        "intentSegments": [
          17608
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "17608": {}
        },
        "expectedAtSegment0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "3e6fdaf7ce2279265749072ebd9ee55f4a0d3eb84da5ebe527c7c0a3a9738449",
      "transactionBytes": 26818
    },
    "placement": {
      "segments": [
        0,
        17608
      ],
      "intentSegments": [
        17608
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "17608": {}
      },
      "expectedAtSegment0": {
        "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6000,
    "transactionBytes": 26818,
    "contentAddress": "3e6fdaf7ce2279265749072ebd9ee55f4a0d3eb84da5ebe527c7c0a3a9738449",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12a-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-12a",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:13:00.756Z",
    "process": {
      "pid": 32762,
      "ppid": 32756
    },
    "opts": {
      "label": "row-12a",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12a-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
        "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
        "gives": {
          "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
          "value": "1",
          "nonce": "b4d88fe261f531a196300b9cb4d6d2b6d024be05d849ea22f58576e510d78fd7"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:12:32.896Z",
        "expiresAt": "2026-08-20T13:12:32.896Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            17608
          ],
          "intentSegments": [
            17608
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
            },
            "17608": {}
          },
          "expectedAtSegment0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "3e6fdaf7ce2279265749072ebd9ee55f4a0d3eb84da5ebe527c7c0a3a9738449",
        "transactionBytes": 26818
      },
      "contentAddress": "3e6fdaf7ce2279265749072ebd9ee55f4a0d3eb84da5ebe527c7c0a3a9738449",
      "secondsLeft": 3572,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "17608": {}
        },
        "deficits": {
          "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc"
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
            "error": "call to non-existant contract ContractAddress(57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1081476158906926"
            },
            "1": {},
            "17608": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "17608": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            17608
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
            "dust": "1081476158906926"
          },
          "1": {},
          "17608": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "17608": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          17608
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
    "tookMs": 3559
  }
}
```

</details>

## Cancellation by INTERNAL TRANSFER: no token moves at all — does the offer still die? — P-CXL (`row-12b`) — MEASURED

- **Spec action:** Cancellation: OFFER-5 built, maker then moves the backing pool coin (internal transfer / withdraw), OFFER-5 taken
- **Spec expects:** REFUSED; no state — cancellation-by-spend works
- **As run (D-307):** the spec names "internal transfer / withdraw" as if they were interchangeable. They are not: `transferInternalShielded` performs NO token operation — the pooled coin must be byte-identical afterwards — so it can only invalidate an offer through the ACCOUNT CELL the transcript read. MEASURED separately for that reason. It is also the row that takes custody to two cells, which is why it runs after every other publishable offer
- **Transactions:** `00defe4a8d4f5d29e6f904d3e79469efbe0bbc2a4736c76477e058be639cf0ca07`

> intervention: AA_A transferred 3 S_A to AA_B INSIDE the Manager. AA_A's cell 5 -> 2, AA_B's cell created at 3; custody is now 1 pool(s) / 2 cells
> So FR-307(d) holds for BOTH forms the spec names, but by two different mechanisms — and only the withdraw is literally "moving the backing pool coin".

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | the pooled coin is BYTE-IDENTICAL — no token operation happened | PASS | 0c887cf9849dc8d0…/52 vs 0c887cf9849dc8d0…/52 |
| 2 | the offer was refused even though no coin moved | PASS | stage=settlement |
| 3 | the code is 104 (Transcript) — the expectation, not an assertion | PASS | 104 — InvalidError::Transcript (types.rs:406) |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | the named cell AA_A/S_B is still ABSENT (not zero) | PASS | observed absent |
| 6 | the named cell AA_B/S_B is still ABSENT (not zero) | PASS | observed absent |
| 7 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
1010: Invalid Transaction: Custom error: 104
```

**Before** (2026-08-20T12:13:34.619Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:13:41.733Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
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
    "utc": "2026-08-20T12:13:07.952Z",
    "process": {
      "pid": 32846,
      "ppid": 32840
    },
    "spec": {
      "label": "OFFER-6",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "1",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
        "value": "1",
        "nonce": "357039104865df922554162982a956bcdaa9e484fda8a292ffa4829286b94e73"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:13:14.687Z",
      "expiresAt": "2026-08-20T13:13:14.687Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          28106
        ],
        "intentSegments": [
          28106
        ],
        "fallibleOfferSegments": [],
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "28106": {}
        },
        "expectedAtSegment0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "segment0Exact": true,
        "otherSegmentsEmpty": true,
        "offendingSegments": [],
        "ok": true
      },
      "makerAttachedDust": false,
      "contentAddress": "13495373e09d066e0173ed37ba06e04eafb9624bcf05b0cd2e90e72da31bfe89",
      "transactionBytes": 26818
    },
    "placement": {
      "segments": [
        0,
        28106
      ],
      "intentSegments": [
        28106
      ],
      "fallibleOfferSegments": [],
      "imbalances": {
        "0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "28106": {}
      },
      "expectedAtSegment0": {
        "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
      },
      "segment0Exact": true,
      "otherSegmentsEmpty": true,
      "offendingSegments": [],
      "ok": true
    },
    "proveMs": 6030,
    "transactionBytes": 26818,
    "contentAddress": "13495373e09d066e0173ed37ba06e04eafb9624bcf05b0cd2e90e72da31bfe89",
    "published": true,
    "envelopeFile": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12b-maker.offer"
  },
  "takeReport": {
    "kind": "taker",
    "label": "row-12b",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:13:36.734Z",
    "process": {
      "pid": 33005,
      "ppid": 32995
    },
    "opts": {
      "label": "row-12b",
      "envelope": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/row12b-maker.offer",
      "takerSeedName": "ownerT",
      "require": [
        {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
        "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
        "gives": {
          "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
          "value": "1",
          "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
          "recipientKind": "user-coin-public-key"
        },
        "wants": {
          "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
          "value": "1",
          "nonce": "357039104865df922554162982a956bcdaa9e484fda8a292ffa4829286b94e73"
        },
        "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
        "createdAt": "2026-08-20T12:13:14.687Z",
        "expiresAt": "2026-08-20T13:13:14.687Z",
        "ttlSeconds": 3600,
        "placement": {
          "segments": [
            0,
            28106
          ],
          "intentSegments": [
            28106
          ],
          "fallibleOfferSegments": [],
          "imbalances": {
            "0": {
              "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
            },
            "28106": {}
          },
          "expectedAtSegment0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "segment0Exact": true,
          "otherSegmentsEmpty": true,
          "offendingSegments": [],
          "ok": true
        },
        "makerAttachedDust": false,
        "contentAddress": "13495373e09d066e0173ed37ba06e04eafb9624bcf05b0cd2e90e72da31bfe89",
        "transactionBytes": 26818
      },
      "contentAddress": "13495373e09d066e0173ed37ba06e04eafb9624bcf05b0cd2e90e72da31bfe89",
      "secondsLeft": 3577,
      "fundability": {
        "imbalances": {
          "0": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          },
          "28106": {}
        },
        "deficits": {
          "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "surpluses": {},
        "declared": {
          "wants": "0/shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc"
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
            "error": "call to non-existant contract ContractAddress(57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47)"
          },
          {
            "flags": {
              "enforceBalancing": true,
              "verifySignatures": true,
              "enforceLimits": true
            },
            "passed": false,
            "error": "call to non-existant contract ContractAddress(57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47)"
          }
        ],
        "preSubmitGuard": {
          "imbalances": {
            "0": {
              "dust": "1081918740337939"
            },
            "1": {},
            "28106": {}
          },
          "unswept": {},
          "dustActions": {
            "1": {
              "spends": 1,
              "registrations": 0
            },
            "28106": {
              "spends": 0,
              "registrations": 0
            }
          },
          "intentSegments": [
            1,
            28106
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
            "dust": "1081918740337939"
          },
          "1": {},
          "28106": {}
        },
        "unswept": {},
        "dustActions": {
          "1": {
            "spends": 1,
            "registrations": 0
          },
          "28106": {
            "spends": 0,
            "registrations": 0
          }
        },
        "intentSegments": [
          1,
          28106
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
    "tookMs": 3454
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
| 9 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
failed assert: account colour balance too low | cause: Error executing circuit 'openSwapShielded'
```

**Before** (2026-08-20T12:13:41.733Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:13:46.014Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
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
    "utc": "2026-08-20T12:13:43.851Z",
    "process": {
      "pid": 33086,
      "ppid": 33080
    },
    "spec": {
      "label": "NC-306",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "5"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
| 2 | the measured placement shows the whole transcript went FALLIBLE (segment 0 empty) | PASS | segment 0 = {}; fallible-offer segments [27917] |
| 3 | nothing was published | PASS | — |
| 4 | NO state created: the whole custody snapshot is byte-identical | PASS | identical (map sizes, pools with coin identity, every cell) |
| 5 | funds unchanged: every wallet holds exactly what it held | PASS | {"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}} |

**Verbatim (F-202 clean — stack frames stripped):**

```
FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 016b86faa3e6… / want 1 8919b48e8691…): segments present: [0,20880] intent segments: [20880] fallible-offer segments: [20880] expected 0: {"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc":"-1"} observed 0: {} segment-0 exact: false other segments carrying deltas: 20880: {"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc":"-1"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.
```

**Before** (2026-08-20T12:13:46.014Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | (not consulted) |
| AA_A/S_B | absent | (not consulted) |
| AA_B/S_A | 3 | (not consulted) |
| AA_B/S_B | absent | (not consulted) |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

**After** (2026-08-20T12:14:05.880Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
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
    "utc": "2026-08-20T12:13:48.159Z",
    "process": {
      "pid": 33163,
      "ppid": 33157
    },
    "spec": {
      "label": "P-F310-armed",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "2"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
        "value": "1"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "recipientSeedName": "ownerT",
      "envelopeOut": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/offers/pf310-c-armed.offer",
      "out": "/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap/evidence/g3-swap-ledger/io/pf310c-armed.report.json"
    },
    "ok": false,
    "error": "FR-302 VIOLATED for named-taker offer (openSwapShielded, give 2 016b86faa3e6… / want 1 8919b48e8691…): segments present: [0,20880] intent segments: [20880] fallible-offer segments: [20880] expected 0: {\"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc\":\"-1\"} observed 0: {} segment-0 exact: false other segments carrying deltas: 20880: {\"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc\":\"-1\"} A leg outside the guaranteed section is UNSETTLEABLE by an independent taker (balancing is per (token, segment) and a taker can only reach segment 0). This is lane issue 0003 in its designed-against form — retain this output as evidence.",
    "errorKind": "fr302-placement-fail-closed",
    "published": false
  },
  "measured": {
    "kind": "maker",
    "label": "P-F310-measured",
    "lane": "EXPERIMENTAL_LANE / LANE-DEV-1",
    "utc": "2026-08-20T12:13:57.316Z",
    "process": {
      "pid": 33254,
      "ppid": 33248
    },
    "spec": {
      "label": "P-F310-measured",
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "witness": "ownerA",
      "shape": "named-taker",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "2"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
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
      "managerAddress": "57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47",
      "gives": {
        "colour": "016b86faa3e6b0ed10d21ffb7db6bc954e667dd17c99c640067bf3ceab54470d",
        "value": "2",
        "recipient": "226fe909b3edee5d22d8ec41f643d1138f8f93bd10b023391ece325ded8821df",
        "recipientKind": "user-coin-public-key"
      },
      "wants": {
        "colour": "8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc",
        "value": "1",
        "nonce": "565874245266f9be1e972bff19209bff01475800fdc30d61ab07dc02879c76a2"
      },
      "creditAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "makerAccount": "009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b",
      "createdAt": "2026-08-20T12:14:04.290Z",
      "expiresAt": "2026-08-20T13:14:04.290Z",
      "ttlSeconds": 3600,
      "placement": {
        "segments": [
          0,
          27917
        ],
        "intentSegments": [
          27917
        ],
        "fallibleOfferSegments": [
          27917
        ],
        "imbalances": {
          "0": {},
          "27917": {
            "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
          }
        },
        "expectedAtSegment0": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        },
        "segment0Exact": false,
        "otherSegmentsEmpty": false,
        "offendingSegments": [
          "27917: {\"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc\":\"-1\"}"
        ],
        "ok": false
      },
      "makerAttachedDust": false,
      "contentAddress": "27a5836f4a9c35e42277b4edef68bd12e22b848e182552c078b8a48ec0f8c233",
      "transactionBytes": 26869
    },
    "placement": {
      "segments": [
        0,
        27917
      ],
      "intentSegments": [
        27917
      ],
      "fallibleOfferSegments": [
        27917
      ],
      "imbalances": {
        "0": {},
        "27917": {
          "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
        }
      },
      "expectedAtSegment0": {
        "shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc": "-1"
      },
      "segment0Exact": false,
      "otherSegmentsEmpty": false,
      "offendingSegments": [
        "27917: {\"shielded:8919b48e869147749d911533962c0580d0c4d1e80d2236279aeb477579e9aacc\":\"-1\"}"
      ],
      "ok": false
    },
    "proveMs": 6234,
    "transactionBytes": 26869,
    "contentAddress": "27a5836f4a9c35e42277b4edef68bd12e22b848e182552c078b8a48ec0f8c233",
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

**After** (2026-08-20T12:15:21.978Z)

| Pool (colour) | value | pooled coin (nonce / mt_index) |
|---|---|---|
| S_A | 5 | `0c887cf9849dc8d0…` / 52 |
| S_B | absent | — |

| Cell (account/colour) | OP1 (indexer) | OP2 (on-chain call) |
|---|---|---|
| AA_A/S_A | 2 | 2 |
| AA_A/S_B | absent | 0 |
| AA_B/S_A | 3 | 3 |
| AA_B/S_B | absent | 0 |

Map sizes: `{"pools":1,"shieldedCells":2,"unshieldedCells":0}`; accounts: 2.
Wallets (fresh facades, F-104): `{"OwnerN":{"S_A":"5","S_B":"0"},"OwnerT":{"S_A":"0","S_B":"10"},"OwnerA":{"S_A":"2","S_B":"0"}}`

