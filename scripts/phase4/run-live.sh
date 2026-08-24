#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
COMPOSE_FILE="$ROOT/docker/phase4/compose.yml"
EVIDENCE_HOST="$ROOT/evidence/00008-AA-v3-evm/phase-4"
MINTER_ROOT="/Users/edwardalvarado/todo/AA/experiments/00006-unbalanced-zswap"
NODE_IMAGE="node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e"
EXPECTED_MANAGER_INDEX="8b3073068c7b9ebaae991db7140dbf5d3f8493c4ec34089833866dbcba28607d"
EXPECTED_MANAGER_DTS="92c251d34d3f875b80f238acee3244919d255a630531b0a47da50850ba2f8fc5"

pick_port() {
  local p
  while :; do
    p=$((10001 + RANDOM))
    if ! lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 &&
       ! docker ps --format '{{.Ports}}' | grep -Eq "(^|:)${p}->"; then
      printf '%s\n' "$p"
      return
    fi
  done
}

PORT_NODE_RPC=$(pick_port)
PORT_INDEXER=$(pick_port)
while [[ "$PORT_INDEXER" == "$PORT_NODE_RPC" ]]; do PORT_INDEXER=$(pick_port); done
PORT_PROOF_SERVER=$(pick_port)
while [[ "$PORT_PROOF_SERVER" == "$PORT_NODE_RPC" || "$PORT_PROOF_SERVER" == "$PORT_INDEXER" ]]; do PORT_PROOF_SERVER=$(pick_port); done
PORT_PLAIN_PROOF_SERVER=$(pick_port)
while [[ "$PORT_PLAIN_PROOF_SERVER" == "$PORT_NODE_RPC" || "$PORT_PLAIN_PROOF_SERVER" == "$PORT_INDEXER" || "$PORT_PLAIN_PROOF_SERVER" == "$PORT_PROOF_SERVER" ]]; do PORT_PLAIN_PROOF_SERVER=$(pick_port); done

STAMP=$(date -u +%Y%m%d_%H%M%S)
COMPOSE_PROJECT_NAME="aa00008_phase4_${STAMP}_$$"
PHASE4_WORK_VOLUME="${COMPOSE_PROJECT_NAME}_work"
PHASE4_EVIDENCE_VOLUME="${COMPOSE_PROJECT_NAME}_evidence"
APP_INFRA_SECRET=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
RUNTIME_DIR=$(mktemp -d "${TMPDIR:-/tmp}/aa00008-phase4.XXXXXX")
ENV_FILE="$RUNTIME_DIR/compose.env"
RUN_RC=1
export COMPOSE_PROJECT_NAME PORT_NODE_RPC PORT_INDEXER PORT_PROOF_SERVER PORT_PLAIN_PROOF_SERVER
export PHASE4_WORK_VOLUME PHASE4_EVIDENCE_VOLUME APP_INFRA_SECRET

mkdir -p "$EVIDENCE_HOST"
cat >"$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME
PORT_NODE_RPC=$PORT_NODE_RPC
PORT_INDEXER=$PORT_INDEXER
PORT_PROOF_SERVER=$PORT_PROOF_SERVER
PORT_PLAIN_PROOF_SERVER=$PORT_PLAIN_PROOF_SERVER
APP_INFRA_SECRET=$APP_INFRA_SECRET
PHASE4_WORK_VOLUME=$PHASE4_WORK_VOLUME
PHASE4_EVIDENCE_VOLUME=$PHASE4_EVIDENCE_VOLUME
EOF

