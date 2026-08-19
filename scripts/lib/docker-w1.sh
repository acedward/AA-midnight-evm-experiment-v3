#!/usr/bin/env bash
# W-1 — inherited HOST workaround, adopted by every 00005 gate from the start.
#
# THE FAULT (diagnosed by 00004 at G4, not guessed): this host's `~/.docker/config.json` sets
# `"credsStore": "desktop"`, and `docker-credential-desktop get` can hang indefinitely. Every
# `docker pull` blocks on that credential lookup BEFORE it reaches the network, so the daemon
# answers `docker info` normally while even `docker pull hello-world` never completes. 00004's G4
# run 1 lost 63 minutes to it on a shared machine.
#
# THE WORKAROUND: run the gate's own child processes with `DOCKER_CONFIG` pointing at a scratch
# directory that contains `{}` (no `credsStore`) plus a symlink to the user's real `cli-plugins`.
# Pulls then run ANONYMOUSLY and complete immediately.
#
# ITS EXACT SCOPE, and why it changes nothing this project asserts:
#   - it is an ENVIRONMENT VARIABLE for this process tree only. `~/.docker/config.json`, Docker
#     Desktop's settings and every other project on this shared host are untouched;
#   - no pin, contract, wrapper step or piece of evidence is altered to accommodate it — in
#     particular the `pull` step is never skipped;
#   - the images are public and PINNED BY DIGEST, and the digest is the identity, so an anonymous
#     pull fetches exactly the same bytes. `lane_assert_pins_unchanged` still asserts the three
#     digests through `docker compose config --images`, and `stack_health` still records the image
#     IDs that actually run.
#
# THE TRAP (00004 G4 run 2, RED): Docker resolves CLI **plugins** through the config directory too.
# A scratch directory WITHOUT a `cli-plugins` symlink makes `docker compose` vanish — `docker
# compose --env-file …` then fails with `unknown flag: --env-file`, teardown fails with exit 125,
# and the lane-reuse proof reports `DIGEST MISMATCH` for all three services because it can no longer
# enumerate any image at all. That is the correct behaviour of the check and the wrong form of the
# workaround. `w1_enable` therefore REFUSES to run if it cannot link the plugins, and proves the
# compose plugin still resolves before returning.
#
# Source this, then call `w1_enable <repo-root>` before anything touches docker, and chain
# `w1_cleanup` into the wrapper's teardown.
set -euo pipefail

W1_SCRATCH_DIR=""

# w1_enable <repo-root> — export a scratch DOCKER_CONFIG for this process tree and prove it works.
w1_enable() {
  local root="$1" src plugins
  src="${DOCKER_CONFIG:-$HOME/.docker}"

  if [ ! -d "$src/cli-plugins" ]; then
    echo "W-1 REFUSED: no cli-plugins directory at ${src}/cli-plugins." >&2
    echo "Enabling the workaround without it would hide the 'docker compose' plugin (00004 G4 run 2)." >&2
    return 1
  fi

  W1_SCRATCH_DIR="$(mktemp -d "${TMPDIR:-/tmp}/aa00005-dockercfg-XXXXXX")"
  printf '{}\n' > "$W1_SCRATCH_DIR/config.json"
  ln -s "$src/cli-plugins" "$W1_SCRATCH_DIR/cli-plugins"
  export DOCKER_CONFIG="$W1_SCRATCH_DIR"

  echo "== W-1 adopted (inherited host workaround, 00004 G4)"
  echo "source config dir : ${src}"
  echo "scratch DOCKER_CONFIG: ${W1_SCRATCH_DIR}"
  echo "scratch config.json  : $(cat "$W1_SCRATCH_DIR/config.json")"
  echo "cli-plugins          : symlink -> ${src}/cli-plugins ($(ls "$W1_SCRATCH_DIR/cli-plugins" | wc -l | tr -d ' ') plugins)"

  # The plugin must still resolve. If it does not, fail HERE rather than in teardown.
  echo -n "docker compose plugin under the scratch config: "
  docker compose version --short

  # …and the CLI must still be talking to the same daemon.
  echo -n "daemon under the scratch config: "
  docker info --format 'server {{.ServerVersion}}, {{.Containers}} containers, {{.Images}} images'

  echo "scope: environment variable only — ~/.docker/config.json is not modified"
  return 0
}

# w1_cleanup — remove the scratch directory. Safe to call when w1_enable never ran.
w1_cleanup() {
  [ -n "$W1_SCRATCH_DIR" ] || { echo "W-1: no scratch config to remove"; return 0; }
  case "$W1_SCRATCH_DIR" in
    /tmp/*|/private/tmp/*|/var/folders/*|/private/var/folders/*) ;;
    *) echo "W-1: REFUSING to remove '${W1_SCRATCH_DIR}': not under a temporary directory" >&2; return 1 ;;
  esac
  rm -rf "$W1_SCRATCH_DIR"
  [ ! -d "$W1_SCRATCH_DIR" ] || { echo "W-1: scratch config still present after removal" >&2; return 1; }
  echo "W-1: scratch DOCKER_CONFIG removed (${W1_SCRATCH_DIR})"
}
