import { describe, expect, it, vi } from "vitest";

import { parseLegacyAaDeploymentReceipt } from "../integration/deployment-receipt.js";
import { parseFundingEnvironment, type FundingConfig } from "../integration/funding/router.js";
import type { FundingAdapter, FundingRequest, FundingResult } from "../integration/funding/types.js";
import { WalletSessionStopError } from "../integration/funding/session-gate.js";
import { runAaFaucetHarness } from "../integration/harness.js";
import type { AaLiveRuntime } from "../integration/runtime/types.js";
import { aaMinterTokenMetadata, offerFilesTokenMetadata } from "../lib/token-metadata.js";

const MANAGER = "11".repeat(32);
const MINTER = "22".repeat(32);
const SHIELDED = "33".repeat(32);
const UNSHIELDED = "44".repeat(32);
const OFFER_FILES = "55".repeat(32);
const FIRST = "66".repeat(32);
const SECOND = "77".repeat(32);
const SEED = "ab".repeat(32);

function environment(mode: FundingConfig["mode"]): Record<string, string> {
  return {
    AA_DEPLOYMENT_PROFILE: "legacy-0.18",
    AA_EXPECTED_COMMIT: "713a20215f33e02904ea5bd699b7de7f76562e1b",
    MIDNIGHT_NETWORK_ID: "undeployed",
    MN_NODE_URL: "http://node:9944",
    MN_INDEXER_URL: "http://indexer:8088/api/v4/graphql",
    MN_INDEXER_WS_URL: "ws://indexer:8088/api/v4/graphql/ws",
    MN_PROOF_SERVER_URL: "http://aa-proof-server:6300",
    AA_WALLET_PROOF_SERVER_URL: "http://proof-server:6300",
    AA_HARNESS_WALLET_SEED: SEED,
    AA_MANAGER_ADDRESS: MANAGER,
    ...(mode === "aa-minter" ? {
      AA_MINTER_ADDRESS: MINTER,
      AA_MINTER_TAG: "TOKA",
      AA_MINTER_SHIELDED_COLOR: SHIELDED,
      AA_MINTER_UNSHIELDED_COLOR: UNSHIELDED,
      AA_HARNESS_MINTER_AMOUNT_BASE_UNITS: "1000000000",
    } : {
      OFFER_FILES_FAUCET: "1",
      OFFER_FILES_CONTRACT: OFFER_FILES,
      ZSWAP_API: "http://kernel:9999",
      AA_HARNESS_FAUCET_WHOLE_COINS: "1000",
    }),
  };
}

function legacy(overrides: Record<string, unknown> = {}) {
  return parseLegacyAaDeploymentReceipt({
    network: "undeployed",
    aaCommit: "713a20215f33e02904ea5bd699b7de7f76562e1b",
    manager: { address: MANAGER, domain: "demo-infra:aa:v1" },
    minter: { address: MINTER, tag: "TOKA" },
    mints: {
      shielded: { color: SHIELDED, tx: "stock-shielded", recipient: "wallet" },
      unshielded: { color: UNSHIELDED, tx: "stock-unshielded", recipient: "address" },
    },
    deployedAt: "2026-09-04T20:00:00.000Z",
    tookSeconds: 42,
    ...overrides,
  });
}

function fundingAdapter(config: FundingConfig, mutate: Partial<FundingResult> = {}) {
  let index = 0;
  const fund = vi.fn(async (request: FundingRequest): Promise<FundingResult> => {
    index += 1;
    const amount = request.mode === "aa-minter" ? request.amountBaseUnits : request.wholeCoins * 1_000_000n;
    const token = request.mode === "aa-minter"
      ? aaMinterTokenMetadata({ family: "shielded", color: SHIELDED, internalDeploymentTag: "TOKA" })
      : offerFilesTokenMetadata({ name: request.tokenName, family: "shielded", offerFilesAddress: OFFER_FILES, decimals: 6 });
    return {
      mode: config.mode,
      token,
      amountBaseUnits: amount,
      walletBalanceBefore: 5n,
      walletBalanceAfterMint: 5n + amount,
      walletBalanceAfterDeposit: 5n,
      managerBalanceBefore: 0n,
      managerBalanceAfter: amount,
      transactions: [
        { operation: "mint", txId: `mint-${index}` },
        { operation: "deposit", txId: `deposit-${index}` },
      ],
      ...mutate,
    };
  });
  return { mode: config.mode, fund } as FundingAdapter & { fund: typeof fund };
}

