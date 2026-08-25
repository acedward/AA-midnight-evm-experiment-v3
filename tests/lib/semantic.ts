import {
  ZERO_32,
  addressWord,
  bytes32Word,
  bytesToHex,
  equalBytes,
  hexToBytes,
  keccak,
  keccakHex,
  uintWord,
  utf8,
  words,
  type Hex20,
  type Hex32,
} from "./bytes.js";
import { TYPE_DEFINITIONS } from "./schema.js";

export const SEMANTIC_COMMITMENT_VERSION = "AA_V3_SEMANTIC_COMMITMENT_V1";
export const CALL_TRANSCRIPT_VERSION = "AA_V3_MANAGER_CALL_TRANSCRIPT_V1";
export const NATIVE_AUTH_RESULT_VERSION = "AA_V3_NATIVE_AUTH_RESULT_V1";
export const ENTRYPOINT = "execute";
export const SEMANTIC_PREIMAGE_WORDS = 32;
export const SEMANTIC_PREIMAGE_BYTES = SEMANTIC_PREIMAGE_WORDS * 32;

export const SEMANTIC_TAG_HASH = keccakHex(utf8(SEMANTIC_COMMITMENT_VERSION));
export const CALL_TRANSCRIPT_TAG_HASH = keccakHex(utf8(CALL_TRANSCRIPT_VERSION));
export const NATIVE_AUTH_RESULT_TAG_HASH = keccakHex(utf8(NATIVE_AUTH_RESULT_VERSION));
export const ENTRYPOINT_HASH = keccakHex(utf8(ENTRYPOINT));

export type Selector = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type AuthMode = "native" | "evm";

export interface SemanticActionFields {
  owner?: Hex20;
  validUntil?: bigint;
  accountSalt?: Hex32;
  primaryColor?: Hex32;
  primaryAmount?: bigint;
  recipientKind?: bigint;
  recipient?: Hex32;
  toAccountId?: Hex32;
  wantNonce?: Hex32;
  wantColor?: Hex32;
  wantAmount?: bigint;
  creditAccountId?: Hex32;
}

export interface NonDustImbalance {
  /** 1 = shielded, 2 = unshielded. DUST has no representation. */
  family: 1 | 2;
  color: Hex32;
  /** 1 = negative/deficit, 2 = positive/surplus. */
  direction: 1 | 2;
  amount: bigint;
}

export interface SemanticCommitmentInput {
  manager: Hex32;
  deploymentDomain: Hex32;
  selector: Selector;
  accountId: Hex32;
  authMode: AuthMode;
  /** EIP-712 digest for EVM; nativeAuthResult(accountId) for native. */
  authResult: Hex32;
  /** Signed/current EVM nonce; zero for registration and all native authorization. */
  nonce: bigint;
  action: SemanticActionFields;
  nonDustImbalances: readonly NonDustImbalance[];
}

export interface SemanticCommitment {
  preimage: Uint8Array;
  commitment: Hex32;
  callTranscriptHash: Hex32;
  actionUnionHash: Hex32;
}

const ACTION_KEYS = [
  "owner",
  "validUntil",
  "accountSalt",
  "primaryColor",
  "primaryAmount",
  "recipientKind",
  "recipient",
  "toAccountId",
  "wantNonce",
  "wantColor",
  "wantAmount",
  "creditAccountId",
] as const satisfies readonly (keyof SemanticActionFields)[];

function expectedActionKeys(selector: Selector, authMode: AuthMode): Set<string> {
  const authKeys = authMode === "evm" ? ["owner", "validUntil"] : [];
  if (selector === 0) return new Set();
  if (selector === 1) return new Set(["owner", "validUntil", "accountSalt"]);
  if (selector === 2 || selector === 3) {
    return new Set([
      ...authKeys,
      "primaryColor",
      "primaryAmount",
      "recipientKind",
      "recipient",
    ]);
  }
  if (selector === 4 || selector === 5) {
    return new Set([...authKeys, "primaryColor", "primaryAmount", "toAccountId"]);
  }
  return new Set([
    ...authKeys,
    "primaryColor",
    "primaryAmount",
    "recipientKind",
    "recipient",
    "wantNonce",
    "wantColor",
    "wantAmount",
    "creditAccountId",
  ]);
}

