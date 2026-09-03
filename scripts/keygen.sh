#!/usr/bin/env bash
#
# keygen.sh — generate the Manager's proving and verifying keys.
#
# READ THIS BEFORE RUNNING IT. This is the only command in the repository that produces key
# material, and it is the expensive one: on the reference machine (4 CPU / 20 GiB cap) it takes
# ~155 s of wall time at ~2.1 GiB peak, and it writes about 1.2 GB of keys — `execute.prover` alone
# is 1,141,041,759 bytes. Nothing here is committed; `tests/generated/` is gitignored.
#
# WHEN YOU NEED IT
#   Only to PROVE or DEPLOY. The simulation tier and CI never touch a key: they execute circuits in
#   the runtime's simulator. If all you want is a green build, use scripts/test-sim.sh.
#
# WHEN YOU MUST REGENERATE
#   Whenever `contracts/manager.compact` changes in a way that changes any `.zkir`. A key set is
#   bound to the exact circuit it was generated from. Note that comment-only edits do NOT change
#   the ZKIRs, so they do not invalidate keys; changing a domain-separator string DOES. A COMPILER
#   BUMP DOES TOO: the 0.33.0 -> 0.34.0 upgrade changes ZKIR bytes, so every key generated before
#   it is invalid and a deployed contract must be re-keyed and redeployed.
#
# TOOLCHAIN
#   Compiler 0.34.0 / language 0.26.0, obtained and verified by scripts/toolchain.sh.
#
# THE SRS — THE ONE THING THAT NEEDS THE NETWORK
#   Unlike `--skip-zk` compilation and `mock-compile` measurement, key generation needs the
#   universal KZG structured reference string `bls_midnight_2p<k>` for every distinct circuit k.
#   On a cold cache `zkir` fetches it from $MIDNIGHT_PARAM_SOURCE (default
#   https://srs.midnight.network/), so key generation CANNOT run inside a `--network none`
#   container without it.
#
#   This script keeps the generation container offline and mounts a pre-fetched parameter
#   directory instead. Fetch it ONCE into tests/generated/zk-params/ (gitignored), record the file
#   sizes and SHA-256 hashes, and reuse it; never silently re-fetch. The pinned set for this
#   contract is k = 8, 9, 13, 16, 19, totalling 114,968,468 bytes:
#
#     bls_midnight_2p8   bls_midnight_2p9   bls_midnight_2p13   bls_midnight_2p16   bls_midnight_2p19
#
#   The tool verifies each parameter file against its own built-in expected hash, so a substituted
#   file is rejected by the compiler itself, not merely by bookkeeping. If the directory is absent
#   this script says so and refuses rather than quietly opening the network.
#
# usage: scripts/keygen.sh [--allow-network]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The pinned toolchain (compiler 0.34.0, language 0.26.0) and `ensure_image`.
# shellcheck source=scripts/toolchain.sh
. "$repo_root/scripts/toolchain.sh"
out_dir="$repo_root/tests/generated/manager-keys"
params_dir="$repo_root/tests/generated/zk-params"
container="aa-keygen-$$"
timeout_seconds="${KEYGEN_TIMEOUT_SECONDS:-7200}"
cpus="${KEYGEN_CPUS:-4}"
memory="${KEYGEN_MEMORY:-20g}"

allow_network=0
[ "${1:-}" = "--allow-network" ] && allow_network=1

# Refuse to overwrite an existing key set: keys are expensive and somebody may be mid-deployment
# against them. Delete the directory deliberately if you really mean to regenerate.
if [ -e "$out_dir" ]; then
  echo "REFUSING: $out_dir already exists." >&2
  echo "A key set is bound to the circuit it was generated from. If you mean to replace it," >&2
  echo "remove that directory deliberately: rm -rf $out_dir" >&2
  exit 97
fi

net=(--network none)
params_mount=()
if [ -d "$params_dir" ]; then
  params_mount=(-v "$params_dir:/params" -e MIDNIGHT_PP=/params)
  echo "MIDNIGHT_PP=/params (pre-fetched; the container stays offline)"
  echo "SRS_INVENTORY:"
  for f in "$params_dir"/bls_midnight_2p*; do
    [ -e "$f" ] || continue
    printf '  %-22s %12s  %s\n' "$(basename "$f")" "$(wc -c < "$f" | tr -d ' ')" "$(shasum -a 256 "$f" | cut -d ' ' -f 1)"
  done
elif [ "$allow_network" -eq 1 ]; then
  net=()
  echo "NO PRE-FETCHED SRS — running WITH network access so zkir can fetch from"
  echo "\${MIDNIGHT_PARAM_SOURCE:-https://srs.midnight.network/}. Save $params_dir afterwards and"
  echo "record the hashes, so the next run can stay offline."
else
  echo "REFUSING: no SRS parameters at $params_dir and --allow-network was not given." >&2
  echo "Key generation needs bls_midnight_2p{8,9,13,16,19}. Either restore the pinned directory," >&2
  echo "or re-run with --allow-network to fetch it once." >&2
  exit 98
fi

mkdir -p "$out_dir"

cleanup() {
  kill "${watchdog:-}" >/dev/null 2>&1 || true
  wait "${watchdog:-}" >/dev/null 2>&1 || true
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "KEYGEN_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "SOURCE=contracts/manager.compact"
echo "SOURCE_SHA256=$(shasum -a 256 "$repo_root/contracts/manager.compact" | cut -d ' ' -f 1)"
echo "GIT_HEAD=$(git -C "$repo_root" rev-parse HEAD)"
echo "GIT_DIRTY_FILES=$(git -C "$repo_root" status --porcelain | wc -l | tr -d ' ')"
echo "BOUNDS=cpus:$cpus,memory:$memory,wall-seconds:$timeout_seconds,network:${net[*]:-default}"
ensure_image

( sleep "$timeout_seconds"; docker inspect "$container" >/dev/null 2>&1 && docker kill "$container" >/dev/null 2>&1 ) >/dev/null 2>&1 &
watchdog=$!

rc=0
/usr/bin/time -p docker run --rm ${net[@]+"${net[@]}"} \
  --name "$container" --cpus "$cpus" --memory "$memory" --memory-swap "$memory" \
  ${params_mount[@]+"${params_mount[@]}"} \
  -v "$repo_root/contracts:/work/contracts:ro" -v "$out_dir:/out" -w /work \
  "$COMPACTC_IMAGE" \
  compactc --feature-zkir-v3 /work/contracts/manager.compact /out || rc=$?

kill "$watchdog" >/dev/null 2>&1 || true
wait "$watchdog" >/dev/null 2>&1 || true
watchdog=""

echo "KEYGEN_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "KEYGEN_EXIT=$rc"
if [ "$rc" -eq 0 ]; then
  echo "KEY_INVENTORY (bytes, sha256, path):"
  find "$out_dir" \( -name '*.prover' -o -name '*.verifier' \) -print0 | sort -z |
    while IFS= read -r -d '' f; do
      printf '  %12s  %s  %s\n' "$(wc -c < "$f" | tr -d ' ')" "$(shasum -a 256 "$f" | cut -d ' ' -f 1)" "${f#"$out_dir"/}"
    done
  echo "NEXT: scripts/verify-loader.sh — confirms the prover key reads through the pinned Node loader."
fi
exit "$rc"
