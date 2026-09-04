/**
 * Concrete runtime for the stock AA image (AA 713a202 / compact runtime 0.18).
 *
 * This file is bind-mounted by scripts/test-integration.sh at the image-native
 * `/aa/runner/aa-faucet-runtime.ts` path. All SDK imports are dynamic so the
 * runtime is resolved from that legacy image's dependency tree; candidate
 * 0.19 generated modules are never loaded into it.
 */
import { createHash } from "node:crypto";

import type { LegacyAaDeploymentReceipt } from "./deployment-receipt.js";
import type { FundingConfig } from "./funding/router.js";
import type {
  AaMinterFundingPort,
  FundingWalletSession,
  FundingWalletSessionFactory,
} from "./funding/types.js";
import type {
  AaLiveRuntime,
  ScenarioAccount,
  ScenarioTransferResult,
  ScenarioWithdrawResult,
  VerifiedMinterIdentity,
} from "./runtime/types.js";

export const deploymentProfile = "legacy-0.18" as const;

type AnyRecord = Record<string, any>;

const MANAGER_STATE_ID = "aaManagerPrivateState";
const MINTER_STATE_ID = "aaMinterPrivateState";
const OFFER_FILES_STATE_ID = "offerFilesPrivateState";
const SESSION_TIMEOUT_MS = 180_000;

function bytes(value: string): Uint8Array {
  const normalized = value.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) throw new RangeError("expected a 32-byte hex value");
  return Uint8Array.from(normalized.match(/.{2}/g)!, (octet) => Number.parseInt(octet, 16));
}

function hex(value: Uint8Array | string): string {
  if (typeof value === "string") return value.replace(/^0x/i, "").toLowerCase();
  return Array.from(value, (octet) => octet.toString(16).padStart(2, "0")).join("");
}

function hex0x(value: Uint8Array | string): `0x${string}` {
  return `0x${hex(value)}`;
}

function paddedText(value: string): `0x${string}` {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length > 32) throw new RangeError("deployment domain is longer than Bytes<32>");
  const output = new Uint8Array(32);
  output.set(encoded);
  return hex0x(output);
}

function decodedPaddedText(value: Uint8Array): string {
  const zero = value.indexOf(0);
  return new TextDecoder("utf-8", { fatal: true }).decode(zero === -1 ? value : value.slice(0, zero));
}

