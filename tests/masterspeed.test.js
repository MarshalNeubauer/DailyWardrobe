// Faster masters on a phone (2026-11-14, the owner's ask): the computer shares each master's setup at the phone's size (PUT /blob,
// asm-color.js asmCmSetupBlob) and a 2048 copy of the master; a phone downloads the setup instead of working it out (asmCmSetupFetch) and
// the copy instead of the 2880 master (asmCmMasterCopy); warming sets masters up in the background (asmCmWarm, a setup-only job).
// The real worker.js with an in-memory KV holding the suit master's fixtures (tests/fixtures/cm/suit, 512 px).
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();let blobPuts=0,blobGets=0,renderGets=[];
  const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);return t==='json'?JSON.parse(v):t==='arrayBuffer'?(v instanceof ArrayBuffer?v:new TextEncoder().encode(v).buffer):v},
    getWithMetadata:async(k)=>({value:store.has(k)?{cancel:async()=>{}}:null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'owner-code',WARDROBE:KV},HOST='https://w.test/';
  const FIX=path.join(ROOT,'tests','fixtures','cm','suit');
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());if(u.pathname==='/blob'&&q.method()==='PUT')blobPuts++;if(u.pathname==='/blob'&&q.method()==='GET')blobGets++;if(u.pathname==='/render'&&q.method()==='GET'&&u.searchParams.get('key'))renderGets.push(u.searchParams.get('key'));
      const body=['GET','HEAD'].includes(q.method())?undefined:q.postDataBuffer();
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner-code')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{}});return {ctx,p,errs}};
  try{
    // the fixtures as the worker's records, with the masters' manifest
    const A=await device();
    const keys=await A.p.evaluate(()=>({assets:asmCmAssets('suit'),mf:asmCmMfKey(),copy:asmCmCopyKey('suit')}));
    const files=fs.readdirSync(FIX),put=(k,img,t,model='colormaster',sig='asm/cm test')=>store.set('render:'+k,JSON.stringify({sig,img,model,t}));
    for(const k of keys.assets){const n=await A.p.evaluate(([k])=>{const a=asmCmAssets('suit'),i=a.indexOf(k);return i===0?'master':null},[k]);}
    const nameOf=await A.p.evaluate(()=>{const o={};o[asmCmKey('suit','master')]='master.jpg';for(const z of ASM_CM_KINDS.suit.zones)o[asmCmKey('suit','mask/'+z)]='mask-'+z+'.png';for(const s of ['sleeveR','sleeveL','lapelR','lapelL'])o[asmCmKey('suit','part/'+s)]='part-'+s+'.png';return o});
    const mf={};for(const [k,f] of Object.entries(nameOf)){if(!files.includes(f))continue;put(k,`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),1000);mf[k]=1000}
    put(keys.mf,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',1000,'manifest','asm/cm-manifest '+JSON.stringify({keys:mf}));
    // the computer's side: the setup at this size and the master's copy, sent as the builder sends them
    const share=await A.p.evaluate(async()=>{await asmCmGet('suit');const b=await asmCmSetupBlob('suit',512),c=await asmCmMasterCopyRec('suit');
      const back=asmCmBlobRead(b.bytes.buffer.slice(0),b.dk),same=back&&back.n&&back.gz.byteLength>1000;return {key:b.key,dk:b.dk,b64:asmB64(b.bytes),copy:c,same}});
    const up=await worker.fetch(new Request(HOST+'blob?key='+share.key+'&sig='+encodeURIComponent(share.dk),{method:'PUT',headers:{'x-app-token':'owner-code'},body:Buffer.from(share.b64,'base64')}),env);
    const up2=await worker.fetch(new Request(HOST+'blob?key='+share.key+'&sig='+encodeURIComponent(share.dk),{method:'PUT',headers:{'x-app-token':'owner-code'},body:Buffer.from(share.b64,'base64')}),env);
    put(share.copy.key,share.copy.rec.img,share.copy.rec.t,'copy',share.copy.rec.sig);
    ok(share.same&&up.status===200&&(await up2.json()).kept==='same',`the computer packs a master's setup as bytes that read back, uploads it once (${Math.round(share.b64.length*3/4/1024)} KB), and the same setup again writes nothing`);
    const bad=await worker.fetch(new Request(HOST+'blob?key=nope',{headers:{'x-app-token':'owner-code'}}),env);
    ok(bad.status===400,'a blob key must be a picture-style key');
    // a phone: the copy instead of the master, the setup downloaded instead of worked out
    const B=await device();renderGets=[];blobGets=0;
    const r=await B.p.evaluate(async()=>{asmCmSrcSig();let prep=0;const p0=asmCmPrep;asmCmPrep=async(...a)=>{prep++;return p0(...a)};   // (fingerprinted first: a wrapped asmCmPrep is other source)
      const got=await asmCmGet('suit'),mk=asmCmKey('suit','master'),m=renders[mk],job=asmCmBaseJob('suit');
      const kept=!!(await asmCmDiskGet(asmCmDiskKey(job)));
      const hit=await asmCmSetup(job);asmCmPrep=p0;
      return {got,copy:m&&m.model==='copy',t:m&&m.t,kept,prep,zones:!!(hit&&hit.P&&hit.P.A)}});
    ok(r.got&&r.copy&&r.t===1000,`a phone takes the 2048 copy of the master, kept under the master's own key and date (${JSON.stringify({copy:r.copy,t:r.t})})`);
    ok(!renderGets.includes(keys.assets[0]),'and never downloads the 2880 master itself');
    ok(r.kept&&r.prep===0&&r.zones&&blobGets===1,`it downloads the shared setup and keeps it, and works nothing out (${r.prep} setups worked out, ${blobGets} download)`);
    // the disk key the phone uses is the one the setup is kept under
    const dk=await B.p.evaluate(async()=>{const job=asmCmBaseJob('suit');const db=await asmCmDb();const all=await new Promise(ok=>{const q=db.transaction('p').objectStore('p').getAllKeys();q.onsuccess=()=>ok(q.result)});db.close();return {mine:asmCmDiskKey(job),all}});
    ok(dk.all.includes(dk.mine),'the key it computes is the one asmCmSetup reads');
    const wk=await B.p.evaluate(async()=>{const job=asmCmBaseJob('suit');await asmRun({...job,setupOnly:true},false);const db=await asmCmDb();const all=await new Promise(ok=>{const q=db.transaction('p').objectStore('p').getAllKeys();q.onsuccess=()=>ok(q.result)});db.close();return {worker:asmOffPage(),all,mine:asmCmDiskKey(job)}});
    ok(wk.worker&&wk.all.length===1&&wk.all[0]===wk.mine,`the Web Worker that paints finds that same setup: it keeps no other (${wk.all.length} kept)`);
    // a stale copy (of an older master) is not taken
    store.set('render:'+keys.copy,JSON.stringify({...JSON.parse(store.get('render:'+keys.copy)),sig:'asm/cm-copy 999'}));
    const C=await device();renderGets=[];
    const c=await C.p.evaluate(async()=>{await asmCmGet('suit');const m=renders[asmCmKey('suit','master')];return {model:m&&m.model}});
    ok(c.model==='colormaster'&&renderGets.includes(keys.assets[0]),'a copy made from an older master is ignored: the master itself is downloaded');
    // warming: a phone without the setup on the server sets the master up in the background, once
    store.delete('blob:'+share.key);meta.delete('blob:'+share.key);
    const D=await device();
    const w=await D.p.evaluate(async()=>{const o={top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid'},suitDay:true,shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'},tie:{id:'t',type:'tie',primaryColor:'burgundy',pattern:'solid'}};
      const before=!!(await asmCmDiskGet(asmCmDiskKey(asmCmBaseJob('suit')||{cm:'x'}))),n1=await asmCmWarm([o]),job=asmCmBaseJob('suit'),after=!!(await asmCmDiskGet(asmCmDiskKey(job))),n2=await asmCmWarm([o]);return {before,n1,after,n2,kind:asmCmKind(o)}});
    ok(w.kind==='suit'&&w.n1===1&&w.after&&w.n2===0,`warming downloads the coming looks' master and sets it up in the background, once a session (${JSON.stringify(w)})`);
    ok(![A,B,C,D].some(d=>d.errs.length),'no page errors: '+[A,B,C,D].flatMap(d=>d.errs).join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // the colour-coded painter's setup (asm-color.js)
