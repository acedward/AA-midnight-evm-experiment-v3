# FR-308 OPENNESS — the owner-REQUIRED outcome

`EXPERIMENTAL_LANE` / `LANE-DEV-1` · recorded 2026-08-20T15:35:53Z

## VERDICT: GREEN — via the FLOATING-SURPLUS shape (FR-308 v2a)

Owner Q1, 2026-08-19, verbatim: "lets take the the recommended, but we need a way to make this
zswap useful in real cases - so that it can be used somehow by any user that has access to it."
FR-308 encodes that as a REQUIRED outcome with two shapes, attempted in order.

| Shape | Spike | Verdict |
|---|---|---|
| v2(a) floating surplus — A released with NO output, swept by the taker's own balancer | S4 | GREEN |
| v2(b) bearer key — A paid to a throwaway key whose secret ships in the envelope | S4b | NOT RUN |

### Openness is GREEN, and here is exactly what that does and does not mean.

A holder whose keys the maker never knew settled a live offer built from contract custody.
That is the requirement, and it is met.

What it does NOT mean:

- It does not mean both shapes work. Only the one marked GREEN above was demonstrated.
- The shape that worked is the FLOATING SURPLUS, which is the preferred one precisely
  because it fixes no recipient at all: the released value is swept inside the settling
  transaction by the settler's own balancer, so there is no published secret and no
  post-settlement race. The bearer shape, had it been needed, would have had both.
- It says nothing about the v1 named-taker half of FR-308, which is a separate, weaker
  claim (a swap with a counterparty the maker already knows) and is reported separately.

Details: `S4.md`, `S4b.md` (if run), and the JSON files beside them.
