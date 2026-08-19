# 00005-open-colour-custody — final report

**A custodian deployed before anything that could mint, custodying colours nobody told it about.**

> **`EXPERIMENTAL_LANE` / `LANE-DEV-1`.** Every result below was produced on the pinned
> **v2.0.0-rc.4 prerelease slot** on a local, fresh `undeployed` ledger-9 network — the SAME lane
> as projects 00003 and 00004, verified as INHERITED rather than re-pinned. The official
> compatibility matrix lists no supported coherent 2.x application bundle, so this lane is
> deliberately experimental. **No result here may be extrapolated to a supported or production
> lane**, and nothing here is a production-readiness claim.

## Headline result

The Manager was deployed in **block 45**, when the chain tip was
**42** and **no contract of this demonstration existed at all**.
It has no `configure` circuit, no colour list, no allowlist and no admin authority of any kind —
there is no way to tell it about a colour. It nevertheless ends an 18-row walk custodying **four
shielded pools and three unshielded ledger balances**, one of them for a colour whose issuing
contract (TOKD) was not deployed until **block 172** — after the Manager had already worked through rows 0–14.

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 0 | 5 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 0 |
| AA_A | 3 | 0 | 4 | 7 | 3 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 4 |
| pool / ledger | 6 | 4 | 4 | 7 | 3 | 5 | 0 | 4 |

End-state map sizes, asserted exactly: **{"pools":4,"shieldedCells":5,"unshieldedCells":3}** — checked
against the specification's separately written figures, not derived from the walk. `U3` is
dormant: minted by nobody, deposited by nobody, **absent from every map at every row**.

| Claim | Result | Evidence |
|---|---|---|
| **Colours unknown at deploy** (FR-205) | Manager in block 45; TOKA/TOKB/TOKC in 57/67/76; **TOKD mid-ledger in 172**; at block 45 the indexer answers `null` for every one of their addresses, asked two ways | steps 0, 1, 15, 16 |
| **Lazy custody creation** (FR-202) | rows 0–6 create NOTHING — deploy, register both accounts, mint five colours, and all three maps are still size 0. The first pool appears at row 7, on a first credit | `map-sizes` cell, every `step-N/step.json` |
| **No state on a refusal** (FR-202/206) | every control asserts all three map sizes unchanged AND names the exact cell still absent afterwards | NC-1..5 |
| **Family-scoped storage** (FR-203) | ONE 32-byte colour, minted in both families, custodied as pool `3` and contract ledger balance `2` at the same time; two on-chain circuit calls taking the IDENTICAL argument answered `2` and `1` | P-COLL |
| **Owner-only spend** (FR-204, carried critical) | the witness choke point and the per-(account, colour) guard, which reads a MISSING cell as 0 and refuses BEFORE any pool guard | NC-1, NC-2, NC-3, NC-5 |
| **Atomic double lazy-init** (FR-207) | ONE transaction id `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` carried the FIRST deposits of two brand-new colours: 5/6/4 → 6/7/5. **The composition is an existence result, not a reliable one** — its first attempt is refused every time, and one G4 reproduction never landed it and used FR-207's fallback; the lazy-init half reproduces identically either way | M3 |

**30 of 30 checklist items GREEN**, 0 RED, no gaps, nothing RECORDED.

## The deploy-order proof — the claim everything else rests on

An open custodian is only interesting if it really could not have known the colours. That is
proven rather than asserted, from indexer data, two independent ways, with the Manager itself as
the **discriminating control** — so a `null` is an answer rather than an artefact of asking badly:

| Contract | Deploy block | Strictly after the Manager | `contractAction` at the Manager's block | `contract(…)` at-or-before it |
|---|---|---|---|---|
| **Manager** | **45** | — (control) | **present** | **present** |
| Minter1 (`TOKA`) | 57 | yes | `null` — did not exist | `null` — did not exist |
| Minter2 (`TOKB`) | 67 | yes | `null` — did not exist | `null` — did not exist |
| Minter3 (`TOKC`) | 76 | yes | `null` — did not exist | `null` — did not exist |
| Minter4 (`TOKD`) | 172 | yes | `null` — did not exist | `null` — did not exist |
| Minter5 (`TOKE`) | 213 | yes | `null` — did not exist | `null` — did not exist |
| MinterCollide (`TOKX`) | 222 | yes | `null` — did not exist | `null` — did not exist |

Chain tip before ANY contract of this demonstration existed: block **42**.
The Manager's deploy transaction `da711ebed1fd300b6db80d73269217649d67b442b206c2607010e01f7118e438` was applied in block
**45**. The sharpest row is **TOKD in block 172**: its colours did not
exist while the Manager processed rows 0–14, and row 16 custodies one of them.

## The pinned lane — inherited, and proven so at BOTH ancestors

This project inherits 00003's component set unchanged, through 00004. That is proven rather than
asserted: every gate wrapper re-runs `lane_assert_pins_unchanged` before it boots anything. 00005
**strengthened** the check — it now walks the whole inheritance chain and asserts the image
digests, the compiler-archive pin and `harness/pnpm-lock.yaml` are identical at BOTH ancestors
(00003 `a8ebff9` → 00004 `f066a09`), so a silent re-pin by 00004 could not hide behind a
comparison against 00004 alone.

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
binary; the released `compactc-v0.33.0` is substituted with owner approval, and the installed
compiler's reported compiler/language versions are asserted against the pinned rc.2 reference on
every gate run. Manifest: [`evidence/g1-lane/LANE.md`](evidence/g1-lane/LANE.md).

**W-1** (inherited host workaround, diagnosed by 00004 at G4) is step `01` of **every** gate here,
including inside the clean-clone reproduction: the host's `docker-credential-desktop` can hang and
wedge every `docker pull`, so gates run with a scratch `DOCKER_CONFIG` (`{}` plus a symlink to the
real `cli-plugins`), scoped to the gate's own child processes and removed by its teardown. It
changes no pin — the images are public and pinned **by digest**, and the digest is the identity —
and no step is skipped to accommodate it. See [`scripts/lib/docker-w1.sh`](scripts/lib/docker-w1.sh).

