#!/usr/bin/env bash
# Pinned Compact compiler image — one definition shared by the G1 probes and the G2 build.
#
# LANE-DEV-1 (owner-approved 2026-08-17, inherited by 00004): the lane pins
# `compactc-v0.33.0-rc.2`, which has no published binary; the released `compactc-v0.33.0` is used
# instead and verified empirically. The archive is pinned by SHA-256 in docker/compactc.Dockerfile.
set -euo pipefail

COMPACTC_IMAGE="aa00004-compactc:0.33.0"

# compactc_ensure_image <repo-root> — idempotent build of the pinned compiler image.
compactc_ensure_image() {
  local root="$1"
  if ! docker image inspect "$COMPACTC_IMAGE" >/dev/null 2>&1; then
    echo "building compiler image $COMPACTC_IMAGE"
    docker build -q -f "$root/docker/compactc.Dockerfile" -t "$COMPACTC_IMAGE" "$root" >/dev/null
  fi
}

# compactc_verify_lane_dev_1 <repo-root>
# The substitution must be PROVEN, not assumed. Closes the two version checkboxes left unticked in
# the 00003 lane manifest (`archive/00003/evidence/g1-lane/LANE.md`, LANE-DEV-1).
compactc_verify_lane_dev_1() {
  local root="$1" ver lang
  compactc_ensure_image "$root"
  ver="$(docker run --rm "$COMPACTC_IMAGE" compactc --version | tr -d '[:space:]')"
  lang="$(docker run --rm "$COMPACTC_IMAGE" compactc --language-version | tr -d '[:space:]')"
  echo "compiler version: ${ver}"
  echo "language version: ${lang}"
  [ "$ver" = "0.33.0" ]  || { echo "LANE-DEV-1 FAILED: compiler version is ${ver}, expected 0.33.0"; return 1; }
  [ "$lang" = "0.25.0" ] || { echo "LANE-DEV-1 FAILED: language version is ${lang}, expected 0.25.0"; return 1; }

  # The pinned rc.2 SOURCE (read-only reference checkout) must declare the same versions.
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
