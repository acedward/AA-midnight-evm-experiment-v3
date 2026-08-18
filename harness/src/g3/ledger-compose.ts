// G3 — LEDGER-LEVEL composition (the implementation of master Q3 / Finding G3-2).
//
// The problem, restated exactly. The standard library auto-receives a shielded coin only when the
// recipient is `kernel.self()`, so `Minter.mintShieldedTo(value, nonce, recipient = Manager)` must
// land in the SAME transaction as `Manager.depositShielded(coin, account)`. midnight-js
// v5.0.0-beta.6 cannot express that at SDK level:
//
//   * `withContractScopedTransaction` refuses a second contract outright
//     (`ScopedTransactionIdentityMismatchError`), and
//   * `UnprovenTransaction.merge` puts each call in its OWN SEGMENT, so the Minter's spend claim
//     and the Manager's receive claim cannot offset (`Wallet.InsufficientFunds`).
//
// The fix is the spec's documented fallback, mirroring `midnight-ledger/ledger/tests/
// token_vault_shielded.rs`: build ONE ledger `Intent` holding BOTH `ContractCallPrototype`s, so
// both calls sit in one segment alongside the single zswap output they both reference.
//
//   token_vault_shielded.rs                 this module
//   ---------------------------------------  --------------------------------------------------
//   hand-written Op<> transcript             transcript produced by executing the real circuit
//   partition_transcripts(&[pre])            partitioning done by compact-js per call
//   ContractCallPrototype { … }              `new ContractCallPrototype(…)` per call
//   test_intents(rng, vec![call], …)         `Intent.addCall` for every call
//   Transaction::new(nid, intents, offer)    the carrier call's own transaction, intent replaced
//
// Only the assembly is done at ledger level; each call's transcript, ZK input/output and private
// transcript still come from executing the compiled circuit through midnight-js, so nothing about
// the contracts is reimplemented off-chain.
//
// WHY A "CARRIER", AND WHICH CALL IT MUST BE. Only ONE of the calls' transactions is kept whole,
// with its zswap offers; the others contribute only their call prototypes and their own
// transactions are discarded. The carrier must therefore be the call whose transaction already
// carries EVERY zswap part the composed transaction needs.
//
// That call is the Manager's receive, not the Minter's mint:
//
//   * `mintShieldedToken` and `receiveShielded` both `createZswapOutput` the *same* coin to the
//     *same* recipient, so the two declare an identical output and the ledger needs exactly one of
//     it — claimed as a spend by the Minter and as a receive by the Manager, which is the shape
//     `token_vault_shielded.rs` builds. Either side's offer covers that one output.
//   * But when the pool is NOT empty, `depositShielded` also merges: `mergeCoinImmediate` spends
//     the held pool coin (a zswap INPUT) and writes a merged coin (another OUTPUT). Those parts
//     exist only in the Manager's own transaction. Carrying the mint instead and discarding the
//     Manager's offer drops them, and the node refuses the transaction — which is exactly what
//     happened the first time a second mint landed on a non-empty pool.
//
// The Manager's transaction is a superset in both families (the unshielded side needs no zswap
// parts at all), so it is always the carrier.
//
// ---------------------------------------------------------------------------------------------
// 00004: THE SAME-CONTRACT CASE (decision D-102, FR-107)
// ---------------------------------------------------------------------------------------------
//
// R8 derived the carrier rule for TWO DIFFERENT contracts. 00004's probe M1 needs TWO CALLS ON THE
// SAME CONTRACT in one intent — `Manager.depositShielded(S2 coin)` plus
// `Manager.depositUnshielded(U2)` — which is why decision D-102 exists. Nothing in the assembly
// below is contract-specific: `addCall` takes a prototype, and the prototype carries its own
// contract address, so two prototypes for one address are assembled exactly like two for two.
//
// What DOES need re-deriving is the carrier rule and the replay assumption:
//
//   * carrier — still the SHIELDED leg. When that colour's pool is already populated (it is, at
//     step 13: poolS2 = 6 from step 7), `depositShielded` merges, and `mergeCoinImmediate` puts a
//     zswap input (the held pool coin) and a zswap output (the merged coin) into THAT call's own
//     transaction. Those parts exist nowhere else. The unshielded leg needs no zswap parts at all,
//     so it is always the graft. Same rule, same reason, one contract instead of two.
//
//   * replay — the two calls are built INDEPENDENTLY against the same pre-state, and the ledger
//     replays their transcripts in intent order. That is safe here only because the legs are
//     DISJOINT in state: the shielded leg touches `pools[S2]` and `balances[key(AA_B, S2)]`, the
//     unshielded leg touches the kernel's U2 balance and `balances[key(AA_B, U2)]` — different keys
//     of the same map — and neither writes anything the other reads (`configured`, the four colour
//     cells and `accounts` are read-only in both). Two calls that read-then-wrote the SAME cell
//     would need the state threaded between them, which is what midnight-js's own
//     `withContractScopedTransaction` does and this ledger-level assembly does not.
//
// If the ledger refuses the shape outright, `actions.ts` records the verbatim error and falls back
// to `withContractScopedTransaction` (one transaction, one segment per call), so D-102 is resolved
// from evidence either way.
import * as ledger from '@midnightntwrk/ledger-v9';
import { encodeContractKeyLocation, hashVerifierKey } from '@midnight-ntwrk/midnight-js-types';
import { buildCall, type CallSpec } from './compose.js';

