# `midnight-2-offers` handoff for `aa-contracts.json`

This is the producer/consumer contract for a separate, numbered `midnight-2-offers` change. The
implementation does **not** live in this AA repository and FR-005 must not be considered merged
until that downstream PR updates the producer and every consumer together.

The current external implementation is in the clean infra checkout pinned during validation at
`ddbd28a856ed9093474f905db80e122caaa8a06a`:

- producer: `images/aa-contracts/runner/deploy-aa.ts`, which writes
  `/aa/out/aa-contracts.json`;
- runtime consumers: `images/aa-contracts/runner/aa-console.ts` and
  `images/aa-contracts/runner/aa-e2e.ts`;
- validation/launch consumers: `scripts/verify-aa.sh` and `scripts/aa-e2e.sh`;
- operator documentation: `docs/COMPONENTS.md`.

Today those paths read an unversioned legacy object. The AA manual runner accepts only that bounded
legacy shape, checks it against the selected legacy deployment profile, and decorates it as
`aa-contracts/v1` for evidence. That decoration is a compatibility bridge, not the authoritative
infra producer migration.

## Required versioned producer shape

The downstream producer must emit this exact top-level contract at `/aa/out/aa-contracts.json`:

```ts
type AaContractsV1 = {
  schemaVersion: "aa-contracts/v1";
  network: string;
  aaCommit: string; // canonical Git hex id; stock live validation pins the full 40-character SHA
  manager: {
    address: string; // lower-case, unprefixed 32-byte hex
    domain: string;
  };
  minter?: {
    address: string; // lower-case, unprefixed 32-byte hex
    tag: string;     // raw internal constructor/deployment tag, never a display name
  };
  offerFiles?: {
    address: string; // lower-case, unprefixed 32-byte hex
  };
  tokens: TokenMetadata[];
  createdAt: string; // canonical ISO-8601 timestamp
};
```

`TokenMetadata` is a strict discriminated union. Unknown or source-specific foreign fields are
errors; consumers must select by `source`, `family` and `name`, never by array position.

```ts
type AaMinterToken = {
  source: "aa-minter";
  family: "shielded" | "unshielded";
  name: "AATEST-S" | "AATEST-U"; // family pairing is exact
  color: string;                  // lower-case, unprefixed 32-byte hex
  internalDeploymentTag: string; // exactly minter.tag
  decimals?: number;              // omitted by this producer unless independently defined
};

type OfferFilesToken = {
  source: "offer-files-faucet";
  family: "shielded";
  name: "WBTC" | "WETH";
  color: string;                  // lower-case, unprefixed 32-byte hex
  decimals: 6;
  // internalDeploymentTag is forbidden
};
```

Every deployment receipt contains the two AA-Minter rows, `AATEST-S` then `AATEST-U`, even when a
run is funded by Offer Files. When Offer Files metadata is present, the receipt additionally
contains exactly one WBTC and one WETH shielded row, each with `decimals: 6`, plus the matching
`offerFiles.address`. A consumer must not turn `minter.tag` (for example `TOKA`) into a token name.

The producer must derive or independently verify identifiers rather than accept labels attached to
arbitrary colours:

- AA Minter: `persistentHash([minter.tag, familyTag])`, then
  `tokenType(separator, minter.address)`, with the existing distinct shielded/unshielded family
  constants;
- Offer Files: `rawTokenType(domainSepFromName(name), offerFiles.address)`, with the pinned
  `zswap-da-faucet:<name>` separator algorithm. The registry supplies provenance to check; it does
  not override this derivation.

The versioned receipt must not contain `seed`, `mnemonic`, `private-key`, `secret`, `password` or
equivalent authorization data. Addresses and colours are public identifiers; mint transaction IDs
may be retained only as separate run/deployment evidence if the final downstream schema explicitly
adds and validates them. They are not part of `AaContractsV1` above.

## Consumer migration

The downstream change must update all readers atomically:

| consumer | versioned fields it must use |
|---|---|
| `images/aa-contracts/runner/aa-console.ts` | `manager.address`, `manager.domain`, `minter.address` where the legacy Minter handle is still needed, and WBTC/WETH rows selected by `source: "offer-files-faucet"`, `family: "shielded"`, exact name, colour and decimals; never re-label retired Minter colours as market tokens |
| `images/aa-contracts/runner/aa-e2e.ts` | `manager.address`, `manager.domain`, `minter.address`, the `AATEST-S` shielded row and `AATEST-U` unshielded row selected by their discriminants instead of `mints.shielded/unshielded.color` |
| `scripts/verify-aa.sh` | require `schemaVersion`, exact manager/minter entries, exactly one AATEST row per family, unique colours/identities and canonical public values; when Offer Files is included, require exactly one derived WBTC and WETH row |
| `scripts/aa-e2e.sh` | keep the existence/readiness check, but require the versioned receipt before launching the E2E image rather than accepting any JSON file at the path |
| `docs/COMPONENTS.md` | describe the versioned producer, the name/source distinction and which consumers own compatibility |

During rollout, either update the single file and all consumers in one PR or temporarily write an
explicitly named legacy file alongside the versioned `aa-contracts.json`. Do not silently accept
both shapes at the same path: schema confusion would allow an old deployment, compiler/runtime
profile or colour mapping to pass until after ledger effects.

## Separate run evidence

The AA harness's `aa-faucet-run/v1` receipt is intentionally mode-specific and is not a replacement
for the deployment receipt:

```ts
type AaFaucetRunV1 = {
  schemaVersion: "aa-faucet-run/v1";
  network: string;
  mode: "aa-minter" | "offer-files-faucet";
  managerAddress: string;
  tokens: TokenMetadata[]; // every row's source equals mode
  balanceDeltas: Array<{ accountId: string; color: string; before: string; after: string }>;
  transactions: Array<{
    operation: "mint" | "deposit" | "execute" | "withdraw";
    txId: string;
  }>;
  startedAt: string;
  finishedAt: string;
};
```

Transaction IDs are trimmed, nonblank and globally unique. Amount strings are canonical unsigned
integers. The downstream deployment receipt describes everything deployed; a run receipt describes
only the source and tokens exercised by one harness invocation.

## Compatibility status

The validated stock stack still emits the legacy shape and pins AA
`713a20215f33e02904ea5bd699b7de7f76562e1b`, Compact runtime `0.18.0-rc.1`, compiler `0.33`, and
Offer Files kernel `4af102536f02f137b696a4734bd8c936eddf3672`. Its successful live run proves that deployed
legacy behavior only. It does not prove this checkout's current 0.19 Manager bytecode, and the
typed-recipient one-transaction test T-M1 remains not run until a downstream stack actually
re-pins and deploys the new Offer Files ABI.
