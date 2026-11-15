/* Daily Wardrobe: data safety (loaded after app.js). A save that fails says so; storage that can't be opened says so instead of
   showing an empty wardrobe; the browser is asked to keep the wardrobe; kept tagging copies of deleted items are removed;
   a photo that couldn't be tagged says why and can be tried again; unsaved Add cards guard the page; a device new to a
   backup takes the backup's settings. */

/* ---- storage failures ---- */
// is this error (or IndexedDB error event) a failure of the device's storage: marked by txs/atomic in app.js, a full disk, or a failed request
function storeFailure(e){if(!e)return false;if(e.dwStore||e.name==='QuotaExceededError')return true;const t=e.target;
  return !!(t&&typeof IDBRequest!=='undefined'&&(t instanceof IDBRequest||t instanceof IDBTransaction))}
const storeErr=e=>e&&(e.name||e.message?e:e.target&&e.target.error)||{};
const storeFull=e=>{const x=storeErr(e);return x.name==='QuotaExceededError'||/quota|disk is full|no space/i.test(x.message||'')};
// the sentence a person reads
function storeFailText(e){const x=storeErr(e),why=String(x.message||'').trim().replace(/\.$/,'');
  if(storeFull(e))return 'Couldn’t save: your phone’s storage is full. Free some space, then try again.';
  if(typeof dbGone==='function'&&dbGone(x))return 'Couldn’t save: your phone closed the app’s storage. Close the app fully and open it again.';
  if(e&&e.dwStore==='read')return `Couldn’t read your wardrobe${why?': '+why:''}. Close the app and open it again.`;
  return `Couldn’t save: ${why||'the browser stopped it'}. Try again.`}
let storeToldAt=0;
// tell the person a save failed (one failed save can reject more than one promise: said once)
function saveFailed(e){console.warn('storage failure',e);if(dbDown)return;const now=Date.now();if(now-storeToldAt<1500)return;storeToldAt=now;toast(storeFailText(e),7000)}

/* whether the wardrobe's storage opened: known before any later script's own wait on it fails */
let dbDown=null,dbErr=null;
db.then(()=>{dbDown=false},e=>{dbDown=true;dbErr=e});
/* a storage failure nobody caught is shown; every other rejection is left alone */
addEventListener('unhandledrejection',ev=>{const e=ev.reason;errNote(e);
  if(dbDown){if(e===dbErr||storeFailure(e))ev.preventDefault();return}   // the full-page message already says it
  if(storeFailure(e)){ev.preventDefault();saveFailed(e)}else errTell(e)});
addEventListener('error',ev=>{const e=ev.error||ev.message;if(ev.target&&ev.target!==window)return;errNote(e);errTell(e)});   // (a picture that didn't load is not an error here)

/* ---- nothing fails silently (2026-11-14, after a tester's buttons did nothing on an iPhone): an error nobody caught within ERR_TAP_MS of a
   tap says so, and every one is noted on the phone (localStorage err_log, the last ERR_MAX) and sent with the person's next feedback
   (about.js sendFeedback), so the owner sees what broke on a phone he can't look at ---- */
const ERR_KEY='err_log',ERR_MAX=20,ERR_TAP_MS=3000;
let errTapAt=0,errToldAt=0;
for(const k of ['pointerup','click'])addEventListener(k,()=>{errTapAt=Date.now()},true);
addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')errTapAt=Date.now()},true);
const errMsg=e=>{const x=e&&e.error||e;return String(x&&x.message||x||'').trim().slice(0,200)};
// noise that isn't a failure: the layout observer's loop warning, a stopped request, scripts of other sites
const errNoise=e=>{const m=errMsg(e),n=e&&e.name;return !m||n==='AbortError'||/^ResizeObserver loop|^Script error\.?$/.test(m)};
const errList=()=>{try{const L=JSON.parse(localStorage.getItem(ERR_KEY)||'[]');return Array.isArray(L)?L:[]}catch{return []}};
function errNote(e){try{if(errNoise(e))return;const x=e&&e.error||e,at=String(x&&x.stack||'').split('\n').find(l=>/\.js/.test(l))||'';
  const L=errList();L.push({t:Date.now(),m:errMsg(e),at:at.trim().slice(0,160),v:typeof appVersion==='function'?String(appVersion()):''});
  localStorage.setItem(ERR_KEY,JSON.stringify(L.slice(-ERR_MAX)))}catch{}}
