import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const SCRIPT = existsSync(resolve(process.cwd(), "scripts/test-integration.sh"))
  ? resolve(process.cwd(), "scripts/test-integration.sh")
  : resolve(process.cwd(), "../scripts/test-integration.sh");
const roots: string[] = [];

function liveEnvironment(root: string): NodeJS.ProcessEnv {
  return {
    PATH: `${root}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    DOCKER_LOG: join(root, "docker.log"),
    AA_FAUCET_LIVE: "1",
    AA_HARNESS_CONTAINER: "aa-console-test",
    AA_DEPLOYMENT_PROFILE: "legacy-0.18",
    AA_EXPECTED_COMMIT: "713a20215f33e02904ea5bd699b7de7f76562e1b",
    MIDNIGHT_NETWORK_ID: "undeployed",
    MN_NODE_URL: "http://node:9944",
    MN_INDEXER_URL: "http://indexer:8088/api/v4/graphql",
    MN_INDEXER_WS_URL: "ws://indexer:8088/api/v4/graphql/ws",
    MN_PROOF_SERVER_URL: "http://aa-proof-server:6300",
    AA_WALLET_PROOF_SERVER_URL: "http://proof-server:6300",
    AA_HARNESS_WALLET_SEED: "ab".repeat(32),
    AA_MANAGER_ADDRESS: "11".repeat(32),
    AA_MINTER_ADDRESS: "22".repeat(32),
    AA_MINTER_TAG: "TOKA",
    AA_MINTER_SHIELDED_COLOR: "33".repeat(32),
    AA_MINTER_UNSHIELDED_COLOR: "44".repeat(32),
    OFFER_FILES_CONTRACT: "55".repeat(32),
    ZSWAP_API: "http://kernel:9999",
  };
}

async function fixture(): Promise<{ root: string; log: string }> {
  const root = await mkdtemp(join(tmpdir(), "aa-entrypoint-"));
  roots.push(root);
  const log = join(root, "docker.log");
  const docker = join(root, "docker");
  await writeFile(docker, `#!/bin/sh
printf 'flag=%s|' "\${OFFER_FILES_FAUCET-<absent>}" >> "\$DOCKER_LOG"
printf '%s\n' "\$*" >> "\$DOCKER_LOG"
if [ "\${1-}" = inspect ] && [ "\${2-}" = --format ]; then
  case "\${3-}" in
    *Config.Image*) printf '%s\n' 'aa-image:test' ;;
    *com.docker.compose.project*) printf '%s\n' 'aa-project-test' ;;
  esac
fi
`, { mode: 0o700 });
  await chmod(docker, 0o700);
  return { root, log };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
describe("manual integration shell entrypoint funding flag", () => {
  it.each([
    ["TRUE", "1", "faucet"],
    ["1", "1", "faucet"],
    ["FALSE", "0", "minter"],
    ["0", "0", "minter"],
    [undefined, "0", "minter"],
  ] as const)("normalizes %s to %s and forwards only the %s mode inputs", async (raw, normalized, mode) => {
    const { root, log } = await fixture();
    const env = liveEnvironment(root);
    if (raw === undefined) delete env.OFFER_FILES_FAUCET;
    else env.OFFER_FILES_FAUCET = raw;
    await execute("bash", [SCRIPT], { env });
    const calls = await readFile(log, "utf8");
    const run = calls.split("\n").find((line) => line.includes("|run ")) ?? "";
    expect(run).toContain(`flag=${normalized}|run `);
    expect(run).toContain("--env OFFER_FILES_FAUCET");
    if (mode === "faucet") {
      expect(run).toContain("--env OFFER_FILES_CONTRACT --env ZSWAP_API");
      expect(run).not.toContain("--env AA_MINTER_ADDRESS");
    } else {
      expect(run).toContain("--env AA_MINTER_ADDRESS --env AA_MINTER_TAG --env AA_MINTER_SHIELDED_COLOR --env AA_MINTER_UNSHIELDED_COLOR");
      expect(run).not.toContain("--env OFFER_FILES_CONTRACT");
      expect(run).not.toContain("--env ZSWAP_API");
    }
  });

  it("rejects yes before the first Docker call", async () => {
    const { root, log } = await fixture();
    await expect(execute("bash", [SCRIPT], {
      env: { ...liveEnvironment(root), OFFER_FILES_FAUCET: "yes" },
    })).rejects.toMatchObject({ code: 64 });
    expect(existsSync(log)).toBe(false);
  });
});
