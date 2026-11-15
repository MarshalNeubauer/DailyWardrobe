// Fix round 2 (2026-11-15), Fixer 8: holidays fetched in December or January include the coming year (every year of the window is asked);
// a country picked in Settings is kept before its list arrives; workdays, dark shirts and the setup's dress switches are stored before the
// week's locks are released; the setup's country is stored with setupDone; a double tap on Next steps once; an interrupted "Run setup
// again" comes back with items in the wardrobe, and one not taken up is dropped; the Home Screen sheet after a link shows once; the city
// search clears on an empty search and stores a name found in Arabic in English.
module.exports=async({ok,chromium,url,settle})=>{
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
    ok(await h.evaluate(()=>JSON.stringify(holYears('2026-11-30','2028-01-31'))==='[2026,2027,2028]'&&JSON.stringify(holYears('2027-01-15','2028-02-15'))==='[2027,2028]'),'holYears lists every calendar year from one date to the other');
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
    await s.evaluate(()=>{window.clearLocks=()=>new Promise(()=>{});settings.workdays=[1,2,3,4,5];openSettings('schedule')});   // the locks never finish releasing
    await s.click('#cfg-workdays .dtog:nth-child(7)');
    ok(await stored(s,`s=>s.workdays.includes(6)`,3000),'a workday tapped is stored before the week\'s locks are released');
    await s.evaluate(()=>{setDarkShirts('never')});
    ok(await stored(s,`s=>s.darkShirts==='never'`,3000),'so is Dark shirts');
    await s.evaluate(()=>{closeSettings();setupOpen(true);setupGo(1);setupGo(1)});await s.waitForSelector('#su-sw-tie');
    await s.click('#su-sw-tie');
    ok(await stored(s,`s=>s.dress&&s.dress.tie===false`,3000),'and the setup\'s dress switch');
    await s.evaluate(()=>setupClose());
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
      setupOpen(true);setupGo(1)});
    await r.click('#su-workdays .su-day:nth-child(6)');await r.evaluate(()=>setupGo(1));
    ok(await stored(r,`s=>s.workdays.includes(5)`),'the re-run\'s tap is stored');
    await r.reload();await r.waitForFunction(()=>window.appReady);
    ok(await r.waitForFunction(()=>!!document.querySelector('#setup.on #su-cancel'),null,{timeout:5000}).then(()=>true,()=>false)&&await step(r)==='wear','with items in the wardrobe the cut-off re-run opens again where it was, with Cancel');
    await r.click('#su-cancel');
    ok(await stored(r,`s=>JSON.stringify(s.workdays)==='[0,1,2,3,4]'`),'and Cancel puts the workdays back');
    // a record that can't be taken up now (Settings open, a test without SETUP_AUTO…) is dropped: it never opens by itself later
    await r.evaluate(()=>{setupOpen(true);setupGo(1)});
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
