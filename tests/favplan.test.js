// Favorites in the planner and in sync (2026-11-18, the owner's approved design; planner.js favLooks/favPick/favDay, merge.js SET_SPLIT
// 'fav'). Three months of the shared realistic test wardrobe from 2 Nov 2026 (today 1 Nov, nothing worn):
// - no favorites (or an empty settings.fav): the plan is the plan without the feature, day by day
// - two favorite looks (jacket, shirt and tie of two planned days) come back on their own: each at least twice, never within 15 workdays
//   of itself, never two favorite days within 7 days, only on workdays without a lock, pick or occasion (a locked week, a picked day, a
//   wedding and a formal day keep their own outfits), never breaking a rule; a favorite look's shirt and tie are not marked down in Harmony
// - a favorite piece is planned more often, and the repeat rules still hold (no tie within three workdays, no shirt two workdays running)
// - settings.fav merges entry by entry: a look loved on one phone and a piece on the other both stay, a heart taken back goes everywhere,
//   app and server alike (core.js mergeSettings, merge.js mergeSettingsBy), and settings coming in are cleaned (cleanSettings)
// - two devices through the real worker: a favorite marked on each phone ends up on both
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,WARDROBES,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(W=>{const w=(0,eval)(W);HOOK.items=w.realistic.map(i=>({...i}));
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];settings.laundryDays=1;settings.holidays=null;settings.daysOff=[];delete settings.dress;delete settings.fav;
      HOOK.weather={};HOOK.climate=null;HOOK.TODAY_OVERRIDE='2026-11-01T12:00:00';HOOK.dayRecs={};
      const end=new Date(2027,0,31),plan=()=>{HOOK.cache={};const pl=planSim(new Date(2026,10,2)).upTo(end);return pl},ks=pl=>Object.keys(pl).sort((a,b)=>keyDate(a)-keyDate(b));
      const sig=pl=>ks(pl).map(k=>k+':'+SLOTS.map(s=>pl[k][s]?pl[k][s].id:'-').join(',')).join(';');
      const P0=plan(),K=ks(P0),s0=sig(P0);settings.fav={looks:[],items:[]};const sEmpty=sig(plan());
      // two looks of the plan without favorites (a suit day and the next look with another jacket), and the tie worn least but not never
      const look=o=>({j:o.top.id,sh:o.shirt.id,tie:o.tie.id,at:1}),L=[look(P0[K[2]])];for(let i=6;i<K.length&&L.length<2;i++){const o=P0[K[i]];if(o.top&&o.tie&&o.top.id!==L[0].j&&!o.occasion&&!o.formal)L.push(look(o))}
      const wear=pl=>{const c={};for(const k of ks(pl))for(const s of SLOTS)if(pl[k][s])c[pl[k][s].id]=(c[pl[k][s].id]||0)+1;return c},w0=wear(P0);
      const ties=items.filter(i=>i.type==='tie'&&w0[i.id]).sort((a,b)=>w0[a.id]-w0[b.id]||(a.id<b.id?-1:1)),ft=ties[0].id;
      // the week of 23 Nov locked as shown, 2 Dec picked, a wedding on 9 Dec and a formal day on 13 Jan
      const LOCK=['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27'];
      for(const k of LOCK){const o=P0[k];dayRecs[k]={date:k,lock:Object.fromEntries(SLOTS.filter(s=>o[s]).map(s=>[s,o[s].id])),lockAt:1}}
      const pk=P0['2026-12-2'];dayRecs['2026-12-2']={date:'2026-12-2',force:{tie:pk.tie.id}};dayRecs['2026-12-9']={date:'2026-12-9',occasion:'wedding'};dayRecs['2027-1-13']={date:'2027-1-13',formal:true};
      settings.fav={looks:L,items:[ft]};const P1=plan(),K1=ks(P1),w1=wear(P1),idx={};K1.forEach((k,i)=>idx[k]=i);
      const fk=o=>favKey(o.top&&o.top.id,o.shirt&&o.shirt.id,o.tie&&o.tie.id),hits=K1.filter(k=>favLookOf(P1[k])),auto=K1.filter(k=>P1[k].favDue);
      const per=L.map(l=>K1.filter(k=>fk(P1[k])===favLookKey(l)));
      let minCal=1e9;for(let i=1;i<hits.length;i++)minCal=Math.min(minCal,(keyDate(hits[i])-keyDate(hits[i-1]))/864e5);
      const gaps=per.map(ds=>ds.slice(1).map((k,i)=>idx[k]-idx[ds[i]]));
      const pinned=[...LOCK,'2026-12-2','2026-12-9','2027-1-13'],kept=LOCK.every(k=>SLOTS.every(s=>(P0[k][s]&&P0[k][s].id)===(P1[k][s]&&P1[k][s].id)));
      // the repeat rules over the favorites' plan: the same tie within three workdays, the same shirt two workdays running
      let tie3=0,shirt2=0;K1.forEach((k,i)=>{const o=P1[k];if(o.tie&&K1.slice(Math.max(0,i-3),i).some(x=>P1[x].tie&&P1[x].tie.id===o.tie.id))tie3++;if(i&&o.shirt&&P1[K1[i-1]].shirt&&P1[K1[i-1]].shirt.id===o.shirt.id)shirt2++});
      let tie3b=0;K.forEach((k,i)=>{const o=P0[k];if(o.tie&&K.slice(Math.max(0,i-3),i).some(x=>P0[x].tie&&P0[x].tie.id===o.tie.id))tie3b++});
      // Harmony: a favorite look's shirt and tie count as a known-good pair
      const o1=P1[auto[0]],hFav=dialHarmony(o1).v,keep=settings.fav;settings.fav={looks:[],items:[]};const hNo=dialHarmony(o1).v;settings.fav=keep;
      return {same:s0===sEmpty,n:K.length,looks:L.length,per:per.map(d=>d.length),gaps,minCal,auto:auto.length,onPinned:pinned.filter(k=>P1[k]&&P1[k].favDue).length,kept,
        offDay:hits.filter(k=>!isWorkday(keyDate(k))).length,hard:auto.filter(k=>rateOutfit(P1[k]).hard.length).length,
        tie:[w0[ft],w1[ft]],tie3,tie3b,shirt2,hFav,hNo}},WARDROBES);
    ok(r.same,'an empty settings.fav plans every day as no favorites at all');
    ok(r.looks===2&&r.per.every(n=>n>=2),`each favorite look comes back on its own in three months (${r.per.join(', ')} times, ${r.n} workdays)`);
    ok(r.gaps.every(g=>g.every(x=>x>=15)),`a favorite look rests at least 15 workdays between wears (${JSON.stringify(r.gaps)})`);
    ok(r.minCal>=7,`never two favorite looks within 7 days (closest ${r.minCal} days apart)`);
    ok(r.auto>=4&&r.onPinned===0&&r.kept,`only days not yet locked or picked, and no occasion day, get a favorite (${r.auto} brought back; on pinned days ${r.onPinned}; the locked week kept ${r.kept})`);
    ok(r.offDay===0&&r.hard===0,`favorites only on workdays, and never with a broken rule (${r.offDay} off days, ${r.hard} hard)`);
    ok(r.tie[1]>r.tie[0],`a favorite tie is planned more often (${r.tie[0]} → ${r.tie[1]} times)`);
    ok(r.tie3<=r.tie3b&&r.shirt2===0,`the repeat rules still hold: the same tie within three workdays ${r.tie3b} → ${r.tie3}, a shirt two workdays running ${r.shirt2}`);
    ok(r.hFav>=r.hNo,`a favorite look's shirt and tie are not marked down in Harmony (${r.hNo} → ${r.hFav})`);

    // ---- merging settings.fav entry by entry (the app and the server)
    const m=await p.evaluate(()=>{const base={workdays:[1,2,3,4,5],fav:{looks:[{j:'s1',sh:'h1',tie:'t1',at:1}],items:['t9']}};keySettings(base);stampSettings(base,1000);
      const a=JSON.parse(JSON.stringify(base)),b=JSON.parse(JSON.stringify(base));
      a.fav={looks:[...a.fav.looks,{j:'s2',sh:'h2',tie:'t2',at:2000}],items:a.fav.items};stampSettings(a,2000);   // phone A loves a look
      b.fav={looks:b.fav.looks,items:['t9','h7']};stampSettings(b,3000);                                          // phone B a piece
      const ab=mergeSettings(a,b),srv=DW_MERGE.mergeSettingsBy(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),{num:true});
      const c=JSON.parse(JSON.stringify(ab));c.fav={looks:c.fav.looks.filter(l=>l.j!=='s1'),items:c.fav.items};stampSettings(c,4000);   // A takes a heart back
      const d=JSON.parse(JSON.stringify(ab));d.fav={looks:d.fav.looks,items:[...d.fav.items,'x5']};stampSettings(d,5000);              // B adds a piece meanwhile
      const cd=mergeSettings(c,d);
      const dirty=cleanSettings({fav:{looks:[{j:'<b>',sh:'h1',tie:'t1'},{j:null,sh:'h1',tie:null},{j:'s1',sh:'h1',tie:'t1',at:5}],items:['ok1','"x"',3]}});
      const clean={fav:{looks:[{j:'s1',sh:'h1',tie:'t1',at:5}],items:['ok1']}};
      return {ab:ab.fav,srv:srv.fav,cd:cd.fav,dirty:dirty.fav,same:cleanSettings(clean)===clean}});
    const keys=f=>f.looks.map(l=>l.j).sort().join()+'/'+f.items.slice().sort().join();
    ok(keys(m.ab)==='s1,s2/h7,t9'&&keys(m.srv)==='s1,s2/h7,t9',`a look loved on one phone and a piece on the other both stay, app and server alike (${keys(m.ab)}; server ${keys(m.srv)})`);
    ok(keys(m.cd)==='s2/h7,t9,x5',`a heart taken back on one phone goes while a piece added on the other stays (${keys(m.cd)})`);
    ok(keys(m.dirty)==='s1/ok1'&&m.same,`favorites coming in are cleaned: ids only, a look needs a shirt and a jacket or tie (${JSON.stringify(m.dirty)}); a clean copy is kept as it is`);
    ok(!errs.length,`no page errors (${errs.join('; ')})`);
  }finally{await browser.close()}

  // ---- two devices through the real worker: a favorite look marked on A and a favorite piece on B end up on both
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const b2=await chromium.launch();
  try{
    const device=async()=>{const ctx=await b2.newContext();
      await ctx.route(HOST+'**',async route=>{const q=route.request();
        const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const d=await ctx.newPage();await d.goto(url);await d.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
      await d.reload();await d.waitForFunction(()=>window.appReady);await d.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-11T12:00:00'});return d};
    const sync=d=>d.evaluate(()=>syncNow()),fav=d=>d.evaluate(()=>{const f=settings.fav||{looks:[],items:[]};return f.looks.map(l=>l.j+'|'+l.sh+'|'+l.tie).sort().join()+'/'+f.items.slice().sort().join()});
    const A=await device(),B=await device();
    await A.evaluate(async()=>{for(const it of [{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',added:1},{id:'h1',type:'shirt',primaryColor:'white',pattern:'solid',added:1},{id:'t1',type:'tie',primaryColor:'burgundy',pattern:'solid',added:1}]){await put(it);items.push(it)}});
    await sync(A);await sync(B);
    await A.evaluate(async()=>{const n=HOOK.favData();n.looks.push({j:'s1',sh:'h1',tie:'t1',at:Date.now()});await HOOK.favSave(n)});
    await B.evaluate(async()=>{const n=HOOK.favData();n.items.push('t1');await HOOK.favSave(n)});
    await sync(A);await sync(B);await sync(A);
    const fa=await fav(A),fb=await fav(B);
    ok(fa==='s1|h1|t1/t1'&&fb===fa,`a favorite look marked on one phone and a favorite piece on the other end up on both (A ${fa}, B ${fb})`);
    await B.evaluate(async()=>{const n=HOOK.favData();n.looks=[];await HOOK.favSave(n)});await sync(B);await sync(A);
    ok(await fav(A)==='/t1','a heart taken back on one phone goes on the other');
  }finally{await b2.close()}
};
module.exports.realPlanner=true;
