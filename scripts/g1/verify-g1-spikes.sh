#!/usr/bin/env bash
# G1 gate wrapper — 00006-unbalanced-zswap (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Runs Plan 01 end to end from nothing:
#
#   adopt W-1 (scratch DOCKER_CONFIG) -> probe ports -> PROVE THE LANE IS INHERITED (not re-pinned),
#   hop by hop across ALL THREE ancestors -> prove LANE-DEV-1 -> compile (fast, then ZK) -> install
#   -> pull pinned digests -> boot -> host health checks -> wallets -> fund + DUST-register + a
#   fee-paying smoke tx -> record LANE.md
#   -> SPIKE S1 (a FOREIGN wallet balances a contract-call tx)
#   -> SPIKE S2 (the 104 / segment-order hypothesis, F-301)
#   -> SPIKE S3 (offer artifact round-trip + decision D-306)
#   -> record SPIKES.md -> teardown
#
# `--smoke` stops after `13-record-lane`. That is exactly Plan 01 PHASE 1's deliverable ("smoke-boot
# one disposable stack and tear it down"), so Phase 1 and gate G1 share ONE wrapper instead of two
# that could drift apart. Smoke evidence goes to evidence/g1-smoke/, the gate's to evidence/g1-lane/.
#
# GATE CONDITION (Plan 01): S1 GREEN is REQUIRED. S2 is green evidence either way — CONFIRMED and
# REFUTED are both results. S3 must pass for at least one artifact form. The spike programs enforce
# their own verdicts by exit code, so a RED spike makes this wrapper RED.
#
# WHY THE SPIKES RUN IN SERIES on one stack, when Plan 01 says three agents MAY run in parallel: S3
# cross-checks S1's evidence file (which artifact form actually settled), so there is a real data
# dependency, and three concurrent stacks on a shared host would cost three proof servers for no
# gain. S2 is independent and could be split out if wall-clock ever matters.
#
# Fail-safe contract (inherited from 00003 via 00004 and 00005): set -euo pipefail, EXIT/INT/TERM
# traps, argv/cwd/UTC recorded before each command and duration/exit after, and a TEARDOWN FAILURE
# REPLACES an otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above 10000,
# bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/docker-w1.sh
source "$ROOT/scripts/lib/docker-w1.sh"
# shellcheck source=../lib/lane-pins.sh
source "$ROOT/scripts/lib/lane-pins.sh"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"

MODE="full"
while [ $# -gt 0 ]; do
  case "$1" in
    --smoke) MODE="smoke"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ "$MODE" = "smoke" ]; then
  EVID="$ROOT/evidence/g1-smoke"
  GATE="G1-SMOKE"
else
  EVID="$ROOT/evidence/g1-lane"
  GATE="G1"
fi
SPIKE_EVID="$ROOT/evidence/g1-spikes"

fs_init "$GATE" "$EVID" "$MODE"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or any
# concurrent run on this shared host.
PROJECT="aa00006-g1-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed — INCLUDING the residue check and the removal of
# W-1's scratch config directory.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT} && w1_cleanup"

step_w1() { w1_enable "$ROOT"; }

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# The lane is INHERITED, never re-pinned — and the check walks EVERY hop of 00003 -> 00004 -> 00005 ->
# here, because 00006 is three projects removed from the pinning act.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }

# LANE-DEV-1: the compactc substitution is re-proven here rather than inherited on paper.
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

# Both compiler modes are needed: --skip-zk feeds the in-process simulator the spike rig uses to
# derive account ids from the artifact, and --zk produces the prover/verifier keys without which
# nothing can be deployed or proved.
step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

