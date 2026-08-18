# 00004-multi-token-custody — final report

**Four contract-minted colours, one Manager contract, simultaneously.**

> **`EXPERIMENTAL_LANE` / `LANE-DEV-1`.** Every result below was produced on the pinned
> **v2.0.0-rc.4 prerelease slot** on a local, fresh `undeployed` ledger-9 network — the SAME lane
> as project 00003, verified as reused rather than re-pinned. The official compatibility matrix
> lists no supported coherent 2.x application bundle, so this lane is deliberately experimental.
> **No result here may be extrapolated to a supported or production lane**, and nothing here is a
> production-readiness claim.

## Headline result

ONE Manager contract custodied **all four colours at once** — two shielded pools keyed by colour
and two unshielded balances held by the ledger kernel — through a 14-row step ledger that asserted
the FULL 4-party x 4-colour table (16 cells), both pools, both unshielded contract balances and the
per-colour invariant **after every single step**. The run ends exactly on the specification's
normative final table:

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 2 |
| OwnerM | 3 | 2 | 0 | 3 |
| AA_A | 3 | 0 | 5 | 0 |
| AA_B | 0 | 8 | 0 | 5 |
| pool / ledger | poolS1=3 | poolS2=8 | ledgerU1=5 | ledgerU2=5 |

Every colour sums to **10** (= minted); each pool or ledger balance equals the sum of its AA column.
The four claims the project set out to prove, and where each is evidenced:

| Claim | Result | Evidence |
|---|---|---|
| **Four colours, one Manager, simultaneously** | poolS1=3 and poolS2=8 coexist as separate map-keyed pooled coins while the kernel holds U1=5 and U2=5 | step 7 onward, [`evidence/g3-ledger/step-13/step.json`](evidence/g3-ledger/step-13/step.json) |
| **Per-colour isolation** | any cell moving that a step did not name is a step FAILURE; the check is an enumeration of raw ledger state, not a lookup of remembered cells | cells `invariant-per-colour`, `enumeration` |
| **Owner-only spend** (owner-designated critical) | proven three independent ways — no witness, wrong account, wrong colour — each refused by the contract's own assert | NC-1, NC-2, NC-3 |
| **Mixed-colour atomicity** | two different colours moved in ONE transaction id `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6`, and the same shape with one leg invalid commits NOTHING | M1, M2 |

**25 of 25 checklist items GREEN**, 0 RED, no gaps.

## The pinned lane — reused, not re-pinned

This project inherits 00003's component set unchanged. That is proven rather than asserted: every
gate wrapper re-runs `lane_assert_pins_unchanged` before it boots anything, which compares this
branch against the base commit `a8ebff9` five ways — the `sha256:` image digests in
`docker/compose.yml`, the compiler archive's `ARG COMPACTC_URL` + `ARG COMPACTC_SHA256`, a
byte-identical `harness/pnpm-lock.yaml`, an unchanged dependency block, and
`docker compose config --images` resolving to exactly the three pinned digests (never a tag).

| Component | Pin |
|---|---|
| node | `node-2.0.0-rc.4` @ `sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e` |
| indexer | `v4.4.0-rc.1` @ `sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a` |
| proof server | `9.0.0-rc.3` @ `sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f` |
| ledger | `ledger-9.1.0.0-rc.3` (`@midnightntwrk/ledger-v9@1.0.0-rc.3`) |
| midnight-js | `v5.0.0-beta.6` |
| wallet SDK | `@midnightntwrk/wallet-sdk@2.0.0-beta.2` |
| compiler | `compactc 0.33.0` / language `0.25.0` — **deviation `LANE-DEV-1`** |

**`LANE-DEV-1`** (inherited): the spec pins `compactc-v0.33.0-rc.2`, which has no published
binary; the released `compactc-v0.33.0` is substituted with owner approval. This project closed the
two checkboxes 00003 left untouched — gate step `03-lane-dev-1` now asserts the installed
compiler's reported compiler version (`0.33.0`) and language version (`0.25.0`) against the pinned
rc.2 reference source on every run. Manifest: [`evidence/g1-lane/LANE.md`](evidence/g1-lane/LANE.md).

## What was built

### `minter.compact` — one source, a colour family per deployment (FR-101)

