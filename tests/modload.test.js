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
  const isMod=t=>/\btype="module"/.test(t),srcOf=t=>(/\bsrc="([^"]+)"/.exec(t)||[])[1],modTags=withSrc.filter(isMod);
  ok(withSrc.length>80&&withSrc.every(t=>!/\basync\b/.test(t)&&(isMod(t)?!/\bdefer\b/.test(t):/\bdefer\b/.test(t)&&!/type=/.test(t))),`every page script is deferred: a classic one by \`defer\`, a module by being one (${withSrc.length-modTags.length} and ${modTags.length} of ${withSrc.length}); none is async`);
  const order=withSrc.map(srcOf);
  ok(order.indexOf('back.js')===order.indexOf('app.js')+1&&order.indexOf('act.js')===order.indexOf('back.js')+1&&order.indexOf('locale.js')>order.indexOf('act.js')&&order.indexOf('locale.js')<order.indexOf('settings.js')&&isMod(withSrc[order.indexOf('back.js')])&&isMod(withSrc[order.indexOf('locale.js')])&&!modTags.some(t=>/^merge\.js$/.test(srcOf(t)))&&modTags.some(t=>/^srgb\.js$/.test(srcOf(t))),
    'back.js and locale.js are modules with a tag each, where they always were in the list (back.js between app.js and act.js, locale.js before settings.js); merge.js, which the server imports, is not a module (srgb.js is one since C3, with asm-worker.js a module worker)');
  ok(/<script type="module">startUp\(\)<\/script>\s*<\/body>/.test(html)&&inline.filter(t=>/module/.test(t)).length===1,'startUp() is the page\'s last script, an inline module: it runs after every deferred script');
  const headTags=[...head.matchAll(/<script\b([^>]*)>/g)].map(m=>m[1]);
  ok(headTags.length===3&&headTags.every(t=>t.trim()==='')&&/localStorage\.getItem\("theme"\)/.test(head)&&/--tscale/.test(head)&&/start-fail/.test(head),
    'the head\'s three scripts (the saved theme, the text size, the start-up catcher) are plain inline scripts: they run before the first paint');
  ok(head.indexOf('getItem("theme")')<head.indexOf('rel="stylesheet"')&&/<link rel="stylesheet" href="styles\.css">/.test(head),'the theme is set before the stylesheet, which still blocks the first paint');
  ok(/let domDone=false;addEventListener\('DOMContentLoaded'/.test(fs.readFileSync(path.join(ROOT,'app.js'),'utf8'))&&!/const afterDom=.*readyState/.test(fs.readFileSync(path.join(ROOT,'app.js'),'utf8')),'afterDom has its own DOMContentLoaded flag and doesn\'t read document.readyState');
  /* ---- the load-failure contract (tests/load-contract.json; the restructure, step 2): the imports, read from the files ---- */
  const C=contract(),page=order;
  const listed=Object.keys(C.files),miss=page.filter(f=>!C.files[f]),extra=listed.filter(f=>!page.includes(f));
  ok(!miss.length&&!extra.length,`the contract lists every page script and nothing else (${listed.length} of ${page.length}${miss.length?'; not listed: '+miss.join(', '):''}${extra.length?'; not a page script: '+extra.join(', '):''})`);
  const counts={};for(const e of Object.values(C.files))counts[e.class]=(counts[e.class]||0)+1;
  const badEntry=Object.entries({...C.files,...C.lazy}).filter(([f,e])=>!C.classes[e.class]||!e.group||(e.class!=='required'&&['chromium','webkit'].some(k=>expected(C,f,k)==='card'))).map(([f])=>f);
  ok(!badEntry.length,`each entry has a known class and a group, and only a required file's 404 may show the start-up card (${Object.entries(counts).map(([k,n])=>k+' '+n).join(', ')}${badEntry.length?'; wrong: '+badEntry.join(', '):''})`);
  const imports=importsOf(ROOT,page);
  const lazyMiss=Object.values(imports).flat().filter(t=>!C.files[t]&&!C.lazy[t]);
  ok(!lazyMiss.length,`every file a page script imports is in the contract (${Object.keys(C.lazy).join(', ')} as a file read later)${lazyMiss.length?'; not listed: '+[...new Set(lazyMiss)].join(', '):''}`);
  const v=violations(C,imports);
  ok(!v.length,`a required file imports only required files, a today-no-picture file never an optional one, an optional file nothing optional outside its group (${Object.values(imports).flat().length} imports read)${v.length?': '+v.join('; '):''}`);
  // the check itself: each rule catches its case
  const plant={'core.js':['about.js'],'app.js':['colpick.js'],'about.js':['colpick.js'],'add.js':['colpick.js','core.js','app.js'],'start.js':['toast.js']};
  const pv=violations(C,plant);
  ok(pv.length===3&&/^core\.js .*about\.js/.test(pv[0])&&/^app\.js .*colpick\.js/.test(pv[1])&&/^about\.js .*colpick\.js/.test(pv[2]),
    `planted imports are caught: required core.js → optional about.js, today-no-picture app.js → colpick.js, about.js → colpick.js of another group; add.js → its own group, core.js and app.js, and start.js → toast.js pass (${pv.join('; ')})`);
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle});await survey(eng,browser,{ok,url,C,page})}finally{await browser.close()}}
};
// the planner and the painter run as on a phone: the contract's 404 outcomes were measured with them (every other part of this file
// is the same with them on)
module.exports.realPlanner=true;
module.exports.assembled=true;
const contract=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'tests','load-contract.json'),'utf8'));
// what a file's 404 should show on an engine ('chromium' / 'webkit'): its own on404, else its class's
function expected(C,f,eng){const e=C.files[f]||C.lazy[f];if(!e)return null;const o=e.on404;
  return o==null?C.classes[e.class]&&C.classes[e.class].on404:typeof o==='string'?o:o[eng]||C.classes[e.class].on404}
