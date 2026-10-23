/* Observatory compute worker: loads the binary data pack once and answers filter queries.
   Every figure on the page comes from here, so the page and the assistant always agree. */
"use strict";
let M = null, A = null, OFF = null, SK = null, SF = null, N = 0, NS = 0;
const REC = 12;

async function load(base) {
  // the worker URL carries the release version (?v=...): data files use it too, so cached data never meets new code
  const get = (f) => fetch(base + f + self.location.search).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r; });
  M = await (await get("meta.json")).json();
  const [ads, off, sk, sf] = await Promise.all(["ads.bin", "offsets.bin", "skills.bin", "sflags.bin"]
    .map((f) => get(f).then((r) => r.arrayBuffer())));
  N = ads.byteLength / REC;
  const v = new DataView(ads);
  A = { month: new Uint8Array(N), isco: new Uint8Array(N), emi: new Uint8Array(N), src: new Uint8Array(N),
        edu: new Uint8Array(N), yrs: new Uint8Array(N), flags: new Uint8Array(N), ind: new Uint8Array(N), title: new Uint16Array(N) };
  for (let i = 0; i < N; i++) {
    const o = i * REC;
    A.month[i] = v.getUint8(o); A.isco[i] = v.getUint8(o + 1); A.emi[i] = v.getUint8(o + 2); A.src[i] = v.getUint8(o + 3);
    A.edu[i] = v.getUint8(o + 4); A.yrs[i] = v.getUint8(o + 5); A.flags[i] = v.getUint8(o + 6); A.ind[i] = v.getUint8(o + 7);
    A.title[i] = v.getUint16(o + 8, true);
  }
  FOS = await get("fields.bin").then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? new Uint32Array(b) : null)).catch(() => null);
  OFF = new Uint32Array(off); SK = new Uint16Array(sk); SF = new Uint8Array(sf);
  if (ads.byteLength % REC || OFF.length !== N + 1 || OFF[0] !== 0 || OFF[N] !== SK.length || SF.length !== SK.length) throw new Error('Data pack arrays are inconsistent; reload after the pack build finishes.');
  for (let i=0;i<N;i++) if (OFF[i]>OFF[i+1] || A.ind[i]!==255 && A.ind[i]>=M.industries.length) throw new Error('Data pack offsets or industry codes are invalid.');
  NS = M.skills.length;
  DIGITAL = await (await get("digital_taxonomy.json")).json();
  if (DIGITAL.entries.some(e=>M.skills[e.id]?.[0]!==e.canonical)) throw new Error('Digital taxonomy IDs do not match this data pack. Rebuild the reviewed exact-match list.');
  M.layout.fields[7]='industry';
  return { meta: M, n: N };
}

/* filter: {m0, m1, isco:[idx]|null, major:[digit]|null, emi:[idx]|null, src:[idx]|null, ownDate:bool,
            types:[t]|null, req:"any"|"required"|"preferred", where:"any"|"requirements"|"duties",
            skill:id|null, title:[ids]|null} */
function match(F) {
  const keep = new Uint8Array(N);
  const isco = F.isco && F.isco.length ? new Set(F.isco) : null;
  const major = F.major && F.major.length ? new Set(F.major) : null;
  const emi = F.emi && F.emi.length ? new Set(F.emi) : null;
  const src = F.src && F.src.length ? new Set(F.src) : null;
  const titles = F.title && F.title.length ? new Set(F.title) : null;
  const ind = F.ind && F.ind.length ? new Set(F.ind) : null;
  for (let i = 0; i < N; i++) {
    const m = A.month[i];
    if (m < F.m0 || m > F.m1) continue;
    if (isco && !isco.has(A.isco[i])) continue;
    if (major && !(A.isco[i] < 255 && major.has(M.isco[A.isco[i]][0][0]))) continue;
    if (emi && !emi.has(A.emi[i])) continue;
    if (src && !src.has(A.src[i])) continue;
    if (F.ownDate && (A.flags[i] & 1)) continue;
    if (titles && !titles.has(A.title[i])) continue;
    if (ind && !ind.has(A.ind[i])) continue;
    if (F.skill != null && !hasSkill(i, F.skill, F)) continue;
    keep[i] = 1;
  }
  return keep;
}

