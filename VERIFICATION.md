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

---

## G3 — Step-ledger run — **IN PROGRESS (not green)**

### Phase 1 — harness and providers (partial)

| UTC | Command | Exit | Result |
|---|---|---|---|
| 2026-08-18T01:33Z | `docker compose up -d` + `npx tsx src/g1/fund.ts` | 0 | G1 flow reproduces on a fresh chain: funding, DUST registration and fee-paying smoke tx all confirmed again |
| 2026-08-18T01:34Z | `npx tsx src/g3/deploy.ts` | 1 | **Blocked — see Finding G3-1** |

The midnight-js provider set is wired (`harness/src/g3/providers.ts`): stock
`levelPrivateStateProvider` / `indexerPublicDataProvider` / `NodeZkConfigProvider` /
`httpClientProofProvider`, with `walletProvider.balanceTx` and `midnightProvider.submitTx` bridged
to the pinned wallet facade's proven pipeline
(`balanceUnboundTransaction → signRecipe → finalizeRecipe → submitTransaction`).

Four provider-contract requirements were discovered and satisfied along the way, each a real API
requirement of the pinned beta.6 packages rather than a workaround:

1. `midnight-js-network-id` exports only `setNetworkId`/`getNetworkId`; the `NetworkId` value comes
   from `@midnightntwrk/wallet-sdk-abstractions`.
2. `levelPrivateStateProvider` requires a `privateStoragePasswordProvider` (≥16 chars). The harness
   generates an ephemeral per-process password; it is never written to disk or evidence.
3. `levelPrivateStateProvider` requires an `accountId` to scope storage per party.
4. `httpClientProofProvider`'s positional overload requires the `zkConfigProvider`.

### Finding G3-1 — `deployContract` fails inside `compact-js` (OPEN, blocking G3)

`deployContract(providers, { contract, privateStateId, initialPrivateState })` fails before any
network interaction with:

```
Unexpected error: TypeError: Cannot read properties of undefined (reading 'Symbol()')
  at getContractContext (@midnight-ntwrk/compact-js@2.5.5-rc.7 …/effect/internal/compactContext.ts:37)
```

`@midnight-ntwrk/compact-js@2.5.5-rc.7` is pulled in transitively by
`@midnight-ntwrk/midnight-js-contracts@5.0.0-beta.6`. The failure is in the library's own
contract-context lookup, which suggests the beta.6 `deployContract` options shape differs from the
one used here (the pinned midnight-js checkout contains only mock-based unit tests for
`deployContract`, no runnable end-to-end example to copy).

**Status: under investigation, not yet classified.** It is not yet established whether this is a
harness call-shape error or a genuine lane defect, so it is deliberately *not* recorded as a lane
RED. Reproduction: `npx tsx src/g3/deploy.ts` with the stack up.

**Consequence:** the last outstanding `LANE-DEV-1` check — on-chain acceptance of
`compactc 0.33.0` artifacts by the pinned `ledger-9.1.0.0-rc.3` node — remains **unproven**. G2
therefore stands as verified at build level only, exactly as recorded above.

### Phase 1/2 progress — step 0 GREEN, step 1 partial

| UTC | Result |
|---|---|
| 2026-08-18T02:06Z | **Step 0 asserted** (repeatably, exit 0): Minter + Manager deployed, Manager bound to the two verified-distinct Minter colors, AA_A + AA_B registered, all accounts `0/0`, `pool = AA_A + AA_B = 0` |
| 2026-08-18T02:33Z | **Step 1(a) mint shielded 10 → OwnerN SUCCEEDED** — tx `00f8b1e213a365c4450f74f868a3e9dc19916cd11c4a849188db4abac423799cbe` |
| 2026-08-18T02:33Z | **Step 1(b) paired mint → AA_A: fails at balancing** — see Finding G3-2 |

### Composition (master Q2 / OQ2) — mechanism WORKS, pairing semantics OPEN

