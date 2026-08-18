# VERIFICATION — 00003-contract-token-custody

**Label:** `EXPERIMENTAL_LANE` (v2.0.0-rc.4 prerelease slot; no supported-lane or production validity)

This ledger is appended after each command, never reconstructed. Timestamps are UTC.

Governance pinned at execution start:

| Item | Value |
|---|---|
| Approved spec SHA-256 | `b707fc438721ebb750d301dc18c170229643c47d82ca551d739d7e4aac7c86d9` |
| Spec approval commit | `4a79ea5` (organizer) |
| P0 plan review | `WAIVED-BY-OWNER` 2026-08-17 |
| Organizer branch (docs) | `claude/contract-token-custody-6d6cd3` @ `721ecf6` |
| Product clone branch | `00003-contract-token-custody` |

## Path note (recorded deviation)

The organizer documents were present only on branch `claude/ccc-oz-private-key-witness-82f919`;
they were fast-forwarded into the execution worktree branch
`claude/contract-token-custody-6d6cd3` (commits `4a79ea5`..`721ecf6`, purely additive, verified by
`git diff --stat`). Organizer document edits therefore land in the worktree at
`/Users/edwardalvarado/todo/AA/.claude/worktrees/contract-token-custody-6d6cd3/AA/`.
The product clone stays at the canonical plan path below, which is gitignored by the organizer
repo (`*/experiments/*`) and so belongs to no branch.

| What | Absolute path |
|---|---|
| Product clone (this repo) | `/Users/edwardalvarado/todo/AA/experiments/00003-contract-token-custody` |
| Organizer docs (worktree) | `/Users/edwardalvarado/todo/AA/.claude/worktrees/contract-token-custody-6d6cd3/AA` |
| References (read-only) | `/Users/edwardalvarado/midnight-ref-ai/v2.0.0-rc.4` |

---

## G1 — Lane infrastructure

### Phase 1 — Product clone and scaffolding

| UTC | Command | cwd | Exit | Result |
|---|---|---|---|---|
| 2026-08-17T22:54:02Z | `mkdir -p …/{evidence/g1-lane,scripts/g1,contracts,harness}` + `git init -b 00003-contract-token-custody` | `AA/experiments/00003-contract-token-custody` | 0 | Clone created on branch `00003-contract-token-custody` |
| 2026-08-17T22:54:02Z | `node --version; pnpm --version; docker --version; docker compose version; docker info` | worktree | 0 | Host toolchain recorded (table below) |

Host toolchain observed (nothing installed globally by this project):

| Tool | Version |
|---|---|
| Node | v24.9.0 |
| pnpm | 11.5.1 |
| npm | 11.6.0 |
| Docker CLI | 29.1.3 (build f52814d) |
| Docker Compose | v2.40.3-desktop.1 |
| Docker server | 29.1.3, Docker Desktop |
| git | 2.50.1 (Apple Git-155) |
| Platform | Darwin arm64 (**aarch64** — image-architecture relevant) |

### Phase 2 — Pin the rc4 bundle

| UTC | Command | Exit | Result |
|---|---|---|---|
| 2026-08-17T23:0xZ | `git -C <each ref checkout> describe --tags` | 0 | All 7 reference checkouts on their exact pinned tags |
| 2026-08-17T23:1xZ | registry API digest resolution (node / indexer / proof-server) | 0 | Digests recorded in `evidence/g1-lane/LANE.md` |
| 2026-08-17T23:2xZ | npm registry version+integrity probe (4 packages) | 0 | All pinned versions published; integrity hashes recorded |
| 2026-08-17T23:3xZ | GitHub releases probe for `compactc-v0.33.0-rc.2` | 404 | **Finding L-4** — no published binary for the pinned compiler |

