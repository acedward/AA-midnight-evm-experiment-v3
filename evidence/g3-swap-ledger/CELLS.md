# Custody after every row — pools, cells, map sizes, both observation points

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:57:24.466Z

One row per demonstration row, in run order. `absent` and `0` are DIFFERENT claims: a cell that does not exist is what a no-state-created proof turns on. OP2 is a proved on-chain circuit call and is consulted at the settlement rows and the closing tables; elsewhere the claim is that state did not change, which OP1 establishes by being byte-identical.

## Stage A — Manager `1f8f7b515d8da46148290b4ac780ddfa333a98e845972b21cfe30d4bad234e6d`

Colours: S_A=`586d312ace6d4a99…`, S_B=`94144f1ff0b06042…`, S_C=`eb6596b6fc8481fc…`
Minted: {"S_A":"10","S_B":"17"}

| Row | Status | Map sizes | Pools | Cells (OP1) | OP2 |
|---|---|---|---|---|---|
| `row-0` | PASS | `{"pools":0,"shieldedCells":0,"unshieldedCells":0}` | `{}` | `{}` | (not consulted) |
| `row-1` | PASS | `{"pools":0,"shieldedCells":0,"unshieldedCells":0}` | `{"S_A":"absent","S_B":"absent"}` | `{"AA_A/S_A":"absent","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-2` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"6","S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"0","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `nc-305` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"6","S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-3` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"6","S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-4` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"6","S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-5` | PASS | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `final-table-v1` | PASS | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `row-6` | PASS | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-10` | PASS | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `p-f310` | MEASURED | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7","S_C":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent","AA_B/S_C":"absent"}` | (not consulted) |
| `closing` | PASS | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7","S_C":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent","AA_B/S_C":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"0","AA_B/S_A":"0","AA_B/S_B":"0","AA_B/S_C":"0"}` |

Pooled coin identity (a withdraw must change it; an internal transfer must not):

| Row | pooled coins |
|---|---|
| `row-0` | `{}` |
| `row-1` | `{"S_A":null,"S_B":null}` |
| `row-2` | `{"S_A":"d7b25a963b80…/31","S_B":null}` |
| `nc-305` | `{"S_A":"d7b25a963b80…/31","S_B":null}` |
| `row-3` | `{"S_A":"d7b25a963b80…/31","S_B":null}` |
| `row-4` | `{"S_A":"d7b25a963b80…/31","S_B":null}` |
| `row-5` | `{"S_A":"22ce58c54285…/34","S_B":"fb0d28a77bc1…/35"}` |
| `final-table-v1` | `{"S_A":"22ce58c54285…/34","S_B":"fb0d28a77bc1…/35"}` |
| `row-6` | `{"S_A":"22ce58c54285…/34","S_B":"fb0d28a77bc1…/35"}` |
| `row-10` | `{"S_A":"22ce58c54285…/34","S_B":"fb0d28a77bc1…/35"}` |
| `p-f310` | `{"S_A":"22ce58c54285…/34","S_B":"fb0d28a77bc1…/35","S_C":null}` |
| `closing` | `{"S_A":"22ce58c54285…/34","S_B":"fb0d28a77bc1…/35","S_C":null}` |

## Stage B — Manager `95fb94dc5df1d640705fee419401b5175c58efbe5b71bbe35dfc7f0ef585ec21`

Colours: S_A=`b4044b0c0bcf5195…`, S_B=`bf3656a8eb2d34b5…`
Minted: {"S_A":"10","S_B":"10"}

| Row | Status | Map sizes | Pools | Cells (OP1) | OP2 |
|---|---|---|---|---|---|
| `setup` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"2","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"0","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `row-7` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"2","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-8` | PASS | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"absent","S_B":"3"}` | `{"AA_A/S_A":"0","AA_A/S_B":"3","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"0","AA_A/S_B":"3","AA_B/S_A":"0","AA_B/S_B":"0"}` |

Pooled coin identity (a withdraw must change it; an internal transfer must not):

| Row | pooled coins |
|---|---|
| `setup` | `{"S_A":"35703d447ba7…/40","S_B":null}` |
| `row-7` | `{"S_A":"35703d447ba7…/40","S_B":null}` |
| `row-8` | `{"S_A":null,"S_B":"879ffca44804…/41"}` |

## Stage C — Manager `f6eb885f4760142781e668f7862ab2b83d2e3c057a970ca9dc30e4fa9906eb0c`

Colours: S_A=`3ee0a9b91f70b37e…`, S_B=`4fde155ea51fe4c7…`
Minted: {"S_A":"12","S_B":"10"}

| Row | Status | Map sizes | Pools | Cells (OP1) | OP2 |
|---|---|---|---|---|---|
| `setup` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"6","S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"0","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `row-9` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"6","S_B":"absent"}` | `{"AA_A/S_A":"6","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-11` | MEASURED | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"7","S_B":"absent"}` | `{"AA_A/S_A":"7","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-12a` | MEASURED | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"5","S_B":"absent"}` | `{"AA_A/S_A":"5","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-12b` | MEASURED | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"5","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"3","AA_B/S_B":"absent"}` | (not consulted) |
| `nc-306` | PASS | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"5","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"3","AA_B/S_B":"absent"}` | (not consulted) |
| `p-f310` | MEASURED | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"5","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"3","AA_B/S_B":"absent"}` | (not consulted) |
| `closing` | PASS | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"5","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"3","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"0","AA_B/S_A":"3","AA_B/S_B":"0"}` |

Pooled coin identity (a withdraw must change it; an internal transfer must not):

| Row | pooled coins |
|---|---|
| `setup` | `{"S_A":"7a83d444cb4f…/46","S_B":null}` |
| `row-9` | `{"S_A":"7a83d444cb4f…/46","S_B":null}` |
| `row-11` | `{"S_A":"dae9843f24ea…/49","S_B":null}` |
| `row-12a` | `{"S_A":"8f5330048066…/51","S_B":null}` |
| `row-12b` | `{"S_A":"8f5330048066…/51","S_B":null}` |
| `nc-306` | `{"S_A":"8f5330048066…/51","S_B":null}` |
| `p-f310` | `{"S_A":"8f5330048066…/51","S_B":null}` |
| `closing` | `{"S_A":"8f5330048066…/51","S_B":null}` |

