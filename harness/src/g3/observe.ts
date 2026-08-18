// G3 — the raw observation points behind the 16-cell table (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// `table.ts` composes these into the spec's 4-party x 4-colour table; this module only READS.
//
// FR-108 requires two independent observation points wherever the rails allow. What exists on this
// pinned lane, per party class:
//
//   AA_A / AA_B (Manager-held, per colour)
//     1. the Manager's `balances` map, decoded from contract state (`src/manager-view.ts`)
//     2. the CUSTODY side of the same colour — the pooled zswap coin for a shielded colour, or the
//        LEDGER KERNEL's unshielded balance for an unshielded one. Neither is written by the same
//        code that writes `balances`, so the per-colour invariant
//        `custody[c] == Σ_account balances[(account, c)]` is a real cross-check.
//     3. (rotating, once per step) a real ON-CHAIN `accountBalance(account, colour)` circuit call —
//        a proved transaction whose result comes back through the SDK, not through a state decode.
//
//   OwnerN / OwnerM (user-held, per colour)
//     1. a wallet SDK state — read from an OBSERVER wallet that has never submitted a transaction.
//        **F-104 discipline (00004 G1):** on this lane the wallet that SUBMITTED a transaction
//        under-reports its own balance indefinitely while still returning
//        `progress.isStrictlyComplete() === true`. A submitting wallet is therefore never an
//        observation point here; the observers are separate facade instances on the same seeds that
//        only ever read, and can be re-opened if they ever fall behind.
//     2. unshielded — the UTXO set RECONSTRUCTED from the indexer's own transaction history, per
//        colour, independent of any wallet. (The pinned indexer v4.4.0-rc.1 has no per-address
//        balance query at all — 00003 finding G3-4 — but it does report every transaction's
//        `unshieldedCreatedOutputs` with owner, token type, value and spent-ness.)
//        shielded  — the LEDGER CONSERVATION IDENTITY per colour:
//        `minted[c] == custody[c] + Σ user holdings[c]`. A shielded coin is private by
//        construction, so the indexer cannot attribute it to an owner; this ledger-side identity is
//        the honest second point.
import { MidnightBech32m } from '@midnightntwrk/wallet-sdk-address-format';
import * as rx from 'rxjs';
import { endpoints, readLaneEnv } from '../lane.js';
import type { Party } from '../wallet.js';

export type ColourName = 'S1' | 'S2' | 'U1' | 'U2';
export const COLOURS: readonly ColourName[] = ['S1', 'S2', 'U1', 'U2'] as const;
export const SHIELDED_COLOURS: readonly ColourName[] = ['S1', 'S2'] as const;
export const UNSHIELDED_COLOURS: readonly ColourName[] = ['U1', 'U2'] as const;

export type PartyName = 'OwnerN' | 'OwnerM' | 'AA_A' | 'AA_B';
export const PARTIES: readonly PartyName[] = ['OwnerN', 'OwnerM', 'AA_A', 'AA_B'] as const;
export const AA_PARTIES: readonly PartyName[] = ['AA_A', 'AA_B'] as const;
export const USER_PARTIES: readonly PartyName[] = ['OwnerN', 'OwnerM'] as const;

/** The four configured colours, hex and raw, plus the two never-configured control colours. */
export type ColourSet = {
  hex: Record<ColourName, string>;
  raw: Record<ColourName, Uint8Array>;
  /** Minter3's two colours — recorded so NC-4 can name them and so nothing configures them. */
  control: { shielded: string; unshielded: string; rawShielded: Uint8Array; rawUnshielded: Uint8Array };
};

export type CoinDetail = { nonce: string; value: string; commitment: string; nullifier: string };
export type UtxoDetail = { value: string; intentHash?: string; outputNo?: string };

export const walletState = async (p: Party): Promise<any> => rx.firstValueFrom(p.wallet.state());

export const shieldedOfWallet = (s: any, colour: string): bigint => BigInt(s?.shielded?.balances?.[colour] ?? 0n);
export const unshieldedOfWallet = (s: any, colour: string): bigint => BigInt(s?.unshielded?.balances?.[colour] ?? 0n);

export const coinDetails = (s: any, colour: string): CoinDetail[] =>
  (s?.shielded?.availableCoins ?? [])
    .filter((c: any) => String(c?.coin?.color ?? c?.coin?.type).toLowerCase() === colour.toLowerCase())
    .map((c: any) => ({
      nonce: String(c.coin.nonce),
      value: String(c.coin.value),
      commitment: String(c.commitment),
      nullifier: String(c.nullifier),
    }))
    .sort((a: CoinDetail, b: CoinDetail) => a.commitment.localeCompare(b.commitment));

export const utxoDetails = (s: any, colour: string): UtxoDetail[] =>
  (s?.unshielded?.availableCoins ?? [])
    .filter((u: any) => String(u?.utxo?.type).toLowerCase() === colour.toLowerCase())
    .map((u: any) => ({
      value: String(u.utxo.value),
      intentHash: u.utxo.intentHash === undefined ? undefined : String(u.utxo.intentHash),
      outputNo: u.utxo.outputNo === undefined ? undefined : String(u.utxo.outputNo),
    }))
    .sort((a: UtxoDetail, b: UtxoDetail) => `${a.value}${a.intentHash}`.localeCompare(`${b.value}${b.intentHash}`));

/**
 * Observation point 2 for USER-held UNSHIELDED value: every party's unspent UTXO set of every
 * unshielded colour under test, reconstructed from the INDEXER'S OWN transaction history and
 * independent of any wallet.
 *
 * One replay covers both colours, so the per-step cost is one indexer query per submitted
 * transaction rather than one per (transaction, colour).
 *
 * @param txIdentifiers every transaction this run has submitted, in any order
 * @param colours the unshielded colours under test, hex
 * @returns owner address (hex, lowercase) -> colour (hex, lowercase) -> unspent value
 */
export const indexerUnshieldedByOwner = async (
  txIdentifiers: readonly string[],
  colours: readonly string[],
): Promise<Map<string, Map<string, bigint>>> => {
  const ep = endpoints(readLaneEnv());
  const wanted = new Set(colours.map((c) => c.toLowerCase()));
  const byOwner = new Map<string, Map<string, bigint>>();
  const seen = new Set<string>();

  for (const identifier of txIdentifiers) {
    const res = await fetch(ep.indexerHttpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($i: HexEncoded!) { transactions(offset: {identifier: $i}) { ' +
          'unshieldedCreatedOutputs { owner tokenType value intentHash outputIndex spentAtTransaction { hash } } } }',
        variables: { i: identifier },
      }),
    });
    const json: any = await res.json();
    for (const tx of json?.data?.transactions ?? []) {
      for (const utxo of tx?.unshieldedCreatedOutputs ?? []) {
        const colour = String(utxo.tokenType).toLowerCase();
        if (!wanted.has(colour)) continue;
        // One transaction can be returned under more than one identifier, so outputs are keyed by
        // their own identity rather than counted per response.
        const key = `${utxo.intentHash}:${utxo.outputIndex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (utxo.spentAtTransaction) continue;
        const owner = MidnightBech32m.parse(String(utxo.owner)).data.toString('hex').toLowerCase();
        const perColour = byOwner.get(owner) ?? new Map<string, bigint>();
        perColour.set(colour, (perColour.get(colour) ?? 0n) + BigInt(utxo.value));
        byOwner.set(owner, perColour);
      }
    }
  }
  return byOwner;
};
