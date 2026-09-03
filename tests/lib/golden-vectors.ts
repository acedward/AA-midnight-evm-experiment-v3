// THE 00014 GOLDEN VECTORS — the pure oracles' outputs, frozen from the PRE-SPLIT artifact.
//
// WHY THIS FILE EXISTS (spec US4 / FR-013)
//   The modular split moves every state-free circuit out of `contracts/manager.compact` and into
//   `contracts/modules/`. Nothing about that is supposed to change a byte any of them returns, so
//   this file records what they returned BEFORE the move and the test replays it afterwards.
//
//   It is deliberately a BELT, not the trousers. The KAT in `manager.test.ts`, the MetaMask
//   differential in `codec.test.ts` and the k=20 parity suite already pin most of these bytes far
//   more thoroughly than 23 vectors could. What they do not give is INDEPENDENCE: the k=20 suite
//   compares the artifact against another COMPILED artifact, so it dies the day the frozen k=20
//   oracle is retired, and the MetaMask differential compares against a TypeScript reimplementation
//   that a shared bug could move in step. These vectors are literal bytes in a committed JSON file.
//   That is why the set is small: it is cheap insurance, not the primary evidence.
//
// WHAT IS IN IT
//   Every exported pure oracle of the artifact, with inputs that are constants defined here and
//   nowhere else — no sampled contract address, no clock, no fixture cross-import, so a vector can
//   be recomputed from this file alone:
//     evmAccountIdFor · evmDomainSeparatorFor · evmStructHashFor (selectors 1..6) ·
//     evmDigestFor (selectors 1..6) · zswapNullifierOf · zswapCommitmentOf (both recipient
//     variants) · shieldedKey · unshieldedKey · semanticCommitmentFor (non-swap, named swap, and
//     an open swap in BOTH colour orders, because that is the one input where the commitment's
//     canonical imbalance ordering can differ).
//
//   `myAccount` is absent on purpose: it is impure (it reads the owner witness), so it is not one
//   of the oracles this file is about.
//
// TOOLCHAIN AND SPLIT INDEPENDENCE
//   The inputs are plain bytes and the outputs are what the CONTRACT computes from them, so the
//   fixture is independent of the compiler version in the same sense the refusal matrix is: a
//   toolchain bump that changes a vector is a real finding, not a re-record. T0.0b already proved
//   compactc 0.33.0 and 0.34.0 emit byte-identical ZKIRs for this contract.
//
// REGENERATING (only for a DELIBERATE change, never to make a red test green)
//   tsx lib/golden-vectors.ts --write        (needs tests/generated/manager — scripts/compile.sh)
//   The same `--write` pattern `fixtures/generate.ts` and `lib/refusal-matrix.ts` use.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { bytesToHex, type Hex } from "./bytes.js";
import { emptyExecutePayload, type ManagerExecutePayload } from "./manager.js";

// --- the constants every vector is built from -----------------------------------------------------
//
// Byte-fill patterns rather than "realistic" values: a vector's job is to pin a transcription, and a
// pattern makes a misplaced byte visible in the input as well as the output. The two colours are
// chosen so that CO_LOW < CO_HIGH big-endian, which is what the open-swap ordering vectors need.

const fill = (length: number, byte: number): Uint8Array => new Uint8Array(length).fill(byte);

/** This contract's 32-byte Midnight address, as `kernel.self().bytes` would deliver it. */
export const GV_MANAGER = fill(32, 0xa1);
/** The deployment salt in `deploymentDomain`. */
export const GV_DOMAIN = fill(32, 0xb2);
export const GV_ACCOUNT = fill(32, 0xc3);
export const GV_OWNER = fill(20, 0xd4);
export const GV_SALT = fill(32, 0xe5);
export const GV_RECIPIENT = fill(32, 0xf6);
export const GV_TO_ACCOUNT = fill(32, 0x17);
export const GV_CREDIT_ACCOUNT = fill(32, 0x28);
export const GV_WANT_NONCE = fill(32, 0x39);
/** `authResult`: the EIP-712 digest for an EVM action, or `nativeAuthResult(account)` natively. */
export const GV_AUTH_RESULT = fill(32, 0x4a);

