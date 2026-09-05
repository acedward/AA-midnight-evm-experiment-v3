#!/usr/bin/env bun
/** Manual-only AA harness entrypoint. Its non-*.test.ts name keeps Vitest discovery empty. */
import { lstat, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { readLegacyAaDeploymentReceipt } from "./deployment-receipt.js";
import { assertNoLiteralSecret } from "./funding/redact.js";
import { parseFundingEnvironment, type FundingConfig } from "./funding/router.js";
import { runAaFaucetHarness } from "./harness.js";
import { preflightAndLoadFundingArtifacts } from "./runtime/artifacts.js";
import { loadLiveRuntime } from "./runtime/load.js";

async function canonicalTarget(path: string): Promise<string> {
  return join(await realpath(dirname(path)), basename(path));
}

export async function preflightReceiptDestinations(config: FundingConfig): Promise<void> {
  assertNoLiteralSecret([
    config.decoratedDeploymentReceiptPath,
    config.runReceiptPath,
  ], config.harnessWalletSeed);
  const input = await realpath(config.deploymentReceiptPath);
  const inputStat = await stat(input);
  const outputs = await Promise.all([
    canonicalTarget(config.decoratedDeploymentReceiptPath),
    canonicalTarget(config.runReceiptPath),
  ]);
  if (outputs[0] === outputs[1] || outputs.includes(input)) {
    throw new RangeError("receipt input and output destinations must be distinct");
  }
  const existingTargets = new Set<string>([`${inputStat.dev}:${inputStat.ino}`]);
  for (const path of [config.decoratedDeploymentReceiptPath, config.runReceiptPath]) {
    const parent = dirname(resolve(path));
    const parentStat = await stat(parent);
    if (!parentStat.isDirectory()) throw new RangeError("receipt output parent must be a directory");
    const probe = join(parent, `.aa-faucet-write-probe.${randomUUID()}.tmp`);
    try {
      await writeFile(probe, "", { encoding: "utf8", mode: 0o600, flag: "wx" });
    } finally {
      await unlink(probe).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    try {
      const target = await lstat(path);
      if (target.isSymbolicLink() || !target.isFile()) throw new RangeError("existing receipt output must be a regular file");
      const identity = `${target.dev}:${target.ino}`;
      if (existingTargets.has(identity)) throw new RangeError("receipt input and output destinations must be distinct");
      existingTargets.add(identity);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function writeJsonAtomic(path: string, value: unknown, seed: string): Promise<void> {
  assertNoLiteralSecret(value, seed);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (serialized.toLowerCase().includes(seed.toLowerCase())) {
    throw new Error("receipt serialization contained secret material");
  }
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export async function main(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = parseFundingEnvironment(environment);
  await preflightReceiptDestinations(config);
  const legacyReceipt = await readLegacyAaDeploymentReceipt(config.deploymentReceiptPath);

  // The complete profile is checked before the runtime module or any generated
  // contract is imported and before any wallet/provider effect begins.
  await preflightAndLoadFundingArtifacts(config);
  const runtime = await loadLiveRuntime(config);
  const result = await runAaFaucetHarness({ config, legacyReceipt, runtime });
  await writeJsonAtomic(config.decoratedDeploymentReceiptPath, result.deploymentReceipt, config.harnessWalletSeed);
  await writeJsonAtomic(config.runReceiptPath, result.runReceipt, config.harnessWalletSeed);

  // Fixed-field summary only: never log config, wallet/provider results, or
  // private callTx data.
  console.log(JSON.stringify({
    status: "passed",
    mode: result.runReceipt.mode,
    tokenNames: result.runReceipt.tokens.map((token) => token.name),
    transactions: result.runReceipt.transactions.length,
  }));
}

export async function runManualEntrypoint(
  operation: () => Promise<void> = () => main(),
  writeError: (message: string) => void = (message) => console.error(message),
): Promise<number> {
  try {
    await operation();
    return 0;
  } catch {
    writeError("AA faucet harness failed");
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runManualEntrypoint();
