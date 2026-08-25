#!/usr/bin/env python3
"""Generate the 00009 Phase 2 optimization arms (o1..o7) from the product Manager.

Two classes:
  SEMANTICS-PRESERVING (o1, o2, o3) — no frozen byte changes. The EIP-712 digest bytes, the
    FR-031 semantic commitment bytes, the FR-204 guard order, the refusal set and the nine-circuit
    provable surface are all preserved; only the number of compiled COPIES of each operation
    changes.
  SPEC-CHANGE (o4, o5, o6, o7) — deliberately alter frozen bytes. Measured and priced only;
    never promotable from this project (FR-906).

Every patch is anchored on an exact unique substring of the product source, so drift fails loudly.

MEASUREMENT-ONLY. None of these sources may ship, be proved, or be deployed.
"""
import hashlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PRODUCT = ROOT / "contracts" / "manager.compact"
VARIANTS = ROOT / "contracts" / "variants"
PRODUCT_SHA = "85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858"


def sub(src: str, anchor: str, replacement: str, tag: str) -> str:
    if src.count(anchor) != 1:
        raise SystemExit(f"{tag}: anchor is not unique ({src.count(anchor)} matches)")
    return src.replace(anchor, replacement)


# ---------------------------------------------------------------------------------------------
# o1 — brief Step 2a: the EIP-712 domain separator is a per-deployment constant. Compute it once
# in the constructor, store it in a ledger cell, read it in `execute`. Removes the keccak<32> +
# keccak<160> pair (3 keccak-f permutations) from every `execute` proof.
#
# Digest bytes are UNCHANGED: the constructor hashes exactly `evmDomainSeparatorFor(kernel.self()
# .bytes, domain)`, which is the same value `execute` computes today.
# ---------------------------------------------------------------------------------------------
def patch_o1(src: str) -> str:
    src = sub(
        src,
        "  evmNonces,\n  deploymentDomain\n}\n",
        "  evmNonces,\n  deploymentDomain,\n  evmDomainSeparator\n}\n",
        "o1/exports",
    )
    src = sub(
        src,
        "/// Fresh-deployment EIP-712 salt. No circuit writes it after construction.\n"
        "export ledger deploymentDomain: Bytes<32>;\n",
        "/// Fresh-deployment EIP-712 salt. No circuit writes it after construction.\n"
        "export ledger deploymentDomain: Bytes<32>;\n"
        "\n"
        "/// 00009 o1: the EIP-712 domain separator, a PER-DEPLOYMENT CONSTANT, precomputed in the\n"
        "/// constructor so `execute` reads it instead of recomputing two keccak hashes per proof.\n"
        "/// No circuit writes it after construction.\n"
        "export ledger evmDomainSeparator: Bytes<32>;\n",
        "o1/ledger",
    )
    src = sub(
        src,
        "  assert(domain != default<Bytes<32>>, \"deployment domain must be nonzero\");\n"
        "  deploymentDomain = domain;\n",
        "  assert(domain != default<Bytes<32>>, \"deployment domain must be nonzero\");\n"
        "  deploymentDomain = domain;\n"
        "  // 00009 o1: hash the domain separator ONCE, at construction. This is the arm's viability\n"
        "  // probe: it requires `kernel.self()` to be usable in a constructor on the pinned compiler.\n"
        "  evmDomainSeparator = evmDomainSeparatorFor(kernel.self().bytes, domain);\n",
        "o1/constructor",
    )
    src = sub(
        src,
        "  const digest = p.selector == 0\n"
        "    ? default<Bytes<32>>\n"
        "    : evmDigestFor(manager, deploymentDomain, p);\n",
        "  // 00009 o1: read the precomputed domain separator instead of recomputing it. The digest\n"
        "  // bytes are identical — this is exactly what `evmDigestFor` would have hashed.\n"
        "  const digest = p.selector == 0\n"
        "    ? default<Bytes<32>>\n"
        "    : disclose(eip712Digest(evmDomainSeparator, evmStructHashFor(manager, p)));\n",
        "o1/execute",
    )
    return src


