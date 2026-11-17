/* Daily Wardrobe: Settings → About. The app's version and updates, feedback, deleting one's data, the privacy note.
   Loaded last (index.html's final script); shares the global scope with the other scripts. */

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
  // the cards waiting on Add come back after the restart (add.js addKeep / addRestore), so they need no question; only a photo still
  // being read is stopped by it (re-audit 2026-11-15: "they will be lost" put people off a safe update)
  const n=typeof queue!=='undefined'&&queue?queue.filter(q=>q&&(q.busy||q.multiBusy)).length:0;
  if(n&&!await askConfirm(`Update now?\n\n${n===1?'A photo on the Add page is':`${n} photos on the Add page are`} still being read. Updating restarts the app and stops ${n===1?'that reading':'those readings'}, so ${n===1?'it has':'they have'} to be read again. Your other cards on Add come back as they are.`,{ok:'Update'}))return;
  if(typeof addKeep==='function')try{await addKeep()}catch{}   // the cards as they are now, before the restart
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
/* connected and the invitation still on (ui.js isConnected: not an ended invitation) */
const aboutLive=()=>!!aboutConn()&&(typeof isConnected!=='function'||isConnected());
/* a refusal in words: the server's own sentence (`message`), never its code ("invite off", "forbidden token", "kv-limit" reached testers) */
const ABOUT_CODES=/^(invite off|forbidden token|forbidden origin|kv-limit|limit|empty|too long|confirm)$|[_-]/i;
const aboutErrText=(status,j,lead)=>{const m=j&&typeof j.message==='string'&&j.message.trim(),e=j&&typeof j.error==='string'&&j.error.trim();
  if(m)return `${lead} ${m}`;
  if(e&&/\s/.test(e)&&!ABOUT_CODES.test(e)){const p=typeof plainErr==='function'?plainErr(e):e;return `${lead.replace(/\.$/,':')} ${p}${/[.!?]$/.test(p)?'':'.'}`}   // a sentence of an older server's
  return `${lead} The server had a problem (${status}). Try again later.`};

/* ---- feedback ---- */
// the phone's recent problems go along (safety.js errReport), within the server's 4,000 characters; cleared once sent
const fbWithErrs=t=>{const r=typeof errReport==='function'?errReport():'';return r?(t+'\n\n— Problems noted on this phone —\n'+r).slice(0,4000):t};
// one send at a time, and a tap right after one went through (the field already emptied) leaves its "Thank you" in place: a double tap
// read "Write something first." after sending (re-audit 2026-11-15)
let fbSending=false,fbSentAt=0;
const FB_AGAIN_MS=3000;
async function sendFeedback(){
  const el=$('#fb-text'),b=$('#fb-send'),text=(el&&el.value||'').trim();
  if(fbSending)return;
  if(!text){if(Date.now()-fbSentAt<FB_AGAIN_MS)return;aboutSay('#fb-status','Write something first.',true);return}
  const c=aboutConn();if(!c||!aboutLive()){aboutSay('#fb-status',aboutLive()||!c?'Feedback needs a connection. Connect first, under Connection.':ENDED,true);return}
  if(b)b.disabled=true;aboutSay('#fb-status','Sending…');fbSending=true;
  try{
    let r;try{r=await fetch(c.at('feedback'),{method:'POST',headers:c.head,body:JSON.stringify({text:fbWithErrs(text),version:appVersion(),where:'settings'})})}
    catch{aboutSay('#fb-status','Couldn’t send it: the server didn’t answer. Check your connection and try again.',true);return}
    const j=await r.json().catch(()=>({}));
    if(r.status===404)aboutSay('#fb-status','Feedback isn’t available yet. Please try again in a few days.',true);
    else if(typeof endedAnswer==='function'&&endedAnswer(r.status,j)){inviteEnded(c.tok,j);aboutSay('#fb-status',ENDED,true)}
    // the server's saves for the day used up: its sentence is about backups ("kept on this device and saved after the reset"), but feedback
    // isn't kept anywhere: said as it is (re-audit 2026-11-15)
    else if(r.status===429&&j&&j.error==='kv-limit')aboutSay('#fb-status',`Couldn’t send it: the server can’t save anything more today. Send it again after ${aboutResetAt()}; your text stays in the box until the app is closed.`,true);
    else if(!r.ok)aboutSay('#fb-status',aboutErrText(r.status,j,'Couldn’t send it.'),true);
    else{el.value='';fbSentAt=Date.now();try{localStorage.removeItem('err_log')}catch{}aboutSay('#fb-status','Thank you. Your feedback was sent.');loadFeedback()}
  }finally{fbSending=false;if(b)b.disabled=false}}
