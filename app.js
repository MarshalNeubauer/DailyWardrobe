/* Daily Wardrobe: the app's state and storage (IndexedDB), and helpers every page uses: the busy pill, the tab bar's fit, questions,
   colour names, photo loading and the precision swatch. The load order is index.html's <script> list: core.js and
   the drawing scripts, then app.js, add.js and its parts, item-photo.js, item-view.js, itemsheet.js, history.js, today.js, month.js,
   photos.js, settings.js, start.js (the start-up
   chain), ui.js and the rest, about.js last.
   (An ES module, at its place in index.html's order; split out of app.js on 2026-11-14.) */
import {emit,serve,askFor,need,served} from './bus.js';   // the Wardrobe's redraw: itemsheet.js pins renderWardrobe for 'wardrobe-changed'
import {$,ACCENT_MAX,BELT_MATS,COLORS,FABRIC,LEATHERS,MATERIALS_BY,METAL,PATS_BY,SHOE_NAP,SHOE_STYLES,SHOE_TEXTILES,TAG_Q,TEXTURE_TYPES,TYPES,accentsFor,cleanDay,cleanRecord,cleanSettings,colOf,hexRgb,itemFields,items,labHex,matsFor,nextStamp,normCol,normColFor,normPat,ownMatName,rgbLab,settingsOpen,watchOpts,esc,inviteOver} from './core.js';
let flt='all',queue=[];const now=new Date();let view={y:now.getFullYear(),m:now.getMonth()},sel=new Date(now.getFullYear(),now.getMonth(),now.getDate());

/* storage */
// stores: items (wardrobe), days (outfit history, keyed by date), meta (key/value: deletion tombstones, settings, sync state)
/* The connection can be lost while the app runs (2026-11-14, a tester's iPhone 17 Pro: the sample wardrobe, Confirm on Add and every
   other save did nothing, and a navy suit card was left on Add at each tap): iOS Safari closes a page's database connection when the
   app has been in the background (switching to Messages for the invite link, the Share sheet), and every transaction then throws
   InvalidStateError at once, which was not seen as a storage failure, so nothing said so. Now the connection is opened again and the
   transaction retried once (dbLive, txs, atomic); a failure that remains is a storage failure and is said. `db` stays the first opening
   (start-up and safety.js wait on it). */
let dbCur=null,dbConn=null;
/* set by "Delete my data" (about.js wipeDevice) while it deletes the database: nothing may open it again and fill it (CR-7-01). A save
   asked for meanwhile waits (dbHeld): the page reloads once the database is gone, and a delete that fails lets it go on (dbUnhold). */
let dbWiping=false;const dbHeld=[];
function dbUnhold(){const h=dbHeld.splice(0);dbCur=null;if(h.length){const p=dbOpen();for(const [ok,no] of h)p.then(ok,no)}}
function dbOpen(){if(dbWiping){const p=new Promise((ok,no)=>dbHeld.push([ok,no]));dbCur=p;return p}
  const p=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe',2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});
    if(!d.objectStoreNames.contains('days'))d.createObjectStore('days',{keyPath:'date'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'})};
  r.onsuccess=()=>{const d=r.result;if(dbWiping){try{d.close()}catch{}dbHeld.push([ok,no]);return}dbConn=d;d.onclose=()=>dbDrop(d);d.onversionchange=()=>{try{d.close()}catch{}dbDrop(d)};ok(d)};r.onerror=()=>no(r.error)});
  dbCur=p;p.catch(()=>{if(dbCur===p)dbCur=null});return p}
function dbDrop(d){if(dbConn===d){dbConn=null;dbCur=null}}
const db=dbOpen();
const dbLive=()=>dbCur||dbOpen();
// the browser closed the connection (iOS Safari's "Connection to Indexed Database server lost", a closing database)
const dbGone=e=>!!e&&(e.name==='InvalidStateError'||e.name==='UnknownError'||/connection|closing|closed/i.test(e.message||''));
// run one transaction; when the connection is gone, open it again and run it once more (an aborted transaction stored nothing)
async function dbRetry(m,run){const d=await dbLive();try{return await run(d)}catch(e){
  if(!dbGone(e)||e.name==='QuotaExceededError')throw dbMark(e,m);try{d.close()}catch{}dbDrop(d);console.warn('storage connection lost: opening it again',e);
  try{return await run(await dbLive())}catch(e2){throw dbMark(e2,m)}}}
const dbMark=(e,m)=>{try{if(e&&typeof e==='object'&&!e.dwStore)e.dwStore=m==='readonly'?'read':'write'}catch{}return e};
/* a transaction that fails or is aborted (storage full) rejects with the browser's error, marked as a storage failure (safety.js shows it) */
const txFail=(t,no,m)=>ev=>{let e=t.error||(ev&&ev.target&&ev.target.error)||new Error('the browser stopped it');try{e.dwStore=m==='readonly'?'read':'write'}catch{}no(e)};
const txs=(store,m,f)=>dbRetry(m,d=>new Promise((ok,no)=>{const t=d.transaction(store,m);t.onerror=t.onabort=txFail(t,no,m);const q=f(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result)}));
const tx=(m,f)=>txs('items',m,f);
const metaGet=async k=>{const r=await txs('meta','readonly',s=>s.get(k));return r?r.v:undefined},metaPut=(k,v)=>txs('meta','readwrite',s=>s.put({k,v}));
/* ---- the connection kept in the database too (2026-11-14: on the owner's iPhone the Home Screen app's localStorage lost the server
   address and the code after the app was force-closed during an update; the database, with the wardrobe, was untouched; Safari kept
   both). A copy of these keys is kept in meta 'conn' and put back at start-up where localStorage lost them, before anything reads them
   (start.js and sync.js wait for connRestored). The copy follows localStorage: written after the restore, when Settings closes, when a
   connection is made and whenever the app goes to the background (an address cleared on purpose is copied as cleared); Delete my data
   deletes the database and the copy with it. The two automatic copies (`connKeep(true)`: after the restore, going to the background)
   only add what localStorage holds: a key missing there may be storage's loss, not a choice, and writing that absence wiped the good
   copy when the read at start-up failed or the keys went while the app was open. Clearing on purpose calls connKeep() and replaces it. ---- */
