# Composition on the pinned rc4 lane — answer to master Q2 / OQ2

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

The spec (FR-003) requires a transfer INTO the Manager to be **one transaction** containing the
sender's operation and the Manager's receive claim, because the standard library auto-receives only
when the recipient is `kernel.self()`.

## Result: the answer differs by SENDER, and most cells need no cross-contract composition at all

| Sender of the value | Mechanism that works | Level |
|---|---|---|
| **A user wallet** (steps 4, 6, 7, 8 deposits) | A **single** `Manager.depositShielded` call, balanced by the depositor's wallet | **SDK** — proven |
| **A minting contract** (steps 1, 2 mint→AA_A) | ONE ledger `Intent` holding both call prototypes | **ledger level** — proven |

### 1. User → contract deposit: PROVEN WORKING at SDK level

No cross-contract intent is needed. The Manager's `depositShielded` declares `receiveShielded`,
and the depositor's wallet supplies the input when `balanceTx` runs, so the sender's spend and the
Manager's receive land in one transaction by construction — exactly what FR-003 asks for.

```
buildCall(Manager.depositShielded)
  -> proofProvider.proveTx      (Manager's own providers)
  -> walletProvider.balanceTx   (depositor's wallet supplies the coin)
  -> midnightProvider.submitTx
```

Evidence (`src/g3/probe-deposit.ts`, reproducible): mint 10 of the demo shielded colour to a
wallet, then deposit it to AA_A.

| | before | after |
|---|---|---|
| AA_A shielded | 0 | **10** |
| Manager pool | 0 | **10** |

deposit tx `0040fd77bc56d8c789305dbec631a97a3963100426b3d734195d828423fc33da37`
(earlier identical run: `008680060cbab82102b6eb840db1c1c692efa1dfcdb4de39bb337f34f405066b0f`).
This matches the ledger prior art `token_vault_shielded.rs`, where the sender contributes the
funded offer and the contract claims the receive.

### 2. Contract mint → contract: NOT expressible in midnight-js v5.0.0-beta.6

Two independent routes were tried and both are ruled out:

- **Single scoped intent** — `withContractScopedTransaction` batches calls into one transaction but
  rejects a second contract outright:
  `ScopedTransactionIdentityMismatchError: Cannot use cached states from contract 'df5adc30…' for
  contract 'bb1a1806…' (privateStateId: 'manager'). Scoped transactions must target the same
  contract and private state identity.`
  This is an explicit, designed restriction, not a misuse.
- **Merging separately-built transactions** — `createUnprovenCallTx` per contract, `proveTx` per
  contract, then `Transaction.merge`. The merge itself succeeds, but each call lands in **its own
  segment**, so the Minter's output and the Manager's receive claim cannot offset and the wallet
  fails to balance: `Wallet.InsufficientFunds`. (Finding G3-2.)

**Therefore the spec's documented fallback applies for the mint→account cells** — and it is now
**IMPLEMENTED AND PROVEN**, in both families. See section 2b.

## 2b. Ledger-level composition: the fix, and why the earlier diagnosis was wrong

`harness/src/g3/ledger-compose.ts` builds ONE `Intent` containing BOTH `ContractCallPrototype`s,
mirroring `token_vault_shielded.rs`:

| `token_vault_shielded.rs` | `ledger-compose.ts` |
|---|---|
| hand-written `Op<>` transcript | transcript from executing the real compiled circuit |
| `partition_transcripts(&[pre])` | partitioning done by compact-js per call |
| `ContractCallPrototype { … }` | `new ContractCallPrototype(…)` per call |
| `test_intents(rng, vec![call], …)` | `Intent.addCall` for every call |
| `Transaction::new(nid, intents, offer)` | the carrier call's own transaction, intent replaced |

Only the **assembly** is at ledger level. Each call's transcript, ZK input/output and private
transcript still come from midnight-js executing the compiled circuit, so no contract behaviour is
reimplemented off-chain.

**The carrier.** `mintShieldedToken` and `receiveShielded` both call `createZswapOutput` for the
same coin to the same recipient, and the ledger **unifies** them: the transaction needs exactly ONE
contract-owned zswap output, claimed as a spend by the Minter and as a receive by the Manager. So
the mint's transaction — with its offer — is kept whole, and the Manager's call prototype is grafted
into its intent; the Manager's own transaction is discarded.

**Proving across two contracts** uses the pinned SDK's `ZKConfigRegistry`
(`makeComposedProofProvider`), which resolves each call's key location by joining on the hash of
the DEPLOYED verifier key. This is why the earlier flat `_combined` directory could never work:
resolution is per deployed contract, not per circuit name, and both contracts export
`mintShieldedTo`-style names.

**Why `merge` failed.** `UnprovenTransaction.merge` puts each call in its **own segment**, so the
spend claim and the receive claim could not offset (`Wallet.InsufficientFunds`). One intent means
one segment, and they offset. The earlier hypothesis — "the coin appears to be created twice" — is
**refuted**.

**Evidence** (`evidence/g3-ledger/mint-compose.txt`, reproduced on two independent runs):

| Family | Composed tx (retained run) | AA_A | second observation point |
|---|---|---|---|
| Shielded | `004d83b72c1dd872a4dd31564f1d09c6a02a7f0ec119c10b972a246233593bc7b1` | 0 → **10** | pool 0 → **10**, pool nonce == mint nonce |
| Unshielded | `0029024540c332b0095538a4864ee5706617328c4118c6c735e0e4684f623bcaa8` | 0 → **10** | shielded pool untouched |

## 3. Two further SDK requirements discovered (both satisfied)

- Minting/sending a shielded coin to a third party needs that party's **encryption** public key via
  `additionalCoinEncPublicKeyMappings`, else: `Unable to resolve encryption public key for recipient`.
- Proofs must be produced **per contract**: the proof provider resolves ZK artifact bundles against
  the *deployed contract's verifier key*, so a flattened all-keys-in-one-directory provider fails
  with `ZKArtifactNotFoundError`. (The combined ZK view built by `compile.sh --zk` is therefore
  unused for proving and retained only as a build-time collision check.)

## Harness correctness fix — false negatives when reading state

Contract state is only observable after the block carrying the transaction is applied and indexed.
Reading immediately after `submitTx` returns the PRE-transaction state, which looks exactly like
"the call did nothing". The first deposit probe reported a false failure for this reason — the
deposit had in fact succeeded. All state assertions now go through `waitForManager(...)`, which
polls for the expected condition and fails loudly on timeout instead of silently mis-reporting.
