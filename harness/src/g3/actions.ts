// G3 — the token-movement operations the step ledger is built from.
//
// One function per matrix cell shape, so the ordered runner, the negative controls and the
// atomicity probes all exercise the SAME code path. Each returns the submitted transaction id;
// none of them asserts — assertion is the runner's job, against the spec's expected table.
//
// COMPOSITION LEVEL per shape (recorded per cell in CELLS.md):
//   * mint(contract) -> Manager      LEDGER level  — both call prototypes in one Intent
//   * everything else                SDK level     — a single call, or a plain wallet transfer
import { randomBytes } from 'node:crypto';
import { buildCall, type CallSpec } from './compose.js';
import { composeOneIntent, proveBalanceSubmit } from './ledger-compose.js';
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

export type Ctx = {
  minterAddress: string;
  managerAddress: string;
  shieldedColor: Uint8Array;
  unshieldedColor: Uint8Array;
  compiledMinter: () => any;
  compiledManager: () => any;
  /** Minter providers backed by the fee wallet — every mint is issued and paid for by the demo operator. */
  minterProviders: any;
  /** Manager providers backed by the fee wallet — used for every owner-authorized circuit. */
  managerFee: any;
  /** Proof provider that can serve BOTH contracts (ZKConfigRegistry). */
  composedProof: any;
  /** Sets the owner secret the Manager's witness will read on the next call through `providers`. */
  actAs: (providers: any, secret: Uint8Array) => Promise<void>;
};

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

/**
 * Build, prove and balance a call WITHOUT submitting it. The atomicity probes need this: they
 * prepare a transaction against one state, let the chain move underneath it, and only then submit.
 */
export const prepareCall = async (spec: CallSpec): Promise<any> => {
  const built = await buildCall(spec);
  const proven = await spec.providers.proofProvider.proveTx(built.private.unprovenTx);
  return spec.providers.walletProvider.balanceTx(proven);
};

/** Submit a transaction prepared earlier by `prepareCall`. */
export const submitPrepared = async (spec: CallSpec, tx: any): Promise<string> =>
  String(await spec.providers.midnightProvider.submitTx(tx));

// ---------------------------------------------------------------------------------------------
// MINT — contract -> manager account (LEDGER-LEVEL composition) and contract -> user (SDK level)
// ---------------------------------------------------------------------------------------------

/**
 * Mint `value` of the shielded colour straight into a Manager account.
 *
 * The stdlib auto-receives only for `kernel.self()`, so the Minter's spend claim and the Manager's
 * receive claim must share one transaction — and midnight-js cannot express that, so the two call
 * prototypes are assembled into ONE ledger `Intent` (see `ledger-compose.ts`). The mint nonce is
 * chosen here and `mintShieldedToken` uses it verbatim, so the coin the Manager claims is known
 * exactly before either call runs.
 */
export const mintShieldedToAccount = async (
  c: Ctx,
  value: bigint,
  accountId: Uint8Array,
  payer?: Party,
): Promise<{ txId: string; nonce: Uint8Array; segment: number }> => {
  const nonce = randomBytes(32);
  const composed = await composeOneIntent(
    {
      providers: c.minterProviders,
      compiledContract: c.compiledMinter(),
      contractAddress: c.minterAddress,
      circuitId: 'mintShieldedTo',
      args: [value, nonce, shieldedToContract(c.managerAddress)],
    },
    [
      {
        providers: c.managerFee,
        compiledContract: c.compiledManager(),
        contractAddress: c.managerAddress,
        circuitId: 'depositShielded',
        args: [{ nonce, color: c.shieldedColor, value }, accountId],
        privateStateId: 'manager',
      },
    ],
  );
  const run = () => proveBalanceSubmit(composed.tx, c.composedProof, c.minterProviders);
  const txId = payer ? await withDustRetry(payer, 'mintShieldedToAccount', run) : await run();
  return { txId, nonce, segment: composed.segment };
};

