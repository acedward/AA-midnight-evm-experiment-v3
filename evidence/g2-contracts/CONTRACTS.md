# G2 — the Manager deploys FIRST, knowing no colours

`EXPERIMENTAL_LANE` / `LANE-DEV-1` — 00005-open-colour-custody, Plan 02 Phase 3.

Recorded (UTC): 2026-08-19T03:32:57.167Z
Verdict: **PASS**

## Deploy order — the headline proof

Chain tip before ANY contract of this demonstration existed: block `17`.

The Manager's deploy transaction `34041db0e021b11696a29c9f3e556c5201911dbde0dce430b2262529df4b54da` was applied in **block 20**.

| Contract | Address | Deploy block | Strictly after the Manager | Existed at the Manager's block |
|---|---|---|---|---|
| **Manager** | `d6bfe91906d63513…` | 20 | — | yes (control) |
| Minter1 | `a83910314ca06a7d…` | 23 | yes | **no — did not exist** |
| Minter2 | `5d3bc50e7564052c…` | 32 | yes | **no — did not exist** |
| Minter3 | `3849c9b8372b77d5…` | 41 | yes | **no — did not exist** |
| MinterCollide | `da4971c623159359…` | 50 | yes | **no — did not exist** |

The right-hand column is the strong form. It is the indexer's answer to *"what contract
action does this address have at or before block 20?"* —
`null` for every minting contract, and the deploy action for the Manager itself. The
Manager did not merely go first: when it was deployed, nothing that could mint a colour
existed on this chain at all.

## Deployments

| Deployment | tag in | tag stored on-chain | address | shielded colour | unshielded colour |
|---|---|---|---|---|---|
| Minter1 (`TOKA`) | `544f4b4100000000…` | `544f4b4100000000…` (identical) | `a83910314ca0…` | `95a4192f764a73a8b217a20f05bfca9f95eae9d67dd3fc0a0e9659ccfc227387` | `f8771e96c3a7ce116696038d0f391def0abfa4bc003a9049a75905b92ac7ddc2` |
| Minter2 (`TOKB`) | `544f4b4200000000…` | `544f4b4200000000…` (identical) | `5d3bc50e7564…` | `97b8b1289225726d3122ca85c763a04c0bfddcd824ff8b4495105621c04f5f92` | `04e92f9e66320014bc18caa4f4f3b382dffd4506b869c736a470f70237b27940` |
| Minter3 (`TOKC`) | `544f4b4300000000…` | `544f4b4300000000…` (identical) | `3849c9b8372b…` | `0eb106d06c632d557cc44bb3a96407f885c5a4c6cb579588dade6b9647d57376` | `c7e6e79acaad11d957647fa381a07d6b47b0ae7e5fc841f00aeff26e92a63fcd` |
| MinterCollide (`TOKX`) | `544f4b5800000000…` | `544f4b5800000000…` (identical) | `da4971c62315…` | `6c4727ed9db047e54e085a297867b6d033c29514a4cdaadfe2d9bf207ffa03d4` | `6c4727ed9db047e54e085a297867b6d033c29514a4cdaadfe2d9bf207ffa03d4` |

Each deployment's separators were also derived in process by the separately compiled
`--skip-zk` artifact from the same tag and matched the on-chain cells exactly.

## Distinctness — and the ONE inverted assertion

**15/15 distinct** (no collisions) over the six Minter colours, read from on-chain circuit calls.

| Role | Colour |
|---|---|
| Minter1(TOKA).shielded | `95a4192f764a73a8b217a20f05bfca9f95eae9d67dd3fc0a0e9659ccfc227387` |
| Minter1(TOKA).unshielded | `f8771e96c3a7ce116696038d0f391def0abfa4bc003a9049a75905b92ac7ddc2` |
| Minter2(TOKB).shielded | `97b8b1289225726d3122ca85c763a04c0bfddcd824ff8b4495105621c04f5f92` |
| Minter2(TOKB).unshielded | `04e92f9e66320014bc18caa4f4f3b382dffd4506b869c736a470f70237b27940` |
| Minter3(TOKC).shielded | `0eb106d06c632d557cc44bb3a96407f885c5a4c6cb579588dade6b9647d57376` |
| Minter3(TOKC).unshielded | `c7e6e79acaad11d957647fa381a07d6b47b0ae7e5fc841f00aeff26e92a63fcd` |
| MinterCollide(TOKX).shielded | `6c4727ed9db047e54e085a297867b6d033c29514a4cdaadfe2d9bf207ffa03d4` |
| MinterCollide(TOKX).unshielded | `6c4727ed9db047e54e085a297867b6d033c29514a4cdaadfe2d9bf207ffa03d4` |