function nonblankTxId(value: unknown, operation: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${operation} did not return a transaction id`);
  }
  return value.trim();
}

async function dynamicImport(name: string): Promise<AnyRecord> {
  return await import(name) as AnyRecord;
}

interface LegacyDependencies {
  readonly findDeployedContract: AnyRecord["findDeployedContract"];
  readonly createUnprovenCallTx: AnyRecord["createUnprovenCallTx"];
  readonly CompiledContract: AnyRecord["CompiledContract"];
  readonly setNetworkId: AnyRecord["setNetworkId"];
  readonly indexerPublicDataProvider: AnyRecord["indexerPublicDataProvider"];
  readonly buildWalletFacade: AnyRecord["buildWalletFacade"];
  readonly configureMidnightNodeProviders: AnyRecord["configureMidnightNodeProviders"];
  readonly firstValueFrom: AnyRecord["firstValueFrom"];
  readonly filter: AnyRecord["filter"];
  readonly timeout: AnyRecord["timeout"];
  readonly throwError: AnyRecord["throwError"];
  readonly rawTokenType: AnyRecord["rawTokenType"];
  readonly codec: AnyRecord;
  readonly managerCodec: AnyRecord;
  readonly metamask: AnyRecord;
  readonly signature: AnyRecord;
}

let dependencyPromise: Promise<LegacyDependencies> | undefined;

function dependencies(): Promise<LegacyDependencies> {
  dependencyPromise ??= (async () => {
    const [contracts, compact, network, indexer, helpers, rx, compactRuntime, codec, managerCodec, metamask, signature] =
      await Promise.all([
        dynamicImport("@midnight-ntwrk/midnight-js-contracts"),
        dynamicImport("@midnight-ntwrk/compact-js"),
        dynamicImport("@midnight-ntwrk/midnight-js-network-id"),
        dynamicImport("@midnight-ntwrk/midnight-js-indexer-public-data-provider"),
        dynamicImport("@effectstream/midnight-contracts"),
        dynamicImport("rxjs"),
        dynamicImport("@midnight-ntwrk/compact-runtime"),
        dynamicImport("/aa/aalib/codec.js"),
        dynamicImport("/aa/aalib/manager.js"),
        dynamicImport("/aa/aalib/metamask.js"),
        dynamicImport("/aa/aalib/signature.js"),
      ]);
    return {
      findDeployedContract: contracts.findDeployedContract,
      createUnprovenCallTx: contracts.createUnprovenCallTx,
      CompiledContract: compact.CompiledContract,
      setNetworkId: network.setNetworkId,
      indexerPublicDataProvider: indexer.indexerPublicDataProvider,
      buildWalletFacade: helpers.buildWalletFacade,
      configureMidnightNodeProviders: helpers.configureMidnightNodeProviders,
      firstValueFrom: rx.firstValueFrom,
      filter: rx.filter,
      timeout: rx.timeout,
      throwError: rx.throwError,
      rawTokenType: compactRuntime.rawTokenType,
      codec,
      managerCodec,
      metamask,
      signature,
    };
  })();
  return dependencyPromise;
}

// EVM actions never authorize through this witness, but midnight-js requires
// the complete witness map. Keep an ephemeral process-private value rather
// than committing reusable witness material.
const ownerSecret = crypto.getRandomValues(new Uint8Array(32));

const managerWitnesses = {
  localOwnerSecret: ({ privateState }: { readonly privateState: unknown }) => [privateState, ownerSecret],
};

async function managedModule(path: string): Promise<AnyRecord> {
  return await dynamicImport(`${path}/contract/index.js`);
}

async function walletBalance(walletResult: AnyRecord, color: string): Promise<bigint> {
  const wallet = walletResult.wallet as AnyRecord;
  await wallet.shielded.waitForSyncedState();
  const deps = await dependencies();
  const state = await deps.firstValueFrom(wallet.state());
  const balances = state?.shielded?.balances ?? state?.shielded?.state?.balances ?? {};
  const value = balances instanceof Map ? balances.get(color) : balances[color];
  return value === undefined ? 0n : BigInt(value);
}

async function waitForWalletBalance(walletResult: AnyRecord, color: string, exact: bigint): Promise<bigint> {
  return await waitForExactBigint(
    "shielded wallet balance",
    () => walletBalance(walletResult, color),
    exact,
  );
}

export async function waitForExactBigint(
  label: string,
  read: () => Promise<bigint>,
  exact: bigint,
  timeoutMs = SESSION_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const current = await read();
    if (current === exact) return current;
    if (Date.now() >= deadline) throw new Error(`timed out waiting for the exact ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function callLegacyOfferFilesMint(
  handle: AnyRecord,
  args: readonly [domainSeparator: Uint8Array, amount: bigint, nonce: bigint],
): Promise<{ readonly txId: string; readonly color: string; readonly value: bigint }> {
  const tx = await handle.callTx.mint_shielded(args[0], args[1], args[2]);
  const result = tx.private?.result;
  return {
    txId: nonblankTxId(tx.public?.txId ?? tx.public?.txHash, "Offer Files mint"),
    color: hex(result?.color ?? result?.type),
    value: BigInt(result?.value),
  };
}

async function joinContract(input: {
  readonly walletResult: AnyRecord;
  readonly tag: string;
  readonly address: string;
  readonly artifactPath: string;
  readonly proofServerUrl: string;
  readonly privateStateId: string;
  readonly witnesses: AnyRecord;
  readonly config: FundingConfig;
}): Promise<{ readonly Mod: AnyRecord; readonly handle: AnyRecord; readonly providers: AnyRecord; readonly compiled: AnyRecord }> {
  const deps = await dependencies();
  const Mod = await managedModule(input.artifactPath);
  const compiled = deps.CompiledContract.make(input.tag, Mod.Contract).pipe(
    deps.CompiledContract.withWitnesses(input.witnesses),
    deps.CompiledContract.withCompiledFileAssets(input.artifactPath),
  );
  const wr = input.walletResult;
  const providers = await deps.configureMidnightNodeProviders(
    wr.wallet,
    wr.zswapSecretKeys,
    wr.walletZswapSecretKeys,
    wr.dustSecretKey,
    wr.walletDustSecretKey,
    {
      indexer: input.config.indexerUrl,
      indexerWS: input.config.indexerWsUrl,
      node: input.config.nodeUrl,
      proofServer: input.proofServerUrl,
    },
    `${input.privateStateId}-${crypto.randomUUID()}`,
    input.artifactPath,
    wr.unshieldedKeystore,
  );
  const handle = await deps.findDeployedContract(providers, {
    contractAddress: input.address,
    compiledContract: compiled,
    privateStateId: input.privateStateId,
    initialPrivateState: {},
  });
  return { Mod, handle, providers, compiled };
}

async function readLedger(config: FundingConfig): Promise<{ readonly ledger: AnyRecord; readonly Mod: AnyRecord }> {
  const deps = await dependencies();
  const Mod = await managedModule(config.managerArtifactPath);
  const provider = deps.indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl);
  try {
    const state = await provider.queryContractState(config.managerAddress);
    if (!state) throw new Error("Manager state was not found through the indexer");
    return { ledger: Mod.ledger(state.data), Mod };
  } finally {
    await provider.dispose?.();
    await provider.close?.();
  }
}