const CONN_KEEP=['worker_url','app_token','remind'];
let connReady=false;
const connNow=()=>{const v={};for(const k of CONN_KEEP){const x=localStorage.getItem(k);if(x!=null)v[k]=x}return v};
async function connKeep(addOnly){if(!connReady)return;try{if(addOnly===true)await atomic('meta','conn',r=>({put:{k:'conn',v:{...(r&&r.v||{}),...connNow()}}}));else await metaPut('conn',connNow())}catch(e){console.warn('connection copy not kept',e)}}
const connRestored=db.then(async()=>{let n=0,del=false;
  // (not during a "Delete everything" that was cut off: about.js aboutResumeDelete; its copy is replaced, so the connection stays gone)
  try{del=!!localStorage.getItem('del_pending');const v=del?null:await metaGet('conn');if(v)for(const k of CONN_KEEP)if(v[k]&&!localStorage.getItem(k)){localStorage.setItem(k,v[k]);n++}}catch(e){console.warn('connection copy not read',e)}
  connReady=true;await connKeep(!del);if(n)console.warn(`put back ${n} connection setting(s) this browser's storage had lost`);return n}).catch(()=>{connReady=true;return 0});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')connKeep(true)});
/* read-modify-write inside ONE transaction, so a sync finishing at the same moment can't overwrite it */
/* a put that throws at once (a full disk in some browsers, a value it can't store) aborts the transaction with that error, not WebKit's
   "IDBTransaction will abort due to uncaught exception" (W1-11-05) */
const atomic=(store,key,fn)=>dbRetry('readwrite',d=>new Promise((ok,no)=>{const t=d.transaction(store,'readwrite'),s=t.objectStore(store);let out,thrown=null;
  const q=s.get(key);q.onsuccess=()=>{try{out=fn(q.result);if(out&&out.put)s.put(out.put);if(out&&out.del)s.delete(key)}catch(x){thrown=x;try{t.abort()}catch{}}};t.oncomplete=()=>ok(out&&out.value);
  const fail=txFail(t,no);t.onerror=t.onabort=ev=>{if(!thrown)return fail(ev);try{thrown.dwStore='write'}catch{}no(thrown)}}));
const addTombstones=add=>atomic('meta','tombstones',r=>{const v={...(r&&r.v||{})};for(const [id,t] of Object.entries(add))v[id]=Math.max(v[id]||0,t);return {put:{k:'tombstones',v},value:v}});
/* the stored wardrobe at start-up through core.js cleanRecord/cleanDay (fix round 3, W2-13-02): a record stored before the entry check
   (a crafted Restore file or sync) is shown cleaned, and stored cleaned with its stamp unchanged (nothing to back up; the other phones
   clean their own copy), only where the check changed it; a record with no usable id or type is left out and taken out of storage.
   Every original it changes or leaves out is first kept on this phone (meta rec_kept) and the person is told once (recKeptTell).
   Once per phone (localStorage rec_clean, REC_CLEAN): every record stored since came through the check or was made by the app, and the
   check reads every photo (a few hundred ms on a large wardrobe). -> {items, days} */
const REC_CLEAN='1';
const recSame=(a,b)=>{if(!b)return false;const ka=Object.keys(a),kb=Object.keys(b);if(ka.length!==kb.length)return false;
  return ka.every(k=>a[k]===b[k]||(a[k]&&typeof a[k]==='object'&&JSON.stringify(a[k])===JSON.stringify(b[k])))};
function cleanStored(its,days){its=its||[];days=days||[];
  try{if(localStorage.getItem('rec_clean')===REC_CLEAN)return {items:its,days}}catch{}
  const ci=its.map(cleanRecord),cd=days.map(cleanDay),same=(a,b)=>!!a&&typeof a==='object'&&recSame(a,b);
  // nothing is changed in storage before every original the check would change is kept on this phone (meta rec_kept, added to, never
  // replaced): the stored copy is written only after that, and the person is told once (recKeptTell)
  const kept=[];its.forEach((it,k)=>{if(!same(it,ci[k]))kept.push({kind:'item',dropped:!ci[k],rec:it})});days.forEach((d,k)=>{if(!same(d,cd[k]))kept.push({kind:'day',dropped:!cd[k],rec:d})});
  const flag=()=>{try{localStorage.setItem('rec_clean',REC_CLEAN)}catch{}};
  if(!kept.length){flag();return {items:its,days}}
  (async()=>{const prev=await metaGet('rec_kept').catch(()=>null);await metaPut('rec_kept',[...(Array.isArray(prev)?prev:[]),...kept.map(x=>({...x,at:Date.now()}))]);
    const w=[];
    its.forEach((it,k)=>{const c=ci[k];if(same(it,c))return;const id=it&&it.id;if(id==null||typeof id==='object')return;
      w.push(atomic('items',id,cur=>cur&&stamp(cur)===stamp(it)?(c&&c.id===id?{put:c}:{del:true}):null))});
    days.forEach((d,k)=>{const c=cd[k];if(same(d,c))return;const dt=d&&d.date;if(dt==null||typeof dt==='object')return;
      w.push(atomic('days',dt,cur=>cur&&(cur.updated||0)===(d.updated||0)?(c&&c.date===dt?{put:c}:{del:true}):null))});
    await Promise.all(w);flag();recKeptTell(kept)})().catch(e=>console.warn('stored records not cleaned',e));
  return {items:ci.filter(Boolean),days:cd.filter(Boolean)}}
/* the stored settings, once per phone (localStorage set_clean, SET_CLEAN_V; fix round A, 2026-11-17, C1: a copy taken before settings were
   checked came back through takeSettings at every start): cleaned by core.js cleanSettings; in one transaction the original is added to
   meta set_kept ([{rec, at}], appended, never replaced) and the stored copy replaced with its stamps unchanged, only while it is still the
   one read (no upload of its own; the next change stamps the cleaned settings and syncs them); the person is told once.
   -> the cleaned copy for start-up */
