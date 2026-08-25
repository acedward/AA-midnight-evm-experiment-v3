#!/usr/bin/env python3
"""Generate the 00009 Phase 4.3 NESTED ablation arms (d01..d30) from the product Manager.

Phase 1's w-arms attribute rows to whole components (the semantic commitment, the EIP-712 chain,
custody). The d-arms go one level down: each one removes exactly ONE SUB-PART of one of those
components, so the component's rows can be split between its own pieces.

Same discipline as `make-w-arms.py`: one conspicuous non-shipping header, exactly one minimal
anchored replacement per arm, and every anchor must match EXACTLY ONCE in the product source, so a
drifted source fails loudly instead of silently patching the wrong text.

TWO TRAPS these stubs are written around, both recorded findings of this project:
  * a CONSTANT-ZERO `Bytes<32>` folds to `Uint<0..1>` and then breaks the stdlib secp256k1 scalar
    multiply ("Internal error (please report)"), so every stub returns a RUNTIME value
    (a payload field or a parameter), never `default<Bytes<32>>` and never a literal;
  * a value nobody consumes is eliminated, so a stub must keep its consumers satisfiable or the
    measurement attributes more than the named sub-part.

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
        f"// 00009 MEASUREMENT-ONLY NESTED ABLATION ARM `{arm}` — NOT A SHIPPING CONTRACT.\n"
        f"//\n"
        f"// This source is DELIBERATELY BROKEN. It exists only so that\n"
        f"//   weight(sub-component) = rows(w0-baseline) - rows(this arm)\n"
        f"// can be measured with `compactc --skip-zk` + `zkir-v3 mock-compile`.\n"
        f"// Ablated sub-component: {what}\n"
        f"// It must never ship, never be promoted into contracts/manager.compact, never be\n"
        f"// proved, and never be deployed.\n"
        f"//\n"
    )


def note(tag: str, text: str, indent: str = "  ") -> str:
    lines = text.strip("\n").split("\n")
    return "".join(f"{indent}// 00009 {tag} ABLATION: {ln}\n" if i == 0
                   else f"{indent}// {ln}\n" for i, ln in enumerate(lines))


ARMS: dict = {}


def arm(name: str, what: str, anchor: str, replacement: str) -> None:
    ARMS[name] = (what, [(anchor, replacement)])


# ==================================================================================================
# GROUP D-SEM — the FR-031 semantic commitment chain (Phase 1 attributes 366,831 rows to it)
# ==================================================================================================

arm("d01-semantic-union-noop",
    "`actionUnionHash` — a 384-byte preimage spliced from 12 words (5 of them endianness-encoded) "
    "plus one keccak256",
    """circuit actionUnionHash(p: ExecutePayload): Bytes<32> {
  const preimage: Bytes<384> = slice<384>([
    ...addressWord(p.owner), ...uint64Word(p.validUntil), ...p.accountSalt,
    ...p.primaryColor, ...uint128Word(p.primaryAmount), ...uint8Word(p.recipientKind),
    ...p.recipient, ...p.toAccount, ...p.wantNonce, ...p.wantColor,
    ...uint128Word(p.wantAmount), ...p.creditAccount
  ], 0) as Bytes<384>;
  return keccak256<Bytes<384>>(preimage);
}""",
    "circuit actionUnionHash(p: ExecutePayload): Bytes<32> {\n"
    + note("d01",
           "return a payload field instead of hashing the action union. The caller\n"
           "(`semanticCallTranscriptHash`) still splices the returned word into its own preimage,\n"
           "so this arm removes the union's assembly + encoders + keccak and NOTHING else.")
    + "  return p.accountSalt;\n}")

arm("d02-semantic-transcript-noop",
    "`semanticCallTranscriptHash` — its own 256-byte / 8-word preimage AND the nested "
    "`actionUnionHash` it calls (so d02 STRICTLY CONTAINS d01)",
    """  const preimage: Bytes<256> = slice<256>([
    ...callTranscriptTag(), ...manager, ...entrypointHash(), ...uint8Word(p.selector),
    ...frozenTypeHash(p.selector), ...account, ...authResult, ...actionUnionHash(p)
  ], 0) as Bytes<256>;
  return keccak256<Bytes<256>>(preimage);""",
    note("d02",
         "return the auth result instead of the call transcript hash. `actionUnionHash` is only\n"
         "reachable from here, so it disappears too — Δ(d02) − Δ(d01) is the transcript's OWN cost.")
    + "  return authResult;")

arm("d03-semantic-final-noop",
    "`semanticCommitmentFromSlots` — the 1024-byte / 32-word final preimage and its keccak "
    "(and, transitively, the transcript and union: d03 STRICTLY CONTAINS d02)",
    """  const semanticNonce = p.authMode == 1 ? p.nonce : (0 as Uint<64>);
  const callHash = semanticCallTranscriptHash(manager, p, account, authResult);
  const preimage: Bytes<1024> = slice<1024>([
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
  return keccak256<Bytes<1024>>(preimage);""",
    note("d03",
         "return the account instead of the final commitment. Everything the 1024-byte preimage\n"
         "reaches — including the nested transcript and union hashes — goes with it, so\n"
         "Δ(d03) − Δ(d02) is the FINAL preimage's own assembly + keccak cost.")
    + "  return account;")

arm("d04-semantic-eventpayload-noop",
    "only the 256-byte `Misc` event payload assembly (the commitment itself is still computed and "
    "kept live by an assert, so nothing upstream is removed)",
    """  const eventPayload: Bytes<256> = slice<256>([
    ...commitment, ...default<Bytes<32>>, ...default<Bytes<32>>, ...default<Bytes<32>>,
    ...default<Bytes<32>>, ...default<Bytes<32>>, ...default<Bytes<32>>, ...default<Bytes<32>>
  ], 0) as Bytes<256>;
  emit(Misc { name: semanticEventName(), payload: eventPayload });""",
    note("d04",
         "emit a constant payload instead of splicing the commitment into it. The assert keeps\n"
         "the commitment LIVE, so the whole semantic chain above is still compiled and only the\n"
         "event-payload splice disappears.")
    + '  assert(commitment != default<Bytes<32>>, "00009 d04: keep the commitment live");\n'
    + "  emit(Misc { name: semanticEventName(), payload: pad(256, \"\") });")

arm("d05-semantic-lexlt-noop",
    "`bytes32LexicographicLt` — the open-swap imbalance ordering comparator "
    "(four 16-byte endianness reversals)",
    "  const giveBeforeWant = isOpenSwap && bytes32LexicographicLt(p.primaryColor, p.wantColor);",
    note("d05",
         "replace the lexicographic colour comparator with a plain inequality. Same Boolean type,\n"
         "same liveness for every downstream slot mux; only the four 16-byte reversals go away.")
    + "  const giveBeforeWant = isOpenSwap && p.primaryColor != p.wantColor;")

# ==================================================================================================
# GROUP D-EIP — the EIP-712 digest chain (Phase 1 attributes 310,805 rows to it)
# ==================================================================================================

arm("d06-eip712-domainsep-noop",
    "`evmDomainSeparatorFor` — keccak of the manager address, `addressWord` of the alias, a "
    "160-byte / 5-word preimage and its keccak",
    """  const alias = slice<20>(keccak256<Bytes<32>>(manager), 12);
  const preimage: Bytes<160> = slice<160>([
    ...domainType(), ...domainName(), ...domainVersion(), ...addressWord(alias), ...domain
  ], 0) as Bytes<160>;
  return disclose(keccak256<Bytes<160>>(preimage));""",
    note("d06",
         "return the manager word instead of the EIP-712 domain separator. Δ(d06) + Δ(d07) +\n"
         "Δ(d08) must reconcile against Phase 1's w3 (the whole chain, 310,805 rows).")
    + "  return disclose(manager);")

arm("d07-eip712-structhash-noop",
    "`evmStructHashFor` — ALL FOUR selector branches' preimages and keccaks",
    """  const p = payload;
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
  return disclose(keccak256<Bytes<448>>(preimage));""",
    note("d07",
         "return a payload field instead of any struct hash. All four branches go, so Δ(d07) is\n"
         "the whole struct-hash cost and Δ(d09..d12) must sum to it.")
    + "  const p = payload;\n  return disclose(p.account);")

arm("d08-eip712-digest-noop",
    "`eip712Digest` — the 66-byte `0x1901` preimage and its keccak",
    """  const preimage: Bytes<66> = slice<66>([0x19, 0x01, ...domain, ...structHash], 0) as Bytes<66>;
  return keccak256<Bytes<66>>(preimage);""",
    note("d08",
         "return the struct hash instead of the 0x1901 digest. The domain separator stays live\n"
         "through the assert below, so d08 removes only the final 66-byte splice and keccak.")
    + '  assert(domain != structHash, "00009 d08: keep the domain separator live");\n'
    + "  return structHash;")

arm("d09-eip712-struct-sel1-noop",
    "only `evmStructHashFor`'s selector-1 branch (192-byte / 6-word preimage, 2 keccak-f)",
    """    const preimage: Bytes<192> = slice<192>([
      ...registerType(), ...manager, ...p.account, ...addressWord(p.owner), ...p.accountSalt,
      ...uint64Word(p.validUntil)
    ], 0) as Bytes<192>;
    return disclose(keccak256<Bytes<192>>(preimage));""",
    note("d09", "this selector branch only; every other branch is untouched.", "    ")
    + "    return disclose(p.accountSalt);")

arm("d10-eip712-struct-sel23-noop",
    "only `evmStructHashFor`'s selector-2/3 branch (320-byte / 10-word preimage, 3 keccak-f)",
    """    const typeHash = p.selector == 2 ? withdrawShieldedType() : withdrawUnshieldedType();
    const preimage: Bytes<320> = slice<320>([
      ...typeHash, ...manager, ...p.account, ...addressWord(p.owner), ...uint64Word(p.nonce),
      ...uint64Word(p.validUntil), ...p.primaryColor, ...uint128Word(p.primaryAmount),
      ...uint8Word(p.recipientKind), ...p.recipient
    ], 0) as Bytes<320>;
    return disclose(keccak256<Bytes<320>>(preimage));""",
    note("d10", "this selector branch only; every other branch is untouched.", "    ")
    + "    return disclose(p.recipient);")

arm("d11-eip712-struct-sel45-noop",
    "only `evmStructHashFor`'s selector-4/5 branch (288-byte / 9-word preimage, 3 keccak-f)",
    """    const typeHash = p.selector == 4 ? transferShieldedType() : transferUnshieldedType();
    const preimage: Bytes<288> = slice<288>([
      ...typeHash, ...manager, ...p.account, ...addressWord(p.owner), ...uint64Word(p.nonce),
      ...uint64Word(p.validUntil), ...p.toAccount, ...p.primaryColor, ...uint128Word(p.primaryAmount)
    ], 0) as Bytes<288>;
    return disclose(keccak256<Bytes<288>>(preimage));""",
    note("d11", "this selector branch only; every other branch is untouched.", "    ")
    + "    return disclose(p.toAccount);")

arm("d12-eip712-struct-sel6-noop",
    "only `evmStructHashFor`'s selector-6 branch (448-byte / 14-word preimage, 4 keccak-f)",
    """  assert(p.selector == 6, "EIP-712 selector must be 1..6");
  const preimage: Bytes<448> = slice<448>([
    ...openSwapType(), ...manager, ...p.account, ...addressWord(p.owner), ...uint64Word(p.nonce),
    ...uint64Word(p.validUntil), ...p.primaryColor, ...uint128Word(p.primaryAmount),
    ...uint8Word(p.recipientKind), ...p.recipient, ...p.wantNonce, ...p.wantColor,
    ...uint128Word(p.wantAmount), ...p.creditAccount
  ], 0) as Bytes<448>;
  return disclose(keccak256<Bytes<448>>(preimage));""",
    '  assert(p.selector == 6, "EIP-712 selector must be 1..6");\n'
    + note("d12", "this selector branch only; every other branch is untouched.")
    + "  return disclose(p.wantNonce);")

arm("d13-evm-accountid-noop",
    "`evmAccountIdFor` — the 128-byte / 4-word account-id preimage, its `addressWord` and its keccak",
    """  const preimage: Bytes<128> = slice<128>([
    ...accountTag(), ...manager, ...addressWord(owner), ...salt
  ], 0) as Bytes<128>;
  return disclose(keccak256<Bytes<128>>(preimage));""",
    note("d13",
         "return the salt instead of the derived EVM account id. `execute`'s\n"
         "`evmRegistrationAccount == p.account` assert stays satisfiable, so nothing else changes.")
    + "  return disclose(salt);")

# ==================================================================================================
# GROUP D-SECP — splitting Phase 1's w1 (49,132 rows) into its two operations
# ==================================================================================================

arm("d14-ecdsa-verify-noop",
    "ONLY `secp256k1EcdsaVerify` (Ethereum address recovery is kept)",
    "  const signatureOk = disclose(secp256k1EcdsaVerify(digest, sig, pk));",
    note("d14", "signature verification only; `secp256k1EthereumAddress` below is untouched.")
    + "  const signatureOk = true;")

arm("d15-ecdsa-address-noop",
    "ONLY `secp256k1EthereumAddress` (signature verification is kept)",
    "  const signer = disclose(secp256k1EthereumAddress(pk));",
    note("d15", "address recovery only; `secp256k1EcdsaVerify` above is untouched.")
    + "  const signer = p.owner;")

# ==================================================================================================
# GROUP D-ENV — envelope validation, authorization, registration and nonce bookkeeping
# ==================================================================================================

arm("d16-envelope-noop",
    "the `assertActionEnvelope(p)` CALL SITE inside `execute` (the circuit itself is kept for the "
    "exported pure oracle)",
    """  const p = disclose(payload);
  assertActionEnvelope(p);
  const manager = kernel.self().bytes;""",
    "  const p = disclose(payload);\n"
    + note("d16",
           "drop the envelope-validation call. `assertActionEnvelope` is still defined and still\n"
           "reached by the exported pure `semanticCommitmentFor`, which compiles to no ZKIR, so\n"
           "this removes exactly the envelope constraints `execute` carries.")
    + "  const manager = kernel.self().bytes;")

arm("d17-deadline-noop",
    "`assertLiveDeadline` — the 3600-second horizon window and both block-time comparisons",
    """  if (isEvmAuthorized) {
    assertLiveDeadline(p.validUntil);
  }
""",
    note("d17", "drop the deadline window check entirely."))

arm("d18-auth-noop",
    "`authenticatedActionAccount` — the whole account/mode/owner/nonce authorization block",
    """  if (p.authMode == 0) {
    const acct = authenticatedNativeAccount(nativeAccount);
    assert(acct == p.account, "native witness does not match supplied account transcript");
    assert(accountModes.lookup(acct) == p.authMode, "authorization mode does not match account record");
    assert(!evmOwners.member(acct) && !evmNonces.member(acct), "native account carries EVM state");
    return acct;
  }

  assert(p.authMode == 1, "unknown account authorization mode");
  assert(accounts.member(p.account), "gateway account is not registered");
  assert(accountModes.member(p.account), "registered account has no authorization mode");
  assert(accountModes.lookup(p.account) == 1, "authorization mode does not match account record");
  assert(evmOwners.member(p.account) && evmNonces.member(p.account), "EVM account record is incomplete");
  assert(p.owner == evmOwners.lookup(p.account), "signed owner does not match stored owner");
  assert(p.nonce == evmNonces.lookup(p.account), "EVM nonce mismatch");
  return p.account;""",
    note("d18",
         "return the transcript account without authenticating it. `nativeAccount` stays live\n"
         "through the assert so `ownerCommitment` is NOT removed by this arm (d19 does that).")
    + '  assert(nativeAccount != p.wantNonce, "00009 d18: keep the native account live");\n'
    + "  return p.account;")

arm("d19-ownercommitment-noop",
    "`ownerCommitment(localOwnerSecret())` — the witness read and its `persistentCommit`",
    "  const nativeAccount = ownerCommitment(localOwnerSecret());",
    note("d19", "take the account from the transcript instead of committing to the owner witness.")
    + "  const nativeAccount = p.account;")

arm("d20-nativeauthresult-noop",
    "`nativeAuthResult` — a 64-byte / 2-word preimage and its keccak",
    """  const preimage: Bytes<64> = slice<64>([...nativeAuthTag(), ...account], 0) as Bytes<64>;
  return keccak256<Bytes<64>>(preimage);""",
    note("d20", "return the account instead of hashing the native auth tag with it.")
    + "  return account;")

arm("d21-register-noop",
    "the registration writes — `registerAccount` (three asserts + two inserts) and the "
    "`evmOwners.insert`",
    """  if (isRegistration) {
    registerAccount(account, (isEvmRegistration ? 1 : 0) as Uint<8>);
  }
  if (isEvmRegistration) {
    evmOwners.insert(account, p.owner);
  }
""",
    note("d21", "drop both registration writes; every guard above them is untouched."))

arm("d22-nonce-noop",
    "the checked EVM nonce increment and its `evmNonces.insert`",
    """  const incrementedNonce = (p.nonce + 1) as Uint<64>;
  assert(!isEvmAction || incrementedNonce > p.nonce, "EVM nonce overflow");
  const storedNonce = (isEvmRegistration ? 0 : incrementedNonce) as Uint<64>;
  if (isEvmAuthorized) {
    evmNonces.insert(account, storedNonce);
  }
""",
    note("d22", "drop the nonce increment, its overflow assert and its write."))

# ==================================================================================================
# GROUP D-CUST — inside the five-way custody dispatch (Phase 1 attributes 189,284 rows to it)
# ==================================================================================================

arm("d23-shieldedkey-noop",
    "every `shieldedKey` derivation (`persistentHash<Vector<3,Bytes<32>>>`) reached from `execute`",
    """export circuit shieldedKey(acct: Bytes<32>, colour: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([acct, colour, shieldedFamilyTag()]);
}""",
    "export circuit shieldedKey(acct: Bytes<32>, colour: Bytes<32>): Bytes<32> {\n"
    + note("d23",
           "use the raw account as the map key instead of deriving one. Every CALL SITE is kept,\n"
           "so Δ measures the key hashing alone — and, because this compiler does not\n"
           "common-subexpression identical pure calls, it measures ALL of them.")
    + "  return acct;\n}")

arm("d24-unshieldedkey-noop",
    "every `unshieldedKey` derivation (`persistentHash<Vector<3,Bytes<32>>>`) reached from `execute`",
    """export circuit unshieldedKey(acct: Bytes<32>, colour: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([acct, colour, unshieldedFamilyTag()]);
}""",
    "export circuit unshieldedKey(acct: Bytes<32>, colour: Bytes<32>): Bytes<32> {\n"
    + note("d24", "same shape as d23, other family.")
    + "  return colour;\n}")

arm("d25-sendshielded-noop",
    "the `sendShielded` call inside `withdrawShielded` (zswap input + nullifier claim + two "
    "outputs + two coin commitments)",
    "  const result = sendShielded(pools.lookup(col), disclose(recipient), val);",
    note("d25",
         "fabricate the send result instead of building the zswap operation. The pool\n"
         "bookkeeping below (`repool` / `remove`) and the balance write are untouched.")
    + "  const result = ShieldedSendResult{\n"
    + "    change: none<ShieldedCoinInfo>(),\n"
    + "    sent: ShieldedCoinInfo{ nonce: col, color: col, value: val }\n"
    + "  };")

arm("d26-openswap-surplus-noop",
    "the open-swap (`recipientA = none`) surplus machinery — `createZswapInput`, the nullifier "
    "transcription and claim, `evolveNonce`, `createZswapOutput`, the commitment transcription "
    "and both coin claims",
    """    createZswapInput(pooled);
    kernel.claimZswapNullifier(zswapCoinNullifier(dropMerkleIndex(pooled), selfAddr));
    const changeValue = (pooled.value - val) as Uint<128>;
    if (changeValue == 0) {
      repoolOrRemove(colA, none<ShieldedCoinInfo>());
    } else {
      // A fresh nonce for the change coin. `evolveNonce`'s domain differs from the one `sendShielded`
      // uses for its own change, and the pooled coin can be spent only once anyway (its nullifier is
      // consumed right above), so no commitment this contract ever creates can collide with it.
      const changeCoin = ShieldedCoinInfo{
        nonce: evolveNonce(2, pooled.nonce),
        color: colA,
        value: changeValue
      };
      const selfRecipient = right<ZswapCoinPublicKey, ContractAddress>(selfAddr);
      createZswapOutput(changeCoin, selfRecipient);
      const cm = zswapCoinCommitment(changeCoin, selfRecipient);
      kernel.claimZswapCoinSpend(cm);
      kernel.claimZswapCoinReceive(cm);
      repoolOrRemove(colA, some<ShieldedCoinInfo>(changeCoin));
    }""",
    note("d26",
         "drop the whole surplus branch's zswap machinery, keeping only the pool write so the\n"
         "branch still has an effect and the `none` shape still compiles.", "    ")
    + "    repoolOrRemove(colA, none<ShieldedCoinInfo>());")

arm("d27-claimwanted-noop",
    "`claimWantedColour` — the swap's WANT leg (`receiveShielded`, pool merge-or-create, and the "
    "credited balance write)",
    """  // Must precede insertCoin: this is what allocates the Merkle-tree index.
  receiveShielded(coinB);
  if (pools.member(coinB.color)) {
    pools.insertCoin(
      coinB.color,
      mergeCoinImmediate(pools.lookup(coinB.color), coinB),
      right<ZswapCoinPublicKey, ContractAddress>(kernel.self())
    );
  } else {
    pools.insertCoin(coinB.color, coinB, right<ZswapCoinPublicKey, ContractAddress>(kernel.self()));
  }
  shieldedBalances.insert(
    shieldedKey(credit, coinB.color),
    (shieldedBalanceOf(credit, coinB.color) + coinB.value) as Uint<128>
  );""",
    note("d27", "drop the entire WANT leg; the GIVE leg and every guard are untouched."))

arm("d28-swappreconditions-noop",
    "`assertSwapPreconditions` — the swap's four-stage guard block (parameter sanity, the "
    "per-(account, colour) guard, both pool guards, the credit-target check)",
    """  // 0. parameter sanity.
  assert(val > 0, "swap must give a positive amount");
  assert(coinB.value > 0, "swap must want a positive amount");
  assert(colA != coinB.color, "swap legs must be different colours");
  // 1. authorization already derived and checked the account before dispatch.
  const acct = account;
  // 2. THE PER-ACCOUNT, PER-COLOUR GUARD, BEFORE any pool guard.
  assert(shieldedBalanceOf(acct, colA) >= val, "account colour balance too low");
  // 3. only now, the pool.
  assert(pools.member(colA), "no pooled coin for this colour");
  assert(pools.lookup(colA).value >= val, "pooled colour balance too low");
  // 4. the credit target.
  assert(accounts.member(credit), "credit account is not registered");
  return acct;""",
    note("d28",
         "drop the swap guard block. This is the arm that prices the guard's `shieldedBalanceOf`\n"
         "key derivation, since the map reads themselves are near-free.")
    + "  return account;")

arm("d29-repool-noop",
    "`repoolOrRemove` — the shielded pool write-back / colour-removal bookkeeping",
    """  if (change.is_some) {
    pools.insertCoin(col, change.value, right<ZswapCoinPublicKey, ContractAddress>(kernel.self()));
  } else {
    // Fully spent: the colour leaves the map entirely.
    pools.remove(col);
  }""",
    note("d29", "drop the pool write-back on both shapes."))

# ==================================================================================================
# GROUP D-ENC — the endianness encoders, measured in ONE shot across the whole circuit
# ==================================================================================================
#
# `uint64Word` / `uint128Word` / `uint8Word` are all `reverseBytes32(value as Bytes<32>)`. The 4.2
# probes price ONE reversal at 9,423 rows in isolation; this arm prices ALL of them in situ, which
# is the number the "big-endian-native encoding" opportunity is worth. `bytes32LexicographicLt`
# uses `reverseBytes16` and is therefore NOT included here (d05 measures it separately).

arm("d31-reversebytes32-noop",
    "EVERY `reverseBytes32` reached from `execute` — i.e. the whole little-endian-to-big-endian "
    "conversion bill of `uint64Word` / `uint128Word` / `uint8Word`",
    """circuit reverseBytes32(value: Bytes<32>): Bytes<32> {
  return Bytes[value[31], value[30], value[29], value[28], value[27], value[26], value[25], value[24],
               value[23], value[22], value[21], value[20], value[19], value[18], value[17], value[16],
               value[15], value[14], value[13], value[12], value[11], value[10], value[9],  value[8],
               value[7],  value[6],  value[5],  value[4],  value[3],  value[2],  value[1],  value[0]];
}""",
    "circuit reverseBytes32(value: Bytes<32>): Bytes<32> {\n"
    + note("d31",
           "return the word unreversed. Every call site, every preimage and every keccak is kept —\n"
           "only the byte permutation goes. Δ is therefore the TOTAL cost `execute` pays purely to\n"
           "present integers in EVM big-endian order.")
    + "  return value;\n}")

arm("d30-mergecoin-noop",
    "`mergeCoinImmediate` inside the swap's WANT leg (its zswap inputs, nullifier claims, output "
    "and coin commitment)",
    "      mergeCoinImmediate(pools.lookup(coinB.color), coinB),",
    "      // 00009 d30 ABLATION: pool the wanted coin without merging it into the existing pool.\n"
    "      coinB,")


def main() -> int:
    src = PRODUCT.read_text()
    got = hashlib.sha256(src.encode()).hexdigest()
    if got != PRODUCT_SHA:
        print(f"product Manager drifted: {got} != {PRODUCT_SHA}", file=sys.stderr)
        return 2

    VARIANTS.mkdir(parents=True, exist_ok=True)
    rc = 0
    for name, (what, edits) in sorted(ARMS.items()):
        out = src
        for anchor, replacement in edits:
            if out.count(anchor) != 1:
                print(f"{name}: anchor is not unique ({out.count(anchor)} matches)", file=sys.stderr)
                rc = 3
                break
            out = out.replace(anchor, replacement)
        else:
            head, rest = out.split("\n", 1)
            out = head + "\n" + header(name, what) + rest
            path = VARIANTS / f"{name}.compact"
            path.write_text(out)
            print(f"{name} {hashlib.sha256(out.encode()).hexdigest()} {path}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
