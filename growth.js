/* Round 2: fixed-window growth briefing; all values supplied by the worker. */
'use strict';
let GR = null;
const growthSection=document.createElement('section');
growthSection.id='growth'; growthSection.className='block growth-section';
$('#turning').after(growthSection);
const growthNav=document.createElement('a');growthNav.href='#growth';
$('.secnav a[href="#turning"]').after(growthNav);
function technicalFilter() { return F(); }
async function loadGrowth() {
  const a=[Math.max(FIRST,mi(2021,1)),mi(2022,12)], b=[LAST-11,LAST];
  GR=await call('growth',{F:F(),a,b});
  if(GR.technical[0]) {
    const recent=await call('overview',{F:{...F(),m0:b[0],m1:b[1],skill:GR.technical[0].id}});
    const top=values=>values.map((n,id)=>({n,id})).sort((a,b)=>b.n-a.n)[0];
    GR.location=top(recent.byEmi.slice(0,META.emirates.length));
    GR.occupation=top(recent.byIsco.slice(0,META.isco.length));
  }
}
const growthValue=r=>r.g===null?st('New since 2021','جديد منذ 2021'):`${r.g>0?'+':''}${(r.g*100).toFixed(0)}%`;
const growthLabel=(r,key)=>key==='isco'||key==='ind'
  ? `${(key==='isco'?META.isco:META.industries)[r.id][0]} · ${(key==='isco'?META.isco:META.industries)[r.id][lang==='ar'?2:1]}` : window.skillLabel(r.name);
