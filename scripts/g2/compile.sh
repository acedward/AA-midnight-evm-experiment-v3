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

# A BUILD-TIME COLLISION CHECK, not a proving input. A transaction spanning both contracts is
# proved through a `ZKConfigRegistry` over the two per-contract artifact directories, because each
# call's key location embeds the hash of its DEPLOYED verifier key and resolution joins on that —
# a flattened directory could never serve two contracts. What this combined copy still buys is the
# assertion below: it fails loudly if the two contracts ever export a circuit under the same name,
# which would make per-name reasoning about artifacts ambiguous for a reader.
if [ "$MODE" = "--zk" ]; then
  COMBINED="${OUT}/_combined"
  rm -rf "$COMBINED"; mkdir -p "$COMBINED/keys" "$COMBINED/zkir"
  for c in minter manager; do
    for sub in keys zkir; do
      for f in "${OUT}/${c}/${sub}"/*; do
        [ -e "$f" ] || continue
        base="$(basename "$f")"
        if [ -e "${COMBINED}/${sub}/${base}" ]; then
          echo "FATAL: circuit name collision on ${sub}/${base} between contracts" >&2
          exit 1
        fi
        cp "$f" "${COMBINED}/${sub}/${base}"
      done
    done
  done
  echo "combined zk view: $(find "$COMBINED/keys" -name '*.verifier' | wc -l | tr -d ' ') verifier keys"
fi

echo "compiled: $(find "${OUT}" -name '*.zkir' | wc -l | tr -d ' ') zkir, $(find "${OUT}" -name '*.verifier' 2>/dev/null | wc -l | tr -d ' ') verifier keys"
