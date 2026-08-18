# Addendum A1 — multi-input coin selection

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1` / `ADDENDUM-A1`

This addendum is **outside the 26-cell combination matrix**. It claims no spec cell, and the
approved specification is unchanged. Gates G1–G4 and their evidence are untouched.

**The question.** Can the pinned wallet SDK select **two or more inputs** of a contract-minted
colour in ONE transaction? The ordered ledger never forced it: every amount it sent was
coverable by a single held piece.

**The probe.** OwnerN is minted 2 and 3 of the Minter's colour as TWO separate
transactions, so it holds two discrete pieces and **no single piece covers 4**. OwnerN then
sends 4 to OwnerM in one transaction. Both families, identical choreography.

| family | verdict | result |
|---|---|---|
| shielded | **PROVEN** | PROVEN (shielded): OwnerN held {2, 3} — no single piece covers 4 — and ONE transaction (0054c8910ff9e96064f0f0140bc36180b9bcfc4abf9e377e861486279521b5b81b) consumed BOTH inputs, paid 4 to OwnerM and returned 1 as change under a NEW identifier |
| unshielded | **PROVEN** | PROVEN (unshielded): OwnerN held {2, 3} — no single piece covers 4 — and ONE transaction (009476730b2806a4f7d1fdb5d7df2c8115936be259848f3cade7afc494a960c903) consumed BOTH inputs, paid 4 to OwnerM and returned 1 as change under a NEW identifier |

## Deployment of record

- Minter: `f3ada46ed9aeb1d3321b874324cae5ccd4a0c547c680c9a4008c8dc8d3d9bdd2`
- Manager: `b8e75f5a6e9138b16f20e0c77d3ce64fdef04a245af3d2982831e04315316752` (deployed by the shared bootstrap; **its accounts stay unused** —
  the addendum is entirely wallet-side)
- shielded colour: `ece9f715163ab2badab6424b78dccd414b92e137ddc3c01e4e22ed2fc133871e`
- unshielded colour: `3802ab79e74ce527e17d32fd254715ad19b9301a4357c843386cb86b85bca5ae`

## shielded

**Verdict: PROVEN.** PROVEN (shielded): OwnerN held {2, 3} — no single piece covers 4 — and ONE transaction (0054c8910ff9e96064f0f0140bc36180b9bcfc4abf9e377e861486279521b5b81b) consumed BOTH inputs, paid 4 to OwnerM and returned 1 as change under a NEW identifier

| what | value |
|---|---|
| mint 2 → OwnerN | `0059379d1ba7f26cdf02416ad6429ce939c9f511564dce343ca760b76ae296b890` |
| mint 3 → OwnerN | `00320a55e23bc0b51a3d4965b51319cb4866d623e1ed75566c369f96d5d72764b4` |
| held set before the send | {2, 3} (total 5) |
| distinct identifiers | true |
| no single piece covers 4 | true |
| send 4 OwnerN → OwnerM | `0054c8910ff9e96064f0f0140bc36180b9bcfc4abf9e377e861486279521b5b81b` |
| OwnerN after | {1} (total 1) |
| OwnerM after | {4} (total 4) |
| both inputs consumed | true |
| change carries a NEW identifier | true |

**Observation point 1** — the wallet SDK synced state of OwnerN and OwnerM (balances AND per-piece identifiers).

**Observation point 2** — the ledger conservation identity — the Minter's total minted supply equals the Manager's pooled holdings plus every user's holdings, read from contract/ledger state.

```json
{
  "mintedShielded": "5",
  "managerPool": "0",
  "ownerN": "1",
  "ownerM": "4",
  "identityHolds": true
}
```

Machine-readable record: [`shielded.json`](shielded.json)

## unshielded

**Verdict: PROVEN.** PROVEN (unshielded): OwnerN held {2, 3} — no single piece covers 4 — and ONE transaction (009476730b2806a4f7d1fdb5d7df2c8115936be259848f3cade7afc494a960c903) consumed BOTH inputs, paid 4 to OwnerM and returned 1 as change under a NEW identifier

| what | value |
|---|---|
| mint 2 → OwnerN | `00a34f1019283168bf86bf47e8ce4f608cf10679ac307a4612016bd022a6fb9627` |
| mint 3 → OwnerN | `00bcd5a65ed9215b20ec925d31321e3d6868408922467bad9cad48c71bf3fdc103` |
| held set before the send | {2, 3} (total 5) |
| distinct identifiers | true |
| no single piece covers 4 | true |
| send 4 OwnerN → OwnerM | `009476730b2806a4f7d1fdb5d7df2c8115936be259848f3cade7afc494a960c903` |
| OwnerN after | {1} (total 1) |
| OwnerM after | {4} (total 4) |
| both inputs consumed | true |
| change carries a NEW identifier | true |

**Observation point 1** — the wallet SDK synced state of OwnerN and OwnerM (balances AND per-piece identifiers).

**Observation point 2** — the indexer's own UTXO reconstruction, plus the indexer's per-output spent/created records for the send transaction.

```json
{
  "consumedOutputs": [
    {
      "value": "2",
      "intentHash": "97651bd59eec96936c85d794ef6120ff3eb1e4627ef3435740bc57e205f4b785",
      "outputIndex": 0,
      "spentAtTransaction": "9ead2eb5e35ec856b600d755950b615388cefd553766d0b2143b491d771a065b"
    },
    {
      "value": "3",
      "intentHash": "0ac49a3f7cb4e3492760a56528b4310863c4c8f5d0b0e8c72036dc5131e69c76",
      "outputIndex": 0,
      "spentAtTransaction": "9ead2eb5e35ec856b600d755950b615388cefd553766d0b2143b491d771a065b"
    }
  ],
  "distinctSpendingTransactions": [
    "9ead2eb5e35ec856b600d755950b615388cefd553766d0b2143b491d771a065b"
  ],
  "sendTransactionHash": "9ead2eb5e35ec856b600d755950b615388cefd553766d0b2143b491d771a065b",
  "createdOutputsOfSendTx": [
    {
      "value": "1",
      "owner": "cf18e9ae9634e06bc661f615e18a9e1b2db35ef7d9a3b46b00b147a5008a30d1",
      "intentHash": "a688f342fde0b2c0b50fe315434b0a3b6d444353e2901ef1758aeb0ab7872f76",
      "outputIndex": 0
    },
    {
      "value": "4",
      "owner": "67adc793a337c10018eab9615af51727555b0bc77e5fccdf062fbeb01a57fd36",
      "intentHash": "a688f342fde0b2c0b50fe315434b0a3b6d444353e2901ef1758aeb0ab7872f76",
      "outputIndex": 1
    }
  ],
  "indexerReconstruction": {
    "OwnerN": "1",
    "OwnerM": "4"
  }
}
```

Machine-readable record: [`unshielded.json`](unshielded.json)
