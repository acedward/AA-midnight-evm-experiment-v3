import type { LegacyAaDeploymentReceipt } from "../deployment-receipt.js";
import type { FundingConfig } from "../funding/router.js";
import type { AaMinterFundingPort, FundingWalletSessionFactory } from "../funding/types.js";

export interface VerifiedMinterIdentity {
  readonly address: string;
  readonly tag: string;
  readonly shieldedColor: string;
  readonly unshieldedColor: string;
}

export interface ScenarioAccount {
  readonly accountId: string;
  readonly registrationTxId: string;
  /** Opaque, runtime-private authorization handle. It must never enter a receipt or log. */
  readonly authorizationHandle: unknown;
}

export interface ScenarioTransferResult {
  readonly txId: string;
  readonly fromBefore: bigint;
  readonly fromAfter: bigint;
  readonly toBefore: bigint;
  readonly toAfter: bigint;
}

export interface ScenarioWithdrawResult {
  readonly txId: string;
  readonly managerBefore: bigint;
  readonly managerAfter: bigint;
  readonly walletBefore: bigint;
  readonly walletAfter: bigint;
}

export interface AaLiveRuntime {
  readonly sessions: FundingWalletSessionFactory;
  readonly aaMinterFunding: AaMinterFundingPort;
  verifyMinterIdentity(config: FundingConfig, receipt: LegacyAaDeploymentReceipt): Promise<VerifiedMinterIdentity>;
  createFreshAccounts(config: FundingConfig, receipt: LegacyAaDeploymentReceipt): Promise<readonly [ScenarioAccount, ScenarioAccount]>;
  transferShielded(input: {
    readonly config: FundingConfig;
    readonly receipt: LegacyAaDeploymentReceipt;
    readonly from: ScenarioAccount;
    readonly to: ScenarioAccount;
    readonly color: string;
    readonly amount: bigint;
  }): Promise<ScenarioTransferResult>;
  withdrawShielded(input: {
    readonly config: FundingConfig;
    readonly receipt: LegacyAaDeploymentReceipt;
    readonly account: ScenarioAccount;
    readonly color: string;
    readonly amount: bigint;
  }): Promise<ScenarioWithdrawResult>;
}

export interface AaLiveRuntimeModule {
  readonly deploymentProfile: FundingConfig["deploymentProfile"];
  createLiveRuntime(config: FundingConfig): Promise<AaLiveRuntime>;
}