# ---------------------------------------------------------------------------------------------
# o2 — brief Step 3: ONE debit leg, ONE credit leg, muxed arguments.
#
# The five-way custody dispatch compiles a full copy of every helper it names, per branch. Today
# that is 21 `persistentHash` (SHA-256) key derivations, two `sendShielded` copies, and duplicated
# pool guards. Muxing the ARGUMENTS instead of the CALLS leaves 2 key derivations and one copy of
# each effectful operation.
# ---------------------------------------------------------------------------------------------
O2_HELPERS = '''// --- 00009 o2 — ONE debit leg, ONE credit leg, muxed arguments ---------------------------------
//
// Compact compiles every branch of every `if`, so the five-way custody dispatch emits a full copy
// of each helper per branch: 21 `persistentHash` key derivations, two `sendShielded` sites and
// duplicated pool guards. The rewrite below muxes the ARGUMENTS and calls each expensive operation
// exactly once (2 key derivations, one shielded send, one unshielded send, one want-claim).
//
// WHAT IS PRESERVED, and why this stays SEMANTICS-PRESERVING:
//
//   * FR-204 order, for EVERY selector: the per-(account, colour) guard is evaluated BEFORE any
//     pool or contract-holdings guard, and every guard precedes every write. The assert sequence
//     below is a TOPOLOGICAL SUPERSET of all five per-selector orders — swap sanity, then transfer
//     destination checks, then the per-(account, colour) guard, then the pool guard, then the swap
//     credit target — so no selector's relative assert order changes.
//   * The refusal set and every assert MESSAGE are unchanged.
//   * A missing balance cell still reads 0 and creates nothing.
//   * The nine-circuit provable surface is unchanged; no circuit is added.
//
// The only asserts not carried over are the three recipient-kind asserts inside `shieldedRecipient`
// / `unshieldedRecipient` / `swapRecipient`. Those are already UNREACHABLE in the product:
// `assertActionEnvelope` constrains `recipientKind <= 1` for selectors 2/3 and `<= 2` for
// selector 6 before dispatch is reached, so no payload can arrive at them. Dropping unreachable
// asserts leaves the refusal set identical.
//
// The product's five leg circuits are left in the file, unused. They are private and now uncalled,
// so the compiler emits no constraints for them; keeping them makes the diff against the product
// legible.

/// Balance at an ALREADY-DERIVED key. A missing cell reads 0 (FR-204, FR-206), exactly as
/// `shieldedBalanceOf` does — the only difference is that the key is computed by the caller, once.
circuit shieldedBalanceAt(k: Bytes<32>): Uint<128> {
  return shieldedBalances.member(k) ? shieldedBalances.lookup(k) : 0;
}

circuit unshieldedBalanceAt(k: Bytes<32>): Uint<128> {
  return unshieldedBalances.member(k) ? unshieldedBalances.lookup(k) : 0;
}

/// The whole custody dispatch for selectors 2..6, with one copy of every expensive operation.
circuit custodyDispatch(p: ExecutePayload, account: Bytes<32>): [] {
  const isWithdrawShielded   = p.selector == 2;
  const isWithdrawUnshielded = p.selector == 3;
  const isTransferShielded   = p.selector == 4;
  const isTransferUnshielded = p.selector == 5;
  const isSwap               = p.selector == 6;
  const isTransfer           = isTransferShielded || isTransferUnshielded;

  // Family muxing: shielded custody is selectors 2, 4, 6; unshielded is 3, 5.
  const debitShielded  = isWithdrawShielded || isTransferShielded || isSwap;
  const creditShielded = isTransferShielded || isSwap;
  const hasCredit      = isTransfer || isSwap;
  // Only the shielded PAYOUT paths touch the pooled coin; an internal shielded transfer does not.
  const needsPool      = isWithdrawShielded || isSwap;

  const col = p.primaryColor;
  const val = p.primaryAmount;
  const creditAcct   = isSwap ? p.creditAccount : p.toAccount;
  const creditColour = isSwap ? p.wantColor : col;

  // --- 0. swap parameter sanity (the other selectors' sanity lives in `assertActionEnvelope`) ---
  assert(!isSwap || val > 0,            "swap must give a positive amount");
  assert(!isSwap || p.wantAmount > 0,   "swap must want a positive amount");
  assert(!isSwap || col != p.wantColor, "swap legs must be different colours");

  // --- 1. internal-transfer destination checks (selectors 4/5), in their product order ---
  assert(!isTransfer || accounts.member(p.toAccount), "destination account is not registered");
  assert(!isTransfer || account != p.toAccount,       "internal transfer to the same account");
  assert(!isTransfer || val > 0,                      "internal transfer must be positive");

  // --- 2. THE PER-(ACCOUNT, COLOUR) GUARD, before any pool guard, missing cell reads 0 (FR-204) ---
  //     ONE key derivation for all five selectors; the family tag is the muxed argument.
  const debitKey = persistentHash<Vector<3, Bytes<32>>>(
    [account, col, debitShielded ? shieldedFamilyTag() : unshieldedFamilyTag()]);
  const debitBalance = debitShielded ? shieldedBalanceAt(debitKey) : unshieldedBalanceAt(debitKey);
  assert(debitBalance >= val, "account colour balance too low");

  // --- 3. only now, the pool guard and the shielded give leg (selectors 2 and 6) ---
  if (needsPool) {
    assert(pools.member(col), "no pooled coin for this colour");
    const pooled = pools.lookup(col);
    assert(pooled.value >= val, "pooled colour balance too low");

    // --- 4. the swap credit target, at its product position: after the pool guard ---
    assert(!isSwap || accounts.member(p.creditAccount), "credit account is not registered");

    if (isWithdrawShielded || p.recipientKind != 0) {
      // ONE `sendShielded`, shared by the withdrawal and the named-swap shape. The recipient
      // discriminant is the muxed argument: a withdrawal uses kind 0 = user key / 1 = contract,
      // a named swap uses kind 1 = user key / 2 = contract.
      const useLeft = isWithdrawShielded ? (p.recipientKind == 0) : (p.recipientKind == 1);
      const rcpt = useLeft
        ? left<ZswapCoinPublicKey, ContractAddress>(ZswapCoinPublicKey{ bytes: p.recipient })
        : right<ZswapCoinPublicKey, ContractAddress>(ContractAddress{ bytes: p.recipient });
      const result = sendShielded(pooled, rcpt, val);
      repoolOrRemove(col, result.change);
    } else {
      // The FR-308 v2(a) OPEN shape: the pooled coin is consumed as a zswap input and its
      // nullifier claimed, but the only output created is the change back to this contract.
      const selfAddr = kernel.self();
      createZswapInput(pooled);
      kernel.claimZswapNullifier(zswapCoinNullifier(dropMerkleIndex(pooled), selfAddr));
      const changeValue = (pooled.value - val) as Uint<128>;
      if (changeValue == 0) {
        repoolOrRemove(col, none<ShieldedCoinInfo>());
      } else {
        const changeCoin = ShieldedCoinInfo{
          nonce: evolveNonce(2, pooled.nonce),
          color: col,
          value: changeValue
        };
        const selfRecipient = right<ZswapCoinPublicKey, ContractAddress>(selfAddr);
        createZswapOutput(changeCoin, selfRecipient);
        const cm = zswapCoinCommitment(changeCoin, selfRecipient);
        kernel.claimZswapCoinSpend(cm);
        kernel.claimZswapCoinReceive(cm);
        repoolOrRemove(col, some<ShieldedCoinInfo>(changeCoin));
      }
    }
  }

  // --- the unshielded give leg (selector 3): account guard above, then contract holdings ---
  if (isWithdrawUnshielded) {
    assert(unshieldedBalanceGte(col, val), "contract unshielded balance too low");
    sendUnshielded(col, val, p.recipientKind == 0
      ? left<ContractAddress, UserAddress>(ContractAddress{ bytes: p.recipient })
      : right<ContractAddress, UserAddress>(UserAddress{ bytes: p.recipient }));
  }

  // --- ONE debit write, into the muxed family, at the same point in the order as the product ---
  const newDebit = (debitBalance - val) as Uint<128>;
  if (debitShielded) {
    shieldedBalances.insert(debitKey, newDebit);
  } else {
    unshieldedBalances.insert(debitKey, newDebit);
  }

  // --- the swap WANT leg: claim `coinB` into custody (this is what makes the offer unbalanced) ---
  if (isSwap) {
    const wantCoin = ShieldedCoinInfo{
      nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount
    };
    receiveShielded(wantCoin);
    if (pools.member(p.wantColor)) {
      pools.insertCoin(
        p.wantColor,
        mergeCoinImmediate(pools.lookup(p.wantColor), wantCoin),
        right<ZswapCoinPublicKey, ContractAddress>(kernel.self()));
    } else {
      pools.insertCoin(
        p.wantColor, wantCoin, right<ZswapCoinPublicKey, ContractAddress>(kernel.self()));
    }
  }

  // --- ONE credit write (selectors 4, 5, 6), key derived once with the family muxed ---
  if (hasCredit) {
    const creditKey = persistentHash<Vector<3, Bytes<32>>>(
      [creditAcct, creditColour, creditShielded ? shieldedFamilyTag() : unshieldedFamilyTag()]);
    const creditValue = (isSwap ? p.wantAmount : val) as Uint<128>;
    if (creditShielded) {
      shieldedBalances.insert(
        creditKey, (shieldedBalanceAt(creditKey) + creditValue) as Uint<128>);
    } else {
      unshieldedBalances.insert(
        creditKey, (unshieldedBalanceAt(creditKey) + creditValue) as Uint<128>);
    }
  }
}

'''

