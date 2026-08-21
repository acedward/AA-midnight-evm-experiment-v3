#!/usr/bin/env bash
# G5 gate wrapper — 00006-unbalanced-zswap Plan 05, the F-310 mitigation rig.
# EXPERIMENTAL_LANE / LANE-DEV-1.
#
# Runs Plan 05 end to end from nothing:
#
#   W-1 (scratch DOCKER_CONFIG) -> W-2 (caffeinate) -> probe ports -> lane INHERITED, hop by hop ->
#   LANE-DEV-1 -> compile the shipped contracts -> compile the SIX VARIANTS (fast) -> install ->
#   unit suites (00005's, 00006's, and the new G5 per-variant suite) -> typecheck ->
#   compile the variants WITH ZK -> OFFLINE DEPLOY COST per variant against the F-307 ceiling ->
#   OFFLINE PLACEMENT SWEEP (F-313) -> pull -> boot -> health -> load gate ->
#   LIVE MATRIX (baseline + control + five arms x custody sizes x both shapes) ->
#   re-run the offline sweep under the CHAIN's captured parameters -> CALIBRATION ->
#   U1 self-merge probe on stock v4 -> the winner end-to-end (U1 + U2) -> RANKING -> teardown
#
# GATE CONDITION, and where it deliberately differs from "everything must be GREEN":
#
#   * the offline half must pass outright: every fixture must COMPILE, the control and baseline must be
#     measurable, the unit suites and typecheck must be clean, and every variant must be costed UNDER
#     the F-307 deploy ceiling BEFORE anything is deployed;
#   * AN ARM THAT FAILS TO DEPLOY IS A RECORDED ARM VERDICT, NOT A GATE FAILURE. The gate fails on
#     rig/build/prove defects, or on a BASELINE that contradicts F-310 — because in that case nothing
#     else in the run is anchored;
#   * placement is MEASURED, not scored: a FALLIBLE reading is a result. The matrix is red only if an
#     offer failed to build for a reason that was not placement, which would mean the dose is reading
#     something other than what it claims;
#   * the end-to-end CLI names REQUIRED cases. Each must appear once, settle, carry no apparatus
#     error, and pass every check; a refusal is retained evidence but is RED for this selected gate;
#   * ranking receives exact current-run paths and a wrapper-derived run-start timestamp. Missing,
#     stale, corrupt, or contradictory inputs are RED; no directory scan chooses the winner.
#
# Fail-safe contract (inherited 00003 -> 00004 -> 00005 -> G1-G4): set -euo pipefail, EXIT/INT/TERM
# traps, argv/cwd/UTC before each step and duration/exit after, and a TEARDOWN FAILURE REPLACES an
# otherwise-zero result. Green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above 10000
# bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# W-2 before fs_init: the re-exec replaces this process, and doing it after would truncate the run log.
# shellcheck source=../lib/nosleep.sh
source "$ROOT/scripts/lib/nosleep.sh"
nosleep_reexec "${BASH_SOURCE[0]}" "$@"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/docker-w1.sh
source "$ROOT/scripts/lib/docker-w1.sh"
# shellcheck source=../lib/lane-pins.sh
source "$ROOT/scripts/lib/lane-pins.sh"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"
# shellcheck source=../lib/loadgate.sh
source "$ROOT/scripts/lib/loadgate.sh"

MODE="full"
CELLS="${G5_CELLS:-1,2,4,8,16}"
WINNER="${G5_WINNER:-arm-e-escrow}"
WINNER_CELLS="${G5_WINNER_CELLS:-4}"
VARIANTS_ARG="${G5_VARIANTS:-manager,v4-slim,arm-a-dedupe,arm-b-nested,arm-c-both,arm-d-unified,arm-e-escrow}"
while [ $# -gt 0 ]; do
  case "$1" in
    # Phase 1's whole deliverable: the fixtures compile, cost under the ceiling, pass the per-variant
    # suite, and the offline placement model ranks them. No stack needed.
    --offline) MODE="offline"; shift ;;
    --cells) CELLS="$2"; shift 2 ;;
    --variants) VARIANTS_ARG="$2"; shift 2 ;;
    --winner) WINNER="$2"; shift 2 ;;
    --winner-cells) WINNER_CELLS="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

EVID="$ROOT/evidence/g5-mitigation"
GATE=$([ "$MODE" = "offline" ] && echo "G5-OFFLINE" || echo "G5")

fs_init "$GATE" "$EVID" "$MODE"
RUN_STARTED_UTC="$(sed -n 's/^started_utc: //p' "$EVID/run.log" | head -1)"

PROJECT="aa00006-g5-$(date -u +%Y%m%d%H%M%S)-$$"
COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")
fs_set_teardown "stack_teardown '$ROOT' '$PROJECT'"

H() { (cd "$ROOT/harness" && "$@"); }

step_w1()           { w1_enable "$ROOT"; }
step_probe_ports()  { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }
step_lane_reuse()   { lane_assert_pins_unchanged "$ROOT"; }
step_lane_dev_1()   { compactc_verify_lane_dev_1 "$ROOT"; }
step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_compile_variants() { "$ROOT/scripts/g5/compile-variants.sh" --skip-zk; }
step_install()      { H pnpm install --frozen-lockfile; }
# 00005's suite and 00006's G1-G4 suites run UNCHANGED alongside the new G5 one, which is what keeps
# "the shipped Manager v4 is untouched" a fact about green files rather than a claim.
step_unit_suites()  { H npx vitest run; }
step_typecheck()    { "$ROOT/scripts/typecheck.sh"; }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }
step_compile_variants_zk() { "$ROOT/scripts/g5/compile-variants.sh" --zk; }

