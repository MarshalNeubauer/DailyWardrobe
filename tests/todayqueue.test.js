// A day's photo (Settings → This day's photo; Today has no Generate button) goes to the worker's background queue, so the app can be swiped
// to another day, closed or locked while the photo is made; the app picks it up when it next looks. A regenerate replaces the
// kept photo. A failure says why and offers to try again. The worker pushes a finished photo to the open app through a Durable
// Object (RenderHub) answering a held GET /render-wait; polling is the backup. Mocked queue, KV, Durable Object and OpenAI; the real worker.js.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;let calls=0,reply=()=>[200,{data:[{b64_json:JPG}]}];
  globalThis.fetch=async href=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});calls++;const [st,b]=reply();
    return new Response(JSON.stringify(b),{status:st,headers:{'content-type':'application/json'}})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>{KV.lists=(KV.lists||0)+1;if(KV.noList)throw new Error('KV list limit exceeded for the day');return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)&&!(KV.lag&&k.startsWith('job:'))).map(name=>({name}))}}};   // lag: a list that doesn't show new jobs yet, as KV can
  const sent=[],posts=[],Q={send:async m=>{sent.push(m)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:Q},HOST='https://w.test/';
  const drain=async()=>{for(const body of sent.splice(0)){const m={body,attempts:1,ack(){},retry(){}};await worker.queue({messages:[m]},env)}};
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:404,body:'{}'});   // backup sync isn't under test (the two pages would share one)
      if(q.method()==='POST')posts.push(JSON.parse(q.postData()||'{}'));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    const ck=await p.evaluate(()=>comboKey(planFor()[key(sel)]));
    await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    const pend=await p.evaluate(()=>({btn:!!document.querySelector('.render-btn'),spin:!!document.querySelector('#render-msg .spin'),msg:document.querySelector('#render-msg').textContent,
      q:queuedKeys(),busy:document.querySelector('#busy').textContent}));
    ok(posts.length===1&&posts[0].mode==='queue'&&!posts[0].replace&&calls===0&&pend.q.includes(ck),'Generate sends the outfit to the worker\'s background queue (nothing is made while the app waits)');
    ok(!pend.btn&&pend.spin&&/close the app/.test(pend.msg)&&/Making 1 photo in the background/.test(pend.busy),`while it is made Today has no button, a spinning note that the app can be closed ("${pend.msg}")`);
    const other=await p.evaluate(()=>{stepDay(1);return {btn:!!document.querySelector('.render-btn'),pend:renderPending(planFor()[key(sel)])}});
    ok(!other.btn&&!other.pend,'swiping to another day: it isn\'t waiting on that one, and Today offers no Generate button there either');
    await p.evaluate(()=>stepDay(-1));
    // the worker makes it (the app could be closed); the app picks it up when it looks
    await drain();await p.evaluate(()=>checkQueue());await p.waitForFunction(()=>!!document.querySelector('.fig.photo img'),null,{timeout:10000});
    const done=await p.evaluate(()=>({btn:!!document.querySelector('.render-btn'),q:queuedKeys().length,busy:document.querySelector('#busy').classList.contains('on')}));
    ok(calls===1&&!done.btn&&done.q===0&&!done.busy,'when it is ready it replaces the drawing, and nothing is left waiting');
    // Settings → Regenerate: replaces the kept photo
    const before=store.get('render:'+ck);
    await p.evaluate(()=>{openSettings();document.querySelector('#regen-btn').click()});await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    const rg=await p.evaluate(()=>({t:document.querySelector('#regen-btn').textContent,dis:document.querySelector('#regen-btn').disabled}));
    ok(posts.at(-1).mode==='queue'&&posts.at(-1).replace===true&&sent.length===1&&/Making photo/.test(rg.t)&&rg.dis,'Regenerate queues a replacement though a photo exists, and its button waits');
    reply=()=>[200,{data:[{b64_json:JPG.replace('A=','B=')}]}];await drain();
    ok(calls===2&&store.get('render:'+ck)!==before,'the worker makes the replacement (a queued regenerate isn\'t skipped as already made)');
    await p.evaluate(()=>{closeSettings();show('today')});await p.evaluate(()=>checkQueue());await settle(p,200);
    ok(await p.evaluate(()=>!queuedKeys().length&&!document.querySelector('#regen-btn').disabled),'the app brings the new one home');
    // a failure says why and offers to try again
    await p.evaluate(()=>{stepDay(1)});
    reply=()=>[400,{error:{message:'Your organization must be verified to use the model gpt-image-2.'}}];
    await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});await drain();await p.evaluate(()=>checkQueue());await settle(p,200);
    const f=await p.evaluate(()=>{openSettings('photos');const r={btn:!!document.querySelector('.render-btn'),msg:document.querySelector('#render-msg').textContent,rg:document.querySelector('#regen-btn').textContent,dis:document.querySelector('#regen-btn').disabled};closeSettings();return r});
    ok(!f.btn&&/couldn’t be made\. .*verif/i.test(f.msg)&&/^Generate photo for/.test(f.rg)&&!f.dis,`a failed photo says why on Today, and Settings can try again ("${f.msg}"; "${f.rg}")`);
    ok(await p.evaluate(()=>noPush),'a worker without the push: the app just polls');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
    // ---- the polling schedule
    // ---- jobs the consumer can't see yet, crashes and hangs never leave a photo "pending" for days
    {const K='c4444444444444444',job={key:K,image:'data:image/png;base64,AA',refs:[],labels:[],outfit:'x',sig:'s',t:1};
      const run=async(attempts)=>{const m={body:{key:K},attempts,acked:false,retried:null,ack(){this.acked=true},retry(o){this.retried=o}};await worker.queue({messages:[m]},env);return m};
      let m=await run(1);
      ok(!m.acked&&m.retried&&m.retried.delaySeconds===20,'a job not yet visible in KV (written moments before, elsewhere) is tried again in 20 s, not dropped');
      m=await run(6);ok(m.acked,'…and given up only after several tries');
      reply=()=>[200,{data:[{b64_json:JPG}]}];
      store.set('job:'+K,JSON.stringify(job));const put0=KV.put;let sig=null;const f0=globalThis.fetch;
      globalThis.fetch=async(h,init)=>{sig=init&&init.signal;return f0(h,init)};
      KV.put=async(k,v)=>{if(k.startsWith('render:'))throw new Error('KV down');return put0(k,v)};
      m=await run(1);ok(m.retried&&m.retried.delaySeconds===60&&!m.acked,'a crash is retried');
      const st=await (await worker.fetch(new Request(HOST+'render-queue',{headers:{'x-app-token':'t'}}),env)).json();
      ok(st.pending.includes(K)&&st.running[K]&&st.running[K].attempts===1,'GET /render-queue says how far a waiting photo got (attempts, when it last began)');
      m=await run(4);KV.put=put0;globalThis.fetch=f0;
      ok(m.acked&&store.has('jobfail:'+K)&&/failed making it: KV down/.test(JSON.parse(store.get('jobfail:'+K)).error)&&!store.has('job:'+K),'a job that keeps crashing is recorded as failed, with the reason');
      ok(sig&&typeof sig.aborted==='boolean','the call to OpenAI has a time limit');
      store.delete('jobfail:'+K)}
    // ---- a job stuck as "pending" (its message lost, or its run never finished) is sent again when the app checks, then given up
    {const K='c5555555555555555',status=async()=>(await worker.fetch(new Request(HOST+'render-queue',{headers:{'x-app-token':'t'}}),env)).json();
      sent.splice(0);store.set('job:'+K,JSON.stringify({key:K,image:'data:image/png;base64,AA',refs:[],t:Date.now()-12*60000}));   // like the user's: no jobrun, its message gone
      let st=await status();
      ok(sent.some(m=>m.key===K)&&st.running[K]&&st.running[K].resends===1,'a job that never started is sent to the queue again when the app checks');
      sent.splice(0);await status();ok(!sent.length,'…once, not on every check');
      store.set('jobrun:'+K,JSON.stringify({attempts:1,at:Date.now()-25*60000,resends:1}));await status();
      ok(sent.some(m=>m.key===K)&&JSON.parse(store.get('jobrun:'+K)).resends===2,'a run that never finished (20 minutes) is sent again too');
      store.set('jobrun:'+K,JSON.stringify({attempts:0,at:Date.now()-5*60000,resends:3}));sent.splice(0);st=await status();
      ok(!sent.length&&!store.has('job:'+K)&&/after several tries/.test(JSON.parse(store.get('jobfail:'+K)||'{}').error||'')&&st.failed.some(f=>f.key===K),'after 3 tries it is recorded as failed, not left pending');
      store.delete('jobfail:'+K);sent.splice(0)}
    {const r=await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({mode:'queue',key:'c6666666666666666',image:'data:image/png;base64,AA'})}),env);
      ok(r.status===200&&JSON.parse(store.get('jobrun:c6666666666666666')).attempts===0,'queueing records when the job was sent (so one that never starts is noticed)');
      store.delete('job:c6666666666666666');store.delete('jobrun:c6666666666666666');sent.splice(0)}
    // ---- KV lists are capped per day (1,000 on the free plan): once used up, every list threw and the worker answered error 1101
    {KV.noList=true;const K='c7777777777777777',st=q=>worker.fetch(new Request(HOST+'render-queue'+q,{headers:{'x-app-token':'t'}}),env);
      store.set('job:'+K,JSON.stringify({key:K,image:'x',t:Date.now()}));store.set('jobrun:'+K,JSON.stringify({attempts:1,at:Date.now()}));store.set('jobfail:c8888888888888888',JSON.stringify({error:'OpenAI: no'}));
      const l0=KV.lists||0,r=await st('?keys='+K+',c8888888888888888,c9999999999999999'),j=await r.json();
      ok(r.status===200&&j.pending.join()===K&&j.failed.length===1&&j.failed[0].key==='c8888888888888888'&&(KV.lists||0)===l0,'given the keys it waits for, the queue status reads each one and lists nothing');
      const old=await st(''),all=await worker.fetch(new Request(HOST+'render?list=1',{headers:{'x-app-token':'t'}}),env);
      ok(old.status===503&&all.status===503,'with the list allowance used up, the old status and the photo list answer 503 instead of crashing');
      KV.noList=false;for(const k of ['job:'+K,'jobrun:'+K,'jobfail:c8888888888888888'])store.delete(k)}
    // ---- the push: RenderHub (Durable Object) on its own
    const hub=new mod.RenderHub({},{}),H=(path,init)=>hub.fetch(new Request('https://hub'+path,init)),note=b=>H('/notify',{method:'POST',body:JSON.stringify(b)});
    const K1='c1111111111111111',K2='c2222222222222222';
    let w=H(`/wait?keys=${K1},${K2}&ms=3000`).then(r=>r.json());await new Promise(r=>setTimeout(r,30));
    await note({key:K1,rec:{img:'data:image/jpeg;base64,AA',sig:'s',model:'m',t:1}});const got=await w;
    ok(got.length===1&&got[0].key===K1&&got[0].rec.img,'a waiting request is answered the moment the photo is handed over, with the photo');
    const again=await (await H(`/wait?keys=${K1}&ms=3000`)).json();
    ok(again.length===1&&again[0].key===K1,'a photo finished between two waits is kept and handed over on the next');
    const t0=Date.now(),none=await (await H(`/wait?keys=${K2}&ms=1000`)).json();
    ok(none.length===0&&Date.now()-t0>=900,'with nothing finished the wait ends empty after its time');
    w=H(`/wait?keys=${K2}&ms=3000`).then(r=>r.json());await new Promise(r=>setTimeout(r,30));await note({key:K2,error:'OpenAI: refused'});
    ok((await w)[0].error==='OpenAI: refused','a failure is pushed too');
    const ns={idFromName:()=>'id',get:()=>({fetch:(u,init)=>hub.fetch(new Request(u,init))})};
    const W2=(q,tok='t',e=env)=>worker.fetch(new Request(HOST+'render-wait'+q,{headers:{'x-app-token':tok}}),e);
    ok((await W2('?keys='+K1,'x',{...env,RENDER_HUB:ns})).status===403&&(await W2('?keys='+K1)).status===501&&(await W2('?keys=bad','t',{...env,RENDER_HUB:ns})).status===400,'GET /render-wait needs the token, the hub binding and real keys');
    // ---- the app with the push: the photo arrives as soon as the worker has made it, without polling
    const hub2=new mod.RenderHub({},{}),ns2={idFromName:()=>'id',get:()=>({fetch:(u,init)=>hub2.fetch(new Request(u,init))})};
    env.RENDER_HUB=ns2;reply=()=>[200,{data:[{b64_json:JPG}]}];
    const ctx2=await browser.newContext({viewport:{width:390,height:900}});const gets=[];
    await ctx2.route(HOST+'**',async route=>{const q=route.request();if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:404,body:'{}'});   // backup sync isn't under test (the two pages would share one)
      if(q.method()==='GET')gets.push(new URL(q.url()).pathname);else posts.push(JSON.parse(q.postData()||'{}'));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p2=await ctx2.newPage();const errs2=[];p2.on('pageerror',e=>errs2.push(e.message));
    await p2.goto(url);await p2.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p2.reload();await p2.waitForFunction(()=>window.appReady);
    const dl=await p2.evaluate(()=>[0,30000,45000,200000,1000000].map(queueDelay));
    ok(dl.join()==='40000,10000,20000,20000,60000','polling (the backup to the push) waits 40 s after sending, then every 20 s, a minute after 5 minutes');
    await p2.evaluate(()=>{PUSH_WAIT=4000;let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','charcoal'),I('shirt','lightblue'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    await p2.evaluate(()=>generateRender());await p2.waitForFunction(()=>!rendering,null,{timeout:15000});
    await p2.waitForFunction(()=>pushOn,null,{timeout:5000});
    const t1=Date.now();await drain();await p2.waitForFunction(()=>!!document.querySelector('.fig.photo img')&&!queuedKeys().length,null,{timeout:5000});
    ok(Date.now()-t1<2000&&!gets.includes('/render-queue')&&gets.includes('/render-wait'),`the worker pushes the finished photo to the open app: it shows ${Date.now()-t1} ms after it's made, with no polling`);
    ok(await p2.evaluate(()=>!document.querySelector('#busy').classList.contains('on')&&!!renders[comboKey(planFor()[key(sel)])]),'it is kept, and nothing is left waiting');
    // KV lists are only eventually consistent: a job just sent can be missing from /render-queue for up to a minute. A poll then
    // (photo not made yet) must not give up on it, or the push that follows is ignored and the photo shows only after a reload.
    KV.lag=true;
    await p2.evaluate(()=>{items.find(i=>i.type==='tie').primaryColor='navy';cache={};renderToday()});
    await p2.evaluate(()=>generateRender());await p2.waitForFunction(()=>!rendering,null,{timeout:15000});
    const ck2=await p2.evaluate(()=>comboKey(planFor()[key(sel)]));
    await p2.evaluate(()=>checkQueue());
    const still=await p2.evaluate(()=>({q:queuedKeys(),spin:!!document.querySelector('#render-msg .spin')}));
    ok(still.q.includes(ck2)&&still.spin,'a poll that can\'t see the just-sent job yet keeps waiting for it (KV lists lag)');
    await drain();await p2.waitForFunction(()=>!!document.querySelector('.fig.photo img')&&!queuedKeys().length,null,{timeout:5000});
    ok(true,'the push then brings the photo in without a reload');
    // a photo pushed after the app stopped waiting for it is still kept
    await p2.evaluate(async()=>{await takeQueued([{key:'c00000000000abcde',rec:{img:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',sig:'x',model:'m',t:1}}])});
    ok(await p2.evaluate(()=>!!renders['c00000000000abcde']),'a photo that arrives after the app stopped waiting is kept anyway');
    // one never seen for 45 minutes is given up on
    const gone=await p2.evaluate(async()=>{rqSet({keys:['c00000000000fffff'],failed:[],total:1,at:{c00000000000fffff:Date.now()-46*60000}});await checkQueue();return queuedKeys().length});
    ok(gone===0,'a photo unseen for 45 minutes counts as lost');
    // a photo waiting over 10 minutes: Settings sends it again
    const stall=await p2.evaluate(()=>{items.find(i=>i.type==='tie').primaryColor='burgundy';cache={};const ck=comboKey(planFor()[key(sel)]);delete renders[ck];
      rqSet({keys:[ck],failed:[],total:1,at:{[ck]:Date.now()-11*60000}});renderToday();openSettings('photos');const r={ck,btn:!!document.querySelector('.render-btn'),dis:document.querySelector('#regen-btn').disabled,msg:document.querySelector('#render-msg').textContent};closeSettings();return r});
    ok(await p2.evaluate(()=>!document.querySelector('#busy').classList.contains('on')),'a stalled photo isn\'t counted as being made in the pill');
    ok(!stall.btn&&!stall.dis&&/over 10 minutes/.test(stall.msg)&&/Settings/.test(stall.msg),`a photo stuck over 10 minutes says Settings sends it again ("${stall.msg}")`);
    const nPosts=posts.length;await p2.evaluate(()=>{openSettings('photos');document.querySelector('#regen-btn').click();closeSettings()});await p2.waitForFunction(()=>!rendering,null,{timeout:15000});
    const re=await p2.evaluate(ck=>({pend:renderPending(planFor()[key(sel)]),age:Date.now()-rqGet().at[ck]}),stall.ck);
    ok(posts.length===nPosts+1&&posts.at(-1).mode==='queue'&&re.pend&&re.age<60000,'Settings sends it to the queue again and waits afresh');
    await drain();await p2.waitForFunction(()=>!queuedKeys().length,null,{timeout:5000});
    KV.lag=false;
    ok(errs2.length===0,'no page errors ('+errs2.join('; ')+')');
    await ctx2.close();
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
