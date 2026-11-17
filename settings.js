/* Daily Wardrobe: Settings: the page and its categories, schedule, days off, formal days, weather, toasts, refresh and the theme
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* settings management */
/* Settings: a full-screen page of categories that unfold like Today's cards; openSettings('weather') opens one directly */
const SET_CATS=['laundry','schedule','daysoff','weather','care','photos','tagging','backup','connection','about'];
function setCatOpen(key,open,instant){const el=$('#sc-'+key);if(!el)return;el.classList.toggle('instant',!!instant);if(!instant){el.classList.remove('instant');void el.offsetHeight}
  el.classList.toggle('open',open);const b=el.querySelector('.scat-head');if(b)b.setAttribute('aria-expanded',open);
  if(open&&key==='backup'&&typeof loadSnapshots==='function')loadSnapshots();   // the daily backups list is read as Backup opens (sync.js)
  if(open&&key==='about'&&typeof renderAbout==='function')renderAbout();   // only as About opens (its header ran it on closing too, and asked the server each time: CR-7-06)
  if(open&&key==='laundry'&&typeof renderCare==='function')renderCare()}   // Laundry & cleaning's lists, as it opens (care.js)
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
  const last=+localStorage.getItem('last_sync')||0,st=localStorage.getItem('sync_status')||'',when=t=>{const d=new Date(t),days=Math.round((todayDate()-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
    return days<=0?'today':days===1?'yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
  // (2026-11-15, the audit: "Backed up today" while the day's saves were used up and none of the new items was on the server)
  const pz=+localStorage.getItem('sync_pause')||0;
  if(typeof syncPaused==='function'?syncPaused():pz>nowMs()){const p=pausedUntil(pz);return last?`Paused until ${p} · last saved ${when(last)}`:`Paused until ${p}: not backed up yet`}
  if(/^Backups held/.test(st))return 'Held: deleted from the server on another device';   // (sync.js syncWiped)
  if(/^Backing up/.test(st))return last?`Backing up photos · last saved ${when(last)}`:'Backing up photos: not finished yet';   // (photos going up in batches, sync-photos.js phBatch)
  if(/^Not backed up:/.test(st))return last?`Waiting for a connection · last saved ${when(last)}`:'Waiting for a connection: not backed up yet';
  if(/failed/i.test(st))return last?`Last backup failed · last saved ${when(last)}`:'Backup failed: not backed up yet';
  return last?`Backed up ${when(last)}`+(localStorage.getItem('sync_wait')&&!/^Syncing/.test(st)?' · newer changes waiting':''):'Not backed up yet'}
function settingsSummaries(){const set=(k,t)=>{const e=$('#sum-'+k);if(e)e.textContent=t};if(typeof applyRole==='function')applyRole();if(typeof remindSoon==='function')remindSoon();
  // the days from the week's first one: the first day (Sunday first) whose day before isn't one of them, so Sun–Thu reads "Sun–Thu"
  // (sorted from Monday it read "Mon, Tue, Wed, Thu, Sun", audit 2026-11-13)
  const days=l=>{const has=new Set(l),s0=weekFirst(l),s=[...has].sort((a,b)=>((a-s0+7)%7)-((b-s0+7)%7)),n=i=>DAY_NAMES[i].slice(0,3);if(!s.length)return 'none';
    const run=s.length>2&&s.every((d,i)=>!i||(s[i-1]+1)%7===d);return run?`${n(s[0])}–${n(s[s.length-1])}`:s.map(n).join(', ')};
  set('schedule',`${days(settings.workdays)} · ${scheduleWear(days)}`);
  const T=isoKey(todayDate()),h=settings.holidays,offs=(settings.daysOff||[]).filter(x=>x.d>=T).length,occ=Object.values(dayRecs).filter(r=>r.date&&keyDate(r.date)>=todayDate()&&occOf(r)).length;
  set('daysoff',[h&&h.country?((h.list||[]).length?`${h.country} holidays`:`${typeof countryName==='function'?countryName(h.country):h.country}: no holiday list`):'No holidays',`${offs} day${offs===1?'':'s'} off`,`${occ} occasion${occ===1?'':'s'}`].join(' · '));
  set('weather',`${settings.location?settings.location.name:'No location set'} · °${unit()}`);
  set('photos',picsDrawn()?'Drawing only':typeof isConnected==='function'&&!isConnected()?'Painted pictures · needs a connection':'Painted pictures');   // (the masters come from the server)
  const own=Object.keys((settings.custom&&settings.custom.colors)||{}).length+Object.keys((settings.custom&&settings.custom.patterns)||{}).length;
  const om=Object.keys(MATERIALS_BY).reduce((n,t)=>n+ownMats(t).length,0);   // (own materials, 2026-11-16)
  set('tagging',`${own?own+' color'+(own===1?'':'s')+' & patterns of your own':'Your own colors & patterns'}${om?` · ${om} material${om===1?'':'s'}`:''}`);
  const w=localStorage.getItem('worker_url');let host='';try{host=w?new URL(w).host:''}catch{}
  set('backup',backupSummary(w));set('connection',typeof connSummary==='function'?connSummary():host||'Not connected')}
/* the week's first day: the first workday (Sunday first) whose day before isn't one, so Sun–Thu starts on Sunday and Mon–Fri on Monday;
   the Schedule summary and the month's grid (month.js) both start there */
const weekFirst=(l=settings.workdays)=>{const has=new Set(l||[]);return [0,1,2,3,4,5,6].find(d=>has.has(d)&&!has.has((d+6)%7))||0};
/* the Schedule summary's dress part (audit 2026-11-15: with ties off it dropped the blazer days): blazer days whenever jackets are worn,
   the vest only with ties, as Settings shows them */
function scheduleWear(days){const j=wearsJacket(),t=wearsTie();
  if(!j)return typeof dressSummary==='function'?dressSummary():'no jackets';const bl=settings.blazerDays.filter(d=>settings.workdays.includes(d));
  return [bl.length?'blazers '+days(bl):'suits every day',t?'vest '+({auto:'on cooler suit days',always:'every suit day',never:'never'})[settings.vestMode||'auto']:'no ties'].join(' · ')}
function openSettings(section){
  const already=settingsOpen(),subUnder=!already&&appHist&&appKind==='sub'&&SUBS.some(s=>{const e=$('#'+s);return e&&!e.hidden});
  const cat=section==='wx'?'weather':section;
  for(const k of SET_CATS)setCatOpen(k,k===cat,true);
  if(typeof advClose==='function')advClose();   // the Advanced folds start closed every time
  if(cat)setTimeout(()=>{const el=$('#sc-'+cat),m=$('#settings-modal');if(el&&m)m.scrollTop=el.offsetTop-m.querySelector('.shead').offsetHeight-8},0);else if($('#settings-modal'))$('#settings-modal').scrollTop=0;
  // storage that is blocked (localStorage throws) or broken must not keep Settings shut: it opens with what could be drawn (audit 2026-11-13)
  try{if($('#cfg-url')) $('#cfg-url').value=localStorage.getItem('worker_url')||'';
    if($('#cfg-token')) $('#cfg-token').value=localStorage.getItem('app_token')||''}catch(e){console.warn('connection not read',e)}
  try{if(window.showSyncStatus)showSyncStatus()}catch(e){console.warn('backup line not drawn',e)}
  try{renderSettingsExtras()}catch(e){console.warn('Settings drawn in part',e)}
  try{settingsSummaries()}catch(e){console.warn('Settings summaries not drawn',e)}
  if($('#settings-modal')){ $('#settings-modal').style.display='block'; $('#settings-modal').style.pointerEvents='auto'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='block'; $('#modal-backdrop').style.pointerEvents='auto'; }
  // the phone's Back closes it (appPush, by show()); over Add, the Packing list or Laundry (the gear, Add's "Connect") Settings borrows
  // that page's entry and hands it back on closing, so the page's Back still works after (CR-7-04: Settings took the entry, and the next
  // Back left the app)
  setLock(true);if(!already)setOver=subUnder?'sub':'';if(setOver&&appHist)appKind='set';else appPush('set');
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
  if(was&&over){if(appHist&&appKind==='set')appKind=over;else if(!appHist&&SUBS.some(s=>{const e=$('#'+s);return e&&!e.hidden}))appPush(over)}else appDrop('set');
  setLock(false);
  if(was&&typeof layerClose==='function')layerClose($('#settings-modal'));
  if(todayStale){todayStale=false;keepHome();renderToday()}   // (Today on the home day follows a workday taken away)
  if(viewStale){const v=viewStale;viewStale=null;if(!$('#'+v).hidden)show(v)}
}
function saveSettings(){
  // (audit 2026-11-15, W1-7-02) another address or code typed while connected moves this phone to another account: it goes through the
  // link's questions (account.js acctTyped: the same account goes through, another asks, backs up and clears first). Stored as typed, the
  // next sync merged this phone's wardrobe into the other account
  const tu=$('#cfg-url')?$('#cfg-url').value.trim():null,tt=$('#cfg-token')?$('#cfg-token').value.trim():null,cu=(localStorage.getItem('worker_url')||'').trim(),ct=(localStorage.getItem('app_token')||'').trim();
  // (CR-5-07, 2026-11-17) a first connection typed here too: it skipped the server's check of the code and "Add this phone's N pieces…?"
  if(typeof acctTyped==='function'&&tu&&tt&&(!ct||!cu||tt!==ct||tu.replace(/\/*$/,'/')!==cu.replace(/\/*$/,'/'))){
    closeSettings();acctTyped(tu,tt).catch(e=>console.warn('connection not changed',e));return}
  // full or blocked storage: Done still closes Settings (it threw before closing), and says the connection wasn't kept
  try{if($('#cfg-url')) localStorage.setItem('worker_url',$('#cfg-url').value.trim());
    if($('#cfg-token')) localStorage.setItem('app_token',$('#cfg-token').value.trim())}
  catch(e){console.warn('connection not saved',e);setTimeout(()=>toast('Couldn’t save the server address: this browser’s storage is full or blocked.',5000),0)}
  connKeep();   // the database's copy of the connection follows (app.js)
  closeSettings();
  try{renderAdd()}catch(e){console.warn('Add page not drawn',e)}
  if(window.syncNow)syncNow().catch(e=>console.warn('sync not started',e));
}


/* dates in the app's language (audit 2026-11-15: an Arabic-language iPhone showed "الأحد، ١٥ نوفمبر" inside the English app): every
   toLocale…String(undefined, …) uses the phone's language when it is English, else American English (the app's language; Latin digits) */
const APP_LOC=/^en\b/i.test(navigator.language||'en')?navigator.language:'en-US';
function appLocale(){if(Date.prototype._dwLoc)return;for(const m of ['toLocaleDateString','toLocaleString','toLocaleTimeString']){const f=Date.prototype[m];
  Date.prototype[m]=function(loc,o){return f.call(this,loc===undefined||(Array.isArray(loc)&&!loc.length)?APP_LOC:loc,o)}}Object.defineProperty(Date.prototype,'_dwLoc',{value:true})}   // ([] too, "the browser's language", as sync-status.js's backup-pause times pass: CR-7-05)
appLocale();
/* ---- settings: schedule, weather location, units ---- */
/* °F where the country uses it (audit 2026-11-15: a Kuwait user on an English (US) iPhone got °F): the chosen location's country, else the
   time zone's (setup.js tzCountry, which falls back on the phone's region), else the phone's language as before */
const F_CC=['US','LR','MM','PR','GU','VI','AS','MP','BS','KY','PW','FM','MH'];
const locCC=l=>l&&(l.cc||(/,\s*([A-Z]{2})$/.exec(l.name||'')||[])[1])||'';
const unitCC=()=>locCC(settings.location)||(typeof tzCountry==='function'&&tzCountry())||'';
const unit=()=>{if(settings.units)return settings.units;const cc=unitCC();return cc?(F_CC.includes(cc)?'F':'C'):/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C'};
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
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
  await metaPut('settings',settings);planDirty();try{if(setChan)setChan.postMessage({u:setSeen})}catch{}if(window.scheduleSync)scheduleSync()}
/* ---- Settings: days off. A country's public holidays (each can be unticked if you work that day) and your own days
   off (a single day or a range, e.g. a holiday trip). They are planned like weekends: no outfit, nothing counted as worn. ---- */
const COUNTRY_CODES='AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS YE YT ZA ZM ZW'.split(' ');
const countryName=cc=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||cc}catch{return cc}};
let holidayMsg='';
/* public holidays of a country for about the next 13 months -> [{d:'YYYY-MM-DD', n:name}]. Nager.Date first (free, no key,
   most countries); the worker's /holidays (Google's public holiday calendars) for the ones it lacks, e.g. the Gulf states */
/* Nager.Date's holidays that count (audit 2026-11-15: the UK lost New Year's Day, Easter Monday and the Summer bank holiday, listed for
   England, Wales and Northern Ireland rather than "global"): a regional holiday counts when it covers at least half of the regions the
   year's list names (a single state's or nation's day doesn't); the English name, except in English-speaking countries, whose own name
   it is ("Boxing Day", "Labor Day") */
const HOL_EN=['US','GB','IE','AU','NZ','CA','ZA','NG','KE','GH','JM','SG','IN','PK','PH','MT','BS','BB','TT','BZ','GY','UG','ZM','ZW','BW','NA'];
function nagerKeep(list,cc){const regs=new Set();for(const h of list)for(const c of h.counties||[])regs.add(c);
  return list.filter(h=>(!h.types||h.types.includes('Public'))&&(h.global!==false||(regs.size&&(h.counties||[]).length*2>=regs.size)))
    .map(h=>({d:h.date,n:(HOL_EN.includes(cc)?h.localName||h.name:h.name||h.localName)}))}
/* countries whose list the phone works out itself when the server can't give one (audit 2026-11-15: Kuwait, the app's home, had none
   without a connection): fixed days, and Islamic days from the Umm al-Qura calendar, which can be a day off the announced date */
const HOL_FIXED={KW:[['01-01','New Year’s Day'],['02-25','National Day'],['02-26','Liberation Day']]};
const HOL_HIJRI={KW:[[7,27,'Isra and Mi’raj'],[10,1,'Eid al-Fitr'],[10,2,'Eid al-Fitr'],[10,3,'Eid al-Fitr'],[12,9,'Arafat Day'],[12,10,'Eid al-Adha'],[12,11,'Eid al-Adha'],[12,12,'Eid al-Adha'],[1,1,'Islamic New Year'],[3,12,'The Prophet’s Birthday']]};
function builtinHolidays(cc,from,to){if(!HOL_FIXED[cc]&&!HOL_HIJRI[cc])return null;let f=null;
  try{f=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'numeric',timeZone:'UTC'})}catch{f=null}
  const out=[];for(const d=isoToDate(from);isoKey(d)<=to;d.setDate(d.getDate()+1)){const k=isoKey(d);
    for(const [md,n] of HOL_FIXED[cc]||[])if(k.slice(5)===md)out.push({d:k,n});
    if(f&&HOL_HIJRI[cc]){const p=f.formatToParts(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),12))),v=t=>+((p.find(x=>x.type===t)||{}).value);
      for(const [hm,hd,n] of HOL_HIJRI[cc])if(hm===v('month')&&hd===v('day'))out.push({d:k,n})}}
  return out}
