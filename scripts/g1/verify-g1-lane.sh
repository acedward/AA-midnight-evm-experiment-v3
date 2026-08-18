#!/usr/bin/env bash
# G1 gate wrapper — 00004-multi-token-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Runs Plan 01 Phases 2-4 end to end from nothing:
#
#   probe ports -> PROVE THE LANE IS REUSED (not re-pinned) -> prove LANE-DEV-1 -> compile probes
#   P1/P2 -> pull pinned digests -> boot -> host health checks -> install harness -> create wallets
#   -> fund + DUST-register + fee-paying smoke tx -> PROBE P2 deploy half -> record LANE.md
#   -> teardown
#
# Fail-safe contract (inherited from 00003): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC
# recorded before each command and duration/exit after, and a TEARDOWN FAILURE REPLACES an
# otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above
# 10000, bound to 127.0.0.1 only, and nothing left running.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/lane-pins.sh
source "$ROOT/scripts/lib/lane-pins.sh"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"

EVID="$ROOT/evidence/g1-lane"
fs_init "G1" "$EVID" "$@"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or
# any concurrent run on this shared host.
PROJECT="aa00004-g1-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans"

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# Plan 01 Phase 2 — the lane is REUSED, never re-pinned. `lane_assert_pins_unchanged` reads the
# ${COMPOSE[@]} array defined above.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }

# LANE-DEV-1: the compactc substitution must be proven. This closes the two version checkboxes the
# 00003 lane manifest left unticked.
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

# Plan 01 Phase 3 — compile probes P1(a)(b)(c) and P2. These decide D-101 BEFORE any Manager code.
step_probes_compile() { "$ROOT/scripts/g1/probe-compile.sh"; }

step_pull() { "${COMPOSE[@]}" pull; }
step_boot() { "${COMPOSE[@]}" up -d; }

# The proof-server and indexer images are distroless (00003 finding L-5): their upstream container
# healthchecks can never pass, so readiness is asserted from the HOST over published ports.
step_health() {
  # shellcheck disable=SC1091
  set -a; source "$ROOT/docker/.env"; set +a
  local i

  echo "== node RPC"
  for i in $(seq 1 60); do
    if curl -fs -m 5 -H 'Content-Type: application/json' \
        -d '{"id":1,"jsonrpc":"2.0","method":"chain_getBlockHash","params":[1]}' \
        "http://127.0.0.1:${PORT_NODE_RPC}" | grep -q '"result":"0x'; then break; fi
    [ "$i" -eq 60 ] && { echo "node RPC never produced block 1"; return 1; }
    sleep 2
  done
  curl -fs -m 5 -H 'Content-Type: application/json' \
    -d '{"id":1,"jsonrpc":"2.0","method":"system_chain","params":[]}' "http://127.0.0.1:${PORT_NODE_RPC}"; echo
  curl -fs -m 5 -H 'Content-Type: application/json' \
    -d '{"id":1,"jsonrpc":"2.0","method":"system_version","params":[]}' "http://127.0.0.1:${PORT_NODE_RPC}"; echo

  echo "== proof server"
  for i in $(seq 1 60); do
    if curl -fs -m 5 "http://127.0.0.1:${PORT_PROOF_SERVER}/version" >/dev/null; then break; fi
    [ "$i" -eq 60 ] && { echo "proof server never answered /version"; return 1; }
    sleep 2
  done
  echo -n "prover version: "; curl -fs -m 5 "http://127.0.0.1:${PORT_PROOF_SERVER}/version"; echo

  echo "== indexer"
  for i in $(seq 1 90); do
    if curl -fs -m 5 "http://127.0.0.1:${PORT_INDEXER}/ready" >/dev/null; then break; fi
    [ "$i" -eq 90 ] && { echo "indexer never became ready"; return 1; }
    sleep 2
  done
  curl -fs -m 15 -X POST "http://127.0.0.1:${PORT_INDEXER}/api/v4/graphql" \
    -H 'Content-Type: application/json' -d '{"query":"{ block { height hash protocolVersion } }"}'; echo

  echo "== running image digests (what is ACTUALLY executing)"
  local svc id
  for svc in node indexer proof-server; do
    id="$("${COMPOSE[@]}" ps -q "$svc")"
    printf '%-13s %s\n' "$svc" "$(docker inspect --format '{{.Image}}' "$id")"
  done
}

