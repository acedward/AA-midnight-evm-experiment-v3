#!/usr/bin/env bash
#
# measure-k.sh — report the proof-system size (k) and constraint-row count of a compiled circuit.
#
# WHY IT MATTERS
#   `k` is the log2 of the circuit's constraint domain, and it decides the PROVING KEY SIZE. The
#   Manager's `execute` circuit sits at k=19 / 382,770 rows, i.e. 141,518 rows (27%) under the
#   2^19 = 524,288 ceiling. That margin is not cosmetic: at k=20 the generated `execute.prover` is
#   2,282,126,073 bytes and the pinned Node loader REFUSES it outright with
#   `ERR_FS_FILE_TOO_LARGE` (Node cannot `readFile` more than 2 GiB into one Buffer). At k=19 the
#   same key is 1,141,041,759 bytes and loads. So k=19 is a hard product requirement, and this is
#   the command that checks it.
#
# WHAT IT RUNS
#   `zkir-v3 mock-compile` from the pinned toolchain image, on an already-compiled `.zkir`.
#   MEASUREMENT ONLY: it reports (k, rows) and writes a throwaway `.bzkir` beside the input.
#   It never generates a proving or verifying key, and it needs no SRS and no network.
#
# TOOLCHAIN
#   Compiler 0.34.0 / language 0.26.0, obtained and verified by scripts/toolchain.sh — the same
#   image that produced the `.zkir` being measured. Measuring one compiler's output with another
#   compiler's `zkir-v3` is meaningless, so this script goes through the same pin as compile.sh.
#
# usage: scripts/measure-k.sh [circuit] [target]
#        circuit  default `execute`; any name under tests/generated/<target>/zkir/
#        target   default `manager`
#
# example: scripts/compile.sh manager && scripts/measure-k.sh execute
set -euo pipefail

circuit="${1:-execute}"
target="${2:-manager}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The pinned toolchain (compiler 0.34.0, language 0.26.0) and `ensure_image`.
# shellcheck source=scripts/toolchain.sh
. "$repo_root/scripts/toolchain.sh"
timeout_seconds="${MEASURE_TIMEOUT_SECONDS:-900}"

zkir_dir="$repo_root/tests/generated/$target/zkir"
input="$zkir_dir/$circuit.zkir"
container="aa-measure-$target-$circuit-$$"

test -f "$input" || {
  echo "no compiled circuit at $input" >&2
  echo "run: scripts/compile.sh $target" >&2
  exit 66
}
rm -f "$zkir_dir/$circuit.bzkir"

ensure_image

echo "TARGET=$target"
echo "CIRCUIT=$circuit"
echo "ZKIR_BYTES=$(wc -c < "$input" | tr -d ' ')"
echo "ZKIR_SHA256=$(shasum -a 256 "$input" | cut -d ' ' -f 1)"
echo "BOUNDS=cpus:2,memory:8g,memory-swap:8g,rayon:2,wall-seconds:$timeout_seconds,network:none"

# Hard wall bound; must not inherit stdout/stderr (see scripts/compile.sh for why).
(
  sleep "$timeout_seconds"
  docker inspect "$container" >/dev/null 2>&1 && docker kill "$container" >/dev/null 2>&1
) >/dev/null 2>&1 &
watchdog=$!

rc=0
docker run --rm --network none --name "$container" \
  --cpus 2 --memory 8g --memory-swap 8g -e RAYON_NUM_THREADS=2 \
  -v "$zkir_dir:/measure" -w /measure \
  "$COMPACTC_IMAGE" /opt/compactc/zkir-v3 mock-compile "$circuit.zkir" || rc=$?

kill "$watchdog" >/dev/null 2>&1 || true
wait "$watchdog" >/dev/null 2>&1 || true

echo "MEASURE_EXIT=$rc"
keys="$(find "$repo_root/tests/generated" \( -name '*.prover' -o -name '*.verifier' \) 2>/dev/null | wc -l | tr -d ' ')"
echo "KEY_FILES=$keys"
exit "$rc"
