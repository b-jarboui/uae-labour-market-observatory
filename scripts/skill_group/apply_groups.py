"""Apply Astra's skill grouping (out/*.jsonl, pass2/*.jsonl) to the dashboard data, in place.
Every variant's mentions move to one standard skill; an ad that names two variants counts once (flags OR-ed).
UAE and international data share the first legacySkillCount IDs, so a group touching a UAE skill keeps a UAE ID.
  python apply_groups.py <dashboard_dir> [--dry]"""
import json, pathlib, sys, collections, numpy as np
HERE = pathlib.Path(__file__).parent
D = pathlib.Path(sys.argv[1]) / 'data'; DRY = '--dry' in sys.argv

def jload(p): return json.loads(p.read_bytes().decode('utf-8-sig'))
def jsave(p, v):
    bom = p.read_bytes()[:3] == b'\xef\xbb\xbf'
    p.write_bytes((b'\xef\xbb\xbf' if bom else b'') + json.dumps(v, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))

um, im = jload(D / 'meta.json'), jload(D / 'international' / 'meta.json')
L = im['legacySkillCount']; reg = im['skills']; assert len(um['skills']) == L
ids = {}
for i, s in enumerate(reg): ids.setdefault(s[0], i)
uk = np.fromfile(D / 'skills.bin', dtype='<u2'); ik = np.fromfile(D / 'international' / 'skills.bin', dtype='<u4')
cnt = np.bincount(ik, minlength=len(reg)).astype(np.int64); cnt[:L] += np.bincount(uk, minlength=L)

# 1. mappings, chains resolved (a->b, b->c gives a->c)
mp, bad = {}, collections.Counter()
for f in sorted(HERE.glob('out/batch_*.jsonl')) + sorted(HERE.glob('pass2/*.jsonl')):
    for line in f.read_text(encoding='utf-8').splitlines():
        line = line.strip().strip(',')
        if not line.startswith('{'): continue
        try: r = json.loads(line)
        except ValueError: bad['json'] += 1; continue
        a, b = str(r.get('from', '')).strip().lower(), str(r.get('to', '')).strip().lower()
        if not a or not b or a == b: continue
        if a not in ids: bad['unknown_from'] += 1; continue
        mp[a] = b
def final(n, seen=()):
    while n in mp and n not in seen: seen = (*seen, n); n = mp[n]
    return n
groups = collections.defaultdict(set)
for a in mp:
    t = final(a); groups[t].add(a)
    if t in ids: groups[t].add(t)

# 2. one carrier ID per group; rename the carrier when the standard name is new or not a UAE ID
remap, rename = {}, {}
for t, members in groups.items():
    mids = [ids[m] for m in members]
    legacy = [i for i in mids if i < L]
    if t in ids and (ids[t] < L or not legacy): carrier = ids[t]
    else:
        pool = legacy or mids; carrier = max(pool, key=lambda i: cnt[i])
        if reg[carrier][0] != t: rename[carrier] = t
    for i in mids:
        if i != carrier: remap[i] = carrier
print(f'mappings {len(mp):,} | groups {len(groups):,} | ids merged away {len(remap):,} | renamed carriers {len(rename):,} | skipped {dict(bad)}')
moved = sum(int(cnt[i]) for i in remap)
print(f'mentions moved to a standard name: {moved:,} of {int(cnt.sum()):,}')
for t in sorted(groups, key=lambda t: -sum(int(cnt[ids[m]]) for m in groups[t]))[:25]:
    print(f'  {t!r:40} <- {sorted(groups[t] - {t})[:6]}')
if DRY: sys.exit()

# 3. rewrite postings: map IDs, then merge duplicates inside each ad (flags OR-ed)
def rewrite(prefix, kdt, fdt):
    off = np.fromfile(prefix / 'offsets.bin', dtype='<u4'); k = np.fromfile(prefix / 'skills.bin', dtype=kdt)
    fl = np.fromfile(prefix / 'sflags.bin', dtype=fdt)
    lut = np.arange(max(len(reg), int(k.max()) + 1), dtype=np.int64)
    for a, b in remap.items():
        if a < len(lut): lut[a] = b
    k2 = lut[k]; ad = np.repeat(np.arange(len(off) - 1), np.diff(off))
    order = np.lexsort((k2, ad)); ad, k2, fl2 = ad[order], k2[order], fl[order]
    first = np.ones(len(k2), bool); first[1:] = (ad[1:] != ad[:-1]) | (k2[1:] != k2[:-1])
    seg = np.cumsum(first) - 1
    flags = np.zeros(int(first.sum()), dtype=fl.dtype); np.bitwise_or.at(flags, seg, fl2)
    kk, aa = k2[first].astype(kdt), ad[first]
    noff = np.zeros(len(off), dtype='<u4'); np.add.at(noff, aa + 1, 1); noff = np.cumsum(noff).astype('<u4')
    assert kdt != '<u2' or kk.max() < L
    kk.tofile(prefix / 'skills.bin'); flags.tofile(prefix / 'sflags.bin'); noff.tofile(prefix / 'offsets.bin')
    print(f'{prefix.name}: postings {len(k):,} -> {len(kk):,}')
    return len(kk)
um_post = rewrite(D, '<u2', np.uint8)
im_post = rewrite(D / 'international', '<u4', np.uint16)

# 4. names: standard names in both registries; record the grouping for the methods text
for i, t in rename.items():
    reg[i][0] = t
    if i < L: um['skills'][i][0] = t
um['coverage']['postings'] = um_post; im['postings'] = im_post
um['coverage']['skill_grouping'] = {'by': 'Astra (OpenAI Codex) review of every skill with 10+ UAE or 30+ international mentions',
                                    'variants_merged': len(remap), 'standard_names': len(groups)}
jsave(D / 'meta.json', um); jsave(D / 'international' / 'meta.json', im)
(HERE / 'applied_groups.json').write_text(json.dumps({t: sorted(m) for t, m in groups.items()}, ensure_ascii=False, indent=0), encoding='utf-8')
print('applied')
