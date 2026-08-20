# Superseded S2 runs — retained so every cited number has a file behind it

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

The canonical S2 result is `../S2.md` + `../s2-segment-order.json`, from the G1 run that exited 0.
These files are earlier runs, kept for the same reason 00005 kept `evidence/g4-closeout/superseded/`:
they are cited in the analysis and in organizer issue 0001, and a citation whose evidence was deleted
is worthless.

**Why so many runs.** The correlation S2 measures is a ratio, and a ratio is exactly the kind of
result that host noise silently corrupts. Three of the five runs failed, each for a different and
instructive reason, and each failure produced a guard that is now part of the spike.

| File | What it is | Why superseded |
|---|---|---|
| `pilot-s2-dev-stack.log` | The PILOT on a hand-managed dev stack: 34 counting attempts over shapes A (12), B (12), D (10), with per-attempt segment ids and verbatim errors. | Predates the shared-host guards, and its shape C was still applied to the wrong pair. Its shape-B split (**6/6 ascending accepted, 6/6 descending refused with 104**) is the FIRST of four independent replications, which is why it is kept. |
| `run3-console-RED-shapeC-bug.log` | Gate run 3's console log — the run that went RED. | Shapes A, B and D measured cleanly under the load gate (0 VOIDs) and shape B again split perfectly (8/8 vs 4/4), but shape C tested `o.shape === 'dependent'`, false for `'dependent-fixed'`, so C silently ran the INDEPENDENT specs and exhausted the unshielded mint budget. **It measured the wrong thing under the right name** — and it had produced a "fix demonstrated" result that was therefore withdrawn. The per-step outputs were removed when the tree was cleaned for run 4; this console log is what remains. |
| `run4-S2.md`, `run4-s2-segment-order.json` | Gate run 4 — a **fully GREEN** run whose S2 measurements are all valid (0 VOIDs; shape B 3/3 vs 9/9). | Its S2 *report* drew a wrong inference: it labelled shape C's failure "FIX INCOMPLETE — segment order is A cause, not the only one", when in fact shape C failed with `235` (never `104`) **including on ascending draws that would have passed untouched** — i.e. the rewrite was invalid, not the hypothesis. It also pooled shape C, the intervention arm, into the "is descending order necessary?" figure. Both were fixed and the gate re-run; run 4's raw per-attempt data is kept because it is a genuine independent replication. |

Two runs are recorded in the plan as **VOID, not RED** — they produced no measurement, so they have
no data file here:

- **run 1** — shared-host starvation (1-min load **21.7 on 16 cores**) turned into
  `'prove' returned an error: AbortError: The user aborted a request.` A starved proof server is
  evidence about the host, not the ledger, and in a results table it is indistinguishable from a
  refusal. → produced the load gate, the per-attempt timeout, and the incremental evidence writes.
- **run 2** — the host **idle-slept mid-gate** (00005 G4 run 1's failure mode). → produced **W-2**
  (`caffeinate -is`, `scripts/lib/nosleep.sh`).

## Shape B across all four runs — the reason the verdict is CONFIRMED

| Run | ascending accepted | descending refused (all `104`) |
|---|---|---|
| pilot | 6/6 | 6/6 |
| run 3 | 8/8 | 4/4 |
| run 4 | 3/3 | 9/9 |
| run 5 (canonical) | 6/6 | 6/6 |
| **total** | **23/23** | **25/25** |

48 attempts, no counterexample in either direction.
