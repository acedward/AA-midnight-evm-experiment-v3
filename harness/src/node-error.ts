// Getting the NODE's verbatim refusal out of a wallet-facade error. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// WHY THIS EXISTS, and why it is not a nicety.
//
// Every refusal this project records is supposed to carry the node's own verdict — `1010: Invalid
// Transaction: Custom error: NNN` — because NNN is the only part that says WHY. Plan 01 decoded two of
// them from the pinned node source (104 = `InvalidError::Transcript`, 235 =
// `MalformedZswapErrorCode::InvalidProof`) and the whole FR-307/FR-311/NC-30x programme is written in
// terms of them.
//
// Plan 01's spikes got those strings for free because they submitted through midnight-js
// (`submitCallTx`), which propagates the node's error text. 00006's TAKER submits through the WALLET
// FACADE, per FR-303 — and the facade does this
// (`wallet-sdk-capabilities/dist/submission/submissionService.js:31`):
//
//     Effect.mapError((err) => new SubmissionError({ message: 'Transaction submission error', cause: err }))
//
// `SubmissionError` is an Effect `Data.TaggedError`, so the node's error is present but buried as a
// FIELD on a tagged object rather than on the `Error.cause` prototype chain. Walking `.cause` the
// ordinary way — which is what `errorChain` does — yields exactly the string `Transaction submission
// error` and nothing else. The first live refusal in this project came back as
// `REFUSED at settlement, code none`, which is indistinguishable from "the node gave no reason" and
// would have made every negative control in Plan 03 unreadable.
//
// So the extraction is deliberately brute-force rather than clever: render the whole object graph and
// search it. A cleverer walk would have to know Effect's internal shapes, which are not part of any
// contract this project can rely on, and would break silently the next time they change — silently
// being the problem.
import { inspect } from 'node:util';

/** Strip stack frames from a recorded error, per finding F-202. */
export const stripFrames = (raw: string): string =>
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^at\s/.test(l))
    .join(' ')
    .replace(/\s+at\s+\S+(?:\s+\([^)]*\))?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The full object graph of an error, as text. Not for display — for SEARCHING.
 *
 * `depth: 12` because the facade wraps the node error at least three levels deep and Effect adds more;
 * `maxStringLength` is generous because the node's message is what we came for.
 */
export const deepErrorText = (e: unknown): string => {
  try {
    return inspect(e, { depth: 12, breakLength: Infinity, maxStringLength: 4000, getters: false });
  } catch {
    return String(e);
  }
};

/** Known node refusal codes, decoded from the PINNED node source. Absence is reported, never guessed. */
const NODE_ERRORS: Record<number, string> = {
  // Decoded by 00006 Plan 01 spike S2 from midnight-node/ledger/src/versions/common/types.rs.
  104: 'InvalidError::Transcript (types.rs:406)',
  235: 'MalformedZswapErrorCode::InvalidProof (types.rs:446)',
};

export type NodeRefusal = {
  /** The `Custom error: NNN` code, or null when the node gave none (or never answered). */
  code: number | null;
  /** What that code means, from the pinned source — or an explicit "not decoded". */
  decoded: string;
  /** The node's own line, verbatim and F-202-clean, when one could be found. */
  verbatim: string | null;
  /** True when the failure happened before the node ever saw the transaction. */
  beforeSubmission: boolean;
};

/**
 * Pull the node's verdict out of whatever the facade threw.
 *
 * Returns `code: null` honestly when there is no numeric code to find — a missing code is itself
 * information (the transaction may never have reached the node) and inventing one would be worse than
 * reporting none.
 */
export const nodeRefusalOf = (e: unknown): NodeRefusal => {
  const deep = deepErrorText(e);
  const codeMatch = /Custom error:\s*(\d+)/.exec(deep);
  const code = codeMatch ? Number(codeMatch[1]) : null;
  // The node's line looks like `1010: Invalid Transaction: Custom error: 104`. Capture it whole.
  const lineMatch = /(\d{3,4}:\s*[^'"\n\\]*?Custom error:\s*\d+)/.exec(deep) ?? /(1010:[^'"\n\\]*)/.exec(deep);
  return {
    code,
    decoded: code === null ? '(no numeric code found)' : (NODE_ERRORS[code] ?? `${code} — NOT DECODED at these pins`),
    verbatim: lineMatch ? stripFrames(lineMatch[1]!) : null,
    // The facade's submission wrapper is the marker that the node WAS reached.
    beforeSubmission: !/SubmissionError|Transaction submission error/.test(deep),
  };
};

/** True when a failure is about this shared HOST rather than about the ledger (VOID, never a refusal). */
export const isInfrastructureFailure = (text: string): boolean =>
  /AbortError|ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|EAI_AGAIN|Timeout has occurred|ETIMEDOUT|\b50[234]\b/.test(
    text,
  );
