// index.html's own controls through data-act (Round C, wave C2-4, 2026-11-18): the header, the tabs, the Wardrobe's +, the Add page,
// the sheets' backdrops, the item sheet's bar and everything written into Settings' markup. Chromium and WebKit, with touch.
// Each control is tapped, changed, focused or typed into as a person does. The functions the markup called by name are wrapped first
// (window.<name>, which an inline handler and a data-act handler both reach), so each step can say which one ran first, with which
// arguments, and that it ran before a listener on document; where it is safe the real function then runs and the step also checks
// what the app did. Nothing here reads a handler attribute: controls are found by id, class or place, so this file passes unchanged
// on the app from before the move (run there to prove the same calls, arguments and effects).
// The backdrops are <div>s: a tap on one is a click only while it has a click listener of its own (act.js actTaps). Without it the tap
// on What to buy's backdrop went to the sheet's head on Chromium, and the tap on Settings' backdrop was no click on WebKit.
const fs=require('fs'),path=require('path');
const CONTROL=/^(button|a|input|select|textarea|summary)$/;   // act.js ACT_CONTROL: these take a tap without a click handler of their own
module.exports=async({ok,engines,url,settle,ROOT})=>{
  /* a click's data-act on anything else needs act.js's actTaps: index.html's are covered at load; a script that writes one must call it */
  const odd=[],html=[];
  for(const f of [...fs.readdirSync(ROOT).filter(f=>f.endsWith('.js')&&f!=='act.js'),'index.html']){const s=fs.readFileSync(path.join(ROOT,f),'utf8');
    // (the click's attribute only: a pointerdown, a key or a change reaches any element)
    for(const m of s.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*?\sdata-act="([^"]*)"/g))if(!CONTROL.test(m[1].toLowerCase())){
      if(f==='index.html')html.push(m[2]);else if(!/\bactTaps\(/.test(s))odd.push(`${f}: <${m[1]}> ${m[2]}`)}}
  ok(html.sort().join()==='colBackdropTap,itemCloseTap,npsCloseTap,pickBackdropTap,setBackdropTap,shopBackdropTap',`index.html's data-act elements that aren't controls by their tag are the six backdrops (${html.join(', ')})`);
  ok(!odd.length,'no script writes a data-act onto an element that isn’t a control without calling actTaps (a phone’s tap there would be no click)'+(odd.length?': '+odd.join('; '):''));
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
/* the functions index.html's controls call: true = the real one runs too, false = only noted (the network, a download, a reload) */
const FN={cycleTheme:true,openSettings:true,closeSettings:true,saveSettings:true,subBack:true,openAdd:true,goToday:true,show:true,closePicker:true,
  closeColPick:true,closeShop:true,closeItem:true,stepItem:true,openPack:true,toggleCat:true,setVestMode:true,setDarkShirts:true,setUnits:true,
  setLaundryDays:true,advToggle:true,addManual:true,npsCancel:true,addDayOff:true,addFormalDay:true,askDelete:true,replanButton:true,
  setHolidayCountry:true,checkForUpdate:true,updateNow:true,sendFeedback:true,   // (the real ones run: the holiday service is refused below, Send has no connection, Update returns at once: aboutUpdating)
  useMyLocation:true,   // (the real one runs since weather.js is a module, so the handler's own line still runs here; the phone's location is stood in for below)
  addFiles:false,addLink:false,pasteFromClipboard:false,kitImportOpen:false,findCity:false,
  startItemPics:false,syncTap:false,downloadBackup:false,restoreBackup:false,loadSnapshots:false,rollBack:false,
  setupOpen:false,tourAgain:false,homeAgain:false};
