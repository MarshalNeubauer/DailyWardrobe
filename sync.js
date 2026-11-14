/* Daily Wardrobe: backup and sync through the Cloudflare worker (KV), plus download/restore of a backup file.
   Runs at start-up, a few seconds after any change, when the app comes back to the foreground, and on demand. */
let restoring=false,syncing=false,syncTimer=null,syncAgain=false,syncRun=null,syncDue=0;
const syncUrl=()=>{const u=(localStorage.getItem('worker_url')||'').trim();if(!u)return null;try{return new URL('sync',u.endsWith('/')?u:u+'/').href}catch{return null}};
async function localState(){
  const [its,days,tombstones,settings]=await Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('tombstones'),metaGet('settings')]);
  return {items:its||[],days:days||[],tombstones:tombstones||{},settings:settings||null};
}
/* write a merged snapshot into local storage and refresh the screen.
   Local edits can happen while a sync is in flight, so every write re-checks current storage first:
   nothing newer is overwritten, a deletion made meanwhile is never undone, and tombstones are combined, not replaced. */
async function applyMerged(m,local){
  const tomb=await addTombstones(m.tombstones||{});     // combined atomically with any deletion made meanwhile
  const have=Object.fromEntries(local.items.map(i=>[i.id,i]));
  for(const it of m.items){
    if(have[it.id]&&stamp(have[it.id])===stamp(it))continue;
    if(tomb[it.id]&&tomb[it.id]>=stamp(it))continue;                     // deleted here meanwhile
    // write only if storage doesn't already hold a newer version (checked in the same transaction)
    await atomic('items',it.id,cur=>cur&&stamp(cur)>=stamp(it)?null:{put:it});
  }
  const keep=new Set(m.items.map(i=>i.id));
  for(const it of local.items)if(!keep.has(it.id))await atomic('items',it.id,cur=>cur&&stamp(cur)<=stamp(it)?{del:true}:null);
  const haveDays=Object.fromEntries(local.days.map(d=>[d.date,d]));
  for(const d of m.days)if(!haveDays[d.date]||(haveDays[d.date].updated||0)!==(d.updated||0)){
    await atomic('days',d.date,cur=>!cur||(cur.updated||0)<(d.updated||0)?{put:d}:null)}
  if(m.settings){const cs=await metaGet('settings');if(!cs||(cs.updated||0)<=(m.settings.updated||0))await metaPut('settings',m.settings)}
  const now=await localState();
  if(stateSig(now)!==stateSig(local)){items=now.items;cache={};if(window.onSyncedData)onSyncedData(now);syncRedraw(['today','wardrobe','add','stats'].find(t=>!$('#'+t).hidden))}
  return now;
}
/* after a sync brought changes: redraw the tab on screen. show() and renderToday() close Settings, which snapped shut when it was
   opened in the first seconds after launch and the start-up sync (scheduleSync, 2.5 s) came back with changes; while it is open,
   the tab waits for it to close (todayStale, viewStale) */
function syncRedraw(v){if(!v||v==='add')return;if(!settingsOpen())return show(v);if(v==='today')todayStale=true;else viewStale=v}
function setSyncStatus(t){localStorage.setItem('sync_status',t);showSyncStatus()}
/* a backup already made is said while the next one runs: synced() clears sync_status while `syncing` is still true, and this line read
   "Not backed up yet." under a summary saying "Backed up today" (audit 2026-11-13) */
function showSyncStatus(){const el=$('#sync-status');if(!el)return;const last=+localStorage.getItem('last_sync')||0,st=localStorage.getItem('sync_status')||'';
  if(last&&!/failed|turn on/i.test(st))el.textContent=`Backed up ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${items.length} item${items.length===1?'':'s'}${/^Syncing/.test(st)?' · syncing…':''}`;
  else el.textContent=st||(syncUrl()?'Not backed up yet.':'Not connected.')}
/* a sync requested while one is running waits for it and then runs again, so nothing changed meanwhile is missed */
async function syncNow(){
  if(syncRun){await syncRun.catch(()=>{});if(syncRun)await syncRun.catch(()=>{})}
  syncRun=syncOnce();try{return await syncRun}finally{syncRun=null}
}
/* what this device last agreed on with the worker: the backup's version and a fingerprint of the wardrobe at that moment.
   While both still hold, a sync is one tiny request: nothing is downloaded or uploaded (the backup is several MB of photos). */