The SDK-level composition **mechanism** is proven to work on this lane:

    createUnprovenCallTx(per contract)
      -> proofProvider.proveTx(per contract)      // per-contract, see below
      -> UnprovenTransaction/Transaction.merge    // transaction-level composition
      -> walletProvider.balanceTx -> submitTx

`withContractScopedTransaction` was evaluated first and rejected: it batches calls into one
transaction but is scoped to a **single** contract's providers, so it cannot pair a Minter call
with a Manager call.

Two requirements discovered while getting the single-call mint to submit, both now satisfied:

1. **Encryption keys for third-party recipients.** Minting a shielded coin to another party needs
   that party's *encryption* public key (`additionalCoinEncPublicKeyMappings`), otherwise the
   builder fails with `Unable to resolve encryption public key for recipient`.
2. **Proofs must be produced per contract.** A flattened "all keys in one directory"
   zkConfigProvider does **not** work: the proof provider resolves ZK artifact bundles against the
   *deployed contract's verifier key*, so the lookup is per contract, not per circuit name
   (`ZKArtifactNotFoundError: No ZK artifact bundle matches the deployed verifier key`). Each call
   is therefore proven with its own contract's providers and the **proven** transactions are merged.

### Finding G3-2 — paired mint-into-Manager does not balance (OPEN)

Merging `Minter.mintShieldedTo(value, nonce, recipient = Manager)` with
`Manager.depositShielded({nonce, color, value}, account)` produces a transaction the wallet cannot
balance: `Wallet.InsufficientFunds: Insufficient funds`.

Working hypothesis, from the pinned standard library: **both halves create the same zswap output.**
`mintShieldedToken` does `createZswapOutput(coin, recipient)` then `claimZswapCoinSpend(cm)`, and
claims the receive only when the recipient is `kernel.self()`. `receiveShielded` *also* does
`createZswapOutput(coin, right(self))` and then `claimZswapCoinReceive(cm)`. Paired naively, the
coin appears to be created twice while only one side is claimed as spend, so the shielded offer for
the demo color does not net to zero and the balancer tries to source the shortfall from the fee
wallet — which holds none of that color.

**Not yet classified.** It is unresolved whether the correct pairing is (a) a Manager receive
primitive that claims the receive WITHOUT re-creating the output, (b) mint-to-self on the Minter
followed by a send into the Manager, or (c) a different claim discipline entirely. This is a
contract/ledger-semantics question, not a lane defect, so **no lane RED is recorded**.

Consequence: step 1 is not asserted, and **0 of 26 combination cells are evidenced**. Step 0
remains the only asserted row.

#### G3-2 — prior-art check (refines, and partly refutes, the hypothesis above)

`midnight-ledger/ledger/tests/token_vault_shielded.rs` builds a deposit as:

```rust
// ZSwap offer: user sends coins (negative delta), contract receives output
let offer = ZswapOffer { /* … */ outputs: vec![out].into(), /* … */ };
```

i.e. the **sender** contributes exactly one contract-owned output while the contract's
`depositShielded` calls `receiveShielded` — which itself also calls `createZswapOutput`. Since that
prior art is known-good, the ledger evidently **unifies** the contract's declared output with the
sender's offer output rather than treating it as a duplicate. So plain "the output is created
twice" does not by itself explain the failure.

The remaining difference in this project's failing case is the **sender identity**: in the prior
art the sender is a user wallet contributing a funded zswap offer, whereas here the sender is the
**Minter contract**, which mints supply (`kernel.mintShielded`) and claims the *spend* side. The
open question is therefore how a contract-minted coin's spend claim and a second contract's receive
claim are expected to balance within one merged transaction — not whether outputs may be declared
by both sides.

Next investigative step for whoever resumes: compare against the mint path in the ledger tests
(rather than the vault deposit path) and inspect the merged transaction's zswap offer deltas per
segment before balancing.

---

