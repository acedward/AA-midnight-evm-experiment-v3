# Phase 4S pinned skip-ZK compile

- Container: `aa00008-phase4s-compile-u2`
- Marker port: `40057`, confirmed free before and after
- Image:
  `aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b`
- Bounds: `--cpus 4 --memory 20g --memory-swap 20g --network none`,
  `RAYON_NUM_THREADS=4`
- Source:
  `contracts/variants/arm-g-split-dual-entrypoints.compact`
- Source SHA-256:
  `550a0c102476bf39ede8a9166660f2dd64a59b47b75e04741697c2fac9cd9402`
- Output: `harness/generated-phase4s/compile-u2/manager`
- Command mode: `compactc --feature-zkir-v3 --skip-zk`
- Exit: `0`
- Elapsed real time: `2.19` seconds
- Prover/verifier files generated: `0`
- Post-run matching Docker residue: containers/volumes/networks `0/0/0`; direct matching process
  listing empty

Pre-commit source hygiene removed one trailing blank line, producing final variant SHA-256
`76e17eb1b8d3af6d1cfd2a8427b5735383aa0a5bfda72143e4cee683cf82f9e2`. Fresh pinned skip-ZK
compile `aa00008-phase4s-compile-u3` on confirmed-free marker port `41215` exited `0` in `0.75s`;
all 15 text ZKIRs and `contract/index.d.ts` were byte-identical to this u2 output. No key file was
generated and post-u3 container/port residue was zero/free.

Exact compile command (the host wrapper also used `/usr/bin/time -lp`):

```sh
docker run --rm --network none \
  --name aa00008-phase4s-compile-u2 --cpus 4 --memory 20g --memory-swap 20g \
  -e RAYON_NUM_THREADS=4 -e PHASE4S_PORT=40057 \
  -v "$PWD/contracts:/work/contracts:ro" \
  -v "$PWD/harness/generated-phase4s/compile-u2:/out" \
  -w /work \
  aa00006-compactc@sha256:f57ca2d88cec1c66f377eb8bb2d616779202dd1ccb99517a4f7ddfffa9d0d86b \
  compactc --feature-zkir-v3 --skip-zk \
  /work/contracts/variants/arm-g-split-dual-entrypoints.compact /out/manager
```

## Generated ABI/compiler artifacts

| File | Bytes | SHA-256 |
|---|---:|---|
| `compiler/contract-info.json` | 38,977 | `840f52745256ed1167cfcf61562f17e2ec7152aea93c023ae252386c9286537c` |
| `compiler/contract-manifest.json` | 3,359 | `014e9f091fb04b846f48a99693633a87942d374aa2a346ca46ea409ca5794b68` |
| `contract/index.d.ts` | 25,429 | `5f3cdc2ff75f02828988564c935aa1a4b92312b1d0ede0098101e06c17eb4dc1` |
| `contract/index.js` | 574,586 | `ab170bbfd509153555d83fdecd66873c70da3b46668058bde77328929d7929ff` |
| `contract/index.js.map` | 34,824 | `5fd2b8630a6b51664b37d0edee8f8c9fcb2701a9b8fac9ad5583c7798a880943` |

## Actual generated provable-circuit list

The compiler emitted 15 text ZKIRs, exactly eight unaffected product circuits plus seven diagnostic
gateways:

| Circuit | ZKIR bytes | ZKIR SHA-256 |
|---|---:|---|
| `accountRecord` | 6,066 | `85e6e17aa1ffcbe39155bdfaf7da164aba3cf3a0fb468cbe9f95e4ea24bcbe87` |
| `depositShielded` | 17,241 | `0d1c276a71f2e9a21048dded70be32b0123edcb3ee3d45cea63ba10e2739a530` |
| `depositUnshielded` | 5,140 | `00edc610844118939b34c591cf7d15bcbc0d6fdb673a406b7fd6ee050b639411` |
| `isRegistered` | 945 | `df0d50c70e43c0d98483c10f228198c74a434fbc454422797336f43aa0acaefb` |
| `openSwapShieldedAuthorized` | 729,985 | `514012db7510c05bd95e966ecf1de29c016737eb4de4f583318cf85cafc81d1e` |
| `poolHasColour` | 951 | `f02c677c55a37efe87adc2357a6eb729aa3da388d8e9dc3025a902df4584cff4` |
| `poolValue` | 2,001 | `1781e52f5254aab9f46e006b68ef2d714a659d782f3b2404f5337096bfc24bfd` |
| `registerEvmAccount` | 273,118 | `a2f05b787cd64a436df841f41c44d95b809cf5699f7c2c959fda14586dfb7848` |
| `registerNativeAccount` | 90,842 | `0eb36a2fb6fc2c3411a75ad771596fee26c69bcf87c10b846b5d07c7e019f6c1` |
| `shieldedAccountBalance` | 2,156 | `4080d5c83637333b372d45b5526e68463f288a99d26d4f7e2edf0091736b71cc` |
| `transferShieldedAuthorized` | 392,413 | `b647e6d3441930012d8326e208813dd299e40edab67122c448a93820c75d2638` |
| `transferUnshieldedAuthorized` | 392,433 | `f7bcfa631477513587f65291e83aa4b08dea55ad2f777ffb18979e6961f40d11` |
| `unshieldedAccountBalance` | 2,160 | `27f8c50d09f41a2d82b0c34156ced3cc025735e5d50b22c691ac3842e6309559` |
| `withdrawShieldedAuthorized` | 439,406 | `fb5016574151837569a61731193c55e25ad5dadb4a26298f47cd0ccedd7349e3` |
| `withdrawUnshieldedAuthorized` | 431,884 | `78e595bbd70c65b5584207900507d8bfb189b812234fbe62194af9dae7e27fb6` |

Mechanical generated-surface checks passed: all seven candidates exist; generic `execute` and all
old direct owner-debit verifier names are absent; each generated action signature includes one
`authMode`, account/owner/nonce/deadline, action-specific economic arguments, and one signature/key
transport. The source routes both modes through `authorizeSpecificAction`; no EVM-only/native-only
debit export exists.
