// Tapping a box on Today unfolds it and scrolls down just enough to show what opened, stopping once the tapped box's top
// reaches the top of the screen (never further, never up). Same for the score card, the pieces list, the month plan, a row
// in the pieces list and a tile's photo (the tile row is what reaches the top).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=()=>p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','deeptaupe'),I('suit','navy'),I('shirt','lightblue'),I('shirt','white'),I('tie','brown',{pattern:'stripe',secondaryColor:'cream'}),I('tie','burgundy'),
        I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','brown'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};listOpen=false;monthOpen=false;belowOpen=null;scoreOpen=false;
      const o=planFor()[key(sel)];renderTried.add(comboKey(o));renders[comboKey(o)]={sig:'x',img:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#5f5449"/></svg>'),model:'x',t:1};
      show('today');scrollTo(0,0);await new Promise(r=>setTimeout(r,300))});
    const navTop=()=>p.evaluate(()=>document.querySelector('body>nav').getBoundingClientRect().top);
    const at=s=>p.evaluate(s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom)}},s);
    const scrollY=()=>p.evaluate(()=>Math.round(scrollY));
    // a tall box (month plan, pieces list, score breakdown): it ends with its top at the top of the screen
    for(const [name,box,tap,prep] of [['month plan','#mbox','#mbox .month-link'],['pieces list','#ibox','#ibox .month-link'],['score card','#sbox','#sbox .month-link']]){
      await setup();
      // bring the box into view near the bottom of the screen, as when scrolling down to it
      await p.evaluate(([b])=>{const r=document.querySelector(b).getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect().top;scrollBy(0,r.bottom-nav+4)},[box]);
      const before=await at(box);await p.tap(tap);await p.waitForTimeout(1100);const after=await at(box),nt=await navTop();
      const fits=after.bottom-after.top<=nt-12-8;
      ok(fits?after.bottom<=nt-11&&after.top>=7:Math.abs(after.top-8)<=2,`${name}: unfolds and scrolls until its top reaches the top of the screen (top ${before.top} → ${after.top}px)`);
    }
    // a small reveal: a row in the open pieces list only scrolls as much as its photo needs, not to the top
    await setup();await p.evaluate(()=>{listOpen=true;renderToday()});
    await p.evaluate(()=>{const r=document.querySelector('#ibox').getBoundingClientRect();scrollBy(0,r.top-60)});
    const row=await p.evaluate(()=>{const rows=[...document.querySelectorAll('#ibox .ritem')];const nav=document.querySelector('body>nav').getBoundingClientRect().top;
      const r=rows.find(x=>{const b=x.getBoundingClientRect();return b.top>nav-160&&b.bottom<nav&&x.querySelector('.rowtap')});return r&&r.id});
    if(row){const y0=await scrollY();await p.tap(`#${row} .rowtap`);await p.waitForTimeout(1100);const r=await at('#'+row),nt=await navTop(),y1=await scrollY();
      ok(y1>y0&&r.top>8&&r.bottom<=nt-11,`a piece's photo scrolls only as far as needed to show it (row top ${r.top}px, bottom ${r.bottom}px)`)}
    else ok(false,'found a piece row near the bottom of the screen');
    // a tile's photo: the tile row is the box that reaches the top at most
    await setup();await p.evaluate(()=>{const r=document.querySelector('.below').getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect().top;scrollBy(0,r.bottom-nav+4)});
    await p.tap('.below .tile');await p.waitForTimeout(1100);const t=await at('.below'),bb=await at('#bbox'),nt=await navTop();
    ok(t.top>=6&&(bb.bottom<=nt-11||Math.abs(t.top-8)<=2),`a tile's photo: scrolls to show it, the tile row stops at the top at most (tiles top ${t.top}px, photo bottom ${bb.bottom}px)`);
    // already visible after unfolding: no scroll; folding never scrolls
    await setup();const y0=await scrollY();await p.tap('#sbox .month-link');await p.waitForTimeout(900);const s=await at('#sbox');
    if(s.bottom<=(await navTop())-12)ok(await scrollY()===y0,'a box that fits on screen once open does not scroll');
    const y1=await scrollY();await p.tap('#sbox .month-link');await p.waitForTimeout(600);ok(await scrollY()<=y1,'folding a box does not scroll down');
    // a touch during the scroll stops it
    await setup();await p.evaluate(()=>{const r=document.querySelector('#mbox').getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect().top;scrollBy(0,r.bottom-nav+4)});
    await p.tap('#mbox .month-link');await p.waitForTimeout(90);const mid=await scrollY();await p.evaluate(()=>dispatchEvent(new Event('touchstart')));await p.waitForTimeout(900);
    ok(await scrollY()-mid<40,'touching the screen while it scrolls stops it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
