#!/usr/bin/env bash
# G4 gate wrapper — 00004-multi-token-custody (EXPERIMENTAL_LANE, LANE-DEV-1).
#
# Proves the specification's last success criterion: the WHOLE demonstration reproduces from a clean
# clone with ONE command. It clones this repository into a fresh temporary directory, runs the G1, G2
# and G3 gate wrappers inside that clone — each against a fresh stack of its own — compares the
# reproduced results against the retained originals, re-verifies the approved specification is
# byte-identical, renders REPORT.md, and checks the closeout documents are actually present.
#
# The comparison is deliberately hostile to itself: retained evidence is COMMITTED, so `git clone`
# carries the original run's `evidence/` into the clone and the clone's own run then overwrites it.
# A comparison that only checked verdicts could therefore pass against the very files it was meant to
# reproduce. So it first proves the clone's evidence is genuinely its own — different contract
# addresses, different colours, and ZERO transaction ids in common — and only then compares what the
# specification asserts.
#
# Fail-safe contract (inherited): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC recorded
# before each command and duration/exit after, and a TEARDOWN FAILURE REPLACES an otherwise-zero
# result. The gate is green only if this process exits 0.
#
# SHARED HOST: the clone lives under `mktemp -d`; each reproduced gate creates its own uniquely named
# compose project on ports it verified free above 10000 and tears it down itself; this wrapper's
# teardown removes only that exact temporary path and then proves no container, volume or network of
# THIS project survived. No other project on the machine is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"

EVID="$ROOT/evidence/g4-closeout"
fs_init "G4" "$EVID" "$@"

CLONE_PARENT=""
CLONE=""

# The approved specification lives in the ORGANIZER repository, not in this product repo, so its
# byte-identity check needs a path. It is checked for real on the authoring host and reported as
# "not present" — never silently skipped — anywhere else.
SPEC_SHA256_EXPECTED="e83897d46d3b2b5af3c42863d4ad49c922c374038a45dc04401ba5cc66e111f6"
SPEC_PATH="${SPEC_PATH:-/Users/edwardalvarado/todo/AA/.claude/worktrees/contract-token-custody-6d6cd3/AA/spec/00004-multi-token-custody.md}"

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
  # Any long-lived development stack this project may have created is brought down here too, so
  # closeout really does leave nothing behind. Naming the project explicitly keeps the blast radius
  # to it; other projects on this shared host are never matched.
  echo "-- bringing down this project's development stack (no-op if absent)"
  docker compose -p aa00004-multi-token-custody down -v --remove-orphans 2>&1 || true
  echo "-- containers matching this project:"
  docker ps -a --filter 'name=aa00004' --format '{{.Names}}\t{{.Status}}' || true
  echo "-- volumes matching this project:"
  docker volume ls --filter 'name=aa00004' --format '{{.Name}}' || true
  echo "-- networks matching this project:"
  docker network ls --filter 'name=aa00004' --format '{{.Name}}' || true
  local c v n
  c="$(docker ps -a --filter 'name=aa00004' --format '{{.Names}}' | wc -l | tr -d ' ')"
  v="$(docker volume ls --filter 'name=aa00004' --format '{{.Name}}' | wc -l | tr -d ' ')"
  n="$(docker network ls --filter 'name=aa00004' --format '{{.Name}}' | wc -l | tr -d ' ')"
  echo "remaining containers: ${c}, volumes: ${v}, networks: ${n}"
  [ "$c" = "0" ] && [ "$v" = "0" ] && [ "$n" = "0" ]
}
fs_set_teardown "step_teardown"

# --- Phase 1: clean clone -------------------------------------------------------------------------
step_clean_clone() {
  CLONE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/aa00004-g4-XXXXXX")"
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
  for p in contracts/minter.compact contracts/manager.compact scripts/g1/verify-g1-lane.sh \
           scripts/g2/verify-g2-contracts.sh scripts/g3/verify-g3-ledger.sh harness/pnpm-lock.yaml; do
    [ -f "$CLONE/$p" ] || { echo "CLONE INCOMPLETE: missing $p"; return 1; }
  done
  echo "clone carries contracts, gate wrappers and the pinned lockfile"
  echo "$CLONE" > "$EVID/clone-path.txt"
}

# --- Phase 2: the approved specification is byte-identical ------------------------------------------
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

# --- Phase 1: reproduce the whole demonstration inside the clone -------------------------------------
step_reproduce_g1() { (cd "$CLONE" && ./scripts/g1/verify-g1-lane.sh); }
step_reproduce_g2() { (cd "$CLONE" && ./scripts/g2/verify-g2-contracts.sh); }
step_reproduce_g3() { (cd "$CLONE" && ./scripts/g3/verify-g3-ledger.sh); }