// foundational panel: the two largest gains and the two largest declines (worker list is ranked by relative growth)
function foundationRows() {
  const all=GR.foundation, down=all.filter(r=>r.g!==null&&r.d<0).slice(-2);
  return [...all.filter(r=>!down.includes(r)).slice(0,4-down.length),...down];
}
function renderGrowth() {
  if(!GR) return;
  growthNav.textContent=st('Growth','النمو');
  const scope=S.type===''?skillGroupLabel():T().types[+S.type];
  $('[data-i18n="topTitle"]').textContent=st('Most requested: ','الأكثر طلباً: ')+scope;
  $('[data-i18n="shiftTitle"]').textContent=st('Change in share: ','التغير في النسبة: ')+scope;
  const empty=st('No qualifying results. Each period needs 300 ads; each result needs 50 recent mentions. Broaden the filters.','لا توجد نتائج مستوفية للشروط. يلزم 300 إعلان في كل فترة و50 إشارة حديثة لكل نتيجة. وسّع المرشحات.');
  const panel=(key,title,description,limit=6,list=GR[key])=>{
    // baselines of 1–9 mentions are shown as "<10" with no share (and no baseline tick)
    const rows=list.slice(0,limit), max=Math.max(.01,...rows.flatMap(r=>[tiny(r.ca)?0:r.a,r.b]));
    const html=`<article class="panel growth-panel ${key==='foundation'?'foundation':''}"><div class="panel-head"><h3>${title}</h3><p>${description}</p></div><div class="growth-list">${rows.length?rows.map((r,i)=>`<div class="growth-row"><span class="growth-rank">${i+1}</span><div class="growth-name">${key==='isco'||key==='ind'?`<button class="growth-filter" data-growth-key="${key}" data-growth-id="${r.id}">${safe(growthLabel(r,key))} ↗</button>`:window.skillLink(r.name)}<div class="growth-track" aria-hidden="true"><span style="width:${100*r.b/max}%"></span>${tiny(r.ca)?'':`<i style="left:${Math.min(100,100*r.a/max)}%"></i>`}</div><small>${fromTo(pctC(r.a,r.ca,2),pctC(r.b,r.cb,2))} · ${fmtC(r.cb)} ${st('recent ads','إعلاناً حديثاً')}</small></div><strong class="growth-value" dir="auto">${growthValue(r)}</strong></div>`).join(''):`<p class="growth-empty">${empty}</p>`}</div><div class="foot"><span>${st('Share of ads · tick = 2021–22','نسبة الإعلانات · العلامة = 2021–2022')}</span><span class="acts"><button data-table="growth-${key}">${T().showTable}</button><button data-csv="growth-${key}">${T().csv}</button></span></div><div class="tablewrap" id="tbl-growth-${key}" hidden></div></article>`;
    return {html,rows,key};
  };
  const parts=[
    panel('technical',st('Technical & emerging skills','المهارات التقنية والناشئة'),st('Fastest growth in share: technical skills, tools, certifications and methods.','الأسرع نمواً في النسبة: المهارات التقنية والأدوات والشهادات والأساليب.'),8),
    panel('emerging',st('New since 2021','جديد منذ 2021'),st('Near-absent in 2021–22; now in at least 50 ads. Ranked by recent share.','شبه غائبة في 2021–2022؛ تظهر الآن في 50 إعلاناً على الأقل. مرتبة حسب النسبة الحديثة.')),
    panel('isco',st('Fastest-growing occupations','المهن الأسرع نمواً'),st('ISCO-08 groups · click to explore a profession.','مجموعات ISCO-08 · انقر لاستكشاف المهنة.')),
    panel('ind',st('Fastest-growing industries','القطاعات الأسرع نمواً'),st('ISIC Rev.4 sections · click to explore a sector.','أقسام ISIC Rev.4 · انقر لاستكشاف القطاع.')),
    panel('foundation',st('Soft skills & languages','المهارات الشخصية واللغات'),st('Soft skills and languages, shown separately. Ranked by relative growth; declines remain visible.','المهارات الشخصية واللغات في عرض منفصل. مرتبة حسب النمو النسبي مع إظهار التراجع.'),4,foundationRows())
  ];
  growthSection.innerHTML=`<div class="sec-head"><h2>${st('Where demand is gaining ground','أين يتزايد الطلب')}</h2><p>${st('Read the direction of change, then explore the jobs behind it.','تعرّف على اتجاه التغير ثم استكشف المهن المرتبطة به.')}</p></div><p class="growth-method">${safe(winLabel(GR.a))} ${arrow()} ${safe(winLabel(GR.b))} · ${st('Sample','العينة')}: <bdi>${fmt(GR.na)} / ${fmt(GR.nb)}</bdi><br>${st('Growth = change in share ÷ starting share. +100% means the share doubled. Fixed periods; the date selector does not apply. At least 300 ads per period and 50 recent mentions. “New” means fewer than 10 baseline mentions or less than 0.01% baseline share; it does not mean the skill was invented recently. Archive coverage changes can affect rankings; these are signals for training and hiring, not a forecast of vacancies.','النمو = تغير النسبة ÷ النسبة الأولى. تعني +100% تضاعف النسبة. فترات ثابتة لا تتأثر بمحدد التاريخ. يلزم 300 إعلان في كل فترة و50 إشارة حديثة. «جديد» يعني أقل من 10 إشارات أو نسبة دون 0.01% في البداية، وليس ابتكار المهارة حديثاً. قد تؤثر تغطية الأرشيف في الترتيب؛ هذه إشارات للتدريب والتوظيف وليست توقعاً للشواغر.')}</p><div class="growth-grid">${parts.filter(p=>!(S.skillGroup==='soft'||S.skillGroup==='language')||!['technical','emerging'].includes(p.key)).map(p=>p.html).join('')}</div>`;
  for(const {rows,key} of parts) table('growth-'+key,[st('Skill / classification','المهارة / التصنيف'),winLabel(GR.a),winLabel(GR.b),st('Relative growth','النمو النسبي'),st('Earlier mentions','الإشارات السابقة'),st('Recent mentions','الإشارات الحديثة'),st('Earlier sample','العينة السابقة'),st('Recent sample','العينة الحديثة')],rows.map(r=>[r.name||growthLabel(r,key),pctC(r.a,r.ca,2),pctC(r.b,r.cb,2),growthValue(r),tiny(r.ca)?'<10':r.ca,tiny(r.cb)?'<10':r.cb,GR.na,GR.nb]));
  growthSection.querySelectorAll('[data-table]').forEach(b=>b.onclick=()=>{const el=$('#tbl-'+b.dataset.table);el.hidden=!el.hidden;b.textContent=el.hidden?T().showTable:T().hideTable;});
  growthSection.querySelectorAll('[data-csv]').forEach(b=>b.onclick=()=>downloadCsv(b.dataset.csv));
  growthSection.querySelectorAll('[data-growth-key]').forEach(b=>b.onclick=()=>setFilter(b.dataset.growthKey,b.dataset.growthId));
}

