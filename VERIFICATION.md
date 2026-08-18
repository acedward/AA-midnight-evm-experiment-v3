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

### Phase 5 — Gate wrapper — **G1 GREEN**

`./scripts/g1/verify-g1-lane.sh` runs the entire lane from nothing and owns its own teardown:
`probe ports → pull → assert digests → boot → host health → install → wallets → funding/DUST/smoke
→ teardown`.

| Run | Result |
|---|---|
| 2026-08-18T01:11Z | **RED (correctly)** — `06-install` exit 1: pnpm 11 fails an install whose build scripts are silently ignored. Fixed by approving `esbuild` + `msgpackr-extract` in `harness/pnpm-workspace.yaml`. |
| 2026-08-18T01:11Z | **RED (correctly)** — `08-funding` exit 1 on a *freshly booted* chain: `Insufficient Funds: could not balance dust`. Genesis holds registered NIGHT but DUST has not yet accrued in the first seconds of a new chain. Fixed with `withDustRetry`, which waits on the SDK's own reported shortfall (`waitForGeneratedDust`) or backs off — a deterministic wait on an observable condition, not a blind sleep. |
| **2026-08-18T01:12:22Z → 01:13:49Z** | **GREEN — `final_exit: 0`** |

Green-run step timings (from `evidence/g1-lane/run.log`), every step exit `0`:

| Step | Duration |
|---|---|
| 01-probe-ports | 1s |
| 02-pull | 2s |
| 03-assert-digests | 0s |
| 04-boot | 6s |
| 05-health | 2s |
| 06-install | 0s |
| 07-wallets | 5s |
| 08-funding | 70s |
| teardown | exit 0 |

**Total: 87 s from nothing to a fully verified lane and a clean teardown.**

Transactions from the green run (a genuinely fresh chain, distinct from the earlier manual run):

| Step | Transaction hash |
|---|---|
| Fund feePayer from genesis | `466284a51aca0d36ee0463e836e824cc31ea1a30ba02b12006396b0e12f740cb` |
| DUST registration | `0082906adcd1d15e806a74a0bca6d4f7e6a00c70f3d1b8b875e48e9278df2c1d43` |
| Smoke transfer (fees from generated DUST) | `3f1645966d4c7cd6e80dd61aaa04b9e68619658948db8bcf8cf378b5a20c6c55` |

The wrapper asserts the digests Compose will actually run against the LANE.md pins before booting,
so a retagged upstream image cannot silently change the lane.

## G1 EXIT CRITERIA — MET

- [x] Lane manifest complete, every component pinned by digest/integrity hash, `EXPERIMENTAL_LANE`.
- [x] Fresh stack boots reproducibly **from the wrapper alone**; health checks pass from the host.
- [x] Fee wallet generates DUST and pays for a smoke transaction; demo wallets exist and are
      fee-isolated.
- [x] Master G1 row updated with links to retained evidence.

One owner-approved deviation is carried forward: **`LANE-DEV-1`** (compiler `0.33.0` released form
substituted for the unobtainable `-rc.2`), still to be empirically verified at G2.

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

---

## G2 — Minter and Manager contracts — **GREEN**

`./scripts/g2/verify-g2-contracts.sh` → `final_exit: 0` (2026-08-18).

| Step | Duration | Exit |
|---|---|---|
| 01-verify-lane-dev-1 | 1s | 0 |
| 02-compile-fast | 1s | 0 |
| 03-install | 0s | 0 |
| 04-unit-suites | 2s | 0 |
| 05-compile-zk | 47s | 0 |
| 06-record-artifacts | 1s | 0 |

It went RED once first, correctly: `${FLAGS[@]}` expansion of an empty array under `set -u` on
bash 3.2 (the macOS default) aborted the `--zk` compile.

### `LANE-DEV-1` — VERIFIED

The owner-approved compiler substitution is now proven rather than assumed:

- [x] Installed `compactc` reports compiler version **`0.33.0`**.
- [x] Installed `compactc` reports language version **`0.25.0`**.
- [x] The pinned read-only rc.2 source declares exactly the same pair
      (`compiler-version.ss`, `language-version.ss`) and targets `ledger-9.1.0.0-rc.3` — this
      lane's ledger.
- [x] Binary pinned by SHA-256 `3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46`
      (`compactc_v0.33.0_aarch64-unknown-linux-musl.zip`, 31,550,294 B) in
      `docker/compactc.Dockerfile`.
- [ ] **On-chain acceptance by the pinned `ledger-9.1.0.0-rc.3` node — still outstanding**, proven
      at G3 deploy time. Until then the deviation is verified at build level only.

Independent corroboration: the emitted artifacts themselves carry
`compiler-version: 0.33.0`, `language-version: 0.25.0`, `runtime-version: 0.18.0-rc.1` — and
`0.18.0-rc.1` is exactly the `@midnight-ntwrk/compact-runtime` version the pinned
`midnight-js v5.0.0-beta.6` depends on. The toolchain is internally coherent.

### Contracts

| Contract | Circuits | Witnesses |
|---|---|---|
| Minter | 4 — `shieldedColor`, `unshieldedColor`, `mintShieldedTo`, `mintUnshieldedTo` | none |
| Manager | 15 — `configure`, `registerAccount`, `myAccount`, `isRegistered`, `accountShielded`, `accountUnshielded`, `poolShieldedValue`, `poolHasCoin`, `depositShielded`, `withdrawShielded`, `selfSendShielded`, `depositUnshielded`, `withdrawUnshielded`, `selfSendUnshielded`, `transferInternal` | `localOwnerSecret` |

All 18 verifier keys are hashed in `evidence/g2-contracts/ARTIFACTS.md`.

### Simulator/unit suites — 27 tests, all passing

Run with the pinned `@midnight-ntwrk/compact-runtime@0.18.0-rc.1`, the same runtime stamped into
the artifacts.

Manager (21): configure-once; register + duplicate rejection; zero-initialised accounts; deposit
credits the named account and pools the coin; **merge-on-deposit** (value combines, coin identity
changes); wrong-color rejection (tag-aware, not byte-blind); deposit to an unregistered account
rejected; payout retains change; **empty-change arm** (full withdraw empties the pool and the
emptied account stays registered and reusable); **per-account overdraw rejected even when the pool
holds more**; unregistered owner witness rejected; **wrong-owner witness cannot reach another
account's balance**; **internal transfer moves attribution while the pooled coin stays
byte-identical** (both families); internal-transfer overdraw and unregistered destination
rejected; per-account unshielded guard; **self-send rotates the pooled coin identity while every
balance and attribution is unchanged**, plus its two rejection paths.

Minter (6): the two colors are **distinct**, deterministic, and contract-scoped (different
deployments derive different colors); neither is the native token; minted coins carry the expected
color in each family; zero-value mints rejected in both families.

Every negative test asserts **state unchanged** as well as rejection: `ManagerSim.expectReject`
snapshots the ledger before the call and fails if a rejected call moved any state.

### Decision — atomicity probes (Plan 02 Question 2)

Deferred to G3 rather than compiled as test-only circuits here. The spec's atomicity requirement is
that *"a circuit performs the token operation then fails an assertion; neither the token effect nor
the account-state change may survive"* — which is a property of **transaction application on the
node**, not of the simulator. A simulator probe would only re-prove that a thrown assertion abandons
in-memory state, which the 27 suites above already show. The real probes therefore run live in G3
against the pinned node, one per family.
