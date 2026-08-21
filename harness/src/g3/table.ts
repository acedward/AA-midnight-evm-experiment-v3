// G3 — the 4-party x DYNAMIC-colour table: the spec's core assertion artifact (FR-205).
//
// Every (party, colour) cell over every colour that EXISTS at that moment, plus every shielded pool
// value, every unshielded contract-ledger balance, the EXACT size of all three custody maps and the
// per-colour invariant, are read and asserted after EVERY step. Any movement in a cell the step did
// not name is a step failure.
//
// THE DIFFERENCE FROM 00004, and it is the whole point of this project. There, `registerAccount`
// seeded one zero cell per configured colour, so `balances.size() == accounts x 4` and the table was
// an enumeration of ledger state by construction. Manager v3 seeds NOTHING and knows no colours, so
// exactness has to be established the other way round:
//
//   * the colour set is DISCOVERED — the harness walks the Manager's RAW ledger maps (`pools`,
//     `shieldedBalances`, `unshieldedBalances`) and the ledger kernel's own unshielded balance map;
//   * every key found there must be reproducible as `shieldedKey/unshieldedKey(AA account,
//     registered colour)` by RUNNING THE CONTRACT'S OWN PURE CIRCUITS. A key that is not — an EXTRA
//     colour, an extra cell, a cell for an account that is not AA_A/AA_B — is a hard failure;
//   * the three map sizes are asserted EXACTLY against the spec's transcription after every step,
//     which is what makes "lazy creation on first credit only" observable rather than assumed.
//
// The observation points behind each cell are documented in `observe.ts`. The one rule that shapes
// this module: **a wallet that submitted a transaction is never an observation point** (F-104) —
// user cells are read from OBSERVER wallets that only ever read, cross-checked against the indexer
// (unshielded) and against the ledger conservation identity (shielded).
import {
  AA_PARTIES,
  PARTIES,
  USER_PARTIES,
  coinDetails,
  indexerUnshieldedByOwner,
  shieldedOfWallet,
  unshieldedOfWallet,
  utxoDetails,
  walletState,
  type ColourInfo,
  type ColourRegistry,
  type CoinDetail,
  type PartyName,
  type UtxoDetail,
} from './observe.js';
import { readManager, shieldedKeyOf, unshieldedKeyOf, type ManagerView } from '../manager-view.js';
import type { Party } from '../wallet.js';

export type Row = Record<string, bigint>;
export type Table = Record<PartyName, Row>;
/** What the Manager custodies per colour: a pooled coin (shielded) or a ledger balance. */
export type Custody = Record<string, bigint>;
export type Sizes = { pools: number; shieldedCells: number; unshieldedCells: number };

export type PoolDetail = { present: boolean; value: bigint; nonce: string };

/**
 * One fully-specified expected state: cells, custody, EXACT map sizes, and the colour set.
 *
 * `colours` is mutable because the colour set GROWS during a run — that is the point of the
 * project. The step rows build it from the spec's transcription; the probe phase extends it as
 * TOKE and MinterCollide come into existence.
 */
export type ExpectedState = {
  /** The colours that must EXIST at this point — asserted against the registry, not assumed. */
  colours: string[];
  table: Table;
  custody: Custody;
  sizes: Sizes;
};

export type Observation = {
  /** The colours the registry knew at observation time, in creation order. */
  colours: ColourInfo[];
  table: Table;
  custody: Custody;
  /** Identity as well as value for each shielded pool: an internal transfer must move neither. */
  pools: Record<string, PoolDetail>;
  sizes: Sizes;
  manager: ManagerView;
  /** Per-user, per-colour shielded coins and unshielded UTXOs, from the OBSERVER wallets. */
  coins: Record<'OwnerN' | 'OwnerM', Record<string, CoinDetail[]>>;
  utxos: Record<'OwnerN' | 'OwnerM', Record<string, UtxoDetail[]>>;
  /**
   * The raw ledger keys the harness could NOT explain — the dynamic form of "zero unaccounted
   * keys". Any entry here is a failure; they are carried in the observation so the failure message
   * can name them.
   */
  unaccounted: {
    pools: string[];
    shieldedCells: string[];
    unshieldedCells: string[];
    /** Kernel-held unshielded colours that belong to no registered colour, with their value. */
    kernel: Array<{ colour: string; value: string }>;
  };
  /**
   * User unshielded holdings reconstructed from the indexer — observation point 2. Filled in only
   * at assertion points: it costs one query per submitted transaction, so the polling loops that
   * wait for finality deliberately skip it.
   */
  indexerUnshielded?: Record<'OwnerN' | 'OwnerM', Record<string, bigint>>;
  /** The rotating on-chain balance spot check for this step, if one was made. */
  spotCheck?: {
    account: PartyName;
    colour: string;
    circuit: string;
    onChain: bigint;
    ledgerState: bigint;
    txish: string;
  };
};

