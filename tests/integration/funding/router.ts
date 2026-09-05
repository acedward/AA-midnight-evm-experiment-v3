import { isAbsolute } from "node:path";

import {
  canonicalTokenColor,
  scaleSixDecimalWholeCoins,
  validateAaDeploymentTag,
  validateUint64Amount,
} from "../../lib/token-metadata.js";
import type { FundingAdapter } from "./types.js";

const DEFAULT_MANAGER_ARTIFACT = "/aa/contract-manager/src/managed";
const DEFAULT_MINTER_ARTIFACT = "/aa/contract-minter/src/managed";
const DEFAULT_OFFER_FILES_ARTIFACT = "/aa/contract-offer-files/src/managed";
const DEFAULT_DEPLOYMENT_RECEIPT = "/aa/out/aa-contracts.json";
const DEFAULT_DECORATED_DEPLOYMENT_RECEIPT = "/aa/out/aa-contracts-v1.json";
const DEFAULT_RUN_RECEIPT = "/aa/out/aa-faucet-run.json";
const DEFAULT_LIVE_RUNTIME_MODULE = "/aa/runner/aa-faucet-runtime.ts";

interface SharedFundingConfig {
  readonly deploymentProfile: "legacy-0.18" | "current-0.19";
  readonly expectedAaCommit: string;
  readonly networkId: string;
  readonly nodeUrl: string;
  readonly indexerUrl: string;
  readonly indexerWsUrl: string;
  /** Experimental proof server for current Manager ZKIR-v3 artifacts. */
  readonly managerProofServerUrl: string;
  /** Plain proof server for wallet pieces and the old Offer Files artifact. */
  readonly walletProofServerUrl: string;
  readonly harnessWalletSeed: string;
  readonly managerAddress: string;
  readonly managerArtifactPath: string;
  readonly managerRuntimeVersion: "0.18.0-rc.1" | "0.19.0";
  readonly minterArtifactPath: string;
  readonly minterRuntimeVersion: "0.18.0-rc.1" | "0.19.0";
  readonly liveRuntimeModulePath: string;
  readonly deploymentReceiptPath: string;
  readonly decoratedDeploymentReceiptPath: string;
  readonly runReceiptPath: string;
}

export interface AaMinterFundingConfig extends SharedFundingConfig {
  readonly mode: "aa-minter";
  readonly minterAddress: string;
  readonly minterTag: string;
  readonly minterShieldedColor: string;
  readonly minterUnshieldedColor: string;
  readonly scenarioAmountBaseUnits: bigint;
}

export interface OfferFilesFundingConfig extends SharedFundingConfig {
  readonly mode: "offer-files-faucet";
  readonly offerFilesAddress: string;
  readonly offerFilesArtifactPath: string;
  readonly offerFilesRuntimeVersion: "0.18.0-rc.1";
  readonly zswapApiUrl: string;
  readonly scenarioWholeCoins: bigint;
}

export type FundingConfig = AaMinterFundingConfig | OfferFilesFundingConfig;
export type FundingEnvironment = Readonly<Record<string, string | undefined>>;

export interface FundingAdapterFactories {
  aaMinter(config: AaMinterFundingConfig): FundingAdapter & { readonly mode: "aa-minter" };
  offerFiles(config: OfferFilesFundingConfig): FundingAdapter & { readonly mode: "offer-files-faucet" };
}

function required(env: FundingEnvironment, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === "") throw new RangeError(`${key} is required`);
  return value;
}

function booleanFlag(value: string | undefined): boolean {
  if (value === undefined || value === "" || /^(0|false)$/i.test(value)) return false;
  if (/^(1|true)$/i.test(value)) return true;
  throw new RangeError("OFFER_FILES_FAUCET must be absent, false, 0, true, or 1");
}

