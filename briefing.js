/* Round 2: an occupation-led briefing, using the existing worker results. */
'use strict';
const briefing = document.createElement('div');
briefing.className = 'demand-atlas';
$('.hero h1').before(briefing);
const journey = document.createElement('div');
journey.className = 'journey';
$('#rail').before(journey);

function restoreBriefing() {
  const q = new URLSearchParams(location.search);
  for (const key of ['m0','m1']) {
    const v = Number(q.get(key));
    if(q.has(key) && Number.isInteger(v) && v >= FIRST && v <= LAST) S[key] = v;
  }
  if(S.m0 > S.m1) S.m1 = S.m0;
  for(const [key, count] of [['isco',META.isco.length],['emi',META.emirates.length],['ind',(META.industries||[]).length],['type',T().types.length]]) {
    const v=q.get(key); if(v !== null && v !== '' && /^\d+$/.test(v) && +v<count) S[key]=v;
  }
  const major=q.get('major'); if(major && Object.hasOwn(META.isco_major,major)) S.major=major;
  if(S.isco !== '' && S.major && META.isco[+S.isco][0][0]!==S.major) S.major='';
  for(const [key, values] of [['where',['any','requirements','duties']],['shiftWin',['trend','gpt','covid']],['smooth',['12','6','1']],['tlMode',['skills','volume']],['stated',['all','stated']]]) {
    if(values.includes(q.get(key))) S[key]=q.get(key);
  }
  if(['policy','uni','emp'].includes(q.get('aud'))) aud=q.get('aud');
  if(['en','ar'].includes(q.get('lang'))) lang=q.get('lang');
  for(const [id,key] of [['tlMode','tlMode'],['shiftMode','shiftWin'],['statedMode','stated'],['smoothMode','smooth']]) $$(`#${id} button`).forEach(b=>b.classList.toggle('on',b.dataset.v===S[key]));
  $$('.presets .chip').forEach(b=>b.classList.toggle('on',b.dataset.aud===aud));
}
const originalBindControls = bindControls;
bindControls = function() { restoreBriefing(); originalBindControls(); };

function briefingURL() {
  const url=new URL(location.href); url.search=''; url.hash='';
  for(const [key,value] of Object.entries({...S,aud,lang})) if(value!=='') url.searchParams.set(key,value);
  return url.href;
}

function renderJourney() {
  journey.innerHTML=`<div class="journey-intro"><span class="eyebrow">${st('MAKE IT YOUR BRIEFING','ملفك حسب اهتمامك')}</span><h2>${st('One labour market. Many stories.','سوق عمل واحد. قصص متعددة.')}</h2><p>${st('Choose an occupation. Every view below follows your selection.','اختر مجموعة مهنية لتتحدث جميع الرسوم عن اختيارك.')}</p></div><div class="journey-controls"><label for="storyOccupation">${st('Explore an occupation','استكشف مجموعة مهنية')}</label><select id="storyOccupation"></select><div class="journey-actions"><a href="#turning">${st('Read the evidence ↓','اقرأ البيانات ↓')}</a><button class="btn" id="shareBriefing">${st('Copy briefing link','نسخ رابط الملف')}</button></div><span id="shareStatus" role="status"></span></div>`;
  const sel=$('#storyOccupation');
  sel.add(new Option(T().allGroups,''));
  META.isco.forEach((g,i)=>sel.add(new Option(`${g[0]} · ${g[lang==='ar'?2:1]}`,i)));
  sel.value=S.isco;
  sel.onchange=()=>{S.isco=sel.value; S.major=''; fillSelects(); refresh();};
  $('#shareBriefing').onclick=async()=>{
    const url=briefingURL();
    try { await navigator.clipboard.writeText(url); $('#shareStatus').textContent=st('Link copied. Includes your filters and language.','نُسخ الرابط مع المرشحات واللغة.'); }
    catch { $('#shareStatus').innerHTML=`<label for="shareURL">${st('Copy this link','انسخ هذا الرابط')}</label><input id="shareURL" readonly value="${safe(url)}">`; $('#shareURL').select(); }
  };
}