function validateRecipient(selector: Selector, action: SemanticActionFields): void {
  if (selector !== 2 && selector !== 3 && selector !== 6) return;
  const kind = action.recipientKind!;
  if (selector === 2 && kind !== 0n && kind !== 1n) {
    throw new RangeError("WithdrawShielded recipientKind must be 0 or 1");
  }
  if (selector === 3 && kind !== 0n && kind !== 1n) {
    throw new RangeError("WithdrawUnshielded recipientKind must be 0 or 1");
  }
  if (selector === 6 && kind !== 0n && kind !== 1n && kind !== 2n) {
    throw new RangeError("OpenSwapShielded recipientKind must be 0, 1, or 2");
  }
  if (selector === 6 && kind === 0n && action.recipient !== ZERO_32) {
    throw new RangeError("OpenSwapShielded recipientKind 0 requires a zero recipient");
  }
}

function canonicalActionWords(
  selector: Selector,
  authMode: AuthMode,
  action: SemanticActionFields,
): Uint8Array[] {
  if (selector === 0 && authMode !== "native") throw new RangeError("selector 0 requires native auth");
  if (selector === 1 && authMode !== "evm") throw new RangeError("selector 1 requires EVM auth");
  const expected = expectedActionKeys(selector, authMode);
  const actual = Object.keys(action);
  for (const key of actual) {
    if (!ACTION_KEYS.includes(key as keyof SemanticActionFields) || !expected.has(key)) {
      throw new RangeError(`noncanonical inactive action field: ${key}`);
    }
    if ((action as Record<string, unknown>)[key] === undefined) {
      throw new RangeError(`action field ${key} must not be undefined`);
    }
  }
  for (const key of expected) {
    if (!Object.prototype.hasOwnProperty.call(action, key)) {
      throw new RangeError(`missing active action field: ${key}`);
    }
  }
  validateRecipient(selector, action);
  return [
    action.owner ? addressWord(action.owner, "semantic owner") : new Uint8Array(32),
    action.validUntil === undefined
      ? new Uint8Array(32)
      : uintWord(action.validUntil, 64, "semantic validUntil"),
    action.accountSalt ? bytes32Word(action.accountSalt, "semantic accountSalt") : new Uint8Array(32),
    action.primaryColor
      ? bytes32Word(action.primaryColor, "semantic primaryColor")
      : new Uint8Array(32),
    action.primaryAmount === undefined
      ? new Uint8Array(32)
      : uintWord(action.primaryAmount, 128, "semantic primaryAmount"),
    action.recipientKind === undefined
      ? new Uint8Array(32)
      : uintWord(action.recipientKind, 8, "semantic recipientKind"),
    action.recipient ? bytes32Word(action.recipient, "semantic recipient") : new Uint8Array(32),
    action.toAccountId
      ? bytes32Word(action.toAccountId, "semantic toAccountId")
      : new Uint8Array(32),
    action.wantNonce ? bytes32Word(action.wantNonce, "semantic wantNonce") : new Uint8Array(32),
    action.wantColor ? bytes32Word(action.wantColor, "semantic wantColor") : new Uint8Array(32),
    action.wantAmount === undefined
      ? new Uint8Array(32)
      : uintWord(action.wantAmount, 128, "semantic wantAmount"),
    action.creditAccountId
      ? bytes32Word(action.creditAccountId, "semantic creditAccountId")
      : new Uint8Array(32),
  ];
}

function primaryTypeHash(selector: Selector): Hex32 {
  if (selector === 0) return ZERO_32;
  const definition = Object.values(TYPE_DEFINITIONS).find((item) => item.selector === selector);
  if (!definition) throw new RangeError(`unknown selector ${selector}`);
  return definition.typeHash;
}

export function nativeAuthResult(accountId: Hex32): Hex32 {
  return keccakHex(
    words(
      bytes32Word(NATIVE_AUTH_RESULT_TAG_HASH, "native auth result tag"),
      bytes32Word(accountId, "native accountId"),
    ),
  );
}

