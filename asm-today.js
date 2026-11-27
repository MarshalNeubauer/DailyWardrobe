/* Daily Wardrobe: Today's painted pictures on the page (the restructure S6p, 2026-11-27: moved out of assemble.js with their text
   unchanged): a look's job (asmJob), the pictures kept on the device and on the server (asmFor, asmGet, asmLoad, asmKeepOut), Today's
   hook (asmEnsure, asmShow), building ahead (asmAhead), the start-up sync (asmSync) and Settings' Outfit pictures part (renderAsmUI).
   It reads the app's state (app.js, today-plan.js) besides asm-look.js; the color-coded painter (asm-color.js and its page files) is
   optional, so what this file asks of it goes through bus.js sockets. */
import {$,REC_PHOTO,isWorkday,key,todayDate} from './core.js';
import {comboSig,renders,workerBase} from './photo-keys.js';
import {metaPut,sel,txs} from './app.js';
import {planFor} from './today-plan.js';
import {ASM_AHEAD,ASM_AHEAD_N,ASM_AHEAD_WAIT,ASM_KEEP,ASM_ON,ASM_OUT_RANGE,ASM_PRE_RE,ASM_RETRY_MS,asmAheadOn,asmIdleArm,asmImgOf,asmOffPage,asmPreGetting,asmPreNo,asmRetryAt,asmTried,asmUrls,setAsmAheadOn} from './assemble.js';
import {asmCmAny,asmCmHeld,asmCmKey,asmCmUse,asmDrawn,asmFresh,asmFullWins,asmListAt,asmListGet,asmLookId,asmOut,asmOutKey,asmPreSigOk,asmStale,asmWants,setAsmOut} from './asm-look.js';
import {ask,served,register} from './bus.js';
/* look for the outfit's colour-coded master on the worker, once a session: in the worker's list (one small request), else by downloading it */
const asmCmLook=async o=>{if(!ASM_ON||!served('asm-cm-kind'))return;const k=ask('asm-kind-of',o);if(!k)return;
  await ask('asm-cm-mf-get');   // the masters' manifest first: it may outdate a photo held here, and its dates are in the look's key
  for(const m of new Set([ask('asm-nk-base-of',k),k]))if(!renders[asmCmKey(m,'master')]){const L=await asmListGet();if(!(L&&L.has(asmCmKey(m,'master')))&&!asmTried.has(asmCmKey(m,'master')))await ask('asm-cm-get',m)}
  // the background (asm-color.js), once a session: its date is in every look's key, so a phone needs it to find the worker's pictures
  if(asmCmHeld(k))await ask('asm-cm-bg-get')};
function asmFor(o){if(!asmWants(o)||asmFullWins(o))return null;
  const k=asmOutKey(o),a=asmOut[k];if(a&&!a.lid&&asmCmUse(o)){a.lid=asmLookId(o);metaPut('asm:out:'+k,a).catch(()=>{})}   // (a picture kept before it carried its outfit: marked as it is met, so it can stand in after the next change)
  return a&&asmFresh(o,a)?{img:asmImgOf(k,a),model:'assembled',t:a.t,sig:comboSig(o)}:null}
const asmShown=o=>asmFor(o)||asmStale(o);
function asmTrim(){const old=Object.keys(asmOut).sort((a,b)=>asmOut[b].t-asmOut[a].t).slice(ASM_KEEP);for(const x of old){delete asmOut[x];const u=asmUrls.get(x);if(u){URL.revokeObjectURL(u.url);asmUrls.delete(x)}txs('meta','readwrite',st=>st.delete('asm:out:'+x))}}
function asmGetPre(o,listed){const k=asmOutKey(o);if(asmPreGetting.has(k))return asmPreGetting.get(k);const p=asmGetPre1(o,listed).finally(()=>asmPreGetting.delete(k));asmPreGetting.set(k,p);return p}
async function asmGetPre1(o,listed){const k=asmOutKey(o),W=workerBase();if(!W||(!listed&&asmTried.has('pre:'+k))||(listed&&asmPreNo.get(k)===asmListAt)||asmRetryAt.get('pre:'+k)>Date.now())return false;
  try{const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});
    if(!r.ok&&r.status!==404){asmRetryAt.set('pre:'+k,Date.now()+ASM_RETRY_MS);return false}
    asmTried.add('pre:'+k);const j=r.ok?await r.json().catch(()=>null):null;
    const m=j&&typeof j.img==='string'&&REC_PHOTO.test(j.img)&&ASM_PRE_RE.exec(String(j.sig||''));/* (only a picture: core.js REC_PHOTO) */if(!asmPreSigOk(o,m)){if(listed)asmPreNo.set(k,asmListAt);return false}
    const rec={img:j.img,stamp:+m[3],t:Date.now(),pre:true};if(!asmFresh(o,rec)){if(listed)asmPreNo.set(k,asmListAt);return false}
    await asmKeepOut(k,j.img,{stamp:rec.stamp,t:rec.t,pre:true,lid:asmLookId(o)});return true}
  catch(e){console.warn('no built picture',e);asmRetryAt.set('pre:'+k,Date.now()+ASM_RETRY_MS);return false}}
