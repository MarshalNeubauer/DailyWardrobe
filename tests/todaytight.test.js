// Today, tightened: a header just tall enough for the title and buttons, a compact date bar, no "Below the waist" heading,
// a bordered score card, and worn / not worn as one pill at the right of the date bar's weather line (today and past workdays only; the
// owner's design 2026-11-14: "✓ Wore" by default, a tap makes it "✕ Didn't"), the weather centred; "Last worn …" on the picture.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:430,height:900},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    const g=await p.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect(),h=R('header'),t=R('header h1'),b=[...document.querySelectorAll('header button')].map(x=>x.getBoundingClientRect()).filter(x=>x.height>0);
      const sc=getComputedStyle(document.querySelector('.score'));
      return {h:h.height,slack:h.height-Math.max(t.height,...b.map(x=>x.height)),btn:Math.min(...b.map(x=>x.height)),day:R('.nav.day').height,
        heading:!!document.querySelector('.below-h'),tiles:document.querySelectorAll('.below .tile').length,
        border:sc.borderTopWidth+' '+sc.borderTopStyle,mbox:getComputedStyle(document.querySelector('.mbox')).borderTopColor===sc.borderTopColor}});
    ok(g.h<=56&&g.slack<=14&&g.btn>=40,`the header fits the title and buttons (${Math.round(g.h)}px tall, ${Math.round(g.slack)}px of padding; buttons ${Math.round(g.btn)}px for touch)`);
    ok(g.day<=50,`the date and weather bar is compact (${Math.round(g.day)}px)`);
    ok(!g.heading&&g.tiles===3,'no "Below the waist" heading; the tiles are still there');
    ok(g.border==='1px solid'&&g.mbox,`the score card has the same thin border as the month box (${g.border})`);
    // worn or not: the pill in the date bar
    const m=await p.evaluate(()=>{const h=document.querySelector('.day h2'),hb=h.getBoundingClientRect(),pl=document.querySelector('#wpill'),pb=pl.getBoundingClientRect(),w=document.querySelector('.day h2 .wxc').getBoundingClientRect(),mid=r=>r.left+r.width/2;
      return {t:pl.textContent,pressed:pl.getAttribute('aria-pressed'),right:Math.round(hb.right-pb.right),centre:Math.round(Math.abs(mid(w)-mid(hb))),inside:pb.top>=hb.top-1&&pb.bottom<=hb.bottom+1,circles:document.querySelectorAll('.wmark').length,pill:!!document.querySelector('.lastworn')}});
    ok(m.t==='✓ Wore'&&m.pressed==='true'&&m.right<=1&&m.inside,`a day is worn unless marked: the pill reads "✓ Wore", at the right end of the date bar (${m.right}px from it)`);
    ok(m.centre<=1,`the weather stays centred under the date (${m.centre}px off)`);
    ok(m.circles===0&&!m.pill,'no ✕ / ✓ circles on the picture; no last-worn text for a look never worn');
    ok(g.day<=50,'the date bar keeps its height with the pill');
    await p.click('#wpill');await p.waitForFunction(()=>planFor()[key(sel)].worn===false&&document.querySelector('#wpill').textContent==="✕ Didn't");
    ok(await p.evaluate(()=>document.querySelector('#wpill').classList.contains('no')&&document.querySelector('#wpill').getAttribute('aria-pressed')==='false'),'a tap records it as not worn: "✕ Didn\'t", grey');
    await p.click('#wpill');await p.waitForFunction(()=>planFor()[key(sel)].worn===undefined&&document.querySelector('#wpill').textContent==='✓ Wore');
    ok(true,'a tap again goes back to worn (the default: nothing recorded, so today\'s outfit is not frozen)');
    // last worn: the same look a week earlier (a day counts unless marked "Didn't")
    const lw=await p.evaluate(()=>{const o=planFor()[key(sel)];dayRecs['2026-11-3']={date:'2026-11-3',ids:idsOf(o),suitDay:true,vestOn:!!o.vest};renderToday();
      const pill=document.querySelector('.wornbar .lastworn'),f=document.querySelector('#mannequin-container').getBoundingClientRect(),b=pill&&pill.getBoundingClientRect();return {t:pill&&pill.textContent,right:b&&f.right-b.right<=16}});
    ok(/^Last worn \w{3}, \w{3} \d+$/.test(lw.t)&&lw.right,`a look worn before (not marked either way) shows "Last worn" at the picture's bottom right (${lw.t})`);
    const lw2=await p.evaluate(()=>{for(const r of Object.values(dayRecs))if(r.ids&&keyDate(r.date)<sel)r.worn=false;renderToday();return !document.querySelector('.lastworn')});   // (every earlier day, the week's locks recorded too: each counts unless marked)
    ok(lw2,'a day marked "Didn\'t" is not a last wear');
    // a future day: no pill (it can't have been worn yet), the weather centred
    const fut=await p.evaluate(()=>{sel=new Date(2026,10,12);renderToday();return {pill:!!document.querySelector('#wpill'),cls:document.querySelector('.day h2 .wx').className}});
    ok(!fut.pill&&fut.cls==='wx','future days have no pill');
    for(const w of [320,360]){await p.setViewportSize({width:w,height:800});await p.evaluate(()=>{settings.location=null;sel=new Date(2026,10,10);renderToday()});
      const n=await p.evaluate(()=>{const a=document.querySelector('.day h2 .wx a'),pl=document.querySelector('#wpill');return {fit:a.scrollWidth<=a.clientWidth+1,t:a.textContent,over:document.documentElement.scrollWidth>innerWidth,pr:pl.getBoundingClientRect().right<=document.querySelector('.day h2').getBoundingClientRect().right+1}});
      ok(n.fit&&n.t==='Set location'&&!n.over&&n.pr,`${w}px, no location: "Set location" fits beside the pill, nothing scrolls sideways`)}
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
