import { rawTokenType } from "@midnight-ntwrk/compact-runtime";

export const AA_MINTER_SHIELDED_NAME = "AATEST-S" as const;
export const AA_MINTER_UNSHIELDED_NAME = "AATEST-U" as const;
export const OFFER_FILES_FAUCET_DECIMALS = 6 as const;

export type TokenSource = "aa-minter" | "offer-files-faucet";
export type TokenFamily = "shielded" | "unshielded";

interface TokenMetadataBase {
  /** Display name. Internal AA constructor tags never belong here. */
  readonly name: string;
  readonly family: TokenFamily;
  /** Lower-case, unprefixed 32-byte raw token type. */
  readonly color: string;
}

type AaMinterTokenMetadataBase = TokenMetadataBase & {
  /** Raw AA Minter constructor tag, retained separately from the display name. */
  readonly internalDeploymentTag: string;
  readonly decimals?: number;
};

export type AaMinterTokenMetadata =
  | AaMinterTokenMetadataBase & {
      readonly source: "aa-minter";
      readonly family: "shielded";
      readonly name: typeof AA_MINTER_SHIELDED_NAME;
    }
  | AaMinterTokenMetadataBase & {
      readonly source: "aa-minter";
      readonly family: "unshielded";
      readonly name: typeof AA_MINTER_UNSHIELDED_NAME;
    };

export type OfferFilesTokenMetadata = TokenMetadataBase & {
  readonly source: "offer-files-faucet";
  readonly decimals: typeof OFFER_FILES_FAUCET_DECIMALS;
  /** The AA-only constructor tag is statically impossible on faucet metadata. */
  readonly internalDeploymentTag?: never;
};

export type TokenMetadata = AaMinterTokenMetadata | OfferFilesTokenMetadata;

const RAW_COLOR = /^[0-9a-f]{64}$/;
const OFFER_FILES_NAME = /^[A-Z][A-Z0-9_-]*$/;
// These are Offer Files faucet names; the AA Minter must reject them as outward metadata.
const OFFER_FILES_NAMES_FORBIDDEN_ON_AA = new Set(["WBTC", "WETH", "WUSD"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function noUnknownKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length !== 0) {
    throw new RangeError(`token metadata has unknown field(s): ${unknown.sort().join(", ")}`);
  }
}

export function canonicalTokenColor(value: string): string {
  const color = value.replace(/^0x/i, "").toLowerCase();
  if (!RAW_COLOR.test(color)) throw new RangeError("token color must be exactly 32 bytes of hex");
  return color;
}

function validateDecimals(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 38) {
    throw new RangeError("token decimals must be a safe integer from 0 through 38");
  }
  return value as number;
}

function expectedAaName(family: TokenFamily): AaMinterTokenMetadata["name"] {
  return family === "shielded" ? AA_MINTER_SHIELDED_NAME : AA_MINTER_UNSHIELDED_NAME;
}

function validateOfferFilesName(value: unknown): string {
  if (typeof value !== "string" || !OFFER_FILES_NAME.test(value)) {
    throw new RangeError("Offer Files faucet token names must use uppercase registry spelling");
  }
  return value;
}

