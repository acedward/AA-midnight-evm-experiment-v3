import { describe, expect, it } from "vitest";

import type { LogEvent } from "@midnight-ntwrk/midnight-js-contracts";

import { pureCircuits as managerContractPure } from "../../../generated/manager/contract/index.js";
import { bytesToHex, hexToBytes, type Hex20, type Hex32 } from "../bytes.js";
import { computeDigest, deriveAccountId } from "../codec.js";
import {
  KAT_ACCOUNT_ID,
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  KAT_MANAGER,
  KAT_OWNER,
  KAT_PRIVATE_KEY,
  KAT_SIGNATURE,
} from "../fixtures/generate.js";
import { extractManagerSemanticEvents } from "../manager-events.js";
import {
  emptyExecutePayload,
  executePayloadForAction,
  managerAddressHex,
  prepareEvmExecute,
  semanticCommitmentForExecute,
  type ManagerExecutePayload,
  type PreparedEvmExecute,
} from "../manager.js";
import { metamaskSign } from "../metamask.js";
import type { Eip712Action, RegisterEvmAccount } from "../schema.js";
import { addressForPrivateKey, highSTwin } from "../signature.js";
import { nativeAuthResult } from "../semantic.js";
import { ManagerSim, secretOf, snapshotLedger, type CallDetail } from "../../test/sim.js";

const NOW = 1_800_000_000;
const DEADLINE = BigInt(NOW + 600);
const EVM_KEY_A = KAT_PRIVATE_KEY;
const EVM_KEY_B =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as Hex32;
const EVM_OWNER_A = addressForPrivateKey(EVM_KEY_A);
const EVM_OWNER_B = addressForPrivateKey(EVM_KEY_B);
const NATIVE_A = secretOf("DualAuthNativeA");
const NATIVE_B = secretOf("DualAuthNativeB");
const COLOR_A = `0x${"11".repeat(32)}` as Hex32;
const COLOR_B = `0x${"22".repeat(32)}` as Hex32;
const RECIPIENT = `0x${"aa".repeat(32)}` as Hex32;
const SALT_A = `0x${"c1".repeat(32)}` as Hex32;
const SALT_B = `0x${"c2".repeat(32)}` as Hex32;

const bytes = (value: Hex32): Uint8Array => hexToBytes(value, 32);
const coin = (color: Hex32, value: bigint, nonceByte: number) => ({
  nonce: new Uint8Array(32).fill(nonceByte),
  color: bytes(color),
  value,
});

const inert = prepareEvmExecute(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, KAT_SIGNATURE);

function registration(
  manager: Hex32,
  owner: Hex20,
  accountSalt: Hex32,
  validUntil: bigint = DEADLINE,
): RegisterEvmAccount {
  return {
    primaryType: "RegisterEvmAccount",
    manager,
    accountId: deriveAccountId(manager, owner, accountSalt),
    owner,
    accountSalt,
    validUntil,
  };
}

async function registerEvm(
  sim: ManagerSim,
  privateKey: Hex32,
  accountSalt: Hex32,
): Promise<{ action: RegisterEvmAccount; prepared: PreparedEvmExecute; detail: CallDetail<unknown> }> {
  const manager = managerAddressHex(sim.address);
  const domain = bytesToHex(sim.deploymentDomain) as Hex32;
  const owner = addressForPrivateKey(privateKey);
  const action = registration(manager, owner, accountSalt);
  const prepared = prepareEvmExecute(action, domain, metamaskSign(privateKey, action, domain));
  const detail = await sim.callDetailedAt(
    NOW,
    "execute",
    prepared.payload,
    prepared.signature,
    prepared.point,
  );
  return { action, prepared, detail };
}

function expectSemantic(
  sim: ManagerSim,
  detail: CallDetail<unknown>,
  payload: ManagerExecutePayload,
  accountId: Hex32,
  authResult: Hex32,
): void {
  const manager = managerAddressHex(sim.address);
  const domain = bytesToHex(sim.deploymentDomain) as Hex32;
  const expected = semanticCommitmentForExecute(manager, domain, payload, accountId, authResult);
  const events = extractManagerSemanticEvents(detail.logEvents as readonly LogEvent[]);
  expect(events, `selector ${payload.selector} semantic events`).toHaveLength(1);
  expect(events[0]).toMatchObject({
    commitment: expected.commitment,
  });
}

