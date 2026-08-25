// loader-verify.mjs — read the generated prover key through the EXACT pinned Node loader path.
//
// WHY THIS EXISTS. Node's `fs.readFile` cannot return more than 2 GiB in one Buffer. The pinned
// midnight-js loader reads a prover key that way, so a key over the ceiling is unloadable:
//
//     RangeError [ERR_FS_FILE_TOO_LARGE]: File size (2282126073) is greater than 2 GiB
//
// 2,282,126,073 bytes is what the k=20 Manager's `execute.prover` weighed, and that refusal is the
// reason `execute` was driven down to k=19 — where the same key is 1,141,041,759 bytes and loads.
// This script proves the current key set actually loads, through the named path rather than by
// arguing from its size:
//
//   - `@midnight-ntwrk/midnight-js-node-zk-config-provider`
//     `NodeZkConfigProvider.readFile` -> `fs/promises.readFile(target)` as ONE Buffer;
//     `getProverKey` awaits that complete buffer and wraps it as one prover key.
//   - `@midnight-ntwrk/midnight-js-types`
//     `ZKConfigRegistry.buildConfig` -> `Promise.all` over prover key, verifier key and ZKIR.
//
// It is LOCAL ONLY: no network, no proof, no submission, no deployment. It only reads files and
// assembles an in-memory config.
//
// It also runs a CONTROL: the same `fs/promises.readFile` is pointed at a sparse file of exactly
// the k=20 key's size. If that control does NOT throw ERR_FS_FILE_TOO_LARGE then the ceiling has
// moved for some unrelated reason, and a "success" on the real key would prove nothing about the
// mechanism. The control is what makes the result attributable to the KEY SIZE.
//
// usage: node scripts/loader-verify.mjs <keygen-output-dir> [circuitId]