function postingOk(p, F) {
  const f = SF[p];
  if (EXCLUDED_SKILLS.has(M.skills[SK[p]][0])) return false;
  if (F.req === "required" && (f & 1)) return false;
  if (F.req === "preferred" && !(f & 1)) return false;
  if (F.where === "requirements" && (f & 2)) return false;
  if (F.where === "duties" && !(f & 2)) return false;
  if (F.types && F.types.length && !F.types.includes(M.skills[SK[p]][1])) return false;
  return true;
}
function hasSkill(i, s, F) {
  for (let p = OFF[i]; p < OFF[i + 1]; p++) if (SK[p] === s && postingOk(p, F)) return true;
  return false;
}

function skillCounts(keep, F, onlyMonths) {
  const c = new Uint32Array(NS);
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    if (onlyMonths && (A.month[i] < onlyMonths[0] || A.month[i] > onlyMonths[1])) continue;
    n++;
    const seen = new Set();
    for (let p = OFF[i]; p < OFF[i + 1]; p++) if (postingOk(p, F) && !seen.has(SK[p])) { c[SK[p]]++; seen.add(SK[p]); }
  }
  return { c, n };
}
function top(c, n, k) {
  const idx = [];
  for (let s = 0; s < c.length; s++) if (c[s]) idx.push(s);
  idx.sort((a, b) => c[b] - c[a]);
  return idx.slice(0, k).map((s) => ({ id: s, name: M.skills[s][0], type: M.skills[s][1], ads: c[s], share: n ? c[s] / n : 0 }));
}

function overview(F) {
  const keep = match(F);
  let n = 0, own = 0, eduStated = 0, degreeReq = 0;
  const yrsVals = [];
  const byMonth = new Uint32Array(M.months.length);
  const byIsco = new Uint32Array(M.isco.length + 1), byEmi = new Uint32Array(M.emirates.length + 1);
  const bySrc = new Uint32Array(M.sources.length + 1);
  const NI = (M.industries || []).length, byInd = new Uint32Array(NI + 1);
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    n++;
    if (!(A.flags[i] & 1)) own++;
    byMonth[A.month[i]]++;
    byIsco[A.isco[i] === 255 ? M.isco.length : A.isco[i]]++;
    byEmi[A.emi[i] === 255 ? M.emirates.length : A.emi[i]]++;
    bySrc[A.src[i] === 255 ? M.sources.length : A.src[i]]++;
    byInd[A.ind[i] >= NI ? NI : A.ind[i]]++;
    if (A.edu[i]) { eduStated++; if (A.edu[i] & 0b0000111) degreeReq++; }
    if (A.yrs[i] !== 255) yrsVals.push(A.yrs[i]);
  }
  yrsVals.sort((a, b) => a - b);
  const { c, n: n2 } = skillCounts(keep, F);
  const fields = new Set();
  for (let g = 0; g < M.isco.length; g++) if (byIsco[g]) fields.add(g);
  return {
    n, own, fields: fields.size, eduStated, degreeReq,
    yrsMedian: yrsVals.length ? yrsVals[Math.floor(yrsVals.length / 2)] : null, yrsStated: yrsVals.length,
    byMonth: Array.from(byMonth), byIsco: Array.from(byIsco), byEmi: Array.from(byEmi), bySrc: Array.from(bySrc), byInd: Array.from(byInd),
    topSkills: top(c, n2, 40),
  };
}

/* monthly prevalence of a few skills (share of ads in each month that mention the skill) */
function skillTrend(F, ids) {
  const keep = match({ ...F, skill: null });
  const tot = new Uint32Array(M.months.length);
  const hit = ids.map(() => new Uint32Array(M.months.length));
  const pos = new Map(ids.map((s, k) => [s, k]));
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    const m = A.month[i];
    tot[m]++;
    for (let p = OFF[i]; p < OFF[i + 1]; p++) {
      const k = pos.get(SK[p]);
      if (k !== undefined && postingOk(p, F)) hit[k][m]++;
    }
  }
  return { tot: Array.from(tot), series: hit.map((h) => Array.from(h)) };
}

/* skills whose prevalence changed most between two windows */
function shift(F, a, b, k) {
  const keep = match({ ...F, m0: Math.min(a[0], b[0]), m1: Math.max(a[1], b[1]) });
  const A1 = skillCounts(keep, F, a), B1 = skillCounts(keep, F, b);
  const rows = [];
  for (let s = 0; s < NS; s++) {
    const ca = A1.c[s], cb = B1.c[s];
    if (ca + cb < 25) continue;
    const pa = A1.n ? ca / A1.n : 0, pb = B1.n ? cb / B1.n : 0;
    rows.push({ id: s, name: M.skills[s][0], type: M.skills[s][1], a: pa, b: pb, ca, cb, d: pb - pa });
  }
  rows.sort((x, y) => y.d - x.d);
  return { na: A1.n, nb: B1.n, up: rows.slice(0, k), down: rows.slice(-k).reverse() };
}

