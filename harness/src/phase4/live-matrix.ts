import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { createUnprovenCallTx, deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import {
  httpClientProvingProvider,
} from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { nodeZkConfigRegistry } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import * as ledger from '@midnightntwrk/ledger-v9';

import { makeProviders } from '../g3/providers.js';
import { settleAsTaker } from '../g1/taker.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { fundWithNight, registerForDust, syncedState, units, waitFor, withDustRetry } from '../night.js';
import { SEEDS } from '../lane.js';
import { emptyExecutePayload, prepareEvmExecute } from '../auth/manager.js';
import { addressForPrivateKey, highSTwin, publicPointForPrivateKey, SECP256K1_N } from '../auth/signature.js';
import { deriveAccountId } from '../auth/codec.js';
import { bytesToHex, hexToBytes, ZERO_20, ZERO_32, type Hex20, type Hex32 } from '../auth/bytes.js';
import { metamaskSign } from '../auth/metamask.js';
import type { Eip712Action, PrimaryType } from '../auth/schema.js';

const ROOT = '/work/harness';
const MANAGER_ZK = join(ROOT, 'generated-zk', 'manager');
const MINTER_ZK = join(ROOT, 'generated-zk', 'minter');
const EVIDENCE = process.env.PHASE4_EVIDENCE_DIR ?? '/evidence';
const RESULTS = join(EVIDENCE, 'RESULTS.json');
const PROOF_URL = process.env.LANE_PROVING_SERVER_URL ?? 'http://proof-server:6300';
const PROOF_IMAGE = process.env.PHASE4_PROOF_IMAGE ?? 'unknown';
const MANAGER_INDEX_SHA256 = '8b3073068c7b9ebaae991db7140dbf5d3f8493c4ec34089833866dbcba28607d';
const MAX_U64 = (1n << 64n) - 1n;
const MAX_U128 = (1n << 128n) - 1n;
const zero32 = () => new Uint8Array(32);
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');
const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const resultOf = <T>(value: any): T => (value?.private?.result ?? value?.result) as T;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const asBytes = (value: unknown): Uint8Array =>
  typeof value === 'string' ? Uint8Array.from(Buffer.from(value, 'hex')) : Uint8Array.from(value as Uint8Array);
const cleanHex = (value: string): string => value.toLowerCase().replace(/^0x/, '');
const h32 = (value: Uint8Array | string): Hex32 =>
  (typeof value === 'string' ? `0x${cleanHex(value)}` : bytesToHex(value)) as Hex32;
const h20 = (value: Uint8Array | string): Hex20 =>
  (typeof value === 'string' ? `0x${cleanHex(value)}` : bytesToHex(value)) as Hex20;
const errorText = (error: unknown): string => {
  const parts: string[] = [];
  let current: any = error;
  const seen = new Set<unknown>();
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    parts.push(current instanceof Error ? `${current.name}: ${current.message}` : String(current));
    current = current?.cause;
  }
  return parts.join(' <- ');
};

const tokenLabel = (token: any): string =>
  token?.tag === 'dust' ? 'dust' : `${token?.tag ?? 'unknown'}:${String(token?.raw ?? '').toLowerCase()}`;

/** Phase 4 needs only the established segment-0/open-offer assertion, kept local to avoid loading
 * unrelated historical compiled-contract wrappers (notably the minter-collide fixture). */
const requireOpenPlacement = (tx: any, expected: Record<string, string>) => {
  const segments = new Set<number>([0]);
  for (const value of (tx.intents?.keys?.() ?? []) as Iterable<number>) segments.add(Number(value));
  for (const value of (tx.fallibleOffer?.keys?.() ?? []) as Iterable<number>) segments.add(Number(value));
  const imbalances: Record<string, Record<string, string>> = {};
  for (const segment of [...segments].sort((left, right) => left - right)) {
    const values: Record<string, string> = {};
    for (const [token, delta] of tx.imbalances(segment) as Map<unknown, bigint>) values[tokenLabel(token)] = String(delta);
    imbalances[String(segment)] = values;
  }
  const atZero = imbalances['0'] ?? {};
  const segment0Exact = Object.keys(atZero).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => atZero[key] === value);
  const offendingSegments = Object.entries(imbalances).filter(([segment, values]) => segment !== '0' && Object.keys(values).length > 0);
  const report = { segments: [...segments].sort((a, b) => a - b), imbalances, expectedAtSegment0: expected, segment0Exact, offendingSegments, ok: segment0Exact && offendingSegments.length === 0 };
  if (!report.ok) throw new Error(`open-offer placement is not guaranteed/exact: ${json(report)}`);
  return report;
};

type Route = {
  sequence: number;
  operation: 'check' | 'prove' | 'lookupKey';
  keyLocation: string;
  preimageBytes?: number;
  preimageSha256?: string;
};

type ProofRecord = {
  label: string;
  rawBytes: number;
  rawSha256: string;
  routes: Route[];
  durationMs: number;
  outcome: 'PROVED' | 'FAILED';
  provenBytes?: number;
  provenSha256?: string;
  error?: string;
};

/**
 * Whole-rc5 proof provider with exact low-level route/preimage capture armed. Successful calls keep
 * hashes and sizes; a recurrence-shaped failure writes the exact raw transaction and every exact
 * observed preimage before rethrowing. No caller retries proof failures.
 */