import { readFile } from "node:fs/promises";
import { stat, open, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { ZKConfigRegistry } from "@midnight-ntwrk/midnight-js-types";

const TWO_GIB = 2_147_483_648;
const K20_PROVER_BYTES = 2_282_126_073; // the exact size of the k=20 key the loader refused

const artifactDir = process.argv[2];
const circuitId = process.argv[3] ?? "execute";
if (!artifactDir) {
  console.error("usage: node scripts/loader-verify.mjs <keygen-output-dir> [circuitId]");
  process.exit(64);
}

const line = (key, value) => console.log(`${key}=${value}`);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

line("LOADER_VERIFY_START", new Date().toISOString());
line("NODE_VERSION", process.version);
line("ARTIFACT_DIR", artifactDir);
line("CIRCUIT_ID", circuitId);
line("TWO_GIB_CEILING_BYTES", TWO_GIB);
line("K20_PROVER_BYTES_REFERENCE", K20_PROVER_BYTES);

// ------------------------------------------------------------------------------------------------
// 0. The artifact under test
// ------------------------------------------------------------------------------------------------
const proverPath = path.resolve(artifactDir, "keys", `${circuitId}.prover`);
const verifierPath = path.resolve(artifactDir, "keys", `${circuitId}.verifier`);
const zkirPath = path.resolve(artifactDir, "zkir", `${circuitId}.bzkir`);

const proverStat = await stat(proverPath);
line("PROVER_PATH", proverPath);
line("PROVER_BYTES", proverStat.size);
line("PROVER_UNDER_CEILING", proverStat.size < TWO_GIB);
line("PROVER_HEADROOM_BYTES", TWO_GIB - proverStat.size);
line("PROVER_VS_K20_RATIO", (proverStat.size / K20_PROVER_BYTES).toFixed(4));

// ------------------------------------------------------------------------------------------------
// 1. CONTROL — the ceiling still exists at this Node version
// ------------------------------------------------------------------------------------------------
// A sparse file of exactly the k=20 key's size. `fs.readFile` sizes the file with fstat before
// allocating, so this reproduces the refusal without writing 2.28 GB.
// Written to the OS temp dir, never next to the artifacts: the key output stays untouched and can
// stay mounted read-only.
const controlPath = path.join(tmpdir(), "aa-loader-ceiling-control.bin");
let controlVerdict = "NOT_RUN";
try {
  const handle = await open(controlPath, "w");
  await handle.truncate(K20_PROVER_BYTES);
  await handle.close();
  const controlStat = await stat(controlPath);
  line("CONTROL_PATH", controlPath);
  line("CONTROL_BYTES", controlStat.size);
  try {
    await readFile(controlPath);
    controlVerdict = "UNEXPECTED_SUCCESS";
  } catch (error) {
    controlVerdict = `${error?.code ?? "UNKNOWN"}: ${error?.message ?? error}`;
  }
} finally {
  await unlink(controlPath).catch(() => {});
}
line("CONTROL_VERDICT", controlVerdict);
line(
  "CONTROL_REPRODUCES_THE_BLOCKER",
  controlVerdict.startsWith("ERR_FS_FILE_TOO_LARGE"),
);

// ------------------------------------------------------------------------------------------------
// 2. THE EXACT FAILING PATH — NodeZkConfigProvider.getProverKey -> fs/promises.readFile
// ------------------------------------------------------------------------------------------------
const provider = new NodeZkConfigProvider(artifactDir);
let proverKey;
let getProverKeyVerdict;
let getProverKeyMs = -1;
const t0 = performance.now();
try {
  proverKey = await provider.getProverKey(circuitId);
  getProverKeyMs = performance.now() - t0;
  getProverKeyVerdict = "OK";
} catch (error) {
  getProverKeyMs = performance.now() - t0;
  getProverKeyVerdict = `${error?.code ?? error?.name ?? "UNKNOWN"}: ${error?.message ?? error}`;
}
line("GET_PROVER_KEY_VERDICT", getProverKeyVerdict);
line("GET_PROVER_KEY_MS", getProverKeyMs.toFixed(1));
if (proverKey !== undefined) {
  const bytes = proverKey instanceof Uint8Array ? proverKey : new Uint8Array(proverKey);
  line("PROVER_KEY_LOADED_BYTES", bytes.length);
  line("PROVER_KEY_MATCHES_FILE_SIZE", bytes.length === proverStat.size);
  line("PROVER_KEY_SHA256", sha256(bytes));
}

// ------------------------------------------------------------------------------------------------
// 3. ZKConfigProvider.get — prover key + verifier key + ZKIR through the same provider
// ------------------------------------------------------------------------------------------------
let providerGetVerdict;
try {
  const config = await provider.get(circuitId);
  providerGetVerdict = "OK";
  line("PROVIDER_GET_CIRCUIT_ID", config.circuitId);
  line("PROVIDER_GET_PROVER_BYTES", config.proverKey.length);
  line("PROVIDER_GET_VERIFIER_BYTES", config.verifierKey.length);
  line("PROVIDER_GET_ZKIR_BYTES", config.zkir.length);
} catch (error) {
  providerGetVerdict = `${error?.code ?? error?.name ?? "UNKNOWN"}: ${error?.message ?? error}`;
}
line("PROVIDER_GET_VERDICT", providerGetVerdict);

// ------------------------------------------------------------------------------------------------
// 4. ZKConfigRegistry.buildConfig — the Promise.all in-memory assembly
// ------------------------------------------------------------------------------------------------
const registry = new ZKConfigRegistry([provider]);
let buildConfigVerdict;
let buildConfigMs = -1;
const t1 = performance.now();
try {
  const config = await registry.buildConfig(provider, circuitId);
  buildConfigMs = performance.now() - t1;
  buildConfigVerdict = "OK";
  line("BUILD_CONFIG_CIRCUIT_ID", config.circuitId);
  line("BUILD_CONFIG_PROVER_BYTES", config.proverKey.length);
  line("BUILD_CONFIG_VERIFIER_BYTES", config.verifierKey.length);
  line("BUILD_CONFIG_ZKIR_BYTES", config.zkir.length);
  line(
    "BUILD_CONFIG_TOTAL_IN_MEMORY_BYTES",
    config.proverKey.length + config.verifierKey.length + config.zkir.length,
  );
} catch (error) {
  buildConfigMs = performance.now() - t1;
  buildConfigVerdict = `${error?.code ?? error?.name ?? "UNKNOWN"}: ${error?.message ?? error}`;
}
line("BUILD_CONFIG_VERDICT", buildConfigVerdict);
line("BUILD_CONFIG_MS", buildConfigMs.toFixed(1));

// ------------------------------------------------------------------------------------------------
// 5. Every other provable circuit, so the whole deployable key set is proven loadable
// ------------------------------------------------------------------------------------------------
const allCircuits = [
  "accountRecord",
  "depositShielded",
  "depositUnshielded",
  "execute",
  "isRegistered",
  "poolHasColour",
  "poolValue",
  "shieldedAccountBalance",
  "unshieldedAccountBalance",
];
let allOk = true;
let totalProver = 0;
for (const id of allCircuits) {
  try {
    const config = await registry.buildConfig(provider, id);
    totalProver += config.proverKey.length;
    line(
      `CIRCUIT_${id}`,
      `OK prover=${config.proverKey.length} verifier=${config.verifierKey.length} zkir=${config.zkir.length}`,
    );
  } catch (error) {
    allOk = false;
    line(`CIRCUIT_${id}`, `FAILED ${error?.code ?? error?.name ?? "UNKNOWN"}: ${error?.message ?? error}`);
  }
}
line("ALL_NINE_CIRCUITS_LOADED", allOk);
line("TOTAL_PROVER_BYTES_ALL_CIRCUITS", totalProver);

line("MEMORY_RSS_BYTES", process.memoryUsage().rss);
line("LOADER_VERIFY_END", new Date().toISOString());

const success =
  getProverKeyVerdict === "OK" &&
  providerGetVerdict === "OK" &&
  buildConfigVerdict === "OK" &&
  allOk &&
  controlVerdict.startsWith("ERR_FS_FILE_TOO_LARGE");
line("OVERALL", success ? "PASS" : "FAIL");
process.exit(success ? 0 : 1);
