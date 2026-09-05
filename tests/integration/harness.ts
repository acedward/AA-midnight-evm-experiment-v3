import {
  AA_RUN_RECEIPT_VERSION,
  buildAaRunReceipt,
  type AaContractsReceipt,
  type AaRunReceipt,
} from "../lib/aa-contracts-receipt.js";
import {
  decorateLegacyAaDeploymentReceipt,
  preflightLegacyAaDeployment,
  type LegacyAaDeploymentReceipt,
} from "./deployment-receipt.js";
import { AaMinterFundingAdapter } from "./funding/aa-minter.js";
import { HttpKnownTokenRegistry } from "./funding/known-token-registry.js";
import { CryptoNonceSource } from "./funding/nonces.js";
import { OfferFilesFaucetAdapter } from "./funding/offer-files-faucet.js";
import { assertNoLiteralSecret, fixedStageError } from "./funding/redact.js";
import { SeedFundingCoordinator } from "./funding/seed-coordinator.js";
import { isWalletSessionLifecycleError } from "./funding/session-gate.js";
import type { FundingConfig } from "./funding/router.js";
import type { FundingAdapter, FundingResult } from "./funding/types.js";
import type { AaLiveRuntime } from "./runtime/types.js";
import { canonicalTokenColor, scaleSixDecimalWholeCoins } from "../lib/token-metadata.js";

export interface HarnessResult {
  readonly deploymentReceipt: AaContractsReceipt;
  readonly runReceipt: AaRunReceipt;
}

function txId(value: unknown, operation: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new RangeError(`${operation} returned an empty transaction id`);
  return value.trim();
}

function adapter(config: FundingConfig, runtime: AaLiveRuntime): FundingAdapter {
  const nonces = new CryptoNonceSource();
  return config.mode === "aa-minter"
    ? new AaMinterFundingAdapter(config, { funding: runtime.aaMinterFunding, nonces })
    : new OfferFilesFaucetAdapter(config, {
      registry: new HttpKnownTokenRegistry(config.zswapApiUrl),
      sessions: runtime.sessions,
      nonces,
    });
}

async function runtimeStage<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw fixedStageError(error, label);
  }
}