step_install() { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
# Not a bare `tsc`: the base commit does not typecheck (pinned-SDK type defect at wallet.ts:66). This
# subtracts that KNOWN baseline and fails on anything else, so 00006's own code is fully checked while
# the inherited defect is recorded instead of hidden. See scripts/typecheck.sh.
step_typecheck() { "$ROOT/scripts/typecheck.sh"; }

step_pull()   { "${COMPOSE[@]}" pull; }
step_boot()   { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }

step_wallets() { (cd "$ROOT/harness" && npx tsx src/g1/wallets.ts); }
step_funding() { (cd "$ROOT/harness" && npx tsx src/g1/fund.ts); }

step_spike_s1() { (cd "$ROOT/harness" && npx tsx src/g1/spike-s1.ts); }
step_spike_s2() { (cd "$ROOT/harness" && npx tsx src/g1/spike-s2.ts); }
step_spike_s3() { (cd "$ROOT/harness" && npx tsx src/g1/spike-s3.ts); }

step_record_lane() {
  local out="$EVID/LANE.md" svc id
  {
    echo "# LANE MANIFEST — \`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\`"
    echo
    echo "**Project:** 00006-unbalanced-zswap"
    echo "**Slot:** Midnight v2.0.0-rc.4 experimental prerelease lane"
    echo "**Recorded (UTC):** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "**Run mode:** ${MODE}"
    echo "**Host:** $(uname -sm), Docker $(docker --version | sed 's/^Docker version //'), Compose $(docker compose version --short)"
    echo "**Compose project (disposable, this run only):** \`${PROJECT}\`"
    echo
    echo "> **This project PINS NOTHING.** It inherits the lane pinned and verified by project 00003"
    echo "> and re-proved by 00004 and 00005, and proves the inheritance mechanically — see"
    echo "> \`03-lane-reuse.out\`. The authoritative pin rationale, including findings L-1..L-5 and the"
    echo "> LANE-DEV-1 approval, is 00003's manifest, preserved verbatim at"
    echo "> \`archive/00003/evidence/g1-lane/LANE.md\`."
    echo
    echo "> \`EXPERIMENTAL_LANE\`: the official compatibility matrix lists no supported coherent 2.x"
    echo "> application bundle; rc4 is a published prerelease for fresh ledger-9 development networks"
    echo "> only. **No result from this project may be extrapolated to a supported or production lane.**"
    echo
    echo "## Inheritance proof — a THREE-HOP chain, walked rather than asserted"
    echo
    echo "00006 is three projects removed from the act that pinned this lane, so checking only the"
    echo "immediate base would pass even if an intermediate project had silently re-pinned something."
    echo "\`scripts/lib/lane-pins.sh\` therefore compares image digests, the compactc archive pin and"
    echo "\`harness/pnpm-lock.yaml\` at EVERY hop:"
    echo
    echo "| Hop | Commit | Role |"
    echo "|---|---|---|"
    echo "| 1 | \`${LANE_ORIGIN_COMMIT}\` | 00003 merged head — the ORIGINAL pinning act |"
    echo "| 2 | \`f066a09adc4bc2fd47dc045083530aab519f65c2\` | 00004 head (PR #2, held OPEN) |"
    echo "| 3 | \`${LANE_BASE_COMMIT}\` | 00005 head (PR #3, held OPEN) — this branch's base |"
    echo
    echo "| Check | Evidence |"
    echo "|---|---|"
    echo "| Pins identical at EVERY hop of the chain | \`03-lane-reuse.out\` (section 0) |"
    echo "| Pin values in \`docker/compose.yml\` unchanged since base | \`03-lane-reuse.out\` (section 1) |"
    echo "| Compactc archive URL + SHA-256 unchanged since base | \`03-lane-reuse.out\` (section 1) |"
    echo "| \`harness/pnpm-lock.yaml\` byte-identical to base | \`03-lane-reuse.out\` (section 2) |"
    echo "| \`harness/package.json\` dependency versions unchanged | \`03-lane-reuse.out\` (section 2) |"
    echo "| Images compose resolves == pinned digests | \`03-lane-reuse.out\` (section 3) |"
    echo
    echo "## Container images — pinned by digest"
    echo
    echo "| Role | Index digest (as referenced by compose) | linux/arm64 image digest |"
    echo "|---|---|---|"
    echo "| Node \`2.0.0-rc.4\` | \`${LANE_PIN_NODE}\` | \`${LANE_PIN_NODE_ARM64}\` |"
    echo "| Indexer \`4.4.0-rc.1-arm64\` | \`${LANE_PIN_INDEXER}\` | \`${LANE_PIN_INDEXER_ARM64}\` |"
    echo "| Proof server \`9.0.0-rc.3\` | \`${LANE_PIN_PROVER}\` | \`${LANE_PIN_PROVER_ARM64}\` |"
    echo
    echo "### Images that actually ran in this run"
    echo
    echo '```'
    for svc in node indexer proof-server; do
      id="$("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null || true)"
      if [ -n "$id" ]; then
        printf '%-13s %s\n' "$svc" "$(docker inspect --format '{{.Image}}' "$id")"
      else
        printf '%-13s (not running at record time)\n' "$svc"
      fi
    done
    echo '```'
    echo
    echo "## Components"
    echo
    printf '    %s\n' "${LANE_COMPONENTS[@]}"
    echo
    echo "## \`LANE-DEV-1\` — inherited lane deviation (owner-approved 2026-08-17)"
    echo
    echo "The lane pins \`compactc-v0.33.0-rc.2\`, which has no published binary (00003 finding L-4)."
    echo "The released \`compactc-v0.33.0\` is used instead, pinned by SHA-256"
    echo "\`${LANE_PIN_COMPACTC_SHA256}\` in \`docker/compactc.Dockerfile\`."
    echo "**Every piece of 00006 evidence carries \`LANE-DEV-1\` in addition to \`EXPERIMENTAL_LANE\`.**"
    echo
    echo "Re-proven in THIS run (see \`04-lane-dev-1.out\`) rather than inherited on paper:"
    echo
    echo "- [x] Installed \`compactc\` reports compiler version \`${LANE_EXPECT_COMPILER_VERSION}\`."
    echo "- [x] Installed \`compactc\` reports language version \`${LANE_EXPECT_LANGUAGE_VERSION}\`."
    echo "- [x] Artifacts compiled by it are accepted on-chain by the pinned \`ledger-9.1.0.0-rc.3\`"
    echo "      node — re-proven by this run's Manager and Minter deployments inside the spikes."
    echo "- [x] Binary pinned by SHA-256 in \`docker/compactc.Dockerfile\`."
    echo
    echo "## \`W-1\` — inherited HOST workaround (not a lane change)"
    echo
    echo "This host's \`docker-credential-desktop\` can hang, wedging every \`docker pull\` (00004 G4 run 1"
    echo "lost 63 minutes to it). Every 00006 gate therefore runs with \`DOCKER_CONFIG\` pointed at a"
    echo "scratch directory holding \`{}\` plus a symlink to the user's real \`cli-plugins\` — see"
    echo "\`01-w1-docker-config.out\` and \`scripts/lib/docker-w1.sh\`."
    echo
    echo "- It is an ENVIRONMENT VARIABLE for the gate's own child processes. \`~/.docker/config.json\`,"
    echo "  Docker Desktop's settings and every other project on this shared host are untouched."
    echo "- No pin, wrapper step, contract or piece of evidence was changed to accommodate it; the"
    echo "  \`pull\` step is still run and still asserted."
    echo "- Pulls run anonymously. The images are public and **pinned by digest**, and the digest is the"
    echo "  identity, so the pin proof is unaffected."
    echo
    echo "## Compile probes"
    echo
    echo "None. 00006 introduces no new Compact shape in Plan 01: the spikes run 00005's Manager v3 and"
    echo "Minter UNCHANGED, because \`depositShielded\`'s \`receiveShielded\` deficit already has the shape"
    echo "of the swap offer's −B leg. New circuits arrive in Plan 02 with their own gate."
  } > "$out"
  echo "wrote $out"
  wc -l < "$out" | sed 's/^/lines: /'
}

