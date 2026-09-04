import type { TokenMetadata } from "../../lib/token-metadata.js";

export type FundingMode = "aa-minter" | "offer-files-faucet";
export type OfferFilesFaucetName = "WBTC" | "WETH";

export type FundingRequest =
  | {
      readonly mode: "aa-minter";
      readonly accountId: string;
      readonly amountBaseUnits: bigint;
    }
  | {
      readonly mode: "offer-files-faucet";
      readonly accountId: string;
      readonly wholeCoins: bigint;
      readonly tokenName: OfferFilesFaucetName;
    };

export interface FundingResult {
  readonly mode: FundingMode;
  readonly token: TokenMetadata;
  readonly amountBaseUnits: bigint;
  readonly walletBalanceBefore: bigint;
  readonly walletBalanceAfterMint: bigint;
  readonly walletBalanceAfterDeposit: bigint;
  readonly managerBalanceBefore: bigint;
  readonly managerBalanceAfter: bigint;
  readonly transactions: readonly [
    { readonly operation: "mint"; readonly txId: string },
    { readonly operation: "deposit"; readonly txId: string },
  ];
}

export interface FundingAdapter {
  readonly mode: FundingMode;
  fund(request: FundingRequest): Promise<FundingResult>;
}

export interface KnownTokenRegistryPort {
  /** The production implementation is fixed to GET /v1/known-tokens. */
  getKnownTokens(): Promise<readonly unknown[]>;
}

export interface KnownTokenRow {
  readonly token_color: string;
  readonly name: string;
  readonly kind: string;
  readonly decimals: number | null;
}

export interface SessionMintResult {
  readonly txId: string;
  readonly color: string;
  readonly value: bigint;
}

export interface SessionDepositResult {
  readonly txId: string;
}

export interface FundingWalletSession {
  readShieldedWalletBalance(color: string): Promise<bigint>;
  waitForShieldedWalletBalance(color: string, exactBalance: bigint): Promise<bigint>;
  callOfferFilesMintShielded(
    contractAddress: string,
    artifactPath: string,
    proofServerUrl: string,
    args: readonly [domainSeparator: Uint8Array, amount: bigint, nonce: bigint],
  ): Promise<SessionMintResult>;
  readManagerShieldedBalance(
    managerAddress: string,
    managerArtifactPath: string,
    managerProofServerUrl: string,
    accountId: string,
    color: string,
  ): Promise<bigint>;
  depositShielded(
    managerAddress: string,
    managerArtifactPath: string,
    managerProofServerUrl: string,
    input: { readonly accountId: string; readonly color: string; readonly value: bigint; readonly nonce: Uint8Array },
  ): Promise<SessionDepositResult>;
  stop(): Promise<void>;
}

export interface FundingWalletSessionFactory {
  open(input: {
    readonly label: string;
    readonly seed: string;
    readonly networkId: string;
    readonly nodeUrl: string;
    readonly indexerUrl: string;
    readonly indexerWsUrl: string;
    readonly walletProofServerUrl: string;
  }): Promise<FundingWalletSession>;
}

export interface NoncePort {
  nextUint128(): bigint;
  nextBytes32(): Uint8Array;
}

export interface AaMinterFundingPort {
  /** Any uncertain wallet open/stop MUST reject with WalletSessionStopError so the seed is poisoned. */
  fundShielded(input: {
    readonly accountId: string;
    readonly amount: bigint;
    readonly color: string;
    readonly minterAddress: string;
    readonly minterArtifactPath: string;
    readonly managerAddress: string;
    readonly managerArtifactPath: string;
    readonly managerProofServerUrl: string;
    readonly walletProofServerUrl: string;
    readonly harnessWalletSeed: string;
    readonly networkId: string;
    readonly nodeUrl: string;
    readonly indexerUrl: string;
    readonly indexerWsUrl: string;
    readonly mintNonce: Uint8Array;
    readonly depositNonce: Uint8Array;
  }): Promise<{
    readonly walletBalanceBefore: bigint;
  readonly walletBalanceAfterMint: bigint;
    readonly walletBalanceAfterDeposit: bigint;
    readonly managerBalanceBefore: bigint;
    readonly managerBalanceAfter: bigint;
    readonly mintColor: string;
    readonly mintValue: bigint;
    readonly mintTxId: string;
    readonly depositTxId: string;
  }>;
}
