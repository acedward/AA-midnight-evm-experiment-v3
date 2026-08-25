#!/usr/bin/env bash
# 00009 Phase 4 — measure SEVERAL circuits of ONE already-compiled arm, serially.
#
# `measure-arm.sh` names its container after the arm alone, so two circuits of the same arm
# cannot run concurrently without a name collision. Phase 4.1's eight non-`execute` circuits
# are tiny (945 B - 17 KB ZKIRs), so this driver runs them one at a time: well inside the
# "at most two concurrent measurements" cap, and free of any collision.
#
# MEASUREMENT-ONLY. `mock-compile` reports (k, rows); it never generates a key.
#
# usage: measure-circuits.sh <arm> <circuit> [<circuit> ...]
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <arm> <circuit> [<circuit> ...]" >&2
  exit 64
fi

arm="$1"; shift
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
raw_dir="$repo_root/evidence/00009-circuit-weight/raw"
mkdir -p "$raw_dir"

status=0
for circuit in "$@"; do
  port="$(bash "$repo_root/scripts/00009/free-port.sh")"
  log="$raw_dir/$arm.$circuit.measure.log"
  bash "$repo_root/scripts/00009/measure-arm.sh" "$arm" "$port" "$circuit" 900 > "$log" 2>&1
  rc=$?
  [ "$rc" -eq 0 ] || status=1
  echo "$arm/$circuit exit=$rc $(grep -o 'k=[0-9]*, rows=[0-9]*' "$log" || echo 'NO-RESULT')"
done
exit "$status"
