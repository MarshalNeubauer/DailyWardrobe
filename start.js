/* Daily Wardrobe: moving between pages (show) and the start-up chain: the wardrobe from IndexedDB, then Today; the service worker
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* moving between pages: the page arriving eases in from the side its tab is on (Today, Wardrobe, Add left to right), a short slide and a
   fade on the cards' curve; a page opened from Settings (stats, packing, care) rises in instead. The tab bar's marker slides to the tab
   (styles.css nav::before, --ti). Only the page arriving moves: the one leaving goes at once, so nothing is laid out twice. */
const PAGES=['today','wardrobe','add','stats','pack','care'],TABS=['today','wardrobe','stats'],PAGE_MS=320;
function pageIn(t,from){const el=$('#'+t),nav=document.querySelector('body>nav'),ti=TABS.indexOf(t);
  if(nav){nav.style.setProperty('--ti',Math.max(0,ti));nav.classList.toggle('tab-none',ti<0)}
  if(!el||!from||from===t||noMotion())return;
  if(el._ps){el._ps.cancel();el._ps=null}   // a scroll slide left from an unfold (pageScroll) on Today
  const a=TABS.indexOf(from),dx=a>=0&&ti>=0?(ti>a?28:-28):0;if(el._pg)el._pg.cancel();
  const an=el._pg=el.animate([{opacity:0,transform:dx?`translateX(${dx}px)`:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:PAGE_MS,easing:MONTH_EASE});
  an.finished.then(()=>{if(el._pg===an)el._pg=null},()=>{})}
/* a page opened from Settings or from Today (stats, packing, care: openStats, openPack, openCare call subOpen first) goes back with its ‹
   (subBack) to where it was opened from: Settings as it was, the same categories open and scrolled the same, over the page under it; or
   the page it came from, scrolled where it was. (The ‹ always went to Today, out of Settings entirely.) */
let subFrom=null;
/* The phone's Back (button or swipe) steps back one level: on one of these pages it does what the ‹ does, in Settings what Done does.
   There is one history entry while Settings or such a page is open (appHist), and appKind says whose it is: opening a page from Settings
   hands Settings' entry on to the page ('set' → 'sub') and its ‹ hands it back, so Back never needs two presses. Left any other way
   (Done, a tab, the ‹ to Today) the entry is taken away with a history.back() of our own (appPend) that the popstate below lets pass;
   appKeep holds it while subBack moves from the page to Settings. (The item sheet keeps its own entry the same way: histPush.) */
const SUBS=['add','pack','care'];let appHist=false,appKind='',appPend=false,appKeep=false;
function appPush(kind){if(appHist){appKind=kind;return}if(appPend||itemBack)return;try{history.pushState({app:kind},'');appHist=true;appKind=kind}catch{}}
function appDrop(kind){if(!appHist||appKeep||appKind!==kind)return;appHist=false;appPend=true;try{history.back()}catch{appPend=false}}
addEventListener('popstate',()=>{if(appPend){appPend=false;if(editing)histPush();return}   // our own step back; an item opened meanwhile gets its entry now
  if(!appHist)return;appHist=false;
  if(appKind==='sub'&&SUBS.some(s=>{const e=$('#'+s);return e&&!e.hidden}))subBack();else if(settingsOpen())saveSettings()});
function subOpen(){appPush('sub');
  const m=$('#settings-modal');let page=PAGES.find(s=>{const e=$('#'+s);return e&&!e.hidden})||'today';
  if(!TABS.includes(page))page='today';   // one of these pages opened from another: its ‹ goes to Today
  subFrom={page,y:scrollY,set:settingsOpen()&&m?{cats:SET_CATS.filter(k=>{const e=$('#sc-'+k);return e&&e.classList.contains('open')}),top:m.scrollTop}:null}}
function subBack(){const f=subFrom||{page:'today',y:0,set:null};subFrom=null;
  appKeep=!!f.set;try{show(f.page)}finally{appKeep=false}scrollTo(0,f.y);   // back to Settings: the entry stays, for Settings now
  if(!f.set)return;openSettings();for(const k of f.set.cats)setCatOpen(k,true,true);settingsSummaries();const m=$('#settings-modal');if(m)m.scrollTop=f.set.top}
/* Add is a page of the Wardrobe (its + Add button), with a ‹ back to where it was opened from (subBack) */
function openAdd(){subOpen();show('add');scrollTo({top:0})}
function show(t){
  const from=PAGES.find(s=>{const e=$('#'+s);return e&&!e.hidden});
  if(!SUBS.includes(t))appDrop('sub');   // a page left by the ‹ (to Today) or a tab: its Back entry goes
  if(typeof setupYield==='function')setupYield(t);
  closeSettings();if(typeof closeShop==='function')closeShop();if(t!=='wardrobe'&&editing)dropItem();
  for(const s of['today','wardrobe','add','stats']){const el=$('#'+s);if(el)el.hidden=s!==t;const btn=$('#n-'+s);if(btn)btn.classList.toggle('on',s===t)}
  if(from==='wardrobe'&&t!=='wardrobe'&&!editing){const w=$('#wardrobe');if(w)w.textContent=''}   // the grid (about 4,900 elements at 107 items) is drawn again on coming back: kept, it stayed in memory and in every style recalculation (audit 2026-11-13)
  const f={today:renderToday,wardrobe:renderWardrobe,add:renderAdd,stats:()=>typeof statsShow==='function'?statsShow():renderStats()};if(f[t])f[t]();
  if(typeof packShow==='function')packShow(t);   // the packing list page (pack.js)
  if(t!=='wardrobe')renderItem();   // the item page belongs to the Wardrobe
  if(typeof careShow==='function')careShow(t);   // the Care page (care.js)
  pageIn(t,from);
}

db.then(()=>Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings'),metaGet(PLAN_SNAP).catch(()=>null)])).then(([r,d,st,sn])=>{items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};applyCustom(settings.custom);wxPreload();planSnapUse(sn);checkPlanRules().then(()=>whenPulled(checkArrivals)).then(()=>{if(!$('#today').hidden)refreshToday()});afterScripts(()=>{if(typeof migrateVests==='function')migrateVests()});show('today');afterScripts(()=>{if(typeof setupStart==='function')setupStart()});loadWeather();afterScripts(()=>refreshHolidays());loadRenders().then(()=>asmLive()?asmLoad():0).then(()=>{afterDom(()=>{window.appReady=true});if(asmLive())afterScripts(()=>asmSync());if(Object.keys(renders).length&&!$('#today').hidden)refreshToday();fixItemBackdrops().then(n=>{if(n&&!$('#today').hidden)refreshToday()});whenPulled(()=>texSwatches().then(n=>{if(n&&!$('#today').hidden)refreshToday()}));whenPulled(()=>recolourSpecSetts().then(n=>{if(n&&!$('#today').hidden)refreshToday()}).then(()=>upgradeCloseups()).then(()=>upgradePhotos()).then(()=>smallPhotos()));if(queuedKeys().length){checkQueue();startQueueWatch()}afterScripts(()=>safetyStart())})}).catch(e=>{console.warn(e);items=[];show('today');window.appReady=true;afterScripts(()=>storageDown(e))});

/* (window.appReady also waits for every script to have run (afterDom; afterScripts waits for the load event, pictures too, and held it up 30 s once): on a slow load app.js's start-up finished while about.js
   was still to come, and a test read the page before about.js had shown its note after a restart)
   (window.appReady is set once the kept photos are loaded too (loadRenders, asmLoad): loadRenders starts `renders` afresh, and a test that put a photo there the moment the items were in lost it on a busy machine) */
/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){dayRecs=Object.fromEntries((m.days||[]).map(d=>[d.date,d]));if(m.settings){settings={...settings,...m.settings};applyCustom(settings.custom)}if(typeof dressSynced==='function')dressSynced(m);loadWeather()}

