#!/usr/bin/env bash
# Compile both Compact contracts inside the pinned compiler image.
#
#   --skip-zk (default)   fast: TypeScript + ZKIR only, for simulator/unit suites
#   --zk                  full: also produces prover/verifier keys, needed to deploy in G3
#
# LANE-DEV-1: the image carries `compactc-v0.33.0` (released form of the pinned but unpublished
# `compactc-v0.33.0-rc.2`), pinned by SHA-256 — see docker/compactc.Dockerfile.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

IMAGE="aa00003-compactc:0.33.0"
MODE="${1:---skip-zk}"

# Output lands INSIDE the harness package on purpose: the generated modules `import
# '@midnight-ntwrk/compact-runtime'`, and Node resolves both module type and node_modules from the
# nearest package.json. A sibling build/ dir would resolve to the clone root, which has neither.
if [ "$MODE" = "--zk" ]; then
  OUT="harness/generated-zk"; FLAGS=()
else
  OUT="harness/generated"; FLAGS=(--skip-zk)
fi

# Build the compiler image if it is not present (idempotent; content-pinned by SHA-256).
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "building compiler image $IMAGE"
  docker build -q -f docker/compactc.Dockerfile -t "$IMAGE" . >/dev/null
fi

for c in minter manager; do
  echo "compiling ${c} (${MODE}) -> ${OUT}/${c}"
  rm -rf "${OUT:?}/${c}"
  mkdir -p "${OUT}/${c}"
  # `${FLAGS[@]+...}` guard: under `set -u`, bash 3.2 (the macOS default) treats expanding an
  # empty array as an unbound variable, which is exactly the --zk case.
  docker run --rm -v "$PWD:/work" "$IMAGE" \
    compactc ${FLAGS[@]+"${FLAGS[@]}"} "contracts/${c}.compact" "${OUT}/${c}"
done

# harness/package.json already declares "type": "module", which these subdirectories inherit.

echo "compiled: $(find "${OUT}" -name '*.zkir' | wc -l | tr -d ' ') zkir, $(find "${OUT}" -name '*.verifier' 2>/dev/null | wc -l | tr -d ' ') verifier keys"
