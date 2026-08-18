// G3 — the token-movement operations the four-colour step ledger is built from.
//
// One function per shape, so the ordered runner and the negative controls exercise the SAME code
// path. Each returns the submitted transaction id (and any detail the evidence needs); none of them
// asserts — assertion is the runner's job, against the spec's expected 16-cell table.
//
// Every operation takes its COLOUR explicitly. That is the whole point of 00004: there is no
// "the shielded colour" any more, only S1, S2, U1, U2, and every circuit checks the colour it was
// given against the four the Manager was configured with (FR-106).
//
// COMPOSITION LEVEL per shape (recorded per cell in CELLS.md):
//   * mint -> user wallet                    SDK    — a single Minter call
//   * user -> Manager account (deposit)      SDK    — a single Manager call balanced by the
//                                                     depositor's own wallet: the Manager declares
//                                                     the receive and the wallet supplies the input,
//                                                     so both sit in one transaction by construction
//   * Manager account -> user (withdraw)     SDK    — a single Manager call, owner-authorized
//   * account -> account (internal)          SDK    — a single Manager call, NO token operation
//   * mixed-colour deposit (M1, step 13)     LEDGER — TWO Manager calls in ONE ledger Intent
//                                                     (decision D-102; see `mixedColourDeposit`)
import { randomBytes } from 'node:crypto';
import { buildCall, type CallSpec } from './compose.js';
import { composeOneIntent, proveBalanceSubmit } from './ledger-compose.js';
import { withContractScopedTransaction, createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { withDustRetry } from '../night.js';
import type { Party } from '../wallet.js';
import type { ColourName, ColourSet } from './observe.js';

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

export type MinterLabel = 'Minter1' | 'Minter2' | 'Minter3';

export type Ctx = {
  managerAddress: string;
  minterAddresses: Record<MinterLabel, string>;
  compiledMinter: () => any;
  compiledManager: () => any;
  /** Minter providers backed by the fee wallet — every mint is issued and paid for by the operator. */
  minterProviders: any;
  /** Manager providers backed by the fee wallet — used for every owner-authorized circuit. */
  managerFee: any;
  /** Proof provider that can serve BOTH contracts (ZKConfigRegistry). */
  composedProof: any;
  /** Sets the owner secret the Manager's witness will read on the next call through `providers`. */
  actAs: (providers: any, secret: Uint8Array) => Promise<void>;
  colours: ColourSet;
};

/**
 * A colour argument: one of the four CONFIGURED colours by name, or raw bytes.
 *
 * Raw bytes exist for the wrong-colour controls (NC-4): naming Minter3's never-configured colour is
 * the whole point of those, and passing it as bytes keeps the four configured names meaning exactly
 * what they mean everywhere else in the harness.
 */
export type ColourArg = ColourName | Uint8Array;

const colourBytes = (c: Ctx, x: ColourArg): Uint8Array => (x instanceof Uint8Array ? x : c.colours.raw[x]);

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
// MINT — contract -> user wallet (steps 1-4, and the NC-4b control coin)
// ---------------------------------------------------------------------------------------------

/**
 * Mint `value` of a Minter deployment's SHIELDED colour to a user wallet.
 *
 * Sending a shielded coin to ANOTHER party needs that party's ENCRYPTION public key, or the builder
 * fails with "Unable to resolve encryption public key for recipient".
 */
export const mintShieldedToUser = async (
  c: Ctx,
  minter: MinterLabel,
  value: bigint,
  to: Party,
  payer: Party,
): Promise<string> => {
  const coinPk = to.shieldedSecretKeys.coinPublicKey;
  return submitSingle(
    {
      providers: c.minterProviders,
      compiledContract: c.compiledMinter(),
      contractAddress: c.minterAddresses[minter],
      circuitId: 'mintShieldedTo',
      args: [value, randomBytes(32), shieldedToUser(coinPk)],
      encMappings: new Map<unknown, unknown>([[coinPk, to.shieldedSecretKeys.encryptionPublicKey]]),
    },
    payer,
  );
};

/** Mint `amount` of a Minter deployment's UNSHIELDED colour to a user wallet's unshielded address. */
export const mintUnshieldedToUser = async (
  c: Ctx,
  minter: MinterLabel,
  amount: bigint,
  toAddressHex: string,
  payer: Party,
): Promise<string> =>
  submitSingle(
    {
      providers: c.minterProviders,
      compiledContract: c.compiledMinter(),
      contractAddress: c.minterAddresses[minter],
      circuitId: 'mintUnshieldedTo',
      args: [amount, unshieldedToUser(toAddressHex)],
    },
    payer,
  );

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
 */
export const userDepositShielded = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  colour: ColourArg,
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
      args: [{ nonce, color: colourBytes(c, colour), value }, accountId],
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
  colour: ColourArg,
  amount: bigint,
  accountId: Uint8Array,
): Promise<string> =>
  submitSingle(
    {
      providers: depositorManagerProviders,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'depositUnshielded',
      args: [colourBytes(c, colour), amount, accountId],
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
  colour: ColourArg,
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
      args: [colourBytes(c, colour), value, shieldedToUser(coinPk)],
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
  colour: ColourArg,
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
      args: [colourBytes(c, colour), amount, unshieldedToUser(toAddressHex)],
      privateStateId: 'manager',
    },
    payer,
  );
};

