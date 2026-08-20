#!/usr/bin/env bash
# G4 gate wrapper — 00005-open-colour-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Proves the specification's last success criterion: the WHOLE demonstration reproduces from a clean
# clone with ONE command, on a provably different chain. It clones this repository into a fresh
# temporary directory, runs the G1, G2 and G3 gate wrappers inside that clone — each against a fresh
# stack of its own — compares the reproduced results against the retained originals, re-verifies the
# approved specification is byte-identical, renders REPORT.md from the clone's own evidence, and
# checks the closeout documents are actually present.
#
# THE PROBLEM THE FRESHNESS GUARD SOLVES. Retained evidence is COMMITTED, so `git clone` carries the
# original run's `evidence/` into the clone and the clone's own gates then overwrite it. A comparison
# that only checked verdicts would therefore pass against the very files it was meant to reproduce.
#
# AND HOW THIS GATE PROVES THE GUARD IS NOT VACUOUS. Step 04 runs the comparison BEFORE the clone has
# run anything, i.e. with the ORIGINAL fed in as its own "reproduction", and REQUIRES it to be
# rejected — specifically with exit code 2, which `compare-runs.py` returns only when every
# substantive check passed and the freshness half is the sole objection. A guard that cannot produce
# that outcome is not a guard, and this gate refuses to be green without seeing it.
#
# W-1 (step 01) is the inherited HOST workaround from 00004's G4, kept here — including for the
# reproduction's own three gates, which each re-enable it inside the clone.
#
# Fail-safe contract (inherited): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC recorded
# before each command and duration/exit after, and a TEARDOWN FAILURE REPLACES an otherwise-zero
# result. The gate is green only if this process exits 0.
#
# SHARED HOST: the clone lives under `mktemp -d`; each reproduced gate creates its own uniquely named
# compose project on ports it verified free above 10000 and tears it down itself; this wrapper's
# teardown removes only that exact temporary path and then proves no container, volume or network
# named `aa00005*` survived. No other project on this machine is matched or touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/docker-w1.sh
source "$ROOT/scripts/lib/docker-w1.sh"

EVID="$ROOT/evidence/g4-closeout"
fs_init "G4" "$EVID" "$@"

CLONE_PARENT=""
CLONE=""
COMPARE="$ROOT/scripts/g4/compare-runs.py"

# The approved specification lives in the ORGANIZER repository, not in this product repo, so its
# byte-identity check needs a path. It is checked for real on the authoring host and reported as
# "not present" — never silently skipped — anywhere else.
SPEC_SHA256_EXPECTED="bb32e42b2ab78d0ae90d165b26b29a1fb6b568feb399622703aa634b1255a6f0"
SPEC_PATH="${SPEC_PATH:-/Users/edwardalvarado/todo/AA/.claude/worktrees/contract-token-custody-6d6cd3/AA/spec/00005-open-colour-custody.md}"

# Remove ONLY the temporary clone this run created, after validating the path is exactly that.
# An unvalidated `rm -rf` on a shared machine is the failure mode this guard exists to prevent.
cleanup_clone() {
  if [ -z "$CLONE_PARENT" ]; then
    echo "no temporary clone was created; nothing to remove"
    return 0
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
  docker ps -a --filter 'name=aa00005' --format '{{.Names}}\t{{.Status}}' || true
  echo "-- volumes matching this project:"
  docker volume ls --filter 'name=aa00005' --format '{{.Name}}' || true
  echo "-- networks matching this project:"
  docker network ls --filter 'name=aa00005' --format '{{.Name}}' || true
  local c v n
  c="$(docker ps -a --filter 'name=aa00005' --format '{{.Names}}' | wc -l | tr -d ' ')"
  v="$(docker volume ls --filter 'name=aa00005' --format '{{.Name}}' | wc -l | tr -d ' ')"
  n="$(docker network ls --filter 'name=aa00005' --format '{{.Name}}' | wc -l | tr -d ' ')"
  echo "remaining containers: ${c}, volumes: ${v}, networks: ${n}"
  # W-1's scratch DOCKER_CONFIG is removed LAST, so the residue proof above still runs under it.
  [ "$c" = "0" ] && [ "$v" = "0" ] && [ "$n" = "0" ] || return 1
  w1_cleanup
}
fs_set_teardown "step_teardown"

