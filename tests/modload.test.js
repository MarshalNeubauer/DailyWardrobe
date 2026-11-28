// The load model and the load contract (all or nothing, A1 and A2; the owner's decision of 2026-11-28). tests/retry.test.js checks
// the gate itself on both engines: each page file that can't be loaded, doesn't parse, doesn't link or throws stops start-up, one
// reload, then the start-up card; and the lazy parser's late failure shows the toast. This file:
// - the markup: every script with a src is deferred, the entry is the last script, the head's three are plain and first;
// - tests/load-contract.json, read statically with acorn: every page script listed; the lazy list is the page's import() calls; the
//   import rules (a file imports only its own layer or a lower one, or a file whose tag comes earlier; no import cycle runs code at
//   load; the painting worker's closure is its listed files, srgb.js and bus.js); the sockets optional by design; a planted break of
//   each rule is caught;
// - on Chromium and WebKit: with every file there each page script runs to its end, in the order worked out from the tags and the
//   imports, and start-up doesn't fail; the load model (taps while the scripts load, afterDom, an Arabic-language phone's dates, a
//   slow start never taken for a failed one, the saved theme before the first script, back.js and locale.js as modules).
// One script is held back by the routes; Chromium taps with a finger, WebKit sends the control's click (Playwright's WebKit takes no
// input while a script is awaited).
const fs=require('fs'),path=require('path'),ROOT=path.join(__dirname,'..');
module.exports=async({ok,engines,url,settle})=>{
  // the markup: every script with a src is deferred, the start is an inline module after them, the head's three are plain and first
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,''),tags=[...html.matchAll(/<script\b([^>]*)>/g)].map(m=>m[1]);
  const withSrc=tags.filter(t=>/\bsrc=/.test(t)),inline=tags.filter(t=>!/\bsrc=/.test(t)),head=html.slice(0,html.indexOf('</head>'));
  const isMod=t=>/\btype="module"/.test(t),srcOf=t=>(/\bsrc="([^"]+)"/.exec(t)||[])[1],modTags=withSrc.filter(isMod);
  ok(withSrc.length>80&&withSrc.every(t=>!/\basync\b/.test(t)&&(isMod(t)?!/\bdefer\b/.test(t):/\bdefer\b/.test(t)&&!/type=/.test(t))),`every page script is deferred: a classic one by \`defer\`, a module by being one (${withSrc.length-modTags.length} and ${modTags.length} of ${withSrc.length}); none is async`);
  const page=withSrc.map(srcOf);
  ok(page.indexOf('back.js')===page.indexOf('app.js')+1&&page.indexOf('act.js')===page.indexOf('back.js')+1&&page.indexOf('locale.js')>page.indexOf('act.js')&&page.indexOf('locale.js')<page.indexOf('settings.js')&&isMod(withSrc[page.indexOf('back.js')])&&isMod(withSrc[page.indexOf('locale.js')])&&!modTags.some(t=>/^merge\.js$/.test(srcOf(t)))&&modTags.some(t=>/^srgb\.js$/.test(srcOf(t))),
    'back.js and locale.js are modules with a tag each, where they always were in the list (back.js between app.js and act.js, locale.js before settings.js); merge.js, which the server imports, is not a module (srgb.js is one since C3, with asm-worker.js a module worker)');
  // (all or nothing, A1: the entry imports every page file, then calls startUp(); tests/retry.test.js checks its list and what it stops)
  ok(/<script type="module">[^<]*if\(self\.DW_MERGE\)\{window\.dwEntry=1;startUp\(\)\}<\/script>\s*<\/body>/.test(html)&&inline.filter(t=>/module/.test(t)).length===1,'startUp() is called by the page\'s last script, an inline module (the entry): it runs after every deferred script');
  const headTags=[...head.matchAll(/<script\b([^>]*)>/g)].map(m=>m[1]);
  ok(headTags.length===3&&headTags.every(t=>t.trim()==='')&&/localStorage\.getItem\("theme"\)/.test(head)&&/--tscale/.test(head)&&/start-fail/.test(head),
    'the head\'s three scripts (the saved theme, the text size, the start-up catcher) are plain inline scripts: they run before the first paint');
  ok(head.indexOf('getItem("theme")')<head.indexOf('rel="stylesheet"')&&/<link rel="stylesheet" href="styles\.css">/.test(head),'the theme is set before the stylesheet, which still blocks the first paint');
  ok(/let domDone=false;addEventListener\('DOMContentLoaded'/.test(fs.readFileSync(path.join(ROOT,'app.js'),'utf8'))&&!/const afterDom=.*readyState/.test(fs.readFileSync(path.join(ROOT,'app.js'),'utf8')),'afterDom has its own DOMContentLoaded flag and doesn\'t read document.readyState');

  /* ---- the load contract (tests/load-contract.json), read from the files ---- */
  const C=contract();
  ok(C.files.join()===page.join(),`the contract lists every page script, in index.html's order, and nothing else (${C.files.length} of ${page.length}${page.filter(f=>!C.files.includes(f)).map(f=>'; not listed: '+f).join('')}${C.files.filter(f=>!page.includes(f)).map(f=>'; not a page script: '+f).join('')})`);
  const imports=importsOf(ROOT,page),dyn=importsOf(ROOT,page,true);
  const lazyGot=Object.entries(dyn).flatMap(([f,l])=>l.map(t=>t+' by '+f)).sort(),lazyWant=Object.entries(C.lazy).map(([t,e])=>t+' by '+e.by).sort();
  ok(lazyGot.join()===lazyWant.join()&&Object.keys(C.lazy).every(t=>!page.includes(t)&&fs.existsSync(path.join(ROOT,t))),`the lazy list is the page's import() calls (${lazyGot.join(', ')||'none'}; the contract: ${lazyWant.join(', ')})`);
  const notPage=[...new Set(Object.values(imports).flat().filter(t=>!page.includes(t)))];
  ok(!notPage.length,`every file a page script imports statically is a page script (${Object.values(imports).flat().length} imports read)${notPage.length?'; not: '+notPage.join(', '):''}`);
  // rule 1: an import reaches the file's own layer or a lower one, or a file whose tag comes earlier, or (a cycle's way back) a file that
  // runs later, which rule 2 checks is read only inside functions
  const ord=runOrder(ROOT,page);
  const v=upward(C,page,imports,ord);
  ok(!v.length,`rule 1: each page file imports only its own layer or a lower one (${C.layers.map(l=>l.layer).join(' < ')}), or a file whose tag comes earlier, or a cycle's way back (${ord.back.length})${v.length?': '+v.join('; '):''}`);
  {const plant={...imports,'core.js':[...imports['core.js'],'about.js'],'history.js':[...imports['history.js'],'start.js'],'theme.js':[...imports['theme.js'],'today.js']};
    const pv=upward(C,page,plant,ord);
    ok(pv.length===2&&/^core\.js \(data\) imports about\.js \(screens\)/.test(pv[0])&&/^history\.js \(screens\) imports start\.js \(start\)/.test(pv[1]),
      `planted: core.js → about.js (data → screens, a later tag) and history.js → start.js (screens → start) are caught; theme.js → today.js (ui → screens, an earlier tag) passes (${pv.join('; ')||'nothing caught'})`)}
  // rule 2: no import cycle runs code at load: an import of a file that runs later (a cycle's way back) is used only inside functions
  const used=ord.back.filter(b=>b.used.length);
  ok(ord.back.length>0&&!used.length,`rule 2: no import cycle runs code at load: the ${ord.back.length} imports of a file that runs later (${ord.back.map(b=>b.from+' → '+b.to).join(', ')}) read none of their names at load${used.length?'; read at load: '+used.map(b=>b.from+' '+b.used.join(' ')).join('; '):''}`);
  {// the check itself: a name of a later file read at load is caught (colpick.js reading look.js's lookUsePick as it runs)
    const PN=['look','Use','Pick'].join('');   // (spelled in parts: tests/bridge.test.js would read a whole name in a string as a test's read of it)
    const pl=runOrder(ROOT,page,{'colpick.js':s=>s+`\nconst __plant=${PN};\n`}).back.filter(b=>b.used.length);
    ok(pl.length===1&&pl[0].from==='colpick.js'&&pl[0].used.join()===PN,`planted: a later file's name read at load is caught (${pl.map(b=>b.from+' '+b.used.join(' ')).join('; ')||'nothing caught'})`)}
  // rule 3: the workers' limits: a module worker's closure (its imports, theirs, and so on) is its listed files and `also`, nothing else
  {const bad=workerBad(C,ROOT,imports);
    ok(Object.keys(C.workers).length>0&&!bad.length,`rule 3: ${Object.entries(C.workers).map(([w,e])=>`${w} runs only its ${e.files.length} files, ${e.also.join(' and ')}`).join('; ')}${bad.length?': '+bad.join('; '):''}`);
    const pb=workerBad(C,ROOT,{...imports,'asm-color.js':[...imports['asm-color.js'],'core.js']});
    ok(pb.length===1&&/asm-worker\.js .*core\.js/.test(pb[0]),`planted: asm-color.js importing core.js is caught (${pb.join('; ')||'nothing caught'})`)}
  // the sockets optional by design: served by the file named, asked (never needed) by the askers, which don't import the server, and the
  // server is not in a worker the asker runs in
  {const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),bad=[];
    for(const [s,e] of Object.entries(C.optional)){if(!new RegExp(`\\bserve\\('${s}'`).test(src(e.serve)))bad.push(`${e.serve} does not serve ${s}`);
      for(const a of e.ask){if(!new RegExp(`\\b(?:ask|served)\\('${s}'`).test(src(a)))bad.push(`${a} does not ask ${s}`);if(new RegExp(`\\b(?:need|needFn)\\('${s}'`).test(src(a)))bad.push(`${a} needs ${s}`);
        if(closure(imports,a).has(e.serve))bad.push(`${a} imports ${e.serve} (then ${s} need not be a socket)`)}}
    const aw=closure({...imports,...workerImports(ROOT,'analysis-worker.js')},'analysis-worker.js');
    if(!aw.has('core.js')||aw.has('look-base.js'))bad.push(`analysis-worker.js ${aw.has('core.js')?'':'no longer runs core.js'}${aw.has('look-base.js')?'runs look-base.js':''}`);
    ok(Object.keys(C.optional).length>0&&!bad.length,`the sockets optional by design (${Object.entries(C.optional).map(([s,e])=>`${s}: ${e.ask.join(', ')} → ${e.serve}`).join('; ')}) are asked, not needed or imported; analysis-worker.js runs core.js without look-base.js${bad.length?': '+bad.join('; '):''}`)}

  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await ranInOrder(eng,browser,{ok,url,page,ord});await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
