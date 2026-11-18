// Outfit photos kept on the phone and the server: rendering, syncing them, fetching ahead.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url');

/* ---- was tests/render.test.js ---- */
// Outfit photos: the photo generator that worked from the drawn figure is retired (2026-11-14): no button, no code path; a photo kept
// from before still shows on its days. The worker's POST /render makes item pictures only (OpenAI's image edit API, mocked).
const render=async({ok,chromium,url,ROOT})=>{
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
    ok(shown.img&&/^(This look last worn \w{3}, \w{3} \d+)?$/.test(shown.by)&&!shown.btn&&!shown.mode,`a kept photo replaces the drawing; the only caption is the last-worn date, when there is one ("${shown.by}")`);
    // stored on the device: survives a reload
    await p.reload();await p.waitForFunction(()=>window.appReady);
    const kept=await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white',photo:ph}),I('shirt','lightblue',{photo:ph}),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('watch','black',{metal:'silver'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('suit','charcoal')];
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today');return !!document.querySelector('.fig.photo img')},PHOTO);
    ok(kept,'the photo is kept for that day after a reload');
    ok(await p.evaluate(ph=>{const o=planFor()[key(sel)];return renders[comboKey(o)]&&renders[comboKey(o)].img===ph},PHOTO),'the photo is kept byte for byte');
    {const fs=require('fs'),src=['app.js','photos.js','today-plan.js','today.js','today-photofold.js','today-picture.js','today-gestures.js'].map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');
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

/* ---- was tests/render-sync.test.js ---- */
// Kept outfit photos (made before the photo generator was retired, 2026-11-14) are saved per outfit combination: any day with the same pieces reuses the photo,
// and the worker keeps a copy (KV, render:c<16 hex>) so every device shows it. Photos saved per date before this
// change are moved over the first time their outfit is shown.
const renderSync=async({ok,chromium,url,ROOT})=>{
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
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:404,body:'{}'});   // backup sync isn't under test: 2.5 s after a save it pulled the empty backup over the test's in-memory wardrobe
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    return {p,errs}};
  const photoShown=p=>p.evaluate(()=>!!document.querySelector('.fig.photo img'));
  try{
    const A=await device();await A.p.evaluate(setup);
    const ck=await A.p.evaluate(()=>comboKey(planFor()[key(sel)]));
    ok(/^c[0-9a-f]{16}$/.test(ck),`each outfit combination has a key (${ck})`);
    // (the photo generator is retired, 2026-11-14: an outfit photo kept from before is shared as it was)
    await A.p.evaluate(async j=>{const o=planFor()[key(sel)];await keepRender(comboKey(o),{sig:comboSig(o),img:'data:image/jpeg;base64,'+j,model:'gpt-image-2',t:Date.now()},true);renderToday()},JPG);
    for(let w=0;w<30&&!store.has('render:'+ck);w++)await new Promise(r=>setTimeout(r,100));
    {const shown=await photoShown(A.p);ok(calls===0&&shown,`the desktop shows its kept photo (calls ${calls}, shown ${shown})`)}
    ok(store.has('render:'+ck)&&puts.some(([k,o])=>k==='render:'+ck&&!o),'the worker keeps it under the combination key (no expiry)');
    ok(await A.p.evaluate(async k=>!!(await metaGet('render:'+k)),ck),'and so does the device');
    // the same combination on another day: shown at once, nothing generated
    const other=await A.p.evaluate(()=>{const o=planFor()[key(sel)],d='2026-11-18';
      dayRecs[d]={date:d,force:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,...(o.clip?{clip:o.clip.id}:{}),...(o.watch?{watch:o.watch.id}:{})},vest:o.vest};cache={};
      sel=new Date(2026,10,18);renderToday();const o2=planFor()[key(sel)];return {same:comboKey(o2)===comboKey(o),btn:!!document.querySelector('.render-btn'),cap:(document.querySelector('.fig.photo .lastworn')||{}).textContent||''}});
    ok(other.same&&await photoShown(A.p)&&!other.btn&&calls===0,'another day with the same outfit reuses the photo (no new charge)');
    ok(/^(This look last worn |$)/.test(other.cap)&&!/gpt|Generated/.test(other.cap),`the caption shows when the look was last worn, not the model ("${other.cap}")`);
    // a different combination has no photo; changing how a piece looks (colour) makes it a different combination
    ok(await A.p.evaluate(()=>{sel=new Date(2026,10,17);renderToday();return !document.querySelector('.fig.photo')}),'a different outfit is drawn, not given the photo');
    ok(await A.p.evaluate(()=>{const o=planFor()['2026-11-16'],a=comboKey(o),b=comboKey({...o,tie:{...o.tie,primaryColor:'green'}}),c=comboKey({...o,tie:{...o.tie,updated:99}}),d=comboKey({...o,vest:!o.vest});return a!==b&&a===c&&a!==d}),
      'the key changes with colour or vest, not with an unrelated edit');
    // the shirt counts only by colour: any white shirt shares the photo; jackets/ties by look, not by which item
    const share=await A.p.evaluate(()=>{const o=planFor()['2026-11-16'],sh=o.shirt;
      const tex={...o,shirt:{...sh,id:'other-shirt',pattern:'dobby',cuff:'french',stripes:{b:[['p',1]]}}},col={...o,shirt:{...sh,primaryColor:'white'}},
        twin={...o,top:{...o.top,id:'twin-suit'}},pin={...o,top:{...o.top,pattern:'pinstripe'}};
      return {tex:comboKey(tex)===comboKey(o),col:comboKey(col)!==comboKey(o),twin:comboKey(twin)===comboKey(o),pin:comboKey(pin)!==comboKey(o)}});
    ok(share.tex,'another shirt of the same colour (different texture, cuffs, item) shares the photo');
    ok(share.col,'a shirt of a different colour does not');
    ok(share.twin&&share.pin,'an identical suit shares the photo; a different pattern does not');
    // (the moves of photos kept under older builds' keys are gone with the retired outfit photos: CR-1-12)
    // the phone gets it from the worker for any day with that combination
    const B=await device();await B.p.evaluate(setup);
    await B.p.waitForFunction(()=>!!document.querySelector('.fig.photo img'),null,{timeout:8000}).catch(()=>{});
    ok(await photoShown(B.p)&&calls===0,'the phone shows the desktop\'s photo without generating another');
    const bad=await worker.fetch(new Request(HOST+'render',{method:'PUT',headers:{'x-app-token':'t'},body:JSON.stringify({key:'c0123456789abcdef',rec:{img:'javascript:alert(1)'}})}),env);
    ok(bad.status===400,'the worker only accepts image data');
    ok((await worker.fetch(new Request(HOST+'render?key=nope',{headers:{'x-app-token':'t'}}),env)).status===400,'the worker rejects malformed keys');
    ok((await worker.fetch(new Request(HOST+'render?key='+ck),env)).status===403,'GET /render needs the app token');
    ok(A.errs.length===0&&B.errs.length===0,'no page errors');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