const SET_CLEAN_V='1';
function cleanStoredSettings(st){if(!st||typeof st!=='object')return st;const c=cleanSettings(st);
  try{if(localStorage.getItem('set_clean')===SET_CLEAN_V)return c}catch{}
  const flag=()=>{try{localStorage.setItem('set_clean',SET_CLEAN_V)}catch{}};
  if(c===st){flag();return c}
  (async()=>{await txs('meta','readwrite',s=>{const r=s.get('settings'),k=s.get('set_kept');
      k.onsuccess=()=>{const prev=k.result&&k.result.v;s.put({k:'set_kept',v:[...(Array.isArray(prev)?prev:[]),{rec:st,at:Date.now()}]})};
      r.onsuccess=()=>{const cur=r.result&&r.result.v;if(cur&&(cur.updated||0)===(st.updated||0))s.put({k:'settings',v:cleanSettings(cur)})}});
    flag();const say=()=>need('toast','Some of this phone’s settings couldn’t be shown safely and were set aside. Nothing was deleted: the originals are kept on this phone.',12000);setTimeout(say,1500)})()
    .catch(e=>console.warn('stored settings not cleaned',e));
  return c}
/* said once, in plain words, whenever the start-up check set something aside (the originals stay in meta rec_kept on this phone) */
function recKeptTell(kept){const n=kept.filter(x=>x.kind==='item'&&x.dropped).length,f=kept.filter(x=>x.kind==='item'&&!x.dropped).length;if(!n&&!f)return;
  const t=(n?`${n} item${n===1?'':'s'} in this phone’s storage couldn’t be shown safely and ${n===1?'was':'were'} set aside. `:'')+(f?`Some details of ${f} item${f===1?'':'s'} couldn’t be shown safely and were set aside. `:'')+'Nothing was deleted: the originals are kept on this phone.';
  const say=()=>need('toast',t,12000);setTimeout(say,1500)}
// every local edit is timestamped and triggers a (debounced) backup; deletions leave a tombstone so they sync too
const putRaw=i=>tx('readwrite',s=>s.put(i));
/* a start-up fix-up saves an item only while it is still the copy on screen: an edit or a sync may have replaced it meanwhile, and saving the
   old copy (stamped newest) would undo that change (2026-11-14) */
const stillCur=it=>items.find(x=>x.id===it.id)===it;
/* and redraws the Wardrobe only when it is on screen and Settings is not open (renderWardrobe closes Settings; these now run after the first
   pull, which can be while Settings is open); the Wardrobe is drawn afresh when it is opened */
const fixupRedraw=()=>{if(settingsOpen())return;const w=$('#wardrobe');if(w&&!w.hidden)emit('wardrobe-changed')};
const put=i=>{i.updated=nextStamp(stamp(i));askFor('kit-user-edit',i);   // (an edit in the item sheet makes a sample piece his: kit.js)
// the fields changed since the stored copy get the edit's stamp, in the same transaction (core.js itemFields: two phones' changes to
// different fields of one piece both stay, fix round 3; the stamp is nextStamp's, made one above the stored copy's only when it isn't)
const r=atomic('items',i.id,cur=>{itemFields(i,cur);return {put:i}});r.then(()=>{askFor('sync-soon')});return r};
// (the deletion's stamp is above the item's own, so it wins whatever the clocks say: core.js nextStamp; returned for an Undo)
const del=async id=>{const was=items.find(x=>x.id===id),t=nextStamp(stamp(was));await tx('readwrite',s=>s.delete(id));await addTombstones({[id]:t});askFor('sync-soon');return t};


/* precision swatch: a 128 px square of the cloth, cut from the fabric close-up when the card has one (the cloth up close, white-
   balanced), else from the item photo; the Add card's sliders choose the zoom and the spot. Items with a close-up show it as their
   small fabric square across the app (swatchSVG in draw.js). */
function cropSwatch(canvas,zoom=1,cx=.5,cy=.5,light){
  const sampleSize=Math.min(canvas.width,canvas.height)*(0.5/(Number(zoom)||1)),o=document.createElement('canvas');o.width=o.height=128;
  const sx=Math.max(0,Math.min(canvas.width-sampleSize,(Number(cx)||.5)*canvas.width-sampleSize/2)),sy=Math.max(0,Math.min(canvas.height-sampleSize,(Number(cy)||.5)*canvas.height-sampleSize/2));
  const g=o.getContext('2d');if(!g)return null;   // a phone out of picture memory gives no context: no swatch, the item still saves (2026-11-16)
  g.drawImage(canvas,sx,sy,sampleSize,sampleSize,0,0,128,128);if(deadCanvas(o))return null;   // drawn black: no swatch (callers keep the one they had)
  if(light)matchLight(o,light);return o.toDataURL('image/jpeg',SW_Q)}
/* a small JPEG (2026-11-15, the owner's option A for the server's writes): a 128 px PNG of cloth was about 38 KB, too big to keep in
   the backup's own text, so every new item cost one more server write for its swatch; as a JPEG it is a few KB, under sync-photos.js PH_MIN,
   and rides inside the backup. Swatches saved before as PNG stay as they are (still shown, still synced by reference) */
const SW_Q=.8;
/* a close-up's exposure says little (a white shirt shot in dim light reads grey): the swatch's lightness is set from the tagged colour,
   keeping the close-up's texture (each pixel's lightness above or below the cloth's median) and its hue. Near white, the texture's
   swing is narrowed so the lightest threads stay under paper white instead of clipping. */
function matchLight(o,hex){const x=o.getContext('2d',{willReadFrequently:true}),D=x.getImageData(0,0,o.width,o.height),d=D.data,n=d.length/4,lab=new Array(n);
  for(let i=0;i<n;i++)lab[i]=rgbLab(d[4*i],d[4*i+1],d[4*i+2]);
  const Ls=lab.map(l=>l[0]).sort((a,b)=>a-b),med=Ls[n>>1],hi=Ls[Math.floor(n*.97)]-med,lo=med-Ls[Math.floor(n*.03)],Lt=rgbLab(...hexRgb(hex))[0];
  const s=Math.min(1,hi>0?Math.max(.25,(99.5-Lt)/hi):1,lo>0?Math.max(.25,(Lt-.5)/lo):1);
  for(let i=0;i<n;i++){const [L,a,b]=lab[i],c=hexRgb(labHex([Math.max(0,Math.min(100,Lt+(L-med)*s)),a,b]));d[4*i]=c[0];d[4*i+1]=c[1];d[4*i+2]=c[2]}
  x.putImageData(D,0,0)}
