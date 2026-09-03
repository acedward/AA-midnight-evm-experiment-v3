// The 00014 REFUSAL MATRIX TABLE — the static half of `simulation/refusal-matrix.test.ts`.
//
// WHY THIS FILE EXISTS SEPARATELY
//   The matrix has two halves. The ENVELOPE half is pure data: a canonical, envelope-CLEAN payload
//   per (selector, auth mode) plus one single-field perturbation per refusal, with the exact
//   contract string that perturbation must produce. That half needs no contract state at all, so it
//   lives here as data and can be written out to `fixtures/00014-refusal-matrix.json` by
//   `tsx lib/refusal-matrix.ts --write` — the same `--write` pattern `fixtures/generate.ts` uses.
//   The POST-ENVELOPE half needs a live world (registered accounts, deposits, a bumped nonce), so
//   its probes live in the test; only its metadata is declared here, so both halves land in one
//   frozen fixture and a silently deleted row shows up as a fixture diff.
//
// WHAT THE EXPECTED STRINGS ARE
//   Every `expected` is a string that appears verbatim inside an `assert(...)` in
//   `contracts/**/*.compact`. They are CONTRACT text, not toolchain text: they do not depend on the
//   compiler or language version, so this table survives a toolchain bump unchanged. The runtime
//   prefixes them with `failed assert: ` when it throws; the test compares with that prefix and
//   `toBe`, never a regex.
//
// THE PERTURBATION DISCIPLINE
//   Each envelope row starts from a base payload that the exported pure oracle
//   `semanticCommitmentFor` accepts (the test proves that first, for every base), then changes
//   exactly ONE field — or, in the two rows that need it, one field plus the field that field's
//   rule is about. So the row's refusal is attributable to the perturbation and to nothing else,
//   and the expected string is the FIRST failing guard in `assertActionEnvelope`'s fixed order.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { emptyExecutePayload, type ManagerExecutePayload } from "./manager.js";

export type RefusalMode = "native" | "evm" | "pure" | "constructor" | "deposit";

export type PayloadPatch = Partial<ManagerExecutePayload>;

/** One row of the frozen fixture: what the fixture pins for every row, envelope or not. */
export type RefusalRowView = {
  readonly id: string;
  readonly selector: number | null;
  readonly mode: RefusalMode;
  readonly expected: string;
};

export type EnvelopeRow = RefusalRowView & {
  readonly patch: PayloadPatch;
  /** One line: why this perturbation is the FIRST failing guard. */
  readonly reach: string;
};

export type PostEnvelopeRow = RefusalRowView & { readonly reach: string };

// --- the constants every envelope payload is built from -------------------------------------------
//
// None of these need to exist on-chain: `execute` runs `assertActionEnvelope` as its first
// statement, so an envelope row never reaches a state lookup and an unregistered account id is
// exactly as good as a registered one here.
const nz32 = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);
const nz20 = (fill: number): Uint8Array => new Uint8Array(20).fill(fill);

export const ENVELOPE_ACCOUNT = nz32(0x11);
export const ENVELOPE_OWNER = nz20(0x22);
export const ENVELOPE_SALT = nz32(0x33);
export const ENVELOPE_COLOUR = nz32(0x44);
export const ENVELOPE_WANT_COLOUR = nz32(0x55);
export const ENVELOPE_RECIPIENT = nz32(0x66);
export const ENVELOPE_TO_ACCOUNT = nz32(0x77);
export const ENVELOPE_CREDIT_ACCOUNT = nz32(0x88);
export const ENVELOPE_WANT_NONCE = nz32(0x99);
/** Any deadline the horizon accepts; the envelope only ever checks `> 0`. */
export const ENVELOPE_DEADLINE = 1_800_000_600n;

/**
 * The canonical, envelope-CLEAN payload for one (selector, mode).
 *
 * Selector 0 is native-only and selector 1 EVM-only, so those two take no mode argument.
 */
