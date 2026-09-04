import { pathToFileURL } from "node:url";

import type { FundingConfig } from "../funding/router.js";
import type { AaLiveRuntime, AaLiveRuntimeModule } from "./types.js";

export async function loadLiveRuntime(config: FundingConfig): Promise<AaLiveRuntime> {
  const raw: unknown = await import(pathToFileURL(config.liveRuntimeModulePath).href);
  if (!raw || typeof raw !== "object") throw new TypeError("live runtime module must be an object");
  const module = raw as Partial<AaLiveRuntimeModule>;
  if (module.deploymentProfile !== config.deploymentProfile) {
    throw new RangeError("live runtime module does not match the declared deployment profile");
  }
  if (typeof module.createLiveRuntime !== "function") {
    throw new TypeError("live runtime module must export createLiveRuntime");
  }
  return module.createLiveRuntime(config);
}
