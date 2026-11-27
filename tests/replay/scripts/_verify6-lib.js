// Shared helpers for the verifier-6 reproductions (W1-6-*). Each repro starts its own lab on port 9660 with a fresh kv file,
// uses fixed phone/server clocks, prints REPRODUCED / NOT REPRODUCED, stops the lab and exits.
const RP = require('../harness/paths.js');
const fs=require('fs'),{spawn}=require('child_process');
const ROOT=RP.SCRATCH;
const P=require(RP.H+'phone.js');
const PORT=9660,W=`http://127.0.0.1:${PORT+1}/`,APP=`http://127.0.0.1:${PORT}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)));
let lab=null,off=0;const phones=[];
const worldNow=()=>Date.now()+off;
async function up(){try{const r=await fetch(W+'__mock/log');return r.ok}catch{return false}}
async function startLab(id,t0){
  if(await up())throw new Error('something already listens on '+(PORT+1));
  const kv=`${ROOT}/kv/verify6-${id}.json`;fs.rmSync(kv,{force:true});
  lab=spawn(process.execPath,[RP.H+'lab.js','--port',String(PORT),'--kv',kv],{stdio:['ignore','ignore','pipe']});
  lab.stderr.on('data',d=>process.stderr.write('[lab] '+d));
  for(let i=0;i<60&&!await up();i++)await sleep(250);
  if(!await up())throw new Error('lab did not start');
  await setServerTime(t0);
}
async function setServerTime(t){off=new Date(t).getTime()-Date.now();await P.mock(PORT,'clock',{at:new Date(t).toISOString()})}
async function stopLab(){for(const ph of phones)await ph.kill().catch(()=>{});if(lab){await sleep(1200);lab.kill();await new Promise(r=>{lab.on('exit',r);setTimeout(r,3000)});lab=null}}
async function finish(ok,evidence){log(ok?'REPRODUCED':'NOT REPRODUCED',evidence);await stopLab();process.exit(0)}
function main(fn){fn().catch(async e=>{console.error('ERROR',e);await stopLab();process.exit(2)})}
async function newInvite(name){const r=await fetch(W+'invites',{method:'POST',headers:{'content-type':'application/json','x-app-token':'owner-secret'},body:JSON.stringify({name})});const j=await r.json();
  const code=j.code||(j.invite&&j.invite.code);return `${APP}#invite=${code}&w=${encodeURIComponent(W)}`}
async function checkWorker(ph){const w=await ph.page.evaluate(()=>localStorage.worker_url||null);if(w&&w!==W)throw new Error('WORKER URL WRONG: '+w)}
async function open(profile,url){const ph=await P.openPhone({profile:'verify6-'+profile,fresh:true,time:worldNow()});phones.push(ph);
  await ph.page.goto(url||APP);await ph.ready();await sleep(1500);await checkWorker(ph);await skipSetup(ph);return ph}
async function skipSetup(ph){for(let i=0;i<3;i++){const s=await ph.page.$('#setup:not([hidden]) button:has-text("Skip")');if(s&&await s.isVisible()){await s.click();await sleep(500)}else break}}
async function tapText(ph,txt,scope=''){const l=ph.page.locator(`${scope} button:visible`,{hasText:txt}).first();await l.scrollIntoViewIfNeeded({timeout:8000});const b=await l.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await sleep(500)}
async function confirmDialog(ph,txt){await ph.page.locator('button:visible',{hasText:txt}).last().click();await sleep(800)}
const CSV=`Type,Colour,Pattern,Name
Suit,Navy,Solid,Navy suit
Suit,Charcoal,Solid,Charcoal suit
Blazer,Navy,Solid,Blue blazer
Trousers,Grey,Solid,Grey trousers
Dress shirt,White,Solid,White shirt
Dress shirt,Light blue,Solid,Blue shirt
Dress shirt,Pink,Solid,Pink shirt
Tie,Burgundy,Solid,Burgundy tie
Tie,Navy,Stripe,Navy stripe tie
Tie,Green,Solid,Green tie
Shoes,Black,,Black oxfords
Shoes,Brown,,Brown derbies
Belt,Black,,Black belt
`;
async function openImport(ph){await ph.tap('#n-wardrobe');await sleep(600);await ph.tap('#ward-add');await sleep(700);await ph.tap('#add-import');await sleep(700)}
async function importRows(ph){await openImport(ph);await ph.page.fill('#kit-paste',CSV);await sleep(600);await ph.tap('#kit-imp');await sleep(1500);
  const n=await ph.page.evaluate(()=>HOOK.items.length);if(n<13)throw new Error('import gave '+n)}
// a tester's phone backs up when it goes to the background
async function backup(ph){await ph.background();await sleep(2500);await ph.foreground();await sleep(1500)}
// "a minute later": the phone's clock moves past the 60 s foreground-sync gap, then background and back
async function later(ph){await ph.advance(70000);await backup(ph)}
const names=ph=>ph.page.evaluate(()=>HOOK.items.map(i=>i.name||i.type));
async function openItem(ph,name){for(let k=0;k<4;k++){await ph.tap('#n-wardrobe');await sleep(700);if(await ph.page.evaluate(()=>!document.querySelector('#wardrobe').hidden&&document.querySelectorAll('.gi').length>0))break}
  await ph.page.evaluate(()=>{if('CK_OPEN' in HOOK)HOOK.CK_OPEN['*']=true});   // #497: the sheet's fields are in folded sections; open them all (no-op before)
  const id=await ph.page.evaluate(n=>{const i=HOOK.items.find(x=>x.name===n);if(!i)return null;const e=document.querySelector(`#gi-${i.id} .giopen`);if(e)e.scrollIntoView({block:'center'});return i.id},name);
  if(!id)throw new Error('no item '+name);await sleep(300);const b=await ph.page.locator(`#gi-${id} .giopen`).boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/3);await sleep(900);return id}
// the sheet's Name field by its class (wardrobe.js fldRow, .wf-name since before 6f78b02): "the first text field" became the Price
// field when #554 (cost.js) put it in Planning & care above Name & notes, so W1-6-06 typed "Blazer copy" into the price
const nameInput=ph=>ph.page.locator('#item-view input.wf-name:visible').first();
async function rename(ph,from,to){await openItem(ph,from);const i=nameInput(ph);await i.fill(to);await i.press('Tab');await done(ph)}
async function done(ph){const d=ph.page.locator('#item-view button:visible',{hasText:/^Done$/}).first();const b=await d.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await sleep(700)}
const kv=()=>P.mock(PORT,'kv-dump');
module.exports={P,PORT,W,APP,sleep,log,startLab,stopLab,setServerTime,finish,main,newInvite,open,skipSetup,tapText,confirmDialog,importRows,openImport,backup,later,names,openItem,nameInput,rename,done,kv,worldNow,checkWorker,phones};