async function asmLoad(){try{const all=await txs('meta','readonly',st=>st.getAll(ASM_OUT_RANGE()));setAsmOut({});for(const x of all||[])asmOut[String(x.k).slice(8)]=x.v}catch(e){console.warn(e)}
  setTimeout(asmBlobUp,5000)}
/* keep a picture (a JPEG data URL) on the device as a Blob; where a Blob can't be made or stored, as the data URL as before */
async function asmKeepOut(k,img,extra){let rec;try{const blob=await (await fetch(img)).blob();rec={blob,...extra};await metaPut('asm:out:'+k,rec)}
  catch(e){rec={img,...extra};await metaPut('asm:out:'+k,rec)}
  asmOut[k]=rec;asmTrim();return rec}
/* old base64 records -> Blobs, one at a time */
async function asmBlobUp(){for(const [k,a] of Object.entries(asmOut)){if(!a||a.blob||!a.img||asmOut[k]!==a)continue;
  try{const blob=await (await fetch(a.img)).blob(),rec={...a,blob};delete rec.img;await metaPut('asm:out:'+k,rec);if(asmOut[k]===a)asmOut[k]=rec}catch(e){return}
  await new Promise(r=>setTimeout(r,50))}}
/* bring what this outfit needs onto the device, paint its picture, keep it and show it (asm-color.js asmCmEnsure: the worker's
   picture first). Not for an outfit whose own photo wins (asmFullWins): asmFor gives null for it, and taking that as "not made yet"
   painted it and redrew Today again and again after a Regenerate, which kept the phone busy and cut off every swipe and scroll */
/** @param {*} o @param {*} [ahead] */ async function asmEnsure(o,ahead){if(asmDrawn())return;await asmCmLook(o);if(!asmCmUse(o))return;if(!ahead)asmAheadSoon();return ask('asm-cm-ensure',o,ahead)}
/* the day on screen's picture is ready: Today is redrawn, but not under a finger (a redraw removes what the touch started on and the
   swipe or scroll stops); then it waits for the finger to lift */
let asmTouch=0,asmLate=false;
function asmTouchWatch(){if(/** @type {any} */(asmTouchWatch).on)return;/** @type {any} */(asmTouchWatch).on=true;
  addEventListener('touchstart',e=>{asmTouch=e.touches.length},{passive:true,capture:true});
  const up=e=>{asmTouch=e.touches.length;if(!asmTouch&&asmLate){asmLate=false;setTimeout(()=>{if(!$('#today').hidden)ask('refresh-today')},250)}};
  addEventListener('touchend',up,{passive:true,capture:true});addEventListener('touchcancel',up,{passive:true,capture:true})}
function asmShow(){asmTouchWatch();if(asmTouch){asmLate=true;return}ask('refresh-today')}
let asmAheadT=0,asmAheadAgain=false;
let asmAheadSoon=function asmAheadSoon(){clearTimeout(asmAheadT);asmAheadT=setTimeout(asmAhead,ASM_AHEAD_WAIT)};
/* the workdays from today to ASM_AHEAD days on, with the day on screen and its neighbours first: [[date, outfit]] (planned a day at a
   time with a pause between, so planning months ahead doesn't hold the page either) */
async function asmAheadDays(){const T=todayDate(),c=+new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),out=[];
  for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
    if(i&&i%10===0)await new Promise(r=>setTimeout(r,0));if(asmAheadAgain)return [];
    const o=ask('plan-on',d);if(o&&asmWants(o))out.push([Math.abs(+d-c),o])}
  return out.sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