// file -> the page files it imports (import … from, export … from, import('…') with a plain string), as paths from the root
function importsOf(root,page){const acorn=require('acorn'),out={};
  for(const f of page){const src=fs.readFileSync(path.join(root,f),'utf8'),dir=path.posix.dirname(f);let ast;
    try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'})}catch(e){try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'})}catch(e2){out[f]=['(does not parse)'];continue}}
    const got=[];const walk=n=>{if(!n||typeof n.type!=='string')return;
      if((n.type==='ImportDeclaration'||n.type==='ExportAllDeclaration'||n.type==='ExportNamedDeclaration'||n.type==='ImportExpression')&&n.source&&n.source.type==='Literal'&&typeof n.source.value==='string')
        got.push(path.posix.normalize(path.posix.join(dir,n.source.value)));
      for(const k in n){const x=n[k];if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x.type==='string')walk(x)}};
    walk(ast);out[f]=[...new Set(got)]}
  return out}
// the import rules of the contract's classes → one line per import that breaks them
function violations(C,imports){const out=[],at=f=>C.files[f]||C.lazy[f];
  for(const [f,list] of Object.entries(imports)){const a=at(f);if(!a)continue;
    for(const t of list){const b=at(t);if(!b)continue;
      const fine=a.class==='required'?b.class==='required':a.class==='today-no-picture'?b.class!=='optional':b.class!=='optional'||b.group===a.group;
      if(!fine)out.push(`${f} (${a.class}, ${a.group}) imports ${t} (${b.class}, ${b.group})`)}}
  return out}
/* ---- the survey: each page script that can't be loaded (404), with a seeded 50-piece wardrobe and a stand-in server holding the 512
   test masters, shows what the contract says: the start-up card, Today without its outfit picture, or Today with it (the mannequin or the
   painted picture). Measured on main with C:\code\r0-lab\failload.js (10 s per case); here a case ends as soon as the card or the
   figure is there, else 8 s after Today was drawn (20 s after the page has loaded at most). A few at a time. The day is held (a Monday, a workday): which mannequin pose
   Today needs is the day's outfit's, and on WebKit that pose's file missing leaves Today with no figure ---- */
