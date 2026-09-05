import { describe, expect, it, vi } from "vitest";

import {
  createFundingAdapter,
  parseFundingEnvironment,
  type FundingEnvironment,
} from "../integration/funding/router.js";
import type { FundingAdapter } from "../integration/funding/types.js";

const ADAPTER = <M extends FundingAdapter["mode"]>(mode: M): FundingAdapter & { readonly mode: M } => ({
  mode,
  fund: async () => {
    throw new Error("not used by router selection tests");
  },
});

function baseEnv(): Record<string, string> {
  return {
    AA_DEPLOYMENT_PROFILE: "legacy-0.18",
    AA_EXPECTED_COMMIT: "713a20215f33e02904ea5bd699b7de7f76562e1b",
    MIDNIGHT_NETWORK_ID: "undeployed",
    MN_NODE_URL: "http://node:9944",
    MN_INDEXER_URL: "http://indexer:8088/api/v4/graphql",
    MN_INDEXER_WS_URL: "ws://indexer:8088/api/v4/graphql/ws",
    MN_PROOF_SERVER_URL: "http://aa-proof-server:6300",
    AA_WALLET_PROOF_SERVER_URL: "http://proof-server:6300",
    AA_HARNESS_WALLET_SEED: "ab".repeat(32),
    AA_MANAGER_ADDRESS: "11".repeat(32),
    AA_MINTER_ADDRESS: "22".repeat(32),
    AA_MINTER_TAG: "TOKA",
    AA_MINTER_SHIELDED_COLOR: "33".repeat(32),
    AA_MINTER_UNSHIELDED_COLOR: "34".repeat(32),
  };
}