# --- Phase 1: compare the reproduction with the original ---------------------------------------------
step_compare() {
  python3 - "$ROOT" "$CLONE" <<'PY'
import json, os, sys

root, clone = sys.argv[1], sys.argv[2]
load = lambda base, *parts: json.load(open(os.path.join(base, 'evidence', *parts)))

octx, rctx = load(root, 'g3-ledger', 'run-context.json'), load(clone, 'g3-ledger', 'run-context.json')
ocells = {c['id']: c for c in load(root, 'g3-ledger', 'cells.json')['cells']}
rcells = {c['id']: c for c in load(clone, 'g3-ledger', 'cells.json')['cells']}
octl = {c['id']: c for c in load(root, 'g3-ledger', 'negative-controls.json')['controls']}
rctl = {c['id']: c for c in load(clone, 'g3-ledger', 'negative-controls.json')['controls']}

problems = []

# --- freshness: the reproduction must not be the original's committed evidence wearing a new hat ---
print('== freshness')
print(f"  Manager   original {octx['managerAddress']}")
print(f"            repro    {rctx['managerAddress']}")
if octx['managerAddress'] == rctx['managerAddress']:
    problems.append('the reproduction reports the SAME Manager address as the original — its '
                    'evidence is the committed original, not a fresh run')
for o, r in zip(octx['minters'], rctx['minters']):
    print(f"  {o['label']} ({o['tagText']}) original {o['address']}")
    print(f"  {' ' * len(o['label'])}         repro    {r['address']}")
    if o['address'] == r['address']:
        problems.append(f"{o['label']} has the same address in both runs")
for c in ('S1', 'S2', 'U1', 'U2'):
    if octx['colours'][c] == rctx['colours'][c]:
        problems.append(f'colour {c} is identical in both runs; colours are address-scoped and cannot repeat')
print(f"  colours all differ: {all(octx['colours'][c] != rctx['colours'][c] for c in ('S1','S2','U1','U2'))}")

otx = {t for c in ocells.values() for t in c['txs']} | {octx['mixedColour']['txId']}
rtx = {t for c in rcells.values() for t in c['txs']} | {rctx['mixedColour']['txId']}
shared = otx & rtx
print(f"  transaction ids: {len(otx)} original, {len(rtx)} reproduced, {len(shared)} in common")
if shared:
    problems.append(f'{len(shared)} transaction id(s) appear in BOTH runs; a fresh chain cannot '
                    f'reproduce them: {sorted(shared)[:3]}')

# --- what the specification actually asserts --------------------------------------------------------
print('== checklist')
missing = sorted(set(ocells) - set(rcells))
extra = sorted(set(rcells) - set(ocells))
differ = sorted(i for i in set(ocells) & set(rcells)
                if (ocells[i]['status'], ocells[i]['level'], ocells[i]['step'])
                != (rcells[i]['status'], rcells[i]['level'], rcells[i]['step']))
for i in sorted(rcells, key=lambda k: list(rcells).index(k)):
    print(f"  {rcells[i]['status']:6} {i:22} step {rcells[i]['step']:5} level {rcells[i]['level']}")
notgreen = sorted(i for i, c in rcells.items() if c['status'] != 'GREEN')
print(f"  original {len(ocells)} items, reproduced {len(rcells)} items, "
      f"{sum(1 for c in rcells.values() if c['status'] == 'GREEN')} GREEN")
if missing: problems.append(f'MISSING in the reproduction: {missing}')
if extra: problems.append(f'EXTRA in the reproduction: {extra}')
if differ: problems.append(f'DIVERGENT verdicts: {differ}')
if notgreen: problems.append(f'NOT GREEN in the reproduction: {notgreen}')

# --- the final table is normative in the spec: it must match EXACTLY, value for value ---------------
print('== final 16-cell table + custody')
if octx['finalTable']['table'] != rctx['finalTable']['table']:
    problems.append('the final 16-cell table differs between the runs')
if octx['finalTable']['custody'] != rctx['finalTable']['custody']:
    problems.append('the final custody figures (pools / ledger balances) differ between the runs')
for party, row in rctx['finalTable']['table'].items():
    print(f"  {party:7} " + '  '.join(f'{c}={row[c]}' for c in ('S1', 'S2', 'U1', 'U2')))
print('  custody ' + '  '.join(f"{c}={rctx['finalTable']['custody'][c]}" for c in ('S1', 'S2', 'U1', 'U2')))
# The pooled coin NONCES must differ — same values, different coins, on a different chain.
onon = {c: octx['finalTable']['pools'][c]['nonce'] for c in ('S1', 'S2')}
rnon = {c: rctx['finalTable']['pools'][c]['nonce'] for c in ('S1', 'S2')}
for c in ('S1', 'S2'):
    if onon[c] == rnon[c]:
        problems.append(f'pooled coin nonce for {c} is identical in both runs')
print(f"  pooled coin nonces differ: {onon != rnon}")

# --- distinctness and the mixed-colour probe --------------------------------------------------------
print('== distinctness and M1')
print(f"  distinctness: original {octx['distinctness']['distinct']}/{octx['distinctness']['comparisons']}, "
      f"repro {rctx['distinctness']['distinct']}/{rctx['distinctness']['comparisons']}")
if (rctx['distinctness']['distinct'], rctx['distinctness']['comparisons']) != (15, 15) or rctx['distinctness']['collisions']:
    problems.append('the reproduction did not report 15/15 distinct colours with no collisions')
print(f"  M1 original tx {octx['mixedColour']['txId']}  shape: {octx['mixedColour']['shape']}")
print(f"  M1 repro    tx {rctx['mixedColour']['txId']}  shape: {rctx['mixedColour']['shape']}")
if len(rctx['mixedColour']['circuits']) != 2:
    problems.append('the reproduction did not carry two circuits in the M1 transaction')

# --- the negative controls must reproduce, message match included ------------------------------------
print('== negative controls')
if set(octl) != set(rctl):
    problems.append(f'control sets differ: {sorted(set(octl) ^ set(rctl))}')
for cid in sorted(set(octl) & set(rctl)):
    o, r = octl[cid], rctl[cid]
    ok = (o['status'] == r['status'] == 'GREEN' and r['messageMatched'] and r['fundsUnchanged'])
    print(f"  {r['status']:6} {cid:6} message-matched={r['messageMatched']} funds-unchanged={r['fundsUnchanged']}")
    if not ok:
        problems.append(f'control {cid} did not reproduce GREEN with message matched and funds unchanged')
    if o['reason'] != r['reason']:
        problems.append(f"control {cid} was refused with a DIFFERENT verbatim message:\n"
                        f"      original: {o['reason']}\n      repro:    {r['reason']}")

if problems:
    print('\nREPRODUCTION FAILED:')
    for x in problems:
        print(f'  - {x}')
    sys.exit(1)
print('\nreproduction matches the original item for item, verdict for verdict, and control message for')
print('control message — on a demonstrably different chain, with zero transaction ids in common')
PY
}

