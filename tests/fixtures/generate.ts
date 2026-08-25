import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildTypedDataV4, computeDigest, deriveAccountId } from "../lib/codec.js";
import {
  ZERO_32,
  bytesToHex,
  hexToBytes,
  type Hex20,
  type Hex32,
} from "../lib/bytes.js";
import {
  metamaskDigestForTypedData,
  metamaskHashes,
  metamaskRecover,
  metamaskSign,
  metamaskTypeHash,
} from "../lib/metamask.js";
import {
  addressForPrivateKey,
  highSTwin,
  recoverSigner,
  SECP256K1_N,
} from "../lib/signature.js";
import {
  buildSemanticCommitment,
  nativeAuthResult,
  type NonDustImbalance,
  type SemanticActionFields,
  type SemanticCommitmentInput,
} from "../lib/semantic.js";
import {
  TYPE_DEFINITIONS,
  type Eip712Action,
  type PrimaryType,
  type RegisterEvmAccount,
} from "../lib/schema.js";

export const FIXTURE_VERSION = "AUTH-EIP712-AA-V3-V1/FIXTURES-1";
export const RANDOM_SEED = "0x8aa3e712c0dec0de";
export const RANDOM_CASES = 48;

export const KAT_PRIVATE_KEY =
  "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318" as Hex32;
export const KAT_OWNER = "0x2c7536e3605d9c16a7a3d7b1898e529396a65c23" as Hex20;
export const KAT_MANAGER = `0x${"aa".repeat(32)}` as Hex32;
export const KAT_DEPLOYMENT_DOMAIN = `0x${"dd".repeat(32)}` as Hex32;
export const KAT_ACCOUNT_SALT = `0x${"cc".repeat(32)}` as Hex32;
export const KAT_ACCOUNT_ID =
  "0x25795e3d56dd5715e106a11a61280aa4c1a99a3f409fbe7f33d2549cbb0d592e" as Hex32;
export const KAT_SIGNATURE =
  "0x18c8c0b1a03a9d14923824f037423de763035cc9b4ae011b10519473553845fa4b23d69e009b1b012a044d2651134524419f420f6157d333eda0b3cb2d469f811c";

export const KAT_ACTION: RegisterEvmAccount = {
  primaryType: "RegisterEvmAccount",
  manager: KAT_MANAGER,
  accountId: KAT_ACCOUNT_ID,
  owner: KAT_OWNER,
  accountSalt: KAT_ACCOUNT_SALT,
  validUntil: 2_000_000_000n,
};

class DeterministicRandom {
  #state: bigint;

  constructor(seed: bigint) {
    this.#state = seed & ((1n << 64n) - 1n);
  }

  next64(): bigint {
    let value = this.#state;
    value ^= value >> 12n;
    value ^= (value << 25n) & ((1n << 64n) - 1n);
    value ^= value >> 27n;
    this.#state = value & ((1n << 64n) - 1n);
    return (this.#state * 0x2545f4914f6cdd1dn) & ((1n << 64n) - 1n);
  }

  bytes(length: number): Uint8Array {
    const output = new Uint8Array(length);
    let word = 0n;
    for (let index = 0; index < length; index += 1) {
      if (index % 8 === 0) word = this.next64();
      // This is a bounded byte conversion, never conversion of a uint64/uint128 API value.
      output[index] = Number((word >> BigInt((index % 8) * 8)) & 0xffn);
    }
    return output;
  }

  uint(bits: 64 | 128): bigint {
    return BigInt(bytesToHex(this.bytes(bits / 8)));
  }

  hex32(): Hex32 {
    return bytesToHex(this.bytes(32)) as Hex32;
  }

  privateKey(): Hex32 {
    const scalar = (BigInt(bytesToHex(this.bytes(32))) % (SECP256K1_N - 1n)) + 1n;
    return `0x${scalar.toString(16).padStart(64, "0")}` as Hex32;
  }
}

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString(10);
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  }
  return value;
}

