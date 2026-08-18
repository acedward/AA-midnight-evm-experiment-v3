#!/usr/bin/env bash
# G2 gate wrapper — 00004-multi-token-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Runs Plan 02 end to end from nothing:
#
#   probe ports -> prove the lane is still the REUSED one -> prove LANE-DEV-1 -> compile (fast)
#   -> install harness -> simulator/unit suites -> compile (full ZK) -> pull pinned digests -> boot
#   -> host health checks -> deploy 3 Minters (TOKA/TOKB/TOKC) + 1 Manager, read the six colours
#   on-chain, assert 15/15 pairwise distinct, configure, register AA_A/AA_B, run the unit-level
#   negatives -> record artifact hashes -> teardown
#
# Fail-safe contract (inherited from 00003): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC
# recorded before each command and duration/exit after, and a TEARDOWN FAILURE REPLACES an
# otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above
# 10000, bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/lane-pins.sh
source "$ROOT/scripts/lib/lane-pins.sh"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"

EVID="$ROOT/evidence/g2-contracts"
fs_init "G2" "$EVID" "$@"

IMAGE="$COMPACTC_IMAGE"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or
# any concurrent run on this shared host.
PROJECT="aa00004-g2-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed — INCLUDING the residue check.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT}"

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# The lane is REUSED, never re-pinned (Plan 01 Phase 2). Re-asserted here so a G2 run is
# self-contained evidence rather than a claim resting on G1's run.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
step_unit_suites()  { (cd "$ROOT/harness" && npx vitest run); }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

step_pull()   { "${COMPOSE[@]}" pull; }
step_boot()   { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }

# Plan 02 Phase 3 — the whole live half of this gate.
step_deploy_configure() { (cd "$ROOT/harness" && npx tsx src/g2/deploy-configure.ts); }

# Record what was built: circuit lists, artifact inventory and verifier-key hashes.
step_record_artifacts() {
  local out="$EVID/ARTIFACTS.md"
  {
    echo "# G2 build artifacts — \`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\`"
    echo
    echo "00004-multi-token-custody, Plan 02. Compiled by the pinned image \`${IMAGE}\` (archive"
    echo "pinned by SHA-256 in \`docker/compactc.Dockerfile\`)."
    echo
    echo "Recorded (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "Compiler: compactc $(docker run --rm "$IMAGE" compactc --version | tr -d '[:space:]')"
    echo "Language: $(docker run --rm "$IMAGE" compactc --language-version | tr -d '[:space:]')"
    echo
    echo "## Source hashes"
    echo
    echo "| Source | SHA-256 | bytes |"
    echo "|---|---|---|"
    for c in minter manager; do
      printf '| `contracts/%s.compact` | `%s` | %s |\n' \
        "$c" \
        "$(shasum -a 256 "$ROOT/contracts/${c}.compact" | cut -d' ' -f1)" \
        "$(wc -c < "$ROOT/contracts/${c}.compact" | tr -d ' ')"
    done
    echo
    for c in minter manager; do
      echo "## ${c}"
      echo
      python3 - "$ROOT/harness/generated-zk/${c}/compiler/contract-info.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print(f"- compiler-version: `{d['compiler-version']}`")
print(f"- language-version: `{d['language-version']}`")
print(f"- runtime-version: `{d['runtime-version']}`")
ws=d.get('witnesses') or []
print(f"- witnesses: {', '.join('`'+w['name']+'`' for w in ws) if ws else '(none)'}")
print(f"- circuits ({len(d.get('circuits',[]))}): {', '.join('`'+x['name']+'`' for x in d.get('circuits',[]))}")
PY
      echo
      echo "| Artifact | SHA-256 | bytes |"
      echo "|---|---|---|"
      printf '| `contract/index.js` | `%s` | %s |\n' \
        "$(shasum -a 256 "$ROOT/harness/generated-zk/${c}/contract/index.js" | cut -d' ' -f1)" \
        "$(wc -c < "$ROOT/harness/generated-zk/${c}/contract/index.js" | tr -d ' ')"
      for v in "$ROOT/harness/generated-zk/${c}/keys/"*.verifier; do
        [ -e "$v" ] || continue
        printf '| `keys/%s` | `%s` | %s |\n' \
          "$(basename "$v")" \
          "$(shasum -a 256 "$v" | cut -d' ' -f1)" \
          "$(wc -c < "$v" | tr -d ' ')"
      done
      echo
    done
    echo "## Deployment and configure evidence"
    echo
    echo "- \`deploy-configure.json\` — machine-readable result of Plan 02 Phase 3"
    echo "- \`CONTRACTS.md\` — deployments, the six colours, 15/15 distinctness, configure state,"
    echo "  the seeded table and the unit-level negatives with verbatim errors"
    echo "- \`11-deploy-configure.out\` — the verbatim console log of that step"
  } > "$out"
  echo "wrote $out"
  grep -c '^| `' "$out" | sed 's/^/artifact rows: /'
}

echo "[G2] EXPERIMENTAL_LANE / LANE-DEV-1 — building, deploying and configuring the 00004 contracts"
echo "[G2] compose project: ${PROJECT}"
fs_run 01-probe-ports       step_probe_ports
fs_run 02-lane-reuse        step_lane_reuse
fs_run 03-lane-dev-1        step_lane_dev_1
fs_run 04-compile-fast      step_compile_fast
fs_run 05-install           step_install
fs_run 06-unit-suites       step_unit_suites
fs_run 07-compile-zk        step_compile_zk
fs_run 08-pull              step_pull
fs_run 09-boot              step_boot
fs_run 10-health            step_health
fs_run 11-deploy-configure  step_deploy_configure
fs_run 12-record-artifacts  step_record_artifacts

echo "[G2] all steps passed; teardown runs next and must also succeed"
