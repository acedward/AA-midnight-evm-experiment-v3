# LANE MANIFEST — `EXPERIMENTAL_LANE` / `LANE-DEV-1`

**Project:** 00006-unbalanced-zswap
**Slot:** Midnight v2.0.0-rc.4 experimental prerelease lane
**Recorded (UTC):** 2026-08-20T03:08:25Z
**Run mode:** full
**Host:** Darwin arm64, Docker 29.1.3, build f52814d, Compose 2.40.3-desktop.1
**Compose project (disposable, this run only):** `aa00006-g1-20260820030435-6040`

> **This project PINS NOTHING.** It inherits the lane pinned and verified by project 00003
> and re-proved by 00004 and 00005, and proves the inheritance mechanically — see
> `03-lane-reuse.out`. The authoritative pin rationale, including findings L-1..L-5 and the
> LANE-DEV-1 approval, is 00003's manifest, preserved verbatim at
> `archive/00003/evidence/g1-lane/LANE.md`.

> `EXPERIMENTAL_LANE`: the official compatibility matrix lists no supported coherent 2.x
> application bundle; rc4 is a published prerelease for fresh ledger-9 development networks
> only. **No result from this project may be extrapolated to a supported or production lane.**

## Inheritance proof — a THREE-HOP chain, walked rather than asserted

00006 is three projects removed from the act that pinned this lane, so checking only the
immediate base would pass even if an intermediate project had silently re-pinned something.
`scripts/lib/lane-pins.sh` therefore compares image digests, the compactc archive pin and
`harness/pnpm-lock.yaml` at EVERY hop:

| Hop | Commit | Role |
|---|---|---|
| 1 | `a8ebff9614b4d2a811d90b1956c6f1d969160dd6` | 00003 merged head — the ORIGINAL pinning act |
| 2 | `f066a09adc4bc2fd47dc045083530aab519f65c2` | 00004 head (PR #2, held OPEN) |
| 3 | `e9701e97bb229f555f66216014bec4a5ec6e95e7` | 00005 head (PR #3, held OPEN) — this branch's base |

| Check | Evidence |
|---|---|
| Pins identical at EVERY hop of the chain | `03-lane-reuse.out` (section 0) |
| Pin values in `docker/compose.yml` unchanged since base | `03-lane-reuse.out` (section 1) |
| Compactc archive URL + SHA-256 unchanged since base | `03-lane-reuse.out` (section 1) |
| `harness/pnpm-lock.yaml` byte-identical to base | `03-lane-reuse.out` (section 2) |
| `harness/package.json` dependency versions unchanged | `03-lane-reuse.out` (section 2) |
| Images compose resolves == pinned digests | `03-lane-reuse.out` (section 3) |

## Container images — pinned by digest

| Role | Index digest (as referenced by compose) | linux/arm64 image digest |
|---|---|---|
| Node `2.0.0-rc.4` | `sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e` | `sha256:d1e5fc231147e9af739a1128ae0941119fd59dca7356a2333567bad7b57d7424` |
| Indexer `4.4.0-rc.1-arm64` | `sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a` | `sha256:628002a181edfc7d67d43944e84a35d920a0077c89cab6301169079b30c79316` |
| Proof server `9.0.0-rc.3` | `sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f` | `sha256:8a4b29d737c1da754df0443e4a552a7934b47e17e99cd893a70120e4ce21fcaf` |

### Images that actually ran in this run

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
**Every piece of 00006 evidence carries `LANE-DEV-1` in addition to `EXPERIMENTAL_LANE`.**

Re-proven in THIS run (see `04-lane-dev-1.out`) rather than inherited on paper:

- [x] Installed `compactc` reports compiler version `0.33.0`.
- [x] Installed `compactc` reports language version `0.25.0`.
- [x] Artifacts compiled by it are accepted on-chain by the pinned `ledger-9.1.0.0-rc.3`
      node — re-proven by this run's Manager and Minter deployments inside the spikes.
- [x] Binary pinned by SHA-256 in `docker/compactc.Dockerfile`.

## `W-1` — inherited HOST workaround (not a lane change)

This host's `docker-credential-desktop` can hang, wedging every `docker pull` (00004 G4 run 1
lost 63 minutes to it). Every 00006 gate therefore runs with `DOCKER_CONFIG` pointed at a
scratch directory holding `{}` plus a symlink to the user's real `cli-plugins` — see
`01-w1-docker-config.out` and `scripts/lib/docker-w1.sh`.

- It is an ENVIRONMENT VARIABLE for the gate's own child processes. `~/.docker/config.json`,
  Docker Desktop's settings and every other project on this shared host are untouched.
- No pin, wrapper step, contract or piece of evidence was changed to accommodate it; the
  `pull` step is still run and still asserted.
- Pulls run anonymously. The images are public and **pinned by digest**, and the digest is the
  identity, so the pin proof is unaffected.

## `W-2` — HOST workaround adopted by 00006 (not a lane change)

W-2 ACTIVE: this run executed under 'caffeinate -is' (idle+system sleep held off for the gate's process tree only)

This Mac idle-slept mid-gate during 00006's G1 run 2, and 00005's G4 run 1 recorded the same
failure mode. A 40-minute gate is almost entirely waiting — proving, block production, indexer
catch-up — so it looks idle and the sleep timer fires. What comes back is not a clean failure:
sockets drop mid-request and the SDK reports whatever it was doing, e.g.
`'prove' returned an error: AbortError: The user aborted a request.`, which is indistinguishable
from a real refusal in an evidence table. Every 00006 gate wrapper therefore re-execs itself
under `caffeinate -is` — see `scripts/lib/nosleep.sh`.

- It is a PROCESS WRAPPER around the gate's own process tree. No system setting is written, no
  `pmset` value is changed, and the assertion disappears when the gate exits, so every other
  tenant of this shared host is unaffected.
- It changes WHEN the machine sleeps, not WHAT is executed or asserted. No pin, step, contract
  or piece of evidence was altered to accommodate it.
- Like W-1 it is a HOST workaround, **not** a lane property, and nothing about it may be read as
  a statement about node, ledger, indexer or SDK behaviour.

## Compile probes

None. 00006 introduces no new Compact shape in Plan 01: the spikes run 00005's Manager v3 and
Minter UNCHANGED, because `depositShielded`'s `receiveShielded` deficit already has the shape
of the swap offer's −B leg. New circuits arrive in Plan 02 with their own gate.
