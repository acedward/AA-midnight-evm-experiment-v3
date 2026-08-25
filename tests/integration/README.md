# Integration tier — node-stack tests

**This directory is currently empty, on purpose. That is a known state, not a missing file.**

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

CI never runs this tier — see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). CI runs
the simulation tier, which needs no stack, no keys and no network.

## Why it is empty

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

## Adding the first suite

1. Write `tests/integration/<name>.test.ts`.
2. Read the stack endpoints from the environment; `scripts/test-integration.sh` exports
   `MN_NODE_URL`, `MN_INDEXER_URL` and `MN_PROOF_SERVER_URL` for exactly this.
3. Point the ZK config provider at `tests/generated/manager-keys` (see `scripts/keygen.sh`).
4. Run `scripts/test-integration.sh`. Nothing else needs changing — the script picks up any
   `*.test.ts` here automatically.

Keep it out of the simulation tier: anything under `tests/simulation/` must stay keyless and
offline, because that is what makes it safe to run on every push.
