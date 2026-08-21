# Step 13 — M1 mixed-colour probe: OwnerM deposits S2 2 AND U2 2 to AA_B in ONE transaction

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

## Observed table (asserted equal to the spec's expected state)

|  | S1 | S2 | U1 | U2 |
|---|---|---|---|---|
| OwnerN | 4 | 0 | 5 | 2 |
| OwnerM | 3 | 2 | 0 | 3 |
| AA_A | 3 | 0 | 5 | 0 |
| AA_B | 0 | 8 | 0 | 5 |
| pool / ledger | poolS1=3 | poolS2=8 | ledgerU1=5 | ledgerU2=5 |

Per-colour invariant: S1: 3 == 3+0; S2: 8 == 0+8; U1: 5 == 5+0; U2: 5 == 0+5

Conservation: S1: minted 10 == 3+4+3; S2: minted 10 == 8+0+2; U1: minted 10 == 5+5+0; U2: minted 10 == 5+2+3

Indexer reconstruction (independent of every wallet): OwnerN U1=5 U2=2, OwnerM U1=0 U2=3.

On-chain spot check: `accountBalance(AA_B, S2)` = 8 (ledger state says 8).

## Operations

- **OwnerM deposits S2 2 AND U2 2 -> AA_B in ONE transaction** (LEDGER) — tx `00b61d330b2a782e234dac5fdabaf8134b7be065a64cdfeb5855d513f055c7f7e6`

