import { secp256k1 } from "@noble/curves/secp256k1.js";

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  keccak,
  type Hex20,
  type Hex32,
} from "./bytes.js";

export const SECP256K1_N = secp256k1.Point.Fn.ORDER;
export const SECP256K1_HALF_N = SECP256K1_N >> 1n;

export interface ParsedSignature {
  r: bigint;
  s: bigint;
  v: 0 | 1 | 27 | 28;
  recovery: 0 | 1;
  rBytes: Uint8Array;
  sBytes: Uint8Array;
}

export interface AffinePointTransport {
  x: bigint;
  y: bigint;
  identity: false;
  xBytes: Uint8Array;
  yBytes: Uint8Array;
}

function scalar(bytes: Uint8Array): bigint {
  return BigInt(bytesToHex(bytes));
}

export function parseSignature(
  input: string | Uint8Array,
  options: { requireLowS?: boolean } = {},
): ParsedSignature {
  const bytes = typeof input === "string" ? hexToBytes(input) : Uint8Array.from(input);
  if (bytes.length !== 65) {
    throw new RangeError(`signature must be exactly 65 bytes (r || s || v), got ${bytes.length}`);
  }
  const rBytes = bytes.slice(0, 32);
  const sBytes = bytes.slice(32, 64);
  const r = scalar(rBytes);
  const s = scalar(sBytes);
  if (r === 0n || r >= SECP256K1_N) throw new RangeError("signature r is outside [1,n-1]");
  if (s === 0n || s >= SECP256K1_N) throw new RangeError("signature s is outside [1,n-1]");
  if ((options.requireLowS ?? true) && s > SECP256K1_HALF_N) {
    throw new RangeError("signature s is not canonical low-s");
  }
  const rawV = bytes[64]!;
  if (rawV !== 0 && rawV !== 1 && rawV !== 27 && rawV !== 28) {
    throw new RangeError(`signature v must be 0, 1, 27, or 28; got ${rawV}`);
  }
  const v = rawV as ParsedSignature["v"];
  const recovery = (rawV >= 27 ? rawV - 27 : rawV) as 0 | 1;
  return { r, s, v, recovery, rBytes, sBytes };
}

export function highSTwin(signature: string | Uint8Array): `0x${string}` {
  const parsed = parseSignature(signature, { requireLowS: false });
  const twinS = SECP256K1_N - parsed.s;
  const output = new Uint8Array(65);
  output.set(parsed.rBytes, 0);
  const twinHex = twinS.toString(16).padStart(64, "0");
  output.set(hexToBytes(`0x${twinHex}`, 32), 32);
  output[64] = parsed.v >= 27 ? 27 + (parsed.recovery ^ 1) : parsed.recovery ^ 1;
  return bytesToHex(output);
}

export function recoverPoint(
  digest: Hex32 | Uint8Array,
  signature: string | Uint8Array,
  options: { requireLowS?: boolean } = {},
): AffinePointTransport {
  const digestBytes = typeof digest === "string" ? hexToBytes(digest, 32) : Uint8Array.from(digest);
  if (digestBytes.length !== 32) throw new RangeError("digest must be 32 bytes");
  const parsed = parseSignature(signature, options);
  const recovered = new secp256k1.Signature(parsed.r, parsed.s, parsed.recovery)
    .recoverPublicKey(digestBytes)
    .toAffine();
  const xBytes = hexToBytes(`0x${recovered.x.toString(16).padStart(64, "0")}`, 32);
  const yBytes = hexToBytes(`0x${recovered.y.toString(16).padStart(64, "0")}`, 32);
  const compact = concatBytes(parsed.rBytes, parsed.sBytes);
  const uncompressed = concatBytes(Uint8Array.of(4), xBytes, yBytes);
  if (!secp256k1.verify(compact, digestBytes, uncompressed, { prehash: false, lowS: false })) {
    throw new Error("recovered point does not verify the signature");
  }
  return { x: recovered.x, y: recovered.y, identity: false, xBytes, yBytes };
}

export function ethereumAddress(point: AffinePointTransport): Hex20 {
  return bytesToHex(keccak(concatBytes(point.xBytes, point.yBytes)).slice(12)) as Hex20;
}

export function recoverSigner(
  digest: Hex32 | Uint8Array,
  signature: string | Uint8Array,
  options: { requireLowS?: boolean } = {},
): { point: AffinePointTransport; address: Hex20; parsed: ParsedSignature } {
  const parsed = parseSignature(signature, options);
  const point = recoverPoint(digest, signature, options);
  return { point, address: ethereumAddress(point), parsed };
}

export function publicPointForPrivateKey(privateKey: Hex32): AffinePointTransport {
  const encoded = secp256k1.getPublicKey(hexToBytes(privateKey, 32), false);
  const xBytes = encoded.slice(1, 33);
  const yBytes = encoded.slice(33, 65);
  return {
    x: BigInt(bytesToHex(xBytes)),
    y: BigInt(bytesToHex(yBytes)),
    identity: false,
    xBytes,
    yBytes,
  };
}

export function addressForPrivateKey(privateKey: Hex32): Hex20 {
  return ethereumAddress(publicPointForPrivateKey(privateKey));
}