let asmAhead=async function asmAhead(){if(!ASM_ON||document.hidden||asmDrawn()||!asmCmAny()||!asmOffPage())return;if(asmAheadOn){asmAheadAgain=true;return}setAsmAheadOn(true);   // (hidden first: asmOffPage starts a worker, CR-8-01; a pass started while one runs only sends it round again)
  try{do{asmAheadAgain=false;const seen=new Set(),todo=[];
      for(const o of await asmAheadDays()){const k=asmOutKey(o);if(seen.has(k))continue;seen.add(k);if(!asmFullWins(o)&&!asmFor(o))todo.push(o)}
      // (2026-11-13) the looks with a picture on the worker first, ASM_AHEAD_N at a time (only their pictures are downloaded); then the rest, one at
      // a time and grouped by master, so a master's setup is read once for all its looks (asmCmBuild keeps one in memory on a phone)
      const L=await asmListGet(),built=todo.filter(o=>asmCmUse(o)&&L&&L.has(asmOutKey(o))),rest=todo.filter(o=>!built.includes(o));
      const stop=()=>asmAheadAgain||document.hidden||!asmOffPage()||asmDrawn();let i=0;
      await Promise.all(Array.from({length:ASM_AHEAD_N},async()=>{while(i<built.length&&!stop())await asmEnsure(built[i++],true)}));
      rest.sort((a,b)=>String(asmCmUse(a)||'').localeCompare(String(asmCmUse(b)||'')));   // (a stable sort: nearest first within a master)
      for(const o of rest){if(stop())break;await asmEnsure(o,true)}
      if(!stop())await ask('asm-cm-warm',rest)}   // (2026-11-14) then the masters of the coming looks nobody built, set up ahead
    while(asmAheadAgain)}
  catch(e){console.warn('building ahead stopped',e)}finally{setAsmAheadOn(false);asmIdleArm()}};
/* asmState: what the last look at the worker found (cm: colour-coded masters are there) */
let asmState={checked:false,cm:false},asmSyncing=null;
/* look at the worker (start-up, Settings): the list of what it keeps and the masters' manifest. A forced look (Settings) waits for the
   look under way and then asks afresh for what was missing or failed before */
function asmSync(force){if(!ASM_ON||asmDrawn()||!workerBase())return Promise.resolve(asmState);if(asmSyncing)return force?asmSyncing.then(()=>asmSync(true)):asmSyncing;
  asmSyncing=(async()=>{
    try{if(force){asmTried.clear();asmRetryAt.clear();asmPreNo.clear();await asmListGet(true);await ask('asm-cm-mf-get',true)}else await asmListGet();
      asmState={checked:true,cm:asmCmAny()}}
    catch(e){console.warn('assembled pictures: could not check the worker',e)}
    asmSyncing=null;
    renderAsmUI();
    const cur=planFor()[key(sel)];if(cur&&asmWants(cur)&&!asmFor(cur)&&!$('#today').hidden)ask('refresh-today');
    return asmState})();
  return asmSyncing}
/* Settings → Outfit pictures → Advanced: the colour-coded masters' rows (asm-color.js asmCmUI) */
/* (with "Drawing only" the group is hidden, and with it the whole Advanced fold (styles.css #adv-photos:has(#asm-group[hidden])): Pictures
   ahead, Painted plain and the graphics-chip switch are about the painter; and asmCmStatus would read the worker's list) */
function renderAsmUI(){const on=ASM_ON&&!asmDrawn(),grp=$('#asm-group');if(grp)grp.hidden=!on;if(on)ask('asm-cm-ui')}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,get asmAhead(){return asmAhead},set asmAhead(v){asmAhead=v},get asmAheadSoon(){return asmAheadSoon},set asmAheadSoon(v){asmAheadSoon=v},asmBlobUp,asmCmLook,get asmSyncing(){return asmSyncing},asmEnsure,asmFor,asmGetPre,asmLoad,asmShow,asmShown,asmSync,renderAsmUI};
export {asmCmLook,asmFor,asmShown,asmGetPre,asmLoad,asmKeepOut,asmBlobUp,asmEnsure,asmShow,asmSync,renderAsmUI,asmSyncing,asmAheadSoon,asmAhead};
/* the hooks (bus.js register; the notice board made clean, N2): what this feature does at the moments core runs, its file's last statement */
/* (start-up and Settings, settings.js and start.js, required, may not import this file: the restructure S6p) */
register('asm-today',{'start-jobs':()=>({asmLoad,asmSync}),'settings-rows':()=>({renderAsmUI,asmSync}),'pictures-switched':()=>({asmSync,asmEnsure})});
