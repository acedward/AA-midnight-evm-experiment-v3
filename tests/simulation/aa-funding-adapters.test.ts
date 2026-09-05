import { describe, expect, it, vi } from "vitest";

import { AaMinterFundingAdapter } from "../integration/funding/aa-minter.js";
import { HttpKnownTokenRegistry } from "../integration/funding/known-token-registry.js";
import { OfferFilesFaucetAdapter } from "../integration/funding/offer-files-faucet.js";
import { parseFundingEnvironment, type FundingEnvironment } from "../integration/funding/router.js";
import { SingleSessionGate } from "../integration/funding/session-gate.js";
import { WalletSessionStopError } from "../integration/funding/session-gate.js";
import type {
  AaMinterFundingPort,
  FundingWalletSession,
  FundingWalletSessionFactory,
  KnownTokenRegistryPort,
  NoncePort,
} from "../integration/funding/types.js";
import {
  UINT64_MAX,
  domainSepFromName,
  offerFilesTokenColor,
  scaleSixDecimalWholeCoins,
} from "../lib/token-metadata.js";

const MANAGER = "11".repeat(32);
const MINTER = "22".repeat(32);
const MINTER_COLOR = "33".repeat(32);
const MINTER_UNSHIELDED_COLOR = "34".repeat(32);
const OFFER_FILES = "44".repeat(32);
const ACCOUNT = "55".repeat(32);
const SEED = "ab".repeat(32);

function commonEnv(): Record<string, string> {
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
  };
}

function faucetConfig(seed = SEED) {
  return parseFundingEnvironment({
    ...commonEnv(),
    OFFER_FILES_FAUCET: "1",
    OFFER_FILES_CONTRACT: OFFER_FILES,
    ZSWAP_API: "http://kernel:9999",
    AA_HARNESS_WALLET_SEED: seed,
  });
}

function minterConfig(seed = SEED) {
  return parseFundingEnvironment({
    ...commonEnv(),
    AA_MINTER_ADDRESS: MINTER,
    AA_MINTER_TAG: "TOKA",
    AA_MINTER_SHIELDED_COLOR: MINTER_COLOR,
    AA_MINTER_UNSHIELDED_COLOR: MINTER_UNSHIELDED_COLOR,
    AA_HARNESS_WALLET_SEED: seed,
  });
}

function registryRows(overrides: readonly Record<string, unknown>[] = []): readonly unknown[] {
  const byName = new Map([
    ["WBTC", {
      token_color: offerFilesTokenColor("WBTC", OFFER_FILES),
      name: "WBTC",
      kind: "shielded",
      decimals: 6,
    }],
    ["WETH", {
      token_color: offerFilesTokenColor("WETH", OFFER_FILES),
      name: "WETH",
      kind: "shielded",
      decimals: 6,
    }],
  ]);
  for (const override of overrides) {
    const name = String(override.name);
    byName.set(name, { ...byName.get(name), ...override } as never);
  }
  return [...byName.values()];
}

function nonceSource(): NoncePort {
  let byte = 6;
  let uint128 = 122n;
  return {
    nextUint128: () => ++uint128,
    nextBytes32: () => new Uint8Array(32).fill(++byte),
  };
}

class StatefulSessions implements FundingWalletSessionFactory {
  readonly events: string[] = [];
  wallet = 5n;
  manager = 10n;
  active = 0;
  maxActive = 0;
  stopFailures = 0;
  wrongMintColor: string | undefined;
  wrongMintValue: bigint | undefined;
  wrongWait: bigint | undefined;
  leaveWalletAfterDeposit = false;
  skipManagerCredit = false;
  mintDomainSeparator: Uint8Array | undefined;
  mintTxId = "mint-tx";
  depositTxId = "deposit-tx";
  stopBarrier: Promise<void> | undefined;
  openError: Error | undefined;
  readError: Error | undefined;
  stopError: Error | undefined;
  readonly serializedOpenInputs: string[] = [];

