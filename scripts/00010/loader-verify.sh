#!/usr/bin/env bash
# 00010 Phase 5 — run the pinned-loader verification against the generated k=19 key set.
#
# LOCAL ONLY, and enforced as such: `--network none`. The container reads key files and assembles an
# in-memory ZK config. No proof is produced, nothing is submitted, nothing is deployed.
#
# The loader packages come from the parity volume, which was installed from the FROZEN LOCKFILE, so
# the versions exercised are exactly the pinned ones the 00008-Q2 evidence names:
#   @midnight-ntwrk/midnight-js-node-zk-config-provider@5.0.0-beta.6
#   @midnight-ntwrk/midnight-js-types@5.0.0-beta.6
#
# usage: loader-verify.sh <keygen-out-name> [circuitId]
set -euo pipefail

name="${1:?usage: loader-verify.sh <keygen-out-name> [circuitId]}"
circuit="${2:-execute}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node_image="node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e"
volume="aa00010_parity_work"
artifacts="$repo_root/harness/generated-00010/$name/manager"
container="aa00010-loader-verify"

test -d "$artifacts/keys" || { echo "no keys/ under $artifacts" >&2; exit 66; }

port="$(bash "$repo_root/scripts/00010/free-port.sh")"

cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo "LOADER_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ARTIFACTS=$artifacts"
echo "MARKER_PORT=$port"
echo "BOUNDS=cpus:4,memory:20g,memory-swap:20g,network:none"
echo "NODE_IMAGE=$node_image"
echo "PINNED_LOADER_PACKAGES=@midnight-ntwrk/midnight-js-node-zk-config-provider@5.0.0-beta.6,@midnight-ntwrk/midnight-js-types@5.0.0-beta.6"

# `--max-old-space-size` is deliberately NOT raised: the point is that the key fits the loader's
# ordinary behaviour, not that it can be forced through with a tuned heap.
/usr/bin/time -p docker run --rm --network none \
  --name "$container" --cpus 4 --memory 20g --memory-swap 20g \
  -e AA00010_PORT="$port" \
  -v "$volume:/work" \
  -v "$artifacts:/artifacts:ro" \
  -v "$repo_root/scripts/00010/loader-verify.mjs:/work/harness/loader-verify.mjs:ro" \
  -w /work/harness \
  "$node_image" \
  node loader-verify.mjs /artifacts "$circuit"
loader_exit=$?

echo "LOADER_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "LOADER_EXIT=$loader_exit"
exit "$loader_exit"