/**
 * Move ownership of ONE colour between accounts INSIDE the Manager. No token operation happens:
 * that colour's pooled coin (value AND nonce) and the contract's ledger balances must be
 * byte-identical before and after, and no OTHER colour may be touched at all.
 */
export const transferInternal = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  to: Uint8Array,
  colour: ColourArg,
  amount: bigint,
  payer: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'transferInternal',
      args: [to, colourBytes(c, colour), amount],
      privateStateId: 'manager',
    },
    payer,
  );
};

// ---------------------------------------------------------------------------------------------
// MIXED-COLOUR ONE-TRANSACTION COMPOSITION — FR-107 / decision D-102 (step 13 = probe M1)
// ---------------------------------------------------------------------------------------------

export type MixedShape = 'one-intent (two same-contract calls)' | 'sdk-scoped batch (two intents, one transaction)';

export type MixedResult = {
  txId: string;
  shape: MixedShape;
  segment?: number;
  circuits: string[];
  shieldedNonce: string;
  /** Verbatim error from any shape that was tried and failed, in the order tried. */
  attempts: Array<{ shape: MixedShape; ok: boolean; error?: string }>;
};

type MixedLegs = {
  shieldedColour: ColourName;
  shieldedValue: bigint;
  unshieldedColour: ColourName;
  unshieldedAmount: bigint;
  accountId: Uint8Array;
};

const mixedSpecs = (c: Ctx, providers: any, legs: MixedLegs, nonce: Uint8Array): { shielded: CallSpec; unshielded: CallSpec } => ({
  shielded: {
    providers,
    compiledContract: c.compiledManager(),
    contractAddress: c.managerAddress,
    circuitId: 'depositShielded',
    args: [{ nonce, color: c.colours.raw[legs.shieldedColour], value: legs.shieldedValue }, legs.accountId],
    privateStateId: 'manager',
  },
  unshielded: {
    providers,
    compiledContract: c.compiledManager(),
    contractAddress: c.managerAddress,
    circuitId: 'depositUnshielded',
    args: [c.colours.raw[legs.unshieldedColour], legs.unshieldedAmount, legs.accountId],
    privateStateId: 'manager',
  },
});

/**
 * Move TWO DIFFERENT COLOURS in ONE transaction, atomically (FR-107, spec step 13 / probe M1).
 *
 * Shape 1 — the preferred one, and the open half of decision D-102: both `depositShielded` and
 * `depositUnshielded` prototypes in ONE ledger `Intent`, using the 00003 R8 machinery
 * (`ledger-compose.ts`). R8 derived its carrier rule for TWO DIFFERENT contracts; here both calls
 * are on the SAME contract, which is why D-102 exists at all. The carrier rule still decides which
 * transaction is kept whole, and it still picks the SHIELDED leg: when the pool already holds that
 * colour, `depositShielded` merges, and `mergeCoinImmediate` puts a zswap input (the held pool coin)
 * and a zswap output (the merged coin) in that call's own transaction. Those parts exist nowhere
 * else, so discarding that transaction would drop them. The unshielded leg needs no zswap parts at
 * all, so it is always the graft.
 *
 * Shape 2 — the recorded fallback if the ledger refuses two calls on one contract in one intent:
 * midnight-js's own `withContractScopedTransaction`, which batches several calls to the SAME
 * contract into ONE transaction (it refuses a second CONTRACT outright — that asymmetry is exactly
 * why 00003 had to go to ledger level). It threads the running contract state through the calls, so
 * the second call is built against the first call's result; the cost is that its internal
 * `UnprovenTransaction.merge` puts each call in its own SEGMENT, so it is one TRANSACTION but not
 * one INTENT.
 *
 * Whichever shape lands, the evidence requirement is the same: ONE transaction id carrying BOTH
 * effects. Every attempt — including the verbatim error of one that fails — is returned so D-102
 * can be resolved from evidence rather than from an assumption.
 */