export function fixtureJson(value: unknown): string {
  return `${JSON.stringify(jsonValue(value), null, 2)}\n`;
}

function randomAction(
  random: DeterministicRandom,
  selector: 1 | 2 | 3 | 4 | 5 | 6,
  owner: Hex20,
): { action: Eip712Action; deploymentDomain: Hex32 } {
  const manager = random.hex32();
  const deploymentDomain = random.hex32();
  const accountId = random.hex32();
  const validUntil = random.uint(64);
  if (selector === 1) {
    const accountSalt = random.hex32();
    return {
      deploymentDomain,
      action: {
        primaryType: "RegisterEvmAccount",
        manager,
        accountId: deriveAccountId(manager, owner, accountSalt),
        owner,
        accountSalt,
        validUntil,
      },
    };
  }
  const nonce = random.uint(64);
  if (selector === 2 || selector === 3) {
    return {
      deploymentDomain,
      action: {
        primaryType: selector === 2 ? "WithdrawShielded" : "WithdrawUnshielded",
        manager,
        accountId,
        owner,
        nonce,
        validUntil,
        color: random.hex32(),
        amount: random.uint(128),
        recipientKind: random.next64() % 2n,
        recipient: random.hex32(),
      },
    };
  }
  if (selector === 4 || selector === 5) {
    return {
      deploymentDomain,
      action: {
        primaryType:
          selector === 4 ? "TransferInternalShielded" : "TransferInternalUnshielded",
        manager,
        accountId,
        owner,
        nonce,
        validUntil,
        toAccountId: random.hex32(),
        color: random.hex32(),
        amount: random.uint(128),
      },
    };
  }
  const recipientKind = random.next64() % 3n;
  return {
    deploymentDomain,
    action: {
      primaryType: "OpenSwapShielded",
      manager,
      accountId,
      owner,
      nonce,
      validUntil,
      giveColor: random.hex32(),
      giveAmount: random.uint(128),
      recipientKind,
      recipient: recipientKind === 0n ? ZERO_32 : random.hex32(),
      wantNonce: random.hex32(),
      wantColor: random.hex32(),
      wantAmount: random.uint(128),
      creditAccountId: random.hex32(),
    },
  };
}

export function semanticInputForAction(
  action: Eip712Action,
  deploymentDomain: Hex32,
  digest: Hex32,
): SemanticCommitmentInput {
  const selector = TYPE_DEFINITIONS[action.primaryType].selector;
  let fields: SemanticActionFields;
  let imbalances: NonDustImbalance[] = [];
  if (action.primaryType === "RegisterEvmAccount") {
    fields = { owner: action.owner, validUntil: action.validUntil, accountSalt: action.accountSalt };
  } else if (action.primaryType === "WithdrawShielded" || action.primaryType === "WithdrawUnshielded") {
    fields = {
      owner: action.owner,
      validUntil: action.validUntil,
      primaryColor: action.color,
      primaryAmount: action.amount,
      recipientKind: action.recipientKind,
      recipient: action.recipient,
    };
    if (action.amount > 0n) {
      imbalances = [{
        family: action.primaryType === "WithdrawShielded" ? 1 : 2,
        color: action.color,
        direction: 2,
        amount: action.amount,
      }];
    }
  } else if (
    action.primaryType === "TransferInternalShielded" ||
    action.primaryType === "TransferInternalUnshielded"
  ) {
    fields = {
      owner: action.owner,
      validUntil: action.validUntil,
      primaryColor: action.color,
      primaryAmount: action.amount,
      toAccountId: action.toAccountId,
    };
  } else {
    fields = {
      owner: action.owner,
      validUntil: action.validUntil,
      primaryColor: action.giveColor,
      primaryAmount: action.giveAmount,
      recipientKind: action.recipientKind,
      recipient: action.recipient,
      wantNonce: action.wantNonce,
      wantColor: action.wantColor,
      wantAmount: action.wantAmount,
      creditAccountId: action.creditAccountId,
    };
    if (action.giveAmount > 0n) {
      imbalances.push({ family: 1, color: action.giveColor, direction: 2, amount: action.giveAmount });
    }
    if (action.wantAmount > 0n) {
      imbalances.push({ family: 1, color: action.wantColor, direction: 1, amount: action.wantAmount });
    }
    if (
      imbalances.length === 2 &&
      imbalances[0]!.color === imbalances[1]!.color
    ) {
      imbalances[1]!.color = bytesToHex(
        Uint8Array.from(hexToBytes(imbalances[1]!.color, 32), (byte, index) =>
          index === 31 ? byte ^ 1 : byte,
        ),
      ) as Hex32;
      fields.wantColor = imbalances[1]!.color;
    }
  }
  return {
    manager: action.manager,
    deploymentDomain,
    selector,
    accountId: action.accountId,
    authMode: "evm",
    authResult: digest,
    nonce: action.primaryType === "RegisterEvmAccount" ? 0n : action.nonce,
    action: fields,
    nonDustImbalances: imbalances,
  };
}

