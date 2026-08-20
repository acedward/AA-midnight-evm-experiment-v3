#!/usr/bin/env bash
# G2 gate wrapper — 00006-unbalanced-zswap (EXPERIMENTAL_LANE / LANE-DEV-1).
#
# Runs Plan 02 end to end from nothing:
#
#   adopt W-1 (scratch DOCKER_CONFIG) -> W-2 (caffeinate) -> probe ports -> prove the lane is still the
#   INHERITED one, hop by hop -> prove LANE-DEV-1 -> compile fast -> install -> UNIT SUITES (Manager v4
#   swap circuits, the offer envelope, and 00005's whole unchanged suite) -> typecheck (no NEW errors)
#   -> compile ZK (+ the F-201 verifier-key discipline check) -> pull pinned digests -> boot -> health
#   -> load gate
#   -> SPIKE S4  (floating-surplus OPEN offer — the owner-REQUIRED outcome)
#   -> SPIKE S4b (bearer-key fallback; runs ONLY if S4 was refuted, per Plan 02 Phase 3)
#   -> SPIKE S5  (staleness window, FR-311)
#   -> SPIKE S6  (merged-fee dust — the maker pays nothing)
#   -> record artifacts + the spike index + the OPENNESS verdict -> teardown
#
# GATE CONDITION, and where it deliberately differs from "everything must be GREEN":
#
#   * the offline half (compile, unit suites, typecheck, F-201) must pass outright;
#   * S6 is on the v1 path, so a refusal there IS a gate failure (Plan 02: "the wrapper also fails on
#     harness/infra failure or a v1-path refusal");
#   * S5 MEASURES rather than passes: FR-311 says the staleness window is lane behaviour to record, so
#     a departure from the prediction is written down, not scored. Only a crash makes it red;
#   * S4 and S4b are each green evidence in EITHER direction — REFUTED is a result the FR-308 ladder
#     is built to absorb. A spike is red only if it settled and then failed its own assertions.
#
# IF BOTH OPEN SHAPES ARE REFUTED the openness goal is RED. That is recorded loudly — in
# `evidence/g2-spikes/OPENNESS.md`, in the spike index, and as a banner on stdout — and the wrapper
# still exits 0, per the owner's unattended-window directive of 2026-08-19 ("make all the tests, if
# something fails -> all alternative paths in this time"). The rationale is in the master plan: G2 can
# close for the v1 path while openness is RED, and Plan 03 then runs rows 7-8 in the spec's
# recorded-refusal form. Silently downgrading to "v1 works" would be the reporting failure FR-308
# forbids; exiting 0 with the RED written down in three places is not that.
#
# Fail-safe contract (inherited from 00003 via 00004 and 00005): set -euo pipefail, EXIT/INT/TERM
# traps, argv/cwd/UTC recorded before each command and duration/exit after, and a TEARDOWN FAILURE
# REPLACES an otherwise-zero result. The gate is green only if this process exits 0.
#
# Shared-host rules: a UNIQUE compose project name per run, host ports verified free and above 10000,
# bound to 127.0.0.1 only, and nothing left running — the teardown hook asserts that.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# W-2 must run BEFORE fs_init: the re-exec replaces this process, and doing it after fs_init would
# truncate the run log the parent had just created.
# shellcheck source=../lib/nosleep.sh
source "$ROOT/scripts/lib/nosleep.sh"
nosleep_reexec "${BASH_SOURCE[0]}" "$@"
# shellcheck source=../lib/failsafe.sh
source "$ROOT/scripts/lib/failsafe.sh"
# shellcheck source=../lib/docker-w1.sh
source "$ROOT/scripts/lib/docker-w1.sh"
# shellcheck source=../lib/lane-pins.sh
source "$ROOT/scripts/lib/lane-pins.sh"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"
# shellcheck source=../lib/stack.sh
source "$ROOT/scripts/lib/stack.sh"
# shellcheck source=../lib/loadgate.sh
source "$ROOT/scripts/lib/loadgate.sh"

