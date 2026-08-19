// G3 — the token-movement operations the 18-row step ledger is built from.
//
// One function per shape, so the ordered runner, the negative controls and the probes exercise the
// SAME code path. Each returns the submitted transaction id (and any detail the evidence needs);
// none of them asserts — assertion is the runner's job, against the spec's normative table.
//
// Every operation takes its COLOUR AS RAW BYTES. That is the difference from 00004: there, a colour
// argument could be one of four names the Manager had been configured with. Manager v3 has no
// colour knowledge whatsoever, so a colour here is just 32 bytes, and the harness's own registry —
// not the contract — is what gives those bytes a name.
//
// COMPOSITION LEVEL per shape (recorded per cell in CELLS.md):
//   * mint -> user wallet                    SDK  — a single Minter call
//   * user -> Manager account (deposit)      SDK  — a single Manager call balanced by the
//                                                   depositor's own wallet: the Manager declares
//                                                   the receive and the wallet supplies the input,
//                                                   so both sit in one transaction by construction
//   * Manager account -> user (withdraw)     SDK  — a single Manager call, owner-authorized
//   * account -> account (internal)          SDK  — a single Manager call, NO token operation
//   * double lazy-init (probe M3)            SDK  — TWO Manager calls in ONE transaction via the
//                                                   SDK's own contract-scoped batch (decision
//                                                   D-203; see `doubleLazyInitDeposit`)
import { randomBytes } from 'node:crypto';
import { buildCall, type CallSpec } from './compose.js';
import { withContractScopedTransaction, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { withDustRetry } from '../night.js';
import type { Party } from '../wallet.js';

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

/** `Either<ZswapCoinPublicKey, ContractAddress>` — the shielded recipient union. */
export const shieldedToUser = (coinPk: unknown) => ({
  is_left: true,
  left: { bytes: typeof coinPk === 'string' ? Buffer.from(coinPk as string, 'hex') : (coinPk as Uint8Array) },
  right: { bytes: new Uint8Array(32) },
});
export const shieldedToContract = (address: string) => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: Buffer.from(address, 'hex') },
});

/** `Either<ContractAddress, UserAddress>` — the unshielded recipient union (contract is LEFT). */
export const unshieldedToContract = (address: string) => ({
  is_left: true,
  left: { bytes: Buffer.from(address, 'hex') },
  right: { bytes: new Uint8Array(32) },
});
export const unshieldedToUser = (addressHex: string) => ({
  is_left: false,
  left: { bytes: new Uint8Array(32) },
  right: { bytes: Buffer.from(addressHex, 'hex') },
});

export type MinterKind = 'minter' | 'minter-collide';

/** One deployed issuing contract, with the providers (and therefore ZK artifacts) it needs. */
export type MinterHandle = {
  label: string;
  kind: MinterKind;
  address: string;
  providers: any;
  /** The `deployContract` result, for direct `callTx.*` reads. */
  deployed: any;
};

export type Ctx = {
  managerAddress: string;
  /** Every issuing deployment known so far, by label. Grows mid-run (TOKD at step 15). */
  minters: Record<string, MinterHandle>;
  compiledMinter: () => any;
  compiledMinterCollide: () => any;
  compiledManager: () => any;
  /** Manager providers backed by the fee wallet — used for every owner-authorized circuit. */
  managerFee: any;
  /** Sets the owner secret the Manager's witness will read on the next call through `providers`. */
  actAs: (providers: any, secret: Uint8Array) => Promise<void>;
};

const minterOf = (c: Ctx, label: string): MinterHandle => {
  const m = c.minters[label];
  if (!m) throw new Error(`minter ${label} has not been deployed yet`);
  return m;
};

const compiledFor = (c: Ctx, m: MinterHandle) => (m.kind === 'minter' ? c.compiledMinter() : c.compiledMinterCollide());

/** Build one call, prove it with its own contract's providers, balance it, submit it. */
const submitSingle = async (spec: CallSpec, payer: Party | undefined): Promise<string> => {
  const run = async () => {
    const built = await buildCall(spec);
    const proven = await spec.providers.proofProvider.proveTx(built.private.unprovenTx);
    const toSubmit = await spec.providers.walletProvider.balanceTx(proven);
    return String(await spec.providers.midnightProvider.submitTx(toSubmit));
  };
  return payer ? withDustRetry(payer, spec.circuitId, run) : run();
};