export function validateTokenMetadata(value: unknown): TokenMetadata {
  const token = record(value, "token metadata");
  if (token.source !== "aa-minter" && token.source !== "offer-files-faucet") {
    throw new RangeError("token source must be aa-minter or offer-files-faucet");
  }
  noUnknownKeys(
    token,
    token.source === "aa-minter"
      ? ["name", "source", "family", "color", "internalDeploymentTag", "decimals"]
      : ["name", "source", "family", "color", "decimals"],
  );
  if (token.family !== "shielded" && token.family !== "unshielded") {
    throw new RangeError("token family must be shielded or unshielded");
  }
  if (typeof token.name !== "string" || token.name.length === 0) {
    throw new RangeError("token name must be nonempty");
  }
  if (typeof token.color !== "string") throw new TypeError("token color must be a string");
  const color = canonicalTokenColor(token.color);
  const decimals = validateDecimals(token.decimals);

  if (token.source === "aa-minter") {
    if (OFFER_FILES_NAMES_FORBIDDEN_ON_AA.has(token.name.toUpperCase())) {
      throw new RangeError(`AA Minter metadata cannot use market token name ${token.name}`);
    }
    const expected = expectedAaName(token.family);
    if (token.name !== expected) {
      throw new RangeError(`AA Minter ${token.family} display name must be ${expected}`);
    }
    if (typeof token.internalDeploymentTag !== "string" || token.internalDeploymentTag.length === 0) {
      throw new RangeError("AA Minter metadata requires an internal deployment tag");
    }
    const common = {
      source: "aa-minter" as const,
      color,
      internalDeploymentTag: token.internalDeploymentTag,
      ...(decimals === undefined ? {} : { decimals }),
    };
    return token.family === "shielded"
      ? { ...common, name: AA_MINTER_SHIELDED_NAME, family: "shielded" }
      : { ...common, name: AA_MINTER_UNSHIELDED_NAME, family: "unshielded" };
  }

  const name = validateOfferFilesName(token.name);
  if (decimals !== OFFER_FILES_FAUCET_DECIMALS) {
    throw new RangeError(`Offer Files faucet metadata decimals must be exactly ${OFFER_FILES_FAUCET_DECIMALS}`);
  }
  return {
    name,
    source: "offer-files-faucet",
    family: token.family,
    color,
    decimals: OFFER_FILES_FAUCET_DECIMALS,
  };
}

export function aaMinterTokenMetadata(input: {
  readonly family: TokenFamily;
  readonly color: string;
  readonly internalDeploymentTag: string;
  readonly decimals?: number;
}): AaMinterTokenMetadata {
  return validateTokenMetadata({
    name: expectedAaName(input.family),
    source: "aa-minter",
    ...input,
  }) as AaMinterTokenMetadata;
}

export function offerFilesTokenMetadata(input: {
  readonly name: string;
  readonly family: TokenFamily;
  readonly offerFilesAddress: string;
  readonly decimals: typeof OFFER_FILES_FAUCET_DECIMALS;
}): OfferFilesTokenMetadata {
  const { name, family, offerFilesAddress, decimals } = input;
  return validateTokenMetadata({
    name,
    source: "offer-files-faucet",
    family,
    color: offerFilesTokenColor(name, offerFilesAddress),
    decimals,
  }) as OfferFilesTokenMetadata;
}

/**
 * Builds deployment-bound faucet metadata and proves a registry colour was
 * derived from the same token name and Offer Files address.
 */
export function offerFilesRegistryTokenMetadata(input: {
  readonly name: string;
  readonly family: TokenFamily;
  readonly offerFilesAddress: string;
  readonly registryColor: string;
  readonly decimals: typeof OFFER_FILES_FAUCET_DECIMALS;
}): OfferFilesTokenMetadata {
  const metadata = offerFilesTokenMetadata(input);
  if (metadata.color !== canonicalTokenColor(input.registryColor)) {
    throw new RangeError("Offer Files registry colour does not match the token name and deployment address");
  }
  return metadata;
}

// Exact copy of domainSepFromName from effectstream/zswap-offerfiles-kernel
// docs/src/wallet/mintable.ts @ 4af102536f02f137b696a4734bd8c936eddf3672.
const FAUCET_PREFIX = "zswap-da-faucet:";

export function domainSepFromName(name: string): Uint8Array {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(FAUCET_PREFIX + name);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < 32; i++) {
    h = (h ^ (enc[i % enc.length] ?? i + 7)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    out[i] = h & 0xff;
  }
  return out;
}

export function offerFilesTokenColor(name: string, offerFilesAddress: string): string {
  return canonicalTokenColor(
    rawTokenType(domainSepFromName(validateOfferFilesName(name)), canonicalTokenColor(offerFilesAddress)),
  );
}