function liveRuntime(config: FundingConfig, overrides: Partial<AaLiveRuntime> = {}) {
  const transferShielded = vi.fn(async (input: Parameters<AaLiveRuntime["transferShielded"]>[0]) => ({
    txId: "transfer",
    fromBefore: config.mode === "aa-minter" ? config.scenarioAmountBaseUnits : config.scenarioWholeCoins * 1_000_000n,
    fromAfter: input.amount,
    toBefore: 0n,
    toAfter: input.amount,
  }));
  const withdrawShielded = vi.fn(async (input: Parameters<AaLiveRuntime["withdrawShielded"]>[0]) => ({
    txId: "withdraw",
    managerBefore: input.amount,
    managerAfter: 0n,
    walletBefore: 5n,
    walletAfter: 5n + input.amount,
  }));
  const runtime = {
    sessions: {} as never,
    aaMinterFunding: {} as never,
    verifyMinterIdentity: vi.fn(async () => ({
      address: MINTER,
      tag: "TOKA",
      shieldedColor: SHIELDED,
      unshieldedColor: UNSHIELDED,
    })),
    createFreshAccounts: vi.fn(async () => [
      { accountId: FIRST, registrationTxId: "register-1", authorizationHandle: "AUTH-ONE" },
      { accountId: SECOND, registrationTxId: "register-2", authorizationHandle: "AUTH-TWO" },
    ] as const),
    transferShielded,
    withdrawShielded,
    ...overrides,
  } as AaLiveRuntime & {
    transferShielded: typeof transferShielded;
    withdrawShielded: typeof withdrawShielded;
  };
  return runtime;
}

const clock = () => {
  const values = [new Date("2026-09-04T21:00:00.000Z"), new Date("2026-09-04T21:10:00.000Z")];
  return () => values.shift()!;
};

