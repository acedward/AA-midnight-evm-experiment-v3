#!/usr/bin/env bash
# 00010 Phase 5 — the SINGLE bounded proving-key generation attempt.
#
# This is the ONLY command in this project that produces key material. It is gated: it must not run
# until the Phase 2 k gate and the Phase 3/4 security gates are all GREEN and the composed source is
# committed (the plan records that authorization check with the commit hash before this runs).
#
# EXACTLY ONE ATTEMPT. A bounded failure — OOM, watchdog kill, non-zero exit — is THIS PROJECT'S
# RECORDED RESULT for the attempt. There is no retry, and no unbounded re-run. If it fails, the
# verbatim log is the deliverable and the question goes back to the owner.
#
# Output is written under harness/generated-00010/ which is gitignored: keys are multi-GB and are
# NEVER committed. Their sizes and SHA-256 hashes are recorded in evidence instead.
#
# usage: keygen.sh <out-name> <source-path-relative-to-repo-root> <confirmed-free-marker-port>
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <out-name> <source-rel-path> <marker-port>" >&2
  exit 64
fi

name="$1"
src_rel="$2"
marker_port="$3"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image="aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b"
out_dir="$repo_root/harness/generated-00010/$name"
container="aa00010-keygen-${name}"
timeout_seconds=7200
cpus=4
memory=20g

