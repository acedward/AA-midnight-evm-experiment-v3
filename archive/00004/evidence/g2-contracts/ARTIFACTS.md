# G2 build artifacts — `EXPERIMENTAL_LANE` / `LANE-DEV-1`

00004-multi-token-custody, Plan 02. Compiled by the pinned image `aa00004-compactc:0.33.0` (archive
pinned by SHA-256 in `docker/compactc.Dockerfile`).

Recorded (UTC): 2026-08-18T21:04:32Z
Compiler: compactc 0.33.0
Language: 0.25.0

## Source hashes

| Source | SHA-256 | bytes |
|---|---|---|
| `contracts/minter.compact` | `5eefba98962ddbef4af6b1ea4d17c21f37baf1d712c5822be0a7b4c245d6c1ef` | 4676 |
| `contracts/manager.compact` | `3a6c71013e81490f2bb8869f08ea3e1e8abe39f63966dd35f49dd76f15609ff3` | 15958 |

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
- circuits (13): `balanceKey`, `configure`, `registerAccount`, `myAccount`, `isRegistered`, `accountBalance`, `poolValue`, `poolHasColour`, `depositShielded`, `withdrawShielded`, `depositUnshielded`, `withdrawUnshielded`, `transferInternal`

| Artifact | SHA-256 | bytes |
|---|---|---|
| `contract/index.js` | `f223eedab7d360d0c5548cc0ae7d917813e91d7e18e3e4a9d4a06ed4339f1b87` | 237082 |
| `keys/accountBalance.verifier` | `3a69b0b4a8f167d9c32f01b358bec3f8fc39dce0de68b7c7a463444c1a3d5a23` | 2119 |
| `keys/configure.verifier` | `454bd521eb465e65dc8cd069167e16edeb54b7368a487b219aac7ecc1e158701` | 1351 |
| `keys/depositShielded.verifier` | `e924cf3ae9a87449bfde85abb47f3df5d17e656729189ceaf012a305623ea285` | 2119 |
| `keys/depositUnshielded.verifier` | `d9f69f103290bcfc2c1c6d3832719ca512d2e16b8a3041683fa15104537dbd7e` | 2119 |
| `keys/isRegistered.verifier` | `832e1d743ea6dc0a0d0bcc26594c9d09fd3dcbb0d40e84b9a0f32011b7c87790` | 1351 |
| `keys/poolHasColour.verifier` | `54e6873c1b7a52440d95bec07aa071dc232a84ad1283a06f56d177d9dcc773a4` | 1351 |
| `keys/poolValue.verifier` | `c5fcdd56fcf461ff8358b83e5e7437f57c9bc2b4c4cc6c0f5b57239ab0f96d1f` | 1351 |
| `keys/registerAccount.verifier` | `c004a1eda81291327e832d8f6e70bae16da7a56ef06e555da29cb360f096098b` | 2119 |
| `keys/transferInternal.verifier` | `f0f079049b51b9ca9532094780b535a357d2186e9c29e268a45f7b500b7aeeb5` | 2119 |
| `keys/withdrawShielded.verifier` | `571042f14ce877f970f00bacf43523967b78b8ddf84d441230a828f3d5474ef7` | 2119 |
| `keys/withdrawUnshielded.verifier` | `d60452c793090dde95dd84e97df76ff4073c63c9fd0f0cd1cfbaf69fa787c382` | 2119 |

## Deployment and configure evidence

- `deploy-configure.json` — machine-readable result of Plan 02 Phase 3
- `CONTRACTS.md` — deployments, the six colours, 15/15 distinctness, configure state,
  the seeded table and the unit-level negatives with verbatim errors
- `11-deploy-configure.out` — the verbatim console log of that step
