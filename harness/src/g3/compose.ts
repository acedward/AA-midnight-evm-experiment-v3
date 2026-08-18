// G3 — transaction-level composition (the answer to master Q2 / OQ2).
//
// The spec requires a transfer INTO the Manager to be ONE transaction containing the sender's
// operation and the Manager's receive claim, because the standard library only auto-receives when
// the recipient is `kernel.self()`.
//
// `withContractScopedTransaction` batches calls, but it is scoped to a single contract's
// providers, so it cannot pair a Minter call with a Manager call. The route used here is
// transaction-level composition of two independently-built calls:
//
//     createUnprovenCallTx(minter …)   ->  unprovenTx A
//     createUnprovenCallTx(manager …)  ->  unprovenTx B
//     A.merge(B)                       ->  one unproven transaction
//     balance -> sign -> finalize -> submit
//
// This is exactly what the spec describes as "transaction-level composition of independent calls,
// not nested C2C", so witnesses stay usable in each call and 00002's non-root-witness blocker
// does not apply.
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import type { Party } from '../wallet.js';

export type CallSpec = {
  providers: any;
  compiledContract: any;
  contractAddress: string;
  circuitId: string;
  args: unknown[];
  privateStateId?: string;
  /**
   * Encryption keys for recipients that are not the caller. Minting or sending a shielded coin to
   * ANOTHER party requires their encryption public key so the output can be encrypted to them;
   * without it the builder fails with "Unable to resolve encryption public key for recipient".
   */
  encMappings?: ReadonlyMap<unknown, unknown>;
};

/** Build one unproven call transaction. */
export const buildCall = async (spec: CallSpec): Promise<any> => {
  const options: any = {
    compiledContract: spec.compiledContract,
    circuitId: spec.circuitId,
    contractAddress: spec.contractAddress,
    args: spec.args,
  };
  if (spec.privateStateId) options.privateStateId = spec.privateStateId;
  if (spec.encMappings) options.additionalCoinEncPublicKeyMappings = spec.encMappings;
  return await (createUnprovenCallTx as any)(spec.providers, options);
};

/**
 * Compose N calls into ONE transaction, then balance, sign, finalise and submit it.
 * Returns the submitted transaction identifier.
 */
export const submitComposed = async (
  feePayer: Party,
  /** Providers whose zkConfigProvider covers EVERY contract in `specs` (the combined view). */
  composedProviders: any,
  specs: CallSpec[],
): Promise<string> => {
  if (specs.length === 0) throw new Error('submitComposed: no calls given');

  // Each call is built AND PROVEN with its own contract's providers. The proof provider resolves
  // ZK artifact bundles against the DEPLOYED contract's verifier key, so a flattened "all keys in
  // one directory" view cannot serve two contracts — the bundle lookup is per contract, not per
  // circuit name. Proving per contract and merging afterwards keeps each lookup correct.
  const proven: any[] = [];
  for (const s of specs) {
    const built = await buildCall(s);
    proven.push(await s.providers.proofProvider.proveTx(built.private.unprovenTx));
  }

  // Transaction-level composition: merge the proven, pre-binding transactions into one.
  let tx: any = proven[0];
  for (let i = 1; i < proven.length; i++) tx = tx.merge(proven[i]);

  // Then the standard tail of midnight-js's own flow: balance (wallet inputs/outputs/fees), submit.
  const toSubmit = await composedProviders.walletProvider.balanceTx(tx);
  const id = await composedProviders.midnightProvider.submitTx(toSubmit);
  return String(id);
};