/** Mint `amount` of the unshielded colour into a Manager account (LEDGER-LEVEL composition). */
export const mintUnshieldedToAccount = async (
  c: Ctx,
  amount: bigint,
  accountId: Uint8Array,
  payer?: Party,
): Promise<{ txId: string; segment: number }> => {
  const composed = await composeOneIntent(
    {
      providers: c.minterProviders,
      compiledContract: c.compiledMinter(),
      contractAddress: c.minterAddress,
      circuitId: 'mintUnshieldedTo',
      args: [amount, unshieldedToContract(c.managerAddress)],
    },
    [
      {
        providers: c.managerFee,
        compiledContract: c.compiledManager(),
        contractAddress: c.managerAddress,
        circuitId: 'depositUnshielded',
        args: [c.unshieldedColor, amount, accountId],
        privateStateId: 'manager',
      },
    ],
  );
  const run = () => proveBalanceSubmit(composed.tx, c.composedProof, c.minterProviders);
  const txId = payer ? await withDustRetry(payer, 'mintUnshieldedToAccount', run) : await run();
  return { txId, segment: composed.segment };
};

/**
 * Mint `value` of the shielded colour to a user wallet. A single Minter call — but sending a
 * shielded coin to ANOTHER party needs that party's ENCRYPTION public key, or the builder fails
 * with "Unable to resolve encryption public key for recipient".
 */
export const mintShieldedToUser = async (c: Ctx, value: bigint, to: Party, payer?: Party): Promise<string> => {
  const coinPk = to.shieldedSecretKeys.coinPublicKey;
  return submitSingle(
    {
      providers: c.minterProviders,
      compiledContract: c.compiledMinter(),
      contractAddress: c.minterAddress,
      circuitId: 'mintShieldedTo',
      args: [value, randomBytes(32), shieldedToUser(coinPk)],
      encMappings: new Map<unknown, unknown>([[coinPk, to.shieldedSecretKeys.encryptionPublicKey]]),
    },
    payer,
  );
};

/** Mint `amount` of the unshielded colour to a user wallet's unshielded address. */
export const mintUnshieldedToUser = async (c: Ctx, amount: bigint, to: Party, payer?: Party): Promise<string> => {
  const addr = String((await (to.wallet as any).unshielded.getAddress()).hexString);
  return submitSingle(
    {
      providers: c.minterProviders,
      compiledContract: c.compiledMinter(),
      contractAddress: c.minterAddress,
      circuitId: 'mintUnshieldedTo',
      args: [amount, unshieldedToUser(addr)],
    },
    payer,
  );
};

// ---------------------------------------------------------------------------------------------
// USER -> USER (and user -> self): a plain wallet transfer, no contract involved
// ---------------------------------------------------------------------------------------------

/**
 * Send `amount` of `color` from one wallet to another — or to the sender's own address, which is
 * the self-send cell. The wallet performs the split itself: it consumes the input coin/UTXO and
 * creates the sent output plus a change output back to the sender.
 */
export const userSend = async (
  from: Party,
  to: Party,
  family: 'shielded' | 'unshielded',
  color: string,
  amount: bigint,
): Promise<string> => {
  const receiverAddress =
    family === 'shielded'
      ? await (to.wallet as any).shielded.getAddress()
      : await (to.wallet as any).unshielded.getAddress();
  const transfers: any[] = [{ type: family, outputs: [{ amount, receiverAddress, type: color }] }];
  const ttl = new Date(Date.now() + 30 * 60 * 1000);

  return withDustRetry(from, `${from.name} -${amount}-> ${to.name} (${family})`, async () => {
    const recipe = await (from.wallet as any).transferTransaction(
      transfers,
      { shieldedSecretKeys: from.shieldedSecretKeys, dustSecretKey: from.dustSecretKey },
      { ttl },
    );
    const signed = await (from.wallet as any).signRecipe(recipe, (from.unshieldedKeystore as any).signDataAsync);
    const finalized = await (from.wallet as any).finalizeRecipe(signed);
    return String(await (from.wallet as any).submitTransaction(finalized));
  });
};

// ---------------------------------------------------------------------------------------------
// USER -> MANAGER ACCOUNT (deposit): a SINGLE call, balanced by the depositor's own wallet
// ---------------------------------------------------------------------------------------------

/**
 * Deposit `value` of the shielded colour from `depositor`'s wallet into `accountId`.
 *
 * No cross-contract composition is needed: `depositShielded` declares the receive, and the
 * depositor's wallet supplies the input during `balanceTx`, so the sender's spend and the
 * Manager's receive are in one transaction by construction (spec FR-003). The deposited coin's
 * nonce is chosen here because the COIN IS CREATED BY THE CONTRACT — the wallet only has to fund
 * it, splitting a larger coin and taking the change back.
 *
 * `depositorManagerProviders` must be Manager providers bound to the depositor's wallet.
 */
export const userDepositShielded = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
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
      args: [{ nonce, color: c.shieldedColor, value }, accountId],
      privateStateId: 'manager',
    },
    depositor,
  );
  return { txId, nonce };
};