function errTell(e){if(errNoise(e))return;const now=Date.now();if(now-errTapAt>ERR_TAP_MS||now-errToldAt<5000)return;errToldAt=now;
  if(typeof toast==='function')toast('Something went wrong: '+errMsg(e).replace(/\.$/,'')+'. Try again; if it keeps happening, tell us in Settings → About → Feedback.',8000)}
// the last week's problems as lines for the feedback (at most 8)
const errReport=()=>errList().filter(x=>x&&x.t>Date.now()-7*86400000).slice(-8).map(x=>new Date(x.t).toISOString().slice(0,16).replace('T',' ')+' v'+(x.v||'?')+' '+x.m+(x.at?' @ '+x.at:'')).join('\n');

/* storage can't be opened (a private window in some browsers, storage switched off for websites): a page that says so,
   over everything. Called from the start-up chain's catch, which also catches other errors: those show nothing here. */
async function storageDown(e){
  const open=await db.then(()=>true,()=>false);if(open&&!storeFailure(e))return false;
  if(document.getElementById('nostore'))return true;dbDown=true;
  const x=storeErr(e||dbErr),el=document.createElement('div');el.id='nostore';el.className='nostore';el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','nostore-h');
  el.innerHTML=`<div class="nostore-in"><h1 id="nostore-h">Your wardrobe can’t be opened here</h1>
<p>This browser isn’t letting the app keep anything on this device, so your wardrobe can’t be loaded or saved.</p>
<p>That happens in a private window, or when storage for websites is switched off or full. Open the app in a normal window, or allow this site to store data, then try again. Nothing in your wardrobe has been changed.</p>
${x.message?`<p class="nostore-why">What the browser said: ${esc(String(x.message))}</p>`:''}
<button type="button" class="nostore-btn" onclick="location.reload()">Try again</button></div>`;
  document.body.appendChild(el);for(const s of ['header','main','nav']){const n=document.querySelector(s);if(n)n.inert=true}
  const t=document.getElementById('toast');if(t)t.classList.remove('on','act');
  el.querySelector('button').focus();return true}

/* ---- keep the wardrobe: without this the browser may clear a site's storage when the device runs short. Asked once,
   after the first item is saved (or at the next start of a wardrobe that already has items). ---- */
async function askPersist(){
  try{if(localStorage.getItem('persist_asked')||!navigator.storage||!navigator.storage.persist)return null;
    localStorage.setItem('persist_asked',Date.now());
    const kept=(navigator.storage.persisted&&await navigator.storage.persisted())||await navigator.storage.persist();
    localStorage.setItem('persist_ok',kept?'1':'0');return kept}
  catch(e){console.warn('storage not made persistent',e);return null}}

/* ---- the sharp tagging copies and sharp close-ups (tagging.js keeps them in Cache Storage as tagimg/<id>, closeimg/<id>) of items that no longer exist are
   removed at start-up, not when an item is deleted: a deletion can be undone for a few seconds. Never with an empty
   wardrobe (one that was lost comes back from the backup). ---- */