## What was built

### `manager.compact` v3 — custody with no colour knowledge and no authority

Started from 00004's Manager. **Removed**: `configure`, the four colour cells, the `configured`
flag, both colour predicates, every `assertConfigured*` call site, and `registerAccount`'s seeding
of one zero cell per configured colour. **Kept unchanged**: the witness scheme
(`localOwnerSecret` → `ownerCommitment` → `authenticatedAccount`), registration, and the guard
ORDER. What is left has no way to learn a colour, and no way to be told one.

```
ledger pools:              Map<Bytes<32>, QualifiedShieldedCoinInfo>   one pooled coin per shielded colour
ledger shieldedBalances:   Map<Bytes<32>, Uint<128>>   key = shieldedKey(account, colour)
ledger unshieldedBalances: Map<Bytes<32>, Uint<128>>   key = unshieldedKey(account, colour)

shieldedKey(a,c)   = persistentHash([a, c, pad(32, "aa00005:manager:shielded")])
unshieldedKey(a,c) = persistentHash([a, c, pad(32, "aa00005:manager:unshielded")])
```

- **Lazy creation on FIRST CREDIT only** (FR-202): `depositShielded`, `depositUnshielded`, and the
  CREDIT side of `transferInternalShielded` / `transferInternalUnshielded`. Every guard in every
  circuit precedes the first write, so **every refusal path is state-neutral by construction** —
  which is what makes the no-state-created proofs assertions rather than hopes.
- **Two separations, not one** (FR-203): the families live in structurally separate maps AND their
  keys are derived under different domain separators. Either alone would prevent aliasing; both
  means the families could not alias even if the maps were merged.
- **`shieldedKey` / `unshieldedKey` are exported PURE circuits** — no ledger access, so no proving
  key, so they land in `pureCircuits`. The harness reproduces every key in raw ledger state **by
  running the contract's own code**, which is what turns "zero unaccounted keys" into an
  enumeration of real state over a colour set that is DISCOVERED rather than configured.
- **Guard order** in every debiting circuit: witness choke point → **per-(account, colour) balance,
  where a MISSING cell reads 0** → pool / contract-ledger balance. Credit is open to any REGISTERED
  account; only spends are owner-gated (FR-204).
- **Decision D-204**: `transferInternal` is split per family. With byte-identical colours possible
  across families, `(to, colour, amount)` cannot say which family it means — the exact ambiguity
  FR-203 exists to forbid. The spec's NC-5 and step 12 are the SHIELDED form. Owner chose to keep
  the split.

### `minter-collide.compact` — the P-COLL fixture

One constructor tag, **ONE** derived separator `persistentHash([tag, pad(32,"aa00005:collide")])`,
handed to BOTH `mintShieldedToken` and `mintUnshieldedToken`. Its two family colours are therefore
byte-identical **by construction, not by search**: both read `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd`.
The 00004 Minter is reused UNCHANGED for TOKA–TOKE — `contracts/minter.compact` is byte-identical
to the `f066a09` base commit, asserted by the gate.

| Contract | Source SHA-256 | Circuits | Verifier keys |
|---|---|---|---|
| `minter.compact` | `5eefba98962ddbef4af6b1ea4d17c21f37baf1d712c5822be0a7b4c245d6c1ef` | 4 | 4 |
| `manager.compact` | `49ae97218b753e0f101aaaa1e90c711f8965d21d456ae4cef5b80d3679a2ad3a` | 15 | 12 |
| `minter-collide.compact` | `a649df17d243fd6537a5d72e53140242320173a7770641708cf74382c5e4b25e` | 5 | 5 |

The Manager declares 15 circuits and emits 12 keys: `shieldedKey`, `unshieldedKey` and
`myAccount` touch no ledger state. Per-artifact hashes:
[`evidence/g2-contracts/ARTIFACTS.md`](evidence/g2-contracts/ARTIFACTS.md).

## The step ledger, as observed

Each party cell is the octet `S1 S2 S3 S4 U1 U2 U3 U4` — the four shielded colours, then the four
unshielded ones — and `·` means **that colour does not exist on this chain yet**. The last column
is the exact size of the three custody maps,
`pools/shielded/unshielded`. Every row is the **observed** value, asserted equal to the
specification's expected value — including the map sizes — before the run was allowed to
continue; the first divergence would have halted it.

