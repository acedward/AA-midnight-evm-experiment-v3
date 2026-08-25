# F-CODEC command ledger

All paths below were run from
`/Users/edwardalvarado/todo/AA/experiments/00008-AA-v3-evm-f-codec`.

## Compact regeneration

```sh
docker run --rm \
  --label com.docker.compose.project=aa00008_fcodec_20260821_gate3 \
  -v aa00008_fcodec_20260821_gate3_work:/repo \
  -w /repo \
  sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  sh -c 'mv harness/src/auth/compact/generated harness/src/auth/compact/generated-pinned && \
    mkdir -p harness/src/auth/compact/generated && \
    /opt/compactc/compactc --feature-zkir-v3 --skip-zk \
      harness/src/auth/compact/AuthCodec.compact harness/src/auth/compact/generated && \
    diff -r harness/src/auth/compact/generated-pinned harness/src/auth/compact/generated && \
    test "$(find harness/src/auth/compact/generated -name "*.zkir" -o -name "*.verifier" | wc -l)" -eq 0'
```

Exit: `0` (`COMPACT_REPRODUCTION=PASS`).

## Pinned Node 22 verification

The source was first copied from a read-only bind mount into the disposable volume with host
`node_modules` and `.pnpm-store` excluded. Then:

```sh
docker run --rm \
  --label com.docker.compose.project=aa00008_fcodec_20260821_gate3 \
  -e CI=true -e COREPACK_HOME=/tmp/corepack \
  -v aa00008_fcodec_20260821_gate3_work:/repo \
  -w /repo/harness \
  node:22.18.0-bookworm-slim@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e \
  sh -c 'set -e; \
    corepack pnpm@11.5.1 install --frozen-lockfile --ignore-scripts \
      --package-import-method=copy --child-concurrency=1 --network-concurrency=1; \
    corepack pnpm@11.5.1 auth:fixtures:check; \
    corepack pnpm@11.5.1 test:auth; \
    corepack pnpm@11.5.1 typecheck:auth; \
    sha256sum src/auth/fixtures/v1.json src/auth/AUTH-EIP712-AA-V3-V1.md \
      package.json pnpm-lock.yaml'
```

Exit: `0`. Test result: 5 files and 24 tests passed. Fixture drift and typecheck both exited `0`.

## Teardown/residue

The shell installed an `EXIT INT TERM` cleanup trap before creating the project volume. Cleanup
removed every container carrying label
`com.docker.compose.project=aa00008_fcodec_20260821_gate3` and volume
`aa00008_fcodec_20260821_gate3_work`. Final checks:

```sh
test -z "$(docker ps -aq --filter label=com.docker.compose.project=aa00008_fcodec_20260821_gate3)"
test -z "$(docker volume ls -q --filter name=aa00008_fcodec_20260821_gate3)"
```

Both exited `0`: `RESIDUAL_CONTAINERS=0`, `RESIDUAL_VOLUMES=0`, `FINAL_EXIT=0`.
