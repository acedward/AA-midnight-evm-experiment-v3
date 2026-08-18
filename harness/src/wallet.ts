// Wallet construction for the pinned rc4 lane.
//
// Mirrors the pinned wallet SDK's own e2e pattern (midnight-wallet @ 2.0.0-beta.2,
// packages/e2e-tests/src/tests/helpers/walletInit.ts :: initWalletWithSeed) rather than
// inventing an API: WalletFacade composes the shielded, unshielded and dust sub-wallets.
import * as ledger from '@midnightntwrk/ledger-v9';
import { InMemoryTransactionHistoryStorage, NetworkId } from '@midnightntwrk/wallet-sdk-abstractions';
import { WalletFacade, WalletEntrySchema, mergeWalletEntries } from '@midnightntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import { createKeystore, PublicKey, UnshieldedWallet } from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, type Role } from '@midnightntwrk/wallet-sdk-hd';
import * as rx from 'rxjs';
import { endpoints, readLaneEnv } from './lane.js';

// --- key derivation (pinned SDK helpers/seeds.ts) ---------------------------------------------

const deriveKey = (seed: string, role: Role): Uint8Array => {
  const res = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (res.type !== 'seedOk') throw new Error(`HDWallet.fromSeed failed: ${res.type}`);
  const { hdWallet } = res;
  const derived = hdWallet.selectAccount(0).selectRole(role).deriveKeyAt(0);
  if (derived.type === 'keyOutOfBounds') throw new Error('Key derivation out of bounds');
  hdWallet.clear();
  return derived.key;
};

export const shieldedSeedOf = (seed: string): Uint8Array => Buffer.from(deriveKey(seed, Roles.Zswap));
export const unshieldedSeedOf = (seed: string): Uint8Array => deriveKey(seed, Roles.NightExternal);
export const dustSeedOf = (seed: string): Uint8Array => deriveKey(seed, Roles.Dust);

// --- facade construction ----------------------------------------------------------------------

export type Party = {
  name: string;
  seed: string;
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: ReturnType<typeof createKeystore>;
};

export const laneConfig = () => {
  const ep = endpoints(readLaneEnv());
  const base = {
    indexerClientConnection: { indexerHttpUrl: ep.indexerHttpUrl, indexerWsUrl: ep.indexerWsUrl },
    provingServerUrl: ep.provingServerUrl,
    relayURL: ep.relayURL,
    networkId: NetworkId.NetworkId.Undeployed,
  };
  return { ep, base };
};

export const openParty = async (name: string, seed: string): Promise<Party> => {
  const { base } = laneConfig();
  const txHistoryStorage = new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries);

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(shieldedSeedOf(seed));
  const dustSecretKey = ledger.DustSecretKey.fromSeed(dustSeedOf(seed));
  const unshieldedKeystore = createKeystore(
    { kind: 'schnorr', secret: unshieldedSeedOf(seed) },
    NetworkId.NetworkId.Undeployed,
  );

  const wallet: WalletFacade = await WalletFacade.init({
    configuration: {
      ...base,
      txHistoryStorage,
      costParameters: { feeBlocksMargin: 5 },
    },
    shielded: (config: never) => ShieldedWallet(config).startWithSeed(shieldedSeedOf(seed)),
    unshielded: (config: never) =>
      UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config: never) =>
      DustWallet(config).startWithSeed(dustSeedOf(seed), ledger.LedgerParameters.initialParameters().dust),
  });

  await wallet.start(shieldedSecretKeys, dustSecretKey);
  return { name, seed, wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

/** First state snapshot (no sync requirement) — used for address reporting. */
export const snapshot = async (p: Party) => rx.firstValueFrom(p.wallet.state());

/** Wait until the unshielded view has strictly caught up, or time out. */
export const waitSynced = async (p: Party, timeoutMs = 120_000) =>
  rx.firstValueFrom(
    p.wallet.state().pipe(
      rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
      rx.timeout({ first: timeoutMs }),
    ),
  );

export const closeParty = async (p: Party) => {
  try {
    await p.wallet.stop();
  } catch {
    /* teardown must not mask the real result */
  }
};