// the planner and the painter run as on a phone
module.exports.realPlanner=true;
module.exports.assembled=true;

const contract=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'tests','load-contract.json'),'utf8'));
const layerOf=(C,f)=>{const l=C.layers.find(x=>Array.isArray(x.files)&&x.files.includes(f));return l?l.layer:'screens'};
// rule 1's breaks: file → the page files it imports
function upward(C,page,imports,ord){const rank=f=>C.layers.findIndex(l=>l.layer===layerOf(C,f)),back=new Set(ord.back.map(b=>b.from+' '+b.to)),out=[];
  for(const f of page)for(const t of imports[f]||[]){if(!page.includes(t))continue;
    if(rank(t)<=rank(f)||page.indexOf(t)<page.indexOf(f)||back.has(f+' '+t))continue;
    out.push(`${f} (${layerOf(C,f)}) imports ${t} (${layerOf(C,t)}), a later tag`)}
  return out}
// the files f runs (f, its imports, theirs …)
const closure=(imports,f)=>{const seen=new Set([f]);const go=g=>{for(const t of imports[g]||[])if(!seen.has(t)){seen.add(t);go(t)}};go(f);return seen};
const workerImports=(root,w)=>importsOf(root,[w]);
function workerBad(C,root,imports){const out=[];
  for(const [w,e] of Object.entries(C.workers)){const all=closure({...imports,...workerImports(root,w)},w);all.delete(w);
    const may=new Set([...e.files,...e.also]),extra=[...all].filter(f=>!may.has(f)),stale=e.files.filter(f=>!all.has(f));
    if(extra.length)out.push(`${w} also runs ${extra.join(', ')}`);if(stale.length)out.push(`${w} no longer runs ${stale.join(', ')} (listed)`)}
  return out}
