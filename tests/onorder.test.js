// Bought, on the way: the Add card can mark an item as bought but not here yet, with an optional arrival date. It goes into the
// wardrobe out of rotation; with a date the plan includes it from the day after (already, for the weeks ahead), and once that
// day comes it is put back in rotation for good. Without a date it waits for "It arrived: put in rotation" in the Wardrobe.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('navy','suit','navy'),I('char','suit','charcoal'),I('sh1','shirt','white'),I('sh2','shirt','lightblue'),I('t1','tie','burgundy'),I('t2','tie','navy'),
        I('bs','shoes','black',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('so','socks','charcoal')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,11);view={y:2026,m:10}});
    // the Add card
    await p.evaluate(()=>{show('add');addManual();setq(0,'type','suit');setq(0,'primaryColor','grey')});
    const c0=await p.evaluate(()=>({btn:document.querySelector('.ordrow .rotbtn').textContent,date:!!document.querySelector('.ordrow input[type=date]')}));
    ok(c0.btn==='Bought, on the way'&&!c0.date,'the Add card has a "Bought, on the way" button; the date only shows once it is on');
    await p.click('.ordrow .rotbtn');
    const c1=await p.evaluate(()=>({pressed:document.querySelector('.ordrow .rotbtn').getAttribute('aria-pressed'),date:document.querySelector('.ordrow input[type=date]'),hint:document.querySelector('.ordhint').textContent}));
    ok(c1.pressed==='true'&&c1.date&&/until you put it back in rotation/.test(c1.hint),'turned on: an optional Arrives date, and without one it waits to be put back by hand');
    await p.fill('.ordrow input[type=date]','2026-11-20');await p.dispatchEvent('.ordrow input[type=date]','change');
    ok(/from the day after Nov 20/.test(await p.textContent('.ordhint')),'with a date: it joins the outfits from the day after');
    await p.evaluate(async()=>{const q=queue[0];q.id='grey';await save(0)});
    const it=await p.evaluate(()=>{const i=items.find(x=>x.id==='grey');return {paused:i.paused,order:i.order,arrives:i.arrives}});
    ok(it.paused===true&&it.order===true&&it.arrives==='2026-11-20','it is saved to the wardrobe, out of rotation, with the arrival date');
    // the plan: not before the day after it arrives, then yes
    const plan=await p.evaluate(()=>{const days={};for(const m of [10,11])for(const [k,o] of Object.entries(planMonth(2026,m)))if(o.top)days[k]=o.top.id;return days});
    const ks=Object.keys(plan).filter(k=>plan[k]==='grey').map(k=>+k.split('-')[2]+(k.split('-')[1]==='12'?30:0));
    ok(ks.length>0&&Math.min(...ks)>20,`the plan already includes it, but only after Nov 20 (first on day ${Math.min(...ks)})`);
    // picker on a day before / after
    const pk=await p.evaluate(()=>{const ids=d=>{sel=d;const o=planFor()[key(sel)];return slotPool('top',o).map(i=>i.id)};return {before:ids(new Date(2026,10,18)),after:ids(new Date(2026,10,23))}});
    ok(!pk.before.includes('grey')&&pk.after.includes('grey'),'the picker offers it only for days after it arrives');
    // the Wardrobe shows it
    await p.evaluate(()=>{flt='all';editing=null;show('wardrobe')});
    ok(/On the way · Nov 20/.test(await p.textContent('#gi-grey')),'its box says "On the way · Nov 20"');
    await p.evaluate(()=>openItem('grey'));await settle(p,500);
    const ed=await p.evaluate(()=>({btn:document.querySelector('#gi-grey .rotbtn').textContent,date:(document.querySelector('#gi-grey .rotnote input[type=date]')||{}).value}));
    ok(ed.btn==='It arrived: put in rotation'&&ed.date==='2026-11-20','the open item can change the date or mark it arrived');
    // the day after arrival: back in rotation for good, with a message
    const ar=await p.evaluate(async()=>{TODAY_OVERRIDE='2026-11-20T12:00:00';const a=await checkArrivals();TODAY_OVERRIDE='2026-11-21T09:00:00';const b=await checkArrivals();
      const i=items.find(x=>x.id==='grey');return {a,b,paused:'paused' in i,order:'order' in i,arrives:'arrives' in i,toast:(document.querySelector('#toast')||{}).textContent||''}});
    ok(ar.a===0&&ar.b===1&&!ar.paused&&!ar.order&&!ar.arrives&&/has arrived: it's in rotation now/.test(ar.toast),'on its arrival day it still waits; the day after, it is put in rotation and the app says so');
    // no date: stays out until put back by hand
    await p.evaluate(async()=>{TODAY_OVERRIDE='2026-11-11T12:00:00';cache={};show('add');addManual();setq(0,'type','tie');setOrder(0,true);queue[0].id='tnew';await save(0)});
    const nd=await p.evaluate(async()=>{TODAY_OVERRIDE='2027-02-01T12:00:00';const n=await checkArrivals();cache={};const used=Object.values(planMonth(2027,1)).some(o=>o.tie&&o.tie.id==='tnew');
      return {n,used,why:whyUnused(items.find(i=>i.id==='tnew'))}});
    ok(nd.n===0&&!nd.used&&/on the way: put it back in rotation once it arrives/.test(nd.why),'without a date it stays out of the plan until put back by hand (months later too), and the stats say why');
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-11T12:00:00';flt='all';show('wardrobe');openItem('tnew')});await settle(p,500);
    await p.click('#gi-tnew .rotbtn');await p.waitForFunction(()=>!('paused' in items.find(i=>i.id==='tnew'))&&!('order' in items.find(i=>i.id==='tnew')));
    ok(true,'"It arrived: put in rotation" puts it back and clears the order');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
