# S4b — NOT RUN

Recorded (UTC): 2026-08-20T09:30:57Z

S4 (floating surplus) was **GREEN**, and FR-308 makes openness GREEN if EITHER open shape
settles for a holder whose keys the maker never knew. Plan 02 Phase 3 therefore schedules the
bearer-key fallback to run ONLY if S4 is refuted, and it was not.

This is a scheduling decision, not a result: nothing here says the bearer shape would fail.
It remains implemented (`harness/src/g2/spike-s4b.ts`, `shape: 'bearer-key'` in the offer
builder) and can be run on demand.
