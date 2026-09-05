import type { KnownTokenRegistryPort } from "./types.js";

/** Deliberately exposes no generic request method and can only perform the registry GET. */
export class HttpKnownTokenRegistry implements KnownTokenRegistryPort {
  readonly #endpoint: string;
  readonly #request: typeof fetch;

  constructor(baseUrl: string, request: typeof fetch = fetch) {
    this.#endpoint = new URL("/v1/known-tokens", baseUrl).toString();
    this.#request = request;
  }

  async getKnownTokens(): Promise<readonly unknown[]> {
    const response = await this.#request(this.#endpoint, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`GET /v1/known-tokens failed with status ${response.status}`);
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new TypeError("GET /v1/known-tokens must return an array");
    return body;
  }
}
