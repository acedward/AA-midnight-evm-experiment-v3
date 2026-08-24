#!/usr/bin/env python3
"""00009 Phase 4 — verify every number quoted in DECOMPOSITION.md against the raw logs.

Three classes of number appear in the deliverable:
  (a) MEASURED row counts       — must appear verbatim as `(k=NN, rows=NNNNNN)` in a raw log;
  (b) DELTAS                    — baseline minus a measured arm, or one arm minus another;
  (c) DERIVED                   — unit costs (probe minus matched control), sums, and model
                                  predictions built only from (a) and (b).

This script recomputes every (b) and (c) figure the document quotes and asserts the document's
value matches. It exits non-zero on the first mismatch, so the deliverable cannot drift from the
evidence.

MEASUREMENT-ONLY: reads logs, runs nothing.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "evidence" / "00009-circuit-weight" / "raw"
DOC = ROOT / "evidence" / "00009-circuit-weight" / "DECOMPOSITION.md"
RE_RESULT = re.compile(r"\(k=(\d+), rows=(\d+)\)")
BASELINE = 974572


def rows(arm: str, circuit: str = "execute") -> int:
    name = f"{arm}.measure.log" if circuit == "execute" else f"{arm}.{circuit}.measure.log"
    m = RE_RESULT.search((RAW / name).read_text())
    if not m:
        raise SystemExit(f"no result in {name}")
    return int(m.group(2))


def d(arm: str) -> int:
    return BASELINE - rows(arm)


def unit(probe_arm: str, probe: str, ctl_arm: str, ctl: str) -> int:
    return rows(probe_arm, probe) - rows(ctl_arm, ctl)


PH = "probe-hashing"
PP = "probe-plumbing"
PS = "probe-state"
W0 = "w0-baseline"

checks: list = []


def check(label: str, quoted: int, computed, how: str) -> None:
    checks.append((label, quoted, int(round(computed)), how))


# --- (a) measured totals quoted in the deliverable ---------------------------------------------
for circuit, quoted in [("depositShielded", 42239), ("depositUnshielded", 7918),
                        ("shieldedAccountBalance", 4001), ("unshieldedAccountBalance", 4001),
                        ("accountRecord", 316), ("poolValue", 159), ("isRegistered", 129),
                        ("poolHasColour", 129)]:
    check(f"total {circuit}", quoted, rows(W0, circuit), "raw (k=,rows=) line")
check("total execute", 974572, BASELINE, "Phase 1 w0 gate")
check("all non-execute circuits combined", 58892,
      sum(rows(W0, c) for c in ["depositShielded", "depositUnshielded", "shieldedAccountBalance",
                                "unshieldedAccountBalance", "accountRecord", "poolValue",
                                "isRegistered", "poolHasColour"]), "sum of the eight")
check("all provable rows", 1033464, BASELINE + sum(
    rows(W0, c) for c in ["depositShielded", "depositUnshielded", "shieldedAccountBalance",
                          "unshieldedAccountBalance", "accountRecord", "poolValue",
                          "isRegistered", "poolHasColour"]), "sum of nine")

# --- (b) d-arm and w-arm deltas ----------------------------------------------------------------
for label, arm, quoted in [
    ("semantic chain (w2)", "w2-semantic-noop", 366831),
    ("EIP-712 chain (w3)", "w3-eip712-noop", 310805),
    ("custody total (w4)", "w4-custody-noop", 189284),
    ("secp both (w1)", "w1-ecdsa-noop", 49132),
    ("actionUnionHash (d01)", "d01-semantic-union-noop", 40960),
    ("semantic final own is d03 total", "d03-semantic-final-noop", 319949),
    ("event payload (d04)", "d04-semantic-eventpayload-noop", 13312),
    ("lexicographic Lt (d05)", "d05-semantic-lexlt-noop", 37817),
    ("domain separator (d06)", "d06-eip712-domainsep-noop", 34562),
    ("struct hash whole (d07)", "d07-eip712-structhash-noop", 267303),
    ("0x1901 digest (d08)", "d08-eip712-digest-noop", 13175),
    ("struct sel1 (d09)", "d09-eip712-struct-sel1-noop", 27670),
    ("struct sel23 (d10)", "d10-eip712-struct-sel23-noop", 78329),
    ("struct sel45 (d11)", "d11-eip712-struct-sel45-noop", 64401),
    ("struct sel6 (d12)", "d12-eip712-struct-sel6-noop", 92636),
    ("evmAccountIdFor (d13)", "d13-evm-accountid-noop", 9133),
    ("ecdsa verify (d14)", "d14-ecdsa-verify-noop", 21282),
    ("ecdsa address (d15)", "d15-ecdsa-address-noop", 27622),
    ("envelope (d16)", "d16-envelope-noop", 204),
    ("deadline (d17)", "d17-deadline-noop", 58),
    ("auth (d18)", "d18-auth-noop", 255),
    ("ownerCommitment (d19)", "d19-ownercommitment-noop", 1970),
    ("nativeAuthResult (d20)", "d20-nativeauthresult-noop", 4441),
    ("register (d21)", "d21-register-noop", 99),
    ("nonce (d22)", "d22-nonce-noop", 45),
    ("all shieldedKey (d23)", "d23-shieldedkey-noop", 48971),
    ("all unshieldedKey (d24)", "d24-unshieldedkey-noop", 30136),
    ("sendShielded in withdraw (d25)", "d25-sendshielded-noop", 28716),
    ("openswap surplus (d26)", "d26-openswap-surplus-noop", 17211),
    ("claimWantedColour (d27)", "d27-claimwanted-noop", 41863),
    ("swap preconditions (d28)", "d28-swappreconditions-noop", 3901),
    ("repoolOrRemove (d29)", "d29-repool-noop", 11413),
    ("mergeCoinImmediate (d30)", "d30-mergecoin-noop", 17196),
    ("all reverseBytes32 (d31)", "d31-reversebytes32-noop", 272847),
    ("openswap leg (w9)", "w9-action-openswap-noop", 99353),
    ("withdrawShielded leg (w5)", "w5-action-withdraw-shielded-noop", 40212),
    ("transferShielded leg (w7)", "w7-action-transfer-shielded-noop", 19043),
    ("transferUnshielded leg (w8)", "w8-action-transfer-unshielded-noop", 19043),
    ("withdrawUnshielded leg (w6)", "w6-action-withdraw-unshielded-noop", 11613),
]:
    check(label, quoted, d(arm), "974,572 − measured")

check("transcript own (d02 − d01)", 18237,
      d("d02-semantic-transcript-noop") - d("d01-semantic-union-noop"), "nested subtraction")
check("final preimage own (d03 − d02)", 260752,
      d("d03-semantic-final-noop") - d("d02-semantic-transcript-noop"), "nested subtraction")

# --- (c) unit costs from probe minus matched control -------------------------------------------
for label, quoted, args in [
    ("ledger-touch control", 129, (PP, "p_ctl_k", None, None)),
    ("unused Bytes<32> argument", 88, (PP, "p_ctl_w32", PP, "p_ctl_k")),
    ("keccak 32 B", 4127, (PH, "h_kec_32", PP, "p_ctl_w32")),
    ("keccak 136 B", 8327, (PH, "h_kec_136", PP, "p_ctl_w136")),
    ("keccak 384 B", 12565, (PH, "h_kec_384", PP, "p_ctl_w384")),
    ("keccak 1024 B", 33601, (PH, "h_kec_1024", PP, "p_ctl_w1024")),
    ("reverseBytes32", 9426, (PP, "p_rev32", PP, "p_ctl_k")),
    ("slice<32> of Bytes<32>", 9426, (PP, "p_slice32", PP, "p_ctl_k")),
    ("uint128Word", 9423, (PP, "p_u128word", PP, "p_u128cast")),
    ("Uint<128> as Bytes<32> cast", 113, (PP, "p_u128cast", PP, "p_ctl_k")),
    ("addressWord", 2939, (PP, "p_addrword", PP, "p_ctl_k")),
    ("bytes32LexicographicLt", 38205, (PP, "p_lexlt", PP, "p_ctl_n2")),
    ("persistentHash V1", 1883, (PH, "h_ph_v1", PP, "p_ctl_k")),
    ("persistentHash V2", 3661, (PH, "h_ph_v2", PP, "p_ctl_n2")),
    ("persistentHash V3 (shieldedKey)", 3767, (PH, "h_ph_v3", PH, "h_ctl_a3")),
    ("persistentHash V8", 9401, (PH, "h_ph_v8", PH, "h_ctl_a8")),
    ("persistentCommit", 1895, (PH, "h_pcommit", PP, "p_ctl_k")),
    ("coin commitment persistentHash", 5659, (PS, "s_coin_commitment", PS, "s_ctl_coin_rcpt")),
    ("sendShielded", 22945, (PS, "s_send_shielded", PS, "s_ctl_coin_rcpt")),
    ("mergeCoinImmediate", 17228, (PS, "s_merge_coin", PS, "s_ctl_coin")),
    ("receiveShielded", 5665, (PS, "s_receive_shielded", PS, "s_ctl_coin")),
    ("insertCoin", 5691, (PS, "s_pools_insertcoin", PS, "s_ctl_coin")),
    ("secp verify (isolated)", 28731, (PS, "s_ecdsa_verify", PS, "s_ctl_secp")),
    ("secp address (isolated)", 31588, (PS, "s_ecdsa_address", PS, "s_ctl_secp")),
    ("secp both (isolated)", 59987, (PS, "s_ecdsa_both", PS, "s_ctl_secp")),
    ("Bytes<32> equality", 7, (PP, "p_eq32", PP, "p_ctl_n2")),
    ("Bytes<32> mux", 2, (PP, "p_mux32", PP, "p_ctl_mux32")),
    ("Uint<128> comparison", 2, (PP, "p_cmp128", PP, "p_ctl_gt0")),
    ("Uint<128> mux", 25, (PP, "p_mux128", PP, "p_ctl_gt0")),
    ("6-way constant mux", 18, (PP, "p_mux_6way", PP, "p_ctl_sel")),
    ("blockTimeGte+Lt", 52, (PP, "p_blocktime_both", PP, "p_ctl_sel")),
    ("Map.member", 19, (PS, "s_map_member", PS, "s_ctl_kj")),
    ("Map guarded lookup", 52, (PS, "s_map_lookup", PS, "s_ctl_kj")),
    ("Map.insert", 17, (PS, "s_map_insert", PS, "s_ctl_kjv")),
    ("Map.remove", 12, (PS, "s_map_remove", PS, "s_ctl_kj")),
    ("Set.insert", 14, (PS, "s_set_insert", PS, "s_ctl_kj")),
    ("kernel.self()", 19, (PS, "s_self", PS, "s_ctl_k")),
    ("createZswapInput", 28, (PS, "s_zswap_input", PS, "s_ctl_kj")),
    ("createZswapOutput", 0, (PS, "s_zswap_output", PS, "s_ctl_coin_rcpt")),
    ("evolveNonce", 188, (PS, "s_evolve_nonce", PS, "s_ctl_kj")),
    ("receiveUnshielded", 35, (PS, "s_receive_unshielded", PS, "s_ctl_kjv")),
    ("sendUnshielded", 44, (PS, "s_send_unshielded", PS, "s_ctl_coin_rcpt")),
    ("unshieldedBalanceGte", 53, (PS, "s_unshielded_gte", PS, "s_ctl_kjv")),
]:
    pa, p, ca, c = args
    computed = rows(pa, p) if ca is None else unit(pa, p, ca, c)
    check(f"unit {label}", quoted, computed, "probe − matched control")

# --- (c) laws and aggregates --------------------------------------------------------------------
check("keccak-f permutation", 4176,
      unit(PH, "h_kec_136", PP, "p_ctl_w136") - unit(PH, "h_kec_135", PP, "p_ctl_w136"),
      "(136 B, 135 B) pair — one permutation apart")
check("13 semantic permutations", 54288, 13 * 4176, "13 × 4,176")
check("word splice, 16 words", 4512,
      (unit(PP, "p_asm_n16", PP, "p_ctl_n16") - (-55 + 4176 * 4 + 0.25 * 512)) / 16,
      "(probe − control − keccak) / 16")
check("in-situ reversal cost per site", 8526, d("d31-reversebytes32-noop") / 32,
      "d31 / 32 static call sites")

check("semantic parts sum", 375519,
      d("d01-semantic-union-noop")
      + (d("d02-semantic-transcript-noop") - d("d01-semantic-union-noop"))
      + (d("d03-semantic-final-noop") - d("d02-semantic-transcript-noop"))
      + d("d04-semantic-eventpayload-noop") + d("d05-semantic-lexlt-noop")
      + d("d20-nativeauthresult-noop"), "sum of the six nested parts")
check("semantic residual", -8688, d("w2-semantic-noop") - 375519, "w2 − parts")
check("EIP-712 branch sum", 263036,
      sum(d(a) for a in ["d09-eip712-struct-sel1-noop", "d10-eip712-struct-sel23-noop",
                         "d11-eip712-struct-sel45-noop", "d12-eip712-struct-sel6-noop"]),
      "sum of four branches")
check("EIP-712 branch residual", 4267, d("d07-eip712-structhash-noop") - 263036, "d07 − branches")
check("EIP-712 chain sum", 315040,
      d("d06-eip712-domainsep-noop") + d("d07-eip712-structhash-noop")
      + d("d08-eip712-digest-noop"), "d06+d07+d08")
check("EIP-712 chain residual", -4235, d("w3-eip712-noop") - 315040, "w3 − parts")
check("secp in-situ sum", 48904,
      d("d14-ecdsa-verify-noop") + d("d15-ecdsa-address-noop"), "d14+d15")
check("secp residual", 228, d("w1-ecdsa-noop") - 48904, "w1 − parts")
check("custody leg sum", 189264,
      sum(d(a) for a in ["w5-action-withdraw-shielded-noop", "w6-action-withdraw-unshielded-noop",
                         "w7-action-transfer-shielded-noop", "w8-action-transfer-unshielded-noop",
                         "w9-action-openswap-noop"]), "w5..w9")
check("custody leg residual", 20, d("w4-custody-noop") - 189264, "w4 − legs")

DISJOINT = ["w2-semantic-noop", "d07-eip712-structhash-noop", "w4-custody-noop",
            "d06-eip712-domainsep-noop", "d15-ecdsa-address-noop", "d14-ecdsa-verify-noop",
            "d08-eip712-digest-noop", "d13-evm-accountid-noop", "d19-ownercommitment-noop",
            "d18-auth-noop", "d16-envelope-noop", "d21-register-noop", "d17-deadline-noop",
            "d22-nonce-noop"]
check("disjoint attributed", 931823, sum(d(a) for a in DISJOINT), "sum of the 14 disjoint parts")
check("disjoint residual", 42749, BASELINE - 931823, "974,572 − attributed")
check("validation logic total", 661,
      sum(d(a) for a in ["d16-envelope-noop", "d18-auth-noop", "d21-register-noop",
                         "d17-deadline-noop", "d22-nonce-noop"]), "d16+d18+d21+d17+d22")
check("key derivations total", 79107,
      d("d23-shieldedkey-noop") + d("d24-unshieldedkey-noop"), "d23+d24")
check("hoisting saving (13+8 -> 5+3)", 48971, 13 * 3767, "(13−5 + 8−3) × 3,767")
check("selector-6 removal ceiling", 191989,
      d("d12-eip712-struct-sel6-noop") + d("w9-action-openswap-noop"), "d12 + w9")

# --- (c) model predictions ----------------------------------------------------------------------
PH3, READ, INS, MEM, LOOKUP = 3767, 52, 17, 19, 46
check("predict shieldedAccountBalance", 4036, 129 + 88 + PH3 + READ, "frame + arg + key + read")
check("predict depositUnshielded", 7962, 305 + 2 * PH3 + READ + INS + MEM + 35, "unit sum")
check("predict depositShielded", 42321,
      359 + 2 * PH3 + 5665 + 17228 + 2 * 5691 + MEM + LOOKUP + READ + INS + MEM, "unit sum")
check("predict transferShielded leg", 19044, 5 * PH3 + 3 * READ + 2 * INS + MEM, "unit sum")
check("predict withdrawUnshielded leg", 11519, 3 * PH3 + 2 * READ + 53 + 44 + INS, "unit sum")
check("predict withdrawShielded leg", 40181,
      3 * PH3 + 2 * READ + 22945 + MEM + 2 * LOOKUP + 5691 + 12 + INS, "unit sum")
check("predict d23 from static count", 48971, 13 * PH3, "13 call sites × 3,767")
check("predict d24 from static count", 30136, 8 * PH3, "8 call sites × 3,767")
# --- report --------------------------------------------------------------------------------------
bad = [c for c in checks if c[1] != c[2]]
for label, quoted, computed, how in checks:
    if quoted != computed:
        print(f"MISMATCH {label:<45} doc={quoted:>10,} computed={computed:>10,}  [{how}]")
print(f"{len(checks) - len(bad)}/{len(checks)} exact figures verified against the raw logs.")

# The document also states ONE approximate claim about the shared-decomposition model; it is
# asserted with the tolerance the document itself states ("within 3 rows"), not as an equality.
d01_pred = 12 * 2366 + 12565
d01_err = d("d01-semantic-union-noop") - d01_pred
tol_ok = abs(d01_err) <= 3
print(f"{'OK  ' if tol_ok else 'FAIL'} d01 absorb-model claim: predicted {d01_pred:,}, measured "
      f"{d('d01-semantic-union-noop'):,}, error {d01_err:+d} (document claims 'within 3 rows')")

# every arm the document cites, in either the full or the short form, must have a retained log
text = DOC.read_text()
armrefs = set(re.findall(r"`(d\d\d-[a-z0-9-]+|w\d-[a-z0-9-]+)`", text))
armrefs |= {p.name[: -len(".measure.log")]
            for tag in re.findall(r"`(d\d\d)`", text)
            for p in RAW.glob(f"{tag}-*.measure.log")}
missing = sorted(a for a in armrefs if not (RAW / f"{a}.measure.log").exists())
print(f"arm references with a retained measure log: {len(armrefs) - len(missing)}/{len(armrefs)}"
      + (f"  MISSING: {missing}" if missing else ""))

sys.exit(1 if bad or missing or not tol_ok else 0)
