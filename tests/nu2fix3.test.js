// The re-audit's import and sample findings (2026-11-15, fix round 2, Fixer 3): Remove the sample keeps each day's record (N2), the import
// doesn't count sample pieces as his (N5), the sample is never backed up (N7, through the real worker.js in Node), a stale second tab doesn't
// load a second sample, the sample from the setup's last step finishes the setup only once stored, a sample piece taken out of rotation
// stays a sample piece, and the import's words (own colours and patterns, metals, several colours in a cell, more type and colour words),
// the arrow keys in the import sheet and "Take them out" (pieces changed since stay, offered for a week).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
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
      await applyMerged(mergeState(local,rollBackState(local,snap,Date.now()+60000)),local);   // a roll back restamps every piece
      const after=items.filter(i=>i.sample),mine0=after.filter(kitEdited).length;
      const pz=S('belt')[0];openItem(pz.id);await togglePause(pz.id);const paused=kitEdited(items.find(i=>i.id===pz.id));
      const ed=S('socks')[0];openItem(ed.id);await sete(ed.id,'primaryColor','charcoal');const edited=kitEdited(items.find(i=>i.id===ed.id));closeItem();
      const nm=S('suit')[0];await setItemField(nm.id,'name','My suit');   // (typed text saved after the sheet closed)
      return {n:after.length,mine:mine0,arrived:!items.find(i=>i.id===arr.id).paused,fixUp:kitEdited(items.find(i=>i.id===fix.id)),
        share:syncShare({items,days:[]}).items.filter(i=>i.sample).map(i=>i.type).sort().join(),paused,edited,named:kitEdited(items.find(i=>i.id===nm.id))}});
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
      window.kitHold=new Promise(r=>window.kitGo2=r);const K=kitStore;kitStore=async(...a)=>{await kitHold;return K(...a)}});
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
module.exports.realPlanner=true;   // (the real planner: a removed sample's days are planned, or not, by planner.js)
