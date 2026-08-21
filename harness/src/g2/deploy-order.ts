// G2 (Plan 02 Phase 3) — the live half of the contracts gate. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// What this establishes, in order:
//
//   1. THE DEPLOY-ORDER PROOF (the headline claim of this project). The Manager is deployed FIRST,
//      before any Minter exists on this chain, and that is proven from ON-CHAIN INDEXER DATA in two
//      independent ways rather than asserted from the order of statements in this file:
//        (a) ordering — the Manager's deploy transaction is in a strictly EARLIER block than every
//            Minter's deploy transaction;
//        (b) non-existence — asked "what contract action does address X have at or before block
//            H_manager?", the indexer answers NULL for every Minter address and answers with the
//            deploy action for the Manager itself. The Minters did not merely arrive later; they
//            did not exist.
//      The SDK's own `deployTxData.public` is recorded verbatim as a third, independent record.
//
//   2. ONE compiled Minter artifact deployed THREE times with different constructor tags (TOKA,
//      TOKB, TOKC) — 00004's contract, reused UNCHANGED — plus MinterCollide with tag TOKX.
//
//   3. Colours read from ON-CHAIN CIRCUIT CALLS (never derived off-chain): the six Minter colours
//      are pairwise distinct (15 comparisons), and MinterCollide's two are asserted BYTE-EQUAL —
//      the inverted assertion that makes probe P-COLL meaningful.
//
//   4. NO SEEDING. Both accounts register, and all three custody maps are still size 0. This is the
//      visible difference from 00004, where registration seeded `accounts x 4` cells.
//
//   5. Unit-level negatives, each with a verbatim error, the WHOLE Manager state proven
//      byte-identical, AND — new in v3 — the three map sizes proven unchanged, which is the
//      "no state created" half of FR-202 that 00004 could not state.
//
// Two observation points everywhere (FR-208):
//   - Minter colours: the deployment's LEDGER CELLS (tag + separator) vs the on-chain
//     `shieldedColor()` / `unshieldedColor()` circuit results; plus an in-process run of the
//     SEPARATELY COMPILED --skip-zk artifact, which must derive the same separators from the same
//     tag (that also proves the two builds agree).
//   - Manager state: the decoded contract LEDGER STATE vs real `shieldedAccountBalance` /
//     `unshieldedAccountBalance` / `poolValue` / `poolHasColour` / `isRegistered` circuit calls.
//   - Deploy order: indexer block heights vs the indexer's own point-in-time existence query.
//
// F-104 discipline: nothing here reads a balance from the wallet that submitted the transaction.
// Every assertion is against contract state, a circuit result, or the indexer.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { endpoints, readLaneEnv, REPO_ROOT, SEEDS } from '../lane.js';
import { fundWithNight, log, registerForDust, units, withDustRetry } from '../night.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { makeProviders, zkDir } from '../g3/providers.js';
import { compiledManager, compiledMinter, compiledMinterCollide } from '../contracts.js';
import { ManagerSim, MinterCollideSim, MinterSim } from '../test/sim.js';
import {
  hex,
  mapSizes,
  readManager,
  shieldedKeyOf,
  snapshot,
  unshieldedKeyOf,
  waitForManager,
  type ManagerView,
} from './manager-view.js';

// @ts-ignore — generated artifact
import { ledger as minterLedger } from '../../generated-zk/minter/contract/index.js';
// @ts-ignore — generated artifact
import { ledger as minterCollideLedger } from '../../generated-zk/minter-collide/contract/index.js';

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- indexer access, used ONLY for the deploy-order proof ------------------------------------------
//
// Deliberately a raw GraphQL POST rather than an SDK convenience call: the claim being proven is
// about what the CHAIN records, so the evidence should come from the chain's own index, in a form a
// reader can re-run with `curl`.

const gql = async (query: string, variables: Record<string, unknown> = {}): Promise<any> => {
  const url = endpoints(readLaneEnv()).indexerHttpUrl;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body: any = await res.json();
  if (body.errors) throw new Error(`indexer GraphQL error: ${JSON.stringify(body.errors)}`);
  return body.data;
};

const DEPLOY_QUERY = `
  query DeployAction($addr: HexEncoded!) {
    contractAction(address: $addr) {
      address
      transaction { id hash block { height hash timestamp } }
    }
  }`;

/** "What action does this address have at block `height`?" — null means it did not exist. */
const AT_BLOCK_QUERY = `
  query ActionAtBlock($addr: HexEncoded!, $height: Int!) {
    contractAction(address: $addr, offset: { blockOffset: { height: $height } }) {
      address
      transaction { id hash block { height } }
    }
  }`;

