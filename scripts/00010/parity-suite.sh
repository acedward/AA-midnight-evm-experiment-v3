#!/usr/bin/env bash
# 00010 — KEYLESS simulator parity suite for a compiled arm.
#
# Runs the existing auth/semantic byte-equality suites against ONE arm's compiled contract, to back
# the "byte-identical" claim for the semantics-preserving arms with executed bytes rather than
# source inspection alone.
#
# KEYLESS AND PROOFLESS: the harness simulator executes circuits directly. No proving key, verifier
# key, proof, or deployment is involved — the arms were compiled with `--skip-zk` and no key file
# exists to load.
#
# usage: parity-suite.sh setup                 # create the volume and install once
#        parity-suite.sh run <arm>             # overlay <arm>'s contract and run the suites
#        parity-suite.sh teardown              # remove the volume
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node_image="node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e"
project="aa00010_parity"
volume="${project}_work"
suites="src/auth/test/manager.test.ts src/auth/test/semantic.test.ts src/auth/test/compact.test.ts src/auth/test/codec.test.ts src/auth/test/k20-parity.test.ts src/auth/test/tier3.test.ts"

case "${1:-}" in
setup)
  port="$(bash "$repo_root/scripts/00010/free-port.sh")"
  echo "SETUP_PORT=$port"
  docker volume create --label com.docker.compose.project="$project" "$volume" >/dev/null
  docker run --rm --name "${project}-stage" \
    --label com.docker.compose.project="$project" \
    --cpus 2 --memory 8g --memory-swap 8g -e AA00010_PORT="$port" \
    -v "$repo_root:/src:ro" -v "$volume:/work" -w /src \
    "$node_image" \
    sh -euc 'tar --exclude="./.git" --exclude="./harness/node_modules" \
      --exclude="./harness/generated" --exclude="./harness/generated-00010" \
      --exclude="./harness/midnight-level-db" -cf - . | tar -xf - -C /work'
  # Dependency install is the ONLY step that needs the network; it is not a measurement.
  docker run --rm --name "${project}-install" \
    --label com.docker.compose.project="$project" \
    --cpus 2 --memory 8g --memory-swap 8g -e AA00010_PORT="$port" \
    -v "$volume:/work" -w /work/harness \
    "$node_image" \
    sh -euc 'corepack enable; corepack prepare pnpm@11.5.1 --activate; \
      pnpm install --frozen-lockfile'
  echo "SETUP_OK"
  ;;
run)
  arm="${2:?usage: parity-suite.sh run <arm>}"
  src="$repo_root/harness/generated-00010/$arm/manager"
  test -d "$src/contract"
  port="$(bash "$repo_root/scripts/00010/free-port.sh")"
  echo "ARM=$arm"
  echo "PARITY_PORT=$port"
  echo "CONTRACT_SHA256=$(shasum -a 256 "$src/contract/index.js" | cut -d ' ' -f 1)"
  echo "DTS_SHA256=$(shasum -a 256 "$src/contract/index.d.ts" | cut -d ' ' -f 1)"
  # The simulator also loads the two Minter contracts; those are the product's own sources,
  # identical for every arm, and only the Manager under test varies.
  mint="$repo_root/harness/generated-00010/aux-minter/manager"
  mintc="$repo_root/harness/generated-00010/aux-minter-collide/manager"
  test -d "$mint/contract" && test -d "$mintc/contract"
  # 00010: the k=20 REFERENCE ORACLE is mounted alongside the arm under test, so the suites can
  # run both compiled Managers side by side on identical inputs. FR-1003/FR-1004 byte-equality is
  # then an EXECUTED comparison against the real k=20 artifact, not source inspection.
  ref="$repo_root/harness/generated-00010/product-k20/manager"
  test -d "$ref/contract"
  echo "REFERENCE_CONTRACT_SHA256=$(shasum -a 256 "$ref/contract/index.js" | cut -d ' ' -f 1)"
  docker run --rm --name "${project}-run-$(echo "$arm" | tr '[:upper:]' '[:lower:]')" \
    --label com.docker.compose.project="$project" \
    --cpus 2 --memory 8g --memory-swap 8g -e AA00010_PORT="$port" \
    -v "$volume:/work" -v "$src:/arm:ro" -v "$ref:/reference:ro" \
    -v "$mint:/aux-minter:ro" -v "$mintc:/aux-minter-collide:ro" -w /work/harness \
    "$node_image" \
    sh -euc 'rm -rf generated; \
      mkdir -p generated/manager generated/manager-k20 generated/minter generated/minter-collide; \
      cp -a /arm/compiler /arm/contract generated/manager/; \
      cp -a /reference/compiler /reference/contract generated/manager-k20/; \
      cp -a /aux-minter/compiler /aux-minter/contract generated/minter/; \
      cp -a /aux-minter-collide/compiler /aux-minter-collide/contract generated/minter-collide/; \
      test -z "$(find generated -name "*.prover" -o -name "*.verifier")"; \
      node_modules/.bin/vitest run '"$suites"
  ;;
teardown)
  docker volume rm "$volume" >/dev/null 2>&1 || true
  echo "TEARDOWN_OK residual_volumes=$(docker volume ls --filter label=com.docker.compose.project=$project -q | wc -l | tr -d ' ')"
  ;;
*)
  echo "usage: $0 setup|run <arm>|teardown" >&2
  exit 64
  ;;
esac
