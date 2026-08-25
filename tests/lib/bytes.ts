import { keccak_256 } from "@noble/hashes/sha3.js";

export type Hex = `0x${string}`;
export type Hex20 = Hex;
export type Hex32 = Hex;

export const ZERO_20 = `0x${"00".repeat(20)}` as Hex20;
export const ZERO_32 = `0x${"00".repeat(32)}` as Hex32;

export function bytesToHex(bytes: Uint8Array): Hex {
  let value = "0x";
  for (const byte of bytes) value += byte.toString(16).padStart(2, "0");
  return value as Hex;
}

export function hexToBytes(value: string, expectedLength?: number): Uint8Array {
  if (!/^0x[0-9a-fA-F]*$/.test(value) || (value.length - 2) % 2 !== 0) {
    throw new TypeError("hex value must be 0x-prefixed and contain complete bytes");
  }
  const length = (value.length - 2) / 2;
  if (expectedLength !== undefined && length !== expectedLength) {
    throw new RangeError(`hex value must be ${expectedLength} bytes, got ${length}`);
  }
  const output = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    output[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return output;
}

export function canonicalHex(value: string, length: number): Hex {
  return bytesToHex(hexToBytes(value, length));
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function keccak(bytes: Uint8Array): Uint8Array {
  return keccak_256(bytes);
}

export function keccakHex(bytes: Uint8Array): Hex32 {
  return bytesToHex(keccak(bytes)) as Hex32;
}

export function assertUint(value: bigint, bits: number, label: string): bigint {
  if (value < 0n || value >= 1n << BigInt(bits)) {
    throw new RangeError(`${label} must fit uint${bits}`);
  }
  return value;
}

/** Encode an unsigned BigInt as one standard 32-byte EIP-712 ABI word. */
export function uintWord(value: bigint, bits: 8 | 64 | 128 | 256, label: string): Uint8Array {
  assertUint(value, bits, label);
  const output = new Uint8Array(32);
  let remaining = value;
  for (let index = 31; index >= 0; index -= 1) {
    // This conversion is one bounded byte only. No uint64/uint128 value is ever converted to Number.
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return output;
}

export function bytes32Word(value: string, label: string): Uint8Array {
  try {
    return hexToBytes(value, 32);
  } catch (error) {
    throw new RangeError(`${label}: ${(error as Error).message}`);
  }
}

export function addressWord(value: string, label: string): Uint8Array {
  const address = hexToBytes(value, 20);
  const output = new Uint8Array(32);
  output.set(address, 12);
  if (output.length !== 32) throw new Error(`${label}: internal address encoding failure`);
  return output;
}

export function words(...values: readonly Uint8Array[]): Uint8Array {
  for (const value of values) {
    if (value.length !== 32) throw new RangeError(`ABI word must be 32 bytes, got ${value.length}`);
  }
  return concatBytes(...values);
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}
