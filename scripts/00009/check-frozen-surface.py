#!/usr/bin/env python3
"""FR-907 check: every frozen-byte-producing circuit must be VERBATIM in a semantics-preserving arm.

The frozen surfaces are the EIP-712 type/domain/digest bytes and the FR-031 semantic commitment
bytes. Both are produced entirely by the circuits listed below, so if each of those circuits is
byte-identical between the product and the arm, and the arm feeds them the same values, then the
emitted bytes are identical by construction.

Usage: check-frozen-surface.py <arm> [<arm> ...]
Exit 0 if every named arm preserves every frozen circuit verbatim.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PRODUCT = ROOT / "contracts" / "manager.compact"
VARIANTS = ROOT / "contracts" / "variants"

FROZEN = [
    # byte codec
    "reverseBytes32", "reverseBytes16", "bytes32LexicographicLt",
    "uint64Word", "uint128Word", "uint8Word", "addressWord",
    # EIP-712 constants and hashing
    "accountTag", "domainType", "domainName", "domainVersion",
    "registerType", "withdrawShieldedType", "withdrawUnshieldedType",
    "transferShieldedType", "transferUnshieldedType", "openSwapType",
    "frozenTypeHash", "evmAccountIdFor", "evmDomainSeparatorFor",
    "evmStructHashFor", "eip712Digest", "evmDigestFor",
    # FR-031 semantic commitment
    "semanticTag", "callTranscriptTag", "nativeAuthTag", "entrypointHash",
    "semanticEventName", "nativeAuthResult", "actionUnionHash",
    "semanticCallTranscriptHash", "semanticCommitmentFromSlots",
    "semanticCommitmentCore", "semanticCommitmentFor",
]


def extract(src: str, name: str) -> str:
    """Return the full source text of `circuit <name>(...) { ... }`, braces balanced."""
    m = re.search(rf"^(?:export )?circuit {re.escape(name)}\b", src, re.M)
    if not m:
        raise KeyError(name)
    i = src.index("{", m.start())
    depth = 0
    for j in range(i, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                return src[m.start(): j + 1]
    raise ValueError(f"unbalanced braces in {name}")


def main(argv: list[str]) -> int:
    product = PRODUCT.read_text()
    reference = {n: extract(product, n) for n in FROZEN}

    failures = 0
    for arm in argv:
        path = VARIANTS / f"{arm}.compact"
        src = path.read_text()
        bad = []
        for name, body in reference.items():
            try:
                if extract(src, name) != body:
                    bad.append(f"{name}: MODIFIED")
            except KeyError:
                bad.append(f"{name}: MISSING")
        if bad:
            failures += 1
            print(f"{arm}: FROZEN SURFACE CHANGED ({len(bad)}/{len(reference)})")
            for b in bad:
                print(f"    {b}")
        else:
            print(f"{arm}: OK — all {len(reference)} frozen-byte circuits verbatim")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