/* the calendar years from one YYYY-MM-DD to another, both included */
const holYears=(from,to)=>{const a=+from.slice(0,4),b=+to.slice(0,4),out=[];for(let y=a;y<=b;y++)out.push(y);return out};
async function fetchHolidays(cc){
  const T=trueToday(),from=isoKey(new Date(T.getFullYear(),T.getMonth()-1,T.getDate())),to=isoKey(new Date(T.getFullYear()+1,T.getMonth()+1,T.getDate()));
  // only a dated, named holiday (fix round A, CR-7-02: the string compare let `2026-12-01" onclick="…` through); names as core.js cleanSettings keeps them
  const tidy=l=>{const m={};for(let x of l){if(!x||typeof x.d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.d)||typeof x.n!=='string')continue;x={d:x.d,n:setStr(x.n,120).trim()};
    if(x.d>=from&&x.d<=to&&x.n)m[x.d]=m[x.d]&&!m[x.d].includes(x.n)?m[x.d]+', '+x.n:m[x.d]||x.n}return Object.entries(m).sort().map(([d,n])=>({d,n}))};
  const own=()=>{const l=builtinHolidays(cc,from,to);return l&&l.length?tidy(l):null};
  // (a country with its own list isn't in Nager.Date: not asked, which logged a 404 on every start)
  // every calendar year the window touches (fix round 2, N6): in December and January it spans three, and asking only the first and last
  // left out the whole coming year (Sydney planned an outfit on New Year's Day)
  if(!HOL_FIXED[cc]&&!HOL_HIJRI[cc])try{const out=[];for(const y of holYears(from,to)){const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`);if(r.status!==200)continue;
      out.push(...nagerKeep(await r.json(),cc))}
    if(out.length)return tidy(out)}catch(e){/* unreachable or unknown country: try the worker */}
  const W=workerBase();if(!W){const l=own();if(l)return l;throw new Error(`No holiday list for ${countryName(cc)} until the app is connected: paste your invite link under Connection.`)}
  let r;try{r=await fetch(new URL('holidays',W.url).href+'?country='+cc,{headers:{'x-app-token':W.tok},cache:'no-store'})}catch{const l=own();if(l)return l;throw new Error('Couldn’t reach the server for the holiday list.')}
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!(j.holidays||[]).length){const l=own();if(l)return l}
  if(!r.ok)throw new Error(j.holidaysError||(r.status===404||r.status===405?'The server doesn’t have holiday lists yet: it needs an update.':j.error||`HTTP ${r.status}`));
  return tidy((j.holidays||[]).map(h=>({d:h.date,n:h.name})))}
/* the holidays already past, kept for good (fix round 3, W1-8-01: the monthly refresh replaced the list with one starting a month back,
   and every older holiday turned into a workday "you didn't open the app", counted as worn, toward cleaning and Insights): they were days
   off when they came, so they stay days off whatever list or country comes next; Settings lists only the coming ones */
function holPast(){const h=settings.holidays,T=isoKey(trueToday());/* (the corrected date: core.js) */if(!h)return {list:[],skip:[]};
  const list=(h.list||[]).filter(x=>x&&x.d<T);return {list,skip:(h.skip||[]).filter(d=>d<T&&list.some(x=>x.d===d))}}
async function setHolidayCountry(cc,quiet){
  // "No public holidays": none from now on; the past ones stay (country '': nothing is fetched)
  if(!cc){const past=holPast();settings.holidays=past.list.length?{country:'',list:past.list,skip:past.skip,fetched:0}:null;holidayMsg='';await saveUserSettings();todayDirty();renderDaysOffUI();return}
  if(!quiet){holidayMsg=`Loading the public holidays of ${countryName(cc)}…`;
    // (fix round 2) the country is kept the moment it is picked, with no list yet (fetched 0: the next start fetches it, refreshHolidays):
    // swiped away before the list arrived, the choice was lost
    if(!(settings.holidays&&settings.holidays.country===cc)){settings.holidays={country:cc,...holPast(),fetched:0};saveUserSettings();todayDirty()}
    renderDaysOffUI()}
  try{const got=await fetchHolidays(cc),old=settings.holidays&&settings.holidays.country===cc?settings.holidays.skip||[]:[];
    // past holidays stay (holPast): the fetched list starts a month back, and a holiday that dropped out of it became a workday after the
    // fact, recorded as worn (fix round 3, W1-8-01)
    const past=holPast(),list=[...past.list.filter(x=>!got.some(y=>y.d===x.d)),...got].sort((a,b)=>a.d<b.d?-1:1);
    settings.holidays={country:cc,list,skip:[...new Set([...past.skip,...old])].filter(d=>list.some(x=>x.d===d)).sort(),fetched:nowMs()};
    holidayMsg=list.length?'':`No public holidays found for ${countryName(cc)}.`;await saveUserSettings();todayDirty()}
  catch(e){if(quiet)return;
    // (audit 2026-11-15) the country picked is the one that counts, even without a list: the old country's holidays went on counting under
    // a "that country" message; tried again at the next start (fetched 0, refreshHolidays)
    if(!(settings.holidays&&settings.holidays.country===cc&&(settings.holidays.list||[]).length)){settings.holidays={country:cc,...holPast(),fetched:0};await saveUserSettings();todayDirty()}
    const m=e.message||'couldn’t load the holiday list.';holidayMsg=`${countryName(cc)}: ${m}${/days off/.test(m)?'':' Add its holidays as your own days off below if you need them.'}`}
  renderDaysOffUI()}
/* the list goes stale (new year, tentative dates confirmed): fetched again once a month, keeping the days you unticked */
/* the monthly refetch saves the settings with a new stamp, and the newest settings win a sync: on a device that had been away
   for a while, stamping its old settings would undo a change made on another device since. So it syncs first, and refetches
   only if the settings it then has still need it (another device may have done it already). Offline: not this time. */
/* by the corrected time (core.js nowMs), and a list fetched "in the future" (the clock was ahead that day, the audit's W1-9-04) is due */
async function refreshHolidays(){const due=()=>{const h=settings.holidays,f=h&&+h.fetched||0;return !!(h&&h.country&&(nowMs()-f>30*864e5||f>nowMs()+864e5))};
  if(!due())return;
  if(typeof syncUrl==='function'&&syncUrl()&&localStorage.getItem('app_token')){
    if(!await syncNow())return;
    const st=await metaGet('settings');if(st)setWardrobe({settings:takeSettings(settings,st)});if(!due())return}
  return setHolidayCountry(settings.holidays.country,true)}
/* testers have daily limits instead of costs: no "about 7¢" for them (account.js knows who is connected) */
const showCost=()=>!(typeof isTester==='function'&&isTester());
async function toggleHoliday(d,on){const h=settings.holidays;if(!h)return;const skip=new Set(h.skip||[]);on?skip.delete(d):skip.add(d);
  settings.holidays={...h,skip:[...skip].sort()};await saveUserSettings();todayDirty();renderDaysOffUI()}
const isoToDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return new Date(y,m-1,d)};
/* a day off's name is at most OFF_NAME_MAX letters (W2-12-02: a pasted 57-letter link pushed its chip's × off the screen, and nothing limited it) */
const OFF_NAME_MAX=40,offNameCut=n=>{n=String(n||'').replace(/\s+/g,' ').trim();return [...n].length>OFF_NAME_MAX?[...n].slice(0,OFF_NAME_MAX-1).join('').trim()+'…':n};
async function addDayOff(){const f=($('#cfg-off-from')||{}).value,t=($('#cfg-off-to')||{}).value||f,n=offNameCut(($('#cfg-off-name')||{}).value);
  const say=m=>{holidayMsg=m;renderDaysOffUI()};if(!f)return say('Pick a date first.');
  const a=isoToDate(f),b=isoToDate(t),T=todayDate();if(b<a)return say('The last day is before the first.');if((b-a)/864e5>92)return say('That is more than three months: add it in parts.');
  // a typed date isn't held back by the field's min (audit 2026-11-15: "1 day off added." for a past day that never showed)
  if(b<T)return say(`${yearDate(b)} has passed: only days from today on can be added.`);
  const cur=new Map((settings.daysOff||[]).map(x=>[x.d,x]));let k=0;for(const d=new Date(a<T?T:a);d<=b;d.setDate(d.getDate()+1)){cur.set(isoKey(d),{d:isoKey(d),n:n||'Day off'});k++}
  settings.daysOff=[...cur.values()].sort((x,y)=>x.d<y.d?-1:1);holidayMsg=`${k} day${k===1?'':'s'} off added.`;
  for(const id of ['#cfg-off-from','#cfg-off-to','#cfg-off-name'])if($(id))$(id).value='';
  await saveUserSettings();todayDirty();renderDaysOffUI()}
/* a holiday's checkbox and a day off's × carry their dates in data-* attributes, read by one listener on each list (fix round A, CR-7-02:
   a date from a Restore file, a sync or a holiday list went into an inline handler and ran as script) */
function daysOffListen(list,ol){
  if(!list.dataset.on){list.dataset.on='1';list.addEventListener('change',e=>{const c=e.target.closest('input[data-d]');if(c&&list.contains(c))toggleHoliday(c.dataset.d,c.checked)})}
  if(ol&&!ol.dataset.on){ol.dataset.on='1';ol.addEventListener('click',e=>{const b=e.target.closest('button[data-ds]');if(b&&ol.contains(b))removeDaysOff(b.dataset.ds)})}}
function renderDaysOffUI(){const box=$('#cfg-country'),list=$('#holiday-list');if(!box||!list)return;daysOffListen(list,$('#off-list'));
  const h=settings.holidays,cc=h&&h.country||'';
  if(box.options.length<2)box.innerHTML='<option value="">No public holidays</option>'+COUNTRY_CODES.map(c=>[countryName(c),c]).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`<option value="${c}">${esc(n)}</option>`).join('');
  box.value=cc;
  const tk=isoKey(todayDate()),skip=new Set(h&&h.skip||[]),up=(h&&h.list||[]).filter(x=>x.d>=tk);
  list.innerHTML=!cc||/^Loading /.test(holidayMsg)?'':up.length?up.map(x=>{const d=isoToDate(x.d),wk=!settings.workdays.includes(d.getDay());
    return `<label class="hrow${wk?' wk':''}"><input type="checkbox" ${skip.has(x.d)?'':'checked'} data-d="${esc(x.d)}"><span class="hd">${yearDate(d)}</span><span class="hn">${esc(x.n)}${wk?' <small class="mut">(not a workday anyway)</small>':''}</span></label>`}).join('')
    :h&&!h.fetched?`<small class="mut">${workerBase()?`No public holiday list for ${esc(countryName(cc))} yet: the app tries again at its next start.`:`The public holidays of ${esc(countryName(cc))} are loaded once the app is connected.`}</small>`   // (setup.js setupHolidays)
    :'<small class="mut">No public holidays in the next year.</small>';
  const own=(settings.daysOff||[]).filter(x=>x.d>=tk),ol=$('#off-list');
  // consecutive days with one name are shown as one range
  const runs=[];for(const x of own){const r=runs[runs.length-1];if(r&&r.n===x.n&&(isoToDate(x.d)-isoToDate(r.to))/864e5<=1.5)r.to=x.d,r.ds.push(x.d);else runs.push({from:x.d,to:x.d,n:x.n,ds:[x.d]})}
  if(ol)ol.innerHTML=runs.map(r=>{const l=r.from===r.to?yearDate(isoToDate(r.from)):`${yearDate(isoToDate(r.from))} – ${yearDate(isoToDate(r.to))}`;
    return `<span class="fchip"><span class="fcht">${l}${r.n&&r.n!=='Day off'?' · '+nameHtml(offNameCut(r.n)):''}</span><button type="button" aria-label="Remove ${l}" data-ds="${esc(r.ds.join(','))}">×</button></span>`}).join('');
  const m=$('#holiday-msg');if(m)m.textContent=holidayMsg||(cc&&up.length?`${up.filter(x=>!skip.has(x.d)).length} public holiday${up.length===1?'':'s'} of ${countryName(cc)} count as days off. Uncheck any you work.`:'');
  const f=$('#cfg-off-from');if(f)f.min=tk;
  if(settingsOpen())settingsSummaries()}   // the Days off summary follows an added or removed day (it kept the old count, audit 2026-11-13)
async function removeDaysOff(csv){const ds=new Set(csv.split(','));settings.daysOff=(settings.daysOff||[]).filter(x=>!ds.has(x.d));holidayMsg='';await saveUserSettings();todayDirty();renderDaysOffUI()}
/* ---- Settings: formal days (any upcoming workday) ---- */
const shortDate=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
/* with the year when it isn't this year's (the holiday list showed two "Thu, Nov 26 Thanksgiving Day" a year apart) */
const yearDate=d=>d.getFullYear()===todayDate().getFullYear()?shortDate(d):d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderFormalUI(msg){const list=$('#formal-list'),inp=$('#cfg-formal-date');if(!list)return;
  const T=todayDate();if(inp){inp.min=isoDate(T);if(!inp.value)inp.value=isoDate(nextWorkday(T)||T)}
  const up=Object.values(dayRecs).filter(r=>occOf(r)&&keyDate(r.date)>=T).sort((a,b)=>keyDate(a.date)-keyDate(b.date));
  list.innerHTML=up.length?up.map(r=>{const l=shortDate(keyDate(r.date));return `<span class="fchip">${l} · ${occLabel(occOf(r))}<button type="button" aria-label="Make ${l} a regular day" onclick="setOccasion(null,'${r.date}')">×</button></span>`}).join(''):'<small class="mut">No occasions coming up.</small>';
  const pick=$('#cfg-occasion');if(pick&&!pick.options.length)pick.innerHTML=OCCASIONS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  if(msg!==undefined&&$('#formal-msg'))$('#formal-msg').textContent=msg;
  if(settingsOpen())settingsSummaries()}
async function addFormalDay(){const v=($('#cfg-formal-date')||{}).value;if(!v)return renderFormalUI('Pick a date first.');
  const [y,m,dd]=v.split('-').map(Number),d=new Date(y,m-1,dd),k=key(d),l=shortDate(d);
  if(d<todayDate())return renderFormalUI(`${l} has passed.`);
  const o=monthPlan(y,m-1)[k];if(!o)return renderFormalUI(`${l} is a day off, so there's no outfit to change.`);
  if(o.frozen)return renderFormalUI(`${l} is already locked in.`);
  const occ=($('#cfg-occasion')||{}).value||'formal',O=OCCASIONS.find(x=>x[0]===occ)||OCCASIONS[0],what=occ==='casual'?'a day without a jacket or tie':`${aAn(O[1].toLowerCase())} day`;
  if(o.occasion===occ)return renderFormalUI(`${l} is already ${what}.`);
  await setOccasion(occ,k);renderFormalUI(`${l} is now ${what}: ${O[2]}.`)}
/* the parts of Settings drawn by later scripts (Round B, CR-7-11: account.js and remind.js replaced renderSettingsExtras with a wrapper
   at load, so a reader of this file couldn't see that every redraw also draws the account box, asks /me and draws the reminder):
   each registers once with settingsPart(fn), and renderSettingsExtras runs them last, in the order they registered (script order) */
const SETTINGS_PARTS=[];
function settingsPart(fn){if(!SETTINGS_PARTS.includes(fn))SETTINGS_PARTS.push(fn)}
function renderSettingsExtras(){
  if(typeof renderDressUI==='function')renderDressUI();renderItemPicUI();renderFormalUI();renderReplanUI();renderDaysOffUI();renderCustomUI();if(typeof renderOwnMatUI==='function')renderOwnMatUI();if(typeof renderConnUI==='function')renderConnUI();
  renderPicturesUI();if(typeof renderAsmUI==='function'){renderAsmUI();if(asmLive())asmSync()}
  if(typeof renderCareUI==='function')renderCareUI();
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" onclick="toggleDay('${id}',${i})" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  renderWxLoc();
  if($('#cfg-units'))$('#cfg-units').value=unit();
  if($('#cfg-vest'))$('#cfg-vest').value=settings.vestMode||'auto';if($('#cfg-dark'))$('#cfg-dark').value=settings.darkShirts||'some';
  settingsSummaries();
  for(const part of SETTINGS_PARTS)part();   // account.js acctSettingsPart, remind.js renderRemindUI
}
/* the weather location's line, its temperatures in the units chosen (setUnits redraws it: it kept °F under a °C setting) */
function renderWxLoc(){
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}.`+(climate?` Beyond the 16-day forecast, days are planned from the usual weather there: highs of about ${temp(Math.min(...climate.map(m=>m.tmax)))}° in the coolest month and ${temp(Math.max(...climate.map(m=>m.tmax)))}° in the hottest.`:' Beyond the 16-day forecast, days follow the calendar season.'):'No location set: outfits follow the calendar season.'}
/* ---- Settings → Outfit pictures: "Painted pictures" (the default) or "Drawing only" (photos.js picsDrawn; settings.pictures, synced).
   For everyone, at the top of the category, not in the Advanced fold; drawn here rather than in index.html, like the other rows made
   from the settings. The line under it says what the choice does ---- */
const PICS_HELP={painted:'Painted pictures: the outfit is painted in its own cloth, on this device or ready-made from the server.',
  drawn:'Drawing only: the outfit is drawn, nothing is downloaded or painted; faster and uses less data.'};
function renderPicturesUI(){const pan=$('#sp-photos .mpanel-in');if(!pan)return;let g=$('#pics-box');
  if(!g){g=document.createElement('div');g.id='pics-box';g.className='sgroup pics-box';pan.insertBefore(g,pan.firstChild)}
  const v=picsDrawn()?'drawn':'painted';
  g.innerHTML=`<div class="slabel">Today’s outfit</div><p class="shelp" id="pics-help">${PICS_HELP[v]}</p>
<label class="srow">Show <select id="cfg-pictures" onchange="setPictures(this.value)" aria-label="Today’s outfit" aria-describedby="pics-help"><option value="painted">Painted pictures</option><option value="drawn">Drawing only</option></select></label>`;
  $('#cfg-pictures').value=v}
async function setPictures(v){const d=v==='drawn';if(d===picsDrawn())return;settings.pictures=d?'drawn':'painted';await saveUserSettings();picsSwitched();
  renderPicturesUI();if(typeof renderAsmUI==='function')renderAsmUI();settingsSummaries()}
/* the choice changed (here, or on another device: start.js onSyncedData): Today is drawn again (once Settings closes, refreshToday), and
   back on "Painted pictures" the day on screen is painted or downloaded at once, while Settings is still open, and building ahead resumes
   from asmEnsure; on "Drawing only" building ahead stops at its next look (asmAhead's stop) */
function picsSwitched(){refreshToday();if(picsDrawn()||!asmLive())return;
  asmSync();const o=planFor()[key(sel)];if(o&&hasOutfit(o))asmEnsure(o);schedulePrefetch()}
/* (vest, workdays, blazer days and units are drawn on Today too: todayStale redraws it when Settings closes; it stayed stale until a restart, audit 2026-11-14) */
function setVestMode(v){settings.vestMode=v;saveUserSettings();todayDirty();settingsSummaries()}
/* how often dark shirts are planned (planner.js, darkMode): the coming week is planned again with the new choice */
/* (fix round 2) saved before the week's locks are released, as setDress (dress.js): tapped then swiped away within ~100 ms, the change was lost */
async function setDarkShirts(v){settings.darkShirts=v;todayDirty();settingsSummaries();await saveUserSettings();await clearLocks()}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0){tell('At least one workday is needed: pick another day first.');return}settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  planDirty();todayDirty();renderSettingsExtras();return saveUserSettings().then(clearLocks)}
function setUnits(v){settings.units=v;saveUserSettings();todayDirty();renderWxLoc();settingsSummaries()}
function setLocation(loc){const fromList=!!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#city-results'));if(loc&&loc.alt!==undefined){loc={...loc};delete loc.alt}settings.location=loc;localStorage.removeItem('wx');localStorage.removeItem('wx_norm');weather={};climate=null;saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML='';if(loc)announce('Location set to '+loc.name);if(fromList&&$('#cfg-city'))try{$('#cfg-city').focus({preventScroll:true})}catch{}}   // (the result pressed is gone: the field keeps the keyboard)
function useMyLocation(){if(!navigator.geolocation){tell('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(p=>setLocation({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:geoName(p.coords.latitude,p.coords.longitude)}),()=>tell('Location permission was denied. Search for your city instead.'))}
/* "Use my location" has no place name (Open-Meteo can't look one up): the spot itself, so it doesn't read "your current location" after a trip */
const geoName=(la,lo)=>`your location (${Math.abs(la).toFixed(2)}° ${la<0?'S':'N'}, ${Math.abs(lo).toFixed(2)}° ${lo<0?'W':'E'})`;
/* the language the city search asks in: a name typed in Arabic (or another script) is looked up in that language, English otherwise */
function cityLang(q){const s=[[/[؀-ۿ]/,'ar'],[/[֐-׿]/,'he'],[/[Ѐ-ӿ]/,'ru'],[/[Ͱ-Ͽ]/,'el'],[/[฀-๿]/,'th'],[/[가-힯]/,'ko'],[/[぀-ヿ]/,'ja'],[/[一-鿿]/,/^ja/i.test(navigator.language||'')?'ja':'zh']].find(([r])=>r.test(q));return s?s[1]:'en'}
/* results that read the same ("Dubai, Uttar Pradesh, IN" three times) get their district, and true repeats are dropped */
function cityList(results){const res=(results||[]).map(c=>({lat:c.latitude,lon:c.longitude,cc:c.country_code||'',name:[c.name,c.admin1,c.country_code].filter(Boolean).join(', '),a2:c.admin2||c.admin3||'',...(c.alt?{alt:c.alt}:{})}));
  const cnt={};for(const c of res)cnt[c.name]=(cnt[c.name]||0)+1;for(const c of res)if(cnt[c.name]>1&&c.a2)c.name=[c.name.split(', ')[0],c.a2,...c.name.split(', ').slice(1)].join(', ');
  const seen=new Set();return res.filter(c=>{const k=c.name;if(seen.has(k))return false;seen.add(k);return true}).map(c=>{delete c.a2;return c})}
/* (fix round 2) a name found in another language is stored in English, the app's language (an Arabic search stored "دبي, دبي, AE" and the
   English summary showed it): each result is asked again by its id in English, the name typed shown beside it; a failed lookup keeps it */
async function cityEnglish(list,lang){if(lang==='en')return list;
  return Promise.all(list.map(async c=>{if(!c||c.id==null)return c;
    try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/get?language=en&id='+encodeURIComponent(c.id));if(r.ok){const e=await r.json();if(e&&e.name)return {...e,alt:e.name!==c.name?c.name:''}}}catch{}
    return c}))}
async function findCity(){const q=($('#cfg-city')&&$('#cfg-city').value||'').trim();
  // an empty search clears the last one's results (they stayed, fix round 2)
  if(!q){window._cities=[];if($('#city-results'))$('#city-results').innerHTML='';return}
  try{const lang=cityLang(q),r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language='+lang+'&name='+encodeURIComponent(q));const j=await r.json();
    const res=cityList(await cityEnglish((j.results||[]).slice(0,8),lang)).slice(0,5);
    window._cities=res;$('#city-results').innerHTML=res.length?res.map((c,i)=>`<button type="button" onclick="setLocation(_cities[${i}])">${esc(c.name)}${c.alt?` <span dir="auto">(${esc(c.alt)})</span>`:''}</button>`).join(''):'<small class="mut" id="city-none">No matches. Try the name in English or a nearby larger city, or Use my location.</small>';
    announce(res.length?`${res.length} place${res.length===1?'':'s'} found`:'No matches.')}   // (said: W2-19-01)
  catch(e){$('#city-results').innerHTML='<small class="mut">City search is unavailable right now.</small>';announce('City search is unavailable right now.')}}
/* 16-day forecast from Open-Meteo (free, no key); cached for 3 hours */
/* header ↻: sync with the worker (if set up), reload everything from storage, refresh the forecast and redraw */
let toastTimer=null;
const TOAST_ACT_MS=8000;   // a toast with Undo stays at least this long (audit 2026-11-14: gone after 5 s, and Delete has no question)
/* on the Wardrobe, where the + is, an Undo is a round button above it, a glowing ring running down its seconds, instead of the toast
   (2026-11-17, the owner's pick "A with the glowing countdown", no line saying what it undoes): its words are read out (announce) and
   are its label ("Undo: Deleted …"); another Undo replaces it; it goes with the toast's rules (toastDrop, the keyboard on it keeps it up) */
let undoTimer=null;
const undoHere=()=>{const w=$('#wardrobe'),m=document.querySelector('main');return !!w&&!w.hidden&&!(m&&m.inert)&&!(typeof editing!=='undefined'&&editing)&&!!$('#undo-fab')};   // (not while the item sheet is open: an Undo made there is the toast over it)
function undoFab(t,ms,act){const b=$('#undo-fab'),e=$('#toast');if(e&&e.classList.contains('act')){clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent=''}
  if(typeof announce==='function')announce(t+'. Undo is above the add button.');
  b.setAttribute('aria-label','Undo: '+t);b.tabIndex=0;b.style.setProperty('--ud',ms+'ms');b.classList.remove('on');void b.offsetWidth;b.classList.add('on');
  b.onclick=()=>{undoOff(true);act.fn()};clearTimeout(undoTimer);undoTimer=setTimeout(function off(){if(b.contains(document.activeElement)){undoTimer=setTimeout(off,1500);return}undoOff()},ms)}
function undoOff(now){const b=$('#undo-fab');if(!b)return;clearTimeout(undoTimer);if(document.activeElement===b)b.blur();b.classList.remove('on');b.tabIndex=-1;b.onclick=null}
function toast(t,ms=2500,act){if(act&&act.label==='Undo'&&undoHere())return undoFab(t,Math.max(ms,TOAST_ACT_MS),act);
  const e=$('#toast');if(!e)return;e.textContent=t;e.classList.toggle('act',!!act);if(act)ms=Math.max(ms,TOAST_ACT_MS);
  if(act){const b=document.createElement('button');b.type='button';b.textContent=act.label;b.onclick=()=>{clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent='';act.fn()};e.append(' ',b)}
  e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastOff(e),ms)}
/* a toast gone is gone for everyone (fix round 3, W2-19-06: faded to opacity 0, its words and its Undo stayed in the Tab order and
   for VoiceOver, and the invisible Undo still worked 10 s later): once it has faded (styles.css also hides it, visibility) its words and
   button are taken out. While the keyboard is on its button it stays up (2.2.1: time to reach it), going once the focus leaves. */
function toastOff(e){if(e.contains(document.activeElement)&&e.querySelector('button')){toastTimer=setTimeout(()=>toastOff(e),1500);return}
  e.classList.remove('on','act');setTimeout(()=>{if(!e.classList.contains('on'))e.textContent=''},250)}
/* a toast with a button (Undo) taken away at once (start.js show(): leaving Add takes its "Saved … Undo" with it) */
function toastDrop(){undoOff();const e=$('#toast');if(!e||!e.classList.contains('act'))return;clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent=''}
/* the location's usual weather by month, from Open-Meteo's archive (free, no key): the last two full years' daily highs,
   lows and rain, averaged per month. Kept for four months per location; days beyond the 16-day forecast are planned from it. */
async function loadClimate(){
  const L=settings.location;if(!L){climate=null;return}
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');
    if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months)){const fresh=Date.now()-c.t<120*864e5;if(JSON.stringify(climate)!==JSON.stringify(c.months)){climate=c.months;planDirty();if(!$('#today').hidden)refreshToday()}if(fresh)return}}catch{}
  try{const y=new Date().getFullYear(),r=await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${L.lat}&longitude=${L.lon}&start_date=${y-2}-01-01&end_date=${y-1}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
    const d=r.ok&&(await r.json()).daily;if(!d||!d.time||!d.temperature_2m_max)return;
    const m=[...Array(12)].map(()=>({n:0,tx:0,tn:0,r:0}));
    d.time.forEach((t,i)=>{const k=+t.slice(5,7)-1,tx=d.temperature_2m_max[i];if(!(k>=0&&k<12)||typeof tx!=='number')return;m[k].n++;m[k].tx+=tx;m[k].tn+=d.temperature_2m_min?.[i]??tx;if((d.precipitation_sum?.[i]||0)>=1)m[k].r++});
    if(m.some(x=>x.n<20))return;   // a month with hardly any readings: keep what we had
    const months=m.map(x=>({tmax:+(x.tx/x.n).toFixed(1),tmin:+(x.tn/x.n).toFixed(1),rainDays:+(x.r/x.n*30).toFixed(1)}));
    const N=settings.location;if(!N||N.lat!==L.lat||N.lon!==L.lon)return;   // the location changed meanwhile
    climate=months;localStorage.setItem('wx_norm',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),months}));planDirty();if(!$('#today').hidden)refreshToday();if(settingsOpen())renderSettingsExtras()}
  catch(e){console.warn('climate history unavailable',e)}
}
async function loadWeather(force){
  const L=settings.location;if(!L)return;loadClimate();
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');
    if(!force&&c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3){if(JSON.stringify(weather)===JSON.stringify(c.days))return;   // already read (wxPreload): the plan stands
      weather=c.days;planDirty();if(!$('#today').hidden)refreshToday();return}}catch{}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone=auto&forecast_days=16`);
    const d=(await r.json()).daily;if(!d||!d.time)return;const days={};
    d.time.forEach((t,i)=>{const [y,m,dd]=t.split('-').map(Number);days[key(new Date(y,m-1,dd))]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],pop:d.precipitation_probability_max[i]??0,rain:d.precipitation_sum[i]??0,code:d.weather_code[i]??0}});
    weather=days;localStorage.setItem('wx',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),days}));planDirty();if(!$('#today').hidden)refreshToday()}
  catch(e){console.warn('weather unavailable',e)}
}

