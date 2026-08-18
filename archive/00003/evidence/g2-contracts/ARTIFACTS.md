# G2 build artifacts — EXPERIMENTAL_LANE / LANE-DEV-1

Compiler: compactc 0.33.0
Language: 0.25.0

## minter

- compiler-version: `0.33.0`
- language-version: `0.25.0`
- runtime-version: `0.18.0-rc.1`
- witnesses: (none)
- circuits (4): `shieldedColor`, `unshieldedColor`, `mintShieldedTo`, `mintUnshieldedTo`

| Circuit | verifier key SHA-256 | bytes |
|---|---|---|
| `mintShieldedTo` | `3a76b969997166eb78fe78e0daf924e07383b992cef28bad34ff9e66077108c7` | 2119 |
| `mintUnshieldedTo` | `395d200e66e20914336aba9ef5ac8df2897abfc08b206ba7155d33529a0f73e4` | 2119 |
| `shieldedColor` | `449000cf3816c1e1847a71052def55a5d42cd93d218e062624912947259913b9` | 2119 |
| `unshieldedColor` | `810e3c81ca51581ae6e662affd489af197d8c4390671db8185a7a7b1815f9f3c` | 2119 |

## manager

- compiler-version: `0.33.0`
- language-version: `0.25.0`
- runtime-version: `0.18.0-rc.1`
- witnesses: `localOwnerSecret`
- circuits (15): `configure`, `registerAccount`, `myAccount`, `isRegistered`, `accountShielded`, `accountUnshielded`, `poolShieldedValue`, `poolHasCoin`, `depositShielded`, `withdrawShielded`, `selfSendShielded`, `depositUnshielded`, `withdrawUnshielded`, `selfSendUnshielded`, `transferInternal`

| Circuit | verifier key SHA-256 | bytes |
|---|---|---|
| `accountShielded` | `aef1f5fab637abff2f9908a47da538bca5e8253a99d9c782b934e6297b580b85` | 1351 |
| `accountUnshielded` | `72d1f2cabd80b5b61fe96ace781f415b4ba66e6fb08448a98b71e2da30e77c84` | 1351 |
| `configure` | `f127115b63a632cacd6ac95fe74d7d4c6359232e5d4e3065e7cd1ee6b8681705` | 1351 |
| `depositShielded` | `6f8027f9a8ef70738e1d4d357e467c1781757daade62807b82d37425257ec748` | 2119 |
| `depositUnshielded` | `76b85f26d78bf80f93a2804e843d7bdb58acfdab8ed209d149b1fac6c988478e` | 1351 |
| `isRegistered` | `54e6873c1b7a52440d95bec07aa071dc232a84ad1283a06f56d177d9dcc773a4` | 1351 |
| `poolHasCoin` | `e2d0a5f3971f87ce8d20c2a1709ff1c09048fdf5466a0d342f6b24405a2b2b7f` | 1351 |
| `poolShieldedValue` | `f11e7c43639ad5d054af242ff5e7641de13b62ec00b31750c043d894a55df482` | 1351 |
| `registerAccount` | `14ec900d3410899f36c444a124560820c78356abb1d9ea3aedc0b52d432f9e70` | 1351 |
| `selfSendShielded` | `c13843b3258338062148db104a8fc7023e1bacbaef82160ca8024087c534658f` | 2119 |
| `selfSendUnshielded` | `5137987e02153de03efeb150e5a39ba78101eab528cfb3f36c74908b20e0449a` | 2119 |
| `transferInternal` | `bedb209aa7b6ab251d0f5682f6546af96a79802f75465dc861cb37381c3283d8` | 2119 |
| `withdrawShielded` | `cc398cecf3cb8334d1e6f096189f22cb449ecb3c0838a5201779c9b8945525a8` | 2119 |
| `withdrawUnshielded` | `f1e0be36f9b9120a7bd3d5c838ff5dadee7bc0f18efb8493e9f4710f27633e09` | 2119 |

