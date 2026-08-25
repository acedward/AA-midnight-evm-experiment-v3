#!/usr/bin/env bash
#
# test-integration.sh — run the INTEGRATION test tier against a local Midnight stack.
#
# WHAT THE TIER IS
#   The heavyweight counterpart to `scripts/test-sim.sh`. Where the simulation tier executes
#   circuits in-process with no keys, this tier boots the real thing from `docker/compose.yml` —
#   a Midnight node, an indexer and a proof server, every image pinned by digest — and drives the
#   contract through it. CI never runs this tier; it is on demand only.
#
# WHAT IT NEEDS
#   Docker, the pinned images (pulled on first run), and — for anything that proves or deploys — a
#   generated proving key from `scripts/keygen.sh`. Host ports are chosen randomly above 10000,
#   confirmed free before use, and bound to 127.0.0.1 only, so the stack is safe to bring up on a
#   shared machine. Teardown removes the containers, the volumes and the network.
#
# CURRENT STATE: THE TIER IS EMPTY.
#   The live-node runners this repository used to carry (deploy rigs, wallet funding, swap
#   processes, the proof-carrying offer kit) were research apparatus for the predecessor projects
#   and were removed when the repository was reduced to product source. They are preserved at the
#   tag `research/pre-reorg`. Nothing has replaced them yet, because a real integration suite needs
#   a proving key and an authorized deployment.
#
#   So this script checks for suites FIRST and refuses to boot a node for nothing. Drop a
#   `*.test.ts` into `tests/integration/` and it starts working with no further change.
#
# usage: scripts/test-integration.sh [-- <extra vitest args>]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_image="${AA_NODE_IMAGE:-node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e}"
pnpm_version="11.5.1"
project="aa_integration_$$"
volume="${project}_work"

extra=()
[ "${1:-}" = "--" ] && { shift; extra=("$@"); }

suites="$(find "$repo_root/tests/integration" -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')"
echo "INTEGRATION_SUITES=$suites"
if [ "$suites" -eq 0 ]; then
  cat <<'MSG'

No integration suites are present, so the stack was NOT started.

This is the expected state right now, not a failure: see tests/integration/README.md for what the
tier is for, and the tag `research/pre-reorg` for the live-node runners this repository used to
carry. The fast tier — which is what actually guards every change today — is:

    scripts/test-sim.sh

MSG
  exit 0
fi

# One random, confirmed-free loopback port per service. Nothing else on the machine can collide.
free_port() {
  local p
  for _ in $(seq 1 200); do
    p=$(( 10001 + RANDOM % 55000 ))
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && continue
    nc -z 127.0.0.1 "$p" >/dev/null 2>&1 && continue
    printf '%s\n' "$p"; return 0
  done
  echo "could not find a free port above 10000" >&2
  return 97
}

env_file="$repo_root/docker/.env"   # gitignored
cat > "$env_file" <<EOF
PORT_PROOF_SERVER=$(free_port)
PORT_NODE_RPC=$(free_port)
PORT_INDEXER=$(free_port)
APP_INFRA_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
EOF
echo "PORTS:"; grep '^PORT_' "$env_file" | sed 's/^/  /'

compose=(docker compose -p "$project" -f "$repo_root/docker/compose.yml" --env-file "$env_file")

teardown() {
  echo "--- teardown"
  "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  rm -f "$env_file"
  echo "TEARDOWN_OK residual=$(docker ps -aq --filter "label=com.docker.compose.project=$project" | wc -l | tr -d ' ')"
}
trap teardown EXIT INT TERM

echo "--- bringing up docker/compose.yml"
"${compose[@]}" up -d --wait

# The proof server and the indexer are distroless (no shell, no curl), so their in-image
# healthchecks can never pass; readiness is asserted from the HOST over the published ports.
port_node="$(grep '^PORT_NODE_RPC=' "$env_file" | cut -d= -f2)"
port_indexer="$(grep '^PORT_INDEXER=' "$env_file" | cut -d= -f2)"
port_proof="$(grep '^PORT_PROOF_SERVER=' "$env_file" | cut -d= -f2)"
for i in $(seq 1 60); do
  ok=1
  curl -fs "http://127.0.0.1:$port_indexer/ready" >/dev/null 2>&1 || ok=0
  curl -fs "http://127.0.0.1:$port_proof/version" >/dev/null 2>&1 || ok=0
  [ "$ok" -eq 1 ] && break
  sleep 2
done
echo "STACK_READY=$ok after ${i}x2s"
[ "$ok" -eq 1 ] || { echo "stack did not become ready" >&2; exit 75; }

docker volume create --label com.docker.compose.project="$project" "$volume" >/dev/null
docker run --rm --label com.docker.compose.project="$project" \
  -v "$repo_root/tests:/src:ro" -v "$volume:/work" -w /src "$node_image" \
  sh -euc 'tar --exclude="./node_modules" -cf - . | tar -xf - -C /work'
docker run --rm --label com.docker.compose.project="$project" \
  -v "$volume:/work" -w /work "$node_image" \
  sh -euc "corepack enable; corepack prepare pnpm@$pnpm_version --activate; pnpm install --frozen-lockfile"

docker run --rm --label com.docker.compose.project="$project" \
  --network host \
  -e MN_NODE_URL="http://127.0.0.1:$port_node" \
  -e MN_INDEXER_URL="http://127.0.0.1:$port_indexer" \
  -e MN_PROOF_SERVER_URL="http://127.0.0.1:$port_proof" \
  -v "$volume:/work" -w /work "$node_image" \
  sh -euc 'node_modules/.bin/vitest run integration '"${extra[*]-}"
