# Custody after every row — pools, cells, map sizes, both observation points

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T12:15:24.503Z

One row per demonstration row, in run order. `absent` and `0` are DIFFERENT claims: a cell that does not exist is what a no-state-created proof turns on. OP2 is a proved on-chain circuit call and is consulted at the settlement rows and the closing tables; elsewhere the claim is that state did not change, which OP1 establishes by being byte-identical.

## Stage A — Manager `6db90ac1272f0e23dc3880b4ab74de0bca1b2d5ed26be33b5471ecf00cae3642`

Colours: S_A=`39879b5c202c0691…`, S_B=`55fcabf0eae22945…`, S_C=`7062dc1579e3c658…`
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
| `p-f310` | **FAIL** | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7","S_C":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent","AA_B/S_C":"absent"}` | (not consulted) |
| `closing` | PASS | `{"pools":2,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"2","S_B":"7","S_C":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent","AA_B/S_C":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"7","AA_A/S_C":"0","AA_B/S_A":"0","AA_B/S_B":"0","AA_B/S_C":"0"}` |

Pooled coin identity (a withdraw must change it; an internal transfer must not):

| Row | pooled coins |
|---|---|
| `row-0` | `{}` |
| `row-1` | `{"S_A":null,"S_B":null}` |
| `row-2` | `{"S_A":"33b009e17bb1…/31","S_B":null}` |
| `nc-305` | `{"S_A":"33b009e17bb1…/31","S_B":null}` |
| `row-3` | `{"S_A":"33b009e17bb1…/31","S_B":null}` |
| `row-4` | `{"S_A":"33b009e17bb1…/31","S_B":null}` |
| `row-5` | `{"S_A":"2ddf527d6910…/33","S_B":"f8221e9e8f84…/34"}` |
| `final-table-v1` | `{"S_A":"2ddf527d6910…/33","S_B":"f8221e9e8f84…/34"}` |
| `row-6` | `{"S_A":"2ddf527d6910…/33","S_B":"f8221e9e8f84…/34"}` |
| `row-10` | `{"S_A":"2ddf527d6910…/33","S_B":"f8221e9e8f84…/34"}` |
| `p-f310` | `{"S_A":"2ddf527d6910…/33","S_B":"f8221e9e8f84…/34","S_C":null}` |
| `closing` | `{"S_A":"2ddf527d6910…/33","S_B":"f8221e9e8f84…/34","S_C":null}` |

## Stage B — Manager `a08d44f5f5da736cef9b35ad9a1cb8e104e18394e0561a901133d7c466634205`

Colours: S_A=`bb2aee675bfaba80…`, S_B=`2e92b0c97b9fa964…`
Minted: {"S_A":"10","S_B":"10"}

| Row | Status | Map sizes | Pools | Cells (OP1) | OP2 |
|---|---|---|---|---|---|
| `setup` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"2","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"0","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `row-7` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"2","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-8` | PASS | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"absent","S_B":"3"}` | `{"AA_A/S_A":"0","AA_A/S_B":"3","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"0","AA_A/S_B":"3","AA_B/S_A":"0","AA_B/S_B":"0"}` |

Pooled coin identity (a withdraw must change it; an internal transfer must not):

| Row | pooled coins |
|---|---|
| `setup` | `{"S_A":"a87080475666…/39","S_B":null}` |
| `row-7` | `{"S_A":"a87080475666…/39","S_B":null}` |
| `row-8` | `{"S_A":null,"S_B":"5238c24d05e4…/43"}` |

## Stage C — Manager `57a546cbc3e4e66157a5d4a4e017a0145ced7c3e410f4efdaafbc588ee612e47`

Colours: S_A=`016b86faa3e6b0ed…`, S_B=`8919b48e86914774…`
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
| `setup` | `{"S_A":"633ff9e9e15d…/46","S_B":null}` |
| `row-9` | `{"S_A":"633ff9e9e15d…/46","S_B":null}` |
| `row-11` | `{"S_A":"a65123abcb2e…/48","S_B":null}` |
| `row-12a` | `{"S_A":"0c887cf9849d…/52","S_B":null}` |
| `row-12b` | `{"S_A":"0c887cf9849d…/52","S_B":null}` |
| `nc-306` | `{"S_A":"0c887cf9849d…/52","S_B":null}` |
| `p-f310` | `{"S_A":"0c887cf9849d…/52","S_B":null}` |
| `closing` | `{"S_A":"0c887cf9849d…/52","S_B":null}` |

