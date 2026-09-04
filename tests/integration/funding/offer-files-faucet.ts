import {
  OFFER_FILES_FAUCET_DECIMALS,
  canonicalTokenColor,
  domainSepFromName,
  offerFilesRegistryTokenMetadata,
  scaleSixDecimalWholeCoins,
  type OfferFilesTokenMetadata,
} from "../../lib/token-metadata.js";
import type { OfferFilesFundingConfig } from "./router.js";
import { SingleSessionGate } from "./session-gate.js";
import { SeedFundingCoordinator } from "./seed-coordinator.js";
import { assertNoLiteralSecret, redactSecretError, withNonEnumerableSecret } from "./redact.js";
import type {
  FundingAdapter,
  FundingRequest,
  FundingResult,
  FundingWalletSessionFactory,
  KnownTokenRegistryPort,
  KnownTokenRow,
  NoncePort,
  OfferFilesFaucetName,
} from "./types.js";

const REQUIRED_FAUCET_NAMES = ["WBTC", "WETH"] as const;

function row(value: unknown, index: number): KnownTokenRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`known token row ${index} must be an object`);
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.token_color !== "string") throw new TypeError(`known token row ${index} token_color is invalid`);
  if (typeof raw.name !== "string") throw new TypeError(`known token row ${index} name is invalid`);
  if (typeof raw.kind !== "string") throw new TypeError(`known token row ${index} kind is invalid`);
  if (raw.decimals !== null && typeof raw.decimals !== "number") {
    throw new TypeError(`known token row ${index} decimals is invalid`);
  }
  return {
    token_color: raw.token_color,
    name: raw.name,
    kind: raw.kind,
    decimals: raw.decimals as number | null,
  };
}