function generateSwatch(q){
  const canvas=q.texCanvas||q.big;if(!canvas)return '';
  const sw=cropSwatch(canvas,q.zoom,q.cx,q.cy,q.texCanvas&&q.primaryColor?colOf(q):null);if(!sw)return q.swatch||'';
  q.swatch=sw;q.swSrc=q.texCanvas?'tex':'photo';
  return q.swatch;
}
/* a saved item's swatch, cut from the middle of its close-up (or, without one, its photo) */
async function refreshSwatch(it){if(!FABRIC.includes(it.type))return;const src=it.texture&&TEXTURE_TYPES.includes(it.type)?it.texture:it.photo;if(!src){delete it.swatch;delete it.swSrc;return}
  try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
    const tex=src!==it.photo,sw=cropSwatch(c,1,.5,.5,tex&&it.primaryColor?colOf(it):null);if(!sw){console.warn('swatch not cut: drawn black');return}
    it.swatch=sw;it.swSrc=tex?'tex':'photo'}catch(e){console.warn('swatch not cut',e)}}
/* once: items that already have a close-up get their swatch cut from it, lightness set from the tagged colour (tex_swatch2) */
async function texSwatches(){if(localStorage.getItem('tex_swatch2')==='1')return 0;let n=0;
  for(const it of items)if(it.texture&&TEXTURE_TYPES.includes(it.type)){await refreshSwatch(it);if(it.swSrc==='tex'&&stillCur(it)){await put(it);n++}}
  localStorage.setItem('tex_swatch2','1');if(n)need('plan-dirty');return n}

function updateSwatchParam(i, param, val){
  queue[i][param]=Number(val);
  generateSwatch(queue[i]);
  const swEl=$(`#swatch-img-${i}`);
  if(swEl) swEl.style.backgroundImage=`url(${queue[i].swatch})`;
}

let aiError='',aiModel='';
/* ---- working on it: while a call to Claude or OpenAI runs (tagging, reading a pattern, making an item picture), a spinning pill
   at the top of the screen says what is happening. Every call
   to the worker's AI endpoints goes through fetch, so one hook catches them all, including new ones. ---- */