// file -> the files it imports, as paths from the root: static (import … from, export … from) or, with lazy, import('…') with a plain string
function importsOf(root,list,lazy){const acorn=require('acorn'),out={};
  for(const f of list){const src=fs.readFileSync(path.join(root,f),'utf8'),dir=path.posix.dirname(f);let ast;
    try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'})}catch(e){try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'})}catch(e2){out[f]=['(does not parse)'];continue}}
    const got=[];const walk=n=>{if(!n||typeof n.type!=='string')return;
      const hit=lazy?n.type==='ImportExpression':/^(ImportDeclaration|ExportAllDeclaration|ExportNamedDeclaration)$/.test(n.type);
      if(hit&&n.source&&n.source.type==='Literal'&&typeof n.source.value==='string')got.push(path.posix.normalize(path.posix.join(dir,n.source.value)));
      for(const k in n){const x=n[k];if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x.type==='string')walk(x)}};
    walk(ast);out[f]=[...new Set(got)]}
  return out}
// the order the page runs its modules in, as a browser does: each tag's graph depth first, a file's static imports (import … from,
// export … from) in their order, a file still running passed over (a cycle). → {order, back: [{from, to, used: [names read at load]}]}
// (back: the imports of a file that runs later, a cycle's way back). plant: {file: src => src} for the check itself
function runOrder(root,page,plant={}){const acorn=require('acorn'),imp={},ast={},src={};
  for(const f of page){src[f]=fs.readFileSync(path.join(root,f),'utf8');if(plant[f])src[f]=plant[f](src[f]);
    try{ast[f]=acorn.parse(src[f],{ecmaVersion:'latest',sourceType:'module'})}catch(e){ast[f]=acorn.parse(src[f],{ecmaVersion:'latest',sourceType:'script'})}
    imp[f]=ast[f].body.filter(n=>(n.type==='ImportDeclaration'||n.type==='ExportAllDeclaration'||n.type==='ExportNamedDeclaration')&&n.source)
      .map(n=>({to:path.posix.normalize(path.posix.join(path.posix.dirname(f),n.source.value)),names:(n.specifiers||[]).map(s=>s.local.name)}))}
  const state={},order=[];const visit=f=>{if(state[f]||!imp[f])return;state[f]=1;for(const i of imp[f])visit(i.to);order.push(f)};
  page.forEach(visit);const at=Object.fromEntries(order.map((f,i)=>[f,i])),back=[];
  for(const f of page){const later=imp[f].filter(i=>at[i.to]>at[f]);if(!later.length)continue;
    const names=new Set(later.flatMap(i=>i.names)),used=new Set();
    // code that runs at load: outside every function body (an immediately called function's body runs then too)
    const walk=n=>{if(!n||typeof n.type!=='string'||n.type==='ImportDeclaration')return;
      if(n.type==='CallExpression'&&/^(Arrow)?FunctionExpression$/.test(n.callee.type)){walk(n.callee.body);n.arguments.forEach(walk);return}
      if(/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type))return;
      if(n.type==='Identifier'&&names.has(n.name))used.add(n.name);
      for(const k in n){if((k==='key'&&n.type==='Property'||k==='property'&&n.type==='MemberExpression')&&!n.computed)continue;const x=n[k];if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x.type==='string')walk(x)}};
    ast[f].body.forEach(walk);
    for(const i of later)back.push({from:f,to:i.to,used:i.names.filter(x=>used.has(x))})}
  return {order,back}}