## 2026-08-18 — G3: Q3 / Finding G3-2 RESOLVED — ledger-level composition works, both families

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`. Stack: Compose project `aa00003-token-custody`
(node `31573`, indexer `34299`, proof server `21095`), same pinned digests as G1.

| Command | `cd harness && npx tsx src/g3/probe-mint-compose.ts` |
|---|---|
| cwd | `/Users/edwardalvarado/todo/AA/experiments/00003-contract-token-custody/harness` |
| Run 1 (UTC) | `2026-08-18T11:31:36Z` → `2026-08-18T11:34:07Z`, exit 0 |
| Run 2 (UTC, retained) | `2026-08-18T11:34:20Z` → `2026-08-18T11:36:49Z`, exit 0 |
| Retained output | `evidence/g3-ledger/mint-compose.txt` |

### What was implemented

`harness/src/g3/ledger-compose.ts` assembles ONE ledger `Intent` holding BOTH
`ContractCallPrototype`s — the Minter's mint and the Manager's receive/credit — mirroring
`midnight-ledger/ledger/tests/token_vault_shielded.rs`. Each call's transcript, ZK input/output and
private transcript still come from executing the real compiled circuit through midnight-js; only
the *assembly* is done at ledger level, so nothing about the contracts is reimplemented off-chain.

The carrier call (the mint, which creates the coin) keeps its own transaction and therefore its
zswap offer — exactly one contract-owned output, claimed as a spend by the Minter and as a receive
by the Manager, which is the shape the prior art builds. The Manager's separately built
transaction is discarded; only its call prototype is grafted in.

Proving a two-contract intent uses the pinned SDK's own `ZKConfigRegistry`
(`makeComposedProofProvider`), which resolves each call's key location by joining on the hash of
the **deployed** verifier key. This supersedes the earlier `_combined` flat-directory attempt: the
lookup is per deployed contract, not per circuit name, so a flat directory can never serve two
contracts whose circuits share names (`mintShieldedTo`).

### Result — both families, reproduced twice

| Family | Composed transaction (retained run) | AA_A | pool / ledger |
|---|---|---|---|
| Shielded | `004d83b72c1dd872a4dd31564f1d09c6a02a7f0ec119c10b972a246233593bc7b1` | 0 → **10** | 0 → **10** |
| Unshielded | `0029024540c332b0095538a4864ee5706617328c4118c6c735e0e4684f623bcaa8` | 0 → **10** | shielded untouched |

Run 1 transactions (independent deployment, same code):
`00efa498f198d9b447acfc4e04c60e21a20446e40622447221f231555e22223406` (shielded) and
`00f646b49f0505c19245e1e76f64ec064d83b71e569cbc79363ecb5ed56e62e0d7` (unshielded).

The pooled coin's nonce equals the mint nonce chosen by the harness, confirming the Manager
claimed exactly the coin the Minter created. The pool invariant `pool = AA_A + AA_B` was asserted
after each transfer.

### Why the earlier route failed (Finding G3-2, now explained)

`UnprovenTransaction.merge` places each call in its **own segment**, so the Minter's spend claim
and the Manager's receive claim were in different segments and could not offset — hence
`Wallet.InsufficientFunds`. Putting both calls in one intent puts them in one segment, and they
offset. The earlier working hypothesis in this ledger ("the coin appears to be created twice") is
**refuted**: the ledger unifies the two declared outputs, exactly as the prior art implied.

**Consequence:** spec steps 1 and 2 are unblocked. Master **Q3 is resolved**; the owner-authorized
hybrid route (C) is now implemented — SDK level everywhere else, ledger-level assembly only for
the paired mint→Manager cells.

---

## 2026-08-18 — G3: Finding G3-3 — the indexer does not surface a CONTRACT's unshielded balance

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`.

While wiring the second observation point for contract-held unshielded value, the first ordered
step-ledger run halted at step 2 with:

```
STEP 2 DIVERGENCE — UNSHIELDED POOL INVARIANT — contract ledger balance=0 but AA_A+AA_B=10
```

The halt was correct and the contract was not at fault. Probed directly against the same live
Manager (`dcdc5d12c232c7dd8d28e3d372bbc5bcd777145d3be1ebb409d67ad7be047cbe`, unshielded colour
`035499bb24e637c6ca2fb6c73ee27db99857f086ff726e6b254371b3cfaaafe8`):

