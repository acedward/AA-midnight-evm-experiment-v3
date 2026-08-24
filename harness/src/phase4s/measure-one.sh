#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <candidate> <confirmed-free-marker-port>" >&2
  exit 64
fi

candidate="$1"
marker_port="$2"
case "$candidate" in
  registerNativeAccount|registerEvmAccount|withdrawShieldedAuthorized|withdrawUnshieldedAuthorized|transferShieldedAuthorized|transferUnshieldedAuthorized|openSwapShieldedAuthorized) ;;
  *)
    echo "unknown Phase 4S candidate: $candidate" >&2
    exit 65
    ;;
esac

phase4s_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
zkir_dir="$phase4s_root/harness/generated-phase4s/compile-u2/manager/zkir"
input_zkir="$zkir_dir/$candidate.zkir"
output_bzkir="$zkir_dir/$candidate.bzkir"
image="aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b"
safe_candidate="$(printf '%s' "$candidate" | tr '[:upper:]' '[:lower:]')"
container="aa00008-phase4s-measure-${safe_candidate}"
timeout_seconds=600

test -f "$input_zkir"
test ! -e "$output_bzkir"
if lsof -nP -iTCP:"$marker_port" -sTCP:LISTEN >/dev/null 2>&1 || \
   nc -z 127.0.0.1 "$marker_port" >/dev/null 2>&1; then
  echo "marker port is busy: $marker_port" >&2
  exit 98
fi

cleanup() {
  kill "${watchdog_pid:-}" >/dev/null 2>&1 || true
  wait "${watchdog_pid:-}" >/dev/null 2>&1 || true
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "MEASURE_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "CANDIDATE=$candidate"
echo "MARKER_PORT=$marker_port"
echo "BOUNDS=cpus:2,memory:8g,memory-swap:8g,rayon:2,wall-seconds:$timeout_seconds,network:none"
echo "IMAGE=$image"
echo "INPUT_ZKIR=$input_zkir"

(
  sleep "$timeout_seconds"
  if docker inspect "$container" >/dev/null 2>&1; then
    echo "WATCHDOG_TIMEOUT=1" >&2
    docker kill "$container" >/dev/null 2>&1 || true
  fi
) &
watchdog_pid=$!

set +e
/usr/bin/time -lp docker run --rm --network none \
  --name "$container" --cpus 2 --memory 8g --memory-swap 8g \
  -e RAYON_NUM_THREADS=2 -e PHASE4S_PORT="$marker_port" \
  -v "$zkir_dir:/measure" -w /measure \
  "$image" /opt/compactc/zkir-v3 mock-compile "$candidate.zkir"
measure_exit=$?
set -e

kill "$watchdog_pid" >/dev/null 2>&1 || true
wait "$watchdog_pid" >/dev/null 2>&1 || true
watchdog_pid=""

echo "MEASURE_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "MEASURE_EXIT=$measure_exit"
if [ "$measure_exit" -eq 0 ]; then
  test -s "$output_bzkir"
fi
exit "$measure_exit"
