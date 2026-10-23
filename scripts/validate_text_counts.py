"""Independent reference for final text-deduplicated benchmark denominators and numerators."""
import array,collections,json,pathlib,struct
R=pathlib.Path(__file__).resolve().parents[1];G=R/'data'/'international';m=json.loads((G/'meta.json').read_text(encoding='utf8'))
def ints(f,t='I'):return array.array(t,(G/f).read_bytes())
off=ints('offsets.bin');sk=ints('skills.bin');tx=ints('text_ids.bin');comm=next(i for i,s in enumerate(m['skills']) if s[0]=='communication')
seen=set();planned=set();out=collections.defaultdict(collections.Counter)
for i,(month,market,isco,cohort,co,edu,yrs,_) in enumerate(struct.iter_unpack('<BBBBIBBH',(G/'ads.bin').read_bytes())):
 key=(market,tx[i]);country=m['markets'][market]
 if key not in seen:
  seen.add(key);out[country]['texts']+=1;out[country]['communication']+=comm in sk[off[i]:off[i+1]]
 if cohort==1 and key not in planned:planned.add(key);out[country]['planned_texts']+=1
identity=json.loads((R/'validation-identity.json').read_text(encoding='utf8'))
for country,c in out.items():assert c['texts']==identity['country_counts'][country]['distinct_texts']
report={'passed':True,'unit':'One distinct text per market within selected period','countries':dict(out),'global_excluding_uae':{k:sum(v[k] for c,v in out.items() if c!='AE') for k in ['texts','communication','planned_texts']}}
(R/'validation-text-counts.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({k:out[k] for k in ['US','GB','AE']},indent=2));print(report['global_excluding_uae'])
