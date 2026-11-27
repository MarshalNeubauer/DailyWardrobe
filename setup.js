/* Daily Wardrobe: first-run setup (a full-screen flow in the style of Settings) and the empty states of Today and the Wardrobe.
   Loaded after account.js (near the end of index.html's list); everything it stores goes through the existing settings functions. */
/* (2026-11-14, the owner) on an iPhone or iPad in a browser tab, a "Home Screen" step right after Welcome: the Home Screen app keeps its
   own storage, apart from Safari's, so what is set up in Safari stays there; it is shown before anything is set up. Not in the app opened
   from the Home Screen, not on other devices (the steps are then as before). SETUP_STEPS is worked out when the setup opens. */
import {$,DAY_NAMES,dayRecs,hasInviteHash,homeAndroid,homeIOS,homeNeeded,inRotation,inviteOver,isConnected,isHandPick,items,settings,settingsOpen,tourSeen,esc} from './core.js';
import {layerInert,tell} from './ui.js';
import {closeSettings,saveUserSettings,setVestMode,todayDirty,toggleDay} from './settings.js';
import {backDrop,backOn,backPush} from './back.js';
import {renderToday} from './today.js';
import {openAdd,show} from './nav.js';
import {announce,keepFocus} from './app.js';
import {acts} from './act.js';
const SETUP_BASE=['welcome','week','wear','weather','connect','done'];
let SETUP_STEPS=SETUP_BASE.slice();
const setupStepsNow=()=>typeof homeNeeded==='function'&&homeNeeded()?['welcome','home',...SETUP_BASE.slice(1)]:SETUP_BASE.slice();
const SETUP_TITLES={welcome:'Welcome',get home(){return typeof homeAndroid==='function'&&homeAndroid()?'Install the app':'Home Screen'},week:'Your week',wear:'What you wear',weather:'Weather',connect:'Connection',done:'All set'};
/* the flow's state: at = the step shown (-1 = closed); first = it opened by itself on a new install (not "Run setup again") */
let setup={at:-1,first:false,vestSet:false,q:'',cities:null,cityMsg:'',msg:'',busy:false,watch:null};
let setupNo=false;   // the app was already driven somewhere before start-up looked: the setup doesn't open by itself

/* the dress code (the planner reads the same object): a missing object or key means yes */
const setupDress=()=>({jacket:!(settings.dress&&settings.dress.jacket===false),tie:!(settings.dress&&settings.dress.tie===false)});
const setupConnected=()=>isConnected();
/* an invitation link from the address being checked (account.js), or one the server couldn't be reached for (it stays in the address) */
const setupLinkChecking=()=>askFor('invite-checking');
const setupLinkWaiting=()=>askFor('acct-why')==='offline'&&hasInviteHash();
const setupShown=()=>setup.at>=0;

/* start-up, once the wardrobe, history and settings are read: a new install (nothing in the wardrobe, no day ever recorded,
   setup never finished) gets the setup; someone with items is marked as done without a word (kept with the next settings change:
   saving here would count as a change on the device and make the next sync a full one) */
function setupStart(){const r=setupResume(),open=()=>setupAuto()&&!settingsOpen()&&!!$('#today')&&!$('#today').hidden,gate=()=>!setupNo&&open();
  // a "Run setup again" cut off by iOS: back where it was, Cancel still undoes it. (fix round 2) Not held back by setupNo, which is about a
  // setup opening by itself (start-up's show('today') sets it whenever there are items, so it never came back for anyone with a wardrobe);
  // a record that isn't taken up now is dropped, so it can't open by itself later and its Cancel undo settings changed since
  if(r&&r.again){if(settings.setupDone&&open()){setupOpen(true,r);return}setupKeep(null)}
  if(settings.setupDone){setupKeep(null);return}
  if(items.length){settings.setupDone=Date.now();setupKeep(null);return}
  if(!gate()||Object.keys(dayRecs).length)return;
  setupOpen(false,r&&!r.again?r:null);
}
/* (audit 2026-11-15) the step on screen is kept (localStorage.setup_at: {k, again, before}), so a setup cut off by iOS opens again where
   it was, not at Welcome; removed when the setup closes */
const SETUP_KEY='setup_at';
function setupResume(){try{const r=JSON.parse(localStorage.getItem(SETUP_KEY)||'null');return r&&typeof r.k==='string'?r:null}catch{return null}}
function setupKeep(r){try{r?localStorage.setItem(SETUP_KEY,JSON.stringify(r)):localStorage.removeItem(SETUP_KEY)}catch{}}
const setupSave=()=>{if(setupShown())setupKeep({k:SETUP_STEPS[setup.at],again:!setup.first,before:setup.before||null,vestSet:setup.vestSet})};
/* what "Run setup again" can change, as it was when it opened: Cancel puts it back (audit 2026-11-15: each tap is stored at once, and an
   abandoned run kept whatever was tapped) */
