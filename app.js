/* UAE Labour Market Observatory: page logic. All numbers come from worker.js. */
"use strict";
const CFG = window.OBS_CONFIG || {};
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const mi = (y, m) => (y - 2015) * 12 + (m - 1);
const COVID = mi(2020, 3), GPT = mi(2022, 11);

/* ---------- worker RPC ---------- */
// versioned like the other assets, so a new data engine is never masked by the browser cache
const W = new Worker("worker.js" + ((document.querySelector('script[src^="app.js"]') || {}).src || "").replace(/^[^?]*/, ""));
let rpcId = 0;
const pending = new Map();
W.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.err)); };
const call = (op, args) => new Promise((res, rej) => { const id = ++rpcId; pending.set(id, { res, rej }); W.postMessage({ id, op, args }); });
window.OBS = { call };

/* ---------- state ---------- */
let META = null, FIRST = 0, LAST = 0, lang = "en", aud = "policy";
const S = { m0: 0, m1: 0, major: "", isco: "", emi: "", ind: "", type: "", where: "any", shiftWin: "trend", tlMode: "skills", stated: "all", smooth: "12" };
const T = () => window.I18N[lang];
const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString(lang === "ar" ? "ar-AE" : "en-US"));
const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
const ym = (i) => META.months[i];
const ymLabel = (i) => { const [y, m] = ym(i).split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString(lang === "ar" ? "ar-AE" : "en-GB", { month: "short", year: "numeric" }); };
const narrow = () => innerWidth < 640;

function F() {
  return {
    m0: S.m0, m1: S.m1,
    major: S.major ? [S.major] : null, isco: S.isco !== "" ? [+S.isco] : null, emi: S.emi !== "" ? [+S.emi] : null, ind: S.ind !== "" ? [+S.ind] : null,
    types: S.type !== "" ? [+S.type] : null, req: aud === "emp" ? "required" : "any",
    where: S.where, src: null, ownDate: false, skill: null,
  };
}

/* ---------- theme ---------- */
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function palette() {
  return { ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"), line: css("--line"), grid: css("--grid"), teal: css("--teal"),
           slate: css("--slate"), navy: css("--navy"), amber: css("--amber"), up: css("--up"), down: css("--down"), surface: css("--surface"),
           soft: css("--teal-soft"), na: css("--na"), font: lang === "ar" ? css("--f-ar") : css("--f-sans"), mono: css("--f-mono") };
}
/* skill lines: distinct but calm; teal leads */
const SERIES = () => { const p = palette(); return [p.teal, p.navy, p.amber, css("--s4"), css("--s5")]; };
function cycleTheme() {
  const r = document.documentElement, cur = r.getAttribute("data-theme");
  const next = cur === null ? (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark") : cur === "dark" ? "light" : "dark";
  r.setAttribute("data-theme", next);
  try { localStorage.setItem("obs-theme", next); } catch (e) {}
  renderCharts();
}

/* ---------- charts ---------- */
const charts = {};
function chart(id) {
  if (!charts[id]) { charts[id] = echarts.init(document.getElementById(id), null, { renderer: "canvas" }); }
  return charts[id];
}
let wasNarrow = null;
addEventListener("resize", () => {
  Object.values(charts).forEach((c) => c.resize());
  if (META && wasNarrow !== null && wasNarrow !== narrow()) renderCharts();
  wasNarrow = narrow();
});
function base() {
  const p = palette();
  return { textStyle: { fontFamily: p.font, color: p.ink2, fontSize: 13 }, animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: 450,
           tooltip: { backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink, fontFamily: p.font, fontSize: 13 }, confine: true } };
}
/* charts read left to right in both languages: time and value axes are never mirrored */
const axisStyle = (p) => ({ axisLine: { lineStyle: { color: p.line } }, axisTick: { show: false },
  axisLabel: { color: p.ink3, fontFamily: p.mono, fontSize: 12 }, splitLine: { lineStyle: { color: p.grid } } });
const catAxis = (p, names, w) => ({ type: "category", inverse: true, data: names, axisLine: { show: false }, axisTick: { show: false },
  axisLabel: { color: p.ink, fontSize: 13, width: w, overflow: "truncate" } });
const labelW = () => (narrow() ? 122 : 158);
const yearTicks = (p) => ({ ...axisStyle(p).axisLabel, interval: (i, v) => v.endsWith("-01") && (!narrow() || +v.slice(0, 4) % 2 === 0), formatter: (v) => v.slice(0, 4) });

