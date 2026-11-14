// Build the assembled outfit pictures on this computer and upload them to the worker, so phones download each look's picture
// instead of putting it together themselves (assemble.js: asmGetPre). It runs the app itself in a headless browser, connected as
// the owner: the wardrobe comes from the backup, the masters from the worker, and every picture is made by the same code a phone
// runs, so it is the picture a phone would make. A look whose picture on the worker is already current is skipped.
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run assemble -- [options]
//
//   --days N      how far ahead to plan (default 14: each upload is one of the worker's writes, 1,000 a day on Cloudflare's free plan)
//   --jobs N      how many pictures are painted at once (default: half the computer's logical cores, at most 16)
//   --profile D   keep the browser's data in folder D between runs: the wardrobe, the masters and each master's worked-out part
//                 stay there, and so does a record of what was uploaded (made-pictures.json), so a run starts warm
//   --watch M     keep running: every M minutes (default 5) look for a change in the wardrobe, the plan or the app and build only
//                 what changed; it ends with code 10 when main has moved on GitHub (C:\code\assemble-watch.ps1 then updates and restarts it)
//   --dry         build and report, upload nothing
//   --save D      keep a copy of every picture in folder D (named <first day>-<key>.jpg)
//   --head SHA    (with --watch) the commit of main this checkout is at: the watcher passes it, so a move of main between its checkout
//                 and this script's start is noticed (without it, main is read when the script starts)
//   --look-timeout S   a look's longest wait for its Web Worker (default 180): past it the look fails and the worker is replaced
//   --cycle-timeout M  a cycle's longest run (default 45): past it the script ends with code 4 (the watcher starts it again)
//   --origin URL  the app's address (default https://marshalneubauer.github.io/DailyWardrobe/): the page is served from this
//                 computer under that address, so a worker that only answers the app's own origin (ALLOWED_ORIGIN) answers it
// Each upload is one KV write (the free plan allows 1,000 a day for everything); the token is read from the environment only.
//
// How it stays quick: one page (the app opens and loads the wardrobe once) drives a pool of Web Workers, each painting at the
// same time; looks are given to workers by master, so each worker works a master out once, and on the computer that worked-out part
// is saved in the browser's data (asm-color.js, job.diskCache) and read back on the next run. Every look's key and signature are
// known before it is painted; one listing of the worker (GET /render?list=1) and the record of earlier uploads say which looks are
// missing or out of date, and only those are painted. In --watch, a cycle in which no look changed asks the worker nothing.
const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:d)};
const has=n=>process.argv.includes('--'+n);
const DRY=has('dry'),DAYS=Math.max(1,Math.min(400,+arg('days',14)||14)),SAVE=arg('save',''),PROFILE=arg('profile','');
const JOBS=Math.max(1,Math.min(32,+arg('jobs',Math.min(16,Math.max(1,Math.floor(os.cpus().length/2))))||1));   // half the logical cores (one a physical core on a hyperthreaded CPU), at most 16
const WATCH=has('watch')?Math.max(1,+arg('watch',5)||5):0;
const HEAD=/^[0-9a-f]{7,40}$/i.test(arg('head',''))?arg('head',''):'';   // the commit of main the watcher checked out (C:\code\assemble-watch.ps1)
const LOOK_MS=Math.max(10,+arg('look-timeout',180)||180)*1000;   // one look's longest wait for a pool worker (a master worked out from scratch at 2880 takes about 30 s)
const CYCLE_MS=Math.max(5,+arg('cycle-timeout',45)||45)*60e3;   // one cycle's longest run: past it the script ends (code 4) and the watcher starts it again
const ORIGIN=String(arg('origin','https://marshalneubauer.github.io/DailyWardrobe/')).replace(/\/?$/,'/');
const WORKER=String(process.env.DW_WORKER||arg('worker','')).replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN||'';
if(has('help')||!WORKER.startsWith('http')||!TOKEN){
  console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> npm run assemble -- [--days 14] [--jobs 16] [--profile <folder>] [--watch 5] [--head <sha>] [--look-timeout 180] [--cycle-timeout 45] [--dry] [--save <folder>] [--origin <app url>]');
  process.exit(has('help')?0:1)}
