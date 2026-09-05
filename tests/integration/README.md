# Integration tier — node-stack tests

**Default Vitest discovery is still empty on purpose.** The manual AA harness is named
`aa-faucet-runner.ts`, not `*.test.ts`, so an ordinary integration command remains a no-op.

## What this tier is for

Tests that need a real Midnight stack: a node, an indexer and a proof server, brought up from
[`docker/compose.yml`](../../docker/compose.yml) with every image pinned by digest. Anything that
produces a proof, submits a transaction, or deploys the contract belongs here.

Run it with:

```sh
scripts/test-integration.sh
```

That script picks random confirmed-free ports above 10000, binds them to loopback only, waits for
readiness from the host (the proof server and indexer images are distroless, so their own
healthchecks can never pass), runs every `*.test.ts` in this directory, and tears the stack down
with `down -v --remove-orphans`. With no suites present it says so and does **not** boot anything.
The opt-in AA branch described below attaches to an already-running external stack and never boots
this repository's core-only Compose file.

CI never runs this tier — see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). CI runs
the simulation tier, which needs no stack, no keys and no network.

## Manual AA faucet harness

The shipped runner targets the stock `midnight-2-offers` legacy deployment profile only: AA commit
`713a20215f33e02904ea5bd699b7de7f76562e1b`, Compact runtime `0.18.0-rc.1`, compiler `0.33`, and
Offer Files old ABI from kernel `4af1025`. It loads `/aa/contract-{manager,minter,offer-files}/src/managed`
from the selected `aa-console` image. It never loads this checkout's current 0.19 generated JS into
that process, and a successful legacy run does not prove the current Manager bytecode.

Before running, use the stack's own `scripts/fund-wallet.sh "$AA_HARNESS_WALLET_SEED"` command. The
dedicated seed must differ from the stack's deployer/funder seed and must have synchronized
shielded/unshielded/DUST state, positive unshielded NIGHT, registered NIGHT, and a spendable DUST
UTXO. The runtime verifies those prerequisites before its first contract effect. Select the
unpruned running `aa-console` container; the default `aa-deploy` image omits Manager
`execute.prover` and is refused during preflight.

Set `AA_FAUCET_LIVE=1`, `AA_HARNESS_CONTAINER`, the strict network/address/commit variables listed
by `tests/integration/funding/router.ts`, and the dedicated `AA_HARNESS_WALLET_SEED`, then run
`scripts/test-integration.sh`.

Default mode requires the four `AA_MINTER_*` identity values and submits raw base units (default
`1_000_000_000`). Faucet mode sets `OFFER_FILES_FAUCET=1`, `OFFER_FILES_CONTRACT`, and origin-only
`ZSWAP_API`; it funds both WBTC and WETH at six decimals (default 1,000 whole coins each). The
wallet and Offer Files use `AA_WALLET_PROOF_SERVER_URL` (plain); Manager and legacy Minter use
`MN_PROOF_SERVER_URL` (experimental). Registry access is exactly one GET to
`/v1/known-tokens`; there is no generic POST surface.

The script reuses the selected container's exact image, network namespace and `aa-out` volume,
bind-mounts the candidate runner/runtime read-only, and forwards the seed directly as an environment
secret. It writes `aa-contracts-v1.json` and `aa-faucet-run.json` to `/aa/out` by default. Neither
receipt nor stdout contains the seed, passwords, private keys, or authorization handles.
When running both modes against one stack, set distinct
`AA_DECORATED_DEPLOYMENT_RECEIPT_PATH` and `AA_RUN_RECEIPT_PATH` values for each invocation so the
second run does not replace the first run's evidence. The sidecar copies the selected Compose
project label and adds `com.effectstream.aa-faucet-harness=1`, making an interrupted run
discoverable by the stack teardown.

The strict environment table and two runnable mode examples are in
[`README.md`](../../README.md#test-tokens-aa-minter-vs-offer-files-faucet). In particular, the
AA-Minter amount is already-scaled raw base units, while the Offer Files amount is whole coins that
the selected adapter scales by `10^6` exactly once. The common defaults deliberately make
`1_000_000_000` raw Minter units equal 1,000 six-decimal faucet coins without sharing an ambiguous
`amount` input.

### Receipt boundary

The selected stock stack still produces the following bounded, unversioned object at
`/aa/out/aa-contracts.json`:

```text
network, aaCommit,
manager.{address,domain}, minter.{address,tag},
mints.{shielded,unshielded}.{color,tx,recipient},
deployedAt, tookSeconds
```

The runner parses that legacy shape only under `legacy-0.18`, checks network, full AA commit,
Manager identity and independently read Minter address/tag/both colours before any ledger effect,
and writes a separate `aa-contracts/v1` decoration. That versioned deployment receipt always has
`manager`, `minter`, and the two `aa-minter` metadata rows `AATEST-S`/`AATEST-U`; faucet mode also
has `offerFiles` and exactly one six-decimal shielded row for each of WBTC/WETH. The companion
`aa-faucet-run/v1` receipt remains mode-specific and contains only sanitized token metadata,
balance deltas, distinct transaction IDs and timestamps.

The authoritative stock producer and consumers live outside this repository. The separate
downstream work must update `images/aa-contracts/runner/deploy-aa.ts`,
`images/aa-contracts/runner/aa-console.ts`, `images/aa-contracts/runner/aa-e2e.ts`,
`scripts/verify-aa.sh`, `scripts/aa-e2e.sh` and `docs/COMPONENTS.md`. The exact field-level handoff
is [`docs/midnight-2-offers-aa-contracts-handoff.md`](../../docs/midnight-2-offers-aa-contracts-handoff.md).
This AA change does not claim that FR-005's downstream producer/consumer migration is implemented
or merged.

## Historical live apparatus

The live-node runners this repository used to carry — deploy rigs, wallet funding, swap maker/taker
processes, the proof-carrying offer kit — were research apparatus for the predecessor projects, and
were removed when the repository was reduced to product source. They are all still reachable at the
tag `research/pre-reorg`:

```sh
git show research/pre-reorg:harness/src/g2/deploy-order.ts
git checkout research/pre-reorg -- harness/src/g1   # if you want a whole tree back
```

Note what those runners assumed, because it is the reason nothing has replaced them yet: every one
of them proves and submits, so every one needs a proving key from `scripts/keygen.sh` — hours of
generation and about 1.2 GB on disk — plus a funded wallet on the local chain.

## Adding the first discovered suite

1. Write `tests/integration/<name>.test.ts`.
2. Read the stack endpoints from the environment; `scripts/test-integration.sh` exports
   `MN_NODE_URL`, `MN_INDEXER_URL` and `MN_PROOF_SERVER_URL` for exactly this.
3. Point the ZK config provider at `tests/generated/manager-keys` (see `scripts/keygen.sh`).
4. Run `scripts/test-integration.sh`. Nothing else needs changing — the script picks up any
   `*.test.ts` here automatically.

Keep it out of the simulation tier: anything under `tests/simulation/` must stay keyless and
offline, because that is what makes it safe to run on every push.