function canonicalImbalances(input: readonly NonDustImbalance[]): NonDustImbalance[] {
  if (input.length > 2) throw new RangeError("semantic commitment supports at most two non-DUST slots");
  const values = input.map((item) => ({ ...item }));
  for (const item of values) {
    if (item.family !== 1 && item.family !== 2) throw new RangeError("invalid non-DUST family");
    if (item.direction !== 1 && item.direction !== 2) throw new RangeError("invalid imbalance direction");
    if (item.amount <= 0n || item.amount >= 1n << 128n) {
      throw new RangeError("non-DUST imbalance amount must fit positive uint128");
    }
    bytes32Word(item.color, "imbalance color");
  }
  values.sort((left, right) => {
    if (left.family !== right.family) return left.family - right.family;
    const leftColor = hexToBytes(left.color, 32);
    const rightColor = hexToBytes(right.color, 32);
    for (let index = 0; index < 32; index += 1) {
      if (leftColor[index] !== rightColor[index]) return leftColor[index]! - rightColor[index]!;
    }
    return 0;
  });
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1]!.family === values[index]!.family && values[index - 1]!.color === values[index]!.color) {
      throw new RangeError("duplicate non-DUST family/color slot");
    }
  }
  return values;
}

function imbalanceWords(input: readonly NonDustImbalance[]): Uint8Array[] {
  const canonical = canonicalImbalances(input);
  const output: Uint8Array[] = [];
  for (let index = 0; index < 2; index += 1) {
    const item = canonical[index];
    if (!item) {
      output.push(new Uint8Array(32), new Uint8Array(32), new Uint8Array(32), new Uint8Array(32));
      continue;
    }
    output.push(
      uintWord(BigInt(item.family), 8, "imbalance family"),
      bytes32Word(item.color, "imbalance color"),
      uintWord(BigInt(item.direction), 8, "imbalance direction"),
      uintWord(item.amount, 128, "imbalance amount"),
    );
  }
  return output;
}

export function buildSemanticCommitment(input: SemanticCommitmentInput): SemanticCommitment {
  const manager = bytes32Word(input.manager, "semantic manager");
  const deploymentDomain = bytes32Word(input.deploymentDomain, "semantic deploymentDomain");
  const accountId = bytes32Word(input.accountId, "semantic accountId");
  const authResult = bytes32Word(input.authResult, "semantic authResult");
  if (input.authMode === "native") {
    if (input.nonce !== 0n) throw new RangeError("native authorization requires nonce zero");
    const expected = hexToBytes(nativeAuthResult(input.accountId), 32);
    if (!equalBytes(authResult, expected)) throw new RangeError("native authResult is not canonical");
  }
  if ((input.selector === 0 || input.selector === 1) && input.nonce !== 0n) {
    throw new RangeError("registration semantic nonce must be zero");
  }
  const selectorWord = uintWord(BigInt(input.selector), 8, "semantic selector");
  const primaryHash = bytes32Word(primaryTypeHash(input.selector), "semantic primary type hash");
  const actionWords = canonicalActionWords(input.selector, input.authMode, input.action);
  const actionUnionHash = keccakHex(words(...actionWords));
  const callTranscriptHash = keccakHex(
    words(
      bytes32Word(CALL_TRANSCRIPT_TAG_HASH, "call transcript tag"),
      manager,
      bytes32Word(ENTRYPOINT_HASH, "entrypoint hash"),
      selectorWord,
      primaryHash,
      accountId,
      authResult,
      bytes32Word(actionUnionHash, "action union hash"),
    ),
  );
  const canonicalImbalanceValues = canonicalImbalances(input.nonDustImbalances);
  const preimage = words(
    bytes32Word(SEMANTIC_TAG_HASH, "semantic tag"),
    manager,
    deploymentDomain,
    bytes32Word(ENTRYPOINT_HASH, "entrypoint hash"),
    selectorWord,
    primaryHash,
    accountId,
    uintWord(input.authMode === "native" ? 0n : 1n, 8, "auth mode"),
    authResult,
    uintWord(input.nonce, 64, "semantic nonce"),
    ...actionWords,
    bytes32Word(callTranscriptHash, "call transcript hash"),
    uintWord(BigInt(canonicalImbalanceValues.length), 8, "imbalance count"),
    ...imbalanceWords(canonicalImbalanceValues),
  );
  if (preimage.length !== SEMANTIC_PREIMAGE_BYTES) {
    throw new Error(`semantic preimage must be ${SEMANTIC_PREIMAGE_BYTES} bytes, got ${preimage.length}`);
  }
  return {
    preimage,
    commitment: bytesToHex(keccak(preimage)) as Hex32,
    callTranscriptHash,
    actionUnionHash,
  };
}
