// Background month photos: the app sends each outfit's inputs to the worker (POST /render {mode:'queue'}), the worker keeps them
// in KV and queues a message; the queue consumer makes the photo with the app closed; GET /render-queue reports progress and the
// app brings finished photos home. Temporary OpenAI failures retry; permanent ones are reported. Mocked queue, KV and OpenAI.
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let calls=0,reply=()=>[200,{data:[{b64_json:JPG}]}];
  globalThis.fetch=async href=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});calls++;const [st,b]=reply();
    return new Response(JSON.stringify(b),{status:st,headers:{'content-type':'application/json'}})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))})};
  let sent=[];const Q={send:async m=>{sent.push(m)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:Q},HOST='https://w.test/';
  const post=b=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify(b)}),env);
  const status=async()=>(await worker.fetch(new Request(HOST+'render-queue',{headers:{'x-app-token':'t'}}),env)).json();
  // run the consumer over the waiting messages, like Cloudflare does
  const drain=async()=>{const out=[];const msgs=sent.splice(0);for(const body of msgs){const m={body,attempts:body._a||1,acked:false,retried:null,ack(){this.acked=true},retry(o){this.retried=o}};
    await worker.queue({messages:[m]},env);if(m.retried){sent.push({...body,_a:(body._a||1)+1})}out.push(m)}return out};
  const browser=await chromium.launch();
  try{
    // ---- worker ----
    const K='c0123456789abcdef';
    let r=await post({mode:'queue',key:K,image:PNG,refs:[],outfit:'a navy suit',sig:'s1'});let j=await r.json();
    ok(r.status===200&&j.queued&&sent.length===1&&sent[0].key===K&&store.has('job:'+K)&&calls===0,'queueing stores the inputs as job:<key>, sends {key} and generates nothing yet');
    ok((await status()).pending.join()===K,'GET /render-queue lists it as pending');
    let ms=await drain();
    ok(calls===1&&ms[0].acked&&store.has('render:'+K)&&!store.has('job:'+K)&&JSON.parse(store.get('render:'+K)).sig==='s1','the consumer makes the photo, keeps it under the combination key and clears the job');
    r=await post({mode:'queue',key:K,image:PNG});j=await r.json();
    ok(j.exists&&!j.queued&&sent.length===0,'a look that already has a photo is not queued again');
    reply=()=>[500,{error:{message:'server busy'}}];
    await post({mode:'queue',key:'c1111111111111111',image:PNG});ms=await drain();
    ok(ms[0].retried&&ms[0].retried.delaySeconds===60&&store.has('job:c1111111111111111'),'an OpenAI server error retries after a minute, keeping the job');
    reply=()=>[200,{data:[{b64_json:JPG}]}];ms=await drain();
    ok(ms[0].acked&&store.has('render:c1111111111111111'),'and the retry succeeds');
    reply=()=>[400,{error:{message:'Your organization must be verified to use the model gpt-image-2.'}}];
    await post({mode:'queue',key:'c2222222222222222',image:PNG});ms=await drain();
    const st=await status();
    ok(ms[0].acked&&!store.has('job:c2222222222222222')&&st.failed.length===1&&/verify your organization/.test(st.failed[0].error)&&!st.pending.length,'a permanent failure is recorded with its reason and not retried');
    reply=()=>[200,{data:[{b64_json:JPG}]}];
    ok((await post({mode:'queue',key:'bad',image:PNG})).status===400&&(await post({mode:'queue',key:'c3333333333333333'})).status===400,'bad keys and missing illustrations are refused');
    ok((await worker.fetch(new Request(HOST+'render-queue'),env)).status===403,'the status needs the app token');
    const noQ=await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t'},body:JSON.stringify({mode:'queue',key:K,image:PNG})}),{...env,RENDER_QUEUE:undefined});
    ok(noQ.status===501&&(await noQ.json()).noQueue,'a worker without the queue binding says so (the app falls back)');
    const toml=fs.readFileSync(path.join(ROOT,'wrangler.toml'),'utf8'),wf=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy-worker.yml'),'utf8');
    ok(/\[\[queues\.producers\]\][\s\S]*?queue = "wardrobe-renders"[\s\S]*?binding = "RENDER_QUEUE"/.test(toml)&&/\[\[queues\.consumers\]\][\s\S]*?queue = "wardrobe-renders"[\s\S]*?max_batch_size = 1/.test(toml),'wrangler.toml binds the queue as producer and consumer (one photo per run)');
    ok(/queues info wardrobe-renders[^\n]*\|\|[^\n]*queues create wardrobe-renders/.test(wf)&&wf.indexOf('queues create')<wf.lastIndexOf('wrangler@4.158.0 deploy'),'the deploy workflow creates the queue if it is missing, before deploying');
    // ---- app: send, close, come back ----
    store.clear();sent=[];calls=0;
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));let dialog='';p.on('dialog',d=>{dialog=d.message();d.accept()});
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');localStorage.setItem('last_sync',Date.now()+864e5)},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    const setup=(clear)=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('suit','grey'),I('shirt','lightblue'),I('shirt','white'),
        I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};
      if(clear)for(const x of Object.keys(renders))delete renders[x];show('today');openSettings()};
    await p.evaluate(setup,true);
    const n=await p.evaluate(()=>batchCombos().length);
    await p.click('#batch-btn');await p.waitForFunction(()=>!batch,null,{timeout:30000});
    const s1=await p.evaluate(()=>({q:rqGet(),status:$('#batch-status').textContent,left:batchCombos().length}));
    ok(/close the app/.test(dialog),'the confirmation says the photos are made in the background');
    ok(calls===0&&sent.length===n&&s1.q.keys.length===n&&s1.left===0,`all ${n} looks are sent to the queue and nothing is generated while the app waits`);
    ok(/Sent \d+ photos to your worker.*close the app/.test(s1.status),`Settings says they are being made in the background (${s1.status})`);
    // the app is closed; the worker works through the queue
    await p.close();const done1=sent.slice(0,2);sent=sent.slice(2);for(const b of done1){const m={body:b,attempts:1,ack(){},retry(){}};await worker.queue({messages:[m]},env)}
    const p2=await ctx.newPage();p2.on('pageerror',e=>errs.push(e.message));await p2.goto(url);await p2.waitForFunction(()=>window.appReady);
    await p2.evaluate(setup,false);await p2.waitForFunction(()=>!rqBusy);await p2.evaluate(()=>checkQueue());
    const s2=await p2.evaluate(()=>({keys:rqGet().keys.length,have:Object.keys(renders).length,status:$('#batch-status').textContent}));
    ok(s2.have===2&&s2.keys===n-2&&new RegExp(`2 of ${n} done`).test(s2.status),`reopened later, the finished photos come home and progress shows (${s2.status})`);
    await drain();await p2.waitForFunction(()=>!rqBusy);await p2.evaluate(()=>checkQueue());
    const s3=await p2.evaluate(()=>({keys:rqGet().keys.length,stored:localStorage.getItem('render_queue'),all:Object.keys(planFor()).filter(k=>keyDate(k).getMonth()===10).every(k=>!planFor()[k].top||!!renders[comboKey(planFor()[k])]),status:$('#batch-status').textContent}));
    ok(s3.keys===0&&s3.stored===null&&s3.all&&new RegExp(`All ${n} photos ready`).test(s3.status),`when the queue is done every November outfit has its photo (${s3.status})`);
    ok(calls===n,`one paid photo per look (${calls})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