**P-COLL fixture — the two family colours are byte-identical: YES.** This is the inverted assertion: MinterCollide derives ONE separator and feeds it to both mint families, so its two colours are the same 32 bytes by construction. Every other colour comparison in this project asserts inequality.

The Manager keeps them apart by KEY DOMAIN as well as by map:

- `shieldedKey(AA_A, TOKX)`   = `26656c86bda379df57e789070873ce379baa57eea24cc9d4da0ee09c4c141deb`
- `unshieldedKey(AA_A, TOKX)` = `0cd2d46273c6a21ab847ef06b2fa7e05b0cbbdf8ad0070a58e5de40725d51d10`
- differ: **yes**

## Registration seeds NOTHING (FR-201)

- accounts: AA_A `009a77de97356f5caec09a9f582208d448e7ea81404d0a8501f077a032e4ce4b`, AA_B `755f593682390c58ac90759406d756ebbd86b44825f753a59389d44266da2904`
- map sizes after registering BOTH accounts: `{"pools":0,"shieldedCells":0,"unshieldedCells":0}`

00004 seeded one zero cell per configured colour here, so its `balances` map held
`accounts x 4` entries at this point. v3 has no colours to seed: **every cell that ever
appears in either map was created by a credit.**

Second observation point — real on-chain circuit calls against colours the Manager has
never been told about:

- `isRegistered(AA_A)` = `true`
- `shieldedAccountBalance(AA_A, S1)` = `0`
- `unshieldedAccountBalance(AA_B, U1)` = `0`
- `poolHasColour(S1)` = `false`

## Unit-level negatives

| Id | Status | Refused at | Verbatim error | Expected message | State byte-identical | Map sizes |
|---|---|---|---|---|---|---|
| `duplicate-registration` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: account already registered \| cause: failed assert: account already registered` | `/account already registered/` matched | yes | {"pools":0,"shieldedCells":0,"unshieldedCells":0} -> {"pools":0,"shieldedCells":0,"unshieldedCells":0} (unchanged) |
| `unregistered-witness` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: caller's owner witness matches no registered account \| cause: failed assert: caller's owner witness matches no registered account` | `/matches no registered account/` matched | yes | {"pools":0,"shieldedCells":0,"unshieldedCells":0} -> {"pools":0,"shieldedCells":0,"unshieldedCells":0} (unchanged) |
| `unregistered-credit` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: credit account is not registered \| cause: failed assert: credit account is not registered` | `/credit account is not registered/` matched | yes | {"pools":0,"shieldedCells":0,"unshieldedCells":0} -> {"pools":0,"shieldedCells":0,"unshieldedCells":0} (unchanged) |
| `unknown-colour-withdraw` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: account colour balance too low \| cause: failed assert: account colour balance too low` | `/account colour balance too low/` matched | yes | {"pools":0,"shieldedCells":0,"unshieldedCells":0} -> {"pools":0,"shieldedCells":0,"unshieldedCells":0} (unchanged) |
| `unknown-colour-withdraw-unshielded` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: account colour balance too low \| cause: failed assert: account colour balance too low` | `/account colour balance too low/` matched | yes | {"pools":0,"shieldedCells":0,"unshieldedCells":0} -> {"pools":0,"shieldedCells":0,"unshieldedCells":0} (unchanged) |

- **duplicate-registration** — Registering an account id that already exists is refused. Expectation: rejected with 'account already registered'; the account set is unchanged and no custody cell was created
- **unregistered-witness** — NC-1 shape: a witness that opens no registered account is refused at the choke point. Expectation: rejected with "caller's owner witness matches no registered account" before any balance or pool guard is reached
- **unregistered-credit** — NC-4 shape: a deposit naming an unregistered account commitment is refused. Expectation: rejected with 'credit account is not registered'; credit is open to REGISTERED accounts only, and the refusal creates no pool and no cell
- **unknown-colour-withdraw** — v3-specific: withdrawing a colour the Manager has NEVER SEEN is refused by the per-account guard reading the absent cell as 0. Expectation: rejected with 'account colour balance too low' — not with a colour-configuration error, because there is no colour configuration; and NO cell or pool is created for that colour
- **unknown-colour-withdraw-unshielded** — FR-206 shape: withdrawing a DORMANT unshielded colour is refused, and the colour stays absent from every map. Expectation: rejected with 'account colour balance too low'; all three map sizes remain 0

The map-size column is the NO-STATE-CREATED proof (FR-202). 00004 could not make this
assertion: its cells were all seeded at registration, so "no new cell" was vacuous. In v3
a refusal that lazily created an empty cell would be caught here even though the cell's
value would read zero.

