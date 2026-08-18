# 00003-contract-token-custody — final report

> **`EXPERIMENTAL_LANE`.** Every result below was produced on the pinned **v2.0.0-rc.4
> prerelease slot** on a local, fresh `undeployed` ledger-9 network. Per the recorded 00002
> G1 evidence, the official compatibility matrix lists **no supported coherent 2.x application
> bundle**, so this lane is a deliberately experimental one. **No result here may be
> extrapolated to a supported or production lane**, and nothing here is a production
> readiness claim. The lane also carries deviation **`LANE-DEV-1`** (below).

## Headline result

A contract-minted token, in **both families**, circulated through user wallets and through
contract-held custody accounts and back, ending with **all four parties at `5/5`** after a
deliberately balance-neutral self-send round:

| AA_A | OwnerN | AA_B | OwnerM |
|---|---|---|---|
| 5/5 | 5/5 | 5/5 | 5/5 |

Both halves of the standing ownership invariant — `pooled holdings = AA_A + AA_B`, per
family — were asserted after **every one of the ten steps**, against two independently
maintained mechanisms.

The owner's core question is answered affirmatively and directly: tokens are **equally
spendable regardless of whether their previous holder was a contract account or a normal
wallet**. Step 7 has OwnerM re-spending coins the Manager created, and AA_B re-spending value
OwnerN deposited; step 8 mirrors both unshielded.

## The pinned lane

Exact component set, pinned by immutable digest or integrity hash at G1 and re-asserted by
every gate wrapper before it boots a stack — see [`evidence/g1-lane/LANE.md`](evidence/g1-lane/LANE.md).

| Component | Pin |
|---|---|
| node | `node-2.0.0-rc.4` @ `sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e` |
| indexer | `v4.4.0-rc.1` @ `sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a` |
| proof server | `9.0.0-rc.3` @ `sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f` |
| ledger | `ledger-9.1.0.0-rc.3` (`@midnightntwrk/ledger-v9@1.0.0-rc.3`) |
| midnight-js | `v5.0.0-beta.6` |
| wallet SDK | `@midnightntwrk/wallet-sdk@2.0.0-beta.2` |
| compiler | `compactc 0.33.0` / language `0.25.0` — **deviation `LANE-DEV-1`** |

**`LANE-DEV-1`.** The spec pins `compactc-v0.33.0-rc.2`, which has **no published binary**
(Finding L-4). The owner approved substituting the released `compactc-v0.33.0` provided the
substitution was verified rather than assumed. It is verified end to end: the compiler and
language versions match the pinned rc.2 source, the binary is pinned by SHA-256, and — the
check that matters — its artifacts are **accepted on-chain by `ledger-9.1.0.0-rc.3`**, which
every deployment and every transaction in this report demonstrates.

## The step ledger, as observed

Balances are `shielded/unshielded` **of the Minter's two colours only**. NIGHT and DUST appear
solely as fee context and never in this table (FR-006). Every row below is the **observed**
value, asserted equal to the specification's expected value before the run was allowed to
continue; the first divergence would have halted it.

| Step | Action | AA_A | OwnerN | AA_B | OwnerM | pool (shielded) | contract ledger (unshielded) |
|---|---|---|---|---|---|---|---|
| 0 | Deploy Minter + Manager; register AA_A (OwnerA), AA_B (OwnerB); create OwnerN, OwnerM | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 0 |
| 1 | Mint **shielded** 10 → AA_A and 10 → OwnerN | 10/0 | 10/0 | 0/0 | 0/0 | 10 | 0 |
| 2 | Mint **unshielded** 10 → AA_A and 10 → OwnerN | 10/10 | 10/10 | 0/0 | 0/0 | 10 | 10 |
| 3 | Send **shielded** half: OwnerN →5→ OwnerM; AA_A →5→ AA_B | 5/10 | 5/10 | 5/0 | 5/0 | 10 | 10 |
| 4 | Send **shielded** remaining half, crossed: OwnerN →5→ AA_B; AA_A →5→ OwnerM | 0/10 | 0/10 | 10/0 | 10/0 | 10 | 10 |
| 5 | Send **unshielded** half: OwnerN →5→ OwnerM; AA_A →5→ AA_B | 0/5 | 0/5 | 10/5 | 10/5 | 10 | 10 |
| 6 | Send **unshielded** remaining half, crossed: OwnerN →5→ AA_B; AA_A →5→ OwnerM | 0/0 | 0/0 | 10/10 | 10/10 | 10 | 10 |
| 7 | **Provenance re-send, shielded**: OwnerM →5→ AA_A; AA_B →5→ OwnerN | 5/0 | 5/0 | 5/10 | 5/10 | 10 | 10 |
| 8 | **Provenance re-send, unshielded**: OwnerM →5→ AA_A; AA_B →5→ OwnerN | 5/5 | 5/5 | 5/5 | 5/5 | 10 | 10 |
| 9 | **Self-send round**: OwnerM both families; Manager pool both families to `kernel.self()` | 5/5 | 5/5 | 5/5 | 5/5 | 10 | 10 |