/* The functions above whose file is an ES module now (the bridge, tests/bridge.test.js). A module's handler calls its own function
   inside the module, where a wrapped window.<name> isn't seen, so these are watched one step earlier, at the handler the markup names
   (ACTS, act.js): function -> {handler: how the handler calls it}: '' with no argument; 'enter' with none and only for the Enter key,
   whose default it prevents; 'file' with the field's file, the field then emptied; 'value' with the control's value; 'n' with the
   control's data-n as a number; 'true' with true.
   With true above the real handler then runs (the step checks what the app did); with false the wrapper stands in for the handler, so
   for those this file no longer runs the handler's own line: theme.test.js, paste.test.js (Enter, Add, Paste), syncwrite.test.js and
   sync.test.js (Download backup, Restore file), rollback.test.js (the list's focus), itempics.test.js ("Generate item pictures", a
   real click, then the question's OK: photos.js itemPicsTap) and setup.test.js ("Run setup again", a real
   click) use the real ones; the city search's (weather.js cityKey, citySearchTap: the real findCity would ask the geocoding
   service) are run by setup.test.js (Enter) and by acts.test.js and weather.test.js (Search), each answering the service itself.
   history.js's two run for real here on both engines: the picker's backdrop (pickBackdropTap, closePicker) and "Start the plan over"
   (replanTap, replanButton, which history.js doesn't bridge: the step answers its question with Cancel).
   window.<name> is wrapped as well where the module bridges it, for the scripts that call it as a global (settings.js:
   loadSnapshots; setup.js: setUnits, findCity, useMyLocation).
   addManual and npsCancel (add-sheet.js, both true above): the real handlers still run here, and the steps check that the sheet
   opened and closed; addsheet.test.js and additemacts.test.js tap the same controls with nothing wrapped. */
const VIA={cycleTheme:{themeTap:''},addLink:{linkKey:'enter',linkAddTap:''},pasteFromClipboard:{pasteTap:''},
  downloadBackup:{backupSaveTap:''},restoreBackup:{backupFilePick:'file'},loadSnapshots:{snapFocus:''},rollBack:{rollBackTap:''},
  closeItem:{itemCloseTap:''},stepItem:{itemStepTap:'n'},openPack:{packOpenTap:''},setupOpen:{setupAgainTap:'true'},
  setUnits:{unitsPick:'value'},findCity:{cityKey:'enter',citySearchTap:''},useMyLocation:{myLocTap:''},
  addManual:{addManualTap:''},npsCancel:{npsCloseTap:''},
  closePicker:{pickBackdropTap:''},replanButton:{replanTap:''},startItemPics:{itemPicsTap:''},
  closeShop:{shopBackdropTap:''},addDayOff:{dayOffAddTap:''},addFormalDay:{occAddTap:''},setHolidayCountry:{countryPick:'value'},
  askDelete:{delAskTap:''},checkForUpdate:{updCheckTap:'true'},updateNow:{updNowTap:''},sendFeedback:{fbSendTap:''},
  setLaundryDays:{laundryPick:'value'},
  kitImportOpen:{importOpenTap:''},tourAgain:{tourAgainTap:''},homeAgain:{homeAgainTap:''}};