/** Big-endian-low and big-endian-high colours: CO_LOW < CO_HIGH under `bytes32LexicographicLt`. */
export const GV_COLOUR_LOW = fill(32, 0x05);
export const GV_COLOUR_HIGH = fill(32, 0x90);

export const GV_NONCE = 7n;
export const GV_VALID_UNTIL = 1_800_000_600n;
export const GV_PRIMARY_AMOUNT = 123_456_789n;
export const GV_WANT_AMOUNT = 987_654_321n;

/** The coin the two zswap transcriptions are pinned on. */
export const GV_COIN = {
  nonce: fill(32, 0x5b),
  color: GV_COLOUR_LOW,
  value: 42_000n,
};
/** A contract address (the nullifier's only recipient shape, and the `right` commitment variant). */
export const GV_CONTRACT_ADDR = { bytes: fill(32, 0x6c) };
/** A user coin public key (the `left` commitment variant). */
export const GV_USER_PK = { bytes: fill(32, 0x7d) };

// --- the payloads ---------------------------------------------------------------------------------
//
// Every one of these is ENVELOPE-CLEAN: it passes `assertActionEnvelope`, so the same payload can
// feed `evmStructHashFor` (which only checks the selector range) and `semanticCommitmentFor` (which
// runs the whole envelope). All are EVM-mode, because selector 0 signs nothing and has no struct
// hash; the native shape is covered by the non-swap semantic vector's sibling in `semantic.test.ts`.

const evmBase = (selector: bigint): ManagerExecutePayload => ({
  ...emptyExecutePayload(),
  selector,
  authMode: 1n,
  account: GV_ACCOUNT,
  owner: GV_OWNER,
  validUntil: GV_VALID_UNTIL,
});

/** selector 1 — EVM registration: salt active, nonce 0, no action fields. */
export const GV_PAYLOAD_REGISTER: ManagerExecutePayload = {
  ...evmBase(1n),
  accountSalt: GV_SALT,
};

/** selectors 2 and 3 — withdraw shielded / unshielded, to a user recipient (kind 0). */
const withdraw = (selector: bigint): ManagerExecutePayload => ({
  ...evmBase(selector),
  nonce: GV_NONCE,
  primaryColor: GV_COLOUR_LOW,
  primaryAmount: GV_PRIMARY_AMOUNT,
  recipientKind: 0n,
  recipient: GV_RECIPIENT,
});
export const GV_PAYLOAD_WITHDRAW_SHIELDED = withdraw(2n);
export const GV_PAYLOAD_WITHDRAW_UNSHIELDED = withdraw(3n);

/** selectors 4 and 5 — internal transfer, shielded / unshielded. */
const transfer = (selector: bigint): ManagerExecutePayload => ({
  ...evmBase(selector),
  nonce: GV_NONCE,
  primaryColor: GV_COLOUR_LOW,
  primaryAmount: GV_PRIMARY_AMOUNT,
  toAccount: GV_TO_ACCOUNT,
});
export const GV_PAYLOAD_TRANSFER_SHIELDED = transfer(4n);
export const GV_PAYLOAD_TRANSFER_UNSHIELDED = transfer(5n);

/** selector 6 — swap. `give`/`want` colours are the two ordering knobs. */
const swap = (
  recipientKind: bigint,
  recipient: Uint8Array,
  giveColour: Uint8Array,
  wantColour: Uint8Array,
): ManagerExecutePayload => ({
  ...evmBase(6n),
  nonce: GV_NONCE,
  primaryColor: giveColour,
  primaryAmount: GV_PRIMARY_AMOUNT,
  recipientKind,
  recipient,
  wantNonce: GV_WANT_NONCE,
  wantColor: wantColour,
  wantAmount: GV_WANT_AMOUNT,
  creditAccount: GV_CREDIT_ACCOUNT,
});

