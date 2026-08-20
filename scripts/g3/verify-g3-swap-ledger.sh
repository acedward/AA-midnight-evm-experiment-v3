#!/usr/bin/env bash
# G3 gate wrapper — the SWAP STEP LEDGER, 00006-unbalanced-zswap (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Runs Plan 03 end to end from nothing:
#
#   adopt W-1 (scratch DOCKER_CONFIG) -> W-2 (caffeinate) -> probe ports -> prove the lane is still the
#   INHERITED one, hop by hop -> prove LANE-DEV-1 -> compile fast -> install -> unit suites -> typecheck
#   (no NEW errors) -> compile ZK (+ F-201 verifier-key discipline) -> pull pinned digests -> boot ->
#   health -> load gate
#   -> STAGE A  (spec rows 0-6 + NC-304 + NC-305 + P-F310: the v1 named-taker lifecycle)
#   -> STAGE B  (spec rows 7-8: the OPEN offer — the owner-REQUIRED outcome)
#   -> STAGE C  (spec rows 9/11/12 + NC-306 + the P-F310 replication: the lifecycle negatives)
#   -> write the evidence index (LEDGER/CELLS/NEGATIVES/DEVIATION) -> teardown
#
# WHY THREE STAGES — deviation D-307, and it is measured rather than chosen. Finding F-310: a swap
# offer is publishable only while the Manager holds at most ONE shielded custody cell, and the spec's
# row 5 SETTLES, which creates the second. Rows 5 and 8 each need a settlement, so two Managers are
# unavoidable; the third keeps the refusal-only negatives from destroying the live offers those
# settlements need. Every row keeps the spec's exact amounts and assertions, the final table is
# asserted per stage, and P-F310 attempts the spec's LITERAL row 7 at two cells so the deviation is
# evidenced instead of asserted. Full statement: `evidence/g3-swap-ledger/DEVIATION.md`.
#
# GATE CONDITION
#
#   * the offline half (compile, unit suites, typecheck, F-201) must pass outright;
#   * every stage must end GREEN — a stage is RED if any ASSERTED row failed a check, or if a row was
#     left unfinished, or if the stage died. MEASURED rows (FR-311's staleness, the two cancellation
#     forms, P-F310) record what happened and only fail if they could not measure at all;
#   * ALL THREE STAGES RUN even when an earlier one is RED. That is the owner's unattended-window
#     directive taken literally: "if something fails -> all alternative paths in this time". A RED
#     stage is recorded prominently and the remaining runnable rows are still run, and only THEN does
#     the wrapper exit nonzero.
#
# Fail-safe contract (inherited from 00003 via 00004 and 00005): set -euo pipefail, EXIT/INT/TERM
# traps, argv/cwd/UTC recorded before each command and duration/exit after, and a TEARDOWN FAILURE
# REPLACES an otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above 10000,
# bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# W-2 must run BEFORE fs_init: the re-exec replaces this process, and doing it after fs_init would
# truncate the run log the parent had just created.
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
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    # Stops after the offline half — used to catch a syntax or type error in seconds instead of
    # discovering it forty minutes into a live run.
    --offline) MODE="offline"; shift ;;
    # A PILOT: run one stage only. Stage A exercises every piece of new machinery (maker process,
    # direct submission, taker process, settlement, double take, tamper, P-F310), so smoking it first
    # is the cheapest way to protect the long run. The gate is only ever GREEN with all three.
    --only) ONLY="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

EVID="$ROOT/evidence/g3-swap-ledger"
GATE=$([ "$MODE" = "offline" ] && echo "G3-OFFLINE" || echo "G3")
[ -n "$ONLY" ] && GATE="G3-PILOT-${ONLY}"

fs_init "$GATE" "$EVID" "$MODE" "$ONLY"

IMAGE="$COMPACTC_IMAGE"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or any
# concurrent run on this shared host.
PROJECT="aa00006-g3-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT} && w1_cleanup"

step_w1() { w1_enable "$ROOT"; }
step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }
step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
step_unit_suites()  { (cd "$ROOT/harness" && npx vitest run); }
step_typecheck()    { "$ROOT/scripts/typecheck.sh"; }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }
step_pull()   { "${COMPOSE[@]}" pull; }
step_boot()   { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }
step_loadgate() { loadgate_wait 900; }

