// G3 diagnostic probe — WHY does a two-call Manager transaction get refused? (decision D-102)
//
// EXPERIMENTAL_LANE / LANE-DEV-1.
//
// Gate G3 run 1 and run 2 both went RED at spec step 13 (probe M1). The step-13 shape is
// `Manager.depositShielded(S2)` + `Manager.depositUnshielded(U2)` in ONE transaction, and it was
// refused by the NODE, not by the contract:
//
//     SubmissionError: Transaction submission error
//       cause: SubmissionError: Transaction submission failed
//         cause: RpcError: 1010: Invalid Transaction: Custom error: 223
//
// TWO different compositions produced the SAME code:
//   * both calls in ONE ledger Intent (the 00003 R8 machinery) — assembled correctly, as its own
//     structural dump shows: `intentCount: 1, actions: 2, entryPoints
//     ["depositShielded","depositUnshielded"], addresses [same, same]`;
//   * each call in its own SEGMENT of one transaction, via midnight-js's own
//     `withContractScopedTransaction`, which additionally THREADS the contract state between calls.
//
// Because the two differ in exactly the thing D-102 asks about — how the calls are composed — and
// fail identically, the blocker is almost certainly NOT the composition. This probe isolates which
// property actually breaks, by trying four shapes against ONE stack:
//
//   1. two SHIELDED deposits, same contract, one intent      — same contract twice, one family
//   2. two UNSHIELDED deposits, same contract, one intent    — same contract twice, other family
//   3. shielded + unshielded, same contract, one intent      — the step-13 shape
//   4. two SHIELDED deposits, same contract, SDK scoped      — same contract twice, other mechanism
//
// plus a POSITIVE CONTROL that the machinery still works at all:
//
//   5. Minter mint -> Manager receive, cross-contract, one intent — 00003's proven R8 shape.
//
// Reading the result:
//   * 1, 2 and 4 pass but 3 fails  -> the blocker is MIXING THE TWO FAMILIES in one transaction,
//     and D-102's "same-contract" framing is not the real constraint.
//   * 1, 2 and 4 fail             -> the blocker IS two calls to the same contract.
//   * 5 fails too                 -> something about this run, not about the shape; start over.
//
// Every attempt records its verbatim error chain and whether the Manager's state moved, so the
// finding rests on observations rather than on the hypothesis that motivated the probe.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../lane.js';
import { bootstrap, type Rig } from './setup.js';
import {
  errorChain,
  mintShieldedToUser,
  mintUnshieldedToUser,
  shieldedToContract,
  unshieldedToContract,
  type Ctx,
} from './actions.js';
import { composeOneIntent, proveBalanceSubmit } from './ledger-compose.js';
import type { CallSpec } from './compose.js';
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
  calls: string[];
  ok: boolean;
  txId?: string;
  error?: string;
  managerStateMoved: boolean;
};

const attempts: Attempt[] = [];

