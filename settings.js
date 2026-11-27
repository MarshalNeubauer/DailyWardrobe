/* Daily Wardrobe: Settings: the page and its categories, the summaries, open, close and Done, saving the settings (saveUserSettings),
   the parts drawn by later scripts (settingsPart), Outfit pictures and the schedule's switches
   (An ES module, at its place in index.html's order; split out of app.js on 2026-11-14;
   days off, weather, toasts, dates and the theme are in daysoff.js, weather.js, toast.js, locale.js and theme.js since 2026-11-17.)
   The categories other files draw (days off, weather, the dress code, own lists, Laundry, the connection, Backup, About, the calendar,
   the account box, the reminder) are not named here: Settings announces on the notice board (bus.js) when it is drawn, opened, its
   summaries written, a category opened, saved or closed, and each of those files pinned what it does then (restructure step 0's
   pilot, 2026-11-25). It imports only the board: an import of core.js or back.js broke the offline deep link (the service worker
   answers a file asked for under another folder with the root's copy, so an import resolved against the root ran the file a second
   time; bus.js keeps nothing on the page, so a second copy of it is harmless). Everything else it still reads as globals. */
import {on,heard,emit,ask,served,serve} from './bus.js';
import {$,DAY_NAMES,MATERIALS_BY,applyCustom,dayRecs,isoKey,key,keySettings,mergeSettings,nowMs,occOf,ownMats,setWardrobe,settings,stampSettings,todayDate,wearsJacket,wearsTie} from './core.js';
import {inviteOver,layerClose,layerOpen,tell} from './ui.js';
import {backDrop,backKind,backPush} from './back.js';
import {pagesOn,subShown} from './nav.js';
import {toast} from './toast.js';
import {acts} from './act.js';
/* settings management */
/* Settings: a full-screen page of categories that unfold like Today's cards; openSettings('weather') opens one directly */
const SET_CATS=['laundry','schedule','daysoff','calendar','weather','care','photos','tagging','backup','connection','about'];
function setCatOpen(key,open,instant){const el=$('#sc-'+key);if(!el)return;el.classList.toggle('instant',!!instant);if(!instant){el.classList.remove('instant');void el.offsetHeight}
  el.classList.toggle('open',open);const b=el.querySelector('.scat-head');if(b)b.setAttribute('aria-expanded',open);
  // a category opened: Backup reads the daily backups list (snapshots.js), About draws itself only as it opens (CR-7-06: its header ran
  // it on closing too, and asked the server each time), Laundry & cleaning draws its lists (care.js)
  if(open)emit('settings-category',key)}
// a category unfolds where it is: no scroll to show what opened (the owner, 2026-11-17: "I want it to unfold and not scroll automatically at all")
// the summaries (what was changed inside) are written once the fold has finished moving, not in its first frames
function toggleCat(key){const el=$('#sc-'+key);if(!el)return;const open=!el.classList.contains('open');setCatOpen(key,open);
  clearTimeout(toggleCat.t);toggleCat.t=setTimeout(()=>{try{settingsSummaries()}catch(e){console.warn(e)}},480)}
/* the Backup line in Settings says what really happened: the last backup's time, or that the last try failed (sync.js keeps
   sync_status while a try fails and last_sync when one works) */
/* when backups start again (the next 00:00 UTC): "tomorrow" only when that is tomorrow here; west of UTC it is later today (W1-10-03: "Paused
   until tomorrow" over a line saying "after 7:00 PM") */
function pausedUntil(t){const d=new Date(t),n=new Date();let at='';try{at=d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}catch{}
  return d.toDateString()===n.toDateString()?(at||'later today'):'tomorrow'}
