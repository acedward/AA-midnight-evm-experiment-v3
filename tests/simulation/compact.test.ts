import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, type Hex32 } from "../lib/bytes.js";
import { computeDigest, deriveAccountId } from "../lib/codec.js";
import { pureCircuits } from "../lib/compact/generated/contract/index.js";
import {
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  KAT_OWNER,
  KAT_SIGNATURE,
  generateFixture,
  semanticInputForAction,
} from "../fixtures/generate.js";
import { buildSemanticCommitment } from "../lib/semantic.js";
import { parseSignature, recoverSigner } from "../lib/signature.js";
import { TYPE_DEFINITIONS, type Eip712Action } from "../lib/schema.js";

function compactStructHash(action: Eip712Action): Uint8Array {
  const manager = hexToBytes(action.manager, 32);
  const account = hexToBytes(action.accountId, 32);
  const owner = hexToBytes(action.owner, 20);
  if (action.primaryType === "RegisterEvmAccount") {
    return pureCircuits.registerStructHash(
      manager,
      account,
      owner,
      hexToBytes(action.accountSalt, 32),
      action.validUntil,
    );
  }
  if (action.primaryType === "WithdrawShielded") {
    return pureCircuits.withdrawShieldedStructHash(
      manager,
      account,
      owner,
      action.nonce,
      action.validUntil,
      hexToBytes(action.color, 32),
      action.amount,
      action.recipientKind,
      hexToBytes(action.recipient, 32),
    );
  }
  if (action.primaryType === "WithdrawUnshielded") {
    return pureCircuits.withdrawUnshieldedStructHash(
      manager,
      account,
      owner,
      action.nonce,
      action.validUntil,
      hexToBytes(action.color, 32),
      action.amount,
      action.recipientKind,
      hexToBytes(action.recipient, 32),
    );
  }
  if (action.primaryType === "TransferInternalShielded") {
    return pureCircuits.transferShieldedStructHash(
      manager,
      account,
      owner,
      action.nonce,
      action.validUntil,
      hexToBytes(action.toAccountId, 32),
      hexToBytes(action.color, 32),
      action.amount,
    );
  }
  if (action.primaryType === "TransferInternalUnshielded") {
    return pureCircuits.transferUnshieldedStructHash(
      manager,
      account,
      owner,
      action.nonce,
      action.validUntil,
      hexToBytes(action.toAccountId, 32),
      hexToBytes(action.color, 32),
      action.amount,
    );
  }
  return pureCircuits.openSwapStructHash(
    manager,
    account,
    owner,
    action.nonce,
    action.validUntil,
    hexToBytes(action.giveColor, 32),
    action.giveAmount,
    action.recipientKind,
    hexToBytes(action.recipient, 32),
    hexToBytes(action.wantNonce, 32),
    hexToBytes(action.wantColor, 32),
    action.wantAmount,
    hexToBytes(action.creditAccountId, 32),
  );
}

describe("Compact pure/simulator auth oracle", () => {
  it("freezes all six type hashes and emits no verifier keys", () => {
    for (const definition of Object.values(TYPE_DEFINITIONS)) {
      expect(bytesToHex(pureCircuits.frozenTypeHash(BigInt(definition.selector)))).toBe(
        definition.typeHash,
      );
    }
    expect(Object.keys(pureCircuits).length).toBeGreaterThan(10);
  });

  it("matches alias/account/domain/struct/digest for every retained fixture", () => {
    const fixture = generateFixture();
    const cases = [
      fixture.kat,
      ...(fixture.boundaryCases as Record<string, unknown>[]),
      ...(fixture.randomCases as Record<string, unknown>[]),
    ] as Record<string, unknown>[];
    for (const item of cases) {
      const action = item.action as Eip712Action;
      const deployment = item.deploymentDomain as Hex32;
      const manual = computeDigest(action, deployment);
      const alias = pureCircuits.managerAlias(hexToBytes(action.manager, 32));
      const domain = pureCircuits.domainSeparator(alias, hexToBytes(deployment, 32));
      const structHash = compactStructHash(action);
      const digest = pureCircuits.eip712Digest(domain, structHash);
      expect(bytesToHex(alias), `${String(item.id)} alias`).toBe(manual.managerAlias);
      expect(bytesToHex(domain), `${String(item.id)} domain`).toBe(manual.domainSeparator);
      expect(bytesToHex(structHash), `${String(item.id)} struct`).toBe(manual.structHash);
      expect(bytesToHex(digest), `${String(item.id)} digest`).toBe(manual.digest);
      if (action.primaryType === "RegisterEvmAccount") {
        expect(bytesToHex(pureCircuits.accountId(
          hexToBytes(action.manager, 32),
          hexToBytes(action.owner, 20),
          hexToBytes(action.accountSalt, 32),
        ))).toBe(deriveAccountId(action.manager, action.owner, action.accountSalt));
      }
    }
  });

  it("matches the 1024-byte semantic commitment", () => {
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const semantic = buildSemanticCommitment(
      semanticInputForAction(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, digest),
    );
    expect(bytesToHex(pureCircuits.semanticCommitment(semantic.preimage))).toBe(
      semantic.commitment,
    );
  });

  it("verifies recovered scalars/point, exports big-endian x/y, and derives the owner", () => {
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const recovered = recoverSigner(digest, KAT_SIGNATURE);
    const signature = parseSignature(KAT_SIGNATURE);
    const point = {
      x: recovered.point.x,
      y: recovered.point.y,
      identity: false,
    };
    expect(pureCircuits.verifySignature(
      hexToBytes(digest, 32),
      { r: signature.r, s: signature.s },
      point,
    )).toBe(true);
    expect(bytesToHex(pureCircuits.pointXBigEndian(point))).toBe(bytesToHex(recovered.point.xBytes));
    expect(bytesToHex(pureCircuits.pointYBigEndian(point))).toBe(bytesToHex(recovered.point.yBytes));
    expect(bytesToHex(pureCircuits.signerAddress(point))).toBe(KAT_OWNER);
  });

  it("refuses zero scalar, altered scalar, identity, and malformed/off-curve point probes", () => {
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const recovered = recoverSigner(digest, KAT_SIGNATURE);
    const signature = parseSignature(KAT_SIGNATURE);
    const point = { x: recovered.point.x, y: recovered.point.y, identity: false };
    expect(pureCircuits.verifySignature(hexToBytes(digest, 32), { r: 0n, s: signature.s }, point)).toBe(false);
    expect(pureCircuits.verifySignature(
      hexToBytes(digest, 32),
      { r: signature.r, s: signature.s ^ 1n },
      point,
    )).toBe(false);
    expect(pureCircuits.verifySignature(
      hexToBytes(digest, 32),
      { r: signature.r, s: signature.s },
      { x: 0n, y: 0n, identity: true },
    )).toBe(false);
    let offCurveRejected = false;
    try {
      offCurveRejected = pureCircuits.verifySignature(
        hexToBytes(digest, 32),
        { r: signature.r, s: signature.s },
        { x: 1n, y: 1n, identity: false },
      ) === false;
    } catch {
      offCurveRejected = true;
    }
    expect(offCurveRejected).toBe(true);
  });
});
