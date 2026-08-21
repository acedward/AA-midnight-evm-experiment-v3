# Plan 01 Phase 2 — spike results index

`EXPERIMENTAL_LANE` / `LANE-DEV-1` · recorded 2026-08-20T03:44:54Z
· compose project `aa00006-g1-20260820030435-6040` (disposable, this run only)

| Spike | Question | Evidence | Verdict |
|---|---|---|---|
| S1 | can a wallet that did NOT build a contract-call transaction balance it and submit it? | `s1-foreign-balance.json` | GREEN |
| S2 | is node `Custom error: 104` the segment-order bug F-301 predicts? | `s2-segment-order.json` | CONFIRMED — but the POST-HOC fix is REFUTED AS IMPLEMENTED |
| S3 | FR-306: does the artifact round-trip a real process boundary byte-identically with a stable SHA-256? | `s3-offer-roundtrip.json` | GREEN |

Human-readable write-ups: `S1.md`, `S2.md`, `S3.md` in this directory.

Raw offer artifacts (`offers/*.bin`) are DELIBERATELY not committed: they are generated
proof-carrying transactions, and the workspace rule forbids committing generated artifacts.
Their sizes and SHA-256 content addresses are recorded in `s3-offer-roundtrip.json`, which is
what the FR-306 claim actually rests on.

## Decision D-306

**UNBOUND (`pre-binding`)** — the unbound form round-trips byte-identically, keeps FR-302 placement, and S1 settled it through `balanceUnboundTransaction` — the same entry point the pinned SDK's own shielded-swap e2e test uses. It also leaves the taker free to merge without the maker having frozen the transaction, which is what makes an OPEN offer possible at all. The bound form ALSO works and is recorded as the fallback.
