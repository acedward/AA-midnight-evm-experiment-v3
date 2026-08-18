# LANE MANIFEST — `EXPERIMENTAL_LANE` / `LANE-DEV-1`

**Project:** 00004-multi-token-custody
**Slot:** Midnight v2.0.0-rc.4 experimental prerelease lane
**Recorded (UTC):** 2026-08-18T20:24:50Z
**Host:** Darwin arm64, Docker 29.1.3, build f52814d, Compose 2.40.3-desktop.1
**Compose project (disposable, this run only):** `aa00004-g1-20260818201730-16867`

> **This project PINS NOTHING.** It reuses the lane pinned and verified by project 00003
> and proves the reuse mechanically — see `02-lane-reuse.out`. The authoritative pin
> rationale, including findings L-1..L-5 and the LANE-DEV-1 approval, is 00003's manifest,
> preserved verbatim at `archive/00003/evidence/g1-lane/LANE.md`.

> `EXPERIMENTAL_LANE`: the official compatibility matrix lists no supported coherent 2.x
> application bundle; rc4 is a published prerelease for fresh ledger-9 development networks
> only. **No result from this project may be extrapolated to a supported or production lane.**

## Reuse proof

Base commit: `a8ebff9614b4d2a811d90b1956c6f1d969160dd6` (00003 merged head, PR #1 — owner decision Q4).

| Check | Evidence |
|---|---|
| Pin values in `docker/compose.yml` unchanged since base | `02-lane-reuse.out` |
| Compactc archive URL + SHA-256 unchanged since base | `02-lane-reuse.out` |
| `harness/pnpm-lock.yaml` byte-identical to base | `02-lane-reuse.out` |
| `harness/package.json` dependency versions unchanged | `02-lane-reuse.out` |
| Images compose resolves == pinned digests | `02-lane-reuse.out` |

## Container images — pinned by digest

| Role | Index digest (as referenced by compose) | linux/arm64 image digest |
|---|---|---|
| Node `2.0.0-rc.4` | `sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e` | `sha256:d1e5fc231147e9af739a1128ae0941119fd59dca7356a2333567bad7b57d7424` |
| Indexer `4.4.0-rc.1-arm64` | `sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a` | `sha256:628002a181edfc7d67d43944e84a35d920a0077c89cab6301169079b30c79316` |
| Proof server `9.0.0-rc.3` | `sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f` | `sha256:8a4b29d737c1da754df0443e4a552a7934b47e17e99cd893a70120e4ce21fcaf` |

### Images that actually ran in this G1 run

```
node          sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e
indexer       sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a
proof-server  sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f
```

## Components

    midnight-node            node-2.0.0-rc.4
    midnight-ledger          ledger-9.1.0.0-rc.3
    midnight-indexer         v4.4.0-rc.1 (arm64 tag 4.4.0-rc.1-arm64, finding L-1)
    proof-server             9.0.0-rc.3 (finding L-2)
    midnight-js              v5.0.0-beta.6
    wallet-sdk               2.0.0-beta.2
    compactc                 0.33.0 / language 0.25.0 (LANE-DEV-1)

## `LANE-DEV-1` — inherited lane deviation (owner-approved 2026-08-17)

The lane pins `compactc-v0.33.0-rc.2`, which has no published binary (00003 finding L-4).
The released `compactc-v0.33.0` is used instead, pinned by SHA-256
`3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46` in `docker/compactc.Dockerfile`.
**Every piece of 00004 evidence carries `LANE-DEV-1` in addition to `EXPERIMENTAL_LANE`.**

Verification status of the deviation's own checklist (00003 left the first two UNTICKED;
this G1 run closes them — see `03-lane-dev-1.out`):

- [x] Installed `compactc` reports compiler version `0.33.0`.
- [x] Installed `compactc` reports language version `0.25.0`.
- [x] Artifacts compiled by it are accepted on-chain by the pinned `ledger-9.1.0.0-rc.3` node
      — re-proven in THIS run by the probe P2 deployments (`11-probe-p2.out`,
      `probes/p2-deploy.json`), not merely inherited from 00003.
- [x] Binary pinned by SHA-256 in `docker/compactc.Dockerfile`.

## Compile probes P1 / P2

See `probes/VERDICTS.md` for the verdict table, `probes/*.out` for verbatim compiler
output, and `probes/p2-deploy.json` for the P2 deploy half. Decision D-101 is recorded in
the master plan.
