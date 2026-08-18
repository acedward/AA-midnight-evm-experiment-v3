// G3 — midnight-js provider wiring backed by the pinned wallet SDK (EXPERIMENTAL_LANE).
//
// midnight-js needs six providers. Four are stock; the two that must be bridged to the wallet are
// `walletProvider.balanceTx` and `midnightProvider.submitTx`, which we implement with the pinned
// wallet facade's own `balanceUnboundTransaction` -> `signRecipe` -> `finalizeRecipe` ->
// `submitTransaction` pipeline (the same pipeline G1 proved end to end).
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ZKConfigRegistry } from '@midnight-ntwrk/midnight-js-types';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { endpoints, readLaneEnv, REPO_ROOT } from '../lane.js';
import type { Party } from '../wallet.js';

/** Where scripts/g2/compile.sh --zk puts prover/verifier keys and zkir. */
export const zkDir = (contract: 'minter' | 'manager' | '_combined') => join(REPO_ROOT, 'harness', 'generated-zk', contract);

const TTL_MS = 30 * 60 * 1000;

// The private-state store is encrypted at rest. This project's private state is disposable local
// test state, so the password is generated per process and never written to disk or evidence.
// midnight-js-utils enforces >=3 character classes, so a bare hex string is rejected.
const EPHEMERAL_PRIVATE_STORE_PASSWORD = `Aa1!${randomBytes(24).toString('base64url')}`;

export const makeProviders = (party: Party, contract: 'minter' | 'manager' | '_combined', privateStateDir: string) => {
  const ep = endpoints(readLaneEnv());
  const facade: any = party.wallet;
  // The proof provider needs the ZK config to look up prover keys per circuit.
  const zkConfigProvider = new NodeZkConfigProvider(zkDir(contract));

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: join(privateStateDir, `${party.name}-${contract}`),
      privateStoragePasswordProvider: () => EPHEMERAL_PRIVATE_STORE_PASSWORD,
      // Scopes the store per party so one party's private state can never be read as another's.
      accountId: `${party.name}-${contract}`,
    }),
    publicDataProvider: indexerPublicDataProvider(ep.indexerHttpUrl, ep.indexerWsUrl),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(ep.provingServerUrl.toString(), zkConfigProvider as any),

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
      submitTx: async (tx: any) => await facade.submitTransaction(tx),
    },
  } as any;
};

/**
 * Proof provider for a transaction whose single intent spans BOTH contracts (ledger-level
 * composition — see `ledger-compose.ts`).
 *
 * A flattened "all keys in one directory" provider does NOT work: each call's key location embeds
 * the hash of its DEPLOYED verifier key, and resolution joins on that hash rather than on the
 * circuit name. `ZKConfigRegistry` is the pinned SDK's own answer — it takes one artifact source
 * per compiled contract and selects the source whose verifier key matches, which is immune to the
 * `mintShieldedTo`-style name collisions between our two contracts.
 */
export const makeComposedProofProvider = () => {
  const ep = endpoints(readLaneEnv());
  const registry = new ZKConfigRegistry([
    new NodeZkConfigProvider(zkDir('minter')),
    new NodeZkConfigProvider(zkDir('manager')),
  ]);
  return httpClientProofProvider(ep.provingServerUrl.toString(), registry as any);
};
