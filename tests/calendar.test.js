// Calendar import (2026-11-17, the owner's ask): a calendar subscription link (.ics) shared once; the server (POST /calendar, worker/calendar.js)
// reads it and gives back only the next 60 days' events; the app matches them to occasions, days off and trips, and applies only what is kept.
// No real calendar is ever fetched: made-up fixtures (tests/fixtures/calendar/*.ics) and a mocked fetch. CAL_SHOTS=<folder> saves the
// walkthrough's cards at 390 px (light and dark).
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const FIX=f=>fs.readFileSync(path.join(__dirname,'fixtures','calendar',f),'utf8');
const NOW=Date.UTC(2026,10,20,6,0,0);   // the server's clock in these checks: Friday, November 20 2026, 9:00 in Kuwait

/* ---- the parser: all-day, timed, multi-day, a weekly rule with an EXDATE, a daily rule with COUNT and a moved instance, time zones
   (IANA, Windows names, a VTIMEZONE of its own, UTC), folded lines, escaped text, cancelled events, the 60-day window ---- */
const parse=async({ok,ROOT})=>{
  const m=await import(pathToFileURL(path.join(ROOT,'worker','calendar.js')).href);
  const ev=m.calEvents(FIX('personal.ics'),'Asia/Kuwait','2026-11-20','2027-01-19'),by=t=>ev.filter(e=>e.title===t);
  const w=by("Sam & Alex's Wedding")[0];
  ok(w&&w.start==='2026-11-28'&&w.end==='2026-11-28'&&w.allDay&&w.days===1&&w.location==='Garden Hall, Salmiya',`an all-day event: its day, all-day, its place with "\\," read as a comma (${JSON.stringify(w)})`);
  const f=by('Funeral of a family friend')[0];
  ok(f&&f.start==='2026-11-24'&&f.time==='16:00'&&!f.allDay&&f.location==='Mosque; east gate',`a timed event in its TZID, "\\;" read as a semicolon (${JSON.stringify(f)})`);
  const g=by('Annual gala, black tie')[0];
  ok(g&&g.start==='2026-11-26'&&g.end==='2026-11-26'&&g.time==='20:00',`a UTC time is moved into the person's zone (17:00Z = 20:00 in Kuwait), and an evening past midnight stays that evening's day (${JSON.stringify(g)})`);
  const v=by('Vacation')[0];
  ok(v&&v.start==='2026-12-13'&&v.end==='2026-12-17'&&v.days===5,`a multi-day all-day event ends the day before its DTEND (${v&&v.start+'..'+v.end})`);
  const dd=by('Dress down Thursday').map(e=>e.start);
  ok(dd.join()==='2026-11-26,2026-12-10,2026-12-17,2026-12-24,2026-12-31,2027-01-07,2027-01-14',`a weekly rule repeats every Thursday in the window, its EXDATE (Dec 3) left out (${dd.join()})`);
  ok(new Set(by('Dress down Thursday').map(e=>e.id)).size===dd.length,'each instance of a repeating event has its own id (a dismissal is per instance)');
  const su=ev.filter(e=>/^Stand-up/.test(e.title)).map(e=>e.start+' '+e.time+' '+e.title);
  ok(su.join('|')==='2026-11-22 09:00 Stand-up|2026-11-23 11:00 Stand-up (moved)|2026-11-24 09:00 Stand-up',`a daily rule with COUNT=3, the instance a RECURRENCE-ID moved shown once, at its new time (${su.join('|')})`);
  ok(by('Stand-up (moved)')[0].id===m.calEvents(FIX('personal.ics').replace(/BEGIN:VEVENT\nUID:standup@example\.test\nDTSTAMP:20261101T090000Z\nRECURRENCE-ID[\s\S]*?END:VEVENT\n/,''),'Asia/Kuwait','2026-11-20','2027-01-19').find(e=>e.start==='2026-11-23'&&/^Stand-up/.test(e.title)).id,
    'a moved instance keeps the id of the day it replaced (a dismissal stays with it)');
  ok(ev.some(e=>e.title==='A meeting with a very long title that a calendar program folds over more than one line of the file'),'folded lines are joined');
  ok(!ev.some(e=>/called off|far away|Alarm text/.test(e.title)),'a cancelled event, one after the 60-day window and an alarm\'s text are left out');
  ok(ev.every(e=>Object.keys(e).sort().join()==='allDay,days,end,id,location,start,time,title'&&/^[0-9a-f]{16}$/.test(e.id)),'each event carries only its id, title, dates, all-day, time, place and length: no description, no UID');
  ok(!JSON.stringify(ev).includes('gift list')&&!JSON.stringify(ev).includes('example.test'),'the description (private notes) and the calendar\'s own UIDs never come out');
  const o=m.calEvents(FIX('outlook.ics'),'Asia/Kuwait','2026-11-20','2027-01-19'),ot=t=>o.find(e=>e.title===t)||{};
  ok(ot('Interview with the board').time==='23:00'&&ot('Interview with the board').start==='2026-12-01',`a Windows zone name (Outlook's "Arab Standard Time") is read (${JSON.stringify(ot('Interview with the board'))})`);
  ok(ot('Call in an odd zone').time==='21:00',`a zone Intl doesn't know is read from the calendar's own VTIMEZONE (+05:00, so 21:00 in Kuwait: ${ot('Call in an odd zone').time})`);
  ok(ot('Flight KU 101 to London').start==='2026-12-06'&&ot('Flight KU 101 to London').time==='08:00','a flight in UTC lands on its Kuwait day and time');
  const crlf=m.calEvents(FIX('personal.ics').replace(/\n/g,'\r\n'),'Asia/Kuwait','2026-11-20','2027-01-19');
  ok(crlf.length===ev.length&&crlf.map(e=>e.id).join()===ev.map(e=>e.id).join(),'CRLF line ends read the same');
  const ny=m.calEvents(FIX('personal.ics'),'America/New_York','2026-11-20','2027-01-19').find(e=>e.title==='Funeral of a family friend');
  ok(ny&&ny.time==='08:00','the same event read for a person in New York is at 8:00 there');
  ok(m.calUrl('webcal://p01-caldav.example.test/published/2/abc').href==='https://p01-caldav.example.test/published/2/abc'&&m.calUrl('http://cal.example.test/a.ics').protocol==='https:'
    &&!m.calUrl('https://localhost/a.ics')&&!m.calUrl('https://10.0.0.2/a.ics')&&!m.calUrl('https://user:pw@cal.example.test/a.ics')&&!m.calUrl('ftp://cal.example.test/a.ics')&&!m.calUrl('javascript:alert(1)'),
    'a link is read as https, and only on a public host (no IP address, localhost, user name or other scheme)');
};