/* occupation x skill matrix: prevalence of the selected skills inside each occupation group */
function matrix(F, groups, skills) {
  const keep = match(F);
  const gi = new Map(groups.map((g, k) => [g, k])), si = new Map(skills.map((s, k) => [s, k]));
  const tot = new Uint32Array(groups.length), cell = groups.map(() => new Uint32Array(skills.length));
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    const g = gi.get(A.isco[i]);
    if (g === undefined) continue;
    tot[g]++;
    for (let p = OFF[i]; p < OFF[i + 1]; p++) {
      const s = si.get(SK[p]);
      if (s !== undefined && postingOk(p, F)) cell[g][s]++;
    }
  }
  return { tot: Array.from(tot), cell: cell.map((r) => Array.from(r)) };
}

/* entry requirements: degree mix per year, experience bands per window */
function requirements(F, a, b) {
  const keep = match(F);
  const years = {}, bands = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
  const band = (y) => (y === 255 ? 5 : y === 0 ? 0 : y <= 2 ? 1 : y <= 5 ? 2 : y <= 9 ? 3 : 4);
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    const y = M.months[A.month[i]].slice(0, 4);
    const e = A.edu[i];
    const lvl = !e ? "none" : e & 1 ? "phd" : e & 2 ? "master" : e & 4 ? "bachelor" : e & 8 ? "diploma" :
      e & 64 ? "vocational" : e & 16 ? "certificate" : "secondary";
    (years[y] = years[y] || {})[lvl] = (years[y][lvl] || 0) + 1;
    const m = A.month[i];
    if (m >= a[0] && m <= a[1]) bands[0][band(A.yrs[i])]++;
    if (m >= b[0] && m <= b[1]) bands[1][band(A.yrs[i])]++;
  }
  return { years, bands };
}

/* job search for the assistant and the search box */
function findTitles(q, k) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const out = [];
  for (let t = 0; t < M.titles.length && out.length < 400; t++) {
    const s = M.titles[t];
    if (words.every((w) => s.includes(w))) out.push(t);
  }
  return out.slice(0, k || 200);
}
function jobProfile(F, q) {
  const ids = findTitles(q, 400);
  if (!ids.length) return { query: q, n: 0 };
  const keep = match({ ...F, title: ids });
  let n = 0;
  const edu = {}, yrs = [], isco = {};
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    n++;
    const g = A.isco[i] === 255 ? "unclassified" : M.isco[A.isco[i]][1];
    isco[g] = (isco[g] || 0) + 1;
    for (let b = 0; b < 7; b++) if (A.edu[i] & (1 << b)) edu[M.levels[b]] = (edu[M.levels[b]] || 0) + 1;
    if (A.yrs[i] !== 255) yrs.push(A.yrs[i]);
  }
  yrs.sort((x, y) => x - y);
  const { c } = skillCounts(keep, F);
  return { query: q, matchedTitles: ids.slice(0, 8).map((t) => M.titles[t]), n, occupationGroups: isco,
           degreeMentions: edu, medianYears: yrs.length ? yrs[Math.floor(yrs.length / 2)] : null,
           yearsStated: yrs.length, topSkills: top(c, n, 25).map((s) => ({ skill: s.name, share: +(s.share * 100).toFixed(1) })) };
}

/* Relative growth is in advertisement share, never raw archive volume.
   Near-absent baselines are reported separately, without an infinite percentage. */
