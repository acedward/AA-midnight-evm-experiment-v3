// G3 — building one unproven contract call.
//
// Everything the 18-row ledger does is a SINGLE call, built here and then proved, balanced and
// submitted by `actions.ts`. The one exception is probe M3, whose two calls go into ONE transaction
// through the SDK's own `withContractScopedTransaction` — called directly from `actions.ts`, where
// decision D-203 is documented.
//
// The ledger-level one-Intent composer that used to sit beside this file belongs to a question
// 00003 and 00004 already answered (R8, then D-102: a same-address two-call Intent is refused by
// the 223 rule, and the scoped batch is accepted). It has no caller in 00005 and was archived —
// see `archive/00004/ARCHIVE.md`.
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';

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

/** Build one unproven call transaction by executing the real compiled circuit. */
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
