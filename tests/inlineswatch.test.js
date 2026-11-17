// Option A for the server's writes (2026-11-15, the owner's choice): a new item's 128 px swatch is a small JPEG kept inline in the backup
// (sync.js / worker/backup.js PH_MIN 16384), so an item costs one KV write less; records from before (a PNG swatch stored as its own ph:
// value and referenced as dwph:<hash>, sent by an older app) stay readable and are still taken. The real worker.js in Node, this app in
// Chromium; an older app's save is played by posting what it sends.
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  let worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map(),writes=[];
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{writes.push(k);store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const pic=(n,t='jpeg')=>`data:image/${t};base64,`+crypto.randomBytes(Math.round(n*3/4)).toString('base64');
  const hashOf=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,20);
  const T0=Date.now()-86400000,oldSw=pic(5000,'png'),photos=[0,1,2].map(()=>pic(40e3));
  // an older app's first save (PH_MIN was 256): every data string by reference, the small PNG swatch too, sent in photos
  {const items=[0,1,2].map(i=>({id:'it'+i,type:'suit',primaryColor:'navy',pattern:'solid',added:T0+i,photo:'dwph:'+hashOf(photos[i]),swatch:'dwph:'+hashOf(oldSw),swSrc:'tex'}));
    const body={baseRev:0,day:'2026-11-14',delta:{items,days:[],tombstones:{},settings:null},photos:Object.fromEntries([...photos,oldSw].map(s=>[hashOf(s),s]))};
    const r=await worker.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify(body)}),env);
    ok(r.status===200&&store.has('ph:'+hashOf(oldSw))&&store.get('wardrobe:v1').includes('dwph:'+hashOf(oldSw)),`an older app's save with a small PNG swatch by reference is taken and stored as before (${r.status})`);}
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request(),u=new URL(r.url());
      if(u.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {p,errs}};
  const itemOf=(d,id)=>d.p.evaluate(id=>items.find(i=>i.id===id)||null,id);
  const stored=()=>JSON.parse(store.get('wardrobe:v1'));
  try{
    const A=await device();
    ok(await A.p.evaluate(()=>syncNow())&&(await itemOf(A,'it1')).swatch===oldSw&&(await itemOf(A,'it1')).photo===photos[1],'this app reads the old record: the referenced PNG swatch (under the new PH_MIN) comes back whole');
    await A.p.evaluate(()=>syncNow());
    // an edit of an old item: its PNG swatch now rides inline; nothing is written but the backup (and the day's copy)
    writes.length=0;
    await A.p.evaluate(async()=>{const it={...items.find(i=>i.id==='it0'),primaryColor:'charcoal'};await put(it);items=items.map(i=>i.id==='it0'?it:i)});
    ok(await A.p.evaluate(()=>syncNow())&&!writes.some(k=>k.startsWith('ph:'))&&stored().data.items.find(i=>i.id==='it0').swatch===oldSw&&store.has('ph:'+hashOf(oldSw)),
      `an edited old item goes up with no photo written (${writes.join(', ')}); its swatch is inline, the old value stays for the clean-up`);
    // a new item: the swatch is cut as a JPEG of a few KB from a real close-up
    const sw=await A.p.evaluate(async()=>{const im=await imgOf('tests/fixtures/blazer-windowpane-closeup.jpg'),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
      const s=cropSwatch(c,1,.5,.5,'#1f2a44');return {s,min:PH_MIN}});
    ok(sw.s.startsWith('data:image/jpeg;base64,')&&sw.s.length<sw.min*.75,`the swatch is a JPEG of ${(sw.s.length/1024).toFixed(1)} KB of text (a PNG was about 38 KB), under PH_MIN (${sw.min})`);
    const np=pic(60e3),nt=pic(70e3);writes.length=0;
    await A.p.evaluate(async([sw,np,nt])=>{const it={id:'new1',type:'suit',primaryColor:'grey',pattern:'solid',added:Date.now(),photo:np,texture:nt,swatch:sw,swSrc:'tex'};await put(it);items=[...items,it]},[sw.s,np,nt]);
    ok(await A.p.evaluate(()=>syncNow())&&writes.filter(k=>k.startsWith('ph:')).length===2&&stored().data.items.find(i=>i.id==='new1').swatch===sw.s&&!store.has('ph:'+hashOf(sw.s)),
      `a new item with a photo and a close-up writes 2 photos and the backup (${writes.join(', ')}), its swatch inline: one write less than before`);
    // another device takes both, the old reference and the inline swatch
    const B=await device();
    ok(await B.p.evaluate(()=>syncNow())&&(await itemOf(B,'new1')).swatch===sw.s&&(await itemOf(B,'it2')).swatch===oldSw&&(await itemOf(B,'new1')).photo===np,'another device gets the inline swatch and the old referenced one');
    // the full backup an older app downloads has both inline
    const full=JSON.parse(await (await worker.fetch(new Request(HOST+'sync',{headers:{'x-app-token':'secret'}}),env)).text());
    ok(full.data.items.find(i=>i.id==='it2').swatch===oldSw&&full.data.items.find(i=>i.id==='new1').swatch===sw.s,'an older app\'s whole download carries both swatches inline');
    // the worker from before (this worker with PH_MIN 256, as main had it), as between the app's deploy and the worker's: it splits the
    // inline swatch out itself, so the save goes through (no 400 missing) and another device still gets it
    {const fs=require('fs'),os=require('os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-ph256-'));fs.mkdirSync(path.join(dir,'worker'));
      fs.copyFileSync(path.join(ROOT,'worker.js'),path.join(dir,'worker.js'));fs.copyFileSync(path.join(ROOT,'merge.js'),path.join(dir,'merge.js'));   // (the merge rules it imports)
      for(const n of fs.readdirSync(path.join(ROOT,'worker')))if(n.endsWith('.js')){let s=fs.readFileSync(path.join(ROOT,'worker',n),'utf8');if(n==='backup.js')s=s.replace('const PH_MIN = 16384,','const PH_MIN = 256,');fs.writeFileSync(path.join(dir,'worker',n),s)}
      ok(/const PH_MIN = 256,/.test(fs.readFileSync(path.join(dir,'worker','backup.js'),'utf8')),'(the worker from before: PH_MIN 256)');
      const Old=(await import(pathToFileURL(path.join(dir,'worker.js')).href)).default;const cur=worker;worker=Old;
      const sw2=sw.s.replace(/.$/,c=>c==='A'?'B':'A'),np2=pic(50e3);writes.length=0;
      await A.p.evaluate(async([sw,np])=>{const it={id:'new2',type:'shirt',primaryColor:'white',pattern:'solid',added:Date.now(),photo:np,swatch:sw,swSrc:'photo'};await put(it);items=[...items,it]},[sw2,np2]);
      const okA=await A.p.evaluate(()=>syncNow()),st=await A.p.evaluate(()=>localStorage.getItem('sync_status'));
      const C=await device();const okC=await C.p.evaluate(()=>syncNow());const got=await itemOf(C,'new2');worker=cur;try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
      ok(okA&&!st&&store.has('ph:'+hashOf(sw2))&&okC&&got&&got.swatch===sw2&&got.photo===np2,`against the worker from before, a new inline swatch is saved (stored separately by it, as before) and read back on another device (${writes.join(', ')})`);}
    ok([A,B].every(d=>!d.errs.length),'no page errors ('+[A,B].flatMap(d=>d.errs).join('; ')+')');
  }finally{await browser.close()}
};
