# 00010-Q3 — wiring verification before deleting `assertSwapPreconditions` / `claimWantedColour`

**Date:** 2026-08-25. **Clone:** `/Users/edwardalvarado/todo/AA/experiments/00010-manager-k19`,
branch `00010-manager-k19`. **Verified at commit `0c4bd1f`** (pre-deletion); every line number in
this document refers to `contracts/manager.compact` **as of `0c4bd1f`** and is reproducible with
`git show 0c4bd1f:contracts/manager.compact`.

## 0. Why this document exists

The owner's Q3 resolution is **conditional**. The condition, verbatim: get rid of unused code,
*"unless it's unused because we forgot to wire something — then let me know."*

So the deletion is authorized **only** if `assertSwapPreconditions` and `claimWantedColour` are
unused **because the o2 `custodyDispatch` mux reimplemented their logic**, and not because a wiring
step was dropped. This document discharges that condition guard by guard and effect by effect,
**before** anything is deleted. The decision rule applied:

> If EVERY guard and effect maps to a live line → proceed to the deletion.
> If ANY is absent from the live path → DELETE NOTHING, file the gap as a question to the owner.

**VERDICT: every guard and every effect maps to a live line. No wiring gap. Deletion authorized.**

## 1. The argument substitution that makes the mapping exact

The two helpers had exactly one caller, `openSwapShielded`, which itself had exactly one caller: the
five-way custody branch in `execute`. In the k=20 product (`git show 4282400:contracts/manager.compact`,
`execute` lines 1288–1296) that call site is:

```
openSwapShielded(
  account,
  p.primaryColor,
  p.primaryAmount,
  swapRecipient(p.recipientKind, p.recipient),
  ShieldedCoinInfo{ nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount },
  p.creditAccount
);
```

`openSwapShielded` then bound `colA := colourA`, `val := valA`, `cb := coinB`, `credit := creditAccount`
(k=20 lines 993–997, `disclose` only — no value transformation) and called
`assertSwapPreconditions(account, colA, val, cb, credit)` and, as its last statement,
`claimWantedColour(cb, credit)`.

The substitution used throughout this document is therefore:

| Helper parameter | Bound to |
|---|---|
| `account` | the `account` derived by `gatewayAccount` in `execute` |
| `colA` | `p.primaryColor` |
| `val` | `p.primaryAmount` |
| `coinB` / `cb` | `ShieldedCoinInfo{ nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount }` |
| `credit` | `p.creditAccount` |

The live mux binds the same payload fields at lines 1047–1050 (`col`, `val`, `creditAcct`,
`creditColour`) and receives `account` from `execute` line 1378 (`custodyDispatch(p, account)`), where
`account` is the value returned by `gatewayAccount` at line 1359 — the same witness choke point.

**Both helper bodies are byte-identical to the k=20 product's** (checked programmatically:
`assertSwapPreconditions` 901 bytes, `claimWantedColour` 644 bytes, exact match against
`4282400:contracts/manager.compact`). This matters for §4: the k=20 artifact the executed A/B parity
suite ran against **is** these two helpers.

## 2. `assertSwapPreconditions` (lines 804–825) → live path, guard by guard

Selector-6 mux predicates, established at lines 1037–1045:
`isSwap = p.selector == 6` (1037) · `debitShielded = … || isSwap` → **true** (1041) ·
`creditShielded = … || isSwap` → **true** (1042) · `hasCredit = isTransfer || isSwap` → **true** (1043) ·
`needsPool = isWithdrawShielded || isSwap` → **true** (1045).

