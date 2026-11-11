// The open month on Today: no arrows, the title centred; a sideways swipe inside the box moves between months (the shown day
// stays, nothing else folds), a short one springs back; a swipe outside it still changes the day; a full-width fold bar folds it.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-12-10T12:00:00';cache={};sel=new Date(2026,11,10);view={y:2026,m:11};show('today');toggleScore();toggleMonth()});
    await settle(p,700);
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const title=()=>p.evaluate(()=>document.querySelector('#mbox .mhead h3').textContent);
    const at=async()=>{await p.evaluate(()=>{const r=document.querySelector('#mbox .mgrid:not(.mdow)').getBoundingClientRect();scrollBy(0,r.top+r.height/2-420)});await settle(p,200);
      return p.evaluate(()=>{const r=document.querySelector('#mbox .mgrid:not(.mdow)').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})};
    const swipe=async(x,y,dx,mid)=>{await T('touchStart',x,y);let m=null;for(let k=1;k<=8;k++){await T('touchMove',x+dx*k/8,y+2);if(k===5&&mid)m=await mid()}await T('touchEnd');await settle(p,500);return m};
    const h=await p.evaluate(()=>{const hd=document.querySelector('#mbox .mhead'),t=hd.querySelector('h3').getBoundingClientRect(),b=document.querySelector('#mbox').getBoundingClientRect();
      return {arrows:document.querySelectorAll('#mbox .mbtns, #mbox .mhead button').length,centre:Math.abs((t.left+t.right)/2-(b.left+b.right)/2),hint:!!document.querySelector('#mbox .mhint'),legend:!!document.querySelector('#mbox .mlegend'),
        gap:Math.round(document.querySelector('#mbox .mdow').getBoundingClientRect().top-t.bottom),
        bar:Math.round(document.querySelector('#mbox .foldbar').getBoundingClientRect().top-Math.max(...[...document.querySelectorAll('#mbox .mc')].map(c=>c.getBoundingClientRect().bottom)))}});
    ok(h.arrows===0&&h.centre<=2&&!h.hint&&!h.legend,`no arrows, swipe tip or legend; the month and year are centred (${h.centre.toFixed(1)}px off)`);
    ok(h.gap<=8&&h.bar<=14,`the weekdays sit close under the title (${h.gap}px) and the Fold away bar right under the days (${h.bar}px)`);
    const day0=await p.evaluate(()=>key(sel)),c=await at();
    const mid=await swipe(c.x+60,c.y,-200,()=>p.evaluate(()=>document.querySelector('#mswipe').style.transform));
    ok(/translateX\(-/.test(mid||''),`the month follows the finger (${mid})`);
    ok(await title()==='January 2027'&&await p.evaluate(d=>key(sel)===d&&monthOpen&&scoreOpen,day0),'a swipe left inside the box shows the next month; the day and the other open boxes stay');
    const c2=await at();await swipe(c2.x-60,c2.y,200);await swipe(c2.x-60,c2.y,200);
    ok(await title()==='November 2026','swiping right goes back a month at a time');
    const c3=await at();await swipe(c3.x,c3.y,-40);
    ok(await title()==='November 2026'&&await p.evaluate(()=>{const s=document.querySelector('#mswipe').style.transform;return !s||s==='translateX(0px)'}),'a short drag springs back');
    // a swipe on the outfit (outside the month) still changes the day
    await p.evaluate(()=>scrollTo(0,0));await settle(p,200);
    const st=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,300)}});
    await swipe(st.x+80,st.y,-200);
    ok(await p.evaluate(d=>key(sel)!==d&&!monthOpen,day0),'a swipe on the outfit still changes the day (and folds the month)');
    // the fold bar
    await p.evaluate(()=>{toggleMonth()});await settle(p,700);
    await p.evaluate(()=>{const b=document.querySelector('#mbox .foldbar');b.scrollIntoView({block:'center'})});await settle(p,300);
    await p.tap('#mbox .foldbar');await settle(p,800);
    ok(await p.evaluate(()=>!monthOpen&&!document.querySelector('#mbox').classList.contains('open')),'tapping the Fold away bar folds the month');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
