// Folding from inside: a photo opened from the pieces list or a tile folds when tapped; the open score breakdown folds on a
// tap; a tap in the open pieces list that is not on a button or a photo (the names on the left) folds the list; the open
// month has a fold button at its bottom right. Folding a box whose top is above the screen brings the card back into view.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=(x={})=>p.evaluate(async x=>{let k=0;const I=(type,primaryColor,y={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...y});
      items=[I('suit','deeptaupe'),I('suit','navy'),I('shirt','lightblue'),I('shirt','white'),I('tie','brown'),I('tie','burgundy'),I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','brown'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      listOpen=!!x.list;monthOpen=!!x.month;scoreOpen=!!x.score;belowOpen=null;openRow=null;show('today');scrollTo(0,0);await new Promise(r=>setTimeout(r,200))},x);
    const into=s=>p.evaluate(s=>{const e=document.querySelector(s);scrollBy(0,e.getBoundingClientRect().top-100)},s);
    const open=s=>p.evaluate(s=>document.querySelector(s).classList.contains('open'),s);
    // pieces list: open a piece's photo, tap the photo: it folds, the list stays open
    await setup({list:true});await into('#ri-shirt');await p.tap('#ri-shirt .rowtap');await p.waitForTimeout(600);
    const o1=await open('#ri-shirt');await p.tap('#ri-shirt .rpanel-in');await p.waitForTimeout(600);
    ok(o1&&!(await open('#ri-shirt'))&&await open('#ibox'),'a piece\'s photo in the list folds when the photo is tapped (the list stays open)');
    // tapping the name on the left folds the whole list; ⇄ and the item still do their own thing
    await into('#ri-tie');await p.tap('#ri-tie .row>.mut');await p.waitForTimeout(600);
    ok(!(await open('#ibox'))&&await p.evaluate(()=>!listOpen&&document.querySelector('#ibox .month-link').getAttribute('aria-expanded')==='false'),'tapping a name on the left of the open list folds the list');
    await setup({list:true});await into('#ri-tie');await p.tap('#ri-tie .rowtap');await p.waitForTimeout(500);
    ok(await open('#ibox')&&await open('#ri-tie'),'tapping the item itself still opens its photo, not folding the list');
    await p.tap('#ri-tie .swap');await p.waitForTimeout(400);
    ok(await open('#ibox')&&await p.evaluate(()=>!!picker),'⇄ still opens the picker, not folding the list');
    await p.evaluate(()=>closePicker());
    // a tile's photo folds when tapped
    await setup();await into('.below');await p.tap('.below .tile');await p.waitForTimeout(600);const b1=await open('#bbox');
    await p.tap('#bbox .rpanel-in');await p.waitForTimeout(600);
    ok(b1&&!(await open('#bbox'))&&await p.evaluate(()=>belowOpen===null),'a tile\'s photo folds when the photo is tapped');
    // score: a tap on the breakdown folds it
    await setup();await into('#sbox');await p.tap('#sbox .month-link');await p.waitForTimeout(900);const s1=await open('#sbox');
    await p.tap('#sbox li >> nth=1');await p.waitForTimeout(700);
    ok(s1&&!(await open('#sbox'))&&await p.evaluate(()=>!scoreOpen&&document.querySelector('#sbox .month-link').getAttribute('aria-expanded')==='false'),'tapping the open score breakdown folds it');
    // month: a fold button at the bottom right
    await setup({month:true});await into('#mbox');
    const fb=await p.evaluate(()=>{const b=document.querySelector('#mbox .foldbtn'),r=b.getBoundingClientRect(),box=document.querySelector('#mbox').getBoundingClientRect(),cells=[...document.querySelectorAll('#mbox .mc')].map(c=>c.getBoundingClientRect().bottom);
      return {label:b.getAttribute('aria-label'),right:box.right-r.right<=24,bottom:box.bottom-r.bottom<=24,below:r.top>=Math.max(...cells)-1,size:Math.round(r.width)}});
    ok(fb.label==='Fold away the month'&&fb.right&&fb.bottom&&fb.below&&fb.size>=32,`the open month has a fold button at its bottom right (${JSON.stringify(fb)})`);
    // folding from the bottom of a long box brings the card back into view
    await p.setViewportSize({width:390,height:480});   // shorter than the open month, so its top is off screen at its bottom
    await setup({month:true,list:true,score:true});await p.evaluate(()=>{const b=document.querySelector('#mbox .foldbtn');scrollBy(0,b.getBoundingClientRect().bottom-380)});
    const topBefore=await p.evaluate(()=>Math.round(document.querySelector('#mbox').getBoundingClientRect().top));
    await p.tap('#mbox .foldbtn');await p.waitForTimeout(900);
    const after=await p.evaluate(()=>({open:monthOpen,cls:document.querySelector('#mbox').classList.contains('open'),top:Math.round(document.querySelector('#mbox').getBoundingClientRect().top)}));
    ok(!after.open&&!after.cls&&topBefore<0&&after.top>=0&&after.top<=480-78-60,`the fold button folds the month, and the card comes back into view (top ${topBefore} → ${after.top}px)`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
