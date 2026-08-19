#!/usr/bin/env python3
"""Compare a clean-clone REPRODUCTION against the RETAINED ORIGINAL run — 00005-open-colour-custody.

    usage: compare-runs.py <originalRoot> <reproRoot>

Exit codes are the point of this script's design:

    0  the reproduction is demonstrably its OWN run AND matches what the specification asserts
    2  the reproduction FAILED THE FRESHNESS GUARD and nothing else — i.e. the two roots describe
       the same chain. This is the code the gate's SELF-TEST demands when it feeds the original in
       as its own "reproduction": a guard that cannot produce it is vacuous.
    1  a substantive divergence (with or without freshness problems)

Why the freshness half exists at all: retained evidence is COMMITTED, so `git clone` carries the
original run's `evidence/` into the clone, and the clone's own gates then overwrite it. A comparison
that only checked verdicts would therefore pass against the very files it was meant to reproduce.
So this script first proves the reproduction is a different chain — different contract addresses,
different colours, different pooled-coin nonces, and ZERO transaction ids in common — and only then
compares what the specification actually asserts.
"""
from __future__ import annotations

import json
import os
import sys

COLOUR_NAMES = ['S1', 'U1', 'S2', 'U2', 'S3', 'U3', 'S4', 'U4', 'S5', 'U5', 'XS', 'XU']
POOLED = ['S1', 'S2', 'S3', 'S4']
SPEC_END_SIZES = {'pools': 4, 'shieldedCells': 5, 'unshieldedCells': 3}
CONTROL_IDS = ['NC-1', 'NC-2', 'NC-3', 'NC-4', 'NC-5']

freshness: list[str] = []
problems: list[str] = []


