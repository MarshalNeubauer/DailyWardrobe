// The server's limits: the daily KV allowance, request volume, testers' saves and views.
// Joined by feature from 4 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url');

/* ---- was tests/kvlimit.test.js ---- */
// The worker's writes for the day used up (2026-11-14: Cloudflare's free plan allows 1,000 KV writes a day; the PC's picture uploads used them
// up and every backup answered "The server had a problem just now"): the worker answers 429 kv-limit (what 'backup' for /sync), the app
// pauses its uploads until the next UTC day and says so in words, with the local time of the reset.
const kvlimit=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();let full=false;
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{if(full)throw new Error('KV put() limit exceeded for the day.');store.set(k,v);meta.set(k,o&&o.metadata)},
    delete:async k=>{store.delete(k);meta.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  // the worker's own answers
  const call=(p,o={})=>worker.fetch(new Request(HOST+p,{...o,headers:{'x-app-token':'secret','content-type':'application/json',...(o.headers||{})}}),env);
  await call('sync',{method:'PUT',body:JSON.stringify({baseRev:0,day:'2026-11-14',data:{items:[{id:'a',type:'tie',primaryColor:'navy',pattern:'solid',updated:1}],days:[],tombstones:{},settings:{updated:1}}})});
  full=true;const L=await (await call('sync?lite=1')).json();
  const r1=await call('sync',{method:'POST',body:JSON.stringify({baseRev:L.rev,baseSaved:L.saved,day:'2026-11-14',delta:{items:[{id:'b',type:'tie',primaryColor:'green',pattern:'solid',updated:2}],days:[],tombstones:{}},photos:{}})}),j1=await r1.json();
  const r2=await call('render',{method:'PUT',body:JSON.stringify({key:'c0123456789abcdef',rec:{sig:'x',img:'data:image/jpeg;base64,AA',model:'assembled',t:1}})}),j2=await r2.json().catch(()=>({}));
  ok(r1.status===429&&j1.error==='kv-limit'&&j1.what==='backup'&&/used up/.test(j1.message),`a backup save answers 429 kv-limit, "backup" (${r1.status} ${JSON.stringify(j1).slice(0,90)})`);
  ok(r2.status===429&&j2.error==='kv-limit'&&j2.what==='write','a picture upload answers 429 kv-limit too');
  // the app, against that worker
  const browser=await chromium.launch();
  try{const ctx=await browser.newContext({timezoneId:'Asia/Kuwait'});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{await HOOK.syncNow();const it={id:'n',type:'tie',primaryColor:'burgundy',pattern:'solid',added:Date.now()};await HOOK.put(it);HOOK.items.push(it);const ok1=await HOOK.syncNow();
      const st=localStorage.getItem('sync_status')||'',pause=+localStorage.getItem('sync_pause')||0;let n=0;const f0=window.fetch;window.fetch=function(u,o){if(o&&o.method&&o.method!=='GET')n++;return f0.apply(this,arguments)};
      const ok2=await HOOK.syncNow();window.fetch=f0;return {ok1,ok2,st,pause,writes:n,reset:new Date(pause).toISOString()}});
    ok(!r.ok1&&/Today’s backups are used up on the server\. Your changes are kept on this phone and back up after 3:00/.test(r.st),`the app says why, with the local reset time ("${r.st}")`);
    ok(r.pause>Date.now()&&/T00:00:00/.test(r.reset)&&r.writes===0&&!r.ok2,'and sends nothing more until the next UTC day');
    // (2026-11-14, the owner: Sync now did nothing and the status still read "Backed up 10:28") the status says why while paused, and the
    // Sync now button always tries: with the server's allowance back (a plan upgraded), it backs up at once
    const s1=await p.evaluate(()=>{localStorage.setItem('last_sync',Date.now()-3600e3);HOOK.openSettings('backup');HOOK.showSyncStatus();return document.querySelector('#sync-status').textContent});
    ok(/^Today’s backups are used up on the server\..*Last backed up /.test(s1),`while paused, the status says so instead of only the last backup's time ("${s1}")`);
    full=false;
    const s2=await p.evaluate(async()=>{const ok=await HOOK.syncTap();return {ok,pause:localStorage.getItem('sync_pause'),st:document.querySelector('#sync-status').textContent,btn:document.querySelector('.sactions button.conn-only').getAttribute('data-act')}});
    ok(s2.ok&&!s2.pause&&/^Backed up /.test(s2.st)&&s2.btn==='syncNowTap',`Sync now tries despite the pause: the server takes it now, the pause is gone ("${s2.st}")`);
    full=true;
    const s3=await p.evaluate(async()=>{const it={id:'n2',type:'tie',primaryColor:'green',pattern:'solid',added:Date.now()};await HOOK.put(it);HOOK.items.push(it);const ok=await HOOK.syncTap();return {ok,pause:+localStorage.getItem('sync_pause')||0}});
    ok(!s3.ok&&s3.pause>Date.now(),'still refused: the pause comes back');
    ok(!errs.length,'no page errors: '+errs.join('; '))}
  finally{await browser.close()}
};

