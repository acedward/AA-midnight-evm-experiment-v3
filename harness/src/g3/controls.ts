// G3 — the six negative controls and the mixed-colour atomicity negative (spec "Negative controls
// and probes", FR-104 / FR-106 / FR-107). EXPERIMENTAL_LANE / LANE-DEV-1.
//
// They run in the SAME process as the step ledger, against the state the ledger finished in, because
// the specification states three of them in terms of that state:
//
//   NC-2  "after step 11 (AA_B S1=0, poolS1=3, AA_A S1=3)"  — steps 12 and 13 touch no S1 cell, so
//         the post-step-13 state satisfies the stated fixture exactly, and the control records the
//         three figures it relies on rather than assuming them.
//   NC-3  AA_A holds U1=5 and S2=0 after step 13.
//   NC-5  AA_A holds 0 of S2 while demonstrably holding S1=3 and U1=5 after step 13.
//
// Every control must prove THREE things, not two:
//   1. the operation is rejected;
//   2. the rejection is the CONTRACT'S OWN assert — a rejection for an unrelated reason (a malformed
//      argument, a funding hiccup) recorded as "the guard did its job" would be worthless;
//   3. the full 16-cell table, both pools (value AND nonce), both unshielded contract-ledger
//      balances, the raw `balances` map and both users' coins/UTXOs are BYTE-IDENTICAL across the
//      attempt — re-read after a settle delay, so "unchanged" is an observation, not a race.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import type { Rig } from './setup.js';
import {
  accountWithdrawShielded,
  mintShieldedToUser,
  mixedColourDepositWrongColour,
  transferInternal,
  userDepositShielded,
  userDepositUnshielded,
} from './actions.js';
import { observe, snapshot, snapshotObject, type Observation } from './table.js';
import { unshieldedSeedOf } from '../wallet.js';
import { SEEDS } from '../lane.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

/** How long to let the chain apply anything that might (wrongly) have gone through. */
const SETTLE_MS = 12_000;

export type ControlResult = {
  id: string;
  label: string;
  expectation: string;
  /** Where the refusal happened — recorded rather than blurred. */
  rejectedAt: string;
  /** The verbatim first line of the rejection. */
  reason: string;
  expectedMessage: string;
  messageMatched: boolean;
  fundsUnchanged: boolean;
  /** Transactions this control had to submit to build its fixture (NC-4b mints a real coin). */
  setupTxs: string[];
  /** The fixture figures the control depends on, read from chain rather than assumed. */
  fixture?: Record<string, string>;
  status: 'GREEN' | 'RED';
};

