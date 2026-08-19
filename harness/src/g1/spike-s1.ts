// SPIKE S1 — can a FOREIGN wallet balance and submit a transaction containing a CONTRACT CALL?
// Plan 01 Phase 2. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// This is the single most load-bearing unknown in the whole project. Everything 00005 ever submitted
// was `merge(contract-call tx, balancing tx)` — but always by the SAME wallet that built the call.
// 00006 needs a DIFFERENT wallet to do the balancing, and the only prior contract-mediated attempt in
// this lane's history (Offer Files, 2026-08-15, scratch `fallibleProbe` circuit) died inside the PROOF
// SERVER with `Failed to check: bad input`. So: budget for the proof server, and record verbatim.
//
// THE EXPERIMENT
//
//   builder = OwnerN.  Builds `depositShielded({nonce, S_A, v}, AA_A)` and PROVES it. Then stops.
//                      It never balances, never signs, never submits, and it holds no S_A at all —
//                      so it could not have funded the coin even if it wanted to.
//   taker   = OwnerT.  A wallet whose seed appears nowhere in the builder's providers. It holds S_A
//                      and DUST. It runs ONLY stock facade calls (FR-303) and submits.
//
// Both facade entry points are exercised, on two independent artifacts (same colour, different nonces
// and values, so neither can be confused with the other and neither replays the other's coin):
//
//   S1a  unbound: validate(f,f,f) -> balanceUnboundTransaction -> signRecipe -> finalizeRecipe -> submit
//   S1b  bound:   bind() -> validate(f,t,f) -> balanceFinalizedTransaction -> signRecipe -> ... -> submit
//
// GREEN = the deposit LANDS, credited per the circuit, with the FOREIGN wallet's coins spent.
//
// OBSERVATION (F-104: the submitting wallet is never an observation point)
//   OP1  the Manager's ledger state, fetched from the indexer and decoded (`manager-view.ts`).
//   OP2  a real proved on-chain circuit call, `shieldedAccountBalance(AA_A, S_A)`.
//   taker side: a FRESH read-only facade on OwnerT's seed, which has never submitted anything.
import * as ledger from '@midnightntwrk/ledger-v9';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_STAMP, REPO_ROOT, SEEDS } from '../lane.js';
import { closeParty, shieldedSeedOf, type Party } from '../wallet.js';
import { log, syncedState } from '../night.js';
import { errorChain, mintShieldedToUser } from '../g3/actions.js';
import { mapSizes, shieldedKeyOf } from '../manager-view.js';
import { bootstrapSpikeRig, type SpikeRig } from './spike-rig.js';
import { buildMakerDeposit, type MakerArtifact } from './maker.js';
import { settleAsTaker, type SettlementResult } from './taker.js';

const EVID = join(REPO_ROOT, 'evidence', 'g1-spikes');
const stamp = () => new Date().toISOString();
const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? String(v) : v);

const MINT_TO_TAKER = 10n;
const S1A_VALUE = 3n;
const S1B_VALUE = 2n;

type LegResult = {
  id: string;
  route: 'unbound' | 'bound';
  value: string;
  nonce: string;
  makerPlacement: unknown;
  makerHasDustActions: boolean;
  makerIdentifiers: string[];
  settlement: SettlementResult;
  after?: {
    mapSizes: Record<string, number>;
    poolValue: string;
    cellKey: string;
    cellValue: string;
    onChainCell: string;
    onChainTx: string;
    takerShieldedBalance: string;
  };
};

/** Does this transaction carry ANY dust action? The maker must attach none (FR-301). */
const hasDustActions = (tx: any): boolean => {
  try {
    for (const [, intent] of (tx.intents ?? new Map()) as Map<number, any>) {
      const da = intent?.dustActions;
      if (!da) continue;
      const spends = da.spends?.length ?? 0;
      const regs = da.registrations?.length ?? 0;
      if (spends > 0 || regs > 0) return true;
    }
  } catch {
    /* absence of the accessor is not evidence of presence */
  }
  return false;
};

const takerShieldedBalance = async (rig: SpikeRig, colourHex: string): Promise<bigint> => {
  // A FRESH facade on OwnerT's seed — the wallet that submitted must not report its own balance.
  const obs: Party = await rig.openObserver('OwnerT', SEEDS.ownerT);
  try {
    const st: any = await syncedState(obs);
    return BigInt(st?.shielded?.balances?.[colourHex] ?? 0n);
  } finally {
    await closeParty(obs);
  }
};

