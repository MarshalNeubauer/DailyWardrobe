// The score card unfolds smoothly like the pieces list and the month plan (what shows grows over time, not in one frame; since the
// month's change the box is laid out at once and its edge, a strip (app.js foldEdge), slides down, so the visible height runs to the strip's edge):
// the checks slide in one after another and each bar fills to the points that check scored. It stays open across
// re-renders without replaying the animation, folds back smoothly, and is reachable by keyboard / screen reader.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','pink'),I('tie','burgundy'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=false;show('today')});
    const r0=await p.evaluate(()=>{const b=document.querySelector('#sbox');return {tag:b.tagName,btn:b.querySelector('button.month-link').getAttribute('aria-expanded'),h:b.getBoundingClientRect().height,
      panel:document.querySelector('#spanel').getBoundingClientRect().height,same:['#ibox','#mbox'].every(s=>Math.round(document.querySelector(s).getBoundingClientRect().height)===Math.round(b.getBoundingClientRect().height))}});
    ok(r0.tag==='SECTION'&&r0.btn==='false'&&r0.panel===0&&r0.same,'folded: a button with the same size as the other cards, the breakdown hidden');
    // sample the height while it opens: it grows over several frames
    const s=await p.evaluate(async()=>{const vis=b=>{const e=b.querySelector('.fedge>i');return Math.round(e?e.getBoundingClientRect().top+parseFloat(e.style.getPropertyValue('--fr'))-b.getBoundingClientRect().top+1:b.getBoundingClientRect().height)};toggleScore();const box=document.querySelector('#sbox'),hs=[];const t0=performance.now();
      while(performance.now()-t0<700){hs.push(vis(box));await new Promise(r=>requestAnimationFrame(r))}
      const li=[...box.querySelectorAll('li')],delays=li.map(l=>parseFloat(getComputedStyle(l).animationDelay)),bars=li.map(l=>getComputedStyle(l.querySelector('.sbar i')).animationName);
      return {hs,distinct:new Set(hs).size,final:hs[hs.length-1],first:hs[0],delays,bars,expanded:box.querySelector('.month-link').getAttribute('aria-expanded'),chev:getComputedStyle(box.querySelector('.chev')).transform}});
    ok(s.distinct>=6&&s.final>s.first+80,`opening grows smoothly over many frames (${s.distinct} heights, ${s.first} → ${s.final}px)`);
    ok(s.delays.length>3&&s.delays.every((d,i)=>!i||d>s.delays[i-1]),`the checks slide in one after another (${s.delays.map(d=>d.toFixed(2)).join(', ')}s)`);
    ok(s.bars.every(b=>b==='barIn')&&s.expanded==='true'&&s.chev!=='none','each check has a bar that fills; the chevron turns; the button says it is open');
    await settle(p,1000);const bars=await p.evaluate(()=>{const li=[...document.querySelectorAll('#sbox li')],r=rateOutfit(planFor()[key(sel)]);
      return li.map((l,i)=>{const w=l.querySelector('.sbar').getBoundingClientRect().width,f=l.querySelector('.sbar i').getBoundingClientRect().width,c=r.checks[i];return Math.abs(f/w-Math.max(0,c.pts)/c.max)<.02}).every(Boolean)});
    ok(bars,'each bar ends at the share of the points that check scored');
    // a re-render keeps it open without replaying
    const keep=await p.evaluate(()=>{renderToday();const b=document.querySelector('#sbox');return {open:b.classList.contains('open'),instant:b.classList.contains('instant'),anim:getComputedStyle(b.querySelector('li')).animationName}});
    ok(keep.open&&keep.instant&&keep.anim==='none','it stays open across a re-render, without replaying the animation');
    // folding: shrinks over several frames back to the card size
    const f=await p.evaluate(async()=>{const vis=b=>{const e=b.querySelector('.fedge>i');return Math.round(e?e.getBoundingClientRect().top+parseFloat(e.style.getPropertyValue('--fr'))-b.getBoundingClientRect().top+1:b.getBoundingClientRect().height)};toggleScore();const box=document.querySelector('#sbox'),hs=[];const t0=performance.now();
      const li=[...box.querySelectorAll('li')],lift={name:getComputedStyle(li[0]).animationName,d0:parseFloat(getComputedStyle(li[0]).animationDelay),dn:parseFloat(getComputedStyle(li[li.length-1]).animationDelay)};
      while(performance.now()-t0<1100){hs.push(vis(box));await new Promise(r=>requestAnimationFrame(r))}return {lift,distinct:new Set(hs).size,last:hs[hs.length-1],ib:Math.round(document.querySelector('#ibox').getBoundingClientRect().height)}});
    ok(f.lift.name==='mcLift'&&f.lift.dn===0&&f.lift.d0>0.1,`folding plays the checks backwards: the last lifts out first, the first ${Math.round(f.lift.d0*1000)} ms later`);
    ok(f.distinct>=6&&f.last===f.ib,`folding shrinks smoothly back to the card size (${f.distinct} heights, ends at ${f.last}px)`);
    // keyboard
    await p.focus('#sbox .month-link');await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('#sbox').classList.contains('open'),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>document.querySelector('#sbox').classList.contains('open')),'Enter on the focused card opens it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (its bars must match rateOutfit); other tests get tests/fixedplan.js