/* ---- theme: Auto (follow the device) → Light → Dark; saved per device ---- */
const THEMES={auto:['◐','automatic'],light:['☀︎','light'],dark:['☾','dark']};
function applyTheme(t){
  if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else{delete document.documentElement.dataset.theme;t='auto'}
  const b=$('#theme-btn');if(b){b.textContent=THEMES[t][0];b.setAttribute('aria-label','Theme: '+THEMES[t][1]);b.title='Theme: '+THEMES[t][1]+' (tap to change)'}
  if(window.appReady&&$('#today')&&!$('#today').hidden&&$('.fig'))renderToday();   // the figure fades into the page colour
}
/* the first tap always changes what is on screen: from automatic to the theme the phone is not showing, then the other, then automatic again;
   each tap says where it is (fix round 3, W2-14-13: on a light phone the first tap chose "light", nothing changed and nothing said so) */
function cycleTheme(){
  let cur='auto';try{cur=localStorage.getItem('theme')||'auto'}catch{}
  let dev='light';try{if(matchMedia('(prefers-color-scheme: dark)').matches)dev='dark'}catch{}
  const opp=dev==='dark'?'light':'dark',next=cur==='auto'?opp:cur===opp?dev:'auto';
  try{next==='auto'?localStorage.removeItem('theme'):localStorage.setItem('theme',next)}catch{}
  applyTheme(next);
  toast(next==='auto'?`The theme follows the phone again (${dev} now).`:`${cap1(next)} theme. Tap again for ${next===opp?dev:'the phone’s own'}.`,3500)
}
try{applyTheme(localStorage.getItem('theme')||'auto')}catch{applyTheme('auto')}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(window.appReady&&!$('#today').hidden&&$('.fig'))renderToday()})}catch{}
