#!/usr/bin/env bash
# G2 gate wrapper — 00003-contract-token-custody (EXPERIMENTAL_LANE, LANE-DEV-1).
#
#   verify LANE-DEV-1 -> compile (fast) -> simulator/unit suites -> compile (full ZK)
#   -> record artifacts, circuit list and verifier-key hashes
#
# Same fail-safe contract as G1: set -euo pipefail, EXIT/INT/TERM traps, argv/cwd/UTC recorded
# before each command and duration/exit after. G2 needs no long-lived stack, so its teardown is
# limited to removing the disposable compiler container image reference; a teardown failure still
# replaces an otherwise-zero result.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"

EVID="$ROOT/evidence/g2-contracts"
fs_init "G2" "$EVID" "$@"

IMAGE="aa00003-compactc:0.33.0"

# --- LANE-DEV-1: the substitution must be proven, not assumed -----------------------------------
# The spec pins compactc-v0.33.0-rc.2, which has no published binary (LANE.md Finding L-4). The
# owner approved using the released 0.33.0 provided it is verified. These are those checks.
step_verify_lane_dev_1() {
  local ver lang
  ver="$(docker run --rm "$IMAGE" compactc --version | tr -d '[:space:]')"
  lang="$(docker run --rm "$IMAGE" compactc --language-version | tr -d '[:space:]')"
  echo "compiler version: ${ver}"
  echo "language version: ${lang}"
  [ "$ver" = "0.33.0" ] || { echo "LANE-DEV-1 FAILED: compiler version is ${ver}, expected 0.33.0"; return 1; }
  [ "$lang" = "0.25.0" ] || { echo "LANE-DEV-1 FAILED: language version is ${lang}, expected 0.25.0"; return 1; }

  # The pinned rc.2 SOURCE (read-only reference) must declare the same versions.
  local ref="$HOME/midnight-ref-ai/v2.0.0-rc.4/compact/compiler"
  if [ -d "$ref" ]; then
    grep -q "make-version 'compiler 0 33 0" "$ref/compiler-version.ss" \
      || { echo "pinned rc.2 source does not declare compiler 0.33.0"; return 1; }
    grep -q "make-version 'language 0 25 0" "$ref/language-version.ss" \
      || { echo "pinned rc.2 source does not declare language 0.25.0"; return 1; }
    echo "pinned rc.2 source agrees: compiler 0.33.0 / language 0.25.0"
    grep -m1 "midnight-ledger/ledger-9.1.0.0-rc.3" "$ref/../flake.nix" >/dev/null \
      && echo "pinned rc.2 source targets ledger-9.1.0.0-rc.3 (this lane's ledger)"
  else
    echo "NOTE: reference checkout absent; source-side cross-check skipped"
  fi
  echo "LANE-DEV-1 verified (binary pinned by SHA-256 in docker/compactc.Dockerfile)"
}

step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
step_unit_suites()  { (cd "$ROOT/harness" && npx vitest run); }
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

# Record what was built: circuit lists, artifact inventory and verifier-key hashes.
step_record_artifacts() {
  local out="$EVID/ARTIFACTS.md"
  {
    echo "# G2 build artifacts — EXPERIMENTAL_LANE / LANE-DEV-1"
    echo
    echo "Compiler: compactc $(docker run --rm "$IMAGE" compactc --version | tr -d '[:space:]')"
    echo "Language: $(docker run --rm "$IMAGE" compactc --language-version | tr -d '[:space:]')"
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
      echo "| Circuit | verifier key SHA-256 | bytes |"
      echo "|---|---|---|"
      for v in "$ROOT/harness/generated-zk/${c}/keys/"*.verifier; do
        [ -e "$v" ] || continue
        printf '| `%s` | `%s` | %s |\n' \
          "$(basename "$v" .verifier)" \
          "$(shasum -a 256 "$v" | cut -d' ' -f1)" \
          "$(wc -c < "$v" | tr -d ' ')"
      done
      echo
    done
  } > "$out"
  echo "wrote $out"
  grep -c '^| `' "$out" | sed 's/^/verifier key rows: /'
}

fs_set_teardown "docker image inspect ${IMAGE} >/dev/null 2>&1 || true"

echo "[G2] EXPERIMENTAL_LANE / LANE-DEV-1 — building and proving the Minter and Manager contracts"
fs_run 01-verify-lane-dev-1 step_verify_lane_dev_1
fs_run 02-compile-fast      step_compile_fast
fs_run 03-install           step_install
fs_run 04-unit-suites       step_unit_suites
fs_run 05-compile-zk        step_compile_zk
fs_run 06-record-artifacts  step_record_artifacts

echo "[G2] all steps passed"