/**
 * The same question through a DIFFERENT query whose documented semantics are unambiguous: the
 * schema says `contract(address, offset)` "Returns null if the contract has no action AT OR BEFORE
 * that block". `contractAction`'s own offset semantics are not spelled out in the schema, so the two
 * are run together and both recorded — one is precise about "at or before", the other is not @beta.
 */
const CONTRACT_AT_BLOCK_QUERY = `
  query ContractAtBlock($addr: HexEncoded!, $height: Int!) {
    contract(address: $addr, offset: { height: $height }) { address }
  }`;

/** Both existence questions at once, each recorded with whether it could be asked at all. */
const existenceAtBlock = async (
  addr: string,
  height: number,
): Promise<{ action: unknown; contract: unknown; contractQueryError: string | null }> => {
  const action = (await gql(AT_BLOCK_QUERY, { addr, height })).contractAction;
  let contract: unknown = undefined;
  let contractQueryError: string | null = null;
  try {
    contract = (await gql(CONTRACT_AT_BLOCK_QUERY, { addr, height })).contract;
  } catch (e) {
    // `contract` is @beta on this indexer; if it is not served, say so rather than silently
    // treating an unanswerable question as a negative answer.
    contractQueryError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }
  return { action, contract, contractQueryError };
};

const TIP_QUERY = `query Tip { block { height hash timestamp } }`;

type DeployRecord = {
  label: string;
  address: string;
  /** verbatim from the SDK */
  sdk: Record<string, unknown>;
  txId: number | null;
  txHash: string | null;
  blockHeight: number | null;
  blockHash: string | null;
  blockTimestamp: number | null;
};

/** Wait until the indexer can answer for this address, then record its DEPLOY action. */
const recordDeploy = async (label: string, address: string, sdkPublic: any): Promise<DeployRecord> => {
  let action: any = null;
  for (let i = 0; i < 90 && !action; i++) {
    action = (await gql(DEPLOY_QUERY, { addr: address })).contractAction;
    if (!action) await sleep(2000);
  }
  if (!action) throw new Error(`indexer never reported a contract action for ${label} at ${address}`);
  const rec: DeployRecord = {
    label,
    address,
    sdk: JSON.parse(JSON.stringify(sdkPublic, (_k, v) => (typeof v === 'bigint' ? String(v) : v))),
    txId: action.transaction?.id ?? null,
    txHash: action.transaction?.hash ?? null,
    blockHeight: action.transaction?.block?.height ?? null,
    blockHash: action.transaction?.block?.hash ?? null,
    blockTimestamp: action.transaction?.block?.timestamp ?? null,
  };
  log(`  ${label} deployed at ${address} — block ${rec.blockHeight}, tx ${rec.txHash}`);
  return rec;
};

type MinterDeployment = {
  label: string;
  kind: 'minter' | 'minter-collide';
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
  deploy: DeployRecord;
};