// ---------------------------------------------------------------------------------------------
// MINT — contract -> user wallet
// ---------------------------------------------------------------------------------------------

/**
 * Mint `value` of a deployment's SHIELDED colour to a user wallet.
 *
 * Sending a shielded coin to ANOTHER party needs that party's ENCRYPTION public key, or the builder
 * fails with "Unable to resolve encryption public key for recipient".
 */
export const mintShieldedToUser = async (
  c: Ctx,
  minter: string,
  value: bigint,
  to: Party,
  payer: Party,
): Promise<string> => {
  const m = minterOf(c, minter);
  const coinPk = to.shieldedSecretKeys.coinPublicKey;
  return submitSingle(
    {
      providers: m.providers,
      compiledContract: compiledFor(c, m),
      contractAddress: m.address,
      circuitId: 'mintShieldedTo',
      args: [value, randomBytes(32), shieldedToUser(coinPk)],
      encMappings: new Map<unknown, unknown>([[coinPk, to.shieldedSecretKeys.encryptionPublicKey]]),
    },
    payer,
  );
};

/** Mint `amount` of a deployment's UNSHIELDED colour to a user wallet's unshielded address. */
export const mintUnshieldedToUser = async (
  c: Ctx,
  minter: string,
  amount: bigint,
  toAddressHex: string,
  payer: Party,
): Promise<string> => {
  const m = minterOf(c, minter);
  return submitSingle(
    {
      providers: m.providers,
      compiledContract: compiledFor(c, m),
      contractAddress: m.address,
      circuitId: 'mintUnshieldedTo',
      args: [amount, unshieldedToUser(toAddressHex)],
    },
    payer,
  );
};

// ---------------------------------------------------------------------------------------------
// USER -> MANAGER ACCOUNT (deposit): a SINGLE call, balanced by the depositor's own wallet
// ---------------------------------------------------------------------------------------------

/**
 * Deposit `value` of shielded `colour` from `depositor`'s wallet into `accountId`.
 *
 * No composition is needed: `depositShielded` declares the receive and the depositor's wallet
 * supplies the input during `balanceTx`, so the sender's spend and the Manager's receive are in one
 * transaction by construction. The deposited coin's nonce is chosen here because the COIN IS
 * CREATED BY THE CONTRACT — the wallet only has to fund it, splitting a larger coin and taking the
 * change back.
 *
 * `accountId` need NOT be the depositor's own account: spec step 10 has OwnerM deposit into AA_A.
 * Credit is open to any REGISTERED account; only spends are owner-gated (FR-204).
 */
export const userDepositShielded = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  colour: Uint8Array,
  value: bigint,
  accountId: Uint8Array,
): Promise<{ txId: string; nonce: Uint8Array }> => {
  const nonce = randomBytes(32);
  const txId = await submitSingle(
    {
      providers: depositorManagerProviders,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'depositShielded',
      args: [{ nonce, color: colour, value }, accountId],
      privateStateId: 'manager',
    },
    depositor,
  );
  return { txId, nonce };
};

/** Deposit `amount` of unshielded `colour` from `depositor`'s wallet into `accountId`. */
export const userDepositUnshielded = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  colour: Uint8Array,
  amount: bigint,
  accountId: Uint8Array,
): Promise<string> =>
  submitSingle(
    {
      providers: depositorManagerProviders,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'depositUnshielded',
      args: [colour, amount, accountId],
      privateStateId: 'manager',
    },
    depositor,
  );

// ---------------------------------------------------------------------------------------------
// MANAGER ACCOUNT -> USER (withdraw) and ACCOUNT -> ACCOUNT (internal)
// ---------------------------------------------------------------------------------------------

/**
 * Pay `value` of shielded `colour` out of THAT COLOUR's pool to `to`, debiting the account whose
 * owner secret authorizes the call. The pool retains the change coin; a fully spent colour leaves
 * the pool map entirely.
 */
export const accountWithdrawShielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  colour: Uint8Array,
  value: bigint,
  to: Party,
  payer: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  const coinPk = to.shieldedSecretKeys.coinPublicKey;
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'withdrawShielded',
      args: [colour, value, shieldedToUser(coinPk)],
      privateStateId: 'manager',
      encMappings: new Map<unknown, unknown>([[coinPk, to.shieldedSecretKeys.encryptionPublicKey]]),
    },
    payer,
  );
};

