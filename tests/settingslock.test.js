// Settings over a long page: the page behind doesn't scroll while Settings is up (html.set-lock), Settings itself scrolls down and back
// up with Done in reach, closing gives the page back where it was, and the scroll that shows an opened category gives way to a touch.
// (On an iPhone a scroll in Settings near its top was handed to Today underneath and Settings stood still: Chromium can't show that
// part, so this checks the lock that prevents it.)
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // a page long enough to scroll behind Settings
    await p.evaluate(()=>{document.querySelector('main').style.minHeight='4000px';scrollTo(0,600)});await settle(p,200);
    const y0=await p.evaluate(()=>scrollY);
    await p.evaluate(()=>openSettings());await settle(p,300);
    let s=await p.evaluate(()=>({lock:document.documentElement.classList.contains('set-lock'),ov:getComputedStyle(document.documentElement).overflowY,bov:getComputedStyle(document.body).overflowY,y:scrollY}));
    ok(s.lock&&s.ov==='hidden'&&s.bov==='hidden'&&s.y===y0,`opening Settings locks the page behind it where it was (${s.ov}/${s.bov}, ${s.y} of ${y0}px)`);
    // every category open, so Settings is long; the wheel scrolls Settings and never the page
    await p.evaluate(()=>{for(const k of SET_CATS)setCatOpen(k,true,true)});await settle(p,200);
    const tall=await p.evaluate(()=>{const m=document.querySelector('#settings-modal');return m.scrollHeight-m.clientHeight});
    await p.mouse.move(200,500);for(let k=0;k<6;k++){await p.mouse.wheel(0,600);await p.waitForTimeout(30)}await settle(p,300);
    s=await p.evaluate(()=>({top:document.querySelector('#settings-modal').scrollTop,y:scrollY}));
    ok(tall>1500&&s.top>1500&&s.y===y0,`Settings scrolls down (${s.top} of ${tall}px) and the page behind stays (${s.y}px)`);
    const done=await p.evaluate(()=>{const b=document.querySelector('#settings-modal .sdone'),r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {inView:r.top>=0&&r.bottom<=innerHeight,hit:!!e&&!!e.closest('.sdone')}});
    ok(done.inView&&done.hit,'scrolled down, Done is on screen and takes the tap');
    // back up past the top: Settings reaches its top, the page behind still doesn't move
    for(let k=0;k<10;k++){await p.mouse.wheel(0,-800);await p.waitForTimeout(30)}await settle(p,300);
    s=await p.evaluate(()=>({top:document.querySelector('#settings-modal').scrollTop,y:scrollY}));
    ok(s.top===0&&s.y===y0,`scrolling back up reaches the top of Settings (${s.top}px) and leaves the page behind alone (${s.y}px)`);
    // Done closes it: the lock goes and the page is where it was, and scrolls again
    await p.click('#settings-modal .sdone');await settle(p,300);
    s=await p.evaluate(()=>({lock:document.documentElement.classList.contains('set-lock'),open:settingsOpen(),y:scrollY,ov:getComputedStyle(document.body).overflowY}));
    ok(!s.open&&!s.lock&&s.ov!=='hidden'&&s.y===y0,`Done closes Settings and gives the page back where it was (${s.y}px)`);
    await p.mouse.wheel(0,300);await settle(p,300);ok(await p.evaluate(y=>scrollY>y,y0),'and the page scrolls again');
    // the scroll that shows a category just opened: it still runs when nothing touched the screen...
    const toggle=async(touch)=>p.evaluate(async touch=>{openSettings();const m=document.querySelector('#settings-modal');await new Promise(r=>setTimeout(r,50));
      const el=document.querySelector('#sc-backup');m.scrollTop=Math.max(0,el.offsetTop-m.clientHeight+90);const before=m.scrollTop;   // its head near the bottom
      toggleCat('backup');if(touch){await new Promise(r=>setTimeout(r,150));m.dispatchEvent(new Event('touchstart'))}
      await new Promise(r=>setTimeout(r,1100));const after=m.scrollTop;toggleCat('backup');closeSettings();return {before,after}},touch);
    let t=await toggle(false);ok(t.after>t.before+40,`an opened category near the bottom is scrolled into view (${t.before} → ${t.after}px)`);
    // ...and gives way to a finger that touched the screen after the tap
    t=await toggle(true);ok(t.after===t.before,`but not when a finger touched Settings since the tap (${t.before} → ${t.after}px)`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