O2_DISPATCH_OLD = """  if (!isRegistration) {
    if (p.selector == 2) {
      withdrawShielded(account, p.primaryColor, p.primaryAmount, shieldedRecipient(p.recipientKind, p.recipient));
    } else if (p.selector == 3) {
      withdrawUnshielded(account, p.primaryColor, p.primaryAmount, unshieldedRecipient(p.recipientKind, p.recipient));
    } else if (p.selector == 4) {
      transferInternalShielded(account, p.toAccount, p.primaryColor, p.primaryAmount);
    } else if (p.selector == 5) {
      transferInternalUnshielded(account, p.toAccount, p.primaryColor, p.primaryAmount);
    } else {
      openSwapShielded(
        account,
        p.primaryColor,
        p.primaryAmount,
        swapRecipient(p.recipientKind, p.recipient),
        ShieldedCoinInfo{ nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount },
        p.creditAccount
      );
    }
  }
"""

O2_DISPATCH_NEW = """  if (!isRegistration) {
    // 00009 o2: one muxed dispatch replaces the five-way branch. See `custodyDispatch`.
    custodyDispatch(p, account);
  }
"""


def patch_o2(src: str) -> str:
    src = sub(
        src,
        "// --- FR-031 authoritative semantic commitment -------------------------------------------------\n",
        O2_HELPERS
        + "// --- FR-031 authoritative semantic commitment -------------------------------------------------\n",
        "o2/helpers",
    )
    src = sub(src, O2_DISPATCH_OLD, O2_DISPATCH_NEW, "o2/dispatch")
    return src


