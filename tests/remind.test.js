// The morning reminder: a phone gives the server its push subscription, the time and its coming workdays; every 15 minutes the
// cron sends a push with no text, signed with the VAPID keys, to each phone due in that quarter of an hour, once a day; the app keeps
// the outfit lines the service worker shows. Settings → Schedule has the switch and the time.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const b64u=b=>Buffer.from(b).toString('base64url');
  const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',kp.privateKey),raw=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const env={APP_TOKEN:'owner',WARDROBE:KV,VAPID_PUBLIC_KEY:b64u(raw),VAPID_PRIVATE_KEY:jwk.d,VAPID_SUBJECT:'https://app.test/'};
  const HOST='https://w.test/',call=(m,p,b,tok='owner',e=env)=>worker.fetch(new Request(HOST+p,{method:m,headers:{'x-app-token':tok,'content-type':'application/json'},body:b&&JSON.stringify(b)}),e);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  const realFetch=globalThis.fetch;let pushes=[],reply=201;
  globalThis.fetch=async(u,o={})=>{const s=String(u);if(/push\.test|web\.push\.apple/.test(s)){pushes.push({url:s,h:o.headers,body:o.body});return new Response(null,{status:reply})}return realFetch(u,o)};
  const browser=await chromium.launch();
  try{
    // ---- the server
    let r=await J(await call('GET','push?endpoint=https://web.push.apple.com/abc'));
    ok(r.key===env.VAPID_PUBLIC_KEY&&r.on===false,'GET /push gives the public key; this phone is not on yet');
    ok((await J(await call('GET','push',null,'owner',{...env,VAPID_PRIVATE_KEY:undefined}))).key===null&&(await call('POST','push',{endpoint:'https://web.push.apple.com/x'},'owner',{...env,VAPID_PUBLIC_KEY:undefined})).status===501,'without the VAPID keys there is no key and nothing can be switched on');
    ok((await call('POST','push',{endpoint:'http://localhost/x',time:'07:00',tz:'Asia/Kuwait',dates:[]})).status===400&&(await call('POST','push',{endpoint:'https://web.push.apple.com/abc',time:'07:00',tz:'Mars/Olympus',dates:[]})).status===400,'an endpoint that isn\'t a public https address, or an unknown time zone, is refused');
    r=await J(await call('POST','push',{endpoint:'https://web.push.apple.com/abc',time:'07:00',tz:'Asia/Kuwait',dates:['2026-11-15','2026-11-16']}));
    ok(r.ok&&r.on&&JSON.parse(store.get('push:subs')).list.length===1&&(await J(await call('GET','push?endpoint=https://web.push.apple.com/abc'))).on,'POST /push switches it on');
    const at=iso=>worker.scheduled({scheduledTime:Date.parse(iso)},env,{waitUntil:p=>p}),run=async iso=>{pushes=[];await worker.scheduled({scheduledTime:Date.parse(iso)},env,{waitUntil:async p=>{await p}});await new Promise(x=>setTimeout(x,20));return pushes.length};
    // Kuwait is UTC+3: 07:00 there is 04:00 UTC
    ok(await run('2026-11-15T03:50:00Z')===0,'before its time: nothing');
    ok(await run('2026-11-15T04:05:00Z')===1,'in its quarter of an hour: one push');
    const p0=pushes[0]||{h:{}};
    const m=String(p0.h.authorization||'').match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/),claims=m&&JSON.parse(Buffer.from(m[2],'base64url'));
    const good=m&&await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},kp.publicKey,Buffer.from(m[3],'base64url'),new TextEncoder().encode(m[1]+'.'+m[2]));
    ok(good&&m[4]===env.VAPID_PUBLIC_KEY&&claims.aud==='https://web.push.apple.com'&&claims.sub==='https://app.test/'&&claims.exp>Date.now()/1000&&!p0.body&&p0.h.ttl,`it is signed with the VAPID key for that push service and carries no text (${claims&&claims.aud})`);
    ok(await run('2026-11-15T04:10:00Z')===0&&await run('2026-11-15T04:20:00Z')===0,'once a day: not again that day');
    ok(await run('2026-11-17T04:05:00Z')===0,'not on a date the app didn\'t give (a weekend, a day off)');
    ok(await run('2026-11-16T04:05:00Z')===1,'the next workday again');
    // a tester's, then a gone subscription, then off
    const inv=await J(await call('POST','invites',{name:'Ida'}));
    await call('POST','push',{endpoint:'https://push.test/ida',time:'06:30',tz:'Asia/Kuwait',dates:['2026-11-18']},inv.code);
    reply=410;ok(await run('2026-11-18T03:35:00Z')===1&&!JSON.parse(store.get('push:subs')).list.some(x=>/ida/.test(x.endpoint)),'a subscription the push service says is gone is dropped');reply=201;
    r=await J(await call('POST','push',{endpoint:'https://web.push.apple.com/abc',off:true}));
    ok(r.ok&&!r.on&&!JSON.parse(store.get('push:subs')).list.length,'{off:true} switches it off');
    await call('POST','push',{endpoint:'https://push.test/j',time:'07:00',tz:'Asia/Kuwait',dates:[]},inv.code);
    await call('DELETE','account',{confirm:'delete'},inv.code);
    ok(!JSON.parse(store.get('push:subs')).list.length,'deleting an account deletes its reminders');
    // ---- the app
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let posted=[];
    await ctx.route(HOST+'**',route=>{const q=route.request(),u=new URL(q.url()),j=b=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/me')return j({id:'owner',name:'Owner',role:'owner',caps:null,used:{}});
      if(u.pathname==='/push'&&q.method()==='GET')return j({key:env.VAPID_PUBLIC_KEY,on:false});
      if(u.pathname==='/push'){posted.push(JSON.parse(q.postData()));return j({ok:true,on:true})}
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');rememberRole({role:'owner'});
      let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'})];
      settings.workdays=[0,1,2,3,4];TODAY_OVERRIDE='2026-11-12T08:00:00';dayRecs={};cache={};
      // a phone that can receive pushes, without a real push service
      const sub={endpoint:'https://web.push.apple.com/me',unsubscribe:async()=>true};let have=null;
      window.Notification.requestPermission=async()=>'granted';
      const reg={addEventListener(){},removeEventListener(){},update:async()=>{},installing:null,waiting:null,active:null,pushManager:{getSubscription:async()=>have,subscribe:async o=>{window.__appKey=o.applicationServerKey.length;have=sub;return sub}}};
      Object.defineProperty(navigator.serviceWorker,'ready',{get:()=>Promise.resolve(reg),configurable:true});navigator.serviceWorker.getRegistration=async()=>reg},HOST);
    await p.evaluate(()=>openSettings('schedule'));await p.waitForSelector('#remind-sw');
    const box=await p.textContent('#remind-box');
    await p.click('#remind-sw');await p.waitForFunction(()=>remindPrefs().on&&!remindBusy);
    const after=await p.evaluate(async()=>{const c=await caches.open('dw-keep-remind'),j=await (await c.match('remind.json')).json();return {lines:j,msg:document.querySelector('.remind-msg').textContent,key:window.__appKey,sw:document.querySelector('#remind-sw').getAttribute('aria-checked')}});
    const ps=posted[0]||{},days=Object.keys(after.lines);
    ok(/Morning reminder/.test(box)&&/Remind me/.test(box),'Settings → Schedule has the Morning reminder switch');
    ok(ps.endpoint==='https://web.push.apple.com/me'&&ps.time==='07:00'&&ps.tz&&ps.dates.join()===days.join()&&after.key===65&&after.sw==='true',`switching it on subscribes with the server's key and sends the time, the time zone and the coming workdays (${ps.dates&&ps.dates.length} dates)`);
    ok(days.length>=8&&days.every(d=>{const w=new Date(d+'T12:00').getDay();return w<=4})&&/^[A-Z][a-z]+ (suit|blazer) · [a-z]+ shirt · .+ tie$/.test(after.lines[days[0]]),`the app keeps the line for each workday for the service worker ("${after.lines[days[0]]}")`);
    await p.fill('#remind-time','06:45');await p.dispatchEvent('#remind-time','change');await p.waitForFunction(n=>window.__n=n,posted.length);await p.waitForTimeout(400);
    ok(posted.at(-1).time==='06:45','changing the time tells the server');
    await p.click('#remind-sw');await p.waitForFunction(()=>!remindPrefs().on&&!remindBusy);
    ok(posted.at(-1).off===true,'switching it off tells the server');
    // not connected: not shown
    await p.evaluate(()=>{closeSettings();localStorage.removeItem('worker_url');localStorage.removeItem('app_token');openSettings('schedule')});
    ok(!(await p.isVisible('#remind-box')),'not connected: no reminder switch');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
