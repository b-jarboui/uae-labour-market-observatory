"""Rebuild the 2021+ UAE release and international pack from local read-only sources.
No research-cache, detector restriction, implicit vocabulary cap, or raw text in outputs.
Run with Python 3.12+, standard library only. Intermediate hash index stays in work/.
"""
import array, collections, csv, datetime, functools, gzip, hashlib, json, pathlib, re, sqlite3, struct, sys, time
from shared_rules import canon_skill as _canon_skill
canon_skill=functools.lru_cache(maxsize=600000)(_canon_skill)

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path(r'C:\Users\basse\Desktop\claudews\uae_jobs')
EXTRACT=pathlib.Path(r'D:\uae_jobs_export\extract')
PANEL=pathlib.Path(r'D:\uae_jobs_wdc\survivor')
WORK=ROOT.parents[1]/'work'; WORK.mkdir(exist_ok=True)
OUT=ROOT/'data'/'international'; OUT.mkdir(exist_ok=True)
START,END=72,140 # January 2021 through September 2026, legacy January 2015 epoch
TYPES=['technical','tool','language','certification','method','soft']
def log(s): print(s,flush=True)
def read(p): return json.loads(p.read_text(encoding='utf8'))
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf8')
def norm_title(t):
    t=re.sub(r'\|.*$','',str(t or ''))
    t=re.sub(r'\b(?:jobs? in|vacancy|urgent(?:ly)? (?:required|hiring)|hiring)\b.*$','',t,flags=re.I)
    if len(t)>60:t=re.sub(r'[-–—:(].*$','',t)
    return re.sub(r'\s+',' ',t).strip().lower()[:100]