| Step | Action | OwnerN | OwnerM | AA_A | AA_B | pool/ledger | maps |
|---|---|---|---|---|---|---|---|
| 0 | Manager deployed — NO Minter exists on this chain; AA_A and AA_B registered | `· · · · · · · ·` | `· · · · · · · ·` | `· · · · · · · ·` | `· · · · · · · ·` | `· · · · · · · ·` | `0/0/0` |
| 1 | Minters TOKA, TOKB, TOKC deployed; 6 colours read on-chain, pairwise distinct | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0/0/0` |
| 2 | mint S1 10 -> OwnerN | `10 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0/0/0` |
| 3 | mint U1 10 -> OwnerN | `10 0 0 · 10 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0/0/0` |
| 4 | mint S2 10 -> OwnerM | `10 0 0 · 10 0 0 ·` | `0 10 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0/0/0` |
| 5 | mint S3 10 -> OwnerM | `10 0 0 · 10 0 0 ·` | `0 10 10 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0/0/0` |
| 6 | mint U2 10 -> OwnerM | `10 0 0 · 10 0 0 ·` | `0 10 10 · 0 10 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `0/0/0` |
| 7 | OwnerN deposits S1 6 -> AA_A (first pool EVER) | `4 0 0 · 10 0 0 ·` | `0 10 10 · 0 10 0 ·` | `6 0 0 · 0 0 0 ·` | `0 0 0 · 0 0 0 ·` | `6 0 0 · 0 0 0 ·` | `1/1/0` |
| 8 | OwnerN deposits U1 5 -> AA_A | `4 0 0 · 5 0 0 ·` | `0 10 10 · 0 10 0 ·` | `6 0 0 · 5 0 0 ·` | `0 0 0 · 0 0 0 ·` | `6 0 0 · 5 0 0 ·` | `1/1/1` |
| 9 | OwnerM deposits S2 6 -> AA_B | `4 0 0 · 5 0 0 ·` | `0 4 10 · 0 10 0 ·` | `6 0 0 · 5 0 0 ·` | `0 6 0 · 0 0 0 ·` | `6 6 0 · 5 0 0 ·` | `2/2/1` |
| 10 | OwnerM deposits S3 4 -> AA_A (depositor != credited owner) | `4 0 0 · 5 0 0 ·` | `0 4 6 · 0 10 0 ·` | `6 0 4 · 5 0 0 ·` | `0 6 0 · 0 0 0 ·` | `6 6 4 · 5 0 0 ·` | `3/3/1` |
| 11 | OwnerM deposits U2 5 -> AA_B | `4 0 0 · 5 0 0 ·` | `0 4 6 · 0 5 0 ·` | `6 0 4 · 5 0 0 ·` | `0 6 0 · 0 5 0 ·` | `6 6 4 · 5 5 0 ·` | `3/3/2` |
| 12 | internal transfer S1 3: AA_A -> AA_B (credit-side lazy cell; pool UNCHANGED) | `4 0 0 · 5 0 0 ·` | `0 4 6 · 0 5 0 ·` | `3 0 4 · 5 0 0 ·` | `3 6 0 · 0 5 0 ·` | `6 6 4 · 5 5 0 ·` | `3/4/2` |
| 13 | AA_B withdraws S2 2 -> OwnerN | `4 2 0 · 5 0 0 ·` | `0 4 6 · 0 5 0 ·` | `3 0 4 · 5 0 0 ·` | `3 4 0 · 0 5 0 ·` | `6 4 4 · 5 5 0 ·` | `3/4/2` |
| 14 | AA_A withdraws U1 2 -> OwnerM | `4 2 0 · 5 0 0 ·` | `0 4 6 · 2 5 0 ·` | `3 0 4 · 3 0 0 ·` | `3 4 0 · 0 5 0 ·` | `6 4 4 · 3 5 0 ·` | `3/4/2` |
| 15 | TOKD deployed MID-LEDGER; mint S4 7 -> OwnerN, U4 4 -> OwnerM | `4 2 0 7 5 0 0 0` | `0 4 6 0 2 5 0 4` | `3 0 4 0 3 0 0 0` | `3 4 0 0 0 5 0 0` | `6 4 4 0 3 5 0 0` | `3/4/2` |
| 16 | OwnerN deposits S4 7 -> AA_A — HEADLINE: custody of a colour that did not exist at deploy | `4 2 0 0 5 0 0 0` | `0 4 6 0 2 5 0 4` | `3 0 4 7 3 0 0 0` | `3 4 0 0 0 5 0 0` | `6 4 4 7 3 5 0 0` | `4/5/2` |
| 17 | OwnerM deposits U4 4 -> AA_B | `4 2 0 0 5 0 0 0` | `0 4 6 0 2 5 0 0` | `3 0 4 7 3 0 0 0` | `3 4 0 0 0 5 0 4` | `6 4 4 7 3 5 0 4` | `4/5/3` |

**Rows 0–6 are the point of the project as much as row 16 is.** A Manager is deployed, two
accounts register, five colours are minted — and all three custody maps are still size `0`. 00004
held `accounts x 4 = 8` cells at the equivalent point, because its `configure` had told it what to
seed. There is nothing here to seed.

Row 7 creates the first pool this Manager has ever held. Row 10 credits **AA_A from OwnerM** —
depositor ≠ credited owner, because credit is open and spend is not. Row 12 creates the (AA_B, S1)
cell from an **internal transfer**, with every pooled coin byte-identical (value AND nonce) across
the row. Row 15 deploys TOKD and mints into it; the Manager's whole decoded state is byte-identical
across that row. Row 16 is the headline.

### How every cell is observed (FR-208)

| Cell class | Point 1 | Point 2 | Point 3 |
|---|---|---|---|
| AA_A / AA_B, per colour | the Manager's `shieldedBalances` / `unshieldedBalances` maps decoded from contract state, every key reproduced by the contract's own pure key circuits | the custody side of the same colour — pooled zswap coin, or the ledger kernel's unshielded balance — via the per-colour invariant | a real on-chain `shieldedAccountBalance` / `unshieldedAccountBalance` circuit call, rotating across the (account, colour) cells |
| OwnerN / OwnerM, unshielded | a read-only OBSERVER wallet facade that never submitted a transaction | the UTXO set reconstructed from the indexer's own transaction history, per colour | — |
| OwnerN / OwnerM, shielded | the same observer wallet, coin by coin | the conservation identity `minted[c] == custody[c] + OwnerN[c] + OwnerM[c]` | — |

**Why observer wallets exist at all: inherited finding F-104.** On this lane a wallet that
SUBMITTED a transaction under-reports its own balance afterwards and does not self-correct, while
still returning `progress.isStrictlyComplete() === true`. No submitting wallet is an observation
point anywhere in this project, and every user-submitted transaction is built by a fresh spender
wallet that is closed immediately afterwards.

**The dynamic form of "zero unaccounted keys."** 00004 could enumerate its balance map because
`configure` bounded it. 00005 has no such bound, so the check was inverted: every key present in
the Manager's raw maps must be reproducible as `shieldedKey`/`unshieldedKey`(AA account, REGISTERED
colour) by running the contract's own pure circuits, and only the FAMILY-APPROPRIATE key is
accounted per colour — so a cell in the wrong family cannot be excused as accounted for. That is
FR-203's aliasing case, checked after every row.

