import { link, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  decorateLegacyAaDeploymentReceipt,
  parseLegacyAaDeploymentReceipt,
} from "../integration/deployment-receipt.js";
import { parseFundingEnvironment } from "../integration/funding/router.js";
import {
  loadManagedContractModule,
  preflightAndLoadFundingArtifacts,
  preflightFundingArtifacts,
  preflightManagedArtifact,
} from "../integration/runtime/artifacts.js";
import {
  assertWalletReadiness,
  callLegacyOfferFilesMint,
  managerAccountMatches,
  RuntimeFacadeCoordinator,
  submitShieldedWithdrawPipeline,
  waitForExactBigint,
} from "../integration/aa-faucet-runtime.js";
import {
  preflightReceiptDestinations,
  runManualEntrypoint,
  writeJsonAtomic,
} from "../integration/aa-faucet-runner.js";
import {
  aaMinterTokenColor,
  aaMinterTokenMetadata,
  offerFilesTokenMetadata,
} from "../lib/token-metadata.js";

const MANAGER = "11".repeat(32);
const MINTER = "22".repeat(32);
const SHIELDED = aaMinterTokenColor("shielded", "TOKA", MINTER);
const UNSHIELDED = aaMinterTokenColor("unshielded", "TOKA", MINTER);
const OFFER_FILES = "55".repeat(32);
const SEED = "ab".repeat(32);
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function legacy() {
  return {
    network: "undeployed",
    aaCommit: "713a20215f33e02904ea5bd699b7de7f76562e1b",
    manager: { address: MANAGER, domain: "demo-infra:aa:v1" },
    minter: { address: MINTER, tag: "TOKA" },
    mints: {
      shielded: { color: SHIELDED, tx: "shielded-mint", recipient: "deploy wallet (coin public key)" },
      unshielded: { color: UNSHIELDED, tx: "unshielded-mint", recipient: "mn_addr-test" },
    },
    deployedAt: "2026-09-04T20:00:00.000Z",
    tookSeconds: 42,
  };
}

function commonEnv() {
  return {
    AA_DEPLOYMENT_PROFILE: "legacy-0.18",
    AA_EXPECTED_COMMIT: legacy().aaCommit,
    MIDNIGHT_NETWORK_ID: "undeployed",
    MN_NODE_URL: "http://node:9944",
    MN_INDEXER_URL: "http://indexer:8088/api/v4/graphql",
    MN_INDEXER_WS_URL: "ws://indexer:8088/api/v4/graphql/ws",
    MN_PROOF_SERVER_URL: "http://aa-proof-server:6300",
    AA_WALLET_PROOF_SERVER_URL: "http://proof-server:6300",
    AA_HARNESS_WALLET_SEED: SEED,
    AA_MANAGER_ADDRESS: MANAGER,
  };
}

function minterConfig() {
  return parseFundingEnvironment({
    ...commonEnv(),
    AA_MINTER_ADDRESS: MINTER,
    AA_MINTER_TAG: "TOKA",
    AA_MINTER_SHIELDED_COLOR: SHIELDED,
    AA_MINTER_UNSHIELDED_COLOR: UNSHIELDED,
  });
}

function faucetConfig() {
  return parseFundingEnvironment({
    ...commonEnv(),
    OFFER_FILES_FAUCET: "1",
    OFFER_FILES_CONTRACT: OFFER_FILES,
    ZSWAP_API: "http://kernel:9999",
  });
}

function verifiedMinter() {
  return {
    address: MINTER,
    tag: "TOKA",
    shieldedColor: SHIELDED,
    unshieldedColor: UNSHIELDED,
  };
}

