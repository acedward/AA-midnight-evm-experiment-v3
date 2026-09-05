import {
  AA_MINTER_SHIELDED_NAME,
  AA_MINTER_UNSHIELDED_NAME,
  aaMinterTokenColor,
  canonicalTokenColor,
  offerFilesTokenColor,
  validateAaDeploymentTag,
  validateTokenMetadata,
  type TokenMetadata,
  type TokenSource,
} from "./token-metadata.js";

export const AA_CONTRACTS_RECEIPT_VERSION = "aa-contracts/v1" as const;
export const AA_RUN_RECEIPT_VERSION = "aa-faucet-run/v1" as const;

export interface AaContractsReceipt {
  readonly schemaVersion: typeof AA_CONTRACTS_RECEIPT_VERSION;
  readonly network: string;
  readonly aaCommit: string;
  readonly manager: {
    readonly address: string;
    readonly domain: string;
  };
  readonly minter: {
    readonly address: string;
    /** Raw constructor tag; it is not a token display name. */
    readonly tag: string;
  };
  readonly offerFiles?: {
    readonly address: string;
  };
  readonly tokens: readonly TokenMetadata[];
  readonly createdAt: string;
}

export interface AaRunReceipt {
  readonly schemaVersion: typeof AA_RUN_RECEIPT_VERSION;
  readonly network: string;
  readonly mode: TokenSource;
  readonly managerAddress: string;
  readonly tokens: readonly TokenMetadata[];
  readonly balanceDeltas: readonly {
    readonly accountId: string;
    readonly color: string;
    readonly before: string;
    readonly after: string;
  }[];
  readonly transactions: readonly {
    readonly operation: "mint" | "deposit" | "execute" | "withdraw";
    readonly txId: string;
  }[];
  readonly startedAt: string;
  readonly finishedAt: string;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function noUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allow = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allow.has(key));
  if (unknown.length !== 0) throw new RangeError(`${label} has unknown field(s): ${unknown.sort().join(", ")}`);
}

function assertNoSecretKeys(value: unknown, path = "receipt"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretKeys(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/(seed|mnemonic|private.?key|secret|password)/i.test(key)) {
      throw new RangeError(`${path}.${key} is secret-bearing and cannot enter a receipt`);
    }
    assertNoSecretKeys(child, `${path}.${key}`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new RangeError(`${label} must be nonempty`);
  return value;
}

function address(value: unknown, label: string): string {
  const raw = text(value, label);
  if (raw !== canonicalTokenColor(raw)) {
    throw new RangeError(`${label} must be lower-case unprefixed 32-byte hex`);
  }
  return raw;
}

function timestamp(value: unknown, label: string): string {
  const raw = text(value, label);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== raw) {
    throw new RangeError(`${label} must be a canonical ISO-8601 timestamp`);
  }
  return raw;
}

function amount(value: unknown, label: string): string {
  const raw = text(value, label);
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new RangeError(`${label} must be a canonical unsigned integer`);
  return raw;
}

function tokenArray(value: unknown): readonly TokenMetadata[] {
  if (!Array.isArray(value) || value.length === 0) throw new RangeError("receipt tokens must be a nonempty array");
  const tokens = value.map(validateTokenMetadata);
  const colors = new Set<string>();
  const identities = new Set<string>();
  for (const token of tokens) {
    if (colors.has(token.color)) throw new RangeError(`duplicate receipt token color ${token.color}`);
    colors.add(token.color);
    const identity = `${token.source}:${token.family}:${token.name}`;
    if (identities.has(identity)) throw new RangeError(`duplicate receipt token identity ${identity}`);
    identities.add(identity);
  }
  return tokens;
}

export function validateAaContractsReceipt(value: unknown): AaContractsReceipt {
  assertNoSecretKeys(value);
  const receipt = record(value, "aa-contracts receipt");
  noUnknownKeys(
    receipt,
    ["schemaVersion", "network", "aaCommit", "manager", "minter", "offerFiles", "tokens", "createdAt"],
    "aa-contracts receipt",
  );
  if (receipt.schemaVersion !== AA_CONTRACTS_RECEIPT_VERSION) {
    throw new RangeError(`aa-contracts schemaVersion must be ${AA_CONTRACTS_RECEIPT_VERSION}`);
  }
  const commit = text(receipt.aaCommit, "aaCommit").toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new RangeError("aaCommit must be a 7-to-40 digit Git hex id");

  const manager = record(receipt.manager, "manager");
  noUnknownKeys(manager, ["address", "domain"], "manager");

  const rawMinter = record(receipt.minter, "minter");
  noUnknownKeys(rawMinter, ["address", "tag"], "minter");
  const minter = {
    address: address(rawMinter.address, "minter address"),
    tag: validateAaDeploymentTag(rawMinter.tag),
  };

  let offerFiles: AaContractsReceipt["offerFiles"];
  if (receipt.offerFiles !== undefined) {
    const raw = record(receipt.offerFiles, "offerFiles");
    noUnknownKeys(raw, ["address"], "offerFiles");
    offerFiles = { address: address(raw.address, "Offer Files address") };
  }

  const tokens = tokenArray(receipt.tokens);
  const shielded = tokens[0];
  const unshielded = tokens[1];
  if (
    !shielded || shielded.source !== "aa-minter" || shielded.family !== "shielded" ||
    shielded.name !== AA_MINTER_SHIELDED_NAME || shielded.internalDeploymentTag !== minter.tag ||
    shielded.color !== aaMinterTokenColor("shielded", minter.tag, minter.address)
  ) {
    throw new RangeError("aa-contracts tokens[0] must be the deployment-derived AATEST-S row");
  }
  if (
    !unshielded || unshielded.source !== "aa-minter" || unshielded.family !== "unshielded" ||
    unshielded.name !== AA_MINTER_UNSHIELDED_NAME || unshielded.internalDeploymentTag !== minter.tag ||
    unshielded.color !== aaMinterTokenColor("unshielded", minter.tag, minter.address)
  ) {
    throw new RangeError("aa-contracts tokens[1] must be the deployment-derived AATEST-U row");
  }

  if (offerFiles === undefined) {
    if (tokens.length !== 2) {
      throw new RangeError("aa-contracts without Offer Files must contain exactly the two AA Minter rows");
    }
  } else {
    if (tokens.length !== 4) {
      throw new RangeError("aa-contracts with Offer Files must contain exactly AATEST-S, AATEST-U, WBTC, and WETH");
    }
    for (const [index, name] of [[2, "WBTC"], [3, "WETH"]] as const) {
      const token = tokens[index];
      if (
        !token || token.source !== "offer-files-faucet" || token.family !== "shielded" ||
        token.name !== name || token.decimals !== 6 ||
        token.color !== offerFilesTokenColor(name, offerFiles.address)
      ) {
        throw new RangeError(`aa-contracts tokens[${index}] must be the deployment-derived shielded ${name} row`);
      }
    }
  }

  return {
    schemaVersion: AA_CONTRACTS_RECEIPT_VERSION,
    network: text(receipt.network, "network"),
    aaCommit: commit,
    manager: {
      address: address(manager.address, "manager address"),
      domain: text(manager.domain, "manager domain"),
    },
    minter,
    ...(offerFiles ? { offerFiles } : {}),
    tokens,
    createdAt: timestamp(receipt.createdAt, "createdAt"),
  };
}

