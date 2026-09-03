#!/usr/bin/env bash
#
# check-artifact.sh — THE ARTIFACT GATE: prove the compiled Manager is the same artifact.
#
# WHAT IT DOES
#   Compiles `contracts/manager.compact` with the pinned toolchain, measures every proof-bearing
#   circuit with `scripts/measure-k.sh`, reads the generated surface out of `contract-info.json` and
#   `index.d.ts`, and compares ALL of it against the committed baseline
#   `tests/fixtures/00014-artifact-baseline.json`:
#
#     • per-circuit `k` and constraint ROW COUNT, exact, for the nine proof-bearing circuits
#     • the sorted `name:pure:proof` circuit list (19 entries today: 9 proof, 9 pure, 1 neither)
#     • the set of emitted `.zkir` files — "nine keys, no more", checked as files and not inferred
#     • the `Ledger` type's field names, the `Witnesses` keys, the exported struct names
#
#   Any difference is a non-zero exit with a readable diff.
#
# WHY IT EXISTS (project 00014, FR-016)
#   The modular split must change nothing observable. Row counts decide proving-key size — `execute`
#   at k=19 loads, at k=20 it does NOT (see scripts/measure-k.sh) — and the generated names are the
#   public surface every off-chain consumer binds to. Both are invisible to the test tier, so they
#   get their own gate, and it runs BEFORE any code moves so the numbers it pins are the pre-split
#   ones.
#
# TOOLCHAIN
#   Same pin and same override as `scripts/compile.sh`, because it comes from the same place:
#   `scripts/toolchain.sh`, whose `ensure_image` obtains the compiler and verifies its version,
#   language version and both binary hashes before anything is measured. Set `COMPACTC_IMAGE=<ref>`
#   to point at another build. The baseline RECORDS the compiler version, the language version and
#   the Docker image ID it was produced with, and the compare mode prints both sides when they
#   differ — a toolchain bump then shows up as a visible provenance note next to numbers that
#   either did or did not move, instead of as a silent re-baseline.
#
# usage:
#   scripts/check-artifact.sh                      compile, measure all nine, compare (the gate)
#   scripts/check-artifact.sh --circuits execute   compare the surface plus one circuit's numbers
#   scripts/check-artifact.sh --skip-compile       reuse tests/generated/manager as it stands
#   scripts/check-artifact.sh --write-baseline     REWRITE the baseline from this compile+measure
#
# `--write-baseline` is how the baseline is re-recorded after an intentional toolchain change. It
# never runs by accident: the gate itself is the no-argument form.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$repo_root/tests/generated/manager"
baseline_file="$repo_root/tests/fixtures/00014-artifact-baseline.json"

# The pinned toolchain, byte-for-byte the one `scripts/compile.sh` uses: same file, same defaults.
# shellcheck source=scripts/toolchain.sh
. "$repo_root/scripts/toolchain.sh"
export COMPACTC_IMAGE

# The nine circuits that emit a proving key. Kept as data rather than derived from the artifact on
# purpose: if the artifact ever emits a tenth, the zkir-set comparison must FAIL, not silently grow.
ALL_CIRCUITS=(execute depositShielded depositUnshielded isRegistered accountRecord
  shieldedAccountBalance unshieldedAccountBalance poolValue poolHasColour)

mode="compare"
skip_compile=0
circuits=("${ALL_CIRCUITS[@]}")

while [ "$#" -gt 0 ]; do
  case "$1" in
    --write-baseline) mode="write"; shift ;;
    --skip-compile)   skip_compile=1; shift ;;
    --circuits)       IFS=',' read -r -a circuits <<< "${2:?--circuits needs a comma-separated list}"; shift 2 ;;
    -h|--help)        sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)                echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done

log() { printf '%s\n' "$*"; }

log "=== check-artifact ==="
log "MODE=$mode"
# Obtain and verify the toolchain up front, so `--skip-compile` (which never reaches compile.sh)
# still records a real, checked image ID in the provenance block rather than "unknown".
ensure_image
image_id="$(docker image inspect "$COMPACTC_IMAGE" --format '{{.Id}}' 2>/dev/null || echo 'unknown')"

if [ "$skip_compile" -eq 0 ]; then
  bash "$repo_root/scripts/compile.sh" manager
else
  log "--skip-compile: reusing $out_dir"
fi