function growth(F, a, b) {
  const fa = {...F, m0:a[0], m1:a[1]}, fb = {...F, m0:b[0], m1:b[1]};
  const ka=match(fa), kb=match(fb), ac=skillCounts(ka,F), bc=skillCounts(kb,F);
  const out={na:ac.n,nb:bc.n,a,b,technical:[],emerging:[],foundation:[],isco:[],ind:[]};
  if(ac.n<300 || bc.n<300) return out;
  const row=(id,ca,cb)=>{
    const pa=ca/ac.n,pb=cb/bc.n;
    return {id,ca,cb,a:pa,b:pb,d:pb-pa,g:ca>=10 && pa>=0.0001 ? pb/pa-1 : null};
  };
  // a growth percentage is only shown for skills with real volume in BOTH periods (>=30 baseline mentions and
  // >=0.5% of recent ads); tiny bases (13 -> 91) produce huge, misleading percentages
  const minRecent = Math.max(50, Math.ceil(0.005 * bc.n));
  for(let id=0;id<NS;id++) {
    if(bc.c[id]<minRecent && !(ac.c[id]<10 && bc.c[id]>=50)) continue;
    if(ac.c[id]>=10 && ac.c[id]<30) continue;
    const r={...row(id,ac.c[id],bc.c[id]),name:M.skills[id][0],type:M.skills[id][1]};
    if([2,5].includes(r.type)) out.foundation.push(r);
    else if(r.d>0) (r.g===null?out.emerging:out.technical).push(r);
  }
  for(const key of ['isco','ind']) {
    const size=key==='isco'?M.isco.length:(M.industries||[]).length;
    const ca=new Uint32Array(size),cb=new Uint32Array(size);
    for(let i=0;i<N;i++) { const id=A[key][i]; if(id>=size) continue; if(ka[i]) ca[id]++; if(kb[i]) cb[id]++; }
    for(let id=0;id<size;id++) if(cb[id]>=50) {const r=row(id,ca[id],cb[id]);if(r.d>0) out[key].push(r);}
  }
  out.technical.sort((x,y)=>y.g-x.g || y.cb-x.cb);
  out.emerging.sort((x,y)=>y.b-x.b);
  out.foundation.sort((x,y)=>(y.g??-Infinity)-(x.g??-Infinity));
  for(const key of ['isco','ind']) out[key].sort((x,y)=>(y.g??-Infinity)-(x.g??-Infinity)||y.cb-x.cb);
  return out;
}

onmessage = async (e) => {
  const { id, op, args } = e.data;
  try {
    let r;
    if (op === "load") r = await load(args.base);
    else if (op === "evidence") r = evidence(args.F,args.preset,args.kind,args.ids);
    else if (op === "qualifications3") r = qualifications(args.F,args.preset);
    else if (op === "fields") r = fieldsOfStudy(args.F, args.preset);
    else if (op === "monitor3") r = monitor(args.F,args.preset);
    else if (op === "projection") r = projection(args.F,args.target);
    else if (op === "monthly3") r = monthlySeries(args.F,args.target);
    else if (op === "overview") r = overview(args.F);
    else if (op === "growth") r = growth(args.F,args.a,args.b);
    else if (op === "trend") r = skillTrend(args.F, args.ids);
    else if (op === "shift") r = shift(args.F, args.a, args.b, args.k || 12);
    else if (op === "matrix") r = matrix(args.F, args.groups, args.skills);
    else if (op === "requirements") r = requirements(args.F, args.a, args.b);
    else if (op === "job") r = jobProfile(args.F, args.q);
    else if (op === "titles") r = findTitles(args.q, args.k).map((t) => M.titles[t]);
    else if (op === "skillIds") r = args.names.map((nm) => M.skills.findIndex((s) => s[0] === nm.toLowerCase()));
    else throw new Error("unknown op " + op);
    postMessage({ id, ok: true, r });
  } catch (err) {
    postMessage({ id, ok: false, err: String(err && err.message || err) });
  }
};

