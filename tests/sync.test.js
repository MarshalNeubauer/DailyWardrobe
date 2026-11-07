// Backup & sync: the real worker.js runs in Node with an in-memory KV, and the browser's sync requests are routed to it.
// Two browser contexts play two devices (e.g. the iPhone and the Duo).
const path=require('path'),fs=require('fs'),os=require('os'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)}};
  let env={APP_TOKEN:'secret',WARDROBE:KV};
  const HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  const sync=p=>p.evaluate(()=>syncNow());
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
  ok((await names(B.p))==='','a deletion on A reaches B (and stays deleted)');
  // both devices edit while out of touch, then sync: nothing is lost
  await add(A.p,{type:'shirt',primaryColor:'white'});await add(B.p,{type:'belt',primaryColor:'black'});
  await sync(A.p);await sync(B.p);await sync(A.p);
  ok((await names(A.p))==='belt:black,shirt:white'&&(await names(B.p))==='belt:black,shirt:white','offline edits on both devices merge');
  // the merged state survives a reload (it was written to IndexedDB)
  await B.p.reload();await B.p.waitForTimeout(800);
  ok((await names(B.p))==='belt:black,shirt:white','synced wardrobe persists on the device');
  // the screen refreshes after a sync brings new items
  await add(A.p,{type:'suit',primaryColor:'navy'});await sync(A.p);await B.p.click('#n-wardrobe');await sync(B.p);
  ok((await B.p.textContent('#wardrobe')).includes('Suit'),'the open screen refreshes when synced items arrive');

  // misconfiguration messages
  env={APP_TOKEN:'secret'};await sync(A.p);
  ok((await A.p.evaluate(()=>localStorage.getItem('sync_status')))?.includes('WARDROBE'),'missing KV binding: tells you to add WARDROBE');
  env={WARDROBE:KV};await sync(A.p);
  ok((await A.p.evaluate(()=>localStorage.getItem('sync_status')))?.includes('APP_TOKEN'),'no APP_TOKEN on the worker: backups refused, tells you why');
  env={APP_TOKEN:'secret',WARDROBE:KV};await A.p.evaluate(()=>localStorage.setItem('app_token','wrong'));await sync(A.p);
  ok((await A.p.evaluate(()=>localStorage.getItem('sync_status')))?.includes('forbidden'),'wrong token is refused');
  await A.p.evaluate(()=>localStorage.setItem('app_token','secret'));

  // backup file round trip onto a fresh device with sync off
  const file=path.join(os.tmpdir(),'dw-backup-test.json');
  const data=await A.p.evaluate(async()=>JSON.stringify({app:'daily-wardrobe',version:1,...await localState()}));fs.writeFileSync(file,data);
  const C=await browser.newContext();const cp=await C.newPage();cp.on('dialog',d=>d.accept());await cp.goto(url);await cp.waitForFunction(()=>window.appReady);
  await cp.evaluate(()=>openSettings());await cp.setInputFiles('#settings-modal input[type=file]',file);await cp.waitForTimeout(600);
  ok((await names(cp))===(await names(A.p))&&(await names(cp)).length>0,'Download backup → Restore file reproduces the wardrobe on a new device');
  fs.unlinkSync(file);

  // worker: a stale save is rejected so devices never overwrite each other
  const rev=JSON.parse(store.get('wardrobe:v1')).rev;
  const res=await worker.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:rev-1,data:{items:[]}})}),env);
  ok(res.status===409&&JSON.parse(store.get('wardrobe:v1')).rev===rev,'worker rejects a save based on an old revision (409)');
  ok(A.errs.length===0&&B.errs.length===0,'no page errors on either device');
  await browser.close();
};
