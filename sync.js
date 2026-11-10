/* Daily Wardrobe: backup and sync through the Cloudflare worker (KV), plus download/restore of a backup file.
   Runs at start-up, a few seconds after any change, when the app comes back to the foreground, and on demand. */
let syncing=false,syncTimer=null,syncAgain=false,syncRun=null;
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
  if(stateSig(now)!==stateSig(local)){items=now.items;cache={};if(window.onSyncedData)onSyncedData(now);const v=['today','wardrobe','add'].find(t=>!$('#'+t).hidden);if(v&&v!=='add')show(v)}
  return now;
}
function setSyncStatus(t){localStorage.setItem('sync_status',t);showSyncStatus()}
function showSyncStatus(){const el=$('#sync-status');if(!el)return;const last=+localStorage.getItem('last_sync')||0;
  el.textContent=localStorage.getItem('sync_status')||(syncUrl()?'Not backed up yet.':'Set the Worker URL to turn on backup.');
  if(last&&!syncing&&!/failed|turn on/i.test(el.textContent))el.textContent=`Backed up ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${items.length} items`}
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
  if(!url){setSyncStatus('Set the Worker URL to turn on backup.');return false}
  if(!token){setSyncStatus('Add your App Token (the APP_TOKEN secret on the worker) to turn on backup.');return false}
  syncing=true;setSyncStatus('Syncing…');
  try{
    for(let attempt=0;attempt<3;attempt++){
      // nothing changed here since the last sync: ask only whether the backup is still that version
      const mark=attempt?null:syncMark(),local=await localState(),quick=!!mark&&stateSig(mergeState(local,{}))===mark.sig;
      const r=await fetch(url+(quick?'?v='+encodeURIComponent(mark.v):''),{headers:{'x-app-token':token},cache:'no-store'});const remote=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(remote.error||'HTTP '+r.status);
      if(quick&&remote.same){synced();return true}
      const merged=mergeState(local,remote.data||{});
      // upload what is actually stored now (it may include edits made during this sync)
      const now=mergeState(await applyMerged(merged,local),remote.data||{});
      if(remote.data&&stateSig(now)===stateSig(remote.data)){setSyncMark(remote.rev,remote.saved,stateSig(now));synced();return true}
      const p=await fetch(url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,data:now})});
      if(p.status===409)continue;                       // another device saved first: merge again
      const pr=await p.json().catch(()=>({}));if(!p.ok)throw new Error(pr.error||'HTTP '+p.status);
      setSyncMark(pr.rev,pr.saved,stateSig(now));synced();
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
  try{data=JSON.parse(await file.text())}catch{alert('That file is not a Daily Wardrobe backup.');return}
  if(data.app!=='daily-wardrobe'||!Array.isArray(data.items)){alert('That file is not a Daily Wardrobe backup.');return}
  const local=await localState();await applyMerged(mergeState(local,data),local);
  alert(`Restored. Your wardrobe now has ${items.length} items.`);showSyncStatus();scheduleSync();
}
db.then(()=>setTimeout(syncNow,300));