export const runControls = async (
  rig: Rig,
  after13: Observation,
  tx: (id: string) => string,
): Promise<ControlResult[]> => {
  const { ctx, deps, raw, colours } = rig;
  const results: ControlResult[] = [];
  const beforeAll = snapshotObject(after13);

  /**
   * Run `attempt`, require it to throw with the contract's own message, and require the whole
   * observation to be byte-identical before and after.
   */
  const expectRejection = async (
    id: string,
    label: string,
    expectation: string,
    rejectedAt: string,
    expectedMessage: RegExp,
    attempt: () => Promise<unknown>,
    extra?: { setupTxs?: string[]; fixture?: Record<string, string> },
  ): Promise<void> => {
    const before = await observe(deps);
    const beforeSnap = snapshot(before);
    let reason = '';
    let rejected = false;
    try {
      const r: any = await attempt();
      reason = `NOT REJECTED — the operation was accepted (tx ${String(r?.public?.txId ?? r?.txId ?? r ?? '')})`;
    } catch (e) {
      rejected = true;
      const err = e as any;
      const cause = err?.cause ? ` | cause: ${String(err.cause?.message ?? err.cause)}` : '';
      reason = `${e instanceof Error ? e.message : String(e)}${cause}`;
    }

    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const after = await observe(deps);
    const unchanged = beforeSnap === snapshot(after);
    const first = reason.split('\n')[0]!.slice(0, 400);
    const matched = rejected && expectedMessage.test(reason);

    results.push({
      id,
      label,
      expectation,
      rejectedAt,
      reason: first,
      expectedMessage: String(expectedMessage),
      messageMatched: matched,
      fundsUnchanged: unchanged,
      setupTxs: extra?.setupTxs ?? [],
      fixture: extra?.fixture,
      status: rejected && matched && unchanged ? 'GREEN' : 'RED',
    });
    console.log(`  ${rejected && matched && unchanged ? 'GREEN' : 'RED  '} ${id} — ${first.slice(0, 200)}`);
    if (!unchanged) {
      console.log(`    BEFORE ${beforeSnap}`);
      console.log(`    AFTER  ${snapshot(after)}`);
    }
  };

  console.log('\n## NEGATIVE CONTROLS AND M2 — against the post-step-13 state');

  // --- NC-1: owner-only / unregistered ------------------------------------------------------------
  await expectRejection(
    'NC-1',
    "Owner-only / unregistered: OwnerN's witness opens no Manager account",
    'rejected at the authorization choke point, before any colour, balance or pool guard is reached',
    'circuit execution (no transaction built)',
    /matches no registered account/,
    () => accountWithdrawShielded(ctx, unshieldedSeedOf(SEEDS.ownerN), 'S1', 1n, rig.observers.OwnerM, rig.fee),
    { fixture: { poolS1: String(after13.custody.S1), 'AA_A.S1': String(after13.table.AA_A.S1) } },
  );

  // --- NC-2: owner-only / cross-account -----------------------------------------------------------
  // AA_B owns 0 of S1 while the pool holds 3 and AA_A owns all of it. The pool being rich enough is
  // irrelevant: the debited account is derived from the WITNESS, never from a parameter.
  await expectRejection(
    'NC-2',
    "Owner-only / cross-account: OwnerB's witness cannot reach AA_A's S1, though the pool covers it",
    'rejected by the PER-ACCOUNT guard, which sits BEFORE the pool guard (FR-104)',
    'circuit execution (no transaction built)',
    /account colour balance too low/,
    () => accountWithdrawShielded(ctx, raw.secretB, 'S1', 1n, rig.observers.OwnerM, rig.fee),
    {
      fixture: {
        'AA_B.S1': String(after13.table.AA_B.S1),
        poolS1: String(after13.custody.S1),
        'AA_A.S1': String(after13.table.AA_A.S1),
      },
    },
  );

  // --- NC-3: cross-colour / rich in X, broke in Y ---------------------------------------------------
  await expectRejection(
    'NC-3',
    'Cross-colour: AA_A is rich in U1 (and S1) but holds no S2 at all',
    'rejected — wealth in one colour is unspendable in another, however rich the S2 pool is',
    'circuit execution (no transaction built)',
    /account colour balance too low/,
    () => accountWithdrawShielded(ctx, raw.secretA, 'S2', 1n, rig.observers.OwnerM, rig.fee),
    {
      fixture: {
        'AA_A.U1': String(after13.table.AA_A.U1),
        'AA_A.S1': String(after13.table.AA_A.S1),
        'AA_A.S2': String(after13.table.AA_A.S2),
        poolS2: String(after13.custody.S2),
      },
    },
  );

  // --- NC-4a: wrong colour, NAMED (unshielded deposit of Minter3's U colour) -------------------------
  await (async () => {
    const s = await rig.openSpender('OwnerN', 'nc4a');
    try {
      await expectRejection(
        'NC-4a',
        "Wrong colour / named: an unshielded deposit naming Minter3's colour, which `configure` never admitted",
        '`configure` is the only gate that admits a colour; an unconfigured one is refused where it is named',
        'circuit execution (no transaction built)',
        /colour is not a configured unshielded colour/,
        () =>
          userDepositUnshielded(ctx, s.party, s.managerProviders, colours.control.rawUnshielded, 1n, raw.AA_A),
        { fixture: { 'Minter3.unshielded': colours.control.unshielded } },
      );
    } finally {
      await s.close();
    }
  })();

  // --- NC-4b: wrong colour, CARRIED (a REAL Minter3 shielded coin offered to depositShielded) --------
  // The control colour is minted for real first, so the coin OwnerM offers is a genuine on-chain
  // coin of an unconfigured colour rather than a fabricated argument.
  const controlMintTx = tx(await mintShieldedToUser(ctx, 'Minter3', 5n, rig.observers.OwnerM, rig.fee));
  log(`  NC-4b fixture: Minter3 minted 5 of its (never configured) shielded colour to OwnerM: tx ${controlMintTx}`);
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  await (async () => {
    const s = await rig.openSpender('OwnerM', 'nc4b');
    try {
      await expectRejection(
        'NC-4b',
        'Wrong colour / carried: a REAL shielded coin minted by Minter3 offered to `depositShielded`',
        'refused by the colour guard before the coin is ever received, so no pool is created for it',
        'circuit execution (no transaction built)',
        /colour is not a configured shielded colour/,
        () => userDepositShielded(ctx, s.party, s.managerProviders, colours.control.rawShielded, 2n, raw.AA_B),
        {
          setupTxs: [controlMintTx],
          fixture: { 'Minter3.shielded': colours.control.shielded, 'minted to OwnerM': '5' },
        },
      );
    } finally {
      await s.close();
    }
  })();

  // --- NC-5: internal transfer colour guard ----------------------------------------------------------
  await expectRejection(
    'NC-5',
    'Internal transfer colour guard: AA_A moves S2 it does not hold, while holding S1 and U1',
    'rejected by the per-(account, colour) guard; an internal transfer performs no token operation, so nothing else could have absorbed it',
    'circuit execution (no transaction built)',
    /account colour balance too low/,
    () => transferInternal(ctx, raw.secretA, raw.AA_B, 'S2', 1n, rig.fee),
    {
      fixture: {
        'AA_A.S2': String(after13.table.AA_A.S2),
        'AA_A.S1': String(after13.table.AA_A.S1),
        'AA_A.U1': String(after13.table.AA_A.U1),
      },
    },
  );

  // --- M2: the mixed-colour atomicity negative --------------------------------------------------------
  // The step-13 shape with the SECOND leg wrong-coloured. The VALID shielded leg is built first and
  // in full — the evidence records that it built — and the composition then fails on the second leg,
  // so the whole transaction is discarded and the valid leg never reaches the chain. Step 13 already
  // proved that exact valid leg commits when its partner is well-formed, so "no partial credit" is a
  // comparison against a demonstrated positive rather than an assumption.
  await (async () => {
    const s = await rig.openSpender('OwnerM', 'm2');
    let carrierBuilt = false;
    try {
      await expectRejection(
        'M2',
        'M2 — mixed-colour atomicity negative: the step-13-shaped transaction with the second leg wrong-coloured',
        'the WHOLE transaction fails; no partial credit for the valid leg; funds byte-identical',
        'circuit execution of the second leg (the composed transaction is discarded, never submitted)',
        /colour is not a configured unshielded colour/,
        async () => {
          const r = await mixedColourDepositWrongColour(ctx, s.managerProviders, {
            shieldedColour: 'S2',
            shieldedValue: 2n,
            unshieldedAmount: 2n,
            accountId: raw.AA_B,
            wrongUnshieldedColour: colours.control.rawUnshielded,
          });
          carrierBuilt = r.carrierBuilt;
          throw new Error(r.error);
        },
        {
          fixture: {
            'valid leg (depositShielded S2 2) built successfully before the failure': 'recorded below',
            'wrong colour used for the second leg': colours.control.unshielded,
          },
        },
      );
      const m2 = results[results.length - 1]!;
      m2.fixture = { ...(m2.fixture ?? {}), validLegBuilt: String(carrierBuilt) };
      if (!carrierBuilt) {
        m2.status = 'RED';
        m2.reason = `${m2.reason} [the valid leg did not build, so this control proves nothing]`;
      }
    } finally {
      await s.close();
    }
  })();

  // Leave a benign witness behind so nothing later inherits a control's owner secret.
  await ctx.actAs(ctx.managerFee, new Uint8Array(32));

  const afterAll = await observe(deps);
  mkdirSync(EVID, { recursive: true });
  writeFileSync(
    join(EVID, 'negative-controls.json'),
    `${JSON.stringify(
      {
        label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
        utc: stamp(),
        managerAddress: rig.managerAddress,
        colours: colours.hex,
        controlColours: { shielded: colours.control.shielded, unshielded: colours.control.unshielded },
        accounts: rig.ids,
        stateBeforeControls: beforeAll,
        stateAfterControls: snapshotObject(afterAll),
        controls: results,
      },
      (_k, v) => (typeof v === 'bigint' ? `${v}` : v),
      2,
    )}\n`,
  );

  const red = results.filter((r) => r.status !== 'GREEN');
  console.log(`\n  ${results.length - red.length}/${results.length} controls GREEN`);
  return results;
};