export function basePayload(selector: number, mode: "native" | "evm"): ManagerExecutePayload {
  const empty = emptyExecutePayload();
  if (selector === 0) return empty;
  if (selector === 1) {
    return {
      ...empty,
      selector: 1n,
      authMode: 1n,
      account: ENVELOPE_ACCOUNT,
      owner: ENVELOPE_OWNER,
      accountSalt: ENVELOPE_SALT,
      validUntil: ENVELOPE_DEADLINE,
    };
  }
  const auth: PayloadPatch =
    mode === "evm"
      ? { authMode: 1n, owner: ENVELOPE_OWNER, validUntil: ENVELOPE_DEADLINE }
      : { authMode: 0n };
  const common: ManagerExecutePayload = {
    ...empty,
    selector: BigInt(selector),
    account: ENVELOPE_ACCOUNT,
    primaryColor: ENVELOPE_COLOUR,
    primaryAmount: 1n,
    ...auth,
  };
  if (selector === 2 || selector === 3) {
    return { ...common, recipientKind: 0n, recipient: ENVELOPE_RECIPIENT };
  }
  if (selector === 4 || selector === 5) {
    return { ...common, toAccount: ENVELOPE_TO_ACCOUNT };
  }
  return {
    ...common,
    recipientKind: 0n,
    wantColor: ENVELOPE_WANT_COLOUR,
    wantAmount: 1n,
    creditAccount: ENVELOPE_CREDIT_ACCOUNT,
  };
}

type Perturbation = { readonly field: string; readonly patch: PayloadPatch; readonly expected: string };

// --- selector 0: native registration (14 inactive/required fields + the mode) ---------------------
const SELECTOR_0: readonly Perturbation[] = [
  { field: "authMode=1", patch: { authMode: 1n }, expected: "native registration requires native authorization" },
  { field: "account", patch: { account: ENVELOPE_ACCOUNT }, expected: "native registration account is derived" },
  { field: "owner", patch: { owner: ENVELOPE_OWNER }, expected: "native registration EVM fields must be inactive" },
  { field: "accountSalt", patch: { accountSalt: ENVELOPE_SALT }, expected: "native registration EVM fields must be inactive" },
  { field: "nonce", patch: { nonce: 1n }, expected: "native registration replay fields must be inactive" },
  { field: "validUntil", patch: { validUntil: ENVELOPE_DEADLINE }, expected: "native registration replay fields must be inactive" },
  { field: "primaryColor", patch: { primaryColor: ENVELOPE_COLOUR }, expected: "native registration action fields must be inactive" },
  { field: "primaryAmount", patch: { primaryAmount: 1n }, expected: "native registration action fields must be inactive" },
  { field: "recipientKind", patch: { recipientKind: 1n }, expected: "native registration recipient must be inactive" },
  { field: "recipient", patch: { recipient: ENVELOPE_RECIPIENT }, expected: "native registration recipient must be inactive" },
  { field: "toAccount", patch: { toAccount: ENVELOPE_TO_ACCOUNT }, expected: "native registration targets must be inactive" },
  { field: "wantNonce", patch: { wantNonce: ENVELOPE_WANT_NONCE }, expected: "native registration targets must be inactive" },
  { field: "wantColor", patch: { wantColor: ENVELOPE_WANT_COLOUR }, expected: "native registration swap fields must be inactive" },
  { field: "wantAmount", patch: { wantAmount: 1n }, expected: "native registration swap fields must be inactive" },
  { field: "creditAccount", patch: { creditAccount: ENVELOPE_CREDIT_ACCOUNT }, expected: "native registration swap fields must be inactive" },
];

