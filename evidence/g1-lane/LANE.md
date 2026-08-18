# LANE MANIFEST — `EXPERIMENTAL_LANE`

**Project:** 00003-contract-token-custody
**Slot:** Midnight v2.0.0-rc.4 experimental prerelease lane
**Recorded (UTC):** 2026-08-17T22:54Z–23:0xZ
**Host:** Darwin arm64 (aarch64), Docker Desktop 29.1.3, Compose v2.40.3-desktop.1

> **`EXPERIMENTAL_LANE`.** Per project 00002 G1 evidence (2026-08-14), the official compatibility
> matrix lists **no supported coherent 2.x application bundle**; the rc4 node release is a
> published prerelease for fresh ledger-9 development networks only. The owner directed the 2.x
> lane anyway. **No result from this project may be extrapolated to a supported or production
> lane.**

## Source-level coherence (read-only reference checkouts)

Every reference checkout under `/Users/edwardalvarado/midnight-ref-ai/v2.0.0-rc.4` sits exactly on
its pinned tag — verified with `git describe --tags`:

| Component | Tag (verified) |
|---|---|
| compact (compiler) | `compactc-v0.33.0-rc.2` |
| midnight-indexer | `v4.4.0-rc.1` |
| midnight-js | `v5.0.0-beta.6` |
| midnight-ledger | `ledger-9.1.0.0-rc.3` |
| midnight-node | `node-2.0.0-rc.4` |
| midnight-wallet | `@midnightntwrk/wallet-sdk-address-format@4.0.0-beta.2` (monorepo; `@midnightntwrk/wallet-sdk` = `2.0.0-beta.2`) |
| compact-contracts | `v0.3.0-alpha.1` (*different slot — not used*) |

Cross-check: the pinned compiler source (`compact/flake.nix` at `compactc-v0.33.0-rc.2`) pins
`midnight-ledger/ledger-9.1.0.0-rc.3` — **exactly this lane's ledger**. The pinned compiler
declares internal `compiler 0.33.0`, `language 0.25.0`
(`compiler/compiler-version.ss`, `compiler/language-version.ss`).

## Container images — pinned by digest

Resolved from the registry HTTP API on 2026-08-17 (not from a local cache).

| Role | Reference | Index digest | linux/arm64 image digest |
|---|---|---|---|
| Node | `midnightntwrk/midnight-node:2.0.0-rc.4` | `sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e` | `sha256:d1e5fc231147e9af739a1128ae0941119fd59dca7356a2333567bad7b57d7424` |
| Indexer (standalone) | `midnightntwrk/indexer-standalone:4.4.0-rc.1-arm64` | `sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a` | `sha256:628002a181edfc7d67d43944e84a35d920a0077c89cab6301169079b30c79316` |
| Proof server | `midnightntwrk/proof-server:9.0.0-rc.3` | `sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f` | `sha256:8a4b29d737c1da754df0443e4a552a7934b47e17e99cd893a70120e4ce21fcaf` |

Also recorded (not used): node `linux/amd64` =
`sha256:2a36b581a5c6500d7d7a6d8b9ff1b406fb31bc851707e5494eff33cd7b9be368`; proof-server
`linux/amd64` = `sha256:012ce876290f1940736974bc30edb1090c1cb25c8f2fa2d08f599e117cc95429`;
indexer-standalone `4.4.0-rc.1` multi-arch index =
`sha256:5d79f3a20da9ed86236c7f7dc9d93b1beeb0b0c47c9c43a791041322eb80b74e` (**amd64-only**).

### Finding L-1 — indexer arm64 is published under an arch-suffixed tag (resolved, not a deviation)

The `4.4.0-rc.1` multi-arch index contains **linux/amd64 only**. The same version is published for
arm64 as the separate tag `4.4.0-rc.1-arm64`. This project pins `4.4.0-rc.1-arm64` to run natively
on the aarch64 host. **This is the same component version `4.4.0-rc.1`, not a slot mix** — only
the architecture-specific tag of the identical release. Both digests are recorded above.

### Finding L-2 — proof server tag selection (resolves Plan 01 Question 1)

Plan 01 asked which proof-server tag is rc4-coherent for `ledger-9.1.0.0-rc.3`. Answer:
**`9.0.0-rc.3`** — the tag used by the pinned wallet SDK's own `undeployed` local stack
(`midnight-wallet/infra/compose/docker-compose-dynamic.yml` and
`packages/prover-client/src/effect/test/httpProverClient.integration.test.ts`, both at the pinned
wallet tag). Its major `9` matches ledger `9.1.0.0-rc.3`. Published for arm64 and amd64.
*Not used:* `midnightntwrk/proof-server:8.0.3` referenced by `compact-contracts` — that checkout is
a different slot (`v0.3.0-alpha.1`).

### Finding L-3 — the pinned wallet SDK's own stack targets rc.3, not rc.4 (recorded risk)

