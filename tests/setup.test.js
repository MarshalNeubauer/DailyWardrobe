// The setup steps and their fixes.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/setup.test.js ---- */
// First-run setup and the empty states (setup.js): a new install gets a full-screen setup whose steps store the week, the dress
// code, the vest, the weather location and units and the connection; Skip and Done finish it for good; an install with items never
// sees it, and it steps aside when the app is driven past it. Today shows a checklist until an outfit can be planned, the empty
// Wardrobe a card with a button, and the Add tab's note speaks plainly.
const setup=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const open=async(opt={},init)=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...opt});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.route(/open-meteo\.com|nager\.at|example\.test/,r=>{const u=r.request().url();
      if(/geocoding-api/.test(u))return r.fulfill({contentType:'application/json',body:JSON.stringify({results:[{latitude:10.5,longitude:20.25,name:'Testville',admin1:'Test Region',country_code:'TT'}]})});
      return r.fulfill({contentType:'application/json',body:'{}'})});
    await p.addInitScript(()=>{window.SETUP_AUTO=true});   // a driven browser gets the setup by itself only when it asks (setupAuto)
    if(init)await p.addInitScript(init);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return p};
  const shown=p=>p.evaluate(()=>!!document.querySelector('#setup.on'));
  const step=p=>p.evaluate(()=>{const e=document.querySelector('#su-step');return e?e.dataset.step:null});
  const next=async(p,want)=>{await p.waitForTimeout(400);await p.click('#su-next');await p.waitForFunction(w=>{const e=document.querySelector('#su-step');return e&&e.dataset.step===w},want)};   // (the wait: past setupGoDouble's guard on the last tap)
  const stored=(p,f,arg)=>p.waitForFunction(`(async()=>{const s=await metaGet('settings');return !!s&&(${f})(s)})()`,arg,{timeout:10000}).then(()=>true,()=>false);
  const noSide=p=>p.evaluate(()=>{const d=document.documentElement,b=document.querySelector('#setup .su-body');
    const out=[...document.querySelectorAll('#setup.on button,#setup.on input,#setup.on select,#firstrun,#firstrun *,#wempty,#wempty *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-0.5||r.right>innerWidth+0.5)});
    return d.scrollWidth<=innerWidth&&(!b||b.scrollWidth<=b.clientWidth)&&!out.length});
  const I=`((id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:1,...x}))`;
  try{
    /* ---- a fresh install: the setup, step by step ---- */
    const p=await open({geolocation:{latitude:1.234,longitude:5.678},permissions:['geolocation']});
    ok(await shown(p)&&await step(p)==='welcome','a fresh install opens the setup on its Welcome step');
    const w=await p.evaluate(()=>({inert:['header','main','nav'].every(s=>document.querySelector(s).inert),lead:document.querySelectorAll('#su-step .su-lead').length,
      skip:!!document.querySelector('#su-skip'),back:!!document.querySelector('#su-back'),done:settings.setupDone,r:document.querySelector('#setup').getBoundingClientRect().toJSON(),vw:innerWidth,vh:innerHeight}));
    ok(w.inert&&w.r.width===w.vw&&w.r.height===w.vh,'it covers the whole phone screen and the page behind it is inert');
    ok(w.lead===2&&w.skip&&!w.back&&!w.done,'Welcome: two sentences on what the app does, Skip and no Back; nothing is marked done yet');
    const before=await p.evaluate(()=>({wd:[...settings.workdays],bl:[...settings.blazerDays]}));
    await next(p,'week');
    ok(await p.evaluate(b=>JSON.stringify(settings.workdays)===JSON.stringify(b.wd)&&document.querySelectorAll('#su-workdays .su-day.on').length===b.wd.length&&!!document.querySelector('#su-back'),before),'Your week: the stored workdays are shown as they are, and there is a Back');
    const free=[0,1,2,3,4,5,6].find(d=>!before.wd.includes(d));
    await p.click(`#su-workdays .su-day:nth-child(${free+1})`);
    ok(await stored(p,`s=>s.workdays.includes(${free})`),'tapping a day adds it to the stored workdays');
    ok(await p.evaluate(d=>document.querySelector(`#su-workdays .su-day:nth-child(${d+1})`).classList.contains('on')&&document.querySelectorAll('#su-blazer .su-day').length===settings.workdays.length,free),'the step shows it on, and blazer days offer the workdays');
    await p.click('#su-blazer .su-day:not(.on)');
    ok(await stored(p,`s=>s.blazerDays.length===${before.bl.length+1}`),'tapping a blazer day stores it');
    await next(p,'wear');
    const wear0=await p.evaluate(()=>({j:document.querySelector('#su-sw-jacket').getAttribute('aria-checked'),t:document.querySelector('#su-sw-tie').getAttribute('aria-checked'),v:document.querySelector('#su-vest').value,dress:settings.dress}));
    ok(wear0.j==='true'&&wear0.t==='true'&&wear0.dress===undefined,'What you wear: jackets and ties are on while nothing is stored (a missing key means yes)');
    ok(wear0.v==='never','the vest choice shows "No vest" for a new person');
    await p.click('#su-sw-jacket');
    ok(await stored(p,`s=>s.dress&&s.dress.jacket===false&&s.dress.tie===true`),'switching jackets off stores settings.dress {jacket:false, tie:true}');
    ok(await p.evaluate(()=>!document.querySelector('#su-vest')&&document.querySelector('#su-sw-jacket').getAttribute('aria-checked')==='false'),'with jackets off the vest choice is gone');
    await p.click('#su-sw-tie');await p.click('#su-sw-jacket');
    ok(await stored(p,`s=>s.dress&&s.dress.jacket===true&&s.dress.tie===false`),'jackets back on and ties off: {jacket:true, tie:false}');
    ok(await p.evaluate(()=>!document.querySelector('#su-vest')),'with ties off the vest choice is gone too (a waistcoat only with a tie, as Settings)');
    await p.click('#su-sw-tie');await p.waitForSelector('#su-vest');
    await p.selectOption('#su-vest','always');
    ok(await stored(p,`s=>s.vestMode==='always'`),'choosing a vest stores settings.vestMode');
    await p.click('#su-back');await p.waitForFunction(()=>document.querySelector('#su-step').dataset.step==='week');
    ok(true,'Back returns to the step before');
    await next(p,'wear');await next(p,'weather');
    await p.fill('#su-city','Testv');await p.click('#su-find');
    await p.waitForFunction(()=>document.querySelectorAll('#su-cities button').length===1);
    await p.click('#su-cities button');
    ok(await stored(p,`s=>s.location&&s.location.name==='Testville, Test Region, TT'&&s.location.lat===10.5`),'searching a city and picking it stores the location');
    ok(/Weather for Testville/.test(await p.textContent('#su-loc')),'and the step says which place the weather is for');
    await p.click('#su-geo');
    ok(await stored(p,`s=>s.location&&s.location.lat===1.234&&s.location.lon===5.678`),'"Use my location" stores the device\'s position');
    await p.waitForFunction(()=>/your location \(1\.23° N, 5\.68° E\)/.test(document.querySelector('#su-loc').textContent));
    ok(true,'and the step is drawn again with it');
    const other=await p.evaluate(()=>unit()==='F'?'C':'F');
    await p.click(`#su-units .su-day:has-text("°${other}")`);
    ok(await stored(p,`s=>s.units==='${other}'`),'the units are stored');
    await next(p,'connect');
    const c0=await p.evaluate(()=>({link:!!document.querySelector('#su-link'),note:document.querySelector('#su-without').textContent,all:document.querySelector('#setup').textContent}));
    ok(c0.link&&/works without/.test(c0.note)&&/by hand/.test(c0.note)&&/no automatic photo reading/.test(c0.note)&&/no item pictures/.test(c0.note),'Connection, not connected: a field for the invite link, and it says the app works without it and what is then missing');
    ok(!/worker|cloudflare|token|endpoint/i.test(c0.all),'in plain words');
    await p.fill('#su-link','hello there');await p.click('#su-connect');
    await p.waitForFunction(()=>!!document.querySelector('#setup .su-err'));
    ok(await p.evaluate(()=>!localStorage.getItem('worker_url')&&!localStorage.getItem('app_token')&&document.querySelector('#su-link').value==='hello there'),'text that is no invite link stores nothing and says so');
    // the real connectFromLink, the server's answer stood in for (tests/accounts.test.js covers its other paths)
    await p.route('https://server.example.test/api/me',r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({id:'t1',role:'tester',name:'Sam'})}));
    await p.fill('#su-link','https://app.example.test/#invite=abc123abc123abc123abc123&w='+encodeURIComponent('https://server.example.test/api'));await p.click('#su-connect');
    await p.waitForFunction(()=>!!document.querySelector('#su-conn'));
    ok(await p.evaluate(()=>localStorage.getItem('worker_url')==='https://server.example.test/api'&&localStorage.getItem('app_token')==='abc123abc123abc123abc123'),'an invite link the server takes: its server address and code are stored');
    ok(/✓/.test(await p.textContent('#su-conn'))&&/Connected/.test(await p.textContent('#su-conn')),'and the step shows Connected with a tick');
    await next(p,'done');
    ok(await p.evaluate(()=>!document.querySelector('#su-skip')&&/Add my first item/.test(document.querySelector('#su-next').textContent)&&/a vest every suit day/.test(document.querySelector('.su-sum').textContent)&&/Blazer days/.test(document.querySelector('.su-sum').textContent)&&/connected/.test(document.querySelector('.su-sum').textContent)),'the last step sums up the answers and offers to add the first item');
    const sum=await p.evaluate(()=>{const d=HOOK.setupDress(),li=[...document.querySelectorAll('.su-sum li')].find(l=>/Workdays/.test(l.textContent));
      return {days:li.querySelector('b').textContent,want:[...settings.workdays].sort((a,b)=>a-b).map(i=>DAY_NAMES[i].slice(0,3)).join(', '),jacket:d.jacket,help:document.querySelector('#su-step .su-help').textContent}});
    ok(sum.days===sum.want,'the summary lists the workdays in the Week step\'s order, Sunday first: '+sum.days);
    ok(sum.jacket?/a suit or blazer, .* and shoes, plus pants if you wear a blazer rather than a suit\.$/.test(sum.help):/pants/.test(sum.help)&&!/plus pants/.test(sum.help),'the last step asks for pants only as needed (not with a suit): '+sum.help);
    ok(await p.evaluate(()=>!!document.querySelector('#su-step #kit-tour-link')&&!!document.querySelector('#su-step #kit-sample-link')),'the last step offers the tour and a sample wardrobe (kit.js)');
    await p.waitForTimeout(400);await p.click('#su-next');
    /* a first-time person going on to Add gets the quick tour first (kit.js), its last button going on to Add */
    await p.waitForFunction(()=>!document.querySelector('#setup.on')&&!!document.querySelector('#kitsheet.on'));
    await p.waitForTimeout(400);   // (a tap at the same spot right after the setup closed is a double tap and is dropped: setupTapGuard)
    for(let k=0;k<3;k++){await p.click('#kit-next');await p.waitForTimeout(400)}   // (kit.js KIT_TAP_MS: a quicker second tap is a double tap's)
    ok(/Add my first item/.test(await p.textContent('#kit-next')),'the tour comes between the setup and Add, its last button "Add my first item"');
    await p.click('#kit-next');
    await p.waitForFunction(()=>!document.querySelector('#kitsheet.on')&&!document.querySelector('#add').hidden);
    ok(await stored(p,`s=>s.setupDone>0&&s.vestMode==='always'`),'Done stores setupDone (and keeps the vest that was chosen)');
    ok(await p.evaluate(()=>['header','main','nav'].every(s=>!document.querySelector(s).inert)&&!document.querySelector('#add').hidden&&!!document.querySelector('#add .pback')),'and goes to the Add page (from the Wardrobe), the page usable again');
    await p.reload();await p.waitForFunction(()=>window.appReady);
    ok(!await shown(p),'after Done the setup does not come back on the next start');
    ok(!p.errs.length,'no errors in the setup: '+p.errs.join(' | '));
    await p.context().close();

    /* ---- Skip finishes at once ---- */
    const s=await open();
    ok(await shown(s),'another fresh install: the setup');
    await s.click('#su-skip');await s.waitForFunction(()=>!document.querySelector('#setup.on'));
    ok(await stored(s,`s=>s.setupDone>0&&s.vestMode==='never'`),'Skip stores setupDone at once, and a new person gets no vest');
    ok(await s.evaluate(()=>!document.querySelector('#today').hidden&&!!document.querySelector('#firstrun')),'and leaves the person on Today, with the checklist');
    await s.reload();await s.waitForFunction(()=>window.appReady);
    ok(!await shown(s),'after Skip the setup does not come back');
    // the Add tab's note while not connected
    await s.evaluate(()=>openAdd());
    const note=await s.textContent('#note');
    ok(/won.t be read automatically/.test(note)&&/invite link/.test(note)&&/Settings → Connection/.test(note)&&/by hand/.test(note)&&!/worker|cloudflare/i.test(note),'the Add tab says in plain words that photos are not read without a connection: '+note);
    // the Wardrobe tab, empty
    await s.evaluate(()=>show('wardrobe'));
    ok(await s.evaluate(()=>!!document.querySelector('#wempty svg')&&/Add your first item/.test(document.querySelector('#wempty-add').textContent)&&!/Nothing here yet/.test(document.querySelector('#wardrobe').textContent)),'the empty Wardrobe is a card with a drawing and an "Add your first item" button');
    await s.click('#wempty-add');
    ok(await s.evaluate(()=>!document.querySelector('#add').hidden),'which opens the Add tab');

    /* ---- the checklist on Today ---- */
    const rows=()=>s.evaluate(()=>[...document.querySelectorAll('#firstrun .fr-it')].map(e=>e.dataset.need+(e.classList.contains('done')?'+':'-')).join(' '));
    const add=(...its)=>s.evaluate(`(()=>{const I=${I};items.push(${its.map(a=>`I(${a.map(x=>JSON.stringify(x)).join(',')})`).join(',')});cache={};show('today')})()`);
    await s.evaluate(()=>{TODAY_OVERRIDE='2026-11-11T12:00:00';settings.workdays=[1,2,3,4,5];settings.blazerDays=[];delete settings.dress;dayRecs={};cache={};sel=new Date(2026,10,11);view={y:2026,m:10};show('today')});
    ok(await rows()==='jacket- shirt- tie- pants- shoes-'&&/Get your first outfit/.test(await s.textContent('#firstrun h3')),'suit-and-tie person, empty wardrobe: "Get your first outfit" lists a jacket, shirt, tie, pants and shoes');
    ok(await s.evaluate(()=>!document.querySelector('.fig')&&!/wardrobe is empty/i.test(document.querySelector('#today').textContent)),'in place of the gray sentence');
    await add(['sh1','shirt','white']);
    ok(await rows()==='jacket- shirt+ tie- pants- shoes-','adding a shirt ticks it; the card stays');
    await add(['su1','suit','navy']);
    ok(await rows()==='jacket+ shirt+ tie- shoes-','a suit ticks the jacket, and pants are no longer asked for');
    await add(['t1','tie','burgundy']);
    ok(await rows()==='jacket+ shirt+ tie+ shoes-'&&/3 of 4 added/.test(await s.textContent('#firstrun .fr-sub')),'a tie: three of four');
    await add(['bs','shoes','black',{leather:'calf'}]);
    ok(await s.evaluate(()=>!document.querySelector('#firstrun')&&!!document.querySelector('.fig')),'with shoes a day can be planned: the checklist is gone and the outfit shows');
    // a blazer needs trousers
    await s.evaluate(`(()=>{const I=${I};items=[I('bz','blazer','navy'),I('sh1','shirt','white'),I('t1','tie','burgundy'),I('bs','shoes','black',{leather:'calf'})];cache={};show('today')})()`);
    ok(await rows()==='jacket+ shirt+ tie+ pants- shoes+','a blazer and no suit: pants are still needed');
    // an item out of rotation doesn't count
    await s.evaluate(`(()=>{const I=${I};items=[I('su1','suit','navy'),I('sh1','shirt','white'),I('t1','tie','burgundy'),I('bs','shoes','black',{leather:'calf',paused:true})];cache={};show('today')})()`);
    ok(await rows()==='jacket+ shirt+ tie+ shoes-','shoes taken out of rotation don\'t tick the row');
    // no jackets, no ties
    await s.evaluate(()=>{items=[];settings.dress={jacket:false,tie:false};cache={};show('today')});
    ok(await rows()==='shirt- pants- shoes-','no-jacket, no-tie person: only a shirt, pants and shoes are asked for');
    await add(['sh1','shirt','white']);await add(['p1','pants','grey']);
    ok(await rows()==='shirt+ pants+ shoes-','ticking as they are added');
    await add(['bs','shoes','brown',{leather:'calf'}]);
    ok(await s.evaluate(()=>!document.querySelector('#firstrun')&&!!document.querySelector('.fig')),'and gone once that person has all three');
    // the button, and a day that is not a workday
    await s.evaluate(()=>{items=[];delete settings.dress;settings.workdays=[1,2,3,4];cache={};sel=new Date(2026,10,14);show('today')});
    ok(await s.evaluate(()=>!!document.querySelector('#stage #firstrun')&&/isn.t a workday/.test(document.querySelector('#today').textContent)),'on a day that is not a workday the checklist sits above the note');   // ui pass: the checklist comes first
    await s.click('#fr-add');
    ok(await s.evaluate(()=>!document.querySelector('#add').hidden),'its button opens the Add tab');
    ok(!s.errs.length,'no errors with the checklist: '+s.errs.join(' | '));
    await s.context().close();

    /* ---- an install with items never sees it ---- */
    const h=await open();
    await h.evaluate(`(async()=>{const I=${I};for(const i of [I('su1','suit','navy'),I('sh1','shirt','white')])await put(i)})()`);
    await h.reload();await h.waitForFunction(()=>window.appReady);
    ok(!await shown(h)&&await h.evaluate(()=>settings.setupDone>0),'an install with items starts without the setup and is marked as done');
    // "Run setup again" in Settings
    await h.evaluate(()=>openSettings('connection'));await h.click('#setup-again');
    await h.waitForFunction(()=>!!document.querySelector('#setup.on'));
    ok(await h.evaluate(()=>!settingsOpen())&&await step(h)==='welcome','Settings → "Run setup again" closes Settings and opens the setup');
    await h.evaluate(()=>{show('today')});
    ok(await shown(h),'a setup the person asked for stays while Today is redrawn');
    await next(h,'week');await next(h,'wear');
    ok(await h.evaluate(()=>document.querySelector('#su-vest').value===(settings.vestMode||'auto')),'run again, the vest choice shows the stored one');
    await next(h,'weather');await next(h,'connect');await next(h,'done');
    ok(/^Done$/.test((await h.textContent('#su-next')).trim()),'with items in the wardrobe the last button is Done');
    await h.waitForTimeout(400);await h.click('#su-next');await h.waitForFunction(()=>!document.querySelector('#setup.on'));
    ok(await h.evaluate(()=>!document.querySelector('#today').hidden&&(settings.vestMode||'auto')==='auto'),'which goes to Today and leaves the vest setting alone');
    await h.context().close();

    /* ---- already connected (opened from an invite link); connectFromLink when the app has it ---- */
    const c=await open({},()=>{localStorage.setItem('worker_url','https://server.example.test/api');localStorage.setItem('app_token','abc123')});
    ok(await shown(c),'a fresh install that is already connected still gets the setup');
    await next(c,'week');await next(c,'wear');await next(c,'weather');await next(c,'connect');
    ok(await c.evaluate(()=>!!document.querySelector('#su-conn .su-tick')&&!document.querySelector('#su-link')),'its Connection step says Connected with a tick and asks for no link');
    await c.context().close();
    const f=await open();
    const BAD='bad'.padEnd(24,'x'),GOOD='good'.padEnd(24,'x'),asked=[];
    await f.route('https://server.example.test/me',r=>{const t=r.request().headers()['x-app-token'];if(t)asked.push(t);
      return t===GOOD?r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({id:'t1',role:'tester',name:'Sam'})}):r.fulfill({status:403,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:'{"error":"forbidden token"}'})});
    await next(f,'week');await next(f,'wear');await next(f,'weather');await next(f,'connect');
    await f.fill('#su-link',`#invite=${BAD}&w=https%3A%2F%2Fserver.example.test`);await f.click('#su-connect');
    await f.waitForFunction(()=>!!document.querySelector('#setup .su-err'));
    ok(asked.includes(BAD)&&await f.evaluate(()=>!localStorage.getItem('app_token')),'with connectFromLink in the app the link goes to it, and a refused code stores nothing');
    await f.fill('#su-link',`#invite=${GOOD}&w=https%3A%2F%2Fserver.example.test`);await f.click('#su-connect');await f.waitForFunction(()=>!!document.querySelector('#su-conn'));
    ok(await f.evaluate(G=>localStorage.getItem('app_token')===G,GOOD),'an accepted one shows Connected');
    await f.context().close();

    /* ---- it steps aside when the app is driven past it ---- */
    const y=await open();
    ok(await shown(y),'fresh install: the setup');
    await y.evaluate(`(()=>{const I=${I};items=[I('su1','suit','navy')];cache={};show('today')})()`);
    ok(!await shown(y)&&await y.evaluate(()=>!settings.setupDone&&!document.querySelector('main').inert),'items arriving (a sync, a restore) close a setup that opened by itself, without marking it done');
    await y.context().close();
    const y2=await open();
    await y2.evaluate(()=>openAdd());
    ok(!await shown(y2)&&await y2.evaluate(()=>!settings.setupDone),'so does opening another tab');
    await y2.context().close();

    /* ---- a test that doesn't ask for it starts on the plain page ---- */
    const n=await browser.newContext({viewport:{width:390,height:844}}).then(c=>c.newPage());await n.goto(url);await n.waitForFunction(()=>window.appReady);
    ok(await n.evaluate(()=>navigator.webdriver===true&&!document.querySelector('#setup.on')&&!settings.setupDone&&!!document.querySelector('#firstrun')),'a driven browser that doesn\'t ask for the setup starts on Today with the checklist, and nothing is marked done');
    await n.click('#n-wardrobe');ok(await n.evaluate(()=>!!document.querySelector('#wempty')),'and the page takes clicks at once');
    await n.context().close();

    /* ---- nothing scrolls sideways: 320, 390 and 626px, light and dark ---- */
    for(const scheme of['light','dark'])for(const width of[320,390,626]){
      const v=await open({viewport:{width,height:700},colorScheme:scheme});const bad=[];
      if(!await noSide(v))bad.push('welcome');
      for(const k of['week','wear','weather','connect','done']){await next(v,k);
        if(k==='weather'){await v.fill('#su-city','Testv');await v.click('#su-find');await v.waitForFunction(()=>document.querySelectorAll('#su-cities button').length===1);if(!await noSide(v))bad.push('weather results');await v.click('#su-cities button')}   // (picked: Next on results not picked says so first, setupCityOpen)
        if(k==='connect'){await v.fill('#su-link','nothing');await v.click('#su-connect');await v.waitForFunction(()=>!!document.querySelector('#setup .su-err'))}
        if(!await noSide(v))bad.push(k)}
      const look=await v.evaluate(()=>{const e=document.querySelector('#setup'),cs=getComputedStyle(e),m=cs.backgroundColor.match(/\d+/g).map(Number),b=document.querySelector('#su-next').getBoundingClientRect(),r=e.getBoundingClientRect();
        return {dark:m[0]+m[1]+m[2]<200,h:b.height,inside:b.bottom<=innerHeight+0.5&&r.left>=0&&r.right<=innerWidth+0.5,w:r.width}});
      ok(!bad.length,`${width}px ${scheme}: no step of the setup scrolls sideways${bad.length?' (but: '+bad.join(', ')+')':''}`);
      ok(look.dark===(scheme==='dark')&&look.h>=44&&look.inside&&(width<600?look.w===width:look.w<width),`${width}px ${scheme}: the setup takes the theme, its buttons are 44px and on screen${width<600?'':' (a centred panel)'}`);
      await v.waitForTimeout(400);await v.click('#su-next');await v.waitForFunction(()=>!!document.querySelector('#kitsheet.on'));   // the quick tour first (kit.js); the wait: past setupGoDouble's guard
      ok(await v.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#kitsheet button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=-0.5&&r.right<=innerWidth+0.5})),`${width}px ${scheme}: the tour fits`);
      await v.keyboard.press('Escape');await v.waitForFunction(()=>!document.querySelector('#setup.on')&&!document.querySelector('#add').hidden);
      await v.evaluate(()=>show('today'));await settle(v,200);const t=await noSide(v)&&await v.evaluate(()=>!!document.querySelector('#firstrun'));
      await v.evaluate(()=>show('wardrobe'));await settle(v,200);const wd=await noSide(v)&&await v.evaluate(()=>!!document.querySelector('#wempty'));
      ok(t&&wd,`${width}px ${scheme}: the checklist on Today and the empty Wardrobe card fit the width`);
      await v.context().close()}
  }finally{await browser.close()}
};

