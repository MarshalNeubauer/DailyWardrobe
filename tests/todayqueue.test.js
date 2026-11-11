// "Generate realistic photo" on Today (and Settings → Regenerate) goes to the worker's background queue, so the app can be swiped
// to another day, closed or locked while the photo is made; the app picks it up when it next looks. A regenerate replaces the
// kept photo. A failure says why and offers to try again. Mocked queue, KV and OpenAI; the real worker.js.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;let calls=0,reply=()=>[200,{data:[{b64_json:JPG}]}];
  globalThis.fetch=async href=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});calls++;const [st,b]=reply();
    return new Response(JSON.stringify(b),{status:st,headers:{'content-type':'application/json'}})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))})};
  const sent=[],posts=[],Q={send:async m=>{sent.push(m)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:Q},HOST='https://w.test/';
  const drain=async()=>{for(const body of sent.splice(0)){const m={body,attempts:1,ack(){},retry(){}};await worker.queue({messages:[m]},env)}};
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(q.method()==='POST')posts.push(JSON.parse(q.postData()||'{}'));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    const ck=await p.evaluate(()=>comboKey(planFor()[key(sel)]));
    await p.click('text=Generate realistic photo');await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    const pend=await p.evaluate(()=>{const b=document.querySelector('.render-btn');return {t:b.textContent,dis:b.disabled,spin:!!b.querySelector('.spin'),msg:document.querySelector('#render-msg').textContent,
      q:queuedKeys(),busy:document.querySelector('#busy').textContent}});
    ok(posts.length===1&&posts[0].mode==='queue'&&!posts[0].replace&&calls===0&&pend.q.includes(ck),'Generate sends the outfit to the worker\'s background queue (nothing is made while the app waits)');
    ok(/Making photo/.test(pend.t)&&pend.dis&&pend.spin&&/close the app/.test(pend.msg)&&/Making 1 photo in the background/.test(pend.busy),`while it is made: a spinning, disabled "Making photo…" and a note that the app can be closed ("${pend.msg}")`);
    const other=await p.evaluate(()=>{stepDay(1);const b=document.querySelector('.render-btn');return {t:b&&b.textContent,dis:b&&b.disabled,pend:renderPending(planFor()[key(sel)])}});
    ok(other.t==='Generate realistic photo'&&!other.dis&&!other.pend,'swiping to another day: that day can have its own photo made meanwhile');
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
    await p.click('text=Generate realistic photo');await p.waitForFunction(()=>!rendering,null,{timeout:15000});await drain();await p.evaluate(()=>checkQueue());await settle(p,200);
    const f=await p.evaluate(()=>({t:document.querySelector('.render-btn').textContent,dis:document.querySelector('.render-btn').disabled,msg:document.querySelector('#render-msg').textContent}));
    ok(f.t==='Try again'&&!f.dis&&/couldn’t be made: .*verif/i.test(f.msg),`a failed photo says why and offers to try again ("${f.msg}")`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
