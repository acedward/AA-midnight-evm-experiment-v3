# Archived 00004-multi-token-custody deliverables

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

This branch (`00005-open-colour-custody`) is based on `00004-multi-token-custody` @ `f066a09`
(PR **#2**, deliberately held **OPEN** — owner decision 2026-08-19: 00005 stacks on it and its PR
bases on the 00004 branch, so nothing is merged first). Project 00005 reuses 00004's gate
discipline and reproduces its own evidence at the canonical paths `evidence/g1-lane/`,
`evidence/g2-contracts/`, `evidence/g3-ledger/`, `evidence/g4-closeout/`. To free those paths
without destroying 00004's record, 00004's deliverables were relocated here **unmodified** at the
start of 00005 Plan 01:

| Original path (branch `00004-multi-token-custody`) | Path on this branch |
|---|---|
| `evidence/` | `archive/00004/evidence/` |
| `README.md` | `archive/00004/README.md` |
| `REPORT.md` | `archive/00004/REPORT.md` |
| `VERIFICATION.md` | `archive/00004/VERIFICATION.md` |
| `contracts/probes/` (00004 Plan 01 compile probes P1a/P1b/P1c/P2) | `archive/00004/contracts-probes/` |
| `scripts/g1/probe-compile.sh` | `archive/00004/scripts-g1-probe-compile.sh` |
| `harness/src/g1/probe-p2.ts` | `archive/00004/harness-src-g1-probe-p2.ts` |
| `harness/src/test/step-ledger.test.ts` (00004's 14-row offline dry run) | `archive/00004/harness-src-test-step-ledger.test.ts` |

The probes are archived rather than retained because 00005 Plan 01 states that **no compile probes
are needed**: every Compact shape 00005 uses (colour-keyed maps, constructor arguments, the SDK
scoped batch) was already proven by 00004. The 00004 step-ledger dry run is archived because 00005's
step ledger is a different, 18-row, dynamic-colour-set ledger written in Plan 03; the archived file
is its reference, not its base.

`archive/00003/` (relocated by 00004 for the same reason) is carried forward untouched.

Relative links inside the archived documents point at the ORIGINAL 00004 layout and are therefore
stale on this branch. The authoritative, link-correct copy of project 00004 is the
`00004-multi-token-custody` branch at `f066a09`.

Retained in place (they are 00005's starting point, not archive): `contracts/manager.compact`
(reworked into Manager v3 by Plan 02) and `contracts/minter.compact` (**reused UNCHANGED**),
`docker/`, `scripts/lib/`, `scripts/g1..g4/`, `harness/` (minus the files listed above).
