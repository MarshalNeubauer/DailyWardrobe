// "Generate realistic photo": the figure is rasterised and sent with item photos to the worker's /render, which calls
// OpenAI's image edit API (mocked); the photo is stored per day on the device and dropped when the outfit changes.
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
    ok(await p.isVisible('text=Generate realistic photo'),'Today has a Generate realistic photo button');
    await p.click('text=Generate realistic photo');await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(sent&&sent.auth==='Bearer sk-o'&&sent.model==='gpt-image-2'&&sent.size==='1024x1024'&&sent.quality==='medium'&&sent.fmt==='jpeg','the worker calls the OpenAI image edit API with the key, model, size and quality');
    const exp=await p.evaluate(()=>{const o=planFor()[key(sel)];return {shirtHasPhoto:!!o.shirt.photo,n:1+['top','tie'].filter(s=>o[s]&&o[s].photo).length,top:prettyCols(nm(o.top)),shirt:prettyCols(nm(o.shirt)),tie:prettyCols(nm(o.tie))}});
    ok(exp.shirtHasPhoto&&sent.images.length===exp.n&&sent.images[0].type==='image/png'&&sent.images[0].size>5000&&sent.images.slice(1).every(b=>b.type==='image/jpeg'),`the rasterised illustration is the first image, followed by the suit/tie photos, not the shirt's (${sent.images.length})`);
    ok([exp.top,exp.tie].every(t=>sent.prompt.includes(t))&&/a plain light blue dress shirt/.test(sent.prompt)&&/same pose/i.test(sent.prompt),'the prompt describes the outfit (the shirt by its colour only) and asks to keep the pose');
    const shown=await p.evaluate(()=>({img:!!document.querySelector('.fig.photo img'),by:document.querySelector('.fig.photo small').textContent,btn:!!document.querySelector('.render-btn'),mode:!!document.querySelector('.figmode')}));
    ok(shown.img&&/^(Not worn yet|Last worn \w{3}, \w{3} \d+)$/.test(shown.by)&&!shown.btn&&!shown.mode,`the photo replaces the illustration (no picture switch, no button under it); the caption is the last-worn date ("${shown.by}")`);
    // regenerating lives in Settings
    const rg=await p.evaluate(()=>{openSettings();const b=document.querySelector('#regen-btn');return {t:b.textContent,d:b.disabled}});
    ok(/^Regenerate photo for \w{3}, \w{3} \d+$/.test(rg.t)&&!rg.d,`Settings offers to regenerate the shown day's photo ("${rg.t}")`);
    const n0=gens;await p.click('#regen-btn');await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(gens===n0+1&&await p.evaluate(()=>!!document.querySelector('.fig.photo img')&&!settingsOpen()),'tapping it makes a new photo and shows Today');
    // stored on the device: survives a reload
    await p.reload();await p.waitForFunction(()=>window.appReady);
    const kept=await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white',photo:ph}),I('shirt','lightblue',{photo:ph}),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('watch','black',{metal:'silver'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('suit','charcoal')];
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today');return !!document.querySelector('.fig.photo img')},PHOTO);
    ok(kept,'the photo is kept for that day after a reload');
    ok(await p.evaluate(async()=>!(await localState()).renders&&!JSON.stringify(await localState()).includes('render:')),'photos stay on the device (not in backup/sync data)');
    // changing the outfit drops the photo
    ok(await p.evaluate(()=>{const o=planFor()[key(sel)],before=!!renderFor(o),sw={...o,tie:{...o.tie,id:'other',primaryColor:'green'}};return before&&!renderFor(sw)}),'after a swap the stored photo no longer matches, so it is not shown');
    // errors
    reply=()=>[403,{error:{message:'Your organization must be verified to use the model gpt-image-1.'}}];
    await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(/verify your organization/i.test(await p.textContent('#render-msg')),'an unverified OpenAI org is explained');
    env={APP_TOKEN:'t'};await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(/OPENAI_API_KEY/.test(await p.textContent('#render-msg')),'no OpenAI key on the worker: says what to add');
    env={APP_TOKEN:'t',OPENAI_API_KEY:'k',OPENAI_IMAGE_MODEL:'gpt-image-x',OPENAI_IMAGE_QUALITY:'high'};reply=()=>[200,{data:[{b64_json:JPG}]}];
    await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(sent.model==='gpt-image-x'&&sent.quality==='high','OPENAI_IMAGE_MODEL and OPENAI_IMAGE_QUALITY override the defaults');
    const res=await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env);
    ok(res.status===403,'/render needs the app token');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