const syncMark=()=>{try{const m=JSON.parse(localStorage.getItem('sync_mark')||'null');return m&&m.url===syncUrl()&&m.v&&m.sig?m:null}catch{return null}};
const setSyncMark=(rev,saved,sig)=>{try{localStorage.setItem('sync_mark',JSON.stringify({url:syncUrl(),v:rev+':'+saved,sig}))}catch{}};
const synced=()=>{syncDue=0;localStorage.setItem('last_sync',Date.now());localStorage.removeItem('sync_status');showSyncStatus()};
/* an invitation that was switched off: said once, and the app stops trying (localStorage.invite_ended holds that code) */
const ENDED='Your invitation has ended. Your wardrobe stays on this phone, and the app keeps working without a connection.';
function inviteEnded(token){if(localStorage.getItem('invite_ended')===token)return;localStorage.setItem('invite_ended',token);if(typeof tell==='function')tell(ENDED)}
/* a tester's backups for the day are used up (the server's limit): no more uploads until the next UTC day */
const nextUtcDay=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)};
/* ---- the small sync (worker.js syncLiteGet / syncLitePost). A newer worker answers GET /sync?lite=1&since=<the version last agreed
   on> with only the records changed since, with photos as references (dwph:<hash>), every tombstone, and what it holds of each record
   (idx: its stamp); this device fetches only the photos it lacks (?ph=), merges, and POSTs only the records newer than the backup's,
   with the photos the backup lacks. A day marked worn is a few hundred bytes each way, where the whole backup (photos and all) was
   16 MB. An older worker ignores lite and since and answers as before (the whole backup, or same), and then the old way runs. ---- */
const PH_MIN=256,PH_RE=/^dwph:[0-9a-f]{20}$/,PH_BATCH=40;
const SYNC_LITE=!self.SYNC_OLD;   // (window.SYNC_OLD: sync the whole backup every time, as before; a test plays an older app with it)
const isPh=s=>typeof s==='string'&&s.length>=PH_MIN&&s.startsWith('data:');
const phMemo=new Map();
async function phHash(s){let h=phMemo.get(s);if(h)return h;
  const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));h=[...d.subarray(0,10)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(phMemo.size>2000)phMemo.clear();phMemo.set(s,h);return h}
function phStrings(x,test,out=new Set()){if(typeof x==='string'){if(test(x))out.add(x)}else if(Array.isArray(x))for(const v of x)phStrings(v,test,out);else if(x&&typeof x==='object')for(const k in x)phStrings(x[k],test,out);return out}
function phMap(x,f){if(typeof x==='string')return f(x);if(Array.isArray(x))return x.map(v=>phMap(v,f));if(x&&typeof x==='object'){const o={};for(const k in x)o[k]=phMap(x[k],f);return o}return x}
/* the references in records from the backup, replaced by the photos: this device's own copy when it has it (the same item's photos are
   compared), else downloaded, PH_BATCH at a time */
async function phIn(recs,local,url,token){
  const refs=[...phStrings(recs,s=>PH_RE.test(s))].map(s=>s.slice(5));if(!refs.length)return recs;
  const ids=new Set((recs.items||[]).map(i=>i.id)),known=new Map();
  for(const s of phStrings([local.items.filter(i=>ids.has(i.id)),local.days,local.settings],isPh))known.set(await phHash(s),s);
  const need=refs.filter(h=>!known.has(h));
  for(let i=0;i<need.length;i+=PH_BATCH){const r=await fetch(url+'?ph='+need.slice(i,i+PH_BATCH).join(','),{headers:{'x-app-token':localStorage.getItem('app_token')||token},cache:'no-store'}),j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.message||j.error||'HTTP '+r.status);for(const [h,s] of Object.entries(j.photos||{}))if(isPh(s))known.set(h,s)}
  if(refs.some(h=>!known.has(h)))throw new Error('a photo is missing from the backup');
  return phMap(recs,s=>PH_RE.test(s)?known.get(s.slice(5)):s)}
