/* Progressive skill exploration. No figures or definitions are invented. */
"use strict";
const safe = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const st = (en, ar) => lang === 'ar' ? ar : en;
let skillIndex = new Map(), skillInfo = {}, skillRequest = 0;
const escoReady = fetch((CFG.DATA_BASE || 'data/') + 'skill_esco.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const infoReady = fetch((CFG.DATA_BASE || 'data/') + 'skill_info.json').then(r => r.ok ? r.json() : {}).then(v => skillInfo = v).catch(() => {});
// display name: Arabic name in the Arabic view; otherwise sentence case with acronyms and proper nouns restored
const ACR = new Set('sap pmp html css sql crm erp hr it ui ux uae gcc aws bim cad ifrs gaap vat kpi seo sem ppc api ms qa qc hse iso ai ml bi etl sap fico mep hvac plc scada cpa cma acca cfa dha moh doh haad pmi nebosh iosh osha gis rics leed autocad revit excel haccp itil cissp ca ccna prince2 ielts cpr cisa cism ccnp aca cima togaf rera dbs acc asme cia mcse fidic pci dss gdpr ohsas ccie ceh cobit mba nist mrics astm nfpa adnoc bls cipd oshad crisc pgce gmp toefl iec qts acsl ias gcaa oscp cct mcsa sox cips cmmi noc shrm bs ccst cams hipaa nec sira nesa gmc usmle cfe easa tefl celta habc ansi frm pqe giac ashrae gcih cswip ica sabsa ccsp hseq owasp nace aisc pals icaw cis dewa iii'.split(' '));
const PROPER = new Set('english arabic french hindi urdu tagalog russian german spanish chinese mandarin italian microsoft google oracle salesforce python java javascript linux windows adobe photoshop illustrator primavera tally sage quickbooks power bi tableau estidama comptia'.split(' '));
window.skillLabel = value => {
  const v = String(value);
  if (lang === 'ar') { const a = skillInfo[v]?.name_ar; if (a) return a; }
  const exact = {'whatsapp':'WhatsApp','google sheets':'Google Sheets','power bi':'Power BI','microsoft power bi':'Microsoft Power BI'};
  if(exact[v]) return exact[v];
  const out = v.split(' ').map(w => ACR.has(w) ? (w === 'autocad' ? 'AutoCAD' : w === 'excel' ? 'Excel' : w === 'prince2' ? 'PRINCE2' : w.toUpperCase()) : PROPER.has(w) ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  return out[0] ? out[0].toUpperCase() + out.slice(1) : out;
};
window.skillLink = value => {
  const id = skillIndex.get(String(value).toLowerCase());
  const label = window.skillLabel(value);
  return id === undefined ? safe(value) : `<button class="skill-link" data-skill="${id}"><bdi>${safe(label)}</bdi> <span aria-hidden="true">ⓘ</span></button>`;
};
const dialog = document.createElement('dialog');
dialog.className = 'skill-dialog';
dialog.setAttribute('aria-labelledby', 'skillTitle');
document.body.append(dialog);
dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-close-skill]')) dialog.close(); });
dialog.addEventListener('close', () => { skillRequest++; document.body.style.overflow = ''; if(charts.skillTrend) { charts.skillTrend.dispose(); delete charts.skillTrend; } });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-skill]');
  if (b) openSkill(+b.dataset.skill);
});

