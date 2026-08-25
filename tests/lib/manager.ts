import { bytesToHex, hexToBytes, type Hex20, type Hex32 } from "./bytes.js";
import { computeDigest } from "./codec.js";
import type { Eip712Action } from "./schema.js";
import {
  buildSemanticCommitment,
  type NonDustImbalance,
  type SemanticActionFields,
  type SemanticCommitment,
} from "./semantic.js";
import { parseSignature, recoverSigner, type AffinePointTransport } from "./signature.js";

export interface ManagerExecutePayload {
  readonly selector: bigint;
  readonly authMode: bigint;
  readonly account: Uint8Array;
  readonly owner: Uint8Array;
  readonly accountSalt: Uint8Array;
  readonly nonce: bigint;
  readonly validUntil: bigint;
  readonly primaryColor: Uint8Array;
  readonly primaryAmount: bigint;
  readonly recipientKind: bigint;
  readonly recipient: Uint8Array;
  readonly toAccount: Uint8Array;
  readonly wantNonce: Uint8Array;
  readonly wantColor: Uint8Array;
  readonly wantAmount: bigint;
  readonly creditAccount: Uint8Array;
}

export interface CompactEcdsaSignature {
  readonly r: bigint;
  readonly s: bigint;
}

export interface CompactSecp256k1Point {
  readonly x: bigint;
  readonly y: bigint;
  readonly identity: false;
}

export interface PreparedEvmExecute {
  readonly payload: ManagerExecutePayload;
  readonly signature: CompactEcdsaSignature;
  readonly point: CompactSecp256k1Point;
  readonly digest: Hex32;
  readonly signer: Hex20;
}

const zero = (length: number): Uint8Array => new Uint8Array(length);

export function emptyExecutePayload(): ManagerExecutePayload {
  return {
    selector: 0n,
    authMode: 0n,
    account: zero(32),
    owner: zero(20),
    accountSalt: zero(32),
    nonce: 0n,
    validUntil: 0n,
    primaryColor: zero(32),
    primaryAmount: 0n,
    recipientKind: 0n,
    recipient: zero(32),
    toAccount: zero(32),
    wantNonce: zero(32),
    wantColor: zero(32),
    wantAmount: 0n,
    creditAccount: zero(32),
  };
}

/** Convert one frozen EIP-712 action into the exact fixed-width Compact execute envelope. */
export function executePayloadForAction(action: Eip712Action): ManagerExecutePayload {
  const base = {
    ...emptyExecutePayload(),
    selector:
      action.primaryType === "RegisterEvmAccount"
        ? 1n
        : action.primaryType === "WithdrawShielded"
          ? 2n
          : action.primaryType === "WithdrawUnshielded"
            ? 3n
            : action.primaryType === "TransferInternalShielded"
              ? 4n
              : action.primaryType === "TransferInternalUnshielded"
                ? 5n
                : 6n,
    authMode: 1n,
    account: hexToBytes(action.accountId, 32),
    owner: hexToBytes(action.owner, 20),
    validUntil: action.validUntil,
  };

  if (action.primaryType === "RegisterEvmAccount") {
    return { ...base, accountSalt: hexToBytes(action.accountSalt, 32) };
  }
  if (action.primaryType === "WithdrawShielded" || action.primaryType === "WithdrawUnshielded") {
    return {
      ...base,
      nonce: action.nonce,
      primaryColor: hexToBytes(action.color, 32),
      primaryAmount: action.amount,
      recipientKind: action.recipientKind,
      recipient: hexToBytes(action.recipient, 32),
    };
  }
  if (
    action.primaryType === "TransferInternalShielded" ||
    action.primaryType === "TransferInternalUnshielded"
  ) {
    return {
      ...base,
      nonce: action.nonce,
      primaryColor: hexToBytes(action.color, 32),
      primaryAmount: action.amount,
      toAccount: hexToBytes(action.toAccountId, 32),
    };
  }
  return {
    ...base,
    nonce: action.nonce,
    primaryColor: hexToBytes(action.giveColor, 32),
    primaryAmount: action.giveAmount,
    recipientKind: action.recipientKind,
    recipient: hexToBytes(action.recipient, 32),
    wantNonce: hexToBytes(action.wantNonce, 32),
    wantColor: hexToBytes(action.wantColor, 32),
    wantAmount: action.wantAmount,
    creditAccount: hexToBytes(action.creditAccountId, 32),
  };
}