const SETUP_UNDO=['workdays','blazerDays','dress','vestMode','units','location'];
const setupBefore=()=>JSON.parse(JSON.stringify(Object.fromEntries(SETUP_UNDO.map(k=>[k,settings[k]===undefined?null:settings[k]]))));
/* a person who never chose a vest: no stamp on it (core.js setStampOf; a choice made before iOS cut the setup off, or the account's from
   another phone, has one) */
const setupVestChosen=()=>setup.vestSet||(setStampOf(settings,'vestMode')>0);
/* a browser driven by a test program (navigator.webdriver) starts like a new install every time, and nearly every test then
   works on the page straight away: there the setup opens by itself only when the test asks (window.SETUP_AUTO, set before load) */
const setupAuto=()=>!navigator.webdriver||window.SETUP_AUTO===true;
function setupEl(){let e=$('#setup');
  if(!e){e=document.createElement('div');e.id='setup';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-labelledby','su-title');e.tabIndex=-1;document.body.appendChild(e)}
  return e}
function setupInert(on){if(!on)return layerInert();   // closing: the page stays inert while Settings or a sheet is up (ui.js)
  for(const s of['header','main','nav']){const el=$(s);if(el)el.inert=on}}
function setupOpen(again,resume){
  closeSettings();
  askFor('kit-home-close');   // the setup has its own Home Screen step (one explanation)
  setup={at:0,first:!again,vestSet:!!(resume&&resume.vestSet),q:'',cities:null,cityMsg:'',msg:'',busy:false,watch:null,before:again?(resume&&resume.before)||setupBefore():null};SETUP_STEPS=setupStepsNow();
  if(resume){const i=SETUP_STEPS.indexOf(resume.k);if(i>0)setup.at=i}
  setupInert(true);setupEl().classList.add('on');setupDraw();setupSave();setupEl().focus({preventScroll:true});
  backPush('setup');   // the phone's Back steps back through the setup instead of leaving the app (setupBack)
}
/* the phone's Back is its ‹ Back; on the first step a first setup stays open, "Run setup again" closes as its Cancel (the Back audit,
   2026-11-15: Back did nothing there) */
function setupBack(){if(!setupShown())return;if(setup.at>0){setupGo(-1);backPush('setup')}else if(!setup.first)setupCancel();else backPush('setup')}
/* the socket nav.js asks as a page is shown (bus.js): a setup that opened by itself steps aside; and the backup's words for the
   Connection step, which sync.js serves (without sync.js the step says the wardrobe is backed up, as ui.js's Connection line does;
   this file reads nothing of app.js's own ask(), the server request) */
import {serve,ask,askFor,served} from './bus.js';
import {clearLocks} from './days.js';
import {cityFound,findCity,setCityFound,setLocation,setUnits,unit,useMyLocation} from './weather.js';
import {COUNTRY_CODES,setHolidayCountry} from './daysoff.js';
serve('setup-yield',setupYield);serve('setup-needs',setupNeeds);   // (and what the wardrobe still needs, for Insights: stats.js)
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,setupCancel,setupClose,setupDress,setupGo,setupOpen,setupSearch,setupVestChosen,get setup(){return setup},set setup(v){setup=v},get SETUP_STEPS(){return SETUP_STEPS},setupDraw,setupFinish,setupShown,setupToday,tzCountry};
export {SETUP_STEPS,setup,setupDress,setupShown,setupStart,setupVestChosen,setupOpen,setupClose,setupCancel,setupFinish,tzCountry,setupYield,setupGo,setupSample,setupDraw,setupSearch,setupNeeds,setupToday,setupWardEmpty};
backOn('setup',()=>setupBack());
function setupClose(){
  if(setup.watch)clearInterval(setup.watch);setup.watch=null;setup.at=-1;setupKeep(null);
  const e=$('#setup');if(e){e.classList.remove('on');e.innerHTML=''}setupInert(false);
  backDrop('setup');
}
/* a double tap on Skip or "Add my first item": the second tap landed on what the setup uncovered (Settings' ⚙ under Skip, the tour's Next
   under "Add my first item"; audit 2026-11-15). A tap at the same spot within SETUP_TAP_MS of the one that closed the setup is dropped */
const SETUP_TAP_MS=350;
let setupTap=null,setupTapOn=false;
function setupTapGuard(e){if(!e||!e.detail)return;setupTap={x:e.clientX,y:e.clientY,t:Date.now()};if(setupTapOn)return;setupTapOn=true;
  document.addEventListener('click',ev=>{const g=setupTap;if(!g||Date.now()-g.t>SETUP_TAP_MS)return;
    if(Math.abs(ev.clientX-g.x)<44&&Math.abs(ev.clientY-g.y)<44){ev.preventDefault();ev.stopImmediatePropagation()}},true)}
