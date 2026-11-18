// Taking a piece off and Today's trousers, with the real planner and assembled pictures.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/takeoff.test.js ---- */
// Taking pieces off for the day (the owner's ask, 2026-11-13): − beside the jacket or the tie in Today's pieces list takes it off, + puts
// it back. A suit's jacket takes its waistcoat with it and leaves its trousers on; the rest of the outfit stays as shown; nothing taken
// off counts against the score; the painted picture moves to the shirt-and-tie or open-collar master, with the suit's own cloth on the
// trousers.
const takeoff=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('blazer','tan'),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),
        I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),I('tieclip','silver'),I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[3];settings.vestMode='always';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=true;show('today')});
    // a tap that changes the day: waits for its record to be saved and Today drawn again
    const tap=async sel=>{const t0=await p.evaluate(()=>(dayRecs[key(sel)]||{}).updated||0);await p.click(sel);await p.waitForFunction(t=>((dayRecs[key(sel)]||{}).updated||0)>t,t0,{timeout:5000}).catch(()=>{});await settle(p,400)};
    const st=()=>p.evaluate(()=>{const o=planFor()[key(sel)],r=dayRecs[key(sel)]||{};return {ids:idsOf(o),vest:!!o.vest,suitDay:!!o.suitDay,suitBot:!!o.suitBot,off:o.off||null,offKind:o.offKind||null,
      kind:asmCmKind(o),hard:rateOutfit(o).hard,rows:[...document.querySelectorAll('#ibox .row')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),
      btns:[...document.querySelectorAll('#ibox .row button[aria-label]')].map(b=>b.getAttribute('aria-label')),rec:{off:r.off||null,kind:r.kind||null}}});
    const a=await st();
    ok(a.suitDay&&a.vest&&a.ids.top&&a.ids.tie&&a.kind==='vest'&&a.btns.includes('Take off the suit jacket')&&a.btns.includes('Take off the tie'),`a suit day shows − to take off the jacket and the tie (${a.btns.filter(b=>/Take off/.test(b)).join(', ')})`);
    // the jacket off: the suit's trousers stay, the waistcoat goes too, the rest is unchanged
    await tap('#ibox button[aria-label="Take off the suit jacket"]');
    const b=await st();
    ok(!b.ids.top&&b.ids.bot===a.ids.top&&b.suitBot&&!b.suitDay&&!b.vest&&b.off&&b.off.top&&b.offKind==='suit',`the jacket and waistcoat come off and the suit's pants stay (${JSON.stringify(b.ids)})`);
    ok(['shirt','tie','shoes','belt','socks','watch'].every(s=>b.ids[s]===a.ids[s]),'the shirt, tie, shoes, belt, socks and watch stay as shown');
    ok(b.rows.some(t=>/^SuitTaken off: the pants stay/.test(t))&&b.rows.some(t=>/^Pants\S/.test(t))&&b.btns.includes('Put the suit jacket back on')&&b.btns.includes('Change pants'),`the list says the jacket is off, shows the suit's pants (with ⇄ to change them, tests/takeoff.test.js) and offers + (${b.rows.slice(0,3).join(' | ')})`);
    ok(!b.hard.length,`no penalty for the missing jacket (${b.hard.join(', ')})`);
    ok(b.kind==='shirt-tie',`the picture moves to the shirt-and-tie master (${b.kind})`);
    // only the tie off, on a waistcoat day: the waistcoat goes with it (no one wears a waistcoat without a tie)
    const v=await p.evaluate(()=>{const k=key(sel),r0=dayRecs[k];dayRecs[k]={...(r0||{date:k}),off:{tie:true}};cache={};const o=planFor()[k];dayRecs[k]=r0;cache={};return {tie:!!o.tie,vest:!!o.vest,top:!!o.top}});
    ok(v.top&&!v.tie&&!v.vest,`taking off only the tie takes the waistcoat off too (${JSON.stringify(v)})`);
    // the tie off too: the open-collar master, the clip goes with it
    await tap('#ibox button[aria-label="Take off the tie"]');
    const c=await st();
    ok(!c.ids.tie&&!c.ids.clip&&c.kind==='shirt-open'&&!c.hard.length&&c.rows.some(t=>/^TieTaken off/.test(t))&&!c.rows.some(t=>/^Tie clip/.test(t)),`the tie and its clip come off: the open-collar master, no penalty (${c.kind})`);
    // the jacket back on with no tie: the same suit, the open-collar jacket master
    await tap('#ibox button[aria-label="Put the suit jacket back on"]');
    const d=await st();
    ok(d.ids.top===a.ids.top&&d.suitDay&&!d.vest&&!d.ids.tie&&d.kind==='suit-open'&&!d.rows.some(t=>/^Vest/.test(t)),`putting the jacket back brings the same suit with no tie and so no waistcoat (the owner's rule), and no vest row to add one (${d.kind})`);
    await tap('#ibox button[aria-label="Put the tie back on"]');
    const e=await st();
    ok(JSON.stringify(e.ids)===JSON.stringify(a.ids)&&e.vest&&!e.off&&!e.rec.off,'putting the tie back gives the outfit as first shown');
    // Reset clears a piece taken off
    await tap('#ibox button[aria-label="Take off the tie"]');
    await p.click('[aria-label="Reset changes"]');await settle(p,300);
    const f=await st();
    ok(!f.off&&!f.rec.off&&f.ids.tie,'Reset puts back what was taken off');
    // a blazer day: the blazer off is not worn; marked worn, the day keeps what was really worn
    await p.evaluate(()=>{sel=new Date(2026,10,11);renderToday()});await settle(p,200);
    const g0=await st();
    await tap('#ibox button[aria-label="Take off the blazer"]');
    const g=await st();
    ok(!g0.suitDay&&g0.ids.top&&!g.ids.top&&g.ids.bot===g0.ids.bot&&g.offKind==='blazer'&&!g.suitBot&&g.kind==='shirt-tie',`a blazer comes off and the odd pants stay (${g.kind})`);
    const rest=await p.evaluate(id=>{const s=planSim(new Date(2026,10,1));s.upTo(new Date(2026,10,30));const p2=s.plan;return Object.entries(p2).filter(([k,o])=>o.top&&o.top.id===id).map(([k])=>k)},g0.ids.top);
    ok(!rest.includes('2026-11-11'),`the blazer taken off is not counted as worn that day (${rest.join(', ')})`);
    // the painter: a suit's read stripes paint its trousers with the jacket's own cloth, at the shirt master's scale
    const r=await p.evaluate(()=>{const s={...items[0],sett:{v:2,a:0,bands:[['#1b2440',8],['#e8e8e8',1]],cr:4,tr:30}};
      return {how:asmCmRoute(s,'trousers').how,pants:asmCmRoute({...items[3],sett:s.sett},'trousers').how,tag:asmCmTrSc('trousers',s),jtag:asmCmTrSc('jacket',s),
        z:Object.keys(asmCmItems({shirt:items[4],bot:s,belt:items[11],tie:items[6]},'shirt-tie')).sort().join(),zo:Object.keys(asmCmItems({shirt:items[4],top:s,vest:true},'vest-open')).sort().join()}});
    ok(r.how==='bands'&&r.pants==='tile'&&/^\/sc\/lg\d+$/.test(r.tag)&&r.jtag==='',`a suit's pants are painted with its jacket's cloth (${r.how}; odd pants keep ${r.pants}), and such looks get a new key`);
    ok(r.z==='belt,shirt,tie,trousers'&&r.zo==='jacket,shirt,waistcoat',`the masters' garments: ${r.z} / ${r.zo}`);
    // the trousers' lines follow the legs (asmLegsPrep/asmLegsAt): a synthetic pair, hips above the crotch at row 120, two legs below
    const lg=await p.evaluate(()=>{const S=256,N=S*S,T=new Uint8Array(N),SH=new Uint16Array(N).fill(30000),sk=new Uint8Array(N);
      for(let y=40;y<S;y++)for(let x=60;x<196;x++){if(y>=120&&x>=124&&x<132)continue;T[y*S+x]=255}
      const G=asmLegsPrep({trousers:T,skin:sk},SH,S,N),u=(x,y)=>asmLegsAt(G,x,y,y*S+Math.floor(x))[0],d=(x,y)=>u(x+.5,y)-u(x-.5,y);
      let mono=true;for(const y of [60,200])for(let x=61;x<195;x++)if(T[y*S+x]&&T[y*S+x-1]&&u(x+.5,y)<u(x-.5,y))mono=false;   // (within the cloth: the gap between the legs isn't painted)
      return {yc:G.yc,fly:Math.round(G.xf[200]),midHip:d(128,60),edgeHip:d(62,60),legMid:d(94,200),legIn:d(122,200),legOut:d(62,200),mono}});
    ok(lg.yc>=118&&lg.yc<=122&&lg.fly===128,`the crotch and the fly are found (row ${lg.yc}, x ${lg.fly})`);
    ok(lg.mono&&Math.abs(lg.midHip-1)<.1&&lg.edgeHip>1.5&&Math.abs(lg.legMid-1)<.15&&lg.legIn>1.5&&lg.legOut>1.5,
      `the lines close up where the cloth turns away: hips ${lg.midHip.toFixed(2)} at the fly, ${lg.edgeHip.toFixed(2)} at the side; a leg ${lg.legMid.toFixed(2)} at its crease, ${lg.legIn.toFixed(2)} / ${lg.legOut.toFixed(2)} at its edges`);
    // nothing to take off on a past day or a no-jacket-or-tie day
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});
    await p.evaluate(()=>setWorn(true));await settle(p,200);
    ok(await p.evaluate(()=>!document.querySelector('#ibox button[aria-label^="Take off"]')),'a day marked worn has no − buttons');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (taking a piece off is planned: takeOff in planner.js); other tests get tests/fixedplan.js