export const mixedColourDeposit = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  legs: MixedLegs,
): Promise<MixedResult> => {
  const nonce = randomBytes(32);
  const attempts: MixedResult['attempts'] = [];

  // --- shape 1: two same-contract calls in ONE ledger Intent ------------------------------------
  const oneIntent: MixedShape = 'one-intent (two same-contract calls)';
  try {
    const specs = mixedSpecs(c, depositorManagerProviders, legs, nonce);
    const composed = await composeOneIntent(specs.shielded, [specs.unshielded]);
    const txId = await withDustRetry(depositor, 'mixedColourDeposit/one-intent', () =>
      proveBalanceSubmit(composed.tx, c.composedProof, depositorManagerProviders),
    );
    attempts.push({ shape: oneIntent, ok: true });
    return { txId, shape: oneIntent, segment: composed.segment, circuits: composed.circuits, shieldedNonce: hex(nonce), attempts };
  } catch (e) {
    const err = e as any;
    const cause = err?.cause ? ` | cause: ${String(err.cause?.message ?? err.cause)}` : '';
    const message = `${e instanceof Error ? e.message : String(e)}${cause}`;
    attempts.push({ shape: oneIntent, ok: false, error: message.split('\n').slice(0, 4).join(' / ').slice(0, 800) });
    console.log(`  M1 shape 1 (one Intent) FAILED — falling back; verbatim: ${message.split('\n')[0]}`);
  }

  // --- shape 2: midnight-js's own same-contract batch --------------------------------------------
  const scoped: MixedShape = 'sdk-scoped batch (two intents, one transaction)';
  const nonce2 = randomBytes(32);
  const specs2 = mixedSpecs(c, depositorManagerProviders, legs, nonce2);
  const finalized: any = await withDustRetry(depositor, 'mixedColourDeposit/scoped', () =>
    (withContractScopedTransaction as any)(
      depositorManagerProviders,
      async (txCtx: any) => {
        for (const spec of [specs2.shielded, specs2.unshielded]) {
          await (createUnprovenCallTx as any)(
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
      { scopeName: 'aa00004-mixed-colour' },
    ),
  );
  attempts.push({ shape: scoped, ok: true });
  return {
    txId: String(finalized?.public?.txId ?? finalized?.public?.txHash ?? finalized),
    shape: scoped,
    circuits: ['depositShielded', 'depositUnshielded'],
    shieldedNonce: hex(nonce2),
    attempts,
  };
};

/**
 * The M2 negative: the step-13-shaped mixed-colour transaction with the SECOND leg wrong-coloured.
 *
 * Built exactly like `mixedColourDeposit` shape 1 — the valid shielded leg is built FIRST and in
 * full — and then the unshielded leg names a colour the Manager was never configured with. The
 * whole composition throws, so nothing is ever submitted: the valid leg's transaction is discarded
 * with it. Returns the verbatim rejection.
 */
export const mixedColourDepositWrongColour = async (
  c: Ctx,
  depositorManagerProviders: any,
  legs: Omit<MixedLegs, 'unshieldedColour'> & { wrongUnshieldedColour: Uint8Array },
): Promise<{ carrierBuilt: boolean; error: string }> => {
  const nonce = randomBytes(32);
  const shielded: CallSpec = {
    providers: depositorManagerProviders,
    compiledContract: c.compiledManager(),
    contractAddress: c.managerAddress,
    circuitId: 'depositShielded',
    args: [{ nonce, color: c.colours.raw[legs.shieldedColour], value: legs.shieldedValue }, legs.accountId],
    privateStateId: 'manager',
  };
  const wrongUnshielded: CallSpec = {
    providers: depositorManagerProviders,
    compiledContract: c.compiledManager(),
    contractAddress: c.managerAddress,
    circuitId: 'depositUnshielded',
    args: [legs.wrongUnshieldedColour, legs.unshieldedAmount, legs.accountId],
    privateStateId: 'manager',
  };

  // Build the VALID leg first and on its own, so the evidence can say the failure was the second
  // leg's and not a defect in the shape itself.
  let carrierBuilt = false;
  try {
    await buildCall(shielded);
    carrierBuilt = true;
  } catch (e) {
    return {
      carrierBuilt: false,
      error: `the VALID leg failed to build, so this control proves nothing: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    await composeOneIntent(shielded, [wrongUnshielded]);
    return { carrierBuilt, error: 'NOT REJECTED — the wrong-coloured mixed transaction was composed successfully' };
  } catch (e) {
    const err = e as any;
    const cause = err?.cause ? ` | cause: ${String(err.cause?.message ?? err.cause)}` : '';
    return { carrierBuilt, error: `${e instanceof Error ? e.message : String(e)}${cause}` };
  }
};

export { hex };
