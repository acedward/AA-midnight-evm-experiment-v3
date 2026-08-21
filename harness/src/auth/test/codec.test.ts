import { describe, expect, it } from "vitest";

import {
  buildTypedDataV4,
  buildEthSignTypedDataV4Request,
  computeDigest,
  deriveAccountId,
  recomputeFrozenHashes,
} from "../codec.js";
import { metamaskHashes } from "../metamask.js";
import {
  KAT_ACCOUNT_ID,
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  fixtureJson,
  generateFixture,
} from "../fixtures/generate.js";
import { FROZEN_HASHES, TYPE_DEFINITIONS, type Eip712Action } from "../schema.js";

describe("AUTH-EIP712-AA-V3-V1 pure TypeScript codec", () => {
  it("recomputes the account/domain and all six frozen type hashes", () => {
    const hashes = recomputeFrozenHashes();
    expect(hashes.accountIdTag).toBe(FROZEN_HASHES.accountIdTag);
    expect(hashes.domainType).toBe(FROZEN_HASHES.domainType);
    expect(hashes.domainName).toBe(FROZEN_HASHES.domainName);
    expect(hashes.domainVersion).toBe(FROZEN_HASHES.domainVersion);
    for (const [name, definition] of Object.entries(TYPE_DEFINITIONS)) {
      expect(hashes[`type:${name}`]).toBe(definition.typeHash);
    }
  });

  it("matches every normative registration KAT byte", () => {
    expect(
      deriveAccountId(KAT_ACTION.manager, KAT_ACTION.owner, KAT_ACTION.accountSalt),
    ).toBe(KAT_ACCOUNT_ID);
    expect(computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN)).toEqual({
      managerAlias: "0x8fb9007a8537c8dfdb6a3f8c2cfd64db19d2ec90",
      domainSeparator: "0x7bcfafe962b11fdadc57f26725157d9ba5a7367544b6f69a4822d9af482b4c0c",
      structHash: "0xc030a38121e5c111ac3920b8a6ddda9170e3b88f96c77cbbe5b5986331e18fa5",
      digest: "0x50eafb056abc5461f1a87968dbf5cdfe7cfeab465c02548dde208c681ba152ce",
    });
  });

  it("has zero disagreements with independent MetaMask V4 across boundary/random fixtures", () => {
    const fixture = generateFixture();
    const cases = [
      fixture.kat,
      ...(fixture.boundaryCases as Record<string, unknown>[]),
      ...(fixture.randomCases as Record<string, unknown>[]),
    ] as Record<string, unknown>[];
    expect(cases).toHaveLength(1 + 11 + 48);
    for (const item of cases) {
      const action = item.action as Eip712Action;
      const deploymentDomain = item.deploymentDomain as `0x${string}`;
      const manual = computeDigest(action, deploymentDomain);
      const independent = metamaskHashes(action, deploymentDomain);
      expect(manual, String(item.id)).toEqual(independent);
      expect(item.manual, String(item.id)).toEqual(manual);
      expect(item.metamask, String(item.id)).toEqual(independent);
      expect(item.recoveredOwner, String(item.id)).toBe(action.owner);
      expect(item.metamaskRecoveredOwner, String(item.id)).toBe(action.owner);
    }
  });

  it("emits eth_signTypedData_v4 JSON with only decimal-string wide integers", () => {
    const fixture = generateFixture();
    const cases = [
      fixture.kat,
      ...(fixture.boundaryCases as Record<string, unknown>[]),
      ...(fixture.randomCases as Record<string, unknown>[]),
    ] as Record<string, unknown>[];
    for (const item of cases) {
      const action = item.action as Eip712Action;
      const typed = buildTypedDataV4(action, item.deploymentDomain as `0x${string}`);
      const definition = TYPE_DEFINITIONS[action.primaryType];
      for (const field of definition.fields.filter((candidate) => candidate.type.startsWith("uint"))) {
        expect(typeof typed.message[field.name], `${String(item.id)}.${field.name}`).toBe("string");
        expect(typed.message[field.name], `${String(item.id)}.${field.name}`).toMatch(/^\d+$/);
      }
      expect(JSON.parse(JSON.stringify(typed))).toEqual(typed);
      const request = buildEthSignTypedDataV4Request(action, item.deploymentDomain as `0x${string}`);
      expect(request.method).toBe("eth_signTypedData_v4");
      expect(request.params[0]).toBe(action.owner);
      expect(JSON.parse(request.params[1])).toEqual(typed);
    }
  });

  it("covers zero/max widths and every recipient union shape", () => {
    const boundaries = generateFixture().boundaryCases as Record<string, unknown>[];
    const ids = boundaries.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      "register-zero",
      "register-max64",
      "withdraw-shielded-kind-0",
      "withdraw-shielded-kind-1",
      "withdraw-unshielded-kind-0",
      "withdraw-unshielded-kind-1",
      "transfer-shielded-zero",
      "transfer-unshielded-max",
      "open-swap-kind-0",
      "open-swap-kind-1",
      "open-swap-kind-2",
    ]));
    const json = fixtureJson(boundaries);
    expect(json).toContain('"18446744073709551615"');
    expect(json).toContain('"340282366920938463463374607431768211455"');
  });

  it("rejects negative and overflowing uint64/uint128 values", () => {
    expect(() => computeDigest({ ...KAT_ACTION, validUntil: -1n }, KAT_DEPLOYMENT_DOMAIN)).toThrow(
      /uint64/,
    );
    expect(() =>
      computeDigest({ ...KAT_ACTION, validUntil: 1n << 64n }, KAT_DEPLOYMENT_DOMAIN),
    ).toThrow(/uint64/);
    const transfer: Eip712Action = {
      primaryType: "TransferInternalShielded",
      manager: KAT_ACTION.manager,
      accountId: KAT_ACTION.accountId,
      owner: KAT_ACTION.owner,
      nonce: 0n,
      validUntil: 0n,
      toAccountId: KAT_ACTION.accountId,
      color: KAT_ACTION.accountSalt,
      amount: 1n << 128n,
    };
    expect(() => computeDigest(transfer, KAT_DEPLOYMENT_DOMAIN)).toThrow(/uint128/);
  });

  it("changes the digest for every retained field/domain/type tamper", () => {
    const tampers = generateFixture().tamperCases as Record<string, string>[];
    expect(tampers.length).toBeGreaterThan(40);
    for (const tamper of tampers) {
      expect(tamper.tamperedDigest, tamper.id).not.toBe(tamper.baseDigest);
      if (tamper.metamaskTamperedDigest) {
        expect(tamper.metamaskTamperedDigest, tamper.id).toBe(tamper.tamperedDigest);
      }
    }
  });
});