/* records to send: photos as references, and the photos the backup doesn't have (have: its hashes) */
async function phOut(recs,have){const strs=[...phStrings(recs,isPh)],by=new Map(),photos={};
  for(const s of strs){const h=await phHash(s);by.set(s,h);if(!have.has(h))photos[h]=s}
  return {recs:by.size?phMap(recs,s=>by.has(s)?'dwph:'+by.get(s):s):recs,photos}}
/* one round of the small sync, after GET ?lite=1 answered remote: true/false as syncOnce, or {again:{since, all, legacy}} */
async function syncLite(remote,local,url,token,inline){
  const got=await phIn({items:remote.items||[],days:remote.days||[],tombstones:remote.tombstones||{},settings:remote.settings||null},local,url,token);
  if(typeof adoptBackupSettings==='function')await adoptBackupSettings(local,got);   // a device's first contact with a backup (safety.js): its settings win
  const now=mergeState(await applyMerged(mergeState(local,got),local),got),ix=remote.idx||{i:{},d:{},s:-1},tomb=remote.tombstones||{};
  // everything the backup holds must be here now; when not (storage cleared, a marker from another backup), ask for all of it
  const has=Object.fromEntries(now.items.map(i=>[i.id,stamp(i)])),hasD=Object.fromEntries(now.days.map(d=>[d.date,d.updated||0]));
  const lacks=Object.entries(ix.i).some(([id,s])=>!(id in has?has[id]>=s:(now.tombstones[id]||0)>=s))||Object.entries(ix.d).some(([d,u])=>!(d in hasD)||hasD[d]<u)||(ix.s>0&&!(now.settings&&(now.settings.updated||0)>=ix.s));
  if(lacks&&!remote.all)return {again:{all:true}};
  // what the backup lacks: records newer than its own, tombstones it doesn't have
  const up={items:now.items.filter(i=>!(i.id in ix.i)||stamp(i)>ix.i[i.id]),days:now.days.filter(d=>!(d.date in ix.d)||(d.updated||0)>ix.d[d.date]),
    tombstones:Object.fromEntries(Object.entries(now.tombstones).filter(([id,t])=>!(id in tomb)||tomb[id]<t))};
  if(now.settings&&(now.settings.updated||0)>(ix.s??-1))up.settings=now.settings;
  if(!up.items.length&&!up.days.length&&!up.settings&&!Object.keys(up.tombstones).length){setSyncMark(remote.rev,remote.saved,stateSig(now));synced();restoring=false;return true}
  if((+localStorage.getItem('sync_pause')||0)>Date.now()){setSyncStatus(localStorage.getItem('sync_pause_msg')||'Today’s backups are used up.');return false}
  const have=new Set(remote.ph||[]);for(const h of inline)have.delete(h);
  const {recs,photos}=await phOut(up,have);
  const p=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,baseSaved:remote.saved||0,day:isoKey(new Date()),...(restoring?{reason:'restore'}:{}),delta:recs,photos})});
  const pr=await p.json().catch(()=>({})),since=`${remote.rev||0}:${remote.saved||0}`;
  if(p.status===409)return {again:{since}};                                   // another device saved first: what it saved, then again
  if(p.status===400&&Array.isArray(pr.missing)){pr.missing.forEach(h=>inline.add(h));return {again:{since}}}
  if(p.status===422&&pr.error==='legacy')return {again:{legacy:true}};          // a backup the server can't index: the whole of it
  if(p.status===429&&pr.what==='backup'){localStorage.setItem('sync_pause',nextUtcDay());localStorage.setItem('sync_pause_msg',pr.message||'Today’s backups are used up.');setSyncStatus(pr.message||'Today’s backups are used up.');return false}
  if(p.status===403&&pr.error==='invite off'){inviteEnded(token);setSyncStatus(ENDED);return false}
  if(!p.ok)throw new Error(pr.message||pr.error||'HTTP '+p.status);
  setSyncMark(pr.rev,pr.saved,stateSig(now));synced();restoring=false;
  if(stateSig(await localState())!==stateSig(mergeState(now,{})))scheduleSync();   // something changed while uploading
  return true}
