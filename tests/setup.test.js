// First-run setup and the empty states (setup.js): a new install gets a full-screen setup whose steps store the week, the dress
// code, the vest, the weather location and units and the connection; Skip and Done finish it for good; an install with items never
// sees it, and it steps aside when the app is driven past it. Today shows a checklist until an outfit can be planned, the empty
// Wardrobe a card with a button, and the Add tab's note speaks plainly.
module.exports=async({ok,chromium,url,settle})=>{
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
  const next=async(p,want)=>{await p.click('#su-next');await p.waitForFunction(w=>{const e=document.querySelector('#su-step');return e&&e.dataset.step===w},want)};
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
    await p.waitForFunction(()=>/your current location/.test(document.querySelector('#su-loc').textContent));
    ok(true,'and the step is drawn again with it');
    const other=await p.evaluate(()=>unit()==='F'?'C':'F');
    await p.click(`#su-units .su-day:has-text("°${other}")`);
    ok(await stored(p,`s=>s.units==='${other}'`),'the units are stored');
    await next(p,'connect');
    const c0=await p.evaluate(()=>({link:!!document.querySelector('#su-link'),note:document.querySelector('#su-without').textContent,all:document.querySelector('#setup').textContent}));
    ok(c0.link&&/works without/.test(c0.note)&&/by hand/.test(c0.note)&&/no automatic photo reading/.test(c0.note)&&/no outfit photos/.test(c0.note),'Connection, not connected: a field for the invite link, and it says the app works without it and what is then missing');
    ok(!/worker|cloudflare|token|endpoint/i.test(c0.all),'in plain words');
    await p.fill('#su-link','hello there');await p.click('#su-connect');
    await p.waitForFunction(()=>!!document.querySelector('#setup .su-err'));
    ok(await p.evaluate(()=>!localStorage.getItem('worker_url')&&!localStorage.getItem('app_token')&&document.querySelector('#su-link').value==='hello there'),'text that is no invite link stores nothing and says so');
    await p.evaluate(()=>{connectFromLink=undefined});   // account.js is loaded now and would ask the server; this checks the fallback without it (tests/accounts.test.js covers connectFromLink)
    await p.fill('#su-link','https://app.example.test/#invite=abc123&w='+encodeURIComponent('https://server.example.test/api'));await p.click('#su-connect');
    await p.waitForFunction(()=>!!document.querySelector('#su-conn'));
    ok(await p.evaluate(()=>localStorage.getItem('worker_url')==='https://server.example.test/api'&&localStorage.getItem('app_token')==='abc123'),'an invite link is read without connectFromLink: its server address and code are stored');
    ok(/✓/.test(await p.textContent('#su-conn'))&&/Connected/.test(await p.textContent('#su-conn')),'and the step shows Connected with a tick');
    await next(p,'done');
    ok(await p.evaluate(()=>!document.querySelector('#su-skip')&&/Add my first item/.test(document.querySelector('#su-next').textContent)&&/no ties/.test(document.querySelector('.su-sum').textContent)&&/connected/.test(document.querySelector('.su-sum').textContent)),'the last step sums up the answers and offers to add the first item');
    await p.click('#su-next');
    await p.waitForFunction(()=>!document.querySelector('#setup.on')&&!document.querySelector('#add').hidden);
    ok(await stored(p,`s=>s.setupDone>0&&s.vestMode==='always'`),'Done stores setupDone (and keeps the vest that was chosen)');
    ok(await p.evaluate(()=>['header','main','nav'].every(s=>!document.querySelector(s).inert)&&document.querySelector('#n-add').classList.contains('on')),'and goes to the Add tab, the page usable again');
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
    await s.evaluate(()=>show('add'));
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
    ok(await rows()==='jacket- shirt- tie- pants- shoes-'&&/Get your first outfit/.test(await s.textContent('#firstrun h3')),'suit-and-tie person, empty wardrobe: "Get your first outfit" lists a jacket, shirt, tie, trousers and shoes');
    ok(await s.evaluate(()=>!document.querySelector('.fig')&&!/wardrobe is empty/i.test(document.querySelector('#today').textContent)),'in place of the grey sentence');
    await add(['sh1','shirt','white']);
    ok(await rows()==='jacket- shirt+ tie- pants- shoes-','adding a shirt ticks it; the card stays');
    await add(['su1','suit','navy']);
    ok(await rows()==='jacket+ shirt+ tie- shoes-','a suit ticks the jacket, and trousers are no longer asked for');
    await add(['t1','tie','burgundy']);
    ok(await rows()==='jacket+ shirt+ tie+ shoes-'&&/3 of 4 added/.test(await s.textContent('#firstrun .fr-sub')),'a tie: three of four');
    await add(['bs','shoes','black',{leather:'calf'}]);
    ok(await s.evaluate(()=>!document.querySelector('#firstrun')&&!!document.querySelector('.fig')),'with shoes a day can be planned: the checklist is gone and the outfit shows');
    // a blazer needs trousers
    await s.evaluate(`(()=>{const I=${I};items=[I('bz','blazer','navy'),I('sh1','shirt','white'),I('t1','tie','burgundy'),I('bs','shoes','black',{leather:'calf'})];cache={};show('today')})()`);
    ok(await rows()==='jacket+ shirt+ tie+ pants- shoes+','a blazer and no suit: trousers are still needed');
    // an item out of rotation doesn't count
    await s.evaluate(`(()=>{const I=${I};items=[I('su1','suit','navy'),I('sh1','shirt','white'),I('t1','tie','burgundy'),I('bs','shoes','black',{leather:'calf',paused:true})];cache={};show('today')})()`);
    ok(await rows()==='jacket+ shirt+ tie+ shoes-','shoes taken out of rotation don\'t tick the row');
    // no jackets, no ties
    await s.evaluate(()=>{items=[];settings.dress={jacket:false,tie:false};cache={};show('today')});
    ok(await rows()==='shirt- pants- shoes-','no-jacket, no-tie person: only a shirt, trousers and shoes are asked for');
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
    await h.click('#su-next');await h.waitForFunction(()=>!document.querySelector('#setup.on'));
    ok(await h.evaluate(()=>!document.querySelector('#today').hidden&&(settings.vestMode||'auto')==='auto'),'which goes to Today and leaves the vest setting alone');
    await h.context().close();

    /* ---- already connected (opened from an invite link); connectFromLink when the app has it ---- */
    const c=await open({},()=>{localStorage.setItem('worker_url','https://server.example.test/api');localStorage.setItem('app_token','abc123')});
    ok(await shown(c),'a fresh install that is already connected still gets the setup');
    await next(c,'week');await next(c,'wear');await next(c,'weather');await next(c,'connect');
    ok(await c.evaluate(()=>!!document.querySelector('#su-conn .su-tick')&&!document.querySelector('#su-link')),'its Connection step says Connected with a tick and asks for no link');
    await c.context().close();
    const f=await open();
    await f.evaluate(()=>{window.connectFromLink=async t=>{window._cl=t;if(!/good/.test(t))return false;localStorage.setItem('worker_url','https://server.example.test/api');localStorage.setItem('app_token','viaaccount');return true}});
    await next(f,'week');await next(f,'wear');await next(f,'weather');await next(f,'connect');
    await f.fill('#su-link','#invite=bad&w=https%3A%2F%2Fserver.example.test');await f.click('#su-connect');
    await f.waitForFunction(()=>!!document.querySelector('#setup .su-err'));
    ok(await f.evaluate(()=>window._cl==='#invite=bad&w=https%3A%2F%2Fserver.example.test'&&!localStorage.getItem('app_token')),'with connectFromLink in the app the link goes to it, and a refused code stores nothing');
    await f.fill('#su-link','good link');await f.click('#su-connect');await f.waitForFunction(()=>!!document.querySelector('#su-conn'));
    ok(await f.evaluate(()=>localStorage.getItem('app_token')==='viaaccount'),'an accepted one shows Connected');
    await f.context().close();

    /* ---- it steps aside when the app is driven past it ---- */
    const y=await open();
    ok(await shown(y),'fresh install: the setup');
    await y.evaluate(`(()=>{const I=${I};items=[I('su1','suit','navy')];cache={};show('today')})()`);
    ok(!await shown(y)&&await y.evaluate(()=>!settings.setupDone&&!document.querySelector('main').inert),'items arriving (a sync, a restore) close a setup that opened by itself, without marking it done');
    await y.context().close();
    const y2=await open();
    await y2.evaluate(()=>show('add'));
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
        if(k==='weather'){await v.fill('#su-city','Testv');await v.click('#su-find');await v.waitForFunction(()=>document.querySelectorAll('#su-cities button').length===1)}
        if(k==='connect'){await v.fill('#su-link','nothing');await v.click('#su-connect');await v.waitForFunction(()=>!!document.querySelector('#setup .su-err'))}
        if(!await noSide(v))bad.push(k)}
      const look=await v.evaluate(()=>{const e=document.querySelector('#setup'),cs=getComputedStyle(e),m=cs.backgroundColor.match(/\d+/g).map(Number),b=document.querySelector('#su-next').getBoundingClientRect(),r=e.getBoundingClientRect();
        return {dark:m[0]+m[1]+m[2]<200,h:b.height,inside:b.bottom<=innerHeight+0.5&&r.left>=0&&r.right<=innerWidth+0.5,w:r.width}});
      ok(!bad.length,`${width}px ${scheme}: no step of the setup scrolls sideways${bad.length?' (but: '+bad.join(', ')+')':''}`);
      ok(look.dark===(scheme==='dark')&&look.h>=44&&look.inside&&(width<600?look.w===width:look.w<width),`${width}px ${scheme}: the setup takes the theme, its buttons are 44px and on screen${width<600?'':' (a centred panel)'}`);
      await v.click('#su-next');await v.waitForFunction(()=>!document.querySelector('#setup.on')&&!document.querySelector('#add').hidden);
      await v.evaluate(()=>show('today'));await settle(v,200);const t=await noSide(v)&&await v.evaluate(()=>!!document.querySelector('#firstrun'));
      await v.evaluate(()=>show('wardrobe'));await settle(v,200);const wd=await noSide(v)&&await v.evaluate(()=>!!document.querySelector('#wempty'));
      ok(t&&wd,`${width}px ${scheme}: the checklist on Today and the empty Wardrobe card fit the width`);
      await v.context().close()}
  }finally{await browser.close()}
};