function url(value: string, key: string, protocols: readonly string[]): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RangeError(`${key} must be an absolute URL`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new RangeError(`${key} must use ${protocols.join(" or ")}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new RangeError(`${key} must not contain credentials, query, or fragment components`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function originUrl(value: string, key: string): string {
  const parsed = new URL(url(value, key, ["http:", "https:"]));
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new RangeError(`${key} must be an origin URL without credentials, path, query, or hash`);
  }
  return parsed.origin;
}

function path(value: string, key: string): string {
  if (!isAbsolute(value)) throw new RangeError(`${key} must be an absolute path`);
  return value;
}

function seed(value: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new RangeError("AA_HARNESS_WALLET_SEED must be exactly 32 bytes of hex");
  }
  const normalized = value.toLowerCase();
  if (/^0{64}$/.test(normalized)) {
    throw new RangeError("AA_HARNESS_WALLET_SEED must not be the all-zero seed");
  }
  return normalized;
}

function deploymentProfile(env: FundingEnvironment): {
  readonly deploymentProfile: SharedFundingConfig["deploymentProfile"];
  readonly managerRuntimeVersion: SharedFundingConfig["managerRuntimeVersion"];
} {
  const value = required(env, "AA_DEPLOYMENT_PROFILE");
  if (value === "legacy-0.18") {
    return { deploymentProfile: value, managerRuntimeVersion: "0.18.0-rc.1" };
  }
  if (value === "current-0.19") {
    return { deploymentProfile: value, managerRuntimeVersion: "0.19.0" };
  }
  throw new RangeError("AA_DEPLOYMENT_PROFILE must be legacy-0.18 or current-0.19");
}

function commit(value: string): string {
  const normalized = value.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) throw new RangeError("AA_EXPECTED_COMMIT must be a full 40-digit Git hex id");
  return normalized;
}

function unsignedInteger(value: string, key: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) throw new RangeError(`${key} must be a canonical positive integer`);
  return BigInt(value);
}

function shared(env: FundingEnvironment): { readonly config: Omit<SharedFundingConfig, "harnessWalletSeed">; readonly harnessWalletSeed: string } {
  const profile = deploymentProfile(env);
  const harnessWalletSeed = seed(required(env, "AA_HARNESS_WALLET_SEED"));
  if (env.MIDNIGHT_WALLET_SEED !== undefined && seed(env.MIDNIGHT_WALLET_SEED) === harnessWalletSeed) {
    throw new RangeError("AA_HARNESS_WALLET_SEED must be dedicated and differ from MIDNIGHT_WALLET_SEED");
  }
  return {
    harnessWalletSeed,
    config: {
      ...profile,
      expectedAaCommit: commit(required(env, "AA_EXPECTED_COMMIT")),
      networkId: required(env, "MIDNIGHT_NETWORK_ID"),
      nodeUrl: url(required(env, "MN_NODE_URL"), "MN_NODE_URL", ["http:", "https:"]),
      indexerUrl: url(required(env, "MN_INDEXER_URL"), "MN_INDEXER_URL", ["http:", "https:"]),
      indexerWsUrl: url(required(env, "MN_INDEXER_WS_URL"), "MN_INDEXER_WS_URL", ["ws:", "wss:"]),
      managerProofServerUrl: url(
        required(env, "MN_PROOF_SERVER_URL"),
        "MN_PROOF_SERVER_URL",
        ["http:", "https:"],
      ),
      walletProofServerUrl: url(
        required(env, "AA_WALLET_PROOF_SERVER_URL"),
        "AA_WALLET_PROOF_SERVER_URL",
        ["http:", "https:"],
      ),
      managerAddress: canonicalTokenColor(required(env, "AA_MANAGER_ADDRESS")),
      managerArtifactPath: path(
        env.AA_MANAGER_ARTIFACT_PATH ?? DEFAULT_MANAGER_ARTIFACT,
        "AA_MANAGER_ARTIFACT_PATH",
      ),
      minterArtifactPath: path(
        env.AA_MINTER_ARTIFACT_PATH ?? DEFAULT_MINTER_ARTIFACT,
        "AA_MINTER_ARTIFACT_PATH",
      ),
      minterRuntimeVersion: profile.managerRuntimeVersion,
      liveRuntimeModulePath: path(
        env.AA_LIVE_RUNTIME_MODULE ?? DEFAULT_LIVE_RUNTIME_MODULE,
        "AA_LIVE_RUNTIME_MODULE",
      ),
      deploymentReceiptPath: path(
        env.AA_DEPLOYMENT_RECEIPT_PATH ?? DEFAULT_DEPLOYMENT_RECEIPT,
        "AA_DEPLOYMENT_RECEIPT_PATH",
      ),
      decoratedDeploymentReceiptPath: path(
        env.AA_DECORATED_DEPLOYMENT_RECEIPT_PATH ?? DEFAULT_DECORATED_DEPLOYMENT_RECEIPT,
        "AA_DECORATED_DEPLOYMENT_RECEIPT_PATH",
      ),
      runReceiptPath: path(env.AA_RUN_RECEIPT_PATH ?? DEFAULT_RUN_RECEIPT, "AA_RUN_RECEIPT_PATH"),
    },
  };
}

function withSecret<T extends object>(config: T, harnessWalletSeed: string): T & Pick<SharedFundingConfig, "harnessWalletSeed"> {
  Object.defineProperty(config, "harnessWalletSeed", {
    value: harnessWalletSeed,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(config) as T & Pick<SharedFundingConfig, "harnessWalletSeed">;
}

export function parseFundingEnvironment(env: FundingEnvironment): FundingConfig {
  const { config: common, harnessWalletSeed } = shared(env);
  if (!booleanFlag(env.OFFER_FILES_FAUCET)) {
    return withSecret({
      ...common,
      mode: "aa-minter",
      minterAddress: canonicalTokenColor(required(env, "AA_MINTER_ADDRESS")),
      minterTag: validateAaDeploymentTag(required(env, "AA_MINTER_TAG")),
      minterShieldedColor: canonicalTokenColor(required(env, "AA_MINTER_SHIELDED_COLOR")),
      minterUnshieldedColor: canonicalTokenColor(required(env, "AA_MINTER_UNSHIELDED_COLOR")),
      scenarioAmountBaseUnits: validateUint64Amount(unsignedInteger(
        env.AA_HARNESS_MINTER_AMOUNT_BASE_UNITS ?? "1000000000",
        "AA_HARNESS_MINTER_AMOUNT_BASE_UNITS",
      )),
    }, harnessWalletSeed);
  }
  if (common.deploymentProfile !== "legacy-0.18") {
    throw new RangeError(
      "old-ABI Offer Files faucet mode requires AA_DEPLOYMENT_PROFILE=legacy-0.18; mixed 0.19/0.18 artifacts are refused",
    );
  }
  return withSecret({
    ...common,
    mode: "offer-files-faucet",
    offerFilesAddress: canonicalTokenColor(required(env, "OFFER_FILES_CONTRACT")),
    offerFilesArtifactPath: path(
      env.OFFER_FILES_ARTIFACT_PATH ?? DEFAULT_OFFER_FILES_ARTIFACT,
      "OFFER_FILES_ARTIFACT_PATH",
    ),
    offerFilesRuntimeVersion: "0.18.0-rc.1",
    zswapApiUrl: originUrl(required(env, "ZSWAP_API"), "ZSWAP_API"),
    scenarioWholeCoins: (() => {
      const whole = unsignedInteger(env.AA_HARNESS_FAUCET_WHOLE_COINS ?? "1000", "AA_HARNESS_FAUCET_WHOLE_COINS");
      scaleSixDecimalWholeCoins(whole);
      return whole;
    })(),
  }, harnessWalletSeed);
}

export function createFundingAdapter(
  env: FundingEnvironment,
  factories: FundingAdapterFactories,
): { readonly config: FundingConfig; readonly adapter: FundingAdapter } {
  const config = parseFundingEnvironment(env);
  const adapter: FundingAdapter = config.mode === "aa-minter"
    ? factories.aaMinter(config)
    : factories.offerFiles(config);
  if (adapter.mode !== config.mode) throw new Error("funding adapter factory returned the wrong mode");
  return { config, adapter };
}
