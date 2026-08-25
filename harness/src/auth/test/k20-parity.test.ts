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

/**
 * Explicit per-test timeout for THIS file only.
 *
 * Every test here drives TWO compiled Manager artifacts in one CPU-bounded container
 * (`scripts/00010/parity-suite.sh` runs with `--cpus 2`), so vitest's 5 s default was never a
 * meaningful bound: the heaviest case already sat at ~4.2 s of it — 85% of budget — before the
 * 00010-Q3 coverage follow-up added four more tests to the file, at which point four PRE-EXISTING
 * tests began timing out purely on scheduling contention. A timeout is apparatus, not a property
 * under test: raising it weakens no assertion, and pinning it explicitly removes a latent flake
 * that had nothing to do with either contract. Scoped to this file so the other five suites keep
 * the exact bound their recorded results were produced under.
 */
const PARITY_TIMEOUT_MS = 120_000;

const NOW = 1_800_000_000;
const DEADLINE = BigInt(NOW + 600);
const EVM_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318" as Hex32;
const EVM_OWNER = addressForPrivateKey(EVM_KEY);
const NATIVE = secretOf("K20ParityNative");
const NATIVE_B = secretOf("K20ParityNativeB");
/** A witness that is NEVER registered — drives the choke-point ordering probe below. */
const NATIVE_STRANGER = secretOf("K20ParityNativeStranger");
const COLOR_A = `0x${"11".repeat(32)}` as Hex32;
const COLOR_B = `0x${"22".repeat(32)}` as Hex32;
/** A colour that is NEVER deposited, so no pool entry for it ever exists. */
const COLOR_DORMANT = `0x${"33".repeat(32)}` as Hex32;
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
  }, PARITY_TIMEOUT_MS);

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
  }, PARITY_TIMEOUT_MS);

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
  }, PARITY_TIMEOUT_MS);

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
  }, PARITY_TIMEOUT_MS);
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
  }, PARITY_TIMEOUT_MS);

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
  }, PARITY_TIMEOUT_MS);

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
  }, PARITY_TIMEOUT_MS);
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

// ================================================================================================
// 00010-Q3 COVERAGE FOLLOW-UP — the three swap guards that had no DEDICATED negative case
// ================================================================================================
//
// The Q3 wiring verification (`evidence/00010-manager-k19/Q3-WIRING-VERIFICATION.md` §4.3) recorded,
// honestly and on the record, that three of `custodyDispatch`'s swap guards were exercised only in
// the PASSING direction by the three selector-6 parity cases above, with no dedicated negative:
//
//   0a  "swap must give a positive amount"   — `custodyDispatch` line 1023, `assertActionEnvelope` 845
//   3a  "no pooled coin for this colour"     — `custodyDispatch` line 1041
//   3b  "pooled colour balance too low"      — `custodyDispatch` line 1043
//
// This block closes that gap. Everything here follows the same A/B contract as the 13-case negative
// set above: every refusal runs against BOTH the k=19 build and the k=20 reference oracle, the
// message text must be IDENTICAL, and the whole ledger must be byte-identical before and after on
// each build and across builds.
//
// ------------------------------------------------------------------------------------------------
// THE VERDICT ON EACH GUARD, stated up front so no reader has to infer it from the test names:
// ------------------------------------------------------------------------------------------------
//
//   0a — REACHABLE. A zero-give swap is refused, with that exact message. `execute` runs
//        `assertActionEnvelope` before the witness choke point, so line 845 is what fires; line 1023
//        carries the same text, so the refusal SET and its text are identical either way. A real,
//        dedicated negative case now exists for it (first test below), in both the registered and
//        the unregistered-witness form.
//
//   3a / 3b — **UNREACHABLE BY REFUSAL, and that is a defence-in-depth FACT, not a bug.** They can
//        never be the FIRST failing guard on any constructible input, because guard 2 — the
//        per-(account, colour) guard at line 1037 — refuses first in every case. This is the
//        intended FR-204 ordering, and it is *structural*, not incidental:
//
//          For the shielded family the contract maintains, at every write site,
//              pools.lookup(C).value  ==  Σ shieldedBalances cells of colour C
//          and therefore
//              pools.member(C)        <=> that sum > 0
//
//        Every write that RAISES a colour's cell total is paired with a `pools.insertCoin` of the
//        same colour and value (`depositShielded` 655-667; the swap want leg 1111-1131); every debit
//        is paired with `repoolOrRemove` (1094 with 773-780); and `transferInternalShielded` moves
//        value between two cells of one colour without touching the pool at all. So guard 2
//        (`debitBalance >= val`, with `val > 0` already forced by guard 0a) implies
//        `Σ cells of C >= val > 0`, which implies BOTH `pools.member(C)` and `pooled.value >= val`.
//        Only selectors 2 and 6 consult the pool (`needsPool`), and both debit the shielded family,
//        so the invariant covers every path that can reach lines 1041/1043 at all.
//
//        NO FAKE TEST IS WRITTEN FOR 3a/3b. What is written instead is stronger than a contrived
//        refusal would be: two ordering probes that put each pool guard's own predicate into a known
//        state and show that guard 2's message — never the pool guard's — is what comes back, plus a
//        fourth test that asserts the pool-total invariant itself, executed, on both builds. The
//        invariant is the *reason* the guards are shadowed, so pinning it is what would actually
//        catch a future edit that made them reachable.
//
//        This is NOT a coverage regression against the older suites. `harness/src/test/swap.test.ts`
//        (v3/v4 surface) never reached them either — its case at :435 says so verbatim, and asserts
//        the guard ORDER instead — and `harness/src/test/g5-variants.test.ts` :99-110 asserts
//        `not.toContain('pooled colour balance')` / `not.toContain('no pooled coin')` for the same
//        reason. There was no mechanism to port, because none ever existed.