/* Cancel on "Run setup again": what it changed goes back as it was */
function setupCancel(e){setupTapGuard(e);const b=setup.before||{},changed=SETUP_UNDO.filter(k=>JSON.stringify(settings[k]===undefined?null:settings[k])!==JSON.stringify(b[k]===undefined?null:b[k]));
  setupClose();if(!changed.length)return;
  for(const k of changed){if(k==='location')continue;if(b[k]===null||b[k]===undefined)delete settings[k];else settings[k]=b[k]}
  if(changed.includes('location'))setLocation(b.location||null);
  saveUserSettings().then(clearLocks);todayDirty(false);renderToday();tell('Setup canceled: your answers are as they were.')}
/* Skip (stay on Today) and Done (go and add the first item) both finish it for good.
   A new person who didn't choose gets no vest: the stored default is the three-piece suit on cooler days. */
function setupFinish(toAdd,e){setupTapGuard(e);
  if(setup.first&&!setupVestChosen())settings.vestMode='never';
  // (fix round 2) the time zone's country is stored with setupDone, its list to come (fetched 0): swiped away right after, the setup was
  // done with no holidays and nothing tried again; now the next start's refreshHolidays fetches it
  const first=setup.first;if(first)setupHolCountry();settings.setupDone=Date.now();setupClose();saveUserSettings().then(()=>{if(first)setupHolidays()});
  if(toAdd&&!items.length){const go=()=>{show('wardrobe');openAdd()};if(first&&served('tour-open')&&!tourSeen())askFor('tour-open',go,'Add my first item');else go()}else show('today');   // Add is a page of the Wardrobe: its ‹ goes there
}
/* the public holidays of the country the phone's time zone is in, chosen for a new person (audit 2026-11-13: the work week was set,
   the holidays were not); Settings → Days off changes it. Without a list yet (Nager.Date lacks the Gulf states, whose list comes from
   the server once connected) the country is kept with an empty list, fetched 0, so the monthly refetch (refreshHolidays) tries again */
const TZ_CC={'Asia/Kuwait':'KW','Asia/Riyadh':'SA','Asia/Dubai':'AE','Asia/Qatar':'QA','Asia/Bahrain':'BH','Asia/Muscat':'OM','Asia/Baghdad':'IQ','Asia/Amman':'JO','Asia/Beirut':'LB','Africa/Cairo':'EG','Asia/Karachi':'PK','Asia/Kolkata':'IN','Asia/Calcutta':'IN','Asia/Singapore':'SG','Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Shanghai':'CN','Asia/Hong_Kong':'HK','Australia/Sydney':'AU','Australia/Melbourne':'AU','Pacific/Auckland':'NZ',
  'Europe/London':'GB','Europe/Dublin':'IE','Europe/Paris':'FR','Europe/Berlin':'DE','Europe/Madrid':'ES','Europe/Rome':'IT','Europe/Amsterdam':'NL','Europe/Brussels':'BE','Europe/Zurich':'CH','Europe/Vienna':'AT','Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Copenhagen':'DK','Europe/Helsinki':'FI','Europe/Warsaw':'PL','Europe/Lisbon':'PT','Europe/Athens':'GR','Europe/Istanbul':'TR','Europe/Moscow':'RU',
  'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Phoenix':'US','America/Los_Angeles':'US','America/Anchorage':'US','Pacific/Honolulu':'US','America/Toronto':'CA','America/Vancouver':'CA','America/Mexico_City':'MX','America/Sao_Paulo':'BR','America/Argentina/Buenos_Aires':'AR','Africa/Johannesburg':'ZA','Africa/Lagos':'NG','Africa/Nairobi':'KE'};
function tzCountry(){let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch{}
  if(TZ_CC[tz])return TZ_CC[tz];const m=/-([A-Z]{2})$/.exec(navigator.language||'');return m&&COUNTRY_CODES.includes(m[1])?m[1]:null}
function setupHolCountry(){if(settings.holidays&&settings.holidays.country)return;const cc=tzCountry();if(cc)settings.holidays={country:cc,list:[],skip:[],fetched:0}}
async function setupHolidays(){const h=settings.holidays;if(h&&h.country&&(h.fetched||(h.list||[]).length))return;const cc=h&&h.country||tzCountry();if(!cc)return;
  try{await setHolidayCountry(cc,true)}catch(e){console.warn('holidays not loaded',e)}
  if(!(settings.holidays&&settings.holidays.country)){settings.holidays={country:cc,list:[],skip:[],fetched:0};await saveUserSettings()}}
