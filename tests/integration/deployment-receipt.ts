import { readFile } from "node:fs/promises";

import {
  AA_CONTRACTS_RECEIPT_VERSION,
  buildAaContractsReceipt,
  type AaContractsReceipt,
} from "../lib/aa-contracts-receipt.js";
import {
  canonicalTokenColor,
  aaMinterTokenMetadata,
  validateAaDeploymentTag,
  type TokenMetadata,
} from "../lib/token-metadata.js";
import type { FundingConfig } from "./funding/router.js";

export interface LegacyAaDeploymentReceipt {
  readonly network: string;
  readonly aaCommit: string;
  readonly manager: { readonly address: string; readonly domain: string };
  readonly minter: { readonly address: string; readonly tag: string };
  readonly mints: {
    readonly shielded: { readonly color: string; readonly tx: string | null; readonly recipient: string };
    readonly unshielded: { readonly color: string; readonly tx: string | null; readonly recipient: string };
  };
  readonly deployedAt: string;
  readonly tookSeconds: number;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RangeError(`${label} fields do not match the bounded legacy schema`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new RangeError(`${label} must be nonempty`);
  return value;
}

function mint(value: unknown, label: string) {
  const raw = object(value, label);
  exactKeys(raw, ["color", "tx", "recipient"], label);
  if (raw.tx !== null && (typeof raw.tx !== "string" || raw.tx.length === 0)) {
    throw new RangeError(`${label}.tx must be a nonempty string or null`);
  }
  return {
    color: canonicalTokenColor(text(raw.color, `${label}.color`)),
    tx: raw.tx as string | null,
    recipient: text(raw.recipient, `${label}.recipient`),
  };
}

export function parseLegacyAaDeploymentReceipt(value: unknown): LegacyAaDeploymentReceipt {
  const raw = object(value, "legacy aa-contracts receipt");
  exactKeys(raw, ["network", "aaCommit", "manager", "minter", "mints", "deployedAt", "tookSeconds"], "legacy aa-contracts receipt");
  const manager = object(raw.manager, "legacy manager");
  exactKeys(manager, ["address", "domain"], "legacy manager");
  const minter = object(raw.minter, "legacy minter");
  exactKeys(minter, ["address", "tag"], "legacy minter");
  const mints = object(raw.mints, "legacy mints");
  exactKeys(mints, ["shielded", "unshielded"], "legacy mints");
  const aaCommit = text(raw.aaCommit, "legacy aaCommit").toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(aaCommit)) throw new RangeError("legacy aaCommit must be Git hex");
  const deployedAt = text(raw.deployedAt, "legacy deployedAt");
  if (new Date(deployedAt).toISOString() !== deployedAt) throw new RangeError("legacy deployedAt must be canonical ISO-8601");
  if (!Number.isSafeInteger(raw.tookSeconds) || (raw.tookSeconds as number) < 0) {
    throw new RangeError("legacy tookSeconds must be a nonnegative safe integer");
  }
  return {
    network: text(raw.network, "legacy network"),
    aaCommit,
    manager: {
      address: canonicalTokenColor(text(manager.address, "legacy manager address")),
      domain: text(manager.domain, "legacy manager domain"),
    },
    minter: {
      address: canonicalTokenColor(text(minter.address, "legacy minter address")),
      tag: validateAaDeploymentTag(minter.tag),
    },
    mints: {
      shielded: mint(mints.shielded, "legacy shielded mint"),
      unshielded: mint(mints.unshielded, "legacy unshielded mint"),
    },
    deployedAt,
    tookSeconds: raw.tookSeconds as number,
  };
}

export async function readLegacyAaDeploymentReceipt(path: string): Promise<LegacyAaDeploymentReceipt> {
  return parseLegacyAaDeploymentReceipt(JSON.parse(await readFile(path, "utf8")));
}

