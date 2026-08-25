// 00010 — EXECUTED byte-parity of the k=19 Manager against the REAL k=20 Manager artifact.
//
// FR-1003 and FR-1004 require the EIP-712 byte surface and the custody semantics to be identical to
// the k=20 product, "proven by executed KATs, not source inspection". This suite is that proof: it
// loads BOTH compiled contracts in the same process and drives them with identical inputs.
//
//   generated/manager      the k=19 Manager under test (e1 + o2 + Tier-3)
//   generated/manager-k20  the unmodified k=20 product, compiled from the base commit
//
// TWO differences are expected and intended, and BOTH are asserted precisely rather than waved
// through:
//
//   1. The Tier-3 amendment: the k=20 Manager emits the FR-031 semantic `Misc` event and the k=19
//      Manager emits nothing. The test shows the emitted value is exactly what that build's own
//      proved transcript recomputes to, so nothing is lost by removing the event.
//
//   2. The domain-separator rename: the k=19 Manager's three tags were renamed to the
//      `aa:manager:*` scheme, so native account ids and (account, colour) storage keys legitimately
//      differ between the builds. See "THE DOMAIN-SEPARATOR RENAME" below for exactly what changed,
//      what did NOT, and what replaced the three assertions that used to compare those values.

import { describe, expect, it } from "vitest";

import {
  CompactTypeBytes,
  CompactTypeVector,
  persistentCommit,
  persistentHash,
} from "@midnight-ntwrk/compact-runtime";
import type { LogEvent } from "@midnight-ntwrk/midnight-js-contracts";

// @ts-ignore — generated artifact
import {
  Contract as K19Contract,
  ledger as k19Ledger,
  pureCircuits as k19Pure,
} from "../generated/manager/contract/index.js";
// @ts-ignore — generated artifact (the k=20 reference oracle, mounted by parity-suite.sh)
import {
  Contract as K20Contract,
  ledger as k20Ledger,
  pureCircuits as k20Pure,
} from "../generated/manager-k20/contract/index.js";

import { bytesToHex, hexToBytes, utf8, type Hex32 } from "../lib/bytes.js";
import { computeDigest } from "../lib/codec.js";
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
} from "../lib/manager.js";
import { metamaskSign } from "../lib/metamask.js";
import type { Eip712Action } from "../lib/schema.js";
import { addressForPrivateKey } from "../lib/signature.js";
import { nativeAuthResult } from "../lib/semantic.js";
import {
  ManagerSim,
  hex,
  pad32,
  secretOf,
  snapshotLedger,
  type ManagerBuild,
  type CallDetail,
} from "../lib/sim.js";

const K19: ManagerBuild = { Contract: K19Contract, ledger: k19Ledger };
const K20: ManagerBuild = { Contract: K20Contract, ledger: k20Ledger };

/**
 * Explicit per-test timeout for THIS file only.
 *
 * Every test here drives TWO compiled Manager artifacts in one CPU-bounded container
 * (`scripts/test-sim.sh` runs with `--cpus 2`), so vitest's 5 s default was never a
 * meaningful bound: the heaviest case already sat at ~4.2 s of it — 85% of budget — before a later
 * coverage follow-up added four more tests to the file, at which point four PRE-EXISTING
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

// ================================================================================================
// THE DOMAIN-SEPARATOR RENAME — what changed, what did not, and what replaced the old assertions
// ================================================================================================
//
// The k=19 Manager's three domain separators were renamed:
//
//   ownerCommitment       "aa00005:manager:owner"       ->  "aa:manager:owner:v1.0"
//   shieldedFamilyTag     "aa00005:manager:shielded"    ->  "aa:manager:shielded:v1"
//   unshieldedFamilyTag   "aa00005:manager:unshielded"  ->  "aa:manager:unshielded:v1"
//
// The k=20 reference oracle still carries the OLD tags: it is a frozen artifact compiled from the
// base commit and is never recompiled. So exactly three families of value now legitimately differ
// between the two builds — native account ids (`ownerCommitment`), shielded cell keys
// (`shieldedKey`) and unshielded cell keys (`unshieldedKey`).
//
// EVERYTHING ELSE STILL MATCHES BYTE FOR BYTE, and is still asserted to: the EIP-712 domain
// separator, struct hash, digest and EVM account id (keccak over frozen type hashes — no Manager tag
// participates), the semantic-commitment recipe, every refusal message, every zswap nullifier and
// commitment (they use the UNTOUCHED `midnight:zswap-cc[v1]` / `midnight:zswap-cn[v1]` separators,
// so their continued equality is also the proof that the rename did not spill into them), and every
// balance, pool value and map size.
//
// THE SUITE IS NOT WEAKENED TO ACCOMMODATE THIS. Two mechanisms replace the three removed
// equalities, and both are stronger than what they replace:
//
//   A. INDEPENDENT RECOMPUTATION — not "the other build agrees", but "this is the right value".
//      The three k=19 derivations are checked against a TypeScript recomputation built from the NEW
//      TAG STRINGS through the pinned runtime's own `persistentHash` / `persistentCommit`. The old
//      assertion could only say the two artifacts agreed; this one pins the compiled artifact to the
//      exact bytes of the tags the source declares, and would fail on a typo that both builds shared.
//
//   B. LABEL-NORMALISED STATE COMPARISON — ledger snapshots are compared after rewriting each
//      build's OWN derived ids and storage keys to build-independent labels (`<account:NATIVE>`,
//      `<shieldedKey:NATIVE/A>`). A derived value the alias map does not know stays raw hex and
//      therefore still fails the comparison: normalisation renames what is known-derived, it never
//      hides a difference. Balances, pool contents, map sizes and everything else are untouched.

/** The NEW separators, byte for byte, exactly as `contracts/manager.compact` declares them. */
const OWNER_TAG = utf8("aa:manager:owner:v1.0");
const SHIELDED_TAG = pad32("aa:manager:shielded:v1");
const UNSHIELDED_TAG = pad32("aa:manager:unshielded:v1");