/* the app is being driven past a setup that opened by itself (items came in from a sync or a restore, another page was
   opened): it steps aside without being marked as done. One the user started from Settings stays. */
function setupYield(t){
  if(!setupShown()){if(items.length||(t&&t!=='today'))setupNo=true;return}
  if(!setup.first)return;
  if(t&&t!=='today'){setupClose();return}
  // (audit 2026-11-15) connected from the setup's own Connection step (the Home Screen app): the wardrobe that comes across doesn't end the
  // setup mid-flow; it goes on with the account's answers, to "All set"
  if(items.length){if(setup.joined||setup.busy){if(['connect','done'].includes(SETUP_STEPS[setup.at]))setupDraw();return}setupClose()}
}
/* a city search left unfinished (typed, searching, or results not picked) is said once before Next leaves the Weather step: a new
   user tapped Next on "Searching…" and had no location (audit 2026-11-13); a second Next goes on */
function setupCityOpen(){return SETUP_STEPS[setup.at]==='weather'&&!setup.cityWarned&&(!!(setup.q||'').trim()||!!(setup.cities&&setup.cities.length)||setup.cityMsg==='Searching…')}
/* (fix round 2) a double tap on Get started / Next / Back moved two steps (the button is drawn again under the finger): a tap at the spot of
   the last step's tap within SETUP_TAP_MS is dropped, as Skip's (setupTapGuard). Only real taps (e.detail); calls from code always step */
let setupGoTap=null;
function setupGoDouble(e){if(!e||!e.detail)return false;const g=setupGoTap,now=Date.now();
  if(g&&now-g.t<SETUP_TAP_MS&&Math.abs(e.clientX-g.x)<44&&Math.abs(e.clientY-g.y)<44)return true;
  setupGoTap={x:e.clientX,y:e.clientY,t:now};return false}
function setupGo(n,e){if(setupGoDouble(e))return;
  if(n>0&&setupCityOpen()){setup.cityWarned=true;
    setup.cityMsg=settings.location?`That city wasn’t picked: the weather stays ${settings.location.name}. Pick a result, or tap Next again to go on.`:'You haven’t picked a city yet: pick one of the results, or tap Next again to go on without a location.';
    setupDraw();const f=$('#su-city');if(f)f.focus({preventScroll:true});return}
  const at=setup.at+n;if(at<0)return;if(at>=SETUP_STEPS.length){setupFinish(true,e);return}
  if(setup.watch){clearInterval(setup.watch);setup.watch=null}
  const had=!!setupEl().contains(document.activeElement)&&document.activeElement!==setupEl();
  setup.at=at;setup.msg='';setupDraw();setupSave();const b=$('#setup .su-body');if(b)b.scrollTop=0;
  // the new step is said, and the keyboard stays on Next / Back (Back is gone on the first step: Next) (fix round 3, W2-19-01: focus fell to <body>, nothing said)
  if(had&&!setupEl().contains(document.activeElement)){const nb=$('#su-next');if(nb)nb.focus({preventScroll:true})}
  {const t=$('#su-title');announce(`Step ${at+1} of ${SETUP_STEPS.length}: ${t?t.textContent:''}`)}
  backPush('setup')}   // (again after a tap: an entry made at start-up without one may be skipped by Back)

