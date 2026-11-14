// Assembled pictures built ahead on a computer (tools/asm-prebuild.js, assemble.js asmPrebuildOne / asmGetPre): the computer paints a
// look's picture with the phone's own code and uploads it under the look's key, signed 'asm/out/cm<ASM_CMV>/<stamp>'; a phone takes it
// before downloading the master, and paints the picture itself when nothing (or a picture signed another way) is on the worker.
// Fixtures: the colour-coded suit master and its masks at 512 (tests/fixtures/cm/suit/). (Until 2026-11-14 it ran on the earlier
// assembler's master and pieces.)
const fs=require('fs');
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/',FIX=require('path').join(__dirname,'fixtures','cm','suit');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const got=[];let served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');if(k)got.push(k);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&u.searchParams.get('list'))return j({keys:Object.keys(served)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the colour-coded suit master's records, as the worker keeps them
    const files=fs.readdirSync(FIX),names=files.map(f=>f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'));
    const ck=await p.evaluate(ns=>ns.map(n=>asmCmKey('suit',n)),names),cmRecs={};
    files.forEach((f,i)=>{cmRecs[ck[i]]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(require('path').join(FIX,f)).toString('base64'),model:'colormaster',t:1000}});
    const masterKeys=new Set(ck);Object.assign(served,cmRecs);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      items=[I('watch','silver',{metal:'silver'}),I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];settings.vestMode='never';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      asmAheadSoon=()=>{};asmAhead=async()=>{}},HOST);   // (nothing built in the background during the test)
    // the computer's side: one look painted as a phone paints it
    const pre=await p.evaluate(async()=>{await asmListGet(true);const o=planFor()[key(sel)],r=await asmPrebuildOne(o);return r&&{key:r.key,sig:r.sig,img:r.img.slice(0,23),len:r.img.length,want:asmOutKey(o),kind:asmCmUse(o),cmv:ASM_CMV}});
    ok(pre&&pre.kind==='suit'&&pre.key===pre.want&&pre.sig===`asm/out/cm${pre.cmv}/1000`&&pre.img==='data:image/jpeg;base64,'&&pre.len>10000,`asmPrebuildOne paints the look's picture with the phone's code, keyed by the look and signed with the masters' version and the newest record's date (${pre&&pre.sig})`);
    // a phone holding nothing takes the upload: it downloads no master record and paints nothing
    served[pre.key]={sig:pre.sig,img:'data:image/jpeg;base64,/9j/BUILT',model:'assembled',t:5};
    const phone=async()=>p.evaluate(async()=>{for(const k of Object.keys(renders))if(/^c/.test(k))delete renders[k];asmOut={};asmTried.clear();asmPreNo.clear();await asmListGet(true);const o=planFor()[key(sel)];
      let built=0;const real=asmPhoto,idle=async()=>{for(let i=0;i<200&&(asmBusy.size||asmPreGetting.size);i++)await new Promise(r=>setTimeout(r,50))};asmPhoto=async(...a)=>{built++;return real(...a)};
      try{await asmEnsure(o);await idle()}finally{asmPhoto=real}
      const a=asmFor(o);return {img:a&&a.img.slice(0,40),built,blob:!!(asmOut[asmOutKey(o)]||{}).blob}});
    got.length=0;const a=await phone();
    ok(a.built===0&&a.img==='data:image/jpeg;base64,/9j/BUILT'&&!got.some(k=>masterKeys.has(k)),`a phone takes the computer's picture before asking for the master, and paints nothing (${got.length} keys asked for, none of them a master record)`);
    // signed another way (the earlier assembler's zones, or another masters' version): not used, painted here
    served[pre.key]={...served[pre.key],sig:'asm/out/z9/1000'};const c=await phone();
    ok(c.built===1&&c.img,'a picture signed another way (the earlier assembler\'s): not used, painted here');
    delete served[pre.key];const d=await phone();
    ok(d.built===1&&d.img,'nothing on the worker for the look: the phone paints it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // what a worker holds for this wardrobe: the backup and the master's records (for the script's run below)
    var seed=await p.evaluate(()=>({items,settings:{...settings,dress:undefined}}));seed.renders=cmRecs;
  }finally{await browser.close()}
  // the computer's script: it explains itself and refuses to run without a worker and a code
  const {spawnSync}=require('child_process'),path=require('path'),s=path.join(__dirname,'..','tools','asm-prebuild.js');
  const h=spawnSync(process.execPath,[s,'--help'],{encoding:'utf8'}),n=spawnSync(process.execPath,[s],{encoding:'utf8',env:{...process.env,DW_WORKER:'',DW_TOKEN:''}});
  ok(h.status===0&&/npm run assemble/.test(h.stdout)&&n.status===1,'tools/asm-prebuild.js explains its use, and needs DW_WORKER and DW_TOKEN');
  // the script, end to end, against a worker on this machine holding that wardrobe
  {const {pathToFileURL}=require('url'),http=require('http'),worker=(await import(pathToFileURL(path.join(__dirname,'..','worker.js')).href)).default;
    const store=new Map(),meta=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
    store.set('wardrobe:v1',JSON.stringify({rev:1,saved:1,data:{items:seed.items,days:[],tombstones:{},settings:{...seed.settings,setupDone:1,updated:1}}}));meta.set('wardrobe:v1',{rev:1,saved:1});
    for(const [k,r] of Object.entries(seed.renders))store.set('render:'+k,JSON.stringify(r));
    const env={APP_TOKEN:'owner-code',WARDROBE:KV};let puts=0;
    const srv=http.createServer(async(q,r)=>{let b='';for await(const c of q)b+=c;if(q.method==='PUT'&&/\/render/.test(q.url))puts++;
      const res=await worker.fetch(new Request('http://w'+q.url,{method:q.method,headers:q.headers,body:['GET','HEAD','OPTIONS'].includes(q.method)?undefined:b}),env);
      r.writeHead(res.status,Object.fromEntries(res.headers));r.end(Buffer.from(await res.arrayBuffer()))});
    await new Promise(x=>srv.listen(0,'127.0.0.1',x));const W=`http://127.0.0.1:${srv.address().port}/`;
    const run=()=>new Promise(res=>{const c=require('child_process').spawn(process.execPath,[s,'--days','14','--cm-size','512','--origin','http://127.0.0.1:9/dw/'],{env:{...process.env,DW_WORKER:W,DW_TOKEN:'owner-code',DW_UPLOAD_LEDGER:require('path').join(require('os').tmpdir(),'dw-ledger-test-'+process.pid+'.json')}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
    const r1=await run(),outs=[...store.keys()].filter(k=>k.startsWith('render:')&&/^asm\/out\/cm\d+\/\d+$/.test(JSON.parse(store.get(k)).sig||''));
    const p1=puts,r2=await run();srv.close();
    ok(r1.code===0&&outs.length>=1&&new RegExp(`${outs.length} built, ${outs.length} uploaded`).test(r1.out)&&!store.get('wardrobe:v1').includes('"rev":2'),`npm run assemble builds every coming look and uploads it, and leaves the backup alone (${outs.length} uploaded: ${(r1.out.match(/Done.*/)||[''])[0]})`);
    ok(r2.code===0&&/already current/.test(r2.out)&&new RegExp(`0 uploaded, ${outs.length} already current`).test(r2.out),`a second run uploads nothing: every picture is current (${(r2.out.match(/Done.*/)||[''])[0]})`);
    // (2026-11-14) the worker's writes for the day used up (Cloudflare's KV answers "limit exceeded"): the script stops at the first refusal,
    // keeps the pause with its profile, and a run before the reset uploads nothing (it used to retry every picture every 5 minutes)
    for(const k of [...store.keys()])if(k.startsWith('render:')&&/^asm\/out\//.test(JSON.parse(store.get(k)).sig||''))store.delete(k);
    const put0=KV.put;KV.put=async(k,v,o)=>{if(k.startsWith('render:'))throw new Error('KV put() limit exceeded for the day.');return put0(k,v,o)};
    const prof=require('fs').mkdtempSync(path.join(require('os').tmpdir(),'dw-pause-'));puts=0;
    srv.listen(0,'127.0.0.1');await new Promise(x=>srv.once('listening',x));const W2=`http://127.0.0.1:${srv.address().port}/`;
    const runQ=()=>new Promise(res=>{const c=require('child_process').spawn(process.execPath,[s,'--days','14','--cm-size','512','--profile',prof,'--origin','http://127.0.0.1:9/dw/'],{env:{...process.env,DW_WORKER:W2,DW_TOKEN:'owner-code',DW_UPLOAD_LEDGER:require('path').join(require('os').tmpdir(),'dw-ledger-test-'+process.pid+'.json')}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
    const q1=await runQ(),pq1=puts,pf=require('fs').existsSync(path.join(prof,'upload-pause.json')),q2=await runQ();srv.close();KV.put=put0;
    ok(pq1===1&&/uploads paused until/.test(q1.out)&&pf,`when the worker's writes for the day are used up, the script stops at the first refused upload and keeps the pause (${pq1} upload tried)`);
    ok(puts===pq1&&/Uploads are paused until/.test(q2.out),'a run before the daily reset uploads nothing');
    // this computer's own daily cap (tools/upload-budget.js; the fixture has one coming look): with the day's one write taken by another
    // tool, the script uploads nothing, pauses the same way and paints nothing; a later run that day uploads nothing
    const fs_=require('fs'),os_=require('os'),led=path.join(os_.tmpdir(),'dw-ledger-cap-'+process.pid+'.json');fs_.rmSync(led,{force:true});
    fs_.writeFileSync(led,JSON.stringify({day:new Date().toISOString().slice(0,10),used:1}));
    const prof2=fs_.mkdtempSync(path.join(os_.tmpdir(),'dw-cap-'));puts=0;
    srv.listen(0,'127.0.0.1');await new Promise(x=>srv.once('listening',x));const W3=`http://127.0.0.1:${srv.address().port}/`;
    const runC=()=>new Promise(res=>{const c=require('child_process').spawn(process.execPath,[s,'--days','14','--cm-size','512','--profile',prof2,'--origin','http://127.0.0.1:9/dw/'],{env:{...process.env,DW_WORKER:W3,DW_TOKEN:'owner-code',DW_UPLOAD_LEDGER:led,DW_UPLOAD_LIMIT:'1'}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
    const c1=await runC(),pc1=puts,c2=await runC();srv.close();const usedC=JSON.parse(fs_.readFileSync(led,'utf8')).used;fs_.rmSync(led,{force:true});
    ok(pc1===0&&usedC===1&&/daily upload limit \(1\) is used up: uploads paused until/.test(c1.out)&&!/\[1\/1\]/.test(c1.out),`with this computer's daily cap reached, the script uploads and paints nothing and pauses until the reset (${pc1} uploads)`);
    ok(puts===pc1&&/Uploads are paused until/.test(c2.out),'a run later that day uploads nothing');}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