function completeCase(
  id: string,
  action: Eip712Action,
  deploymentDomain: Hex32,
  privateKey: Hex32,
): Record<string, unknown> {
  const manual = computeDigest(action, deploymentDomain);
  const metamask = metamaskHashes(action, deploymentDomain);
  const signature = metamaskSign(privateKey, action, deploymentDomain);
  const recovery = recoverSigner(manual.digest, signature);
  const semantic = buildSemanticCommitment(
    semanticInputForAction(action, deploymentDomain, manual.digest),
  );
  return {
    id,
    deploymentDomain,
    action,
    typedData: buildTypedDataV4(action, deploymentDomain),
    manual,
    metamask,
    metamaskTypeHash: metamaskTypeHash(action, deploymentDomain),
    signature,
    recoveredOwner: recovery.address,
    metamaskRecoveredOwner: metamaskRecover(action, deploymentDomain, signature),
    recoveredPoint: {
      x: bytesToHex(recovery.point.xBytes),
      y: bytesToHex(recovery.point.yBytes),
      identity: false,
    },
    semantic: {
      commitment: semantic.commitment,
      callTranscriptHash: semantic.callTranscriptHash,
      actionUnionHash: semantic.actionUnionHash,
    },
  };
}

function boundaryCases(): Record<string, unknown>[] {
  const max64 = (1n << 64n) - 1n;
  const max128 = (1n << 128n) - 1n;
  const account = `0x${"11".repeat(32)}` as Hex32;
  const color = `0x${"22".repeat(32)}` as Hex32;
  const other = `0x${"33".repeat(32)}` as Hex32;
  const recipient = `0x${"44".repeat(32)}` as Hex32;
  const common = { manager: KAT_MANAGER, accountId: account, owner: KAT_OWNER };
  const cases: { id: string; action: Eip712Action }[] = [
    {
      id: "register-zero",
      action: {
        primaryType: "RegisterEvmAccount",
        manager: KAT_MANAGER,
        accountId: deriveAccountId(KAT_MANAGER, KAT_OWNER, ZERO_32),
        owner: KAT_OWNER,
        accountSalt: ZERO_32,
        validUntil: 0n,
      },
    },
    {
      id: "register-max64",
      action: {
        primaryType: "RegisterEvmAccount",
        manager: KAT_MANAGER,
        accountId: deriveAccountId(KAT_MANAGER, KAT_OWNER, `0x${"ff".repeat(32)}` as Hex32),
        owner: KAT_OWNER,
        accountSalt: `0x${"ff".repeat(32)}` as Hex32,
        validUntil: max64,
      },
    },
    ...([0n, 1n] as const).map((kind) => ({
      id: `withdraw-shielded-kind-${kind}`,
      action: {
        ...common,
        primaryType: "WithdrawShielded" as const,
        nonce: kind === 0n ? 0n : max64,
        validUntil: kind === 0n ? 0n : max64,
        color,
        amount: kind === 0n ? 0n : max128,
        recipientKind: kind,
        recipient,
      },
    })),
    ...([0n, 1n] as const).map((kind) => ({
      id: `withdraw-unshielded-kind-${kind}`,
      action: {
        ...common,
        primaryType: "WithdrawUnshielded" as const,
        nonce: kind === 0n ? 0n : max64,
        validUntil: kind === 0n ? 0n : max64,
        color,
        amount: kind === 0n ? 0n : max128,
        recipientKind: kind,
        recipient,
      },
    })),
    {
      id: "transfer-shielded-zero",
      action: {
        ...common,
        primaryType: "TransferInternalShielded",
        nonce: 0n,
        validUntil: 0n,
        toAccountId: other,
        color,
        amount: 0n,
      },
    },
    {
      id: "transfer-unshielded-max",
      action: {
        ...common,
        primaryType: "TransferInternalUnshielded",
        nonce: max64,
        validUntil: max64,
        toAccountId: other,
        color,
        amount: max128,
      },
    },
    ...([0n, 1n, 2n] as const).map((kind) => ({
      id: `open-swap-kind-${kind}`,
      action: {
        ...common,
        primaryType: "OpenSwapShielded" as const,
        nonce: kind === 0n ? 0n : max64,
        validUntil: kind === 0n ? 0n : max64,
        giveColor: color,
        giveAmount: kind === 0n ? 0n : max128,
        recipientKind: kind,
        recipient: kind === 0n ? ZERO_32 : recipient,
        wantNonce: other,
        wantColor: `0x${"55".repeat(32)}` as Hex32,
        wantAmount: kind === 0n ? 0n : max128,
        creditAccountId: account,
      },
    })),
  ];
  return cases.map(({ id, action }) => completeCase(id, action, KAT_DEPLOYMENT_DOMAIN, KAT_PRIVATE_KEY));
}