Per-step evidence — every operation's full before/after observation, including coin nonces,
commitments and UTXO detail — is in [`evidence/g3-ledger/`](evidence/g3-ledger/):
[step 0](evidence/g3-ledger/step-0/step.json) · [step 1](evidence/g3-ledger/step-1/step.json) · [step 2](evidence/g3-ledger/step-2/step.json) · [step 3](evidence/g3-ledger/step-3/step.json) · [step 4](evidence/g3-ledger/step-4/step.json) · [step 5](evidence/g3-ledger/step-5/step.json) · [step 6](evidence/g3-ledger/step-6/step.json) · [step 7](evidence/g3-ledger/step-7/step.json) · [step 8](evidence/g3-ledger/step-8/step.json) · [step 9](evidence/g3-ledger/step-9/step.json)

### Deployment of record

| What | Value |
|---|---|
| Minter | `b0a96ac61f4bc71de1627657dc934b11aefab199a50dc73a115b0fcc041a28ad` |
| Manager | `1d838367033c26ea83bcfde405851aeec45057390dd364ca6632299d6c39e183` |
| Shielded colour | `7178f8449769f38ece84415349504bdf39b9deab8b158f23d5cf96d60cd3a478` |
| Unshielded colour | `de7966d6923a3c3a5cb07c90991ea2d530c74584b57b87f168f9722774d07426` |
| AA_A (OwnerA) account id | `dcf015b07f71ae71c6ccdae873ca9a2f67cd9bb8745ea70fb58348b6d802f331` |
| AA_B (OwnerB) account id | `bcc499e63190cb1aade1ffb6cfec52ba5b0502881343a3775ce8ad50cc02317c` |
| Total minted | shielded 20, unshielded 20 |

## Combination-matrix checklist

**26 of 26 cells GREEN**, 0 RED, no gaps.
The full index — per-cell transaction ids, observation points and composition level — is
[`evidence/g3-ledger/CELLS.md`](evidence/g3-ledger/CELLS.md).

