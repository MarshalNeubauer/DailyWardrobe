/* Daily Wardrobe: backup and sync through the Cloudflare worker (KV).
   Runs at start-up, a few seconds after any change, when the app comes back to the foreground, and on demand.
   Its other parts (split 2026-11-17, the code review's sync plan): sync-status.js (what Backup & sync says; loaded right after this
   file since the restructure S3b, which moved the pause and the status here and an ended invitation to who.js), sync-photos.js (photos as references, batches), snapshots.js (daily backups, Roll back),
   backupfile.js (download and restore a file); what of the sample wardrobe goes up is kit.js kitShareFilter. */
import {on,emit,serve} from './bus.js';
let restoring=false,syncing=false,syncTimer=null,syncAgain=null,syncRun=null,syncDue=0;
/* a roll-back waiting for its upload (2026-11-15, the audit: Safari killed 200 ms after "Roll back" left the rolled-back wardrobe on the
   phone, and the next start's sync uploaded it as an ordinary save, so the server never kept "Before the last roll-back" and 24 pieces
   were gone for good). Marked in localStorage (sync_restore = the code it is for) before the phone's copy is changed, so every upload until
   one goes through carries reason 'restore' and the worker keeps the copy it replaces, after a kill or reload too */
const restoreWanted=()=>{if(restoring)return true;try{const t=localStorage.getItem('sync_restore');return !!t&&t===localStorage.getItem('app_token')}catch{return false}};
function restoreDone(){restoring=false;try{localStorage.removeItem('sync_restore')}catch{}}
/* the backup's own state (the restructure S3b, 2026-11-26: moved here from sync-status.js, which draws the Backup line from it and comes
   right after this file): the status kept in localStorage sync_status, the pause until the next UTC day, the words for an offline or
   unreachable server, and what Connection and the setup say about backups. A change of the status announces 'backup-changed' (bus.js) */
// a tester reads a server set-up error in plain words (plainErr, ui.js); the owner, or a connection whose role isn't known yet, the server's sentence
function setSyncStatus(t){if(typeof isTester==='function'&&isTester()){const p=plainErr(t);if(p!==t)t='Backup failed: '+p}localStorage.setItem('sync_status',t);emit('backup-changed')}   // (the Backup line: sync-status.js, through bus.js)
const tabBrowser=()=>typeof homeBrowser==='function'?homeBrowser():'Safari';
/* a backup that couldn't reach the server (Safari's "Load failed", Chrome's "Failed to fetch"): plain words, not the browser's -> text or null.
   (2026-11-15, the audit: "Backup failed: Load failed") */
function syncNetText(e){const m=String(e&&e.message||e||'');if(!netErr(m))return null;
  return navigator.onLine===false?OFFLINE_SYNC:UNREACHED_SYNC}
const OFFLINE_SYNC='Not backed up: you’re offline. Your changes are kept on this phone and back up when you’re online again.';
const UNREACHED_SYNC='Not backed up: the server couldn’t be reached. Your changes are kept on this phone and back up later.';
const syncWaiting=st=>/^Not backed up:/.test(st||'');
/* a tester's backups for the day are used up (the server's limit): no more uploads until the next UTC day, by the corrected time (core.js
   nowMs); a pause further off than a day and a bit was set by a clock that was ahead (the audit's W1-9-06: a year-long pause) and is let go */
const nextUtcDay=()=>{const d=new Date(nowMs());return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)};
/* uploads paused until the next UTC day, with the sentence that says why (CR-5-13: written four times) -> false, what syncOnce returns */
function pauseTillTomorrow(m){localStorage.setItem('sync_pause',nextUtcDay());localStorage.setItem('sync_pause_msg',m);setSyncStatus(m);return false}
function syncPaused(){const p=+localStorage.getItem('sync_pause')||0;if(!p)return false;const t=nowMs();
  if(p>t+26*3600e3){localStorage.removeItem('sync_pause');localStorage.removeItem('sync_pause_msg');return false}return p>t}
/* why uploads pause until the next UTC day: a tester's own daily backups used up (the server's message), or the server's whole allowance of
   saves for the day (2026-11-14, error 'kv-limit': Cloudflare's 1,000 writes a day), said in words with the local time it resets */
/* the server's room for new photos used up (pr.write): everyone's (pr.all) or this tester's own, said as such, without the server's
   "(0 of 6 new photos are saved)" (2026-11-15, the audit: the shared ceiling read "your backups") */
