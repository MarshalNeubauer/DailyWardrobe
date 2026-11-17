// Settings' own page: staying open, locking.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/settingsstay.test.js ---- */
// Work finishing in the background (photos, weather, the start-up plan check) redraws Today with refreshToday(): while Settings is
// open it waits until Settings closes, since drawing Today closes Settings (opened right after launch, it snapped shut).
const settingsstay=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today');
      openSettings();let drawn=0;const r0=renderToday;renderToday=function(){drawn++;return r0.apply(this,arguments)};
      refreshToday();const stillOpen=settingsOpen(),during=drawn;closeSettings();const after=drawn;renderToday=r0;
      refreshToday();return {stillOpen,during,after,closedNow:!settingsOpen()}});
    ok(r.stillOpen&&r.during===0,'a background redraw while Settings is open leaves Settings open');
    ok(r.after===1&&r.closedNow,'Today is redrawn once Settings closes');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/settingslock.test.js ---- */
// Settings over a long page: the page behind doesn't scroll while Settings is up (html.set-lock), Settings itself scrolls down and back
// up with Done in reach, closing gives the page back where it was, and the scroll that shows an opened category gives way to a touch.
// (On an iPhone a scroll in Settings near its top was handed to Today underneath and Settings stood still: Chromium can't show that
// part, so this checks the lock that prevents it.)
const settingslock=async({ok,chromium,url,settle})=>{
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
    // a category opened near the bottom unfolds where it is: Settings never scrolls by itself (the owner, 2026-11-17)
    const toggle=async(touch)=>p.evaluate(async touch=>{openSettings();const m=document.querySelector('#settings-modal');await new Promise(r=>setTimeout(r,50));
      const el=document.querySelector('#sc-backup');m.scrollTop=Math.max(0,el.offsetTop-m.clientHeight+90);const before=m.scrollTop;   // its head near the bottom
      toggleCat('backup');if(touch){await new Promise(r=>setTimeout(r,150));m.dispatchEvent(new Event('touchstart'))}
      await new Promise(r=>setTimeout(r,1100));const after=m.scrollTop;toggleCat('backup');closeSettings();return {before,after}},touch);
    let t=await toggle(false);ok(t.before>0&&t.after===t.before,`an opened category near the bottom unfolds without Settings scrolling (${t.before} → ${t.after}px)`);
    t=await toggle(true);ok(t.after===t.before,`nor after a finger touched Settings (${t.before} → ${t.after}px)`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['settingsstay',settingsstay],['settingslock',settingslock]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
