/** Drops causes/stacks and replaces a literal secret before an error crosses the funding boundary. */
export function redactSecretError(error: unknown, secret: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const redacted = secret.length === 0 ? message : message.replace(new RegExp(escaped, "gi"), "[REDACTED]");
  return new Error(redacted || "funding operation failed");
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