/* in a Safari tab on an iPhone or iPad (kit.js), where Safari may clear a site's data: the pause adds a word about the backup file (W1-11-06) */
const safariTab=()=>typeof homeIOS==='function'&&homeIOS()&&!homeStandalone();
const SAFARI_KEEP=()=>` ${tabBrowser()} can clear a website’s data, so Download backup in Settings → Backup & sync keeps a copy meanwhile.`;
const backupFullMsg=pr=>{let at='';try{at=new Date(nextUtcDay()).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch{}
  const after=`Your changes are kept on this phone and back up after ${at||'midnight UTC'}.${safariTab()?SAFARI_KEEP():''}`;
  if(pr&&pr.error==='kv-limit')return `Today’s backups are used up on the server. ${after}`;
  if(pr&&pr.write)return pr.all?`Today’s room on the server for everyone’s backups is used up. ${after}`:`Today’s room on the server for your backups is used up. ${after}`;
  return (pr&&pr.message)||'Today’s backups are used up.'};
/* what Connection and the setup say about backups: "is backed up", unless backups are paused (W1-10-04, W1-11-06: "✓ Connected … and your
   wardrobe is backed up" while the server held none of the day's items) */
function backedUpWords(){const p=+localStorage.getItem('sync_pause')||0;if(p<=nowMs())return 'your wardrobe is backed up';
  let at='';try{at=new Date(p).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch{}
  return `your wardrobe is backed up, though not right now: backups are paused until ${at||'tomorrow'}, and your newest changes are only on this phone until then`}
const syncUrl=()=>{const u=(localStorage.getItem('worker_url')||'').trim();if(!u)return null;try{return new URL('sync',u.endsWith('/')?u:u+'/').href}catch{return null}};
async function localState(){
  const [its,days,tombstones,settings]=await Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('tombstones'),metaGet('settings')]);
  return {items:its||[],days:days||[],tombstones:tombstones||{},settings:settings||null};
}
/* merge incoming records (a backup, a file, a roll-back copy) with local (this phone's copy as read before), write the result into local
   storage and refresh the screen.
   Local edits can happen while a sync is in flight, so every write merges with what storage holds now, in the same transaction (core.js
   mergeItem / mergeDay): an edit made meanwhile is kept field by field, a deletion made meanwhile is never undone, and tombstones are
   combined, not replaced. (CR-5-01, 2026-11-17: the write was decided by stamps alone, so a day whose merge winner was the older copy, a
   change from another phone that beat this phone's own week lock, core.js dayWins, was never written and the phones disagreed for good) */
async function applyMerged(local,incoming){const m=mergeState(local,incoming);
  const tomb=await addTombstones(m.tombstones||{});     // combined atomically with any deletion made meanwhile
  const have=Object.fromEntries(local.items.map(i=>[i.id,i]));
  for(const it of m.items){
    if(have[it.id]&&stamp(have[it.id])===stamp(it))continue;
    if(tombWins(tomb[it.id],it))continue;                     // deleted here meanwhile
    await atomic('items',it.id,cur=>{const w=cur?mergeItem(cur,it):it;return w===cur?null:{put:w}});
  }
  const keep=new Set(m.items.map(i=>i.id)),dropped=[];
  for(const it of local.items)if(!keep.has(it.id)){
    // an edit made here after the piece was deleted on another phone isn't kept (core.js tombWins): said, not silently dropped (W1-5-05)
    if(tomb[it.id]&&stamp(it)>tomb[it.id])dropped.push(itemName(it)||nm(it));
    await atomic('items',it.id,cur=>cur&&stamp(cur)<=stamp(it)?{del:true}:null)}
  if(dropped.length)tell(dropped.length===1?`“${dropped[0]}” was deleted on another phone, so your change to it wasn’t kept.`:`${dropped.length} pieces were deleted on another phone, so your changes to them weren’t kept.`);
  const haveDays=Object.fromEntries(local.days.map(d=>[d.date,d]));
  for(const d of m.days)if(!haveDays[d.date]||(haveDays[d.date].updated||0)!==(d.updated||0)){
    await atomic('days',d.date,cur=>{const w=cur?mergeDay(cur,d):d;return w===cur?null:{put:w}})}
  // settings as the merge of the stored copy with the incoming one, setting by setting (core.js mergeSettings; the rest of CR-5-09, Round C:
  // decided by stamps alone, a setting changed here during the sync kept the stored copy whole and the other phone's setting was not written)
  if(m.settings)await atomic('meta','settings',r=>{const cur=r&&r.v,w=cur?mergeSettings(cur,m.settings):m.settings;return w===cur?null:{put:{k:'settings',v:w}}});
  const now=await localState();
  if(stateSig(now)!==stateSig(local)){const open=editing&&items.find(i=>i.id===editing);
    setWardrobe({items:now.items});planDirty();if(window.onSyncedData)onSyncedData(now);syncRedraw(['today','wardrobe','add','stats'].find(t=>!$('#'+t).hidden));syncSettingsRedraw();
    if(open)itemSynced(open)}   // the item sheet follows the new copy (item-view.js)
  return now;
}
/* Settings open while a sync brought changes: its controls are drawn again from the merged settings (2026-11-15, the audit: the Suit vest
   and Dark shirts dropdowns kept the old value until Settings was closed and opened again, and a user could "fix" it back). Not while a
   field in it is being typed in: then once the field is left */