const busyJobs=new Map();let busySeq=0;
function busyStart(label){const id=++busySeq;busyJobs.set(id,label);renderBusy();return ()=>{busyJobs.delete(id);renderBusy()}}
function busyLabelFor(u,o){if(!o||String(o.method||'GET').toUpperCase()!=='POST')return null;const w=localStorage.getItem('worker_url');if(!w)return null;
  let a,b;try{a=new URL(u,location.href);b=new URL(w.replace(/\/*$/,'/'))}catch{return null}if(a.origin!==b.origin)return null;
  const p=a.pathname.replace(b.pathname,'/').replace(/\/+$/,'')||'/',body=typeof o.body==='string'?o.body.slice(0,4000):'';
  if(p==='/')return 'Claude is tagging the photo…';if(p==='/tag-many')return 'Claude is finding the items…';if(p==='/pattern')return 'Claude is reading the pattern…';
  if(p==='/describe')return /"what":"both"/.test(body)?'Claude is reading the color and texture…':/"what":"pattern"/.test(body)?'Claude is working out the weave…':'Claude is finding the shade…';   // (both: Read color and texture, CR-2-09)
  if(p==='/render')return /"mode":"item"/.test(body)?'Making the item picture…':null;   // (item pictures: the only thing POST /render makes now)
  return null}
if(typeof window!=='undefined'&&window.fetch&&!/** @type {any} */(window.fetch).busy){const f0=window.fetch.bind(window);
  window.fetch=function(u,o){const l=busyLabelFor(typeof u==='string'?u:u&&/** @type {Request} */(u).url,o);if(!l)return f0(u,o);const end=busyStart(l);const r=f0(u,o);r.then(end,end);return r};/** @type {any} */(window.fetch).busy=1}
function renderBusy(){let el=document.getElementById('busy');if(!el){if(!document.body)return;el=document.createElement('div');el.id='busy';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}
  const live=[...busyJobs.values()];
  document.body.classList.toggle('busy-on',!!live.length);if(!live.length){el.classList.remove('on');return}
  el.innerHTML=`<span class="spin" aria-hidden="true"></span><span>${esc(live[live.length-1])}${live.length>1?` <small>+${live.length-1}</small>`:''}</span>`;el.classList.add('on')}
/* the tab bar grows upward until its top is one design gap (--gap, 12px) below Today's below-the-waist tiles, so nothing peeks out
   between them (the score card's top used to); at most 64px, and never shorter than its 38px buttons. Measured with the page at the
   top, from where the tiles end and where the bar's natural top is; kept while on other pages and on days whose tiles sit lower. */
const NAV_MAX=58;   // (the bar is 44px at least since 2026-11-14, a tap target's size; it was 38 and grew up to 64, so the tallest is the same 102)
function fitNav(){const b=document.querySelector('#today:not([hidden]) .below'),nav=document.querySelector('body>nav');if(!nav)return;
  // the fit is measured only on a day whose photo has loaded: before it loads the photo has no height, the tiles sit right under the
  // date, and the bar grew to its 64px cap (and was kept there). That measurement is kept per screen size and used everywhere else
  // (a day with only the drawing and its Generate button, whose tiles sit lower; a weekend with no tiles), so the bar keeps one size.
  const k='nav_fit2:'+innerWidth+'x'+innerHeight;let kept=0;try{kept=+localStorage.getItem(k)||0}catch{}
  const img=/** @type {HTMLImageElement} */(document.querySelector('#today:not([hidden]) #mannequin-container > img')),ready=!!(b&&img&&img.complete&&img.naturalHeight>0&&img.getBoundingClientRect().height>60);
  let x=kept;
  if(ready){const gap=parseFloat(getComputedStyle(document.querySelector('#today')).getPropertyValue('--gap'))||12;
    const cs=getComputedStyle(nav),natural=innerHeight-44-(parseFloat(cs.paddingBottom)||0)-(parseFloat(cs.borderTopWidth)||0);   // the bar's top without the growth (not measured: its height may be mid-transition)
    // always as if the row had three tiles (belt, shoes, socks): with four (trousers on a blazer day, a coat) each is narrower, and a
    // tile with a product picture (its picture's height follows its width, its label doesn't) is shorter, which made the bar taller on those days; a drawn
    // tile keeps its height whatever the count
    const r=b.getBoundingClientRect(),cg=parseFloat(getComputedStyle(b).columnGap)||8,w3=(r.width-2*cg)/3;
    const h3=Math.max(0,...[...b.querySelectorAll('.tile')].map(t=>{const q=t.getBoundingClientRect(),im=t.querySelector('.item-pic');if(!t.classList.contains('has-pic')||!im)return q.height;
      const ar=im.getBoundingClientRect(),k=ar.width?ar.height/ar.width:.75;return q.height+(w3-q.width)*k}));   // the picture keeps its shape (4:3 in styles.css): it grows with the width
    x=Math.max(0,Math.min(NAV_MAX,Math.round(natural-(r.top+scrollY+h3+gap))));if(x!==kept)try{localStorage.setItem(k,String(x))}catch{}}
  const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navx'))||0;
  if(Math.abs(x-cur)>=1)document.documentElement.style.setProperty('--navx',x+'px')}
try{for(const k of Object.keys(localStorage))if(k.startsWith('nav_fit:'))localStorage.removeItem(k)}catch{}   // the first version could keep a 64px fit measured before the photo loaded
let fitNavRaf=0;const fitNavSoon=()=>{cancelAnimationFrame(fitNavRaf);fitNavRaf=requestAnimationFrame(fitNav)};
if(typeof ResizeObserver!=='undefined')addEventListener('DOMContentLoaded',()=>{const t=document.querySelector('#today');if(t)new ResizeObserver(fitNavSoon).observe(t)});
addEventListener('resize',fitNavSoon);
/* run once every script has loaded: the start-up chain can resolve before the photo tagging files (tag-request.js … pattern-read.js, loaded after app.js) have run */
const afterScripts=f=>document.readyState==='complete'?f():addEventListener('load',()=>f(),{once:true});
// once every script of the page has run (DOMContentLoaded comes after the last one, and unlike load it doesn't wait for pictures).
// Its own flag, not document.readyState: the page's scripts are deferred, and while deferred scripts run readyState is already
// 'interactive' (it was 'loading' while plain scripts ran), so reading it would run f before the later scripts.
let domDone=false;addEventListener('DOMContentLoaded',()=>{domDone=true},{once:true});
const afterDom=f=>domDone?f():addEventListener('DOMContentLoaded',()=>f(),{once:true});
const aiLabel=q=>!q.ai?'Not tagged by AI: fill in the details.':/^claude/.test(q.model||'')?'Tagged by Claude.':'Tagged by AI.';   // (no model name: a tester read "Tagged by Claude (claude-mock)")
/* tag one item: its photo (a data URL, or a canvas), plus the close-up, the measurement and the rest (tagExtras in tag-request.js).
   forType: fit the colours and pattern to this type (the card's own, when tagging again or Ask Claude) instead of the one Claude answers
   (CR-2-04). out: an object that gets this call's own failure, out.err = {note, why, net} (CR-2-07: several readings run at once, and the
   shared aiError / tagWhy / tagNetLast, still set for the Add page's note, could hold another card's reason by the time it was read) */
async function ask(c,extra){
  const {signal,forType,out,...ex}=extra||{};   // signal: Stop on an Add card calls the reading off (add.js stopRead)
  const fail=note=>{aiError=note;if(out)out.err={note,why:(w=>typeof w==='string'?w:'')(askFor('tag-why')),net:!!askFor('tag-net-last')};return null};
  try {
    const workerUrl=localStorage.getItem('worker_url');
    if(!workerUrl) return null;
    if(inviteOver())return null;   // an ended invitation: the photo isn't sent (it was, and refused; re-audit 2026-11-15)
    const dataUrl=typeof c==='string'?c:c.toDataURL('image/jpeg',TAG_Q);
    const res=await fetch(workerUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-app-token':localStorage.getItem('app_token')||''},   // (the code goes in the header only: the worker hasn't read a body appToken since 2026-11-12)
      body:JSON.stringify({image:dataUrl,...need('tag-extras',ex)}),
      ...(signal?{signal}:{})
    });
    if(!res.ok){let e='',j={};try{j=await res.json();e=j.detail||j.error||''}catch{}
      if(typeof endedAnswer==='function'&&endedAnswer(res.status,j)){inviteEnded(localStorage.getItem('app_token')||'',j);aiError='';return null}   // found out here: said as ended (sync.js), the card has no Try again
      return fail(need('tag-fail-text',res.status,j,e))}
    aiError='';
    const result=await res.json();aiModel=result.model||'';
    return normTag(result,result.model,forType);   // (the worker parses Claude's answer itself: the old Workers AI text shape is gone)
  } catch(e) {
    if(e&&e.name==='AbortError')return null;   // stopped on purpose: no failure to report
    return fail(need('tag-fail-text',0,null,e));
  }
}
/* an AI tag -> the fields the Add form uses (type-checked, colours and patterns normalised) */
const ownColorsOf=o=>{const f=c=>c&&/^#[0-9a-f]{6}$/i.test(c.hex||'')&&/[a-z]{2}/i.test(c.name||'')?{name:String(c.name).toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim().slice(0,24),hex:c.hex.toLowerCase()}:null;
  return o&&typeof o==='object'&&f(o.primary)?{primaryColor:f(o.primary),secondaryColor:f(o.secondary),tertiaryColor:f(o.tertiary)}:null};
/* Claude's material -> {key, conf, why} (+ new:true for one on no list, 2026-11-16), or null. On the type's list or the person's own: any
   confidence (low is shown as a guess, never filled in: tagging.js takeMaterial); a new one only at medium or high, with a valid name */
const matTag=p=>{const m=p&&p.material,t=TYPES[p&&p.type]?p.type:'suit',k=m&&typeof m==='object'?String(m.key||'').toLowerCase().replace(/\s+/g,' ').trim():'';
  if(!k||k==='none'||!MATERIALS_BY[t])return null;const conf=['high','medium','low'].includes(m.confidence)?m.confidence:'low',why=String(m.why||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,160);
  if(matsFor(t).includes(k))return {key:k,conf,why};
  const n=ownMatName(k);return n&&m.new===true&&conf!=='low'?{key:n,conf,why,new:true}:null};
/* forType (ask's, CR-2-04): the type the colours, pattern and material are fitted to; `type` stays Claude's answer (tagging again offers it) */
function normTag(parsed,model,forType){const ft=TYPES[forType]?forType:parsed.type;
    return sockTag(ft,parsed,{
      type:TYPES[parsed.type]?parsed.type:'suit',
      pattern:normPat(TYPES[ft]?ft:'suit',parsed.pattern),
      primaryColor:normColFor(ft,parsed.primaryColor||parsed.color)||'grey',
      secondaryColor:normColFor(ft,parsed.secondaryColor,true),
      tertiaryColor:normColFor(ft,parsed.tertiaryColor,true),
      metal:METAL[parsed.metal]?parsed.metal:'silver',
      leather:[...LEATHERS,...SHOE_TEXTILES,...SHOE_NAP,...BELT_MATS].includes(String(parsed.leather||'').toLowerCase().replace(/\s+/g,'-'))?String(parsed.leather).toLowerCase().replace(/\s+/g,'-'):null,
      trouserKind:['chinos','jeans','dress','cargo'].includes(parsed.trouserKind)?parsed.trouserKind:null,shoeStyle:SHOE_STYLES.some(([k])=>k===parsed.shoeStyle)?parsed.shoeStyle:null,
      model:model||'',
      dial:normCol(parsed.dial),band:['bracelet','leather','rubber','nato'].includes(parsed.band)?parsed.band:null,
      // the material Claude suggests (2026-11-15, worker cleanMaterial): from the type's list or the person's own (low kept as a guess), or a new one (matTag)
      material:matTag(TYPES[forType]?{...parsed,type:forType}:parsed),
      // the colours beyond the three (2026-11-16, the worker's accents: cleaned there; made the card's own in fill / refineApply, core.js accentsFor); null from an older worker
      accents:Array.isArray(parsed.accents)?parsed.accents.filter(c=>typeof c==='string').slice(0,ACCENT_MAX):null,bezel:['fluted','smooth'].includes(parsed.bezel)?parsed.bezel:null,
      // how sure it was, its runner-up, and what it would add when nothing listed fits (single-item tags)
      conf:parsed.confidence&&typeof parsed.confidence==='object'?parsed.confidence:null,
      altColor:normColFor(ft,parsed.altColor),altPattern:parsed.altPattern&&parsed.altPattern!=='none'&&(PATS_BY[ft]||[]).includes(parsed.altPattern)?parsed.altPattern:null,
      newColor:parsed.newColor&&parsed.newColor.name?parsed.newColor:null,newPattern:parsed.newPattern&&parsed.newPattern.name?parsed.newPattern:null,
      clothBox:parsed.clothBox&&typeof parsed.clothBox==='object'?parsed.clothBox:null,
      patternBox:parsed.patternBox&&typeof parsed.patternBox==='object'?parsed.patternBox:null,weave:parsed.weave&&typeof parsed.weave==='object'?parsed.weave:null,
      // Claude's own colour names and shades, not limited to the list (only when asked with freeColors: colpick.js)
      ownColors:ownColorsOf(parsed.ownColors),
      // Claude's own name and description of the pattern, and whether the listed one fits it (only with freePattern)
      ownPattern:parsed.ownPattern&&typeof parsed.ownPattern==='object'&&/[a-z]{2}/i.test(parsed.ownPattern.name||'')?{name:String(parsed.ownPattern.name).toLowerCase().replace(/[^a-z0-9 '&-]/g,'').replace(/\s+/g,' ').trim().slice(0,60),description:String(parsed.ownPattern.description||'').slice(0,300),fits:parsed.ownPattern.fits===true}:null
    });
}
/* a sock's toe cap (2026-11-17, sock patterns): the worker's toeColor; a worker from before (no toeColor in the answer) still put the toe cap
   in secondaryColor, and had no sock patterns, so there the second colour is the toe cap and the sock has no pattern colours */
function sockTag(ft,parsed,t){if(ft!=='socks')return t;
  if('toeColor' in parsed)return {...t,toeColor:normColFor('socks',parsed.toeColor,true)};
  return {...t,toeColor:t.secondaryColor,secondaryColor:null,tertiaryColor:null}}

/* the picture of a file; its object URL is let go once it has loaded (each one held the file's bytes until the page closed) */
/* a picture from its address, loaded (moved here from item-photo.js, the restructure S3d: app.js, the readings and the photo tools load with it) */
const imgOf=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src});
const loadImg=f=>new Promise((ok,no)=>{const i=new Image(),u=URL.createObjectURL(f);i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=e=>{URL.revokeObjectURL(u);no(e)};i.src=u});
// on white: a transparent picture (a product cut-out) is saved as a JPEG, which has no transparency, and its clear parts turned black
// (2026-11-14, the owner's socks); white is what such a cut-out is meant to sit on, and reads as the white reference it is
/* a canvas the browser drew as pure black (2026-11-15, the owner's desktop browser: once its graphics failed every picture drawn came out
   black, and a crop and a swatch were saved that way): every pixel's channels at most DEAD_MAX, read at 16x16. A real photo of black cloth
   still has texture and noise well above it (his Black suit's darkest swatch reads up to 26) */
const DEAD_MAX=3,DEAD_MSG='Your browser stopped drawing pictures (its graphics failed), so nothing was saved. Reload the page and try again.';
function deadCanvas(c){try{const N=16,t=document.createElement('canvas');t.width=t.height=N;const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,N,N);
  const d=x.getImageData(0,0,N,N).data;for(let k=0;k<d.length;k+=4)if(d[k]>DEAD_MAX||d[k+1]>DEAD_MAX||d[k+2]>DEAD_MAX)return false;return true}catch{return false}}
async function deadPic(url){try{const im=await imgOf(url);return deadCanvas(im)}catch{return false}}
function shrink(img,max){const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);return c}

