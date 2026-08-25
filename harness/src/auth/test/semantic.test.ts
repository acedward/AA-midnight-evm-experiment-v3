import { describe, expect, it } from "vitest";

import { ZERO_32, type Hex32 } from "../bytes.js";
import { computeDigest } from "../codec.js";
import {
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  generateFixture,
  semanticInputForAction,
} from "../fixtures/generate.js";
import {
  SEMANTIC_PREIMAGE_BYTES,
  buildSemanticCommitment,
  nativeAuthResult,
  type SemanticCommitmentInput,
} from "../semantic.js";
import type { Eip712Action } from "../schema.js";

describe("AA_V3_SEMANTIC_COMMITMENT_V1", () => {
  it("is an exact 32-word/1024-byte preimage and is stable under object key order", () => {
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const input = semanticInputForAction(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, digest);
    const reordered: SemanticCommitmentInput = {
      nonDustImbalances: input.nonDustImbalances,
      action: {
        accountSalt: input.action.accountSalt,
        validUntil: input.action.validUntil,
        owner: input.action.owner,
      },
      nonce: input.nonce,
      authResult: input.authResult,
      authMode: input.authMode,
      accountId: input.accountId,
      selector: input.selector,
      deploymentDomain: input.deploymentDomain,
      manager: input.manager,
    };
    const first = buildSemanticCommitment(input);
    const second = buildSemanticCommitment(reordered);
    expect(first.preimage).toHaveLength(SEMANTIC_PREIMAGE_BYTES);
    expect(second.preimage).toEqual(first.preimage);
    expect(second.commitment).toBe(first.commitment);
  });

  it("covers every selector and all recipient shapes with deterministic commitments", () => {
    const fixture = generateFixture();
    const cases = [
      fixture.kat,
      ...(fixture.boundaryCases as Record<string, unknown>[]),
      ...(fixture.randomCases as Record<string, unknown>[]),
    ] as Record<string, unknown>[];
    const selectors = new Set<number>();
    for (const item of cases) {
      const action = item.action as Eip712Action;
      const deployment = item.deploymentDomain as Hex32;
      const digest = computeDigest(action, deployment).digest;
      const semantic = buildSemanticCommitment(semanticInputForAction(action, deployment, digest));
      selectors.add(semanticInputForAction(action, deployment, digest).selector);
      expect(semantic.commitment, String(item.id)).toBe(
        (item.semantic as Record<string, string>).commitment,
      );
      expect(semantic.callTranscriptHash, String(item.id)).toBe(
        (item.semantic as Record<string, string>).callTranscriptHash,
      );
    }
    expect([...selectors].sort()).toEqual([1, 2, 3, 4, 5, 6]);

    const nativeAccount = `0x${"77".repeat(32)}` as Hex32;
    const native = buildSemanticCommitment({
      manager: KAT_ACTION.manager,
      deploymentDomain: KAT_DEPLOYMENT_DOMAIN,
      selector: 0,
      accountId: nativeAccount,
      authMode: "native",
      authResult: nativeAuthResult(nativeAccount),
      nonce: 0n,
      action: {},
      nonDustImbalances: [],
    });
    expect(native.preimage).toHaveLength(1024);
    const retainedNative = fixture.nativeSelectorFixture as Record<string, string>;
    expect(native.commitment).toBe(retainedNative.commitment);
    expect(native.callTranscriptHash).toBe(retainedNative.callTranscriptHash);
  });

  it("rejects missing/noncanonical inactive fields and invalid recipient unions", () => {
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const base = semanticInputForAction(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, digest);
    expect(() => buildSemanticCommitment({ ...base, action: { ...base.action, recipient: ZERO_32 } })).toThrow(
      /inactive/,
    );
    const { accountSalt: _removed, ...missing } = base.action;
    expect(() => buildSemanticCommitment({ ...base, action: missing })).toThrow(/missing active/);

    const swapCase = (generateFixture().boundaryCases as Record<string, unknown>[]).find(
      (item) => item.id === "open-swap-kind-0",
    )!;
    const swap = swapCase.action as Eip712Action;
    const swapInput = semanticInputForAction(
      swap,
      swapCase.deploymentDomain as Hex32,
      computeDigest(swap, swapCase.deploymentDomain as Hex32).digest,
    );
    expect(() => buildSemanticCommitment({
      ...swapInput,
      action: { ...swapInput.action, recipient: `0x${"01".repeat(32)}` as Hex32 },
    })).toThrow(/requires a zero recipient/);
    expect(() => buildSemanticCommitment({
      ...swapInput,
      action: { ...swapInput.action, recipientKind: 3n },
    })).toThrow(/must be 0, 1, or 2/);
  });

  it("canonicalizes two non-DUST slots and rejects duplicates/overflow", () => {
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const base = semanticInputForAction(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, digest);
    const colorA = `0x${"10".repeat(32)}` as Hex32;
    const colorB = `0x${"20".repeat(32)}` as Hex32;
    const left = buildSemanticCommitment({
      ...base,
      nonDustImbalances: [
        { family: 2, color: colorB, direction: 1, amount: 4n },
        { family: 1, color: colorA, direction: 2, amount: 9n },
      ],
    });
    const right = buildSemanticCommitment({
      ...base,
      nonDustImbalances: [
        { family: 1, color: colorA, direction: 2, amount: 9n },
        { family: 2, color: colorB, direction: 1, amount: 4n },
      ],
    });
    expect(left.preimage).toEqual(right.preimage);
    expect(() => buildSemanticCommitment({
      ...base,
      nonDustImbalances: [
        { family: 1, color: colorA, direction: 1, amount: 1n },
        { family: 1, color: colorA, direction: 2, amount: 1n },
      ],
    })).toThrow(/duplicate/);
    expect(() => buildSemanticCommitment({
      ...base,
      nonDustImbalances: [
        { family: 1, color: colorA, direction: 1, amount: 1n },
        { family: 1, color: colorB, direction: 1, amount: 1n },
        { family: 2, color: colorA, direction: 1, amount: 1n },
      ],
    })).toThrow(/at most two/);
  });

  it("requires canonical native auth result and zero native/registration nonce", () => {
    const accountId = KAT_ACTION.accountId;
    const nativeBase: SemanticCommitmentInput = {
      manager: KAT_ACTION.manager,
      deploymentDomain: KAT_DEPLOYMENT_DOMAIN,
      selector: 0,
      accountId,
      authMode: "native",
      authResult: nativeAuthResult(accountId),
      nonce: 0n,
      action: {},
      nonDustImbalances: [],
    };
    expect(() => buildSemanticCommitment({ ...nativeBase, authResult: ZERO_32 })).toThrow(/not canonical/);
    expect(() => buildSemanticCommitment({ ...nativeBase, nonce: 1n })).toThrow(/nonce zero/);
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    const registration = semanticInputForAction(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, digest);
    expect(() => buildSemanticCommitment({ ...registration, nonce: 1n })).toThrow(/registration/);
  });
});
