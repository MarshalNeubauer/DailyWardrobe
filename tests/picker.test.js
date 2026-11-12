// Choosing a piece by hand (the sheet behind ⇄), the planner learning from changes, and correcting a past day.
module.exports=async({ok,chromium,url,settle:settleFor})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const settle=()=>settleFor(p,350);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('suit','brown'),I('blazer','navy'),I('pants','grey'),I('pants','tan'),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','lavender'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','gold'),I('tie','purple'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';settings.learn=null;dayRecs={};weather={};climate=null;TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};
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
    ok(/Noted: the planner will reach for this choice more often/.test(after.msg),'it says the choice was noted');
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
    // ---- learning ----
    const learn=await p.evaluate(async()=>{settings.learn=null;dayRecs={};cache={};sel=new Date(2026,10,17);view={y:2026,m:10};renderToday();
      const days=()=>Object.entries(planMonth(2027,1)).filter(([k])=>keyDate(k)>todayDate()).map(([,o])=>o);
      const navy=items.find(i=>i.type==='suit'&&i.primaryColor==='navy'),count=(t,x)=>days().filter(o=>o.top.id===t.id&&o.tie.id===x.id).length;
      // the tie the navy suit wears most
      const tally={};days().filter(o=>o.top.id===navy.id).forEach(o=>tally[o.tie.id]=(tally[o.tie.id]||0)+1);const fav=items.find(i=>i.id===Object.entries(tally).sort((a,b)=>b[1]-a[1])[0][0]);
      const n0=count(navy,fav);
      // swap that tie away from the navy suit twice (two different days)
      const navyDays=[];for(let n=0;n<2;n++){const hit=Object.entries(planMonth(2027,0)).find(([k,o])=>keyDate(k)>todayDate()&&o.top.id===navy.id&&o.tie.id===fav.id&&!navyDays.includes(k));if(!hit)break;
        navyDays.push(hit[0]);sel=keyDate(hit[0]);view={y:sel.getFullYear(),m:sel.getMonth()};renderToday();await swapSlot('tie')}
      const votes=settings.learn.p[pairKey(navy,fav)],n1=count(navy,fav),stillWorn=days().some(o=>o.tie.id===fav.id);
      // pick a tie by hand for the charcoal suit: that pairing is preferred afterwards
      const ch=items.find(i=>i.type==='suit'&&i.primaryColor==='charcoal'),gold=items.find(i=>i.type==='tie'&&i.primaryColor==='gold'),g0=count(ch,gold);
      const chDay=Object.entries(planMonth(2026,11)).find(([k,o])=>keyDate(k)>todayDate()&&o.top.id===ch.id&&o.tie.id!==gold.id)[0];
      sel=keyDate(chDay);view={y:sel.getFullYear(),m:sel.getMonth()};renderToday();await pickItem('tie',gold.id);
      const g1=count(ch,gold),up=settings.learn.p[pairKey(ch,gold)];
      const saved=(await metaGet('settings')).learn;
      return {n0,n1,votes,stillWorn,g0,g1,up,saved:!!saved&&saved.p[pairKey(navy,fav)]===votes,navyDays:navyDays.length,min:Math.min(...days().map(o=>rateOutfit(o).score))}});
    ok(learn.navyDays===2&&learn.votes===-2,`swapping a tie away from a suit votes against that pairing (${learn.votes} after two swaps)`);
    ok(learn.n0>=2&&learn.n1===0&&learn.stillWorn,`after two swaps the planner stops pairing them (${learn.n0} → ${learn.n1} days) but still wears the tie with other suits`);
    ok(learn.up>=1&&learn.g1>learn.g0,`a tie chosen by hand for a suit comes up with it more often (${learn.g0} → ${learn.g1} days)`);
    ok(learn.saved&&learn.min>=80,`what was learned is saved with the settings, and outfits stay good (lowest score ${learn.min})`);
    // ---- correcting a past day ----
    const past=await p.evaluate(async()=>{settings.learn=null;dayRecs={};cache={};TODAY_OVERRIDE='2026-11-10T12:00:00';sel=new Date(2026,10,10);view={y:2026,m:10};pastEdit=null;renderToday();await new Promise(r=>setTimeout(r,400));
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
      return {suitRest:nextSuit?nextSuit[1].top.rest:null,changed:JSON.stringify(idsOf(fut['2026-11-11']))!==past.future,learned:!!(settings.learn&&Object.keys({...settings.learn.p,...settings.learn.i}).length)}},past);
    ok(eff.suitRest>=2&&eff.learned,`rest is counted from what was worn: the suit that wasn't worn is free again (rest ${eff.suitRest}), and the planner notes the choices`);
    await p.click('.pastedit');await settle();
    ok(await p.evaluate(()=>pastEdit===null&&document.querySelectorAll('#ibox .swap').length===0),'"Done" locks the day again');
    // moving to another day leaves correction mode
    await p.click('.pastedit');await p.evaluate(()=>stepDay(-1));
    ok(await p.evaluate(()=>pastEdit===null),'going to another day leaves correction mode');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (the picker ranks pieces by the planner (fitOf) and swaps re-plan); other tests get tests/fixedplan.js
