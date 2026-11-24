// The sample wardrobe: loading, syncing, removing it, with the real planner.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url');

/* ---- was tests/samplesync.test.js ---- */
// Fix round 3 (2026-11-16), the sample: pieces the earlier rule counted as his stay his after the update (W1-3-01, kitSampleMigrate),
// days naming a sample piece go up with the sample taken out (W1-3-02, W1-3-03, kit.js kitShareFilter), Remove the sample never replaces
// another phone's real record of a day (W1-6-04, KIT_YIELD) and has an Undo, and the server hands out and keeps no sample piece (W1-3-04,
// worker/backup.js sampleOnly). The two-phone parts run the real worker.js in Node.
const samplesync=async({ok,chromium,url,ROOT})=>{
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
      const Su=kitItem({type:'suit',primaryColor:'navy',pattern:'solid',sample:true}),M=kitItem({type:'tie',primaryColor:'green',pattern:'solid',sample:true}),O=kitItem({type:'shirt',primaryColor:'white',pattern:'solid'});M.sampleMine=1;
      const days=[{date:past[0],ids:{top:Su.id,shirt:O.id,tie:M.id},worn:false,updated:5},{date:past[1],ids:{top:Su.id},updated:6},{date:tk,ids:{top:Su.id,shirt:O.id},updated:7},
        {date:key(fut),lock:{top:Su.id,shirt:O.id},lockOnly:1,base:0,updated:8},{date:past[2],noOutfit:1,updated:KIT_YIELD},{date:past[3],ids:{top:O.id},updated:9},
        {date:past[4],ids:{top:Su.id},worn:false,updated:20},{date:past[5],ids:{top:Su.id},worn:false,updated:4},{date:past[6],ids:{top:Su.id},updated:25}];
      const st={items:[Su,M,O],days,tombstones:{},settings:null},a=share(st),b=share(st,{days:[{date:past[1],ids:{top:'theirs'},updated:3},{date:past[2],ids:{top:'theirs2'},updated:2}]});
      localStorage.setItem('app_token','tok123456');localStorage.setItem('sync_join',JSON.stringify({k:'123456',at:10}));const c=share(st);
      localStorage.removeItem('app_token');localStorage.removeItem('sync_join');
      share(st);kitShareDone();const again1=!!share(st).days.find(d=>d.date===tk);days[2]={...days[2],ids:{...days[2].ids,shoes:Su.id},updated:30};const again2=!!share(st).days.find(d=>d.date===tk);
      days[2]={...days[2],worn:false,updated:31};const again3=!!share(st).days.find(d=>d.date===tk);localStorage.removeItem('sync_sd');kitSdNew={};
      const D=(s,k)=>s.days.find(d=>d.date===k);
      return {items:a.items.map(i=>i.type).sort().join(),d0:D(a,past[0]),d1:!!D(a,past[1]),today:D(a,tk),fut:!!D(a,key(fut)),y:!!D(a,past[2]),own:D(a,past[3])===days[5],
        said:D(c,past[4]),yc:D(c,past[6]),ya:!!D(a,past[6]),before:!!D(c,past[5]),saidA:!!D(a,past[4]),again:[again1,again2,again3],
        put1:D(b,past[1])&&D(b,past[1]).ids.top,put2:D(b,past[2])&&D(b,past[2]).ids.top,local:JSON.stringify(days[0].ids),S:Su.id,O:O.id,M:M.id}},pastDays(7));
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

