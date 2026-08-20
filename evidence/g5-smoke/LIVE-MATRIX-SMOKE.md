# G5 live matrix — the F-310 boundary, per contract variant, on a real chain

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T18:13:04.292Z

Every offer is BUILT AND PROVEN and then discarded. Nothing here is balanced, signed or
submitted, so no result in this table depends on a settlement, and the wanted colour never
acquires a pool — which is what keeps `claimWantedColour`'s merge branch out of the dose.

**Baseline reproduces F-310: YES**

## Boundaries

| variant | arm | offer circuit | last GUARANTEED (named) | first FALLIBLE (named) | last GUARANTEED (surplus) | first FALLIBLE (surplus) | monotone | all built |
|---|---|---|---|---|---|---|---|---|
| `manager` | baseline | `openSwapShielded` | 1 | 2 | 1 | 2 | yes | yes |
| `arm-e-escrow` | e | `openSwap` | 1 | none in range | 1 | none in range | yes | yes |

## Every point

| variant | cells | exact? | pools | shape | placement | imbalances(0) | fallible segments | build ms | prove ms | bytes | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `manager` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:53907d490fac11b304ba9e9ddc6b6400681b8c241e9406e16933bd215c3be0b0":"-1"}` | `[]` | 123 | 10351 | 26877 | — |
| `manager` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:0769840110763a30d777fb7970b313398917e882afe6b2b5ace4b0443efb8476":"1","shielded:53907d490fac11b304ba9e9ddc6b6400681b8c241e9406e16933bd215c3be0b0":"-1"}` | `[]` | 113 | 5543 | 21581 | — |
| `manager` | 2 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[50666]` | 128 | 6665 | 26867 | — |
| `manager` | 2 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[2119]` | 113 | 6262 | 21631 | — |
| `arm-e-escrow` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:3db6ec3d7a60ad8e62149dd063aee40c39855cd01dffd8a02950c59644c7d518":"-1"}` | `[]` | 99 | 4040 | 21300 | — |
| `arm-e-escrow` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:3db6ec3d7a60ad8e62149dd063aee40c39855cd01dffd8a02950c59644c7d518":"-1","shielded:84190d10655262a15f04280b9e2d912b1f51a1c042e3652d97d561852fd22fac":"1"}` | `[]` | 86 | 3041 | 16053 | — |

## Variants that could not be measured LIVE

| variant | verbatim |
|---|---|
| `arm-e-escrow` | `failed assert: an offer is already staged | cause: Error executing circuit 'stageOffer'` |

An arm that fails to compile or deploy is a RECORDED ARM VERDICT, not a gate failure (G5).

## Deployed addresses (this run only — disposable stack)

| variant | address |
|---|---|
| `manager` | `253773d9e2c0634ab1a39cc74188bd38c47371bd6c6454a94ea4b28efcb54376` |
| `arm-e-escrow` | `5c1adaea7e6f37a3eff79525aa54dd215b356cc924c0fae781f5127a08413ff1` |
