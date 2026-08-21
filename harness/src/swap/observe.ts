// The FULL-TABLE observation for the swap step ledger. 00006 Plan 03. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// The 00005 table discipline, carried forward: after every row this reports every pool (value AND
// coin identity), every cell over the discovered colour set × both accounts, the per-colour
// invariant, conservation against what was minted, the exact sizes of all three custody maps, and
// the raw ledger keys the harness cannot EXPLAIN — which is what makes "zero unaccounted keys" an
// enumeration of real state rather than a lookup of the cells the harness happened to think of.
//
// It is built on Plan 02's `observeCustody` rather than beside it, for one specific reason: OP2 is a
// real proved circuit call — a submitted transaction — and it can be refused with `Custom error: 104`
// (the F-301 flake). `observeCustody` already retries that, bounded and counted, and marks the read
// UNAVAILABLE rather than guessing. Re-deriving OP2 here would mean maintaining a second copy of the
// part most likely to record apparatus noise as a result.
//
// F-104 throughout: a wallet that submitted anything is never an observation point. Custody comes
// from the indexer (OP1) and from an on-chain circuit call submitted by the FEE wallet (OP2); user
// balances come from FRESH facades opened for the read and closed straight after.
import { closeParty, openParty } from '../wallet.js';
import { log, syncedState } from '../night.js';
import { shieldedKeyOf, unshieldedKeyOf, type ManagerView } from '../manager-view.js';
import {
  OP2_UNAVAILABLE,
  observationPointsAgree,
  observeCustody,
  type CustodyObservation,
} from '../g2/spike-common.js';
import type { Colour, SwapRig } from '../g2/swap-rig.js';

export type AccountRef = { label: string; id: Uint8Array };
/** A wallet whose demonstration-colour holdings are part of the table. */
export type UserRef = { label: string; seed: string };

export type SwapObservation = {
  utc: string;
  mapSizes: Record<string, number>;
  accounts: string[];
  /** colour label -> pooled value, or `absent` when the colour is not in the pool map at all. */
  pools: Record<string, string>;
  /**
   * The pooled coin's IDENTITY, not just its value. An internal transfer must leave it byte-identical
   * (that is what "no token operation" means), and a withdraw must change it — so the distinction
   * carries a claim and cannot be dropped.
   */
  poolCoins: Record<string, { nonce: string; mtIndex: string } | null>;
  /** `account/colour` -> cell value, or `absent`. The difference is the no-state-created proof. */
  cells: Record<string, string>;
  onChainCells: Record<string, string>;
  op2Retries: Record<string, number>;
  op2Consulted: boolean;
  /** user label -> colour label -> balance, each read from a FRESH facade (F-104). */
  users: Record<string, Record<string, string>>;
  usersConsulted: boolean;
  /** Raw ledger keys the harness could not explain. Any entry here is a failure. */
  unaccounted: { pools: string[]; shieldedCells: string[]; unshieldedCells: string[] };
  /** Per colour: the pool must equal the sum of that colour's cells. */
  invariant: Array<{ colour: string; pool: string; sumCells: string; ok: boolean }>;
  /** Per colour: what was minted must equal what the users hold plus what custody pools. */
  conservation: Array<{ colour: string; minted: string; users: string; pool: string; ok: boolean }>;
};

export type ObserveDeps = {
  rig: SwapRig;
  colours: Colour[];
  accounts: AccountRef[];
  users: UserRef[];
  /** colour label -> total minted so far in this stage. Drives the conservation check. */
  minted: Record<string, bigint>;
};

export type ObserveOpts = {
  /**
   * Consult OP2 (a proved on-chain circuit read per cell).
   *
   * Default FALSE. Each OP2 read is a submitted transaction — about 15 s and exposed to the F-301
   * flake — so it is spent where the claim is about BALANCES (the settlement rows and every closing
   * table) and skipped where the claim is about a refusal, which is established by the state being
   * byte-identical rather than by a second reading of it.
   */
  op2?: boolean;
  /** Read the user wallets. Default TRUE; skipped for cheap intermediate snapshots. */
  users?: boolean;
};

const nowUtc = () => new Date().toISOString();

/** Read every demonstration colour a wallet holds, from ONE fresh facade (F-104). */
const readUser = async (rig: SwapRig, user: UserRef, colours: Colour[]): Promise<Record<string, string>> => {
  const p = await openParty(`${user.label}-observer`, user.seed);
  try {
    const st: any = await syncedState(p);
    const out: Record<string, string> = {};
    for (const c of colours) out[c.label] = String(BigInt(st?.shielded?.balances?.[c.hex] ?? 0n));
    return out;
  } finally {
    await closeParty(p);
  }
};