# ---------------------------------------------------------------------------------------------
# o4 — brief Step 2b (SPEC-CHANGE): ONE EIP-712 struct type over the whole envelope.
#
# `evmStructHashFor` compiles four preimage widths today (192/320/288/448 bytes = 2+3+3+4 = 12
# keccak-f permutations). Keccak of a shorter message is not keccak of the zero-padded longer one,
# so the four cannot be merged without ONE type covering every field: 16 words = 512 bytes = 4
# permutations.
#
# `manager` is deliberately NOT in the unified preimage: the EIP-712 domain separator already binds
# the contract alias (`evmDomainSeparatorFor` hashes `addressWord(alias)` derived from it), so the
# struct-level copy is redundant. Dropping it is what brings 17 words (544 B, 5 perms) down to 16
# words (512 B, 4 perms).
#
# ALTERED FROZEN SURFACE: the wallet-signed bytes. Every signer, fixture and batcher codec changes,
# and historical signatures stop verifying.
# ---------------------------------------------------------------------------------------------
O4_OLD = """export circuit evmStructHashFor(manager: Bytes<32>, payload: ExecutePayload): Bytes<32> {
  const p = payload;
  if (p.selector == 1) {
    const preimage: Bytes<192> = slice<192>([
      ...registerType(), ...manager, ...p.account, ...addressWord(p.owner), ...p.accountSalt,
      ...uint64Word(p.validUntil)
    ], 0) as Bytes<192>;
    return disclose(keccak256<Bytes<192>>(preimage));
  }
  if (p.selector == 2 || p.selector == 3) {
    const typeHash = p.selector == 2 ? withdrawShieldedType() : withdrawUnshieldedType();
    const preimage: Bytes<320> = slice<320>([
      ...typeHash, ...manager, ...p.account, ...addressWord(p.owner), ...uint64Word(p.nonce),
      ...uint64Word(p.validUntil), ...p.primaryColor, ...uint128Word(p.primaryAmount),
      ...uint8Word(p.recipientKind), ...p.recipient
    ], 0) as Bytes<320>;
    return disclose(keccak256<Bytes<320>>(preimage));
  }
  if (p.selector == 4 || p.selector == 5) {
    const typeHash = p.selector == 4 ? transferShieldedType() : transferUnshieldedType();
    const preimage: Bytes<288> = slice<288>([
      ...typeHash, ...manager, ...p.account, ...addressWord(p.owner), ...uint64Word(p.nonce),
      ...uint64Word(p.validUntil), ...p.toAccount, ...p.primaryColor, ...uint128Word(p.primaryAmount)
    ], 0) as Bytes<288>;
    return disclose(keccak256<Bytes<288>>(preimage));
  }
  assert(p.selector == 6, "EIP-712 selector must be 1..6");
  const preimage: Bytes<448> = slice<448>([
    ...openSwapType(), ...manager, ...p.account, ...addressWord(p.owner), ...uint64Word(p.nonce),
    ...uint64Word(p.validUntil), ...p.primaryColor, ...uint128Word(p.primaryAmount),
    ...uint8Word(p.recipientKind), ...p.recipient, ...p.wantNonce, ...p.wantColor,
    ...uint128Word(p.wantAmount), ...p.creditAccount
  ], 0) as Bytes<448>;
  return disclose(keccak256<Bytes<448>>(preimage));
}
"""

