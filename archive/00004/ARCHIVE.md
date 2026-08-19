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

Relocated later, at the start of 00005 **Plan 03**, for the same reason — they answer a question
00004 already closed and 00005 does not re-ask:

| Original path | Path on this branch |
|---|---|
| `harness/src/g3/ledger-compose.ts` (00003's R8 one-ledger-Intent composer) | `archive/00004/harness-src-g3-ledger-compose.ts` |
| `harness/src/g3/probe-mixed.ts` (00004 M1 diagnostic, round 1) | `archive/00004/harness-src-g3-probe-mixed.ts` |
| `harness/src/g3/probe-merge.ts` (00004 M1 diagnostic, round 2) | `archive/00004/harness-src-g3-probe-merge.ts` |
| `scripts/g3/probe-mixed.sh` (the disposable-stack runner for both) | `archive/00004/scripts-g3-probe-mixed.sh` |

00004's probe M1 RESOLVED decision D-102 from evidence: a same-address two-call ledger Intent is
refused (the 223 rule), while `withContractScopedTransaction` — one transaction, one segment per
call, state threaded — is accepted. 00005's decision D-203 inherits that answer, so 00005's probe M3
uses the proven scoped-batch shape directly and does not re-run the refused one; the one-Intent
composer and its two diagnostics therefore have no caller in 00005. The verbatim 00004 refusal is
preserved in `archive/00004/evidence/g3-ledger/run-context.json`.

The compile probes are archived rather than retained because 00005 Plan 01 states that **no compile
probes are needed**: every Compact shape 00005 uses (colour-keyed maps, constructor arguments, the SDK
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