function securedAccount(accountId: string, registrationTxId: string, authorizationHandle: unknown) {
  const account = { accountId, registrationTxId } as {
    readonly accountId: string;
    readonly registrationTxId: string;
    readonly authorizationHandle: unknown;
  };
  Object.defineProperty(account, "authorizationHandle", {
    value: authorizationHandle,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(account);
}

export async function runAaFaucetHarness(input: {
  readonly config: FundingConfig;
  readonly legacyReceipt: LegacyAaDeploymentReceipt;
  readonly runtime: AaLiveRuntime;
  readonly clock?: () => Date;
  readonly fundingAdapter?: FundingAdapter;
}): Promise<HarnessResult> {
  const coordinator = new SeedFundingCoordinator(input.config.harnessWalletSeed, "harness");
  return coordinator.run(async () => {
  const clock = input.clock ?? (() => new Date());
  const startedAt = clock().toISOString();
  const funding = input.fundingAdapter ?? adapter(input.config, input.runtime);
  if (funding.mode !== input.config.mode) throw new RangeError("funding adapter mode does not match the selected config mode");
  const expectedFundingAmount = input.config.mode === "aa-minter"
    ? input.config.scenarioAmountBaseUnits
    : scaleSixDecimalWholeCoins(input.config.scenarioWholeCoins);
  const moved = expectedFundingAmount / 2n;
  if (moved <= 0n) throw new RangeError("scenario funding amount must permit a positive transfer");

  const verifiedMinter = await runtimeStage("Minter identity verification", () =>
    input.runtime.verifyMinterIdentity(input.config, input.legacyReceipt));
  preflightLegacyAaDeployment({
    config: input.config,
    legacy: input.legacyReceipt,
    verifiedMinter,
  });
  const accounts = await runtimeStage("fresh account registration", () =>
    input.runtime.createFreshAccounts(input.config, input.legacyReceipt));
  if (!Array.isArray(accounts) || accounts.length !== 2) throw new RangeError("runtime must return exactly two fresh AA accounts");
  const [first, second] = accounts;
  if (!first || !second || first.authorizationHandle === undefined || first.authorizationHandle === null ||
      second.authorizationHandle === undefined || second.authorizationHandle === null ||
      first.authorizationHandle === second.authorizationHandle) {
    throw new RangeError("fresh AA accounts must carry distinct authorization handles");
  }
  const firstAccountId = canonicalTokenColor(first.accountId);
  const secondAccountId = canonicalTokenColor(second.accountId);
  if (first.accountId !== firstAccountId || second.accountId !== secondAccountId) {
    throw new RangeError("runtime must return canonical unprefixed lower-case account ids");
  }
  if (firstAccountId === secondAccountId) throw new RangeError("fresh AA accounts must be distinct");
  const firstAccount = securedAccount(firstAccountId, first.registrationTxId, first.authorizationHandle);
  const secondAccount = securedAccount(secondAccountId, second.registrationTxId, second.authorizationHandle);
  const funded: FundingResult[] = [];
  const transactions: AaRunReceipt["transactions"][number][] = [];
  const usedTxIds = new Set<string>();
  const recordTx = (operation: AaRunReceipt["transactions"][number]["operation"], raw: unknown) => {
    const normalized = txId(raw, operation);
    if (usedTxIds.has(normalized)) throw new RangeError("harness transactions must have distinct transaction ids");
    usedTxIds.add(normalized);
    transactions.push({ operation, txId: normalized });
  };
  recordTx("execute", first.registrationTxId);
  recordTx("execute", second.registrationTxId);
  const acceptFunding = (result: FundingResult) => {
    if (result.mode !== input.config.mode || result.token.source !== input.config.mode) {
      throw new RangeError("funding result mode does not match the selected config mode");
    }
    if (result.amountBaseUnits !== expectedFundingAmount) {
      throw new RangeError("funding result amount does not match the scenario amount");
    }
    if (result.managerBalanceBefore !== 0n) {
      throw new RangeError("fresh AA account funding balance must start at zero");
    }
    if (result.transactions.length !== 2 ||
        result.transactions[0]?.operation !== "mint" ||
        result.transactions[1]?.operation !== "deposit") {
      throw new RangeError("funding result must contain exactly ordered mint and deposit transactions");
    }
    for (const transaction of result.transactions) recordTx(transaction.operation, transaction.txId);
    funded.push(result);
  };
  if (input.config.mode === "aa-minter") {
    const config = input.config;
    acceptFunding(await runtimeStage("AA-Minter funding", () => funding.fund({
      mode: "aa-minter",
      accountId: firstAccountId,
      amountBaseUnits: config.scenarioAmountBaseUnits,
    })));
  } else {
    const config = input.config;
    for (const tokenName of ["WBTC", "WETH"] as const) {
      acceptFunding(await runtimeStage(`Offer Files ${tokenName} funding`, () => funding.fund({
        mode: "offer-files-faucet",
        accountId: firstAccountId,
        tokenName,
        wholeCoins: config.scenarioWholeCoins,
      })));
    }
  }
  const primary = funded[0]!;
  const transfer = await runtimeStage("shielded internal transfer", () => input.runtime.transferShielded({
    config: input.config,
    receipt: input.legacyReceipt,
    from: firstAccount,
    to: secondAccount,
    color: primary.token.color,
    amount: moved,
  }));
  recordTx("execute", transfer.txId);
  if (
    transfer.fromBefore !== primary.managerBalanceAfter ||
    transfer.fromAfter !== transfer.fromBefore - moved ||
    transfer.toBefore !== 0n ||
    transfer.toAfter !== transfer.toBefore + moved ||
    [transfer.fromBefore, transfer.fromAfter, transfer.toBefore, transfer.toAfter].some((balance) => balance < 0n)
  ) {
    throw new RangeError("shielded internal transfer deltas are not exact");
  }
  const withdrawn = await runtimeStage("shielded withdrawal", () => input.runtime.withdrawShielded({
    config: input.config,
    receipt: input.legacyReceipt,
    account: secondAccount,
    color: primary.token.color,
    amount: moved,
  }));
  recordTx("withdraw", withdrawn.txId);
  if (
    withdrawn.managerBefore !== transfer.toAfter ||
    withdrawn.managerAfter !== withdrawn.managerBefore - moved ||
    withdrawn.walletBefore !== primary.walletBalanceAfterDeposit ||
    withdrawn.walletAfter !== withdrawn.walletBefore + moved ||
    [withdrawn.managerBefore, withdrawn.managerAfter, withdrawn.walletBefore, withdrawn.walletAfter].some((balance) => balance < 0n)
  ) {
    throw new RangeError("shielded withdrawal deltas are not exact");
  }
  const tokens = funded.map((result) => result.token);
  const deploymentReceipt = decorateLegacyAaDeploymentReceipt({
    legacy: input.legacyReceipt,
    config: input.config,
    tokens,
    verifiedMinter,
  });
  const runReceipt = buildAaRunReceipt({
    schemaVersion: AA_RUN_RECEIPT_VERSION,
    network: input.config.networkId,
    mode: input.config.mode,
    managerAddress: input.config.managerAddress,
    tokens,
    balanceDeltas: [
      ...funded.map((result) => ({
        accountId: firstAccountId,
        color: result.token.color,
        before: result.managerBalanceBefore.toString(),
        after: result.managerBalanceAfter.toString(),
      })),
      { accountId: firstAccountId, color: primary.token.color, before: transfer.fromBefore.toString(), after: transfer.fromAfter.toString() },
      { accountId: secondAccountId, color: primary.token.color, before: transfer.toBefore.toString(), after: transfer.toAfter.toString() },
      { accountId: secondAccountId, color: primary.token.color, before: withdrawn.managerBefore.toString(), after: withdrawn.managerAfter.toString() },
    ],
    transactions,
    startedAt,
    finishedAt: clock().toISOString(),
  });
  assertNoLiteralSecret(deploymentReceipt, input.config.harnessWalletSeed);
  assertNoLiteralSecret(runReceipt, input.config.harnessWalletSeed);
  return { deploymentReceipt, runReceipt };
  }, isWalletSessionLifecycleError);
}
