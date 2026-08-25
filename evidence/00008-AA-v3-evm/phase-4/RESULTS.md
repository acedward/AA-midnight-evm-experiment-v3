# Phase 4 live contract matrix — blocked checkpoint

Date: 2026-08-24

Source branch/start: `00008-AA-v3-evm-w2-contract` at
`baa5712aacfb81d470ed8173ac6dfbb3b92ce328`

F1 evidence-only closure commit: `ed3da8c2ed72bb40434beb7148c96ef717d9a52c`

## Required artifact pins

- Final Manager: `harness/generated-phase4r/final-7b0d03d/manager`
- Final manifest: 41/41 files verified before both live apparatus runs
- Loaded generated Manager `contract/index.js` SHA-256:
  `8b3073068c7b9ebaae991db7140dbf5d3f8493c4ec34089833866dbcba28607d`
- Final `keys/execute.prover`: 2,282,126,073 bytes, SHA-256
  `06fd33a9368185081d345bce748aa59c34a96aba8e4f5c056a697f128bd28993`
- Inherited Minter: 21/21 files verified against `MINTER-SHA256SUMS.txt`
- Historical u13 preservation manifest: 17/17 entries verified before and after each run; the nine
  untracked BZKIRs were not modified.
- No proving or verifying key was regenerated.

## Docker/Compose lane

The focused lane uses fresh free loopback ports above 10000 and digest-pinned images:

- whole rc5 proof server:
  `midnightntwrk/proof-server@sha256:4f02ca2734649eb238d13924df299b1c82bd5546ec928c5d67bdd0ce86dd0bd1`
- plain proof support:
  `midnightntwrk/proof-server@sha256:c68c25e870751c907cd779b122988e59362f60be2a53142b56bda41573ec775f`
- node:
  `midnightntwrk/midnight-node@sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e`
- indexer:
  `midnightntwrk/indexer-standalone@sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a`
- runner:
  `node@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e`

Source and retained generated artifacts are copied into a disposable whole-worktree named volume;
the exact final Manager and inherited Minter are then overlaid at `harness/generated-zk/{manager,minter}`.
The evidence volume is separate. The wrapper owns Compose down, named-volume removal, process checks,
and port checks on every exit.

## Apparatus attempt 1

- Project: `aa00008_phase4_20260824_155250_31371`
- Ports: `17483/36139/22026/24752`
- All manifests, loaded Manager hash, and service readiness passed.
- The runner exited before wallet, proof, or chain activity because importing a historical placement
  helper eagerly required the unrelated unstaged `minter-collide` fixture. The exact first error and
  full service logs are in `apparatus/attempt-1-import-gap/`.
- The placement assertion was kept locally in the Phase 4 runner, resolving this apparatus-only gap.
- Teardown residue (containers/volumes/networks/processes/busy ports): `0/0/0/0/0`.
- This was not the historical HTTP 400/alignment/proof symptom.

## Apparatus attempt 2 and live deployment receipt

- Project: `aa00008_phase4_20260824_155524_32437`
- Ports: `11879/30534/16422/35077`
- All manifests, loaded Manager hash, and service readiness passed.
- Both fee wallets, the holder, and the independent taker were funded and DUST-registered.
- Final Manager address:
  `4d116c78e180722ee018a31876bd4b501abfc6c229a8bbadce50afbd69ef353c`
- Deployment tx ID:
  `006b3fea158c9cc655da22b8c82cb357fddc861af85ea8b91601dbb61400430fed`
- Deployment tx hash:
  `2bdce2b6df70970b5939d6d2170a275f6376c8f858435d5571229ab20224114c`
- Block: 120, hash
  `dafd4d3b3a482159e27050f01344f5ab016f941205a1468fbf3a79dc1ff6839d`
- Deployment cost: `readTime=3655000000`, `computeTime=5777661095`, `blockUsage=21478`,
  `bytesWritten=21840`, `bytesChurned=15432`.

The first native `execute` path stopped during its first local low-level `check`, before HTTP prove
and before transaction submission:

`RangeError [ERR_FS_FILE_TOO_LARGE]: File size (2282126073) is greater than 2 GiB`

Captured inputs:

- raw unproven transaction: 1,727 bytes, SHA-256
  `474cf9fda0bbfe9cb2d89674a46a51532509f5d125af5f4baf4d07b6b66b0495`
- circuit location:
  `contract:4d116c78e180722ee018a31876bd4b501abfc6c229a8bbadce50afbd69ef353c/execute?vk=a119a3c2d65f5741e72055f9f976f22ca3963b87f5b5b01b3701680914cf4117`
- check preimage: 886 bytes, SHA-256
  `059873cfe6e4a82084d982059dd7601f5e67607d85ffd2a44774b97520736119`

No proof retry occurred. Because this was a local file-size exception before HTTP, it is not a
recurrence of the historical HTTP 400/alignment/proof failure. Exact JSON and service logs are in
`apparatus/attempt-2-large-key-gap/`. Teardown residue was `0/0/0/0/0`.

## Pinned public-interface inspection

Read-only inspection of the exact installed public packages proves the current path is not
streaming-capable:

1. `@midnight-ntwrk/midnight-js-node-zk-config-provider@5.0.0-beta.6`
   - `src/node-zk-config-provider.ts:60-68`: `readFile` returns
     `fs/promises.readFile(target)` as one `Buffer`.
   - `src/node-zk-config-provider.ts:119-122`: `getProverKey` awaits that complete buffer.
   - Source SHA-256:
     `a7e63100c0f5903104068e141d400254ef967be60a8627f3d0888fe295e0a170`.
2. `@midnight-ntwrk/midnight-js-types@5.0.0-beta.6`
   - `dist/index.mjs:574-580`: `ZKConfigRegistry.buildConfig` `Promise.all`-loads prover key,
     verifier key, and ZKIR into the `Uint8Array`-backed config.
   - Source SHA-256:
     `fcd4b3a1fb3fd3495952ff12626e57e7f23a65e92c42ec452620dd2681bf8598`.
3. `@midnight-ntwrk/midnight-js-http-client-proof-provider@5.0.0-beta.6`
   - `dist/index.mjs:45-57,83-108`: `makeKeyMaterialResolver` resolves the complete config even for
     `check`; `prove` supplies complete key material to contiguous `createProvingPayload`.
   - Source SHA-256:
     `3a1057398a8a3e5a50627747a20e9ab1b257d17f109bf9fe4ea9b4d144816971`.

Therefore a final K=20 exact-artifact route requires broader protocol/provider engineering and must
still prove end-to-end transport/server viability for a payload carrying more than 2 GiB of proving
material. A draft loader workaround was not retained, compiled, or run.

## Status and decision boundary

Phase 4 is BLOCKED on canonical Q2. The owner must choose between broader K=20 provider/protocol
engineering, another proven-compatible pinned runtime, or an invariant-preserving replan targeting
K<=19 followed by exactly one fresh key generation. Accepting deploy/simulator-only evidence is
explicitly rejected because the mandatory live native/EVM action, refusal/no-state, independent-taker,
and concurrent-nonce receipts remain absent. No implementation or proof retry may begin before that
decision. Product source, frozen EIP-712 bytes, public ABI, dual authority, custody ordering, and all
retained generated keys remain unchanged at this checkpoint.