const capturedProofProvider = async (registry: any, records: ProofRecord[]) => {
  const low: any = httpClientProvingProvider(PROOF_URL, registry, { timeout: 1_200_000 });
  let active: { label: string; routes: Route[]; preimages: Array<{ sequence: number; bytes: Uint8Array }> } | undefined;
  let sequence = 0;
  const record = (operation: Route['operation'], keyLocation: string, preimage?: Uint8Array) => {
    if (!active) throw new Error('proof route observed without an active proof');
    const route: Route = { sequence: ++sequence, operation, keyLocation };
    if (preimage !== undefined) {
      const copy = Uint8Array.from(preimage);
      route.preimageBytes = copy.length;
      route.preimageSha256 = sha256(copy);
      active.preimages.push({ sequence: route.sequence, bytes: copy });
    }
    active.routes.push(route);
  };
  const logging: any = {
    check: (preimage: Uint8Array, keyLocation: string) => {
      record('check', keyLocation, preimage);
      return (low as any).check(preimage, keyLocation);
    },
    prove: (preimage: Uint8Array, keyLocation: string, overwriteBindingInput: unknown) => {
      record('prove', keyLocation, preimage);
      return (low as any).prove(preimage, keyLocation, overwriteBindingInput);
    },
    lookupKey: (keyLocation: string) => {
      record('lookupKey', keyLocation);
      return (low as any).lookupKey(keyLocation);
    },
  };
  const high: any = createProofProvider(logging);
  return {
    prove: async (label: string, tx: any): Promise<any> => {
      const raw: Uint8Array = tx.serialize();
      const started = Date.now();
      active = { label, routes: [], preimages: [] };
      try {
        const proven = await high.proveTx(tx);
        const provenRaw: Uint8Array = proven.serialize();
        records.push({
          label,
          rawBytes: raw.length,
          rawSha256: sha256(raw),
          routes: active.routes,
          durationMs: Date.now() - started,
          outcome: 'PROVED',
          provenBytes: provenRaw.length,
          provenSha256: sha256(provenRaw),
        });
        return proven;
      } catch (error) {
        const message = errorText(error);
        records.push({
          label,
          rawBytes: raw.length,
          rawSha256: sha256(raw),
          routes: active.routes,
          durationMs: Date.now() - started,
          outcome: 'FAILED',
          error: message,
        });
        if (/\b400\b|align(?:ment|ed)?|proof.*fail|fail.*proof/i.test(message)) {
          const dir = join(EVIDENCE, 'HISTORICAL-RECURRENCE-STOP', label.replace(/[^a-z0-9_.-]+/gi, '_'));
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, 'raw-unproven.bin'), raw);
          for (const item of active.preimages) {
            writeFileSync(join(dir, `preimage-${String(item.sequence).padStart(3, '0')}.bin`), item.bytes);
          }
          writeFileSync(join(dir, 'FIRST-ERROR.json'), `${json({
            stop: true,
            label,
            firstError: message,
            rawTransaction: { bytes: raw.length, sha256: sha256(raw) },
            routes: active.routes,
            pins: {
              proofImage: PROOF_IMAGE,
              proofUrl: PROOF_URL,
              packages: {
                contracts: '5.0.0-beta.6',
                httpProofProvider: '5.0.0-beta.6',
                ledger: '1.0.0-rc.3',
              },
              managerIndexSha256: MANAGER_INDEX_SHA256,
            },
            operationOrder: active.routes.map((route) => `${route.sequence}:${route.operation}:${route.keyLocation}`),
          })}\n`);
        }
        throw error;
      } finally {
        active = undefined;
      }
    },
  };
};

const compiledManager = (mod: any) =>
  (CompiledContract.make as any)('aa00008-phase4-final-manager', mod.Contract).pipe(
    (CompiledContract as any).withWitnesses({
      localOwnerSecret: (ctx: any): [any, Uint8Array] => [ctx.privateState, ctx.privateState.ownerSecret],
    }),
    (CompiledContract as any).withCompiledFileAssets(MANAGER_ZK),
  );

const compiledMinter = (mod: any) =>
  (CompiledContract.make as any)('aa00008-phase4-inherited-minter', mod.Contract).pipe(
    (CompiledContract as any).withVacantWitnesses,
    (CompiledContract as any).withCompiledFileAssets(MINTER_ZK),
  );

const rawCall = async (
  providers: any,
  compiledContract: any,
  contractAddress: string,
  circuitId: string,
  args: unknown[],
  mappings?: Map<unknown, unknown>,
) => (createUnprovenCallTx as any)(providers, {
  compiledContract,
  contractAddress,
  circuitId,
  args,
  ...(circuitId === 'execute' || circuitId.startsWith('deposit') ? { privateStateId: 'manager' } : {}),
  ...(mappings ? { additionalCoinEncPublicKeyMappings: mappings } : {}),
});

const stateBytes = (state: any): Uint8Array => {
  if (typeof state?.data?.serialize === 'function') return state.data.serialize();
  if (typeof state?.serialize === 'function') return state.serialize();
  throw new Error('contract state has no serializable state value');
};

const mapOf = <V>(items: Iterable<[Uint8Array, V]>, render: (value: V) => unknown) =>
  Object.fromEntries([...items].map(([key, value]) => [hex(key), render(value)] as [string, unknown]).sort((left, right) => left[0].localeCompare(right[0])));

const readState = async (providers: any, mod: any, address: string) => {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) throw new Error(`Manager state unavailable at ${address}`);
  const raw = stateBytes(state);
  const view: any = mod.ledger(state.data);
  return {
    rawBytes: raw.length,
    rawSha256: sha256(raw),
    accounts: [...view.accounts].map((value: Uint8Array) => hex(value)).sort(),
    accountModes: mapOf(view.accountModes, (value) => String(value)),
    evmOwners: mapOf(view.evmOwners, (value) => hex(value as Uint8Array)),
    evmNonces: mapOf(view.evmNonces, (value) => String(value)),
    shieldedBalances: mapOf(view.shieldedBalances, (value) => String(value)),
    unshieldedBalances: mapOf(view.unshieldedBalances, (value) => String(value)),
    pools: mapOf(view.pools, (value: any) => ({
      nonce: hex(value.nonce), color: hex(value.color), value: String(value.value),
      ...(value.merkleTreeIndex === undefined ? {} : { merkleTreeIndex: String(value.merkleTreeIndex) }),
    })),
    sizes: {
      accounts: String(view.accounts.size()),
      accountModes: String(view.accountModes.size()),
      evmOwners: String(view.evmOwners.size()),
      evmNonces: String(view.evmNonces.size()),
      shieldedBalances: String(view.shieldedBalances.size()),
      unshieldedBalances: String(view.unshieldedBalances.size()),
      pools: String(view.pools.size()),
    },
    deploymentDomain: hex(view.deploymentDomain),
  };
};