MODE="full"
while [ $# -gt 0 ]; do
  case "$1" in
    # Stops after the offline half. That is Plan 02 Phases 1-2's whole deliverable (circuits compile,
    # unit negatives hold, the envelope kit round-trips), so the phases and the gate share ONE wrapper
    # instead of two that could drift apart.
    --offline) MODE="offline"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

EVID="$ROOT/evidence/g2-contracts"
SPIKE_EVID="$ROOT/evidence/g2-spikes"
GATE=$([ "$MODE" = "offline" ] && echo "G2-OFFLINE" || echo "G2")

fs_init "$GATE" "$EVID" "$MODE"

IMAGE="$COMPACTC_IMAGE"

# This gate owns a disposable stack of its own; the name cannot collide with any other project or any
# concurrent run on this shared host.
PROJECT="aa00006-g2-$(date -u +%Y%m%d%H%M%S)-$$"

COMPOSE=(docker compose --env-file "$ROOT/docker/.env" -f "$ROOT/docker/compose.yml")

# Teardown is owned by this wrapper and must succeed — INCLUDING the residue check and W-1 cleanup.
fs_set_teardown "${COMPOSE[*]} down -v --remove-orphans && stack_assert_clean ${PROJECT} && w1_cleanup"

step_w1() { w1_enable "$ROOT"; }
step_probe_ports() { "$ROOT/scripts/g1/probe-ports.sh" --project "$PROJECT" --evidence "$EVID"; }

# The lane is INHERITED, never re-pinned, and the check walks EVERY hop 00003 -> 00004 -> 00005 -> here.
step_lane_reuse() { lane_assert_pins_unchanged "$ROOT"; }
step_lane_dev_1() { compactc_verify_lane_dev_1 "$ROOT"; }

step_compile_fast() { "$ROOT/scripts/g2/compile.sh" --skip-zk; }
step_install()      { (cd "$ROOT/harness" && pnpm install --frozen-lockfile); }
# 00005's suite runs UNCHANGED alongside 00006's new ones, which is what makes "v4 extends v3, never
# weakens it" a fact about a green file rather than a claim.
step_unit_suites()  { (cd "$ROOT/harness" && npx vitest run); }
# Not a bare `tsc`: the base commit does not typecheck (F-302, a defect in the PINNED TYPES). This
# subtracts that one known baseline and fails on anything else — and also fails if the baseline stops
# reproducing, so the tolerance cannot quietly widen.
step_typecheck()    { "$ROOT/scripts/typecheck.sh"; }
# Also runs the F-201 discipline check: a verifier key shared between contracts whose PROVER keys
# differ is FATAL; identical-on-both is an expected observation.
step_compile_zk()   { "$ROOT/scripts/g2/compile.sh" --zk; }

step_pull()   { "${COMPOSE[@]}" pull; }
step_boot()   { "${COMPOSE[@]}" up -d; }
step_health() { stack_health "$ROOT"; }
step_loadgate() { loadgate_wait 900; }

# --- spikes, with BOUNDED infra retries -----------------------------------------------------------
#
# Owner directive, 12-hour unattended window: bounded infra retries (2 per failure class), each
# recorded VOID with its cause. This implements exactly that and nothing broader — the retry fires
# ONLY when the spike's own fatal record matches a known INFRASTRUCTURE signature. A product-code
# failure, a refusal, or an assertion failure is never retried, because retrying those would turn a
# real result into a coin flip.
INFRA_SIGNATURES='AbortError|ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|EAI_AGAIN|Timeout has occurred|ETIMEDOUT|503|502|504|read ECONNRESET'
VOID_RUNS=0

spike_is_infra_failure() {
  local json="$1"
  [ -f "$json" ] || return 1
  python3 - "$json" "$INFRA_SIGNATURES" <<'PY'
import json, re, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
blob = json.dumps(d)
sys.exit(0 if re.search(sys.argv[2], blob) else 1)
PY
}

