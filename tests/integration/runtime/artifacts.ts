import { access, readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { FundingConfig } from "../funding/router.js";

export interface ArtifactPreflight {
  readonly managedRoot: string;
  readonly runtimeVersion: "0.18.0-rc.1" | "0.19.0";
  readonly compilerVersion: string;
}

function manifestObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

async function verifyManifestTree(managedRoot: string, relative: string, value: unknown): Promise<void> {
  const entry = manifestObject(value, "contract manifest entry");
  if (entry.type === "file") {
    const expectedSize = entry.size;
    const expectedHash = entry.hash;
    if (!Number.isSafeInteger(expectedSize) || (expectedSize as number) < 0 ||
        typeof expectedHash !== "string" || !/^[0-9a-f]{64}$/.test(expectedHash)) {
      throw new RangeError("contract manifest file metadata is invalid");
    }
    let file;
    try {
      file = await stat(resolve(managedRoot, relative));
    } catch {
      throw new Error(`managed artifact is missing manifest-declared ${relative}`);
    }
    if (!file.isFile() || file.size !== expectedSize) {
      throw new Error(`managed artifact manifest size does not match ${relative}`);
    }
    return;
  }
  if (entry.type !== "directory") throw new RangeError("contract manifest entry type is invalid");
  for (const [name, child] of Object.entries(entry)) {
    if (name === "type") continue;
    if (!/^[A-Za-z0-9_.-]+$/.test(name) || name === "." || name === "..") {
      throw new RangeError("contract manifest contains an invalid relative entry name");
    }
    await verifyManifestTree(managedRoot, `${relative}/${name}`, child);
  }
}

export async function preflightManagedArtifact(
  managedRoot: string,
  expectedRuntime: ArtifactPreflight["runtimeVersion"],
): Promise<ArtifactPreflight> {
  const required = [
    "contract/index.js",
    "compiler/contract-manifest.json",
    "keys",
    "zkir",
  ];
  for (const relative of required) {
    try {
      await access(resolve(managedRoot, relative));
    } catch {
      throw new Error(`managed artifact is missing required ${relative}`);
    }
  }
  for (const directory of ["keys", "zkir"] as const) {
    if ((await readdir(resolve(managedRoot, directory))).length === 0) {
      throw new Error(`managed artifact required ${directory} directory is empty`);
    }
  }
  const raw: unknown = JSON.parse(await readFile(resolve(managedRoot, "compiler/contract-manifest.json"), "utf8"));
  const manifest = manifestObject(raw, "contract manifest");
  if (manifest["runtime-version"] !== expectedRuntime) {
    throw new RangeError("artifact runtime does not match the declared deployment profile");
  }
  if (typeof manifest["compiler-version"] !== "string" || manifest["compiler-version"].length === 0) {
    throw new RangeError("artifact compiler-version is missing");
  }
  const expectedCompilerLine = expectedRuntime === "0.18.0-rc.1" ? "0.33." : "0.34.";
  if (!(manifest["compiler-version"] as string).startsWith(expectedCompilerLine)) {
    throw new RangeError("artifact compiler line is incompatible with the declared runtime");
  }
  for (const directory of ["compiler", "contract", "keys", "zkir"] as const) {
    if (manifest[directory] !== undefined) {
      await verifyManifestTree(managedRoot, directory, manifest[directory]);
    }
  }
  return { managedRoot, runtimeVersion: expectedRuntime, compilerVersion: manifest["compiler-version"] };
}

async function requireCircuitAssets(managedRoot: string, circuit: string): Promise<void> {
  for (const relative of [
    `keys/${circuit}.prover`,
    `keys/${circuit}.verifier`,
    `zkir/${circuit}.zkir`,
    `zkir/${circuit}.bzkir`,
  ]) {
    try {
      await access(resolve(managedRoot, relative));
    } catch {
      throw new Error(`managed artifact is missing required live circuit asset ${relative}`);
    }
  }
}

/** Preflights the complete selected contract set before any generated module is imported. */
export async function preflightFundingArtifacts(config: FundingConfig): Promise<readonly ArtifactPreflight[]> {
  const manager = await preflightManagedArtifact(config.managerArtifactPath, config.managerRuntimeVersion);
  await requireCircuitAssets(config.managerArtifactPath, "execute");
  await requireCircuitAssets(config.managerArtifactPath, "depositShielded");
  const artifacts = [manager];
  if (config.mode === "aa-minter") {
    const minter = await preflightManagedArtifact(config.minterArtifactPath, config.minterRuntimeVersion);
    await requireCircuitAssets(config.minterArtifactPath, "mintShieldedTo");
    artifacts.push(minter);
  } else {
    // Minter is read/joined to verify the deployment identity even though its
    // mint circuit is not called in faucet mode; all verifier-key integrity is
    // checked by findDeployedContract after this filesystem preflight.
    const minter = await preflightManagedArtifact(config.minterArtifactPath, config.minterRuntimeVersion);
    const offerFiles = await preflightManagedArtifact(config.offerFilesArtifactPath, config.offerFilesRuntimeVersion);
    await requireCircuitAssets(config.offerFilesArtifactPath, "mint_shielded");
    artifacts.push(minter, offerFiles);
  }
  return artifacts;
}

export async function loadManagedContractModule(
  managedRoot: string,
  expectedRuntime: ArtifactPreflight["runtimeVersion"],
): Promise<Record<string, unknown> & { readonly Contract: new (...args: never[]) => unknown }> {
  await preflightManagedArtifact(managedRoot, expectedRuntime);
  const loaded: unknown = await import(pathToFileURL(resolve(managedRoot, "contract/index.js")).href);
  if (!loaded || typeof loaded !== "object" || typeof (loaded as Record<string, unknown>).Contract !== "function") {
    throw new TypeError("managed contract module does not export Contract");
  }
  return loaded as Record<string, unknown> & { readonly Contract: new (...args: never[]) => unknown };
}

/** Checks the full selected set, then imports/capability-checks it as one atomic pre-effect gate. */
export async function preflightAndLoadFundingArtifacts(config: FundingConfig): Promise<void> {
  await preflightFundingArtifacts(config);
  const manager = await loadManagedContractModule(config.managerArtifactPath, config.managerRuntimeVersion);
  const minter = await loadManagedContractModule(config.minterArtifactPath, config.minterRuntimeVersion);
  if (typeof manager.ledger !== "function" ||
      typeof (manager.pureCircuits as Record<string, unknown> | undefined)?.shieldedKey !== "function") {
    throw new TypeError("Manager generated module is missing required ledger capabilities");
  }
  if (typeof minter.ledger !== "function") {
    throw new TypeError("Minter generated module is missing required ledger capabilities");
  }
  if (config.mode === "offer-files-faucet") {
    await loadManagedContractModule(config.offerFilesArtifactPath, config.offerFilesRuntimeVersion);
  }
}
