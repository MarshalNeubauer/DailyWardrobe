// Days off: a country's public holidays (Nager.Date asked by the app; the worker's /holidays, from Google's public holiday
// calendars, for countries Nager lacks) and the user's own days off. A day off is planned like a weekend: no outfit, skipped
// when stepping through days, marked in the month, and not counted as worn. Holidays can be unticked; own days removed.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const ICS=['BEGIN:VCALENDAR','BEGIN:VEVENT','DTSTART;VALUE=DATE:20270225','DTEND;VALUE=DATE:20270226','DESCRIPTION:Public holiday','SUMMARY:National Day','END:VEVENT',
    'BEGIN:VEVENT','DTSTART;VALUE=DATE:20270310','DTEND;VALUE=DATE:20270313','DESCRIPTION:Public holiday\\nDate is tentative and may change.','SUMMARY:Eid al-Fitr (tentative)','END:VEVENT',
    'BEGIN:VEVENT','DTSTART;VALUE=DATE:20270208','DTEND;VALUE=DATE:20270209','DESCRIPTION:Observance\\nTo hide observances\\, go to',' Google Calendar Settings','SUMMARY:Ramadan Start (tentative)','END:VEVENT',
    'BEGIN:VEVENT','DTSTART;VALUE=DATE:20270120','DTEND;VALUE=DATE:20270121','DESCRIPTION:Public holiday in Some Region','SUMMARY:Regional Day','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const realFetch=globalThis.fetch,asked=[];
  globalThis.fetch=async href=>{const u=String(href);asked.push(u);
    if(/calendar\.google\.com/.test(u))return /en\.kw%23holiday/.test(u)?new Response(ICS,{status:200}):new Response('error',{status:500});
    return new Response('',{status:404})};
  const env={APP_TOKEN:'t'},HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    // ---- the worker ----
    const realNow=Date.now;Date.now=()=>+new Date('2026-11-10T09:00:00Z');
    const get=(q,tok='t')=>worker.fetch(new Request(HOST+'holidays'+q,{headers:tok?{'x-app-token':tok}:{}}),env);
    const kw=await get('?country=KW'),kj=await kw.json();Date.now=realNow;
    ok(kw.status===200&&kj.holidays.map(h=>h.date).join()==='2027-02-25,2027-03-10,2027-03-11,2027-03-12',`the worker lists a country's public holidays from its calendar, a three-day holiday day by day (${kj.holidays&&kj.holidays.map(h=>h.date).join()})`);
    ok(kj.holidays[0].name==='National Day'&&!kj.holidays.some(h=>/Ramadan|Regional/.test(h.name)),'observances and regional holidays are left out');
    ok(asked.some(u=>/en\.kw\.official/.test(u))&&asked.some(u=>/en\.kw%23/.test(u)),'it tries the official calendar first, then the general one');
    ok((await get('?country=KW','')).status===403&&(await get('?country=Kuwait')).status===400,'the holiday list needs the app token and a two-letter country code');
    const none=await get('?country=ZZ'),nj=await none.json();
    ok(none.status===404&&/own days off/.test(nj.holidaysError||''),'an unknown country gets a helpful error');
    // ---- the app ----
    const ctx=await browser.newContext({viewport:{width:390,height:900},locale:'en-US'});let nager=0;
    const US={2026:[{date:'2026-11-26',name:'Thanksgiving Day',global:true,types:['Public']},{date:'2026-12-25',name:'Christmas Day',global:true,types:['Public']},{date:'2026-11-27',name:'State Day',global:false,types:['Public']},{date:'2026-12-24',name:'Christmas Eve',global:true,types:['Observance']}],
      2027:[{date:'2027-01-01',name:"New Year's Day",global:true,types:['Public']},{date:'2027-01-18',name:'Martin Luther King, Jr. Day',global:true,types:['Public']}]};
    await ctx.route('https://date.nager.at/**',r=>{nager++;const m=r.request().url().match(/PublicHolidays\/(\d+)\/(\w+)/);
      if(m&&m[2]==='US')return r.fulfill({contentType:'application/json',body:JSON.stringify(US[m[1]]||[])});r.fulfill({status:204,body:''})});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');localStorage.setItem('last_sync',String(Date.now()))},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-23T12:00:00';cache={};sel=new Date(2026,10,23);view={y:2026,m:10};show('today')});
    const before=await p.evaluate(()=>!!planFor()['2026-11-26']&&isWorkday(new Date(2026,10,26)));
    await p.evaluate(()=>openSettings('daysoff'));
    ok(await p.locator('#cfg-country option').count()>200&&await p.evaluate(()=>[...document.querySelectorAll('#cfg-country option')].some(o=>o.value==='KW'&&o.textContent==='Kuwait')),'Settings has a country selector for public holidays');
    await p.selectOption('#cfg-country','US');await p.waitForFunction(()=>settings.holidays&&settings.holidays.list.length>0,null,{timeout:8000});
    await p.waitForSelector('#holiday-list .hrow',{timeout:8000});   // the list is drawn just after the data arrives
    const rows=await p.locator('#holiday-list .hrow').allTextContents();
    ok(rows.length===4&&/Thanksgiving Day/.test(rows[0])&&/Thu, Nov 26/.test(rows[0])&&!rows.some(r=>/State Day|Christmas Eve/.test(r)),`the country's upcoming public holidays are listed (national public holidays only): ${rows.join(' | ')}`);
    ok(/4 public holidays of United States count as days off/.test(await p.textContent('#holiday-msg')),'and it says they count as days off');
    await p.evaluate(()=>closeSettings());
    const off=await p.evaluate(()=>{const d=new Date(2026,10,26);sel=new Date(2026,10,25);renderToday();stepDay(1);const next=key(sel);
      monthOpen=false;toggleMonth();const cell=[...document.querySelectorAll('#mpanel .mc')].find(c=>/November 26/.test(c.getAttribute('aria-label')));
      openDay(+d);return {work:isWorkday(d),planned:!!planFor()['2026-11-26'],next,cls:cell.className,label:cell.getAttribute('aria-label'),msg:document.querySelector('#today .empty').textContent,name:offName(d)}});
    ok(before&&!off.work&&!off.planned,'a public holiday gets no outfit (it was a workday before)');
    ok(off.next==='2026-11-27','stepping through the days skips it');
    ok(/hol/.test(off.cls)&&/day off: Thanksgiving Day/.test(off.label)&&/A day off: Thanksgiving Day/.test(off.msg),`the month marks it and the day says why ("${off.msg}")`);
    // rotation: the suit planned for the day before is not held back for a holiday, and nothing is recorded as worn on it
    const rot=await p.evaluate(async()=>{TODAY_OVERRIDE='2026-11-30T12:00:00';cache={};sel=new Date(2026,10,30);view={y:2026,m:10};renderToday();
      // a day recorded as worn has its pieces (ids) or worn:true; a record with only a lock is the week lock (lockUpcoming), which on a
      // busy machine was put on the 26th before the holiday list came in: the planner skips the day all the same
      const worn=k=>{const r=dayRecs[k];return !!(r&&(r.ids||r.worn))};
      for(let k=0;k<100&&!worn('2026-11-27');k++)await new Promise(r=>setTimeout(r,50));   // past days are recorded in order: once the Friday is, the holiday before it has been passed over (a fixed 400 ms was too short on a busy machine)
      return {rec:worn('2026-11-26'),wed:worn('2026-11-25')}});
    ok(!rot.rec&&rot.wed,'nothing is recorded as worn on the holiday (the workday before it is)');
    // untick a holiday you work: it is planned again
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-23T12:00:00';cache={};dayRecs={};sel=new Date(2026,10,23);view={y:2026,m:10};renderToday();openSettings('daysoff')});
    await p.locator('#holiday-list .hrow input').first().uncheck();await p.waitForFunction(()=>settings.holidays.skip.length===1);
    ok(await p.evaluate(()=>{closeSettings();return isWorkday(new Date(2026,10,26))&&!!planFor()['2026-11-26']&&!isWorkday(new Date(2026,11,25))}),'unticking a holiday makes it a workday again; the others stay off');
    // your own days off: a range with a name, shown as one chip, removable
    await p.evaluate(()=>openSettings('daysoff'));await p.fill('#cfg-off-from','2026-12-07');await p.fill('#cfg-off-to','2026-12-09');await p.fill('#cfg-off-name','Trip');await p.click('.offadd button');
    await p.waitForFunction(()=>(settings.daysOff||[]).length===3&&!!document.querySelector('#off-list .fchip'));
    const own=await p.evaluate(()=>({chip:document.querySelector('#off-list .fchip').textContent,n:document.querySelectorAll('#off-list .fchip').length,off:[7,8,9].every(d=>!isWorkday(new Date(2026,11,d))),name:offName(new Date(2026,11,8)),plan:Object.keys(planMonth(2026,11)).filter(k=>/^2026-12-(7|8|9)$/.test(k)).length}));
    ok(own.n===1&&/Dec 7.*Dec 9.*Trip/.test(own.chip)&&own.off&&own.name==='Trip'&&own.plan===0,`a range of your own days off is added in one go (${own.chip})`);
    await p.fill('#cfg-off-from','2026-12-15');await p.click('.offadd button');await p.waitForFunction(()=>(settings.daysOff||[]).length===4&&document.querySelectorAll('#off-list .fchip').length===2);
    await p.click('#off-list .fchip button');await p.waitForFunction(()=>(settings.daysOff||[]).length===1);
    ok(await p.evaluate(()=>isWorkday(new Date(2026,11,8))&&!isWorkday(new Date(2026,11,15))),'a single day works too, and removing the range gives those days back');
    // saved with the settings (so it syncs and survives a reload)
    await p.evaluate(()=>saveUserSettings());await p.reload();await p.waitForFunction(()=>window.appReady);   // (the save from the last tap has finished)
    ok(await p.evaluate(()=>settings.holidays&&settings.holidays.country==='US'&&settings.holidays.skip.length===1&&settings.daysOff.length===1),'days off are saved with the settings');
    // a country Nager lacks comes from the worker
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-23T12:00:00';cache={};openSettings('daysoff')});const n0=nager;
    await p.selectOption('#cfg-country','KW');await p.waitForFunction(()=>settings.holidays&&settings.holidays.country==='KW'&&settings.holidays.list.length>0,null,{timeout:8000});
    ok(nager>n0&&await p.evaluate(()=>settings.holidays.list.some(h=>h.d==='2027-02-25'&&h.n==='National Day')&&!isWorkday(new Date(2027,1,25))&&settings.holidays.skip.length===0),'a country the first source lacks (Kuwait) is loaded through the worker');
    // the list is fetched again after a month, keeping what was unticked
    // (it syncs first, so a device that was away doesn't stamp its old settings over another device's newer ones: syncNow is a stand-in here)
    const again=await p.evaluate(async()=>{await toggleHoliday('2027-02-25',false);settings.holidays={...settings.holidays,fetched:Date.now()-40*864e5,list:settings.holidays.list.slice(0,2)};await metaPut('settings',settings);
      const real=syncNow;let synced=0;syncNow=async()=>{synced++;return true};try{await refreshHolidays()}finally{syncNow=real}
      return {n:settings.holidays.list.length,skip:settings.holidays.skip.join(),fresh:Date.now()-settings.holidays.fetched<60000,synced}});
    ok(again.n===4&&again.skip==='2027-02-25'&&again.fresh&&again.synced===1,'the holiday list refreshes after a month, after a sync, and keeps the days you unticked');
    const stay=await p.evaluate(async()=>{const real=syncNow,st=settings.holidays,stale={...st,fetched:Date.now()-40*864e5,list:st.list.slice(0,1)};
      // the sync brought another device's settings, which refreshed the list already: nothing is fetched or saved over them
      settings.holidays=stale;await metaPut('settings',{...settings,holidays:{...st,fetched:Date.now()}});
      syncNow=async()=>true;await refreshHolidays();const a=settings.holidays.list.length;
      // the sync failed (offline): not this time
      settings.holidays=stale;await metaPut('settings',settings);syncNow=async()=>false;await refreshHolidays();const b=settings.holidays.list.length;
      syncNow=real;settings.holidays=st;await metaPut('settings',settings);return {a,b,n:st.list.length}});
    ok(stay.a===stay.n&&stay.b===1,`no refetch when the synced settings are fresh already, or when the sync fails (${JSON.stringify(stay)})`);
    // choosing "No public holidays" turns them off
    await p.selectOption('#cfg-country','');await p.waitForFunction(()=>!settings.holidays&&!document.querySelector('#holiday-list .hrow'),null,{timeout:5000}).catch(()=>{});   // the list is redrawn after the setting clears
    ok(await p.evaluate(()=>isWorkday(new Date(2027,1,25))&&document.querySelectorAll('#holiday-list .hrow').length===0),'"No public holidays" makes them workdays again');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
