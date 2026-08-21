# G5 live matrix — the F-310 boundary, per contract variant, on a real chain

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-21T02:31:16.935Z

Every offer is BUILT AND PROVEN and then discarded. Nothing here is balanced, signed or
submitted, so no result in this table depends on a settlement, and the wanted colour never
acquires a pool — which is what keeps `claimWantedColour`'s merge branch out of the dose.

**Baseline reproduces F-310: YES**

## Boundaries

| variant | arm | offer circuit | last GUARANTEED (named) | first FALLIBLE (named) | last GUARANTEED (surplus) | first FALLIBLE (surplus) | monotone | all built |
|---|---|---|---|---|---|---|---|---|
| `manager` | baseline | `openSwapShielded` | 2 | 4 | 1 | 2 | yes | yes |
| `v4-slim` | control | `openSwapShielded` | 2 | 4 | 1 | 2 | yes | yes |
| `arm-a-dedupe` | a | `openSwapShielded` | 4 | 8 | 4 | 8 | yes | yes |
| `arm-b-nested` | b | `openSwapShielded` | 1 | 2 | **none** | 1 | yes | yes |
| `arm-c-both` | c | `openSwapShielded` | 1 | 2 | 1 | 2 | yes | yes |
| `arm-d-unified` | d | `openSwapShielded` | 2 | 4 | 2 | 4 | yes | yes |
| `arm-e-escrow` | e | `openSwap` | 16 | none in range | 16 | none in range | yes | yes |

## Every point