const BYTES_21 = new CompactTypeBytes(21);
const BYTES_32 = new CompactTypeBytes(32);
const VECTOR_3_BYTES_32 = new CompactTypeVector(3, BYTES_32);

/** `persistentCommit<Bytes<21>>(OWNER_TAG, sk)`, recomputed off-circuit from the tag string. */
const ownerCommitmentIndependently = (secret: Uint8Array): Uint8Array =>
  persistentCommit(BYTES_21, OWNER_TAG, secret) as Uint8Array;

/** `persistentHash<Vector<3, Bytes<32>>>([acct, colour, tag])`, recomputed off-circuit. */
const familyKeyIndependently = (
  acct: Uint8Array,
  colour: Uint8Array,
  tag: Uint8Array,
): Uint8Array => persistentHash(VECTOR_3_BYTES_32, [acct, colour, tag]) as Uint8Array;

/** Every colour that can appear as a storage-key component anywhere in this file. */
const ALIAS_COLOURS: { label: string; hex: Hex32 }[] = [
  { label: "A", hex: COLOR_A },
  { label: "B", hex: COLOR_B },
  { label: "DORMANT", hex: COLOR_DORMANT },
];

/**
 * Teach one build's alias map every value derivable from one account id: the id itself and its
 * shielded/unshielded cell key in each colour. Anything NOT taught stays raw hex in the normalised
 * snapshot, so an unexpected derived key still shows up as a difference.
 */
function aliasAccount(
  alias: Map<string, string>,
  pure: any,
  label: string,
  id: Uint8Array,
): void {
  alias.set(hex(id), `<account:${label}>`);
  for (const colour of ALIAS_COLOURS) {
    alias.set(
      hex(pure.shieldedKey(id, bytes(colour.hex))),
      `<shieldedKey:${label}/${colour.label}>`,
    );
    alias.set(
      hex(pure.unshieldedKey(id, bytes(colour.hex))),
      `<unshieldedKey:${label}/${colour.label}>`,
    );
  }
}

