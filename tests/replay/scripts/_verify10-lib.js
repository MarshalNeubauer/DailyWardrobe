// Verifier 10 (port 9700): own lab + phone helpers for W1-10-* repros. Never touches the real server.
const RP = require('../harness/paths.js');
const ROOT=RP.SCRATCH + '/';
const {openPhone,mock,setWorldTime}=require(RP.H+'phone.js');
const cp=require('child_process'),fs=require('fs');
const PORT=9700,W=`http://127.0.0.1:${PORT+1}/`,APP=`http://127.0.0.1:${PORT}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PHOTOS=[RP.SAMPLES_A + '/',RP.SAMPLES_B + '/'].flatMap(d=>fs.readdirSync(d).filter(f=>/\.jpe?g$/i.test(f)).sort().map(f=>d+f));   // 18 distinct photos: none reused within a run
const M=(w,b)=>mock(PORT,w,b);
const OWNER={'x-app-token':'owner-secret','content-type':'application/json'};
let proc=null;
async function startLab(name){const kv=ROOT+`kv/verify10-${name}.json`;try{fs.rmSync(kv)}catch{}
  proc=cp.spawn(process.execPath,[RP.H+'lab.js','--port',String(PORT),'--kv',kv],{stdio:['ignore','ignore','pipe']});let err='';proc.stderr.on('data',d=>err+=d);
  for(let i=0;i<60;i++){await sleep(400);if(await fetch(W+'__mock/log').then(r=>r.ok).catch(()=>false))return JSON.parse(fs.readFileSync(RP.labInfo(PORT),'utf8'))}
  throw new Error('lab did not start '+err)}
async function stopLab(){if(!proc)return;await sleep(1200);proc.kill();await sleep(500);proc=null}
async function phone(name){const ph=await openPhone({profile:'verify10-'+name,fresh:true});ph.onDialog=d=>d.accept().catch(()=>{});return ph}
async function vis(ph,sel){return ph.page.locator(sel).first().isVisible().catch(()=>false)}
async function tapC(ph,sel){const b=await ph.page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]},sel);if(!b)throw new Error('no '+sel);await ph.tapAt(...b)}
async function guard(ph){const w=await ph.page.evaluate(()=>localStorage.worker_url||'');if(w&&w!==W)throw new Error('WRONG WORKER URL '+w)}
const TAGS={
  suit:{type:'suit',primaryColor:'navy',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'wool',texture:'smooth',formality:'business',season:'all'},
  shirtW:{type:'shirt',primaryColor:'white',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'cotton',texture:'smooth',formality:'business',season:'all'},
  tie:{type:'tie',primaryColor:'burgundy',secondaryColor:'navy',thirdColor:'none',pattern:'stripes',material:'silk',texture:'smooth',formality:'business',season:'all'},
  shoes:{type:'shoes',primaryColor:'black',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'leather',texture:'smooth',formality:'business',season:'all'},
  shirtB:{type:'shirt',primaryColor:'light blue',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'cotton',texture:'smooth',formality:'business',season:'all'},
  tieN:{type:'tie',primaryColor:'navy',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'silk',texture:'smooth',formality:'business',season:'all'},
  suitG:{type:'suit',primaryColor:'grey',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'wool',texture:'smooth',formality:'business',season:'all'},
  shoesBr:{type:'shoes',primaryColor:'brown',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'leather',texture:'smooth',formality:'business',season:'all'},
  belt:{type:'belt',primaryColor:'black',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'leather',texture:'smooth',formality:'business',season:'all'},
};
let pn=0;
async function cardsIdle(ph,ms=30000){const t=Date.now();while(Date.now()-t<ms){const ok=await ph.page.evaluate(()=>typeof queue!=='undefined'&&queue.length>0&&queue.every(q=>!q.busy&&!q.refining&&!q.patternReading)).catch(()=>false);if(ok)return true;await sleep(300)}return false}
async function setupNext(ph){for(let k=0;k<9;k++){if(!await vis(ph,'#su-next'))break;await ph.tap('#su-next');await sleep(700);if(await vis(ph,'#ask-cancel')){await ph.tap('#ask-cancel');await sleep(300)}}
  for(let k=0;k<6;k++){if(!await vis(ph,'#kit-next'))break;await ph.tap('#kit-next');await sleep(300)}}
async function openAdd(ph){if(await vis(ph,'#add-one'))return;if(!await vis(ph,'#wardrobe')){await ph.tap('#n-wardrobe');await sleep(500)}await ph.tap('#ward-add');await sleep(600)}
async function addOne(ph,tag,{closeup=false}={}){await M('next-tag',tag);await openAdd(ph);await ph.page.setInputFiles('#add-one input',PHOTOS[pn++%PHOTOS.length]);await sleep(500);await cardsIdle(ph);
  if(closeup){await ph.page.setInputFiles('#queue input[type=file]',PHOTOS[pn++%PHOTOS.length]);await sleep(800);await cardsIdle(ph)}
  if(!await vis(ph,'#qconf-0'))throw new Error('no Confirm');await tapC(ph,'#qconf-0');await sleep(1200)}
// a tester connected through the invitation link, setup tapped through, n items added, backed up
async function buildTester(name,info,iso='2026-11-15T07:30:00+03:00',n=6){const ph=await phone(name);await setWorldTime(ph,PORT,iso);await ph.page.goto(info.inviteLink);await ph.ready();await sleep(2000);await setupNext(ph);await guard(ph);
  for(const k of ['suit','shirtW','tie','shoes','shirtB','tieN','suitG','shoesBr'].slice(0,n))await addOne(ph,TAGS[k]);
  await ph.tap('#n-today');await sleep(1000);await ph.background();await sleep(3000);await ph.foreground();await sleep(1500);return ph}
async function userKeys(id){return (await M('kv')).keys.filter(k=>k.startsWith('u:'+id+':'))}
async function me(token){const r=await fetch(W+'me',{headers:{'x-app-token':token}});return {status:r.status,j:await r.json().catch(()=>({}))}}
async function ownerList(){const j=await (await fetch(W+'invites',{headers:OWNER})).json();return (j.invites||[]).map(i=>({id:i.id,off:i.off}))}
async function text(ph,sel){return (await ph.page.innerText(sel).catch(()=>'')).replace(/\s+/g,' ').trim()}
module.exports={PORT,W,APP,M,OWNER,sleep,startLab,stopLab,phone,vis,tapC,guard,TAGS,addOne,setupNext,buildTester,userKeys,me,ownerList,text,setWorldTime,cardsIdle};
