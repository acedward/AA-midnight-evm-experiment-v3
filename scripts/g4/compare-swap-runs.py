#!/usr/bin/env python3
"""Compare a clean-clone REPRODUCTION against the RETAINED ORIGINAL run — 00006-unbalanced-zswap.

    usage: compare-swap-runs.py <originalRoot> <reproRoot>

Exit codes are the point of this script's design:

    0  the reproduction is demonstrably its OWN run AND matches what the specification asserts
    2  the reproduction FAILED THE FRESHNESS GUARD and nothing else — i.e. the two roots describe
       the same chain. This is the code the gate's SELF-TEST demands when it feeds the original in
       as its own "reproduction": a guard that cannot produce it is vacuous.
    1  a substantive divergence (with or without freshness problems)

WHY THE FRESHNESS HALF EXISTS AT ALL. Retained evidence is COMMITTED, so `git clone` carries the
original run's `evidence/` into the clone and the clone's own gates then overwrite it. A comparison
that only checked verdicts would therefore pass against the very files it was meant to reproduce.
So this script first proves the reproduction is a different chain — different Manager addresses (all
five of them: three step-ledger stages plus the spikes'), different colours, different pooled-coin
nonces, and ZERO transaction ids in common — and only then compares what the specification asserts.

WHAT "MATCHES" MEANS HERE, and why it is not string equality (00005 decision D-205's lesson). The
specification states several outcomes as DISJUNCTIONS and several as MEASUREMENTS, and a comparator
stricter than the specification is a comparator BUG, not extra rigour:

  * FR-308 openness is GREEN if EITHER open shape settles for a holder whose keys the maker never
    knew. Openness must be GREEN in both runs; WHICH shape delivered it may differ, and a difference
    is reported as a FINDING rather than a failure.
  * FR-311 (the staleness probe) and the cancellation probes are MEASURED, not judged. The refusal
    CODE is lane behaviour to record: 104 was predicted, 239 was measured (finding F-309). A code
    that differs between runs is a FINDING; what must hold is that the take was refused and that no
    state was created.
  * Spike S2 is a lane investigation feeding sibling issue 0001. Its verdict is reported, never
    required to match: it measures accept/refuse ratios over random draws.
  * Numbers embedded in check NAMES are therefore compared structurally (digits normalised), while
    the numbers that carry the specification's claims — every pool, every cell, every wallet's
    holding, the exact map sizes, the invariant and the conservation rows — are compared for exact
    equality out of each row's own observation. Nothing about the ledger's arithmetic is relaxed.
"""
from __future__ import annotations

import json
import os
import re
import sys

# Transaction ids on this lane are 66 lowercase hex characters. Account commitments are 64 and are
# hashes of DETERMINISTIC dev seeds, so they are the SAME fixture on a different chain and must never
# be used as a freshness signal — the length distinction keeps the two apart without a whitelist.
TXID = re.compile(r'^[0-9a-f]{66}$')
HEXRUN = re.compile(r'[0-9a-f]{16,}')

STAGES = ('a', 'b', 'c')
LANE = 'EXPERIMENTAL_LANE / LANE-DEV-1'

# Rows whose outcome the specification MEASURES rather than judges (FR-311, P-CXL, P-F310, and the
# deviation-evidencing probe). Their per-check verdicts may legitimately differ between runs; the
# core claims below must still hold.
MEASURED_ROWS = {'row-11', 'row-12a', 'row-12b', 'p-f310'}
# The claims that must hold in a MEASURED row whatever the lane answered. Matched against check names.
MEASURED_CORE = re.compile(
    r'(NO state created|funds unchanged|was REFUSED|was INVALIDATED|still ABSENT|nothing was published'
    r'|FAILS CLOSED|refused)', re.I)

freshness: list[str] = []
problems: list[str] = []
findings: list[str] = []


