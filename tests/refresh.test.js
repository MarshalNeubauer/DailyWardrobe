// The header ↻ button: pulls changes from the worker, reloads from storage, redraws, and says what happened.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)}};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  const device=async(sync=true)=>{const ctx=await browser.newContext({viewport:{width:390,height:800}});
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);
    if(sync){await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload()}
    await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(500);return {ctx,p,errs}};
  const A=await device(),B=await device();
  ok(await B.p.isVisible('#refresh-btn'),'the header has a refresh button');
  await A.p.evaluate(async()=>{const it={id:crypto.randomUUID(),type:'suit',primaryColor:'navy',pattern:'solid',added:Date.now()};await put(it);items.push(it);await syncNow()});
  await B.p.evaluate(()=>show('wardrobe'));
  ok(await B.p.evaluate(()=>items.length===0),'before refreshing, device B does not have the new suit');
  await B.p.click('#refresh-btn');await B.p.waitForFunction(()=>!refreshing);
  ok(await B.p.evaluate(()=>items.length===1&&items[0].type==='suit')&&(await B.p.textContent('#wardrobe')).includes('Suit'),'after ↻ the wardrobe shows the item added on the other device');
  const t=await B.p.textContent('#toast');
  ok(/Refreshed · 1 item \(1 new\)/.test(t)&&await B.p.evaluate(()=>document.querySelector('#toast').classList.contains('on')),`a message says what changed ("${t}")`);
  // without sync set up, ↻ still reloads what is stored on the device (e.g. changed in another tab)
  const C=await device(false);
  await C.p.evaluate(async()=>{const it={id:'other-tab',type:'tie',primaryColor:'burgundy',pattern:'solid',added:Date.now(),updated:Date.now()};await tx('readwrite',s=>s.put(it));show('wardrobe')});
  ok(await C.p.evaluate(()=>!items.some(i=>i.id==='other-tab')),'an item written by another tab is not shown yet');
  await C.p.click('#refresh-btn');await C.p.waitForFunction(()=>!refreshing);
  ok(await C.p.evaluate(()=>items.some(i=>i.id==='other-tab'))&&(await C.p.textContent('#wardrobe')).includes('Tie'),'↻ without a worker reloads the wardrobe from the device');
  // a failed sync is reported, not hidden
  await B.p.evaluate(()=>localStorage.setItem('app_token','wrong'));await B.p.click('#refresh-btn');await B.p.waitForFunction(()=>!refreshing);
  ok(/failed.*forbidden/i.test(await B.p.textContent('#toast')),'a failed sync shows its error');
  ok(await B.p.evaluate(()=>{const r=document.querySelector('header').getBoundingClientRect();return r.width<=390&&document.documentElement.scrollWidth<=390}),'header still fits on a phone');
  ok([A,B,C].every(d=>d.errs.length===0),'no page errors');
  await browser.close();
};
