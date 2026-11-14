// Backup & sync: the real worker.js runs in Node with an in-memory KV, and the browser's sync requests are routed to it.
// Two browser contexts play two devices (e.g. the iPhone and the Duo).
const path=require('path'),fs=require('fs'),os=require('os'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map();
  const meta=new Map();   // KV keeps a key's metadata with its value and returns it from list()
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const traffic=[];   // every sync request: method, query and how many bytes came back
  let env={APP_TOKEN:'secret',WARDROBE:KV};
  const HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      const body=await res.text();if(new URL(r.url()).pathname==='/sync')traffic.push({m:r.method(),q:new URL(r.url()).search,up:(r.postData()||'').length,down:body.length});
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  const sync=p=>p.evaluate(()=>syncNow());
  // a sync whose requests are counted: the backup an edit schedules (scheduleSync, 2.5 s after it) is called off first, since on
  // a busy machine it came due in the middle of the count and added a request
  // and the device is quiet first: a sync that brought changes redraws Today, which records the day and locks the week in the background
  // (today.js recordRun) and schedules another backup; landing in the middle of the count, those writes added a request or an upload
  // (the flaky failures of 2026-11-14: "nothing new is one small request", "a change on the other device is picked up", "quick again")
  // quiet = no recording or sync running, and the stored wardrobe (stateSig) the same over three checks 120 ms apart (any background
  // writer, not only recordRun: arrivals, migrations, a redraw the sync scheduled), for at most 6 s
  const quiet=p=>p.evaluate(async()=>{let last='',same=0;const end=Date.now()+6000;
    while(Date.now()<end){await recordRun;const sig=stateSig(await localState());same=!syncing&&sig===last?same+1:0;last=sig;if(same>=3)return true;await new Promise(r=>setTimeout(r,120))}return false});
  const syncQ=async p=>{await quiet(p);return p.evaluate(()=>{clearTimeout(syncTimer);return syncNow()})};
  // before a counted sync the OTHER device must be still too: a late lock it writes after its own sync goes up with its scheduled backup,
  // and landing during the count that changed the server under the counted device (the last flaky failure: 2.9 KB down, then an upload).
  // settle: sync both until they hold the same wardrobe (stateSig), both quiet, both scheduled backups called off
  const sig=p=>p.evaluate(async()=>stateSig(await localState()));
  const hush=async p=>{await quiet(p);await p.evaluate(()=>clearTimeout(syncTimer))};
  const settle=async(...ps)=>{for(let n=0;n<6;n++){for(const p of ps)await syncQ(p);for(const p of ps)await quiet(p);const s=await Promise.all(ps.map(sig));if(s.every(x=>x===s[0]))break}for(const p of ps)await hush(p)};
  const add=(p,fields)=>p.evaluate(async f=>{const it={id:crypto.randomUUID(),type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now(),...f};await put(it);items.push(it);return it.id},fields);
  const names=p=>p.evaluate(()=>items.map(i=>i.type+':'+i.primaryColor).sort().join(','));

  const A=await device(),B=await device();
  const id=await add(A.p,{type:'tie',primaryColor:'burgundy'});await sync(A.p);
  const kv=JSON.parse(store.get('wardrobe:v1'));
  ok(kv.data.items.length===1&&kv.rev>=1,'device A backs up its new item to the worker');
  await sync(B.p);
  ok((await names(B.p))==='tie:burgundy','device B receives it');
  await B.p.evaluate(async id=>{const it=items.find(i=>i.id===id);it.primaryColor='green';await put(it)},id);await sync(B.p);await sync(A.p);
  ok((await names(A.p))==='tie:green','an edit on B reaches A');
  await A.p.evaluate(async id=>{await del(id);items=items.filter(i=>i.id!==id)},id);await sync(A.p);await sync(B.p);
  {const nb=await names(B.p);if(nb!==''&&process.env.SYNC_DEBUG)console.log('DEBUG B:',nb,'A:',await names(A.p),'statusA:',await A.p.evaluate(()=>localStorage.getItem('sync_status')),'statusB:',await B.p.evaluate(()=>localStorage.getItem('sync_status')),'kv:',JSON.stringify(JSON.parse(store.get('wardrobe:v1')).data.tombstones),JSON.stringify(JSON.parse(store.get('wardrobe:v1')).data.items.map(i=>[i.id.slice(0,4),i.updated])));
  ok(nb==='','a deletion on A reaches B (and stays deleted)');}
  // both devices edit while out of touch, then sync: nothing is lost
  await add(A.p,{type:'shirt',primaryColor:'white'});await add(B.p,{type:'belt',primaryColor:'black'});
  await sync(A.p);await sync(B.p);await sync(A.p);
  ok((await names(A.p))==='belt:black,shirt:white'&&(await names(B.p))==='belt:black,shirt:white','offline edits on both devices merge');
  // the merged state survives a reload (it was written to IndexedDB)
  await B.p.reload();await B.p.waitForFunction(()=>window.appReady&&items.map(i=>i.type+':'+i.primaryColor).sort().join(',')==='belt:black,shirt:white',null,{timeout:5000}).catch(()=>{});
  ok((await names(B.p))==='belt:black,shirt:white','synced wardrobe persists on the device');
  // the screen refreshes after a sync brings new items
  await add(A.p,{type:'suit',primaryColor:'navy',vest:'no'});await sync(A.p);await B.p.click('#n-wardrobe');await sync(B.p);   // (the suit with its vest value, as the app saves suits: one without would be given it once, a change of its own; tests/dress.test.js)
  ok((await B.p.textContent('#wardrobe')).includes('Suit'),'the open screen refreshes when synced items arrive');
  // changes synced in while Settings is open (the start-up sync comes back 2.5 s after launch) leave it open: the tab on screen
  // is redrawn once it closes
  await add(A.p,{type:'socks',primaryColor:'charcoal'});await sync(A.p);await B.p.evaluate(()=>openSettings('backup'));await sync(B.p);
  const so=await B.p.evaluate(()=>{const n=()=>document.querySelectorAll('#wardrobe .gi').length,open=settingsOpen(),before=n();closeSettings();return {open,before,ward:n(),items:items.length}});
  await B.p.evaluate(()=>show('today'));await add(A.p,{type:'belt',primaryColor:'brown'});await sync(A.p);
  await B.p.evaluate(()=>openSettings('backup'));await sync(B.p);
  const st=await B.p.evaluate(()=>({open:settingsOpen(),stale:todayStale}));await B.p.evaluate(()=>closeSettings());
  const after=await B.p.evaluate(()=>({stale:todayStale,today:!$('#today').hidden}));
  ok(so.open&&so.ward===so.items&&so.before===so.items-1&&st.open&&st.stale&&!after.stale&&after.today,`a sync that brings changes while Settings is open leaves it open; the tab on screen (Wardrobe, Today) is redrawn when it closes (${JSON.stringify({so,st,after})})`);

  // a delete and an edit made while a sync is still in flight must not be undone by that sync
  const [d1,e1]=[await add(A.p,{type:'tie',primaryColor:'gold'}),await add(A.p,{type:'tie',primaryColor:'purple'})];await sync(A.p);
  await A.p.evaluate(async([d1,e1])=>{const run=syncNow();await del(d1);items=items.filter(i=>i.id!==d1);const it=items.find(i=>i.id===e1);it.primaryColor='pink';await put(it);await run;await syncNow()},[d1,e1]);
  await sync(B.p);
  const race=await Promise.all([names(A.p),names(B.p)]);
  ok(!race[0].includes('tie:gold')&&race[0].includes('tie:pink')&&race[1]===race[0],'a delete and an edit made during a sync survive it, on both devices');
  // nothing changed since the last sync: one tiny request, no backup downloaded or uploaded
  await settle(A.p,B.p);traffic.length=0;const okQuick=await syncQ(A.p),t1=[...traffic];
  ok(okQuick&&t1.length===1&&t1[0].m==='GET'&&/[?&]v=\d+%3A\d+$/.test(t1[0].q)&&t1[0].down<200,`a sync with nothing new is one small request, with no backup sent either way (${JSON.stringify(t1)})`);
  // a change on the other device is still found (the version no longer matches, so the backup comes down)
  await add(B.p,{type:'socks',primaryColor:'navy'});await settle(B.p);await hush(A.p);traffic.length=0;await syncQ(A.p);
  ok((await names(A.p)).includes('socks:navy')&&traffic[0].down>200,'a change made on the other device is still picked up');
  // a change here goes up as before, and the next sync is quick again
  await settle(A.p,B.p);await add(A.p,{type:'socks',primaryColor:'brown'});traffic.length=0;await syncQ(A.p);const t2=[...traffic];await hush(A.p);await hush(B.p);traffic.length=0;await syncQ(A.p);
  ok(t2.some(t=>t.m==='POST')&&JSON.parse(store.get('wardrobe:v1')).data.items.some(i=>i.primaryColor==='brown')&&traffic.length===1&&traffic[0].down<200,'a local change is uploaded; the sync after it is quick again');
  // the wardrobe is lost on the device (storage cleared) but the marker survives: the backup must come back, not be emptied
  await A.p.evaluate(async()=>{for(const i of await tx('readonly',s=>s.getAll()))await tx('readwrite',s=>s.delete(i.id));items=[]});await sync(A.p);
  ok((await names(A.p)).includes('socks:brown')&&JSON.parse(store.get('wardrobe:v1')).data.items.length>0,'a device that lost its wardrobe gets it back from the backup (the backup is never overwritten with nothing)');
  await sync(B.p);
  // a backup saved by an older worker (no version kept beside it): everything still syncs, just without the shortcut
  meta.clear();traffic.length=0;await sync(A.p);
  ok(traffic.length===1&&traffic[0].m==='GET'&&traffic[0].down>200&&!(await A.p.evaluate(()=>localStorage.getItem('sync_status'))),`a backup without a stored version still syncs, with a full download (${JSON.stringify(traffic)})`);
  // misconfiguration messages
  env={APP_TOKEN:'secret'};await sync(A.p);
  ok((await A.p.evaluate(()=>localStorage.getItem('sync_status')))?.includes('WARDROBE'),'missing KV binding: tells you to add WARDROBE');
  env={WARDROBE:KV};await sync(A.p);
  ok((await A.p.evaluate(()=>localStorage.getItem('sync_status')))?.includes('APP_TOKEN'),'no APP_TOKEN on the worker: backups refused, tells you why');
  env={APP_TOKEN:'secret',WARDROBE:KV};await A.p.evaluate(()=>localStorage.setItem('app_token','wrong'));await sync(A.p);
  ok((await A.p.evaluate(()=>localStorage.getItem('sync_status')))?.includes('forbidden'),'wrong token is refused');
  await A.p.evaluate(()=>localStorage.setItem('app_token','secret'));

  // backup file round trip onto a fresh device with sync off
  const file=path.join(os.tmpdir(),`dw-backup-test-${process.pid}-${Date.now()}.json`);
  const data=await A.p.evaluate(async()=>JSON.stringify({app:'daily-wardrobe',version:1,...await localState()}));fs.writeFileSync(file,data);
  const C=await browser.newContext();const cp=await C.newPage();cp.on('dialog',d=>d.accept());await cp.goto(url);await cp.waitForFunction(()=>window.appReady);
  await cp.evaluate(()=>openSettings());await cp.setInputFiles('#settings-modal input[type=file]',file);await cp.waitForFunction(()=>items.length>0,null,{timeout:5000}).catch(()=>{});await cp.waitForTimeout(100);
  ok((await names(cp))===(await names(A.p))&&(await names(cp)).length>0,'Download backup → Restore file reproduces the wardrobe on a new device');
  fs.unlinkSync(file);

  // worker: a stale save is rejected so devices never overwrite each other
  const rev=JSON.parse(store.get('wardrobe:v1')).rev;
  const res=await worker.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:rev-1,data:{items:[]}})}),env);
  ok(res.status===409&&JSON.parse(store.get('wardrobe:v1')).rev===rev,'worker rejects a save based on an old revision (409)');
  ok(A.errs.length===0&&B.errs.length===0,'no page errors on either device');
  await browser.close();
};
