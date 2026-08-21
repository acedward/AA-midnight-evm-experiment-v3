#!/usr/bin/env bash
# G4 gate wrapper — 00006-unbalanced-zswap (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Proves the specification's last success criterion (SC-306): the WHOLE demonstration reproduces from
# a clean clone with ONE command, on a provably different chain. It clones this repository into a
# fresh temporary directory, runs the G1, G2 and G3 gate wrappers inside that clone — each against a
# fresh disposable stack of its own — copies the clone's evidence out before the clone is destroyed,
# compares the reproduced results against the retained originals, re-verifies the approved
# specification is byte-identical, renders REPORT.md from the retained evidence plus the clone's, and
# checks the closeout documents are present and say what they must.
#
# THE PROBLEM THE FRESHNESS GUARD SOLVES. Retained evidence is COMMITTED, so `git clone` carries the
# original run's `evidence/` into the clone and the clone's own gates then overwrite it. A comparison
# that only checked verdicts would therefore pass against the very files it was meant to reproduce.
#
# AND HOW THIS GATE PROVES THE GUARD IS NOT VACUOUS. Step 04 runs the comparison BEFORE the clone has
# run anything, i.e. with the ORIGINAL fed in as its own "reproduction", and REQUIRES it to be
# rejected — specifically with exit code 2, which `compare-swap-runs.py` returns only when every
# substantive check passed and the freshness half is the sole objection. A guard that cannot produce
# that outcome is not a guard, and this gate refuses to be green without seeing it.
#
# WHAT THE COMPARISON DOES **NOT** DEMAND, deliberately (00005 decision D-205's lesson): the
# specification states FR-308's openness as a DISJUNCTION over two offer shapes, and states FR-311's
# staleness, both cancellation forms and P-F310 as MEASUREMENTS. The comparator therefore requires
# openness to be GREEN in both runs while allowing the shape to differ, and requires the MEASURED rows
# to have measured — refusal, no state created, funds unchanged — while reporting a changed refusal
# code as a FINDING. A comparator stricter than the specification is a comparator bug, not rigour.
#
# W-1 (step 01) and W-2 (the caffeinate re-exec, before anything else) are the inherited HOST
# workarounds. The reproduction's own three gates re-enable both inside the clone.
#
# Fail-safe contract (inherited): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC recorded before
# each command and duration/exit after, and a TEARDOWN FAILURE REPLACES an otherwise-zero result. The
# gate is green only if this process exits 0.
#
# SHARED HOST: the clone lives under `mktemp -d`; each reproduced gate creates its own uniquely named
# compose project on ports it verified free above 10000 and tears it down itself; this wrapper's
# teardown removes only that exact temporary path — after validating it really is that path — and then
# proves no container, volume or network named `aa00006*` survived. No other project on this machine is
# matched or touched.
#
# Modes:
#   (default)   the full reproduction. Budget ~3 hours: G1 ≈ 40 min, G2 ≈ 82 min, G3 ≈ 40 min.
#   --offline   everything except the three reproduced gates and the comparison of their output —
#               clone, spec hash, freshness self-test, report render, document checks. Seconds, not
#               hours, and it is how a typo in this wrapper is found before a three-hour run.
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

MODE="full"
while [ $# -gt 0 ]; do
  case "$1" in
    --offline) MODE="offline"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

EVID="$ROOT/evidence/g4-closeout"
GATE=$([ "$MODE" = "offline" ] && echo "G4-OFFLINE" || echo "G4")

# Clear THIS gate's own per-step outputs before recording anything new. Not tidiness: `--offline` and a
# full run write different step numbers (`05-report.out` vs `05-reproduce-g1.out`), so without this a
# directory ends up holding two runs' answers side by side with nothing to say which is which — and a
# reader cannot tell an orphan from a result. Subdirectories are left alone on purpose: `repro/` and
# `offline-preflight/` are deliberately retained records, and `run.log` is truncated by `fs_init`.
if [ -d "$EVID" ]; then
  find "$EVID" -maxdepth 1 -type f -name '*.out' -delete
fi
fs_init "$GATE" "$EVID" "$MODE"

CLONE_PARENT=""
CLONE=""
REPRO_COPIED="0"
COMPARE="$ROOT/scripts/g4/compare-swap-runs.py"

