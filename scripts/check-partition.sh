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
#   2. EVERY LEDGER MAP IS WRITTEN IN THE ONE FILE THAT OWNS IT. Every `.insert(` / `.insertCoin(` /
#      `.remove(` on a map occurs in that map's owning module and nowhere else:
#
#        accounts, accountModes, evmOwners, evmNonces   contracts/modules/AccountRegistry.compact
#        pools, shieldedBalances                        contracts/modules/ShieldedCustody.compact
#        unshieldedBalances                             contracts/modules/UnshieldedCustody.compact
#
#      This is the mechanical form of user stories 1 and 3 ("`execute` performs no ledger write";
#      "every write to a custody map occurs in the family file that owns that map"). `insertCoin` is
#      in the pattern because `pools` is written with it and an `insert`-only rule would miss every
#      pool write there is.
#
#   3. THE COMPOSER AND THE PRESET DECLARE (ALMOST) NO STATE. `Custody.compact` declares no `ledger`
#      field at all — it moves value it does not own, which is what makes "which map did that write
#      land in" answerable by opening the family file it calls (FR-002). `manager.compact` declares
#      exactly one, `deploymentDomain`, and contains no `.insert(` / `.insertCoin(` / `.remove(` of
#      its own (FR-004, SC-005).
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
  # selective-renaming form `import { … } from "./Name";` P3's composer uses (F-P0-5). That last one
  # is written across MANY LINES (one imported name per line), so the file is stripped of line
  # comments and flattened to a single line before matching — a line-based grep sees only the
  # closing `} from "./Name";` and reports the importer count as zero. The path is anchored at a
  # `/` boundary (`"([^"]*/)?Name"`, not `"[^"]*/?Name"`) because otherwise `ShieldedCustody` is a
  # SUFFIX of `UnshieldedCustody` and every importer of one counts as an importer of the other.
  importers="$(partition_files | while read -r f; do
      if sed 's|//.*||' "$f" | tr '\n' ' ' \
         | grep -Eq "(^|[[:space:]])import[[:space:]]+(\{[^}]*\}[[:space:]]*from[[:space:]]*)?\"([^\"]*/)?${name}\"" ; then
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

echo "--- 2. every ledger map is written only in the module that owns it"
# "<owning module basename>:<space-separated map names>"; `insertCoin` is how `pools` is written.
map_owners="AccountRegistry:accounts accountModes evmOwners evmNonces
ShieldedCustody:pools shieldedBalances
UnshieldedCustody:unshieldedBalances"

printf '%s\n' "$map_owners" | while IFS= read -r _row; do :; done   # keep shellcheck quiet
while IFS= read -r row; do
  [ -n "$row" ] || continue
  owner_name="${row%%:*}"
  maps="${row#*:}"
  owner="$modules_dir/$owner_name.compact"
  if [ ! -e "$owner" ]; then
    fail "$owner is missing — nothing owns: $maps"
    continue
  fi
  for map in $maps; do
    offenders="$(partition_files | while read -r f; do
        [ "$f" = "$owner" ] && continue
        if grep -Eq "(^|[^A-Za-z_])${map}\.(insert|insertCoin|remove)\(" "$f"; then
          echo "$f"
        fi
      done)"
    if [ -z "$offenders" ]; then
      pass "$map: no .insert( / .insertCoin( / .remove( outside $owner_name.compact"
    else
      fail "$map is written outside $owner_name.compact:"
      printf '%s\n' "$offenders" | sed 's/^/          /'
    fi
  done
  writes="$(grep -Ec "(^|[^A-Za-z_])($(echo "$maps" | tr ' ' '|'))\.(insert|insertCoin|remove)\(" "$owner")"
  if [ "$writes" -gt 0 ]; then
    pass "$owner_name.compact holds all $writes write site(s) for: $maps"
  else
    fail "$owner_name.compact holds NO write site for any of: $maps — has the state moved?"
  fi
done <<EOF
$map_owners
EOF

echo "--- 3. the composer declares no state and the preset declares only deploymentDomain"
ledger_decls() {
  grep -E '^[[:space:]]*(export[[:space:]]+)?(sealed[[:space:]]+)?ledger[[:space:]]+[A-Za-z_]' "$1" \
    | sed -E 's/^[[:space:]]*(export[[:space:]]+)?(sealed[[:space:]]+)?ledger[[:space:]]+([A-Za-z_][A-Za-z0-9_]*).*/\3/'
}

composer="$modules_dir/Custody.compact"
if [ ! -e "$composer" ]; then
  fail "$composer is missing"
else
  composer_ledgers="$(ledger_decls "$composer")"
  if [ -z "$composer_ledgers" ]; then
    pass "Custody.compact declares no ledger field"
  else
    fail "Custody.compact declares ledger field(s) — the composer must own no state:"
    printf '%s\n' "$composer_ledgers" | sed 's/^/          /'
  fi
fi

preset="$contracts_dir/manager.compact"
if [ ! -e "$preset" ]; then
  fail "$preset is missing"
else
  preset_ledgers="$(ledger_decls "$preset" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')"
  if [ "$preset_ledgers" = "deploymentDomain" ]; then
    pass "manager.compact declares exactly one ledger field: deploymentDomain"
  else
    fail "manager.compact must declare only deploymentDomain, but declares: ${preset_ledgers:-<none>}"
  fi
  preset_writes="$(grep -En '\.(insert|insertCoin|remove)\(' "$preset" || true)"
  if [ -z "$preset_writes" ]; then
    pass "manager.compact contains no .insert( / .insertCoin( / .remove("
  else
    fail "manager.compact writes a ledger map directly — every write belongs in a module:"
    printf '%s\n' "$preset_writes" | sed 's/^/          /'
  fi
fi

echo "---"
if [ "$failures" -eq 0 ]; then
  echo "PARTITION OK"
  exit 0
fi
echo "PARTITION FAILED ($failures rule violation(s))"
exit 1
