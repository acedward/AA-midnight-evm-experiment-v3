# VERIFICATION — 00005-open-colour-custody

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` — the pinned v2.0.0-rc.4 prerelease slot, inherited
from project 00003 through 00004 and verified as unchanged at BOTH ancestors rather than re-pinned.
No supported-lane or production validity.

This ledger is appended as work lands, never reconstructed afterwards. Timestamps are UTC and come
from the retained `run.log` of each gate. Where a run was superseded it is recorded as superseded,
with what it got wrong — including the one case where a superseded run had reached the **opposite
conclusion** and would have been reported as the answer.

Governance pinned at execution start:

| Item | Value |
|---|---|
| Approved spec SHA-256 | `bb32e42b2ab78d0ae90d165b26b29a1fb6b568feb399622703aa634b1255a6f0` |
| Spec approval | owner review Q&A 2026-08-19 (Q1 → "fully open, permissionless, lazy"; Q2 → new project stacked on 00004, verbatim in the spec's Approval record) |
| Spec mutability | IMMUTABLE during execution; checkboxes stay UNTICKED (00003 Q1-A convention) |
| Plan-set review | owner directed immediate execution; owner reviews between gates |
| Product clone branch | `00005-open-colour-custody`, cut from `00004-multi-token-custody` @ `f066a09` (PR #2 deliberately held OPEN — owner decision Q2-A-modified: this project's PR bases on the branch, and nothing is merged) |
| Organizer branch (spec + plans) | `claude/contract-token-custody-6d6cd3` (the owner manages organizer commits) |

| What | Absolute path |
|---|---|
| Product clone (this repo) | `/Users/edwardalvarado/todo/AA/experiments/00005-open-colour-custody` |
| Organizer docs (worktree) | `/Users/edwardalvarado/todo/AA/.claude/worktrees/contract-token-custody-6d6cd3/AA` |
| References (read-only) | `/Users/edwardalvarado/midnight-ref-ai/v2.0.0-rc.4` |
| 00004 clone (read-only reference) | `/Users/edwardalvarado/todo/AA/experiments/00004-multi-token-custody` |

Host toolchain observed (nothing installed globally by this project):

| Tool | Version |
|---|---|
| Docker CLI | 29.1.3 (build f52814d) |
| Docker Compose | 2.40.3-desktop.1 |
| Platform | Darwin arm64 (**aarch64** — image-architecture relevant) |

---

## G1 — Workspace, lane inheritance, W-1

**Wrapper:** `scripts/g1/verify-g1-lane.sh` · **Evidence:** `evidence/g1-lane/` ·
**Result: GREEN**, `final_exit: 0` including teardown. Two runs; run 2 is the retained evidence.

### Phase 1 — clone and branch

| UTC | Command | Exit | Result |
|---|---|---|---|
| 2026-08-19 | `git clone https://github.com/acedward/AA-midnight-evm-experiment-v3` → `experiments/00005-open-colour-custody` | 0 | Clone created |
| 2026-08-19 | `git checkout -b 00005-open-colour-custody f066a09` | 0 | Branch cut from the 00004 head; verified `f066a09 == origin/00004-multi-token-custody` |
| 2026-08-19 | `git push -u origin 00005-open-colour-custody` | 0 | Pushed. **Never `gh repo create`** |

**Scaffolding note.** The branch is cut from `f066a09` in the SAME repository, so 00004's
harness/scripts/docker tree is inherited through git history — nothing was copied out of the 00004
clone, which was never opened for writing. 00004's `evidence/`, `README.md`, `REPORT.md` and
`VERIFICATION.md` were relocated UNMODIFIED to `archive/00004/` (`archive/00004/ARCHIVE.md`), the
pattern 00004 itself used for 00003. Also archived, because 00005 does not use them: 00004's
compile probes `contracts/probes/`, `scripts/g1/probe-compile.sh`, `harness/src/g1/probe-p2.ts` and
00004's 14-row offline dry run `harness/src/test/step-ledger.test.ts`. Links inside archived
documents point at their own layouts and are stale on this branch by design.

### Phase 2 — the lane is INHERITED, and that is proven at BOTH ancestors

`scripts/lib/lane-pins.sh` (`lane_assert_pins_unchanged`), run as gate step `03-lane-reuse` — and
re-run by **every** later gate, so each gate is self-contained evidence rather than a claim resting
on G1's run. 00005 added check (0), which is the new one:

