// Today at its edges (fix round A, 2026-11-17; the code review's CR-4-06, -07, -08, -11): a break of more than a week of days off
// (the Today tab and › land on the first workday after it, not inside it), Reset after a swap and a jacket taken off (the day's suit or
// blazer goes with the rest), ← / → while Settings or the piece picker is open (they stay open, the day stays), and a sync arriving
// while a finger is on Today (the redraw waits for the finger to lift).
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'Asia/Kuwait'});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const day=()=>p.evaluate(()=>isoKey(sel));
    // ---- a vacation of own days off, Sunday 22 November to Thursday 3 December: two work weeks and the weekends around them
    await p.evaluate(W=>{W=eval(W);const t0=new Date(2026,9,1).getTime();HOOK.items=W.realistic.map(i=>({...i,added:t0}));settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.holidays=null;
      const off=[];for(let d=new Date(2026,10,22);d<=new Date(2026,11,3);d.setDate(d.getDate()+1))off.push({d:isoKey(d),n:'Vacation'});settings.daysOff=off;
      HOOK.TODAY_OVERRIDE='2026-11-21T09:00:00';HOOK.dayRecs={};HOOK.cache={};HOOK.sel=new Date(2026,10,19);HOOK.view={y:2026,m:10};show('wardrobe')},WARDROBES);
    await p.click('#n-today');await settle(p,400);
    ok(await day()==='2026-12-06'&&!!(await p.$('#mannequin-container')),`the Today tab opens on the first workday after a 12-day break (${await day()}), with its outfit`);
    await p.evaluate(()=>{HOOK.sel=new Date(2026,10,19);HOOK.view={y:2026,m:10};renderToday()});
    await p.click('#today .nav.day button[aria-label="Next day"]');await settle(p,400);
    ok(await day()==='2026-12-06','› from the Thursday before the break goes to the Sunday after it');
    await p.click('#today .nav.day button[aria-label="Previous day"]');await settle(p,400);
    ok(await day()==='2026-11-19','‹ from there goes back to that Thursday');
    // ---- Reset: a swap, then the blazer taken off (which fixes the day as a blazer day), then Reset
    await p.evaluate(()=>{settings.daysOff=[];HOOK.TODAY_OVERRIDE='2026-11-22T09:00:00';HOOK.dayRecs={};HOOK.cache={};HOOK.sel=new Date(2026,10,26);HOOK.view={y:2026,m:10};HOOK.listOpen=false;renderToday()});   // Thursday 26 November, a blazer day
    await p.click('#ibox .month-link');await settle(p,400);
    await p.click('#ibox .row button[aria-label="Change tie"]');await p.click('#pick-next');await p.waitForFunction(()=>planFor()[key(sel)].overrides);
    await p.click('#ibox button[aria-label="Take off the blazer"]');await p.waitForFunction(()=>{const r=dayRecs[key(sel)];return r&&r.off&&r.off.top});
    const pinned=await p.evaluate(()=>dayRecs[key(sel)].kind);
    await p.click('[aria-label="Reset changes"]');await p.waitForFunction(()=>!document.querySelector('#rbox'));
    const r=await p.evaluate(()=>{const x=dayRecs[key(sel)]||{};return {kind:x.kind||null,force:!!x.force,off:!!x.off}});
    ok(pinned==='blazer'&&!r.kind&&!r.force&&!r.off,`Reset after a swap and the blazer taken off puts back the planned day, its blazer-day pin too (kind ${pinned} → ${r.kind})`);
    // ---- the arrow keys under a layer
    await p.click('header .hbtns button[data-act="setOpenTap"]');await p.waitForFunction(()=>settingsOpen());
    const d0=await day();await p.keyboard.press('ArrowRight');await settle(p,200);
    ok(await p.evaluate(()=>settingsOpen())&&await day()===d0,'→ with Settings open leaves Settings open and the day as it was');
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!settingsOpen()).catch(()=>p.evaluate(()=>closeSettings()));
    if(!(await p.$('#ibox.open')))await p.click('#ibox .month-link');
    await p.click('#ibox .row button[aria-label="Change tie"]');await p.waitForFunction(()=>!!picker);
    await p.keyboard.press('ArrowLeft');await settle(p,200);
    ok(await p.evaluate(()=>!!picker)&&await day()===d0,'← with the piece picker open leaves it open and the day as it was');
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!picker);
    await p.focus('body');await p.keyboard.press('ArrowRight');await settle(p,200);
    ok(await day()!==d0,'→ with nothing open still steps the day');
    // ---- a sync's redraw while a finger is on Today
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const st=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();window.__slide=document.querySelector('#slide');return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,300)}});
    await T('touchStart',st.x,st.y);
    const during=await p.evaluate(()=>{syncRedraw('today');return {same:document.querySelector('#slide')===window.__slide,wait:HOOK.syncLater}});
    await T('touchEnd');await p.waitForFunction(()=>HOOK.syncLater===null&&document.querySelector('#slide')!==window.__slide,null,{timeout:5000}).catch(()=>{});
    const after=await p.evaluate(()=>({redrawn:document.querySelector('#slide')!==window.__slide,wait:HOOK.syncLater}));
    ok(during.same&&during.wait==='today','a sync arriving while a finger is on Today waits (the element the touch began on stays)');
    ok(after.redrawn&&after.wait===null,'…and Today is drawn again once the finger lifts');
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};
