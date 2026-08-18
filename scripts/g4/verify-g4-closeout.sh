#!/usr/bin/env bash
# G4 gate wrapper — 00003-contract-token-custody (EXPERIMENTAL_LANE, LANE-DEV-1).
#
# Proves SC-004: the whole demonstration reproduces FROM A CLEAN CLONE with no manual step beyond
# the documented bootstrap. It clones this repository into a fresh temporary directory, runs the
# G2 and G3 gate wrappers inside that clone against a fresh stack, compares the reproduced cell
# results against the originals, and removes only that exact temporary path.
#
# Fail-safe contract (master plan): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC recorded
# before each command, duration/exit after, and a TEARDOWN FAILURE REPLACES an otherwise-zero
# result. The gate is green only if this process exits 0.
#
# SHARED HOST: the clone lives under `mktemp -d`, the reproduction stack is created by the G3
# wrapper under its own unique compose project name, and teardown removes only that path and this
# project's own containers/volumes. No other project on the machine is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"

EVID="$ROOT/evidence/g4-closeout"
fs_init "G4" "$EVID" "$@"

CLONE_PARENT=""
CLONE=""

# Remove ONLY the temporary clone this run created, after validating the path is exactly that.
# An unvalidated `rm -rf` on a shared machine is the failure mode this guard exists to prevent.
cleanup_clone() {
  if [ -z "$CLONE_PARENT" ]; then
    echo "no temporary clone was created; nothing to remove"
    return 0
  fi
  case "$CLONE_PARENT" in
    /tmp/*|/private/var/folders/*|/var/folders/*) ;;
    *) echo "REFUSING to remove '$CLONE_PARENT': not under a temporary directory" >&2; return 1 ;;
  esac
  [ -d "$CLONE_PARENT" ] || { echo "temporary clone path already gone: $CLONE_PARENT"; return 0; }
  [ "$CLONE_PARENT" != "$ROOT" ] || { echo "REFUSING to remove the workspace itself" >&2; return 1; }
  echo "removing temporary clone parent: $CLONE_PARENT"
  rm -rf "$CLONE_PARENT"
  [ ! -d "$CLONE_PARENT" ] || { echo "temporary clone still present after removal" >&2; return 1; }
  echo "temporary clone removed"
}

# Teardown: remove the temporary clone, then prove no container or volume of this project is left.
step_teardown() {
  cleanup_clone
  # Any long-lived development stack this project created is torn down here too, so closeout
  # really does leave nothing of THIS project behind. Naming the project explicitly keeps the
  # blast radius to it; other projects on this shared host are never matched.
  echo "-- bringing down this project's development stack (no-op if absent)"
  docker compose -p aa00003-token-custody down -v --remove-orphans 2>&1 || true
  echo "-- containers matching this project:"
  docker ps -a --filter 'name=aa00003' --format '{{.Names}}\t{{.Status}}' || true
  echo "-- volumes matching this project:"
  docker volume ls --filter 'name=aa00003' --format '{{.Name}}' || true
  local c v
  c="$(docker ps -a --filter 'name=aa00003' --format '{{.Names}}' | wc -l | tr -d ' ')"
  v="$(docker volume ls --filter 'name=aa00003' --format '{{.Name}}' | wc -l | tr -d ' ')"
  echo "remaining containers: ${c}, remaining volumes: ${v}"
  [ "$c" = "0" ] && [ "$v" = "0" ]
}
fs_set_teardown "step_teardown"

# --- Phase 1: clean clone ------------------------------------------------------------------------
step_clean_clone() {
  CLONE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/aa00003-g4-XXXXXX")"
  CLONE="$CLONE_PARENT/clone"
  echo "temporary clone parent: $CLONE_PARENT"
  git clone --branch "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)" "$ROOT" "$CLONE"
  echo "cloned commit: $(git -C "$CLONE" rev-parse HEAD)"
  echo "source commit: $(git -C "$ROOT" rev-parse HEAD)"
  # A clean clone must carry NO generated artifacts, no docker/.env and no node_modules — if it
  # did, the reproduction would be reusing this working tree's state instead of rebuilding.
  local dirty=0
  for p in docker/.env harness/node_modules harness/generated harness/generated-zk; do
    if [ -e "$CLONE/$p" ]; then echo "CLEAN-CLONE VIOLATION: $p is present in the clone"; dirty=1; fi
  done
  [ "$dirty" = "0" ] || return 1
  echo "clone is clean: no generated artifacts, no docker/.env, no node_modules"
  # Record for later steps, since each fs_run executes in this same shell.
  echo "$CLONE" > "$EVID/clone-path.txt"
}

# --- Phase 1: reproduce G2 and G3 inside the clone -------------------------------------------------
step_reproduce_g2() { (cd "$CLONE" && ./scripts/g2/verify-g2-contracts.sh); }
step_reproduce_g3() { (cd "$CLONE" && ./scripts/g3/verify-g3-ledger.sh); }

# --- Phase 1: compare the reproduced cell results with the originals ---------------------------------
step_compare_cells() {
  python3 - "$ROOT/evidence/g3-ledger/cells.json" "$CLONE/evidence/g3-ledger/cells.json" <<'PY'
import json, sys
orig = {c['id']: c for c in json.load(open(sys.argv[1]))['cells']}
repro = {c['id']: c for c in json.load(open(sys.argv[2]))['cells']}
missing = sorted(set(orig) - set(repro))
extra   = sorted(set(repro) - set(orig))
differ  = sorted(i for i in set(orig) & set(repro)
                 if (orig[i]['status'], orig[i]['level'], orig[i]['step'])
                 != (repro[i]['status'], repro[i]['level'], repro[i]['step']))
print(f"original cells:   {len(orig)}")
print(f"reproduced cells: {len(repro)}")
# Transaction ids MUST differ (a fresh chain), so only the verdict, the composition level and the
# step are compared — those are what the specification asserts.
for i in sorted(orig):
    if i in repro:
        print(f"  {repro[i]['status']:5} {i}  step {repro[i]['step']}  level {repro[i]['level']}")
if missing: print("MISSING in reproduction:", missing)
if extra:   print("EXTRA in reproduction:", extra)
if differ:  print("DIVERGENT verdicts:", differ)
sys.exit(1 if (missing or extra or differ) else 0)
PY
}

step_final_report() { (cd "$ROOT/harness" && npx tsx src/g4/report.ts "$CLONE"); }

echo "[G4] EXPERIMENTAL_LANE / LANE-DEV-1 — reproducing the whole demonstration from a clean clone"
fs_run 01-clean-clone     step_clean_clone
fs_run 02-reproduce-g2    step_reproduce_g2
fs_run 03-reproduce-g3    step_reproduce_g3
fs_run 04-compare-cells   step_compare_cells
fs_run 05-final-report    step_final_report

echo "[G4] all steps passed; teardown (clone removal + docker-state proof) runs next and must also succeed"