async function syncOnce(){
  const url=syncUrl(),token=localStorage.getItem('app_token')||'';
  if(!url){setSyncStatus('Not connected.');return false}
  if(!token){setSyncStatus('Not connected: paste your invite link under Connection.');return false}
  if(localStorage.getItem('invite_ended')===token){setSyncStatus(ENDED);return false}
  syncing=true;setSyncStatus('Syncing…');
  try{
    let lite=SYNC_LITE&&!!(self.crypto&&crypto.subtle),since=null,all=false,full=0;const inline=new Set();
    for(let attempt=0;attempt<6;attempt++){
      // nothing changed here since the last sync: ask only whether the backup is still that version
      const mark=attempt?null:syncMark(),local=await localState(),quick=!!mark&&stateSig(mergeState(local,{}))===mark.sig,last=syncMark();
      let q=quick?'?v='+encodeURIComponent(mark.v):'';
      if(lite){const s=all?null:since||(last&&last.v);q='?lite=1'+(s?'&since='+encodeURIComponent(s):'')+(quick?'&v='+encodeURIComponent(mark.v):'')}
      const r=await fetch(url+q,{headers:{'x-app-token':token},cache:'no-store'});const remote=await r.json().catch(()=>({}));
      if(r.status===403&&remote.error==='invite off'){inviteEnded(token);setSyncStatus(ENDED);return false}
      if(!r.ok)throw new Error(remote.message||remote.error||'HTTP '+r.status);
      if(quick&&remote.same){synced();return true}
      if(remote.lite===1){const res=await syncLite(remote,local,url,token,inline);if(!res||res===true)return res;
        const a=res.again;if(a.all)all=true;if(a.since){since=a.since;all=false}if(a.legacy)lite=false;continue}
      if(++full>3)break;
      if(typeof adoptBackupSettings==='function')await adoptBackupSettings(local,remote.data);   // a device's first contact with a backup: the backup's settings win (safety.js)
      const merged=mergeState(local,remote.data||{});
      // upload what is actually stored now (it may include edits made during this sync)
      const now=mergeState(await applyMerged(merged,local),remote.data||{});
      if(remote.data&&stateSig(now)===stateSig(remote.data)){setSyncMark(remote.rev,remote.saved,stateSig(now));synced();return true}
      if((+localStorage.getItem('sync_pause')||0)>Date.now()){setSyncStatus(localStorage.getItem('sync_pause_msg')||'Today’s backups are used up.');return false}
      const p=await fetch(url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,day:isoKey(new Date()),...(restoring?{reason:'restore'}:{}),data:now})});   // data last: the server reads a large backup's few leading fields without parsing the whole
      if(p.status===409)continue;                       // another device saved first: merge again
      const pr=await p.json().catch(()=>({}));
      if(p.status===429&&pr.what==='backup'){localStorage.setItem('sync_pause',nextUtcDay());localStorage.setItem('sync_pause_msg',pr.message||'Today’s backups are used up.');setSyncStatus(pr.message||'Today’s backups are used up.');return false}
      if(p.status===403&&pr.error==='invite off'){inviteEnded(token);setSyncStatus(ENDED);return false}
      if(!p.ok)throw new Error(pr.message||pr.error||'HTTP '+p.status);
      setSyncMark(pr.rev,pr.saved,stateSig(now));synced();restoring=false;
      if(stateSig(await localState())!==stateSig(mergeState(now,{})))scheduleSync();   // something changed while uploading
      return true;
    }
    throw new Error('another device kept saving at the same time; try again');
  }catch(e){setSyncStatus('Backup failed: '+(e.message||e));return false}
  finally{syncing=false}
}
/* after a change: the owner's phone backs up 2.5 s later. A tester's waits until the app goes to the background or closes, or 15
   minutes after the first change still waiting (TESTER_SYNC_MS), so every tap doesn't upload the whole wardrobe (several MB). */
const TESTER_SYNC_MS=15*60000;
function scheduleSync(){clearTimeout(syncTimer);
  if(typeof isTester==='function'&&isTester()){if(!syncDue)syncDue=Date.now();syncTimer=setTimeout(syncNow,Math.max(1000,syncDue+TESTER_SYNC_MS-Date.now()));return}
  syncTimer=setTimeout(syncNow,2500)}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&syncDue)syncNow();   // a tester's waiting changes, as the app closes
  else if(document.visibilityState==='visible'&&Date.now()-(+localStorage.getItem('last_sync')||0)>60000)syncNow()});
addEventListener('pagehide',()=>{if(syncDue)syncNow()});