/* the local time of the next 00:00 UTC, when the server's daily allowances start again */
function aboutResetAt(){const d=new Date();try{return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}catch{return 'midnight UTC'}}
/* the owner also sees what was sent in (GET /me says who this is; anything but a clear "owner" shows nothing) */
const fbWhen=t=>{const n=typeof t==='number'&&t<1e12?t*1000:t,d=new Date(n);return isNaN(d)?'':d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})};
const fbTime=t=>{const n=typeof t==='number'&&t<1e12?t*1000:t,x=+new Date(n);return isNaN(x)?0:x};
/* (who this is comes from account.js, which already asked /me for Settings; /me is asked here only when it doesn't know yet: CR-7-06) */
async function loadFeedback(){
  const box=$('#fb-list');if(!box)return;const c=aboutConn();if(!c){box.hidden=true;box.innerHTML='';return}
  try{
    let role=typeof acctRole==='function'?acctRole():null;
    if(!role){const m=await fetch(c.at('me'),{headers:c.head,cache:'no-store'}),me=m.ok?await m.json().catch(()=>null):null;role=me&&me.role}
    if(role!=='owner'){box.hidden=true;box.innerHTML='';return}
    const r=await fetch(c.at('feedback'),{headers:c.head,cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
    if(!j||!Array.isArray(j.items)){box.hidden=true;box.innerHTML='';return}
    const list=j.items.filter(x=>x&&x.text).sort((a,b)=>fbTime(b.t)-fbTime(a.t));
    box.innerHTML=`<div class="slabel">Feedback received</div>`+(list.length?list.map(x=>`<div class="fb-item"><small>${aboutEsc(noBidi([x.name||'Someone',fbWhen(x.t),x.version?'version '+x.version:''].filter(Boolean).join(' · ')))}</small><p>${aboutEsc(noBidi(x.text))}</p></div>`).join(''):'<p class="shelp">Nothing yet.</p>');
    box.hidden=false;
  }catch{box.hidden=true}}

/* ---- delete my data ----
   Everything the app keeps on a device: the IndexedDB database 'wardrobe' (items, days, meta: settings, kept photos, the
   what-to-buy result…), Cache Storage (dw-keep-*: the sharp tagging copies; dw-v*: the app's own files) and the
   localStorage keys below. A key added elsewhere must be added here too (tests/about.test.js reads the sources and checks). */
const ABOUT_DB='wardrobe';
const ABOUT_KEYS=['worker_url','app_token','wipe_seen','theme','wx','wx_norm','sync_mark','sync_join','sync_sd','kit_mine','sync_status','list_pause','last_sync','render_queue','tag_bench','bench_pct','tex_swatch','tex_swatch2','spec_recolour','asm_none','asm_vest','asm_paint2','asm_cm','asm_cm_listed','asm_cm_mf','pack_trip','pack_marks','ward_sort','persist_asked','persist_ok','acct_role','acct_was_owner','invite_ended','sync_pause','sync_pause_msg','clock_skew','clock_told','invite_lost','sync_wait','sync_restore','sync_off','rec_clean','set_clean','remind','remind_sent','care_told','black_bd','err_log','setup_at','tour_seen','home_told','tex_up','photo_up','asm_gl','del_pending','kit_import_last','ward_pending','missed_ok','safari_remind','backup_file_at','remake_day','missed_seen','plan_rules'];
const ABOUT_KEY_PREFIXES=['nav_fit'];
const ABOUT_NOTE='about_note';   // sessionStorage: what to say after the restart
const aboutOwnKey=k=>ABOUT_KEYS.includes(k)||ABOUT_KEY_PREFIXES.some(p=>k.startsWith(p));
let aboutDeleting=false;
function askDelete(){
  const box=$('#del-confirm');if(!box)return;aboutSay('#del-status','');
  // an ended invitation reaches nothing on the server any more (switched off, or already deleted): the card speaks of this device only
  // (re-audit 2026-11-15: it still listed the server's backup and "connect again to get it back")
  if(typeof inviteOver==='function'&&inviteOver()){
    box.innerHTML=`<p><b>This can’t be undone.</b> It deletes:</p><ul><li>your wardrobe, outfit history and settings on this device</li><li>the photos kept on this device</li></ul><p class="shelp">Your invitation has ended, so this phone can’t reach the server any more. Anything still kept there under that invitation is up to the person who invited you: ask them if you want it removed.</p>`+
      `<div class="sactions"><button type="button" class="danger" id="del-device" onclick="deleteMyData(false)">Delete from this device</button><button type="button" id="del-cancel" onclick="cancelDelete()">Cancel</button></div>`;
    box.hidden=false;if(box.scrollIntoView)box.scrollIntoView({block:'nearest'});return}
  const c=aboutConn();
  // a tester's "everything" ends the invitation too: the server deletes it first, and its link stops working on every phone
  const t=c&&typeof isTester==='function'&&isTester();
  box.innerHTML=`<p><b>This can’t be undone.</b> It deletes:</p><ul><li>your wardrobe, outfit history and settings on this device</li><li>the photos kept on this device</li>${c?'<li>your backup, its daily copies and your photos on the server</li>':''}${t?'<li>your invitation: “Delete everything” ends it, so its link stops working, also on your other phones; to use the app with the server again you need a new link</li>':''}</ul>`+
    (c?'<p class="shelp">“This device only” leaves the server’s copy as it is: connect again to get it back.</p>':'<p class="shelp">This device isn’t connected, so there is nothing on a server to delete.</p>')+
    `<div class="sactions">${c?'<button type="button" class="danger" id="del-all" onclick="deleteMyData(true)">Delete everything</button>':''}<button type="button" class="danger" id="del-device" onclick="deleteMyData(false)">Delete from this device only</button><button type="button" id="del-cancel" onclick="cancelDelete()">Cancel</button></div>`;
  box.hidden=false;if(box.scrollIntoView)box.scrollIntoView({block:'nearest'})}
function cancelDelete(){const box=$('#del-confirm');if(box){box.hidden=true;box.innerHTML=''}}
/* -> true once the database is gone (checked), false when it couldn't be deleted: then nothing else is cleared and the app works on.
   (CR-7-01, the code review 2026-11-16: after iOS had closed and the app reopened the connection, `db` was a closed connection, its
   store-clearing transaction threw, the same try skipped deleteDatabase, and the page said "deleted" with the whole wardrobe still there.)
   Every connection the page holds is closed (the first one, `db`, and the reopened one, dbConn), nothing may open the database again
   meanwhile (app.js dbWiping), and the backup and the connection copy stop first, so neither reopens and fills it. */
const ABOUT_WIPE_MS=8000;   // how long the delete waits for a backup under way, and for the check afterwards
const aboutTimeout=(p,ms,v)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(v),ms))]);
/* a delete held up by a connection elsewhere (the app open in another tab) can't be called off: it goes through once that one closes,
   so it is waited for, and the person is told what holds it up */
