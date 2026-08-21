#!/usr/bin/env bash
# Compile both Compact contracts inside the pinned compiler image.
#
#   --skip-zk (default)   fast: TypeScript + ZKIR only, for simulator/unit suites
#   --zk                  full: also produces prover/verifier keys, needed to deploy in G3
#
# LANE-DEV-1: the image carries `compactc-v0.33.0` (released form of the pinned but unpublished
# `compactc-v0.33.0-rc.2`), pinned by SHA-256 — see docker/compactc.Dockerfile.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib/compactc.sh
source "$ROOT/scripts/lib/compactc.sh"

IMAGE="$COMPACTC_IMAGE"
MODE="${1:---skip-zk}"

# The three contracts 00005 builds. `minter` is 00004's, reused UNCHANGED; `manager` is v3
# (fully open); `minter-collide` is the P-COLL fixture whose two family colours are identical.
CONTRACTS=(minter manager minter-collide)

# Output lands INSIDE the harness package on purpose: the generated modules `import
# '@midnight-ntwrk/compact-runtime'`, and Node resolves both module type and node_modules from the
# nearest package.json. A sibling build/ dir would resolve to the clone root, which has neither.
if [ "$MODE" = "--zk" ]; then
  OUT="harness/generated-zk"; FLAGS=()
else
  OUT="harness/generated"; FLAGS=(--skip-zk)
fi

# Build the compiler image if it is not present (idempotent; content-pinned by SHA-256).
compactc_ensure_image "$ROOT"

for c in "${CONTRACTS[@]}"; do
  echo "compiling ${c} (${MODE}) -> ${OUT}/${c}"
  rm -rf "${OUT:?}/${c}"
  mkdir -p "${OUT}/${c}"
  # `${FLAGS[@]+...}` guard: under `set -u`, bash 3.2 (the macOS default) treats expanding an
  # empty array as an unbound variable, which is exactly the --zk case.
  docker run --rm -v "$PWD:/work" "$IMAGE" \
    compactc ${FLAGS[@]+"${FLAGS[@]}"} "contracts/${c}.compact" "${OUT}/${c}"
done

# harness/package.json already declares "type": "module", which these subdirectories inherit.

# CIRCUIT-NAME OVERLAP REPORT.
#
# 00004 kept a flattened `_combined` copy of both contracts' artifacts purely as a build-time
# assertion that no circuit NAME appeared in two contracts. 00005 cannot keep that assertion and
# should not want to: `minter-collide` deliberately mirrors `minter`'s API (`mintShieldedTo`,
# `mintUnshieldedTo`, `shieldedColor`, `unshieldedColor`) so the P-COLL probe can be driven by the
# same harness code paths as an ordinary Minter. Shared names were never a proving hazard anyway —
# a transaction spanning two contracts is proved through a `ZKConfigRegistry` over the PER-CONTRACT
# artifact directories, and each call's key location embeds the hash of its DEPLOYED verifier key,
# so resolution joins on that hash and never on the circuit name.
#
# What replaces the assertion is evidence PLUS a sharper assertion. FINDING F-201, discovered by
# this very report on 00005's first ZK build: a verifier key identifies the CIRCUIT SHAPE, not the
# contract. `minter.shieldedColor` and `minter-collide.shieldedColor` compile to BYTE-IDENTICAL
# prover AND verifier keys, because both are the same circuit body reading the same ledger-field
# index — and so do `mintShieldedTo` in both contracts. `ZKConfigRegistry` therefore has two sources
# matching one key hash for those circuits, which is harmless precisely because the artifacts are
# identical: whichever source it picks, the bytes it hands to the prover are the same.
#
# So the check below is the one that would actually matter: two contracts sharing a VERIFIER key
# while having DIFFERENT PROVER keys would mean resolution could pick a prover key that does not
# correspond to the circuit being proved. That is a FATAL condition. Identical-on-both is reported
# as an expected observation, not a failure.
if [ "$MODE" = "--zk" ]; then
  echo
  echo "-- verifier keys by contract (SHA-256; resolution is by key hash, not by circuit name)"
  for c in "${CONTRACTS[@]}"; do
    for f in "${OUT}/${c}/keys/"*.verifier; do
      [ -e "$f" ] || continue
      printf '   %-14s %-26s %s\n' "$c" "$(basename "$f" .verifier)" "$(shasum -a 256 "$f" | cut -d' ' -f1)"
    done
  done

  echo
  echo "-- circuit names exported by MORE THAN ONE contract (expected: the MinterCollide mirror)"
  for c in "${CONTRACTS[@]}"; do
    for f in "${OUT}/${c}/keys/"*.verifier; do
      [ -e "$f" ] || continue
      echo "$(basename "$f" .verifier) ${c}"
    done
  done | sort | awk '{ n[$1] = n[$1] " " $2; k[$1]++ } END { for (x in n) if (k[x] > 1) print "   " x ":" n[x] }' | sort

  echo
  echo "-- F-201: verifier keys SHARED between contracts (must share their prover key too)"
  python3 - "$OUT" "${CONTRACTS[@]}" <<'PY'
import hashlib, os, sys
out, contracts = sys.argv[1], sys.argv[2:]
def sha(p):
    with open(p, 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest()
by_vk = {}
for c in contracts:
    d = os.path.join(out, c, 'keys')
    if not os.path.isdir(d):
        continue
    for f in sorted(os.listdir(d)):
        if not f.endswith('.verifier'):
            continue
        name = f[: -len('.verifier')]
        vk = sha(os.path.join(d, f))
        pk_path = os.path.join(d, name + '.prover')
        pk = sha(pk_path) if os.path.exists(pk_path) else None
        by_vk.setdefault(vk, []).append((c, name, pk))
bad = []
shared = 0
for vk, entries in sorted(by_vk.items()):
    if len({c for c, _n, _p in entries}) < 2:
        continue
    shared += 1
    pks = {p for _c, _n, p in entries}
    label = ', '.join(f'{c}.{n}' for c, n, _p in entries)
    if len(pks) == 1:
        print(f'   {vk[:16]}…  {label}')
        print(f'      prover key IDENTICAL too ({next(iter(pks))[:16]}…) — same circuit, so '
              f'resolution by key hash is unambiguous in effect')
    else:
        print(f'   {vk[:16]}…  {label}')
        print(f'      **PROVER KEYS DIFFER**: {sorted(x[:16] for x in pks)}')
        bad.append(label)
if shared == 0:
    print('   (none)')
if bad:
    print('FATAL: a verifier key is shared between contracts whose PROVER keys differ; '
          'ZKConfigRegistry could resolve a call to the wrong prover key.', file=sys.stderr)
    for b in bad:
        print(f'  - {b}', file=sys.stderr)
    sys.exit(1)
PY
fi

echo "compiled: $(find "${OUT}" -name '*.zkir' | wc -l | tr -d ' ') zkir, $(find "${OUT}" -name '*.verifier' 2>/dev/null | wc -l | tr -d ' ') verifier keys"
