// Shared helpers for the verifier-8 repro scripts (lab on 9680/9681, profiles verify8-*, kv files kv\verify8-*.json).
const RP = require('../harness/paths.js');
const cp=require('child_process'),fs=require('fs');
const ROOT=RP.SCRATCH,H=RP.H;
const {openPhone,setWorldTime,mock}=require(H+'phone.js');
const PORT=9680,URL_=`http://127.0.0.1:${PORT}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function startLab(kvName){const kv=`${ROOT}/kv/verify8-${kvName}.json`;fs.rmSync(kv,{force:true});
  const lab=cp.spawn(process.execPath,[H+'lab.js','--port',String(PORT),'--kv',kv],{stdio:'ignore'});
  for(let i=0;i<60;i++){await sleep(500);if(await fetch(`http://127.0.0.1:${PORT+1}/__mock/log`).then(r=>r.ok).catch(()=>false))return lab}
  lab.kill();throw new Error('lab did not start')}
async function phone(name){const ph=await openPhone({profile:'verify8-'+name,fresh:true});
  ph.tapText=async(re,sel='button')=>{const l=ph.page.locator(sel,{hasText:re}).filter({visible:true}).first();await l.waitFor({state:'visible',timeout:15000});
    await l.evaluate(e=>e.scrollIntoView({block:'center'}));const b=await l.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await sleep(700)};
  ph.toast=()=>ph.page.evaluate(()=>{const t=document.querySelector('#toast');return t&&t.classList.contains('on')?t.innerText:''});
  ph.guard=async()=>{const w=await ph.page.evaluate(()=>localStorage.getItem('worker_url'));if(w&&w!==`http://127.0.0.1:${9681}/`)throw new Error('worker_url is '+w+': stopping');return w};
  return ph}
async function run(id,body){let lab,ph=[];const phones=[];
  try{lab=await startLab(id);const ok=await body(phones,(t)=>setWorldTime(...t));}
  catch(e){console.log('NO VERDICT (error)',e&&e.stack||e)}   // an error is not a pass: a stale selector must not read as fixed
  finally{for(const p of phones)await p.kill().catch(()=>{});if(lab){await sleep(1200);lab.kill()}process.exit(0)}}
const verdict=(ok,ev)=>console.log((ok?'REPRODUCED':'NOT REPRODUCED')+'\n'+JSON.stringify(ev,null,1));
module.exports={PORT,URL:URL_,sleep,phone,run,verdict,setWorldTime,mock};
