/* Daily Wardrobe: first-run setup (a full-screen flow in the style of Settings) and the empty states of Today and the Wardrobe.
   Loaded after app.js and sync.js; everything it stores goes through the existing settings functions. */
const SETUP_STEPS=['welcome','week','wear','weather','connect','done'];
const SETUP_TITLES={welcome:'Welcome',week:'Your week',wear:'What you wear',weather:'Weather',connect:'Connection',done:'All set'};
/* the flow's state: at = the step shown (-1 = closed); first = it opened by itself on a new install (not "Run setup again") */
let setup={at:-1,first:false,vestSet:false,q:'',cities:null,cityMsg:'',msg:'',busy:false,watch:null};
let setupNo=false;   // the app was already driven somewhere before start-up looked: the setup doesn't open by itself

/* the dress code (the planner reads the same object): a missing object or key means yes */
const setupDress=()=>({jacket:!(settings.dress&&settings.dress.jacket===false),tie:!(settings.dress&&settings.dress.tie===false)});
const setupConnected=()=>!!(localStorage.getItem('worker_url')&&localStorage.getItem('app_token'));
const setupShown=()=>setup.at>=0;

/* start-up, once the wardrobe, history and settings are read: a new install (nothing in the wardrobe, no day ever recorded,
   setup never finished) gets the setup; someone with items is marked as done without a word (kept with the next settings change:
   saving here would count as a change on the device and make the next sync a full one) */
function setupStart(){
  if(settings.setupDone)return;
  if(items.length){settings.setupDone=Date.now();return}
  if(setupNo||!setupAuto()||Object.keys(dayRecs).length||settingsOpen()||!$('#today')||$('#today').hidden)return;
  setupOpen(false);
}
/* a browser driven by a test program (navigator.webdriver) starts like a new install every time, and nearly every test then
   works on the page straight away: there the setup opens by itself only when the test asks (window.SETUP_AUTO, set before load) */
