#!/usr/bin/env bash
# W-2 — HOST workaround: keep macOS awake for the duration of a gate. EXPERIMENTAL_LANE / LANE-DEV-1.
#
# THE FAULT (observed twice, not guessed): a G1 run was killed mid-step because this Mac idle-slept
# while the gate was running. Project 00005's G4 run 1 recorded the same failure mode ("the host slept
# mid-run"). A gate that takes 40+ minutes of mostly-waiting — proving, block production, indexer
# catch-up — presents almost no user activity, so the idle timer fires and the whole run dies at a
# random point. What comes back is not a clean failure: sockets to the node and proof server drop
# mid-request and the SDK reports whatever it happened to be doing, e.g. `'prove' returned an error:
# AbortError: The user aborted a request.` — which looks exactly like a real refusal in the evidence.
#
# THE WORKAROUND: re-exec the wrapper under `caffeinate -is`, which holds an idle-sleep assertion for
# the lifetime of the child process.
#
#   -i  prevent idle SLEEP
#   -s  prevent SYSTEM sleep while on AC power
#
# ITS EXACT SCOPE, and why it changes nothing this project asserts — the same shape as W-1:
#   - it is a PROCESS WRAPPER around the gate's own process tree. No system setting is written, no
#     `pmset` value is changed, and the assertion disappears the moment the gate exits, so every other
#     project and tenant on this shared host is unaffected;
#   - no pin, contract, wrapper step or piece of evidence is altered to accommodate it. It changes WHEN
#     the machine sleeps, not WHAT is executed or asserted;
#   - it is a HOST workaround, exactly like W-1 — NOT a lane property. Nothing about it may be read as
#     a statement about node, ledger, indexer or SDK behaviour.
#
# Source this, then call `nosleep_reexec "$0" "$@"` as one of the FIRST things the wrapper does —
# before `fs_init`, so the re-exec does not truncate a run log that the parent just created.
set -euo pipefail

# nosleep_reexec <script> [args...] — re-exec the script under `caffeinate -is`, once.
#
# Idempotent via AA_NOSLEEP=1, so the re-executed child does not loop. Degrades to a NOTICE (never a
# failure) where `caffeinate` does not exist — it is macOS-only, and a Linux CI host has no idle timer
# to defeat.
nosleep_reexec() {
  local script="$1"; shift
  if [ "${AA_NOSLEEP:-0}" = "1" ]; then
    echo "[W-2] already running under caffeinate (pid $$) — idle sleep is held off"
    return 0
  fi
  if ! command -v caffeinate >/dev/null 2>&1; then
    echo "[W-2] NOTICE: caffeinate not found on this host; continuing WITHOUT sleep protection." >&2
    echo "[W-2] If this host can idle-sleep, a long gate may die mid-step (00005 G4 run 1, 00006 G1 run 2)." >&2
    return 0
  fi
  echo "[W-2] re-exec under 'caffeinate -is' so this host cannot idle-sleep mid-gate"
  AA_NOSLEEP=1 exec caffeinate -is "$script" "$@"
}

# nosleep_note — one line for the evidence manifest.
nosleep_note() {
  if [ "${AA_NOSLEEP:-0}" = "1" ]; then
    echo "W-2 ACTIVE: this run executed under 'caffeinate -is' (idle+system sleep held off for the gate's process tree only)"
  else
    echo "W-2 INACTIVE: this run was NOT wrapped in caffeinate"
  fi
}