/** Pay `amount` of unshielded `colour` out of the contract's ledger balance to a user address. */
export const accountWithdrawUnshielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  colour: Uint8Array,
  amount: bigint,
  toAddressHex: string,
  payer: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'withdrawUnshielded',
      args: [colour, amount, unshieldedToUser(toAddressHex)],
      privateStateId: 'manager',
    },
    payer,
  );
};

/**
 * Move ownership of ONE SHIELDED colour between accounts INSIDE the Manager. No token operation
 * happens: that colour's pooled coin (value AND nonce) and the contract's ledger balances must be
 * byte-identical before and after, and no OTHER colour may be touched at all.
 *
 * The CREDIT SIDE creates the destination's cell lazily (FR-202; spec step 12). The circuit is
 * per-family by owner decision D-204 — with byte-identical colours possible across families
 * (P-COLL), `(to, colour, amount)` alone could not say which family it meant.
 */
export const transferInternalShielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  to: Uint8Array,
  colour: Uint8Array,
  amount: bigint,
  payer: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'transferInternalShielded',
      args: [to, colour, amount],
      privateStateId: 'manager',
    },
    payer,
  );
};

/** The unshielded family's internal transfer — same shape, different map and key domain. */
export const transferInternalUnshielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  to: Uint8Array,
  colour: Uint8Array,
  amount: bigint,
  payer: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'transferInternalUnshielded',
      args: [to, colour, amount],
      privateStateId: 'manager',
    },
    payer,
  );
};

// ---------------------------------------------------------------------------------------------
// PROBE M3 — ATOMIC DOUBLE LAZY-INIT (FR-207, decision D-203)
// ---------------------------------------------------------------------------------------------

/**
 * Every MESSAGE in an error's `cause` chain, with stack frames stripped.
 *
 * The pinned SDK reports a node-side refusal as a bare `Transaction submission error`, with the
 * substance — the node's `1010: Invalid Transaction: Custom error: NNN` — one or more links down
 * the chain. Recording only `e.message` would put "Transaction submission error" in the evidence as
 * if it were a diagnosis.
 *
 * **Stripping the frames is load-bearing, not cosmetic** (00005 G3 run 1). The Effect-based
 * submission service inlines its whole stack INTO the message on a single line, so the first link
 * alone ran to several thousand characters and the truncation budget was exhausted before any
 * `cause` was reached — leaving FR-207's "record the verbatim error" satisfied only by a stack
 * trace. Frames are dropped both as whole lines and as the inline ` at <fn> (<file>:L:C)` form.
 */
export const errorChain = (e: unknown, depth = 8): string => {
  const stripFrames = (raw: string): string =>
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^at\s/.test(l))
      .join(' ')
      // the inline form: ` at file:///…:31:279`, ` at body (/…/Utils.ts:786:14)`
      .replace(/\s+at\s+\S+(?:\s+\([^)]*\))?/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const parts: string[] = [];
  let cur: any = e;
  for (let i = 0; i < depth && cur; i++) {
    const msg = stripFrames(cur instanceof Error ? cur.message : String(cur));
    if (msg && !parts.includes(msg)) parts.push(msg);
    cur = cur?.cause;
  }
  return parts.join(' | cause: ').slice(0, 1500);
};

export const SDK_SCOPED = 'sdk-scoped batch (one transaction, one segment per call, state threaded)';
export const SEPARATE_TXS = 'two separate transactions (FR-207 fallback — composition refused)';

export type DoubleLazyInitLegs = {
  shieldedColour: Uint8Array;
  shieldedValue: bigint;
  unshieldedColour: Uint8Array;
  unshieldedAmount: bigint;
  accountId: Uint8Array;
};

export type DoubleLazyInitAttempt = { shape: string; attempt: number; ok: boolean; error?: string };