/* ---------- tables and CSV ---------- */
const TABLES = {};
function table(key, head, rows) {
  TABLES[key] = [head, rows];
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const cell = (v) => window.skillLink ? window.skillLink(v) : esc(v);
  $("#tbl-" + key).innerHTML = `<table class="data"><thead><tr>${head.map((h) => `<th>${cell(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${cell(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function downloadCsv(key) {
  const [head, rows] = TABLES[key] || [[], []];
  const q = (s) => `"${String(window.skillLabel && META.skills.some(r=>r[0]===s) ? window.skillLabel(s) : s).replace(/"/g, '""')}"`;
  const csv = "﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `uae-observatory-${key}-${ym(S.m0)}_${ym(S.m1)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- setup ---------- */
async function init() {
  try { const t = localStorage.getItem("obs-theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  try { const l = localStorage.getItem("obs-lang"); if (l === "ar") lang = "ar"; } catch (e) {}
  $("#app").setAttribute("aria-busy", "true");
  const { meta } = await call("load", { base: CFG.DATA_BASE || "data/" });
  META = meta;
  // Correct corrupted Arabic display labels in the source metadata without altering records.
  const emirateArabic = {abu_dhabi:'أبوظبي',dubai:'دبي',sharjah:'الشارقة',ajman:'عجمان',rak:'رأس الخيمة',fujairah:'الفجيرة',uaq:'أم القيوين'};
  META.emirates.forEach(e => { if (emirateArabic[e[0]]) e[2] = emirateArabic[e[0]]; });
  const all = await call("overview", { F: { m0: 0, m1: META.months.length - 1, types: null, req: "any", where: "any" } });
  const bm = all.byMonth;
  FIRST = Math.max(mi(2018, 1), bm.findIndex((v) => v >= 50));
  LAST = bm.length - 1 - [...bm].reverse().findIndex((v) => v >= 50);
  if (ym(LAST) >= META.built.slice(0, 7)) LAST -= 1;          /* the build month is still being collected */
  S.m0 = FIRST; S.m1 = LAST;
  wasNarrow = narrow();
  window.OBS.meta = META; window.OBS.range = [FIRST, LAST]; window.OBS.F = F;
  bindControls();
  applyLang();
  $("#app").setAttribute("aria-busy", "false");
}

function fillSelects() {
  const t = T();
  const monthOpts = (sel, val) => {
    sel.innerHTML = "";
    for (let i = FIRST; i <= LAST; i++) { const o = new Option(ymLabel(i), i); if (i === val) o.selected = true; sel.add(o); }
  };
  monthOpts($("#fFrom"), S.m0); monthOpts($("#fTo"), S.m1);
  const maj = $("#fMajor"); maj.innerHTML = ""; maj.add(new Option(t.allFields, ""));
  Object.entries(META.isco_major).forEach(([k, v]) => maj.add(new Option(lang === "ar" ? v[1] : v[0], k)));
  maj.value = S.major;
  const isc = $("#fIsco"); isc.innerHTML = ""; isc.add(new Option(t.allGroups, ""));
  META.isco.forEach((g, i) => { if (!S.major || g[0][0] === S.major) isc.add(new Option(`${g[0]} · ${lang === "ar" ? g[2] : g[1]}`, i)); });
  isc.value = S.isco;
  const ind = $("#fInd"); if (ind) { ind.innerHTML = ""; ind.add(new Option(t.allIndustries, ""));
    (META.industries || []).forEach((x, i) => ind.add(new Option(`${x[0]} · ${lang === "ar" ? x[2] : x[1]}`, i))); ind.value = S.ind; }
  const emi = $("#fEmi"); emi.innerHTML = ""; emi.add(new Option(t.allEmirates, ""));
  META.emirates.forEach((e, i) => emi.add(new Option(lang === "ar" ? e[2] : e[1], i)));
  emi.value = S.emi;
  const ty = $("#fType"); ty.innerHTML = ""; ty.add(new Option(t.allTypes, ""));
  t.types.forEach((n, i) => ty.add(new Option(n, i)));
  ty.value = S.type;
  const wh = $("#fWhere"); wh.innerHTML = "";
  [["any", t.whereAny], ["requirements", t.whereReq], ["duties", t.whereDuty]].forEach(([v, n]) => wh.add(new Option(n, v)));
  wh.value = S.where;
  moreCount();
}
function moreCount() {
  const n = (S.isco !== "") + (S.type !== "") + (S.where !== "any");
  $("#moreBtn").textContent = ($("#more").hidden ? T().more : T().fewer) + (n ? ` (${n})` : "");
}

function seg(id, key, after) {
  $$(`#${id} button`).forEach((b) => (b.onclick = () => { S[key] = b.dataset.v; $$(`#${id} button`).forEach((x) => x.classList.toggle("on", x === b)); after(); }));
}
function bindControls() {
  $("#fFrom").onchange = (e) => { S.m0 = +e.target.value; if (S.m0 > S.m1) S.m1 = S.m0; refresh(); };
  $("#fTo").onchange = (e) => { S.m1 = +e.target.value; if (S.m1 < S.m0) S.m0 = S.m1; refresh(); };
  $("#fMajor").onchange = (e) => { S.major = e.target.value; S.isco = ""; fillSelects(); refresh(); };
  $("#fIsco").onchange = (e) => { S.isco = e.target.value; moreCount(); refresh(); };
  $("#fEmi").onchange = (e) => { S.emi = e.target.value; refresh(); };
  if ($("#fInd")) $("#fInd").onchange = (e) => { S.ind = e.target.value; refresh(); };
  $("#fType").onchange = (e) => { S.type = e.target.value; moreCount(); refresh(); };
  $("#fWhere").onchange = (e) => { S.where = e.target.value; moreCount(); refresh(); };
  $("#moreBtn").onclick = () => { const m = $("#more"); m.hidden = !m.hidden; $("#moreBtn").setAttribute("aria-expanded", String(!m.hidden)); moreCount(); };
  $("#resetBtn").onclick = () => { Object.assign(S, { m0: FIRST, m1: LAST, major: "", isco: "", emi: "", ind: "", type: "", where: "any" }); setAud("policy"); };
  $$(".presets .chip").forEach((b) => (b.onclick = () => setAud(b.dataset.aud)));
  seg("tlMode", "tlMode", drawTimeline);
  seg("shiftMode", "shiftWin", () => { drawShift(); drawReq(); });
  seg("smoothMode", "smooth", drawTimeline);
  seg("statedMode", "stated", drawReq);
  $$("[data-table]").forEach((b) => (b.onclick = () => { const el = $("#tbl-" + b.dataset.table); el.hidden = !el.hidden; b.textContent = el.hidden ? T().showTable : T().hideTable; }));
  $$("[data-csv]").forEach((b) => (b.onclick = () => downloadCsv(b.dataset.csv)));
  $("#langBtn").onclick = () => { lang = lang === "en" ? "ar" : "en"; try { localStorage.setItem("obs-lang", lang); } catch (e) {} applyLang(); };
  $("#themeBtn").onclick = cycleTheme;
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) $$(".secnav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id)); }), { rootMargin: "-40% 0px -55% 0px" });
  $$("main section[id]").forEach((s) => io.observe(s));
}

function setAud(a) {
  aud = a;
  $$(".presets .chip").forEach((b) => b.classList.toggle("on", b.dataset.aud === a));
  if (a === "uni") { S.where = "requirements"; S.type = ""; }
  else if (a === "emp") { S.where = "requirements"; }
  else { S.where = "any"; }
  fillSelects(); refresh();
}

/* one entry point for every direct filter (chips, chart clicks); clicking the active value again clears it */
function setFilter(key, val) {
  val = val == null ? "" : String(val);
  S[key] = S[key] === val ? "" : val;
  if (key === "major") S.isco = "";
  if (key === "isco" && S.isco !== "") S.major = META.isco[+S.isco][0][0];
  fillSelects(); refresh();
}
window.setFilter = setFilter;

function renderChips() {
  const t = T(), ar = lang === "ar";
  const emi = META.emirates.map((e, i) => `<button type="button" class="chip${S.emi === String(i) ? " on" : ""}" data-emi="${i}">${ar ? e[2] : e[1]}</button>`).join("");
  $("#emiChips").innerHTML = `<span class="audlabel">${t.emirate}</span><button type="button" class="chip${S.emi === "" ? " on" : ""}" data-emi="">${t.allEmirates}</button>${emi}`;
  $$("#emiChips [data-emi]").forEach((b) => (b.onclick = () => { S.emi = ""; setFilter("emi", b.dataset.emi); }));
  const act = [];
  if (S.isco !== "") act.push(["isco", ar ? META.isco[+S.isco][2] : META.isco[+S.isco][1]]);
  else if (S.major) act.push(["major", ar ? META.isco_major[S.major][1] : META.isco_major[S.major][0]]);
  if (S.emi !== "") act.push(["emi", ar ? META.emirates[+S.emi][2] : META.emirates[+S.emi][1]]);
  if (S.ind !== "" && META.industries) act.push(["ind", ar ? META.industries[+S.ind][2] : META.industries[+S.ind][1]]);
  if (S.type !== "") act.push(["type", t.types[+S.type]]);
  $("#activeChips").innerHTML = act.length ? act.map(([k, v]) => `<button type="button" class="fchip" data-k="${k}" aria-label="${ar ? "إزالة" : "Remove"} ${v}">${v} <b aria-hidden="true">×</b></button>`).join("") +
    `<span class="hint">${ar ? "انقر على أي إمارة أو مهنة في الرسوم للتصفية" : "Tip: click an emirate or an occupation in the charts to filter"}</span>` :
    `<span class="hint">${ar ? "انقر على أي إمارة أو مهنة في الرسوم للتصفية" : "Tip: click an emirate or an occupation in the charts to filter the whole page"}</span>`;
  $$("#activeChips .fchip").forEach((b) => (b.onclick = () => { S[b.dataset.k] = ""; if (b.dataset.k === "isco") S.major = ""; fillSelects(); refresh(); }));
}

function applyLang() {
  const t = T();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  $("#langBtn").textContent = lang === "ar" ? "English" : "العربية";
  $(".skip-link").textContent = lang === "ar" ? "انتقل إلى البيانات" : "Skip to the data";
  $("#themeBtn").setAttribute("aria-label", lang === "ar" ? "تبديل المظهر" : "Switch theme");
  $("#fTo").setAttribute("aria-label", lang === "ar" ? "نهاية الفترة" : "End of period");
  $$("[data-i18n]").forEach((el) => { const v = t[el.dataset.i18n]; if (typeof v === "string") el.textContent = v; });
  $("#askInput").placeholder = t.askPh;
  if (window.Chat) window.Chat.lang(lang);
  fillSelects();
  refresh();
}

/* ---------- data refresh ---------- */
let OV = null, SH = null;
async function refresh() {
  if (refresh.running) { refresh.again = true; return; }
  refresh.running = true;
  $("#app").setAttribute("aria-busy", "true");
  try {
  fillSelects();
  OV = await call("overview", { F: technicalFilter() });
  await loadGrowth();
  drawOverview();
  await Promise.all([drawShift().then(drawTimeline), drawTop(), drawMatrix(), drawEmi(), drawInd(), drawReq()]);
  if (window.enhanceSkills) window.enhanceSkills();
  // empty or tiny selections: say so on every chart instead of showing blank axes
  const few = OV.n < 30, msg = OV.n === 0
    ? (lang === "ar" ? "لا توجد إعلانات مطابقة لهذه المرشحات. أزل أحد المرشحات." : "No advertisements match these filters. Remove a filter to see data.")
    : (lang === "ar" ? "عدد الإعلانات قليل جداً لعرض هذا الرسم." : "Too few advertisements in this selection to draw this chart.");
  for (const id of ["chShift", "chTop", "chEmi", "chInd", "chExp", "chEdu", "chMatrix", "chTimeline"]) {
    const c = charts[id]; if (!c) continue;
    c.setOption({ graphic: few ? [{ type: "text", left: "center", top: "middle", z: 100, style: { text: msg, fill: palette().ink2, font: `500 15px ${palette().font}` } }] : [] }, { replaceMerge: ["graphic"] });
  }
  } catch (e) {
    $("#statusText").textContent = lang === "ar" ? "تعذر تحديث البيانات. حاول تغيير المرشحات مجدداً." : "Could not update the data. Try changing the filters again.";
    console.error(e);
  } finally {
    refresh.running = false;
    $("#app").setAttribute("aria-busy", "false");
    if (refresh.again) { refresh.again = false; refresh(); }
  }
}
function renderCharts() { if (META) { drawTimeline(); drawShift(); drawTop(); drawMatrix(); drawEmi(); drawInd(); drawReq(); } }

function activeFilterText() {
  const t = T(), parts = [];
  if (S.isco !== "") parts.push(lang === "ar" ? META.isco[+S.isco][2] : META.isco[+S.isco][1]);
  else if (S.major) parts.push(lang === "ar" ? META.isco_major[S.major][1] : META.isco_major[S.major][0]);
  if (S.emi !== "") parts.push(lang === "ar" ? META.emirates[+S.emi][2] : META.emirates[+S.emi][1]);
  if (S.ind !== "" && META.industries) parts.push(lang === "ar" ? META.industries[+S.ind][2] : META.industries[+S.ind][1]);
  if (S.type !== "") parts.push(t.types[+S.type]);
  parts.push(`${ymLabel(S.m0)} – ${ymLabel(S.m1)}`);
  return parts.join(" · ");
}

function drawOverview() {
  const t = T(), o = OV, cov = META.coverage;
  $("#lede").textContent = t.lede(ymLabel(FIRST), ymLabel(LAST));
  $("#progress").innerHTML = t.progress(fmt(cov.packed_ads), fmt(cov.corpus_ads), ymLabel(LAST));
  const own = o.n ? Math.round((o.own / o.n) * 100) : 0;
  const deg = o.eduStated ? o.degreeReq / o.eduStated : 0;
  $("#metrics").innerHTML = [
    [fmt(o.n), t.mAds, t.mAdsD(own)],
    [o.fields ? fmt(o.fields) : "–", t.mOcc, t.mOccD],
    [o.eduStated ? pct(deg, 0) : "–", t.mDeg, t.mDegD(fmt(o.eduStated))],
    [o.yrsMedian == null ? "–" : fmt(o.yrsMedian), t.mExp, t.mExpD(fmt(o.yrsStated))],
  ].map(([v, l, d]) => `<div class="metric"><div class="v">${v}</div><div class="l">${l}</div><div class="d">${d}</div></div>`).join("");
  $("#statusText").textContent = t.status(fmt(o.n), activeFilterText());
  renderChips();
  $("#builtAt").textContent = META.built;
  $("#covKv").innerHTML = [[t.covAds, cov.packed_ads], [t.covCorpus, cov.corpus_ads], [t.covSkills, META.skills.length], [t.covPost, cov.postings]]
    .map(([k, v]) => `<dt>${k}</dt><dd>${fmt(v)}</dd>`).join("");
}

/* windows for the before/after comparisons */
function windows() {
  // default: the long-run trend, first two full years against the latest 12 complete months
  if (S.shiftWin === "trend") return [[Math.max(FIRST, mi(2018, 1)), mi(2019, 12)], [LAST - 11, LAST]];
  if (S.shiftWin === "covid") return [[mi(2019, 3), mi(2020, 2)], [mi(2020, 6), mi(2021, 5)]];
  return [[mi(2021, 11), mi(2022, 10)], [Math.max(mi(2023, 1), LAST - 11), LAST]];
}
const winLabel = (w) => `${ymLabel(w[0])} – ${ymLabel(w[1])}`;

/* signed percentage-point change on one zero-centred axis; before → after values sit beside each skill */
async function drawShift() {
  $("#finding").hidden = true;
  const t = T(), p = palette(), nar = narrow();
  const [a, b] = windows();
  const f = { ...technicalFilter(), m0: 0, m1: META.months.length - 1 };
  SH = await call("shift", { F: f, a, b, k: nar ? 7 : 10 });
  $("#shiftQ").textContent = t.shiftQ(winLabel(a), winLabel(b));
  $("#shiftQ").textContent += lang === "ar" ? " فترات ثابتة؛ تُطبّق مرشحات الوظائف والمهارات، وليس محدد الفترة." : " Fixed windows: job and skill filters apply; the period selector does not.";
  // with few skills the top and bottom lists overlap: keep real gains in one, real losses in the other, each skill once
  const upRows = SH.up.filter((r) => r.d > 0);
  const seen = new Set(upRows.map((r) => r.id));
  const rows = [...upRows, ...SH.down.filter((r) => r.d < 0 && !seen.has(r.id)).reverse()];
  // symmetric axis on a nice step so the end labels never collide (e.g. 0, ±20, ±40)
  const top = Math.max(1, ...rows.map((r) => Math.abs(r.d * 100)));
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => s * 2 >= top) || 50;
  const max = step * 2;
  chart("chShift").setOption({ ...base(),
    grid: { left: labelW() + 8, right: nar ? 54 : 150, top: 8, bottom: 28 },
    xAxis: { type: "value", min: -max, max, interval: nar ? max : step, ...axisStyle(p),
             axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => (v > 0 ? "+" : "") + v + (nar ? "" : (lang === "ar" ? " نقطة" : " pp")) } },
    yAxis: catAxis(p, rows.map((r) => r.name), labelW()),
    tooltip: { ...base().tooltip, trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (ps) => { const r = rows[ps[0].dataIndex]; return `<b>${r.name}</b><br>${pct(r.a)} → ${pct(r.b)} <b>${r.d >= 0 ? "+" : ""}${(r.d * 100).toFixed(1)} pp</b><br><small>${fmt(r.ca)} / ${fmt(r.cb)} ${t.ads}</small>`; } },
    series: [{ type: "bar", barWidth: "58%",
      data: rows.map((r) => ({ value: +(r.d * 100).toFixed(2), itemStyle: { color: r.d >= 0 ? p.up : p.down, borderRadius: r.d >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3] } })),
      label: { show: true, position: "right", distance: 0, color: p.ink3, fontFamily: p.mono, fontSize: 12,
        formatter: (d) => { const r = rows[d.dataIndex]; return nar ? `${d.value > 0 ? "+" : ""}${d.value.toFixed(1)}` : `{v|${d.value > 0 ? "+" : ""}${d.value.toFixed(1)}}  ${pct(r.a, 0)} → ${pct(r.b, 0)}`; },
        rich: { v: { color: p.ink, fontFamily: p.mono, fontSize: 12, fontWeight: 600 } } },
      labelLayout: (params) => ({ x: (chart("chShift").getWidth() - (nar ? 50 : 146)), align: "left" }),
      markLine: { symbol: "none", silent: true, label: { show: false }, lineStyle: { color: p.ink3, type: "solid", width: 1 }, data: [{ xAxis: 0 }] } }] }, true);
  $("#shiftN").textContent = t.nab(fmt(SH.na), fmt(SH.nb));
  $("#shiftFoot").textContent = SH.na < 500 || SH.nb < 500 ? t.small : "";
  table("shift", [t.skill, winLabel(a), winLabel(b), lang === "ar" ? "التغير (نقطة مئوية)" : "Δ pp"], rows.map((r) => [r.name, pct(r.a), pct(r.b), (r.d * 100).toFixed(1)]));
  const plain = !S.major && S.isco === "" && S.emi === "" && S.type === "";
  const gain = SH.up.find((r) => r.d > 0);
  if (S.shiftWin === "trend" && gain && plain && SH.na >= 300 && SH.nb >= 300) {
    const r = gain;
    $("#finding").hidden = false;
    $("#findingText").textContent = t.finding(r.name, pct(r.a), pct(r.b), winLabel(a), winLabel(b), (r.d * 100).toFixed(1));
    $("#findingNote").textContent = t.findingNote;
  }
}

async function drawTimeline() {
  const t = T(), p = palette(), nar = narrow();
  const f = F();
  const m0 = FIRST, m1 = LAST;
  const xs = []; for (let i = m0; i <= m1; i++) xs.push(ym(i));
  // COVID-19 and ChatGPT are reference markers only: light, thin, small labels
  const marks = { symbol: "none", silent: true, lineStyle: { color: p.ink3, type: "dotted", width: 1, opacity: 0.6 },
    label: { color: p.ink3, fontFamily: p.font, fontSize: 11, fontWeight: 500, formatter: (d) => d.name, position: "end", distance: 4 },
    data: [{ xAxis: ym(COVID), name: t.covid }, { xAxis: ym(GPT), name: t.gpt }] };
  if (S.tlMode === "volume") {
    const volume = OV.byMonth.slice(m0, m1 + 1);
    $("#tlTitle").textContent = t.tlTitleVol; $("#tlQ").textContent = t.tlQVol;
    chart("chTimeline").setOption({ ...base(), grid: { left: 56, right: 20, top: 24, bottom: 34 },
      xAxis: { type: "category", data: xs, ...axisStyle(p), axisLabel: yearTicks(p) }, yAxis: { type: "value", ...axisStyle(p) },
      tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: fmt },
      series: [{ type: "bar", data: volume, itemStyle: { color: p.slate, borderRadius: [2, 2, 0, 0] }, markLine: marks }] }, true);
    table("timeline", [t.month, t.ads], xs.map((x, i) => [x, volume[i]]));
    $("#tlFoot").textContent = "";
    return;
  }
  $("#tlTitle").textContent = t.tlTitleSkills; $("#tlQ").textContent = t.tlQSkills;
  $("#tlQ").textContent += lang === "ar" ? " يُعرض السجل الزمني الكامل لمرشحات الوظائف والمهارات الحالية." : " Full history for the current job and skill filters.";
  const ov = OV.topSkills.slice(0, 2).map((s) => s.id);
  const up = GR ? [...GR.technical,...GR.emerging].slice(0,3).map(s=>s.id) : [];
  const ids = [...new Set([...up, ...ov])].slice(0, nar ? 3 : 5);
  const tr = await call("trend", { F: { ...f, m0, m1 }, ids });
  // centred moving average over S.smooth months (pooled: total mentions / total ads); default 12 months = the trend
  const W = +S.smooth || 1, lo = Math.floor((W - 1) / 2), hi = W - 1 - lo;
  const roll = (arr) => arr.map((_, i) => {
    let h = 0, n = 0, m = 0;
    for (let k = Math.max(0, i - lo); k <= Math.min(arr.length - 1, i + hi); k++) { h += arr[k].h; n += arr[k].n; m++; }
    return n >= 30 && m * 2 > W ? +(100 * h / n).toFixed(2) : null;
  });
  const cols = SERIES();
  const series = ids.map((s, k) => ({
    name: META.skills[s][0], type: "line", smooth: 0.3, symbol: "none", connectNulls: false,
    lineStyle: { width: k === 0 ? 2.8 : 2, color: cols[k] }, itemStyle: { color: cols[k] }, emphasis: { focus: "series" },
    endLabel: { show: !nar, formatter: (d) => d.seriesName, color: cols[k], fontFamily: p.font, fontSize: 12.5, fontWeight: 600, distance: 8 },
    labelLayout: { moveOverlap: "shiftY" },
    data: roll(tr.series[k].slice(m0, m1 + 1).map((h, i) => ({ h, n: tr.tot[m0 + i] }))),
    ...(k === 0 ? { markLine: marks } : {}),
  }));
  series.push({ name: t.volLabel, type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: tr.tot.slice(m0, m1 + 1), itemStyle: { color: p.na }, barCategoryGap: "12%" });
  chart("chTimeline").setOption({ ...base(),
    legend: { show: nar, top: 0, left: 0, textStyle: { color: p.ink2, fontFamily: p.font, fontSize: 12 }, icon: "roundRect", itemWidth: 14, itemHeight: 4, data: ids.map((s) => META.skills[s][0]) },
    title: { text: t.volLabel, left: 56, top: nar ? "73%" : "75%", textStyle: { fontSize: 12, color: p.ink3, fontWeight: 500, fontFamily: p.font } },
    grid: [{ left: 56, right: nar ? 16 : 150, top: nar ? 52 : 34, height: nar ? "50%" : "58%" }, { left: 56, right: nar ? 16 : 150, top: nar ? "79%" : "80%", height: "11%" }],
    xAxis: [{ type: "category", data: xs, ...axisStyle(p), axisLabel: { show: false } }, { type: "category", gridIndex: 1, data: xs, ...axisStyle(p), axisLabel: yearTicks(p) }],
    yAxis: [{ type: "value", ...axisStyle(p), axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => v + "%" } },
            { type: "value", gridIndex: 1, ...axisStyle(p), splitNumber: 1, axisLabel: { ...axisStyle(p).axisLabel, fontSize: 11, formatter: (v) => (v >= 1000 ? Math.round(v / 1000) + "k" : v) } }],
    tooltip: { ...base().tooltip, trigger: "axis", formatter: (ps) => `<b>${ymLabel(m0 + ps[0].dataIndex)}</b><br>` + ps.map((x) => `${x.marker}${x.seriesName}: <b>${x.value == null ? "–" : x.seriesType === "bar" ? fmt(x.value) : x.value.toFixed(1) + "%"}</b>`).join("<br>") },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    series }, true);
  $("#tlFoot").textContent = t.partial(ymLabel(LAST));
  table("timeline", [t.month, ...ids.map((s) => META.skills[s][0]), t.ads], xs.map((x, i) => [x, ...series.slice(0, ids.length).map((sr) => (sr.data[i] == null ? "" : sr.data[i])), tr.tot[m0 + i]]));
}

async function drawTop() {
  const t = T(), p = palette(), nar = narrow();
  const rows = OV.topSkills.slice(0, nar ? 10 : 20);
  $("#topQ").textContent = t.topQ(fmt(OV.n));
  $("#chTop").style.height = (rows.length * (nar ? 30 : 24) + 40) + "px";
  chart("chTop").resize();
  chart("chTop").setOption({ ...base(),
    grid: { left: labelW() + 8, right: 54, top: 4, bottom: 26 },
    xAxis: { type: "value", ...axisStyle(p), axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => v + "%" } },
    yAxis: catAxis(p, rows.map((r) => r.name), labelW()),
    tooltip: { ...base().tooltip, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps) => { const r = rows[ps[0].dataIndex]; return `<b>${r.name}</b><br>${pct(r.share)} · ${fmt(r.ads)} ${t.ads}<br><small>${t.types[r.type]}</small>`; } },
    series: [{ type: "bar", data: rows.map((r) => +(r.share * 100).toFixed(2)), barWidth: "64%", itemStyle: { color: p.teal, borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: "right", formatter: (d) => d.value.toFixed(1) + "%", color: p.ink2, fontFamily: p.mono, fontSize: 12 } }] }, true);
  $("#topN").textContent = t.nOf(fmt(OV.n));
  table("top", [t.skill, t.ctypeCol, t.share, t.ads], OV.topSkills.map((r) => [r.name, t.types[r.type], pct(r.share), r.ads]));
}

async function drawMatrix() {
  const t = T(), p = palette(), nar = narrow();
  const f = F();
  const groups = OV.byIsco.slice(0, META.isco.length).map((n, g) => [g, n]).filter(([, n]) => n >= 150).sort((a, b) => b[1] - a[1]).slice(0, nar ? 8 : 12).map(([g]) => g);
  const skills = OV.topSkills.slice(0, nar ? 6 : 12).map((s) => s.id);
  $("#mxEmpty").hidden = !!groups.length && !!skills.length;
  $("#chMatrix").hidden = !groups.length || !skills.length;
  if (groups.length) chart("chMatrix").resize();
  if (!groups.length || !skills.length) { chart("chMatrix").clear(); return; }
  const mx = await call("matrix", { F: f, groups, skills });
  const data = [];
  groups.forEach((g, r) => skills.forEach((s, c) => data.push([c, r, mx.tot[r] ? +(100 * mx.cell[r][c] / mx.tot[r]).toFixed(1) : 0])));
  const max = Math.max(5, ...data.map((d) => d[2]));
  const gname = (g) => `${META.isco[g][0]} · ${lang === "ar" ? META.isco[g][2] : META.isco[g][1]}`;
  chart("chMatrix").setOption({ ...base(),
    grid: { left: nar ? 120 : 220, right: 8, top: 8, bottom: nar ? 96 : 110 },
    xAxis: { type: "category", data: skills.map((s) => META.skills[s][0]), axisLabel: { rotate: 40, color: p.ink, fontSize: 12, interval: 0, width: 110, overflow: "truncate" }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: catAxis(p, groups.map(gname), nar ? 112 : 210),
    visualMap: { show: false, min: 0, max, inRange: { color: [p.surface, p.soft, p.teal] } },
    tooltip: { ...base().tooltip, formatter: (d) => `<b>${META.skills[skills[d.value[0]]][0]}</b><br>${gname(groups[d.value[1]])}<br>${d.value[2]}% · ${lang === "ar" ? "العينة" : "n"} = ${fmt(mx.tot[d.value[1]])}` },
    series: [{ type: "heatmap", data, label: { show: !nar, formatter: (d) => (d.value[2] >= 1 ? Math.round(d.value[2]) : ""), color: p.ink, fontFamily: p.mono, fontSize: 11 },
      itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 3 } }] }, true);
  $("#mxFoot").textContent = t.mxNote;
}

/* employer industry (ISIC Rev.4 sections): share of the selected ads; click a bar to filter */
async function drawInd() {
  const t = T(), p = palette();
  if (!META.industries || !OV.byInd) return;
  const NI = META.industries.length, n = Math.max(1, OV.n);
  const rows = META.industries.map((x, i) => ({ i, name: `${x[0]} · ${lang === "ar" ? x[2] : x[1]}`, v: OV.byInd[i] || 0 }))
    .filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const unk = OV.byInd[NI] || 0;
  const cats = [...rows.map((r) => r.name), "", t.unknown];
  const data = [...rows.map((r) => ({ value: +(100 * r.v / n).toFixed(1), raw: r.v, ind: r.i, itemStyle: { color: S.ind === String(r.i) ? p.navy : p.teal } })),
                { value: null }, { value: +(100 * unk / n).toFixed(1), raw: unk, itemStyle: { color: p.na } }];
  $("#chInd").style.height = (cats.length * 26 + 40) + "px";
  chart("chInd").resize();
  chart("chInd").setOption({ ...base(), grid: { left: labelW() + 70, right: 54, top: 4, bottom: 26 },
    xAxis: { type: "value", ...axisStyle(p), axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => v + "%" } },
    yAxis: catAxis(p, cats, labelW() + 60),
    tooltip: { ...base().tooltip, trigger: "item", formatter: (d) => `<b>${d.name}</b><br>${d.value}% · ${fmt(d.data.raw)} ${t.ads}` },
    series: [{ type: "bar", barWidth: "64%", data, itemStyle: { borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: "right", color: p.ink2, fontFamily: p.mono, fontSize: 12, formatter: (d) => (d.value == null ? "" : d.value.toFixed(d.value < 10 ? 1 : 0) + "%") } }] }, true);
  chart("chInd").off("click");
  chart("chInd").on("click", (d) => { if (d.data && d.data.ind != null) setFilter("ind", d.data.ind); });
  $("#indN").textContent = t.nOf(fmt(OV.n));
  table("ind", [t.industry, t.share, t.ads], [...rows.map((r) => [r.name, pct(r.v / n), r.v]), [t.unknown, pct(unk / n), unk]]);
}

