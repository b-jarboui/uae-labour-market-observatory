/* International comparisons inside the existing Observatory, with the same page filters. */
'use strict';
(() => {
 const section=document.createElement('section');section.id='international';section.className='block international';
 document.getElementById('rail').after(section);
 const nav=document.createElement('a');nav.href='#international';nav.textContent='International comparison';document.querySelector('.secnav .wrap').append(nav);
 const worker=new Worker('international-worker.js?v=integrated2021e');let seq=0;const pending=new Map();
 worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.ok?p.resolve(data.r):p.reject(Error(data.error));};
 worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear();};
 const rpc=(op,args)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,op,args});});
 const state={target:'US',uae:'archive',cohort:'available',limit:20,search:'',skill:null,sort:'uaeShare',direction:-1,ranking:'topU'};let meta,result,serial=0,timer;
 const ar=()=>document.documentElement.lang==='ar';const tx=(en,arabic)=>ar()?arabic:en;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const el=id=>section.querySelector('#'+id);
 const num=n=>n===null?'—':n>0&&n<10?'<10':Number(n).toLocaleString(ar()?'ar-AE':'en-US');
 const share=n=>n===null?'—':(100*n).toFixed(1)+'%';
 const gap=n=>n===null?'—':Math.abs(n)<.05?'0.0':(n>0?'+':'')+n.toFixed(1);
 const targetName=()=>state.target==='GLOBAL'?tx('Global (excluding UAE)','العالم (باستثناء الإمارات)'):state.target==='US'?tx('United States','الولايات المتحدة'):tx('United Kingdom','المملكة المتحدة');
 const groupHelp=()=>({job:tx('Technical skills, tools, methods and certifications. Select an occupation above to focus on a particular job.','المهارات التقنية والأدوات والأساليب والشهادات. اختر المهنة أعلاه للتركيز على عمل محدد.'),soft:tx('Communication, attention to detail, teamwork and other interpersonal or behavioural skills.','التواصل والانتباه للتفاصيل والعمل الجماعي وغيرها من المهارات الشخصية والسلوكية.'),language:tx('Language skills, shown separately from soft and job-specific skills.','المهارات اللغوية، معروضة بصورة مستقلة عن المهارات الشخصية والخاصة بالعمل.'),all:tx('Job-specific, soft and language skills together. Choose a group to compare one kind of skill.','المهارات الخاصة بالعمل والشخصية واللغوية معاً. اختر مجموعة لمقارنة نوع واحد من المهارات.')})[S.skillGroup]||'';
 const skillButton=r=>`<button type="button" class="bench-skill" data-skill="${r.id}" aria-pressed="${result?.skill.id===r.id}" aria-controls="int-trend" title="${esc(tx('View annual history for ','عرض التاريخ السنوي لـ ')+r.name)}">${esc(r.name)}</button>`;
 const legend=()=>`<div class="bench-legend"><span><i class="bench-dot" aria-hidden="true"></i>${tx('UAE','الإمارات')}</span><span><i class="bench-dot other" aria-hidden="true"></i>${targetName()}</span></div>`;
 function shell(){
  nav.textContent=tx('International benchmark','المعيار الدولي');
  document.querySelectorAll('[data-global-note]').forEach(n=>n.hidden=n.dataset.globalNote!==(ar()?'ar':'en'));
  section.innerHTML=`<div class="sec-head"><h2>${tx('UAE skills against international benchmarks','المهارات في الإمارات مقارنة بالمعايير الدولية')}</h2><p>2021–2026 · ${tx('United States / United Kingdom / Global','الولايات المتحدة / المملكة المتحدة / العالم')}</p></div>
   <p class="bench-intro">${tx('Which skills appear more often in UAE job ads? Compare skill shares with the US, UK or global benchmark, then select a skill to explore its annual history.','ما المهارات الأكثر شيوعاً في إعلانات الوظائف الإماراتية؟ قارن نسب المهارات بالمعيار الأمريكي أو البريطاني أو العالمي، ثم اختر مهارة لاستكشاف تاريخها السنوي.')}</p>
   <article class="bench-data" id="int-data" aria-live="polite"><p class="bench-note">${tx('Counting the data…','جارٍ عدّ البيانات…')}</p></article>
   <div class="bench-controls"><label>${tx('Compare UAE with','مقارنة الإمارات مع')}<select id="int-target"><option value="US">${tx('United States','الولايات المتحدة')}</option><option value="GB">${tx('United Kingdom','المملكة المتحدة')}</option><option value="GLOBAL">${tx('Global, excluding UAE','العالم، باستثناء الإمارات')}</option></select></label>
   <label>${tx('Skill group','مجموعة المهارات')}<select id="int-group" aria-describedby="int-group-help"><option value="job">${tx('Job-specific skills','مهارات خاصة بالعمل')}</option><option value="soft">${tx('Soft skills','مهارات شخصية')}</option><option value="language">${tx('Language skills','مهارات لغوية')}</option><option value="all">${tx('All skills','جميع المهارات')}</option></select></label>
   <label class="bench-search-label">${tx('Find a skill','البحث عن مهارة')}<input id="int-search" type="search" autocomplete="off" placeholder="${tx('Search this skill group…','ابحث في مجموعة المهارات…')}" value="${esc(state.search)}" aria-controls="int-results"></label>
   <label>${tx('Rows per ranking','صفوف كل ترتيب')}<select id="int-limit"><option value="20">20</option><option value="50">50</option></select></label></div>
   <p id="int-group-help" class="bench-group-help">${esc(groupHelp())} <span>${tx('This group also applies to the UAE views above.','تُطبق هذه المجموعة أيضاً على عروض الإمارات أعلاه.')}</span></p><p id="int-status" class="bench-status" role="status" aria-live="polite" aria-atomic="true"></p><div id="int-results" aria-busy="false"></div>`;
  for(const key of ['target','limit']){el('int-'+key).value=state[key];el('int-'+key).onchange=e=>{state[key]=key==='limit'?+e.target.value:e.target.value;if(key==='uae')state.skill=null;update();};}
  el('int-search').oninput=e=>{state.search=e.target.value;clearTimeout(timer);timer=setTimeout(update,250);};
  el('int-group').value=S.skillGroup;el('int-group').onchange=e=>{S.skillGroup=e.target.value;S.type='';refresh();};
  if(totals)renderData();
 }
 // Full data used, before any filter: the reader sees how much local and international data stands behind every share.
 let totals=null;
 async function loadTotals(){try{totals=await rpc('totals');renderData();}catch(e){el('int-data').innerHTML=`<p class="bench-note">${tx('Could not count the data.','تعذر عدّ البيانات.')}</p>`;console.error(e);}}
 function renderData(){
  const t=totals,n=v=>Number(v).toLocaleString(ar()?'ar-AE':'en-US'),cell=v=>v?n(v):'—';
  const rows=[['AE',tx('United Arab Emirates','الإمارات العربية المتحدة'),tx('UAE archive ads','إعلانات أرشيف الإمارات'),'uae'],
   ['US',tx('United States','الولايات المتحدة'),tx('Company career sites','مواقع توظيف الشركات'),'us'],
   ['GB',tx('United Kingdom','المملكة المتحدة'),tx('Company career sites','مواقع توظيف الشركات'),'gb'],
   ['GLOBAL',tx('Global, excluding UAE','العالم، باستثناء الإمارات')+` (${t.GLOBAL.markets} ${tx('countries','دولة')})`,tx('Company career sites','مواقع توظيف الشركات'),'global']];
  el('int-data').innerHTML=`<div class="bench-data-head"><h3>${tx('Data behind this comparison','البيانات المستخدمة في هذه المقارنة')}</h3>
   <p class="bench-note">${tx('All data used, before any filter. The filters below select a part of it.','جميع البيانات المستخدمة قبل أي تصفية. تختار المرشحات أدناه جزءاً منها.')}</p></div>
   <div class="bench-data-kpis"><div><span>${tx('UAE ads','إعلانات الإمارات')}</span><strong>${n(t.AE.n)}</strong><small>${t.AE.from} – ${t.AE.to}</small></div>
   <div><span>${tx('International ads','الإعلانات الدولية')}</span><strong>${n(t.GLOBAL.n)}</strong><small>${n(t.GLOBAL.companies)} ${tx('companies','شركة')} · ${t.GLOBAL.markets} ${tx('countries','دولة')} · ${t.GLOBAL.from} – ${t.GLOBAL.to}</small></div>
   <div><span>${tx('Total ads used','إجمالي الإعلانات المستخدمة')}</span><strong>${n(t.AE.n+t.GLOBAL.n)}</strong><small>${tx('UAE + international','الإمارات + الدولية')}</small></div></div>
   <div class="bench-table-wrap"><table class="bench-table bench-data-table"><caption>${tx('Ads per market and year (full data)','الإعلانات حسب السوق والسنة (كامل البيانات)')}</caption>
   <thead><tr><th scope="col">${tx('Market','السوق')}</th><th scope="col">${tx('Source','المصدر')}</th><th scope="col">${tx('Total ads','إجمالي الإعلانات')}</th><th scope="col">${tx('Companies','الشركات')}</th>${t.years.map(y=>`<th scope="col">${y}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(([k,name,src,cls])=>`<tr class="bench-row-${cls}"><th scope="row"><i class="bench-dot ${k==='AE'?'':'other'}" aria-hidden="true"></i>${esc(name)}</th><td>${esc(src)}</td><td class="num"><strong>${n(t[k].n)}</strong></td><td class="num">${t[k].companies===null?'—':n(t[k].companies)}</td>${t[k].years.map(v=>`<td class="num">${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <p class="bench-note">${tx(`UAE: deduplicated job ads from the Observatory archives (Internet Archive, Common Crawl, Web Data Commons); company names are not kept. International: English ads posted on companies' own career sites, in Common Crawl snapshots from ${t.GLOBAL.from}; each distinct ad text counts once per country, repeated snapshots removed. Global includes the US and UK. The same companies' sites also give ${n(t.AEpanel.n)} UAE ads (${n(t.AEpanel.companies)} companies), not used above. All markets start in 2021, when the international data begin. An international ad text seen in several years counts in each year, so its years add up to more than its total. — = no data that year.`,`الإمارات: إعلانات وظائف بعد إزالة التكرار من أرشيفات المرصد (أرشيف الإنترنت، Common Crawl، Web Data Commons)؛ لا تُحفظ أسماء الشركات. الدولية: إعلانات بالإنجليزية منشورة على مواقع التوظيف الخاصة بالشركات في لقطات Common Crawl منذ ${t.GLOBAL.from}؛ يُحتسب كل نص إعلان مميز مرة واحدة لكل دولة بعد حذف اللقطات المكررة. يشمل العالم الولايات المتحدة والمملكة المتحدة. توفر مواقع الشركات نفسها أيضاً ${n(t.AEpanel.n)} إعلاناً إماراتياً (${n(t.AEpanel.companies)} شركة) غير مستخدمة أعلاه. تبدأ جميع الأسواق في 2021، عند بداية البيانات الدولية.يُحتسب النص الذي يظهر في عدة سنوات في كل سنة، لذا يتجاوز مجموع السنوات الإجمالي. — = لا توجد بيانات في تلك السنة.`)}</p>`;
 }
 function currentFilter(){return typeof META!=='undefined'&&META?F():{m0:72,m1:140,types:null,where:'any',req:'any'};}
 async function update(){
  const revision=++serial,f=currentFilter();
  el('int-group').value=S.skillGroup;
  el('int-group-help').textContent=groupHelp()+' '+tx('This group also applies to the UAE views above.','تُطبق هذه المجموعة أيضاً على عروض الإمارات أعلاه.');
  el('int-results').inert=true;el('int-results').setAttribute('aria-busy','true');
  if(f.ind?.length||f.emi?.length){el('int-status').textContent=tx('Clear the industry and emirate filters to see the international benchmark.','أزل مرشحي الصناعة والإمارة لعرض المعيار الدولي.');el('int-results').innerHTML='';el('int-results').inert=false;el('int-results').setAttribute('aria-busy','false');return false;}
  el('int-status').textContent=tx('Updating skill shares…','جارٍ تحديث نسب المهارات…');
  try{
   if(!meta){meta=await rpc('load');window.INTERNATIONAL.meta=meta;}
   const value=await rpc('query',{F:f,...state});if(revision!==serial)return;result=value;window.INTERNATIONAL.result=result;
   el('int-status').textContent=tx('Period: ','الفترة: ')+meta.months[f.m0]+' – '+meta.months[f.m1]+' · '+(typeof skillGroupLabel==='function'?skillGroupLabel():'')+' · '+Number(result.totalSkills).toLocaleString(ar()?'ar-AE':'en-US')+' '+tx(state.search?'matching skills':'reportable skills',state.search?'مهارة مطابقة':'مهارة قابلة للعرض');render();return true;
  }catch(e){if(revision===serial){el('int-status').textContent=tx('Could not load the comparison. Please try again.','تعذر تحميل المقارنة. يرجى المحاولة مجدداً.');el('int-results').innerHTML=`<button type="button" class="bench-btn" id="int-retry">${tx('Try again','حاول مجدداً')}</button>`;el('int-retry').onclick=update;}console.error(e);return false;}
  finally{if(revision===serial){el('int-results').inert=false;el('int-results').setAttribute('aria-busy','false');}}
 }
 function sampleCard(s,other){
  const small=s.n<100||(s.companies!==null&&s.companies<10);
  return `<article class="bench-sample ${other?'benchmark':''}"><span class="bench-eyebrow">${other?tx('Reference benchmark','المعيار المرجعي'):tx('Focus market','السوق الرئيسي')}</span><h3>${other?targetName():tx('United Arab Emirates','الإمارات العربية المتحدة')}</h3><div class="bench-meta">${tx('Sample: ','العينة: ')}<strong>${num(s.n)}</strong> ${tx('ads in the selected period','إعلاناً في الفترة المختارة')}${s.companies===null?'':' · '+num(s.companies)+' '+tx('companies','شركة')}${small?' · <strong>'+tx('Small sample','عينة صغيرة')+'</strong>':''}</div>${s.base?`<div class="bench-meta">${tx('Occupation classified: ','المهنة مصنفة: ')}${(100*(1-s.baseUnknown/s.base)).toFixed(1)}% ${tx('of the period sample','من عينة الفترة')}</div>`:''}</article>`;
 }
 function renderRanking(){
  const rows=result[state.ranking]||result.topU;
  const max=Math.max(.1,...rows.flatMap(r=>[r.uaeShare||0,r.benchmarkShare||0]));
  const scale=Math.min(1,Math.ceil((max-1e-10)*10)/10);
  el('int-ranking').innerHTML=`<div class="bench-ranking-key">${legend()}<span>${tx('Share of ads','نسبة الإعلانات')} · 0–${Math.round(scale*100)}%</span></div>${rows.map((r,i)=>`<div class="bench-pair-row ${result.skill.id===r.id?'is-selected':''}"><div class="bench-rank-label"><span class="bench-rank-number" aria-hidden="true">${i+1}</span>${skillButton(r)}</div><div class="bench-pair-bars">${[[r.uaeShare,false],[r.benchmarkShare,true]].map(([p,other])=>`<div class="bench-series ${other?'benchmark':''}"><div class="bench-track" aria-hidden="true"><div class="bench-fill" style="width:${p===null?0:100*p/scale}%"></div></div><span><span class="bench-sr">${esc(other?targetName():tx('UAE','الإمارات'))}: </span>${share(p)}</span></div>`).join('')}</div><div class="bench-pair-gap ${r.gap>0?'bench-gap-pos':r.gap<0?'bench-gap-neg':''}"><span class="bench-sr">${tx('UAE gap: ','فرق الإمارات: ')}</span>${gap(r.gap)} <small>${tx('pp','نقطة')}</small></div></div>`).join('')||`<div class="bench-empty">${tx('No reportable skills in this ranking. Try another ranking or broaden your selection.','لا توجد مهارات قابلة للعرض في هذا الترتيب. جرّب ترتيباً آخر أو وسّع الاختيار.')}</div>`}<p class="bench-note">${tx('Both bars use the same scale. Positive gap = higher UAE share; negative gap = lower UAE share. pp = percentage points.','يستخدم الشريطان المقياس نفسه. الفرق الموجب يعني نسبة أعلى في الإمارات؛ والسالب يعني نسبة أقل. الفرق بالنقاط المئوية.')}</p>`;
 }
 function render(){
  const r=result;
  el('int-results').innerHTML=`<div class="bench-samples">${sampleCard(r.uae,false)}${sampleCard(r.benchmark,true)}</div>
   <article class="bench-list"><div class="bench-ranking-head"><div><h3>${tx('Skill shares, side by side','نسب المهارات جنباً إلى جنب')}</h3><p class="bench-note">${tx('Share = ads mentioning the skill ÷ all ads in the selected market. Skill group does not change the sample.','النسبة = الإعلانات التي تذكر المهارة ÷ جميع إعلانات السوق المختار. مجموعة المهارات لا تغيّر العينة.')}</p></div><label>${tx('Rank by','الترتيب حسب')}<select id="int-ranking-mode"><option value="topU">${tx('Most common in UAE','الأكثر شيوعاً في الإمارات')}</option><option value="topV">${tx('Most common in benchmark','الأكثر شيوعاً في المعيار')}</option><option value="more">${tx('Higher UAE share (pp)','أكبر فرق موجب للإمارات')}</option><option value="less">${tx('Lower UAE share (pp)','أكبر فرق سالب للإمارات')}</option></select></label></div><div id="int-ranking"></div></article>
   <div class="bench-toolbar"><h3>${tx('Skills and UAE gaps','المهارات والفروق الإماراتية')}</h3><span class="bench-note">${tx('Click headers to sort · gap in percentage points','انقر العناوين للترتيب · الفرق بالنقاط المئوية')}</span><button class="bench-btn" id="int-export">${tx('Export visible rows CSV','تصدير الصفوف المعروضة CSV')}</button></div><div class="bench-table-wrap" id="int-table"></div>
   <div class="bench-trend" id="int-trend"></div>`;
  renderRanking();renderTable();renderTrend();bindSkills();el('int-export').onclick=exportCsv;
  el('int-ranking-mode').value=state.ranking;el('int-ranking-mode').onchange=e=>{state.ranking=e.target.value;renderRanking();bindSkills();};
  el('int-results').dataset.target=state.target;el('int-results').dataset.uae=state.uae;el('int-results').dataset.cohort=state.cohort;
  el('int-results').dataset.search=state.search;
 }
 function sortedRows(){return [...result.rows].sort((a,b)=>{const x=a[state.sort],y=b[state.sort];if(x===null)return y===null?0:1;if(y===null)return -1;return state.direction*(typeof x==='string'?x.localeCompare(y):x-y);});}
 function renderTable(){
  const heads=[['name',tx('Skill','المهارة')],['uaeShare',tx('UAE share','نسبة الإمارات')],['benchmarkShare',targetName()+' %'],['gap',tx('UAE gap (pp)','فرق الإمارات (نقطة)')]];
  el('int-table').innerHTML=`<table class="bench-table"><caption>${result.rows.length} ${tx('skills shown across the rankings','مهارة معروضة عبر الترتيبات')} · ${tx('Select a skill for its annual history','اختر مهارة لعرض تاريخها السنوي')}</caption><thead><tr>${heads.map(([key,label])=>`<th scope="col" aria-sort="${state.sort===key?(state.direction===1?'ascending':'descending'):'none'}"><button type="button" class="bench-sort" data-sort="${key}">${esc(label)} <span aria-hidden="true">${state.sort===key?(state.direction===1?'↑':'↓'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>${sortedRows().map(r=>`<tr class="${result.skill.id===r.id?'is-selected':''}"><th scope="row">${skillButton(r)}</th><td class="num">${share(r.uaeShare)}</td><td class="num">${share(r.benchmarkShare)}</td><td class="num ${r.gap>0?'bench-gap-pos':r.gap<0?'bench-gap-neg':''}">${gap(r.gap)}</td></tr>`).join('')}</tbody></table><p class="bench-note bench-table-note">${result.rows.length?tx('— = unavailable or suppressed (1–9 mentions). Rankings contribute their top rows; search to find a specific skill.','— = غير متاح أو محجوب (1–9 إشارات). يعرض الجدول أبرز صفوف كل ترتيب؛ استخدم البحث للعثور على مهارة محددة.'):tx('No matching skills. Clear the search or broaden your filters.','لا توجد مهارات مطابقة. أزل البحث أو وسع المرشحات.')}${state.search?` <button type="button" class="bench-clear" id="int-clear-search">${tx('Clear search','مسح البحث')}</button>`:''}</p>`;
  el('int-table').querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.sort;state.direction=state.sort===key?-state.direction:key==='name'?1:-1;state.sort=key;renderTable();bindSkills();el('int-table').querySelector(`[data-sort="${key}"]`).focus({preventScroll:true});});
  if(el('int-clear-search'))el('int-clear-search').onclick=()=>{state.search='';el('int-search').value='';el('int-search').focus({preventScroll:true});clearTimeout(timer);update();};
 }
 function bindSkills(){section.querySelectorAll('[data-skill]').forEach(b=>b.onclick=async()=>{state.skill=+b.dataset.skill;if(await update()){const heading=el('int-trend-title');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}});}
 function renderTrend(){
  const u=result.uae.years,v=result.benchmark.years,max=Math.max(.05,...u.concat(v).map(y=>y.share||0));
  const segments=ys=>{const out=[];let points=[];ys.forEach((y,i)=>{if(y.share===null){if(points.length)out.push(points);points=[];}else points.push(`${45+i*90},${160-y.share/max*125}`);});if(points.length)out.push(points);return out;};
  el('int-trend').innerHTML=`<h3 id="int-trend-title" tabindex="-1">${tx('Annual history: ','التاريخ السنوي: ')}${esc(result.skill.name)}</h3><div class="bench-legend"><span><i class="bench-dot"></i>${tx('UAE','الإمارات')}</span><span><i class="bench-dot other"></i>${targetName()}</span></div><svg viewBox="0 0 550 200" role="img" aria-label="${esc(tx('Annual skill shares; detailed values in the following table','نسب المهارات السنوية؛ القيم التفصيلية في الجدول التالي'))}"><text x="5" y="25" fill="currentColor" font-size="11">${(max*100).toFixed(0)}%</text><path d="M40 30V165H510" fill="none" stroke="currentColor" opacity=".25"/>${[u,v].map((ys,j)=>segments(ys).map(points=>`<polyline points="${points.join(' ')}" fill="none" stroke="${j?'var(--bench-other)':'var(--teal)'}" stroke-width="2.5" stroke-dasharray="${j?'6 4':'none'}"/>`).join('')+ys.map((y,i)=>y.share===null?'':`<circle cx="${45+i*90}" cy="${160-y.share/max*125}" r="3" fill="${j?'var(--bench-other)':'var(--teal)'}"/>`).join('')).join('')}${u.map((y,i)=>`<text x="${45+i*90}" y="188" text-anchor="middle" fill="currentColor" font-size="11">${y.year}</text>`).join('')}</svg><div class="bench-table-wrap"><table><thead><tr><th>${tx('Year','السنة')}</th><th>${tx('UAE share / sample','نسبة الإمارات / العينة')}</th><th>${tx('Benchmark share / sample','نسبة المقارنة / العينة')}</th></tr></thead><tbody>${u.map((y,i)=>`<tr><td>${y.year}</td><td>${share(y.share)} / ${num(y.n)}</td><td>${share(v[i].share)} / ${num(v[i].n)}</td></tr>`).join('')}</tbody></table></div><p class="bench-note">${tx('Each year includes only the selected months, using the sample for that year. Missing or suppressed values break the line. Annual values may cover a partial year.','تشمل كل سنة الأشهر المختارة فقط، باستخدام عينة السنة. تقطع القيم المفقودة أو المحجوبة الخط. قد تغطي القيم السنوية جزءاً من السنة.')}</p>`;
 }
 function exportCsv(){
  const f=currentFilter(),header=['skill','skill_type','uae_source','benchmark','benchmark_unit','international_cohort','from','to','uae_ads','uae_companies','benchmark_ads','benchmark_companies','uae_mentions','benchmark_mentions','uae_share','benchmark_share','uae_gap_pp'];
  const rows=sortedRows().map(r=>[r.name,meta.types[r.type],state.uae,state.target,'distinct_texts_per_market',state.cohort,meta.months[f.m0],meta.months[f.m1],result.uae.n,result.uae.companies,result.benchmark.n,result.benchmark.companies,r.uae,r.benchmark,r.uaeShare,r.benchmarkShare,r.gap]);
  const q=v=>'"'+String(v??'').replace(/^[=+@\t\r]/,"'").replace(/"/g,'""')+'"';
  const url=URL.createObjectURL(new Blob(['\ufeff'+[header,...rows].map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`uae-vs-${state.target}-${meta.months[f.m0]}_${meta.months[f.m1]}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 window.INTERNATIONAL={state,update,result:null,meta:null,rpc};
 window.refreshInternational=()=>{if(el('int-status'))update();};
 shell();loadTotals();
 new MutationObserver(()=>{shell();update();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 // The archive app calls refreshInternational once its shared filters are ready.
 if(typeof META!=='undefined'&&META)update();
})();


