// Taking pieces off for the day (the owner's ask, 2026-11-13): − beside the jacket or the tie in Today's pieces list takes it off, + puts
// it back. A suit's jacket takes its waistcoat with it and leaves its trousers on; the rest of the outfit stays as shown; nothing taken
// off counts against the score; the painted picture moves to the shirt-and-tie or open-collar master, with the suit's own cloth on the
// trousers.
module.exports=async({ok,chromium,url,settle})=>{
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
    ok(!b.ids.top&&b.ids.bot===a.ids.top&&b.suitBot&&!b.suitDay&&!b.vest&&b.off&&b.off.top&&b.offKind==='suit',`the jacket and waistcoat come off and the suit's trousers stay (${JSON.stringify(b.ids)})`);
    ok(['shirt','tie','shoes','belt','socks','watch'].every(s=>b.ids[s]===a.ids[s]),'the shirt, tie, shoes, belt, socks and watch stay as shown');
    ok(b.rows.some(t=>/^SuitTaken off: the trousers stay/.test(t))&&b.rows.some(t=>/^Trousers\S/.test(t))&&b.btns.includes('Put the suit jacket back on')&&!b.btns.includes('Change trousers'),`the list says the jacket is off, shows the suit's trousers (not swappable) and offers + (${b.rows.slice(0,3).join(' | ')})`);
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
    ok(!g0.suitDay&&g0.ids.top&&!g.ids.top&&g.ids.bot===g0.ids.bot&&g.offKind==='blazer'&&!g.suitBot&&g.kind==='shirt-tie',`a blazer comes off and the odd trousers stay (${g.kind})`);
    const rest=await p.evaluate(id=>{const s=planSim(new Date(2026,10,1));s.upTo(new Date(2026,10,30));const p2=s.plan;return Object.entries(p2).filter(([k,o])=>o.top&&o.top.id===id).map(([k])=>k)},g0.ids.top);
    ok(!rest.includes('2026-11-11'),`the blazer taken off is not counted as worn that day (${rest.join(', ')})`);
    // the painter: a suit's read stripes paint its trousers with the jacket's own cloth, at the shirt master's scale
    const r=await p.evaluate(()=>{const s={...items[0],sett:{v:2,a:0,bands:[['#1b2440',8],['#e8e8e8',1]],cr:4,tr:30}};
      return {how:asmCmRoute(s,'trousers').how,pants:asmCmRoute({...items[3],sett:s.sett},'trousers').how,tag:asmCmTrSc('trousers',s),jtag:asmCmTrSc('jacket',s),
        z:Object.keys(asmCmItems({shirt:items[4],bot:s,belt:items[11],tie:items[6]},'shirt-tie')).sort().join(),zo:Object.keys(asmCmItems({shirt:items[4],top:s,vest:true},'vest-open')).sort().join()}});
    ok(r.how==='bands'&&r.pants==='tile'&&/^\/sc\/lg\d+$/.test(r.tag)&&r.jtag==='',`a suit's trousers are painted with its jacket's cloth (${r.how}; odd trousers keep ${r.pants}), and such looks get a new key`);
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
module.exports.realPlanner=true;   // runs the real planner (taking a piece off is planned: takeOff in planner.js); other tests get tests/fixedplan.js
module.exports.assembled=true;   // it asks which painted master a day takes (asm-color.js)