| # | Guard in the dead helper | Line | Live line(s) | Lives in | Verdict |
|---|---|---:|---|---|---|
| 0a | `assert(val > 0, "swap must give a positive amount")` | 812 | `assert(!isSwap \|\| val > 0, "swap must give a positive amount")` — **1053**; and `assert(p.primaryAmount > 0, "swap must give a positive amount")` — **924** | `custodyDispatch` **and** `assertActionEnvelope` | **PRESENT (twice)** |
| 0b | `assert(coinB.value > 0, "swap must want a positive amount")` | 813 | `assert(!isSwap \|\| p.wantAmount > 0, …)` — **1054**; and `assert(p.wantAmount > 0, …)` — **932** | `custodyDispatch` **and** `assertActionEnvelope` | **PRESENT (twice)** |
| 0c | `assert(colA != coinB.color, "swap legs must be different colours")` | 814 | `assert(!isSwap \|\| col != p.wantColor, …)` — **1055**; and `assert(p.primaryColor != p.wantColor, …)` — **933** | `custodyDispatch` **and** `assertActionEnvelope` | **PRESENT (twice)** |
| 1 | the witness choke point — `const acct = account;`, the account is DERIVED, never supplied | 815–816 | `const account = gatewayAccount(p, nativeAccount, evmRegistrationAccount);` — **1359**, passed to `custodyDispatch(p, account)` — **1378**; derivation in `authenticatedActionAccount` — **944–964** | `execute` | **PRESENT** (unchanged from the k=20 product; the helper's line was a no-op rebinding of an already-derived value) |
| 2 | **the per-(account, colour) guard, BEFORE any pool guard, missing cell reads 0** — `assert(shieldedBalanceOf(acct, colA) >= val, "account colour balance too low")` | 818 | `debitKey = persistentHash<Vector<3,Bytes<32>>>([account, col, debitShielded ? shieldedFamilyTag() : unshieldedFamilyTag()])` — **1064–1065**; `debitBalance = … shieldedBalanceAt(debitKey) …` — **1066**; `assert(debitBalance >= val, "account colour balance too low")` — **1067** | `custodyDispatch` | **PRESENT, and the ORDER IS PRESERVED — 1067 precedes the pool guard at 1071** (see §2.1) |
| 3a | `assert(pools.member(colA), "no pooled coin for this colour")` | 820 | `assert(pools.member(col), "no pooled coin for this colour")` — **1071**, inside `if (needsPool)` — **1070** | `custodyDispatch` | **PRESENT** |
| 3b | `assert(pools.lookup(colA).value >= val, "pooled colour balance too low")` | 821 | `const pooled = pools.lookup(col);` — **1072**; `assert(pooled.value >= val, "pooled colour balance too low")` — **1073** | `custodyDispatch` | **PRESENT** |
| 4 | `assert(accounts.member(credit), "credit account is not registered")` | 823 | `assert(!isSwap \|\| accounts.member(p.creditAccount), "credit account is not registered")` — **1076** | `custodyDispatch` | **PRESENT, at the same relative position** — after 3b, before any write |

Every assert **message string** is carried over unchanged, which is what makes the refusal set
comparable byte-for-byte in §4.

### 2.1 The one guard whose syntax differs — key-derivation equivalence, spelled out

Guard 2 is the only one the mux does not state in the same syntax, because the o2 lever's whole point
is deriving the balance key **once** with the family tag muxed. The two forms are the same expression:

* Helper: `shieldedBalanceOf(acct, colA)` — body at **335–338** — computes
  `k = shieldedKey(acct, colA)` and returns `shieldedBalances.member(k) ? shieldedBalances.lookup(k) : 0`.
  `shieldedKey` — **325–327** — is `persistentHash<Vector<3, Bytes<32>>>([acct, colour, shieldedFamilyTag()])`.
* Mux: `debitKey` — **1064–1065** — is
  `persistentHash<Vector<3, Bytes<32>>>([account, col, debitShielded ? shieldedFamilyTag() : unshieldedFamilyTag()])`.
  For selector 6, `debitShielded` is **true** (1041), so the third element is `shieldedFamilyTag()` and
  the expression is **character-for-character `shieldedKey(account, col)`'s body**.
  `shieldedBalanceAt(k)` — **1023–1025** — is
  `shieldedBalances.member(k) ? shieldedBalances.lookup(k) : 0`, i.e. `shieldedBalanceOf`'s body with
  the key supplied rather than recomputed. **The missing-cell-reads-0 property (FR-204/FR-206) is
  therefore preserved, not re-implemented.**

**The FR-204 ordering property — the owner-critical one — holds:** line **1067** (per-(account,colour)
guard) executes before line **1070** (`if (needsPool)`) and therefore before **1071/1073** (the pool
guards) and before **1076** (the credit-target guard). A maker with a rich pool but an empty or short
account cell still dies at the account guard and never reaches the pool guard, exactly as NC-306
requires. Every guard still precedes every write: the first write in the mux is the give leg at
**1086/1092**, after all of 1053–1076.

## 3. `claimWantedColour` (lines 833–849) → live want leg, effect by effect

| # | Effect in the dead helper | Line | Live line(s) | Verdict |
|---|---|---:|---|---|
| W1 | `receiveShielded(coinB)` — **must precede `insertCoin`**, it is what allocates the Merkle index | 835 | `wantCoin = ShieldedCoinInfo{ nonce: p.wantNonce, color: p.wantColor, value: p.wantAmount }` — **1131–1133** (identical to the `coinB` the k=20 `execute` constructed); `receiveShielded(wantCoin)` — **1134**, before the `insertCoin` calls at 1136/1141 | **PRESENT, ordering preserved** |
| W2 | pool **merge-or-create** for the wanted colour: `pools.member(coinB.color) ? insertCoin(color, mergeCoinImmediate(lookup(color), coinB), right(kernel.self())) : insertCoin(color, coinB, right(kernel.self()))` | 836–844 | `if (pools.member(p.wantColor)) { pools.insertCoin(p.wantColor, mergeCoinImmediate(pools.lookup(p.wantColor), wantCoin), right<ZswapCoinPublicKey, ContractAddress>(kernel.self())); } else { pools.insertCoin(p.wantColor, wantCoin, right<…>(kernel.self())); }` — **1135–1143** | **PRESENT** — same branch structure, same `mergeCoinImmediate`, same `right<…>(kernel.self())` recipient |
| W3 | credit-account balance write: `shieldedBalances.insert(shieldedKey(credit, coinB.color), (shieldedBalanceOf(credit, coinB.color) + coinB.value) as Uint<128>)` | 845–848 | `if (hasCredit)` — **1147**; `creditKey = persistentHash<Vector<3,Bytes<32>>>([creditAcct, creditColour, creditShielded ? shieldedFamilyTag() : unshieldedFamilyTag()])` — **1148–1149**; `creditValue = (isSwap ? p.wantAmount : val)` — **1150**; `shieldedBalances.insert(creditKey, (shieldedBalanceAt(creditKey) + creditValue) as Uint<128>)` — **1152–1153** | **PRESENT** — for selector 6, `creditAcct = p.creditAccount` (**1049**), `creditColour = p.wantColor` (**1050**), `creditShielded = true` (**1042**), so `creditKey` is character-for-character `shieldedKey(credit, coinB.color)`'s body, and `creditValue = p.wantAmount = coinB.value` |

**Relative order preserved end to end.** `openSwapShielded` ran: give leg → debit write → 
`claimWantedColour` (receive → pool → credit). `custodyDispatch` runs: give leg (**1070–1111**) →
debit write (**1122–1127**) → want leg receive+pool (**1130–1144**) → credit write (**1147–1158**).
Identical sequence.

### 3.1 The swap give leg, for completeness (not part of the enumerated deletion)

The give leg lived in `openSwapShielded` itself, which Q1-B already deleted; it is mapped here only
so the selector-6 path is covered end to end and no gap can hide between the two helpers.

* **Named-taker shape** (`recipientKind` 1 or 2): k=20 took `rcpt.is_some` from
  `swapRecipient(p.recipientKind, p.recipient)` (k=20 lines 1084–1099) and called
  `sendShielded(pooled, rcpt.value, val)` + `repoolOrRemove`. Live: **1078** `if (isWithdrawShielded || p.recipientKind != 0)`
  (≡ `rcpt.is_some` for a swap), **1082** `useLeft = … : (p.recipientKind == 1)` — kind 1 → `left<ZswapCoinPublicKey, …>`,
  kind 2 → `right<…, ContractAddress>`, matching `swapRecipient` exactly — then **1086–1087**
  `sendShielded(pooled, rcpt, val)` + `repoolOrRemove(col, result.change)`. `repoolOrRemove` is **still
  called and must stay** (call-graph: its only caller is `custodyDispatch`).
* **OPEN shape** (`recipientKind == 0`, FR-308 v2a): live at **1089–1109**. Checked mechanically:
  after stripping comments, normalising whitespace and renaming `colA`→`col`, the k=20
  `openSwapShielded` surplus branch and the mux's `else` branch are **textually identical** —
  `createZswapInput`, `claimZswapNullifier(zswapCoinNullifier(dropMerkleIndex(pooled), selfAddr))`,
  the `changeValue == 0` split, `evolveNonce(2, pooled.nonce)`, `createZswapOutput`,
  `claimZswapCoinSpend`/`claimZswapCoinReceive`, `repoolOrRemove`.
* `swapRecipient`'s trailing `assert(kind == 2, "swap recipient kind is invalid")` was already
  unreachable: `assertActionEnvelope` **925** asserts `p.recipientKind <= 2` **with the same message**
  before dispatch is reached. Dropping an unreachable assert leaves the refusal set identical — the
  same reasoning Q1-B recorded and the negative suite exercises.

## 4. Cross-reference: the EXECUTED A/B parity evidence

This is not only a source reading. The 45-test suite compiled the **k=20 product artifact**
(`contract/index.js` SHA-256 `1a6cf20d…`) — whose swap path **is** `openSwapShielded` calling these
two byte-identical helpers — and drove it in the same process as the k=19 build, whose swap path is
`custodyDispatch`. So the parity suite is a direct, executed comparison of *the deleted helpers'
behaviour* against *the live mux's behaviour*.

Suite: `harness/src/auth/test/k20-parity.test.ts`. Log: `raw/parity-k19-q1b.log` (45/45, the
post-Q1-B run) and `raw/parity-k19-final.log` (45/45, the Phase 3 run).

### 4.1 Swap **effects** — `k20-parity.test.ts:282`, *"registers, deposits and runs all five custody actions with identical state and zswap shape"*

Three of its seven action cases are selector 6, covering all three recipient shapes:

| Case (test label) | Payload | Covers |
|---|---|---|
| `selector 6 — openSwapShielded, recipientKind 0 (OPEN, FR-308 v2a)` | give 8 of COLOR_A, want 9 of COLOR_B, credit = destination | guards 0a/0b/0c/2/3a/3b/4; give leg OPEN branch; W1/W2/W3 |
| `selector 6 — openSwapShielded, recipientKind 1 (named taker key)` | give 10 of COLOR_A, want 11 of COLOR_B | same, with the `left<ZswapCoinPublicKey,…>` `sendShielded` branch |
| `selector 6 — openSwapShielded, recipientKind 2 (contract taker)` | give 12 of COLOR_A, want 13 of COLOR_B | same, with the `right<…,ContractAddress>` `sendShielded` branch |

After **each** action the helper `expectSameEffects` (`k20-parity.test.ts:260–271`) asserts:

```
snapshotLedger(k19.ledger)  toEqual  snapshotLedger(k20.ledger)   // guard 2/3/4 outcomes + W2 + W3 + the debit write
k19.inputs                  toEqual  k20.inputs                   // the give leg's zswap input / nullifier claim
k19.outputs                 toEqual  k20.outputs                  // the change output and W1's received coin
k19.effects                 toEqual  k20.effects                  // claimed spends / receives / nullifiers
```

That is exactly the owner's requirement *"swap actions equal on ledger state + zswap inputs/outputs"*.
Concretely, W3's credit write is observable in `snapshotLedger` as the `shieldedBalances` cell for
`(destination, COLOR_B)`; W2's merge-or-create is observable as the `pools` entry for COLOR_B, which
the second and third swap cases exercise in the **merge** direction (the pool already holds COLOR_B
after the first swap) and the first exercises in the **create** direction.

### 4.2 Swap **refusals** — `k20-parity.test.ts:428`, *"refuses identically on the negative set, state-neutrally on both builds"*

13 cases; for each, both builds must raise **the same message text**, and state must be byte-identical
before/after on each build **and** across builds. The swap-specific ones:

| Negative case | Guard it lands on | Live line |
|---|---|---|
| `NC — swap with equal give/want colours` | 0c `"swap legs must be different colours"` | envelope **933** (reached first), mux **1055** |
| `NC — swap crediting an unregistered account` | 4 `"credit account is not registered"` | mux **1076** |
| `NC — swap wanting zero` | 0b `"swap must want a positive amount"` | envelope **932** (reached first), mux **1054** |

And the guard-2 line **1067** is a **single shared line for all five selectors**, so the four negatives
that land on it — `NC — shielded debit over the account colour balance`, `NC — unshielded debit over
the account colour balance`, `NC — debit of a colour that was never credited (missing cell reads 0)`,
and the same-line ordering probe — exercise the identical constraint the swap path uses. The
never-credited case is the FR-204 ordering probe: it must refuse with `"account colour balance too
low"` (the account guard) and **not** with `"no pooled coin for this colour"` (the pool guard), which
is only possible if 1067 really does precede 1071.

### 4.3 Honest coverage note

Three swap guards have **no dedicated negative case** in the 45-test suite:

* **0a** `"swap must give a positive amount"` — no zero-give swap negative (the analogous
  zero-amount case is `NC — zero-amount internal transfer`, selector 5).
* **3a** `"no pooled coin for this colour"` and **3b** `"pooled colour balance too low"` — no negative
  reaches them, because guard 2 (the account cell) refuses first in every constructed case. That is
  the *intended* consequence of the FR-204 order, not an oversight in the mux.

These three are exercised in the **passing** direction by all three swap parity cases (each one flows
through 1053, 1071 and 1073 successfully with byte-identical zswap inputs/outputs against the k=20
build). Older suites `harness/src/test/swap.test.ts` and `harness/src/test/g5-variants.test.ts` do
carry explicit negatives for 0a, 0b and 4, but those target the v3/v4 circuit surface and are **not**
part of the 45-test suite, so they are cited as context only, not as evidence for this verdict.

**This is a test-coverage observation, not a wiring gap.** The decision rule asks whether each guard
is *present in the live path*; 0a, 3a and 3b are present at lines 1053, 1071 and 1073 respectively,
and 0a is present a second time at 924. Recorded here so the gap is on the record rather than
discovered later.

## 5. Verdict

| Item | Mapped to a live line? |
|---|---|
| `assertSwapPreconditions` — swap amount > 0 | **YES** — 1053 (+ envelope 924) |
| `assertSwapPreconditions` — wanted amount > 0 | **YES** — 1054 (+ envelope 932) |
| `assertSwapPreconditions` — colour distinctness | **YES** — 1055 (+ envelope 933) |
| `assertSwapPreconditions` — per-(account,colour) guard **before any pool guard** | **YES** — 1064–1067, and 1067 < 1070 |
| `assertSwapPreconditions` — `pools.member` guard | **YES** — 1071 |
| `assertSwapPreconditions` — pool value guard | **YES** — 1073 |
| `assertSwapPreconditions` — credit-account registration guard | **YES** — 1076 |
| `claimWantedColour` — `receiveShielded` of the wanted coin | **YES** — 1134 (before 1136/1141) |
| `claimWantedColour` — pool merge-or-create for the wanted colour | **YES** — 1135–1143 |
| `claimWantedColour` — credit-account balance write | **YES** — 1147–1158 |

**10 of 10 mapped. No wiring gap. The two helpers are unused because `custodyDispatch` reimplemented
their logic — which is the owner's condition — and not because anything was forgotten.**
Proceeding to the deletion under Q3 option C.

Supporting mechanical facts recorded at `0c4bd1f`:

* Call graph (comments stripped, 67 circuits, 19 exported roots): `assertSwapPreconditions` **0 callers**,
  `claimWantedColour` **0 callers**, `repoolOrRemove` **1 caller (`custodyDispatch`) — must stay**.
* Reachable from the exported roots: **62 of 67**. The 5 unreachable are the two swap helpers plus
  `nativeAuthResult`, `nativeAuthTag` and `reverseBytes32` — the last three were already unreachable
  before this change and are **out of scope** (see §6 of `RESULTS.md` §9.3 follow-up notes and the
  report accompanying this task).

## 6. Post-deletion record

Step 2 executed after this verification passed. Full write-up in `RESULTS.md` §9.4; the essentials:

* `contracts/manager.compact` **1,405 → 1,381** lines, **57 insertions / 81 deletions**. **Every one of
  the 57 added lines is a comment or blank** — no code was added. **33** removed lines were code (the
  two circuit bodies); the rest were their comment block. Source SHA-256
  `9fb3ae3e…` → `535b16695edbfd7b06994b3546253fefc2863996b8a66cd94397dd9f207f3d50`.
  Diff stored as `diffs/manager-k19-q3-deletion.diff`.
* **ZKIR acceptance gate: 9/9 BYTE-IDENTICAL** to the `k19-q1b` build (`execute.zkir` = `524c32a2…`,
  605,053 B). `contract/index.d.ts` byte-identical (`92c251d3…`). `contract/index.js` differs **only**
  in `manager.compact line N char N` provenance strings — **zero** non-provenance changed lines.
  The suite was re-run anyway: **45/45**, log `raw/parity-k19-q3.log`.
* Reachability from the 19 exported roots: **62 of 67** before → **62 of 65** after. The reachable set
  is unchanged and **the deletion newly orphaned nothing.**

### 6.1 Line numbers after the deletion

The mapping above cites `0c4bd1f` line numbers. For a reader working on the shipping source, the same
live lines are now:

| Guard / effect | @ `0c4bd1f` | after deletion |
|---|---:|---:|
| swap amount > 0 (mux / envelope) | 1053 / 924 | **1023 / 845** |
| wanted amount > 0 (mux / envelope) | 1054 / 932 | **1024 / 853** |
| colour distinctness (mux / envelope) | 1055 / 933 | **1025 / 854** |
| per-(account,colour) key derivation | 1064–1065 | **1034–1035** |
| **per-(account,colour) guard** | 1067 | **1037** |
| `if (needsPool)` | 1070 | **1040** |
| `pools.member` guard | 1071 | **1041** |
| pool value guard | 1073 | **1043** |
| credit-account registration guard | 1076 | **1046** |
| `receiveShielded(wantCoin)` | 1134 | **1110** |
| pool merge-or-create | 1135–1143 | **1111–1119** |
| credit write (`if (hasCredit)` … `creditKey`) | 1147–1158 | **1123–1134** |
| `account = gatewayAccount(…)` / `custodyDispatch(p, account)` | 1359 / 1378 | **1335 / 1354** |

The FR-204 ordering property still reads off the line numbers directly: **1037 < 1040 < 1041 < 1043 < 1046**,
i.e. the per-(account,colour) guard precedes the pool guards, which precede the credit-target guard,
and all of them precede the first write.

The guard-order commentary that stood above `assertSwapPreconditions` is **rehomed onto
`custodyDispatch`** (option C) at lines **961–999**, reworded to describe the mux: step 0 now names
the three `!isSwap || …` sanity lines and points the other selectors' sanity at
`assertActionEnvelope`; step 1 names `gatewayAccount`/`authenticatedActionAccount` in `execute` as the
choke point that hands this circuit an already-derived account; step 2 states the single shared
`assert(debitBalance >= val, …)` and the key-derivation equivalence from §2.1; and the F-305
colour-distinctness rationale is carried over, noting the assert now lives in both `custodyDispatch`
and `assertActionEnvelope`. The Q3 marker comment ("filed as question 00010-Q3 rather than removed on
this executor's own authority") is gone, replaced by a record of the resolution and a pointer to this
document.