/* ---- the route: auth, the window, the rate limit and cache, the link never echoed or logged, no KV writes ---- */
const route=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,cm=await import(pathToFileURL(path.join(ROOT,'worker','calendar.js')).href);
  cm.calReset();
  const SECRET='S3cr3tT0kenXYZ',LINK=`webcal://cal.example.test/private/${SECRET}/basic.ics`;
  const realFetch=globalThis.fetch,realNow=Date.now,logs=[],realLog=console.log,realWarn=console.warn,realErr=console.error;let asked=[];
  globalThis.fetch=async(href,init)=>{const u=String(href);asked.push(u);
    if(u===`https://cal.example.test/private/${SECRET}/basic.ics`)return new Response(FIX('personal.ics'),{status:200,headers:{'content-type':'text/calendar'}});
    if(u==='https://cal.example.test/moved.ics')return new Response('',{status:302,headers:{location:'https://192.168.1.4/x.ics'}});
    if(u==='https://cal.example.test/gone.ics')return new Response('no',{status:404});
    if(u==='https://cal.example.test/page.ics')return new Response('<html>hello</html>',{status:200,headers:{'content-type':'text/html'}});
    if(u==='https://cal.example.test/down.ics')throw new TypeError('fetch failed for https://cal.example.test/down.ics');
    return new Response('',{status:404})};
  const cap=(...a)=>logs.push(a.map(String).join(' '));console.log=cap;console.warn=cap;console.error=cap;
  Date.now=()=>NOW;
  let writes=0;const store=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'||(t&&t.type==='json')?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{writes++;store.set(k,v)},delete:async k=>{store.delete(k)},list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const env={APP_TOKEN:'o',WARDROBE:KV},HOST='https://w.test/';
  const post=(body,tok='o')=>worker.fetch(new Request(HOST+'calendar',{method:'POST',headers:{'content-type':'application/json',...(tok?{'x-app-token':tok}:{})},body:JSON.stringify(body)}),env);
  const J=async r=>{const text=await r.text();let j={};try{j=JSON.parse(text)}catch{}return {s:r.status,text,...j}};
  try{
    ok((await post({url:LINK},'')).status===403&&(await post({url:LINK},'wrong')).status===403,'the route needs the owner\'s code or a tester\'s');
    ok((await worker.fetch(new Request(HOST+'calendar?url='+encodeURIComponent(LINK),{headers:{'x-app-token':'o'}}),env)).status===405,'GET /calendar (a link in the address) is refused: only POST, the link in the body');
    const code=(await J(await post0(worker,env,HOST))).code,w0=writes;
    const a=await J(await post({url:LINK,tz:'Asia/Kuwait'}));
    ok(a.s===200&&a.from==='2026-11-20'&&a.to==='2027-01-19'&&a.events.length===17,`the owner's calendar: the events from today to 60 days ahead (${a.s} ${a.from}..${a.to}, ${a.events&&a.events.length})`);
    ok(asked.length===1&&asked[0]===`https://cal.example.test/private/${SECRET}/basic.ics`,'webcal:// is fetched as https://');
    ok(!a.text.includes(SECRET)&&!a.text.includes('cal.example.test')&&!a.text.includes('gift list'),'the answer never holds the link, its host or the event descriptions');
    const b=await J(await post({url:LINK,tz:'Asia/Kuwait'}));
    ok(b.s===200&&b.cached===true&&asked.length===1,'the same link read again within 10 minutes is answered from memory (no second fetch)');
    const t=await J(await post({url:LINK,tz:'Asia/Kuwait'},code));
    ok(t.s===200&&t.events.length===17&&asked.length===2,'a tester may read a calendar too (their own read, not the owner\'s cached answer)');
    asked=[];let last=null;for(let i=0;i<cm.CAL_RATE_N+1;i++)last=await post({url:LINK,tz:'Asia/Kuwait',fresh:true},code);const lj=await J(last);
    ok(lj.s===200&&lj.cached===true&&asked.length===cm.CAL_RATE_N-1,`over ${cm.CAL_RATE_N} reads in 10 minutes a person gets the last answer from memory, without another fetch (${asked.length} fetched)`);
    const nohit=await J(await post({url:'https://cal.example.test/gone.ics',tz:'Asia/Kuwait'},code));
    ok(nohit.s===429&&/several times/.test(nohit.message),`and a new link is refused for a few minutes (429: "${nohit.message}")`);
    cm.calReset();
    const bad=await J(await post({url:'https://localhost/a.ics'})),ip=await J(await post({url:'http://127.0.0.1/a.ics'})),junk=await J(await post({url:'not a link'}));
    ok(bad.s===400&&ip.s===400&&junk.s===400&&/calendar link/.test(bad.message),'a link that isn\'t on the public web, or isn\'t a link, is refused before anything is fetched');
    const mv=await J(await post({url:'https://cal.example.test/moved.ics'}));
    ok(mv.s===400&&!asked.some(u=>/192\.168/.test(u)),'a redirect to a private address is not followed');
    const gone=await J(await post({url:'https://cal.example.test/gone.ics'})),page=await J(await post({url:'https://cal.example.test/page.ics'})),down=await J(await post({url:'https://cal.example.test/down.ics'}));
    ok(gone.s===502&&/no longer works/.test(gone.message)&&page.s===422&&/didn’t give a calendar/.test(page.message)&&down.s===502,`a link that's gone, a web page and an unreachable host each say so in plain words (${gone.s} ${page.s} ${down.s})`);
    ok(![gone,page,down,mv,bad].some(x=>x.text.includes('cal.example.test')),'no error answer repeats the link');
    ok(!logs.some(l=>l.includes(SECRET)||l.includes('cal.example.test')),`nothing the server logged holds the link or its host (${logs.length} lines: ${logs.join(' | ').slice(0,200)})`);
    ok(writes===w0,`reading calendars wrote nothing to KV (${writes-w0} writes)`);
    const big=await J(await worker.fetch(new Request(HOST+'calendar',{method:'POST',headers:{'x-app-token':'o'},body:'{"url":"'+'a'.repeat(9000)+'"}'}),env));
    ok(big.s===400,'a body over 8 KB is refused');
  }finally{globalThis.fetch=realFetch;Date.now=realNow;console.log=realLog;console.warn=realWarn;console.error=realErr;cm.calReset()}
};
/* an invitation for a tester (one KV write) */
const post0=(worker,env,HOST)=>worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'content-type':'application/json','x-app-token':'o'},body:JSON.stringify({name:'Tess'})}),env);

