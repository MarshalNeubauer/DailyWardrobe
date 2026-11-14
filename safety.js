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
  if(e&&e.dwStore==='read')return `Couldn’t read your wardrobe${why?': '+why:''}. Close the app and open it again.`;
  return `Couldn’t save: ${why||'the browser stopped it'}. Try again.`}
let storeToldAt=0;
// tell the person a save failed (one failed save can reject more than one promise: said once)
function saveFailed(e){console.warn('storage failure',e);if(dbDown)return;const now=Date.now();if(now-storeToldAt<1500)return;storeToldAt=now;toast(storeFailText(e),7000)}

/* whether the wardrobe's storage opened: known before any later script's own wait on it fails */
let dbDown=null,dbErr=null;
db.then(()=>{dbDown=false},e=>{dbDown=true;dbErr=e});
/* a storage failure nobody caught is shown; every other rejection is left alone */
addEventListener('unhandledrejection',ev=>{const e=ev.reason;
  if(dbDown){if(e===dbErr||storeFailure(e))ev.preventDefault();return}   // the full-page message already says it
  if(storeFailure(e)){ev.preventDefault();saveFailed(e)}});

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

/* ---- the sharp tagging copies (tagging.js keeps one per tagged photo in Cache Storage) of items that no longer exist are
   removed at start-up, not when an item is deleted: a deletion can be undone for a few seconds. Never with an empty
   wardrobe (one that was lost comes back from the backup). ---- */
async function pruneTagImgs(){
  try{if(!self.caches||!items.length||!(await caches.has(TAGIMG_CACHE)))return 0;
    const c=await caches.open(TAGIMG_CACHE),have=new Set(items.map(i=>String(i.id)));let n=0;
    for(const r of await c.keys()){const m=/\/tagimg\/([^?#]+)/.exec(r.url);if(!m)continue;let id=m[1];try{id=decodeURIComponent(id)}catch{}
      if(!have.has(id)&&!queue.some(q=>q.id===id)&&await c.delete(r))n++}
    return n}
  catch(e){console.warn('kept tagging copies not checked',e);return 0}}
/* once the wardrobe is loaded (from the start-up chain in app.js) */
function safetyStart(){pruneTagImgs();if(items.length)askPersist()}

/* ---- tagging that failed: why, on the card, with Try again ---- */
let tagWhy='';
// called by ask() (app.js) when the server couldn't be asked or refused: returns the Add page's note and keeps the reason for the card
function tagFailText(status,j,e){
  if(!status){const off=navigator.onLine===false,net=off||e instanceof TypeError;
    tagWhy=off?'You’re offline.':net?'The tagging service couldn’t be reached. Check your connection.':`Something went wrong${e&&e.message?': '+e.message:''}.`;
    return `Photo tagging failed: ${off?'you’re offline':net?'the tagging service couldn’t be reached':e&&e.message||'something went wrong'}. Fill in the details below.`}
  if(j&&j.error==='limit'&&j.message){tagWhy=String(j.message);return tagWhy}
  tagWhy=`The tagging service answered: ${e||'error '+status}.`;
  return `Photo tagging failed: ${e||'HTTP '+status}. Fill in the details below.`}
function tagFailed(q){if(localStorage.getItem('worker_url'))q.tagErr=tagWhy||'The tagging service gave no answer.'}
const tagFailNote=(q,i)=>q.tagErr?`<div class="tagfail" role="alert"><p><b>This photo wasn’t tagged.</b> ${esc(q.tagErr)} <span class="tagfail-do">Fill in the details yourself, or try again.</span></p><button type="button" class="tagfail-btn" onclick="retryTag(${i})">Try again</button></div>`:'';
async function retryTag(i){const q=queue[i];if(!q||q.busy||!q.tagImg)return;
  q.busy=1;renderAdd();let ai=null;try{ai=await ask(q.tagImg,{wb:!!(q.wb&&!q.wbOff)})}catch(e){console.warn(e)}
  q.busy=0;if(ai){delete q.tagErr;await fill(q,ai);takeExtras(q,ai);measureAndApply(q)}else tagFailed(q);
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
  settings={...settings,...data.settings};applyCustom(settings.custom);cache={};loadWeather();
  if(typeof refreshToday==='function'&&!$('#today').hidden)refreshToday();return true}
