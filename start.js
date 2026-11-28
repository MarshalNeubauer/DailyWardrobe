/* Daily Wardrobe: the start-up chain: the wardrobe from IndexedDB, then Today; the service worker. Moving between pages (show,
   subOpen, openAdd, pagesOn) is nav.js's since the restructure S3f (2026-11-26); this file keeps the tabs' and Add's handlers, so a tap
   on a tab during loading counts from where it always did (this file's place in the list)
   (An ES module, at its place in index.html's order; split out of app.js on 2026-11-14.) */
import {ask,need,slotsOf,runHooksSeq} from './bus.js';
import {backOn} from './back.js';
import {PAGES,openAdd,pageBack,setPageWant,setPagesOn,show,showWanted,subBack} from './nav.js';
import {$,applyCustom,cleanDay,cleanRecord,key,setWardrobe,settings,settingsOpen,takeSettings,todayDate} from './core.js';
import {toast} from './toast.js';
import {openSettings,picsSwitched,refreshToday,renderPicturesUI,setSetSeen,setWanted} from './settings.js';
import {acts} from './act.js';
/* The page's one global from a module (the restructure S6f, tests/bridge.test.js GLOBALS): index.html's last script calls startUp(), and
   its start-up catcher looks for window.startUp to tell a start-up that never came */
Object.assign(globalThis,{startUp});
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
  else{need('after-scripts',()=>ask('err-note',e,'Start-up'));
    setTimeout(()=>toast('Something went wrong while the app was starting. Your wardrobe is safe on this phone: nothing was deleted. Close the app fully and open it again; if this keeps happening, tell us in Settings → About → Feedback.',15000),0)}
  setPagesOn(true);setPageWant(null);setWanted();   // (a failed start-up stays on Today, where its message is)
  try{show('today')}catch(e2){console.warn(e2);if(startRead)need('after-scripts',()=>ask('err-note',e2,'Start-up: Today'));startPlain()}
  window.appReady=true;retryDone();need('after-scripts',()=>ask('storage-down',e));
  if(startRead)need('after-scripts',()=>{try{ask('safety-start')}catch(x){console.warn(x)}})}   // (Add's unsaved cards come back, the error report goes)
/* the start-up catcher's retry (index.html, all or nothing, A1): once the app is ready its stamp goes, so a later failed start gets its own
   one reload, and so does the address's ?dwretry= mark (the hash, an invitation's, stays; so does the history entry's state) */
function retryDone(){try{sessionStorage.removeItem('dw_retry')}catch{}
  try{if(/[?&]dwretry=/.test(location.search)){const u=new URL(location.href);u.searchParams.delete('dwretry');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}}catch{}}
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
const loadStored=()=>need('conn-restored').then(()=>Promise.all([need('tx','readonly',s=>s.getAll()),need('txs','days','readonly',s=>s.getAll()),need('meta-get','settings'),need('meta-get',need('plan-snap')).catch(()=>null)]));
/* what was read goes into memory (startRead/startTook tell startFailed how far it got), then the day Today opens on and the plan snapshot */
function applyStored(r,d,st,sn){startRead={r,d};const kept=need('stored-clean',r,d);setWardrobe({items:kept.items});d=kept.days;startTook=true;setWardrobe({days:Object.fromEntries((d||[]).map(x=>[x.date,x]))});setWardrobe({settings:takeSettings(settings,need('stored-settings-clean',st))});setSetSeen(st&&st.updated||0);applyCustom(settings.custom);need('wx-preload');
  if(key(need('sel-day'))===key(todayDate())){const h=need('home-day');need('sel-set',new Date(h));need('view-set',{y:h.getFullYear(),m:h.getMonth()})}
  need('plan-snap-use',sn)}
/* started before Today is first drawn: the plan rules check and the one-time fix-ups of old records */
function startChecks(){const P=slotsOf('start-checks');Promise.resolve(P.checkPlanRules?.()).then(()=>need('when-pulled',()=>ask('check-arrivals'))).then(()=>{if(!$('#today').hidden)refreshToday()});
  need('after-scripts',()=>P.migrateVests?.());need('when-pulled',()=>P.dropLearn?.());
  need('when-pulled',()=>need('after-scripts',()=>{if(P.kitFixOldImports)P.kitFixOldImports().then(n=>{if(n&&!$('#today').hidden)refreshToday()})}));
  need('when-pulled',()=>P.kitSampleMigrate?.())}
/* after Today is drawn: the setup, the weather and holidays, the kept photos (then appReady) and the photo fix-ups, the safety checks */
function startJobs(){const P=slotsOf('start-jobs');need('after-scripts',()=>P.setupStart?.());ask('weather-load');need('after-scripts',()=>P.refreshHolidays?.());   // (without setup.js, weather.js or daysoff.js start-up goes on: the restructure S6h)
  need('renders-load').then(()=>/** @type {any} */(need('asm-live')?P.asmLoad?.():0)).then(()=>{need('after-dom',()=>{window.appReady=true;retryDone()});if(need('asm-live'))need('after-scripts',()=>P.asmSync?.());if(Object.keys(need('renders')).length&&!$('#today').hidden)refreshToday();
    need('item-backdrops-fix').then(n=>{if(n&&!$('#today').hidden)refreshToday()});
    need('when-pulled',()=>need('tex-swatches').then(n=>{if(n&&!$('#today').hidden)refreshToday()}));
    need('when-pulled',()=>runHooksSeq('after-pull-fixups'));   // (migrate.js's recolor, close-ups, photos and backdrops, then item-photo.js's small photos: load order, one after another)
    need('after-scripts',()=>ask('safety-start'))})}

/* (Today opens on the home day once the settings are read: today, or the next workday when today is a weekend or a day off; it opened on the
   calendar day, an empty "Saturday isn't a workday" page, while the Today tab went to Sunday's outfit (audit 2026-11-14))
   (window.appReady also waits for every script to have run (afterDom; afterScripts waits for the load event, pictures too, and held it up 30 s once): on a slow load app.js's start-up finished while about.js
   was still to come, and a test read the page before about.js had shown its note after a restart)
   (window.appReady is set once the kept photos are loaded too (loadRenders, asmLoad): loadRenders starts `renders` afresh, and a test that put a photo there the moment the items were in lost it on a busy machine) */
/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){setWardrobe({days:Object.fromEntries((m.days||[]).map(d=>[d.date,d]))});const drawn=need('pics-drawn');if(m.settings){setWardrobe({settings:takeSettings(settings,m.settings)});setSetSeen(m.settings.updated||0);applyCustom(settings.custom)}const Y=slotsOf('synced');Y.dressSynced?.(m);Y.wardSynced?.(m);ask('weather-load');ask('remind-soon');   // (another device may have changed the coming outfits: the reminder lines follow, CR-4-09)
  if(need('pics-drawn')!==drawn){picsSwitched();if(settingsOpen()){renderPicturesUI();slotsOf('settings-rows').renderAsmUI?.()}}}   // "Drawing only" chosen on another device
/* the markup's handlers (act.js): Add's ‹, the Wardrobe's round +, and the Wardrobe and Insights tabs (data-page: the page shown) */
function addBackTap(){subBack()}
function wardAddTap(){openAdd()}
function tabTap(el){show(el.dataset.page)}
function reloadTap(){location.reload()}   // "Try again" on the plain card shown when Today couldn't be drawn (startPlain)
acts({addBackTap,wardAddTap,tabTap,reloadTap});
