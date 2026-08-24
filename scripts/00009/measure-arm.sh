#!/usr/bin/env bash
# 00009 — pinned `zkir-v3 mock-compile` K/rows measurement of one already-compiled arm.
#
# MEASUREMENT-ONLY. `mock-compile` reports (k, rows) and writes a transient BZKIR;
# it never generates a prover or verifier key.
#
# usage: measure-arm.sh <arm-name> <confirmed-free-marker-port> [circuit=execute] [timeout-seconds=900]
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 4 ]; then
  echo "usage: $0 <arm> <marker-port> [circuit] [timeout-seconds]" >&2
  exit 64
fi

arm="$1"
marker_port="$2"
circuit="${3:-execute}"
timeout_seconds="${4:-900}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image="aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b"
zkir_dir="$repo_root/harness/generated-00009/$arm/manager/zkir"
input_zkir="$zkir_dir/$circuit.zkir"
output_bzkir="$zkir_dir/$circuit.bzkir"
container="aa00009-measure-${arm}"

test -f "$input_zkir"
rm -f "$output_bzkir"

if lsof -nP -iTCP:"$marker_port" -sTCP:LISTEN >/dev/null 2>&1 || \
   nc -z 127.0.0.1 "$marker_port" >/dev/null 2>&1; then
  echo "marker port is busy: $marker_port" >&2
  exit 98
fi

watchdog_flag="$(mktemp -t aa00009-measure-watchdog)"
rm -f "$watchdog_flag"

cleanup() {
  kill "${watchdog_pid:-}" >/dev/null 2>&1 || true
  wait "${watchdog_pid:-}" >/dev/null 2>&1 || true
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -f "$watchdog_flag" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "MEASURE_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ARM=$arm"
echo "CIRCUIT=$circuit"
echo "MARKER_PORT=$marker_port"
echo "BOUNDS=cpus:2,memory:8g,memory-swap:8g,rayon:2,wall-seconds:$timeout_seconds,network:none"
echo "IMAGE=$image"
echo "ZKIR_BYTES=$(wc -c < "$input_zkir" | tr -d ' ')"
echo "ZKIR_SHA256=$(shasum -a 256 "$input_zkir" | cut -d ' ' -f 1)"

# The watchdog must NOT inherit this script's stdout/stderr: a background writer keeps a
# consuming pipe open for its whole sleep, which would stall any caller reading our output.
(
  sleep "$timeout_seconds"
  if docker inspect "$container" >/dev/null 2>&1; then
    : > "$watchdog_flag"
    docker kill "$container" >/dev/null 2>&1 || true
  fi
) >/dev/null 2>&1 &
watchdog_pid=$!

set +e
/usr/bin/time -p docker run --rm --network none \
  --name "$container" --cpus 2 --memory 8g --memory-swap 8g \
  -e RAYON_NUM_THREADS=2 -e AA00009_PORT="$marker_port" \
  -v "$zkir_dir:/measure" -w /measure \
  "$image" /opt/compactc/zkir-v3 mock-compile "$circuit.zkir"
measure_exit=$?
set -e

kill "$watchdog_pid" >/dev/null 2>&1 || true
wait "$watchdog_pid" >/dev/null 2>&1 || true
watchdog_pid=""

echo "MEASURE_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "MEASURE_EXIT=$measure_exit"
echo "WATCHDOG_TIMEOUT=$( [ -e "$watchdog_flag" ] && echo 1 || echo 0 )"
if [ "$measure_exit" -eq 0 ]; then
  test -s "$output_bzkir"
  echo "BZKIR_BYTES=$(wc -c < "$output_bzkir" | tr -d ' ')"
  echo "BZKIR_SHA256=$(shasum -a 256 "$output_bzkir" | cut -d ' ' -f 1)"
fi
echo "KEY_FILES=$(find "$repo_root/harness/generated-00009" -name '*.prover' -o -name '*.verifier' | wc -l | tr -d ' ')"
exit "$measure_exit"