| Source | Result |
|---|---|
| `publicDataProvider.queryUnshieldedBalances(contractAddress)` | `[]` — empty |
| the contract's own LEDGER state, `ContractState.balance` | `{tag: unshielded, raw: 0354…afe8} -> 10` |

So the tokens are demonstrably held; the indexer's convenience view simply does not report
unshielded balances for a **contract** address on this pinned lane. (The same provider's
`unshieldedUtxos` query for **user** addresses works correctly and remains the independent
observation point for OwnerN and OwnerM.)

**Resolution — no RED.** The harness reads the contract's kernel-maintained ledger balance map
directly instead. That is the authoritative source the node itself enforces against, and it is
still genuinely independent of the `unshieldedOf` account map: different part of the state,
maintained by different machinery (`receiveUnshielded` / `sendUnshielded` versus the contract's own
account bookkeeping). The unshielded half of the standing invariant is therefore a real
cross-check, not a self-comparison.

Recorded as a lane observation rather than a defect of this project. It affects no cell.

---

## 2026-08-18 — G3: Finding G3-4 — the pinned indexer has no per-address unshielded-balance query

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`.

The next ordered run halted at step 2 with:

```
STEP 2 DIVERGENCE — OwnerN unshielded: wallet says 10, indexer says 0
```

Cause: the harness's second observation point for user unshielded holdings queried
`unshieldedUtxos(address:)`, and **that field does not exist** on indexer `v4.4.0-rc.1`. Schema
introspection of `Query` confirms it: there is `block`, `transactions`, `contractAction`,
`contract`, `contractEvents`, the DUST and bridge queries — and no per-address unshielded balance
or UTXO query at all.

**This is worth stating plainly:** the helper was written before this ledger existed and, because
it read `json?.data?.unshieldedUtxos ?? []`, it had been silently returning **0 for every address**
rather than failing. Nothing had depended on it until now. It was a latent hole in the
two-observation-point discipline, and the ordered ledger's assertion is what exposed it.

**Resolution — no RED, and a stronger check than before.** The indexer *does* expose, per
transaction, `unshieldedCreatedOutputs { owner tokenType value intentHash outputIndex
spentAtTransaction }`. Every movement of the Minter's colours happens in a transaction this
harness submits, so replaying those transactions and keeping the outputs the indexer reports as
**unspent** reconstructs each party's UTXO set from chain data alone
(`indexerUnshieldedByOwner`). Owner addresses come back bech32m-encoded and are decoded with the
pinned `MidnightBech32m` codec, verified against the wallet's own hex address.

That reconstruction is genuinely independent of the wallet SDK — it is the indexer's record of what
the chain did — and it is now asserted equal to the wallet's reported balance for OwnerN and OwnerM
after **every** step. It runs only at assertion points, never inside the polling loops that wait
for finality, since it costs one query per submitted transaction.

---

## 2026-08-18 — G3: Finding G3-5 — ledger-level composition must carry the MANAGER's transaction

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`.

The negative-control fixture mints shielded 10 into AA_A and then a second 10 into AA_B, so the
pool holds 20 while AA_A owns only 10. The **second** composed mint failed:

```
FAILED: Transaction submission error
```

Cause — a real defect in the first cut of `composeOneIntent`, found by exercising a case the
ordered ledger happens never to reach. Ledger-level composition keeps exactly ONE call's
transaction whole (with its zswap offers) and grafts the other calls in as prototypes only. The
first implementation kept the **Minter's** mint transaction. That is a superset of what is needed
only while the pool is EMPTY:

| pool state | what `depositShielded` does | zswap parts it needs |
|---|---|---|
| empty | `pool.writeCoin(c, self)` | just the received coin's output — which the mint also declares |
| non-empty | `mergeCoinImmediate(pool, c)` | **also** an INPUT spending the held pool coin and an OUTPUT for the merged coin |

Those merge parts exist only in the **Manager's** own transaction, and that transaction was being
discarded — so the composed transaction was missing them and the node refused it.

