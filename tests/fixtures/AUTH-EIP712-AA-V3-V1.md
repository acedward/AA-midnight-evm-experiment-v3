# AUTH-EIP712-AA-V3-V1 frozen byte contract

Status: frozen by F-CODEC Phase 1. Any byte change requires a new version and an approved spec
decision. All hex in fixtures is lowercase and `0x`-prefixed; all integers in wallet JSON are
base-10 strings.

## Domain and account identity

The exact domain type is
`EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)`. Its fields are
ordered `name`, `version`, `verifyingContract`, `salt`; name is `AA v3 EVM Manager`, version is `1`,
`verifyingContract` is the final 20 bytes of `keccak256(actualManager)`, and `salt` is the actual
nonzero 32-byte Manager deployment domain. There is no `chainId`.

Frozen Keccak-256 hashes (without reinterpretation or endian reversal):

| Value | Hash |
|---|---|
| Domain `encodeType` | `36c25de3e541d5d970f66e4210d728721220fff5c077cc6cd008b3a0c62adab7` |
| Domain name | `b2a161c1e1fe09f631585b3bda0e4a22f317d7c663c582a07c1d683e61fdcdb1` |
| Domain version | `c89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6` |
| `AA_V3_EVM_ACCOUNT_ID_V1` | `55bc940f835337f1224c181110b2b77f57ed694cae0c4bf8ff6bb3e03be6a988` |

The account ID is
`keccak256(accountTagHash || actualManager || leftPad32(owner) || accountSalt)`, exactly 128 bytes.
The final EIP-712 digest is `keccak256(0x1901 || domainSeparator || structHash)`, exactly 66 bytes.

## Primary types

| Selector | Primary type | Exact `encodeType` | Type hash |
|---|---|---|---|
| 1 | `RegisterEvmAccount` | `RegisterEvmAccount(bytes32 manager,bytes32 accountId,address owner,bytes32 accountSalt,uint64 validUntil)` | `e6ace6c70a9d92ef851c2e2a67b2309017b051d39e0554c746274a176959ac4f` |
| 2 | `WithdrawShielded` | `WithdrawShielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 color,uint128 amount,uint8 recipientKind,bytes32 recipient)` | `717e1e74129852bd436744a5a1108f0db902927031f5e7799618ec129366d61e` |
| 3 | `WithdrawUnshielded` | `WithdrawUnshielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 color,uint128 amount,uint8 recipientKind,bytes32 recipient)` | `b60129ea6ca4c1b51d866077d11cdb0230e6065876a54206fece04413edaba9d` |
| 4 | `TransferInternalShielded` | `TransferInternalShielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 toAccountId,bytes32 color,uint128 amount)` | `06beb83ec8ded3a8080bfab591d89a1b86ed9e3f8df6c10ed3677416d0a56064` |
| 5 | `TransferInternalUnshielded` | `TransferInternalUnshielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 toAccountId,bytes32 color,uint128 amount)` | `46e96f4496c182e98395b689701a945cbdb47543574242cc17f9b6448c049a07` |
| 6 | `OpenSwapShielded` | `OpenSwapShielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 giveColor,uint128 giveAmount,uint8 recipientKind,bytes32 recipient,bytes32 wantNonce,bytes32 wantColor,uint128 wantAmount,bytes32 creditAccountId)` | `f787d7f963e89efcda8e6a546bafff33388cbdf44b81f6f5950c4bd3b0665848` |

Each field is one standard 32-byte ABI word. `bytes32` stays byte-identical; addresses are left-padded
with twelve zero bytes; `uint8`, `uint64`, and `uint128` are unsigned big-endian and left-padded to
32 bytes. The TypeScript API accepts the integer values only as `bigint`, and its
`eth_signTypedData_v4` object serializes them only as decimal strings.

Recipient unions are selector-specific: selector 2 is `0 = ZswapCoinPublicKey`, `1 =
ContractAddress`; selector 3 is `0 = ContractAddress`, `1 = UserAddress`; selector 6 is `0 =
none/open`, `1 = ZswapCoinPublicKey`, `2 = ContractAddress`. Selector 6 kind 0 requires the recipient
word to be all zero. Every field inactive for the selected action/auth shape must be absent at the
TypeScript boundary and is encoded as an all-zero word in the semantic union.

## Signature and point transport

The only wire form is 65 bytes `r || s || v`. `r` and `s` are unsigned 32-byte big-endian scalars in
`[1,n-1]`; `v` is exactly `0`, `1`, `27`, or `28` and normalizes to recovery bit 0 or 1. This v1
codec selects the strict option permitted by the spec and requires canonical low-s
`s <= n/2`. The retained high-s twin is recovered only through an explicit noncanonical test path
to prove it has the same digest/signer; normal parsing rejects it. Ledger account nonce remains the
replay authority.