function syncSettingsRedraw(){if(!settingsOpen())return;
  const a=document.activeElement,m=$('#settings-modal');
  if(a&&m&&m.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!/^(button|checkbox|radio)$/.test(a.type||'')){a.addEventListener('blur',()=>setTimeout(syncSettingsRedraw,0),{once:true});return}
  try{renderSettingsExtras()}catch(e){console.warn('Settings not redrawn',e)}
  try{emit('backup-changed')}catch{}}
/* after a sync brought changes: redraw the tab on screen. show() and renderToday() close Settings, which snapped shut when it was
   opened in the first seconds after launch and the start-up sync (scheduleSync, 2.5 s) came back with changes; while it is open,
   the tab waits for it to close (todayStale, viewStale) */
/* likewise while the item sheet is open (redrawing it blanked the field being typed in, and further typing replaced what was saved) or the
   piece picker is (the redraw closed it): the redraw waits for it to close (syncLater, run by syncLaterRun from itemShown / closePicker) */
let syncLater=null;
function syncRedraw(v){if(!v||v==='add')return;
  if(settingsOpen()){if(v==='today')todayDirty();else setViewStale(v);return}
  if((v==='wardrobe'&&editing)||(v==='today'&&(picker||todayBusy()))){syncLater=v;return}   // (a finger on Today: today.js todayFree runs it when the gesture ends)
  return show(v)}
function syncLaterRun(v){if(syncLater!==v)return;syncLater=null;if($('#'+v).hidden)return;
  if(v==='today')refreshToday();else if(v==='wardrobe'&&!editing)renderWardrobe()}
/* ---- the first pull (2026-11-14): a connected device saves nothing at start-up until it has merged the backup once. On the owner's
   phone, two days behind, the week's locks (stamped 07:00) and the one-time photo upgrade (82 items re-saved at 07:45) were written on
   its old copy before it synced; stamped newest, they replaced a pick made on another device and 11 newer tags, and brought back 4
   deleted items. Start-up writers (app.js: Today's locks and history, the upgrades, arrivals, a re-plan for new rules) run afterPull.
   Not connected (no server, no code, an ended invitation): at once. A failed pull (offline) keeps them waiting until one succeeds. */
let syncPulled=false;const pullWait=[];
const syncNeedsPull=()=>{const t=localStorage.getItem('app_token');return !!(syncUrl()&&t&&localStorage.getItem('invite_ended')!==t)};
const pulledYet=()=>syncPulled||!syncNeedsPull();
function pullDone(){if(syncPulled)return;syncPulled=true;for(const f of pullWait.splice(0))try{f()}catch(e){console.warn(e)}}
function afterPull(f){if(pulledYet())return Promise.resolve().then(f);return new Promise((ok,no)=>pullWait.push(()=>{try{ok(f())}catch(e){no(e)}}))}
/* a sync requested while one is running waits for it and then runs again, so nothing changed meanwhile is missed */
/* the Sync now button: a tap always tries, a pause from the day's saves being used up included (the server's allowance may have been raised
   since: the owner upgraded Cloudflare's plan); if the server still refuses, the pause comes back with its message */
function syncTap(){localStorage.removeItem('sync_pause');localStorage.removeItem('sync_pause_msg');wipeLater=0;return syncNow()}
/* ---- the owner's data deleted from another phone ("Delete everything"; fix round 3, 2026-11-16, the audit's W1-6-01: his other phone's
   next sync wrote the whole wardrobe back within a minute, though the card said it couldn't be undone). The server keeps when (backup.js
   syncLiteGet's wiped); a phone that last synced before then sends nothing and asks, once: "Back it up again" (wipe_seen = that time, and
   it syncs as usual: the server holds nothing, so everything goes up) or "Not now" (nothing sent; asked again only from Sync now). A phone
   that never synced, or synced after it, goes on as usual -> true while held */
let wipeAsk=null,wipeLater=0;
const WIPED_SYNC='Backups held: your wardrobe was deleted from the server on another device. This phone still has its copy. Tap Sync now to back it up again.';
function syncWiped(at){const last=+localStorage.getItem('last_sync')||0;
  if(!(at>0)||!last||last>=at||localStorage.getItem('wipe_seen')===String(at))return false;
  setSyncStatus(WIPED_SYNC);if(wipeAsk||wipeLater===at)return true;
  const when=new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  wipeAsk=askConfirm(`Your wardrobe was deleted from the server on another device (${when}).\n\nThis phone still has its own copy. Back it up to the server again?\n\nIf not, nothing is sent. You can delete it from this phone too in Settings → About → Delete my data.`,{ok:'Back it up again',cancel:'Not now'})
    .then(yes=>{wipeAsk=null;if(yes){try{localStorage.setItem('wipe_seen',String(at))}catch{}syncNow()}else wipeLater=at},()=>{wipeAsk=null});
  return true}