| variant | cells | exact? | pools | shape | placement | imbalances(0) | fallible segments | build ms | prove ms | bytes | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `manager` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:b99065318356c43ee9d8aca006f7c779e16f0b0454af2dd91e057cba101397f3":"-1"}` | `[]` | 125 | 10643 | 26819 | — |
| `manager` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:b99065318356c43ee9d8aca006f7c779e16f0b0454af2dd91e057cba101397f3":"-1","shielded:cd6644b48f4b19c67d2f7cf09739bf8f358474bd752c6b1044ca4de1b5995bf9":"1"}` | `[]` | 110 | 5723 | 21581 | — |
| `manager` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:b99065318356c43ee9d8aca006f7c779e16f0b0454af2dd91e057cba101397f3":"-1"}` | `[]` | 120 | 6968 | 26818 | — |
| `manager` | 2 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[29327]` | 117 | 6238 | 21630 | — |
| `manager` | 4 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[34342]` | 122 | 6904 | 26870 | — |
| `manager` | 4 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[7972]` | 116 | 6157 | 21632 | — |
| `manager` | 8 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[19707]` | 116 | 6195 | 26871 | — |
| `manager` | 8 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[10612]` | 112 | 5639 | 21633 | — |
| `manager` | 16 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[3107]` | 129 | 6111 | 26928 | — |
| `manager` | 16 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[47192]` | 115 | 9267 | 21633 | — |
| `v4-slim` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:160abe09a7394713ade3aeafbe8db0cdeb3c8c496e7b35a8a5627fa51324e18a":"-1"}` | `[]` | 133 | 8630 | 26820 | — |
| `v4-slim` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:160abe09a7394713ade3aeafbe8db0cdeb3c8c496e7b35a8a5627fa51324e18a":"-1","shielded:8a3481a1890e0bce7766595890ece7687cdcb68f8ae454b4ef297e482cf362b8":"1"}` | `[]` | 106 | 6177 | 21582 | — |
| `v4-slim` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:160abe09a7394713ade3aeafbe8db0cdeb3c8c496e7b35a8a5627fa51324e18a":"-1"}` | `[]` | 115 | 6549 | 26819 | — |
| `v4-slim` | 2 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[49253]` | 111 | 6104 | 21630 | — |
| `v4-slim` | 4 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[27348]` | 145 | 7453 | 26870 | — |
| `v4-slim` | 4 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[41876]` | 111 | 7806 | 21641 | — |
| `v4-slim` | 8 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[43908]` | 116 | 6126 | 26871 | — |
| `v4-slim` | 8 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[26671]` | 110 | 5568 | 21633 | — |
| `v4-slim` | 16 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[19480]` | 125 | 6076 | 26871 | — |
| `v4-slim` | 16 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[60283]` | 112 | 5247 | 21633 | — |
| `arm-a-dedupe` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:f9dd35b734f78c640a81c16e89580565175cc1c4533083578e8c7be1c7fc33a9":"-1"}` | `[]` | 109 | 7611 | 26770 | — |
| `arm-a-dedupe` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:2b207682c3d47611c9be0f784352f61ca0626039b9961dfae833890ed7bf4642":"1","shielded:f9dd35b734f78c640a81c16e89580565175cc1c4533083578e8c7be1c7fc33a9":"-1"}` | `[]` | 100 | 5557 | 21565 | — |
| `arm-a-dedupe` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:f9dd35b734f78c640a81c16e89580565175cc1c4533083578e8c7be1c7fc33a9":"-1"}` | `[]` | 110 | 6061 | 26768 | — |
| `arm-a-dedupe` | 2 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:2b207682c3d47611c9be0f784352f61ca0626039b9961dfae833890ed7bf4642":"1","shielded:f9dd35b734f78c640a81c16e89580565175cc1c4533083578e8c7be1c7fc33a9":"-1"}` | `[]` | 99 | 5470 | 21556 | — |
| `arm-a-dedupe` | 4 | exact | 1 | named-taker | GUARANTEED | `{"shielded:f9dd35b734f78c640a81c16e89580565175cc1c4533083578e8c7be1c7fc33a9":"-1"}` | `[]` | 116 | 5754 | 26769 | — |
| `arm-a-dedupe` | 4 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:2b207682c3d47611c9be0f784352f61ca0626039b9961dfae833890ed7bf4642":"1","shielded:f9dd35b734f78c640a81c16e89580565175cc1c4533083578e8c7be1c7fc33a9":"-1"}` | `[]` | 101 | 5147 | 21557 | — |
| `arm-a-dedupe` | 8 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[26986]` | 120 | 5945 | 26821 | — |
| `arm-a-dedupe` | 8 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[20526]` | 106 | 5539 | 21608 | — |
| `arm-a-dedupe` | 16 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[24316]` | 120 | 6067 | 26821 | — |
| `arm-a-dedupe` | 16 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[57717]` | 111 | 5081 | 21608 | — |
| `arm-b-nested` | 1 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:f0e6c573345e10b1a129b1af62f295dd5d59caad86079c4f1f62e2152c33c0df":"-1"}` | `[]` | 121 | 9070 | 26783 | — |
| `arm-b-nested` | 1 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[18402]` | 134 | 7503 | 21608 | — |
| `arm-b-nested` | 2 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[39165]` | 124 | 13895 | 26832 | — |
| `arm-b-nested` | 2 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[47475]` | 172 | 19693 | 21606 | — |
| `arm-b-nested` | 4 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[37995]` | 142 | 12797 | 26833 | — |
| `arm-b-nested` | 4 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[28933]` | 134 | 11087 | 21607 | — |
| `arm-b-nested` | 8 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[33098]` | 138 | 9542 | 26834 | — |
| `arm-b-nested` | 8 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[29404]` | 132 | 9323 | 21608 | — |
| `arm-b-nested` | 16 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[53997]` | 155 | 18826 | 26833 | — |
| `arm-b-nested` | 16 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[64000]` | 152 | 12169 | 21608 | — |
| `arm-c-both` | 1 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:1f65cec422562b46e87756a3b75042f623a721931bb012a290566c1d392db41c":"-1"}` | `[]` | 105 | 8429 | 26722 | — |
| `arm-c-both` | 1 | over registered accts (F-315) | 1 | floating-surplus | GUARANTEED | `{"shielded:1f65cec422562b46e87756a3b75042f623a721931bb012a290566c1d392db41c":"-1","shielded:2aac6aa11624e6761f7c3fa8b8af8b40613f7a53dd343b9e5ea07a2e7fc64b32":"1"}` | `[]` | 101 | 5486 | 21497 | — |
| `arm-c-both` | 2 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[37148]` | 115 | 6223 | 26771 | — |
| `arm-c-both` | 2 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[26160]` | 110 | 5072 | 21546 | — |
| `arm-c-both` | 4 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[55451]` | 118 | 5965 | 26773 | — |
| `arm-c-both` | 4 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[29091]` | 105 | 5619 | 21553 | — |
| `arm-c-both` | 8 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[6385]` | 112 | 5944 | 26774 | — |
| `arm-c-both` | 8 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[25736]` | 108 | 5504 | 21548 | — |
| `arm-c-both` | 16 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[58595]` | 142 | 13241 | 26775 | — |
| `arm-c-both` | 16 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[35370]` | 151 | 11691 | 21549 | — |
| `arm-d-unified` | 1 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:da92acb13536dd25bb6e6681d661ca3754077462806fa2e4ed8614d357ee004f":"-1"}` | `[]` | 125 | 11754 | 26581 | — |
| `arm-d-unified` | 1 | over registered accts (F-315) | 1 | floating-surplus | GUARANTEED | `{"shielded:c4827fc49c1d155672913dfef772ab728b58f2cefdd4067adb91f451440a2103":"1","shielded:da92acb13536dd25bb6e6681d661ca3754077462806fa2e4ed8614d357ee004f":"-1"}` | `[]` | 99 | 7635 | 21338 | — |
| `arm-d-unified` | 2 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:da92acb13536dd25bb6e6681d661ca3754077462806fa2e4ed8614d357ee004f":"-1"}` | `[]` | 127 | 8816 | 26581 | — |
| `arm-d-unified` | 2 | over registered accts (F-315) | 1 | floating-surplus | GUARANTEED | `{"shielded:c4827fc49c1d155672913dfef772ab728b58f2cefdd4067adb91f451440a2103":"1","shielded:da92acb13536dd25bb6e6681d661ca3754077462806fa2e4ed8614d357ee004f":"-1"}` | `[]` | 97 | 8352 | 21338 | — |
| `arm-d-unified` | 4 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[27907]` | 115 | 6186 | 26631 | — |
| `arm-d-unified` | 4 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[55437]` | 104 | 5694 | 21388 | — |
| `arm-d-unified` | 8 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[62877]` | 116 | 6101 | 26631 | — |
| `arm-d-unified` | 8 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[24006]` | 105 | 5515 | 21388 | — |
| `arm-d-unified` | 16 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[31400]` | 121 | 6324 | 26630 | — |
| `arm-d-unified` | 16 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[25241]` | 109 | 5159 | 21388 | — |
| `arm-e-escrow` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1"}` | `[]` | 135 | 12715 | 21302 | — |
| `arm-e-escrow` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1","shielded:9254b0c4327b436edeb99ca60474cd14a41d966808865fa28ea6c34734a8a72a":"1"}` | `[]` | 127 | 8878 | 16056 | — |
| `arm-e-escrow` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1"}` | `[]` | 115 | 4514 | 21302 | — |
| `arm-e-escrow` | 2 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1","shielded:9254b0c4327b436edeb99ca60474cd14a41d966808865fa28ea6c34734a8a72a":"1"}` | `[]` | 93 | 3780 | 16056 | — |
| `arm-e-escrow` | 4 | exact | 1 | named-taker | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1"}` | `[]` | 117 | 4572 | 21302 | — |
| `arm-e-escrow` | 4 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1","shielded:9254b0c4327b436edeb99ca60474cd14a41d966808865fa28ea6c34734a8a72a":"1"}` | `[]` | 94 | 3916 | 16056 | — |
| `arm-e-escrow` | 8 | exact | 1 | named-taker | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1"}` | `[]` | 115 | 9206 | 21303 | — |
| `arm-e-escrow` | 8 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1","shielded:9254b0c4327b436edeb99ca60474cd14a41d966808865fa28ea6c34734a8a72a":"1"}` | `[]` | 121 | 6753 | 16054 | — |
| `arm-e-escrow` | 16 | exact | 1 | named-taker | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1"}` | `[]` | 114 | 8385 | 21302 | — |
| `arm-e-escrow` | 16 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:026a5f395e4ac2f10fe6e9a01e8443f193b047023f6481075a787435fb8c4316":"-1","shielded:9254b0c4327b436edeb99ca60474cd14a41d966808865fa28ea6c34734a8a72a":"1"}` | `[]` | 101 | 4415 | 16056 | — |

## Deployed addresses (this run only — disposable stack)

| variant | address |
|---|---|
| `manager` | `a46dc27cb6393a18131651cd8ff038aa02cae387226e3ea3f488c441ca3100f1` |
| `v4-slim` | `c0869cb13f4ae9fa25949b68794869a8642f17ca3fe7cc5839cab820ef638bec` |
| `arm-a-dedupe` | `53ea3fd1bf4588ba593cd41ddb631aef309a592f693371c9f769a6cd9e733ffb` |
| `arm-b-nested` | `fb9f393122c1ef911fc815f9770b606f1454777e267e908ee433893871ba11f7` |
| `arm-c-both` | `7a1c8ace8a11915a558ff5c74d77d90a4f902d5461d59aa90dda866957a10122` |
| `arm-d-unified` | `955108abb45b46bc22b2f3ba0c5408302c423ed7dafa5ba0fb97edc13b7ba4f4` |
| `arm-e-escrow` | `8f6805bd440145e5cf9bf69a317a78094e5b931e40e5279f888f99bcc03a5edb` |