describe("strict AA funding mode selection", () => {
  it.each([undefined, "", "0", "false", "FALSE"])(
    "selects only the AA Minter when OFFER_FILES_FAUCET=%s",
    (flag) => {
      const env: FundingEnvironment = { ...baseEnv(), OFFER_FILES_FAUCET: flag };
      const aaMinter = vi.fn(() => ADAPTER("aa-minter"));
      const offerFiles = vi.fn(() => ADAPTER("offer-files-faucet"));
      const selected = createFundingAdapter(env, { aaMinter, offerFiles });

      expect(selected.config.mode).toBe("aa-minter");
      expect(selected.adapter.mode).toBe("aa-minter");
      expect(aaMinter).toHaveBeenCalledOnce();
      expect(offerFiles).not.toHaveBeenCalled();
    },
  );

  it.each(["1", "true", "TRUE"])("selects only Offer Files when the flag is %s", (flag) => {
    const env = baseEnv();
    delete env.AA_MINTER_ADDRESS;
    delete env.AA_MINTER_TAG;
    delete env.AA_MINTER_SHIELDED_COLOR;
    delete env.AA_MINTER_UNSHIELDED_COLOR;
    Object.assign(env, {
      OFFER_FILES_FAUCET: flag,
      OFFER_FILES_CONTRACT: "44".repeat(32),
      ZSWAP_API: "http://kernel:9999",
    });
    const aaMinter = vi.fn(() => ADAPTER("aa-minter"));
    const offerFiles = vi.fn(() => ADAPTER("offer-files-faucet"));
    const selected = createFundingAdapter(env, { aaMinter, offerFiles });

    expect(selected.config.mode).toBe("offer-files-faucet");
    expect(selected.adapter.mode).toBe("offer-files-faucet");
    expect(offerFiles).toHaveBeenCalledOnce();
    expect(aaMinter).not.toHaveBeenCalled();
  });

  it("requires the dedicated harness seed and never falls back to MIDNIGHT_WALLET_SEED", () => {
    const env = baseEnv();
    delete env.AA_HARNESS_WALLET_SEED;
    env.MIDNIGHT_WALLET_SEED = "cd".repeat(32);
    expect(() => parseFundingEnvironment(env)).toThrow(/AA_HARNESS_WALLET_SEED is required/);
  });

  it("rejects an all-zero seed and a dedicated seed equal to the generic wallet seed", () => {
    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_HARNESS_WALLET_SEED: "00".repeat(32) }))
      .toThrow(/must not be the all-zero/);
    const shared = "cd".repeat(32);
    expect(() => parseFundingEnvironment({
      ...baseEnv(),
      AA_HARNESS_WALLET_SEED: shared.toUpperCase(),
      MIDNIGHT_WALLET_SEED: shared,
    })).toThrow(/must be dedicated/);
  });

  it("keeps the plain wallet proof endpoint separate from the experimental Manager endpoint", () => {
    const parsed = parseFundingEnvironment(baseEnv());
    expect(parsed.nodeUrl).toBe("http://node:9944");
    expect(parsed.indexerUrl).toBe("http://indexer:8088/api/v4/graphql");
    expect(parsed.indexerWsUrl).toBe("ws://indexer:8088/api/v4/graphql/ws");
    expect(parsed.managerProofServerUrl).toBe("http://aa-proof-server:6300");
    expect(parsed.walletProofServerUrl).toBe("http://proof-server:6300");
    expect(parsed.managerProofServerUrl).not.toBe(parsed.walletProofServerUrl);
  });

  it("keeps the dedicated seed non-enumerable in parsed and selected objects", () => {
    const env = baseEnv();
    const parsed = parseFundingEnvironment(env);
    const selected = createFundingAdapter(env, {
      aaMinter: () => ADAPTER("aa-minter"),
      offerFiles: () => ADAPTER("offer-files-faucet"),
    });
    expect(parsed.harnessWalletSeed).toBe(env.AA_HARNESS_WALLET_SEED);
    const serialized = (value: unknown) => JSON.stringify(value, (_key, child) =>
      typeof child === "bigint" ? child.toString() : child);
    expect(serialized(parsed)).not.toContain(env.AA_HARNESS_WALLET_SEED);
    expect(serialized(selected)).not.toContain(env.AA_HARNESS_WALLET_SEED);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("fails closed when a factory returns an adapter for the wrong mode", () => {
    expect(() => createFundingAdapter(baseEnv(), {
      aaMinter: (() => ADAPTER("offer-files-faucet")) as never,
      offerFiles: () => ADAPTER("offer-files-faucet"),
    })).toThrow(/factory returned the wrong mode/);
  });

  it("validates deployment/runtime profiles and refuses mixed current-AA/old-faucet artifacts", () => {
    const current = parseFundingEnvironment({ ...baseEnv(), AA_DEPLOYMENT_PROFILE: "current-0.19" });
    expect(current.managerRuntimeVersion).toBe("0.19.0");

    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_DEPLOYMENT_PROFILE: "other" }))
      .toThrow(/legacy-0.18 or current-0.19/);
    expect(() => parseFundingEnvironment({
      ...baseEnv(),
      AA_DEPLOYMENT_PROFILE: "current-0.19",
      OFFER_FILES_FAUCET: "1",
      OFFER_FILES_CONTRACT: "44".repeat(32),
      ZSWAP_API: "http://kernel:9999",
    })).toThrow(/mixed 0.19\/0.18 artifacts are refused/);
  });

  it("rejects invalid flags, paths, URLs, addresses and seeds without echoing secret values", () => {
    expect(() => parseFundingEnvironment({ ...baseEnv(), OFFER_FILES_FAUCET: "yes" })).toThrow(/must be absent/);
    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_MANAGER_ARTIFACT_PATH: "relative" })).toThrow(/absolute path/);
    expect(() => parseFundingEnvironment({ ...baseEnv(), MN_NODE_URL: "node:9944" })).toThrow(/must use http/);
    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_MANAGER_ADDRESS: "11" })).toThrow(/32 bytes/);
    const secret = "not-a-valid-secret-value";
    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_HARNESS_WALLET_SEED: secret }))
      .toThrowError(expect.not.stringContaining(secret));
  });

  it.each(["OFFER_FILES_CONTRACT", "ZSWAP_API"])("requires %s only in faucet mode", (key) => {
    const env: Record<string, string> = {
      ...baseEnv(),
      OFFER_FILES_FAUCET: "1",
      OFFER_FILES_CONTRACT: "44".repeat(32),
      ZSWAP_API: "http://kernel:9999",
    };
    delete env[key];
    expect(() => parseFundingEnvironment(env)).toThrow(new RegExp(`${key} is required`));
  });

  it.each([
    "http://user:pass@kernel:9999",
    "http://kernel:9999/evil",
    "http://kernel:9999/?write=true",
    "http://kernel:9999/#fragment",
  ])("rejects a non-origin ZSWAP_API: %s", (zswapApi) => {
    expect(() => parseFundingEnvironment({
      ...baseEnv(),
      OFFER_FILES_FAUCET: "1",
      OFFER_FILES_CONTRACT: "44".repeat(32),
      ZSWAP_API: zswapApi,
    })).toThrow(/must be an origin URL|must not contain credentials, query, or fragment/);
  });

  it.each([
    ["MN_NODE_URL", "http://operator:node-password@node:9944/rpc", "node-password"],
    ["MN_INDEXER_URL", "http://indexer:8088/api/v4/graphql?api_key=INDEXER-KEY", "INDEXER-KEY"],
    ["MN_INDEXER_WS_URL", "ws://indexer:8088/api/v4/graphql/ws#PRIVATE-MATERIAL", "PRIVATE-MATERIAL"],
    ["MN_PROOF_SERVER_URL", "http://proof-user:proof-password@aa-proof-server:6300/prove", "proof-password"],
    ["AA_WALLET_PROOF_SERVER_URL", "http://proof-server:6300/path?password=WALLET-PASSWORD", "WALLET-PASSWORD"],
  ] as const)("rejects credential-bearing %s without echoing the credential", (key, endpoint, credential) => {
    let message = "";
    try {
      parseFundingEnvironment({ ...baseEnv(), [key]: endpoint });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/must not contain credentials, query, or fragment/);
    expect(message).not.toContain(credential);
  });

  it.each(["WBTC", "WETH", "WUSD"])("rejects market name %s as an AA Minter tag", (tag) => {
    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_MINTER_TAG: tag })).toThrow(/market token name/);
  });

  it.each(["toka", "TOKA\n", "A".repeat(33)])("rejects noncanonical or oversized AA Minter tag %j", (tag) => {
    expect(() => parseFundingEnvironment({ ...baseEnv(), AA_MINTER_TAG: tag })).toThrow(/canonical uppercase|Bytes<32>/);
  });
});
