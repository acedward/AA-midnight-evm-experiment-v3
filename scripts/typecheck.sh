#!/usr/bin/env bash
# Typecheck the harness, tolerating EXACTLY the errors inherited from the base commit — and nothing
# else. EXPERIMENTAL_LANE / LANE-DEV-1.
#
# WHY THIS IS NOT JUST `tsc --noEmit`: the tree 00006 forks from does not typecheck. At the base commit
# `e9701e9`, `harness/src/wallet.ts:66` fails with
#
#   error TS2322: Type '{ txHistoryStorage: ...; }' is not assignable to type 'never'
#
# because the pinned `WalletFacade.init`'s `InitParams<TConfig>` resolves `configuration` to `never`
# for the sub-wallet composition the pinned SDK's OWN e2e helper uses. It is a defect in the pinned
# types, not in the harness: the code runs, and 00005 proved 18 ledger rows with it. 00005's gate
# wrappers simply never ran `tsc`, so it was never surfaced.
#
# Two wrong reactions, both rejected:
#   * drop the typecheck step — then none of 00006's new code is typechecked at all;
#   * "fix" wallet.ts with a cast — that edits inherited, working, gate-green code to satisfy a broken
#     type, and it is not this plan's business.
#
# So: run `tsc`, subtract the KNOWN BASELINE, and fail on anything left. New code is fully checked, the
# inherited defect is recorded rather than hidden, and the moment the baseline stops reproducing (a pin
# change, or somebody fixing it) this script says so instead of quietly widening.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/harness"

# One entry per tolerated error, matched on `file(line,col): error CODE:` — the message text is not
# matched, because it is a 400-character type dump that reflows between TypeScript patch versions.
BASELINE=(
  "src/wallet.ts(66,5): error TS2322:"
)

OUT="$(npx tsc --noEmit 2>&1 || true)"
echo "-- tsc output"
echo "$OUT" | sed 's/^/    /'

ERRORS="$(printf '%s\n' "$OUT" | grep -E '^[^ ].*: error TS[0-9]+:' || true)"
if [ -z "$ERRORS" ]; then
  echo
  echo "typecheck: CLEAN — no errors at all."
  echo "NOTE: the inherited baseline no longer reproduces. That is good news, but this script's"
  echo "BASELINE list is now stale and should be emptied deliberately rather than left to rot."
  exit 0
fi

echo
echo "-- classifying $(printf '%s\n' "$ERRORS" | wc -l | tr -d ' ') error line(s)"
rc=0
matched=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  tolerated=0
  for b in "${BASELINE[@]}"; do
    case "$line" in
      *"$b"*) tolerated=1; break ;;
    esac
  done
  if [ "$tolerated" -eq 1 ]; then
    matched=$((matched + 1))
    echo "    INHERITED (tolerated): ${line%%:*}"
  else
    echo "    NEW ERROR: $line"
    rc=1
  fi
done <<< "$ERRORS"

echo
echo "inherited-baseline errors matched: ${matched} of ${#BASELINE[@]} expected"
if [ "$matched" -ne "${#BASELINE[@]}" ]; then
  echo "BASELINE MISMATCH: an expected inherited error did not appear. Do not widen the list to make"
  echo "this pass — work out which pin or file moved." >&2
  rc=1
fi

if [ "$rc" -eq 0 ]; then
  echo "typecheck: PASS — every error is a known inherited one; 00006's own code is clean."
else
  echo "typecheck: FAIL" >&2
fi
exit "$rc"
