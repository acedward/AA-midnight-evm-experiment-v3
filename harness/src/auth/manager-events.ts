// Manager v5 (k=19) — Tier-3 transcript-authority reader.
//
// ================================================================================================
// WHAT THIS MODULE USED TO BE, AND WHY IT NO LONGER IS
// ================================================================================================
//
// Until the k=19 Manager this file exported `extractManagerSemanticEvents`, which pulled the FR-031
// semantic commitment out of a `Misc` event and handed it back as a value to be trusted. The k=19
// Manager does not emit that event — it does not emit ANY event — because the 00010 spec amendment
// moved the commitment off-circuit and made the PROVED CALL TRANSCRIPT the authority.
//
// The security rule that replaces the old contract is:
//
//     NO CONSUMER MAY TRUST A SEMANTIC COMMITMENT IT DID NOT RECOMPUTE FROM THE PROVED TRANSCRIPT.
//
// This module is written so that rule cannot be violated through it, rather than merely documented:
// there is no function here that returns a commitment read from anywhere. The only way to obtain a
// commitment is `recomputeSemanticCommitment`, which computes it TWICE from transcript fields — once
// through the contract's exported PURE oracle `semanticCommitmentFor`, and once through the
// independent TypeScript recipe in `semantic.ts` — and refuses to return unless the two agree.
//
// `assertManagerEmitsNoEvents` is the other half: it is a positive check that the contract really
// emits nothing, so a future change that reintroduces an event surface is caught by a failing test
// instead of silently creating something for a reader to trust again.

import { ContractLog, type LogEvent } from "@midnight-ntwrk/midnight-js-contracts";

import { bytesToHex, equalBytes, hexToBytes, type Hex32 } from "./bytes.js";

/**
 * The `Misc` event name the k=20 Manager used for the semantic commitment. Retained ONLY as a
 * deny-list value: the k=19 Manager must never produce it. It is deliberately not exported as
 * something to filter FOR.
 */
const REMOVED_SEMANTIC_EVENT_NAME =
  "0x535c1031f585e2d7a795d0e332a97418cd8eddde40eefa214fb78a2e18812c1a" as Hex32;

/** Flatten the simulator's raw `Misc` cell representation, degraded or not. */
function flattenRawMisc(event: LogEvent): Uint8Array | undefined {
  const raw = event as LogEvent & {
    data?: { tag?: string; content?: { value?: readonly Uint8Array[] } };
  };
  const segments = raw.data?.tag === "cell" ? raw.data.content?.value : undefined;
  if (!segments) return undefined;
  const length = segments.reduce((total, segment) => total + segment.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const segment of segments) {
    output.set(segment, offset);
    offset += segment.length;
  }
  return output;
}

/**
 * Assert the Manager emitted NO events on this call — the k=19 invariant.
 *
 * Two separate checks, because they fail in different ways:
 *   1. the raw event list is empty (the contract has no `emit` site at all), and
 *   2. specifically, no event carries the removed semantic name — checked against both the decoded
 *      and the degraded raw-prefix representations, so a reintroduced event cannot hide behind the
 *      simulator's shortened `Misc` cell.
 */
export function assertManagerEmitsNoEvents(events: readonly LogEvent[]): void {
  const removed = hexToBytes(REMOVED_SEMANTIC_EVENT_NAME, 32);
  const decoded = ContractLog.decodeAll(events);
  for (let index = 0; index < decoded.length; index += 1) {
    const event = decoded[index]!;
    if (event.eventType !== "misc") continue;
    const name = event.degraded
      ? flattenRawMisc(events[index]!)?.slice(0, 32)
      : event.payload.name;
    if (name && equalBytes(name, removed)) {
      throw new Error(
        "Manager v5 emitted the REMOVED FR-031 semantic event. The commitment is defined " +
          "off-circuit (spec 00010, Tier-3); reintroducing it recreates the trusted-event failure " +
          "mode the amendment removed by construction.",
      );
    }
  }
  if (events.length !== 0) {
    throw new Error(
      `Manager v5 must emit no events; this call emitted ${events.length}. If an event surface is ` +
        "being added deliberately, the Tier-3 security rule must be re-argued first: no consumer " +
        "may trust a semantic commitment it did not recompute from the proved transcript.",
    );
  }
}

/** Every field the FR-031 commitment covers, as recovered from a proved `execute` transcript. */
export interface SemanticTranscript {
  /** Manager contract address, as the 32-byte alias the contract hashes. */
  readonly manager: Hex32;
  /** The deployment domain separator read from the Manager's ledger. */
  readonly deploymentDomain: Hex32;
  /** The `ExecutePayload` the proved call carried (all 16 fields are disclosed by `execute`). */
  readonly payload: unknown;
  /** The authenticated account id the call operated on. */
  readonly accountId: Hex32;
  /**
   * The caller's OWN recomputation of the auth result: the EIP-712 digest for `authMode == 1`
   * (`evmDigestFor`, exported and pure), or `nativeAuthResult(accountId)` for `authMode == 0`.
   * It is never read from the contract's output.
   */
  readonly authResult: Hex32;
}

/**
 * The ONLY supported way to obtain a Manager semantic commitment: recompute it from the proved
 * transcript, two independent ways, and require agreement.
 *
 * @param oracle the compiled Manager's `pureCircuits.semanticCommitmentFor`
 * @param independent the independent TypeScript recipe (`semanticCommitmentForExecute`)
 * @throws if the two recomputations disagree — which means the recipe drifted, and no value from
 *         either side should be trusted until that is explained.
 */
export function recomputeSemanticCommitment(
  transcript: SemanticTranscript,
  oracle: (
    manager: Uint8Array,
    domain: Uint8Array,
    payload: unknown,
    account: Uint8Array,
    authResult: Uint8Array,
  ) => Uint8Array,
  independent: (transcript: SemanticTranscript) => Hex32,
): Hex32 {
  const fromOracle = bytesToHex(
    oracle(
      hexToBytes(transcript.manager, 32),
      hexToBytes(transcript.deploymentDomain, 32),
      transcript.payload,
      hexToBytes(transcript.accountId, 32),
      hexToBytes(transcript.authResult, 32),
    ),
  ) as Hex32;
  const fromIndependent = independent(transcript);
  if (fromOracle !== fromIndependent) {
    throw new Error(
      `semantic commitment recomputation disagreed: pure oracle ${fromOracle} vs independent ` +
        `recipe ${fromIndependent}. Trust neither until this is explained.`,
    );
  }
  return fromOracle;
}