const main = async () => {
  mkdirSync(EVID, { recursive: true });
  console.log(`# SPIKE S1 — foreign wallet balances a contract-call transaction — ${LANE_STAMP} — ${stamp()}`);

  const rig = await bootstrapSpikeRig({ withTaker: true });
  const legs: LegResult[] = [];
  let verdict = 'RED';
  let note = '';

  try {
    // --- one issuer, one shielded colour, minted to the FOREIGN wallet -------------------------------
    const toka = await rig.deployMinter('Minter1', 'TOKA');
    const S_A = toka.shieldedRaw;
    const S_A_hex = toka.shieldedColour;

    // Minting needs only the RECIPIENT'S PUBLIC keys (coin pk to address it, encryption pk to encrypt
    // the output to them), and both are derived from the seed — so no facade is opened for OwnerT
    // here. `mintShieldedToUser` is 00005's own action, driven unchanged.
    const takerKeys = { shieldedSecretKeys: ledger.ZswapSecretKeys.fromSeed(shieldedSeedOf(SEEDS.ownerT)) };
    const mintTx = await mintShieldedToUser(rig.ctx, 'Minter1', MINT_TO_TAKER, takerKeys as any, rig.fee);
    log(`minted ${MINT_TO_TAKER} S_A to OwnerT in ${mintTx}`);

    const heldBeforeAnyDeposit = await takerShieldedBalance(rig, S_A_hex);
    log(`OwnerT holds ${heldBeforeAnyDeposit} S_A before any deposit (read from a fresh observer)`);
    if (heldBeforeAnyDeposit < S1A_VALUE + S1B_VALUE) {
      throw new Error(`the mint did not land: OwnerT holds ${heldBeforeAnyDeposit} S_A, need ${S1A_VALUE + S1B_VALUE}`);
    }

    const before = await rig.readManagerNow();
    log(`Manager custody maps before any deposit: ${JSON.stringify(mapSizes(before))}`);
    if (mapSizes(before).pools !== 0) throw new Error('the Manager already holds a pool — the spike would prove nothing');

    // --- the two legs -------------------------------------------------------------------------------
    const plan: Array<{ id: string; route: 'unbound' | 'bound'; value: bigint }> = [
      { id: 'S1a', route: 'unbound', value: S1A_VALUE },
      { id: 'S1b', route: 'bound', value: S1B_VALUE },
    ];

    let expectedPool = 0n;
    for (const leg of plan) {
      console.log(`\n## ${leg.id} — ${leg.route} route, ${leg.value} S_A`);

      // MAKER: build + prove + STOP. Built with the BUILDER's providers only.
      const artifact: MakerArtifact = await buildMakerDeposit({
        providers: rig.builderManagerProviders,
        managerAddress: rig.managerAddress,
        colour: S_A,
        value: leg.value,
        account: rig.raw.AA_A,
      });
      const makerDust = hasDustActions(artifact.proven);
      log(`${leg.id}: maker artifact proven; imbalances(0) = ${JSON.stringify(artifact.placement.imbalances['0'])}`);
      log(`${leg.id}: maker attached dust actions: ${makerDust} (FR-301 requires false)`);
      if (makerDust) throw new Error(`${leg.id}: the maker attached DUST — FR-301 forbids it`);

      // The Manager must still be untouched: proving is off-chain.
      const midway = await rig.readManagerNow();
      if (JSON.stringify(mapSizes(midway)) !== JSON.stringify(mapSizes(before)) && legs.length === 0) {
        throw new Error(`${leg.id}: proving the maker artifact changed on-chain state`);
      }

      // TAKER: a FRESH facade on OwnerT that can already see the coins it must spend (F-107).
      const spender = await rig.openSpender('OwnerT', SEEDS.ownerT, [
        { colour: S_A_hex, shielded: true, amount: leg.value },
      ]);
      let settlement: SettlementResult;
      try {
        settlement = await settleAsTaker(spender.party, artifact.proven, leg.route, { label: leg.id });
      } finally {
        await spender.close();
      }

      const result: LegResult = {
        id: leg.id,
        route: leg.route,
        value: String(leg.value),
        nonce: Buffer.from(artifact.nonce).toString('hex'),
        makerPlacement: artifact.placement,
        makerHasDustActions: makerDust,
        makerIdentifiers: artifact.identifiers,
        settlement,
      };

      if (!settlement.ok) {
        log(`${leg.id}: REFUSED — verbatim: ${settlement.error}`);
        legs.push(result);
        continue;
      }

      log(`${leg.id}: submitted ${settlement.txId} (hash ${settlement.txHash})`);
      expectedPool += leg.value;
      const cellKey = shieldedKeyOf(rig.raw.AA_A, S_A);
      const after = await rig.waitForManagerNow(
        (m) => (m.pools[S_A_hex]?.value ?? 0n) === expectedPool && (m.shieldedBalances[cellKey] ?? 0n) === expectedPool,
        `${leg.id}: pool(S_A) and (AA_A,S_A) to reach ${expectedPool}`,
      );
      const onChain = await rig.onChainShieldedCell(rig.raw.AA_A, S_A);
      const takerHeld = await takerShieldedBalance(rig, S_A_hex);

      result.after = {
        mapSizes: mapSizes(after),
        poolValue: String(after.pools[S_A_hex]?.value ?? 0n),
        cellKey,
        cellValue: String(after.shieldedBalances[cellKey] ?? 0n),
        onChainCell: String(onChain.value),
        onChainTx: onChain.txish,
        takerShieldedBalance: String(takerHeld),
      };
      log(
        `${leg.id}: pool(S_A)=${result.after.poolValue} cell=${result.after.cellValue} ` +
          `onChain=${result.after.onChainCell} OwnerT holds ${takerHeld} S_A; maps ${JSON.stringify(result.after.mapSizes)}`,
      );

      if (onChain.value !== expectedPool) {
        throw new Error(`${leg.id}: OP2 disagrees with OP1 (${onChain.value} vs ${expectedPool})`);
      }
      const expectedTakerHeld = MINT_TO_TAKER - expectedPool;
      if (takerHeld !== expectedTakerHeld) {
        throw new Error(
          `${leg.id}: the FOREIGN wallet's coins were not the ones spent — OwnerT holds ${takerHeld} S_A, expected ${expectedTakerHeld}`,
        );
      }
      legs.push(result);
    }

    const ok = legs.filter((l) => l.settlement.ok);
    const green = ok.length > 0;
    verdict = green ? 'GREEN' : 'RED';
    note = green
      ? `a foreign wallet CAN balance and submit a contract-call transaction on this lane; working route(s): ${ok
          .map((l) => `${l.id}/${l.route}`)
          .join(', ')}`
      : 'NO route worked — every settlement was refused; see the verbatim errors';

    const payload = {
      spike: 'S1',
      label: LANE_STAMP,
      utc: stamp(),
      question: 'can a wallet that did NOT build a contract-call transaction balance it and submit it?',
      shape: 'Manager v3 depositShielded — receiveShielded creates a shielded deficit at segment 0, exactly the swap offer\'s −B leg',
      builder: 'OwnerN (builds + proves only; never balances, signs or submits; holds no S_A)',
      taker: 'OwnerT (stock facade calls only; a fresh facade per submission, F-104)',
      managerAddress: rig.managerAddress,
      minter: { label: toka.label, tag: toka.tagText, address: toka.address, shieldedColour: S_A_hex },
      accounts: rig.ids,
      mintToTaker: String(MINT_TO_TAKER),
      mintTx,
      mapSizesBefore: mapSizes(before),
      legs,
      verdict,
      note,
    };
    writeFileSync(join(EVID, 's1-foreign-balance.json'), `${JSON.stringify(payload, bigints, 2)}\n`);

    // --- the human-readable evidence file -----------------------------------------------------------
    const md: string[] = [];
    md.push(`# SPIKE S1 — a FOREIGN wallet balances a contract-call transaction`);
    md.push('');
    md.push(`\`${LANE_STAMP}\` · recorded ${stamp()}`);
    md.push('');
    md.push(`**VERDICT: ${verdict}** — ${note}`);
    md.push('');
    md.push('## What was actually run');
    md.push('');
    md.push('| Role | Wallet | What it did |');
    md.push('|---|---|---|');
    md.push('| maker / builder | OwnerN | `createUnprovenCallTx(depositShielded)` → `proveTx` → **stop**. Never balanced, signed or submitted; holds no S_A |');
    md.push('| taker | OwnerT | stock facade only: `validateTransaction` → balance → `signRecipe` → `finalizeRecipe` → `submitTransaction` |');
    md.push('| fee wallet | feePayer | deploys, mints and the on-chain circuit reads. Holds none of the colour under test |');
    md.push('');
    md.push(`Manager v3 (UNCHANGED from 00005) at \`${rig.managerAddress}\`; issuer \`${toka.label}\` (\`${toka.tagText}\`) at \`${toka.address}\`; colour S_A \`${S_A_hex}\`.`);
    md.push(`AA_A \`${rig.ids.AA_A}\`, AA_B \`${rig.ids.AA_B}\`. ${MINT_TO_TAKER} S_A minted to OwnerT in \`${mintTx}\`.`);
    md.push('');
    md.push('## Result per route');
    md.push('');
    md.push('| Leg | Facade entry point | Outcome | tx id | pool(S_A) | (AA_A,S_A) | OP2 on-chain read | OwnerT S_A |');
    md.push('|---|---|---|---|---|---|---|---|');
    for (const l of legs) {
      const ep = l.route === 'unbound' ? '`balanceUnboundTransaction`' : '`bind()` + `balanceFinalizedTransaction`';
      md.push(
        `| ${l.id} (${l.value} S_A) | ${ep} | ${l.settlement.ok ? '**ACCEPTED**' : 'REFUSED'} | ` +
          `${l.settlement.txId ? `\`${l.settlement.txId}\`` : '—'} | ${l.after?.poolValue ?? '—'} | ` +
          `${l.after?.cellValue ?? '—'} | ${l.after?.onChainCell ?? '—'} | ${l.after?.takerShieldedBalance ?? '—'} |`,
      );
    }
    md.push('');
    md.push('## FR-302 placement, per maker artifact');
    md.push('');
    md.push('Read for EVERY segment the transaction has, never assumed (lane issue 0003).');
    md.push('');
    md.push('| Leg | segments | intent segments | imbalances(0) | other segments carrying deltas |');
    md.push('|---|---|---|---|---|');
    for (const l of legs) {
      const p: any = l.makerPlacement;
      md.push(
        `| ${l.id} | ${JSON.stringify(p.segments)} | ${JSON.stringify(p.intentSegments)} | ` +
          `\`${JSON.stringify(p.imbalances['0'])}\` | ${p.offendingSegments.length ? p.offendingSegments.join('; ') : 'none' } |`,
      );
    }
    md.push('');
    md.push('## Verbatim refusals (F-202 clean — stack frames stripped)');
    md.push('');
    const refused = legs.filter((l) => !l.settlement.ok);
    if (refused.length === 0) {
      md.push('None: every route was accepted.');
    } else {
      for (const l of refused) {
        md.push(`- **${l.id} / ${l.route}**: \`${l.settlement.error}\``);
      }
    }
    md.push('');
    md.push('## Validation outcomes (the facade\'s own `validateTransaction`)');
    md.push('');
    md.push('| Leg | flags | passed | error |');
    md.push('|---|---|---|---|');
    for (const l of legs) {
      for (const v of l.settlement.validations) {
        md.push(`| ${l.id} | \`${JSON.stringify(v.flags)}\` | ${v.passed} | ${v.error ? `\`${v.error}\`` : '—'} |`);
      }
    }
    md.push('');
    md.push('## Maker DUST');
    md.push('');
    for (const l of legs) {
      md.push(`- ${l.id}: maker artifact carries dust actions = \`${l.makerHasDustActions}\` (FR-301 requires \`false\`)`);
    }
    md.push('');
    writeFileSync(join(EVID, 'S1.md'), `${md.join('\n')}\n`);

    console.log(`\n## S1 VERDICT: ${verdict} — ${note}`);
    if (!green) process.exitCode = 1;
  } catch (e) {
    const err = errorChain(e);
    console.error(`\nS1 FAILED: ${err}`);
    writeFileSync(
      join(EVID, 's1-foreign-balance.json'),
      `${JSON.stringify({ spike: 'S1', label: LANE_STAMP, utc: stamp(), verdict: 'RED', fatal: err, legs }, bigints, 2)}\n`,
    );
    writeFileSync(
      join(EVID, 'S1.md'),
      `# SPIKE S1 — a FOREIGN wallet balances a contract-call transaction\n\n\`${LANE_STAMP}\` · recorded ${stamp()}\n\n**VERDICT: RED (fatal)**\n\nVerbatim:\n\n\`\`\`\n${err}\n\`\`\`\n`,
    );
    process.exitCode = 1;
  } finally {
    await rig.close();
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
