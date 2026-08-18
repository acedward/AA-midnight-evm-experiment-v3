// G3 — bootstrap for the step ledger: wallets, fees, deployment, colours, accounts.
//
// Everything here happens BEFORE spec step 0 is asserted, except the deployment and account
// registration, which ARE step 0. The runner asserts; this module only builds.
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDS } from '../lane.js';
import { closeParty, openParty, unshieldedSeedOf, type Party } from '../wallet.js';
import { fundWithNight, log, registerForDust, report, syncedState, units } from '../night.js';
import { compiledManager, compiledMinter } from './contracts.js';
import { ManagerSim } from '../test/sim.js';
import { managerUnshieldedLedger, readManager } from './observe.js';
import { makeComposedProofProvider, makeProviders } from './providers.js';
import type { Ctx } from './actions.js';
import type { ObserveDeps } from './table.js';

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

export type Rig = {
  fee: Party;
  ownerN: Party;
  ownerM: Party;
  ctx: Ctx;
  /** Manager providers bound to each depositor's own wallet — deposits are wallet-balanced. */
  managerN: any;
  managerM: any;
  minterAddress: string;
  managerAddress: string;
  colors: { shielded: string; unshielded: string };
  ids: { idA: string; idB: string };
  raw: { idA: Uint8Array; idB: Uint8Array; secretA: Uint8Array; secretB: Uint8Array };
  deps: ObserveDeps;
  deployTxs: { minter: string; manager: string };
  fundingTxs: Record<string, string>;
  close: () => Promise<void>;
};

/** Set the owner secret the Manager's witness reads on the next call made through `providers`. */
const actAs = async (providers: any, secret: Uint8Array): Promise<void> => {
  await providers.privateStateProvider.set('manager', { ownerSecret: secret });
};