// --- selector 1: EVM registration -----------------------------------------------------------------
const SELECTOR_1: readonly Perturbation[] = [
  { field: "authMode=0", patch: { authMode: 0n }, expected: "EVM registration requires EVM authorization" },
  { field: "account=0", patch: { account: new Uint8Array(32) }, expected: "EVM registration account must be supplied" },
  { field: "owner=0", patch: { owner: new Uint8Array(20) }, expected: "EVM registration owner must be nonzero" },
  { field: "accountSalt=0", patch: { accountSalt: new Uint8Array(32) }, expected: "EVM registration salt must be nonzero" },
  { field: "nonce", patch: { nonce: 1n }, expected: "EVM registration replay fields are noncanonical" },
  { field: "validUntil=0", patch: { validUntil: 0n }, expected: "EVM registration replay fields are noncanonical" },
  { field: "primaryColor", patch: { primaryColor: ENVELOPE_COLOUR }, expected: "EVM registration action fields must be inactive" },
  { field: "primaryAmount", patch: { primaryAmount: 1n }, expected: "EVM registration action fields must be inactive" },
  { field: "recipientKind", patch: { recipientKind: 1n }, expected: "EVM registration recipient must be inactive" },
  { field: "recipient", patch: { recipient: ENVELOPE_RECIPIENT }, expected: "EVM registration recipient must be inactive" },
  { field: "toAccount", patch: { toAccount: ENVELOPE_TO_ACCOUNT }, expected: "EVM registration targets must be inactive" },
  { field: "wantNonce", patch: { wantNonce: ENVELOPE_WANT_NONCE }, expected: "EVM registration targets must be inactive" },
  { field: "wantColor", patch: { wantColor: ENVELOPE_WANT_COLOUR }, expected: "EVM registration swap fields must be inactive" },
  { field: "wantAmount", patch: { wantAmount: 1n }, expected: "EVM registration swap fields must be inactive" },
  { field: "creditAccount", patch: { creditAccount: ENVELOPE_CREDIT_ACCOUNT }, expected: "EVM registration swap fields must be inactive" },
];

// --- selectors 2..6: the rules every action shares, per mode ---------------------------------------
const ACTION_COMMON_NATIVE: readonly Perturbation[] = [
  { field: "account=0", patch: { account: new Uint8Array(32) }, expected: "action account must be supplied" },
  { field: "accountSalt", patch: { accountSalt: ENVELOPE_SALT }, expected: "action account salt must be inactive" },
  { field: "owner", patch: { owner: ENVELOPE_OWNER }, expected: "native action owner must be inactive" },
  { field: "nonce", patch: { nonce: 1n }, expected: "native action replay fields must be inactive" },
  { field: "validUntil", patch: { validUntil: ENVELOPE_DEADLINE }, expected: "native action replay fields must be inactive" },
];

const ACTION_COMMON_EVM: readonly Perturbation[] = [
  { field: "account=0", patch: { account: new Uint8Array(32) }, expected: "action account must be supplied" },
  { field: "accountSalt", patch: { accountSalt: ENVELOPE_SALT }, expected: "action account salt must be inactive" },
  { field: "owner=0", patch: { owner: new Uint8Array(20) }, expected: "EVM action owner must be nonzero" },
  { field: "validUntil=0", patch: { validUntil: 0n }, expected: "EVM action deadline must be nonzero" },
];

// --- selectors 2 and 3: withdrawals -----------------------------------------------------------------
const WITHDRAW: readonly Perturbation[] = [
  { field: "primaryAmount=0", patch: { primaryAmount: 0n }, expected: "withdraw amount must be positive" },
  { field: "recipientKind=2", patch: { recipientKind: 2n }, expected: "withdraw recipient kind is invalid" },
  { field: "recipientKind=1", patch: { recipientKind: 1n }, expected: "withdraw to a contract recipient is not supported" },
  { field: "recipient=0", patch: { recipient: new Uint8Array(32) }, expected: "withdraw recipient must be nonzero" },
  { field: "toAccount", patch: { toAccount: ENVELOPE_TO_ACCOUNT }, expected: "withdraw transfer target must be inactive" },
  { field: "wantNonce", patch: { wantNonce: ENVELOPE_WANT_NONCE }, expected: "withdraw swap fields must be inactive" },
  { field: "wantColor", patch: { wantColor: ENVELOPE_WANT_COLOUR }, expected: "withdraw swap fields must be inactive" },
  { field: "wantAmount", patch: { wantAmount: 1n }, expected: "withdraw swap target must be inactive" },
  { field: "creditAccount", patch: { creditAccount: ENVELOPE_CREDIT_ACCOUNT }, expected: "withdraw swap target must be inactive" },
];

