// G1 Phase 4 — create the demo wallets on the pinned rc4 lane and report their observable state.
//
// This is the first real exercise of the pinned wallet SDK against the pinned node+indexer, and
// therefore the concrete test of LANE.md Finding L-3 (the SDK's own compose targets node rc.3).
import { SEEDS } from '../lane.js';
import { closeParty, openParty, snapshot, waitSynced, type Party } from '../wallet.js';

const j = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x), 2);

/** Byte-ish SDK values ({data:{type:'Buffer',data:[…]}}, Uint8Array, Buffer) -> hex. */
const toHex = (v: any): string | undefined => {
  if (v instanceof Uint8Array) return Buffer.from(v).toString('hex');
  if (v?.data instanceof Uint8Array) return Buffer.from(v.data).toString('hex');
  if (Array.isArray(v?.data?.data)) return Buffer.from(v.data.data).toString('hex');
  if (Array.isArray(v?.data) && v?.type === 'Buffer') return Buffer.from(v.data).toString('hex');
  if (Array.isArray(v?.data)) return Buffer.from(v.data).toString('hex');
  return undefined;
};

/** SDK address/key values are structured objects; render a compact canonical form. */
const addr = (v: any): string => {
  if (v == null) return '(none)';
  if (typeof v === 'string') return v;

  // Canonical accessors on the pinned address-format classes:
  //   ShieldedAddress   -> coinPublicKeyString / encryptionPublicKeyString (getters)
  //   UnshieldedAddress -> hexString (getter)
  //   DustAddress       -> serialize()
  if (typeof v.coinPublicKeyString === 'string') {
    const enc = typeof v.encryptionPublicKeyString === 'string' ? v.encryptionPublicKeyString : '';
    return `coinPk=${v.coinPublicKeyString}${enc ? ` encPk=${enc}` : ''}`;
  }
  if (typeof v.hexString === 'string') return v.hexString;

  for (const m of ['toBech32m', 'toHexString', 'serialize', 'toString']) {
    if (typeof v?.[m] === 'function') {
      try {
        const s = v[m]();
        if (typeof s === 'string' && s !== '[object Object]') return s;
        const h = toHex(s);
        if (h) return h;
      } catch {
        /* try the next accessor */
      }
    }
  }
  const direct = toHex(v);
  if (direct) return direct;

  // Composite addresses (e.g. shielded = coin pk + encryption pk).
  const parts: string[] = [];
  for (const [k, val] of Object.entries(v)) {
    const h = toHex(val) ?? (typeof val === 'string' ? val : undefined);
    if (h) parts.push(`${k}=${h}`);
  }
  if (parts.length) return parts.join(' ');

  for (const f of ['address', 'value', 'raw', 'bytes']) {
    if (typeof v?.[f] === 'string') return v[f];
  }
  return j(v);
};

const describeState = (name: string, s: any) => {
  const lines: string[] = [];
  lines.push(`--- ${name}`);
  try {
    lines.push(`  shielded.address:    ${addr(s?.shielded?.address)}`);
    lines.push(`  shielded.coinPubKey: ${addr(s?.shielded?.coinPublicKey)}`);
    lines.push(`  shielded.balances:   ${j(s?.shielded?.balances ?? {})}`);
    lines.push(`  unshielded.address:  ${addr(s?.unshielded?.address)}`);
    lines.push(`  unshielded.balances: ${j(s?.unshielded?.balances ?? {})}`);
    lines.push(`  dust.address:        ${addr(s?.dust?.address)}`);
    lines.push(`  dust.balance:        ${j(s?.dust?.balance ?? s?.dust?.balances ?? {})}`);
    const p = s?.unshielded?.progress;
    if (p) {
      lines.push(
        `  unshielded.progress: applied=${p.appliedId} highest=${p.highestTransactionId} strictlyComplete=${p.isStrictlyComplete?.()}`,
      );
    }
  } catch (e) {
    lines.push(`  <failed to read state: ${e instanceof Error ? e.message : String(e)}>`);
  }
  return lines.join('\n');
};

const main = async () => {
  const only = process.argv[2]; // optional: open a single party
  const wanted: Array<[string, string]> = Object.entries(SEEDS).filter(([n]) => !only || n === only);

  console.log(`# G1 wallets — EXPERIMENTAL_LANE — ${new Date().toISOString()}`);
  const opened: Party[] = [];
  let failed = 0;

  try {
    for (const [name, seed] of wanted) {
      process.stdout.write(`opening ${name} … `);
      const t0 = Date.now();
      try {
        const p = await openParty(name, seed);
        opened.push(p);
        console.log(`ok (${Date.now() - t0}ms)`);

        // Address reporting does not require a completed sync.
        console.log(describeState(`${name} (initial)`, await snapshot(p)));

        // Genesis is the only wallet expected to hold funds on a fresh network; give every
        // wallet a bounded chance to reach strict sync so we can report honestly.
        try {
          const synced = await waitSynced(p, 90_000);
          console.log(describeState(`${name} (synced)`, synced));
        } catch (e) {
          console.log(`  [${name}] did not reach strict sync in 90s: ${e instanceof Error ? e.message : String(e)}`);
        }
      } catch (e) {
        failed++;
        console.log(`FAILED`);
        console.error(`  [${name}] ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
      }
    }
  } finally {
    for (const p of opened) await closeParty(p);
  }

  if (failed > 0) {
    console.error(`\n${failed} wallet(s) failed to open`);
    process.exit(1);
  }
  console.log('\nall wallets opened');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