// (assembled) it asks which painted master a day takes (asm-color.js)

/* ---- was tests/todaypants.test.js ---- */
// Changing the pants with a suit's jacket taken off (the owner, 2026-11-16: "If I have a suit on today and remove the suit jacket, my pants
// are locked and I can't swap them out"): the suit's pants get ⇄ like any pants; other pants are a pick (force.bot) that the plan keeps,
// and then the suit is not worn that day (the planner's rest, the care counts) while the new pants are; the picker offers the suit's own
// pants back; the jacket back on brings the whole suit; a day marked worn can't be changed; Reset undoes it.
const todaypants=async({ok,chromium,url,settle})=>{
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
// (realPlanner) the planner keeps the pick (outfit/takeOff in planner.js); other tests get tests/fixedplan.js
// (assembled) it asks which painted master a day takes (asm-color.js)

/* ---- other pants on a suit day: the notes and the dials (the owner, 2026-11-17) ---- */
// His mid gray worsted suit, the jacket off, his multicam tan cargo pants, a tan T-shirt and tan suede boots picked by hand: Today said
// "None of your shoes suit mid gray worsted pants." (written for the suit before the pants were swapped in), Harmony read 0 with a stray red
// dot at the top of its ring, and the metal note read "The watch (silver) and belt buckle (other) are different metals."
const sepnotes=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','midgrey',{material:'worsted'}),I('suit','navy'),I('blazer','navy'),I('pants','tan',{pattern:'camouflage',secondaryColor:'olive',trouserKind:'cargo'}),I('pants','grey'),
        I('shirt','white'),I('shirt','navy'),I('tee','tan'),I('tie','burgundy'),I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('shoes','tan',{leather:'suede',shoeStyle:'boot'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','tan',{leather:'suede',metal:'other'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[3];settings.vestMode='auto';weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=true;
      const d=key(sel),SUIT='suit0',CAMO='pants3',TEE='tee7',BOOTS='shoes11';
      const day=(off,bot)=>{dayRecs={[d]:{date:d,force:{top:SUIT,shirt:TEE,shoes:BOOTS,...(bot?{bot}:{})},...(off?{off:{top:true}}:{})}};cache={};return planFor()[d]};
      const on=day(false),own=day(true),o=day(true,CAMO);show('today');
      const D=dialsFor(o),hard=rateOutfit(o).hard,dials=[...document.querySelectorAll('#sbox .dial')].map(e=>({txt:e.querySelector('text').textContent,arc:!!e.querySelector('.darc'),bad:!!e.querySelector('.dbad'),name:e.querySelector('small').textContent}));
      // a broken Harmony rule: the navy shirt under the navy blazer (the shirt the jacket's color)
      const box=document.createElement('div');box.innerHTML=scoreCard({...o,top:items.find(i=>i.id==='blazer2'),shirt:items.find(i=>i.id==='shirt6'),off:null});
      const hb=box.querySelector('.dial'),hbad={name:hb.querySelector('small').textContent,txt:hb.querySelector('text').textContent,ring:!!hb.querySelector('.dbad')};
      const h0=document.createElement('div');h0.innerHTML=dialHtml('h',{v:0},false)+dialHtml('h',{v:0},true)+dialHtml('h',{v:3},false);
      const z=[...h0.querySelectorAll('.dial')].map(e=>({txt:e.querySelector('text').textContent,arc:!!e.querySelector('.darc'),bad:!!e.querySelector('.dbad')}));
      const shown=[...document.querySelectorAll('#today p.warn')].map(e=>e.textContent).join(' | ');
      return {on:{suitDay:!!on.suitDay,bot:on.bot&&on.bot.id,notes:on.notes},own:{bot:own.bot&&own.bot.id,notes:own.notes},o:{bot:o.bot&&o.bot.id,top:!!o.top,shoes:o.shoes&&o.shoes.id,belt:o.belt&&o.belt.id,notes:o.notes},
        hard,dials,hbad,z,shown,unmapped:DIAL_RULES.map(([l])=>l).filter(l=>!DIAL_OF_CHECK[l]),bad:D.bad}});
    // the suit worn whole: its own notes (tan suede boots with a mid gray suit), as before
    ok(r.on.suitDay&&r.on.bot==='suit0'&&r.on.notes.some(t=>/shoes suit/.test(t)),`the suit worn whole keeps its own shoe note (${r.on.notes.join(' / ')})`);
    // the jacket off with the suit's own pants: a note about those pants is still true
    ok(r.own.bot==='suit0'&&r.own.notes.some(t=>/None of your shoes suit mid gray/.test(t)),`the suit's own pants: the note about them stays (${r.own.notes.join(' / ')})`);
    // other pants picked: the notes are those of the outfit worn
    ok(r.o.bot==='pants3'&&!r.o.top&&r.o.shoes==='shoes11'&&r.o.belt==='belt13',`the multicam pants are worn with the boots and the tan belt, as picked (${JSON.stringify({bot:r.o.bot,shoes:r.o.shoes,belt:r.o.belt})})`);
    ok(!r.o.notes.some(t=>/mid gray|suit\b|worsted/i.test(t)),`no note speaks of the suit or its pants (${r.o.notes.join(' / ')})`);
    ok(/gunmetal/.test(r.shown)&&!/mid gray/i.test(r.shown),`Today shows the outfit's notes, none of the suit's (${r.shown})`);
    // the metal note in plain words ("other" is gunmetal)
    ok(r.o.notes.includes('The silver watch and the gunmetal belt buckle are different metals.'),`the metal note reads naturally (${r.o.notes.filter(t=>/metal/.test(t)).join(' / ')})`);
    // the dials: "!" with the red ring exactly on the dials with a broken rule; a 0 draws no arc
    ok(r.dials.length===6&&r.dials.every(d=>(d.txt==='!')===d.bad&&(d.txt!=='0'||!d.arc)),`each dial: "!" with its red ring for a broken rule, no stray dot at 0 (${r.dials.map(d=>d.name+' '+d.txt+(d.arc?'':' no arc')+(d.bad?' ring':'')).join(', ')}; broken ${r.hard.join(', ')||'none'})`);
    ok(r.hard.every(l=>r.dials.some(d=>d.txt==='!'&&d.name===({h:'Harmony',t:'Texture',f:'Freshness',v:'Variety',o:'Occasion'})[r.bad&&Object.keys(r.bad).find(k=>r.bad[k]===l)])),`every broken rule rings its dial (${r.hard.join(', ')||'none'})`);
    ok(!r.unmapped.length,`every rule the card lists belongs to a dial (${r.unmapped.join(', ')})`);
    ok(r.hbad.name==='Harmony'&&r.hbad.txt==='!'&&r.hbad.ring,`a broken Harmony rule (the shirt the jacket's color) shows "!" ringed in red on Harmony (${JSON.stringify(r.hbad)})`);
    ok(r.z[0].txt==='0'&&!r.z[0].arc&&!r.z[0].bad&&r.z[1].txt==='!'&&r.z[1].bad&&!r.z[1].arc&&r.z[2].arc,`dialHtml: 0 draws no arc, a broken rule "!" with its ring, 3 an arc (${JSON.stringify(r.z)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['takeoff',takeoff],['todaypants',todaypants],['sepnotes',sepnotes]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
module.exports.assembled=true;   // assembled pictures on, as every part had them