/* ---- the app: Settings → Calendar, the masked link, the review list through the real functions, dismissals, Today's banner, the walkthrough ---- */
const app=async({ok,chromium,url,ROOT,settle})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default,cm=await import(pathToFileURL(path.join(ROOT,'worker','calendar.js')).href);cm.calReset();
  const SECRET='AppS3cr3tQQ',LINK=`webcal://cal.example.test/p/${SECRET}/basic.ics`;
  const realFetch=globalThis.fetch,realNow=Date.now;let reads=0;
  globalThis.fetch=async href=>{const u=String(href);if(u===`https://cal.example.test/p/${SECRET}/basic.ics`){reads++;return new Response(FIX('personal.ics'),{status:200})}return new Response('',{status:404})};
  const env={APP_TOKEN:'o'},HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:860},locale:'en-US',timezoneId:'Asia/Kuwait'});
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','o');localStorage.setItem('last_sync',String(Date.now()))},HOST);
    // the server's clock is fixed for the reads (the window starts on the app's "today", Nov 20); backups are left out (no KV here)
    await ctx.route(HOST+'**',async r=>{const q=r.request(),u=new URL(q.url());if(u.pathname==='/sync')return r.fulfill({status:503,body:'{}'});
      Date.now=()=>NOW;let res;try{res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env)}finally{Date.now=realNow}
      await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.location={name:'Kuwait City, KW',lat:29.37,lon:47.98};HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-20T09:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,22);HOOK.show('today')});
    // spies on the app's own functions: keeping an event goes through them (calendar.js asks daysoff.js and pack.js through bus.js
    // sockets since the restructure S6c, so the spy serves them in their place, calling the real ones; setOccasion, history.js's, is
    // imported: what it set is read from the day records below)
    await p.evaluate(async()=>{window.__calls=[];window.__real={dayOffAdd:HOOK.dayOffAdd,packSetTrip:HOOK.packSetTrip};const s=document.createElement('script');s.type='module';
      s.textContent=`import {serve} from './bus.js';for(const [k,f] of [['day-off-add','dayOffAdd'],['pack-set-trip','packSetTrip']])serve(k,(...a)=>{__calls.push([f,...a]);return __real[f](...a)});window.__spied=1;`;
      document.head.appendChild(s);for(let i=0;i<100&&!window.__spied;i++)await new Promise(r=>setTimeout(r,20))});
    await p.evaluate(()=>HOOK.openSettings('calendar'));await settle(p,300);
    const s0=await p.evaluate(()=>({field:!!HOOK.$('#cal-link'),btn:!!HOOK.$('#cal-connect')&&!HOOK.$('#cal-connect').disabled,sum:HOOK.$('#sum-calendar').textContent,guides:[...document.querySelectorAll('.cal-guides button')].map(b=>b.textContent)}));
    ok(s0.field&&s0.btn&&s0.sum==='Not connected'&&s0.guides.join()==='iPhone (iCloud),Google,Outlook',`Settings → Calendar: a link field, Connect, and how to get the link for iPhone, Google and Outlook (${JSON.stringify(s0)})`);
    await p.fill('#cal-link','not a link');await p.click('#cal-connect');
    ok(/doesn’t look like a calendar link/.test(await p.textContent('#cal-msg'))&&reads===0,'a pasted text that isn\'t a link is turned down on the phone');
    await p.fill('#cal-link',LINK);await p.click('#cal-connect');
    await p.waitForFunction(()=>/^Connected/.test((HOOK.$('#cal-msg')||{}).textContent||''),null,{timeout:10000});
    const s1=await p.evaluate(()=>({masked:HOOK.$('#cal-masked').textContent,field:!!HOOK.$('#cal-link'),status:HOOK.$('#cal-status').textContent,msg:HOOK.$('#cal-msg').textContent,stored:HOOK.settings.calendar&&HOOK.settings.calendar.url,
      stamped:!!(HOOK.settings.ks&&HOOK.settings.ks.calendar),html:document.documentElement.outerHTML,ls:localStorage.getItem('cal_last')||'',rows:[...document.querySelectorAll('#cal-new-list .cal-row')].map(r=>r.querySelector('b').textContent+' '+r.querySelector('.cal-to').textContent)}));
    ok(s1.stored===LINK&&s1.stamped,'Connect keeps the link in the settings, stamped like any setting (so it syncs to the person\'s other devices)');
    ok(s1.masked==='cal.example.test/…'&&!s1.field,`once saved the link is shown only by where it points ("${s1.masked}"), and the field is gone`);
    ok(!s1.html.includes(SECRET)&&!s1.ls.includes(SECRET)&&!s1.ls.includes('cal.example.test/p'),'the secret part of the link is nowhere on the page or in what the phone keeps of the last read');
    ok(/^Last read .* · 0 events used$/.test(s1.status),`the status line ("${s1.status}")`);
    const want=["Funeral of a family friend → Funeral","Dress down Thursday → Casual day: no jacket or tie","Annual gala, black tie → Formal day","Sam & Alex's Wedding → Saturday isn’t a workday: no outfit to plan","Cousin's wedding → Wedding day","Retail conference → Trip: a packing list for those days"];
    ok(want.every(w=>s1.rows.includes(w)),`the review list says what each event would set (${s1.rows.slice(0,8).join(' | ')})`);
    ok(!s1.rows.some(r=>/Stand-up|meeting/.test(r)),'events that don\'t change what is worn are not listed');
    ok(await p.evaluate(()=>{const r=[...document.querySelectorAll('#cal-new-list .cal-row')].find(x=>/Sam & Alex/.test(x.textContent));return !!r&&!r.querySelector('.cal-ok')&&!!r.querySelector('.cal-no')}),'an occasion on a day that isn\'t a workday can only be dismissed');
    // a workday of the week that is a day off gives the real reason: a made-up holiday by its name, the person's own day off as theirs
    const offw=await p.evaluate(()=>{const h=HOOK.settings.holidays,o=HOOK.settings.daysOff;
      try{HOOK.settings.holidays={country:'ZZ',list:[{d:'2026-11-25',n:'Made-up Founders Day'}],skip:[]};HOOK.settings.daysOff=[{d:'2026-12-01',n:'Dentist'}];
        const w=(d,k)=>HOOK.calPlan({...HOOK.CAL_X,ev:{id:'t'+d,title:'T',start:d,end:d,days:1},k,label:'Wedding day'});
        const a=w('2026-11-25','wedding'),b=w('2026-12-01','funeral'),c=w('2026-11-28','wedding');
        return {a:a.what,b:b.what,c:c.what,can:a.can||b.can||c.can}}finally{HOOK.settings.holidays=h;HOOK.settings.daysOff=o}});
    ok(offw.a==='a day off (Made-up Founders Day): no outfit to plan'&&offw.b==='a day off (your day off): no outfit to plan'&&offw.c==='Saturday isn’t a workday: no outfit to plan'&&!offw.can,
      `an occasion on a weekday that is a day off says why: the holiday's name, or "your day off"; a Saturday still says it isn't a workday (${JSON.stringify(offw)})`);
    // Today's banner, before anything is kept
    await p.evaluate(()=>{HOOK.closeSettings();HOOK.sel=new Date(2026,10,22);HOOK.renderToday()});
    const ban=await p.evaluate(()=>(HOOK.$('#cal-new')||{}).textContent||'');
    ok(/^\d+ new calendar events?Review$/.test(ban),`Today shows a small banner with the new events ("${ban}")`);
    await p.click('#cal-new button');await settle(p,300);
    ok(await p.evaluate(()=>HOOK.settingsOpen()&&HOOK.$('#sc-calendar').classList.contains('open')),'Review opens Settings → Calendar');
    const keep=async t=>{await p.evaluate(t=>{const r=[...document.querySelectorAll('#cal-new-list .cal-row')].find(x=>x.querySelector('b').textContent===t);r.querySelector('.cal-ok').click()},t);
      await p.waitForFunction(t=>![...document.querySelectorAll('#cal-new-list .cal-row')].some(x=>x.querySelector('b').textContent===t),t,{timeout:8000})};
    await keep('Funeral of a family friend');await keep('Annual gala, black tie');await keep("Cousin's wedding");await keep('Vacation');await keep('Retail conference');
    const k=await p.evaluate(()=>({calls:__calls.map(c=>c.slice(0,3).join(' ')),f:HOOK.dayRecs['2026-11-24']&&HOOK.dayRecs['2026-11-24'].occasion,g:HOOK.dayRecs['2026-11-26']&&HOOK.dayRecs['2026-11-26'].formal,w:HOOK.dayRecs['2026-12-2']&&HOOK.dayRecs['2026-12-2'].occasion,
      off:(HOOK.settings.daysOff||[]).filter(x=>x.d>='2026-12-13'&&x.d<='2026-12-17').map(x=>x.d+' '+x.n),trip:HOOK.packTrip(),seen:Object.values(HOOK.settings.calSeen||{}).filter(v=>v==='k').length}));
    ok(k.f==='funeral'&&k.g===true&&k.w==='wedding',
      `✓ sets the funeral, the formal day and the wedding on their days, as a day set by hand (setOccasion: ${JSON.stringify([k.f,k.g,k.w])})`);
    ok(k.off.length===5&&k.off[0]==='2026-12-13 Vacation'&&k.calls.includes('dayOffAdd 2026-12-13 2026-12-17'),`✓ on the vacation adds its days off through dayOffAdd (${k.off.join(', ')})`);
    ok(k.trip.a==='2026-12-07'&&k.trip.b==='2026-12-09'&&k.calls.includes('packSetTrip 2026-12-07 2026-12-09'),`✓ on the conference in Dubai sets the Packing list's trip (${JSON.stringify(k.trip)})`);
    ok(k.seen===5,'each kept event is remembered by its id');
    // a dismissal
    const dId=await p.evaluate(()=>{const r=[...document.querySelectorAll('#cal-new-list .cal-row')].find(x=>/Dress down/.test(x.textContent));const id=r.querySelector('.cal-no').dataset.id;r.querySelector('.cal-no').click();return id});
    await p.waitForFunction(id=>HOOK.settings.calSeen&&HOOK.settings.calSeen[id]==='x',dId,{timeout:5000});
    const st=await p.evaluate(()=>HOOK.$('#cal-status').textContent);
    ok(/ · 5 events used$/.test(st),`the status counts the events used ("${st}")`);
    // Today on a trip day: the note; the banner counts what is left
    await p.evaluate(()=>{HOOK.closeSettings();HOOK.sel=new Date(2026,11,8);HOOK.renderToday()});
    ok(/^Trip: Retail conference · Packing list$/.test(await p.evaluate(()=>(HOOK.$('#cal-trip')||{}).textContent||'')),'a day of a kept trip says so on Today, with the Packing list');
    // after a restart: the link, the kept and the dismissed are still there (settings stored), the last read on this phone
    await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{HOOK.settings.workdays=[0,1,2,3,4];HOOK.TODAY_OVERRIDE='2026-11-20T09:00:00';HOOK.cache={};HOOK.openSettings('calendar')});await settle(p,300);
    const r1=await p.evaluate(id=>({seen:HOOK.settings.calSeen&&HOOK.settings.calSeen[id],url:HOOK.settings.calendar&&HOOK.settings.calendar.url,gone:[...document.querySelectorAll('.cal-row.gone')].map(r=>r.querySelector('b').textContent),
      newIds:HOOK.calNew().map(x=>x.ev.id)}),dId);
    ok(r1.seen==='x'&&r1.url===LINK&&r1.gone.includes('Dress down Thursday')&&!r1.newIds.includes(dId),'after a restart the dismissal is remembered and the event isn\'t offered again');
    // the setting syncs entry by entry: two phones' choices merge
    const mg=await p.evaluate(()=>{const a=JSON.parse(JSON.stringify(HOOK.settings)),b=JSON.parse(JSON.stringify(HOOK.settings));
      a.calSeen={...a.calSeen,'aaaaaaaaaaaaaaaa':'k'};HOOK.stampSettings(a,Date.now()+1000);b.calSeen={...b.calSeen,'bbbbbbbbbbbbbbbb':'x'};HOOK.stampSettings(b,Date.now()+2000);
      const m=HOOK.mergeSettings(a,b);const c=HOOK.cleanSettings({calendar:{url:'javascript:alert(1)'},calSeen:{'<x>':'k',ffffffffffffffff:'k',eeeeeeeeeeeeeeee:'maybe'}});
      return {a:m.calSeen.aaaaaaaaaaaaaaaa,b:m.calSeen.bbbbbbbbbbbbbbbb,url:m.calendar.url===HOOK.settings.calendar.url,bad:c.calendar.url===undefined,seen:Object.keys(c.calSeen).join()}});
    ok(mg.a==='k'&&mg.b==='x'&&mg.url,'kept and dismissed events made on two phones both survive a sync (merged entry by entry), the link with them');
    ok(mg.bad&&mg.seen==='ffffffffffffffff','settings coming in keep only a webcal/https link and well-formed marks');
    // the walkthrough: each guide's cards at 390 and 320 px, light and dark, nothing wider than the screen
    const shots=process.env.CAL_SHOTS;
    for(const [w,theme] of [[390,'light'],[390,'dark'],[320,'light'],[320,'dark']]){
      await p.setViewportSize({width:w,height:800});await p.emulateMedia({colorScheme:theme});
      for(const g of ['icloud','google','outlook']){
        await p.evaluate(g=>{HOOK.openSettings('calendar');HOOK.calGuide(g)},g);await settle(p,200);
        const n=await p.evaluate(()=>HOOK.kit.cards.length);
        for(let i=0;i<n;i++){
          const c=await p.evaluate(()=>{const s=HOOK.$('#kitsheet'),pic=s.querySelector('.kit-pic svg');return {t:s.querySelector('#kit-title').textContent,wide:s.scrollWidth>s.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,pic:!!pic&&pic.getBoundingClientRect().width<=innerWidth,body:s.querySelector('.kit-body').textContent}});
          ok(!c.wide&&c.pic&&c.t,`${g} card ${i+1} "${c.t}" fits at ${w} px (${theme})`);
          if(shots&&w===390){fs.mkdirSync(shots,{recursive:true});await p.screenshot({path:path.join(shots,`${g}-${i+1}-${theme}.png`)})}
          if(i<n-1){await p.waitForTimeout(400);await p.click('#kit-next')}}
        const last=await p.evaluate(()=>HOOK.$('#kit-next').textContent);await p.waitForTimeout(400);await p.click('#kit-next');await settle(p,200);
        ok(last==='Done'&&await p.evaluate(()=>!HOOK.kit&&HOOK.settingsOpen()&&HOOK.$('#sc-calendar').classList.contains('open')),`the ${g} guide ends with "Done" and goes back to Settings → Calendar`)}}
    if(shots){await p.setViewportSize({width:390,height:860});for(const theme of ['light','dark']){await p.emulateMedia({colorScheme:theme});await p.evaluate(()=>HOOK.openSettings('calendar'));await settle(p,300);
      await p.screenshot({path:path.join(shots,`settings-${theme}.png`),fullPage:false});
      await p.evaluate(()=>{HOOK.closeSettings();HOOK.sel=new Date(2026,11,8);HOOK.renderToday()});await p.screenshot({path:path.join(shots,`today-trip-${theme}.png`)})}}
    const guideText=await p.evaluate(()=>Object.values(HOOK.CAL_GUIDES).flat().map(c=>c.title+' '+c.body).join(' '));
    ok(/Public Calendar/.test(guideText)&&/Share Link/.test(guideText)&&/Secret address in iCal format/.test(guideText)&&/Publish a calendar/.test(guideText)&&/ICS/.test(guideText)&&/slightly differently/.test(guideText),'the walkthrough names the real menu items (Public Calendar → Share Link, Secret address in iCal format, Publish a calendar → ICS) and says menus may differ');
    ok(!/\b(worker|Cloudflare|KV|token)\b/i.test(guideText+await p.evaluate(()=>{HOOK.openSettings('calendar');return HOOK.$('#sc-calendar').textContent})),'no word a tester mustn\'t read (worker, Cloudflare, KV, token)');
    // Disconnect: asks, then forgets the link and the last read; what was set stays
    await p.setViewportSize({width:390,height:860});await p.emulateMedia({colorScheme:'light'});
    await p.evaluate(()=>HOOK.openSettings('calendar'));await settle(p,200);await p.click('#cal-off');await p.waitForSelector('#ask-ok');await p.click('#ask-ok');
    await p.waitForFunction(()=>!HOOK.settings.calendar&&!!HOOK.$('#cal-link'),null,{timeout:5000});
    const d=await p.evaluate(()=>({ls:localStorage.getItem('cal_last'),field:!!HOOK.$('#cal-link'),sum:HOOK.$('#sum-calendar').textContent,off:(HOOK.settings.daysOff||[]).some(x=>x.d==='2026-12-13'),occ:HOOK.dayRecs['2026-11-24']&&HOOK.dayRecs['2026-11-24'].occasion}));
    ok(d.ls===null&&d.field&&d.sum==='Not connected'&&d.off&&d.occ==='funeral',`Disconnect asks first, forgets the link and the last read, and leaves the days it set (${JSON.stringify(d)})`);
    // not connected to the server: Connect can't be used, and says why
    await p.evaluate(()=>{localStorage.removeItem('app_token');HOOK.renderCalUI()});
    ok(await p.evaluate(()=>HOOK.$('#cal-connect').disabled&&/needs a connection/.test(HOOK.$('#cal-box').textContent)),'without a connection Connect is off and the section says what is needed');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{globalThis.fetch=realFetch;Date.now=realNow;cm.calReset();await browser.close()}
};

module.exports=async t=>{for(const [name,part] of [['parse',parse],['route',route],['app',app]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