/* ---- was tests/setupfix.test.js ---- */
// The new-user audit's fixes to the setup, the Home Screen guide, the tour and Settings' schedule, weather and days off (2026-11-15):
// the setup comes back where iOS cut it off and keeps a vest already chosen; a double tap on Skip doesn't open Settings; the last workday
// says why it stays; the summaries name the blazer days and the vest; "Run setup again" keeps the jeans switch and its Cancel undoes it;
// the tour speaks of what the person wears; About's tour goes back to About; the Home Screen app connecting mid-setup goes on with the
// account's answers; the Home Screen sheet never covers the setup; units follow the country; holidays (UK regions, Kuwait worked out on
// the phone, a country without a list, the year, a past day off); dates in English; the month starts on the work week's first day; the
// city search (repeats, Enter, Arabic).
const setupfix=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const open=async(opt={},init,auto=true)=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...opt});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>d.accept());p.geo=[];
    await p.route(/open-meteo\.com|nager\.at|example\.test/,r=>{const u=r.request().url();
      if(/geocoding-api/.test(u)){p.geo.push(u);return r.fulfill({contentType:'application/json',body:JSON.stringify({results:[
        {latitude:26.4,longitude:80.1,name:'Dubai',admin1:'Uttar Pradesh',admin2:'Kanpur',country_code:'IN'},{latitude:26.5,longitude:80.2,name:'Dubai',admin1:'Uttar Pradesh',admin2:'Unnao',country_code:'IN'},
        {latitude:26.5,longitude:80.2,name:'Dubai',admin1:'Uttar Pradesh',admin2:'Unnao',country_code:'IN'},{latitude:25.2,longitude:55.3,name:'Dubai',admin1:'Dubai',country_code:'AE'}]})})}
      return r.fulfill({status:404,contentType:'application/json',body:'{}'})});
    if(auto)await p.addInitScript(()=>{window.SETUP_AUTO=true});
    if(init)await p.addInitScript(init);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return p};
  const step=p=>p.evaluate(()=>{const e=document.querySelector('#su-step');return e?e.dataset.step:null});
  const next=async(p,want)=>{await p.waitForTimeout(400);await p.click('#su-next');await p.waitForFunction(w=>{const e=document.querySelector('#su-step');return e&&e.dataset.step===w},want)};   // (the wait: past setupGoDouble's guard on the last tap)
  const stored=(p,f)=>p.waitForFunction(`(async()=>{const s=await metaGet('settings');return !!s&&(${f})(s)})()`,null,{timeout:10000}).then(()=>true,()=>false);
  try{
    /* ---- iOS cuts the setup off: it comes back on the step it was on, with a vest already chosen kept ---- */
    const p=await open();
    await next(p,'week');await next(p,'wear');
    await p.click('#su-sw-tie');await p.click('#su-sw-tie');await p.waitForSelector('#su-vest');
    await p.selectOption('#su-vest','always');ok(await stored(p,`s=>s.vestMode==='always'`),'a vest chosen on What you wear is stored');
    await next(p,'weather');
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForFunction(()=>!!document.querySelector('#setup.on'));
    ok(await step(p)==='weather'&&/Step 4 of/.test(await p.textContent('#su-count')),'reopened after a kill, the setup is on the step it was on (Weather), not Welcome');
    await p.click('#su-skip');await p.waitForFunction(()=>!document.querySelector('#setup.on'));
    ok(await stored(p,`s=>s.setupDone>0&&s.vestMode==='always'`),'Skip after the restart keeps the vest chosen before it (not "No vest")');
    ok(await p.evaluate(()=>!localStorage.getItem('setup_at')),'the kept step goes once the setup is finished');
    // a double tap on Skip: the second tap would land on Settings' gear
    await p.waitForTimeout(400);   // (past the guard of the Skip just tapped)
    await p.evaluate(()=>{delete settings.setupDone;HOOK.setupOpen(false)});await p.waitForSelector('#su-skip');
    const b=await p.locator('#su-skip').boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await p.waitForTimeout(80);await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await p.waitForTimeout(300);
    const dt=await p.evaluate(()=>({setup:!!document.querySelector('#setup.on'),set:settingsOpen()}));
    ok(!dt.setup&&!dt.set,'a double tap on Skip closes the setup and doesn\'t open Settings under it '+JSON.stringify(dt));
    await p.waitForTimeout(400);await p.mouse.click(b.x+b.width/2,b.y+b.height/2);
    ok(await p.waitForFunction(()=>settingsOpen(),null,{timeout:3000}).then(()=>true,()=>false),'a tap there a moment later works as usual');
    await p.evaluate(()=>closeSettings());
    // the last workday
    await p.evaluate(()=>{settings.workdays=[2];openSettings('schedule')});
    await p.click('#cfg-workdays .dtog:nth-child(3)');
    ok(await p.evaluate(()=>JSON.stringify(settings.workdays)==='[2]'&&/At least one workday/.test(document.querySelector('#toast').textContent)),'the last workday can\'t be unticked, and it says why');
    // the Schedule summary with ties off still names the blazer days
    await p.evaluate(()=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.dress={jacket:true,tie:false};settingsSummaries()});
    const sum=await p.textContent('#sum-schedule');
    ok(/blazers Thu/.test(sum)&&/no ties/.test(sum)&&!/vest/.test(sum),`the Schedule summary keeps the blazer days with ties off (${sum})`);
    await p.evaluate(()=>{settings.dress={jacket:true,tie:true};settings.vestMode='never';settingsSummaries()});
    ok(/blazers Thu · vest never/.test(await p.textContent('#sum-schedule')),'and the vest with ties on');
    await p.evaluate(()=>closeSettings());
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();

    /* ---- a vest that came with the account (another phone's choice) is kept by this phone's setup ---- */
    const v=await open();
    await v.evaluate(async()=>{settings.vestMode='always';settings.ks={...(settings.ks||{}),vestMode:Date.now()-5000};settings.kh={...(settings.kh||{}),vestMode:setHash('always')};setupDraw()});
    await next(v,'week');await next(v,'wear');
    ok(await v.evaluate(()=>document.querySelector('#su-vest').value==='always'),'What you wear shows the account\'s vest, not "No vest"');
    await v.click('#su-skip');ok(await stored(v,`s=>s.setupDone>0&&s.vestMode==='always'`),'and Skip keeps it');
    /* ---- the tour without ties or jackets; About's tour goes back to About ---- */
    await v.evaluate(()=>{settings.dress={jacket:false,tie:false};tourOpen()});await v.waitForSelector('#kitsheet.on');
    const tour=await v.textContent('#kitsheet');
    ok(!/tie/i.test(tour)&&!/the suit/i.test(tour)&&/suit the pants/.test(tour),'the tour\'s first card speaks of shirts and pants to someone who wears no tie or jacket');
    await v.evaluate(()=>kitClose());
    await v.evaluate(()=>{openSettings('about')});await v.evaluate(()=>document.querySelector('#tour-again').scrollIntoView());await v.click('#tour-again');await v.waitForSelector('#kitsheet.on');
    await v.keyboard.press('Escape');
    ok(await v.waitForFunction(()=>settingsOpen()&&document.querySelector('#sc-about').classList.contains('open'),null,{timeout:3000}).then(()=>true,()=>false),'Settings → About → Take the tour comes back to About when the tour closes');
    await v.evaluate(()=>closeSettings());
    /* ---- Run setup again: the jeans switch stays; Cancel undoes what was tapped ---- */
    await v.evaluate(async()=>{settings.dress={jacket:true,tie:true,jeans:true};settings.workdays=[0,1,2,3,4];await saveUserSettings();HOOK.setupOpen(true)});
    ok(await v.evaluate(()=>!!document.querySelector('#su-cancel')&&!document.querySelector('#su-skip')),'Run setup again has Cancel in place of Skip');
    await next(v,'week');await v.click('#su-workdays .su-day:nth-child(6)');await next(v,'wear');await v.click('#su-sw-tie');
    ok(await stored(v,`s=>s.dress.tie===false&&s.dress.jeans===true&&s.workdays.includes(5)`),'switching ties off in it keeps "Jeans with a blazer"');
    await v.reload();await v.waitForFunction(()=>window.appReady);await v.waitForFunction(()=>!!document.querySelector('#setup.on'));
    ok(await step(v)==='wear'&&await v.evaluate(()=>!!document.querySelector('#su-cancel')),'a re-run cut off by iOS opens again where it was, still with Cancel');
    await v.click('#su-cancel');
    ok(await stored(v,`s=>s.dress.tie===true&&s.dress.jeans===true&&JSON.stringify(s.workdays)==='[0,1,2,3,4]'`)&&await v.evaluate(()=>!document.querySelector('#setup.on')&&/as they were/.test(document.querySelector('#toast').textContent)),'Cancel puts back what the re-run changed, and says so');
    ok(!v.errs.length,'no page errors: '+v.errs.join(' | '));await v.context().close();

    /* ---- connecting at the setup's own Connection step: the wardrobe that comes across doesn't end the setup ---- */
    const c=await open();
    // the real connectFromLink and the real sync it starts: the server's backup holds a piece, which comes across
    await c.route('https://server.example.test/me',r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({id:'t1',role:'tester',name:'Sam'})}));
    await c.route('https://server.example.test/sync**',r=>{const m=r.request().method(),h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,POST,OPTIONS'};
      if(m==='OPTIONS')return r.fulfill({status:204,headers:h});
      return r.fulfill({contentType:'application/json',headers:h,body:JSON.stringify(m==='GET'?{rev:1,saved:1,data:{items:[{id:'x1',type:'suit',primaryColor:'navy',pattern:'solid',added:1,updated:1}],days:[],tombstones:{},settings:null}}:{ok:true,rev:2,saved:2})})});
    await next(c,'week');await next(c,'wear');await next(c,'weather');await next(c,'connect');
    await c.fill('#su-link',`#invite=${'x'.repeat(24)}&w=https%3A%2F%2Fserver.example.test%2F`);await c.click('#su-connect');await c.waitForSelector('#su-conn');
    ok(await c.evaluate(()=>!!document.querySelector('#setup.on')&&/came across: 1 item/.test(document.querySelector('#su-step').textContent)),'connected at the Connection step, the setup stays and says the wardrobe came across');
    await next(c,'done');ok(/^Done$/.test((await c.textContent('#su-next')).trim()),'and goes on to All set');
    await c.context().close();

    /* ---- the Home Screen sheet never covers the setup ---- */
    const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
    const h=await open({userAgent:IPHONE});
    await h.evaluate(()=>{HOOK.homeScreenGuide()});
    ok(await h.evaluate(()=>!!document.querySelector('#setup.on')&&!document.querySelector('#kitsheet.on')&&!(document.querySelector('#ask-ok')&&document.querySelector('#ask-ok').offsetParent)),'the Home Screen guide isn\'t shown over the setup (its own Home Screen step says it)');
    await h.evaluate(()=>{HOOK.setupClose();HOOK.homeScreenGuide()});await h.waitForSelector('#kitsheet.on');
    const steps=await h.evaluate(()=>[...document.querySelectorAll('#kitsheet .home-steps li')].map(l=>l.textContent));
    ok(steps.length===4&&/⋯/.test(steps[0])&&/Open as Web App/.test(steps[2]),'elsewhere it is the kit sheet, its steps one per line ('+steps.length+')');
    await h.evaluate(()=>{items=[{id:'i1',type:'tie',primaryColor:'navy',pattern:'solid',added:1}];HOOK.kitDraw()});
    ok(/Your wardrobe stays here in Safari/.test(await h.textContent('#kitsheet'))&&/Download backup/.test(await h.textContent('#kitsheet')),'not connected with a wardrobe: it says the wardrobe stays in Safari and how to take it along');
    await h.evaluate(()=>{items=[];kitClose();delete settings.setupDone;HOOK.setupOpen(false)});await h.waitForSelector('#setup.on');
    ok(!h.errs.length,'no page errors: '+h.errs.join(' | '));await h.context().close();

    /* ---- units follow the country ---- */
    const u=await open({timezoneId:'Asia/Kuwait',locale:'en-US'},null,false);
    const un=await u.evaluate(()=>{const a=unit();settings.location={lat:40.7,lon:-74,name:'New York, New York, US',cc:'US'};const b=unit();settings.location={lat:29.4,lon:47.9,name:'Kuwait City, Al Asimah, KW'};const c=unit();settings.location=null;settings.units='F';const d=unit();delete settings.units;return [a,b,c,d].join()});
    ok(un==='C,F,C,F',`°C on an English (US) phone in Kuwait's time zone, °F for a US location, the location's country from its name, and a chosen unit wins (${un})`);
    /* ---- holidays ---- */
    const hol=await u.evaluate(()=>{const gb=HOOK.nagerKeep([{date:'2027-01-01',name:"New Year's Day",localName:"New Year's Day",global:false,counties:['GB-ENG','GB-NIR','GB-SCT','GB-WLS'],types:['Public']},
        {date:'2027-03-29',name:'Easter Monday',localName:'Easter Monday',global:false,counties:['GB-ENG','GB-NIR','GB-WLS'],types:['Public']},{date:'2027-11-30',name:"Saint Andrew's Day",localName:"Saint Andrew's Day",global:false,counties:['GB-SCT'],types:['Public']},
        {date:'2026-12-26',name:"St. Stephen's Day",localName:'Boxing Day',global:true,types:['Public']}],'GB').map(h=>h.n);
      const fr=HOOK.nagerKeep([{date:'2027-01-01',name:"New Year's Day",localName:'Jour de l’an',global:true,types:['Public']}],'FR').map(h=>h.n);
      const kw=HOOK.builtinHolidays('KW','2026-01-01','2027-12-31');return {gb,fr,kw}});
    ok(hol.gb.join('|')==="New Year's Day|Easter Monday|Boxing Day",`UK: a holiday of most of the nations counts, one nation's doesn't, and its own name is used (${hol.gb.join('|')})`);
    ok(hol.fr[0]==="New Year's Day",'elsewhere the English name');
    const kd=Object.fromEntries(hol.kw.map(x=>[x.d,x.n]));
    ok(kd['2026-02-25']==='National Day'&&kd['2026-03-20']==='Eid al-Fitr'&&kd['2026-05-26']==='Arafat Day'&&kd['2026-05-27']==='Eid al-Adha'&&kd['2026-06-16']==='Islamic New Year'&&kd['2027-03-09']==='Eid al-Fitr',`Kuwait's holidays are worked out on the phone, Islamic days from the Umm al-Qura calendar (${hol.kw.length} days)`);
    await u.evaluate(()=>{TODAY_OVERRIDE='2026-11-15T12:00:00';cache={}});
    await u.evaluate(()=>setHolidayCountry('KW'));
    ok(await u.evaluate(()=>settings.holidays.country==='KW'&&settings.holidays.list.some(h=>h.n==='Liberation Day')),'not connected, picking Kuwait gives its list (none came before)');
    await u.evaluate(()=>setHolidayCountry('KP'));
    const kp=await u.evaluate(()=>({cc:settings.holidays.country,n:settings.holidays.list.length,msg:HOOK.holidayMsg}));
    ok(kp.cc==='KP'&&kp.n===0&&/North Korea/.test(kp.msg),`a country whose list can't be loaded is the one that counts, with no list, and the message names it (${kp.msg})`);
    await u.evaluate(()=>{settings.holidays={country:'US',list:[{d:'2026-11-26',n:'Thanksgiving Day'},{d:'2027-11-25',n:'Thanksgiving Day'}],skip:[],fetched:Date.now()};openSettings('daysoff')});
    const dates=await u.evaluate(()=>[...document.querySelectorAll('#holiday-list .hd')].map(e=>e.textContent));
    ok(!/2026/.test(dates[0])&&/2027/.test(dates[1]),`a holiday in another year shows its year (${dates.join(' | ')})`);
    await u.fill('#cfg-off-from','2026-11-01');await u.click('.offadd button');
    ok(await u.evaluate(()=>!(settings.daysOff||[]).length&&/has passed/.test(document.querySelector('#holiday-msg').textContent)),'a past day off is refused with a reason, not "1 day off added."');
    await u.fill('#cfg-off-from','2026-11-13');await u.fill('#cfg-off-to','2026-11-17');await u.click('.offadd button');
    ok(await u.evaluate(()=>(settings.daysOff||[]).map(x=>x.d).join()==='2026-11-15,2026-11-16,2026-11-17'),'a range that started in the past is added from today');
    /* ---- the city search ---- */
    await u.evaluate(()=>{openSettings('weather')});await u.fill('#cfg-city','Dubai');await u.press('#cfg-city','Enter');
    await u.waitForFunction(()=>document.querySelectorAll('#city-results button').length>0);
    const cities=await u.evaluate(()=>[...document.querySelectorAll('#city-results button')].map(b=>b.textContent));
    ok(cities.length===3&&new Set(cities).size===3&&cities.some(c=>/Kanpur/.test(c)),`Enter searches; lines that read the same get their district and true repeats go (${cities.join(' | ')})`);
    await u.fill('#cfg-city','الكويت');await u.press('#cfg-city','Enter');await u.waitForFunction(n=>document.querySelector('#city-results button')&&true,null);
    ok(/language=ar/.test(u.geo[u.geo.length-1]||''),'a name typed in Arabic is looked up in Arabic');
    await u.click('#city-results button:last-child');
    ok(await u.evaluate(()=>settings.location.cc==='AE'),'the picked city keeps its country (for the units)');
    ok(await u.evaluate(()=>HOOK.geoName(29.375,47.98)==='your location (29.38° N, 47.98° E)'),'"Use my location" names the spot, not "your current location" forever');
    await u.evaluate(()=>closeSettings());
    ok(!u.errs.length,'no page errors: '+u.errs.join(' | '));await u.context().close();

    /* ---- dates in English on an Arabic phone; the month starts on the work week's first day ---- */
    const a=await open({locale:'ar-KW',timezoneId:'Asia/Kuwait'},null,false);
    const ad=await a.evaluate(()=>({d:shortDate(new Date(2026,10,15)),l:new Date(2026,10,15).toLocaleDateString(undefined,{month:'long',year:'numeric'})}));
    ok(/^Sun/.test(ad.d)&&/15/.test(ad.d)&&/November 2026/.test(ad.l)&&!/[؀-ۿ٠-٩]/.test(ad.d+ad.l),`an Arabic-language phone gets dates in English with Latin digits (${ad.d}; ${ad.l})`);
    const wk=await a.evaluate(()=>{settings.workdays=[1,2,3,4,5];monthPanel={y:2026,m:10};const g1=HOOK.monthGridHtml();settings.workdays=[0,1,2,3,4];const g2=HOOK.monthGridHtml();
      const head=g=>g.match(/mdow[^>]*>(.*?)<\/div>/)[1].replace(/<[^>]+>/g,''),blanks=g=>(g.match(/mc blank/g)||[]).length;return {h1:head(g1),b1:blanks(g1),h2:head(g2),b2:blanks(g2)}});
    ok(wk.h1==='MTWTFSS'&&wk.b1===6&&wk.h2==='SMTWTFS'&&wk.b2===0,`the month starts on Monday for a Mon–Fri week and on Sunday for Sun–Thu (${JSON.stringify(wk)})`);
    ok(!a.errs.length,'no page errors: '+a.errs.join(' | '));await a.context().close();

    /* ---- "Try a sample wardrobe" on the setup's last step finishes the setup first ---- */
    const s=await open({timezoneId:'Asia/Kuwait'});
    for(const k of['week','wear','weather','connect','done'])await next(s,k);
    await s.click('#setup #kit-sample-link');
    ok(await stored(s,`s=>s.setupDone>0&&s.vestMode==='never'&&s.holidays&&s.holidays.country==='KW'`),'the setup is finished (no vest for a new person, the time zone\'s holidays) before the sample loads');
    ok(await s.waitForFunction(()=>items.filter(i=>i.sample).length>0&&!document.querySelector('#setup.on'),null,{timeout:10000}).then(()=>true,()=>false),'and the sample wardrobe loads');
    await settle(s,200);
    ok(!s.errs.length,'no page errors: '+s.errs.join(' | '));await s.context().close();
  }finally{await browser.close()}
};

