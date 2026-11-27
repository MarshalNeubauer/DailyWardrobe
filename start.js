/* Daily Wardrobe: the start-up chain: the wardrobe from IndexedDB, then Today; the service worker. Moving between pages (show,
   subOpen, openAdd, pagesOn) is nav.js's since the restructure S3f (2026-11-26); this file keeps the tabs' and Add's handlers, so a tap
   on a tab during loading counts from where it always did (this file's place in the list)
   (An ES module, at its place in index.html's order; split out of app.js on 2026-11-14.) */
import {ask} from './bus.js';
import {backOn} from './back.js';
import {PAGES,openAdd,pageBack,setPageWant,setPagesOn,show,showWanted,subBack} from './nav.js';
import {$,applyCustom,cleanDay,cleanRecord,key,setWardrobe,settings,takeSettings,todayDate} from './core.js';
import {toast} from './toast.js';
import {openSettings,picsSwitched,refreshToday,renderPicturesUI,setSetSeen,setWanted,settingsOpen} from './settings.js';
import {acts} from './act.js';
/* The bridge (tests/bridge.test.js): what index.html's last script (startUp), sync.js (onSyncedData) and the tests still use as globals */
Object.assign(globalThis,{startUp,onSyncedData});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,startPlain,tabTap,startUp};
export {startPlain,startUp,onSyncedData,tabTap};
/* the phone's Back on a page opened over another, or in Settings (nav.js pageBack), pinned at this file's place in the list as before.
   Without back.js or nav.js this line throws, and this file stops before its declarations below: startUp can't run and the start-up
   card shows (both are required files: tests/load-contract.json) */
backOn('sub',pageBack);backOn('set',pageBack);

/* a start-up that fails (CR-7-03, the code review 2026-11-16: any error in the chain below emptied the wardrobe in memory and drew
   "Get your first outfit", with no word and no error note, so a person re-added pieces and got duplicates). Only stores that couldn't be
   read leave the wardrobe empty (storageDown says so); after they were read, the wardrobe that was read stays, the person is told in plain
   words that nothing is lost, and the error is noted (safety.js errNote, which a tester's phone reports by itself). */
let startRead=null,startTook=false;
function startFailed(e){console.warn(e);
  if(startRead&&!startTook){   // the stored-record check itself failed: each record goes through it alone, and one that fails it stays out
    const one=(f,x)=>{try{return f(x)}catch{return null}};
    setWardrobe({items:(startRead.r||[]).map(x=>one(cleanRecord,x)).filter(Boolean)});
    setWardrobe({days:Object.fromEntries((startRead.d||[]).map(x=>one(cleanDay,x)).filter(Boolean).map(x=>[x.date,x]))})}
  if(!startRead)setWardrobe({items:[]});
  else{afterScripts(()=>errNote(e,'Start-up'));
    setTimeout(()=>toast('Something went wrong while the app was starting. Your wardrobe is safe on this phone: nothing was deleted. Close the app fully and open it again; if this keeps happening, tell us in Settings → About → Feedback.',15000),0)}
  setPagesOn(true);setPageWant(null);setWanted();   // (a failed start-up stays on Today, where its message is)
  try{show('today')}catch(e2){console.warn(e2);if(startRead)afterScripts(()=>errNote(e2,'Start-up: Today'));startPlain()}
  window.appReady=true;afterScripts(()=>storageDown(e));
  if(startRead)afterScripts(()=>{try{safetyStart()}catch(x){console.warn(x)}})}   // (Add's unsaved cards come back, the error report goes)
/* Today couldn't be drawn: a plain card says so, with Try again */
function startPlain(){const t=$('#today');if(!t)return;for(const s of PAGES){const el=$('#'+s);if(el)el.hidden=s!=='today'}
  t.innerHTML='<div class="mbox"><p><b>Today couldn’t be shown.</b></p><p class="shelp">Your wardrobe is safe on this phone: nothing was deleted.</p><div class="sactions"><button type="button" data-act="reloadTap">Try again</button></div></div>'}
/* start-up (Round B, CR-7-09: it was one 2,000-character line): index.html's last script calls startUp() once every script has run, so
   nothing here can come before a later script (the rule "whatever Today draws at start-up lives in start.js or earlier" is gone). The steps
   run in the order the line had them; a throw in any of them, or stores that can't be read, goes to startFailed as before. What is
   started in the background (the plan rules check, the photo fix-ups) keeps its own promise chain, as before: its errors don't reach
   startFailed. afterScripts still waits for the load event and whenPulled for the first pull, as they did. */
/* window.startBusy: start-up is under way (index.html's start-up catcher waits for it while the stored wardrobe is being read, however
   long that takes); false again only when startFailed itself couldn't finish, which leaves nobody else to say so */
