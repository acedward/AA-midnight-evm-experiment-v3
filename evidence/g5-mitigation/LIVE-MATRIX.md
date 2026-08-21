# G5 live matrix — the F-310 boundary, per contract variant, on a real chain

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T21:31:22.787Z

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
| `manager` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:8ccdaf7fa7e40beb7c11aa8877cfd9ea5d536dba84cbd930ce244b8614ba3f08":"-1"}` | `[]` | 127 | 22608 | 26818 | — |
| `manager` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:8ccdaf7fa7e40beb7c11aa8877cfd9ea5d536dba84cbd930ce244b8614ba3f08":"-1","shielded:de87877daf0d7bc0f8afdde1c84c7bbdb543510a67e4fccc7901d40eeb538587":"1"}` | `[]` | 106 | 5500 | 21581 | — |
| `manager` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:8ccdaf7fa7e40beb7c11aa8877cfd9ea5d536dba84cbd930ce244b8614ba3f08":"-1"}` | `[]` | 118 | 6284 | 26818 | — |
| `manager` | 2 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[39797]` | 117 | 5281 | 21630 | — |
| `manager` | 4 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[7981]` | 115 | 6035 | 26869 | — |
| `manager` | 4 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[6784]` | 111 | 5292 | 21632 | — |
| `manager` | 8 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[18703]` | 120 | 6064 | 26871 | — |
| `manager` | 8 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[46106]` | 112 | 5500 | 21632 | — |
| `manager` | 16 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[10375]` | 127 | 6091 | 26929 | — |
| `manager` | 16 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[30247]` | 115 | 5304 | 21633 | — |
| `v4-slim` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:8d8008650e5ccb31d564d04582ce70b4d463239ffa73f16ceb1f948d44e89a30":"-1"}` | `[]` | 111 | 7600 | 26819 | — |
| `v4-slim` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:237b5fb4605cc5d6511b4061fc6f49c23aeef5381a22c75e1236af112a54a00d":"1","shielded:8d8008650e5ccb31d564d04582ce70b4d463239ffa73f16ceb1f948d44e89a30":"-1"}` | `[]` | 104 | 5450 | 21591 | — |
| `v4-slim` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:8d8008650e5ccb31d564d04582ce70b4d463239ffa73f16ceb1f948d44e89a30":"-1"}` | `[]` | 119 | 6960 | 26818 | — |
| `v4-slim` | 2 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[26469]` | 110 | 6494 | 21631 | — |
| `v4-slim` | 4 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[11122]` | 127 | 6289 | 26870 | — |
| `v4-slim` | 4 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[62654]` | 116 | 5703 | 21632 | — |
| `v4-slim` | 8 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[11843]` | 123 | 6383 | 26871 | — |
| `v4-slim` | 8 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[33422]` | 114 | 5864 | 21633 | — |
| `v4-slim` | 16 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[25486]` | 123 | 7221 | 26870 | — |
| `v4-slim` | 16 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[36809]` | 116 | 5635 | 21633 | — |
| `arm-a-dedupe` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:9a035c6d42e58ec988841d949889a7db10bd7d894e9d2d6cc5e9e4809a0a0539":"-1"}` | `[]` | 109 | 7444 | 26771 | — |
| `arm-a-dedupe` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:9a035c6d42e58ec988841d949889a7db10bd7d894e9d2d6cc5e9e4809a0a0539":"-1","shielded:a60e586e73358509a59c04fea9cd7fbffddad3e86e960f3b19d028cda54d2002":"1"}` | `[]` | 97 | 5510 | 21565 | — |
| `arm-a-dedupe` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:9a035c6d42e58ec988841d949889a7db10bd7d894e9d2d6cc5e9e4809a0a0539":"-1"}` | `[]` | 116 | 6035 | 26769 | — |
| `arm-a-dedupe` | 2 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:9a035c6d42e58ec988841d949889a7db10bd7d894e9d2d6cc5e9e4809a0a0539":"-1","shielded:a60e586e73358509a59c04fea9cd7fbffddad3e86e960f3b19d028cda54d2002":"1"}` | `[]` | 100 | 5240 | 21556 | — |
| `arm-a-dedupe` | 4 | exact | 1 | named-taker | GUARANTEED | `{"shielded:9a035c6d42e58ec988841d949889a7db10bd7d894e9d2d6cc5e9e4809a0a0539":"-1"}` | `[]` | 112 | 6014 | 26770 | — |
| `arm-a-dedupe` | 4 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:9a035c6d42e58ec988841d949889a7db10bd7d894e9d2d6cc5e9e4809a0a0539":"-1","shielded:a60e586e73358509a59c04fea9cd7fbffddad3e86e960f3b19d028cda54d2002":"1"}` | `[]` | 102 | 5683 | 21557 | — |
| `arm-a-dedupe` | 8 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[30241]` | 115 | 6130 | 26821 | — |
| `arm-a-dedupe` | 8 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[49892]` | 108 | 5426 | 21608 | — |
| `arm-a-dedupe` | 16 | exact | 1 | named-taker | **FALLIBLE** | `{}` | `[37315]` | 115 | 6108 | 26821 | — |
| `arm-a-dedupe` | 16 | exact | 1 | floating-surplus | **FALLIBLE** | `{}` | `[44057]` | 109 | 5669 | 21608 | — |
| `arm-b-nested` | 1 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:728fac92256710daf406250c52343e0ddc8aaa8388b7b7239cc687b077eacc63":"-1"}` | `[]` | 121 | 7510 | 26783 | — |
| `arm-b-nested` | 1 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[26484]` | 110 | 5505 | 21607 | — |
| `arm-b-nested` | 2 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[45745]` | 123 | 6079 | 26882 | — |
| `arm-b-nested` | 2 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[22501]` | 131 | 5169 | 21606 | — |
| `arm-b-nested` | 4 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[44875]` | 125 | 6883 | 26833 | — |
| `arm-b-nested` | 4 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[11594]` | 113 | 5662 | 21607 | — |
| `arm-b-nested` | 8 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[7648]` | 127 | 6507 | 26834 | — |
| `arm-b-nested` | 8 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[15053]` | 120 | 5620 | 21608 | — |
| `arm-b-nested` | 16 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[48379]` | 130 | 5972 | 26834 | — |
| `arm-b-nested` | 16 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[42494]` | 121 | 5629 | 21608 | — |
| `arm-c-both` | 1 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:aa5fbe5ec22a779f2ea0725ba4ceb973fa7e741551819f5e71838075a096485a":"-1"}` | `[]` | 112 | 7614 | 26723 | — |
| `arm-c-both` | 1 | over registered accts (F-315) | 1 | floating-surplus | GUARANTEED | `{"shielded:5eae3960c292e3242bf496b7c49f985a077a6a10cc6a2ae0812504b699ad50dc":"1","shielded:aa5fbe5ec22a779f2ea0725ba4ceb973fa7e741551819f5e71838075a096485a":"-1"}` | `[]` | 102 | 5729 | 21497 | — |
| `arm-c-both` | 2 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[35228]` | 121 | 6157 | 26821 | — |
| `arm-c-both` | 2 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[38311]` | 113 | 5473 | 21546 | — |
| `arm-c-both` | 4 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[57250]` | 122 | 6137 | 26773 | — |
| `arm-c-both` | 4 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[11147]` | 107 | 5484 | 21546 | — |
| `arm-c-both` | 8 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[20474]` | 121 | 6007 | 26774 | — |
| `arm-c-both` | 8 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[56838]` | 108 | 5460 | 21547 | — |
| `arm-c-both` | 16 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[15210]` | 127 | 6072 | 26775 | — |
| `arm-c-both` | 16 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[5928]` | 114 | 5213 | 21549 | — |
| `arm-d-unified` | 1 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:2a43d2dd46339a238c3cc07335c17c6a8bd4a0b658b1cb914fbfa0e5b82b7b29":"-1"}` | `[]` | 108 | 8144 | 26579 | — |
| `arm-d-unified` | 1 | over registered accts (F-315) | 1 | floating-surplus | GUARANTEED | `{"shielded:2a43d2dd46339a238c3cc07335c17c6a8bd4a0b658b1cb914fbfa0e5b82b7b29":"-1","shielded:b382cb127efca39cf5a461cd2f974169272c09eff85ecce806f9a993947466a2":"1"}` | `[]` | 99 | 5747 | 21345 | — |
| `arm-d-unified` | 2 | over registered accts (F-315) | 1 | named-taker | GUARANTEED | `{"shielded:2a43d2dd46339a238c3cc07335c17c6a8bd4a0b658b1cb914fbfa0e5b82b7b29":"-1"}` | `[]` | 116 | 7208 | 26581 | — |
| `arm-d-unified` | 2 | over registered accts (F-315) | 1 | floating-surplus | GUARANTEED | `{"shielded:2a43d2dd46339a238c3cc07335c17c6a8bd4a0b658b1cb914fbfa0e5b82b7b29":"-1","shielded:b382cb127efca39cf5a461cd2f974169272c09eff85ecce806f9a993947466a2":"1"}` | `[]` | 98 | 5594 | 21338 | — |
| `arm-d-unified` | 4 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[51365]` | 120 | 6097 | 26631 | — |
| `arm-d-unified` | 4 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[39145]` | 103 | 5546 | 21388 | — |
| `arm-d-unified` | 8 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[20704]` | 115 | 6039 | 26631 | — |
| `arm-d-unified` | 8 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[57775]` | 102 | 5131 | 21388 | — |
| `arm-d-unified` | 16 | over registered accts (F-315) | 1 | named-taker | **FALLIBLE** | `{}` | `[59005]` | 139 | 13193 | 26630 | — |
| `arm-d-unified` | 16 | over registered accts (F-315) | 1 | floating-surplus | **FALLIBLE** | `{}` | `[37964]` | 152 | 8095 | 21388 | — |
| `arm-e-escrow` | 1 | exact | 1 | named-taker | GUARANTEED | `{"shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 104 | 3946 | 21302 | — |
| `arm-e-escrow` | 1 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:b24a242b40ab67afe33032117c0e112bc8b0509c75b7c797a982869a94be36e5":"1","shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 86 | 2984 | 16056 | — |
| `arm-e-escrow` | 2 | exact | 1 | named-taker | GUARANTEED | `{"shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 103 | 3434 | 21302 | — |
| `arm-e-escrow` | 2 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:b24a242b40ab67afe33032117c0e112bc8b0509c75b7c797a982869a94be36e5":"1","shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 91 | 3124 | 16055 | — |
| `arm-e-escrow` | 4 | exact | 1 | named-taker | GUARANTEED | `{"shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 105 | 3457 | 21302 | — |
| `arm-e-escrow` | 4 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:b24a242b40ab67afe33032117c0e112bc8b0509c75b7c797a982869a94be36e5":"1","shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 91 | 3000 | 16056 | — |
| `arm-e-escrow` | 8 | exact | 1 | named-taker | GUARANTEED | `{"shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 112 | 4828 | 21303 | — |
| `arm-e-escrow` | 8 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:b24a242b40ab67afe33032117c0e112bc8b0509c75b7c797a982869a94be36e5":"1","shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 90 | 3342 | 16057 | — |
| `arm-e-escrow` | 16 | exact | 1 | named-taker | GUARANTEED | `{"shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 105 | 3535 | 21302 | — |
| `arm-e-escrow` | 16 | exact | 1 | floating-surplus | GUARANTEED | `{"shielded:b24a242b40ab67afe33032117c0e112bc8b0509c75b7c797a982869a94be36e5":"1","shielded:e89656877e3f588ade7c9d11ab32b22f7c0da29983c4cf719a26d9851fc0b5ff":"-1"}` | `[]` | 94 | 3153 | 16056 | — |

## Deployed addresses (this run only — disposable stack)

| variant | address |
|---|---|
| `manager` | `5960d84257f1652ce916887af744442e5941aefe1df456b141c10aec211ebaef` |
| `v4-slim` | `0c613386df373b8f2b3ebd417add66ff59f130d669f926bc85e9d2123708dff4` |
| `arm-a-dedupe` | `1a810ee1f842571c9db3c0346d6f758f2f4dab69af7ab8c0b146fdd382c9ce8d` |
| `arm-b-nested` | `96efc8684b800f77e3ae708b64e8f7ced0a6748bc573ee0d7429a3771ad2a946` |
| `arm-c-both` | `59ce68bbbddfde1c85db40e74ea930057b1f56e5a37c8d65820f7e0532b4b579` |
| `arm-d-unified` | `63c789bd62619afb1cccbb3b9f4a926393bb3e9a368a35e51cbd9e1b94505747` |
| `arm-e-escrow` | `6a9a6af396218dc5323fcf52dd897085b40d232a14279363da190f5e6b7ab95c` |
