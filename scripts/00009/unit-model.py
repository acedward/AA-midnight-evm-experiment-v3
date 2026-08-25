#!/usr/bin/env python3
"""00009 Phase 4.2 — derive the unit-cost table from the probe measurement logs.

Reads `evidence/00009-circuit-weight/raw/<arm>.<circuit>.measure.log`, extracts the
`(k=NN, rows=NNNNNN)` line each `zkir-v3 mock-compile` printed, and reports

    unit(op) = rows(probe) - rows(matching control)

for every probe, so no unit cost in DECOMPOSITION.md is hand-arithmetic. Also fits and checks
the keccak cost law against the measured width sweep.

MEASUREMENT-ONLY: this script only reads logs. It runs nothing.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "evidence" / "00009-circuit-weight" / "raw"
RE_RESULT = re.compile(r"\(k=(\d+), rows=(\d+)\)")


def load(arm: str) -> dict:
    out = {}
    for log in sorted(RAW.glob(f"{arm}.*.measure.log")):
        circuit = log.name[len(arm) + 1: -len(".measure.log")]
        m = RE_RESULT.search(log.read_text())
        if not m:
            print(f"no result in {log}", file=sys.stderr)
            return {}
        out[circuit] = (int(m.group(1)), int(m.group(2)))
    return out


ROWS = {}
for arm in ("probe-hashing", "probe-plumbing", "probe-state", "w0-baseline"):
    for circuit, (k, rows) in load(arm).items():
        ROWS[f"{arm}/{circuit}"] = rows

# (label, probe, control, note)
UNITS = [
    # --- frame -------------------------------------------------------------------------------
    ("ledger-touch control (Set.member + 1 Bytes<32> arg)", "probe-plumbing/p_ctl_k", None,
     "the project's canonical minimum provable circuit; equals the product's isRegistered"),
    ("Bytes<32> circuit argument, unused", "probe-plumbing/p_ctl_w32", "probe-plumbing/p_ctl_k", ""),
    ("Bytes<1024> circuit argument, unused", "probe-plumbing/p_ctl_w1024", "probe-plumbing/p_ctl_k", ""),

    # --- keccak ------------------------------------------------------------------------------
    ("keccak256 over 32 B (1 perm)", "probe-hashing/h_kec_32", "probe-plumbing/p_ctl_w32", ""),
    ("keccak256 over 64 B (1 perm)", "probe-hashing/h_kec_64", "probe-plumbing/p_ctl_w64", ""),
    ("keccak256 over 128 B (1 perm)", "probe-hashing/h_kec_128", "probe-plumbing/p_ctl_w128", ""),
    ("keccak256 over 135 B (1 perm)", "probe-hashing/h_kec_135", "probe-plumbing/p_ctl_w136", "control is 1 B wider"),
    ("keccak256 over 136 B (2 perms)", "probe-hashing/h_kec_136", "probe-plumbing/p_ctl_w136", ""),
    ("keccak256 over 256 B (2 perms)", "probe-hashing/h_kec_256", "probe-plumbing/p_ctl_w256", ""),
    ("keccak256 over 384 B (3 perms)", "probe-hashing/h_kec_384", "probe-plumbing/p_ctl_w384", ""),
    ("keccak256 over 1024 B (8 perms)", "probe-hashing/h_kec_1024", "probe-plumbing/p_ctl_w1024", ""),

    # --- preimage assembly -------------------------------------------------------------------
    ("splice 2 words + keccak", "probe-plumbing/p_asm_n2", "probe-plumbing/p_ctl_n2", ""),
    ("splice 4 words + keccak", "probe-plumbing/p_asm_n4", "probe-plumbing/p_ctl_n4", ""),
    ("splice 8 words + keccak", "probe-plumbing/p_asm_n8", "probe-plumbing/p_ctl_n8", ""),
    ("splice 16 words + keccak", "probe-plumbing/p_asm_n16", "probe-plumbing/p_ctl_n16", ""),
    ("splice 16 words (8 CONSTANT) + keccak", "probe-plumbing/p_asm_n16_half_const",
     "probe-plumbing/p_ctl_n8", ""),

    # --- byte plumbing -----------------------------------------------------------------------
    ("reverseBytes32", "probe-plumbing/p_rev32", "probe-plumbing/p_ctl_k", ""),
    ("slice<32>(Bytes<32>, 0)", "probe-plumbing/p_slice32", "probe-plumbing/p_ctl_k", ""),
    ("uint64Word  (cast + reverse)", "probe-plumbing/p_u64word", "probe-plumbing/p_u64cast", ""),
    ("uint128Word (cast + reverse)", "probe-plumbing/p_u128word", "probe-plumbing/p_u128cast", ""),
    ("uint8Word   (cast + reverse)", "probe-plumbing/p_u8word", "probe-plumbing/p_u8cast", ""),
    ("Uint<128> as Bytes<32> (cast only)", "probe-plumbing/p_u128cast", "probe-plumbing/p_ctl_k", ""),
    ("addressWord (Bytes<20> -> Bytes<32>)", "probe-plumbing/p_addrword", "probe-plumbing/p_ctl_k", ""),
    ("bytes32LexicographicLt", "probe-plumbing/p_lexlt", "probe-plumbing/p_ctl_n2", ""),

    # --- comparison / mux --------------------------------------------------------------------
    ("Bytes<32> equality", "probe-plumbing/p_eq32", "probe-plumbing/p_ctl_n2", ""),
    ("Uint<128> comparison", "probe-plumbing/p_cmp128", "probe-plumbing/p_ctl_gt0", ""),
    ("Uint<128> mux", "probe-plumbing/p_mux128", "probe-plumbing/p_ctl_gt0", ""),
    ("Bytes<32> mux", "probe-plumbing/p_mux32", "probe-plumbing/p_ctl_mux32", ""),
    ("6-way constant mux (frozenTypeHash shape)", "probe-plumbing/p_mux_6way", "probe-plumbing/p_ctl_sel", ""),
    ("blockTimeGte", "probe-plumbing/p_blocktime_gte", "probe-plumbing/p_ctl_sel", ""),
    ("blockTimeGte + blockTimeLt", "probe-plumbing/p_blocktime_both", "probe-plumbing/p_ctl_sel", ""),

    # --- SNARK-native hashes -----------------------------------------------------------------
    ("persistentHash<Vector<1,Bytes<32>>>", "probe-hashing/h_ph_v1", "probe-plumbing/p_ctl_k", ""),
    ("persistentHash<Vector<2,Bytes<32>>>", "probe-hashing/h_ph_v2", "probe-plumbing/p_ctl_n2", ""),
    ("persistentHash<Vector<3,Bytes<32>>> (shieldedKey)", "probe-hashing/h_ph_v3",
     "probe-hashing/h_ctl_a3", ""),
    ("persistentHash<Vector<8,Bytes<32>>>", "probe-hashing/h_ph_v8", "probe-hashing/h_ctl_a8", ""),
    ("persistentCommit<Bytes<21>> (ownerCommitment)", "probe-hashing/h_pcommit",
     "probe-plumbing/p_ctl_k", ""),
    ("persistentHash<SwapCoinPreimage> (coin commitment)", "probe-state/s_coin_commitment",
     "probe-state/s_ctl_coin_rcpt", "includes one extra Set.member"),

    # --- ledger ops --------------------------------------------------------------------------
    ("Set.insert", "probe-state/s_set_insert", "probe-state/s_ctl_kj", ""),
    ("Map.member", "probe-state/s_map_member", "probe-state/s_ctl_kj", ""),
    ("Map guarded lookup (member ? lookup : 0)", "probe-state/s_map_lookup", "probe-state/s_ctl_kj", ""),
    ("Map.insert", "probe-state/s_map_insert", "probe-state/s_ctl_kjv", ""),
    ("Map.remove", "probe-state/s_map_remove", "probe-state/s_ctl_kj", ""),
    ("coin-Map.member", "probe-state/s_pools_member", "probe-state/s_ctl_kj", ""),
    ("coin-Map guarded lookup(.value)", "probe-state/s_pools_lookup", "probe-state/s_ctl_kj", ""),
    ("coin-Map.remove", "probe-state/s_pools_remove", "probe-state/s_ctl_kj", ""),
    ("coin-Map.insertCoin", "probe-state/s_pools_insertcoin", "probe-state/s_ctl_coin", ""),
    ("kernel.self()", "probe-state/s_self", "probe-state/s_ctl_k", ""),
    ("shieldedBalanceOf (key + guarded read)", "probe-state/s_balance_of", "probe-state/s_ctl_n3_synthetic",
     ""),

    # --- zswap -------------------------------------------------------------------------------
    ("receiveShielded", "probe-state/s_receive_shielded", "probe-state/s_ctl_coin", ""),
    ("sendShielded", "probe-state/s_send_shielded", "probe-state/s_ctl_coin_rcpt", "control approximate"),
    ("mergeCoinImmediate", "probe-state/s_merge_coin", "probe-state/s_ctl_coin", ""),
    ("createZswapInput", "probe-state/s_zswap_input", "probe-state/s_ctl_kj", ""),
    ("createZswapOutput", "probe-state/s_zswap_output", "probe-state/s_ctl_coin_rcpt", ""),
    ("kernel.claimZswapNullifier", "probe-state/s_claim_nullifier", "probe-state/s_ctl_kj", ""),
    ("claimZswapCoinSpend + claimZswapCoinReceive", "probe-state/s_claim_spend_receive",
     "probe-state/s_ctl_kj", ""),
    ("evolveNonce", "probe-state/s_evolve_nonce", "probe-state/s_ctl_kj", ""),

    # --- unshielded --------------------------------------------------------------------------
    ("receiveUnshielded", "probe-state/s_receive_unshielded", "probe-state/s_ctl_kjv", ""),
    ("sendUnshielded", "probe-state/s_send_unshielded", "probe-state/s_ctl_coin_rcpt", "control approximate"),
    ("unshieldedBalanceGte", "probe-state/s_unshielded_gte", "probe-state/s_ctl_kjv", ""),

    # --- secp256k1 ---------------------------------------------------------------------------
    ("secp256k1EcdsaVerify", "probe-state/s_ecdsa_verify", "probe-state/s_ctl_secp", ""),
    ("secp256k1EthereumAddress", "probe-state/s_ecdsa_address", "probe-state/s_ctl_secp", ""),
    ("both secp ops (execute's shape)", "probe-state/s_ecdsa_both", "probe-state/s_ctl_secp", ""),
]

# a3-shaped control for the 3-argument balance probe
ROWS["probe-state/s_ctl_n3_synthetic"] = ROWS["probe-hashing/h_ctl_a3"]

print(f"| {'Unit':<52} | {'Probe':>8} | {'Control':>8} | {'Unit rows':>9} | Note |")
print(f"|{'-' * 54}|{'-' * 10}:|{'-' * 10}:|{'-' * 11}:|---|")
for label, probe, control, note in UNITS:
    if probe not in ROWS:
        print(f"MISSING {probe}", file=sys.stderr)
        continue
    p = ROWS[probe]
    if control is None:
        print(f"| {label:<52} | {p:>8,} | {'—':>8} | {p:>9,} | {note} |")
        continue
    c = ROWS[control]
    print(f"| {label:<52} | {p:>8,} | {c:>8,} | {p - c:>9,} | {note} |")

# --- keccak cost law ------------------------------------------------------------------------
#
# Fitted on the (135, 136) one-permutation-apart pair for C_PERM and on the 32/128 pair for the
# per-byte absorb term; C0 is the residual constant.
C_PERM, C_BYTE, C0 = 4176.0, 0.25, -55.0
ASM_WORD = 4514.0  # rows per VARIABLE 32-byte word spliced into a preimage; constants are free


def keccak(n: int) -> float:
    perms = -(-(n + 1) // 136)
    return C0 + C_PERM * perms + C_BYTE * n


print()
print(f"Keccak cost law: rows = {C0:.0f} + {C_PERM:.0f} * ceil((N+1)/136) + {C_BYTE} * N")
print(f"| {'N':>5} | {'perms':>5} | {'measured':>9} | {'predicted':>9} | {'err':>6} |")
print("|------:|------:|----------:|----------:|-------:|")
pairs = [(32, "probe-hashing/h_kec_32", "probe-plumbing/p_ctl_w32"),
         (64, "probe-hashing/h_kec_64", "probe-plumbing/p_ctl_w64"),
         (128, "probe-hashing/h_kec_128", "probe-plumbing/p_ctl_w128"),
         (136, "probe-hashing/h_kec_136", "probe-plumbing/p_ctl_w136"),
         (256, "probe-hashing/h_kec_256", "probe-plumbing/p_ctl_w256"),
         (384, "probe-hashing/h_kec_384", "probe-plumbing/p_ctl_w384"),
         (1024, "probe-hashing/h_kec_1024", "probe-plumbing/p_ctl_w1024")]
for n, probe, control in pairs:
    meas = ROWS[probe] - ROWS[control]
    perms = -(-(n + 1) // 136)
    pred = keccak(n)
    print(f"| {n:>5} | {perms:>5} | {meas:>9,} | {pred:>9,.0f} | {meas - pred:>6,.0f} |")

# --- preimage assembly law --------------------------------------------------------------------
print()
print("Preimage assembly law: rows per VARIABLE 32-byte word spliced into a keccak preimage")
print(f"| {'words':>5} | {'var':>4} | {'probe-control':>13} | {'minus keccak':>12} | {'per word':>8} |")
print("|------:|-----:|--------------:|-------------:|---------:|")
for words, var, probe, control in [
    (2, 2, "probe-plumbing/p_asm_n2", "probe-plumbing/p_ctl_n2"),
    (4, 4, "probe-plumbing/p_asm_n4", "probe-plumbing/p_ctl_n4"),
    (8, 8, "probe-plumbing/p_asm_n8", "probe-plumbing/p_ctl_n8"),
    (16, 16, "probe-plumbing/p_asm_n16", "probe-plumbing/p_ctl_n16"),
    (16, 8, "probe-plumbing/p_asm_n16_half_const", "probe-plumbing/p_ctl_n8"),
]:
    net = ROWS[probe] - ROWS[control]
    asm = net - keccak(32 * words)
    print(f"| {words:>5} | {var:>4} | {net:>13,} | {asm:>12,.0f} | {asm / var:>8,.0f} |")

# --- model validation on arms the model was NOT fitted on -------------------------------------
print()
print("Model validation (predictions for probes the laws were not fitted on):")
ARG32, FRAME = 88.0, 41.0
u = {
    "reverse": ROWS["probe-plumbing/p_u128word"] - ROWS["probe-plumbing/p_u128cast"],
    "addrword": ROWS["probe-plumbing/p_addrword"] - ROWS["probe-plumbing/p_ctl_k"],
}
# h_asm_384_words: 12 Bytes<32> args, splice 12 variable words, keccak<384>
pred_words = (FRAME + 12 * ARG32) + 12 * ASM_WORD + keccak(384)
meas_words = ROWS["probe-hashing/h_asm_384_words"]
print(f"  h_asm_384_words  predicted {pred_words:>9,.0f}  measured {meas_words:>9,}  "
      f"err {meas_words - pred_words:>+7,.0f} ({(meas_words - pred_words) / meas_words:+.2%})")
# h_asm_384_mixed: actionUnionHash verbatim — 12 variable words, 5 encoders, keccak<384>
args_mixed = FRAME + 7 * ARG32 + 60 + 35 + 2 * 53 + 24
enc_mixed = u["addrword"] + 4 * u["reverse"]
pred_mixed = args_mixed + 12 * ASM_WORD + enc_mixed + keccak(384)
meas_mixed = ROWS["probe-hashing/h_asm_384_mixed"]
print(f"  h_asm_384_mixed  predicted {pred_mixed:>9,.0f}  measured {meas_mixed:>9,}  "
      f"err {meas_mixed - pred_mixed:>+7,.0f} ({(meas_mixed - pred_mixed) / meas_mixed:+.2%})")
# bytes32LexicographicLt: four 16-byte reversals of sliced halves
pred_lex = 4 * u["reverse"]
meas_lex = ROWS["probe-plumbing/p_lexlt"] - ROWS["probe-plumbing/p_ctl_n2"]
print(f"  p_lexlt          predicted {pred_lex:>9,.0f}  measured {meas_lex:>9,}  "
      f"err {meas_lex - pred_lex:>+7,.0f} ({(meas_lex - pred_lex) / meas_lex:+.2%})")
# product circuit: shieldedAccountBalance = 2 args + persistentHash<V3> + guarded map read
pred_sab = (FRAME + 2 * ARG32) + (ROWS["probe-hashing/h_ph_v3"] - ROWS["probe-hashing/h_ctl_a3"]) \
    + (ROWS["probe-state/s_map_lookup"] - ROWS["probe-state/s_ctl_kj"])
meas_sab = ROWS["w0-baseline/shieldedAccountBalance"]
print(f"  shieldedAccountBalance (product) predicted {pred_sab:>9,.0f}  measured {meas_sab:>9,}  "
      f"err {meas_sab - pred_sab:>+7,.0f} ({(meas_sab - pred_sab) / meas_sab:+.2%})")
# product circuit: depositUnshielded = 2 unshieldedKey derivations + guarded read + receive + insert
pred_du = (FRAME + 3 * ARG32) + 2 * (ROWS["probe-hashing/h_ph_v3"] - ROWS["probe-hashing/h_ctl_a3"]) \
    + (ROWS["probe-state/s_map_lookup"] - ROWS["probe-state/s_ctl_kj"]) \
    + (ROWS["probe-state/s_receive_unshielded"] - ROWS["probe-state/s_ctl_kjv"]) \
    + (ROWS["probe-state/s_map_insert"] - ROWS["probe-state/s_ctl_kjv"]) \
    + (ROWS["probe-state/s_set_insert"] - ROWS["probe-state/s_ctl_kj"])
meas_du = ROWS["w0-baseline/depositUnshielded"]
print(f"  depositUnshielded (product)      predicted {pred_du:>9,.0f}  measured {meas_du:>9,}  "
      f"err {meas_du - pred_du:>+7,.0f} ({(meas_du - pred_du) / meas_du:+.2%})")