function txId(value: unknown, operation: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${operation} returned an empty transaction id`);
  }
  return value.trim();
}

export class OfferFilesFaucetAdapter implements FundingAdapter {
  readonly mode = "offer-files-faucet" as const;
  readonly #gate: SingleSessionGate;
  readonly #config: OfferFilesFundingConfig;
  readonly #dependencies: {
    readonly registry: KnownTokenRegistryPort;
    readonly sessions: FundingWalletSessionFactory;
    readonly nonces: NoncePort;
  };
  readonly #usedUint128Nonces = new Set<string>();
  readonly #usedBytes32Nonces = new Set<string>();
  readonly #coordinator: SeedFundingCoordinator;
  #registryMetadata: Promise<ReadonlyMap<OfferFilesFaucetName, OfferFilesTokenMetadata>> | undefined;

  constructor(
    config: OfferFilesFundingConfig,
    dependencies: {
      readonly registry: KnownTokenRegistryPort;
      readonly sessions: FundingWalletSessionFactory;
      readonly nonces: NoncePort;
    },
  ) {
    this.#config = config;
    this.#dependencies = dependencies;
    this.#coordinator = new SeedFundingCoordinator(config.harnessWalletSeed);
    this.#gate = new SingleSessionGate(dependencies.sessions);
  }

  #mintNonce(): bigint {
    const nonce = this.#dependencies.nonces.nextUint128();
    if (typeof nonce !== "bigint" || nonce <= 0n || nonce >= (1n << 128n)) {
      throw new RangeError("mint nonce must be a nonzero Uint128 bigint");
    }
    const key = nonce.toString(16);
    if (this.#usedUint128Nonces.has(key)) throw new RangeError("mint nonce was reused");
    this.#usedUint128Nonces.add(key);
    return nonce;
  }

  #depositNonce(): Uint8Array {
    const nonce = this.#dependencies.nonces.nextBytes32();
    if (!(nonce instanceof Uint8Array) || nonce.length !== 32 || nonce.every((byte) => byte === 0)) {
      throw new RangeError("deposit nonce must be exactly 32 nonzero bytes");
    }
    const key = Buffer.from(nonce).toString("hex");
    if (this.#usedBytes32Nonces.has(key)) throw new RangeError("deposit nonce was reused");
    this.#usedBytes32Nonces.add(key);
    return nonce;
  }

  async #loadRegistry(): Promise<ReadonlyMap<OfferFilesFaucetName, OfferFilesTokenMetadata>> {
    this.#registryMetadata ??= (async () => {
      const rawRows = await this.#dependencies.registry.getKnownTokens();
      if (!Array.isArray(rawRows)) throw new TypeError("GET /v1/known-tokens must return an array");
      const rows = rawRows.map(row);
      const result = new Map<OfferFilesFaucetName, OfferFilesTokenMetadata>();
      for (const name of REQUIRED_FAUCET_NAMES) {
        const matches = rows.filter((candidate) => candidate.name === name);
        if (matches.length !== 1) {
          throw new RangeError(`GET /v1/known-tokens must contain exactly one ${name} row`);
        }
        const match = matches[0]!;
        if (match.kind !== "shielded") throw new RangeError(`${name} registry kind must be shielded`);
        if (match.decimals !== OFFER_FILES_FAUCET_DECIMALS) {
          throw new RangeError(`${name} registry decimals must be exactly ${OFFER_FILES_FAUCET_DECIMALS}`);
        }
        result.set(name, offerFilesRegistryTokenMetadata({
          name,
          family: "shielded",
          offerFilesAddress: this.#config.offerFilesAddress,
          registryColor: match.token_color,
          decimals: OFFER_FILES_FAUCET_DECIMALS,
        }));
      }
      return result;
    })();
    return this.#registryMetadata;
  }

  #sessionInput(label: string) {
    return withNonEnumerableSecret({
      label,
      networkId: this.#config.networkId,
      nodeUrl: this.#config.nodeUrl,
      indexerUrl: this.#config.indexerUrl,
      indexerWsUrl: this.#config.indexerWsUrl,
      walletProofServerUrl: this.#config.walletProofServerUrl,
    } as const, "seed", this.#config.harnessWalletSeed);
  }

  async fund(request: FundingRequest): Promise<FundingResult> {
    try {
      return await this.#coordinator.run(async () => {
    if (request.mode !== this.mode) throw new RangeError("Offer Files adapter requires a faucet funding request");
    const accountId = canonicalTokenColor(request.accountId);
    const amount = scaleSixDecimalWholeCoins(request.wholeCoins);
    const token = (await this.#loadRegistry()).get(request.tokenName);
    if (!token) throw new RangeError(`unsupported Offer Files faucet token ${request.tokenName}`);

    const minted = await this.#gate.run(this.#sessionInput(`offer-files-mint-${request.tokenName}`), async (session) => {
      const walletBalanceBefore = await session.readShieldedWalletBalance(token.color);
      if (walletBalanceBefore < 0n) throw new RangeError("wallet balance cannot be negative");
      const mintNonce = this.#mintNonce();
      const result = await session.callOfferFilesMintShielded(
        this.#config.offerFilesAddress,
        this.#config.offerFilesArtifactPath,
        this.#config.walletProofServerUrl,
        [domainSepFromName(token.name), amount, mintNonce],
      );
      if (canonicalTokenColor(result.color) !== token.color) throw new RangeError("mint returned the wrong token colour");
      if (result.value !== amount) throw new RangeError("mint returned the wrong token value");
      return { walletBalanceBefore, mintTxId: txId(result.txId, "mint") };
    });

    const deposited = await this.#gate.run(
      this.#sessionInput(`manager-deposit-${request.tokenName}`),
      async (session) => {
        const expectedWalletBalance = minted.walletBalanceBefore + amount;
        const walletBalanceAfterMint = await session.waitForShieldedWalletBalance(
          token.color,
          expectedWalletBalance,
        );
        if (walletBalanceAfterMint - minted.walletBalanceBefore !== amount) {
          throw new RangeError("observed wallet mint delta is not exact");
        }
        if (walletBalanceAfterMint < 0n) throw new RangeError("wallet balance cannot be negative");
        const managerBalanceBefore = await session.readManagerShieldedBalance(
          this.#config.managerAddress,
          this.#config.managerArtifactPath,
          this.#config.managerProofServerUrl,
          accountId,
          token.color,
        );
        if (managerBalanceBefore < 0n) throw new RangeError("Manager balance cannot be negative");
        const depositNonce = this.#depositNonce();
        const deposit = await session.depositShielded(
          this.#config.managerAddress,
          this.#config.managerArtifactPath,
          this.#config.managerProofServerUrl,
          { accountId, color: token.color, value: amount, nonce: depositNonce },
        );
        const managerBalanceAfter = await session.readManagerShieldedBalance(
          this.#config.managerAddress,
          this.#config.managerArtifactPath,
          this.#config.managerProofServerUrl,
          accountId,
          token.color,
        );
        if (managerBalanceAfter - managerBalanceBefore !== amount) {
          throw new RangeError("Manager shielded balance delta is not exact");
        }
        if (managerBalanceAfter < 0n) throw new RangeError("Manager balance cannot be negative");
        const walletBalanceAfterDeposit = await session.waitForShieldedWalletBalance(
          token.color,
          minted.walletBalanceBefore,
        );
        if (walletBalanceAfterDeposit !== minted.walletBalanceBefore) {
          throw new RangeError("wallet balance did not return to its pre-mint value after deposit");
        }
        return {
          walletBalanceAfterMint,
          walletBalanceAfterDeposit,
          managerBalanceBefore,
          managerBalanceAfter,
          depositTxId: txId(deposit.txId, "deposit"),
        };
      },
    );

    if (minted.mintTxId === deposited.depositTxId) {
      throw new RangeError("mint and deposit returned the same transaction id");
    }
    const result: FundingResult = {
      mode: this.mode,
      token,
      amountBaseUnits: amount,
      walletBalanceBefore: minted.walletBalanceBefore,
      walletBalanceAfterMint: deposited.walletBalanceAfterMint,
      walletBalanceAfterDeposit: deposited.walletBalanceAfterDeposit,
      managerBalanceBefore: deposited.managerBalanceBefore,
      managerBalanceAfter: deposited.managerBalanceAfter,
      transactions: [
        { operation: "mint", txId: minted.mintTxId },
        { operation: "deposit", txId: deposited.depositTxId },
      ],
    };
    assertNoLiteralSecret(result, this.#config.harnessWalletSeed);
    return result;
      }, () => this.#gate.poisoned);
    } catch (error) {
      throw redactSecretError(error, this.#config.harnessWalletSeed);
    }
  }
}
