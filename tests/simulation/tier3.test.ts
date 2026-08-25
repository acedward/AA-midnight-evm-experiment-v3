// 00010 — the Tier-3 security properties, asserted directly.
//
// The FR-031 semantic commitment moved off-circuit. The security argument for that amendment rests
// on four claims, and each one is a test here rather than a paragraph:
//
//   1. THE COMMITMENT COSTS NOTHING TO KEEP DEFINED. `semanticCommitmentFor` is still exported and
//      still PURE, so the compiler emits no proving key for it. (If it ever became impure it would
//      add a verifier key and a deploy cost, and the "free definition" claim would be false.)
//   2. THERE IS NOTHING TO TRUST BY MISTAKE. `execute` emits no events, on any selector, in either
//      auth mode. A reintroduced event surface fails these tests.
//   3. THE OLD EVENT IS ACTIVELY REFUSED. Feeding a REAL k=20 semantic event to the k=19 reader
//      raises, rather than being silently accepted.
//   4. THE RECOMPUTE-ONLY API ACTUALLY GUARDS. `recomputeSemanticCommitment` refuses to return when
//      its two independent recomputations disagree — the guard is exercised, not assumed.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { LogEvent } from "@midnight-ntwrk/midnight-js-contracts";

// @ts-ignore — generated artifact
import { pureCircuits as k19Pure, ledger as k19Ledger, Contract as K19Contract } from "../generated/manager/contract/index.js";
// @ts-ignore — generated artifact (k=20 reference oracle)
import { ledger as k20Ledger, Contract as K20Contract } from "../generated/manager-k20/contract/index.js";

import { bytesToHex, hexToBytes, type Hex32 } from "../lib/bytes.js";
import { computeDigest } from "../lib/codec.js";
import { KAT_ACTION, KAT_DEPLOYMENT_DOMAIN } from "../fixtures/generate.js";
import {
  assertManagerEmitsNoEvents,
  recomputeSemanticCommitment,
  type SemanticTranscript,
} from "../lib/manager-events.js";
import {
  emptyExecutePayload,
  executePayloadForAction,
  managerAddressHex,
  prepareEvmExecute,
  semanticCommitmentForExecute,
  type ManagerExecutePayload,
} from "../lib/manager.js";
import { metamaskSign } from "../lib/metamask.js";
import { nativeAuthResult } from "../lib/semantic.js";
import { addressForPrivateKey } from "../lib/signature.js";
import type { Eip712Action } from "../lib/schema.js";
import { ManagerSim, secretOf, type ManagerBuild } from "../lib/sim.js";

const K19: ManagerBuild = { Contract: K19Contract, ledger: k19Ledger };
const K20: ManagerBuild = { Contract: K20Contract, ledger: k20Ledger };

const NOW = 1_800_000_000;
const DEADLINE = BigInt(NOW + 600);
const EVM_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318" as Hex32;
const EVM_OWNER = addressForPrivateKey(EVM_KEY);
const NATIVE = secretOf("Tier3Native");
const NATIVE_B = secretOf("Tier3NativeB");
const COLOR_A = `0x${"11".repeat(32)}` as Hex32;
const COLOR_B = `0x${"22".repeat(32)}` as Hex32;
const RECIPIENT = `0x${"aa".repeat(32)}` as Hex32;
const SALT = `0x${"c7".repeat(32)}` as Hex32;

const bytes = (value: Hex32): Uint8Array => hexToBytes(value, 32);
const coin = (color: Hex32, value: bigint, nonceByte: number) => ({
  nonce: new Uint8Array(32).fill(nonceByte),
  color: bytes(color),
  value,
});

const inert = prepareEvmExecute(
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  metamaskSign(EVM_KEY, KAT_ACTION, KAT_DEPLOYMENT_DOMAIN),
);

describe("Tier-3 claim 1 — the semantic oracle stays exported, pure and keyless", () => {
  it("declares semanticCommitmentFor pure with no proof obligation, exactly as at k=20", () => {
    const info = JSON.parse(
      readFileSync("generated/manager/compiler/contract-info.json", "utf-8"),
    ) as { circuits: { name: string; pure: boolean; proof: boolean }[] };
    const reference = JSON.parse(
      readFileSync("generated/manager-k20/compiler/contract-info.json", "utf-8"),
    ) as { circuits: { name: string; pure: boolean; proof: boolean }[] };

    const oracle = info.circuits.find((c) => c.name === "semanticCommitmentFor");
    expect(oracle, "semanticCommitmentFor must still be exported").toBeDefined();
    expect(oracle!.pure, "semanticCommitmentFor must be PURE (no ledger reads)").toBe(true);
    expect(oracle!.proof, "a pure circuit must carry no proof obligation / proving key").toBe(false);

    // The whole declared circuit surface — names, purity and proof obligations — is unchanged.
    const shape = (d: typeof info) =>
      d.circuits.map((c) => `${c.name}:${c.pure}:${c.proof}`).sort();
    expect(shape(info)).toEqual(shape(reference));

    // Exactly nine circuits carry a proof obligation, i.e. nine proving keys, as at k=20.
    expect(info.circuits.filter((c) => c.proof).map((c) => c.name).sort()).toEqual([
      "accountRecord",
      "depositShielded",
      "depositUnshielded",
      "execute",
      "isRegistered",
      "poolHasColour",
      "poolValue",
      "shieldedAccountBalance",
      "unshieldedAccountBalance",
    ]);

    // And it is reachable as a pure circuit at runtime, with no context.
    expect(typeof (k19Pure as any).semanticCommitmentFor).toBe("function");
  });

  it("still evaluates the frozen KAT commitment through the pure oracle", () => {
    const payload = executePayloadForAction(KAT_ACTION);
    const digest = computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest;
    expect(
      bytesToHex(
        (k19Pure as any).semanticCommitmentFor(
          bytes(KAT_ACTION.manager),
          bytes(KAT_DEPLOYMENT_DOMAIN),
          payload,
          bytes(KAT_ACTION.accountId),
          bytes(digest),
        ),
      ),
    ).toBe(
      semanticCommitmentForExecute(
        KAT_ACTION.manager,
        KAT_DEPLOYMENT_DOMAIN,
        payload,
        KAT_ACTION.accountId,
        digest,
      ).commitment,
    );
  });
});

