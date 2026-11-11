// Taking an item out of rotation (Wardrobe item → "Take out of rotation"): it stays in the wardrobe and in the outfits already
// worn, the planner never picks it for upcoming days, the picker and "Suggest another" don't offer it (correcting a past day
// still does), upcoming days it was pinned to are planned again, and "Put back in rotation" brings it back.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('navy','suit','navy'),I('grey','suit','grey'),I('char','suit','charcoal'),I('sh1','shirt','white'),I('sh2','shirt','lightblue'),I('t1','tie','burgundy'),I('t2','tie','navy'),
        I('bs','shoes','black',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('so','socks','charcoal')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];TODAY_OVERRIDE='2026-11-11T12:00:00';cache={};
      // the navy suit was worn last Monday (a frozen past day) and is pinned by a swap to next Monday
      dayRecs={'2026-11-9':{date:'2026-11-9',ids:{top:'navy',shirt:'sh1',tie:'t1',shoes:'bs',belt:'bb',socks:'so'},suitDay:true,worn:true},
        '2026-11-16':{date:'2026-11-16',force:{top:'navy'}}};
      sel=new Date(2026,10,11);view={y:2026,m:10};editing=null;flt='all';show('wardrobe')});
    const tops=()=>p.evaluate(()=>{const out=[];for(const m of [10,11])for(const [k,o] of Object.entries(planMonth(2026,m)))if(keyDate(k)>=todayDate()&&o.top)out.push(o.top.id);return out});
    const before=await tops();
    ok(before.includes('navy'),`before: the navy suit is in the upcoming plan (${before.filter(x=>x==='navy').length} days)`);
    // the button in the item's details
    await p.evaluate(()=>openItem('navy'));await settle(p,500);
    const b0=await p.evaluate(()=>{const b=document.querySelector('#gi-navy .rotbtn');return b&&{t:b.textContent,pressed:b.getAttribute('aria-pressed')}});
    ok(b0&&b0.t==='Take out of rotation'&&b0.pressed==='false','the open item has a "Take out of rotation" button beside Close and Delete');
    await p.click('#gi-navy .rotbtn');await p.waitForFunction(()=>items.find(i=>i.id==='navy').paused===true);await settle(p,500);
    const st=await p.evaluate(()=>({btn:document.querySelector('#gi-navy .rotbtn').textContent,note:(document.querySelector('#gi-navy .rotnote')||{}).textContent||'',
      still:items.some(i=>i.id==='navy'),pin:dayRecs['2026-11-16'].force,past:dayRecs['2026-11-9'].ids.top}));
    ok(st.still&&st.btn==='Put back in rotation'&&/planner won't pick it/.test(st.note)&&/Outfits you already wore keep it/.test(st.note),'it stays in the wardrobe; the button now says "Put back in rotation" and a note says what it means');
    ok(!st.pin&&st.past==='navy','the upcoming day it was pinned to is let go; the worn day keeps it');
    const after=await tops();
    ok(!after.includes('navy')&&after.length===before.length,`the planner no longer picks it for any upcoming day (${after.length} days still planned with the other suits)`);
    const past=await p.evaluate(()=>{const o=planMonth(2026,10)['2026-11-9'];return o&&o.top&&o.top.id});
    ok(past==='navy','the outfit already worn still shows the navy suit');
    // closed: the box says so
    await p.evaluate(()=>closeItem());await settle(p,500);
    ok(await p.evaluate(()=>{const g=document.querySelector('#gi-navy');return g.classList.contains('paused')&&/Out of rotation/.test(g.textContent)}),'its box in the grid is dimmed and tagged "Out of rotation"');
    // picker and Suggest another on today leave it out; correcting a past day offers it
    const pick=await p.evaluate(async()=>{sel=new Date(2026,10,11);show('today');const o=planFor()[key(sel)],today=slotPool('top',o).map(i=>i.id);
      const pastO=planFor()['2026-11-9'],pastPool=slotPool('top',pastO).map(i=>i.id);
      const seen=new Set([o.top.id]);for(let n=0;n<4;n++){await swapSlot('top');seen.add(planFor()[key(sel)].top.id)}return {today,pastPool,seen:[...seen]}});
    ok(!pick.today.includes('navy')&&pick.today.length===2,`the picker doesn't offer it for today (${pick.today})`);
    ok(pick.pastPool.includes('navy'),'correcting a past day still offers it (it may have been worn then)');
    ok(!pick.seen.includes('navy'),`"Suggest another" cycles without it (${pick.seen})`);
    // stats explain it
    ok(await p.evaluate(()=>whyUnused(items.find(i=>i.id==='navy'))==='You took it out of rotation, so the planner leaves it out.'),'the stats page gives the reason it is not planned');
    // put it back
    await p.evaluate(()=>{show('wardrobe');openItem('navy')});await settle(p,500);await p.click('#gi-navy .rotbtn');await p.waitForFunction(()=>!('paused' in items.find(i=>i.id==='navy'))&&document.querySelector('#gi-navy .rotbtn').textContent==='Take out of rotation');
    const back=await tops();
    ok(back.includes('navy')&&await p.evaluate(()=>!document.querySelector('#gi-navy .rotnote')&&document.querySelector('#gi-navy .rotbtn').textContent==='Take out of rotation'),`"Put back in rotation" brings it back into the plan (${back.filter(x=>x==='navy').length} days)`);
    // the only belt out of rotation: no belt, and no complaint about belts in the score
    const belt=await p.evaluate(()=>{items.find(i=>i.id==='bb').paused=true;cache={};const o=planFor()['2026-11-12'];return {belt:o.belt,checks:rateOutfit(o).checks.map(c=>c.label)}});
    ok(belt.belt===null,'with its only belt out of rotation, the outfit has no belt rather than the paused one');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