const setupAuto=()=>!navigator.webdriver||window.SETUP_AUTO===true;
function setupEl(){let e=$('#setup');
  if(!e){e=document.createElement('div');e.id='setup';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-labelledby','su-title');e.tabIndex=-1;document.body.appendChild(e)}
  return e}
function setupInert(on){if(!on&&typeof layerInert==='function')return layerInert();   // closing: the page stays inert while Settings or a sheet is up (ui.js)
  for(const s of['header','main','nav']){const el=$(s);if(el)el.inert=on}}
function setupOpen(again){
  closeSettings();
  setup={at:0,first:!again,vestSet:false,q:'',cities:null,cityMsg:'',msg:'',busy:false,watch:null};
  setupInert(true);setupEl().classList.add('on');setupDraw();setupEl().focus({preventScroll:true});
}
function setupClose(){
  if(setup.watch)clearInterval(setup.watch);setup.watch=null;setup.at=-1;
  const e=$('#setup');if(e){e.classList.remove('on');e.innerHTML=''}setupInert(false);
}
/* Skip (stay on Today) and Done (go and add the first item) both finish it for good.
   A new person who didn't choose gets no vest: the stored default is the three-piece suit on cooler days. */
function setupFinish(toAdd){
  if(setup.first&&!setup.vestSet)settings.vestMode='never';
  const first=setup.first;settings.setupDone=Date.now();setupClose();saveUserSettings().then(()=>{if(first)setupHolidays()});
  if(toAdd&&!items.length){show('wardrobe');openAdd()}else show('today');   // Add is a page of the Wardrobe: its ‹ goes there
}
/* the public holidays of the country the phone's time zone is in, chosen for a new person (audit 2026-11-13: the work week was set,
   the holidays were not); Settings → Days off changes it. Without a list yet (Nager.Date lacks the Gulf states, whose list comes from
   the server once connected) the country is kept with an empty list, fetched 0, so the monthly refetch (refreshHolidays) tries again */
const TZ_CC={'Asia/Kuwait':'KW','Asia/Riyadh':'SA','Asia/Dubai':'AE','Asia/Qatar':'QA','Asia/Bahrain':'BH','Asia/Muscat':'OM','Asia/Baghdad':'IQ','Asia/Amman':'JO','Asia/Beirut':'LB','Africa/Cairo':'EG','Asia/Karachi':'PK','Asia/Kolkata':'IN','Asia/Calcutta':'IN','Asia/Singapore':'SG','Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Shanghai':'CN','Asia/Hong_Kong':'HK','Australia/Sydney':'AU','Australia/Melbourne':'AU','Pacific/Auckland':'NZ',
  'Europe/London':'GB','Europe/Dublin':'IE','Europe/Paris':'FR','Europe/Berlin':'DE','Europe/Madrid':'ES','Europe/Rome':'IT','Europe/Amsterdam':'NL','Europe/Brussels':'BE','Europe/Zurich':'CH','Europe/Vienna':'AT','Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Copenhagen':'DK','Europe/Helsinki':'FI','Europe/Warsaw':'PL','Europe/Lisbon':'PT','Europe/Athens':'GR','Europe/Istanbul':'TR','Europe/Moscow':'RU',
  'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Phoenix':'US','America/Los_Angeles':'US','America/Anchorage':'US','Pacific/Honolulu':'US','America/Toronto':'CA','America/Vancouver':'CA','America/Mexico_City':'MX','America/Sao_Paulo':'BR','America/Argentina/Buenos_Aires':'AR','Africa/Johannesburg':'ZA','Africa/Lagos':'NG','Africa/Nairobi':'KE'};
function tzCountry(){let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch{}
  if(TZ_CC[tz])return TZ_CC[tz];const m=/-([A-Z]{2})$/.exec(navigator.language||'');return m&&typeof COUNTRY_CODES!=='undefined'&&COUNTRY_CODES.includes(m[1])?m[1]:null}
async function setupHolidays(){if(settings.holidays&&settings.holidays.country)return;const cc=tzCountry();if(!cc)return;
  try{await setHolidayCountry(cc,true)}catch(e){console.warn('holidays not loaded',e)}
  if(!(settings.holidays&&settings.holidays.country)){settings.holidays={country:cc,list:[],skip:[],fetched:0};await saveUserSettings()}}
/* the app is being driven past a setup that opened by itself (items came in from a sync or a restore, another page was
   opened): it steps aside without being marked as done. One the user started from Settings stays. */
function setupYield(t){
  if(!setupShown()){if(items.length||(t&&t!=='today'))setupNo=true;return}
  if(setup.first&&(items.length||(t&&t!=='today')))setupClose();
}
/* a city search left unfinished (typed, searching, or results not picked) is said once before Next leaves the Weather step: a new
   user tapped Next on "Searching…" and had no location (audit 2026-11-13); a second Next goes on */
function setupCityOpen(){return SETUP_STEPS[setup.at]==='weather'&&!setup.cityWarned&&(!!(setup.q||'').trim()||!!(setup.cities&&setup.cities.length)||setup.cityMsg==='Searching…')}
function setupGo(n){if(n>0&&setupCityOpen()){setup.cityWarned=true;
    setup.cityMsg=settings.location?`That city wasn’t picked: the weather stays ${settings.location.name}. Pick a result, or tap Next again to go on.`:'You haven’t picked a city yet: pick one of the results, or tap Next again to go on without a location.';
    setupDraw();const f=$('#su-city');if(f)f.focus({preventScroll:true});return}
  const at=setup.at+n;if(at<0)return;if(at>=SETUP_STEPS.length){setupFinish(true);return}
  if(setup.watch){clearInterval(setup.watch);setup.watch=null}
  setup.at=at;setup.msg='';setupDraw();const b=$('#setup .su-body');if(b)b.scrollTop=0}

/* ---- the steps ---- */
const setupSwitch=(k,on,title,sub)=>`<button type="button" class="su-sw" id="su-sw-${k}" role="switch" aria-checked="${on}" onclick="setupSetDress('${k}')"><span class="su-swt"><b>${title}</b><small>${sub}</small></span><i class="su-knob" aria-hidden="true"></i></button>`;
const setupDays=(kind,list,shown)=>`<div class="su-days" id="su-${kind}">${DAY_NAMES.map((n,i)=>shown.includes(i)?`<button type="button" class="su-day${list.includes(i)?' on':''}" aria-pressed="${list.includes(i)}" onclick="setupDay('${kind}',${i})">${n.slice(0,3)}</button>`:'').join('')}</div>`;
function setupStep(k){const d=setupDress();
  if(k==='welcome')return `<p class="su-lead">Daily Wardrobe picks what you wear each workday from the clothes you own.</p><p class="su-lead">It rotates your pieces so nothing is worn out or forgotten, and keeps the colours and patterns working together.</p><p class="su-help">A few short questions first. You can change every answer later in Settings.</p>`;
  if(k==='week')return `<div class="su-group"><div class="su-label">Workdays</div><p class="su-help">You get an outfit on these days.</p>${setupDays('workdays',settings.workdays,[0,1,2,3,4,5,6])}</div>`+
    (d.jacket?`<div class="su-group"><div class="su-label">Blazer days</div><p class="su-help">Business-casual days get a blazer and trousers; other workdays get a suit. Leave them all off for a suit every day.</p>${setupDays('blazer',settings.blazerDays,settings.workdays)}</div>`:'');
  if(k==='wear'){const v=setup.first&&!setup.vestSet?'never':(settings.vestMode||'auto');
    return `<p class="su-help">Outfits are planned around what you actually wear to work.</p>${setupSwitch('jacket',d.jacket,'Jackets','A suit or a blazer on workdays')}${setupSwitch('tie',d.tie,'Ties','A tie with every outfit')}`+
    (d.jacket?`<label class="su-row">Suit vest <select id="su-vest" onchange="setupVest(this.value)">${[['never','No vest'],['auto','On cooler suit days'],['always','Every suit day']].map(o=>`<option value="${o[0]}"${o[0]===v?' selected':''}>${o[1]}</option>`).join('')}</select></label>`:'')}
  if(k==='weather'){const u=unit(),loc=settings.location;
    return `<div class="su-group"><div class="su-label">Where you are</div><p class="su-help" id="su-loc">${loc?`<span class="su-tick" aria-hidden="true">✓</span> Weather for ${esc(loc.name)}.`:'With a location, outfits follow the forecast: lighter cloth on hot days, no suede in the rain. Without one they follow the calendar season.'}</p>
<div class="su-acts"><button type="button" id="su-geo" onclick="setupLocate()">Use my location</button></div>
<div class="su-form"><input type="text" id="su-city" placeholder="Search a city" aria-label="City" value="${esc(setup.q)}" oninput="setup.q=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();setupSearch()}"><button type="button" id="su-find" onclick="setupSearch()">Search</button></div>
<div class="su-acts" id="su-cities">${(setup.cities||[]).map((c,i)=>`<button type="button" onclick="setupPick(${i})">${esc(c.name)}</button>`).join('')}</div>${setup.cityMsg?`<p class="su-help" role="status">${esc(setup.cityMsg)}</p>`:''}</div>
<div class="su-group"><div class="su-label">Temperatures in</div><div class="su-days" id="su-units">${['C','F'].map(x=>`<button type="button" class="su-day${u===x?' on':''}" aria-pressed="${u===x}" onclick="setupUnits('${x}')">°${x}</button>`).join('')}</div></div>`}
  if(k==='connect')return setupConnected()?`<p class="su-ok" id="su-conn"><span class="su-tick" aria-hidden="true">✓</span> Connected</p><p class="su-help">Photos of your clothes are read automatically, outfit photos can be made, and your wardrobe is backed up.</p>`
    :`<p class="su-help">If you were given an invite link, paste it here. It turns on automatic reading of your photos, realistic outfit photos and a backup.</p>
<div class="su-form"><input type="text" id="su-link" placeholder="Paste your invite link" aria-label="Invite link" autocomplete="off" autocapitalize="off" spellcheck="false" onkeydown="if(event.key==='Enter'){event.preventDefault();setupConnect()}"><button type="button" id="su-connect" onclick="setupConnect()"${setup.busy?' disabled':''}>${setup.busy?'Connecting…':'Connect'}</button></div>
${setup.msg?`<p class="su-help su-err" role="alert">${esc(setup.msg)}</p>`:''}
<p class="su-note" id="su-without"><b>No link? The app works without one.</b> You then add your items by hand, picking the type and colours yourself: no automatic photo reading and no outfit photos. You can connect later in Settings.</p>`;
  /* in the Week step's order (Sunday first, as Settings shows them) */
  const days=l=>l.length?[...l].sort((a,b)=>a-b).map(i=>DAY_NAMES[i].slice(0,3)).join(', '):'none';
  /* trousers are needed only without a suit (the Today checklist says "not needed with a suit"): said as a condition, not as a must */
  const nd=setupNeeds(),opt=nd.find(n=>n.k==='pants'&&n.sub),must=nd.filter(n=>n!==opt).map(n=>n.short).join(', ').replace(/, ([^,]*)$/,' and $1');
  const wear=[d.jacket?'jackets':'no jackets',d.tie?'ties':'no ties'].join(', ');
  return `<p class="su-lead">${items.length?'That’s everything.':'That’s everything. Now add your clothes.'}</p>
<ul class="su-sum"><li><span>Workdays</span><b>${days(settings.workdays)}</b></li><li><span>You wear</span><b>${wear}</b></li><li><span>Weather</span><b>${settings.location?esc(settings.location.name):'by the calendar'} · °${unit()}</b></li><li><span>Connection</span><b>${setupConnected()?'connected':'not connected'}</b></li></ul>
${items.length?'':`<p class="su-help">Today shows your first outfit once you have ${must}${opt?', plus trousers if you wear a blazer rather than a suit':''}.</p>`}`;
}
function setupDraw(){if(!setupShown())return;const k=SETUP_STEPS[setup.at],n=SETUP_STEPS.length,last=setup.at===n-1;
  setupEl().innerHTML=`<div class="su-head"><div class="su-ttl"><h2 id="su-title">${SETUP_TITLES[k]}</h2><small id="su-count">Step ${setup.at+1} of ${n}</small></div>${last?'':`<button type="button" class="su-skip" id="su-skip" onclick="setupFinish(false)">Skip</button>`}</div>
<div class="su-prog" aria-hidden="true">${SETUP_STEPS.map((s,i)=>`<i class="${i<=setup.at?'on':''}"></i>`).join('')}</div>
<div class="su-body"><div class="su-in" id="su-step" data-step="${k}">${setupStep(k)}</div></div>
<div class="su-bar">${setup.at?`<button type="button" id="su-back" onclick="setupGo(-1)">Back</button>`:''}<button type="button" class="pri" id="su-next" onclick="setupGo(1)">${last?(items.length?'Done':'Add my first item'):setup.at?'Next':'Get started'}</button></div>`;
}

/* ---- what the steps store (all through the app's own settings functions) ---- */
function setupDay(kind,i){toggleDay(kind==='workdays'?'#cfg-workdays':'#cfg-blazer',i);setupDraw()}
function setupSetDress(k){const d=setupDress();d[k]=!d[k];settings.dress=d;clearLocks().then(saveUserSettings);setupDraw();const b=$('#su-sw-'+k);if(b)b.focus({preventScroll:true})}
function setupVest(v){setup.vestSet=true;setVestMode(v)}
function setupUnits(v){setUnits(v);setupDraw()}
/* the city search is the Settings one (findCity reads Settings' own field and keeps its answers in window._cities) */
async function setupSearch(){const q=(setup.q||'').trim();if(!q||!$('#cfg-city'))return;
  $('#cfg-city').value=q;window._cities=null;setup.cities=null;setup.cityMsg='Searching…';setupDraw();
  await findCity();if($('#city-results'))$('#city-results').innerHTML='';$('#cfg-city').value='';
  const res=window._cities;setup.cities=res||null;setup.cityMsg=!res?'City search is unavailable right now.':res.length?'':'No matches.';setupDraw()}
function setupPick(i){const c=(setup.cities||[])[i];if(!c)return;setup.cities=null;setup.cityMsg='';setup.q='';setLocation(c);setupDraw()}
/* useMyLocation answers later (the permission prompt): the step is drawn again once the location has changed */
function setupLocate(){const was=JSON.stringify(settings.location);useMyLocation();
  if(setup.watch)clearInterval(setup.watch);let n=0;
  setup.watch=setInterval(()=>{if(!setupShown()||++n>400){clearInterval(setup.watch);setup.watch=null;return}
    if(JSON.stringify(settings.location)!==was){clearInterval(setup.watch);setup.watch=null;setup.cities=null;setup.cityMsg='';setupDraw()}},150)}
/* an invite link is <app url>#invite=<code>&w=<the server's address, URL-encoded> */
function setupParseLink(t){const c=/[#&?]invite=([^&#\s]+)/.exec(t),w=/[#&?]w=([^&#\s]+)/.exec(t);if(!c||!w)return false;
  try{const url=decodeURIComponent(w[1]),code=decodeURIComponent(c[1]);if(!/^https?:$/.test(new URL(url).protocol)||!code)return false;
    localStorage.setItem('worker_url',url);localStorage.setItem('app_token',code);return true}catch{return false}}
async function setupConnect(){const el=$('#su-link'),t=(el&&el.value||'').trim();if(!t||setup.busy)return;
  setup.busy=true;setup.msg='';setupDraw();if($('#su-link'))$('#su-link').value=t;let ok=false;
  try{ok=typeof connectFromLink==='function'?!!(await connectFromLink(t)):setupParseLink(t)}catch(e){ok=false}
  setup.busy=false;setup.msg=ok?'':'That link didn’t work. Check that you copied all of it, or carry on without it.';
  if(!setupShown())return;setupDraw();if(!ok&&$('#su-link'))$('#su-link').value=t}

/* ---- Today with an empty or too-small wardrobe: what is still needed for a first outfit ---- */
function setupNeeds(){const d=setupDress(),has=t=>items.some(i=>i.type===t&&inRotation(i)),rows=[];
  if(d.jacket)rows.push({k:'jacket',t:'A suit or a blazer',short:'a suit or blazer',ok:has('suit')||has('blazer')});
  rows.push({k:'shirt',t:'A shirt',short:'a shirt',ok:has('shirt')});
  if(d.tie)rows.push({k:'tie',t:'A tie',short:'a tie',ok:has('tie')});
  if(!d.jacket||!has('suit'))rows.push({k:'pants',t:'Trousers',short:'trousers',sub:d.jacket?'not needed with a suit':'',ok:has('pants')});
  rows.push({k:'shoes',t:'Shoes',short:'shoes',ok:has('shoes')});
  return rows}
/* called by renderToday: the checklist card, or '' once an outfit can be planned (every row ticked) */
function setupToday(){
  if(items.length)setupYield();
  const rows=setupNeeds(),left=rows.filter(r=>!r.ok).length;if(!left)return '';
  return `<div class="firstrun" id="firstrun"><h3>Get your first outfit</h3><p class="fr-sub">${left===rows.length?'Add these and Today picks an outfit for every workday.':`${rows.length-left} of ${rows.length} added. Add the rest and Today picks an outfit for every workday.`}</p>
<ul class="fr-list">${rows.map(r=>`<li class="fr-it${r.ok?' done':''}" data-need="${r.k}"><span class="fr-tick" aria-hidden="true">${r.ok?'✓':''}</span><span class="fr-t">${r.t}${r.sub&&!r.ok?` <small>(${r.sub})</small>`:''}</span><small class="fr-st">${r.ok?'Added':r.sub?'If no suit':'Needed'}</small></li>`).join('')}</ul>
<button type="button" class="fr-add pri" id="fr-add" onclick="openAdd()">Add an item</button></div>`;
}
/* the Wardrobe tab with nothing in it */
function setupWardEmpty(){
  return `<div class="card wempty" id="wempty"><svg class="wempty-pic" viewBox="0 0 120 84" aria-hidden="true"><path class="we-rail" d="M8 12h104"/><path class="we-hook" d="M60 12v6a5 5 0 1 0 5 5"/><path class="we-hang" d="M60 30 24 52a4 4 0 0 0 2 7h68a4 4 0 0 0 2-7z"/><path class="we-ghost" d="M26 12v10M94 12v10M20 30l6-8 6 8M88 30l6-8 6 8"/></svg>
<b class="wempty-t">Your wardrobe is empty</b><p class="wempty-s">Add what you wear to work: a photo of each piece, or pick its type and colours by hand.</p>
<button type="button" class="pri" id="wempty-add" onclick="openAdd()">Add your first item</button></div>`;
}