O4_NEW = '''/// 00009 o4 SPEC-CHANGE: the ONE unified EIP-712 struct type hash. In a real amendment this is
/// `keccak256("Execute(uint8 selector,bytes32 account,address owner,bytes32 accountSalt,`
/// `uint64 nonce,uint64 validUntil,bytes32 primaryColor,uint128 primaryAmount,uint8 recipientKind,`
/// `bytes32 recipient,bytes32 toAccount,bytes32 wantNonce,bytes32 wantColor,uint128 wantAmount,`
/// `bytes32 creditAccount)"`. The exact constant is a PLACEHOLDER here: this arm measures ROWS, and
/// every 32-byte constant costs exactly the same number of them.
circuit unifiedExecuteType(): Bytes<32> {
  return Bytes[0x00, 0x00, 0x09, 0x04, 0x75, 0x6e, 0x69, 0x66,
               0x69, 0x65, 0x64, 0x2d, 0x65, 0x78, 0x65, 0x63,
               0x75, 0x74, 0x65, 0x2d, 0x74, 0x79, 0x70, 0x65,
               0x2d, 0x70, 0x6c, 0x61, 0x63, 0x65, 0x68, 0x6f];
}

/// 00009 o4 SPEC-CHANGE — ALTERS THE WALLET-SIGNED BYTES.
///
/// One struct type over the whole envelope: one 512-byte preimage (4 keccak-f permutations)
/// instead of four preimage widths (192/320/288/448 = 12 permutations). `selector` is a signed
/// field now that the type hash no longer varies with it, and `manager` is omitted because the
/// domain separator already binds the contract alias.
export circuit evmStructHashFor(manager: Bytes<32>, payload: ExecutePayload): Bytes<32> {
  const p = payload;
  assert(p.selector >= 1 && p.selector <= 6, "EIP-712 selector must be 1..6");
  const preimage: Bytes<512> = slice<512>([
    ...unifiedExecuteType(), ...uint8Word(p.selector), ...p.account, ...addressWord(p.owner),
    ...p.accountSalt, ...uint64Word(p.nonce), ...uint64Word(p.validUntil), ...p.primaryColor,
    ...uint128Word(p.primaryAmount), ...uint8Word(p.recipientKind), ...p.recipient,
    ...p.toAccount, ...p.wantNonce, ...p.wantColor, ...uint128Word(p.wantAmount),
    ...p.creditAccount
  ], 0) as Bytes<512>;
  return disclose(keccak256<Bytes<512>>(preimage));
}
'''


def patch_o4(src: str) -> str:
    return sub(src, O4_OLD, O4_NEW, "o4/structhash")


