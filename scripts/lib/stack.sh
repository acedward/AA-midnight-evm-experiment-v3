#!/usr/bin/env bash
# Shared stack helpers for the gate wrappers that need a LIVE chain (G2 onwards).
#
# G1 keeps its own inline copy of the health check on purpose: G1 is GREEN and its wrapper is part
# of that evidence, so it is not edited after the fact. This library is the shared form for every
# gate that comes after.
#
# Both functions read the `COMPOSE` array defined by the calling wrapper.
set -euo pipefail

# stack_health <repo-root> — assert the pinned stack is genuinely serving, from the HOST.
#
# The proof-server and indexer images are distroless (00003 finding L-5): their upstream container
# healthchecks can never pass, so readiness is asserted over the published ports instead.
stack_health() {
  local root="$1" i svc id
  # shellcheck disable=SC1091
  set -a; source "$root/docker/.env"; set +a

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
  for svc in node indexer proof-server; do
    id="$("${COMPOSE[@]}" ps -q "$svc")"
    printf '%-13s %s\n' "$svc" "$(docker inspect --format '{{.Image}}' "$id")"
  done
}

# stack_assert_clean <compose-project> — nothing of ours may survive teardown on this shared host.
# Chained into the teardown hook so a leftover container, volume or network makes the gate RED even
# when every step passed.
stack_assert_clean() {
  local project="$1" left
  left="$(docker ps -a --format '{{.Names}}' | grep "^${project}" || true)"
  if [ -n "$left" ]; then echo "RESIDUE: containers still present: ${left}"; return 1; fi
  left="$(docker volume ls --format '{{.Name}}' | grep "^${project}" || true)"
  if [ -n "$left" ]; then echo "RESIDUE: volumes still present: ${left}"; return 1; fi
  left="$(docker network ls --format '{{.Name}}' | grep "^${project}" || true)"
  if [ -n "$left" ]; then echo "RESIDUE: networks still present: ${left}"; return 1; fi
  echo "host clean: no containers, volumes or networks named ${project}*"
}
