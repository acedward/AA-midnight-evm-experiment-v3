// G1 Phase 3 — PROBE P2, deploy half (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// The compile half (scripts/g1/probe-compile.sh) proved the pinned compactc accepts a
// `constructor(Bytes<32>)` that writes tag-derived separators into ledger cells. That is only half
// the FR-101 question. This is the other half, and it can only be answered against a live stack:
//
//   Does the PINNED midnight-js v5.0.0-beta.6 deploy path actually accept and apply constructor
//   arguments, so that ONE compiled artifact deployed TWICE with different tags yields DIFFERENT
//   colours?
//
// Method: deploy contracts/probes/p2-constructor-tag.compact twice, with tags TOKA and TOKB, then
// read each deployment back through two independent observation points:
//
//   1. the contract's LEDGER STATE, fetched from the indexer and decoded with the generated
//      `ledger()` reader   -> tag, shieldedSep, unshieldedSep
//   2. real ON-CHAIN CIRCUIT CALLS `shieldedColour()` / `unshieldedColour()`, which derive
//      `tokenType(sep, kernel.self())` inside the circuit -> the four colours
//
// PASS requires all of: each stored tag equals the argument passed; the two separators within a
// deployment differ; the separators differ ACROSS deployments; and all four colours are pairwise
// distinct (6 comparisons).
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { REPO_ROOT, SEEDS } from '../lane.js';
import { withDustRetry } from '../night.js';
import { closeParty, openParty, type Party } from '../wallet.js';
import { makeProviders, probeZkDir } from '../g3/providers.js';

// @ts-ignore — generated throwaway probe artifact
import { Contract as ProbeCtor, ledger as probeLedger } from '../../generated-probes/p2/contract/index.js';

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

/** `pad(32, s)` on the TypeScript side: right-pad the UTF-8 bytes with zeros to 32. */
const pad32 = (s: string): Uint8Array => {
  const b = Buffer.from(s, 'utf-8');
  if (b.length > 32) throw new Error(`tag "${s}" exceeds 32 bytes`);
  const out = new Uint8Array(32);
  out.set(b);
  return out;
};

const compiledProbe = () =>
  (CompiledContract.make as any)('aa00004-probe-p2', ProbeCtor).pipe(
    (CompiledContract as any).withVacantWitnesses,
    (CompiledContract as any).withCompiledFileAssets(probeZkDir('p2')),
  );

type Deployment = {
  label: string;
  tagIn: string;
  address: string;
  ledgerTag: string;
  shieldedSep: string;
  unshieldedSep: string;
  shieldedColour: string;
  unshieldedColour: string;
};