/** Deposit `amount` of the unshielded colour from `depositor`'s wallet into `accountId`. */
export const userDepositUnshielded = async (
  c: Ctx,
  depositor: Party,
  depositorManagerProviders: any,
  amount: bigint,
  accountId: Uint8Array,
): Promise<string> =>
  submitSingle(
    {
      providers: depositorManagerProviders,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'depositUnshielded',
      args: [c.unshieldedColor, amount, accountId],
      privateStateId: 'manager',
    },
    depositor,
  );

// ---------------------------------------------------------------------------------------------
// MANAGER ACCOUNT -> USER (withdraw), ACCOUNT -> ACCOUNT (internal), and the pool self-sends
// ---------------------------------------------------------------------------------------------

/**
 * Pay `value` of the shielded colour out of the pool to `to`, debiting the account whose owner
 * secret authorizes the call. The pool retains the change coin; when the pool is fully spent the
 * empty-change arm resets it.
 */
export const accountWithdrawShielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  value: bigint,
  to: Party,
  payer?: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  const coinPk = to.shieldedSecretKeys.coinPublicKey;
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'withdrawShielded',
      args: [value, shieldedToUser(coinPk)],
      privateStateId: 'manager',
      encMappings: new Map<unknown, unknown>([[coinPk, to.shieldedSecretKeys.encryptionPublicKey]]),
    },
    payer,
  );
};

/** Pay `amount` of the unshielded colour out of the contract's ledger balance to `to`. */
export const accountWithdrawUnshielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  amount: bigint,
  to: Party,
  payer?: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  const addr = String((await (to.wallet as any).unshielded.getAddress()).hexString);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'withdrawUnshielded',
      args: [c.unshieldedColor, amount, unshieldedToUser(addr)],
      privateStateId: 'manager',
    },
    payer,
  );
};

/**
 * Move ownership between accounts INSIDE the Manager. No token operation happens: the pooled coin
 * and the contract's ledger balances must be byte-identical before and after (spec FR-005).
 */
export const transferInternal = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  to: Uint8Array,
  shieldedFamily: boolean,
  amount: bigint,
  payer?: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'transferInternal',
      args: [to, shieldedFamily, amount],
      privateStateId: 'manager',
    },
    payer,
  );
};

/** Pool self-send, shielded: exercises the stdlib auto-receive branch. Balance- and ownership-neutral. */
export const poolSelfSendShielded = async (c: Ctx, ownerSecret: Uint8Array, payer?: Party): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'selfSendShielded',
      args: [],
      privateStateId: 'manager',
    },
    payer,
  );
};

/** Pool self-send, unshielded: same auto-receive branch on the unshielded side. */
export const poolSelfSendUnshielded = async (
  c: Ctx,
  ownerSecret: Uint8Array,
  amount: bigint,
  payer?: Party,
): Promise<string> => {
  await c.actAs(c.managerFee, ownerSecret);
  return submitSingle(
    {
      providers: c.managerFee,
      compiledContract: c.compiledManager(),
      contractAddress: c.managerAddress,
      circuitId: 'selfSendUnshielded',
      args: [c.unshieldedColor, amount],
      privateStateId: 'manager',
    },
    payer,
  );
};

// ---------------------------------------------------------------------------------------------
// Negative-control building blocks
// ---------------------------------------------------------------------------------------------

/**
 * A mint straight into the Manager with the Manager's receive claim DELIBERATELY OMITTED — the
 * claim-mechanics negative control (spec User Story 1, scenario 3). Returns the submitted id if
 * the ledger somehow accepted it, or throws with the rejection reason.
 */
export const mintToManagerWithoutClaim = async (
  c: Ctx,
  family: 'shielded' | 'unshielded',
  value: bigint,
): Promise<string> => {
  const spec: CallSpec =
    family === 'shielded'
      ? {
          providers: c.minterProviders,
          compiledContract: c.compiledMinter(),
          contractAddress: c.minterAddress,
          circuitId: 'mintShieldedTo',
          args: [value, randomBytes(32), shieldedToContract(c.managerAddress)],
        }
      : {
          providers: c.minterProviders,
          compiledContract: c.compiledMinter(),
          contractAddress: c.minterAddress,
          circuitId: 'mintUnshieldedTo',
          args: [value, unshieldedToContract(c.managerAddress)],
        };
  return submitSingle(spec, undefined);
};

export { hex };