async function managerBalance(config: FundingConfig, accountId: string, color: string): Promise<bigint> {
  const { ledger, Mod } = await readLedger(config);
  const key = Mod.pureCircuits.shieldedKey(bytes(accountId), bytes(color));
  return ledger.shieldedBalances.member(key) ? BigInt(ledger.shieldedBalances.lookup(key)) : 0n;
}

async function waitForManagerBalance(
  config: FundingConfig,
  accountId: string,
  color: string,
  exact: bigint,
): Promise<bigint> {
  return await waitForExactBigint(
    "Manager shielded balance",
    () => managerBalance(config, accountId, color),
    exact,
  );
}

async function managerNonce(config: FundingConfig, accountId: string): Promise<bigint> {
  const { ledger } = await readLedger(config);
  const id = bytes(accountId);
  return ledger.evmNonces.member(id) ? BigInt(ledger.evmNonces.lookup(id)) : 0n;
}

async function waitForManagerNonce(config: FundingConfig, accountId: string, exact: bigint): Promise<bigint> {
  return await waitForExactBigint("Manager nonce", () => managerNonce(config, accountId), exact);
}

export function managerAccountMatches(ledger: AnyRecord, id: Uint8Array, owner: string): boolean {
  return ledger.accounts.member(id) &&
    ledger.evmOwners.member(id) &&
    hex(ledger.evmOwners.lookup(id)) === hex(owner);
}

