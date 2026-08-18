// G2 (Plan 02 Phase 3) — deploy the 00004 contracts on the live pinned lane, read the six colours
// from chain, prove them pairwise distinct, configure the Manager and register both accounts, then
// run the unit-level negatives. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// What this establishes, in order:
//
//   1. ONE compiled Minter artifact deployed THREE times with different constructor tags
//      (TOKA, TOKB, TOKC) — FR-101. Probe P2 proved the mechanism in G1; this is the product
//      contract doing it for real.
//   2. The SIX colours read from ON-CHAIN CIRCUIT CALLS (never derived off-chain) are pairwise
//      distinct: 15 comparisons over 6 colours — the spec's Distinctness control.
//   3. The Manager binds exactly S1, S2, U1, U2 in ONE one-time `configure` (FR-102), and both
//      accounts register with all four colours seeded at zero (FR-103).
//   4. Three negatives are refused with verbatim errors and the WHOLE Manager state proven
//      byte-identical across each attempt: reconfigure, duplicate registration, and a witness that
//      opens no registered account (the NC-1 shape, at unit level).
//
// Two observation points everywhere (FR-108):
//   - Minter colours: the deployment's LEDGER CELLS (tag + derived separators) vs the on-chain
//     `shieldedColor()` / `unshieldedColor()` circuit results; plus an in-process run of the
//     SEPARATELY COMPILED --skip-zk artifact, which must derive the same separators from the same
//     tag (that also proves the two builds agree).
//   - Manager state: the decoded contract LEDGER STATE vs real `accountBalance` / `poolValue` /
//     `poolHasColour` / `isRegistered` circuit calls.
//
// F-104 discipline: nothing here reads a balance from the wallet that submitted the transaction.
// Every assertion is against contract state or a circuit result.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT, SEEDS } from '../lane.js';
import { fundWithNight, log, registerForDust, units, withDustRetry } from '../night.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { makeProviders, zkDir } from '../g3/providers.js';
import { compiledManager, compiledMinter } from '../contracts.js';
import { ManagerSim, MinterSim } from '../test/sim.js';
import { balanceKeyOf, hex, readManager, snapshot, waitForManager, type ManagerView } from './manager-view.js';

// @ts-ignore — generated artifact
import { ledger as minterLedger } from '../../generated-zk/minter/contract/index.js';

const stamp = () => new Date().toISOString();
const EVID = join(REPO_ROOT, 'evidence', 'g2-contracts');

/** `pad(32, s)` on the TypeScript side: right-pad the UTF-8 bytes with zeros to 32. */
const pad32 = (s: string): Uint8Array => {
  const b = Buffer.from(s, 'utf-8');
  if (b.length > 32) throw new Error(`tag "${s}" exceeds 32 bytes`);
  const out = new Uint8Array(32);
  out.set(b);
  return out;
};

/** `Either<ZswapCoinPublicKey, ContractAddress>` — the shielded recipient union. */
const shieldedToUser = (coinPk: unknown) => ({
  is_left: true,
  left: { bytes: typeof coinPk === 'string' ? Buffer.from(coinPk, 'hex') : (coinPk as Uint8Array) },
  right: { bytes: new Uint8Array(32) },
});

/** Set the owner secret the Manager's witness reads on the next call through `providers`. */
const actAs = async (providers: any, secret: Uint8Array): Promise<void> => {
  await providers.privateStateProvider.set('manager', { ownerSecret: secret });
};

/** Unwrap a circuit call result (the SDK returns the value under `private.result`). */
const resultOf = <T>(r: any): T => (r?.private?.result ?? r?.result) as T;

type MinterDeployment = {
  label: string;
  tagText: string;
  tagIn: string;
  address: string;
  ledgerTag: string;
  shieldedSep: string;
  unshieldedSep: string;
  simShieldedSep: string;
  simUnshieldedSep: string;
  shieldedColour: string;
  unshieldedColour: string;
};

