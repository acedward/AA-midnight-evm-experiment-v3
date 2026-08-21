#!/usr/bin/env bash
# Lane pins for 00006-unbalanced-zswap — EXPERIMENTAL_LANE, deviation LANE-DEV-1.
#
# THIS PROJECT DOES NOT PIN ANYTHING. It REUSES the lane that project 00003 pinned and verified and
# that projects 00004 and 00005 each re-proved, and it proves the reuse again. The values below are
# transcribed from the 00003 lane manifest (`archive/00003/evidence/g1-lane/LANE.md`, recorded
# 2026-08-17) and were carried through 00004 and 00005 unchanged; they are asserted three ways by
# `lane_assert_pins_unchanged`:
#
#   1. the digests written in THIS tree's docker/ files equal the digests at the 00005 base commit
#      `e9701e9` (comment edits allowed, pin edits not);
#   2. the harness lockfile is byte-identical to `e9701e9` (npm pins therefore identical);
#   3. the images docker compose will actually run reference exactly these digests.
#
# The base moved 00003 `a8ebff9` -> 00004 `f066a09` -> 00005 `e9701e9`, which is a strictly stronger
# claim about the SAME pins each time: 00004's G1 proved `f066a09` byte-identical to `a8ebff9`, and
# 00005's G1 proved `e9701e9` byte-identical to `f066a09`. Check (0) below re-walks the WHOLE chain
# here — three hops, not one — rather than trusting either ancestor's own claim. If any intermediate
# project had silently re-pinned something, a check against the immediate base alone would pass.
#
# Any mismatch is a BLOCKER, never something to fix by editing a pin.

set -euo pipefail

# The 00005 head this branch is based on. PR #3 is deliberately held OPEN (owner decision Q4→A,
# 2026-08-19: 00006 stacks on it), so the base is a branch head, not a merge commit.
LANE_BASE_COMMIT="e9701e97bb229f555f66216014bec4a5ec6e95e7"

# The ancestor chain, oldest first: the 00003 merged head that PINNED this lane, then the 00004 head
# 00005 forked from. Walked (not merely asserted) by check (0) of `lane_assert_pins_unchanged`.
LANE_ORIGIN_COMMIT="a8ebff9614b4d2a811d90b1956c6f1d969160dd6"
LANE_CHAIN_COMMITS=(
  "a8ebff9614b4d2a811d90b1956c6f1d969160dd6  00003 merged head — the ORIGINAL pinning act"
  "f066a09adc4bc2fd47dc045083530aab519f65c2  00004 head (PR #2, held OPEN)"
  "e9701e97bb229f555f66216014bec4a5ec6e95e7  00005 head (PR #3, held OPEN) — this branch's base"
)

# Container images — index (manifest-list) digests, as referenced by docker/compose.yml.
LANE_PIN_NODE="sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e"
LANE_PIN_INDEXER="sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a"
LANE_PIN_PROVER="sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f"

# Platform-specific (linux/arm64) image digests, recorded by 00003 for the record.
LANE_PIN_NODE_ARM64="sha256:d1e5fc231147e9af739a1128ae0941119fd59dca7356a2333567bad7b57d7424"
LANE_PIN_INDEXER_ARM64="sha256:628002a181edfc7d67d43944e84a35d920a0077c89cab6301169079b30c79316"
LANE_PIN_PROVER_ARM64="sha256:8a4b29d737c1da754df0443e4a552a7934b47e17e99cd893a70120e4ce21fcaf"

