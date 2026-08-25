import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "../lib/bytes.js";
import { computeDigest } from "../lib/codec.js";
import {
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  KAT_OWNER,
  KAT_PRIVATE_KEY,
  KAT_SIGNATURE,
} from "../fixtures/generate.js";
import { metamaskRecover, metamaskSign } from "../lib/metamask.js";
import {
  SECP256K1_N,
  addressForPrivateKey,
  highSTwin,
  parseSignature,
  recoverSigner,
} from "../lib/signature.js";

function scalarBytes(value: bigint): Uint8Array {
  return hexToBytes(`0x${value.toString(16).padStart(64, "0")}`, 32);
}

describe("strict 65-byte signature and affine transport", () => {
  const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;

  it("reproduces the normative MetaMask-compatible r/s/v signature exactly", () => {
    expect(metamaskSign(KAT_PRIVATE_KEY, KAT_ACTION, KAT_DEPLOYMENT_DOMAIN)).toBe(KAT_SIGNATURE);
    expect(metamaskRecover(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, KAT_SIGNATURE)).toBe(KAT_OWNER);
    expect(addressForPrivateKey(KAT_PRIVATE_KEY)).toBe(KAT_OWNER);
  });

  it("accepts only v 0/1/27/28 and normalizes the recovery bit", () => {
    const bytes = hexToBytes(KAT_SIGNATURE, 65);
    for (const [v, recovery] of [[0, 0], [1, 1], [27, 0], [28, 1]] as const) {
      bytes[64] = v;
      expect(parseSignature(bytes)).toMatchObject({ v, recovery });
    }
    for (const v of [2, 26, 29, 255]) {
      bytes[64] = v;
      expect(() => parseSignature(bytes)).toThrow(/v must be/);
    }
  });

  it("rejects extra/missing bytes and zero/out-of-range scalars", () => {
    const valid = hexToBytes(KAT_SIGNATURE, 65);
    expect(() => parseSignature(valid.slice(0, 64))).toThrow(/exactly 65/);
    expect(() => parseSignature(new Uint8Array(66))).toThrow(/exactly 65/);
    const invalid = Uint8Array.from(valid);
    invalid.fill(0, 0, 32);
    expect(() => parseSignature(invalid)).toThrow(/r is outside/);
    invalid.set(scalarBytes(SECP256K1_N), 0);
    expect(() => parseSignature(invalid)).toThrow(/r is outside/);
    invalid.set(valid.slice(0, 32), 0);
    invalid.fill(0, 32, 64);
    expect(() => parseSignature(invalid)).toThrow(/s is outside/);
    invalid.set(scalarBytes(SECP256K1_N), 32);
    expect(() => parseSignature(invalid)).toThrow(/s is outside/);
  });

  it("enforces low-s while retaining a same-digest/signer high-s twin KAT", () => {
    const twin = highSTwin(KAT_SIGNATURE);
    expect(() => parseSignature(twin)).toThrow(/low-s/);
    const low = recoverSigner(digest, KAT_SIGNATURE);
    const high = recoverSigner(digest, twin, { requireLowS: false });
    expect(high.address).toBe(low.address);
    expect(high.address).toBe(KAT_OWNER);
    expect(high.point.x).toBe(low.point.x);
    expect(high.point.y).toBe(low.point.y);
    expect(parseSignature(KAT_SIGNATURE).s).toBeLessThanOrEqual(SECP256K1_N >> 1n);
    expect(parseSignature(twin, { requireLowS: false }).s).toBeGreaterThan(SECP256K1_N >> 1n);
  });

  it("uses unsigned 32-byte big-endian affine coordinates and Ethereum derivation", () => {
    const recovered = recoverSigner(digest, KAT_SIGNATURE);
    expect(recovered.point.identity).toBe(false);
    expect(recovered.point.xBytes).toHaveLength(32);
    expect(recovered.point.yBytes).toHaveLength(32);
    expect(bytesToHex(recovered.point.xBytes)).toBe(
      "0x4e3b81af9c2234cad09d679ce6035ed1392347ce64ce405f5dcd36228a25de6e",
    );
    expect(bytesToHex(recovered.point.yBytes)).toBe(
      "0x47fd35c4215d1edf53e6f83de344615ce719bdb0fd878f6ed76f06dd277956de",
    );
    expect(recovered.address).toBe(KAT_OWNER);
  });
});
