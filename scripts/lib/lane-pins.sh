#!/usr/bin/env bash
# Lane pins for 00004-multi-token-custody — EXPERIMENTAL_LANE, deviation LANE-DEV-1.
#
# THIS PROJECT DOES NOT PIN ANYTHING. It REUSES the lane that project 00003 pinned and verified,
# and proves the reuse. The values below are transcribed from the 00003 lane manifest
# (`archive/00003/evidence/g1-lane/LANE.md`, recorded 2026-08-17) and are asserted three ways by
# `lane_assert_pins_unchanged`:
#
#   1. the digests written in THIS tree's docker/ files equal the digests at the 00003 base commit
#      `a8ebff9` (comment edits allowed, pin edits not);
#   2. the harness lockfile is byte-identical to `a8ebff9` (npm pins therefore identical);
#   3. the images docker compose will actually run reference exactly these digests.
#
# Any mismatch is a BLOCKER, never something to fix by editing a pin.

set -euo pipefail

# The 00003 merged head this branch is based on (owner decision Q4).
LANE_BASE_COMMIT="a8ebff9614b4d2a811d90b1956c6f1d969160dd6"

# Container images — index (manifest-list) digests, as referenced by docker/compose.yml.
LANE_PIN_NODE="sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e"
LANE_PIN_INDEXER="sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a"
LANE_PIN_PROVER="sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f"

# Platform-specific (linux/arm64) image digests, recorded by 00003 for the record.
LANE_PIN_NODE_ARM64="sha256:d1e5fc231147e9af739a1128ae0941119fd59dca7356a2333567bad7b57d7424"
LANE_PIN_INDEXER_ARM64="sha256:628002a181edfc7d67d43944e84a35d920a0077c89cab6301169079b30c79316"
LANE_PIN_PROVER_ARM64="sha256:8a4b29d737c1da754df0443e4a552a7934b47e17e99cd893a70120e4ce21fcaf"

# Compiler archive (LANE-DEV-1: released compactc-v0.33.0 stands in for the unpublished -rc.2).
LANE_PIN_COMPACTC_SHA256="3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46"
LANE_EXPECT_COMPILER_VERSION="0.33.0"
LANE_EXPECT_LANGUAGE_VERSION="0.25.0"

# Component versions the digests above stand for (documentation; asserted via the digests).
LANE_COMPONENTS=(
  "midnight-node            node-2.0.0-rc.4"
  "midnight-ledger          ledger-9.1.0.0-rc.3"
  "midnight-indexer         v4.4.0-rc.1 (arm64 tag 4.4.0-rc.1-arm64, finding L-1)"
  "proof-server             9.0.0-rc.3 (finding L-2)"
  "midnight-js              v5.0.0-beta.6"
  "wallet-sdk               2.0.0-beta.2"
  "compactc                 0.33.0 / language 0.25.0 (LANE-DEV-1)"
)

# Extract every sha256:… token from a blob, sorted and deduplicated.
_lane_digests() { grep -oE 'sha256:[0-9a-f]{64}' | sort -u; }

