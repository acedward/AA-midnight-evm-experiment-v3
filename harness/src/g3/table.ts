// G3 — the 4-party x 4-colour table: the spec's core assertion artifact (FR-105).
//
// 16 cells (OwnerN, OwnerM, AA_A, AA_B x S1, S2, U1, U2), plus the two shielded pool values and the
// two unshielded contract-ledger balances, are read and asserted after EVERY step. Any movement in
// a cell the step did not name is a step failure — and because `registerAccount` seeds all four
// colours at zero, the assertion is an ENUMERATION of real ledger state (`balances.size()` is
// exactly `accounts x 4`, with every key reproduced by the contract's own pure `balanceKey`
// circuit) rather than a lookup of the cells the harness happened to think of (finding F-106).
//
// The observation points behind each cell are documented in `observe.ts`. The one rule that shapes
// this module: **a wallet that submitted a transaction is never an observation point** (finding
// F-104) — user cells are read from OBSERVER wallets that only ever read, cross-checked against the
// indexer (unshielded) and against the ledger conservation identity (shielded).
import {
  AA_PARTIES,
  COLOURS,
  PARTIES,
  SHIELDED_COLOURS,
  UNSHIELDED_COLOURS,
  USER_PARTIES,
  coinDetails,
  indexerUnshieldedByOwner,
  shieldedOfWallet,
  unshieldedOfWallet,
  utxoDetails,
  walletState,
  type CoinDetail,
  type ColourName,
  type ColourSet,
  type PartyName,
  type UtxoDetail,
} from './observe.js';
import { balanceKeyOf, readManager, type ManagerView } from '../manager-view.js';
import type { Party } from '../wallet.js';

export type Row = Record<ColourName, bigint>;
export type Table = Record<PartyName, Row>;

export const row = (S1: bigint, S2: bigint, U1: bigint, U2: bigint): Row => ({ S1, S2, U1, U2 });

/** What the Manager itself custodies per colour: a pooled coin (shielded) or a ledger balance. */
export type Custody = Record<ColourName, bigint>;

export type PoolDetail = { present: boolean; value: bigint; nonce: string };

/** One fully-specified expected state: the 16 cells AND the four custody figures. */
export type ExpectedState = { table: Table; custody: Custody };

export type Observation = {
  table: Table;
  /** poolS1, poolS2, ledgerU1, ledgerU2 — the four custody figures the spec asserts per step. */
  custody: Custody;
  /** Identity as well as value for each shielded pool: an internal transfer must not move either. */
  pools: Record<ColourName, PoolDetail>;
  manager: ManagerView;
  /** Per-user, per-colour shielded coins and unshielded UTXOs, from the OBSERVER wallets. */
  coins: Record<'OwnerN' | 'OwnerM', Record<ColourName, CoinDetail[]>>;
  utxos: Record<'OwnerN' | 'OwnerM', Record<ColourName, UtxoDetail[]>>;
  /**
   * User unshielded holdings reconstructed from the indexer — observation point 2. Filled in only
   * at assertion points: it costs one query per submitted transaction, so the polling loops that
   * wait for finality deliberately skip it.
   */
  indexerUnshielded?: Record<'OwnerN' | 'OwnerM', Record<'U1' | 'U2', bigint>>;
  /** The rotating on-chain `accountBalance` spot check for this step, if one was made. */
  spotCheck?: { account: PartyName; colour: ColourName; onChain: bigint; ledgerState: bigint; txish: string };
};