const main = async () => {
  console.log(`# PROBE P2 (deploy half) — EXPERIMENTAL_LANE / LANE-DEV-1 — ${stamp()}`);
  setNetworkId(NetworkId.NetworkId.Undeployed as any);

  const psDir = mkdtempSync(join(tmpdir(), 'aa00004-p2-'));
  log(`private-state dir: ${psDir}`);

  const parties: Party[] = [];
  const failures: string[] = [];
  const deployments: Deployment[] = [];

  try {
    const fee = await openParty('feePayer', SEEDS.feePayer);
    parties.push(fee);
    await (fee.wallet as any).waitForSyncedState();
    log('feePayer synced');

    for (const [label, tagText] of [
      ['TOKA', 'TOKA'],
      ['TOKB', 'TOKB'],
    ] as const) {
      const tag = pad32(tagText);
      log(`deploying probe P2 with constructor tag "${tagText}" (${hex(tag)}) …`);

      // THE POINT OF THE PROBE: `args` carries the constructor arguments.
      // Every submission here is fee-paying, and DUST accrues over time, so each one goes through
      // the harness's standard DUST retry rather than failing the probe for a funding reason.
      const providers = makeProviders(fee, `p2-${label}`, psDir, probeZkDir('p2'));
      const deployed: any = await withDustRetry(fee, `deploy probe P2 (${label})`, () =>
        deployContract(providers, {
          compiledContract: compiledProbe(),
          args: [tag],
        } as any),
      );

      const address = deployed.deployTxData.public.contractAddress;
      log(`  deployed at ${address}`);

      // --- observation point 1: contract ledger state via the indexer -----------------------
      const state = await providers.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state for probe deployment ${label} at ${address}`);
      const l: any = probeLedger(state.data);

      // --- observation point 2: real on-chain circuit calls ----------------------------------
      const sc = await withDustRetry(fee, `${label}.shieldedColour()`, () => deployed.callTx.shieldedColour());
      const uc = await withDustRetry(fee, `${label}.unshieldedColour()`, () => deployed.callTx.unshieldedColour());

      const d: Deployment = {
        label,
        tagIn: hex(tag),
        address,
        ledgerTag: hex(l.tag),
        shieldedSep: hex(l.shieldedSep),
        unshieldedSep: hex(l.unshieldedSep),
        shieldedColour: hex(sc.private?.result ?? sc.result),
        unshieldedColour: hex(uc.private?.result ?? uc.result),
      };
      deployments.push(d);

      log(`  ledger.tag        ${d.ledgerTag}`);
      log(`  ledger.shieldedSep   ${d.shieldedSep}`);
      log(`  ledger.unshieldedSep ${d.unshieldedSep}`);
      log(`  circuit shieldedColour()   ${d.shieldedColour}`);
      log(`  circuit unshieldedColour() ${d.unshieldedColour}`);

      // The constructor argument must have SURVIVED the deploy path unchanged.
      if (d.ledgerTag !== d.tagIn) {
        failures.push(`${label}: stored tag ${d.ledgerTag} != constructor argument ${d.tagIn}`);
      }
      if (d.shieldedSep === d.unshieldedSep) {
        failures.push(`${label}: the two family separators are identical (${d.shieldedSep})`);
      }
    }

    const [a, b] = deployments;

    // Same source, different tags -> different derived separators.
    if (a.shieldedSep === b.shieldedSep) {
      failures.push(`TOKA and TOKB derived the SAME shielded separator (${a.shieldedSep})`);
    }
    if (a.unshieldedSep === b.unshieldedSep) {
      failures.push(`TOKA and TOKB derived the SAME unshielded separator (${a.unshieldedSep})`);
    }

    // All four colours pairwise distinct — 6 comparisons.
    const colours: Array<[string, string]> = [
      ['TOKA.shielded', a.shieldedColour],
      ['TOKA.unshielded', a.unshieldedColour],
      ['TOKB.shielded', b.shieldedColour],
      ['TOKB.unshielded', b.unshieldedColour],
    ];
    let comparisons = 0;
    for (let i = 0; i < colours.length; i++) {
      for (let k = i + 1; k < colours.length; k++) {
        comparisons++;
        if (colours[i][1] === colours[k][1]) {
          failures.push(`colours ${colours[i][0]} and ${colours[k][0]} are identical (${colours[i][1]})`);
        }
      }
    }
    log(`pairwise colour distinctness: ${comparisons - failures.filter((f) => f.startsWith('colours ')).length}/${comparisons}`);

    const verdict = failures.length === 0 ? 'PASS' : 'FAIL';
    const result = {
      probe: 'P2 (deploy half)',
      lane: 'EXPERIMENTAL_LANE',
      deviation: 'LANE-DEV-1',
      question:
        'does the pinned midnight-js v5.0.0-beta.6 deploy path accept constructor arguments, so one source deployed twice yields different colours?',
      recorded_utc: stamp(),
      verdict,
      pairwise_colour_comparisons: comparisons,
      deployments,
      failures,
    };
    const out = join(REPO_ROOT, 'evidence', 'g1-lane', 'probes', 'p2-deploy.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    log(`wrote ${out}`);

    console.log('\n## RESULT');
    console.log(JSON.stringify(result, null, 2));

    if (failures.length > 0) {
      console.error(`\nPROBE P2 FAILED:\n  ${failures.join('\n  ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      '\nPROBE P2 PASS — the pinned deploy path applies constructor arguments; one source, two tags, four distinct colours',
    );
  } finally {
    for (const p of parties) await closeParty(p);
  }
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(`\nFAILED: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
    process.exit(1);
  },
);