const ABOUT_WIPE_WAIT='Still deleting: the app is open in another tab or window. Close it there to finish.';
function aboutDbDelete(onBlocked){
  return new Promise(res=>{try{const q=indexedDB.deleteDatabase(ABOUT_DB);q.onsuccess=()=>res(true);q.onerror=()=>res(false);q.onblocked=()=>{if(onBlocked)onBlocked()}}catch{res(false)}})}
/* is anything of the wardrobe left? (opened without a version it makes no stores, and an empty database is deleted again) */
async function aboutDbLeft(){
  const n=await aboutTimeout(new Promise(res=>{try{const q=indexedDB.open(ABOUT_DB);q.onerror=()=>res(-1);q.onblocked=()=>res(-1);
    q.onsuccess=()=>{const d=q.result,names=[...d.objectStoreNames];if(!names.length){d.close();res(0);return}
      try{const t=d.transaction(names,'readonly');let c=0;for(const s of names){const r=t.objectStore(s).count();r.onsuccess=()=>{c+=r.result}}
        t.oncomplete=()=>{d.close();res(c)};t.onerror=t.onabort=()=>{d.close();res(-1)}}catch{d.close();res(-1)}}}catch{res(-1)}}),ABOUT_WIPE_MS,-1);
  if(n===0)await aboutTimeout(aboutDbDelete(),ABOUT_WIPE_MS);return n}