describe("Tier-3 claim 2 — execute emits nothing, on every path", () => {
  it("emits no events for any native selector", async () => {
    const sim = await ManagerSim.create(NATIVE, undefined, undefined, K19);
    const account = await sim.ownerCommitmentFor(NATIVE);
    const destination = await sim.ownerCommitmentFor(NATIVE_B);
    const base = emptyExecutePayload();

    // selector 0 — native registration, through execute.
    const reg = await sim.callDetailed("execute", base, inert.signature, inert.point);
    assertManagerEmitsNoEvents(reg.logEvents as readonly LogEvent[]);
    expect((reg.logEvents as readonly LogEvent[]).length).toBe(0);

    await sim.call("registerAccount", destination);
    await sim.call("depositShielded", coin(COLOR_A, 60n, 1), account);
    await sim.call("depositShielded", coin(COLOR_B, 60n, 2), account);
    await sim.call("depositUnshielded", bytes(COLOR_A), 60n, account);

    // selector 3 is exercised separately below: the simulator cannot fund the CONTRACT's own kernel
    // unshielded holdings, so `withdrawUnshielded` always refuses here — identically at k=20.
    const payloads: ManagerExecutePayload[] = [
      { ...base, selector: 2n, account, primaryColor: bytes(COLOR_A), primaryAmount: 1n, recipientKind: 0n, recipient: bytes(RECIPIENT) },
      { ...base, selector: 4n, account, primaryColor: bytes(COLOR_A), primaryAmount: 1n, toAccount: destination },
      { ...base, selector: 5n, account, primaryColor: bytes(COLOR_A), primaryAmount: 1n, toAccount: destination },
      {
        ...base,
        selector: 6n,
        account,
        primaryColor: bytes(COLOR_A),
        primaryAmount: 1n,
        recipientKind: 0n,
        wantNonce: new Uint8Array(32).fill(0x51),
        wantColor: bytes(COLOR_B),
        wantAmount: 1n,
        creditAccount: destination,
      },
    ];
    for (const payload of payloads) {
      const detail = await sim.callDetailed("execute", payload, inert.signature, inert.point);
      assertManagerEmitsNoEvents(detail.logEvents as readonly LogEvent[]);
      expect((detail.logEvents as readonly LogEvent[]).length, `selector ${payload.selector}`).toBe(0);
    }

    // selector 3 — refuses in the simulator, and a refused call is state-neutral and event-free.
    expect(
      await sim.expectReject(
        "execute",
        { ...base, selector: 3n, account, primaryColor: bytes(COLOR_A), primaryAmount: 1n, recipientKind: 0n, recipient: bytes(RECIPIENT) },
        inert.signature,
        inert.point,
      ),
    ).toMatch(/contract unshielded balance too low/);
  });

  it("emits no events on the EVM-authorized path either (selectors 1 and 2)", async () => {
    const sim = await ManagerSim.create(NATIVE, undefined, undefined, K19);
    const manager = managerAddressHex(sim.address);
    const domain = bytesToHex(sim.deploymentDomain) as Hex32;
    const accountId = bytesToHex(
      (k19Pure as any).evmAccountIdFor(bytes(manager), hexToBytes(EVM_OWNER, 20), bytes(SALT)),
    ) as Hex32;

    const registration: Eip712Action = {
      primaryType: "RegisterEvmAccount",
      manager,
      accountId,
      owner: EVM_OWNER,
      accountSalt: SALT,
      validUntil: DEADLINE,
    };
    const reg = prepareEvmExecute(registration, domain, metamaskSign(EVM_KEY, registration, domain));
    const regDetail = await sim.callDetailedAt(NOW, "execute", reg.payload, reg.signature, reg.point);
    assertManagerEmitsNoEvents(regDetail.logEvents as readonly LogEvent[]);

    await sim.call("depositShielded", coin(COLOR_A, 30n, 3), bytes(accountId));
    const withdraw: Eip712Action = {
      primaryType: "WithdrawShielded",
      manager,
      accountId,
      owner: EVM_OWNER,
      nonce: 0n,
      validUntil: DEADLINE,
      color: COLOR_A,
      amount: 2n,
      recipientKind: 0n,
      recipient: RECIPIENT,
    };
    const w = prepareEvmExecute(withdraw, domain, metamaskSign(EVM_KEY, withdraw, domain));
    const wDetail = await sim.callDetailedAt(NOW, "execute", w.payload, w.signature, w.point);
    assertManagerEmitsNoEvents(wDetail.logEvents as readonly LogEvent[]);
    expect((wDetail.logEvents as readonly LogEvent[]).length).toBe(0);
  });
});