# Clear the per-stage evidence ONCE, before any stage runs.
#
# Not tidiness — correctness. The index (`record.ts`) is generated from the stage JSONs and the
# wrapper's verdict comes from the stage exit codes, so a stale file from an earlier run would let this
# run inherit somebody else's answer. Offers and process IO go too: an `.offer` from a previous run
# would be a proof-carrying transaction for a Manager that no longer exists.
step_reset_evidence() {
  rm -rf "$EVID/offers" "$EVID/io" "$EVID"/stage-*.json "$EVID"/STAGE-*.md \
         "$EVID/LEDGER.md" "$EVID/CELLS.md" "$EVID/NEGATIVES.md" "$EVID/DEVIATION.md"
  mkdir -p "$EVID/offers" "$EVID/io"
  echo "evidence reset: no stage verdict, offer artifact or process report can be inherited from an earlier run"
}

step_stage_a() { (cd "$ROOT/harness" && npx tsx src/swap/stage-a.ts); }
step_stage_b() { (cd "$ROOT/harness" && npx tsx src/swap/stage-b.ts); }
step_stage_c() { (cd "$ROOT/harness" && npx tsx src/swap/stage-c.ts); }
step_record()  { (cd "$ROOT/harness" && npx tsx src/swap/record.ts); }

# --- stages, with BOUNDED infra retries and NO early exit ----------------------------------------
#
# Owner directive, unattended window: bounded infra retries (2 per failure class), each recorded VOID
# with its cause, and every alternative path taken rather than halting. This implements exactly that:
#
#   * a retry fires ONLY when the stage's own fatal record matches an INFRASTRUCTURE signature. A
#     failed assertion, a refusal or a product bug is a RESULT and is never retried — retrying those
#     would turn a real finding into a coin flip. The DETERMINISTIC list wins outright, because gate
#     run 1 of G2 burned twenty minutes retrying an FR-302 assert that could not have changed;
#   * a stage that ends RED does NOT stop the run. The failure is remembered and the wrapper exits
#     nonzero at the very end, after every other stage has had its chance.
INFRA_SIGNATURES='AbortError|ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|EAI_AGAIN|ETIMEDOUT'
DETERMINISTIC_SIGNATURES='FR-302 VIOLATED|does not match its own terms|unreadable imbalance|still carries non-dust deficits|CHECK FAILED'
VOID_RUNS=0
STAGE_FAILURES=()

stage_is_infra_failure() {
  local json="$1"
  [ -f "$json" ] || return 1
  python3 - "$json" "$INFRA_SIGNATURES" "$DETERMINISTIC_SIGNATURES" <<'PY'
import json, re, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
fatal = d.get('fatal') or ''
if not fatal:
    # No fatal record means the stage completed and simply had failing checks. That is a RESULT.
    sys.exit(1)
if re.search(sys.argv[3], fatal):
    sys.exit(1)
sys.exit(0 if re.search(sys.argv[2], fatal) else 1)
PY
}

# run_stage <step-name> <stage-letter> <command...>
run_stage() {
  local step="$1" letter="$2"; shift 2
  local json step_name attempt=1 max=3
  json="$EVID/stage-$(echo "$letter" | tr '[:upper:]' '[:lower:]').json"
  while : ; do
    if [ "$attempt" -eq 1 ]; then step_name="$step"; else step_name="${step}-retry$((attempt - 1))"; fi
    if fs_run "$step_name" "$@"; then
      return 0
    fi
    if [ "$attempt" -ge "$max" ] || ! stage_is_infra_failure "$json"; then
      if [ "$attempt" -lt "$max" ]; then
        echo "[${GATE}] stage ${letter}: the failure is NOT an infrastructure signature — no retry." >&2
        echo "[${GATE}] stage ${letter}: a failed assertion or a refusal is a RESULT, and retrying it would" >&2
        echo "[${GATE}] stage ${letter}: turn a real finding into a coin flip." >&2
      fi
      STAGE_FAILURES+=("$letter")
      echo "[${GATE}] stage ${letter}: RED after ${attempt} attempt(s) — recorded, and the run CONTINUES" >&2
      return 0   # deliberately: the remaining stages still run (owner's unattended-window directive)
    fi
    local void="$EVID/void/stage-${letter}-attempt${attempt}"
    mkdir -p "$void"
    cp -a "$json" "$void/" 2>/dev/null || true
    cp -a "$EVID/STAGE-${letter}.md" "$void/" 2>/dev/null || true
    cp -a "$EVID/io" "$void/" 2>/dev/null || true
    {
      echo "# VOID — stage ${letter} attempt ${attempt}"
      echo
      echo "Recorded (UTC): $(fs_utc)"
      echo
      echo "This attempt is **VOID, not RED**. Its fatal record matched an INFRASTRUCTURE signature"
      echo "(\`${INFRA_SIGNATURES}\`), which on this shared host means the failure is evidence about the"
      echo "host — a dropped socket, a starved proof server, an indexer timeout — and not about the"
      echo "ledger, the node or the offer format."
      echo
      echo "Host at the time: 1-min load $(loadgate_load1) on $(loadgate_cores) cores."
      echo
      echo "No conclusion may be drawn from this attempt. The retry that follows is a fresh measurement"
      echo "on a fresh Manager."
    } > "$void/VOID.md"
    VOID_RUNS=$((VOID_RUNS + 1))
    echo "[${GATE}] stage ${letter}: attempt ${attempt} VOID (infrastructure) — evidence kept at ${void#"$ROOT/"}; retrying"
    loadgate_wait 900 || true
    attempt=$((attempt + 1))
  done
}

