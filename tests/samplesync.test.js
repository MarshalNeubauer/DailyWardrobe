// Fix round 3 (2026-11-16), the sample: pieces the earlier rule counted as his stay his after the update (W1-3-01, kitSampleMigrate),
// days naming a sample piece go up with the sample taken out (W1-3-02, W1-3-03, kit.js kitShareFilter), Remove the sample never replaces
// another phone's real record of a day (W1-6-04, KIT_YIELD) and has an Undo, and the server hands out and keeps no sample piece (W1-3-04,
// worker/backup.js sampleOnly). The two-phone parts run the real worker.js in Node.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  const open=async(ctx0)=>{const ctx=ctx0||await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(typeof setupClose==='function'&&document.querySelector('#setup.on'))setupClose()});return p};
  const pastDays=n=>`(()=>{const T=todayDate(),o=[];for(let g=1;o.length<${n}&&g<30;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()-g);if(isWorkday(d))o.push(key(d))}return o})()`;
  try{
    /* ---- W1-3-01: the earlier rule's pieces become his, once, after the first pull ---- */
    const p=await open();
    await p.evaluate(async()=>{const cut=KIT_MINE_CUT,mk=(t,c,added,updated,x={})=>({...kitItem({type:t,primaryColor:c,pattern:'solid',sample:true}),added,updated,...x});
      const l=[mk('suit','navy',cut-5*864e5,cut-5*864e5+60000,{name:'My navy suit'}),mk('tie','burgundy',cut-5*864e5,cut-5*864e5+1000),
        mk('shirt','pink',cut+3600e3,cut+3600e3+60000),mk('shoes','brown',cut-5*864e5,cut-4*864e5,{sampleBase:cut-4*864e5+1000})];
      await kitTx(['items'],t=>{const s=t.objectStore('items');for(const it of l)s.put(it)});localStorage.removeItem('kit_mine')});
    await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.waitForFunction(()=>localStorage.getItem('kit_mine')==='1',null,{timeout:8000}).catch(()=>{});
    const mg=await p.evaluate(async()=>{const st=await tx('readonly',s=>s.getAll()),by=t=>st.find(i=>i.type===t);
      const his=i=>!i.sample;
      return {suit:his(by('suit')),tie:his(by('tie')),shirt:his(by('shirt')),shoes:his(by('shoes')),mem:items.filter(his).map(i=>i.type).join(),
        restamped:by('suit').updated>KIT_MINE_CUT,flag:localStorage.getItem('kit_mine'),toast:document.querySelector('#toast').textContent}});
    ok(mg.suit&&!mg.tie&&!mg.shirt&&!mg.shoes&&mg.mem==='suit'&&mg.restamped&&mg.flag==='1',`a sample piece the earlier rule counted as his (stamped over 3 s after it was added, before the rule changed) is his after the update, with a new stamp; an untouched one, one loaded after the change and one stamped only at its sampleBase are not (${JSON.stringify(mg)})`);
    ok(/sample piece you changed is yours/.test(mg.toast),'it says so: '+mg.toast);
    const again=await p.evaluate(async()=>{const it=items.find(i=>i.type==='tie');it.updated=it.added+60000;await kitSampleMigrate();return !items.find(i=>i.type==='tie').sample});
    ok(!again,'it runs once per phone (kit_mine)');
    await p.evaluate(async()=>{await kitDelMany(items.map(i=>i.id))});
    /* ---- W1-3-02: what goes up ---- */
    const sh=await p.evaluate(async(pd)=>{const share=(s,r)=>kitShareFilter(s,r||null,syncJoinAt()),past=eval(pd),T=todayDate(),tk=key(T),fut=new Date(T.getFullYear(),T.getMonth(),T.getDate()+3);
      const S=kitItem({type:'suit',primaryColor:'navy',pattern:'solid',sample:true}),M=kitItem({type:'tie',primaryColor:'green',pattern:'solid',sample:true}),O=kitItem({type:'shirt',primaryColor:'white',pattern:'solid'});M.sampleMine=1;
      const days=[{date:past[0],ids:{top:S.id,shirt:O.id,tie:M.id},worn:false,updated:5},{date:past[1],ids:{top:S.id},updated:6},{date:tk,ids:{top:S.id,shirt:O.id},updated:7},
        {date:key(fut),lock:{top:S.id,shirt:O.id},lockOnly:1,base:0,updated:8},{date:past[2],noOutfit:1,updated:KIT_YIELD},{date:past[3],ids:{top:O.id},updated:9},
        {date:past[4],ids:{top:S.id},worn:false,updated:20},{date:past[5],ids:{top:S.id},worn:false,updated:4},{date:past[6],ids:{top:S.id},updated:25}];
      const st={items:[S,M,O],days,tombstones:{},settings:null},a=share(st),b=share(st,{days:[{date:past[1],ids:{top:'theirs'},updated:3},{date:past[2],ids:{top:'theirs2'},updated:2}]});
      localStorage.setItem('app_token','tok123456');localStorage.setItem('sync_join',JSON.stringify({k:'123456',at:10}));const c=share(st);
      localStorage.removeItem('app_token');localStorage.removeItem('sync_join');
      share(st);kitShareDone();const again1=!!share(st).days.find(d=>d.date===tk);days[2]={...days[2],ids:{...days[2].ids,shoes:S.id},updated:30};const again2=!!share(st).days.find(d=>d.date===tk);
      days[2]={...days[2],worn:false,updated:31};const again3=!!share(st).days.find(d=>d.date===tk);localStorage.removeItem('sync_sd');kitSdNew={};
      const D=(s,k)=>s.days.find(d=>d.date===k);
      return {items:a.items.map(i=>i.type).sort().join(),d0:D(a,past[0]),d1:!!D(a,past[1]),today:D(a,tk),fut:!!D(a,key(fut)),y:!!D(a,past[2]),own:D(a,past[3])===days[5],
        said:D(c,past[4]),yc:D(c,past[6]),ya:!!D(a,past[6]),before:!!D(c,past[5]),saidA:!!D(a,past[4]),again:[again1,again2,again3],
        put1:D(b,past[1])&&D(b,past[1]).ids.top,put2:D(b,past[2])&&D(b,past[2]).ids.top,local:JSON.stringify(days[0].ids),S:S.id,O:O.id,M:M.id}},pastDays(7));
    ok(sh.items==='shirt,tie','the sample piece he hasn\'t made his stays on the phone; his own and the one he made his go up: '+sh.items);
    ok(sh.d0&&sh.d0.worn===false&&sh.d0.ids.shirt===sh.O&&sh.d0.ids.tie===sh.M&&sh.d0.ids.top===null&&sh.d0.gone&&sh.d0.gone.top&&sh.d0.updated===5,`a past day with a sample piece goes up with that piece taken out, its "Didn't" and his pieces kept, same stamp (${JSON.stringify(sh.d0)})`);
    ok(sh.today&&sh.today.ids&&sh.today.ids.shirt===sh.O&&sh.today.ids.top===null,`today goes up with his pieces (so a phone joining isn't told he didn't open the app) (${JSON.stringify(sh.today)})`);
    ok(!sh.d1&&!sh.fut&&!sh.y&&sh.own,'a day made only from the sample, a coming day locked to it and a day Remove the sample left to yield stay on the phone; a day without the sample goes as it is');
    ok(sh.said&&sh.said.noOutfit&&sh.said.worn===false&&!sh.said.ids&&!sh.before&&!sh.saidA,`a "Didn't" on a day of sample pieces alone, made after the phone joined the account, goes up with no outfit; one from before it joined (or with no account) doesn't (${JSON.stringify(sh.said)})`);
    ok(sh.yc&&sh.yc.noOutfit&&sh.yc.updated===1&&!sh.yc.ids&&!sh.ya,`a day he opened the app on after joining, dressed only from the sample, goes up with no outfit and the stamp 1: it fills a gap but never replaces a real record (${JSON.stringify(sh.yc)})`);
    ok(sh.again.join()==='false,false,true',`today goes up once per change he made on it, not again for the app's own re-recording (a phone with the sample and one without re-locked each other's copy at every sync) (${sh.again})`);
    ok(sh.put1==='theirs'&&sh.put2==='theirs2','a whole-backup save keeps the backup\'s own copy of a day it leaves out (a PUT replaces the whole backup)');
    ok(/"top":"/.test(sh.local),'this phone\'s own copy is unchanged');
    /* ---- Remove the sample: days of the sample alone yield; Undo puts everything back ---- */
    const rm0=await p.evaluate(async(pd)=>{const past=eval(pd);await kitSampleLoad();const own=kitItem({type:'shirt',primaryColor:'pink',pattern:'solid'});await kitStore([own]);
      const s=items.filter(i=>i.sample),suit=s.find(i=>i.type==='suit'),tie=s.find(i=>i.type==='tie');
      await saveDay({date:past[0],ids:{top:suit.id,tie:tie.id},suitDay:true,worn:false});
      await saveDay({date:past[1],ids:{top:suit.id,shirt:own.id},suitDay:true});
      await new Promise(r=>setTimeout(r,900));   // (the missed-day toast of the days the sample filled when it was loaded, before Remove's)
      return {past,n:items.length,u0:dayRecs[past[0]].updated,r0:JSON.stringify(dayRecs[past[0]]),r1:JSON.stringify(dayRecs[past[1]])}},pastDays(2));
    await p.evaluate(()=>{kitSampleRemove()});await p.waitForSelector('#ask-sheet.on');await p.click('#ask-ok');await p.waitForFunction(()=>!kitSampling&&!items.some(i=>i.sample));
    await p.waitForTimeout(300);
    const rm1=await p.evaluate(({past})=>({n:items.length,d0:dayRecs[past[0]],d1:dayRecs[past[1]],toast:document.querySelector('#toast').textContent,undo:!!document.querySelector('#toast button')}),rm0);
    ok(rm1.n===1&&rm1.d0.noOutfit&&rm1.d0.updated===1&&rm1.d1.updated>rm0.u0&&rm1.d1.ids.shirt,`Remove the sample: a day of sample pieces alone keeps no outfit with the stamp 1, so the account's own record of it wins; a day with his shirt takes a new stamp (${JSON.stringify({d0:rm1.d0,d1:rm1.d1&&rm1.d1.updated})})`);
    ok(/sample wardrobe is gone/.test(rm1.toast)&&rm1.undo&&/Undo/.test(rm1.toast),'the toast offers Undo: '+rm1.toast);
    await p.click('#toast button');await p.waitForFunction(()=>items.some(i=>i.sample)&&!kitSampling);
    const un=await p.evaluate(async({past})=>{const st=await tx('readonly',s=>s.getAll()),dd=await txs('days','readonly',s=>s.getAll());
      return {n:items.length,stored:st.length,r0:JSON.stringify(dayRecs[past[0]]),d1:dayRecs[past[1]],disk0:JSON.stringify(dd.find(d=>d.date===past[0])),toast:document.querySelector('#toast').textContent}},rm0);
    ok(un.n===rm0.n&&un.stored===rm0.n&&un.r0===rm0.r0&&un.disk0===rm0.r0&&un.d1.ids.top&&un.d1.updated>rm0.u0,`Undo brings the ${rm0.n-1} sample pieces back and each day as it was (the sample-only day with its old stamp, it never went up) (${un.n}, ${un.stored})`);
    ok(/sample wardrobe is back/.test(un.toast),'and says so: '+un.toast);
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    /* ---- W1-6-04 and W1-3-04 through the real worker ---- */
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
    const store=new Map(),meta=new Map();
    const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
      put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
    const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
    const wf=(u,o)=>worker.fetch(new Request(HOST+u,{...o,headers:{'x-app-token':'secret','content-type':'application/json',...(o&&o.headers||{})}}),env);
    const device=async(connect)=>{const c=await browser.newContext({timezoneId:'Asia/Kuwait'});
      await c.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());if(u.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
        const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const d=await c.newPage();d.errs=[];d.on('pageerror',e=>d.errs.push(e.message));await d.goto(url);
      if(connect){await d.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await d.reload()}
      await d.waitForFunction(()=>window.appReady);await d.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose()});return d};
    const serverData=async()=>{const j=await (await wf('sync')).json();return j.data||{items:[],days:[]}};
    // A: his own pieces and a "Didn't" on a past day, backed up
    const A=await device(true);
    const a=await A.evaluate(async(pd)=>{const k=eval(pd)[0];await syncNow();const l=['suit','shirt','tie'].map(t=>kitItem({type:t,primaryColor:'charcoal',pattern:'solid'}));await kitStore(l);
      await saveDay({date:k,ids:{top:l[0].id,bot:l[0].id,shirt:l[1].id,tie:l[2].id},suitDay:true,worn:false});await syncNow();return {k,top:l[0].id}},pastDays(1));
    // B: tried the sample before joining; its record of that day (sample pieces, newer) stays on B
    const B=await device(false);
    await B.evaluate(async(k)=>{await kitSampleLoad();const s=items.filter(i=>i.sample);await saveDay({date:k,ids:{top:s.find(i=>i.type==='suit').id,shirt:s.find(i=>i.type==='shirt').id},suitDay:true})},a.k);
    await B.evaluate(async h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret');await syncNow()},HOST);
    const j1=await serverData(),s1=(j1.days||[]).find(d=>d.date===a.k);
    ok(s1&&s1.worn===false&&s1.ids.top===a.top&&!j1.items.some(i=>i.sample),`B joined: the server keeps A's record of the day (B's sample day stays on B) and no sample piece (${JSON.stringify(s1&&s1.ids)})`);
    await B.evaluate(()=>{kitSampleRemove()});await B.waitForSelector('#ask-sheet.on');await B.click('#ask-ok');await B.waitForFunction(()=>!kitSampling&&!items.some(i=>i.sample),null,{timeout:15000});
    await B.evaluate(()=>syncNow());await A.evaluate(()=>syncNow());
    const j2=await serverData(),s2=(j2.days||[]).find(d=>d.date===a.k);
    const bd=await B.evaluate(k=>dayRecs[k],a.k),ad=await A.evaluate(k=>dayRecs[k],a.k);
    ok(s2&&s2.worn===false&&s2.ids.top===a.top&&!s2.noOutfit,`Remove the sample on B leaves A's record of that day on the server (${JSON.stringify(s2)})`);
    ok(bd&&bd.worn===false&&bd.ids&&bd.ids.top===a.top&&ad&&ad.worn===false&&ad.ids.top===a.top,`B now holds the account's record of that day, and A keeps its own (${JSON.stringify({b:bd&&bd.ids,a:ad&&ad.ids})})`);
    ok(!A.errs.length&&!B.errs.length,'no page errors: '+[...A.errs,...B.errs].join(' | '));
    await A.context().close();await B.context().close();
    /* ---- W1-3-04: a backup from before the rule holds the sample: never handed out, dropped at the next save ---- */
    store.clear();meta.clear();
    const it=(id,x)=>({id,type:'tie',primaryColor:'navy',pattern:'solid',added:1000,updated:2000,...x});
    // the old app's whole backup (PUT) with the sample in it
    const pu=await wf('sync',{method:'PUT',body:JSON.stringify({baseRev:0,day:'2026-11-08',data:{items:[it('own1'),it('mine1',{sample:true,sampleMine:1}),it('samp1',{sample:true}),it('samp2',{sample:true})],days:[],tombstones:{},settings:null}})});
    const key=[...store.keys()].find(k=>/wardrobe:v1$/.test(k));
    let r=await (await wf('sync?lite=1')).json();
    ok(pu.ok&&/samp1/.test(String(store.get(key))),'(the backup from before the rule holds the sample)');
    ok(r.items.map(i=>i.id).sort().join()==='mine1,own1'&&!('samp1' in r.idx.i),'the small sync never hands out a sample piece he hasn\'t made his (a phone joining gets his own pieces only): '+r.items.map(i=>i.id).join());
    await wf('sync',{method:'POST',body:JSON.stringify({baseRev:r.rev,baseSaved:r.saved,day:'2026-11-08',delta:{items:[it('own2',{updated:3000})],days:[],tombstones:{}},photos:{}})});
    const txt=String(store.get(key)),ids=['own1','own2','mine1','samp1','samp2'].filter(x=>txt.includes('"'+x+'"')).join();
    ok(ids==='own1,own2,mine1','the next save drops them from the backup: '+ids);
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
