# G2 — contracts deployed, colours read, Manager configured

`EXPERIMENTAL_LANE` / `LANE-DEV-1` — 00004-multi-token-custody, Plan 02 Phase 3.

Recorded (UTC): 2026-08-18T21:04:32.925Z
Verdict: **PASS**

## Deployments — ONE Minter artifact, three constructor tags (FR-101)

| Deployment | tag in | tag stored on-chain | address | shielded colour | unshielded colour |
|---|---|---|---|---|---|
| Minter1 (`TOKA`) | `544f4b4100000000…` | `544f4b4100000000…` (identical) | `3b7bfa336e42…` | `bca98014773c30717198e564451f7f90ce88d36449b496a1cebea7b67a65bffe` | `9a1288102ff361119f0555dbc53596045df041236584ea1aa122761f12d56da7` |
| Minter2 (`TOKB`) | `544f4b4200000000…` | `544f4b4200000000…` (identical) | `77c2f28c3838…` | `f818da4c1fbc34f6e8e6c7d22414475d23df1090b1a87b7f72336c5cde223bff` | `13ceddbbd387e2c32dcd3bb2d6a69936225346e8a827318ab37f0671ca4f2553` |
| Minter3 (`TOKC`) | `544f4b4300000000…` | `544f4b4300000000…` (identical) | `0dafc7c52932…` | `6c2c11e2cf8768706da2cae690f7f3dcfdef8926670c0f0a3594e09d0388c5e9` | `64175427e4079751818b320c82460e0eeeb192f819830447a1926c1aa7d7e5c8` |
| Manager | — | — | `50801c1c9a72…` | — | — |

Each deployment's two family separators were also derived in process by the separately
compiled `--skip-zk` artifact from the same tag and matched the on-chain cells exactly.

## Distinctness — 6 colours, all pairwise comparisons

**15/15 distinct** (no collisions)

Read from on-chain circuit calls, never derived off-chain.

| Role | Colour |
|---|---|
| configured S1 | `bca98014773c30717198e564451f7f90ce88d36449b496a1cebea7b67a65bffe` |
| configured S2 | `f818da4c1fbc34f6e8e6c7d22414475d23df1090b1a87b7f72336c5cde223bff` |
| configured U1 | `9a1288102ff361119f0555dbc53596045df041236584ea1aa122761f12d56da7` |
| configured U2 | `13ceddbbd387e2c32dcd3bb2d6a69936225346e8a827318ab37f0671ca4f2553` |
| control (never configured) Minter3.shielded | `6c2c11e2cf8768706da2cae690f7f3dcfdef8926670c0f0a3594e09d0388c5e9` |
| control (never configured) Minter3.unshielded | `64175427e4079751818b320c82460e0eeeb192f819830447a1926c1aa7d7e5c8` |

## Manager state after `configure` + registration

- `configured`: true
- bound colours: S1 `bca98014773c30717198e564451f7f90ce88d36449b496a1cebea7b67a65bffe`, S2 `f818da4c1fbc34f6e8e6c7d22414475d23df1090b1a87b7f72336c5cde223bff`,
  U1 `9a1288102ff361119f0555dbc53596045df041236584ea1aa122761f12d56da7`, U2 `13ceddbbd387e2c32dcd3bb2d6a69936225346e8a827318ab37f0671ca4f2553`
- accounts: AA_A `67105e92521d24ccd0b0ee9d2ff842aec4b0dbfb81123b2143c9512fe6f114e7`, AA_B `e01c3be2d447aa46f6b9a9d8ab6b0f5fef285782b0b6af40bea330a59de33e92`
- balance cells: 8 (2 accounts x 4 colours, seeded at zero)
- pools: 0

| | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| AA_A | 0 | 0 | 0 | 0 |
| AA_B | 0 | 0 | 0 | 0 |

Second observation point — real on-chain circuit calls:

- `isRegistered(AA_A)` = `true`
- `accountBalance(AA_A, S1)` = `0`
- `accountBalance(AA_B, U2)` = `0`
- `poolHasColour(S1)` = `false`

## Unit-level negatives

| Id | Status | Refused at | Verbatim error | Expected message | State byte-identical |
|---|---|---|---|---|---|
| `reconfigure` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: already configured \| cause: failed assert: already configured` | `/already configured/` matched | yes |
| `duplicate-registration` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: account already registered \| cause: failed assert: account already registered` | `/account already registered/` matched | yes |
| `unregistered-witness` | **GREEN** | circuit execution (no transaction built) | `Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: caller's owner witness matches no registered account \| cause: failed assert: caller's owner witness matches no registered account` | `/matches no registered account/` matched | yes |

- **reconfigure** — A second `configure` is refused (FR-102, one-time binding). Expectation: rejected with 'already configured'; the four bound colours are unchanged
- **duplicate-registration** — Registering an account id that already exists is refused. Expectation: rejected with 'account already registered'; the account set and the 8 seeded cells are unchanged
- **unregistered-witness** — NC-1 shape: a witness that opens no registered account is refused at the choke point. Expectation: rejected with "caller's owner witness matches no registered account" before any colour, balance or pool guard is reached

