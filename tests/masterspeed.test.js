// Faster masters on a phone (2026-11-14, the owner's ask): a master's setup is worked out once and kept on the device, packed
// (asm-color.js asmCmPack, under asmCmDiskKey), read back instead of worked out again, and found by the Web Worker that paints; warming
// sets masters up in the background (asmCmWarm, a setup-only job). (CR-8-06, 2026-11-17) The PC builder's shared setups (GET /blob) and
// 2048 copies of the masters (render master2048), which nothing has uploaded since 2026-11-16, are no longer asked for.
// The real worker.js with an in-memory KV holding the suit master's fixtures (tests/fixtures/cm/suit, 512 px).
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();let blobGets=0,renderGets=[];
  const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);return t==='json'?JSON.parse(v):t==='arrayBuffer'?(v instanceof ArrayBuffer?v:new TextEncoder().encode(v).buffer):v},
    getWithMetadata:async(k)=>({value:store.has(k)?{cancel:async()=>{}}:null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'owner-code',WARDROBE:KV},HOST='https://w.test/';
  const FIX=path.join(ROOT,'tests','fixtures','cm','suit');
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());if(u.pathname==='/blob'&&q.method()==='GET')blobGets++;if(u.pathname==='/render'&&q.method()==='GET'&&u.searchParams.get('key'))renderGets.push(u.searchParams.get('key'));
      const body=['GET','HEAD'].includes(q.method())?undefined:q.postDataBuffer();
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner-code')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{}});return {ctx,p,errs}};
  try{
    // the fixtures as the worker's records, with the masters' manifest; a stale 2048 copy and a shared setup left on the worker, as the
    // PC builder left them: a phone must ask for neither
    const A=await device();
    const keys=await A.p.evaluate(()=>({assets:asmCmAssets('suit'),mf:asmCmMfKey(),copy:asmCmKey('suit','master2048')}));
    const files=fs.readdirSync(FIX),put=(k,img,t,model='colormaster',sig='asm/cm test')=>store.set('render:'+k,JSON.stringify({sig,img,model,t}));
    const nameOf=await A.p.evaluate(()=>{const o={};o[asmCmKey('suit','master')]='master.jpg';for(const z of ASM_CM_KINDS.suit.zones)o[asmCmKey('suit','mask/'+z)]='mask-'+z+'.png';for(const s of ['sleeveR','sleeveL','lapelR','lapelL'])o[asmCmKey('suit','part/'+s)]='part-'+s+'.png';return o});
    const mf={};for(const [k,f] of Object.entries(nameOf)){if(!files.includes(f))continue;put(k,`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),1000);mf[k]=1000}
    put(keys.mf,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',1000,'manifest','asm/cm-manifest '+JSON.stringify({keys:mf}));
    put(keys.copy,store.get('render:'+keys.assets[0])&&JSON.parse(store.get('render:'+keys.assets[0])).img,1000,'copy','asm/cm-copy 1000');
    // a phone: the master downloaded, its setup worked out once and kept; read back afterwards instead of worked out again
    renderGets=[];blobGets=0;
    const r=await A.p.evaluate(async()=>{asmCmSrcSig();let prep=0;const p0=asmCmPrep;asmCmPrep=async(...a)=>{prep++;return p0(...a)};   // (fingerprinted first: a wrapped asmCmPrep is other source)
      const got=await asmCmGet('suit'),m=renders[asmCmKey('suit','master')],job=asmCmBaseJob('suit');
      await asmCmSetup(job);for(let i=0;i<100&&!(await asmCmDiskGet(asmCmDiskKey(job)));i++)await new Promise(ok=>setTimeout(ok,50));   // (saved while the picture is painted)
      const kept=!!(await asmCmDiskGet(asmCmDiskKey(job)));const prep1=prep;
      asmCmMem=null;const hit=await asmCmSetup(job);asmCmPrep=p0;
      return {got,model:m&&m.model,kept,prep1,prep2:prep-prep1,zones:!!(hit&&hit.P&&hit.P.A)}});
    ok(r.got&&r.model==='colormaster'&&renderGets.includes(keys.assets[0]),`a phone downloads the master itself (${r.model})`);
    ok(!renderGets.includes(keys.copy)&&blobGets===0,`and never asks for the PC builder's 2048 copy or shared setup (${renderGets.filter(k=>k===keys.copy).length} copy, ${blobGets} setup requests)`);
    ok(r.prep1===1&&r.kept&&r.prep2===0&&r.zones,`it works the setup out once, keeps it, and reads it back instead of working it out again (${JSON.stringify(r)})`);
    // the disk key the phone uses is the one the setup is kept under, and the Web Worker that paints finds that same setup
    const dk=await A.p.evaluate(async()=>{const job=asmCmBaseJob('suit');const db=await asmCmDb();const all=await new Promise(ok=>{const q=db.transaction('p').objectStore('p').getAllKeys();q.onsuccess=()=>ok(q.result)});db.close();return {mine:asmCmDiskKey(job),all}});
    ok(dk.all.includes(dk.mine),'the key it computes is the one asmCmSetup reads');
    const wk=await A.p.evaluate(async()=>{const job=asmCmBaseJob('suit');await asmRun({...job,setupOnly:true},false);const db=await asmCmDb();const all=await new Promise(ok=>{const q=db.transaction('p').objectStore('p').getAllKeys();q.onsuccess=()=>ok(q.result)});db.close();return {worker:asmOffPage(),all,mine:asmCmDiskKey(job)}});
    ok(wk.worker&&wk.all.length===1&&wk.all[0]===wk.mine,`the Web Worker that paints finds that same setup: it keeps no other (${wk.all.length} kept)`);
    // warming: a phone without the setup sets the master up in the background, once
    const D=await device();
    const w=await D.p.evaluate(async()=>{const o={top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid'},suitDay:true,shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'},tie:{id:'t',type:'tie',primaryColor:'burgundy',pattern:'solid'}};
      const before=!!(await asmCmDiskGet(asmCmDiskKey(asmCmBaseJob('suit')||{cm:'x'}))),n1=await asmCmWarm([o]),job=asmCmBaseJob('suit'),after=!!(await asmCmDiskGet(asmCmDiskKey(job))),n2=await asmCmWarm([o]);return {before,n1,after,n2,kind:asmCmKind(o)}});
    ok(w.kind==='suit'&&w.n1===1&&w.after&&w.n2===0,`warming downloads the coming looks' master and sets it up in the background, once a session (${JSON.stringify(w)})`);
    ok(![A,D].some(d=>d.errs.length),'no page errors: '+[A,D].flatMap(d=>d.errs).join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // the colour-coded painter's setup (asm-color.js)
