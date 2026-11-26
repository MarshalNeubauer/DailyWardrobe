/* Daily Wardrobe: the photo keys (the restructure S3b, 2026-11-26: moved out of photos.js, their text unchanged): the kept pictures
   (renders) and the keys they are kept under (comboSig, comboKey, fnv64, the shirt's pattern and weave), keeping one (keepRender,
   shareRender), the worker's address for pictures (workerBase) and its list of kept ones (workerList), whether pictures are drawn
   only (picsDrawn), and the escapes every screen writes markup with (esc, jsq, srcOk). Data only: nothing is drawn here. Loaded
   right after srgb.js, before the painter, which reads the keys, and before every screen. */
/* ---- kept outfit photos (made by the retired photo generator, worker /render): saved per outfit combination, not per day, so any
   day that wears the same pieces shows the photo; the worker keeps a copy (KV) so every device can show it. ---- */
import {REC_PHOTO,patBase,primaryCol,settings} from './core.js';
let renders={};   // kept pictures by key: outfit photos made before 2026-11-14 (renderFor shows them), item pictures, assembled pictures
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');   // ' too: some go into onclick='…'
/* (fix round 3, W2-13-02) a value inside a quoted JS string inside an inline handler (an onclick calling f('…')): the browser decodes the attribute
   first, so esc alone gives the JS string its ' back; jsq escapes for JS, then for the attribute */
