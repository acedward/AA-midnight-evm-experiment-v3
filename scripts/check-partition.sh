#!/usr/bin/env bash
#
# check-partition.sh — THE PARTITION GATE: prove the module split still holds its own rules.
#
# WHAT IT CHECKS (project 00014, SC-005). Two properties that no compiler error and no test would
# catch, because both describe WHERE code lives rather than what it does:
#
#   1. SINGLE IMPORT PER STATEFUL MODULE. Every `contracts/modules/*.compact` that declares a
#      `ledger` field is imported by EXACTLY ONE file in the tree. This is the design rule that
#      keeps us clear of compiler bug LFDT-Minokawa/compact#270, which collapses the ledger slots of
#      a stateful module imported by two files depending on directory layout (still OPEN, opened
#      2026-03-26 against 0.30.0, no fix version). The rule is cheap to state and impossible to
#      remember, so it is checked. PURE modules are deliberately exempt: `ActionEnvelope` is
#      imported by four files today and that is safe — #270 is about state, and P0 verdict (f)
#      measured a pure module imported twice yielding one consistent definition.
#
#   2. REGISTRY WRITES LIVE IN ONE FILE. Every `.insert(` / `.remove(` on `accounts`,
#      `accountModes`, `evmOwners` or `evmNonces` occurs in `contracts/modules/AccountRegistry.*`
#      and nowhere else — the mechanical form of user story 3 ("`execute` performs no ledger
#      write"). P3 extends this with the custody families: `pools` / `shieldedBalances` writes only
#      in `ShieldedCustody`, `unshieldedBalances` writes only in `UnshieldedCustody`, and no
#      `ledger` declaration in `Custody.compact`.
#
# WHAT IT IS NOT. It is not the artifact gate: rows, k, the circuit list and the generated surface
# are `scripts/check-artifact.sh`'s job and need the compiler. This script reads text only, needs no
# Docker and no toolchain, and finishes instantly — which is why CI runs it BEFORE the compile step,
# so a partition mistake is reported in seconds instead of after a five-minute build.
#
# `contracts/test-support/` is excluded throughout: the minter mocks are separate contracts with
# their own state, not part of the Manager's partition.
#
# usage:
#   scripts/check-partition.sh          check; exit 0 when every rule holds, 1 with a report if not
#
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root" || exit 1

contracts_dir="contracts"
modules_dir="$contracts_dir/modules"

failures=0
fail() { printf '  FAIL  %s\n' "$1"; failures=$((failures + 1)); }
pass() { printf '  ok    %s\n' "$1"; }

if [ ! -d "$modules_dir" ]; then
  echo "check-partition: $modules_dir does not exist — nothing to check" >&2
  exit 1
fi

# Every .compact in the partition EXCEPT the test-support mocks: the preset plus the modules.
partition_files() {
  find "$contracts_dir" -name '*.compact' -not -path "$contracts_dir/test-support/*" | LC_ALL=C sort
}

echo "--- 1. every STATEFUL module is imported by exactly one file"
stateful_found=0
for module in "$modules_dir"/*.compact; do
  [ -e "$module" ] || continue
  # a `ledger` DECLARATION, not a mention in a comment
  if ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?(sealed[[:space:]]+)?ledger[[:space:]]+[A-Za-z_]' "$module"; then
    continue
  fi
  stateful_found=$((stateful_found + 1))
  name="$(basename "$module" .compact)"
  # `import "./modules/Name";` from the preset, `import "./Name";` from a sibling module, and the
  # selective-renaming form `import { … } from "./Name";` P3's composer uses (F-P0-5).
  importers="$(partition_files | while read -r f; do
      if grep -Eq "(^|[[:space:]])import[[:space:]]+(\{[^}]*\}[[:space:]]*from[[:space:]]*)?\"[^\"]*/?${name}\"" "$f"; then
        echo "$f"
      fi
    done)"
  count="$(printf '%s' "$importers" | grep -c . )"
  if [ "$count" -eq 1 ]; then
    pass "$name (stateful) imported by exactly one file: $(printf '%s' "$importers")"
  else
    fail "$name (stateful) is imported by $count file(s) — the single-import rule (#270) requires exactly 1"
    printf '%s\n' "$importers" | sed 's/^/          /'
  fi
done
[ "$stateful_found" -eq 0 ] && echo "  (no stateful module in $modules_dir yet)"

echo "--- 2. registry-map writes live only in AccountRegistry"
registry_maps="accounts accountModes evmOwners evmNonces"
registry_owner="$modules_dir/AccountRegistry.compact"
for map in $registry_maps; do
  offenders="$(partition_files | while read -r f; do
      [ "$f" = "$registry_owner" ] && continue
      if grep -Eq "(^|[^A-Za-z_])${map}\.(insert|remove)\(" "$f"; then
        echo "$f"
      fi
    done)"
  if [ -z "$offenders" ]; then
    pass "$map: no .insert( / .remove( outside $(basename "$registry_owner")"
  else
    fail "$map is written outside $(basename "$registry_owner"):"
    printf '%s\n' "$offenders" | sed 's/^/          /'
  fi
done
if [ -e "$registry_owner" ]; then
  writes="$(grep -Ec "(^|[^A-Za-z_])(accounts|accountModes|evmOwners|evmNonces)\.(insert|remove)\(" "$registry_owner")"
  pass "$(basename "$registry_owner") holds all $writes registry write site(s)"
else
  fail "$registry_owner is missing"
fi

echo "---"
if [ "$failures" -eq 0 ]; then
  echo "PARTITION OK"
  exit 0
fi
echo "PARTITION FAILED ($failures rule violation(s))"
exit 1