/* one sync at a time (CR-5-04, 2026-11-17: four or more callers at once, the timer, going to the background, online, Sync now, a roll-back,
   started two or three syncOnce together, each with its GET and POST on the same version). A call while one runs gets the one run queued
   after it (syncAgain), shared by every call that came meanwhile, so each sees its own changes backed up */
function syncNow(){
  if(!syncRun){const run=syncOnce().finally(()=>{if(syncRun===run)syncRun=null});syncRun=run;return run}
  if(!syncAgain){const run=syncRun;syncAgain=run.catch(()=>{}).then(()=>{syncAgain=null;return syncNow()})}
  return syncAgain}
/* what this device last agreed on with the worker: the backup's version and a fingerprint of the wardrobe at that moment.
   While both still hold, a sync is one tiny request: nothing is downloaded or uploaded (the backup is several MB of photos). */
const syncMark=()=>{try{const m=JSON.parse(localStorage.getItem('sync_mark')||'null');return m&&m.url===syncUrl()&&m.v&&m.sig?m:null}catch{return null}};
const setSyncMark=(rev,saved,sig)=>{try{localStorage.setItem('sync_mark',JSON.stringify({url:syncUrl(),v:rev+':'+saved,sig}))}catch{}};
/* last_sync by the corrected time (core.js nowMs), as the server's times it is compared with (CR-5-06: syncWiped held the backups of a phone
   whose clock was behind, its last_sync read as before the server's wipe) */
const synced=()=>{syncDue=0;localStorage.setItem('last_sync',String(nowMs()));localStorage.removeItem('sync_status');localStorage.removeItem('sync_wait');emit('backup-changed')};
/* ---- the phone's clock (fix round 3, the audit's W1-9; core.js nowMs): the server sends its time with every answer (x-now); the gap is
   learned from each sync's request (the middle of the request taken as the server's moment) and kept (localStorage clock_skew) ---- */
function clockLearn(r,t0,t1){const srv=+(r&&r.headers&&r.headers.get('x-now'))||0;if(!(srv>1e12)||t1-t0>15000)return false;
  const s=Math.round(srv-(t0+t1)/2),v=Math.abs(s)<CLOCK_MIN?0:s;let had=null;try{had=localStorage.getItem('clock_skew')}catch{}
  if(had==null||Math.abs(v-clockSkew)>1000){setClockSkew(v);try{localStorage.setItem('clock_skew',String(v))}catch{}}
  clockTell();return true}
/* said once for each gap of an hour or more (localStorage clock_told: the gap last said), in words a person can act on */
const CLOCK_TELL=3600e3;
function clockTell(){if(Math.abs(clockSkew)<CLOCK_TELL)return;let told=null;try{told=localStorage.getItem('clock_told')}catch{}
  if(told!=null&&Math.abs(+told-clockSkew)<CLOCK_TELL)return;try{localStorage.setItem('clock_told',String(clockSkew))}catch{}
  toast(clockText(clockSkew),12000)}
function clockText(s){const a=Math.abs(s),h=a/3600e3,d=h/24,y=d/365.25,n=(v,w)=>`${v} ${w}${v===1?'':'s'}`;
  const by=y>=.9?n(Math.round(y),'year'):d>=1.5?n(Math.round(d),'day'):n(Math.max(1,Math.round(h)),'hour');
  return `Your phone’s clock is ${by} ${s>0?'behind':'ahead'}. Your changes are dated by the right time anyway. To fix the clock, turn on Set Automatically in Settings → General → Date & Time.`}
/* stamps on this phone over CLOCK_AHEAD past the corrected time (saved while the clock was ahead, before a server had answered, or the
   server's marks from before it checked them) are put back to now, once the gap is known: what was edited then is kept, and wins a merge
   as an ordinary change made now. A holiday list fetched "in the future" is fetched again (fetched 0). -> whether anything changed */
