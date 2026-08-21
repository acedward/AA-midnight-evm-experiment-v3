// Plan 01 Phase 2 — the taker half: STOCK facade calls only (FR-303). EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Everything here is a call on `WalletFacade`. There is no custom balancing, no hand-assembled offer
// and no ledger-level surgery on the taker side — that is the point of FR-303 and the reason this
// module is 100 lines instead of 1000: if an offer needs bespoke taker code it is not an offer, it is
// a joint transaction.
//
// The pinned facade exposes TWO entry points for balancing somebody else's transaction, and its own
// docstring pins the strictness flags each one wants (`wallet-sdk-facade/dist/index.d.ts:307-314`).
// Both are exercised, because WHICH ONE WORKS decides what form 00006 actually publishes (D-306):
//
//   unbound  the artifact stays `Transaction<SignatureEnabled, Proof, PreBinding>` — the shape the
//            pinned SDK's own shielded-swap e2e test uses
//            (`midnight-wallet/packages/e2e-tests/src/tests/swap.undeployed.test.ts:207-217`):
//            validate(false,false,false) -> balanceUnboundTransaction -> signRecipe -> finalizeRecipe.
//   bound    the maker calls `bind()` first, freezing the transaction, and the taker uses
//            validate(false,true,false) -> balanceFinalizedTransaction -> signRecipe -> finalizeRecipe.
//
// `finalizeRecipe` IS `originalTransaction.merge(balancing)` — the merge whose legality at
// ledger-9.1.0.0-rc.3 the master plan establishes from source. Nothing here forces it.
import { errorChain } from '../g3/actions.js';
import { deepErrorText, nodeRefusalOf, type NodeRefusal } from '../node-error.js';
import { log, withDustRetry } from '../night.js';
import type { Party } from '../wallet.js';

export type TakerRoute = 'unbound' | 'bound';

const TTL_MS = 30 * 60 * 1000;

/** The strictness triples the facade's own docstring prescribes per call site. */
export const FLAGS = {
  beforeBalanceUnbound: { enforceBalancing: false, verifySignatures: false, enforceLimits: false },
  beforeBalanceFinalized: { enforceBalancing: false, verifySignatures: true, enforceLimits: false },
  beforeSubmit: { enforceBalancing: true, verifySignatures: true, enforceLimits: true },
} as const;

export type ValidationOutcome = { flags: Record<string, boolean>; passed: boolean; error?: string };

/** `validateTransaction`, recorded rather than merely awaited — a refusal here is evidence. */
export const validate = async (
  party: Party,
  tx: any,
  flags: Record<string, boolean>,
  blockData?: unknown,
): Promise<ValidationOutcome> => {
  try {
    await (party.wallet as any).validateTransaction(tx, { flags, ...(blockData ? { blockData } : {}) });
    return { flags, passed: true };
  } catch (e) {
    return { flags, passed: false, error: errorChain(e) };
  }
};

/** What a recipe looks like, for the evidence file. Recipes are privacy-sensitive; only shapes here. */
export const describeRecipe = (recipe: any): Record<string, unknown> => {
  const keys = recipe && typeof recipe === 'object' ? Object.keys(recipe).sort() : [];
  const out: Record<string, unknown> = { keys };
  for (const k of ['transaction', 'baseTransaction', 'balancingTransaction', 'originalTransaction']) {
    if (recipe?.[k] !== undefined) out[k] = recipe[k] === undefined ? 'undefined' : 'present';
  }
  if (recipe?.blockData) {
    out.blockData = { height: recipe.blockData.height, hash: String(recipe.blockData.hash).slice(0, 18) };
  }
  return out;
};

export type SettlementResult = {
  route: TakerRoute;
  ok: boolean;
  /** Where a failed settlement stopped; `presubmit` means the node was never contacted. */
  failureStage?: 'presubmit' | 'settlement';
  /** The submitted transaction identifier the facade returns. */
  txId?: string;
  /** `transactionHash()` of the finalized transaction — the canonical chain id. */
  txHash?: string;
  identifiers?: string[];
  validations: ValidationOutcome[];
  recipeShape?: Record<string, unknown>;
  /** Physical intent segments of the FINALIZED (merged) transaction. */
  finalizedIntentSegments?: number[];
  /** The fee the finalized transaction declares, in SPECKs. */
  feesSpecks?: string;
  /** Whatever the `preSubmit` guard reported, if one was supplied (Plan 02's fail-closed check). */
  preSubmitGuard?: unknown;
  error?: string;
  /**
   * The NODE's own verdict, dug out of the facade's wrapper.
   *
   * The facade replaces the node's error with the bare string `Transaction submission error` and hides
   * the real one in an Effect tagged field, so walking `.cause` finds nothing. Without this every
   * refusal in this project would read "code none" — see `src/node-error.ts` for why the extraction is
   * brute-force rather than clever.
   */
  nodeRefusal?: NodeRefusal;
  /** The full rendered error graph, for the cases where the extraction found nothing to name. */
  errorDump?: string;
};

