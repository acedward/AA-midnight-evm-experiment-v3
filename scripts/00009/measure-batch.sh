#!/usr/bin/env bash
# 00009 — measure a list of already-compiled arms, never more than TWO at a time.
#
# usage: measure-batch.sh <arm> [<arm> ...]
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
raw_dir="$repo_root/evidence/00009-circuit-weight/raw"
mkdir -p "$raw_dir"

run_one() {
  local arm="$1"
  local port
  port="$(bash "$repo_root/scripts/00009/free-port.sh")"
  bash "$repo_root/scripts/00009/measure-arm.sh" "$arm" "$port" execute 900 \
    > "$raw_dir/$arm.measure.log" 2>&1
  echo "$arm exit=$? $(grep -o 'k=[0-9]*, rows=[0-9]*' "$raw_dir/$arm.measure.log" || echo 'NO-RESULT')"
}

pending=("$@")
while [ "${#pending[@]}" -gt 0 ]; do
  a="${pending[0]}"
  b="${pending[1]:-}"
  if [ -n "$b" ]; then
    run_one "$a" & p1=$!
    run_one "$b" & p2=$!
    wait "$p1"; wait "$p2"
    pending=("${pending[@]:2}")
  else
    run_one "$a"
    pending=()
  fi
done