# lane_assert_pins_unchanged <repo-root>
# Proves the lane was reused rather than re-pinned. Prints a full digest table. Returns nonzero on
# ANY divergence.
lane_assert_pins_unchanged() {
  local root="$1" rc=0 f base_d now_d

  echo "== lane reuse proof — base commit ${LANE_BASE_COMMIT} (00003 merged head)"
  if ! git -C "$root" cat-file -e "${LANE_BASE_COMMIT}^{commit}" 2>/dev/null; then
    echo "FATAL: base commit ${LANE_BASE_COMMIT} not present in this clone"
    return 1
  fi
  echo "base commit present: $(git -C "$root" log -1 --format='%h %s' "$LANE_BASE_COMMIT")"

  echo
  echo "== (1) pin values in docker/ are unchanged since the base commit"
  # Only compose.yml carries `sha256:`-prefixed IMAGE digests. compactc.Dockerfile pins an ARCHIVE
  # by bare-hex SHA-256 and is checked separately, just below.
  for f in docker/compose.yml; do
    base_d="$(git -C "$root" show "${LANE_BASE_COMMIT}:${f}" | _lane_digests || true)"
    now_d="$(_lane_digests < "$root/$f" || true)"
    if [ -z "$base_d" ]; then
      echo "FATAL: no image digests found in ${f} at the base commit"; rc=1; continue
    fi
    if [ "$base_d" = "$now_d" ]; then
      echo "pins unchanged: ${f}"
      echo "$now_d" | sed 's/^/    /'
    else
      echo "PIN DRIFT in ${f}:"
      echo "  base:"; echo "$base_d" | sed 's/^/    /'
      echo "  now:";  echo "$now_d"  | sed 's/^/    /'
      rc=1
    fi
  done

  # The compiler archive is pinned by URL + bare-hex SHA-256 rather than by an image digest.
  base_d="$(git -C "$root" show "${LANE_BASE_COMMIT}:docker/compactc.Dockerfile" \
            | grep -E '^ARG COMPACTC_(URL|SHA256)=' | sort)"
  now_d="$(grep -E '^ARG COMPACTC_(URL|SHA256)=' "$root/docker/compactc.Dockerfile" | sort)"
  if [ "$base_d" = "$now_d" ]; then
    echo "pins unchanged: compactc archive"
    echo "$now_d" | sed 's/^/    /'
  else
    echo "PIN DRIFT in the compactc archive pin:"
    echo "  base:"; echo "$base_d" | sed 's/^/    /'
    echo "  now:";  echo "$now_d"  | sed 's/^/    /'
    rc=1
  fi
  if ! grep -qF "$LANE_PIN_COMPACTC_SHA256" "$root/docker/compactc.Dockerfile"; then
    echo "FATAL: docker/compactc.Dockerfile does not carry the 00003 archive SHA-256"; rc=1
  fi

  echo
  echo "== (2) npm pins: harness lockfile byte-identical to the base commit"
  if git -C "$root" diff --quiet "$LANE_BASE_COMMIT" -- harness/pnpm-lock.yaml; then
    echo "lockfile unchanged: harness/pnpm-lock.yaml ($(git -C "$root" rev-parse "${LANE_BASE_COMMIT}:harness/pnpm-lock.yaml"))"
  else
    echo "LOCKFILE DRIFT: harness/pnpm-lock.yaml differs from ${LANE_BASE_COMMIT}"
    git -C "$root" diff --stat "$LANE_BASE_COMMIT" -- harness/pnpm-lock.yaml
    rc=1
  fi
  # package.json may legitimately change (name/description); its DEPENDENCY BLOCK may not.
  base_d="$(git -C "$root" show "${LANE_BASE_COMMIT}:harness/package.json" \
            | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify({dependencies:j.dependencies,devDependencies:j.devDependencies},null,2))})')"
  now_d="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify({dependencies:j.dependencies,devDependencies:j.devDependencies},null,2))})' < "$root/harness/package.json")"
  if [ "$base_d" = "$now_d" ]; then
    echo "dependency versions unchanged: harness/package.json"
  else
    echo "DEPENDENCY DRIFT in harness/package.json:"
    diff <(echo "$base_d") <(echo "$now_d") || true
    rc=1
  fi

  echo
  echo "== (3) the images docker compose will run reference exactly the pinned digests"
  local resolved pair svc want
  resolved="$("${COMPOSE[@]}" config --images)"
  for pair in "node:$LANE_PIN_NODE" "indexer:$LANE_PIN_INDEXER" "proof-server:$LANE_PIN_PROVER"; do
    svc="${pair%%:*}"; want="${pair#*:}"
    if grep -qF "$want" <<<"$resolved"; then
      echo "digest ok: ${svc} -> ${want}"
    else
      echo "DIGEST MISMATCH: no image references ${want} (expected for ${svc})"; rc=1
    fi
  done
  echo "-- images compose will run:"
  echo "$resolved" | sed 's/^/    /'

  echo
  echo "== lane component table (EXPERIMENTAL_LANE / LANE-DEV-1)"
  printf '    %s\n' "${LANE_COMPONENTS[@]}"
  echo "    arm64 image digests (recorded by 00003):"
  echo "      node         ${LANE_PIN_NODE_ARM64}"
  echo "      indexer      ${LANE_PIN_INDEXER_ARM64}"
  echo "      proof-server ${LANE_PIN_PROVER_ARM64}"

  if [ "$rc" -ne 0 ]; then
    echo
    echo "LANE REUSE PROOF FAILED — this is a BLOCKER. Do not edit a pin to make it pass."
  fi
  return "$rc"
}
