// Shared helper for the W1-9-* reproductions (verifier 9). Lab on 9690 (app) / 9691 (worker); profiles verify9-*; kv\verify9-*.json.
const RP = require('../harness/paths.js');
const cp=require('child_process'),fs=require('fs');
const ROOT=RP.SCRATCH + '/',H=RP.H;
const {openPhone,mock:mk,setWorldTime:swt}=require(H+'phone.js');
const PORT=9690,W=`http://127.0.0.1:${PORT+1}/`,APP=`http://127.0.0.1:${PORT}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));
const mock=(w,b)=>mk(PORT,w,b),setWorldTime=(ph,t)=>swt(ph,PORT,t);
let lab=null;
async function labUp(name){const kv=ROOT+`kv/verify9-${name}.json`;try{fs.rmSync(kv)}catch{}
  lab=cp.spawn(process.execPath,[H+'lab.js','--port',String(PORT),'--kv',kv],{stdio:['ignore','ignore','pipe']});let err='';lab.stderr.on('data',d=>err+=d);
  for(let i=0;i<60;i++){await sleep(500);if(await fetch(W+'__mock/log').then(r=>r.ok).catch(()=>false))return JSON.parse(fs.readFileSync(RP.labInfo(PORT),'utf8'))}
  throw new Error('lab did not start '+err)}
async function labDown(){if(!lab)return;await sleep(1200);lab.kill();await sleep(600);lab=null}
async function phone(name,opt={}){return openPhone({profile:'verify9-'+name,fresh:true,timezoneId:'Asia/Kuwait',...opt})}
async function guard(ph){const w=await ph.page.evaluate(()=>localStorage.worker_url).catch(()=>null);if(w&&w!==W)throw new Error('worker_url WRONG '+w)}
const vis=(ph,s)=>ph.page.locator(s).first().isVisible().catch(()=>false);
async function tapText(ph,re,scope='body'){const l=ph.page.locator(`${scope} :is(button,a,label,[role=button])`).filter({hasText:re});const n=await l.count();
  for(let i=0;i<n;i++){const e=l.nth(i);if(await e.isVisible().catch(()=>false)){await e.scrollIntoViewIfNeeded();const b=await e.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);return true}}
  throw new Error('no visible control '+re)}
async function waitToast(ph){for(let i=0;i<15&&await ph.page.evaluate(()=>{const t=document.querySelector('#toast');return !!t&&t.classList.contains('on')});i++)await sleep(1000)}
const CSV=`Type,Colour,Second colour,Pattern,Name,Vest
Suit,Navy,,Solid,Navy suit,No
Suit,Charcoal,,Solid,Charcoal suit,No
Suit,Mid grey,,Solid,Grey suit,No
Blazer,Navy,,Solid,Navy blazer,
Trousers,Mid grey,,Solid,Grey trousers,
Trousers,Tan,,Solid,Tan trousers,
Dress shirt,White,,Solid,,
Dress shirt,Light blue,,Solid,,
Dress shirt,Pink,,Solid,,
Tie,Burgundy,Navy,Stripe,,
Tie,Navy,,Solid,,
Tie,Green,,Solid,,
Shoes,Black,,,Black oxfords,
Shoes,Brown,,,Brown oxfords,
Belt,Black,,,,
Belt,Brown,,,,
`;
// join with the lab's invitation, walk the setup with its defaults (Next...), import the spreadsheet from the Wardrobe, back up
async function joinAndSetUp(ph,link){
  await ph.page.goto(link);await ph.ready();await sleep(2500);await guard(ph);
  for(let i=0;i<12&&await vis(ph,'#su-next');i++){await ph.tap('#su-next');await sleep(600)}
  const f=ROOT+'_v9wardrobe.csv';fs.writeFileSync(f,CSV);
  const x=ph.page.locator('button[aria-label=Close]:visible, .kit-x:visible').first();if(await x.count()){await x.click();await sleep(600)}
  if(!await tapText(ph,/spreadsheet/i).catch(()=>false)){if(await vis(ph,'#add .pback'))await ph.tap('#add .pback');await sleep(500);
    await ph.tap('#n-wardrobe');await sleep(800);await tapText(ph,/spreadsheet/i)}
  await sleep(800);await ph.page.setInputFiles('input[accept*=csv]',f);await sleep(1000);
  await ph.tap('#kit-imp');await sleep(2500);await ph.tap('#n-today');await sleep(1200);
  const n=await ph.page.evaluate(()=>items.length);if(n<16)throw new Error('import gave '+n+' items');
  await sync(ph)}
async function sync(ph){await ph.background();await sleep(3500);await ph.foreground();await sleep(2500)}
async function reopen(ph){await ph.reopen(APP);await ph.ready();await sleep(3000);await guard(ph)}
async function openItem(ph,re){await ph.tap('#n-wardrobe');await sleep(700);await waitToast(ph);
  await ph.page.evaluate(()=>{if(typeof CK_OPEN!=='undefined')CK_OPEN['*']=true});   // #497: the sheet's fields are in folded sections; open them all (no-op before)
  const l=ph.page.locator('#wardrobe .gi').filter({hasText:re}).first();await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();await ph.tapAt(b.x+b.width/2,b.y+b.height/2);await sleep(900);
  if(!await vis(ph,'#item-view .wf-name')){await l.click({force:true});await sleep(900)}}
async function rename(ph,re,name){await openItem(ph,re);const f=ph.page.locator('#item-view .wf-name');await f.click();await f.press('Control+a');await f.type(name);await sleep(300);
  await tapText(ph,/^Done$/,'#item-view');await sleep(700)}
async function delItem(ph,re){await openItem(ph,re);await tapText(ph,/Delete item/,'#item-view');await sleep(1200)}
const names=ph=>ph.page.evaluate(()=>items.map(i=>i.name||desc(i)).sort());
async function server(){const d=await mock('kv-dump');const k=Object.keys(d).find(k=>/wardrobe:v1$/.test(k));if(!k)return null;const e=d[k];const v=e.b?Buffer.from(e.v,'base64').toString('utf8'):e.v;
  const j=JSON.parse(v),data=j.data||j;return {keys:Object.keys(d),items:(data.items||[]).map(i=>(i.name||i.type+' '+(i.primaryColor||''))+'@'+new Date(i.updated||i.added).toISOString()),tomb:data.tombstones||{},days:(data.days||[]),settings:data.settings}}
function verdict(ok,ev){log(ok?'REPRODUCED':'NOT REPRODUCED');log('evidence:',ev)}
// run a scenario: lab up, fn, always stop the phones and the lab
async function run(name,fn){const phones=[];let code=0;try{const info=await labUp(name);await fn(phones,info.inviteLink)}catch(e){console.error(e);log('NO VERDICT (error)');code=2}   // an error is not a pass: a stale selector must not read as fixed
  for(const p of phones)await p.kill().catch(()=>{});await labDown();process.exit(code)}
module.exports={PORT,W,APP,sleep,log,mock,setWorldTime,labUp,labDown,phone,guard,vis,tapText,joinAndSetUp,sync,reopen,openItem,rename,delItem,names,server,verdict,run,waitToast};