/* ---- with every file there: each page script runs to its end (`__ran`, its last line, added as it is served), in the order worked
   out, and start-up doesn't fail (start.js startFailed's toast) ---- */
async function ranInOrder(eng,browser,{ok,url,page,ord}){
  const T=eng+': ',origin=new URL(url).origin,wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ctx=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'});
  try{await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.route(u=>u.href.startsWith(origin)&&page.includes(u.pathname.slice(1)),async route=>{const f=new URL(route.request().url()).pathname.slice(1);
      const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+`\n;(globalThis.__ran||(globalThis.__ran=[])).push(${JSON.stringify(f)});\n`})});
    await ctx.addInitScript(()=>{try{localStorage.setItem('tour_seen','1')}catch(e){}});
    const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady,null,{timeout:60000});await wait(500);
    const r=await p.evaluate(()=>({ran:(globalThis.__ran||[]).slice(),entry:!!window.dwEntry,card:!!document.querySelector('#start-fail'),today:document.querySelector('#today').children.length,
      failed:/went wrong while the app was starting/.test((document.querySelector('#toast')||{}).textContent||'')}));
    const miss=page.filter(f=>!r.ran.includes(f)),ran=r.ran.filter(f=>page.includes(f));
    ok(!miss.length&&r.entry&&!r.card&&r.today>0&&!r.failed,T+`with every file there, every page script runs to its end (${r.ran.length} of ${page.length}${miss.length?'; not: '+miss.join(', '):''}), the entry runs and start-up doesn't fail (Today drawn: ${r.today>0})`);
    ok(ran.join()===ord.order.join(),T+`the page's scripts run in the order worked out from the tags and the imports (itemsheet.js after ${ord.order[ord.order.indexOf('itemsheet.js')-1]})${ran.join()===ord.order.join()?'':': ran '+ran.join(' ')}`)}
  finally{await ctx.close().catch(()=>{})}}

