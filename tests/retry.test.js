// All or nothing, with one automatic retry (A1; the owner's decisions of 2026-11-28, O1 and O2). index.html's last script, the entry,
// imports every page file, so start-up runs only when each one loaded, parsed, linked and ran (merge.js, the one classic script, by
// its DW_MERGE). When one didn't, the head's start-up catcher fetches the app's files afresh and reloads once: with sw.js in control
// its {type:'refresh'} (this version's files again, mended in its cache, or a newer version published meanwhile, taken at once: O2),
// with none each file past the browser's cache. sessionStorage dw_retry (or, where it can't be written, the address's ?dwretry=)
// allows one automatic reload per tab every 2 minutes; a failure within them shows the start-up card at once. A file that fails once
// the app is running (a worker that can't load, the calendar's lazy parser) shows "Something didn’t load." with Reload (O1).
// Chromium and WebKit:
// - the entry imports every module tag, in their order; each page file that can't be loaded stops start-up (the entry never runs),
//   and so does one that doesn't parse, doesn't link or throws as it runs (a sample of each class);
// - a 404 on the first load only: one reload, then the app starts and the stamp is cleared; a lasting one: one reload, then the card
//   with its words, and no other reload (the loop check); Try again starts the app once the file is back; a catcher planted without
//   its guard is caught looping; with sessionStorage refused the address's mark guards the same way, keeps the #invite= hash and is
//   taken off once the app is ready; a new tab (a relaunched Home Screen app) gets its own one retry; the reload waits about 1.5 s;
// - with a service worker in control: a cache holding a broken file is mended by the retry; a newer version published meanwhile is
//   taken by the retry (a mid-deploy mismatch); offline with a good cache the app starts with no reload, and a deep link starts it
//   online and offline; offline with a broken cache: one reload, then the card; with no service worker, a broken copy kept in the
//   browser's cache (max-age) is fetched afresh by the retry;
// - late failures: the painting worker, the background check (analysis-worker.js) and the calendar's parser each can't be loaded
//   once the app runs: the toast says "Something didn’t load." with Reload, the feature keeps its fallback, and Reload loads the app again.
// The test switch DW_RETRY_NOW skips the reload's 1.5 s wait (one case measures it). Nothing leaves the machine.
const fs=require('fs'),path=require('path'),http=require('http');
const LOADS=()=>{if(!/^http/.test(location.protocol))return;try{const L=JSON.parse(localStorage.getItem('__a1loads')||'[]');L.push({t:Date.now(),href:location.href});localStorage.setItem('__a1loads',JSON.stringify(L))}catch(e){}};
const FAST=()=>{window.DW_RETRY_NOW=true;try{localStorage.setItem('tour_seen','1')}catch(e){}};
const NO_SESSION=()=>{const s=window.sessionStorage,set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===s)throw new Error('sessionStorage refused');return set.call(this,k,v)}};
const CSPV=()=>{addEventListener('securitypolicyviolation',e=>{try{const L=JSON.parse(localStorage.getItem('__a1csp')||'[]');L.push(e.violatedDirective+' '+(e.blockedURI||'inline'));localStorage.setItem('__a1csp',JSON.stringify(L))}catch(x){}},true)};
const FRESH=()=>{try{sessionStorage.setItem('dw_retry',String(Date.now()))}catch(e){}};
module.exports=async({ok,engines,url,ROOT})=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'');
  const mods=[...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(m=>m[1]),classic=[...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(m=>m[1]);
  const entry=/<script type="module">([^<]*)<\/script>\s*<\/body>/.exec(html),imps=entry?[...entry[1].matchAll(/import '\.\/([^']+)';/g)].map(m=>m[1]):[];
  ok(!!entry&&mods.length>80&&imps.join()===mods.join()&&/import '[^']+';if\(self\.DW_MERGE\)\{window\.dwEntry=1;startUp\(\)\}$/.test(entry[1].trim())&&classic.join()==='merge.js',
    `the entry, the page's last script, imports every module tag in their order (${imps.length} of ${mods.length}) and starts the app only after, when merge.js ran too`);
  const page=[...classic,...mods],src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const cat=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  ok(cat.includes('Math.abs(Date.now()-stamp())<GAP')&&/GAP=120000/.test(cat)&&/K="dw_retry"/.test(cat),'(the catcher\'s guard is there to plant without: one reload per 2 minutes, sessionStorage dw_retry)');
  const S=await swServer(ROOT);
  try{for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,page,src,S})}finally{await browser.close()}}}
  finally{await S.close()}
};
module.exports.serviceWorkers=true;   // (each context here says whether it allows them)

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(eng,browser,{ok,url,page,src,S}){
  const T=eng+': ',origin=new URL(url).origin;
  // a context on the test server whose page files are answered by c.fix ({file: {status} | {body} | {…, once}}), and c.swap(index.html)
  const open=async({fix={},init=[],fast=true,swap=null}={})=>{
    const ctx=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block',bypassCSP:true});
    await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),r=>r.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
    const c={ctx,fix,swap};
    await ctx.route(u=>u.href.startsWith(origin),async r=>{const name=new URL(r.request().url()).pathname.slice(1)||'index.html',f=c.fix[name];
      if(f&&f.once)delete c.fix[name];
      if(f&&f.status)return r.fulfill({status:f.status,contentType:'text/plain',body:''});
      if(f&&f.body!=null)return r.fulfill({status:200,contentType:'text/javascript',body:f.body});
      if(name==='index.html'&&c.swap){const res=await r.fetch();return r.fulfill({response:res,body:c.swap(await res.text())})}
      return r.continue().catch(()=>{})});
    await ctx.addInitScript(LOADS);if(fast)await ctx.addInitScript(FAST);else await ctx.addInitScript(()=>{try{localStorage.setItem('tour_seen','1')}catch(e){}});
    for(const s of init)await ctx.addInitScript(s);
    c.p=await ctx.newPage();return c};
  const look=p=>p.evaluate(()=>{const d=document.querySelector('#today #start-fail'),t=document.querySelector('#toast');
    const L=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return []}};
    return {card:d?d.textContent:'',btn:d&&d.querySelector('button')?d.querySelector('button').textContent:'',ready:!!window.appReady,busy:!!window.startBusy,entry:!!window.dwEntry,
      stamp:(()=>{try{return sessionStorage.getItem('dw_retry')}catch(e){return 'throws'}})(),href:location.href,loads:L('__a1loads'),
      log:L('err_log').map(x=>x.m).filter(m=>/^Start-up:/.test(m)),toast:t&&t.classList.contains('on')?t.textContent:'',toastBtn:t&&t.querySelector('button')?t.querySelector('button').textContent:''}}).catch(e=>({gone:e.message}));
  const until=async(p,pred,ms=15000)=>{const t0=Date.now();let s;for(;;){s=await look(p);if(!s.gone&&pred(s))return s;if(Date.now()-t0>ms)return s;await wait(100)}};
  const CARD='The app couldn’t start.Your wardrobe is safe on this phone: nothing was deleted. Check your connection, then try again.Try again';

  /* ---- the gate: each page file that can't be loaded stops start-up (the stamp is fresh, so the card shows at once, with no reload) ---- */
  const gate=async(name,how)=>{const c=await open({fix:{[name]:how},init:[FRESH]});
    try{await c.p.goto(url,{waitUntil:'domcontentloaded'});await until(c.p,s=>!!s.card,12000);await wait(250);const s=await look(c.p);
      return s.card&&!s.entry&&!s.busy&&!s.ready&&s.loads.length===1?'stopped':JSON.stringify({card:!!s.card,entry:s.entry,busy:s.busy,ready:s.ready,loads:(s.loads||[]).length,gone:s.gone})}
    catch(e){return 'error: '+e.message.split('\n')[0].slice(0,80)}finally{await c.ctx.close().catch(()=>{})}};
  const pool=async(list,fn,n=4)=>{const q=[...list],out={};await Promise.all(Array.from({length:n},async()=>{for(let x;(x=q.shift())!==undefined;)out[x]=await fn(x)}));return out};
  const g404=await pool(page,f=>gate(f,{status:404}));
  const bad=page.filter(f=>g404[f]!=='stopped');
  ok(!bad.length,T+`each of the ${page.length} page files that can't be loaded (404) stops start-up: the entry never runs, startUp is never called, and the card shows${bad.length?': '+bad.map(f=>f+' '+g404[f]).join('; '):''}`);
  const SAMPLE=['merge.js','bus.js','core.js','start.js','history.js','today.js','asm-look.js','mq/vest.js','about.js','add-paste.js','sync.js','asm-cm-page.js'].filter(f=>page.includes(f));
  const kinds={'doesn\'t parse':f=>({body:'const broken=;\n'+src(f)}),'throws as it runs':f=>({body:'throw new Error("planted at load");\n'+src(f)}),
    'doesn\'t link (imports a name nobody exports)':f=>({body:(f==='merge.js'?'':`import {nope} from "${f.includes('/')?'../':'./'}locale.js";\n`)+src(f)})};
  for(const [what,how] of Object.entries(kinds)){const list=what.startsWith('doesn\'t link')?SAMPLE.filter(f=>f!=='merge.js'):SAMPLE;
    const r=await pool(list,f=>gate(f,how(f))),b=list.filter(f=>r[f]!=='stopped');
    ok(!b.length,T+`a page file that ${what} stops start-up (${list.join(', ')})${b.length?': '+b.map(f=>f+' '+r[f]).join('; '):''}`)}

  /* ---- the retry ---- */
  // a 404 on the first load only (a deploy under way): one reload, then the app starts, and the stamp is cleared
  {const c=await open({fix:{'about.js':{status:404,once:true}}});
    try{await c.p.goto(url);const s=await until(c.p,s=>s.ready,25000);
      ok(s.ready&&!s.card&&s.loads.length===2&&s.stamp===null&&s.log.length===1&&/^Start-up: reloaded once: .*not loaded: about\.js/.test(s.log[0]),
        T+`about.js missing on the first load only: one reload, then the app starts, the stamp is cleared and the error report has "reloaded once" (${s.loads&&s.loads.length} loads; ${(s.log||[]).join(' | ')})`)}
    finally{await c.ctx.close()}}
  // a lasting 404: one reload, then the card at once, with its words, and nothing reloads again (the loop check); Try again starts
  // the app once the file is back; a new tab (a Home Screen app opened again: sessionStorage starts empty) gets its own one retry
  const loops=async(c,ms)=>{const n0=(await until(c.p,()=>true)).loads.length;await wait(ms);const s=await until(c.p,()=>true);return {more:s.loads.length-n0,s}};
  {const c=await open({fix:{'about.js':{status:404}}});
    try{await c.p.goto(url);let s=await until(c.p,s=>!!s.card,25000);const L=await loops(c,3000);s=L.s;
      ok(s.card===CARD&&s.btn==='Try again'&&s.loads.length===2&&L.more===0&&!s.ready,T+`about.js missing for good: one reload, then the start-up card with its words, and no other reload in the next 3 s (${s.loads.length} loads, ${L.more} more; "${s.card}")`);
      ok(s.log.length===2&&/^Start-up: reloaded once: /.test(s.log[0])&&/^Start-up: the app didn’t start: .*not loaded: about\.js/.test(s.log[1])&&!!s.stamp,T+`the error report has one line per attempt (${s.log.join(' | ')}), and the stamp stays while the card shows`);
      const tab=await c.ctx.newPage();await tab.goto(url);let t=await until(tab,s=>!!s.card,25000);
      const st=await tab.evaluate(()=>JSON.parse(localStorage.getItem('__a1loads')).length);
      ok(!!t.card&&st===4,T+`a new tab (a relaunched Home Screen app: its sessionStorage starts empty) gets its own one reload, then the card (${st-2} loads there)`);
      await tab.close();
      delete c.fix['about.js'];await c.p.evaluate(()=>document.querySelector('#start-fail button').click()).catch(()=>{});s=await until(c.p,s=>s.ready,25000);
      ok(s.ready&&!s.card&&s.stamp===null,T+`Try again, with the file back: the app starts, and the stamp is cleared (${s.ready})`)}
    finally{await c.ctx.close()}}
  // planted: the catcher without its guard reloads again and again, and the loop check sees it
  {const c=await open({fix:{'about.js':{status:404}},swap:h=>h.replace('Math.abs(Date.now()-stamp())<GAP','false')});
    try{await c.p.goto(url).catch(()=>{});await wait(500);const L=await loops(c,3000);
      ok(L.more>=3,T+`planted: the catcher with its 2-minute guard taken out reloads again and again, and the loop check catches it (${L.more} more loads in 3 s)`)}
    finally{await c.ctx.close()}}
  // sessionStorage refused: the address carries ?dwretry= instead (no module's address has it), keeps the #invite= hash, and guards the
  // same way; once the app is ready start.js takes the mark off
  {const c=await open({fix:{'about.js':{status:404,once:true}},init:[NO_SESSION]});
    try{await c.p.goto(url+'#invite=a1-test');const s=await until(c.p,s=>s.ready,25000),h=s.loads.map(x=>x.href);
      ok(s.ready&&h.length===2&&/[?&]dwretry=\d+/.test(h[1])&&/#invite=a1-test$/.test(h[1])&&!/dwretry/.test(s.href),T+`sessionStorage refused, about.js missing once: the reload's address has ?dwretry= and keeps #invite=a1-test, the app starts and the mark is taken off (${h.join(' → ')} → ${s.href})`)}
    finally{await c.ctx.close()}}
  {const c=await open({fix:{'about.js':{status:404}},init:[NO_SESSION]});
    try{await c.p.goto(url);await until(c.p,s=>!!s.card,25000);const L=await loops(c,3000);
      ok(!!L.s.card&&L.s.loads.length===2&&L.more===0,T+`sessionStorage refused, about.js missing for good: one reload (the address's mark), then the card, and no other reload (${L.s.loads.length} loads)`)}
    finally{await c.ctx.close()}}
  // the reload waits about 1.5 s after the failure (a CDN still taking the new version has a moment); tests skip it (DW_RETRY_NOW)
  {const c=await open({fix:{'about.js':{status:404,once:true}},fast:false});
    try{await c.p.goto(url);const s=await until(c.p,s=>s.ready,25000),gap=s.loads.length===2?s.loads[1].t-s.loads[0].t:-1;
      ok(s.ready&&gap>=1400&&gap<8000,T+`without the test switch the reload comes about 1.5 s after the page was parsed (${gap} ms between the two loads)`)}
    finally{await c.ctx.close()}}

  /* ---- late failures (O1): the toast, the fallbacks, Reload ---- */
  {const c=await open();
    try{await c.p.goto(url);await until(c.p,s=>s.ready,25000);
      c.fix['asm-worker.js']={status:404};
      await c.p.evaluate(()=>{HOOK.asmW=null;HOOK.asmWorker()});let s=await until(c.p,s=>!!s.toast,8000);
      const down=await c.p.evaluate(()=>HOOK.asmW);
      ok(s.toast==='Something didn’t load. Reload'&&s.toastBtn==='Reload'&&down===false&&!s.card&&s.ready,T+`the painting worker can't be loaded once the app runs: the toast says "Something didn’t load." with Reload, and the painter goes on on the page (asmW ${down}; "${s.toast}")`);
      const n=s.loads.length;await c.p.evaluate(()=>document.querySelector('#toast button').click());s=await until(c.p,s=>s.ready&&s.loads.length>n,20000);
      ok(s.ready&&s.loads.length===n+1&&!s.card,T+`its Reload loads the app again (${s.loads.length-n} load)`);
      c.fix['analysis-worker.js']={status:404};
      await c.p.evaluate(()=>{HOOK.analyzeWardrobe()});s=await until(c.p,s=>!!s.toast,8000);
      ok(s.toast==='Something didn’t load. Reload',T+`the background check (analysis-worker.js) can't be loaded: the same toast ("${s.toast}"), and What to buy is worked out on the page`);
      c.fix['calparse.js']={status:404};
      const r=await c.p.evaluate(async()=>{HOOK.loadTold=false;document.querySelector('#toast').classList.remove('on');try{await HOOK.calHere(new ArrayBuffer(0),{from:'2026-11-16',days:60,tz:'UTC'});return 'read'}catch(e){return 'rejected'}});
      s=await until(c.p,s=>!!s.toast,8000);
      ok(r==='rejected'&&s.toast==='Something didn’t load. Reload',T+`the calendar's lazy parser (calparse.js) can't be loaded: the reading fails as before (${r}) and the toast says so ("${s.toast}")`)}
    finally{await c.ctx.close()}}

  /* ---- with a service worker in control (the test's own server: tests/run.js's server isn't sw.js's scope here) ---- */
  const swOpen=async()=>{const ctx=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'allow'});await ctx.addInitScript(LOADS);await ctx.addInitScript(FAST);await ctx.addInitScript(CSPV);
    const p=await ctx.newPage();await p.goto(S.url);
    const ctl=await p.waitForFunction(()=>!!(navigator.serviceWorker&&navigator.serviceWorker.controller),null,{timeout:20000}).then(()=>true,()=>false);
    if(ctl){await p.reload();await until(p,s=>s.ready,25000)}
    return {ctx,p,ctl}};
  const broke=p=>p.evaluate(async()=>{const k=(await caches.keys()).find(k=>/^dw-v\d+$/.test(k));const c=await caches.open(k);await c.put(new Request('core.js'),new Response('const broken=;',{headers:{'content-type':'text/javascript'}}));return k});
  const cached=p=>p.evaluate(async()=>{const k=(await caches.keys()).find(k=>/^dw-v\d+$/.test(k));const r=await (await caches.open(k)).match('core.js');return {k,broken:!!r&&(await r.text()).startsWith('const broken=;'),keys:await caches.keys()}});
  const viol=[],csp=async p=>{try{viol.push(...await p.evaluate(()=>JSON.parse(localStorage.getItem('__a1csp')||'[]')))}catch(e){}};
  let c=await swOpen();
  if(!c.ctl){ok(false,T+'a service worker controls the page on the test\'s own server (needed for the cases below)');await c.ctx.close()}
  else{try{
    // a cache holding a broken file (an install during a deploy can store a mix): the retry fetches this version's files again into
    // CACHE-r, copies them over, and the reload starts the app
    let k=await broke(c.p),n=(await look(c.p)).loads.length;await c.p.reload();let s=await until(c.p,s=>s.ready||!!s.card,30000),m=await cached(c.p);
    ok(s.ready&&!s.card&&s.loads.length===n+2&&!m.broken&&m.k===k&&!m.keys.some(x=>/-r$/.test(x))&&s.log.some(l=>/^Start-up: reloaded once/.test(l)),
      T+`sw.js in control, its cache holding a core.js that doesn't parse: one reload, the same version's files fetched again (${k}, core.js mended, no ${k}-r left), and the app starts (${s.loads.length-n} loads)`);
    // offline with a good cache: the app starts, no reload; a deep link starts it offline and online (sw.js sends it to the app's root)
    S.st.down=true;n=s.loads.length;await c.p.reload();s=await until(c.p,s=>s.ready||!!s.card,25000);
    ok(s.ready&&!s.card&&s.loads.length===n+1,T+`offline, with a good cache: the app starts from it, with no reload (${s.loads.length-n} load)`);
    await c.p.goto(S.url+'a1/deep/link').catch(()=>{});s=await until(c.p,s=>s.ready||!!s.card,25000);
    ok(s.ready&&!s.card&&new URL(s.href).pathname==='/',T+`offline, a deep link starts the app at its root (${s.href})`);
    // offline with a broken cache: the refresh can't fetch anything and keeps the cache as it is; one reload, then the card
    await broke(c.p);n=s.loads.length;await c.p.reload();s=await until(c.p,s=>!!s.card||s.ready,30000);const L=await loops({p:c.p},2500);
    ok(!!s.card&&!s.ready&&L.s.loads.length===n+2&&L.more===0&&(await cached(c.p)).broken,T+`offline, the cache holding a broken core.js: one reload, then the card, and the cache as it was (${L.s.loads.length-n} loads)`);
    S.st.down=false;await c.p.evaluate(()=>{try{sessionStorage.removeItem('dw_retry')}catch(e){}});
    await c.p.goto(S.url+'a1/deep/link').catch(()=>{});s=await until(c.p,s=>s.ready||!!s.card,30000);
    ok(s.ready&&!s.card&&new URL(s.href).pathname==='/'&&!(await cached(c.p)).broken,T+`online again, a deep link starts the app at its root (${s.href}), the retry having mended the cache`);
    }finally{await csp(c.p);await c.ctx.close()}
    // a newer version published while this one's cache is broken (mid-deploy): the retry takes the newer version at once (O2)
    c=await swOpen();
    try{const v0=(await cached(c.p)).k;await broke(c.p);S.st.bump=1;S.st.marker='v2';const n=(await look(c.p)).loads.length;
      await c.p.reload();await c.p.waitForFunction(()=>window.appReady&&/v2/.test(document.querySelector('h1').textContent),null,{timeout:40000}).catch(()=>{});
      const s=await look(c.p),m=await cached(c.p),core=await c.p.evaluate(()=>window.__core||'');
      ok(s.ready&&!s.card&&core==='v2'&&m.k!==v0&&!m.broken&&s.loads.length<=n+3,T+`a newer version published meanwhile (${v0} → ${m.k}): the retry takes it at once, and every file is the new release (core.js "${core}", ${s.loads.length-n} loads)`)}
    finally{S.st.bump=0;S.st.marker='';await csp(c.p);await c.ctx.close()}}
  // no service worker, a broken copy kept by the browser's cache (GitHub Pages' max-age=600): the retry fetches each file past it
  {const ctx=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'});await ctx.addInitScript(LOADS);await ctx.addInitScript(FAST);await ctx.addInitScript(CSPV);
    let p;try{p=await ctx.newPage();S.st.maxAge=true;S.st.once['/core.js']='const broken=;';await p.goto(S.url);const s=await until(p,s=>s.ready||!!s.card,30000);
      ok(s.ready&&!s.card&&s.loads.length===2,T+`no service worker, core.js broken on its first fetch and kept 10 minutes by the browser's cache: the retry fetches it afresh and the app starts after one reload (${s.loads.length} loads)`)}
    finally{S.st.maxAge=false;S.st.once={};if(p)await csp(p);await ctx.close()}}
  // the retry under index.html's security policy (these contexts don't bypass it): its fetches, sw.js's refresh and the reloads
  ok(!viol.length,T+`the retry, sw.js's refresh, the newer version taken and the reloads cause no security-policy violation (${viol.length?viol.join('; '):'none'})`)
}
/* the test's own server for the service-worker cases: the repo's files; st.down drops every connection (offline), st.bump raises sw.js's
   CACHE (a release), st.marker marks that release's index.html and core.js, st.once answers a file once with other text, st.maxAge
   lets the browser keep files 10 minutes */
async function swServer(ROOT){const st={down:false,bump:0,marker:'',once:{},maxAge:false};
  const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg'};
  const srv=http.createServer((q,r)=>{if(st.down){q.socket.destroy();return}
    let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
    fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}
      if(st.once[u]!=null){d=Buffer.from(st.once[u]);delete st.once[u]}
      else{if(u==='/index.html'&&st.marker)d=Buffer.from(String(d).replace('<h1>Daily Wardrobe</h1>',`<h1>Daily Wardrobe ${st.marker}</h1>`));
        if(u==='/core.js'&&st.marker)d=Buffer.from(String(d)+`\n;window.__core='${st.marker}';`);
        if(u==='/sw.js'&&st.bump)d=Buffer.from(String(d).replace(/dw-v(\d+)/,(m,n)=>'dw-v'+(+n+st.bump)))}
      r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':st.maxAge?'max-age=600':'no-cache'});r.end(d)})});
  const port=await require('./safeport').listenSafe(srv,'127.0.0.1');
  return {st,url:`http://127.0.0.1:${port}/`,close:()=>new Promise(r=>{srv.closeAllConnections&&srv.closeAllConnections();srv.close(()=>r())})}}