describe("Tier-3 claim 3 — a real k=20 semantic event is REFUSED, not accepted", () => {
  it("raises when handed the genuine event the k=20 Manager emits", async () => {
    const sim = await ManagerSim.create(NATIVE, undefined, undefined, K20);
    const account = await sim.ownerCommitmentFor(NATIVE);
    const detail = await sim.callDetailed(
      "execute",
      emptyExecutePayload(),
      inert.signature,
      inert.point,
    );
    // Sanity: the k=20 build really does emit something, or this test proves nothing.
    expect((detail.logEvents as readonly LogEvent[]).length).toBeGreaterThan(0);
    expect(bytesToHex(account)).toMatch(/^0x[0-9a-f]{64}$/);

    expect(() => assertManagerEmitsNoEvents(detail.logEvents as readonly LogEvent[])).toThrow(
      /REMOVED FR-031 semantic event|must emit no events/,
    );
  });
});

describe("Tier-3 claim 4 — the recompute-only API guards, and is the only way to a commitment", () => {
  const transcript: SemanticTranscript = {
    manager: KAT_ACTION.manager,
    deploymentDomain: KAT_DEPLOYMENT_DOMAIN,
    payload: executePayloadForAction(KAT_ACTION),
    accountId: KAT_ACTION.accountId,
    authResult: computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest,
  };
  const oracle = (
    manager: Uint8Array,
    domain: Uint8Array,
    payload: unknown,
    account: Uint8Array,
    authResult: Uint8Array,
  ) => (k19Pure as any).semanticCommitmentFor(manager, domain, payload, account, authResult);
  const independent = (input: SemanticTranscript) =>
    semanticCommitmentForExecute(
      input.manager,
      input.deploymentDomain,
      input.payload as ManagerExecutePayload,
      input.accountId,
      input.authResult,
    ).commitment;

  it("returns the commitment when both recomputations agree", () => {
    expect(recomputeSemanticCommitment(transcript, oracle, independent)).toBe(
      independent(transcript),
    );
  });

  it("throws rather than returning when the two recomputations disagree", () => {
    const drifted = () => `0x${"be".repeat(32)}` as Hex32;
    expect(() => recomputeSemanticCommitment(transcript, oracle, drifted)).toThrow(
      /recomputation disagreed/,
    );
  });

  it("exposes no function that reads a commitment from anywhere", async () => {
    const module = await import("../lib/manager-events.js");
    expect(Object.keys(module).sort()).toEqual([
      "assertManagerEmitsNoEvents",
      "recomputeSemanticCommitment",
    ]);
  });

  it("binds every transcript field it commits to — perturbing any one changes the commitment", () => {
    const baseline = independent(transcript);
    const payload = transcript.payload as ManagerExecutePayload;
    const variants: { label: string; input: SemanticTranscript }[] = [
      {
        label: "manager",
        input: { ...transcript, manager: `0x${"ab".repeat(32)}` as Hex32 },
      },
      {
        label: "deploymentDomain",
        input: { ...transcript, deploymentDomain: `0x${"de".repeat(32)}` as Hex32 },
      },
      {
        label: "accountId",
        input: { ...transcript, accountId: `0x${"1f".repeat(32)}` as Hex32 },
      },
      {
        label: "authResult",
        input: { ...transcript, authResult: `0x${"2f".repeat(32)}` as Hex32 },
      },
      {
        label: "accountSalt (an action field)",
        input: {
          ...transcript,
          payload: { ...payload, accountSalt: new Uint8Array(32).fill(0x3f) },
        },
      },
      {
        label: "validUntil (an action field)",
        input: { ...transcript, payload: { ...payload, validUntil: payload.validUntil + 1n } },
      },
    ];
    const seen = new Set<string>([baseline]);
    for (const variant of variants) {
      const value = independent(variant.input);
      expect(value, `perturbing ${variant.label} must change the commitment`).not.toBe(baseline);
      // …and each perturbation is distinct, so this is not one field swamping the rest.
      expect(seen.has(value), `perturbing ${variant.label} collided`).toBe(false);
      seen.add(value);
      // The pure oracle agrees on every perturbation too.
      expect(
        recomputeSemanticCommitment(variant.input, oracle, independent),
        `oracle agreement under perturbed ${variant.label}`,
      ).toBe(value);
    }
  });
});