## Checklist — every step, control and probe

| Item | Step | Level | Transaction id(s) | Status |
|---|---|---|---|---|
| Step 0 — Manager deployed, NO Minter exists; AA_A and AA_B registered; all maps size 0 | 0 | SDK | `00a6e21ecae834c8bfbacb11bd76bcb3f9b2a206924979baa010c7ad5a1127c86a` | **GREEN** |
| Step 1 — TOKA/TOKB/TOKC deployed AFTER the Manager; 6 colours distinct; Manager byte-identical | 1 | SDK | `6f32d9ecfa86442e1b734f93fefae5e023a8d3bc507e3b9bfb19dc125d3ab380`<br>`8a37dc4e0b45e169c90066d078276b6171145d02fad1f1a0f2b48508aa6efaa0`<br>`eaf15a6c2510f12f13ce88b2ec156b1db034986d77eb7c1277c8e6940a25dd3a` | **GREEN** |
| Step 2 — mint S1 10 -> OwnerN | 2 | SDK | `0036fc1244c795898ae5fcd9f659262fa83c50e693177d04df8d90d16e8a044072` | **GREEN** |
| Step 3 — mint U1 10 -> OwnerN | 3 | SDK | `00508dc138dc8f23418e3da1f30cf9e2c3a6d917150506b1205c0f59df5719bdc0` | **GREEN** |
| Step 4 — mint S2 10 -> OwnerM | 4 | SDK | `004f1b2a8e3875c680d4de24326c36e5969eb670bfe3178925c62d148a40971cc0` | **GREEN** |
| Step 5 — mint S3 10 -> OwnerM | 5 | SDK | `009c86c467fe275f88b91d79c82e0c973a3f99976380487eda8b36ee182ea58c27` | **GREEN** |
| Step 6 — mint U2 10 -> OwnerM | 6 | SDK | `006586549a9e7e4453fc6681b90b9441c00851ffc285c6870280a3d409e2f87fdf` | **GREEN** |
| Step 7 — OwnerN deposits S1 6 -> AA_A (first pool EVER) | 7 | SDK | `00884ad837335921eb97601b32ce5bdb4b01a17e3b2cadd96ae6927ef85da65e4e` | **GREEN** |
| Step 8 — OwnerN deposits U1 5 -> AA_A | 8 | SDK | `0040400c7e3bae1de2b3b8c790538046dad5f8b8a71af631a98df74a0bdec7bdc4` | **GREEN** |
| Step 9 — OwnerM deposits S2 6 -> AA_B | 9 | SDK | `0066922c578116c333e14e5b88d6b4461a1b9f49a1e18cc318ca99f0af3a4a07c6` | **GREEN** |
| Step 10 — OwnerM deposits S3 4 -> AA_A (depositor != credited owner) | 10 | SDK | `0006b2b4c7d8d5ef248e517c59152922e3183dd84afa6d883edb78a576b0a87de4` | **GREEN** |
| Step 11 — OwnerM deposits U2 5 -> AA_B | 11 | SDK | `003ea0637e2197236bf16fbc182a45810a9f6d8f57ca12e73fb4a3c5b3db3fbe5a` | **GREEN** |
| Step 12 — internal transfer S1 3: AA_A -> AA_B (credit-side lazy cell; pool UNCHANGED) | 12 | SDK | `00f9be9a8b26c7da1a49e0f475e7de1f34c0552d2e3e116ebba984f2ead3b728a9` | **GREEN** |
| Step 13 — AA_B withdraws S2 2 -> OwnerN | 13 | SDK | `00d65f7a9c3000bd786a74c907032f70084a6fe263e7b3e4fbd48d8b7e220a101d` | **GREEN** |
| Step 14 — AA_A withdraws U1 2 -> OwnerM | 14 | SDK | `007f4b71e7eb49371ef6982b7202ef5970f1fc81dc58a949d63fb11cc92507dcd2` | **GREEN** |
| Step 15 — TOKD deployed MID-LEDGER; mint S4 7 -> OwnerN, U4 4 -> OwnerM | 15 | SDK | `008235b1d8e48c66cef6e4b07ca5040b1d833e9be21e8d081eb0fe4e0c016c5eec`<br>`00b3dd19b95b1178bef9edb6c853df8e829fbc33dd951535335e8025432499a318`<br>`00e3b6e3883081bb9c4ad8d9f0cbc5ce7da0b56091226eef0031ed6ecdb00c0c20` | **GREEN** |
| Step 16 — HEADLINE: custody of a colour that did not exist when the Manager was deployed | 16 | SDK | `000b61ae6a4a78f81cbbb13e03fa8833c2ad9439cfcde7fe8f4ae8ea910eb48cbd` | **GREEN** |
| Step 17 — OwnerM deposits U4 4 -> AA_B | 17 | SDK | `000ebd3bf2d2aa10df4b313b956d88e3f3619601073691179a83aa9f1563f58880` | **GREEN** |
| Invariant — `custody[c] == AA_A[c] + AA_B[c]` for every DISCOVERED colour, after EVERY step | 0-17 + probes | derived | — | **GREEN** |
| Exact map sizes after EVERY step, and ZERO unaccounted keys over the dynamic colour set | 0-17 + probes | derived | — | **GREEN** |
| FR-206 — U3 is minted by no one, deposited by no one, and absent from EVERY map at every row | 0-17 | derived | — | **GREEN** |
| Unregistered witness: OwnerN's witness opens no Manager account | NC-1 | SDK | — | **GREEN** |
| Missing-cell spend: OwnerB withdraws S3, which AA_B has never held, from a pool that covers it | NC-2 | SDK | — | **GREEN** |
| Dormant colour: OwnerA withdraws U3, a colour no one ever minted or deposited | NC-3 | SDK | — | **GREEN** |
| Unregistered credit: a deposit naming an account commitment that was never registered | NC-4 | SDK | — | **GREEN** |
| Internal transfer of an unheld colour: AA_A moves S2 it does not hold, while rich in others | NC-5 | SDK | — | **GREEN** |
| Distinctness — 45/45 pairwise over TOKA–TOKE, plus the INVERTED MinterCollide equality | probe | SDK | — | **GREEN** |
| P-COLL — one byte-identical colour, both families, tracked independently | probe | SDK | `00b66bd35c1bbd81a5f1040656b62759e1614aee225cc7c67c83a5df05be50e5f1`<br>`00713f1fcd3747fa437a1786029b23d39c75b0a3ae3503491e562badc81f9b2269`<br>`00c10656f1923b64cdce84e714cf7c72249079904421baf094bc615b8e2cf2e955`<br>`0080fc7064f4887536eedc935e88602478b87f0e07efd5ea09775e04c99d5fe33d`<br>`00504ec1f7fd5ae0d31342efff6bd4473d44e5fd1d6ba3e3091180d4ada70f728f`<br>`0047ba5b249baf3a3a21601d77c3fdbf89d713d6236e82a64c0a1fa61f3c2bb82a` | **GREEN** |
| M3 — first deposits of TWO brand-new colours create exactly one pool and two cells | probe | SDK | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` | **GREEN** |
| M3 — BOTH first deposits under ONE transaction id (FR-207, decision D-203) | probe | SDK | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` | **GREEN** |

