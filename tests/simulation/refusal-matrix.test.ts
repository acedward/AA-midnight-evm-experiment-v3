// THE REFUSAL MATRIX (project 00014, FR-016) — every refusal this contract can produce, pinned by
// its exact text, with the ledger proved unchanged, before a single line of the split moves.
//
// WHY IT EXISTS
//   The 152-test baseline tier is strong on success paths and weak on refusals: roughly fifty of the
//   contract's assert strings were never exercised at all, and most of the rest only as "rejected,
//   state unchanged" with no text. A refactor that is supposed to change nothing must therefore be
//   able to prove that the refusal SURFACE — which string, from which guard, in which order — is
//   identical afterwards. That is what this file is: a table with one row per refusal, plus a
//   coverage assertion that reads the assert strings back out of the SOURCES at test time and fails
//   if any of them has no row.
//
// WHAT A ROW ASSERTS
//   (i)  the message equals the contract's string EXACTLY (`toBe`, never a regex — the runtime
//        renders an assert as `failed assert: <string>`, and that prefix is the only decoration);
//   (ii) the whole ledger snapshot is byte-identical before and after, so the refusal created,
//        moved and removed nothing. `ManagerSim.expectReject*` already fails on any drift; each row
//        also compares the snapshot itself so the property is visible where it is claimed.
//
// TOOLCHAIN INDEPENDENCE
//   Every expected message is a string in `contracts/**/*.compact`. Nothing here depends on the
//   compiler version, the language version or the image the artifact was built with: a toolchain
//   bump (0.33.0 -> 0.34.0, say) re-records the ARTIFACT baseline in
//   `fixtures/00014-artifact-baseline.json`, but leaves this matrix untouched. The only generated
//   thing it uses is the compiled contract it drives.
//
// AFTER THE SPLIT
//   The coverage assertion globs `contracts/**/*.compact` rather than naming one file, so a string
//   that MOVES into `contracts/modules/…` is still found, and a string that DISAPPEARS still fails.
//   `contracts/test-support/` is excluded: those are the test-only Minters, compiled as separate
//   contracts, and their two mint asserts belong to `minter.test.ts` (see finding F-T0.1-3).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-ignore — generated artifact, present after compilation
import { pureCircuits as managerContractPure } from "../generated/manager/contract/index.js";
import { bytesToHex, hexToBytes, type Hex20, type Hex32 } from "../lib/bytes.js";
import { deriveAccountId } from "../lib/codec.js";
import {
  KAT_ACTION,
  KAT_DEPLOYMENT_DOMAIN,
  KAT_PRIVATE_KEY,
  KAT_SIGNATURE,
} from "../fixtures/generate.js";
import {
  emptyExecutePayload,
  managerAddressHex,
  prepareEvmExecute,
  type ManagerExecutePayload,
} from "../lib/manager.js";
import { metamaskSign } from "../lib/metamask.js";
import {
  basePayload,
  COVERAGE_ALLOW_LIST,
  ENVELOPE_ROWS,
  fixtureView,
  POST_ENVELOPE_ROWS,
  type PayloadPatch,
} from "../lib/refusal-matrix.js";
import type { Eip712Action, RegisterEvmAccount } from "../lib/schema.js";
import { addressForPrivateKey } from "../lib/signature.js";
import { ManagerSim, secretOf, snapshotLedger } from "../lib/sim.js";

const NOW = 1_800_000_000;
const DEADLINE = BigInt(NOW + 600);
const EVM_KEY_A = KAT_PRIVATE_KEY;
const EVM_KEY_B = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as Hex32;
const EVM_OWNER_A = addressForPrivateKey(EVM_KEY_A);
const EVM_OWNER_B = addressForPrivateKey(EVM_KEY_B);
const NATIVE_A = secretOf("MatrixNativeA");
const NATIVE_B = secretOf("MatrixNativeB");
const NATIVE_UNREGISTERED = secretOf("MatrixNativeUnregistered");
const COLOR_A = `0x${"11".repeat(32)}` as Hex32;
const COLOR_B = `0x${"22".repeat(32)}` as Hex32;
const SALT_A = `0x${"c1".repeat(32)}` as Hex32;
const SALT_B = `0x${"c2".repeat(32)}` as Hex32;
const SALT_C = `0x${"c3".repeat(32)}` as Hex32;
const RECIPIENT = `0x${"aa".repeat(32)}` as Hex32;
const UNREGISTERED_ACCOUNT = new Uint8Array(32).fill(0x5e);

