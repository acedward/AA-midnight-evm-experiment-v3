# 00010 Phase 4 — Tier-3 consumer audit

**Question this answers (SC-103, FR-1005):** after the FR-031 semantic commitment moved off-circuit
and the `Misc` semantic event was deleted, does any component anywhere still trust a commitment it
did not recompute from the proved transcript?

**Verdict: NO. Zero event-trusting consumers remain.** One consumer existed; it has been rewritten
so that trusting an event is not expressible through it. The inventory below is grep-complete, not a
sample, and every search command is recorded so it can be re-run.

---

## 1. The security rule being audited against

> **No consumer may trust a semantic commitment it did not recompute from the proved transcript.**

The k=19 Manager emits **no events at all** (`grep 'emit(' contracts/manager.compact` returns
nothing), so there is no emitted commitment to trust. The rule therefore holds by construction for
anything downstream; the audit's job is to confirm nothing still *tries*, and that nothing silently
degrades to "no commitment found, carry on".

---

## 2. Search commands (re-runnable, run from the clone root)

```sh
# A. the removed event NAME, as the raw 32-byte hex constant
git grep -n -i "535c1031f585e2d7a795d0e332a97418cd8eddde40eefa214fb78a2e18812c1a" -- .

# B. every removed symbol
git grep -n "extractManagerSemanticEvents"        -- . ':!contracts/variants' ':!archive' ':!evidence'
git grep -n "MANAGER_SEMANTIC_EVENT_NAME"         -- . ':!contracts/variants' ':!archive' ':!evidence'
git grep -n "MANAGER_SEMANTIC_EVENT_PAYLOAD_BYTES" -- . ':!contracts/variants' ':!archive' ':!evidence'
git grep -n "ManagerSemanticEvent"                -- . ':!contracts/variants' ':!archive' ':!evidence'
git grep -n "emitSemanticCommitment"              -- . ':!contracts/variants' ':!archive' ':!evidence'
git grep -n "semanticEventName"                   -- . ':!contracts/variants' ':!archive' ':!evidence'

# C. EVERY reader of contract log events, by mechanism rather than by name
git grep -n "logEvents\|ContractLog\|LogEvent\|eventType\|decodeAll" -- . ':!contracts' ':!archive' ':!evidence'

# D. any handling of the Misc event type
git grep -n "Misc" -- . ':!contracts/variants' ':!archive' ':!evidence' ':!scripts/00009'

# E. every file touching the commitment at all
git grep -ln "semanticCommitment\|buildSemanticCommitment\|semanticCommitmentFor" \
  -- . ':!contracts/variants' ':!archive' ':!evidence' ':!scripts/00009'
```

Search C is the important one: it finds event readers **by the mechanism they must use**, so a
consumer that never mentions "semantic" cannot hide from it.

---

## 3. Inventory and per-consumer verdict

| # | Consumer | What it did at k=20 | Verdict | Evidence |
|---|---|---|---|---|
| 1 | `harness/src/auth/manager-events.ts` | `extractManagerSemanticEvents()` decoded `Misc` events, matched the semantic name, and **returned the commitment as a value to be trusted** | **REWRITTEN** — the trusting API is gone; see §4 | `tier3.test.ts` claims 3 and 4 |
| 2 | `harness/src/auth/test/manager.test.ts` | asserted the emitted commitment equalled the expected one (3 call sites) | **UPDATED** to assert no events + two-way transcript recomputation | 12/12 pass on the k=19 build |
| 3 | `harness/src/test/sim.ts` | surfaces `logEvents` from the runtime context; **does not interpret them** | **NO CHANGE NEEDED** — a transport, not a consumer. Extended only with the optional `ManagerBuild` seam for A/B testing | search C, lines 52 and 464 |
| 4 | `harness/src/phase4/live-matrix.ts` | imports `auth/manager`, `auth/signature`, `auth/codec`, `auth/bytes`, `auth/metamask`, `auth/schema` | **NO CHANGE NEEDED** — reads no events (`grep 'logEvents\|Event\|semantic'` is empty) | search C/E |
| 5 | `harness/src/auth/semantic.ts` | the independent TypeScript recipe — computes from fields, reads nothing | **NO CHANGE NEEDED**, and it is now *load-bearing*: it is one of the two recomputations | `semantic.test.ts` 5/5 |
| 6 | `harness/src/auth/manager.ts` (`semanticCommitmentForExecute`) | builds the commitment input from an `ExecutePayload` | **NO CHANGE NEEDED** — this is transcript recomputation, exactly what the rule requires | `k20-parity.test.ts`, `tier3.test.ts` |
| 7 | `harness/src/auth/fixtures/{generate.ts,v1.json}` | golden fixtures for the recipe | **NO CHANGE NEEDED** — the recipe is byte-unchanged, so fixtures stay valid; proven by `semantic.test.ts` and `compact.test.ts` passing unmodified | 5/5 and 5/5 |
| 8 | `harness/src/auth/compact/AuthCodec.compact` (+ its generated artifact) | a separate reference contract implementing the recipe for cross-checking | **NO CHANGE NEEDED** — independent of the Manager's event surface | `compact.test.ts` 5/5 |
| 9 | `scripts/00009/{check-frozen-surface,make-d-arms,make-w-arms}.py` | 00009 measurement tooling that generates ablation arms containing `emit(Misc {…})` | **OUT OF SCOPE, LEFT AS IS** — these generate 00009's non-shipping measurement variants from the k=20 source; they are historical measurement apparatus, not product consumers, and rewriting them would invalidate 00009's recorded arms | see §5 |

