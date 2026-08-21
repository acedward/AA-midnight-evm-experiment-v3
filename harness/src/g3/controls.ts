// G3 — the five negative controls of spec "Negative controls and probes". EXPERIMENTAL_LANE /
// LANE-DEV-1.
//
// They run in the SAME process as the step ledger, against the state the ledger finishes in, because
// the specification states three of them in terms of that state:
//
//   NC-2  "OwnerB attempts withdraw S3 1 — no (AA_B,S3) cell exists; poolS3=4, all AA_A's"
//   NC-3  U3 is dormant: minted by no one, deposited by no one
//   NC-5  AA_A holds no S2 while demonstrably holding S1, S3, S4 and U1
//
// Every control must prove FOUR things, and 00005 adds the fourth:
//   1. the operation is rejected;
//   2. the rejection is the CONTRACT'S OWN assert — a rejection for an unrelated reason (a malformed
//      argument, a funding hiccup) recorded as "the guard did its job" would be worthless;
//   3. FUNDS UNCHANGED — the full table, every pool (value AND nonce), every unshielded ledger
//      balance, the raw maps and both users' coins/UTXOs are BYTE-IDENTICAL across the attempt,
//      re-read after a settle delay so "unchanged" is an observation and not a race;
//   4. **NO STATE CREATED** — all three custody map SIZES are identical across the attempt, and the
//      specific cell the control is about is proven ABSENT afterwards. 00004 could not state this:
//      its cells were all seeded at registration, so "no new cell" was vacuous. In v3 a refusal that
//      lazily created an empty cell would be caught here even though the cell would read zero.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, SEEDS } from '../lane.js';
import type { Rig } from './setup.js';
import {
  accountWithdrawShielded,
  accountWithdrawUnshielded,
  transferInternalShielded,
  userDepositShielded,
} from './actions.js';
import { observe, snapshot, snapshotObject, type Observation, type Sizes } from './table.js';
import { shieldedKeyOf, unshieldedKeyOf } from '../manager-view.js';
import { unshieldedSeedOf } from '../wallet.js';

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
  /** The verbatim rejection (first line, cause chain included). */
  reason: string;
  expectedMessage: string;
  messageMatched: boolean;
  fundsUnchanged: boolean;
  mapSizesUnchanged: boolean;
  mapSizesBefore: Sizes;
  mapSizesAfter: Sizes;
  /** The control-specific NO-STATE-CREATED proofs, e.g. "the (AA_B,S3) cell is still absent". */
  noStateCreated: Record<string, string>;
  /** Transactions this control had to submit to build its fixture (none of them, as it happens). */
  setupTxs: string[];
  /** The fixture figures the control depends on, read from chain rather than assumed. */
  fixture: Record<string, string>;
  status: 'GREEN' | 'RED';
};

