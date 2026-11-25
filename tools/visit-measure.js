// End-to-end measure of Today's outfit picture on a phone (2026-11-14, the owner: "measure what shows and how long it takes to get the
// outfit picture"): a fresh device connected to the real worker (the owner's wardrobe, and the pictures the PC builder uploaded before it was removed on 2026-11-16), on
// phone-like network and CPU (an iPhone's screen, 4G: 9 Mbit/s, 60 ms; CPU 4x slower), records frame by frame whether the drawing or
// the picture shows, for the first open, for swipes to the next workdays, and for a second open (the app reopened, as every day).
// Read-only on the server: every write to the worker is answered here with the server's own version, so the device keeps the mark a real
// phone keeps (an answer of rev 0 made the next open pull the whole backup again).
//   DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> node tools/visit-measure.js --out <dir> [--net 4g|wifi] [--cpu 4] [--swipes 8] [--pages]
// --pages: load the app from GitHub Pages as deployed; otherwise from --root (default: this checkout), served under the same address.
// Writes <out>/visit-<net>.json (every frame change, a trace of the plan, what the worker keeps for each day) and prints a summary.
// The recorder reads the plan only once the app is ready: reading it before the wardrobe loaded cached an empty month (a false failure).
// (CR-8-06, 2026-11-17) Nothing uploads looks' pictures any more: a look not among the PC builder's old ones is painted on the phone, and the
// report says "painted on the phone" for it (it said "not on server", which read like a failure).
const fs=require('fs'),path=require('path'),os=require('os');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:d)},has=n=>process.argv.includes('--'+n);
const ROOT=path.resolve(arg('root',path.join(__dirname,'..'))),OUT=arg('out','.'),NET=arg('net','4g'),CPU=+arg('cpu',4),SWIPES=+arg('swipes',8),PAGES=has('pages');
fs.mkdirSync(OUT,{recursive:true});
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const ORIGIN='https://marshalneubauer.github.io/DailyWardrobe/',WORKER=String(process.env.DW_WORKER).replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN;
if(!TOKEN||!WORKER.startsWith('http')){console.error('DW_WORKER / DW_TOKEN missing');process.exit(1)}
// The plan's trace wraps these as window.<name>. A page script that is an ES module calls its own functions inside the module, where a
// wrapped window.<name> isn't seen (history.js's replanFuture, called by its own planRulesCheck and replanButton, since 2026-11-23), so
// the trace would silently lack those calls. The tool reads the checkout's files and stops when a traced function is called inside its
// own module; --skip-untraced runs anyway, leaves those names out and says so in the trace and the summary.
const TRACED=['renderToday','planSnapCheck','refreshToday','onSyncedData','replanFuture','clearLocks','checkPlanRules','syncRedraw','mergeState','planSnapUse'];
const UNTRACED=(()=>{const out=[];let html='';try{html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8')}catch{return out}
  for(const m of html.matchAll(/<script type="module" src="([^"]+)"/g)){let s='';try{s=fs.readFileSync(path.join(ROOT,m[1]),'utf8')}catch{continue}
    for(const n of TRACED){if(!new RegExp('(?:^|[^.\\w$])(?:async\\s+)?function\\s+'+n+'\\s*\\(|(?:^|[^.\\w$])(?:const|let|var)\\s+'+n+'\\s*=','m').test(s))continue;
      const calls=(s.match(new RegExp('(?<![.\\w$])'+n+'\\s*\\(','g'))||[]).length-(s.match(new RegExp('function\\s+'+n+'\\s*\\(','g'))||[]).length;
      if(calls>0)out.push(`${n} (${m[1]} calls it ${calls} time${calls===1?'':'s'} itself)`);
      // (a function the module keeps to itself is on no window to wrap, however it is called: today.js hands planSnapCheck to requestIdleCallback)
      else if(!new RegExp('Object\\.assign\\(globalThis,\\{[^}]*(?<![\\w$])'+n+'(?![\\w$])').test(s))out.push(`${n} (${m[1]} keeps it to itself)`)}}
  return out})();
