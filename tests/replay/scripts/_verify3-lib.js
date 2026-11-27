// Shared helpers for the verifier-3 reproductions (W1-3-*). Each repro starts its own lab on port 9630 with a fresh kv file
// (kv\verify3-<id>.json), fixed phone/server clocks, prints REPRODUCED / NOT REPRODUCED, stops the lab and exits.
// buildLegacy(): a phone on 15 Nov a (c4a549b, dw-v364), connected, loads the sample, renames the sample navy suit
// ("My navy suit": the old rule counts it as his), uses the app Sun 1, Wed 4, Thu 5 Nov 2026; then the lab is restarted on
// the same kv with today's app (aa24910, dw-v376) = "the app and server were updated", and the phone opens it on Sun 8 Nov.
const RP = require('../harness/paths.js');
const fs=require('fs'),{spawn}=require('child_process');
const ROOT=RP.SCRATCH;
const P=require(RP.H+'phone.js');
const OLD=RP.old('c4a549b'),NEW=RP.APP;
const PORT=9630,W=`http://127.0.0.1:${PORT+1}/`,APP=`http://127.0.0.1:${PORT}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)));
let lab=null,kvFile=null,off=0,info=null;const phones=[];
const worldNow=()=>Date.now()+off;
async function up(){try{return (await fetch(W+'__mock/log')).ok}catch{return false}}
async function startLab(id,app,t,fresh=true){
  if(await up())throw new Error('something already listens on '+(PORT+1));
  if(id){kvFile=`${ROOT}/kv/verify3-${id}.json`;if(fresh)fs.rmSync(kvFile,{force:true})}
  lab=spawn(process.execPath,[RP.H+'lab.js','--port',String(PORT),'--app',app,'--kv',kvFile],{stdio:['ignore','ignore','pipe']});
  lab.stderr.on('data',d=>process.stderr.write('[lab] '+d));
  for(let i=0;i<80&&!await up();i++)await sleep(250);if(!await up())throw new Error('lab did not start');
  await sleep(300);info=JSON.parse(fs.readFileSync(RP.labInfo(PORT),'utf8'));
  if(t)await setServerTime(t);else if(off)await P.mock(PORT,'clock',{at:new Date(worldNow()).toISOString()});
  return info}
async function killLab(){if(!lab)return;await sleep(1300);const l=lab;lab=null;l.kill();await new Promise(r=>{l.on('exit',r);setTimeout(r,3000)});for(let i=0;i<20&&await up();i++)await sleep(200)}
async function restartLab(app){await killLab();return startLab(null,app,null,false)}
async function setServerTime(t){off=new Date(t).getTime()-Date.now();await P.mock(PORT,'clock',{at:new Date(t).toISOString()})}
async function setWorld(t,...phs){await setServerTime(t);for(const ph of phs)await ph.setTime(t)}
async function stopAll(){for(const ph of phones)await ph.kill().catch(()=>{});await killLab()}
async function finish(ok,evidence){log(ok?'REPRODUCED':'NOT REPRODUCED',evidence);await stopAll();process.exit(0)}
function main(fn){fn().catch(async e=>{console.error('ERROR',e);await stopAll();process.exit(2)})}
async function checkWorker(ph){const w=await ph.page.evaluate(()=>localStorage.worker_url||null).catch(()=>null);if(w&&w!==W)throw new Error('WORKER URL WRONG: '+w)}
async function open(profile,url){const ph=await P.openPhone({profile:'verify3-'+profile,fresh:true,time:worldNow()});phones.push(ph);
  await ph.page.goto(url||APP);await ph.ready();await sleep(2500);await checkWorker(ph);return ph}
async function reopen(ph){await ph.reopen(APP);await ph.ready();await sleep(3000);await checkWorker(ph)}
async function skipSetup(ph){for(let i=0;i<10;i++){const s=ph.page.locator('#su-skip:visible');if(await s.count()){await ph.tap('#su-skip');await sleep(700);return true}await sleep(400)}return false}
// a tester's phone backs up when it goes to the background
async function backup(ph){await ph.background();await sleep(3000);await ph.foreground();await sleep(1500)}
async function later(ph){await ph.advance(70000);await backup(ph)}
async function tapText(ph,txt,scope=''){const l=ph.page.locator(`${scope} button:visible`,{hasText:txt}).first();await l.scrollIntoViewIfNeeded({timeout:8000});const b=await l.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await sleep(600)}
async function openItemByName(ph,name){for(let k=0;k<4;k++){await ph.tap('#n-wardrobe');await sleep(700);if(await ph.page.evaluate(()=>!document.querySelector('#wardrobe').hidden&&document.querySelectorAll('.gi').length>0))break}
  await ph.page.evaluate(()=>{if(typeof HOOK!=='undefined'&&'CK_OPEN' in HOOK)HOOK.CK_OPEN['*']=true});   // #497: the sheet's fields are in folded sections; open them all (no-op before)
  // (run on the old build, which has no HOOK: its items is a classic script's global, READS_KEPT)
  const id=await ph.page.evaluate(n=>{const i=(typeof HOOK==='undefined'?items:HOOK.items).find(x=>(x.name||'')===n);if(!i)return null;const e=document.querySelector(`#gi-${i.id} .giopen`);if(e)e.scrollIntoView({block:'center'});return i.id},name);
  if(!id)throw new Error('no item '+name);return openItemId(ph,id)}