export type ObserveDeps = {
  managerProviders: any;
  managerAddress: string;
  /** The live colour registry — read at observation time, because the set GROWS mid-run. */
  registry: ColourRegistry;
  /** Account ids (hex) of the two Manager accounts. */
  ids: { AA_A: string; AA_B: string };
  raw: { AA_A: Uint8Array; AA_B: Uint8Array };
  /** OBSERVER wallets — opened at bootstrap, never used to submit anything (finding F-104). */
  observers: { OwnerN: Party; OwnerM: Party };
  /** Re-open the observer wallets. Called once by a wait that is running long. */
  refreshObservers: () => Promise<void>;
  /** Unshielded addresses (hex, lowercase) of the two users, for the indexer reconstruction. */
  addresses: { OwnerN: string; OwnerM: string };
  /** Every transaction identifier this run has submitted; grows as the run proceeds. */
  submittedTxs: string[];
};

const bigints = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}` : v);

export const emptyRow = (colours: readonly string[]): Row => {
  const r: Row = {};
  for (const c of colours) r[c] = 0n;
  return r;
};

/** Read every observation point once. Never call this and assume finality — use `waitForTable`. */
export const observe = async (d: ObserveDeps): Promise<Observation> => {
  const manager = await readManager(d.managerProviders, d.managerAddress);
  const colours = d.registry.list();
  const names = colours.map((c) => c.name);

  // --- accounting: every ledger key the harness can EXPLAIN, derived by running the contract's
  //     own pure key circuits over (AA account x registered colour) -----------------------------
  //
  // Only the FAMILY-APPROPRIATE key is accounted for each colour: a shielded colour explains a
  // `shieldedBalances` key and nothing else. Accounting both keys for every colour would quietly
  // excuse a cell in the wrong family — precisely the aliasing FR-203 forbids.
  const accountedShielded = new Map<string, string>();
  const accountedUnshielded = new Map<string, string>();
  for (const p of AA_PARTIES) {
    const acct = d.raw[p as 'AA_A' | 'AA_B'];
    for (const colour of colours) {
      if (colour.family === 'shielded') accountedShielded.set(shieldedKeyOf(acct, colour.raw), `${p}.${colour.name}`);
      else accountedUnshielded.set(unshieldedKeyOf(acct, colour.raw), `${p}.${colour.name}`);
    }
  }
  const knownShieldedHex = new Set(colours.filter((c) => c.family === 'shielded').map((c) => c.hex.toLowerCase()));
  const knownUnshieldedHex = new Set(colours.filter((c) => c.family === 'unshielded').map((c) => c.hex.toLowerCase()));

  const unaccounted: Observation['unaccounted'] = {
    pools: Object.keys(manager.pools).filter((k) => !knownShieldedHex.has(k.toLowerCase())),
    shieldedCells: Object.keys(manager.shieldedBalances).filter((k) => !accountedShielded.has(k)),
    unshieldedCells: Object.keys(manager.unshieldedBalances).filter((k) => !accountedUnshielded.has(k)),
    kernel: Object.entries(manager.kernelUnshielded)
      .filter(([k]) => !knownUnshieldedHex.has(k.toLowerCase()))
      .map(([colour, value]) => ({ colour, value: String(value) })),
  };

  // --- the table ------------------------------------------------------------------------------
  const [sN, sM] = await Promise.all([walletState(d.observers.OwnerN), walletState(d.observers.OwnerM)]);
  const userState = { OwnerN: sN, OwnerM: sM } as const;

  const table = {} as Table;
  for (const p of PARTIES) table[p] = emptyRow(names);

  for (const colour of colours) {
    for (const p of AA_PARTIES) {
      const acct = d.raw[p as 'AA_A' | 'AA_B'];
      const key = colour.family === 'shielded' ? shieldedKeyOf(acct, colour.raw) : unshieldedKeyOf(acct, colour.raw);
      const map = colour.family === 'shielded' ? manager.shieldedBalances : manager.unshieldedBalances;
      table[p][colour.name] = map[key] ?? 0n;
    }
    for (const p of USER_PARTIES) {
      const s = userState[p as 'OwnerN' | 'OwnerM'];
      table[p][colour.name] =
        colour.family === 'shielded' ? shieldedOfWallet(s, colour.hex) : unshieldedOfWallet(s, colour.hex);
    }
  }

  // --- custody: pooled coin (shielded) / ledger-kernel balance (unshielded) ---------------------
  const pools: Record<string, PoolDetail> = {};
  const custody: Custody = {};
  for (const colour of colours) {
    const chex = colour.hex.toLowerCase();
    if (colour.family === 'shielded') {
      const p = manager.pools[chex];
      pools[colour.name] = p ? { present: true, value: p.value, nonce: p.nonce } : { present: false, value: 0n, nonce: '' };
      custody[colour.name] = pools[colour.name]!.value;
    } else {
      pools[colour.name] = { present: false, value: 0n, nonce: '' };
      custody[colour.name] = manager.kernelUnshielded[chex] ?? 0n;
    }
  }

  const coins = { OwnerN: {}, OwnerM: {} } as Observation['coins'];
  const utxos = { OwnerN: {}, OwnerM: {} } as Observation['utxos'];
  for (const p of ['OwnerN', 'OwnerM'] as const) {
    for (const colour of colours) {
      coins[p][colour.name] = coinDetails(userState[p], colour.hex);
      utxos[p][colour.name] = utxoDetails(userState[p], colour.hex);
    }
  }

  return {
    colours,
    table,
    custody,
    pools,
    sizes: {
      pools: Number(manager.poolCount),
      shieldedCells: Number(manager.shieldedCount),
      unshieldedCells: Number(manager.unshieldedCount),
    },
    manager,
    coins,
    utxos,
    unaccounted,
  };
};

export const tableEquals = (a: Table, b: Table, colours: readonly string[]): boolean =>
  PARTIES.every((p) => colours.every((c) => (a[p][c] ?? 0n) === (b[p][c] ?? 0n)));

export const custodyEquals = (a: Custody, b: Custody, colours: readonly string[]): boolean =>
  colours.every((c) => (a[c] ?? 0n) === (b[c] ?? 0n));

export const sizesEqual = (a: Sizes, b: Sizes): boolean =>
  a.pools === b.pools && a.shieldedCells === b.shieldedCells && a.unshieldedCells === b.unshieldedCells;

export const renderSizes = (s: Sizes): string =>
  `pools=${s.pools} shieldedCells=${s.shieldedCells} unshieldedCells=${s.unshieldedCells}`;

/** One line per party — the divergence output the halt-on-first-divergence rule prints. */
export const renderTable = (t: Table, colours: readonly string[]): string =>
  PARTIES.map((p) => `${p}=[${colours.map((c) => `${c}:${t[p][c] ?? 0n}`).join(' ')}]`).join('  ');

/**
 * `poolS1=6 ledgerU1=3 …` — the custody figure per colour, labelled by the colour's FAMILY.
 *
 * The family must come from the registry, never from the colour's NAME: the P-COLL fixture's two
 * colours are the same 32 bytes under two names (`XS` shielded, `XU` unshielded), and a
 * name-prefix heuristic labelled the shielded one `ledgerXS` in G3 run 1 — evidence that read as
 * if the contract's unshielded ledger held it. The value was right and the label was wrong, which
 * is the worse of the two failures.
 */
export const renderCustody = (cu: Custody, colours: readonly string[], registry?: ColourRegistry): string =>
  colours
    .map((c) => {
      const family = registry?.has(c) ? registry.get(c).family : c.startsWith('S') ? 'shielded' : 'unshielded';
      return `${family === 'shielded' ? 'pool' : 'ledger'}${c}=${cu[c] ?? 0n}`;
    })
    .join(' ');

/** The full markdown table, for evidence and for a legible divergence report. */
export const renderMarkdownTable = (t: Table, custody: Custody, colours: readonly string[]): string[] => [
  `|  | ${colours.join(' | ')} |`,
  `|---|${colours.map(() => '---').join('|')}|`,
  ...PARTIES.map((p) => `| ${p} | ${colours.map((c) => t[p][c] ?? 0n).join(' | ')} |`),
  `| pool / ledger | ${colours.map((c) => custody[c] ?? 0n).join(' | ')} |`,
];

/**
 * Poll until the observed table, custody figures AND map sizes match `expected`.
 *
 * Reading once immediately after `submitTx` returns PRE-transaction state and would report a false
 * divergence, so the wait is on the expected condition. A timeout IS the halt-on-first-divergence
 * failure the spec requires, and it reports exactly what was observed instead.
 *
 * Halfway through the budget the OBSERVER wallets are re-opened once. That is the F-104
 * contingency: the observers never submit, so they should never be wrong, but a stale observer
 * would otherwise hang the whole run with no diagnosis.
 */
export const waitForTable = async (
  d: ObserveDeps,
  expected: ExpectedState,
  step: string,
  timeoutMs = 300_000,
): Promise<Observation> => {
  const start = Date.now();
  const deadline = start + timeoutMs;
  let refreshed = false;
  let last: Observation | undefined;
  for (;;) {
    last = await observe(d);
    if (
      tableEquals(last.table, expected.table, expected.colours) &&
      custodyEquals(last.custody, expected.custody, expected.colours) &&
      sizesEqual(last.sizes, expected.sizes)
    ) {
      return last;
    }
    if (!refreshed && Date.now() > start + timeoutMs / 2) {
      refreshed = true;
      console.log(`  [step ${step}] observation is running long — re-opening the observer wallets (F-104 contingency)`);
      await d.refreshObservers();
    }
    if (Date.now() > deadline) {
      throw new Error(
        `STEP ${step} DIVERGENCE — after ${timeoutMs}ms\n` +
          `  expected  ${renderTable(expected.table, expected.colours)}  ` +
          `${renderCustody(expected.custody, expected.colours, d.registry)}  ${renderSizes(expected.sizes)}\n` +
          `  observed  ${renderTable(last.table, expected.colours)}  ` +
          `${renderCustody(last.custody, expected.colours, d.registry)}  ${renderSizes(last.sizes)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
};

