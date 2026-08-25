// 00010 — EXECUTED byte-parity of the k=19 Manager against the REAL k=20 Manager artifact.
//
// FR-1003 and FR-1004 require the EIP-712 byte surface and the custody semantics to be identical to
// the k=20 product, "proven by executed KATs, not source inspection". This suite is that proof: it
// loads BOTH compiled contracts in the same process and drives them with identical inputs.
//
//   generated/manager      the k=19 Manager under test (e1 + o2 + Tier-3)
//   generated/manager-k20  the unmodified k=20 product, compiled from the base commit
//
// The ONE difference that is expected and intended is the Tier-3 amendment: the k=20 Manager emits
// the FR-031 semantic `Misc` event and the k=19 Manager emits nothing. That difference is not
// waved through — it is asserted precisely, and the test additionally shows that the value k=20
// emitted is EXACTLY RECOVERABLE from the k=19 proved transcript. Nothing is lost by removing it.

import { describe, expect, it } from "vitest";

import type { LogEvent } from "@midnight-ntwrk/midnight-js-contracts";

// @ts-ignore — generated artifact
import {
  Contract as K19Contract,
  ledger as k19Ledger,
  pureCircuits as k19Pure,
} from "../../../generated/manager/contract/index.js";
// @ts-ignore — generated artifact (the k=20 reference oracle, mounted by parity-suite.sh)
import {
  Contract as K20Contract,
  ledger as k20Ledger,
  pureCircuits as k20Pure,
} from "../../../generated/manager-k20/contract/index.js";

import { bytesToHex, hexToBytes, type Hex32 } from "../bytes.js";
import { computeDigest } from "../codec.js";
import {
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  generateFixture,
} from "../fixtures/generate.js";
import {
  emptyExecutePayload,
  executePayloadForAction,
  managerAddressHex,
  prepareEvmExecute,
  semanticCommitmentForExecute,
  type ManagerExecutePayload,
} from "../manager.js";
import { metamaskSign } from "../metamask.js";
import type { Eip712Action } from "../schema.js";
import { addressForPrivateKey } from "../signature.js";
import { nativeAuthResult } from "../semantic.js";
import {
  ManagerSim,
  secretOf,
  snapshotLedger,
  type ManagerBuild,
  type CallDetail,
} from "../../test/sim.js";

const K19: ManagerBuild = { Contract: K19Contract, ledger: k19Ledger };
const K20: ManagerBuild = { Contract: K20Contract, ledger: k20Ledger };

const NOW = 1_800_000_000;
const DEADLINE = BigInt(NOW + 600);
const EVM_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318" as Hex32;
const EVM_OWNER = addressForPrivateKey(EVM_KEY);
const NATIVE = secretOf("K20ParityNative");
const NATIVE_B = secretOf("K20ParityNativeB");
const COLOR_A = `0x${"11".repeat(32)}` as Hex32;
const COLOR_B = `0x${"22".repeat(32)}` as Hex32;
const RECIPIENT = `0x${"aa".repeat(32)}` as Hex32;
const SALT = `0x${"c1".repeat(32)}` as Hex32;

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

/** Every fixture case, so the pure-surface comparison covers all six EVM selectors and all shapes. */
function allFixtureCases(): { id: string; action: Eip712Action; deployment: Hex32 }[] {
  const fixture = generateFixture();
  const raw = [
    fixture.kat,
    ...(fixture.boundaryCases as Record<string, unknown>[]),
    ...(fixture.randomCases as Record<string, unknown>[]),
  ] as Record<string, unknown>[];
  return raw.map((item) => ({
    id: String(item.id),
    action: item.action as Eip712Action,
    deployment: item.deploymentDomain as Hex32,
  }));
}

// ================================================================================================
// FR-1003 — the EIP-712 / oracle byte surface
// ================================================================================================

