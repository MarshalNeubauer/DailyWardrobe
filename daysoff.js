/* Daily Wardrobe: Settings → Days off: public holidays, your own days off and the occasions (formal days)
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of settings.js on 2026-11-17.) */
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
  // only a dated, named holiday (fix round A, CR-7-02: the string compare let a date that went on with a quote and an onclick attribute through); names as core.js cleanSettings keeps them
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
async function toggleHoliday(d,on){const h=settings.holidays;if(!h)return;const skip=new Set(h.skip||[]);on?skip.delete(d):skip.add(d);
  settings.holidays={...h,skip:[...skip].sort()};await saveUserSettings();todayDirty();renderDaysOffUI()}
const isoToDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return new Date(y,m-1,d)};
/* a day off's name is at most OFF_NAME_MAX letters (W2-12-02: a pasted 57-letter link pushed its chip's × off the screen, and nothing limited it) */
const OFF_NAME_MAX=40,offNameCut=n=>{n=String(n||'').replace(/\s+/g,' ').trim();return [...n].length>OFF_NAME_MAX?[...n].slice(0,OFF_NAME_MAX-1).join('').trim()+'…':n};
async function addDayOff(){const f=($('#cfg-off-from')||{}).value,t=($('#cfg-off-to')||{}).value||f,n=($('#cfg-off-name')||{}).value;
  const r=await dayOffAdd(f,t,n);if(r.ok)for(const id of ['#cfg-off-from','#cfg-off-to','#cfg-off-name'])if($(id))$(id).value=''}
/* days off from f to t (YYYY-MM-DD, t empty: one day) named n, from the form above or a calendar event kept (calendar.js) -> {ok, msg};
   the message goes under Days off either way */
async function dayOffAdd(f,t,n){t=t||f;n=offNameCut(n);
  const say=m=>{holidayMsg=m;renderDaysOffUI();return {ok:false,msg:m}};if(!f)return say('Pick a date first.');
  const a=isoToDate(f),b=isoToDate(t),T=todayDate();if(b<a)return say('The last day is before the first.');if((b-a)/864e5>92)return say('That is more than three months: add it in parts.');
  // a typed date isn't held back by the field's min (audit 2026-11-15: "1 day off added." for a past day that never showed)
  if(b<T)return say(`${yearDate(b)} has passed: only days from today on can be added.`);
  const cur=new Map((settings.daysOff||[]).map(x=>[x.d,x]));let k=0;for(const d=new Date(a<T?T:a);d<=b;d.setDate(d.getDate()+1)){cur.set(isoKey(d),{d:isoKey(d),n:n||'Day off'});k++}
  settings.daysOff=[...cur.values()].sort((x,y)=>x.d<y.d?-1:1);holidayMsg=`${k} day${k===1?'':'s'} off added.`;
  await saveUserSettings();todayDirty();renderDaysOffUI();return {ok:true,msg:holidayMsg,n:k}}
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
  list.innerHTML=up.length?up.map(r=>{const l=shortDate(keyDate(r.date));return `<span class="fchip">${l} · ${occLabel(occOf(r))}<button type="button" aria-label="Make ${l} a regular day" data-act="occClear" data-day="${esc(r.date)}">×</button></span>`}).join(''):'<small class="mut">No occasions coming up.</small>';
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
/* the markup's handler (act.js): an occasion's × makes its day (data-day: the day's key) a regular day again */
function occClear(el){setOccasion(null,el.dataset.day)}
acts({occClear});