async function fill(q,ai){
  q.zoom=1; q.cx=0.5; q.cy=0.5;
  generateSwatch(q);
  q.ai=!!(ai&&ai.type);q.model=ai&&ai.model||'';
  q.type=q.ai?ai.type:'suit';
  q.primaryColor=ai&&COLORS[ai.primaryColor]?ai.primaryColor:'grey';
  q.secondaryColor=ai&&ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null;
  q.tertiaryColor=ai&&ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null;
  q.pattern=ai?normPat(q.type,ai.pattern):'solid';
  q.toeColor=ai&&ai.toeColor||null;   // a sock's toe cap (normTag's sockTag)
  {const a=ai&&ai.accents?accentsFor(q,ai.accents):[];if(a.length)q.accents=a;else delete q.accents}   // Claude's colours beyond the three
  q.metal=ai&&METAL[ai.metal]?ai.metal:'silver';
  q.leather=ai&&ai.leather||'calf';q.trouserKind=ai&&ai.trouserKind||'dress';q.shoeStyle=ai&&ai.shoeStyle||'oxford';
  const wo=watchOpts(ai||{});q.dial=wo.dial;q.band=wo.band;q.bezel=wo.bezel;q.watchStyle=wo.style;
}


const cap1=t=>{t=String(t??'');return t&&t[0].toUpperCase()+t.slice(1)};   // option labels start with a capital ("Grey", "Solid"); values stay as they are
const S=(list,v,k,at)=>`<select data-act-change="cardSel" ${at} data-f="${k}">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select>`;