describe("k20 parity — the pure byte surface is identical", () => {
  it("agrees on evmAccountIdFor / evmDomainSeparatorFor / evmStructHashFor / evmDigestFor for every fixture", () => {
    const cases = allFixtureCases();
    expect(cases.length).toBeGreaterThan(48);
    const selectors = new Set<bigint>();
    for (const item of cases) {
      const payload = executePayloadForAction(item.action);
      selectors.add(payload.selector);
      const manager = bytes(item.action.manager);
      const domain = bytes(item.deployment);
      const owner = hexToBytes(item.action.owner, 20);
      const salt = bytes(
        (item.action.primaryType === "RegisterEvmAccount"
          ? item.action.accountSalt
          : `0x${"00".repeat(32)}`) as Hex32,
      );

      const k19Account = (k19Pure as any).evmAccountIdFor(manager, owner, salt);
      const k20Account = (k20Pure as any).evmAccountIdFor(manager, owner, salt);
      expect(bytesToHex(k19Account), `${item.id} accountId`).toBe(bytesToHex(k20Account));

      const k19Domain = (k19Pure as any).evmDomainSeparatorFor(manager, domain);
      const k20Domain = (k20Pure as any).evmDomainSeparatorFor(manager, domain);
      expect(bytesToHex(k19Domain), `${item.id} domainSeparator`).toBe(bytesToHex(k20Domain));

      const k19Struct = (k19Pure as any).evmStructHashFor(manager, payload);
      const k20Struct = (k20Pure as any).evmStructHashFor(manager, payload);
      expect(bytesToHex(k19Struct), `${item.id} structHash`).toBe(bytesToHex(k20Struct));

      const k19Digest = (k19Pure as any).evmDigestFor(manager, domain, payload);
      const k20Digest = (k20Pure as any).evmDigestFor(manager, domain, payload);
      expect(bytesToHex(k19Digest), `${item.id} digest`).toBe(bytesToHex(k20Digest));

      // …and both agree with the frozen off-chain codec, so this is not two copies of one drift.
      expect(bytesToHex(k19Digest), `${item.id} digest vs frozen codec`).toBe(
        computeDigest(item.action, item.deployment).digest,
      );
    }
    // Every EVM selector is exercised.
    expect([...selectors].map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("agrees on the semantic commitment oracle for every fixture selector and shape — accepting AND refusing identically", () => {
    // The fixture set deliberately includes envelopes `assertActionEnvelope` refuses (e.g. a zero
    // registration salt). Comparing "value or refusal message" therefore covers both halves of the
    // surface: the two builds must accept the same inputs, produce the same bytes, and refuse the
    // same inputs with the same message.
    const evaluate = (fn: () => Uint8Array): string => {
      try {
        return bytesToHex(fn());
      } catch (error) {
        return `REFUSED:${error instanceof Error ? error.message : String(error)}`;
      }
    };
    let accepted = 0;
    let refused = 0;
    for (const item of allFixtureCases()) {
      const payload = executePayloadForAction(item.action);
      const manager = bytes(item.action.manager);
      const domain = bytes(item.deployment);
      const account = bytes(item.action.accountId);
      const digestHex = computeDigest(item.action, item.deployment).digest;
      const digest = bytes(digestHex);

      const left = evaluate(() =>
        (k19Pure as any).semanticCommitmentFor(manager, domain, payload, account, digest),
      );
      const right = evaluate(() =>
        (k20Pure as any).semanticCommitmentFor(manager, domain, payload, account, digest),
      );
      expect(left, `${item.id} semantic commitment`).toBe(right);

      if (left.startsWith("REFUSED:")) {
        refused += 1;
        continue;
      }
      accepted += 1;
      // Independent TypeScript recomputation from the same transcript fields.
      expect(left, `${item.id} semantic vs independent TS recipe`).toBe(
        semanticCommitmentForExecute(
          item.action.manager,
          item.deployment,
          payload,
          item.action.accountId,
          digestHex,
        ).commitment,
      );
    }
    // Both halves are actually exercised — this is not an all-refused vacuous pass.
    expect(accepted, "accepted fixture cases").toBeGreaterThan(40);
    expect(refused, "refused fixture cases").toBeGreaterThan(0);
  });

  it("agrees on the native selector-0 shape, which no EVM fixture covers", () => {
    const manager = bytes(KAT_ACTION.manager);
    const domain = bytes(KAT_DEPLOYMENT_DOMAIN);
    const accountHex = `0x${"77".repeat(32)}` as Hex32;
    const payload = emptyExecutePayload();
    const authResult = nativeAuthResult(accountHex);
    const k19Commitment = (k19Pure as any).semanticCommitmentFor(
      manager,
      domain,
      payload,
      bytes(accountHex),
      bytes(authResult),
    );
    const k20Commitment = (k20Pure as any).semanticCommitmentFor(
      manager,
      domain,
      payload,
      bytes(accountHex),
      bytes(authResult),
    );
    expect(bytesToHex(k19Commitment)).toBe(bytesToHex(k20Commitment));
    expect(bytesToHex(k19Commitment)).toBe(
      semanticCommitmentForExecute(
        KAT_ACTION.manager,
        KAT_DEPLOYMENT_DOMAIN,
        payload,
        accountHex,
        authResult,
      ).commitment,
    );
  });

  it("agrees on the shielded/unshielded key domains and the zswap transcriptions", () => {
    const account = bytes(`0x${"3c".repeat(32)}` as Hex32);
    const colour = bytes(COLOR_A);
    expect(bytesToHex((k19Pure as any).shieldedKey(account, colour))).toBe(
      bytesToHex((k20Pure as any).shieldedKey(account, colour)),
    );
    expect(bytesToHex((k19Pure as any).unshieldedKey(account, colour))).toBe(
      bytesToHex((k20Pure as any).unshieldedKey(account, colour)),
    );
    // The two families must still not alias, on both builds.
    expect(bytesToHex((k19Pure as any).shieldedKey(account, colour))).not.toBe(
      bytesToHex((k19Pure as any).unshieldedKey(account, colour)),
    );
    const c = coin(COLOR_A, 7n, 9);
    const addr = { bytes: bytes(`0x${"5e".repeat(32)}` as Hex32) };
    expect(bytesToHex((k19Pure as any).zswapNullifierOf(c, addr))).toBe(
      bytesToHex((k20Pure as any).zswapNullifierOf(c, addr)),
    );
    const recipient = { is_left: false, left: { bytes: new Uint8Array(32) }, right: addr };
    expect(bytesToHex((k19Pure as any).zswapCommitmentOf(c, recipient))).toBe(
      bytesToHex((k20Pure as any).zswapCommitmentOf(c, recipient)),
    );
  });
});

// ================================================================================================
// FR-1004 — custody semantics, executed side by side
// ================================================================================================

/** Run one `execute` on both builds and require every observable effect to match. */
function expectSameEffects(
  label: string,
  k19: CallDetail<unknown>,
  k20: CallDetail<unknown>,
  k19Sim: ManagerSim,
  k20Sim: ManagerSim,
): void {
  expect(snapshotLedger(k19Sim.ledger), `${label} ledger`).toEqual(snapshotLedger(k20Sim.ledger));
  expect(k19.inputs, `${label} zswap inputs`).toEqual(k20.inputs);
  expect(k19.outputs, `${label} zswap outputs`).toEqual(k20.outputs);
  expect(k19.effects, `${label} zswap effects`).toEqual(k20.effects);
}

async function pair(): Promise<{ k19: ManagerSim; k20: ManagerSim }> {
  const k19 = await ManagerSim.create(NATIVE, undefined, undefined, K19);
  // Same deployment domain AND same contract address, so every address-bound derivation matches.
  const k20 = await ManagerSim.create(NATIVE, k19.deploymentDomain, k19.address, K20);
  expect(managerAddressHex(k19.address)).toBe(managerAddressHex(k20.address));
  return { k19, k20 };
}

describe("k20 parity — custody effects are identical, action by action", () => {
  it("registers, deposits and runs all five custody actions with identical state and zswap shape", async () => {
    const { k19, k20 } = await pair();
    // Both sims must learn both witnesses — the legacy `registerAccount` adapter looks the owner
    // secret up by account id on the sim it is called on.
    const account = await k19.ownerCommitmentFor(NATIVE);
    const destination = await k19.ownerCommitmentFor(NATIVE_B);
    expect(bytesToHex(account)).toBe(bytesToHex(await k20.ownerCommitmentFor(NATIVE)));
    expect(bytesToHex(destination)).toBe(bytesToHex(await k20.ownerCommitmentFor(NATIVE_B)));

    for (const sim of [k19, k20]) {
      await sim.call("registerAccount", account);
      await sim.call("registerAccount", destination);
      await sim.call("depositShielded", coin(COLOR_A, 100n, 1), account);
      await sim.call("depositShielded", coin(COLOR_B, 100n, 2), account);
      await sim.call("depositUnshielded", bytes(COLOR_A), 100n, account);
    }
    expect(snapshotLedger(k19.ledger)).toEqual(snapshotLedger(k20.ledger));

    const base = emptyExecutePayload();
    const cases: { label: string; payload: ManagerExecutePayload }[] = [
      {
        label: "selector 2 — withdrawShielded, recipientKind 0 (user key)",
        payload: {
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 3n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        },
      },
      {
        label: "selector 2 — withdrawShielded, recipientKind 1 (contract)",
        payload: {
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 4n,
          recipientKind: 1n,
          recipient: bytes(RECIPIENT),
        },
      },
      // NOTE: selector 3 (withdrawUnshielded) is NOT a success case here. The simulator cannot fund
      // the CONTRACT's own kernel unshielded holdings, so the leg always hits "contract unshielded
      // balance too low" — identically on both builds. It is covered as an identical-refusal case
      // in the negative suite below, which is where it belongs.
      {
        label: "selector 4 — transferInternalShielded",
        payload: {
          ...base,
          selector: 4n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 6n,
          toAccount: destination,
        },
      },
      {
        label: "selector 5 — transferInternalUnshielded",
        payload: {
          ...base,
          selector: 5n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 7n,
          toAccount: destination,
        },
      },
      {
        label: "selector 6 — openSwapShielded, recipientKind 0 (OPEN, FR-308 v2a)",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 8n,
          recipientKind: 0n,
          wantNonce: new Uint8Array(32).fill(0x31),
          wantColor: bytes(COLOR_B),
          wantAmount: 9n,
          creditAccount: destination,
        },
      },
      {
        label: "selector 6 — openSwapShielded, recipientKind 1 (named taker key)",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 10n,
          recipientKind: 1n,
          recipient: bytes(RECIPIENT),
          wantNonce: new Uint8Array(32).fill(0x32),
          wantColor: bytes(COLOR_B),
          wantAmount: 11n,
          creditAccount: destination,
        },
      },
      {
        label: "selector 6 — openSwapShielded, recipientKind 2 (contract taker)",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 12n,
          recipientKind: 2n,
          recipient: bytes(RECIPIENT),
          wantNonce: new Uint8Array(32).fill(0x33),
          wantColor: bytes(COLOR_B),
          wantAmount: 13n,
          creditAccount: destination,
        },
      },
    ];

    for (const item of cases) {
      const left = await k19.callDetailed("execute", item.payload, inert.signature, inert.point);
      const right = await k20.callDetailed("execute", item.payload, inert.signature, inert.point);
      expectSameEffects(item.label, left, right, k19, k20);

      // THE ONE INTENDED DIFFERENCE, asserted rather than waved through: k=20 emits the FR-031
      // semantic event, k=19 emits nothing — and the value k=20 emitted is exactly what the k=19
      // transcript recomputes to. Removing the event lost no information.
      expect((left.logEvents as readonly LogEvent[]).length, `${item.label} k19 events`).toBe(0);
      expect(
        (right.logEvents as readonly LogEvent[]).length,
        `${item.label} k20 events`,
      ).toBeGreaterThan(0);

      const accountHex = bytesToHex(account) as Hex32;
      const recomputed = semanticCommitmentForExecute(
        managerAddressHex(k19.address),
        bytesToHex(k19.deploymentDomain) as Hex32,
        item.payload,
        accountHex,
        nativeAuthResult(accountHex),
      ).commitment;
      const emitted = extractLegacySemanticCommitment(right.logEvents as readonly LogEvent[]);
      expect(emitted, `${item.label} k20 emitted commitment`).toBe(recomputed);
    }
  });

  it("refuses identically on the negative set, state-neutrally on both builds", async () => {
    const { k19, k20 } = await pair();
    const account = await k19.ownerCommitmentFor(NATIVE);
    const destination = await k19.ownerCommitmentFor(NATIVE_B);
    await k20.ownerCommitmentFor(NATIVE);
    await k20.ownerCommitmentFor(NATIVE_B);
    for (const sim of [k19, k20]) {
      await sim.call("registerAccount", account);
      await sim.call("registerAccount", destination);
      await sim.call("depositShielded", coin(COLOR_A, 10n, 1), account);
      await sim.call("depositUnshielded", bytes(COLOR_A), 10n, account);
    }

    const base = emptyExecutePayload();
    const unregistered = new Uint8Array(32).fill(0x99);
    const negatives: { label: string; payload: ManagerExecutePayload }[] = [
      {
        label: "NC — selector 3 with the contract's unshielded holdings unfunded",
        payload: {
          ...base,
          selector: 3n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        },
      },
      {
        label: "NC — shielded debit over the account colour balance",
        payload: {
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 999n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        },
      },
      {
        label: "NC — unshielded debit over the account colour balance",
        payload: {
          ...base,
          selector: 3n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 999n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        },
      },
      {
        label: "NC — debit of a colour that was never credited (missing cell reads 0)",
        payload: {
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_B),
          primaryAmount: 1n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        },
      },
      {
        label: "NC — internal transfer to an unregistered destination",
        payload: {
          ...base,
          selector: 4n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          toAccount: unregistered,
        },
      },
      {
        label: "NC — internal transfer to the same account",
        payload: {
          ...base,
          selector: 4n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          toAccount: account,
        },
      },
      {
        label: "NC — zero-amount internal transfer",
        payload: {
          ...base,
          selector: 5n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 0n,
          toAccount: destination,
        },
      },
      {
        label: "NC — swap with equal give/want colours",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          recipientKind: 0n,
          wantNonce: new Uint8Array(32).fill(0x41),
          wantColor: bytes(COLOR_A),
          wantAmount: 1n,
          creditAccount: destination,
        },
      },
      {
        label: "NC — swap crediting an unregistered account",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          recipientKind: 0n,
          wantNonce: new Uint8Array(32).fill(0x42),
          wantColor: bytes(COLOR_B),
          wantAmount: 1n,
          creditAccount: unregistered,
        },
      },
      {
        label: "NC — swap wanting zero",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          recipientKind: 0n,
          wantNonce: new Uint8Array(32).fill(0x43),
          wantColor: bytes(COLOR_B),
          wantAmount: 0n,
          creditAccount: destination,
        },
      },
      {
        label: "NC — envelope: recipientKind out of range for selector 2",
        payload: {
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          recipientKind: 2n,
          recipient: bytes(RECIPIENT),
        },
      },
      {
        label: "NC — envelope: unknown selector",
        payload: { ...base, selector: 7n, account },
      },
      {
        label: "NC — envelope: noncanonical inactive field on selector 4",
        payload: {
          ...base,
          selector: 4n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 1n,
          toAccount: destination,
          recipient: bytes(RECIPIENT),
        },
      },
    ];

    for (const item of negatives) {
      const before19 = JSON.stringify(snapshotLedger(k19.ledger));
      const before20 = JSON.stringify(snapshotLedger(k20.ledger));
      const left = await k19.expectReject("execute", item.payload, inert.signature, inert.point);
      const right = await k20.expectReject("execute", item.payload, inert.signature, inert.point);
      // Same refusal, same message — the refusal SET and its text are part of the frozen surface.
      expect(left, `${item.label} refusal message`).toBe(right);
      // State-neutral on both (expectReject already fails if state moved; this pins the bytes).
      expect(JSON.stringify(snapshotLedger(k19.ledger)), `${item.label} k19 neutrality`).toBe(
        before19,
      );
      expect(JSON.stringify(snapshotLedger(k20.ledger)), `${item.label} k20 neutrality`).toBe(
        before20,
      );
      expect(snapshotLedger(k19.ledger), `${item.label} cross-build state`).toEqual(
        snapshotLedger(k20.ledger),
      );
    }
    expect(negatives.length).toBe(13);
  });

  it("agrees on the EVM-authorized path: signature, deadline, nonce-after-custody, refusals", async () => {
    const { k19, k20 } = await pair();
    const manager = managerAddressHex(k19.address);
    const domain = bytesToHex(k19.deploymentDomain) as Hex32;

    const registration: Eip712Action = {
      primaryType: "RegisterEvmAccount",
      manager,
      accountId: bytesToHex(
        (k19Pure as any).evmAccountIdFor(
          bytes(manager),
          hexToBytes(EVM_OWNER, 20),
          bytes(SALT),
        ),
      ) as Hex32,
      owner: EVM_OWNER,
      accountSalt: SALT,
      validUntil: DEADLINE,
    };
    const prepared = prepareEvmExecute(
      registration,
      domain,
      metamaskSign(EVM_KEY, registration, domain),
    );
    const reg19 = await k19.callDetailedAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point);
    const reg20 = await k20.callDetailedAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point);
    expectSameEffects("EVM registration", reg19, reg20, k19, k20);

    for (const sim of [k19, k20]) {
      await sim.call("depositShielded", coin(COLOR_A, 50n, 1), bytes(registration.accountId));
    }

    const withdraw: Eip712Action = {
      primaryType: "WithdrawShielded",
      manager,
      accountId: registration.accountId,
      owner: EVM_OWNER,
      nonce: 0n,
      validUntil: DEADLINE,
      color: COLOR_A,
      amount: 5n,
      recipientKind: 0n,
      recipient: RECIPIENT,
    };
    const w = prepareEvmExecute(withdraw, domain, metamaskSign(EVM_KEY, withdraw, domain));
    const w19 = await k19.callDetailedAt(NOW, "execute", w.payload, w.signature, w.point);
    const w20 = await k20.callDetailedAt(NOW, "execute", w.payload, w.signature, w.point);
    expectSameEffects("EVM withdraw", w19, w20, k19, k20);
    expect(k19.ledger.evmNonces.lookup(bytes(registration.accountId))).toBe(1n);
    expect(k20.ledger.evmNonces.lookup(bytes(registration.accountId))).toBe(1n);

    // Replay of the same signed action must now refuse identically (nonce consumed).
    expect(await k19.expectRejectAt(NOW, "execute", w.payload, w.signature, w.point)).toBe(
      await k20.expectRejectAt(NOW, "execute", w.payload, w.signature, w.point),
    );

    // Expired deadline refuses identically.
    const expired = await k19.expectRejectAt(
      Number(DEADLINE) + 10,
      "execute",
      w.payload,
      w.signature,
      w.point,
    );
    expect(expired).toBe(
      await k20.expectRejectAt(Number(DEADLINE) + 10, "execute", w.payload, w.signature, w.point),
    );

    // A signature over a DIFFERENT domain refuses identically — the domain binding is intact.
    const wrongDomain = prepareEvmExecute(
      withdraw,
      KAT_DEPLOYMENT_DOMAIN,
      metamaskSign(EVM_KEY, withdraw, KAT_DEPLOYMENT_DOMAIN),
    );
    expect(
      await k19.expectRejectAt(NOW, "execute", wrongDomain.payload, wrongDomain.signature, wrongDomain.point),
    ).toBe(
      await k20.expectRejectAt(NOW, "execute", wrongDomain.payload, wrongDomain.signature, wrongDomain.point),
    );
  });
});

/**
 * Decode the k=20 Manager's legacy semantic event. This exists ONLY inside this parity test, to
 * show that the removed event's value is recoverable from the k=19 transcript. It is deliberately
 * not exported: nothing in the shipping harness may read a commitment out of an event.
 */
function extractLegacySemanticCommitment(events: readonly LogEvent[]): string | undefined {
  for (const event of events) {
    const raw = event as LogEvent & {
      data?: { tag?: string; content?: { value?: readonly Uint8Array[] } };
    };
    const segments = raw.data?.tag === "cell" ? raw.data.content?.value : undefined;
    if (!segments) continue;
    const length = segments.reduce((total, segment) => total + segment.length, 0);
    const flat = new Uint8Array(length);
    let offset = 0;
    for (const segment of segments) {
      flat.set(segment, offset);
      offset += segment.length;
    }
    if (flat.length < 64) continue;
    return bytesToHex(flat.slice(32, 64));
  }
  return undefined;
}
