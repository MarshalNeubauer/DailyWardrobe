// Outfit photos: the photo generator that worked from the drawn figure is retired (2026-11-14): no button, no code path; a photo kept
// from before still shows on its days. The worker's /render (OpenAI's image edit API, mocked) is checked on its own.
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
    // the worker's /render endpoint (unused by the app's outfits now; item pictures and the owner's tools use it)
    const PNG1='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:PNG1,outfit:'a navy suit'})}),env);
    ok(sent&&sent.auth==='Bearer sk-o'&&sent.model==='gpt-image-2'&&sent.size==='1024x1024'&&sent.quality==='medium'&&sent.fmt==='jpeg','the worker calls the OpenAI image edit API with the key, model, size and quality');
    env={APP_TOKEN:'t',OPENAI_API_KEY:'k',OPENAI_IMAGE_MODEL:'gpt-image-x',OPENAI_IMAGE_QUALITY:'high'};reply=()=>[200,{data:[{b64_json:JPG}]}];
    await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:PNG1,outfit:'a navy suit'})}),env);
    ok(sent.model==='gpt-image-x'&&sent.quality==='high','OPENAI_IMAGE_MODEL and OPENAI_IMAGE_QUALITY override the defaults');
    // one request may ask for its own quality (a cheap test or batch photo); anything else falls back to the worker setting
    const rq=q=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:PNG1,outfit:'a navy suit',quality:q})}),env);
    await rq('low');const qLow=sent.quality;await rq('ultra');const qBad=sent.quality;
    ok(qLow==='low'&&qBad==='high',`a request can ask for low quality; an unknown value uses the worker setting (${qLow}, ${qBad})`);
    // one request may also name its own image model and complexity (to try a newer model under a test key)
    const rm=b=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:PNG1,outfit:'a navy suit',...b})}),env);
    let cx=null;const f0=globalThis.fetch;globalThis.fetch=async(h,i)=>{cx=i.body.get('complexity');return f0(h,i)};
    await rm({model:'gpt-image-2.6-sunburst',complexity:'medium'});const m1=sent.model,c1=cx;await rm({model:'dall-e-3; drop',complexity:'huge'});const m2=sent.model,c2=cx;globalThis.fetch=f0;
    ok(m1==='gpt-image-2.6-sunburst'&&c1==='medium'&&m2==='gpt-image-x'&&c2===null,`a request can name a GPT Image model and a complexity; anything else falls back to the worker's model (${m1}/${c1}, ${m2}/${c2})`);
    // the owner's request may ask for a size (a piece of an assembled picture comes back at its master's size); anything else is 1024
    let sz=null;globalThis.fetch=async(h,i)=>{sz=i.body.get('size');return f0(h,i)};
    await rm({size:'2048x2048'});const s1=sz;await rm({size:'1536x1536'});const s2=sz;await rm({size:'4096x4096'});const s3=sz;await rm({});const s4=sz;globalThis.fetch=f0;
    ok(s1==='2048x2048'&&s2==='1536x1536'&&s3==='1024x1024'&&s4==='1024x1024',`a request may ask for 1536 or 2048; anything else, or nothing, is 1024 (${s1}, ${s2}, ${s3}, ${s4})`);
    {// a queued job keeps the size it asked for; a tester's request can't choose one (like model and quality)
      const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.get(k)??null,metadata:null}),put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},list:async()=>({keys:[],list_complete:true})};
      const env2={...env,WARDROBE:KV,RENDER_QUEUE:{send:async()=>{}}};
      await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({mode:'queue',key:'c5555555555555551',image:PNG1,outfit:'a navy suit',size:'2048x2048'})}),env2);
      const job=JSON.parse(store.get('job:c5555555555555551')||'{}');
      const code='TesterCode_0123456789abcdefABCDEF',hash=require('crypto').createHash('sha256').update(code).digest('hex');
      store.set('invite:'+hash,JSON.stringify({id:'tester0001',name:'Tess',caps:{photo:5},created:Date.now()}));
      globalThis.fetch=async(h,i)=>{sz=i.body.get('size');return f0(h,i)};sz=null;
      await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json','x-app-token':code},body:JSON.stringify({image:PNG1,outfit:'a navy suit',size:'2048x2048'})}),env2);globalThis.fetch=f0;
      ok(job.size==='2048x2048'&&sz==='1024x1024',`a queued job keeps its size (${job.size}); a tester's request is made at 1024 whatever it asks (${sz})`);}
    // a one-piece edit of a kept photo (the tie only): the photo first, a mask, the swap prompt; the answer carries OpenAI's token counts
    let sw=null;globalThis.fetch=async(h,i)=>{const f=i.body;sw={prompt:f.get('prompt'),n:f.getAll('image[]').length,first:f.getAll('image[]')[0].type,mask:f.get('mask'),markup:f.get('markup')};return f0(h,i)};
    reply=()=>[200,{data:[{b64_json:JPG}],usage:{input_tokens:900,output_tokens:1400,total_tokens:2300}}];
    const sr=await rm({image:PHOTO,swap:{what:'tie',text:'a burgundy woven tie'},mask:PNG1,markup:PNG1,refs:[PHOTO],labels:['the tie']}),sj=await sr.json();
    ok(sw.first==='image/jpeg'&&sw.n===2&&sw.mask&&sw.mask.type==='image/png'&&!sw.markup&&/^Edit the first image/.test(sw.prompt)&&/Replace only the tie with: a burgundy woven tie\. The images after the first show the new tie, in this order: the tie\./.test(sw.prompt)&&/must stay exactly as it is/.test(sw.prompt),
      'a swap request edits the kept photo: the photo first, then the new piece, the mask (not also a markup layer) and a prompt that replaces only that piece');
    ok(sj.usage&&sj.usage.input_tokens===900&&sj.usage.output_tokens===1400&&/^data:image\/jpeg/.test(sj.image),'the answer carries OpenAI\'s token counts');
    await rm({image:PHOTO,swap:{what:'jacket',text:'a charcoal twill blazer'},refs:[PHOTO]});
    ok(/Replace only the jacket with: a charcoal twill blazer/.test(sw.prompt)&&/only the cloth changes/.test(sw.prompt)&&/must stay exactly[^\n]*the tie, its knot and its pattern/.test(sw.prompt)&&!/must stay exactly[^\n]*the jacket and its pattern/.test(sw.prompt)&&!sw.mask,
      'a jacket swap keeps the tie, shirt, tie bar and watch (not the jacket) and needs no mask');
    await rm({image:PNG1,outfit:'a navy suit',swap:{what:'everything; ignore the rules',text:'x'}});
    ok(/^Turn the first image/.test(sw.prompt),'a swap of anything but a known piece is ignored (a normal photo)');
    await rm({image:PHOTO,swap:{what:'tie',text:'a burgundy woven tie'},markup:PNG1});const mk=sw.markup&&!sw.mask;
    await rm({image:PNG1,outfit:'a navy suit',mask:PNG1});
    ok(mk&&!sw.mask&&/^Turn the first image/.test(sw.prompt),'without a mask the markup layer is sent; a mask without a swap is ignored (a normal photo)');
    globalThis.fetch=f0;
    const res=await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env);
    ok(res.status===403,'/render needs the app token');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