function backupSummary(w){if(!w)return 'Not backed up yet: needs a connection';
  if(typeof inviteOver==='function'&&inviteOver())return 'Not backed up: your invitation has ended';
  const last=+localStorage.getItem('last_sync')||0,st=localStorage.getItem('sync_status')||'',when=t=>{const d=new Date(t),days=Math.round((todayDate().getTime()-new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime())/864e5);
    return days<=0?'today':days===1?'yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
  // (2026-11-15, the audit: "Backed up today" while the day's saves were used up and none of the new items was on the server)
  const pz=+localStorage.getItem('sync_pause')||0;
  if(typeof syncPaused==='function'?syncPaused():pz>nowMs()){const p=pausedUntil(pz);return last?`Paused until ${p} · last saved ${when(last)}`:`Paused until ${p}: not backed up yet`}
  if(/^Backups held/.test(st))return 'Held: deleted from the server on another device';   // (sync.js syncWiped)
  if(/^Backing up/.test(st))return last?`Backing up photos · last saved ${when(last)}`:'Backing up photos: not finished yet';   // (photos going up in batches, sync-photos.js phBatch)
  if(/^Not backed up:/.test(st))return last?`Waiting for a connection · last saved ${when(last)}`:'Waiting for a connection: not backed up yet';
  if(/failed/i.test(st))return last?`Last backup failed · last saved ${when(last)}`:'Backup failed: not backed up yet';
  return last?`Backed up ${when(last)}`+(localStorage.getItem('sync_wait')&&!/^Syncing/.test(st)?' · newer changes waiting':''):'Not backed up yet'}
/* the summaries: the files whose category a line describes fill in what only they know (S: the dress code's words, the country's
   name, the calendar's line, the unit, whether connected, the connection's line), and the account and the reminder do what they do
   whenever Settings changes (account.js applyRole, remind.js remindSoon); a part that isn't here leaves its line as Settings words it */
function settingsSummaries(){const set=(k,t)=>{const e=$('#sum-'+k);if(e)e.textContent=t};const S={};emit('settings-summaries',S);
  // the days from the week's first one: the first day (Sunday first) whose day before isn't one of them, so Sun–Thu reads "Sun–Thu"
  // (sorted from Monday it read "Mon, Tue, Wed, Thu, Sun", audit 2026-11-13)
  const days=l=>{const has=new Set(l),s0=weekFirst(l),s=[...has].sort((a,b)=>((a-s0+7)%7)-((b-s0+7)%7)),n=i=>DAY_NAMES[i].slice(0,3);if(!s.length)return 'none';
    const run=s.length>2&&s.every((d,i)=>!i||(s[i-1]+1)%7===d);return run?`${n(s[0])}–${n(s[s.length-1])}`:s.map(n).join(', ')};
  set('schedule',`${days(settings.workdays)} · ${scheduleWear(days,S)}`);
  const T=isoKey(todayDate()),h=settings.holidays,offs=(settings.daysOff||[]).filter(x=>x.d>=T).length,occ=Object.values(dayRecs).filter(r=>r.date&&keyDate(r.date)>=todayDate()&&occOf(r)).length;
  set('daysoff',[h&&h.country?((h.list||[]).length?`${h.country} holidays`:`${S.country?S.country(h.country):h.country}: no holiday list`):'No holidays',`${offs} day${offs===1?'':'s'} off`,`${occ} occasion${occ===1?'':'s'}`].join(' · '));
  if(S.calendar)set('calendar',S.calendar());   // (calendar.js)
  set('weather',`${settings.location?settings.location.name:'No location set'} · °${S.unit()}`);   // (weather.js; without it this line throws, as unit() did)
  set('photos',picsDrawn()?'Drawing only':S.connected&&!S.connected()?'Painted pictures · needs a connection':'Painted pictures');   // (the masters come from the server)
  const own=Object.keys((settings.custom&&settings.custom.colors)||{}).length+Object.keys((settings.custom&&settings.custom.patterns)||{}).length;
  const om=Object.keys(MATERIALS_BY).reduce((n,t)=>n+ownMats(t).length,0);   // (own materials, 2026-11-16)
  set('tagging',`${own?own+' color'+(own===1?'':'s')+' & patterns of your own':'Your own colors & patterns'}${om?` · ${om} material${om===1?'':'s'}`:''}`);
  const w=localStorage.getItem('worker_url');let host='';try{host=w?new URL(w).host:''}catch{}
  set('backup',backupSummary(w));set('connection',S.conn?S.conn():host||'Not connected')}
/* the week's first day: the first workday (Sunday first) whose day before isn't one, so Sun–Thu starts on Sunday and Mon–Fri on Monday;
   the Schedule summary and the month's grid (month.js) both start there */
const weekFirst=(l=settings.workdays)=>{const has=new Set(l||[]);return [0,1,2,3,4,5,6].find(d=>has.has(d)&&!has.has((d+6)%7))||0};
/* the Schedule summary's dress part (audit 2026-11-15: with ties off it dropped the blazer days): blazer days whenever jackets are worn,
   the vest only with ties, as Settings shows them */
function scheduleWear(days,S){const j=wearsJacket(),t=wearsTie();
  if(!j)return S.dress?S.dress():'no jackets';const bl=settings.blazerDays.filter(d=>settings.workdays.includes(d));
  return [bl.length?'blazers '+days(bl):'suits every day',t?'vest '+({auto:'on cooler suit days',always:'every suit day',never:'never'})[settings.vestMode||'auto']:'no ties'].join(' · ')}
function openSettings(section){
  const already=settingsOpen(),subUnder=!already&&backKind()==='sub'&&subShown();
  const cat=section==='wx'?'weather':section;
  for(const k of SET_CATS)setCatOpen(k,k===cat,true);
  if(cat)setTimeout(()=>{const el=$('#sc-'+cat),m=$('#settings-modal');if(el&&m)m.scrollTop=el.offsetTop-m.querySelector('.shead').offsetHeight-8},0);else if($('#settings-modal'))$('#settings-modal').scrollTop=0;
  // storage that is blocked (localStorage throws) or broken must not keep Settings shut: it opens with what could be drawn (audit 2026-11-13)
  try{if($('#cfg-url')) $('#cfg-url').value=localStorage.getItem('worker_url')||'';
    if($('#cfg-token')) $('#cfg-token').value=localStorage.getItem('app_token')||''}catch(e){console.warn('connection not read',e)}
  // Settings opening: the Advanced folds start closed every time (ui.js advClose), the Backup line is written (sync-status.js)
  try{emit('settings-open')}catch(e){console.warn('backup line not drawn',e)}
  try{renderSettingsExtras()}catch(e){console.warn('Settings drawn in part',e)}
  try{settingsSummaries()}catch(e){console.warn('Settings summaries not drawn',e)}
  if($('#settings-modal')){ $('#settings-modal').style.display='block'; $('#settings-modal').style.pointerEvents='auto'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='block'; $('#modal-backdrop').style.pointerEvents='auto'; }
  // the phone's Back closes it (back.js, kind 'set'); over Add or the Packing list (the gear, Add's "Connect") Settings takes
  // over that page's entry and hands it back on closing, so the page's Back still works after (CR-7-04: Settings took the entry, and the
  // next Back left the app)
  setLock(true);if(!already)setOver=subUnder?'sub':'';backPush('set');
  if(typeof layerOpen==='function')layerOpen($('#settings-modal'));   // the page behind is inert, the focus moves in (ui.js)
}
/* while Settings is up the page behind it can't scroll (html.set-lock): on an iPhone a scroll in Settings near its top or bottom was handed
   to Today underneath, and Settings stood still under the finger until that scroll ended; also notes the last touch for toggleCat */
function setLock(on){document.documentElement.classList.toggle('set-lock',on);const m=$('#settings-modal');
  if(on&&m&&!m._tw){m._tw=true;const mark=()=>{m._touch=Date.now()};m.addEventListener('touchstart',mark,{passive:true});m.addEventListener('wheel',mark,{passive:true})}}
let setOver='';   // the kind of entry Settings borrowed from the page under it ('sub': Add, Packing list, Laundry), handed back on closing
let todayStale=false;   // a change made in Settings that Today should show once Settings closes
/* the one writer of todayStale (Round B, CR-7-07: it was set from 8 files); todayDirty(false) when Today was just drawn (the setup) */
function todayDirty(stale=true){todayStale=stale}
let viewStale=null;   // the Wardrobe or stats page, when a sync brought changes while Settings was open (syncRedraw): redrawn once it closes
const settingsOpen=()=>!!$('#settings-modal')&&$('#settings-modal').style.display==='block';
/* a redraw from work done in the background (photos arriving, the weather, the plan rules check at start-up): while Settings is open
   it waits for Settings to close (todayStale), since drawing Today closes Settings, which snapped shut when opened right after launch */
function refreshToday(){if(settingsOpen()){todayDirty();return}renderToday()}
function closeSettings(){const was=settingsOpen();
  if($('#settings-modal')){ $('#settings-modal').style.display='none'; $('#settings-modal').style.pointerEvents='none'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='none'; $('#modal-backdrop').style.pointerEvents='none'; }
  // closed by Done or anything else: its Back entry goes; one borrowed from the page under it goes back to that page (taken by Back, the
  // page gets a new one: CR-7-04)
  const over=setOver;setOver='';
  if(was&&over){const k=backKind();if(k==='set'||!k&&subShown())backPush(over)}else backDrop('set');
  setLock(false);
  if(was&&typeof layerClose==='function')layerClose($('#settings-modal'));
  if(todayStale){todayStale=false;keepHome();renderToday()}   // (Today on the home day follows a workday taken away)
  // the Wardrobe or stats page a sync changed while Settings was open is drawn again if it is the page under Settings (nav.js show)
  const v=viewStale;viewStale=null;emit('settings-closed',v)
}
function saveSettings(){
  // (audit 2026-11-15, W1-7-02) another address or code typed while connected moves this phone to another account: it goes through the
  // link's questions (account.js acctTyped: the same account goes through, another asks, backs up and clears first). Stored as typed, the
  // next sync merged this phone's wardrobe into the other account
  const tu=$('#cfg-url')?$('#cfg-url').value.trim():null,tt=$('#cfg-token')?$('#cfg-token').value.trim():null,cu=(localStorage.getItem('worker_url')||'').trim(),ct=(localStorage.getItem('app_token')||'').trim();
  // (CR-5-07, 2026-11-17) a first connection typed here too: it skipped the server's check of the code and "Add this phone's N pieces…?"
  if(heard('connection-typed')&&tu&&tt&&(!ct||!cu||tt!==ct||tu.replace(/\/*$/,'/')!==cu.replace(/\/*$/,'/'))){
    closeSettings();emit('connection-typed',tu,tt);return}   // (account.js acctTyped)
  // full or blocked storage: Done still closes Settings (it threw before closing), and says the connection wasn't kept
  try{if($('#cfg-url')) localStorage.setItem('worker_url',$('#cfg-url').value.trim());
    if($('#cfg-token')) localStorage.setItem('app_token',$('#cfg-token').value.trim())}
  catch(e){console.warn('connection not saved',e);setTimeout(()=>toast('Couldn’t save the server address: this browser’s storage is full or blocked.',5000),0)}
  connKeep();   // the database's copy of the connection follows (app.js)
  closeSettings();
  try{renderAdd()}catch(e){console.warn('Add page not drawn',e)}
  emit('connection-saved');   // a backup now (sync.js syncNow)
}

/* another tab of the app (an invitation link tapped twice opens a second one) may have saved the settings since this page read them:
   each save is announced (BroadcastChannel), and the next save here first merges the stored copy in setting by setting (core.js
   mergeSettings) instead of writing this page's older copy over it: a stale tab's Skip put back the other tab's old workdays and units
   (audit 2026-11-14). setSeen: the stored copy's stamp as this page last read or wrote it. Without a word from another tab the save
   is written at once, as before (a read first delayed the write, and a reload right after a tap lost it) */
let setSeen=0,setOther=false;
const setChan=(()=>{try{const c=new BroadcastChannel('dw-settings');c.onmessage=e=>{if(e.data&&+e.data.u>setSeen)setOther=true};return c}catch{return null}})();
async function saveUserSettings(){stampSettings(settings);planDirty();   // only the settings whose value changed get the new stamp (core.js)   // the settings have changed already: the cached plan is stale now, not only once they are stored
  if(setOther){setOther=false;
    try{const st=await metaGet('settings');
      if(st&&st.ks&&settings.ks&&(st.updated||0)>setSeen){setWardrobe({settings:mergeSettings(st,settings)});keySettings(settings);applyCustom(settings.custom);todayDirty()}}
    catch(e){console.warn('stored settings not read',e)}}
  setSeen=settings.updated||0;
  await metaPut('settings',settings);planDirty();try{if(setChan)setChan.postMessage({u:setSeen})}catch{}emit('settings-saved')}   // (sync.js: a backup soon)
/* testers have daily limits instead of costs: no "about 7¢" for them (account.js knows who is connected) */
const showCost=()=>!(typeof isTester==='function'&&isTester());
/* the parts of Settings drawn by later scripts (Round B, CR-7-11: account.js and remind.js replaced renderSettingsExtras with a wrapper
   at load, so a reader of this file couldn't see that every redraw also draws the account box, asks /me and draws the reminder):
   each registers once with settingsPart(fn), and renderSettingsExtras runs them last, in the order they registered (script order).
   Since the restructure's pilot (2026-11-25) a part is a note on the notice board's 'settings-parts' (bus.js), the same order */
function settingsPart(fn){on('settings-parts',fn)}
/* Settings drawn: the parts other files own draw themselves on 'settings-draw' (dress.js the dress code, daysoff.js the occasions and
   the days off, own-lists.js the own colors, patterns and materials, ui.js the connection, care.js the cleaning limits, weather.js the
   location and units), in their load order; then what this file draws, then the summaries, then the parts drawn last */
function renderSettingsExtras(){
  renderItemPicUI();renderReplanUI();emit('settings-draw');
  renderPicturesUI();if(served('asm-ui')){ask('asm-ui');if(asmLive())ask('asm-sync')}
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" data-act="dayTap" data-list="${id}" data-i="${i}" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  if($('#cfg-vest'))$('#cfg-vest').value=settings.vestMode||'auto';if($('#cfg-dark'))$('#cfg-dark').value=settings.darkShirts||'some';
  settingsSummaries();
  emit('settings-parts');   // look.js renderLookSetting, account.js acctSettingsPart, calendar.js renderCalUI, remind.js renderRemindUI
}
/* ---- Settings → Outfit pictures: "Painted pictures" (the default) or "Drawing only" (photos.js picsDrawn; settings.pictures, synced).
   For everyone, at the top of the category, not in the Advanced fold; drawn here rather than in index.html, like the other rows made
   from the settings. The line under it says what the choice does ---- */
const PICS_HELP={painted:'Painted pictures: the outfit is painted in its own cloth, on this device or ready-made from the server.',
  drawn:'Drawing only: the outfit is drawn, nothing is downloaded or painted; faster and uses less data.'};
function renderPicturesUI(){const pan=$('#sp-photos .mpanel-in');if(!pan)return;let g=$('#pics-box');
  if(!g){g=document.createElement('div');g.id='pics-box';g.className='sgroup pics-box';pan.insertBefore(g,pan.firstChild)}
  const v=picsDrawn()?'drawn':'painted';
  g.innerHTML=`<div class="slabel">Today’s outfit</div><p class="shelp" id="pics-help">${PICS_HELP[v]}</p>
<label class="srow">Show <select id="cfg-pictures" data-act-change="picsPick" aria-label="Today’s outfit" aria-describedby="pics-help"><option value="painted">Painted pictures</option><option value="drawn">Drawing only</option></select></label>`;
  $('#cfg-pictures').value=v}
async function setPictures(v){const d=v==='drawn';if(d===picsDrawn())return;settings.pictures=d?'drawn':'painted';await saveUserSettings();picsSwitched();
  renderPicturesUI();if(served('asm-ui'))ask('asm-ui');settingsSummaries()}
/* the choice changed (here, or on another device: start.js onSyncedData): Today is drawn again (once Settings closes, refreshToday), and
   back on "Painted pictures" the day on screen is painted or downloaded at once, while Settings is still open, and building ahead resumes
   from asmEnsure; on "Drawing only" building ahead stops at its next look (asmAhead's stop) */
function picsSwitched(){refreshToday();if(picsDrawn()||!asmLive())return;
  ask('asm-sync');const o=planFor()[key(sel)];if(o&&hasOutfit(o))ask('asm-ensure',o);schedulePrefetch()}
/* (vest, workdays, blazer days and units are drawn on Today too: todayStale redraws it when Settings closes; it stayed stale until a restart, audit 2026-11-14) */
function setVestMode(v){settings.vestMode=v;saveUserSettings();todayDirty();settingsSummaries()}
/* how often dark shirts are planned (planner.js, darkMode): the coming week is planned again with the new choice */
/* (fix round 2) saved before the week's locks are released, as setDress (dress.js): tapped then swiped away within ~100 ms, the change was lost */
async function setDarkShirts(v){settings.darkShirts=v;todayDirty();settingsSummaries();await saveUserSettings();await clearLocks()}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0){tell('At least one workday is needed: pick another day first.');return}settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  planDirty();todayDirty();renderSettingsExtras();return saveUserSettings().then(clearLocks)}
/* the markup's handlers (act.js): a day button of Workdays or Blazer days (data-list: its group's id, data-i: the weekday), and the
   Outfit pictures choice */
function dayTap(el){toggleDay(el.dataset.list,+el.dataset.i)}
function picsPick(el){setPictures(el.value)}
/* index.html's (act.js): the header's gear, Settings' backdrop and Done, a category's head (data-cat: its key), the Suit vest and Dark
   shirts choices */
/* The gear tapped before start-up has read the stored settings (the scripts are deferred: the page takes taps while they load) only
   notes it, and start-up opens Settings once Today is up (start.js showWanted, setWanted). Opened at once it showed the defaults, and a
   change made there was saved over the stored settings: every other setting went back to its default (found 2026-11-23). */
let setWant=false;
function setWanted(){const w=setWant;setWant=false;return w}
function setOpenTap(){if(typeof pagesOn==='undefined'||!pagesOn){setWant=true;return}openSettings()}
function setBackdropTap(){closeSettings()}
function setDoneTap(){saveSettings()}
function catTap(el){toggleCat(el.dataset.cat)}
function vestPick(el){setVestMode(el.value)}
function darkPick(el){setDarkShirts(el.value)}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setSetSeen(v){setSeen=v}
function setViewStale(v){viewStale=v}
/* The bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use as globals. Above acts({…}),
   the file's only top-level call that can throw: without act.js its names are still the page's */
Object.assign(globalThis,{SET_CATS,setCatOpen,toggleCat,backupSummary,settingsSummaries,weekFirst,openSettings,todayDirty,settingsOpen,refreshToday,closeSettings,saveSettings,saveUserSettings,showCost,settingsPart,renderSettingsExtras,renderPicturesUI,picsSwitched,setVestMode,toggleDay,setWanted,setSetSeen,setViewStale});
Object.defineProperties(globalThis,{viewStale:{get:()=>viewStale,set:v=>{viewStale=v}},setSeen:{get:()=>setSeen,set:v=>{setSeen=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
serve('refresh-today',refreshToday);   // (the restructure S6p: the painter, asm-today.js and asm-cm-page.js, redraws Today when a picture is ready; it loads before this file)
globalThis.HOOK={__proto__:globalThis.HOOK||null,SET_CATS,saveSettings,setCatOpen,setDarkShirts,setOpenTap,get setOther(){return setOther},setPictures,get todayStale(){return todayStale},backupSummary,toggleDay,settingsPart,settingsSummaries};
export {SET_CATS,setCatOpen,toggleCat,backupSummary,settingsSummaries,weekFirst,openSettings,todayStale,todayDirty,viewStale,settingsOpen,refreshToday,closeSettings,saveSettings,setSeen,setOther,saveUserSettings,showCost,settingsPart,renderSettingsExtras,renderPicturesUI,setPictures,picsSwitched,setVestMode,setDarkShirts,toggleDay,setWanted,setOpenTap,setSetSeen,setViewStale};
/* the notice board (bus.js): what Settings does when the router announces it (nav.js no longer names this file; the restructure S3f) */
on('page-showing',()=>closeSettings());   // another page is shown: Settings closes
on('page-back',()=>{if(settingsOpen())saveSettings()});   // the phone's Back with no page over Settings: what Done does
on('sub-opening',S=>{const m=$('#settings-modal');if(settingsOpen()&&m)S.set={cats:SET_CATS.filter(k=>{const e=$('#sc-'+k);return e&&e.classList.contains('open')}),top:m.scrollTop}});   // a page opened from Settings: how Settings was
on('sub-back',set=>{openSettings();for(const k of set.cats)setCatOpen(k,true,true);settingsSummaries();const m=$('#settings-modal');if(m)m.scrollTop=set.top});   // and back to Settings as it was
acts({dayTap,picsPick,setOpenTap,setBackdropTap,setDoneTap,catTap,vestPick,darkPick});
