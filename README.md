# 00004-multi-token-custody — four colours, one Manager

`EXPERIMENTAL_LANE` — Midnight 2.x rc4 prerelease lane, deviation `LANE-DEV-1`.
**Nothing in this repository extrapolates to a supported or production lane.**

One Manager contract custodying FOUR contract-minted colours (2 shielded + 2 unshielded, from two
deployments of one constructor-parameterized Minter) with continuous per-colour isolation,
owner-only spend, wrong-colour rejection, and mixed-colour one-transaction atomicity.

Extends project 00003 (`00003-contract-token-custody` @ `a8ebff9`, PR #1 MERGED). 00003's
deliverables are preserved under `archive/00003/` — see `archive/00003/ARCHIVE.md`.

> **Status: in progress.** This README is a placeholder; the full README, `REPORT.md`, and
> `VERIFICATION.md` are produced at closeout (Plan 04).

## Layout

| Path | What |
|---|---|
| `contracts/` | Compact sources (`minter.compact`, `manager.compact`) and `contracts/probes/` |
| `docker/` | Pinned rc4 stack (`compose.yml`) and the pinned compiler image (`compactc.Dockerfile`) |
| `harness/` | TypeScript harness (wallets, deploy, step ledger) |
| `scripts/gN/` | Gate wrappers — each owns a disposable, uniquely named compose stack |
| `evidence/` | Gate evidence for THIS project |
| `archive/00003/` | Project 00003's evidence and reports, relocated unmodified |

## Gates

| Gate | Wrapper | Meaning |
|---|---|---|
| G1 | `scripts/g1/verify-g1-lane.sh` | Lane verified as reused (not re-pinned); probes P1/P2 answered |
| G2 | `scripts/g2/verify-g2-contracts.sh` | Contracts compile + deploy; colours distinct; configure done |
| G3 | `scripts/g3/verify-g3-ledger.sh` | 14-row step ledger + negative controls + atomicity probes |
| G4 | `scripts/g4/verify-g4-closeout.sh` | Clean-clone one-command reproduction |

Every wrapper probes free host ports above 10000, binds them to `127.0.0.1` only, uses a unique
compose project name, and is green **only on exit 0 including teardown**.
