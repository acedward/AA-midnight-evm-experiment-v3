// G3 — building one unproven contract call.
//
// Everything the four-colour ledger does is either a SINGLE call (built here, then proved, balanced
// and submitted by `actions.ts`) or the mixed-colour composition of step 13, which assembles two
// calls into one ledger `Intent` (`ledger-compose.ts`).
//
// The 00003-era experiments that used to live in this file — `submitInOneIntent`,
// `submitComposed` — are gone. They existed to explore what midnight-js could and could not compose
// across TWO CONTRACTS; that question was answered by 00003's finding R8 and the answer is
// implemented in `ledger-compose.ts`. Keeping dead exploration code with `aa00003` scope names in a
// 00004 gate would have been misleading rather than merely untidy. The one SDK-level composition
// this project still uses — `withContractScopedTransaction`, the recorded fallback shape for
// decision D-102 — is called directly from `actions.ts`, where the decision is documented.
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
