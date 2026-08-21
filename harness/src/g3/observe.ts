// G3 — the raw observation points behind the DYNAMIC table (EXPERIMENTAL_LANE / LANE-DEV-1).
//
// `table.ts` composes these into the spec's 4-party x N-colour table; this module only READS, and
// owns the COLOUR REGISTRY — the harness's record of which colours exist on chain at any moment.
//
// WHAT CHANGED FROM 00004. There, four colours were fixed at `configure` time and the harness knew
// them from the start. Manager v3 has no colour knowledge at all, and 00005's demonstration invents
// a colour MID-LEDGER (TOKD, step 15). So:
//
//   * colours are REGISTERED as they come into existence, each from an on-chain circuit read of the
//     Minter that issues it — never derived off-chain, never configured anywhere;
//   * the Manager's custody is read by WALKING ITS RAW LEDGER MAPS, and every key found there must
//     be explainable as `shieldedKey/unshieldedKey(AA account, registered colour)`. A key that is
//     not explainable is a failure ("zero unaccounted keys", now dynamic);
//   * `U3` is registered like any other colour and then never credited — the dormant fixture. It
//     must read 0 everywhere and stay absent from every map (FR-206).
//
// FR-208 requires two independent observation points wherever the rails allow. What exists on this
// pinned lane, per party class:
//
//   AA_A / AA_B (Manager-held, per colour)
//     1. the Manager's `shieldedBalances` / `unshieldedBalances` maps, decoded from contract state,
//        with every key derived by RUNNING the contract's own pure key circuits (`manager-view.ts`);
//     2. the CUSTODY side of the same colour — the pooled zswap coin for a shielded colour, or the
//        LEDGER KERNEL's unshielded balance for an unshielded one. Neither is written by the code
//        that writes the balance maps, so the per-colour invariant is a real cross-check;
//     3. (rotating, once per step) a real ON-CHAIN `shieldedAccountBalance` / `unshieldedAccount
//        Balance` circuit call — a proved transaction whose result comes back through the SDK.
//
//   OwnerN / OwnerM (user-held, per colour)
//     1. a wallet SDK state — read from an OBSERVER wallet that has never submitted a transaction.
//        **F-104 discipline:** on this lane a wallet that SUBMITTED a transaction under-reports its
//        own balance indefinitely while still returning `progress.isStrictlyComplete() === true`. A
//        submitting wallet is therefore never an observation point here;
//     2. unshielded — the UTXO set RECONSTRUCTED from the indexer's own transaction history, per
//        colour, independent of any wallet (the pinned indexer has no per-address balance query —
//        00003 finding G3-4 — but it does report every transaction's `unshieldedCreatedOutputs`);
//        shielded  — the LEDGER CONSERVATION IDENTITY per colour,
//        `minted[c] == custody[c] + Σ user holdings[c]`. A shielded coin is private by
//        construction, so the indexer cannot attribute it to an owner; this is the honest second
//        point.
import { MidnightBech32m } from '@midnightntwrk/wallet-sdk-address-format';
import * as rx from 'rxjs';
import { endpoints, readLaneEnv } from '../lane.js';
import type { Party } from '../wallet.js';

export type Family = 'shielded' | 'unshielded';

/** One colour that EXISTS on chain, as read back from its issuing contract. */
export type ColourInfo = {
  /** The harness name used in the spec's table: `S1`…`S5`, `U1`…`U5`, `X` for the P-COLL colour. */
  name: string;
  family: Family;
  hex: string;
  raw: Uint8Array;
  /** The deployment that issues it (`Minter1`…`Minter5`, `MinterCollide`). */
  issuer: string;
};

export type PartyName = 'OwnerN' | 'OwnerM' | 'AA_A' | 'AA_B';
export const PARTIES: readonly PartyName[] = ['OwnerN', 'OwnerM', 'AA_A', 'AA_B'] as const;
export const AA_PARTIES: readonly PartyName[] = ['AA_A', 'AA_B'] as const;
export const USER_PARTIES: readonly PartyName[] = ['OwnerN', 'OwnerM'] as const;

/**
 * The colours the harness knows EXIST, in the order they came into existence.
 *
 * It is append-only on purpose: a colour cannot stop existing, and the run's history of "what was
 * knowable when" is itself evidence for the headline claim (step 16 custodies a colour that was not
 * registrable before step 15).
 */
export class ColourRegistry {
  private readonly byName = new Map<string, ColourInfo>();

  add(info: ColourInfo): ColourInfo {
    const existing = this.byName.get(info.name);
    if (existing) {
      if (existing.hex !== info.hex) {
        throw new Error(`colour ${info.name} re-registered with a different value (${existing.hex} -> ${info.hex})`);
      }
      return existing;
    }
    for (const other of this.byName.values()) {
      if (other.hex === info.hex && other.family === info.family) {
        throw new Error(`colour ${info.name} collides with ${other.name} in the ${info.family} family (${info.hex})`);
      }
    }
    this.byName.set(info.name, info);
    return info;
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  get(name: string): ColourInfo {
    const c = this.byName.get(name);
    if (!c) throw new Error(`colour ${name} is not registered yet — it does not exist on chain`);
    return c;
  }

  hex(name: string): string {
    return this.get(name).hex;
  }

  raw(name: string): Uint8Array {
    return this.get(name).raw;
  }

  list(): ColourInfo[] {
    return [...this.byName.values()];
  }

  names(): string[] {
    return [...this.byName.keys()];
  }

  of(family: Family): ColourInfo[] {
    return this.list().filter((c) => c.family === family);
  }
}

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
 * One replay covers every colour, so the per-step cost is one indexer query per submitted
 * transaction rather than one per (transaction, colour).
 *
 * @param txIdentifiers every transaction this run has submitted, in any order
 * @param colours the unshielded colours currently under test, hex
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