async function openItemId(ph,id){for(let k=0;k<4;k++){await ph.tap('#n-wardrobe');await sleep(700);if(await ph.page.evaluate(()=>!document.querySelector('#wardrobe').hidden&&document.querySelectorAll('.gi').length>0))break}
  await ph.page.evaluate(()=>{if(typeof HOOK!=='undefined'&&'CK_OPEN' in HOOK)HOOK.CK_OPEN['*']=true});   // #497's folded sections, also when called directly (W1-3-02-today)
  await ph.page.evaluate(id=>{const e=document.querySelector(`#gi-${id} .giopen`);if(e)e.scrollIntoView({block:'center'})},id);await sleep(400);
  const b=await ph.page.locator(`#gi-${id} .giopen`).boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/3);await sleep(1000);return id}
async function setField(ph,k,v){const i=ph.page.locator(`#item-view .wf-${k}:visible`).first();await i.scrollIntoViewIfNeeded();const b=await i.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await i.fill(v);await i.press('Tab');await sleep(700)}
async function done(ph){const d=ph.page.locator('#item-view button:visible',{hasText:/^Done$/}).first();const b=await d.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await sleep(800)}
async function today(ph){await ph.tap('#n-today');await sleep(1200)}
const kvDump=()=>P.mock(PORT,'kv-dump');
async function serverBackup(){const d=await kvDump();for(const [k,e] of Object.entries(d))if(/:wardrobe:v1$/.test(k)&&!e.b){const o=JSON.parse(e.v);return o.data||o}return null}
const todayKey=ph=>ph.page.evaluate(()=>HOOK.key(HOOK.todayDate()));
const dayOf=(bk,k)=>bk&&(bk.days||[]).find(d=>d.date===k)||null;
const pill=ph=>ph.page.evaluate(()=>{const p=document.querySelector('#wpill');return p?p.innerText.trim():null});
async function recordToasts(ph){await ph.ctx.addInitScript(()=>{window.__toasts=[];const hook=()=>{const e=document.querySelector('#toast');if(!e)return setTimeout(hook,50);
  new MutationObserver(()=>{const t=e.innerText.trim();if(t&&window.__toasts[window.__toasts.length-1]!==t)window.__toasts.push(t.replace(/\s+/g,' ').slice(0,200))}).observe(e,{childList:true,subtree:true,characterData:true})};document.addEventListener('DOMContentLoaded',hook)})}

/* 15 Nov a, then the update. Returns {A, link, suitId}. A is on today's app on Sun 8 Nov 2026 08:00 Kuwait time when it returns. */
async function buildLegacy(id){
  await startLab(id,OLD,'2026-11-01T08:00:00+03:00');const link=info.inviteLink;
  const A=await open(id+'-A',link);await skipSetup(A);await sleep(1500);await today(A);
  // (on the old build, which has no HOOK: its items and settings are a classic script's globals, READS_KEPT)
  await A.tap('#kit-sample-link');for(let i=0;i<40&&await A.page.evaluate(()=>(typeof HOOK==='undefined'?items:HOOK.items).length)<24;i++)await sleep(250);await sleep(1500);
  const workdays=await A.page.evaluate(()=>(typeof HOOK==='undefined'?settings:HOOK.settings).workdays);
  await A.advance(5000);
  const suitId=await openItemByName(A,'Navy suit');await setField(A,'name','My navy suit');await done(A);
  // (on the old build, which has no HOOK: its kitEdited is a classic script's global)
  const old=await A.page.evaluate(id=>{const ke=typeof HOOK==='undefined'?kitEdited:HOOK.kitEdited,its=typeof HOOK==='undefined'?items:HOOK.items,i=its.find(x=>x.id===id);return {name:i.name,sample:!!i.sample,editedOldRule:ke(i),own:its.filter(i=>!i.sample||ke(i)).length,all:its.length}},suitId);
  await today(A);await backup(A);
  for(const t of ['2026-11-04T08:00:00+03:00','2026-11-05T08:00:00+03:00']){await setWorld(t,A);await reopen(A);await sleep(1500);await backup(A)}
  await sleep(1500);const bk=await serverBackup();
  const before={workdays,old,serverItems:bk.items.length,serverSample:bk.items.filter(i=>i.sample).length,serverDays:bk.days.length,
    serverSuit:(bk.items.find(i=>i.id===suitId)||{}).name};
  // the update: the lab restarts on the same kv with today's app; the phone opens it (the new service worker may need a reopen or two)
  await restartLab(NEW);await setWorld('2026-11-08T08:00:00+03:00',A);
  let isNew=false;for(let k=0;k<5&&!isNew;k++){await reopen(A);isNew=await A.page.evaluate(()=>typeof HOOK!=='undefined'&&'kitUserEdit' in HOOK);}
  if(!isNew)throw new Error('phone A never took today\'s app');
  await sleep(3000);
  return {A,link,suitId,before}}
module.exports={P,OLD,NEW,PORT,W,APP,sleep,log,startLab,restartLab,killLab,setServerTime,setWorld,stopAll,finish,main,open,reopen,skipSetup,backup,later,tapText,
  openItemByName,openItemId,setField,done,today,kvDump,serverBackup,todayKey,dayOf,pill,recordToasts,buildLegacy,worldNow,checkWorker,phones,get info(){return info}};
