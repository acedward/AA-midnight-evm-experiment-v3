import { isWalletSessionLifecycleError, WalletSessionStopError } from "./session-gate.js";

/** Drops all untrusted text while preserving the lifecycle poison classification. */
export function fixedStageError(error: unknown, stage: string): Error {
  return isWalletSessionLifecycleError(error)
    ? new WalletSessionStopError(`${stage} lifecycle failed`)
    : new Error(`${stage} failed`);
}

export function assertNoLiteralSecret(value: unknown, secret: string): void {
  if (secret.length === 0) return;
  const visit = (candidate: unknown): boolean => {
    if (typeof candidate === "string") return candidate.toLowerCase().includes(secret.toLowerCase());
    if (!candidate || typeof candidate !== "object") return false;
    if (Array.isArray(candidate)) return candidate.some(visit);
    return Object.entries(candidate as Record<string, unknown>)
      .some(([key, child]) => key.toLowerCase().includes(secret.toLowerCase()) || visit(child));
  };
  if (visit(value)) throw new Error("funding output contained secret material");
}

export function withNonEnumerableSecret<T extends object, K extends string>(
  value: T,
  key: K,
  secret: string,
): T & Readonly<Record<K, string>> {
  Object.defineProperty(value, key, {
    value: secret,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return value as T & Readonly<Record<K, string>>;
}
