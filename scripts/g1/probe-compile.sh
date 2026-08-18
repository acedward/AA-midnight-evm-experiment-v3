#!/usr/bin/env bash
# G1 Phase 3 — compile probes P1(a)(b)(c) and P2 on the PINNED compiler.
#
# These probes decide D-101 (Manager custody representation) BEFORE any Manager code is written,
# and answer the FR-101 constructor question. Every probe's VERBATIM compiler output — stdout,
# stderr and exit code, success or failure — is written to evidence/g1-lane/probes/.
#
# A probe that FAILS to compile is a legitimate, recorded result, not an error of this script:
# the script's own exit code reflects only whether the MANDATORY probes were conclusive.
#
#   P1(a) Map<Bytes<32>, Uint<128>> with persistentHash composite keys   — mandatory
#   P1(b) Map<Bytes<32>, QualifiedShieldedCoinInfo>, insertCoin/lookup/  — mandatory, DECIDES D-101
#         sendShielded/change
#   P1(c) nested Map<Bytes<32>, Map<Bytes<32>, Uint<128>>>               — informational
#   P2    constructor(Bytes<32>) writing derived separators to ledger    — mandatory (compile half)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"

EVID="$ROOT/evidence/g1-lane/probes"
OUT="$ROOT/harness/generated-probes"
mkdir -p "$EVID"

compactc_ensure_image "$ROOT"

VERDICTS="$EVID/VERDICTS.md"
: > "$VERDICTS"
{
  echo "# Compile probes P1 / P2 — verdicts"
  echo
  echo "\`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\` — 00004-multi-token-custody, Plan 01 Phase 3."
  echo
  echo "Compiler: \`$(docker run --rm "$COMPACTC_IMAGE" compactc --version | tr -d '[:space:]')\`"
  echo " / language \`$(docker run --rm "$COMPACTC_IMAGE" compactc --language-version | tr -d '[:space:]')\`"
  echo " (image \`${COMPACTC_IMAGE}\`, archive pinned by SHA-256 in \`docker/compactc.Dockerfile\`)"
  echo
  echo "Recorded (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "| Probe | Shape | Mode | Exit | Verdict |"
  echo "|---|---|---|---|---|"
} >> "$VERDICTS"

FAILED_MANDATORY=0

# probe <id> <source-stem> <mode:--skip-zk|--zk> <mandatory:yes|no> <description>
probe() {
  local id="$1" stem="$2" mode="$3" mandatory="$4" desc="$5"
  local log="$EVID/${id}.out" rc=0 verdict
  local dest="${OUT}/${id}"

  rm -rf "${dest:?}"
  mkdir -p "$dest"

  {
    echo "# probe ${id} — ${desc}"
    echo "# source:   contracts/probes/${stem}.compact"
    echo "# mode:     ${mode}"
    echo "# image:    ${COMPACTC_IMAGE}"
    echo "# utc:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# argv:     compactc ${mode} contracts/probes/${stem}.compact ${OUT#"$ROOT"/}/${id}"
    echo "# ---------------- verbatim compiler output below ----------------"
  } > "$log"

  set +e
  if [ "$mode" = "--zk" ]; then
    docker run --rm -v "$PWD:/work" "$COMPACTC_IMAGE" \
      compactc "contracts/probes/${stem}.compact" "${OUT#"$ROOT"/}/${id}" >> "$log" 2>&1
  else
    docker run --rm -v "$PWD:/work" "$COMPACTC_IMAGE" \
      compactc --skip-zk "contracts/probes/${stem}.compact" "${OUT#"$ROOT"/}/${id}" >> "$log" 2>&1
  fi
  rc=$?
  set -e

  {
    echo "# ---------------- end verbatim output ----------------"
    echo "# exit: ${rc}"
  } >> "$log"

  if [ "$rc" -eq 0 ]; then
    verdict="**PASS**"
    echo "[probe] ${id}: PASS (${mode})"
    # Record what was produced, as corroboration that the compile was real.
    {
      echo "# artifacts produced:"
      find "$dest" -type f | sed "s|^${ROOT}/|#   |" | sort
    } >> "$log"
  else
    verdict="**FAIL**"
    echo "[probe] ${id}: FAIL (${mode}, exit ${rc}) — see ${log#"$ROOT"/}"
    sed -n '/end verbatim/!p' "$log" | tail -20
    if [ "$mandatory" = "yes" ]; then FAILED_MANDATORY=1; fi
  fi

  printf '| `%s` | %s | `%s` | %s | %s |\n' "$id" "$desc" "$mode" "$rc" "$verdict" >> "$VERDICTS"
  return 0
}

echo "[probes] EXPERIMENTAL_LANE / LANE-DEV-1 — P1/P2 on pinned compactc 0.33.0"

# --- P1: colour-keyed custody shapes, in increasing order of demand ----------------------------
probe p1a p1a-map-scalar   --skip-zk yes "\`Map<Bytes<32>, Uint<128>>\` + \`persistentHash\` composite keys"
probe p1b p1b-map-coin     --skip-zk yes "\`Map<Bytes<32>, QualifiedShieldedCoinInfo>\` insertCoin/lookup/sendShielded/change"
probe p1c p1c-nested-map   --skip-zk no  "nested \`Map<Bytes<32>, Map<Bytes<32>, Uint<128>>>\` (informational)"

# P1(b) decides D-101, so it gets the stronger evidence too: a FULL ZK compile proves the shape is
# not merely type-correct but provable (prover/verifier keys actually generate).
if grep -q '^| `p1b` .* \*\*PASS\*\* |$' "$VERDICTS"; then
  probe p1b-zk p1b-map-coin --zk yes "P1(b) again with FULL ZK key generation"
else
  echo "[probes] P1(b) failed on --skip-zk; skipping its --zk confirmation"
  printf '| `p1b-zk` | %s | `--zk` | - | _skipped: P1(b) failed_ |\n' \
    "P1(b) again with FULL ZK key generation" >> "$VERDICTS"
fi

# --- P2: constructor-fed ledger state (compile half) --------------------------------------------
# Compiled with FULL ZK because the deploy half of P2 needs prover/verifier keys.
probe p2 p2-constructor-tag --zk yes "\`constructor(Bytes<32>)\` writing derived separators to ledger cells"

{
  echo
  if [ "$FAILED_MANDATORY" -eq 0 ]; then
    echo "All mandatory probes compiled."
  else
    echo "AT LEAST ONE MANDATORY PROBE FAILED — see the per-probe logs above."
  fi
} >> "$VERDICTS"

echo
echo "[probes] verdict table: ${VERDICTS#"$ROOT"/}"
cat "$VERDICTS"

exit "$FAILED_MANDATORY"
