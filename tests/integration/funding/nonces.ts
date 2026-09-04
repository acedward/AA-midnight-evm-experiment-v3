import { randomBytes } from "node:crypto";

import type { NoncePort } from "./types.js";

export class CryptoNonceSource implements NoncePort {
  nextUint128(): bigint {
    const bytes = randomBytes(16);
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    return value;
  }

  nextBytes32(): Uint8Array {
    return new Uint8Array(randomBytes(32));
  }
}
