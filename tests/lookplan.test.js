// The planner chooses good-looking outfits (planner.js chooseClothes, LOOK_PAIR / LOOK_K, 2026-11-17, the owner: a planned outfit ranked
// 457th of 507 on the score card, "picked because the pink tie had rested 25 days"): among the outfits in the clothes window that repeat
// nothing, the look (dialLook: Harmony + Texture + Occasion, the score card's rank value) counts, and rest chooses among the best-looking.
// Three months of the shared realistic test wardrobe (tests/run.js WARDROBES) from 2 Nov 2026, nothing worn before:
// - the planned outfit's rank among all the outfits the day allows (rankLooks, as the score card shows it) moves up: measured on these
//   three months, median 49% -> 32% of the way down, in the day's top tenth on 6% -> 15% of workdays, 90th percentile 78% -> 68% (the tail
//   is the light jackets' days: their best outfits rank low among all the jackets, and rotation still wears them); before, one tie color
//   ran two workdays
// (shirts still rotate evenly: tests/rotation-pause.test.js "no shirt hogs the rotation")
// - the repeat rules hold (no tie within three workdays, no tie color or shirt the workday before, no tie with that shirt color within
//   PAIR_DAYS) and every suit, blazer, pair of pants, shirt and tie is still planned
// - the look the planner uses is the rank's own (planLook and rankLooks share lookLeather and dialLook)
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};HOOK.items=W.realistic.map(i=>({...i}));
      HOOK.settings={...settings,workdays:[1,2,3,4,5],blazerDays:[4],vestMode:'auto',darkShirts:'some',holidays:null,daysOff:[],laundryDays:1};delete settings.dress;
      HOOK.weather={};HOOK.climate=null;HOOK.TODAY_OVERRIDE='2026-11-01T12:00:00';HOOK.dayRecs={};HOOK.cache={};
      const plan=planSim(new Date(2026,10,2)).upTo(new Date(2027,1,0)),ks=Object.keys(plan).sort((a,b)=>keyDate(a)-keyDate(b));
      const pct=[],seq=[],worn={};let top10=0,same=0;
      for(const k of ks){const o=plan[k],n=di(keyDate(k)),pool=t=>items.filter(i=>i.type===t&&inRotation(i,n)).sort((a,b)=>a.id<b.id?-1:1);
        const P={top:pool(o.top?o.top.type:o.suitDay?'suit':'blazer'),bot:pool('pants'),shirt:pool('shirt'),tie:pool('tie'),shoes:pool('shoes'),belt:pool('belt'),watch:pool('watch'),socks:pool('socks')};
        const R=rankLooks(P,o);pct.push(R.rank/R.n);if(R.rank<=Math.ceil(R.n*.1))top10++;
        // the planner's look of the outfit with the shoes the look is judged with is the rank's value of that outfit
        const lw=HOOK.lookLeather(P.shoes,P.belt,P.watch,!!o.suitDay,o.clim&&o.clim.rain)(o.top,o.bot),day={formal:!!o.formal,occ:o.occasion&&o.occasion!=='formal'?o.occasion:null,clim:o.clim};
        if(HOOK.planLook(day,!!o.suitDay,P.shoes,P.belt,P.watch)(o.top,o.bot,o.shirt,o.tie)===rankLooks(P,{...o,shoes:lw.shoes,belt:lw.belt,watch:lw.watch}).look)same++;
        for(const s of ['top','bot','shirt','tie'])if(o[s])worn[o[s].id]=1;
        seq.push({t:o.tie&&o.tie.id,tg:o.tie&&tieGroup(o.tie),s:o.shirt&&o.shirt.id,sg:o.shirt&&shirtGroup(o.shirt)})}
      const rep={tie3:0,tg:0,shirt:0,pair:0};seq.forEach((x,i)=>{const a=seq[i-1];if(a&&x.tg===a.tg)rep.tg++;if(a&&x.s===a.s)rep.shirt++;
        if(seq.slice(Math.max(0,i-3),i).some(y=>y.t===x.t))rep.tie3++;if(seq.slice(Math.max(0,i-PAIR_DAYS),i).some(y=>y.t===x.t&&y.sg===x.sg))rep.pair++});
      const s=[...pct].sort((a,b)=>a-b),q=f=>s[Math.floor(f*(s.length-1)+.5)];
      const never=items.filter(i=>['suit','blazer','pants','shirt','tie'].includes(i.type)&&!worn[i.id]).map(i=>i.id);
      return {n:ks.length,med:q(.5),p90:q(.9),top10:top10/ks.length,rep,never,same,rules:PLAN_RULES,k:HOOK.LOOK_K}})()`);
    const f=x=>(100*x).toFixed(0)+'%';
    ok(r.rules>=26&&r.k>0,`PLAN_RULES 26 or later, the look counts (LOOK_K ${r.k})`);
    ok(r.n>=60&&r.med<=.4,`the planned outfit's look rank moves up: median ${f(r.med)} of the way down the day's outfits over ${r.n} workdays (49% before the look counted)`);
    ok(r.top10>=.12&&r.p90<=.74,`in the day's top tenth on ${f(r.top10)} of workdays (6% before), 90th percentile ${f(r.p90)} (78% before)`);
    ok(r.rep.tie3===0&&r.rep.tg===0&&r.rep.shirt===0&&r.rep.pair===0,`no tie within three workdays, no tie color or shirt the workday before, no tie with the same shirt color within ${10} workdays (${JSON.stringify(r.rep)})`);
    ok(!r.never.length,`every suit, blazer, pair of pants, shirt and tie is planned (${r.never.join(', ')||'all'})`);
    ok(r.same===r.n,`the planner's look is the rank's own value on every day (${r.same} of ${r.n})`);
    ok(!errs.length,'no page errors '+errs.join('; '));
  }finally{await browser.close()}};
