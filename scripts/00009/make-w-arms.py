#!/usr/bin/env python3
"""Generate the 00009 Phase 1 ablation arms (w1..w9) from the product Manager.

Each arm is the product source plus a conspicuous non-shipping header and exactly ONE
minimal stub. Every replacement is anchored on an exact unique substring of the product
source, so a drifted product source fails loudly instead of silently patching the wrong text.

MEASUREMENT-ONLY. These sources exist to attribute circuit rows. None may ever ship.
"""
import hashlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PRODUCT = ROOT / "contracts" / "manager.compact"
VARIANTS = ROOT / "contracts" / "variants"
PRODUCT_SHA = "85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858"


def header(arm: str, what: str) -> str:
    return (
        f"// 00009 MEASUREMENT-ONLY ABLATION ARM `{arm}` — NOT A SHIPPING CONTRACT.\n"
        f"//\n"
        f"// This source is DELIBERATELY BROKEN. It exists only so that\n"
        f"//   weight(component) = rows(w0-baseline) - rows(this arm)\n"
        f"// can be measured with `compactc --skip-zk` + `zkir-v3 mock-compile`.\n"
        f"// Ablated component: {what}\n"
        f"// It must never ship, never be promoted into contracts/manager.compact, never be\n"
        f"// proved, and never be deployed.\n"
        f"//\n"
    )


# arm -> (ablated-component description, [(anchor, replacement), ...])
ARMS = {
    "w1-ecdsa-noop": (
        "secp256k1 ECDSA signature verification AND Ethereum address recovery",
        [(
            "  const signatureOk = disclose(secp256k1EcdsaVerify(digest, sig, pk));\n"
            "  const signer = disclose(secp256k1EthereumAddress(pk));\n",
            "  // 00009 w1 ABLATION: remove BOTH secp256k1 operations (verify + address recovery).\n"
            "  // The stubbed values keep every downstream assert satisfiable, so the only constraints\n"
            "  // that disappear are the secp256k1 ones (and the keccak<64> inside address recovery).\n"
            "  const signatureOk = true;\n"
            "  const signer = p.owner;\n",
        )],
    ),
    "w2-semantic-noop": (
        "the FR-031 semantic commitment emission (keccak<1024> + keccak<256> + keccak<384>)",
        [(
            "  const commitment = disclose(semanticCommitmentCore(manager, deploymentDomain, p, account, authResult));\n"
            "  // `Misc.payload` is fixed at Bytes<256>. Put the authoritative commitment first; every committed\n"
            "  // field is recovered from the proved execute transcript and recomputed before this value is\n"
            "  // accepted. The pinned simulator currently exposes only the first 192 bytes of the 288-byte raw\n"
            "  // event cell, so readers deliberately support its degraded raw-prefix representation too.\n"
            "  const eventPayload: Bytes<256> = slice<256>([\n"
            "    ...commitment, ...default<Bytes<32>>, ...default<Bytes<32>>, ...default<Bytes<32>>,\n"
            "    ...default<Bytes<32>>, ...default<Bytes<32>>, ...default<Bytes<32>>, ...default<Bytes<32>>\n"
            "  ], 0) as Bytes<256>;\n"
            "  emit(Misc { name: semanticEventName(), payload: eventPayload });\n",
            "  // 00009 w2 ABLATION: emit nothing. The exported pure `semanticCommitmentFor` byte oracle is\n"
            "  // left untouched (it is a pure circuit and compiles to no ZKIR), so this removes exactly the\n"
            "  // semantic-commitment constraints that `execute` carries.\n"
            "  return;\n",
        )],
    ),
    "w3-eip712-noop": (
        "the whole EIP-712 hashing chain in `execute` (domain separator + struct hash + 0x1901 digest)",
        [(
            "  const digest = p.selector == 0\n"
            "    ? default<Bytes<32>>\n"
            "    : evmDigestFor(manager, deploymentDomain, p);\n",
            "  // 00009 w3 ABLATION: remove the EIP-712 chain from `execute` (domain separator, struct\n"
            "  // hash and the 0x1901 digest — 16 keccak-f permutations). The exported `evmDigestFor`\n"
            "  // oracle is left intact — it is pure and compiles to no ZKIR — so deleting only the call\n"
            "  // site is the minimal diff that attributes the in-`execute` hashing cost.\n"
            "  //\n"
            "  // The stand-in is `p.account` and NOT `default<Bytes<32>>`: a constant-zero digest is\n"
            "  // folded to `Uint<0..1>` and the pinned compiler then fails type-checking the stdlib\n"
            "  // secp256k1 scalar multiply (`incompatible arguments in call to mul; supplied\n"
            "  // (Uint<0..1>, Secp256k1Scalar)`). `p.account` is a runtime Bytes<32> that adds no\n"
            "  // constraints of its own, so the ablation still costs nothing to produce.\n"
            "  const digest = p.account;\n",
        )],
    ),
    "w4-custody-noop": (
        "the entire five-way custody dispatch (registration, auth, nonce and semantic emission kept)",
        [(
            "  if (!isRegistration) {\n"
            "    if (p.selector == 2) {\n"
            "      withdrawShielded(account, p.primaryColor, p.primaryAmount, shieldedRecipient(p.recipientKind, p.recipient));\n"
            "    } else if (p.selector == 3) {\n"
            "      withdrawUnshielded(account, p.primaryColor, p.primaryAmount, unshieldedRecipient(p.recipientKind, p.recipient));\n"
            "    } else if (p.selector == 4) {\n"
            "      transferInternalShielded(account, p.toAccount, p.primaryColor, p.primaryAmount);\n"
            "    } else if (p.selector == 5) {\n"
            "      transferInternalUnshielded(account, p.toAccount, p.primaryColor, p.primaryAmount);\n"
            "    } else {\n"
            "      openSwapShielded(\n"
            "        account,\n"
            "        p.primaryColor,\n"
            "        p.primaryAmount,\n"
            "        swapRecipient(p.recipientKind, p.recipient),\n"
            "        ShieldedCoinInfo{ nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount },\n"
            "        p.creditAccount\n"
            "      );\n"
            "    }\n"
            "  }\n",
            "  // 00009 w4 ABLATION: the whole custody dispatch is removed. Envelope validation, ECDSA,\n"
            "  // EIP-712, registration, the nonce write and the semantic emission all remain, so\n"
            "  // baseline - this arm is the TOTAL weight of custody.\n",
        )],
    ),
}

