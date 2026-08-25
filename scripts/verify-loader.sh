#!/usr/bin/env bash
#
# verify-loader.sh — prove the generated proving key can actually be LOADED.
#
# WHAT IT CHECKS
#   Node's `fs.readFile` refuses any file over 2 GiB, and the pinned midnight-js provider reads a
#   prover key exactly that way. The k=20 Manager's `execute.prover` was 2,282,126,073 bytes and was
#   refused outright; that is why `execute` was driven to k=19, where the key is 1,141,041,759 bytes
#   (53.1% of the ceiling). This script drives the real provider on the real key and, in the SAME
#   process, runs a control against a sparse file of the k=20 key's exact size — so a pass is
#   attributable to the key's size rather than to the ceiling having quietly moved.
#
#   It reads files and assembles an in-memory config. No proof, no submission, no deployment, and
#   the container runs with `--network none`.
#
# WHAT IT NEEDS
#   A key set from `scripts/keygen.sh` (default `tests/generated/manager-keys`), and the test
#   package's node_modules — installed from the FROZEN LOCKFILE, so the loader versions exercised
#   are exactly the pinned ones:
#     @midnight-ntwrk/midnight-js-node-zk-config-provider@5.0.0-beta.6
#     @midnight-ntwrk/midnight-js-types@5.0.0-beta.6
#
# usage: scripts/verify-loader.sh [keygen-output-dir] [circuitId]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifacts="${1:-$repo_root/tests/generated/manager-keys}"
circuit="${2:-execute}"
node_image="${AA_NODE_IMAGE:-node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e}"
pnpm_version="11.5.1"
volume="aa_sim_work"
container="aa-loader-verify-$$"

test -d "$artifacts/keys" || {
  echo "no keys/ under $artifacts" >&2
  echo "run: scripts/keygen.sh   (expensive — read its header first)" >&2
  exit 66
}

# Reuse the simulation tier's installed volume when it exists; otherwise create and install it.
if ! docker volume inspect "$volume" >/dev/null 2>&1; then
  docker volume create --label com.docker.compose.project=aa_sim "$volume" >/dev/null
fi
docker run --rm -v "$repo_root/tests:/src:ro" -v "$volume:/work" -w /src "$node_image" \
  sh -euc 'tar --exclude="./node_modules" --exclude="./generated" -cf - . | tar -xf - -C /work'
docker run --rm -v "$volume:/work" -w /work "$node_image" test -d node_modules || \
  docker run --rm -v "$volume:/work" -w /work "$node_image" \
    sh -euc "corepack enable; corepack prepare pnpm@$pnpm_version --activate; pnpm install --frozen-lockfile"

cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo "LOADER_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ARTIFACTS=$artifacts"
echo "CIRCUIT=$circuit"
echo "BOUNDS=cpus:4,memory:20g,memory-swap:20g,network:none"
echo "NODE_IMAGE=$node_image"

# `--max-old-space-size` is deliberately NOT raised: the point is that the key fits the loader's
# ordinary behaviour, not that it can be forced through with a tuned heap.
rc=0
/usr/bin/time -p docker run --rm --network none \
  --name "$container" --cpus 4 --memory 20g --memory-swap 20g \
  -v "$volume:/work" \
  -v "$artifacts:/artifacts:ro" \
  -v "$repo_root/scripts/loader-verify.mjs:/work/loader-verify.mjs:ro" \
  -w /work \
  "$node_image" \
  node loader-verify.mjs /artifacts "$circuit" || rc=$?

echo "LOADER_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "LOADER_EXIT=$rc"
exit "$rc"