if(UNTRACED.length&&!has('skip-untraced')){console.error('visit-measure: the plan\'s trace can no longer see every call of '+UNTRACED.join(', ')+
  '.\nThose files are ES modules now: a call made inside the module doesn\'t go through window.<name>, which is what this tool wraps.\n'+
  'Nothing was measured. To measure the pictures anyway, with those names left out of the trace (and said so), add --skip-untraced.');process.exit(2)}
const TYPES={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml'};
const NETS={'4g':{latency:60,downloadThroughput:9e6/8,uploadThroughput:1.5e6/8},wifi:{latency:15,downloadThroughput:40e6/8,uploadThroughput:10e6/8}};
// in the page: a frame-by-frame record of the picture area (drawing / picture loading / picture shown), from navigation start
const PROBE=`(()=>{if(window.__vis)return;const L=window.__vis=[];let last='';
  const st=()=>{const c=document.getElementById('mannequin-container');if(!c)return 'none';const im=c.querySelector(':scope > img');
    if(im)return im.complete&&im.naturalWidth>0?'photo':'photo-loading';return c.querySelector('svg')?'drawing':'empty'};
  const tick=()=>{const s=st();let d='';try{d=sel.getFullYear()+'-'+(sel.getMonth()+1)+'-'+sel.getDate()}catch{}const k=s+'|'+d;
    if(k!==last){last=k;let m='';try{if(!window.appReady)throw 0;const o=planFor()[key(sel)],r=o&&asmLive()&&(asmFor(o)?'exact':asmStale&&asmStale(o)?'stale':'');m=r||''}catch{}L.push({t:Math.round(performance.now()),s,d,m})}
    requestAnimationFrame(tick)};requestAnimationFrame(tick)})()`;
async function open(ctx,label){
  const page=ctx.pages()[0]||await ctx.newPage();const cdp=await ctx.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,...NETS[NET]});await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU});
  let bytes=0,asks=0;page.on('requestfinished',async q=>{if(q.url().startsWith(WORKER)){asks++;try{const s=await q.sizes();bytes+=s.responseBodySize}catch{}}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(ORIGIN+'index.html',{waitUntil:'commit'});
  await page.evaluate(PROBE).catch(()=>{});
  await page.waitForFunction(()=>window.appReady,null,{timeout:300000});
  // a trace of the plan Today reads (planFor) and of the calls that change it, for the first 20 s
  await page.evaluate(([TRACED,UNTRACED])=>{window.__pl=[];const note=s=>window.__pl.push(Math.round(performance.now())+' '+s);
    if(UNTRACED.length)note('NOT TRACED (called inside their own module): '+UNTRACED.join(', '));const skip=new Set(UNTRACED.map(x=>x.split(' ')[0]));
    const sum=()=>{try{const o=planFor()[key(sel)];return `${key(sel)} top=${o&&o.top?o.top.primaryColor:null} shirt=${o&&o.shirt?o.shirt.primaryColor:null} items=${items.length} cacheKeys=${Object.keys(cache).join('/')} snap=${cache.snap} pulled=${typeof pulledYet==='function'?pulledYet():'?'} dress=${JSON.stringify(settings.dress)}`}catch(e){return 'err '+e}};
    note('ready '+sum());
    for(const n of TRACED){if(skip.has(n))continue;const f=window[n];if(typeof f!=='function'){note('NOT TRACED (not a global): '+n);continue}
      window[n]=function(...a){note('call '+n+' '+sum());const r=f.apply(this,a);Promise.resolve(r).then(()=>note('after '+n+': '+sum())).catch(()=>{});return r}}
    let i=0;const iv=setInterval(()=>{note('tick '+sum());if(++i>20)clearInterval(iv)},1000)},[TRACED,UNTRACED]);
  // (a day off today, as on a Saturday: the first open is measured on the next workday, stepped to as soon as the app is ready)
  const tReady=await page.evaluate(()=>{if(!isWorkday(sel))stepDay(1);return Math.round(performance.now())});
  const target=await page.evaluate(()=>sel.getFullYear()+'-'+(sel.getMonth()+1)+'-'+sel.getDate());
  await page.waitForFunction(d=>window.__vis.some(x=>x.d===d&&x.s==='photo'),target,{timeout:180000,polling:100}).catch(()=>{});
  const first={ready:tReady,day:target,log:(await page.evaluate(()=>window.__vis.slice()))};
  // swipes: one workday on at a time, as the swipe does (stepDay), each measured from the step until its picture shows (or 60 s)
  const swipes=[];
  await page.waitForTimeout(1500);   // a short pause, as a person glances at today
  for(let i=0;i<SWIPES;i++){
    const r=await page.evaluate(async()=>{const n0=window.__vis.length,t=performance.now();stepDay(1);const d=sel.getFullYear()+'-'+(sel.getMonth()+1)+'-'+sel.getDate();
      const until=Date.now()+60000;while(Date.now()<until){if(window.__vis.slice(n0).some(x=>x.d===d&&x.s==='photo'))break;await new Promise(r=>setTimeout(r,50))}
      const L=window.__vis.slice(n0).filter(x=>x.d===d).map(x=>({...x,t:Math.round(x.t-t)}));const shown=L.find(x=>x.s==='photo');
      let st={};try{const o=planFor()[key(sel)],k=asmCmKind(o),ok=asmOutKey(o),t=x=>x?x.type+':'+x.primaryColor:null;st={o:o?{top:t(o.top),shirt:t(o.shirt),tie:t(o.tie),vest:o.vest,suitDay:o.suitDay}:null,
        dress:JSON.stringify(settings.dress),items:items.length,masterKinds:Object.keys(ASM_CM_KINDS).join(),ready:Object.keys(ASM_CM_KINDS).map(x=>x+':'+('asmCmHeld' in HOOK&&HOOK.asmCmHeld(x))).join(),kind:k,held:HOOK.asmCmHeld(k),use:asmCmUse(o),list:asmList?asmList.size:null,key:ok,kept:!!HOOK.asmOut[ok],listed:asmList&&ok?asmList.has(ok):null,busy:asmBusy.size,
        queue:'asmQ' in HOOK?HOOK.asmQ.length:null,ahead:HOOK.asmAheadOn,shown:!!renderFor(o),pre:ok?HOOK.asmPreGetting.has(ok):null,tried:ok?asmTried.has('pre:'+ok):null,retry:ok?HOOK.asmRetryAt.get('pre:'+ok)||0:null}}catch(e){st={err:String(e)}}
      return {d,firstState:(L[0]||{}).s,drew:L.some(x=>x.s==='drawing'),ms:shown?shown.t:null,how:shown?shown.m:'',log:L,st}},null);
    swipes.push(r);await page.waitForTimeout(1200)}
  // what the worker keeps for the days measured: one of the PC builder's old pictures, or painted on the phone?
  const built=await page.evaluate(async days=>{try{await asmListGet(true)}catch{}const L=asmList;const out={};
    for(const d of days){const [y,m,dd]=d.split('-').map(Number),o=planOn(new Date(y,m-1,dd));if(!o){out[d]='no outfit';continue}await HOOK.asmCmLook(o);const k=asmOutKey(o);out[d]=!k?'no master':L&&L.has(k)?'on server':'painted on the phone'}return out},[first.day,...swipes.map(s=>s.d)].filter(Boolean));
  const trace=await page.evaluate(()=>window.__pl||[]);
  return {label,first,swipes,built,trace,worker:{asks,mb:+(bytes/1048576).toFixed(1)},errs:errs.slice(0,5)}}
(async()=>{
  const dir=arg('profile','')||fs.mkdtempSync(path.join(os.tmpdir(),'dw-visit-'));
  // (src: a checkout to serve the app from for this open, or 'pages' for GitHub Pages; --then opens later ones from other checkouts)
  const mk=async(src=PAGES?'pages':ROOT)=>{const ctx=await chromium.launchPersistentContext(dir,{serviceWorkers:'block',viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
      userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
    const R=src==='pages'?null:path.resolve(src);
    if(R)await ctx.route(ORIGIN+'**',route=>{const u=new URL(route.request().url());let f=path.join(R,decodeURIComponent(u.pathname.slice(new URL(ORIGIN).pathname.length))||'index.html');
      if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(R,'index.html');route.fulfill({status:200,contentType:TYPES[f.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(f)})});
    const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
    await ctx.route(WORKER+'**',async route=>{const q=route.request();
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
      // (a write answered as if the server took it without changing: the device keeps the server's own version as its mark, as a real
      // phone ends up after a sync; answering rev 0 made the next open pull the whole backup again, which a real phone never does)
      if(q.method()!=='GET'){let b={};try{b=JSON.parse(q.postData()||'{}')}catch{}return route.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({rev:b.baseRev||0,saved:b.baseSaved||Date.now()})})}
      try{const res=await route.fetch();return route.fulfill({response:res,headers:{...res.headers(),...CORS}})}catch(e){return route.abort()}});
    await ctx.addInitScript(([w,t])=>{try{if(!localStorage.getItem('worker_url')){localStorage.setItem('worker_url',w);localStorage.setItem('app_token',t)}}catch{}},[WORKER,TOKEN]);
    await ctx.addInitScript(PROBE);return ctx};
  let ctx,a=null;if(!has('reopen')){ctx=await mk();a=await open(ctx,'first open on a new phone');await ctx.close()}
  // the plan kept for the next start-up (PLAN_SNAP), as the first open left it: is it a real plan?
  if(a){ctx=await mk();const pg=ctx.pages()[0]||await ctx.newPage();await pg.goto('about:blank');await ctx.close()}
  if(has('firstonly')){console.log('profile '+dir);process.exit(0)}
  ctx=await mk();const b=await open(ctx,'second open (the app reopened)');await ctx.close();
  // --then "label=checkout;label=checkout": more reopens, each served from a checkout (a changed painter or master gives every look a new key:
  // what does the phone show for the days whose picture it holds under the old key, and how long until the new one?)
  const more=[];for(const part of String(arg('then','')).split(';').filter(Boolean)){const [lab,src]=part.split('=');ctx=await mk(src);more.push(await open(ctx,lab));await ctx.close()}
  const runs=[a,b,...more].filter(Boolean),res={net:NET,cpu:CPU,source:PAGES?'GitHub Pages':ROOT,when:new Date().toISOString(),profile:dir,runs};
  fs.writeFileSync(path.join(OUT,`visit-${NET}${has('reopen')?'-reopen':''}.json`),JSON.stringify(res,null,1));
  for(const r of runs){const f=r.first.log.filter(x=>x.d===r.first.day),firstPic=f.find(x=>x.s==='photo'),drew=f.find(x=>x.s==='drawing');
    console.log(`\n== ${r.label} (${NET}, CPU ${CPU}x), ${r.first.day}: app ready ${r.first.ready} ms; drawing shown ${drew?'at '+drew.t+' ms':'never'}; picture shown ${firstPic?'at '+firstPic.t+' ms ('+firstPic.m+')':'NOT within 180 s'} [server: ${r.built[r.first.day]}]; worker ${r.worker.asks} asks, ${r.worker.mb} MB`);
    for(const s of r.swipes)console.log(`  swipe to ${s.d}: ${s.drew?'DRAWING first':'no drawing'} -> picture ${s.ms==null?'NOT within 60 s':s.ms+' ms'} ${s.how} [server: ${r.built[s.d]}]${s.ms==null?' '+JSON.stringify(s.st):''}`);
    if(r.errs.length)console.log('  page errors:',r.errs.join(' | '))}
  if(UNTRACED.length)console.log('\nThe plan\'s trace leaves out (called inside their own module): '+UNTRACED.join(', '));
})().catch(e=>{console.error(e);process.exit(1)});