const bytes = (value: Hex32): Uint8Array => hexToBytes(value, 32);
const coin = (color: Hex32, value: bigint, nonceByte: number) => ({
  nonce: new Uint8Array(32).fill(nonceByte),
  color: bytes(color),
  value,
});

/** A signature/point pair that verifies against SOME digest but never against the one under test. */
const inert = prepareEvmExecute(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, KAT_SIGNATURE);

/** The runtime's rendering of `assert(false, s)`. */
const failed = (message: string): string => `failed assert: ${message}`;

// --- the world every post-envelope row shares -----------------------------------------------------
//
// One deployment, built once. Every row refuses, and a refusal is state-neutral by construction, so
// the rows cannot disturb each other; the per-row snapshot comparison is what proves that.

type World = {
  sim: ManagerSim;
  manager: Hex32;
  domain: Hex32;
  nativeA: Uint8Array;
  nativeB: Uint8Array;
  evmA: Hex32;
  evmB: Hex32;
};

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

async function buildWorld(): Promise<World> {
  const sim = await ManagerSim.create(NATIVE_A);
  const manager = managerAddressHex(sim.address);
  const domain = bytesToHex(sim.deploymentDomain) as Hex32;

  const nativeA = await sim.ownerCommitmentFor(NATIVE_A);
  const nativeB = await sim.ownerCommitmentFor(NATIVE_B);
  await sim.call("registerAccount", nativeA);
  await sim.call("registerAccount", nativeB);

  const registerEvm = async (key: Hex32, salt: Hex32): Promise<Hex32> => {
    const action = registration(manager, addressForPrivateKey(key), salt);
    const prepared = prepareEvmExecute(action, domain, metamaskSign(key, action, domain));
    await sim.callDetailedAt(NOW, "execute", prepared.payload, prepared.signature, prepared.point);
    return action.accountId;
  };
  const evmA = await registerEvm(EVM_KEY_A, SALT_A);
  const evmB = await registerEvm(EVM_KEY_B, SALT_B);

  await sim.call("depositShielded", coin(COLOR_A, 10n, 1), nativeA);
  await sim.call("depositUnshielded", bytes(COLOR_A), 10n, nativeA);
  await sim.call("depositShielded", coin(COLOR_A, 10n, 2), bytes(evmA));
  await sim.call("depositUnshielded", bytes(COLOR_A), 10n, bytes(evmA));

  // ONE committed EVM action, so `evmNonces[evmA] == 1` and the matrix can probe a nonce BELOW the
  // stored one as well as one above it. Without it "stale" and "future" would be the same row.
  const bump: Eip712Action = {
    primaryType: "TransferInternalShielded",
    manager,
    accountId: evmA,
    owner: EVM_OWNER_A,
    nonce: 0n,
    validUntil: DEADLINE,
    toAccountId: evmB,
    color: COLOR_A,
    amount: 1n,
  };
  const bumped = prepareEvmExecute(bump, domain, metamaskSign(EVM_KEY_A, bump, domain));
  await sim.callDetailedAt(NOW, "execute", bumped.payload, bumped.signature, bumped.point);
  expect(sim.ledger.evmNonces.lookup(bytes(evmA))).toBe(1n);

  return { sim, manager, domain, nativeA, nativeB, evmA, evmB };
}

let worldPromise: Promise<World> | undefined;
const world = (): Promise<World> => (worldPromise ??= buildWorld());

/** Drive one refused `execute` and return its message, with the ledger pinned on both sides. */
async function refuse(
  w: World,
  payload: ManagerExecutePayload,
  signature: typeof inert.signature = inert.signature,
  point: typeof inert.point = inert.point,
): Promise<string> {
  const before = JSON.stringify(snapshotLedger(w.sim.ledger));
  const message = await w.sim.expectRejectAt(NOW, "execute", payload, signature, point);
  expect(JSON.stringify(snapshotLedger(w.sim.ledger))).toBe(before);
  return message;
}

/** The same, for a circuit that is not `execute` (the two deposits). */
async function refuseCall(w: World, circuit: string, ...args: unknown[]): Promise<string> {
  const before = JSON.stringify(snapshotLedger(w.sim.ledger));
  const message = await w.sim.expectRejectAt(NOW, circuit, ...args);
  expect(JSON.stringify(snapshotLedger(w.sim.ledger))).toBe(before);
  return message;
}