const waitState = async (
  providers: any,
  mod: any,
  address: string,
  predicate: (state: Awaited<ReturnType<typeof readState>>) => boolean,
  label: string,
) => {
  const deadline = Date.now() + 300_000;
  for (;;) {
    const state = await readState(providers, mod, address);
    if (predicate(state)) return state;
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${label}: ${json(state)}`);
    await sleep(2_000);
  }
};

const gql = async (query: string, variables: Record<string, unknown> = {}) => {
  const response = await fetch(process.env.LANE_INDEXER_HTTP_URL!, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }),
  });
  const body: any = await response.json();
  if (body.errors) throw new Error(`indexer GraphQL error: ${json(body.errors)}`);
  return body.data;
};

const receipt = async (address: string) => {
  const data = await gql(`query Receipt($address: HexEncoded!) {
    contractAction(address: $address) {
      address transaction { id hash block { height hash timestamp } }
    }
  }`, { address });
  return data.contractAction;
};

const managerAddressHex = (address: string): Hex32 => `0x${cleanHex(address)}` as Hex32;
const futureDeadline = () => BigInt(Math.floor(Date.now() / 1000) + 1800);

const main = async () => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  mkdirSync(EVIDENCE, { recursive: true });
  const managerMod: any = await import(`${MANAGER_ZK}/contract/index.js`);
  const minterMod: any = await import(`${MINTER_ZK}/contract/index.js`);
  const registry = await nodeZkConfigRegistry(join(ROOT, 'generated-zk'));
  const privateDir = mkdtempSync(join(tmpdir(), 'aa00008-phase4-'));
  const proofRecords: ProofRecord[] = [];
  const proof = await capturedProofProvider(registry, proofRecords);
  const opened: Party[] = [];
  const report: any = {
    phase: 4,
    lane: 'whole rc5 ZKIR-v3, final K=20 Manager',
    startedAt: new Date().toISOString(),
    pins: {
      managerIndexSha256: MANAGER_INDEX_SHA256,
      proofImage: PROOF_IMAGE,
      nodeImage: 'midnightntwrk/midnight-node@sha256:caf93d6f9fb3630c906ef3e714c151655377f3d28f907d17545de1870514da2e',
      indexerImage: 'midnightntwrk/indexer-standalone@sha256:6c01bb4301ffea9372cf9da90000259327c43b8281ffb42c141838993fc2045a',
      managerArtifact: '/work/harness/generated-zk/manager',
      minterArtifact: '/work/harness/generated-zk/minter',
    },
    registrations: [], deposits: [], positives: [], negatives: [], concurrency: {}, proofRecords,
  };
  const checkpoint = () => writeFileSync(RESULTS, `${json(report)}\n`);
  const attachProof = (providers: any) => {
    providers.proofProvider = { proveTx: (tx: any) => proof.prove(providers.__phase4Label ?? 'unlabelled', tx) };
    return providers;
  };
  const label = (providers: any, value: string) => { providers.__phase4Label = value; return providers; };

  try {
    let genesis = await openParty('phase4-genesis-1', SEEDS.genesis);
    const fee = await openParty('phase4-fee', SEEDS.feePayer);
    const fee2 = await openParty('phase4-fee2', '00000000000000000000000000000000000000000000000000000000000000f2');
    const holder = await openParty('phase4-holder-mint', SEEDS.ownerN);
    const takerMint = await openParty('phase4-taker-mint', SEEDS.ownerT);
    const receiver = await openParty('phase4-receiver', SEEDS.ownerM);
    opened.push(genesis, fee, fee2, holder, takerMint, receiver);
    await syncedState(genesis);
    const fundingTargets = [fee, fee2, holder, takerMint];
    for (let index = 0; index < fundingTargets.length; index += 1) {
      const target = fundingTargets[index]!;
      await fundWithNight(genesis, target, units(2_000_000n), { arriveTimeoutMs: 300_000, changeTimeoutMs: 300_000 });
      await registerForDust(target);
      if (index + 1 < fundingTargets.length) {
        await closeParty(genesis);
        opened.splice(opened.indexOf(genesis), 1);
        genesis = await openParty(`phase4-genesis-${index + 2}`, SEEDS.genesis);
        opened.push(genesis);
        await syncedState(genesis);
      }
    }

    const managerProviders = attachProof(makeProviders(fee, 'manager', privateDir, MANAGER_ZK));
    const managerCompiled = compiledManager(managerMod);
    const deploymentDomain = randomBytes(32);
    let deployCost: any;
    const submitOriginal = managerProviders.midnightProvider.submitTx;
    managerProviders.midnightProvider.submitTx = async (tx: any) => {
      deployCost ??= tx.cost((ledger as any).LedgerParameters.initialParameters(), true);
      return submitOriginal(tx);
    };
    const deployed: any = await withDustRetry(fee, 'deploy final Manager', () => deployContract(managerProviders, {
      compiledContract: managerCompiled,
      args: [deploymentDomain],
      privateStateId: 'manager',
      initialPrivateState: { ownerSecret: zero32() },
    } as any));
    const managerAddress = String(deployed.deployTxData.public.contractAddress);
    const managerHex = managerAddressHex(managerAddress);
    const managerBytes = hexToBytes(managerHex, 32);
    managerProviders.privateStateProvider.setContractAddress(managerAddress);
    report.deployment = {
      address: managerAddress,
      txId: String(deployed.deployTxData.public.txId ?? deployed.deployTxData.public.txHash ?? ''),
      public: deployed.deployTxData.public,
      cost: deployCost,
      receipt: await receipt(managerAddress),
      domain: hex(deploymentDomain),
    };
    await waitState(managerProviders, managerMod, managerAddress, () => true, 'Manager deployment index');
    checkpoint();

    const submitBuilt = async (
      payer: Party,
      providers: any,
      compiled: any,
      address: string,
      circuit: string,
      args: unknown[],
      actionLabel: string,
      mappings?: Map<unknown, unknown>,
    ) => withDustRetry(payer, actionLabel, async () => {
      label(providers, actionLabel);
      const built = await rawCall(providers, compiled, address, circuit, args, mappings);
      const proven = await providers.proofProvider.proveTx(built.private.unprovenTx);
      const balanced = await providers.walletProvider.balanceTx(proven);
      return String(await providers.midnightProvider.submitTx(balanced));
    });

    const inertPrivateA = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318' as Hex32;
    const inertPrivateB = '0x8f2a5594905fc58a2a00f6d49f12f6f57465908f467f5c27d9c6b76e4d0c1f29' as Hex32;
    const evmPrivate = '0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex32;
    const evmDestPrivate = '0x5de4111afa1c4b3daadb3f4b3e1f7c5f00e0a43c3b527050c607b35e39e4b7b1' as Hex32;
    const evmOwner = addressForPrivateKey(evmPrivate);
    const evmDestOwner = addressForPrivateKey(evmDestPrivate);

    const prepare = (action: Eip712Action, key: Hex32 = evmPrivate, domain: Hex32 = h32(deploymentDomain)) => {
      const walletSignature = metamaskSign(key, action, domain);
      return { ...prepareEvmExecute(action, domain, walletSignature, { requireLowS: false }), walletSignature };
    };
    const execute = async (actionLabel: string, payload: any, auth: { signature: any; point: any }, secret: Uint8Array) => {
      await managerProviders.privateStateProvider.set('manager', { ownerSecret: secret });
      const txId = await submitBuilt(
        fee, managerProviders, managerCompiled, managerAddress, 'execute',
        [payload, auth.signature, auth.point], actionLabel,
      );
      return { txId, receipt: await receipt(managerAddress) };
    };

    // Native registrations use deliberately different valid-but-ignored EVM transports.
    const nativeSecrets = [randomBytes(32), randomBytes(32)];
    const registeredNative: Uint8Array[] = [];
    for (let index = 0; index < 2; index += 1) {
      const before = await readState(managerProviders, managerMod, managerAddress);
      const fakeOwner = index === 0 ? addressForPrivateKey(inertPrivateA) : addressForPrivateKey(inertPrivateB);
      const fakeSalt = randomBytes(32);
      const fakeAccount = deriveAccountId(managerHex, fakeOwner, h32(fakeSalt));
      const fakeAction: Eip712Action = {
        primaryType: 'RegisterEvmAccount', manager: managerHex, accountId: fakeAccount,
        owner: fakeOwner, accountSalt: h32(fakeSalt), validUntil: futureDeadline(),
      };
      const dummy = prepare(fakeAction, index === 0 ? inertPrivateA : inertPrivateB);
      const result = await execute(
        `register-native-${index + 1}`, emptyExecutePayload(),
        { signature: dummy.signature, point: dummy.point }, nativeSecrets[index]!,
      );
      const after = await waitState(
        managerProviders, managerMod, managerAddress,
        (state) => Number(state.sizes.accounts) === Number(before.sizes.accounts) + 1,
        `native registration ${index + 1}`,
      );
      const added = after.accounts.filter((account) => !before.accounts.includes(account));
      if (added.length !== 1 || after.accountModes[added[0]!] !== '0') throw new Error('native registration mode/account mismatch');
      registeredNative.push(Buffer.from(added[0]!, 'hex'));
      report.registrations.push({ mode: 'native', account: added[0], dummyTransportSigner: dummy.signer, ...result, state: after });
      checkpoint();
    }
    const [nativeSource, nativeDest] = registeredNative as [Uint8Array, Uint8Array];

    const registerEvm = async (key: Hex32, owner: Hex20, tag: string) => {
      const salt = randomBytes(32);
      const accountId = deriveAccountId(managerHex, owner, h32(salt));
      const generated = managerMod.pureCircuits.evmAccountIdFor(managerBytes, hexToBytes(owner, 20), salt);
      if (h32(generated) !== accountId) throw new Error(`${tag}: generated/off-chain account ID mismatch`);
      const action: Eip712Action = {
        primaryType: 'RegisterEvmAccount', manager: managerHex, accountId, owner,
        accountSalt: h32(salt), validUntil: futureDeadline(),
      };
      const prepared = prepare(action, key);
      const result = await execute(
        `register-evm-${tag}`, prepared.payload,
        { signature: prepared.signature, point: prepared.point }, randomBytes(32),
      );
      const after = await waitState(
        managerProviders, managerMod, managerAddress,
        (state) => state.evmNonces[cleanHex(accountId)] === '0', `${tag} EVM registration`,
      );
      report.registrations.push({ mode: 'evm', account: cleanHex(accountId), owner, digest: prepared.digest, ...result, state: after });
      checkpoint();
      return hexToBytes(accountId, 32);
    };
    const evmSource = await registerEvm(evmPrivate, evmOwner, 'source');
    const evmDest = await registerEvm(evmDestPrivate, evmDestOwner, 'dest');

    // Manager deployed before any issuer; now deploy two byte-identical inherited Minters.
    const minterProviders = attachProof(makeProviders(fee, 'minter', privateDir, MINTER_ZK));
    const minterCompiled = compiledMinter(minterMod);
    const deployMinter = async (tagText: string) => {
      const tag = zero32(); tag.set(Buffer.from(tagText));
      const item: any = await withDustRetry(fee, `deploy Minter ${tagText}`, () => deployContract(minterProviders, {
        compiledContract: minterCompiled, args: [tag],
      } as any));
      const address = String(item.deployTxData.public.contractAddress);
      const shielded = resultOf<Uint8Array>(await withDustRetry(fee, `${tagText}.shieldedColor`, () => item.callTx.shieldedColor()));
      const unshielded = resultOf<Uint8Array>(await withDustRetry(fee, `${tagText}.unshieldedColor`, () => item.callTx.unshieldedColor()));
      return { item, address, shielded, unshielded, receipt: await receipt(address) };
    };
    const issuerA = await deployMinter('PHASE4-A');
    const issuerB = await deployMinter('PHASE4-B');
    const colorA = issuerA.shielded;
    const unshieldedA = issuerA.unshielded;
    const colorB = issuerB.shielded;
    report.issuers = {
      A: { address: issuerA.address, shielded: hex(colorA), unshielded: hex(unshieldedA), receipt: issuerA.receipt },
      B: { address: issuerB.address, shielded: hex(colorB), receipt: issuerB.receipt },
    };
    checkpoint();

    const shieldedRecipient = (party: Party) => {
      const key = party.shieldedSecretKeys.coinPublicKey;
      return {
        union: { is_left: true, left: { bytes: asBytes(key) }, right: { bytes: zero32() } },
        mappings: new Map([[key, party.shieldedSecretKeys.encryptionPublicKey]]),
      };
    };
    const unshieldedRecipient = (address: string) => ({
      is_left: false, left: { bytes: zero32() }, right: { bytes: Buffer.from(cleanHex(address), 'hex') },
    });
    const holderShield = shieldedRecipient(holder);
    await submitBuilt(
      fee, minterProviders, minterCompiled, issuerA.address, 'mintShieldedTo',
      [80n, randomBytes(32), holderShield.union], 'mint-holder-shielded-A', holderShield.mappings,
    );
    const holderAddress = String((await (holder.wallet as any).unshielded.getAddress()).hexString).toLowerCase();
    await submitBuilt(
      fee, minterProviders, minterCompiled, issuerA.address, 'mintUnshieldedTo',
      [80n, unshieldedRecipient(holderAddress)], 'mint-holder-unshielded-A',
    );
    const takerShield = shieldedRecipient(takerMint);
    await submitBuilt(
      fee, minterProviders, minterCompiled, issuerB.address, 'mintShieldedTo',
      [20n, randomBytes(32), takerShield.union], 'mint-taker-shielded-B', takerShield.mappings,
    );
    await waitFor(holder, (state: any) => BigInt(state?.shielded?.balances?.[hex(colorA)] ?? 0n) >= 80n, 'holder shielded A mint', 300_000);
    await waitFor(holder, (state: any) => BigInt(state?.unshielded?.balances?.[hex(unshieldedA)] ?? 0n) >= 80n, 'holder unshielded A mint', 300_000);
    await waitFor(takerMint, (state: any) => BigInt(state?.shielded?.balances?.[hex(colorB)] ?? 0n) >= 20n, 'taker shielded B mint', 300_000);
    await closeParty(holder); opened.splice(opened.indexOf(holder), 1);
    await closeParty(takerMint); opened.splice(opened.indexOf(takerMint), 1);

    const accountBalance = (state: Awaited<ReturnType<typeof readState>>, family: 'shielded' | 'unshielded', account: Uint8Array, color: Uint8Array) => {
      const key = family === 'shielded'
        ? managerMod.pureCircuits.shieldedKey(account, color)
        : managerMod.pureCircuits.unshieldedKey(account, color);
      return BigInt(String((family === 'shielded' ? state.shieldedBalances : state.unshieldedBalances)[hex(key as Uint8Array)] ?? '0'));
    };
    const freshDepositor = async (name: string) => {
      const party = await openParty(name, SEEDS.ownerN);
      await syncedState(party);
      const providers = attachProof(makeProviders(party, `manager-${name}`, privateDir, MANAGER_ZK));
      providers.privateStateProvider.setContractAddress(managerAddress);
      await providers.privateStateProvider.set('manager', { ownerSecret: zero32() });
      return { party, providers };
    };
    for (const [mode, account] of [['native', nativeSource], ['evm', evmSource]] as const) {
      const dep = await freshDepositor(`deposit-shielded-${mode}`);
      try {
        const txId = await submitBuilt(
          dep.party, dep.providers, managerCompiled, managerAddress, 'depositShielded',
          [{ nonce: randomBytes(32), color: colorA, value: 30n }, account], `deposit-shielded-${mode}`,
        );
        const state = await waitState(
          managerProviders, managerMod, managerAddress,
          (value) => accountBalance(value, 'shielded', account, colorA) === 30n,
          `${mode} shielded deposit`,
        );
        report.deposits.push({ mode, family: 'shielded', amount: '30', txId, receipt: await receipt(managerAddress), state });
      } finally { await closeParty(dep.party); }
      checkpoint();
      const depU = await freshDepositor(`deposit-unshielded-${mode}`);
      try {
        const txId = await submitBuilt(
          depU.party, depU.providers, managerCompiled, managerAddress, 'depositUnshielded',
          [unshieldedA, 30n, account], `deposit-unshielded-${mode}`,
        );
        const state = await waitState(
          managerProviders, managerMod, managerAddress,
          (value) => accountBalance(value, 'unshielded', account, unshieldedA) === 30n,
          `${mode} unshielded deposit`,
        );
        report.deposits.push({ mode, family: 'unshielded', amount: '30', txId, receipt: await receipt(managerAddress), state });
      } finally { await closeParty(depU.party); }
      checkpoint();
    }

    const receiverCoinKey = asBytes(receiver.shieldedSecretKeys.coinPublicKey);
    const receiverAddress = String((await (receiver.wallet as any).unshielded.getAddress()).hexString).toLowerCase();
    const dummyForNative = (index: number) => {
      const key = index % 2 === 0 ? inertPrivateA : inertPrivateB;
      const owner = addressForPrivateKey(key);
      const salt = randomBytes(32);
      const action: Eip712Action = {
        primaryType: 'RegisterEvmAccount', manager: managerHex,
        accountId: deriveAccountId(managerHex, owner, h32(salt)), owner,
        accountSalt: h32(salt), validUntil: futureDeadline(),
      };
      const p = prepare(action, key);
      return { signature: p.signature, point: p.point, signer: p.signer, digest: p.digest };
    };

    const nativePayload = (selector: bigint, overrides: Record<string, unknown>) => ({
      ...emptyExecutePayload(), selector, authMode: 0n, account: nativeSource, ...overrides,
    });
    const evmAction = (primaryType: PrimaryType, nonce: bigint, overrides: Record<string, unknown>): Eip712Action => ({
      primaryType, manager: managerHex, accountId: h32(evmSource), owner: evmOwner,
      nonce, validUntil: futureDeadline(), ...overrides,
    } as Eip712Action);

    const positiveSubmit = async (
      mode: 'native' | 'evm', actionName: string, payload: any,
      auth: any, secret: Uint8Array, before: Awaited<ReturnType<typeof readState>>,
    ) => {
      const result = await execute(`${mode}-${actionName}`, payload, auth, secret);
      const state = await waitState(
        managerProviders, managerMod, managerAddress,
        (value) => value.rawSha256 !== before.rawSha256,
        `${mode} ${actionName} state transition`,
      );
      report.positives.push({ mode, action: actionName, ...result, state });
      checkpoint();
      return state;
    };

    const runMode = async (mode: 'native' | 'evm') => {
      const source = mode === 'native' ? nativeSource : evmSource;
      const destination = mode === 'native' ? nativeDest : evmDest;
      let nonce = 0n;
      const build = (
        name: PrimaryType,
        actionFields: Record<string, unknown>,
        nativeFields: Record<string, unknown> = actionFields,
      ) => {
        if (mode === 'native') {
          const selectors: Record<PrimaryType, bigint> = {
            RegisterEvmAccount: 1n, WithdrawShielded: 2n, WithdrawUnshielded: 3n,
            TransferInternalShielded: 4n, TransferInternalUnshielded: 5n, OpenSwapShielded: 6n,
          };
          const dummy = dummyForNative(Number(selectors[name]));
          return {
            payload: nativePayload(selectors[name]!, nativeFields),
            auth: { signature: dummy.signature, point: dummy.point },
            independence: { unusedEvmSigner: dummy.signer, unusedEvmDigest: dummy.digest },
          };
        }
        const action = evmAction(name, nonce, actionFields);
        const prepared = prepare(action);
        nonce += 1n;
        return {
          payload: prepared.payload,
          auth: { signature: prepared.signature, point: prepared.point },
          independence: { unusedNativeWitnessSha256: sha256(randomBytes(32)), digest: prepared.digest },
        };
      };
      const secretFor = () => mode === 'native' ? nativeSecrets[0]! : randomBytes(32);

      let before = await readState(managerProviders, managerMod, managerAddress);
      let item = build('WithdrawShielded', {
        color: h32(colorA), amount: 2n, recipientKind: 0n, recipient: h32(receiverCoinKey),
      }, {
        primaryColor: colorA, primaryAmount: 2n, recipientKind: 0n, recipient: receiverCoinKey,
      });
      await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretFor() });
      const withdrawalMappings = new Map([[receiver.shieldedSecretKeys.coinPublicKey, receiver.shieldedSecretKeys.encryptionPublicKey]]);
      label(managerProviders, `${mode}-withdraw-shielded`);
      const builtWithdraw = await rawCall(managerProviders, managerCompiled, managerAddress, 'execute', [item.payload, item.auth.signature, item.auth.point], withdrawalMappings);
      const provenWithdraw = await managerProviders.proofProvider.proveTx(builtWithdraw.private.unprovenTx);
      const balancedWithdraw = await managerProviders.walletProvider.balanceTx(provenWithdraw);
      const withdrawTx = String(await managerProviders.midnightProvider.submitTx(balancedWithdraw));
      let state = await waitState(managerProviders, managerMod, managerAddress, (value) => value.rawSha256 !== before.rawSha256, `${mode} shielded withdraw`);
      report.positives.push({ mode, action: 'withdraw-shielded', txId: withdrawTx, receipt: await receipt(managerAddress), independence: item.independence, state }); checkpoint();

      before = state;
      item = build('WithdrawUnshielded', {
        color: h32(unshieldedA), amount: 2n, recipientKind: 1n, recipient: `0x${cleanHex(receiverAddress)}` as Hex32,
      }, {
        primaryColor: unshieldedA, primaryAmount: 2n, recipientKind: 1n,
        recipient: Buffer.from(cleanHex(receiverAddress), 'hex'),
      });
      state = await positiveSubmit(mode, 'withdraw-unshielded', item.payload, item.auth, secretFor(), before);
      report.positives.at(-1).independence = item.independence;

      before = state;
      item = build('TransferInternalShielded', {
        toAccountId: h32(destination), color: h32(colorA), amount: 2n,
      }, {
        primaryColor: colorA, primaryAmount: 2n, toAccount: destination,
      });
      state = await positiveSubmit(mode, 'transfer-internal-shielded', item.payload, item.auth, secretFor(), before);
      report.positives.at(-1).independence = item.independence;

      before = state;
      item = build('TransferInternalUnshielded', {
        toAccountId: h32(destination), color: h32(unshieldedA), amount: 2n,
      }, {
        primaryColor: unshieldedA, primaryAmount: 2n, toAccount: destination,
      });
      state = await positiveSubmit(mode, 'transfer-internal-unshielded', item.payload, item.auth, secretFor(), before);
      report.positives.at(-1).independence = item.independence;

      // Build/prove/export only; the independent taker imports exact raw bytes and settles it.
      before = state;
      const wantNonce = randomBytes(32);
      item = build('OpenSwapShielded', {
        giveColor: h32(colorA), giveAmount: 2n, recipientKind: 0n, recipient: ZERO_32,
        wantNonce: h32(wantNonce), wantColor: h32(colorB), wantAmount: 3n, creditAccountId: h32(source),
      }, {
        primaryColor: colorA, primaryAmount: 2n, recipientKind: 0n, recipient: zero32(),
        wantNonce, wantColor: colorB, wantAmount: 3n, creditAccount: source,
      });
      await managerProviders.privateStateProvider.set('manager', { ownerSecret: secretFor() });
      label(managerProviders, `${mode}-open-swap-prove-export`);
      const built = await rawCall(managerProviders, managerCompiled, managerAddress, 'execute', [item.payload, item.auth.signature, item.auth.point]);
      const proven = await managerProviders.proofProvider.proveTx(built.private.unprovenTx);
      const placement = requireOpenPlacement(proven, {
        [`shielded:${hex(colorA)}`]: '2', [`shielded:${hex(colorB)}`]: '-3',
      });
      const raw: Uint8Array = proven.serialize();
      const rawPath = join(EVIDENCE, `${mode}-open-swap-proven-unbound.bin`);
      writeFileSync(rawPath, raw);
      const imported: any = (ledger as any).Transaction.deserialize('signature', 'proof', 'pre-binding', raw);
      const reserialized: Uint8Array = imported.serialize();
      if (Buffer.compare(Buffer.from(raw), Buffer.from(reserialized)) !== 0) throw new Error(`${mode} offer round trip changed bytes`);
      const taker = await openParty(`phase4-independent-taker-${mode}`, SEEDS.ownerT);
      await syncedState(taker);
      try {
        await waitFor(taker, (walletState: any) => BigInt(walletState?.shielded?.balances?.[hex(colorB)] ?? 0n) >= 3n, `${mode} taker B readiness`, 300_000);
        const settlement = await settleAsTaker(taker, imported, 'unbound', { label: `phase4-${mode}-open-swap` });
        if (!settlement.ok) throw new Error(`${mode} independent settlement failed: ${json(settlement)}`);
        state = await waitState(managerProviders, managerMod, managerAddress, (value) => value.rawSha256 !== before.rawSha256, `${mode} open swap settlement`);
        report.positives.push({
          mode, action: 'open-swap-shielded', export: { path: rawPath, bytes: raw.length, sha256: sha256(raw), roundTripByteIdentical: true },
          placement, settlement, receipt: await receipt(managerAddress), independence: item.independence, state,
        });
      } finally { await closeParty(taker); }
      checkpoint();
    };

    await runMode('native');
    await runMode('evm');

    // Every refusal is checked against the serialized contract state and latest indexed action.
    const expectRefusal = async (name: string, fn: () => Promise<unknown>) => {
      const before = await readState(managerProviders, managerMod, managerAddress);
      const beforeReceipt = await receipt(managerAddress);
      let message = '';
      try {
        await fn();
        throw new Error(`${name} unexpectedly succeeded`);
      } catch (error) {
        message = errorText(error);
        if (message.includes('unexpectedly succeeded')) throw error;
      }
      const after = await readState(managerProviders, managerMod, managerAddress);
      const afterReceipt = await receipt(managerAddress);
      const noState = after.rawSha256 === before.rawSha256 && json(after) === json(before);
      const noAction = json(afterReceipt) === json(beforeReceipt);
      if (!noState || !noAction) throw new Error(`${name}: refusal changed state/action`);
      report.negatives.push({ name, refused: true, message, noState, noAction, beforeSha256: before.rawSha256, afterSha256: after.rawSha256 });
      checkpoint();
    };
    const tryBuild = async (name: string, payload: any, signature: any, point: any, secret = randomBytes(32)) => {
      await managerProviders.privateStateProvider.set('manager', { ownerSecret: secret });
      label(managerProviders, `negative-${name}`);
      await rawCall(managerProviders, managerCompiled, managerAddress, 'execute', [payload, signature, point]);
    };
    const current = await readState(managerProviders, managerMod, managerAddress);
    const nextNonce = BigInt(String(current.evmNonces[hex(evmSource)]!));
    const baseAction = evmAction('TransferInternalShielded', nextNonce, {
      toAccountId: h32(evmDest), color: h32(colorA), amount: 1n,
    });
    const basePrepared = prepare(baseAction);
    const nativeBase = nativePayload(4n, { primaryColor: colorA, primaryAmount: 1n, toAccount: nativeDest });
    const nativeDummy = dummyForNative(9);

    await expectRefusal('wrong-native-secret', () => tryBuild('wrong-native-secret', nativeBase, nativeDummy.signature, nativeDummy.point, randomBytes(32)));
    const wrongSigner = prepare(baseAction, inertPrivateA);
    await expectRefusal('wrong-signer', () => tryBuild('wrong-signer', wrongSigner.payload, wrongSigner.signature, wrongSigner.point));
    const wrongDomain = prepare(baseAction, evmPrivate, h32(randomBytes(32)));
    await expectRefusal('wrong-domain', () => tryBuild('wrong-domain', wrongDomain.payload, wrongDomain.signature, wrongDomain.point));
    const wrongTypeAction = evmAction('TransferInternalUnshielded', nextNonce, {
      toAccountId: h32(evmDest), color: h32(colorA), amount: 1n,
    });
    const wrongType = prepare(wrongTypeAction);
    await expectRefusal('wrong-type', () => tryBuild('wrong-type', basePrepared.payload, wrongType.signature, wrongType.point));
    const wrongManagerAction = { ...baseAction, manager: h32(randomBytes(32)) } as Eip712Action;
    const wrongManager = prepare(wrongManagerAction);
    await expectRefusal('wrong-manager', () => tryBuild('wrong-manager', basePrepared.payload, wrongManager.signature, wrongManager.point));
    const unknownAccount = randomBytes(32);
    const wrongAccountAction = { ...baseAction, accountId: h32(unknownAccount) } as Eip712Action;
    const wrongAccount = prepare(wrongAccountAction);
    await expectRefusal('wrong-account', () => tryBuild('wrong-account', wrongAccount.payload, wrongAccount.signature, wrongAccount.point));
    await expectRefusal('wrong-action-field', () => tryBuild('wrong-action-field', { ...basePrepared.payload, primaryAmount: 2n }, basePrepared.signature, basePrepared.point));
    await expectRefusal('off-curve-point', () => tryBuild('off-curve-point', basePrepared.payload, basePrepared.signature, { x: 1n, y: 1n, identity: false }));
    await expectRefusal('identity-point', () => tryBuild('identity-point', basePrepared.payload, basePrepared.signature, { x: 0n, y: 0n, identity: true }));
    await expectRefusal('zero-r-scalar', () => tryBuild('zero-r-scalar', basePrepared.payload, { ...(basePrepared.signature as any), r: 0n }, basePrepared.point));
    await expectRefusal('curve-order-r-scalar', () => tryBuild('curve-order-r-scalar', basePrepared.payload, { ...(basePrepared.signature as any), r: SECP256K1_N }, basePrepared.point));
    await expectRefusal('curve-order-s-scalar', () => tryBuild('curve-order-s-scalar', basePrepared.payload, { ...(basePrepared.signature as any), s: SECP256K1_N }, basePrepared.point));
    await expectRefusal('width-overflow-r-scalar', () => tryBuild('width-overflow-r-scalar', basePrepared.payload, { ...(basePrepared.signature as any), r: 1n << 256n }, basePrepared.point));
    const highSignature = highSTwin(metamaskSign(evmPrivate, { ...baseAction, nonce: nextNonce - 1n } as Eip712Action, h32(deploymentDomain)));
    const highReplay = prepareEvmExecute({ ...baseAction, nonce: nextNonce - 1n } as Eip712Action, h32(deploymentDomain), highSignature, { requireLowS: false });
    await expectRefusal('high-s-twin-replay', () => tryBuild('high-s-twin-replay', highReplay.payload, highReplay.signature, highReplay.point));
    const staleAction = { ...baseAction, nonce: nextNonce - 1n } as Eip712Action;
    const stale = prepare(staleAction);
    await expectRefusal('stale-nonce', () => tryBuild('stale-nonce', stale.payload, stale.signature, stale.point));
    const futureAction = { ...baseAction, nonce: nextNonce + 1n } as Eip712Action;
    const future = prepare(futureAction);
    await expectRefusal('future-nonce', () => tryBuild('future-nonce', future.payload, future.signature, future.point));
    const overflowAction = { ...baseAction, nonce: MAX_U64 } as Eip712Action;
    const overflow = prepare(overflowAction);
    await expectRefusal('overflow-nonce', () => tryBuild('overflow-nonce', overflow.payload, overflow.signature, overflow.point));
    const expiredAction = { ...baseAction, validUntil: BigInt(Math.floor(Date.now() / 1000) - 1) } as Eip712Action;
    const expired = prepare(expiredAction);
    await expectRefusal('expired-deadline', () => tryBuild('expired-deadline', expired.payload, expired.signature, expired.point));
    const horizonAction = { ...baseAction, validUntil: BigInt(Math.floor(Date.now() / 1000) + 7200) } as Eip712Action;
    const horizon = prepare(horizonAction);
    await expectRefusal('deadline-over-horizon', () => tryBuild('deadline-over-horizon', horizon.payload, horizon.signature, horizon.point));
    await expectRefusal('evm-auth-on-native-account', () => tryBuild('evm-auth-on-native-account', { ...basePrepared.payload, account: nativeSource }, basePrepared.signature, basePrepared.point));
    await expectRefusal('native-auth-on-evm-account', () => tryBuild('native-auth-on-evm-account', { ...nativeBase, account: evmSource }, nativeDummy.signature, nativeDummy.point, nativeSecrets[0]));
    await expectRefusal('noncanonical-union', () => tryBuild('noncanonical-union', { ...basePrepared.payload, wantAmount: 1n }, basePrepared.signature, basePrepared.point));
    await expectRefusal('uint128-width-overflow', () => tryBuild('uint128-width-overflow', { ...basePrepared.payload, primaryAmount: MAX_U128 + 1n }, basePrepared.signature, basePrepared.point));
    const poorNative = { ...nativeBase, account: nativeDest, primaryAmount: 999n, toAccount: nativeSource };
    await expectRefusal('account-poor-pool-rich', () => tryBuild('account-poor-pool-rich', poorNative, nativeDummy.signature, nativeDummy.point, nativeSecrets[1]));
    const missingColor = randomBytes(32);
    await expectRefusal('missing-pool-color', () => tryBuild('missing-pool-color', { ...nativeBase, primaryColor: missingColor }, nativeDummy.signature, nativeDummy.point, nativeSecrets[0]));
    await expectRefusal('insufficient-account-balance', () => tryBuild('insufficient-account-balance', { ...nativeBase, primaryAmount: 999n }, nativeDummy.signature, nativeDummy.point, nativeSecrets[0]));
    await expectRefusal('direct-old-withdraw-bypass', async () => {
      if ((managerMod.Contract as any).prototype?.circuits?.withdrawShielded !== undefined) throw new Error('old circuit unexpectedly exposed');
      await rawCall(managerProviders, managerCompiled, managerAddress, 'withdrawShielded', [colorA, 1n, { is_left: true, left: { bytes: receiverCoinKey }, right: { bytes: zero32() } }]);
    });

    // Two separately proved actions from the same state and nonce; independently funded fee wallets
    // submit concurrently. Exactly zero or one effect is legal, never two.
    const concurrencyBefore = await readState(managerProviders, managerMod, managerAddress);
    const concurrentNonce = BigInt(String(concurrencyBefore.evmNonces[hex(evmSource)]!));
    const concurrentActions = [1n, 2n].map((amount) => evmAction('TransferInternalShielded', concurrentNonce, {
      toAccountId: h32(evmDest), color: h32(colorA), amount,
    }));
    const concurrentProviders = [managerProviders, attachProof(makeProviders(fee2, 'manager-concurrent-2', privateDir, MANAGER_ZK))];
    concurrentProviders[1]!.privateStateProvider.setContractAddress(managerAddress);
    await concurrentProviders[1]!.privateStateProvider.set('manager', { ownerSecret: randomBytes(32) });
    const concurrentBuilt = [];
    for (let index = 0; index < 2; index += 1) {
      const prepared = prepare(concurrentActions[index]!);
      label(concurrentProviders[index]!, `concurrent-same-nonce-${index + 1}`);
      const built = await rawCall(concurrentProviders[index]!, managerCompiled, managerAddress, 'execute', [prepared.payload, prepared.signature, prepared.point]);
      const proven = await concurrentProviders[index]!.proofProvider.proveTx(built.private.unprovenTx);
      const balanced = await concurrentProviders[index]!.walletProvider.balanceTx(proven);
      concurrentBuilt.push(balanced);
    }
    const submissions = await Promise.allSettled([
      managerProviders.midnightProvider.submitTx(concurrentBuilt[0]),
      concurrentProviders[1]!.midnightProvider.submitTx(concurrentBuilt[1]),
    ]);
    await sleep(8_000);
    const concurrencyAfter = await readState(managerProviders, managerMod, managerAddress);
    const nonceDelta = BigInt(String(concurrencyAfter.evmNonces[hex(evmSource)]!)) - concurrentNonce;
    const sourceDelta = accountBalance(concurrencyBefore, 'shielded', evmSource, colorA) - accountBalance(concurrencyAfter, 'shielded', evmSource, colorA);
    if (nonceDelta < 0n || nonceDelta > 1n || (nonceDelta === 0n && sourceDelta !== 0n) || (nonceDelta === 1n && sourceDelta !== 1n && sourceDelta !== 2n)) {
      throw new Error(`concurrent same-nonce violated at-most-one: nonceDelta=${nonceDelta}, sourceDelta=${sourceDelta}`);
    }
    report.concurrency = {
      nonce: String(concurrentNonce), submissions: submissions.map((item) => item.status === 'fulfilled'
        ? { status: item.status, value: String(item.value) }
        : { status: item.status, reason: errorText(item.reason) }),
      before: concurrencyBefore, after: concurrencyAfter, nonceDelta: String(nonceDelta), sourceDelta: String(sourceDelta), atMostOneEffect: true,
      receipt: await receipt(managerAddress),
    };
    checkpoint();

    report.final = {
      state: await readState(managerProviders, managerMod, managerAddress),
      receipt: await receipt(managerAddress),
      counts: {
        nativeOwnerActions: report.positives.filter((item: any) => item.mode === 'native').length,
        evmOwnerActions: report.positives.filter((item: any) => item.mode === 'evm').length,
        negativeRefusals: report.negatives.length,
        proofCalls: proofRecords.length,
      },
      completedAt: new Date().toISOString(),
    };
    checkpoint();
    console.log(json(report.final));
  } catch (error) {
    report.fatal = { at: new Date().toISOString(), error: errorText(error), stack: error instanceof Error ? error.stack : undefined };
    checkpoint();
    throw error;
  } finally {
    for (const party of opened.reverse()) await closeParty(party);
    rmSync(privateDir, { recursive: true, force: true });
  }
};

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