/* ---- the steps ---- */
const setupSwitch=(k,on,title,sub)=>`<button type="button" class="su-sw" id="su-sw-${k}" role="switch" aria-checked="${on}" data-act="setupSwTap" data-k="${k}"><span class="su-swt"><b>${title}</b><small>${sub}</small></span><i class="su-knob" aria-hidden="true"></i></button>`;
const setupDays=(kind,list,shown)=>`<div class="su-days" id="su-${kind}" role="group" aria-label="${kind==='workdays'?'Workdays':'Blazer days'}">${DAY_NAMES.map((n,i)=>shown.includes(i)?`<button type="button" class="su-day${list.includes(i)?' on':''}" aria-pressed="${list.includes(i)}" data-act="setupDayTap" data-k="${kind}" data-s="${i}">${n.slice(0,3)}</button>`:'').join('')}</div>`;
function setupStep(k){const d=setupDress();
  if(k==='welcome')return `<p class="su-lead">Daily Wardrobe picks what you wear each workday from the clothes you own.</p><p class="su-lead">It rotates your pieces so nothing is worn out or forgotten, and keeps the colors and patterns working together.</p><p class="su-help">A few short questions first. You can change every answer later in Settings.</p>${setupConnected()?'':'<p class="su-help" id="su-before">Used the app before with an invitation link? Open that link again: your wardrobe, day history and settings come back from your backup. Do that before adding anything here.</p>'}`;   // (audit 2026-11-15, W1-11-01: after Safari cleared the site, nothing said the wardrobe was safe)
  if(k==='home')return askFor('home-steps',true)??'';
  if(k==='week')return `<div class="su-group"><div class="su-label">Workdays</div><p class="su-help">You get an outfit on these days.</p>${setupDays('workdays',settings.workdays,[0,1,2,3,4,5,6])}</div>`+
    (d.jacket?`<div class="su-group"><div class="su-label">Blazer days</div><p class="su-help">Business-casual days get a blazer and pants; other workdays get a suit. Leave them all off for a suit every day.</p>${setupDays('blazer',settings.blazerDays,settings.workdays)}</div>`:'');
  if(k==='wear'){const v=setup.first&&!setupVestChosen()?'never':(settings.vestMode||'auto');
    // the vest only with ties, as Settings (a waistcoat is never planned without a tie; audit 2026-11-15)
    return `<p class="su-help">Outfits are planned around what you actually wear to work.</p>${setupSwitch('jacket',d.jacket,'Jackets','A suit or a blazer on workdays')}${setupSwitch('tie',d.tie,'Ties','A tie with every outfit')}`+
    (d.jacket&&d.tie?`<label class="su-row">Suit vest <select id="su-vest" data-act-change="setupVestPick">${[['never','No vest'],['auto','On cooler suit days'],['always','Every suit day']].map(o=>`<option value="${o[0]}"${o[0]===v?' selected':''}>${o[1]}</option>`).join('')}</select></label>`:'')}
  if(k==='weather'){const u=unit(),loc=settings.location;
    return `<div class="su-group"><div class="su-label">Where you are</div><p class="su-help" id="su-loc">${loc?`<span class="su-tick" aria-hidden="true">✓</span> Weather for ${esc(loc.name)}.`:'With a location, outfits follow the forecast: lighter cloth on hot days, no suede in the rain. Without one they follow the calendar season.'}</p>
<div class="su-acts"><button type="button" id="su-geo" data-act="setupGeoTap">Use my location</button></div>
<div class="su-form"><input type="text" id="su-city" placeholder="Search a city" aria-label="City" value="${esc(setup.q)}" data-act-input="setupCityType" data-act-keydown="setupCityKey"><button type="button" id="su-find" data-act="setupFindTap">Search</button></div>
<div class="su-acts" id="su-cities">${(setup.cities||[]).map((c,i)=>`<button type="button" data-act="setupCityTap" data-s="${i}">${esc(c.name)}${c.alt?` <span dir="auto">(${esc(c.alt)})</span>`:''}</button>`).join('')}</div>${setup.cityMsg?`<p class="su-help" role="status">${esc(setup.cityMsg)}</p>`:''}</div>
<div class="su-group"><div class="su-label">Temperatures in</div><div class="su-days" id="su-units" role="group" aria-label="Temperatures in">${['C','F'].map(x=>`<button type="button" class="su-day${u===x?' on':''}" aria-pressed="${u===x}" data-act="setupUnitTap" data-k="${x}">°${x}</button>`).join('')}</div></div>`}
  if(k==='connect')return setupConnected()?`<p class="su-ok" id="su-conn"><span class="su-tick" aria-hidden="true">✓</span> Connected</p><p class="su-help">Photos of your clothes are read automatically, item pictures can be made, and ${ask('backed-up-words')||'your wardrobe is backed up'}.</p>${setup.joined&&items.length?`<p class="su-help" id="su-came">Your wardrobe came across: ${items.length} item${items.length===1?'':'s'}. The answers are your account’s.</p>`:''}${setupHomeLink()}`
    :setupLinkChecking()?'<p class="su-ok" id="su-conn" role="status"><span class="spin" aria-hidden="true"></span> Checking your invitation…</p><p class="su-help">This can take a moment on a slow connection. You can carry on with Next meanwhile.</p>'
    :`<p class="su-help">${inviteOver()?'Your invitation has ended, so the link you used no longer works: nothing is read or backed up. If you were given a new invitation link, paste it here.':setupLinkWaiting()?'Your invitation link couldn’t be checked: the server couldn’t be reached. It is tried again when you come back to the app or your connection returns, or tap Connect.':'If you were given an invite link, paste it here. It turns on automatic reading of your photos, item pictures and a backup. Used the app before? The same link brings your backed-up wardrobe back.'}</p>
<div class="su-form"><input type="text" id="su-link" placeholder="Paste your invite link" aria-label="Invite link"${setupLinkWaiting()?` value="${esc(location.href)}"`:''} autocomplete="off" autocapitalize="off" spellcheck="false" data-act-keydown="setupLinkKey"><button type="button" id="su-connect" data-act="setupConnectTap"${setup.busy?' disabled':''}>${setup.busy?'Connecting…':'Connect'}</button></div>
${setup.msg?`<p class="su-help su-err" role="alert">${esc(setup.msg)}</p>`:''}
<p class="su-note" id="su-without"><b>No link? The app works without one.</b> You then add your items by hand, picking the type and colors yourself: no automatic photo reading and no item pictures. You can connect later in Settings.</p>`;
  /* in the Week step's order (Sunday first, as Settings shows them) */
  const days=l=>l.length?[...l].sort((a,b)=>a-b).map(i=>DAY_NAMES[i].slice(0,3)).join(', '):'none';
  /* trousers are needed only without a suit (the Today checklist says "not needed with a suit"): said as a condition, not as a must */
  const nd=setupNeeds(),opt=nd.find(n=>n.k==='pants'&&n.sub),must=nd.filter(n=>n!==opt).map(n=>n.short).join(', ').replace(/, ([^,]*)$/,' and $1');
  // the blazer days and the vest too (audit 2026-11-15: the pre-selected Thursday decided a whole day's outfit and wasn't listed)
  const vest=({never:'no vest',auto:'a vest on cooler suit days',always:'a vest every suit day'})[setup.first&&!setupVestChosen()?'never':(settings.vestMode||'auto')];
  const wear=[d.jacket?'jackets':'no jackets',d.tie?'ties':'no ties',...(d.jacket&&d.tie?[vest]:[])].join(', ');
  const bl=settings.blazerDays.filter(x=>settings.workdays.includes(x));
  return `<p class="su-lead">${items.length?'That’s everything.':'That’s everything. Now add your clothes.'}</p>
<ul class="su-sum"><li><span>Workdays</span><b>${days(settings.workdays)}</b></li>${d.jacket?`<li><span>Blazer days</span><b>${bl.length?days(bl):'none: a suit every day'}</b></li>`:''}<li><span>You wear</span><b>${wear}</b></li><li><span>Weather</span><b>${settings.location?esc(settings.location.name):'by the calendar'} · °${unit()}</b></li><li><span>Connection</span><b>${setupConnected()?'connected':setupLinkChecking()?'checking your invitation…':inviteOver()?'invitation ended':'not connected'}</b></li></ul>
${items.length?'':`<p class="su-help">Today shows your first outfit once you have ${must}${opt?', plus pants if you wear a blazer rather than a suit':''}.</p>${askFor('kit-start-row',true)??''}`}`;
}
/* connected at the Connection step in Safari on an iPhone: the Home Screen app needs the link too (kit.js homeCopy) */
const setupHomeLink=()=>setup.joined&&typeof homeIOS==='function'&&homeIOS()&&homeNeeded()&&askFor('home-tester')?`<p class="su-help">For the app on your Home Screen: copy your invitation link here and paste it at its Connection step.</p>${askFor('home-copy-btn')??''}`:'';
/* "Try a sample wardrobe" on the last step loads it, and the setup finishes (holidays, the vest) once it is stored (kit.js kitSampleDone;
   audit 2026-11-15); finished first, a kill before the sample was stored left the setup done and no sample (re-audit 2026-11-15) */