async function wipeDevice(){
  dbWiping=true;connReady=false;   // (app.js: no new connection, no connection copy written)
  if(typeof syncTimer!=='undefined')clearTimeout(syncTimer);
  if(typeof syncRun!=='undefined'&&syncRun)await aboutTimeout(syncRun.catch(()=>{}),ABOUT_WIPE_MS);   // a backup under way finishes (or fails) first
  for(const d of [await db.catch(()=>null),dbConn])try{if(d)d.close()}catch{}
  dbConn=null;dbCur=null;
  let gone=false;
  try{gone=await aboutDbDelete(()=>aboutSay('#del-status',ABOUT_WIPE_WAIT))&&await aboutDbLeft()===0}catch(e){console.warn('database not deleted',e)}
  if(!gone){console.warn('database not deleted');dbWiping=false;connReady=true;dbUnhold();return false}   // the app keeps working with what it has (app.js reopens it)
  const online=navigator.onLine!==false;   // offline, the app's own files stay, or the restart would find nothing
  try{if(self.caches)for(const k of await caches.keys())if(k.startsWith('dw-keep-')||(online&&k.startsWith('dw-')))await caches.delete(k)}catch{}
  try{if(online){const reg=await aboutReg();if(reg)await reg.unregister()}}catch{}
  try{for(const k of Object.keys(localStorage))if(aboutOwnKey(k))localStorage.removeItem(k)}catch{}
  return true}
/* said when the database couldn't be deleted (the server's copy, if asked, is gone already; del_pending stays, so the next start finishes) */
const ABOUT_WIPE_FAIL='The data on this device couldn’t be deleted. Close the app fully (swipe it away), open it again and try again.';
const ABOUT_WIPE_FAIL_SERVER='Your data was deleted from the server, but this device couldn’t be cleared yet. Close the app fully (swipe it away) and open it again: it finishes then.';
/* server=true also deletes the account on the server; the device is cleared only once the server said yes (or said it can't) */
async function deleteMyData(server){
  if(aboutDeleting)return;aboutDeleting=true;
  const c=aboutConn();let note='Your data on this device was deleted.';
  for(const b of document.querySelectorAll('#del-confirm button'))b.disabled=true;
  aboutSay('#del-status','Deleting…');
  const stop=t=>{aboutDeleting=false;for(const b of document.querySelectorAll('#del-confirm button'))b.disabled=false;aboutSay('#del-status',t,true)};
  if(server&&c){
    const keep={w:localStorage.getItem('worker_url'),t:localStorage.getItem('app_token')};
    if(typeof syncTimer!=='undefined')clearTimeout(syncTimer);
    // no backup may start (and bring the data back) from here on: the connection goes, its database copy too (app.js connKeep), and
    // del_pending remembers the request, so a phone killed before the answer finishes the job when it opens again (aboutResumeDelete);
    // killed there, it came back with the whole wardrobe and "Connected", the server's copy already gone (audit 2026-11-14)
    try{localStorage.setItem('del_pending',JSON.stringify(keep));localStorage.removeItem('worker_url');localStorage.removeItem('app_token')}catch{}
    if(typeof connKeep==='function')await connKeep();
    const res=await aboutDeleteAccount(keep);
    if(res.fail){stop(res.fail);return}
    note=res.note;
  }else if(c&&!(typeof inviteOver==='function'&&inviteOver()))note='This device was cleared. Your backup on the server was kept.';
  if(!await wipeDevice()){stop(server&&c&&/from the server|already been deleted/.test(note)?ABOUT_WIPE_FAIL_SERVER:ABOUT_WIPE_FAIL);if(typeof errNote==='function')errNote(new Error('the database could not be deleted'),'Delete my data');return}
  try{sessionStorage.setItem(ABOUT_NOTE,note)}catch{}
  location.reload()}