# EVERY variant is costed against the F-307 ceiling BEFORE anything is deployed. F-307 exists because a
# deploy that exceeds the block limits is refused with a message that names no dimension, and guessing
# is how a project deletes the wrong thing.
step_deploy_cost() {
  local names
  names="$(echo "$VARIANTS_ARG" | tr ',' ' ')"
  # shellcheck disable=SC2086
  H npx tsx src/g2/diag-deploy-cost.ts $names
}

# The offline placement model (F-313). Run FIRST with the ledger crate's defaults — which is a design
# instrument, not a lane fact — and again LATER under the chain's own captured parameters.
step_offline_sweep()  { H npx tsx src/g5/offline-sweep.ts --cells "$CELLS"; }
step_offline_sweep_chain() {
  if [ ! -f "$EVID/chain-params.json" ]; then
    echo "no chain-params.json — the live matrix did not capture the chain's parameters; skipping"
    return 0
  fi
  H npx tsx src/g5/offline-sweep.ts --cells "$CELLS" --params "$EVID/chain-params.json"
}
step_calibrate()      { H npx tsx src/g5/calibrate.ts; }

step_pull()     { "${COMPOSE[@]}" pull; }
step_boot()     { "${COMPOSE[@]}" up -d; }
step_health()   { stack_health "$ROOT"; }
step_loadgate() { loadgate_wait 900; }

step_live_matrix() { H npx tsx src/g5/matrix.ts --cells "$CELLS" --variants "$VARIANTS_ARG"; }

# Plan 05 Phase 2: U1 measured EXPLICITLY on the BASELINE at >=2 cells, with a 1-cell control beside it.
step_u1_probe() { H npx tsx src/g5/e2e.ts --variant manager --cells 2 --cases u1 --out u1-probe-v4; }

# Plan 05 Phase 3: the winner, both use cases, at >=4 custody cells.
step_winner_e2e() {
  H npx tsx src/g5/e2e.ts --variant "$WINNER" --cells "$WINNER_CELLS" --cases u1,u2 \
    --out "winner-${WINNER}-${WINNER_CELLS}c"
}

step_ranking() {
  local winner_evidence="$EVID/winner-${WINNER}-${WINNER_CELLS}c.json"
  H npx tsx src/g5/ranking.ts \
    --offline "$EVID/offline-sweep.json" \
    --matrix "$EVID/live-matrix.json" \
    --calibration "$EVID/calibration.json" \
    --u1 "$EVID/u1-probe-v4.json" \
    --winner-evidence "$winner_evidence" \
    --expected-winner "$WINNER" \
    --winner-cells "$WINNER_CELLS" \
    --deploy-cost "$EVID/12-deploy-cost.out" \
    --compile-fast "$EVID/compile/STATUS-skip-zk.tsv" \
    --compile-zk "$EVID/compile/STATUS-zk.tsv" \
    --run-start "$RUN_STARTED_UTC" \
    --out "$EVID/RANKING.md"
}

echo "[${GATE}] EXPERIMENTAL_LANE / LANE-DEV-1 — Plan 05 F-310 mitigation rig, mode=${MODE}"
echo "[${GATE}] compose project: ${PROJECT}"
echo "[${GATE}] variants: ${VARIANTS_ARG}"
echo "[${GATE}] cells: ${CELLS}   winner: ${WINNER} @ ${WINNER_CELLS} cells"

fs_run 01-w1-docker-config    step_w1
fs_run 02-probe-ports         step_probe_ports
fs_run 03-lane-reuse          step_lane_reuse
fs_run 04-lane-dev-1          step_lane_dev_1
fs_run 05-compile-fast        step_compile_fast
fs_run 06-compile-variants    step_compile_variants
fs_run 07-install             step_install
fs_run 08-unit-suites         step_unit_suites
fs_run 09-typecheck           step_typecheck
fs_run 10-compile-zk          step_compile_zk
fs_run 11-compile-variants-zk step_compile_variants_zk
fs_run 12-deploy-cost         step_deploy_cost
fs_run 13-offline-sweep       step_offline_sweep

if [ "$MODE" = "offline" ]; then
  echo "[${GATE}] --offline: Phase 1 complete — every fixture compiles, costs under the F-307 ceiling,"
  echo "[${GATE}] passes the per-variant suite, and is ranked by the offline placement model. The live"
  echo "[${GATE}] matrix and the end-to-end cases need a stack; run without --offline."
  exit 0
fi

fs_run 14-pull     step_pull
fs_run 15-boot     step_boot
fs_run 16-health   step_health
fs_run 17-loadgate step_loadgate

fs_run 18-live-matrix step_live_matrix

# Now that the chain's own LedgerParameters are captured, the offline model can be re-run under them
# and CALIBRATED against the live observations point by point. Until that comparison exists, no
# absolute boundary from the offline model may be quoted (F-313).
fs_run 19-offline-sweep-chain step_offline_sweep_chain
fs_run 20-calibrate           step_calibrate

fs_run 21-u1-probe    step_u1_probe
fs_run 22-winner-e2e  step_winner_e2e
fs_run 23-ranking     step_ranking

echo "[${GATE}] all steps passed; teardown runs next and must also succeed"
