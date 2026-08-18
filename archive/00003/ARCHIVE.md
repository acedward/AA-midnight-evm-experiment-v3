# Archived 00003-contract-token-custody deliverables

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

This branch (`00004-multi-token-custody`) is based on `00003-contract-token-custody` @ `a8ebff9`
(PR #1, MERGED). Project 00004 reuses 00003's gate discipline and reproduces its own evidence at
the canonical paths `evidence/g1-lane/`, `evidence/g2-contracts/`, `evidence/g3-ledger/`,
`evidence/g4-closeout/`. To free those paths without destroying 00003's record, 00003's
deliverables were relocated here **unmodified** at the start of 00004 Plan 01:

| Original path (branch `00003-contract-token-custody`) | Path on this branch |
|---|---|
| `evidence/` | `archive/00003/evidence/` |
| `README.md` | `archive/00003/README.md` |
| `REPORT.md` | `archive/00003/REPORT.md` |
| `VERIFICATION.md` | `archive/00003/VERIFICATION.md` |
| `scripts/g5/` (addendum A1 gate) | `archive/00003/scripts-g5/` |
| `harness/src/g5/` (addendum A1 harness) | `archive/00003/harness-src-g5/` |

Relative links inside the archived documents point at the ORIGINAL 00003 layout and are therefore
stale on this branch. The authoritative, link-correct copy of project 00003 is the
`00003-contract-token-custody` branch at `a8ebff9`.

Retained in place (they are 00004's starting point, not archive):
`contracts/`, `docker/`, `scripts/lib/`, `scripts/g1..g4/`, `harness/` (minus `src/g5`).
