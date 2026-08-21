// NC-301 / spec row 4 — SUBMIT THE OFFER ALONE, as a third party holding nothing but the file.
// 00006 Plan 03. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// FR-301 requires that the maker artifact be refused if it is submitted without being balanced, and
// the spec asks for the verbatim node/ledger error with a no-state-created proof. This process is the
// "anyone" in "if anyone submits it alone": a separate OS process, started with an envelope path and
// a seed of its own, which never balances and never merges.
//
// THREE READINGS, weakest first, because they answer different questions:
//
//   1. THE LEDGER, OFFLINE. `wellFormed` with `enforceBalancing: true` against a blank reference
//      state — the ledger's own verdict on the artifact, with no node involved. This is the reading
//      that says WHY: `invalid balance -N for token ... in segment 0`.
//   2. THE NODE, on the artifact AS PUBLISHED (unbound / pre-binding, decision D-306). This is the
//      literal form of the spec's row 4: the bytes a holder actually has, handed to the chain.
//   3. THE NODE, on the BOUND form. Recorded because a refusal of an unbound transaction could be
//      dismissed as "the facade would not even send it", and the bound form removes that reading:
//      binding is what a submitter would do next, and the node still refuses.
//
// A refusal is the EXPECTED result, so this process exits 0 after writing its report. A SUCCESSFUL
// submission would be catastrophic — an unbalanced contract call committing — and the stage asserts
// against it; this process merely records what happened, in the same shape either way.
//
// Usage: tsx src/swap/direct-submit-process.ts <opts.json>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import * as ledger from '@midnightntwrk/ledger-v9';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { LANE_STAMP, SEEDS, type PartyName } from '../lane.js';
import { closeParty, openParty } from '../wallet.js';
import { log, syncedState } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { deepErrorText, nodeRefusalOf } from '../node-error.js';
import { readEnvelope } from '../offer/envelope.js';
import { deserializeOfferBytes, readAllImbalances, nonDustDeficits } from '../offer/take.js';

export type DirectSubmitOpts = {
  label: string;
  envelope: string;
  /** Whose facade posts the transaction. Never an observation point for anything. */
  submitterSeedName: PartyName;
  out: string;
};

const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

/** The ledger's own offline verdict on the artifact, at pre-submit strictness. */
const offlineWellFormed = (tx: any): { refused: boolean; verbatim?: string } => {
  try {
    const st = (ledger as any).LedgerState.blank('undeployed');
    st.parameters = (ledger as any).LedgerParameters.initialParameters();
    const strictness = new (ledger as any).WellFormedStrictness();
    strictness.enforceBalancing = true;
    strictness.verifySignatures = true;
    strictness.enforceLimits = false;
    tx.wellFormed(st, strictness, new Date());
    return { refused: false };
  } catch (e) {
    return { refused: true, verbatim: errorChain(e) };
  }
};

const main = async () => {
  const optsFile = process.argv[2];
  if (!optsFile) throw new Error('usage: direct-submit-process.ts <opts.json>');
  const opts = JSON.parse(readFileSync(optsFile, 'utf-8')) as DirectSubmitOpts;

  const attempts: Array<Record<string, unknown>> = [];
  const report: Record<string, unknown> = {
    kind: 'direct-submit',
    label: opts.label,
    lane: LANE_STAMP,
    utc: new Date().toISOString(),
    process: { pid: process.pid, ppid: process.ppid },
    opts,
    attempts,
  };
  const writeReport = () => {
    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, `${JSON.stringify(report, bigints, 2)}\n`);
  };

  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  let party: Awaited<ReturnType<typeof openParty>> | undefined;
  try {
    const { terms, bytes, payload } = readEnvelope(opts.envelope);
    report.advisoryTerms = terms;
    report.payloadIdentity = payload;

    const deserialize = () => deserializeOfferBytes(bytes);
    const initial = deserialize();
    const tx = initial.tx;
    report.serializedForm = initial.form;
    const imbalances = readAllImbalances(tx, `offer ${payload.contentAddress.slice(0, 16)}…`);
    report.imbalances = imbalances;
    report.deficits = nonDustDeficits(imbalances);
    report.offlineWellFormed = offlineWellFormed(tx);

    party = await openParty(`DirectSubmitter-${opts.label}`, SEEDS[opts.submitterSeedName]);
    await syncedState(party);
    const facade: any = party.wallet;

    // Each attempt gets a FRESHLY deserialized transaction: `bind()` is a lifecycle transition and a
    // rejected submission must never be blamed on an object the previous attempt had already moved.
    for (const form of ['as-published (unbound, D-306)', 'bound'] as const) {
      const fresh = deserialize().tx;
      const candidate = form === 'bound' ? fresh.bind() : fresh;
      const attempt: Record<string, unknown> = { form, submitted: false };
      try {
        const txId = String(await facade.submitTransaction(candidate));
        attempt.submitted = true;
        attempt.txId = txId;
        log(`direct-submit[${opts.label}]: ${form} was ACCEPTED (${txId}) — this must not happen`);
      } catch (e) {
        attempt.error = errorChain(e);
        attempt.nodeRefusal = nodeRefusalOf(e);
        attempt.errorDump = deepErrorText(e).slice(0, 4000);
        const code = (attempt.nodeRefusal as any)?.code;
        // The layer is NAMED only when something in the error actually identifies it. The facade
        // replaces a node refusal with the bare string `Transaction submission error`, so "no code"
        // does NOT mean "the facade refused it locally" — it means the cause was not recoverable, and
        // saying anything more definite would be inventing a measurement.
        attempt.layer =
          code != null
            ? `node (submitted and refused, Custom error: ${code})`
            : /invalid balance|wellformed|malformed/i.test(String(attempt.error))
              ? 'ledger wellFormed (offline, inside the facade)'
              : 'unclassified — the facade replaced the cause with its own wrapper; see errorDump';
        log(`direct-submit[${opts.label}]: ${form} REFUSED — layer ${String(attempt.layer)}`);
      }
      attempts.push(attempt);
    }

    report.ok = true; // a report was produced; the VERDICT is the stage's to draw
    writeReport();
  } catch (e) {
    report.ok = false;
    report.harnessFailure = errorChain(e);
    writeReport();
    log(`direct-submit[${opts.label}]: HARNESS FAILURE — ${String(report.harnessFailure)}`);
  } finally {
    if (party) await closeParty(party);
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`direct-submit-process FAILED before it could report: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
