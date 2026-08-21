# Archived 00005-open-colour-custody deliverables

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

This branch (`00006-unbalanced-zswap`) is based on `00005-open-colour-custody` @ `e9701e9`
(PR **#3**, deliberately held **OPEN** — owner decision Q4→A 2026-08-19: 00006 stacks on it, so
nothing is merged first; PR **#2** for 00004 also stays OPEN). Project 00006 reuses 00005's gate
discipline and reproduces its own evidence at the canonical paths `evidence/g1-lane/`,
`evidence/g2-contracts/`, `evidence/g3-ledger/`, `evidence/g4-closeout/`. To free those paths
without destroying 00005's record, 00005's deliverables were relocated here **unmodified** at the
start of 00006 Plan 01:

| Original path (branch `00005-open-colour-custody`) | Path on this branch |
|---|---|
| `evidence/` | `archive/00005/evidence/` |
| `README.md` | `archive/00005/README.md` |
| `REPORT.md` | `archive/00005/REPORT.md` |
| `VERIFICATION.md` | `archive/00005/VERIFICATION.md` |

`archive/00003/` and `archive/00004/` (relocated by 00004 and 00005 for the same reason) are
carried forward untouched.

Relative links inside the archived documents point at the ORIGINAL 00005 layout and are therefore
stale on this branch. The authoritative, link-correct copy of project 00005 is the
`00005-open-colour-custody` branch at `e9701e9`.

## What is deliberately NOT archived yet

00005's convention is to relocate a file at the moment it stops having a caller, not in advance —
`archive/00004/ARCHIVE.md` records two relocation waves for exactly that reason (Plan 01 and
Plan 03). 00006 follows it:

| Retained in place at Plan 01 | Why |
|---|---|
| `contracts/manager.compact` (Manager v3) | 00006's starting point — Plan 02 reworks it into Manager v4 (v3 + swap circuits) |
| `contracts/minter.compact` | reused UNCHANGED as the TOKA/TOKB issuer |
| `contracts/minter-collide.compact` | still compiled by `scripts/g2/compile.sh` and still imported by `harness/src/{contracts,test/sim}.ts`, `harness/src/g3/{setup,actions,probes}.ts`. Archiving it at Plan 01 would mean EDITING those files, which this task forbids ("nothing modified"). Plan 02/03 decide whether 00006 keeps the P-COLL fixture |
| `harness/src/g3/probes.ts`, `harness/src/test/step-ledger.test.ts` | same reason: both still have callers (`harness/src/g3/ledger-run.ts` and the unit suite) |
| `harness/src/g4/report.ts`, `scripts/g4/compare-runs.py` | Plan 04's business |
| `docker/`, `scripts/lib/`, `scripts/g1..g4/`, the rest of `harness/` | 00006's working infrastructure |

## Lane inheritance

The lane is **not re-pinned** by this project. `scripts/lib/lane-pins.sh` on this branch walks the
full inheritance chain 00003 `a8ebff9` → 00004 `f066a09` → 00005 `e9701e9` → here and asserts the
pins byte-identical at every hop; see `evidence/g1-lane/LANE.md` and `evidence/g1-lane/03-lane-reuse.out`.