async function waitForRegisteredAccount(
  config: FundingConfig,
  accountId: string,
  owner: string,
): Promise<void> {
  const deadline = Date.now() + SESSION_TIMEOUT_MS;
  const id = bytes(accountId);
  for (;;) {
    const { ledger } = await readLedger(config);
    if (managerAccountMatches(ledger, id, owner)) {
      return;
    }
    if (Date.now() >= deadline) throw new Error("timed out waiting for registered Manager account state");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export function assertWalletReadiness(state: AnyRecord): void {
  const facadeSynced = state?.isSynced === true;
  const shieldedSynced = state?.shielded?.state?.progress?.isStrictlyComplete?.() ?? facadeSynced;
  const unshieldedSynced = state?.unshielded?.progress?.isStrictlyComplete?.() ?? facadeSynced;
  if (!facadeSynced || !shieldedSynced || !unshieldedSynced) {
    throw new Error("harness wallet is not fully synchronized");
  }
  const balances = state?.unshielded?.balances ?? {};
  const nightTotal = (balances instanceof Map ? [...balances.values()] : Object.values(balances))
    .reduce((total: bigint, value) => total + BigInt(value as bigint), 0n);
  if (nightTotal <= 0n) {
    throw new Error("harness wallet has no unshielded NIGHT for fee readiness");
  }
  const nightCoins = state?.unshielded?.availableCoins;
  if (!Array.isArray(nightCoins) ||
      !nightCoins.some((coin: AnyRecord) => coin?.meta?.registeredForDustGeneration === true)) {
    throw new Error("harness wallet NIGHT is not registered for DUST generation");
  }
  const dust = state?.dust;
  const balance = typeof dust?.walletBalance === "function"
    ? dust.walletBalance(new Date())
    : typeof dust?.balance === "function"
      ? dust.balance(new Date())
      : undefined;
  if (balance === undefined || BigInt(balance) <= 0n) throw new Error("harness wallet has no spendable generated DUST");
  if (!Array.isArray(dust?.availableCoins) || dust.availableCoins.length === 0) {
    throw new Error("harness wallet has no spendable DUST UTXO");
  }
}

async function openWallet(config: FundingConfig, seed: string): Promise<AnyRecord> {
  const deps = await dependencies();
  const walletResult = await deps.buildWalletFacade({
    id: config.networkId,
    indexer: config.indexerUrl,
    indexerWS: config.indexerWsUrl,
    node: config.nodeUrl,
    proofServer: config.walletProofServerUrl,
  }, seed, config.networkId);
  try {
    const state = await deps.firstValueFrom(walletResult.wallet.state().pipe(
      deps.filter((candidate: AnyRecord) => {
        try {
          assertWalletReadiness(candidate);
          return true;
        } catch {
          return false;
        }
      }),
      deps.timeout({
        each: SESSION_TIMEOUT_MS,
        with: () => deps.throwError(() => new Error("wallet readiness timeout")),
      }),
    ));
    assertWalletReadiness(state);
    return walletResult;
  } catch {
    await walletResult.wallet?.stop?.().catch(() => undefined);
    throw new Error("wallet facade open failed");
  }
}

interface FacadeSeedState {
  active: boolean;
  poisoned: boolean;
}

const FACADE_SEEDS = new Map<string, FacadeSeedState>();

export class RuntimeFacadeCoordinator {
  readonly #key: string;
  readonly #open: (config: FundingConfig, seed: string) => Promise<AnyRecord>;

  constructor(
    seed: string,
    opener: (config: FundingConfig, seed: string) => Promise<AnyRecord> = openWallet,
  ) {
    this.#key = createHash("sha256").update("legacy-wallet\0").update(seed).digest("hex");
    this.#open = opener;
  }

  async acquire(config: FundingConfig, seed: string): Promise<{
    readonly walletResult: AnyRecord;
    release(): Promise<void>;
  }> {
    const requestedKey = createHash("sha256").update("legacy-wallet\0").update(seed).digest("hex");
    if (requestedKey !== this.#key) throw new Error("wallet facade coordinator seed mismatch");
    const state = FACADE_SEEDS.get(this.#key) ?? { active: false, poisoned: false };
    FACADE_SEEDS.set(this.#key, state);
    if (state.poisoned) throw new RuntimeLifecycleError("wallet seed is poisoned after lifecycle failure");
    if (state.active) throw new Error("a wallet facade is already active for this seed");
    state.active = true;
    let walletResult: AnyRecord;
    try {
      walletResult = await this.#open(config, seed);
    } catch {
      state.poisoned = true;
      state.active = false;
      throw new RuntimeLifecycleError("wallet facade open failed");
    }
    let released = false;
    const key = this.#key;
    return {
      walletResult,
      async release() {
        if (released) return;
        released = true;
        try {
          await walletResult.wallet.stop();
        } catch {
          state.poisoned = true;
          throw new RuntimeLifecycleError("wallet facade stop failed");
        } finally {
          state.active = false;
          if (!state.poisoned) FACADE_SEEDS.delete(key);
        }
      },
    };
  }

  async run<T>(config: FundingConfig, seed: string, operation: (walletResult: AnyRecord) => Promise<T>): Promise<T> {
    const lease = await this.acquire(config, seed);
    try {
      return await operation(lease.walletResult);
    } finally {
      await lease.release();
    }
  }
}

export async function submitShieldedWithdrawPipeline(input: {
  readonly createUnprovenCallTx: LegacyDependencies["createUnprovenCallTx"];
  readonly providers: AnyRecord;
  readonly compiled: AnyRecord;
  readonly contractAddress: string;
  readonly args: readonly [payload: AnyRecord, signature: AnyRecord, point: AnyRecord];
  readonly privateStateId: string;
  readonly coinPublicKey: unknown;
  readonly encryptionPublicKey: unknown;
  readonly walletResult: AnyRecord;
}): Promise<string> {
  const built = await input.createUnprovenCallTx(input.providers, {
    compiledContract: input.compiled,
    circuitId: "execute",
    contractAddress: input.contractAddress,
    args: input.args,
    privateStateId: input.privateStateId,
    additionalCoinEncPublicKeyMappings: new Map([[input.coinPublicKey, input.encryptionPublicKey]]),
  });
  const proven = await input.providers.proofProvider.proveTx(built.private.unprovenTx);
  const bound = typeof proven.bind === "function" ? proven.bind() : proven;
  const wr = input.walletResult;
  const recipe = await wr.wallet.balanceFinalizedTransaction(bound, {
    shieldedSecretKeys: wr.zswapSecretKeys,
    dustSecretKey: wr.dustSecretKey,
  }, { ttl: new Date(Date.now() + 30 * 60_000) });
  const finalTx = await wr.wallet.finalizeRecipe(recipe);
  const submitted = await wr.wallet.submitTransaction(finalTx);
  return nonblankTxId(
    typeof submitted === "string" ? submitted : finalTx.transactionHash?.()?.toString?.(),
    "shielded withdrawal",
  );
}

function sessionFactory(config: FundingConfig, coordinator: RuntimeFacadeCoordinator): FundingWalletSessionFactory {
  return {
    async open(input): Promise<FundingWalletSession> {
      const lease = await coordinator.acquire(config, input.seed);
      const walletResult = lease.walletResult;
      return {
        readShieldedWalletBalance: async (color) => walletBalance(walletResult, color),
        waitForShieldedWalletBalance: async (color, exact) => waitForWalletBalance(walletResult, color, exact),
        async callOfferFilesMintShielded(address, artifactPath, proofServerUrl, args) {
          const joined = await joinContract({
            walletResult,
            tag: "contract-offer-files",
            address,
            artifactPath,
            proofServerUrl,
            privateStateId: OFFER_FILES_STATE_ID,
            witnesses: {},
            config,
          });
          return await callLegacyOfferFilesMint(joined.handle, args);
        },
        readManagerShieldedBalance: async (_address, _artifactPath, _proofUrl, accountId, color) =>
          managerBalance(config, accountId, color),
        async depositShielded(address, artifactPath, proofServerUrl, deposit) {
          const managerBefore = await managerBalance(config, deposit.accountId, deposit.color);
          const joined = await joinContract({
            walletResult,
            tag: "contract-manager",
            address,
            artifactPath,
            proofServerUrl,
            privateStateId: MANAGER_STATE_ID,
            witnesses: managerWitnesses,
            config,
          });
          const tx = await joined.handle.callTx.depositShielded({
            nonce: deposit.nonce,
            color: bytes(deposit.color),
            value: deposit.value,
          }, bytes(deposit.accountId));
          await waitForManagerBalance(
            config, deposit.accountId, deposit.color, managerBefore + deposit.value,
          );
          return { txId: nonblankTxId(tx.public?.txId ?? tx.public?.txHash, "Manager deposit") };
        },
        async stop() {
          await lease.release();
        },
      };
    },
  };
}

class RuntimeLifecycleError extends Error {
  readonly name = "WalletSessionStopError";

  constructor(message: string) {
    super(message);
    Object.defineProperty(this, Symbol.for("aa.wallet-session-lifecycle-error"), {
      value: true,
      enumerable: false,
    });
  }
}

function aaMinterPort(config: FundingConfig, coordinator: RuntimeFacadeCoordinator): AaMinterFundingPort {
  return {
    async fundShielded(input) {
      // Session A: observe, mint to this wallet, then stop completely.
      let mint: AnyRecord;
      let mintWalletBefore: bigint;
      await coordinator.run(config, input.harnessWalletSeed, async (wr) => {
        mintWalletBefore = await walletBalance(wr, input.color);
        const joined = await joinContract({
          walletResult: wr,
          tag: "contract-minter",
          address: input.minterAddress,
          artifactPath: input.minterArtifactPath,
          proofServerUrl: input.managerProofServerUrl,
          privateStateId: MINTER_STATE_ID,
          witnesses: {},
          config,
        });
        mint = await joined.handle.callTx.mintShieldedTo(input.amount, input.mintNonce, {
          is_left: true,
          left: { bytes: bytes(String(wr.zswapSecretKeys.coinPublicKey)) },
          right: { bytes: new Uint8Array(32) },
        });
      });
      const mintResult = mint!.private?.result;
      const mintedColor = hex(mintResult?.color ?? mintResult?.type);
      const mintedValue = BigInt(mintResult?.value);
      const mintTxId = nonblankTxId(mint!.public?.txId ?? mint!.public?.txHash, "AA-Minter mint");

      // Session B: same seed, opened only after A stopped. Observe the minted
      // delta, deposit, and wait for both Manager and wallet reconciliation.
      return await coordinator.run(config, input.harnessWalletSeed, async (depositWr) => {
        const walletAfterMint = await waitForWalletBalance(depositWr, input.color, mintWalletBefore + input.amount);
        const managerBefore = await managerBalance(config, input.accountId, input.color);
        const joined = await joinContract({
          walletResult: depositWr,
          tag: "contract-manager",
          address: input.managerAddress,
          artifactPath: input.managerArtifactPath,
          proofServerUrl: input.managerProofServerUrl,
          privateStateId: MANAGER_STATE_ID,
          witnesses: managerWitnesses,
          config,
        });
        const deposit = await joined.handle.callTx.depositShielded({
          nonce: input.depositNonce,
          color: bytes(input.color),
          value: input.amount,
        }, bytes(input.accountId));
        const managerAfter = await waitForManagerBalance(
          config, input.accountId, input.color, managerBefore + input.amount,
        );
        const walletAfterDeposit = await waitForWalletBalance(depositWr, input.color, mintWalletBefore);
        return {
          walletBalanceBefore: mintWalletBefore,
          walletBalanceAfterMint: walletAfterMint,
          walletBalanceAfterDeposit: walletAfterDeposit,
          managerBalanceBefore: managerBefore,
          managerBalanceAfter: managerAfter,
          mintColor: mintedColor,
          mintValue: mintedValue,
          mintTxId,
          depositTxId: nonblankTxId(deposit.public?.txId ?? deposit.public?.txHash, "Manager deposit"),
        };
      });
    },
  };
}

interface AccountAuthority {
  readonly privateKey: `0x${string}`;
  readonly owner: `0x${string}`;
}

function runtime(config: FundingConfig): AaLiveRuntime {
  const coordinator = new RuntimeFacadeCoordinator(config.harnessWalletSeed);
  const sessions = sessionFactory(config, coordinator);
  const authorities = new Map<symbol, AccountAuthority>();

  async function authority(account: ScenarioAccount): Promise<AccountAuthority> {
    if (typeof account.authorizationHandle !== "symbol") throw new Error("invalid account authorization handle");
    const found = authorities.get(account.authorizationHandle);
    if (!found) throw new Error("unknown account authorization handle");
    return found;
  }

  async function executeWithFreshWallet(
    label: string,
    payload: AnyRecord,
    signature: AnyRecord,
    point: AnyRecord,
  ): Promise<string> {
    return await coordinator.run(config, config.harnessWalletSeed, async (wr) => {
      const joined = await joinContract({
        walletResult: wr,
        tag: "contract-manager",
        address: config.managerAddress,
        artifactPath: config.managerArtifactPath,
        proofServerUrl: config.managerProofServerUrl,
        privateStateId: MANAGER_STATE_ID,
        witnesses: managerWitnesses,
        config,
      });
      const tx = await joined.handle.callTx.execute(payload, signature, point);
      return nonblankTxId(tx.public?.txId ?? tx.public?.txHash, label);
    });
  }

  return {
    sessions,
    aaMinterFunding: aaMinterPort(config, coordinator),
    async verifyMinterIdentity(_config, receipt): Promise<VerifiedMinterIdentity> {
      await coordinator.run(config, config.harnessWalletSeed, async (wr) => {
        await joinContract({
          walletResult: wr,
          tag: "contract-minter",
          address: receipt.minter.address,
          artifactPath: config.minterArtifactPath,
          proofServerUrl: config.managerProofServerUrl,
          privateStateId: MINTER_STATE_ID,
          witnesses: {},
          config,
        });
      });
      const deps = await dependencies();
      const Mod = await managedModule(config.minterArtifactPath);
      const provider = deps.indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl);
      try {
        const state = await provider.queryContractState(receipt.minter.address);
        if (!state) throw new Error("Minter state was not found through the indexer");
        const ledger = Mod.ledger(state.data);
        return {
          address: receipt.minter.address,
          tag: decodedPaddedText(ledger.deploymentTag),
          shieldedColor: hex(deps.rawTokenType(ledger.shieldedSep, receipt.minter.address)),
          unshieldedColor: hex(deps.rawTokenType(ledger.unshieldedSep, receipt.minter.address)),
        };
      } finally {
        await provider.dispose?.();
        await provider.close?.();
      }
    },
    async createFreshAccounts(_config, receipt) {
      const deps = await dependencies();
      const result: ScenarioAccount[] = [];
      for (let index = 0; index < 2; index += 1) {
        const privateKey = hex0x(crypto.getRandomValues(new Uint8Array(32)));
        const owner = deps.signature.addressForPrivateKey(privateKey);
        const salt = hex0x(crypto.getRandomValues(new Uint8Array(32)));
        const manager = hex0x(receipt.manager.address);
        const accountId = deps.codec.deriveAccountId(manager, owner, salt);
        const action = {
          primaryType: "RegisterEvmAccount",
          manager,
          accountId,
          owner,
          validUntil: BigInt(Math.floor(Date.now() / 1_000) + 1_800),
          accountSalt: salt,
        };
        const signature = deps.metamask.metamaskSign(privateKey, action, paddedText(receipt.manager.domain));
        const prepared = deps.managerCodec.prepareEvmExecute(action, paddedText(receipt.manager.domain), signature);
        const registrationTxId = await executeWithFreshWallet(
          `register account ${index + 1}`, prepared.payload, prepared.signature, prepared.point,
        );
        await waitForRegisteredAccount(config, accountId, owner);
        const nonce = await managerNonce(config, accountId);
        if (nonce !== 0n) throw new Error("fresh account nonce was not zero after registration");
        const handle = Symbol(`account-${index + 1}`);
        authorities.set(handle, { privateKey, owner });
        result.push({ accountId: hex(accountId), registrationTxId, authorizationHandle: handle });
      }
      return result as [ScenarioAccount, ScenarioAccount];
    },
    async transferShielded(input): Promise<ScenarioTransferResult> {
      const deps = await dependencies();
      const signer = await authority(input.from);
      const fromBefore = await managerBalance(config, input.from.accountId, input.color);
      const toBefore = await managerBalance(config, input.to.accountId, input.color);
      const nonce = await managerNonce(config, input.from.accountId);
      const action = {
        primaryType: "TransferInternalShielded",
        manager: hex0x(config.managerAddress),
        accountId: hex0x(input.from.accountId),
        owner: signer.owner,
        validUntil: BigInt(Math.floor(Date.now() / 1_000) + 1_800),
        nonce,
        color: hex0x(input.color),
        amount: input.amount,
        toAccountId: hex0x(input.to.accountId),
      };
      const signature = deps.metamask.metamaskSign(signer.privateKey, action, paddedText(input.receipt.manager.domain));
      const prepared = deps.managerCodec.prepareEvmExecute(action, paddedText(input.receipt.manager.domain), signature);
      const txId = await executeWithFreshWallet("shielded internal transfer", prepared.payload, prepared.signature, prepared.point);
      const fromAfter = await waitForManagerBalance(
        config, input.from.accountId, input.color, fromBefore - input.amount,
      );
      const toAfter = await waitForManagerBalance(
        config, input.to.accountId, input.color, toBefore + input.amount,
      );
      await waitForManagerNonce(config, input.from.accountId, nonce + 1n);
      return { txId, fromBefore, fromAfter, toBefore, toAfter };
    },
    async withdrawShielded(input): Promise<ScenarioWithdrawResult> {
      const deps = await dependencies();
      const signer = await authority(input.account);
      const managerBefore = await managerBalance(config, input.account.accountId, input.color);
      const nonce = await managerNonce(config, input.account.accountId);
      return await coordinator.run(config, config.harnessWalletSeed, async (wr) => {
        const walletBefore = await walletBalance(wr, input.color);
        const coinPublicKey = wr.zswapSecretKeys.coinPublicKey;
        const encryptionPublicKey = wr.zswapSecretKeys.encryptionPublicKey;
        const action = {
          primaryType: "WithdrawShielded",
          manager: hex0x(config.managerAddress),
          accountId: hex0x(input.account.accountId),
          owner: signer.owner,
          validUntil: BigInt(Math.floor(Date.now() / 1_000) + 1_800),
          nonce,
          color: hex0x(input.color),
          amount: input.amount,
          recipientKind: 0n,
          recipient: hex0x(String(coinPublicKey)),
        };
        const signature = deps.metamask.metamaskSign(signer.privateKey, action, paddedText(input.receipt.manager.domain));
        const prepared = deps.managerCodec.prepareEvmExecute(action, paddedText(input.receipt.manager.domain), signature);
        const joined = await joinContract({
          walletResult: wr,
          tag: "contract-manager",
          address: config.managerAddress,
          artifactPath: config.managerArtifactPath,
          proofServerUrl: config.managerProofServerUrl,
          privateStateId: MANAGER_STATE_ID,
          witnesses: managerWitnesses,
          config,
        });
        const txId = await submitShieldedWithdrawPipeline({
          createUnprovenCallTx: deps.createUnprovenCallTx,
          providers: joined.providers,
          compiled: joined.compiled,
          contractAddress: config.managerAddress,
          args: [prepared.payload, prepared.signature, prepared.point],
          privateStateId: MANAGER_STATE_ID,
          coinPublicKey,
          encryptionPublicKey,
          walletResult: wr,
        });
        const walletAfter = await waitForWalletBalance(wr, input.color, walletBefore + input.amount);
        const managerAfter = await waitForManagerBalance(
          config, input.account.accountId, input.color, managerBefore - input.amount,
        );
        await waitForManagerNonce(config, input.account.accountId, nonce + 1n);
        return { txId, managerBefore, managerAfter, walletBefore, walletAfter };
      });
    },
  };
}

export async function createLiveRuntime(config: FundingConfig): Promise<AaLiveRuntime> {
  if (config.deploymentProfile !== deploymentProfile) {
    throw new Error("the shipped runtime supports only the legacy-0.18 deployment profile");
  }
  const deps = await dependencies();
  deps.setNetworkId(config.networkId);
  return runtime(config);
}
