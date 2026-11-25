// The phone's clock against the server's (fix round 3, 2026-11-16, the audit's W1-9-01..08, W1-5-07, W2-13-03): stamps by the corrected
// time (core.js nowMs, learned from the worker's x-now header in sync.js clockLearn), a new stamp always above the one it replaces
// (nextStamp), the worker leaving out stamps dated ahead of its clock (worker/backup.js dropFuture) and reading the backup's own with them
// put back (clampStamps), the phone putting its own back once it knows the gap (sync.js clockFix), a roll-back stamped above every mark.
// The rules in Node, then devices with wrong clocks syncing through the real worker with an in-memory KV, as sync.test.js does.
const path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const {appSrc}=require('./appsrc');
module.exports=async({ok,chromium,url,ROOT})=>{
  const YEAR=365*864e5;
  /* ---- the rules ---- */
  {const ls={clock_skew:'60000'};const ctx={console,localStorage:{getItem:k=>k in ls?ls[k]:null,setItem(k,v){ls[k]=String(v)}},document:{querySelector(){return null}}};vm.createContext(ctx);
    vm.runInContext(appSrc(ROOT,'merge.js','core.js')+';this.K={nowMs,nextStamp,stampSettings,keySettings,trueToday}',ctx);
    const K=ctx.K,d=K.nowMs()-Date.now();
    ok(d>=59990&&d<=60010,'nowMs is the phone\'s time corrected by the gap the last sync learned');
    const far=Date.now()+5*YEAR;ok(K.nextStamp(far)===far+1&&K.nextStamp(1000)>=Date.now()+59990,'a new stamp is above the one it replaces, whatever the clock says');
    const s={units:'C',ks:{units:far},kh:{units:'x'},updated:far};K.stampSettings(Object.assign(s,{units:'F'}));
    ok(s.ks.units===far+1&&s.updated>far,'a changed setting is stamped above its stamp before (a setting saved while the clock was ahead can still be changed)');}
  const {clampStamps,dropFuture,mergeLite,CLOCK_AHEAD}=await import(pathToFileURL(path.join(ROOT,'worker','backup.js')).href);
  {const now=Date.now(),fut=now+YEAR;
    const sent={items:[{id:'a',updated:fut},{id:'b',updated:now}],days:[{date:'2026-11-16',updated:fut}],tombstones:{c:9e12,d:now},settings:{updated:fut,ks:{units:fut}}};
    const kept=dropFuture(sent,now+CLOCK_AHEAD);
    ok(kept.items.map(i=>i.id).join()==='b'&&!kept.days.length&&Object.keys(kept.tombstones).join()==='d'&&kept.settings===null,'a save\'s records and deletion marks dated past the server\'s clock are left out');
    const cur={items:[{id:'c',updated:now-5000}],tombstones:{},days:[],settings:null};
    ok(mergeLite(cur,dropFuture({tombstones:{c:9e12}},now+CLOCK_AHEAD)).items.length===1,'deletion marks dated years ahead (someone holding the code) delete nothing');
    const saved=now-1000,st={items:[{id:'e',updated:fut,added:fut}],tombstones:{f:9e12},days:[{date:'x',updated:fut,base:fut}],settings:{updated:fut,ks:{a:fut,b:5}}};
    const cl=clampStamps(st,saved,saved+CLOCK_AHEAD);
    ok(cl.items[0].updated===saved&&cl.items[0].added===saved&&cl.tombstones.f===saved&&cl.days[0].updated===saved&&cl.days[0].base===saved&&cl.settings.updated===saved&&cl.settings.ks.a===saved&&cl.settings.ks.b===5,
      'stamps the backup holds from a wrong clock are read as its save time');
    ok(JSON.stringify(clampStamps(st,saved,saved+CLOCK_AHEAD))===JSON.stringify(cl)&&clampStamps(cur,saved,saved+CLOCK_AHEAD)===cur,'the same on every read, and a backup with none is read as it is');}

  /* ---- devices ---- */
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/',posts=[];
  const browser=await chromium.launch();
  const device=async off=>{const ctx=await browser.newContext();
    if(off)await ctx.addInitScript(o=>{const R=Date;class D extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+o)}static now(){return R.now()+o}}self.Date=D},off);
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      const body=await res.text();if(new URL(r.url()).pathname==='/sync'&&r.method()!=='GET')posts.push(r.method());
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret');localStorage.setItem('tour_done','1')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  const sync=p=>p.evaluate(()=>{clearTimeout(syncTimer);return syncNow()});
  const names=p=>p.evaluate(()=>items.map(i=>i.name||i.id).sort().join(','));
  const kvData=async()=>{const r=await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':'secret'}}),env);return r.json()};
  try{
    const A=await device(0);
    await A.p.evaluate(async()=>{for(const [id,name] of [['s1','Navy suit'],['s2','Pink shirt'],['s3','Grey suit']]){const it={id,name,type:id==='s2'?'shirt':'suit',primaryColor:'navy',pattern:'solid',added:nowMs()};await put(it);items.push(it)}});
    await sync(A.p);
    // a phone a year behind (automatic time off): its rename and deletion are kept and backed up (W1-9-01)
    const B=await device(-YEAR);await sync(B.p);
    const skew=await B.p.evaluate(()=>+localStorage.getItem('clock_skew'));
    ok(Math.abs(skew-YEAR)<60000,'a phone a year behind learns the gap from the server at its first sync');
    const told=await B.p.evaluate(()=>{const t=document.querySelector('#toast');return t?t.innerText:''});
    ok(/clock is 1 year behind/.test(told)&&!/server|worker/i.test(told),'and says once, in plain words, that its clock is wrong and how to fix it');
    await B.p.evaluate(async()=>{const it=items.find(i=>i.id==='s1');it.name='Navy suit EDITED';await put(it);await del('s2');HOOK.items=items.filter(i=>i.id!=='s2')});
    await sync(B.p);await sync(A.p);
    ok((await names(B.p))==='Grey suit,Navy suit EDITED'&&(await names(A.p))==='Grey suit,Navy suit EDITED','its edit and deletion survive the backup, on both phones');
    // the same phone before any server answered this time (its gap not known): the edit still wins over the copy it was made on (nextStamp)
    await B.p.evaluate(async()=>{localStorage.removeItem('clock_skew');HOOK.clockSkew=0;const it=items.find(i=>i.id==='s3');it.name='Grey suit B';await put(it)});
    await sync(B.p);await sync(A.p);
    ok((await names(A.p)).includes('Grey suit B'),'an edit stamped by a clock a year behind still replaces the copy it was made on');
    // two phones minutes apart: the later edit wins (W1-9-08, W1-5-07)
    const C=await device(10*60000);await sync(C.p);
    await C.p.evaluate(async()=>{const it=items.find(i=>i.id==='s3');it.name='Grey (C first)';await put(it)});await sync(C.p);
    await sync(A.p);await A.p.evaluate(async()=>{const it=items.find(i=>i.id==='s3');it.name='Grey (A later)';await put(it)});await sync(A.p);await sync(C.p);
    ok((await names(C.p)).includes('Grey (A later)')&&(await kvData()).items.find(i=>i.id==='s3').name==='Grey (A later)','a phone 10 minutes fast doesn\'t win over a later edit from a phone on time');
    // a crafted save with deletion marks dated years ahead deletes nothing (W2-13-03)
    const lite=await kvData();
    const r=await worker.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:lite.rev,day:'2026-11-16',delta:{items:[],days:[],tombstones:{s1:9e12,s3:9e12}},photos:{}})}),env);
    await sync(A.p);
    ok(r.status===200&&(await names(A.p))==='Grey (A later),Navy suit EDITED'&&!Object.keys((await kvData()).tombstones).some(k=>k!=='s2'),'deletion marks dated years ahead are refused, so the wardrobe stays');
    // a backup holding such marks from before the check: read with them at its save time, and a piece brought back stays (roll back)
    {const cur=await kvData(),saved=Date.now(),rev=cur.rev+1;   // stored as an older worker kept it (no index): its marks unchecked
      store.set('wardrobe:v1',JSON.stringify({rev,saved,data:{items:cur.items,days:[],tombstones:{...cur.tombstones,s1:9e12},settings:null}}));meta.set('wardrobe:v1',{rev,saved});
      const L=await kvData();ok(L.tombstones.s1===saved,'a deletion mark the backup holds dated years ahead is read as the backup\'s save time');
      await sync(A.p);ok(!(await names(A.p)).includes('Navy'),'(so it deletes the piece as of then)');
      await A.p.evaluate(async()=>{const it={id:'s1',name:'Navy back',type:'suit',primaryColor:'navy',pattern:'solid',added:1};await put(it);items.push(it)});
      await sync(A.p);await sync(A.p);
      const K2=await kvData();ok(K2.items.some(i=>i.id==='s1')&&(await names(A.p)).includes('Navy back'),'and a piece brought back after it stays, on the phone and in the backup');}
    // the phone's own stamps from a clock that was ahead are put back once it knows the gap, and uploaded once (no upload at every sync)
    await A.p.evaluate(async()=>{const it=items.find(i=>i.id==='s1');it.name='Navy (ahead)';it.updated=Date.now()+400*864e5;await putRaw(it);
      await addTombstones({ghost:Date.now()+400*864e5})});
    posts.length=0;await sync(A.p);
    const fixed=await A.p.evaluate(async()=>{const s=await localState();return {st:s.items.find(i=>i.id==='s1').updated,t:s.tombstones.ghost}});
    ok(fixed.st<=Date.now()+60000&&fixed.t<=Date.now()+60000,'a phone puts its stamps from a clock that was ahead back to now once a server answered');
    ok((await kvData()).items.find(i=>i.id==='s1').name==='Navy (ahead)','and backs up what was edited then');
    posts.length=0;await sync(A.p);await sync(A.p);
    ok(posts.length===0,'after that a sync with nothing new uploads nothing (no write at every sync)');
    // a pause set while the clock was a year ahead is let go (W1-9-06)
    const pz=await A.p.evaluate(()=>{localStorage.setItem('sync_pause',String(Date.now()+400*864e5));const a=syncPaused();return {a,left:localStorage.getItem('sync_pause')}});
    ok(pz.a===false&&pz.left===null,'a backup pause dated far ahead (set by a clock that was ahead) is let go');
    // a roll-back stamps every restored piece above this phone's deletion mark for it (W2-13-03)
    const rb=await A.p.evaluate(()=>{const n=nowMs(),r=HOOK.rollBackState({items:[{id:'x',updated:n}],tombstones:{y:n+5000},days:[{date:'2026-11-16',updated:n+3000}],settings:null},{items:[{id:'y',updated:1}],days:[{date:'2026-11-16',updated:1}],tombstones:{}},n);
      return {y:r.items[0].updated,yt:n+5000,x:r.tombstones.x,n,d:r.days[0].updated}});
    ok(rb.y>rb.yt&&rb.x>rb.n&&rb.d>rb.n+3000,'a roll-back\'s pieces and days are stamped above the marks and copies they replace');
    // a phone a year ahead records no days that haven't come and locks no week of them (W1-9-03)
    const D=await device(YEAR);await sync(D.p);
    const dd=await D.p.evaluate(async()=>{await recordRun;return Object.keys(dayRecs).filter(k=>k>=String(new Date().getFullYear())).length});
    ok(dd===0,'a phone a year ahead records and locks no future days');
    for(const x of [A,B,C,D])ok(!x.errs.length,'no page errors: '+x.errs.join(' | '));
  }finally{await browser.close()}
};