export type ObserveDeps = {
  managerProviders: any;
  managerAddress: string;
  colours: ColourSet;
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

/** Read every observation point once. Never call this and assume finality — use `waitForTable`. */
export const observe = async (d: ObserveDeps): Promise<Observation> => {
  const manager = await readManager(d.managerProviders, d.managerAddress);

  const cell = (account: PartyName, colour: ColourName): bigint => {
    const key = balanceKeyOf(d.raw[account as 'AA_A' | 'AA_B'], d.colours.raw[colour]);
    return manager.balances[key] ?? 0n;
  };

  const [sN, sM] = await Promise.all([walletState(d.observers.OwnerN), walletState(d.observers.OwnerM)]);
  const userState = { OwnerN: sN, OwnerM: sM } as const;

  const table = {} as Table;
  for (const p of PARTIES) table[p] = row(0n, 0n, 0n, 0n);
  for (const colour of COLOURS) {
    const chex = d.colours.hex[colour];
    const shielded = SHIELDED_COLOURS.includes(colour);
    for (const p of AA_PARTIES) table[p][colour] = cell(p, colour);
    for (const p of USER_PARTIES) {
      table[p][colour] = shielded
        ? shieldedOfWallet(userState[p as 'OwnerN' | 'OwnerM'], chex)
        : unshieldedOfWallet(userState[p as 'OwnerN' | 'OwnerM'], chex);
    }
  }

  const pools = {} as Record<ColourName, PoolDetail>;
  const custody = {} as Custody;
  for (const colour of COLOURS) {
    const chex = d.colours.hex[colour].toLowerCase();
    if (SHIELDED_COLOURS.includes(colour)) {
      const p = manager.pools[chex];
      pools[colour] = p
        ? { present: true, value: p.value, nonce: p.nonce }
        : { present: false, value: 0n, nonce: '' };
      custody[colour] = pools[colour].value;
    } else {
      pools[colour] = { present: false, value: 0n, nonce: '' };
      custody[colour] = manager.kernelUnshielded[chex] ?? 0n;
    }
  }

  const coins = { OwnerN: {}, OwnerM: {} } as Observation['coins'];
  const utxos = { OwnerN: {}, OwnerM: {} } as Observation['utxos'];
  for (const p of ['OwnerN', 'OwnerM'] as const) {
    for (const colour of COLOURS) {
      coins[p][colour] = coinDetails(userState[p], d.colours.hex[colour]);
      utxos[p][colour] = utxoDetails(userState[p], d.colours.hex[colour]);
    }
  }

  return { table, custody, pools, manager, coins, utxos };
};

export const tableEquals = (a: Table, b: Table): boolean =>
  PARTIES.every((p) => COLOURS.every((c) => a[p][c] === b[p][c]));

export const custodyEquals = (a: Custody, b: Custody): boolean => COLOURS.every((c) => a[c] === b[c]);

/** One line per party — the divergence output the spec's halt-on-first-divergence rule prints. */
export const renderTable = (t: Table): string =>
  PARTIES.map((p) => `${p}=[${COLOURS.map((c) => `${c}:${t[p][c]}`).join(' ')}]`).join('  ');

export const renderCustody = (c: Custody): string =>
  `poolS1=${c.S1} poolS2=${c.S2} ledgerU1=${c.U1} ledgerU2=${c.U2}`;

/** The full markdown table, for evidence and for a legible divergence report. */
export const renderMarkdownTable = (t: Table, custody: Custody): string[] => [
  '|  | S1 | S2 | U1 | U2 |',
  '|---|---|---|---|---|',
  ...PARTIES.map((p) => `| ${p} | ${t[p].S1} | ${t[p].S2} | ${t[p].U1} | ${t[p].U2} |`),
  `| pool / ledger | poolS1=${custody.S1} | poolS2=${custody.S2} | ledgerU1=${custody.U1} | ledgerU2=${custody.U2} |`,
];

/**
 * Poll until the observed table AND the four custody figures match `expected`.
 *
 * Reading once immediately after `submitTx` returns PRE-transaction state and would report a false
 * divergence, so the wait is on the expected condition. A timeout IS the halt-on-first-divergence
 * failure the spec requires, and it reports exactly what was observed instead.
 *
 * Halfway through the budget the OBSERVER wallets are re-opened once. That is the F-104 contingency:
 * the observers never submit, so they should never be wrong, but a stale observer would otherwise
 * hang the whole run with no diagnosis, and a fresh facade on the same seed is known to read the
 * chain correctly.
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
    if (tableEquals(last.table, expected.table) && custodyEquals(last.custody, expected.custody)) return last;
    if (!refreshed && Date.now() > start + timeoutMs / 2) {
      refreshed = true;
      console.log(`  [step ${step}] observation is running long — re-opening the observer wallets (F-104 contingency)`);
      await d.refreshObservers();
    }
    if (Date.now() > deadline) {
      throw new Error(
        `STEP ${step} DIVERGENCE — after ${timeoutMs}ms\n` +
          `  expected  ${renderTable(expected.table)}  ${renderCustody(expected.custody)}\n` +
          `  observed  ${renderTable(last.table)}  ${renderCustody(last.custody)}`,
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
      throw new Error(
        `timed out after ${timeoutMs}ms waiting for ${what}; observed ${renderTable(last.table)} ` +
          `${renderCustody(last.custody)}`,
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
  const byOwner = await indexerUnshieldedByOwner(d.submittedTxs, [d.colours.hex.U1, d.colours.hex.U2]);
  const read = (who: 'OwnerN' | 'OwnerM', colour: 'U1' | 'U2'): bigint =>
    byOwner.get(d.addresses[who].toLowerCase())?.get(d.colours.hex[colour].toLowerCase()) ?? 0n;
  return {
    ...o,
    indexerUnshielded: {
      OwnerN: { U1: read('OwnerN', 'U1'), U2: read('OwnerN', 'U2') },
      OwnerM: { U1: read('OwnerM', 'U1'), U2: read('OwnerM', 'U2') },
    },
  };
};

/**
 * Everything that must hold after EVERY step (FR-105, FR-108).
 *
 * `minted` is the total the Minters have issued of each colour so far — the harness knows it
 * exactly because it issues every mint.
 */
export const assertAll = (
  o: Observation,
  expected: ExpectedState,
  step: string,
  minted: Custody,
  d: ObserveDeps,
): void => {
  const fail = (msg: string): never => {
    throw new Error(
      `STEP ${step} DIVERGENCE — ${msg}\n` +
        `  observed  ${renderTable(o.table)}  ${renderCustody(o.custody)}`,
    );
  };

  // --- 1. the full 16-cell table, exactly ------------------------------------------------------
  if (!tableEquals(o.table, expected.table)) {
    fail(`table is [${renderTable(o.table)}], expected [${renderTable(expected.table)}]`);
  }
  // --- 2. both pools and both unshielded contract balances, exactly -----------------------------
  if (!custodyEquals(o.custody, expected.custody)) {
    fail(`custody is [${renderCustody(o.custody)}], expected [${renderCustody(expected.custody)}]`);
  }

  // --- 3. the table is an ENUMERATION of ledger state, not a lookup (F-106) ---------------------
  const accounts = o.manager.accounts.length;
  if (Number(o.manager.balanceCount) !== accounts * 4) {
    fail(`balances holds ${o.manager.balanceCount} entries, expected ${accounts * 4} (${accounts} accounts x 4 colours)`);
  }
  const accountedKeys = new Set<string>();
  for (const p of AA_PARTIES) {
    for (const c of COLOURS) accountedKeys.add(balanceKeyOf(d.raw[p as 'AA_A' | 'AA_B'], d.colours.raw[c]));
  }
  const unaccounted = Object.keys(o.manager.balances).filter((k) => !accountedKeys.has(k));
  if (unaccounted.length > 0) fail(`unaccounted balance cells in ledger state: ${unaccounted.join(', ')}`);

  // --- 4. the per-colour invariant (FR-105) ------------------------------------------------------
  for (const c of COLOURS) {
    const sum = AA_PARTIES.reduce((a, p) => a + o.table[p][c], 0n);
    if (o.custody[c] !== sum) {
      fail(
        `PER-COLOUR INVARIANT ${c} — ${SHIELDED_COLOURS.includes(c) ? 'pool' : 'contract ledger balance'} is ` +
          `${o.custody[c]} but AA_A+AA_B = ${sum}`,
      );
    }
  }

  // --- 5. no shielded pool may exist for a colour nobody owns, and vice versa ---------------------
  for (const c of SHIELDED_COLOURS) {
    const sum = AA_PARTIES.reduce((a, p) => a + o.table[p][c], 0n);
    if (o.pools[c].present !== sum > 0n) {
      fail(`pool presence for ${c} is ${o.pools[c].present} while accounts hold ${sum}`);
    }
  }

  // --- 6. observation point 2 for user unshielded holdings: the indexer reconstruction ------------
  if (!o.indexerUnshielded) fail('the indexer reconstruction was not performed — observation point 2 is missing');
  for (const p of ['OwnerN', 'OwnerM'] as const) {
    for (const c of ['U1', 'U2'] as const) {
      if (o.indexerUnshielded![p][c] !== o.table[p][c]) {
        fail(
          `${p} ${c} unshielded: observer wallet says ${o.table[p][c]}, indexer reconstruction says ` +
            `${o.indexerUnshielded![p][c]}`,
        );
      }
    }
  }

  // --- 7. observation point 2 for user shielded holdings: ledger conservation, per colour ---------
  for (const c of COLOURS) {
    const held = o.custody[c] + o.table.OwnerN[c] + o.table.OwnerM[c];
    if (held !== minted[c]) {
      fail(
        `CONSERVATION ${c} — minted ${minted[c]} but custody+OwnerN+OwnerM = ` +
          `${o.custody[c]}+${o.table.OwnerN[c]}+${o.table.OwnerM[c]} = ${held}`,
      );
    }
  }

  // --- 8. coin- and UTXO-level consistency with the reported wallet balances ----------------------
  for (const p of ['OwnerN', 'OwnerM'] as const) {
    for (const c of SHIELDED_COLOURS) {
      const sum = o.coins[p][c].reduce((a, x) => a + BigInt(x.value), 0n);
      if (sum !== o.table[p][c]) fail(`${p} ${c} coins sum to ${sum}, balance says ${o.table[p][c]}`);
    }
    for (const c of UNSHIELDED_COLOURS) {
      const sum = o.utxos[p][c].reduce((a, x) => a + BigInt(x.value), 0n);
      if (sum !== o.table[p][c]) fail(`${p} ${c} UTXOs sum to ${sum}, balance says ${o.table[p][c]}`);
    }
  }

  // --- 9. the rotating on-chain spot check, when one was made ------------------------------------
  if (o.spotCheck && o.spotCheck.onChain !== o.spotCheck.ledgerState) {
    fail(
      `SPOT CHECK — on-chain accountBalance(${o.spotCheck.account}, ${o.spotCheck.colour}) returned ` +
        `${o.spotCheck.onChain} but ledger state says ${o.spotCheck.ledgerState}`,
    );
  }
};

/** A stable, byte-comparable snapshot for the "funds unchanged" proofs the negative controls need. */
export const snapshot = (o: Observation): string =>
  JSON.stringify(
    {
      table: o.table,
      custody: o.custody,
      pools: o.pools,
      accounts: o.manager.accounts,
      balances: o.manager.balances,
      kernelUnshielded: o.manager.kernelUnshielded,
      colours: o.manager.colours,
      configured: o.manager.configured,
      coins: o.coins,
      utxos: o.utxos,
    },
    bigints,
  );

/** The same content as an object, for embedding in evidence JSON. */
export const snapshotObject = (o: Observation): unknown => JSON.parse(snapshot(o));
