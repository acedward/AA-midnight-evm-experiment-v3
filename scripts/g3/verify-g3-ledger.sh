#!/usr/bin/env bash
# G3 gate wrapper — 00004-multi-token-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Owns a COMPLETE, DISPOSABLE lifecycle for the whole four-colour step ledger, from nothing:
#
#   probe ports -> prove the lane is still the REUSED one -> prove LANE-DEV-1 -> compile (fast)
#   -> install harness -> simulator suites INCLUDING the offline dry run of the 14-row table
#   -> compile (full ZK) -> pull pinned digests -> boot -> host health checks
#   -> the live run: steps 0-13 with the full 16-cell table + both pools + both unshielded ledger
#      balances + the per-colour invariant asserted after EVERY step, then NC-1..5 and probe M2,
#      with probe M1 as step 13
#   -> render evidence/g3-ledger/CELLS.md (fails on any gap or any RED item)
#   -> teardown
#
# The dry run at step 06 is deliberately BEFORE anything is booted: it checks the transcription of
# the spec's NORMATIVE step table against itself and replays the Manager's half of every row through
# the compiled artifact in process, so a transcription or argument-order mistake costs a second
# rather than an hour of chain time.
#
# Fail-safe contract (inherited from 00003): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC
# recorded before each command and duration/exit after, and a TEARDOWN FAILURE REPLACES an
# otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above
# 10000, bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/lane-pins.sh
source "$ROOT/scripts/lib/lane-pins.sh"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"

EVID="$ROOT/evidence/g3-ledger"
fs_init "G3" "$EVID" "$@"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or
# any concurrent run on this shared host.
PROJECT="aa00004-g3-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed — INCLUDING the residue check.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT}"

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# The lane is REUSED, never re-pinned (Plan 01 Phase 2). Re-asserted here so a G3 run is
# self-contained evidence rather than a claim resting on G1's or G2's run.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
# 45 offline checks: the G2 contract suites plus the step-ledger dry run (`src/test/step-ledger.test.ts`).
step_unit_suites()  { (cd "$ROOT/harness" && npx vitest run); }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

step_pull()   { "${COMPOSE[@]}" pull; }
step_boot()   { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }

# Plan 03 Phases 1-3 — the whole live half of this gate, in ONE process. The negative controls run
# against the state the step ledger finishes in, because the specification states three of them in
# terms of that state (NC-2 "after step 11", NC-3 and NC-5 in terms of what AA_A then holds).
step_step_ledger() { (cd "$ROOT/harness" && npx tsx src/g3/ledger-run.ts); }

# Fails if any checklist item has no record, or if any item or control is RED.
step_render_cells() { (cd "$ROOT/harness" && npx tsx src/g3/render-cells.ts); }

echo "[G3] EXPERIMENTAL_LANE / LANE-DEV-1 — four-colour step ledger on a fresh stack"
echo "[G3] compose project: ${PROJECT}"
fs_run 01-probe-ports   step_probe_ports
fs_run 02-lane-reuse    step_lane_reuse
fs_run 03-lane-dev-1    step_lane_dev_1
fs_run 04-compile-fast  step_compile_fast
fs_run 05-install       step_install
fs_run 06-unit-suites   step_unit_suites
fs_run 07-compile-zk    step_compile_zk
fs_run 08-pull          step_pull
fs_run 09-boot          step_boot
fs_run 10-health        step_health
fs_run 11-step-ledger   step_step_ledger
fs_run 12-render-cells  step_render_cells

echo "[G3] all steps passed; teardown runs next and must also succeed"