function setupSample(e){setupTapGuard(e);askFor('kit-sample-load')}
function setupDraw(){if(!setupShown())return;const k=SETUP_STEPS[setup.at],n=SETUP_STEPS.length,last=setup.at===n-1;
  keepFocus(setupEl(),()=>setupHtml(k,n,last))}
function setupHtml(k,n,last){
  setupEl().innerHTML=`<div class="su-head"><div class="su-ttl"><h2 id="su-title">${SETUP_TITLES[k]}</h2><small id="su-count">Step ${setup.at+1} of ${n}</small></div>${!setup.first?`<button type="button" class="su-skip" id="su-cancel" data-act="setupCancelTap">Cancel</button>`:last?'':`<button type="button" class="su-skip" id="su-skip" data-act="setupSkipTap">Skip</button>`}</div>
<div class="su-prog" aria-hidden="true">${SETUP_STEPS.map((s,i)=>`<i class="${i<=setup.at?'on':''}"></i>`).join('')}</div>
<div class="su-body"><div class="su-in" id="su-step" data-step="${k}">${setupStep(k)}</div></div>
<div class="su-bar">${setup.at?`<button type="button" id="su-back" data-act="setupBackTap">Back</button>`:''}<button type="button" class="pri" id="su-next" data-act="setupNextTap">${last?(items.length?'Done':'Add my first item'):setup.at?'Next':'Get started'}</button></div>`;
}

