"""Independent structural checks and raw-panel recounts (standard library only)."""
import array,collections,csv,gzip,json,pathlib,sqlite3,struct,time
ROOT=pathlib.Path(__file__).resolve().parents[1];P=pathlib.Path(r'D:\uae_jobs_wdc\survivor');D=ROOT/'data';G=D/'international';WORK=ROOT.parents[1]/'work'
def read(p):return json.loads(p.read_text(encoding='utf8'))
def rows(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def ints(p,t='I'):return array.array(t,p.read_bytes())
def validate():
 m=read(G/'meta.json');a=(G/'ads.bin').read_bytes();off=ints(G/'offsets.bin');sk=ints(G/'skills.bin');bits=ints(G/'sflags.bin','H');n=len(a)//12
 assert len(a)%12==0 and n==m['observations'];assert len(off)==n+1 and off[0]==0 and off[-1]==len(sk)==len(bits)
 assert all(x<=y for x,y in zip(off,off[1:]));assert max(sk)<len(m['skills']);assert max(bits)<=511 and min(bits)>0
 counters=collections.defaultdict(collections.Counter);companies=collections.defaultdict(set);selected={};comm=next(i for i,s in enumerate(m['skills']) if s[0]=='communication')
 for i,(month,market,gi,cohort,company,edu,yrs,reserved) in enumerate(struct.iter_unpack('<BBBBIBBH',a)):
  assert 72<=month<=140 and month%12 in (4,8);assert market<len(m['markets']);assert gi==255 or gi<len(m['isco']);assert cohort in (1,2) and company>0
  assert off[i+1]-off[i]==len(set(sk[off[i]:off[i+1]])),f'Duplicate canonical skill in record {i}'
  country=m['markets'][market];c=counters[(month,country)];c['retained_observations']+=1;c['planned_observations']+=cohort==1;c['communication']+=comm in sk[off[i]:off[i+1]];companies[country].add(company)
  if country in ('AE','US','GB'):selected.setdefault(country,collections.Counter()).update({'ads':1,'communication':int(comm in sk[off[i]:off[i+1]])})
 for c in m['coverage']:
  month=m['months'].index(c['month']);actual=counters[(month,c['market'])]
  for key in ('retained_observations','planned_observations'):assert c.get(key,0)==actual[key],(c,key,actual[key])
 # Preserve the archive pack exactly after physical date filtering, including skill IDs/postings.
 original=pathlib.Path(r'C:\Users\basse\Desktop\claudews\uae_jobs\deploy_v2\data');old=(original/'ads.bin').read_bytes();expected=[i for i in range(len(old)//12) if 72<=old[12*i]<=140]
 retained=(D/'ads.bin').read_bytes();assert retained==b''.join(old[12*i:12*i+12] for i in expected)
 oldoff=ints(original/'offsets.bin');oldsk=(original/'skills.bin').read_bytes();oldflags=(original/'sflags.bin').read_bytes()
 assert (D/'skills.bin').read_bytes()==b''.join(oldsk[2*oldoff[i]:2*oldoff[i+1]] for i in expected)
 assert (D/'sflags.bin').read_bytes()==b''.join(oldflags[oldoff[i]:oldoff[i+1]] for i in expected)
 archive=read(D/'meta.json');assert m['skills'][:len(archive['skills'])]==archive['skills'];assert archive['coverage']['packed_ads']==len(expected)==157266
 # Independently recount three raw source snapshots using URL-aware panel identities and source eligibility.
 bad={(r['key'],r['site']) for r in rows(P/'own_check_full.csv') if r['answer']=='no'};types={r['key']:r['ai_type'] for r in rows(P/'type_check.csv')};draw={(r['key'],r['market']) for r in rows(P/'usuk_draw500.csv')}
 db=sqlite3.connect(WORK/'integration-extractions.sqlite');recounts=[]
 for snap in ['CC-MAIN-2021-21','CC-MAIN-2023-40','CC-MAIN-2026-39']:
  month=(int(snap[8:12])-2015)*12+(4 if snap.endswith('-21') else 8);seen=set();count=collections.defaultdict(collections.Counter)
  with gzip.open(P/'panel'/(snap+'.jsonl.gz'),'rt',encoding='utf8') as f:
   for line in f:
    r=json.loads(line);co=r.get('company') or r.get('key') or 'unknown';country=r.get('market') or 'UNKNOWN'
    if r.get('lang_class')!='en' or (co,r.get('site')) in bad or types.get(co)=='board':continue
    identity=(co,country,r.get('url'),r.get('h'))
    if identity in seen:continue
    ext=db.execute('SELECT postings FROM ext WHERE h=?',(r.get('h'),)).fetchone()
    if not ext:continue
    seen.add(identity);c=count[country];c['retained_observations']+=1;c['planned_observations']+=country not in ('US','GB') or (co,country) in draw
    c['communication']+=any(sid==comm for sid,flag in struct.iter_unpack('<IH',ext[0]))
  for country,c in count.items():assert c==counters[(month,country)],(snap,country,c,counters[(month,country)])
  recounts.append({'snapshot':snap,'ads':sum(c['retained_observations'] for c in count.values()),'markets':len(count)})
  print('Raw recount passed:',recounts[-1],flush=True)
 db.close()
 coverage=m['coverage'];keys=sorted({k for r in coverage for k in r})
 with (G/'coverage.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(coverage)
 result={'passed':True,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'archiveAds':len(expected),'panelObservations':n,'skillRegistry':len(m['skills']),'postings':len(sk),'sourceRecounts':recounts,'markets':{k:{**dict(v),'companies':len(companies[k])} for k,v in selected.items()},'globalExcludingUAE':n-selected['AE']['ads'],'countsUnit':'Company/country/URL/text observation within snapshot; repeated snapshots retained.'}
 (ROOT/'validation-data.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result,indent=2),flush=True)
if __name__=='__main__':validate()