| # | Comparison | Result |
|---|---|---|
| 0 | **the whole inheritance chain**: image digests, compactc archive pin and `harness/pnpm-lock.yaml` identical at BOTH 00003 `a8ebff9` AND 00004 `f066a09` | identical at both — 00004 did not re-pin, and a silent re-pin could not hide behind a check against 00004 alone |
| 1 | `sha256:` image digests in `docker/compose.yml` vs `f066a09` | identical (node / indexer / proof-server) |
| 2 | compiler archive pin `ARG COMPACTC_URL` + `ARG COMPACTC_SHA256` (`3aa23812…dc46`) | identical |
| 3 | `harness/pnpm-lock.yaml` byte-identity (blob `a0a191d1…`) | identical — the whole transitive npm set is pinned |
| 4 | `harness/package.json` dependency + devDependency blocks | unchanged |
| 5 | `docker compose config --images` | resolves to exactly the three pinned digests, never a tag |

Evidence: `evidence/g1-lane/03-lane-reuse.out`, `evidence/g1-lane/LANE.md` (manifest generated while
the stack was up, including the image IDs that ACTUALLY ran).

### Phase 2 — W-1 adopted from step 01 of every gate

`scripts/lib/docker-w1.sh`, inherited from 00004's G4 diagnosis: the host's
`docker-credential-desktop` can hang, wedging every `docker pull` before it reaches the network.
Gates run with a scratch `DOCKER_CONFIG` containing `{}` plus a symlink to the real `cli-plugins`,
exported for the gate's child processes only and removed by its teardown.

| Observation | Value |
|---|---|
| scratch config | `{}` in `$TMPDIR/aa00005-dockercfg-XXXXXX`, `cli-plugins` symlinked (14 plugins) |
| `docker compose` under it | `2.40.3-desktop.1` — resolves, which is the check 00004's G4 run 2 failed |
| daemon under it | server 29.1.3, reachable |
| pins under it | `docker compose config --images` resolved exactly the three pinned digests |
| was the helper actually wedged? | **No** — on these runs `docker-credential-desktop get` answered in <1 s, so W-1 was PREVENTIVE, not curative. Recorded as such rather than claimed as a fix for a fault that did not occur |
| scope | environment variable only; `~/.docker/config.json` untouched; no pin, step or assertion changed |

### Phase 3–4 — stack smoke and the wrapper

11 steps: W-1, ports, lane inheritance, LANE-DEV-1, pull, boot, health, install, wallets, funding,
record-lane. Fresh isolated stack, ports probed free and >10000, bound to `127.0.0.1`. Wallets
genesis/feePayer/ownerN/ownerM/ownerA/ownerB opened; fee wallet funded and DUST-registered; smoke
transfer feePayer → OwnerN confirmed. Teardown: `compose down -v` + `stack_assert_clean` +
`w1_cleanup`.

### Run record

| Run | UTC | Outcome |
|---|---|---|
| 1 | 2026-08-19T03:02:47Z → 03:04:32Z | GREEN, `final_exit: 0` — **SUPERSEDED** |
| 2 | 2026-08-19T03:33:27Z → 03:36:02Z (155 s) | **GREEN**, `final_exit: 0`, teardown `exit: 0` — RETAINED |

