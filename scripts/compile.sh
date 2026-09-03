#!/usr/bin/env bash
#
# compile.sh — compile the Compact sources with the PINNED toolchain image.
#
# WHAT IT DOES
#   Runs `compactc --feature-zkir-v3 --skip-zk` inside the pinned compiler image, once per target,
#   writing to `tests/generated/<target>/`. `--skip-zk` means: TypeScript bindings + ZKIR only, and
#   NO proving or verifier keys (those are `scripts/keygen.sh`, which takes hours and gigabytes).
#   The script asserts afterwards that no key file was produced.
#
# TARGETS
#   manager         contracts/manager.compact                     — the product
#   minter          contracts/test-support/minter.compact         — test-only token source
#   minter-collide  contracts/test-support/minter-collide.compact — test-only token source
#   k20-oracle      the superseded k=20 Manager, read out of this repo's own history (see below)
#   all             (default) all four
#
# THE k=20 ORACLE
#   20 of the simulation tests are differential: they load the product AND the last pre-v5 Manager
#   in one process and require byte-equal EIP-712 output, ledger state, zswap shape and refusal
#   text. That Manager is not a second product — it is a frozen reference — so it lives in git
#   history rather than in the tree, at the commit pinned in K20_ORACLE_COMMIT below. The blob's
#   SHA-256 is asserted before it is compiled, so a rewritten history fails loudly instead of
#   silently comparing against something else. A shallow clone will not have it: use
#   `git fetch --unshallow` (in CI: `actions/checkout` with `fetch-depth: 0`).
#
# TOOLCHAIN PROVENANCE
#   Compiler 0.34.0 / language 0.26.0, pinned by the release-archive SHA-256 in
#   docker/compactc.Dockerfile and obtained by scripts/toolchain.sh, which is where the pins and
#   the `ensure_image` used below live. The toolchain is arm64/linux and cannot be built or run on
#   other architectures. See README, "Toolchain provenance". Override with COMPACTC_IMAGE=<ref> to
#   compile with a different build (that override is how a second toolchain is driven).
#
# usage: scripts/compile.sh [target ...]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_root="$repo_root/tests/generated"

# The pinned toolchain (compiler 0.34.0, language 0.26.0) and `ensure_image`.
# shellcheck source=scripts/toolchain.sh
. "$repo_root/scripts/toolchain.sh"

# The frozen k=20 reference oracle, in this repo's own history.
K20_ORACLE_COMMIT="7b0d03d"
K20_ORACLE_PATH="contracts/manager.compact"
K20_ORACLE_SHA256="85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858"

timeout_seconds="${COMPILE_TIMEOUT_SECONDS:-600}"

log() { printf '%s\n' "$*"; }

# compile_one <target> <host-source-dir> <source-file-name>
# The source directory is mounted read-only; the compiler only ever sees the one directory.
compile_one() {
  local target="$1" src_dir="$2" src_file="$3"
  local out="$out_root/$target"
  local container="aa-compile-$target-$$"

  test -f "$src_dir/$src_file"
  rm -rf "$out"
  mkdir -p "$out"

  log "--- $target"
  log "SOURCE=$src_file"
  log "SOURCE_SHA256=$(shasum -a 256 "$src_dir/$src_file" | cut -d ' ' -f 1)"

  # Hard wall bound. The watchdog must not inherit stdout/stderr: a background writer would hold a
  # consuming pipe open for its whole sleep and stall any caller reading this script's output.
  (
    sleep "$timeout_seconds"
    docker inspect "$container" >/dev/null 2>&1 && docker kill "$container" >/dev/null 2>&1
  ) >/dev/null 2>&1 &
  local watchdog=$!

  local rc=0
  docker run --rm --network none --name "$container" \
    --cpus 2 --memory 8g --memory-swap 8g -e RAYON_NUM_THREADS=2 \
    -v "$src_dir:/work/src:ro" -v "$out:/out" -w /work \
    "$COMPACTC_IMAGE" \
    compactc --feature-zkir-v3 --skip-zk "/work/src/$src_file" /out || rc=$?

  kill "$watchdog" >/dev/null 2>&1 || true
  wait "$watchdog" >/dev/null 2>&1 || true

  if [ "$rc" -ne 0 ]; then
    echo "COMPILE_EXIT=$rc for $target" >&2
    return "$rc"
  fi
  log "ZKIR_CIRCUITS=$(find "$out/zkir" -name '*.zkir' 2>/dev/null | wc -l | tr -d ' ')"
  find "$out/zkir" -name '*.zkir' 2>/dev/null | sort | while read -r z; do
    printf '  %s  %s\n' "$(shasum -a 256 "$z" | cut -d ' ' -f 1)" "$(basename "$z")"
  done
}

build_k20_oracle() {
  local staging="$out_root/.k20-oracle-src"
  rm -rf "$staging"
  mkdir -p "$staging"
  git -C "$repo_root" show "$K20_ORACLE_COMMIT:$K20_ORACLE_PATH" > "$staging/manager.compact" 2>/dev/null || {
    echo "cannot read $K20_ORACLE_COMMIT:$K20_ORACLE_PATH — is this a shallow clone?" >&2
    echo "run: git fetch --unshallow   (CI: actions/checkout with fetch-depth: 0)" >&2
    exit 66
  }
  local got
  got="$(shasum -a 256 "$staging/manager.compact" | cut -d ' ' -f 1)"
  if [ "$got" != "$K20_ORACLE_SHA256" ]; then
    echo "k=20 oracle blob mismatch at $K20_ORACLE_COMMIT:$K20_ORACLE_PATH" >&2
    echo "  expected $K20_ORACLE_SHA256" >&2
    echo "  actual   $got" >&2
    exit 67
  fi
  log "K20_ORACLE_COMMIT=$K20_ORACLE_COMMIT (blob sha256 verified)"
  # Compiled under the name `manager.compact` so its generated provenance strings match the
  # historical artifact exactly.
  compile_one "manager-k20" "$staging" "manager.compact"
  rm -rf "$staging"
}

targets=("$@")
[ "${#targets[@]}" -eq 0 ] && targets=(all)
if [ "${targets[0]}" = "all" ]; then
  targets=(manager minter minter-collide k20-oracle)
fi

ensure_image
for t in "${targets[@]}"; do
  case "$t" in
    manager)        compile_one manager        "$repo_root/contracts"              manager.compact ;;
    minter)         compile_one minter         "$repo_root/contracts/test-support" minter.compact ;;
    minter-collide) compile_one minter-collide "$repo_root/contracts/test-support" minter-collide.compact ;;
    k20-oracle)     build_k20_oracle ;;
    *) echo "unknown target: $t (manager|minter|minter-collide|k20-oracle|all)" >&2; exit 64 ;;
  esac
done

keys="$(find "$out_root" \( -name '*.prover' -o -name '*.verifier' \) 2>/dev/null | wc -l | tr -d ' ')"
log "KEY_FILES=$keys"
[ "$keys" -eq 0 ] || { echo "--skip-zk produced key files; that should be impossible" >&2; exit 71; }
log "COMPILE_OK targets=${targets[*]}"
