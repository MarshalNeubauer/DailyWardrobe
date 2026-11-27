/* Daily Wardrobe: the color-coded painter on the page (the restructure S6p, 2026-11-27: moved out of asm-color.js, asm-gl.js,
   asm-kinds.js and asm-ocp.js with their text unchanged): a look's route, signature and job (asmCmRoute, asmCmSig, asmCmJob), the code
   fingerprint (asmCmCode, asmCmCodeSig), the masters' manifest (asmCmMfGet), warming and Today's hook (asmCmWarm, asmCmEnsure),
   Settings' Pictures ahead and Painted plain (asmCmUI, asmCmStatus, asmGapUI, asmReadGaps) and the item sheet's line (asmGapNote). */
import {$,isWorkday,itemTitle,key,sentence,titleCls,todayDate} from './core.js';
import {comboKey,esc,renders,workerBase} from './photo-keys.js';
import {sel,txs} from './app.js';
import {planFor} from './today-plan.js';
import {NEED_CONN,isConnected} from './ui.js';
import {acts} from './act.js';
import {ASM_AHEAD,ASM_RETRY_MS,ASM_SIZE,asmBusy,asmRun,asmTried} from './assemble.js';
import {ASM_CM,ASM_CM_MF,ASM_CM_MF_RE,asmCmDiskGet,asmCmDiskKey,asmCmWarmed,asmCmWarming,setAsmCmWarming} from './asm-color.js';
import {asmGlSet,asmGlUI} from './asm-gl.js';
import {asmNkBase} from './asm-kinds.js';
import {asmCmUse,asmFullWins,asmGet,asmList,asmListAt,asmListGet,asmLookId,asmOutKey,asmPhoto,asmStamp,setAsmOut} from './asm-look.js';
import {asmCmAssets,asmCmBaseJob,asmCmBgGet,asmCmGaps,asmCmMf,asmCmMfKey,asmJfWants,asmKindOf,setAsmCmMf} from './asm-cm-job.js';
import {asmFor,asmGetPre,asmKeepOut,asmShow} from './asm-today.js';
import {ask,serve} from './bus.js';
/* bring the kind's master, masks and parts onto the device (true when all are here); the background too, when the worker has one */
async function asmCmGet(kind){if(!asmCmAssets(kind).length)return false;await asmCmMfGet();const keys=asmCmAssets(kind);if(!await asmGet(keys[0],true))return false;   // (keys after the manifest: it says whether the master has solved positions)
  await asmCmBgGet();return (await Promise.all(keys.slice(1).map(k=>asmGet(k)))).every(Boolean)}   // (CR-8-06: the PC builder's shared setup and 2048 copy, which nothing uploads since 2026-11-16, are no longer asked for)
let asmCmMfAt=null,asmCmMfGetting=null,asmCmMfRetry=0;
/* read the manifest when the worker's list was read again since (or once a session without a list) and drop the photos it outdates;
   it never asks for the list itself (a list is a scarce request on the worker's plan). force: read it now (Settings' forced look,
   asmSync(true): one small read) */
function asmCmMfGet(force){if(asmCmMfGetting)return asmCmMfGetting;asmCmMfGetting=asmCmMfGet1(force).finally(()=>{asmCmMfGetting=null});return asmCmMfGetting}
async function asmCmMfGet1(force){const W=workerBase();if(!W||(!force&&Date.now()<asmCmMfRetry))return;const L=asmList,at=L?asmListAt:0;if(!force&&asmCmMfAt===at)return;
  if(!force&&L&&!L.has(asmCmMfKey())){asmCmMfAt=at;return}   // the list says there is none: nothing to ask
  try{const r=await fetch(W.url+'?key='+asmCmMfKey(),{headers:{'x-app-token':W.tok},cache:'no-store'});
    if(!r.ok&&r.status!==404){asmCmMfRetry=Date.now()+ASM_RETRY_MS;return}
    asmCmMfAt=at;const j=r.ok?await r.json().catch(()=>null):null,m=j&&ASM_CM_MF_RE.exec(String(j.sig||''));if(!m)return;
    const keys=JSON.parse(m[1]).keys;if(!keys||typeof keys!=='object')return;await asmCmMfApply(keys)}
  catch(e){console.warn('no manifest',e);asmCmMfRetry=Date.now()+ASM_RETRY_MS}}