# --- Phase 2: render the final report from retained evidence + the clone's own ------------------------
step_report() { (cd "$ROOT/harness" && npx tsx src/g4/report.ts "$CLONE"); }

# --- Phase 2: the closeout documents must actually be there and say what they must --------------------
step_docs() {
  local fail=0 f
  for f in REPORT.md README.md VERIFICATION.md; do
    [ -s "$ROOT/$f" ] || { echo "MISSING or EMPTY: $f"; fail=1; continue; }
    echo "-- $f ($(wc -l < "$ROOT/$f" | tr -d ' ') lines)"
    grep -q 'EXPERIMENTAL_LANE' "$ROOT/$f" || { echo "   $f does not carry the EXPERIMENTAL_LANE label"; fail=1; }
    grep -q 'LANE-DEV-1' "$ROOT/$f" || { echo "   $f does not carry the LANE-DEV-1 deviation label"; fail=1; }
  done
  # The README must carry the 00004 section AND a GitHub-supported Mermaid diagram of the flows.
  grep -q '```mermaid' "$ROOT/README.md" || { echo "README.md has no Mermaid diagram"; fail=1; }
  grep -q '00004' "$ROOT/README.md" || { echo "README.md does not name this project"; fail=1; }
  # 00003's deliverables must remain preserved and untouched by this project.
  [ -f "$ROOT/archive/00003/ARCHIVE.md" ] || { echo "archive/00003/ARCHIVE.md is missing"; fail=1; }
  # Generated artifacts and secrets must never have been committed.
  local tracked
  tracked="$(git -C "$ROOT" ls-files docker/.env 'harness/generated*' '*.verifier' '*.prover' | head -5)"
  [ -z "$tracked" ] || { echo "COMMITTED ARTEFACT VIOLATION: $tracked"; fail=1; }
  echo "-- no generated artifacts, keys or docker/.env are tracked by git"
  [ "$fail" = "0" ]
}

echo "[G4] EXPERIMENTAL_LANE / LANE-DEV-1 — reproducing the whole demonstration from a clean clone"
fs_run 01-clean-clone    step_clean_clone
fs_run 02-spec-hash      step_spec_hash
fs_run 03-reproduce-g1   step_reproduce_g1
fs_run 04-reproduce-g2   step_reproduce_g2
fs_run 05-reproduce-g3   step_reproduce_g3
fs_run 06-compare        step_compare
fs_run 07-report         step_report
fs_run 08-docs           step_docs

echo "[G4] all steps passed; teardown (clone removal + docker-state proof) runs next and must also succeed"
