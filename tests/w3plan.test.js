// Fix round 3 (2026-11-16), Fixer 7: planner records, locks and frozen days
// - W2-17-01: a pick or "Suggest another" for a coming day writes no pieces (ids) ahead of the day, so the pick stands once the day is past
//   without the app being opened; a record an earlier version wrote that way (a pick saved before the day began) is recorded again
// - W1-1-01 = W1-4-01 = W1-2-06: the planning rules a phone last planned by are its own (meta plan_rules), not the synced settings' number
// - W1-8-01: past public holidays stay days off when the list is fetched again, the country changes or holidays are turned off
// - W1-1-05 = W2-16-03: with a location and no climate history, a Gulf location plans by its usual highs, not a temperate winter
// - W2-17-06: correcting a past day lets go of the locks after it that hold what was really worn
// - W1-8-05: a piece sent to the cleaner from a locked week, and its return, let the week be planned again
// - W1-8-04, W2-17-18, W2-14-11: the missed-days card shows on at most three days, can mark days one by one, and no toast repeats it
// - W2-14-12: the missed days are in memory before Today is drawn; W2-16-09: a holiday today is said on Today
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      window.fresh=(t='2026-11-15T07:30:00')=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';delete settings.darkShirts;delete settings.dress;delete settings.location;settings.holidays=null;settings.daysOff=[];settings.laundryDays=1;
        dayRecs={};weather={};climate=null;TODAY_OVERRIDE=t;cache={};sel=todayDate();view={y:sel.getFullYear(),m:sel.getMonth()};pastEdit=null};
      window.ward=()=>{items=[I('suit','navy'),I('suit','charcoal'),I('suit','brown'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','silver'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'})];return items};
      window.at=(t,k)=>{TODAY_OVERRIDE=t;cache={};sel=k?keyDate(k):todayDate();view={y:sel.getFullYear(),m:sel.getMonth()}}});

    // ---- W2-17-01: a tie picked on Sunday for Monday, the app not opened on Monday
    const pk=await p.evaluate(async()=>{fresh();ward();dayRecs['2026-11-12']={date:'2026-11-12',ids:{top:'suit000'},suitDay:true,updated:+new Date(2026,10,12,8)};   // used for real before
      at('2026-11-15T07:30:00','2026-11-16');const was=planFor()['2026-11-16'].tie.id,pick=items.find(i=>i.type==='tie'&&i.id!==was).id;
      await pickItem('tie',pick);const r1={...dayRecs['2026-11-16']};
      at('2026-11-18T07:30:00');await recordDays(planMonth(2026,10));const r2=dayRecs['2026-11-16'];cache={};const shown=planMonth(2026,10)['2026-11-16'];
      return {ahead:'ids' in r1,force:r1.force&&r1.force.tie===pick,tie:r2.ids&&r2.ids.tie===pick,auto:!!r2.auto,frozen:!!shown.frozen&&shown.tie.id===pick,miss:missedOpen().includes('2026-11-16')}});
    ok(!pk.ahead&&pk.force,'a pick for a coming day saves the pick and no pieces ahead of the day');
    ok(pk.tie&&pk.frozen,'once the day is past without the app being opened, the picked tie is what is recorded as worn');
    ok(pk.auto&&pk.miss,'and the day is listed among the days the app recorded by itself');
    const old=await p.evaluate(async()=>{fresh();ward();at('2026-11-15T07:30:00','2026-11-16');const o=planFor()['2026-11-16'],pick=items.find(i=>i.type==='tie'&&i.id!==o.tie.id).id;
      // as an earlier version saved it on Sunday: the outfit from before the pick, beside the pick; and a day the app was opened on
      dayRecs['2026-11-16']={date:'2026-11-16',ids:idsOf(o),suitDay:o.suitDay,force:{top:o.top.id,tie:pick},updated:+new Date(2026,10,15,9)};
      dayRecs['2026-11-17']={date:'2026-11-17',ids:{top:'suit001',tie:'tie007'},suitDay:true,force:{tie:'tie007'},updated:+new Date(2026,10,17,7)};
      at('2026-11-18T07:30:00');const P=planMonth(2026,10);await recordDays(P);return {tie:dayRecs['2026-11-16'].ids.tie===pick,kept:dayRecs['2026-11-17'].ids.top==='suit001'&&!dayRecs['2026-11-17'].auto}});
    ok(old.tie&&old.kept,'a record an earlier version wrote ahead of the day is recorded again with the pick; one saved on its day stays');
    const sw=await p.evaluate(async()=>{fresh();ward();at('2026-11-15T07:30:00','2026-11-16');await swapSlot('shirt');const r=dayRecs['2026-11-16'];
      const r0={...r};sel=keyDate('2026-11-16');await resetDay();return {swap:!('ids' in r0)&&!!r0.force,reset:!('ids' in dayRecs['2026-11-16'])}});
    ok(sw.swap&&sw.reset,'"Suggest another" and Reset on a coming day keep no pieces ahead either');

    // ---- W1-1-01 = W1-4-01 = W1-2-06: the synced settings' old number doesn't re-plan this phone
    const pr=await p.evaluate(async()=>{fresh();ward();at('2026-11-15T07:30:00');await lockUpcoming();await metaPut('plan_rules',PLAN_RULES);settings.planRules=PLAN_RULES-4;
      const locks=()=>Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length,a=locks();await checkPlanRules();const b=locks();
      await metaPut('plan_rules',PLAN_RULES-1);await checkPlanRules();return {a,b,c:locks(),mine:await metaGet('plan_rules')}});
    ok(pr.a>0&&pr.b===pr.a,`a lower planner number in the synced settings (another phone, a roll-back, an old backup) re-plans nothing (${pr.a} locks kept)`);
    ok(pr.c===0&&pr.mine===await p.evaluate(()=>PLAN_RULES),'the phone\'s own older number still re-plans once, and is noted on the phone');

    // ---- W1-8-01: past holidays stay days off
    const hol=await p.evaluate(async()=>{fresh();at('2027-01-06T07:30:00');settings.holidays={country:'KW',list:[{d:'2027-01-05',n:'Isra and Mi’raj'},{d:'2027-02-25',n:'National Day'}],skip:[],fetched:Date.now()};
      const real=fetchHolidays;fetchHolidays=async()=>[{d:'2027-02-25',n:'National Day'},{d:'2027-02-26',n:'Liberation Day'}];
      try{at('2027-02-08T07:30:00');await setHolidayCountry('KW',true);const a=!isWorkday(new Date(2027,0,5))&&!isWorkday(new Date(2027,1,26));
        await setHolidayCountry('FR',true);const b=!isWorkday(new Date(2027,0,5));
        await setHolidayCountry('');const c=!isWorkday(new Date(2027,0,5))&&isWorkday(new Date(2027,1,25));return {a,b,c}}finally{fetchHolidays=real}});
    ok(hol.a,'the monthly refresh keeps a past holiday a day off (Isra and Mi’raj, after the list moved on)');
    ok(hol.b&&hol.c,'so do another country and "No public holidays": only the coming holidays change');

    // ---- W1-1-05 = W2-16-03: a location with no climate history
    const cl=await p.evaluate(()=>{fresh();settings.location={lat:29.37,lon:47.98,name:'Kuwait City',cc:'KW'};climate=null;weather={};
      const r=[dayClimate(new Date(2026,11,20)).season,dayClimate(new Date(2027,0,10)).season,dayClimate(new Date(2027,6,10)).season];delete settings.location;return r});
    ok(cl.join()==='mild,mild,warm',`Kuwait with a location but no climate history is mild in December and January (${cl.join()})`);

    // ---- W2-17-06: yesterday corrected to the suit locked today
    const cp=await p.evaluate(async()=>{fresh();const W=ward(),id=n=>W[n].id;at('2026-11-18T07:30:00');
      dayRecs['2026-11-17']={date:'2026-11-17',ids:{top:id(0),bot:id(0),shirt:id(3),tie:id(6),shoes:id(10),belt:id(12)},suitDay:true,updated:+new Date(2026,10,17,8)};
      dayRecs['2026-11-18']={date:'2026-11-18',lock:{top:id(1),bot:id(1),shirt:id(4),tie:id(7),shoes:id(10),belt:id(12)},lockAt:Date.now(),updated:Date.now()};cache={};
      const before=planMonth(2026,10)['2026-11-18'].top.id;sel=keyDate('2026-11-17');view={y:2026,m:10};pastEdit='2026-11-17';await correctPast('top',W[1]);
      cache={};return {want:id(1),before,lock:!!dayRecs['2026-11-18'].lock&&dayRecs['2026-11-18'].lock.top===id(1),after:planMonth(2026,10)['2026-11-18'].top.id}});
    ok(cp.before===cp.want&&!cp.lock&&cp.after!==cp.want,`correcting yesterday to today's locked suit lets today go: another suit today (${JSON.stringify(cp)})`);

    // ---- W1-8-05: sent to the cleaner from a locked week, and back
    const cr=await p.evaluate(async()=>{fresh();ward();show('wardrobe');at('2026-12-09T07:30:00');await lockUpcoming();const locked=Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate());
      const sid=locked[0].lock.top;await careSend(sid,'cleaner');const a=Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length;
      items.find(i=>i.id===sid).away.since=isoKey(new Date());   // (locks carry the real clock's time; the test's clock is TODAY_OVERRIDE)
      at('2026-12-13T07:30:00');await lockUpcoming();const b=Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length;
      await careBack(sid);const c=Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length;return {n:locked.length,a,b,c}});
    ok(cr.n>0&&cr.a===0,'a suit held by the week\'s locks sent to the cleaner lets the week be planned again around the others');
    ok(cr.b>0&&cr.c===0,'"It\'s back" lets go of the locks made while it was away, so it rejoins the week');

    // ---- the missed-days card
    const mc=await p.evaluate(async()=>{fresh('2026-11-26T08:00:00');ward();for(const i of items)i.added=+new Date(2026,10,10);try{localStorage.removeItem('missed_ok');localStorage.removeItem('missed_seen')}catch{}
      for(const k of ['2026-11-18','2026-11-19'])dayRecs[k]={date:k,ids:{top:'suit000',shirt:'shirt003',tie:'tie006',shoes:'shoes010'},suitDay:true,updated:+keyDate(k)+8*3600e3};cache={};
      $('#toast').textContent='';show('today');renderToday();
      const sync=Object.values(dayRecs).filter(r=>r.auto&&keyDate(r.date)>keyDate('2026-11-19')).length;   // (W2-14-12: in memory before the drawing)
      await recordRun;await new Promise(r=>setTimeout(r,700));const card=()=>{const c=document.querySelector('#missbox');return c?c.innerText.replace(/\s+/g,' '):''};
      const first=card(),toastTxt=$('#toast').textContent;
      missedPickToggle();const days=[...document.querySelectorAll('#missbox .missone')].length;await missedOne('2026-11-23');const one=missedOpen().join();
      const shown=[];for(const t of ['2026-11-27','2026-11-29','2026-11-30']){at(t+'T08:00:00');sel=homeDay();renderToday();shown.push(!!card())}
      return {sync,first,toastTxt,days,one,shown}});
    ok(mc.sync===4,`the days missed are recorded in memory before Today is drawn, so its "last worn" and cleaning frame count them at once (${mc.sync})`);
    ok(/4 workdays you didn’t open the app/.test(mc.first)&&!/didn’t open the app/.test(mc.toastTxt),`the card says it, and no toast says it again ("${mc.toastTxt}")`);
    ok(mc.days===4&&mc.one==='2026-11-22,2026-11-24,2026-11-25',`"Choose days" marks one day at a time (${mc.one})`);
    ok(mc.shown.join()==='true,true,false',`the card shows on three days at most for the same missed days (${mc.shown.join()})`);

    // ---- W2-16-09: a holiday today
    const ho=await p.evaluate(()=>{fresh('2027-02-25T07:30:00');ward();settings.holidays={country:'KW',list:[{d:'2027-02-25',n:'National Day'},{d:'2027-02-26',n:'Liberation Day'}],skip:[],fetched:Date.now()};cache={};
      sel=homeDay();view={y:sel.getFullYear(),m:sel.getMonth()};show('today');renderToday();const t=document.querySelector('#offtoday');return t?t.textContent:''});
    ok(/Today is National Day, a day off\. This is Sunday’s outfit\./.test(ho),`Today says today is a holiday ("${ho}")`);

    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner records and chooses, not the fixed test plan
