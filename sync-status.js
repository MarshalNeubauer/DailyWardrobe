/* Daily Wardrobe: what Backup & sync says (split from sync.js, 2026-11-17): the status line. Loaded right after sync.js since the
   restructure S3b (2026-11-26), which moved the backup's state (the status, the pause until the next UTC day, the words for an offline
   server and for Connection and the setup) into sync.js and an ended invitation into who.js; this file draws the line from them. */
import {on} from './bus.js';
/* a backup already made is said while the next one runs: synced() clears sync_status while `syncing` is still true, and this line read
   "Not backed up yet." under a summary saying "Backed up today" (audit 2026-11-13) */
function showSyncStatus(){const sum=$('#sum-backup');if(sum)try{sum.textContent=backupSummary(localStorage.getItem('worker_url'))}catch{}   // the Backup category's summary follows (it read "Backed up today" while offline)
  const el=$('#sync-status');if(!el)return;const last=+localStorage.getItem('last_sync')||0,st=localStorage.getItem('sync_status')||'';
  if(inviteOver()){el.textContent=ENDED;return}   // not "Backed up …": nothing backs up any more
  // backups paused (the day's saves used up): said, not hidden behind the last backup's time (2026-11-14: the owner saw only "Backed up 10:28"
  // and a Sync now that did nothing)
  const lastTxt=last?` Last backed up ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}.`:'';
  if(syncPaused()){el.textContent=(localStorage.getItem('sync_pause_msg')||'Today’s backups are used up.')+lastTxt;return}
  // offline or unreachable: said, with the last backup's time
  if(syncWaiting(st)||st===WIPED_SYNC||/^Backing up/.test(st)){el.textContent=st+lastTxt;return}   // (and photos going up in batches: how many are left)
  if(last&&!/failed|turn on/i.test(st))el.textContent=`Backed up ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${items.length} item${items.length===1?'':'s'}${/^Syncing/.test(st)?' · syncing…':''}`;
  else el.textContent=st||(syncUrl()?'Not backed up yet.':'Not connected.'+safariWord())}
/* not connected, in a Safari tab: why the backup file matters (decision 2 for W1-11-04; the setup's Home Screen step said it once) */
const safariWord=()=>safariTab()?` ${tabBrowser()} can clear a website’s data when it isn’t opened for about a week or the phone runs short of space: Download backup now and then keeps a copy in Files.`:'';
/* An ES module (2026-11-23): its names are its own. The bridge (tests/bridge.test.js lists it): backupfile.js draws the line after a
   restore; the addcards and backup-storage tests too. */
Object.assign(globalThis,{showSyncStatus});
/* the notice board (bus.js): what this file does when Settings announces it (settings.js no longer names this file) */
on('settings-open',()=>showSyncStatus());   // the Backup line, as Settings opens
on('backup-changed',()=>showSyncStatus());   // the backup's status changed (sync.js)
on('invite-ended',()=>showSyncStatus());   // the invitation has ended (who.js inviteEnded): nothing backs up any more
export {showSyncStatus};
