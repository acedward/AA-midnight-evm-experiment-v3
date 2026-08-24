#!/usr/bin/env python3
"""00009 Phase 4.4 — reconcile the d-arm measurements into a per-circuit row decomposition.

Reads every arm's `evidence/00009-circuit-weight/raw/<arm>.measure.log`, computes
    Δ(arm) = rows(w0-baseline) - rows(arm)
and assembles:

  * the DISJOINT decomposition of `execute` (every part measured by exactly one arm, no part
    counted twice), with the unattributed residual;
  * the NESTED splits inside the semantic and EIP-712 chains (d02 contains d01, d03 contains d02,
    d07 is the sum of d09..d12);
  * cross-checks of the d-arm sums against the Phase 1 w-arm deltas they refine.

MEASUREMENT-ONLY: this script only reads logs. It runs nothing.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "evidence" / "00009-circuit-weight" / "raw"
RE_RESULT = re.compile(r"\(k=(\d+), rows=(\d+)\)")
BASELINE = 974572


def rows(arm: str, circuit: str = "execute") -> int:
    name = f"{arm}.measure.log" if circuit == "execute" else f"{arm}.{circuit}.measure.log"
    log = RAW / name
    m = RE_RESULT.search(log.read_text())
    if not m:
        raise SystemExit(f"no (k=, rows=) result in {log}")
    return int(m.group(2))


def k(arm: str, circuit: str = "execute") -> int:
    name = f"{arm}.measure.log" if circuit == "execute" else f"{arm}.{circuit}.measure.log"
    m = RE_RESULT.search((RAW / name).read_text())
    return int(m.group(1))


def d(arm: str) -> int:
    return BASELINE - rows(arm)


# --- the disjoint partition of `execute` -------------------------------------------------------
# Each entry: (group, sub-component, arm, why). Every arm here removes a region no other arm in
# this list removes, so the deltas add.
DISJOINT = [
    ("envelope + auth", "`assertActionEnvelope` (envelope validation, all 7 selector shapes)",
     "d16-envelope-noop", "~60 equality/zero asserts on packed fields"),
    ("envelope + auth", "`ownerCommitment(localOwnerSecret())`", "d19-ownercommitment-noop",
     "1 witness read + 1 persistentCommit"),
    ("envelope + auth", "`authenticatedActionAccount` + `gatewayAccount`", "d18-auth-noop",
     "7 map member/lookup + 4 equality asserts"),
    ("envelope + auth", "`assertLiveDeadline`", "d17-deadline-noop",
     "1 subtraction + blockTimeGte + blockTimeLt"),
    ("envelope + auth", "`registerAccount` + `evmOwners.insert`", "d21-register-noop",
     "3 asserts + 3 ledger inserts"),
    ("envelope + auth", "checked nonce increment + `evmNonces.insert`", "d22-nonce-noop",
     "1 add + 1 assert + 1 mux + 1 insert"),
    ("EIP-712", "`evmAccountIdFor`", "d13-evm-accountid-noop",
     "4-word/128 B preimage + 1 addressWord + keccak(1 perm)"),
    ("EIP-712", "`evmDomainSeparatorFor`", "d06-eip712-domainsep-noop",
     "keccak(32 B) + slice<20> + addressWord + 5-word/160 B preimage + keccak(2 perms)"),
    ("EIP-712", "`evmStructHashFor` (all four branches)", "d07-eip712-structhash-noop",
     "39 words spliced across 4 branches + 4 addressWord + 7 uintNWord + keccak(12 perms)"),
    ("EIP-712", "`eip712Digest` (0x1901)", "d08-eip712-digest-noop",
     "2-word/66 B preimage + keccak(1 perm)"),
    ("secp256k1", "`secp256k1EcdsaVerify`", "d14-ecdsa-verify-noop", "1 guarded secp verify"),
    ("secp256k1", "`secp256k1EthereumAddress`", "d15-ecdsa-address-noop",
     "1 pubkey decode + keccak(1 perm) + slice<20>"),
    ("custody", "five-way custody dispatch (all legs)", "w4-custody-noop",
     "see the per-leg split below"),
    ("FR-031 semantic", "semantic commitment chain (incl. `nativeAuthResult`)", "w2-semantic-noop",
     "see the nested split below"),
]

# --- nested splits ------------------------------------------------------------------------------
SEMANTIC_NESTED = [
    ("`actionUnionHash`", "d01-semantic-union-noop", None,
     "12 variable words/384 B + addressWord + 4 uintNWord + keccak(3 perms)"),
    ("`semanticCallTranscriptHash` (own)", "d02-semantic-transcript-noop", "d01-semantic-union-noop",
     "6 variable + 2 constant words/256 B + 1 uint8Word + 6-way mux + keccak(2 perms)"),
    ("`semanticCommitmentFromSlots` (own)", "d03-semantic-final-noop", "d02-semantic-transcript-noop",
     "30 variable + 2 constant words/1024 B + 9 uintNWord + addressWord + keccak(8 perms)"),
    ("`Misc` event payload assembly", "d04-semantic-eventpayload-noop", None,
     "1 variable + 7 constant words/256 B, no hash"),
    ("`bytes32LexicographicLt` (open-swap slot ordering)", "d05-semantic-lexlt-noop", None,
     "4 x 16-byte endianness reversals"),
    ("`nativeAuthResult`", "d20-nativeauthresult-noop", None,
     "1 variable + 1 constant word/64 B + keccak(1 perm)"),
]

EIP712_BRANCHES = [
    ("selector 1 — register (192 B, 2 perms)", "d09-eip712-struct-sel1-noop",
     "6 words: 2 constant, 4 variable, 1 addressWord, 1 uint64Word"),
    ("selector 2/3 — withdraw (320 B, 3 perms)", "d10-eip712-struct-sel23-noop",
     "10 words: 1 muxed type hash, 1 addressWord, 2 uint64Word, 1 uint128Word, 1 uint8Word"),
    ("selector 4/5 — transfer (288 B, 3 perms)", "d11-eip712-struct-sel45-noop",
     "9 words: 1 muxed type hash, 1 addressWord, 2 uint64Word, 1 uint128Word"),
    ("selector 6 — open swap (448 B, 4 perms)", "d12-eip712-struct-sel6-noop",
     "14 words: 1 constant type hash, 1 addressWord, 2 uint64Word, 2 uint128Word, 1 uint8Word"),
]

CUSTODY_LEGS = [
    ("`openSwapShielded` (selector 6)", "w9-action-openswap-noop"),
    ("`withdrawShielded` (selector 2)", "w5-action-withdraw-shielded-noop"),
    ("`transferInternalShielded` (selector 4)", "w7-action-transfer-shielded-noop"),
    ("`transferInternalUnshielded` (selector 5)", "w8-action-transfer-unshielded-noop"),
    ("`withdrawUnshielded` (selector 3)", "w6-action-withdraw-unshielded-noop"),
]

CUSTODY_CROSS = [
    ("all `shieldedKey` derivations reached from `execute`", "d23-shieldedkey-noop",
     "N x persistentHash<Vector<3,Bytes<32>>>, no CSE between identical calls"),
    ("all `unshieldedKey` derivations reached from `execute`", "d24-unshieldedkey-noop",
     "N x persistentHash<Vector<3,Bytes<32>>>, no CSE between identical calls"),
    ("`sendShielded` inside `withdrawShielded`", "d25-sendshielded-noop",
     "1 zswap input + nullifier + 2 outputs + 2 coin commitments"),
    ("open-swap surplus machinery (`recipientA = none`)", "d26-openswap-surplus-noop",
     "createZswapInput + nullifier transcription + evolveNonce + output + commitment + 2 claims"),
    ("`claimWantedColour` (swap WANT leg)", "d27-claimwanted-noop",
     "receiveShielded + merge-or-create pool + credited balance write"),
    ("`assertSwapPreconditions` (swap guard block)", "d28-swappreconditions-noop",
     "1 shieldedBalanceOf + 2 pool guards + 1 Set.member + 3 sanity asserts"),
    ("`repoolOrRemove` (pool write-back)", "d29-repool-noop", "1 insertCoin / 1 remove"),
    ("`mergeCoinImmediate` in the WANT leg", "d30-mergecoin-noop",
     "2 zswap inputs + 2 nullifiers + 1 output + 1 commitment"),
]

ALL_CIRCUITS = ["execute", "depositShielded", "depositUnshielded", "shieldedAccountBalance",
                "unshieldedAccountBalance", "accountRecord", "poolValue", "isRegistered",
                "poolHasColour"]


def table(title: str, headers: list, aligns: list, body: list) -> None:
    print(f"\n### {title}\n")
    print("| " + " | ".join(headers) + " |")
    print("|" + "|".join(aligns) + "|")
    for r in body:
        print("| " + " | ".join(r) + " |")


def main() -> int:
    # 1. all-circuit totals
    body = []
    total = 0
    for c in ALL_CIRCUITS:
        r = rows("w0-baseline", c) if c != "execute" else BASELINE
        kk = k("w0-baseline", c) if c != "execute" else 20
        total += r
        body.append([f"`{c}`", str(kk), f"{r:,}", f"{r / BASELINE:.2%}"])
    table("All provable circuits", ["Circuit", "K", "Rows", "% of `execute`"],
          ["---", "---:", "---:", "---:"], body)
    print(f"\nTotal provable rows in the contract: **{total:,}**; "
          f"`execute` is **{BASELINE / total:.1%}** of them.")

    # 2. disjoint decomposition of execute
    body = []
    attributed = 0
    for group, name, arm, why in DISJOINT:
        delta = d(arm)
        attributed += delta
        body.append([group, name, f"{delta:,}", "Measured", f"{delta / BASELINE:.2%}", f"`{arm}`", why])
    residual = BASELINE - attributed
    body.append(["—", "**unattributed residual**", f"{residual:,}", "Derived (by subtraction)",
                 f"{residual / BASELINE:.2%}", "—",
                 "muxes, disclosures, argument encoding, circuit frame"])
    table("`execute` — disjoint decomposition",
          ["Group", "Sub-component", "Rows", "Measured/Derived", "% of circuit", "Arm", "Why"],
          ["---", "---", "---:", "---", "---:", "---", "---"], body)
    print(f"\nAttributed: **{attributed:,} of {BASELINE:,} rows = "
          f"{attributed / BASELINE:.2%}**; residual {residual:,} ({residual / BASELINE:.2%}).")

    # 3. semantic nested split
    body = []
    for name, arm, inner, why in SEMANTIC_NESTED:
        delta = d(arm) - (d(inner) if inner else 0)
        note = f"`{arm}`" + (f" − `{inner}`" if inner else "")
        body.append([name, f"{delta:,}", "Measured", f"{delta / d('w2-semantic-noop'):.2%}", note, why])
    table("FR-031 semantic chain — nested split "
          f"(w2 total {d('w2-semantic-noop'):,} rows)",
          ["Sub-component", "Rows", "Measured/Derived", "% of chain", "Arms", "Why"],
          ["---", "---:", "---", "---:", "---", "---"], body)
    sem_sum = sum(d(a) - (d(i) if i else 0) for _, a, i, _ in SEMANTIC_NESTED)
    print(f"\nSum of parts {sem_sum:,} vs w2 {d('w2-semantic-noop'):,} — "
          f"residual {d('w2-semantic-noop') - sem_sum:,} "
          f"({(d('w2-semantic-noop') - sem_sum) / d('w2-semantic-noop'):+.2%}).")

    # 4. EIP-712 split
    body = []
    for name, arm, why in EIP712_BRANCHES:
        delta = d(arm)
        body.append([name, f"{delta:,}", "Measured", f"`{arm}`", why])
    br_sum = sum(d(a) for _, a, _ in EIP712_BRANCHES)
    body.append(["**sum of the four branches**", f"{br_sum:,}", "—", "—", ""])
    body.append(["`evmStructHashFor` measured whole", f"{d('d07-eip712-structhash-noop'):,}",
                 "Measured", "`d07-eip712-structhash-noop`", ""])
    table("EIP-712 struct hash — per-selector branches", ["Branch", "Rows", "M/D", "Arm", "Why"],
          ["---", "---:", "---", "---", "---"], body)
    print(f"\nBranch sum {br_sum:,} vs whole {d('d07-eip712-structhash-noop'):,} — "
          f"residual {d('d07-eip712-structhash-noop') - br_sum:,} "
          f"({(d('d07-eip712-structhash-noop') - br_sum) / d('d07-eip712-structhash-noop'):+.2%}).")

    eip_parts = (d("d06-eip712-domainsep-noop") + d("d07-eip712-structhash-noop")
                 + d("d08-eip712-digest-noop"))
    print(f"\nEIP-712 chain: domain sep {d('d06-eip712-domainsep-noop'):,} + struct hash "
          f"{d('d07-eip712-structhash-noop'):,} + digest {d('d08-eip712-digest-noop'):,} = "
          f"**{eip_parts:,}** vs Phase 1 w3 **{d('w3-eip712-noop'):,}** — residual "
          f"{d('w3-eip712-noop') - eip_parts:,} "
          f"({(d('w3-eip712-noop') - eip_parts) / d('w3-eip712-noop'):+.2%}).")

    # 5. secp cross-check
    secp_parts = d("d14-ecdsa-verify-noop") + d("d15-ecdsa-address-noop")
    print(f"\nsecp256k1: verify {d('d14-ecdsa-verify-noop'):,} + address "
          f"{d('d15-ecdsa-address-noop'):,} = **{secp_parts:,}** vs Phase 1 w1 "
          f"**{d('w1-ecdsa-noop'):,}** — residual {d('w1-ecdsa-noop') - secp_parts:,} "
          f"({(d('w1-ecdsa-noop') - secp_parts) / d('w1-ecdsa-noop'):+.2%}).")

    # 6. custody
    body = []
    for name, arm in CUSTODY_LEGS:
        delta = d(arm)
        body.append([name, f"{delta:,}", "Measured", f"{delta / d('w4-custody-noop'):.2%}", f"`{arm}`"])
    leg_sum = sum(d(a) for _, a in CUSTODY_LEGS)
    table(f"Custody dispatch — per leg (w4 total {d('w4-custody-noop'):,} rows)",
          ["Leg", "Rows", "M/D", "% of custody", "Arm"], ["---", "---:", "---", "---:", "---"], body)
    print(f"\nLeg sum {leg_sum:,} vs w4 {d('w4-custody-noop'):,} — residual "
          f"{d('w4-custody-noop') - leg_sum:,}.")

    body = []
    for name, arm, why in CUSTODY_CROSS:
        delta = d(arm)
        body.append([name, f"{delta:,}", "Measured", f"`{arm}`", why])
    table("Custody dispatch — CROSS-CUTTING attributions (these OVERLAP the legs above and each "
          "other; they do not sum to custody)",
          ["Sub-component", "Rows", "M/D", "Arm", "Why"], ["---", "---:", "---", "---", "---"], body)

    # 6b. cross-cutting: the endianness bill ----------------------------------------------------
    rev = d("d31-reversebytes32-noop")
    print(f"\n### Cross-cutting — the endianness bill\n")
    print(f"`d31-reversebytes32-noop` makes `reverseBytes32` the identity and changes NOTHING else: "
          f"every call site, preimage and keccak still compiles.\n")
    print(f"| Sub-component | Rows | M/D | % of circuit | Why |")
    print(f"|---|---:|---|---:|---|")
    print(f"| every `reverseBytes32` reached from `execute` | {rev:,} | Measured | "
          f"{rev / BASELINE:.2%} | 32 static `uint64Word`/`uint128Word`/`uint8Word` call sites, "
          f"no CSE — {rev / 32:,.0f} rows each in situ vs {9423:,} in isolation |")
    print(f"\nThis cuts ACROSS the disjoint table: it is inside the EIP-712 struct hash "
          f"(13 sites), `actionUnionHash` (4), the call transcript (1) and the final semantic "
          f"preimage (14). It is not an extra {rev:,} rows on top of them.")

    # 7. unit-model validation on arms the model was NOT fitted on -----------------------------
    PH3, READ, INS, MEM, LOOKUP = 3767, 52, 17, 19, 46
    SEND_SH, INSERTCOIN, REMOVE = 22945, 5691, 12
    RECV_SH, MERGE, PCOMMIT = 5665, 17228, 1895
    UNSH_GTE, SEND_UNSH, RECV_UNSH = 53, 44, 35
    KEC64, KEC128, KEC384 = 4135, 4151, 12565

    preds = [
        ("w7-action-transfer-shielded-noop", "`transferInternalShielded` leg",
         5 * PH3 + 3 * READ + 2 * INS + MEM,
         "5 shieldedKey + 3 guarded reads + 2 Map.insert + 1 Set.member"),
        ("w8-action-transfer-unshielded-noop", "`transferInternalUnshielded` leg",
         5 * PH3 + 3 * READ + 2 * INS + MEM,
         "5 unshieldedKey + 3 guarded reads + 2 Map.insert + 1 Set.member"),
        ("w6-action-withdraw-unshielded-noop", "`withdrawUnshielded` leg",
         3 * PH3 + 2 * READ + UNSH_GTE + SEND_UNSH + INS,
         "3 unshieldedKey + 2 guarded reads + unshieldedBalanceGte + sendUnshielded + Map.insert"),
        ("w5-action-withdraw-shielded-noop", "`withdrawShielded` leg",
         3 * PH3 + 2 * READ + SEND_SH + MEM + 2 * LOOKUP + INSERTCOIN + REMOVE + INS,
         "3 shieldedKey + 2 guarded reads + sendShielded + pool member/2 lookups + "
         "BOTH repool branches + Map.insert"),
        ("d23-shieldedkey-noop", "every `shieldedKey` reached from `execute`", 13 * PH3,
         "13 static call sites x persistentHash<Vector<3,Bytes<32>>> (no CSE)"),
        ("d24-unshieldedkey-noop", "every `unshieldedKey` reached from `execute`", 8 * PH3,
         "8 static call sites x persistentHash<Vector<3,Bytes<32>>> (no CSE)"),
        ("d19-ownercommitment-noop", "`ownerCommitment(localOwnerSecret())`", PCOMMIT,
         "1 persistentCommit<Bytes<21>>"),
        ("d05-semantic-lexlt-noop", "`bytes32LexicographicLt`", 38205,
         "4 x 16-byte endianness reversal (probe p_lexlt)"),
    ]
    body = []
    for a, what, pred, why in preds:
        meas = d(a)
        body.append([what, f"{pred:,}", f"{meas:,}", f"{meas - pred:+,}",
                     f"{(meas - pred) / meas:+.2%}", why])
    table("Unit-model validation — predictions for arms the model was NOT fitted on",
          ["Target", "Predicted", "Measured", "Error", "Error %", "Composition used"],
          ["---", "---:", "---:", "---:", "---:", "---"], body)

    # 8. derived decomposition of the eight small circuits --------------------------------------
    small = [
        ("isRegistered", [("circuit frame + 1 `Bytes<32>` argument + `Set.member`", 129,
                           "this IS the project's control probe")]),
        ("poolHasColour", [("circuit frame + 1 `Bytes<32>` argument + `Map.member`", 129,
                            "same shape, coin map")]),
        ("poolValue", [("frame + argument + `Map.member`", 129, "control"),
                       ("`lookup(col).value` + missing-cell mux", 30, "guarded coin-map read")]),
        ("accountRecord", [("frame + argument + `accounts.member`", 129, "control"),
                           ("`accountModes` member+lookup, `evmOwners`/`evmNonces` member+lookup x2, "
                            "3 asserts, 3 struct returns", 187, "6 map ops at 19-46 rows each")]),
        ("shieldedAccountBalance", [("frame + 2 `Bytes<32>` arguments", 217, "129 + 88"),
                                    ("`shieldedKey` = persistentHash<Vector<3,Bytes<32>>>", PH3,
                                     "the whole circuit, essentially"),
                                    ("guarded `shieldedBalances` read", READ, "member+lookup+mux")]),
        ("unshieldedAccountBalance", [("frame + 2 `Bytes<32>` arguments", 217, "129 + 88"),
                                      ("`unshieldedKey`", PH3, "identical shape, other family"),
                                      ("guarded read", READ, "member+lookup+mux")]),
        ("depositUnshielded", [("frame + 3 arguments", 305, "129 + 2 x 88"),
                               ("2 x `unshieldedKey`", 2 * PH3, "balanceOf + insert key, no CSE"),
                               ("guarded read + `Map.insert` + `accounts.member`", READ + INS + MEM,
                                ""),
                               ("`receiveUnshielded`", RECV_UNSH, "")]),
        ("depositShielded", [("frame + `ShieldedCoinInfo` + `Bytes<32>` arguments", 359, ""),
                             ("2 x `shieldedKey`", 2 * PH3, "balanceOf + insert key, no CSE"),
                             ("`receiveShielded`", RECV_SH, "output + coin commitment + claim"),
                             ("`mergeCoinImmediate` (merge branch)", MERGE,
                              "2 zswap inputs + 2 nullifiers + output + commitment"),
                             ("`pools.insertCoin` x2 (BOTH branches compile)", 2 * INSERTCOIN, ""),
                             ("pool member/lookup, guarded read, `Map.insert`, `accounts.member`",
                              MEM + LOOKUP + READ + INS + MEM, "")]),
    ]
    print("\n\n## Derived decompositions of the eight non-`execute` circuits\n")
    print("Every row below is **DERIVED** from the 4.2 unit table (no per-part ablation exists for "
          "these circuits); the measured total is the check.\n")
    for circuit, parts in small:
        meas = rows("w0-baseline", circuit)
        body = [[n, f"{r:,}", "Derived", f"{r / meas:.1%}", w] for n, r, w in parts]
        s = sum(r for _, r, _ in parts)
        body.append(["**residual**", f"{meas - s:,}", "Derived (by subtraction)",
                     f"{(meas - s) / meas:.1%}", ""])
        table(f"`{circuit}` — measured total {meas:,} rows (k={k('w0-baseline', circuit)})",
              ["Sub-component", "Rows", "M/D", "% of circuit", "Why"],
              ["---", "---:", "---", "---:", "---"], body)
        print(f"\nPredicted {s:,} vs measured {meas:,} — residual {meas - s:+,} "
              f"({(meas - s) / meas:+.2%}).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
