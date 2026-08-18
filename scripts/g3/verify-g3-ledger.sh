#!/usr/bin/env bash
# G3 gate wrapper — 00003-contract-token-custody (EXPERIMENTAL_LANE, LANE-DEV-1).
#
# Owns a COMPLETE, DISPOSABLE lifecycle for the whole step ledger, from nothing:
#
#   probe ports (fresh, unique compose project) -> pull pinned digests -> assert digests -> boot
#   -> host health checks -> install -> compile (fast + full ZK) -> ordered step ledger 0..9
#   -> negative controls -> atomicity probes -> render CELLS.md -> teardown
#
# Fail-safe contract (master plan): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC and image
# digests recorded before each command, duration/exit after, and a TEARDOWN FAILURE REPLACES an
# otherwise-zero result. The gate is green only if this process exits 0.
#
# SHARED HOST: the stack is created under a project name unique to this run, on random host ports
# above 10000 that are verified free before use, and teardown removes only this project's
# containers and volumes. No other project on the machine is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"

EVID="$ROOT/evidence/g3-ledger"
fs_init "G3" "$EVID" "$@"

# A project name unique to this run, so a fresh stack can never collide with — or tear down —
# a stack belonging to another project or another run on this shared host.
PROJECT="aa00003-g3-$(date -u +%Y%m%d%H%M%S)-$$"
COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# --- pinned digests (evidence/g1-lane/LANE.md) -------------------------------------------------
PIN_NODE="sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e"
PIN_INDEXER="sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a"
PIN_PROVER="sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f"

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

step_pull() { "${COMPOSE[@]}" pull; }

# Assert the images that will actually run are byte-identical to the pins. Never trust a tag.
step_assert_digests() {
  local ok=0 resolved
  resolved="$("${COMPOSE[@]}" config --images)"
  for pair in "node:$PIN_NODE" "indexer:$PIN_INDEXER" "proof-server:$PIN_PROVER"; do
    local svc="${pair%%:*}" want="${pair#*:}"
    if grep -qF "$want" <<<"$resolved"; then
      echo "digest ok: ${svc} -> ${want}"
    else
      echo "DIGEST MISMATCH: no image references ${want} (expected for ${svc})"
      ok=1
    fi
  done
  echo "-- compose project: ${PROJECT}"
  echo "-- images compose will run:"
  echo "$resolved"
  return "$ok"
}

step_boot() { "${COMPOSE[@]}" up -d; }

# The proof-server and indexer images are distroless (Finding L-5): their upstream container
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

  echo "== running image digests"
  local svc id
  for svc in node indexer proof-server; do
    id="$("${COMPOSE[@]}" ps -q "$svc")"
    printf '%-13s %s\n' "$svc" "$(docker inspect --format '{{.Image}}' "$id")"
  done
}

step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
# The fast build backs the in-process simulator that derives account ids; the ZK build is what is
# actually deployed and proven. Both are required.
step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

step_step_ledger()      { (cd "$ROOT/harness" && npx tsx src/g3/ledger-run.ts); }
step_negative_controls(){ (cd "$ROOT/harness" && npx tsx src/g3/negative-controls.ts); }
step_atomicity()        { (cd "$ROOT/harness" && npx tsx src/g3/atomicity.ts); }
# Fails if any of the 26 checklist cells has no record, or if any cell, control or probe is RED.
step_render_cells()     { (cd "$ROOT/harness" && npx tsx src/g3/render-cells.ts); }

# Teardown is owned by this wrapper and must succeed. `down -v` removes only THIS project's
# containers and volumes, because COMPOSE_PROJECT_NAME in docker/.env is this run's unique name.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans"

echo "[G3] EXPERIMENTAL_LANE / LANE-DEV-1 — running the whole step ledger on a fresh stack (${PROJECT})"
fs_run 01-probe-ports       step_probe_ports
fs_run 02-pull              step_pull
fs_run 03-assert-digests    step_assert_digests
fs_run 04-boot              step_boot
fs_run 05-health            step_health
fs_run 06-install           step_install
fs_run 07-compile-fast      step_compile_fast
fs_run 08-compile-zk        step_compile_zk
fs_run 09-step-ledger       step_step_ledger
fs_run 10-negative-controls step_negative_controls
fs_run 11-atomicity         step_atomicity
fs_run 12-render-cells      step_render_cells

echo "[G3] all steps passed; teardown runs next and must also succeed"