Full index with observation points and per-row notes:
[`evidence/g3-ledger/CELLS.md`](evidence/g3-ledger/CELLS.md).

## Owner-only spend, and the thing 00004 could not state

FR-204 is carried verbatim from 00004 as the critical requirement. Openness adds a second
obligation that only a lazy contract can fail: **a refused operation must create no state**. Every
control below proves FOUR things — the rejection happened; the message is the **contract's own
assert**; funds are byte-identical (re-read after a settle delay, so "unchanged" is an observation
rather than a race); and **no state was created**, with all three map sizes identical AND the
specific cell the control is about proven still absent afterwards.

| Control | The attack | Refused with (verbatim) | No state created |
|---|---|---|---|
| **NC-1** | Unregistered witness: OwnerN's witness opens no Manager account | `failed assert: caller's owner witness matches no registered account \| cause: Error executing circuit 'withdrawShielded'` | no cell was created for the unregistered witness: accounts still 2, map sizes {"pools":4,"shieldedCells":5,"unshieldedCells":3} |
| **NC-2** | Missing-cell spend: OwnerB withdraws S3, which AA_B has never held, from a pool that covers it | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawShielded'` | (AA_B,S3) cell absent before: yes; (AA_B,S3) cell absent after: yes |
| **NC-3** | Dormant colour: OwnerA withdraws U3, a colour no one ever minted or deposited | `failed assert: account colour balance too low \| cause: Error executing circuit 'withdrawUnshielded'` | U3 absent from every map before: yes; U3 absent from every map after: yes |
| **NC-4** | Unregistered credit: a deposit naming an account commitment that was never registered | `failed assert: credit account is not registered \| cause: Error executing circuit 'depositShielded'` | account set unchanged: yes; no cell for the bogus account, no pool for the colour: yes ({"pools":4,"shieldedCells":5,"unshieldedCells":3}) |
| **NC-5** | Internal transfer of an unheld colour: AA_A moves S2 it does not hold, while rich in others | `failed assert: account colour balance too low \| cause: Error executing circuit 'transferInternalShielded'` | (AA_A,S2) cell absent before: yes; (AA_A,S2) cell absent after: yes; poolS2 unchanged: yes (4) |

**NC-2 is the sharp one**: `poolS3` holds `4` and covers the request, and the withdrawal is still
refused — because the per-(account, colour) guard sits BEFORE the pool guard and reads the absent
(AA_B, S3) cell as 0. **NC-3 is the one 00004 could not run at all**: a colour that no one ever
minted or deposited. v2 would have refused it with a colour-configuration error; v3 has no colour
configuration, so the refusal comes from the same per-account guard — and U3 is still absent from
every map afterwards.

All 5 controls are GREEN with the message matched, funds byte-identical and map sizes unchanged: `NC-1`, `NC-2`, `NC-3`, `NC-4`, `NC-5` — full before/after state in [`evidence/g3-ledger/negative-controls.json`](evidence/g3-ledger/negative-controls.json).

Five further negatives ran offline against the compiled artifact in G2 (duplicate registration,
unregistered witness, unregistered credit, and two withdrawals of colours the Manager has NEVER
seen), each with a verbatim error, byte-identical whole state and map sizes `{0,0,0} → {0,0,0}`:
[`evidence/g2-contracts/CONTRACTS.md`](evidence/g2-contracts/CONTRACTS.md).

## P-COLL — one colour, two families, no aliasing

The hazard openness creates: with no colour registry, nothing stops the same 32 bytes appearing as
both a shielded and an unshielded colour. `MinterCollide` makes that happen **deliberately and by
construction** rather than by hunting for a collision.

| What | Value |
|---|---|
| The colliding colour (identical in both families) | `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd` |
| Issuer | `91d2f65440db34c57dd5f7b3538d759fa798519d94932fe3b9b699cb596c7b67` |
| `shieldedKey(AA_B, X)` | `10e27aacb3f07384fc2a97bbb9056abc4c051798583374b79523a393fc771fb1` |
| `unshieldedKey(AA_B, X)` | `92903947a5d86664fb6b677db7681fc2a6da9618652c1db97346a91bb343ac3f` |
| Keys differ | **yes** |

| After | pool (shielded) | contract ledger balance (unshielded) | AA_B shielded cell | AA_B unshielded cell |
|---|---|---|---|---|
| both deposits | 3 | 2 | 3 | 2 |
| one independent withdrawal from each side | 2 | 1 | 2 | 1 |

The strongest form of the claim is not the decode — it is two **real on-chain circuit calls taking
the IDENTICAL 32-byte argument** and answering differently:

