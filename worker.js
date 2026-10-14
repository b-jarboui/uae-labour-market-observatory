/* Observatory compute worker: loads the binary data pack once and answers filter queries.
   Every figure on the page comes from here, so the page and the assistant always agree. */
"use strict";
let M = null, A = null, OFF = null, SK = null, SF = null, N = 0, NS = 0;
const REC = 12;

async function load(base) {
  const get = (f) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r; });
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
  OFF = new Uint32Array(off); SK = new Uint16Array(sk); SF = new Uint8Array(sf);
  NS = M.skills.length;
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
    for (let p = OFF[i]; p < OFF[i + 1]; p++) if (postingOk(p, F)) c[SK[p]]++;
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
