// The coming week stays as shown. Each workday of the next seven days gets rec.lock (the pieces the plan showed, without the
// coat), and the planner keeps a locked day's pieces. So a change on one day (a different tie today, a new item, a day marked not
// worn) re-plans only the days after the lock. A change made on a locked day itself re-plans that day around the change and locks
// it again; a locked piece that is deleted releases only its day; Re-plan and the planner's settings release the lock.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=()=>p.evaluate(`(async()=>{const W=${WARDROBES};items=W.realistic.map(i=>({...i}));settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];delete settings.darkShirts;weather={};climate=null;TODAY_OVERRIDE='2026-11-11T12:00:00';
      dayRecs={};cache={};sel=new Date(2026,10,11);view={y:2026,m:10};show('today');
      window.sig=o=>o?SLOTS.filter(s=>s!=='coat').map(s=>o[s]?o[s].id:'').join('|'):'';
      window.snap=()=>{const out={};for(const m of [10,11])for(const [k,o] of Object.entries(planMonth(2026,m)))if(keyDate(k)>=todayDate()&&o.top)out[k]=sig(o);return out};
      window.diff=(a,b)=>Object.keys(a).filter(k=>a[k]!==b[k])})()`);
    const locked=()=>p.waitForFunction(()=>['2026-11-11','2026-11-12','2026-11-13','2026-11-16','2026-11-17'].every(k=>dayRecs[k]&&dayRecs[k].lock),null,{timeout:8000});
    await setup();await locked();
    const L=await p.evaluate(()=>{const pl=planFor();return {days:Object.values(dayRecs).filter(r=>r.lock).map(r=>r.date).sort((a,b)=>keyDate(a)-keyDate(b)).join(),
      same:Object.values(dayRecs).filter(r=>r.lock).every(r=>SLOTS.every(s=>s==='coat'||(r.lock[s]||null)===(pl[r.date][s]?pl[r.date][s].id:null))),coat:Object.values(dayRecs).some(r=>r.lock&&'coat' in r.lock)}});
    ok(L.days==='2026-11-11,2026-11-12,2026-11-13,2026-11-16,2026-11-17',`the workdays of the next seven days are locked, weekends not (${L.days})`);
    ok(L.same&&!L.coat,'a lock holds the pieces the plan showed, without the coat');
    // a different tie today: the locked days stay, later days may move
    const before=await p.evaluate(()=>snap());
    await p.evaluate(()=>{const o=planFor()[key(sel)],t=items.find(i=>i.type==='tie'&&i.id!==o.tie.id&&pcol(i)!==pcol(o.tie));return pickItem('tie',t.id)});await settle(p,300);await locked();
    const a1=await p.evaluate(b=>{const n=snap(),d=diff(b,n);return {d,inLock:d.filter(k=>keyDate(k)<new Date(2026,10,18)),today:n['2026-11-11']!==b['2026-11-11'],relocked:JSON.stringify(dayRecs['2026-11-11'].lock.tie)===JSON.stringify(planFor()['2026-11-11'].tie.id)}},before);
    ok(a1.today&&a1.inLock.join()==='2026-11-11'&&a1.relocked,`a different tie today changes today only inside the lock (changed: ${a1.inLock.join()}), and today is locked as it now shows`);
    ok(a1.d.some(k=>keyDate2(k)>=+new Date(2026,10,18)),`days after the lock are planned again (${a1.d.length-1} of them changed)`);
    // without the lock the same change reshuffles the coming week
    const un=await p.evaluate(b=>{const keep=dayRecs;dayRecs=Object.fromEntries(Object.entries(keep).map(([k,r])=>{const c={...r};delete c.lock;return [k,c]}));cache={};const d=diff(b,snap()).filter(k=>keyDate(k)<new Date(2026,10,18)&&k!=='2026-11-11');dayRecs=keep;cache={};return d},before);
    ok(un.length>=1,`(without the lock the same change would have moved ${un.length} of the four other days this week)`);
    // a new item joins after the lock
    const b2=await p.evaluate(()=>snap());
    const a2=await p.evaluate(b=>{items.push({id:'newtie',type:'tie',primaryColor:'green',pattern:'paisley',secondaryColor:'navy'});cache={};const pl={...planMonth(2026,10),...planMonth(2026,11)},first=Object.keys(pl).filter(k=>pl[k].tie&&pl[k].tie.id==='newtie').sort((x,y)=>keyDate(x)-keyDate(y))[0];
      return {inLock:diff(b,snap()).filter(k=>keyDate(k)<new Date(2026,10,18)),first}},b2);
    ok(a2.inLock.length===0&&a2.first&&keyDate2(a2.first)>=+new Date(2026,10,18),`a new tie leaves the locked week alone and is first planned after it (${a2.first})`);
    // a locked piece that goes away releases only its own day
    const b3=await p.evaluate(()=>snap());
    const a3=await p.evaluate(b=>{const gone=planFor()['2026-11-16'].shirt.id;items=items.filter(i=>i.id!==gone);cache={};const n=snap(),d=diff(b,n).filter(k=>keyDate(k)<new Date(2026,10,18));return {d,ok:!!planFor()['2026-11-16'].shirt&&planFor()['2026-11-16'].shirt.id!==gone}},b3);
    ok(a3.d.join()==='2026-11-16'&&a3.ok,`deleting a shirt planned for Monday re-plans Monday only (changed in the lock: ${a3.d.join()})`);
    await p.evaluate(()=>renderToday());await p.waitForFunction(()=>dayRecs['2026-11-16'].lock.shirt===planFor()['2026-11-16'].shirt.id,null,{timeout:8000});
    ok(true,'Monday is then locked as it now shows');
    // "Suggest another" on a locked day re-plans that day, and its followers, not the others
    await p.evaluate(()=>{sel=new Date(2026,10,13);renderToday()});const b4=await p.evaluate(()=>snap());
    await p.evaluate(()=>swapSlot('shoes'));await settle(p,300);
    const a4=await p.evaluate(b=>{const n=snap(),d=diff(b,n).filter(k=>keyDate(k)<new Date(2026,10,18)),o=planFor()['2026-11-13'];return {d,belt:!o.belt||beltFit(o.shoes,o.belt)!==null,top:n['2026-11-13'].split('|')[0]===b['2026-11-13'].split('|')[0]}},b4);
    ok(a4.d.join()==='2026-11-13'&&a4.belt&&a4.top,'another pair of shoes on Friday: its belt follows, the suit stays, and no other locked day moves');
    // rain on a locked day with suede shoes: the lock lets go
    const rn=await p.evaluate(()=>{const sue={id:'suede1',type:'shoes',primaryColor:'brown',pattern:'solid',leather:'suede'};items.push(sue);const k='2026-11-17',o=planFor()[k];
      dayRecs[k]={date:k,lock:{...dayRecs[k].lock,shoes:'suede1',belt:null}};cache={};const dry=planFor()[k].shoes.id;weather[k]={tmax:15,tmin:8,pop:90,rain:6};cache={};const wet=planFor()[k].shoes.id;delete weather[k];items.pop();cache={};return {dry,wet}});
    ok(rn.dry==='suede1'&&rn.wet!=='suede1','locked suede shoes are kept on a dry day and let go when rain is forecast');
    const hot=await p.evaluate(()=>{const k='2026-11-17',o=planFor()[k],top=items.find(i=>i.id===o.top.id);top.season='cold';cache={};const mild=planFor()[k].top.id===top.id;weather[k]={tmax:33,tmin:22,pop:0,rain:0};cache={};const warm=planFor()[k].top.id!==top.id;delete weather[k];delete top.season;cache={};return {mild,warm}});
    ok(hot.mild&&hot.warm,'a locked cold-weather suit is kept on a mild day and let go when the forecast turns hot');
    // Re-plan releases the lock; so does a planner setting
    await p.evaluate(()=>{sel=new Date(2026,10,11);renderToday()});await locked();
    const r1=await p.evaluate(async()=>{await replanFuture();return Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length});
    ok(r1===0,'Re-plan upcoming days releases the locks after today');
    await p.evaluate(()=>renderToday());await locked();
    await p.evaluate(()=>{openSettings('schedule')});await settle(p,400);
    const txt=await p.textContent('#replan-status');
    ok(/coming week stays as shown/.test(txt),`Settings says the coming week is kept (${txt})`);
    await p.selectOption('#cfg-dark','often');await p.waitForFunction(()=>settings.darkShirts==='often'&&!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate()),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>settings.darkShirts==='often'&&!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate())&&!!dayRecs['2026-11-11'].lock),'Settings → Dark shirts saves the choice and releases the coming days (today stays)');
    await p.evaluate(()=>saveSettings());await locked();
    await p.evaluate(()=>{openSettings('schedule')});await settle(p,300);
    await p.click('#cfg-blazer button:nth-child(3)');await p.waitForFunction(()=>!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate()),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>!Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>todayDate())),'changing the blazer days releases them too');
    // days the app was not opened on: once they are past, the locked workdays are recorded with the pieces they showed (they kept
    // only the lock, so they never counted as worn and their outfits could still change)
    await setup();await locked();
    const lk=await p.evaluate(()=>Object.fromEntries(['2026-11-12','2026-11-13','2026-11-16','2026-11-17'].map(k=>[k,JSON.stringify(dayRecs[k].lock)])));
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-18T12:00:00';cache={};sel=new Date(2026,10,18);renderToday()});
    await p.waitForFunction(()=>['2026-11-12','2026-11-13','2026-11-16','2026-11-17'].every(k=>dayRecs[k]&&dayRecs[k].ids),null,{timeout:8000}).catch(()=>{});
    const past=await p.evaluate(lk=>{const strip=x=>{const c={...x};delete c.coat;return JSON.stringify(c)},ks=Object.keys(lk);
      return {ids:ks.every(k=>dayRecs[k].ids&&strip(dayRecs[k].ids)===lk[k]),worn:ks.every(k=>wornDays().some(w=>w.date===k))}},lk);
    ok(past.ids&&past.worn,`locked workdays that passed without the app being opened are recorded with the pieces they showed and count as worn (${JSON.stringify(past)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
function keyDate2(k){const [y,m,d]=k.split('-').map(Number);return +new Date(y,m-1,d)}
module.exports.realPlanner=true;   // runs the real planner (locks hold what the planner chose); other tests get tests/fixedplan.js
