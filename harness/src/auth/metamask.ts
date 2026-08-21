import {
  SignTypedDataVersion,
  TypedDataUtils,
  recoverTypedSignature,
  signTypedData,
  type MessageTypes,
  type TypedMessage,
} from "@metamask/eth-sig-util";

import { buildTypedDataV4, type CodecHashes, type TypedDataV4Json } from "./codec.js";
import { bytesToHex, hexToBytes, type Hex20, type Hex32 } from "./bytes.js";
import type { Eip712Action } from "./schema.js";

function asMetaMaskData(action: Eip712Action, deploymentDomain: Hex32): TypedMessage<MessageTypes> {
  return buildTypedDataV4(action, deploymentDomain) as unknown as TypedMessage<MessageTypes>;
}

export function metamaskDigestForTypedData(data: TypedDataV4Json): Hex32 {
  return bytesToHex(
    TypedDataUtils.eip712Hash(
      data as unknown as TypedMessage<MessageTypes>,
      SignTypedDataVersion.V4,
    ),
  ) as Hex32;
}

/** Independent EIP-712 reproduction through MetaMask's V4 implementation. */
export function metamaskHashes(action: Eip712Action, deploymentDomain: Hex32): CodecHashes {
  const data = asMetaMaskData(action, deploymentDomain);
  const typeHash = TypedDataUtils.hashType(action.primaryType, data.types);
  const expectedTypeHash = data.types[action.primaryType];
  if (!expectedTypeHash || typeHash.length !== 32) throw new Error("MetaMask type definition missing");
  return {
    managerAlias: data.domain.verifyingContract as Hex20,
    domainSeparator: bytesToHex(
      TypedDataUtils.eip712DomainHash(data, SignTypedDataVersion.V4),
    ) as Hex32,
    structHash: bytesToHex(
      TypedDataUtils.hashStruct(
        action.primaryType,
        data.message,
        data.types,
        SignTypedDataVersion.V4,
      ),
    ) as Hex32,
    digest: bytesToHex(
      TypedDataUtils.eip712Hash(data, SignTypedDataVersion.V4),
    ) as Hex32,
  };
}

export function metamaskTypeHash(
  action: Eip712Action,
  deploymentDomain: Hex32,
): Hex32 {
  const data = asMetaMaskData(action, deploymentDomain);
  return bytesToHex(TypedDataUtils.hashType(action.primaryType, data.types)) as Hex32;
}

export function metamaskSign(
  privateKey: Hex32,
  action: Eip712Action,
  deploymentDomain: Hex32,
): `0x${string}` {
  return signTypedData({
    privateKey: Buffer.from(hexToBytes(privateKey, 32)),
    data: asMetaMaskData(action, deploymentDomain),
    version: SignTypedDataVersion.V4,
  }) as `0x${string}`;
}

export function metamaskRecover(
  action: Eip712Action,
  deploymentDomain: Hex32,
  signature: string,
): Hex20 {
  return recoverTypedSignature({
    data: asMetaMaskData(action, deploymentDomain),
    signature,
    version: SignTypedDataVersion.V4,
  }).toLowerCase() as Hex20;
}