/** Read one (account, colour) shielded cell straight out of a build's ledger; missing reads 0. */
function shieldedCell(pure: any, ledger: any, account: Uint8Array, colour: Hex32): bigint {
  const key = pure.shieldedKey(account, bytes(colour));
  return ledger.shieldedBalances.member(key) ? BigInt(ledger.shieldedBalances.lookup(key)) : 0n;
}

const poolHas = (ledger: any, colour: Hex32): boolean => ledger.pools.member(bytes(colour));
const poolAmount = (ledger: any, colour: Hex32): bigint =>
  ledger.pools.member(bytes(colour)) ? BigInt(ledger.pools.lookup(bytes(colour)).value) : 0n;

/**
 * Drive one refused `execute` on BOTH builds and return the (identical) message.
 *
 * Same contract as the 13-case negative set: identical text, state-neutral on each build, and the
 * two builds' states still equal afterwards. `expectReject` itself already fails if state moved;
 * the explicit snapshots pin the bytes.
 */
async function expectSameRefusal(
  label: string,
  k19: ManagerSim,
  k20: ManagerSim,
  payload: ManagerExecutePayload,
): Promise<string> {
  const before19 = JSON.stringify(snapshotLedger(k19.ledger));
  const before20 = JSON.stringify(snapshotLedger(k20.ledger));
  const left = await k19.expectReject("execute", payload, inert.signature, inert.point);
  const right = await k20.expectReject("execute", payload, inert.signature, inert.point);
  expect(left, `${label} refusal message`).toBe(right);
  expect(JSON.stringify(snapshotLedger(k19.ledger)), `${label} k19 neutrality`).toBe(before19);
  expect(JSON.stringify(snapshotLedger(k20.ledger)), `${label} k20 neutrality`).toBe(before20);
  expect(snapshotLedger(k19.ledger), `${label} cross-build state`).toEqual(
    snapshotLedger(k20.ledger),
  );
  return left;
}

/** Both builds, both accounts registered, nothing deposited yet. */
async function registeredPair(): Promise<{
  k19: ManagerSim;
  k20: ManagerSim;
  account: Uint8Array;
  destination: Uint8Array;
}> {
  const { k19, k20 } = await pair();
  const account = await k19.ownerCommitmentFor(NATIVE);
  const destination = await k19.ownerCommitmentFor(NATIVE_B);
  await k20.ownerCommitmentFor(NATIVE);
  await k20.ownerCommitmentFor(NATIVE_B);
  for (const sim of [k19, k20]) {
    await sim.call("registerAccount", account);
    await sim.call("registerAccount", destination);
  }
  expect(snapshotLedger(k19.ledger)).toEqual(snapshotLedger(k20.ledger));
  return { k19, k20, account, destination };
}