async function clockFix(){const t=nowMs(),lim=t+CLOCK_AHEAD,st=await localState();let n=0;
  for(const it of st.items)if(stamp(it)>lim||(+it.added||0)>lim){const c={...it,updated:t};delete c.fs;if((+c.added||0)>lim)c.added=t;
    await atomic('items',it.id,cur=>cur&&stamp(cur)===stamp(it)?{put:c}:null);n++}
  for(const d of st.days)if([d.updated,d.base,d.lockAt].some(v=>(+v||0)>lim)){const c={...d,updated:t};delete c.fs;if((+c.base||0)>lim)c.base=t;if((+c.lockAt||0)>lim)c.lockAt=t;
    await atomic('days',d.date,cur=>cur&&(cur.updated||0)===(d.updated||0)?{put:c}:null);n++}
  if(Object.values(st.tombstones).some(v=>v>lim)){await atomic('meta','tombstones',r=>{const v={...(r&&r.v||{})};for(const id in v)if(v[id]>lim)v[id]=t;return {put:{k:'tombstones',v},value:v}});n++}
  const s=st.settings;if(s){const c=JSON.parse(JSON.stringify(s));let ch=false;
    if(c.ks)for(const k in c.ks)if(c.ks[k]>lim){c.ks[k]=t;ch=true}
    if(c.kse)for(const k in c.kse)for(const e in c.kse[k]||{})if(c.kse[k][e]>lim){c.kse[k][e]=t;ch=true}   // (an entry's stamp too: core.js SET_SPLIT)
    if(c.holidays&&(+c.holidays.fetched||0)>lim){c.holidays.fetched=0;if(c.kh)c.kh.holidays=setHash(c.holidays);if(c.ks)c.ks.holidays=t;ch=true}
    if((+c.updated||0)>lim||ch){c.updated=t;await metaPut('settings',c);n++}}
  if(!n)return false;
  const now=await localState();setWardrobe({items:now.items});planDirty();if(window.onSyncedData)onSyncedData(now);return true}
/* ---- the small sync (worker.js syncLiteGet / syncLitePost). A newer worker answers GET /sync?lite=1&since=<the version last agreed
   on> with only the records changed since, with photos as references (dwph:<hash>), every tombstone, and what it holds of each record
   (idx: its stamp); this device fetches only the photos it lacks (?ph=), merges, and POSTs only the records newer than the backup's,
   with the photos the backup lacks. A day marked worn is a few hundred bytes each way, where the whole backup (photos and all) was
   16 MB. An older worker ignores lite and since and answers as before (the whole backup, or same), and then the old way runs. ---- */
const SYNC_LITE=!self.SYNC_OLD;   // (window.SYNC_OLD: sync the whole backup every time, as before; a test plays an older app with it)
/* the most one upload carries (sync-photos.js phBatch) */
const SYNC_SEND_MAX=self.SYNC_SEND_TEST||16*1024*1024,SYNC_BATCH_MAX=40;   // (window.SYNC_SEND_TEST before load: a test's smaller budget)
let syncSendMax=SYNC_SEND_MAX;   // (per sync: the budget, halved after each 413)
const TOO_BIG_SYNC='Not backed up: an item’s photos are too large for the server. Your changes are kept on this phone; backups try again tomorrow.';
/* when this phone first synced with this account (sync_join: the code's last 6 characters and the time; set by syncOnce before its first
   request, so nothing changed before it counts as made in the account; kit.js kitShareFilter is handed it) */