/** Rewrite a ledger snapshot's build-specific derived values to build-independent labels. */
function normalise(snapshot: unknown, alias: Map<string, string>): unknown {
  const rename = (value: string): string => alias.get(value) ?? value;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        out[rename(key)] = walk(value);
      }
      return out;
    }
    return typeof node === "string" ? rename(node) : node;
  };
  const out = walk(snapshot) as Record<string, unknown>;
  // `accounts` is sorted on RAW hex, so two builds can list the same accounts in different orders
  // for no reason but the derivation. Re-sort AFTER aliasing so the comparison is about membership.
  if (Array.isArray(out.accounts)) out.accounts = [...(out.accounts as string[])].sort();
  return out;
}

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

  it("derives the RENAMED key domains correctly — independently recomputed, no longer equal to k20 — while the zswap transcriptions stay byte-identical", () => {
    const account = bytes(`0x${"3c".repeat(32)}` as Hex32);
    const colour = bytes(COLOR_A);

    // RE-POINTED ASSERTION 1 (was: k19 shieldedKey == k20 shieldedKey).
    // The tags declare their own lengths: the owner tag is the `persistentCommit<Bytes<21>>` type
    // parameter and must be EXACTLY 21 bytes, and the family tags live inside `pad(32, …)`.
    expect(OWNER_TAG.length, "the owner tag must be exactly 21 bytes").toBe(21);
    expect(SHIELDED_TAG.length).toBe(32);
    expect(UNSHIELDED_TAG.length).toBe(32);

    // The compiled artifact is pinned to the exact bytes of the tags the SOURCE declares, by
    // recomputing the derivation off-circuit through the pinned runtime's own hash primitives.
    // This is strictly stronger than the old "the two builds agree": it says which value is right.
    expect(
      bytesToHex((k19Pure as any).shieldedKey(account, colour)),
      "shieldedKey vs independent recomputation from the declared tag",
    ).toBe(bytesToHex(familyKeyIndependently(account, colour, SHIELDED_TAG)));
    expect(
      bytesToHex((k19Pure as any).unshieldedKey(account, colour)),
      "unshieldedKey vs independent recomputation from the declared tag",
    ).toBe(bytesToHex(familyKeyIndependently(account, colour, UNSHIELDED_TAG)));

    // …and the OLD tags are demonstrably gone: the k=20 oracle, which still carries them, is what
    // the recomputation with the old bytes reproduces. So the rename is asserted from both sides,
    // and neither half of this test can pass vacuously.
    expect(bytesToHex((k19Pure as any).shieldedKey(account, colour))).not.toBe(
      bytesToHex((k20Pure as any).shieldedKey(account, colour)),
    );
    expect(bytesToHex((k19Pure as any).unshieldedKey(account, colour))).not.toBe(
      bytesToHex((k20Pure as any).unshieldedKey(account, colour)),
    );
    expect(
      bytesToHex((k20Pure as any).shieldedKey(account, colour)),
      "the k=20 oracle still derives from the OLD tag",
    ).toBe(bytesToHex(familyKeyIndependently(account, colour, pad32("aa00005:manager:shielded"))));
    expect(
      bytesToHex((k20Pure as any).unshieldedKey(account, colour)),
      "the k=20 oracle still derives from the OLD tag",
    ).toBe(bytesToHex(familyKeyIndependently(account, colour, pad32("aa00005:manager:unshielded"))));

    // KEPT UNCHANGED — the security property the family tags exist for: the two families must not
    // alias, on both builds. A rename that accidentally made the two tags equal would pass every
    // assertion above and fail here.
    expect(bytesToHex((k19Pure as any).shieldedKey(account, colour))).not.toBe(
      bytesToHex((k19Pure as any).unshieldedKey(account, colour)),
    );
    expect(bytesToHex((k20Pure as any).shieldedKey(account, colour))).not.toBe(
      bytesToHex((k20Pure as any).unshieldedKey(account, colour)),
    );
    // Injective in both arguments, so no two (account, colour) pairs can share a cell.
    const other = bytes(`0x${"3d".repeat(32)}` as Hex32);
    expect(bytesToHex((k19Pure as any).shieldedKey(other, colour))).not.toBe(
      bytesToHex((k19Pure as any).shieldedKey(account, colour)),
    );
    expect(bytesToHex((k19Pure as any).shieldedKey(account, bytes(COLOR_B)))).not.toBe(
      bytesToHex((k19Pure as any).shieldedKey(account, colour)),
    );

    // UNCHANGED AND LOAD-BEARING: the zswap separators were deliberately NOT renamed — they mirror
    // the standard library's own coin-commitment and nullifier preimages. Their continued
    // byte-equality with the k=20 oracle is the executed proof that the rename did not spill into
    // them.
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

/** The native account ids ONE build derives for the two owner secrets this file uses. */
type NativeIds = { account: Uint8Array; destination: Uint8Array };

/**
 * The two builds side by side, each with its OWN native ids and its own alias map.
 *
 * Every native action must be sent to each build with THAT BUILD'S ids: `execute` derives the
 * account from the owner witness and then asserts it equals `p.account` from the transcript
 * (`authenticatedActionAccount`), so a payload carrying the other build's id would be refused at the
 * choke point rather than executed. The action itself — selector, colours, amounts, recipients,
 * nonces — is identical.
 */
type Pair = {
  k19: ManagerSim;
  k20: ManagerSim;
  ids: { k19: NativeIds; k20: NativeIds };
  alias: { k19: Map<string, string>; k20: Map<string, string> };
};

/** Run one `execute` on both builds and require every observable effect to match. */
function expectSameEffects(
  label: string,
  k19: CallDetail<unknown>,
  k20: CallDetail<unknown>,
  p: Pair,
): void {
  expect(normalise(snapshotLedger(p.k19.ledger), p.alias.k19), `${label} ledger`).toEqual(
    normalise(snapshotLedger(p.k20.ledger), p.alias.k20),
  );
  // Zswap structure and effects are compared RAW — no normalisation — because nothing in them is
  // derived from a renamed tag: nonces, colours, values, recipients, nullifiers and commitments all
  // come from the untouched `midnight:zswap-*` separators and the caller's own arguments.
  expect(k19.inputs, `${label} zswap inputs`).toEqual(k20.inputs);
  expect(k19.outputs, `${label} zswap outputs`).toEqual(k20.outputs);
  expect(k19.effects, `${label} zswap effects`).toEqual(k20.effects);
}

/** Ledger equality across builds, label-normalised. Used where no call detail is in hand. */
function expectSameState(label: string, p: Pair): void {
  expect(normalise(snapshotLedger(p.k19.ledger), p.alias.k19), `${label} cross-build state`).toEqual(
    normalise(snapshotLedger(p.k20.ledger), p.alias.k20),
  );
}

/** Send the SAME logical action to both builds, each rendered with that build's own account ids. */
async function callBoth(
  p: Pair,
  label: string,
  payload: (ids: NativeIds) => ManagerExecutePayload,
): Promise<{ left: CallDetail<unknown>; right: CallDetail<unknown> }> {
  const left = await p.k19.callDetailed("execute", payload(p.ids.k19), inert.signature, inert.point);
  const right = await p.k20.callDetailed(
    "execute",
    payload(p.ids.k20),
    inert.signature,
    inert.point,
  );
  expectSameEffects(label, left, right, p);
  return { left, right };
}

async function pair(): Promise<Pair> {
  const k19 = await ManagerSim.create(NATIVE, undefined, undefined, K19);
  // Same deployment domain AND same contract address, so every address-bound derivation matches.
  const k20 = await ManagerSim.create(NATIVE, k19.deploymentDomain, k19.address, K20);
  expect(managerAddressHex(k19.address)).toBe(managerAddressHex(k20.address));

  // Each build derives its own ids from the SAME two owner secrets. `ownerCommitmentFor` is also
  // what teaches each sim the witness behind its own ids, which the native registration adapter
  // needs, so both builds must be asked — neither can be handed the other's answer.
  const idsK19: NativeIds = {
    account: await k19.ownerCommitmentFor(NATIVE),
    destination: await k19.ownerCommitmentFor(NATIVE_B),
  };
  const idsK20: NativeIds = {
    account: await k20.ownerCommitmentFor(NATIVE),
    destination: await k20.ownerCommitmentFor(NATIVE_B),
  };

  // RE-POINTED ASSERTION 2 (was: k19 ownerCommitmentFor == k20 ownerCommitmentFor).
  // The rename really took effect — if these ever coincided, every label normalisation below would
  // be silently vacuous — and each build's id is the INDEPENDENTLY recomputed value for its own tag.
  expect(hex(idsK19.account), "the rename changed the native account id").not.toBe(
    hex(idsK20.account),
  );
  expect(hex(idsK19.destination)).not.toBe(hex(idsK20.destination));
  expect(hex(idsK19.account), "k19 native id vs independent recomputation").toBe(
    hex(ownerCommitmentIndependently(NATIVE)),
  );
  expect(hex(idsK19.destination), "k19 native id vs independent recomputation").toBe(
    hex(ownerCommitmentIndependently(NATIVE_B)),
  );
  // Distinct secrets still give distinct accounts, on both builds.
  expect(hex(idsK19.account)).not.toBe(hex(idsK19.destination));
  expect(hex(idsK20.account)).not.toBe(hex(idsK20.destination));

  const alias = { k19: new Map<string, string>(), k20: new Map<string, string>() };
  aliasAccount(alias.k19, k19Pure, "NATIVE", idsK19.account);
  aliasAccount(alias.k19, k19Pure, "NATIVE_B", idsK19.destination);
  aliasAccount(alias.k20, k20Pure, "NATIVE", idsK20.account);
  aliasAccount(alias.k20, k20Pure, "NATIVE_B", idsK20.destination);
  return { k19, k20, ids: { k19: idsK19, k20: idsK20 }, alias };
}

/** Both builds, both native accounts registered and the same funding applied to each. */
async function fundedPair(
  fund: (sim: ManagerSim, ids: NativeIds) => Promise<void>,
): Promise<Pair> {
  const p = await pair();
  for (const [sim, ids] of [
    [p.k19, p.ids.k19],
    [p.k20, p.ids.k20],
  ] as const) {
    await sim.call("registerAccount", ids.account);
    await sim.call("registerAccount", ids.destination);
    await fund(sim, ids);
  }
  expectSameState("after registration and funding", p);
  return p;
}

describe("k20 parity — custody effects are identical, action by action", () => {
  it("registers, deposits and runs all five custody actions with identical state and zswap shape", async () => {
    const p = await fundedPair(async (sim, ids) => {
      await sim.call("depositShielded", coin(COLOR_A, 100n, 1), ids.account);
      await sim.call("depositShielded", coin(COLOR_B, 100n, 2), ids.account);
      await sim.call("depositUnshielded", bytes(COLOR_A), 100n, ids.account);
    });
    const { k19, k20 } = p;

    const base = emptyExecutePayload();
    const cases: { label: string; payload: (ids: NativeIds) => ManagerExecutePayload }[] = [
      {
        label: "selector 2 — withdrawShielded, recipientKind 0 (user key)",
        payload: ({ account }) => ({
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 3n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        }),
      },
      {
        label: "selector 2 — withdrawShielded, recipientKind 1 (contract)",
        payload: ({ account }) => ({
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 4n,
          recipientKind: 1n,
          recipient: bytes(RECIPIENT),
        }),
      },
      // NOTE: selector 3 (withdrawUnshielded) is NOT a success case here. The simulator cannot fund
      // the CONTRACT's own kernel unshielded holdings, so the leg always hits "contract unshielded
      // balance too low" — identically on both builds. It is covered as an identical-refusal case
      // in the negative suite below, which is where it belongs.
      {
        label: "selector 4 — transferInternalShielded",
        payload: ({ account, destination }) => ({
          ...base,
          selector: 4n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 6n,
          toAccount: destination,
        }),
      },
      {
        label: "selector 5 — transferInternalUnshielded",
        payload: ({ account, destination }) => ({
          ...base,
          selector: 5n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 7n,
          toAccount: destination,
        }),
      },
      {
        label: "selector 6 — openSwapShielded, recipientKind 0 (OPEN, FR-308 v2a)",
        payload: ({ account, destination }) => ({
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
        }),
      },
      {
        label: "selector 6 — openSwapShielded, recipientKind 1 (named taker key)",
        payload: ({ account, destination }) => ({
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
        }),
      },
      {
        label: "selector 6 — openSwapShielded, recipientKind 2 (contract taker)",
        payload: ({ account, destination }) => ({
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
        }),
      },
    ];

    const manager = managerAddressHex(k19.address);
    const domain = bytesToHex(k19.deploymentDomain) as Hex32;
    /** The transcript recipe, off-circuit, for one build's rendering of the action. */
    const recipe = (ids: NativeIds, payload: ManagerExecutePayload): string => {
      const accountHex = bytesToHex(ids.account) as Hex32;
      return semanticCommitmentForExecute(
        manager,
        domain,
        payload,
        accountHex,
        nativeAuthResult(accountHex),
      ).commitment;
    };

    for (const item of cases) {
      const { left, right } = await callBoth(p, item.label, item.payload);

      // THE TIER-3 DIFFERENCE, asserted rather than waved through: k=20 emits the FR-031 semantic
      // event, k=19 emits nothing.
      expect((left.logEvents as readonly LogEvent[]).length, `${item.label} k19 events`).toBe(0);
      expect(
        (right.logEvents as readonly LogEvent[]).length,
        `${item.label} k20 events`,
      ).toBeGreaterThan(0);

      // …and REMOVING THE EVENT LOST NO INFORMATION: each build's emitted-or-absent commitment is
      // exactly what that build's own proved transcript recomputes to.
      //
      // RE-POINTED ASSERTION 3. This used to compare the k=20 EVENT against a recomputation over
      // the k=19 transcript, which worked only while the two builds derived the SAME account id. The
      // semantic commitment BINDS the account id, so under the rename the two builds legitimately
      // commit to different accounts. The information-preservation property is per-build, and is now
      // asserted that way — on BOTH builds, where before only the k=20 side was checked.
      const payload19 = item.payload(p.ids.k19);
      const payload20 = item.payload(p.ids.k20);
      expect(
        extractLegacySemanticCommitment(right.logEvents as readonly LogEvent[]),
        `${item.label} k20 emitted commitment vs its own transcript`,
      ).toBe(recipe(p.ids.k20, payload20));
      expect(
        bytesToHex(
          (k19Pure as any).semanticCommitmentFor(
            bytes(manager),
            bytes(domain),
            payload19,
            p.ids.k19.account,
            bytes(nativeAuthResult(bytesToHex(p.ids.k19.account) as Hex32)),
          ),
        ),
        `${item.label} k19 oracle vs its own transcript`,
      ).toBe(recipe(p.ids.k19, payload19));

      // …and the RECIPE itself did not drift: fed the k=19 transcript, the k=20 oracle returns the
      // k=19 value. The commitments differ ONLY because the account id they bind differs.
      expect(
        bytesToHex(
          (k20Pure as any).semanticCommitmentFor(
            bytes(manager),
            bytes(domain),
            payload19,
            p.ids.k19.account,
            bytes(nativeAuthResult(bytesToHex(p.ids.k19.account) as Hex32)),
          ),
        ),
        `${item.label} the commitment recipe is identical on both builds`,
      ).toBe(recipe(p.ids.k19, payload19));
    }
  }, PARITY_TIMEOUT_MS);

  it("refuses identically on the negative set, state-neutrally on both builds", async () => {
    const p = await fundedPair(async (sim, ids) => {
      await sim.call("depositShielded", coin(COLOR_A, 10n, 1), ids.account);
      await sim.call("depositUnshielded", bytes(COLOR_A), 10n, ids.account);
    });
    const { k19, k20 } = p;

    const base = emptyExecutePayload();
    const unregistered = new Uint8Array(32).fill(0x99);
    // Every case below is IDENTICAL on both builds except for the account ids, which each build
    // derives for itself under its own owner tag. Rendering the list per build is what keeps this a
    // true A/B of the refusal surface rather than a test of the rename.
    const negativesFor = ({
      account,
      destination,
    }: NativeIds): { label: string; payload: ManagerExecutePayload }[] => [
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

    const negatives19 = negativesFor(p.ids.k19);
    const negatives20 = negativesFor(p.ids.k20);
    expect(negatives19.length).toBe(13);
    expect(negatives20.map((item) => item.label)).toEqual(negatives19.map((item) => item.label));

    for (let index = 0; index < negatives19.length; index += 1) {
      const label = negatives19[index]!.label;
      const before19 = JSON.stringify(snapshotLedger(k19.ledger));
      const before20 = JSON.stringify(snapshotLedger(k20.ledger));
      const left = await k19.expectReject(
        "execute",
        negatives19[index]!.payload,
        inert.signature,
        inert.point,
      );
      const right = await k20.expectReject(
        "execute",
        negatives20[index]!.payload,
        inert.signature,
        inert.point,
      );
      // Same refusal, same message — the refusal SET and its text are part of the frozen surface,
      // and are compared RAW: no message may contain a derived id, so no normalisation applies.
      expect(left, `${label} refusal message`).toBe(right);
      // State-neutral on both (expectReject already fails if state moved; this pins the bytes).
      // Neutrality is a build against ITSELF, so it too is compared raw.
      expect(JSON.stringify(snapshotLedger(k19.ledger)), `${label} k19 neutrality`).toBe(before19);
      expect(JSON.stringify(snapshotLedger(k20.ledger)), `${label} k20 neutrality`).toBe(before20);
      expectSameState(label, p);
    }
  }, PARITY_TIMEOUT_MS);

  it("agrees on the EVM-authorized path: signature, deadline, nonce-after-custody, refusals", async () => {
    const p = await pair();
    const { k19, k20 } = p;
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
    // The EVM account id is keccak over the frozen EIP-712 type hashes — no Manager tag takes part,
    // so it is IDENTICAL on both builds and the SAME payload drives both. Asserted, not assumed:
    expect(
      bytesToHex(
        (k20Pure as any).evmAccountIdFor(bytes(manager), hexToBytes(EVM_OWNER, 20), bytes(SALT)),
      ),
      "the EVM account id is unaffected by the owner-tag rename",
    ).toBe(registration.accountId);
    // Its STORAGE KEYS are tag-derived, though, so the alias maps must learn it before any deposit.
    aliasAccount(p.alias.k19, k19Pure, "EVM", bytes(registration.accountId));
    aliasAccount(p.alias.k20, k20Pure, "EVM", bytes(registration.accountId));

    const reg19 = await k19.callDetailedAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point);
    const reg20 = await k20.callDetailedAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point);
    expectSameEffects("EVM registration", reg19, reg20, p);

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
    expectSameEffects("EVM withdraw", w19, w20, p);
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
// COVERAGE FOLLOW-UP — the three swap guards that had no DEDICATED negative case
// ================================================================================================
//
// The wiring verification done when the two orphaned swap helpers were deleted recorded,
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
//        This is NOT a coverage regression against the older suites. `tests/simulation/swap.test.ts`
//        (v3/v4 surface) never reached them either — its case at :435 says so verbatim, and asserts
//        the guard ORDER instead — and `g5-variants.test.ts` (retired; tag `research/pre-reorg`) :99-110 asserts
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
  p: Pair,
  payload: (ids: NativeIds) => ManagerExecutePayload,
): Promise<string> {
  const before19 = JSON.stringify(snapshotLedger(p.k19.ledger));
  const before20 = JSON.stringify(snapshotLedger(p.k20.ledger));
  const left = await p.k19.expectReject(
    "execute",
    payload(p.ids.k19),
    inert.signature,
    inert.point,
  );
  const right = await p.k20.expectReject(
    "execute",
    payload(p.ids.k20),
    inert.signature,
    inert.point,
  );
  expect(left, `${label} refusal message`).toBe(right);
  expect(JSON.stringify(snapshotLedger(p.k19.ledger)), `${label} k19 neutrality`).toBe(before19);
  expect(JSON.stringify(snapshotLedger(p.k20.ledger)), `${label} k20 neutrality`).toBe(before20);
  expectSameState(label, p);
  return left;
}

/** Both builds, both accounts registered, nothing deposited yet. */
const registeredPair = (): Promise<Pair> => fundedPair(async () => {});

describe("k20 parity — the three swap guards with no dedicated negative case", () => {
  it("guard 0a — refuses a swap that gives ZERO, and parameter sanity still precedes the witness choke point", async () => {
    const p = await fundedPair(async (sim, ids) => {
      await sim.call("depositShielded", coin(COLOR_A, 10n, 1), ids.account);
    });
    const { k19, k20 } = p;

    const base = emptyExecutePayload();
    const zeroGive = ({ account, destination }: NativeIds): ManagerExecutePayload => ({
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
    });

    // The dedicated negative for guard 0a, with a fully authorized, fully funded maker: the ONLY
    // thing wrong with this action is the zero give.
    const refusal = await expectSameRefusal("NC — swap giving zero", p, zeroGive);
    expect(refusal, "guard 0a message").toContain("swap must give a positive amount");
    // It must NOT be mistaken for any neighbouring guard.
    expect(refusal).not.toContain("swap must want a positive amount");
    expect(refusal).not.toContain("account colour balance too low");
    // Everything else about this maker was fine — so the refusal is attributable to 0a alone.
    expect(shieldedCell(k19Pure, k19.ledger, p.ids.k19.account, COLOR_A)).toBe(10n);
    expect(poolAmount(k19.ledger, COLOR_A)).toBe(10n);

    // ORDERING PROBE, ported from `tests/simulation/swap.test.ts:479` ("parameter sanity precedes
    // the choke point"). `execute` runs `assertActionEnvelope` BEFORE `gatewayAccount`, so a
    // zero-give from an UNREGISTERED witness reports the zero, not the authorization. That order is
    // deliberate: guard 0a is pure arithmetic on the caller's own arguments, reads no state, and can
    // therefore leak nothing about registration or balances. Pinned here so a future edit cannot
    // silently move a state-reading guard ahead of the witness choke point.
    k19.actAs(NATIVE_STRANGER);
    k20.actAs(NATIVE_STRANGER);
    const stranger = await expectSameRefusal(
      "NC — swap giving zero from an unregistered witness",
      p,
      zeroGive,
    );
    expect(stranger, "guard 0a still precedes the choke point").toContain(
      "swap must give a positive amount",
    );
    expect(stranger).not.toContain("owner witness matches no registered account");

    // Control, so the probe above is not vacuous: the SAME unregistered witness with a valid give
    // really does die at the choke point. Guard 0a is what moved the answer, not the witness.
    const chokePoint = await expectSameRefusal(
      "NC — control: unregistered witness with a valid give",
      p,
      (ids) => ({ ...zeroGive(ids), primaryAmount: 1n }),
    );
    expect(chokePoint).toContain("caller's owner witness matches no registered account");
  }, PARITY_TIMEOUT_MS);

  it("guard 3a is UNREACHABLE by refusal — a swap in a colour with NO pool dies at the account guard instead", async () => {
    // COLOR_DORMANT was never deposited, so `pools.member(COLOR_DORMANT)` is FALSE: guard 3a's own
    // predicate is in the failing state. Its message must still never appear, because guard 2 reads
    // the missing (account, COLOR_DORMANT) cell as 0 and refuses first (FR-204 / FR-206).
    const p = await fundedPair(async (sim, ids) => {
      await sim.call("depositShielded", coin(COLOR_A, 10n, 2), ids.account);
    });
    const { k19, k20 } = p;
    for (const sim of [k19, k20]) {
      expect(poolHas(sim.ledger, COLOR_DORMANT), "3a predicate is in the FAILING state").toBe(false);
    }

    const refusal = await expectSameRefusal(
      "NC — swap giving a colour with no pool",
      p,
      ({ account, destination }) => ({
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
      }),
    );

    expect(refusal, "guard 2 refuses first").toContain("account colour balance too low");
    expect(refusal, "guard 3a is shadowed").not.toContain("no pooled coin for this colour");
    expect(refusal).not.toContain("pooled colour balance too low");

    // ...and the refusal CREATED nothing — no lazily materialised pool entry, no empty cell.
    for (const [sim, pure, ids] of [
      [k19, k19Pure, p.ids.k19],
      [k20, k20Pure, p.ids.k20],
    ] as const) {
      expect(poolHas(sim.ledger, COLOR_DORMANT)).toBe(false);
      const key = (pure as any).shieldedKey(ids.account, bytes(COLOR_DORMANT));
      expect(sim.ledger.shieldedBalances.member(key)).toBe(false);
    }
  }, PARITY_TIMEOUT_MS);

  it("guard 3b is UNREACHABLE by refusal — a RICH pool cannot rescue a short account cell, and never reports itself", async () => {
    // Ported from `tests/simulation/swap.test.ts:379` (NC-306) and
    // `g5-variants.test.ts:99` (retired; tag `research/pre-reorg`), onto the v5 `execute` surface.
    //
    // The maker holds 2 of COLOR_A; a second account holds 100 more of the SAME colour, so the pool
    // holds 102 — comfortably more than the 5 the maker asks to give. BOTH pool guards would
    // therefore PASS if they were reached. Only the per-(account, colour) guard can refuse this, and
    // it must, before either pool guard is consulted.
    const p = await fundedPair(async (sim, ids) => {
      await sim.call("depositShielded", coin(COLOR_A, 100n, 3), ids.account);
      await sim.call("depositShielded", coin(COLOR_A, 2n, 4), ids.destination);
    });
    const { k19, k20 } = p;

    for (const [sim, pure, ids] of [
      [k19, k19Pure, p.ids.k19],
      [k20, k20Pure, p.ids.k20],
    ] as const) {
      // Guard 3a's predicate: PASSES. Guard 3b's predicate at val=5: PASSES.
      expect(poolHas(sim.ledger, COLOR_A), "3a predicate would PASS").toBe(true);
      expect(poolAmount(sim.ledger, COLOR_A), "3b predicate would PASS").toBe(102n);
      // Guard 2's predicate: FAILS. This is the only thing wrong with the action.
      expect(shieldedCell(pure, sim.ledger, ids.destination, COLOR_A)).toBe(2n);
    }

    k19.actAs(NATIVE_B);
    k20.actAs(NATIVE_B);
    const refusal = await expectSameRefusal(
      "NC — swap from a short cell while the pool is rich",
      p,
      ({ account, destination }) => ({
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
      }),
    );

    expect(refusal, "guard 2 refuses first").toContain("account colour balance too low");
    expect(refusal, "guard 3b is shadowed").not.toContain("pooled colour balance too low");
    expect(refusal).not.toContain("no pooled coin for this colour");

    // The other account's funds are untouched, and the pool is still rich — the refusal came from
    // the maker's OWN cell, which is the FR-204 property this probe exists to pin.
    for (const [sim, pure, ids] of [
      [k19, k19Pure, p.ids.k19],
      [k20, k20Pure, p.ids.k20],
    ] as const) {
      expect(poolAmount(sim.ledger, COLOR_A)).toBe(102n);
      expect(shieldedCell(pure, sim.ledger, ids.account, COLOR_A)).toBe(100n);
    }
  }, PARITY_TIMEOUT_MS);

  it("the pool-total invariant that SHADOWS guards 3a/3b holds through every shielded action, on both builds", async () => {
    // This is the load-bearing test behind the two "unreachable" verdicts above. The guards are
    // unreachable because `pools.lookup(C).value == Σ shieldedBalances cells of colour C` for every
    // colour, at all times — which makes guard 2 strictly stronger than both of them. Asserting the
    // invariant, executed, is what would catch a future edit that broke the pairing and made 3a/3b
    // reachable (at which point they would need real negatives, and this test would say so by
    // failing).
    const p = await registeredPair();
    const { k19, k20 } = p;

    const holdersOf = (ids: NativeIds): Uint8Array[] => [ids.account, ids.destination];
    const colours: Hex32[] = [COLOR_A, COLOR_B];

    const checkInvariant = (label: string): void => {
      for (const [sim, pure, ids] of [
        [k19, k19Pure, p.ids.k19],
        [k20, k20Pure, p.ids.k20],
      ] as const) {
        for (const colour of colours) {
          const cellSum = holdersOf(ids).reduce(
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
      // "Σ over the holders we know" is genuinely "Σ over the colour". After the domain-separator
      // rename the two builds
      // derive DIFFERENT keys from the same (holder, colour), so each ledger is checked against ITS
      // OWN build's key set — one build's keys are no longer a valid yardstick for the other's.
      for (const [sim, pure, ids] of [
        [k19, k19Pure, p.ids.k19],
        [k20, k20Pure, p.ids.k20],
      ] as const) {
        const known = new Set<string>();
        for (const holder of holdersOf(ids)) {
          for (const colour of colours) {
            known.add(bytesToHex((pure as any).shieldedKey(holder, bytes(colour))));
          }
        }
        for (const [key] of sim.ledger.shieldedBalances) {
          expect(known.has(bytesToHex(key)), `${label} unaccounted shielded cell`).toBe(true);
        }
      }
      expectSameState(label, p);
    };

    checkInvariant("empty");

    for (const [sim, ids] of [
      [k19, p.ids.k19],
      [k20, p.ids.k20],
    ] as const) {
      await sim.call("depositShielded", coin(COLOR_A, 100n, 5), ids.account);
      await sim.call("depositShielded", coin(COLOR_B, 100n, 6), ids.account);
    }
    checkInvariant("after deposits");

    const base = emptyExecutePayload();
    const steps: { label: string; payload: (ids: NativeIds) => ManagerExecutePayload }[] = [
      {
        // Debit + `repoolOrRemove`: the pool falls by exactly what the cell falls by.
        label: "after selector 2 (withdrawShielded)",
        payload: ({ account }) => ({
          ...base,
          selector: 2n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 3n,
          recipientKind: 0n,
          recipient: bytes(RECIPIENT),
        }),
      },
      {
        // Cell-to-cell inside one colour: the pool must NOT move.
        label: "after selector 4 (transferInternalShielded)",
        payload: ({ account, destination }) => ({
          ...base,
          selector: 4n,
          account,
          primaryColor: bytes(COLOR_A),
          primaryAmount: 6n,
          toAccount: destination,
        }),
      },
      {
        // Both legs at once: give leg drops COLOR_A's pool and cell by 8; want leg raises COLOR_B's
        // pool and the credited cell by 9.
        label: "after selector 6 (openSwapShielded, OPEN)",
        payload: ({ account, destination }) => ({
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
        }),
      },
    ];

    for (const step of steps) {
      await callBoth(p, step.label, step.payload);
      checkInvariant(step.label);
    }

    // The arithmetic, spelled out, so a silent change of the sequence cannot leave the invariant
    // trivially true: COLOR_A 100 − 3 − 8 = 89 pooled, split 83 / 6 between the two cells;
    // COLOR_B 100 + 9 = 109 pooled, split 100 / 9.
    expect(poolAmount(k19.ledger, COLOR_A)).toBe(89n);
    expect(shieldedCell(k19Pure, k19.ledger, p.ids.k19.account, COLOR_A)).toBe(83n);
    expect(shieldedCell(k19Pure, k19.ledger, p.ids.k19.destination, COLOR_A)).toBe(6n);
    expect(poolAmount(k19.ledger, COLOR_B)).toBe(109n);
    expect(shieldedCell(k19Pure, k19.ledger, p.ids.k19.account, COLOR_B)).toBe(100n);
    expect(shieldedCell(k19Pure, k19.ledger, p.ids.k19.destination, COLOR_B)).toBe(9n);

    // With the invariant holding, guard 2 (`cell >= val`, `val > 0`) implies BOTH pool predicates:
    // `Σ cells of C >= val > 0` gives `pools.member(C)` and `pooled.value >= val`. That is the whole
    // reason lines 1041 and 1043 can never be the first failing guard.
    for (const colour of colours) {
      for (const holder of holdersOf(p.ids.k19)) {
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