async function asmCmMfApply(keys){let n=0;
  for(const [k,t] of Object.entries(keys)){const r=renders[k];if(r&&(+r.t||0)<+t){delete renders[k];asmTried.delete(k);n++;try{await txs('meta','readwrite',st=>st.delete('render:'+k))}catch{}}}
  setAsmCmMf({keys});try{localStorage.setItem(ASM_CM_MF,JSON.stringify(asmCmMf))}catch{}
  if(n)console.info(`manifest: ${n} master photo${n===1?'':'s'} uploaded again, downloading them afresh`);return n}
async function asmCmWarm(looks){if(asmCmWarming||(self.ASM_CM_SIZE||ASM_SIZE)>ASM_SIZE||typeof indexedDB==='undefined')return 0;
  const cn=navigator.connection;if(cn&&(cn.saveData||/(^|-)2g$/.test(cn.effectiveType||'')))return 0;
  const kinds=[...new Set((looks||[]).map(o=>asmKindOf(o)).filter(k=>k&&!asmCmWarmed.has(k)))];if(!kinds.length)return 0;setAsmCmWarming(true);let n=0;
  try{for(const kind of kinds){if(document.hidden)break;asmCmWarmed.add(kind);if(!await asmCmGet(kind))continue;const job=asmCmBaseJob(kind);if(!job)continue;
      if(await asmCmDiskGet(asmCmDiskKey(job)))continue;await asmRun({...job,setupOnly:true},false);n++}}
  catch(e){console.warn('warming stopped',e)}finally{setAsmCmWarming(false)}return n}

/* ---- Today: the colour-coded way of asmEnsure ---- */
async function asmCmEnsure(o,ahead){const kind=asmKindOf(o);if(!kind)return;if(asmFullWins(o)||asmFor(o))return;const bk='cm|'+comboKey(o);if(asmBusy.has(bk))return;asmBusy.add(bk);
  try{const k=asmOutKey(o),L=await asmListGet(),showIf=()=>{const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow()};
    // (2026-11-13) the worker's picture first, before any of the master's photos: the master, its masks and parts (2.8 MB, about 7 s
    // on 4G) are only needed to paint here. The list says whether it has it; without a list, ask anyway
    if((!L||L.has(k))&&await asmGetPre(o,!!L)){showIf();return}
    // not there: painted here (a coming look waited 10 minutes for the PC builder until it was removed, 2026-11-16)
    if(!await asmNkGet(o,kind)||asmFullWins(o))return;   // (a new kind: its base master too; jeans: the faded master)
    const img=await asmPhoto(o,!ahead);if(!img)return;
    await asmKeepOut(k,img,{stamp:asmStamp(o),t:Date.now(),lid:asmLookId(o)});showIf()}
  catch(e){console.warn('could not paint',e)}finally{asmBusy.delete(bk)}}
/* Settings → Outfit pictures → Advanced: how many coming looks have a picture on the worker, and "Painted plain".
   (2026-11-13: the on/off switch for the colour-coded masters is gone, and so is Photo tagging's "Shirt weaves", whose shirts are in
   "Painted plain" with the other pieces waiting for a reading) */
function asmCmUI(){const grp=$('#asm-group');if(!grp)return;let b=$('#cm-box');if(!b){b=document.createElement('div');b.id='cm-box';b.className='sgroup';grp.appendChild(b)}
  b.innerHTML=`<div class="slabel">Pictures ahead</div><p class="shelp" id="cm-status" role="status"></p>`;
  asmGapUI();asmCmStatus();if(typeof asmGlUI==='function')asmGlUI(b)}
/* the workdays of the next ASM_AHEAD days painted on a colour-coded master: how many looks and how many this phone holds (it said how
   many the computer had built until the PC builder was removed, 2026-11-16) */