# ---------------------------------------------------------------------------------------------
# o5 — SPEC-CHANGE: the FR-031 semantic commitment over a SNARK-friendly hash.
#
# The commitment chain is three keccak hashes: keccak<1024> (8 perms) + keccak<256> (2) +
# keccak<384> (3) = 13 permutations, measured at roughly a third of the whole circuit. Swapping
# them for `persistentHash` over the same field words removes all 13.
#
# ALTERED FROZEN SURFACE: the emitted event bytes. Off-chain readers recompute the commitment, and
# EVM-side pure-keccak recomputability is LOST entirely.
# ---------------------------------------------------------------------------------------------
def patch_o5(src: str) -> str:
    src = sub(
        src,
        """circuit actionUnionHash(p: ExecutePayload): Bytes<32> {
  const preimage: Bytes<384> = slice<384>([
    ...addressWord(p.owner), ...uint64Word(p.validUntil), ...p.accountSalt,
    ...p.primaryColor, ...uint128Word(p.primaryAmount), ...uint8Word(p.recipientKind),
    ...p.recipient, ...p.toAccount, ...p.wantNonce, ...p.wantColor,
    ...uint128Word(p.wantAmount), ...p.creditAccount
  ], 0) as Bytes<384>;
  return keccak256<Bytes<384>>(preimage);
}
""",
        """/// 00009 o5 SPEC-CHANGE: same 12 field words, SNARK-friendly hash (was keccak<384>, 3 perms).
circuit actionUnionHash(p: ExecutePayload): Bytes<32> {
  return persistentHash<Vector<12, Bytes<32>>>([
    addressWord(p.owner), uint64Word(p.validUntil), p.accountSalt,
    p.primaryColor, uint128Word(p.primaryAmount), uint8Word(p.recipientKind),
    p.recipient, p.toAccount, p.wantNonce, p.wantColor,
    uint128Word(p.wantAmount), p.creditAccount
  ]);
}
""",
        "o5/union",
    )
    src = sub(
        src,
        """  const preimage: Bytes<256> = slice<256>([
    ...callTranscriptTag(), ...manager, ...entrypointHash(), ...uint8Word(p.selector),
    ...frozenTypeHash(p.selector), ...account, ...authResult, ...actionUnionHash(p)
  ], 0) as Bytes<256>;
  return keccak256<Bytes<256>>(preimage);
""",
        """  // 00009 o5 SPEC-CHANGE: same 8 words, SNARK-friendly hash (was keccak<256>, 2 perms).
  return persistentHash<Vector<8, Bytes<32>>>([
    callTranscriptTag(), manager, entrypointHash(), uint8Word(p.selector),
    frozenTypeHash(p.selector), account, authResult, actionUnionHash(p)
  ]);
""",
        "o5/transcript",
    )
    src = sub(
        src,
        """  const preimage: Bytes<1024> = slice<1024>([
    ...semanticTag(), ...manager, ...domain, ...entrypointHash(), ...uint8Word(p.selector),
    ...frozenTypeHash(p.selector), ...account, ...uint8Word(p.authMode), ...authResult,
    ...uint64Word(semanticNonce), ...addressWord(p.owner), ...uint64Word(p.validUntil),
    ...p.accountSalt, ...p.primaryColor, ...uint128Word(p.primaryAmount),
    ...uint8Word(p.recipientKind), ...p.recipient, ...p.toAccount, ...p.wantNonce,
    ...p.wantColor, ...uint128Word(p.wantAmount), ...p.creditAccount, ...callHash,
    ...uint8Word(imbalanceCount),
    ...uint8Word(family0), ...color0, ...uint8Word(direction0), ...uint128Word(amount0),
    ...uint8Word(family1), ...color1, ...uint8Word(direction1), ...uint128Word(amount1)
  ], 0) as Bytes<1024>;
  return keccak256<Bytes<1024>>(preimage);
""",
        """  // 00009 o5 SPEC-CHANGE: the same 32 field words, SNARK-friendly hash (was keccak<1024>,
  // 8 perms — the single heaviest item in the circuit).
  return persistentHash<Vector<32, Bytes<32>>>([
    semanticTag(), manager, domain, entrypointHash(), uint8Word(p.selector),
    frozenTypeHash(p.selector), account, uint8Word(p.authMode), authResult,
    uint64Word(semanticNonce), addressWord(p.owner), uint64Word(p.validUntil),
    p.accountSalt, p.primaryColor, uint128Word(p.primaryAmount),
    uint8Word(p.recipientKind), p.recipient, p.toAccount, p.wantNonce,
    p.wantColor, uint128Word(p.wantAmount), p.creditAccount, callHash,
    uint8Word(imbalanceCount),
    uint8Word(family0), color0, uint8Word(direction0), uint128Word(amount0),
    uint8Word(family1), color1, uint8Word(direction1), uint128Word(amount1)
  ]);
""",
        "o5/commitment",
    )
    return src