  async open(input: Parameters<FundingWalletSessionFactory["open"]>[0]): Promise<FundingWalletSession> {
    this.events.push(`open:${input.label}`);
    this.serializedOpenInputs.push(JSON.stringify(input));
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    if (this.openError) throw this.openError;
    const sessions = this;
    return {
      async readShieldedWalletBalance() {
        sessions.events.push("wallet:read");
        if (sessions.readError) throw sessions.readError;
        return sessions.wallet;
      },
      async waitForShieldedWalletBalance(_color, exact) {
        sessions.events.push(`wallet:wait:${exact}`);
        return sessions.wrongWait ?? sessions.wallet;
      },
      async callOfferFilesMintShielded(_address, _artifact, proofUrl, args) {
        sessions.events.push(`mint:${args.length}:${proofUrl}`);
        sessions.mintDomainSeparator = args[0];
        sessions.wallet += args[1];
        return {
          txId: sessions.mintTxId,
          color: sessions.wrongMintColor ?? (
            Buffer.from(args[0]).equals(Buffer.from(domainSepFromName("WETH")))
              ? offerFilesTokenColor("WETH", OFFER_FILES)
              : offerFilesTokenColor("WBTC", OFFER_FILES)
          ),
          value: sessions.wrongMintValue ?? args[1],
        };
      },
      async readManagerShieldedBalance(_address, _artifact, proofUrl) {
        sessions.events.push(`manager:read:${proofUrl}`);
        return sessions.manager;
      },
      async depositShielded(_address, _artifact, proofUrl, input) {
        sessions.events.push(`deposit:${input.nonce.length}:${proofUrl}`);
        if (!sessions.leaveWalletAfterDeposit) sessions.wallet -= input.value;
        if (!sessions.skipManagerCredit) sessions.manager += input.value;
        return { txId: sessions.depositTxId };
      },
      async stop() {
        sessions.events.push("stop");
        await sessions.stopBarrier;
        sessions.active -= 1;
        if (sessions.stopFailures > 0) {
          sessions.stopFailures -= 1;
          throw sessions.stopError ?? new Error("stop exploded");
        }
      },
    };
  }
}

function faucetAdapter(
  sessions = new StatefulSessions(),
  rows: readonly unknown[] = registryRows(),
  seed = SEED,
  source = nonceSource(),
): { adapter: OfferFilesFaucetAdapter; sessions: StatefulSessions; getKnownTokens: ReturnType<typeof vi.fn> } {
  const getKnownTokens = vi.fn(async () => rows);
  const registry: KnownTokenRegistryPort = { getKnownTokens };
  return {
    adapter: new OfferFilesFaucetAdapter(faucetConfig(seed) as never, {
      registry,
      sessions,
      nonces: source,
    }),
    sessions,
    getKnownTokens,
  };
}

describe("six-decimal amount policy", () => {
  it("scales exactly once and permits the largest Uint64-safe whole-coin amount", () => {
    expect(scaleSixDecimalWholeCoins(2n)).toBe(2_000_000n);
    const maximumWhole = UINT64_MAX / 1_000_000n;
    expect(scaleSixDecimalWholeCoins(maximumWhole)).toBe(maximumWhole * 1_000_000n);
  });

  it.each([0n, -1n, UINT64_MAX / 1_000_000n + 1n])("rejects unsafe amount %s", (amount) => {
    expect(() => scaleSixDecimalWholeCoins(amount)).toThrow(/positive bigint|exceeds Uint64/);
  });
});

describe("GET-only known-token registry", () => {
  it("issues exactly GET /v1/known-tokens and exposes no generic write surface", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(registryRows()), { status: 200 }));
    const registry = new HttpKnownTokenRegistry("http://kernel:9999/", request as typeof fetch);
    expect("request" in registry).toBe(false);
    expect("post" in registry).toBe(false);
    await expect(registry.getKnownTokens()).resolves.toHaveLength(2);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]![0]).toBe("http://kernel:9999/v1/known-tokens");
    expect(request.mock.calls[0]![1]).toMatchObject({ method: "GET", redirect: "error" });
    expect(request.mock.calls[0]![1]).not.toHaveProperty("body");
  });

  it("fails closed on a non-array or non-success response", async () => {
    await expect(new HttpKnownTokenRegistry("http://kernel", async () => new Response("{}") as never)
      .getKnownTokens()).rejects.toThrow(/must return an array/);
    await expect(new HttpKnownTokenRegistry("http://kernel", async () => new Response("no", { status: 503 }) as never)
      .getKnownTokens()).rejects.toThrow(/status 503/);
  });
});

