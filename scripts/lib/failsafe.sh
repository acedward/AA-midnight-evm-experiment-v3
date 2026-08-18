#!/usr/bin/env bash
# Shared fail-safe gate-wrapper helpers for 00003-contract-token-custody.
#
# Contract (master plan "Testing and evidence policy"):
#   - record exact argv / cwd / UTC timestamps and input commit+image hashes before each command
#   - record duration / exit code and run-relative evidence links after
#   - `set -euo pipefail`, EXIT/INT/TERM traps
#   - a capture or teardown failure REPLACES an otherwise-zero result
#
# Source this, then call fs_init <gate> <evidence-dir>.

set -euo pipefail

fs_utc()   { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
fs_epoch() { date -u +%s; }

# Globals set by fs_init
FS_GATE=""; FS_EVIDENCE_DIR=""; FS_RUN_LOG=""; FS_STATUS=1; FS_TEARDOWN_HOOK=""

fs_init() {
  FS_GATE="$1"; FS_EVIDENCE_DIR="$2"
  mkdir -p "$FS_EVIDENCE_DIR"
  FS_RUN_LOG="$FS_EVIDENCE_DIR/run.log"
  : > "$FS_RUN_LOG"
  {
    echo "# ${FS_GATE} run log"
    echo "started_utc: $(fs_utc)"
    echo "argv: $0 ${*:3}"
    echo "cwd: $(pwd)"
    echo "host: $(uname -sm)"
    echo "docker: $(docker --version 2>&1)"
    echo "compose: $(docker compose version --short 2>&1)"
    echo "label: EXPERIMENTAL_LANE"
  } >> "$FS_RUN_LOG"
  trap 'fs_on_exit' EXIT
  trap 'echo "[${FS_GATE}] INTERRUPTED" >&2; exit 130' INT TERM
}

# fs_run <step-name> <command...>  — records argv/cwd/UTC, duration, exit code.
fs_run() {
  local name="$1"; shift
  local start end rc out
  out="$FS_EVIDENCE_DIR/${name}.out"
  start=$(fs_epoch)
  {
    echo "--- step: ${name}"
    echo "    utc_start: $(fs_utc)"
    echo "    cwd: $(pwd)"
    echo "    argv: $*"
  } >> "$FS_RUN_LOG"

  set +e
  "$@" > "$out" 2>&1
  rc=$?
  set -e
  end=$(fs_epoch)

  {
    echo "    utc_end: $(fs_utc)"
    echo "    duration_s: $((end - start))"
    echo "    exit: ${rc}"
    echo "    output: $(basename "$out")"
  } >> "$FS_RUN_LOG"

  if [ "$rc" -ne 0 ]; then
    echo "[${FS_GATE}] STEP FAILED: ${name} (exit ${rc})" >&2
    sed -n '1,60p' "$out" >&2 || true
    return "$rc"
  fi
  echo "[${FS_GATE}] ok: ${name} ($((end - start))s)"
  return 0
}

# Register a teardown command run on EXIT. Teardown failure forces a nonzero result.
fs_set_teardown() { FS_TEARDOWN_HOOK="$*"; }

fs_on_exit() {
  local rc=$?
  local teardown_rc=0
  if [ -n "$FS_TEARDOWN_HOOK" ]; then
    echo "[${FS_GATE}] teardown: ${FS_TEARDOWN_HOOK}"
    {
      echo "--- teardown"
      echo "    utc: $(fs_utc)"
      echo "    argv: ${FS_TEARDOWN_HOOK}"
    } >> "$FS_RUN_LOG"
    set +e
    eval "$FS_TEARDOWN_HOOK" >> "$FS_EVIDENCE_DIR/teardown.out" 2>&1
    teardown_rc=$?
    set -e
    echo "    exit: ${teardown_rc}" >> "$FS_RUN_LOG"
    if [ "$teardown_rc" -ne 0 ]; then
      echo "[${FS_GATE}] TEARDOWN FAILED (exit ${teardown_rc}) — run is NOT green" >&2
    fi
  fi
  # Teardown failure replaces an otherwise-zero result.
  if [ "$rc" -eq 0 ] && [ "$teardown_rc" -ne 0 ]; then rc="$teardown_rc"; fi
  {
    echo "finished_utc: $(fs_utc)"
    echo "final_exit: ${rc}"
  } >> "$FS_RUN_LOG"
  if [ "$rc" -eq 0 ]; then
    echo "[${FS_GATE}] GREEN"
  else
    echo "[${FS_GATE}] RED (exit ${rc})" >&2
  fi
  trap - EXIT
  exit "$rc"
}