describe("bounded stock deployment receipt conversion", () => {
  it("parses the exact unversioned producer shape and decorates it into aa-contracts/v1", () => {
    const parsed = parseLegacyAaDeploymentReceipt(legacy());
    const receipt = decorateLegacyAaDeploymentReceipt({
      legacy: parsed,
      config: minterConfig(),
      verifiedMinter: verifiedMinter(),
      tokens: [aaMinterTokenMetadata({
        family: "shielded",
        color: SHIELDED,
        internalDeploymentTag: "TOKA",
      })],
    });
    expect(receipt).toMatchObject({
      schemaVersion: "aa-contracts/v1",
      network: "undeployed",
      aaCommit: legacy().aaCommit,
      manager: legacy().manager,
      minter: legacy().minter,
    });
    expect(receipt.tokens.map((token) => [token.name, token.source])).toEqual([
      ["AATEST-S", "aa-minter"],
      ["AATEST-U", "aa-minter"],
    ]);
  });

  it("decorates faucet provenance without relabeling the legacy Minter colour", () => {
    const wbtc = offerFilesTokenMetadata({
      name: "WBTC",
      family: "shielded",
      offerFilesAddress: OFFER_FILES,
      decimals: 6,
    });
    const weth = offerFilesTokenMetadata({
      name: "WETH",
      family: "shielded",
      offerFilesAddress: OFFER_FILES,
      decimals: 6,
    });
    const receipt = decorateLegacyAaDeploymentReceipt({
      legacy: parseLegacyAaDeploymentReceipt(legacy()),
      config: faucetConfig(),
      verifiedMinter: verifiedMinter(),
      tokens: [wbtc, weth],
    });
    expect(receipt.offerFiles).toEqual({ address: OFFER_FILES });
    expect(receipt.tokens.map((entry) => [entry.name, entry.source])).toEqual([
      ["AATEST-S", "aa-minter"],
      ["AATEST-U", "aa-minter"],
      ["WBTC", "offer-files-faucet"],
      ["WETH", "offer-files-faucet"],
    ]);
  });

  it("refuses incomplete, duplicate, extra, and wrong-family faucet deployment metadata", () => {
    const wbtc = offerFilesTokenMetadata({ name: "WBTC", family: "shielded", offerFilesAddress: OFFER_FILES, decimals: 6 });
    const weth = offerFilesTokenMetadata({ name: "WETH", family: "shielded", offerFilesAddress: OFFER_FILES, decimals: 6 });
    const decorate = (tokens: Parameters<typeof decorateLegacyAaDeploymentReceipt>[0]["tokens"]) =>
      decorateLegacyAaDeploymentReceipt({
        legacy: parseLegacyAaDeploymentReceipt(legacy()),
        config: faucetConfig(),
        verifiedMinter: verifiedMinter(),
        tokens,
      });
    expect(() => decorate([wbtc])).toThrow(/exactly one WETH/);
    expect(() => decorate([wbtc, wbtc, weth])).toThrow(/exactly one WBTC/);
    expect(() => decorate([wbtc, weth, offerFilesTokenMetadata({ name: "WUSD", family: "shielded", offerFilesAddress: OFFER_FILES, decimals: 6 })])).toThrow(/exactly WBTC and WETH/);
    expect(() => decorate([wbtc, { ...weth, family: "unshielded" }])).toThrow(/must be shielded/);
  });

  it.each([
    ["network", { network: "other" }, /network does not match/],
    ["commit", { aaCommit: "41de69ded41ff933fe0db8697b264dc46fc6e0cb" }, /AA commit/],
    ["Manager", { manager: { ...legacy().manager, address: "66".repeat(32) } }, /Manager address/],
    ["Minter", { minter: { ...legacy().minter, address: "66".repeat(32) } }, /Minter address/],
    ["tag", { minter: { ...legacy().minter, tag: "TOKB" } }, /Minter tag/],
    ["colour", { mints: { ...legacy().mints, shielded: { ...legacy().mints.shielded, color: "66".repeat(32) } } }, /Minter colour/],
    ["unshielded colour", { mints: { ...legacy().mints, unshielded: { ...legacy().mints.unshielded, color: "66".repeat(32) } } }, /unshielded Minter colour/],
  ] as const)("rejects a %s mismatch", (_name, override, error) => {
    const parsed = parseLegacyAaDeploymentReceipt({ ...legacy(), ...override });
    expect(() => decorateLegacyAaDeploymentReceipt({
      legacy: parsed,
      config: minterConfig(),
      verifiedMinter: verifiedMinter(),
      tokens: [aaMinterTokenMetadata({
        family: "shielded",
        color: SHIELDED,
        internalDeploymentTag: "TOKA",
      })],
    })).toThrow(error);
  });

  it("rejects unknown legacy fields and invalid internal tags", () => {
    expect(() => parseLegacyAaDeploymentReceipt({ ...legacy(), surprise: true })).toThrow(/bounded legacy schema/);
    expect(() => parseLegacyAaDeploymentReceipt({
      ...legacy(),
      minter: { ...legacy().minter, tag: "WBTC" },
    })).toThrow(/market token name/);
  });

  it("accepts null producer transaction ids but refuses use under the current-source profile", () => {
    const parsed = parseLegacyAaDeploymentReceipt({
      ...legacy(),
      mints: { ...legacy().mints, shielded: { ...legacy().mints.shielded, tx: null } },
    });
    const current = { ...minterConfig(), deploymentProfile: "current-0.19" } as const;
    expect(() => decorateLegacyAaDeploymentReceipt({
      legacy: parsed,
      config: current as never,
      verifiedMinter: verifiedMinter(),
      tokens: [aaMinterTokenMetadata({ family: "shielded", color: SHIELDED, internalDeploymentTag: "TOKA" })],
    })).toThrow(/only for the legacy-0.18/);
  });
});