async function drawEmi() {
  const t = T(), p = palette();
  const names = META.emirates.map((e) => (lang === "ar" ? e[2] : e[1])).concat([t.unknown]);
  const vals = OV.byEmi, n = Math.max(1, OV.n);
  /* "Not stated" sits apart: an empty spacer row before it */
  const cats = [...names.slice(0, -1), "", names[names.length - 1]];
  const data = [...vals.slice(0, -1).map((v) => ({ value: +(100 * v / n).toFixed(1), raw: v, itemStyle: { color: p.teal } })), { value: null },
                { value: +(100 * vals[vals.length - 1] / n).toFixed(1), raw: vals[vals.length - 1], itemStyle: { color: p.na } }];
  chart("chEmi").setOption({ ...base(), grid: { left: labelW() - 30, right: 54, top: 4, bottom: 26 },
    xAxis: { type: "value", ...axisStyle(p), axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => v + "%" } },
    yAxis: catAxis(p, cats, labelW() - 40),
    tooltip: { ...base().tooltip, trigger: "item", formatter: (d) => `<b>${d.name}</b><br>${d.value}% · ${fmt(d.data.raw)} ${t.ads}` },
    series: [{ type: "bar", barWidth: "62%", data, itemStyle: { borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: "right", color: p.ink2, fontFamily: p.mono, fontSize: 12, formatter: (d) => (d.value == null ? "" : d.value.toFixed(d.value < 10 ? 1 : 0) + "%") } }] }, true);
  chart("chEmi").off("click");
  chart("chEmi").on("click", (d) => { if (d.dataIndex < META.emirates.length) setFilter("emi", d.dataIndex); });
  $("#emiN").textContent = t.nOf(fmt(OV.n));
  table("emi", [t.emirate, t.share, t.ads], names.map((nm, i) => [nm, pct(vals[i] / n), vals[i]]));
}

