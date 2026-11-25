// What to buy and the rest of the app (fix round A, 2026-11-17; the code review's CR-4-04 and CR-4-12): a sync that brings changes
// while the sheet is open redraws Insights under it and leaves the sheet open (show() closed it on every redraw); the kept result stays
// fresh after what the planner never reads (a new photo, a renamed piece, the holiday list fetched again), and is checked again after
// what it does read (a color, a day off). The analysis itself is stubbed: nothing runs or is paid for.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:780}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',updated:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white'),I('shirt','cream'),
        I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','gold'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'})];
      settings.holidays={country:'KW',list:[{d:'2026-12-01',n:'Holiday'}],skip:[],fetched:1};settings.daysOff=[];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};
      HOOK.shopBusy={i:-1,n:1,label:'',t0:Date.now()};HOOK.shop=null;show('stats')});   // (a check "already running", so none starts)
    await p.click('#shop-btn');await settle(p,500);
    ok(await p.evaluate(()=>shopOpen&&$('#shop-sheet').classList.contains('on')),'What to buy opens from Insights');
    await p.evaluate(()=>syncRedraw('stats'));await settle(p,300);
    ok(await p.evaluate(()=>shopOpen&&$('#shop-sheet').classList.contains('on')&&!$('#stats').hidden),'a sync that brings changes redraws Insights and leaves What to buy open over it');
    await p.click('#shop-sheet .pick-x');await settle(p,400);
    ok(await p.evaluate(()=>!shopOpen),'× still closes it');
    // the kept result's signature
    const fresh=()=>p.evaluate(()=>HOOK.shopFresh());
    await p.evaluate(()=>{HOOK.shopBusy=null;HOOK.shop={sig:HOOK.shopSig(),at:Date.now(),res:{v:2,base:{},cats:[],top:[],occasions:[]}}});
    ok(await fresh(),'the kept result is fresh to begin with');
    await p.evaluate(()=>{const it=items[0];it.photo='data:image/jpeg;base64,AAAA';it.name='My navy suit';it.notes='from the tailor';it.updated=Date.now();settings.holidays={...settings.holidays,fetched:Date.now()}});
    ok(await fresh(),'a new photo, a name, notes and the holiday list fetched again leave it fresh: the planner reads none of them');
    await p.evaluate(()=>{items[1].primaryColor='grey'});
    ok(!(await fresh()),'a changed color makes it stale');
    await p.evaluate(()=>{items[1].primaryColor='charcoal';settings.daysOff=[{d:'2026-11-25',n:'Trip'}]});
    ok(!(await fresh()),'a new day off makes it stale');
    await p.evaluate(()=>{settings.daysOff=[];settings.holidays={...settings.holidays,skip:['2026-12-01']}});
    ok(!(await fresh()),'a holiday worked anyway makes it stale');
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};