# --- W-1, exactly as in G1/G2/G3 ------------------------------------------------------------------
step_w1() { w1_enable "$ROOT"; }

# --- Phase 1: clean clone -------------------------------------------------------------------------
step_clean_clone() {
  CLONE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/aa00005-g4-XXXXXX")"
  CLONE="$CLONE_PARENT/clone"
  echo "temporary clone parent: $CLONE_PARENT"
  git clone --branch "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)" "$ROOT" "$CLONE"
  echo "source commit: $(git -C "$ROOT" rev-parse HEAD)"
  echo "cloned commit: $(git -C "$CLONE" rev-parse HEAD)"
  # A clean clone must carry NO generated artifacts, no docker/.env and no node_modules — if it did,
  # the reproduction would be reusing this working tree's state instead of rebuilding from source.
  local dirty=0 p
  for p in docker/.env harness/node_modules harness/generated harness/generated-zk \
           harness/generated-probes harness/midnight-level-db; do
    if [ -e "$CLONE/$p" ]; then echo "CLEAN-CLONE VIOLATION: $p is present in the clone"; dirty=1; fi
  done
  [ "$dirty" = "0" ] || return 1
  echo "clone is clean: no generated artifacts, no docker/.env, no node_modules, no private-state store"
  # The clone MUST carry the sources and gate wrappers, or the reproduction proves nothing.
  for p in contracts/minter.compact contracts/manager.compact contracts/minter-collide.compact \
           scripts/g1/verify-g1-lane.sh scripts/g2/verify-g2-contracts.sh \
           scripts/g3/verify-g3-ledger.sh scripts/lib/docker-w1.sh harness/pnpm-lock.yaml; do
    [ -f "$CLONE/$p" ] || { echo "CLONE INCOMPLETE: missing $p"; return 1; }
  done
  echo "clone carries all three contracts, the gate wrappers, W-1 and the pinned lockfile"
  # It must ALSO carry the original run's committed evidence — that is what step 04 feeds back in.
  for p in evidence/g3-ledger/run-context.json evidence/g3-ledger/cells.json \
           evidence/g3-ledger/negative-controls.json; do
    [ -f "$CLONE/$p" ] || { echo "CLONE INCOMPLETE: missing $p"; return 1; }
  done
  echo "clone carries the committed original evidence (the freshness self-test needs it)"
  echo "$CLONE" > "$EVID/clone-path.txt"
}

# --- Phase 2: the approved specification is byte-identical -----------------------------------------
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
    echo "The specification is IMMUTABLE during execution (00003 Q1-A convention); a change requires" >&2
    echo "a versioned amendment with renewed owner approval, not a gate that tolerates it." >&2
    return 1
  fi
  echo "RESULT: byte-identical to the approved, owner-signed specification."
}

# --- Phase 1: the freshness guard is proven NON-VACUOUS before it is trusted ------------------------
# The clone has not run anything yet, so its `evidence/` is a byte-for-byte copy of the original's.
# That is precisely the fake this guard exists to catch. `compare-runs.py` must exit 2: every
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
  echo "compare-runs.py exit code: ${rc} (0 = accepted, 1 = substantive divergence, 2 = freshness rejection)"
  case "$rc" in
    2) echo "SELF-TEST PASSED: the guard rejected the original as its own reproduction, on freshness"
       echo "grounds alone. It is therefore not vacuous, and a green comparison in step 08 means"
       echo "something."
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

# --- Phase 1: reproduce the whole demonstration inside the clone ------------------------------------
step_reproduce_g1() { (cd "$CLONE" && ./scripts/g1/verify-g1-lane.sh); }
step_reproduce_g2() { (cd "$CLONE" && ./scripts/g2/verify-g2-contracts.sh); }
step_reproduce_g3() { (cd "$CLONE" && ./scripts/g3/verify-g3-ledger.sh); }

