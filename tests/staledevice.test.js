// A device that is behind must not overwrite newer changes when it starts (2026-11-14: the owner's phone, two days behind, locked the
// week and re-saved 82 items in a one-time photo upgrade before it synced; their newer stamps replaced a pick made on another device,
// 11 newer tags, and brought back 4 deleted items). The real worker.js runs in Node with an in-memory KV; two browser contexts are the
// phone (A, behind) and the other device (B).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    delete:async k=>{store.delete(k);meta.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  let hold=null;   // while set, the phone's sync downloads wait (its start-up runs on its old copy meanwhile)
  const browser=await chromium.launch();
  const device=async held=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      if(held&&hold&&r.method()==='GET'&&new URL(r.url()).pathname==='/sync')await hold.p;
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  try{
    const A=await device(true),B=await device(false);
    // the wardrobe, made on A and synced to B; A's start-up locks the coming workdays
    // (the charcoal suit has a large photo: a start-up fix-up re-saves it, as this morning's photo upgrade did; without the wait for the\n    // first pull its old tag overwrote the other device's fix here)
    const ids=await A.p.evaluate(async()=>{const I=(type,primaryColor,x={})=>({id:crypto.randomUUID(),type,primaryColor,pattern:'solid',added:Date.now(),...x});
      const c=document.createElement('canvas');c.width=1200;c.height=900;const g=c.getContext('2d');g.fillStyle='#444';g.fillRect(0,0,1200,900);g.fillStyle='#666';for(let x=0;x<1200;x+=20)g.fillRect(x,0,4,900);
      const list=[I('suit','navy',{vest:'yes'}),I('suit','charcoal',{vest:'yes',pattern:'twill',photo:c.toDataURL('image/jpeg',.8)}),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf'}),I('socks','charcoal'),I('suit','grey',{vest:'no'})];
      for(const it of list){await put(it);items.push(it)}cache={};refreshToday();return list.map(i=>i.id)});
    await A.p.waitForFunction(()=>Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate()),null,{timeout:15000});
    await A.p.evaluate(()=>syncNow());await B.p.evaluate(()=>syncNow());
    const day=await B.p.evaluate(()=>Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).map(r=>r.date).sort()[0]);
    ok(!!day&&await A.p.evaluate(d=>dayRecs[d].lockOnly===1&&typeof dayRecs[d].base==='number',day),`the app's lock of a coming day is marked as its own (lockOnly, base) (${day})`);
    // on B: the day pinned to the other suit, a tag fixed, the grey suit deleted
    const pin=await B.p.evaluate(async([d,ids])=>{const r=dayRecs[d],other=r.lock.top===ids[0]?ids[1]:ids[0];await saveDay({...r,force:{top:other,bot:other},kind:'suit',vest:true});
      const it=items.find(i=>i.id===ids[1]);it.pattern='pinstripe';await put(it);await del(ids[9]);items=items.filter(i=>i.id!==ids[9]);await syncNow();return other},[day,ids]);
    // A starts again, still behind: its downloads are held while its start-up runs
    hold={};hold.p=new Promise(r=>hold.go=r);
    const before=await A.p.evaluate(d=>dayRecs[d].updated,day),itemBefore=await A.p.evaluate(id=>{const i=items.find(x=>x.id===id);return [i.updated,!!i.photoSm]},ids[1]);
    await A.p.evaluate(()=>{localStorage.removeItem('tex_swatch2')});   // (a one-time start-up fix-up due again)
    await A.p.reload();await A.p.waitForFunction(()=>window.appReady);await A.p.evaluate(()=>{show('today');refreshToday()});await new Promise(r=>setTimeout(r,1500));
    const during=await A.p.evaluate(async([d,id1])=>{window.__ran=false;whenPulled(()=>{window.__ran=true});await new Promise(r=>setTimeout(r,300));
      const db=await new Promise(ok=>{const q=indexedDB.open('dailywardrobe');q.onsuccess=()=>{try{const t=q.result.transaction('days').objectStore('days').get(d);t.onsuccess=()=>ok(t.result&&t.result.updated)}catch(e){ok('?')}};q.onerror=()=>ok('?')});
      return {ran:window.__ran,updated:dayRecs[d]&&dayRecs[d].updated,db,pulled:pulledYet(),item:(items.find(x=>x.id===id1)||{}).updated}},[day,ids[1]]);
    ok(!during.ran&&!during.pulled&&during.updated===before&&during.item===itemBefore[0],`while the phone hasn't pulled the backup, nothing waiting for it runs, and neither the day nor the suit is re-saved (${JSON.stringify(during)}, before ${before} / ${itemBefore[0]})`);
    hold.go();hold=null;
    await A.p.waitForFunction(()=>pulledYet()&&window.__ran,null,{timeout:15000}).catch(()=>{});
    await A.p.evaluate(()=>syncNow());await new Promise(r=>setTimeout(r,800));await A.p.evaluate(()=>syncNow());
    const kv=await B.p.evaluate(()=>syncNow()).then(()=>B.p.evaluate(([d,ids])=>({force:dayRecs[d]&&dayRecs[d].force&&dayRecs[d].force.top,pat:(items.find(i=>i.id===ids[1])||{}).pattern,grey:items.some(i=>i.id===ids[9])}),[day,ids]));
    const a=await A.p.evaluate(([d,ids])=>({ran:window.__ran,force:dayRecs[d]&&dayRecs[d].force&&dayRecs[d].force.top,top:(planFor()[d]||{}).top&&planFor()[d].top.id,pat:(items.find(i=>i.id===ids[1])||{}).pattern,grey:items.some(i=>i.id===ids[9])}),[day,ids]);
    ok(a.ran&&a.force===pin&&a.top===pin&&a.pat==='pinstripe'&&!a.grey,`once pulled, the phone has the other device's pick, tag and deletion, and plans the picked suit (${JSON.stringify(a)})`);
    ok(kv.force===pin&&kv.pat==='pinstripe'&&!kv.grey,`and after the phone's own sync the backup still has them (${JSON.stringify(kv)})`);
    // the two settle: after a few rounds nothing more is written either way (no lock rewriting back and forth)
    const rev=async()=>(await (await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':'secret'}}),env)).json()).rev;
    for(let k=0;k<3;k++){await A.p.evaluate(()=>syncNow());await B.p.evaluate(()=>syncNow());await new Promise(r=>setTimeout(r,600))}
    const r0=await rev();for(let k=0;k<2;k++){await A.p.evaluate(()=>syncNow());await B.p.evaluate(()=>syncNow());await new Promise(r=>setTimeout(r,600))}
    const same=await Promise.all([A.p,B.p].map(p=>p.evaluate(d=>JSON.stringify({f:dayRecs[d].force,l:dayRecs[d].lock,u:dayRecs[d].updated}),day)));
    ok(await rev()===r0&&same[0]===same[1],`afterwards both devices hold the same day and syncing writes nothing more (rev ${r0} → ${await rev()})`);
    // the merge rule itself (core.js dayWins / mergeState), and the worker's (mergeLite, through a save based on the stored version)
    const m=await A.p.evaluate(()=>{const o={date:'2026-12-01',updated:100,force:{top:'x'}},n1={date:'2026-12-01',updated:200,lock:{top:'y'},lockOnly:1,base:50},n2={...n1,base:150},h={date:'2026-12-01',updated:200,lock:{top:'y'}};
      const pick=(a,b)=>mergeState({days:[a]},{days:[b]}).days[0];return [pick(o,n1)===o,pick(n1,o)===o,pick(o,n2)===n2,pick(o,h)===h]});
    ok(m.join()==='true,true,true,true',`a newer automatic lock loses to an older copy changed after the version it was built on, either way round; one built on that copy, or a hand change, wins (${m})`);
    const st=await (await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':'secret'}}),env)).json();
    const stale={...st.days.find(d=>d.date===day)};delete stale.force;Object.assign(stale,{lock:{top:'zzz'},lockOnly:1,base:1,updated:Date.now()+1000});
    const pr=await worker.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:st.rev,baseSaved:st.saved,day:'2026-11-14',delta:{items:[],days:[stale],tombstones:{}},photos:{}})}),env);
    const after=await (await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':'secret'}}),env)).json(),sd=after.days.find(d=>d.date===day);
    ok(pr.ok&&sd&&sd.force&&sd.force.top===pin&&!(sd.lock&&sd.lock.top==='zzz'),`the server keeps a hand pick when a device sends an automatic lock built on an older copy (${pr.status}, ${JSON.stringify(sd&&{force:sd.force,lock:sd.lock&&sd.lock.top})})`);
    // not connected: nothing waits
    const solo=await browser.newContext();const sp=await solo.newPage();await sp.goto(url);await sp.waitForFunction(()=>window.appReady);
    ok(await sp.evaluate(async()=>{let ran=false;await whenPulled(()=>{ran=true});return ran&&pulledYet()}),'without a server the start-up writers run at once');
    ok(A.errs.length===0&&B.errs.length===0,'no page errors ('+[...A.errs,...B.errs].join('; ')+')');
  }finally{await browser.close()}
};