step_record_spikes() {
  local out="$SPIKE_EVID/SPIKES.md" f
  mkdir -p "$SPIKE_EVID"
  {
    echo "# Plan 01 Phase 2 — spike results index"
    echo
    echo "\`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\` · recorded $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "· compose project \`${PROJECT}\` (disposable, this run only)"
    echo
    echo "| Spike | Question | Evidence | Verdict |"
    echo "|---|---|---|---|"
    for f in s1-foreign-balance s2-segment-order s3-offer-roundtrip; do
      if [ -f "$SPIKE_EVID/${f}.json" ]; then
        printf '| %s | %s | `%s.json` | %s |\n' \
          "$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['spike'])" "$SPIKE_EVID/${f}.json")" \
          "$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));q=d.get('question') or (d.get('questions') or ['—'])[0];print(q.replace('|','/'))" "$SPIKE_EVID/${f}.json")" \
          "${f}" \
          "$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('verdict','(none)'))" "$SPIKE_EVID/${f}.json")"
      else
        printf '| (missing) | — | `%s.json` | NOT PRODUCED |\n' "${f}"
      fi
    done
    echo
    echo "Human-readable write-ups: \`S1.md\`, \`S2.md\`, \`S3.md\` in this directory."
    echo
    echo "Raw offer artifacts (\`offers/*.bin\`) are DELIBERATELY not committed: they are generated"
    echo "proof-carrying transactions, and the workspace rule forbids committing generated artifacts."
    echo "Their sizes and SHA-256 content addresses are recorded in \`s3-offer-roundtrip.json\`, which is"
    echo "what the FR-306 claim actually rests on."
    if [ -f "$SPIKE_EVID/s3-offer-roundtrip.json" ]; then
      echo
      echo "## Decision D-306"
      echo
      python3 -c "import json,sys;d=json.load(open(sys.argv[1])).get('decisionD306',{});print('**'+str(d.get('choice','DEFERRED'))+'** — '+str(d.get('reason','')))" \
        "$SPIKE_EVID/s3-offer-roundtrip.json"
    fi
  } > "$out"
  echo "wrote $out"
  ls -la "$SPIKE_EVID"
}

echo "[${GATE}] EXPERIMENTAL_LANE / LANE-DEV-1 — 00006, mode=${MODE}"
echo "[${GATE}] compose project: ${PROJECT}"
fs_run 01-w1-docker-config step_w1
fs_run 02-probe-ports      step_probe_ports
fs_run 03-lane-reuse       step_lane_reuse
fs_run 04-lane-dev-1       step_lane_dev_1
fs_run 05-compile-fast     step_compile_fast
fs_run 06-install          step_install
fs_run 07-compile-zk       step_compile_zk
fs_run 08-typecheck        step_typecheck
fs_run 09-pull             step_pull
fs_run 10-boot             step_boot
fs_run 11-health           step_health
fs_run 12-wallets          step_wallets
fs_run 13-funding          step_funding
fs_run 14-record-lane      step_record_lane

if [ "$MODE" = "smoke" ]; then
  echo "[${GATE}] --smoke: Phase 1 complete (lane proven, stack booted and exercised); teardown runs next"
  exit 0
fi

fs_run 15-spike-s1      step_spike_s1
fs_run 16-spike-s2      step_spike_s2
fs_run 17-spike-s3      step_spike_s3
fs_run 18-record-spikes step_record_spikes

echo "[${GATE}] all steps passed; teardown runs next and must also succeed"