async function drawReq() {
  const t = T(), p = palette(), nar = narrow();
  const [a, b] = windows();
  const [R, selected] = await Promise.all([
    call("requirements", { F: { ...F(), m0: Math.min(a[0], S.m0), m1: Math.max(b[1], S.m1) }, a, b }),
    call("requirements", { F: F(), a, b })
  ]);
  R.years = selected.years;
  const only = S.stated === "stated";
  const years = Object.keys(R.years).filter((y) => +y >= 2018 && +y <= +ym(LAST).slice(0, 4)).sort();
  const order = ["phd", "master", "bachelor", "diploma", "vocational", "certificate", "secondary", ...(only ? [] : ["none"])];
  const cols = { phd: p.navy, master: css("--s4"), bachelor: p.teal, diploma: p.amber, vocational: css("--s5"), certificate: css("--s6"), secondary: p.slate, none: p.na };
  const tot = (y) => order.reduce((s, k) => s + (R.years[y][k] || 0), 0);
  chart("chEdu").setOption({ ...base(),
    legend: { top: 0, left: 0, textStyle: { color: p.ink2, fontFamily: p.font, fontSize: 12 }, itemWidth: 10, itemHeight: 10, itemGap: 12 },
    grid: { left: 46, right: 8, top: nar ? 64 : 40, bottom: 28 },
    xAxis: { type: "category", data: years, ...axisStyle(p) },
    yAxis: { type: "value", max: 100, ...axisStyle(p), axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => v + "%" } },
    tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => v.toFixed(1) + "%" },
    series: order.map((k) => ({ name: t.levels[k], type: "bar", stack: "e", barWidth: "58%", itemStyle: { color: cols[k] },
      data: years.map((y) => +(100 * (R.years[y][k] || 0) / Math.max(1, tot(y))).toFixed(1)) })) }, true);
  $("#eduN").textContent = t.nYears(fmt(years.reduce((s, y) => s + tot(y), 0)));
  table("edu", [t.year, ...order.map((k) => t.levels[k]), t.ads], years.map((y) => [y, ...order.map((k) => pct((R.years[y][k] || 0) / Math.max(1, tot(y)))), tot(y)]));
  const la = winLabel(a), lb = winLabel(b);
  $("#expQ").textContent = t.expQ(la, lb);
  $("#expQ").textContent += lang === "ar" ? " فترات مقارنة ثابتة، مستقلة عن محدد الفترة." : " Fixed comparison windows, independent of the period selector.";
  const bands = only ? t.bands.slice(0, -1) : t.bands;
  const A = R.bands[0].slice(0, bands.length), B = R.bands[1].slice(0, bands.length);
  const sa = A.reduce((x, y) => x + y, 0), sb = B.reduce((x, y) => x + y, 0);
  /* horizontal: band labels stay readable on phones */
  chart("chExp").setOption({ ...base(),
    legend: { top: 0, left: 0, textStyle: { color: p.ink2, fontFamily: p.font, fontSize: 12 }, itemWidth: 10, itemHeight: 10, data: [la, lb] },
    grid: { left: 84, right: 50, top: nar ? 52 : 36, bottom: 26 },
    xAxis: { type: "value", ...axisStyle(p), axisLabel: { ...axisStyle(p).axisLabel, formatter: (v) => v + "%" } },
    yAxis: catAxis(p, bands, 76),
    tooltip: { ...base().tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => v.toFixed(1) + "%" },
    series: [{ name: la, type: "bar", data: A.map((v) => sa ? +(100 * v / sa).toFixed(1) : null), itemStyle: { color: p.slate, borderRadius: [0, 2, 2, 0] }, barGap: "10%", barWidth: "34%" },
             { name: lb, type: "bar", data: B.map((v) => sb ? +(100 * v / sb).toFixed(1) : null), itemStyle: { color: p.teal, borderRadius: [0, 2, 2, 0] }, barWidth: "34%",
               label: { show: !nar, position: "right", color: p.ink2, fontFamily: p.mono, fontSize: 11.5, formatter: (d) => d.value.toFixed(0) + "%" } }] }, true);
  $("#expN").textContent = t.nab(fmt(sa), fmt(sb));
  $("#expFoot").textContent = sa < 300 || sb < 300 ? t.small : "";
  table("exp", [t.band, la, lb], bands.map((bd, i) => [bd, sa ? pct(A[i] / sa) : "–", sb ? pct(B[i] / sb) : "–"]));
}

init().catch((e) => { $("#metrics").innerHTML = `<div class="metric"><div class="l">Could not load the data: ${e.message}</div></div>`; console.error(e); });
