import { createHash } from "node:crypto";

interface SeedState {
  active: boolean;
  poisoned: boolean;
}

const SEED_STATES = new Map<string, SeedState>();

/** Process-wide guard: one funding workflow per normalized seed, with permanent stop poisoning. */
export class SeedFundingCoordinator {
  readonly #key: string;

  constructor(seed: string, namespace = "funding") {
    this.#key = createHash("sha256").update(namespace).update("\0").update(seed).digest("hex");
  }

  async run<T>(operation: () => Promise<T>, isStopFailure: (error: unknown) => boolean): Promise<T> {
    const state = SEED_STATES.get(this.#key) ?? { active: false, poisoned: false };
    SEED_STATES.set(this.#key, state);
    if (state.poisoned) throw new Error("wallet seed is poisoned after lifecycle failure");
    if (state.active) throw new Error("a funding operation is already active for this wallet seed");
    state.active = true;
    try {
      return await operation();
    } catch (error) {
      if (isStopFailure(error)) state.poisoned = true;
      throw error;
    } finally {
      state.active = false;
      if (!state.poisoned) SEED_STATES.delete(this.#key);
    }
  }
}