# ---------------------------------------------------------------------------------------------
# o6 — SPEC-CHANGE: keep keccak, hash a COMPACT preimage.
#
# Sixteen of the outer preimage's 32 words are already committed through `callHash` (which covers
# selector, type hash, account, authResult and `actionUnionHash`, and that in turn covers owner,
# validUntil, accountSalt, primaryColor, primaryAmount, recipientKind, recipient, toAccount,
# wantNonce, wantColor, wantAmount, creditAccount). Dropping the duplicated half leaves the 16
# words that are genuinely new at this level: 512 bytes = 4 permutations instead of 8. The
# commitment still binds every field, and it is still pure keccak, so EVM-side recomputation
# survives.
#
# ALTERED FROZEN SURFACE: the emitted event bytes (readers and fixtures change; the recipe stays
# keccak-only).
# ---------------------------------------------------------------------------------------------
def patch_o6(src: str) -> str:
    return sub(
        src,
        """  const preimage: Bytes<1024> = slice<1024>([
    ...semanticTag(), ...manager, ...domain, ...entrypointHash(), ...uint8Word(p.selector),
    ...frozenTypeHash(p.selector), ...account, ...uint8Word(p.authMode), ...authResult,
    ...uint64Word(semanticNonce), ...addressWord(p.owner), ...uint64Word(p.validUntil),
    ...p.accountSalt, ...p.primaryColor, ...uint128Word(p.primaryAmount),
    ...uint8Word(p.recipientKind), ...p.recipient, ...p.toAccount, ...p.wantNonce,
    ...p.wantColor, ...uint128Word(p.wantAmount), ...p.creditAccount, ...callHash,
    ...uint8Word(imbalanceCount),
    ...uint8Word(family0), ...color0, ...uint8Word(direction0), ...uint128Word(amount0),
    ...uint8Word(family1), ...color1, ...uint8Word(direction1), ...uint128Word(amount1)
  ], 0) as Bytes<1024>;
  return keccak256<Bytes<1024>>(preimage);
""",
        """  // 00009 o6 SPEC-CHANGE: hash only the words that are NOT already inside `callHash`.
  // Dropped here because `callHash` (via `actionUnionHash`) already commits to them: selector,
  // frozen type hash, account, authResult, owner, validUntil, accountSalt, primaryColor,
  // primaryAmount, recipientKind, recipient, toAccount, wantNonce, wantColor, wantAmount,
  // creditAccount. 16 words = 512 bytes = 4 keccak-f permutations, down from 1024 bytes = 8.
  const preimage: Bytes<512> = slice<512>([
    ...semanticTag(), ...manager, ...domain, ...entrypointHash(),
    ...uint8Word(p.authMode), ...uint64Word(semanticNonce), ...callHash,
    ...uint8Word(imbalanceCount),
    ...uint8Word(family0), ...color0, ...uint8Word(direction0), ...uint128Word(amount0),
    ...uint8Word(family1), ...color1, ...uint8Word(direction1), ...uint128Word(amount1)
  ], 0) as Bytes<512>;
  return keccak256<Bytes<512>>(preimage);
""",
        "o6/commitment",
    )


