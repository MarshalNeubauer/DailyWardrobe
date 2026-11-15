// The new-user audit's fixes to the setup, the Home Screen guide, the tour and Settings' schedule, weather and days off (2026-11-15):
// the setup comes back where iOS cut it off and keeps a vest already chosen; a double tap on Skip doesn't open Settings; the last workday
// says why it stays; the summaries name the blazer days and the vest; "Run setup again" keeps the jeans switch and its Cancel undoes it;
// the tour speaks of what the person wears; About's tour goes back to About; the Home Screen app connecting mid-setup goes on with the
// account's answers; the Home Screen sheet never covers the setup; units follow the country; holidays (UK regions, Kuwait worked out on
// the phone, a country without a list, the year, a past day off); dates in English; the month starts on the work week's first day; the
// city search (repeats, Enter, Arabic).
module.exports=async({ok,chromium,url,settle})=>{
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
    await p.evaluate(()=>{delete settings.setupDone;setupOpen(false)});await p.waitForSelector('#su-skip');
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
    await v.evaluate(async()=>{settings.dress={jacket:true,tie:true,jeans:true};settings.workdays=[0,1,2,3,4];await saveUserSettings();setupOpen(true)});
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
    await c.evaluate(()=>{window.connectFromLink=async()=>{await new Promise(r=>setTimeout(r,50));items.push({id:'x1',type:'suit',primaryColor:'navy',pattern:'solid',added:1});cache={};show('today');
      localStorage.setItem('worker_url','https://server.example.test/');localStorage.setItem('app_token','abc');return true}});
    await next(c,'week');await next(c,'wear');await next(c,'weather');await next(c,'connect');
    await c.fill('#su-link','#invite=x&w=y');await c.click('#su-connect');await c.waitForSelector('#su-conn');
    ok(await c.evaluate(()=>!!document.querySelector('#setup.on')&&/came across: 1 item/.test(document.querySelector('#su-step').textContent)),'connected at the Connection step, the setup stays and says the wardrobe came across');
    await next(c,'done');ok(/^Done$/.test((await c.textContent('#su-next')).trim()),'and goes on to All set');
    await c.context().close();

    /* ---- the Home Screen sheet never covers the setup ---- */
    const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
    const h=await open({userAgent:IPHONE});
    await h.evaluate(()=>{homeScreenGuide()});
    ok(await h.evaluate(()=>!!document.querySelector('#setup.on')&&!document.querySelector('#kitsheet.on')&&!(document.querySelector('#ask-ok')&&document.querySelector('#ask-ok').offsetParent)),'the Home Screen guide isn\'t shown over the setup (its own Home Screen step says it)');
    await h.evaluate(()=>{setupClose();homeScreenGuide()});await h.waitForSelector('#kitsheet.on');
    const steps=await h.evaluate(()=>[...document.querySelectorAll('#kitsheet .home-steps li')].map(l=>l.textContent));
    ok(steps.length===4&&/⋯/.test(steps[0])&&/Open as Web App/.test(steps[2]),'elsewhere it is the kit sheet, its steps one per line ('+steps.length+')');
    await h.evaluate(()=>{items=[{id:'i1',type:'tie',primaryColor:'navy',pattern:'solid',added:1}];kitDraw()});
    ok(/Your wardrobe stays here in Safari/.test(await h.textContent('#kitsheet'))&&/Download backup/.test(await h.textContent('#kitsheet')),'not connected with a wardrobe: it says the wardrobe stays in Safari and how to take it along');
    await h.evaluate(()=>{items=[];kitClose();delete settings.setupDone;setupOpen(false)});await h.waitForSelector('#setup.on');
    ok(!h.errs.length,'no page errors: '+h.errs.join(' | '));await h.context().close();

    /* ---- units follow the country ---- */
    const u=await open({timezoneId:'Asia/Kuwait',locale:'en-US'},null,false);
    const un=await u.evaluate(()=>{const a=unit();settings.location={lat:40.7,lon:-74,name:'New York, New York, US',cc:'US'};const b=unit();settings.location={lat:29.4,lon:47.9,name:'Kuwait City, Al Asimah, KW'};const c=unit();settings.location=null;settings.units='F';const d=unit();delete settings.units;return [a,b,c,d].join()});
    ok(un==='C,F,C,F',`°C on an English (US) phone in Kuwait's time zone, °F for a US location, the location's country from its name, and a chosen unit wins (${un})`);
    /* ---- holidays ---- */
    const hol=await u.evaluate(()=>{const gb=nagerKeep([{date:'2027-01-01',name:"New Year's Day",localName:"New Year's Day",global:false,counties:['GB-ENG','GB-NIR','GB-SCT','GB-WLS'],types:['Public']},
        {date:'2027-03-29',name:'Easter Monday',localName:'Easter Monday',global:false,counties:['GB-ENG','GB-NIR','GB-WLS'],types:['Public']},{date:'2027-11-30',name:"Saint Andrew's Day",localName:"Saint Andrew's Day",global:false,counties:['GB-SCT'],types:['Public']},
        {date:'2026-12-26',name:"St. Stephen's Day",localName:'Boxing Day',global:true,types:['Public']}],'GB').map(h=>h.n);
      const fr=nagerKeep([{date:'2027-01-01',name:"New Year's Day",localName:'Jour de l’an',global:true,types:['Public']}],'FR').map(h=>h.n);
      const kw=builtinHolidays('KW','2026-01-01','2027-12-31');return {gb,fr,kw}});
    ok(hol.gb.join('|')==="New Year's Day|Easter Monday|Boxing Day",`UK: a holiday of most of the nations counts, one nation's doesn't, and its own name is used (${hol.gb.join('|')})`);
    ok(hol.fr[0]==="New Year's Day",'elsewhere the English name');
    const kd=Object.fromEntries(hol.kw.map(x=>[x.d,x.n]));
    ok(kd['2026-02-25']==='National Day'&&kd['2026-03-20']==='Eid al-Fitr'&&kd['2026-05-26']==='Arafat Day'&&kd['2026-05-27']==='Eid al-Adha'&&kd['2026-06-16']==='Islamic New Year'&&kd['2027-03-09']==='Eid al-Fitr',`Kuwait's holidays are worked out on the phone, Islamic days from the Umm al-Qura calendar (${hol.kw.length} days)`);
    await u.evaluate(()=>{TODAY_OVERRIDE='2026-11-15T12:00:00';cache={}});
    await u.evaluate(()=>setHolidayCountry('KW'));
    ok(await u.evaluate(()=>settings.holidays.country==='KW'&&settings.holidays.list.some(h=>h.n==='Liberation Day')),'not connected, picking Kuwait gives its list (none came before)');
    await u.evaluate(()=>setHolidayCountry('KP'));
    const kp=await u.evaluate(()=>({cc:settings.holidays.country,n:settings.holidays.list.length,msg:holidayMsg}));
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
    ok(await u.evaluate(()=>geoName(29.375,47.98)==='your location (29.38° N, 47.98° E)'),'"Use my location" names the spot, not "your current location" forever');
    await u.evaluate(()=>closeSettings());
    ok(!u.errs.length,'no page errors: '+u.errs.join(' | '));await u.context().close();

    /* ---- dates in English on an Arabic phone; the month starts on the work week's first day ---- */
    const a=await open({locale:'ar-KW',timezoneId:'Asia/Kuwait'},null,false);
    const ad=await a.evaluate(()=>({d:shortDate(new Date(2026,10,15)),l:new Date(2026,10,15).toLocaleDateString(undefined,{month:'long',year:'numeric'})}));
    ok(/^Sun/.test(ad.d)&&/15/.test(ad.d)&&/November 2026/.test(ad.l)&&!/[؀-ۿ٠-٩]/.test(ad.d+ad.l),`an Arabic-language phone gets dates in English with Latin digits (${ad.d}; ${ad.l})`);
    const wk=await a.evaluate(()=>{settings.workdays=[1,2,3,4,5];monthPanel={y:2026,m:10};const g1=monthGridHtml();settings.workdays=[0,1,2,3,4];const g2=monthGridHtml();
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