`midnight-wallet/infra/compose/docker-compose-dynamic.yml`, at the pinned wallet-SDK tag, runs
node `2.0.0-rc.3` and indexer `4.4.0-pre-alpha.14-…-ca3e554` — **not** node `2.0.0-rc.4` and
**not** indexer `v4.4.0-rc.1`. That is the combination the pinned wallet SDK was actually exercised
against upstream. This project follows the **spec-mandated** pins (node `2.0.0-rc.4`, indexer
`4.4.0-rc.1`) and records this as a standing incoherence risk: any wallet-SDK/node/indexer
incompatibility observed later is a **named reproducible RED** for the affected cells, never a
license to fall back to rc.3.

## npm packages — pinned by integrity hash

Verified published on the public npm registry at the exact pinned versions:

| Package | Version | Integrity |
|---|---|---|
| `@midnight-ntwrk/midnight-js-contracts` | 5.0.0-beta.6 | `sha512-z8feJLi/vDhPluYMH/0lrVQ003zMyT4PLB20/aCXVSLQy5sxvNCOiahKIU4+dasUM9vXtlVinDGYB6uFHVKbwg==` |
| `@midnight-ntwrk/midnight-js-types` | 5.0.0-beta.6 | `sha512-ea8SVd8etHO2fhwNwRre2TN0lKiwUnWoPQudTjWJMZlF19U4jHW7nRWCMPO7qYgKDAsVec7o16PUY3TR7twijA==` |
| `@midnightntwrk/wallet-sdk` | 2.0.0-beta.2 | `sha512-XL0ZG7NuswssFnsJYlJzf7AcBizBF14Da67KhRegLFLuDb0OYj3ZQNNR/c3q+2KXoJ7TJ5s75hhPMsWfBZWakg==` |
| `@midnightntwrk/wallet-sdk-testkit` | 0.3.0-beta.2 | `sha512-3QHV39IZp/jIiwkf0ELHPUQKntnm0Rbdz6+S8WcjLEnCH/iEKsXOtkFCEcvk+xe6duBehYyqe82BWaZPy4rzyA==` |

The complete transitive set with integrity hashes is pinned by the harness lockfile
(`harness/pnpm-lock.yaml`) once G3 scaffolding lands.

## Finding L-4 — **OPEN / BLOCKING for G2**: pinned compiler has no published binary

**The pinned compiler `compactc-v0.33.0-rc.2` is not obtainable as a binary.**

Evidence:

1. `GET /repos/midnightntwrk/compact/releases/tags/compactc-v0.33.0-rc.2` → **404**.
2. The full release list contains **no `-rc` prerelease at all**; it goes
   `compactc-v0.31.1` → `compactc-v0.33.0`.
3. The `compact` CLI (the official toolchain manager, workspace version `0.5.1`) fetches compiler
   toolchains **exclusively from GitHub releases of `midnightntwrk/compact`**
   (`tools/compact/src/fetch.rs` uses octocrab `.releases()`; `compiler_legacy.rs` uses each
   asset's `browser_download_url`). With no release for the rc.2 tag, `compact` cannot install it.
4. Building from the pinned source is a **Chez Scheme** build (`compiler/*.ss`,
   `compiler/compactc.ss`); the repo's Rust workspace is only the CLI version manager.

What *is* published: `compactc-v0.33.0` (final), with assets
`compactc_v0.33.0_aarch64-unknown-linux-musl.zip` (31,550,294 B),
`compactc_v0.33.0_aarch64-darwin.zip`, and the two x86_64 builds.

Relevant nuance: the **pinned rc.2 source declares its own compiler version as exactly `0.33.0`**
(language `0.25.0`) — the `-rc.2` suffix is a repo release-candidate tag for that same compiler
version, not a distinct compiler version string. However, the public repo tree at the
`compactc-v0.33.0` release commit (`5e4946cc`) **no longer contains `compiler/` or `flake.nix`**,
so the final release's ledger target **cannot be verified from public source** — it cannot be
confirmed from outside that `0.33.0` final still pins `ledger-9.1.0.0-rc.3` the way rc.2 does.

### `LANE-DEV-1` — owner-approved lane deviation (2026-08-17)

**Decision (owner, option A):** use the published **`compactc-v0.33.0`** and verify empirically.

This is a **recorded deviation from the literal lane pin** `compactc-v0.33.0-rc.2`, approved by
the owner after the impossibility above was demonstrated. It is *not* a silent substitution and
*not* a slot mix: the pinned rc.2 source declares its own compiler version as exactly `0.33.0`,
so this is the released form of the same compiler version line.

Mandatory verification before any G2 cell counts as green — if any check fails this becomes a
**named RED**, not a workaround:

- [ ] Installed `compactc` reports compiler version `0.33.0`.
- [ ] Installed `compactc` reports language version `0.25.0`.
- [ ] Artifacts compiled by it are accepted on-chain by the pinned `ledger-9.1.0.0-rc.3` node
      (deploy + a real circuit call succeed).
- [ ] Binary pinned by SHA-256 of the downloaded release asset, recorded here.

**Every piece of G2 and G3 evidence carries the `LANE-DEV-1` label in addition to
`EXPERIMENTAL_LANE`,** and the final report states this deviation explicitly.