# The five single-leg arms share one shape: keep the branch, empty its body.
LEGS = {
    "w5-action-withdraw-shielded-noop": (
        "only the `withdrawShielded` custody leg (selector 2)",
        "      withdrawShielded(account, p.primaryColor, p.primaryAmount, shieldedRecipient(p.recipientKind, p.recipient));\n",
    ),
    "w6-action-withdraw-unshielded-noop": (
        "only the `withdrawUnshielded` custody leg (selector 3)",
        "      withdrawUnshielded(account, p.primaryColor, p.primaryAmount, unshieldedRecipient(p.recipientKind, p.recipient));\n",
    ),
    "w7-action-transfer-shielded-noop": (
        "only the `transferInternalShielded` custody leg (selector 4)",
        "      transferInternalShielded(account, p.toAccount, p.primaryColor, p.primaryAmount);\n",
    ),
    "w8-action-transfer-unshielded-noop": (
        "only the `transferInternalUnshielded` custody leg (selector 5)",
        "      transferInternalUnshielded(account, p.toAccount, p.primaryColor, p.primaryAmount);\n",
    ),
    "w9-action-openswap-noop": (
        "only the `openSwapShielded` custody leg (selector 6)",
        "      openSwapShielded(\n"
        "        account,\n"
        "        p.primaryColor,\n"
        "        p.primaryAmount,\n"
        "        swapRecipient(p.recipientKind, p.recipient),\n"
        "        ShieldedCoinInfo{ nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount },\n"
        "        p.creditAccount\n"
        "      );\n",
    ),
}

for arm, (what, call) in LEGS.items():
    tag = arm.split("-")[0]
    ARMS[arm] = (
        what,
        [(
            call,
            f"      // 00009 {tag} ABLATION: this custody leg is removed; the branch body is empty.\n"
            f"      // Every other leg, and the dispatch structure itself, is untouched, so\n"
            f"      // baseline - this arm is THIS leg's weight.\n",
        )],
    )


def main() -> int:
    src = PRODUCT.read_text()
    got = hashlib.sha256(src.encode()).hexdigest()
    if got != PRODUCT_SHA:
        print(f"product Manager drifted: {got} != {PRODUCT_SHA}", file=sys.stderr)
        return 2

    VARIANTS.mkdir(parents=True, exist_ok=True)
    lines = src.split("\n")
    if not lines[0].startswith("// Manager v4"):
        print("unexpected product header", file=sys.stderr)
        return 2

    for arm, (what, edits) in sorted(ARMS.items()):
        out = src
        for anchor, replacement in edits:
            if out.count(anchor) != 1:
                print(f"{arm}: anchor is not unique ({out.count(anchor)} matches)", file=sys.stderr)
                return 3
            out = out.replace(anchor, replacement)
        # Conspicuous header immediately after the product's first line.
        head, rest = out.split("\n", 1)
        out = head + "\n" + header(arm, what) + rest
        path = VARIANTS / f"{arm}.compact"
        path.write_text(out)
        print(f"{arm} {hashlib.sha256(out.encode()).hexdigest()} {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
