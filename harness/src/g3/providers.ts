// G3 — midnight-js provider wiring backed by the pinned wallet SDK (EXPERIMENTAL_LANE).
//
// midnight-js needs six providers. Four are stock; the two that must be bridged to the wallet are
// `walletProvider.balanceTx` and `midnightProvider.submitTx`, which we implement with the pinned
// wallet facade's own `balanceUnboundTransaction` -> `signRecipe` -> `finalizeRecipe` ->
// `submitTransaction` pipeline (the same pipeline G1 proved end to end).
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { recordTxSize, timedProofProvider } from './metrics.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { endpoints, readLaneEnv, REPO_ROOT } from '../lane.js';
import type { Party } from '../wallet.js';

/**
 * Where scripts/g2/compile.sh --zk puts prover/verifier keys and zkir.
 *
 * `contract` is a plain string rather than a union because a deployment's artifact directory is
 * chosen per DEPLOYMENT (five Minter deployments share `minter`, MinterCollide has its own), not
 * per provider name.
 */
export const zkDir = (contract: string) => join(REPO_ROOT, 'harness', 'generated-zk', contract);

const TTL_MS = 30 * 60 * 1000;

// The private-state store is encrypted at rest. This project's private state is disposable local
// test state, so the password is generated per process and never written to disk or evidence.
// midnight-js-utils enforces >=3 character classes, so a bare hex string is rejected.
const EPHEMERAL_PRIVATE_STORE_PASSWORD = `Aa1!${randomBytes(24).toString('base64url')}`;

export const makeProviders = (
  party: Party,
  contract: string,
  privateStateDir: string,
  /** Override the ZK artifact directory (the G1 probes compile outside `generated-zk`). */
  zkArtifactDir: string = zkDir(contract),
) => {
  const ep = endpoints(readLaneEnv());
  const facade: any = party.wallet;
  // The proof provider needs the ZK config to look up prover keys per circuit.
  const zkConfigProvider = new NodeZkConfigProvider(zkArtifactDir);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: join(privateStateDir, `${party.name}-${contract}`),
      privateStoragePasswordProvider: () => EPHEMERAL_PRIVATE_STORE_PASSWORD,
      // Scopes the store per party so one party's private state can never be read as another's.
      accountId: `${party.name}-${contract}`,
    }),
    publicDataProvider: indexerPublicDataProvider(ep.indexerHttpUrl, ep.indexerWsUrl),
    zkConfigProvider,
    proofProvider: timedProofProvider(httpClientProofProvider(ep.provingServerUrl.toString(), zkConfigProvider as any)),

    walletProvider: {
      /** Balance an unbound (proven, pre-binding) transaction into a submittable one. */
      balanceTx: async (tx: any, ttl?: Date) => {
        const recipe = await facade.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys: party.shieldedSecretKeys, dustSecretKey: party.dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + TTL_MS) },
        );
        // Unshielded segments need the keystore signature before finalisation; signing a recipe
        // with no unshielded segment is a no-op, so this is safe for every transaction shape.
        const signed = await facade.signRecipe(recipe, (party.unshieldedKeystore as any).signDataAsync);
        return await facade.finalizeRecipe(signed);
      },
      getCoinPublicKey: () => party.shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => party.shieldedSecretKeys.encryptionPublicKey,
    },

    midnightProvider: {
      submitTx: async (tx: any) => {
        recordTxSize(`${party.name}/${contract}`, tx);
        return await facade.submitTransaction(tx);
      },
    },
  } as any;
};

// A `ZKConfigRegistry`-backed proof provider — one artifact source per compiled contract, selected
// by DEPLOYED verifier-key hash rather than by circuit name — used to live here for transactions
// whose single intent spanned several contracts (00003's R8 / 00004's probe M1 round 1). 00005 has
// no such transaction: probe M3's two calls are both on the Manager and are proved by the Manager's
// own provider, and every mint is a single call on its own issuer. The registry helper was removed
// with the one-Intent composer it served (see `archive/00004/ARCHIVE.md`); each deployment simply
// gets `makeProviders(..., zkDir(kind))` with the artifact directory its verifier keys live in,
// which is what keeps `minter` and `minter-collide` apart even though they deliberately share
// circuit NAMES (finding F-201: a verifier key identifies a circuit shape, not a contract).