echo "[${GATE}] EXPERIMENTAL_LANE / LANE-DEV-1 — 00006 swap step ledger, mode=${MODE}${ONLY:+, only=${ONLY}}"
echo "[${GATE}] compose project: ${PROJECT}"
echo "[${GATE}] deviation D-307: the ledger is partitioned across three fresh Managers (F-310). See"
echo "[${GATE}] evidence/g3-swap-ledger/DEVIATION.md — this is NOT the spec's literal single-Manager table."
fs_run 01-w1-docker-config step_w1
fs_run 02-probe-ports      step_probe_ports
fs_run 03-lane-reuse       step_lane_reuse
fs_run 04-lane-dev-1       step_lane_dev_1
fs_run 05-compile-fast     step_compile_fast
fs_run 06-install          step_install
fs_run 07-unit-suites      step_unit_suites
fs_run 08-typecheck        step_typecheck
fs_run 09-compile-zk       step_compile_zk

if [ "$MODE" = "offline" ]; then
  echo "[${GATE}] --offline: the offline half is green (compile, unit suites, typecheck, F-201)."
  echo "[${GATE}] The step ledger needs a live stack; run without --offline."
  exit 0
fi

fs_run 10-pull   step_pull
fs_run 11-boot   step_boot
fs_run 12-health step_health
fs_run 13-reset-evidence step_reset_evidence
fs_run 14-loadgate step_loadgate

if [ -z "$ONLY" ] || [ "$ONLY" = "A" ]; then run_stage 15-stage-a A step_stage_a; fi
if [ -z "$ONLY" ] || [ "$ONLY" = "B" ]; then run_stage 16-stage-b B step_stage_b; fi
if [ -z "$ONLY" ] || [ "$ONLY" = "C" ]; then run_stage 17-stage-c C step_stage_c; fi

# The index is written whatever happened, because a RED run needs its evidence indexed most of all.
# It fails only on a MISSING stage, and in a pilot the missing stages are expected.
if [ -n "$ONLY" ]; then
  fs_run 18-record step_record || echo "[${GATE}] index incomplete — expected in a --only pilot"
else
  fs_run 18-record step_record
fi

if [ "${#STAGE_FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo "################################################################################"
  echo "#  G3 IS **RED**. Stage(s) with failing rows: ${STAGE_FAILURES[*]}"
  echo "#  Every other stage still ran, per the owner's unattended-window directive.    #"
  echo "#  Read evidence/g3-swap-ledger/LEDGER.md — the FAILED rows are listed there    #"
  echo "#  with the checks that failed, and STAGE-<X>.md carries the verbatim records.  #"
  echo "################################################################################"
  echo ""
fi
if [ "$VOID_RUNS" -gt 0 ]; then
  echo "[${GATE}] ${VOID_RUNS} attempt(s) were VOIDed for infrastructure reasons; see evidence/g3-swap-ledger/void/"
fi

if [ -n "$ONLY" ]; then
  echo "[${GATE}] PILOT of stage ${ONLY} complete. A pilot is never a gate result: G3 requires all three stages."
fi

if [ "${#STAGE_FAILURES[@]}" -gt 0 ]; then
  echo "[${GATE}] teardown runs next and must also succeed; the gate exits nonzero because of the RED stage(s)"
  # The EXIT trap installed by fs_init runs teardown and preserves this exit code.
  exit 1
fi

echo "[${GATE}] all stages passed; teardown runs next and must also succeed"
