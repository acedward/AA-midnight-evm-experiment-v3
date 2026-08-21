# G5 calibration — may the offline placement model be quoted for ABSOLUTE boundaries?

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-21T02:31:25.927Z

Offline sweep parameters: **CHAIN parameters captured at evidence/g5-mitigation/chain-params.json**

## VERDICT: DIVERGENT

65 of 70 overlapping (variant, shape, cells) points agree.

At least one overlapping point disagrees, so **no absolute boundary from the offline model
is a lane fact**. What survives, and is still the ranking's primary evidence:

- the OFFER TRANSCRIPT PROGRAM LENGTH per variant, which is a property of the contract and
  does not depend on parameters or on state at all;
- the RELATIVE ordering of arms measured under identical parameters, identical simulator
  conditions and identical custody growth — the only difference between two such rows is
  the contract;
- every LIVE boundary, which is measured rather than modelled.

What does NOT survive: any statement of the form "arm X is publishable up to N cells" taken
from the model rather than from the live matrix.

## Disagreements

| variant | shape | cells | offline model | live chain |
|---|---|---|---|---|
| `manager` | named-taker | 2 | FALLIBLE | **GUARANTEED** |
| `v4-slim` | named-taker | 2 | FALLIBLE | **GUARANTEED** |
| `arm-a-dedupe` | named-taker | 4 | FALLIBLE | **GUARANTEED** |
| `arm-a-dedupe` | floating-surplus | 4 | FALLIBLE | **GUARANTEED** |
| `arm-b-nested` | floating-surplus | 1 | GUARANTEED | **FALLIBLE** |

Two candidate causes, and they are separable by further measurement rather than by argument:
(i) the parameters differ — re-running the sweep with `--params` on the captured
`chain-params.json` removes this one; (ii) the real on-chain contract state is more
expensive to read than the simulator's equivalent state, which would show up as the model
being systematically OPTIMISTIC at every point rather than at some.

Direction of the disagreements: **1 optimistic** (model says publishable, chain says not) and **4 pessimistic**. A purely optimistic set is consistent with cause (ii); a mixed set is not, and would point at something the model is getting wrong structurally.

## Every compared point

| variant | shape | cells | offline | live | agree |
|---|---|---|---|---|---|
| `manager` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `manager` | floating-surplus | 1 | GUARANTEED | GUARANTEED | yes |
| `manager` | named-taker | 2 | FALLIBLE | GUARANTEED | **NO** |
| `manager` | floating-surplus | 2 | FALLIBLE | FALLIBLE | yes |
| `manager` | named-taker | 4 | FALLIBLE | FALLIBLE | yes |
| `manager` | floating-surplus | 4 | FALLIBLE | FALLIBLE | yes |
| `manager` | named-taker | 8 | FALLIBLE | FALLIBLE | yes |
| `manager` | floating-surplus | 8 | FALLIBLE | FALLIBLE | yes |
| `manager` | named-taker | 16 | FALLIBLE | FALLIBLE | yes |
| `manager` | floating-surplus | 16 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `v4-slim` | floating-surplus | 1 | GUARANTEED | GUARANTEED | yes |
| `v4-slim` | named-taker | 2 | FALLIBLE | GUARANTEED | **NO** |
| `v4-slim` | floating-surplus | 2 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | named-taker | 4 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | floating-surplus | 4 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | named-taker | 8 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | floating-surplus | 8 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | named-taker | 16 | FALLIBLE | FALLIBLE | yes |
| `v4-slim` | floating-surplus | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-a-dedupe` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-a-dedupe` | floating-surplus | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-a-dedupe` | named-taker | 2 | GUARANTEED | GUARANTEED | yes |
| `arm-a-dedupe` | floating-surplus | 2 | GUARANTEED | GUARANTEED | yes |
| `arm-a-dedupe` | named-taker | 4 | FALLIBLE | GUARANTEED | **NO** |
| `arm-a-dedupe` | floating-surplus | 4 | FALLIBLE | GUARANTEED | **NO** |
| `arm-a-dedupe` | named-taker | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-a-dedupe` | floating-surplus | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-a-dedupe` | named-taker | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-a-dedupe` | floating-surplus | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-b-nested` | floating-surplus | 1 | GUARANTEED | FALLIBLE | **NO** |
| `arm-b-nested` | named-taker | 2 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | floating-surplus | 2 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | named-taker | 4 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | floating-surplus | 4 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | named-taker | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | floating-surplus | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | named-taker | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-b-nested` | floating-surplus | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-c-both` | floating-surplus | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-c-both` | named-taker | 2 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | floating-surplus | 2 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | named-taker | 4 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | floating-surplus | 4 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | named-taker | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | floating-surplus | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | named-taker | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-c-both` | floating-surplus | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-d-unified` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-d-unified` | floating-surplus | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-d-unified` | named-taker | 2 | GUARANTEED | GUARANTEED | yes |
| `arm-d-unified` | floating-surplus | 2 | GUARANTEED | GUARANTEED | yes |
| `arm-d-unified` | named-taker | 4 | FALLIBLE | FALLIBLE | yes |
| `arm-d-unified` | floating-surplus | 4 | FALLIBLE | FALLIBLE | yes |
| `arm-d-unified` | named-taker | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-d-unified` | floating-surplus | 8 | FALLIBLE | FALLIBLE | yes |
| `arm-d-unified` | named-taker | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-d-unified` | floating-surplus | 16 | FALLIBLE | FALLIBLE | yes |
| `arm-e-escrow` | named-taker | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | floating-surplus | 1 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | named-taker | 2 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | floating-surplus | 2 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | named-taker | 4 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | floating-surplus | 4 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | named-taker | 8 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | floating-surplus | 8 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | named-taker | 16 | GUARANTEED | GUARANTEED | yes |
| `arm-e-escrow` | floating-surplus | 16 | GUARANTEED | GUARANTEED | yes |
