# Compile probes P1 / P2 — verdicts

`EXPERIMENTAL_LANE` / `LANE-DEV-1` — 00004-multi-token-custody, Plan 01 Phase 3.

Compiler: `0.33.0`
 / language `0.25.0`
 (image `aa00004-compactc:0.33.0`, archive pinned by SHA-256 in `docker/compactc.Dockerfile`)

Recorded (UTC): 2026-08-18T20:17:34Z

| Probe | Shape | Mode | Exit | Verdict |
|---|---|---|---|---|
| `p1a` | `Map<Bytes<32>, Uint<128>>` + `persistentHash` composite keys | `--skip-zk` | 0 | **PASS** |
| `p1b` | `Map<Bytes<32>, QualifiedShieldedCoinInfo>` insertCoin/lookup/sendShielded/change | `--skip-zk` | 0 | **PASS** |
| `p1c` | nested `Map<Bytes<32>, Map<Bytes<32>, Uint<128>>>` (informational) | `--skip-zk` | 0 | **PASS** |
| `p1b-zk` | P1(b) again with FULL ZK key generation | `--zk` | 0 | **PASS** |
| `p2` | `constructor(Bytes<32>)` writing derived separators to ledger cells | `--zk` | 0 | **PASS** |

All mandatory probes compiled.