async function executeEvm(
  sim: ManagerSim,
  privateKey: Hex32,
  action: Eip712Action,
): Promise<PreparedEvmExecute> {
  const domain = bytesToHex(sim.deploymentDomain) as Hex32;
  const prepared = prepareEvmExecute(action, domain, metamaskSign(privateKey, action, domain));
  const detail = await sim.callDetailedAt(
    NOW,
    "execute",
    prepared.payload,
    prepared.signature,
    prepared.point,
  );
  expectSemantic(sim, detail, prepared.payload, action.accountId, prepared.digest);
  return prepared;
}

describe("Manager v5 EIP-712 pure byte agreement", () => {
  it("reproduces the frozen registration KAT through the generated Manager pure circuits", () => {
    const payload = executePayloadForAction(KAT_ACTION);
    const pure = managerContractPure as any;
    expect(bytesToHex(pure.evmAccountIdFor(bytes(KAT_MANAGER), hexToBytes(KAT_OWNER, 20), bytes(KAT_ACTION.accountSalt)))).toBe(
      KAT_ACCOUNT_ID,
    );
    expect(bytesToHex(pure.evmDigestFor(bytes(KAT_MANAGER), bytes(KAT_DEPLOYMENT_DOMAIN), payload))).toBe(
      computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest,
    );
    const expected = semanticCommitmentForExecute(
      KAT_MANAGER,
      KAT_DEPLOYMENT_DOMAIN,
      payload,
      KAT_ACCOUNT_ID,
      computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest,
    );
    expect(
      bytesToHex(
        pure.semanticCommitmentFor(
          bytes(KAT_MANAGER),
          bytes(KAT_DEPLOYMENT_DOMAIN),
          payload,
          bytes(KAT_ACCOUNT_ID),
          bytes(computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest),
        ),
      ),
    ).toBe(expected.commitment);
  });
});

describe("Manager v5 registration and account policy", () => {
  it("registers native and EVM records through execute only, with exact semantic events", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const nativeId = await sim.ownerCommitmentFor(NATIVE_A);
    const nativePayload = emptyExecutePayload();
    const nativeDetail = await sim.callDetailed(
      "execute",
      nativePayload,
      inert.signature,
      inert.point,
    );
    const nativeHex = bytesToHex(nativeId) as Hex32;
    expectSemantic(sim, nativeDetail, nativePayload, nativeHex, nativeAuthResult(nativeHex));
    expect(await sim.call<any>("accountRecord", nativeId)).toEqual({
      registered: true,
      mode: 0n,
      owner: new Uint8Array(20),
      nextNonce: 0n,
    });

    const evm = await registerEvm(sim, EVM_KEY_A, SALT_A);
    expectSemantic(sim, evm.detail, evm.prepared.payload, evm.action.accountId, evm.prepared.digest);
    expect(await sim.call<any>("accountRecord", bytes(evm.action.accountId))).toEqual({
      registered: true,
      mode: 1n,
      owner: hexToBytes(EVM_OWNER_A, 20),
      nextNonce: 0n,
    });
    expect(sim.ledger.evmOwners.size()).toBe(1n);
    expect(sim.ledger.evmNonces.size()).toBe(1n);
  });

  it("permits one owner to create two independently tracked salted accounts", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const first = await registerEvm(sim, EVM_KEY_A, SALT_A);
    const second = await registerEvm(sim, EVM_KEY_A, SALT_B);
    expect(first.action.accountId).not.toBe(second.action.accountId);
    expect(sim.ledger.accounts.size()).toBe(2n);
    expect(sim.ledger.evmNonces.lookup(bytes(first.action.accountId))).toBe(0n);
    expect(sim.ledger.evmNonces.lookup(bytes(second.action.accountId))).toBe(0n);
  });
});

