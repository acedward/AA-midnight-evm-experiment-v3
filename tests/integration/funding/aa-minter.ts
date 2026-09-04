import {
  aaMinterTokenMetadata,
  canonicalTokenColor,
  validateUint64Amount,
} from "../../lib/token-metadata.js";
import type { AaMinterFundingConfig } from "./router.js";
import { SeedFundingCoordinator } from "./seed-coordinator.js";
import { isWalletSessionLifecycleError } from "./session-gate.js";
import { assertNoLiteralSecret, redactSecretError, withNonEnumerableSecret } from "./redact.js";
import type {
  AaMinterFundingPort,
  FundingAdapter,
  FundingRequest,
  FundingResult,
  NoncePort,
} from "./types.js";

export class AaMinterFundingAdapter implements FundingAdapter {
  readonly mode = "aa-minter" as const;
  readonly #config: AaMinterFundingConfig;
  readonly #dependencies: { readonly funding: AaMinterFundingPort; readonly nonces: NoncePort };
  readonly #usedNonces = new Set<string>();
  readonly #coordinator: SeedFundingCoordinator;

  constructor(
    config: AaMinterFundingConfig,
    dependencies: { readonly funding: AaMinterFundingPort; readonly nonces: NoncePort },
  ) {
    this.#config = config;
    this.#dependencies = dependencies;
    this.#coordinator = new SeedFundingCoordinator(config.harnessWalletSeed);
  }

  #nonce(label: string): Uint8Array {
    const nonce = this.#dependencies.nonces.nextBytes32();
    if (!(nonce instanceof Uint8Array) || nonce.length !== 32 || nonce.every((byte) => byte === 0)) {
      throw new RangeError(`AA-Minter ${label} nonce must be exactly 32 nonzero bytes`);
    }
    const key = Buffer.from(nonce).toString("hex");
    if (this.#usedNonces.has(key)) throw new RangeError(`AA-Minter ${label} nonce was reused`);
    this.#usedNonces.add(key);
    return nonce;
  }

  async fund(request: FundingRequest): Promise<FundingResult> {
    try {
      return await this.#coordinator.run(async () => {
    if (request.mode !== this.mode) throw new RangeError("AA-Minter adapter requires an AA-Minter funding request");
    const accountId = canonicalTokenColor(request.accountId);
    const amount = validateUint64Amount(request.amountBaseUnits);
    const token = aaMinterTokenMetadata({
      family: "shielded",
      color: this.#config.minterShieldedColor,
      internalDeploymentTag: this.#config.minterTag,
    });
    const mintNonce = this.#nonce("mint");
    const depositNonce = this.#nonce("deposit");
    const fundingInput = withNonEnumerableSecret({
      accountId,
      amount,
      color: token.color,
      minterAddress: this.#config.minterAddress,
      minterArtifactPath: this.#config.minterArtifactPath,
      managerAddress: this.#config.managerAddress,
      managerArtifactPath: this.#config.managerArtifactPath,
      managerProofServerUrl: this.#config.managerProofServerUrl,
      walletProofServerUrl: this.#config.walletProofServerUrl,
      networkId: this.#config.networkId,
      nodeUrl: this.#config.nodeUrl,
      indexerUrl: this.#config.indexerUrl,
      indexerWsUrl: this.#config.indexerWsUrl,
      mintNonce,
      depositNonce,
    }, "harnessWalletSeed", this.#config.harnessWalletSeed);
    const result = await this.#dependencies.funding.fundShielded(fundingInput);
    if (
      result.walletBalanceBefore < 0n || result.walletBalanceAfterMint < 0n ||
      result.walletBalanceAfterDeposit < 0n || result.managerBalanceBefore < 0n ||
      result.managerBalanceAfter < 0n
    ) {
      throw new RangeError("AA-Minter funding balances cannot be negative");
    }
    if (result.walletBalanceAfterMint - result.walletBalanceBefore !== amount) {
      throw new RangeError("AA-Minter wallet mint delta is not exact");
    }
    if (canonicalTokenColor(result.mintColor) !== token.color || result.mintValue !== amount) {
      throw new RangeError("AA-Minter mint returned the wrong token colour or value");
    }
    if (result.managerBalanceAfter - result.managerBalanceBefore !== amount) {
      throw new RangeError("AA-Minter Manager balance delta is not exact");
    }
    if (result.walletBalanceAfterDeposit !== result.walletBalanceBefore) {
      throw new RangeError("AA-Minter wallet balance did not return to its pre-mint value after deposit");
    }
    if (
      typeof result.mintTxId !== "string" || result.mintTxId.trim().length === 0 ||
      typeof result.depositTxId !== "string" || result.depositTxId.trim().length === 0
    ) {
      throw new RangeError("AA-Minter funding returned an empty transaction id");
    }
    if (result.mintTxId.trim() === result.depositTxId.trim()) {
      throw new RangeError("AA-Minter mint and deposit returned the same transaction id");
    }
    const fundingResult: FundingResult = {
      mode: this.mode,
      token,
      amountBaseUnits: amount,
      walletBalanceBefore: result.walletBalanceBefore,
      walletBalanceAfterMint: result.walletBalanceAfterMint,
      walletBalanceAfterDeposit: result.walletBalanceAfterDeposit,
      managerBalanceBefore: result.managerBalanceBefore,
      managerBalanceAfter: result.managerBalanceAfter,
      transactions: [
        { operation: "mint", txId: result.mintTxId.trim() },
        { operation: "deposit", txId: result.depositTxId.trim() },
      ],
    };
    assertNoLiteralSecret(fundingResult, this.#config.harnessWalletSeed);
    return fundingResult;
      }, isWalletSessionLifecycleError);
    } catch (error) {
      throw redactSecretError(error, this.#config.harnessWalletSeed);
    }
  }
}