// --- selectors 4 and 5: internal transfers ----------------------------------------------------------
const TRANSFER: readonly Perturbation[] = [
  { field: "primaryAmount=0", patch: { primaryAmount: 0n }, expected: "internal transfer must be positive" },
  { field: "recipientKind=1", patch: { recipientKind: 1n }, expected: "internal transfer recipient must be inactive" },
  { field: "recipient", patch: { recipient: ENVELOPE_RECIPIENT }, expected: "internal transfer recipient must be inactive" },
  { field: "toAccount=0", patch: { toAccount: new Uint8Array(32) }, expected: "internal transfer target must be supplied" },
  { field: "wantNonce", patch: { wantNonce: ENVELOPE_WANT_NONCE }, expected: "internal transfer swap fields must be inactive" },
  { field: "wantColor", patch: { wantColor: ENVELOPE_WANT_COLOUR }, expected: "internal transfer swap fields must be inactive" },
  { field: "wantAmount", patch: { wantAmount: 1n }, expected: "internal transfer swap target must be inactive" },
  { field: "creditAccount", patch: { creditAccount: ENVELOPE_CREDIT_ACCOUNT }, expected: "internal transfer swap target must be inactive" },
];

// --- selector 6: swaps -------------------------------------------------------------------------------
// `named recipient=0` is the one row that moves two fields: the "named" rule only exists when the
// kind says the offer is named, so the kind travels with it. The base is the OPEN shape (kind 0).
const SWAP: readonly Perturbation[] = [
  { field: "primaryAmount=0", patch: { primaryAmount: 0n }, expected: "swap must give a positive amount" },
  { field: "recipientKind=3", patch: { recipientKind: 3n }, expected: "swap recipient kind is invalid" },
  { field: "recipientKind=2", patch: { recipientKind: 2n }, expected: "swap to a contract taker is not supported" },
  { field: "recipient", patch: { recipient: ENVELOPE_RECIPIENT }, expected: "open swap recipient must be zero" },
  { field: "recipientKind=1+recipient=0", patch: { recipientKind: 1n, recipient: new Uint8Array(32) }, expected: "named swap recipient must be nonzero" },
  { field: "toAccount", patch: { toAccount: ENVELOPE_TO_ACCOUNT }, expected: "swap transfer target must be inactive" },
  { field: "wantAmount=0", patch: { wantAmount: 0n }, expected: "swap must want a positive amount" },
  { field: "wantColor=primaryColor", patch: { wantColor: ENVELOPE_COLOUR }, expected: "swap legs must be different colours" },
  { field: "creditAccount=0", patch: { creditAccount: new Uint8Array(32) }, expected: "swap credit account must be supplied" },
];

const branchFor = (selector: number): readonly Perturbation[] =>
  selector === 2 || selector === 3 ? WITHDRAW : selector === 4 || selector === 5 ? TRANSFER : SWAP;

const row = (
  selector: number,
  mode: "native" | "evm",
  p: Perturbation,
  reach: string,
): EnvelopeRow => ({
  id: `s${selector}/${mode}/${p.field}`,
  selector,
  mode,
  expected: p.expected,
  patch: p.patch,
  reach,
});

const ENVELOPE: EnvelopeRow[] = [];

