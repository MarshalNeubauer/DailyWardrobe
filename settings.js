/* Daily Wardrobe: Settings: the page and its categories, schedule, days off, formal days, weather, toasts, refresh and the theme
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* settings management */
/* Settings: a full-screen page of categories that unfold like Today's cards; openSettings('weather') opens one directly */
const SET_CATS=['schedule','daysoff','weather','care','photos','tagging','backup','connection','about'];
function setCatOpen(key,open,instant){const el=$('#sc-'+key);if(!el)return;el.classList.toggle('instant',!!instant);if(!instant){el.classList.remove('instant');void el.offsetHeight}
  el.classList.toggle('open',open);const b=el.querySelector('.scat-head');if(b)b.setAttribute('aria-expanded',open)}
function toggleCat(key){const el=$('#sc-'+key);if(!el)return;const open=!el.classList.contains('open');setCatOpen(key,open);settingsSummaries();const t0=Date.now();
  // the scroll to show what opened gives way to a finger or wheel that moved since the tap: on an iPhone it fought a scroll already under way
  if(open)setTimeout(()=>{const m=$('#settings-modal');if((m._touch||0)>t0)return;const r=el.getBoundingClientRect(),top=m.querySelector('.shead').getBoundingClientRect().bottom;
    const over=r.top+Math.min(el.scrollHeight,m.clientHeight-80)-m.clientHeight;if(over>0)m.scrollBy({top:Math.min(over+16,r.top-top-8),behavior:'smooth'})},460)}
/* the Backup line in Settings says what really happened: the last backup's time, or that the last try failed (sync.js keeps
   sync_status while a try fails and last_sync when one works) */
