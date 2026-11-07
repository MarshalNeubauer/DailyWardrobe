/* Daily Wardrobe: backup and sync through the Cloudflare worker (KV), plus download/restore of a backup file.
   Runs at start-up, a few seconds after any change, when the app comes back to the foreground, and on demand. */
let syncing=false,syncTimer=null,syncAgain=false,syncRun=null;
const syncUrl=()=>{const u=(localStorage.getItem('worker_url')||'').trim();if(!u)return null;try{return new URL('sync',u.endsWith('/')?u:u+'/').href}catch{return null}};
async function localState(){
  const [its,days,tombstones,settings]=await Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('tombstones'),metaGet('settings')]);
  return {items:its||[],days:days||[],tombstones:tombstones||{},settings:settings||null};
}
/* write a merged snapshot into local storage and refresh the screen */
async function applyMerged(m,local){
  const have=Object.fromEntries(local.items.map(i=>[i.id,i]));
  for(const it of m.items)if(!have[it.id]||stamp(have[it.id])!==stamp(it))await putRaw(it);
  const keep=new Set(m.items.map(i=>i.id));
  for(const it of local.items)if(!keep.has(it.id))await tx('readwrite',s=>s.delete(it.id));
  const haveDays=Object.fromEntries(local.days.map(d=>[d.date,d]));
  for(const d of m.days)if(!haveDays[d.date]||(haveDays[d.date].updated||0)!==(d.updated||0))await txs('days','readwrite',s=>s.put(d));
  await metaPut('tombstones',m.tombstones);if(m.settings)await metaPut('settings',m.settings);
  if(stateSig(m)!==stateSig(local)){items=m.items;cache={};if(window.onSyncedData)onSyncedData(m);const v=['today','wardrobe','add'].find(t=>!$('#'+t).hidden);if(v&&v!=='add')show(v)}
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
async function syncOnce(){
  const url=syncUrl(),token=localStorage.getItem('app_token')||'';
  if(!url){setSyncStatus('Set the Worker URL to turn on backup.');return false}
  if(!token){setSyncStatus('Add your App Token (the APP_TOKEN secret on the worker) to turn on backup.');return false}
  syncing=true;setSyncStatus('Syncing…');
  try{
    for(let attempt=0;attempt<3;attempt++){
      const r=await fetch(url,{headers:{'x-app-token':token},cache:'no-store'});const remote=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(remote.error||'HTTP '+r.status);
      const local=await localState(),merged=mergeState(local,remote.data||{});
      await applyMerged(merged,local);
      if(remote.data&&stateSig(merged)===stateSig(remote.data)){localStorage.setItem('last_sync',Date.now());localStorage.removeItem('sync_status');showSyncStatus();return true}
      const p=await fetch(url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,data:merged})});
      if(p.status===409)continue;                       // another device saved first: merge again
      const pr=await p.json().catch(()=>({}));if(!p.ok)throw new Error(pr.error||'HTTP '+p.status);
      localStorage.setItem('last_sync',Date.now());localStorage.removeItem('sync_status');showSyncStatus();return true;
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