async function artifact(runtimeVersion: string, circuits: readonly string[] = ["execute", "depositShielded", "mintShieldedTo", "mint_shielded"]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aa-artifact-"));
  temporary.push(root);
  await mkdir(join(root, "contract"));
  await mkdir(join(root, "compiler"));
  await mkdir(join(root, "keys"));
  await mkdir(join(root, "zkir"));
  for (const circuit of circuits) {
    await writeFile(join(root, "keys", `${circuit}.prover`), "prover");
    await writeFile(join(root, "keys", `${circuit}.verifier`), "verifier");
    await writeFile(join(root, "zkir", `${circuit}.zkir`), "zkir");
    await writeFile(join(root, "zkir", `${circuit}.bzkir`), "bzkir");
  }
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(root, "contract", "index.js"), [
    "export class Contract {}",
    "export function ledger() { return {}; }",
    "export const pureCircuits = { shieldedKey() { return new Uint8Array(32); } };",
    "",
  ].join("\n"));
  await writeFile(join(root, "compiler", "contract-manifest.json"), JSON.stringify({
    "runtime-version": runtimeVersion,
    "compiler-version": runtimeVersion === "0.19.0" ? "0.34.0" : "0.33.0",
  }));
  return root;
}

describe("artifact/runtime deployment profile preflight", () => {
  it("accepts and imports only an artifact matching the declared runtime", async () => {
    const root = await artifact("0.19.0");
    await expect(preflightManagedArtifact(root, "0.19.0")).resolves.toMatchObject({
      runtimeVersion: "0.19.0",
      compilerVersion: "0.34.0",
    });
    const loaded = await loadManagedContractModule(root, "0.19.0");
    expect(typeof loaded.Contract).toBe("function");
  });

  it("fails before import on a mixed runtime pair", async () => {
    const root = await artifact("0.18.0-rc.1");
    await expect(loadManagedContractModule(root, "0.19.0")).rejects.toThrow(/does not match the declared deployment profile/);
  });

  it("rejects current artifacts under legacy and a mismatched compiler line", async () => {
    const current = await artifact("0.19.0");
    await expect(loadManagedContractModule(current, "0.18.0-rc.1")).rejects.toThrow(/does not match/);

    const wrongCompiler = await artifact("0.19.0");
    await writeFile(join(wrongCompiler, "compiler", "contract-manifest.json"), JSON.stringify({
      "runtime-version": "0.19.0",
      "compiler-version": "0.33.0",
    }));
    await expect(preflightManagedArtifact(wrongCompiler, "0.19.0")).rejects.toThrow(/compiler line/);
  });

  it("preflights the complete selected pair before generated-module import", async () => {
    const manager = await artifact("0.18.0-rc.1");
    const minter = await artifact("0.18.0-rc.1");
    const offerFiles = await artifact("0.18.0-rc.1");
    const config = {
      ...faucetConfig(),
      managerArtifactPath: manager,
      minterArtifactPath: minter,
      offerFilesArtifactPath: offerFiles,
    };
    await expect(preflightFundingArtifacts(config as never)).resolves.toHaveLength(3);
    const mixed = { ...config, offerFilesArtifactPath: await artifact("0.19.0") };
    await expect(preflightFundingArtifacts(mixed as never)).rejects.toThrow(/does not match/);
  });

  it("loads and capability-checks the complete set before any runtime effect", async () => {
    const manager = await artifact("0.18.0-rc.1");
    const minter = await artifact("0.18.0-rc.1");
    const config = { ...minterConfig(), managerArtifactPath: manager, minterArtifactPath: minter };
    await expect(preflightAndLoadFundingArtifacts(config as never)).resolves.toBeUndefined();

    const broken = await artifact("0.18.0-rc.1");
    await writeFile(join(broken, "contract", "index.js"), "export class Contract {}\n");
    await expect(preflightAndLoadFundingArtifacts({ ...config, managerArtifactPath: broken } as never))
      .rejects.toThrow(/missing required ledger capabilities/);
  });

  it("fails closed when a required managed artifact directory is absent", async () => {
    const root = await artifact("0.19.0");
    await rm(join(root, "keys"), { recursive: true });
    await expect(preflightManagedArtifact(root, "0.19.0")).rejects.toThrow(/missing required keys/);
  });

  it("refuses empty key directories and a pruned Manager execute prover before effects", async () => {
    const empty = await artifact("0.18.0-rc.1", []);
    await expect(preflightManagedArtifact(empty, "0.18.0-rc.1")).rejects.toThrow(/keys directory is empty/);

    const manager = await artifact("0.18.0-rc.1");
    const minter = await artifact("0.18.0-rc.1");
    await rm(join(manager, "keys", "execute.prover"));
    const config = { ...minterConfig(), managerArtifactPath: manager, minterArtifactPath: minter };
    await expect(preflightFundingArtifacts(config as never)).rejects.toThrow(/execute.prover/);
  });

  it("refuses any missing manifest-declared artifact before module import", async () => {
    const root = await artifact("0.18.0-rc.1");
    await writeFile(join(root, "compiler", "contract-manifest.json"), JSON.stringify({
      "runtime-version": "0.18.0-rc.1",
      "compiler-version": "0.33.0",
      keys: {
        type: "directory",
        "not-present.prover": { type: "file", size: 1, hash: "00".repeat(32) },
      },
    }));
    await expect(preflightManagedArtifact(root, "0.18.0-rc.1"))
      .rejects.toThrow(/manifest-declared keys\/not-present\.prover/);
  });
});