/* ---- was tests/nufix8.test.js ---- */
// Fix round 2 (2026-11-15), Fixer 8: holidays fetched in December or January include the coming year (every year of the window is asked);
// a country picked in Settings is kept before its list arrives; workdays, dark shirts and the setup's dress switches are stored before the
// week's locks are released; the setup's country is stored with setupDone; a double tap on Next steps once; an interrupted "Run setup
// again" comes back with items in the wardrobe, and one not taken up is dropped; the Home Screen sheet after a link shows once; the city
// search clears on an empty search and stores a name found in Arabic in English.
const nufix8=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const HOST='https://w.test/',A='a'.repeat(32);
  const open=async(opt={},init,{auto=false,hold}={})=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...opt});const p=await ctx.newPage();p.errs=[];p.years=[];p.geo=[];
    p.on('pageerror',e=>p.errs.push(e.message+' '+String(e.stack||'').split('\n').slice(1,3).join(' ')));
    await ctx.route(/nager\.at/,async r=>{const m=r.request().url().match(/PublicHolidays\/(\d+)\/(\w+)/),y=+m[1],cc=m[2];p.years.push(y+cc);
      if(hold&&hold[cc])await hold[cc];
      const h=(d,n)=>({date:`${y}-${d}`,name:n,localName:n,global:true,types:['Public']});
      const list=cc==='AU'?[h('01-01',"New Year's Day"),h('01-26','Australia Day'),h('12-25','Christmas Day')]:[h('01-01',"New Year's Day"),h('03-29','Easter Monday'),h('12-25','Christmas Day')];
      return r.fulfill({contentType:'application/json',body:JSON.stringify(list)})});
    await ctx.route(/geocoding-api/,r=>{const u=r.request().url();p.geo.push(u);
      if(/\/v1\/get/.test(u))return r.fulfill({contentType:'application/json',body:JSON.stringify({id:292223,latitude:25.2,longitude:55.3,name:'Dubai',admin1:'Dubai',country_code:'AE'})});
      return r.fulfill({contentType:'application/json',body:JSON.stringify({results:[{id:292223,latitude:25.2,longitude:55.3,name:'دبي',admin1:'دبي',country_code:'AE'}]})})});
    await ctx.route(/^https:\/\/(?!geocoding)[^/]*open-meteo\.com\//,r=>r.fulfill({status:404,body:'{}'}));
    await ctx.route(HOST+'**',r=>{const q=r.request(),u=new URL(q.url()),j=(b,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(q.headers()['x-app-token']!==A)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({id:'aaaaaaaaaa',name:'Ann',role:'tester',caps:{tag:40,pattern:10,photo:12,item:20},used:{tag:0,pattern:0,photo:0,item:0}});
      if(u.pathname==='/sync')return q.method()==='GET'?j({rev:0,saved:0,data:null}):j({rev:1,saved:Date.now()});
      return j({ok:true})});
    if(auto)await p.addInitScript(()=>{window.SETUP_AUTO=true});
    if(init)await p.addInitScript(init);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return p};
  const stored=(p,f,t=6000)=>p.waitForFunction(`(async()=>{const s=await metaGet('settings');return !!s&&(${f})(s)})()`,null,{timeout:t}).then(()=>true,()=>false);
  const step=p=>p.evaluate(()=>{const e=document.querySelector('#su-step');return e?e.dataset.step:null});
  try{
    /* ---- N6: holidays fetched on 31 December in Sydney and 15 January in London include the coming year ---- */
    const h=await open({timezoneId:'Australia/Sydney',locale:'en-AU'});
    const au=await h.evaluate(async()=>{TODAY_OVERRIDE='2026-12-31T23:55:00';settings.workdays=[1,2,3,4,5];cache={};await setHolidayCountry('AU');
      const l=settings.holidays.list.map(x=>x.d);TODAY_OVERRIDE='2027-01-01T08:00:00';cache={};return {l,ny:isWorkday(new Date(2027,0,1)),home:isoKey(homeDay())}});
    ok(h.years.filter(y=>/AU/.test(y)).sort().join()==='2026AU,2027AU,2028AU','on 31 December every year of the window is asked: 2026, 2027 and 2028 ('+h.years.join()+')');
    ok(au.l.includes('2027-01-01')&&au.l.includes('2027-01-26')&&!au.ny&&au.home==='2027-01-04',`Sydney: New Year's Day and Australia Day 2027 are in the list, 1 January is no workday and Today opens on Monday 4 January (${au.l.join(' ')}; ${au.home})`);
    h.years.length=0;
    const gb=await h.evaluate(async()=>{TODAY_OVERRIDE='2027-01-15T12:00:00';cache={};await setHolidayCountry('GB');return settings.holidays.list.map(x=>x.d)});
    ok(gb.includes('2027-03-29')&&gb.includes('2027-12-25')&&gb.includes('2026-12-25')&&gb.includes('2028-01-01')&&!gb.includes('2028-03-29'),`London on 15 January: 2027's holidays are there, from a month back to 13 months ahead (${gb.join(' ')})`);
    ok(await h.evaluate(()=>JSON.stringify(HOOK.holYears('2026-11-30','2028-01-31'))==='[2026,2027,2028]'&&JSON.stringify(HOOK.holYears('2027-01-15','2028-02-15'))==='[2027,2028]'),'holYears lists every calendar year from one date to the other');
    ok(!h.errs.length,'no page errors: '+h.errs.join(' | '));await h.context().close();

    /* ---- a country picked in Settings is kept before its list arrives; schedule taps are stored before the locks are released ---- */
    let release;const fr=new Promise(r=>release=r);
    const s=await open({timezoneId:'Europe/Paris'},null,{hold:{FR:fr}});
    await s.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T12:00:00';cache={};openSettings('daysoff')});
    await s.selectOption('#cfg-country','FR');
    ok(await stored(s,`s=>s.holidays&&s.holidays.country==='FR'&&s.holidays.fetched===0`),'the country picked is stored at once, its list to come (swiped away before it arrived, it was lost)');
    ok(await s.evaluate(()=>/Loading the public holidays of France/.test(document.querySelector('#holiday-msg').textContent)&&!document.querySelector('#holiday-list').textContent.trim()),'while loading it says so, with no "no list yet" line under it');
    release();
    ok(await stored(s,`s=>s.holidays.country==='FR'&&s.holidays.fetched>0&&s.holidays.list.length>0`),'and the list replaces it when it arrives');
    await s.evaluate(()=>{window.__held=0;const realTx=IDBDatabase.prototype.transaction,T=todayDate();for(let g=1;g<=4;g++){const k=key(new Date(T.getFullYear(),T.getMonth(),T.getDate()+g));dayRecs[k]={date:k,lock:{tie:'held'},updated:1}}IDBDatabase.prototype.transaction=function(st,m){if(st==='days'&&m==='readwrite')return {objectStore:()=>({put(r){if(!r.lock)window.__held++;return {}}})};return realTx.apply(this,arguments)};settings.workdays=[1,2,3,4,5];openSettings('schedule')});   // the locks never finish releasing: the real clearLocks, each release's write held
    await s.click('#cfg-workdays .dtog:nth-child(7)');
    ok(await stored(s,`s=>s.workdays.includes(6)`,3000),'a workday tapped is stored before the week\'s locks are released');
    await s.evaluate(()=>{HOOK.setDarkShirts('never')});
    ok(await stored(s,`s=>s.darkShirts==='never'`,3000),'so is Dark shirts');
    await s.evaluate(()=>{closeSettings();HOOK.setupOpen(true);HOOK.setupGo(1);HOOK.setupGo(1)});await s.waitForSelector('#su-sw-tie');
    await s.click('#su-sw-tie');
    ok(await stored(s,`s=>s.dress&&s.dress.tie===false`,3000),'and the setup\'s dress switch');
    ok(await s.waitForFunction(()=>window.__held>=3,null,{timeout:3000}).then(()=>true,()=>false),'(each of the three was saved while the real clearLocks was still releasing a lock)');
    await s.evaluate(()=>HOOK.setupClose());
    ok(!s.errs.length,'no page errors: '+s.errs.join(' | '));await s.context().close();

    /* ---- the setup: its country stored with setupDone; a double tap on Next steps once ---- */
    const never=new Promise(()=>{});
    const u=await open({timezoneId:'Europe/Paris'},null,{auto:true,hold:{FR:never}});
    await u.waitForSelector('#setup.on #su-next');
    const b=await u.locator('#su-next').boundingBox(),tap=()=>u.mouse.click(b.x+b.width/2,b.y+b.height/2);
    await tap();await u.waitForTimeout(80);await tap();await u.waitForTimeout(150);
    ok(await step(u)==='week','a double tap on Get started goes one step, to Your week ('+await step(u)+')');
    await u.waitForTimeout(400);await tap();await u.waitForTimeout(120);await tap();await u.waitForTimeout(150);
    ok(await step(u)==='wear','and on Next too ('+await step(u)+')');
    await u.waitForTimeout(400);await tap();await u.waitForFunction(()=>document.querySelector('#su-step').dataset.step==='weather');
    ok(true,'a tap a moment later goes on as usual');
    await u.click('#su-skip');
    ok(await stored(u,`s=>s.setupDone>0&&s.holidays&&s.holidays.country==='FR'&&s.holidays.fetched===0`),'finishing stores the time zone\'s country with setupDone, before its list arrives (a swipe away at once kept no holidays)');
    ok(await u.evaluate(()=>{const h=settings.holidays;return Date.now()-(h.fetched||0)>30*864e5}),'so the next start\'s monthly refetch fetches its list');
    ok(!u.errs.length,'no page errors: '+u.errs.join(' | '));await u.context().close();

    /* ---- an interrupted "Run setup again" with items comes back with Cancel; one not taken up is dropped ---- */
    const r=await open({},null,{auto:true});
    await r.evaluate(async()=>{const it={id:'own1',type:'tie',primaryColor:'navy',pattern:'solid',added:1};await put(it);items.push(it);settings.setupDone=Date.now();settings.workdays=[0,1,2,3,4];await saveUserSettings();
      HOOK.setupOpen(true);HOOK.setupGo(1)});
    await r.click('#su-workdays .su-day:nth-child(6)');await r.evaluate(()=>HOOK.setupGo(1));
    ok(await stored(r,`s=>s.workdays.includes(5)`),'the re-run\'s tap is stored');
    await r.reload();await r.waitForFunction(()=>window.appReady);
    ok(await r.waitForFunction(()=>!!document.querySelector('#setup.on #su-cancel'),null,{timeout:5000}).then(()=>true,()=>false)&&await step(r)==='wear','with items in the wardrobe the cut-off re-run opens again where it was, with Cancel');
    await r.click('#su-cancel');
    ok(await stored(r,`s=>JSON.stringify(s.workdays)==='[0,1,2,3,4]'`),'and Cancel puts the workdays back');
    // a record that can't be taken up now (Settings open, a test without SETUP_AUTO…) is dropped: it never opens by itself later
    await r.evaluate(()=>{HOOK.setupOpen(true);HOOK.setupGo(1)});
    ok(!r.errs.length,'no page errors: '+r.errs.join(' | '));
    const r2=await r.context().newPage();await r.close();   // a page without SETUP_AUTO: the setup can't open by itself there
    await r2.goto(url);await r2.waitForFunction(()=>window.appReady);await settle(r2,300);
    ok(await r2.evaluate(()=>!document.querySelector('#setup.on')&&!localStorage.getItem('setup_at')),'a cut-off re-run not taken up at the start is dropped');
    await r2.context().close();

    /* ---- the Home Screen sheet after an invitation link: once, not every time the link is opened again ---- */
    const IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const k=await open({userAgent:IOS});
    const link='#invite='+A+'&w='+encodeURIComponent(HOST);
    await k.evaluate(l=>connectFromLink(l),link);
    ok(await k.waitForSelector('#kitsheet.on',{timeout:5000}).then(()=>true,()=>false),'the first link on an iPhone in Safari shows the Home Screen sheet');
    await k.evaluate(()=>kitClose());
    await k.evaluate(l=>connectFromLink(l),link);await k.waitForTimeout(1700);
    ok(await k.evaluate(()=>!document.querySelector('#kitsheet.on')),'the same link opened again doesn\'t show it again');
    await k.evaluate(()=>{localStorage.removeItem('worker_url');localStorage.removeItem('app_token')});
    await k.evaluate(l=>connectFromLink(l),link);await k.waitForTimeout(1700);
    ok(await k.evaluate(()=>!document.querySelector('#kitsheet.on')),'nor after connecting again on the same phone (About\'s button still has it)');
    ok(!k.errs.length,'no page errors: '+k.errs.join(' | '));await k.context().close();

    /* ---- the city search ---- */
    const c=await open();
    await c.evaluate(()=>openSettings('weather'));await c.fill('#cfg-city','دبي');await c.press('#cfg-city','Enter');
    await c.waitForFunction(()=>document.querySelectorAll('#city-results button').length>0);
    const city=await c.textContent('#city-results button');
    ok(/^Dubai, Dubai, AE/.test(city)&&/دبي/.test(city)&&c.geo.some(g=>/\/v1\/get\?language=en&id=292223/.test(g)),`a city found in Arabic is named in English, the name typed beside it (${city})`);
    await c.click('#city-results button');
    ok(await c.evaluate(()=>settings.location.name==='Dubai, Dubai, AE'&&settings.location.cc==='AE'&&!('alt' in settings.location)),'and stored in English');
    await c.fill('#cfg-city','London');await c.press('#cfg-city','Enter');await c.waitForFunction(()=>document.querySelectorAll('#city-results button').length>0);
    await c.fill('#cfg-city','');await c.press('#cfg-city','Enter');
    ok(await c.waitForFunction(()=>!document.querySelector('#city-results').textContent.trim(),null,{timeout:3000}).then(()=>true,()=>false),'an empty search clears the last results');
    ok(!c.errs.length,'no page errors: '+c.errs.join(' | '));await c.context().close();
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['setup',setup],['setupfix',setupfix],['nufix8',nufix8]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