/* ---- what the steps store (all through the app's own settings functions) ---- */
function setupDay(kind,i){toggleDay(kind==='workdays'?'#cfg-workdays':'#cfg-blazer',i);setupDraw()}
/* the rest of the dress code stays (audit 2026-11-15: "Run setup again" erased "Jeans with a blazer") */
function setupSetDress(k){const d=setupDress();d[k]=!d[k];settings.dress={...(settings.dress||{}),...d};saveUserSettings().then(clearLocks);setupDraw();const b=$('#su-sw-'+k);if(b)b.focus({preventScroll:true})}   // saved first (fix round 2: swiped away at once, it was lost)
function setupVest(v){setup.vestSet=true;setVestMode(v);setupSave()}
function setupUnits(v){setUnits(v);setupDraw()}
/* the city search is the Settings one (findCity reads Settings' own field and keeps its answers in weather.js's cityFound) */
async function setupSearch(){const q=(setup.q||'').trim();if(!q&&(setup.cities||setup.cityMsg)){setup.cities=null;setup.cityMsg='';setupDraw();return}if(!q||!$('#cfg-city'))return;
  $('#cfg-city').value=q;setCityFound(null);setup.cities=null;setup.cityMsg='Searching…';setupDraw();
  await findCity();if($('#city-results'))$('#city-results').innerHTML='';$('#cfg-city').value='';
  const res=cityFound;setup.cities=res||null;setup.cityMsg=!res?'City search is unavailable right now.':res.length?'':'No matches. Try the name in English or a nearby larger city, or Use my location.';setupDraw();announce(setup.cityMsg||`${res.length} place${res.length===1?'':'s'} found`)}
function setupPick(i){const c=(setup.cities||[])[i];if(!c)return;setup.cities=null;setup.cityMsg='';setup.q='';setLocation(c);setupDraw()}
/* useMyLocation answers later (the permission prompt): the step is drawn again once the location has changed */
function setupLocate(){const was=JSON.stringify(settings.location);useMyLocation();
  if(setup.watch)clearInterval(setup.watch);let n=0;
  setup.watch=setInterval(()=>{if(!setupShown()||++n>400){clearInterval(setup.watch);setup.watch=null;return}
    if(JSON.stringify(settings.location)!==was){clearInterval(setup.watch);setup.watch=null;setup.cities=null;setup.cityMsg='';setupDraw()}},150)}
async function setupConnect(){const el=$('#su-link'),t=(el&&el.value||'').trim();if(!t||setup.busy)return;
  setup.busy=true;setup.msg='';setupDraw();if($('#su-link'))$('#su-link').value=t;let ok=false;
  try{ok=!!(await askFor('connect-link',t))}catch(e){ok=false}
  // why, in the setup's words: offline is not a wrong link (it said "check that you copied all of it" while offline)
  const why=askFor('acct-why');
  setup.busy=false;if(ok)setup.joined=true;setup.msg=ok||why==='kept'?'':why==='offline'?'Couldn’t reach the server: you may be offline. Connect when you’re back online, or tap Next and connect later in Settings.':why==='refused'?askFor('acct-fail-text')+' Or carry on without it.':'That link didn’t work. Check that you copied all of it, or carry on without it.';
  if(!setupShown())return;setupDraw();if(!ok&&$('#su-link'))$('#su-link').value=t}

/* ---- Today with an empty or too-small wardrobe: what is still needed for a first outfit ---- */
function setupNeeds(){const d=setupDress(),has=t=>items.some(i=>i.type===t&&!isHandPick(i)&&inRotation(i)),rows=[];
  if(d.jacket)rows.push({k:'jacket',t:'A suit or a blazer',short:'a suit or blazer',ok:has('suit')||has('blazer')});
  rows.push({k:'shirt',t:'A shirt',short:'a shirt',ok:has('shirt')});
  if(d.tie)rows.push({k:'tie',t:'A tie',short:'a tie',ok:has('tie')});
  if(!d.jacket||!has('suit'))rows.push({k:'pants',t:'Pants',short:'pants',sub:d.jacket?'not needed with a suit':'',ok:has('pants')});
  rows.push({k:'shoes',t:'Shoes',short:'shoes',ok:has('shoes')});
  return rows}