/* ---- was tests/nu2fix3.test.js ---- */
// The re-audit's import and sample findings (2026-11-15, fix round 2, Fixer 3): Remove the sample keeps each day's record (N2), the import
// doesn't count sample pieces as his (N5), the sample is never backed up (N7, through the real worker.js in Node), a stale second tab doesn't
// load a second sample, the sample from the setup's last step finishes the setup only once stored, a sample piece taken out of rotation
// stays a sample piece, and the import's words (own colours and patterns, metals, several colours in a cell, more type and colour words),
// the arrow keys in the import sheet and "Take them out" (pieces changed since stay, offered for a week).
const nu2fix3=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  const open=async(ctx0)=>{const ctx=ctx0||await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(typeof setupClose==='function'&&document.querySelector('#setup.on'))setupClose()});return p};
  try{
    /* ---- N2: Remove the sample keeps each day's record ---- */
    const p=await open();
    const set=await p.evaluate(async()=>{await kitSampleLoad();if(typeof recordRun!=='undefined')await recordRun;await new Promise(r=>setTimeout(r,400));if(typeof recordRun!=='undefined')await recordRun;const T=todayDate(),past=[];
      for(let g=1;past.length<3&&g<20;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()-g);if(isWorkday(d))past.push(key(d))}
      const own=kitItem({type:'shirt',primaryColor:'pink',pattern:'solid'});own.added=Date.now()-40*864e5;await kitStore([own]);
      const s=items.filter(i=>i.sample),suit=s.find(i=>i.type==='suit'),tie=s.find(i=>i.type==='tie'),sh=s.find(i=>i.type==='shirt'),shoes=s.find(i=>i.type==='shoes');
      for(const i of s)i.added=i.updated=Date.now()-40*864e5;   // (as if loaded weeks ago)
      await saveDay({date:past[0],ids:{top:suit.id,shirt:own.id,tie:tie.id,shoes:s.filter(i=>i.type==='shoes')[1].id},suitDay:true,worn:false});   // "Didn't", with his own shirt
      await saveDay({date:past[1],ids:{top:suit.id,shirt:sh.id,tie:tie.id},suitDay:true,edited:true,worn:true});   // only sample pieces
      await saveDay({date:past[2],ids:{top:suit.id,shirt:own.id},suitDay:true});   // worn (no mark), his own shirt
      await saveDay({date:key(T),ids:{top:suit.id,shirt:sh.id},lock:{top:suit.id},force:{tie:tie.id},suitDay:true});
      await togglePause(shoes.id);   // out of rotation: still a sample piece
      return {past,own:own.id,shoes:shoes.id,paused:kitEdited(items.find(i=>i.id===shoes.id))}});
    ok(!set.paused,'taking a sample piece out of rotation doesn\'t make it his (kitEdited stays false)');
    await p.evaluate(()=>kitSampleRemove(true));
    await p.evaluate(async()=>{cache={};show('today');renderToday();if(typeof recordRun!=='undefined')await recordRun;await new Promise(r=>setTimeout(r,300));if(typeof recordRun!=='undefined')await recordRun});
    const r=await p.evaluate(({past,own,shoes})=>{const R=k=>dayRecs[k]||{},P=planMonth(+past[1].slice(0,4),+past[1].slice(5,7)-1);
      const f0=planMonth(+past[0].slice(0,4),+past[0].slice(5,7)-1)[past[0]];
      return {n:items.length,shoes:items.some(i=>i.id===shoes),d0:R(past[0]),d1:R(past[1]),d2:R(past[2]),today:R(key(todayDate())),plan1:!!P[past[1]],dbg:P[past[1]]?{fr:P[past[1]].frozen,top:!!P[past[1]].top,rec:dayRecs[past[1]]}:null,
        f0:f0?{gone:f0.gone,worn:f0.worn,hard:rateOutfit(f0).hard}:null,worn:wornDays().map(x=>x.date)}},set);
    ok(r.n===1&&!r.shoes,'the sample goes, the paused sample shoes with it; his own shirt stays');
    ok(r.d0.worn===false&&r.d0.ids&&r.d0.ids.shirt===set.own&&!r.d0.ids.top&&r.d0.gone&&r.d0.gone.top&&r.d0.gone.tie&&!r.d0.auto,`a "Didn't" day keeps its mark and his own shirt; the sample's slots are marked gone (${JSON.stringify(r.d0)})`);
    ok(r.f0&&r.f0.worn===false&&r.f0.gone&&r.f0.gone.top&&!r.f0.hard.includes('Complete outfit'),`that day is rated without the sample's pieces, not as Incomplete (${JSON.stringify(r.f0)})`);
    ok(r.d1.noOutfit&&!r.d1.ids&&r.d1.edited&&!r.plan1,`a day of sample pieces only keeps no outfit and is not filled again from today's plan (${JSON.stringify([r.d1,r.dbg])})`);
    ok(r.d2.ids&&r.d2.ids.shirt===set.own&&r.d2.worn===undefined&&r.worn.includes(set.past[2])&&!r.worn.includes(set.past[1])&&!r.worn.includes(set.past[0]),`Insights counts the day his shirt was worn, not the sample-only day or the "Didn't" day (${r.worn.join(',')})`);
    ok(!Object.values(r.today.lock||{}).some(v=>v&&v!==set.own)&&!r.today.force&&!Object.values(r.today.ids||{}).some(v=>v&&v!==set.own),`today loses its sample lock, pick and pieces and is planned again from what is left (${JSON.stringify(r.today)})`);
    const nd=await p.evaluate(k=>{sel=keyDate(k);renderToday();return {t:(document.querySelector('#nooutfit')||{}).textContent||'',score:!!document.querySelector('#sbox')}},set.past[1]);
    ok(/No outfit recorded/.test(nd.t)&&!nd.score,'Today on that day says no outfit was recorded, with no score: '+nd.t);
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));
    /* ---- N5 and the import's words ---- */
    await p.evaluate(()=>{kitSampleLoad()});await p.click('#ask-ok');await p.waitForFunction(()=>items.length>=25&&!kitSampling);
    const im=await p.evaluate(async()=>{
      settings.custom={colors:[{key:'ownsage',name:'Sage',hex:'#9caf88',base:'green',types:['tie','socks']}],patterns:[]};applyCustom(settings.custom);
      const rows=t=>kitRead(t).rows;const R=t=>rows(t).map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.secondaryColor||'',x.card.tertiaryColor||'',x.card.metal,x.probs.join('/')].join(':'):'bad:'+x.why);
      const dup=rows('Type,Colour,Pattern\nSuit,Navy,Solid\nShirt,White,\nBelt,Black,\nSocks,Navy,\n');kitDupMark(dup);
      return {dup:dup.map(x=>x.on&&!x.dup),
        own:R('Type,Colour\nTie,Sage\nTie,sage\nSocks,Sage\n'),
        metal:R('Type,Colour,Metal\nWatch,Gold,\nWatches,Rose gold,\nCufflinks,Gold,\nWatch,Black,Gold\nBelt,Brown,Gold\nWatch,Silver,\nCufflinks,Gunmetal,\nBelt,Black,Copperish\n'),
        multi:R('Type,Colour,Pattern\nShirt,"light blue, white",Stripe\nShirt,Blue/white,Stripe\nTie,Navy & burgundy & white,Stripe\n'),
        words:R('Type,Colour\nTrouser,Grey\nOxford shirt,White\nShoes - Oxford,Black\nSuit jacket,Navy\nShirt,Mauve\nTie,Fuchsia\n')}});
    ok(im.dup.every(Boolean),'rows matching only sample pieces stay ticked: they aren\'t "already in your wardrobe" '+JSON.stringify(im.dup));
    ok(im.own[0].startsWith('tie:ownsage:')&&im.own[1].startsWith('tie:ownsage:')&&im.own[2].startsWith('socks:ownsage:')&&!/0 isn't/.test(im.own.join()),'an own colour by name is that colour (not "0 isn\'t one of the tie colours") '+im.own.join(' | '));
    ok(im.metal[0].startsWith('watch:gold::')&&im.metal[0].endsWith(':gold:')&&/watch:gold:::gold:“Rose gold” read as gold/.test(im.metal[1])&&im.metal[2].startsWith('cufflinks:gold:::gold')&&/^watch:black:::gold/.test(im.metal[3])&&/^belt:brown:::gold/.test(im.metal[4])&&/^watch:silver:::silver:$/.test(im.metal[5])&&/^cufflinks:silver:::other/.test(im.metal[6])&&/metal “Copperish” left out/.test(im.metal[7]),
      'gold, rose gold and gunmetal watches and cufflinks get their metal, and a Metal column is read: '+im.metal.join(' | '));
    ok(/^shirt:lightblue:white::/.test(im.multi[0])&&/^shirt:blue:white::/.test(im.multi[1])&&/^tie:navy:burgundy:white:/.test(im.multi[2]),'several colours in one cell fill the second and third colours: '+im.multi.join(' | '));
    ok(im.words.map(x=>x.split(':').slice(0,2).join(':')).slice(0,4).join()==='pants:grey,shirt:white,shoes:black,suit:navy'&&!/^bad/.test(im.words[4])&&!/^bad/.test(im.words[5]),'Trouser, Oxford shirt, "Shoes - Oxford", Suit jacket, Mauve and Fuchsia are read: '+im.words.join(' | '));
    /* only his edits in the item sheet make a sample piece his: not a roll back, a start-up fix-up or out of rotation (Fixer 4's review) */
    const mine=await p.evaluate(async()=>{const S=t=>items.filter(i=>i.sample&&i.type===t);
      const fix=S('tie')[0];fix.added=Date.now()-60000;await put(fix);   // a start-up fix-up's save (migrateVests, texSwatches): a new stamp, no item sheet
      const arr=S('shoes')[0];arr.paused=true;arr.order=true;arr.arrives=isoKey(new Date(Date.now()-3*864e5));arr.added=Date.now()-60000;await put(arr);await checkArrivals();
      const local=await localState(),snap={items:local.items.map(i=>({...i})),days:local.days,tombstones:local.tombstones,settings:local.settings};
      await applyMerged(local,rollBackState(local,snap,Date.now()+60000));   // a roll back restamps every piece
      const after=items.filter(i=>i.sample),mine0=after.filter(kitEdited).length;
      const pz=S('belt')[0];openItem(pz.id);await togglePause(pz.id);const paused=kitEdited(items.find(i=>i.id===pz.id));
      const ed=S('socks')[0];openItem(ed.id);await sete(ed.id,'primaryColor','charcoal');const edited=kitEdited(items.find(i=>i.id===ed.id));closeItem();
      const nm=S('suit')[0];await setItemField(nm.id,'name','My suit');   // (typed text saved after the sheet closed)
      return {n:after.length,mine:mine0,arrived:!items.find(i=>i.id===arr.id).paused,fixUp:kitEdited(items.find(i=>i.id===fix.id)),
        share:kitShareFilter({items,days:[]},null,syncJoinAt()).items.filter(i=>i.sample).map(i=>i.type).sort().join(),paused,edited,named:kitEdited(items.find(i=>i.id===nm.id))}});
    ok(mine.n===24&&mine.mine===0&&!mine.fixUp&&mine.arrived,`a start-up fix-up, an arrival and a roll back restamp sample pieces without making them his (${JSON.stringify(mine)})`);
    ok(!mine.paused&&mine.edited&&mine.named&&mine.share==='socks,suit','out of rotation in the item sheet doesn\'t make one his; a colour or name changed there does, and only those are backed up: '+mine.share);
    /* the arrow keys in the import sheet */
    const ar=await p.evaluate(()=>{kitImportOpen();const ta=document.querySelector('#kit-paste');ta.value='Type,Colour\nTie,Navy';kitImportText(ta.value);ta.focus();
      for(const k of ['ArrowRight','ArrowLeft','ArrowRight'])ta.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      return {open:!!document.querySelector('#kitsheet.on'),rows:!!kitImp&&kitImp.rows.length,val:ta.value.length}});
    ok(ar.open&&ar.rows===1&&ar.val>0,'→ and ← in the import sheet (in the paste box or not) keep it open with its rows '+JSON.stringify(ar));
    /* Take them out: a piece changed since stays, and it is offered for a week */
    const to=await p.evaluate(async()=>{kitImportText('Type,Colour,Name\nTie,Green,A\nTie,Red,B\n');await kitImportGo();
      const l=JSON.parse(localStorage.getItem(KIT_IMP_LAST)),b=items.find(i=>i.name==='B');b.name='My red tie';await put(b);b.updated+=10000;   // (changed well after the import)
      const a=kitLastImp();kitImportOpen();const row=(document.querySelector('#kit-last')||{}).textContent||'';
      l.at=Date.now()-8*864e5;localStorage.setItem(KIT_IMP_LAST,JSON.stringify(l));const old=kitLastImp();kitClose();
      return {ids:a&&a.ids.length,kept:a&&a.kept,mine:a&&!a.ids.includes(b.id),row,old}});
    ok(to.ids===1&&to.kept===1&&to.mine&&/1 item in your wardrobe you haven't changed since/.test(to.row),'"Take them out" leaves a piece renamed since: '+JSON.stringify(to));
    ok(to.old===null,'"Take them out" is no longer offered a week after the import');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    /* ---- two tabs: the stale tab doesn't load a second sample ---- */
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});
    const tb=await open(ctx),ta=await open(ctx);
    await ta.evaluate(()=>kitSampleLoad());
    const two=await tb.evaluate(async()=>{const n0=items.length;await kitSampleLoad();const st=await tx('readonly',s=>s.getAll());
      return {n0,mem:items.length,disk:st.length,toast:document.querySelector('#toast').textContent}});
    ok(two.n0===0&&two.mem===24&&two.disk===24&&/already here/.test(two.toast),`a tab opened before the sample was loaded in another doesn't load it again (${JSON.stringify(two)})`);
    await ctx.close();
    /* ---- the sample from the setup's last step: the setup finishes once the sample is stored ---- */
    const s=await open();
    await s.evaluate(()=>{localStorage.setItem('tour_seen','1');setupOpen(false);setup.at=SETUP_STEPS.length-1;setupDraw();
      window.kitHold=new Promise(r=>window.kitGo2=r);const T=IDBDatabase.prototype.transaction;   // (kit.js's writes, the only ones given a list of stores: what waits for them hears it only after kitGo2)
      IDBDatabase.prototype.transaction=function(st,m){const t=T.apply(this,arguments);if(m==='readwrite'&&Array.isArray(st))Object.defineProperty(t,'oncomplete',{configurable:true,set(f){t.addEventListener('complete',e=>kitHold.then(()=>f.call(t,e)))}});return t}});
    await s.click('#setup #kit-sample-link');await s.waitForTimeout(250);
    const mid=await s.evaluate(async()=>{const m=await metaGet('settings');return {shown:setupShown(),done:!!(m&&m.setupDone)}});
    await s.evaluate(()=>kitGo2());await s.waitForFunction(()=>items.length===24&&!kitSampling);
    const end=await s.evaluate(async()=>{await new Promise(r=>setTimeout(r,200));const m=await metaGet('settings');return {shown:setupShown(),done:!!(m&&m.setupDone),vest:settings.vestMode}});
    ok(mid.shown&&!mid.done&&!end.shown&&end.done&&end.vest==='never',`the setup is finished only once the sample is stored (a kill before leaves the setup to finish) ${JSON.stringify({mid,end})}`);
    ok(!s.errs.length,'no page errors: '+s.errs.join(' | '));await s.context().close();
    /* ---- N7: the sample is never backed up (the real worker.js in Node) ---- */
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
    const store=new Map(),meta=new Map();
    const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
      put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
    const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
    const device=async old=>{const c=await browser.newContext({timezoneId:'Asia/Kuwait'});if(old)await c.addInitScript(()=>{window.SYNC_OLD=true});
      await c.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());if(u.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
        const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const d=await c.newPage();d.errs=[];d.on('pageerror',e=>d.errs.push(e.message));await d.goto(url);
      await d.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await d.reload();await d.waitForFunction(()=>window.appReady);
      await d.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose()});return d};
    const serverGet=async()=>{const res=await worker.fetch(new Request(HOST+'sync',{headers:{'x-app-token':'secret'}}),env);const j=await res.json();return j.data||{items:[],days:[]}};
    for(const old of [false,true]){
      const d=await device(old);
      const up=await d.evaluate(async()=>{await syncNow();await kitSampleLoad();const own=kitItem({type:'tie',primaryColor:'navy',pattern:'solid'});await kitStore([own]);const suit=items.find(i=>i.sample&&i.type==='suit'),T=todayDate();let k=null;
        for(let g=1;!k&&g<20;g++){const x=new Date(T.getFullYear(),T.getMonth(),T.getDate()-g);if(isWorkday(x))k=key(x)}
        await saveDay({date:k,ids:{top:suit.id,tie:own.id},suitDay:true,worn:false});const ok1=await syncNow();return {ok1,k,own:own.id,st:localStorage.getItem('sync_status')}});
      const s1=await serverGet();
      const d1=(s1.days||[]).find(x=>x.date===up.k);   // (fix round 3, W1-3-02: the day goes up with the sample's pieces taken out)
      ok(up.ok1&&s1.items.length===1&&!s1.items.some(i=>i.sample)&&d1&&d1.worn===false&&d1.ids.tie===up.own&&!d1.ids.top&&d1.gone&&d1.gone.top,`${old?'an older-style (whole backup) sync':'the small sync'}: the sample stays on the phone, the day naming it goes up without it, with his own tie and its "Didn't" (${s1.items.length} item(s) on the server, ${JSON.stringify(d1)})`);
      const rm=await d.evaluate(async()=>{await kitSampleRemove(true);return syncNow()});
      const s2=await serverGet(),day=(s2.days||[]).find(x=>x.date===up.k);
      ok(rm&&day&&day.worn===false&&day.ids&&day.ids.tie===up.own&&!day.ids.top&&s2.items.length===1,`once the sample is removed, that day goes up with his tie and its "Didn't" (${JSON.stringify(day)})`);
      ok(!d.errs.length,'no page errors: '+d.errs.join(' | '));await d.context().close();
      store.clear();meta.clear()}
  }finally{await browser.close()}
};
// (realPlanner) (the real planner: a removed sample's days are planned, or not, by planner.js)

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['samplesync',samplesync],['nu2fix3',nu2fix3]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
