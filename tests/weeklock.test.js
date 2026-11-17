// The week's locks, re-planning and frozen days, with the real planner.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/weeklock.test.js ---- */
// The current week stays as shown. Each workday from today through the coming Friday gets rec.lock (the pieces the plan showed,
// without the coat), and the planner keeps a locked day's pieces. So a change on one day (a different tie today, a new item, a day
// marked not worn) re-plans only the days after the lock. A change made on a locked day itself re-plans that day around the change
// and locks it again; a locked piece that is deleted releases only its day; Re-plan and the planner's settings release the lock.
// (Each weekday as today, both work weeks and the release of locks past Friday: tests/weeklockdays.test.js.)
function keyDate2(k){const [y,m,d]=k.split('-').map(Number);return +new Date(y,m-1,d)}
const weeklock=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // today is Monday 9 November 2026: the lock runs to Friday 13
    const setup=()=>p.evaluate(`(async()=>{const W=${WARDROBES};items=W.realistic.map(i=>({...i}));settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];delete settings.darkShirts;weather={};climate=null;TODAY_OVERRIDE='2026-11-09T12:00:00';
      dayRecs={};cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today');
      window.sig=o=>o?SLOTS.filter(s=>s!=='coat').map(s=>o[s]?o[s].id:'').join('|'):'';
      window.snap=()=>{const out={};for(const m of [10,11])for(const [k,o] of Object.entries(planMonth(2026,m)))if(keyDate(k)>=todayDate()&&o.top)out[k]=sig(o);return out};
      window.diff=(a,b)=>Object.keys(a).filter(k=>a[k]!==b[k])})()`);
    const locked=()=>p.waitForFunction(()=>['2026-11-9','2026-11-10','2026-11-11','2026-11-12','2026-11-13'].every(k=>dayRecs[k]&&dayRecs[k].lock),null,{timeout:8000});
    const AFTER='new Date(2026,10,14)';   // the Saturday after the lock
    await setup();await locked();
    const L=await p.evaluate(()=>{const pl=planFor();return {days:Object.values(dayRecs).filter(r=>r.lock).map(r=>r.date).sort((a,b)=>keyDate(a)-keyDate(b)).join(),
      same:Object.values(dayRecs).filter(r=>r.lock).every(r=>SLOTS.every(s=>s==='coat'||(r.lock[s]||null)===(pl[r.date][s]?pl[r.date][s].id:null))),coat:Object.values(dayRecs).some(r=>r.lock&&'coat' in r.lock)}});
    ok(L.days==='2026-11-9,2026-11-10,2026-11-11,2026-11-12,2026-11-13',`the workdays from today through Friday are locked, the next week not (${L.days})`);
    ok(L.same&&!L.coat,'a lock holds the pieces the plan showed, without the coat');
    // a different tie today: the locked days stay, later days may move
    const before=await p.evaluate(()=>snap());
    // (a tie not locked on another day of the week: one that is lets go of that day's lock, unlockClash in history.js; with the look in the
    // plan, PLAN_RULES 26, the first tie of another color was Thursday's, which moved Tuesday and Thursday)
    await p.evaluate(()=>{const o=planFor()[key(sel)],t=items.find(i=>i.type==='tie'&&i.id!==o.tie.id&&pcol(i)!==pcol(o.tie)&&!Object.values(dayRecs).some(r=>r.lock&&r.lock.tie===i.id));return pickItem('tie',t.id)});await settle(p,300);await locked();
    const a1=await p.evaluate(`(b=>{const n=snap(),d=diff(b,n);return {d,inLock:d.filter(k=>keyDate(k)<${AFTER}),today:n['2026-11-9']!==b['2026-11-9'],relocked:JSON.stringify(dayRecs['2026-11-9'].lock.tie)===JSON.stringify(planFor()['2026-11-9'].tie.id)}})(${JSON.stringify(before)})`);
    ok(a1.today&&a1.inLock.join()==='2026-11-9'&&a1.relocked,`a different tie today changes today only inside the lock (changed: ${a1.inLock.join()}), and today is locked as it now shows`);
    ok(a1.d.some(k=>keyDate2(k)>=+new Date(2026,10,14)),`days after the lock are planned again (${a1.d.length-1} of them changed)`);
    // without the lock the same change reshuffles the week
    const un=await p.evaluate(`(b=>{const keep=dayRecs;dayRecs=Object.fromEntries(Object.entries(keep).map(([k,r])=>{const c={...r};delete c.lock;return [k,c]}));cache={};const d=diff(b,snap()).filter(k=>keyDate(k)<${AFTER}&&k!=='2026-11-9');dayRecs=keep;cache={};return d})(${JSON.stringify(before)})`);
    ok(un.length>=1,`(without the lock the same change would have moved ${un.length} of the four other days this week)`);
    // a new item joins after the lock
    const b2=await p.evaluate(()=>snap());
    const a2=await p.evaluate(`(b=>{items.push({id:'newtie',type:'tie',primaryColor:'green',pattern:'paisley',secondaryColor:'navy'});cache={};const pl={...planMonth(2026,10),...planMonth(2026,11)},first=Object.keys(pl).filter(k=>pl[k].tie&&pl[k].tie.id==='newtie').sort((x,y)=>keyDate(x)-keyDate(y))[0];
      return {inLock:diff(b,snap()).filter(k=>keyDate(k)<${AFTER}),first}})(${JSON.stringify(b2)})`);
    ok(a2.inLock.length===0&&a2.first&&keyDate2(a2.first)>=+new Date(2026,10,14),`a new tie leaves the locked week alone and is first planned after it (${a2.first})`);
    // a locked piece that goes away releases only its own day
    const b3=await p.evaluate(()=>snap());
    const a3=await p.evaluate(`(b=>{const gone=planFor()['2026-11-12'].shirt.id;items=items.filter(i=>i.id!==gone);cache={};const n=snap(),d=diff(b,n).filter(k=>keyDate(k)<${AFTER});return {d,ok:!!planFor()['2026-11-12'].shirt&&planFor()['2026-11-12'].shirt.id!==gone}})(${JSON.stringify(b3)})`);
    ok(a3.d.join()==='2026-11-12'&&a3.ok,`deleting a shirt planned for Thursday re-plans Thursday only (changed in the lock: ${a3.d.join()})`);
    await p.evaluate(()=>renderToday());await p.waitForFunction(()=>dayRecs['2026-11-12'].lock.shirt===planFor()['2026-11-12'].shirt.id,null,{timeout:8000});
    ok(true,'Thursday is then locked as it now shows');
    // "Suggest another" on a locked day re-plans that day, and its followers, not the others
    await p.evaluate(()=>{sel=new Date(2026,10,13);renderToday()});const b4=await p.evaluate(()=>snap());
    await p.evaluate(()=>swapSlot('shoes'));await settle(p,300);
    const a4=await p.evaluate(`(b=>{const n=snap(),d=diff(b,n).filter(k=>keyDate(k)<${AFTER}),o=planFor()['2026-11-13'];return {d,belt:!o.belt||beltFit(o.shoes,o.belt)!==null,top:n['2026-11-13'].split('|')[0]===b['2026-11-13'].split('|')[0]}})(${JSON.stringify(b4)})`);
    ok(a4.d.join()==='2026-11-13'&&a4.belt&&a4.top,'another pair of shoes on Friday: its belt follows, the suit stays, and no other locked day moves');
    // rain on a locked day with suede shoes: the lock lets go
    const rn=await p.evaluate(()=>{const sue={id:'suede1',type:'shoes',primaryColor:'brown',pattern:'solid',leather:'suede'};items.push(sue);const k='2026-11-10';
      dayRecs[k]={date:k,lock:{...dayRecs[k].lock,shoes:'suede1',belt:null}};cache={};const dry=planFor()[k].shoes.id;weather[k]={tmax:15,tmin:8,pop:90,rain:6};cache={};const wet=planFor()[k].shoes.id;delete weather[k];items.pop();cache={};return {dry,wet}});
    ok(rn.dry==='suede1'&&rn.wet!=='suede1','locked suede shoes are kept on a dry day and let go when rain is forecast');
    const hot=await p.evaluate(()=>{const k='2026-11-10',o=planFor()[k],top=items.find(i=>i.id===o.top.id);top.season='cold';cache={};const mild=planFor()[k].top.id===top.id;weather[k]={tmax:33,tmin:22,pop:0,rain:0};cache={};const warm=planFor()[k].top.id!==top.id;delete weather[k];delete top.season;cache={};return {mild,warm}});
    ok(hot.mild&&hot.warm,'a locked cold-weather suit is kept on a mild day and let go when the forecast turns hot');
    // Re-plan releases the lock; so does a planner setting
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});await locked();
    const r1=await p.evaluate(async()=>{await replanFuture();return Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length});
    ok(r1===0,'Re-plan upcoming days releases the locks after today');
    await p.evaluate(()=>renderToday());await locked();
    await p.evaluate(()=>{openSettings('schedule')});await settle(p,400);
    const txt=await p.textContent('#replan-status');
    ok(/throwing out the week's locks/.test(txt),`Settings says starting over throws out the week's locks (${txt})`);
    await p.selectOption('#cfg-dark','often');await p.waitForFunction(()=>settings.darkShirts==='often'&&!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate()),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>settings.darkShirts==='often'&&!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate())&&!!dayRecs['2026-11-9'].lock),'Settings → Dark shirts saves the choice and releases the coming days (today stays)');
    await p.evaluate(()=>saveSettings());await locked();
    await p.evaluate(()=>{openSettings('schedule')});await settle(p,300);
    await p.click('#cfg-blazer button:nth-child(3)');await p.waitForFunction(()=>!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate()),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate())),'changing the blazer days releases them too');
    // days the app was not opened on: once they are past, the locked workdays are recorded with the pieces they showed (they kept
    // only the lock, so they never counted as worn and their outfits could still change)
    await setup();await locked();
    const lk=await p.evaluate(()=>Object.fromEntries(['2026-11-10','2026-11-11','2026-11-12','2026-11-13'].map(k=>[k,JSON.stringify(dayRecs[k].lock)])));
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T12:00:00';cache={};sel=new Date(2026,10,16);renderToday()});
    await p.waitForFunction(()=>['2026-11-10','2026-11-11','2026-11-12','2026-11-13'].every(k=>dayRecs[k]&&dayRecs[k].ids),null,{timeout:8000}).catch(()=>{});
    const past=await p.evaluate(lk=>{const strip=x=>{const c={...x};delete c.coat;return JSON.stringify(c)},ks=Object.keys(lk);
      return {ids:ks.every(k=>dayRecs[k].ids&&strip(dayRecs[k].ids)===lk[k]),worn:ks.every(k=>wornDays().some(w=>w.date===k))}},lk);
    ok(past.ids&&past.worn,`locked workdays that passed without the app being opened are recorded with the pieces they showed and count as worn (${JSON.stringify(past)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (locks hold what the planner chose); other tests get tests/fixedplan.js

/* ---- was tests/replan.test.js ---- */
// Re-planning: swaps pin pieces on a day (force/skip) and the coming week is locked as shown (lock); when the planning rules change
// (PLAN_RULES) the app releases the locks on every day after today so the new rules apply, keeping the owner's picks, formal days,
// today and the past. Settings' Start the plan over clears today and the coming days, picks too, on demand.
const replan=async({ok,chromium,url})=>{
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
    await p.evaluate(setup);await p.evaluate(()=>{localStorage.setItem('plan_rules','1');return metaPut('plan_rules',1)});   // (the phone's own number: fix round 3)
    const r=await p.evaluate(async()=>{await checkPlanRules();const R=k=>JSON.stringify(Object.keys(dayRecs[k]).filter(x=>x!=='updated'&&x!=='fs').sort());
      return {rules:(await metaGet('plan_rules'))===PLAN_RULES,past:R('2026-11-5'),today:R('2026-11-9'),f10:R('2026-11-10'),f17:R('2026-11-17'),f18:R('2026-11-18'),formal:R('2026-11-23'),dec:R('2026-12-6'),
        n17:planFor()['2026-11-17'].top.id,toast:document.querySelector('#toast').textContent}});
    // (2026-11-14, the audit: a bump used to clear the owner's picks on every upcoming day, so planning changes went without one)
    ok(r.rules&&r.f10==='["date"]'&&r.f17==='["date","force","ids","skip","vest"]','after a rules change the week\'s locks on upcoming days are released');
    ok(r.f18==='["date","force"]'&&r.dec==='["date","vest"]'&&r.n17==='suit1','the owner\'s own picks (swaps, skips, the vest) stay');
    ok(r.formal==='["date","force","formal"]','formal days stay formal, with their picks');
    ok(r.past==='["date","force","ids","worn"]'&&r.today==='["date","force","skip"]','today and past days are left alone');
    await p.waitForFunction(()=>/planner was updated.*own picks were kept/.test(document.querySelector('#toast').textContent),null,{timeout:5000}).catch(()=>{});
    ok(/planner was updated.*own picks were kept/.test(await p.textContent('#toast')),'a note says the upcoming days were planned again');
    ok(await p.evaluate(async()=>{dayRecs['2026-11-18']={date:'2026-11-18',force:{top:'suit3'},lock:{top:'suit3'}};await checkPlanRules();return !!dayRecs['2026-11-18'].lock}),'it happens once per rules change: later locks are kept');
    // Settings → Schedule → Start the plan over (2026-11-14, the owner: "completely redo the plan, throwing out my locks and changes"): today
    // and every coming day not marked worn lose their locks and the owner's changes (swaps, picks, the vest, a piece taken off, the suit or
    // blazer chosen); occasions, worn days and the past stay. Not among the owner's Advanced tools any more: anyone can use it
    await p.evaluate(async()=>{for(const k of Object.keys(dayRecs))if(k!=='2026-11-18'&&k!=='2026-11-5'&&k!=='2026-11-9')delete dayRecs[k];
      dayRecs['2026-11-19']={date:'2026-11-19',off:{top:true},force:{top:'suit1'},kind:'suit'};
      dayRecs['2026-11-20']={date:'2026-11-20',occasion:'wedding',force:{top:'suit2'},lock:{top:'suit2'}};
      dayRecs['2026-11-12']={date:'2026-11-12',lock:{top:'suit3'},lockOnly:1,base:0};
      dayRecs['2026-11-13']={date:'2026-11-13',force:{top:'suit3'},worn:true};cache={}});
    await p.evaluate(()=>openSettings('schedule'));
    const st=await p.textContent('#replan-status'),vis=await p.evaluate(()=>{const b=document.querySelector('#replan-btn');return !!b&&!b.closest('.adv')&&b.getBoundingClientRect().height>=44&&b.textContent==='Start the plan over'});
    ok(/^4 days have your changes/.test(st)&&vis,`Settings → Schedule shows "Start the plan over" outside the Advanced fold, with how many days have changes, today included ("${st.slice(0,60)}")`);
    await p.click('#replan-btn');const q=await p.textContent('#ask-sheet').catch(()=>'');await p.click('#ask-ok');
    await p.waitForFunction(()=>/Started over/.test($('#replan-status').textContent),null,{timeout:5000}).catch(()=>{});
    const R=await p.evaluate(()=>{const g=k=>dayRecs[k]||{};return {today:!g('2026-11-9').force&&!g('2026-11-9').skip,d18:!g('2026-11-18').force,d19:!g('2026-11-19').off&&!g('2026-11-19').force&&!g('2026-11-19').kind,
      d20:g('2026-11-20').occasion==='wedding'&&!g('2026-11-20').force,d12:!g('2026-11-12').lock||g('2026-11-12').lock.top!=='suit3',worn:!!g('2026-11-13').force&&g('2026-11-13').worn===true,past:!!g('2026-11-5').force,msg:$('#replan-status').textContent}});
    ok(/Start the plan over\?/.test(q)&&/Occasions, days off, days marked worn and the past stay/.test(q),'it asks first, saying what is kept');
    ok(R.today&&R.d18&&R.d19&&R.d12&&/Started over/.test(R.msg),`today and the coming days are planned afresh: picks, swaps, a jacket taken off and the week's locks are gone (${JSON.stringify(R)})`);
    ok(R.d20&&R.worn&&R.past,'the wedding stays a wedding, and days marked worn and the past are untouched');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (it checks re-planning (checkPlanRules)); other tests get tests/fixedplan.js

/* ---- was tests/w3plan.test.js ---- */
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
const w3plan=async({ok,chromium,url})=>{
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
    const pr=await p.evaluate(async()=>{fresh();ward();at('2026-11-15T07:30:00');await lockUpcoming();await planRulesNote(PLAN_RULES);settings.planRules=PLAN_RULES-4;
      const locks=()=>Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length,a=locks();await checkPlanRules();const b=locks();
      await planRulesNote(PLAN_RULES-1);await checkPlanRules();return {a,b,c:locks(),mine:await metaGet('plan_rules')}});
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
      const shown=[];for(const t of ['2026-11-27','2026-11-29','2026-11-30']){at(t+'T08:00:00');sel=homeDay();renderToday();shown.push(!!card());await recordRun}
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
// (realPlanner) it checks what the planner records and chooses, not the fixed test plan

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['weeklock',weeklock],['replan',replan],['w3plan',w3plan]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