/** Poll until an arbitrary predicate holds over a fresh observation. */
export const waitUntil = async (
  d: ObserveDeps,
  pred: (o: Observation) => boolean,
  what: string,
  timeoutMs = 300_000,
): Promise<Observation> => {
  const start = Date.now();
  const deadline = start + timeoutMs;
  let refreshed = false;
  let last: Observation | undefined;
  for (;;) {
    last = await observe(d);
    if (pred(last)) return last;
    if (!refreshed && Date.now() > start + timeoutMs / 2) {
      refreshed = true;
      await d.refreshObservers();
    }
    if (Date.now() > deadline) {
      const names = last.colours.map((c) => c.name);
      throw new Error(
        `timed out after ${timeoutMs}ms waiting for ${what}; observed ${renderTable(last.table, names)} ` +
          `${renderCustody(last.custody, names, d.registry)} ${renderSizes(last.sizes)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
};

/**
 * Fill in observation point 2 for user unshielded holdings by replaying every transaction this run
 * has submitted through the indexer. Called once per assertion, never in a polling loop.
 */
export const withIndexerCheck = async (d: ObserveDeps, o: Observation): Promise<Observation> => {
  const unshielded = d.registry.of('unshielded');
  const byOwner = await indexerUnshieldedByOwner(
    d.submittedTxs,
    unshielded.map((c) => c.hex),
  );
  const read = (who: 'OwnerN' | 'OwnerM', colour: ColourInfo): bigint =>
    byOwner.get(d.addresses[who].toLowerCase())?.get(colour.hex.toLowerCase()) ?? 0n;
  const out: Observation['indexerUnshielded'] = { OwnerN: {}, OwnerM: {} };
  for (const who of ['OwnerN', 'OwnerM'] as const) {
    for (const colour of unshielded) out[who][colour.name] = read(who, colour);
  }
  return { ...o, indexerUnshielded: out };
};

/**
 * Everything that must hold after EVERY step (FR-202, FR-203, FR-205, FR-206, FR-208).
 *
 * `minted` is the total the Minters have issued of each colour so far — the harness knows it
 * exactly because it issues every mint. `dormant` lists colours that must be absent from every map.
 */
export const assertAll = (
  o: Observation,
  expected: ExpectedState,
  step: string,
  minted: Custody,
  d: ObserveDeps,
  dormant: readonly string[] = [],
): void => {
  const cols = expected.colours;
  const fail = (msg: string): never => {
    throw new Error(
      `STEP ${step} DIVERGENCE — ${msg}\n` +
        `  observed  ${renderTable(o.table, cols)}  ${renderCustody(o.custody, cols, d.registry)}  ${renderSizes(o.sizes)}`,
    );
  };

  // --- 1. the colour set itself is what the spec says it is at this row -------------------------
  const observedNames = [...o.colours.map((c) => c.name)].sort();
  const expectedNames = [...cols].sort();
  if (JSON.stringify(observedNames) !== JSON.stringify(expectedNames)) {
    fail(`the colour set is [${observedNames.join(',')}], expected [${expectedNames.join(',')}]`);
  }

  // --- 2. the full table, exactly ---------------------------------------------------------------
  if (!tableEquals(o.table, expected.table, cols)) {
    fail(`table is [${renderTable(o.table, cols)}], expected [${renderTable(expected.table, cols)}]`);
  }
  // --- 3. every pool and every unshielded contract balance, exactly ------------------------------
  if (!custodyEquals(o.custody, expected.custody, cols)) {
    fail(`custody is [${renderCustody(o.custody, cols, d.registry)}], expected [${renderCustody(expected.custody, cols, d.registry)}]`);
  }

  // --- 4. EXACT map sizes — the lazy-creation bookkeeping (FR-202, FR-205) -----------------------
  if (!sizesEqual(o.sizes, expected.sizes)) {
    fail(`map sizes are ${renderSizes(o.sizes)}, expected ${renderSizes(expected.sizes)}`);
  }

  // --- 5. ZERO UNACCOUNTED KEYS, dynamically ------------------------------------------------------
  // Every key in the raw ledger maps must be reproducible from (AA account x registered colour) by
  // the contract's own pure key circuits. An EXTRA colour or an EXTRA cell fails here.
  if (o.unaccounted.pools.length > 0) fail(`unaccounted POOL colours in ledger state: ${o.unaccounted.pools.join(', ')}`);
  if (o.unaccounted.shieldedCells.length > 0) {
    fail(`unaccounted SHIELDED cells in ledger state: ${o.unaccounted.shieldedCells.join(', ')}`);
  }
  if (o.unaccounted.unshieldedCells.length > 0) {
    fail(`unaccounted UNSHIELDED cells in ledger state: ${o.unaccounted.unshieldedCells.join(', ')}`);
  }
  // The ledger KERNEL's balance map is maintained by the node, not by the contract, so it is not
  // one of the three custody maps whose SIZE the spec pins. It must still hold no VALUE the harness
  // cannot attribute to a registered colour.
  const kernelValue = o.unaccounted.kernel.filter((k) => BigInt(k.value) !== 0n);
  if (kernelValue.length > 0) {
    fail(`the contract holds unshielded VALUE of unregistered colours: ${JSON.stringify(kernelValue)}`);
  }

  // --- 6. the per-colour invariant (FR-205) -------------------------------------------------------
  for (const c of cols) {
    const sum = AA_PARTIES.reduce((a, p) => a + (o.table[p][c] ?? 0n), 0n);
    if ((o.custody[c] ?? 0n) !== sum) {
      fail(
        `PER-COLOUR INVARIANT ${c} — ${c.startsWith('S') ? 'pool' : 'contract ledger balance'} is ` +
          `${o.custody[c]} but AA_A+AA_B = ${sum}`,
      );
    }
  }

  // --- 7. no shielded pool may exist for a colour nobody owns, and vice versa ----------------------
  for (const colour of o.colours) {
    if (colour.family !== 'shielded') continue;
    const sum = AA_PARTIES.reduce((a, p) => a + (o.table[p][colour.name] ?? 0n), 0n);
    if (o.pools[colour.name]!.present !== sum > 0n) {
      fail(`pool presence for ${colour.name} is ${o.pools[colour.name]!.present} while accounts hold ${sum}`);
    }
  }

  // --- 8. DORMANT colours: 0 everywhere, and absent from EVERY map (FR-206) ------------------------
  for (const name of dormant) {
    if (!cols.includes(name)) continue;
    for (const p of PARTIES) {
      if ((o.table[p][name] ?? 0n) !== 0n) fail(`DORMANT colour ${name} is held by ${p}: ${o.table[p][name]}`);
    }
    if ((o.custody[name] ?? 0n) !== 0n) fail(`DORMANT colour ${name} has custody ${o.custody[name]}`);
    const colour = o.colours.find((c) => c.name === name);
    if (colour) {
      if (o.manager.pools[colour.hex.toLowerCase()]) fail(`DORMANT colour ${name} has a POOL`);
      if (o.manager.kernelUnshielded[colour.hex.toLowerCase()] !== undefined) {
        fail(`DORMANT colour ${name} appears in the ledger kernel's unshielded balance map`);
      }
      for (const p of AA_PARTIES) {
        const acct = d.raw[p as 'AA_A' | 'AA_B'];
        if (o.manager.shieldedBalances[shieldedKeyOf(acct, colour.raw)] !== undefined) {
          fail(`DORMANT colour ${name} has a SHIELDED cell for ${p}`);
        }
        if (o.manager.unshieldedBalances[unshieldedKeyOf(acct, colour.raw)] !== undefined) {
          fail(`DORMANT colour ${name} has an UNSHIELDED cell for ${p}`);
        }
      }
    }
  }

  // --- 9. observation point 2 for user unshielded holdings: the indexer reconstruction -------------
  if (!o.indexerUnshielded) fail('the indexer reconstruction was not performed — observation point 2 is missing');
  for (const colour of o.colours) {
    if (colour.family !== 'unshielded') continue;
    for (const p of ['OwnerN', 'OwnerM'] as const) {
      const fromIndexer = o.indexerUnshielded![p][colour.name] ?? 0n;
      if (fromIndexer !== (o.table[p][colour.name] ?? 0n)) {
        fail(
          `${p} ${colour.name} unshielded: observer wallet says ${o.table[p][colour.name]}, indexer ` +
            `reconstruction says ${fromIndexer}`,
        );
      }
    }
  }

  // --- 10. observation point 2 for user shielded holdings: ledger conservation, per colour ---------
  for (const c of cols) {
    const held = (o.custody[c] ?? 0n) + (o.table.OwnerN[c] ?? 0n) + (o.table.OwnerM[c] ?? 0n);
    if (held !== (minted[c] ?? 0n)) {
      fail(
        `CONSERVATION ${c} — minted ${minted[c] ?? 0n} but custody+OwnerN+OwnerM = ` +
          `${o.custody[c]}+${o.table.OwnerN[c]}+${o.table.OwnerM[c]} = ${held}`,
      );
    }
  }

  // --- 11. coin- and UTXO-level consistency with the reported wallet balances ----------------------
  for (const p of ['OwnerN', 'OwnerM'] as const) {
    for (const colour of o.colours) {
      const details = colour.family === 'shielded' ? o.coins[p][colour.name] : o.utxos[p][colour.name];
      const sum = (details ?? []).reduce((a: bigint, x: any) => a + BigInt(x.value), 0n);
      if (sum !== (o.table[p][colour.name] ?? 0n)) {
        fail(
          `${p} ${colour.name} ${colour.family === 'shielded' ? 'coins' : 'UTXOs'} sum to ${sum}, ` +
            `balance says ${o.table[p][colour.name]}`,
        );
      }
    }
  }

  // --- 12. the rotating on-chain spot check, when one was made -------------------------------------
  if (o.spotCheck && o.spotCheck.onChain !== o.spotCheck.ledgerState) {
    fail(
      `SPOT CHECK — on-chain ${o.spotCheck.circuit}(${o.spotCheck.account}, ${o.spotCheck.colour}) returned ` +
        `${o.spotCheck.onChain} but ledger state says ${o.spotCheck.ledgerState}`,
    );
  }
};

/** A stable, byte-comparable snapshot for the "funds unchanged / no state created" proofs. */
export const snapshot = (o: Observation): string =>
  JSON.stringify(
    {
      colours: o.colours.map((c) => ({ name: c.name, family: c.family, hex: c.hex, issuer: c.issuer })),
      table: o.table,
      custody: o.custody,
      pools: o.pools,
      sizes: o.sizes,
      accounts: o.manager.accounts,
      shieldedBalances: o.manager.shieldedBalances,
      unshieldedBalances: o.manager.unshieldedBalances,
      poolsRaw: o.manager.pools,
      kernelUnshielded: o.manager.kernelUnshielded,
      coins: o.coins,
      utxos: o.utxos,
    },
    bigints,
  );

/** The same content as an object, for embedding in evidence JSON. */
export const snapshotObject = (o: Observation): unknown => JSON.parse(snapshot(o));
