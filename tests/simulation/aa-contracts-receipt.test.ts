import { describe, expect, it } from "vitest";

import {
  AA_CONTRACTS_RECEIPT_VERSION,
  AA_RUN_RECEIPT_VERSION,
  buildAaContractsReceipt,
  buildAaRunReceipt,
  validateAaContractsReceipt,
  validateAaRunReceipt,
  type AaContractsReceipt,
  type AaRunReceipt,
} from "../lib/aa-contracts-receipt.js";
import {
  aaMinterTokenMetadata,
  offerFilesTokenColor,
  offerFilesTokenMetadata,
} from "../lib/token-metadata.js";

const MANAGER = "aa".repeat(32);
const MINTER = "bb".repeat(32);
const OFFER_FILES = "cc".repeat(32);
const ACCOUNT = "dd".repeat(32);
const SHIELDED = "12".repeat(32);
const UNSHIELDED = "34".repeat(32);
const OFFER_FILES_WBTC = offerFilesTokenColor("WBTC", OFFER_FILES);

function deploymentReceipt(): AaContractsReceipt {
  return {
    schemaVersion: AA_CONTRACTS_RECEIPT_VERSION,
    network: "undeployed",
    aaCommit: "41de69ded41ff933fe0db8697b264dc46fc6e0cb",
    manager: { address: MANAGER, domain: "aa-test-domain" },
    minter: { address: MINTER, tag: "TOKA" },
    offerFiles: { address: OFFER_FILES },
    tokens: [
      aaMinterTokenMetadata({ family: "shielded", color: SHIELDED, internalDeploymentTag: "TOKA" }),
      aaMinterTokenMetadata({ family: "unshielded", color: UNSHIELDED, internalDeploymentTag: "TOKA" }),
      offerFilesTokenMetadata({
        name: "WBTC",
        family: "shielded",
        offerFilesAddress: OFFER_FILES,
        decimals: 6,
      }),
    ],
    createdAt: "2026-09-04T20:00:00.000Z",
  };
}

function runReceipt(): AaRunReceipt {
  return {
    schemaVersion: AA_RUN_RECEIPT_VERSION,
    network: "undeployed",
    mode: "aa-minter",
    managerAddress: MANAGER,
    tokens: [aaMinterTokenMetadata({
      family: "shielded",
      color: SHIELDED,
      internalDeploymentTag: "TOKA",
    })],
    balanceDeltas: [{ accountId: ACCOUNT, color: SHIELDED, before: "0", after: "1000000" }],
    transactions: [
      { operation: "mint", txId: "mint-tx" },
      { operation: "deposit", txId: "deposit-tx" },
      { operation: "execute", txId: "execute-tx" },
      { operation: "withdraw", txId: "withdraw-tx" },
    ],
    startedAt: "2026-09-04T20:00:00.000Z",
    finishedAt: "2026-09-04T20:01:00.000Z",
  };
}