const explorer = document.createElement('div');
explorer.className = 'explorer';
$('#skills .sec-head').after(explorer);
function setupExplorer() {
  const previous = $('#skillSearch')?.value || '';
  const focused = document.activeElement?.id === 'skillSearch';
  explorer.innerHTML = `<div><span class="eyebrow">${st('THE SKILL EXPLORER','استكشف المهارات')}</span><h3>${st('A skill. Explained by the evidence.','كل مهارة، تشرحها البيانات.')}</h3><p>${st('Search any skill to understand what it means and where employers ask for it.','ابحث عن أي مهارة لفهم معناها وأين يطلبها أصحاب العمل.')}</p></div><div class="skill-search"><label for="skillSearch">${st('Find a skill','ابحث عن مهارة')}</label><input id="skillSearch" type="search" autocomplete="off" placeholder="${st('Try stakeholder management, BIM…','مثلاً stakeholder management أو BIM…')}" aria-controls="skillResults"><div id="skillResults" aria-live="polite"></div></div>`;
  const search = $('#skillSearch');
  search.value = previous;
  if (focused) search.focus();
  const results = () => {
    const q = search.value.trim().toLowerCase();
    const entries = q ? META.skills.map((s,id)=>({name:s[0],id})).filter(s=>s.name.toLowerCase().includes(q) || (skillInfo[s.name]?.name_ar || '').includes(q)).slice(0,12) : OV.topSkills.slice(0,3);
    $('#skillResults').innerHTML = entries.length ? entries.map(s => window.skillLink(s.name)).join('') : `<p>${st('No matching skills. Try another term.','لا توجد مهارات مطابقة. جرّب مصطلحاً آخر.')}</p>`;
  };
  search.oninput = results;
  search.onkeydown = e => { if(e.key === 'Enter') $('#skillResults button')?.click(); };
  results();
}

window.enhanceSkills = function() {
  skillIndex = new Map(META.skills.map((s,i)=>[s[0].toLowerCase(),i]));
  setupExplorer();
  for (const [key,[head,rows]] of Object.entries(TABLES)) table(key,head,rows);
  for (const id of ['chTimeline','chShift','chTop','chMatrix']) {
    const c = charts[id]; if(!c) continue;
    const opt = c.getOption();
    if (!opt) continue;                       // chart not drawn yet (or cleared)
    const names = [...new Set([...(opt.xAxis || []).flatMap(a=>a.data || []), ...(opt.yAxis || []).flatMap(a=>a.data || []), ...(opt.series || []).map(s=>s.name)].filter(n=>skillIndex.has(String(n).toLowerCase())))];
    let list = document.getElementById(id+'Skills');
    if(!list) { list = document.createElement('details'); list.id=id+'Skills'; list.className='chart-skills'; document.getElementById(id).after(list); }
    list.innerHTML = `<summary>${st('ⓘ Explore the skills in this chart','ⓘ استكشف مهارات هذا الرسم')}</summary><div>${names.map(window.skillLink).join('')}</div>`;
    list.hidden = !names.length;
    c.off('click');
    c.on('click', d => {
      const name = d.componentType === 'xAxis' || d.componentType === 'yAxis' ? d.value : id === 'chMatrix' && d.value ? opt.xAxis[0].data[d.value[0]] : id === 'chTimeline' ? d.seriesName : d.name || d.value;
      const sid = skillIndex.get(String(name).toLowerCase()); if(sid !== undefined) return openSkill(sid);
      // an occupation label in the matrix filters the whole page to that occupation group
      if (id === 'chMatrix' && d.componentType === 'yAxis' && window.setFilter) {
        const g = META.isco.findIndex(x => `${x[0]} · ${x[1]}` === d.value || `${x[0]} · ${x[2]}` === d.value);
        if (g >= 0) window.setFilter('isco', g);
      }
    });
    const axes = {};
    for(const key of ['xAxis','yAxis']) axes[key] = (opt[key] || []).map(a => ({triggerEvent:true,...((a.data || []).some(n=>skillIndex.has(String(n).toLowerCase())) ? {axisLabel:{formatter:v=>(skillIndex.has(String(v).toLowerCase()) ? window.skillLabel(v) : v)+' ⓘ'}} : {})}));
    c.setOption(axes);
    const tip = opt.tooltip?.[0];
    if(tip?.formatter && !tip.formatter.skillEnhanced) {
      const original = tip.formatter;
      const formatter = params => {
        let html = original(params);
        for(const name of names.slice().sort((a,b)=>b.length-a.length)) html = html.split(`<b>${name}</b>`).join(window.skillLink(name));
        if(id === 'chTimeline') html += `<div class="tooltip-skills">${names.map(window.skillLink).join(' ')}</div>`;
        return html;
      };
      formatter.skillEnhanced = true;
      c.setOption({tooltip:{enterable:true,hideDelay:350,formatter}});
    }
  }
  if(!$('#finding').hidden && SH?.up[0]) {
    const sid=SH.up[0].id;
    const r=SH.up[0], [a,b]=windows();
    $('#findingText').innerHTML = safe(T().finding(r.name,pct(r.a),pct(r.b),winLabel(a),winLabel(b),(r.d*100).toFixed(1))) + ` ${window.skillLink(META.skills[sid][0])}`;
  }
};