The domain separator moved into the **constructor**, per owner decision Q1. The contract stores
`sep_family = persistentHash<Vector<2, Bytes<32>>>([tag, familyTag])` for each family, and colours
stay `tokenType(sep_family, kernel.self())` — so two deployments of the SAME compiled artifact
differ twice over, by tag AND by address. Three deployments (`TOKA`, `TOKB`, `TOKC`) yield six
colours; the six are **15/15 pairwise distinct**, read from on-chain circuit calls rather than
derived off-chain.

### `manager.compact` — colour-keyed custody in ONE contract (FR-102..FR-106)

Decision **D-101** took FR-103's *preferred* representation after compile probes proved it
available on the pinned compiler; the pre-approved fixed-slot fallback was not needed.

- `pools: Map<Bytes<32>, QualifiedShieldedCoinInfo>` — one pooled coin **per shielded colour**,
  keyed by colour. A map slot is not a `Cell`, so the write is `insertCoin(colour, coin, recipient)`
  and presence is `pools.member(colour)` rather than a companion boolean.
- `balances: Map<Bytes<32>, Uint<128>>` keyed by `persistentHash([account, colour])` — the flat
  composite-key form. `registerAccount` seeds all four configured colours at zero, so
  `balances.size()` is itself an invariant (`accounts x 4`) and "no other cell moved" becomes an
  **enumeration of real ledger state** instead of a lookup of the cells the harness remembered.
- `balanceKey` is exported as a PURE circuit (no ledger access -> no proving key -> it lands in the
  generated `pureCircuits`), so the harness derives every ledger key **by running the contract's own
  code** rather than reimplementing the hashing scheme off-chain.
- Guard order in every debiting circuit: witness choke point -> colour-is-configured ->
  **per-(account, colour) balance** -> pool / contract-ledger balance.

| Contract | Source SHA-256 | Circuits | Verifier keys |
|---|---|---|---|
| `minter.compact` | `5eefba98962ddbef4af6b1ea4d17c21f37baf1d712c5822be0a7b4c245d6c1ef` | 4 | 4 |
| `manager.compact` | `3a6c71013e81490f2bb8869f08ea3e1e8abe39f63966dd35f49dd76f15609ff3` | 13 | 11 |

The Manager declares 13 circuits but emits 11 keys: `myAccount` and `balanceKey` touch no ledger
state. Per-artifact hashes: [`evidence/g2-contracts/ARTIFACTS.md`](evidence/g2-contracts/ARTIFACTS.md).

## Deployment of record (the retained G3 run)

| What | Value |
|---|---|
| Manager | `10ea8ca47a36e89a6534148161355156ce2b1cd372ac748502cb273b29cba901` |
| Minter1 (constructor tag `TOKA`) | `8ff81b38627d0a611c3c558eed28b859b0b5e1b9ea88159caee4ae6bc257e692` |
| Minter2 (constructor tag `TOKB`) | `4cf57bdd66fa67d51305194bf68b6611b14261f31e21cfcfee8593cee742a0a0` |
| Minter3 (constructor tag `TOKC`) | `c4b9aec02d9d45d75ffcb7a5bc1d5223658d6130232fcdd09752ab9fa3b4b14f` |
| S1 | `9c77d2fb6250482c9c7bff6f8ceedc71f687b8d502383b33012f9602d711d888` |
| S2 | `6dda5d892a426e5776ecb97c6b6ff0131f1bb3f39da6457f8b1d32cc5c0032ab` |
| U1 | `888080b72e0f350e6599b3d146a26585a4462a6ec08cea9424b5144785ec0ad3` |
| U2 | `90c789c4d6d5bfe7d01f9084e8d337b1a096b4fa272d0eca3958db9404603ca0` |
| control colour, NEVER configured (Minter3 shielded) | `e9325f1bfbc367ffbd60b40342b9d4f0b6783e1e611a32ccd700aac7fa2c22bd` |
| control colour, NEVER configured (Minter3 unshielded) | `783bdd8bbde7ee60f214bab51531e268391e5c8e9939d4f593a45c3954e8579b` |
| AA_A (OwnerA) account id | `67105e92521d24ccd0b0ee9d2ff842aec4b0dbfb81123b2143c9512fe6f114e7` |
| AA_B (OwnerB) account id | `e01c3be2d447aa46f6b9a9d8ab6b0f5fef285782b0b6af40bea330a59de33e92` |
| Colour distinctness | 15/15 pairwise comparisons distinct, 0 collisions |
| Total minted | S1 10, S2 10, U1 10, U2 10 |

