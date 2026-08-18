# Finding F-104 — the sender's live wallet under-reports its own balance after a send

`EXPERIMENTAL_LANE` / `LANE-DEV-1` — 00004-multi-token-custody, Plan 01 Phase 4 (gate G1).
Recorded 2026-08-18 on the pinned lane (node `2.0.0-rc.4`, indexer `4.4.0-rc.1-arm64`,
wallet-sdk `2.0.0-beta.2`, midnight-js `5.0.0-beta.6`).

## Symptom

G1 step `10-funding` timed out twice waiting for genesis's NIGHT balance to become exactly
`before - amount` after funding the fee wallet — once against the inherited 180s budget, once
against a 900s budget (`duration_s: 933`, `evidence/g1-lane/run.log`). The transaction itself
succeeded both times and the recipient was credited immediately.

## Diagnosis

Two throwaway diagnostics were run against a dedicated stack
(`harness/src/g1/diag-funding.ts`, `harness/src/g1/diag-utxos.ts`; both retained so this is
reproducible).

**1. The submitting wallet's live state stream, sampled every 5s for 180s.** It settles on the
WRONG value immediately and never moves, while reporting that it is strictly complete:

```
[2026-08-18T20:11:22.213Z] genesis before:  250000000000000
[2026-08-18T20:11:22.213Z] amount:          1000000000000
[2026-08-18T20:11:22.213Z] EXPECTED after:  249000000000000
[2026-08-18T20:11:55.730Z]   submitted tx 000ecedc…f86d37 (hash e2ec3981…20ebc1)
[2026-08-18T20:12:00.748Z] t+5s   genesis=199000000000000 (delta -50000000000000) feePayer=1000000000000 utxos=4 progress applied=26 highest=26 strictlyComplete=true
[2026-08-18T20:12:55.912Z] t+60s  genesis=199000000000000 (delta -50000000000000) feePayer=1000000000000 utxos=4 progress applied=26 highest=26 strictlyComplete=true
[2026-08-18T20:14:56.218Z] t+180s genesis=199000000000000 (delta -50000000000000) feePayer=1000000000000 utxos=4 progress applied=26 highest=26 strictlyComplete=true
[2026-08-18T20:14:56.218Z] DID NOT CONVERGE within 180s of sampling
```

**2. A FRESHLY OPENED wallet, same seed, same chain, moments later.** It reads the chain
correctly — 5 UTXOs including the `49000000000000` change, totalling exactly the expected value:

```
=== genesis: balance=249000000000000 availableCoins=5
    balances map: {"0000…0000":"249000000000000n"}
    utxo value=50000000000000 …
    utxo value=50000000000000 …
    utxo value=50000000000000 …
    utxo value=49000000000000 …
    utxo value=50000000000000 …
    pending: []

=== feePayer: balance=1000000000000 availableCoins=1
    utxo value=1000000000000 …
```

## Conclusion

The chain, the node and the indexer are all correct. The defect is confined to the **in-memory
state of the wallet instance that submitted the transaction**: it drops one unspent input and
credits only the change, landing 50000000000000 low (4 coins instead of 5), and it does not
self-correct — while `progress.isStrictlyComplete()` returns `true`, so nothing downstream can
tell that the view is incomplete.

`isStrictlyComplete()` therefore does NOT imply the balance view is correct on this lane.

## Consequence and fix

`fundWithNight` in `harness/src/night.ts` waited on `nightBalance(s) === beforeFrom - amount`.
That predicate is **unsatisfiable** on the submitting wallet's stream, so the wait could only ever
burn its whole budget. It was changed to the inequality `nightBalance(s) <= beforeFrom - amount`,
which preserves the guard's purpose (do not reuse the sender until it has observed its own spend)
and is in the safe direction — the live balance cannot fall to that level before the spend is
reflected. The receiver-side wait in the same function has always been an inequality.

This wait was introduced in 00003 commit `5496f8f` ("G3 GREEN"), i.e. AFTER 00003's G1 evidence was
captured, and 00003 never re-ran G1 afterwards (its G4 closeout reproduces G2 and G3 only) — which
is why the G1 path shipped with an unexercised, and as it turns out unsatisfiable, wait.

## Standing caution for later gates

Any assertion that reads a balance from **the wallet that just submitted the transaction** is
suspect on this lane. Prefer an independent observation point — a freshly opened wallet, or the
indexer — which is already the FR-108 two-observation-point discipline. G3's step-ledger
assertions should not take a submitting wallet's self-reported balance as authoritative.