Run 1 was green on its own terms. It was re-run only because its `03-lane-reuse.out` carried a stale
HEADING (`base commit f066a09… (00003 merged head)` — the commit was right, the label was 00003's).
A one-word fix in `lane-pins.sh` would have left committed evidence that did not match the committed
code, so **the gate was re-run rather than the evidence hand-edited**. That precedent is used again
at G3. Note the ordering: run 2 landed AFTER G2's run, because the stale heading was noticed then.

Step durations, run 2: W-1 0 s, ports 1 s, lane-reuse 0 s, LANE-DEV-1 1 s, pull 2 s, boot 6 s,
health 3 s, install 0 s, wallets 6 s, **funding 135 s**, record-lane 0 s. Host after both runs:
0 containers, 0 volumes, 0 networks matching `aa00005`, and no `aa00005-dockercfg-*` scratch
directory left in `$TMPDIR`.

---

## G2 — Manager v3 + MinterCollide, and the deploy-order proof

**Wrapper:** `scripts/g2/verify-g2-contracts.sh` · **Evidence:** `evidence/g2-contracts/` ·
**Result: GREEN on the first attempt**, `final_exit: 0` including teardown, verdict PASS, 0 failures.

### What was built

| Source | SHA-256 | Status |
|---|---|---|
| `contracts/minter.compact` | `5eefba98962ddbef4af6b1ea4d17c21f37baf1d712c5822be0a7b4c245d6c1ef` | REUSED UNCHANGED — byte-identical to `f066a09`, asserted by the gate |
| `contracts/manager.compact` | `49ae97218b753e0f101aaaa1e90c711f8965d21d456ae4cef5b80d3679a2ad3a` | **v3, rewritten: fully open** |
| `contracts/minter-collide.compact` | `a649df17d243fd6537a5d72e53140242320173a7770641708cf74382c5e4b25e` | **new — the P-COLL fixture** |

Compiled on the pinned compactc 0.33.0 / language 0.25.0: Manager 15 circuits / 12 ZK keys
(`shieldedKey`, `unshieldedKey`, `myAccount` are pure), Minter 4/4, MinterCollide 5/5 — 21 verifier
keys over the three contracts, all recorded in `evidence/g2-contracts/ARTIFACTS.md`.

### Finding F-201, found by the build itself

The first `--zk` build reported that `minter.shieldedColor` and MinterCollide's three colour readers
compile to **byte-identical prover AND verifier keys** — same circuit body, same ledger-field index —
and `ZKConfigRegistry` resolves by verifier-key hash. Consequences taken, recorded in
`evidence/g2-contracts/08-compile-zk.out`:

- 00004's build-time "no circuit name appears twice" assertion was **removed** — MinterCollide
  deliberately mirrors the Minter's API, so name uniqueness is not a property this project has, and
  never was a proving requirement;
- replaced by a **sharper** check: a shared verifier key is reported and is FATAL only if the
  corresponding PROVER keys differ. This build: 2 shared verifier keys, both with identical prover
  keys → observation recorded, check passes.

### The deploy-order proof (spec success criterion 2, first half)

| UTC | What | Result |
|---|---|---|
| 2026-08-19T03:32:57Z | chain tip before ANY contract of the demonstration | block **17** |
| — | Manager deploy tx `34041db0e021b116…` | applied in block **20** |
| — | Minter1/2/3 + MinterCollide | blocks 23 / 32 / 41 / 50 — all strictly later |
| — | `contractAction(address, {blockOffset:{height:20}})` for each minting contract | `null` — did not exist |
| — | `contract(address, offset:{height:20})` (`@beta`) for each | `null` — did not exist |
| — | the same two queries for the **Manager** | **present** both times — the discriminating control |

Two independent query forms, three independent records (the SDK's own `deployTxData.public` is the
third, verbatim in `deploy-order.json`). The `@beta` query is served by this indexer and answered, so
no fallback was needed.

### Registration seeds NOTHING — the visible difference from 00004

After registering **both** accounts: `{"pools": 0, "shieldedCells": 0, "unshieldedCells": 0}`, and
identical at the end of the gate. 00004 held `accounts x 4 = 8` cells at this point. Confirmed at two
observation points: the decoded ledger state, and on-chain circuit calls against colours the Manager
has never been told about (`isRegistered(AA_A)=true`, `shieldedAccountBalance(AA_A,S1)=0`,
`unshieldedAccountBalance(AA_B,U1)=0`, `poolHasColour(S1)=false`) — and making those reads created no
cell, re-read afterwards.

### Distinctness and the ONE inverted equality

- **15/15** pairwise distinct over the six Minter colours, 0 collisions, from on-chain circuit calls.
- MinterCollide's `shieldedColor()` and `unshieldedColor()` both returned
  `6c4727ed9db047e54e085a297867b6d033c29514a4cdaadfe2d9bf207ffa03d4` — **byte-identical, asserted as
  equality**, and colliding with none of the six.
- The Manager keeps those identical bytes apart by KEY DOMAIN, derived by running its own pure
  circuits: `shieldedKey(AA_A, TOKX) = 26656c86bda379df…` vs `unshieldedKey = 0cd2d46273c6a21a…`.

### Unit negatives — 5/5, verbatim, state-neutral

Every one rejected at circuit execution (no transaction built), whole Manager state byte-identical
AND map sizes `{0,0,0} → {0,0,0}`:

Verbatim messages are recorded in full in `evidence/g2-contracts/CONTRACTS.md`; the contract's own
assert, quoted from them, is:

| Id | The contract's own assert |
|---|---|
| `duplicate-registration` | `failed assert: account already registered` |
| `unregistered-witness` (NC-1 shape) | `failed assert: caller's owner witness matches no registered account` |
| `unregistered-credit` (NC-4 shape) | `failed assert: credit account is not registered` |
| `unknown-colour-withdraw` | `failed assert: account colour balance too low` |
| `unknown-colour-withdraw-unshielded` (FR-206 shape) | `failed assert: account colour balance too low` |

The last two are the ones 00004 **could not run at all**: withdrawing a colour the Manager has never
seen. v2 would have refused with a colour-configuration error; v3 has no colour configuration, so the
refusal comes from the per-(account, colour) guard reading an ABSENT cell as 0 — and the map sizes
prove no cell was created on the way.

### Run record

| Run | UTC | Outcome |
|---|---|---|
| 1 | 2026-08-19T03:22:48Z → 03:33:00Z (612 s) | **GREEN**, `final_exit: 0`, teardown `exit: 0` |

Step durations: W-1 0 s, ports 1 s, lane-reuse 0 s, LANE-DEV-1 2 s, compile-fast 2 s, install 0 s,
unit-suites 2 s (42 tests), compile-zk 65 s, pull 2 s, boot 6 s, health 2 s, **deploy-order 527 s**,
record-artifacts 2 s. Host clean afterwards.

---

## G3 — the 18-row open-colour step ledger, controls and probes

**Wrapper:** `scripts/g3/verify-g3-ledger.sh` · **Evidence:** `evidence/g3-ledger/` ·
**Result: GREEN**, `final_exit: 0` including teardown, `CELLS.md` **30/30 GREEN**, no gaps, nothing
RED and nothing RECORDED. Two runs; **run 1 is superseded and its conclusion was WRONG**.

### Offline first, on purpose

`npx vitest run` — **56 tests over 3 files**, run as gate step `07` BEFORE anything boots:

| File | Covers |
|---|---|
| `manager.test.ts` | FR-201 (no `configure` circuit in the compiled artifact; registration seeds nothing), FR-202 (lazy creation incl. the CREDIT side of an internal transfer; refusals create no cell, asserted on MAP SIZES), FR-203 (different keys per family; byte-identical colours tracked independently; a shielded spend backed only by the other family is refused), FR-204 (NC shapes + guard order), FR-205, FR-206 |
| `minter.test.ts` | the unchanged Minter (10 colours from 5 tags, 45/45 pairwise distinct) and MinterCollide's INVERTED byte-equality |
| `step-ledger.test.ts` | an OFFLINE dry run of the whole 18-row transcription — against itself, against the spec's separately written final table and end-state map sizes, and replayed through the compiled artifact in process |

That dry run is cheap insurance: a transcription or argument-order slip costs a second instead of an
hour of chain time.

### The live run

| UTC | Step | Result |
|---|---|---|
| 2026-08-19T04:52:15Z | gate start | compose project `aa00005-g3-…`, ports verified free >10000 |
| — | `12-step-ledger` (1643 s) | rows 0–17, NC-1..5, P-COLL, M3, distinctness — all GREEN |
| — | `13-render-cells` (1 s) | `CELLS.md` 30/30 GREEN, no gaps |
| 2026-08-19T05:20:58Z | gate end | `final_exit: 0`, teardown `exit: 0`, host clean |

Headline figures, all from `evidence/g3-ledger/run-context.json`:

| What | Value |
|---|---|
| Chain tip before ANY contract existed | block **42** |
| Manager deployed | block **45** |
| TOKA / TOKB / TOKC | blocks 57 / 67 / 76 |
| **TOKD (mid-ledger)** | block **172** |
| TOKE / TOKX | blocks 213 / 222 |
| At block 45, every issuer address | `null` from the indexer, asked both ways, Manager present as the control |
| End-state map sizes | `{pools 4, shieldedCells 5, unshieldedCells 3}` — exactly the spec's separately written figures |
| Maps after rows 0–6 | `{0, 0, 0}` — deploy, register both accounts, mint five colours, and nothing exists |
| Distinctness | **45/45** over TOKA–TOKE, 0 collisions; MinterCollide's pair byte-EQUAL (the inverted assertion) |
| P-COLL | one 32-byte colour: pool `3` vs contract ledger balance `2`; after one withdrawal each side, `2` vs `1`; two on-chain circuit calls on the IDENTICAL argument answered `2` and `1` |
| M3 | ONE tx `00202436c94913c2b9b1556d064ebbe1d055c48ed0aa0983e66b43f8fc0f150c2a` carried both first deposits; map sizes `{5,6,4}` → `{6,7,5}` |
| NC-1..5 | GREEN with verbatim contract asserts, funds byte-identical AND no-state-created, each naming the exact cell proven still absent |

### Run record — and the run that was WRONG

| Run | UTC | Outcome |
|---|---|---|
| 1 | 2026-08-19T04:17:59Z → 04:45:17Z | GREEN on its own terms — **SUPERSEDED, and its M3 conclusion was wrong** |
| 2 | 2026-08-19T04:52:15Z → 05:20:58Z (1723 s) | **GREEN**, `final_exit: 0`, teardown `exit: 0` — RETAINED, pushed as `ebfdce6` |

**1. The one that matters — an apparent finding that run 2 DISPROVED.** In run 1 the SDK
contract-scoped batch was refused for M3's shape, FR-207's fallback fired, and it looked like D-203
resolved the other way: *the ledger refuses to compose two first credits*. Run 2 attempted the same
composition TWICE on fresh wallets — the first attempt was refused with the same node code, the
**second was ACCEPTED**, carrying both first deposits under one transaction id. So the refusal is
F-107's signature (a wallet whose view has not settled balances into a transaction the node refuses
with a bare code), now confirmed for the SCOPED-BATCH shape, and recorded as finding **F-203**.