/* ---- was tests/prefetch.test.js ---- */
// A new install (or a device that didn't make the photos) downloads the plan's photos from the worker in the background,
// nearest the selected day first, after one request that lists what the worker has: swiping to another day then shows
// its photo at once, nothing is downloaded twice, and combinations the worker doesn't have are not asked for.
const prefetch=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const env={APP_TOKEN:'t',WARDROBE:KV},HOST='https://w.test/';
  // the worker: the list needs the token and only names photo keys
  store.set('render:c00000000000000aa',JSON.stringify({img:JPG,t:1}));store.set('job:c00000000000000bb','{}');
  const lst=await worker.fetch(new Request(HOST+'render?list=1',{headers:{'x-app-token':'t'}}),env),lj=await lst.json();
  const no=await worker.fetch(new Request(HOST+'render?list=1'),env);
  ok(lst.status===200&&lj.keys.join()==='c00000000000000aa'&&no.status===403,`GET /render?list=1 lists the kept photos, with the app token only (${JSON.stringify(lj)})`);
  store.clear();
  const browser=await chromium.launch();
  const setup=()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',updated:1,...x});
    items=[I('suit','navy'),I('suit','charcoal'),I('suit','brown'),I('suit','lightgrey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
    settings.workdays=[1,2,3,4,5];settings.blazerDays=[];settings.vestMode='auto';dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')};
  const reqs=[];
  const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'{}'});   // no /sync: the start-up sync merges away the items set in memory
      reqs.push(q.method()+' '+q.url().slice(HOST.length));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    // the worker is set before the page loads: set on a first page and then reloaded, that first page's delayed start-up work (the
    // assembled pictures' look at the worker) could still ask for a photo before the reload, which read as a download made twice
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');localStorage.setItem('last_sync',String(Date.now()))},HOST);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    return {p,errs,ctx}};
  try{
    // the plan's combinations for November, worked out once; the worker has photos for all but two of them
    const A=await device();await A.p.evaluate(setup);
    const plan=await A.p.evaluate(()=>{const out={};for(const [k,o] of Object.entries(planFor()))if(o.top&&keyDate(k).getMonth()===10)out[k]=comboKey(o);return out});
    const keys=[...new Set(Object.values(plan))],missing=keys.slice(-2);
    for(const k of keys)if(!missing.includes(k))store.set('render:'+k,JSON.stringify({sig:'x',img:JPG,model:'m',t:5}));
    await A.ctx.close();
    // a fresh install: nothing stored on the device
    reqs.length=0;const B=await device();await B.p.evaluate(setup);
    const want=keys.filter(k=>!missing.includes(k));
    await B.p.waitForFunction(w=>w.every(k=>renders[k]),want,{timeout:20000}).catch(()=>{});
    const have=await B.p.evaluate(w=>w.filter(k=>renders[k]).length,want);
    ok(have===want.length,`a new install downloads the month's photos in the background without visiting each day (${have} of ${want.length})`);
    const gets=reqs.filter(r=>/^GET render\?key=/.test(r)).map(r=>r.split('key=')[1]);
    ok(reqs.filter(r=>r==='GET render?list=1').length===1,'one request lists what the worker has');
    ok(gets.length===new Set(gets).size,`nothing is downloaded twice (${gets.length} downloads, ${new Set(gets).size} photos)`);
    ok(!gets.some(k=>missing.includes(k)),'combinations the worker has no photo for are not asked for');
    // nearest the selected day first: the first downloads are for days close to Nov 16
    const dayOf=k=>Object.entries(plan).filter(([,v])=>v===k).map(([d])=>Math.abs(+new Date(d.replace(/-(\d)\b/g,'-0$1'))-+new Date('2026-11-16')))
      .reduce((a,b)=>Math.min(a,b),1e15)/864e5;
    const firstDays=gets.filter(k=>keys.includes(k)).slice(0,3).map(dayOf);   // outfit photos (product pictures of shoes etc. use the same endpoint)
    ok(firstDays.every(d=>d<=4),`downloads start with the days nearest the one on screen (${firstDays.join(', ')} days away)`);
    // swiping to another day shows its photo straight away
    const day=Object.keys(plan).find(d=>d!=='2026-11-16'&&!missing.includes(plan[d])&&new Date(d.replace(/-(\d)\b/g,'-0$1'))>new Date('2026-11-20'));
    const shown=await B.p.evaluate(d=>{const [y,m,dd]=d.split('-').map(Number);sel=new Date(y,m-1,dd);renderToday();return !!document.querySelector('.fig.photo img')},day);
    ok(shown,`swiping to ${day} shows the photo immediately`);
    // a day already here and on the worker is not downloaded again when shown
    const before=reqs.length;await B.p.evaluate(()=>{sel=new Date(2026,10,17);renderToday()});await B.p.waitForTimeout(600);
    ok(!reqs.slice(before).some(r=>keys.some(k=>r==='GET render?key='+k)),'showing a day whose photo is already here does not download it again');
    ok(B.errs.length===0,'no page errors ('+B.errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['render',render],['render-sync',renderSync],['prefetch',prefetch]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