const TYPES={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',json:'application/json',webmanifest:'application/manifest+json'};
// (with the app's own origin: the worker refuses a write from any other, ALLOWED_ORIGIN)
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});
const now=()=>new Date().toLocaleTimeString();
// what this computer uploaded (key -> signature), kept with the profile: a look whose key and signature match was not changed since
const MADE=PROFILE?path.join(PROFILE,'made-pictures.json'):'';
let made={};try{if(MADE&&fs.existsSync(MADE))made=JSON.parse(fs.readFileSync(MADE,'utf8'))}catch{made={}}
const saveMade=()=>{if(MADE&&!DRY)try{fs.writeFileSync(MADE,JSON.stringify(made))}catch(e){console.warn('could not save made-pictures.json',e.message)}};
/* the worker's writes for the day used up (2026-11-14: 429 kv-limit; it reset at 00:00 UTC): no more uploads until then, and in --watch no
   cycles either (it rebuilt and retried every picture every 5 minutes, 76 refused each time). Kept with the profile, so a restart keeps it */
const PAUSE=PROFILE?path.join(PROFILE,'upload-pause.json'):'';
let pauseUntil=0;try{if(PAUSE&&fs.existsSync(PAUSE))pauseUntil=+JSON.parse(fs.readFileSync(PAUSE,'utf8')).until||0}catch{pauseUntil=0}
const paused=()=>Date.now()<pauseUntil;
const nextUtcDay=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)+2*60e3};   // (two minutes past the reset)
const pauseUploads=()=>{if(paused())return;pauseUntil=nextUtcDay();if(PAUSE)try{fs.writeFileSync(PAUSE,JSON.stringify({until:pauseUntil}))}catch{}
  console.log(`${now()} The worker's writes for today are used up: uploads paused until ${new Date(pauseUntil).toLocaleString()} (its daily reset).`)};
// the app's commit, for --watch to notice that main moved
const gitRemote=()=>{try{return execFileSync('git',['-C',ROOT,'ls-remote','origin','refs/heads/main'],{encoding:'utf8',timeout:30000}).split(/\s/)[0]}catch{return ''}};

