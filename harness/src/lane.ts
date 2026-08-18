// Lane configuration for 00003-contract-token-custody — EXPERIMENTAL_LANE (v2.0.0-rc.4 slot).
//
// Endpoints come from docker/.env, produced by scripts/g1/probe-ports.sh. Nothing here is
// hard-coded to a port, so a fresh clone reproduces with whatever free ports it probes.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');

export const LANE_LABEL = 'EXPERIMENTAL_LANE';
export const LANE_DEVIATIONS = ['LANE-DEV-1 (compactc-v0.33.0 substituted for -rc.2; owner-approved)'];

export type LaneEnv = {
  composeProject: string;
  nodeRpcPort: number;
  indexerPort: number;
  proofServerPort: number;
};

export const readLaneEnv = (): LaneEnv => {
  const raw = readFileSync(join(REPO_ROOT, 'docker', '.env'), 'utf-8');
  const map = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    map.set(t.slice(0, i), t.slice(i + 1));
  }
  const need = (k: string): string => {
    const v = map.get(k);
    if (!v) throw new Error(`docker/.env is missing ${k} — run scripts/g1/probe-ports.sh`);
    return v;
  };
  return {
    composeProject: need('COMPOSE_PROJECT_NAME'),
    nodeRpcPort: Number(need('PORT_NODE_RPC')),
    indexerPort: Number(need('PORT_INDEXER')),
    proofServerPort: Number(need('PORT_PROOF_SERVER')),
  };
};

export const endpoints = (env: LaneEnv) => ({
  indexerHttpUrl: `http://127.0.0.1:${env.indexerPort}/api/v4/graphql`,
  indexerWsUrl: `ws://127.0.0.1:${env.indexerPort}/api/v4/graphql/ws`,
  provingServerUrl: new URL(`http://127.0.0.1:${env.proofServerPort}`),
  relayURL: new URL(`ws://127.0.0.1:${env.nodeRpcPort}`),
  nodeHttpUrl: `http://127.0.0.1:${env.nodeRpcPort}`,
});

// Demo parties. The genesis seed (…0001) is the funded wallet on a fresh `undeployed` network,
// per the pinned wallet SDK's own e2e suite (helpers/seeds.ts + fundedWallet.undeployed.test.ts).
export const SEEDS = {
  genesis: '0000000000000000000000000000000000000000000000000000000000000001',
  // Fee payer is disjoint from every balance under test (spec FR-006 / fee isolation).
  feePayer: '00000000000000000000000000000000000000000000000000000000000000f1',
  ownerN: '00000000000000000000000000000000000000000000000000000000000000a1',
  ownerM: '00000000000000000000000000000000000000000000000000000000000000a2',
  ownerA: '00000000000000000000000000000000000000000000000000000000000000b1',
  ownerB: '00000000000000000000000000000000000000000000000000000000000000b2',
} as const;

export type PartyName = keyof typeof SEEDS;