describe("versioned aa-contracts receipt", () => {
  it("serializes name and source for every token and preserves raw address, colour and tag fields", () => {
    const receipt = buildAaContractsReceipt(deploymentReceipt());
    const json = JSON.parse(JSON.stringify(receipt));

    expect(json.schemaVersion).toBe("aa-contracts/v1");
    expect(json.manager.address).toBe(MANAGER);
    expect(json.minter).toEqual({ address: MINTER, tag: "TOKA" });
    expect(json.offerFiles.address).toBe(OFFER_FILES);
    expect(json.tokens.map((token: any) => [token.name, token.source, token.color])).toEqual([
      ["AATEST-S", "aa-minter", SHIELDED],
      ["AATEST-U", "aa-minter", UNSHIELDED],
      ["WBTC", "offer-files-faucet", OFFER_FILES_WBTC],
    ]);
    expect(validateAaContractsReceipt(json)).toEqual(receipt);
  });

  it("refuses market metadata attached to an AA Minter", () => {
    // Negative control: the Offer Files faucet name must never be accepted for AA-Minter metadata.
    const forged: any = deploymentReceipt();
    forged.tokens = [{
      name: "WBTC",
      source: "aa-minter",
      family: "shielded",
      color: SHIELDED,
      internalDeploymentTag: "TOKA",
    }];
    expect(() => validateAaContractsReceipt(forged)).toThrow(/cannot use market token name/);
  });

  it("refuses missing provenance and a token tag that differs from minter.tag", () => {
    const missingSource: any = deploymentReceipt();
    missingSource.tokens = [{ name: "AATEST-S", family: "shielded", color: SHIELDED }];
    expect(() => validateAaContractsReceipt(missingSource)).toThrow(/source/);

    const wrongTag: any = deploymentReceipt();
    wrongTag.tokens = [aaMinterTokenMetadata({
      family: "shielded",
      color: SHIELDED,
      internalDeploymentTag: "TOKB",
    })];
    expect(() => validateAaContractsReceipt(wrongTag)).toThrow(/does not match minter.tag/);
  });

  it("refuses an Offer Files market name used as an internal Minter tag", () => {
    const forged: any = deploymentReceipt();
    forged.minter.tag = " wBtC ";
    expect(() => validateAaContractsReceipt(forged)).toThrow(/canonical uppercase/);
  });

  it("refuses duplicate colours and absent source-contract entries", () => {
    const duplicate: any = deploymentReceipt();
    duplicate.tokens = [
      aaMinterTokenMetadata({ family: "shielded", color: SHIELDED, internalDeploymentTag: "TOKA" }),
      aaMinterTokenMetadata({ family: "unshielded", color: SHIELDED, internalDeploymentTag: "TOKA" }),
    ];
    expect(() => validateAaContractsReceipt(duplicate)).toThrow(/duplicate receipt token color/);

    const noOfferFiles: any = deploymentReceipt();
    delete noOfferFiles.offerFiles;
    noOfferFiles.tokens = [offerFilesTokenMetadata({
      name: "WETH",
      family: "shielded",
      offerFilesAddress: OFFER_FILES,
      decimals: 6,
    })];
    expect(() => validateAaContractsReceipt(noOfferFiles)).toThrow(/requires an offerFiles/);
  });

  it("refuses a faucet colour forged for a different name or Offer Files deployment", () => {
    const forged: any = deploymentReceipt();
    forged.tokens = [{
      name: "WBTC",
      source: "offer-files-faucet",
      family: "shielded",
      color: offerFilesTokenColor("WETH", OFFER_FILES),
      decimals: 6,
    }];
    expect(() => validateAaContractsReceipt(forged)).toThrow(/does not match its name and deployment address/);
  });
});

describe("sanitized live-run receipt", () => {
  it("round-trips exact token provenance and Manager balance deltas", () => {
    const receipt = buildAaRunReceipt(runReceipt());
    expect(validateAaRunReceipt(JSON.parse(JSON.stringify(receipt)))).toEqual(receipt);
    expect(receipt.tokens[0]).toMatchObject({ name: "AATEST-S", source: "aa-minter" });
    expect(receipt.balanceDeltas[0]).toEqual({
      accountId: ACCOUNT,
      color: SHIELDED,
      before: "0",
      after: "1000000",
    });
  });

  it("refuses a token source that differs from the selected funding mode", () => {
    const forged: any = runReceipt();
    forged.mode = "offer-files-faucet";
    expect(() => validateAaRunReceipt(forged)).toThrow(/source must match/);
  });

  it("refuses unknown colours, noncanonical amounts and reverse timestamps", () => {
    const unknown: any = runReceipt();
    unknown.balanceDeltas[0].color = "99".repeat(32);
    expect(() => validateAaRunReceipt(unknown)).toThrow(/unknown token color/);

    const amount: any = runReceipt();
    amount.balanceDeltas[0].after = "01";
    expect(() => validateAaRunReceipt(amount)).toThrow(/canonical unsigned integer/);

    const time: any = runReceipt();
    time.finishedAt = "2026-09-04T19:59:59.000Z";
    expect(() => validateAaRunReceipt(time)).toThrow(/cannot precede/);
  });

  it("refuses secret-bearing or unknown fields instead of serializing them", () => {
    const secret: any = runReceipt();
    secret.walletSeed = "not-allowed";
    expect(() => validateAaRunReceipt(secret)).toThrow(/secret-bearing/);

    const password: any = runReceipt();
    password.providerPassword = "not-allowed";
    expect(() => validateAaRunReceipt(password)).toThrow(/secret-bearing/);

    const unknown: any = runReceipt();
    unknown.note = "unversioned extension";
    expect(() => validateAaRunReceipt(unknown)).toThrow(/unknown field/);
  });

  it("trims canonical transaction ids and refuses blank or duplicate ids", () => {
    const trimmed: any = runReceipt();
    trimmed.transactions[0].txId = "  mint-tx  ";
    expect(validateAaRunReceipt(trimmed).transactions[0]?.txId).toBe("mint-tx");

    const blank: any = runReceipt();
    blank.transactions[0].txId = " \t ";
    expect(() => validateAaRunReceipt(blank)).toThrow(/must be nonblank/);

    const duplicate: any = runReceipt();
    duplicate.transactions[1].txId = "mint-tx";
    expect(() => validateAaRunReceipt(duplicate)).toThrow(/must be distinct/);
  });
});
