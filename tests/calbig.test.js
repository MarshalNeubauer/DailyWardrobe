// A very large calendar (the 2026-11-24 review's R6 N2). POST /calendar read the first 6 MB of a feed and silently dropped the rest; a
// calendar used for years lists its coming events last, so it showed no coming events and said nothing. Now the feed is read as it arrives
// and only the window's events are kept, wherever they lie; past what is read (CAL_MAX_BYTES) the answer says truncated, and the app tells
// the person in plain words. Made-up feeds and a stood-in fetch: no real calendar is fetched, no KV is used.
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const NOW=Date.UTC(2026,10,20,6,0,0);   // 20 Nov 2026, 9:00 in Kuwait
const blk=(i,y)=>`BEGIN:VEVENT\r\nUID:past${i}@example.test\r\nSUMMARY:Old meeting ${i}\r\nDESCRIPTION:${'notes '.repeat(60)}\r\nDTSTART:${y}0105T090000Z\r\nDTEND:${y}0105T100000Z\r\nEND:VEVENT\r\n`;
const past=mb=>{const one=blk(1,2018),n=Math.ceil(mb*1e6/one.length);return one.repeat(n)};
const GALA='BEGIN:VEVENT\r\nUID:gala@example.test\r\nSUMMARY:Embassy gala\r\nDTSTART;VALUE=DATE:20261125\r\nEND:VEVENT\r\n';
const cal=body=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+body+'END:VCALENDAR\r\n';
// a body as a network gives it: in chunks (n bytes each)
const chunked=(text,n)=>{const b=new TextEncoder().encode(text);let i=0;return new ReadableStream({pull(c){if(i>=b.length){c.close();return}c.enqueue(b.slice(i,i+n));i+=n}})};
const worker_=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default,cm=await import(pathToFileURL(path.join(ROOT,'worker','calendar.js')).href);
  cm.calReset();
  const FEEDS={},realFetch=globalThis.fetch,realNow=Date.now;
  globalThis.fetch=async href=>{const f=FEEDS[String(href)];if(!f)return new Response('',{status:404});return new Response(chunked(f.text,f.n||65536),{status:200,headers:{'content-type':'text/calendar'}})};
  let writes=0;const KV={get:async()=>null,put:async()=>{writes++},delete:async()=>{},list:async()=>({keys:[],list_complete:true})};
  const env={APP_TOKEN:'o',WARDROBE:KV};
  const read=async(link)=>{cm.calReset();const r=await worker.fetch(new Request('https://w.test/calendar',{method:'POST',headers:{'content-type':'application/json','x-app-token':'o'},body:JSON.stringify({url:link,tz:'Asia/Kuwait'})}),env);let j={};try{j=await r.json()}catch{}return {s:r.status,...j}};
  Date.now=()=>NOW;
  try{
    // years of past meetings first, the coming gala last (6.5 MB)
    FEEDS['https://cal.example.test/years.ics']={text:cal(past(6.5)+GALA)};
    const a=await read('https://cal.example.test/years.ics');
    ok(a.s===200&&(a.events||[]).some(e=>e.title==='Embassy gala'&&e.start==='2026-11-25')&&!a.truncated,`a 6.5 MB calendar with its coming event listed last: the event is found and nothing is said to be missing (${a.s}, ${(a.events||[]).map(e=>e.title).join(',')||'no events'}, truncated ${!!a.truncated})`);
    // past what is read: the events found are given, and the answer says the calendar was cut
    const over=cm.CAL_MAX_BYTES?cm.CAL_MAX_BYTES/1e6+1:7;
    FEEDS['https://cal.example.test/huge.ics']={text:cal(GALA+past(over)+GALA.replace('gala@','later@').replace('Embassy gala','Gala past the limit'))};
    const b=await read('https://cal.example.test/huge.ics');
    ok(b.s===200&&b.truncated===true&&(b.events||[]).some(e=>e.title==='Embassy gala'),`a calendar past what is read (${over.toFixed(0)} MB): the events read are given and the answer says truncated (${b.s}, ${(b.events||[]).map(e=>e.title).join(',')}, truncated ${b.truncated})`);
    ok(!JSON.stringify(b).includes('example.test')&&Object.keys(b).sort().join()==='events,from,more,s,to,truncated,tz',`the answer adds only the flag: no link, size or other detail (${Object.keys(b).sort().join()})`);
    // read in tiny pieces (CRLF and folded lines cut between chunks): the same events as the whole text parsed at once
    const fx=fs.readFileSync(path.join(__dirname,'fixtures','calendar','personal.ics'),'utf8');
    const want=cm.calEvents(fx.replace(/\r?\n/g,'\r\n'),'Asia/Kuwait','2026-11-20','2027-01-19').map(e=>e.id+e.start+e.time+e.title).join('|');
    let same=0;for(const n of [1,2,3,7,64,4096]){FEEDS['https://cal.example.test/p'+n+'.ics']={text:fx.replace(/\r?\n/g,'\r\n'),n};const c=await read('https://cal.example.test/p'+n+'.ics');if(c.s===200&&!c.truncated&&c.events.map(e=>e.id+e.start+e.time+e.title).join('|')===want&&c.events.length===17)same++}
    FEEDS['https://cal.example.test/lf.ics']={text:fx.replace(/\r\n/g,'\n'),n:5};FEEDS['https://cal.example.test/cr.ics']={text:'﻿'+fx.replace(/\r?\n/g,'\r'),n:5};
    const lf=await read('https://cal.example.test/lf.ics'),cr=await read('https://cal.example.test/cr.ics');
    ok(same===6&&lf.events.length===17&&cr.events.length===17,`read as it arrives, in chunks of 1 byte to 4 KB, with LF, CR and a byte-order mark: the same 17 events as the text read whole (${same} of 6 chunk sizes, LF ${lf.events.length}, CR ${cr.events.length})`);
    // a feed of thousands of repeating series (each kept: it may repeat into the window) is bounded: the earliest events, said truncated
    const ser=n=>Array.from({length:n},(_,i)=>`BEGIN:VEVENT\r\nUID:s${i}@example.test\r\nSUMMARY:Series ${i}\r\nDTSTART;TZID=Asia/Kuwait:2018${String(1+i%12).padStart(2,'0')}05T090000\r\nRRULE:FREQ=DAILY;COUNT=3000\r\nEND:VEVENT\r\n`).join('');
    FEEDS['https://cal.example.test/series.ics']={text:cal(ser(8000))};
    const c0=process.cpuUsage(),sr=await read('https://cal.example.test/series.ics'),cpu=process.cpuUsage(c0),ms=Math.round((cpu.user+cpu.system)/1000);
    ok(sr.s===200&&sr.truncated===true&&sr.events.length===300&&sr.more===true&&ms<8000,`8,000 daily series: answered with the first 300 events and truncated, its work bounded (${sr.s}, ${sr.events&&sr.events.length}, truncated ${sr.truncated}, ${ms} ms CPU here)`);
    // a web page stops at its first bytes
    FEEDS['https://cal.example.test/page.ics']={text:'<!doctype html><html>'+'x'.repeat(5e6)};
    const p=await read('https://cal.example.test/page.ics');
    ok(p.s===422,`a link that gives a web page is still "not a calendar" (${p.s})`);
    ok(writes===0,`reading wrote nothing to KV (${writes})`);
  }finally{globalThis.fetch=realFetch;Date.now=realNow;cm.calReset()}
};
// the app: Connect and Read now with a calendar the server could read only part of: the person is told in plain words
const app=async({ok,chromium,url,ROOT,settle})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default,cm=await import(pathToFileURL(path.join(ROOT,'worker','calendar.js')).href);cm.calReset();
  const LINK='webcal://cal.example.test/p/AppBig/huge.ics',over=cm.CAL_MAX_BYTES?cm.CAL_MAX_BYTES/1e6+1:7,TEXT=cal(GALA+past(over));
  const realFetch=globalThis.fetch,realNow=Date.now;
  globalThis.fetch=async href=>String(href)==='https://cal.example.test/p/AppBig/huge.ics'?new Response(chunked(TEXT,65536),{status:200}):new Response('',{status:404});
  const env={APP_TOKEN:'o'},HOST='https://w.test/',browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:860},locale:'en-US',timezoneId:'Asia/Kuwait'});
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','o');localStorage.setItem('last_sync',String(Date.now()))},HOST);
    await ctx.route(HOST+'**',async r=>{const q=r.request(),u=new URL(q.url());if(u.pathname!=='/calendar')return r.fulfill({status:503,body:'{}'});
      Date.now=()=>NOW;cm.calReset();let res;try{res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.postData()}),env)}finally{Date.now=realNow}
      await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{settings.workdays=[0,1,2,3,4];TODAY_OVERRIDE='2026-11-20T09:00:00';cache={};openSettings('calendar')});await settle(p,300);
    await p.fill('#cal-link',LINK);await p.click('#cal-connect');
    await p.waitForFunction(()=>/^Connected\./.test(($('#cal-msg')||{}).textContent||''),null,{timeout:20000});
    const c=await p.evaluate(()=>({msg:$('#cal-msg').textContent,status:$('#cal-status').textContent,box:$('#cal-box').textContent}));
    ok(/only part of it could be read and some events may be missing/.test(c.msg)&&/^Connected\. 1 event/.test(c.msg),`Connect says the calendar was too large to read whole ("${c.msg}")`);
    ok(/only part of it could be read/.test(c.status),`and the status line keeps saying it ("${c.status}")`);
    await p.click('#cal-read');await p.waitForFunction(()=>!calBusy&&/only part/.test(($('#cal-msg')||{}).textContent||''),null,{timeout:20000});
    const m2=await p.evaluate(()=>$('#cal-msg').textContent);
    ok(/only part of it could be read/.test(m2),`Read now says it too ("${m2}")`);
    const bad=(c.box+' '+m2).match(/\b(worker|Cloudflare|KV|token|MB|bytes?|truncated|limit)\b/i);   // ("the server" is a word the app uses)
    ok(!bad,`the words say nothing of the server's internals (worker, Cloudflare, KV, sizes, limits)${bad?': "'+bad[0]+'" in "'+c.box.slice(Math.max(0,bad.index-60),bad.index+40)+'"':''}`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{globalThis.fetch=realFetch;Date.now=realNow;cm.calReset();await browser.close()}
};
module.exports=async t=>{for(const [name,part] of [['worker',worker_],['app',app]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