const accountedKeys = (accounts: AccountRef[], colours: Colour[]) => {
  const shielded = new Map<string, string>();
  const unshielded = new Map<string, string>();
  for (const a of accounts) {
    for (const c of colours) {
      shielded.set(shieldedKeyOf(a.id, c.raw), `${a.label}/${c.label}`);
      unshielded.set(unshieldedKeyOf(a.id, c.raw), `${a.label}/${c.label}`);
    }
  }
  return { shielded, unshielded };
};

export const observeSwap = async (d: ObserveDeps, opts: ObserveOpts = {}): Promise<SwapObservation> => {
  const useOp2 = opts.op2 ?? false;
  const useUsers = opts.users ?? true;
  const { view, observation } = await observeCustody(d.rig, d.colours, d.accounts, { op2: useOp2 });

  const poolCoins: Record<string, { nonce: string; mtIndex: string } | null> = {};
  for (const c of d.colours) {
    const coin = view.pools[c.hex];
    poolCoins[c.label] = coin ? { nonce: coin.nonce, mtIndex: String(coin.mt_index) } : null;
  }

  const known = accountedKeys(d.accounts, d.colours);
  const knownColourHex = new Set(d.colours.map((c) => c.hex.toLowerCase()));
  const unaccounted = {
    pools: Object.keys(view.pools).filter((k) => !knownColourHex.has(k.toLowerCase())),
    shieldedCells: Object.keys(view.shieldedBalances).filter((k) => !known.shielded.has(k)),
    // 00006 performs no unshielded custody at all (FR-310), so ANY key here is unaccounted.
    unshieldedCells: Object.keys(view.unshieldedBalances).filter((k) => !known.unshielded.has(k)),
  };

  const cellValue = (label: string): bigint => {
    const v = observation.cells[label];
    return v === undefined || v === 'absent' ? 0n : BigInt(v);
  };
  const poolValue = (label: string): bigint => {
    const v = observation.pools[label];
    return v === undefined || v === 'absent' ? 0n : BigInt(v);
  };

  const invariant = d.colours.map((c) => {
    const sum = d.accounts.reduce((acc, a) => acc + cellValue(`${a.label}/${c.label}`), 0n);
    return {
      colour: c.label,
      pool: String(poolValue(c.label)),
      sumCells: String(sum),
      ok: poolValue(c.label) === sum,
    };
  });

  const users: Record<string, Record<string, string>> = {};
  if (useUsers) {
    for (const u of d.users) users[u.label] = await readUser(d.rig, u, d.colours);
  }

  const conservation = d.colours.map((c) => {
    const minted = d.minted[c.label] ?? 0n;
    const held = useUsers
      ? Object.values(users).reduce((acc, row) => acc + BigInt(row[c.label] ?? '0'), 0n)
      : 0n;
    return {
      colour: c.label,
      minted: String(minted),
      users: useUsers ? String(held) : '(users not read)',
      pool: String(poolValue(c.label)),
      ok: useUsers ? minted === held + poolValue(c.label) : true,
    };
  });

  return {
    utc: nowUtc(),
    mapSizes: observation.mapSizes,
    accounts: view.accounts,
    pools: observation.pools,
    poolCoins,
    cells: observation.cells,
    onChainCells: observation.onChainCells,
    op2Retries: observation.op2Retries,
    op2Consulted: observation.op2Consulted,
    users,
    usersConsulted: useUsers,
    unaccounted,
    invariant,
    conservation,
  };
};

/** Which keys a fingerprint is allowed to look at, when two observations watch different sets. */
export type FingerprintScope = {
  /** OP2 cell labels to include. Omit for all of them. */
  onChain?: Set<string>;
  /** Colour labels to include in `pools`/`poolCoins`. Omit for all of them. */
  colours?: Set<string>;
  /** `account/colour` labels to include in `cells`. Omit for all of them. */
  cells?: Set<string>;
};

const pick = <T>(o: Record<string, T>, keep?: Set<string>): Record<string, T> => {
  if (!keep) return o;
  const out: Record<string, T> = {};
  for (const k of Object.keys(o).sort()) if (keep.has(k)) out[k] = o[k]!;
  return out;
};

/**
 * The part of an observation that is a claim about LEDGER STATE, rendered comparably.
 *
 * Excludes the measuring apparatus's own bookkeeping (how many times OP2 had to be retried) and
 * takes a SCOPE, because two observations in one run do not always watch the same key set — and the
 * difference between "the state changed" and "the harness started watching one more colour" is
 * exactly the difference a no-state-created proof exists to make.
 *
 * `mapSizes` and `accounts` are ALWAYS compared in full, unscoped. That is what keeps the scoping
 * honest: a cell or pool that really came into existence moves a map size, and no narrowing of the
 * key set can hide it.
 */
