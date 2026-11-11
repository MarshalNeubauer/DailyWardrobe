// Today, tightened: a header just tall enough for the title and buttons, a compact date bar, no "Below the waist" heading,
// a bordered score card, and worn / not worn as ✕ and ✓ over the bottom corners of the picture (today and past days only),
// with "Last worn …" as a pill between them when the look was worn before.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:430,height:900},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    const g=await p.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect(),h=R('header'),t=R('header h1'),b=[...document.querySelectorAll('header button')].map(x=>x.getBoundingClientRect());
      const sc=getComputedStyle(document.querySelector('.score'));
      return {h:h.height,slack:h.height-Math.max(t.height,...b.map(x=>x.height)),btn:Math.min(...b.map(x=>x.height)),day:R('.nav.day').height,
        heading:!!document.querySelector('.below-h'),tiles:document.querySelectorAll('.below .tile').length,
        border:sc.borderTopWidth+' '+sc.borderTopStyle,mbox:getComputedStyle(document.querySelector('.mbox')).borderTopColor===sc.borderTopColor}});
    ok(g.h<=56&&g.slack<=14&&g.btn>=40,`the header fits the title and buttons (${Math.round(g.h)}px tall, ${Math.round(g.slack)}px of padding; buttons ${Math.round(g.btn)}px for touch)`);
    ok(g.day<=50,`the date and weather bar is compact (${Math.round(g.day)}px)`);
    ok(!g.heading&&g.tiles===3,'no "Below the waist" heading; the tiles are still there');
    ok(g.border==='1px solid'&&g.mbox,`the score card has the same thin border as the month box (${g.border})`);
    // worn marks on the picture
    const m=await p.evaluate(()=>{const f=document.querySelector('#mannequin-container').getBoundingClientRect(),[n,y]=['.wmark.no','.wmark.yes'].map(s=>document.querySelector(s).getBoundingClientRect());
      return {left:n.left-f.left<=16&&f.bottom-n.bottom<=16,right:f.right-y.right<=16&&f.bottom-y.bottom<=16,size:Math.round(n.width),seg:!!document.querySelector('.seg'),pill:!!document.querySelector('.lastworn')}});
    ok(m.left&&m.right&&m.size>=40,`✕ sits in the bottom-left corner of the picture and ✓ in the bottom-right (${m.size}px)`);
    ok(!m.seg&&!m.pill,'no Worn / Not worn buttons below; no last-worn text for a look never worn');
    await p.click('.wmark.no');await p.waitForFunction(()=>planFor()[key(sel)].worn===false&&!!document.querySelector('.wmark.no.on'));
    ok(await p.evaluate(()=>!!document.querySelector('.wmark.no.on')&&!document.querySelector('.wmark.yes.on')),'tapping ✕ records it as not worn');
    await p.click('.wmark.yes');await p.waitForFunction(()=>planFor()[key(sel)].worn===true&&!!document.querySelector('.wmark.yes.on'));   // (the marks are redrawn a moment after the day is saved)
    ok(await p.evaluate(()=>!!document.querySelector('.wmark.yes.on')&&!document.querySelector('.wmark.no.on')),'tapping ✓ switches it to worn');
    await p.click('.wmark.yes');await p.waitForFunction(()=>planFor()[key(sel)].worn===undefined);
    ok(true,'tapping the chosen mark again clears it');
    // last worn: the same look a week earlier
    const lw=await p.evaluate(()=>{const o=planFor()[key(sel)];dayRecs['2026-11-3']={date:'2026-11-3',ids:idsOf(o),suitDay:true,worn:true,vestOn:!!o.vest};renderToday();
      const pill=document.querySelector('.wornbar .lastworn'),bar=document.querySelector('.wornbar');return {t:pill&&pill.textContent,mid:pill&&[...bar.children].indexOf(pill)===1}});
    ok(/^Last worn \w{3}, \w{3} \d+$/.test(lw.t)&&lw.mid,`a look worn before shows "Last worn" between the marks (${lw.t})`);
    // a future day: no marks (it can't have been worn yet)
    const fut=await p.evaluate(()=>{sel=new Date(2026,10,12);renderToday();return document.querySelectorAll('.wmark').length});
    ok(fut===0,'future days have no worn marks');
    // a swipe that starts on a mark still changes the day
    const before=await p.evaluate(()=>{sel=new Date(2026,10,10);renderToday();return document.querySelector('#today .day h2').textContent});
    const pt=await p.evaluate(()=>{const b=document.querySelector('.wmark.yes').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}});
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    await T('touchStart',pt.x-20,pt.y);for(let k=1;k<=6;k++)await T('touchMove',pt.x-20-40*k,pt.y+2);await T('touchEnd');await p.waitForTimeout(450);
    ok(await p.evaluate(b=>document.querySelector('#today .day h2').textContent!==b&&planFor()['2026-11-10'].worn===undefined,before),'a swipe starting on a mark changes the day without marking it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
