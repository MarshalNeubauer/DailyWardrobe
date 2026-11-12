/* Daily Wardrobe: backup and sync through the Cloudflare worker (KV), plus download/restore of a backup file.
   Runs at start-up, a few seconds after any change, when the app comes back to the foreground, and on demand. */
let restoring=false,syncing=false,syncTimer=null,syncAgain=false,syncRun=null;
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
function showSyncStatus(){const el=$('#sync-status');if(!el)return;const last=+localStorage.getItem('last_sync')||0;
  el.textContent=localStorage.getItem('sync_status')||(syncUrl()?'Not backed up yet.':'Not connected: connect in Settings → Connection to turn on backup.');
  if(last&&!syncing&&!/failed|turn on/i.test(el.textContent))el.textContent=`Backed up ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${items.length} item${items.length===1?'':'s'}`}
/* a sync requested while one is running waits for it and then runs again, so nothing changed meanwhile is missed */
async function syncNow(){
  if(syncRun){await syncRun.catch(()=>{});if(syncRun)await syncRun.catch(()=>{})}
  syncRun=syncOnce();try{return await syncRun}finally{syncRun=null}
}
/* what this device last agreed on with the worker: the backup's version and a fingerprint of the wardrobe at that moment.
   While both still hold, a sync is one tiny request: nothing is downloaded or uploaded (the backup is several MB of photos). */
const syncMark=()=>{try{const m=JSON.parse(localStorage.getItem('sync_mark')||'null');return m&&m.url===syncUrl()&&m.v&&m.sig?m:null}catch{return null}};
const setSyncMark=(rev,saved,sig)=>{try{localStorage.setItem('sync_mark',JSON.stringify({url:syncUrl(),v:rev+':'+saved,sig}))}catch{}};
const synced=()=>{localStorage.setItem('last_sync',Date.now());localStorage.removeItem('sync_status');showSyncStatus()};
async function syncOnce(){
  const url=syncUrl(),token=localStorage.getItem('app_token')||'';
  if(!url){setSyncStatus('Not connected: connect in Settings → Connection to turn on backup.');return false}
  if(!token){setSyncStatus('The connection has no code yet: add it in Settings → Connection to turn on backup.');return false}
  syncing=true;setSyncStatus('Syncing…');
  try{
    for(let attempt=0;attempt<3;attempt++){
      // nothing changed here since the last sync: ask only whether the backup is still that version
      const mark=attempt?null:syncMark(),local=await localState(),quick=!!mark&&stateSig(mergeState(local,{}))===mark.sig;
      const r=await fetch(url+(quick?'?v='+encodeURIComponent(mark.v):''),{headers:{'x-app-token':token},cache:'no-store'});const remote=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(remote.error||'HTTP '+r.status);
      if(quick&&remote.same){synced();return true}
      if(typeof adoptBackupSettings==='function')await adoptBackupSettings(local,remote.data);   // a device's first contact with a backup: the backup's settings win (safety.js)
      const merged=mergeState(local,remote.data||{});
      // upload what is actually stored now (it may include edits made during this sync)
      const now=mergeState(await applyMerged(merged,local),remote.data||{});
      if(remote.data&&stateSig(now)===stateSig(remote.data)){setSyncMark(remote.rev,remote.saved,stateSig(now));synced();return true}
      const p=await fetch(url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,day:isoKey(new Date()),...(restoring?{reason:'restore'}:{}),data:now})});   // data last: the server reads a large backup's few leading fields without parsing the whole
      if(p.status===409)continue;                       // another device saved first: merge again
      const pr=await p.json().catch(()=>({}));if(!p.ok)throw new Error(pr.error||'HTTP '+p.status);
      setSyncMark(pr.rev,pr.saved,stateSig(now));synced();restoring=false;
      if(stateSig(await localState())!==stateSig(mergeState(now,{})))scheduleSync();   // something changed while uploading
      return true;
    }
    throw new Error('another device kept saving at the same time; try again');
  }catch(e){setSyncStatus('Backup failed: '+(e.message||e));return false}
  finally{syncing=false}
}
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,2500)}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-(+localStorage.getItem('last_sync')||0)>60000)syncNow()});

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