describe("Offer Files two-session funding adapter", () => {
  it("validates both registry tokens once, calls the old ABI with three args, and reconciles deltas", async () => {
    const { adapter, sessions, getKnownTokens } = faucetAdapter();
    const result = await adapter.fund({ mode: "offer-files-faucet", accountId: ACCOUNT, tokenName: "WBTC", wholeCoins: 2n });

    expect(getKnownTokens).toHaveBeenCalledOnce();
    expect(result.token).toMatchObject({ name: "WBTC", source: "offer-files-faucet", decimals: 6 });
    expect(result.amountBaseUnits).toBe(2_000_000n);
    expect(result.walletBalanceAfterMint - result.walletBalanceBefore).toBe(2_000_000n);
    expect(result.walletBalanceAfterDeposit).toBe(result.walletBalanceBefore);
    expect(result.managerBalanceAfter - result.managerBalanceBefore).toBe(2_000_000n);
    expect(result.transactions).toEqual([
      { operation: "mint", txId: "mint-tx" },
      { operation: "deposit", txId: "deposit-tx" },
    ]);
    expect(sessions.maxActive).toBe(1);
    expect(sessions.serializedOpenInputs.join("\n")).not.toContain(SEED);
    expect(sessions.events).toEqual([
      "open:offer-files-mint-WBTC",
      "wallet:read",
      "mint:3:http://proof-server:6300",
      "stop",
      "open:manager-deposit-WBTC",
      "wallet:wait:2000005",
      "manager:read:http://aa-proof-server:6300",
      "deposit:32:http://aa-proof-server:6300",
      "manager:read:http://aa-proof-server:6300",
      "wallet:wait:5",
      "stop",
    ]);
  });

  it("uses the exact WBTC domain separator and supports the separately-derived WETH row", async () => {
    const sessions = new StatefulSessions();
    const { adapter } = faucetAdapter(sessions);
    const result = await adapter.fund({ mode: "offer-files-faucet", accountId: ACCOUNT, tokenName: "WETH", wholeCoins: 1n });
    expect(result.token.color).toBe(offerFilesTokenColor("WETH", OFFER_FILES));
    expect(sessions.mintDomainSeparator).toEqual(domainSepFromName("WETH"));
    expect(sessions.mintDomainSeparator).not.toEqual(domainSepFromName("WBTC"));
  });

  it("caches one validated registry GET across sequential WBTC and WETH funding", async () => {
    const { adapter, getKnownTokens } = faucetAdapter();
    await adapter.fund({ mode: "offer-files-faucet", accountId: ACCOUNT, tokenName: "WBTC", wholeCoins: 1n });
    await adapter.fund({ mode: "offer-files-faucet", accountId: ACCOUNT, tokenName: "WETH", wholeCoins: 1n });
    expect(getKnownTokens).toHaveBeenCalledOnce();
  });

  it("freezes returned metadata so a caller cannot poison the cached registry snapshot", async () => {
    const { adapter } = faucetAdapter();
    const first = await adapter.fund({ mode: "offer-files-faucet", accountId: ACCOUNT, tokenName: "WBTC", wholeCoins: 1n });
    expect(Object.isFrozen(first.token)).toBe(true);
    expect(() => { (first.token as any).color = "99".repeat(32); }).toThrow();
    const second = await adapter.fund({ mode: "offer-files-faucet", accountId: ACCOUNT, tokenName: "WETH", wholeCoins: 1n });
    expect(second.token.color).toBe(offerFilesTokenColor("WETH", OFFER_FILES));
  });

  it.each([
    ["wrong colour", registryRows([{ name: "WBTC", token_color: "66".repeat(32) }]), /does not match/],
    ["wrong kind", registryRows([{ name: "WBTC", kind: "unshielded" }]), /kind must be shielded/],
    ["wrong decimals", registryRows([{ name: "WBTC", decimals: 5 }]), /decimals must be exactly 6/],
    ["missing row", registryRows().filter((row: any) => row.name !== "WETH"), /exactly one WETH row/],
    ["duplicate row", [...registryRows(), (registryRows()[0] as object)], /exactly one WBTC row/],
  ] as const)("rejects registry invariant: %s", async (_name, rows, error) => {
    await expect(faucetAdapter(new StatefulSessions(), rows).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(error);
  });

  it.each([
    ["mint colour", (s: StatefulSessions) => { s.wrongMintColor = "77".repeat(32); }, /wrong token colour/],
    ["mint value", (s: StatefulSessions) => { s.wrongMintValue = 9n; }, /wrong token value/],
    ["observed wallet", (s: StatefulSessions) => { s.wrongWait = 9n; }, /wallet mint delta is not exact/],
    ["Manager delta", (s: StatefulSessions) => { s.skipManagerCredit = true; }, /Manager shielded balance delta is not exact/],
    ["wallet post-deposit", (s: StatefulSessions) => { s.leaveWalletAfterDeposit = true; }, /pre-mint value/],
  ] as const)("fails closed on wrong %s", async (_name, poison, error) => {
    const sessions = new StatefulSessions();
    poison(sessions);
    await expect(faucetAdapter(sessions).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(error);
  });

  it("keeps a process-wide lock across mint stop and deposit, even across adapter instances", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const firstSessions = new StatefulSessions();
    firstSessions.stopBarrier = barrier;
    const seed = "91".repeat(32);
    const first = faucetAdapter(firstSessions, registryRows(), seed).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    });
    await vi.waitFor(() => expect(firstSessions.events).toContain("stop"));

    const competingSessions = new StatefulSessions();
    await expect(faucetAdapter(competingSessions, registryRows(), seed).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(/already active/);
    expect(competingSessions.events).toHaveLength(0);
    const minterPort = vi.fn();
    const minter = new AaMinterFundingAdapter(minterConfig(seed) as never, {
      funding: { fundShielded: minterPort } as never,
      nonces: nonceSource(),
    });
    await expect(minter.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n })).rejects.toThrow(/already active/);
    expect(minterPort).not.toHaveBeenCalled();
    release();
    await first;
  });

  it("poisons a seed process-wide on stop failure and a fresh adapter cannot reopen it", async () => {
    const seed = "92".repeat(32);
    const failing = new StatefulSessions();
    failing.stopFailures = 1;
    await expect(faucetAdapter(failing, registryRows(), seed).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(/wallet facade stop failed/);

    const replacement = new StatefulSessions();
    await expect(faucetAdapter(replacement, registryRows(), seed).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(/poisoned/);
    expect(replacement.events).toHaveLength(0);
  });

  it("poisons a seed process-wide when facade open throws after starting", async () => {
    const seed = "93".repeat(32);
    const failing = new StatefulSessions();
    failing.openError = new Error("open exploded");
    await expect(faucetAdapter(failing, registryRows(), seed).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(/lifecycle is uncertain/);

    const replacement = new StatefulSessions();
    await expect(faucetAdapter(replacement, registryRows(), seed).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(/poisoned/);
    expect(replacement.events).toHaveLength(0);
  });

  it.each([
    ["zero mint nonce", { nextUint128: (): bigint => 0n, nextBytes32: () => new Uint8Array(32).fill(1) }, /nonzero Uint128/],
    ["zero deposit nonce", { nextUint128: (): bigint => 1n, nextBytes32: () => new Uint8Array(32) }, /nonzero bytes/],
  ] as const)("rejects %s", async (_name, source, error) => {
    await expect(faucetAdapter(new StatefulSessions(), registryRows(), SEED, source).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(error);
  });

  it.each([
    ["blank mint id", (s: StatefulSessions) => { s.mintTxId = "  "; }, /mint returned an empty/],
    ["blank deposit id", (s: StatefulSessions) => { s.depositTxId = "\t"; }, /deposit returned an empty/],
    ["duplicate ids", (s: StatefulSessions) => { s.depositTxId = "mint-tx"; }, /same transaction id/],
    ["negative wallet", (s: StatefulSessions) => { s.wallet = -1n; }, /wallet balance cannot be negative/],
    ["negative Manager", (s: StatefulSessions) => { s.manager = -1n; }, /Manager balance cannot be negative/],
  ] as const)("rejects %s", async (_name, mutate, error) => {
    const sessions = new StatefulSessions();
    mutate(sessions);
    await expect(faucetAdapter(sessions).adapter.fund({
      accountId: ACCOUNT,
      mode: "offer-files-faucet",
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(error);
  });

  it("does not serialize the dedicated seed through the adapter", () => {
    const { adapter } = faucetAdapter();
    expect(JSON.stringify(adapter)).not.toContain(SEED);
  });

  it("rejects a successful dependency result whose transaction id contains the seed", async () => {
    const sessions = new StatefulSessions();
    sessions.mintTxId = `tx-${SEED.toUpperCase()}`;
    await expect(faucetAdapter(sessions).adapter.fund({
      mode: "offer-files-faucet",
      accountId: ACCOUNT,
      tokenName: "WBTC",
      wholeCoins: 1n,
    })).rejects.toThrow(/secret material/);
  });

  it("replaces an Offer Files dependency error containing unrelated credentials with a fixed stage message", async () => {
    const credential = "DATABASE_PASSWORD=untrusted-password";
    const sessions = new StatefulSessions();
    sessions.readError = new Error(credential);
    let surfaced = "";
    try {
      await faucetAdapter(sessions).adapter.fund({
        mode: "offer-files-faucet",
        accountId: ACCOUNT,
        tokenName: "WBTC",
        wholeCoins: 1n,
      });
    } catch (error) {
      surfaced = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    }
    expect(surfaced).toContain("Offer Files wallet balance read failed");
    expect(surfaced).not.toContain(credential);
    expect(surfaced).not.toContain("untrusted-password");
  });

  it.each(["open", "operation", "stop"] as const)("redacts the literal seed from a dependency %s error", async (stage) => {
    const seed = `${stage === "open" ? "a1" : stage === "operation" ? "a2" : "a3"}`.repeat(32);
    const sessions = new StatefulSessions();
    if (stage === "open") sessions.openError = new Error(seed);
    if (stage === "operation") sessions.readError = new Error(seed.toUpperCase());
    if (stage === "stop") {
      sessions.stopFailures = 1;
      sessions.stopError = new Error(seed);
    }
    let surfaced = "";
    try {
      await faucetAdapter(sessions, registryRows(), seed).adapter.fund({
        mode: "offer-files-faucet",
        accountId: ACCOUNT,
        tokenName: "WBTC",
        wholeCoins: 1n,
      });
    } catch (error) {
      surfaced = String(error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : error);
    }
    expect(surfaced.toLowerCase()).not.toContain(seed.toLowerCase());
    expect(surfaced.length).toBeGreaterThan(0);
  });
});

describe("poisoned one-session gate", () => {
  it("awaits stop and permanently refuses another facade after stop fails", async () => {
    const sessions = new StatefulSessions();
    sessions.stopFailures = 1;
    const gate = new SingleSessionGate(sessions);
    await expect(gate.run({} as never, async () => "done")).rejects.toThrow(/wallet facade stop failed/);
    expect(gate.poisoned).toBe(true);
    await expect(gate.run({} as never, async () => "never")).rejects.toThrow(/gate is poisoned/);
    expect(sessions.events.filter((event) => event.startsWith("open:"))).toHaveLength(1);
  });

  it("rejects concurrent use while one facade is active", async () => {
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => { release = resolve; });
    const sessions = new StatefulSessions();
    const gate = new SingleSessionGate(sessions);
    const first = gate.run({ label: "first" } as never, async () => blocker);
    await Promise.resolve();
    await expect(gate.run({ label: "second" } as never, async () => undefined)).rejects.toThrow(/already has an active/);
    release();
    await first;
  });

  it.each([undefined, null])("poisons when facade open rejects with %s", async (reason) => {
    let opens = 0;
    const gate = new SingleSessionGate({
      open: async () => {
        opens += 1;
        throw reason;
      },
    });
    await expect(gate.run({} as never, async () => undefined)).rejects.toThrow(/lifecycle is uncertain/);
    await expect(gate.run({} as never, async () => undefined)).rejects.toThrow(/poisoned/);
    expect(opens).toBe(1);
  });
});

describe("AA-Minter funding adapter", () => {
  it("keeps the default path on its injected Minter port and returns the common reconciled result", async () => {
    const fundShielded = vi.fn(async (input: Parameters<AaMinterFundingPort["fundShielded"]>[0]) => ({
      walletBalanceBefore: 3n,
      walletBalanceAfterMint: 4n,
      walletBalanceAfterDeposit: 3n,
      managerBalanceBefore: 7n,
      managerBalanceAfter: 8n,
      mintColor: MINTER_COLOR,
      mintValue: input.amount,
      mintTxId: "m",
      depositTxId: "d",
    }));
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded },
      nonces: nonceSource(),
    });
    const result = await adapter.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n });
    expect(fundShielded).toHaveBeenCalledOnce();
    expect(fundShielded.mock.calls[0]![0]).toMatchObject({
      amount: 1n,
      minterAddress: MINTER,
      managerAddress: MANAGER,
      color: MINTER_COLOR,
    });
    expect(JSON.stringify(
      fundShielded.mock.calls[0]![0],
      (_key, value) => typeof value === "bigint" ? value.toString() : value,
    )).not.toContain(SEED);
    expect(result).toMatchObject({ mode: "aa-minter", amountBaseUnits: 1n, walletBalanceAfterDeposit: 3n });
  });

  it("validates both Bytes32 nonces before calling the opaque live port", async () => {
    const fundShielded = vi.fn();
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded } as never,
      nonces: { nextUint128: () => 0n, nextBytes32: () => new Uint8Array(31) },
    });
    await expect(adapter.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n })).rejects.toThrow(/mint nonce/);
    expect(fundShielded).not.toHaveBeenCalled();
  });

  it.each([0n, -1n, UINT64_MAX + 1n, 1 as never])("rejects invalid raw AA Uint64 amount %s before the live port", async (amount) => {
    const fundShielded = vi.fn();
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded } as never,
      nonces: nonceSource(),
    });
    await expect(adapter.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: amount }))
      .rejects.toThrow(/positive bigint|exceeds Uint64/);
    expect(fundShielded).not.toHaveBeenCalled();
  });

  it("rejects an all-zero or reused Bytes32 nonce before the live port", async () => {
    const fundShielded = vi.fn();
    const zero = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded } as never,
      nonces: { nextUint128: () => 0n, nextBytes32: () => new Uint8Array(32) },
    });
    await expect(zero.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n })).rejects.toThrow(/nonzero bytes/);

    const repeated = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded } as never,
      nonces: { nextUint128: () => 0n, nextBytes32: () => new Uint8Array(32).fill(9) },
    });
    await expect(repeated.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n })).rejects.toThrow(/deposit nonce was reused/);
    expect(fundShielded).not.toHaveBeenCalled();
  });

  it("poisons Minter funding across fresh adapters on the port's lifecycle-failure signal", async () => {
    const seed = "94".repeat(32);
    const credential = "PRIVATE_API_KEY=do-not-echo";
    const firstPort = vi.fn(async () => { throw new WalletSessionStopError(credential); });
    const first = new AaMinterFundingAdapter(minterConfig(seed) as never, {
      funding: { fundShielded: firstPort } as never,
      nonces: nonceSource(),
    });
    let surfaced = "";
    try {
      await first.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n });
    } catch (error) {
      surfaced = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    }
    expect(surfaced).toContain("AA-Minter funding dependency lifecycle failed");
    expect(surfaced).not.toContain(credential);
    expect(surfaced).not.toContain("do-not-echo");

    const replacementPort = vi.fn();
    const replacement = new AaMinterFundingAdapter(minterConfig(seed) as never, {
      funding: { fundShielded: replacementPort } as never,
      nonces: nonceSource(),
    });
    await expect(replacement.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n }))
      .rejects.toThrow(/poisoned/);
    expect(replacementPort).not.toHaveBeenCalled();
  });

  it("replaces an AA-Minter dependency error containing unrelated credentials with a fixed stage message", async () => {
    const credential = "PROVIDER_PASSWORD=external-password";
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded: async () => { throw new Error(credential); } },
      nonces: nonceSource(),
    });
    let surfaced = "";
    try {
      await adapter.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n });
    } catch (error) {
      surfaced = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    }
    expect(surfaced).toContain("AA-Minter funding dependency failed");
    expect(surfaced).not.toContain(credential);
    expect(surfaced).not.toContain("external-password");
  });

  it.each([
    ["wallet delta", { walletBalanceAfterMint: 5n }, /wallet mint delta/],
    ["wallet post-deposit", { walletBalanceAfterDeposit: 4n }, /pre-mint value/],
    ["Manager delta", { managerBalanceAfter: 9n }, /Manager balance delta/],
    ["mint colour", { mintColor: "88".repeat(32) }, /wrong token colour/],
    ["mint value", { mintValue: 2n }, /wrong token colour or value/],
    ["blank mint id", { mintTxId: " " }, /empty transaction id/],
    ["blank deposit id", { depositTxId: "\t" }, /empty transaction id/],
    ["duplicate ids", { depositTxId: "m" }, /same transaction id/],
    ["negative balance", { walletBalanceBefore: -1n, walletBalanceAfterMint: 0n, walletBalanceAfterDeposit: -1n }, /cannot be negative/],
  ] as const)("rejects wrong %s from the live port", async (_name, override, error) => {
    const fundShielded = vi.fn(async () => ({
      walletBalanceBefore: 3n,
      walletBalanceAfterMint: 4n,
      walletBalanceAfterDeposit: 3n,
      managerBalanceBefore: 7n,
      managerBalanceAfter: 8n,
      mintColor: MINTER_COLOR,
      mintValue: 1n,
      mintTxId: "m",
      depositTxId: "d",
      ...override,
    }));
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded },
      nonces: nonceSource(),
    });
    await expect(adapter.fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1n })).rejects.toThrow(error);
  });

  it("does not serialize the dedicated seed through the default adapter", () => {
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded: vi.fn() } as never,
      nonces: nonceSource(),
    });
    expect(JSON.stringify(adapter)).not.toContain(SEED);
  });

  it("rejects a successful Minter-port result whose transaction id contains the seed", async () => {
    const adapter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: {
        fundShielded: async (input) => ({
          walletBalanceBefore: 0n,
          walletBalanceAfterMint: input.amount,
          walletBalanceAfterDeposit: 0n,
          managerBalanceBefore: 0n,
          managerBalanceAfter: input.amount,
          mintColor: input.color,
          mintValue: input.amount,
          mintTxId: SEED.toUpperCase(),
          depositTxId: "deposit",
        }),
      },
      nonces: nonceSource(),
    });
    await expect(adapter.fund({
      mode: "aa-minter",
      accountId: ACCOUNT,
      amountBaseUnits: 1n,
    })).rejects.toThrow(/secret material/);
  });

  it("makes the stock 1e9-base-unit Minter amount equal 1000 six-decimal faucet coins", async () => {
    const faucet = await faucetAdapter().adapter.fund({
      mode: "offer-files-faucet",
      accountId: ACCOUNT,
      tokenName: "WBTC",
      wholeCoins: 1_000n,
    });
    const funding: AaMinterFundingPort = {
      fundShielded: async (input) => ({
        walletBalanceBefore: 0n,
        walletBalanceAfterMint: input.amount,
        walletBalanceAfterDeposit: 0n,
        managerBalanceBefore: 0n,
        managerBalanceAfter: input.amount,
        mintColor: input.color,
        mintValue: input.amount,
        mintTxId: "minter-mint",
        depositTxId: "minter-deposit",
      }),
    };
    const minter = await new AaMinterFundingAdapter(minterConfig() as never, {
      funding,
      nonces: nonceSource(),
    }).fund({ mode: "aa-minter", accountId: ACCOUNT, amountBaseUnits: 1_000_000_000n });
    expect(faucet.amountBaseUnits).toBe(1_000_000_000n);
    expect(minter.amountBaseUnits).toBe(faucet.amountBaseUnits);
  });

  it("refuses mode/unit mixing before invoking either funding dependency", async () => {
    const sessions = new StatefulSessions();
    await expect(faucetAdapter(sessions).adapter.fund({
      mode: "aa-minter",
      accountId: ACCOUNT,
      amountBaseUnits: 1n,
    } as never)).rejects.toThrow(/requires a faucet funding request/);
    expect(sessions.events).toHaveLength(0);

    const fundShielded = vi.fn();
    const minter = new AaMinterFundingAdapter(minterConfig() as never, {
      funding: { fundShielded } as never,
      nonces: nonceSource(),
    });
    await expect(minter.fund({
      mode: "offer-files-faucet",
      accountId: ACCOUNT,
      tokenName: "WBTC",
      wholeCoins: 1n,
    } as never)).rejects.toThrow(/requires an AA-Minter funding request/);
    expect(fundShielded).not.toHaveBeenCalled();
  });
});
