/* Daily Wardrobe: download and restore a backup file (split from sync.js, 2026-11-17); works without a connection (saves to Files on
   iPhone) */
import {cleanState,itemName,items,nm,nowMs,stampAllSettings} from './core.js';
async function downloadBackup(){
  const data={app:'daily-wardrobe',version:1,exported:new Date().toISOString(),...await localState()};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  a.download=`daily-wardrobe-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();try{localStorage.setItem('backup_file_at',Date.now())}catch{}   // (kit.js safariRemind: a copy was kept)
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
async function restoreBackup(file){
  if(!file)return;let data;
  try{data=JSON.parse(await file.text())}catch{tell('That file is not a Daily Wardrobe backup.');return}
  if(!data||data.app!=='daily-wardrobe'||!Array.isArray(data.items)){tell('That file is not a Daily Wardrobe backup.');return}
  const n=data.items.length;data=cleanState(data);   // only records of the app's own shape come in (core.js); the rest is said
  const left=n-data.items.length;
  // the file's settings win, every one, stamped now (fix round 3, W1-11-03: restored right after a wipe, the new setup's newer vest choice
  // and holiday country won the per-setting merge over the file's, under "Restored"); a setting only this phone has stays
  const local=await localState();if(data.settings&&typeof data.settings==='object')data={...data,settings:stampAllSettings({...(local.settings||{}),...data.settings},nowMs())};
  await applyMerged(local,data);
  const n2=items.length,out=left?` ${left} item${left===1?' in the file wasn’t':'s in the file weren’t'} a Daily Wardrobe item and ${left===1?'was':'were'} left out.`:'';
  tell(`Restored. Your wardrobe now has ${n2} item${n2===1?'':'s'}.${out}${restoreGone(data.items)}`);showSyncStatus();scheduleSync();
}
/* the file's pieces that didn't come back (CR-5-03, 2026-11-17): a restore merges, so a piece deleted on this phone after the file was saved
   stays deleted (core.js tombWins), and "Restored" said nothing of it. Named, up to three -> '' or a sentence */
function restoreGone(fileItems){const have=new Set(items.map(i=>i.id)),gone=(fileItems||[]).filter(i=>i&&!have.has(i.id));if(!gone.length)return '';
  const names=gone.slice(0,3).map(i=>`“${itemName(i)||nm(i)}”`),more=gone.length-names.length,list=names.join(', ')+(more?` and ${more} more`:'');
  return ` ${gone.length===1?'1 piece in the file stayed deleted':gone.length+' pieces in the file stayed deleted'}, since ${gone.length===1?'it was':'they were'} deleted after the file was saved: ${list}. Add ${gone.length===1?'it':'them'} again if you still have ${gone.length===1?'it':'them'}.`}
/* the markup's handlers (act.js): Settings' "Download backup", and the file picked with "Restore file" (the field emptied so the same
   file can be picked again) */
function backupSaveTap(){downloadBackup()}
function backupFilePick(el){restoreBackup(el.files[0]);el.value=''}
/* An ES module since 2026-11-23. The bridge (tests/bridge.test.js): kit.js, a classic script, calls downloadBackup; the tests call restoreBackup
   (actsindex, fieldmerge, records, wardrobe); a module imports them */
Object.assign(globalThis,{downloadBackup});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,restoreBackup};
export {downloadBackup,restoreBackup};
acts({backupSaveTap,backupFilePick});