/* called by renderToday: the checklist card, or '' once an outfit can be planned (every row ticked) */
function setupToday(){
  if(items.length)setupYield();
  const rows=setupNeeds(),left=rows.filter(r=>!r.ok).length;if(!left)return '';
  return `<div class="firstrun" id="firstrun"><h3>Get your first outfit</h3><p class="fr-sub">${left===rows.length?'Add these and Today picks an outfit for every workday.':`${rows.length-left} of ${rows.length} added. Add the rest and Today picks an outfit for every workday.`}</p>
<ul class="fr-list">${rows.map(r=>`<li class="fr-it${r.ok?' done':''}" data-need="${r.k}"><span class="fr-tick" aria-hidden="true">${r.ok?'✓':''}</span><span class="fr-t">${r.t}${r.sub&&!r.ok?` <small>(${r.sub})</small>`:''}</span><small class="fr-st">${r.ok?'Added':r.sub?'If no suit':'Needed'}</small></li>`).join('')}</ul>
<button type="button" class="fr-add pri" id="fr-add" data-act="setupAddTap">Add an item</button>${askFor('kit-start-row')??''}</div>`;
}
/* the Wardrobe tab with nothing in it */
function setupWardEmpty(){
  return `<div class="card wempty" id="wempty"><svg class="wempty-pic" viewBox="0 0 120 84" aria-hidden="true"><path class="we-rail" d="M8 12h104"/><path class="we-hook" d="M60 12v6a5 5 0 1 0 5 5"/><path class="we-hang" d="M60 30 24 52a4 4 0 0 0 2 7h68a4 4 0 0 0 2-7z"/><path class="we-ghost" d="M26 12v10M94 12v10M20 30l6-8 6 8M88 30l6-8 6 8"/></svg>
<b class="wempty-t">Your wardrobe is empty</b><p class="wempty-s">Add what you wear to work: a photo of each piece, or pick its type and colors by hand.</p>
<button type="button" class="pri" id="wempty-add" data-act="setupAddTap">Add your first item</button><div class="kit-start"><button type="button" class="linkbtn" data-act="wemptyImportTap">Import from a spreadsheet</button><span aria-hidden="true">·</span><button type="button" class="linkbtn" data-act="wemptySampleTap">Try a sample wardrobe</button></div></div>`;
}

/* ---- what the controls do (act.js): el is the control, ev the tap or key; the arguments are in its data-* attributes ---- */
/* the head and the bar: Cancel, Skip, Back and Next take the tap itself (the double-tap guards read where it landed) */
function setupCancelTap(el,ev){setupCancel(ev)}
function setupSkipTap(el,ev){setupFinish(false,ev)}
function setupBackTap(el,ev){setupGo(-1,ev)}
function setupNextTap(el,ev){setupGo(1,ev)}
/* (an argument that tells two controls of one handler apart is in data-k or data-s: keepFocus finds the redrawn control by them, app.js focusFind) */
/* Your week and What you wear: a day button (data-k the list, data-s the day), a switch (data-k), the vest */
function setupDayTap(el){setupDay(el.dataset.k,+el.dataset.s)}
function setupSwTap(el){setupSetDress(el.dataset.k)}
function setupVestPick(el){setupVest(el.value)}
/* Weather: Use my location, the city field (typed text kept for a redraw; Enter searches), Search, a result (data-s: its place in
   setup.cities), °C / °F (data-k) */
function setupGeoTap(){setupLocate()}
function setupCityType(el){setup.q=el.value}
function setupCityKey(el,ev){if(ev.key==='Enter'){ev.preventDefault();setupSearch()}}
function setupFindTap(){setupSearch()}
function setupCityTap(el){setupPick(+el.dataset.s)}
function setupUnitTap(el){setupUnits(el.dataset.k)}
/* Connection: Enter in the link field, Connect */
function setupLinkKey(el,ev){if(ev.key==='Enter'){ev.preventDefault();setupConnect()}}
function setupConnectTap(){setupConnect()}
/* Today's checklist and the empty Wardrobe: Add, Import from a spreadsheet, Try a sample wardrobe (kit.js) */
function setupAddTap(){openAdd()}
function wemptyImportTap(){askFor('kit-import-open')}
function wemptySampleTap(){askFor('kit-sample-load')}
/* index.html's (act.js): Settings' "Run setup again" */
function setupAgainTap(){setupOpen(true)}
acts({setupCancelTap,setupSkipTap,setupBackTap,setupNextTap,setupDayTap,setupSwTap,setupVestPick,setupGeoTap,setupCityType,setupCityKey,setupFindTap,
  setupCityTap,setupUnitTap,setupLinkKey,setupConnectTap,setupAddTap,wemptyImportTap,wemptySampleTap,
  setupAgainTap});
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('setup-shown',setupShown);serve('setup-finish',setupFinish);serve('setup-sample',setupSample);serve('setup-conn-draw',()=>{if(setupShown()&&/^(connect|done)$/.test(SETUP_STEPS[setup.at]))setupDraw()});serve('setup-ward-empty',setupWardEmpty);serve('tz-country',tzCountry);
serve('setup-today',setupToday);serve('setup-start',setupStart);   // the restructure S6f: what required and today-no-picture files ask of this file