compose() {
  docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

extract_evidence() {
  docker run --rm --name "${COMPOSE_PROJECT_NAME}_extract" \
    --label "com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    -v "$PHASE4_EVIDENCE_VOLUME:/src:ro" -v "$EVIDENCE_HOST:/dst" \
    "$NODE_IMAGE" sh -euc 'cp -a /src/. /dst/' >/dev/null 2>&1 || true
}

teardown() {
  local trap_rc=$?
  set +e
  compose logs --no-color >"$EVIDENCE_HOST/compose-services.log" 2>&1
  compose down -v --remove-orphans >"$EVIDENCE_HOST/teardown.log" 2>&1
  extract_evidence
  docker volume rm "$PHASE4_WORK_VOLUME" "$PHASE4_EVIDENCE_VOLUME" >>"$EVIDENCE_HOST/teardown.log" 2>&1
  local containers volumes networks processes ports_busy
  containers=$(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" | wc -l | tr -d ' ')
  volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" | wc -l | tr -d ' ')
  networks=$(docker network ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" | wc -l | tr -d ' ')
  processes=$(pgrep -f "$COMPOSE_PROJECT_NAME" 2>/dev/null | grep -v "^$$$" | wc -l | tr -d ' ')
  ports_busy=0
  for p in "$PORT_NODE_RPC" "$PORT_INDEXER" "$PORT_PROOF_SERVER" "$PORT_PLAIN_PROOF_SERVER"; do
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then ports_busy=$((ports_busy + 1)); fi
  done
  {
    echo "command_exit=$RUN_RC"
    echo "trap_entry_exit=$trap_rc"
    echo "containers=$containers"
    echo "volumes=$volumes"
    echo "networks=$networks"
    echo "processes=$processes"
    echo "ports_busy=$ports_busy"
  } >"$EVIDENCE_HOST/residue.txt"
  rm -rf "$RUNTIME_DIR"
  if [[ "$containers" != 0 || "$volumes" != 0 || "$networks" != 0 || "$processes" != 0 || "$ports_busy" != 0 ]]; then
    exit 90
  fi
  exit "$RUN_RC"
}
trap teardown EXIT INT TERM

test -d "$MINTER_ROOT/harness/generated-zk/minter"
test "$(git -C "$MINTER_ROOT" rev-parse HEAD)" = "2df2bd87665987e7e0a6de172725358f12e5666a"
test "$(git -C "$MINTER_ROOT" status --short | wc -l | tr -d ' ')" = 0
(cd "$ROOT" && sha256sum -c evidence/00008-AA-v3-evm/phase-4r/FINAL-SHA256SUMS.txt) >"$EVIDENCE_HOST/manager-manifest-check.txt"
(cd "$MINTER_ROOT" && sha256sum -c "$ROOT/evidence/00008-AA-v3-evm/phase-4/MINTER-SHA256SUMS.txt") >"$EVIDENCE_HOST/minter-manifest-check.txt"
(cd "$ROOT" && sha256sum -c evidence/00008-AA-v3-evm/phase-4r/U13-SHA256SUMS.txt) >"$EVIDENCE_HOST/u13-pre-check.txt"
docker volume create --label "com.docker.compose.project=$COMPOSE_PROJECT_NAME" "$PHASE4_WORK_VOLUME" >/dev/null
docker volume create --label "com.docker.compose.project=$COMPOSE_PROJECT_NAME" "$PHASE4_EVIDENCE_VOLUME" >/dev/null

docker run --rm --name "${COMPOSE_PROJECT_NAME}_stage" \
  --label "com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
  -v "$ROOT:/src:ro" -v "$MINTER_ROOT:/minter-src:ro" -v "$PHASE4_WORK_VOLUME:/work" \
  "$NODE_IMAGE" sh -euc '
    cd /src
    tar --exclude="./.git" --exclude="./archive" --exclude="./evidence" \
      --exclude="./harness/node_modules" --exclude="./harness/generated" \
      --exclude="./harness/generated-phase4r" --exclude="./harness/generated-zk*" \
      --exclude="./harness/midnight-level-db" -cf - . | tar -xf - -C /work
    mkdir -p /work/harness/generated-zk/manager /work/harness/generated-zk/minter
    cp -a /src/harness/generated-phase4r/final-7b0d03d/manager/. /work/harness/generated-zk/manager/
    cp -a /minter-src/harness/generated-zk/minter/. /work/harness/generated-zk/minter/
  '

docker run --rm --name "${COMPOSE_PROJECT_NAME}_prepare" \
  --label "com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
  -v "$PHASE4_WORK_VOLUME:/work" -w /work/harness "$NODE_IMAGE" sh -euc "
    test \"\$(sha256sum generated-zk/manager/contract/index.js | cut -d ' ' -f 1)\" = '$EXPECTED_MANAGER_INDEX'
    test \"\$(sha256sum generated-zk/manager/contract/index.d.ts | cut -d ' ' -f 1)\" = '$EXPECTED_MANAGER_DTS'
    corepack enable
    corepack prepare pnpm@11.5.1 --activate
    pnpm install --frozen-lockfile
    pnpm exec tsx --version
  " >"$EVIDENCE_HOST/prepare.log" 2>&1

{
  echo "project=$COMPOSE_PROJECT_NAME"
  echo "ports=$PORT_NODE_RPC,$PORT_INDEXER,$PORT_PROOF_SERVER,$PORT_PLAIN_PROOF_SERVER"
  echo "manager_index_sha256=$EXPECTED_MANAGER_INDEX"
  echo "manager_dts_sha256=$EXPECTED_MANAGER_DTS"
  echo "source_head=$(git -C "$ROOT" rev-parse HEAD)"
  for p in "$PORT_NODE_RPC" "$PORT_INDEXER" "$PORT_PROOF_SERVER" "$PORT_PLAIN_PROOF_SERVER"; do
    echo "preflight_port_${p}=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' ')"
  done
} >"$EVIDENCE_HOST/preflight.txt"

compose up -d >"$EVIDENCE_HOST/compose-up.log" 2>&1
node_ok='' indexer_ok='' proof_ok='' plain_ok=''
for _ in $(seq 1 150); do
  node_ok=$(curl -fsS -H 'Content-Type: application/json' -d '{"id":1,"jsonrpc":"2.0","method":"chain_getBlockHash","params":[1]}' "http://127.0.0.1:$PORT_NODE_RPC" 2>/dev/null || true)
  indexer_ok=$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT_INDEXER/ready" 2>/dev/null || true)
  proof_ok=$(curl -fsS "http://127.0.0.1:$PORT_PROOF_SERVER/version" 2>/dev/null || true)
  plain_ok=$(curl -fsS "http://127.0.0.1:$PORT_PLAIN_PROOF_SERVER/version" 2>/dev/null || true)
  if [[ "$node_ok" == *'"result":"0x'* && "$indexer_ok" == 200 && -n "$proof_ok" && -n "$plain_ok" ]]; then break; fi
  sleep 2
done
{
  echo "node_rpc=$node_ok"
  echo "indexer_status=$indexer_ok"
  echo "proof_version=$proof_ok"
  echo "plain_proof_version=$plain_ok"
} >"$EVIDENCE_HOST/readiness.txt"
[[ "$node_ok" == *'"result":"0x'* && "$indexer_ok" == 200 && -n "$proof_ok" && -n "$plain_ok" ]]

compose ps >"$EVIDENCE_HOST/compose-ps.txt"
docker inspect $(compose ps -q) --format '{{.Name}} {{.Config.Image}} {{.Image}}' >"$EVIDENCE_HOST/identities.txt"

set +e
compose run --rm runner sh -euc '
  test "$(sha256sum generated-zk/manager/contract/index.js | cut -d " " -f 1)" = "8b3073068c7b9ebaae991db7140dbf5d3f8493c4ec34089833866dbcba28607d"
  corepack enable
  corepack prepare pnpm@11.5.1 --activate
  pnpm exec tsx src/phase4/live-matrix.ts
' >"$EVIDENCE_HOST/live-run.log" 2>&1
RUN_RC=$?
set -e
extract_evidence
(cd "$ROOT" && sha256sum -c evidence/00008-AA-v3-evm/phase-4r/U13-SHA256SUMS.txt) >"$EVIDENCE_HOST/u13-post-check.txt"
exit "$RUN_RC"