# run_spike <step-name> <spike-id> <command...>
run_spike() {
  local step="$1" spike="$2"; shift 2
  local json step_name
  json="$SPIKE_EVID/$(echo "$spike" | tr '[:upper:]' '[:lower:]').json"
  local attempt=1 max=3   # 1 real attempt + 2 bounded infra retries
  while : ; do
    if [ "$attempt" -eq 1 ]; then step_name="$step"; else step_name="${step}-retry$((attempt - 1))"; fi
    if fs_run "$step_name" "$@"; then
      return 0
    fi
    if [ "$attempt" -ge "$max" ]; then
      echo "[${GATE}] ${spike}: failed after ${attempt} attempt(s); not retrying further" >&2
      return 1
    fi
    if ! spike_is_infra_failure "$json"; then
      echo "[${GATE}] ${spike}: the failure is NOT an infrastructure signature — no retry." >&2
      echo "[${GATE}] ${spike}: a product-code or lane refusal is a RESULT, and retrying it would turn" >&2
      echo "[${GATE}] ${spike}: a real finding into a coin flip." >&2
      return 1
    fi
    # VOID: preserve the evidence and say why, so the attempt is not silently forgotten.
    local void="$SPIKE_EVID/void/${spike}-attempt${attempt}"
    mkdir -p "$void"
    cp -a "$SPIKE_EVID"/*.json "$SPIKE_EVID"/*.md "$void/" 2>/dev/null || true
    {
      echo "# VOID — ${spike} attempt ${attempt}"
      echo
      echo "Recorded (UTC): $(fs_utc)"
      echo
      echo "This attempt is **VOID, not RED**. Its fatal record matched an INFRASTRUCTURE signature"
      echo "(\`${INFRA_SIGNATURES}\`), which on this shared host means the failure is evidence about the"
      echo "host — a dropped socket, a starved proof server, an indexer timeout — and not about the"
      echo "ledger, the node or the offer format. Recording it rather than discarding it is the point:"
      echo "G1 run 1 was VOIDed for exactly this reason and its partial numbers were never used."
      echo
      echo "Host at the time: 1-min load $(loadgate_load1) on $(loadgate_cores) cores."
      echo
      echo "No conclusion may be drawn from this attempt. The retry that follows is a fresh measurement."
    } > "$void/VOID.md"
    VOID_RUNS=$((VOID_RUNS + 1))
    echo "[${GATE}] ${spike}: attempt ${attempt} VOID (infrastructure) — evidence kept at ${void#$ROOT/}; retrying"
    loadgate_wait 900 || true
    attempt=$((attempt + 1))
  done
}

spike_verdict() {
  local spike="$1"
  local json="$SPIKE_EVID/$(echo "$spike" | tr '[:upper:]' '[:lower:]').json"
  if [ -f "$json" ]; then
    python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('verdict','(none)'))" "$json"
  else
    echo "NOT PRODUCED"
  fi
}

step_spike_s4()  { (cd "$ROOT/harness" && npx tsx src/g2/spike-s4.ts); }
step_spike_s4b() { (cd "$ROOT/harness" && npx tsx src/g2/spike-s4b.ts); }
# Waits pinned HERE rather than left to the script's defaults, so the gate is reproducible. The plan
# asks for 60 / 600 / 1800 s; the arms are strictly sequential because a settlement on either colour
# would invalidate any other live offer on it, which is the very effect being measured.
step_spike_s5()  { (cd "$ROOT/harness" && S5_WAITS=60,600,1800 S5_SHORT_TTL=90 npx tsx src/g2/spike-s5.ts); }
step_spike_s6()  { (cd "$ROOT/harness" && npx tsx src/g2/spike-s6.ts); }

step_record_artifacts() {
  local out="$EVID/ARTIFACTS.md" c v
  {
    echo "# G2 build artifacts — \`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\`"
    echo
    echo "00006-unbalanced-zswap, Plan 02. Compiled by the pinned image \`${IMAGE}\` (archive pinned by"
    echo "SHA-256 in \`docker/compactc.Dockerfile\`)."
    echo
    echo "Recorded (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "Compiler: compactc $(docker run --rm "$IMAGE" compactc --version | tr -d '[:space:]')"
    echo "Language: $(docker run --rm "$IMAGE" compactc --language-version | tr -d '[:space:]')"
    echo
    echo "## Source hashes"
    echo
    echo "| Source | SHA-256 | bytes | status in 00006 |"
    echo "|---|---|---|---|"
    printf '| `contracts/minter.compact` | `%s` | %s | REUSED UNCHANGED (00004) |\n' \
      "$(shasum -a 256 "$ROOT/contracts/minter.compact" | cut -d' ' -f1)" \
      "$(wc -c < "$ROOT/contracts/minter.compact" | tr -d ' ')"
    printf '| `contracts/manager.compact` | `%s` | %s | **v4 — v3 plus two swap circuits** |\n' \
      "$(shasum -a 256 "$ROOT/contracts/manager.compact" | cut -d' ' -f1)" \
      "$(wc -c < "$ROOT/contracts/manager.compact" | tr -d ' ')"
    printf '| `contracts/minter-collide.compact` | `%s` | %s | REUSED UNCHANGED (00005 P-COLL fixture) |\n' \
      "$(shasum -a 256 "$ROOT/contracts/minter-collide.compact" | cut -d' ' -f1)" \
      "$(wc -c < "$ROOT/contracts/minter-collide.compact" | tr -d ' ')"
    echo
    echo "Only the Manager changed. Proven mechanically against the base commit:"
    echo
    for c in minter minter-collide; do
      if git -C "$ROOT" diff --quiet "$LANE_BASE_COMMIT" -- "contracts/${c}.compact"; then
        echo "    contracts/${c}.compact — BYTE-IDENTICAL to ${LANE_BASE_COMMIT:0:7}"
      else
        echo "    contracts/${c}.compact — **DIFFERS** from ${LANE_BASE_COMMIT:0:7}"
      fi
    done
    if git -C "$ROOT" diff --quiet "$LANE_BASE_COMMIT" -- contracts/manager.compact; then
      echo "    contracts/manager.compact — unchanged (unexpected: v4 should differ)"
    else
      echo "    contracts/manager.compact — DIFFERS from ${LANE_BASE_COMMIT:0:7}, as v4 must"
    fi
    echo
    for c in minter manager minter-collide; do
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
cs=d.get('circuits',[])
print(f"- circuits ({len(cs)}): {', '.join('`'+x['name']+'`' for x in cs)}")
PY
      echo
      echo "| Artifact | SHA-256 | bytes |"
      echo "|---|---|---|"
      printf '| `contract/index.js` | `%s` | %s |\n' \
        "$(shasum -a 256 "$ROOT/harness/generated-zk/${c}/contract/index.js" | cut -d' ' -f1)" \
        "$(wc -c < "$ROOT/harness/generated-zk/${c}/contract/index.js" | tr -d ' ')"
      for v in "$ROOT/harness/generated-zk/${c}/keys/"*.verifier; do
        [ -e "$v" ] || continue
        printf '| `keys/%s` | `%s` | %s |\n' \
          "$(basename "$v")" \
          "$(shasum -a 256 "$v" | cut -d' ' -f1)" \
          "$(wc -c < "$v" | tr -d ' ')"
      done
      echo
    done
    echo "### The ONE circuit 00006 adds, and the two that cost nothing"
    echo
    echo "\`openSwapShielded\` has a verifier key above and carries BOTH FR-308 shapes, selected by its"
    echo "\`recipientA: Maybe<...>\` argument. That is finding **F-307**, a measured constraint rather than"
    echo "a preference: a bracket of probe contracts deployed live on this lane puts the deploy ceiling"
    echo "between 13 provable circuits (30,070 \`bytesWritten\`, 60.1% of the 50,000 per-block ceiling —"
    echo "DEPLOYS) and 14 (32,356, 64.7% — REFUSED with \"Transaction would exhaust the block limits\")."
    echo "Manager v3 already had 12, so v4's budget is exactly one new circuit."
    echo
    echo "\`zswapNullifierOf\` and \`zswapCommitmentOf\` have NO verifier key, and that is expected: they read no"
    echo "ledger state, so the compiler emits no proving key for them — the same reason \`shieldedKey\`"
    echo "and \`unshieldedKey\` have none. They exist so the swap circuits' transcription of the standard"
    echo "library's PRIVATE \`coinNullifier\` / \`coinCommitment\` can be TESTED for equality against the"
    echo "values the stdlib itself claims, instead of being trusted."
    echo
    echo "### F-201 verifier-key discipline"
    echo
    echo "Checked by \`scripts/g2/compile.sh --zk\`; see \`0*-compile-zk.out\`. A verifier key shared"
    echo "between contracts whose PROVER keys differ is FATAL. Shared-with-identical-prover-key is an"
    echo "expected observation (the MinterCollide mirror)."
  } > "$out"
  echo "wrote $out"
  grep -c '^| `' "$out" | sed 's/^/artifact rows: /'
}

step_record_spikes() {
  local out="$SPIKE_EVID/SPIKES.md" open="$SPIKE_EVID/OPENNESS.md" f s4 s4b s5 s6 openness
  mkdir -p "$SPIKE_EVID"
  s4="$(spike_verdict S4)"; s4b="$(spike_verdict S4b)"; s5="$(spike_verdict S5)"; s6="$(spike_verdict S6)"

  case "$s4:$s4b" in
    GREEN:*) openness="GREEN — via the FLOATING-SURPLUS shape (FR-308 v2a)" ;;
    *:GREEN) openness="GREEN — via the BEARER-KEY shape (FR-308 v2b)" ;;
    *) openness="RED" ;;
  esac

  {
    echo "# Plan 02 Phase 3 — spike results index"
    echo
    echo "\`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\` · recorded $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "· compose project \`${PROJECT}\` (disposable, this run only)"
    echo
    echo "| Spike | Question | Evidence | Verdict |"
    echo "|---|---|---|---|"
    for f in s4 s4b s5 s6; do
      if [ -f "$SPIKE_EVID/${f}.json" ]; then
        printf '| %s | %s | `%s.json` | %s |\n' \
          "$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['spike'])" "$SPIKE_EVID/${f}.json")" \
          "$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(str(d.get('question','—')).replace('|','/'))" "$SPIKE_EVID/${f}.json")" \
          "${f}" \
          "$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('verdict','(none)'))" "$SPIKE_EVID/${f}.json")"
      else
        printf '| %s | — | `%s.json` | NOT RUN |\n' "${f}" "${f}"
      fi
    done
    echo
    echo "Human-readable write-ups: \`S4.md\`, \`S4b.md\`, \`S5.md\`, \`S6.md\` in this directory."
    echo
    echo "## FR-308 openness: **${openness}**"
    echo
    echo "See \`OPENNESS.md\`. The two halves of FR-308 are reported SEPARATELY and are never conflated:"
    echo "v1 (named taker) working says nothing about whether an arbitrary holder can take an offer."
    echo
    if [ -d "$SPIKE_EVID/void" ]; then
      echo "## VOIDed attempts (infrastructure, not results)"
      echo
      for f in "$SPIKE_EVID"/void/*/VOID.md; do
        [ -e "$f" ] || continue
        echo "- \`${f#"$ROOT/"}\`"
      done
      echo
      echo "Each is an attempt whose failure matched an infrastructure signature on this shared host."
      echo "No conclusion is drawn from any of them; the retry that followed is the measurement."
      echo
    else
      echo "## VOIDed attempts"
      echo
      echo "None — every spike measured on its first attempt."
      echo
    fi
    echo "Raw offer artifacts (\`offers/*.offer\`) are DELIBERATELY not committed: they are generated"
    echo "proof-carrying transactions, and the workspace rule forbids committing generated artifacts."
    echo "Their byte counts and SHA-256 content addresses are recorded in the JSON files, which is what"
    echo "the FR-306 claims actually rest on."
  } > "$out"

  {
    echo "# FR-308 OPENNESS — the owner-REQUIRED outcome"
    echo
    echo "\`EXPERIMENTAL_LANE\` / \`LANE-DEV-1\` · recorded $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo "## VERDICT: ${openness}"
    echo
    echo "Owner Q1, 2026-08-19, verbatim: \"lets take the the recommended, but we need a way to make this"
    echo "zswap useful in real cases - so that it can be used somehow by any user that has access to it.\""
    echo "FR-308 encodes that as a REQUIRED outcome with two shapes, attempted in order."
    echo
    echo "| Shape | Spike | Verdict |"
    echo "|---|---|---|"
    echo "| v2(a) floating surplus — A released with NO output, swept by the taker's own balancer | S4 | ${s4} |"
    if [ -f "$SPIKE_EVID/s4b.json" ]; then
      echo "| v2(b) bearer key — A paid to a throwaway key whose secret ships in the envelope | S4b | ${s4b} |"
    else
      echo "| v2(b) bearer key — A paid to a throwaway key whose secret ships in the envelope | S4b | NOT RUN |"
    fi
    echo
    if [ "$openness" = "RED" ]; then
      echo "### Openness is RED. Read this before quoting any v1 result."
      echo
      echo "Both open shapes were refused with verbatim evidence, so **the project's openness goal is"
      echo "incomplete**. FR-308 and SC-305 are explicit that reporting the v1 named-taker result as if it"
      echo "satisfied the requirement, or silently downgrading the goal to v1-only, is itself a reporting"
      echo "failure. The v1 mechanics are unaffected by this and remain valid on their own terms — they"
      echo "are simply a different, weaker claim: a swap with a counterparty the maker already knows."
      echo
      echo "Per the owner's unattended-window directive (2026-08-19), this RED does **not** halt the"
      echo "pipeline. Plan 03 proceeds with step-ledger rows 7-8 in the spec's recorded-refusal form and"
      echo "the owner reviews this record at the end of the window."
    else
      echo "### Openness is GREEN, and here is exactly what that does and does not mean."
      echo
      echo "A holder whose keys the maker never knew settled a live offer built from contract custody."
      echo "That is the requirement. It does NOT mean both shapes work, and it does not make the two"
      echo "shapes interchangeable — see the per-spike write-ups for what each one actually costs. In"
      echo "particular the bearer shape achieves openness by PUBLISHING A SECRET, which leaves a"
      echo "post-settlement race for the payout among everyone who read the envelope; the surplus shape"
      echo "has no such window because the surplus is swept inside the settling transaction itself."
    fi
    echo
    echo "Details: \`S4.md\`, \`S4b.md\` (if run), and the JSON files beside them."
  } > "$open"

  echo "wrote $out and $open"
  echo "OPENNESS: ${openness}"
  cat "$out"
}

