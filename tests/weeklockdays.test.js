// The week's locks run from today through the coming Friday (the owner, 2026-11-15: "only lock today through Friday ... a current
// week lock"), not seven days: each weekday as today, with a Sunday-Thursday week and a Monday-Friday week, locks only that week's
// remaining workdays; a Saturday locks the next Sunday to Friday; a Friday locks today alone when it is a workday. Locks past Friday
// (made when the lock ran seven days) are let go on the next run, keeping the owner's own picks, a kept trip and a day marked worn.
// Day numbers, not dates: where the clocks go forward at midnight (Santiago) the window is the same.
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const run=async(tz,fn,arg)=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...(tz?{timezoneId:tz}:{})}),p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(`(async()=>{const W=${WARDROBES};items=W.realistic.map(i=>({...i}));settings.holidays=null;settings.daysOff=[];weather={};climate=null;
        try{await recordRun}catch{}
        // lock from a given day (iso) with the given workdays; returns the locked days (key format) in order
        window.lockFrom=async(iso,wd,recs)=>{settings.workdays=wd;TODAY_OVERRIDE=iso+'T12:00:00';dayRecs=recs||{};cache={};await lockUpcoming();
          return Object.values(dayRecs).filter(r=>r.lock).map(r=>r.date).sort((a,b)=>keyDate(a)-keyDate(b)).join()}})()`);
      const out=await p.evaluate(fn,arg);await ctx.close();return {out,errs}};
    // the week of Sunday 15 November 2026 to Saturday 21 November
    const SUNTHU=[0,1,2,3,4],MONFRI=[1,2,3,4,5],D=n=>'2026-11-'+n,L=(...ns)=>ns.map(D).join();
    const cases=[
      ['Sunday',15,SUNTHU,L(15,16,17,18,19)],['Monday',16,SUNTHU,L(16,17,18,19)],['Tuesday',17,SUNTHU,L(17,18,19)],['Wednesday',18,SUNTHU,L(18,19)],
      ['Thursday',19,SUNTHU,L(19)],['Friday',20,SUNTHU,''],['Saturday',21,SUNTHU,L(22,23,24,25,26)],
      ['Sunday',15,MONFRI,L(16,17,18,19,20)],['Monday',16,MONFRI,L(16,17,18,19,20)],['Tuesday',17,MONFRI,L(17,18,19,20)],['Wednesday',18,MONFRI,L(18,19,20)],
      ['Thursday',19,MONFRI,L(19,20)],['Friday',20,MONFRI,L(20)],['Saturday',21,MONFRI,L(23,24,25,26,27)]];
    const r=await run(null,async cs=>{const out=[];for(const [,n,wd] of cs)out.push(await lockFrom('2026-11-'+String(n).padStart(2,'0'),wd));
      // a day off inside the week is not locked
      settings.daysOff=[{d:'2026-11-18',n:'Day off'}];const off=await lockFrom('2026-11-16',[1,2,3,4,5]);settings.daysOff=[];
      // locks past Friday let go, the owner's own picks kept; a kept trip and a day marked worn keep theirs
      const id=t=>items.find(i=>i.type===t).id,any=()=>({top:id('suit'),tie:id('tie'),shirt:id('shirt')}),recs={
        '2026-11-23':{date:'2026-11-23',lock:any(),lockAt:1,force:{tie:id('tie')},skip:{shirt:[id('shirt')]},vest:true,kind:'suit',off:{tie:true},updated:5},
        '2026-11-24':{date:'2026-11-24',lock:any(),lockAt:1,updated:5},
        '2026-11-25':{date:'2026-11-25',lock:any(),trip:1,updated:5},
        '2026-11-26':{date:'2026-11-26',lock:any(),worn:true,updated:5}};
      await lockFrom('2026-11-16',[1,2,3,4,5],recs);const a=dayRecs['2026-11-23'],b=dayRecs['2026-11-24'],c=dayRecs['2026-11-25'],w=dayRecs['2026-11-26'];
      const stored=await txs('days','readonly',s=>s.get('2026-11-23')).catch(()=>null);
      const rel={pastGone:!a.lock&&!b.lock,picks:JSON.stringify(a.force)===JSON.stringify({tie:id('tie')})&&JSON.stringify(a.skip)===JSON.stringify({shirt:[id('shirt')]})&&a.vest===true&&a.kind==='suit'&&!!a.off&&a.off.tie===true,
        lockOnly:a.lockOnly===1&&a.base===5,trip:!!c.lock,worn:!!w.lock,stored:!!stored&&!stored.lock&&!!stored.force,inWeek:['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'].every(k=>dayRecs[k]&&dayRecs[k].lock)};
      // a Friday: next week's locks from an earlier run go, today stays locked
      const fri=await lockFrom('2026-11-20',[1,2,3,4,5],{'2026-11-23':{date:'2026-11-23',lock:any(),updated:1}});
      return {out,off,rel,fri}},cases.map(c=>[c[0],c[1],c[2]]));
    cases.forEach(([day,n,wd,want],i)=>ok(r.out.out[i]===want,`${wd===SUNTHU?'Sun–Thu':'Mon–Fri'} week, today ${day} ${n} Nov: locks ${want||'nothing'} (${r.out.out[i]||'nothing'})`));
    ok(r.out.off===L(16,17,19,20),`a day off inside the week gets no lock (${r.out.off})`);
    const rel=r.out.rel;
    ok(rel.pastGone&&rel.inWeek,`locks past Friday are let go on the next run, this week's are locked (${JSON.stringify(rel)})`);
    ok(rel.picks,'the owner\'s own picks on a released day stay (force, skip, the vest, kind, a piece taken off)');
    ok(rel.lockOnly&&rel.stored,'the release is saved as a lock-only change (lockOnly, base: core.js dayWins) and stored');
    ok(rel.trip&&rel.worn,'a kept trip\'s lock and a day marked worn keep theirs');
    ok(r.out.fri===L(20),`on a Friday only today stays locked, next week's lock goes (${r.out.fri})`);
    // Santiago: the clocks go forward at midnight into Sunday 6 September 2026 (the day starts at 01:00)
    const s=await run('America/Santiago',async()=>{const sat=await lockFrom('2026-09-05',[1,2,3,4,5],{'2026-9-14':{date:'2026-9-14',lock:{tie:'y'},updated:1}});
      const thu=await lockFrom('2026-09-03',[1,2,3,4,5]);const sun=await lockFrom('2026-09-06',[0,1,2,3,4]);return {sat,thu,sun}});
    ok(s.out.sat==='2026-9-7,2026-9-8,2026-9-9,2026-9-10,2026-9-11',`Santiago, Saturday before the clocks change: next Monday to Friday locked, a lock after it let go (${s.out.sat})`);
    ok(s.out.thu==='2026-9-3,2026-9-4'&&s.out.sun==='2026-9-6,2026-9-7,2026-9-8,2026-9-9,2026-9-10',`Santiago: Thursday locks to Friday, the Sunday the clocks change locks its week (${s.out.thu} | ${s.out.sun})`);
    ok(r.errs.length===0&&s.errs.length===0,'no page errors ('+[...r.errs,...s.errs].join('; ')+')');
  }finally{await browser.close()}
};