type NegativeResult = {
  id: string;
  label: string;
  expectation: string;
  rejectedAt: string;
  reason: string;
  /** The message the contract's own `assert` must produce — a rejection for any OTHER reason is RED. */
  expectedMessage: string;
  messageMatched: boolean;
  stateUnchanged: boolean;
  status: 'GREEN' | 'RED';
};

const failures: string[] = [];
const check = (ok: boolean, message: string): void => {
  if (!ok) {
    failures.push(message);
    console.log(`  FAIL  ${message}`);
  }
};

const main = async () => {
  console.log(`# G2 deploy + configure — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  setNetworkId(NetworkId.NetworkId.Undeployed as any);

  const psDir = mkdtempSync(join(tmpdir(), 'aa00004-g2-'));
  log(`private-state dir: ${psDir}`);

  const parties: Party[] = [];
  const minters: MinterDeployment[] = [];
  const negatives: NegativeResult[] = [];

  try {
    // --- wallets and fees --------------------------------------------------------------------
    const genesis = await openParty('genesis', SEEDS.genesis);
    parties.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    log('wallets open; syncing genesis …');
    await (genesis.wallet as any).waitForSyncedState();

    const fundTx = await fundWithNight(genesis, fee, units(1_000_000n));
    const dustTx = await registerForDust(fee);
    log(`feePayer funded (${fundTx}) and registered for DUST (${dustTx})`);

    // --- 1. three Minter deployments from ONE artifact (FR-101) ---------------------------------
    for (const [label, tagText] of [
      ['Minter1', 'TOKA'],
      ['Minter2', 'TOKB'],
      ['Minter3', 'TOKC'],
    ] as const) {
      const tag = pad32(tagText);
      const providers = makeProviders(fee, label.toLowerCase(), psDir, zkDir('minter'));
      log(`deploying ${label} with constructor tag "${tagText}" (${hex(tag)}) …`);
      const deployed: any = await withDustRetry(fee, `deploy ${label}`, () =>
        deployContract(providers, { compiledContract: compiledMinter(), args: [tag] } as any),
      );
      const address = deployed.deployTxData.public.contractAddress;
      log(`  ${label} at ${address}`);

      // OP1 — the deployment's own ledger cells.
      const state = await providers.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state for ${label} at ${address}`);
      const l: any = (minterLedger as any)(state.data);

      // OP2 — real on-chain circuit calls.
      const sc = await withDustRetry(fee, `${label}.shieldedColor()`, () => deployed.callTx.shieldedColor());
      const uc = await withDustRetry(fee, `${label}.unshieldedColor()`, () => deployed.callTx.unshieldedColor());

      // OP3 — the SEPARATELY COMPILED --skip-zk artifact, run in process on the same tag. The
      // separators depend only on the tag, so they must match exactly; the colours must not, since
      // they are scoped to the contract address.
      const sim = await MinterSim.create(tag);

      const d: MinterDeployment = {
        label,
        tagText,
        tagIn: hex(tag),
        address,
        ledgerTag: hex(l.deploymentTag),
        shieldedSep: hex(l.shieldedSep),
        unshieldedSep: hex(l.unshieldedSep),
        simShieldedSep: hex(sim.ledger.shieldedSep),
        simUnshieldedSep: hex(sim.ledger.unshieldedSep),
        shieldedColour: hex(resultOf<Uint8Array>(sc)),
        unshieldedColour: hex(resultOf<Uint8Array>(uc)),
      };
      minters.push(d);

      log(`  ledger.deploymentTag  ${d.ledgerTag}`);
      log(`  ledger.shieldedSep    ${d.shieldedSep}`);
      log(`  ledger.unshieldedSep  ${d.unshieldedSep}`);
      log(`  circuit shieldedColor()   ${d.shieldedColour}`);
      log(`  circuit unshieldedColor() ${d.unshieldedColour}`);

      check(d.ledgerTag === d.tagIn, `${label}: stored tag ${d.ledgerTag} != constructor argument ${d.tagIn}`);
      check(d.shieldedSep !== d.unshieldedSep, `${label}: the two family separators are identical`);
      check(
        d.shieldedSep === d.simShieldedSep && d.unshieldedSep === d.simUnshieldedSep,
        `${label}: on-chain separators disagree with the in-process artifact ` +
          `(chain ${d.shieldedSep}/${d.unshieldedSep} vs sim ${d.simShieldedSep}/${d.simUnshieldedSep})`,
      );
      check(
        d.shieldedColour !== d.unshieldedColour,
        `${label}: shielded and unshielded colours are identical (${d.shieldedColour})`,
      );
    }

    // --- 2. distinctness: 15 pairwise comparisons over 6 colours ---------------------------------
    const colourList: Array<[string, string]> = [];
    for (const d of minters) {
      colourList.push([`${d.label}(${d.tagText}).shielded`, d.shieldedColour]);
      colourList.push([`${d.label}(${d.tagText}).unshielded`, d.unshieldedColour]);
    }
    let comparisons = 0;
    let distinct = 0;
    const collisions: string[] = [];
    for (let i = 0; i < colourList.length; i++) {
      for (let k = i + 1; k < colourList.length; k++) {
        comparisons++;
        if (colourList[i][1] === colourList[k][1]) {
          collisions.push(`${colourList[i][0]} == ${colourList[k][0]} (${colourList[i][1]})`);
        } else {
          distinct++;
        }
      }
    }
    log(`pairwise colour distinctness: ${distinct}/${comparisons}`);
    check(comparisons === 15, `expected 15 pairwise comparisons over 6 colours, made ${comparisons}`);
    check(collisions.length === 0, `colour collisions: ${collisions.join('; ')}`);

    // The four CONFIGURED colours, and the two control colours that must never be configured.
    const [m1, m2, m3] = minters;
    const S1 = Buffer.from(m1.shieldedColour, 'hex');
    const U1 = Buffer.from(m1.unshieldedColour, 'hex');
    const S2 = Buffer.from(m2.shieldedColour, 'hex');
    const U2 = Buffer.from(m2.unshieldedColour, 'hex');

    // --- 3. the Manager -----------------------------------------------------------------------
    const managerProviders = makeProviders(fee, 'manager', psDir);
    log('deploying Manager …');
    const manager: any = await withDustRetry(fee, 'deploy Manager', () =>
      deployContract(managerProviders, {
        compiledContract: compiledManager(),
        privateStateId: 'manager',
        initialPrivateState: { ownerSecret: new Uint8Array(32) },
      } as any),
    );
    const managerAddress = manager.deployTxData.public.contractAddress;
    log(`  Manager at ${managerAddress}`);

    const fresh = await readManager(managerProviders, managerAddress);
    check(fresh.configured === false, 'a freshly deployed Manager reports itself configured');
    check(fresh.accounts.length === 0, 'a freshly deployed Manager already has accounts');
    check(fresh.poolCount === 0n, 'a freshly deployed Manager already holds pools');

    log('configure(S1, S2, U1, U2) …');
    await withDustRetry(fee, 'configure', () => manager.callTx.configure(S1, S2, U1, U2));
    const configured = await waitForManager(
      managerProviders,
      managerAddress,
      (m) => m.configured,
      'the Manager to report configured',
    );
    check(configured.colours.S1 === m1.shieldedColour, `colourS1 is ${configured.colours.S1}, expected S1`);
    check(configured.colours.S2 === m2.shieldedColour, `colourS2 is ${configured.colours.S2}, expected S2`);
    check(configured.colours.U1 === m1.unshieldedColour, `colourU1 is ${configured.colours.U1}, expected U1`);
    check(configured.colours.U2 === m2.unshieldedColour, `colourU2 is ${configured.colours.U2}, expected U2`);
    const configuredSet = new Set(Object.values(configured.colours));
    check(configuredSet.size === 4, 'the four configured colours are not four distinct values');
    for (const control of [m3.shieldedColour, m3.unshieldedColour]) {
      check(!configuredSet.has(control), `Minter3 control colour ${control} was admitted by configure`);
    }

    // --- account registration ------------------------------------------------------------------
    // `myAccount` is ledger-free, so the compiler emits no proving key for it and it is not a
    // callTx. The account ids are derived IN PROCESS by running the very same compiled circuit
    // through the simulator, so the artifact stays the single source of truth for the commitment
    // scheme, which is never reimplemented off-chain.
    const sim = await ManagerSim.create(new Uint8Array(32));
    const secretA = unshieldedSeedOf(SEEDS.ownerA);
    const secretB = unshieldedSeedOf(SEEDS.ownerB);
    const idA = await sim.ownerCommitmentFor(secretA);
    const idB = await sim.ownerCommitmentFor(secretB);
    log(`registering AA_A ${hex(idA)} and AA_B ${hex(idB)} …`);

    await actAs(managerProviders, secretA);
    await withDustRetry(fee, 'registerAccount(AA_A)', () => manager.callTx.registerAccount(idA));
    await actAs(managerProviders, secretB);
    await withDustRetry(fee, 'registerAccount(AA_B)', () => manager.callTx.registerAccount(idB));

    const registered = await waitForManager(
      managerProviders,
      managerAddress,
      (m) => m.accounts.length === 2,
      'both accounts to be registered',
    );
    check(registered.accounts.includes(hex(idA)), 'AA_A is missing from the account set');
    check(registered.accounts.includes(hex(idB)), 'AA_B is missing from the account set');
    // The exactness that makes the 16-cell table enumerable: 2 accounts x 4 colours, nothing else.
    check(
      registered.balanceCount === 8n,
      `balances holds ${registered.balanceCount} entries, expected 8 (2 accounts x 4 colours)`,
    );
    check(registered.poolCount === 0n, `pools is not empty after registration (${registered.poolCount})`);

    // Enumerate the whole table from RAW ledger state, deriving each key with the contract's own
    // pure `balanceKey` circuit. Every cell must be present and zero, and no cell may exist that
    // this enumeration does not account for.
    const cells: Record<string, Record<string, string>> = { AA_A: {}, AA_B: {} };
    const accountedKeys = new Set<string>();
    for (const [account, id] of [
      ['AA_A', idA],
      ['AA_B', idB],
    ] as const) {
      for (const [name, colour] of [
        ['S1', S1],
        ['S2', S2],
        ['U1', U1],
        ['U2', U2],
      ] as const) {
        const key = balanceKeyOf(id, colour);
        accountedKeys.add(key);
        const v = registered.balances[key];
        check(v !== undefined, `no ledger cell for (${account}, ${name})`);
        check(v === 0n, `(${account}, ${name}) is ${v}, expected 0 at G2`);
        cells[account][name] = String(v ?? 'missing');
      }
    }
    const unaccounted = Object.keys(registered.balances).filter((k) => !accountedKeys.has(k));
    check(unaccounted.length === 0, `unaccounted balance cells in ledger state: ${unaccounted.join(', ')}`);

    // --- OP2 spot checks: the SAME facts through real on-chain circuit calls ----------------------
    const isRegA = resultOf<boolean>(
      await withDustRetry(fee, 'isRegistered(AA_A)', () => manager.callTx.isRegistered(idA)),
    );
    const balA_S1 = resultOf<bigint>(
      await withDustRetry(fee, 'accountBalance(AA_A, S1)', () => manager.callTx.accountBalance(idA, S1)),
    );
    const balB_U2 = resultOf<bigint>(
      await withDustRetry(fee, 'accountBalance(AA_B, U2)', () => manager.callTx.accountBalance(idB, U2)),
    );
    const poolHasS1 = resultOf<boolean>(
      await withDustRetry(fee, 'poolHasColour(S1)', () => manager.callTx.poolHasColour(S1)),
    );
    log(`circuit reads: isRegistered(AA_A)=${isRegA} bal(AA_A,S1)=${balA_S1} bal(AA_B,U2)=${balB_U2} poolHasColour(S1)=${poolHasS1}`);
    check(isRegA === true, 'isRegistered(AA_A) returned false on chain');
    check(balA_S1 === 0n, `accountBalance(AA_A, S1) returned ${balA_S1} on chain, expected 0`);
    check(balB_U2 === 0n, `accountBalance(AA_B, U2) returned ${balB_U2} on chain, expected 0`);
    check(poolHasS1 === false, 'poolHasColour(S1) returned true on an empty Manager');

    // --- 4. unit-level negatives ------------------------------------------------------------------
    const expectRejection = async (
      id: string,
      label: string,
      expectation: string,
      rejectedAt: string,
      /**
       * The contract's own assert message. Requiring it is what stops a rejection for some
       * UNRELATED reason — a malformed argument, a funding hiccup — from being recorded as the
       * guard doing its job.
       */
      expectedMessage: RegExp,
      attempt: () => Promise<unknown>,
    ): Promise<void> => {
      const before = snapshot(await readManager(managerProviders, managerAddress));
      let reason = '';
      let rejected = false;
      try {
        const r: any = await attempt();
        reason = `NOT REJECTED — the operation was accepted (tx ${String(r?.public?.txId ?? r ?? '')})`;
      } catch (e) {
        rejected = true;
        const err = e as any;
        const cause = err?.cause ? ` | cause: ${String(err.cause?.message ?? err.cause)}` : '';
        reason = `${e instanceof Error ? e.message : String(e)}${cause}`;
      }
      // Give the chain a chance to apply anything that might (wrongly) have gone through, so
      // "unchanged" is a real observation rather than a race we won.
      await new Promise((r) => setTimeout(r, 12_000));
      const afterView: ManagerView = await readManager(managerProviders, managerAddress);
      const unchanged = snapshot(afterView) === before;

      const first = reason.split('\n')[0]!.slice(0, 400);
      const matched = rejected && expectedMessage.test(reason);
      const ok = rejected && matched && unchanged;
      negatives.push({
        id,
        label,
        expectation,
        rejectedAt,
        reason: first,
        expectedMessage: String(expectedMessage),
        messageMatched: matched,
        stateUnchanged: unchanged,
        status: ok ? 'GREEN' : 'RED',
      });
      console.log(`  ${ok ? 'GREEN' : 'RED  '} ${id} — ${first.slice(0, 200)}`);
      if (!rejected) failures.push(`negative ${id}: the operation was NOT rejected`);
      if (rejected && !matched) {
        failures.push(`negative ${id}: rejected, but not by ${expectedMessage} — got: ${first}`);
      }
      if (!unchanged) {
        failures.push(`negative ${id}: Manager state changed across a rejected call`);
        console.log(`    BEFORE ${before}`);
        console.log(`    AFTER  ${snapshot(afterView)}`);
      }
    };

    console.log('\n## unit-level negatives');

    await expectRejection(
      'reconfigure',
      'A second `configure` is refused (FR-102, one-time binding)',
      "rejected with 'already configured'; the four bound colours are unchanged",
      'circuit execution (no transaction built)',
      /already configured/,
      () => manager.callTx.configure(S1, S2, U1, U2),
    );

    await expectRejection(
      'duplicate-registration',
      'Registering an account id that already exists is refused',
      "rejected with 'account already registered'; the account set and the 8 seeded cells are unchanged",
      'circuit execution (no transaction built)',
      /account already registered/,
      async () => {
        await actAs(managerProviders, secretA);
        return manager.callTx.registerAccount(idA);
      },
    );

    await expectRejection(
      'unregistered-witness',
      'NC-1 shape: a witness that opens no registered account is refused at the choke point',
      "rejected with \"caller's owner witness matches no registered account\" before any colour, " +
        'balance or pool guard is reached',
      'circuit execution (no transaction built)',
      /matches no registered account/,
      async () => {
        // OwnerN is a pure user in the demo: its secret opens no Manager account.
        await actAs(managerProviders, unshieldedSeedOf(SEEDS.ownerN));
        return manager.callTx.withdrawShielded(S1, 1n, shieldedToUser(fee.shieldedSecretKeys.coinPublicKey));
      },
    );

    // Restore a benign private state so nothing later in this process inherits the bad witness.
    await actAs(managerProviders, new Uint8Array(32));

    // --- evidence ----------------------------------------------------------------------------------
    const finalView = await readManager(managerProviders, managerAddress);
    const result = {
      gate: 'G2',
      lane: 'EXPERIMENTAL_LANE',
      deviation: 'LANE-DEV-1',
      recorded_utc: stamp(),
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
      manager_address: managerAddress,
      minters,
      colours: {
        configured: {
          S1: m1.shieldedColour,
          S2: m2.shieldedColour,
          U1: m1.unshieldedColour,
          U2: m2.unshieldedColour,
        },
        control_never_configured: {
          'Minter3.shielded': m3.shieldedColour,
          'Minter3.unshielded': m3.unshieldedColour,
        },
      },
      distinctness: { comparisons, distinct, collisions },
      configure_state: {
        configured: finalView.configured,
        colours: finalView.colours,
        accounts: finalView.accounts,
        balance_cells: Number(finalView.balanceCount),
        pools: Number(finalView.poolCount),
      },
      accounts: { AA_A: hex(idA), AA_B: hex(idB) },
      table_at_g2: cells,
      circuit_reads: {
        'isRegistered(AA_A)': isRegA,
        'accountBalance(AA_A, S1)': String(balA_S1),
        'accountBalance(AA_B, U2)': String(balB_U2),
        'poolHasColour(S1)': poolHasS1,
      },
      negatives,
      failures,
    };
    writeFileSync(
      join(EVID, 'deploy-configure.json'),
      `${JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? `${v}` : v), 2)}\n`,
    );
    writeContractsMd(result);

    console.log('\n## RESULT');
    console.log(JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? `${v}` : v), 2));

    if (failures.length > 0) {
      console.error(`\nG2 DEPLOY/CONFIGURE FAILED:\n  ${failures.join('\n  ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `\nG2 deploy/configure PASS — 3 Minters + 1 Manager live, ${distinct}/${comparisons} colours distinct, ` +
        `Manager configured with exactly S1,S2,U1,U2, both accounts registered with 8 seeded cells, ` +
        `${negatives.length}/${negatives.length} negatives refused with state proven unchanged`,
    );
  } finally {
    for (const p of parties) await closeParty(p);
    try {
      rmSync(psDir, { recursive: true, force: true });
    } catch {
      /* teardown must not mask the real result */
    }
  }
};

/** The human-readable half of the evidence. */
const writeContractsMd = (r: any): void => {
  const lines: string[] = [];
  lines.push('# G2 — contracts deployed, colours read, Manager configured');
  lines.push('');
  lines.push('`EXPERIMENTAL_LANE` / `LANE-DEV-1` — 00004-multi-token-custody, Plan 02 Phase 3.');
  lines.push('');
  lines.push(`Recorded (UTC): ${r.recorded_utc}`);
  lines.push(`Verdict: **${r.verdict}**`);
  lines.push('');
  lines.push('## Deployments — ONE Minter artifact, three constructor tags (FR-101)');
  lines.push('');
  lines.push('| Deployment | tag in | tag stored on-chain | address | shielded colour | unshielded colour |');
  lines.push('|---|---|---|---|---|---|');
  for (const m of r.minters) {
    lines.push(
      `| ${m.label} (\`${m.tagText}\`) | \`${m.tagIn.slice(0, 16)}…\` | \`${m.ledgerTag.slice(0, 16)}…\` ` +
        `${m.ledgerTag === m.tagIn ? '(identical)' : '**MISMATCH**'} | \`${m.address.slice(0, 12)}…\` | ` +
        `\`${m.shieldedColour}\` | \`${m.unshieldedColour}\` |`,
    );
  }
  lines.push(`| Manager | — | — | \`${r.manager_address.slice(0, 12)}…\` | — | — |`);
  lines.push('');
  lines.push('Each deployment\'s two family separators were also derived in process by the separately');
  lines.push('compiled `--skip-zk` artifact from the same tag and matched the on-chain cells exactly.');
  lines.push('');
  lines.push('## Distinctness — 6 colours, all pairwise comparisons');
  lines.push('');
  lines.push(`**${r.distinctness.distinct}/${r.distinctness.comparisons} distinct**` +
    (r.distinctness.collisions.length ? ` — collisions: ${r.distinctness.collisions.join('; ')}` : ' (no collisions)'));
  lines.push('');
  lines.push('Read from on-chain circuit calls, never derived off-chain.');
  lines.push('');
  lines.push('| Role | Colour |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(r.colours.configured)) lines.push(`| configured ${k} | \`${v}\` |`);
  for (const [k, v] of Object.entries(r.colours.control_never_configured)) {
    lines.push(`| control (never configured) ${k} | \`${v}\` |`);
  }
  lines.push('');
  lines.push('## Manager state after `configure` + registration');
  lines.push('');
  lines.push(`- \`configured\`: ${r.configure_state.configured}`);
  lines.push(`- bound colours: S1 \`${r.configure_state.colours.S1}\`, S2 \`${r.configure_state.colours.S2}\`,`);
  lines.push(`  U1 \`${r.configure_state.colours.U1}\`, U2 \`${r.configure_state.colours.U2}\``);
  lines.push(`- accounts: AA_A \`${r.accounts.AA_A}\`, AA_B \`${r.accounts.AA_B}\``);
  lines.push(`- balance cells: ${r.configure_state.balance_cells} (2 accounts x 4 colours, seeded at zero)`);
  lines.push(`- pools: ${r.configure_state.pools}`);
  lines.push('');
  lines.push('| | S1 | S2 | U1 | U2 |');
  lines.push('|---|---|---|---|---|');
  for (const acct of ['AA_A', 'AA_B']) {
    const row = r.table_at_g2[acct];
    lines.push(`| ${acct} | ${row.S1} | ${row.S2} | ${row.U1} | ${row.U2} |`);
  }
  lines.push('');
  lines.push('Second observation point — real on-chain circuit calls:');
  lines.push('');
  for (const [k, v] of Object.entries(r.circuit_reads)) lines.push(`- \`${k}\` = \`${v}\``);
  lines.push('');
  lines.push('## Unit-level negatives');
  lines.push('');
  lines.push('| Id | Status | Refused at | Verbatim error | Expected message | State byte-identical |');
  lines.push('|---|---|---|---|---|---|');
  for (const n of r.negatives) {
    lines.push(
      `| \`${n.id}\` | **${n.status}** | ${n.rejectedAt} | \`${n.reason.replace(/\|/g, '\\|')}\` | ` +
        `\`${String(n.expectedMessage).replace(/\|/g, '\\|')}\` ${n.messageMatched ? 'matched' : '**NOT MATCHED**'} | ` +
        `${n.stateUnchanged ? 'yes' : '**NO**'} |`,
    );
  }
  lines.push('');
  for (const n of r.negatives) lines.push(`- **${n.id}** — ${n.label}. Expectation: ${n.expectation}`);
  lines.push('');
  writeFileSync(join(EVID, 'CONTRACTS.md'), `${lines.join('\n')}\n`);
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