| Cell | Step | Level | Transaction id(s) | Status |
|---|---|---|---|---|
| Mint shielded → manager account (paired Manager receive+credit in the same tx) | 1 | LEDGER | `0067f1f51f53250735484f4c64f4b932eeca3769e4d33e66c7b078ea900ffed7f2` | **GREEN** |
| Mint shielded → user | 1 | SDK | `000802036ff2a325f1a367f27d295edc0547cde468df3d94a3f92c3d36673aa22a` | **GREEN** |
| Mint unshielded → manager account | 2 | LEDGER | `0051b5ea962ab7d7d393066d9153c1ca385530b5a2986e6ad2ea52c9477fc4ee02` | **GREEN** |
| Mint unshielded → user | 2 | SDK | `00386c9b07abfc21ddf610caab1029a5e03a9264b8479ef399cc18c615c3d938e2` | **GREEN** |
| Send shielded user→user | 3 | wallet | `00251e6da2e81dc7fa0496c812e3828d0968e916e0c70d2926356d589c6e19fca2` | **GREEN** |
| Split: shielded user wallet change (OwnerN) | 3 | wallet | `00251e6da2e81dc7fa0496c812e3828d0968e916e0c70d2926356d589c6e19fca2` | **GREEN** |
| Shielded account→account internal ownership transfer, no ledger movement | 3 | SDK | `0027122ab1bc8c1e61c46bccdc66159efeae59476b0f63285bda350e77de2a1146` | **GREEN** |
| Send shielded user→account (deposit credited to AA_B) | 4 | SDK | `00840033b61dae10cea6dbd9af3637bb69b3463ddee2069231367f10e9acac00be` | **GREEN** |
| Merge: pool combines the deposited coin with the held coin | 4 | SDK | `00840033b61dae10cea6dbd9af3637bb69b3463ddee2069231367f10e9acac00be` | **GREEN** |
| Send shielded account→user (pool pays OwnerM) | 4 | SDK | `00dbe07636c98b82e7a8910de56f24e12b3ee7f711bb1772e485991a5aa9834351` | **GREEN** |
| Split: shielded contract change coin retained in the pool | 4 | SDK | `00dbe07636c98b82e7a8910de56f24e12b3ee7f711bb1772e485991a5aa9834351` | **GREEN** |
| Send unshielded user→user | 5 | wallet | `006014fa982cadce175b0fe63b569f1982d04aa2a667b3d2eae137a3bc9f9f3706` | **GREEN** |
| Split: unshielded user UTXO split into sent + change (OwnerN) | 5 | wallet | `006014fa982cadce175b0fe63b569f1982d04aa2a667b3d2eae137a3bc9f9f3706` | **GREEN** |
| Unshielded account→account internal ownership transfer, no ledger movement | 5 | SDK | `00d790d6eda6036dda9858164d60ba43db9c470eee636e9b70978f649b41734985` | **GREEN** |
| Send unshielded user→account | 6 | SDK | `00d355860b50d061506ded0910f1c25642f43a94b5a54056e7641d699433234e88` | **GREEN** |
| Send unshielded account→user | 6 | SDK | `0036eca8f6375d9004cf6ee219002530e91f61fd2c6db1eadc5a84377528d31aaf` | **GREEN** |
| Split: unshielded partial pooled-balance spend | 6 | SDK | `0036eca8f6375d9004cf6ee219002530e91f61fd2c6db1eadc5a84377528d31aaf` | **GREEN** |
| Provenance: user re-sends AA-originated shielded coins | 7 | SDK | `009e72100fcfeb95fb3dba5c79a80ba1bdfc9fa3f59ee6188ac2a6886dbdd3201b` | **GREEN** |
| Provenance: AA account re-sends user-originated shielded value | 7 | SDK | `000d138dc876a51acb3cd8ebd69572f171da6e4698ee7adcc0a0ea755332763d13` | **GREEN** |
| Provenance: user re-sends AA-originated unshielded tokens | 8 | SDK | `008a159ecf14df721a79ba52c12a2c555ec1896a99fb8287dab8e76e45c3f3593e` | **GREEN** |
| Provenance: AA account re-sends user-originated unshielded tokens | 8 | SDK | `001c9cdf26b00b74d437fc59f8012f35e8f46b2f5afbb2ee81dce911d93c8bfb2f` | **GREEN** |
| Self-send: user shielded to own key | 9 | wallet | `00a692f516cc5798c3a75478bf6b10320c85446f1033be52979b6e7d4ed112a249` | **GREEN** |
| Self-send: user unshielded UTXO self-split | 9 | wallet | `006605e5205a05660adcf595a0e986fe4ac4de8357ad2f2248f4231ae0c3586cd7` | **GREEN** |
| Self-send: pool shielded to `kernel.self()` via auto-receive | 9 | SDK | `005feb4dd26b63667f8c0868c7767eba78c3d7dd920c8a0eaa406539244074386f` | **GREEN** |
| Self-send: pool unshielded to self via auto-receive | 9 | SDK | `005e09c4f3eba61cd6f138dacad62e07cebf5217bc97b2998a5b655b2cc5fa8657` | **GREEN** |
| Invariant: `pooled holdings = AA_A + AA_B` per family, after EVERY step | 9 | derived | — | **GREEN** |

## Composition level, and the one thing the SDK could not express

The specification requires a transfer INTO the Manager to be **one transaction** containing the
sender's operation and the Manager's receive claim, because the standard library auto-receives
only when the recipient is `kernel.self()`. The answer turned out to depend on **who is sending**:

- **A user wallet → the Manager needs no cross-contract composition at all.** A *single*
  `depositShielded` / `depositUnshielded` call declares the receive, and the depositor's wallet
  supplies the input while balancing, so spend and receive share one transaction by
  construction. **SDK level.**
- **A minting contract → the Manager is not expressible in `midnight-js v5.0.0-beta.6`**
  (Finding G3-2). `withContractScopedTransaction` rejects a second contract outright, and
  `Transaction.merge` places each call in its **own segment**, so the Minter's spend claim and
  the Manager's receive claim cannot offset. These cells use the specification's documented
  **ledger-level fallback**: both `ContractCallPrototype`s are assembled into **one `Intent`**,
  mirroring `midnight-ledger/ledger/tests/token_vault_shielded.rs`. Each call's transcript still
  comes from executing the real compiled circuit through midnight-js — only the assembly is at
  ledger level, so no contract behaviour is reimplemented off-chain. Proving a two-contract
  intent uses the pinned SDK's own `ZKConfigRegistry`, which resolves each call's artifacts by
  the hash of its **deployed** verifier key.

Cells produced at ledger level: `mint-shielded-account`, `mint-unshielded-account`. Everything else is SDK level or a plain wallet transfer.
Detail: [`evidence/g3-ledger/COMPOSITION.md`](evidence/g3-ledger/COMPOSITION.md).

