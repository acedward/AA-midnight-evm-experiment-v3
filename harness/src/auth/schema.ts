import type { Hex20, Hex32 } from "./bytes.js";

export const AUTH_CODEC_VERSION = "AUTH-EIP712-AA-V3-V1";
export const DOMAIN_NAME = "AA v3 EVM Manager";
export const DOMAIN_VERSION = "1";
export const DOMAIN_ENCODE_TYPE =
  "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)";
export const ACCOUNT_ID_TAG = "AA_V3_EVM_ACCOUNT_ID_V1";

export const FROZEN_HASHES = {
  accountIdTag: "0x55bc940f835337f1224c181110b2b77f57ed694cae0c4bf8ff6bb3e03be6a988",
  domainType: "0x36c25de3e541d5d970f66e4210d728721220fff5c077cc6cd008b3a0c62adab7",
  domainName: "0xb2a161c1e1fe09f631585b3bda0e4a22f317d7c663c582a07c1d683e61fdcdb1",
  domainVersion: "0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6",
} as const satisfies Record<string, Hex32>;

export const EIP712_DOMAIN_FIELDS = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
] as const;

export type PrimaryType =
  | "RegisterEvmAccount"
  | "WithdrawShielded"
  | "WithdrawUnshielded"
  | "TransferInternalShielded"
  | "TransferInternalUnshielded"
  | "OpenSwapShielded";

export type FieldType = "bytes32" | "address" | "uint64" | "uint128" | "uint8";

export interface FieldDefinition {
  readonly name: string;
  readonly type: FieldType;
}

export interface TypeDefinition {
  readonly selector: 1 | 2 | 3 | 4 | 5 | 6;
  readonly encodeType: string;
  readonly typeHash: Hex32;
  readonly fields: readonly FieldDefinition[];
}

export const TYPE_DEFINITIONS: Readonly<Record<PrimaryType, TypeDefinition>> = {
  RegisterEvmAccount: {
    selector: 1,
    encodeType:
      "RegisterEvmAccount(bytes32 manager,bytes32 accountId,address owner,bytes32 accountSalt,uint64 validUntil)",
    typeHash: "0xe6ace6c70a9d92ef851c2e2a67b2309017b051d39e0554c746274a176959ac4f",
    fields: [
      { name: "manager", type: "bytes32" },
      { name: "accountId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "accountSalt", type: "bytes32" },
      { name: "validUntil", type: "uint64" },
    ],
  },
  WithdrawShielded: {
    selector: 2,
    encodeType:
      "WithdrawShielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 color,uint128 amount,uint8 recipientKind,bytes32 recipient)",
    typeHash: "0x717e1e74129852bd436744a5a1108f0db902927031f5e7799618ec129366d61e",
    fields: [
      { name: "manager", type: "bytes32" },
      { name: "accountId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "color", type: "bytes32" },
      { name: "amount", type: "uint128" },
      { name: "recipientKind", type: "uint8" },
      { name: "recipient", type: "bytes32" },
    ],
  },
  WithdrawUnshielded: {
    selector: 3,
    encodeType:
      "WithdrawUnshielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 color,uint128 amount,uint8 recipientKind,bytes32 recipient)",
    typeHash: "0xb60129ea6ca4c1b51d866077d11cdb0230e6065876a54206fece04413edaba9d",
    fields: [
      { name: "manager", type: "bytes32" },
      { name: "accountId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "color", type: "bytes32" },
      { name: "amount", type: "uint128" },
      { name: "recipientKind", type: "uint8" },
      { name: "recipient", type: "bytes32" },
    ],
  },
  TransferInternalShielded: {
    selector: 4,
    encodeType:
      "TransferInternalShielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 toAccountId,bytes32 color,uint128 amount)",
    typeHash: "0x06beb83ec8ded3a8080bfab591d89a1b86ed9e3f8df6c10ed3677416d0a56064",
    fields: [
      { name: "manager", type: "bytes32" },
      { name: "accountId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "toAccountId", type: "bytes32" },
      { name: "color", type: "bytes32" },
      { name: "amount", type: "uint128" },
    ],
  },
  TransferInternalUnshielded: {
    selector: 5,
    encodeType:
      "TransferInternalUnshielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 toAccountId,bytes32 color,uint128 amount)",
    typeHash: "0x46e96f4496c182e98395b689701a945cbdb47543574242cc17f9b6448c049a07",
    fields: [
      { name: "manager", type: "bytes32" },
      { name: "accountId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "toAccountId", type: "bytes32" },
      { name: "color", type: "bytes32" },
      { name: "amount", type: "uint128" },
    ],
  },
  OpenSwapShielded: {
    selector: 6,
    encodeType:
      "OpenSwapShielded(bytes32 manager,bytes32 accountId,address owner,uint64 nonce,uint64 validUntil,bytes32 giveColor,uint128 giveAmount,uint8 recipientKind,bytes32 recipient,bytes32 wantNonce,bytes32 wantColor,uint128 wantAmount,bytes32 creditAccountId)",
    typeHash: "0xf787d7f963e89efcda8e6a546bafff33388cbdf44b81f6f5950c4bd3b0665848",
    fields: [
      { name: "manager", type: "bytes32" },
      { name: "accountId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "giveColor", type: "bytes32" },
      { name: "giveAmount", type: "uint128" },
      { name: "recipientKind", type: "uint8" },
      { name: "recipient", type: "bytes32" },
      { name: "wantNonce", type: "bytes32" },
      { name: "wantColor", type: "bytes32" },
      { name: "wantAmount", type: "uint128" },
      { name: "creditAccountId", type: "bytes32" },
    ],
  },
};

interface BaseAction {
  manager: Hex32;
  accountId: Hex32;
  owner: Hex20;
  validUntil: bigint;
}

export interface RegisterEvmAccount extends BaseAction {
  primaryType: "RegisterEvmAccount";
  accountSalt: Hex32;
}

export interface WithdrawAction<
  P extends "WithdrawShielded" | "WithdrawUnshielded",
> extends BaseAction {
  primaryType: P;
  nonce: bigint;
  color: Hex32;
  amount: bigint;
  recipientKind: bigint;
  recipient: Hex32;
}

export interface TransferAction<
  P extends "TransferInternalShielded" | "TransferInternalUnshielded",
> extends BaseAction {
  primaryType: P;
  nonce: bigint;
  toAccountId: Hex32;
  color: Hex32;
  amount: bigint;
}

export interface OpenSwapShielded extends BaseAction {
  primaryType: "OpenSwapShielded";
  nonce: bigint;
  giveColor: Hex32;
  giveAmount: bigint;
  recipientKind: bigint;
  recipient: Hex32;
  wantNonce: Hex32;
  wantColor: Hex32;
  wantAmount: bigint;
  creditAccountId: Hex32;
}

export type Eip712Action =
  | RegisterEvmAccount
  | WithdrawAction<"WithdrawShielded">
  | WithdrawAction<"WithdrawUnshielded">
  | TransferAction<"TransferInternalShielded">
  | TransferAction<"TransferInternalUnshielded">
  | OpenSwapShielded;

export function definitionFor(action: Eip712Action): TypeDefinition {
  return TYPE_DEFINITIONS[action.primaryType];
}
