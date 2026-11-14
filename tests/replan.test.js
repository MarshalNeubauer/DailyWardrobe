// Re-planning: swaps pin pieces on a day (force/skip) and the coming week is locked as shown (lock); when the planning rules change
// (PLAN_RULES) the app releases the locks on every day after today so the new rules apply, keeping the owner's picks, formal days,
// today and the past. Settings' Re-plan clears the picks too, on demand.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','lightgrey'),I('suit','brown'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};
      dayRecs={'2026-11-5':{date:'2026-11-5',ids:{top:'suit0'},force:{top:'suit0'},worn:true},
        '2026-11-9':{date:'2026-11-9',force:{top:'suit1'},skip:{shirt:['shirt4']}},
        '2026-11-10':{date:'2026-11-10',lock:{top:'suit2',tie:'tie7'}},
        '2026-11-17':{date:'2026-11-17',force:{top:'suit1',tie:'tie6'},skip:{top:['suit0']},ids:{top:'suit1'},vest:true,lock:{top:'suit1',tie:'tie6',shirt:'shirt5'}},
        '2026-11-18':{date:'2026-11-18',force:{top:'suit0'}},
        '2026-11-23':{date:'2026-11-23',formal:true,force:{top:'suit0'},lock:{top:'suit0'}},
        '2026-12-6':{date:'2026-12-6',vest:false}}};
    await p.evaluate(setup);await p.evaluate(()=>{settings.planRules=1});
    const r=await p.evaluate(async()=>{await checkPlanRules();const R=k=>JSON.stringify(Object.keys(dayRecs[k]).filter(x=>x!=='updated').sort());
      return {rules:settings.planRules===PLAN_RULES,past:R('2026-11-5'),today:R('2026-11-9'),f10:R('2026-11-10'),f17:R('2026-11-17'),f18:R('2026-11-18'),formal:R('2026-11-23'),dec:R('2026-12-6'),
        n17:planFor()['2026-11-17'].top.id,toast:document.querySelector('#toast').textContent}});
    // (2026-11-14, the audit: a bump used to clear the owner's picks on every upcoming day, so planning changes went without one)
    ok(r.rules&&r.f10==='["date"]'&&r.f17==='["date","force","ids","skip","vest"]','after a rules change the week\'s locks on upcoming days are released');
    ok(r.f18==='["date","force"]'&&r.dec==='["date","vest"]'&&r.n17==='suit1','the owner\'s own picks (swaps, skips, the vest) stay');
    ok(r.formal==='["date","force","formal"]','formal days stay formal, with their picks');
    ok(r.past==='["date","force","ids","worn"]'&&r.today==='["date","force","skip"]','today and past days are left alone');
    await p.waitForFunction(()=>/planner was updated.*own picks were kept/.test(document.querySelector('#toast').textContent),null,{timeout:5000}).catch(()=>{});
    ok(/planner was updated.*own picks were kept/.test(await p.textContent('#toast')),'a note says the upcoming days were planned again');
    ok(await p.evaluate(async()=>{dayRecs['2026-11-18']={date:'2026-11-18',force:{top:'suit3'},lock:{top:'suit3'}};await checkPlanRules();return !!dayRecs['2026-11-18'].lock}),'it happens once per rules change: later locks are kept');
    // Settings button: clears the owner's picks too
    await p.evaluate(async()=>{for(const k of Object.keys(dayRecs))if(k!=='2026-11-18'&&k!=='2026-11-5'&&k!=='2026-11-9')delete dayRecs[k];cache={}});
    await p.evaluate(()=>openSettings('schedule'));
    ok(/1 upcoming day keeps pieces from a swap/.test(await p.textContent('#replan-status')),'Settings says how many upcoming days keep swapped pieces');
    await p.evaluate(()=>document.body.classList.add('owner'));   // (Re-plan is among the owner's tools)
    await p.click('#adv-schedule .adv-head');await p.click('#replan-btn');await p.click('#ask-ok');await p.waitForFunction(()=>/planned again/.test($('#replan-status').textContent),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>!dayRecs['2026-11-18'].force&&/1 day planned again/.test($('#replan-status').textContent)),'Re-plan upcoming days clears them on demand');
    await p.click('#replan-btn');
    ok(/Nothing to reset/.test(await p.textContent('#replan-status')),'and says when there is nothing to reset');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (it checks re-planning (checkPlanRules)); other tests get tests/fixedplan.js
