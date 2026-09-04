import type {
  FundingWalletSession,
  FundingWalletSessionFactory,
} from "./types.js";

export class WalletSessionStopError extends Error {
  readonly name = "WalletSessionStopError";

  constructor(message: string) {
    super(message);
    Object.defineProperty(this, Symbol.for("aa.wallet-session-lifecycle-error"), {
      value: true,
      enumerable: false,
    });
  }
}

export function isWalletSessionLifecycleError(error: unknown): boolean {
  return error instanceof WalletSessionStopError || Boolean(
    error && typeof error === "object" &&
    (error as Record<PropertyKey, unknown>)[Symbol.for("aa.wallet-session-lifecycle-error")] === true,
  );
}

/**
 * Serializes wallet facades for one seed. A failed stop poisons the gate because
 * opening a replacement facade could force either session offline.
 */
export class SingleSessionGate {
  #active = false;
  #poisoned = false;

  constructor(private readonly factory: FundingWalletSessionFactory) {}

  get poisoned(): boolean {
    return this.#poisoned;
  }

  async run<T>(
    input: Parameters<FundingWalletSessionFactory["open"]>[0],
    operation: (session: FundingWalletSession) => Promise<T>,
  ): Promise<T> {
    if (this.#poisoned) {
      throw new Error("wallet session gate is poisoned after lifecycle failure");
    }
    if (this.#active) throw new Error("wallet session gate already has an active facade");
    this.#active = true;
    let session: FundingWalletSession | undefined;
    let operationError: unknown;
    try {
      try {
        session = await this.factory.open(input);
      } catch {
        this.#poisoned = true;
        throw new WalletSessionStopError("wallet facade open failed; lifecycle is uncertain");
      }
      return await operation(session);
    } catch (error) {
      operationError = error;
      throw error;
    } finally {
      if (session) {
        try {
          await session.stop();
        } catch {
          this.#poisoned = true;
          if (operationError !== undefined) {
            throw new WalletSessionStopError("wallet operation and facade stop both failed");
          }
          throw new WalletSessionStopError("wallet facade stop failed");
        } finally {
          this.#active = false;
        }
      } else {
        this.#active = false;
      }
    }
  }
}