/* DELETE /account with the kept connection -> {note} (the device is to be cleared) or {fail} (the connection was put back, nothing deleted) */
async function aboutDeleteAccount(keep,resumed){
  const back=async()=>{try{localStorage.setItem('worker_url',keep.w);localStorage.setItem('app_token',keep.t);localStorage.removeItem('del_pending')}catch{}if(typeof connKeep==='function')await connKeep()};
  let r;try{r=await fetch(new URL('account',String(keep.w||'').trim().replace(/\/*$/,'/')).href,{method:'DELETE',headers:{'content-type':'application/json','x-app-token':keep.t||''},body:JSON.stringify({confirm:'delete'})})}
  catch{await back();return {fail:'The server didn’t answer, so nothing was deleted. Try again, or delete from this device only.'}}
  const j=await r.json().catch(()=>({}));
  if(r.ok)return {note:'Your data was deleted from this device and from the server.'};
  if(r.status===404)return {note:'This device was cleared. The server couldn’t delete your backup yet: ask the person who invited you to remove it.'};
  // the code is unknown to the server: the account was already deleted (on another phone, or by the owner), so there is nothing left to delete there
  // (who the kept code belonged to is read from what was remembered for it: at start-up the connection is already gone, so isTester() said
  // no; and a "Delete everything" resumed after a kill was sent before with that code, which the server knew then, so an unknown code now is
  // that request having gone through. Both read "nothing was deleted" after a kill on a slow server: re-audit 2026-11-15, agent8 #5)
  if(r.status===403&&j&&j.error==='forbidden token'&&(resumed||aboutKeptTester(keep.t)||(typeof isTester!=='function'||isTester())||localStorage.getItem('invite_ended')===keep.t))return {note:'This device was cleared. Your data on the server had already been deleted.'};
  // the server's saves for the day used up: nothing was deleted there (it now writes its list before the code goes, W1-10-01); said in the
  // app's words with the local time, not the backup sentence "kept on this device and saved after the daily reset (00:00 UTC)"
  if(r.status===429&&j&&j.error==='kv-limit'){await back();return {fail:`The server can’t delete anything more today, so nothing was deleted. Try again after ${aboutResetAt()}, or delete from this device only.`}}
  const why=j&&typeof j.message==='string'&&j.message.trim()||(j&&typeof j.error==='string'&&/\s/.test(j.error)&&!ABOUT_CODES.test(j.error.trim())?j.error.trim():'');   // never a code ("forbidden token")
  await back();return {fail:`The server didn’t delete your data${why?' ('+why.replace(/[.!]$/,'')+')':''}, so nothing was deleted. Try again, or delete from this device only.`}}
/* the code was a tester's, by what account.js remembered for it (acct_role: {tok, role}) */
function aboutKeptTester(tok){try{const r=JSON.parse(localStorage.getItem('acct_role')||'null');return !!r&&!!tok&&r.tok===tok&&r.role==='tester'}catch{return false}}
/* start-up: a "Delete everything" the app was closed in the middle of is finished (or, the server unreachable, undone and said) */
async function aboutResumeDelete(){let keep=null;try{keep=JSON.parse(localStorage.getItem('del_pending')||'null')}catch{}
  if(!keep||!keep.w||!keep.t){try{localStorage.removeItem('del_pending')}catch{}return}
  aboutDeleting=true;if(typeof syncTimer!=='undefined')clearTimeout(syncTimer);
  const res=await aboutDeleteAccount(keep,true);
  if(res.fail){aboutDeleting=false;if(typeof toast==='function')toast('“Delete everything” didn’t finish. '+res.fail.replace(/delete from this device only\./,'delete from this device only, in Settings → About.'),9000);if(window.syncNow)syncNow();return}
  if(!await wipeDevice()){aboutDeleting=false;if(typeof toast==='function')toast(ABOUT_WIPE_FAIL_SERVER,9000);return}
  try{sessionStorage.setItem(ABOUT_NOTE,res.note)}catch{}location.reload()}

/* ---- the page ---- */
function renderAbout(){aboutShow();if(typeof homeAbout==='function')homeAbout();   // "Add to Home Screen", on an iPhone or iPad in a browser tab (kit.js)
  // the owner reads the feedback (below it) rather than sending it to someone: no "goes to the person who invited you"
  // (a tester's phone also reports its errors by itself: safety.js errSend, 2026-11-16)
  if($('#fb-help'))$('#fb-help').textContent='What works, what doesn’t, what is missing'+(typeof acctRole==='function'&&acctRole()==='owner'?'.':': it goes to the person who invited you. When something goes wrong in the app, this phone also tells them what broke and where, so it can be fixed: never your photos or your wardrobe.');
  if($('#fb-send'))$('#fb-send').disabled=!aboutLive();   // no connection: the button is off, with the reason under it
  if(!aboutLive()&&$('#fb-status')&&!$('#fb-status').textContent)aboutSay('#fb-status',aboutConn()?'Feedback needs a connection: your invitation has ended. Paste a new invite link under Connection, above.':'Feedback needs a connection: paste your invite link under Connection, above.');
  loadFeedback()}
let aboutStarted=false;
function aboutStart(){
  if(aboutStarted)return;aboutStarted=true;
  try{const n=sessionStorage.getItem(ABOUT_NOTE);if(n){sessionStorage.removeItem(ABOUT_NOTE);if(typeof toast==='function')toast(n,8000)}}catch{}
  try{if(localStorage.getItem('del_pending'))(typeof connRestored!=='undefined'?connRestored:Promise.resolve()).then(aboutResumeDelete)}catch{}
  aboutReadVersion().then(()=>checkForUpdate());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-aboutLast>ABOUT_FRONT_MS)checkForUpdate()});
  setInterval(()=>{if(document.visibilityState==='visible')checkForUpdate()},ABOUT_CHECK_MS)}
aboutStart();