/**
 * Parse the 65-byte wallet signature, recover its affine point, and bind both to the same digest
 * the Manager recomputes. Normal callers get the strict low-s policy; tests may explicitly opt out
 * to carry a mathematically valid high-s twin into the nonce-replay circuit test.
 */
export function prepareEvmExecute(
  action: Eip712Action,
  deploymentDomain: Hex32,
  walletSignature: string | Uint8Array,
  options: { requireLowS?: boolean } = {},
): PreparedEvmExecute {
  const digest = computeDigest(action, deploymentDomain).digest;
  const recovered = recoverSigner(digest, walletSignature, options);
  const parsed = parseSignature(walletSignature, options);
  return {
    payload: executePayloadForAction(action),
    signature: { r: parsed.r, s: parsed.s },
    point: { x: recovered.point.x, y: recovered.point.y, identity: false },
    digest,
    signer: recovered.address,
  };
}

/** Turn a Compact/runtime 32-byte address into the codec's canonical 0x-prefixed form. */
export function managerAddressHex(address: string | Uint8Array): Hex32 {
  if (address instanceof Uint8Array) return bytesToHex(address) as Hex32;
  return bytesToHex(hexToBytes(address.startsWith("0x") ? address : `0x${address}`, 32)) as Hex32;
}

export function compactPoint(point: AffinePointTransport): CompactSecp256k1Point {
  return { x: point.x, y: point.y, identity: false };
}

/** Rebuild the frozen semantic preimage from the exact execute envelope and authenticated result. */
export function semanticCommitmentForExecute(
  manager: Hex32,
  deploymentDomain: Hex32,
  payload: ManagerExecutePayload,
  authenticatedAccount: Hex32,
  authResult: Hex32,
): SemanticCommitment {
  const selector = Number(payload.selector);
  if (!Number.isInteger(selector) || selector < 0 || selector > 6) {
    throw new RangeError(`unknown execute selector ${payload.selector}`);
  }
  if (payload.authMode !== 0n && payload.authMode !== 1n) {
    throw new RangeError(`unknown authorization mode ${payload.authMode}`);
  }
  const evm = payload.authMode === 1n;
  const authFields: SemanticActionFields = evm
    ? { owner: bytesToHex(payload.owner) as Hex20, validUntil: payload.validUntil }
    : {};
  let action: SemanticActionFields;
  let nonDustImbalances: NonDustImbalance[] = [];
  if (selector === 0) {
    action = {};
  } else if (selector === 1) {
    action = { ...authFields, accountSalt: bytesToHex(payload.accountSalt) as Hex32 };
  } else if (selector === 2 || selector === 3) {
    action = {
      ...authFields,
      primaryColor: bytesToHex(payload.primaryColor) as Hex32,
      primaryAmount: payload.primaryAmount,
      recipientKind: payload.recipientKind,
      recipient: bytesToHex(payload.recipient) as Hex32,
    };
  } else if (selector === 4 || selector === 5) {
    action = {
      ...authFields,
      primaryColor: bytesToHex(payload.primaryColor) as Hex32,
      primaryAmount: payload.primaryAmount,
      toAccountId: bytesToHex(payload.toAccount) as Hex32,
    };
  } else {
    const giveColor = bytesToHex(payload.primaryColor) as Hex32;
    const wantColor = bytesToHex(payload.wantColor) as Hex32;
    action = {
      ...authFields,
      primaryColor: giveColor,
      primaryAmount: payload.primaryAmount,
      recipientKind: payload.recipientKind,
      recipient: bytesToHex(payload.recipient) as Hex32,
      wantNonce: bytesToHex(payload.wantNonce) as Hex32,
      wantColor,
      wantAmount: payload.wantAmount,
      creditAccountId: bytesToHex(payload.creditAccount) as Hex32,
    };
    if (payload.recipientKind === 0n) {
      nonDustImbalances.push({
        family: 1,
        color: giveColor,
        direction: 2,
        amount: payload.primaryAmount,
      });
    }
    nonDustImbalances.push({
      family: 1,
      color: wantColor,
      direction: 1,
      amount: payload.wantAmount,
    });
  }
  return buildSemanticCommitment({
    manager,
    deploymentDomain,
    selector: selector as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    accountId: authenticatedAccount,
    authMode: evm ? "evm" : "native",
    authResult,
    nonce: evm ? payload.nonce : 0n,
    action,
    nonDustImbalances,
  });
}