export function preflightLegacyAaDeployment(input: {
  readonly legacy: LegacyAaDeploymentReceipt;
  readonly config: FundingConfig;
  readonly verifiedMinter: {
    readonly address: string;
    readonly tag: string;
    readonly shieldedColor: string;
    readonly unshieldedColor: string;
  };
}): void {
  const { legacy, config } = input;
  const verifiedMinter = {
    address: canonicalTokenColor(input.verifiedMinter.address),
    tag: validateAaDeploymentTag(input.verifiedMinter.tag),
    shieldedColor: canonicalTokenColor(input.verifiedMinter.shieldedColor),
    unshieldedColor: canonicalTokenColor(input.verifiedMinter.unshieldedColor),
  };
  if (config.deploymentProfile !== "legacy-0.18") {
    throw new RangeError("the unversioned stock receipt is valid only for the legacy-0.18 deployment profile");
  }
  if (legacy.network !== config.networkId) throw new RangeError("legacy receipt network does not match environment");
  if (legacy.aaCommit !== config.expectedAaCommit) throw new RangeError("legacy receipt AA commit does not match environment");
  if (legacy.manager.address !== config.managerAddress) throw new RangeError("legacy receipt Manager address does not match environment");
  if (legacy.minter.address !== verifiedMinter.address) throw new RangeError("legacy receipt Minter address does not match verified deployment");
  if (legacy.minter.tag !== verifiedMinter.tag) throw new RangeError("legacy receipt Minter tag does not match verified deployment");
  if (legacy.mints.shielded.color !== verifiedMinter.shieldedColor) throw new RangeError("legacy receipt shielded Minter colour does not match verified deployment");
  if (legacy.mints.unshielded.color !== verifiedMinter.unshieldedColor) throw new RangeError("legacy receipt unshielded Minter colour does not match verified deployment");
  if (config.mode === "aa-minter" && (
    config.minterAddress !== verifiedMinter.address ||
    config.minterTag !== verifiedMinter.tag ||
    config.minterShieldedColor !== verifiedMinter.shieldedColor ||
    config.minterUnshieldedColor !== verifiedMinter.unshieldedColor
  )) {
    throw new RangeError("AA-Minter environment does not match the verified deployment identity");
  }
}

export function decorateLegacyAaDeploymentReceipt(input: {
  readonly legacy: LegacyAaDeploymentReceipt;
  readonly config: FundingConfig;
  readonly tokens: readonly TokenMetadata[];
  readonly verifiedMinter: {
    readonly address: string;
    readonly tag: string;
    readonly shieldedColor: string;
    readonly unshieldedColor: string;
  };
}): AaContractsReceipt {
  const { legacy, config, tokens } = input;
  preflightLegacyAaDeployment(input);
  const verifiedMinter = {
    address: canonicalTokenColor(input.verifiedMinter.address),
    tag: validateAaDeploymentTag(input.verifiedMinter.tag),
    shieldedColor: canonicalTokenColor(input.verifiedMinter.shieldedColor),
    unshieldedColor: canonicalTokenColor(input.verifiedMinter.unshieldedColor),
  };
  const aaTokens = [
    aaMinterTokenMetadata({
      family: "shielded",
      color: legacy.mints.shielded.color,
      internalDeploymentTag: legacy.minter.tag,
    }),
    aaMinterTokenMetadata({
      family: "unshielded",
      color: legacy.mints.unshielded.color,
      internalDeploymentTag: legacy.minter.tag,
    }),
  ] as const;
  let receiptTokens: readonly TokenMetadata[];
  if (config.mode === "aa-minter") {
    const shielded = tokens.find((token) => token.source === "aa-minter" && token.family === "shielded");
    if (!shielded || shielded.color !== config.minterShieldedColor || shielded.color !== legacy.mints.shielded.color) {
      throw new RangeError("legacy receipt shielded Minter colour does not match environment and live token");
    }
    if (tokens.some((token) => token.source !== "aa-minter")) throw new RangeError("Minter deployment decoration accepts only AA-Minter run tokens");
    receiptTokens = aaTokens;
  } else if (tokens.some((token) => token.source !== "offer-files-faucet")) {
    throw new RangeError("faucet deployment decoration accepts only Offer Files tokens");
  } else {
    const faucetTokens = (["WBTC", "WETH"] as const).map((name) => {
      const matches = tokens.filter((token) => token.source === "offer-files-faucet" && token.name === name);
      if (matches.length !== 1) {
        throw new RangeError(`faucet deployment decoration requires exactly one ${name} token`);
      }
      const token = matches[0]!;
      if (token.family !== "shielded" || token.decimals !== 6) {
        throw new RangeError(`faucet deployment ${name} token must be shielded with six decimals`);
      }
      return token;
    });
    if (tokens.length !== faucetTokens.length) {
      throw new RangeError("faucet deployment decoration accepts exactly WBTC and WETH");
    }
    receiptTokens = [...aaTokens, ...faucetTokens];
  }
  return buildAaContractsReceipt({
    schemaVersion: AA_CONTRACTS_RECEIPT_VERSION,
    network: legacy.network,
    aaCommit: legacy.aaCommit,
    manager: legacy.manager,
    minter: legacy.minter,
    ...(config.mode === "offer-files-faucet" ? { offerFiles: { address: config.offerFilesAddress } } : {}),
    tokens: receiptTokens,
    createdAt: legacy.deployedAt,
  });
}
