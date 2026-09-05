import {
  CompactTypeBytes,
  CompactTypeVector,
  persistentHash,
  rawTokenType,
} from "@midnight-ntwrk/compact-runtime";

export const AA_MINTER_SHIELDED_NAME = "AATEST-S" as const;
export const AA_MINTER_UNSHIELDED_NAME = "AATEST-U" as const;
export const OFFER_FILES_FAUCET_DECIMALS = 6 as const;
export const UINT64_MAX = (1n << 64n) - 1n;

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
const AA_MINTER_FAMILY_TAG = {
  shielded: "aa00004:minter:shielded",
  unshielded: "aa00004:minter:unshielded",
} as const;
const BYTES_32 = new CompactTypeBytes(32);
const VECTOR_2_BYTES_32 = new CompactTypeVector(2, BYTES_32);
// These are Offer Files faucet names; the AA Minter must reject them as outward metadata.
const OFFER_FILES_NAMES_FORBIDDEN_ON_AA = new Set(["WBTC", "WETH", "WUSD"]);

export function validateAaDeploymentTag(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_-]*$/.test(value)) {
    throw new RangeError("AA Minter internal deployment tag must be a canonical uppercase identifier");
  }
  if (new TextEncoder().encode(value).length > 32) {
    throw new RangeError("AA Minter internal deployment tag must fit Bytes<32>");
  }
  if (OFFER_FILES_NAMES_FORBIDDEN_ON_AA.has(value)) {
    throw new RangeError("AA Minter internal deployment tag cannot use a market token name");
  }
  return value;
}

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
    const internalDeploymentTag = validateAaDeploymentTag(token.internalDeploymentTag);
    const common = {
      source: "aa-minter" as const,
      color,
      internalDeploymentTag,
      ...(decimals === undefined ? {} : { decimals }),
    };
    return Object.freeze(token.family === "shielded"
      ? { ...common, name: AA_MINTER_SHIELDED_NAME, family: "shielded" }
      : { ...common, name: AA_MINTER_UNSHIELDED_NAME, family: "unshielded" });
  }

  const name = validateOfferFilesName(token.name);
  if (decimals !== OFFER_FILES_FAUCET_DECIMALS) {
    throw new RangeError(`Offer Files faucet metadata decimals must be exactly ${OFFER_FILES_FAUCET_DECIMALS}`);
  }
  return Object.freeze({
    name,
    source: "offer-files-faucet",
    family: token.family,
    color,
    decimals: OFFER_FILES_FAUCET_DECIMALS,
  });
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

function padBytes32(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length > 32) throw new RangeError("AA Minter derivation input must fit Bytes<32>");
  const padded = new Uint8Array(32);
  padded.set(encoded);
  return padded;
}

/** Independently derives the AA Minter token colour from public deployment identity. */
export function aaMinterTokenColor(
  family: TokenFamily,
  internalDeploymentTag: string,
  minterAddress: string,
): string {
  const tag = validateAaDeploymentTag(internalDeploymentTag);
  const separator = persistentHash(VECTOR_2_BYTES_32, [
    padBytes32(tag),
    padBytes32(AA_MINTER_FAMILY_TAG[family]),
  ]) as Uint8Array;
  return canonicalTokenColor(rawTokenType(separator, canonicalTokenColor(minterAddress)));
}

export function aaMinterDeploymentTokenMetadata(input: {
  readonly family: TokenFamily;
  readonly internalDeploymentTag: string;
  readonly minterAddress: string;
}): AaMinterTokenMetadata {
  return aaMinterTokenMetadata({
    family: input.family,
    color: aaMinterTokenColor(input.family, input.internalDeploymentTag, input.minterAddress),
    internalDeploymentTag: input.internalDeploymentTag,
  });
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

/** Converts positive whole faucet coins to six-decimal base units exactly once. */
export function scaleSixDecimalWholeCoins(wholeCoins: bigint): bigint {
  if (typeof wholeCoins !== "bigint" || wholeCoins <= 0n) {
    throw new RangeError("whole-coin amount must be a positive bigint");
  }
  const scale = 10n ** BigInt(OFFER_FILES_FAUCET_DECIMALS);
  if (wholeCoins > UINT64_MAX / scale) {
    throw new RangeError("scaled six-decimal amount exceeds Uint64");
  }
  return wholeCoins * scale;
}

/** Validates an already-scaled positive Compact Uint<64> amount. */
export function validateUint64Amount(amount: bigint): bigint {
  if (typeof amount !== "bigint" || amount <= 0n) {
    throw new RangeError("amount must be a positive bigint");
  }
  if (amount > UINT64_MAX) throw new RangeError("amount exceeds Uint64");
  return amount;
}
