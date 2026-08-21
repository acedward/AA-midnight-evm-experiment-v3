# G3 run 1 — SUPERSEDED (RED), retained on purpose

`EXPERIMENTAL_LANE / LANE-DEV-1`

This is the first full G3 run. `final_exit: 1`, and the cause was **one bug in the harness's own
comparison helper, not anything the lane did**: stage A's P-F310 row deploys a third issuer mid-row,
so its `before` snapshot watched two colours and its `after` snapshot watched three, and the
no-state-created fingerprint read the added `absent` entries as a difference. The map sizes were
byte-identical on both sides (2/2/0) — the check that would catch a real creation — so nothing was
created; the comparison was scoped wrongly. Fixed by intersecting the observed key sets, with
`mapSizes` and the account set still compared in full.

**Everything else in run 1 passed**, including the headline settlement (row 5, 20/20), the whole of
stage B, and the whole of stage C. The canonical run is the one in the parent directory.

Retained because run 1 is where three things were first measured, and a re-run should not be the only
place they exist:

- node code **1** on the direct submission of the AS-PUBLISHED offer = deserialization (finding F-311);
- row 12b: an internal transfer leaves the pooled coin byte-identical and still kills the offer, with
  **104** rather than the withdraw's **239** — two cancellation mechanisms, not one;
- the P-F310 boundary, at 2 pools/2 cells in stage A and at 1 pool/2 cells in stage C.

The per-process IO logs were dropped from this directory; the canonical run's `io/` has the same
shapes. No conclusion in any report rests on run 1 alone.