def csv_rows(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def u32(p): return array.array('I',p.read_bytes())

def main():
    t0=time.time(); original=SOURCE/'deploy_v2'/'data'; meta=read(original/'meta.json')
    overrides=read(ROOT/'data'/'skill-group-overrides.json')['overrides']
    for s in meta['skills']:
        if s[0] in overrides:s[1]=overrides[s[0]]
    ads=(original/'ads.bin').read_bytes(); oldoff=u32(original/'offsets.bin'); oldsk=(original/'skills.bin').read_bytes(); oldflags=(original/'sflags.bin').read_bytes(); oldfields=(original/'fields.bin').read_bytes()
    newads=bytearray(); offsets=array.array('I',[0]); skills=bytearray(); flags=bytearray(); fields=bytearray(); years=collections.defaultdict(collections.Counter); archives=collections.Counter()
    for i in range(len(ads)//12):
        r=ads[i*12:(i+1)*12]
        if not START<=r[0]<=END:continue
        newads.extend(r); a,b=oldoff[i:i+2]; skills.extend(oldsk[2*a:2*b]); flags.extend(oldflags[a:b]); offsets.append(len(flags)); fields.extend(oldfields[4*i:4*i+4])
        src=meta['sources'][r[3]] if r[3]<len(meta['sources']) else 'unknown'; archives[src]+=1; years[meta['months'][r[0]][:4]][src]+=1
    data=ROOT/'data'
    for name,v in [('ads.bin',newads),('offsets.bin',offsets.tobytes()),('skills.bin',skills),('sflags.bin',flags),('fields.bin',fields)]: (data/name).write_bytes(v)
    legacy_n=len(newads)//12
    meta['built']=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    meta['study']={'start':'2021-01','end':'2026-09','version':'integrated-2021-v1'}
    meta['coverage']={'corpus_ads':None,'packed_ads':legacy_n,'postings':len(flags),'by_source':dict(archives),'by_year_archive':dict(years),'last_month':'2026-09','original_release_ads':len(ads)//12,'retained_2021_ads':legacy_n,'pre_extraction_coverage':'Unavailable in released data pack; packed count is not a corpus extraction rate.'}
    write(data/'meta.json',meta); log(f'UAE archive: {legacy_n:,} retained 2021+ ads')

    # One common skill registry. Existing UAE IDs never move. Global-only names append, uint32 IDs.
    registry=list(meta['skills']); ids={r[0]:i for i,r in enumerate(registry)}; type_votes=collections.defaultdict(collections.Counter)
    db=sqlite3.connect(WORK/'integration-extractions.sqlite'); db.execute('PRAGMA journal_mode=OFF'); db.execute('PRAGMA synchronous=OFF'); db.execute('PRAGMA cache_size=-150000')
    db.execute('DROP TABLE IF EXISTS ext'); db.execute('CREATE TABLE ext(h TEXT PRIMARY KEY, postings BLOB, education INTEGER, yrs INTEGER, batch TEXT) WITHOUT ROWID')
    manifest=[]; stats={}; conflicts=0; repaired=0
    # Repairs supersede earlier successful records; an unsuccessful repair never destroys a valid extraction.
    for batch in ['surv_p1','batch1','batch2','fix_trunc','fix_trunc2']:
        assert list((EXTRACT/batch/'results').glob('skills_ads_*.jsonl')),f'Missing extraction batch: {batch}'
        c=collections.Counter(); pending=[]
        for f in sorted((EXTRACT/batch/'results').glob('skills_ads_*.jsonl')):
            manifest.append({'batch':batch,'file':f.name,'bytes':f.stat().st_size,'mtime_ns':f.stat().st_mtime_ns})
            with f.open(encoding='utf8') as inp:
                for l in inp:
                    c['rows']+=1
                    try:r=json.loads(l)
                    except ValueError:c['malformed']+=1;continue
                    if not r.get('ok') or not isinstance(r.get('skills'),list):c['failed']+=1;continue
                    h=r.get('id'); existing=db.execute('SELECT postings,education,yrs FROM ext WHERE h=?',(h,)).fetchone()
                    if existing and not batch.startswith('fix_'):c['duplicate_success']+=1;continue
                    byid={}
                    for s in r['skills']:
                        if not isinstance(s,dict):continue
                        name=canon_skill(s.get('skill'))
                        if not name:c['excluded_non_skill_mentions']+=1;continue
                        typ=s.get('type'); typ=typ if typ in TYPES else 'technical'
                        if name not in ids:ids[name]=len(registry);registry.append([name,TYPES.index(typ)])
                        sid=ids[name]; type_votes[sid][TYPES.index(typ)]+=1
                        where=str(s.get('where') or '').lower(); req=str(s.get('requirement') or '').lower()
                        # Explicit status unknown stays unknown; never label missing status "required".
                        bit=4 if where.startswith('dut') else 1 if where.startswith('req') else 16
                        if req=='preferred':bit=8 if bit==4 else 2 if bit==1 else 32
                        elif req!='required':bit=64 if bit==4 else 128 if bit==1 else 256
                        byid[sid]=byid.get(sid,0)|bit
                    blob=b''.join(struct.pack('<IH',sid,bits) for sid,bits in sorted(byid.items()))
                    education=sum(1<<meta['levels'].index(x) for x in {x.get('level') for x in (r.get('education') or []) if isinstance(x,dict)} if x in meta['levels'])
                    yrs=r.get('experience_years'); yrs=int(max(0,min(40,yrs))) if isinstance(yrs,(int,float)) else 255
                    if existing:
                        if existing!=(blob,education,yrs):conflicts+=1
                        repaired+=1
                    db.execute('INSERT OR REPLACE INTO ext VALUES(?,?,?,?,?)',(h,blob,education,yrs,batch));c['successful_indexed']+=1
            db.commit()
        stats[batch]=dict(c);log(f'Extraction {batch}: {dict(c)}')
    # Legacy category IDs remain frozen; new labels use the modal observed extractor type.
    for sid,votes in type_votes.items():
        if sid>=len(meta['skills']):registry[sid][1]=min(votes,key=lambda k:(-votes[k],k))
    for s in registry:
        if s[0] in overrides:s[1]=overrides[s[0]]
    write(WORK/'integration-registry.json',registry)
    excluded={(r['key'],r['site']) for r in csv_rows(PANEL/'own_check_full.csv') if r['answer']=='no'}
    companytypes={r['key']:r['ai_type'] for r in csv_rows(PANEL/'type_check.csv')}
    draw={(r['key'],r['market']) for r in csv_rows(PANEL/'usuk_draw500.csv')}
    isco=read(SOURCE/'isco_titles.json')['titles']; groups={g[0]:i for i,g in enumerate(meta['isco'])}
    markets=[]; marketids={}; companies={}; recs=bytearray(); off=array.array('I',[0]); sk=array.array('I'); sf=array.array('H'); coverage=[]; audit=collections.Counter()
    for f in sorted((PANEL/'panel').glob('CC-MAIN-*.jsonl.gz')):
        snap=f.name[:15]; year=int(snap[8:12]); known={2021:('21','39'),2022:('21','40'),2023:('23','40'),2024:('22','38'),2025:('21','38'),2026:('21','39')}
        assert year in known and snap[-2:] in known[year],f'Unrecognized snapshot: {snap}'
        month=5 if snap[-2:]==known[year][0] else 9
        mi=(year-2015)*12+month-1
        if not START<=mi<=END:continue
        cov=collections.defaultdict(collections.Counter); seen=set()
        with gzip.open(f,'rt',encoding='utf8') as inp:
            for l in inp:
                r=json.loads(l); market=r.get('market') or 'UNKNOWN'; c=cov[market];c['panel_observations']+=1
                if r.get('lang_class')!='en':c['non_english']+=1;continue
                c['english_observations']+=1
                company=r.get('company') or r.get('key') or 'unknown'
                if (company,r.get('site')) in excluded or companytypes.get(company)=='board':c['excluded_ownership_or_board']+=1;continue
                c['eligible_observations']+=1
                h=r.get('h'); ext=db.execute('SELECT postings,education,yrs FROM ext WHERE h=?',(h,)).fetchone()
                if not ext:c['without_successful_extraction']+=1;continue
                # Identical company/market/text in the same snapshot is one observation.
                identity=(company,market,r.get('url'),h)
                if identity in seen:c['duplicate_within_snapshot']+=1;continue
                seen.add(identity)
                if market not in marketids:marketids[market]=len(markets);markets.append(market)
                companykey=(company,market)
                if companykey not in companies:companies[companykey]=len(companies)+1
                title=norm_title(r.get('title')); g=isco.get(title); gi=groups.get(g[0],255) if g else 255
                planned=market not in ('US','GB') or companykey in draw
                blob,edu,yrs=ext
                # 12 bytes: month,u8 country,u8 isco,u8 cohort,u32 company,u8 edu,u8 years,u16 reserved.
                recs.extend(struct.pack('<BBBBIBBH',mi,marketids[market],gi,1 if planned else 2,companies[companykey],edu,yrs,0))
                for sid,bits in struct.iter_unpack('<IH',blob):sk.append(sid);sf.append(bits)
                off.append(len(sk));c['retained_observations']+=1;c['planned_observations']+=int(planned);c['unclassified_occupation']+=int(gi==255)
        coverage.extend({'snapshot':snap,'month':meta['months'][mi],'market':m,**dict(c)} for m,c in sorted(cov.items()))
        log(f'{snap}: {sum(c["retained_observations"] for c in cov.values()):,} retained; elapsed {time.time()-t0:.0f}s')
    assert len(off)==len(recs)//12+1 and off[-1]==len(sk)==len(sf)
    assert not sk or max(sk)<len(registry)
    for name,v in [('ads.bin',recs),('offsets.bin',off.tobytes()),('skills.bin',sk.tobytes()),('sflags.bin',sf.tobytes())]: (OUT/name).write_bytes(v)
    panelmeta={'version':1,'built':meta['built'],'study':meta['study'],'markets':markets,'skills':registry,'types':TYPES,'isco':meta['isco'],'months':meta['months'],'record_bytes':12,'skill_id_bytes':4,'observations':len(recs)//12,'postings':len(sk),'companies':len(companies),'legacySkillCount':len(meta['skills']),'extraction_hashes':db.execute('SELECT COUNT(*) FROM ext').fetchone()[0],'extraction_batches':stats,'repairs_replacing_valid':repaired,'repair_disagreements':conflicts,'coverage':coverage,'global':'Ad-weighted union of retained non-UAE markets; includes US and UK; company IDs are country-company pairs.','deduplication':'One company/market/URL/text hash per snapshot; repeated snapshots remain observations, not new vacancies.','date_basis':'Common Crawl snapshot month, not posting date. Twelve snapshots: May and September 2021–2026.','cohorts':'planned: US/UK 500-company draw and all other eligible markets; available: all successfully extracted eligible observations, including opportunistic US/UK coverage.'}
    write(OUT/'meta.json',panelmeta);write(OUT/'source-manifest.json',{'extractions':manifest,'panel':[{'file':f.name,'bytes':f.stat().st_size,'mtime_ns':f.stat().st_mtime_ns} for f in sorted((PANEL/'panel').glob('*.jsonl.gz'))]})
    db.close();log(f'Complete: {len(recs)//12:,} panel observations; {len(registry):,} canonical skills; {len(markets)} markets; {time.time()-t0:.0f}s')

if __name__=='__main__':main()