export const custodyFingerprint = (o: SwapObservation, scope: FingerprintScope = {}): string => {
  const onChain: Record<string, string> = {};
  for (const k of Object.keys(o.onChainCells).sort()) {
    const v = o.onChainCells[k]!;
    if (v === OP2_UNAVAILABLE) continue;
    if (scope.onChain && !scope.onChain.has(k)) continue;
    onChain[k] = v;
  }
  return JSON.stringify({
    mapSizes: o.mapSizes,
    accounts: o.accounts,
    pools: pick(o.pools, scope.colours),
    poolCoins: pick(o.poolCoins, scope.colours),
    cells: pick(o.cells, scope.cells),
    onChain,
  });
};

const sharedKeys = <T>(a: Record<string, T>, b: Record<string, T>): Set<string> =>
  new Set(Object.keys(a).filter((k) => k in b));

/**
 * Did the LEDGER state stay byte-identical between two observations?
 *
 * Compared over the keys BOTH observations reported. A run's colour set grows — stage A deploys a
 * third issuer for the P-F310 arm that isolates the cell count from the wanted colour's pool — and a
 * colour that has never been credited has no pool and no cell, so watching one more of them adds
 * `absent` entries and changes no state. Treating those as a change reported a false positive in G3
 * run 1 on a row where the map sizes were provably identical; the map sizes are still compared
 * strictly, so a real creation cannot slip through this.
 */
export const custodyUnchanged = (a: SwapObservation, b: SwapObservation): boolean => {
  const scope: FingerprintScope = {
    onChain: sharedKeys(a.onChainCells, b.onChainCells),
    colours: sharedKeys(a.pools, b.pools),
    cells: sharedKeys(a.cells, b.cells),
  };
  return custodyFingerprint(a, scope) === custodyFingerprint(b, scope);
};

/** Every user balance, comparably — the "funds unchanged" half of a negative control. */
export const fundsFingerprint = (o: SwapObservation, colours?: Set<string>): string => {
  const out: Record<string, Record<string, string>> = {};
  for (const who of Object.keys(o.users).sort()) out[who] = pick(o.users[who]!, colours);
  return JSON.stringify(out);
};

/** Same scoping rule as `custodyUnchanged`, and for the same reason. */
export const fundsUnchanged = (a: SwapObservation, b: SwapObservation): boolean => {
  if (!a.usersConsulted || !b.usersConsulted) return false;
  const colours = new Set(
    Object.values(a.users).flatMap((row) => Object.keys(row)).filter((c) =>
      Object.values(b.users).some((row) => c in row),
    ),
  );
  return fundsFingerprint(a, colours) === fundsFingerprint(b, colours);
};

export const op2Problems = (o: SwapObservation): string[] =>
  observationPointsAgree({
    mapSizes: o.mapSizes,
    pools: o.pools,
    cells: o.cells,
    onChainCells: o.onChainCells,
    op2Retries: o.op2Retries,
    op2Consulted: o.op2Consulted,
  } as CustodyObservation);

/**
 * The structural discipline every row asserts.
 *
 * Conservation is OMITTED rather than passed when the wallets were not read: a check that says
 * "conservation holds" because nothing was compared is worse than no check at all, and the whole
 * point of an OP1-only snapshot is that it makes a claim about custody, not about who holds what.
 */
export const structuralChecks = (o: SwapObservation): Array<{ name: string; ok: boolean; detail: string }> => {
  const checks = [
    {
      name: 'per-colour invariant: every pool equals the sum of that colour’s cells',
      ok: o.invariant.every((i) => i.ok),
      detail: o.invariant.map((i) => `${i.colour}: pool ${i.pool} vs cells ${i.sumCells}`).join('; ') || '(no colours yet)',
    },
    {
      name: 'zero unaccounted ledger keys (pools, shielded cells, unshielded cells)',
      ok:
        o.unaccounted.pools.length === 0 &&
        o.unaccounted.shieldedCells.length === 0 &&
        o.unaccounted.unshieldedCells.length === 0,
      detail: JSON.stringify(o.unaccounted),
    },
  ];
  if (o.usersConsulted) {
    checks.push({
      name: 'conservation: minted = user holdings + custody pool, per colour',
      ok: o.conservation.every((c) => c.ok),
      detail:
        o.conservation.map((c) => `${c.colour}: minted ${c.minted} = users ${c.users} + pool ${c.pool}`).join('; ') ||
        '(no colours yet)',
    });
  }
  return checks;
};

export const logObservation = (what: string, o: SwapObservation): void => {
  log(
    `${what}: sizes ${JSON.stringify(o.mapSizes)} pools ${JSON.stringify(o.pools)} cells ` +
      `${JSON.stringify(o.cells)}${o.usersConsulted ? ` users ${JSON.stringify(o.users)}` : ''}`,
  );
};

export type { ManagerView };