async function pruneTagImgs(){
  try{if(!self.caches||!items.length||!(await caches.has(TAGIMG_CACHE)))return 0;
    const c=await caches.open(TAGIMG_CACHE),have=new Set(items.map(i=>String(i.id)));let n=0;
    for(const r of await c.keys()){const m=/\/(?:tagimg|closeimg)\/([^?#]+)/.exec(r.url);if(!m)continue;let id=m[1];try{id=decodeURIComponent(id)}catch{}
      if(!have.has(id)&&!queue.some(q=>q.id===id)&&await c.delete(r))n++}
    return n}
  catch(e){console.warn('kept tagging copies not checked',e);return 0}}
/* once the wardrobe is loaded (from the start-up chain in app.js) */
function safetyStart(){pruneTagImgs();if(items.length)askPersist();if(typeof wardPendingRestore==='function')whenPulled(wardPendingRestore);if(typeof addRestore==='function')addRestore()}   // a name typed just before a kill (wardrobe.js); Add cards not saved before the app was closed (add.js)

/* ---- tagging that failed: why, on the card, with Try again ---- */
let tagWhy='',tagNetLast=false;
/* one sentence, one full stop: the server's own sentences end with one ("…by hand.." was shown) */
const oneStop=t=>String(t??'').trim().replace(/[\s.]+$/,'');
/* the server's reason in words a tester can read: its own sentence (`message`, then `detail`), a set-up error in plain words (ui.js
   plainErr), and never a bare code ("mock", "busy") or a status number */
function tagReason(status,j,e){const m=j&&typeof j.message==='string'&&j.message.trim()?j.message:(j&&j.detail)||e||'';
  const pe=m&&typeof plainErr==='function'?plainErr(m):m;
  // its own "Try again later, or add the item by hand." is left out: the card has Try again and is filled in by hand right there
  const t=pe&&/\s/.test(String(pe).trim())?oneStop(String(pe).replace(/\s*Try again later\b[^.]*\.?\s*$/i,'')):'';
  return t||'The photo couldn’t be read just now'}
// called by ask() (app.js) when the server couldn't be asked or refused: returns the Add page's note and keeps the reason for the card
function tagFailText(status,j,e){tagNetLast=false;
  if(!status){const off=navigator.onLine===false,net=off||e instanceof TypeError;tagNetLast=net;
    tagWhy=off?'You’re offline.':net?'The server couldn’t be reached. Check your connection.':'Something went wrong while reading it.';
    return `Photo tagging failed: ${off?'you’re offline':net?'the server couldn’t be reached':'something went wrong'}. Fill in the details below.`}
  if(j&&j.error==='limit'&&j.message){tagWhy=String(j.message);return tagWhy}
  const why=tagReason(status,j,e);tagWhy=why+'.';
  return `Photo tagging failed: ${why}. Fill in the details below.`}
/* the Add note was about the connection (cleared once back online) */
const tagNetText=t=>/offline|couldn’t be reached/.test(t||'');
function tagFailed(q){if(localStorage.getItem('worker_url')){q.tagErr=tagWhy||'No answer came back.';if(tagNetLast)q.tagNet=1;else delete q.tagNet}}
/* the card says what to do once: not when the reason already does ("Try again later, or add the item by hand.") */
const tagFailNote=(q,i)=>q.tagErr?`<div class="tagfail" role="alert"><p><b>This photo wasn’t tagged.</b> ${esc(q.tagErr)}${/try again|by hand|yourself/i.test(q.tagErr)?'':' <span class="tagfail-do">Fill in the details yourself, or try again.</span>'}</p><button type="button" class="tagfail-btn" onclick="retryTag(${i})">Try again</button></div>`:'';
async function retryTag(i){const q=queue[i];if(!q||q.busy||!q.tagImg)return;
  const ac=typeof AbortController==='function'?new AbortController():null;q.abort=ac;   // Stop on the card (add.js stopRead)
  q.busy=1;renderAdd();let ai=null;try{ai=await ask(q.tagImg,{wb:!!(q.wb&&!q.wbOff),...(ac?{signal:ac.signal}:{})})}catch(e){console.warn(e)}
  q.busy=0;q.abort=null;if(q.stopped){delete q.stopped;delete q.tagNet;q.tagErr=typeof STOPPED==='string'?STOPPED:'You stopped the reading.'}
  else if(ai){delete q.tagErr;delete q.tagNet;await fill(q,ai);takeExtras(q,ai);measureAndApply(q)}else tagFailed(q);
  if(typeof addKeep==='function')addKeep();
  if(queue.includes(q))renderAdd()}

/* ---- unsaved Add cards: closing or reloading the page asks first. Installed with the first card. ---- */
let guardOn=false;
function guardUnsaved(){if(guardOn)return;guardOn=true;
  addEventListener('beforeunload',e=>{if(queue.some(q=>!q.err)){e.preventDefault();e.returnValue=''}})}

/* ---- a device's first contact with a backup (it has never finished a sync): the backup's settings win, key by key, whatever
   the stamps say. A new device has only defaults, or what first-run setup saved, and those must not replace the holidays,
   days off, own colours and learned preferences in the backup. What only this device has (a key the backup lacks) stays.
   Called by syncOnce (sync.js) with the local snapshot and the downloaded one, before they are merged. ---- */
async function adoptBackupSettings(local,data){
  if(localStorage.getItem('last_sync')||!data||!data.settings||!local||!local.settings)return false;
  if((local.settings.updated||0)<=(data.settings.updated||0))return false;   // the merge takes the backup's by itself
  const kept={...local.settings,...data.settings};await metaPut('settings',kept);local.settings=kept;
  settings=takeSettings(settings,data.settings);applyCustom(settings.custom);cache={};loadWeather();
  if(typeof refreshToday==='function'&&!$('#today').hidden)refreshToday();return true}
