// Swapping the belt brings shoes that match it, as swapping the shoes brings a belt (the owner's ask, 2026-11-14: with one belt per
// pair of shoes, a belt swap kept the shoes, found no other belt that matched them and took the belt off, saying "None of your belts
// match"). When the other belts' shoes don't suit the outfit (a black suit wants black shoes), nothing changes and Today says why.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=suits=>p.evaluate(suits=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[...suits.map(c=>I('suit',c)),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('watch','grey',{metal:'silver'}),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'cordovan',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=true;swapMsg='';show('today')},suits);
    const st=()=>p.evaluate(()=>{const o=planFor()[key(sel)];return {ids:idsOf(o),belt:o.belt&&o.belt.primaryColor,shoes:o.shoes&&o.shoes.primaryColor,fit:o.belt&&o.shoes?beltFit(o.shoes,o.belt):null,
      msg:swapMsg,saved:(dayRecs[key(sel)]||{}).updated||0,notes:(o.notes||[]).join(' | ')}});
    // a navy suit: black, brown and oxblood shoes all suit it
    await setup(['navy']);await settle(p,200);
    const a=await st();
    await p.evaluate(()=>swapSlot('belt'));await settle(p,300);
    const b=await st();
    ok(a.belt&&b.belt&&b.belt!==a.belt&&b.fit!==null&&b.shoes!==a.shoes,`swapping the belt brings another belt and shoes that match it (${a.belt}/${a.shoes} -> ${b.belt}/${b.shoes})`);
    ok(['top','shirt','tie','watch'].every(s=>b.ids[s]===a.ids[s])&&!/None of your belts/.test(b.notes),'the rest of the outfit stays, and no "None of your belts match" note');
    await p.evaluate(()=>swapSlot('belt'));await settle(p,300);
    const c=await st();
    ok(c.belt&&c.belt!==b.belt&&c.belt!==a.belt&&c.fit!==null,`swapping again brings the third belt, with its shoes (${c.belt}/${c.shoes})`);
    // choosing a belt by hand from the list: its shoes follow too
    const want=await p.evaluate(b=>items.find(i=>i.type==='belt'&&i.primaryColor===b).id,a.belt);
    await p.evaluate(id=>pickItem('belt',id),want);await settle(p,300);
    const d=await st();
    ok(d.belt===a.belt&&d.fit!==null,`a belt chosen from the list brings shoes that match it (${d.belt}/${d.shoes})`);
    // a black suit: only black shoes suit it, so only the black belt can be worn: the swap changes nothing and says why
    await setup(['black']);await settle(p,200);
    const e=await st();
    await p.evaluate(()=>swapSlot('belt'));await settle(p,300);
    const f=await st();
    ok(e.belt==='black'&&f.belt==='black'&&f.shoes==='black'&&f.saved===e.saved&&/belt stays/.test(f.msg),`with a black suit the black belt stays, nothing is saved, and Today says why ("${f.msg}")`);
    const brown=await p.evaluate(()=>items.find(i=>i.type==='belt'&&i.primaryColor==='brown').id);
    await p.evaluate(id=>pickItem('belt',id),brown);await settle(p,300);
    const g=await st();
    ok(g.belt==='black'&&g.saved===e.saved&&/belt stays/.test(g.msg),`choosing the brown belt for the black suit changes nothing and says why ("${g.msg}")`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (shoes and belt are chosen together in outfit())