/* Round 3 evidence contract v1. All prevalence numerators are per-ad unions. */
let DIGITAL=null;
const EVIDENCE_VERSION='r3.1';
const EXCLUDED_SKILLS=new Set(['cv','visa','computer','people','product','sales executive','sales manager','sales engineering','it support']);
const countSafe=n=>n>0&&n<10?null:n;
const safePartition=values=>values.some(n=>n>0&&n<10)?values.map(()=>null):values;
function wilson(c,n){if(!n||countSafe(c)===null)return null;const z=1.96,p=c/n,d=1+z*z/n,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [(p+z*z/(2*n)-h)/d,(p+z*z/(2*n)+h)/d];}
function releaseFilter(F){const end=M.months.indexOf('2026-09');return {...F,skill:null,m0:Math.max(M.months.indexOf('2021-01'),F.m0??0),m1:Math.min(end,F.m1??end)};}
function comparisonWindows(F,preset){const end=releaseFilter(F).m1;const i=(m)=>M.months.indexOf(m);if(preset==='agent')return {a:[i('2023-01'),i('2024-12')],b:[i('2025-01'),end]};if(preset==='gpt')return {a:[i('2021-01'),i('2022-10')],b:[i('2023-01'),i('2024-12')]};return preset==='ytd'?{a:[end-20,end-12],b:[end-8,end]}:{a:[end-23,end-12],b:[end-11,end]};}
function specsFor(kind){
 if(kind==='titles')return M.titles.map((name,id)=>({id,name,kind:'title'}));
 if(kind==='families')return ['ai','advanced','basic'].map(name=>({id:name,name,kind:'family',ids:new Set(DIGITAL.entries.filter(e=>name==='ai'?['ai_development','applied_ai'].includes(e.category):name==='basic'?e.category==='basic':e.category!=='basic').map(e=>e.id))}));
 if(kind==='degree')return [{id:'degree',name:'Degree mentions',kind:'degree'}];
 return M.skills.map((s,id)=>({id,name:s[0],type:s[1],kind:'skill'})).filter(s=>!EXCLUDED_SKILLS.has(s.name));
}
function collectEvidence(F,a,b,specs){
 const windows=[a,b],keep=match({...releaseFilter(F),m0:Math.max(releaseFilter(F).m0,a[0]),m1:Math.min(releaseFilter(F).m1,b[1])});
 const blank=()=>({n:0,strata:Array(36).fill(0),q:Array(4).fill(0),src:Array(3).fill(0),inferred:0,unclassified:0});
 const totals=[blank(),blank()], rows=new Map(),lookup=new Map(specs.map(s=>[s.id,s]));
 const kind=specs[0]?.kind;
 const familyMap=new Map();if(kind==='family')for(const s of specs)for(const id of s.ids){if(!familyMap.has(id))familyMap.set(id,[]);familyMap.get(id).push(s.id);}
 for(let i=0;i<N;i++){
  if(!keep[i])continue;const month=A.month[i],w=month>=a[0]&&month<=a[1]?0:month>=b[0]&&month<=b[1]?1:-1;if(w<0)continue;
  const q=Math.min(3,Math.floor(4*(month-windows[w][0])/(windows[w][1]-windows[w][0]+1))),src=A.src[i],h=src<3?src*12+(+M.months[month].slice(5)-1):-1,t=totals[w];t.n++;t.q[q]++;if(src<3)t.src[src]++;if(h>=0)t.strata[h]++;if(A.flags[i]&1)t.inferred++;if(A.isco[i]===255)t.unclassified++;
  const ids=new Set();
  if(kind==='title'){if(lookup.has(A.title[i]))ids.add(A.title[i]);}
  else if(kind==='degree'){if(A.edu[i]&7)ids.add('degree');}
  else for(let p=OFF[i];p<OFF[i+1];p++){if(!postingOk(p,F))continue;const id=SK[p];if(kind==='family'){for(const k of familyMap.get(id)||[])ids.add(k);}else if(lookup.has(id))ids.add(id);}
  for(const id of ids){if(!rows.has(id))rows.set(id,{...lookup.get(id),hits:[blank(),blank()]});const t=rows.get(id).hits[w];t.n++;t.q[q]++;if(src<3)t.src[src]++;if(h>=0)t.strata[h]++;}
 }
 const retained=totals.map(()=>0),strata=[];let pooled=0;
 for(let h=0;h<36;h++)if(totals[0].strata[h]>=20&&totals[1].strata[h]>=20){strata.push(h);pooled+=totals[0].strata[h]+totals[1].strata[h];for(let w=0;w<2;w++)retained[w]+=totals[w].strata[h];}
 // adjusted estimate on the archive x month strata present in BOTH periods (Web Data Commons stops in 2024, so recent
 // comparisons rely on the archives common to both windows); only below 40% retention is a comparison coverage-limited
 const retention=retained.map((n,w)=>totals[w].n?n/totals[w].n:0),common=retention.every(x=>x>=.4);
 const result=[];
 for(const r of rows.values()){
  const [ca,cb]=r.hits.map(t=>t.n),[na,nb]=totals.map(t=>t.n),pa=na?ca/na:0,pb=nb?cb/nb:0;
  const adj=[0,0];for(const h of strata){const weight=(totals[0].strata[h]+totals[1].strata[h])/pooled;for(let w=0;w<2;w++)adj[w]+=weight*r.hits[w].strata[h]/totals[w].strata[h];}
  const aa=common?adj[0]:pa,bb=common?adj[1]:pb,d=bb-aa,raw=pb-pa;
  let positive=0,negative=0,K=0;for(let q=0;q<4;q++){if(r.hits[1].q[q]>=5)positive++;if(totals.every(t=>t.q[q]>=50)){const change=r.hits[1].q[q]/totals[1].q[q]-r.hits[0].q[q]/totals[0].q[q];if(change<0)negative++;if(Math.sign(change)===Math.sign(d)&&change!==0)K++;}}
  const volume=na>=300&&nb>=300&&Math.max(ca,cb)>=50;
  const conflict=common&&Math.sign(raw)!==Math.sign(d)&&Math.abs(raw)>.0001&&Math.abs(d)>.0001;
  let status=!volume?'Insufficient data':!common||conflict?'Coverage-limited':'Provisional';
  let classification='none';if(volume&&common&&!conflict){if(aa<.005&&bb>=.01&&d>=.005&&cb>=50&&positive>=3)classification='emerging';else if(ca>=30&&cb>=50&&aa>=.005&&d>=.005&&d/aa>=.25&&positive>=3)classification='growing';else if(ca>=50&&aa>=.01&&d<=-.005&&d/aa<=-.25&&negative>=3)classification='declining';}
  const src=totals[0].src.map((n,s)=>{const n2=totals[1].src[s],c1=r.hits[0].src[s],c2=r.hits[1].src[s];return {source:s,na:countSafe(n),nb:countSafe(n2),ca:countSafe(c1),cb:countSafe(c2),a:n&&countSafe(c1)!==null?c1/n:null,b:n2&&countSafe(c2)!==null?c2/n2:null};});
  const loo=[];for(let s=0;s<3;s++){const hs=strata.filter(h=>Math.floor(h/12)!==s),pool=hs.reduce((sum,h)=>sum+totals[0].strata[h]+totals[1].strata[h],0);if(!pool)continue;const retainedOther=[0,1].map(w=>hs.reduce((v,h)=>v+totals[w].strata[h],0)),ns=totals.map(t=>t.n-t.src[s]);if(ns.some(n=>n<300)||retainedOther.some((n,w)=>n/ns[w]<.4))continue;let delta=0;for(const h of hs)delta+=(totals[0].strata[h]+totals[1].strata[h])/pool*(r.hits[1].strata[h]/totals[1].strata[h]-r.hits[0].strata[h]/totals[0].strata[h]);loo.push({excluded:s,d:delta});}
  // stronger evidence (documented rule, no significance claim): raw and adjusted agree, the change persists in >=3 of 4
  // quarters, every eligible leave-one-archive-out estimate keeps the sign, and the shift is >= 0.5 percentage point
  if(status==='Provisional'&&K>=3&&Math.abs(d)>=.005&&Math.sign(raw)===Math.sign(d)&&loo.length&&loo.every(x=>Math.sign(x.d)===Math.sign(d)))status='Stronger evidence';
  const hidden=countSafe(ca)===null||countSafe(cb)===null,components={M:Math.min(Math.abs(d)*100/5,1),R:Math.min(Math.max(aa,bb)/.1,1),P:K/4,C:(Math.sign(raw)===Math.sign(d)?.5:0)+(loo.length&&loo.every(x=>Math.sign(x.d)===Math.sign(d))?.5:0)};
  result.push({id:r.id,name:r.name,type:r.type,ca:countSafe(ca),cb:countSafe(cb),a:countSafe(ca)===null||!na?null:pa,b:countSafe(cb)===null||!nb?null:pb,adjusted:common&&!hidden?adj:null,d:hidden?null:d,relative:!hidden&&ca>=30&&aa>=.005?d/aa:null,intervals:[wilson(ca,na),wilson(cb,nb)],status,classification,K,positive,negative,src:hidden||src.some(s=>s.ca===null||s.cb===null||s.na===null||s.nb===null)?[]:src,loo:hidden?[]:loo,priority:status==='Stronger evidence'&&!hidden?Math.round(100*(.4*components.M+.2*components.R+.25*components.P+.15*components.C)):null,components:hidden?null:components,rare:Math.max(ca,cb)>=10&&Math.max(ca,cb)<50});
 }
 result.sort((x,y)=>Math.abs(y.d??0)-Math.abs(x.d??0));
 return {a,b,na:totals[0].n,nb:totals[1].n,retention,common,rows:result,coverage:totals.map(t=>({inferred:countSafe(t.inferred),unclassified:countSafe(t.unclassified),src:safePartition(t.src),quarters:safePartition(t.q)})),version:EVIDENCE_VERSION,taxonomy:DIGITAL?.version,limitations:['Adjusted stability intervals and multiple-testing validation pending; no statistical significance claims.','Language and employer composition unavailable.','Fixed occupation/industry/title mix checks pending.']};
}
function evidence(F,preset,kind='skills',ids){F=releaseFilter(F);const {a,b}=comparisonWindows(F,preset);return collectEvidence(F,a,b,specsFor(kind).filter(s=>!ids||ids.includes(s.id)));}
let FOS = null;
/* field of study (ISCED-F narrow fields) in the two comparison windows; shares of all ads and of ads naming a field */
function fieldsOfStudy(F, preset) {
  if (!FOS || !M.isced) return { available: false };
  const { a, b } = comparisonWindows(F, preset), keep = match(releaseFilter(F)), K = M.isced.length;
  const w = [a, b].map(() => ({ n: 0, extracted: 0, named: 0, any: 0, c: new Array(K).fill(0) }));
  for (let i = 0; i < N; i++) {
    if (!keep[i]) continue;
    const m = A.month[i], k = m >= a[0] && m <= a[1] ? 0 : m >= b[0] && m <= b[1] ? 1 : -1;
    if (k < 0) continue;
    const t = w[k], f = FOS[i];
    t.n++;
    if (!(f >>> 31)) continue;
    t.extracted++;
    if ((f >>> 30) & 1) t.any++;
    if (f & 0x3fffffff) t.named++;
    for (let j = 0; j < K; j++) if ((f >>> j) & 1) t.c[j]++;
  }
  return { available: true, a, b, w };
}
function qualifications(F,preset){const {a,b}=comparisonWindows(F,preset);const keep=match(releaseFilter(F));const out=[a,b].map(()=>({n:0,stated:0,highest:Array(8).fill(0),mentions:Array(7).fill(0),experience:Array(6).fill(0),cross:Array.from({length:8},()=>Array(6).fill(0)),values:[]}));
 for(let i=0;i<N;i++){if(!keep[i])continue;const m=A.month[i],w=m>=a[0]&&m<=a[1]?0:m>=b[0]&&m<=b[1]?1:-1;if(w<0)continue;const t=out[w],e=A.edu[i],y=A.yrs[i],order=[0,1,2,3,6,4,5],level=e?order.findIndex(bit=>e&(1<<bit))+1:0,band=y===255?5:y===0?0:y<=2?1:y<=5?2:y<=9?3:4;t.n++;if(e)t.stated++;t.highest[level]++;for(let bit=0;bit<7;bit++)if(e&(1<<bit))t.mentions[bit]++;t.experience[band]++;t.cross[level][band]++;if(y!==255)t.values.push(y);}
 // Complementary suppression prevents recovery from marginal totals.
 const suppress=xs=>{const a=xs.map(countSafe);if(a.filter(x=>x===null).length===1){const candidates=xs.map((n,i)=>({n,i})).filter(x=>a[x.i]!==null&&x.n>0).sort((a,b)=>a.n-b.n);if(candidates[0])a[candidates[0].i]=null;}return a;};
 return {a,b,periods:out.map(t=>{t.values.sort((a,b)=>a-b);const n=t.values.length,quartiles=n>=100?[.25,.5,.75].map(q=>t.values[Math.floor((n-1)*q)]):null;const smallEducation=t.highest.some(v=>v>0&&v<10)||t.mentions.some(v=>v>0&&v<10);return {n:t.n,stated:countSafe(t.stated),experienceStated:countSafe(n),quartiles,highest:smallEducation?t.highest.map(()=>null):t.highest,mentions:smallEducation?t.mentions.map(()=>null):t.mentions,experience:suppress(t.experience),cross:t.cross.map(suppress)};}),certifications:F.types&&F.types.length&&!F.types.includes(3)?[]:evidence({...F,types:[3]},preset).rows,degree:evidence(F,preset,'degree')};}
