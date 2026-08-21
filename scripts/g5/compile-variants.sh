#!/usr/bin/env bash
# Compile the Plan 05 / G5 mitigation-rig VARIANTS inside the pinned compiler image.
#
#   --skip-zk (default)   TypeScript + ZKIR only — enough for the OFFLINE placement model and the
#                         offline unit suites, and enough to answer "does this arm compile at all?"
#   --zk                  also produce prover/verifier keys, which the offline deploy coster
#                         (`diag-deploy-cost.ts`) needs and which a live deploy requires.
#
# Output goes to `harness/generated{,-zk}/<variant>` — the SAME layout the three shipped contracts
# use, which is exactly why `diag-deploy-cost.ts::loadArbitrary` and the G5 variant loader can wrap
# any of them with no per-variant wiring.
#
# A VARIANT THAT DOES NOT COMPILE IS A RECORDED ARM VERDICT, NOT A GATE FAILURE (Plan 05, gate G5).
# So this script does not `set -e` across the variant loop: it compiles each one independently,
# records the verbatim compiler output per variant under `evidence/g5-mitigation/compile/`, and exits
# non-zero ONLY if a variant that is required for the rig to mean anything (the control) failed.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"

IMAGE="$COMPACTC_IMAGE"
MODE="${1:---skip-zk}"
EVID="$ROOT/evidence/g5-mitigation/compile"
mkdir -p "$EVID"

# The control MUST compile — every arm is measured against it, so a broken control invalidates the
# whole matrix rather than producing one arm verdict.
REQUIRED=(v4-slim)
ARMS=(arm-a-dedupe arm-b-nested arm-c-both arm-d-unified arm-e-escrow)

if [ "$MODE" = "--zk" ]; then
  OUT="harness/generated-zk"; FLAGS=()
else
  OUT="harness/generated"; FLAGS=(--skip-zk)
fi

# DO NOT try to (re)build the compiler image — REQUIRE it. Finding F-316: the pinned archive
# `compactc_v0.33.0_aarch64-unknown-linux-musl.zip` has been REMOVED from its GitHub release
# (verified: `HTTP/2 404`, `server: github.com`, `content-length: 9` = the body "Not Found", while
# `api.github.com` answers 200 from the same host — so this is upstream asset removal, not a network
# fault). `compactc_ensure_image` would therefore fail the archive's SHA-256 check and take the whole
# gate down with a message about a checksum, which reads like a tampering alarm rather than a missing
# file. The locally cached image IS the pinned toolchain and is LANE-DEV-1 verified; this asserts it is
# present and says exactly what to do if it is not.
#
# The `docker image inspect` probe is retried: it has been observed to fail spuriously on this host
# (twice during this plan's execution, both times with the image demonstrably present), and a spurious
# absence would trigger exactly the misleading rebuild described above.
require_compiler_image() {
  local attempt
  for attempt in 1 2 3; do
    if docker image inspect "$IMAGE" >/dev/null 2>&1; then
      echo "[g5-compile] compiler image ${IMAGE} present (attempt ${attempt})"
      docker run --rm "$IMAGE" compactc --version | sed 's/^/[g5-compile] compactc /'
      return 0
    fi
    echo "[g5-compile] docker image inspect ${IMAGE} failed (attempt ${attempt}/3); retrying" >&2
    sleep 2
  done
  cat >&2 <<EOF
[g5-compile] FATAL: the pinned compiler image ${IMAGE} is not present on this host, and it CANNOT be
[g5-compile] rebuilt: finding F-316 — the pinned archive
[g5-compile]   ${COMPACTC_URL_FOR_MESSAGE}
[g5-compile] has been removed from its GitHub release (HTTP 404 from github.com itself). Recover the
[g5-compile] image from another host that still has it (\`docker save\` / \`docker load\`), or from any
[g5-compile] of the sibling project images aa00003/aa00004/aa00005-compactc:0.33.0 which are the SAME
[g5-compile] toolchain under different tags. Do NOT re-pin the compiler: the lane is inherited and
[g5-compile] never re-pinned (owner Q2 -> A).
EOF
  return 1
}
COMPACTC_URL_FOR_MESSAGE="https://github.com/midnightntwrk/compact/releases/download/compactc-v0.33.0/compactc_v0.33.0_aarch64-unknown-linux-musl.zip"
require_compiler_image || exit 1

status_file="$EVID/STATUS-${MODE#--}.tsv"
: > "$status_file"
failed_required=0
compiled=0
failed=0

for v in "${REQUIRED[@]}" "${ARMS[@]}"; do
  src="contracts/variants/${v}.compact"
  if [ ! -f "$src" ]; then
    printf '%s\tMISSING\t-\n' "$v" >> "$status_file"
    echo "[g5-compile] ${v}: NO SOURCE at ${src} — recorded as a missing arm"
    failed=$((failed + 1))
    continue
  fi
  echo "[g5-compile] compiling ${v} (${MODE}) -> ${OUT}/${v}"
  rm -rf "${OUT:?}/${v}"
  mkdir -p "${OUT}/${v}"
  log="$EVID/${v}-${MODE#--}.out"
  if docker run --rm -v "$PWD:/work" "$IMAGE" \
      compactc ${FLAGS[@]+"${FLAGS[@]}"} "$src" "${OUT}/${v}" > "$log" 2>&1; then
    nzkir=$(find "${OUT}/${v}" -name '*.zkir' 2>/dev/null | wc -l | tr -d ' ')
    nvk=$(find "${OUT}/${v}" -name '*.verifier' 2>/dev/null | wc -l | tr -d ' ')
    printf '%s\tCOMPILED\t%s\t%s\n' "$v" "$nvk" "$nzkir" >> "$status_file"
    echo "[g5-compile] ${v}: COMPILED (${nzkir} zkir, ${nvk} verifier keys)"
    compiled=$((compiled + 1))
  else
    printf '%s\tFAILED\t-\n' "$v" >> "$status_file"
    echo "[g5-compile] ${v}: **DID NOT COMPILE** — verbatim output kept at ${log#"$ROOT/"}"
    sed -n '1,25p' "$log" | sed 's/^/[g5-compile]   /'
    failed=$((failed + 1))
    for r in "${REQUIRED[@]}"; do
      [ "$v" = "$r" ] && failed_required=1
    done
  fi
done

echo
echo "[g5-compile] ${compiled} compiled, ${failed} not; status table at ${status_file#"$ROOT/"}"
if [ "$failed_required" -ne 0 ]; then
  echo "[g5-compile] FATAL: the CONTROL fixture failed to compile. Every arm is measured against it," >&2
  echo "[g5-compile] so this is a rig defect, not an arm verdict." >&2
  exit 1
fi
exit 0
