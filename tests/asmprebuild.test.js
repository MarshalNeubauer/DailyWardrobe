// Assembled pictures built ahead on a computer (tools/asm-prebuild.js, assemble.js asmPrebuildOne / asmGetPre): the computer makes a
// look's picture with the phone's own code and uploads it under the look's key, signed with the zone version and the newest date of
// the photos it was made from; a phone takes it before downloading any piece, and makes the picture itself when the upload is older
// than a photo it holds, or was made with other zones.
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const got=[];let served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');if(k)got.push(k);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(async()=>{const data=async n=>{const d=await asmData('tests/fixtures/asm-'+n+'.jpg'),c=document.createElement('canvas');c.width=c.height=d.width;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/jpeg',.9)};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),jk=I('blazer','khaki',{pattern:'windowpane'}),black=I('shirt','black'),t1=I('tie','navy',{pattern:'stripe',secondaryColor:'pink'});
      items=[watch,jk,black,t1,I('pants','grey'),I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[1,2,3,4,5];settings.vestMode='never';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      asmAheadSoon=()=>{};asmAhead=async()=>{};   // (nothing built in the background during the test)
      const put=async(k,f,sig='')=>{renders[k]={sig,img:await data(f),model:'',t:1000}};
      await put(asmMasterKey(),'master',asmMasterSig({watch,shirt:asmMasterItem('shirt','white')}));
      for(const s of ['jacket','shirt','tie','watch'])await put(asmCalibKey(s),s==='shirt'?'shirt-black':s);
      await put(asmPieceKey('jacket',jk),'jacket');await put(asmPieceKey('shirt',black),'shirt-black');await put(asmPieceKey('tie',t1),'tie');window.__keep={...renders}});
    // the computer's side: one look made as a phone makes it
    const pre=await p.evaluate(async()=>{const o=planFor()[key(sel)],r=await asmPrebuildOne(o);return r&&{key:r.key,sig:r.sig,img:r.img.slice(0,23),len:r.img.length,want:asmOutKey(o),zv:ASM_ZV}});
    ok(pre&&pre.key===pre.want&&pre.sig===`asm/out/z${pre.zv}/1000`&&pre.img==='data:image/jpeg;base64,'&&pre.len>20000,`asmPrebuildOne makes the look's picture with the phone's code, keyed by the look and signed with the zones and the newest photo's date (${pre&&pre.sig})`);
    // a phone that holds the master but none of the pieces takes the upload: it downloads no piece and computes nothing
    const keyOf=await p.evaluate(()=>asmOutKey(planFor()[key(sel)]));
    served[keyOf]={sig:pre.sig,img:'data:image/jpeg;base64,/9j/BUILT',model:'assembled',t:5};
    const phone=async(setup)=>p.evaluate(async([h,setup])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');
      renders={...__keep};asmOut={};asmTried.clear();const o=planFor()[key(sel)];for(const pk of asmParts(o).map(x=>x.key))if(setup.noPieces)delete renders[pk];
      if(setup.newer)renders[asmParts(o)[0].key]={...renders[asmParts(o)[0].key],t:2000};
      // (Today's own drawing may start the same look's asmEnsure while this one waits for the worker: whichever starts first builds it,
      // so the count runs until both are done)
      let built=0;const real=asmPhoto,idle=async()=>{for(let i=0;i<200&&(asmBusy.size||asmPreGetting.size);i++)await new Promise(r=>setTimeout(r,50))};asmPhoto=async(...a)=>{built++;return real(...a)};
      try{await asmEnsure(o);await idle()}finally{asmPhoto=real}
      const a=asmFor(o);return {img:a&&a.img.slice(0,40),built}},[HOST,setup]);
    got.length=0;const a=await phone({noPieces:true});
    const pieces=await p.evaluate(()=>asmParts(planFor()[key(sel)]).map(x=>x.key));
    ok(a.img==='data:image/jpeg;base64,/9j/BUILT'&&a.built===0&&!got.some(k=>pieces.includes(k)),`a phone takes the computer's picture before asking for any piece, and computes nothing (${got.length} keys asked for, none of them a piece)`);
    // a piece made again since (this phone holds a newer one): the upload is older, so the phone makes the picture itself
    const b=await phone({newer:true});
    ok(b.built===1&&b.img&&b.img!=='data:image/jpeg;base64,/9j/BUILT',`built from older photos than the phone holds: not used, made here instead (${b.built} made)`);
    // made with other zones: not used either
    served[keyOf]={...served[keyOf],sig:'asm/out/z1/1000'};
    const c=await phone({});
    ok(c.built===1,'made with another zone version: not used');
    // nobody built it: a 404, and the phone makes it as before
    delete served[keyOf];const d=await phone({});
    ok(d.built===1&&d.img,'nothing on the worker for the look: the phone makes it, as before');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // what a worker holds for this wardrobe: the backup and every photo record (for the script's run below)
    var seed=await p.evaluate(()=>({items,settings:{...settings,dress:undefined},renders:Object.fromEntries(Object.entries(__keep).map(([k,r])=>[k,{sig:r.sig,img:r.img,model:'',t:r.t}]))}));
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
    const run=()=>new Promise(res=>{const c=require('child_process').spawn(process.execPath,[s,'--days','14','--origin','http://127.0.0.1:9/dw/'],{env:{...process.env,DW_WORKER:W,DW_TOKEN:'owner-code'}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
    const r1=await run(),outs=[...store.keys()].filter(k=>k.startsWith('render:')&&/^asm\/out\/z\d+\/1000$/.test(JSON.parse(store.get(k)).sig||''));
    const p1=puts,r2=await run();srv.close();
    ok(r1.code===0&&outs.length>=1&&p1===outs.length&&!store.get('wardrobe:v1').includes('"rev":2'),`npm run assemble builds every coming look and uploads it, and leaves the backup alone (${outs.length} uploaded: ${(r1.out.match(/Done.*/)||[''])[0]})`);
    ok(r2.code===0&&puts===p1&&/already current/.test(r2.out)&&new RegExp(`0 uploaded, ${outs.length} already current`).test(r2.out),`a second run uploads nothing: every picture is current (${(r2.out.match(/Done.*/)||[''])[0]})`);}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