describe("Manager v5 owner actions through the one gateway", () => {
  it("covers all five EVM actions, committing four and reaching the simulator-only kernel guard for unshielded withdrawal", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const source = (await registerEvm(sim, EVM_KEY_A, SALT_A)).action.accountId;
    const destination = (await registerEvm(sim, EVM_KEY_B, SALT_B)).action.accountId;
    await sim.call("depositShielded", coin(COLOR_A, 20n, 1), bytes(source));
    await sim.call("depositUnshielded", bytes(COLOR_A), 20n, bytes(source));
    const common = { manager: managerAddressHex(sim.address), accountId: source, owner: EVM_OWNER_A, validUntil: DEADLINE };
    await executeEvm(sim, EVM_KEY_A, { ...common, primaryType: "WithdrawShielded", nonce: 0n, color: COLOR_A, amount: 1n, recipientKind: 0n, recipient: RECIPIENT });
    const unshielded = { ...common, primaryType: "WithdrawUnshielded" as const, nonce: 1n, color: COLOR_A, amount: 1n, recipientKind: 1n, recipient: RECIPIENT };
    const unshieldedPrepared = prepareEvmExecute(unshielded, bytesToHex(sim.deploymentDomain) as Hex32, metamaskSign(EVM_KEY_A, unshielded, bytesToHex(sim.deploymentDomain) as Hex32));
    expect(await sim.expectRejectAt(NOW, "execute", unshieldedPrepared.payload, unshieldedPrepared.signature, unshieldedPrepared.point)).toMatch(/contract unshielded balance too low/);
    expect(sim.ledger.evmNonces.lookup(bytes(source))).toBe(1n);
    await executeEvm(sim, EVM_KEY_A, { ...common, primaryType: "TransferInternalShielded", nonce: 1n, toAccountId: destination, color: COLOR_A, amount: 2n });
    await executeEvm(sim, EVM_KEY_A, { ...common, primaryType: "TransferInternalUnshielded", nonce: 2n, toAccountId: destination, color: COLOR_A, amount: 2n });
    await executeEvm(sim, EVM_KEY_A, { ...common, primaryType: "OpenSwapShielded", nonce: 3n, giveColor: COLOR_A, giveAmount: 3n, recipientKind: 1n, recipient: RECIPIENT, wantNonce: `0x${"77".repeat(32)}` as Hex32, wantColor: COLOR_B, wantAmount: 4n, creditAccountId: source });
    expect(sim.ledger.evmNonces.lookup(bytes(source))).toBe(4n);
    expect(await sim.call<bigint>("shieldedAccountBalance", bytes(source), bytes(COLOR_A))).toBe(14n);
    expect(await sim.call<bigint>("unshieldedAccountBalance", bytes(source), bytes(COLOR_A))).toBe(18n);
    expect(await sim.call<bigint>("shieldedAccountBalance", bytes(destination), bytes(COLOR_A))).toBe(2n);
    expect(await sim.call<bigint>("unshieldedAccountBalance", bytes(destination), bytes(COLOR_A))).toBe(2n);
  });

  it("executes all five actions in native mode with no EVM replay state", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const idA = await sim.ownerCommitmentFor(NATIVE_A);
    const idB = await sim.ownerCommitmentFor(NATIVE_B);
    await sim.call("registerAccount", idA);
    await sim.call("registerAccount", idB);
    await sim.call("depositShielded", coin(COLOR_A, 20n, 1), idA);
    await sim.call("depositUnshielded", bytes(COLOR_A), 20n, idA);
    const account = bytesToHex(idA) as Hex32;
    const authResult = nativeAuthResult(account);
    const payloads: ManagerExecutePayload[] = [
      { ...emptyExecutePayload(), selector: 2n, account: idA, primaryColor: bytes(COLOR_A), primaryAmount: 1n, recipientKind: 0n, recipient: bytes(RECIPIENT) },
      { ...emptyExecutePayload(), selector: 3n, account: idA, primaryColor: bytes(COLOR_A), primaryAmount: 1n, recipientKind: 1n, recipient: bytes(RECIPIENT) },
      { ...emptyExecutePayload(), selector: 4n, account: idA, primaryColor: bytes(COLOR_A), primaryAmount: 2n, toAccount: idB },
      { ...emptyExecutePayload(), selector: 5n, account: idA, primaryColor: bytes(COLOR_A), primaryAmount: 2n, toAccount: idB },
      { ...emptyExecutePayload(), selector: 6n, account: idA, primaryColor: bytes(COLOR_A), primaryAmount: 3n, recipientKind: 1n, recipient: bytes(RECIPIENT), wantNonce: new Uint8Array(32).fill(0x88), wantColor: bytes(COLOR_B), wantAmount: 4n, creditAccount: idA },
    ];
    for (const payload of payloads) {
      if (payload.selector === 3n) {
        expect(await sim.expectReject("execute", payload, inert.signature, inert.point)).toMatch(
          /contract unshielded balance too low/,
        );
      } else {
        const detail = await sim.callDetailed("execute", payload, inert.signature, inert.point);
        expectSemantic(sim, detail, payload, account, authResult);
      }
    }
    expect(sim.ledger.evmNonces.size()).toBe(0n);
  });
});

