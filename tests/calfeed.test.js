// The phone reads the calendar; the server only relays it (2026-11-25, the owner's design; the review's R6 N2: a long-used calendar
// went over the free plan's CPU time at 1.4 MB, about 12 ms, and past 6 MB its coming events and occasions were cut silently).
// POST /calendar/feed relays the feed unparsed (worker/calendar.js handleCalFeed); the app parses it in cal-worker.js with calparse.js,
// the parser POST /calendar (older apps) still uses, so the events are the same. Made-up feeds (tests/calfeeds.js, the fixtures) and a
// stood-in fetch: no real calendar is fetched, no real server is called, no KV is written.
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const {feed}=require('./calfeeds.js');
const FIX=f=>fs.readFileSync(path.join(__dirname,'fixtures','calendar',f),'utf8');
const NOW=Date.UTC(2026,10,20,6,0,0);   // Friday, November 20 2026, 9:00 in Kuwait
const SIZES=[0.05,1.4,6,24],OCC=/^(Embassy gala, black tie|Cousin's wedding|Vacation)$/;
const imp=(ROOT,f)=>import(pathToFileURL(path.join(ROOT,f)).href);
// the parser: the checkout's calparse.js (main before 2026-11-25 had none: its frozen copy, so the checks there fail on what they check)
const parser=ROOT=>imp(ROOT,'calparse.js').catch(()=>import(pathToFileURL(path.join(__dirname,'fixtures','calendar','main-calendar.js')).href));
const isoAdd=(iso,n)=>{const t=new Date(iso+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const stream=(b,n=65536)=>{let i=0;return new ReadableStream({pull(c){if(i>=b.length){c.close();return}c.enqueue(b.subarray(i,i+n));i+=n}})};
/* a stood-in for the calendars' hosts: FEEDS[href] = {b: bytes, etag, lm}; If-None-Match / If-Modified-Since answer 304 */
const hosts=FEEDS=>async(href,init)=>{const f=FEEDS[String(href)],h=(init&&init.headers)||{};if(!f)return new Response('',{status:404});
  if(f.status)return new Response(f.body||'',{status:f.status,headers:f.headers||{}});
  if((f.etag&&h['if-none-match']===f.etag)||(f.lm&&h['if-modified-since']===f.lm))return new Response(null,{status:304});
  return new Response(stream(f.b,f.n),{status:200,headers:{'content-type':'text/calendar',...(f.etag?{etag:f.etag}:{}),...(f.lm?{'last-modified':f.lm}:{}),...(f.len?{'content-length':String(f.len)}:{})}})};
const cpuOf=async f=>{let k=0;const a=process.cpuUsage(),t=performance.now();while(k<3||performance.now()-t<300){await f();k++}const d=process.cpuUsage(a);return (d.user+d.system)/1000/k};
const drain=async r=>{const rd=r.body.getReader();let n=0;for(;;){const {done,value}=await rd.read();if(done)break;n+=value.byteLength}return n};

/* ---- the relay: the feed's own bytes, CPU near zero, 204 when unchanged, only a calendar, only the person's own link, no KV ---- */
const relay=async({ok,ROOT})=>{
  const worker=(await imp(ROOT,'worker.js')).default,cm=await imp(ROOT,'worker/calendar.js');cm.calReset();
  const FEEDS={},realFetch=globalThis.fetch,realNow=Date.now,logs=[],realLog=console.log;let asked=[];
  const up=hosts(FEEDS);globalThis.fetch=async(href,init)=>{asked.push(String(href));return up(href,init)};
  let writes=0;const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'||(t&&t.type==='json')?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{writes++;store.set(k,v)},delete:async k=>{writes++;store.delete(k)},list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const env={APP_TOKEN:'o',WARDROBE:KV};
  const post=(b,tok='o',p='calendar/feed')=>worker.fetch(new Request('https://w.test/'+p,{method:'POST',headers:{'content-type':'application/json',...(tok?{'x-app-token':tok}:{})},body:JSON.stringify(b)}),env);
  const cap=(...a)=>{const s=a.map(String).join(' ');if(/^\s*(✓|✗|×|✘)/.test(s))return realLog(...a);logs.push(s)};console.log=cap;Date.now=()=>NOW;
  try{
    // the feed comes back byte for byte, at every size, and the relay's CPU stays far under the free plan's 10 ms
    const cpus=[];
    for(const mb of SIZES){const b=new TextEncoder().encode(feed(mb)),href=`https://cal.example.test/k/${mb}.ics`;FEEDS[href]={b,etag:'"e'+mb+'"'};
      cm.calReset();const r=await post({url:href});const got=r.status===200?new Uint8Array(await r.arrayBuffer()):new Uint8Array(0);
      const same=got.length===b.length&&Buffer.compare(Buffer.from(got),Buffer.from(b))===0;
      // the relay's own CPU: a read through it, less the same bytes read straight from the stood-in host (the host and the reader are the test's)
      const all=r.status!==200?Infinity:await cpuOf(async()=>{cm.calReset();const x=await post({url:href});if(x.status!==200)throw new Error('relay '+x.status);await drain(x)});
      const base=await cpuOf(async()=>{await drain(new Response(stream(b)))}),ms=Math.max(0,all-base);
      const old=await cpuOf(async()=>{cm.calReset();await (await post({url:href,tz:'Asia/Kuwait'},'o','calendar')).text()});
      cpus.push(`${mb} MB: relay ${ms.toFixed(2)} ms (${all.toFixed(2)} with the test's own reading), the old parse ${old.toFixed(1)} ms`);
      ok(r.status===200&&same&&(r.headers.get('content-type')||'').startsWith('text/calendar')&&ms<5,`a ${mb} MB feed is relayed byte for byte (${got.length} of ${b.length} bytes) with ${ms.toFixed(2)} ms of CPU a read, under half the free plan's 10 ms even on a slow test machine (a GitHub runner: about 3 ms at 24 MB; POST /calendar's parse: ${old.toFixed(1)} ms)`)}
    realLog('    CPU per read: '+cpus.join(' · '));
    // an unchanged calendar: 204, no body; a changed one: the whole feed again
    const H='https://cal.example.test/k/1.4.ics';cm.calReset();
    const a=await post({url:H});await a.arrayBuffer();const tk=a.headers.get('x-cal-tk'),et=a.headers.get('x-cal-etag');
    const s=await post({url:H,tk,etag:et});const sb=await s.arrayBuffer();
    ok(et==='"e1.4"'&&s.status===204&&sb.byteLength===0&&s.headers.get('x-cal-tk')===tk,`the calendar's ETag is passed back; asked again with it, an unchanged calendar answers 204 with nothing in it (${s.status}, ${sb.byteLength} bytes)`);
    FEEDS['https://cal.example.test/lm.ics']={b:new TextEncoder().encode(FIX('personal.ics')),lm:'Tue, 24 Nov 2026 08:00:00 GMT'};
    const l1=await post({url:'https://cal.example.test/lm.ics'});await l1.arrayBuffer();const l2=await post({url:'https://cal.example.test/lm.ics',tk:l1.headers.get('x-cal-tk'),lm:l1.headers.get('x-cal-lm')});
    ok(l1.headers.get('x-cal-lm')==='Tue, 24 Nov 2026 08:00:00 GMT'&&l2.status===204,`Last-Modified works the same (${l2.status})`);
    FEEDS[H].etag='"e1.4b"';const c=await post({url:H,tk,etag:et});const cb=await c.arrayBuffer();
    ok(c.status===200&&cb.byteLength===FEEDS[H].b.length&&c.headers.get('x-cal-etag')==='"e1.4b"',`a changed calendar comes whole, with its new ETag (${c.status}, ${cb.byteLength} bytes)`);
    ok(/x-cal-etag/.test(a.headers.get('access-control-expose-headers'))&&/x-cal-tk/.test(a.headers.get('access-control-expose-headers')),'the app may read the ETag, Last-Modified and ticket headers (CORS exposes them)');
    // not an open proxy: the code, the link checks, only a calendar, only the person's own link
    cm.calReset();
    ok((await post({url:H},'')).status===403&&(await post({url:H},'wrong')).status===403,'the relay needs the owner\'s code or a tester\'s');
    ok((await worker.fetch(new Request('https://w.test/calendar/feed?url='+encodeURIComponent(H),{headers:{'x-app-token':'o'}}),env)).status===405,'GET (a link in the address) is refused');
    FEEDS['https://cal.example.test/page.ics']={b:new TextEncoder().encode('<!doctype html><html><body>'+'secret page '.repeat(5000))};
    FEEDS['https://cal.example.test/moved.ics']={status:302,headers:{location:'https://192.168.1.4/x.ics'}};
    FEEDS['https://cal.example.test/gone.ics']={status:404};
    FEEDS['https://cal.example.test/huge.ics']={b:new TextEncoder().encode('BEGIN:VCALENDAR\r\n'),len:cm.CAL_FEED_MAX+1};
    const pg=await post({url:'https://cal.example.test/page.ics'}),pgt=await pg.text();
    ok(pg.status===422&&!pgt.includes('secret page')&&/didn’t give a calendar/.test(pgt),`a link that gives anything but a calendar (a web page) is answered 422, and nothing of it is relayed (${pg.status})`);
    asked=[];const mv=await post({url:'https://cal.example.test/moved.ics'}),lh=await post({url:'https://localhost/a.ics'}),ip=await post({url:'http://127.0.0.1/a.ics'});
    ok(mv.status===400&&lh.status===400&&ip.status===400&&!asked.some(u=>/192\.168|localhost|127\./.test(u)),'a private address, and a redirect to one, are refused as by POST /calendar');
    const gn=await post({url:'https://cal.example.test/gone.ics'}),hg=await post({url:'https://cal.example.test/huge.ics'});
    ok(gn.status===502&&/no longer works/.test(await gn.text())&&hg.status===413,`a link that's gone says so; a feed over ${cm.CAL_FEED_MAX/1e6} MB is refused, not cut (${gn.status} ${hg.status})`);
    // a feed with no length that grows past the limit fails the read instead of being cut
    cm.calReset();FEEDS['https://cal.example.test/endless.ics']={b:new TextEncoder().encode('BEGIN:VCALENDAR\r\n'+'X'.repeat(cm.CAL_FEED_MAX+1e5)),n:4e6};
    let cut='read whole';try{await drain(await post({url:'https://cal.example.test/endless.ics'}))}catch{cut='failed'}
    ok(cut==='failed','a feed with no length that goes past the limit fails the read (never a silently cut calendar)');
    // only the person's own link: a link read with its ticket isn't limited beyond the usual count; new links are, a few an hour
    cm.calReset();const own=await post({url:H});await own.arrayBuffer();const otk=own.headers.get('x-cal-tk');
    let ownOk=0;for(let i=0;i<cm.CAL_RATE_N-1;i++){const r=await post({url:H,tk:otk});if(r.status===200)ownOk++;await r.arrayBuffer()}
    cm.calReset();let newOk=0,newLast=0;for(let i=0;i<cm.CAL_NEW_N+1;i++){const r=await post({url:`https://cal.example.test/k/0.05.ics?n=${i}`});newLast=r.status;if(r.status!==429)newOk++;await r.arrayBuffer()}
    ok(ownOk===cm.CAL_RATE_N-1&&newLast===429,`the person's own link (its ticket) is read as often as the usual count allows (${ownOk}); a link without its ticket only ${cm.CAL_NEW_N} times an hour, then 429 (${newOk} read, then ${newLast})`);
    cm.calReset();const t2=await post({url:H,tk:otk},(await J(await worker.fetch(new Request('https://w.test/invites',{method:'POST',headers:{'content-type':'application/json','x-app-token':'o'},body:JSON.stringify({name:'Tess'})}),env))).code||'x');
    ok(t2.headers.get('x-cal-tk')&&t2.headers.get('x-cal-tk')!==otk,'a ticket is the person\'s own: a tester\'s ticket for the same link is another');await t2.arrayBuffer();
    const w0=writes;cm.calReset();for(const mb of SIZES)await drain(await post({url:`https://cal.example.test/k/${mb}.ics`}));
    ok(writes===w0,`relaying calendars wrote nothing to KV (${writes-w0} writes)`);
    ok(!logs.some(l=>/cal\.example\.test|k\/1\.4/.test(l)),`nothing the server logged holds a link or its host (${logs.length} lines)`);
    const big=(/\bbig: '([^']+)'/.exec(fs.readFileSync(path.join(ROOT,'worker','calendar.js'),'utf8'))||[])[1]||'';
    ok(big&&!/\b(worker|Cloudflare|KV|token|relay|parse|MB)\b/i.test(big),`the one new message says nothing of the server's internals ("${big}")`);
  }finally{globalThis.fetch=realFetch;Date.now=realNow;console.log=realLog;cm.calReset()}
};
const J=async r=>{try{return await r.json()}catch{return {}}};

/* ---- the same events as today's server: calparse.js against main's parser (a frozen copy), and POST /calendar's answer unchanged ---- */
const same=async({ok,ROOT})=>{
  const P=await parser(ROOT),M=await import(pathToFileURL(path.join(__dirname,'fixtures','calendar','main-calendar.js')).href);
  const texts={'personal.ics':FIX('personal.ics'),'outlook.ics':FIX('outlook.ics'),'personal (CRLF)':FIX('personal.ics').replace(/\n/g,'\r\n')};for(const mb of SIZES)texts[mb+' MB']=feed(mb);
  let n=0,bad=[];
  for(const [name,t] of Object.entries(texts))for(const tz of ['Asia/Kuwait','America/New_York','Europe/London','Pacific/Auckland'])for(const [a,b] of [['2026-11-20','2027-01-19'],['2027-02-20','2027-04-21'],['2026-11-25','2027-01-24']]){
    const x=JSON.stringify(P.calEvents(t,tz,a,b)),y=JSON.stringify(M.calEvents(t,tz,a,b));n++;if(x!==y)bad.push(`${name} ${tz} ${a}`)}
  ok(!bad.length,`the shared parser gives main's events byte for byte: ${n-bad.length} of ${n} (feeds 0.05-24 MB and the fixtures, four zones, three windows, DST changes in them)${bad.length?': '+bad.slice(0,4).join(', '):''}`);
  // POST /calendar (older apps) answers exactly as main's route did
  const worker=(await imp(ROOT,'worker.js')).default,cm=await imp(ROOT,'worker/calendar.js');
  const FEEDS={},realFetch=globalThis.fetch,realNow=Date.now;globalThis.fetch=hosts(FEEDS);Date.now=()=>NOW;
  try{let eq=0,all=0;const diff=[];
    for(const [name,t] of Object.entries(texts)){const href='https://cal.example.test/s/'+encodeURIComponent(name);FEEDS[href]={b:new TextEncoder().encode(t)};
      for(const tz of ['Asia/Kuwait','America/New_York']){const body=JSON.stringify({url:href,tz,days:60,fresh:true});cm.calReset();M.calReset();
        const a=await (await worker.fetch(new Request('https://w.test/calendar',{method:'POST',headers:{'content-type':'application/json','x-app-token':'o'},body}),{APP_TOKEN:'o'})).text();
        let b='';await M.handleCalendar(new Request('https://w.test/calendar',{method:'POST',body}),{},(o,s=200)=>{b=JSON.stringify(o);return new Response(b,{status:s})},{id:'owner'});
        all++;if(a===b)eq++;else diff.push(name+' '+tz)}}
    ok(eq===all,`POST /calendar answers byte for byte as main's (${eq} of ${all}: the fixtures and 0.05-24 MB, two zones)${diff.length?': '+diff.join(', '):''}`);
  }finally{globalThis.fetch=realFetch;Date.now=realNow;cm.calReset();M.calReset()}
  // what the app now keeps for a feed: every event of the window, the occasions too, whatever the size
  for(const mb of [6,24]){const ev=P.calEvents(feed(mb),'Asia/Kuwait','2026-11-20','2027-01-19');
    ok(ev.filter(e=>OCC.test(e.title)).length===3&&ev.length>300,`a ${mb} MB feed read whole: ${ev.length} events in the 60 days, its 3 occasions among them (listed last in the feed)`)}
};

/* ---- the app: Connect, Read now, an unchanged day, a change, offline, an older server; on Chromium and WebKit ---- */
const app=async({ok,engines,url,ROOT})=>{
  const worker=(await imp(ROOT,'worker.js')).default,cm=await imp(ROOT,'worker/calendar.js'),P=await parser(ROOT);
  const LINK='webcal://cal.example.test/p/AppS3cret/work.ics',HREF='https://cal.example.test/p/AppS3cret/work.ics',TEXT=feed(6),HOST='https://w.test/';
  const FEEDS={},realFetch=globalThis.fetch,realNow=Date.now,env={APP_TOKEN:'o'};
  globalThis.fetch=hosts(FEEDS);
  const want=(text,from)=>{const to=isoAdd(from,60);return JSON.stringify(P.calEvents(text,'Asia/Kuwait',from,to))};
  try{
    for(const [eng,launch] of engines){let browser;
      try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
      const T=eng+': ';
      try{
        FEEDS[HREF]={b:new TextEncoder().encode(TEXT),etag:'"v1"'};cm.calReset();
        const ctx=await browser.newContext({viewport:{width:390,height:860},locale:'en-US',timezoneId:'Asia/Kuwait',serviceWorkers:'block'});
        await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','o');localStorage.setItem('last_sync',String(Date.now()));localStorage.setItem('tour_seen','1')},HOST);
        const net={feed:[],old:0,down:false,noFeed:false};
        await ctx.route(HOST+'**',async r=>{const q=r.request(),u=new URL(q.url());
          if(u.pathname==='/calendar/feed'&&net.down)return r.abort('internetdisconnected');
          if(u.pathname==='/calendar/feed'&&net.noFeed)return r.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'});
          if(u.pathname!=='/calendar'&&u.pathname!=='/calendar/feed')return r.fulfill({status:503,contentType:'application/json',body:'{}'});
          if(u.pathname==='/calendar')net.old++;
          Date.now=()=>NOW;cm.calReset();let res;try{res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.postData()}),env)}finally{Date.now=realNow}
          const body=Buffer.from(await res.arrayBuffer());if(u.pathname==='/calendar/feed')net.feed.push({s:res.status,bytes:body.length});
          await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body})});
        const p=await ctx.newPage();p.setDefaultTimeout(30000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
        await p.goto(url);await p.waitForFunction(()=>window.appReady);
        await p.evaluate(()=>{settings.workdays=[0,1,2,3,4];settings.location={name:'Kuwait City, KW',lat:29.37,lon:47.98};dayRecs={};TODAY_OVERRIDE='2026-11-20T09:00:00';cache={};openSettings('calendar')});
        await p.waitForSelector('#cal-link');
        // Connect a 6 MB work calendar; a frame clock runs meanwhile, so a long stall of the page shows
        // (and when the relay's answer reached the page: Playwright's WebKit hands a mocked body over on the page's own thread, before fetch()
        // resolves, which a phone's network process doesn't; what the app does with the feed comes after)
        await p.evaluate(()=>{window.__gaps=[];window.__fed=0;const of=window.fetch;window.fetch=async(...a)=>{const r=await of(...a);if(/calendar\/feed$/.test(String(a[0])))window.__fed=performance.now();return r};
          let last=performance.now();const tick=t=>{window.__gaps.push([t,t-last]);last=t;if(window.__tick)requestAnimationFrame(tick)};window.__tick=true;requestAnimationFrame(tick)});
        await p.fill('#cal-link',LINK);const t0=Date.now();await p.click('#cal-connect');
        await p.waitForFunction(()=>/^Connected\./.test(($('#cal-msg')||{}).textContent||''),null,{timeout:60000});
        const took=Date.now()-t0,[gap,after]=await p.evaluate(()=>{window.__tick=false;const g=__gaps;return [Math.round(Math.max(...g.map(x=>x[1]))),Math.round(Math.max(0,...g.filter(x=>x[0]-x[1]>=__fed).map(x=>x[1])))]});
        const c=await p.evaluate(()=>({ls:localStorage.getItem('cal_last'),msg:$('#cal-msg').textContent,rows:[...document.querySelectorAll('#cal-new-list .cal-row b')].map(b=>b.textContent),status:$('#cal-status').textContent,html:document.documentElement.outerHTML}));
        const last=JSON.parse(c.ls||'{}');
        ok(JSON.stringify(last.events)===want(TEXT,'2026-11-20')&&last.from==='2026-11-20'&&last.to==='2027-01-19',T+`Connect with a 6 MB work calendar keeps every event of the 60 days, byte for byte as the server's parser reads the whole feed (${(last.events||[]).length} events)`);
        ok(["Embassy gala, black tie","Cousin's wedding","Vacation"].every(t=>c.rows.includes(t)),T+`its occasions, listed last in the feed, are found and offered (${c.rows.join(', ')})`);
        ok(/^Connected\. \d+ events in the next 60 days; 3 could set up your outfits: check them below\.$/.test(c.msg)&&!/very large|only part/.test(c.msg),T+`the words are today's ("${c.msg}")`);
        ok(!last.whole&&net.feed.length===1&&net.feed[0].s===200&&net.feed[0].bytes===FEEDS[HREF].b.length&&net.old===0,T+`it read the feed through the relay once (${net.feed.map(x=>x.s+':'+x.bytes).join(',')}; POST /calendar ${net.old})`);
        ok(after<100,T+`the page kept drawing while the 6 MB calendar was taken in and parsed (longest frame gap once the answer had come ${after} ms; ${gap} ms counting the test's hand-over of the mocked answer; the read took ${took} ms)`);
        ok(!c.html.includes('AppS3cret')&&!c.ls.includes('AppS3cret'),T+'the secret part of the link is not on the page or in what the phone keeps of the last read');
        const kept=await p.evaluate(async()=>{const c=await caches.open('dw-keep-cal'),k=await c.keys();return {n:k.length,urls:k.map(r=>r.url).join(),len:k.length?(await (await c.match(k[0])).text()).length:0}});
        ok(kept.n===1&&!kept.urls.includes('AppS3cret')&&kept.len===TEXT.length,T+`the last good copy is kept on the phone, named by a hash, not the link (${kept.n} copy, ${kept.len} characters)`);
        // a day with no change: Read now asks with the ETag and gets nothing back
        net.feed=[];await p.click('#cal-read');await p.waitForFunction(()=>!calBusy&&/Up to date|new event/.test(($('#cal-msg')||{}).textContent||''));
        const r1=await p.evaluate(()=>JSON.parse(localStorage.getItem('cal_last')).events.length);
        ok(net.feed.length===1&&net.feed[0].s===204&&net.feed[0].bytes===0&&r1===last.events.length,T+`a read with no change downloads nothing (${net.feed.map(x=>x.s+':'+x.bytes+' bytes').join(',')}), the events stay (${r1})`);
        // the next day, unchanged: the kept copy is read for the new window
        await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-21T09:00:00';cache={}});net.feed=[];await p.click('#cal-read');await p.waitForFunction(()=>!calBusy&&JSON.parse(localStorage.getItem('cal_last')).from==='2026-11-21');
        const d2=await p.evaluate(()=>localStorage.getItem('cal_last'));
        ok(JSON.stringify(JSON.parse(d2).events)===want(TEXT,'2026-11-21')&&net.feed[0].bytes===0,T+`the next day the unchanged calendar costs no data and its window moves on a day (${JSON.parse(d2).from}..${JSON.parse(d2).to})`);
        // a change: the whole feed again, the new event in it
        const T2=TEXT.replace('END:VCALENDAR','BEGIN:VEVENT\r\nUID:awards@example.test\r\nSUMMARY:Awards dinner\r\nDTSTART:20261203T160000Z\r\nDTEND:20261203T190000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
        FEEDS[HREF]={b:new TextEncoder().encode(T2),etag:'"v2"'};net.feed=[];await p.click('#cal-read');
        await p.waitForFunction(()=>!calBusy&&JSON.parse(localStorage.getItem('cal_last')).events.some(e=>e.title==='Awards dinner'));
        const d3=await p.evaluate(()=>localStorage.getItem('cal_last'));
        ok(JSON.stringify(JSON.parse(d3).events)===want(T2,'2026-11-21')&&net.feed[0].s===200&&net.feed[0].bytes===T2.length,T+`a changed calendar is downloaded whole once (${net.feed[0].bytes} bytes) and read again`);
        // offline: the kept copy, for today's window, and the words say the read failed
        await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-22T09:00:00';cache={}});net.down=true;await p.click('#cal-read');
        await p.waitForFunction(()=>!calBusy&&/couldn’t be reached|couldn’t be read/.test(($('#cal-msg')||{}).textContent||''));
        const off=await p.evaluate(()=>({l:localStorage.getItem('cal_last'),msg:$('#cal-msg').textContent,rows:[...document.querySelectorAll('#cal-review .cal-row b')].map(b=>b.textContent)}));
        const ol=JSON.parse(off.l);
        ok(JSON.stringify(ol.events)===want(T2,'2026-11-22')&&ol.from==='2026-11-22'&&ol.err&&off.rows.includes('Awards dinner'),T+`offline the last good copy is used for today's window (${ol.events.length} events from ${ol.from}; "${off.msg}")`);
        net.down=false;
        // the Settings line and summary read as they did from the server's answer
        const line=await p.evaluate(async()=>{const a=localStorage.getItem('cal_last'),s=[calSummary(),$('#cal-status').textContent];return {a,s}});
        ok(/^Last read .* · \d+ events? used · /.test(line.s[1])&&/^(Couldn’t read it last time|\d+ new events? to check)$/.test(line.s[0]),T+`the Settings line ("${line.s[1]}") and summary ("${line.s[0]}") as before`);
        // an older server (no relay): the app asks it to read the calendar, as before
        net.noFeed=true;net.old=0;FEEDS[HREF]={b:new TextEncoder().encode(FIX('personal.ics'))};await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-20T09:00:00';cache={}});
        await p.click('#cal-read');await p.waitForFunction(()=>!calBusy&&!JSON.parse(localStorage.getItem('cal_last')).err);
        const ol2=JSON.parse(await p.evaluate(()=>localStorage.getItem('cal_last')));
        ok(net.old===1&&ol2.events.length===17,T+`with a server from before the relay the app reads through POST /calendar as before (${ol2.events.length} events)`);
        net.noFeed=false;
        // Disconnect forgets the kept copy
        await p.click('#cal-off');await p.waitForSelector('#ask-ok');await p.click('#ask-ok');await p.waitForFunction(()=>!settings.calendar&&!!$('#cal-link'));
        await p.waitForFunction(async()=>!(await caches.keys()).includes('dw-keep-cal')||!(await (await caches.open('dw-keep-cal')).keys()).length);
        ok(true,T+'Disconnect forgets the kept copy of the calendar');
        ok(!errs.length,T+'no page errors: '+errs.join(' | '));
        await ctx.close();
        // no Worker (one that can't start): the same events, read on the page
        const c2=await browser.newContext({viewport:{width:390,height:860},locale:'en-US',timezoneId:'Asia/Kuwait',serviceWorkers:'block'});
        await c2.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','o');localStorage.setItem('tour_seen','1');window.Worker=function(){throw new Error('no workers')}},HOST);
        let asks2=0;await c2.route(HOST+'**',async r=>{const q=r.request(),u=new URL(q.url());if(u.pathname!=='/calendar/feed')return r.fulfill({status:503,contentType:'application/json',body:'{}'});asks2++;
          Date.now=()=>NOW;cm.calReset();let res;try{res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.postData()}),env)}finally{Date.now=realNow}
          await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
        FEEDS[HREF]={b:new TextEncoder().encode(feed(1.4)),etag:'"w"'};
        const q=await c2.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);
        await q.evaluate(()=>{settings.workdays=[0,1,2,3,4];TODAY_OVERRIDE='2026-11-20T09:00:00';cache={};openSettings('calendar')});await q.waitForSelector('#cal-link');
        await q.fill('#cal-link',LINK);await q.click('#cal-connect');await q.waitForFunction(()=>/^Connected\./.test(($('#cal-msg')||{}).textContent||''),null,{timeout:60000});
        ok(JSON.stringify(JSON.parse(await q.evaluate(()=>localStorage.getItem('cal_last'))).events)===want(feed(1.4),'2026-11-20'),T+'where no Worker can start, the page reads the calendar itself: the same events');
        // nothing kept (or a host with neither ETag nor Last-Modified): every read is the whole feed, so it reads by itself at most every 12 h, not 3
        const every=await q.evaluate(async()=>{const l=JSON.parse(localStorage.getItem('cal_last'));const at=h=>{localStorage.setItem('cal_last',JSON.stringify({...l,t:Date.now()-h*3600e3}))};
          const back=()=>dispatchEvent(new Event('visibilitychange')),wait=ms=>new Promise(r=>setTimeout(r,ms));   // (coming back to the app: calAuto)
          at(4);back();await wait(1500);const a=JSON.parse(localStorage.getItem('cal_last')).t;at(13);back();for(let i=0;i<100&&JSON.parse(localStorage.getItem('cal_last')).t<Date.now()-3600e3;i++)await wait(100);
          return {whole:l.whole,a:a<Date.now()-3*3600e3,b:JSON.parse(localStorage.getItem('cal_last')).t>Date.now()-60e3}});
        ok(every.whole===1&&every.a&&every.b&&asks2===2,T+`a calendar that comes whole each time is read by itself at most every 12 hours (${JSON.stringify(every)}, ${asks2} reads)`);
        await c2.close();
      }catch(e){ok(false,T+'threw: '+e.message.split('\n')[0])}
      finally{await browser.close()}}
  }finally{globalThis.fetch=realFetch;Date.now=realNow;cm.calReset()}
};

// both engines (tests/webkit.js): run.js gives the WebKit half its own run; the Node parts run once, in the Chromium half
module.exports=async({ok,engines,url,ROOT})=>{const t={ok,engines,url,ROOT},node=engines.some(([n])=>n==='Chromium');
  for(const [name,part] of [...(node?[['relay',relay],['same',same]]:[]),['app',app]]){try{await part(t)}catch(e){ok(false,`threw (${name}): ${e.message}`)}}};