async function openSkill(id) {
  if(!META.skills[id]) return;
  const token = ++skillRequest, name = META.skills[id][0], f = {...F()}, locale = lang;
  dialog.innerHTML = `<div class="skill-dialog-head"><span class="eyebrow">${st('SKILL BRIEFING','ملف المهارة')}</span><button class="btn" data-close-skill aria-label="${st('Close','إغلاق')}">×</button></div><h2 id="skillTitle"><bdi>${safe(name)}</bdi></h2><div id="skillBody" aria-live="polite">${st('Reading the evidence…','جارٍ قراءة البيانات…')}</div>`;
  if(!dialog.open) dialog.showModal();
  document.body.style.overflow='hidden';
  try {
    const groups=META.isco.map((_,i)=>i);
    const [overview, tr, mx] = await Promise.all([
      call('overview',{F:f}), call('trend',{F:{...f,m0:0,m1:META.months.length-1},ids:[id]}),
      call('matrix',{F:f,groups,skills:[id]}), infoReady
    ]);
    if(token!==skillRequest || locale!==lang) return;
    const sum=(arr,a,b)=>arr.slice(a,b+1).reduce((x,y)=>x+y,0);
    const hits=sum(tr.series[0],f.m0,f.m1);
    const def=skillInfo[name]?.[lang];
    $('#skillTitle').textContent=window.skillLabel(name);
    // standard reference: closest ESCO concept in brackets, only for strong matches (else the original name alone)
    const esco = (await escoReady)[name];
    if (esco) $('#skillTitle').insertAdjacentHTML('afterend', `<p class="esco-ref">(ESCO: <a href="${safe(esco[1])}" target="_blank" rel="noopener">${safe(esco[0])}</a> ↗)</p>`);
    const comparisons = [
      [st('Long-run trend (2018–19 vs latest year)','الاتجاه طويل المدى (2018–2019 مقابل آخر سنة)'),[Math.max(FIRST,mi(2018,1)),mi(2019,12)],[LAST-11,LAST]],
      [st('Around ChatGPT (Nov 2020–Oct 2022 vs 2023–2024)','حول ChatGPT (نوفمبر 2020–أكتوبر 2022 مقابل 2023–2024)'),[mi(2020,11),mi(2022,10)],[mi(2023,1),mi(2024,12)]],
      [st('Around COVID-19','حول كوفيد-19'),[mi(2019,3),mi(2020,2)],[mi(2020,6),mi(2021,5)]],
      [st('Around agentic AI (2023–2024 vs 2025 onwards)','حول الذكاء الاصطناعي الوكيلي (2023–2024 مقابل 2025 وما بعدها)'),[mi(2023,1),mi(2024,12)],[mi(2025,1),LAST]]];
    const rows=groups.map((g,i)=>({g,n:mx.tot[i],h:mx.cell[i][0]})).filter(r=>r.h).sort((a,b)=>b.h-a.h).slice(0,5);
    $('#skillBody').innerHTML = `${def ? `<p class="skill-definition">${safe(def)}</p>` : ''}<p class="small">${safe(activeFilterText())}</p><div class="skill-stats"><div><strong>${overview.n ? pct(hits/overview.n) : '—'}</strong><span>${st('of selected advertisements','من الإعلانات المختارة')}</span></div><div><strong>${fmt(hits)}</strong><span>${st('mentions · sample','إشارات · العينة')} ${fmt(overview.n)}</span></div></div><h3>${st('Demand over time','الطلب عبر الزمن')}</h3><p class="small">${st('Monthly share within the selected period. Gaps indicate fewer than 30 advertisements.','النسبة الشهرية خلال الفترة المختارة. الفجوات تشير إلى أقل من 30 إعلاناً.')}</p><div id="skillTrend" class="chart" role="img" aria-label="${st('Monthly skill prevalence','النسبة الشهرية للمهارة')}"></div><h3>${st('Where this skill is requested','أين تُطلب هذه المهارة')}</h3><p class="small">${st('Top occupations by number of matching ads. Share is within each occupation.','أبرز المهن حسب عدد الإعلانات المطابقة. النسبة ضمن كل مهنة.')}</p><div class="occupation-list">${rows.length ? rows.map(r=>`<div><span>${safe(META.isco[r.g][0]+' · '+META.isco[r.g][lang==='ar'?2:1])}<small>n = ${fmt(r.n)} · ${fmt(r.h)} ${T().ads}</small></span><b>${pct(r.h/r.n)}</b></div>`).join('') : st('No matching advertisements.','لا توجد إعلانات مطابقة.')}</div><h3>${st('Across the two turning points','عبر نقطتي التحول')}</h3><p class="small">${st('Same job and skill filters; fixed comparison periods, independent of the period selector. These comparisons do not establish causation.','نفس مرشحات الوظائف والمهارات؛ فترات مقارنة ثابتة مستقلة عن محدد الفترة. هذه المقارنات لا تثبت السببية.')}</p><div class="skill-comparisons">${comparisons.map(([title,a,b])=>{
      const na=sum(tr.tot,...a), nb=sum(tr.tot,...b), pa=na?sum(tr.series[0],...a)/na:null,pb=nb?sum(tr.series[0],...b)/nb:null;
      const delta=pa===null||pb===null?null:(pb-pa)*100;
      return `<article><h4>${title}</h4><strong>${delta===null?'—':(delta>0?'+':'')+delta.toFixed(1)+(lang==='ar'?' نقطة':' pp')}</strong><p>${pa===null?'—':pct(pa)} → ${pb===null?'—':pct(pb)}</p><small>${winLabel(a)}<br>${winLabel(b)}<br>${lang==='ar'?'العينة':'n'} = ${fmt(na)} / ${fmt(nb)}${na<500||nb<500?'<br>'+T().small:''}</small></article>`;
    }).join('')}</div><details class="chart-skills"><summary>${st('Monthly data','البيانات الشهرية')}</summary><table class="data"><thead><tr><th>${T().month}</th><th>${T().share}</th><th>${T().ads}</th></tr></thead><tbody>${tr.tot.slice(f.m0,f.m1+1).map((n,i)=>`<tr><td>${ym(f.m0+i)}</td><td>${n?pct(tr.series[0][f.m0+i]/n):'—'}</td><td>${fmt(n)}</td></tr>`).join('')}</tbody></table></details>`;
    const p=palette();
    if(charts.skillTrend) {charts.skillTrend.dispose(); delete charts.skillTrend;}
    chart('skillTrend').setOption({...base(),grid:{left:48,right:16,top:16,bottom:30},xAxis:{type:'category',data:META.months.slice(f.m0,f.m1+1),...axisStyle(p),axisLabel:yearTicks(p)},yAxis:{type:'value',...axisStyle(p),axisLabel:{formatter:'{value}%'}},tooltip:{...base().tooltip,trigger:'axis',valueFormatter:v=>v==null?'—':v.toFixed(1)+'%'},series:[{type:'line',symbol:'none',connectNulls:false,data:tr.tot.slice(f.m0,f.m1+1).map((n,i)=>n>=30?100*tr.series[0][f.m0+i]/n:null),lineStyle:{color:p.teal,width:3},areaStyle:{color:p.soft,opacity:.5}}]});
  } catch(e) { if(token===skillRequest) $('#skillBody').textContent=st('Unable to load this skill. Close and try again.','تعذر تحميل المهارة. أغلق النافذة وحاول مجدداً.'); }
}

// Segment controls and theme redraws also replace chart options.
for(const name of ['drawTimeline','drawShift','drawTop','drawMatrix']) {
  const original = {drawTimeline,drawShift,drawTop,drawMatrix}[name];
  const wrapped = async function(...args) { await original(...args); if(META && OV && window.enhanceSkills) window.enhanceSkills(); };
  if(name==='drawTimeline') drawTimeline=wrapped;
  if(name==='drawShift') drawShift=wrapped;
  if(name==='drawTop') drawTop=wrapped;
  if(name==='drawMatrix') drawMatrix=wrapped;
}
