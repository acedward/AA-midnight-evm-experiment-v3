# G4 `--offline` preflight — retained, because it is a real run

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

This is the `scripts/g4/verify-g4-closeout.sh --offline` run that preceded the full reproduction:
the clean clone, the specification's byte-identity check, the **non-vacuous freshness self-test**
(`compare-swap-runs.py` exit **2** — every substantive comparison passing and freshness the sole
objection), the REPORT.md render and the closeout-document checks. `final_exit: 0`, including
teardown, clone removal and the docker-residue proof.

It is kept because the full run overwrites this directory's files, and a preflight that established
the guard is not vacuous is evidence in its own right — not scaffolding. What it did NOT do is run
the three reproduced gates; that is the full run, whose record is one directory up.