## Negative controls and atomicity

Each control proves BOTH that the operation is refused AND that state and funds are
byte-identical before and after.

| Control | Refused at | State + funds unchanged | Status |
|---|---|---|---|
| Wrong-owner witness: OwnerB's key cannot spend AA_A's balance | circuit execution (no transaction built) | yes | **GREEN** |
| A witness that opens no registered account is refused | circuit execution (no transaction built) | yes | **GREEN** |
| Per-account overdraw while the pool holds MORE than the requested amount | circuit execution (no transaction built) | yes | **GREEN** |
| Mint shielded into the Manager with the receive call omitted | transaction assembly / submission | yes | **GREEN** |
| Mint unshielded into the Manager with the receive call omitted | transaction assembly / submission | yes | **GREEN** |

**Atomicity.** A circuit that asserts unconditionally after its token operation can never be
*built* on this toolchain — the assert fires during local circuit execution, so no transaction
would exist and nothing about on-chain atomicity would be shown. The probes therefore use a
deferred failure, which is the only way to put a real transaction with a failing assertion in
front of the node: a full-balance withdrawal is prepared while the account holds the funds, the
account is then emptied by an internal transfer submitted from a different wallet, and the
stale withdrawal is submitted.

| Family | Outcome | Nothing survived | Status |
|---|---|---|---|
| shielded | refused at submission: Transaction submission error | yes | **GREEN** |
| unshielded | refused at submission: Transaction submission error | yes | **GREEN** |

Intra-circuit ordering (guards evaluated before effects) is a separate property, covered by the
G2 simulator suites.

## Metrics

Measured during the retained step-ledger run, at the point each thing actually happens:
`proveTx` is timed by wrapping the proof provider, and each submitted transaction is measured
by serializing it. **These cover the contract-call transactions**, which are the ones this
harness proves and submits itself. The plain wallet-to-wallet transfers (the user→user and
user self-send cells) are proven and submitted inside the wallet SDK and are therefore not
instrumented here — the figures are not a whole-run average.

| Metric | count | min | median | mean | max |
|---|---|---|---|---|---|
| Proof latency (ms) | 23 | 1 | 625 | 1644 | 6197 |
| Submitted transaction size (bytes) | 23 | 6730 | 9312 | 14250 | 34341 |

| Contract | Circuits | Verifier keys | Total verifier-key bytes |
|---|---|---|---|
| minter | 4 | 4 | 8476 |
| manager | 15 | 14 | 23522 |

Per-circuit verifier-key hashes and sizes: [`evidence/g2-contracts/ARTIFACTS.md`](evidence/g2-contracts/ARTIFACTS.md).

## Addendum A1 — multi-input coin selection (outside the 26-cell matrix)

> **Scope of this section.** Addendum A1 is **not part of the specified combination matrix**.
> It claims **none** of the 26 cells, the approved specification is **unchanged** (SHA-256 still
> `b707fc438721ebb750d301dc18c170229643c47d82ca551d739d7e4aac7c86d9`), and the G1–G4 evidence is
> untouched. It was authorized after closeout to settle one adjacent behaviour the ordered ledger
> never forced.

**The gap.** Every send in the step ledger was coverable by a **single** held coin or UTXO. The
retained step evidence shows the wallet spending exactly one piece whenever it held two — in steps
7 and 8 OwnerM held two 5-pieces and sent 5, and the survivor kept its original identifier. So
whether the pinned wallet SDK can select **two or more inputs** of a contract-minted colour in one
transaction was never actually tested.

**The probe.** OwnerN is minted **2** and **3** of the Minter's colour as *two separate
transactions*, so it holds two discrete pieces and **no single piece covers a send of 4**. OwnerN
then sends **4** to OwnerM in one transaction. Both families, identical choreography, on a fresh
stack of the addendum's own.

**Result: PROVEN in both families.**

| family | held set before | send | OwnerN after | OwnerM after | one transaction |
|---|---|---|---|---|---|
| shielded | `{2, 3}` — two coins, distinct nonces | 4 → OwnerM | `{1}`, **new** nonce | `{4}`, **new** nonce | `0054c8910f…b5b81b` |
| unshielded | `{2, 3}` — two UTXOs, distinct intent hashes | 4 → OwnerM | `{1}` | `{4}` | `009476730b…60c903` |

The claim is deliberately made on **identifier sets, not balances**: in both families **both**
original identifiers are gone from OwnerN's held set, the change piece carries a **new** identifier,
and OwnerM's received piece is new — the assertions `bothGoneFromOwnerN`, `changeIdIsNew` and
`ownerMIdsAreNew` are all true. Balances alone could not distinguish "combined two inputs" from
"spent one and received change".