function backupSummary(w){if(!w)return 'Not backed up yet: needs a connection';
  const last=+localStorage.getItem('last_sync')||0,st=localStorage.getItem('sync_status')||'',when=t=>{const d=new Date(t),days=Math.round((todayDate()-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
    return days<=0?'today':days===1?'yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
  if(/failed/i.test(st))return last?`Last backup failed · last saved ${when(last)}`:'Backup failed: not backed up yet';
  return last?`Backed up ${when(last)}`:'Not backed up yet'}
function settingsSummaries(){const set=(k,t)=>{const e=$('#sum-'+k);if(e)e.textContent=t};if(typeof applyRole==='function')applyRole();if(typeof remindSoon==='function')remindSoon();
  // the days from the week's first one: the first day (Sunday first) whose day before isn't one of them, so Sun–Thu reads "Sun–Thu"
  // (sorted from Monday it read "Mon, Tue, Wed, Thu, Sun", audit 2026-11-13)
  const days=l=>{const has=new Set(l),s0=[0,1,2,3,4,5,6].find(d=>has.has(d)&&!has.has((d+6)%7))||0,s=[...has].sort((a,b)=>((a-s0+7)%7)-((b-s0+7)%7)),n=i=>DAY_NAMES[i].slice(0,3);if(!s.length)return 'none';
    const run=s.length>2&&s.every((d,i)=>!i||(s[i-1]+1)%7===d);return run?`${n(s[0])}–${n(s[s.length-1])}`:s.map(n).join(', ')};
  const bl=settings.blazerDays.filter(d=>settings.workdays.includes(d));
  set('schedule',`${days(settings.workdays)} · ${typeof dressSummary==='function'&&dressSummary()||`${bl.length?'blazers '+days(bl):'suits every day'} · vest ${({auto:'on cooler suit days',always:'every suit day',never:'never'})[settings.vestMode||'auto']}`}`);
  const T=isoKey(todayDate()),h=settings.holidays,offs=(settings.daysOff||[]).filter(x=>x.d>=T).length,occ=Object.values(dayRecs).filter(r=>r.date&&keyDate(r.date)>=todayDate()&&occOf(r)).length;
  set('daysoff',[h&&h.country?`${h.country} holidays`:'No holidays',`${offs} day${offs===1?'':'s'} off`,`${occ} occasion${occ===1?'':'s'}`].join(' · '));
  set('weather',`${settings.location?settings.location.name:'No location set'} · °${unit()}`);
  set('photos',typeof isConnected==='function'&&!isConnected()?'Needs a connection':'This day’s photo, and item pictures');
  const own=Object.keys((settings.custom&&settings.custom.colors)||{}).length+Object.keys((settings.custom&&settings.custom.patterns)||{}).length;
  set('tagging',`${own?own+' colour'+(own===1?'':'s')+' & patterns of your own':'Your own colours & patterns'}`);
  const w=localStorage.getItem('worker_url');let host='';try{host=w?new URL(w).host:''}catch{}
  set('backup',backupSummary(w));set('connection',typeof connSummary==='function'?connSummary():host||'Not connected')}
function openSettings(section){
  const cat=section==='wx'?'weather':section;
  for(const k of SET_CATS)setCatOpen(k,k===cat,true);
  if(typeof advClose==='function')advClose();   // the Advanced folds start closed every time
  if(cat)setTimeout(()=>{const el=$('#sc-'+cat),m=$('#settings-modal');if(el&&m)m.scrollTop=el.offsetTop-m.querySelector('.shead').offsetHeight-8},0);else if($('#settings-modal'))$('#settings-modal').scrollTop=0;
  // storage that is blocked (localStorage throws) or broken must not keep Settings shut: it opens with what could be drawn (audit 2026-11-13)
  try{if($('#cfg-url')) $('#cfg-url').value=localStorage.getItem('worker_url')||'';
    if($('#cfg-token')) $('#cfg-token').value=localStorage.getItem('app_token')||''}catch(e){console.warn('connection not read',e)}
  try{if(window.showSyncStatus)showSyncStatus()}catch(e){console.warn('backup line not drawn',e)}
  try{renderSettingsExtras()}catch(e){console.warn('Settings drawn in part',e)}
  try{settingsSummaries();if(queuedKeys().length)checkQueue()}catch(e){console.warn('Settings summaries not drawn',e)}
  if($('#settings-modal')){ $('#settings-modal').style.display='block'; $('#settings-modal').style.pointerEvents='auto'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='block'; $('#modal-backdrop').style.pointerEvents='auto'; }
  setLock(true);appPush('set');   // the phone's Back closes it (appPush, by show())
  if(typeof layerOpen==='function')layerOpen($('#settings-modal'));   // the page behind is inert, the focus moves in (ui.js)
}
/* while Settings is up the page behind it can't scroll (html.set-lock): on an iPhone a scroll in Settings near its top or bottom was handed
   to Today underneath, and Settings stood still under the finger until that scroll ended; also notes the last touch for toggleCat */
function setLock(on){document.documentElement.classList.toggle('set-lock',on);const m=$('#settings-modal');
  if(on&&m&&!m._tw){m._tw=true;const mark=()=>{m._touch=Date.now()};m.addEventListener('touchstart',mark,{passive:true});m.addEventListener('wheel',mark,{passive:true})}}
let todayStale=false;   // a change made in Settings that Today should show once Settings closes
let viewStale=null;   // the Wardrobe or stats page, when a sync brought changes while Settings was open (syncRedraw): redrawn once it closes
const settingsOpen=()=>!!$('#settings-modal')&&$('#settings-modal').style.display==='block';
/* a redraw from work done in the background (photos arriving, the weather, the plan rules check at start-up): while Settings is open
   it waits for Settings to close (todayStale), since drawing Today closes Settings, which snapped shut when opened right after launch */
function refreshToday(){if(settingsOpen()){todayStale=true;return}renderToday()}
function closeSettings(){const was=settingsOpen();
  if($('#settings-modal')){ $('#settings-modal').style.display='none'; $('#settings-modal').style.pointerEvents='none'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='none'; $('#modal-backdrop').style.pointerEvents='none'; }
  setLock(false);appDrop('set');   // closed by Done or anything else: its Back entry goes
  if(was&&typeof layerClose==='function')layerClose($('#settings-modal'));
  if(todayStale){todayStale=false;renderToday()}
  if(viewStale){const v=viewStale;viewStale=null;if(!$('#'+v).hidden)show(v)}
}
function saveSettings(){
  // full or blocked storage: Done still closes Settings (it threw before closing), and says the connection wasn't kept
  try{if($('#cfg-url')) localStorage.setItem('worker_url',$('#cfg-url').value.trim());
    if($('#cfg-token')) localStorage.setItem('app_token',$('#cfg-token').value.trim())}
  catch(e){console.warn('connection not saved',e);setTimeout(()=>toast('Couldn’t save the server address: this browser’s storage is full or blocked.',5000),0)}
  closeSettings();
  try{renderAdd()}catch(e){console.warn('Add page not drawn',e)}
  if(window.syncNow)syncNow().catch(e=>console.warn('sync not started',e));
}


/* ---- settings: schedule, weather location, units ---- */
const unit=()=>settings.units||(/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C');
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
async function saveUserSettings(){settings.updated=Date.now();cache={};   // the settings have changed already: the cached plan is stale now, not only once they are stored
  await metaPut('settings',settings);cache={};if(window.scheduleSync)scheduleSync()}
/* ---- Settings: days off. A country's public holidays (each can be unticked if you work that day) and your own days
   off (a single day or a range, e.g. a holiday trip). They are planned like weekends: no outfit, nothing counted as worn. ---- */
const COUNTRY_CODES='AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS YE YT ZA ZM ZW'.split(' ');
const countryName=cc=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||cc}catch{return cc}};
let holidayMsg='';
/* public holidays of a country for about the next 13 months -> [{d:'YYYY-MM-DD', n:name}]. Nager.Date first (free, no key,
   most countries); the worker's /holidays (Google's public holiday calendars) for the ones it lacks, e.g. the Gulf states */
async function fetchHolidays(cc){
  const T=todayDate(),from=isoKey(new Date(T.getFullYear(),T.getMonth()-1,T.getDate())),to=isoKey(new Date(T.getFullYear()+1,T.getMonth()+1,T.getDate()));
  const tidy=l=>{const m={};for(const x of l)if(x.d>=from&&x.d<=to&&x.n)m[x.d]=m[x.d]&&!m[x.d].includes(x.n)?m[x.d]+', '+x.n:m[x.d]||x.n;return Object.entries(m).sort().map(([d,n])=>({d,n}))};
  try{const out=[];for(const y of new Set([+from.slice(0,4),+to.slice(0,4)])){const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`);if(r.status!==200)continue;
      for(const h of await r.json())if(h.global!==false&&(!h.types||h.types.includes('Public')))out.push({d:h.date,n:h.name||h.localName})}
    if(out.length)return tidy(out)}catch(e){/* unreachable or unknown country: try the worker */}
  const W=workerBase();if(!W)throw new Error(`No holiday list for ${countryName(cc)} until the app is connected: paste your invite link under Connection.`);
  let r;try{r=await fetch(new URL('holidays',W.url).href+'?country='+cc,{headers:{'x-app-token':W.tok},cache:'no-store'})}catch{throw new Error('Couldn’t reach your worker for the holiday list.')}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.holidaysError||(r.status===404||r.status===405?'The server doesn’t have holiday lists yet: it needs an update.':j.error||`HTTP ${r.status}`));
  return tidy((j.holidays||[]).map(h=>({d:h.date,n:h.name})))}
async function setHolidayCountry(cc,quiet){
  if(!cc){settings.holidays=null;holidayMsg='';await saveUserSettings();todayStale=true;renderDaysOffUI();return}
  if(!quiet){holidayMsg=`Loading the public holidays of ${countryName(cc)}…`;renderDaysOffUI()}
  try{const list=await fetchHolidays(cc),old=settings.holidays&&settings.holidays.country===cc?settings.holidays.skip||[]:[];
    settings.holidays={country:cc,list,skip:old.filter(d=>list.some(x=>x.d===d)),fetched:Date.now()};
    holidayMsg=list.length?'':`No public holidays found for ${countryName(cc)}.`;await saveUserSettings();todayStale=true}
  catch(e){if(quiet)return;holidayMsg=e.message||'Couldn’t load the holiday list.'}
  renderDaysOffUI()}
/* the list goes stale (new year, tentative dates confirmed): fetched again once a month, keeping the days you unticked */
/* the monthly refetch saves the settings with a new stamp, and the newest settings win a sync: on a device that had been away
   for a while, stamping its old settings would undo a change made on another device since. So it syncs first, and refetches
   only if the settings it then has still need it (another device may have done it already). Offline: not this time. */
async function refreshHolidays(){const due=()=>{const h=settings.holidays;return !!(h&&h.country&&Date.now()-(h.fetched||0)>30*864e5)};
  if(!due())return;
  if(typeof syncUrl==='function'&&syncUrl()&&localStorage.getItem('app_token')){
    if(!await syncNow())return;
    const st=await metaGet('settings');if(st)settings={...settings,...st};if(!due())return}
  return setHolidayCountry(settings.holidays.country,true)}
/* testers have daily limits instead of costs: no "about 7¢" for them (account.js knows who is connected) */
const showCost=()=>!(typeof isTester==='function'&&isTester());
async function toggleHoliday(d,on){const h=settings.holidays;if(!h)return;const skip=new Set(h.skip||[]);on?skip.delete(d):skip.add(d);
  settings.holidays={...h,skip:[...skip].sort()};await saveUserSettings();todayStale=true;renderDaysOffUI()}
const isoToDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return new Date(y,m-1,d)};
async function addDayOff(){const f=($('#cfg-off-from')||{}).value,t=($('#cfg-off-to')||{}).value||f,n=(($('#cfg-off-name')||{}).value||'').trim();
  const say=m=>{holidayMsg=m;renderDaysOffUI()};if(!f)return say('Pick a date first.');
  const a=isoToDate(f),b=isoToDate(t);if(b<a)return say('The last day is before the first.');if((b-a)/864e5>92)return say('That is more than three months: add it in parts.');
  const cur=new Map((settings.daysOff||[]).map(x=>[x.d,x]));let k=0;for(const d=new Date(a);d<=b;d.setDate(d.getDate()+1)){cur.set(isoKey(d),{d:isoKey(d),n:n||'Day off'});k++}
  settings.daysOff=[...cur.values()].sort((x,y)=>x.d<y.d?-1:1);holidayMsg=`${k} day${k===1?'':'s'} off added.`;
  for(const id of ['#cfg-off-from','#cfg-off-to','#cfg-off-name'])if($(id))$(id).value='';
  await saveUserSettings();todayStale=true;renderDaysOffUI()}
function renderDaysOffUI(){const box=$('#cfg-country'),list=$('#holiday-list');if(!box||!list)return;
  const h=settings.holidays,cc=h&&h.country||'';
  if(box.options.length<2)box.innerHTML='<option value="">No public holidays</option>'+COUNTRY_CODES.map(c=>[countryName(c),c]).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`<option value="${c}">${esc(n)}</option>`).join('');
  box.value=cc;
  const tk=isoKey(todayDate()),skip=new Set(h&&h.skip||[]),up=(h&&h.list||[]).filter(x=>x.d>=tk);
  list.innerHTML=!cc?'':up.length?up.map(x=>{const d=isoToDate(x.d),wk=!settings.workdays.includes(d.getDay());
    return `<label class="hrow${wk?' wk':''}"><input type="checkbox" ${skip.has(x.d)?'':'checked'} onchange="toggleHoliday('${x.d}',this.checked)"><span class="hd">${shortDate(d)}</span><span class="hn">${esc(x.n)}${wk?' <small class="mut">(not a workday anyway)</small>':''}</span></label>`}).join('')
    :h&&!h.fetched?`<small class="mut">The public holidays of ${esc(countryName(cc))} are loaded once the app is connected (chosen from this phone’s time zone).</small>`   // (setup.js setupHolidays)
    :'<small class="mut">No public holidays in the next year.</small>';
  const own=(settings.daysOff||[]).filter(x=>x.d>=tk),ol=$('#off-list');
  // consecutive days with one name are shown as one range
  const runs=[];for(const x of own){const r=runs[runs.length-1];if(r&&r.n===x.n&&(isoToDate(x.d)-isoToDate(r.to))/864e5<=1.5)r.to=x.d,r.ds.push(x.d);else runs.push({from:x.d,to:x.d,n:x.n,ds:[x.d]})}
  if(ol)ol.innerHTML=runs.map(r=>{const l=r.from===r.to?shortDate(isoToDate(r.from)):`${shortDate(isoToDate(r.from))} – ${shortDate(isoToDate(r.to))}`;
    return `<span class="fchip">${l}${r.n&&r.n!=='Day off'?' · '+esc(r.n):''}<button type="button" aria-label="Remove ${l}" onclick="removeDaysOff('${r.ds.join(',')}')">×</button></span>`}).join('');
  const m=$('#holiday-msg');if(m)m.textContent=holidayMsg||(cc&&up.length?`${up.filter(x=>!skip.has(x.d)).length} public holiday${up.length===1?'':'s'} of ${countryName(cc)} count as days off. Untick any you work.`:'');
  const f=$('#cfg-off-from');if(f)f.min=tk;
  if(settingsOpen())settingsSummaries()}   // the Days off summary follows an added or removed day (it kept the old count, audit 2026-11-13)
async function removeDaysOff(csv){const ds=new Set(csv.split(','));settings.daysOff=(settings.daysOff||[]).filter(x=>!ds.has(x.d));holidayMsg='';await saveUserSettings();todayStale=true;renderDaysOffUI()}
/* ---- Settings: formal days (any upcoming workday) and regenerating the shown day's photo ---- */
const shortDate=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderFormalUI(msg){const list=$('#formal-list'),inp=$('#cfg-formal-date');if(!list)return;
  const T=todayDate();if(inp){inp.min=isoDate(T);if(!inp.value)inp.value=isoDate(nextWorkday?nextWorkday(T):T)}
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
function renderRegenUI(){const btn=$('#regen-btn'),st=$('#regen-status');if(!btn)return;const o=planFor()[key(sel)],l=shortDate(sel);
  const r=o&&renderFor(o),pend=renderPending(o);btn.disabled=!o||!!rendering||pend;btn.textContent=pend?'Making photo…':o?`${r?'Regenerate':'Generate'} photo for ${l}`:`No outfit on ${l}`;
  if(st)st.textContent=o?(r?`Makes a new realistic photo of the day shown on Today${showCost()?' (about 7¢)':''}; it replaces the current one for every day with this look.`:`The day shown on Today has no photo yet${showCost()?' (about 7¢)':''}.`):'Pick a workday on Today first.';if(typeof needConn==='function'&&needConn(btn)&&st)st.textContent=''}
function renderSettingsExtras(){
  if(typeof renderDressUI==='function')renderDressUI();renderItemPicUI();renderFormalUI();renderRegenUI();renderReplanUI();renderDaysOffUI();renderCustomUI();if(typeof renderConnUI==='function')renderConnUI();
  if(typeof renderAsmUI==='function'){renderAsmUI();if(asmLive())asmSync()}
  if(typeof renderCareUI==='function')renderCareUI();
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" onclick="toggleDay('${id}',${i})" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}.`+(climate?` Beyond the 16-day forecast, days are planned from the usual weather there: highs of about ${temp(Math.min(...climate.map(m=>m.tmax)))}° in the coolest month and ${temp(Math.max(...climate.map(m=>m.tmax)))}° in the hottest.`:' Beyond the 16-day forecast, days follow the calendar season.'):'No location set: outfits follow the calendar season.';
  if($('#cfg-units'))$('#cfg-units').value=unit();
  if($('#cfg-vest'))$('#cfg-vest').value=settings.vestMode||'auto';if($('#cfg-dark'))$('#cfg-dark').value=settings.darkShirts||'some';
  settingsSummaries();
}
function setVestMode(v){settings.vestMode=v;saveUserSettings();settingsSummaries()}
/* how often dark shirts are planned (planner.js, darkMode): the coming week is planned again with the new choice */
async function setDarkShirts(v){settings.darkShirts=v;await clearLocks();await saveUserSettings();todayStale=true;settingsSummaries()}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0)return;settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  renderSettingsExtras();clearLocks().then(saveUserSettings)}
function setUnits(v){settings.units=v;saveUserSettings();settingsSummaries()}
function setLocation(loc){settings.location=loc;localStorage.removeItem('wx');localStorage.removeItem('wx_norm');weather={};climate=null;saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML=''}
function useMyLocation(){if(!navigator.geolocation){tell('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(p=>setLocation({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:'your current location'}),()=>tell('Location permission was denied. Search for your city instead.'))}
async function findCity(){const q=($('#cfg-city')&&$('#cfg-city').value||'').trim();if(!q)return;
  try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name='+encodeURIComponent(q));const j=await r.json();
    const res=(j.results||[]).map(c=>({lat:c.latitude,lon:c.longitude,name:[c.name,c.admin1,c.country_code].filter(Boolean).join(', ')}));
    window._cities=res;$('#city-results').innerHTML=res.length?res.map((c,i)=>`<button type="button" onclick="setLocation(_cities[${i}])">${esc(c.name)}</button>`).join(''):'<small class="mut">No matches.</small>'}
  catch(e){$('#city-results').innerHTML='<small class="mut">City search is unavailable right now.</small>'}}
/* 16-day forecast from Open-Meteo (free, no key); cached for 3 hours */
/* header ↻: sync with the worker (if set up), reload everything from storage, refresh the forecast and redraw */
let toastTimer=null;
function toast(t,ms=2500,act){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.toggle('act',!!act);
  if(act){const b=document.createElement('button');b.type='button';b.textContent=act.label;b.onclick=()=>{e.classList.remove('on','act');clearTimeout(toastTimer);act.fn()};e.append(' ',b)}
  e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('on','act'),ms)}
let refreshing=false;
async function refreshAll(){
  if(refreshing)return;refreshing=true;const b=$('#refresh-btn');if(b)b.classList.add('spin');
  let msg='';
  try{
    const n0=items.length;
    if(window.syncNow&&localStorage.getItem('worker_url')&&localStorage.getItem('app_token')){
      const ok=await syncNow();if(!ok)msg=localStorage.getItem('sync_status')||'Sync failed.'}
    const [r,d,st]=await Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')]);
    items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};cache={};
    await loadWeather(true);
    if(typeof renderTried!=='undefined')renderTried.clear();remoteKeys=null;
    const v=['today','wardrobe','add','stats','pack','care'].find(t=>$('#'+t)&&!$('#'+t).hidden)||'today';show(v);
    if(!msg){const diff=items.length-n0;msg=`Refreshed · ${items.length} item${items.length===1?'':'s'}${diff>0?` (${diff} new)`:diff<0?` (${-diff} removed)`:''}`}
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(g=>g&&g.update()).catch(()=>{});
  }catch(e){msg='Refresh failed: '+(e.message||e)}
  finally{refreshing=false;if(b)b.classList.remove('spin');toast(msg)}
}
/* the location's usual weather by month, from Open-Meteo's archive (free, no key): the last two full years' daily highs,
   lows and rain, averaged per month. Kept for four months per location; days beyond the 16-day forecast are planned from it. */
async function loadClimate(){
  const L=settings.location;if(!L){climate=null;return}
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');
    if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months)){const fresh=Date.now()-c.t<120*864e5;if(JSON.stringify(climate)!==JSON.stringify(c.months)){climate=c.months;cache={};if(!$('#today').hidden)refreshToday()}if(fresh)return}}catch{}
  try{const y=new Date().getFullYear(),r=await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${L.lat}&longitude=${L.lon}&start_date=${y-2}-01-01&end_date=${y-1}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
    const d=r.ok&&(await r.json()).daily;if(!d||!d.time||!d.temperature_2m_max)return;
    const m=[...Array(12)].map(()=>({n:0,tx:0,tn:0,r:0}));
    d.time.forEach((t,i)=>{const k=+t.slice(5,7)-1,tx=d.temperature_2m_max[i];if(!(k>=0&&k<12)||typeof tx!=='number')return;m[k].n++;m[k].tx+=tx;m[k].tn+=d.temperature_2m_min?.[i]??tx;if((d.precipitation_sum?.[i]||0)>=1)m[k].r++});
    if(m.some(x=>x.n<20))return;   // a month with hardly any readings: keep what we had
    const months=m.map(x=>({tmax:+(x.tx/x.n).toFixed(1),tmin:+(x.tn/x.n).toFixed(1),rainDays:+(x.r/x.n*30).toFixed(1)}));
    const N=settings.location;if(!N||N.lat!==L.lat||N.lon!==L.lon)return;   // the location changed meanwhile
    climate=months;localStorage.setItem('wx_norm',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),months}));cache={};if(!$('#today').hidden)refreshToday();if(settingsOpen())renderSettingsExtras()}
  catch(e){console.warn('climate history unavailable',e)}
}
async function loadWeather(force){
  const L=settings.location;if(!L)return;loadClimate();
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');
    if(!force&&c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3){if(JSON.stringify(weather)===JSON.stringify(c.days))return;   // already read (wxPreload): the plan stands
      weather=c.days;cache={};if(!$('#today').hidden)refreshToday();return}}catch{}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone=auto&forecast_days=16`);
    const d=(await r.json()).daily;if(!d||!d.time)return;const days={};
    d.time.forEach((t,i)=>{const [y,m,dd]=t.split('-').map(Number);days[key(new Date(y,m-1,dd))]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],pop:d.precipitation_probability_max[i]??0,rain:d.precipitation_sum[i]??0,code:d.weather_code[i]??0}});
    weather=days;localStorage.setItem('wx',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),days}));cache={};if(!$('#today').hidden)refreshToday()}
  catch(e){console.warn('weather unavailable',e)}
}

/* ---- theme: Auto (follow the device) → Light → Dark; saved per device ---- */
const THEMES={auto:['◐','automatic'],light:['☀︎','light'],dark:['☾','dark']};
function applyTheme(t){
  if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else{delete document.documentElement.dataset.theme;t='auto'}
  const b=$('#theme-btn');if(b){b.textContent=THEMES[t][0];b.setAttribute('aria-label','Theme: '+THEMES[t][1]);b.title='Theme: '+THEMES[t][1]+' (tap to change)'}
  if(window.appReady&&$('#today')&&!$('#today').hidden&&$('.fig'))renderToday();   // the figure fades into the page colour
}
function cycleTheme(){
  let cur='auto';try{cur=localStorage.getItem('theme')||'auto'}catch{}
  const next={auto:'light',light:'dark',dark:'auto'}[cur]||'auto';
  try{next==='auto'?localStorage.removeItem('theme'):localStorage.setItem('theme',next)}catch{}
  applyTheme(next);
}
try{applyTheme(localStorage.getItem('theme')||'auto')}catch{applyTheme('auto')}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(window.appReady&&!$('#today').hidden&&$('.fig'))renderToday()})}catch{}