function mutateHex(value: string): string {
  const bytes = hexToBytes(value);
  bytes[bytes.length - 1]! ^= 1;
  return bytesToHex(bytes);
}

function mutateActionField(action: Eip712Action, field: string): Eip712Action {
  const clone = { ...action } as unknown as Record<string, unknown>;
  const value = clone[field];
  if (typeof value === "bigint") clone[field] = value === 0n ? 1n : value - 1n;
  else clone[field] = mutateHex(String(value));
  return clone as unknown as Eip712Action;
}

function tamperCases(baseCases: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  const byType = new Map<PrimaryType, Record<string, unknown>>();
  for (const item of baseCases) {
    const action = item.action as Eip712Action;
    if (!byType.has(action.primaryType)) byType.set(action.primaryType, item);
  }
  for (const [primaryType, item] of byType) {
    const action = item.action as Eip712Action;
    const deploymentDomain = item.deploymentDomain as Hex32;
    const baseDigest = computeDigest(action, deploymentDomain).digest;
    for (const field of TYPE_DEFINITIONS[primaryType].fields) {
      const tampered = mutateActionField(action, field.name);
      output.push({
        id: `${primaryType}.message.${field.name}`,
        baseDigest,
        tamperedDigest: computeDigest(tampered, deploymentDomain).digest,
        metamaskTamperedDigest: metamaskHashes(tampered, deploymentDomain).digest,
      });
    }
  }

  const typed = buildTypedDataV4(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN);
  for (const field of ["name", "version", "verifyingContract", "salt"] as const) {
    const changed = structuredClone(typed);
    changed.domain[field] = (
      field === "name" || field === "version"
        ? `${changed.domain[field]}-tampered`
        : mutateHex(changed.domain[field])
    ) as never;
    output.push({
      id: `domain.${field}`,
      baseDigest: metamaskDigestForTypedData(typed),
      tamperedDigest: metamaskDigestForTypedData(changed),
    });
  }
  const reorderedDomain = structuredClone(typed);
  const reorderedFields = [...reorderedDomain.types.EIP712Domain!];
  [reorderedFields[0], reorderedFields[1]] = [reorderedFields[1]!, reorderedFields[0]!];
  reorderedDomain.types.EIP712Domain = reorderedFields;
  output.push({
    id: "domain.encodeType-order",
    baseDigest: metamaskDigestForTypedData(typed),
    tamperedDigest: metamaskDigestForTypedData(reorderedDomain),
  });

  const withdraw = (baseCases.find(
    (item) => (item.action as Eip712Action).primaryType === "WithdrawShielded",
  )!.action as Eip712Action) as Extract<Eip712Action, { primaryType: "WithdrawShielded" }>;
  const wrongType = { ...withdraw, primaryType: "WithdrawUnshielded" as const };
  output.push({
    id: "primaryType.WithdrawShielded-to-WithdrawUnshielded",
    baseDigest: computeDigest(withdraw, KAT_DEPLOYMENT_DOMAIN).digest,
    tamperedDigest: computeDigest(wrongType, KAT_DEPLOYMENT_DOMAIN).digest,
  });
  return output;
}

