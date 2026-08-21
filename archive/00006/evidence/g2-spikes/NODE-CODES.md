# Node refusal codes observed by Plan 02, decoded from the pinned source

`EXPERIMENTAL_LANE` / `LANE-DEV-1` · 00006-unbalanced-zswap, Plan 02 · recorded 2026-08-20

Every code below is read from `midnight-node/ledger/src/versions/common/types.rs` in the pinned
reference tree. Nothing here is inferred from behaviour.

## What this run observed

| code | verbatim node line | meaning | where |
|---|---|---|---|
| **239** | `1010: Invalid Transaction: Custom error: 239` | `ZswapInvalidErrorCode::NullifierAlreadyPresent` | `types.rs:400` |
| **228** | `1010: Invalid Transaction: Custom error: 228` | `MalformedError::TransactionApplication(IntentTtlExpired)` | `types.rs:487` |

### A correction to FR-311's prediction, and why the measured answer is better

FR-311 predicted `104` (`InvalidError::Transcript`) for the staleness case. The lane answers **239**,
and it did so identically in every attempt of gate run 1 (3/3) and again in run 3.

239 is the more informative answer. An ordinary deposit on the offered colour **merges** the pooled
coin, and merging **spends** it — so by the time a taker arrives, the coin the offer pinned has already
been nullified. `NullifierAlreadyPresent` names that mechanism exactly. `104` would only have said "a
transcript did not match", which is true but tells you nothing about why.

FR-311 asks for the measured rule rather than a predicted one, so the spike asserts 239 and the
divergence is recorded rather than smoothed over.

### 228 is what makes the expiry negative affordable

midnight-js hardcodes `ttlOneHour()` for every intent it builds
(`midnight-js-contracts/dist/index.mjs:990`), so observing node-side expiry would otherwise cost an
hour of waiting per observation. Rewriting the intent's `ttl` while the transaction is still
**unproven** works and reaches the node: the taker's own gate refuses offline first (stage `expired`,
no network contact at all), and with that gate forced off the node refuses with 228.

Doing it before proving is essential — finding F-306 established that rewriting a **proven**
transaction's intents invalidates its zswap proofs (`Custom error: 235`, 12/12, including on
transactions that would have been accepted untouched).

## A known gap in this run's machine-readable evidence

`s5.json` and `S5.md` from gate run 3 render these two codes as `NOT DECODED at these pins`. That is a
defect in the evidence, not in the measurement: the codes were decoded from source while analysing gate
run 1 and written into the master plan's finding F-309, but the decoder table in
`harness/src/node-error.ts` was not updated to match until after run 3 had completed. The table now
carries them (and every other code read off the same match arms), so any later run — and all of Plan
03 — renders them correctly. The verbatim node lines in `s5.json` are unaffected and are the primary
evidence either way.

Re-running a 42-minute spike to improve a string was judged the wrong trade against a green gate; the
decoding is authoritative here and in F-309.

## Previously decoded, retained for reference

| code | meaning | decoded by |
|---|---|---|
| 104 | `InvalidError::Transcript` (`types.rs:406`) | 00006 Plan 01 spike S2 |
| 235 | `MalformedZswapErrorCode::InvalidProof` (`types.rs:446`) | 00006 Plan 01 spike S2 (F-306) |

`171` — the code behind organizer issue 0002 — is **still not decoded**: it is not in the
`InvalidError` arm, and no reading of these match arms has placed it. Recorded as open rather than
guessed at.

## Also read while decoding, directly relevant to F-308 / F-310

These were not observed by this project but bear on the guaranteed/fallible placement finding, so they
are recorded where the next reader will look:

| code | meaning |
|---|---|
| 118 | `MalformedError::FallibleWithoutCheckpoint` |
| 129 | `MalformedError::GuaranteedLimit` |
| 167 | `MalformedError::IllegallyDeclaredGuaranteed` |
| 231 | `FeeCalculationErrorCode::OutsideTimeToDismiss` — the known upstream fee cliff |
| 232 | `FeeCalculationErrorCode::BlockLimitExceeded` — the deploy refusal behind F-307 |

The full table lives in `harness/src/node-error.ts`.