describe("Manager v5 dual-authority transport independence", () => {
  it("keeps one EVM-authorized effect byte-identical across two unused native witnesses", async () => {
    const left = await ManagerSim.create(NATIVE_A);
    const right = await ManagerSim.create(NATIVE_A, left.deploymentDomain, left.address);
    expect(managerAddressHex(left.address)).toBe(managerAddressHex(right.address));
    expect(bytesToHex(left.deploymentDomain)).toBe(bytesToHex(right.deploymentDomain));

    const leftSource = (await registerEvm(left, EVM_KEY_A, SALT_A)).action.accountId;
    const rightSource = (await registerEvm(right, EVM_KEY_A, SALT_A)).action.accountId;
    const leftDestination = (await registerEvm(left, EVM_KEY_B, SALT_B)).action.accountId;
    const rightDestination = (await registerEvm(right, EVM_KEY_B, SALT_B)).action.accountId;
    expect(leftSource).toBe(rightSource);
    expect(leftDestination).toBe(rightDestination);
    await left.call("depositShielded", coin(COLOR_A, 10n, 1), bytes(leftSource));
    await right.call("depositShielded", coin(COLOR_A, 10n, 1), bytes(rightSource));

    const action: Eip712Action = {
      primaryType: "TransferInternalShielded",
      manager: managerAddressHex(left.address),
      accountId: leftSource,
      owner: EVM_OWNER_A,
      nonce: 0n,
      validUntil: DEADLINE,
      toAccountId: leftDestination,
      color: COLOR_A,
      amount: 2n,
    };
    const domain = bytesToHex(left.deploymentDomain) as Hex32;
    const prepared = prepareEvmExecute(action, domain, metamaskSign(EVM_KEY_A, action, domain));
    left.actAs(NATIVE_A);
    right.actAs(NATIVE_B);
    const leftDetail = await left.callDetailedAt(
      NOW,
      "execute",
      prepared.payload,
      prepared.signature,
      prepared.point,
    );
    const rightDetail = await right.callDetailedAt(
      NOW,
      "execute",
      prepared.payload,
      prepared.signature,
      prepared.point,
    );

    expect(snapshotLedger(left.ledger)).toEqual(snapshotLedger(right.ledger));
    expect(leftDetail.inputs).toEqual(rightDetail.inputs);
    expect(leftDetail.outputs).toEqual(rightDetail.outputs);
    expect(leftDetail.effects).toEqual(rightDetail.effects);
    expect(extractManagerSemanticEvents(leftDetail.logEvents as readonly LogEvent[])).toEqual(
      extractManagerSemanticEvents(rightDetail.logEvents as readonly LogEvent[]),
    );
    expect(left.ledger.evmNonces.lookup(bytes(leftSource))).toBe(1n);
    expect(right.ledger.evmNonces.lookup(bytes(rightSource))).toBe(1n);
  });

  it("keeps one native-authorized effect byte-identical across two valid dummy EVM transports", async () => {
    const setupNative = async (sim: ManagerSim) => {
      const source = await sim.ownerCommitmentFor(NATIVE_A);
      const destination = await sim.ownerCommitmentFor(NATIVE_B);
      await sim.call("registerAccount", source);
      await sim.call("registerAccount", destination);
      await sim.call("depositShielded", coin(COLOR_A, 10n, 1), source);
      return { sim, source, destination };
    };
    const leftSim = await ManagerSim.create(NATIVE_A);
    const rightSim = await ManagerSim.create(NATIVE_A, leftSim.deploymentDomain, leftSim.address);
    const left = await setupNative(leftSim);
    const right = await setupNative(rightSim);
    expect(managerAddressHex(left.sim.address)).toBe(managerAddressHex(right.sim.address));
    expect(bytesToHex(left.source)).toBe(bytesToHex(right.source));
    expect(bytesToHex(left.destination)).toBe(bytesToHex(right.destination));

    const dummyAction = registration(KAT_MANAGER, EVM_OWNER_B, SALT_B, KAT_ACTION.validUntil);
    const dummySignature = metamaskSign(EVM_KEY_B, dummyAction, KAT_DEPLOYMENT_DOMAIN);
    const alternateDummy = prepareEvmExecute(dummyAction, KAT_DEPLOYMENT_DOMAIN, dummySignature);
    expect(alternateDummy.signature).not.toEqual(inert.signature);
    expect(alternateDummy.point).not.toEqual(inert.point);

    const payload: ManagerExecutePayload = {
      ...emptyExecutePayload(),
      selector: 4n,
      account: left.source,
      primaryColor: bytes(COLOR_A),
      primaryAmount: 2n,
      toAccount: left.destination,
    };
    const leftDetail = await left.sim.callDetailed(
      "execute",
      payload,
      inert.signature,
      inert.point,
    );
    const rightDetail = await right.sim.callDetailed(
      "execute",
      payload,
      alternateDummy.signature,
      alternateDummy.point,
    );

    expect(snapshotLedger(left.sim.ledger)).toEqual(snapshotLedger(right.sim.ledger));
    expect(leftDetail.inputs).toEqual(rightDetail.inputs);
    expect(leftDetail.outputs).toEqual(rightDetail.outputs);
    expect(leftDetail.effects).toEqual(rightDetail.effects);
    expect(extractManagerSemanticEvents(leftDetail.logEvents as readonly LogEvent[])).toEqual(
      extractManagerSemanticEvents(rightDetail.logEvents as readonly LogEvent[]),
    );
    expect(left.sim.ledger.evmNonces.size()).toBe(0n);
    expect(right.sim.ledger.evmNonces.size()).toBe(0n);
  });
});

