import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function engine(file){
 const replies=[];const context={console,URL,Uint8Array,Uint16Array,Uint32Array,DataView,ArrayBuffer,Map,Set,Math,Number,String,Array,Object,Promise};
 context.self=context;context.location={search:''};context.postMessage=r=>replies.push(r);
 context.fetch=async url=>{try{const bytes=await fs.readFile(path.join(root,url.split('?')[0]));return {ok:true,json:async()=>JSON.parse(bytes.toString('utf8')),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}catch{return {ok:false,status:404};}};
 vm.createContext(context);vm.runInContext(await fs.readFile(path.join(root,file),'utf8'),context);
 return {context,async rpc(op,args={}){const id=replies.length;await context.onmessage({data:{id,op,args}});const reply=replies.pop();assert(reply?.ok,reply?.error||reply?.err);return reply.r;}};
}
const panel=await engine('international-worker.js');const meta=await panel.rpc('load');const original=await engine('worker.js');await original.rpc('load',{base:'data/'});
const expected=JSON.parse(await fs.readFile(path.join(root,'validation-data.json'),'utf8'));
const texts=JSON.parse(await fs.readFile(path.join(root,'validation-text-counts.json'),'utf8'));
const F={m0:72,m1:140,types:null,req:'any',where:'any'};const results=[];
for(const target of ['US','GB','GLOBAL']){
 const args={F,target,uae:'panel',cohort:'available',limit:20};const r=await panel.rpc('query',args);
 assert.equal(r.uae.n,3200);assert.equal(r.benchmark.n,target==='GLOBAL'?texts.global_excluding_uae.texts:texts.countries[target].texts);
 assert.equal(r.uae.companies,42);if(target!=='GLOBAL')assert.equal(r.benchmark.companies,expected.markets[target].companies);
 assert(r.uae.years.reduce((s,y)=>s+y.n,0)>=r.uae.n);assert(r.benchmark.years.reduce((s,y)=>s+y.n,0)>=r.benchmark.n);
 const comm=r.rows.find(r=>r.name==='communication');assert(comm);assert.equal(comm.uae,1407);if(target!=='GLOBAL')assert.equal(comm.benchmark,texts.countries[target].communication);
 for(const row of r.rows){assert(row.uaeShare===null||row.uaeShare>=0&&row.uaeShare<=1);assert(row.benchmarkShare===null||row.benchmarkShare>=0&&row.benchmarkShare<=1);if(row.gap!==null)assert(Math.abs(row.gap-(row.uaeShare-row.benchmarkShare)*100)<1e-9);}
 const technical=await panel.rpc('query',{...args,F:{...F,types:[0]}});assert.equal(technical.uae.n,r.uae.n);assert.equal(technical.benchmark.n,r.benchmark.n);assert(technical.rows.every(r=>r.type===0));
 const planned=await panel.rpc('query',{...args,cohort:'planned'});assert.equal(planned.benchmark.n,target==='GLOBAL'?texts.global_excluding_uae.planned_texts:texts.countries[target].planned_texts);assert.equal(planned.uae.n,r.uae.n);
 results.push({target,panelUAE:r.uae.n,allExtractedBenchmark:r.benchmark.n,plannedBenchmark:planned.benchmark.n});
}
const ar=await panel.rpc('query',{F,target:'US',uae:'archive',cohort:'available',limit:20});const ov=await original.rpc('overview',{F});assert.equal(ar.uae.n,157266);assert.equal(ar.uae.n,ov.n);
for(const r of ov.topSkills){const comparison=ar.rows.find(x=>x.id===r.id);if(comparison){assert.equal(comparison.uae,r.ads);assert.equal(comparison.uaeShare,r.share);}}
for(const where of ['requirements','duties'])for(const req of ['required','preferred']){
 const test=await panel.rpc('query',{F:{...F,where,req},target:'US',uae:'archive',cohort:'available',limit:20});const check=await original.rpc('overview',{F:{...F,where,req}});
 assert.equal(test.uae.n,check.n);for(const r of check.topSkills){const row=test.rows.find(x=>x.id===r.id);if(row&&r.ads>=10)assert.equal(row.uae,r.ads);}
}
const zero=await panel.rpc('query',{F:{...F,m0:72,m1:72},target:'US',uae:'panel',cohort:'available'});assert.equal(zero.uae.n,0);assert.equal(zero.benchmark.n,0);assert(zero.uae.years.every(y=>y.share===null));assert(!JSON.stringify(zero).includes('NaN'));
const unmeasured=await panel.rpc('query',{F,target:'US',uae:'archive',cohort:'available',skill:meta.skillCount-1});assert(unmeasured.skill.unmeasured);assert(unmeasured.uae.years.every(y=>y.share===null));
for(const [group,types] of [['soft',[5]],['job',[0,1,3,4]],['language',[2]]]){
 const r=await panel.rpc('query',{F:{...F,types},target:'US',uae:'archive',cohort:'available',limit:20});
 assert.equal(r.uae.n,157266);assert.equal(r.benchmark.n,399881);assert(r.rows.every(row=>types.includes(row.type)));
 if(group==='soft'){assert(r.topU.some(row=>row.name==='communication'));assert(r.topU.some(row=>row.name==='attention to detail'));assert(!r.rows.some(row=>row.name==='patient care'));}
 if(group==='job')assert(!r.rows.some(row=>row.name==='communication'||row.name==='attention to detail'));
 assert(r.uae.years.some(y=>y.share!==null&&y.share>0),'Default annual skill must belong to selected group');
}
// Nine status/location combinations, including unknown status, must remain distinct.
for(const [bits,where,req,expected] of [[1,'requirements','required',true],[2,'requirements','required',false],[4,'duties','required',true],[64,'duties','required',false],[128,'requirements','any',true],[256,'any','required',false],[256,'any','any',true],[16,'any','required',true],[16,'requirements','required',false]]){panel.context.fixture={bits,where,req};assert.equal(vm.runInContext('posting(fixture.bits,fixture)',panel.context),expected);}
const report={passed:true,unit:"Distinct benchmark text per market in selected period",checkedAt:new Date().toISOString(),comparisons:results,archiveMatchesExistingWorker:true,requirementAndLocationParity:true,typeDenominatorsUnchanged:true,zeroSnapshotState:true,unmeasuredArchiveSkillUnavailable:true,statusMaskFixtures:9};await fs.writeFile(path.join(root,'validation-workers.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