const main = async () => {
  console.log(`# G3 PROBE — why is a two-call Manager transaction refused? — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  let rig: Rig | undefined;

  try {
    rig = await bootstrap();
    const { ctx, colours, raw, managerAddress } = rig;

    const depositShieldedSpec = (providers: any, colour: ColourName, value: bigint): CallSpec => ({
      providers,
      compiledContract: ctx.compiledManager(),
      contractAddress: managerAddress,
      circuitId: 'depositShielded',
      args: [{ nonce: randomBytes(32), color: colours.raw[colour], value }, raw.AA_B],
      privateStateId: 'manager',
    });
    const depositUnshieldedSpec = (providers: any, colour: ColourName, amount: bigint): CallSpec => ({
      providers,
      compiledContract: ctx.compiledManager(),
      contractAddress: managerAddress,
      circuitId: 'depositUnshielded',
      args: [colours.raw[colour], amount, raw.AA_B],
      privateStateId: 'manager',
    });

    /** Run one attempt: try the shape, record the verbatim outcome and whether state moved. */
    const attempt = async (
      id: string,
      question: string,
      shape: string,
      calls: string[],
      run: () => Promise<string>,
    ): Promise<boolean> => {
      const before = snapshot(await readManager(ctx.managerFee, managerAddress));
      log(`--- ${id}: ${shape}`);
      let ok = false;
      let txId: string | undefined;
      let error: string | undefined;
      try {
        txId = await run();
        ok = true;
        log(`    ACCEPTED — tx ${txId}`);
      } catch (e) {
        error = errorChain(e, 8);
        log(`    REFUSED — ${error}`);
      }
      await new Promise((r) => setTimeout(r, 15_000));
      const after = snapshot(await readManager(ctx.managerFee, managerAddress));
      attempts.push({ id, question, shape, calls, ok, txId, error, managerStateMoved: before !== after });
      return ok;
    };

    // --- fixture: OwnerM holds all four colours ---------------------------------------------------
    log('fixture: minting all four colours to OwnerM');
    await mintShieldedToUser(ctx, 'Minter1', 10n, rig.observers.OwnerM, rig.fee);
    await mintShieldedToUser(ctx, 'Minter2', 10n, rig.observers.OwnerM, rig.fee);
    await mintUnshieldedToUser(ctx, 'Minter1', 10n, rig.addresses.OwnerM, rig.fee);
    await mintUnshieldedToUser(ctx, 'Minter2', 10n, rig.addresses.OwnerM, rig.fee);
    await new Promise((r) => setTimeout(r, 20_000));

    const oneIntent = async (specs: CallSpec[], depositor: any): Promise<string> => {
      const composed = await composeOneIntent(specs[0]!, specs.slice(1));
      log(`    assembled: ${JSON.stringify(composed.structure)}`);
      return withDustRetry(depositor.party, 'one-intent', () =>
        proveBalanceSubmit(composed.tx, ctx.composedProof, depositor.managerProviders),
      );
    };
    const scopedBatch = async (specs: CallSpec[], depositor: any): Promise<string> => {
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
          { scopeName: 'aa00004-probe' },
        ),
      );
      return String(finalized?.public?.txId ?? finalized?.public?.txHash ?? finalized);
    };

    // --- 1. two SHIELDED deposits, same contract, ONE INTENT ----------------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'probe1');
      try {
        await attempt(
          'two-shielded-one-intent',
          'Are TWO calls to the SAME contract in one intent refused, when both are the same family?',
          'Manager.depositShielded(S1,2) + Manager.depositShielded(S2,2), one ledger Intent',
          ['depositShielded', 'depositShielded'],
          () =>
            oneIntent(
              [depositShieldedSpec(s.managerProviders, 'S1', 2n), depositShieldedSpec(s.managerProviders, 'S2', 2n)],
              s,
            ),
        );
      } finally {
        await s.close();
      }
    }

    // --- 2. two UNSHIELDED deposits, same contract, ONE INTENT --------------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'probe2');
      try {
        await attempt(
          'two-unshielded-one-intent',
          'Same question, other family.',
          'Manager.depositUnshielded(U1,2) + Manager.depositUnshielded(U2,2), one ledger Intent',
          ['depositUnshielded', 'depositUnshielded'],
          () =>
            oneIntent(
              [
                depositUnshieldedSpec(s.managerProviders, 'U1', 2n),
                depositUnshieldedSpec(s.managerProviders, 'U2', 2n),
              ],
              s,
            ),
        );
      } finally {
        await s.close();
      }
    }

    // --- 3. the step-13 shape: shielded + unshielded, same contract, ONE INTENT ----------------------
    {
      const s = await rig.openSpender('OwnerM', 'probe3');
      try {
        await attempt(
          'mixed-one-intent',
          'The spec step-13 shape. Does mixing the two FAMILIES in one transaction break it?',
          'Manager.depositShielded(S2,2) + Manager.depositUnshielded(U2,2), one ledger Intent',
          ['depositShielded', 'depositUnshielded'],
          () =>
            oneIntent(
              [depositShieldedSpec(s.managerProviders, 'S2', 2n), depositUnshieldedSpec(s.managerProviders, 'U2', 2n)],
              s,
            ),
        );
      } finally {
        await s.close();
      }
    }

    // --- 4. two SHIELDED deposits, same contract, SDK SCOPED BATCH ----------------------------------
    {
      const s = await rig.openSpender('OwnerM', 'probe4');
      try {
        await attempt(
          'two-shielded-scoped',
          'Does the SDK\'s own same-contract batching accept what the ledger-level assembly does?',
          'Manager.depositShielded(S1,2) + Manager.depositShielded(S2,2), withContractScopedTransaction',
          ['depositShielded', 'depositShielded'],
          () =>
            scopedBatch(
              [depositShieldedSpec(s.managerProviders, 'S1', 2n), depositShieldedSpec(s.managerProviders, 'S2', 2n)],
              s,
            ),
        );
      } finally {
        await s.close();
      }
    }

    // --- 5. POSITIVE CONTROL: 00003's proven R8 cross-contract shape ---------------------------------
    // If this fails, the problem is this run rather than the shape under test.
    {
      const nonce = randomBytes(32);
      const carrier: CallSpec = {
        providers: ctx.managerFee,
        compiledContract: ctx.compiledManager(),
        contractAddress: managerAddress,
        circuitId: 'depositShielded',
        args: [{ nonce, color: colours.raw.S1, value: 3n }, raw.AA_A],
        privateStateId: 'manager',
      };
      const graft: CallSpec = {
        providers: ctx.minterProviders,
        compiledContract: ctx.compiledMinter(),
        contractAddress: ctx.minterAddresses.Minter1,
        circuitId: 'mintShieldedTo',
        args: [3n, nonce, shieldedToContract(managerAddress)],
      };
      await attempt(
        'r8-cross-contract-control',
        'POSITIVE CONTROL: does 00003\'s proven mint->receive shape still work on this stack?',
        'Minter1.mintShieldedTo(S1,3 -> Manager) + Manager.depositShielded(S1,3), one ledger Intent',
        ['mintShieldedTo', 'depositShielded'],
        async () => {
          const composed = await composeOneIntent(carrier, [graft]);
          log(`    assembled: ${JSON.stringify(composed.structure)}`);
          return withDustRetry(rig!.fee, 'r8-control', () =>
            proveBalanceSubmit(composed.tx, ctx.composedProof, ctx.managerFee),
          );
        },
      );
    }

    // --- 6. FR-107's named cross-contract MIXED fallback ---------------------------------------------
    // Minter mints the UNSHIELDED colour straight into the Manager while the Manager also takes a
    // SHIELDED deposit — the spec's suggested fallback, and the test of whether "cross-contract"
    // rescues a mixed-family transaction or whether family-mixing is the constraint either way.
    {
      const nonce = randomBytes(32);
      const carrier: CallSpec = {
        providers: ctx.managerFee,
        compiledContract: ctx.compiledManager(),
        contractAddress: managerAddress,
        circuitId: 'depositShielded',
        args: [{ nonce, color: colours.raw.S1, value: 2n }, raw.AA_A],
        privateStateId: 'manager',
      };
      const mintU: CallSpec = {
        providers: ctx.minterProviders,
        compiledContract: ctx.compiledMinter(),
        contractAddress: ctx.minterAddresses.Minter1,
        circuitId: 'mintUnshieldedTo',
        args: [2n, unshieldedToContract(managerAddress)],
      };
      const receiveU: CallSpec = {
        providers: ctx.managerFee,
        compiledContract: ctx.compiledManager(),
        contractAddress: managerAddress,
        circuitId: 'depositUnshielded',
        args: [colours.raw.U1, 2n, raw.AA_A],
        privateStateId: 'manager',
      };
      await attempt(
        'fr107-cross-contract-mixed',
        'Does FR-107\'s named cross-contract fallback survive family-mixing?',
        'Manager.depositShielded(S1,2) + Minter1.mintUnshieldedTo(U1,2 -> Manager) + Manager.depositUnshielded(U1,2), one ledger Intent',
        ['depositShielded', 'mintUnshieldedTo', 'depositUnshielded'],
        async () => {
          const composed = await composeOneIntent(carrier, [mintU, receiveU]);
          log(`    assembled: ${JSON.stringify(composed.structure)}`);
          return withDustRetry(rig!.fee, 'fr107-mixed', () =>
            proveBalanceSubmit(composed.tx, ctx.composedProof, ctx.managerFee),
          );
        },
      );
    }

    // --- verdict ---------------------------------------------------------------------------------------
    const by = (id: string) => attempts.find((a) => a.id === id);
    const sameContractWorks = Boolean(by('two-shielded-one-intent')?.ok || by('two-shielded-scoped')?.ok);
    const mixedWorks = Boolean(by('mixed-one-intent')?.ok);
    const controlWorks = Boolean(by('r8-cross-contract-control')?.ok);
    const verdict = !controlWorks
      ? 'INCONCLUSIVE — the positive control failed, so something about this run is wrong rather than the shapes under test'
      : sameContractWorks && !mixedWorks
        ? 'THE BLOCKER IS MIXING THE TWO FAMILIES in one transaction; two calls to the SAME contract are fine'
        : !sameContractWorks
          ? 'THE BLOCKER IS TWO CALLS TO THE SAME CONTRACT in one transaction'
          : 'the step-13 shape was ACCEPTED here — re-examine the gate run rather than the shape';

    writeFileSync(
      join(EVID, 'probe-mixed.json'),
      `${JSON.stringify(
        {
          label: 'EXPERIMENTAL_LANE / LANE-DEV-1',
          utc: stamp(),
          purpose: 'diagnose the node refusal (RpcError 1010 Custom error 223) behind spec step 13 / decision D-102',
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
      console.log(`  ${a.ok ? 'ACCEPTED' : 'REFUSED '} ${a.id.padEnd(28)} ${a.shape}`);
      if (a.error) console.log(`      ${a.error}`);
      if (!a.ok && a.managerStateMoved) console.log('      WARNING: refused but Manager state MOVED');
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
