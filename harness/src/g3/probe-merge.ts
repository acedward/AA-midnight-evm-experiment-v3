// G3 diagnostic probe, round 2 — is it the MERGE that breaks spec step 13? (decision D-102)
//
// EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Round 1 (`probe-mixed.ts`) demolished the hypothesis the gate failure suggested. Two calls to the
// SAME contract in ONE intent are fine — `depositUnshielded + depositUnshielded` and
// `depositShielded + depositUnshielded` were both ACCEPTED — so D-102's framing was never the real
// constraint. What round 1 could NOT explain is why the identical shielded+unshielded shape it
// accepted is the one the gate had refused.
//
// The one material difference is the POOL STATE, and it is forced by the specification:
//
//   round 1, `mixed-one-intent`   poolS2 was EMPTY  -> `depositShielded` takes the fresh-pool arm,
//                                                     `pools.insertCoin(colour, c, self)`
//   gate step 13                   poolS2 held 6     -> it takes the MERGE arm,
//                                                     `mergeCoinImmediate(pools.lookup(c), c)`,
//                                                     which SPENDS the held pool coin (a zswap
//                                                     input) and writes a merged coin (an output)
//
// The spec requires the merge: step 7 puts 6 into poolS2 and the scope note says step 13
// "additionally exercises the per-colour pool merge path for S2 (second deposit into an existing
// pool)". So if a merging `depositShielded` cannot share a transaction with a second call, step 13
// is not performable as written, and that is an owner decision rather than something to improvise
// around.
//
// The four cases below isolate exactly that, in order, against one stack:
//
//   1. establish  `depositShielded(S2,6)` ALONE, empty pool     -> expected ACCEPTED; leaves poolS2=6
//   2. merge-alone `depositShielded(S2,2)` ALONE, poolS2=6      -> is a MERGE fine on its own?
//   3. merge+unshielded, ONE INTENT                             -> THE EXACT GATE STEP-13 SHAPE
//   4. merge+unshielded, SDK scoped batch                       -> the same, other mechanism
//   5. fresh+unshielded on the OTHER colour pair (poolS1 empty) -> control: round 1's accepted shape
//
// Reading the result:
//   * 2 passes, 3 and 4 fail, 5 passes -> the blocker is a MERGING shielded deposit sharing a
//     transaction with another call. Step 13 is impossible as specced -> owner decision.
//   * 3 or 4 passes                    -> the gate failed for some other reason; re-examine it.
//   * 2 fails                          -> a merging deposit cannot be composed at all, which would
//     also contradict 00003's proven merge cell; treat as a lane regression.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, type Rig } from './setup.js';
import { errorChain, mintShieldedToUser, mintUnshieldedToUser } from './actions.js';
import { composeOneIntent, proveBalanceSubmit } from './ledger-compose.js';
import { buildCall, type CallSpec } from './compose.js';
import { withContractScopedTransaction, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { withDustRetry } from '../night.js';
import { readManager, snapshot } from '../manager-view.js';
import type { ColourName } from './observe.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const EVID = join(REPO_ROOT, 'evidence', 'g3-ledger');

type Attempt = {
  id: string;
  question: string;
  shape: string;
  poolBefore: string;
  ok: boolean;
  txId?: string;
  error?: string;
  structure?: unknown;
  managerStateMoved: boolean;
};

const attempts: Attempt[] = [];

const main = async () => {
  console.log(`# G3 PROBE round 2 — is it the MERGE? — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;

  try {
    rig = await bootstrap();
    const { ctx, colours, raw, managerAddress } = rig;

    const shieldedSpec = (providers: any, colour: ColourName, value: bigint): CallSpec => ({
      providers,
      compiledContract: ctx.compiledManager(),
      contractAddress: managerAddress,
      circuitId: 'depositShielded',
      args: [{ nonce: randomBytes(32), color: colours.raw[colour], value }, raw.AA_B],
      privateStateId: 'manager',
    });
    const unshieldedSpec = (providers: any, colour: ColourName, amount: bigint): CallSpec => ({
      providers,
      compiledContract: ctx.compiledManager(),
      contractAddress: managerAddress,
      circuitId: 'depositUnshielded',
      args: [colours.raw[colour], amount, raw.AA_B],
      privateStateId: 'manager',
    });

    const poolOf = async (colour: ColourName): Promise<string> => {
      const m = await readManager(ctx.managerFee, managerAddress);
      const p = m.pools[colours.hex[colour].toLowerCase()];
      return p ? `${colour}=${p.value}` : `${colour}=absent`;
    };

    const attempt = async (
      id: string,
      question: string,
      shape: string,
      poolColour: ColourName,
      run: () => Promise<{ txId: string; structure?: unknown }>,
    ): Promise<boolean> => {
      const poolBefore = await poolOf(poolColour);
      const before = snapshot(await readManager(ctx.managerFee, managerAddress));
      log(`--- ${id} (pool ${poolBefore}): ${shape}`);
      let ok = false;
      let txId: string | undefined;
      let error: string | undefined;
      let structure: unknown;
      try {
        const r = await run();
        txId = r.txId;
        structure = r.structure;
        ok = true;
        log(`    ACCEPTED — tx ${txId}`);
      } catch (e) {
        error = errorChain(e, 8);
        log(`    REFUSED — ${error}`);
      }
      await new Promise((r) => setTimeout(r, 15_000));
      const after = snapshot(await readManager(ctx.managerFee, managerAddress));
      attempts.push({ id, question, shape, poolBefore, ok, txId, error, structure, managerStateMoved: before !== after });
      log(`    pool after: ${await poolOf(poolColour)}`);
      return ok;
    };

    const single = async (spec: CallSpec, depositor: any): Promise<{ txId: string }> => {
      const txId = await withDustRetry(depositor.party, 'single', async () => {
        const built = await buildCall(spec);
        const proven = await spec.providers.proofProvider.proveTx(built.private.unprovenTx);
        const toSubmit = await spec.providers.walletProvider.balanceTx(proven);
        return String(await spec.providers.midnightProvider.submitTx(toSubmit));
      });
      return { txId };
    };
    const oneIntent = async (specs: CallSpec[], depositor: any): Promise<{ txId: string; structure: unknown }> => {
      const composed = await composeOneIntent(specs[0]!, specs.slice(1));
      log(`    assembled: ${JSON.stringify(composed.structure)}`);
      const txId = await withDustRetry(depositor.party, 'one-intent', () =>
        proveBalanceSubmit(composed.tx, ctx.composedProof, depositor.managerProviders),
      );
      return { txId, structure: composed.structure };
    };
    const scopedBatch = async (specs: CallSpec[], depositor: any): Promise<{ txId: string }> => {
      const finalized: any = await withDustRetry(depositor.party, 'scoped', () =>
        (withContractScopedTransaction as any)(
          depositor.managerProviders,
          async (txCtx: any) => {
            for (const spec of specs) {
              await (submitCallTx as any)(
                spec.providers,
                {
                  compiledContract: spec.compiledContract,
                  circuitId: spec.circuitId,
                  contractAddress: spec.contractAddress,
                  args: spec.args,
                  ...(spec.privateStateId ? { privateStateId: spec.privateStateId } : {}),
                },
                txCtx,
              );
            }
          },
          { scopeName: 'aa00004-probe-merge' },
        ),
      );
      return { txId: String(finalized?.public?.txId ?? finalized?.public?.txHash ?? finalized) };
    };

    // --- fixture -----------------------------------------------------------------------------------
    log('fixture: minting S1, S2, U1, U2 to OwnerM');
    await mintShieldedToUser(ctx, 'Minter1', 10n, rig.observers.OwnerM, rig.fee);
    await mintShieldedToUser(ctx, 'Minter2', 10n, rig.observers.OwnerM, rig.fee);
    await mintUnshieldedToUser(ctx, 'Minter1', 10n, rig.addresses.OwnerM, rig.fee);
    await mintUnshieldedToUser(ctx, 'Minter2', 10n, rig.addresses.OwnerM, rig.fee);
    await new Promise((r) => setTimeout(r, 20_000));

    // --- 1. establish the pool, exactly as spec step 7 does -----------------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'establish', { colour: colours.hex.S2, shielded: true, amount: 6n });
      try {
        await attempt(
          'establish-pool',
          'Does a single fresh-pool shielded deposit work? (spec step 7)',
          'Manager.depositShielded(S2,6) ALONE, empty pool',
          'S2',
          () => single(shieldedSpec(s.managerProviders, 'S2', 6n), s),
        );
      } finally {
        await s.close();
      }
    }

    // --- 2. a MERGE, on its own --------------------------------------------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'merge-alone', { colour: colours.hex.S2, shielded: true, amount: 2n });
      try {
        await attempt(
          'merge-alone',
          'Is a MERGING shielded deposit fine on its own?',
          'Manager.depositShielded(S2,2) ALONE, poolS2 non-empty -> mergeCoinImmediate',
          'S2',
          () => single(shieldedSpec(s.managerProviders, 'S2', 2n), s),
        );
      } finally {
        await s.close();
      }
    }

    // --- 3. THE GATE STEP-13 SHAPE: merge + unshielded, ONE INTENT ----------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'merge-mixed', { colour: colours.hex.S2, shielded: true, amount: 2n });
      try {
        await attempt(
          'merge-plus-unshielded-one-intent',
          'THE EXACT GATE STEP-13 SHAPE: does a MERGING shielded deposit survive sharing a transaction?',
          'Manager.depositShielded(S2,2) [MERGE] + Manager.depositUnshielded(U2,2), one ledger Intent',
          'S2',
          () => oneIntent([shieldedSpec(s.managerProviders, 'S2', 2n), unshieldedSpec(s.managerProviders, 'U2', 2n)], s),
        );
      } finally {
        await s.close();
      }
    }

    // --- 4. the same via the SDK scoped batch --------------------------------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'merge-scoped', { colour: colours.hex.S2, shielded: true, amount: 2n });
      try {
        await attempt(
          'merge-plus-unshielded-scoped',
          'Same, through midnight-js\'s own same-contract batching.',
          'Manager.depositShielded(S2,2) [MERGE] + Manager.depositUnshielded(U2,2), withContractScopedTransaction',
          'S2',
          () => scopedBatch([shieldedSpec(s.managerProviders, 'S2', 2n), unshieldedSpec(s.managerProviders, 'U2', 2n)], s),
        );
      } finally {
        await s.close();
      }
    }

    // --- 5. CONTROL: the round-1 shape that passed, on a still-empty pool ------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'fresh-mixed', { colour: colours.hex.S1, shielded: true, amount: 2n });
      try {
        await attempt(
          'fresh-plus-unshielded-one-intent',
          'CONTROL: round 1\'s accepted shape, on a colour whose pool is still empty.',
          'Manager.depositShielded(S1,2) [FRESH] + Manager.depositUnshielded(U1,2), one ledger Intent',
          'S1',
          () => oneIntent([shieldedSpec(s.managerProviders, 'S1', 2n), unshieldedSpec(s.managerProviders, 'U1', 2n)], s),
        );
      } finally {
        await s.close();
      }
    }

    // --- verdict -----------------------------------------------------------------------------------
    const by = (id: string) => attempts.find((a) => a.id === id);
    const mergeAlone = Boolean(by('merge-alone')?.ok);
    const mergeMixedIntent = Boolean(by('merge-plus-unshielded-one-intent')?.ok);
    const mergeMixedScoped = Boolean(by('merge-plus-unshielded-scoped')?.ok);
    const freshMixed = Boolean(by('fresh-plus-unshielded-one-intent')?.ok);

    const verdict = !mergeAlone
      ? 'A MERGING deposit fails even ALONE — lane regression, not a composition question'
      : mergeMixedIntent || mergeMixedScoped
        ? 'the gate step-13 shape was ACCEPTED here — the gate failure has another cause; re-examine it'
        : freshMixed
          ? 'CONFIRMED: a MERGING shielded deposit cannot share a transaction with another call, while a FRESH-POOL one can. Spec step 13 requires the merge, so it is not performable as written.'
          : 'both mixed shapes failed regardless of pool state — re-examine; round 1 accepted the fresh shape';

    writeFileSync(
      join(EVID, 'probe-merge.json'),
      `${JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          utc: stamp(),
          purpose:
            'round 2: isolate whether the pool MERGE, rather than the composition, is what makes spec step 13 refused (RpcError 1010 Custom error 223)',
          managerAddress,
          colours: colours.hex,
          verdict,
          attempts,
        },
        (_k, v) => (typeof v === 'bigint' ? `${v}` : v),
        2,
      )}\n`,
    );

    console.log('\n## RESULT');
    for (const a of attempts) {
      console.log(`  ${a.ok ? 'ACCEPTED' : 'REFUSED '} ${a.id.padEnd(34)} (pool before: ${a.poolBefore})`);
      if (a.error) console.log(`      ${a.error}`);
    }
    console.log(`\nVERDICT: ${verdict}`);
  } finally {
    if (rig) await rig.close();
  }
};

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