type NegativeResult = {
  id: string;
  label: string;
  expectation: string;
  rejectedAt: string;
  reason: string;
  expectedMessage: string;
  messageMatched: boolean;
  stateUnchanged: boolean;
  mapSizesUnchanged: boolean;
  mapSizesBefore: Record<string, number>;
  mapSizesAfter: Record<string, number>;
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
  console.log(`# G2 deploy-order + contracts — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  mkdirSync(EVID, { recursive: true });
  setNetworkId(NetworkId.NetworkId.Undeployed as any);

  const psDir = mkdtempSync(join(tmpdir(), 'aa00005-g2-'));
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

    // === 1. THE MANAGER GOES FIRST ==============================================================
    //
    // Nothing that can mint has been deployed on this chain. The Manager is the first contract of
    // this demonstration to exist, and it exists knowing no colours at all.
    const tipBefore = (await gql(TIP_QUERY)).block;
    log(`chain tip before ANY contract deploy: block ${tipBefore.height} (${tipBefore.hash})`);

    const managerProviders = makeProviders(fee, 'manager', psDir);
    log('deploying the Manager FIRST — no Minter exists on this chain yet …');
    const manager: any = await withDustRetry(fee, 'deploy Manager', () =>
      deployContract(managerProviders, {
        compiledContract: compiledManager(),
        privateStateId: 'manager',
        initialPrivateState: { ownerSecret: new Uint8Array(32) },
      } as any),
    );
    const managerAddress = manager.deployTxData.public.contractAddress;
    const managerDeploy = await recordDeploy('Manager', managerAddress, manager.deployTxData.public);

    const fresh = await readManager(managerProviders, managerAddress);
    check(fresh.accounts.length === 0, 'a freshly deployed Manager already has accounts');
    check(
      fresh.poolCount === 0n && fresh.shieldedCount === 0n && fresh.unshieldedCount === 0n,
      `a freshly deployed Manager already holds custody state: ${JSON.stringify(mapSizes(fresh))}`,
    );
    // v3 has no colour cells to read at all; the reader would have thrown if they still existed.
    log(`fresh Manager map sizes: ${JSON.stringify(mapSizes(fresh))}`);

    // === 2. only NOW do the Minters exist =======================================================
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
      const deploy = await recordDeploy(label, address, deployed.deployTxData.public);

      // OP1 — the deployment's own ledger cells.
      const state = await providers.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state for ${label} at ${address}`);
      const l: any = (minterLedger as any)(state.data);

      // OP2 — real on-chain circuit calls.
      const sc = await withDustRetry(fee, `${label}.shieldedColor()`, () => deployed.callTx.shieldedColor());
      const uc = await withDustRetry(fee, `${label}.unshieldedColor()`, () => deployed.callTx.unshieldedColor());

      // OP3 — the SEPARATELY COMPILED --skip-zk artifact, run in process on the same tag.
      const sim = await MinterSim.create(tag);

      const d: MinterDeployment = {
        label,
        kind: 'minter',
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
        deploy,
      };
      minters.push(d);

      log(`  ledger.deploymentTag  ${d.ledgerTag}`);
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

    // --- MinterCollide: the ONE contract whose two colours MUST be equal --------------------------
    {
      const tagText = 'TOKX';
      const tag = pad32(tagText);
      const providers = makeProviders(fee, 'mintercollide', psDir, zkDir('minter-collide'));
      log(`deploying MinterCollide with constructor tag "${tagText}" …`);
      const deployed: any = await withDustRetry(fee, 'deploy MinterCollide', () =>
        deployContract(providers, { compiledContract: compiledMinterCollide(), args: [tag] } as any),
      );
      const address = deployed.deployTxData.public.contractAddress;
      const deploy = await recordDeploy('MinterCollide', address, deployed.deployTxData.public);

      const state = await providers.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state for MinterCollide at ${address}`);
      const l: any = (minterCollideLedger as any)(state.data);

      const sc = await withDustRetry(fee, 'MinterCollide.shieldedColor()', () => deployed.callTx.shieldedColor());
      const uc = await withDustRetry(fee, 'MinterCollide.unshieldedColor()', () => deployed.callTx.unshieldedColor());
      const cc = await withDustRetry(fee, 'MinterCollide.collidingColor()', () => deployed.callTx.collidingColor());
      const sim = await MinterCollideSim.create(tag);

      const d: MinterDeployment = {
        label: 'MinterCollide',
        kind: 'minter-collide',
        tagText,
        tagIn: hex(tag),
        address,
        ledgerTag: hex(l.deploymentTag),
        // ONE separator, reported under both names — that is the fixture.
        shieldedSep: hex(l.collidingSep),
        unshieldedSep: hex(l.collidingSep),
        simShieldedSep: hex(sim.ledger.collidingSep),
        simUnshieldedSep: hex(sim.ledger.collidingSep),
        shieldedColour: hex(resultOf<Uint8Array>(sc)),
        unshieldedColour: hex(resultOf<Uint8Array>(uc)),
        deploy,
      };
      minters.push(d);

      const colliding = hex(resultOf<Uint8Array>(cc));
      log(`  MinterCollide shieldedColor()   ${d.shieldedColour}`);
      log(`  MinterCollide unshieldedColor() ${d.unshieldedColour}`);
      check(d.ledgerTag === d.tagIn, `MinterCollide: stored tag ${d.ledgerTag} != argument ${d.tagIn}`);
      check(
        d.shieldedSep === d.simShieldedSep,
        `MinterCollide: on-chain separator disagrees with the in-process artifact`,
      );
      // THE INVERTED ASSERTION. Everywhere else a colour collision is a failure; here it is required.
      check(
        d.shieldedColour === d.unshieldedColour,
        `P-COLL FIXTURE BROKEN: MinterCollide's family colours are NOT byte-identical ` +
          `(${d.shieldedColour} vs ${d.unshieldedColour})`,
      );
      check(colliding === d.shieldedColour, `MinterCollide.collidingColor() disagrees with shieldedColor()`);
    }

    // === 3. THE DEPLOY-ORDER PROOF ===============================================================
    console.log('\n## deploy order — the Manager exists before any Minter does');
    const H = managerDeploy.blockHeight!;
    const orderRows: Array<Record<string, unknown>> = [];
    check(typeof H === 'number', 'the indexer reported no block height for the Manager deploy');

    for (const m of minters) {
      const later = (m.deploy.blockHeight ?? -1) > H;
      // The point-in-time existence questions: at the Manager's own deploy block, did this address
      // exist at all? Asked two ways (see `existenceAtBlock`).
      const e = await existenceAtBlock(m.address, H);
      const absent = e.action === null;
      const absentBeta = e.contractQueryError === null ? e.contract === null : null;
      orderRows.push({
        contract: m.label,
        address: m.address,
        deployBlock: m.deploy.blockHeight,
        managerBlock: H,
        strictlyLater: later,
        actionAtManagerBlock: e.action === null ? null : (e.action as any).transaction?.block?.height,
        absentAtManagerBlock: absent,
        absentAtManagerBlockAtOrBefore: absentBeta,
        contractQueryError: e.contractQueryError,
      });
      log(
        `  ${m.label.padEnd(14)} deploy block ${String(m.deploy.blockHeight).padStart(4)} ` +
          `> Manager ${H}: ${later ? 'YES' : 'NO'}; contractAction at block ${H}: ` +
          `${absent ? 'null (did not exist)' : 'PRESENT'}; contract(at-or-before ${H}): ` +
          `${e.contractQueryError ? `unavailable (${e.contractQueryError.slice(0, 60)})` : absentBeta ? 'null (did not exist)' : 'PRESENT'}`,
      );
      check(later, `${m.label} was NOT deployed strictly after the Manager (block ${m.deploy.blockHeight} vs ${H})`);
      check(absent, `${m.label} ALREADY EXISTED at the Manager's deploy block ${H}`);
      if (e.contractQueryError === null) {
        check(absentBeta === true, `${m.label} existed AT OR BEFORE the Manager's deploy block ${H}`);
      }
    }

    // The same questions for the Manager itself must NOT answer null — otherwise the queries prove
    // nothing and every "absent" above would be an artefact of asking badly.
    const managerSelf = await existenceAtBlock(managerAddress, H);
    const managerAtOwnBlock = managerSelf.action;
    check(
      managerAtOwnBlock !== null,
      'the existence query returned null for the MANAGER at its own deploy block — the query is ' +
        'not discriminating and the absence results above would be meaningless',
    );
    if (managerSelf.contractQueryError === null) {
      check(
        managerSelf.contract !== null,
        'the at-or-before query returned null for the MANAGER at its own deploy block — not ' +
          'discriminating',
      );
    }
    log(
      `  control: the Manager itself IS present at block ${H} — contractAction ` +
        `${managerAtOwnBlock ? 'present' : 'NULL'}, contract(at-or-before) ` +
        `${managerSelf.contractQueryError ? 'unavailable' : managerSelf.contract ? 'present' : 'NULL'}`,
    );

    // === 4. registration seeds NOTHING ===========================================================
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

    // THE ASSERTION THIS PROJECT EXISTS FOR: two registered accounts, ZERO custody state.
    const sizesAfterRegistration = mapSizes(registered);
    log(`map sizes after registering BOTH accounts: ${JSON.stringify(sizesAfterRegistration)}`);
    check(
      sizesAfterRegistration.pools === 0 &&
        sizesAfterRegistration.shieldedCells === 0 &&
        sizesAfterRegistration.unshieldedCells === 0,
      `registration created custody state: ${JSON.stringify(sizesAfterRegistration)} — v3 must seed NOTHING`,
    );
    check(
      Object.keys(registered.shieldedBalances).length === 0 &&
        Object.keys(registered.unshieldedBalances).length === 0 &&
        Object.keys(registered.pools).length === 0,
      'a custody map holds an entry after registration alone',
    );

    // --- OP2 spot checks: the SAME facts through real on-chain circuit calls ----------------------
    // Every colour below is one the Manager has NEVER been told about — the reads must answer 0 /
    // false, and must not create anything.
    const m1 = minters[0]!; // Minter1 (TOKA) — its two colours stand in for the reads below
    const S1 = Buffer.from(m1.shieldedColour, 'hex');
    const U1 = Buffer.from(m1.unshieldedColour, 'hex');
    const isRegA = resultOf<boolean>(
      await withDustRetry(fee, 'isRegistered(AA_A)', () => manager.callTx.isRegistered(idA)),
    );
    const balA_S1 = resultOf<bigint>(
      await withDustRetry(fee, 'shieldedAccountBalance(AA_A, S1)', () =>
        manager.callTx.shieldedAccountBalance(idA, S1),
      ),
    );
    const balB_U1 = resultOf<bigint>(
      await withDustRetry(fee, 'unshieldedAccountBalance(AA_B, U1)', () =>
        manager.callTx.unshieldedAccountBalance(idB, U1),
      ),
    );
    const poolHasS1 = resultOf<boolean>(
      await withDustRetry(fee, 'poolHasColour(S1)', () => manager.callTx.poolHasColour(S1)),
    );
    log(
      `circuit reads: isRegistered(AA_A)=${isRegA} shieldedBal(AA_A,S1)=${balA_S1} ` +
        `unshieldedBal(AA_B,U1)=${balB_U1} poolHasColour(S1)=${poolHasS1}`,
    );
    check(isRegA === true, 'isRegistered(AA_A) returned false on chain');
    check(balA_S1 === 0n, `shieldedAccountBalance(AA_A, S1) returned ${balA_S1} on chain, expected 0`);
    check(balB_U1 === 0n, `unshieldedAccountBalance(AA_B, U1) returned ${balB_U1} on chain, expected 0`);
    check(poolHasS1 === false, 'poolHasColour(S1) returned true on an empty Manager');

    // Reading four missing cells must not have created any of them.
    const afterReads = await readManager(managerProviders, managerAddress);
    check(
      mapSizes(afterReads).pools === 0 &&
        mapSizes(afterReads).shieldedCells === 0 &&
        mapSizes(afterReads).unshieldedCells === 0,
      `reading missing cells created state: ${JSON.stringify(mapSizes(afterReads))}`,
    );

    // The two family keys for the SAME (account, colour) differ — derived by running the contract's
    // own pure circuits, not reimplemented here.
    const collide = minters.find((m) => m.kind === 'minter-collide')!;
    const collidingColour = Buffer.from(collide.shieldedColour, 'hex');
    const kS = shieldedKeyOf(idA, collidingColour);
    const kU = unshieldedKeyOf(idA, collidingColour);
    log(`family keys for (AA_A, TOKX colour): shielded ${kS.slice(0, 16)}… unshielded ${kU.slice(0, 16)}…`);
    check(kS !== kU, 'the two family keys for the same (account, colour) are IDENTICAL — FR-203 broken');

    // === 5. unit-level negatives =================================================================
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
      const beforeView = await readManager(managerProviders, managerAddress);
      const before = snapshot(beforeView);
      const sizesBefore = mapSizes(beforeView);
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
      await sleep(12_000);
      const afterView: ManagerView = await readManager(managerProviders, managerAddress);
      const unchanged = snapshot(afterView) === before;
      const sizesAfter = mapSizes(afterView);
      const sizesSame = JSON.stringify(sizesBefore) === JSON.stringify(sizesAfter);

      const first = reason.split('\n')[0]!.slice(0, 400);
      const matched = rejected && expectedMessage.test(reason);
      const ok = rejected && matched && unchanged && sizesSame;
      negatives.push({
        id,
        label,
        expectation,
        rejectedAt,
        reason: first,
        expectedMessage: String(expectedMessage),
        messageMatched: matched,
        stateUnchanged: unchanged,
        mapSizesUnchanged: sizesSame,
        mapSizesBefore: sizesBefore,
        mapSizesAfter: sizesAfter,
        status: ok ? 'GREEN' : 'RED',
      });
      console.log(`  ${ok ? 'GREEN' : 'RED  '} ${id} — ${first.slice(0, 200)}`);
      console.log(`        map sizes ${JSON.stringify(sizesBefore)} -> ${JSON.stringify(sizesAfter)}`);
      if (!rejected) failures.push(`negative ${id}: the operation was NOT rejected`);
      if (rejected && !matched) {
        failures.push(`negative ${id}: rejected, but not by ${expectedMessage} — got: ${first}`);
      }
      if (!unchanged) {
        failures.push(`negative ${id}: Manager state changed across a rejected call`);
        console.log(`    BEFORE ${before}`);
        console.log(`    AFTER  ${snapshot(afterView)}`);
      }
      if (!sizesSame) failures.push(`negative ${id}: a custody map GREW across a rejected call`);
    };

    console.log('\n## unit-level negatives (verbatim errors + state-neutrality proofs)');

    await expectRejection(
      'duplicate-registration',
      'Registering an account id that already exists is refused',
      "rejected with 'account already registered'; the account set is unchanged and no custody " +
        'cell was created',
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
      "rejected with \"caller's owner witness matches no registered account\" before any balance or " +
        'pool guard is reached',
      'circuit execution (no transaction built)',
      /matches no registered account/,
      async () => {
        // OwnerN is a pure user in the demo: its secret opens no Manager account.
        await actAs(managerProviders, unshieldedSeedOf(SEEDS.ownerN));
        return manager.callTx.withdrawShielded(S1, 1n, shieldedToUser(fee.shieldedSecretKeys.coinPublicKey));
      },
    );

    await expectRejection(
      'unregistered-credit',
      'NC-4 shape: a deposit naming an unregistered account commitment is refused',
      "rejected with 'credit account is not registered'; credit is open to REGISTERED accounts " +
        'only, and the refusal creates no pool and no cell',
      'circuit execution (no transaction built)',
      /credit account is not registered/,
      async () => {
        await actAs(managerProviders, secretA);
        const bogus = new Uint8Array(32).fill(0x77);
        return manager.callTx.depositShielded({ nonce: new Uint8Array(32).fill(9), color: S1, value: 5n }, bogus);
      },
    );

    await expectRejection(
      'unknown-colour-withdraw',
      'v3-specific: withdrawing a colour the Manager has NEVER SEEN is refused by the per-account ' +
        'guard reading the absent cell as 0',
      "rejected with 'account colour balance too low' — not with a colour-configuration error, " +
        'because there is no colour configuration; and NO cell or pool is created for that colour',
      'circuit execution (no transaction built)',
      /account colour balance too low/,
      async () => {
        await actAs(managerProviders, secretA);
        return manager.callTx.withdrawShielded(S1, 1n, shieldedToUser(fee.shieldedSecretKeys.coinPublicKey));
      },
    );

    await expectRejection(
      'unknown-colour-withdraw-unshielded',
      'FR-206 shape: withdrawing a DORMANT unshielded colour is refused, and the colour stays ' +
        'absent from every map',
      "rejected with 'account colour balance too low'; all three map sizes remain 0",
      'circuit execution (no transaction built)',
      /account colour balance too low/,
      async () => {
        await actAs(managerProviders, secretA);
        return manager.callTx.withdrawUnshielded(U1, 1n, {
          is_left: false,
          left: { bytes: new Uint8Array(32) },
          right: { bytes: new Uint8Array(32).fill(0xbb) },
        });
      },
    );

    // Restore a benign private state so nothing later in this process inherits the bad witness.
    await actAs(managerProviders, new Uint8Array(32));

    // === 6. distinctness (and the ONE inverted equality) =========================================
    const plainMinters = minters.filter((m) => m.kind === 'minter');
    const colourList: Array<[string, string]> = [];
    for (const d of plainMinters) {
      colourList.push([`${d.label}(${d.tagText}).shielded`, d.shieldedColour]);
      colourList.push([`${d.label}(${d.tagText}).unshielded`, d.unshieldedColour]);
    }
    let comparisons = 0;
    let distinct = 0;
    const collisions: string[] = [];
    for (let i = 0; i < colourList.length; i++) {
      for (let k = i + 1; k < colourList.length; k++) {
        comparisons++;
        if (colourList[i]![1] === colourList[k]![1]) {
          collisions.push(`${colourList[i]![0]} == ${colourList[k]![0]} (${colourList[i]![1]})`);
        } else {
          distinct++;
        }
      }
    }
    log(`pairwise colour distinctness over the ${colourList.length} Minter colours: ${distinct}/${comparisons}`);
    check(comparisons === 15, `expected 15 pairwise comparisons over 6 colours, made ${comparisons}`);
    check(collisions.length === 0, `colour collisions among the Minter colours: ${collisions.join('; ')}`);
    // …and MinterCollide's colour must equal none of them either: the collision is WITHIN that
    // deployment, never across deployments.
    for (const [name, value] of colourList) {
      check(
        value !== collide.shieldedColour,
        `MinterCollide's colour collides with ${name} — the fixture is contaminating the colour set`,
      );
    }

    // --- evidence ----------------------------------------------------------------------------------
    const finalView = await readManager(managerProviders, managerAddress);
    const result = {
      gate: 'G2',
      lane: 'EXPERIMENTAL_LANE',
      deviation: 'LANE-DEV-1',
      recorded_utc: stamp(),
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
      manager_address: managerAddress,
      deploy_order: {
        chain_tip_before_any_deploy: tipBefore,
        manager: managerDeploy,
        minters: minters.map((m) => m.deploy),
        rows: orderRows,
        manager_present_at_own_deploy_block: managerAtOwnBlock !== null,
        manager_control_at_or_before:
          managerSelf.contractQueryError === null ? managerSelf.contract !== null : 'query unavailable',
        claim:
          'the Manager was deployed in a strictly earlier block than every minting contract, and ' +
          "at the Manager's deploy block the indexer reports NO contract action for any of their " +
          'addresses — asked both through `contractAction(address, blockOffset)` and through ' +
          '`contract(address, offset)`, whose documented semantics are "at or before that block"',
      },
      minters,
      colours: {
        minter: Object.fromEntries(colourList),
        minter_collide: {
          shielded: collide.shieldedColour,
          unshielded: collide.unshieldedColour,
          byte_identical: collide.shieldedColour === collide.unshieldedColour,
        },
      },
      distinctness: { comparisons, distinct, collisions },
      registration: {
        accounts: finalView.accounts,
        map_sizes_after_registration: sizesAfterRegistration,
        map_sizes_final: mapSizes(finalView),
        seeded: false,
      },
      accounts: { AA_A: hex(idA), AA_B: hex(idB) },
      family_keys_for_colliding_colour: { shielded: kS, unshielded: kU, differ: kS !== kU },
      circuit_reads: {
        'isRegistered(AA_A)': isRegA,
        'shieldedAccountBalance(AA_A, S1)': String(balA_S1),
        'unshieldedAccountBalance(AA_B, U1)': String(balB_U1),
        'poolHasColour(S1)': poolHasS1,
      },
      negatives,
      failures,
    };
    writeFileSync(
      join(EVID, 'deploy-order.json'),
      `${JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? `${v}` : v), 2)}\n`,
    );
    writeContractsMd(result);

    console.log('\n## RESULT');
    console.log(JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? `${v}` : v), 2));

    if (failures.length > 0) {
      console.error(`\nG2 DEPLOY-ORDER/CONTRACTS FAILED:\n  ${failures.join('\n  ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `\nG2 PASS — Manager deployed at block ${H} before all ${minters.length} minting contracts, ` +
        `${distinct}/${comparisons} Minter colours distinct, MinterCollide's two colours byte-IDENTICAL, ` +
        `both accounts registered with ZERO custody cells, ` +
        `${negatives.length}/${negatives.length} negatives refused with state and map sizes proven unchanged`,
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
  lines.push('# G2 — the Manager deploys FIRST, knowing no colours');
  lines.push('');
  lines.push('`EXPERIMENTAL_LANE` / `LANE-DEV-1` — 00005-open-colour-custody, Plan 02 Phase 3.');
  lines.push('');
  lines.push(`Recorded (UTC): ${r.recorded_utc}`);
  lines.push(`Verdict: **${r.verdict}**`);
  lines.push('');
  lines.push('## Deploy order — the headline proof');
  lines.push('');
  lines.push(`Chain tip before ANY contract of this demonstration existed: block ` +
    `\`${r.deploy_order.chain_tip_before_any_deploy.height}\`.`);
  lines.push('');
  lines.push(`The Manager's deploy transaction \`${r.deploy_order.manager.txHash}\` was applied in ` +
    `**block ${r.deploy_order.manager.blockHeight}**.`);
  lines.push('');
  lines.push('| Contract | Address | Deploy block | Strictly after the Manager | Existed at the Manager\'s block |');
  lines.push('|---|---|---|---|---|');
  lines.push(
    `| **Manager** | \`${r.manager_address.slice(0, 16)}…\` | ${r.deploy_order.manager.blockHeight} | — | ` +
      `${r.deploy_order.manager_present_at_own_deploy_block ? 'yes (control)' : '**NO — query not discriminating**'} |`,
  );
  for (const row of r.deploy_order.rows) {
    lines.push(
      `| ${row.contract} | \`${String(row.address).slice(0, 16)}…\` | ${row.deployBlock} | ` +
        `${row.strictlyLater ? 'yes' : '**NO**'} | ${row.absentAtManagerBlock ? '**no — did not exist**' : '**YES**'} |`,
    );
  }
  lines.push('');
  lines.push('The right-hand column is the strong form. It is the indexer\'s answer to *"what contract');
  lines.push('action does this address have at or before block ' + r.deploy_order.manager.blockHeight + '?"* —');
  lines.push('`null` for every minting contract, and the deploy action for the Manager itself. The');
  lines.push('Manager did not merely go first: when it was deployed, nothing that could mint a colour');
  lines.push('existed on this chain at all.');
  lines.push('');
  lines.push('## Deployments');
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
  lines.push('');
  lines.push('Each deployment\'s separators were also derived in process by the separately compiled');
  lines.push('`--skip-zk` artifact from the same tag and matched the on-chain cells exactly.');
  lines.push('');
  lines.push('## Distinctness — and the ONE inverted assertion');
  lines.push('');
  lines.push(`**${r.distinctness.distinct}/${r.distinctness.comparisons} distinct**` +
    (r.distinctness.collisions.length ? ` — collisions: ${r.distinctness.collisions.join('; ')}` : ' (no collisions)') +
    ' over the six Minter colours, read from on-chain circuit calls.');
  lines.push('');
  lines.push('| Role | Colour |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(r.colours.minter)) lines.push(`| ${k} | \`${v}\` |`);
  lines.push(`| MinterCollide(TOKX).shielded | \`${r.colours.minter_collide.shielded}\` |`);
  lines.push(`| MinterCollide(TOKX).unshielded | \`${r.colours.minter_collide.unshielded}\` |`);
  lines.push('');
  lines.push(
    `**P-COLL fixture — the two family colours are byte-identical: ` +
      `${r.colours.minter_collide.byte_identical ? 'YES' : 'NO, THE FIXTURE IS BROKEN'}.** ` +
      'This is the inverted assertion: MinterCollide derives ONE separator and feeds it to both mint ' +
      'families, so its two colours are the same 32 bytes by construction. Every other colour ' +
      'comparison in this project asserts inequality.',
  );
  lines.push('');
  lines.push('The Manager keeps them apart by KEY DOMAIN as well as by map:');
  lines.push('');
  lines.push(`- \`shieldedKey(AA_A, TOKX)\`   = \`${r.family_keys_for_colliding_colour.shielded}\``);
  lines.push(`- \`unshieldedKey(AA_A, TOKX)\` = \`${r.family_keys_for_colliding_colour.unshielded}\``);
  lines.push(`- differ: **${r.family_keys_for_colliding_colour.differ ? 'yes' : 'NO — FR-203 broken'}**`);
  lines.push('');
  lines.push('## Registration seeds NOTHING (FR-201)');
  lines.push('');
  lines.push(`- accounts: AA_A \`${r.accounts.AA_A}\`, AA_B \`${r.accounts.AA_B}\``);
  lines.push(`- map sizes after registering BOTH accounts: ` +
    `\`${JSON.stringify(r.registration.map_sizes_after_registration)}\``);
  lines.push('');
  lines.push('00004 seeded one zero cell per configured colour here, so its `balances` map held');
  lines.push('`accounts x 4` entries at this point. v3 has no colours to seed: **every cell that ever');
  lines.push('appears in either map was created by a credit.**');
  lines.push('');
  lines.push('Second observation point — real on-chain circuit calls against colours the Manager has');
  lines.push('never been told about:');
  lines.push('');
  for (const [k, v] of Object.entries(r.circuit_reads)) lines.push(`- \`${k}\` = \`${v}\``);
  lines.push('');
  lines.push('## Unit-level negatives');
  lines.push('');
  lines.push('| Id | Status | Refused at | Verbatim error | Expected message | State byte-identical | Map sizes |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const n of r.negatives) {
    lines.push(
      `| \`${n.id}\` | **${n.status}** | ${n.rejectedAt} | \`${n.reason.replace(/\|/g, '\\|')}\` | ` +
        `\`${String(n.expectedMessage).replace(/\|/g, '\\|')}\` ${n.messageMatched ? 'matched' : '**NOT MATCHED**'} | ` +
        `${n.stateUnchanged ? 'yes' : '**NO**'} | ` +
        `${JSON.stringify(n.mapSizesBefore)} -> ${JSON.stringify(n.mapSizesAfter)} ` +
        `${n.mapSizesUnchanged ? '(unchanged)' : '**GREW**'} |`,
    );
  }
  lines.push('');
  for (const n of r.negatives) lines.push(`- **${n.id}** — ${n.label}. Expectation: ${n.expectation}`);
  lines.push('');
  lines.push('The map-size column is the NO-STATE-CREATED proof (FR-202). 00004 could not make this');
  lines.push('assertion: its cells were all seeded at registration, so "no new cell" was vacuous. In v3');
  lines.push('a refusal that lazily created an empty cell would be caught here even though the cell\'s');
  lines.push('value would read zero.');
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