function monitor(F,preset){return M.isco.map((g,id)=>({id,...evidence({...F,isco:F.isco&&!F.isco.includes(id)?[-1]:[id]},preset,'families')})).filter(r=>r.na||r.nb).sort((a,b)=>{const ra=a.rows.find(r=>r.id==='advanced'),rb=b.rows.find(r=>r.id==='advanced'),ok=s=>s==='Provisional'||s==='Stronger evidence',va=a.common&&ok(ra?.status),vb=b.common&&ok(rb?.status);return Number(vb)-Number(va)||(va&&vb?Math.abs(rb.d||0)-Math.abs(ra.d||0):a.id-b.id);});}
function monthlySeries(F,target){F=releaseFilter(F);const keep=match(F),tot=Array(M.months.length).fill(0),hits=tot.slice();const family=target.kind==='family'?specsFor('families').find(s=>s.id===target.id):null;
 for(let i=0;i<N;i++){if(!keep[i])continue;const m=A.month[i];tot[m]++;let hit=false;if(target.kind==='title')hit=A.title[i]===target.id;else for(let p=OFF[i];p<OFF[i+1];p++)if(postingOk(p,F)&&(family?family.ids.has(SK[p]):SK[p]===target.id)){hit=true;break;}if(hit)hits[m]++;}
 return {months:M.months.slice(F.m0,F.m1+1),tot:tot.slice(F.m0,F.m1+1).map(countSafe),hits:hits.slice(F.m0,F.m1+1).map(countSafe),share:hits.slice(F.m0,F.m1+1).map((c,j)=>tot[j+F.m0]>=30&&countSafe(c)!==null?c/tot[j+F.m0]:null)};
}
function fitProjection(values,horizon){const xs=values.slice(-36),eps=.0001,logit=p=>Math.log(Math.max(eps,Math.min(1-eps,p))/(1-Math.max(eps,Math.min(1-eps,p)))),inv=x=>1/(1+Math.exp(-x));const z=xs.map(logit),n=z.length,xm=(n-1)/2,ym=z.reduce((a,b)=>a+b,0)/n;let num=0,den=0;z.forEach((y,i)=>{num+=(i-xm)*(y-ym);den+=(i-xm)**2;});const slope=num/den,intercept=ym-slope*xm;const residuals=z.map((y,i)=>y-intercept-slope*i);const predicted=Array.from({length:horizon},(_,h)=>inv(intercept+slope*(n-1)+slope*.9*(1-.9**(h+1))/.1));return {predicted,slope,residuals,base:intercept+slope*(n-1)};}
function projection(F,target){const series=monthlySeries(F,target),raw=series.share,smooth=raw.map((v,i)=>i<2||raw.slice(i-2,i+1).some(x=>x===null)?null:raw.slice(i-2,i+1).reduce((a,b)=>a+b,0)/3);const start=smooth.findIndex(v=>v!==null),values=smooth.slice(Math.max(0,start));const result={...series,smooth,accepted:false,reason:'insufficient',model:'Trailing 3-month share; last 36 months logit linear fit; monthly damping 0.90; 500 fixed-seed residual block bootstrap draws',backtest:[],forecast:[],label:null};
 const support=evidence(F,null,target.kind==='title'?'titles':target.kind==='family'?'families':'skills',[target.id]);const signal=support.rows[0];result.evidence=signal?.status||'Insufficient data';
 if(!signal||support.na<300||support.nb<300||Math.max(signal.ca??0,signal.cb??0)<50||values.length<72||values.some(v=>v===null))return result;
 const training=values.slice(0,-24),actual=values.slice(-24),back=fitProjection(training,24),mae=actual.reduce((s,v,i)=>s+Math.abs(v-back.predicted[i]),0)/24,naive=actual.reduce((s,v)=>s+Math.abs(v-training.at(-1)),0)/24,mean=actual.reduce((s,v)=>s+v,0)/24,threshold=Math.max(.005,.25*mean);
 result.backtest=actual.map((v,i)=>({month:series.months.at(-24+i),actual:v,predicted:back.predicted[i]}));result.mae=mae;result.naiveMae=naive;result.threshold=threshold;result.reason='unstable';
 if(mae>threshold||mae>Math.max(.001,naive*1.1))return result;
 const fit=fitProjection(values,24),draws=Array.from({length:24},()=>[]);let seed=74129;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const inv=x=>1/(1+Math.exp(-x));
 // Block-resample logit residuals, refit slope, then add residual variation at each horizon.
 const recent=values.slice(-36),z=recent.map(p=>Math.log(Math.max(.0001,Math.min(.9999,p))/(1-Math.max(.0001,Math.min(.9999,p))))),n=z.length;
 for(let draw=0;draw<500;draw++){const sample=[];while(sample.length<n){const k=Math.floor(rand()*n);for(let j=0;j<3&&sample.length<n;j++)sample.push(fit.residuals[(k+j)%n]);}const simulated=z.map((_,i)=>inv(fit.base-fit.slope*(n-1-i)+sample[i])),f=fitProjection(simulated,24);for(let h=0;h<24;h++)draws[h].push(inv(Math.log(f.predicted[h]/(1-f.predicted[h]))+fit.residuals[Math.floor(rand()*n)]));}
 result.accepted=true;result.reason=null;result.forecast=fit.predicted.map((share,h)=>{const d=draws[h].sort((a,b)=>a-b),date=new Date(series.months.at(-1)+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+h+1);return {month:date.toISOString().slice(0,7),share,low:d[12],high:d[487]};});
 const delta=fit.predicted[23]-values.at(-1),prior=values.at(-13)-values.at(-25),latest=values.at(-1)-values.at(-13);result.label=delta<-.005?'Declining':Math.abs(delta)<.005?'Plateauing':latest>Math.max(0,prior)*1.25?'Accelerating':'Steady growth';return result;
}