// The two selector-independent rules, probed once each on an otherwise clean action payload.
ENVELOPE.push({
  id: "any/native/selector=7",
  selector: null,
  mode: "native",
  expected: "unknown execute selector",
  patch: { selector: 7n },
  reach: "first assert in assertActionEnvelope; nothing precedes it",
});
ENVELOPE.push({
  id: "any/native/authMode=2",
  selector: null,
  mode: "native",
  expected: "unknown authorization mode",
  patch: { authMode: 2n },
  reach: "second assert in assertActionEnvelope; the selector is in range",
});

for (const p of SELECTOR_0) {
  ENVELOPE.push(row(0, "native", p, "selector-0 branch; every other selector-0 rule is satisfied by the base"));
}
for (const p of SELECTOR_1) {
  ENVELOPE.push(row(1, "evm", p, "selector-1 branch; every other selector-1 rule is satisfied by the base"));
}
for (const selector of [2, 3, 4, 5, 6]) {
  for (const mode of ["native", "evm"] as const) {
    const common = mode === "native" ? ACTION_COMMON_NATIVE : ACTION_COMMON_EVM;
    for (const p of common) {
      ENVELOPE.push(row(selector, mode, p, "shared action rules, which run before the per-selector branch"));
    }
    for (const p of branchFor(selector)) {
      ENVELOPE.push(row(selector, mode, p, "per-selector branch; the shared rules are satisfied by the base"));
    }
  }
}

export const ENVELOPE_ROWS: readonly EnvelopeRow[] = ENVELOPE;