> Had run 1's single-attempt result been reported as the answer, this project would have published
> the opposite of the truth about D-203. Anything quoting run 1's M3 result is stale.

**2. Defect — the verbatim refusal was not actually captured (F-202).** `errorChain` truncated at
1200 characters, and the pinned SDK's Effect-based submission service inlines its ENTIRE stack into
the first message on one line, so the budget was exhausted before any `cause` was reached. FR-207
requires the verbatim error; what run 1 recorded was a stack trace wearing its clothes. Fixed by
stripping frames (whole-line and inline forms) before joining, verified against run 1's real string —
a node-side `1010: Invalid Transaction: Custom error: 104` now survives into the evidence.

**3. Defect — a mislabelled custody figure.** `renderCustody` chose `pool`/`ledger` from the colour
NAME's first letter, so P-COLL's shielded colour `XS` printed as `ledgerXS=3`. The value was right and
the label was wrong, which is the worse of the two. Fixed: the label now comes from the registry's
FAMILY.

All three were fixed by **re-running the gate**, never by editing committed evidence — run 1's output
was deleted, not corrected (the precedent G1 set on this project). Run 2 additionally strengthened
two things while the gate had to be re-run anyway: M3 attempts the composition twice on fresh
spenders and asserts the refused attempt's state-neutrality directly; and P-COLL and M3 each gained a
real on-chain circuit-call observation point — for P-COLL, two calls taking the IDENTICAL 32-byte
argument that must answer differently.

Step durations, run 2: W-1 0 s, ports 0 s, lane-reuse 1 s, LANE-DEV-1 1 s, compile-fast 3 s,
install 0 s, unit-suites 1 s (56 tests), compile-zk 61 s, pull 2 s, boot 5 s, health 3 s,
**step-ledger 1643 s**, render-cells 1 s. Host after both runs: 0 containers, 0 volumes, 0 networks
matching `aa00005`, and no `aa00005-dockercfg-*` scratch directory left in `$TMPDIR`.

### Decisions closed from evidence inside this gate

| Id | Decision | How it closed |
|---|---|---|
| **D-203** | M3 composition shape | **RESOLVED as proposed: the SDK contract-scoped batch.** FR-207's fallback was implemented and armed but not needed. See F-203 for why one attempt was not enough to say so |
| **D-204** | `transferInternal` split per family | closed by the owner at the G2 review (option A — keep the split); no contract change, no G2 re-run |

---

## G4 — clean-clone reproduction, closeout documents, publication

**Wrapper:** `scripts/g4/verify-g4-closeout.sh` · **Evidence:** `evidence/g4-closeout/`

_This section is completed when the gate runs; see the run record below._