/** Act under another owner secret for one call, then put the witness back. */
async function withWitness<T>(w: World, secret: Uint8Array, body: () => Promise<T>): Promise<T> {
  w.sim.actAs(secret);
  try {
    return await body();
  } finally {
    w.sim.actAs(NATIVE_A);
  }
}

const evmActionPayload = (over: PayloadPatch): ManagerExecutePayload => ({
  ...emptyExecutePayload(),
  selector: 4n,
  authMode: 1n,
  owner: hexToBytes(EVM_OWNER_A, 20),
  validUntil: DEADLINE,
  primaryColor: bytes(COLOR_A),
  primaryAmount: 1n,
  ...over,
});

const nativeActionPayload = (over: PayloadPatch): ManagerExecutePayload => ({
  ...emptyExecutePayload(),
  selector: 4n,
  authMode: 0n,
  primaryColor: bytes(COLOR_A),
  primaryAmount: 1n,
  ...over,
});

// --- the post-envelope probes, keyed by the row ids declared in lib/refusal-matrix.ts --------------

const PROBES: Record<string, (w: World) => Promise<string>> = {
  "constructor/zero-domain": async () => {
    // The one refusal with no ledger to compare: the contract never comes into existence.
    try {
      await ManagerSim.create(NATIVE_A, new Uint8Array(32));
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error("expected the constructor to refuse a zero deployment domain");
  },

  "pure/evmStructHashFor/selector=0": async (w) => {
    // Unreachable through `execute` — the envelope refuses selector 0 long before the digest — but
    // `evmStructHashFor` is EXPORTED and pure, so the string is reachable, and a caller that
    // recomputes a digest off-chain can hit it. Pure circuits take no context: no ledger can move.
    const before = JSON.stringify(snapshotLedger(w.sim.ledger));
    let message: string | undefined;
    try {
      (managerContractPure as any).evmStructHashFor(bytes(w.manager), {
        ...basePayload(2, "evm"),
        selector: 0n,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(JSON.stringify(snapshotLedger(w.sim.ledger))).toBe(before);
    if (message === undefined) throw new Error("expected evmStructHashFor to refuse selector 0");
    return message;
  },

  "s1/evm/account-id-mismatch": (w) =>
    refuse(w, {
      ...emptyExecutePayload(),
      selector: 1n,
      authMode: 1n,
      account: UNREGISTERED_ACCOUNT,
      owner: hexToBytes(EVM_OWNER_A, 20),
      accountSalt: bytes(SALT_C),
      validUntil: DEADLINE,
    }),

  "s1/evm/deadline-below-horizon": (w) => refuse(w, registrationPayload(w, 3600n)),
  "s1/evm/deadline-beyond-horizon": (w) => refuse(w, registrationPayload(w, BigInt(NOW + 3601))),
  "s1/evm/expired": (w) => refuse(w, registrationPayload(w, BigInt(NOW))),

  "s1/evm/signature-does-not-verify": (w) => {
    // Signed over a DIFFERENT deployment domain, so the digest the circuit recomputes is not the one
    // that was signed. Everything before the signature assert passes.
    const action = registration(w.manager, EVM_OWNER_A, SALT_C);
    const otherDomain = `0x${"ee".repeat(32)}` as Hex32;
    const prepared = prepareEvmExecute(
      action,
      otherDomain,
      metamaskSign(EVM_KEY_A, action, otherDomain),
    );
    return refuse(w, prepared.payload, prepared.signature, prepared.point);
  },

  "s1/evm/signer-not-owner": (w) => {
    // A perfectly valid signature — by the WRONG key. The point is a caller argument, so the verify
    // succeeds and only `signer == p.owner` catches it.
    const action = registration(w.manager, EVM_OWNER_A, SALT_C);
    const prepared = prepareEvmExecute(
      action,
      w.domain,
      metamaskSign(EVM_KEY_B, action, w.domain),
    );
    return refuse(w, prepared.payload, prepared.signature, prepared.point);
  },

  "s1/evm/duplicate-registration": (w) => {
    const action = registration(w.manager, EVM_OWNER_A, SALT_A);
    const prepared = prepareEvmExecute(action, w.domain, metamaskSign(EVM_KEY_A, action, w.domain));
    return refuse(w, prepared.payload, prepared.signature, prepared.point);
  },

  "s4/evm/unregistered-gateway-account": (w) =>
    refuse(w, evmActionPayload({ account: UNREGISTERED_ACCOUNT, toAccount: bytes(w.evmB) })),

  "s4/evm/native-account-in-evm-mode": (w) =>
    refuse(w, evmActionPayload({ account: w.nativeA, toAccount: bytes(w.evmB) })),

  "s4/evm/wrong-stored-owner": (w) =>
    refuse(
      w,
      evmActionPayload({
        account: bytes(w.evmA),
        owner: hexToBytes(EVM_OWNER_B, 20),
        toAccount: bytes(w.evmB),
      }),
    ),

  "s4/evm/stale-nonce": (w) =>
    refuse(w, evmActionPayload({ account: bytes(w.evmA), nonce: 0n, toAccount: bytes(w.evmB) })),

  "s4/evm/future-nonce": (w) =>
    refuse(w, evmActionPayload({ account: bytes(w.evmA), nonce: 5n, toAccount: bytes(w.evmB) })),

  "s4/evm/signature-does-not-verify": (w) => {
    const action = transferAction(w);
    const otherDomain = `0x${"ee".repeat(32)}` as Hex32;
    const prepared = prepareEvmExecute(
      action,
      otherDomain,
      metamaskSign(EVM_KEY_A, action, otherDomain),
    );
    return refuse(w, prepared.payload, prepared.signature, prepared.point);
  },

  "s4/evm/signer-not-owner": (w) => {
    const action = transferAction(w);
    const prepared = prepareEvmExecute(action, w.domain, metamaskSign(EVM_KEY_B, action, w.domain));
    return refuse(w, prepared.payload, prepared.signature, prepared.point);
  },

  "s4/native/unregistered-witness": (w) =>
    withWitness(w, NATIVE_UNREGISTERED, () =>
      refuse(w, nativeActionPayload({ account: w.nativeA, toAccount: w.nativeB })),
    ),

  "s4/native/witness-transcript-mismatch": (w) =>
    withWitness(w, NATIVE_B, () =>
      refuse(w, nativeActionPayload({ account: w.nativeA, toAccount: w.nativeB })),
    ),

  "s4/native/unregistered-destination": (w) =>
    refuse(w, nativeActionPayload({ account: w.nativeA, toAccount: UNREGISTERED_ACCOUNT })),

  "s4/native/self-transfer": (w) =>
    refuse(w, nativeActionPayload({ account: w.nativeA, toAccount: w.nativeA })),

  "s4/native/shielded-balance-too-low": (w) =>
    refuse(
      w,
      nativeActionPayload({ account: w.nativeA, toAccount: w.nativeB, primaryAmount: 11n }),
    ),

  "s5/native/unshielded-balance-too-low": (w) =>
    refuse(
      w,
      nativeActionPayload({
        selector: 5n,
        account: w.nativeA,
        toAccount: w.nativeB,
        primaryAmount: 11n,
      }),
    ),

  "s3/native/contract-unshielded-short": (w) =>
    refuse(
      w,
      nativeActionPayload({
        selector: 3n,
        account: w.nativeA,
        recipientKind: 0n,
        recipient: bytes(RECIPIENT),
      }),
    ),

  "s6/native/unregistered-swap-credit": (w) =>
    refuse(
      w,
      nativeActionPayload({
        selector: 6n,
        account: w.nativeA,
        wantColor: bytes(COLOR_B),
        wantAmount: 1n,
        creditAccount: UNREGISTERED_ACCOUNT,
      }),
    ),

  "deposit/shielded/unregistered": (w) =>
    refuseCall(w, "depositShielded", coin(COLOR_A, 1n, 9), UNREGISTERED_ACCOUNT),
  "deposit/unshielded/unregistered": (w) =>
    refuseCall(w, "depositUnshielded", bytes(COLOR_A), 1n, UNREGISTERED_ACCOUNT),
  "deposit/shielded/zero-value": (w) =>
    refuseCall(w, "depositShielded", coin(COLOR_A, 0n, 9), w.nativeA),
  "deposit/unshielded/zero-amount": (w) =>
    refuseCall(w, "depositUnshielded", bytes(COLOR_A), 0n, w.nativeA),
};

/** An envelope-clean EVM registration whose account id is the one owner+salt derive. */
function registrationPayload(w: World, validUntil: bigint): ManagerExecutePayload {
  return {
    ...emptyExecutePayload(),
    selector: 1n,
    authMode: 1n,
    account: bytes(deriveAccountId(w.manager, EVM_OWNER_A, SALT_C)),
    owner: hexToBytes(EVM_OWNER_A, 20),
    accountSalt: bytes(SALT_C),
    validUntil,
  };
}

/** The action the world already committed once, replayable at its stored nonce. */
function transferAction(w: World): Eip712Action {
  return {
    primaryType: "TransferInternalShielded",
    manager: w.manager,
    accountId: w.evmA,
    owner: EVM_OWNER_A,
    nonce: 1n,
    validUntil: DEADLINE,
    toAccountId: w.evmB,
    color: COLOR_A,
    amount: 1n,
  };
}

// --- assert-string extraction, straight out of the sources ----------------------------------------

/** Locate `contracts/` from this file, both on a host checkout and inside the staged test volume. */
function contractsRoot(): string {
  const testsRoot = fileURLToPath(new URL("..", import.meta.url));
  const candidates = [join(testsRoot, "..", "contracts"), join(testsRoot, "contracts")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
  }
  throw new Error(
    `no contracts/ directory next to the tests (looked in ${candidates.join(", ")}). ` +
      "The simulation tier stages it into the run volume — see scripts/test-sim.sh.",
  );
}

function compactSources(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(dir, entry.name);
      // The Minters are test-only contracts of their own; their asserts are minter.test.ts's job.
      if (entry.isDirectory()) {
        if (entry.name !== "test-support") walk(full);
      } else if (entry.name.endsWith(".compact")) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found;
}

/** Strip `//` comments without touching a `//` that lives inside a string literal. */
function stripLineComments(source: string): string {
  const out: string[] = [];
  for (const line of source.split("\n")) {
    let kept = "";
    let inString = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (inString) {
        kept += c;
        if (c === "\\") {
          kept += line[i + 1] ?? "";
          i += 1;
        } else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        kept += c;
        continue;
      }
      if (c === "/" && line[i + 1] === "/") break;
      kept += c;
    }
    out.push(kept);
  }
  return out.join("\n");
}

/**
 * Every `assert(…, "message")` string in one source, in file order.
 *
 * Parentheses are balanced rather than regex-matched, so a guard that calls a function or contains a
 * string with a bracket in it is read correctly, and the MESSAGE is the last string literal of the
 * call — which is exactly where Compact puts it.
 */
function assertStrings(source: string): string[] {
  const text = stripLineComments(source);
  const messages: string[] = [];
  const pattern = /\bassert\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    let depth = 1;
    let inString = false;
    let current = "";
    let last: string | undefined;
    let i = match.index + match[0].length;
    for (; i < text.length && depth > 0; i += 1) {
      const c = text[i];
      if (inString) {
        if (c === "\\") {
          current += text[i + 1] ?? "";
          i += 1;
        } else if (c === '"') {
          inString = false;
          last = current;
        } else current += c;
        continue;
      }
      if (c === '"') {
        inString = true;
        current = "";
      } else if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
    }
    if (last !== undefined) messages.push(last);
  }
  return messages;
}

// ==================================================================================================
// THE MATRIX
// ==================================================================================================

describe("00014 refusal matrix — the frozen table", () => {
  it("matches the committed fixture row for row", () => {
    const fixturePath = fileURLToPath(
      new URL("../fixtures/00014-refusal-matrix.json", import.meta.url),
    );
    expect(JSON.parse(readFileSync(fixturePath, "utf8"))).toEqual(fixtureView());
  });

  it("has exactly one probe per post-envelope row", () => {
    expect(Object.keys(PROBES).sort()).toEqual(POST_ENVELOPE_ROWS.map((r) => r.id).sort());
  });

  it("has no duplicate row ids", () => {
    const ids = [...ENVELOPE_ROWS, ...POST_ENVELOPE_ROWS].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // If a base payload were not envelope-clean, its rows would all pass for the WRONG reason: an
  // unrelated guard would fire and the row's expected string would never be tested. The exported
  // pure oracle runs `assertActionEnvelope` and nothing else that can refuse, so it is the cheapest
  // possible proof that each base is accepted.
  it.each(
    (
      [
        [0, "native"],
        [1, "evm"],
        ...[2, 3, 4, 5, 6].flatMap((s) => [
          [s, "native"],
          [s, "evm"],
        ]),
      ] as [number, "native" | "evm"][]
    ).map(([selector, mode]) => ({ selector, mode })),
  )("base payload for selector $selector in $mode mode is envelope-clean", ({ selector, mode }) => {
    const anyBytes = new Uint8Array(32).fill(0xa1);
    expect(() =>
      (managerContractPure as any).semanticCommitmentFor(
        anyBytes,
        anyBytes,
        basePayload(selector, mode),
        anyBytes,
        anyBytes,
      ),
    ).not.toThrow();
  });
});

describe("00014 refusal matrix — envelope rows", () => {
  it.each(ENVELOPE_ROWS.map((r) => ({ ...r, name: r.id })))(
    "$name refuses with the exact string and moves nothing",
    async (row) => {
      const w = await world();
      const base =
        row.selector === null
          ? basePayload(4, "native")
          : basePayload(row.selector, row.mode === "evm" ? "evm" : "native");
      const message = await refuse(w, { ...base, ...row.patch });
      expect(message).toBe(failed(row.expected));
    },
  );
});

describe("00014 refusal matrix — authorization, custody and constructor rows", () => {
  it.each(POST_ENVELOPE_ROWS.map((r) => ({ ...r, name: r.id })))(
    "$name refuses with the exact string and moves nothing",
    async (row) => {
      const w = await world();
      const probe = PROBES[row.id];
      if (!probe) throw new Error(`no probe for row ${row.id}`);
      expect(await probe(w)).toBe(failed(row.expected));
    },
  );
});

// ==================================================================================================
// COVERAGE — read the strings back out of the sources and demand a row for each
// ==================================================================================================

describe("00014 refusal matrix — coverage of every assert string", () => {
  it("covers every assert string in contracts/**/*.compact, or allow-lists it with a reason", () => {
    const root = contractsRoot();
    const files = compactSources(root);
    expect(files.length, `no .compact sources under ${root}`).toBeGreaterThan(0);

    const perFile = new Map<string, string[]>();
    for (const file of files) perFile.set(file, assertStrings(readFileSync(file, "utf8")));
    const all = [...perFile.values()].flat();
    expect(all.length, `no assert strings found under ${root}`).toBeGreaterThan(0);
    const distinct = [...new Set(all)].sort();

    const covered = new Set(
      [...ENVELOPE_ROWS, ...POST_ENVELOPE_ROWS].map((r) => r.expected),
    );
    const allowed = new Map(COVERAGE_ALLOW_LIST.map((entry) => [entry.message, entry.why]));

    const matched = distinct.filter((s) => covered.has(s));
    const unmatched = distinct.filter((s) => !covered.has(s));

    // The report is the evidence artifact for T0.1.5: it lists every string, its state and, for the
    // allow-listed ones, the reason they cannot be reached.
    const lines: string[] = [];
    lines.push(`contracts root: ${root}`);
    for (const [file, messages] of perFile) {
      lines.push(`  ${file.slice(root.length + 1)}: ${messages.length} asserts`);
    }
    lines.push(
      `distinct assert strings: ${distinct.length}  matched by a row: ${matched.length}  ` +
        `allow-listed: ${unmatched.length}`,
    );
    for (const s of distinct) {
      lines.push(`  [${covered.has(s) ? "ROW " : "ALLOW"}] ${s}${covered.has(s) ? "" : ` — ${allowed.get(s) ?? "NO REASON"}`}`);
    }
    console.log(lines.join("\n"));

    const unjustified = unmatched.filter((s) => !allowed.has(s));
    expect(unjustified, "assert strings with neither a matrix row nor an allow-list entry").toEqual(
      [],
    );

    // The allow-list may not rot: an entry that no longer exists in the sources, or one that a row
    // now covers, has to be removed rather than left as decoration.
    const present = new Set(distinct);
    expect(
      COVERAGE_ALLOW_LIST.filter((e) => !present.has(e.message)).map((e) => e.message),
      "allow-listed strings that no longer exist in the sources",
    ).toEqual([]);
    expect(
      COVERAGE_ALLOW_LIST.filter((e) => covered.has(e.message)).map((e) => e.message),
      "allow-listed strings that a row now covers",
    ).toEqual([]);
    for (const entry of COVERAGE_ALLOW_LIST) expect(entry.why.length).toBeGreaterThan(20);
  });
});