let asmCmStatusRun=0;
async function asmCmStatus(){const el=$('#cm-status');if(!el)return;const run=++asmCmStatusRun;
  if(!workerBase()){el.textContent='';return}
  el.textContent='Looking at the coming days…';
  const T=todayDate(),seen=new Map();
  for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
    if(i%10===9)await new Promise(r=>setTimeout(r,0));if(run!==asmCmStatusRun)return;
    const o=ask('plan-on',d);if(!o||!asmCmUse(o))continue;const k=asmOutKey(o);if(!seen.has(k))seen.set(k,o)}
  if(run!==asmCmStatusRun||!$('#cm-status'))return;
  const n=seen.size,here=[...seen.values()].filter(o=>asmFor(o)).length;
  el.textContent=!n?`None of the workdays in the next ${ASM_AHEAD} days is painted on a color-coded master.`:
    `Next ${ASM_AHEAD} days: ${here} of ${n} look${n===1?'':'s'} painted on this phone${here<n?` (the other ${n-here} are painted when needed)`:''}.`}
/* "Painted plain": every garment in rotation whose pattern the pictures don't show yet, why, and one tap to read the readable ones
   (Claude, one call each: never by itself) */
let asmGapRun=null;
function asmGapUI(){const b=$('#cm-box');if(!b)return;let g=$('#cm-gaps');if(!g){g=document.createElement('div');g.id='cm-gaps';b.appendChild(g)}
  const gaps=asmCmGaps(),rd=gaps.filter(x=>x.r.gap==='reading');
  g.innerHTML=!gaps.length?'<div class="snote">Every patterned piece in rotation is painted with its pattern.</div>':
    `<div class="slabel">Painted plain (${gaps.length})</div><ul class="cmgaps">${gaps.map(x=>`<li><span class="${titleCls(x.i)}">${esc(sentence(itemTitle(x.i)))}</span>: <small class="mut">${esc(x.r.why)}</small></li>`).join('')}</ul>`+
    (asmGapRun?`<p class="mut"><small>Reading ${asmGapRun.done+1} of ${asmGapRun.n}…</small></p>`:rd.length?`<div class="btns"><button type="button" id="cm-readall" data-act="asmReadAllTap"${isConnected()?'':` disabled class="needconn" title="${NEED_CONN}"`}>Read ${rd.length} pattern${rd.length===1?'':'s'}</button></div><div class="snote">Claude reads each one from its photo and close-up (one call each).</div>`:'')}
async function asmReadGaps(){const list=asmCmGaps().filter(x=>x.r.gap==='reading').map(x=>x.i);if(!list.length||asmGapRun)return;asmGapRun={n:list.length,done:0};asmGapUI();
  try{for(const it of list){await ask('pattern-reread',it.id);asmGapRun.done++;asmGapUI()}}finally{asmGapRun=null;asmGapUI()}
  setAsmOut({});asmTried.clear();ask('refresh-today')}
function asmCmSet(v){try{if(v==='off')localStorage.setItem(ASM_CM,'0');else localStorage.removeItem(ASM_CM)}catch{}setAsmOut({});asmTried.clear();ask('refresh-today')}
/* Settings' Painted plain: "Read N patterns" (act.js; on the page only: the painting worker has no act.js) */
if(typeof acts==='function')acts({asmReadAllTap:()=>asmReadGaps()});
/* Settings' "Graphics-chip painting" (act.js; on the page only: the painting worker has no act.js) */
if(typeof acts==='function')acts({asmGlPick:el=>asmGlSet(el.value)});
/* the records a look needs on this device: the base master's too (asmCmJob builds the cloth on it) and the faded master for jeans */
async function asmNkGet(o,k){const b=asmNkBase(k);if(b!==k&&!await asmCmGet(b))return false;if(!await asmCmGet(k))return false;
  const jf=asmJfWants(o,k);if(jf&&!renders[jf.key])await asmGet(jf.key,true);return true}
/* sockets (bus.js; the restructure S6p, 2026-11-27): what asm-today.js (today-no-picture) asks of this optional file */
serve('asm-cm-mf-get',asmCmMfGet);serve('asm-cm-get',asmCmGet);serve('asm-cm-ensure',asmCmEnsure);serve('asm-cm-warm',asmCmWarm);serve('asm-cm-ui',asmCmUI);
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,asmCmSet,asmReadGaps,asmCmEnsure,asmCmGet,asmCmMfGet,asmCmUI,asmCmWarm,asmNkGet};
export {asmCmGet,asmCmMfGet,asmCmWarm,asmCmEnsure,asmCmUI,asmReadGaps,asmCmSet,asmNkGet};