echo "[${GATE}] EXPERIMENTAL_LANE / LANE-DEV-1 — 00006 Manager v4 + offer envelope kit, mode=${MODE}"
echo "[${GATE}] compose project: ${PROJECT}"
fs_run 01-w1-docker-config step_w1
fs_run 02-probe-ports      step_probe_ports
fs_run 03-lane-reuse       step_lane_reuse
fs_run 04-lane-dev-1       step_lane_dev_1
fs_run 05-compile-fast     step_compile_fast
fs_run 06-install          step_install
fs_run 07-unit-suites      step_unit_suites
fs_run 08-typecheck        step_typecheck
fs_run 09-compile-zk       step_compile_zk

if [ "$MODE" = "offline" ]; then
  echo "[${GATE}] --offline: Phases 1-2 complete (circuits compile, 115 unit assertions green, no new"
  echo "[${GATE}] type errors, F-201 clean). The live spikes need a stack; run without --offline."
  exit 0
fi

fs_run 10-pull   step_pull
fs_run 11-boot   step_boot
fs_run 12-health step_health
fs_run 13-loadgate step_loadgate

run_spike 14-spike-s4 S4 step_spike_s4

# Plan 02 Phase 3: "S4b runs only if S4 is refuted". Kept conditional deliberately — openness is GREEN
# if EITHER shape settles, so once the surplus shape works the fallback answers no open question, and
# running it anyway would spend a shared host's proof server to no end. The decision is RECORDED either
# way, so "S4b: NOT RUN" is never ambiguous.
S4_VERDICT="$(spike_verdict S4)"
echo "[${GATE}] S4 verdict: ${S4_VERDICT}"
if [ "$S4_VERDICT" = "GREEN" ]; then
  echo "[${GATE}] S4 is GREEN, so the bearer-key fallback is NOT needed (FR-308: openness is GREEN if"
  echo "[${GATE}] EITHER shape settles). Skipping S4b, per Plan 02 Phase 3."
  {
    echo "# S4b — NOT RUN"
    echo
    echo "Recorded (UTC): $(fs_utc)"
    echo
    echo "S4 (floating surplus) was **GREEN**, and FR-308 makes openness GREEN if EITHER open shape"
    echo "settles for a holder whose keys the maker never knew. Plan 02 Phase 3 therefore schedules the"
    echo "bearer-key fallback to run ONLY if S4 is refuted, and it was not."
    echo
    echo "This is a scheduling decision, not a result: nothing here says the bearer shape would fail."
    echo "It remains implemented (\`harness/src/g2/spike-s4b.ts\`, \`shape: 'bearer-key'\` in the offer"
    echo "builder) and can be run on demand."
  } > "$SPIKE_EVID/S4b.md"