export function generateFixture(): Record<string, unknown> {
  const random = new DeterministicRandom(BigInt(RANDOM_SEED));
  const randomCases: Record<string, unknown>[] = [];
  for (let index = 0; index < RANDOM_CASES; index += 1) {
    const privateKey = random.privateKey();
    const owner = addressForPrivateKey(privateKey);
    const selector = ((index % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const { action, deploymentDomain } = randomAction(random, selector, owner);
    randomCases.push(completeCase(`random-${index.toString().padStart(2, "0")}`, action, deploymentDomain, privateKey));
  }
  const boundaries = boundaryCases();
  const kat = completeCase("registration-kat", KAT_ACTION, KAT_DEPLOYMENT_DOMAIN, KAT_PRIVATE_KEY);
  const nativeAccountId = `0x${"77".repeat(32)}` as Hex32;
  const nativeSemanticInput: SemanticCommitmentInput = {
    manager: KAT_MANAGER,
    deploymentDomain: KAT_DEPLOYMENT_DOMAIN,
    selector: 0,
    accountId: nativeAccountId,
    authMode: "native",
    authResult: nativeAuthResult(nativeAccountId),
    nonce: 0n,
    action: {},
    nonDustImbalances: [],
  };
  const nativeSemantic = buildSemanticCommitment(nativeSemanticInput);
  return {
    fixtureVersion: FIXTURE_VERSION,
    packages: {
      node: "22.x Docker gate",
      metamaskEthSigUtil: "8.2.0",
      nobleCurves: "2.2.0",
      nobleHashes: "2.2.0",
      compactCompiler: "0.33.0 / language 0.25.0 / --feature-zkir-v3",
    },
    randomSeed: RANDOM_SEED,
    randomCaseCount: RANDOM_CASES,
    nativeSelectorFixture: {
      id: "selector-0-register-native",
      input: nativeSemanticInput,
      commitment: nativeSemantic.commitment,
      callTranscriptHash: nativeSemantic.callTranscriptHash,
      actionUnionHash: nativeSemantic.actionUnionHash,
    },
    kat,
    boundaryCases: boundaries,
    randomCases,
    tamperCases: tamperCases([kat, ...boundaries, ...randomCases]),
    signatureTwins: {
      digest: computeDigest(KAT_ACTION, KAT_DEPLOYMENT_DOMAIN).digest,
      lowS: KAT_SIGNATURE,
      highS: highSTwin(KAT_SIGNATURE),
      owner: KAT_OWNER,
    },
  };
}

const outputPath = fileURLToPath(new URL("./v1.json", import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const generated = fixtureJson(generateFixture());
  if (process.argv.includes("--write")) {
    writeFileSync(outputPath, generated);
    process.stdout.write(`wrote ${outputPath}\n`);
  } else {
    const current = readFileSync(outputPath, "utf8");
    if (current !== generated) {
      process.stderr.write("fixture drift: run generator with --write\n");
      process.exitCode = 1;
    } else {
      process.stdout.write("fixture bytes match deterministic generator\n");
    }
  }
}
