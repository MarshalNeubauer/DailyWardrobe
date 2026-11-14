// Outfit photos: the photo generator that worked from the drawn figure is retired (2026-11-14): no button, no code path; a photo kept
// from before still shows on its days. The worker's POST /render makes item pictures only (OpenAI's image edit API, mocked).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;let sent=null,gens=0,reply=()=>[200,{data:[{b64_json:JPG}],usage:{total_tokens:1}}];
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});
    gens++;const f=init.body;sent={auth:init.headers.authorization,model:f.get('model'),prompt:f.get('prompt'),images:f.getAll('image[]'),size:f.get('size'),quality:f.get('quality'),fmt:f.get('output_format')};
    const [st,b]=reply();return new Response(JSON.stringify(b),{status:st,headers:{'content-type':'application/json'}})};
  let env={APP_TOKEN:'t',OPENAI_API_KEY:'sk-o'};const HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    const PHOTO='data:image/jpeg;base64,'+JPG;
    await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white',photo:ph}),I('shirt','lightblue',{photo:ph}),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('watch','black',{metal:'silver'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('suit','charcoal')];
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')},PHOTO);
    // (2026-11-14, the owner) the outfit photo made from the drawn figure is retired: no button anywhere, nothing sent from the app
    ok(!(await p.$('.render-btn'))&&!(await p.$('#render-msg'))&&await p.evaluate(()=>{openSettings('photos');const r=!document.querySelector('#regen-btn')&&!/This day.s photo/.test(document.querySelector('#settings-modal').textContent);closeSettings();return r}),
      'no Generate button on Today and no "This day\'s photo" in Settings');
    ok(await p.evaluate(()=>['generateRender','renderCombo','queueCombo','figurePng','checkQueue','renderRegenUI'].every(f=>typeof window[f]==='undefined')&&typeof FIG_CROP==='undefined'),'the photo generator\'s code paths are gone from the app');
    ok(gens===0,'nothing was asked of the image generator');
    // a photo kept from before still shows on its days
    await p.evaluate(async ph=>{const o=planFor()[key(sel)];await keepRender(comboKey(o),{sig:comboSig(o),img:ph,model:'gpt-image-2',t:Date.now()},false);renderToday()},PHOTO);
    const shown=await p.evaluate(()=>({img:!!document.querySelector('.fig.photo img'),by:(document.querySelector('.fig.photo .lastworn')||{}).textContent||'',btn:!!document.querySelector('.render-btn'),mode:!!document.querySelector('.figmode')}));
    ok(shown.img&&/^(Last worn \w{3}, \w{3} \d+)?$/.test(shown.by)&&!shown.btn&&!shown.mode,`a kept photo replaces the drawing; the only caption is the last-worn date, when there is one ("${shown.by}")`);
    // stored on the device: survives a reload
    await p.reload();await p.waitForFunction(()=>window.appReady);
    const kept=await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white',photo:ph}),I('shirt','lightblue',{photo:ph}),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('watch','black',{metal:'silver'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('suit','charcoal')];
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today');return !!document.querySelector('.fig.photo img')},PHOTO);
    ok(kept,'the photo is kept for that day after a reload');
    ok(await p.evaluate(ph=>{const o=planFor()[key(sel)];return renders[comboKey(o)]&&renders[comboKey(o)].img===ph},PHOTO),'the photo is kept byte for byte');
    {const fs=require('fs'),src=['app.js','photos.js','today.js'].map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');
      ok(!/shrinkUrl\([^)]*,\s*900\)/.test(src),'no outfit photo is shrunk to 900px any more (app.js, photos.js, today.js; assembled pictures keep theirs, in assemble.js)');}
    ok(await p.evaluate(async()=>!(await localState()).renders&&!JSON.stringify(await localState()).includes('render:')),'photos stay on the device (not in backup/sync data)');
    ok(await p.evaluate(()=>{const o=planFor()[key(sel)],before=!!renderFor(o),sw={...o,tie:{...o.tie,id:'other',primaryColor:'green'}};return before&&!renderFor(sw)}),'after a swap the stored photo no longer matches, so it is not shown');
    // the worker's POST /render: item pictures only (the outfit photo was removed from it, 2026-11-14)
    const PNG1='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const post=(b,tok='t')=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json',...(tok?{'x-app-token':tok}:{})},body:JSON.stringify(b)}),env);
    sent=null;const g0=gens;
    const outfit=await post({image:PNG1,outfit:'a navy suit'}),queued=await post({mode:'queue',key:'c5555555555555551',image:PNG1});
    ok(outfit.status===410&&queued.status===410&&gens===g0&&/no longer made/.test((await outfit.json()).message),'an outfit photo, direct or queued, answers 410 and nothing is asked of OpenAI');
    const ir=await post({mode:'item',item:'a black leather belt',key:'c5555555555555552',ref:PHOTO}),ij=await ir.json();
    ok(ir.status===200&&/^data:image\/jpeg/.test(ij.image)&&sent&&sent.auth==='Bearer sk-o'&&sent.model==='gpt-image-2'&&sent.size==='1024x1024'&&sent.quality==='high'&&sent.fmt==='jpeg'&&sent.images.length===1,'an item picture from its photo calls the OpenAI image edit API with the key, model, size and quality');
    env={APP_TOKEN:'t',OPENAI_API_KEY:'k',OPENAI_IMAGE_MODEL:'gpt-image-x',OPENAI_IMAGE_QUALITY:'medium'};reply=()=>[200,{data:[{b64_json:JPG}]}];
    await post({mode:'item',item:'a black leather belt',key:'c5555555555555552',ref:PHOTO});
    ok(sent.model==='gpt-image-x'&&sent.quality==='medium','OPENAI_IMAGE_MODEL and OPENAI_IMAGE_QUALITY override the defaults');
    ok((await post({mode:'item',item:'x'},'')).status===403,'/render needs the app token');
    ok((await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({mode:'item',item:'x'})}),{APP_TOKEN:'t'})).status===501,'without OPENAI_API_KEY an item picture says the secret is missing');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
