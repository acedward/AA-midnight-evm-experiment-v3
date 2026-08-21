#!/usr/bin/env bash
# G3 gate wrapper — 00005-open-colour-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Owns a COMPLETE, DISPOSABLE lifecycle for the whole open-colour step ledger, from nothing:
#
#   adopt W-1 -> probe ports -> prove the lane is still the INHERITED one -> prove LANE-DEV-1
#   -> compile (fast) -> install harness -> unit suites INCLUDING the offline dry run of the 18-row
#      table -> compile (full ZK) -> pull pinned digests -> boot -> host health checks
#   -> the live run: steps 0-17, each asserting the FULL table over every colour that exists, every
#      pool, every unshielded contract-ledger balance, the EXACT size of all three custody maps,
#      ZERO unaccounted keys over the DISCOVERED colour set, the per-colour invariant and the
#      conservation identity; then NC-1..5, then probes P-COLL, M3 and Distinctness
#   -> render evidence/g3-ledger/CELLS.md (fails on any gap or any RED item)
#   -> teardown
#
# The dry run at step 07 is deliberately BEFORE anything is booted: it checks the transcription of
# the spec's NORMATIVE 18-row table against itself and replays the Manager's half of every row
# through the compiled artifact in process, so a transcription or argument-order mistake costs a
# second rather than an hour of chain time.
#
# W-1 (step 01) is the inherited HOST workaround from 00004's G4: a scratch DOCKER_CONFIG for this
# process tree only, so a wedged credential helper cannot block `docker pull`. It changes no pin and
# no assertion; see scripts/lib/docker-w1.sh.
#
# Fail-safe contract (inherited from 00003 via 00004): set -euo pipefail, EXIT/INT/TERM traps,
# argv/cwd/UTC recorded before each command and duration/exit after, and a TEARDOWN FAILURE
# REPLACES an otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above
# 10000, bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
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

EVID="$ROOT/evidence/g3-ledger"
fs_init "G3" "$EVID" "$@"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or
# any concurrent run on this shared host.
PROJECT="aa00005-g3-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed — INCLUDING the residue check and W-1 cleanup.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT} && w1_cleanup"

step_w1() { w1_enable "$ROOT"; }

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# The lane is INHERITED, never re-pinned (Plan 01 Phase 2). Re-asserted here so a G3 run is
# self-contained evidence rather than a claim resting on G1's or G2's run.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
# The G2 contract suites plus the 18-row step-ledger dry run (`src/test/step-ledger.test.ts`).
step_unit_suites()  { (cd "$ROOT/harness" && npx vitest run); }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

step_pull()   { "${COMPOSE[@]}" pull; }
step_boot()   { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }

# Plan 03 Phases 1-3 — the whole live half of this gate, in ONE process. The negative controls run
# against the state the step ledger finishes in, because the specification states three of them in
# terms of that state (NC-2's missing (AA_B,S3) cell against a pool that covers it, NC-3's dormant
# U3, NC-5's AA_A rich in everything but S2).
step_step_ledger() { (cd "$ROOT/harness" && npx tsx src/g3/ledger-run.ts); }

# Fails if any checklist item has no record, or if any item or control is not GREEN (the single
# exception being FR-207's RECORDED fallback for M3's composition half, which is printed loudly).
step_render_cells() { (cd "$ROOT/harness" && npx tsx src/g3/render-cells.ts); }

echo "[G3] EXPERIMENTAL_LANE / LANE-DEV-1 — open-colour step ledger on a fresh stack"
echo "[G3] compose project: ${PROJECT}"
fs_run 01-w1-docker-config step_w1
fs_run 02-probe-ports      step_probe_ports
fs_run 03-lane-reuse       step_lane_reuse
fs_run 04-lane-dev-1       step_lane_dev_1
fs_run 05-compile-fast     step_compile_fast
fs_run 06-install          step_install
fs_run 07-unit-suites      step_unit_suites
fs_run 08-compile-zk       step_compile_zk
fs_run 09-pull             step_pull
fs_run 10-boot             step_boot
fs_run 11-health           step_health
fs_run 12-step-ledger      step_step_ledger
fs_run 13-render-cells     step_render_cells

echo "[G3] all steps passed; teardown runs next and must also succeed"