function renderBriefing() {
  if(!SH || !OV) return;
  // only real increases, and only when both windows are large enough to headline
  const enough = SH.na >= 300 && SH.nb >= 300;
  const [a,b]=windows(), rows=enough ? SH.up.filter(r=>r.d>0).slice(0,3) : [], lead=rows[0];
  const ar = lang==='ar';
  const parts = [];
  if (S.isco!=='') parts.push(META.isco[+S.isco][ar?2:1]); else if (S.major) parts.push(META.isco_major[S.major][ar?1:0]);
  if (S.emi!=='') parts.push(META.emirates[+S.emi][ar?2:1]);
  if (S.type!=='') parts.push(T().types[+S.type]);
  const selected = parts.length ? parts.join(' · ') : st('Across the UAE','في الإمارات');
  const winName = S.shiftWin==='gpt' ? 'ChatGPT' : S.shiftWin==='covid' ? st('COVID-19','كوفيد-19') : st('Long-run trend','الاتجاه طويل المدى');
  const title=$('.hero h1');
  title.textContent=st('The changing language of work.','كيف تتغيّر لغة العمل؟');
  $('#lede').textContent=st('What employers ask for is changing. Explore the skills gaining ground, the jobs that need them, and the evidence behind the shift.','تتغيّر متطلبات أصحاب العمل. استكشف المهارات المتزايدة والمهن التي تطلبها والبيانات التي تفسّر هذا التحول.');
  briefing.innerHTML=`<div class="atlas-top"><span>${st('DEMAND / THEN → NOW','الطلب / سابقاً ← الآن')}</span><span>${winName}</span></div><p class="atlas-scope">${safe(selected)}</p><h2>${lead ? `${lead.d>=0?'+':''}${(lead.d*100).toFixed(1)}<small>${st('percentage points','نقطة مئوية')}</small>` : st('No comparison available','لا تتوفر مقارنة')}</h2><p class="atlas-lead">${lead ? `${window.skillLink(lead.name)} · ${st('largest increase in this comparison','أكبر زيادة في هذه المقارنة')}` : (enough ? st('No skill gained ground in this selection.','لم تتقدم أي مهارة في هذا الاختيار.') : st('Too few advertisements in this selection for a reliable comparison. Try a broader selection.','عدد الإعلانات في هذا الاختيار قليل لمقارنة موثوقة. جرّب توسيع الاختيار.'))}</p><div class="atlas-legend"><span>○ ${st('Before','قبل')}</span><span>● ${st('After','بعد')}</span><span>${st('Share of ads','نسبة الإعلانات')}</span></div><div class="atlas-rows">${rows.map(r=>{
    const x1=12+276*r.a, x2=12+276*r.b;
    return `<div class="atlas-row">${window.skillLink(r.name)}<span class="atlas-values" dir="ltr">${pct(r.a)} → <b>${pct(r.b)}</b></span><svg viewBox="0 0 300 26" role="img" aria-label="${safe(r.name+': '+pct(r.a)+' → '+pct(r.b))}"><path d="M12 13H288" class="atlas-track"/><path d="M${x1} 13H${x2}" class="atlas-growth"/><circle cx="${x1}" cy="13" r="5" class="atlas-before"/><circle cx="${x2}" cy="13" r="6" class="atlas-after"/></svg></div>`;
  }).join('')}</div><div class="atlas-axis" dir="ltr"><span>0%</span><span>50%</span><span>100%</span></div><p class="atlas-dates">${safe(winLabel(a))} → ${safe(winLabel(b))}</p><p class="atlas-note">${lang==='ar'?'العينة':'n'} = ${fmt(SH.na)} / ${fmt(SH.nb)} · ${st('Fixed windows; period filter does not apply. Association, not causation.','فترات ثابتة لا تخضع لمرشح الفترة. ارتباط وليس سببية.')}${SH.na<500||SH.nb<500?' '+T().small:''}</p>`;
  renderJourney();
}
const originalEnhanceSkills=window.enhanceSkills;
window.enhanceSkills=function() { originalEnhanceSkills(); renderBriefing(); };
