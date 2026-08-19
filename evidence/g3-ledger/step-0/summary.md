# Step 0 — Manager deployed — NO Minter exists on this chain; AA_A and AA_B registered

**Label:** `EXPERIMENTAL_LANE` / `LANE-DEV-1`

Colour set at this row (0): **none — no Minter exists yet**

## Observed table (asserted equal to the spec's expected state)

_(no colour exists at this row; the Manager holds nothing and knows nothing)_

Exact map sizes: **pools=0 shieldedCells=0 unshieldedCells=0** (expected pools=0 shieldedCells=0 unshieldedCells=0).

Zero unaccounted keys: pools 0, shielded cells 0, unshielded cells 0.

Per-colour invariant: (no colours)

Conservation: (no colours)

Indexer reconstruction (independent of every wallet): OwnerN —, OwnerM —.

On-chain spot check: `shieldedAccountBalance(AA_A, <a colour that does not exist>)` = 0 (ledger state says 0).

## Operations

- **deploy the Manager FIRST, then register AA_A and AA_B** (SDK) — tx `00a6e21ecae834c8bfbacb11bd76bcb3f9b2a206924979baa010c7ad5a1127c86a`

