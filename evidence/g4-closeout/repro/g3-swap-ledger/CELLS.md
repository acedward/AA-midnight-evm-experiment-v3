# Custody after every row — pools, cells, map sizes, both observation points

`EXPERIMENTAL_LANE / LANE-DEV-1` · recorded 2026-08-20T16:15:18.346Z

One row per demonstration row, in run order. `absent` and `0` are DIFFERENT claims: a cell that does not exist is what a no-state-created proof turns on. OP2 is a proved on-chain circuit call and is consulted at the settlement rows and the closing tables; elsewhere the claim is that state did not change, which OP1 establishes by being byte-identical.

## Stage A — Manager `ab8b2ce76d350a1051ba1588033b02aa432886e12ade1cc9ef179ec32122b24a`

Colours: S_A=`20491ce4555ac004…`, S_B=`8be4fc7513e84834…`, S_C=`7f2c1a65e1d50ef0…`
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
| `row-2` | `{"S_A":"270ee3ea99e9…/30","S_B":null}` |
| `nc-305` | `{"S_A":"270ee3ea99e9…/30","S_B":null}` |
| `row-3` | `{"S_A":"270ee3ea99e9…/30","S_B":null}` |
| `row-4` | `{"S_A":"270ee3ea99e9…/30","S_B":null}` |
| `row-5` | `{"S_A":"a51cddadd117…/32","S_B":"c5fa646e611c…/35"}` |
| `final-table-v1` | `{"S_A":"a51cddadd117…/32","S_B":"c5fa646e611c…/35"}` |
| `row-6` | `{"S_A":"a51cddadd117…/32","S_B":"c5fa646e611c…/35"}` |
| `row-10` | `{"S_A":"a51cddadd117…/32","S_B":"c5fa646e611c…/35"}` |
| `p-f310` | `{"S_A":"a51cddadd117…/32","S_B":"c5fa646e611c…/35","S_C":null}` |
| `closing` | `{"S_A":"a51cddadd117…/32","S_B":"c5fa646e611c…/35","S_C":null}` |

## Stage B — Manager `eddac280e7eaece621d998bc907eff1ab3263b114f20f73e2fdbd061d80e1195`

Colours: S_A=`d9f85a58a1142a28…`, S_B=`afb60d8c42ff95b2…`
Minted: {"S_A":"10","S_B":"10"}

| Row | Status | Map sizes | Pools | Cells (OP1) | OP2 |
|---|---|---|---|---|---|
| `setup` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"2","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"0","AA_B/S_A":"0","AA_B/S_B":"0"}` |
| `row-7` | PASS | `{"pools":1,"shieldedCells":1,"unshieldedCells":0}` | `{"S_A":"2","S_B":"absent"}` | `{"AA_A/S_A":"2","AA_A/S_B":"absent","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | (not consulted) |
| `row-8` | PASS | `{"pools":1,"shieldedCells":2,"unshieldedCells":0}` | `{"S_A":"absent","S_B":"3"}` | `{"AA_A/S_A":"0","AA_A/S_B":"3","AA_B/S_A":"absent","AA_B/S_B":"absent"}` | `{"AA_A/S_A":"0","AA_A/S_B":"3","AA_B/S_A":"0","AA_B/S_B":"0"}` |

Pooled coin identity (a withdraw must change it; an internal transfer must not):

| Row | pooled coins |
|---|---|
| `setup` | `{"S_A":"ed903a77a0fc…/39","S_B":null}` |
| `row-7` | `{"S_A":"ed903a77a0fc…/39","S_B":null}` |
| `row-8` | `{"S_A":null,"S_B":"f560ec5d0cc4…/43"}` |

## Stage C — Manager `bb527a748ec2a1ab65401d8cca9b94a8df8b28371bbad3960710be7f20c53d65`

Colours: S_A=`9ae23435fce1f79a…`, S_B=`99e9425a10a245c7…`
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
| `setup` | `{"S_A":"9d6a4e8e7f73…/47","S_B":null}` |
| `row-9` | `{"S_A":"9d6a4e8e7f73…/47","S_B":null}` |
| `row-11` | `{"S_A":"8098646c3d0b…/49","S_B":null}` |
| `row-12a` | `{"S_A":"f8f35c5ebd1b…/51","S_B":null}` |
| `row-12b` | `{"S_A":"f8f35c5ebd1b…/51","S_B":null}` |
| `nc-306` | `{"S_A":"f8f35c5ebd1b…/51","S_B":null}` |
| `p-f310` | `{"S_A":"f8f35c5ebd1b…/51","S_B":null}` |
| `closing` | `{"S_A":"f8f35c5ebd1b…/51","S_B":null}` |