describe("AA-local harness orchestration", () => {
  it.each(["aa-minter", "offer-files-faucet"] as const)("runs exact %s scenario and emits sanitized receipts", async (mode) => {
    const config = parseFundingEnvironment(environment(mode));
    const funding = fundingAdapter(config);
    const runtime = liveRuntime(config);
    const result = await runAaFaucetHarness({
      config,
      legacyReceipt: legacy(),
      runtime,
      fundingAdapter: funding,
      clock: clock(),
    });

    expect(funding.fund).toHaveBeenCalledTimes(mode === "aa-minter" ? 1 : 2);
    if (mode === "aa-minter") {
      expect(funding.fund).toHaveBeenCalledWith({ mode, accountId: FIRST, amountBaseUnits: 1_000_000_000n });
      expect(result.deploymentReceipt.tokens.map((token) => token.name)).toEqual(["AATEST-S", "AATEST-U"]);
    } else {
      expect(funding.fund.mock.calls.map(([request]) => (request as any).tokenName)).toEqual(["WBTC", "WETH"]);
      expect(result.deploymentReceipt.tokens.map((token) => token.name)).toEqual(["AATEST-S", "AATEST-U", "WBTC", "WETH"]);
    }
    expect(runtime.transferShielded).toHaveBeenCalledOnce();
    expect(runtime.withdrawShielded).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain(SEED);
    expect(result.runReceipt.transactions).toHaveLength(mode === "aa-minter" ? 6 : 8);
  });

  it("validates the deployment identity before account registration or funding effects", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const funding = fundingAdapter(config);
    const runtime = liveRuntime(config);
    await expect(runAaFaucetHarness({
      config,
      legacyReceipt: legacy({ network: "wrong" }),
      runtime,
      fundingAdapter: funding,
    })).rejects.toThrow(/network does not match/);
    expect(runtime.createFreshAccounts).not.toHaveBeenCalled();
    expect(funding.fund).not.toHaveBeenCalled();
  });

  it("rejects wrong adapter mode and a too-small AA amount before any runtime effect", async () => {
    const config = parseFundingEnvironment({ ...environment("aa-minter"), AA_HARNESS_MINTER_AMOUNT_BASE_UNITS: "1" });
    const runtime = liveRuntime(config);
    await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: fundingAdapter(config) }))
      .rejects.toThrow(/permit a positive transfer/);
    expect(runtime.verifyMinterIdentity).not.toHaveBeenCalled();

    const normal = parseFundingEnvironment(environment("aa-minter"));
    const wrong = { ...fundingAdapter(normal), mode: "offer-files-faucet" as const };
    const untouched = liveRuntime(normal);
    await expect(runAaFaucetHarness({ config: normal, legacyReceipt: legacy(), runtime: untouched, fundingAdapter: wrong }))
      .rejects.toThrow(/mode does not match/);
    expect(untouched.verifyMinterIdentity).not.toHaveBeenCalled();
  });

  it("normalizes transaction ids incrementally and stops before withdrawal on a duplicate", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const funding = fundingAdapter(config);
    const runtime = liveRuntime(config, {
      transferShielded: vi.fn(async (input) => ({
        txId: "mint-1",
        fromBefore: 1_000_000_000n,
        fromAfter: 500_000_000n,
        toBefore: 0n,
        toAfter: input.amount,
      })),
    });
    await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: funding }))
      .rejects.toThrow(/distinct transaction ids/);
    expect(runtime.withdrawShielded).not.toHaveBeenCalled();
  });

  it("passes authorization handles non-enumerably and never surfaces an auth secret from runtime errors", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const authSecret = "AUTH-PRIVATE-MATERIAL";
    let serializedTransfer = "";
    const runtime = liveRuntime(config, {
      createFreshAccounts: vi.fn(async () => [
        { accountId: FIRST, registrationTxId: "register-1", authorizationHandle: authSecret },
        { accountId: SECOND, registrationTxId: "register-2", authorizationHandle: "OTHER-AUTH" },
      ] as const),
      transferShielded: vi.fn(async (input) => {
        serializedTransfer = JSON.stringify(input);
        throw new Error(authSecret);
      }),
    });
    let surfaced = "";
    try {
      await runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: fundingAdapter(config) });
    } catch (error) {
      surfaced = String(error);
    }
    expect(serializedTransfer).not.toContain(authSecret);
    expect(surfaced).not.toContain(authSecret);
    expect(surfaced).toContain("shielded internal transfer failed");
  });

  it("rejects blank or duplicate registration transaction ids before funding", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    for (const registrationTxId of ["  ", "register-1"]) {
      const runtime = liveRuntime(config, {
        createFreshAccounts: vi.fn(async () => [
          { accountId: FIRST, registrationTxId: "register-1", authorizationHandle: "ONE" },
          { accountId: SECOND, registrationTxId, authorizationHandle: "TWO" },
        ] as const),
      });
      const funding = fundingAdapter(config);
      await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: funding }))
        .rejects.toThrow(/empty transaction id|distinct transaction ids/);
      expect(funding.fund).not.toHaveBeenCalled();
    }
  });

  it("rejects concurrent whole-harness use of one seed and permanently poisons lifecycle uncertainty", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const concurrentConfig = parseFundingEnvironment({
      ...environment("aa-minter"),
      AA_HARNESS_WALLET_SEED: "d1".repeat(32),
    });
    const firstRuntime = liveRuntime(concurrentConfig, {
      verifyMinterIdentity: vi.fn(async () => {
        await barrier;
        return { address: MINTER, tag: "TOKA", shieldedColor: SHIELDED, unshieldedColor: UNSHIELDED };
      }),
    });
    const first = runAaFaucetHarness({
      config: concurrentConfig,
      legacyReceipt: legacy(),
      runtime: firstRuntime,
      fundingAdapter: fundingAdapter(concurrentConfig),
    });
    await vi.waitFor(() => expect(firstRuntime.verifyMinterIdentity).toHaveBeenCalledOnce());
    const competing = liveRuntime(concurrentConfig);
    await expect(runAaFaucetHarness({
      config: concurrentConfig,
      legacyReceipt: legacy(),
      runtime: competing,
      fundingAdapter: fundingAdapter(concurrentConfig),
    })).rejects.toThrow(/already active/);
    expect(competing.verifyMinterIdentity).not.toHaveBeenCalled();
    release();
    await first;

    const poisonConfig = parseFundingEnvironment({
      ...environment("aa-minter"),
      AA_HARNESS_WALLET_SEED: "d2".repeat(32),
    });
    const failing = liveRuntime(poisonConfig, {
      verifyMinterIdentity: vi.fn(async () => { throw new WalletSessionStopError("uncertain"); }),
    });
    await expect(runAaFaucetHarness({
      config: poisonConfig,
      legacyReceipt: legacy(),
      runtime: failing,
      fundingAdapter: fundingAdapter(poisonConfig),
    })).rejects.toThrow(/lifecycle failed/);
    const replacement = liveRuntime(poisonConfig);
    await expect(runAaFaucetHarness({
      config: poisonConfig,
      legacyReceipt: legacy(),
      runtime: replacement,
      fundingAdapter: fundingAdapter(poisonConfig),
    })).rejects.toThrow(/poisoned/);
    expect(replacement.verifyMinterIdentity).not.toHaveBeenCalled();
  });

  it.each([
    ["dirty fresh balance", { managerBalanceBefore: 1n }, /must start at zero/],
    ["wrong funding amount", { amountBaseUnits: 2n }, /scenario amount/],
  ] as const)("rejects %s immediately", async (_label, mutation, expected) => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const runtime = liveRuntime(config);
    await expect(runAaFaucetHarness({
      config,
      legacyReceipt: legacy(),
      runtime,
      fundingAdapter: fundingAdapter(config, mutation),
    })).rejects.toThrow(expected);
    expect(runtime.transferShielded).not.toHaveBeenCalled();
  });

  it("refuses malformed, noncanonical, duplicate, or unauthorized account records before funding", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const cases: readonly unknown[] = [
      [{ accountId: FIRST, registrationTxId: "register-1", authorizationHandle: "ONE" }],
      [
        { accountId: `0x${FIRST}`, registrationTxId: "register-1", authorizationHandle: "ONE" },
        { accountId: SECOND, registrationTxId: "register-2", authorizationHandle: "TWO" },
      ],
      [
        { accountId: FIRST, registrationTxId: "register-1", authorizationHandle: "ONE" },
        { accountId: FIRST, registrationTxId: "register-2", authorizationHandle: "TWO" },
      ],
      [
        { accountId: FIRST, registrationTxId: "register-1", authorizationHandle: undefined },
        { accountId: SECOND, registrationTxId: "register-2", authorizationHandle: "TWO" },
      ],
      [
        { accountId: FIRST, registrationTxId: "register-1", authorizationHandle: "SAME" },
        { accountId: SECOND, registrationTxId: "register-2", authorizationHandle: "SAME" },
      ],
    ];
    for (const accounts of cases) {
      const runtime = liveRuntime(config, { createFreshAccounts: vi.fn(async () => accounts) as never });
      const funding = fundingAdapter(config);
      await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: funding })).rejects.toThrow();
      expect(funding.fund).not.toHaveBeenCalled();
    }
  });

  it("requires exactly ordered mint and deposit funding transactions and matching token source", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const invalid: readonly Partial<FundingResult>[] = [
      { transactions: [] as never },
      { transactions: [
        { operation: "deposit", txId: "deposit-1" },
        { operation: "mint", txId: "mint-1" },
      ] as never },
      { token: offerFilesTokenMetadata({ name: "WBTC", family: "shielded", offerFilesAddress: OFFER_FILES, decimals: 6 }) },
    ];
    for (const mutation of invalid) {
      const runtime = liveRuntime(config);
      await expect(runAaFaucetHarness({
        config,
        legacyReceipt: legacy(),
        runtime,
        fundingAdapter: fundingAdapter(config, mutation),
      })).rejects.toThrow(/ordered mint and deposit|mode does not match/);
      expect(runtime.transferShielded).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["from before", { fromBefore: 999_999_999n }],
    ["from after", { fromAfter: 499_999_999n }],
    ["dirty destination", { toBefore: 1n, toAfter: 500_000_001n }],
    ["to after", { toAfter: 499_999_999n }],
    ["negative", { fromAfter: -1n }],
  ] as const)("rejects a transfer with an inexact %s equation before withdrawal", async (_label, mutation) => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const runtime = liveRuntime(config, {
      transferShielded: vi.fn(async (input) => ({
        txId: "transfer",
        fromBefore: 1_000_000_000n,
        fromAfter: 500_000_000n,
        toBefore: 0n,
        toAfter: input.amount,
        ...mutation,
      })),
    });
    await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: fundingAdapter(config) }))
      .rejects.toThrow(/transfer deltas are not exact/);
    expect(runtime.withdrawShielded).not.toHaveBeenCalled();
  });

  it("rejects a blank transfer transaction id before withdrawal", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const runtime = liveRuntime(config, {
      transferShielded: vi.fn(async (input) => ({
        txId: "  ",
        fromBefore: 1_000_000_000n,
        fromAfter: 500_000_000n,
        toBefore: 0n,
        toAfter: input.amount,
      })),
    });
    await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: fundingAdapter(config) }))
      .rejects.toThrow(/empty transaction id/);
    expect(runtime.withdrawShielded).not.toHaveBeenCalled();
  });

  it.each([
    ["manager before", { managerBefore: 499_999_999n }],
    ["manager after", { managerAfter: 1n }],
    ["wallet before", { walletBefore: 4n, walletAfter: 500_000_004n }],
    ["wallet after", { walletAfter: 500_000_004n }],
    ["negative", { managerAfter: -1n }],
  ] as const)("rejects a withdrawal with an inexact %s equation", async (_label, mutation) => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const runtime = liveRuntime(config, {
      withdrawShielded: vi.fn(async (input) => ({
        txId: "withdraw",
        managerBefore: input.amount,
        managerAfter: 0n,
        walletBefore: 5n,
        walletAfter: 5n + input.amount,
        ...mutation,
      })),
    });
    await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: fundingAdapter(config) }))
      .rejects.toThrow(/withdrawal deltas are not exact/);
  });

  it("rejects a blank withdrawal transaction id", async () => {
    const config = parseFundingEnvironment(environment("aa-minter"));
    const runtime = liveRuntime(config, {
      withdrawShielded: vi.fn(async (input) => ({
        txId: "\t",
        managerBefore: input.amount,
        managerAfter: 0n,
        walletBefore: 5n,
        walletAfter: 5n + input.amount,
      })),
    });
    await expect(runAaFaucetHarness({ config, legacyReceipt: legacy(), runtime, fundingAdapter: fundingAdapter(config) }))
      .rejects.toThrow(/empty transaction id/);
  });
});