export const runControls = async (rig: Rig, afterWalk: Observation): Promise<ControlResult[]> => {
  const { ctx, deps, raw, registry } = rig;
  const results: ControlResult[] = [];
  const beforeAll = snapshotObject(afterWalk);

  const colour = (name: string) => registry.get(name);

  /** Is a given (account, colour) cell PRESENT in the raw ledger map? */
  const cellPresent = (o: Observation, account: 'AA_A' | 'AA_B', name: string): boolean => {
    const c = colour(name);
    const key = c.family === 'shielded' ? shieldedKeyOf(raw[account], c.raw) : unshieldedKeyOf(raw[account], c.raw);
    const map = c.family === 'shielded' ? o.manager.shieldedBalances : o.manager.unshieldedBalances;
    return map[key] !== undefined;
  };

  /** Is a colour present ANYWHERE — pools, either cell map, or the ledger kernel's balance map? */
  const anywhere = (o: Observation, name: string): string[] => {
    const c = colour(name);
    const found: string[] = [];
    if (o.manager.pools[c.hex.toLowerCase()]) found.push('pools');
    if (o.manager.kernelUnshielded[c.hex.toLowerCase()] !== undefined) found.push('kernelUnshielded');
    for (const account of ['AA_A', 'AA_B'] as const) {
      if (o.manager.shieldedBalances[shieldedKeyOf(raw[account], c.raw)] !== undefined) {
        found.push(`shieldedBalances[${account}]`);
      }
      if (o.manager.unshieldedBalances[unshieldedKeyOf(raw[account], c.raw)] !== undefined) {
        found.push(`unshieldedBalances[${account}]`);
      }
    }
    return found;
  };

  /**
   * Run `attempt`, require it to throw with the contract's own message, require the whole
   * observation to be byte-identical before and after, and run the control's own
   * no-state-created checks.
   */
  const expectRejection = async (
    spec: {
      id: string;
      label: string;
      expectation: string;
      rejectedAt: string;
      expectedMessage: RegExp;
      fixture: (o: Observation) => Record<string, string>;
      noStateCreated?: (before: Observation, after: Observation) => Record<string, string>;
      setupTxs?: string[];
    },
    attempt: () => Promise<unknown>,
  ): Promise<void> => {
    const before = await observe(deps);
    const beforeSnap = snapshot(before);
    const fixture = spec.fixture(before);
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
    const sizesSame = JSON.stringify(before.sizes) === JSON.stringify(after.sizes);
    const first = reason.split('\n')[0]!.slice(0, 400);
    const matched = rejected && spec.expectedMessage.test(reason);

    const proofs = spec.noStateCreated ? spec.noStateCreated(before, after) : {};
    const proofsOk = Object.values(proofs).every((v) => !v.startsWith('FAIL'));
    const ok = rejected && matched && unchanged && sizesSame && proofsOk;

    results.push({
      id: spec.id,
      label: spec.label,
      expectation: spec.expectation,
      rejectedAt: spec.rejectedAt,
      reason: first,
      expectedMessage: String(spec.expectedMessage),
      messageMatched: matched,
      fundsUnchanged: unchanged,
      mapSizesUnchanged: sizesSame,
      mapSizesBefore: before.sizes,
      mapSizesAfter: after.sizes,
      noStateCreated: proofs,
      setupTxs: spec.setupTxs ?? [],
      fixture,
      status: ok ? 'GREEN' : 'RED',
    });
    console.log(`  ${ok ? 'GREEN' : 'RED  '} ${spec.id} — ${first.slice(0, 200)}`);
    console.log(`        map sizes ${JSON.stringify(before.sizes)} -> ${JSON.stringify(after.sizes)}`);
    for (const [k, v] of Object.entries(proofs)) console.log(`        ${k}: ${v}`);
    if (!unchanged) {
      console.log(`    BEFORE ${beforeSnap}`);
      console.log(`    AFTER  ${snapshot(after)}`);
    }
  };

  console.log('\n## NEGATIVE CONTROLS — against the post-step-17 state (the spec\'s final table)');

  // --- NC-1: unregistered witness -----------------------------------------------------------------
  await expectRejection(
    {
      id: 'NC-1',
      label: "Unregistered witness: OwnerN's witness opens no Manager account",
      expectation:
        'refused at the WITNESS CHOKE POINT, before any per-account, pool or ledger guard is reached',
      rejectedAt: 'circuit execution (no transaction built)',
      expectedMessage: /matches no registered account/,
      fixture: (o) => ({
        poolS1: String(o.custody.S1),
        'AA_A.S1': String(o.table.AA_A.S1),
        'AA_B.S1': String(o.table.AA_B.S1),
        note: "OwnerN is a pure user: its secret opens no account, though S1 is amply pooled",
      }),
      noStateCreated: (_b, a) => ({
        'no cell was created for the unregistered witness': `accounts still ${a.manager.accounts.length}, map sizes ${JSON.stringify(a.sizes)}`,
      }),
    },
    () => accountWithdrawShielded(ctx, unshieldedSeedOf(SEEDS.ownerN), colour('S1').raw, 1n, rig.observers.OwnerM, rig.fee),
  );

  // --- NC-2: missing-cell spend --------------------------------------------------------------------
  // AA_B has NO (AA_B, S3) cell at all, while poolS3 = 4 and every unit of it belongs to AA_A. The
  // pool being rich enough is irrelevant: the per-(account, colour) guard reads the ABSENT cell as 0
  // and refuses BEFORE the pool guard — without creating the cell on the way.
  await expectRejection(
    {
      id: 'NC-2',
      label: 'Missing-cell spend: OwnerB withdraws S3, which AA_B has never held, from a pool that covers it',
      expectation:
        'refused by the PER-(account, colour) GUARD reading an ABSENT cell as 0, before the pool guard; ' +
        'and NO (AA_B, S3) cell is created by the attempt',
      rejectedAt: 'circuit execution (no transaction built)',
      expectedMessage: /account colour balance too low/,
      fixture: (o) => ({
        'AA_B.S3': String(o.table.AA_B.S3),
        'AA_A.S3': String(o.table.AA_A.S3),
        poolS3: String(o.custody.S3),
        '(AA_B,S3) cell exists before': String(cellPresent(o, 'AA_B', 'S3')),
      }),
      noStateCreated: (b, a) => ({
        '(AA_B,S3) cell absent before': cellPresent(b, 'AA_B', 'S3') ? 'FAIL — it already existed' : 'yes',
        '(AA_B,S3) cell absent after': cellPresent(a, 'AA_B', 'S3') ? 'FAIL — the refusal CREATED it' : 'yes',
      }),
    },
    () => accountWithdrawShielded(ctx, raw.secretB, colour('S3').raw, 1n, rig.observers.OwnerM, rig.fee),
  );

  // --- NC-3: dormant colour ------------------------------------------------------------------------
  // U3 was minted by no one and deposited by no one. After the refusal it must still be absent from
  // EVERY map — failed operations create no state (FR-202, FR-206).
  await expectRejection(
    {
      id: 'NC-3',
      label: 'Dormant colour: OwnerA withdraws U3, a colour no one ever minted or deposited',
      expectation:
        'refused; and U3 remains absent from EVERY map afterwards — a failed operation creates no state',
      rejectedAt: 'circuit execution (no transaction built)',
      expectedMessage: /account colour balance too low/,
      fixture: (o) => ({
        U3: colour('U3').hex,
        'U3 issuer': colour('U3').issuer,
        'AA_A.U3': String(o.table.AA_A.U3),
        'AA_A.U1 (what AA_A does hold)': String(o.table.AA_A.U1),
        'U3 present anywhere before': anywhere(o, 'U3').join(',') || 'nowhere',
      }),
      noStateCreated: (b, a) => ({
        'U3 absent from every map before': anywhere(b, 'U3').length ? `FAIL — found in ${anywhere(b, 'U3')}` : 'yes',
        'U3 absent from every map after': anywhere(a, 'U3').length ? `FAIL — found in ${anywhere(a, 'U3')}` : 'yes',
      }),
    },
    () => accountWithdrawUnshielded(ctx, raw.secretA, colour('U3').raw, 1n, rig.addresses.OwnerM, rig.fee),
  );

  // --- NC-4: unregistered credit --------------------------------------------------------------------
  // Credit is OPEN — to REGISTERED accounts. Naming a commitment that opens no account is refused,
  // and the refusal creates neither a pool for the colour nor a cell for the bogus account.
  await (async () => {
    const bogus = new Uint8Array(32).fill(0x77);
    const s = await rig.openSpender('OwnerN', 'nc4');
    try {
      await expectRejection(
        {
          id: 'NC-4',
          label: 'Unregistered credit: a deposit naming an account commitment that was never registered',
          expectation:
            'refused with "credit account is not registered"; credit is open to REGISTERED accounts only, ' +
            'and the refusal creates no pool and no cell',
          rejectedAt: 'circuit execution (no transaction built)',
          expectedMessage: /credit account is not registered/,
          fixture: (o) => ({
            'bogus account commitment': Buffer.from(bogus).toString('hex'),
            'registered accounts': o.manager.accounts.join(','),
            'OwnerN.S1 (real funds offered)': String(o.table.OwnerN.S1),
          }),
          noStateCreated: (b, a) => ({
            'account set unchanged':
              JSON.stringify(b.manager.accounts) === JSON.stringify(a.manager.accounts) ? 'yes' : 'FAIL',
            'no cell for the bogus account, no pool for the colour':
              a.sizes.shieldedCells === b.sizes.shieldedCells && a.sizes.pools === b.sizes.pools
                ? `yes (${JSON.stringify(a.sizes)})`
                : 'FAIL — a custody map grew',
          }),
        },
        () => userDepositShielded(ctx, s.party, s.managerProviders, colour('S1').raw, 1n, bogus),
      );
    } finally {
      await s.close();
    }
  })();

  // --- NC-5: internal transfer of an unheld colour ----------------------------------------------------
  // AA_A is demonstrably rich — S1, S3, S4 and U1 — and holds no S2 at all. The per-(account, colour)
  // guard refuses BEFORE the destination cell is created, so the credit side creates nothing either.
  await expectRejection(
    {
      id: 'NC-5',
      label: 'Internal transfer of an unheld colour: AA_A moves S2 it does not hold, while rich in others',
      expectation:
        'refused by the per-(account, colour) guard; an internal transfer performs no token operation, so ' +
        'nothing else could have absorbed it, and the DESTINATION cell is not created',
      rejectedAt: 'circuit execution (no transaction built)',
      expectedMessage: /account colour balance too low/,
      fixture: (o) => ({
        'AA_A.S2': String(o.table.AA_A.S2),
        'AA_A.S1': String(o.table.AA_A.S1),
        'AA_A.S3': String(o.table.AA_A.S3),
        'AA_A.S4': String(o.table.AA_A.S4),
        'AA_A.U1': String(o.table.AA_A.U1),
        poolS2: String(o.custody.S2),
        'AA_B.S2 (the destination already holds S2)': String(o.table.AA_B.S2),
      }),
      noStateCreated: (b, a) => ({
        '(AA_A,S2) cell absent before': cellPresent(b, 'AA_A', 'S2') ? 'FAIL — it already existed' : 'yes',
        '(AA_A,S2) cell absent after': cellPresent(a, 'AA_A', 'S2') ? 'FAIL — the refusal CREATED it' : 'yes',
        'poolS2 unchanged': b.custody.S2 === a.custody.S2 ? `yes (${a.custody.S2})` : 'FAIL',
      }),
    },
    () => transferInternalShielded(ctx, raw.secretA, raw.AA_B, colour('S2').raw, 1n, rig.fee),
  );

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
        colours: Object.fromEntries(registry.list().map((c) => [c.name, { hex: c.hex, family: c.family, issuer: c.issuer }])),
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
  log(`  ${results.length - red.length}/${results.length} negative controls GREEN`);
  return results;
};