test -f "$out_dir/compiler/contract-info.json" || { echo "no contract-info.json in $out_dir" >&2; exit 66; }
test -f "$out_dir/contract/index.d.ts"        || { echo "no index.d.ts in $out_dir" >&2; exit 66; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# --- measure ---------------------------------------------------------------------------------------
: > "$work/measured.txt"
for circuit in "${circuits[@]}"; do
  log "--- measuring $circuit"
  # `zkir-v3` prints the "Mock compiling circuit …(k=…, rows=…)" line on STDERR, so both streams
  # are captured; measure-k.sh's own exit code still propagates through `set -e`.
  measured="$(bash "$repo_root/scripts/measure-k.sh" "$circuit" manager 2>&1)"
  line="$(printf '%s\n' "$measured" | grep -E 'Mock compiling circuit' || true)"
  k="$(printf '%s' "$line" | sed -n 's/.*(k=\([0-9]*\), rows=\([0-9]*\)).*/\1/p')"
  rows="$(printf '%s' "$line" | sed -n 's/.*(k=\([0-9]*\), rows=\([0-9]*\)).*/\2/p')"
  [ -n "$k" ] && [ -n "$rows" ] || { echo "could not parse k/rows for $circuit from: $line" >&2; exit 65; }
  log "$circuit k=$k rows=$rows"
  printf '%s %s %s\n' "$circuit" "$k" "$rows" >> "$work/measured.txt"
done

# The throwaway `.bzkir` each measurement drops beside its input is not part of the artifact.
find "$out_dir/zkir" -name '*.bzkir' -delete 2>/dev/null || true

# --- compare (or write) ------------------------------------------------------------------------------
# python3 does the JSON work: it is present on this project's macOS hosts and on the arm64 GitHub
# runner CI uses, and it keeps the comparison readable instead of a wall of `jq`.
MEASURED_FILE="$work/measured.txt" \
OUT_DIR="$out_dir" \
BASELINE_FILE="$baseline_file" \
IMAGE_REF="$COMPACTC_IMAGE" \
IMAGE_ID="$image_id" \
MODE="$mode" \
PARTIAL="$([ "${#circuits[@]}" -eq "${#ALL_CIRCUITS[@]}" ] && echo 0 || echo 1)" \
python3 - <<'PY'
import json, os, re, sys, datetime

out_dir = os.environ["OUT_DIR"]
baseline_file = os.environ["BASELINE_FILE"]
mode = os.environ["MODE"]
partial = os.environ["PARTIAL"] == "1"

info = json.load(open(os.path.join(out_dir, "compiler", "contract-info.json")))
dts = open(os.path.join(out_dir, "contract", "index.d.ts")).read()

# --- the compiler's own circuit list, with the flags that decide key emission -----------------------
# `proof` is the flag that matters: `myAccount` is impure AND keyless, so "not pure" would over-count.
circuit_list = sorted(
    f"{c['name']}:{str(c['pure']).lower()}:{str(c['proof']).lower()}" for c in info["circuits"]
)
zkir_dir = os.path.join(out_dir, "zkir")
zkir = sorted(f[:-5] for f in os.listdir(zkir_dir) if f.endswith(".zkir"))

# --- the generated TypeScript surface ---------------------------------------------------------------
def block(header_re):
    """The lines of one `export type X … = {` block, up to its closing brace at column 0."""
    m = re.search(header_re, dts)
    if not m:
        return []
    lines = dts[m.end():].split("\n")
    body = []
    for line in lines:
        if line.startswith("}"):
            break
        body.append(line)
    return body

ledger_fields = [
    m.group(1)
    for m in (re.match(r"^  (?:readonly )?([A-Za-z_]\w*)\s*:", ln) for ln in block(r"export type Ledger = \{"))
    if m
]
witnesses = [
    m.group(1)
    for m in (re.match(r"^  ([A-Za-z_]\w*)\s*\(", ln) for ln in block(r"export type Witnesses<PS> = \{"))
    if m
]
GENERATED_TYPES = {
    "Witnesses", "ImpureCircuits", "ProvableCircuits", "PureCircuits", "Circuits", "Ledger",
    "ContractReferenceLocations",
}
structs = sorted(
    name
    for name in re.findall(r"^export type (\w+) = \{", dts, re.M)
    if name not in GENERATED_TYPES
)

measured = {}
for line in open(os.environ["MEASURED_FILE"]):
    name, k, rows = line.split()
    measured[name] = {"k": int(k), "rows": int(rows)}

observed = {
    "circuits": measured,
    "circuitList": circuit_list,
    "zkirCircuits": zkir,
    "ledgerFields": ledger_fields,
    "witnesses": witnesses,
    "structs": structs,
}
provenance = {
    "compilerVersion": info.get("compiler-version"),
    "languageVersion": info.get("language-version"),
    "runtimeVersion": info.get("runtime-version"),
    "toolchainImage": os.environ["IMAGE_REF"],
    "toolchainImageId": os.environ["IMAGE_ID"],
}

if mode == "write":
    if partial:
        print("REFUSING to write a baseline from a partial measurement (drop --circuits)", file=sys.stderr)
        sys.exit(64)
    doc = {
        "note": (
            "Frozen pre-split artifact of contracts/manager.compact (project 00014, FR-016). "
            "Compared by scripts/check-artifact.sh; rewrite with scripts/check-artifact.sh "
            "--write-baseline after an INTENTIONAL toolchain or surface change, never to make a "
            "red gate green."
        ),
        "recordedAt": datetime.date.today().isoformat(),
        "provenance": provenance,
        **observed,
    }
    with open(baseline_file, "w") as fh:
        json.dump(doc, fh, indent=2)
        fh.write("\n")
    print(f"WROTE {baseline_file}")
    print(f"  {len(measured)} measured circuits, {len(circuit_list)} circuits, {len(zkir)} zkir files")
    sys.exit(0)

baseline = json.load(open(baseline_file))
base_prov = baseline.get("provenance", {})
print("--- provenance")
drift = [k for k in provenance if base_prov.get(k) != provenance[k]]
for k in ("compilerVersion", "languageVersion", "runtimeVersion", "toolchainImage", "toolchainImageId"):
    mark = "!=" if k in drift else "=="
    print(f"  {k:18} baseline {base_prov.get(k)!r} {mark} observed {provenance[k]!r}")
if drift:
    print("  NOTE: the artifact was produced with a different toolchain than the baseline was.")
    print("  The numbers below are still compared exactly; a bump that changes them is a REAL failure,")
    print("  and a deliberate bump is re-recorded with --write-baseline.")

failures = []

print("--- circuits (k, rows)")
for name in sorted(measured):
    want = baseline["circuits"].get(name)
    got = measured[name]
    if want is None:
        failures.append(f"circuit {name} is not in the baseline")
        print(f"  {name:26} MISSING FROM BASELINE (got k={got['k']} rows={got['rows']})")
        continue
    ok = want["k"] == got["k"] and want["rows"] == got["rows"]
    print(
        f"  {name:26} baseline k={want['k']} rows={want['rows']}"
        f"  {'==' if ok else '!='}  observed k={got['k']} rows={got['rows']}"
    )
    if not ok:
        failures.append(
            f"{name}: baseline k={want['k']} rows={want['rows']}, observed k={got['k']} rows={got['rows']}"
        )
if partial:
    unmeasured = sorted(set(baseline["circuits"]) - set(measured))
    print(f"  (partial run: {len(unmeasured)} circuit(s) not measured: {', '.join(unmeasured)})")
else:
    missing = sorted(set(baseline["circuits"]) - set(measured))
    if missing:
        failures.append(f"baseline circuits never measured: {', '.join(missing)}")

for key, label in (
    ("circuitList", "circuit list (name:pure:proof)"),
    ("zkirCircuits", "emitted .zkir circuits"),
    ("ledgerFields", "Ledger field names"),
    ("witnesses", "Witnesses keys"),
    ("structs", "exported struct names"),
):
    want, got = baseline[key], observed[key]
    print(f"--- {label}")
    if want == got:
        print(f"  {len(got)} entries, identical")
        continue
    only_baseline = [x for x in want if x not in got]
    only_observed = [x for x in got if x not in want]
    for x in only_baseline:
        print(f"  - {x}      (in the baseline, NOT in this artifact)")
    for x in only_observed:
        print(f"  + {x}      (in this artifact, NOT in the baseline)")
    if not only_baseline and not only_observed:
        print(f"  ORDER CHANGED (the names are identical, the sequence is not)")
        print(f"    baseline {want}")
        print(f"    observed {got}")
        if key == "ledgerFields":
            print("    Ledger order is the on-chain SLOT order: the generated accessors index the")
            print("    state array by position, so a reordering relocates existing state. Treat this")
            print("    as a state-layout change, not cosmetics.")
    failures.append(f"{label} differs from the baseline")

print("---")
if failures:
    print(f"ARTIFACT GATE FAILED ({len(failures)} difference(s)):")
    for f in failures:
        print(f"  * {f}")
    sys.exit(1)
print(f"ARTIFACT GATE OK — {len(measured)} circuit(s) measured, surface identical")
PY