function syncJoinAt(){try{const j=JSON.parse(localStorage.getItem('sync_join')||'null'),t=localStorage.getItem('app_token')||'';return j&&t&&j.k===t.slice(-6)?+j.at||0:0}catch{return 0}}
/* (by the corrected clock, core.js nowMs: kit.js compares it with days' stamps, which use it; CR-5-15) */
function syncJoinMark(token){try{if(!syncJoinAt()&&token)localStorage.setItem('sync_join',JSON.stringify({k:token.slice(-6),at:syncMark()?1:nowMs()}))}catch{}}   // (a phone that synced with this server before this version: in the account all along)
/* one round of the small sync, after GET ?lite=1 answered remote: true/false as syncOnce, or {again:{since, all, legacy}} */
async function syncLite(remote,local,url,token,inline){
  const raw=await phIn({items:remote.items||[],days:remote.days||[],tombstones:remote.tombstones||{},settings:remote.settings||null},local,url,token),got=cleanState(raw);   // (core.js cleanState: records from outside)
  // records the check left out are not "lacking" here (else every sync asked for everything again): kept per backup in sync_off
  const gi=new Set(got.items.map(i=>i.id)),gd=new Set(got.days.map(d=>d.date));let off={};try{off=JSON.parse(localStorage.getItem('sync_off')||'{}')||{}}catch{}
  if(off.url!==url)off={url,i:[],d:[]};
  const offI=new Set([...(off.i||[]),...raw.items.filter(i=>!(i&&gi.has(i.id))).map(i=>String(i&&i.id))]),offD=new Set([...(off.d||[]),...raw.days.filter(d=>!(d&&gd.has(d.date))).map(d=>String(d&&d.date))]);
  if(offI.size>(off.i||[]).length||offD.size>(off.d||[]).length)try{localStorage.setItem('sync_off',JSON.stringify({url,i:[...offI].slice(-500),d:[...offD].slice(-500)}))}catch{}
  await adoptBackupSettings(local,got);   // a device's first contact with a backup (safety.js): its settings win
  const now=mergeState(await applyMerged(local,got),got),ix=remote.idx||{i:{},d:{},s:-1},tomb=remote.tombstones||{};
  // everything the backup holds must be here now; when not (storage cleared, a marker from another backup), ask for all of it
  const has=Object.fromEntries(now.items.map(i=>[i.id,stamp(i)])),hasD=Object.fromEntries(now.days.map(d=>[d.date,d.updated||0]));
  // (a day the backup sent that this device kept its own, older copy of: core.js dayWins, an automatic lock that lost to a change it never
  // saw. Not lacking: it is sent up below, and the worker's merge, by the same rule, keeps it)
  const gotD=new Set((got.days||[]).map(d=>d.date)),keptD=d=>gotD.has(d.date)&&d.date in ix.d&&(d.updated||0)<ix.d[d.date];
  // (an item the backup sent that a deletion here outweighs, core.js tombWins: an older worker keeps it, by the stamp alone. Not lacking)
  const dead=new Set((got.items||[]).filter(i=>tombWins(now.tombstones[i.id],i)).map(i=>i.id));
  const lacks=Object.entries(ix.i).some(([id,s])=>!offI.has(id)&&!(id in has?has[id]>=s:(now.tombstones[id]||0)>=s||dead.has(id)))||Object.entries(ix.d).some(([d,u])=>!offD.has(d)&&!(d in hasD)||(hasD[d]<u&&!gotD.has(d)))||(ix.s>0&&!(now.settings&&(now.settings.updated||0)>=ix.s));
  if(lacks&&!remote.all)return {again:{all:true}};
  pullDone();   // this device now holds everything the backup does: start-up writers may run (before the upload: they save on a current copy)
  // what the backup lacks: records newer than its own, tombstones it doesn't have
  const share=kitShareFilter(now,null,syncJoinAt());   // (not the sample wardrobe: kit.js)
  const up={items:share.items.filter(i=>!(i.id in ix.i)||stamp(i)>ix.i[i.id]),days:share.days.filter(d=>!(d.date in ix.d)||kitSentStamp(d)>ix.d[d.date]||keptD(d)),
    tombstones:Object.fromEntries(Object.entries(now.tombstones).filter(([id,t])=>!(id in tomb)||tomb[id]<t))};
  Object.assign(up,cleanState({items:up.items,days:up.days,tombstones:up.tombstones}));   // records as the server takes them (core.js cleanState)
  if(now.settings&&(now.settings.updated||0)>(ix.s??-1))up.settings=now.settings;
  if(!up.items.length&&!up.days.length&&!up.settings&&!Object.keys(up.tombstones).length){setSyncMark(remote.rev,remote.saved,stateSig(now));synced();restoreDone();return true}
  if(syncPaused()){setSyncStatus(localStorage.getItem('sync_pause_msg')||'Today’s backups are used up.');return false}
  const have=new Set(remote.ph||[]);for(const h of inline)have.delete(h);
  const batch=await phBatch(up,have,syncSendMax);   // (up is already cleaned: each batch is a part of it)
  if(batch.left){const n=up.items.length;setSyncStatus(`Backing up: ${n} item${n===1?'':'s'} with photos still to send…`)}
  const {recs,photos}=await phOut(batch.up,have),t0=Date.now();
  const p=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,baseSaved:remote.saved||0,day:isoKey(new Date(nowMs())),...(restoreWanted()?{reason:'restore'}:{}),delta:recs,photos})});
  clockLearn(p,t0,Date.now());const pr=await p.json().catch(()=>({})),since=`${remote.rev||0}:${remote.saved||0}`;
  if(p.status===409)return {again:{since}};                                   // another device saved first: what it saved, then again
  // too large for the server all the same (a smaller limit than ours): half the size again, down to one item; one item too large pauses
  // the uploads until tomorrow, said in words, instead of sending it again at every close (W2-18-01: 4 x 61 MB in two closes)
  if(p.status===413){if(batch.up.items.length>1){syncSendMax=syncSendMax>>1;return {again:{since,batch:true}}}
    return pauseTillTomorrow(TOO_BIG_SYNC)}
  // a batch went up: the rest from the version it made (the backup now holds those items, so they aren't sent again)
  // (a roll-back's first batch kept "Before the last roll-back": the later ones are ordinary saves, or each would replace that copy)
  if(p.ok&&batch.left&&Number.isInteger(pr.rev)){if(restoreWanted())restoreDone();return {again:{since:`${pr.rev}:${pr.saved||0}`,batch:true}}}
  if(p.status===400&&Array.isArray(pr.missing)){pr.missing.forEach(h=>inline.add(h));return {again:{since}}}
  if(p.status===422&&pr.error==='legacy')return {again:{legacy:true}};          // a backup the server can't index: the whole of it
  return syncSaved(p,pr,token,now)}
