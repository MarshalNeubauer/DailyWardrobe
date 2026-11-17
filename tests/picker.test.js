// The picker on Today and swapping pieces, with the real planner.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/picker.test.js ---- */
// Choosing a piece by hand (the sheet behind ⇄), that changes teach the planner nothing, and correcting a past day.
const picker=async({ok,chromium,url,settle:settleFor})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const settle=()=>settleFor(p,350);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('suit','brown'),I('blazer','navy'),I('pants','grey'),I('pants','tan'),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','lavender'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','gold'),I('tie','purple'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';dayRecs={};weather={};climate=null;TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};
      sel=new Date(2026,10,17);view={y:2026,m:10};listOpen=true;show('today')});
    await settle();
    // ---- the sheet ----
    const before=await p.evaluate(()=>idsOf(planFor()[key(sel)]));
    await p.click('#ri-tie .swap');
    const sheet=await p.evaluate(()=>({on:document.querySelector('#pick-sheet').classList.contains('on'),title:document.querySelector('#pick-title').textContent,n:document.querySelectorAll('.pick-it').length,
      cur:document.querySelectorAll('.pick-it.cur').length,curTxt:(document.querySelector('.pick-it.cur .fit')||{}).textContent,first:document.querySelector('.pick-it .fit').textContent,tags:[...document.querySelectorAll('.pick-it .fit')].map(e=>e.className.replace('fit ','')).join(),next:!!document.querySelector('#pick-next')}));
    ok(sheet.on&&/Choose a tie/.test(sheet.title)&&sheet.n===5&&sheet.next,`⇄ on the tie opens a sheet with every tie (${sheet.n}) and "Suggest another"`);
    ok(sheet.cur===1&&/Wearing/.test(sheet.curTxt)&&/Best match/.test(sheet.first),`the one being worn is marked and the best match comes first (${sheet.curTxt}; ${sheet.tags})`);
    // pick a specific tie: exactly that one, everything else stays
    const want=await p.evaluate(()=>{const o=planFor()[key(sel)];return items.filter(i=>i.type==='tie'&&i.id!==o.tie.id).pop().id});
    await p.click(`.pick-it[onclick*="${want}"]`);await settle();
    const after=await p.evaluate(()=>({ids:idsOf(planFor()[key(sel)]),open:document.querySelector('#pick-sheet').classList.contains('on'),msg:document.querySelector('#today').textContent,over:planFor()[key(sel)].overrides}));
    ok(after.ids.tie===want&&!after.open&&after.over,'tapping a tie wears exactly that one and closes the sheet');
    ok(['top','shirt','shoes','belt','socks','watch'].every(s=>after.ids[s]===before[s]),'the rest of the outfit stays');
    ok(!/Noted|the planner will/.test(after.msg)&&await p.evaluate(()=>!('learn' in settings)),'nothing is noted or learned from the choice (the planner no longer learns from changes)');
    // "Suggest another" still cycles
    await p.click('#ri-shirt .swap');await p.click('#pick-next');await settle();
    const cyc=await p.evaluate(()=>idsOf(planFor()[key(sel)]));
    ok(cyc.shirt!==after.ids.shirt&&cyc.tie===want,'"Suggest another" gives a different shirt and keeps the chosen tie');
    // picking the jacket re-picks what must follow it; closing the sheet changes nothing
    await p.evaluate(()=>{const k=Object.entries(planFor()).find(([d,o])=>keyDate(d)>todayDate()&&o.top&&o.top.primaryColor!=='brown')[0];sel=keyDate(k);renderToday()});await settle();
    await p.click('#ri-top .swap');const topWant=await p.evaluate(()=>{const o=planFor()[key(sel)];return items.find(i=>i.type==='suit'&&i.primaryColor==='brown').id});
    await p.click(`.pick-it[onclick*="${topWant}"]`);await settle();
    const tp=await p.evaluate(()=>{const o=planFor()[key(sel)];return {top:o.top.id,shoes:o.shoes.primaryColor,score:rateOutfit(o).score}});
    ok(tp.top===topWant&&tp.shoes==='brown'&&tp.score>=75,`choosing a suit re-picks the pieces that follow it (brown suit → ${tp.shoes} shoes, score ${tp.score})`);
    await p.click('#ri-tie .swap');await p.click('.pick-x');await settle();
    ok(await p.evaluate(()=>!document.querySelector('#pick-sheet').classList.contains('on')&&planFor()[key(sel)].top.id)===topWant,'closing the sheet changes nothing');
    // ---- no learning: a swap and a hand pick change only their own day, and record nothing in the settings ----
    const nl=await p.evaluate(async()=>{dayRecs={};cache={};sel=new Date(2026,10,17);view={y:2026,m:10};renderToday();
      const st0=JSON.stringify((await metaGet('settings'))||{});
      await swapSlot('tie');const ch=items.find(i=>i.type==='tie'&&i.id!==planFor()[key(sel)].tie.id);
      const k2=Object.keys(planMonth(2026,11)).find(k=>keyDate(k)>todayDate());sel=keyDate(k2);view={y:sel.getFullYear(),m:sel.getMonth()};renderToday();await pickItem('tie',ch.id);
      const st1=(await metaGet('settings'))||{};
      return {msg:document.querySelector('#today').textContent,learn:'learn' in settings||'learn' in st1,settings:JSON.stringify(st1)===st0,picked:planFor()[k2].tie.id===ch.id}});
    ok(!nl.learn&&nl.settings&&!/Noted|the planner will/.test(nl.msg),'a swap and a hand pick record no votes and leave the stored settings as they were');
    ok(nl.picked,'the pick holds on its day');
    // ---- correcting a past day ----
    const past=await p.evaluate(async()=>{dayRecs={};cache={};TODAY_OVERRIDE='2026-11-10T12:00:00';sel=new Date(2026,10,10);view={y:2026,m:10};pastEdit=null;renderToday();await new Promise(r=>setTimeout(r,400));
      sel=new Date(2026,10,9);renderToday();const o=planFor()[key(sel)];return {frozen:!!o.frozen,btn:!!document.querySelector('.pastedit'),swaps:document.querySelectorAll('#ibox .swap').length,top:o.top.id,tie:o.tie.id,shirt:o.shirt.id,future:JSON.stringify(idsOf(planFor()['2026-11-11']))}});
    ok(past.frozen&&past.btn&&past.swaps===0,'a past day has a "Correct this day" button and no change buttons until it is pressed');
    await p.click('.pastedit');await settle();
    ok(await p.evaluate(()=>document.querySelectorAll('#ibox .swap').length>=6&&document.querySelector('#ibox').classList.contains('open')&&/what you really wore/.test(document.querySelector('#today').textContent)),'pressing it opens the list with a change button on every piece');
    await p.click('#ri-tie .swap');
    const ps=await p.evaluate(()=>({title:document.querySelector('#pick-title').textContent,none:/None: I didn't wear one/.test(document.querySelector('#pick-sheet').textContent),next:!!document.querySelector('#pick-next')}));
    ok(/What tie did you wear\?/.test(ps.title)&&ps.none&&!ps.next,'the sheet asks what was worn, and offers "None"');
    const wore=await p.evaluate(t=>items.find(i=>i.type==='tie'&&i.id!==t).id,past.tie);
    await p.click(`.pick-it[onclick*="${wore}"]`);await settle();
    // the suit too: a blazer instead of the suit, then its trousers
    await p.click('#ri-top .swap');
    ok(await p.evaluate(()=>[...document.querySelectorAll('.pick-it')].length===items.filter(i=>i.type==='suit'||i.type==='blazer').length),'for the jacket it lists suits and blazers alike');
    const blz=await p.evaluate(()=>items.find(i=>i.type==='blazer').id);await p.click(`.pick-it[onclick*="${blz}"]`);await settle();
    await p.click('#ri-bot .swap');const pt=await p.evaluate(()=>items.find(i=>i.type==='pants'&&i.primaryColor==='grey').id);await p.click(`.pick-it[onclick*="${pt}"]`);await settle();
    await p.click('#ri-socks .swap');await p.click('#pick-sheet .btns button');await settle();   // None
    const fixed=await p.evaluate(()=>{const r=dayRecs['2026-11-9'],o=planFor()['2026-11-9'];return {tie:r.ids.tie,top:r.ids.top,bot:r.ids.bot,socks:r.ids.socks,suitDay:r.suitDay,worn:r.worn,edited:r.edited,auto:r.auto,shown:o.tie.id,frozen:o.frozen,
      rest:planFor()['2026-11-10'].top&&items.find(i=>i.id===r.ids.top),lastTie:null}});
    ok(fixed.tie===wore&&fixed.top===blz&&fixed.bot===pt&&fixed.socks===null&&fixed.suitDay===false&&fixed.worn===true&&fixed.edited&&!fixed.auto&&fixed.shown===wore,'the day now records what was really worn: another tie, a blazer with trousers, no socks');
    const eff=await p.evaluate(past=>{const fut=planMonth(2026,10),blz=dayRecs['2026-11-9'].ids.top,suit=past.top;
      const nextBlz=Object.entries(fut).find(([k,o])=>keyDate(k)>keyDate('2026-11-9')&&o.top&&o.top.id===blz),nextSuit=Object.entries(fut).find(([k,o])=>keyDate(k)>keyDate('2026-11-9')&&o.top&&o.top.id===suit);
      return {suitRest:nextSuit?nextSuit[1].top.rest:null,changed:JSON.stringify(idsOf(fut['2026-11-11']))!==past.future,learned:'learn' in settings,msg:document.querySelector('#today').textContent}},past);
    ok(eff.suitRest>=2&&!eff.learned&&/Corrected\./.test(eff.msg)&&!/counts what you really wore/.test(eff.msg),`rest is counted from what was worn: the suit that wasn't worn is free again (rest ${eff.suitRest}); it says "Corrected." and learns nothing`);
    await p.click('.pastedit');await settle();
    ok(await p.evaluate(()=>pastEdit===null&&document.querySelectorAll('#ibox .swap').length===0),'"Done" locks the day again');
    // moving to another day leaves correction mode
    await p.click('.pastedit');await p.evaluate(()=>stepDay(-1));
    ok(await p.evaluate(()=>pastEdit===null),'going to another day leaves correction mode');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (the picker ranks pieces by the planner (fitOf) and swaps re-plan); other tests get tests/fixedplan.js

/* ---- was tests/beltswap.test.js ---- */
// Swapping the belt brings shoes that match it, as swapping the shoes brings a belt (the owner's ask, 2026-11-14: with one belt per
// pair of shoes, a belt swap kept the shoes, found no other belt that matched them and took the belt off, saying "None of your belts
// match"). When the other belts' shoes don't suit the outfit (a black suit wants black shoes), nothing changes and Today says why.
const beltswap=async({ok,chromium,url,settle})=>{
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
// (realPlanner) runs the real planner (shoes and belt are chosen together in outfit())

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['picker',picker],['beltswap',beltswap]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
