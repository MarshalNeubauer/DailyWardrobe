/* Daily Wardrobe: what Backup & sync says (split from sync.js, 2026-11-17): the status line, the pause until the next UTC day,
   an invitation that has ended, and the backup words for Connection and the setup. Loaded right before sync.js. */
// a tester reads a server set-up error in plain words (plainErr, ui.js); the owner, or a connection whose role isn't known yet, the server's sentence
function setSyncStatus(t){if(typeof isTester==='function'&&isTester()){const p=plainErr(t);if(p!==t)t='Backup failed: '+p}localStorage.setItem('sync_status',t);showSyncStatus()}
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
const tabBrowser=()=>typeof homeBrowser==='function'?homeBrowser():'Safari';
const safariWord=()=>safariTab()?` ${tabBrowser()} can clear a website’s data when it isn’t opened for about a week or the phone runs short of space: Download backup now and then keeps a copy in Files.`:'';
/* an invitation that was switched off: said once, and the app stops trying (localStorage.invite_ended holds that code) */
const ENDED='Your invitation has ended. Your wardrobe stays on this phone, and the app keeps working without a connection.';
/* (j: the server's answer) a tester's code the server doesn't know at all (403 'forbidden token': its storage was lost, or the account
   deleted) is also marked invite_lost: the server holds no copy of this phone's wardrobe, so a new invitation link keeps the wardrobe and
   backs it up there instead of clearing it (account.js connectFromLink; 2026-11-15, the audit: nothing said how to recover) */
function inviteEnded(token,j){if(j&&j.error==='forbidden token')try{localStorage.setItem('invite_lost',token)}catch{}
  if(localStorage.getItem('invite_ended')===token)return;localStorage.setItem('invite_ended',token);tell(endedTold(j));
  showSyncStatus();if(typeof acctEndedUI==='function')acctEndedUI()}   // what said "Connected" and "backed up" says so too (account.js)
/* what the one-time message says (fix round 3): a link the owner replaced with a new one (worker/people.js, 'invite off' with replaced) says the
   new link opens the same wardrobe; an account deleted (W1-6-03: after Delete everything on another phone this phone only heard "Your
   invitation has ended") says the backup was deleted; else ENDED */
const ENDED_NEW='Your invitation link was replaced by a new one. Ask the person who invited you for it: it opens the same wardrobe. Until then your wardrobe stays on this phone.';
const ENDED_GONE='Your wardrobe’s backup on the server was deleted, from another phone or by the person who invited you, so this invitation no longer works. Your wardrobe stays on this phone, and the app keeps working without a connection.';
const endedTold=j=>j&&j.replaced?ENDED_NEW:j&&j.error==='forbidden token'?ENDED_GONE:ENDED;
/* the server's answer means this invitation is over: switched off (403 'invite off'), or, for a tester, deleted (the account deleted
   on another phone, or its data deleted by the owner: the code is unknown, 403 'forbidden token'). A tester's phone said "Backups aren't
   available on this server yet" and kept trying. For the owner a refused code is a typing mistake, said as it is. */
const endedAnswer=(status,j)=>status===403&&!!j&&(j.error==='invite off'||j.error==='forbidden token'&&typeof isTester==='function'&&isTester());
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
/* An ES module (2026-11-23): its names are its own. The bridge (tests/bridge.test.js lists it): sync.js and the screens that say how the backup stands (app, photos, settings, snapshots, backupfile, account, about,
   ui, setup), classic scripts, call these; the clock, rollback, backup-storage, server-limits and addcards tests too. */
Object.assign(globalThis,{setSyncStatus,showSyncStatus,ENDED,inviteEnded,endedAnswer,syncNetText,syncWaiting,pauseTillTomorrow,syncPaused,backupFullMsg,backedUpWords});
export {setSyncStatus,showSyncStatus,ENDED,inviteEnded,endedAnswer,syncNetText,syncWaiting,pauseTillTomorrow,syncPaused,backupFullMsg,backedUpWords};
