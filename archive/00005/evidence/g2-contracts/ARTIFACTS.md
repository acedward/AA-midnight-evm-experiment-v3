# G2 build artifacts — `EXPERIMENTAL_LANE` / `LANE-DEV-1`

00005-open-colour-custody, Plan 02. Compiled by the pinned image `aa00005-compactc:0.33.0` (archive
pinned by SHA-256 in `docker/compactc.Dockerfile`).

Recorded (UTC): 2026-08-19T03:32:57Z
Compiler: compactc 0.33.0
Language: 0.25.0

## Source hashes

| Source | SHA-256 | bytes | status in 00005 |
|---|---|---|---|
| `contracts/minter.compact` | `5eefba98962ddbef4af6b1ea4d17c21f37baf1d712c5822be0a7b4c245d6c1ef` | 4676 | REUSED UNCHANGED from 00004 |
| `contracts/manager.compact` | `49ae97218b753e0f101aaaa1e90c711f8965d21d456ae4cef5b80d3679a2ad3a` | 18320 | **v3 — rewritten: fully open** |
| `contracts/minter-collide.compact` | `a649df17d243fd6537a5d72e53140242320173a7770641708cf74382c5e4b25e` | 4191 | **new — the P-COLL fixture** |

The Minter's hash is expected to differ from 00004's only if 00004's file changed; the
contract source is byte-identical to the 00004 base commit:

    contracts/minter.compact — BYTE-IDENTICAL to f066a09

## minter

- compiler-version: `0.33.0`
- language-version: `0.25.0`
- runtime-version: `0.18.0-rc.1`
- witnesses: (none)
- circuits (4): `shieldedColor`, `unshieldedColor`, `mintShieldedTo`, `mintUnshieldedTo`

| Artifact | SHA-256 | bytes |
|---|---|---|
| `contract/index.js` | `3756db90ac25bc74496bbc38f2509f124b01bb7feb0877806dd878ba854241ad` | 60496 |
| `keys/mintShieldedTo.verifier` | `ae0e9f3692e354dbb3c20abaef3195cbe14341510c0f2dbaa76b28809687d3a9` | 2119 |
| `keys/mintUnshieldedTo.verifier` | `0e6c13e4aa8b4a694b516046d43cd141d1390451ce9eb82a8aac0595def1fcda` | 2119 |
| `keys/shieldedColor.verifier` | `f32145c458988ca85cde3d4110d0abdbcc6dd5494d6484d137c7b82a8a9ba904` | 2119 |
| `keys/unshieldedColor.verifier` | `21b3ae9afb63441da7d0fc7f0eeb2f9c04675de6e298435507081f05ba7e5e35` | 2119 |

## manager

- compiler-version: `0.33.0`
- language-version: `0.25.0`
- runtime-version: `0.18.0-rc.1`
- witnesses: `localOwnerSecret`
- circuits (15): `shieldedKey`, `unshieldedKey`, `registerAccount`, `myAccount`, `isRegistered`, `shieldedAccountBalance`, `unshieldedAccountBalance`, `poolValue`, `poolHasColour`, `depositShielded`, `withdrawShielded`, `depositUnshielded`, `withdrawUnshielded`, `transferInternalShielded`, `transferInternalUnshielded`

| Artifact | SHA-256 | bytes |
|---|---|---|
| `contract/index.js` | `0aef2c62bcaf22fa8f2b7a029f796a91175e7af60711dcabc572fee9938fc325` | 219850 |
| `keys/depositShielded.verifier` | `c3a9258024975f6407168392ff02845a39ef7b2d03c5ded08369d82d8c016c69` | 2119 |
| `keys/depositUnshielded.verifier` | `570e519f854e0af23141c98d6554951df9abb0513f5c3a31eeccdda70dd57186` | 2119 |
| `keys/isRegistered.verifier` | `904044b557bd5b9449849d2dd2914ac2ce50af731e9a3cf5a8ea6d508545475a` | 1351 |
| `keys/poolHasColour.verifier` | `e6d6bb091a9201fed305b69898df896fac8c80b1ee6cb558c2670d33d9ef9e84` | 1351 |
| `keys/poolValue.verifier` | `81918c5f462ce83eae5c9eec1f5c8c227c5ad3ef5d07a72377811928e49a0945` | 1351 |
| `keys/registerAccount.verifier` | `8fed408221b2f0d0ceb37851604719cc31e558029f030649a014419e3caed99a` | 1351 |
| `keys/shieldedAccountBalance.verifier` | `706dae7c7ad841a8cbfbfbe7a626f946a6047b35714bb67df3029557f61ec93a` | 2119 |
| `keys/transferInternalShielded.verifier` | `96d77deab37efc7b08fe6fb2d1cbd3085178fdf67103dc460259795806a9f256` | 2119 |
| `keys/transferInternalUnshielded.verifier` | `f7ef43da737a47f3b45834d1216b17a4fd29a74c46ef5654f1352cec2f039e2b` | 2119 |
| `keys/unshieldedAccountBalance.verifier` | `cdc138d828ed1043f988582309057908586e93c668ab10d0b6282b4ef6d4f013` | 2119 |
| `keys/withdrawShielded.verifier` | `6fddafdbcad0f977610f98383f1bbeb744f591479ce46c351a68c7484d20fde0` | 2119 |
| `keys/withdrawUnshielded.verifier` | `22ddf9bde22d9aed61ec68b3625a9d86cc43cb1a18c3d564bb8bb4d9bf043da2` | 2119 |

## minter-collide

- compiler-version: `0.33.0`
- language-version: `0.25.0`
- runtime-version: `0.18.0-rc.1`
- witnesses: (none)
- circuits (5): `collidingColor`, `shieldedColor`, `unshieldedColor`, `mintShieldedTo`, `mintUnshieldedTo`

| Artifact | SHA-256 | bytes |
|---|---|---|
| `contract/index.js` | `7c0b888d1f4e5a1248c119501054905c0cc2b880067ef313e28821ff872c847a` | 61574 |
| `keys/collidingColor.verifier` | `f32145c458988ca85cde3d4110d0abdbcc6dd5494d6484d137c7b82a8a9ba904` | 2119 |
| `keys/mintShieldedTo.verifier` | `ae0e9f3692e354dbb3c20abaef3195cbe14341510c0f2dbaa76b28809687d3a9` | 2119 |
| `keys/mintUnshieldedTo.verifier` | `2ee87bf116bfefc6a0b82dc28d37d5a075dbb60df9862155ed58b00b1e7fe9a0` | 2119 |
| `keys/shieldedColor.verifier` | `f32145c458988ca85cde3d4110d0abdbcc6dd5494d6484d137c7b82a8a9ba904` | 2119 |
| `keys/unshieldedColor.verifier` | `f32145c458988ca85cde3d4110d0abdbcc6dd5494d6484d137c7b82a8a9ba904` | 2119 |

### A note on shared circuit names

`minter-collide` deliberately mirrors `minter`'s circuit names so the same harness code
paths drive both. That is safe because proof-key resolution joins on the hash of the
DEPLOYED VERIFIER KEY, never on the circuit name — the hashes above are what distinguishes
them, and `ZKConfigRegistry` is given one artifact source per compiled contract.

## Deployment and deploy-order evidence

- `deploy-order.json` — machine-readable result of Plan 02 Phase 3
- `CONTRACTS.md` — the deploy-order proof, deployments, colours, 15/15 distinctness, the
  inverted P-COLL equality, the unseeded maps and the unit negatives
- `12-deploy-order.out` — the verbatim console log of that step
