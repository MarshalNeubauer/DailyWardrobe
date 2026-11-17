// The score card's advice after an edit (fix round A, 2026-11-17; the code review's CR-4-05): it was kept by the day, the outfit's ids,
// the vest and the number of items only, so a piece taken out of rotation in its sheet was still offered ("Could be N", "Wear the …"),
// and its tap saved a pick the planner ignores. Now it is worked out again whenever the plan is (adviceMemo keyed on the plan cache).
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // a day whose score card offers a swap, its outfit pinned (a pick on every slot) so it stays the same when the swap's piece goes
    const s=await p.evaluate(async W=>{W=eval(W);items=W.awkward.map(i=>({...i}));settings.holidays=null;settings.daysOff=[];weather={};climate=null;
      dayRecs={};let k=null,fx=null;
      // (the day is today: the Today tab comes back to it after the item sheet)
      for(let d=new Date(2026,10,16);d<new Date(2026,11,31)&&!fx;d.setDate(d.getDate()+1)){if(!isWorkday(d))continue;TODAY_OVERRIDE=isoKey(d)+'T09:00:00';cache={};sel=new Date(d);view={y:d.getFullYear(),m:d.getMonth()};const o=planFor()[key(sel)],a=o&&adviceFor(o);if(a&&a.fixes.length){k=key(sel);fx=a.fixes[0]}}
      if(!fx)return null;const o=planFor()[k],f={};for(const sl of SLOTS)if(o[sl]&&!(sl==='bot'&&o.suitDay))f[sl]=o[sl].id;
      await saveDay({date:k,force:f,kind:o.suitDay?'suit':'blazer'});cache={};scoreOpen=false;show('today');return {k,id:fx.item.id}},WARDROBES);
    ok(!!s,'a day with a suggested swap is found');if(!s)return;
    const offered=()=>p.evaluate(id=>{const o=planFor()[key(sel)],a=adviceFor(o);return {card:a.fixes.some(f=>f.item.id===id),btn:[...document.querySelectorAll('#sbox .sfixbtn')].some(b=>(b.getAttribute('onclick')||'').includes(id))}},s.id);
    if(!(await p.$('#sbox.open')))await p.click('#sbox .month-link');await settle(p,400);
    const b=await offered();ok(b.card&&b.btn,`the score card offers ${s.id} on ${s.k}`);
    // the piece taken out of rotation in its own sheet, then back to Today
    await p.evaluate(id=>{show('wardrobe');openItem(id)},s.id);await settle(p,400);
    await p.click('#item-view .rotbtn');await p.waitForFunction(id=>items.find(i=>i.id===id).paused,s.id);
    await p.evaluate(()=>closeItem());await p.click('#n-today');await settle(p,400);
    ok(await p.evaluate(k=>key(sel)===k,s.k),'the Today tab is back on that day');
    if(!(await p.$('#sbox.open')))await p.click('#sbox .month-link');await settle(p,400);
    const a=await offered();
    ok(!a.card&&!a.btn,`once ${s.id} is out of rotation the score card no longer offers it`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