describe("Manager v5 EVM refusal matrix is atomic", () => {
  it("rejects unknown envelopes, zero registration fields, and duplicate registration", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const manager = managerAddressHex(sim.address);
    const domain = bytesToHex(sim.deploymentDomain) as Hex32;
    const action = registration(manager, EVM_OWNER_A, SALT_A);
    const prepared = prepareEvmExecute(action, domain, metamaskSign(EVM_KEY_A, action, domain));
    const probes: Array<{ label: string; payload: ManagerExecutePayload }> = [
      { label: "selector", payload: { ...prepared.payload, selector: 7n } },
      { label: "auth mode", payload: { ...prepared.payload, authMode: 2n } },
      { label: "zero owner", payload: { ...prepared.payload, owner: new Uint8Array(20) } },
      { label: "zero salt", payload: { ...prepared.payload, accountSalt: new Uint8Array(32) } },
    ];
    for (const probe of probes) {
      const before = JSON.stringify(snapshotLedger(sim.ledger));
      await sim.expectRejectAt(NOW, "execute", probe.payload, prepared.signature, prepared.point);
      expect(JSON.stringify(snapshotLedger(sim.ledger)), probe.label).toBe(before);
    }

    await sim.callDetailedAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point);
    const afterRegistration = JSON.stringify(snapshotLedger(sim.ledger));
    expect(
      await sim.expectRejectAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point),
    ).toMatch(/already registered|collision/);
    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(afterRegistration);
  });

  it("rejects wrong signer, domain, Manager/account/type/field, and deadline boundaries", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const manager = managerAddressHex(sim.address);
    const domain = bytesToHex(sim.deploymentDomain) as Hex32;
    const base = registration(manager, EVM_OWNER_A, SALT_A);
    const attempts: Array<{ label: string; action: RegisterEvmAccount; signDomain: Hex32; key: Hex32; mutate?: (p: ManagerExecutePayload) => ManagerExecutePayload }> = [
      { label: "signer", action: base, signDomain: domain, key: EVM_KEY_B },
      { label: "domain", action: base, signDomain: `0x${"ee".repeat(32)}` as Hex32, key: EVM_KEY_A },
      { label: "manager", action: registration(`0x${"ab".repeat(32)}` as Hex32, EVM_OWNER_A, SALT_A), signDomain: domain, key: EVM_KEY_A },
      { label: "account", action: base, signDomain: domain, key: EVM_KEY_A, mutate: (p) => ({ ...p, account: new Uint8Array(32).fill(0x99) }) },
      { label: "expired", action: { ...base, validUntil: BigInt(NOW) }, signDomain: domain, key: EVM_KEY_A },
      { label: "future", action: { ...base, validUntil: BigInt(NOW + 3601) }, signDomain: domain, key: EVM_KEY_A },
    ];
    for (const attempt of attempts) {
      const signed = metamaskSign(attempt.key, attempt.action, attempt.signDomain);
      const prepared = prepareEvmExecute(attempt.action, attempt.signDomain, signed);
      const payload = attempt.mutate ? attempt.mutate(prepared.payload) : prepared.payload;
      const before = JSON.stringify(snapshotLedger(sim.ledger));
      await sim.expectRejectAt(NOW, "execute", payload, prepared.signature, prepared.point);
      expect(JSON.stringify(snapshotLedger(sim.ledger)), attempt.label).toBe(before);
    }
  });

  it("rejects stale/future nonce, high-s replay, noncanonical union, malformed scalars, and cross-mode use", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const nativeId = await sim.ownerCommitmentFor(NATIVE_A);
    await sim.call("registerAccount", nativeId);
    const source = (await registerEvm(sim, EVM_KEY_A, SALT_A)).action.accountId;
    const destination = (await registerEvm(sim, EVM_KEY_B, SALT_B)).action.accountId;
    await sim.call("depositShielded", coin(COLOR_A, 10n, 1), bytes(source));
    const common = { manager: managerAddressHex(sim.address), accountId: source, owner: EVM_OWNER_A, validUntil: DEADLINE };
    const action: Eip712Action = { ...common, primaryType: "TransferInternalShielded", nonce: 0n, toAccountId: destination, color: COLOR_A, amount: 1n };
    const domain = bytesToHex(sim.deploymentDomain) as Hex32;
    const lowSignature = metamaskSign(EVM_KEY_A, action, domain);
    const low = prepareEvmExecute(action, domain, lowSignature);
    await sim.callDetailedAt(NOW, "execute", low.payload, low.signature, low.point);
    const afterCommit = JSON.stringify(snapshotLedger(sim.ledger));

    const twin = prepareEvmExecute(action, domain, highSTwin(lowSignature), { requireLowS: false });
    expect(await sim.expectRejectAt(NOW, "execute", twin.payload, twin.signature, twin.point)).toMatch(/nonce mismatch/);
    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(afterCommit);

    const futureAction = { ...action, nonce: 2n };
    const future = prepareEvmExecute(futureAction, domain, metamaskSign(EVM_KEY_A, futureAction, domain));
    expect(await sim.expectRejectAt(NOW, "execute", future.payload, future.signature, future.point)).toMatch(/nonce mismatch/);

    expect(
      await sim.expectRejectAt(
        NOW,
        "execute",
        { ...future.payload, accountSalt: new Uint8Array(32).fill(1) },
        future.signature,
        future.point,
      ),
    ).toMatch(/salt must be inactive/);
    expect(
      await sim.expectRejectAt(
        NOW,
        "execute",
        { ...future.payload, nonce: 1n },
        { r: 0n, s: future.signature.s },
        future.point,
      ),
    ).toMatch(/signature|scalar|range|zero/i);

    const nativeAsEvm = { ...futureAction, accountId: bytesToHex(nativeId) as Hex32, nonce: 0n };
    const nativeAsEvmPrepared = prepareEvmExecute(
      nativeAsEvm,
      domain,
      metamaskSign(EVM_KEY_A, nativeAsEvm, domain),
    );
    expect(
      await sim.expectRejectAt(
        NOW,
        "execute",
        nativeAsEvmPrepared.payload,
        nativeAsEvmPrepared.signature,
        nativeAsEvmPrepared.point,
      ),
    ).toMatch(/mode/);

    const evmAsNative = {
      ...emptyExecutePayload(),
      selector: 4n,
      account: bytes(source),
      primaryColor: bytes(COLOR_A),
      primaryAmount: 1n,
      toAccount: bytes(destination),
    };
    expect(await sim.expectReject("execute", evmAsNative, inert.signature, inert.point)).toMatch(
      /witness|mode|account transcript/,
    );
    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(afterCommit);
  });

  it("rejects wrong type/field, malformed points, and secp scalar boundary probes", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const source = (await registerEvm(sim, EVM_KEY_A, SALT_A)).action.accountId;
    const destination = (await registerEvm(sim, EVM_KEY_B, SALT_B)).action.accountId;
    const manager = managerAddressHex(sim.address);
    const domain = bytesToHex(sim.deploymentDomain) as Hex32;
    const common = {
      manager,
      accountId: source,
      owner: EVM_OWNER_A,
      nonce: 0n,
      validUntil: DEADLINE,
    };
    const withdraw: Eip712Action = {
      ...common,
      primaryType: "WithdrawShielded",
      color: COLOR_A,
      amount: 1n,
      recipientKind: 0n,
      recipient: RECIPIENT,
    };
    const signedWrongType = prepareEvmExecute(
      withdraw,
      domain,
      metamaskSign(EVM_KEY_A, withdraw, domain),
    );
    const wrongTypePayload: ManagerExecutePayload = {
      ...signedWrongType.payload,
      selector: 4n,
      recipientKind: 0n,
      recipient: new Uint8Array(32),
      toAccount: bytes(destination),
    };
    const transfer: Eip712Action = {
      ...common,
      primaryType: "TransferInternalShielded",
      toAccountId: destination,
      color: COLOR_A,
      amount: 1n,
    };
    const valid = prepareEvmExecute(
      transfer,
      domain,
      metamaskSign(EVM_KEY_A, transfer, domain),
    );
    const probes: Array<{ label: string; payload?: ManagerExecutePayload; signature?: any; point?: any }> = [
      { label: "wrong type", payload: wrongTypePayload, signature: signedWrongType.signature, point: signedWrongType.point },
      { label: "wrong field", payload: { ...valid.payload, primaryAmount: 2n } },
      { label: "off-curve point", point: { x: 1n, y: 1n, identity: false } },
      { label: "identity point", point: { x: 0n, y: 0n, identity: true } },
      { label: "zero scalar", signature: { r: 0n, s: valid.signature.s } },
      { label: "curve-order scalar", signature: { r: (1n << 256n) - 1n, s: valid.signature.s } },
      { label: "width-overflow scalar", signature: { r: 1n << 256n, s: valid.signature.s } },
    ];
    for (const probe of probes) {
      const before = JSON.stringify(snapshotLedger(sim.ledger));
      await sim.expectRejectAt(
        NOW,
        "execute",
        probe.payload ?? valid.payload,
        probe.signature ?? valid.signature,
        probe.point ?? valid.point,
      );
      expect(JSON.stringify(snapshotLedger(sim.ledger)), probe.label).toBe(before);
    }
  });

  it("rejects a native action under the wrong witness without changing state", async () => {
    const sim = await ManagerSim.create(NATIVE_A);
    const source = await sim.ownerCommitmentFor(NATIVE_A);
    const destination = await sim.ownerCommitmentFor(NATIVE_B);
    await sim.call("registerAccount", source);
    await sim.call("registerAccount", destination);
    await sim.call("depositShielded", coin(COLOR_A, 5n, 1), source);
    const payload: ManagerExecutePayload = {
      ...emptyExecutePayload(),
      selector: 4n,
      account: source,
      primaryColor: bytes(COLOR_A),
      primaryAmount: 1n,
      toAccount: destination,
    };
    sim.actAs(NATIVE_B);
    const before = JSON.stringify(snapshotLedger(sim.ledger));
    expect(await sim.expectReject("execute", payload, inert.signature, inert.point)).toMatch(
      /witness|account transcript/,
    );
    expect(JSON.stringify(snapshotLedger(sim.ledger))).toBe(before);
  });
});