- `shieldedAccountBalance(AA_B, X)` = **2**
- `unshieldedAccountBalance(AA_B, X)` = **1**

G2 had already proven the fixture compiles, deploys and reads back byte-identical, and that the
Manager's two family KEYS for it differ. This is its TOKEN half: the colour is actually minted,
deposited, custodied and spent in both families, and a withdrawal from either side leaves the other
byte-identical. Neither the compiler nor the ledger objected at any point, so the pre-approved
fallback (assert FR-203 with distinct-value colours plus an impossibility note) was never needed.

## M3 — two brand-new colours, one transaction (FR-207, decision D-203)

| What | Value |
|---|---|
| Transaction | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` |
| Circuits in it | `depositShielded` + `depositUnshielded` |
| Shape | sdk-scoped batch (one transaction, one segment per call, state threaded) |
| Both colours brand new before | pool for S5 exists: `false`, (AA_B,S5) cell: `false`, (AA_B,U5) cell: `false`, kernel holds U5: `false` |
| Map sizes across the ONE transaction | {"pools":5,"shieldedCells":6,"unshieldedCells":4} → {"pools":6,"shieldedCells":7,"unshieldedCells":5} |
| Confirmed a second way | on-chain circuit calls: `shieldedAccountBalance(AA_B,S5)` = 3, `unshieldedAccountBalance(AA_B,U5)` = 3 |

**D-203 resolved to the shape proposed: RESOLVED — SDK contract-scoped batch; one transaction id carried both first deposits**. One new pool and
two new cells came into existence under a single transaction id. The composition is attempted
twice, each on its own fresh spender wallet:

| Attempt | Result |
|---|---|
| 1 | refused: `Unexpected error submitting scoped transaction 'aa00005-double-lazy-init': (FiberFailure) SubmissionError: Transaction submission error [cause]: SubmissionError: Transaction submission failed [cause]: RpcError: 1010: Invalid Transaction: Custom error: 104 } } \| cause: Transaction submission error` |
| 2 | **ACCEPTED** — both first deposits under one transaction id |

### …and it is an EXISTENCE result, not a reliability one

**Read this before quoting D-203.** Across the FOUR times this project has run probe M3, the
composition landed in two of them and fell back to two separate transactions in the other two —
and **the very first attempt was refused in all four**, always with
`1010: Invalid Transaction: Custom error: 104`. The retry is what makes it land, and the retry
does not always work: the G4 run-3 reproduction was refused on both of its attempts and used the
fallback. The run-by-run ledger is in [`VERIFICATION.md`](VERIFICATION.md).

| | Retained G3 run | This clean-clone reproduction |
|---|---|---|
| composition attempts | 1 refused, **2 accepted** | 1 refused, **2 accepted** |
| outcome | ONE transaction id | ONE transaction id |
| `M3-composition` | `GREEN` | `GREEN` |
| `M3-lazy-init` | `GREEN` | `GREEN` |
| map sizes across it | {"pools":5,"shieldedCells":6,"unshieldedCells":4} → {"pools":6,"shieldedCells":7,"unshieldedCells":5} | **identical** |

So the honest statement is: the SDK contract-scoped batch **can** carry the first deposits of two
brand-new colours under one transaction id — that happened, and there is a transaction id to point
at — but it does **not** do so dependably on this lane. **What reproduces every time is the
lazy-init half**: one new pool and two new cells for two colours that were brand new beforehand,
identical by either route.

That is exactly why FR-207 states M3 as a DISJUNCTION, and why the two halves are SEPARATE
checklist rows — `M3-lazy-init` and `M3-composition`, with only the latter permitted to carry
`RECORDED`. Both runs satisfy the specification. Anyone reusing this harness should treat a
composed scoped batch as **best-effort**, keep the separate-transaction fallback armed, and never
let a single success license a claim that the shape is dependable — see finding **F-203**.

## Distinctness — and the one assertion that is inverted

- **45/45** pairwise comparisons distinct over the ten TOKA–TOKE colours, 0 collisions, every colour read from an **on-chain circuit call** rather than derived off-chain.
- **MinterCollide's two family colours are byte-EQUAL** (`9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd`) — the inverted assertion, and the whole point of the fixture. It collides with none of the ten, so it does not contaminate the distinct colour set.

## Findings — reusable notes for anyone on this lane

### F-201 — a verifier key identifies the CIRCUIT SHAPE, not the contract

Discovered by 00005's first `--zk` build. `minter.shieldedColor` and `minter-collide`'s three
colour readers compile to **byte-identical prover AND verifier keys**, because each is the same
circuit body reading the same ledger-field index. `ZKConfigRegistry` resolves by verifier-key hash,
so for those circuits several sources match one hash. Verbatim from the build:

```
ae0e9f3692e354db…  minter.mintShieldedTo, minter-collide.mintShieldedTo
   prover key IDENTICAL too (ab651eeab1c012ac…) — same circuit, so resolution by key hash is unambiguous in effect
f32145c458988ca8…  minter.shieldedColor, minter-collide.collidingColor, minter-collide.shieldedColor, minter-collide.unshieldedColor
   prover key IDENTICAL too (cbe8ee20856aa13d…) — same circuit, so resolution by key hash is unambiguous in effect