Why the ordered ledger never hit this: its two composed mints are step 1 (shielded, into an *empty*
pool) and step 2 (*unshielded*, which needs no zswap parts at all). The defect was reachable only
by a second shielded mint into a non-empty pool.

**Fix.** The carrier is now always the **Manager's** call. Its transaction is a superset in both
families: `mintShieldedToken` and `receiveShielded` declare the *same* output for the *same* coin
to the *same* recipient — the ledger needs exactly one of it, claimed as a spend by the Minter and
as a receive by the Manager, which is the `token_vault_shielded.rs` shape — and the Manager's
transaction additionally carries the merge input/output when there is one. Documented at the head
of `harness/src/g3/ledger-compose.ts`.

Recorded honestly: **the first ordered step-ledger run (steps 0–9, all asserted) predates this
fix**, and passed only because neither of its composed mints exercised the merge branch. The
retained G3 gate run is produced after the fix, so the run of record uses the corrected carrier.

---

## 2026-08-18 — **G3 GREEN**: the whole step ledger on a fresh stack, exit 0 including teardown

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`.

| Command | `./scripts/g3/verify-g3-ledger.sh` |
|---|---|
| cwd | `/Users/edwardalvarado/todo/AA/experiments/00003-contract-token-custody` |
| Started (UTC) | `2026-08-18T12:46:06Z` |
| Finished (UTC) | `2026-08-18T13:13:26Z` (27m20s) |
| **final_exit** | **0** — including teardown |
| Compose project | `aa00003-g3-20260818124606-78662` — unique to this run, random free ports >10000 |
| Run log | `evidence/g3-ledger/run.log` |

The wrapper owns the complete lifecycle from nothing: probe ports → pull → **assert the three
pinned image digests** → boot → host health checks → install → compile (fast **and** full ZK) →
the ordered ledger → negative controls → atomicity probes → render `CELLS.md` → teardown. Nothing
was carried over from the development stack; the chain, the contracts and the wallets are new.

| Step | s | exit |
|---|---|---|
| 01-probe-ports | 1 | 0 |
| 02-pull | 1 | 0 |
| 03-assert-digests | 0 | 0 |
| 04-boot | 6 | 0 |
| 05-health | 3 | 0 |
| 06-install | 0 | 0 |
| 07-compile-fast | 1 | 0 |
| 08-compile-zk | 54 | 0 |
| **09-step-ledger** | **781** | 0 |
| **10-negative-controls** | **337** | 0 |
| **11-atomicity** | **454** | 0 |
| 12-render-cells | 1 | 0 |

### Results of record

- **All ten ordered step rows (0–9) asserted live**, halt-on-divergence never triggered; the run
  ends with all four parties at `5/5`.
- **26 of 26 combination-matrix cells GREEN, 0 RED, no gaps** —
  `evidence/g3-ledger/CELLS.md`. The renderer exits nonzero on a missing cell or a RED, so the
  count is enforced rather than asserted in prose.
- **5 of 5 negative controls GREEN**, each with state and funds byte-identical before and after:
  omitted claim ×2, wrong-owner witness, unregistered witness, per-account overdraw with a
  sufficient pool.
- **2 of 2 atomicity probes GREEN**: neither the token effect nor the account-state change
  survived.
- The standing invariant `pool = AA_A + AA_B` held in **both families after every step**.

### Measured metrics (contract-call transactions only)

Proof latency (ms) over 23 `proveTx` calls: min 1, median 625, mean 1644, max 6197.
Submitted transaction size (bytes) over 23 submissions: min 6730, median 9312, mean 14250,
max 34341. Plain wallet-to-wallet transfers are proven and submitted inside the wallet SDK and are
deliberately not instrumented, so these are not whole-run averages.

**Gate G3 is GREEN.**

---

## 2026-08-18 — G4 run 1: clean-clone reproduction PASSED, and a gap in its own comparison

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`.