describe("concrete legacy runtime facade coordinator", () => {
  it("releases successfully and permits a fresh same-seed facade", async () => {
    let opens = 0;
    let stops = 0;
    const seed = "c1".repeat(32);
    const coordinator = new RuntimeFacadeCoordinator(seed, async () => {
      opens += 1;
      return { wallet: { stop: async () => { stops += 1; } } };
    });
    const config = minterConfig();
    const first = await coordinator.acquire(config, seed);
    await expect(coordinator.acquire(config, seed)).rejects.toThrow(/already active/);
    await first.release();
    const second = await coordinator.acquire(config, seed);
    await second.release();
    expect({ opens, stops }).toEqual({ opens: 2, stops: 2 });
  });

  it("poisons the process-wide seed after stop uncertainty and never reopens", async () => {
    const seed = "c2".repeat(32);
    let opens = 0;
    const first = new RuntimeFacadeCoordinator(seed, async () => {
      opens += 1;
      return { wallet: { stop: async () => { throw new Error(); } } };
    });
    const config = minterConfig();
    const lease = await first.acquire(config, seed);
    await expect(lease.release()).rejects.toThrow(/stop failed/);
    const replacement = new RuntimeFacadeCoordinator(seed, async () => {
      opens += 1;
      return { wallet: { stop: async () => undefined } };
    });
    await expect(replacement.acquire(config, seed)).rejects.toThrow(/poisoned/);
    expect(opens).toBe(1);
  });

  it("refuses an acquire seed that differs from the coordinator seed before opening", async () => {
    let opens = 0;
    const coordinator = new RuntimeFacadeCoordinator("c3".repeat(32), async () => {
      opens += 1;
      return { wallet: { stop: async () => undefined } };
    });
    await expect(coordinator.acquire(minterConfig(), "c4".repeat(32))).rejects.toThrow(/seed mismatch/);
    expect(opens).toBe(0);
  });

  it("calls the stock Offer Files ABI with exactly three positional args and parses public/private output", async () => {
    const domain = Uint8Array.from({ length: 32 }, (_, index) => index);
    const calls: unknown[][] = [];
    const result = await callLegacyOfferFilesMint({
      callTx: {
        async mint_shielded(...args: unknown[]) {
          calls.push(args);
          return {
            public: { txId: " offer-mint " },
            private: { result: { color: Uint8Array.from({ length: 32 }, () => 0x55), value: 7n } },
          };
        },
      },
    }, [domain, 7n, 9n]);
    expect(calls).toEqual([[domain, 7n, 9n]]);
    expect(result).toEqual({ txId: "offer-mint", color: "55".repeat(32), value: 7n });
  });

  it("polls delayed exact state, times out on stale state, and verifies account+owner membership", async () => {
    const readings = [0n, 1n, 2n];
    await expect(waitForExactBigint("test balance", async () => readings.shift()!, 2n, 100, 0)).resolves.toBe(2n);
    await expect(waitForExactBigint("test balance", async () => 1n, 2n, 0, 0)).rejects.toThrow(/exact test balance/);
    const id = Uint8Array.from({ length: 32 }, () => 0x11);
    const owner = "22".repeat(32);
    const ledger = {
      accounts: { member: () => true },
      evmOwners: { member: () => true, lookup: () => owner },
    };
    expect(managerAccountMatches(ledger, id, owner)).toBe(true);
    expect(managerAccountMatches({ ...ledger, accounts: { member: () => false } }, id, owner)).toBe(false);
    expect(managerAccountMatches({ ...ledger, evmOwners: { member: () => true, lookup: () => "33".repeat(32) } }, id, owner)).toBe(false);
  });

  it("executes withdraw build-prove-bind-balance-finalize-submit in order with the encryption mapping", async () => {
    const order: string[] = [];
    let options: Record<string, unknown> | undefined;
    const coinPublicKey = { key: "coin" };
    const encryptionPublicKey = { key: "encryption" };
    const result = await submitShieldedWithdrawPipeline({
      createUnprovenCallTx: (async (_providers: unknown, value: Record<string, unknown>) => {
        order.push("build");
        options = value;
        return { private: { unprovenTx: "unproven" } };
      }) as never,
      providers: {
        proofProvider: {
          proveTx: async (value: unknown) => {
            expect(value).toBe("unproven");
            order.push("prove");
            return { bind: () => { order.push("bind"); return "bound"; } };
          },
        },
      },
      compiled: { compiled: true },
      contractAddress: MANAGER,
      args: [{ payload: true }, { signature: true }, { point: true }],
      privateStateId: "aaManagerPrivateState",
      coinPublicKey,
      encryptionPublicKey,
      walletResult: {
        zswapSecretKeys: { secret: "shielded" },
        dustSecretKey: { secret: "dust" },
        wallet: {
          balanceFinalizedTransaction: async (value: unknown) => {
            expect(value).toBe("bound");
            order.push("balance");
            return "recipe";
          },
          finalizeRecipe: async (value: unknown) => {
            expect(value).toBe("recipe");
            order.push("finalize");
            return "final";
          },
          submitTransaction: async (value: unknown) => {
            expect(value).toBe("final");
            order.push("submit");
            return "withdraw-tx";
          },
        },
      },
    });
    expect(result).toBe("withdraw-tx");
    expect(order).toEqual(["build", "prove", "bind", "balance", "finalize", "submit"]);
    expect(options?.circuitId).toBe("execute");
    expect(options?.args).toHaveLength(3);
    expect(options?.additionalCoinEncPublicKeyMappings).toEqual(new Map([[coinPublicKey, encryptionPublicKey]]));
  });

  it("requires strict subtree synchronization, NIGHT, and positive spendable DUST", () => {
    const ready = {
      isSynced: true,
      shielded: { state: { progress: { isStrictlyComplete: () => true } } },
      unshielded: {
        progress: { isStrictlyComplete: () => true },
        balances: { night: 10n },
        availableCoins: [{ meta: { registeredForDustGeneration: true } }],
      },
      dust: { balance: (_now: Date) => 1n, availableCoins: [{}] },
    };
    expect(() => assertWalletReadiness(ready)).not.toThrow();
    expect(() => assertWalletReadiness({ ...ready, isSynced: false })).toThrow(/not fully synchronized/);
    expect(() => assertWalletReadiness({
      ...ready,
      shielded: { state: { progress: { isStrictlyComplete: () => false } } },
    })).toThrow(/not fully synchronized/);
    expect(() => assertWalletReadiness({
      ...ready,
      unshielded: { ...ready.unshielded, progress: { isStrictlyComplete: () => false } },
    })).toThrow(/not fully synchronized/);
    expect(() => assertWalletReadiness({ ...ready, unshielded: { ...ready.unshielded, balances: {} } })).toThrow(/no unshielded NIGHT/);
    expect(() => assertWalletReadiness({ ...ready, unshielded: { ...ready.unshielded, availableCoins: [] } })).toThrow(/not registered/);
    expect(() => assertWalletReadiness({ ...ready, dust: { balance: (_now: Date) => 0n, availableCoins: [{}] } })).toThrow(/no spendable/);
    expect(() => assertWalletReadiness({ ...ready, dust: {} })).toThrow(/no spendable/);
    expect(() => assertWalletReadiness({ ...ready, dust: { balance: (_now: Date) => 2n, availableCoins: [] } })).toThrow(/no spendable DUST UTXO/);
    expect(() => assertWalletReadiness({ ...ready, dust: { walletBalance: (_now: Date) => 2n, availableCoins: [{}] } })).not.toThrow();
  });
});

