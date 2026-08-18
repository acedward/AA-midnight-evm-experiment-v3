#!/usr/bin/env bash
# G3 diagnostic probe wrapper — 00004-multi-token-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# NOT a gate. This boots one disposable stack and runs `harness/src/g3/probe-mixed.ts`, which asks
# exactly one question: WHY does the spec's step-13 shape get refused by the node with
# `1010: Invalid Transaction: Custom error: 223`? See that file's header for the shapes it tries and
# how to read the result.
#
# It exists so the question can be answered in one short run rather than by re-running the whole G3
# gate, and so decision D-102 is settled from observations rather than from the hypothesis that
# motivated the probe. Same shared-host rules as the gates: unique compose project, verified-free
# ports above 10000, teardown always, residue asserted.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"

# Which probe to run. Round 1 (`probe-mixed.ts`) asked whether the composition was the problem;
# round 2 (`probe-merge.ts`) asks whether the pool MERGE is. Override with PROBE_MODULE.
PROBE_MODULE="${PROBE_MODULE:-src/g3/probe-mixed.ts}"
PROBE_NAME="$(basename "$PROBE_MODULE" .ts)"

EVID="$ROOT/evidence/g3-ledger/probe-${PROBE_NAME#probe-}"
fs_init "G3-PROBE" "$EVID" "$@"

PROJECT="aa00004-g3probe-$(date -u +%Y%m%d%H%M%S)-$$"
COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT}"

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }
step_boot()        { "${COMPOSE[@]}" up -d; }
step_health()      { stack_health "$ROOT"; }
step_probe()       { (cd "$ROOT/harness" && npx tsx "$PROBE_MODULE"); }

echo "[G3-PROBE] EXPERIMENTAL_LANE / LANE-DEV-1 — diagnosing the step-13 node refusal (${PROBE_MODULE})"
echo "[G3-PROBE] compose project: ${PROJECT}"
fs_run 01-probe-ports step_probe_ports
fs_run 02-boot        step_boot
fs_run 03-health      step_health
fs_run 04-probe       step_probe

echo "[G3-PROBE] done; teardown runs next"