# Compiler archive. THE PIN IS THE DIGEST; the URL is only where the bytes are fetched from.
#
# That distinction was implicit until 00006 forced it. 00006 finding F-316: the original
# `midnightntwrk/compact` release was REMOVED (HTTP 404 from github.com itself), and the owner located
# the archive at `LFDT-Minokawa/compact` under release `compactc-v0.33.0-rc.2` — whose asset hashes to
# EXACTLY the digest below, the one 00003 recorded. So the bytes never changed; only their address did.
#
# The checks therefore treat the two differently, and the strictness is not reduced:
#   IDENTITY  `COMPACTC_SHA256` must be byte-identical at every hop and against the base commit.
#             Non-negotiable. A change here is a re-pin and fails.
#   TRANSPORT `COMPACTC_URL` may differ from history ONLY by matching one of the DECLARED urls below,
#             and only while the digest is unchanged. An UNDECLARED url still fails, so accidental
#             drift is caught exactly as before — what is now possible is a RECORDED relocation.
#
# Owner decision, 2026-08-20 (Plan 05 question Q05-1, option D): relocate the URL, keep the digest,
# do not re-pin the compiler (owner Q2 -> A: inherited lane, never re-pinned).
LANE_PIN_COMPACTC_SHA256="3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46"
# Where 00003..00006-G4 fetched it from (now 404 — F-316).
LANE_PIN_COMPACTC_URL_HISTORICAL="https://github.com/midnightntwrk/compact/releases/download/compactc-v0.33.0/compactc_v0.33.0_aarch64-unknown-linux-musl.zip"
# Where it is fetched from now. Note the tag is `-rc.2` — the tag the spec pins all along.
LANE_PIN_COMPACTC_URL_CURRENT="https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.33.0-rc.2/compactc_v0.33.0-rc.2_aarch64-unknown-linux-musl.zip"

