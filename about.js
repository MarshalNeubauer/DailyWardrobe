/* Daily Wardrobe: Settings → About. The app's version and updates, feedback, deleting one's data, the privacy note.
   Loaded last (after sync.js); shares the global scope with the other scripts. */

/* ---- version ----
   The version is the number in the service worker's cache name (sw.js: const CACHE='dw-v<n>'), bumped with every release.
   The page reads it once at start-up from the sw.js the browser serves it: the service worker answers from the same cache
   the page's other files came from, so the number is the version of the files that are running (not of the newest release). */
const ABOUT_CHECK_MS=30*60*1000;   // look for a newer version this often while the app is open
const ABOUT_FRONT_MS=60*1000;      // coming back to the foreground looks again, unless it just did
const ABOUT_INSTALL_MS=45*1000;    // how long Update waits for the new version to download and take over
let aboutVer=null;        // the version this page runs
let aboutNew=null;        // a newer version seen on the server
let aboutToasted=0;       // the version the "new version" toast was shown for (once per version)
let aboutLast=0;          // when the last check started
let aboutChecking=null;   // the check in flight
let aboutUpdating=false;
let aboutMsg='';
const swVersionOf=t=>{const m=/CACHE\s*=\s*['"]dw-v(\d+)['"]/.exec(String(t||''));return m?+m[1]:null};
function appVersion(){return aboutVer}
async function aboutReadVersion(){
  try{const r=await fetch('sw.js',{cache:'no-cache'});if(r.ok){const v=swVersionOf(await r.text());if(v)aboutVer=v}}catch{}
  aboutShow();return aboutVer}
/* the newest version on the server: sw.js past every cache (the service worker leaves no-store requests alone) */
async function aboutLatest(){
  try{const r=await fetch('sw.js?check='+Date.now(),{cache:'no-store'});return r.ok?swVersionOf(await r.text()):null}catch{return null}}
const aboutReg=async()=>{try{return navigator.serviceWorker&&navigator.serviceWorker.getRegistration?await navigator.serviceWorker.getRegistration()||null:null}catch{return null}};
/* ask a service worker which version it is (null from one that doesn't answer: an older sw.js) */
const aboutAsk=w=>new Promise(res=>{try{const ch=new MessageChannel();const t=setTimeout(()=>res(null),1500);
  ch.port1.onmessage=e=>{clearTimeout(t);res(e.data&&e.data.version||null)};w.postMessage({type:'version'},[ch.port2])}catch{res(null)}});
/* a downloaded copy of the very version this page already runs (the first start after the service worker changed how it
   updates) takes over quietly: the files are the same, so nothing reloads */
let aboutWatch=false;
async function aboutAdopt(){const reg=await aboutReg(),w=reg&&(reg.waiting||reg.installing);
  if(reg&&!w&&!aboutWatch){aboutWatch=true;reg.addEventListener('updatefound',()=>{aboutWatch=false;aboutAdopt()},{once:true})}   // the browser's own check comes a moment after the page loads
  if(!w||aboutVer==null||aboutUpdating)return;
  if(w.state==='installing'){w.addEventListener('statechange',()=>{if(w.state==='installed')aboutAdopt()},{once:true});return}
  if(w.state==='installed'&&await aboutAsk(w)===aboutVer&&!aboutUpdating)w.postMessage({type:'skipWaiting'})}
function aboutShow(){
  const v=$('#about-ver'),s=$('#sum-about'),u=$('#about-update'),st=$('#about-status'),ready=aboutNew&&aboutVer&&aboutNew>aboutVer;
  if(v)v.textContent=aboutVer?'Version '+aboutVer:'Version';
  if(s)s.textContent=(aboutVer?'Version '+aboutVer:'Version')+(ready?' · update ready':'')+' · feedback · your data';
  if(u)u.hidden=!ready;
  if(st)st.textContent=aboutMsg||(ready?`Version ${aboutNew} is ready.`:'')}
/* Is there a newer version? At start-up, when the app comes back to the foreground, every 30 minutes, and from the button.
   It only ever tells (a toast with Update, once per version, and the About page): nothing reloads without a tap. */
function checkForUpdate(manual){
  if(aboutChecking)return aboutChecking;
  aboutLast=Date.now();if(manual){aboutMsg='Checking…';aboutShow()}
  aboutChecking=(async()=>{
    if(aboutVer==null)await aboutReadVersion();
    const latest=await aboutLatest();let msg='';
    if(latest==null)msg='Couldn’t check for updates. You may be offline.';
    else if(aboutVer==null)msg='';
    else if(latest>aboutVer){aboutNew=latest;
      aboutReg().then(g=>g&&g.update()).catch(()=>{});   // start the download, so Update is quick
      if(aboutToasted!==latest){aboutToasted=latest;if(typeof toast==='function')toast('A new version is ready',20000,{label:'Update',fn:updateNow})}}
    else{msg='You have the latest version.';aboutAdopt()}
    aboutMsg=manual?msg:'';aboutShow();return latest})().finally(()=>{aboutChecking=null});
  return aboutChecking}
/* Update: the browser takes the new service worker (it downloaded every file of the new version into its own cache), and the
   page reloads once that worker controls it, so the reload gets one whole version. */
async function updateNow(){
  if(aboutUpdating)return;
  const n=typeof queue!=='undefined'&&queue?queue.length:0;
  if(n&&!await askConfirm(`Update now?\n\nYou have ${n} unsaved card${n===1?'':'s'} on the Add tab. Updating restarts the app and ${n===1?'it':'they'} will be lost.`,{ok:'Update'}))return;
  aboutUpdating=true;aboutMsg='Updating…';aboutShow();
  let done=false;const reload=()=>{if(done)return;done=true;location.reload()};
  const fail=t=>{if(done)return;done=true;aboutUpdating=false;aboutMsg=t;aboutShow();if(typeof toast==='function')toast(t,5000)};
  const reg=await aboutReg();if(!reg){reload();return}   // no service worker (first visit): a plain reload fetches the files
  try{await reg.update()}catch{fail('Couldn’t download the new version. Try again when you are online.');return}
  const w=reg.waiting||reg.installing;if(!w){reload();return}   // the newest service worker is already in charge
  navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
  const step=()=>{if(w.state==='installed')w.postMessage({type:'skipWaiting'});
    else if(w.state==='activated'){if(!navigator.serviceWorker.controller||navigator.serviceWorker.controller===w)reload()}
    else if(w.state==='redundant')fail('The new version couldn’t be installed. Try again in a moment.')};
  w.addEventListener('statechange',step);step();
  setTimeout(()=>fail('The new version is taking too long to download. Try again in a moment.'),ABOUT_INSTALL_MS)}

/* ---- the server ---- */
const aboutConn=()=>{const w=(localStorage.getItem('worker_url')||'').trim(),tok=(localStorage.getItem('app_token')||'').trim();if(!w||!tok)return null;
  try{const base=new URL(w.replace(/\/*$/,'/'));return {tok,at:p=>new URL(p,base).href,head:{'content-type':'application/json','x-app-token':tok}}}catch{return null}};
const aboutEsc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const aboutSay=(id,t,bad)=>{const e=$(id);if(e){e.textContent=t;e.classList.toggle('about-bad',!!bad)}};

/* ---- feedback ---- */
async function sendFeedback(){
  const el=$('#fb-text'),b=$('#fb-send'),text=(el&&el.value||'').trim();
  if(!text){aboutSay('#fb-status','Write something first.',true);return}
  const c=aboutConn();if(!c){aboutSay('#fb-status','Feedback needs a connection. Connect first, under Connection.',true);return}
  if(b)b.disabled=true;aboutSay('#fb-status','Sending…');
  try{
    let r;try{r=await fetch(c.at('feedback'),{method:'POST',headers:c.head,body:JSON.stringify({text,version:appVersion(),where:'settings'})})}
    catch{aboutSay('#fb-status','Couldn’t send it: the server didn’t answer. Check your connection and try again.',true);return}
    const j=await r.json().catch(()=>({}));
    if(r.status===404)aboutSay('#fb-status','Feedback isn’t available yet. Please try again in a few days.',true);
    else if(!r.ok)aboutSay('#fb-status','Couldn’t send it: '+(j&&j.error?j.error:'the server answered '+r.status)+'.',true);
    else{el.value='';aboutSay('#fb-status','Thank you. Your feedback was sent.');loadFeedback()}
  }finally{if(b)b.disabled=false}}
/* the owner also sees what was sent in (GET /me says who this is; anything but a clear "owner" shows nothing) */
const fbWhen=t=>{const n=typeof t==='number'&&t<1e12?t*1000:t,d=new Date(n);return isNaN(d)?'':d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})};
const fbTime=t=>{const n=typeof t==='number'&&t<1e12?t*1000:t,x=+new Date(n);return isNaN(x)?0:x};
async function loadFeedback(){
  const box=$('#fb-list');if(!box)return;const c=aboutConn();if(!c){box.hidden=true;box.innerHTML='';return}
  try{
    const m=await fetch(c.at('me'),{headers:c.head,cache:'no-store'}),me=m.ok?await m.json().catch(()=>null):null;
    if(!me||me.role!=='owner'){box.hidden=true;box.innerHTML='';return}
    const r=await fetch(c.at('feedback'),{headers:c.head,cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
    if(!j||!Array.isArray(j.items)){box.hidden=true;box.innerHTML='';return}
    const list=j.items.filter(x=>x&&x.text).sort((a,b)=>fbTime(b.t)-fbTime(a.t));
    box.innerHTML=`<div class="slabel">Feedback received</div>`+(list.length?list.map(x=>`<div class="fb-item"><small>${aboutEsc([x.name||'Someone',fbWhen(x.t),x.version?'version '+x.version:''].filter(Boolean).join(' · '))}</small><p>${aboutEsc(x.text)}</p></div>`).join(''):'<p class="shelp">Nothing yet.</p>');
    box.hidden=false;
  }catch{box.hidden=true}}

/* ---- delete my data ----
   Everything the app keeps on a device: the IndexedDB database 'wardrobe' (items, days, meta: settings, kept photos, the
   what-to-buy result…), Cache Storage (dw-keep-*: the sharp tagging copies; dw-v*: the app's own files) and the
   localStorage keys below. A key added elsewhere must be added here too (tests/about.test.js reads the sources and checks). */
const ABOUT_DB='wardrobe';
const ABOUT_KEYS=['worker_url','app_token','theme','wx','wx_norm','sync_mark','sync_status','last_sync','render_queue','tag_bench','bench_pct','tex_swatch','tex_swatch2','spec_recolour','asm_none','asm_vest','asm_paint2','asm_cm','asm_cm_listed','asm_cm_mf','pack_trip','pack_marks','ward_sort','persist_asked','persist_ok','acct_role','invite_ended','sync_pause','sync_pause_msg','remind','remind_sent','care_told'];
const ABOUT_KEY_PREFIXES=['nav_fit'];
const ABOUT_NOTE='about_note';   // sessionStorage: what to say after the restart
const aboutOwnKey=k=>ABOUT_KEYS.includes(k)||ABOUT_KEY_PREFIXES.some(p=>k.startsWith(p));
let aboutDeleting=false;
function askDelete(){
  const box=$('#del-confirm');if(!box)return;const c=aboutConn();aboutSay('#del-status','');
  box.innerHTML=`<p><b>This can’t be undone.</b> It deletes:</p><ul><li>your wardrobe, outfit history and settings on this device</li><li>the photos kept on this device</li>${c?'<li>your backup, its daily copies and your photos on the server</li>':''}</ul>`+
    (c?'<p class="shelp">“This device only” leaves the server’s copy as it is: connect again to get it back.</p>':'<p class="shelp">This device isn’t connected, so there is nothing on a server to delete.</p>')+
    `<div class="sactions">${c?'<button type="button" class="danger" id="del-all" onclick="deleteMyData(true)">Delete everything</button>':''}<button type="button" class="danger" id="del-device" onclick="deleteMyData(false)">Delete from this device only</button><button type="button" id="del-cancel" onclick="cancelDelete()">Cancel</button></div>`;
  box.hidden=false;if(box.scrollIntoView)box.scrollIntoView({block:'nearest'})}
function cancelDelete(){const box=$('#del-confirm');if(box){box.hidden=true;box.innerHTML=''}}
async function wipeDevice(){
  if(typeof syncTimer!=='undefined')clearTimeout(syncTimer);
  try{const d=await db,names=[...d.objectStoreNames];
    if(names.length)await new Promise(res=>{const t=d.transaction(names,'readwrite');for(const n of names)t.objectStore(n).clear();t.oncomplete=t.onerror=t.onabort=()=>res()});
    d.close();   // nothing writes after this; and the database can go
    await new Promise(res=>{const q=indexedDB.deleteDatabase(ABOUT_DB);q.onsuccess=q.onerror=q.onblocked=()=>res();setTimeout(res,2000)})
  }catch(e){console.warn('database not cleared',e)}
  const online=navigator.onLine!==false;   // offline, the app's own files stay, or the restart would find nothing
  try{if(self.caches)for(const k of await caches.keys())if(k.startsWith('dw-keep-')||(online&&k.startsWith('dw-')))await caches.delete(k)}catch{}
  try{if(online){const reg=await aboutReg();if(reg)await reg.unregister()}}catch{}
  try{for(const k of Object.keys(localStorage))if(aboutOwnKey(k))localStorage.removeItem(k)}catch{}
}
/* server=true also deletes the account on the server; the device is cleared only once the server said yes (or said it can't) */
async function deleteMyData(server){
  if(aboutDeleting)return;aboutDeleting=true;
  const c=aboutConn();let note='Your data on this device was deleted.';
  for(const b of document.querySelectorAll('#del-confirm button'))b.disabled=true;
  aboutSay('#del-status','Deleting…');
  const stop=t=>{aboutDeleting=false;for(const b of document.querySelectorAll('#del-confirm button'))b.disabled=false;aboutSay('#del-status',t,true)};
  if(server&&c){
    const keep={w:localStorage.getItem('worker_url'),t:localStorage.getItem('app_token')};
    const back=()=>{try{localStorage.setItem('worker_url',keep.w);localStorage.setItem('app_token',keep.t)}catch{}};
    if(typeof syncTimer!=='undefined')clearTimeout(syncTimer);
    try{localStorage.removeItem('worker_url');localStorage.removeItem('app_token')}catch{}   // no backup may start (and bring the data back) from here on
    let r;try{r=await fetch(c.at('account'),{method:'DELETE',headers:c.head,body:JSON.stringify({confirm:'delete'})})}
    catch{back();stop('The server didn’t answer, so nothing was deleted. Try again, or delete from this device only.');return}
    if(r.status===404)note='This device was cleared. The server couldn’t delete your backup yet: ask the person who invited you to remove it.';
    else if(!r.ok){const j=await r.json().catch(()=>({}));back();stop(`The server didn’t delete your data (${j&&j.error?j.error:'it answered '+r.status}), so nothing was deleted. Try again, or delete from this device only.`);return}
    else note='Your data was deleted from this device and from the server.';
  }else if(c)note='This device was cleared. Your backup on the server was kept.';
  await wipeDevice();
  try{sessionStorage.setItem(ABOUT_NOTE,note)}catch{}
  location.reload()}

/* ---- the page ---- */
function renderAbout(){aboutShow();
  // the owner reads the feedback (below it) rather than sending it to someone: no "goes to the person who invited you"
  if($('#fb-help'))$('#fb-help').textContent='What works, what doesn’t, what is missing'+(typeof acctRole==='function'&&acctRole()==='owner'?'.':': it goes to the person who invited you.');
  if($('#fb-send'))$('#fb-send').disabled=!aboutConn();   // no connection: the button is off, with the reason under it
  if(!aboutConn()&&$('#fb-status')&&!$('#fb-status').textContent)aboutSay('#fb-status','Feedback needs a connection: paste your invite link under Connection, above.');
  loadFeedback()}
let aboutStarted=false;
function aboutStart(){
  if(aboutStarted)return;aboutStarted=true;
  try{const n=sessionStorage.getItem(ABOUT_NOTE);if(n){sessionStorage.removeItem(ABOUT_NOTE);if(typeof toast==='function')toast(n,8000)}}catch{}
  aboutReadVersion().then(()=>checkForUpdate());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-aboutLast>ABOUT_FRONT_MS)checkForUpdate()});
  setInterval(()=>{if(document.visibilityState==='visible')checkForUpdate()},ABOUT_CHECK_MS)}
aboutStart();
