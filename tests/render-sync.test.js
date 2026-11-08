// A photo generated on one device shows on the others: the worker keeps a copy per day in KV (GET /render?day=).
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
    settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')};
  const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    return {p,errs}};
  try{
    const A=await device();await A.p.evaluate(setup);
    await A.p.click('.render-btn');await A.p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(calls===1&&await A.p.evaluate(()=>!!document.querySelector('.fig.photo img')),'desktop generates the photo');
    ok(store.has('render:2026-11-16')&&puts.some(([k,o])=>k==='render:2026-11-16'&&o&&o.expirationTtl>0),'the worker keeps a copy for that day (expires after 90 days)');
    const B=await device();
    ok(await B.p.evaluate(()=>!renders['2026-11-16']),'the phone does not have it locally');
    await B.p.evaluate(setup);
    await B.p.waitForFunction(()=>!!document.querySelector('.fig.photo img'),null,{timeout:8000}).catch(()=>{});
    ok(await B.p.evaluate(()=>!!document.querySelector('.fig.photo img')),'opening that day on the phone shows the photo made on the desktop');
    ok(calls===1,'the phone did not generate (or pay for) another one');
    ok(await B.p.evaluate(async()=>!!(await metaGet('render:2026-11-16'))),'and keeps it on the phone afterwards');
    // a day without a photo stays a drawing; a stored photo for a different outfit is not shown
    ok(await B.p.evaluate(async()=>{sel=new Date(2026,10,17);renderToday();await new Promise(r=>setTimeout(r,300));return !document.querySelector('.fig.photo')}),'other days stay as drawings');
    store.set('render:2026-11-18',JSON.stringify({sig:'something-else',img:'data:image/jpeg;base64,'+JPG,model:'m',t:1}));
    ok(await B.p.evaluate(async()=>{sel=new Date(2026,10,18);renderToday();await new Promise(r=>setTimeout(r,500));return !document.querySelector('.fig.photo')}),'a stored photo of a different outfit is not shown');
    // a photo made before copies were kept (only on the desktop) is uploaded the next time that day is opened there
    store.delete('render:2026-11-16');
    await A.p.evaluate(()=>{renderTried.clear();sel=new Date(2026,10,17);renderToday();sel=new Date(2026,10,16);renderToday()});
    await new Promise(r=>setTimeout(r,800));
    ok(store.has('render:2026-11-16')&&JSON.parse(store.get('render:2026-11-16')).img.startsWith('data:image/jpeg'),'a photo only on the desktop is shared to the worker');
    const bad=await worker.fetch(new Request(HOST+'render',{method:'PUT',headers:{'x-app-token':'t'},body:JSON.stringify({day:'2026-11-20',rec:{img:'javascript:alert(1)'}})}),env);
    ok(bad.status===400,'the worker only accepts image data');
    const r=await worker.fetch(new Request(HOST+'render?day=2026-11-16'),env);
    ok(r.status===403,'GET /render needs the app token');
    ok(A.errs.length===0&&B.errs.length===0,'no page errors');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