test -f "$repo_root/$src_rel"
case "$src_rel" in
  contracts/*) ;;
  *) echo "source must live under contracts/: $src_rel" >&2; exit 65 ;;
esac

# HARD SINGLE-ATTEMPT GUARD: refuse to run if a previous attempt already produced output here.
if [ -e "$out_dir" ]; then
  echo "REFUSING: $out_dir already exists — this project authorizes exactly ONE keygen attempt." >&2
  echo "A previous attempt's result stands. Remove nothing; report it." >&2
  exit 97
fi

if lsof -nP -iTCP:"$marker_port" -sTCP:LISTEN >/dev/null 2>&1 || \
   nc -z 127.0.0.1 "$marker_port" >/dev/null 2>&1; then
  echo "marker port is busy: $marker_port" >&2
  exit 98
fi

mkdir -p "$out_dir"

watchdog_flag="$(mktemp -t aa00010-keygen-watchdog)"
rm -f "$watchdog_flag"

cleanup() {
  kill "${watchdog_pid:-}" >/dev/null 2>&1 || true
  wait "${watchdog_pid:-}" >/dev/null 2>&1 || true
  kill "${sampler_pid:-}" >/dev/null 2>&1 || true
  wait "${sampler_pid:-}" >/dev/null 2>&1 || true
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -f "$watchdog_flag" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "KEYGEN_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "NAME=$name"
echo "SOURCE=$src_rel"
echo "SOURCE_SHA256=$(shasum -a 256 "$repo_root/$src_rel" | cut -d ' ' -f 1)"
echo "GIT_HEAD=$(cd "$repo_root" && git rev-parse HEAD)"
echo "GIT_PORCELAIN_LINES=$(cd "$repo_root" && git status --porcelain | wc -l | tr -d ' ')"
echo "MARKER_PORT=$marker_port"
echo "BOUNDS=cpus:$cpus,memory:$memory,memory-swap:$memory,wall-seconds:$timeout_seconds,network:none"
echo "ATTEMPTS_AUTHORIZED=1"
echo "IMAGE=$image"
echo "DOCKER_VM_MEMTOTAL=$(docker info --format '{{.MemTotal}}')"
echo "KEY_FILES_BEFORE=$(find "$repo_root" -name '*.prover' -o -name '*.verifier' | wc -l | tr -d ' ')"

# Watchdog: hard wall bound. Never inherits stdout/stderr (a background writer would hold a
# consuming pipe open for the whole sleep).
(
  sleep "$timeout_seconds"
  if docker inspect "$container" >/dev/null 2>&1; then
    : > "$watchdog_flag"
    docker kill "$container" >/dev/null 2>&1 || true
  fi
) >/dev/null 2>&1 &
watchdog_pid=$!

# Live observation checkpoints: memory/CPU every 60 s, so an OOM or a stall is diagnosable from the
# log alone rather than needing a re-run.
(
  while true; do
    sleep 60
    if docker inspect "$container" >/dev/null 2>&1; then
      stat=$(docker stats --no-stream --format '{{.MemUsage}} cpu={{.CPUPerc}}' "$container" 2>/dev/null || true)
      [ -n "$stat" ] && echo "CHECKPOINT $(date -u +%H:%M:%SZ) $stat"
    else
      break
    fi
  done
) &
sampler_pid=$!

# SRS / public parameters.
#
# Key generation — unlike `--skip-zk` compilation and `mock-compile` measurement — needs the
# universal KZG structured reference string `bls_midnight_2p<k>` for each distinct circuit `k`.
# From a cold cache `zkir` fetches it from `$MIDNIGHT_PARAM_SOURCE` (default
# `https://srs.midnight.network/`), so a `--network none` container CANNOT generate keys: attempt 1
# of this project failed in 78 s for exactly that reason (recorded in the plan, question 00010-Q2).
#
# The parameters are therefore PRE-FETCHED once into a hash-recorded directory and mounted here, and
# THIS CONTAINER KEEPS `--network none`. `MIDNIGHT_PP` points the tool's data provider at that
# directory. The tool verifies each artifact against its own built-in expected hash, so a corrupted
# or substituted parameter file is rejected by the compiler itself, not merely by our records.
params_dir="$repo_root/harness/generated-00010/zk-params"
params_mount=()
if [ -d "$params_dir" ]; then
  params_mount=(-v "$params_dir:/params" -e MIDNIGHT_PP=/params)
  echo "MIDNIGHT_PP=/params (pre-fetched, network stays none)"
  echo "SRS_INVENTORY:"
  for f in "$params_dir"/bls_midnight_2p*; do
    printf '  %-22s %12s  %s\n' "$(basename "$f")" "$(wc -c < "$f" | tr -d ' ')" "$(shasum -a 256 "$f" | cut -d ' ' -f 1)"
  done
else
  echo "MIDNIGHT_PP=<absent> — no pre-fetched parameters; a cold cache CANNOT work under network:none"
fi

set +e
/usr/bin/time -p docker run --rm --network none \
  --name "$container" --cpus "$cpus" --memory "$memory" --memory-swap "$memory" \
  -e AA00010_PORT="$marker_port" \
  ${params_mount[@]+"${params_mount[@]}"} \
  -v "$repo_root/contracts:/work/contracts:ro" \
  -v "$out_dir:/out" \
  -w /work \
  "$image" \
  compactc --feature-zkir-v3 "/work/$src_rel" /out/manager
keygen_exit=$?
set -e

kill "$sampler_pid" >/dev/null 2>&1 || true
wait "$sampler_pid" >/dev/null 2>&1 || true
sampler_pid=""
kill "$watchdog_pid" >/dev/null 2>&1 || true
wait "$watchdog_pid" >/dev/null 2>&1 || true
watchdog_pid=""

echo "KEYGEN_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "KEYGEN_EXIT=$keygen_exit"
echo "WATCHDOG_TIMEOUT=$( [ -e "$watchdog_flag" ] && echo 1 || echo 0 )"
echo "OUT_DIR=$out_dir"
echo "OUT_TREE:"
find "$out_dir" -maxdepth 3 -type d | sed "s|$out_dir|.|" | sort | sed 's/^/  /'
echo "KEY_FILE_INVENTORY (bytes, sha256, path):"
find "$out_dir" \( -name '*.prover' -o -name '*.verifier' \) -print0 \
  | sort -z \
  | while IFS= read -r -d '' f; do
      printf '  %12s  %s  %s\n' "$(wc -c < "$f" | tr -d ' ')" "$(shasum -a 256 "$f" | cut -d ' ' -f 1)" "${f#"$out_dir"/}"
    done
echo "TOTAL_KEY_BYTES=$(find "$out_dir" \( -name '*.prover' -o -name '*.verifier' \) -exec wc -c {} + 2>/dev/null | tail -1 | awk '{print $1}')"
echo "KEY_FILES_OUTSIDE_GITIGNORED_PATH=$(find "$repo_root" -name '*.prover' -o -name '*.verifier' | grep -cv '^'"$repo_root"'/harness/generated-00010/' || true)"
exit "$keygen_exit"