/* ---- what a screen reader hears, and where the keyboard stays, when part of the page is drawn again (fix round 3, W2-19-01: after
   Next day, the Wore pill or a pick, the control pressed was replaced by the redraw, focus fell to <body>, and nothing said the outfit
   had changed) ----
   announce(text): said once by the polite live region #sr-live (index.html; out of sight). Emptied first, then written in the next
   frame, so the same words are said again.
   keepFocus(root, draw): runs draw(); when the focus was on a control inside root that the redraw replaced, the control with the same
   id, or else the same handler (onclick / onchange / oninput, or data-act and its data-* arguments) and data-k / data-c, gets it back (the same words first when there are
   several). Here, not in ui.js: Today is drawn by the start-up chain, which can run before ui.js has loaded. */
let srLiveT=0;
function announce(text){const el=document.querySelector('#sr-live');if(!el)return;const t=String(text||'').replace(/\s+/g,' ').trim();clearTimeout(srLiveT);el.textContent='';
  if(t)srLiveT=setTimeout(()=>{el.textContent=t},60)}
const FOCUS_ATTRS=['onclick','onchange','oninput','data-k','data-c','data-s'];
/* a control that names its handler with data-act (act.js) is told apart as an inline one was by its handler's text (the function and its
   arguments): by its handlers' names, then by every data-* it carries (its arguments). focusActs -> [the data-act… attributes, all its
   data-* attributes], both '' for a control without data-act */
function focusActs(el){const a=[],n=[];for(const x of el.attributes)if(x.name.startsWith('data-')){a.push(x.name+'='+x.value);if(x.name.startsWith('data-act'))n.push(x.name+'='+x.value)}
  return n.length?[n.sort().join('\n'),a.sort().join('\n')]:['','']}
const focusAt=el=>[...FOCUS_ATTRS.map(a=>el.getAttribute(a)||''),...focusActs(el)];
function focusKey(el){if(!el||el===document.body||!el.tagName)return null;
  return {el,id:el.id||'',tag:el.tagName,at:focusAt(el),label:el.getAttribute('aria-label')||'',text:(el.textContent||'').trim().slice(0,60)}}
function focusFind(root,k){if(!k||!root)return null;
  if(k.id){const e=document.getElementById(k.id);if(e&&root.contains(e))return e}
  if(!k.at.some(Boolean))return null;
  // the same handlers and data-k / data-c / data-s; then the same arguments too. Without those a data-act control is found only by
  // data-k / data-c / data-s, as before (a control that keeps a state in a data-* is still found by them)
  const N=FOCUS_ATTRS.length,cand=[...root.querySelectorAll(k.tag)].map(e=>[e,focusAt(e)]).filter(([,at])=>at.slice(0,N+1).every((v,j)=>v===k.at[j]));
  const exact=cand.filter(([,at])=>at[N+1]===k.at[N+1]),same=(exact.length?exact:k.at.slice(0,N).some(Boolean)?cand:[]).map(x=>x[0]);
  return same.find(e=>(e.getAttribute('aria-label')||'')===k.label&&(e.textContent||'').trim().slice(0,60)===k.text)||same.find(e=>(e.getAttribute('aria-label')||'')===k.label)||same[0]||null}
/* a control whose focus opens the phone's own picker (a select's list, a date wheel) is never focused by code after a touch: iOS opened
   the picker again right after each choice (the owner's bug, CR-1-01: every dropdown on Add without a photo and in the item sheet).
   After a touch the focus goes to its section's head button (.ckh, which reads the new value), else its label; after a key press
   (a keyboard, where focus opens nothing) the new control itself keeps it, as before. focusVia: how the last input came. */
let focusVia='pointer',focusWatchOn=false;
function focusWatch(){if(focusWatchOn)return;focusWatchOn=true;const tap=()=>{focusVia='pointer'};
  for(const t of ['pointerdown','touchstart','mousedown'])document.addEventListener(t,tap,{capture:true,passive:true});
  document.addEventListener('keydown',()=>{focusVia='key'},true)}
const focusOpens=e=>e.tagName==='SELECT'||e.tagName==='INPUT'&&/^(date|time|month|week|datetime-local|color|file)$/i.test(e.getAttribute('type')||'');   // (the type written: a browser without date fields reports 'text')
function focusSafe(e){if(!focusOpens(e)||focusVia==='key')return e;
  const sec=e.closest('section'),h=sec&&sec.querySelector('.ckh');if(h)return h;
  const lab=e.closest('label');if(lab){lab.tabIndex=-1;return lab}return null}
function keepFocus(root,draw){focusWatch();const a=document.activeElement,k=root&&a&&a!==document.body&&root.contains(a)?focusKey(a):null;
  const r=draw();
  if(k&&!(k.el.isConnected&&root.contains(k.el))){const f=focusFind(root,k),e=f&&focusSafe(f);if(e&&!e.closest('[inert]'))try{e.focus({preventScroll:true})}catch{}}
  return r}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setSel(v){sel=v}
function setView(v){view=v}
function setFlt(v){flt=v}
function setAiError(v){aiError=v}
function setAiModel(v){aiModel=v}
function setConnReady(v){connReady=v}
function setDbConn(v){dbConn=v}
function setDbCur(v){dbCur=v}
function setDbWiping(v){dbWiping=v}
/* (moved from add-ids.js with its text unchanged, the restructure S6a) */
/* a card by its id (Confirm, Save all) or, as before, its place (the sample, the import, tests) */
const cardOf=k=>typeof k==='string'?queue.find(q=>q.id===k):queue[k];
/* every handler drawn on a card finds it by its id when tapped (CR-1-08): qAt(id) is the card's place in the list at that moment (-1 once
   gone), qh(q) writes that call into the markup; a place written in when the card was drawn pointed at another card once the list moved */
