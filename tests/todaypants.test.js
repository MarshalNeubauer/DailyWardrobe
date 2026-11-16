// Changing the pants with a suit's jacket taken off (the owner, 2026-11-16: "If I have a suit on today and remove the suit jacket, my pants
// are locked and I can't swap them out"): the suit's pants get ⇄ like any pants; other pants are a pick (force.bot) that the plan keeps,
// and then the suit is not worn that day (the planner's rest, the care counts) while the new pants are; the picker offers the suit's own
// pants back; the jacket back on brings the whole suit; a day marked worn can't be changed; Reset undoes it.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // one suit, so the next suit day shows how long it has rested (worn yesterday or not)
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('blazer','tan'),I('pants','grey'),I('pants','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),
        I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[3];settings.vestMode='auto';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=true;show('today')});
    const tap=async s=>{const t0=await p.evaluate(()=>(dayRecs[key(sel)]||{}).updated||0);await p.click(s);await p.waitForFunction(t=>((dayRecs[key(sel)]||{}).updated||0)>t,t0,{timeout:5000}).catch(()=>{});await settle(p,400)};
    const st=()=>p.evaluate(()=>{const o=planFor()[key(sel)],r=dayRecs[key(sel)]||{};return {ids:idsOf(o),suitDay:!!o.suitDay,suitBot:!!o.suitBot,offKind:o.offKind||null,kind:asmCmKind(o),hard:rateOutfit(o).hard,
      rows:[...document.querySelectorAll('#ibox .row')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),btns:[...document.querySelectorAll('#ibox .row button[aria-label]')].map(b=>b.getAttribute('aria-label')),
      force:r.force||null,off:r.off||null,recIds:r.ids||null,recSuit:r.suitDay}});
    // the suit's rest on the next suit day (Tuesday), from a fresh simulation
    const suitRest=()=>p.evaluate(()=>{const s=planSim(new Date(2026,9,1));const pl=s.upTo(new Date(2026,10,10));const o=pl['2026-11-10'];return o&&o.top&&o.top.id==='suit0'?o.top.rest:null});
    const SUIT='suit0',GREY='pants2',CHAR='pants3';
    const a=await st();
    ok(a.suitDay&&a.ids.top===SUIT&&a.ids.bot===SUIT&&!a.btns.includes('Change pants'),'a suit day: the suit is jacket and pants, no separate pants row');
    await tap('#ibox button[aria-label="Take off the suit jacket"]');
    const b=await st();
    ok(b.suitBot&&!b.ids.top&&b.ids.bot===SUIT&&b.btns.includes('Change pants')&&b.rows.some(t=>/^SuitTaken off: the pants stay/.test(t)),`the jacket off: the suit's pants stay and can be changed (${b.btns.join(', ')})`);
    ok(await suitRest()===1,'the jacket off with its own pants: the suit still counts as worn today (rested 1 day on Tuesday)');
    // the picker: the suit's own pants first (wearing), then every pair of pants
    await p.click('#ibox button[aria-label="Change pants"]');await settle(p,300);
    const pk=await p.evaluate(()=>({on:document.querySelector('#pick-sheet').classList.contains('on'),title:document.querySelector('#pick-title').textContent,
      cards:[...document.querySelectorAll('#pick-sheet .pick-it')].map(c=>({id:(c.getAttribute('onclick').match(/'bot','([^']+)'/)||[])[1],cur:c.classList.contains('cur'),txt:c.textContent.replace(/\s+/g,' ').trim()}))}));
    const sc=pk.cards.find(c=>c.id===SUIT);
    ok(pk.on&&/Choose pants/.test(pk.title)&&sc&&sc.cur&&/The suit’s own pants/.test(sc.txt)&&pk.cards.some(c=>c.id===GREY)&&pk.cards.some(c=>c.id===CHAR)&&pk.cards.length===3,`the picker offers the suit's own pants (wearing) and both pairs of pants (${pk.cards.map(c=>c.id+(c.cur?'*':'')).join(', ')})`);
    await tap(`#pick-sheet button[onclick*="'${GREY}'"]`);
    const c=await st();
    ok(!c.suitBot&&!c.suitDay&&!c.ids.top&&c.ids.bot===GREY&&c.offKind==='suit'&&c.force&&c.force.bot===GREY&&c.force.top===SUIT&&c.off&&c.off.top,`grey pants picked: worn in place of the suit, kept as a pick (${JSON.stringify(c.force)})`);
    ok(['shirt','tie','shoes','belt','socks','watch'].every(s=>c.ids[s]===b.ids[s]),'the rest of the outfit stays as shown');
    ok(c.rows.some(t=>/^SuitTaken off/.test(t)&&!/pants stay/.test(t))&&c.btns.includes('Put the suit jacket back on')&&c.btns.includes('Change pants')&&!c.hard.length,`the list: the suit taken off, the grey pants with ⇄, no penalty (${c.rows.slice(0,2).join(' | ')})`);
    ok(c.kind==='shirt-tie','the picture is the shirt-and-tie master with the grey pants');
    ok(await suitRest()===2,'the suit is not counted as worn today (rested 2 days on Tuesday)');
    // the plan keeps the pick: new planning rules (replanFuture(true)), a plan from scratch
    const kept=await p.evaluate(async()=>{await replanFuture(true);cache={};renderToday();const o=planFor()[key(sel)];return {bot:o.bot&&o.bot.id,top:o.top&&o.top.id}});
    ok(kept.bot===GREY&&!kept.top,`re-planning keeps the grey pants (${JSON.stringify(kept)})`);
    // the record written for today holds the grey pants, not the suit
    await p.waitForFunction(g=>{const r=dayRecs[key(sel)];return r&&r.ids&&r.ids.bot===g},GREY,{timeout:5000}).catch(()=>{});
    const r1=await st();
    ok(r1.recIds&&r1.recIds.bot===GREY&&!r1.recIds.top&&r1.recSuit===false,`today's record: grey pants, no jacket, not a suit day (${JSON.stringify(r1.recIds)})`);
    // the suit's own pants back from the picker: the suit is worn again, no pick of pants left
    await p.click('#ibox button[aria-label="Change pants"]');await settle(p,300);
    await tap(`#pick-sheet button[onclick*="'${SUIT}'"]`);
    const d=await st();
    ok(d.suitBot&&d.ids.bot===SUIT&&!(d.force&&d.force.bot),'choosing the suit\'s own pants puts them back (no pants pick left)');
    // Suggest another from the suit's pants: the best other pants
    await p.click('#ibox button[aria-label="Change pants"]');await settle(p,300);
    await tap('#pick-next');
    const e=await st();
    ok(!e.suitBot&&(e.ids.bot===GREY||e.ids.bot===CHAR)&&e.force&&e.force.bot===e.ids.bot,`Suggest another brings other pants (${e.ids.bot})`);
    // the jacket back on: the whole suit again, the pants pick let go; off again: the suit's own pants
    await tap('#ibox button[aria-label="Put the suit jacket back on"]');
    const f=await st();
    ok(f.suitDay&&f.ids.top===SUIT&&f.ids.bot===SUIT&&!(f.force&&f.force.bot)&&!f.off,`the jacket back on brings the whole suit (${JSON.stringify(f.ids)})`);
    await tap('#ibox button[aria-label="Take off the suit jacket"]');
    const g=await st();
    ok(g.suitBot&&g.ids.bot===SUIT,'taking it off again leaves the suit\'s own pants on');
    // Reset (Today's undo for changes) puts everything back
    await tap(`#ibox button[aria-label="Change pants"]`).catch(()=>{});await settle(p,200);
    await tap(`#pick-sheet button[onclick*="'${CHAR}'"]`);
    const h0=await st();
    await p.click('[aria-label="Reset changes"]');await settle(p,400);
    const h=await st();
    ok(h0.ids.bot===CHAR&&h.suitDay&&h.ids.top===SUIT&&h.ids.bot===SUIT&&!h.off&&!h.force,'Reset undoes the jacket off and the pants pick');
    // a coming day with the week's lock: the pick lets the lock go and is kept through new planning rules
    await p.evaluate(()=>{sel=new Date(2026,10,10);renderToday()});await settle(p,300);
    await p.evaluate(async()=>{const k=key(sel),o=planFor()[k];await saveDay({...(dayRecs[k]||{date:k}),lock:idsOf(o)});cache={};renderToday()});await settle(p,200);
    await tap('#ibox button[aria-label="Take off the suit jacket"]');
    await p.click('#ibox button[aria-label="Change pants"]');await settle(p,300);
    await tap(`#pick-sheet button[onclick*="'${CHAR}'"]`);
    // (the day is locked again from what Today then shows, lockUpcoming: the pick wins over a lock either way)
    const l=await p.evaluate(async()=>{const k=key(sel);await replanFuture(true);cache={};const o=planFor()[k];return {bot:o.bot&&o.bot.id,top:o.top&&o.top.id,force:dayRecs[k].force}});
    ok(l.bot===CHAR&&!l.top&&l.force.bot===CHAR,`a locked coming day: the pick is kept over the lock and through re-planning (${JSON.stringify(l)})`);
    // marked worn: counted for the grey pants, not the suit; the day can't be changed any more
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});await settle(p,300);
    await tap('#ibox button[aria-label="Take off the suit jacket"]');
    await p.click('#ibox button[aria-label="Change pants"]');await settle(p,300);
    await tap(`#pick-sheet button[onclick*="'${GREY}'"]`);
    const w0=await p.evaluate(()=>({...careCounts()}));
    await p.evaluate(()=>setWorn(true));await settle(p,400);
    const w=await p.evaluate(()=>{cache={};const c=careCounts(),o=planFor()[key(sel)];return {c:{...c},frozen:!!o.frozen,bot:o.bot&&o.bot.id,offKind:o.offKind||null,
      btns:[...document.querySelectorAll('#ibox .row button[aria-label]')].map(b=>b.getAttribute('aria-label')),rows:[...document.querySelectorAll('#ibox .row')].map(e=>e.textContent.replace(/\s+/g,' ').trim())}});
    ok((w.c[GREY]||0)===(w0[GREY]||0)+1&&(w.c[SUIT]||0)===(w0[SUIT]||0),`marked worn: the grey pants get a wear before cleaning, the suit none (grey ${w0[GREY]||0} → ${w.c[GREY]||0}, suit ${w0[SUIT]||0} → ${w.c[SUIT]||0})`);
    ok(w.frozen&&w.bot===GREY&&w.offKind==='suit'&&!w.btns.includes('Change pants')&&!w.btns.some(x=>/Take off|back on/.test(x))&&w.rows.some(t=>/^SuitTaken off/.test(t)),`a day marked worn: the suit taken off, the grey pants, nothing to change (${w.btns.join(', ')})`);
    // a reload: the wardrobe, settings and day records from the device; the coming day keeps its charcoal pants, the worn day its grey ones
    await p.evaluate(async()=>{for(const i of items)await put(i);await saveUserSettings()});
    await p.reload();await p.waitForFunction(()=>window.appReady);
    const rl=await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};view={y:2026,m:10};const pl=planFor(),o=pl[key(new Date(2026,10,10))],t=pl[key(new Date(2026,10,9))];
      return {n:items.length,bot:o&&o.bot&&o.bot.id,top:o&&o.top&&o.top.id,today:t&&t.bot&&t.bot.id}});
    ok(rl.n===12&&rl.bot===CHAR&&!rl.top&&rl.today===GREY,`after a reload the picks stand (${JSON.stringify(rl)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // the planner keeps the pick (outfit/takeOff in planner.js); other tests get tests/fixedplan.js
module.exports.assembled=true;     // it asks which painted master a day takes (asm-color.js)