/**
 * The public data provider hands back a `compact-runtime` contract state; `ContractCallPrototype`
 * needs the ledger's own `ContractState`, whose `operation()` carries the DEPLOYED verifier key.
 * Round-tripping through the serialized form is exactly what midnight-js does internally.
 */
const toLedgerContractState = (state: any): any =>
  (ledger as any).ContractState.deserialize(state.serialize());

export type ComposedTx = {
  /** The unproven transaction: one intent, every call, the carrier's zswap offers. */
  tx: any;
  /** Segment the shared intent occupies (informational; recorded in evidence). */
  segment: number;
  /** Circuit ids in the shared intent, in the order they were added. */
  circuits: string[];
  /** The carrier call's execution result (its `private.result` is the minted coin, etc.). */
  carrierResult: any;
};

/**
 * Execute `carrier` and every `graft`, then assemble ONE intent containing all of their calls.
 *
 * @param carrier the call whose transaction — and therefore whose zswap offer — is kept whole.
 *                For a mint into the Manager this is the MANAGER's receive/credit call; see the
 *                note above for why it cannot be the mint.
 * @param grafts  calls whose prototypes join the carrier's intent (the Minter's mint).
 */
export const composeOneIntent = async (carrier: CallSpec, grafts: CallSpec[]): Promise<ComposedTx> => {
  const carrierBuilt = await buildCall(carrier);
  const tx = carrierBuilt.private.unprovenTx;

  const intents: Map<number, any> | undefined = tx.intents;
  if (!intents || intents.size !== 1) {
    throw new Error(
      `expected the carrier transaction to hold exactly one intent, saw ${intents ? intents.size : 'none'}`,
    );
  }
  const [segment, carrierIntent] = [...intents.entries()][0]!;

  let intent = carrierIntent;
  const circuits = [carrier.circuitId];

  for (const spec of grafts) {
    const built = await buildCall(spec);
    // `calls` is the execution trace: cross-contract callees first, the root call last. Neither of
    // this project's circuits makes a cross-contract call, so each graft contributes exactly one
    // entry — but iterating the trace keeps the assembly correct if that ever changes.
    for (const call of built.calls) {
      const contractState = await spec.providers.publicDataProvider.queryContractState(call.contractAddress);
      if (!contractState) throw new Error(`no on-chain state for contract ${call.contractAddress}`);
      const op = toLedgerContractState(contractState).operation(call.circuitId);
      if (!op) throw new Error(`operation '${call.circuitId}' is undefined for ${call.contractAddress}`);
      if (!op.verifierKey) {
        throw new Error(`operation '${call.circuitId}' on ${call.contractAddress} carries no deployed verifier key`);
      }

      intent = intent.addCall(
        new (ledger as any).ContractCallPrototype(
          call.contractAddress,
          call.circuitId,
          op,
          call.public.partitionedTranscript[0],
          call.public.partitionedTranscript[1],
          call.private.privateTranscriptOutputs,
          call.private.input,
          call.private.output,
          // Neither call is the other's callee, so there is no communication commitment to reuse:
          // each is a root and samples its own randomness, exactly as midnight-js does.
          (ledger as any).communicationCommitmentRandomness(),
          // The canonical location embeds the hash of the DEPLOYED verifier key, which is how the
          // prover picks the right artifact bundle when one transaction spans two contracts.
          encodeContractKeyLocation({
            contractAddress: String(call.contractAddress),
            circuitId: String(call.circuitId),
            verifierKeyHash: hashVerifierKey(op.verifierKey),
          } as any),
        ),
      );
      circuits.push(String(call.circuitId));
    }
  }

  // Writing `intents` on an unbound, unproven transaction re-computes binding information, which
  // is why this must happen before proving.
  tx.intents = new Map([[segment, intent]]);

  return { tx, segment, circuits, carrierResult: carrierBuilt };
};

/**
 * Prove a composed transaction (needs artifacts for EVERY contract in the intent), balance it with
 * the fee payer's wallet, and submit. Returns the submitted transaction id.
 */
export const proveBalanceSubmit = async (
  tx: any,
  /** Proof provider backed by a `ZKConfigRegistry` over every contract's artifacts. */
  composedProofProvider: any,
  /** Providers whose wallet pays the fees. */
  feeProviders: any,
): Promise<string> => {
  const proven = await composedProofProvider.proveTx(tx);
  const toSubmit = await feeProviders.walletProvider.balanceTx(proven);
  return String(await feeProviders.midnightProvider.submitTx(toSubmit));
};