/* ---- the load model: the page is drawn, and takes taps, before its scripts have run ---- */
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',origin=new URL(url).origin,wait=ms=>new Promise(r=>setTimeout(r,ms));
  // service workers blocked: once sw.js controls the page it answers every script from its cache, and the routes below that hold or
  // refuse one never see it (on Linux from the second load on; on Windows the test server's 404 for `./` failed sw.js's install)
  const open=async(opt={},init)=>{const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:eng==='Chromium',serviceWorkers:'block',...opt});
    await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.addInitScript(()=>{window.DW_RETRY_NOW=true;try{localStorage.setItem('tour_seen','1')}catch(e){}});if(init)await ctx.addInitScript(init);   // (DW_RETRY_NOW: the start-up catcher's one reload comes at once)
    const c={ctx,held:'',hold:null,let:()=>{},refuse:null,errs:[]};
    // one script waits for the test (held), or is answered with something else (refuse: {name: {status, body}})
    await ctx.route(u=>u.href.startsWith(origin)&&/\.js$/.test(u.pathname),async route=>{const name=new URL(route.request().url()).pathname.slice(1);
      if(c.refuse&&c.refuse[name])return route.fulfill({status:c.refuse[name].status||200,contentType:'text/javascript',body:c.refuse[name].body||''});
      if(c.hold&&name===c.held)await c.hold;await route.continue().catch(()=>{})});
    c.p=await ctx.newPage();c.p.on('pageerror',e=>c.errs.push(e.message));
    await c.p.goto(url);await c.p.waitForFunction(()=>window.appReady);
    await c.p.evaluate(async()=>{if(document.querySelector('#setup.on'))HOOK.setupClose();HOOK.settings.setupDone=1;HOOK.settings.laundryDays=3;await HOOK.saveUserSettings();
      await HOOK.put({id:'ml-shirt',type:'shirt',primaryColor:'white',pattern:'solid',added:1});await HOOK.put({id:'ml-tie',type:'tie',primaryColor:'navy',pattern:'solid',added:2});await HOOK.put({id:'ml-suit',type:'suit',primaryColor:'navy',pattern:'solid',added:3})});
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
  const c=await open({bypassCSP:true});   // (the module this page is handed below is inline: index.html's security policy refuses it, tests/csp.test.js)
  const sw=await c.p.evaluate(async()=>({root:(await fetch('./',{cache:'no-store'})).status,ctl:!!(navigator.serviceWorker&&navigator.serviceWorker.controller),reg:!!(navigator.serviceWorker&&await navigator.serviceWorker.getRegistration())}));
  ok(sw.root===200&&!sw.ctl&&!sw.reg,T+`the test server serves the folder's address (./, ${sw.root}) as on every system, and no service worker is in the way of the routes (controlled ${sw.ctl}, registered ${sw.reg})`);
  // the script right after act.js (add.js until the restructure S3a moved the ui kit and logic there), and the one after start.js
  const order=[...fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
  const afterAct=order[order.indexOf('act.js')+1],afterStart=order[order.indexOf('start.js')+1];
  await held(c,afterAct,()=>'ACTS' in HOOK&&typeof HOOK.ACTS==='object');
  const st0=await c.p.evaluate(()=>({n:Object.keys(HOOK.ACTS).length,rs:document.readyState,nav:!!document.querySelector('#n-stats'),late:!('show' in HOOK)&&!('startUp' in HOOK)}));
  ok(st0.n===0&&st0.late&&st0.nav,T+`with ${afterAct}, the script after act.js, held the page is drawn and act.js listens, but no script has registered a handler yet (${JSON.stringify(st0)})`);
  ok(st0.rs==='interactive',T+`document.readyState is already "interactive" while the deferred scripts run (${st0.rs}): afterDom can't go by it`);
  const early=await c.p.evaluate(()=>{window.__ad=0;HOOK.afterDom(()=>{window.__ad++});return window.__ad});
  for(const sel of Object.values(CTRL))await tap(c,sel);
  ok(c.errs.length===0,T+`each tab, the gear and the theme button tapped before any handler is registered: no page error (${c.errs.join(' | ')||'none'})`);
  await go(c);
  ok(early===0&&await c.p.evaluate(()=>window.__ad)===1,T+'afterDom waits for the last script: its function didn\'t run while they were loading, and ran once after');
  ok(await c.p.evaluate(()=>{let r=0;HOOK.afterDom(()=>{r++});return r})===1,T+'after that afterDom runs its function at once');
  ok(await shown(c)==='today'&&c.errs.length===0&&await c.p.evaluate(()=>HOOK.items.length===3&&!HOOK.settingsOpen()),T+`those taps are dropped: the app starts on Today with its wardrobe, no page error (${c.errs.join(' | ')||'none'})`);
  await held(c,'start.js',()=>'todayTabTap' in HOOK&&typeof HOOK.todayTabTap==='function'&&'setOpenTap' in HOOK&&typeof HOOK.setOpenTap==='function'&&'themeTap' in HOOK&&typeof HOOK.themeTap==='function');
  await tap(c,CTRL.Today);await tap(c,CTRL.Wardrobe);await tap(c,CTRL.Insights);
  ok(c.errs.length===0,T+`the tabs tapped with today.js in and start.js not: no page error (${c.errs.join(' | ')||'none'})`);
  await go(c);ok(await shown(c)==='today'&&c.errs.length===0,T+'and the app starts on Today');
  await held(c,afterStart,()=>'tabTap' in HOOK&&typeof HOOK.tabTap==='function');
  await tap(c,CTRL['the gear']);const setEarly=await c.p.evaluate(()=>HOOK.settingsOpen());await tap(c,CTRL['the theme button']);
  const themed=await c.p.evaluate(()=>document.documentElement.dataset.theme||'');
  ok(c.errs.length===0,T+`the gear and the theme button tapped with their scripts in and the later ones not: no page error (${c.errs.join(' | ')||'none'}; theme "${themed}")`);
  // Settings opened before the stored settings were read showed the defaults, and a change there was saved over the stored copy
  ok(!setEarly&&await c.p.evaluate(()=>HOOK.settings.laundryDays!==3),T+'the gear doesn\'t open Settings before the stored settings are read (the page still holds the defaults)');
  await c.p.evaluate(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new PopStateEvent('popstate',{state:null}));
    const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([137,80,78,71])],'p.png',{type:'image/png'}));document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
  await wait(150);ok(c.errs.length===0&&await c.p.evaluate(()=>HOOK.queue.length===0),T+`Escape, Back and a pasted photo during loading: no page error, no card started (${c.errs.join(' | ')||'none'})`);
  await tap(c,CTRL.Insights);await go(c);
  const aft=await c.p.evaluate(async()=>{const st=await HOOK.metaGet('settings');return {set:HOOK.settingsOpen(),n:HOOK.items.length,mem:HOOK.settings.laundryDays+'/'+HOOK.settings.setupDone,st:st.laundryDays+'/'+st.setupDone}});
  ok(await shown(c)==='stats'&&c.errs.length===0&&aft.n===3,T+`after start-up the app is on Insights, the tab tapped last, with its wardrobe (${await shown(c)}; ${c.errs.join(' | ')||'no page error'})`);
  ok(aft.set&&aft.mem==='3/1'&&aft.st==='3/1',T+`and Settings, asked for during loading, opens now, over the stored settings (laundry days/setup ${aft.mem} in memory, ${aft.st} stored)`);
  await c.p.evaluate(()=>{HOOK.closeSettings();try{localStorage.removeItem('theme')}catch(e){}});

  /* ---- a page script that is an ES module (back.js: every page and sheet registers its Back there while loading) ---- */
  c.refuse=null;c.errs.length=0;await c.p.goto('about:blank');await c.p.goto(url);await c.p.waitForFunction(()=>window.appReady);await settle(c.p,300);
  // (the three Back flags are the tests' alone, so back.js hands them over on HOOK, not the bridge: T2 phase 3; d finds a name's
  // accessor in HOOK's chain, which ends in the runner's root before any module's object: it is never reached for these)
  const md=await c.p.evaluate(()=>{const d=n=>{for(let o=HOOK;o;o=Object.getPrototypeOf(o)){const x=n in o&&Object.getOwnPropertyDescriptor(o,n);if(x)return x}return {}},has=(f,n)=>{try{return f[n]===null}catch(e){return 'throws'}};
    return {fns:['backKind','backOn','backOver','backLand','backPush','backDrop','backBorrow','backReturn','backHold','backSettled','backWanted','histPush','histDrop'].every(n=>typeof globalThis[n]==='undefined'),
      loc:HOOK.APP_LOC,get:['appHist','appKind','itemHist'].map(n=>typeof d(n).get+'/'+typeof d(n).set).join(),strict:has(HOOK.backPush,'caller')+'/'+has(mergeItem,'caller'),patched:!!Date.prototype._dwLoc}});
  md.own=await c.p.evaluate('[typeof BACK,typeof backPop,typeof appLocale].join()');   // (as text: these are not the page's names, and the checkers would take a function's use of them for one)
  ok(md.own==='undefined,undefined,undefined'&&md.fns&&md.loc==='en-US'&&md.patched,T+`back.js and locale.js run as modules: their own names (BACK, backPop, appLocale) are not the page's, nor (since the bridge came down, the restructure S6f) the functions other files import, APP_LOC is locale.js's (HOOK), and the Date patch is in (${JSON.stringify(md)})`);
  ok(md.get==='function/undefined,function/undefined,function/undefined'&&md.strict==='throws/true',T+'the three Back flags are getters with no setter, and back.js\'s functions are strict (reading a function\'s caller throws) where a classic script\'s are not');
  const flags=()=>c.p.evaluate(()=>HOOK.appHist+'/'+HOOK.appKind+'/'+HOOK.itemHist+'/'+HOOK.backKind());
  const live=[await flags()];
  await c.p.evaluate(()=>HOOK.openSettings());await settle(c.p,300);live.push(await flags());
  const kept=await c.p.evaluate(()=>Reflect.set(HOOK,'appKind','zz')+'/'+HOOK.appKind);
  await c.p.evaluate(()=>HOOK.closeSettings());await settle(c.p,500);live.push(await flags());
  ok(live.join(' ')==='false//false/ true/set/false/set false//false/'&&kept==='false/set'&&c.errs.length===0,T+`a getter gives the module's value of the moment: no entry, Settings' entry, none again (${live.join(' ')}); a write from outside is refused and changes nothing (${kept})`);
  // the pattern for a `let` the tests assign: a getter and a setter, so a bare assignment in the page reaches the module's own variable
  await c.p.addScriptTag({type:'module',content:'let mlState=1;globalThis.mlRead=()=>mlState;Object.defineProperties(globalThis,{mlState:{get:()=>mlState,set:v=>{mlState=v}}});export {};'});
  await c.p.waitForFunction(()=>typeof globalThis.mlRead==='function');   // (a function: WebKit's bypassCSP doesn't let a string predicate be compiled)
  const sett=await c.p.evaluate('(()=>{const a=mlState+"/"+mlRead();mlState=5;const b=mlState+"/"+mlRead();mlState++;return a+" "+b+" "+mlRead()})()');
  ok(sett==='1/1 5/5 6',T+`a module's \`let\` bridged with a getter and a setter: \`name=5\` and \`name++\` in the page change the module's own variable (${sett})`);

  /* ---- the card never comes on a start that is only slow ---- */
  // an error nobody catches during loading (the catcher hears it), then the stored wardrobe 6 s late: start-up is under way, so it waits
  const src=fs.readFileSync(path.join(ROOT,'start.js'),'utf8'),slow=src.replace("need('conn-restored').then(()=>","need('conn-restored').then(()=>new Promise(r=>setTimeout(r,6000))).then(()=>");   // (app.js's connRestored, through bus.js since the restructure S6b)
  ok(slow!==src,T+'(start.js\'s stored read can be slowed for the test)');
  await c.ctx.addInitScript(()=>{window.__card=0;new MutationObserver(()=>{if(document.getElementById('start-fail'))window.__card++}).observe(document,{childList:true,subtree:true});
    try{if(localStorage.getItem('ml_stray'))setTimeout(()=>{throw new Error('modload test: a stray error during loading')},20)}catch(e){}});
  const notedBefore=await c.p.evaluate(()=>{localStorage.setItem('ml_stray','1');return JSON.parse(localStorage.getItem('err_log')||'[]').filter(x=>/didn’t start/.test(x.m)).length});
  c.errs.length=0;c.refuse={'start.js':{body:slow}};c.hold=null;await c.p.goto('about:blank');await c.p.goto(url,{waitUntil:'load'});await wait(5000);
  const midway=await c.p.evaluate(()=>({card:window.__card,today:document.querySelector('#today').children.length,ready:!!window.appReady,busy:window.startBusy}));
  ok(c.errs.length===1&&midway.today===0&&!midway.ready&&midway.card===0,T+`an uncaught error during loading and the stored wardrobe 6 s late: 5 s after the page loaded Today is still empty and no card has come (${JSON.stringify(midway)})`);
  await c.p.waitForFunction(()=>window.appReady,null,{timeout:20000});await settle(c.p,300);
  ok(await c.p.evaluate(n=>window.__card===0&&HOOK.items.length===3&&document.querySelector('#today').children.length>0&&JSON.parse(localStorage.getItem('err_log')||'[]').filter(x=>/didn’t start/.test(x.m)).length===n,notedBefore),T+'then the app starts as usual: the card never came and nothing was noted as a failed start');
  c.refuse=null;await c.ctx.close();
  // a first run, signed out, with such an error: Today's first page and the setup, never the card
  {const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:eng==='Chromium',serviceWorkers:'block'});
    await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.addInitScript(()=>{window.__card=0;new MutationObserver(()=>{if(document.getElementById('start-fail'))window.__card++}).observe(document,{childList:true,subtree:true});setTimeout(()=>{throw new Error('modload test: a stray error during loading')},20)});
    const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);await wait(5000);
    const f=await p.evaluate(()=>({card:window.__card,today:document.querySelector('#today').children.length,n:HOOK.items.length,setup:!!document.querySelector('#setup.on,#tour.on,.tour.on')}));
    ok(f.card===0&&f.today>0&&f.n===0,T+`a first run, signed out, with an uncaught error during loading: Today's first page is drawn and the card never comes (${JSON.stringify(f)})`);
    await ctx.close()}

  /* ---- an Arabic-language phone: dates are drawn after locale.js's patch ---- */
  const a=await open({locale:'ar-KW',timezoneId:'Asia/Kuwait'});
  ok(await a.p.evaluate(()=>/^ar/.test(navigator.language)),T+'the phone\'s language is Arabic');
  await held(a,'locale.js',()=>'todayTabTap' in HOOK&&typeof HOOK.todayTabTap==='function');
  const raw=await a.p.evaluate(()=>({patched:!!Date.prototype._dwLoc,sample:new Date(2026,10,15).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}),drawn:document.querySelector('#today').textContent.length}));
  ok(!raw.patched&&/[؀-ۿ]/.test(raw.sample)&&raw.drawn===0,T+`with locale.js held the patch is not in (a date would read "${raw.sample}") and nothing is drawn yet`);
  await tap(a,CTRL.Today);await tap(a,CTRL.Wardrobe);
  const mid=await a.p.evaluate(()=>document.body.innerText);
  ok(!/[؀-ۿ٠-٩]/.test(mid)&&a.errs.length===0,T+'taps before the patch draw no date: no Arabic letter or digit on the page, no page error');
  await go(a);await a.p.evaluate(()=>HOOK.show('today'));await settle(a.p,300);
  const txt=await a.p.evaluate(()=>({all:document.querySelector('#today').innerText,head:(document.querySelector('#today .dlong')||document.querySelector('#today')).textContent.slice(0,60),sample:new Date(2026,10,15).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}));
  ok(!/[؀-ۿ]/.test(txt.all)&&/(January|February|March|April|May|June|July|August|September|October|November|December)/.test(txt.all)&&txt.sample==='Sunday, November 15',
    T+`after start-up Today's dates are in English with Latin digits ("${txt.head.replace(/\s+/g,' ').trim()}"; a date reads "${txt.sample}")`);
  await held(a,afterStart,()=>'tabTap' in HOOK&&typeof HOOK.tabTap==='function');await tap(a,CTRL.Insights);await go(a);
  ok(!/[؀-ۿ]/.test(await a.p.evaluate(()=>document.body.innerText))&&await shown(a)==='stats'&&a.errs.length===0,T+'a tab tapped during loading, then Insights after start-up: no Arabic date anywhere, no page error');
  await a.ctx.close();

  /* ---- the saved theme is on the page before any deferred script has run ---- */
  for(const [saved,scheme] of [['dark','light'],['light','dark']]){
    const t=await open({colorScheme:scheme},`try{localStorage.setItem('theme','${saved}')}catch(e){}`);
    await held(t,'merge.js',()=>!!document.querySelector('body>nav'));
    const v=await t.p.evaluate(()=>({theme:document.documentElement.dataset.theme||'',bg:getComputedStyle(document.body).backgroundColor,core:'TYPES' in HOOK?typeof HOOK.TYPES:'undefined',want:null}));
    const want=await t.p.evaluate(s=>{const d=document.createElement('div');d.style.cssText='position:absolute;visibility:hidden';d.setAttribute('data-x','');document.documentElement.appendChild(d);
      const old=document.documentElement.dataset.theme;document.documentElement.dataset.theme=s==='dark'?'light':'dark';const other=getComputedStyle(document.body).backgroundColor;document.documentElement.dataset.theme=old;d.remove();return other},saved);
    ok(v.core==='undefined'&&v.theme===saved&&v.bg!==want,T+`a saved ${saved} theme on a ${scheme} phone: set before the first script (merge.js held, none has run), the page already in its colors (${v.bg}, the other theme's is ${want})`);
    await go(t);ok(await t.p.evaluate(s=>document.documentElement.dataset.theme===s,saved)&&t.errs.length===0,T+`and it is still ${saved} after start-up, no page error`);
    await t.ctx.close()}
}