export const bootstrap = async (): Promise<Rig> => {
  setNetworkId(NetworkId.NetworkId.Undeployed as any);
  const psDir = mkdtempSync(join(tmpdir(), 'aa00003-ps-'));
  const opened: Party[] = [];
  const close = async () => {
    for (const p of opened) await closeParty(p);
  };

  try {
    // --- wallets --------------------------------------------------------------------------------
    const genesis = await openParty('genesis', SEEDS.genesis);
    opened.push(genesis);
    const fee = await openParty('feePayer', SEEDS.feePayer);
    opened.push(fee);
    const ownerN = await openParty('ownerN', SEEDS.ownerN);
    opened.push(ownerN);
    const ownerM = await openParty('ownerM', SEEDS.ownerM);
    opened.push(ownerM);
    log('wallets open; syncing genesis …');
    report('genesis', await syncedState(genesis));

    // --- fees: NIGHT + DUST for every wallet that submits a transaction --------------------------
    // OwnerN and OwnerM submit their own transfers and deposits, so they need their own DUST.
    // NIGHT and DUST never appear in the demo balance table (spec FR-006).
    const fundingTxs: Record<string, string> = {};
    fundingTxs.feePayer = await fundWithNight(genesis, fee, units(1_000_000n));
    fundingTxs.feePayerDust = await registerForDust(fee);
    fundingTxs.ownerN = await fundWithNight(fee, ownerN, units(200_000n));
    fundingTxs.ownerM = await fundWithNight(fee, ownerM, units(200_000n));
    fundingTxs.ownerNDust = await registerForDust(ownerN);
    fundingTxs.ownerMDust = await registerForDust(ownerM);
    report('feePayer', await syncedState(fee));
    report('ownerN', await syncedState(ownerN));
    report('ownerM', await syncedState(ownerM));

    // --- deployment (spec step 0, part 1) --------------------------------------------------------
    const minterProviders = makeProviders(fee, 'minter', psDir);
    log('deploying Minter …');
    const minter: any = await deployContract(minterProviders, { compiledContract: compiledMinter() } as any);
    const minterAddress = minter.deployTxData.public.contractAddress;
    const minterDeployTx = String(minter.deployTxData.public.txId ?? minter.deployTxData.public.txHash ?? '');
    log(`Minter  ${minterAddress}`);

    const managerFee = makeProviders(fee, 'manager', psDir);
    log('deploying Manager …');
    const manager: any = await deployContract(managerFee, {
      compiledContract: compiledManager(),
      privateStateId: 'manager',
      initialPrivateState: { ownerSecret: new Uint8Array(32) },
    } as any);
    const managerAddress = manager.deployTxData.public.contractAddress;
    const managerDeployTx = String(manager.deployTxData.public.txId ?? manager.deployTxData.public.txHash ?? '');
    log(`Manager ${managerAddress}`);

    // --- the Minter's two colours, and binding the Manager to them --------------------------------
    const shieldedColor: Uint8Array = (await minter.callTx.shieldedColor()).private.result;
    const unshieldedColor: Uint8Array = (await minter.callTx.unshieldedColor()).private.result;
    if (hex(shieldedColor) === hex(unshieldedColor)) {
      throw new Error('STEP 0 DIVERGENCE — the Minter colours are identical; families must be independent identifiers');
    }
    log(`colours: shielded ${hex(shieldedColor)} / unshielded ${hex(unshieldedColor)}`);
    await manager.callTx.configure(shieldedColor, unshieldedColor);

    // --- register AA_A (OwnerA) and AA_B (OwnerB) --------------------------------------------------
    // `myAccount` is ledger-free, so the compiler emits no proving key for it and it is not a
    // callTx. The account id is derived IN PROCESS by running the very same compiled circuit
    // through the simulator, so the artifact stays the single source of truth for the commitment
    // scheme, which is never reimplemented off-chain.
    const sim = await ManagerSim.create(new Uint8Array(32));
    const secretA = unshieldedSeedOf(SEEDS.ownerA);
    const secretB = unshieldedSeedOf(SEEDS.ownerB);
    const idA = await sim.ownerCommitmentFor(secretA);
    const idB = await sim.ownerCommitmentFor(secretB);
    await actAs(managerFee, secretA);
    await manager.callTx.registerAccount(idA);
    await actAs(managerFee, secretB);
    await manager.callTx.registerAccount(idB);
    log(`AA_A ${hex(idA)} / AA_B ${hex(idB)} registered`);

    // --- providers for the depositors' own wallets --------------------------------------------------
    // A user deposit is balanced by the DEPOSITOR's wallet, so the Manager call has to be made
    // through providers bound to that wallet. `depositShielded`/`depositUnshielded` never call the
    // owner witness, so the private state only has to exist.
    const managerN = makeProviders(ownerN, 'manager', psDir);
    const managerM = makeProviders(ownerM, 'manager', psDir);
    // The private-state store scopes every entry by contract address, and only `deployContract`
    // sets that automatically. Providers built for a contract deployed by someone else must be
    // told which contract they are for before their store can be read or written.
    for (const p of [managerN, managerM, managerFee]) {
      p.privateStateProvider.setContractAddress(managerAddress);
    }
    await actAs(managerN, new Uint8Array(32));
    await actAs(managerM, new Uint8Array(32));

    const ctx: Ctx = {
      minterAddress,
      managerAddress,
      shieldedColor,
      unshieldedColor,
      compiledMinter,
      compiledManager,
      minterProviders,
      managerFee,
      composedProof: makeComposedProofProvider(),
      actAs,
    };

    const colors = { shielded: hex(shieldedColor), unshielded: hex(unshieldedColor) };
    const deps: ObserveDeps = {
      managerProviders: managerFee,
      managerAddress,
      colors,
      ids: { idA: hex(idA), idB: hex(idB) },
      ownerN,
      ownerM,
      readManager,
      managerUnshieldedLedger,
    };

    return {
      fee,
      ownerN,
      ownerM,
      ctx,
      managerN,
      managerM,
      minterAddress,
      managerAddress,
      colors,
      ids: { idA: hex(idA), idB: hex(idB) },
      raw: { idA, idB, secretA, secretB },
      deps,
      deployTxs: { minter: minterDeployTx, manager: managerDeployTx },
      fundingTxs,
      close,
    };
  } catch (e) {
    await close();
    throw e;
  }
};
