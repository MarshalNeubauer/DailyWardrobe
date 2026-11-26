/* Daily Wardrobe: the server's daily backups and Roll back (split from sync.js, 2026-11-17). */
import {on} from './bus.js';
import {$,cleanState,items,nowMs,stampAllSettings} from './core.js';
import {esc} from './photo-keys.js';
/* ---- daily backups on the worker (snap:<day> / snap:<month> / snap:before-restore) ---- */
/* a copy is named by the day it is for (the wardrobe at that day's start), with how many items it holds when the server says (W2-14-03,
   W1-6-07: labelled by the time its content was saved, Monday's copy and Sunday's both read "Sun, Nov 15, 7:30 AM", one full, one empty) */
const snapDay=id=>{const d=new Date(id+'T12:00:00'),y=d.getFullYear()!==new Date().getFullYear();return d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',...(y?{year:'numeric'}:{})})};
const snapCount=s=>Number.isInteger(s.n)?(s.n?` · ${s.n} item${s.n===1?'':'s'}`:' · empty'):'';
const snapLabel=s=>{const c=snapCount(s);
  if(s.id==='before-restore')return `Before the last roll-back (${new Date(s.saved).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})})${c}`;
  if(/^\d{4}-\d{2}$/.test(s.id))return `Start of ${new Date(s.id+'-02T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'})}${c}`;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s.id))return `${snapDay(s.id)}, start of the day${c}`;
  return new Date(s.saved).toLocaleString()+c};
/* the list is read when Settings' Backup opens (settings.js setCatOpen), not only when the dropdown is focused: on an iPhone the tap
   that focuses it opens the picker at once, showing only "Choose a day…" while the list was still on its way (re-audit 2026-11-15).
   Once per page life (each list is a counted server call); one request at a time (snapLoading), and the chosen day is kept */
let snapLoading=null;
function loadSnapshots(){const sel=$('#snap-list');if(!sel||sel.dataset.loaded)return Promise.resolve();if(snapLoading)return snapLoading;const p=snapsRead().catch(e=>console.warn('daily backups not listed',e)).finally(()=>{if(snapLoading===p)snapLoading=null});snapLoading=p;return p}
async function snapsRead(){const sel=$('#snap-list'),st=$('#snap-status'),url=syncUrl(),token=localStorage.getItem('app_token')||'';if(!sel||sel.dataset.loaded)return;
  if(!url||!token){st.textContent=NEED_CONN;return}
  if(inviteOver()){st.textContent=ENDED;return}
  try{const r=await fetch(url+'?snaps=1',{headers:{'x-app-token':token},cache:'no-store'}),j=await r.json().catch(()=>({}));
    if(endedAnswer(r.status,j)){inviteEnded(token,j);st.textContent=ENDED;return}   // not "Could not list the daily backups: invite off"
    if(r.status===429&&j.what==='list'){st.textContent=SNAP_CAP;return}   // the server's words name "photo list checks", which a tester can't connect with this list
    if(!r.ok)throw new Error(j.message||j.error||'HTTP '+r.status);
    sel.dataset.loaded=1;const list=j.snaps||[],was=sel.value;
    sel.innerHTML=`<option value="">${list.length?'Choose a day…':'No daily backups yet'}</option>`+list.map(s=>`<option value="${esc(s.id)}"${Number.isInteger(s.n)?` data-n="${s.n}"`:''}>${esc(snapLabel(s))}</option>`).join('');
    if(was&&list.some(s=>s.id===was))sel.value=was;
    st.textContent=list.length?`${list.length} kept. Each is the wardrobe before that day's first change.`:'The first one is kept the next time something changes.'}
  catch(e){st.textContent='Could not list the daily backups: '+errWords(e)}}
const SNAP_CAP='The daily backups can’t be listed again today: today’s limit of lists on the server is used up. They are still kept. Try again tomorrow.';
/* an error's text for the backup lines: the browser's network words and server set-up words made plain (ui.js plainErr) */
const errWords=e=>{const m=String(e&&e.message||e||'');return plainErr(m)};
/* the wardrobe exactly as in snapshot s, made to win the merge everywhere: its items, days and settings get a new stamp, and
   anything not in it gets a tombstone (days after it are kept: they hold no wardrobe, and there is no deleting a day) */
/* a copy from before the setup (a first day's backup: no setupDone, no items) brings back no settings: they were only the defaults, and taken
   they sent a new user back to Welcome with his workdays and location gone (re-audit 2026-11-15). The phone's settings stay */
const snapPreSetup=(local,snap)=>!!(local&&local.settings&&local.settings.setupDone)&&!!snap&&!(snap.settings&&snap.settings.setupDone)&&!(snap.items||[]).length;
/* (fix round 3, the audit's W2-13-03) each restored item and day is stamped above this phone's deletion mark and copy of it, so marks dated
   ahead (a wrong clock, or someone holding the code) can't keep a roll-back from bringing the pieces back */