export function buildAaContractsReceipt(input: AaContractsReceipt): AaContractsReceipt {
  return validateAaContractsReceipt(input);
}

export function validateAaRunReceipt(value: unknown): AaRunReceipt {
  assertNoSecretKeys(value);
  const receipt = record(value, "run receipt");
  noUnknownKeys(
    receipt,
    ["schemaVersion", "network", "mode", "managerAddress", "tokens", "balanceDeltas", "transactions", "startedAt", "finishedAt"],
    "run receipt",
  );
  if (receipt.schemaVersion !== AA_RUN_RECEIPT_VERSION) {
    throw new RangeError(`run receipt schemaVersion must be ${AA_RUN_RECEIPT_VERSION}`);
  }
  if (receipt.mode !== "aa-minter" && receipt.mode !== "offer-files-faucet") {
    throw new RangeError("run receipt mode must be aa-minter or offer-files-faucet");
  }
  const tokens = tokenArray(receipt.tokens);
  if (tokens.some((token) => token.source !== receipt.mode)) {
    throw new RangeError("every run receipt token source must match its selected mode");
  }
  const knownColors = new Set(tokens.map((token) => token.color));

  if (!Array.isArray(receipt.balanceDeltas) || receipt.balanceDeltas.length === 0) {
    throw new RangeError("run receipt balanceDeltas must be a nonempty array");
  }
  const balanceDeltas = receipt.balanceDeltas.map((entry, index) => {
    const delta = record(entry, `balanceDeltas[${index}]`);
    noUnknownKeys(delta, ["accountId", "color", "before", "after"], `balanceDeltas[${index}]`);
    const color = canonicalTokenColor(text(delta.color, `balanceDeltas[${index}].color`));
    if (!knownColors.has(color)) throw new RangeError(`balanceDeltas[${index}] references an unknown token color`);
    return {
      accountId: address(delta.accountId, `balanceDeltas[${index}].accountId`),
      color,
      before: amount(delta.before, `balanceDeltas[${index}].before`),
      after: amount(delta.after, `balanceDeltas[${index}].after`),
    };
  });

  if (!Array.isArray(receipt.transactions)) throw new RangeError("run receipt transactions must be an array");
  const transactionIds = new Set<string>();
  const transactions = receipt.transactions.map((entry, index) => {
    const transaction = record(entry, `transactions[${index}]`);
    noUnknownKeys(transaction, ["operation", "txId"], `transactions[${index}]`);
    if (!(["mint", "deposit", "execute", "withdraw"] as const).includes(transaction.operation as never)) {
      throw new RangeError(`transactions[${index}].operation is invalid`);
    }
    const txId = text(transaction.txId, `transactions[${index}].txId`).trim();
    if (txId.length === 0) throw new RangeError(`transactions[${index}].txId must be nonblank`);
    if (transactionIds.has(txId)) throw new RangeError("run receipt transaction ids must be distinct");
    transactionIds.add(txId);
    return {
      operation: transaction.operation as AaRunReceipt["transactions"][number]["operation"],
      txId,
    };
  });

  const startedAt = timestamp(receipt.startedAt, "startedAt");
  const finishedAt = timestamp(receipt.finishedAt, "finishedAt");
  if (Date.parse(finishedAt) < Date.parse(startedAt)) throw new RangeError("finishedAt cannot precede startedAt");

  return {
    schemaVersion: AA_RUN_RECEIPT_VERSION,
    network: text(receipt.network, "network"),
    mode: receipt.mode,
    managerAddress: address(receipt.managerAddress, "managerAddress"),
    tokens,
    balanceDeltas,
    transactions,
    startedAt,
    finishedAt,
  };
}

export function buildAaRunReceipt(input: AaRunReceipt): AaRunReceipt {
  return validateAaRunReceipt(input);
}