const qAt=id=>queue.findIndex(q=>q.id===id);
/* a data-act control (act.js) carries its card's id as data-card (cardAt(q) writes it); cardIx(el) is that card's place, as qAt('id') was */
const cardAt=q=>`data-card="${esc(q.id)}"`;
const cardIx=el=>qAt(el.dataset.card);
/* (moved from who.js with its text unchanged, the restructure S6a) */
/* an invitation that was switched off: said once, and the app stops trying (localStorage.invite_ended holds that code) */
const ENDED='Your invitation has ended. Your wardrobe stays on this phone, and the app keeps working without a connection.';
/* (j: the server's answer) a tester's code the server doesn't know at all (403 'forbidden token': its storage was lost, or the account
   deleted) is also marked invite_lost: the server holds no copy of this phone's wardrobe, so a new invitation link keeps the wardrobe and
   backs it up there instead of clearing it (account.js connectFromLink; 2026-11-15, the audit: nothing said how to recover) */
function inviteEnded(token,j){if(j&&j.error==='forbidden token')try{localStorage.setItem('invite_lost',token)}catch{}
  if(localStorage.getItem('invite_ended')===token)return;localStorage.setItem('invite_ended',token);need('tell',endedTold(j));
  emit('invite-ended')}   // what said "Connected" and "backed up" says so too: the Backup line (sync-status.js) and the account box (account.js), through bus.js
/* what the one-time message says (fix round 3): a link the owner replaced with a new one (worker/people.js, 'invite off' with replaced) says the
   new link opens the same wardrobe; an account deleted (W1-6-03: after Delete everything on another phone this phone only heard "Your
   invitation has ended") says the backup was deleted; else ENDED */
const ENDED_NEW='Your invitation link was replaced by a new one. Ask the person who invited you for it: it opens the same wardrobe. Until then your wardrobe stays on this phone.';
const ENDED_GONE='Your wardrobe’s backup on the server was deleted, from another phone or by the person who invited you, so this invitation no longer works. Your wardrobe stays on this phone, and the app keeps working without a connection.';
const endedTold=j=>j&&j.replaced?ENDED_NEW:j&&j.error==='forbidden token'?ENDED_GONE:ENDED;
/* the server's answer means this invitation is over: switched off (403 'invite off'), or, for a tester, deleted (the account deleted
   on another phone, or its data deleted by the owner: the code is unknown, 403 'forbidden token'). A tester's phone said "Backups aren't
   available on this server yet" and kept trying. For the owner a refused code is a typing mistake, said as it is. */
const endedAnswer=(status,j)=>status===403&&!!j&&(j.error==='invite off'||j.error==='forbidden token'&&served('is-tester')&&askFor('is-tester'));
/* (moved from safety.js with its text unchanged, the restructure S6a) */
function storeFailure(e){if(!e)return false;if(e.dwStore||e.name==='QuotaExceededError')return true;const t=e.target;
  return !!(t&&typeof IDBRequest!=='undefined'&&(t instanceof IDBRequest||t instanceof IDBTransaction))}
const storeErr=e=>e&&(e.name||e.message?e:e.target&&e.target.error)||{};
const storeFull=e=>{const x=storeErr(e);return x.name==='QuotaExceededError'||/quota|disk is full|no space/i.test(x.message||'')};
// the sentence a person reads
function storeFailText(e){const x=storeErr(e),why=String(x.message||'').trim().replace(/\.$/,'');
  if(storeFull(e))return 'Couldn’t save: your phone’s storage is full. Free some space, then try again.';
  if(dbGone(x))return 'Couldn’t save: your phone closed the app’s storage. Close the app fully and open it again.';
  if(e&&e.dwStore==='read')return `Couldn’t read your wardrobe${why?': '+why:''}. Close the app and open it again.`;
  return `Couldn’t save: ${why||'the browser stopped it'}. Try again.`}
/* (moved from item-view.js with its text unchanged, the restructure S6a) */
let editing=null;
/* the setter item-view.js calls to assign editing (it opens, steps and closes the sheet) */
function setEditing(v){editing=v}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,busyLabelFor,cropSwatch,fitNav,get sel(){return sel},set sel(v){sel=v},get view(){return view},set view(v){view=v},get flt(){return flt},set flt(v){flt=v},get queue(){return queue},set queue(v){queue=v},addTombstones,S,ask,atomic,deadCanvas,deadPic,del,fill,generateSwatch,imgOf,normTag,putRaw,refreshSwatch,shrink,updateSwatchParam,db,get dbConn(){return dbConn},put,afterDom,connKeep,connRestored,metaGet,metaPut,texSwatches,tx,txs,qAt,cardIx,cardOf,get editing(){return editing},set editing(v){editing=v}};
export {flt,queue,view,sel,dbCur,dbConn,dbWiping,dbUnhold,db,dbGone,dbRetry,dbMark,txFail,txs,tx,metaGet,metaPut,connReady,connKeep,connRestored,atomic,addTombstones,cleanStored,cleanStoredSettings,putRaw,stillCur,fixupRedraw,put,del,cropSwatch,generateSwatch,refreshSwatch,texSwatches,updateSwatchParam,aiError,aiModel,busyLabelFor,fitNav,fitNavSoon,afterScripts,afterDom,aiLabel,ask,normTag,imgOf,loadImg,DEAD_MSG,deadCanvas,deadPic,shrink,fill,cap1,S,announce,keepFocus,setSel,setView,setFlt,setAiError,setAiModel,setConnReady,setDbConn,setDbCur,setDbWiping,ENDED,inviteEnded,endedAnswer,storeFailure,storeFailText,cardOf,qAt,cardAt,cardIx,editing,ENDED_NEW,ENDED_GONE,endedTold,storeErr,storeFull,setEditing};
serve('announce',announce);serve('conn-keep',connKeep);serve('meta-get',metaGet);serve('meta-put',metaPut);serve('sel-day',()=>sel);serve('after-dom',afterDom);serve('after-scripts',afterScripts);serve('stored-clean',cleanStored);serve('stored-settings-clean',cleanStoredSettings);serve('conn-restored',()=>connRestored);serve('sel-set',setSel);serve('view-set',setView);serve('tex-swatches',texSwatches);serve('tx',tx);serve('txs',txs);   // the restructure S6b: what required and today-no-picture files ask of this file (bus.js need)
serve('ended-answer',endedAnswer);serve('invite-ended',inviteEnded);   // the restructure S6f: photo-keys.js (it loads before this file) hears an ended invitation