const jsq=t=>esc(String(t??'').replace(/[\\'"\n\r\u2028\u2029<>&]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
/* a picture's src: only a data:image base64 picture, a blob: or http(s) address or a file path, with nothing that ends the attribute,
   else nothing (records are checked where they come in, core.js cleanRecord; this is the second lock) */
const srcOk=s=>{s=String(s??'');return /^(?:data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]*|(?:blob:|https?:\/\/)[^\s"'<>`\\]+|[\w./-]+)$/.test(s)?s:''};
/* the combination a photo shows: which pieces, and everything about them that changes how they look */
/* Which look a photo shows. The shirt counts only by its base colour (any white shirt shares the photo made with another
   white shirt); the jacket, tie, clip and watch count by how they look (colours, pattern, metal, dial), not by which item it
   is, so identical items share too. */
const LOOK_FIELDS=['primaryColor','secondaryColor','tertiaryColor','pattern','metal','dial','band','bezel','watchStyle'];
/* how one piece looks, for photo keys: a shirt by its colour (and its pattern or read texture), anything else by its look fields, details and read pattern */
const lookSig=(s,i)=>s==='shirt'?'shirt/'+primaryCol(i)+(shirtPatterned(i)?'/'+i.pattern+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:''):shirtTextured(i)?'/tex/'+settSig(i.sett):''):[i.type,...LOOK_FIELDS.map(f=>i[f]??'')].join('/')+(i.details?'/'+i.details:'')+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:'');
const comboSig=o=>(o.vest?'vest|':'')+(!o.top&&o.bot?'nojacket/'+[o.bot.type,...LOOK_FIELDS.map(f=>o.bot[f]??'')].join('/')+'|':'')+['top','shirt','tie','clip','watch'].map(s=>o[s]?lookSig(s,o[s]):'-').join('|');
const fnvMemo=new Map();   // the same looks are hashed over and over (every render, every history record): remember them
const fnv64=t=>{let v=fnvMemo.get(t);if(v)return v;let h=0xcbf29ce484222325n;for(const c of new TextEncoder().encode(t)){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}
  v=h.toString(16).padStart(16,'0');if(fnvMemo.size>4000)fnvMemo.clear();fnvMemo.set(t,v);return v};
const comboKey=o=>'c'+fnv64(comboSig(o));
/* a picture record whose img isn't a data:image/jpeg|png|webp;base64 picture is not kept (fix round 3, W2-13-06: the server took any text
   after the prefix, and the img went into src) */
async function keepRender(ck,rec,share){if(!rec||typeof rec.img!=='string'||!REC_PHOTO.test(rec.img))return;renders[ck]=rec;await metaPut('render:'+ck,rec);if(share)shareRender(ck,rec)}
// (an ended invitation: null, so nothing is asked with the dead code: the photo list, item and outfit pictures, the masters, holiday lists.
// Every open sent 12-45 refused requests; re-audit 2026-11-15)
const workerBase=()=>{const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');return w&&tok&&!(typeof inviteOver==='function'&&inviteOver())?{url:new URL('render',w.replace(/\/*$/,'/')).href,tok}:null};
function shareRender(ck,rec){const W=workerBase();if(W)fetch(W.url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({key:ck,rec})}).catch(()=>{})}
/* Settings → Outfit pictures → "Drawing only" (settings.pictures 'drawn', synced like every setting; absent or 'painted' = painted
   pictures, as before). 2026-11-14, the owner: "let the user turn off the painter and only use the mannequin". With it on, Today always
   shows the traced mannequin (no painted picture, no kept outfit photo) and nothing is painted or downloaded for the pictures: no masters,
   no built pictures, no list, no outfit photos (asmEnsure, asmAhead, asmSync, fetchRemoteRender, prefetchRenders all return). Item
   pictures (the product photos on the tiles under the figure, made on a tap) are their own feature and are not affected. What is already
   kept stays on the device, so switching back shows it at once. */
const picsDrawn=()=>!!settings&&settings.pictures==='drawn';
/* the worker's list of kept photos (GET /render?list=1): ONE request, shared by everything that needs it (the outfit photos here and
   assemble.js asmListGet; they used to ask separately, two lists every start), kept LIST_MS. A list costs one of the server's daily
   KV lists (testers share 150 a day): refused (429: the day's list allowance; 503: the server's lists failing, the free plan's daily
   lists used up) it is not asked for again until the next UTC day (localStorage list_pause {w, until}; the audit of 2026-11-14 saw 23
   refused lists in 20 s after one start, then one more on every swipe); a forced ask (Settings' Pictures ahead, Refresh) still tries
   once. Offline or unreachable: not asked again for LIST_RETRY_MS. Resolves to the Set of keys, or null when there is none */
const LIST_MS=10*60e3;
const LIST_RETRY_MS=60e3;
let listKeys=null,listAt=0,listP=null,listOf='',listFailAt=0,listRefused='';
const listNextDay=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)};
function listPaused(W){if(listRefused&&listRefused===W.url+'|'+W.tok)return true;try{const p=JSON.parse(localStorage.getItem('list_pause')||'null');return !!p&&p.w===W.url&&Date.now()<p.until}catch{return false}}
function workerList(force){const W=workerBase();if(!W)return Promise.resolve(null);
  const of=W.url+'|'+W.tok;if(of!==listOf){listOf=of;listKeys=null;listAt=0;listFailAt=0}   // another server or account: nothing of the last one's
  if(listP)return listP;
  if(!force&&(listKeys&&Date.now()-listAt<LIST_MS||listPaused(W)||Date.now()-listFailAt<LIST_RETRY_MS))return Promise.resolve(listKeys);
  listP=(async()=>{try{const r=await fetch(W.url+'?list=1',{headers:{'x-app-token':W.tok},cache:'no-store'});
      if(r.status===429||r.status===503){try{localStorage.setItem('list_pause',JSON.stringify({w:W.url,until:listNextDay()}))}catch{}return listKeys}
      // the code refused (401/403): an ended invitation is said and kept as such (sync.js), so workerBase gives nothing from now on; any
      // other refusal (the owner's mistyped code) holds every picture request for this code until it changes
      if(r.status===401||r.status===403){const j=await r.json().catch(()=>null);listRefused=of;
        if(typeof endedAnswer==='function'&&endedAnswer(r.status,j)&&typeof inviteEnded==='function')inviteEnded(W.tok,j);return listKeys}
      const j=r.ok?await r.json().catch(()=>null):null;
      if(j&&Array.isArray(j.keys)){listKeys=new Set(j.keys);listAt=Date.now();listFailAt=0;try{localStorage.removeItem('list_pause')}catch{}}else listFailAt=Date.now()}
    catch(e){listFailAt=Date.now();console.warn('no list',e)}
    finally{listP=null}return listKeys})();
  return listP}
async function loadRenders(){try{const all=await txs('meta','readonly',s=>s.getAll(IDBKeyRange.bound('render:','render;',false,true)));renders={};for(const x of all||[])renders[String(x.k).slice(7)]=x.v}catch(e){console.warn(e)}}   // (only the photos' key range: the kept assembled pictures are read by asmLoad)
/* a striped or checked shirt has its own photo key (a plain or finely woven one counts by its colour alone) */
const shirtPatterned=i=>!!i&&([...STRIPE_PATS,...CHECK_PATS,'houndstooth'].includes(patBase(i.pattern))||!!(usableSett(i)||{}).motif);
/* a shirt whose weave texture was read (dobby diamonds, herringbone…): it has its own photo key too */
const shirtTextured=i=>!!i&&!shirtPatterned(i)&&!!(usableSett(i)||{}).tex;
/* the bridge (tests/bridge.test.js): esc is called by 36 page scripts, srcOk by ten, jsq by add-save.js and look.js; the painter
   reads the kept pictures and their keys (renders, comboSig, comboKey, fnv64, keepRender, workerBase, workerList, listAt, picsDrawn);
   photos.js draws and fetches with all of them (shareRender, listPaused, loadRenders too); start.js loads the kept pictures
   (loadRenders). renders is replaced by tests (care, navfit, socktoe), listKeys and listAt by tests: a getter and a setter each.
   Nothing here runs at load */
Object.assign(globalThis,{esc,jsq,srcOk,comboSig,fnv64,comboKey,keepRender,shareRender,workerBase,picsDrawn,workerList,listPaused,loadRenders});
Object.defineProperties(globalThis,{renders:{get:()=>renders,set:v=>{renders=v}},listAt:{get:()=>listAt,set:v=>{listAt=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,get listKeys(){return listKeys},set listKeys(v){listKeys=v},get renders(){return renders},set renders(v){renders=v},get listAt(){return listAt},set listAt(v){listAt=v},shirtPatterned,jsq};
export {renders,esc,jsq,srcOk,comboSig,fnv64,comboKey,keepRender,shareRender,workerBase,picsDrawn,listKeys,listAt,workerList,listPaused,loadRenders,shirtPatterned,shirtTextured};