/** The selector-6 payload the struct-hash / digest vectors use: an OPEN offer, give < want. */
export const GV_PAYLOAD_SWAP_OPEN = swap(0n, new Uint8Array(32), GV_COLOUR_LOW, GV_COLOUR_HIGH);
/** The same swap NAMED to a user key (kind 1) — one imbalance slot instead of two. */
export const GV_PAYLOAD_SWAP_NAMED = swap(1n, GV_RECIPIENT, GV_COLOUR_LOW, GV_COLOUR_HIGH);
/** The open offer with the colours EXCHANGED: give > want, so the canonical slot order flips. */
export const GV_PAYLOAD_SWAP_OPEN_REVERSED = swap(
  0n,
  new Uint8Array(32),
  GV_COLOUR_HIGH,
  GV_COLOUR_LOW,
);

/** Selector -> the payload the struct-hash and digest vectors pin, in fixture order. */
export const GV_PAYLOADS: readonly (readonly [string, ManagerExecutePayload])[] = [
  ["selector1-register", GV_PAYLOAD_REGISTER],
  ["selector2-withdrawShielded", GV_PAYLOAD_WITHDRAW_SHIELDED],
  ["selector3-withdrawUnshielded", GV_PAYLOAD_WITHDRAW_UNSHIELDED],
  ["selector4-transferShielded", GV_PAYLOAD_TRANSFER_SHIELDED],
  ["selector5-transferUnshielded", GV_PAYLOAD_TRANSFER_UNSHIELDED],
  ["selector6-openSwap", GV_PAYLOAD_SWAP_OPEN],
];

// --- the vectors ----------------------------------------------------------------------------------

/** The subset of `pureCircuits` this file exercises. */
export type GoldenOracles = {
  shieldedKey(acct: Uint8Array, colour: Uint8Array): Uint8Array;
  unshieldedKey(acct: Uint8Array, colour: Uint8Array): Uint8Array;
  evmAccountIdFor(manager: Uint8Array, owner: Uint8Array, salt: Uint8Array): Uint8Array;
  evmDomainSeparatorFor(manager: Uint8Array, domain: Uint8Array): Uint8Array;
  evmStructHashFor(manager: Uint8Array, payload: ManagerExecutePayload): Uint8Array;
  evmDigestFor(manager: Uint8Array, domain: Uint8Array, payload: ManagerExecutePayload): Uint8Array;
  zswapNullifierOf(
    coin: { nonce: Uint8Array; color: Uint8Array; value: bigint },
    addr: { bytes: Uint8Array },
  ): Uint8Array;
  zswapCommitmentOf(
    coin: { nonce: Uint8Array; color: Uint8Array; value: bigint },
    recipient: { is_left: boolean; left: { bytes: Uint8Array }; right: { bytes: Uint8Array } },
  ): Uint8Array;
  semanticCommitmentFor(
    manager: Uint8Array,
    domain: Uint8Array,
    payload: ManagerExecutePayload,
    account: Uint8Array,
    authResult: Uint8Array,
  ): Uint8Array;
};

/** One frozen vector: which oracle, which input, and the 32 bytes it must return. */
export type GoldenVector = { readonly id: string; readonly oracle: string; readonly value: Hex };

const either = (isLeft: boolean) => ({
  is_left: isLeft,
  left: isLeft ? GV_USER_PK : { bytes: new Uint8Array(32) },
  right: isLeft ? { bytes: new Uint8Array(32) } : GV_CONTRACT_ADDR,
});

/**
 * Run every oracle over the frozen inputs, in the fixture's order. The ONLY place a vector's input
 * is bound to its id, so the test and the `--write` generator can never disagree about either.
 */
