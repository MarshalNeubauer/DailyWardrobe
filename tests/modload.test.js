// The load model for ES modules (the ES-module move, step 2, 2026-11-23; no file is a module yet): every page script is deferred and
// startUp() runs after them from an inline module. The page is then drawn, and takes taps, before its scripts have run, so:
// - what must happen before the first paint stays a plain script in <head>: the saved theme, the text size, the start-up catcher;
// - afterDom keeps its own DOMContentLoaded flag (document.readyState is already 'interactive' while deferred scripts run);
// - a tap on a tab, the gear or the theme button before its script has run is no page error, and the app starts on the right page;
// - locale.js's Date patch is in before any date is drawn, also on an Arabic-language phone;
// - a script that can't be loaded: start-up still says so and the stored wardrobe is untouched (CR-7-03), from <head> when start.js
//   itself never ran.
// One script is held back (or refused) by the routes; Chromium taps with a finger, WebKit sends the control's click (Playwright's
// WebKit takes no input while a script is awaited). Chromium and WebKit.
const fs=require('fs'),path=require('path'),ROOT=path.join(__dirname,'..');
module.exports=async({ok,engines,url,settle})=>{
  // the markup: every script with a src is deferred, the start is an inline module after them, the head's three are plain and first
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,''),tags=[...html.matchAll(/<script\b([^>]*)>/g)].map(m=>m[1]);
  const withSrc=tags.filter(t=>/\bsrc=/.test(t)),inline=tags.filter(t=>!/\bsrc=/.test(t)),head=html.slice(0,html.indexOf('</head>'));
  ok(withSrc.length>80&&withSrc.every(t=>/\bdefer\b/.test(t)&&!/\basync\b/.test(t)),`every page script is deferred (${withSrc.filter(t=>/\bdefer\b/.test(t)).length} of ${withSrc.length})`);
  ok(withSrc.every(t=>!/type=/.test(t)),'no page script is a module yet');
  ok(/<script type="module">startUp\(\)<\/script>\s*<\/body>/.test(html)&&inline.filter(t=>/module/.test(t)).length===1,'startUp() is the page\'s last script, an inline module: it runs after every deferred script');
  const headTags=[...head.matchAll(/<script\b([^>]*)>/g)].map(m=>m[1]);
  ok(headTags.length===3&&headTags.every(t=>t.trim()==='')&&/localStorage\.getItem\("theme"\)/.test(head)&&/--tscale/.test(head)&&/start-fail/.test(head),
    'the head\'s three scripts (the saved theme, the text size, the start-up catcher) are plain inline scripts: they run before the first paint');
  ok(head.indexOf('getItem("theme")')<head.indexOf('rel="stylesheet"')&&/<link rel="stylesheet" href="styles\.css">/.test(head),'the theme is set before the stylesheet, which still blocks the first paint');
  ok(/let domDone=false;addEventListener\('DOMContentLoaded'/.test(fs.readFileSync(path.join(ROOT,'app.js'),'utf8'))&&!/const afterDom=.*readyState/.test(fs.readFileSync(path.join(ROOT,'app.js'),'utf8')),'afterDom has its own DOMContentLoaded flag and doesn\'t read document.readyState');
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',origin=new URL(url).origin,wait=ms=>new Promise(r=>setTimeout(r,ms));
  const open=async(opt={},init)=>{const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:eng==='Chromium',...opt});
    await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.addInitScript(()=>{try{localStorage.setItem('tour_seen','1')}catch(e){}});if(init)await ctx.addInitScript(init);
    const c={ctx,held:'',hold:null,let:()=>{},refuse:null,errs:[]};
    // one script waits for the test (held), or is answered with something else (refuse: {name: {status, body}})
    await ctx.route(u=>u.href.startsWith(origin)&&/\.js$/.test(u.pathname),async route=>{const name=new URL(route.request().url()).pathname.slice(1);
      if(c.refuse&&c.refuse[name])return route.fulfill({status:c.refuse[name].status||200,contentType:'text/javascript',body:c.refuse[name].body||''});
      if(c.hold&&name===c.held)await c.hold;await route.continue().catch(()=>{})});
    c.p=await ctx.newPage();c.p.on('pageerror',e=>c.errs.push(e.message));
    await c.p.goto(url);await c.p.waitForFunction(()=>window.appReady);
    await c.p.evaluate(async()=>{if(document.querySelector('#setup.on'))setupClose();settings.setupDone=1;await saveUserSettings();
      await put({id:'ml-shirt',type:'shirt',primaryColor:'white',pattern:'solid',added:1});await put({id:'ml-tie',type:'tie',primaryColor:'navy',pattern:'solid',added:2});await put({id:'ml-suit',type:'suit',primaryColor:'navy',pattern:'solid',added:3})});
    return c};
  // loads the page with one script held: every script before it has run, none after
  const held=async(c,name,ready)=>{c.errs.length=0;c.held=name;c.hold=new Promise(r=>c.let=r);
    await c.p.goto('about:blank');await c.p.goto(url,{waitUntil:'commit'});
    await c.p.waitForFunction(ready||(()=>!!document.querySelector('body>nav')),null,{polling:25});await wait(250)};
  const go=async c=>{c.hold=null;c.let();await c.p.waitForFunction(()=>window.appReady,null,{timeout:20000});await settle(c.p,400)};
  const tap=async(c,sel)=>{if(eng==='Chromium'){const b=await c.p.evaluate(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}},sel);await c.p.touchscreen.tap(b.x,b.y)}
    else await c.p.evaluate(sel=>document.querySelector(sel).click(),sel);await wait(150)};
  const shown=c=>c.p.evaluate(()=>['today','wardrobe','add','stats'].filter(s=>!document.querySelector('#'+s).hidden).join());
  const CTRL={Today:'#n-today',Wardrobe:'#n-wardrobe',Insights:'#n-stats','the gear':'header .hbtns button[data-act="setOpenTap"]','the theme button':'#theme-btn'};

  /* ---- taps while the scripts load ---- */
  const c=await open();
  await held(c,'add.js',()=>typeof ACTS==='object');
  const st0=await c.p.evaluate(()=>({n:Object.keys(ACTS).length,rs:document.readyState,nav:!!document.querySelector('#n-stats'),late:typeof show==='undefined'&&typeof startUp==='undefined'}));
  ok(st0.n===0&&st0.late&&st0.nav,T+`with add.js held the page is drawn and act.js listens, but no script has registered a handler yet (${JSON.stringify(st0)})`);
  ok(st0.rs==='interactive',T+`document.readyState is already "interactive" while the deferred scripts run (${st0.rs}): afterDom can't go by it`);
  const early=await c.p.evaluate(()=>{window.__ad=0;afterDom(()=>{window.__ad++});return window.__ad});
  for(const sel of Object.values(CTRL))await tap(c,sel);
  ok(c.errs.length===0,T+`each tab, the gear and the theme button tapped before any handler is registered: no page error (${c.errs.join(' | ')||'none'})`);
  await go(c);
  ok(early===0&&await c.p.evaluate(()=>window.__ad)===1,T+'afterDom waits for the last script: its function didn\'t run while they were loading, and ran once after');
  ok(await c.p.evaluate(()=>{let r=0;afterDom(()=>{r++});return r})===1,T+'after that afterDom runs its function at once');
  ok(await shown(c)==='today'&&c.errs.length===0&&await c.p.evaluate(()=>items.length===3&&!settingsOpen()),T+`those taps are dropped: the app starts on Today with its wardrobe, no page error (${c.errs.join(' | ')||'none'})`);
  await held(c,'start.js',()=>typeof todayTabTap==='function'&&typeof setOpenTap==='function'&&typeof themeTap==='function');
  await tap(c,CTRL.Today);await tap(c,CTRL.Wardrobe);await tap(c,CTRL.Insights);
  ok(c.errs.length===0,T+`the tabs tapped with today.js in and start.js not: no page error (${c.errs.join(' | ')||'none'})`);
  await go(c);ok(await shown(c)==='today'&&c.errs.length===0,T+'and the app starts on Today');
  await held(c,'ui.js',()=>typeof tabTap==='function');
  await tap(c,CTRL['the gear']);const setEarly=await c.p.evaluate(()=>settingsOpen());await tap(c,CTRL['the theme button']);
  const themed=await c.p.evaluate(()=>document.documentElement.dataset.theme||'');
  ok(c.errs.length===0,T+`the gear and the theme button tapped with their scripts in and the later ones not: no page error (${c.errs.join(' | ')||'none'}; Settings ${setEarly?'opened':'did not open'}, theme "${themed}")`);
  await tap(c,CTRL.Insights);await go(c);
  ok(await shown(c)==='stats'&&c.errs.length===0&&await c.p.evaluate(()=>items.length===3&&settings.setupDone===1),T+`after start-up the app is on Insights, the tab tapped last, with its wardrobe and settings (${await shown(c)}; ${c.errs.join(' | ')||'no page error'})`);
  await c.p.evaluate(()=>{try{localStorage.removeItem('theme')}catch(e){}});

  /* ---- a script that can't be loaded (CR-7-03) ---- */
  const card=()=>c.p.evaluate(()=>{const d=document.querySelector('#today #start-fail');return d?{text:d.textContent,btn:!!d.querySelector('button'),vis:d.getBoundingClientRect().height>40&&!document.querySelector('#today').hidden,role:d.getAttribute('role')}:null});
  const stored=()=>c.p.evaluate(async()=>(await tx('readonly',s=>s.getAll())).map(i=>i.id).sort().join());
  const fail=async(refuse,until,ms)=>{c.errs.length=0;c.refuse=refuse;c.hold=null;await c.p.goto('about:blank');await c.p.goto(url,{waitUntil:'load'});
    await c.p.waitForFunction(until,null,{timeout:ms||15000,polling:100}).catch(()=>{});return card()};
  // start.js itself: nothing can say "start-up failed" but the head's own script
  let k=await fail({'start.js':{status:404}},()=>!!document.querySelector('#start-fail'));
  ok(k&&/The app couldn’t start\./.test(k.text)&&/Your wardrobe is safe on this phone: nothing was deleted\./.test(k.text)&&k.btn&&k.vis&&k.role==='alert',T+`start.js can't be loaded: Today's place says the app couldn't start and that the wardrobe is safe, with Try again (${JSON.stringify(k)})`);
  const log=await c.p.evaluate(()=>JSON.parse(localStorage.getItem('err_log')||'[]').filter(x=>/^Start-up: the app didn’t start/.test(x.m)).map(x=>x.m));
  ok(log.length===1&&/not loaded: start\.js/.test(log[0]),T+`and it is noted for the error report (${log.join(' | ')})`);
  ok(await stored()==='ml-shirt,ml-suit,ml-tie',T+'the stored wardrobe is untouched');
  // Try again loads the page again: this time start.js comes
  c.refuse=null;c.errs.length=0;
  await Promise.all([c.p.waitForFunction(()=>window.appReady&&!document.querySelector('#start-fail'),null,{timeout:20000,polling:100}),c.p.evaluate(()=>document.querySelector('#start-fail button').click())]);
  ok(await shown(c)==='today'&&await c.p.evaluate(()=>items.length)===3&&await stored()==='ml-shirt,ml-suit,ml-tie',T+'Try again starts the app, with the wardrobe as it was');
  // a script that doesn't parse (what a failed import is to a module graph), early in the list: start-up can't finish
  k=await fail({'core.js':{body:'const broken=;'}},()=>!!document.querySelector('#start-fail'),12000);
  ok(k&&/couldn’t start/.test(k.text)&&k.btn,T+`core.js doesn't parse: start-up can't get anywhere, and the same card says so a few seconds after the page has loaded (${k?'shown':'not shown'})`);
  // a late script missing: the app starts without that feature, and no card
  k=await fail({'about.js':{status:404}},()=>window.appReady);await wait(5200);k=await card();
  ok(!k&&await shown(c)==='today'&&await c.p.evaluate(()=>window.appReady&&items.length===3&&document.querySelector('#today').children.length>0),T+'about.js can\'t be loaded: the app still starts on Today with its wardrobe, and no start-up card covers it');
  c.refuse=null;await c.ctx.close();

  /* ---- an Arabic-language phone: dates are drawn after locale.js's patch ---- */
  const a=await open({locale:'ar-KW',timezoneId:'Asia/Kuwait'});
  ok(await a.p.evaluate(()=>/^ar/.test(navigator.language)),T+'the phone\'s language is Arabic');
  await held(a,'locale.js',()=>typeof todayTabTap==='function');
  const raw=await a.p.evaluate(()=>({patched:!!Date.prototype._dwLoc,sample:new Date(2026,10,15).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}),drawn:document.querySelector('#today').textContent.length}));
  ok(!raw.patched&&/[؀-ۿ]/.test(raw.sample)&&raw.drawn===0,T+`with locale.js held the patch is not in (a date would read "${raw.sample}") and nothing is drawn yet`);
  await tap(a,CTRL.Today);await tap(a,CTRL.Wardrobe);
  const mid=await a.p.evaluate(()=>document.body.innerText);
  ok(!/[؀-ۿ٠-٩]/.test(mid)&&a.errs.length===0,T+'taps before the patch draw no date: no Arabic letter or digit on the page, no page error');
  await go(a);await a.p.evaluate(()=>show('today'));await settle(a.p,300);
  const txt=await a.p.evaluate(()=>({all:document.querySelector('#today').innerText,head:(document.querySelector('#today .dlong')||document.querySelector('#today')).textContent.slice(0,60),sample:new Date(2026,10,15).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}));
  ok(!/[؀-ۿ]/.test(txt.all)&&/(January|February|March|April|May|June|July|August|September|October|November|December)/.test(txt.all)&&txt.sample==='Sunday, November 15',
    T+`after start-up Today's dates are in English with Latin digits ("${txt.head.replace(/\s+/g,' ').trim()}"; a date reads "${txt.sample}")`);
  await held(a,'ui.js',()=>typeof tabTap==='function');await tap(a,CTRL.Insights);await go(a);
  ok(!/[؀-ۿ]/.test(await a.p.evaluate(()=>document.body.innerText))&&await shown(a)==='stats'&&a.errs.length===0,T+'a tab tapped during loading, then Insights after start-up: no Arabic date anywhere, no page error');
  await a.ctx.close();

  /* ---- the saved theme is on the page before any deferred script has run ---- */
  for(const [saved,scheme] of [['dark','light'],['light','dark']]){
    const t=await open({colorScheme:scheme},`try{localStorage.setItem('theme','${saved}')}catch(e){}`);
    await held(t,'merge.js',()=>!!document.querySelector('body>nav'));
    const v=await t.p.evaluate(()=>({theme:document.documentElement.dataset.theme||'',bg:getComputedStyle(document.body).backgroundColor,core:typeof TYPES,want:null}));
    const want=await t.p.evaluate(s=>{const d=document.createElement('div');d.style.cssText='position:absolute;visibility:hidden';d.setAttribute('data-x','');document.documentElement.appendChild(d);
      const old=document.documentElement.dataset.theme;document.documentElement.dataset.theme=s==='dark'?'light':'dark';const other=getComputedStyle(document.body).backgroundColor;document.documentElement.dataset.theme=old;d.remove();return other},saved);
    ok(v.core==='undefined'&&v.theme===saved&&v.bg!==want,T+`a saved ${saved} theme on a ${scheme} phone: set before the first script (merge.js held, none has run), the page already in its colors (${v.bg}, the other theme's is ${want})`);
    await go(t);ok(await t.p.evaluate(s=>document.documentElement.dataset.theme===s,saved)&&t.errs.length===0,T+`and it is still ${saved} after start-up, no page error`);
    await t.ctx.close()}
}