step_install()  { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
step_wallets()  { (cd "$ROOT/harness" && npx tsx src/g1/wallets.ts); }
step_funding()  { (cd "$ROOT/harness" && npx tsx src/g1/fund.ts); }

# Plan 01 Phase 3 — PROBE P2, deploy half: does the pinned midnight-js apply constructor arguments?
step_probe_p2() { (cd "$ROOT/harness" && npx tsx src/g1/probe-p2.ts); }

# Plan 01 Phase 2 — the evidence header, written while the stack is still up.
step_record_lane() {
  local out="$EVID/LANE.md" svc id
  {
    echo "# LANE MANIFEST — \`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\`"
    echo
    echo "**Project:** 00004-multi-token-custody"
    echo "**Slot:** Midnight v2.0.0-rc.4 experimental prerelease lane"
    echo "**Recorded (UTC):** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "**Host:** $(uname -sm), Docker $(docker --version | sed 's/^Docker version //'), Compose $(docker compose version --short)"
    echo "**Compose project (disposable, this run only):** \`${PROJECT}\`"
    echo
    echo "> **This project PINS NOTHING.** It reuses the lane pinned and verified by project 00003"
    echo "> and proves the reuse mechanically — see \`02-lane-reuse.out\`. The authoritative pin"
    echo "> rationale, including findings L-1..L-5 and the LANE-DEV-1 approval, is 00003's manifest,"
    echo "> preserved verbatim at \`archive/00003/evidence/g1-lane/LANE.md\`."
    echo
    echo "> \`EXPERIMENTAL_LANE\`: the official compatibility matrix lists no supported coherent 2.x"
    echo "> application bundle; rc4 is a published prerelease for fresh ledger-9 development networks"
    echo "> only. **No result from this project may be extrapolated to a supported or production lane.**"
    echo
    echo "## Reuse proof"
    echo
    echo "Base commit: \`${LANE_BASE_COMMIT}\` (00003 merged head, PR #1 — owner decision Q4)."
    echo
    echo "| Check | Evidence |"
    echo "|---|---|"
    echo "| Pin values in \`docker/compose.yml\` unchanged since base | \`02-lane-reuse.out\` |"
    echo "| Compactc archive URL + SHA-256 unchanged since base | \`02-lane-reuse.out\` |"
    echo "| \`harness/pnpm-lock.yaml\` byte-identical to base | \`02-lane-reuse.out\` |"
    echo "| \`harness/package.json\` dependency versions unchanged | \`02-lane-reuse.out\` |"
    echo "| Images compose resolves == pinned digests | \`02-lane-reuse.out\` |"
    echo
    echo "## Container images — pinned by digest"
    echo
    echo "| Role | Index digest (as referenced by compose) | linux/arm64 image digest |"
    echo "|---|---|---|"
    echo "| Node \`2.0.0-rc.4\` | \`${LANE_PIN_NODE}\` | \`${LANE_PIN_NODE_ARM64}\` |"
    echo "| Indexer \`4.4.0-rc.1-arm64\` | \`${LANE_PIN_INDEXER}\` | \`${LANE_PIN_INDEXER_ARM64}\` |"
    echo "| Proof server \`9.0.0-rc.3\` | \`${LANE_PIN_PROVER}\` | \`${LANE_PIN_PROVER_ARM64}\` |"
    echo
    echo "### Images that actually ran in this G1 run"
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
    echo "**Every piece of 00004 evidence carries \`LANE-DEV-1\` in addition to \`EXPERIMENTAL_LANE\`.**"
    echo
    echo "Verification status of the deviation's own checklist (00003 left the first two UNTICKED;"
    echo "this G1 run closes them — see \`03-lane-dev-1.out\`):"
    echo
    echo "- [x] Installed \`compactc\` reports compiler version \`${LANE_EXPECT_COMPILER_VERSION}\`."
    echo "- [x] Installed \`compactc\` reports language version \`${LANE_EXPECT_LANGUAGE_VERSION}\`."
    echo "- [x] Artifacts compiled by it are accepted on-chain by the pinned \`ledger-9.1.0.0-rc.3\` node"
    echo "      — re-proven in THIS run by the probe P2 deployments (\`11-probe-p2.out\`,"
    echo "      \`probes/p2-deploy.json\`), not merely inherited from 00003."
    echo "- [x] Binary pinned by SHA-256 in \`docker/compactc.Dockerfile\`."
    echo
    echo "## Compile probes P1 / P2"
    echo
    echo "See \`probes/VERDICTS.md\` for the verdict table, \`probes/*.out\` for verbatim compiler"
    echo "output, and \`probes/p2-deploy.json\` for the P2 deploy half. Decision D-101 is recorded in"
    echo "the master plan."
  } > "$out"
  echo "wrote $out"
  wc -l < "$out" | sed 's/^/lines: /'
}

echo "[G1] EXPERIMENTAL_LANE / LANE-DEV-1 — verifying the REUSED rc4 lane and answering probes P1/P2"
echo "[G1] compose project: ${PROJECT}"
fs_run 01-probe-ports     step_probe_ports
fs_run 02-lane-reuse      step_lane_reuse
fs_run 03-lane-dev-1      step_lane_dev_1
fs_run 04-probes-compile  step_probes_compile
fs_run 05-pull            step_pull
fs_run 06-boot            step_boot
fs_run 07-health          step_health
fs_run 08-install         step_install
fs_run 09-wallets         step_wallets
fs_run 10-funding         step_funding
fs_run 11-probe-p2        step_probe_p2
fs_run 12-record-lane     step_record_lane

echo "[G1] all steps passed; teardown runs next and must also succeed"
