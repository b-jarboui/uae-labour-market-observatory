/* "Ask the Observatory": Gemini Flash with function calling over the Observatory's own data.
   Gemini never answers from memory about the UAE market: it calls the functions below, which run the same
   queries as the charts (worker.js), and writes its answer from their results. */
"use strict";
(function () {
  const CFG = window.OBS_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  let lang = "en", history = [];
  const T = () => window.I18N[lang];
  const mi = (y, m) => (y - 2015) * 12 + (m - 1);

  const TOOLS = [{ functionDeclarations: [
    { name: "job_profile", description: "Skills, degree levels and experience that UAE job ads ask for a job title (search words), optionally in a year range.",
      parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "job title words, e.g. 'data analyst', 'nurse', 'civil engineer'" },
        from_year: { type: "INTEGER" }, to_year: { type: "INTEGER" } }, required: ["query"] } },
    { name: "skill_trend", description: "Yearly share (%) of UAE job ads mentioning a skill, 2018 to latest, optionally for one job title.",
      parameters: { type: "OBJECT", properties: { skill: { type: "STRING", description: "canonical English skill name, lower case, e.g. 'python', 'communication'" },
        job: { type: "STRING", description: "optional job title words" } }, required: ["skill"] } },
    { name: "compare_periods", description: "Skills that gained or lost the most share of ads between two periods: 'gpt' = 12 months before Nov 2022 vs latest 12 months; 'covid' = Mar 2019-Feb 2020 vs Jun 2020-May 2021. Optionally for one job title.",
      parameters: { type: "OBJECT", properties: { window: { type: "STRING", enum: ["gpt", "covid"] }, job: { type: "STRING" } }, required: ["window"] } },
    { name: "search_titles", description: "List job titles present in the data that match search words.",
      parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
  ] }];

  const allF = () => { const [a, b] = window.OBS.range; return { m0: a, m1: b, types: null, req: "any", where: "any" }; };
  async function titleIds(q) {
    if (!q) return null;
    const names = await window.OBS.call("titles", { q, k: 400 });
    const all = window.OBS.meta.titles;
    return names.map((n) => all.indexOf(n)).filter((i) => i >= 0);
  }
  const RUN = {
    async job_profile({ query, from_year, to_year }) {
      const F = allF();
      if (from_year) F.m0 = Math.max(F.m0, mi(from_year, 1));
      if (to_year) F.m1 = Math.min(F.m1, mi(to_year, 12));
      return window.OBS.call("job", { F, q: query });
    },
    async skill_trend({ skill, job }) {
      const [id] = await window.OBS.call("skillIds", { names: [skill] });
      if (id < 0) return { skill, found: false };
      const F = allF();
      const tids = await titleIds(job);
      if (job && !tids.length) return { skill, job, found: false, note: "no matching job titles" };
      const tr = await window.OBS.call("trend", { F: { ...F, title: tids }, ids: [id] });
      const years = {};
      window.OBS.meta.months.forEach((m, i) => { const y = m.slice(0, 4); if (+y < 2018 || !tr.tot[i]) return;
        years[y] = years[y] || { ads: 0, hits: 0 }; years[y].ads += tr.tot[i]; years[y].hits += tr.series[0][i]; });
      return { skill, job: job || "all jobs", byYear: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, { ads: v.ads, sharePct: +(100 * v.hits / v.ads).toFixed(1) }])) };
    },
    async compare_periods({ window: w, job }) {
      const [, last] = window.OBS.range;
      const [a, b] = w === "covid" ? [[mi(2019, 3), mi(2020, 2)], [mi(2020, 6), mi(2021, 5)]] : [[mi(2021, 11), mi(2022, 10)], [last - 11, last]];
      const tids = await titleIds(job);
      const r = await window.OBS.call("shift", { F: { ...allF(), title: tids }, a, b, k: 10 });
      const s = (x) => ({ skill: x.name, beforePct: +(100 * x.a).toFixed(1), afterPct: +(100 * x.b).toFixed(1) });
      return { window: w, job: job || "all jobs", adsBefore: r.na, adsAfter: r.nb, gaining: r.up.map(s), losing: r.down.map(s) };
    },
    async search_titles({ query }) { return { titles: (await window.OBS.call("titles", { q: query, k: 20 })) }; },
  };

  const system = () => `You are the assistant of the UAE Labour Market Observatory. Answer questions about jobs and skills in the UAE using ONLY results from the functions, which query ~239,000 UAE job advertisements (2018-2026). Always call a function before answering a factual question. Quote numbers as shares of advertisements and say how many ads they rest on; if fewer than 100 ads, say the sample is small. Advertised demand is not employment. Never invent figures. Be concise: at most 8 lines, with a short list when useful. Answer in ${lang === "ar" ? "Arabic" : "English"}.`;

  async function gemini(contents) {
    const body = { systemInstruction: { parts: [{ text: system() }] }, contents, tools: TOOLS, generationConfig: { temperature: 0.2 } };
    const url = CFG.GEMINI_PROXY || `https://generativelanguage.googleapis.com/v1beta/models/${CFG.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${encodeURIComponent(CFG.GEMINI_KEY)}`;
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CFG.GEMINI_PROXY ? { model: CFG.GEMINI_MODEL, ...body } : body) });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  async function ask(q) {
    if (!CFG.GEMINI_PROXY && !CFG.GEMINI_KEY) { add("bot", T().askNoKey); return; }
    add("user", q);
    const thinking = add("bot", T().askThinking);
    history.push({ role: "user", parts: [{ text: q }] });
    const used = [];
    try {
      for (let step = 0; step < 5; step++) {
        const res = await gemini(history);
        const parts = (res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts) || [];
        history.push({ role: "model", parts });
        const calls = parts.filter((p) => p.functionCall);
        if (!calls.length) {
          thinking.firstChild.textContent = parts.map((p) => p.text || "").join("").trim() || "…";
          if (used.length) { const s = document.createElement("span"); s.className = "tool"; s.textContent = `${T().askUsed}: ${used.join(", ")}`; thinking.appendChild(s); }
          return;
        }
        const responses = [];
        for (const c of calls) {
          const fn = RUN[c.functionCall.name];
          let out;
          try { out = fn ? await fn(c.functionCall.args || {}) : { error: "unknown function" }; } catch (e) { out = { error: e.message }; }
          used.push(`${c.functionCall.name}(${Object.values(c.functionCall.args || {}).join(", ")})`);
          responses.push({ functionResponse: { name: c.functionCall.name, response: { result: out } } });
        }
        history.push({ role: "user", parts: responses });
      }
      thinking.firstChild.textContent = "…";
    } catch (e) {
      thinking.firstChild.textContent = e.message;
    }
  }

  function add(who, text) {
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.appendChild(document.createTextNode(text));
    $("#msgs").appendChild(d);
    $("#msgs").scrollTop = $("#msgs").scrollHeight;
    return d;
  }
  function suggestions() {
    $("#suggest").innerHTML = "";
    T().askSuggest.forEach((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = s; b.onclick = () => ask(s); $("#suggest").appendChild(b); });
  }
  function open() {
    $("#drawer").hidden = false;
    if (!$("#msgs").children.length) add("bot", T().askHello);
    suggestions();
    $("#askInput").focus();
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("#askBtn").onclick = open;
    $("#drawerClose").onclick = () => ($("#drawer").hidden = true);
    $("#askForm").onsubmit = (e) => { e.preventDefault(); const q = $("#askInput").value.trim(); if (q) { $("#askInput").value = ""; ask(q); } };
    addEventListener("keydown", (e) => { if (e.key === "Escape") $("#drawer").hidden = true; });
  });
  window.Chat = { lang: (l) => { lang = l; if (!$("#drawer").hidden) suggestions(); } };
})();
