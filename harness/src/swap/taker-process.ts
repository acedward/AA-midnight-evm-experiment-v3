// THE TAKER, as its own OS process, holding nothing but an envelope file and its own seed.
// 00006 Plan 03 Phase 1. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This is the other half of Plan 03's process boundary. It is started AFTER the maker process has
// exited, and everything it knows about the offer it read off disk. There is no transaction surgery
// here and none in `takeOffer` either: the pipeline is `Transaction.deserialize` →
// `validateTransaction` (recorded, never gating — F-303) → `balanceUnboundTransaction` →
// `signRecipe` → `finalizeRecipe` → `submitTransaction`, which is FR-303's "stock facade calls only"
// taken literally.
//
// F-107 is honoured before any spend: a brand-new facade is waited on until it can actually SEE the
// coins it is about to spend. Without that wait `balanceUnboundTransaction` cheerfully produces a
// transaction the node then refuses with a bare `Custom error: 223`, and that refusal would land in
// an evidence table looking exactly like a lane result.
//
// A REFUSAL IS A RESULT. Rows 4, 6, 9, 10, 11 and 12 all expect one, so this process writes its
// report and exits 0 whether the take settled or was refused, and the stage decides what that means.
// It exits nonzero only if it could not produce a report at all.
//
// Usage: tsx src/swap/taker-process.ts <opts.json>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { LANE_STAMP, SEEDS, type PartyName } from '../lane.js';
import { closeParty, openParty } from '../wallet.js';
import { log, syncedState, waitFor } from '../night.js';
import { errorChain } from '../g3/actions.js';
import { takeOffer, type TakeResult } from '../offer/take.js';
import type { TakerRoute } from '../g1/taker.js';

export type TakerOpts = {
  label: string;
  /** The envelope file. The ONLY thing this process learns about the offer. */
  envelope: string;
  takerSeedName: PartyName;
  /** F-107: colours this wallet must SEE before it is allowed to spend. */
  require?: Array<{ colour: string; amount: string }>;
  /** Skip the taker's own local expiry gate, to measure what the NODE does with an expired offer. */
  ignoreExpiry?: boolean;
  route?: TakerRoute;
  out: string;
};

const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const main = async () => {
  const optsFile = process.argv[2];
  if (!optsFile) throw new Error('usage: taker-process.ts <opts.json>');
  const opts = JSON.parse(readFileSync(optsFile, 'utf-8')) as TakerOpts;

  const report: Record<string, unknown> = {
    kind: 'taker',
    label: opts.label,
    lane: LANE_STAMP,
    utc: new Date().toISOString(),
    process: { pid: process.pid, ppid: process.ppid },
    opts,
  };
  const writeReport = () => {
    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, `${JSON.stringify(report, bigints, 2)}\n`);
  };

  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  let party: Awaited<ReturnType<typeof openParty>> | undefined;
  const started = Date.now();
  try {
    party = await openParty(`Taker-${opts.label}`, SEEDS[opts.takerSeedName]);
    await syncedState(party);
    for (const need of opts.require ?? []) {
      const held = (st: any): bigint => BigInt(st?.shielded?.balances?.[need.colour] ?? 0n);
      await waitFor(
        party,
        (st) => held(st) >= BigInt(need.amount),
        `${party.name} to see ${need.amount} of shielded ${need.colour.slice(0, 12)}… before spending it`,
        300_000,
      );
    }

    const take: TakeResult = await takeOffer(party, opts.envelope, {
      label: opts.label,
      ...(opts.ignoreExpiry ? { ignoreExpiry: true } : {}),
      ...(opts.route ? { route: opts.route } : {}),
    });
    report.ok = take.ok;
    report.take = take;
    report.tookMs = Date.now() - started;
    writeReport();
    log(
      `taker[${opts.label}]: ${take.ok ? `SETTLED ${take.settlement?.txId}` : `REFUSED at ${take.stage}` }` +
        `${take.nodeRefusal?.code != null ? ` (node code ${take.nodeRefusal.code})` : ''}`,
    );
  } catch (e) {
    // A THROW here is a harness failure, not a lane result: `takeOffer` returns refusals rather than
    // throwing them, so anything landing in this branch is the wallet, the facade or this process.
    report.ok = false;
    report.harnessFailure = errorChain(e);
    report.tookMs = Date.now() - started;
    writeReport();
    log(`taker[${opts.label}]: HARNESS FAILURE — ${String(report.harnessFailure)}`);
  } finally {
    if (party) await closeParty(party);
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`taker-process FAILED before it could report: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