describe("manual runner receipt boundary", () => {
  it("emits only a fixed runner error when an external failure contains credentials or private material", async () => {
    const secretText = "PASSWORD=non-seed-password API_KEY=non-seed-key PRIVATE_MATERIAL=opaque";
    const stderr: string[] = [];
    const code = await runManualEntrypoint(
      async () => { throw new Error(secretText); },
      (message) => stderr.push(message),
    );
    expect(code).toBe(1);
    expect(stderr).toEqual(["AA faucet harness failed"]);
    expect(stderr.join("\n")).not.toContain("non-seed-password");
    expect(stderr.join("\n")).not.toContain("non-seed-key");
    expect(stderr.join("\n")).not.toContain("opaque");
  });

  it("preflights distinct existing parents and atomically writes a secret-free receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "aa-receipts-"));
    temporary.push(root);
    const input = join(root, "legacy.json");
    const deployment = join(root, "deployment-v1.json");
    const run = join(root, "run.json");
    await writeFile(input, "{}\n");
    const config = parseFundingEnvironment({
      ...commonEnv(),
      AA_MINTER_ADDRESS: MINTER,
      AA_MINTER_TAG: "TOKA",
      AA_MINTER_SHIELDED_COLOR: SHIELDED,
      AA_MINTER_UNSHIELDED_COLOR: UNSHIELDED,
      AA_DEPLOYMENT_RECEIPT_PATH: input,
      AA_DECORATED_DEPLOYMENT_RECEIPT_PATH: deployment,
      AA_RUN_RECEIPT_PATH: run,
    });
    await expect(preflightReceiptDestinations(config)).resolves.toBeUndefined();
    await writeJsonAtomic(run, { status: "passed" }, config.harnessWalletSeed);
    expect(JSON.parse(await readFile(run, "utf8"))).toEqual({ status: "passed" });
    expect((await readdir(root)).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("refuses colliding, missing-parent, and secret-bearing receipt destinations before effects", async () => {
    const root = await mkdtemp(join(tmpdir(), "aa-receipts-negative-"));
    temporary.push(root);
    const input = join(root, "legacy.json");
    await writeFile(input, "{}\n");
    const configFor = (deployment: string, run: string) => parseFundingEnvironment({
      ...commonEnv(),
      AA_MINTER_ADDRESS: MINTER,
      AA_MINTER_TAG: "TOKA",
      AA_MINTER_SHIELDED_COLOR: SHIELDED,
      AA_MINTER_UNSHIELDED_COLOR: UNSHIELDED,
      AA_DEPLOYMENT_RECEIPT_PATH: input,
      AA_DECORATED_DEPLOYMENT_RECEIPT_PATH: deployment,
      AA_RUN_RECEIPT_PATH: run,
    });
    await expect(preflightReceiptDestinations(configFor(input, join(root, "run.json"))))
      .rejects.toThrow(/must be distinct/);
    await expect(preflightReceiptDestinations(configFor(join(root, "same.json"), join(root, "same.json"))))
      .rejects.toThrow(/must be distinct/);
    await expect(preflightReceiptDestinations(configFor(join(root, "missing", "one.json"), join(root, "two.json"))))
      .rejects.toThrow();
    await expect(preflightReceiptDestinations(configFor(join(root, `${SEED}.json`), join(root, "run.json"))))
      .rejects.toThrow(/secret material/);
    const directoryTarget = join(root, "directory-target");
    await mkdir(directoryTarget);
    await expect(preflightReceiptDestinations(configFor(directoryTarget, join(root, "run.json"))))
      .rejects.toThrow(/regular file/);
    const hardLink = join(root, "legacy-hard-link.json");
    await link(input, hardLink);
    await expect(preflightReceiptDestinations(configFor(hardLink, join(root, "run.json"))))
      .rejects.toThrow(/must be distinct/);
  });
});