export type SettleOptions = {
  ttlMs?: number;
  label?: string;
  /**
   * A last check on the FINALIZED (merged) transaction, run BEFORE `submitTransaction`. Throwing
   * refuses the submit; whatever it returns is recorded as `preSubmitGuard`.
   *
   * Added by Plan 02 for the fail-closed imbalance guard (the Offer Files `nonDustImbalances` +
   * `ImbalanceUnreadableError` pattern). Optional and defaulted, so Plan 01's spikes — whose evidence
   * is already committed and gate-green — behave exactly as they did.
   */
  preSubmit?: (finalized: any, recipe: any) => unknown | Promise<unknown>;
};

const intentSegmentsOf = (tx: any): number[] => {
  try {
    return Array.from((tx.intents?.keys?.() ?? []) as Iterable<number>).map((s) => Number(s)).sort((a, b) => a - b);
  } catch {
    return [];
  }
};

/**
 * Settle a maker artifact with stock facade calls.
 *
 * `tx` must be the UNBOUND proven artifact. For `route: 'bound'` this function calls `bind()` itself,
 * so the caller hands over the same object shape either way.
 */
export const settleAsTaker = async (
  taker: Party,
  tx: any,
  route: TakerRoute,
  opts: SettleOptions = {},
): Promise<SettlementResult> => {
  const validations: ValidationOutcome[] = [];
  let preSubmitGuard: unknown;
  let failureStage: SettlementResult['failureStage'] = 'settlement';
  const label = opts.label ?? route;
  const ttl = new Date(Date.now() + (opts.ttlMs ?? TTL_MS));
  const facade: any = taker.wallet;

  try {
    let recipe: any;
    let recipeShape: Record<string, unknown>;

    if (route === 'unbound') {
      validations.push(await validate(taker, tx, FLAGS.beforeBalanceUnbound as any));
      log(`taker[${label}]: balanceUnboundTransaction on a transaction it did not build`);
      recipe = await withDustRetry(taker, `taker ${label} balanceUnbound`, () =>
        facade.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys: taker.shieldedSecretKeys, dustSecretKey: taker.dustSecretKey },
          { ttl },
        ),
      );
    } else {
      const bound = tx.bind();
      validations.push(await validate(taker, bound, FLAGS.beforeBalanceFinalized as any));
      log(`taker[${label}]: balanceFinalizedTransaction on a BOUND transaction it did not build`);
      recipe = await withDustRetry(taker, `taker ${label} balanceFinalized`, () =>
        facade.balanceFinalizedTransaction(
          bound,
          { shieldedSecretKeys: taker.shieldedSecretKeys, dustSecretKey: taker.dustSecretKey },
          { ttl },
        ),
      );
    }
    recipeShape = describeRecipe(recipe);

    // Unshielded segments need the keystore signature before finalisation; signing a recipe with no
    // unshielded segment is a no-op, so this is safe for every transaction shape.
    const signed = await facade.signRecipe(recipe, (taker.unshieldedKeystore as any).signDataAsync);
    // finalizeRecipe IS the merge.
    const finalized = await facade.finalizeRecipe(signed);

    const preSubmit = await validate(taker, finalized, FLAGS.beforeSubmit as any, recipe?.blockData);
    validations.push(preSubmit);

    let txHash: string | undefined;
    try {
      txHash = String(finalized.transactionHash());
    } catch {
      /* not every lifecycle state defines it */
    }
    let feesSpecks: string | undefined;
    try {
      const params = recipe?.blockData?.ledgerParameters;
      if (params) feesSpecks = String(finalized.fees(params));
    } catch {
      /* fee estimation is diagnostics, not an assertion */
    }

    // The fail-closed guard, if the caller supplied one. It runs on the MERGED transaction, which is
    // the only object that can answer "is this actually submittable and does it hold what I agreed
    // to?" — the offer alone cannot, and the recipe is not the thing that gets submitted.
    if (opts.preSubmit) {
      failureStage = 'presubmit';
      preSubmitGuard = await opts.preSubmit(finalized, recipe);
      failureStage = 'settlement';
    }

    log(`taker[${label}]: submitting the merged transaction`);
    const txId = String(await facade.submitTransaction(finalized));

    return {
      route,
      ok: true,
      txId,
      txHash,
      preSubmitGuard,
      identifiers: (() => {
        try {
          return Array.from(finalized.identifiers() as Iterable<string>).map(String);
        } catch {
          return undefined;
        }
      })(),
      validations,
      recipeShape,
      finalizedIntentSegments: intentSegmentsOf(finalized),
      feesSpecks,
    };
  } catch (e) {
    return {
      route,
      ok: false,
      failureStage,
      validations,
      preSubmitGuard,
      error: errorChain(e),
      nodeRefusal: nodeRefusalOf(e),
      // Kept because a refusal whose code could not be extracted is exactly the case where the raw
      // graph is the evidence. Truncated so one bad error cannot dominate an evidence file.
      errorDump: deepErrorText(e).slice(0, 6000),
    };
  }
};
