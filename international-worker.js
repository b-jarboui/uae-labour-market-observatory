/* Shared-registry comparison engine. The raw-text/source join happens offline. */
'use strict';
let M,A,O,K,B,N,AD,TX,archive;
let loading=null;
async function load(){if(M)return M;if(!loading)loading=loadData().catch(e=>{loading=null;throw e;});return loading;}
const EXCLUDED_SKILLS=new Set(['cv','visa','computer','people','product','sales executive','sales manager','sales engineering','it support']);
async function loadData(){
 if(M)return M;
 const base='data/international/';
 const get=async f=>{const r=await fetch(base+f+'?v=grouped1');if(!r.ok)throw Error(f+': '+r.status);return r;};
 const meta=await(await get('meta.json')).json();
 if(meta.version!==1||meta.skill_id_bytes!==4)throw Error('Unsupported international schema');
 const [a,o,k,b,ad,tx]=await Promise.all(['ads.bin','offsets.bin','skills.bin','sflags.bin','ad_ids.bin','text_ids.bin'].map(async f=>(await get(f)).arrayBuffer()));
 A=new DataView(a);O=new Uint32Array(o);K=new Uint32Array(k);B=new Uint16Array(b);N=a.byteLength/12;
 AD=new Uint32Array(ad);if(AD.length!==N)throw Error('Advertisement identities do not align');
 TX=new Uint32Array(tx);if(TX.length!==N)throw Error('Text identities do not align');
 if(!Number.isInteger(N)||O.length!==N+1||O[0]!==0||O[N]!==K.length||B.length!==K.length)throw Error('International arrays do not align');
 for(let i=0;i<N;i++){if(O[i]>O[i+1]||A.getUint8(i*12+1)>=meta.markets.length)throw Error('Invalid record/offset');}
 for(const id of K)if(id>=meta.skills.length)throw Error('Invalid skill ID');
 M=meta;return M;
}
async function loadArchive(){
 if(archive)return archive;
 const get=async f=>{const r=await fetch('data/'+f+'?v=grouped1');if(!r.ok)throw Error('UAE '+f);return r;};
 const meta=await(await get('meta.json')).json();
 const [a,o,k,b]=await Promise.all(['ads.bin','offsets.bin','skills.bin','sflags.bin'].map(async f=>(await get(f)).arrayBuffer()));
 archive={meta,A:new DataView(a),O:new Uint32Array(o),K:new Uint16Array(k),B:new Uint8Array(b),N:a.byteLength/12};return archive;
}
function posting(bits,f){
 let mask=511;
 if(f.req==='required')mask&=1|4|16;
 if(f.req==='preferred')mask&=2|8|32;
 if(f.where==='requirements')mask&=1|2|128;
 if(f.where==='duties')mask&=4|8|64;
 return !!(bits&mask);
}
const sample=()=>({n:0,seen:new Set(),baseSeen:new Set(),companies:new Set(),counts:new Uint32Array(M.skills.length),years:Array.from({length:6},()=>({n:0,hits:0,seen:new Set()})),snapshots:new Set(),unclassified:0,base:0,baseUnknown:0});
function selectedOccupation(gi,f){return (!f.isco?.length||f.isco.includes(gi))&&(!f.major?.length||(gi<255&&f.major.includes(M.isco[gi][0][0])));}
function addRecord(s,month,gi,co,start,end,ids,flags,f,skill,adid,legacy=false){
 if(!s.baseSeen.has(adid)){s.baseSeen.add(adid);s.base++;if(gi===255)s.baseUnknown++;}
 if(!selectedOccupation(gi,f))return;
 if(co)s.companies.add(co);
 const y=s.years[Math.floor(month/12)+2015-2021],fresh=!s.seen.has(adid),annualFresh=!y.seen.has(adid);
 if(!fresh&&!annualFresh)return;
 if(fresh){s.seen.add(adid);s.n++;if(co)s.companies.add(co);if(gi===255)s.unclassified++;}
 if(annualFresh){y.seen.add(adid);y.n++;}
 s.snapshots.add(month);let selectedHit=false;
 for(let p=start;p<end;p++){
  const id=ids[p];if(EXCLUDED_SKILLS.has(M.skills[id][0])||(f.types?.length&&!f.types.includes(M.skills[id][1])))continue;
  const bits=legacy?((flags[p]&2)?((flags[p]&1)?8:4):((flags[p]&1)?2:1)):flags[p];
  if(!posting(bits,f))continue;
  if(fresh)s.counts[id]++;if(id===skill)selectedHit=true;
 }
 if(selectedHit&&annualFresh)y.hits++;
}
function safe(n){return n>0&&n<10?null:n;}
function summarize(s,legacy=false){return {n:s.n,companies:legacy?null:s.companies.size,unclassified:s.unclassified,base:s.base,baseUnknown:s.baseUnknown,snapshots:[...s.snapshots].sort((a,b)=>a-b),years:s.years.map((y,i)=>({year:2021+i,n:y.n,hits:safe(y.hits),share:y.n&&safe(y.hits)!==null?y.hits/y.n:null}))};}
async function query(args){
 await load();const f=args.F;let skill=Number.isInteger(args.skill)?args.skill:M.skills.findIndex(s=>s[0]==='communication');
 if(f.types?.length&&!f.types.includes(M.skills[skill]?.[1]))skill=M.skills.findIndex(s=>f.types.includes(s[1])&&!EXCLUDED_SKILLS.has(s[0]));
 const u=sample(),v=sample(),ae=M.markets.indexOf('AE'),target=M.markets.indexOf(args.target);
 for(let i=0;i<N;i++){
  const r=i*12,m=A.getUint8(r),market=A.getUint8(r+1);
  if(m<f.m0||m>f.m1||(args.cohort==='planned'&&A.getUint8(r+3)!==1))continue;
  const isU=market===ae&&args.uae==='panel';
  const isV=args.target==='GLOBAL'?market!==ae:market===target;
  if(!isU&&!isV)continue;
  const s=isU?u:v;addRecord(s,m,A.getUint8(r+2),A.getUint32(r+4,true),O[i],O[i+1],K,B,f,skill,TX[i]*M.markets.length+market);
 }
 if(args.uae==='archive'){
  const a=await loadArchive();
  for(let i=0;i<a.N;i++){
   const r=i*12,m=a.A.getUint8(r);if(m<f.m0||m>f.m1)continue;
   addRecord(u,m,a.A.getUint8(r+1),0,a.O[i],a.O[i+1],a.K,a.B,f,skill,i,true);
  }
 }
 let candidates=[];const text=(args.search||'').trim().toLowerCase();
 for(let id=0;id<M.skills.length;id++){
  if(args.uae==='archive'&&id>=M.legacySkillCount)continue; // Not measured in the frozen archive dictionary; never treat as zero.
  const a=u.counts[id],b=v.counts[id];if(Math.max(a,b)<10)continue;
  if(text&&!M.skills[id][0].includes(text))continue;
  const ca=safe(a),cb=safe(b),pa=u.n&&ca!==null?a/u.n:null,pb=v.n&&cb!==null?b/v.n:null;
  candidates.push({id,name:M.skills[id][0],type:M.skills[id][1],uae:ca,benchmark:cb,uaeShare:pa,benchmarkShare:pb,gap:pa!==null&&pb!==null?(pa-pb)*100:null});
 }
 const limit=args.limit||20;
 const topU=[...candidates].sort((a,b)=>(b.uaeShare??-1)-(a.uaeShare??-1)||a.name.localeCompare(b.name)).slice(0,limit);
 const topV=[...candidates].sort((a,b)=>(b.benchmarkShare??-1)-(a.benchmarkShare??-1)||a.name.localeCompare(b.name)).slice(0,limit);
 const eligible=candidates.filter(r=>r.gap!==null&&((r.uae||0)+(r.benchmark||0)>=10));
 const more=[...eligible].filter(r=>r.gap>0).sort((a,b)=>b.gap-a.gap).slice(0,limit);
 const less=[...eligible].filter(r=>r.gap<0).sort((a,b)=>a.gap-b.gap).slice(0,limit);
 const chosen=new Map([...topU,...topV,...more,...less].map(r=>[r.id,r]));
 const us=summarize(u,args.uae==='archive'),unmeasured=args.uae==='archive'&&skill>=M.legacySkillCount;
 if(unmeasured)us.years=us.years.map(y=>({...y,hits:null,share:null}));
 return {uae:us,benchmark:summarize(v),rows:[...chosen.values()],topU,topV,more,less,skill:{id:skill,name:M.skills[skill]?.[0]||'communication',unmeasured},totalSkills:candidates.length};
}
// Full-data totals per market, independent of page filters: distinct ads, companies and ads per calendar year.
let totalsCache=null;
async function totals(){
 if(totalsCache)return totalsCache;
 await load();const a=await loadArchive();
 const Y0=2021,Y1=2026,mk=()=>({n:0,companies:new Set(),seen:new Set(),years:new Array(Y1-Y0+1).fill(0),m0:Infinity,m1:-Infinity,markets:new Set()});
 const g={AE:mk(),AEpanel:mk(),US:mk(),GB:mk(),GLOBAL:mk()},ae=M.markets.indexOf('AE'),us=M.markets.indexOf('US'),gb=M.markets.indexOf('GB');
 const add=(s,key,m,co,market)=>{if(s.seen.has(key))return;s.seen.add(key);s.n++;if(co)s.companies.add(co);if(market!==undefined)s.markets.add(market);
  const y=Math.floor(m/12)+2015;if(y>=Y0&&y<=Y1)s.years[y-Y0]++;if(m<s.m0)s.m0=m;if(m>s.m1)s.m1=m;};
 for(let i=0;i<N;i++){
  const r=i*12,m=A.getUint8(r),market=A.getUint8(r+1),co=A.getUint32(r+4,true),key=TX[i]*M.markets.length+market;
  if(market===ae){add(g.AEpanel,key,m,co,market);continue;}
  add(g.GLOBAL,key,m,co,market);if(market===us)add(g.US,key,m,co,market);if(market===gb)add(g.GB,key,m,co,market);
 }
 for(let i=0;i<a.N;i++)add(g.AE,i,a.A.getUint8(i*12),0);
 const out={years:Array.from({length:Y1-Y0+1},(_,i)=>Y0+i)};
 for(const [k,s] of Object.entries(g))out[k]={n:s.n,companies:k==='AE'?null:s.companies.size,markets:s.markets.size,years:s.years,from:M.months[s.m0]||null,to:M.months[s.m1]||null};
 totalsCache=out;return out;
}
// Benchmark shares for given skill IDs under the page filters (UAE IDs are the first IDs of the shared registry).
async function shares(args){
 await load();const f=args.F,v=sample(),ae=M.markets.indexOf('AE'),target=M.markets.indexOf(args.target);
 for(let i=0;i<N;i++){
  const r=i*12,m=A.getUint8(r),market=A.getUint8(r+1);
  if(m<f.m0||m>f.m1)continue;
  if(args.target==='GLOBAL'?market===ae:market!==target)continue;
  addRecord(v,m,A.getUint8(r+2),A.getUint32(r+4,true),O[i],O[i+1],K,B,f,-1,TX[i]*M.markets.length+market);
 }
 return {n:v.n,companies:v.companies.size,shares:args.ids.map(id=>{const c=safe(v.counts[id]||0);return v.n&&c!==null?c/v.n:null;})};
}
self.onmessage=async({data:{id,op,args}})=>{try{let r;if(op==='shares')r=await shares(args);else if(op==='totals')r=await totals();else if(op==='load'){const m=await load();r={version:m.version,months:m.months,markets:m.markets,types:m.types,observations:m.observations,skillCount:m.skills.length,extraction_hashes:m.extraction_hashes};}else r=await query(args);self.postMessage({id,ok:true,r});}catch(e){self.postMessage({id,ok:false,error:e.message});}};