| Command | `./scripts/g4/verify-g4-closeout.sh` |
|---|---|
| Started / finished (UTC) | `2026-08-18T13:15:24Z` → `2026-08-18T14:11:29Z` |
| **final_exit** | **0** — including teardown |
| Clean clone | `…/T/aa00003-g4-bbNhku/clone`, asserted to carry no `docker/.env`, no `node_modules` and no generated artifacts |
| Reproduced G2 | 57 s |
| Reproduced G3 | **3289 s** (54m49s) — its own fresh stack, its own chain |

The reproduction produced 26/26 GREEN cells with the same steps and composition levels as the
original, on a brand-new deployment (`Minter d99c20b7…`, `Manager 37eba6ca…`). Teardown removed the
temporary clone, brought down this project's long-lived development stack, and proved **0 remaining
containers and 0 remaining volumes** matching the project.

### The gap, found by reading the run rather than trusting it

Retained evidence is **committed**, so `git clone` carries the ORIGINAL run's `evidence/` directory
into the clone; the clone's own run then overwrites it as it proceeds. Mid-run inspection made this
concrete — the clone's `run-context.json` still reported the original's Minter address while its own
ledger had not yet reached that step.

The comparison step as written compared only cell verdicts, so **had the clone's G3 somehow produced
no new evidence, the comparison would have compared the original against itself and passed.** The
`fs_run` exit-code discipline makes that unlikely — the clone's G3 wrapper must exit 0, and its
final step regenerates `cells.json` — but "unlikely" is not the standard this project is held to.

**Fix, applied before the retained G4 run.** `step_compare_cells` now first proves the reproduction
is genuinely its own:

- the clone's Minter **and** Manager addresses must DIFFER from the original's;
- the two runs must share **no transaction id at all** (a fresh chain cannot reproduce one);

and only then compares what the specification asserts — every cell's verdict, step and composition
level, plus the negative-control and atomicity-probe verdicts, which the first version did not
compare at all.

Run 1's result stands on its merits (the reproduction demonstrably happened, on different
addresses), but the **retained G4 evidence is the re-run under the strengthened comparison**.

---

## 2026-08-18 — **G4 GREEN**: clean-clone reproduction under the strengthened comparison

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`.

| Command | `./scripts/g4/verify-g4-closeout.sh` |
|---|---|
| cwd | `/Users/edwardalvarado/todo/AA/experiments/00003-contract-token-custody` |
| Started (UTC) | `2026-08-18T14:12:26Z` |
| Finished (UTC) | `2026-08-18T14:57:22Z` (44m56s) |
| **final_exit** | **0** — including teardown |
| Run log | `evidence/g4-closeout/run.log` |

| Step | s | exit |
|---|---|---|
| 01-clean-clone | 0 | 0 |
| 02-reproduce-g2 | 56 | 0 |
| **03-reproduce-g3** | **2638** | 0 |
| 04-compare-cells | 0 | 0 |
| 05-final-report | 0 | 0 |

### Reproduction is provably a reproduction

```
original   Minter/Manager: b0a96ac6…041a28ad / 1d838367…6c39e183
reproduced Minter/Manager: 3f7de5d2…00e9de55 / 10522fb9…cadcca5e
transaction ids: 20 original, 20 reproduced, 0 in common
original cells:   26
reproduced cells: 26
…
reproduction matches the original cell for cell, on a demonstrably different chain
```

- The clone was asserted to carry **no** `docker/.env`, **no** `node_modules` and **no** generated
  artifacts, so everything was rebuilt from source inside it.
- Different Minter **and** Manager addresses, and **zero transaction ids in common** — the
  reproduction cannot be the committed evidence that travels in with `git clone`.
- All 26 cells match on verdict, step and composition level; all 5 negative controls and both
  atomicity probes match verdict for verdict.
- Zero manual intervention beyond running the one documented command (SC-004).

### Teardown proof

The temporary clone was removed after its path was validated as a `mktemp -d` directory, this
project's long-lived development stack was brought down (already absent by then — the run reports
`No resource found to remove`), and the wrapper asserted **0 remaining containers and 0 remaining
volumes** matching the project. Nothing belonging to any other project on this shared host was
touched.

**Gate G4 is GREEN.** All four gates — G1, G2, G3, G4 — are GREEN.