def load(base: str, *parts: str):
    path = os.path.join(base, 'evidence', *parts)
    if not os.path.exists(path):
        raise SystemExit(f'missing evidence file: {path}')
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def all_tx_ids(ctx: dict, cells: dict) -> set[str]:
    """Every transaction id this run can name, from every record that holds one."""
    out: set[str] = set()
    for cell in cells['cells']:
        out.update(cell.get('txs') or [])
    for value in (ctx.get('deployTxs') or {}).values():
        if value:
            out.add(value)
    for value in (ctx.get('fundingTxs') or {}).values():
        if value:
            out.add(value)
    pcoll = ctx['probes']['pcoll']
    out.update(pcoll.get('txs') or [])
    out.update((pcoll.get('onChainCircuitReads') or {}).get('txs') or [])
    m3 = ctx['probes']['m3']
    out.update(m3.get('txIds') or [])
    out.update((m3.get('onChainCircuitReads') or {}).get('txs') or [])
    deploy = ctx.get('managerDeploy') or {}
    for key in ('txHash',):
        if deploy.get(key):
            out.add(deploy[key])
    return {t for t in out if t}


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    root, clone = sys.argv[1], sys.argv[2]

    octx, rctx = load(root, 'g3-ledger', 'run-context.json'), load(clone, 'g3-ledger', 'run-context.json')
    ocells_doc, rcells_doc = load(root, 'g3-ledger', 'cells.json'), load(clone, 'g3-ledger', 'cells.json')
    ocells = {c['id']: c for c in ocells_doc['cells']}
    rcells = {c['id']: c for c in rcells_doc['cells']}
    octl = {c['id']: c for c in load(root, 'g3-ledger', 'negative-controls.json')['controls']}
    rctl = {c['id']: c for c in load(clone, 'g3-ledger', 'negative-controls.json')['controls']}

    # ------------------------------------------------------------------ freshness
    print('== freshness — is the "reproduction" a different chain at all?')
    print(f"  Manager      original {octx['managerAddress']}")
    print(f"               repro    {rctx['managerAddress']}")
    if octx['managerAddress'] == rctx['managerAddress']:
        freshness.append('the reproduction reports the SAME Manager address as the original — its '
                         'evidence is the committed original, not a fresh run')

    ominters = {m['label']: m for m in octx['minters']}
    rminters = {m['label']: m for m in rctx['minters']}
    if set(ominters) != set(rminters):
        problems.append(f'the two runs deployed different issuing contracts: {sorted(set(ominters) ^ set(rminters))}')
    for label in sorted(set(ominters) & set(rminters)):
        o, r = ominters[label], rminters[label]
        print(f"  {label:14} ({o['tagText']}) original {o['address']}")
        print(f"  {'':14}        repro    {r['address']}")
        if o['address'] == r['address']:
            freshness.append(f'{label} has the SAME address in both runs')

    same_colours = [c for c in COLOUR_NAMES
                    if octx['colours'].get(c, {}).get('hex') == rctx['colours'].get(c, {}).get('hex')]
    print(f"  colours: {len(COLOUR_NAMES) - len(same_colours)}/{len(COLOUR_NAMES)} differ "
          f"(colours are address-scoped and CANNOT repeat on a new chain)")
    for c in same_colours:
        freshness.append(f'colour {c} is identical in both runs')

    if octx['probes']['pcoll']['collidingColour'] == rctx['probes']['pcoll']['collidingColour']:
        freshness.append('the P-COLL colliding colour is identical in both runs')

    for c in POOLED:
        onon = (octx['finalWalkTable']['pools'].get(c) or {}).get('nonce')
        rnon = (rctx['finalWalkTable']['pools'].get(c) or {}).get('nonce')
        if onon and onon == rnon:
            freshness.append(f'pooled coin nonce for {c} is identical in both runs')
    print('  pooled coin nonces differ: '
          f"{all((octx['finalWalkTable']['pools'].get(c) or {}).get('nonce') != (rctx['finalWalkTable']['pools'].get(c) or {}).get('nonce') for c in POOLED)}")

    otx, rtx = all_tx_ids(octx, ocells_doc), all_tx_ids(rctx, rcells_doc)
    shared = sorted(otx & rtx)
    print(f'  transaction ids: {len(otx)} original, {len(rtx)} reproduced, {len(shared)} IN COMMON')
    if shared:
        freshness.append(f'{len(shared)} transaction id(s) appear in BOTH runs; a fresh chain cannot '
                         f'reproduce them: {shared[:3]}')

    # The account commitments are hashes of DETERMINISTIC dev seeds, so they are expected to be the
    # same fixture on a different chain. Printed as context, never asserted as freshness.
    print(f"  AA_A commitment: original {octx['accounts']['AA_A']}")
    print(f"                   repro    {rctx['accounts']['AA_A']}  "
          f"({'same fixture' if octx['accounts']['AA_A'] == rctx['accounts']['AA_A'] else 'DIFFERENT'})")

    # ------------------------------------------------------------------ deploy order (FR-205)
    print('== deploy order — the Manager exists before anything that can mint')
    rows = {r['contract']: r for r in rctx['deployOrder']['rows']}
    print(f"  Manager deploy block {rctx['deployOrder']['managerBlock']} "
          f"(chain tip before ANY deploy: {rctx['chainTipBeforeAnyDeploy']['height']})")
    for name in sorted(rows):
        r = rows[name]
        print(f"  {name:14} block {r['deployBlock']:5} strictlyLater={r['strictlyLater']} "
              f"absentAtManagerBlock={r['absentAtManagerBlock']}/{r['absentAtManagerBlockAtOrBefore']}")
        if not (r['strictlyLater'] and r['absentAtManagerBlock'] and r['absentAtManagerBlockAtOrBefore']):
            problems.append(f'{name} does not reproduce the deploy-order proof')
    if rctx['chainTipBeforeAnyDeploy']['height'] >= rctx['deployOrder']['managerBlock']:
        problems.append('the recorded chain tip is not before the Manager deploy block')
    tokd = rows.get('Minter4')
    if tokd and tokd['deployBlock'] <= rctx['deployOrder']['managerBlock']:
        problems.append('TOKD (the mid-ledger colour) was not deployed after the Manager')

    # ------------------------------------------------------------------ checklist
    print('== checklist')
    missing = sorted(set(ocells) - set(rcells))
    extra = sorted(set(rcells) - set(ocells))
    differ = sorted(i for i in set(ocells) & set(rcells)
                    if (ocells[i]['status'], ocells[i]['level'], ocells[i]['step'])
                    != (rcells[i]['status'], rcells[i]['level'], rcells[i]['step']))
    for c in rcells_doc['cells']:
        print(f"  {c['status']:6} {c['id']:22} step {str(c['step']):12} level {c['level']}")
    green = sum(1 for c in rcells.values() if c['status'] == 'GREEN')
    print(f'  original {len(ocells)} items, reproduced {len(rcells)} items, {green} GREEN')
    notgreen = sorted(i for i, c in rcells.items() if c['status'] != 'GREEN')
    if missing:
        problems.append(f'MISSING in the reproduction: {missing}')
    if extra:
        problems.append(f'EXTRA in the reproduction: {extra}')
    if differ:
        problems.append(f'DIVERGENT verdicts: {differ}')
    if notgreen:
        problems.append(f'NOT GREEN in the reproduction: {notgreen}')

    # ------------------------------------------------------------------ the normative final table
    print('== final table, custody and the EXACT end-state map sizes')
    if octx['finalWalkTable']['table'] != rctx['finalWalkTable']['table']:
        problems.append('the final party x colour table differs between the runs')
    if octx['finalWalkTable']['custody'] != rctx['finalWalkTable']['custody']:
        problems.append('the final custody figures (pools / ledger balances) differ between the runs')
    if octx['finalTableMarkdown'] != rctx['finalTableMarkdown']:
        problems.append('the rendered final table differs between the runs')
    for line in rctx['finalTableMarkdown']:
        print(f'  {line}')
    for name, sizes in (('reproduced walk', rctx['endStateMapSizes']),
                        ('spec', rctx['specEndStateMapSizes'])):
        print(f'  end-state map sizes ({name}): {json.dumps(sizes, sort_keys=True)}')
        if sizes != SPEC_END_SIZES:
            problems.append(f'end-state map sizes ({name}) are not {SPEC_END_SIZES}: {sizes}')
    if octx['mintedTotals'] != rctx['mintedTotals']:
        problems.append('the minted totals differ between the runs')

    # every step's exact map sizes, row by row — FR-205's "zero unaccounted keys", dynamic
    print('== per-step map sizes (all 18 rows)')
    for n in range(18):
        o = load(root, 'g3-ledger', f'step-{n}', 'step.json')
        r = load(clone, 'g3-ledger', f'step-{n}', 'step.json')
        osz, rsz = o['observedMapSizes'], r['observedMapSizes']
        marker = 'ok' if osz == rsz else 'DIFFER'
        print(f"  step {n:2} {json.dumps(rsz, sort_keys=True)}  {marker}")
        if osz != rsz:
            problems.append(f'step {n}: map sizes differ — original {osz}, repro {rsz}')
        if o['observed']['table'] != r['observed']['table'] or o['observed']['custody'] != r['observed']['custody']:
            problems.append(f'step {n}: the observed table or custody figures differ between the runs')
        if r['expected']['mapSizes'] != rsz:
            problems.append(f'step {n}: the reproduction observed map sizes that are not the expected ones')
        for kind, keys in (r.get('unaccountedKeys') or {}).items():
            if keys:
                problems.append(f'step {n}: the reproduction reports UNACCOUNTED {kind} keys: {keys}')

    # ------------------------------------------------------------------ dormant colour (FR-206)
    print('== FR-206 — U3 dormant')
    last = load(clone, 'g3-ledger', 'step-17', 'step.json')
    u3_cells = [row.get('U3') for row in last['observed']['table'].values()]
    print(f"  U3 across all four parties at row 17: {u3_cells}; custody {last['observed']['custody'].get('U3')}")
    if any(v not in ('0', 0) for v in u3_cells) or last['observed']['custody'].get('U3') not in ('0', 0):
        problems.append('U3 is not zero everywhere in the reproduction')

    # ------------------------------------------------------------------ distinctness + probes
    print('== distinctness, P-COLL and M3')
    rd = rctx['probes']['distinctness']
    print(f"  distinctness: original {octx['probes']['distinctness']['distinct']}/"
          f"{octx['probes']['distinctness']['comparisons']}, repro {rd['distinct']}/{rd['comparisons']}, "
          f"collisions {len(rd['collisions'])}")
    if (rd['distinct'], rd['comparisons']) != (45, 45) or rd['collisions'] or not rd['ok']:
        problems.append('the reproduction did not report 45/45 distinct colours with no collisions')
    if not rd['collider']['byteIdentical']:
        problems.append("the reproduction did not reproduce MinterCollide's INVERTED byte-equality")
    if rd['collider']['contaminates']:
        problems.append('the colliding colour contaminated the distinct colour set in the reproduction')

    op, rp = octx['probes']['pcoll'], rctx['probes']['pcoll']
    print(f"  P-COLL after both deposits: pool {rp['afterBothDeposits']['pool']} vs ledger "
          f"{rp['afterBothDeposits']['contractLedgerBalance']}; after independent withdrawals: "
          f"pool {rp['afterIndependentWithdrawals']['pool']} vs ledger "
          f"{rp['afterIndependentWithdrawals']['contractLedgerBalance']}")
    print(f"  P-COLL on-chain circuit reads of the IDENTICAL 32-byte argument: {rp['onChainCircuitReads']}")
    if not rp['familyKeysForAA_B']['differ']:
        problems.append('the reproduction did not keep the two family KEYS for the colliding colour apart')
    if rp['familyKeysForAA_B']['shielded'] == op['familyKeysForAA_B']['shielded']:
        freshness.append('the P-COLL shielded family key is identical in both runs')
    for field in ('pool', 'contractLedgerBalance', 'AA_B shielded cell', 'AA_B unshielded cell'):
        if op['afterBothDeposits'][field] != rp['afterBothDeposits'][field]:
            problems.append(f'P-COLL "{field}" after both deposits differs between the runs')
        if op['afterIndependentWithdrawals'][field] != rp['afterIndependentWithdrawals'][field]:
            problems.append(f'P-COLL "{field}" after the independent withdrawals differs between the runs')
    o_reads = {k: v for k, v in op['onChainCircuitReads'].items() if k != 'txs' and k != 'note'}
    r_reads = {k: v for k, v in rp['onChainCircuitReads'].items() if k != 'txs' and k != 'note'}
    if o_reads != r_reads:
        problems.append(f'P-COLL on-chain circuit reads differ: original {o_reads}, repro {r_reads}')

    om, rm = octx['probes']['m3'], rctx['probes']['m3']
    print(f"  M3 composed in one transaction: {rm['composedInOneTransaction']}; tx {rm['txIds']}")
    print(f"  M3 shape: {rm['shape']}")
    print(f"  M3 map sizes {json.dumps(rm['mapSizesBefore'], sort_keys=True)} -> "
          f"{json.dumps(rm['mapSizesAfter'], sort_keys=True)}; attempts: "
          f"{[(a['attempt'], a['ok']) for a in rm.get('attempts', [])]}")
    if not rm['composedInOneTransaction']:
        problems.append('M3 did not compose both first deposits into one transaction in the reproduction '
                        "— FR-207's fallback fired, which is a DIFFERENT outcome from the original")
    if len(rm['txIds']) != 1:
        problems.append(f"M3 carried {len(rm['txIds'])} transaction ids in the reproduction, not 1")
    if sorted(rm['circuits']) != sorted(om['circuits']):
        problems.append('M3 carried different circuits in the two runs')
    if (om['mapSizesBefore'], om['mapSizesAfter']) != (rm['mapSizesBefore'], rm['mapSizesAfter']):
        problems.append('M3 lazy-init map-size transition differs between the runs')
    if om['txIds'] and om['txIds'] == rm['txIds']:
        freshness.append('the M3 transaction id is identical in both runs')

    # ------------------------------------------------------------------ negative controls
    print('== negative controls — verdict, verbatim message, funds AND no-state-created')
    if set(octl) != set(rctl):
        problems.append(f'control sets differ: {sorted(set(octl) ^ set(rctl))}')
    if sorted(rctl) != sorted(CONTROL_IDS):
        problems.append(f'the reproduction did not run exactly {CONTROL_IDS}: {sorted(rctl)}')
    for cid in sorted(set(octl) & set(rctl)):
        o, r = octl[cid], rctl[cid]
        print(f"  {r['status']:6} {cid:6} message-matched={r['messageMatched']} "
              f"funds-unchanged={r['fundsUnchanged']} map-sizes-unchanged={r['mapSizesUnchanged']}")
        if not (o['status'] == r['status'] == 'GREEN' and r['messageMatched'] and r['fundsUnchanged']
                and r['mapSizesUnchanged']):
            problems.append(f'control {cid} did not reproduce GREEN with message matched, funds unchanged '
                            f'and map sizes unchanged')
        if o['reason'] != r['reason']:
            problems.append(f'control {cid} was refused with a DIFFERENT verbatim message:\n'
                            f"      original: {o['reason']}\n      repro:    {r['reason']}")
        if o['noStateCreated'].keys() != r['noStateCreated'].keys():
            problems.append(f'control {cid} reproduced a different set of no-state-created proofs')
        for key, value in r['noStateCreated'].items():
            print(f'         no state created — {key}: {value}')

    # ------------------------------------------------------------------ verdict
    if problems:
        print('\nREPRODUCTION FAILED:')
        for x in problems:
            print(f'  - {x}')
        for x in freshness:
            print(f'  - [freshness] {x}')
        return 1
    if freshness:
        print('\nFRESHNESS GUARD REJECTED THIS PAIR — the two roots describe the SAME chain:')
        for x in freshness:
            print(f'  - {x}')
        print('\nEvery substantive comparison passed, which is exactly why the freshness guard has to')
        print('exist: verdict-matching alone cannot tell a reproduction from the committed original.')
        return 2
    print('\nreproduction matches the original item for item, verdict for verdict, map size for map size')
    print('and control message for control message — on a demonstrably different chain, with zero')
    print('transaction ids in common')
    return 0


if __name__ == '__main__':
    sys.exit(main())