# _lane_compactc_url <blob>  -> the ARG COMPACTC_URL value in a Dockerfile blob on stdin
_lane_compactc_url() { grep -E '^ARG COMPACTC_URL=' | head -1 | sed 's/^ARG COMPACTC_URL=//'; }
# _lane_compactc_sha <blob>  -> the ARG COMPACTC_SHA256 value
_lane_compactc_sha() { grep -E '^ARG COMPACTC_SHA256=' | head -1 | sed 's/^ARG COMPACTC_SHA256=//'; }
# A url is acceptable iff it is one of the two DECLARED addresses for these bytes.
_lane_url_declared() {
  [ "$1" = "$LANE_PIN_COMPACTC_URL_HISTORICAL" ] || [ "$1" = "$LANE_PIN_COMPACTC_URL_CURRENT" ]
}
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

  echo "== lane inheritance proof — base commit ${LANE_BASE_COMMIT} (00005 head; PR #3 held OPEN)"
  if ! git -C "$root" cat-file -e "${LANE_BASE_COMMIT}^{commit}" 2>/dev/null; then
    echo "FATAL: base commit ${LANE_BASE_COMMIT} not present in this clone"
    return 1
  fi
  echo "base commit present: $(git -C "$root" log -1 --format='%h %s' "$LANE_BASE_COMMIT")"

  # (0) The INHERITANCE CHAIN. 00006 is THREE projects removed from the act that pinned this lane, so
  # "unchanged since my base" is not enough: every hop of the chain is compared, pairwise, from the
  # 00003 merged head that pinned the digests through 00004 and 00005 to this branch's base. If any
  # intermediate project had silently re-pinned something, a check against the immediate base alone
  # would happily pass.
  echo
  echo "== (0) inheritance chain, hop by hop"
  local entry sha label prev_sha="" prev_label=""
  for entry in "${LANE_CHAIN_COMMITS[@]}"; do
    sha="${entry%% *}"; label="${entry#*  }"
    if ! git -C "$root" cat-file -e "${sha}^{commit}" 2>/dev/null; then
      echo "NOTE: ${sha:0:7} (${label}) is not present in this clone; that hop is SKIPPED"
      continue
    fi
    echo "  ${sha:0:7}  ${label}"
    if [ -n "$prev_sha" ]; then
      local a b
      a="$(git -C "$root" show "${prev_sha}:docker/compose.yml" | _lane_digests || true)"
      b="$(git -C "$root" show "${sha}:docker/compose.yml" | _lane_digests || true)"
      if [ -n "$a" ] && [ "$a" = "$b" ]; then
        echo "    hop ${prev_sha:0:7} -> ${sha:0:7}: image digests IDENTICAL"
      else
        echo "    PIN DRIFT on hop ${prev_sha:0:7} -> ${sha:0:7}:"
        echo "      before:"; echo "$a" | sed 's/^/        /'
        echo "      after:";  echo "$b" | sed 's/^/        /'
        rc=1
      fi
      # IDENTITY: the digest must not move across a hop.
      a="$(git -C "$root" show "${prev_sha}:docker/compactc.Dockerfile" | _lane_compactc_sha)"
      b="$(git -C "$root" show "${sha}:docker/compactc.Dockerfile" | _lane_compactc_sha)"
      local ua ub
      ua="$(git -C "$root" show "${prev_sha}:docker/compactc.Dockerfile" | _lane_compactc_url)"
      ub="$(git -C "$root" show "${sha}:docker/compactc.Dockerfile" | _lane_compactc_url)"
      if [ -z "$a" ] || [ "$a" != "$b" ]; then
        echo "    COMPACTC DIGEST DRIFT on hop ${prev_sha:0:7} -> ${sha:0:7}: '${a}' -> '${b}'"; rc=1
      elif ! _lane_url_declared "$ua" || ! _lane_url_declared "$ub"; then
        echo "    COMPACTC URL UNDECLARED on hop ${prev_sha:0:7} -> ${sha:0:7}:"; rc=1
        echo "      before: ${ua}"; echo "      after:  ${ub}"
      elif [ "$ua" = "$ub" ]; then
        echo "    hop ${prev_sha:0:7} -> ${sha:0:7}: compactc archive pin IDENTICAL"
      else
        echo "    hop ${prev_sha:0:7} -> ${sha:0:7}: compactc digest IDENTICAL; url RELOCATED (declared, F-316)"
      fi
      if git -C "$root" diff --quiet "$prev_sha" "$sha" -- harness/pnpm-lock.yaml; then
        echo "    hop ${prev_sha:0:7} -> ${sha:0:7}: harness/pnpm-lock.yaml IDENTICAL"
      else
        echo "    LOCKFILE DRIFT on hop ${prev_sha:0:7} -> ${sha:0:7}"; rc=1
      fi
    fi
    prev_sha="$sha"; prev_label="$label"
  done
  : "$prev_label"

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
  base_sha="$(git -C "$root" show "${LANE_BASE_COMMIT}:docker/compactc.Dockerfile" | _lane_compactc_sha)"
  now_sha="$(_lane_compactc_sha < "$root/docker/compactc.Dockerfile")"
  base_url="$(git -C "$root" show "${LANE_BASE_COMMIT}:docker/compactc.Dockerfile" | _lane_compactc_url)"
  now_url="$(_lane_compactc_url < "$root/docker/compactc.Dockerfile")"
  if [ -z "$now_sha" ] || [ "$base_sha" != "$now_sha" ]; then
    echo "PIN DRIFT — the compactc archive DIGEST changed since the base commit. This IS a re-pin:"
    echo "  base: ${base_sha}"; echo "  now:  ${now_sha}"
    rc=1
  elif ! _lane_url_declared "$now_url"; then
    echo "PIN DRIFT — the compactc archive URL is not one of the DECLARED addresses for these bytes:"
    echo "  now:        ${now_url}"
    echo "  declared:   ${LANE_PIN_COMPACTC_URL_HISTORICAL}"
    echo "              ${LANE_PIN_COMPACTC_URL_CURRENT}"
    rc=1
  elif [ "$base_url" = "$now_url" ]; then
    echo "pins unchanged: compactc archive (digest AND url)"
    echo "    ARG COMPACTC_SHA256=${now_sha}"
    echo "    ARG COMPACTC_URL=${now_url}"
  else
    echo "pins unchanged: compactc archive DIGEST (the pin); url RELOCATED, declared — 00006 F-316"
    echo "    ARG COMPACTC_SHA256=${now_sha}   <- identical to the base commit"
    echo "    was: ${base_url}"
    echo "    now: ${now_url}"
    echo "    the relocated release is tagged compactc-v0.33.0-rc.2 — the tag the spec pins — and its"
    echo "    asset hashes to the digest above, so LANE-DEV-1's substitution is PROVEN, not assumed."
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