// --- the post-envelope half: metadata only, probes live in the test --------------------------------
export const POST_ENVELOPE_ROWS: readonly PostEnvelopeRow[] = [
  { id: "constructor/zero-domain", selector: null, mode: "constructor", expected: "deployment domain must be nonzero", reach: "the constructor's only assert; no other circuit can reach it" },
  { id: "pure/evmStructHashFor/selector=0", selector: 0, mode: "pure", expected: "EIP-712 selector must be 1..6", reach: "unreachable through execute (the envelope refuses selector 0 before the digest), reachable through the exported pure oracle" },
  { id: "s1/evm/account-id-mismatch", selector: 1, mode: "evm", expected: "EVM registration account id mismatch", reach: "envelope-clean registration whose account is not the one owner+salt derive" },
  { id: "s1/evm/deadline-below-horizon", selector: 1, mode: "evm", expected: "EVM authorization deadline cannot satisfy the horizon", reach: "validUntil = 3600, the first assert of assertLiveDeadline" },
  { id: "s1/evm/deadline-beyond-horizon", selector: 1, mode: "evm", expected: "EVM authorization deadline exceeds 3600-second horizon", reach: "validUntil = block time + 3601, so earliest > block time" },
  { id: "s1/evm/expired", selector: 1, mode: "evm", expected: "EVM authorization has expired", reach: "validUntil = block time, so blockTimeLt fails" },
  { id: "s1/evm/signature-does-not-verify", selector: 1, mode: "evm", expected: "EVM registration signature does not verify", reach: "signature taken over a different deployment domain, so the recomputed digest differs" },
  { id: "s1/evm/signer-not-owner", selector: 1, mode: "evm", expected: "EVM registration signer does not match owner", reach: "a valid signature by another key over the same digest; the point is the caller's argument" },
  { id: "s1/evm/duplicate-registration", selector: 1, mode: "evm", expected: "account already registered", reach: "the same registration replayed after it committed" },
  { id: "s4/evm/unregistered-gateway-account", selector: 4, mode: "evm", expected: "gateway account is not registered", reach: "EVM action naming an account id that was never registered" },
  { id: "s4/evm/native-account-in-evm-mode", selector: 4, mode: "evm", expected: "authorization mode does not match account record", reach: "EVM action naming a registered NATIVE account" },
  { id: "s4/evm/wrong-stored-owner", selector: 4, mode: "evm", expected: "signed owner does not match stored owner", reach: "EVM action on a registered EVM account with the other owner in the envelope" },
  { id: "s4/evm/stale-nonce", selector: 4, mode: "evm", expected: "EVM nonce mismatch", reach: "nonce below the stored one after one committed action" },
  { id: "s4/evm/future-nonce", selector: 4, mode: "evm", expected: "EVM nonce mismatch", reach: "nonce above the stored one" },
  { id: "s4/evm/signature-does-not-verify", selector: 4, mode: "evm", expected: "EVM signature does not verify", reach: "action signature taken over a different deployment domain" },
  { id: "s4/evm/signer-not-owner", selector: 4, mode: "evm", expected: "EVM signer does not control account", reach: "a valid signature by another key over the same digest" },
  { id: "s4/native/unregistered-witness", selector: 4, mode: "native", expected: "caller's owner witness matches no registered account", reach: "the witness choke point, driven with a secret whose commitment was never registered" },
  { id: "s4/native/witness-transcript-mismatch", selector: 4, mode: "native", expected: "native witness does not match supplied account transcript", reach: "a registered witness acting on another account's envelope" },
  { id: "s4/native/unregistered-destination", selector: 4, mode: "native", expected: "destination account is not registered", reach: "custodyDispatch guard 1, before the balance guard" },
  { id: "s4/native/self-transfer", selector: 4, mode: "native", expected: "internal transfer to the same account", reach: "custodyDispatch guard 1, destination registered and equal to the source" },
  { id: "s4/native/shielded-balance-too-low", selector: 4, mode: "native", expected: "account colour balance too low", reach: "custodyDispatch guard 2, shielded family" },
  { id: "s5/native/unshielded-balance-too-low", selector: 5, mode: "native", expected: "account colour balance too low", reach: "custodyDispatch guard 2, unshielded family" },
  { id: "s3/native/contract-unshielded-short", selector: 3, mode: "native", expected: "contract unshielded balance too low", reach: "the unshielded give leg; the simulator's contract holds no unshielded balance" },
  { id: "s6/native/unregistered-swap-credit", selector: 6, mode: "native", expected: "credit account is not registered", reach: "custodyDispatch guard 4, after the pool guard" },
  { id: "deposit/shielded/unregistered", selector: null, mode: "deposit", expected: "credit account is not registered", reach: "depositShielded's second assert" },
  { id: "deposit/unshielded/unregistered", selector: null, mode: "deposit", expected: "credit account is not registered", reach: "depositUnshielded's second assert" },
  { id: "deposit/shielded/zero-value", selector: null, mode: "deposit", expected: "deposit must be positive", reach: "depositShielded's first assert" },
  { id: "deposit/unshielded/zero-amount", selector: null, mode: "deposit", expected: "deposit must be positive", reach: "depositUnshielded's first assert" },
];

