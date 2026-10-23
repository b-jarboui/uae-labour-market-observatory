"""Reconcile country labels and assign stable ad identities across repeated snapshots."""
import array,collections,csv,gzip,json,pathlib,sqlite3,struct,time
ROOT=pathlib.Path(__file__).resolve().parents[1];P=pathlib.Path(r'D:\uae_jobs_wdc\survivor');G=ROOT/'data'/'international';WORK=ROOT.parents[1]/'work'
def csvrows(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
meta=json.loads((G/'meta.json').read_text(encoding='utf8'));records=(G/'ads.bin').read_bytes();mids={m:i for i,m in enumerate(meta['markets'])}
bad={(r['key'],r['site']) for r in csvrows(P/'own_check_full.csv') if r['answer']=='no'};types={r['key']:r['ai_type'] for r in csvrows(P/'type_check.csv')}
db=sqlite3.connect(WORK/'integration-extractions.sqlite');hashes={r[0] for r in db.execute('SELECT h FROM ext')};db.close()
identities={};textids={};a=array.array('I');t=array.array('I');countries=collections.defaultdict(lambda:{'observations':0,'ads':set(),'texts':set()});i=0;t0=time.time()
for f in sorted((P/'panel').glob('CC-MAIN-*.jsonl.gz')):
 seen=set()
 with gzip.open(f,'rt',encoding='utf8') as inp:
  for line in inp:
   r=json.loads(line);co=r.get('company') or r.get('key') or 'unknown';market=r.get('market') or 'UNKNOWN';h=r.get('h')
   if r.get('lang_class')!='en' or (co,r.get('site')) in bad or types.get(co)=='board' or h not in hashes:continue
   key=(co,market,r.get('url'),h)
   if key in seen:continue
   seen.add(key)
   assert records[i*12+1]==mids[market],f'Country alignment mismatch at row {i}'
   if key not in identities:identities[key]=len(identities)
   if h not in textids:textids[h]=len(textids)
   adid=identities[key];tid=textids[h];a.append(adid);t.append(tid);i+=1
   c=countries[market];c['observations']+=1;c['ads'].add(adid);c['texts'].add(tid)
 print(f'{f.stem}: country and identity alignment verified; {i:,} observations, {len(identities):,} distinct ads; {time.time()-t0:.0f}s',flush=True)
assert i==meta['observations']==len(records)//12
(G/'ad_ids.bin').write_bytes(a.tobytes());(G/'text_ids.bin').write_bytes(t.tobytes())
counts={country:{'observations':c['observations'],'distinct_ads':len(c['ads']),'distinct_texts':len(c['texts'])} for country,c in sorted(countries.items())}
report={'passed':True,'observations':i,'distinct_ads':len(identities),'distinct_texts':len(textids),'country_counts':counts,'identity':'company, market, URL and text hash, independent of snapshot; all row-country IDs independently reconciled to raw panel records.'}
(ROOT/'validation-identity.json').write_text(json.dumps(report,indent=2),encoding='utf8')
meta['distinct_ads']=len(identities);meta['distinct_texts']=len(textids);meta['country_counts']=counts;meta['sample_unit']='Distinct company/market/URL/text ads per selected period, counted once across repeated snapshots; annual totals deduplicate within each year.'
(G/'meta.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf8')
with (G/'country-totals.csv').open('w',encoding='utf-8-sig',newline='') as out:w=csv.DictWriter(out,fieldnames=['market','observations','distinct_ads','distinct_texts']);w.writeheader();w.writerows({'market':m,**c} for m,c in counts.items())
print(json.dumps({k:counts[k] for k in ['AE','US','GB']},indent=2),flush=True)