Two independent observation points, as everywhere else in this project:

- **shielded** — (1) the wallet SDK's synced per-coin state; (2) the ledger conservation identity,
  which holds exactly: minted `5` = Manager pool `0` + OwnerN `1` + OwnerM `4`. A shielded coin is
  private by construction, so the indexer cannot attribute it to an owner; this ledger-side
  identity is the honest second point.
- **unshielded** — (1) the wallet SDK's synced per-UTXO state; (2) the indexer's own records: both
  consumed outputs report the **same** spending transaction `9ead2eb5…d771a065b`, which **is** the
  send transaction's hash, and that transaction created exactly `1` → OwnerN and `4` → OwnerM under
  one new intent hash. The indexer's independent UTXO reconstruction agrees with both wallets.

**Why the ordered ledger never saw this.** The pinned balancer
(`@midnightntwrk/wallet-sdk-capabilities`, `Balancer.ts`) is an accumulation loop — it adds one
input per pass until the imbalance is covered, emitting a change output on overshoot — and its
default picker takes the **smallest** coin of the type, irrespective of the amount needed. In steps
7/8 a single 5-piece already covered a send of 5, so only one was spent. Nothing was wrong with
those steps; the multi-input path was simply never exercised.

No RED was recorded, no finding was raised, and no work-around was used. The harness's RED branch
(exact error capture, funds-unchanged proof, and a separately labelled single-input control) was
implemented but not needed.

Gate wrapper `scripts/g5/verify-g5-multi-input.sh` exits **0 including teardown** in **9m16s**,
leaving **0 containers and 0 volumes**. Evidence:
[`evidence/g5-multi-input/summary.md`](evidence/g5-multi-input/summary.md),
[`shielded.json`](evidence/g5-multi-input/shielded.json),
[`unshielded.json`](evidence/g5-multi-input/unshielded.json),
[`run.log`](evidence/g5-multi-input/run.log).

## Reproduction from a clean clone (SC-004)

The G4 wrapper clones this repository into a fresh temporary directory — carrying **no**
generated artifacts, **no** `docker/.env` and **no** `node_modules`, all of which are
asserted absent — then runs the G2 and G3 gate wrappers inside that clone against a fresh
stack of its own, and compares the results cell for cell.

| | Original run | Clean-clone reproduction |
|---|---|---|
| Cells GREEN | 26/26 | 26/26 |
| Minter | `b0a96ac61f4bc71de1627657dc934b11aefab199a50dc73a115b0fcc041a28ad` | `3f7de5d25f798768bd07f110fead5bc71b9d659c5d711fda52462a8200e9de55` |
| Manager | `1d838367033c26ea83bcfde405851aeec45057390dd364ca6632299d6c39e183` | `10522fb9c3636d84d95a05d88ec6dc164cdfc965b49c200da716e336cadcca5e` |

Addresses and transaction ids necessarily differ — the reproduction runs on a brand-new
chain — so the comparison is over what the specification actually asserts: each cell's
verdict, its step, and its composition level.

## How to reproduce

```sh
./scripts/g1/verify-g1-lane.sh        # lane: pinned digests, fresh chain, wallets, DUST
./scripts/g2/verify-g2-contracts.sh   # contracts: compile + simulator suites + artifact record
./scripts/g3/verify-g3-ledger.sh      # the whole step ledger on a fresh stack of its own
./scripts/g4/verify-g4-closeout.sh    # clean-clone reproduction + this report
./scripts/g5/verify-g5-multi-input.sh # ADDENDUM A1 (outside the matrix): multi-input sends
```

Each wrapper owns its own disposable Docker stack under a compose project name unique to the
run, on random host ports above 10000 verified free beforehand, and tears down only its own
containers and volumes. A run is green only when the process exits zero **including teardown**.

## Scope and honest limits

- `EXPERIMENTAL_LANE` throughout: a prerelease slot with no supported-bundle guarantee, plus
  the `LANE-DEV-1` compiler deviation. Nothing here is a supported-lane or production claim.
- Local fresh `undeployed` ledger-9 network only. No Devnet, Stagenet, testnet or mainnet.
- No browser, relayer, sponsorship, EIP-712/secp256k1, `kernel.caller()` dependency, Umbra, or
  production hardening. Owner authorization is by witness, which is sound here only because the
  Manager is always invoked in root position.
- The Manager is a demonstration custodian, not a product: any party may request minting, and
  the pooled shielded holding is deliberately a single coin.
