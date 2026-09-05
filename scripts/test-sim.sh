#!/usr/bin/env bash
#
# test-sim.sh — run the SIMULATION test tier (the fast one; this is what CI runs).
#
# WHAT THE TIER IS
#   Keyless, proofless, network-free. The suites load the compiled contracts into the Compact
#   runtime's own circuit simulator and execute them directly, so there is no Midnight node, no
#   proof server, no proving key and no wallet. That is why it finishes in seconds and why it can
#   run on every push. The heavyweight tier is `scripts/test-integration.sh`.
#
# WHAT IT NEEDS
#   The compiled contracts in `tests/generated/` — this script builds them first via
#   `scripts/compile.sh` unless you pass `--skip-compile`. Node dependencies are installed from the
#   FROZEN LOCKFILE (`tests/pnpm-lock.yaml`); the lockfile is never updated by this script.
#
# WHERE IT RUNS
#   Default: inside the pinned Node image, in a scratch Docker volume, so a shared host needs no
#   local Node and nothing is written into your working tree.
#   `AA_TEST_RUNTIME=native`: straight on the host (used by CI, whose runner is already isolated).
#
# usage: scripts/test-sim.sh [--skip-compile] [--reinstall] [-- <extra vitest args>]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime="${AA_TEST_RUNTIME:-docker}"
node_image="${AA_NODE_IMAGE:-node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e}"
pnpm_version="11.5.1"
project="aa_sim"
volume="${project}_work"

skip_compile=0
reinstall=0
extra=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-compile) skip_compile=1; shift ;;
    --reinstall)    reinstall=1; shift ;;
    --)             shift; extra=("$@"); break ;;
    *)              extra+=("$1"); shift ;;
  esac
done

if [ "$skip_compile" -eq 0 ]; then
  bash "$repo_root/scripts/compile.sh" all
fi
test -d "$repo_root/tests/generated/manager/contract" \
  || { echo "tests/generated/manager is missing — run scripts/compile.sh" >&2; exit 66; }

# No key material may be anywhere near the tier: it is keyless by construction, and an accidental
# key would mean somebody ran keygen into the test tree.
keys="$(find "$repo_root/tests" \( -name '*.prover' -o -name '*.verifier' \) 2>/dev/null | wc -l | tr -d ' ')"
[ "$keys" -eq 0 ] || { echo "KEY FILES PRESENT under tests/ ($keys) — the simulation tier must be keyless" >&2; exit 68; }
echo "KEY_FILES=0"

if [ "$runtime" = "native" ]; then
  cd "$repo_root/tests"
  corepack enable
  corepack prepare "pnpm@$pnpm_version" --activate
  pnpm install --frozen-lockfile
  exec node_modules/.bin/vitest run simulation ${extra[@]+"${extra[@]}"}
fi

cleanup_container() { docker rm -f "${project}-run" >/dev/null 2>&1 || true; }
trap cleanup_container EXIT INT TERM

fresh=0
if ! docker volume inspect "$volume" >/dev/null 2>&1; then
  docker volume create --label com.docker.compose.project="$project" "$volume" >/dev/null
  fresh=1
fi
[ "$reinstall" -eq 1 ] && fresh=1

# Stage the test tree (sources + freshly compiled artifacts) into the volume. `node_modules` is
# excluded so a host-side install can never leak in.
# `contracts/` rides along read-only: the 00014 refusal matrix reads the assert strings back out of
# the Compact SOURCES at test time (that is what makes its coverage claim mechanical rather than a
# hand-maintained list), and the run container only ever sees this volume. Nothing compiles it here.
docker run --rm --name "${project}-stage" --label com.docker.compose.project="$project" \
  --cpus 2 --memory 8g --memory-swap 8g \
  -v "$repo_root/tests:/src:ro" -v "$repo_root/contracts:/src-contracts:ro" \
  -v "$repo_root/scripts/test-integration.sh:/src-test-integration.sh:ro" \
  -v "$volume:/work" -w /src \
  "$node_image" \
  sh -euc 'rm -rf /work/simulation /work/integration /work/lib /work/fixtures /work/generated /work/contracts /work/scripts; \
    tar --exclude="./node_modules" -cf - . | tar -xf - -C /work; \
    mkdir -p /work/contracts /work/scripts; \
    tar -cf - -C /src-contracts . | tar -xf - -C /work/contracts; \
    cp /src-test-integration.sh /work/scripts/test-integration.sh'

if [ "$fresh" -eq 1 ] || ! docker run --rm -v "$volume:/work" "$node_image" test -d /work/node_modules; then
  # Dependency install is the ONLY step that touches the network, and it is frozen-lockfile only.
  docker run --rm --name "${project}-install" --label com.docker.compose.project="$project" \
    --cpus 2 --memory 8g --memory-swap 8g \
    -v "$volume:/work" -w /work \
    "$node_image" \
    sh -euc "corepack enable; corepack prepare pnpm@$pnpm_version --activate; pnpm install --frozen-lockfile"
fi

# The run itself is offline: nothing it does may depend on the network.
docker run --rm --network none --name "${project}-run" --label com.docker.compose.project="$project" \
  --cpus 2 --memory 8g --memory-swap 8g \
  -v "$volume:/work" -w /work \
  "$node_image" \
  sh -euc 'keys="$(find . -path ./node_modules -prune -o \( -name "*.prover" -o -name "*.verifier" \) -print)"; \
    [ -z "$keys" ] || { echo "KEY FILES IN THE TEST TREE: $keys" >&2; exit 68; }; \
    echo "IN_CONTAINER_KEY_FILES=0"; \
    node_modules/.bin/vitest run simulation '"${extra[*]-}"
