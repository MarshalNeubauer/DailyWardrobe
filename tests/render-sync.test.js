// Generated photos are saved per outfit combination: any day with the same pieces reuses the photo (no new charge),
// and the worker keeps a copy (KV, render:c<16 hex>) so every device shows it. Photos saved per date before this
// change are moved over the first time their outfit is shown.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async href=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});calls++;
    return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})};
  const store=new Map(),puts=[],KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{puts.push([k,o]);store.set(k,v)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV},HOST='https://w.test/';
  const browser=await chromium.launch();
  const setup=()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',updated:1,...x});
    items=[I('suit','navy'),I('shirt','lightblue'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('suit','charcoal')];
    settings.workdays=[0,1,2,3,4];settings.vestMode='auto';dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')};
  const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    return {p,errs}};
  const photoShown=p=>p.evaluate(()=>!!document.querySelector('.fig.photo img'));
  try{
    const A=await device();await A.p.evaluate(setup);
    const ck=await A.p.evaluate(()=>comboKey(planFor()[key(sel)]));
    ok(/^c[0-9a-f]{16}$/.test(ck),`each outfit combination has a key (${ck})`);
    await A.p.click('.render-btn');await A.p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(calls===1&&await photoShown(A.p),'desktop generates the photo');
    ok(store.has('render:'+ck)&&puts.some(([k,o])=>k==='render:'+ck&&!o),'the worker keeps it under the combination key (no expiry)');
    ok(await A.p.evaluate(async k=>!!(await metaGet('render:'+k)),ck),'and so does the device');
    // the same combination on another day: shown at once, nothing generated
    const other=await A.p.evaluate(()=>{const o=planFor()[key(sel)],d='2026-11-18';
      dayRecs[d]={date:d,force:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,...(o.clip?{clip:o.clip.id}:{}),...(o.watch?{watch:o.watch.id}:{})},vest:o.vest};cache={};
      sel=new Date(2026,10,18);renderToday();const o2=planFor()[key(sel)];return {same:comboKey(o2)===comboKey(o),btn:document.querySelector('.render-btn').textContent,cap:(document.querySelector('.fig.photo small')||{}).textContent||''}});
    ok(other.same&&await photoShown(A.p)&&other.btn==='Regenerate photo'&&calls===1,'another day with the same outfit reuses the photo (no new charge)');
    ok(/reused whenever this outfit comes back/.test(other.cap),'the caption says the photo is reused for this outfit');
    // a different combination has no photo; changing how a piece looks (colour) makes it a different combination
    ok(await A.p.evaluate(()=>{sel=new Date(2026,10,17);renderToday();return !document.querySelector('.fig.photo')}),'a different outfit is drawn, not given the photo');
    ok(await A.p.evaluate(()=>{const o=planFor()['2026-11-16'],a=comboKey(o),b=comboKey({...o,tie:{...o.tie,primaryColor:'green'}}),c=comboKey({...o,tie:{...o.tie,updated:99}}),d=comboKey({...o,vest:!o.vest});return a!==b&&a===c&&a!==d}),
      'the key changes with colour or vest, not with an unrelated edit');
    // the phone gets it from the worker for any day with that combination
    const B=await device();await B.p.evaluate(setup);
    await B.p.waitForFunction(()=>!!document.querySelector('.fig.photo img'),null,{timeout:8000}).catch(()=>{});
    ok(await photoShown(B.p)&&calls===1,'the phone shows the desktop\'s photo without generating another');
    // photos saved per date before this change: a local one is moved and shared; a worker one is picked up
    store.clear();
    const mig=await A.p.evaluate(async()=>{const o=planFor()['2026-11-16'],ck=comboKey(o);delete renders[ck];await txs('meta','readwrite',s=>s.delete('render:'+ck));
      renders['2026-11-16']={sig:legacySig(o),img:'data:image/jpeg;base64,/9j/',model:'gpt-image-2',t:5};renderTried.clear();sel=new Date(2026,10,16);renderToday();
      await new Promise(r=>setTimeout(r,600));return {shown:!!document.querySelector('.fig.photo img'),local:!!(await metaGet('render:'+ck)),ck}});
    ok(mig.shown&&mig.local&&store.has('render:'+mig.ck),'an old date-keyed photo on the device is moved to its combination and shared');
    const C=await device();store.delete('render:'+mig.ck);
    const legacy=await C.p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',updated:1,...x});
      items=[I('suit','navy'),I('shirt','lightblue'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('suit','charcoal')];
      settings.workdays=[0,1,2,3,4];settings.vestMode='auto';dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};return legacySig(planFor()['2026-11-16'])});
    store.set('render:2026-11-16',JSON.stringify({sig:legacy,img:'data:image/jpeg;base64,'+JPG,model:'gpt-image-2',t:3}));
    await C.p.evaluate(()=>{sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
    await C.p.waitForFunction(()=>!!document.querySelector('.fig.photo img'),null,{timeout:8000}).catch(()=>{});
    ok(await photoShown(C.p)&&store.has('render:'+mig.ck),'an old date-keyed photo on the worker is picked up and re-saved under its combination');
    const bad=await worker.fetch(new Request(HOST+'render',{method:'PUT',headers:{'x-app-token':'t'},body:JSON.stringify({key:'c0123456789abcdef',rec:{img:'javascript:alert(1)'}})}),env);
    ok(bad.status===400,'the worker only accepts image data');
    ok((await worker.fetch(new Request(HOST+'render?key=nope',{headers:{'x-app-token':'t'}}),env)).status===400,'the worker rejects malformed keys');
    ok((await worker.fetch(new Request(HOST+'render?key='+ck),env)).status===403,'GET /render needs the app token');
    ok(A.errs.length===0&&B.errs.length===0&&C.errs.length===0,'no page errors');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