/* ---- was tests/nuserver.test.js ---- */
// The server and request-volume fixes of the new-user audit (2026-11-15): the picture list is one shared request and, once refused
// (429/503), not asked again until the next UTC day; item pictures stop at the first one the server can't keep, keep that one on the
// phone and say so; a picture is not paid for once the server's saves are known to be used up; Kuwait's holidays come from a built-in
// list; a photo reading the app closed on gives its count back. Mocked KV, Durable Object, OpenAI and Claude; the real worker and app.
const nuserver=async({ok,chromium,url,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let openai=0,claudeWait=false;
  globalThis.fetch=async(href,init)=>{href=String(href);
    if(href.startsWith('https://api.openai.com/v1/images/')){openai++;return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})}
    if(href.startsWith('https://api.anthropic.com/')&&claudeWait)return new Promise((ok,no)=>{const s=init&&init.signal;if(!s)return;
      if(s.aborted)return no(new DOMException('aborted','AbortError'));s.addEventListener('abort',()=>no(new DOMException('aborted','AbortError')))});
    return new Response('',{status:404})};
  const kv=(o={})=>{const store=new Map(),meta=new Map();return {store,o,
    get:async(k,t)=>store.has(k)?((t==='json'||(t&&t.type==='json'))?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,x)=>{if(o.failPut&&o.failPut(k))throw new Error('KV put() limit exceeded for the day.');store.set(k,typeof v==='string'?v:new TextDecoder().decode(v));if(x&&x.metadata)meta.set(k,x.metadata)},
    delete:async k=>{store.delete(k)},list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}};
  const hubs=new Map(),HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>st.clear()}},{}))}return hubs.get(name).fetch(new Request(u,init))}})};
  const HOST='https://w.test/';
  const call=(env,method,p,body,tok,signal)=>worker.fetch(new Request(HOST+p,{method,signal,headers:{'content-type':'application/json','x-app-token':tok},body:body===undefined?undefined:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,...(await r.clone().json().catch(()=>({})))});
  const browser=await chromium.launch();
  try{
    // ---- worker: an item picture the server can't keep (KV's daily writes used up)
    {let full=true;const KV=kv({failPut:k=>full&&/render:/.test(k)}),env={APP_TOKEN:'o',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_HUB:HUB};
      const code=(await J(await call(env,'POST','invites',{name:'t'},'o'))).code;
      const item=k=>({mode:'item',item:'a pair of black calf leather cap-toe oxford dress shoes',key:'c012345678900000'+k});
      const hubUsed=async()=>{const day=new Date().toISOString().slice(0,10),out={};for(const [n,h] of hubs)if(/u:(?!all:)/.test(n))Object.assign(out,(await (await h.fetch(new Request('https://hub/used?day='+day))).json()).used||{});return out};
      const a=await J(await call(env,'POST','render',item('a'),code)),me1=await hubUsed();
      ok(a.s===200&&a.stored===false&&/^data:image\/jpeg/.test(a.image)&&/kept on this phone only/.test(a.message)&&!/KV|worker|Cloudflare/i.test(a.message)&&openai===1,
        `a picture made while the server can't save is still handed to the app, marked not stored, in plain words (${a.s}, ${a.message})`);
      ok((me1.item||0)===1&&!(me1.write>0),`it counts as a picture made (it is on the phone) but not as a write (${JSON.stringify(me1)})`);
      const b=await J(await call(env,'POST','render',item('b'),code)),me2=(await J(await call(env,'GET','me',undefined,code))).used||{};
      ok(b.s===429&&b.error!==undefined&&/no item pictures can be made until the daily reset/.test(b.message)&&openai===1&&(me2.item||0)===1,
        `the next picture is refused before OpenAI is paid (${b.s}, OpenAI calls ${openai}, used ${JSON.stringify(me2)})`);
      full=false;const KV2=kv(),env2={...env,WARDROBE:KV2};
      const c=await J(await call(env2,'POST','render',item('c'),'o'));
      ok(c.s===200&&c.stored===undefined&&KV2.store.has('render:c012345678900000c')&&openai===2,'with its saves back (another KV) a picture is made and kept as before');}
    // ---- worker: Kuwait's public holidays from the built-in list when no calendar answers
    {const env={APP_TOKEN:'o'};
      const kw=await J(await call(env,'GET','holidays?country=KW',undefined,'o')),gb=await call(env,'GET','holidays?country=GB',undefined,'o');
      const names=(kw.holidays||[]).map(h=>h.date.slice(5)+' '+h.name);
      ok(kw.s===200&&kw.source==='built-in'&&kw.country==='KW'&&names.some(n=>/^02-25 National Day$/.test(n))&&names.some(n=>/^02-26 Liberation Day$/.test(n))&&names.some(n=>/Eid al-Fitr \(expected\)/.test(n))&&names.some(n=>/Eid al-Adha \(expected\)/.test(n)),
        `Kuwait gets its holidays from the built-in list (${kw.s}, ${names.length}: ${names.slice(0,4).join('; ')}…)`);
      const all=mod.default&&(await import(pathToFileURL(path.join(ROOT,'worker','holidays.js')).href)).BUILTIN_HOLIDAYS.kw;
      const last=all.map(x=>x[0]).sort().pop(),ahead=(Date.parse(last)-Date.now())/864e5;
      ok(ahead>300,`the built-in Kuwait list reaches at least ~10 months ahead (to ${last}; extend it each year)`);
      ok(gb.status===404,'a country with no calendar and no built-in list still answers 404');}
    // ---- worker: a photo reading the app closed on is stopped and its count goes back
    {const env={APP_TOKEN:'o',ANTHROPIC_API_KEY:'a',CLAUDE_RETRY_MS:0,WARDROBE:kv(),RENDER_HUB:HUB};
      const code=(await J(await call(env,'POST','invites',{name:'k'},'o'))).code;claudeWait=true;
      const ac=new AbortController();setTimeout(()=>ac.abort(),80);
      const r=await call(env,'POST','',{image:PNG},code,ac.signal);claudeWait=false;
      const used=(await J(await call(env,'GET','me',undefined,code))).used||{};
      ok(r.status===499&&!(used.tag>0),`a reading the app closed on stops, and the tester's photo readings stay at 0 (${r.status}, ${JSON.stringify(used)})`);}

    // ---- the app: one shared list, paused after a refusal
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    let listMode=200;const asks=[];const KV=kv({failPut:()=>false}),env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV};
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());if(u.pathname==='/sync')return route.fulfill({status:503,body:'sync is off in this test'});
      if(u.pathname==='/render'&&q.method()==='GET')asks.push(u.search);
      if(u.searchParams.get('list')==='1'&&listMode!==200)return route.fulfill({status:listMode,contentType:'application/json',body:'{"error":"limit","message":"Today’s photo list checks are used up."}'});
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const lists=()=>asks.filter(a=>/list=1/.test(a)).length;
    const both=await p.evaluate(async()=>{HOOK.listKeys=null;HOOK.listAt=0;HOOK.remoteKeys=null;await Promise.all([HOOK.asmListGet(),HOOK.remoteList(),HOOK.asmListGet(),HOOK.remoteList()]);return {asm:!!HOOK.asmList,remote:HOOK.remoteListed}});
    const n0=lists();asks.length=0;
    await p.evaluate(async()=>{HOOK.remoteKeys=null;await Promise.all([HOOK.asmListGet(),HOOK.remoteList()])});
    ok(both.asm&&both.remote&&lists()===0,`the painted pictures and the outfit photos share one list, kept for a while (${n0} at start, ${lists()} more when both asked again)`);
    listMode=429;asks.length=0;
    const paused=await p.evaluate(async()=>{HOOK.listKeys=null;HOOK.listAt=0;HOOK.remoteKeys=null;HOOK.asmList=null;await HOOK.remoteList();HOOK.remoteKeys=null;
      await Promise.all([HOOK.asmListGet(),HOOK.remoteList(),HOOK.asmListGet()]);
      const o={top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'}};HOOK.renderTried.clear();await HOOK.fetchRemoteRender(o,'2026-11-16');
      let p=null;try{p=JSON.parse(localStorage.getItem('list_pause'))}catch{}return {p,asm:HOOK.asmList,listed:HOOK.remoteListed}});
    const tomorrow=(d=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1))(new Date());
    ok(lists()===1&&asks.length===1&&paused.p&&paused.p.until===tomorrow&&!paused.asm&&!paused.listed,
      `a refused list (429) is not asked again until the next UTC day, and no day is asked about one by one meanwhile (${asks.length} requests: ${asks.join(' ')})`);
    listMode=503;asks.length=0;await p.evaluate(async()=>{localStorage.removeItem('list_pause');HOOK.listKeys=null;HOOK.remoteKeys=null;await HOOK.remoteList();HOOK.remoteKeys=null;await HOOK.remoteList();await HOOK.asmListGet()});
    ok(lists()===1,`a 503 list pauses the same way (${lists()} request)`);
    listMode=200;asks.length=0;const forced=await p.evaluate(async()=>{const L=await HOOK.asmListGet(true);return !!L&&!localStorage.getItem('list_pause')});
    ok(lists()===1&&forced,'a forced ask (Settings) still tries once, and a list that comes clears the pause');

    // ---- the app: an item-picture batch stops at the first picture the server can't keep
    KV.o.failPut=k=>/render:/.test(k);openai=0;
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      for(const x of Object.keys(HOOK.renders))delete HOOK.renders[x];HOOK.renderTried.clear();HOOK.openSettings('photos')});
    await p.evaluate(()=>{HOOK.startItemPics()});await p.click('#ask-ok');
    await p.waitForFunction(()=>!HOOK.itemBatch&&/Done/.test(HOOK.$('#itempic-status').textContent),null,{timeout:20000});
    const st=await p.evaluate(()=>({status:HOOK.$('#itempic-status').textContent,local:Object.values(HOOK.renders).filter(r=>r&&r.local).length,left:HOOK.missingItemPics().length}));
    ok(openai===1&&st.local===1&&st.left===3,`the batch stops after the first picture the server couldn't keep: one paid for, kept on the phone (${openai} made, ${st.local} kept here, ${st.left} left)`);
    ok(/^Done: 1 picture ready, 3 not made \(.*kept on this phone only/.test(st.status)&&!/failed|changes are kept/.test(st.status),`it says so plainly (${st.status})`);
    await p.evaluate(()=>{HOOK.startItemPics()});await p.click('#ask-ok');
    await p.waitForFunction(()=>!HOOK.itemBatch&&/Done: 0/.test(HOOK.$('#itempic-status').textContent),null,{timeout:20000}).catch(()=>{});
    const st2=await p.evaluate(()=>HOOK.$('#itempic-status').textContent);
    ok(openai===1&&/^Done: 0 pictures ready, 3 not made \(.*no item pictures can be made until the daily reset/.test(st2),`a second tap is refused before anything is paid for, and says why (${openai} made; ${st2})`);
    KV.o.failPut=()=>false;
    const shared=await p.evaluate(async()=>({n:await HOOK.shareLocalPics(),local:Object.values(HOOK.renders).filter(r=>r&&r.local).length}));
    ok(shared.n===1&&shared.local===0&&[...KV.store.keys()].some(k=>/^render:c/.test(k)),'once the server saves again, the picture kept on the phone is uploaded');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

/* ---- was tests/testersync.test.js ---- */
// A tester's backups: a change waits until the app goes to the background (or 15 minutes), so every tap doesn't upload the whole
// wardrobe; over the server's daily limit the app stops uploading until the next day; an invitation that was switched off is said
// once and the app stops trying. The owner's phone still backs up 2.5 s after a change.
const testersync=async({ok,chromium,url})=>{
  const HOST='https://w.test/',T='t'.repeat(32);
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let mode='ok',puts=0,gets=0,rev=0;
    await ctx.route(HOST+'**',route=>{const q=route.request(),u=new URL(q.url()),j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/me')return j({id:'tttttttttt',name:'Tia',role:q.headers()['x-app-token']===T?'tester':'owner',caps:null,used:{}});
      if(u.pathname==='/sync'){
        if(mode==='ended')return j({error:'invite off',message:'This invitation has been switched off.'},403);
        if(q.method()==='GET'){gets++;return j({rev,saved:1,data:null})}
        puts++;if(mode==='limit')return j({error:'limit',what:'backup',message:'Today’s 30 backups are used up. Your changes are kept on this phone and backed up tomorrow.'},429);
        rev++;return j({rev,saved:Date.now()})}
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(([h,t])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',t);HOOK.rememberRole({role:'tester'})},[HOST,T]);
    await p.waitForTimeout(3000);puts=0;
    const change=n=>p.evaluate(async n=>{const it={id:'x'+n,type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now(),updated:Date.now()};await HOOK.put(it);HOOK.items.push(it);HOOK.scheduleSync()},n);
    const hide=()=>p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));delete document.visibilityState});
    await change(1);await p.waitForTimeout(3500);const p1=puts;
    await hide();await p.waitForFunction(()=>!HOOK.syncing&&!HOOK.syncDue,null,{timeout:8000});
    ok(p1===0&&puts===1,`a tester's change waits: nothing uploaded 3.5 s later, uploaded once the app goes to the background (${p1} then ${puts})`);
    ok(await p.evaluate(()=>{HOOK.scheduleSync();const due=HOOK.syncDue;return due>0&&due<=HOOK.nowMs()&&HOOK.TESTER_SYNC_MS===15*60000}),'without closing the app it goes up 15 minutes after the first change still waiting');
    await p.evaluate(()=>{clearTimeout(HOOK.syncTimer);HOOK.syncDue=0});
    // the daily limit
    mode='limit';await change(2);await hide();await p.waitForFunction(()=>!HOOK.syncing&&!!localStorage.getItem('sync_pause'),null,{timeout:8000});
    const l=await p.evaluate(()=>({pause:+localStorage.getItem('sync_pause'),st:localStorage.getItem('sync_status')}));
    const tomorrow=await p.evaluate(()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)});
    ok(l.pause===tomorrow&&/backed up tomorrow/.test(l.st),`over the daily limit it says so and waits for the next UTC day (${l.st})`);
    const before=puts;await change(3);await hide();await p.waitForTimeout(1500);
    ok(puts===before,'no more uploads that day');
    await p.evaluate(()=>{localStorage.removeItem('sync_pause');localStorage.removeItem('sync_status')});mode='ok';
    // an invitation switched off
    mode='ended';const g0=gets;await p.evaluate(()=>HOOK.syncNow());
    const e=await p.evaluate(()=>({flag:localStorage.getItem('invite_ended'),toast:document.querySelector('#toast').textContent,st:localStorage.getItem('sync_status')}));
    ok(e.flag===T&&/invitation has ended/.test(e.toast)&&/invitation has ended/.test(e.st),`an invitation switched off is said once (${e.toast})`);
    let tries=0;await p.route(HOST+'sync**',r=>{tries++;r.continue()});await p.evaluate(()=>HOOK.syncNow());await p.waitForTimeout(500);
    ok(tries===0,'and the app stops trying');
    // the owner's phone: right away
    await p.evaluate(h=>{localStorage.setItem('app_token','owner');localStorage.removeItem('invite_ended');HOOK.rememberRole({role:'owner'})},HOST);mode='ok';puts=0;await p.unroute(HOST+'sync**');
    await change(4);await p.waitForTimeout(4500);
    ok(puts===1,`the owner's change goes up 2.5 s later (${puts})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/testerview.test.js ---- */
// What a tester sees and what the owner sees: testers have daily limits, so no cost lines ("about 7¢"); the owner reads the
// feedback, so About doesn't tell them it "goes to the person who invited you". Settings' Backup line says what really
// happened (the last backup's day, or that the last try failed) instead of "Backed up every day".
const testerview=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    /* this part points the app at the made-up host w.test with nothing answering it, so the app's own requests there (/me, /feedback,
       /sync) fail; WebKit reports each as the page error "/w.test/<path> due to access control checks." (Chromium reports nothing).
       Exactly that error, on that host, is left out, as tests/webkit.js does for sw.js; every other error still counts */
    const FAKE_CUT=/^\/w\.test\/[\w\/?=&%.-]* due to access control checks\.$/;
    const p=await browser.newPage({viewport:{width:390,height:900}});const errs=[];p.on('pageerror',e=>{if(!FAKE_CUT.test(e.message))errs.push(e.message)});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the role is remembered for the connection's code
    const as=role=>p.evaluate(r=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','code-'+r);HOOK.acct.me=null;HOOK.rememberRole({role:r})},role);
    // (the day's photo line with its price went with the photo generator, 2026-11-14; showCost still guards the item pictures' price)
    const texts=()=>p.evaluate(()=>({cost:HOOK.showCost(),fb:(HOOK.renderAbout(),document.querySelector('#fb-help').textContent)}));
    await as('tester');const t=await texts();
    ok(t.cost===false,'a tester sees no costs');
    ok(/goes to the person who invited you/.test(t.fb),'a tester is told who reads the feedback');
    await as('owner');const o=await texts();
    ok(o.cost===true&&!/invited you/.test(o.fb)&&/^What works, what doesn’t, what is missing\.$/.test(o.fb),`the owner sees costs, and no "person who invited you" (${o.fb})`);
    ok(await p.evaluate(()=>{localStorage.setItem('app_token','another');return HOOK.acctRole()===null&&HOOK.showCost()}),'a remembered role belongs to its code: another code is asked again');
    // the owner's tools (the Advanced sections) are the owner's only
    const advs=role=>p.evaluate(r=>{localStorage.setItem('worker_url','https://w.test/');if(r){localStorage.setItem('app_token','code-'+r);HOOK.acct.me=null;HOOK.rememberRole({role:r})}else{localStorage.removeItem('worker_url');localStorage.removeItem('app_token')}HOOK.applyRole();
      HOOK.openSettings('schedule');return ['photos','connection'].filter(k=>getComputedStyle(document.querySelector('#adv-'+k)).display!=='none').join()},role);
    const vt=await advs('tester'),vo=await advs('owner'),vn=await advs(null);
    ok(vt===''&&/^(photos,)?connection$/.test(vo)&&vn===''&&await p.evaluate(()=>!document.querySelector('#adv-tagging')),`Advanced sections: none for a tester, all of them for the owner (Schedule has none since 2026-11-14; Outfit pictures' only while item photos are on; Photo tagging has none since 2026-11-13), none before connecting either, until "I run the server" (ui.js connOwn) (tester "${vt}", owner "${vo}", not connected "${vn}")`);
    await p.evaluate(()=>{HOOK.closeSettings();localStorage.setItem('worker_url','https://w.test/')});
    // Backup line
    // (the app's own sync to the made-up server may run meanwhile and write its status, "Syncing…" or a failure, which outranks the line
    // being checked: on a busy machine it did, CR-10-03. Each line waits for it to end, and states the status unless it names one)
    const line=async s=>{await p.waitForFunction(()=>!HOOK.syncing,null,{timeout:15000}).catch(()=>{});return p.evaluate(s=>{s={sync_status:null,...s};localStorage.setItem('app_token','x');for(const [k,v] of Object.entries(s))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);HOOK.settingsSummaries();return document.querySelector('#sum-backup').textContent},s)};
    const now=Date.now(),old=new Date(2026,2,3,12).getTime();
    ok(/^Backed up today$/.test(await line({last_sync:String(now),sync_status:null,sync_wait:null,sync_pause:null})),'a backup today says so');
    // (2026-11-15, the audit) not "Backed up today" while changes wait, the day's saves are used up, or the phone is offline
    ok(/^Backed up today · newer changes waiting$/.test(await line({sync_wait:String(now)})),'changes no backup has taken yet are said');
    const tom=new Date();tom.setHours(24,30,0,0);
    ok(/^Paused until tomorrow · last saved today$/.test(await line({sync_pause:String(+tom)})),'a pause after the day\'s saves were used up is said');
    // (W1-10-03) the reset later today here (west of UTC) says its time, not tomorrow
    ok(/^Paused until \d{1,2}:\d{2}\s?[AP]M · last saved today$/.test(await line({sync_pause:String(Date.now()+60e3)})),'a pause that ends later today says when');
    ok(/^Waiting for a connection · last saved today$/.test(await line({sync_pause:null,sync_wait:null,sync_status:'Not backed up: you’re offline. Your changes are kept on this phone and back up when you’re online again.'})),'offline: waiting for a connection, not "failed"');
    await line({sync_status:null});
    ok(/^Backed up Mar 3$/.test(await line({last_sync:String(old),sync_status:null})),'an older one gives its day');
    const f=await line({last_sync:String(old),sync_status:'Backup failed: HTTP 500'});
    ok(/^Last backup failed · last saved Mar 3$/.test(f),`a failed try says so, with the last good day (${f})`);
    ok(/^Backup failed: not backed up yet$/.test(await line({last_sync:null,sync_status:'Backup failed: HTTP 500'})),'a first try that failed says nothing is backed up');
    ok(/^Not backed up yet: needs a connection$/.test(await p.evaluate(()=>{localStorage.removeItem('worker_url');HOOK.settingsSummaries();return document.querySelector('#sum-backup').textContent})),'without a connection it says so');
    // one title style: descriptions start with a capital, the rest as written; a typed name exactly as typed
    const ti=await p.evaluate(()=>{const a={id:'t1',type:'suit',primaryColor:'navy',pattern:'pinstripe',secondaryColor:'white',added:1},b={...a,id:'t2',name:'navy hopsack'};
      return {a:HOOK.itemTitle(a),b:HOOK.itemTitle(b),cb:HOOK.careName(b),tt:getComputedStyle(Object.assign(document.body.appendChild(document.createElement('span')),{className:'cap',textContent:'x'})).textTransform,
        s:[HOOK.avgText(100),HOOK.avgText(99.96),HOOK.avgText(97.24),HOOK.avgText(null)]}});
    ok(/^Navy [^A-Z]+$/.test(ti.a)&&ti.b==='navy hopsack'&&/: navy hopsack$/.test(ti.cb)&&ti.tt==='none',`a description is sentence case ("${ti.a}"), a typed name is kept as typed everywhere ("${ti.b}", "${ti.cb}")`);
    ok(ti.s.join()==='100,99.9,97.2,–','an average score has one decimal, rounded down, so it reads 100 only when every day did');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['kvlimit',kvlimit],['nuserver',nuserver],['testersync',testersync],['testerview',testerview]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