/* the end of a save (the small sync's POST, the whole backup's PUT): refused for the day, ended, failed, or taken -> true/false.
   (CR-5-13: written twice, once for each) */
async function syncSaved(p,pr,token,now){
  if(p.status===429&&pr.what==='backup')return pauseTillTomorrow(backupFullMsg(pr));
  if(endedAnswer(p.status,pr)){inviteEnded(token,pr);setSyncStatus(ENDED);return false}
  if(!p.ok)throw new Error(pr.message||pr.error||'HTTP '+p.status);
  setSyncMark(pr.rev,pr.saved,stateSig(now));kitShareDone();synced();restoreDone();
  if(stateSig(await localState())!==stateSig(mergeState(now,{})))scheduleSync();   // something changed while uploading
  return true}
/* this phone's storage failed during a sync: said in a toast every time (safety.js storeFailText), unless the full-page message already says it */
function syncStoreTell(e){console.warn('storage failure during sync',e);if(dbDown)return;
  try{setStoreToldAt(Date.now())}catch{}toast(storeFailText(e),9000)}
async function syncOnce(){
  const url=syncUrl(),token=localStorage.getItem('app_token')||'';
  if(!url){setSyncStatus('Not connected.');return false}
  if(!token){setSyncStatus('Not connected: paste your invite link under Connection.');return false}
  if(localStorage.getItem('invite_ended')===token){setSyncStatus(ENDED);return false}
  syncing=true;setSyncStatus('Syncing…');syncJoinMark(token);
  try{
    let lite=SYNC_LITE&&!!(self.crypto&&crypto.subtle),since=null,all=false,full=0;const inline=new Set();
    syncSendMax=SYNC_SEND_MAX;let extra=0;   // (extra: rounds for photo batches, which don't count as retries)
    for(let attempt=0;attempt<6+extra;attempt++){
      // nothing changed here since the last sync: ask only whether the backup is still that version
      const mark=attempt?null:syncMark(),local=await localState(),quick=!!mark&&stateSig(mergeState(local,{}))===mark.sig,last=syncMark();
      let q=quick?'?v='+encodeURIComponent(mark.v):'';
      if(lite){const s=all?null:since||(last&&last.v);q='?lite=1'+(s?'&since='+encodeURIComponent(s):'')+(quick?'&v='+encodeURIComponent(mark.v):'')}
      const t0=Date.now(),r=await fetch(url+q,{headers:{'x-app-token':token},cache:'no-store'}),learned=clockLearn(r,t0,Date.now());const remote=await r.json().catch(()=>({}));
      if(learned&&r.ok&&await clockFix())continue;   // stamps from a wrong clock put right first (then asked again, with this phone's copy as it now is)
      if(endedAnswer(r.status,remote)){inviteEnded(token,remote);setSyncStatus(ENDED);pullDone();return false}
      if(r.status===501)pullDone();   // the server keeps no backup (no KV): nothing this device could be behind
      if(r.ok)try{localStorage.removeItem('invite_lost')}catch{}
      if(!r.ok)throw new Error(remote.message||remote.error||'HTTP '+r.status);
      if(quick&&remote.same){synced();pullDone();return true}
      if(remote.wiped&&syncWiped(remote.wiped)){pullDone();return false}   // deleted on another phone: asked first (nothing merged or sent)
      if(remote.lite===1){const res=await syncLite(remote,local,url,token,inline);if(!res||res===true)return res;
        const a=res.again;if(a.all)all=true;if(a.since){since=a.since;all=false}if(a.legacy)lite=false;if(a.batch&&extra<SYNC_BATCH_MAX)extra++;continue}
      if(++full>3)break;
      if(remote.data)remote.data=cleanState(remote.data);   // records from outside (core.js)
      await adoptBackupSettings(local,remote.data);   // a device's first contact with a backup: the backup's settings win (safety.js)
      // upload what is actually stored now (it may include edits made during this sync)
      const now=mergeState(await applyMerged(local,remote.data||{}),remote.data||{}),out=cleanState(kitShareFilter(now,remote.data,syncJoinAt()));pullDone();   // (out: what is sent, without the sample wardrobe)
      if(remote.data&&stateSig(out)===stateSig(remote.data)){setSyncMark(remote.rev,remote.saved,stateSig(now));synced();restoreDone();return true}
      if(syncPaused()){setSyncStatus(localStorage.getItem('sync_pause_msg')||'Today’s backups are used up.');return false}
      const p=await fetch(url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':token},body:JSON.stringify({baseRev:remote.rev||0,day:isoKey(new Date(nowMs())),...(restoreWanted()?{reason:'restore'}:{}),data:out})});   // data last: the server reads a large backup's few leading fields without parsing the whole
      if(p.status===409)continue;                       // another device saved first: merge again
      const pr=await p.json().catch(()=>({}));
      if(p.status===413)return pauseTillTomorrow(TOO_BIG_SYNC);   // not again at every close
      return await syncSaved(p,pr,token,now);
    }
    throw new Error('another device kept saving at the same time; try again');
  }catch(e){
    // this phone's own storage refused (full, closed): said where it is seen, in the app's words (W1-11-05: a phone joining with full storage
    // showed an empty Welcome, and only Settings said "Backup failed: IDBTransaction will abort…")
    // (always toasted, not through saveFailed's 1.5 s once-only: on joining, a start-up write had failed a moment before and its toast was
    // already replaced by "Connected as …", so this one was skipped and the phone showed an empty Welcome with no word: the lead's re-run)
    if(storeFailure(e)){syncStoreTell(e);setSyncStatus('Backup failed: '+storeFailText(e).replace(/^Couldn’t save: /,''));return false}
    const n=syncNetText(e);setSyncStatus(n||'Backup failed: '+(e.message||e));return false}
  finally{syncing=false}
}
/* after a change: the owner's phone backs up 2.5 s later. A tester's waits until the app goes to the background or closes, or 15
   minutes after the first change still waiting (TESTER_SYNC_MS), so every tap doesn't upload the whole wardrobe (several MB). */
const TESTER_SYNC_MS=15*60000;
/* sync_wait: a change made here that no backup has taken yet (cleared by synced); the Backup summary says so (settings.js backupSummary) */
/* sync_wait and syncDue by the corrected clock (core.js nowMs), as last_sync and the pause (CR-5-15) */
function scheduleSync(){clearTimeout(syncTimer);try{if(!localStorage.getItem('sync_wait'))localStorage.setItem('sync_wait',String(nowMs()))}catch{}
  if(typeof isTester==='function'&&isTester()){if(!syncDue)syncDue=nowMs();syncTimer=setTimeout(syncNow,Math.max(1000,syncDue+TESTER_SYNC_MS-nowMs()));return}
  syncTimer=setTimeout(syncNow,2500)}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setRestoring(v){restoring=v}
/* An ES module since 2026-11-24. The bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use
   as globals. Above the file's top-level set-up, whose connRestored.then and acts({…}) throw when app.js or act.js didn't load */
Object.assign(globalThis,{syncPaused,syncWaiting,backedUpWords,tabBrowser,safariTab,syncUrl,localState,applyMerged,syncRedraw,syncLaterRun,syncNeedsPull,pulledYet,afterPull,WIPED_SYNC,syncNow,syncMark,SYNC_SEND_MAX,scheduleSync,setRestoring});
/* the socket the setup's Connection step asks for its words (bus.js; setup.js no longer names this file: the restructure S3f) */
serve('backed-up-words',backedUpWords);
Object.defineProperties(globalThis,{syncTimer:{get:()=>syncTimer},syncRun:{get:()=>syncRun},restoring:{get:()=>restoring,set:v=>{restoring=v}},syncing:{get:()=>syncing,set:v=>{syncing=v}}});
/* the notice board (bus.js): what this file does when Settings announces it (settings.js no longer names this file) */
on('settings-saved',()=>scheduleSync());   // a backup soon after the settings were saved
on('connection-saved',()=>{syncNow().catch(e=>console.warn('sync not started',e))});   // Settings' Done: a backup now
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,TESTER_SYNC_MS,backupFullMsg,get syncDue(){return syncDue},set syncDue(v){syncDue=v},syncJoinAt,syncJoinMark,get syncLater(){return syncLater},syncTap,get syncing(){return syncing},set syncing(v){syncing=v}};
export {setSyncStatus,syncNetText,syncWaiting,pauseTillTomorrow,syncPaused,backupFullMsg,backedUpWords,tabBrowser,safariTab,restoring,syncing,syncTimer,syncRun,syncDue,syncUrl,localState,applyMerged,syncLater,syncRedraw,syncLaterRun,syncNeedsPull,pulledYet,afterPull,syncTap,WIPED_SYNC,syncNow,syncMark,SYNC_SEND_MAX,syncJoinAt,syncJoinMark,TESTER_SYNC_MS,scheduleSync,setRestoring};
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&syncDue)syncNow();   // a tester's waiting changes, as the app closes
  else if(document.visibilityState==='visible'&&nowMs()-(+localStorage.getItem('last_sync')||0)>60000)syncNow()});
addEventListener('pagehide',()=>{if(syncDue)syncNow()});
// back online after a backup that couldn't reach the server: try again at once
addEventListener('online',()=>{if(syncWaiting(localStorage.getItem('sync_status')))syncNow()});
connRestored.then(()=>setTimeout(syncNow,300));   // (after the connection is put back where storage lost it: app.js)
/* the markup's handler (act.js): Settings' "Sync now" */
function syncNowTap(){syncTap()}
acts({syncNowTap});
