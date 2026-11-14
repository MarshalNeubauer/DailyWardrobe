// Speed fixes from the 2026-11-13 audit: Today's month kept in IndexedDB and drawn at start-up without the planner (then planned for
// real once idle: redrawn only when it differs, and nothing recorded or locked from the kept copy); the forecast and climate read
// before the first drawing (one plan at start-up, not three); the Wardrobe grid dropped when leaving the tab; its boxes skipped
// off screen (content-visibility); the manifest's icons.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
  const man=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
  ok(man.id&&man.icons.every(i=>i.purpose==='any'||i.purpose==='maskable')&&man.icons.some(i=>i.purpose==='maskable')&&man.icons.some(i=>i.purpose==='any'),'the manifest has an id and separate "any" and "maskable" icons');
  const sizes=['icon-512.png','icon-192.png','apple-touch-icon.png'].map(f=>fs.statSync(path.join(ROOT,f)).size);
  ok(sizes[0]<250e3&&sizes[1]<40e3&&sizes[2]<40e3,`the icons are re-encoded smaller (${sizes.map(s=>Math.round(s/1024)+' KB').join(', ')}; they were 465, 64 and 55 KB)`);
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.clock.setFixedTime(new Date(2026,10,16,12));   // a Monday, a workday
    const p=await ctx.newPage();const errs=[];const until=async f=>{for(let i=0;i<75;i++){if(await p.evaluate(f))return true;await p.waitForTimeout(200)}return false};
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',updated:1,...x});
      const its=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      for(const i of its)await putRaw(i);await metaPut('settings',{...settings,setupDone:1,workdays:[0,1,2,3,4],updated:1})});
    await p.reload();await p.waitForFunction(()=>window.appReady);
    // the plan is kept once Today has been drawn and its week locked
    await until(async()=>{const s=await metaGet(PLAN_SNAP);return !!(s&&s.sig===planSig())});
    const kept=await p.evaluate(async()=>{const s=await metaGet(PLAN_SNAP);return {k:s.k,len:JSON.stringify(s.plan).length,ids:JSON.stringify(idsOf(planMonth(2026,10)[key(todayDate())]))}});
    ok(kept.k==='2026-10'&&kept.len<200e3,`Today's month is kept in IndexedDB (${Math.round(kept.len/1024)} KB, the pieces by id, not with their photos)`);
    await p.reload();await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({used:planSnapUsed,ids:JSON.stringify(idsOf(planMonth(2026,10)[key(todayDate())])),snap:cache.snap||null}));
    ok(r.used==='2026-10'&&r.ids===kept.ids,'start-up draws Today from the kept month, the same outfit');
    await p.waitForFunction(()=>!cache.snap,null,{timeout:5000});
    ok(await p.evaluate(k=>JSON.stringify(idsOf(planMonth(2026,10)[key(todayDate())]))===k,kept.ids),'once idle the month is planned for real, and the outfit stays');
    // a kept month that no longer holds: a changed item is not used at all; a stale copy with the same stamps is replaced
    await p.evaluate(async()=>{const it=items.find(i=>i.type==='tie');it.updated=Date.now();await putRaw(it)});await p.reload();await p.waitForFunction(()=>window.appReady);
    ok(await p.evaluate(()=>planSnapUsed===null),'after a change to an item the kept month is not used');
    await until(async()=>{const s=await metaGet(PLAN_SNAP);return !!(s&&s.sig===planSig())});
    const real=await p.evaluate(async()=>{const s=await metaGet(PLAN_SNAP),k=key(todayDate());const day=s.plan[k];const other=items.find(i=>i.type==='tie'&&i.id!==day.tie.$i);day.tie={$i:other.id,$x:{rest:3}};await metaPut(PLAN_SNAP,s);
      return {tie:planMonth(2026,10)[k].tie.id,fake:other.id,lock:JSON.stringify((dayRecs[k]||{}).lock||null)}});
    await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.waitForFunction(()=>!cache.snap,null,{timeout:5000});await p.waitForTimeout(300);
    const after=await p.evaluate(()=>{const k=key(todayDate());return {used:planSnapUsed,tie:planMonth(2026,10)[k].tie.id,shown:document.querySelector('#today').textContent,lock:JSON.stringify((dayRecs[k]||{}).lock||null)}});
    ok(after.used&&after.tie===real.tie&&after.lock===real.lock,`a kept month that differs from the real plan is replaced once idle, and nothing was locked from it (${after.tie} / ${real.tie}, fake ${real.fake})`);
    // the forecast and climate are read before the first drawing: one plan at start-up
    await p.evaluate(()=>{settings.location={lat:29.4,lon:47.9,name:'Kuwait'};const days={};for(let i=0;i<16;i++){const d=new Date(2026,10,16+i);days[key(d)]={tmax:30,tmin:20,pop:0,rain:0,code:0}}
      localStorage.setItem('wx',JSON.stringify({lat:29.4,lon:47.9,t:Date.now(),days}));localStorage.setItem('wx_norm',JSON.stringify({lat:29.4,lon:47.9,t:Date.now(),months:Array.from({length:12},()=>({tmax:35,tmin:22,rain:0}))}));return metaPut('settings',settings)});
    await ctx.route('https://**.open-meteo.com/**',r=>r.abort());
    await p.reload();await p.waitForFunction(()=>window.appReady);await until(async()=>{const s=await metaGet(PLAN_SNAP);return !!(s&&s.sig===planSig())});   // (the first start after the change locks the week again from the forecast)
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(800);
    const sims=await p.evaluate(()=>({used:planSnapUsed,n:planRuns.filter(k=>k==='2026-10').length,all:planRuns.join(),wx:Object.keys(weather).length,cl:!!climate}));
    ok(sims.wx===16&&sims.cl&&sims.n<=1&&sims.used,`with a forecast and climate kept, start-up draws from the kept month and plans once, when idle (${sims.n} plans of the month (${sims.all}); the forecast and climate were read first)`);
    // the Wardrobe grid
    const w=await p.evaluate(()=>{show('wardrobe');const n=document.querySelectorAll('#wardrobe .gi').length,cv=getComputedStyle(document.querySelector('#wardrobe .gi')).contentVisibility;show('today');return {n,cv,left:document.querySelector('#wardrobe').children.length}});
    ok(w.n>0&&w.cv==='auto'&&w.left===0,`the Wardrobe's boxes are skipped off screen (content-visibility ${w.cv}) and the grid is dropped when another tab is shown`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