function rollBackState(local,snap,now=nowMs()){
  const lt=local.tombstones||{},ld=Object.fromEntries((local.days||[]).map(d=>[d.date,d.updated||0])),li=Object.fromEntries((local.items||[]).map(i=>[i.id,stamp(i)]));
  const items=(snap.items||[]).map(i=>({...i,updated:Math.max(now,(+lt[i.id]||0)+1,(li[i.id]||0)+1)})),keep=new Set(items.map(i=>i.id)),tombstones={...(snap.tombstones||{})};
  for(const id of Object.keys(tombstones))if(keep.has(id))delete tombstones[id];
  for(const i of local.items||[])if(!keep.has(i.id))tombstones[i.id]=Math.max(now,stamp(i)+1);
  // settings: every one stamped now (core.js stampAllSettings), and one the snapshot lacks marked removed now, so it goes on every device too
  let settings=null;if(snap.settings&&!snapPreSetup(local,snap)){const ls=local.settings||{},sn=Math.max(now,(+ls.updated||0)+1,...Object.values(ls.ks||{}).map(v=>(+v||0)+1));
    settings=stampAllSettings({...snap.settings},sn);for(const k of setKeys(local.settings))if(!(k in settings)){settings.ks[k]=sn;settings.kh[k]='-'}}
  return {items,tombstones,days:(snap.days||[]).map(d=>({...d,updated:Math.max(now,(ld[d.date]||0)+1)})),settings}}
/* what a roll-back says goes to Settings' line and, when Settings isn't open (closed under its question, or the toast's Undo), to a
   toast as well: written only to the closed Settings page, the wardrobe vanished from Today with no word (re-audit 2026-11-15) */
function rollSay(t,ms,act){const st=$('#snap-status');if(st)st.textContent=t;if(!settingsOpen())toast(t,ms||6000,act)}
/* pick: {id, label} rolls back to that copy (the toast's Undo: "Before the last roll-back"); else the day chosen in the list */
async function rollBack(pick){const sel=$('#snap-list'),id=pick&&pick.id||sel&&sel.value,url=syncUrl(),token=localStorage.getItem('app_token')||'';
  if(!id){rollSay('Choose a day first.');return}
  const label=pick&&pick.label||sel.selectedOptions[0].textContent,empty=!pick&&sel.selectedOptions[0].dataset.n==='0';
  if(!await askConfirm(`Roll back to ${label}?\n\n${empty?'That copy has no items: rolling back to it empties the wardrobe on every device. ':''}The wardrobe, day history and settings on every device become that copy. The current state is kept as “Before the last roll-back”, so this can be undone.`,{ok:'Roll back',danger:true}))return;
  try{rollSay('Rolling back…',2500);await syncNow();
    const r=await fetch(url+'?snap='+encodeURIComponent(id),{headers:{'x-app-token':token},cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||j.error||'HTTP '+r.status);
    if(!j.data||!Array.isArray(j.data.items))throw new Error('that backup is empty');
    j.data=cleanState(j.data);   // records from outside (core.js)
    const local=await localState(),pre=snapPreSetup(local,j.data),next=rollBackState(local,j.data);
    setRestoring(true);localStorage.setItem('sync_restore',token);   // before the phone's copy changes: a kill from here on still uploads it as a restore
    await applyMerged(local,next);
    const ok=await syncNow();if(sel)delete sel.dataset.loaded;
    const n=`${items.length} item${items.length===1?'':'s'}`,kept=pre?' Your settings were kept: that copy is from before the setup.':'';
    if(ok)rollSay(`Rolled back. The wardrobe has ${n}.${kept}`,8000,id==='before-restore'?null:{label:'Undo',fn:()=>rollBack({id:'before-restore',label:'Before the last roll-back'})});
    else rollSay(`Rolled back on this device (${n}), but the backup could not be updated yet: ${localStorage.getItem('sync_status')||''} It is sent, with “Before the last roll-back” kept, at the next backup.${kept}`,8000)}
  catch(e){rollSay('Roll back failed: '+errWords(e))}}
/* the markup's handlers (act.js): the Daily backups list on focus (it loads its days), and Roll back */
function snapFocus(){loadSnapshots()}
function rollBackTap(){rollBack()}
/* An ES module since 2026-11-23. The bridge (tests/bridge.test.js): settings.js, a classic script, calls loadSnapshots; the tests call it and the
   other three (actsindex, backup-storage, clock, rollback, sample); a module imports them */
Object.assign(globalThis,{loadSnapshots});
/* the notice board (bus.js): what this file does when Settings announces it (settings.js no longer names this file) */
on('settings-category',k=>{if(k==='backup')loadSnapshots()});   // the daily backups list is read as Backup opens
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,rollBack,rollBackState,snapLabel,loadSnapshots};
export {snapLabel,loadSnapshots,rollBackState,rollBack};
acts({snapFocus,rollBackTap});