// Retain the established share-link and journey controls; replace only the briefing.
renderBriefing=function() {
  if(!GR||!OV) return;
  const rows=(S.skillGroup==='soft'||S.skillGroup==='language'?GR.foundation:GR.technical).slice(0,3), lead=rows[0];
  $('.hero h1').textContent=st('The skills shaping what comes next.','المهارات التي تشكّل مستقبل العمل.');
  $('#lede').textContent=st('See which technical skills are growing fastest, where demand is shifting, and what it means for hiring and training.','اكتشف المهارات التقنية الأسرع نمواً، وأين يتحول الطلب، وما يعنيه ذلك للتوظيف والتدريب.');
  const scope=[];
  if(S.isco!=='') scope.push(growthLabel({id:+S.isco},'isco')); else if(S.major) scope.push(META.isco_major[S.major][lang==='ar'?1:0]);
  if(S.ind!=='') scope.push(growthLabel({id:+S.ind},'ind'));
  if(S.emi!=='') scope.push(META.emirates[+S.emi][lang==='ar'?2:1]);
  if(S.type!=='') scope.push(T().types[+S.type]);
  if(S.where!=='any') scope.push(S.where==='requirements'?T().whereReq:T().whereDuty);
  briefing.innerHTML=`<div class="atlas-top"><span>${(S.skillGroup==='soft'?st('FASTEST-GROWING SOFT SKILL','المهارة الشخصية الأسرع نمواً'):S.skillGroup==='language'?st('FASTEST-GROWING LANGUAGE SKILL','المهارة اللغوية الأسرع نمواً'):st('FASTEST-GROWING JOB-SPECIFIC SKILL','المهارة الخاصة بالعمل الأسرع نمواً'))}</span><span>2021–22 ${arrow()} ${st('latest year','آخر سنة')}</span></div><p class="atlas-scope">${safe(scope.join(' · ')||st('Across the UAE','في الإمارات'))}</p><h2>${lead?`<bdi>${ppTxt((lead.b-lead.a)*100,2)}</bdi>`:'—'}<small>${st('percentage points','نقطة مئوية')}</small></h2>${lead?`<p class="atlas-scope">${fromTo(pctC(lead.a,lead.ca,2),`<b>${pctC(lead.b,lead.cb,2)}</b>`)} ${st('of advertisements','من الإعلانات')} · <bdi>${growthValue(lead)}</bdi> ${st('relative','نسبياً')}</p>`:''}<p class="atlas-lead">${lead?window.skillLink(lead.name):st('No selected skill meets the growth thresholds. Try a broader selection.','لا توجد مهارة تقنية تستوفي شروط النمو. جرّب توسيع الاختيار.')}</p><div class="atlas-rows">${rows.map(r=>`<div class="atlas-row">${window.skillLink(r.name)}<span class="atlas-values">${fromTo(pctC(r.a,r.ca,2),`<b>${pctC(r.b,r.cb,2)}</b>`)}</span></div>`).join('')}</div><p class="atlas-note">${st('Share of advertisements, not the number of vacancies. Use the rankings to identify skills worth investigating for training and hiring.','نسبة الإعلانات وليست عدد الشواغر. استخدم الترتيب لتحديد مهارات تستحق الدراسة للتدريب والتوظيف.')}</p><p class="atlas-dates">${safe(winLabel(GR.a))} ${arrow()} ${safe(winLabel(GR.b))}</p><p class="atlas-note">${st('Sample','العينة')}: <bdi>${fmt(GR.na)} / ${fmt(GR.nb)}</bdi> · ${st('Fixed periods · 50+ recent mentions · 300+ ads per period','فترات ثابتة · 50 إشارة حديثة فأكثر · 300 إعلان فأكثر لكل فترة')}</p><a class="atlas-more" href="#growth">${st('Explore the growth rankings ↓','استكشف ترتيب النمو ↓')}</a>`;
  $('#finding').hidden=!lead;
  if(lead && GR.location?.n) {
    const context=document.createElement('p');context.className='atlas-note';
    context.textContent=st('Most recent mentions: ','أكثر الإشارات الحديثة: ')+META.emirates[GR.location.id][lang==='ar'?2:1]+(GR.occupation?.n?' · '+growthLabel(GR.occupation,'isco'):'')+st('. Ranked by mentions, not local growth.','. الترتيب حسب عدد الإشارات وليس النمو المحلي.');
    briefing.querySelector('.atlas-more').before(context);
  }
  if(lead) {
    const counts=document.createElement('p');counts.className='atlas-note';
    counts.textContent=st('Mentions: ','الإشارات: ')+fmtC(lead.ca)+st(' of ',' من ')+fmt(GR.na)+st(' ads ',' إعلاناً ')+arrow()+' '+fmtC(lead.cb)+st(' of ',' من ')+fmt(GR.nb)+st(' ads.',' إعلاناً.')+(GR.nb<1000?st(' Small recent sample: read with care.',' عينة حديثة صغيرة: تُقرأ بحذر.'):'');
    briefing.querySelector('.atlas-lead').after(counts);
  }
  if(lead) {
    $('#findingText').innerHTML=`${window.skillLink(lead.name)} · <bdi>${growthValue(lead)}</bdi> — ${st('fastest relative growth among qualifying selected skills.','أسرع نمو نسبي بين المهارات التقنية المستوفية للشروط.')}`;
    $('#findingNote').textContent=st('Growth in advertisement share since 2021–22. See the thresholds and before/after shares below.','نمو نسبة الإعلانات منذ 2021–2022. راجع الشروط والنسب قبل وبعد أدناه.');
  }
  renderJourney(); renderGrowth();
};