Findings **L-1** (indexer arm64 arch-suffixed tag), **L-2** (proof server `9.0.0-rc.3` — resolves
Plan 01 Q1), **L-3** (pinned wallet SDK's own compose targets node rc.3 + pre-alpha indexer),
**L-4** (pinned compiler unobtainable → owner-approved deviation `LANE-DEV-1`) are recorded in
`evidence/g1-lane/LANE.md`.

### Phase 3 — Fresh isolated stack

| UTC | Command | Exit | Result |
|---|---|---|---|
| 2026-08-17T23:5xZ | `scripts/g1/probe-ports.sh` | 0 | Free ports verified & selected: node `25098`, indexer `11895`, proof `14620`; project `aa00003-token-custody`; probe retained in `evidence/g1-lane/port-probe.txt` |
| 2026-08-17T23:5xZ | `docker compose pull` (by digest) | 0 | All three pinned digests present locally, matching LANE.md exactly |
| 2026-08-17T23:56Z | `docker compose up -d` (first attempt) | 1 | **RED (environmental)**: node exited `StorageOutOfSpace(0, 512)` — Docker VM disk 117 GB / **0 bytes free**; host `/System/Volumes/Data` at 100% (2.8 GB free) |
| 2026-08-18T00:0xZ | `docker builder prune -f` (owner-approved; build cache only, 0 active entries) | 0 | Reclaimed **9.079 GB**; VM disk → 8.2 GB free. No container, volume, or image of any other project touched |
| 2026-08-18T00:0xZ | `docker compose up -d` (retry) | 0 | node healthy; indexer + proof-server serving |
| 2026-08-18T00:03Z | host-side health capture | 0 | `evidence/g1-lane/stack-health.txt` |

**Observed runtime lane (two independent observation points — node RPC and indexer GraphQL):**

| Check | Observed |
|---|---|
| Node `system_chain` | `undeployed1` (fresh local `undeployed` network, as the spec requires) |
| Node `system_version` | `2.0.0-d9729c13` |
| Node `system_name` | `Midnight Node` |
| Indexer `/ready` | HTTP `200` |
| Indexer GraphQL `block` | height advancing (39 → 46), `protocolVersion 2000000` |
| Indexer log (ledger/node) | `ledger_version: V9`, `node_version: V2_0`, `caught_up: true` |
| Proof server `/version` | `9.0.0-rc.3` |
| Running image digests | byte-identical to the three pinned digests in LANE.md |

#### Finding L-5 — upstream healthchecks are impossible on these images (not a service fault)

The proof-server and indexer images are **distroless**: no `sh`, no `curl`
(`exec: "sh": executable file not found in $PATH`). The upstream healthchecks
(`CMD curl -f …/version`, `CMD-SHELL curl -fs …/ready`) therefore can never pass, and Compose
reports both containers permanently `unhealthy` while they serve traffic normally. Health is
asserted **from the host over the published ports** instead; the container healthchecks were
removed from `docker/compose.yml` with this rationale recorded inline.

### Phase 4 — Wallets and fees (in progress)

| UTC | Command | Exit | Result |
|---|---|---|---|
| 2026-08-18T00:0xZ | `pnpm install` (harness, exact pinned versions) | 0 | All 12 pinned SDK packages resolved; `harness/pnpm-lock.yaml` carries the transitive integrity set |
| 2026-08-18T00:07Z | `npx tsx src/g1/wallets.ts genesis` | 0 | **Genesis wallet syncs strictly complete** (`applied=9 highest=9`) holding `250000000000000n` unshielded NIGHT |
| 2026-08-18T00:09Z | `npx tsx src/g1/wallets.ts` (all parties) | 0 | All six parties open and reach `strictlyComplete=true`; evidence `evidence/g1-lane/wallets.txt` |

Parties created (seeds are deterministic and recorded in `harness/src/lane.ts`; genesis seed `…0001`
is the funded wallet per the pinned SDK's own e2e suite):

| Party | Role | Unshielded address |
|---|---|---|
| genesis | funding source | `bc610dd07c52f59012a88c2f9f1c5f34cbacc75b868202975d6f19beaf37284b` |
| feePayer | DUST/fee payer, disjoint from balances under test | `fdcbec11873c86ec5f651de21bbafb01cda094d38a27ae6a37cd3b48dbe163df` |
| OwnerN | demo user wallet | `cf18e9ae9634e06bc661f615e18a9e1b2db35ef7d9a3b46b00b147a5008a30d1` |
| OwnerM | demo user wallet | `67adc793a337c10018eab9615af51727555b0bc77e5fccdf062fbeb01a57fd36` |
| OwnerA | Manager account AA_A owner key | `1bce0f62e26806ae15404466be20f9d3c6452351c5814b9a0314457b560be392` |
| OwnerB | Manager account AA_B owner key | `efffda0bd6590feff825856dfdb0fc1b584290eefe64004578a898f8624c49f5` |

Genesis holdings observed on the fresh network: unshielded `250000000000000n` of the native color,
plus shielded `100000000000000n` (color `…0000`) and `50000000000000n` (color `…0001`).

| 2026-08-18T00:12–00:21Z | `npx tsx src/g1/fund.ts` | 0 | Fee wallet funded, DUST registered, **fee-paying smoke transaction confirmed** — `evidence/g1-lane/funding.txt` |

**Phase 4 complete.** Real transaction identifiers (all confirmed):

| Step | Transaction hash |
|---|---|
| Fund feePayer from genesis | `fc513beb33268742985505de97fe6f931f050b05cb8242e24e1b8d2cca29d61d` |
| DUST registration | `0026945dc2ce765cadf8402628b85f47118a8117ba62a87279183744643137170f` |
| Smoke transfer feePayer → OwnerN (fees from generated DUST) | `221da1322a7ec4d8872246ce638423d4bdb0dc24ccb158b03a8a377f34aebb3b` |

feePayer ends with NIGHT `3001000000000` across 4 UTXOs, **all `registeredForDustGeneration: true`**;
OwnerN received NIGHT `1000000`. Fees are paid by a wallet disjoint from every demo balance under
test, so demo-color evidence stays fee-isolated.

#### Bearing on Finding L-3

The pinned wallet SDK's own compose targets node `2.0.0-rc.3` + a pre-alpha indexer. This run
shows node `2.0.0-rc.4` and indexer `4.4.0-rc.1` **do** interoperate at the chain level — the
indexer follows and indexes rc.4 blocks reporting `ledger_version: V9` / `node_version: V2_0`.
L-3 is now **largely retired**: Phase 4 shows the pinned wallet SDK (`2.0.0-beta.2`) syncing
against node `2.0.0-rc.4` + indexer `4.4.0-rc.1` and reading correct genesis balances, despite the
SDK's own compose targeting rc.3. It remains open only for *transaction submission* behavior,
which the Phase 4 smoke transaction and G3 exercise.

One upstream caveat recorded while mirroring the SDK's e2e pattern: the SDK's own
`transacting.undeployed.test.ts` suite is `describe.skip` at the pinned tag, noting "Shielded
wallet cannot transact on its own anymore". The active suites (`facadeTransfer`, `tokenTransfer`,
`dust*`, `multipleWallets`, `swap`) all transact through `WalletFacade`, which is the API this
harness uses.