const legSpecs = (
  c: Ctx,
  providers: any,
  legs: DoubleLazyInitLegs,
  nonce: Uint8Array,
): { shielded: CallSpec; unshielded: CallSpec } => ({
  shielded: {
    providers,
    compiledContract: c.compiledManager(),
    contractAddress: c.managerAddress,
    circuitId: 'depositShielded',
    args: [{ nonce, color: legs.shieldedColour, value: legs.shieldedValue }, legs.accountId],
    privateStateId: 'manager',
  },
  unshielded: {
    providers,
    compiledContract: c.compiledManager(),
    contractAddress: c.managerAddress,
    circuitId: 'depositUnshielded',
    args: [legs.unshieldedColour, legs.unshieldedAmount, legs.accountId],
    privateStateId: 'manager',
  },
});

/**
 * midnight-js's OWN same-contract batching: both calls, ONE transaction.
 *
 * This is the shape decision D-203 names, and it is the shape 00004's probe M1 landed on this lane
 * (`archive/00004/evidence/g3-ledger/run-context.json`): a same-address sequence assembled into one
 * ledger Intent was refused (the 223 `CausalityConstraintViolation` family), while
 * `withContractScopedTransaction` — which threads the running contract state between the calls and
 * places each in its own SEGMENT of one transaction — was accepted. 00005 does not re-run the
 * refused one-Intent shape; it attempts the one 00004 proved, and records what happens.
 */
export const scopedDoubleDeposit = async (
  c: Ctx,
  providers: any,
  legs: DoubleLazyInitLegs,
  nonce: Uint8Array,
): Promise<any> => {
  const specs = legSpecs(c, providers, legs, nonce);
  return (withContractScopedTransaction as any)(
    providers,
    async (txCtx: any) => {
      for (const spec of [specs.shielded, specs.unshielded]) {
        // `submitCallTx` with an OUTER transaction context is the SDK's own batching entry point:
        // it builds the call AND registers it with the scope. `createUnprovenCallTx` alone builds
        // the call but never registers it, so the scope would end with "No calls were submitted."
        await (submitCallTx as any)(
          spec.providers,
          {
            compiledContract: spec.compiledContract,
            circuitId: spec.circuitId,
            contractAddress: spec.contractAddress,
            args: spec.args,
            ...(spec.privateStateId ? { privateStateId: spec.privateStateId } : {}),
          },
          txCtx,
        );
      }
    },
    { scopeName: 'aa00005-double-lazy-init' },
  );
};

/**
 * ONE attempt at probe M3's composition (FR-207): the first deposits of two brand-new colours, one
 * per family, in ONE transaction.
 *
 * It never falls back and never throws — the caller decides whether to retry on a fresh wallet and
 * when to apply FR-207's fallback, because those are two different claims and FR-207 forbids
 * conflating them. **The retry exists for a diagnosed reason** (00004 F-107, and 00005 G3 run 1):
 * the failure mode this shape actually exhibits on this lane is a node-side refusal that a wallet
 * which had fully caught up did not reproduce, so a single attempt cannot distinguish "the ledger
 * refuses this composition" from "this wallet was not ready".
 */
export const tryScopedDoubleDeposit = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  legs: DoubleLazyInitLegs,
): Promise<{ ok: true; txId: string; nonce: string } | { ok: false; error: string }> => {
  const nonce = randomBytes(32);
  try {
    const finalized: any = await withDustRetry(depositor, 'M3/scoped-double-deposit', () =>
      scopedDoubleDeposit(c, depositorManagerProviders, legs, nonce),
    );
    return {
      ok: true,
      txId: String(finalized?.public?.txId ?? finalized?.public?.txHash ?? finalized),
      nonce: hex(nonce),
    };
  } catch (e) {
    return { ok: false, error: errorChain(e) };
  }
};

/**
 * FR-207's fallback: prove the LAZY-INIT half on its own, with SEPARATE transactions.
 *
 * Reported separately from the composition attempt, always — a composition refusal is never
 * conflated with a lazy-init failure.
 */
export const separateDoubleDeposit = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  legs: DoubleLazyInitLegs,
): Promise<{ txIds: string[]; nonce: string }> => {
  const shieldedTx = await userDepositShielded(
    c,
    depositor,
    depositorManagerProviders,
    legs.shieldedColour,
    legs.shieldedValue,
    legs.accountId,
  );
  const unshieldedTx = await userDepositUnshielded(
    c,
    depositor,
    depositorManagerProviders,
    legs.unshieldedColour,
    legs.unshieldedAmount,
    legs.accountId,
  );
  return { txIds: [shieldedTx.txId, unshieldedTx], nonce: hex(shieldedTx.nonce) };
};

export { hex };