export function computeGoldenVectors(pure: GoldenOracles): GoldenVector[] {
  const out: GoldenVector[] = [];
  const push = (id: string, oracle: string, value: Uint8Array): void => {
    out.push({ id, oracle, value: bytesToHex(value) });
  };

  push("account-id", "evmAccountIdFor", pure.evmAccountIdFor(GV_MANAGER, GV_OWNER, GV_SALT));
  push("domain-separator", "evmDomainSeparatorFor", pure.evmDomainSeparatorFor(GV_MANAGER, GV_DOMAIN));

  for (const [id, payload] of GV_PAYLOADS) {
    push(`struct-hash/${id}`, "evmStructHashFor", pure.evmStructHashFor(GV_MANAGER, payload));
  }
  for (const [id, payload] of GV_PAYLOADS) {
    push(`digest/${id}`, "evmDigestFor", pure.evmDigestFor(GV_MANAGER, GV_DOMAIN, payload));
  }

  push("zswap/nullifier", "zswapNullifierOf", pure.zswapNullifierOf(GV_COIN, GV_CONTRACT_ADDR));
  push("zswap/commitment-left", "zswapCommitmentOf", pure.zswapCommitmentOf(GV_COIN, either(true)));
  push("zswap/commitment-right", "zswapCommitmentOf", pure.zswapCommitmentOf(GV_COIN, either(false)));

  // The same (account, colour) pair through both families: the two values must differ, and the test
  // asserts that as well as the bytes — that inequality IS the family separation.
  push("key/shielded", "shieldedKey", pure.shieldedKey(GV_ACCOUNT, GV_COLOUR_LOW));
  push("key/unshielded", "unshieldedKey", pure.unshieldedKey(GV_ACCOUNT, GV_COLOUR_LOW));

  const semantic = (id: string, payload: ManagerExecutePayload): void => {
    push(
      `semantic/${id}`,
      "semanticCommitmentFor",
      pure.semanticCommitmentFor(GV_MANAGER, GV_DOMAIN, payload, GV_ACCOUNT, GV_AUTH_RESULT),
    );
  };
  semantic("non-swap-withdrawShielded", GV_PAYLOAD_WITHDRAW_SHIELDED);
  semantic("named-swap", GV_PAYLOAD_SWAP_NAMED);
  semantic("open-swap-give-lt-want", GV_PAYLOAD_SWAP_OPEN);
  semantic("open-swap-give-gt-want", GV_PAYLOAD_SWAP_OPEN_REVERSED);

  return out;
}

export const GOLDEN_VECTORS_NOTE =
  "Frozen outputs of the exported PURE oracles of contracts/manager.compact, recorded from the " +
  "PRE-SPLIT artifact (project 00014, FR-013 / spec US4). Inputs are the constants in " +
  "tests/lib/golden-vectors.ts and nothing else. Replayed by " +
  "tests/simulation/golden-vectors.test.ts against whatever the tree compiles to; a difference is " +
  "a REAL behaviour change, never something to re-record. Regenerate a deliberate change with: " +
  "tsx lib/golden-vectors.ts --write";

export function fixtureView(vectors: GoldenVector[]): {
  note: string;
  recordedFrom: string;
  vectors: GoldenVector[];
} {
  return {
    note: GOLDEN_VECTORS_NOTE,
    recordedFrom: "contracts/manager.compact @ 43a0b50 (1,420 lines, pre-split baseline)",
    vectors,
  };
}

// `tsx lib/golden-vectors.ts --write` rewrites the frozen fixture; without --write it only reports.
if (process.argv[1] && process.argv[1].endsWith("golden-vectors.ts")) {
  // Wrapped rather than top-level `await` so this file stays a plain synchronous module for the
  // test that imports it, whatever the transform target is.
  void (async (): Promise<void> => {
    const { pureCircuits } = (await import("../generated/manager/contract/index.js")) as unknown as {
      pureCircuits: GoldenOracles;
    };
    const vectors = computeGoldenVectors(pureCircuits);
    const json = `${JSON.stringify(fixtureView(vectors), null, 2)}\n`;
    if (process.argv.includes("--write")) {
      const target = fileURLToPath(new URL("../fixtures/00014-golden-vectors.json", import.meta.url));
      writeFileSync(target, json, "utf8");
      console.log(`wrote ${target} (${vectors.length} vectors)`);
    } else {
      console.log(json);
    }
  })();
}
