# Phase 4S diagnostic source isolation

- Product Manager SHA-256 before/after variant creation:
  `85b538bc8d20be04a39d24f39f153292de6d472bd7dac6188c19eca412e5c858`
- Diagnostic variant SHA-256:
  `76e17eb1b8d3af6d1cfd2a8427b5735383aa0a5bfda72143e4cee683cf82f9e2`
- `git diff --no-index --stat`: 525 insertions, 59 deletions; all differences are in the named
  variant because the product Manager is unchanged.

The variant is the exact product source with only these diagnostic differences:

1. A conspicuous non-shipping/non-promotion header is prepended.
2. The export list replaces `execute` with exactly seven candidate gateways.
3. The generic exported `execute` tail is replaced with fixed-action payload/digest/semantic helpers
   and the seven action-specific gateways.

The first compile/measure source had one extra blank line at EOF and SHA-256
`550a0c102476bf39ede8a9166660f2dd64a59b47b75e04741697c2fac9cd9402`. Pre-commit whitespace
hygiene removed only that blank line. A fresh pinned skip-ZK compile (`compile-u3`, exit `0`, real
`0.75s`, marker port `41215`) proved all 15 text ZKIRs and generated `index.d.ts` byte-identical to
the measured `compile-u2` output, so every retained K/row result addresses the final committed
source graph exactly.

The inherited ledger declarations, constructor, account identity, frozen constants, readers,
deposits, private custody circuits, swap implementation, generic pure byte oracles, and event
constants remain byte-for-byte copied from the product source.

## Mechanical source assertions

- No `export circuit execute` remains.
- No old private custody function is exported.
- Exactly these seven owner gateway definitions exist:
  `registerNativeAccount`, `registerEvmAccount`, `withdrawShieldedAuthorized`,
  `withdrawUnshieldedAuthorized`, `transferShieldedAuthorized`,
  `transferUnshieldedAuthorized`, `openSwapShieldedAuthorized`.
- Every action gateway constructs a canonical `ExecutePayload` internally with a literal selector
  from 2 through 6 and action-specific arguments; no action gateway accepts `ExecutePayload`.
- The five action gateways all call the same private `authorizeSpecificAction`, which retains the
  native witness path through `localOwnerSecret`/`authenticatedActionAccount` and the EVM path
  through fixed EIP-712 digest, secp256k1 verification/address binding, stored mode/owner/nonce,
  and live deadline.
- Each action gateway calls exactly one inherited private custody function directly; no gateway
  calls or wraps generic `execute`.
- Each action invokes `finishSpecificAction`/`finishSpecificSwap` only after custody returns. Those
  helpers write the EVM nonce before emitting the canonical semantic event, preserving the product
  custody-before-nonce order and logical `execute` entrypoint hash.
- Registration selectors 0 and 1 remain separate ceremonies. Native registration takes no EVM
  transport; EVM registration verifies the exact frozen `RegisterEvmAccount` digest and stores
  owner plus nonce zero.