describe("k20 parity — the three swap guards flagged by 00010-Q3", () => {
  it("guard 0a — refuses a swap that gives ZERO, and parameter sanity still precedes the witness choke point", async () => {
    const { k19, k20, account, destination } = await registeredPair();
    for (const sim of [k19, k20]) {
      await sim.call("depositShielded", coin(COLOR_A, 10n, 1), account);
    }

    const base = emptyExecutePayload();
    const zeroGive: ManagerExecutePayload = {
      ...base,
      selector: 6n,
      account,
      primaryColor: bytes(COLOR_A),
      primaryAmount: 0n,
      recipientKind: 0n,
      wantNonce: new Uint8Array(32).fill(0x51),
      wantColor: bytes(COLOR_B),
      wantAmount: 1n,
      creditAccount: destination,
    };

    // The dedicated negative for guard 0a, with a fully authorized, fully funded maker: the ONLY
    // thing wrong with this action is the zero give.
    const refusal = await expectSameRefusal("NC — swap giving zero", k19, k20, zeroGive);
    expect(refusal, "guard 0a message").toContain("swap must give a positive amount");
    // It must NOT be mistaken for any neighbouring guard.
    expect(refusal).not.toContain("swap must want a positive amount");
    expect(refusal).not.toContain("account colour balance too low");
    // Everything else about this maker was fine — so the refusal is attributable to 0a alone.
    expect(shieldedCell(k19Pure, k19.ledger, account, COLOR_A)).toBe(10n);
    expect(poolAmount(k19.ledger, COLOR_A)).toBe(10n);

    // ORDERING PROBE, ported from `harness/src/test/swap.test.ts:479` ("parameter sanity precedes
    // the choke point"). `execute` runs `assertActionEnvelope` BEFORE `gatewayAccount`, so a
    // zero-give from an UNREGISTERED witness reports the zero, not the authorization. That order is
    // deliberate: guard 0a is pure arithmetic on the caller's own arguments, reads no state, and can
    // therefore leak nothing about registration or balances. Pinned here so a future edit cannot
    // silently move a state-reading guard ahead of the witness choke point.
    k19.actAs(NATIVE_STRANGER);
    k20.actAs(NATIVE_STRANGER);
    const stranger = await expectSameRefusal(
      "NC — swap giving zero from an unregistered witness",
      k19,
      k20,
      zeroGive,
    );
    expect(stranger, "guard 0a still precedes the choke point").toContain(
      "swap must give a positive amount",
    );
    expect(stranger).not.toContain("owner witness matches no registered account");

    // Control, so the probe above is not vacuous: the SAME unregistered witness with a valid give
    // really does die at the choke point. Guard 0a is what moved the answer, not the witness.
    const validGive: ManagerExecutePayload = { ...zeroGive, primaryAmount: 1n };
    const chokePoint = await expectSameRefusal(
      "NC — control: unregistered witness with a valid give",
      k19,
      k20,
      validGive,
    );
    expect(chokePoint).toContain("caller's owner witness matches no registered account");
  }, PARITY_TIMEOUT_MS);

  it("guard 3a is UNREACHABLE by refusal — a swap in a colour with NO pool dies at the account guard instead", async () => {
    // COLOR_DORMANT was never deposited, so `pools.member(COLOR_DORMANT)` is FALSE: guard 3a's own
    // predicate is in the failing state. Its message must still never appear, because guard 2 reads
    // the missing (account, COLOR_DORMANT) cell as 0 and refuses first (FR-204 / FR-206).
    const { k19, k20, account, destination } = await registeredPair();
    for (const sim of [k19, k20]) {
      await sim.call("depositShielded", coin(COLOR_A, 10n, 2), account);
    }
    for (const sim of [k19, k20]) {
      expect(poolHas(sim.ledger, COLOR_DORMANT), "3a predicate is in the FAILING state").toBe(false);
    }

    const refusal = await expectSameRefusal("NC — swap giving a colour with no pool", k19, k20, {
      ...emptyExecutePayload(),
      selector: 6n,
      account,
      primaryColor: bytes(COLOR_DORMANT),
      primaryAmount: 1n,
      recipientKind: 0n,
      wantNonce: new Uint8Array(32).fill(0x52),
      wantColor: bytes(COLOR_B),
      wantAmount: 1n,
      creditAccount: destination,
    });

    expect(refusal, "guard 2 refuses first").toContain("account colour balance too low");
    expect(refusal, "guard 3a is shadowed").not.toContain("no pooled coin for this colour");
    expect(refusal).not.toContain("pooled colour balance too low");

    // ...and the refusal CREATED nothing — no lazily materialised pool entry, no empty cell.
    for (const [sim, pure] of [
      [k19, k19Pure],
      [k20, k20Pure],
    ] as const) {
      expect(poolHas(sim.ledger, COLOR_DORMANT)).toBe(false);
      const key = (pure as any).shieldedKey(account, bytes(COLOR_DORMANT));
      expect(sim.ledger.shieldedBalances.member(key)).toBe(false);
    }
  }, PARITY_TIMEOUT_MS);

  it("guard 3b is UNREACHABLE by refusal — a RICH pool cannot rescue a short account cell, and never reports itself", async () => {
    // Ported from `harness/src/test/swap.test.ts:379` (NC-306) and
    // `harness/src/test/g5-variants.test.ts:99`, onto the v5 `execute` surface.
    //
    // The maker holds 2 of COLOR_A; a second account holds 100 more of the SAME colour, so the pool
    // holds 102 — comfortably more than the 5 the maker asks to give. BOTH pool guards would
    // therefore PASS if they were reached. Only the per-(account, colour) guard can refuse this, and
    // it must, before either pool guard is consulted.
    const { k19, k20, account, destination } = await registeredPair();
    for (const sim of [k19, k20]) {
      await sim.call("depositShielded", coin(COLOR_A, 100n, 3), account);
      await sim.call("depositShielded", coin(COLOR_A, 2n, 4), destination);
    }

    for (const [sim, pure] of [
      [k19, k19Pure],
      [k20, k20Pure],
    ] as const) {
      // Guard 3a's predicate: PASSES. Guard 3b's predicate at val=5: PASSES.
      expect(poolHas(sim.ledger, COLOR_A), "3a predicate would PASS").toBe(true);
      expect(poolAmount(sim.ledger, COLOR_A), "3b predicate would PASS").toBe(102n);
      // Guard 2's predicate: FAILS. This is the only thing wrong with the action.
      expect(shieldedCell(pure, sim.ledger, destination, COLOR_A)).toBe(2n);
    }

    k19.actAs(NATIVE_B);
    k20.actAs(NATIVE_B);
    const refusal = await expectSameRefusal(
      "NC — swap from a short cell while the pool is rich",
      k19,
      k20,
      {
        ...emptyExecutePayload(),
        selector: 6n,
        account: destination,
        primaryColor: bytes(COLOR_A),
        primaryAmount: 5n,
        recipientKind: 0n,
        wantNonce: new Uint8Array(32).fill(0x53),
        wantColor: bytes(COLOR_B),
        wantAmount: 1n,
        creditAccount: account,
      },
    );

    expect(refusal, "guard 2 refuses first").toContain("account colour balance too low");
    expect(refusal, "guard 3b is shadowed").not.toContain("pooled colour balance too low");
    expect(refusal).not.toContain("no pooled coin for this colour");

    // The other account's funds are untouched, and the pool is still rich — the refusal came from
    // the maker's OWN cell, which is the FR-204 property this probe exists to pin.
    for (const [sim, pure] of [
      [k19, k19Pure],
      [k20, k20Pure],
    ] as const) {
      expect(poolAmount(sim.ledger, COLOR_A)).toBe(102n);
      expect(shieldedCell(pure, sim.ledger, account, COLOR_A)).toBe(100n);
    }
  }, PARITY_TIMEOUT_MS);

  it("the pool-total invariant that SHADOWS guards 3a/3b holds through every shielded action, on both builds", async () => {
    // This is the load-bearing test behind the two "unreachable" verdicts above. The guards are
    // unreachable because `pools.lookup(C).value == Σ shieldedBalances cells of colour C` for every
    // colour, at all times — which makes guard 2 strictly stronger than both of them. Asserting the
    // invariant, executed, is what would catch a future edit that broke the pairing and made 3a/3b
    // reachable (at which point they would need real negatives, and this test would say so by
    // failing).
    const { k19, k20, account, destination } = await registeredPair();

    const holders = [account, destination];
    const colours: Hex32[] = [COLOR_A, COLOR_B];

    const checkInvariant = (label: string): void => {
      for (const [sim, pure] of [
        [k19, k19Pure],
        [k20, k20Pure],
      ] as const) {
        for (const colour of colours) {
          const cellSum = holders.reduce(
            (total, holder) => total + shieldedCell(pure, sim.ledger, holder, colour),
            0n,
          );
          expect(poolAmount(sim.ledger, colour), `${label} pool==Σcells for ${colour}`).toBe(
            cellSum,
          );
          expect(poolHas(sim.ledger, colour), `${label} member(C) <=> Σcells>0 for ${colour}`).toBe(
            cellSum > 0n,
          );
        }
      }
      // The sum is EXHAUSTIVE: no shielded cell exists outside the (holder, colour) grid above, so
      // "Σ over the holders we know" is genuinely "Σ over the colour". The two builds agree on
      // `shieldedKey` — asserted by "agrees on the shielded/unshielded key domains" earlier in this
      // file — so one build's key set is the right yardstick for both ledgers.
      const known = new Set<string>();
      for (const holder of holders) {
        for (const colour of colours) {
          known.add(bytesToHex((k19Pure as any).shieldedKey(holder, bytes(colour))));
        }
      }
      for (const sim of [k19, k20]) {
        for (const [key] of sim.ledger.shieldedBalances) {
          expect(known.has(bytesToHex(key)), `${label} unaccounted shielded cell`).toBe(true);
        }
      }
      expect(snapshotLedger(k19.ledger), `${label} cross-build state`).toEqual(
        snapshotLedger(k20.ledger),
      );
    };

    checkInvariant("empty");

    for (const sim of [k19, k20]) {
      await sim.call("depositShielded", coin(COLOR_A, 100n, 5), account);
      await sim.call("depositShielded", coin(COLOR_B, 100n, 6), account);
    }
    checkInvariant("after deposits");

    const base = emptyExecutePayload();
    const steps: { label: string; payload: ManagerExecutePayload }[] = [
      {
        // Debit + `repoolOrRemove`: the pool falls by exactly what the cell falls by.
        label: "after selector 2 (withdrawShielded)",
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
        // Cell-to-cell inside one colour: the pool must NOT move.
        label: "after selector 4 (transferInternalShielded)",
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
        // Both legs at once: give leg drops COLOR_A's pool and cell by 8; want leg raises COLOR_B's
        // pool and the credited cell by 9.
        label: "after selector 6 (openSwapShielded, OPEN)",
        payload: {
          ...base,
          selector: 6n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 8n,
          recipientKind: 0n,
          wantNonce: new Uint8Array(32).fill(0x54),
          wantColor: bytes(COLOR_B),
          wantAmount: 9n,
          creditAccount: destination,
        },
      },
    ];

    for (const step of steps) {
      const left = await k19.callDetailed("execute", step.payload, inert.signature, inert.point);
      const right = await k20.callDetailed("execute", step.payload, inert.signature, inert.point);
      expectSameEffects(step.label, left, right, k19, k20);
      checkInvariant(step.label);
    }

    // The arithmetic, spelled out, so a silent change of the sequence cannot leave the invariant
    // trivially true: COLOR_A 100 − 3 − 8 = 89 pooled, split 83 / 6 between the two cells;
    // COLOR_B 100 + 9 = 109 pooled, split 100 / 9.
    expect(poolAmount(k19.ledger, COLOR_A)).toBe(89n);
    expect(shieldedCell(k19Pure, k19.ledger, account, COLOR_A)).toBe(83n);
    expect(shieldedCell(k19Pure, k19.ledger, destination, COLOR_A)).toBe(6n);
    expect(poolAmount(k19.ledger, COLOR_B)).toBe(109n);
    expect(shieldedCell(k19Pure, k19.ledger, account, COLOR_B)).toBe(100n);
    expect(shieldedCell(k19Pure, k19.ledger, destination, COLOR_B)).toBe(9n);

    // With the invariant holding, guard 2 (`cell >= val`, `val > 0`) implies BOTH pool predicates:
    // `Σ cells of C >= val > 0` gives `pools.member(C)` and `pooled.value >= val`. That is the whole
    // reason lines 1041 and 1043 can never be the first failing guard.
    for (const colour of colours) {
      for (const holder of holders) {
        const cell = shieldedCell(k19Pure, k19.ledger, holder, colour);
        if (cell > 0n) {
          expect(poolHas(k19.ledger, colour), "guard 3a's predicate is implied by guard 2").toBe(
            true,
          );
          expect(
            poolAmount(k19.ledger, colour) >= cell,
            "guard 3b's predicate is implied by guard 2",
          ).toBe(true);
        }
      }
    }
  }, PARITY_TIMEOUT_MS);
});
