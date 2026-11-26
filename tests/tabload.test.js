// A tab tapped while the page's later scripts are still loading (2026-11-22). start.js `show` (nav.js's since the restructure S3f) then called names of scripts that had not
// run yet (renderWardrobe needs wardrobe.js's wardKeep, the Insights page stats.js), so the tap threw a page error, and start-up went
// to Today whatever was tapped. Now such a tap is only noted, and start-up shows the tab once Today is up.
// The later scripts are held back here by the routes (safety.js, the script after start.js since the restructure S3a moved ui.js, waits for the test: a classic script blocks
// the ones after it, a deferred one runs in order too), the tab is tapped with a finger, then the scripts are let go.
// Chromium and WebKit (Safari's engine), with touch.
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',origin=new URL(url).origin;
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1')});
  let hold=null,open=()=>{},hits=0;   // while hold is a promise, safety.js waits for it; hits: safety.js requests that reached the route
  await ctx.route(u=>u.href.startsWith(origin)&&/\/safety\.js(\?|$)/.test(u.href),async route=>{hits++;if(hold)await hold;await route.continue().catch(()=>{})});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  // a stored wardrobe: two pieces, kept by the app itself
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(async()=>{if(document.querySelector('#setup.on'))HOOK.setupClose();
    await put({id:'tl-shirt',type:'shirt',primaryColor:'white',pattern:'solid',added:1});await put({id:'tl-tie',type:'tie',primaryColor:'navy',pattern:'solid',added:2})});
  const state=()=>p.evaluate(()=>({shown:['today','wardrobe','add','stats'].filter(s=>!document.querySelector('#'+s).hidden).join(),
    on:[...document.querySelectorAll('body>nav button.on')].map(b=>b.id).join(),cur:[...document.querySelectorAll('body>nav button[aria-current=page]')].map(b=>b.id).join(),
    cards:document.querySelectorAll('#wardrobe [data-id],#wardrobe .card,#wardrobe .witem').length,wtext:document.querySelector('#wardrobe').textContent.length,
    stext:document.querySelector('#stats').textContent.length,ttext:document.querySelector('#today').textContent.length,n:items.length,setup:!!document.querySelector('#setup.on')}));
  // loads the page with the later scripts held, taps the tabs named, lets the scripts go and waits for start-up
  const load=async taps=>{errs.length=0;hold=new Promise(r=>open=r);const hits0=hits;
    await p.goto(url,{waitUntil:'commit'});
    await p.waitForFunction(()=>'tabTap' in HOOK&&typeof HOOK.tabTap==='function'&&'todayTabTap' in HOOK&&typeof HOOK.todayTabTap==='function'&&!!document.querySelector('#n-stats'),null,{polling:50});   // (not polled by animation frame, the default: WebKit draws no frame while a script is awaited)
    const before={late:await p.evaluate(()=>typeof wardKeep==='undefined'&&typeof renderStats==='undefined'&&typeof errNote==='undefined'&&!window.appReady),net:hits-hits0};
    // Chromium: a finger at the tab's middle. WebKit: the tab's click (as tests/webkit.js's touches end): Playwright's WebKit takes no
    // input while a script is awaited (page.tap and touchscreen.tap never return; no animation frame is drawn either)
    for(const id of taps){
      if(eng==='Chromium'){const b=await p.evaluate(id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}},id);await p.touchscreen.tap(b.x,b.y)}
      else await p.evaluate(id=>document.querySelector(id).click(),id);
      await new Promise(r=>setTimeout(r,150))}
    before.errs=errs.slice();before.shown=await p.evaluate(()=>['today','wardrobe','add','stats'].filter(s=>!document.querySelector('#'+s).hidden).join());
    hold=null;open();
    await p.waitForFunction(()=>window.appReady,null,{timeout:20000});await settle(p,400);
    return {before,after:await state(),errs:errs.slice()}};
  // each load really holds the later scripts: safety.js came from the network to the route (not from a service worker's cache, which
  // the route never sees: 2026-11-24, every load after the first was a finished page) and had not run when the tabs were tapped
  const held=(r,what)=>ok(r.before.net===1&&r.before.late,T+what+`: safety.js was asked of the network and held, the later scripts not run when tapped (safety.js requests ${r.before.net}, held ${r.before.late})`);
  let r=await load(['#n-wardrobe']);held(r,'Wardrobe tapped');
  ok(r.before.late,T+'the later scripts (safety.js on: wardrobe.js, stats.js) have not run when the tab is tapped');
  ok(r.before.errs.length===0,T+`Wardrobe tapped while the later scripts load: no page error (${r.before.errs.join(' | ')||'none'})`);
  ok(r.after.shown==='wardrobe'&&r.after.on==='n-wardrobe'&&r.after.cur==='n-wardrobe',T+`after start-up the app is on the Wardrobe, its tab marked (${JSON.stringify(r.after)})`);
  ok(r.after.n===2&&r.after.wtext>0&&await p.evaluate(()=>['tl-shirt','tl-tie'].every(id=>document.querySelector('#wardrobe').innerHTML.includes(id))),T+'the Wardrobe shows the stored pieces, not an empty wardrobe');
  ok(r.errs.length===0,T+`no page error through start-up (${r.errs.join(' | ')||'none'})`);
  r=await load(['#n-stats']);held(r,'Insights tapped');
  ok(r.before.errs.length===0,T+`Insights tapped while the later scripts load: no page error (${r.before.errs.join(' | ')||'none'})`);
  ok(r.after.shown==='stats'&&r.after.on==='n-stats'&&r.after.stext>0,T+`after start-up the app is on Insights, drawn (${JSON.stringify(r.after)})`);
  ok(r.errs.length===0,T+`no page error through start-up (${r.errs.join(' | ')||'none'})`);
  r=await load(['#n-wardrobe','#n-today']);held(r,'Wardrobe, then Today tapped');
  ok(r.before.errs.length===0&&r.errs.length===0,T+`Wardrobe, then Today tapped while loading: no page error (${r.before.errs.concat(r.errs).join(' | ')||'none'})`);
  ok(r.after.shown==='today'&&r.after.on==='n-today'&&r.after.ttext>0,T+`the last tab tapped wins: the app is on Today (${JSON.stringify(r.after)})`);
  r=await load(['#n-stats','#n-wardrobe']);held(r,'Insights, then Wardrobe tapped');
  ok(r.after.shown==='wardrobe'&&r.errs.length===0,T+`Insights, then Wardrobe: the app is on the Wardrobe (${r.after.shown})`);
  r=await load([]);held(r,'no tap');
  ok(r.after.shown==='today'&&r.after.on==='n-today'&&r.errs.length===0,T+`no tap: the app starts on Today as before (${r.after.shown})`);
  // after start-up a tab works at once, as before
  await p.tap('#n-wardrobe');ok((await state()).shown==='wardrobe',T+'a tab tapped after start-up shows its page at once');
  await p.tap('#n-today');ok((await state()).shown==='today',T+'and the Today tab brings Today back');
  await ctx.close();
}