const CATS=['laundry','schedule','daysoff','calendar','weather','care','photos','tagging','backup','connection','about'];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ';
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium',locale:'en-US'});
  await ctx.route(u=>!u.href.startsWith(new URL(url).origin+'/'),r=>r.abort());   // nothing leaves the test server
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(([FN,VIA])=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white'),I('shirt','lightblue'),
      I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','grey'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf'})];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';settings.setupDone=1;settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.location=null;
    cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today');
    /* what ran: each wrapped function says its name and arguments; document and window say when a click or a key reached them */
    window.__calls=[];
    // "Use my location" runs the real useMyLocation (weather.js): the phone's location service is stood in for, and never answers
    {const f0=window.fetch;window.fetch=(u,...a)=>/date\.nager\.at/.test(String(u))?Promise.reject(new TypeError('no network')):f0(u,...a)}   // the real setHolidayCountry runs: no holiday service is reached
    try{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(){window.__geo=(window.__geo||0)+1}}})}catch(e){}
    const fmt=v=>v instanceof Element?'<'+v.tagName.toLowerCase()+(v.id?'#'+v.id:v.className?'.'+String(v.className).split(' ')[0]:'')+'>'
      :v instanceof File?'file:'+v.name:Array.isArray(v)&&v.length&&v.every(x=>x instanceof File)?'files:'+v.length:JSON.stringify(v);
    for(const n of Object.keys(FN)){const f=window[n],via=VIA[n];
      if(via)for(const h of Object.keys(via)){const real=ACTS[h],how=via[h];   // a module's function: watched at its handler
        if(typeof real!=='function'){window.__calls.push('missing:'+n+' ('+h+')');continue}
        ACTS[h]=function(el,ev){if(how==='enter'&&ev.key!=='Enter')return real(el,ev);
          const a=how==='file'?[el.files[0]]:how==='value'?[el.value]:how==='n'?[+el.dataset.n]:how==='true'?[true]:[];window.__calls.push(`${n}(${a.map(fmt).join(',')})`);
          if(FN[n])return real(el,ev);
          if(how==='enter')ev.preventDefault();if(how==='file')el.value=''}}
      if(typeof f!=='function'){if(!via)window.__calls.push('missing:'+n);continue}
      window[n]=function(...a){
        window.__calls.push(n==='addFiles'?`addFiles(${fmt(a[0])},${a[1]?'several':'one'})`:`${n}(${a.map(fmt).join(',')})`);
        return FN[n]?f.apply(this,a):undefined}}
    document.addEventListener('click',()=>window.__calls.push('doc:click'));
    window.addEventListener('keydown',e=>window.__calls.push('key:'+e.key+':'+(e.defaultPrevented?'prevented':'default')))},[FN,VIA]);
  // the controls shown only to a connected phone, and the folds shown only to the person who runs the server, are shown here without a server
  await p.addStyleTag({content:'html body.nocon .conn-only,html body .connhide,html body #adv-connection,html body #adv-photos{display:block!important}'});
  await settle(p,300);
  ok(!(await p.evaluate(()=>window.__calls.filter(x=>/^missing/.test(x)).join())),T+'every function index.html’s controls call is there to be watched');
  const reset=()=>p.evaluate(()=>{window.__calls.length=0});
  const calls=()=>p.evaluate(()=>window.__calls.slice());
  const tap=async sel=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap()};
  const tapAt=(sel,x,y)=>p.locator(sel).tap({position:{x,y}});   // a backdrop, where it shows beside or above its sheet
  const until=(f,a)=>p.waitForFunction(f,a,{timeout:5000}).catch(()=>{});
  /* one step: do it, then the first function that ran must be `want`, before document heard the click; `eff` (optional) is what the app did */
  const step=async(what,doIt,want,eff)=>{await reset();await doIt();await until(w=>window.__calls.includes(w),want);if(eff)await until(eff.f,eff.a);
    const c=await calls(),fn=c.filter(x=>!/^(doc|key):/.test(x)),i=c.indexOf(want),d=c.indexOf('doc:click');
    const done=eff?await p.evaluate(eff.f,eff.a):true;
    const good=fn[0]===want&&(d<0||i<d)&&!!done;
    ok(good,T+what+' ('+(fn[0]||'nothing ran')+(eff?', effect '+!!done:'')+')'+(good?'':' ['+c.join(' ')+']'));return c};
  const E=(f,a)=>({f,a});

  /* ---- the header ---- */
  const th0=await p.evaluate(()=>document.querySelector('#theme-btn').getAttribute('aria-label'));
  await step('a tap on the header’s theme button changes the theme',()=>tap('#theme-btn'),'cycleTheme()',E(t=>document.querySelector('#theme-btn').getAttribute('aria-label')!==t,th0));
  await step('a tap on the header’s gear opens Settings',()=>tap('header .hbtns button:nth-child(2)'),'openSettings()',E(()=>settingsOpen()));
  await settle(p,500);

  /* ---- Settings: each category's head opens and closes it ---- */
  for(const k of CATS){
    await step(`a tap on the ${k} category’s head opens it`,()=>tap(`#sc-${k} .scat-head`),`toggleCat("${k}")`,E(k=>{const s=document.querySelector('#sc-'+k);return s.classList.contains('open')&&s.querySelector('.scat-head').getAttribute('aria-expanded')==='true'},k));
    await settle(p,550);
    if(k==='schedule'){
      await step('choosing "Every suit day" for the Suit vest sets it',()=>p.selectOption('#cfg-vest','always'),'setVestMode("always")',E(()=>settings.vestMode==='always'));
      await step('choosing "Often" for Dark shirts sets it',()=>p.selectOption('#cfg-dark','often'),'setDarkShirts("often")',E(()=>settings.darkShirts==='often'));
      // (the real one runs: it asks, or says there is nothing to start over; the question is answered with Cancel, so nothing is planned again)
      await step('a tap on "Start the plan over" asks to start it over',()=>tap('#replan-btn'),'replanButton()',E(()=>document.querySelector('#ask-sheet').classList.contains('on')||/^Nothing to start over/.test(document.querySelector('#replan-status').textContent)));
      if(await p.evaluate(()=>!!document.querySelector('#ask-sheet.on #ask-cancel'))){await tap('#ask-cancel');await until(()=>!document.querySelector('#ask-sheet').classList.contains('on'));await settle(p,300)}}
    if(k==='daysoff'){
      const cc=await p.evaluate(()=>{const o=[...document.querySelector('#cfg-country').options].find(o=>o.value);return o&&o.value});
      await step(`choosing a country (${cc}) for public holidays sets it`,()=>p.selectOption('#cfg-country',cc),`setHolidayCountry("${cc}")`,E(c=>!!settings.holidays&&settings.holidays.country===c,cc));
      await p.fill('#cfg-off-from','2026-12-24');
      await step('a tap on Add under "Your own days off" adds the day',()=>tap('#sp-daysoff .offadd button'),'addDayOff()',E(()=>(settings.daysOff||[]).some(x=>x.d==='2026-12-24')&&!!document.querySelector('#off-list button')));
      await p.fill('#cfg-formal-date','2026-11-18');
      await step('a tap on Add under Occasions makes the date a formal day',()=>tap('#occ-add'),'addFormalDay()',E(()=>!!(dayRecs['2026-11-18']&&dayRecs['2026-11-18'].formal)&&document.querySelectorAll('#formal-list .fchip').length===1))}
    if(k==='weather'){
      await p.fill('#cfg-city','Springfield');
      const c=await step('Enter in the city field searches',()=>p.press('#cfg-city','Enter'),'findCity()');
      ok(c.includes('key:Enter:prevented'),T+'and the key does nothing else (its default is prevented)');
      await reset();await p.press('#cfg-city','a');await settle(p,80);
      const c2=await calls();ok(c2.join()==='key:a:default'&&await p.inputValue('#cfg-city')==='Springfielda',T+'another key in the city field is just typed ('+c2.join()+')');
      await step('a tap on Search searches',()=>tap('#sp-weather .sform button'),'findCity()');
      await step('a tap on "Use my location" asks for it',()=>tap('#wx-section > .sactions button'),'useMyLocation()');
      ok(await p.evaluate(()=>window.__geo===1),T+'and the real useMyLocation asks the phone for its location, once');
      await step('choosing °C for Units sets it',()=>p.selectOption('#cfg-units','C'),'setUnits("C")',E(()=>settings.units==='C'))}
    if(k==='care'){
      const v=await p.evaluate(()=>{const s=document.querySelector('#cfg-laundry'),o=[...s.options].find(o=>o.value!==s.value&&+o.value>0);return o.value});
      await step(`choosing ${v} days for "A worn shirt waits" sets it`,()=>p.selectOption('#cfg-laundry',v),`setLaundryDays("${v}")`,E(v=>settings.laundryDays===+v,v))}
    if(k==='photos'){
      await p.evaluate(()=>{document.querySelector('#itempic-btn').disabled=false});
      await step('a tap on "Generate item pictures" starts them',()=>tap('#itempic-btn'),'startItemPics()');
      await step('a tap on Outfit pictures’ Advanced head opens the fold',()=>tap('#adv-photos .adv-head'),'advToggle(<button.adv-head>)',E(()=>document.querySelector('#adv-photos').classList.contains('open')&&document.querySelector('#adv-photos .adv-head').getAttribute('aria-expanded')==='true'))}
    if(k==='backup'){
      await p.evaluate(()=>{document.querySelector('#snap-btn').disabled=false});
      await step('a tap on "Sync now" syncs',()=>tap('#sp-backup button.conn-only'),'syncTap()');
      await step('a tap on "Download backup" makes the file',()=>tap('#sp-backup .sactions button:not(.conn-only)'),'downloadBackup()');
      await step('a file picked with "Restore file" is restored',()=>p.setInputFiles('#sp-backup input[type=file]',{name:'wardrobe.json',mimeType:'application/json',buffer:Buffer.from('{}')}),'restoreBackup(file:wardrobe.json)');
      ok(await p.evaluate(()=>{const i=document.querySelector('#sp-backup input[type=file]');return i.value===''&&i.files.length===0}),T+'and the field is emptied, so the same file can be picked again');
      await p.evaluate(()=>{if(document.activeElement)document.activeElement.blur()});
      await step('the Daily backups list loads its days when it gets the focus',()=>p.focus('#snap-list'),'loadSnapshots()');
      await p.evaluate(()=>document.activeElement.blur());
      await step('a tap on "Roll back" rolls back',()=>tap('#snap-btn'),'rollBack()')}
    if(k==='connection'){
      await step('a tap on Connection’s Advanced head opens the fold',()=>tap('#adv-connection .adv-head'),'advToggle(<button.adv-head>)',E(()=>document.querySelector('#adv-connection').classList.contains('open')));
      await settle(p,300);
      await step('and a second tap closes it',()=>tap('#adv-connection .adv-head'),'advToggle(<button.adv-head>)',E(()=>!document.querySelector('#adv-connection').classList.contains('open')))}
    if(k==='about'){
      await p.evaluate(()=>{document.querySelector('#about-update').hidden=false;document.querySelector('#fb-send').disabled=false});
      await step('a tap on "Check for updates" checks',()=>tap('#about-check'),'checkForUpdate(true)');
      await until(()=>document.querySelector('#about-status').textContent!=='Checking…');   // (the real check's answer redraws the Update button)
      await p.evaluate(()=>{document.querySelector('#about-update').hidden=false;aboutUpdating=true});   // the real updateNow returns at once: it would restart the page
      await step('a tap on Update updates',()=>tap('#about-update'),'updateNow()');
      await p.evaluate(()=>{aboutUpdating=false});
      await p.fill('#fb-text','A note');
      await step('a tap on the feedback’s Send sends it',()=>tap('#fb-send'),'sendFeedback()');
      await step('a tap on "Delete my data" asks first',()=>tap('#del-open'),'askDelete()',E(()=>!document.querySelector('#del-confirm').hidden));
      await p.evaluate(()=>{document.querySelector('#del-confirm').hidden=true;document.querySelector('#del-confirm').innerHTML='';document.querySelector('#del-open').hidden=false})}
    await step(`a second tap on the ${k} category’s head closes it`,()=>tap(`#sc-${k} .scat-head`),`toggleCat("${k}")`,E(k=>{const s=document.querySelector('#sc-'+k);return !s.classList.contains('open')&&s.querySelector('.scat-head').getAttribute('aria-expanded')==='false'},k));
    await settle(p,550)}

  /* ---- Settings: the buttons under the categories, the Packing list link, Done and the backdrop ---- */
  await p.evaluate(()=>{document.querySelector('#home-again').hidden=false});
  await step('a tap on "Run setup again" opens the setup',()=>tap('#setup-again'),'setupOpen(true)');
  await step('a tap on "Take the tour" opens the tour',()=>tap('#tour-again'),'tourAgain()');
  await step('a tap on "Add to Home Screen" shows how',()=>tap('#home-again'),'homeAgain()');
  await step('a tap on the Packing list link opens the Packing list over Settings’ place',()=>tap('#pack-btn'),'openPack()',E(()=>!settingsOpen()&&!document.querySelector('#pack').hidden));
  await settle(p,400);
  await tap('header .hbtns button:nth-child(2)');await until(()=>settingsOpen());await settle(p,500);
  await p.selectOption('#cfg-vest','never').catch(()=>{});
  await step('a tap on Done closes Settings',()=>tap('#settings-modal .sdone'),'saveSettings()',E(()=>!settingsOpen()));
  await settle(p,400);
  await p.setViewportSize({width:1200,height:800});await settle(p,200);
  await tap('header .hbtns button:nth-child(2)');await until(()=>settingsOpen());await settle(p,500);
  ok(await p.evaluate(()=>document.elementFromPoint(6,400).id)==='modal-backdrop',T+'on a wide screen Settings’ backdrop shows beside it');
  await step('a tap on Settings’ backdrop closes Settings',()=>tapAt('#modal-backdrop',6,400),'closeSettings()',E(()=>!settingsOpen()));
  await p.setViewportSize({width:390,height:844});await settle(p,400);

  /* ---- the tabs, the Wardrobe's + and the Add page ---- */
  await step('a tap on the Wardrobe tab shows the Wardrobe',()=>tap('#n-wardrobe'),'show("wardrobe")',E(()=>!document.querySelector('#wardrobe').hidden&&document.querySelector('#today').hidden));
  await step('a tap on the Insights tab shows Insights',()=>tap('#n-stats'),'show("stats")',E(()=>!document.querySelector('#stats').hidden&&document.querySelector('#wardrobe').hidden));
  await step('a tap on the Today tab shows today',()=>tap('#n-today'),'goToday()',E(()=>!document.querySelector('#today').hidden&&document.querySelector('#stats').hidden));
  await tap('#n-wardrobe');await until(()=>!document.querySelector('#wardrobe').hidden);await settle(p,400);
  await step('a tap on the Wardrobe’s round + opens Add',()=>tap('#ward-add'),'openAdd()',E(()=>!document.querySelector('#add').hidden));
  await settle(p,400);
  await step('a tap on Add’s ‹ goes back to the Wardrobe',()=>tap('#add .pback'),'subBack()',E(()=>document.querySelector('#add').hidden&&!document.querySelector('#wardrobe').hidden));
  await settle(p,400);
  await tap('#ward-add');await until(()=>!document.querySelector('#add').hidden);await settle(p,600);
  const pic={name:'a.png',mimeType:'image/png',buffer:PNG};
  await step('a photo picked with "One item" is added as one item',()=>p.setInputFiles('#add-one input[type=file]',pic),'addFiles(files:1,one)');
  ok(await p.evaluate(()=>{const i=document.querySelector('#add-one input');return i.value===''&&i.files.length===0}),T+'and the field is emptied');
  await p.evaluate(()=>{document.querySelector('#add-group input').disabled=false});   // (switched off while not connected)
  await step('two photos picked with "Several items" are read for several items each',()=>p.setInputFiles('#add-group input[type=file]',[pic,{...pic,name:'b.png'}]),'addFiles(files:2,several)');
  ok(await p.evaluate(()=>{const i=document.querySelector('#add-group input');return i.value===''&&i.files.length===0}),T+'and that field is emptied too');
  await p.fill('#photo-url','https://example.com/a.jpg');
  const lk=await step('Enter in the "Photo or link" field adds the link',()=>p.press('#photo-url','Enter'),'addLink()');
  ok(lk.includes('key:Enter:prevented'),T+'and the key does nothing else (its default is prevented)');
  await reset();await p.press('#photo-url','End');await p.keyboard.type('x');await settle(p,80);
  const lk2=await calls();ok(!lk2.some(x=>/^addLink/.test(x))&&lk2.includes('key:x:default')&&/x$/.test(await p.inputValue('#photo-url')),T+'another key there is just typed ('+lk2.join()+')');
  await step('a tap on Paste reads the clipboard',()=>tap('#add .paste-box .btn:not(.pri)'),'pasteFromClipboard()');
  await step('a tap on Add beside the field adds the link',()=>tap('#add .paste-box .btn.pri'),'addLink()');
  await step('a tap on "Import from a spreadsheet" opens the import',()=>tap('#add-import'),'kitImportOpen()');
  await settle(p,700);   // (Add's guard against a second tap in the same place)
  await step('a tap on "Add without a photo" opens its sheet',()=>tap('#add-manual'),'addManual()',E(()=>document.querySelector('#nps-sheet').classList.contains('on')));
  await settle(p,700);
  await step('a tap on the sheet’s ✕ closes it',()=>tap('#nps-sheet .nps-x'),'npsCancel()',E(()=>!document.querySelector('#nps-sheet').classList.contains('on')));
  await settle(p,700);
  await tap('#add-manual');await until(()=>document.querySelector('#nps-sheet').classList.contains('on'));await settle(p,700);
  ok(await p.evaluate(()=>document.elementFromPoint(195,20).id)==='nps-backdrop',T+'the sheet’s backdrop shows above it');
  await step('a tap on the sheet’s backdrop closes it',()=>tapAt('#nps-backdrop',195,20),'npsCancel()',E(()=>!document.querySelector('#nps-sheet').classList.contains('on')));
  await settle(p,500);

  /* ---- the sheets' backdrops and the item sheet's bar ---- */
  await tap('#n-today');await until(()=>!document.querySelector('#today').hidden);await settle(p,400);
  await p.evaluate(()=>openPicker('tie'));await until(()=>document.querySelector('#pick-sheet').classList.contains('on'));await settle(p,500);
  await step('a tap on the piece picker’s backdrop closes the picker',()=>tapAt('#pick-backdrop',195,20),'closePicker()',E(()=>!document.querySelector('#pick-sheet').classList.contains('on')));
  await settle(p,400);
  await p.evaluate(()=>openShop());await until(()=>document.querySelector('#shop-sheet').classList.contains('on'));await settle(p,600);
  const shopAt=await p.evaluate(()=>document.querySelector('#shop-sheet').classList.contains('on')&&document.elementFromPoint(195,4).id);
  ok(shopAt==='shop-backdrop',T+'What to buy opens with its backdrop showing above it ('+shopAt+')');
  await step('a tap on What to buy’s backdrop closes it',()=>tapAt('#shop-backdrop',195,5),'closeShop()',E(()=>!document.querySelector('#shop-sheet').classList.contains('on')));
  await settle(p,500);
  await tap('#n-wardrobe');await until(()=>!document.querySelector('#wardrobe').hidden);await settle(p,400);
  await p.evaluate(()=>{CK_OPEN['*']=true;openItem(items[0].id)});await until(()=>document.body.classList.contains('iv-on'));await settle(p,700);
  const t0=await p.evaluate(()=>document.querySelector('#iv-title').textContent);
  await step('a tap on the item sheet’s next button shows the next item',()=>tap('#iv-next'),'stepItem(1)',E(t=>document.querySelector('#iv-title').textContent!==t,t0));
  await settle(p,600);
  await step('a tap on its previous button goes back to the first',()=>tap('#iv-prev'),'stepItem(-1)',E(t=>document.querySelector('#iv-title').textContent===t,t0));
  await settle(p,600);
  await tap('#item-view .colbtn[data-k="primaryColor"]');await until(()=>document.querySelector('#col-sheet').classList.contains('on'));await settle(p,600);
  const colAt=await p.evaluate(()=>document.querySelector('#col-sheet').classList.contains('on')&&document.elementFromPoint(195,20).id);
  ok(colAt==='col-backdrop',T+'the color sheet opens with its backdrop showing above it ('+colAt+')');
  await step('a tap on the color sheet’s backdrop closes it',()=>tapAt('#col-backdrop',195,20),'closeColPick()',E(()=>!document.querySelector('#col-sheet').classList.contains('on')&&document.body.classList.contains('iv-on')));
  await settle(p,500);
  await step('a tap on the item sheet’s Done closes it',()=>tap('#item-view .ivdone'),'closeItem()',E(()=>!document.body.classList.contains('iv-on')));
  await settle(p,600);
  await p.evaluate(()=>openItem(items[0].id));await until(()=>document.body.classList.contains('iv-on'));await settle(p,700);
  ok(await p.evaluate(()=>document.elementFromPoint(195,4).id)==='item-backdrop',T+'the item sheet’s backdrop shows above it');
  await step('a tap on the item sheet’s backdrop closes it',()=>tapAt('#item-backdrop',195,5),'closeItem()',E(()=>!document.body.classList.contains('iv-on')));
  await settle(p,400);
  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await ctx.close();
}
