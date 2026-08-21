#!/usr/bin/env bash
# G1 gate wrapper — 00005-open-colour-custody (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Runs Plan 01 Phases 2-4 end to end from nothing:
#
#   adopt W-1 (scratch DOCKER_CONFIG) -> probe ports -> PROVE THE LANE IS INHERITED (not re-pinned),
#   across BOTH ancestors -> prove LANE-DEV-1 -> pull pinned digests -> boot -> host health checks
#   -> install harness -> create wallets -> fund + DUST-register + fee-paying smoke tx
#   -> record LANE.md -> teardown
#
# What is DELIBERATELY ABSENT compared with 00004's G1: the compile probes P1(a)(b)(c) and P2.
# 00005 introduces no new Compact shape — colour-keyed maps, constructor arguments and the SDK
# scoped batch were all answered by 00004 — so re-running those probes would produce evidence for a
# question this project does not ask. They are preserved verbatim under `archive/00004/`.
#
# Fail-safe contract (inherited from 00003 via 00004): set -euo pipefail, EXIT/INT/TERM traps,
# argv/cwd/UTC recorded before each command and duration/exit after, and a TEARDOWN FAILURE
# REPLACES an otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above
# 10000, bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
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

EVID="$ROOT/evidence/g1-lane"
fs_init "G1" "$EVID" "$@"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or
# any concurrent run on this shared host.
PROJECT="aa00005-g1-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed — INCLUDING the residue check and the removal
# of W-1's scratch config directory.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT} && w1_cleanup"

# W-1, inherited from 00004's G4 diagnosis. Must run BEFORE anything touches docker.
step_w1() { w1_enable "$ROOT"; }

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# Plan 01 Phase 2 — the lane is INHERITED, never re-pinned. `lane_assert_pins_unchanged` reads the
# ${COMPOSE[@]} array defined above.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }

# LANE-DEV-1: the compactc substitution is re-proven here rather than inherited on paper.
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

step_pull() { "${COMPOSE[@]}" pull; }
step_boot() { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }

step_install()  { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
step_wallets()  { (cd "$ROOT/harness" && npx tsx src/g1/wallets.ts); }
step_funding()  { (cd "$ROOT/harness" && npx tsx src/g1/fund.ts); }

# Plan 01 Phase 2 — the evidence header, written while the stack is still up.
step_record_lane() {
  local out="$EVID/LANE.md" svc id
  {
    echo "# LANE MANIFEST — \`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\`"
    echo
    echo "**Project:** 00005-open-colour-custody"
    echo "**Slot:** Midnight v2.0.0-rc.4 experimental prerelease lane"
    echo "**Recorded (UTC):** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "**Host:** $(uname -sm), Docker $(docker --version | sed 's/^Docker version //'), Compose $(docker compose version --short)"
    echo "**Compose project (disposable, this run only):** \`${PROJECT}\`"
    echo
    echo "> **This project PINS NOTHING.** It inherits the lane pinned and verified by project 00003"
    echo "> and re-proved by project 00004, and proves the inheritance mechanically — see"
    echo "> \`03-lane-reuse.out\`. The authoritative pin rationale, including findings L-1..L-5 and"
    echo "> the LANE-DEV-1 approval, is 00003's manifest, preserved verbatim at"
    echo "> \`archive/00003/evidence/g1-lane/LANE.md\`."
    echo
    echo "> \`EXPERIMENTAL_LANE\`: the official compatibility matrix lists no supported coherent 2.x"
    echo "> application bundle; rc4 is a published prerelease for fresh ledger-9 development networks"
    echo "> only. **No result from this project may be extrapolated to a supported or production lane.**"
    echo
    echo "## Inheritance proof"
    echo
    echo "Base commit: \`${LANE_BASE_COMMIT}\` (00004 head; PR #2 deliberately held OPEN, so 00005"
    echo "stacks on the branch rather than on a merge)."
    echo
    echo "Origin commit: \`${LANE_ORIGIN_COMMIT}\` (00003 merged head — the original pinning act)."
    echo
    echo "| Check | Evidence |"
    echo "|---|---|"
    echo "| Pins identical at BOTH ancestors (00004 did not re-pin what 00003 set) | \`03-lane-reuse.out\` |"
    echo "| Pin values in \`docker/compose.yml\` unchanged since base | \`03-lane-reuse.out\` |"
    echo "| Compactc archive URL + SHA-256 unchanged since base | \`03-lane-reuse.out\` |"
    echo "| \`harness/pnpm-lock.yaml\` byte-identical to base | \`03-lane-reuse.out\` |"
    echo "| \`harness/package.json\` dependency versions unchanged | \`03-lane-reuse.out\` |"
    echo "| Images compose resolves == pinned digests | \`03-lane-reuse.out\` |"
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
    echo "**Every piece of 00005 evidence carries \`LANE-DEV-1\` in addition to \`EXPERIMENTAL_LANE\`.**"
    echo
    echo "Verification status of the deviation's own checklist, re-proven in THIS run"
    echo "(see \`04-lane-dev-1.out\`) rather than inherited on paper:"
    echo
    echo "- [x] Installed \`compactc\` reports compiler version \`${LANE_EXPECT_COMPILER_VERSION}\`."
    echo "- [x] Installed \`compactc\` reports language version \`${LANE_EXPECT_LANGUAGE_VERSION}\`."
    echo "- [x] Artifacts compiled by it are accepted on-chain by the pinned \`ledger-9.1.0.0-rc.3\`"
    echo "      node — re-proven by G2's Manager v3 / MinterCollide deployments on a stack of their own."
    echo "- [x] Binary pinned by SHA-256 in \`docker/compactc.Dockerfile\`."
    echo
    echo "## \`W-1\` — inherited HOST workaround (not a lane change)"
    echo
    echo "This host's \`docker-credential-desktop\` can hang, wedging every \`docker pull\` (00004 G4"
    echo "run 1 lost 63 minutes to it). Every 00005 gate therefore runs with \`DOCKER_CONFIG\` pointed"
    echo "at a scratch directory holding \`{}\` plus a symlink to the user's real \`cli-plugins\` — see"
    echo "\`01-w1-docker-config.out\` and \`scripts/lib/docker-w1.sh\`."
    echo
    echo "- It is an ENVIRONMENT VARIABLE for the gate's own child processes. \`~/.docker/config.json\`,"
    echo "  Docker Desktop's settings and every other project on this shared host are untouched."
    echo "- No pin, wrapper step, contract or piece of evidence was changed to accommodate it; the"
    echo "  \`pull\` step is still run and still asserted."
    echo "- Pulls run anonymously. The images are public and **pinned by digest**, and the digest is"
    echo "  the identity, so the pin proof is unaffected."
    echo
    echo "## Compile probes"
    echo
    echo "None. 00005 introduces no new Compact shape: colour-keyed maps (00004 probes P1a/P1b),"
    echo "constructor arguments (P2) and the SDK scoped batch (00004 M1) are all already answered."
    echo "The probes are preserved at \`archive/00004/contracts-probes/\` with 00004's verdict table."
  } > "$out"
  echo "wrote $out"
  wc -l < "$out" | sed 's/^/lines: /'
}

echo "[G1] EXPERIMENTAL_LANE / LANE-DEV-1 — verifying the INHERITED rc4 lane for 00005"
echo "[G1] compose project: ${PROJECT}"
fs_run 01-w1-docker-config step_w1
fs_run 02-probe-ports      step_probe_ports
fs_run 03-lane-reuse       step_lane_reuse
fs_run 04-lane-dev-1       step_lane_dev_1
fs_run 05-pull             step_pull
fs_run 06-boot             step_boot
fs_run 07-health           step_health
fs_run 08-install          step_install
fs_run 09-wallets          step_wallets
fs_run 10-funding          step_funding
fs_run 11-record-lane      step_record_lane

echo "[G1] all steps passed; teardown runs next and must also succeed"
