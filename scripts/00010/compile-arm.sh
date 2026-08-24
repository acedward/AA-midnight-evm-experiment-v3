#!/usr/bin/env bash
# 00010 — pinned skip-ZK compile of one arm.
#
# MEASUREMENT-ONLY. `--skip-zk` never generates a prover or verifier key.
#
# usage: compile-arm.sh <arm-name> <source-path-relative-to-repo-root> <confirmed-free-marker-port>
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <arm> <source-rel-path> <marker-port>" >&2
  exit 64
fi

arm="$1"
src_rel="$2"
marker_port="$3"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image="aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b"
out_dir="$repo_root/harness/generated-00010/$arm"
container="aa00010-compile-${arm}"
timeout_seconds=600

test -f "$repo_root/$src_rel"
case "$src_rel" in
  contracts/*) ;;
  *) echo "source must live under contracts/: $src_rel" >&2; exit 65 ;;
esac

if lsof -nP -iTCP:"$marker_port" -sTCP:LISTEN >/dev/null 2>&1 || \
   nc -z 127.0.0.1 "$marker_port" >/dev/null 2>&1; then
  echo "marker port is busy: $marker_port" >&2
  exit 98
fi

rm -rf "$out_dir"
mkdir -p "$out_dir"

watchdog_flag="$(mktemp -t aa00010-compile-watchdog)"
rm -f "$watchdog_flag"

cleanup() {
  kill "${watchdog_pid:-}" >/dev/null 2>&1 || true
  wait "${watchdog_pid:-}" >/dev/null 2>&1 || true
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -f "$watchdog_flag" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "COMPILE_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ARM=$arm"
echo "SOURCE=$src_rel"
echo "SOURCE_SHA256=$(shasum -a 256 "$repo_root/$src_rel" | cut -d ' ' -f 1)"
echo "MARKER_PORT=$marker_port"
echo "BOUNDS=cpus:2,memory:8g,memory-swap:8g,rayon:2,wall-seconds:$timeout_seconds,network:none"
echo "IMAGE=$image"

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
  -e RAYON_NUM_THREADS=2 -e AA00010_PORT="$marker_port" \
  -v "$repo_root/contracts:/work/contracts:ro" \
  -v "$out_dir:/out" \
  -w /work \
  "$image" \
  compactc --feature-zkir-v3 --skip-zk "/work/$src_rel" /out/manager
compile_exit=$?
set -e

kill "$watchdog_pid" >/dev/null 2>&1 || true
wait "$watchdog_pid" >/dev/null 2>&1 || true
watchdog_pid=""

echo "COMPILE_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "COMPILE_EXIT=$compile_exit"
echo "WATCHDOG_TIMEOUT=$( [ -e "$watchdog_flag" ] && echo 1 || echo 0 )"
echo "KEY_FILES=$(find "$out_dir" -name '*.prover' -o -name '*.verifier' | wc -l | tr -d ' ')"
if [ "$compile_exit" -eq 0 ]; then
  echo "ZKIR_CIRCUITS=$(ls "$out_dir/manager/zkir"/*.zkir 2>/dev/null | wc -l | tr -d ' ')"
  ls "$out_dir/manager/zkir"/*.zkir 2>/dev/null | xargs -n1 basename | sed 's/^/CIRCUIT=/'
fi
exit "$compile_exit"
