#!/usr/bin/env bash
# Regression for audit F6: teardown must work before probe-ports creates docker/.env.
# Uses the real Compose file/daemon, starts only the pinned proof-server where requested, and writes
# no retained evidence.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/docker-w1.sh
source "$ROOT/scripts/lib/docker-w1.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"

TEST_ROOT="$(mktemp -d "$ROOT/.g5-teardown-test.XXXXXX")"
cleanup_test_root() {
  case "$TEST_ROOT" in
    "$ROOT"/.g5-teardown-test.*) rm -rf "$TEST_ROOT" ;;
    *) echo "refusing to clean unexpected test path: $TEST_ROOT" >&2; return 1 ;;
  esac
}
trap cleanup_test_root EXIT

port_free() {
  local port="$1"
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 &&
    ! docker ps --format '{{.Ports}}' | grep -q ":${port}->"
}

pick_port() {
  local port tries=0
  while :; do
    tries=$((tries + 1))
    [ "$tries" -le 200 ] || { echo "could not find a free test port" >&2; return 1; }
    port=$(( (RANDOM % 45000) + 10001 ))
    if port_free "$port"; then echo "$port"; return 0; fi
  done
}

run_case() {
  local expected="$1" mode="$2"
  local project="aa00006-g5teardown-${mode}-$(date -u +%Y%m%d%H%M%S)-$$"
  local evidence="$TEST_ROOT/$mode" missing_env="$TEST_ROOT/does-not-exist.env" rc
  local node_port indexer_port proof_port
  node_port="$(pick_port)"
  indexer_port="$(pick_port)"
  proof_port="$(pick_port)"
  while [ "$indexer_port" = "$node_port" ]; do indexer_port="$(pick_port)"; done
  while [ "$proof_port" = "$node_port" ] || [ "$proof_port" = "$indexer_port" ]; do proof_port="$(pick_port)"; done

  start_proof_server() {
    COMPOSE_PROJECT_NAME="$project" \
      PORT_NODE_RPC="$node_port" PORT_INDEXER="$indexer_port" PORT_PROOF_SERVER="$proof_port" \
      APP_INFRA_SECRET=0000000000000000000000000000000000000000000000000000000000000000 \
      docker compose -p "$project" -f "$ROOT/docker/compose.yml" \
        up -d --no-deps proof-server
  }

  set +e
  (
    fs_init "G5-TEARDOWN-${mode}" "$evidence" "$mode"
    fs_set_teardown "stack_teardown '$ROOT' '$project' '$missing_env'"
    case "$mode" in
      early-failure) fs_run 01-injected-failure false ;;
      post-start-failure)
        fs_run 01-start-proof-server start_proof_server
        fs_run 02-injected-failure false
        ;;
      normal)
        fs_run 01-start-proof-server start_proof_server
        ;;
      *) echo "unknown test mode: $mode" >&2; exit 2 ;;
    esac
  )
  rc=$?
  set -e
  [ "$rc" -eq "$expected" ] || {
    echo "$mode: expected exit $expected, got $rc" >&2
    return 1
  }
  grep -q '^--- teardown$' "$evidence/run.log"
  grep -q '^    exit: 0$' "$evidence/run.log"
  grep -q "^final_exit: ${expected}$" "$evidence/run.log"
  grep -q 'does not exist; using inert interpolation values' "$evidence/teardown.out"
  stack_assert_clean "$project"
}

run_case 1 early-failure
run_case 1 post-start-failure
run_case 0 normal
echo "G5 early/post-start/normal teardown regression: PASS"