# --- Phase 1: compare the reproduction with the original --------------------------------------------
step_compare() { python3 "$COMPARE" "$ROOT" "$CLONE"; }

# --- Phase 2: render the final report from retained evidence + the clone's own -----------------------
step_report() { (cd "$ROOT/harness" && npx tsx src/g4/report.ts "$CLONE"); }

# --- Phase 2: the closeout documents must actually be there and say what they must -------------------
step_docs() {
  local fail=0 f
  for f in REPORT.md README.md VERIFICATION.md; do
    [ -s "$ROOT/$f" ] || { echo "MISSING or EMPTY: $f"; fail=1; continue; }
    echo "-- $f ($(wc -l < "$ROOT/$f" | tr -d ' ') lines)"
    grep -q 'EXPERIMENTAL_LANE' "$ROOT/$f" || { echo "   $f does not carry the EXPERIMENTAL_LANE label"; fail=1; }
    grep -q 'LANE-DEV-1' "$ROOT/$f" || { echo "   $f does not carry the LANE-DEV-1 deviation label"; fail=1; }
  done
  # The README must carry the 00005 section AND a GitHub-supported Mermaid diagram of the flows.
  grep -q '```mermaid' "$ROOT/README.md" || { echo "README.md has no Mermaid diagram"; fail=1; }
  grep -q '00005' "$ROOT/README.md" || { echo "README.md does not name this project"; fail=1; }
  # The three findings this project owes anyone reusing the harness must be carried into the closeout
  # documents, not left in the plans (Plan 04 Phase 2).
  for f in F-201 F-202 F-203; do
    grep -q "$f" "$ROOT/REPORT.md" || { echo "REPORT.md does not carry finding $f"; fail=1; }
  done
  # 00003's and 00004's deliverables must remain preserved and untouched by this project.
  [ -f "$ROOT/archive/00003/ARCHIVE.md" ] || { echo "archive/00003/ARCHIVE.md is missing"; fail=1; }
  [ -f "$ROOT/archive/00004/ARCHIVE.md" ] || { echo "archive/00004/ARCHIVE.md is missing"; fail=1; }
  # The 00004 Minter must still be the reused-unchanged source this project claims it is.
  local minter_here minter_base
  minter_here="$(shasum -a 256 "$ROOT/contracts/minter.compact" | awk '{print $1}')"
  minter_base="$(git -C "$ROOT" show 'f066a09:contracts/minter.compact' | shasum -a 256 | awk '{print $1}')"
  echo "-- contracts/minter.compact: ${minter_here}"
  [ "$minter_here" = "$minter_base" ] \
    || { echo "   MINTER CHANGED since f066a09 (base ${minter_base}) — 'reused unchanged' is not true"; fail=1; }
  # Generated artifacts and secrets must never have been committed.
  local tracked
  tracked="$(git -C "$ROOT" ls-files docker/.env 'harness/generated*' '*.verifier' '*.prover' | head -5)"
  [ -z "$tracked" ] || { echo "COMMITTED ARTEFACT VIOLATION: $tracked"; fail=1; }
  echo "-- no generated artifacts, keys or docker/.env are tracked by git"
  [ "$fail" = "0" ]
}

echo "[G4] EXPERIMENTAL_LANE / LANE-DEV-1 — reproducing the whole demonstration from a clean clone"
fs_run 01-w1-docker-config    step_w1
fs_run 02-clean-clone         step_clean_clone
fs_run 03-spec-hash           step_spec_hash
fs_run 04-freshness-selftest  step_freshness_selftest
fs_run 05-reproduce-g1        step_reproduce_g1
fs_run 06-reproduce-g2        step_reproduce_g2
fs_run 07-reproduce-g3        step_reproduce_g3
fs_run 08-compare             step_compare
fs_run 09-report              step_report
fs_run 10-docs                step_docs

echo "[G4] all steps passed; teardown (clone removal + docker-state proof + W-1 cleanup) runs next"
echo "[G4] and must also succeed"
