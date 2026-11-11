// Fixes from the code review: adding or deleting an item re-plans; a blazer day without blazers still gets a jacket;
// the month's outfit count a year ahead; a new day while the app stayed open; one shared simulation for every month
// (same outfits as planning each month on its own, each day planned once); "Last worn" ignores days from before a piece
// was in the wardrobe; the what-to-buy analysis is sent without pictures.
module.exports=async({ok,chromium,url,settle:settleFor})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const settle=()=>settleFor(p,350);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{window.confirm=()=>true;let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      window.base=()=>[I('suit','navy'),I('suit','charcoal'),I('suit','brown'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      items=base();settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    await settle();await p.evaluate(()=>renderToday());await settle();
    // deleting the tie planned for today: Today must plan again without it
    const del=await p.evaluate(async()=>{const id=planFor()[key(sel)].tie.id;await rm(id);await new Promise(r=>setTimeout(r,300));show('today');const o=planFor()[key(sel)];
      return {gone:!items.some(i=>i.id===id),planned:o.tie&&o.tie.id!==id,shown:!Object.values(planFor()).some(x=>x.tie&&x.tie.id===id&&!x.frozen)}});
    ok(del.gone&&del.planned&&del.shown,'after deleting an item, Today plans again without it');
    // adding an item: the plan is built again, and the new piece gets worn
    await settle();
    const add=await p.evaluate(async()=>{const before=planFor();queue=[{id:'newtie',type:'tie',primaryColor:'gold',pattern:'solid',manual:true}];await save(0);await new Promise(r=>setTimeout(r,300));show('today');
      return {rebuilt:planFor()!==before,worn:Object.values(planMonth(2026,11)).some(o=>o.tie&&o.tie.id==='newtie')}});
    ok(add.rebuilt&&add.worn,'after adding an item, the plan is built again and uses it');
    // a blazer day with no blazer in the wardrobe gets a suit (and a suit day with only blazers a blazer), not a bare shirt
    const jk=await p.evaluate(()=>{settings.blazerDays=[4];cache={};const th=buildPlan(2026,10)['2026-11-12'];
      const keep=items;items=[...items.filter(i=>i.type!=='suit'),I('blazer','navy'),I('pants','grey')];settings.blazerDays=[];const mo=buildPlan(2026,10)['2026-11-16'];items=keep;cache={};
      return {th:th.top&&th.top.type,thSuit:th.suitDay,mo:mo.top&&mo.top.type,moPants:!!mo.bot&&mo.bot.type==='pants'}});
    ok(jk.th==='suit'&&jk.thSuit===true,`a blazer day with no blazers gets a suit (${jk.th})`);
    ok(jk.mo==='blazer'&&jk.moPants,`a suit day with only blazers gets a blazer and trousers (${jk.mo})`);
    // the box on Today counts this month's outfits only, also a year ahead (the plan then holds two Novembers)
    const cnt=await p.evaluate(()=>{settings.blazerDays=[];cache={};sel=new Date(2027,10,15);view={y:2027,m:10};renderToday();return +document.querySelector('#mbox .mltxt small').textContent.match(/(\d+) outfit/)[1]});
    ok(cnt>=20&&cnt<=23,`the month box counts one month's outfits, a year ahead too (${cnt})`);
    // one shared simulation: the same outfits as planning each month on its own, and each day planned once
    const sim=await p.evaluate(()=>{cache={};const orig=outfit;let calls=0;outfit=function(){calls++;return orig.apply(this,arguments)};
      const months=[[2026,10],[2026,11],[2027,0],[2027,1],[2027,2]],diff=[];
      for(const [y,m] of months)planMonth(y,m);const shared=calls;calls=0;
      for(const [y,m] of months){const a=planMonth(y,m),b=buildPlan(y,m);for(const k of Object.keys(b)){const d=keyDate(k);if(d.getMonth()!==m||d.getFullYear()!==y)continue;if(JSON.stringify(idsOf(a[k]))!==JSON.stringify(idsOf(b[k])))diff.push(k)}}
      const separate=calls;outfit=orig;
      // a month from before the shared start is still planned on its own, the same as buildPlan
      const old=planMonth(2026,5),oldB=buildPlan(2026,5),oldDiff=Object.keys(oldB).filter(k=>JSON.stringify(idsOf(old[k]))!==JSON.stringify(idsOf(oldB[k]))).length;
      const future=Object.keys(planMonth(2027,2)).filter(k=>keyDate(k)>=todayDate()).length;
      return {diff,shared,separate,future,oldDiff,oldN:Object.keys(oldB).length}});
    ok(sim.diff.length===0,`months planned from the shared simulation match months planned on their own (${sim.diff.slice(0,4).join(' ')})`);
    ok(sim.shared<=sim.future+2&&sim.separate>sim.shared*2,`stepping through five months plans each day once (${sim.shared} outfits for ${sim.future} days; ${sim.separate} when every month starts over)`);
    ok(sim.oldDiff===0&&sim.oldN>0,'a month from before the shared start is still planned correctly');
    // a new day while the app stayed open: it moves on to today; a day the user was browsing is left alone
    const day=await p.evaluate(()=>{cache={};TODAY_OVERRIDE='2026-11-10T12:00:00';sel=new Date(2026,10,10);view={y:2026,m:10};renderToday();
      TODAY_OVERRIDE='2026-11-11T08:00:00';document.dispatchEvent(new Event('visibilitychange'));const a=key(sel);
      sel=new Date(2026,10,17);renderToday();TODAY_OVERRIDE='2026-11-12T08:00:00';document.dispatchEvent(new Event('visibilitychange'));const b=key(sel);
      // Thursday evening on Today, opened again on Friday (a day off): the next workday
      sel=new Date(2026,10,12);renderToday();TODAY_OVERRIDE='2026-11-13T08:00:00';document.dispatchEvent(new Event('visibilitychange'));const c=key(sel);
      return {a,b,c,head:document.querySelector('#today h2').textContent}});
    ok(day.a==='2026-11-11',`left open overnight, the app moves on to the new day (${day.a})`);
    ok(day.b==='2026-11-17','a day the user was looking at is not taken away');
    ok(day.c==='2026-11-15'&&/Sunday/.test(day.head),`when the new day is a day off, it shows the next workday (${day.c})`);
    // "Last worn": a record dated before a piece was added is the planner's warm-up, not something worn
    const lw=await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};const o=planFor()[key(sel)];
      const rec=d=>({date:d,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest});dayRecs={'2026-9-3':rec('2026-9-3')};cache={};
      items.forEach(i=>i.added=1);const real=lastWorn(o);items.forEach(i=>i.added=+new Date(2026,10,7));const warm=lastWorn(o);items.forEach(i=>i.added=1);dayRecs={};cache={};
      return {real:real&&key(real),warm}});
    ok(lw.real==='2026-9-3'&&lw.warm===null,`"Last worn" ignores days from before the pieces were in the wardrobe (${lw.real}, ${lw.warm})`);
    // the what-to-buy analysis gets the tags, not the pictures
    const pay=await p.evaluate(()=>{items[0].photo='data:image/jpeg;base64,AAAA';items[0].swatch='data:image/png;base64,BBBB';let sent=null;const W=window.Worker;
      window.Worker=function(){this.postMessage=d=>{sent=d};this.terminate=()=>{}};analyzeWardrobe();window.Worker=W;shopBusy=null;
      return {n:sent.list.length,pics:sent.list.some(i=>i.photo||i.swatch),kept:!!items[0].photo,tags:sent.list.every(i=>i.type&&i.primaryColor)}});
    ok(pay.n>0&&!pay.pics&&pay.kept&&pay.tags,'the what-to-buy analysis is sent the tags only, no pictures');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