Constructor parameterization was de-risked before any product contract was written: probe P2
deployed ONE compiled artifact TWICE with different constructor arguments and read the results back
through two independent observation points (indexer contract state, and real on-chain colour
circuit calls) — [`evidence/g1-lane/probes/p2-deploy.json`](evidence/g1-lane/probes/p2-deploy.json).

## The step ledger, as observed

Each party cell is `S1/S2/U1/U2`; the custody column is the same quadruple for the Manager's own
holdings (pooled shielded coin, or the ledger kernel's unshielded balance). Every row is the
**observed** value, asserted equal to the specification's expected value before the run was allowed
to continue — the first divergence would have halted it.

| Step | Action | OwnerN | OwnerM | AA_A | AA_B | custody S1/S2/U1/U2 |
|---|---|---|---|---|---|---|
| 0 | baseline — deploy 3 Minters + 1 Manager, configure S1/S2/U1/U2, register AA_A and AA_B | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 1 | Minter1 mints S1 10 -> OwnerN | 10/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 2 | Minter1 mints U1 10 -> OwnerN | 10/0/10/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 3 | Minter2 mints S2 10 -> OwnerM | 10/0/10/0 | 0/10/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 4 | Minter2 mints U2 10 -> OwnerM | 10/0/10/0 | 0/10/0/10 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 5 | OwnerN deposits S1 6 -> AA_A | 4/0/10/0 | 0/10/0/10 | 6/0/0/0 | 0/0/0/0 | 6/0/0/0 |
| 6 | OwnerN deposits U1 5 -> AA_A | 4/0/5/0 | 0/10/0/10 | 6/0/5/0 | 0/0/0/0 | 6/0/5/0 |
| 7 | OwnerM deposits S2 6 -> AA_B | 4/0/5/0 | 0/4/0/10 | 6/0/5/0 | 0/6/0/0 | 6/6/5/0 |
| 8 | OwnerM deposits U2 5 -> AA_B | 4/0/5/0 | 0/4/0/5 | 6/0/5/0 | 0/6/0/5 | 6/6/5/5 |
| 9 | internal transfer S1 3: AA_A -> AA_B (no token operation) | 4/0/5/0 | 0/4/0/5 | 3/0/5/0 | 3/6/0/5 | 6/6/5/5 |
| 10 | internal transfer U2 2: AA_B -> AA_A (no token operation) | 4/0/5/0 | 0/4/0/5 | 3/0/5/2 | 3/6/0/3 | 6/6/5/5 |
| 11 | AA_B withdraws S1 3 -> OwnerM | 4/0/5/0 | 3/4/0/5 | 3/0/5/2 | 0/6/0/3 | 3/6/5/5 |
| 12 | AA_A withdraws U2 2 -> OwnerN | 4/0/5/2 | 3/4/0/5 | 3/0/5/0 | 0/6/0/3 | 3/6/5/3 |
| 13 | M1 mixed-colour probe: OwnerM deposits S2 2 AND U2 2 to AA_B in ONE transaction | 4/0/5/2 | 3/2/0/3 | 3/0/5/0 | 0/8/0/5 | 3/8/5/5 |

Deliberate non-goals inside the ledger (owner decision Q3): S2 has no internal transfer and U1 has
no withdrawal — those rails are proven in 00003 and each is exercised here in at least one colour
per family. **The resting sibling colour is itself an assertion**: custody of a colour at rest must
survive activity in every other colour, which the 16-cell check enforces at every step.

### How every cell is observed (FR-108)

| Cell class | Point 1 | Point 2 | Point 3 |
|---|---|---|---|
| AA_A / AA_B, per colour | the Manager `balances` map decoded from contract state, every key reproduced by the contract's own pure `balanceKey` circuit | the custody side of that colour — pooled zswap coin or the ledger kernel's unshielded balance — via the per-colour invariant | a real on-chain `accountBalance` circuit call, rotating across all eight AA cells |
| OwnerN / OwnerM, unshielded | a read-only OBSERVER wallet that never submitted anything | the UTXO set reconstructed from the indexer's own transaction history | — |
| OwnerN / OwnerM, shielded | the same observer wallet, coin by coin | the conservation identity `minted[c] == custody[c] + OwnerN[c] + OwnerM[c]` | — |

**Why observer wallets exist at all: finding F-104.** On this lane a wallet that SUBMITTED a
transaction under-reports its own balance afterwards and does not self-correct, while still
returning `progress.isStrictlyComplete() === true`. No submitting wallet is an observation point
anywhere in this project.

## Checklist — every step, probe and control

| Item | Step | Level | Transaction id(s) | Status |
|---|---|---|---|---|
| Baseline: all 16 cells 0, no pools, no contract balances | 0 | SDK | `00542cbc80ba05c1617401201af6cb0a45825cd2e3de62f734638d83a6f5058303`<br>`004a6bed745684b9917ee6f222ed55cac3f35284c8b06ca3c0fb46bb1dc07f8673`<br>`00b74f8069638b56e7980166218959546c5f7730c87939efe49ff1fd39731b2c52`<br>`00b2901bb9133826430be1db4c632338401fc0652f60758ab2b2685a4b231da2a1` | **GREEN** |
| Distinctness: all 6 colours (4 configured + 2 control) pairwise distinct from on-chain reads | 0 | SDK | — | **GREEN** |
| Minter1 mints S1 10 -> OwnerN | 1 | SDK | `0045181cb47aedb1844393713a0f31d400936cf568fcef792a05e8f1ddd20b2355` | **GREEN** |
| Minter1 mints U1 10 -> OwnerN | 2 | SDK | `008a147ce27f42faf4bf6a4f0742bed37bccc29359379ab4b4d5d404a18e92e6b0` | **GREEN** |
| Minter2 mints S2 10 -> OwnerM | 3 | SDK | `0086d01bd3b658f8f067eb0e01752a0a528e50a5872c94a37cb77a10ebf849c0ab` | **GREEN** |
| Minter2 mints U2 10 -> OwnerM | 4 | SDK | `002b24b97c2c2df2227dbb1cc4e599661099bd51fbcd9f063a6aa8d94a81529104` | **GREEN** |
| OwnerN deposits S1 6 -> AA_A | 5 | SDK | `0057e73c1475975b379ed58c260e6d621b531f20a7ea68cbd078badb9b068bc047` | **GREEN** |
| OwnerN deposits U1 5 -> AA_A | 6 | SDK | `00469a8269b3b43a46fb26199a7255d5510aa616867c71fd9cbb34d6fd70c73162` | **GREEN** |
| OwnerM deposits S2 6 -> AA_B | 7 | SDK | `00216963a7f4cdcae2294a234989730e8ba51fffdf44b221f8702e759a97ce455d` | **GREEN** |
| OwnerM deposits U2 5 -> AA_B | 8 | SDK | `0086ae50203ff22ae3659888abb8bf6d663a7f954574f415468761dabe5919b437` | **GREEN** |
| internal transfer S1 3: AA_A -> AA_B (no token operation) | 9 | SDK | `0086407dadb4024f765779716a66662228701e654b38c7cc32dcbf1b0d985ddf96` | **GREEN** |
| internal transfer U2 2: AA_B -> AA_A (no token operation) | 10 | SDK | `00660b98f793ce3a494e31e96253d79289906cf9b8a9968db2acf57e27b2c8b4f2` | **GREEN** |
| AA_B withdraws S1 3 -> OwnerM | 11 | SDK | `00d39ad68196e8426254c45c9f59382cf0f161a1dad69aad0eebad4b55d9fb9850` | **GREEN** |
| AA_A withdraws U2 2 -> OwnerN | 12 | SDK | `00954729ff02920dbd2f91eca1a1aa20cf546f53e6e2c7101f2597be0a51290bc9` | **GREEN** |
| M1 mixed-colour probe: OwnerM deposits S2 2 AND U2 2 to AA_B in ONE transaction | 13 | SDK | `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` | **GREEN** |
| M1 — mixed-colour composition: two colours move atomically in ONE transaction (FR-107) | 13 | SDK | `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` | **GREEN** |
| Invariant: `custody[c] == AA_A[c] + AA_B[c]` for all four colours, after EVERY step | 0-13 | derived | — | **GREEN** |
| FR-105 exactness: `balances.size() == accounts x 4` with ZERO unaccounted keys, after every step | 0-13 | derived | — | **GREEN** |
| Owner-only / unregistered: OwnerN's witness opens no Manager account | NC-1 | SDK | — | **GREEN** |
| Owner-only / cross-account: OwnerB's witness cannot reach AA_A's S1, though the pool covers it | NC-2 | SDK | — | **GREEN** |
| Cross-colour: AA_A is rich in U1 (and S1) but holds no S2 at all | NC-3 | SDK | — | **GREEN** |
| Wrong colour / named: an unshielded deposit naming Minter3's colour, which `configure` never admitted | NC-4a | SDK | — | **GREEN** |
| Wrong colour / carried: a REAL shielded coin minted by Minter3 offered to `depositShielded` | NC-4b | SDK | `00699894645fd54957523e2105d038abbf6de94cf7c10965df7de509ea7851d002` | **GREEN** |
| Internal transfer colour guard: AA_A moves S2 it does not hold, while holding S1 and U1 | NC-5 | SDK | — | **GREEN** |
| M2 — mixed-colour atomicity negative: the step-13-shaped transaction with the second leg wrong-coloured | M2 | SDK | — | **GREEN** |

Full index with observation points and per-row notes:
[`evidence/g3-ledger/CELLS.md`](evidence/g3-ledger/CELLS.md).

## Owner-only spend — the owner-designated critical requirement (FR-104)

Owner decision Q2 was *"One manager is critical, we mus make sure only the owner can spend"*. That
is attacked from three independent directions, and each attack is refused by the contract's OWN
assert — not by a wallet error, not by a balancing failure:

| Control | The attack | Refused with |
|---|---|---|
| **NC-1** | Owner-only / unregistered: OwnerN's witness opens no Manager account | `failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'withdrawShielded'` |
| **NC-2** | Owner-only / cross-account: OwnerB's witness cannot reach AA_A's S1, though the pool covers it | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'` |
| **NC-3** | Cross-colour: AA_A is rich in U1 (and S1) but holds no S2 at all | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'` |

NC-2 is the sharp one: **the pool covers the request and the withdrawal is still refused**, because
the per-account guard sits BEFORE the pool guard. NC-3 is its cross-colour twin: AA_A holds
`U1=5` and `S1=3` and the S2 pool is rich, yet AA_A cannot touch one unit of S2. Wealth in one
colour is unspendable in another.

## Wrong-colour rejection and the atomicity negative

| Control | The attack | Refused with |
|---|---|---|
| **NC-4a** | Wrong colour / named: an unshielded deposit naming Minter3's colour, which `configure` never admitted | `failed assert: colour is not a configured unshielded colour \| cause: Error executing circuit 'depositUnshielded'` |
| **NC-4b** | Wrong colour / carried: a REAL shielded coin minted by Minter3 offered to `depositShielded` | `failed assert: colour is not a configured shielded colour \| cause: Error executing circuit 'depositShielded'` |
| **NC-5** | Internal transfer colour guard: AA_A moves S2 it does not hold, while holding S1 and U1 | `failed assert: account colour balance too low \| cause: Error executing circuit 'transferInternal'` |
| **M2** | M2 — mixed-colour atomicity negative: the step-13-shaped transaction with the second leg wrong-coloured | `Unexpected error executing scoped transaction 'aa00004-mixed-colour': Error: failed assert: colour is not a configured unshielded colour \| cause: failed assert: colour is not a configured unshielded colour \| cause: Error executing circuit 'depositUnshielded'` |

**NC-4b carries a REAL coin**, not a fabricated argument: Minter3 genuinely mints a shielded coin of
an unconfigured colour to OwnerM, and that on-chain coin is then offered to `depositShielded`.
`configure` is the only gate that admits a colour.

Every one of these proves **three** things, not two: the rejection happened; the message is the
CONTRACT'S own assert (an unrelated failure recorded as "the guard did its job" would be worthless);
and the full 16-cell table, both pools (value AND nonce), both unshielded contract balances, the raw
`balances` map and both users' coins/UTXOs are **byte-identical** across the attempt, re-read after a
settle delay so "unchanged" is an observation rather than a race.

All 7 are GREEN with the message matched and funds byte-identical: `NC-1`, `NC-2`, `NC-3`, `NC-4a`, `NC-4b`, `NC-5`, `M2` — [`evidence/g3-ledger/negative-controls.json`](evidence/g3-ledger/negative-controls.json).

## Mixed-colour composition — M1, decision D-102, and the one unexplained refusal

Step 13 moves **two different colours in ONE transaction**: `depositShielded(S2, 2)` merging into an
already non-empty pool AND `depositUnshielded(U2, 2)`, both crediting AA_B, under a single
transaction id:

| What | Value |
|---|---|
| Transaction | `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` |
| Circuits in it | `depositShielded` + `depositUnshielded` |
| Shape used | sdk-scoped batch (one transaction, one segment per call, state threaded) |
| Effects | poolS2 6 -> 8 with AA_B S2 6 -> 8, AND the kernel's U2 balance 3 -> 5 with AA_B U2 3 -> 5 |

**D-102 resolved to SAME-CONTRACT composition** — FR-107's cross-contract fallback was never needed
— and BOTH same-contract mechanisms are proven to work on this lane:

| Shape | Proven by |
|---|---|
| one ledger `Intent` (FR-107's preferred; 00003 R8 machinery) | probe, live tx `006acec476e3342ba919d6f89a6367b25aeea6b0548aef5f57f2e4e4767e115e2e` — the exact step-13 shape INCLUDING the pool merge, poolS2 8 -> 10 |
| SDK scoped batch (`withContractScopedTransaction`) | the gate itself, tx `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6` |

**The gate takes the scoped batch, and that is an honest "both work, one of them here" rather than a
clean win for the preferred shape.** In the gate's own state the one-Intent assembly is refused at
submission with a bare `1010: Invalid Transaction: Custom error: 223`
([`evidence/g3-ledger/11-step-ledger.out`](evidence/g3-ledger/11-step-ledger.out)) and nothing usable
in the SDK's error chain. Two hypotheses were raised and **both were killed by evidence rather than
argued away**: that the ledger forbids two calls to one contract in an intent (false — probe round 1
accepts them), and that a shielded and an unshielded receive cannot share a transaction (false —
same probe). Probe round 2 then committed the exact merging step-13 shape in one intent.

### What error 223 actually is

Decoded against the pinned read-only reference tree after the gate was green:

- **223 = `SequencingCheckError::CausalityConstraintViolation`** — numeric mapping at
  `midnight-node/ledger/src/versions/common/types.rs:508-515`, raised from `stx.sequencing_check()`
  in `midnight-ledger/ledger/src/verify.rs:655`.
- `relate_nodes` (`verify.rs:1162-1175`) creates an **unconditional precedence edge between any two
  calls sharing a contract address** — entry point irrelevant, accumulated within one intent as well
  as across intents. `causality_check` (`verify.rs:936-964`) rejects any edge running
  fallible -> guaranteed. A call carrying BOTH transcripts sits in both sets, so two both-transcript
  calls to one address always produce the forbidden edge.
- This is **codified intended behaviour**, not a bug: ledger test `causality_check_sanity_check`
  (`ledger/tests/intent.rs:1021`) asserts the rejection of exactly this shape, and the spec rule is
  at `midnight-ledger/spec/intents-transactions.md:90-110` — for one address, at most one call with
  both transcripts, guaranteed-only calls before it, fallible-only after. The legal shape is
  demonstrated by `relate_nodes_same_address_ordering` (`verify.rs:2451`).
- **No shielded/unshielded mixing rule exists** — the family distinction was a red herring; only
  transcript section shapes matter.

That exactly explains the divergence: the gate's carrier put its zswap offer in the **fallible**
section (`guaranteedZswapOffer: null, fallibleZswapOffer: present`) while the probe's sat in the
**guaranteed** section, and only the former produces the fatal edge. **One narrow unknown remains and
is recorded rather than papered over**: why the same circuit on the same merge branch places its
zswap offer in different sections in the two states. It changes nothing about FR-107, which requires
both effects under one transaction id and gets exactly that.

**M2, the atomicity negative**, uses whichever shape M1 actually landed with, so it is genuinely the
step-13-shaped transaction rather than a lookalike. Its valid shielded leg is built FIRST and in
full; the wrong-coloured second leg then throws during circuit execution and the composed
transaction is discarded unsubmitted. "No partial credit" is therefore measured against a
**demonstrated positive** — step 13 committed that exact valid leg when its partner was well-formed.

## Findings

| Id | Finding |
|---|---|
| **F-101** | Colour-keyed ledger maps ARE supported on the pinned compiler — `Map<Bytes<32>, QualifiedShieldedCoinInfo>` compiles under `--skip-zk` AND full `--zk`, as do nested maps. The spec's "no prior art" statement was too narrow; prior art exists in the compiler's own passing test suite (`compact/compiler/test.ss:80209-80227`) and reference examples. D-101 therefore takes the PREFERRED representation. |
| **F-102** | The pinned midnight-js deploy path accepts constructor arguments: `deployContract({..., args: [tag]})` applies them on-chain, so one compiled source deployed twice yields distinct colours. Constructor arguments are witness data and must be `disclose`d before reaching ledger state. |
| **F-103** | An inherited G1 harness wait was never exercised by 00003 (its `fundWithNight` sender-settled wait landed AFTER 00003's G1 evidence, and G1 was never re-run). It took 00004's first G1 attempt RED, and the first hypothesis — "the shared host is slow" — was WRONG, which the second RED run (933 s) disproved rather than confirmed. |
| **F-104** | **The submitting wallet under-reports its own balance and claims to be strictly synced while doing so.** A wallet that sent a transfer settled on `199000000000000` over 4 UTXOs for 15+ minutes with `isStrictlyComplete() === true`, while a wallet freshly opened on the SAME seed and chain read the correct `249000000000000` over 5 UTXOs. The chain, node and indexer are all correct; only the submitting wallet's in-memory view is wrong, and it does not self-correct. An exact-equality wait against that stream is therefore UNSATISFIABLE — no timeout could ever have fixed it. This is why every observation point in this project is a wallet that did not submit. |
| **F-105** | FR-101 holds on the PRODUCT contract, not just the probe: one artifact, three constructor tags, six colours, 15/15 pairwise distinct from on-chain reads. Each deployment's on-chain separators were independently re-derived in process by the SEPARATELY COMPILED `--skip-zk` artifact and matched exactly — which incidentally proves the `--zk` and `--skip-zk` builds agree. |
| **F-106** | The seeded-table trick makes "no other cell moved" **checkable**, not merely assertable: because `registerAccount` seeds all four colours at zero and `balanceKey` is a pure exported circuit, the harness reproduces every key in raw ledger state by running the contract's own code, and `balances.size()` bounds the table. FR-105 becomes an enumeration rather than a lookup. |
| **F-107** | **A wallet that cannot yet see a leg's funds produces a transaction the NODE refuses, with an unusable code.** The failure is silent wallet-side: `balanceTx` does not raise `InsufficientFunds`, it balances into something the node rejects as `1010: Invalid Transaction: Custom error: 223`. It cost two gate runs and two diagnostic probes to separate from three plausible, wrong hypotheses. Two lessons, both implemented: wait on EVERY leg's funds before building a multi-leg transaction, and capture the whole `cause` chain plus a structural dump of the assembled transaction, because a bare node rejection code is not a diagnosis. |

Two of these were **my own bugs, recorded as such rather than dressed up as lane findings**: the G1
digest check that was applied to a file pinning by bare hex (no pin was ever wrong), and a probe
fixture that spent its own budget before the case that needed it. A third, `createUnprovenCallTx`
being used where `submitCallTx` was required, was a latent defect **inherited from 00003's unused
same-contract path** — it had never been exercised there, so D-102 was a genuinely open question.

## Run history — recorded honestly

| Gate | Attempts | Outcome |
|---|---|---|
| G1 | 4 | RED (my check bug) -> RED, RED (F-103/F-104, including one 933 s burn on a wrong hypothesis) -> **GREEN** |
| G2 | 1 | **GREEN on the first attempt** |
| G3 | 3 runs + 2 diagnostic probes | RED at step 13 -> RED at step 13 -> **GREEN**. Steps 0-12 were GREEN in every run, reproducibly, on independent stacks. |

The two G3 REDs are the substance of F-107 and D-102: the first exposed a real defect in the
composition machinery (unshielded offers live on the INTENT, zswap offers on the TRANSACTION) plus a
broken fallback; the second proved both fixes worked and surfaced the readiness gap that was the
actual blocker.

## Metrics

Measured during the retained G3 run at the point each thing actually happens: `proveTx` is timed by
wrapping the proof provider, and each submitted transaction is measured by serializing it. These
cover the **contract-call** transactions this harness proves and submits itself; plain
wallet-to-wallet transfers are proven inside the wallet SDK and are not instrumented, so the figures
are not a whole-run average.

| Metric | count | min | median | mean | max |
|---|---|---|---|---|---|
| Proof latency (ms) | 42 | 0 | 604 | 1286 | 6708 |
| Submitted transaction size (bytes) | 42 | 6880 | 8752 | 12412 | 45522 |

The maxima are the interesting ones and both belong to the same operation: the mixed-colour
transaction is the largest (~44 KB) and the slowest to prove (~6.7 s), because it carries two
contract calls, one of them merging a pooled coin.

Wall-clock, on a shared host running other stacks: the live G3 half took **1128 s**; a cold pull of
the pinned digests took **673 s** once (~11 minutes) when no warm copy existed.

## Reproduction from a clean clone

_Not yet reproduced in this working tree: run `./scripts/g4/verify-g4-closeout.sh`, which performs
the clean-clone reproduction and regenerates this section from the clone's own evidence._

### How to reproduce

```sh
./scripts/g4/verify-g4-closeout.sh    # clean clone -> G1 -> G2 -> G3 -> compare -> this report
```

or gate by gate:

```sh
./scripts/g1/verify-g1-lane.sh        # lane reuse proof, compile probes, funded wallets  (~8 min)
./scripts/g2/verify-g2-contracts.sh   # compile, deploy 3 Minters + Manager, configure    (~20 min)
./scripts/g3/verify-g3-ledger.sh      # the whole 14-row ledger + controls from nothing   (~23 min)
```

Prerequisites: Docker, Node 22+, pnpm. The Compact compiler runs inside a pinned Docker image.
Each wrapper picks random host ports above 10000 **verified free**, binds them to `127.0.0.1` only,
owns a uniquely named compose project, and is green **only on exit 0 including teardown** — a
leftover container, volume or network makes the gate RED even when every step passed.

## Scope and honest limits

- `EXPERIMENTAL_LANE` / `LANE-DEV-1` throughout: a prerelease slot with no supported-bundle
  guarantee. Nothing here is a supported-lane or production claim.
- Local fresh `undeployed` ledger-9 network only. No Devnet, Stagenet, testnet or mainnet.
- Per-rail mechanics (split/change, multi-input selection, merge, self-send, UTXO semantics) are
  **not** re-proven per colour — they are 00003's results, and owner decision Q3 was to run the new
  tests only. What is new here is multi-colour custody, isolation and composition.
- Owner authorization is by witness, which is sound here only because the Manager is always invoked
  in root position. No `kernel.caller()`, no browser, relayer, sponsorship or production hardening.
- The Manager is a demonstration custodian, not a product: any party may request minting, and each
  shielded colour is deliberately held as a single pooled coin.
- Four colours is not "arbitrarily many": the Manager binds exactly four in a one-time `configure`.
  The map-keyed representation generalises, but only four were proven.

## Reading order

[`README.md`](README.md) -> this report -> [`evidence/g3-ledger/CELLS.md`](evidence/g3-ledger/CELLS.md)
-> [`evidence/g2-contracts/CONTRACTS.md`](evidence/g2-contracts/CONTRACTS.md)
-> [`evidence/g1-lane/LANE.md`](evidence/g1-lane/LANE.md) -> [`VERIFICATION.md`](VERIFICATION.md).

Project 00003's own deliverables are preserved unmodified under
[`archive/00003/`](archive/00003/ARCHIVE.md).
