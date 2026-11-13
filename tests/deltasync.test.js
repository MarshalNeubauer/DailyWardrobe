// The small sync (sync.js syncLite, worker.js syncLiteGet / syncPhotos / syncLitePost): a change on one device goes up and comes down
// without the backup's photos. A wardrobe of 40 items with real-sized photos (about 10 MB, as the owner's 98 items are 16 MB) is put on
// the real worker.js in Node as an older worker stored it; three devices sync through it: two with this app, one playing an older app
// (whole backup each time). Also the worker from before this change, against this app, and a tester's daily backup limit.
const path=require('path'),fs=require('fs'),os=require('os'),crypto=require('crypto'),{pathToFileURL}=require('url'),{execSync}=require('child_process');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  let W=worker;   // the worker answering (swapped for the one from before this change below)
  const pic=n=>'data:image/jpeg;base64,'+crypto.randomBytes(Math.round(n*3/4)).toString('base64');
  const T0=Date.now()-86400000;
  const seed={items:Array.from({length:40},(_,i)=>({id:'it'+i,type:['suit','shirt','tie','pants'][i%4],primaryColor:'navy',pattern:'solid',added:T0+i,photo:pic(120e3),texture:pic(120e3),swatch:pic(20e3),swSrc:'tex'})),
    days:Array.from({length:30},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,ids:['it0','it1','it2'],worn:true,updated:T0})),tombstones:{},settings:{workdays:[1,2,3,4,5],setupDone:1,updated:T0}};
  // stored as the worker before this change kept it: no index
  store.set('wardrobe:v1',JSON.stringify({rev:5,saved:T0,data:seed}));meta.set('wardrobe:v1',{rev:5,saved:T0});
  const MB=store.get('wardrobe:v1').length/1e6;
  const browser=await chromium.launch();
  const traffic=[];
  const device=async(old)=>{const ctx=await browser.newContext();if(old)await ctx.addInitScript(()=>{window.SYNC_OLD=true});
    await ctx.route(HOST+'**',async route=>{const r=route.request(),u=new URL(r.url());
      if(u.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
      const res=await W.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      const body=await res.text();traffic.push({who:ctx.__n,m:r.method(),q:u.search.slice(0,40),up:(r.postData()||'').length,down:body.length});
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  const sync=d=>d.p.evaluate(()=>syncNow());
  // one sync on d, with what it sent and received
  const measured=async d=>{traffic.length=0;const r=await sync(d);const t=[...traffic];return {ok:r,up:t.reduce((a,x)=>a+x.up,0),down:t.reduce((a,x)=>a+x.down,0),n:t.length,t,big:t.some(x=>x.up>1e6||x.down>1e6)}};
  const kb=x=>`${(x.up/1e3).toFixed(1)} KB up, ${(x.down/1e3).toFixed(1)} KB down, ${x.n} requests`;
  const status=d=>d.p.evaluate(()=>localStorage.getItem('sync_status'));
  const itemOf=(d,id)=>d.p.evaluate(id=>items.find(i=>i.id===id)||null,id);
  const edit=(d,id,f)=>d.p.evaluate(async([id,f])=>{const it={...items.find(i=>i.id===id),...f,updated:Date.now()};await put(it);items=items.map(i=>i.id===id?it:i)},[id,f]);
  const stored=()=>JSON.parse(store.get('wardrobe:v1'));
  // the backup whole, photos inline, as an older app downloads it (since 2026-11-13 the stored value keeps its photos by reference)
  const full=async()=>JSON.parse(await (await W.fetch(new Request(HOST+'sync',{headers:{'x-app-token':'secret'}}),env)).text());
  try{
    const A=await device(),B=await device();
    // a first sync brings the whole wardrobe, photos and all
    await sync(A);await sync(B);
    const a0=await itemOf(A,'it7'),b0=await itemOf(B,'it7');
    ok(a0&&b0&&a0.photo===seed.items[7].photo&&b0.texture===seed.items[7].texture&&b0.swatch===seed.items[7].swatch&&(await A.p.evaluate(()=>items.length))===40,`two devices with this app take the whole wardrobe from a backup an older worker stored (${MB.toFixed(1)} MB), every photo intact`);
    ok(!!meta.get('wardrobe:v1').pv&&!store.get('wardrobe:v1').includes('base64')&&(await full()).data.items[7].photo===seed.items[7].photo&&[...store.keys()].some(k=>/^ph:[0-9a-f]{20}$/.test(k)),'the next save stores the backup with its photos by reference (no photos in it), each photo once under ph:<hash>');
    await sync(A);await sync(B);   // (both settled)

    // a day marked worn on A: under 100 KB each way, on A and on B
    await A.p.evaluate(()=>saveDay({date:'2026-11-03',ids:['it0','it1','it2'],worn:true},true));
    const up1=await measured(A),down1=await measured(B);
    ok(up1.ok&&!up1.big&&up1.up+up1.down<100e3&&up1.t.some(x=>x.m==='POST'),`a day marked worn goes up without the backup (${kb(up1)})`);
    ok(down1.ok&&!down1.big&&down1.up+down1.down<100e3&&(await B.p.evaluate(()=>dayRecs['2026-11-03']&&dayRecs['2026-11-03'].worn===true)),`and comes down to the other device the same way (${kb(down1)})`);
    // a swapped piece (an item edited) on B, back to A
    await edit(B,'it5',{primaryColor:'burgundy'});
    const up2=await measured(B),down2=await measured(A),a5=await itemOf(A,'it5');
    ok(up2.ok&&down2.ok&&up2.up+up2.down<100e3&&down2.up+down2.down<100e3&&a5.primaryColor==='burgundy'&&a5.photo===seed.items[5].photo,`an edited piece: ${kb(up2)} from B, ${kb(down2)} to A, its photos kept`);
    // a new photo goes up once and comes down once, alone
    const np=pic(150e3);await edit(A,'it9',{photo:np});
    const up3=await measured(A),down3=await measured(B);
    ok(up3.ok&&up3.up>150e3&&up3.up<300e3&&(await full()).data.items.find(i=>i.id==='it9').photo===np,`a replaced photo is sent once (${kb(up3)})`);
    ok(down3.ok&&down3.down>150e3&&down3.down<300e3&&down3.t.some(x=>x.q.startsWith('?ph='))&&(await itemOf(B,'it9')).photo===np,`and downloaded alone by the other device (${kb(down3)})`);
    // a deletion (tombstone)
    await A.p.evaluate(async()=>{const t=Date.now();await del('it3');await metaPut('tombstones',{...(await metaGet('tombstones')||{}),it3:t});items=items.filter(i=>i.id!=='it3')});
    await sync(A);await sync(B);
    ok(!(await itemOf(B,'it3'))&&!stored().data.items.some(i=>i.id==='it3')&&stored().data.tombstones.it3,'a deletion reaches the backup and the other device');
    // both devices change something before either syncs: the second is refused (409), asks again and merges
    await edit(A,'it11',{primaryColor:'grey'});await edit(B,'it12',{primaryColor:'green'});
    traffic.length=0;await sync(A);await sync(B);const conflict=traffic.filter(x=>x.m==='POST').length;await sync(A);
    const both=async d=>{const [x,y]=[await itemOf(d,'it11'),await itemOf(d,'it12')];return x.primaryColor==='grey'&&y.primaryColor==='green'};
    ok(await both(A)&&await both(B)&&!traffic.some(x=>x.down>1e6),`changes made on both devices at once both survive, without the backup (${conflict} saves)`);
    {const r=await W.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:1,day:'2026-11-13',delta:{items:[]}})}),env);
      ok(r.status===409&&(await r.json()).rev===meta.get('wardrobe:v1').rev,'a save based on an old version is refused (409) with the current version');}
    // nothing changed: one tiny request
    const q=await measured(A);
    ok(q.ok&&q.n===1&&q.down<200,`nothing new: one small request (${kb(q)})`);
    // a device whose storage was cleared but kept its marker gets everything back
    await B.p.evaluate(async()=>{for(const i of await tx('readonly',s=>s.getAll()))await tx('readwrite',s=>s.delete(i.id));items=[]});
    await sync(B);
    ok((await B.p.evaluate(()=>items.length))===(await A.p.evaluate(()=>items.length))&&(await itemOf(B,'it7')).photo===seed.items[7].photo&&stored().data.items.length>30,'a device that lost its wardrobe gets it back, photos and all, and the backup is not emptied');

    // an older app (the whole backup each time) on the same worker
    const C=await device(true);
    const cs=await measured(C);
    ok(cs.ok&&cs.t[0].q===''&&(await itemOf(C,'it9')).photo===np&&(await C.p.evaluate(()=>items.length))===(await A.p.evaluate(()=>items.length)),`an older app still downloads the whole backup and reads it (${kb(cs)})`);
    await edit(C,'it13',{primaryColor:'black'});const cu=await measured(C);
    ok(cu.ok&&cu.t.some(x=>x.m==='PUT'&&x.up>1e6)&&stored().data.items.find(i=>i.id==='it13').primaryColor==='black'&&meta.get('wardrobe:v1').pv,`and still saves the whole backup, which the worker stores by reference (${kb(cu)})`);
    const fromOld=await measured(A);
    ok(fromOld.ok&&fromOld.up+fromOld.down<100e3&&(await itemOf(A,'it13')).primaryColor==='black'&&(await itemOf(A,'it13')).photo===seed.items[13].photo,`a change from the older app reaches this app without the backup (${kb(fromOld)})`);
    {const v=`${meta.get('wardrobe:v1').rev}:${meta.get('wardrobe:v1').saved}`,r=await (await W.fetch(new Request(HOST+'sync?v='+v,{headers:{'x-app-token':'secret'}}),env)).json();
      const c=await W.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:1,data:{items:[]}})}),env),cj=await c.json();
      ok(r.same===true&&c.status===409&&cj.data.items.find(i=>i.id==='it7').photo===seed.items[7].photo&&!('index' in cj),'the older app\'s quick check and its conflict answer (the whole backup, photos inline) are as before');}
    // daily copies and Roll back: the copies are the stored backup, read whole by any app
    const day=new Date().toISOString().slice(0,10),snap=store.get('snap:'+day)?JSON.parse(store.get('snap:'+day)):null,local=new Date();
    const anySnap=[...store.keys()].filter(k=>/^snap:\d{4}-\d{2}-\d{2}$/.test(k));
    const sv=anySnap.length&&(await (await W.fetch(new Request(HOST+'sync?snap='+anySnap[0].slice(5),{headers:{'x-app-token':'secret'}}),env)).json());
    ok(anySnap.length>=1&&sv&&sv.data.items.find(i=>i.id==='it7').photo===seed.items[7].photo,`the day's first change keeps the backup as it was (${anySnap.join(', ')}), photos inline`);
    await A.p.evaluate(()=>openSettings&&openSettings());await A.p.evaluate(()=>loadSnapshots());
    await A.p.evaluate(async d=>{$('#snap-list').value=d;const r=rollBack();$('#ask-ok').click();await r},anySnap[0].slice(5));
    const rb=await A.p.evaluate(()=>({st:$('#snap-status').textContent,c5:items.find(i=>i.id==='it5').primaryColor,n:items.length}));
    await sync(B);
    ok(/Rolled back\./.test(rb.st)&&rb.c5==='navy'&&(await itemOf(B,'it5')).primaryColor==='navy'&&(await itemOf(B,'it5')).photo===seed.items[5].photo&&store.has('snap:before-restore'),`Roll back goes through the small sync and reaches the other device (${rb.st})`);

    // the worker from before this change: this app syncs with it the old way
    let OldW=null;
    try{const src=execSync('git show ef18d06:worker.js',{cwd:ROOT,encoding:'utf8',maxBuffer:64<<20}),f=path.join(os.tmpdir(),`dw-old-worker-${process.pid}.mjs`);fs.writeFileSync(f,src);OldW=(await import(pathToFileURL(f).href)).default;fs.unlinkSync(f)}catch(e){}
    if(OldW){W=OldW;
      await edit(A,'it14',{primaryColor:'pink'});const o1=await measured(A);
      ok(o1.ok&&o1.t.some(x=>x.m==='PUT')&&!o1.t.some(x=>x.m==='POST')&&stored().data.items.find(i=>i.id==='it14').primaryColor==='pink',`against the worker from before, this app syncs the whole backup as before (${kb(o1)})`);
      const o2=await measured(B);
      ok(o2.ok&&(await itemOf(B,'it14')).primaryColor==='pink',`and the other device takes it (${kb(o2)})`);
      W=worker;await edit(B,'it15',{primaryColor:'olive'});const o3=await measured(B),o4=await measured(A);
      ok(o3.ok&&o4.ok&&o3.up+o3.down<100e3&&(await itemOf(A,'it15')).primaryColor==='olive',`back on this worker, a backup the old one stored (no index) still takes the small sync (${kb(o3)}; ${kb(o4)})`);
    }else ok(true,'(the worker from before this change is not in this clone: skipped)');

    ok([A,B,C].every(d=>!d.errs.length),'no page errors ('+[A,B,C].flatMap(d=>d.errs).join('; ')+')');
    ok(!(await status(A))&&!(await status(B)),'no sync failure left on either device');
  }finally{await browser.close()}

  // a tester's saves count against their daily backups, as the whole-backup saves do; a refused one is given back
  {store.clear();meta.clear();
    const inv=await (await worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({name:'Tess'})}),env)).json();
    for(const k of store.keys())if(k.startsWith('invite:')){const r=JSON.parse(store.get(k));r.created-=8*86400000;store.set(k,JSON.stringify(r))}
    const post=(baseRev,i)=>worker.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':inv.code,'content-type':'application/json'},body:JSON.stringify({baseRev,day:'2026-11-13',delta:{items:[{id:'t'+i,type:'tie',added:1000+i}]}})}),env);
    const verOf=async()=>((await (await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':inv.code}}),env)).json()).rev);
    ok((await post(99,0)).status===409,'(a conflict first)');
    const st=[];for(let i=0;i<31;i++)st.push((await post(await verOf(),i)).status);
    ok(st.slice(0,30).every(s=>s===200)&&st[30]===429,`a tester's 30 saves a day, conflicts not counted; the 31st is refused (${st.slice(-2).join(', ')})`);
    ok(!store.has('wardrobe:v1')&&[...store.keys()].some(k=>/^u:[^:]+:wardrobe:v1$/.test(k)),'a tester\'s backup is under their own prefix');}
};
