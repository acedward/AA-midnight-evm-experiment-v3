import {
  addressWord,
  bytes32Word,
  bytesToHex,
  concatBytes,
  hexToBytes,
  keccak,
  keccakHex,
  uintWord,
  utf8,
  words,
  type Hex20,
  type Hex32,
} from "./bytes.js";
import {
  DOMAIN_ENCODE_TYPE,
  DOMAIN_NAME,
  DOMAIN_VERSION,
  EIP712_DOMAIN_FIELDS,
  FROZEN_HASHES,
  TYPE_DEFINITIONS,
  definitionFor,
  type Eip712Action,
  type FieldDefinition,
  type PrimaryType,
} from "./schema.js";

export interface TypedDataV4Json {
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: PrimaryType;
  domain: {
    name: typeof DOMAIN_NAME;
    version: typeof DOMAIN_VERSION;
    verifyingContract: Hex20;
    salt: Hex32;
  };
  message: Record<string, string>;
}

export interface CodecHashes {
  managerAlias: Hex20;
  domainSeparator: Hex32;
  structHash: Hex32;
  digest: Hex32;
}

export interface EthSignTypedDataV4Request {
  method: "eth_signTypedData_v4";
  params: readonly [Hex20, string];
}

export function managerAlias(manager: Hex32): Hex20 {
  return bytesToHex(keccak(bytes32Word(manager, "manager")).slice(12)) as Hex20;
}

export function deriveAccountId(manager: Hex32, owner: Hex20, accountSalt: Hex32): Hex32 {
  const preimage = words(
    bytes32Word(FROZEN_HASHES.accountIdTag, "account ID type tag"),
    bytes32Word(manager, "manager"),
    addressWord(owner, "owner"),
    bytes32Word(accountSalt, "accountSalt"),
  );
  return keccakHex(preimage);
}

export function computeDomainSeparator(manager: Hex32, deploymentDomain: Hex32): Hex32 {
  const preimage = words(
    bytes32Word(FROZEN_HASHES.domainType, "domain type hash"),
    bytes32Word(FROZEN_HASHES.domainName, "domain name hash"),
    bytes32Word(FROZEN_HASHES.domainVersion, "domain version hash"),
    addressWord(managerAlias(manager), "manager alias"),
    bytes32Word(deploymentDomain, "deploymentDomain"),
  );
  return keccakHex(preimage);
}

function fieldWord(field: FieldDefinition, value: unknown): Uint8Array {
  if (field.type === "bytes32") return bytes32Word(String(value), field.name);
  if (field.type === "address") return addressWord(String(value), field.name);
  if (typeof value !== "bigint") throw new TypeError(`${field.name} must be a BigInt`);
  if (field.type === "uint64") return uintWord(value, 64, field.name);
  if (field.type === "uint128") return uintWord(value, 128, field.name);
  return uintWord(value, 8, field.name);
}

export function encodeStruct(action: Eip712Action): Uint8Array {
  const definition = definitionFor(action);
  const record = action as unknown as Record<string, unknown>;
  return words(
    bytes32Word(definition.typeHash, `${action.primaryType} type hash`),
    ...definition.fields.map((field) => fieldWord(field, record[field.name])),
  );
}

export function computeStructHash(action: Eip712Action): Hex32 {
  return keccakHex(encodeStruct(action));
}

export function computeDigest(
  action: Eip712Action,
  deploymentDomain: Hex32,
): CodecHashes {
  const alias = managerAlias(action.manager);
  const domainSeparator = computeDomainSeparator(action.manager, deploymentDomain);
  const structHash = computeStructHash(action);
  const digest = keccakHex(
    concatBytes(Uint8Array.of(0x19, 0x01), hexToBytes(domainSeparator, 32), hexToBytes(structHash, 32)),
  );
  return { managerAlias: alias, domainSeparator, structHash, digest };
}

export function buildTypedDataV4(
  action: Eip712Action,
  deploymentDomain: Hex32,
): TypedDataV4Json {
  const definition = definitionFor(action);
  const record = action as unknown as Record<string, unknown>;
  const message: Record<string, string> = {};
  for (const field of definition.fields) {
    const value = record[field.name];
    message[field.name] = typeof value === "bigint" ? value.toString(10) : String(value);
  }
  return {
    types: {
      EIP712Domain: EIP712_DOMAIN_FIELDS,
      [action.primaryType]: definition.fields,
    },
    primaryType: action.primaryType,
    domain: {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      verifyingContract: managerAlias(action.manager),
      salt: bytesToHex(bytes32Word(deploymentDomain, "deploymentDomain")) as Hex32,
    },
    message,
  };
}

export function buildEthSignTypedDataV4Request(
  action: Eip712Action,
  deploymentDomain: Hex32,
): EthSignTypedDataV4Request {
  const typedData = buildTypedDataV4(action, deploymentDomain);
  return {
    method: "eth_signTypedData_v4",
    params: [action.owner, JSON.stringify(typedData)],
  };
}

export function recomputeFrozenHashes(): Record<string, Hex32> {
  return {
    accountIdTag: keccakHex(utf8("AA_V3_EVM_ACCOUNT_ID_V1")),
    domainType: keccakHex(utf8(DOMAIN_ENCODE_TYPE)),
    domainName: keccakHex(utf8(DOMAIN_NAME)),
    domainVersion: keccakHex(utf8(DOMAIN_VERSION)),
    ...Object.fromEntries(
      Object.entries(TYPE_DEFINITIONS).map(([name, definition]) => [
        `type:${name}`,
        keccakHex(utf8(definition.encodeType)),
      ]),
    ),
  } as Record<string, Hex32>;
}