def load(root: str, *parts: str, required: bool = True):
    path = os.path.join(root, 'evidence', *parts)
    if not os.path.exists(path):
        if required:
            problems.append(f'missing evidence file: {os.path.join("evidence", *parts)} under {root}')
        return None
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def walk(node):
    """Every (key, value) pair anywhere in a JSON document."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield k, v
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)


def tx_ids(docs) -> set[str]:
    """Every transaction id anywhere in these documents, found by shape rather than by key name.

    Deliberately generic: a tx id recorded under a key this script has never heard of still counts,
    which is what a freshness guard needs — the guard must not be defeated by schema drift.
    """
    return {s for d in docs for s in strings(d) if TXID.match(s)}


def by_key(docs, key: str) -> set[str]:
    out: set[str] = set()
    for d in docs:
        for k, v in walk(d):
            if k == key and isinstance(v, str):
                out.add(v)
    return out


def colour_hexes(docs) -> set[str]:
    out: set[str] = set()
    for d in docs:
        for k, v in walk(d):
            if k == 'colours' and isinstance(v, dict):
                for cv in v.values():
                    if isinstance(cv, str) and len(cv) == 64:
                        out.add(cv)
    return out


def pool_nonces(docs) -> set[str]:
    out: set[str] = set()
    for d in docs:
        for k, v in walk(d):
            if k == 'poolCoins' and isinstance(v, dict):
                for coin in v.values():
                    if isinstance(coin, dict) and isinstance(coin.get('nonce'), str):
                        out.add(coin['nonce'])
    return out


def shape(name: str) -> str:
    """A check name with the run-specific parts removed: hex runs and digits.

    Structure is what must reproduce. The NUMBERS are compared separately and exactly, out of each
    row's own custody observation, so normalising them here loses nothing and keeps a lane detail
    such as a refusal code from being mistaken for a specification failure.
    """
    return re.sub(r'\d+', 'N', HEXRUN.sub('<hex>', name))


OP2_UNAVAILABLE = 'unavailable'
# Fields that describe the APPARATUS rather than the ledger. Never compared for equality: OP2 is
# itself a submitted transaction and can be refused (the F-301 flake), and marking that "UNAVAILABLE"
# is exactly what the harness is supposed to do. A row's substantive claims are carried by its checks
# and by OP1, so apparatus availability is reported, never scored.
APPARATUS_FIELDS = ('utc', 'poolCoins', 'accounts', 'op2Retries', 'op2Consulted', 'usersConsulted')


def core_of(after: dict | None, other: dict | None = None) -> dict | None:
    """The part of a custody observation that MUST reproduce exactly.

    Dropped: `utc` (a timestamp), `poolCoins` (coin identity — freshness, compared separately),
    `accounts` (commitments of deterministic dev seeds), and the apparatus-availability fields.

    `onChainCells` (observation point 2) is narrowed to the cells BOTH runs actually read: OP2 is a
    submitted transaction and can be refused, and a cell the harness marked UNAVAILABLE is apparatus
    noise. OP1's `cells` — the indexer-decoded contract state — is compared in full either way, so the
    narrowing cannot hide a state difference.
    """
    if not isinstance(after, dict):
        return None
    out = {k: v for k, v in after.items() if k not in APPARATUS_FIELDS}
    if isinstance(out.get('onChainCells'), dict):
        mine = out['onChainCells']
        theirs = (other or {}).get('onChainCells') if isinstance(other, dict) else None
        keep = {}
        for k, v in mine.items():
            if v == OP2_UNAVAILABLE:
                continue
            if isinstance(theirs, dict) and theirs.get(k) == OP2_UNAVAILABLE:
                continue
            keep[k] = v
        out['onChainCells'] = keep
    return out


def codes(row: dict) -> list[str]:
    out: list[str] = []
    for line in row.get('verbatim') or []:
        out += re.findall(r'Custom error: (\d+)', line)
    return sorted(out)


# ----------------------------------------------------------------------------- the step ledger
def compare_stages(root: str, clone: str) -> None:
    print('== the swap step ledger (D-307: three stages, three fresh Managers, one chain)')
    for st in STAGES:
        o = load(root, 'g3-swap-ledger', f'stage-{st}.json')
        r = load(clone, 'g3-swap-ledger', f'stage-{st}.json')
        if not o or not r:
            continue
        print(f'-- stage {st.upper()}: original {o["verdict"]}, reproduction {r["verdict"]} '
              f'({len(o["rows"])} / {len(r["rows"])} rows)')
        print(f'   carries: {r["carries"]}')
        print(f'   Manager: original {o["managerAddress"][:20]}…  repro {r["managerAddress"][:20]}…')
        for label, doc in (('original', o), ('reproduction', r)):
            if doc['verdict'] != 'GREEN':
                problems.append(f'stage {st.upper()} in the {label} is {doc["verdict"]}, not GREEN')
            if doc.get('fatal'):
                problems.append(f'stage {st.upper()} in the {label} died: {str(doc["fatal"])[:200]}')
            if doc.get('lane') != LANE:
                problems.append(f'stage {st.upper()} in the {label} is not labelled "{LANE}" (FR-309)')
            if (doc.get('deviation') or {}).get('id') != 'D-307':
                problems.append(f'stage {st.upper()} in the {label} does not record deviation D-307')
        if o['carries'] != r['carries']:
            problems.append(f'stage {st.upper()} carries different rows in the two runs')

        orows = {x['id']: x for x in o['rows']}
        rrows = {x['id']: x for x in r['rows']}
        if [x['id'] for x in o['rows']] != [x['id'] for x in r['rows']]:
            problems.append(f'stage {st.upper()} ran a different row list: original '
                            f'{[x["id"] for x in o["rows"]]}, repro {[x["id"] for x in r["rows"]]}')
        osum = {x['id']: x for x in o.get('rowSummary') or []}
        rsum = {x['id']: x for x in r.get('rowSummary') or []}

        for rid in [x['id'] for x in r['rows']]:
            rr = rrows[rid]
            orr = orows.get(rid)
            measured = rid in MEASURED_ROWS
            nchecks = f'{sum(1 for c in rr["checks"] if c["ok"])}/{len(rr["checks"])}'
            print(f'   {rr["status"]:9} {rid:16} {nchecks:8} {str(rr.get("title"))[:64]}')
            if orr is None:
                continue

            # --- status
            if rr['status'] != orr['status']:
                problems.append(f'row {rid}: status {orr["status"]} -> {rr["status"]}')
            if rr['status'] not in (('MEASURED', 'PASS') if measured else ('PASS',)):
                problems.append(f'row {rid}: status {rr["status"]} is not permitted for this row class')

            # --- the checks: structure always, verdicts strictly for ASSERTED rows
            if [shape(c['name']) for c in rr['checks']] != [shape(c['name']) for c in orr['checks']]:
                problems.append(f'row {rid}: the reproduction ran a STRUCTURALLY different check list')
            failed = [c['name'] for c in rr['checks'] if not c['ok']]
            if measured:
                for c in rr['checks']:
                    if not c['ok'] and MEASURED_CORE.search(c['name']):
                        problems.append(f'row {rid}: MEASURED row failed a core claim: {c["name"]}')
                for oc, rc in zip(orr['checks'], rr['checks']):
                    if oc['ok'] != rc['ok']:
                        findings.append(f'row {rid} is a MEASURED row and one of its checks changed '
                                        f'verdict between the runs: "{rc["name"]}" — original '
                                        f'{oc["ok"]}, reproduction {rc["ok"]}. Recorded, not scored: '
                                        f'the specification asks these rows to be measured.')
            elif failed:
                problems.append(f'row {rid}: {len(failed)} check(s) FAILED in the reproduction: {failed[:3]}')
            if rid in osum and rid in rsum and osum[rid].get('checks') != rsum[rid].get('checks'):
                # e.g. "20/20" — same count, all passing. A different denominator means a different
                # row was run under the same name.
                (findings if measured else problems).append(
                    f'row {rid}: check tally {osum[rid].get("checks")} -> {rsum[rid].get("checks")}')

            # --- the specification's own text, carried in the evidence from committed code
            for field in ('specRow', 'specAction', 'specExpected', 'title'):
                if orr.get(field) != rr.get(field):
                    problems.append(f'row {rid}: "{field}" differs between the runs — the expectation '
                                    f'table itself changed')

            # --- the arithmetic: every pool, cell, wallet holding, map size, invariant row
            for side in ('before', 'after'):
                ocore = core_of(orr.get(side), rr.get(side)) or {}
                rcore = core_of(rr.get(side), orr.get(side)) or {}
                if ocore != rcore:
                    diff = sorted(k for k in set(ocore) | set(rcore) if ocore.get(k) != rcore.get(k))
                    problems.append(f'row {rid}: the "{side}" custody observation differs in {diff}: '
                                    f'original { {k: ocore.get(k) for k in diff} } vs '
                                    f'reproduction { {k: rcore.get(k) for k in diff} }')
                # Apparatus availability: reported, never scored (see APPARATUS_FIELDS).
                ro, oo = rr.get(side) or {}, orr.get(side) or {}
                if isinstance(ro, dict) and isinstance(oo, dict):
                    skipped = sorted(k for k, v in (ro.get('onChainCells') or {}).items()
                                     if v == OP2_UNAVAILABLE)
                    if skipped:
                        findings.append(f'row {rid} ("{side}"): observation point 2 was UNAVAILABLE for '
                                        f'{skipped} in the reproduction — OP2 is itself a submitted '
                                        f'transaction and can be refused, so this is apparatus noise. '
                                        f'OP1 was compared in full for those cells.')
                    if oo.get('op2Consulted') and not ro.get('op2Consulted'):
                        findings.append(f'row {rid} ("{side}"): the reproduction did not consult '
                                        f'observation point 2 at all where the original did.')

            # --- refusal codes: recorded, and divergence reported rather than scored
            oc, rc = codes(orr), codes(rr)
            if oc or rc:
                print(f'      node refusal code(s): original {oc or "—"}, reproduction {rc or "—"}')
            if oc != rc:
                findings.append(f'row {rid}: the node refused with code(s) {rc} where the original '
                                f'recorded {oc}. Both are lane behaviour; the specification asks for a '
                                f'refusal with a verbatim error, and both runs have one.')
            if (orr.get('verbatim') and not rr.get('verbatim')):
                problems.append(f'row {rid}: the reproduction recorded NO verbatim error where the '
                                f'original did — every refusal must be recorded verbatim')

            # --- transaction ids: a settled row must settle, and never with the original's id
            if len(orr.get('txIds') or []) != len(rr.get('txIds') or []):
                problems.append(f'row {rid}: {len(orr.get("txIds") or [])} transaction id(s) in the '
                                f'original, {len(rr.get("txIds") or [])} in the reproduction')
            if set(orr.get('txIds') or []) & set(rr.get('txIds') or []):
                freshness.append(f'row {rid} reports a transaction id that appears in BOTH runs')

        # the settlements the specification's headline rests on
        for rid, what in (('row-5', 'the HEADLINE v1 settlement (spec row 5)'),
                          ('row-8', 'the OPEN offer settling for a stranger (spec rows 7-8, FR-308)')):
            if rid in rrows:
                ids = rrows[rid].get('txIds') or []
                print(f'   {what}: ONE tx id = {len(ids) == 1}  {ids}')
                if len(ids) != 1:
                    problems.append(f'{what} did not land under exactly one transaction id')


# ----------------------------------------------------------------------------- spikes G1
def compare_g1(root: str, clone: str) -> None:
    print('== G1 spikes')
    for name, fname, require in (('S1 foreign wallet balances a contract call', 's1-foreign-balance.json', 'GREEN'),
                                 ('S3 offer round-trip + D-306', 's3-offer-roundtrip.json', 'GREEN')):
        o = load(root, 'g1-spikes', fname)
        r = load(clone, 'g1-spikes', fname)
        if not o or not r:
            continue
        print(f'-- {name}: original {o["verdict"]}, reproduction {r["verdict"]}')
        for label, doc in (('original', o), ('reproduction', r)):
            if not str(doc['verdict']).startswith(require):
                problems.append(f'spike {fname} in the {label} is "{doc["verdict"]}", and {require} is required')
        if fname == 's3-offer-roundtrip.json':
            od, rd = o.get('decisionD306'), r.get('decisionD306')
            print(f'   D-306 published artifact form: original {json.dumps(od)[:80]}, repro {json.dumps(rd)[:80]}')
            if json.dumps(od, sort_keys=True) != json.dumps(rd, sort_keys=True):
                problems.append('D-306 (the published artifact form) is not the same decision in the two runs')
            for label, doc in (('original', o), ('reproduction', r)):
                for form in doc.get('perForm') or []:
                    if isinstance(form, dict) and form.get('roundTripByteIdentical') is False:
                        problems.append(f'{label}: an offer form did NOT round-trip byte-identically (FR-306/SC-303)')

    o = load(root, 'g1-spikes', 's2-segment-order.json')
    r = load(clone, 'g1-spikes', 's2-segment-order.json')
    if o and r:
        print(f'-- S2 segment order / node code 104 (a lane investigation, MEASURED)')
        print(f'   original:     {o["verdict"]}')
        print(f'   reproduction: {r["verdict"]}')
        for label, doc in (('original', o), ('reproduction', r)):
            if doc.get('status') != 'complete':
                problems.append(f'spike S2 in the {label} did not complete (status {doc.get("status")})')
        if o['verdict'] != r['verdict']:
            findings.append('spike S2 reached a DIFFERENT verdict in the reproduction. S2 measures '
                            'accept/refuse ratios over random segment draws and feeds sibling issue '
                            '0001; the specification does not require it, so this is reported, never '
                            'scored.')


# ----------------------------------------------------------------------------- spikes G2
def openness(root: str) -> tuple[str, str]:
    """(verdict, shape) for FR-308 openness, exactly as FR-308 states the disjunction."""
    s4 = load(root, 'g2-spikes', 's4.json', required=False)
    s4b = load(root, 'g2-spikes', 's4b.json', required=False)
    if s4 and str(s4.get('verdict', '')).startswith('GREEN'):
        return 'GREEN', 'floating-surplus (v2a, the preferred shape)'
    if s4b and str(s4b.get('verdict', '')).startswith('GREEN'):
        return 'GREEN', 'bearer-key (v2b, the fallback)'
    return 'RED', 'neither shape settled'


def compare_g2(root: str, clone: str) -> None:
    print('== G2 spikes')
    ov, osh = openness(root)
    rv, rsh = openness(clone)
    print(f'-- FR-308 OPENNESS (owner-REQUIRED): original {ov} via {osh}')
    print(f'                                     repro    {rv} via {rsh}')
    for label, v in (('original', ov), ('reproduction', rv)):
        if v != 'GREEN':
            problems.append(f'FR-308 openness is {v} in the {label} — the owner-REQUIRED outcome is not met')
    if ov == rv == 'GREEN' and osh != rsh:
        findings.append(f'openness reproduced GREEN through a DIFFERENT shape: {osh} originally, {rsh} '
                        f'in the reproduction. FR-308 states the two shapes as a disjunction, so both '
                        f'satisfy it; which one the lane allows is worth knowing.')

    o = load(root, 'g2-spikes', 's6.json')
    r = load(clone, 'g2-spikes', 's6.json')
    if o and r:
        print(f'-- S6 the maker pays nothing (v1 named taker): original {o["verdict"]}, repro {r["verdict"]}')
        for label, doc in (('original', o), ('reproduction', r)):
            if not str(doc['verdict']).startswith('GREEN'):
                problems.append(f'spike S6 in the {label} is "{doc["verdict"]}" — SC-301 needs the maker '
                                f'to pay zero dust')
            if doc.get('makerDustSpends') not in (0, '0', None):
                problems.append(f'spike S6 in the {label} recorded maker dust spends '
                                f'{doc.get("makerDustSpends")}, not 0')
        print(f'   maker intent dust spends: original {o.get("makerDustSpends")}, repro {r.get("makerDustSpends")}')
        print(f'   settlement fee (SPECKs):  original {o.get("settlementFeeSpecks")}, '
              f'repro {r.get("settlementFeeSpecks")}')
        print(f'   fee vs a plain transfer:  original {o.get("feeRatioVsPlainTransfer")}, '
              f'repro {r.get("feeRatioVsPlainTransfer")}')

    for fname, what in (('s5.json', 'S5 staleness / TTL (FR-311, MEASURED)'),
                        ('s5b.json', 'S5b the publishability boundary (F-310, MEASURED)')):
        o = load(root, 'g2-spikes', fname)
        r = load(clone, 'g2-spikes', fname)
        if not o or not r:
            continue
        print(f'-- {what}')
        print(f'   original:     {o["verdict"]}')
        print(f'   reproduction: {r["verdict"]}')
        for label, doc in (('original', o), ('reproduction', r)):
            bad = [c['name'] for c in doc.get('checks') or [] if not c['ok']]
            if bad:
                problems.append(f'{fname} in the {label} could not measure: {len(bad)} failing check(s) '
                                f'{bad[:2]}')
        if fname == 's5b.json':
            ob = (o.get('lastGuaranteedStep'), o.get('firstFallibleStep'))
            rb = (r.get('lastGuaranteedStep'), r.get('firstFallibleStep'))
            print(f'   boundary: original {ob}, reproduction {rb}')
            if ob != rb:
                findings.append(f'the F-310 publishability boundary MOVED in the reproduction: '
                                f'{ob} -> {rb}. This is the measurement deviation D-307 rests on, so a '
                                f'move is a significant lane finding — but F-310 is a MEASURED property '
                                f'and is reported, not scored.')
        elif o['verdict'] != r['verdict']:
            findings.append(f'{fname}: "{o["verdict"]}" -> "{r["verdict"]}". Measured lane behaviour '
                            f'(FR-311 asks for the measured rule), reported rather than scored.')


# ----------------------------------------------------------------------------- freshness
def compare_freshness(root: str, clone: str) -> None:
    print('== freshness — is the "reproduction" a different chain at all?')
    odocs, rdocs = [], []
    for parts in (('g3-swap-ledger', 'stage-a.json'), ('g3-swap-ledger', 'stage-b.json'),
                  ('g3-swap-ledger', 'stage-c.json'), ('g1-spikes', 's1-foreign-balance.json'),
                  ('g1-spikes', 's2-segment-order.json'), ('g1-spikes', 's3-offer-roundtrip.json'),
                  ('g2-spikes', 's4.json'), ('g2-spikes', 's5.json'), ('g2-spikes', 's5b.json'),
                  ('g2-spikes', 's6.json')):
        o, r = load(root, *parts, required=False), load(clone, *parts, required=False)
        if o is not None:
            odocs.append(o)
        if r is not None:
            rdocs.append(r)

    om, rm = by_key(odocs, 'managerAddress'), by_key(rdocs, 'managerAddress')
    print(f'  Manager addresses: {len(om)} original, {len(rm)} reproduced, {len(om & rm)} IN COMMON')
    for a in sorted(om & rm):
        freshness.append(f'Manager address {a[:24]}… appears in BOTH runs')

    oc, rc = colour_hexes(odocs), colour_hexes(rdocs)
    print(f'  colours: {len(oc)} original, {len(rc)} reproduced, {len(oc & rc)} IN COMMON '
          f'(colours are issuer-address-scoped and CANNOT repeat on a new chain)')
    for c in sorted(oc & rc):
        freshness.append(f'colour {c[:24]}… is identical in both runs')

    on, rn = pool_nonces(odocs), pool_nonces(rdocs)
    print(f'  pooled coin nonces: {len(on)} original, {len(rn)} reproduced, {len(on & rn)} IN COMMON')
    for n in sorted(on & rn):
        freshness.append(f'pooled coin nonce {n[:24]}… is identical in both runs')

    otx, rtx = tx_ids(odocs), tx_ids(rdocs)
    shared = sorted(otx & rtx)
    print(f'  transaction ids: {len(otx)} original, {len(rtx)} reproduced, {len(shared)} IN COMMON')
    if shared:
        freshness.append(f'{len(shared)} transaction id(s) appear in BOTH runs; a fresh chain cannot '
                         f'reproduce them: {[s[:20] + "…" for s in shared[:3]]}')
    if not rtx:
        problems.append('the reproduction names NO transaction ids at all — nothing was submitted')

    # Account commitments are hashes of deterministic dev seeds: the SAME fixture on a different
    # chain. Printed as context, never asserted as freshness.
    oa, ra = by_key(odocs, 'accounts'), by_key(rdocs, 'accounts')
    print(f'  (account commitments come from deterministic dev seeds and are expected to match: '
          f'{len(oa & ra)} shared, not a freshness signal)')


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    root, clone = sys.argv[1], sys.argv[2]
    print(f'original:     {root}')
    print(f'reproduction: {clone}')
    print()
    compare_freshness(root, clone)
    print()
    compare_stages(root, clone)
    print()
    compare_g1(root, clone)
    print()
    compare_g2(root, clone)

    # Findings print BEFORE the verdict, on every path, so a green run cannot bury one.
    if findings:
        print('\n' + '=' * 78)
        print('FINDINGS — the reproduction differs from the original in a way the SPECIFICATION')
        print('PERMITS. Recorded here so it is reported, not passed over:')
        for x in findings:
            print(f'  ** {x}')
        print('=' * 78)

    if problems:
        print('\nREPRODUCTION FAILED:')
        for x in problems:
            print(f'  - {x}')
        for x in freshness:
            print(f'  - [freshness] {x}')
        return 1
    if freshness:
        print('\nFRESHNESS GUARD REJECTED THIS PAIR — the two roots describe the SAME chain:')
        for x in freshness[:12]:
            print(f'  - {x}')
        if len(freshness) > 12:
            print(f'  - … and {len(freshness) - 12} more')
        print('\nEvery substantive comparison passed, which is exactly why the freshness guard has to')
        print('exist: verdict-matching alone cannot tell a reproduction from the committed original.')
        return 2
    print('\nthe reproduction matches the original row for row, verdict for verdict, pool for pool,')
    print('cell for cell and map size for map size — on a demonstrably different chain, with ZERO')
    print('transaction ids, Manager addresses, colours or pooled-coin nonces in common.')
    if findings:
        print('…with the FINDING(s) above, which the specification permits and this gate reports rather')
        print('than hides: read them before quoting this verdict.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
