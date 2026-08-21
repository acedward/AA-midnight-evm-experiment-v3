#!/usr/bin/env bash
# G5 SMOKE — the smallest live run that exercises every wiring path the full gate depends on.
#
# Not a gate and not evidence: a wiring check. The full G5 matrix is hours of stack time, and the
# expensive failures are all cheap to find — a variant that will not deploy, a chain-parameter fetch
# that returns nothing, an account id derived the wrong way, arm (e)'s staging transaction refusing.
# This runs the SHIPPED baseline and the structurally most different arm at one and two cells, which
# touches all of it in ~15 minutes.
#
# Same shared-host discipline as a gate: W-1, W-2, unique compose project, verified-free ports above
# 10000 bound to 127.0.0.1, teardown asserted, nothing left running.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/nosleep.sh
source "$ROOT/scripts/lib/nosleep.sh"
nosleep_reexec "${BASH_SOURCE[0]}" "$@"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/docker-w1.sh
source "$ROOT/scripts/lib/docker-w1.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"
# shellcheck source=../lib/loadgate.sh
source "$ROOT/scripts/lib/loadgate.sh"

CELLS="${G5_CELLS:-1,2}"
VARIANTS_ARG="${G5_VARIANTS:-manager,arm-e-escrow}"

EVID="$ROOT/evidence/g5-smoke"
fs_init "G5-SMOKE" "$EVID" "smoke"

PROJECT="aa00006-g5smoke-$(date -u +%Y%m%d%H%M%S)-$$"
COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")
fs_set_teardown "stack_teardown '$ROOT' '$PROJECT'"

H() { (cd "$ROOT/harness" && "$@"); }

step_w1()          { w1_enable "$ROOT"; }
step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }
step_pull()        { "${COMPOSE[@]}" pull; }
step_boot()        { "${COMPOSE[@]}" up -d; }
step_health()      { stack_health "$ROOT"; }
step_loadgate()    { loadgate_wait 900; }
step_matrix()      { H npx tsx src/g5/matrix.ts --cells "$CELLS" --variants "$VARIANTS_ARG"; }

echo "[G5-SMOKE] compose project: ${PROJECT}"
echo "[G5-SMOKE] variants: ${VARIANTS_ARG}   cells: ${CELLS}"
fs_run 01-w1          step_w1
fs_run 02-probe-ports step_probe_ports
fs_run 03-pull        step_pull
fs_run 04-boot        step_boot
fs_run 05-health      step_health
fs_run 06-loadgate    step_loadgate
fs_run 07-matrix      step_matrix
echo "[G5-SMOKE] wiring exercised; teardown runs next and must also succeed"