HEADERS = {
    "o1-domain-sep-ledger": (
        "SEMANTICS-PRESERVING",
        "Brief Step 2a — the EIP-712 domain separator is a per-deployment constant: hash it once in\n"
        "// the constructor, store it in a ledger cell, read it in `execute`. Removes keccak<32> +\n"
        "// keccak<160> (3 keccak-f permutations) from every proof. Digest BYTES are unchanged.\n"
        "//\n"
        "// CAVEAT recorded in the results: this adds a ledger cell, so the deployed STATE LAYOUT\n"
        "// changes even though no frozen hash byte does. Promotion would need a fresh deployment.",
        None,
    ),
    "o2-custody-mux": (
        "SEMANTICS-PRESERVING",
        "Brief Step 3 — one debit leg, one credit leg, one shielded send, one unshielded send, one\n"
        "// want-claim, with the family/recipient/account/colour muxed as ARGUMENTS. FR-204 guard\n"
        "// order, the refusal set, the assert messages and the nine-circuit surface are preserved.",
        None,
    ),
    "o3-combo-conservative": (
        "SEMANTICS-PRESERVING",
        "o1 + o2 composed — the best K reachable with NO spec change.",
        None,
    ),
    "o4-unified-eip712": (
        "SPEC-CHANGE",
        "Brief Step 2b — ONE EIP-712 struct type over the whole envelope: one 512-byte preimage\n"
        "// (4 keccak-f permutations) instead of four widths (192/320/288/448 = 12).",
        "the WALLET-SIGNED BYTES (EIP-712 typed data). Every signer, fixture and batcher codec\n"
        "// changes; historical signatures stop verifying.",
    ),
    "o5-semantic-snark-hash": (
        "SPEC-CHANGE",
        "The FR-031 semantic commitment (and its transcript/union sub-hashes) computed with the\n"
        "// SNARK-friendly `persistentHash` instead of keccak256 — removes all 13 keccak-f\n"
        "// permutations of the commitment chain.",
        "the EMITTED EVENT BYTES. Off-chain readers recompute the commitment, and EVM-side\n"
        "// pure-keccak recomputability is LOST entirely.",
    ),
    "o6-semantic-slim-preimage": (
        "SPEC-CHANGE",
        "The FR-031 semantic commitment over a COMPACT preimage: keep keccak, but hash only the 16\n"
        "// words not already committed through `callHash` — 512 bytes (4 perms) instead of 1024 (8).",
        "the EMITTED EVENT BYTES. Readers and fixtures change, but the recipe stays keccak-only,\n"
        "// so EVM-side recomputation survives.",
    ),
    "o7-combo-max": (
        "SPEC-CHANGE",
        "o1 + o2 + o4 + the better-performing semantic arm composed — the lowest K this project can\n"
        "// demonstrate.",
        "BOTH the wallet-signed bytes (o4) and the emitted event bytes. See the component arms.",
    ),
}


def header(arm: str) -> str:
    cls, what, surface = HEADERS[arm]
    out = (
        f"// 00009 MEASUREMENT-ONLY OPTIMIZATION ARM `{arm}` — {cls} — NOT A SHIPPING CONTRACT.\n"
        f"//\n"
        f"// {what}\n"
        f"//\n"
    )
    if surface is not None:
        out += (
            f"// !!! SPEC-CHANGE. THIS ARM ALTERS A FROZEN SURFACE: {surface}\n"
            f"// It is measured and priced ONLY. It is NOT promotable from this project (FR-906) and\n"
            f"// must never be represented as such.\n"
            f"//\n"
        )
    out += (
        "// Measured with `compactc --skip-zk` + `zkir-v3 mock-compile`. Never proved, never deployed,\n"
        "// never promoted into contracts/manager.compact.\n"
        "//\n"
    )
    return out


def build(arm: str, src: str, semantic_choice: str = "o5") -> str:
    if arm == "o1-domain-sep-ledger":
        out = patch_o1(src)
    elif arm == "o2-custody-mux":
        out = patch_o2(src)
    elif arm == "o3-combo-conservative":
        out = patch_o2(patch_o1(src))
    elif arm == "o4-unified-eip712":
        out = patch_o4(src)
    elif arm == "o5-semantic-snark-hash":
        out = patch_o5(src)
    elif arm == "o6-semantic-slim-preimage":
        out = patch_o6(src)
    elif arm == "o7-combo-max":
        out = patch_o4(patch_o2(patch_o1(src)))
        out = patch_o5(out) if semantic_choice == "o5" else patch_o6(out)
    else:
        raise SystemExit(f"unknown arm {arm}")
    head, rest = out.split("\n", 1)
    return head + "\n" + header(arm) + rest


def main(argv: list[str]) -> int:
    src = PRODUCT.read_text()
    got = hashlib.sha256(src.encode()).hexdigest()
    if got != PRODUCT_SHA:
        print(f"product Manager drifted: {got} != {PRODUCT_SHA}", file=sys.stderr)
        return 2

    semantic_choice = "o5"
    arms = []
    for a in argv:
        if a.startswith("--o7-semantic="):
            semantic_choice = a.split("=", 1)[1]
        else:
            arms.append(a)
    if not arms:
        arms = list(HEADERS)

    VARIANTS.mkdir(parents=True, exist_ok=True)
    for arm in arms:
        out = build(arm, src, semantic_choice)
        path = VARIANTS / f"{arm}.compact"
        path.write_text(out)
        print(f"{arm} {hashlib.sha256(out.encode()).hexdigest()} {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