The recovered Compact argument is `Secp256k1Point { x, y, identity: false }`. Both coordinates are
unsigned 32-byte big-endian values. Ethereum address derivation is the final 20 bytes of
`keccak256(x || y)`; the digest enters Compact as its exact big-endian `Bytes<32>`.

Nonce and `validUntil` are `uint64`; amounts are `uint128`. Runtime deadline policy is strictly
future and at most 3,600 seconds ahead, but the byte codec also retains zero/max boundary vectors.

## Registration KAT

The normative private test key is
`4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318`; owner
`2c7536e3605d9c16a7a3d7b1898e529396a65c23`; Manager `aa` repeated 32 bytes; deployment domain
`dd` repeated 32 bytes; account salt `cc` repeated 32 bytes; and valid-until `2000000000`.

The account ID is `25795e3d56dd5715e106a11a61280aa4c1a99a3f409fbe7f33d2549cbb0d592e`;
Manager alias `8fb9007a8537c8dfdb6a3f8c2cfd64db19d2ec90`; domain separator
`7bcfafe962b11fdadc57f26725157d9ba5a7367544b6f69a4822d9af482b4c0c`; struct hash
`c030a38121e5c111ac3920b8a6ddda9170e3b88f96c77cbbe5b5986331e18fa5`; digest
`50eafb056abc5461f1a87968dbf5cdfe7cfeab465c02548dde208c681ba152ce`; and signature
`18c8c0b1a03a9d14923824f037423de763035cc9b4ae011b10519473553845fa` ||
`4b23d69e009b1b012a044d2651134524419f420f6157d333eda0b3cb2d469f81` || `1c` (`v = 28`).

## `AA_V3_SEMANTIC_COMMITMENT_V1`

The commitment is Keccak-256 of exactly 1,024 bytes: 32 consecutive 32-byte words. It does not
depend on JSON property order.

| Word(s) | Meaning |
|---|---|
| 0 | `keccak256("AA_V3_SEMANTIC_COMMITMENT_V1")` |
| 1 | actual Manager address |
| 2 | actual deployment domain |
| 3 | `keccak256("execute")` |
| 4 | selector as a uint8 ABI word |
| 5 | selected EIP-712 type hash; zero only for selector 0 |
| 6 | authenticated account ID |
| 7 | auth mode word: 0 native, 1 EVM |
| 8 | EIP-712 digest for EVM; native auth-result hash for native |
| 9 | current/signed EVM uint64 nonce; zero for registration/native |
| 10–21 | canonical action union below |
| 22 | derived Manager call-transcript hash |
| 23 | non-DUST imbalance slot count, uint8 0–2 |
| 24–27 | slot 0: family, color, direction, uint128 magnitude |
| 28–31 | slot 1: family, color, direction, uint128 magnitude |

Action-union words 10–21 are, in order: owner, valid-until, account salt, primary color, primary
amount, recipient kind, recipient, destination account, wanted coin nonce, wanted color, wanted
amount, credit account. Primary color/amount mean withdrawal color/amount, transfer color/amount, or
swap give color/amount. Inactive words are zero and noncanonical supplied inactive fields reject.

Native auth result is
`keccak256(keccak256("AA_V3_NATIVE_AUTH_RESULT_V1") || accountId)`. The call-transcript hash is
`keccak256(callTag || manager || executeHash || selectorWord || primaryTypeHash || accountId ||
authResult || keccak256(actionUnionWords))`, where `callTag` is
`keccak256("AA_V3_MANAGER_CALL_TRANSCRIPT_V1")`.

The frozen tag hashes are semantic tag
`e211484881f25457d338efff105e3553314351338b55ee215539106ff5ee9c6e`, call-transcript tag
`6b26fd1f966683299aae5e9e5ecd2c575f1a17e916db0a6fb29dcd9ed862f0df`, native-auth-result tag
`2adba874390db725f48915217da703e3fd62ec40296c2a2d02602e67a3b9e7f4`, and `execute` entrypoint
hash `c640060cdb34fcc260f41eac7474ee1d7c80b7e3607daff9ac67c7ea2ebb1c44`.

Non-DUST family 1 is shielded and 2 is unshielded. Direction 1 is negative/deficit and 2 is
positive/surplus. Zero magnitudes are omitted; duplicate family/color pairs reject; active slots are
sorted by `(family, color)` and inactive trailing slots are all zero. DUST has no slot. The bounded
Manager action can produce at most two non-DUST family/color entries; a third rejects rather than
being truncated or hashed through a variable-width side channel.
