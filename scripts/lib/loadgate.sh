#!/usr/bin/env bash
# Shared-host LOAD GATE — 00006, adopted by Plan 02 from Plan 01's spike-S2 remediation.
#
# WHY THIS EXISTS. G1 run 1 was VOIDed, not failed: this shared host's 1-minute load average reached
# 21.7 on 16 cores because of other tenants, one proving attempt took 12.5 minutes where the previous
# six took ~24 s each, and the next died with
#   'prove' returned an error: AbortError: The user aborted a request.
# A proof-server abort under host starvation is evidence about the HOST, not about the ledger — and in
# an evidence table it is indistinguishable from a node refusal. That is the whole reason it is worth a
# gate rather than a retry.
#
# Plan 01's finding says any spike that counts accept/refuse ratios must gate on load. Plan 02's spikes
# are the same kind of measurement, and S5's timing arms are additionally sensitive to wall-clock: a
# starved host can turn "the offer was still good after 60 s" into "after 400 s" without anyone
# noticing. So the gate runs once before the live spikes begin.
#
# SCOPE: it only WAITS. It changes nothing about the host, kills nothing, and asserts nothing about the
# lane. Like W-1 and W-2 it is a host accommodation, never a lane property.

set -euo pipefail

# loadgate_cores — physical core count, used as the load ceiling.
loadgate_cores() { sysctl -n hw.ncpu 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4; }

# loadgate_load1 — the 1-minute load average, as an integer (rounded down).
loadgate_load1() {
  # `uptime` prints e.g. "load averages: 2.39 2.86 3.43" on macOS, "load average: 2.39, ..." on Linux.
  uptime | sed -E 's/.*load averages?:? *//; s/,/ /g' | awk '{ printf "%d\n", $1 }'
}

# loadgate_wait [timeout-seconds] — block until 1-min load <= core count, or give up and say so.
#
# Giving up is deliberate: this host is shared, and a gate that waited forever for a quiet moment
# would simply never finish. Proceeding under load is recorded in the step output so a later reader can
# see it was a possibility, and each spike still classifies its own aborts as VOID rather than refused.
loadgate_wait() {
  local timeout="${1:-900}" cores load waited=0
  cores="$(loadgate_cores)"
  load="$(loadgate_load1)"
  echo "load gate: 1-min load ${load}, ${cores} cores (ceiling ${cores})"
  while [ "$load" -gt "$cores" ]; do
    if [ "$waited" -ge "$timeout" ]; then
      echo "load gate: still ${load} on ${cores} cores after ${waited}s — PROCEEDING ANYWAY and recording it."
      echo "load gate: any proof-server abort from here is to be read as VOID (host), not as a refusal."
      return 0
    fi
    echo "load gate: ${load} > ${cores}; waiting 30s (waited ${waited}s of ${timeout}s)"
    sleep 30
    waited=$((waited + 30))
    load="$(loadgate_load1)"
  done
  echo "load gate: PASSED — 1-min load ${load} <= ${cores} cores after ${waited}s"
}