async function startUp(){window.startBusy=true;
  try{const [r,d,st,sn]=await loadStored();applyStored(r,d,st,sn);startChecks();setPagesOn(true);show('today');startJobs();showWanted();
    if(setWanted())openSettings()}   // the gear tapped during loading (settings.js setOpenTap): Settings opens now, with the stored settings read
  catch(e){try{startFailed(e)}catch(e2){window.startBusy=false;throw e2}}}
/* the four reads: items, days, settings and the plan snapshot */
const loadStored=()=>connRestored.then(()=>Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings'),metaGet(PLAN_SNAP).catch(()=>null)]));
/* what was read goes into memory (startRead/startTook tell startFailed how far it got), then the day Today opens on and the plan snapshot */
function applyStored(r,d,st,sn){startRead={r,d};const kept=cleanStored(r,d);setWardrobe({items:kept.items});d=kept.days;startTook=true;setWardrobe({days:Object.fromEntries((d||[]).map(x=>[x.date,x]))});setWardrobe({settings:takeSettings(settings,cleanStoredSettings(st))});setSetSeen(st&&st.updated||0);applyCustom(settings.custom);wxPreload();
  if(key(sel)===key(todayDate())){const h=homeDay();setSel(new Date(h));setView({y:h.getFullYear(),m:h.getMonth()})}
  planSnapUse(sn)}
/* started before Today is first drawn: the plan rules check and the one-time fix-ups of old records */
function startChecks(){checkPlanRules().then(()=>whenPulled(checkArrivals)).then(()=>{if(!$('#today').hidden)refreshToday()});
  afterScripts(()=>migrateVests());whenPulled(dropLearn);
  whenPulled(()=>afterScripts(()=>kitFixOldImports().then(n=>{if(n&&!$('#today').hidden)refreshToday()})));
  whenPulled(()=>kitSampleMigrate())}
/* after Today is drawn: the setup, the weather and holidays, the kept photos (then appReady) and the photo fix-ups, the safety checks */
function startJobs(){afterScripts(()=>setupStart());loadWeather();afterScripts(()=>refreshHolidays());
  loadRenders().then(()=>/** @type {any} */(asmLive()?ask('asm-load'):0)).then(()=>{afterDom(()=>{window.appReady=true});if(asmLive())afterScripts(()=>ask('asm-sync'));if(Object.keys(renders).length&&!$('#today').hidden)refreshToday();
    fixItemBackdrops().then(n=>{if(n&&!$('#today').hidden)refreshToday()});
    whenPulled(()=>texSwatches().then(n=>{if(n&&!$('#today').hidden)refreshToday()}));
    whenPulled(()=>recolourSpecSetts().then(n=>{if(n&&!$('#today').hidden)refreshToday()}).then(()=>upgradeCloseups()).then(()=>upgradePhotos()).then(()=>fixBlackBackdrops()).then(()=>smallPhotos()));
    afterScripts(()=>safetyStart())})}

/* (Today opens on the home day once the settings are read: today, or the next workday when today is a weekend or a day off; it opened on the
   calendar day, an empty "Saturday isn't a workday" page, while the Today tab went to Sunday's outfit (audit 2026-11-14))
   (window.appReady also waits for every script to have run (afterDom; afterScripts waits for the load event, pictures too, and held it up 30 s once): on a slow load app.js's start-up finished while about.js
   was still to come, and a test read the page before about.js had shown its note after a restart)
   (window.appReady is set once the kept photos are loaded too (loadRenders, asmLoad): loadRenders starts `renders` afresh, and a test that put a photo there the moment the items were in lost it on a busy machine) */
/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){setWardrobe({days:Object.fromEntries((m.days||[]).map(d=>[d.date,d]))});const drawn=picsDrawn();if(m.settings){setWardrobe({settings:takeSettings(settings,m.settings)});setSetSeen(m.settings.updated||0);applyCustom(settings.custom)}dressSynced(m);loadWeather();if(typeof remindSoon==='function')remindSoon();   // (another device may have changed the coming outfits: the reminder lines follow, CR-4-09)
  if(picsDrawn()!==drawn){picsSwitched();if(settingsOpen()){renderPicturesUI();ask('asm-ui')}}}   // "Drawing only" chosen on another device
/* the markup's handlers (act.js): Add's ‹, the Wardrobe's round +, and the Wardrobe and Insights tabs (data-page: the page shown) */
function addBackTap(){subBack()}
function wardAddTap(){openAdd()}
function tabTap(el){show(el.dataset.page)}
function reloadTap(){location.reload()}   // "Try again" on the plain card shown when Today couldn't be drawn (startPlain)
acts({addBackTap,wardAddTap,tabTap,reloadTap});
