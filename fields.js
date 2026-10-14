/* Field of study requested in the advertisements (ISCED-F 2013 narrow fields), inside Qualifications Intelligence.
   Same comparison windows and filters as the module; shares are of all advertisements in each window. */
"use strict";
(function () {
  const ar = () => lang === "ar";
  const tx = (en, a) => (ar() ? a : en);
  const pc = (x) => (x == null ? "—" : (100 * x).toFixed(1) + "%");
  let busy = false;

  async function render(box) {
    if (busy) return;
    busy = true;
    try {
      const preset = (document.getElementById("r3-window") || {}).value;
      const r = await call("fields", { F: F(), preset });
      if (!r || !r.available) {
        box.innerHTML = `<p class="r3-placeholder"><strong>${tx("Field of study", "التخصص الدراسي")}</strong> — ${tx("Not available in this data release.", "غير متاح في هذا الإصدار.")}</p>`;
        return;
      }
      const [A, B] = r.w, K = META.isced.length;
      const rows = [];
      for (let j = 0; j < K; j++) {
        const pa = A.n ? A.c[j] / A.n : 0, pb = B.n ? B.c[j] / B.n : 0;
        if (A.c[j] + B.c[j] < 20) continue;                    // small cells are not shown
        rows.push({ j, pa, pb, ca: A.c[j], cb: B.c[j], d: pb - pa });
      }
      rows.sort((x, y) => y.pb - x.pb);
      const name = (j) => `${META.isced[j][0]} · ${ar() ? META.isced[j][2] : META.isced[j][1]}`;
      const lab = (w) => `${ymLabel(w[0])} – ${ymLabel(w[1])}`;
      const head = `<tr><th>${tx("Field of study (ISCED-F 2013)", "التخصص (تصنيف ISCED-F 2013)")}</th><th>${lab(r.a)}</th><th>${lab(r.b)}</th><th>${tx("Change", "التغير")}</th></tr>`;
      const body = rows.map((x) => `<tr><td>${name(x.j)}</td><td class="n">${pc(x.pa)}</td><td class="n">${pc(x.pb)}</td>` +
        `<td class="n" style="color:${x.d >= 0 ? "var(--up)" : "var(--down)"}">${x.d >= 0 ? "+" : ""}${(100 * x.d).toFixed(2)} ${tx("pp", "نقطة")}</td></tr>`).join("");
      const named = (w) => (w.n ? w.named / w.n : null), any = (w) => (w.n ? w.any / w.n : null);
      box.innerHTML = `<h4 class="r3-sub">${tx("Field of study requested", "التخصصات الدراسية المطلوبة")}</h4>
        <p class="small">${tx("Share of advertisements naming each field of education, mapped to UNESCO ISCED-F 2013 narrow fields. An advertisement can name several fields. Explicit text only; never inferred from the job title.",
          "نسبة الإعلانات التي تذكر كل مجال دراسي، مصنفة وفق المجالات الضيقة لتصنيف اليونسكو ISCED-F 2013. قد يذكر الإعلان أكثر من مجال. النص الصريح فقط، دون استنتاج من المسمى الوظيفي.")}</p>
        <p class="small">${tx("Names a field of study", "يذكر تخصصاً دراسياً")}: <b>${pc(named(A))} → ${pc(named(B))}</b> · ${tx("Accepts any discipline", "يقبل أي تخصص")}: <b>${pc(any(A))} → ${pc(any(B))}</b> · n = ${A.n.toLocaleString("en-US")} / ${B.n.toLocaleString("en-US")}</p>
        <div class="tablewrap"><table class="data">${head}${body}</table></div>`;
    } catch (e) {
      console.error(e);
    } finally {
      busy = false;
    }
  }

  // the Qualifications tab is re-rendered by modules.js: fill the container whenever it appears empty
  new MutationObserver(() => {
    const box = document.getElementById("r3-fields");
    if (box && !box.dataset.filled) { box.dataset.filled = "1"; render(box); }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

/* agentic-AI comparison: 2024 has half of its ads in Web Data Commons, which stops in 2024, so the all-archive view is
   coverage-limited; switch to the archive present in both windows (Internet Archive) unless the user picked one. */
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "r3-window" && (e.target.value === "agent" || e.target.value === "gpt")) {
    const a = document.getElementById("r3-archive");
    if (a && a.value === "") { a.value = "0"; a.dispatchEvent(new Event("change", { bubbles: true })); }
  }
});