```

That is harmless **precisely because the artifacts are identical** — whichever source is chosen,
the prover key bytes are the same. Two consequences were taken, and the second is the reusable one:

- 00004's build-time "no circuit name appears twice" assertion is **removed**: MinterCollide
  deliberately mirrors the Minter's API, so name uniqueness is not a property this project has —
  and it never was a proving requirement.
- It is replaced by a **sharper** check in `scripts/g2/compile.sh`: a verifier key shared between
  contracts is reported, and is FATAL only if the corresponding **PROVER** keys differ — the case
  in which resolution could hand the prover a key that does not match the circuit. On this build,
  2 shared verifier keys, both with identical prover keys, so the check passes with the observation
  recorded rather than a failure.

### F-202 — a stack trace can crowd the real error out of the evidence

Discovered by G3 run 1. The pinned SDK's Effect-based submission service inlines its ENTIRE stack
into the error MESSAGE on one line, so 00004's `errorChain` — which joined `cause` messages and
truncated at 1200 characters — spent the whole budget on the first link's trace and never reached
the node's own `1010: … Custom error: NNN`. FR-207 asks for the verbatim error; what run 1 recorded
was a stack trace wearing its clothes. `errorChain` now strips frames (whole-line and inline
`at <fn> (<file>:L:C)` forms) before joining, verified against run 1's real string. **Any gate that
records a node-side refusal on this lane wants this fix.**

### F-203 — F-107 extends to the SDK scoped batch, and waiting on both legs is NOT sufficient

Discovered by probe M3 over two runs. A `withContractScopedTransaction` composition of two
first-credit deposits, built by a freshly opened spender wallet that had **already waited until it
could see BOTH legs' funds**, was refused by the node with `1010: Invalid Transaction: Custom
error: 104` — and the refusal created no state. The IDENTICAL composition, retried on another fresh
wallet moments later, was **accepted**. So this is F-107's failure mode (a wallet whose view has not
settled balances into a transaction the node refuses with a bare code), **not** a ledger rule about
composing two first credits, and the existing require-both-legs readiness wait is *necessary but not
sufficient* for this shape. Consequences taken: M3 attempts the composition TWICE, each on its own
fresh spender, before FR-207's fallback is even considered; and the refused attempt's
state-neutrality is asserted DIRECTLY rather than inferred.

**00005 G3 run 1 concluded the opposite from a single attempt** and would have reported D-203
wrongly. Its evidence was deleted and the gate re-run, never hand-edited — see the run history.

**And the G4 reproductions strengthened this into the part that generalises.** Running the
identical probe on fresh chains, one reproduction was refused on BOTH attempts and used the
fallback, while another was refused once and then accepted. Over the four runs of this probe the
**first attempt has been refused every single time**, and the retry has landed it in two runs out
of three that made one. So F-203's own remedy — "retry once on a second fresh wallet" — is
*better* than one attempt but is **not a reliable recipe**; it is a mitigation, not a fix. Treat a
composed scoped batch as best-effort and keep the separate-transaction fallback armed.

### Inherited, and re-confirmed here

| Id | Finding | Status in 00005 |
|---|---|---|
| **W-1** | the host's `docker-credential-desktop` can hang, wedging every `docker pull`; run gates under a scratch `DOCKER_CONFIG` | adopted as step 01 of every gate. On these runs the helper was NOT wedged (`docker-credential-desktop get` answered in <1 s), so W-1 was preventive rather than curative; `docker compose config --images` resolved exactly the three pinned digests under it |
| **F-104** | a submitting wallet under-reports its own balance while `isStrictlyComplete()` is true | honoured throughout — no submitting wallet is ever an observation point |
| **F-107** | a wallet that cannot yet see a leg's funds lets `balanceTx` succeed and the node refuses with a bare code | **extended** by F-203 to the scoped-batch shape, with node code `104` here |
| **223 rule** | same-address sequencing is `CausalityConstraintViolation`; at most one both-transcript call per same-address sequence, so the SDK scoped batch is the proven legal composition | inherited as the answer, not re-derived: the one-ledger-`Intent` shape was not re-attempted, and D-203 takes the scoped batch |

## Run history — recorded honestly

| Gate | Runs | Outcome |
|---|---|---|
| G1 | 2 | GREEN, then GREEN again — re-run to fix a stale HEADING in the evidence rather than hand-edit committed output |
| G2 | 1 | **GREEN on the first attempt** |
| G3 | 2 | GREEN, then **GREEN** — run 1 SUPERSEDED, see below |
| G4 | see [`VERIFICATION.md`](VERIFICATION.md) | clean-clone reproduction |

**G3 run 1 was green on its own terms and is NOT the retained evidence.** It reached a WRONG
conclusion about D-203: its single M3 attempt was refused, FR-207's fallback fired, and it looked
like the ledger refuses to compose two first credits. Run 2 attempted the same composition twice on
fresh wallets and the second was accepted — so run 1's conclusion was an artefact of wallet
readiness (F-203), not a property of the ledger. **Had run 1 been reported as the answer, this
report would say the opposite of the truth about D-203.** Run 1 also recorded a stack trace where
the verbatim node error belonged (F-202) and mislabelled one custody figure `ledgerXS` that was in
fact a pool (right value, wrong label — the worse of the two).

All three were fixed by **re-running the gate**, never by editing committed evidence: run 1's
output was deleted, not corrected. That is the precedent G1 set on this project when its own run 1
carried a stale heading. Anything quoting a run-1 figure is stale by construction.

## Metrics

Measured during the retained G3 run at the point each thing actually happens: `proveTx` is timed
by wrapping the proof provider, and each submitted transaction is measured by serializing it.
These cover the **contract-call** transactions this harness proves and submits itself; plain
wallet-to-wallet transfers are proven inside the wallet SDK and are not instrumented, so the
figures are not a whole-run average.

| Metric | count | min | median | mean | max |
|---|---|---|---|---|---|
| Proof latency (ms) | 70 | 0 | 620 | 1050 | 5945 |
| Submitted transaction size (bytes) | 70 | 6671 | 8282 | 11304 | 26760 |

Slowest proof: `depositShielded` at 5945 ms.
Largest submitted transaction: `feePayer/manager` at 26760 bytes.

Wall-clock on a shared host, retained runs: G1 155 s, G2 612 s (deploy-order 527 s), G3 1723 s
(the live step-ledger half 1643 s). Gate step durations are in each gate's `run.log`.

## Reproduction from a clean clone

The G4 wrapper clones this repository into a fresh temporary directory — carrying **no** generated
artifacts, **no** `docker/.env` and **no** `node_modules`, all asserted absent — then runs the G1,
G2 and G3 gate wrappers inside that clone, each against a fresh stack of its own, and compares the
results.

| | Original run | Clean-clone reproduction |
|---|---|---|
| Checklist GREEN | 30/30 | 30/30 |
| Manager | `b1f34f0469b0c29e0a61e931be21a1d335d33953367bf3fc9c633b0d8372076d` | `010281da01cf6ef6936eb05a06b433487837b58d008d3869566df74d34ac1862` |
| Manager deploy block (chain tip before any deploy) | 45 (42) | 28 (25) |
| TOKD (mid-ledger issuer) deploy block | 172 | 153 |
| S1 colour | `af0cf3315634a046dab2734b721b8d3f923e346d878a3d414edcd2164cec8a31` | `c42ddcaf75e7b64de4bd13618296555591c5ca300addc3ad0e6d6a2b48c22ec3` |
| P-COLL colliding colour | `9d27bcf49db7cd1b7a844c7cd4516c2efd7b118bc5b016164650ff067217c2fd` | `b40771a64e5ab5e4453ed17bccc8bc767b66bb14f29304be4b177015e56b7ba4` |
| M3 transaction | `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` | `000262291b122103c77bcdc6ecdc1bd6768781bc2c044b39ff45552d022f839696` |
| M3 shape | sdk-scoped batch (one transaction, one segment per call, state threaded) | sdk-scoped batch (one transaction, one segment per call, state threaded) |
| End-state map sizes | {"pools":4,"shieldedCells":5,"unshieldedCells":3} | {"pools":4,"shieldedCells":5,"unshieldedCells":3} |
| M3 composition | landed in ONE transaction | landed in ONE transaction |
| Transaction ids in common | — | **0** |

**This reproduction did land the M3 composition** — refused on its first attempt, accepted on
the retry, exactly as the retained run went. That is not a guarantee: an earlier G4
reproduction was refused on both attempts and used FR-207's fallback. See the D-203 section
above, and the run ledger in [`VERIFICATION.md`](VERIFICATION.md).

Addresses, colours, nonces and transaction ids necessarily differ — the reproduction runs on a
brand-new chain and the colours are address-scoped, so they *cannot* repeat. What is compared is
what the specification asserts: every checklist verdict, the deploy-order proof, all 18 rows of
map sizes and observed values, the final table, the exact end-state map sizes, both probes, and
every control's verdict, no-state-created proof and verbatim message. Reproduced final table:

|  | S1 | S2 | S3 | S4 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|---|---|---|
| OwnerN | 4 | 2 | 0 | 0 | 5 | 0 | 0 | 0 |
| OwnerM | 0 | 4 | 6 | 0 | 2 | 5 | 0 | 0 |
| AA_A | 3 | 0 | 4 | 7 | 3 | 0 | 0 | 0 |
| AA_B | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 4 |
| pool / ledger | 6 | 4 | 4 | 7 | 3 | 5 | 0 | 4 |

**The freshness guard is proven non-vacuous, not merely present.** Before the reproduction runs,
the gate feeds the ORIGINAL evidence in as its own "reproduction" and requires the comparison to
REJECT it. Every substantive check passes on that pair — which is exactly why verdict-matching
alone could never tell a reproduction from the committed original.

### How to reproduce

```sh
./scripts/g4/verify-g4-closeout.sh    # clean clone -> G1 -> G2 -> G3 -> compare -> this report
```

or gate by gate:

```sh
./scripts/g1/verify-g1-lane.sh        # lane inheritance proof, W-1, funded wallets       (~3 min)
./scripts/g2/verify-g2-contracts.sh   # compile, deploy the Manager FIRST, unit negatives (~10 min)
./scripts/g3/verify-g3-ledger.sh      # the whole 18-row ledger + controls + probes       (~29 min)
```

Prerequisites: Docker, Node 22+, pnpm. The Compact compiler runs inside a pinned Docker image.
Each wrapper picks random host ports above 10000 **verified free**, binds them to `127.0.0.1` only,
owns a uniquely named compose project, and is green **only on exit 0 including teardown** — a
leftover container, volume or network makes the gate RED even when every step passed.

## Scope and honest limits

- `EXPERIMENTAL_LANE` / `LANE-DEV-1` throughout: a prerelease slot with no supported-bundle
  guarantee. Nothing here is a supported-lane or production claim.
- Local fresh `undeployed` ledger-9 network only. No Devnet, Stagenet, testnet or mainnet.
- **"Unbounded" means unbounded by the contract, not proven at scale.** Ten colours from six
  deployments were exercised; nothing here measures what a large map costs to prove or to read.
- Per-rail mechanics (split/change, multi-input selection, merge, self-send) and mixed-colour
  atomicity negatives are **not** re-proven here — they are 00003/00004 results, per the owner's
  focused-tests convention.
- Owner authorization is by witness, sound here only because the Manager is always invoked in root
  position. No `kernel.caller()`, no browser, relayer, sponsorship or production hardening.
- The Manager is a demonstration custodian, not a product: any party may request minting, each
  shielded colour is deliberately held as a single pooled coin, and **deposits are open to any
  registered account by design** (FR-204 — credit is open, spend is not).
- Registration is still required to be *credited*. "Permissionless" here is about COLOURS, not
  about accounts.

## Reading order

[`README.md`](README.md) → this report → [`evidence/g3-ledger/CELLS.md`](evidence/g3-ledger/CELLS.md)
→ [`evidence/g2-contracts/CONTRACTS.md`](evidence/g2-contracts/CONTRACTS.md)
→ [`evidence/g1-lane/LANE.md`](evidence/g1-lane/LANE.md) → [`VERIFICATION.md`](VERIFICATION.md).

Projects 00003's and 00004's own deliverables are preserved unmodified under
[`archive/00003/`](archive/00003/ARCHIVE.md) and [`archive/00004/`](archive/00004/ARCHIVE.md).