/* backup file: works without Cloudflare (saves to Files on iPhone) */
async function downloadBackup(){
  const data={app:'daily-wardrobe',version:1,exported:new Date().toISOString(),...await localState()};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  a.download=`daily-wardrobe-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
async function restoreBackup(file){
  if(!file)return;let data;
  try{data=JSON.parse(await file.text())}catch{tell('That file is not a Daily Wardrobe backup.');return}
  if(data.app!=='daily-wardrobe'||!Array.isArray(data.items)){tell('That file is not a Daily Wardrobe backup.');return}
  const local=await localState();await applyMerged(mergeState(local,data),local);
  tell(`Restored. Your wardrobe now has ${items.length} item${items.length===1?'':'s'}.`);showSyncStatus();scheduleSync();
}
/* ---- daily backups on the worker (snap:<day> / snap:<month> / snap:before-restore) ---- */
const snapLabel=s=>{const t=new Date(s.saved).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  return s.id==='before-restore'?`Before the last roll-back (${t})`:/^\d{4}-\d{2}$/.test(s.id)?`Start of ${new Date(s.id+'-02').toLocaleDateString(undefined,{month:'long',year:'numeric'})} (${t})`:t};
async function loadSnapshots(){const sel=$('#snap-list'),st=$('#snap-status'),url=syncUrl(),token=localStorage.getItem('app_token')||'';if(!sel||sel.dataset.loaded)return;
  if(!url||!token){st.textContent=NEED_CONN;return}
  try{const r=await fetch(url+'?snaps=1',{headers:{'x-app-token':token},cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'HTTP '+r.status);
    sel.dataset.loaded=1;const list=j.snaps||[];
    sel.innerHTML=`<option value="">${list.length?'Choose a day…':'No daily backups yet'}</option>`+list.map(s=>`<option value="${s.id}">${snapLabel(s)}</option>`).join('');
    st.textContent=list.length?`${list.length} kept. Each is the wardrobe before that day's first change.`:'The first one is kept the next time something changes.'}
  catch(e){st.textContent='Could not list the daily backups: '+(e.message||e)}}
/* the wardrobe exactly as in snapshot s, made to win the merge everywhere: its items, days and settings get a new stamp, and
   anything not in it gets a tombstone (days after it are kept: they hold no wardrobe, and there is no deleting a day) */
function rollBackState(local,snap,now=Date.now()){
  const items=(snap.items||[]).map(i=>({...i,updated:now})),keep=new Set(items.map(i=>i.id)),tombstones={...(snap.tombstones||{})};
  for(const id of Object.keys(tombstones))if(keep.has(id))delete tombstones[id];
  for(const i of local.items||[])if(!keep.has(i.id))tombstones[i.id]=now;
  return {items,tombstones,days:(snap.days||[]).map(d=>({...d,updated:now})),settings:snap.settings?{...snap.settings,updated:now}:null}}
async function rollBack(){const id=$('#snap-list')&&$('#snap-list').value,st=$('#snap-status'),url=syncUrl(),token=localStorage.getItem('app_token')||'';
  if(!id){st.textContent='Choose a day first.';return}
  if(!await askConfirm(`Roll back to ${$('#snap-list').selectedOptions[0].textContent}?\n\nThe wardrobe, day history and settings on every device become that copy. The current state is kept as “Before the last roll-back”, so this can be undone.`,{ok:'Roll back',danger:true}))return;
  try{st.textContent='Rolling back…';await syncNow();
    const r=await fetch(url+'?snap='+encodeURIComponent(id),{headers:{'x-app-token':token},cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'HTTP '+r.status);
    if(!j.data||!Array.isArray(j.data.items))throw new Error('that backup is empty');
    const local=await localState(),next=rollBackState(local,j.data);
    await applyMerged(mergeState(local,next),local);
    restoring=true;const ok=await syncNow();delete $('#snap-list').dataset.loaded;
    st.textContent=ok?`Rolled back. The wardrobe has ${items.length} item${items.length===1?'':'s'}.`:`Rolled back on this device (${items.length} item${items.length===1?'':'s'}), but the backup could not be updated yet: ${localStorage.getItem('sync_status')||''}`}
  catch(e){st.textContent='Roll back failed: '+(e.message||e)}}
db.then(()=>setTimeout(syncNow,300));
