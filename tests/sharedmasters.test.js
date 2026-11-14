// The owner's colour-coded masters shared with testers (worker/records.js cm:shared, 2026-11-14): tools/asm-cm-upload.js writes the list of
// master records (owner-only PUT /cm-shared, once, nothing when unchanged); a tester's GET /render?key= of a listed key falls back to the
// owner's record and their GET /render?list=1 names them; nothing else of the owner's is ever readable. Then, end to end, a page connected
// with a tester's code against the real worker (mocked KV and Durable Objects) holding the owner's masters paints a colour-coded look.
// Fixtures: the suit master and its masks at 512 (tests/fixtures/cm/suit/).
const path=require('path'),fs=require('fs'),os=require('os'),http=require('http'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,realNow=Date.now;
  const JPG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  // a mocked worker: KV (every put noted), one RenderHub per name
  const mkEnv=()=>{const store=new Map(),meta=new Map(),puts=[];
    const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);return t==='json'?JSON.parse(v):t==='arrayBuffer'?(v instanceof ArrayBuffer?v:new TextEncoder().encode(v).buffer):v},
      put:async(k,v,o)=>{puts.push(k);store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name})),list_complete:true})};
    const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>{st.clear()}}},{}))}return hubs.get(name)};
    const HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>hubOf(name).fetch(new Request(u,init))})};
    return {env:{APP_TOKEN:'owner-secret',WARDROBE:KV,RENDER_HUB:HUB},store,puts,HUB}};
  const O='owner-secret',HOST='https://w.test/';
  const call=(env,method,p,tok,body,h={})=>worker.fetch(new Request(HOST+p,{method,headers:{...(tok?{'x-app-token':tok}:{}),'content-type':'application/json',...h},body:body===undefined?undefined:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  // ---- the worker
  {const {env,store,puts,HUB}=mkEnv(),c=(...a)=>call(env,...a);
    const M1='c1000000000000001',M2='c1000000000000002',P='c2000000000000001',I='c2000000000000002',rec=(key,sig)=>({key,rec:{img:JPG,sig,model:'m',t:5}});
    const A=await J(await c('POST','invites',O,{name:'Tess'})),B=await J(await c('POST','invites',O,{name:'Bo'})),An=`u:${A.id}:`;
    for(const k of [M1,M2,P,I])await c('PUT','render',O,rec(k,'owner '+k));
    ok((await c('GET','render?key='+M1,A.code)).status===404,'before the shared list, a tester gets 404 for the owner\'s master record');
    let r=await J(await c('PUT','cm-shared',O,{keys:[M2,M1,M1]}));const n1=puts.filter(k=>k==='cm:shared').length;
    const r2=await J(await c('PUT','cm-shared',O,{keys:[M1,M2]})),n2=puts.filter(k=>k==='cm:shared').length;
    ok(r.s===200&&r.n===2&&n1===1&&r2.kept==='same'&&n2===1&&JSON.parse(store.get('cm:shared')).keys.join()===[M1,M2].join(),`PUT /cm-shared (owner) writes cm:shared once, sorted and without repeats; the same list again writes nothing (${n2} writes)`);
    ok((await J(await c('GET','cm-shared',O))).keys.join()===[M1,M2].join(),'GET /cm-shared gives the owner the list');
    // a tester reads the listed keys, and nothing else of the owner's
    const g=async(k,tok)=>J(await c('GET','render?key='+k,tok));
    const a1=await g(M1,A.code),a2=await g(M2,B.code);
    ok(a1.s===200&&a1.sig==='owner '+M1&&a2.s===200&&a2.sig==='owner '+M2,'a tester reads a shared master record from the owner\'s records (both testers)');
    ok((await g(P,A.code)).s===404&&(await g(I,A.code)).s===404&&(await g(P,B.code)).s===404,'a tester cannot read the owner\'s other records (an outfit picture, an item photo): 404');
    // backups and snapshots stay the owner's
    await c('PUT','sync',O,{baseRev:0,data:{who:'owner'},day:'2026-03-01'});await c('PUT','sync',O,{baseRev:1,data:{who:'owner',v:2},day:'2026-03-02'});
    const sy=await J(await c('GET','sync',A.code)),sn=await J(await c('GET','sync?snaps=1',A.code)),s1=await c('GET','sync?snap=2026-03-01',A.code),s1b=await s1.text();
    ok(!(sy.data&&sy.data.who)&&!JSON.stringify(sy).includes('owner')&&(sn.snaps||[]).length===0&&!s1b.includes('owner'),`a tester cannot read the owner's backup (/sync), daily copies (?snaps=1) or a copy (?snap=): ${JSON.stringify(sy).slice(0,60)} / ${(sn.snaps||[]).length} copies / ${s1.status}`);
    // a tester can't write the list, and their writes land in their own records
    ok((await c('PUT','cm-shared',A.code,{keys:[P]})).status===403&&(await c('GET','cm-shared',A.code)).status===403&&JSON.parse(store.get('cm:shared')).keys.join()===[M1,M2].join(),'a tester cannot write (or read) the shared list: 403, and it is unchanged');
    ok((await c('PUT','render',A.code,{key:'cm:shared',rec:{img:JPG,sig:'x',t:9}})).status===400&&(await c('PUT','render',A.code,{day:'cm:shared',rec:{img:JPG,sig:'x',t:9}})).status===400,'and cannot reach it through PUT /render (not a photo key)');
    await c('PUT','render',A.code,rec(M1,'tess'));
    ok(JSON.parse(store.get('render:'+M1)).sig==='owner '+M1&&JSON.parse(store.get(An+'render:'+M1)).sig==='tess'&&(await g(M1,A.code)).sig==='tess'&&(await g(M1,B.code)).sig==='owner '+M1&&(await g(M1,O)).sig==='owner '+M1,
      'a tester\'s PUT of a master key lands in their own records: the owner\'s is untouched, the tester reads their own copy, everyone else the owner\'s');
    await c('DELETE','render?key='+M1,A.code);
    ok(store.has('render:'+M1)&&!store.has(An+'render:'+M1)&&(await g(M1,A.code)).sig==='owner '+M1,'a tester\'s DELETE removes only their own copy; the owner\'s master stays');
    // the list
    const day=new Date(realNow()).toISOString().slice(0,10),listUsed=async ns=>(await (await HUB.get('renders:'+ns).fetch('https://hub/used?day='+day)).json()).used.list||0;
    const l0=await listUsed(An);
    await c('PUT','render',A.code,rec('c3000000000000001','tess own'));
    const la=await J(await c('GET','render?list=1',A.code)),lo=await J(await c('GET','render?list=1',O));
    for(let i=0;i<5;i++)await g(M2,A.code);
    const l1=await listUsed(An);
    ok(la.keys.includes(M1)&&la.keys.includes(M2)&&la.keys.includes('c3000000000000001')&&!la.keys.includes(P)&&!la.keys.includes(I)&&new Set(la.keys).size===la.keys.length,`a tester's list names their own photos and the shared master records, not the owner's other photos (${la.keys.length} keys)`);
    ok(lo.keys.join()===[M1,M2,P,I].sort().join(),'the owner\'s list is as before');
    ok(l1-l0===1,`a tester's list call counts once against their list cap; the shared reads count nothing (${l1-l0})`);
    // the setups packed for phones (PUT /blob, owner only): a tester reads the owner's
    const S='c4000000000000001',bytes=new Uint8Array([68,87,83,49,0,0,0,2,123,125]);
    await c('PUT','blob?key='+S+'&sig=dk1',O,bytes,{'content-type':'application/octet-stream'});
    const bt=await c('GET','blob?key='+S,A.code),bb=new Uint8Array(await bt.arrayBuffer());
    ok(bt.status===200&&bb.length===bytes.length&&bb.every((x,i)=>x===bytes[i]),'a tester reads a master\'s packed setup (GET /blob) from the owner\'s');
    ok((await c('PUT','blob?key='+S+'&sig=x',A.code,new Uint8Array([1,2,3]),{'content-type':'application/octet-stream'})).status===403,'a tester cannot write a blob: 403');
    // taking a key off the list stops the fallback at once; a list written elsewhere is seen within a minute (kept per isolate 60 s)
    await c('PUT','cm-shared',O,{keys:[M2]});
    ok((await g(M1,A.code)).s===404&&(await g(M2,A.code)).s===200,'a key taken off the list is no longer readable by a tester');
    store.set('cm:shared',JSON.stringify({keys:[M1,M2],t:1}));
    const soon=(await g(M1,A.code)).s;
    try{Date.now=()=>realNow()+61e3;ok(soon===404&&(await g(M1,A.code)).s===200,`the list is read again after a minute (${soon} at once)`)}finally{Date.now=realNow}
    ok(!puts.some(k=>k.startsWith('cm:')&&k!=='cm:shared'),'nothing else is written')}
  // ---- the upload script against a local worker (the real worker.js), then a tester's page against the same worker
  const {env,store,puts}=mkEnv();
  const srv=http.createServer((q,res)=>{const ch=[];q.on('data',d=>ch.push(d));q.on('end',async()=>{try{const body=Buffer.concat(ch);
    const r=await worker.fetch(new Request(HOST.slice(0,-1)+q.url,{method:q.method,headers:Object.fromEntries(Object.entries(q.headers).filter(([k])=>!/^(host|connection|content-length|transfer-encoding)$/.test(k))),body:body.length?body:undefined}),env);
    res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))}catch(e){res.writeHead(500);res.end(String(e))}})});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));const W=`http://127.0.0.1:${srv.address().port}/`,reqs=[];
  srv.on('request',q=>reqs.push(q.method+' '+q.url.split('?')[0]));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cmshare-')),FIX=path.join(__dirname,'fixtures','cm','suit'),d=path.join(tmp,'out-suit'),ledger=path.join(tmp,'ledger.json');fs.mkdirSync(d);
  fs.copyFileSync(path.join(FIX,'master.jpg'),path.join(d,'colormaster-2880.png'));
  for(const f of fs.readdirSync(FIX)){if(f.startsWith('mask-'))fs.copyFileSync(path.join(FIX,f),path.join(d,'alpha-'+f.slice(5)));if(f.startsWith('part-'))fs.copyFileSync(path.join(FIX,f),path.join(d,(f.includes('lapel')?'lapel-':'sleeve-')+f.slice(5)))}
  const run=args=>new Promise(r=>{const ch=require('child_process').spawn(process.execPath,[path.join(ROOT,'tools','asm-cm-upload.js'),...args],{env:{...process.env,DW_WORKER:W,DW_TOKEN:O,DW_UPLOAD_LEDGER:ledger}});let out='';ch.stdout.on('data',x=>out+=x);ch.stderr.on('data',x=>out+=x);ch.on('close',code=>r({code,out}))});
  const fnv=t=>{let h=0xcbf29ce484222325n;for(const c of Buffer.from(t,'utf8')){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}return h.toString(16).padStart(16,'0')};
  const ver=/const ASM_VER=(\d+)/.exec(fs.readFileSync(path.join(ROOT,'assemble.js'),'utf8'))[1],cmv=/const ASM_CMV=(\d+)/.exec(fs.readFileSync(path.join(ROOT,'asm-color.js'),'utf8'))[1],ck=(k,n)=>'c'+fnv(`asm/${ver}/cm${cmv}/${k}/${n}`);
  let code='';
  try{const u1=await run(['--dir',tmp,'--kinds','suit']),w1=puts.filter(k=>k==='cm:shared').length,sh=store.has('cm:shared')&&JSON.parse(store.get('cm:shared')).keys;
    const renderKeys=[...store.keys()].filter(k=>k.startsWith('render:')).map(k=>k.slice(7));
    ok(u1.code===0&&w1===1&&/shared list for testers written/.test(u1.out),`cm-upload writes the shared list once (code ${u1.code}, ${w1} write${w1===1?'':'s'}) ${u1.code?u1.out.slice(-300):''}`);
    ok(sh&&renderKeys.every(k=>sh.includes(k))&&sh.includes(ck('suit','master'))&&sh.includes(ck('suit','mask/jacket'))&&sh.includes(ck('all','manifest'))&&sh.includes(ck('all','background'))&&sh.includes(ck('suit','master2048')),
      `the list holds every record it uploaded, the manifest, the background and the master's 2048 copy (${sh&&sh.length} keys, ${renderKeys.length} records)`);
    reqs.length=0;const u2=await run(['--dir',tmp,'--kinds','suit']),w2=puts.filter(k=>k==='cm:shared').length;
    ok(u2.code===0&&w2===1&&!reqs.some(x=>/^PUT /.test(x))&&reqs.includes('GET /cm-shared'),`a second run with nothing new writes nothing, the shared list included (${w2} write${w2===1?'':'s'} in all, ${reqs.filter(x=>/^PUT /.test(x)).length} PUTs)`);
    code=(await J(await call(env,'POST','invites',O,{name:'Tess'}))).code}
  finally{srv.close();fs.rmSync(tmp,{recursive:true,force:true})}
  // ---- end to end: the app as a tester paints a colour-coded look from the owner's masters
  const browser=await chromium.launch();
  try{const ctx=await browser.newContext({viewport:{width:390,height:844}}),seen=[];
    await ctx.addInitScript(([h,tok])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',tok);self.ASM_CM_SIZE=512},[HOST,code]);
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());
      if(u.pathname==='/sync')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"busy"}'});   // (no start-up sync: the test sets items)
      const r=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'||q.method()==='HEAD'?undefined:q.postDataBuffer()||undefined}),env);
      seen.push([q.headers()['x-app-token'],u.pathname+(u.searchParams.get('list')?'?list':''),r.status,u.searchParams.get('key')]);
      route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const res=await p.evaluate(async()=>{asmAheadSoon=()=>{};asmAhead=async()=>{};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const W={watch:I('watch','silver',{metal:'silver'}),suit:I('suit','navy'),shirt:I('shirt','pink'),tie:I('tie','burgundy')};items=Object.values(W);
      const o={shirt:W.shirt,watch:W.watch,top:W.suit,tie:W.tie},before=asmCmUse(o);await asmListGet(true);const listed=asmList&&asmList.has(asmCmKey('suit','master'))&&asmList.has(asmCmMfKey());
      await asmEnsure(o);for(let i=0;i<200&&(asmBusy.size||asmPreGetting.size);i++)await new Promise(r=>setTimeout(r,50));
      const f=asmFor(o),r=asmOut[asmOutKey(o)];let px=null;
      if(f){const im=new Image();im.src=f.img;await im.decode();const c=document.createElement('canvas');c.width=c.height=im.width;const x=c.getContext('2d');x.drawImage(im,0,0);px=[...x.getImageData(Math.round(im.width*.5),Math.round(im.width*.62),1,1).data].slice(0,3)}
      return {before,after:asmCmUse(o),listed,size:r&&r.blob&&r.blob.size,mf:Object.keys(asmCmMfNow().keys).length,px}});
    const masterGets=seen.filter(x=>x[1]==='/render'&&x[3]===ck('suit','master'));
    ok(seen.length&&seen.every(x=>x[0]===code),`the page is connected as the tester (${seen.length} requests)`);
    ok(res.listed&&res.mf>0,`the tester's list names the owner's master and manifest, and the manifest is read (${res.mf} records in it)`);
    ok(masterGets.length&&masterGets.every(x=>x[2]===200),'the master record is downloaded from the owner\'s records');
    ok(res.after==='suit'&&res.size>10000,`a tester's phone paints the suit look itself on the owner's colour-coded master (nobody built it) (${JSON.stringify(res)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
  finally{await browser.close()}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