**Consumers that read a commitment out of an event after this audit: 0.**

---

## 4. What consumer #1 became, and why that is stronger than a documented rule

`manager-events.ts` no longer exports anything that returns a value read from contract output. Its
entire export surface is now two functions — a fact asserted by a test
(`tier3.test.ts`: *"exposes no function that reads a commitment from anywhere"*):

| Export | Behaviour |
|---|---|
| `assertManagerEmitsNoEvents(events)` | Throws if the call emitted anything. Checks the removed event name explicitly against **both** the decoded and the degraded raw-prefix representation, so a reintroduced event cannot hide behind the simulator's shortened `Misc` cell, and then throws on a non-empty event list in general. |
| `recomputeSemanticCommitment(transcript, oracle, independent)` | Computes the commitment **twice** — once through the contract's exported pure oracle `semanticCommitmentFor`, once through the independent TypeScript recipe — and **refuses to return** unless they agree. |

The removed event name is retained in the file as a **deny-list constant only**, deliberately not
exported: it exists so the assertion can name what must never appear, not so anything can filter
*for* it.

This converts the rule from documentation into a type-and-API property: a caller that wanted to
trust an event value has no function to call.

### Executed proof that these are not vacuous

| Property | How it is proven | Result |
|---|---|---|
| A real k=20 semantic event is REFUSED, not accepted | The k=20 contract is compiled and driven in the same process; its genuine emitted event is handed to `assertManagerEmitsNoEvents` | throws — PASS |
| The disagreement guard actually guards | `recomputeSemanticCommitment` is called with a deliberately drifted second recomputation | throws `recomputation disagreed` — PASS |
| The commitment binds every field it covers | Six single-field perturbations (manager, domain, accountId, authResult, accountSalt, validUntil); each must change the commitment, each must be distinct, and the pure oracle must agree on every perturbed input | PASS |
| The "no events" tests discriminate | **Negative control:** the whole suite re-run with the k=20 build as the arm | **8 failures, and all 8 are exactly the "emits no events" assertions.** The tests are not vacuous |

---

## 5. Consumers that do not exist in this repository — and where they do

The plan asks for harness readers, batcher, browser and relayer paths. At this base commit
(`4282400`, descended from `00008-AA-v3-evm-w2-contract`) **no batcher, browser, relayer or indexer
code is tracked at all**:

```sh
git ls-files | grep -iE "batcher|browser|relayer|indexer"   # -> empty
```

That work lives on sibling branches that were never merged into this line. They were audited
**read-only** in their own clones, and neither contains a semantic-event consumer:

| Clone | Search for the event name / `extractManagerSemanticEvents` / `MANAGER_SEMANTIC_EVENT` | Verdict |
|---|---|---|
| `experiments/00008-AA-v3-evm-w2-batcher` @ `3f75193` | no hits | **no consumer to update** |
| `experiments/00008-AA-v3-evm-w2-browser` @ `42ad93d` | no hits | **no consumer to update** |
| `experiments/00008-AA-v3-evm-w2-contract` @ `910be31` | `harness/src/auth/manager-events.ts`, `harness/src/auth/test/manager.test.ts` | the two files this project already handled — this clone is the k=20 ANCESTOR and is deliberately left untouched |

All three sibling clones were verified unchanged by the audit (`git grep` is read-only):

| Clone | HEAD after audit | `git status --porcelain` |
|---|---|---|
| `00008-AA-v3-evm-w2-batcher` | `3f75193` | 0 lines |
| `00008-AA-v3-evm-w2-browser` | `42ad93d` | 0 lines |
| `00008-AA-v3-evm-w2-contract` | `910be31` | 1 line — `?? harness/generated-zk-u13/`, the pre-existing untracked entry 00009 also recorded; unchanged |
| `00009-circuit-weight-optimization` | `4282400` | 0 lines; `manager.compact` still `85b538bc…` |

**Carry-forward for the owner (not a blocker for this project):** if the batcher/browser/relayer
lines are ever merged with this Manager, they inherit the Tier-3 rule automatically — there is no
event for them to read. The only work they would need is the positive one: recomputing the
commitment from the transcript via the pure oracle if they want it at all.

---

## 6. Residual risk

| Risk | Assessment |
|---|---|
| A future consumer re-adds event parsing | It would have to add an `emit` to the contract first; `assertManagerEmitsNoEvents` fails the suite the moment that happens, on every selector and both auth modes |
| The pure oracle and the TS recipe drift apart | `recomputeSemanticCommitment` refuses to return on disagreement, and `k20-parity.test.ts` compares both against the k=20 artifact across every fixture case |
| The oracle stops being pure (gaining a proving key, changing the deploy cost) | `tier3.test.ts` claim 1 asserts `pure=true, proof=false` in the compiler metadata and pins the full nine-key proof surface |
| Someone reads the commitment from a *transaction log* outside this repo | Cannot: nothing is emitted. This is the failure mode Tier-3 removes by construction rather than by discipline |
