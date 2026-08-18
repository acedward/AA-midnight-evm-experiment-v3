#!/usr/bin/env bash
# G1 gate wrapper — 00003-contract-token-custody (EXPERIMENTAL_LANE).
#
# Re-runs the whole lane end to end from nothing:
#   probe ports -> pull pinned digests -> assert digests -> boot -> host health checks
#   -> create wallets -> fund + DUST + fee-paying smoke tx -> teardown
#
# Fail-safe contract (master plan): set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC and
# image digests recorded before each command, duration/exit after, and a TEARDOWN FAILURE
# REPLACES an otherwise-zero result. The gate is green only if this process exits 0.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"

EVID="$ROOT/evidence/g1-lane"
fs_init "G1" "$EVID" "$@"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans"

# --- pinned digests (evidence/g1-lane/LANE.md) -------------------------------------------------
PIN_NODE="sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e"
PIN_INDEXER="sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a"
PIN_PROVER="sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f"

step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh"; }

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

  echo "== running image digests"
  local svc id
  for svc in node indexer proof-server; do
    id="$("${COMPOSE[@]}" ps -q "$svc")"
    printf '%-13s %s\n' "$svc" "$(docker inspect --format '{{.Image}}' "$id")"
  done
}

step_install() { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
step_wallets() { (cd "$ROOT/harness" && npx tsx src/g1/wallets.ts); }
step_funding() { (cd "$ROOT/harness" && npx tsx src/g1/fund.ts); }

echo "[G1] EXPERIMENTAL_LANE — verifying the pinned v2.0.0-rc.4 lane end to end"
fs_run 01-probe-ports    step_probe_ports
fs_run 02-pull           step_pull
fs_run 03-assert-digests step_assert_digests
fs_run 04-boot           step_boot
fs_run 05-health         step_health
fs_run 06-install        step_install
fs_run 07-wallets        step_wallets
fs_run 08-funding        step_funding

echo "[G1] all steps passed; teardown runs next and must also succeed"