(async()=>{
  const {chromium}=require('playwright');
  const opts={serviceWorkers:'block',viewport:{width:390,height:844}};
  let browser=null,ctx;
  if(PROFILE){fs.mkdirSync(PROFILE,{recursive:true});ctx=await chromium.launchPersistentContext(path.join(PROFILE,'browser'),opts)}
  else{browser=await chromium.launch();ctx=await browser.newContext(opts)}
  // the app's files from this checkout, under the app's own address
  await ctx.route(ORIGIN+'**',route=>{const u=new URL(route.request().url());let f=path.join(ROOT,decodeURIComponent(u.pathname.slice(new URL(ORIGIN).pathname.length))||'index.html');
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');
    route.fulfill({status:200,contentType:TYPES[f.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(f)})});
  // every request the page makes to the worker goes through this script (route.fetch), so neither the worker's allowed origins nor the
  // browser's cross-origin rules stand in the way. Read-only towards the backup: the app's sync may download the wardrobe, but its
  // upload is answered here and never reaches the worker
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
  await ctx.route(WORKER+'**',async route=>{const q=route.request();
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
    // (the small sync's POST is answered with the version it was based on, so the next cycle asks only for what changed after it)
    if(q.method()!=='GET'&&new URL(q.url()).pathname.endsWith('/sync')){let b={};try{b=JSON.parse(q.postData()||'{}')}catch(e){}
      return route.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify(b&&b.delta?{rev:b.baseRev||0,saved:b.baseSaved||0}:{rev:0,saved:Date.now()})})}
    try{const res=await route.fetch({headers:{...q.headers(),'x-app-token':TOKEN}});return route.fulfill({response:res,headers:{...res.headers(),...CORS}})}
    catch(e){return route.abort()}});
  const page=ctx.pages()[0]||await ctx.newPage();page.on('pageerror',e=>console.warn('page error:',e.message));
  page.on('requestfailed',r=>{if(r.url().startsWith(WORKER))console.warn('request failed:',r.method(),r.url().replace(WORKER,''),r.failure()&&r.failure().errorText)});
  await page.goto(ORIGIN+'index.html');await page.waitForFunction(()=>window.appReady,null,{timeout:60000});
  if(await page.evaluate(([w,t])=>{const same=localStorage.getItem('worker_url')===w&&localStorage.getItem('app_token')===t;localStorage.setItem('worker_url',w);localStorage.setItem('app_token',t);return !same},[WORKER,TOKEN])){
    await page.reload();await page.waitForFunction(()=>window.appReady,null,{timeout:60000})}
  // the app's own building ahead and Today's own pictures stay idle (this script does the building); a pool of Web Workers for the painting
  // (2026-11-14 audit) a pool worker that errors or doesn't answer a look within --look-timeout fails that look and is replaced (its
  // next look starts a new one, which reads its master's kept setup back); before, a dead worker left the watcher waiting forever
  await page.evaluate(([n,lookMs])=>{asmAheadSoon=()=>{};asmAhead=async()=>{};asmEnsure=async()=>{};
    const pool=[];
    const drop=(i,w,msg)=>{for(const cb of w.wait.values())cb.no(new Error(msg));w.wait.clear();try{w.w.terminate()}catch{}if(pool[i]===w)pool[i]=null};
    const make=i=>{const w={w:new Worker('asm-worker.js'),ready:null,seq:0,wait:new Map()};
      w.ready=new Promise(ok=>{w.w.onmessage=e=>{const d=e.data||{};if('ready' in d){ok(d.ready);return}const cb=w.wait.get(d.id);if(cb){w.wait.delete(d.id);d.error?cb.no(new Error(d.error)):cb.ok(d.res)}};
        w.w.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();ok(false);drop(i,w,'the Web Worker failed'+(e&&e.message?': '+e.message:''))};
        w.w.onmessageerror=()=>drop(i,w,'the Web Worker sent something unreadable')});
      return w};
    window.__poolRun=(i,job)=>{const w=pool[i]||(pool[i]=make(i));
      return w.ready.then(ok=>{if(!ok)throw new Error('no Web Worker');return new Promise((ok2,no)=>{const id=++w.seq;
        const t=setTimeout(()=>drop(i,w,`no picture after ${Math.round(lookMs/1000)} s: the Web Worker was replaced`),lookMs);
        w.wait.set(id,{ok:v=>{clearTimeout(t);ok2(v)},no:e=>{clearTimeout(t);no(e)}});w.w.postMessage({id,job})})})};
    window.__poolN=n},[JOBS,LOOK_MS]);
  // main on GitHub when the run began: the commit the watcher checked out (--head; read here after the browser started, main might
  // already have moved and this run would never notice), else asked now (not this checkout's own commit: a branch would always differ)
  const head=WATCH?(HEAD||gitRemote()):'';
  page.on('crash',()=>{console.error(`${now()} the page crashed: ending so the watcher starts again`);process.exit(3)});
  // one cycle: bring the wardrobe and the weather up to date, list every coming look, paint the missing or changed ones
  let lastSig='';
  let wasPaused=paused();if(wasPaused)console.log(`${now()} Uploads are paused until ${new Date(pauseUntil).toLocaleString()} (the worker's writes for the day are used up).`);
  const cycle=async first=>{const t0=Date.now();
    if(paused()&&!DRY){wasPaused=true;return {quiet:true}}   // nothing can be uploaded until the reset: nothing is painted either
    if(wasPaused){wasPaused=false;lastSig='';console.log(`${now()} The worker's daily reset has passed: uploading again.`)}
    const synced=await page.evaluate(async()=>{const ok=await syncNow();try{await loadClimate();await loadWeather()}catch(e){}cache={};return {ok,items:items.length,on:typeof ASM_ON!=='undefined'&&ASM_ON}});
    if(!synced.ok||!synced.items){console.error(`${now()} Could not load the wardrobe from the backup:`,await page.evaluate(()=>localStorage.getItem('sync_status')));if(first)process.exit(2);return}
    if(!synced.on){console.error('Assembled pictures are switched off in this checkout (ASM_ON in assemble.js).');process.exit(2)}
    // every look of the coming workdays, once: its key and, painted on a colour-coded master, its signature (known before painting)
    const looks=await page.evaluate(async days=>{if(typeof asmCmMfGet==='function')await asmCmMfGet(true);   // the masters' manifest, every cycle (one small read): a master uploaded again is downloaded afresh and its looks painted again
      await asmGet(asmMasterKey(),true);
      if(typeof ASM_CM_KINDS!=='undefined'){self.ASM_CM_SIZE=2880;for(const k of Object.keys(ASM_CM_KINDS))await asmCmGet(k)}   // painted here at 2880, scaled to 2048; every mask too, since a look's signature is its newest record's date
      const T=todayDate(),seen=new Map();
      for(let i=0;i<days;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
        const o=planOn(d);if(!o)continue;await asmCmLook(o);const kind=asmCmUse(o);if(!kind&&!asmCan(o))continue;const k=asmOutKey(o);
        if(!seen.has(k))seen.set(k,{first:isoKey(d),kind:kind||'',sig:kind?asmPreSig(o):''})}
      return [...seen].map(([key,v])=>({key,...v}))},DAYS);
    const sig=JSON.stringify(looks.map(l=>[l.key,l.sig]));
    if(!first&&sig===lastSig){return {quiet:true}}   // nothing changed since the last cycle
    // which looks are missing or out of date: one listing of the worker, then the record of earlier uploads (or, without one, a look each)
    let listed=null;try{const r=await api('render?list=1',{cache:'no-store'});if(r.ok)listed=new Set((await r.json()).keys||[])}catch{}
    if(first&&listed&&looks.some(l=>l.kind)){const mf=await page.evaluate(()=>typeof asmCmMfKey==='function'?asmCmMfKey():'');
      if(mf&&!listed.has(mf))console.log('No masters\' manifest on the worker yet: run npm run cm-upload -- --dir C:\\code\\watch-test\\colormaster once, so a master, mask or background uploaded again reaches phones that hold the old one.')}
    if(process.env.DW_DEBUG)fs.writeFileSync(process.env.DW_DEBUG,JSON.stringify({looks,listed:listed&&[...listed]}));
    const need=[],cur=[];
    await Promise.all(looks.map(async l=>{
      if(listed&&!listed.has(l.key)){need.push(l);return}
      if(l.sig&&made[l.key]===l.sig){cur.push(l);return}
      if(l.sig){const c=await api('render?key='+l.key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);if(c&&c.sig===l.sig){made[l.key]=l.sig;cur.push(l)}else need.push(l);return}
      need.push(l)}));   // a look of the earlier way: its signature is known only once made (checked after)
    console.log(`${now()} ${synced.items} items; ${looks.length} looks in the next ${DAYS} days: ${need.length} to make, ${cur.length} already current${DRY?' (dry run: nothing is uploaded)':''}`);
    let built=0,skipped=cur.length,uploaded=0,failed=0,done=0;
    // the colour-coded looks shared out by master: each master gets workers in proportion to its looks, at least one; each worker a run
    const cm=need.filter(l=>l.kind),old=need.filter(l=>!l.kind),kinds=[...new Set(cm.map(l=>l.kind))],n=Math.min(JOBS,Math.max(1,cm.length));
    const per={};for(const k of kinds)per[k]=cm.filter(l=>l.kind===k).sort((a,b)=>a.first<b.first?-1:1);
    const w={};for(const k of kinds)w[k]=1;let left=n-kinds.length;
    while(left>0){const k=kinds.filter(k=>per[k].length>w[k]).sort((a,b)=>per[b].length/w[b]-per[a].length/w[a])[0];if(!k)break;w[k]++;left--}
    const runs=[];let wi=0;for(const k of kinds){const ls=per[k];for(let j=0;j<w[k];j++)runs.push({wi:wi++,kind:k,looks:ls.slice(Math.floor(j*ls.length/w[k]),Math.floor((j+1)*ls.length/w[k]))})}
    const report=(l,msg)=>{done++;console.log(`[${done}/${need.length}] ${l.first} ${msg}`)};
    const upload=async(l,r)=>{built++;
      if(!l.sig){const c=await api('render?key='+r.key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);if(c&&c.sig===r.sig){skipped++;return `${r.key} current, skipped`}}
      if(SAVE){fs.mkdirSync(SAVE,{recursive:true});fs.writeFileSync(path.join(SAVE,`${l.first}-${r.key}.jpg`),Buffer.from(r.img.split(',')[1],'base64'))}
      if(DRY)return `${r.key} built (${Math.round(r.img.length/1024)} KB)${r.how?' '+r.how:''}`;
      const up=await api('render',{method:'PUT',body:JSON.stringify({key:r.key,rec:{sig:r.sig,img:r.img,model:'assembled',t:Date.now()}})});
      if(up.ok){uploaded++;made[r.key]=r.sig;return `${r.key} uploaded (${Math.round(r.img.length/1024)} KB)${r.how?' '+r.how:''}`}
      const body=await up.text().catch(()=>'');failed++;
      if(up.status===429&&/"kv-limit"/.test(body)){pauseUploads();return 'upload refused: the worker\'s writes for today are used up'}
      return `upload refused: ${up.status} ${body}`};
    const paint=(l,wi)=>page.evaluate(async([first,wi])=>{const o=planOn(new Date(first+'T12:00:00'));await asmCmLook(o);const kind=asmCmUse(o);
      if(!kind){const r=await asmPrebuildOne(o);return r&&{...r,how:'(earlier way)'}}
      if(!await asmCmGet(kind))return {error:'its master is missing on the worker'};const job=await asmJob(o);if(!job)return {error:'no job'};job.diskCache=true;
      try{const res=await __poolRun(wi,job);return res&&res.url?{key:asmOutKey(o),sig:asmPreSig(o),img:res.url,how:`(colour-coded ${kind})`}:{error:'no picture'}}catch(e){return {error:String(e&&e.message||e)}}},[l.first,wi]);
    const one=async(l,wi)=>{if(paused()){failed++;report(l,'not made: uploads paused until the worker\'s daily reset');return}
      const t1=Date.now(),r=await paint(l,wi);if(!r||r.error){failed++;report(l,`not made${r&&r.error?': '+r.error:''}`);return}
      report(l,`${await upload(l,r)} (${Date.now()-t1} ms)`)};
    // a master's first look on one worker first (it works the master out, or reads it back, and saves it), then that master's other workers
    const firstOf={};await Promise.all(runs.map(async run=>{if(!run.looks.length)return;
      if(!firstOf[run.kind]){let go;firstOf[run.kind]=new Promise(r=>go=r);await one(run.looks[0],run.wi);go();for(const l of run.looks.slice(1))await one(l,run.wi)}
      else{await firstOf[run.kind];for(const l of run.looks)await one(l,run.wi)}}));
    for(const l of old)await one(l,0);   // the earlier way: one at a time, in the page's own worker
    saveMade();lastSig=failed?'':sig;   // (a look not made is tried again next cycle, not only when something changes)
    console.log(`Done in ${Math.round((Date.now()-t0)/1000)} s: ${built} built, ${uploaded} uploaded, ${skipped} already current, ${failed} not made.`);
    // patterned pieces the pictures paint plain or generic (asm-color.js: asmCmRoute), so a gap is seen in the log, not only in a picture
    const gaps=await page.evaluate(()=>typeof asmCmGaps==='function'?asmCmGaps().map(x=>`${sentence(itemTitle(x.i))}: ${x.r.why}`):[]).catch(()=>[]);
    if(gaps.length)console.log(`Painted plain (${gaps.length}):\n`+gaps.map(g=>'  - '+g).join('\n'));
    return {failed}};
  // (2026-11-14 audit) a cycle that hangs (the page, a request) ends the script after --cycle-timeout, so the watcher starts it again
  const guarded=async first=>{const g=setTimeout(()=>{console.error(`${now()} a cycle ran over ${Math.round(CYCLE_MS/60e3)} min: ending so the watcher starts again`);process.exit(4)},CYCLE_MS);
    try{return await cycle(first)}finally{clearTimeout(g)}};
  await guarded(true);
  if(!WATCH){await ctx.close();if(browser)await browser.close();return}
  // --watch: keep the page and its workers (with their masters) open; look again every WATCH minutes
  console.log(`${now()} watching: every ${WATCH} min`);
  for(;;){await new Promise(r=>setTimeout(r,WATCH*60e3));
    const remote=gitRemote();if(head&&remote&&remote!==head){console.log(`${now()} main moved (${remote.slice(0,7)}): ending so the app can be updated`);await ctx.close();if(browser)await browser.close();process.exit(10)}
    try{const r=await guarded(false);if(r&&r.quiet)continue}catch(e){console.warn(`${now()} cycle failed:`,e&&e.message||e)}}
})().catch(e=>{console.error(e);process.exit(1)});