// --- the allow-list: assert strings NO row can produce, each with its reason -------------------------
//
// Every entry here is an assert that cannot be the FIRST failing guard on any constructible input.
// They are defence in depth, not dead weight, and the coverage assertion permits exactly these and
// nothing else. Anything that leaves this list must gain a row; anything that joins it must gain a
// reason on the same line.
export const COVERAGE_ALLOW_LIST: readonly { readonly message: string; readonly why: string }[] = [
  {
    message: "native record carries EVM state",
    why: "accountRecord's mode-0 invariant: evmOwners/evmNonces are written only on the mode-1 registration path, so a native record with EVM state cannot be built",
  },
  {
    message: "EVM record is incomplete",
    why: "accountRecord's mode-1 invariant: the two EVM maps are written together in execute, so half an EVM record cannot be built",
  },
  {
    message: "EVM account record is incomplete",
    why: "the same invariant at authenticatedActionAccount's EVM branch",
  },
  {
    message: "native account carries EVM state",
    why: "the same invariant at authenticatedActionAccount's native branch",
  },
  {
    message: "registered account has no authorization mode",
    why: "registerAccount inserts into accounts and accountModes together, so a registered account always has a mode (asserted at two sites, neither reachable)",
  },
  {
    message: "unknown account authorization mode",
    why: "modes are written only as 0 or 1, and both sites are reached only when the mode is not 0",
  },
  {
    message: "account id must be nonzero",
    why: "registerAccount is private: execute reaches it only with ownerCommitment(witness) — a persistentCommit, never the zero word — or with the EVM-derived id the envelope already forced nonzero (NOT in the T0.1.1 task list; added by T0.1, see finding F-T0.1-1)",
  },
  {
    message: "account mode collision",
    why: "accounts and accountModes are only ever written together, so `!accounts.member(a) && accountModes.member(a)` is unconstructible (NOT in the T0.1.1 task list; added by T0.1, see finding F-T0.1-1)",
  },
  {
    message: "EVM account cannot enter native authorization",
    why: "authenticatedNativeAccount only ever sees ownerCommitment(witness); for it to carry mode 1 that commitment would have to collide with an evmAccountIdFor value (NOT in the T0.1.1 task list; added by T0.1, see finding F-T0.1-1)",
  },
  {
    message: "no pooled coin for this colour",
    why: "shadowed by custodyDispatch guard 2 through the pool-total invariant (pools.member(C) <=> sum of colour-C cells > 0); the analysis and its executed ordering probes are in k20-parity.test.ts (NOT in the T0.1.1 task list; added by T0.1, see finding F-T0.1-1)",
  },
  {
    message: "pooled colour balance too low",
    why: "shadowed by custodyDispatch guard 2 by the same invariant; same probes in k20-parity.test.ts (NOT in the T0.1.1 task list; added by T0.1, see finding F-T0.1-1)",
  },
  {
    message: "EVM nonce overflow",
    why: "two independent blocks: p.nonce must equal the stored nonce, which only 2^64-2 committed actions could raise to 2^64-1; and the `as Uint<64>` cast on `p.nonce + 1` (manager.compact:1408) is emitted immediately BEFORE the assert, so even a seeded state would report the cast failure, never this string (task T0.1.1 asked for a legitimate path first; there is none — see finding F-T0.1-2)",
  },
];

/** Everything the fixture pins, in one stable order. */
export function fixtureView(): {
  note: string;
  rows: RefusalRowView[];
  allowList: { message: string; why: string }[];
} {
  return {
    note:
      "Frozen expectations for tests/simulation/refusal-matrix.test.ts (project 00014, FR-016). " +
      "Every `expected` is an assert string in contracts/**/*.compact; the runtime reports it as " +
      "`failed assert: <expected>`. Regenerate with: tsx lib/refusal-matrix.ts --write",
    rows: [...ENVELOPE_ROWS, ...POST_ENVELOPE_ROWS].map(({ id, selector, mode, expected }) => ({
      id,
      selector,
      mode,
      expected,
    })),
    allowList: COVERAGE_ALLOW_LIST.map(({ message, why }) => ({ message, why })),
  };
}

export const fixtureJson = (): string => `${JSON.stringify(fixtureView(), null, 2)}\n`;

// `tsx lib/refusal-matrix.ts --write` rewrites the frozen fixture; without --write it only reports.
if (process.argv[1] && process.argv[1].endsWith("refusal-matrix.ts")) {
  const target = fileURLToPath(new URL("../fixtures/00014-refusal-matrix.json", import.meta.url));
  const json = fixtureJson();
  if (process.argv.includes("--write")) {
    writeFileSync(target, json, "utf8");
    console.log(`wrote ${target} (${fixtureView().rows.length} rows)`);
  } else {
    console.log(`${fixtureView().rows.length} rows, ${COVERAGE_ALLOW_LIST.length} allow-listed strings`);
  }
}