# The approved specification lives in the ORGANIZER repository, not in this product repo, so its
# byte-identity check needs a path. It is checked for real on the authoring host and reported as
# "not present" — never silently skipped — anywhere else.
SPEC_SHA256_EXPECTED="6441f8ed216a4f6b48306d171a5230e33f4ec3ed2739ff04f6c055f77b672bea"
SPEC_PATH="${SPEC_PATH:-/Users/edwardalvarado/todo/AA/.claude/worktrees/plan-00002-review-audit-cf7c40/AA/spec/00006-unbalanced-zswap.md}"

# Remove ONLY the temporary clone this run created, after validating the path is exactly that.
# An unvalidated `rm -rf` on a shared machine is the failure mode this guard exists to prevent.
cleanup_clone() {
  if [ -z "$CLONE_PARENT" ]; then
    echo "no temporary clone was created; nothing to remove"
    return 0
  fi
  # LAST CHANCE to keep the reproduction's evidence. `08-copy-repro-evidence` runs after the three
  # reproduced gates, so a gate that FAILS would otherwise take its evidence down with the clone —
  # and that is precisely the run whose evidence is most wanted. Best-effort and idempotent: a copy
  # failure here must never mask the real error that brought us to teardown.
  if [ "$REPRO_COPIED" != "1" ] && [ -d "$CLONE/evidence" ]; then
    echo "copying the clone's evidence before removal (the copy step did not reach completion)"
    copy_repro_evidence || echo "WARNING: the last-chance evidence copy failed; continuing with teardown" >&2
  fi
  case "$CLONE_PARENT" in
    /tmp/*|/private/tmp/*|/private/var/folders/*|/var/folders/*) ;;
    *) echo "REFUSING to remove '$CLONE_PARENT': not under a temporary directory" >&2; return 1 ;;
  esac
  [ -d "$CLONE_PARENT" ] || { echo "temporary clone path already gone: $CLONE_PARENT"; return 0; }
  [ "$CLONE_PARENT" != "$ROOT" ] || { echo "REFUSING to remove the workspace itself" >&2; return 1; }
  echo "removing temporary clone parent: $CLONE_PARENT"
  rm -rf "$CLONE_PARENT"
  [ ! -d "$CLONE_PARENT" ] || { echo "temporary clone still present after removal" >&2; return 1; }
  echo "temporary clone removed"
}

# Teardown: remove the temporary clone, then prove nothing of THIS project is left on the host.
step_teardown() {
  cleanup_clone
  echo "-- containers matching this project:"
  docker ps -a --filter 'name=aa00006' --format '{{.Names}}\t{{.Status}}' || true
  echo "-- volumes matching this project:"
  docker volume ls --filter 'name=aa00006' --format '{{.Name}}' || true
  echo "-- networks matching this project:"
  docker network ls --filter 'name=aa00006' --format '{{.Name}}' || true
  local c v n
  c="$(docker ps -a --filter 'name=aa00006' --format '{{.Names}}' | wc -l | tr -d ' ')"
  v="$(docker volume ls --filter 'name=aa00006' --format '{{.Name}}' | wc -l | tr -d ' ')"
  n="$(docker network ls --filter 'name=aa00006' --format '{{.Name}}' | wc -l | tr -d ' ')"
  echo "remaining containers: ${c}, volumes: ${v}, networks: ${n}"
  # W-1's scratch DOCKER_CONFIG is removed LAST, so the residue proof above still runs under it.
  [ "$c" = "0" ] && [ "$v" = "0" ] && [ "$n" = "0" ] || return 1
  w1_cleanup
}
fs_set_teardown "step_teardown"

# --- W-1, exactly as in G1/G2/G3 ------------------------------------------------------------------
step_w1() { w1_enable "$ROOT"; nosleep_note; }

# --- the clean clone ------------------------------------------------------------------------------
step_clean_clone() {
  CLONE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/aa00006-g4-XXXXXX")"
  CLONE="$CLONE_PARENT/clone"
  echo "temporary clone parent: $CLONE_PARENT"
  git clone --branch "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)" "$ROOT" "$CLONE"
  echo "source commit: $(git -C "$ROOT" rev-parse HEAD)"
  echo "cloned commit: $(git -C "$CLONE" rev-parse HEAD)"
  if [ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$CLONE" rev-parse HEAD)" ]; then
    echo "the clone is not at this working tree's commit — an uncommitted change would not be reproduced" >&2
    return 1
  fi
  # A clean clone must carry NO generated artifacts, no docker/.env and no node_modules — if it did,
  # the reproduction would be reusing this working tree's state instead of rebuilding from source.
  local dirty=0 p
  for p in docker/.env harness/node_modules harness/generated harness/generated-zk \
           harness/generated-probes harness/midnight-level-db toolchain; do
    if [ -e "$CLONE/$p" ]; then echo "CLEAN-CLONE VIOLATION: $p is present in the clone"; dirty=1; fi
  done
  [ "$dirty" = "0" ] || return 1
  echo "clone is clean: no generated artifacts, no toolchain, no docker/.env, no node_modules, no private-state store"
  # The clone MUST carry the sources and gate wrappers, or the reproduction proves nothing.
  for p in contracts/manager.compact contracts/minter.compact \
           scripts/g1/verify-g1-spikes.sh scripts/g2/verify-g2-contracts.sh \
           scripts/g3/verify-g3-swap-ledger.sh scripts/lib/docker-w1.sh scripts/lib/nosleep.sh \
           harness/pnpm-lock.yaml harness/src/offer/build.ts harness/src/offer/take.ts \
           harness/src/swap/stage-a.ts harness/src/swap/stage-b.ts harness/src/swap/stage-c.ts; do
    [ -f "$CLONE/$p" ] || { echo "CLONE INCOMPLETE: missing $p"; return 1; }
  done
  echo "clone carries the contracts, the offer kit, the three stages, the gate wrappers, W-1/W-2 and the pinned lockfile"
  # It must ALSO carry the original run's committed evidence — that is what step 04 feeds back in.
  for p in evidence/g3-swap-ledger/stage-a.json evidence/g3-swap-ledger/stage-b.json \
           evidence/g3-swap-ledger/stage-c.json evidence/g1-spikes/s1-foreign-balance.json \
           evidence/g2-spikes/s4.json evidence/g2-spikes/s6.json; do
    [ -f "$CLONE/$p" ] || { echo "CLONE INCOMPLETE: missing $p"; return 1; }
  done
  echo "clone carries the committed original evidence (the freshness self-test needs it)"
  echo "$CLONE" > "$EVID/clone-path.txt"
}

# --- the approved specification is byte-identical --------------------------------------------------
step_spec_hash() {
  echo "expected SHA-256 (recorded in the organizer project-summary): ${SPEC_SHA256_EXPECTED}"
  echo "spec path: ${SPEC_PATH}"
  if [ ! -f "$SPEC_PATH" ]; then
    echo "RESULT: the approved specification is NOT PRESENT on this host."
    echo "It lives in the organizer repository, not in this product repo, so a clone on another"
    echo "machine cannot check it. Byte-identity was verified on the authoring host at closeout and"
    echo "is recorded in VERIFICATION.md. Set SPEC_PATH=... to check it here."
    return 0
  fi
  local actual
  actual="$(shasum -a 256 "$SPEC_PATH" | awk '{print $1}')"
  echo "actual   SHA-256: ${actual}"
  if [ "$actual" != "$SPEC_SHA256_EXPECTED" ]; then
    echo "SPEC CHANGED: the approved specification is no longer byte-identical." >&2
    echo "The specification is IMMUTABLE during execution (series convention, owner-approved 2026-08-19);" >&2
    echo "a change requires a versioned amendment with renewed owner approval, not a gate that tolerates it." >&2
    return 1
  fi
  echo "RESULT: byte-identical to the approved, owner-signed specification."
}

# --- the freshness guard is proven NON-VACUOUS before it is trusted --------------------------------
# The clone has not run anything yet, so its `evidence/` is a byte-for-byte copy of the original's.
# That is precisely the fake this guard exists to catch. `compare-swap-runs.py` must exit 2: every
# substantive check passing, and freshness the SOLE objection.
step_freshness_selftest() {
  echo "feeding the ORIGINAL evidence back in as its own 'reproduction' — this MUST be rejected"
  echo "original: $ROOT"
  echo "'repro':  $CLONE  (still carrying the committed original evidence, nothing run yet)"
  echo
  set +e
  python3 "$COMPARE" "$ROOT" "$CLONE"
  local rc=$?
  set -e
  echo
  echo "compare-swap-runs.py exit code: ${rc} (0 = accepted, 1 = substantive divergence, 2 = freshness rejection)"
  case "$rc" in
    2) echo "SELF-TEST PASSED: the guard rejected the original as its own reproduction, on freshness"
       echo "grounds alone — every substantive comparison passed. It is therefore not vacuous, and a"
       echo "green comparison later in this run means something."
       return 0 ;;
    0) echo "SELF-TEST FAILED: the comparison ACCEPTED the original as its own reproduction." >&2
       echo "The freshness guard is vacuous and every reproduction claim made with it is worthless." >&2
       return 1 ;;
    *) echo "SELF-TEST INCONCLUSIVE: the comparison rejected the pair, but for SUBSTANTIVE reasons" >&2
       echo "(exit ${rc}), not freshness. That means the retained evidence does not satisfy its own" >&2
       echo "checks, which must be fixed before any reproduction claim is made." >&2
       return 1 ;;
  esac
}

# --- reproduce the whole demonstration inside the clone -------------------------------------------
# In series, never in parallel: each gate needs the host's proof server to itself, and three
# concurrent stacks on a shared machine is how G1 run 1 was starved into an AbortError.
step_reproduce_g1() { (cd "$CLONE" && ./scripts/g1/verify-g1-spikes.sh); }
step_reproduce_g2() { (cd "$CLONE" && ./scripts/g2/verify-g2-contracts.sh); }
step_reproduce_g3() { (cd "$CLONE" && ./scripts/g3/verify-g3-swap-ledger.sh); }

# --- copy the reproduction's evidence out BEFORE the clone is destroyed ----------------------------
# The clone is deleted at teardown. Whatever is not copied here is gone, and a reproduction claim with
# no retained evidence is an assertion. The heavy directories (`io/`, container logs) are left behind
# on purpose; the JSON records and the generated index pages are what carry the claims.
copy_repro_evidence() {
  local dest="$EVID/repro"
  rm -rf "$dest"
  mkdir -p "$dest"
  local d
  for d in g1-lane g1-spikes g2-contracts g2-spikes g2-deploy-budget g3-swap-ledger; do
    [ -d "$CLONE/evidence/$d" ] || continue
    mkdir -p "$dest/$d"
    # JSON records, generated index pages, run logs and per-step outputs — no `io/`, no `raw/`.
    (cd "$CLONE/evidence/$d" && find . -maxdepth 1 -type f \
        \( -name '*.json' -o -name '*.md' -o -name 'run.log' -o -name '*.out' -o -name '*.txt' \) \
        -exec cp -p {} "$dest/$d/" \;)
  done
  echo "reproduced commit: $(git -C "$CLONE" rev-parse HEAD)" > "$dest/CLONE.md"
  {
    echo "clone path (removed at teardown): $CLONE"
    echo "copied (UTC): $(fs_utc)"
    echo "label: EXPERIMENTAL_LANE / LANE-DEV-1"
    echo
    echo "This is the CLEAN CLONE's own evidence, copied out before the clone was deleted. It is the"
    echo "reproduction half of every claim in REPORT.md's reproduction section. The clone's process IO"
    echo "and raw container logs were deliberately not copied; the JSON records carry the claims."
  } >> "$dest/CLONE.md"
  du -sh "$dest"
  find "$dest" -type f | wc -l | awk '{print $1 " files copied"}'
  REPRO_COPIED="1"
}

step_copy_repro() { copy_repro_evidence; }

# --- compare the reproduction with the original ---------------------------------------------------
step_compare() { python3 "$COMPARE" "$ROOT" "$CLONE"; }

# --- render the final report from retained evidence + the clone's own -----------------------------
step_report() {
  if [ "$MODE" = "offline" ]; then
    (cd "$ROOT/harness" && npx tsx src/g4/swap-report.ts)
  else
    (cd "$ROOT/harness" && npx tsx src/g4/swap-report.ts "$CLONE")
  fi
}

# --- the closeout documents must actually be there and say what they must -------------------------
step_docs() {
  local fail=0 f
  for f in REPORT.md README.md VERIFICATION.md; do
    [ -s "$ROOT/$f" ] || { echo "MISSING or EMPTY: $f"; fail=1; continue; }
    echo "-- $f ($(wc -l < "$ROOT/$f" | tr -d ' ') lines)"
    grep -q 'EXPERIMENTAL_LANE' "$ROOT/$f" || { echo "   $f does not carry the EXPERIMENTAL_LANE label"; fail=1; }
    grep -q 'LANE-DEV-1' "$ROOT/$f" || { echo "   $f does not carry the LANE-DEV-1 deviation label"; fail=1; }
  done
  # The README must name this project and carry a GitHub-supported Mermaid diagram of the flows.
  grep -q '```mermaid' "$ROOT/README.md" || { echo "README.md has no Mermaid diagram"; fail=1; }
  grep -q '00006' "$ROOT/README.md" || { echo "README.md does not name this project"; fail=1; }
  # The claims this project must NEVER make silently: the partitioned ledger, the measured cell limit,
  # and the two owner questions have to be visible in the closeout documents, not buried in plans.
  for f in REPORT.md README.md VERIFICATION.md; do
    grep -q 'D-307' "$ROOT/$f" || { echo "   $f does not disclose deviation D-307"; fail=1; }
    grep -q 'F-310' "$ROOT/$f" || { echo "   $f does not disclose finding F-310 (the ONE-cell limit)"; fail=1; }
  done
  for q in Q02-2 Q03-1; do
    grep -q "$q" "$ROOT/REPORT.md" || { echo "   REPORT.md does not surface open owner question $q"; fail=1; }
  done
  # The findings this project owes anyone reusing the harness must be carried into the report.
  for x in F-301 F-303 F-304 F-306 F-307 F-308 F-309 F-311; do
    grep -q "$x" "$ROOT/REPORT.md" || { echo "REPORT.md does not carry finding $x"; fail=1; }
  done
  # Openness is the owner-REQUIRED outcome; the report must state it explicitly, either way.
  grep -qE 'FR-308 openness is (GREEN|RED)' "$ROOT/REPORT.md" \
    || { echo "REPORT.md does not state the FR-308 openness verdict in so many words"; fail=1; }
  # 00003's, 00004's and 00005's deliverables must remain preserved and untouched by this project.
  for f in 00003 00004 00005; do
    [ -f "$ROOT/archive/$f/ARCHIVE.md" ] || { echo "archive/$f/ARCHIVE.md is missing"; fail=1; }
  done
  # The 00004 Minter must still be the reused-unchanged source this project claims it is.
  local minter_here minter_base
  minter_here="$(shasum -a 256 "$ROOT/contracts/minter.compact" | awk '{print $1}')"
  minter_base="$(git -C "$ROOT" show 'f066a09:contracts/minter.compact' | shasum -a 256 | awk '{print $1}')"
  echo "-- contracts/minter.compact: ${minter_here}"
  [ "$minter_here" = "$minter_base" ] \
    || { echo "   MINTER CHANGED since f066a09 (base ${minter_base}) — 'reused unchanged' is not true"; fail=1; }
  # Manager v3's own circuits must still be byte-compatible: 00006 EXTENDS v3, never weakens it. The
  # unit suite proves the behaviour; this proves the inherited SOURCE of the 00005 contract is still
  # the parent of ours rather than a rewrite.
  echo "-- contracts/manager.compact, changes since the 00005 base e9701e9:"
  git -C "$ROOT" diff --stat 'e9701e9' -- contracts/manager.compact || true
  # Generated artifacts and secrets must never have been committed.
  local tracked
  tracked="$(git -C "$ROOT" ls-files docker/.env 'harness/generated*' '*.verifier' '*.prover' | head -5)"
  [ -z "$tracked" ] || { echo "COMMITTED ARTEFACT VIOLATION: $tracked"; fail=1; }
  echo "-- no generated artifacts, keys or docker/.env are tracked by git"
  [ "$fail" = "0" ]
}

echo "[${GATE}] EXPERIMENTAL_LANE / LANE-DEV-1 — reproducing the whole demonstration from a clean clone"
echo "[${GATE}] mode=${MODE}"
if [ "$MODE" = "full" ]; then
  echo "[${GATE}] budget ~3 hours: G1 ≈ 40 min, G2 ≈ 82 min, G3 ≈ 40 min, in SERIES on fresh stacks"
fi
fs_run 01-w1-docker-config    step_w1
fs_run 02-clean-clone         step_clean_clone
fs_run 03-spec-hash           step_spec_hash
fs_run 04-freshness-selftest  step_freshness_selftest

if [ "$MODE" = "offline" ]; then
  echo "[${GATE}] --offline: the clone, the spec hash and the NON-VACUOUS freshness self-test are green."
  echo "[${GATE}] The reproduction itself needs three live stacks and ~3 hours; run without --offline."
  fs_run 05-report step_report
  fs_run 06-docs   step_docs
  echo "[${GATE}] offline half complete; teardown (clone removal + docker-state proof + W-1 cleanup) runs next"
  exit 0
fi

fs_run 05-reproduce-g1        step_reproduce_g1
fs_run 06-reproduce-g2        step_reproduce_g2
fs_run 07-reproduce-g3        step_reproduce_g3
fs_run 08-copy-repro-evidence step_copy_repro
fs_run 09-compare             step_compare
fs_run 10-report              step_report
fs_run 11-docs                step_docs

echo "[${GATE}] all steps passed; teardown (clone removal + docker-state proof + W-1 cleanup) runs next"
echo "[${GATE}] and must also succeed"