else
  echo "[${GATE}] S4 was ${S4_VERDICT}, so the FR-308 ladder falls through to the bearer-key fallback."
  run_spike 15-spike-s4b S4b step_spike_s4b
fi

run_spike 16-spike-s5 S5 step_spike_s5
run_spike 17-spike-s6 S6 step_spike_s6

fs_run 18-record-artifacts step_record_artifacts
fs_run 19-record-spikes    step_record_spikes

S4_FINAL="$(spike_verdict S4)"; S4B_FINAL="$(spike_verdict S4b)"
if [ "$S4_FINAL" != "GREEN" ] && [ "$S4B_FINAL" != "GREEN" ]; then
  echo ""
  echo "################################################################################"
  echo "#  FR-308 OPENNESS IS **RED**.                                                 #"
  echo "#  Both open shapes were refused: S4=${S4_FINAL}, S4b=${S4B_FINAL}."
  echo "#  The owner-REQUIRED outcome is INCOMPLETE. The v1 named-taker result is a     #"
  echo "#  DIFFERENT, WEAKER claim and must never be reported as satisfying it.         #"
  echo "#  Recorded in evidence/g2-spikes/OPENNESS.md. Per the owner's unattended-      #"
  echo "#  window directive this does NOT halt the pipeline; Plan 03 runs rows 7-8 in   #"
  echo "#  the spec's recorded-refusal form.                                            #"
  echo "################################################################################"
  echo ""
fi
if [ "$VOID_RUNS" -gt 0 ]; then
  echo "[${GATE}] ${VOID_RUNS} attempt(s) were VOIDed for infrastructure reasons; see evidence/g2-spikes/void/"
fi

echo "[${GATE}] all steps passed; teardown runs next and must also succeed"