const DAY=new Date(2026,10,16,12);
async function survey(eng,browser,{ok,url,C,page}){
  const E=eng.toLowerCase(),T=eng+': ',origin=new URL(url).origin,HOST='https://w.test/',wait=ms=>new Promise(r=>setTimeout(r,ms));
  const FIX=path.join(ROOT,'tests','fixtures','cm'),data=f=>`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(f).toString('base64');
  const recs={};for(const kind of ['suit','vest','suit-open','shirt-tie','shirt-open']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');recs[kind+'|'+n]=data(path.join(d,f))}}
  const served={};
  const ctxFor=async(state,fail)=>{const ctx=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block',...(state?{storageState:state}:{})});
    await ctx.route(u=>!u.href.startsWith(origin)&&!u.href.startsWith(HOST)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(x,st=200)=>route.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
      if(route.request().method()!=='GET')return j({ok:true,rev:1,saved:Date.now()});
      if(u.pathname==='/render'&&u.searchParams.get('list'))return j({keys:Object.keys(served)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    if(fail)await ctx.route(u=>u.href.startsWith(origin)&&u.pathname==='/'+fail,route=>route.fulfill({status:404,contentType:'text/plain',body:''}));
    await ctx.addInitScript(()=>{self.ASM_CM_SIZE=512});await ctx.clock.setFixedTime(DAY);return ctx};
  // the seeded wardrobe, the masters' keys and the server address, once: every case starts from this stored state
  const s=await ctxFor(null,null),sp=await s.newPage();await sp.goto(url);await sp.waitForFunction(()=>window.appReady,null,{timeout:90000});
  const n=await sp.evaluate(async()=>{const I=[];let k=0;const add=(type,cols,x={})=>{for(const c of cols)I.push({id:'lab-'+type+'-'+(k++),type,primaryColor:c,pattern:'solid',added:1700000000000+k,...x})};
    add('suit',['navy','charcoal','grey','brown','black']);add('blazer',['navy','tan','grey']);add('pants',['grey','charcoal','navy','tan','brown']);
    add('shirt',['white','lightblue','pink','white','lightblue','white','blue','lavender','cream','white','lightblue','pink']);
    add('tie',['navy','burgundy','green','brown','grey','red','purple','black','blue','gold','navy','burgundy']);
    add('shoes',['black','brown','oxblood'],{leather:'calf'});add('belt',['black','brown','oxblood'],{leather:'calf',metal:'silver'});
    add('socks',['navy','charcoal','black','brown']);add('watch',['silver'],{metal:'silver',band:'metal bracelet'});add('tieclip',['silver'],{metal:'silver'});add('pocketsquare',['white']);
    for(const i of I)await put(i);
    settings.setupDone=1;settings.workdays=[0,1,2,3,4];await saveUserSettings();try{localStorage.setItem('tour_seen','1')}catch(e){}
    return I.length});
  const kmap=await sp.evaluate(ks=>{const o={};for(const k of ks){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.keys(recs));
  const bg=await sp.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#e6e2dc';x.fillRect(0,0,512,512);return {k:asmCmBgKey(),img:c.toDataURL('image/png')}});
  for(const [k,img] of Object.entries(recs))served[kmap[k]]={sig:'asm/cm test',img,model:'colormaster',t:1000};served[bg.k]={sig:'asm/cm bg',img:bg.img,model:'colormaster',t:1000};
  await sp.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner')},HOST);
  // bus.js's sockets in the page: the module every file imports gives serve and ask
  const sock=await sp.evaluate(async()=>{const s=document.createElement('script');s.type='module';
    s.textContent="import {serve,ask} from './bus.js';const a=ask('ml-nobody',1);serve('ml-sum',(x,y)=>x+y);window.__sock=[a===undefined,ask('ml-sum',2,3)].join();";
    document.head.appendChild(s);for(let i=0;i<50&&!window.__sock;i++)await new Promise(r=>setTimeout(r,20));return window.__sock});
  ok(sock==='true,5',T+`bus.js's sockets in the page: ask for a name nobody serves gives undefined, a served one its answer (${sock})`);
  const state=await s.storageState({indexedDB:true});await s.close();
  const look=async p=>p.evaluate(()=>{const q=s=>document.querySelector(s),t=q('#today');return {card:!!q('#start-fail'),today:!!(t&&t.children.length),fig:!!q('#today .fig svg,#today .fig img'),ready:!!window.appReady}});
  const one=async f=>{const ctx=await ctxFor(state,f);try{const p=await ctx.newPage();await p.goto(url,{waitUntil:'load'});const t0=Date.now();let r;
      let drawn=0;for(;;){r=await look(p);if(r.today&&!drawn)drawn=Date.now();if(r.card||(r.today&&r.fig)||(drawn&&Date.now()-drawn>8000)||Date.now()-t0>20000)break;await wait(250)}
      return r.card?'card':!r.today?'no-today':r.fig?'picture':'no-picture'}
    catch(e){return 'error: '+e.message.split('\n')[0].slice(0,80)}finally{await ctx.close().catch(()=>{})}};
  const got={},ms={},queue=['(none)',...page];
  await Promise.all([0,1,2,3].map(async()=>{for(let f;(f=queue.shift())!==undefined;){const t=Date.now();got[f]=await one(f==='(none)'?null:f);ms[f]=Date.now()-t}}));
  ok(n===50&&got['(none)']==='picture',T+`with every file there, the seeded wardrobe (${n} pieces) shows Today with its picture (${got['(none)']})`);
  if(process.env.MODLOAD_OUT)fs.writeFileSync(process.env.MODLOAD_OUT+'-'+E+'.json',JSON.stringify({got,ms},null,1));   // (each file's outcome and how long it took, for a lab)
  // ("painted": the file's loss leaves Today only the painted picture, which comes when the painter has painted: late on a busy
  // runner, not on Windows' WebKit (no painted picture there in the lab survey), on Linux's WebKit and Chromium within seconds; so either, but never the card or no Today)
  const fits=(f,g)=>{const x=expected(C,f,E);return x==='painted'?g==='picture'||g==='no-picture':g===x};
  const off=page.filter(f=>!fits(f,got[f]));
  const tally={};for(const f of page)tally[got[f]]=(tally[got[f]]||0)+1;
  ok(!off.length,T+`each of the ${page.length} page scripts, when it can't be loaded (404), shows what the contract says (${Object.entries(tally).map(([k,v])=>k+' '+v).join(', ')}; painted only: ${page.filter(f=>expected(C,f,E)==='painted').map(f=>f+' '+got[f]).join(', ')})${off.length?': '+off.map(f=>`${f} shows ${got[f]}, the contract says ${expected(C,f,E)}`).join('; '):''}`);
}
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',origin=new URL(url).origin,wait=ms=>new Promise(r=>setTimeout(r,ms));
  // service workers blocked: once sw.js controls the page it answers every script from its cache, and the routes below that hold or
  // refuse one never see it (on Linux from the second load on; on Windows the test server's 404 for `./` failed sw.js's install)
  const open=async(opt={},init)=>{const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:eng==='Chromium',serviceWorkers:'block',...opt});
    await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.addInitScript(()=>{try{localStorage.setItem('tour_seen','1')}catch(e){}});if(init)await ctx.addInitScript(init);
    const c={ctx,held:'',hold:null,let:()=>{},refuse:null,errs:[]};
    // one script waits for the test (held), or is answered with something else (refuse: {name: {status, body}})
    await ctx.route(u=>u.href.startsWith(origin)&&/\.js$/.test(u.pathname),async route=>{const name=new URL(route.request().url()).pathname.slice(1);
      if(c.refuse&&c.refuse[name])return route.fulfill({status:c.refuse[name].status||200,contentType:'text/javascript',body:c.refuse[name].body||''});
      if(c.hold&&name===c.held)await c.hold;await route.continue().catch(()=>{})});
    c.p=await ctx.newPage();c.p.on('pageerror',e=>c.errs.push(e.message));
    await c.p.goto(url);await c.p.waitForFunction(()=>window.appReady);
    await c.p.evaluate(async()=>{if(document.querySelector('#setup.on'))HOOK.setupClose();settings.setupDone=1;settings.laundryDays=3;await saveUserSettings();
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
  const sw=await c.p.evaluate(async()=>({root:(await fetch('./',{cache:'no-store'})).status,ctl:!!(navigator.serviceWorker&&navigator.serviceWorker.controller),reg:!!(navigator.serviceWorker&&await navigator.serviceWorker.getRegistration())}));
  ok(sw.root===200&&!sw.ctl&&!sw.reg,T+`the test server serves the folder's address (./, ${sw.root}) as on every system, and no service worker is in the way of the routes (controlled ${sw.ctl}, registered ${sw.reg})`);
  // the script right after act.js (add.js until the restructure S3a moved the ui kit and logic there), and the one after start.js
  const order=[...fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
  const afterAct=order[order.indexOf('act.js')+1],afterStart=order[order.indexOf('start.js')+1];
  await held(c,afterAct,()=>typeof ACTS==='object');
  const st0=await c.p.evaluate(()=>({n:Object.keys(ACTS).length,rs:document.readyState,nav:!!document.querySelector('#n-stats'),late:typeof show==='undefined'&&typeof startUp==='undefined'}));
  ok(st0.n===0&&st0.late&&st0.nav,T+`with ${afterAct}, the script after act.js, held the page is drawn and act.js listens, but no script has registered a handler yet (${JSON.stringify(st0)})`);
  ok(st0.rs==='interactive',T+`document.readyState is already "interactive" while the deferred scripts run (${st0.rs}): afterDom can't go by it`);
  const early=await c.p.evaluate(()=>{window.__ad=0;afterDom(()=>{window.__ad++});return window.__ad});
  for(const sel of Object.values(CTRL))await tap(c,sel);
  ok(c.errs.length===0,T+`each tab, the gear and the theme button tapped before any handler is registered: no page error (${c.errs.join(' | ')||'none'})`);
  await go(c);
  ok(early===0&&await c.p.evaluate(()=>window.__ad)===1,T+'afterDom waits for the last script: its function didn\'t run while they were loading, and ran once after');
  ok(await c.p.evaluate(()=>{let r=0;afterDom(()=>{r++});return r})===1,T+'after that afterDom runs its function at once');
  ok(await shown(c)==='today'&&c.errs.length===0&&await c.p.evaluate(()=>items.length===3&&!settingsOpen()),T+`those taps are dropped: the app starts on Today with its wardrobe, no page error (${c.errs.join(' | ')||'none'})`);
  await held(c,'start.js',()=>'todayTabTap' in HOOK&&typeof HOOK.todayTabTap==='function'&&'setOpenTap' in HOOK&&typeof HOOK.setOpenTap==='function'&&'themeTap' in HOOK&&typeof HOOK.themeTap==='function');
  await tap(c,CTRL.Today);await tap(c,CTRL.Wardrobe);await tap(c,CTRL.Insights);
  ok(c.errs.length===0,T+`the tabs tapped with today.js in and start.js not: no page error (${c.errs.join(' | ')||'none'})`);
  await go(c);ok(await shown(c)==='today'&&c.errs.length===0,T+'and the app starts on Today');
  await held(c,afterStart,()=>'tabTap' in HOOK&&typeof HOOK.tabTap==='function');
  await tap(c,CTRL['the gear']);const setEarly=await c.p.evaluate(()=>settingsOpen());await tap(c,CTRL['the theme button']);
  const themed=await c.p.evaluate(()=>document.documentElement.dataset.theme||'');
  ok(c.errs.length===0,T+`the gear and the theme button tapped with their scripts in and the later ones not: no page error (${c.errs.join(' | ')||'none'}; theme "${themed}")`);
  // Settings opened before the stored settings were read showed the defaults, and a change there was saved over the stored copy
  ok(!setEarly&&await c.p.evaluate(()=>settings.laundryDays!==3),T+'the gear doesn\'t open Settings before the stored settings are read (the page still holds the defaults)');
  await c.p.evaluate(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new PopStateEvent('popstate',{state:null}));
    const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([137,80,78,71])],'p.png',{type:'image/png'}));document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
  await wait(150);ok(c.errs.length===0&&await c.p.evaluate(()=>queue.length===0),T+`Escape, Back and a pasted photo during loading: no page error, no card started (${c.errs.join(' | ')||'none'})`);
  await tap(c,CTRL.Insights);await go(c);
  const aft=await c.p.evaluate(async()=>{const st=await metaGet('settings');return {set:settingsOpen(),n:items.length,mem:settings.laundryDays+'/'+settings.setupDone,st:st.laundryDays+'/'+st.setupDone}});
  ok(await shown(c)==='stats'&&c.errs.length===0&&aft.n===3,T+`after start-up the app is on Insights, the tab tapped last, with its wardrobe (${await shown(c)}; ${c.errs.join(' | ')||'no page error'})`);
  ok(aft.set&&aft.mem==='3/1'&&aft.st==='3/1',T+`and Settings, asked for during loading, opens now, over the stored settings (laundry days/setup ${aft.mem} in memory, ${aft.st} stored)`);
  await c.p.evaluate(()=>{closeSettings();try{localStorage.removeItem('theme')}catch(e){}});

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
  // act.js missing: settings.js (required) imports acts since the restructure S5d, so the graph doesn't link and the start-up card shows
  // (the owner's choice (c), 2026-11-25: act.js counts as required; before, Today was drawn down to its month box)
  k=await fail({'act.js':{status:404}},()=>!!document.querySelector('#start-fail'),12000);
  ok(k&&/The app couldn’t start\./.test(k.text)&&k.btn&&await stored()==='ml-shirt,ml-suit,ml-tie',T+`act.js can't be loaded: the start-up card says so with Try again, and the stored wardrobe is untouched (${k?'shown':'not shown'})`);
  /* ---- a page script that is an ES module (back.js: every page and sheet registers its Back there while loading) ---- */
  // it can't be loaded, doesn't parse, or asks another module for a name that one doesn't export (the graph doesn't link, none of it runs)
  const backSrc=fs.readFileSync(path.join(ROOT,'back.js'),'utf8');
  for(const [what,how] of [['can\'t be loaded',{status:404}],['doesn\'t parse',{body:'const broken=;'}],['imports a name locale.js doesn\'t export',{body:'import {nope} from "./locale.js";\n'+backSrc}]]){
    k=await fail({'back.js':how},()=>!!document.querySelector('#start-fail'),12000);
    ok(k&&/The app couldn’t start\./.test(k.text)&&/nothing was deleted/.test(k.text)&&k.btn&&k.vis&&await stored()==='ml-shirt,ml-suit,ml-tie',T+`back.js, a module, ${what}: the start-up card says so with Try again, and the stored wardrobe is untouched (${k?'shown':'not shown'}; ${c.errs.slice(0,2).join(' | ').slice(0,160)})`)}
  // loaded: its names are its own, the bridge is what the page sees
  c.refuse=null;c.errs.length=0;await c.p.goto('about:blank');await c.p.goto(url);await c.p.waitForFunction(()=>window.appReady);await settle(c.p,300);
  // (the three Back flags are the tests' alone, so back.js hands them over on HOOK, not the bridge: T2 phase 3; d finds a name's
  // accessor in HOOK's chain, which ends in the runner's root before any module's object: it is never reached for these)
  const md=await c.p.evaluate(()=>{const d=n=>{for(let o=HOOK;o;o=Object.getPrototypeOf(o)){const x=n in o&&Object.getOwnPropertyDescriptor(o,n);if(x)return x}return {}},has=(f,n)=>{try{return f[n]===null}catch(e){return 'throws'}};
    return {fns:['backKind','backOn','backOver','backLand','backPush','backDrop','backBorrow','backReturn','backHold','backSettled','backWanted','histPush','histDrop'].every(n=>typeof globalThis[n]==='function'),
      loc:APP_LOC,get:['appHist','appKind','itemHist'].map(n=>typeof d(n).get+'/'+typeof d(n).set).join(),strict:has(backPush,'caller')+'/'+has(mergeItem,'caller'),patched:!!Date.prototype._dwLoc}});
  md.own=await c.p.evaluate('[typeof BACK,typeof backPop,typeof appLocale].join()');   // (as text: these are not the page's names, and the checkers would take a function's use of them for one)
  ok(md.own==='undefined,undefined,undefined'&&md.fns&&md.loc==='en-US'&&md.patched,T+`back.js and locale.js run as modules: their own names (BACK, backPop, appLocale) are not the page's, the bridged functions and APP_LOC are, and the Date patch is in (${JSON.stringify(md)})`);
  ok(md.get==='function/undefined,function/undefined,function/undefined'&&md.strict==='throws/true',T+'the three Back flags are getters with no setter, and back.js\'s functions are strict (reading a function\'s caller throws) where a classic script\'s are not');
  const flags=()=>c.p.evaluate(()=>HOOK.appHist+'/'+HOOK.appKind+'/'+HOOK.itemHist+'/'+backKind());
  const live=[await flags()];
  await c.p.evaluate(()=>openSettings());await settle(c.p,300);live.push(await flags());
  const kept=await c.p.evaluate(()=>Reflect.set(HOOK,'appKind','zz')+'/'+HOOK.appKind);
  await c.p.evaluate(()=>closeSettings());await settle(c.p,500);live.push(await flags());
  ok(live.join(' ')==='false//false/ true/set/false/set false//false/'&&kept==='false/set'&&c.errs.length===0,T+`a getter gives the module's value of the moment: no entry, Settings' entry, none again (${live.join(' ')}); a write from outside is refused and changes nothing (${kept})`);
  // the pattern for a `let` the tests assign: a getter and a setter, so a bare assignment in the page reaches the module's own variable
  await c.p.addScriptTag({type:'module',content:'let mlState=1;globalThis.mlRead=()=>mlState;Object.defineProperties(globalThis,{mlState:{get:()=>mlState,set:v=>{mlState=v}}});export {};'});
  await c.p.waitForFunction('typeof mlRead==="function"');
  const sett=await c.p.evaluate('(()=>{const a=mlState+"/"+mlRead();mlState=5;const b=mlState+"/"+mlRead();mlState++;return a+" "+b+" "+mlRead()})()');
  ok(sett==='1/1 5/5 6',T+`a module's \`let\` bridged with a getter and a setter: \`name=5\` and \`name++\` in the page change the module's own variable (${sett})`);

  /* ---- the card never comes on a start that is only slow ---- */
  // an error nobody catches during loading (the catcher hears it), then the stored wardrobe 6 s late: start-up is under way, so it waits
  const src=fs.readFileSync(path.join(ROOT,'start.js'),'utf8'),slow=src.replace('connRestored.then(()=>','connRestored.then(()=>new Promise(r=>setTimeout(r,6000))).then(()=>');
  ok(slow!==src,T+'(start.js\'s stored read can be slowed for the test)');
  await c.ctx.addInitScript(()=>{window.__card=0;new MutationObserver(()=>{if(document.getElementById('start-fail'))window.__card++}).observe(document,{childList:true,subtree:true});
    try{if(localStorage.getItem('ml_stray'))setTimeout(()=>{throw new Error('modload test: a stray error during loading')},20)}catch(e){}});
  const notedBefore=await c.p.evaluate(()=>{localStorage.setItem('ml_stray','1');return JSON.parse(localStorage.getItem('err_log')||'[]').filter(x=>/didn’t start/.test(x.m)).length});
  c.errs.length=0;c.refuse={'start.js':{body:slow}};c.hold=null;await c.p.goto('about:blank');await c.p.goto(url,{waitUntil:'load'});await wait(5000);
  const midway=await c.p.evaluate(()=>({card:window.__card,today:document.querySelector('#today').children.length,ready:!!window.appReady,busy:window.startBusy}));
  ok(c.errs.length===1&&midway.today===0&&!midway.ready&&midway.card===0,T+`an uncaught error during loading and the stored wardrobe 6 s late: 5 s after the page loaded Today is still empty and no card has come (${JSON.stringify(midway)})`);
  await c.p.waitForFunction(()=>window.appReady,null,{timeout:20000});await settle(c.p,300);
  ok(await c.p.evaluate(n=>window.__card===0&&items.length===3&&document.querySelector('#today').children.length>0&&JSON.parse(localStorage.getItem('err_log')||'[]').filter(x=>/didn’t start/.test(x.m)).length===n,notedBefore),T+'then the app starts as usual: the card never came and nothing was noted as a failed start');
  c.refuse=null;await c.ctx.close();
  // a first run, signed out, with such an error: Today's first page and the setup, never the card
  {const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:eng==='Chromium',serviceWorkers:'block'});
    await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    await ctx.addInitScript(()=>{window.__card=0;new MutationObserver(()=>{if(document.getElementById('start-fail'))window.__card++}).observe(document,{childList:true,subtree:true});setTimeout(()=>{throw new Error('modload test: a stray error during loading')},20)});
    const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);await wait(5000);
    const f=await p.evaluate(()=>({card:window.__card,today:document.querySelector('#today').children.length,n:items.length,setup:!!document.querySelector('#setup.on,#tour.on,.tour.on')}));
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
  await go(a);await a.p.evaluate(()=>show('today'));await settle(a.p,300);
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
    const v=await t.p.evaluate(()=>({theme:document.documentElement.dataset.theme||'',bg:getComputedStyle(document.body).backgroundColor,core:typeof TYPES,want:null}));
    const want=await t.p.evaluate(s=>{const d=document.createElement('div');d.style.cssText='position:absolute;visibility:hidden';d.setAttribute('data-x','');document.documentElement.appendChild(d);
      const old=document.documentElement.dataset.theme;document.documentElement.dataset.theme=s==='dark'?'light':'dark';const other=getComputedStyle(document.body).backgroundColor;document.documentElement.dataset.theme=old;d.remove();return other},saved);
    ok(v.core==='undefined'&&v.theme===saved&&v.bg!==want,T+`a saved ${saved} theme on a ${scheme} phone: set before the first script (merge.js held, none has run), the page already in its colors (${v.bg}, the other theme's is ${want})`);
    await go(t);ok(await t.p.evaluate(s=>document.documentElement.dataset.theme===s,saved)&&t.errs.length===0,T+`and it is still ${saved} after start-up, no page error`);
    await t.ctx.close()}
}
