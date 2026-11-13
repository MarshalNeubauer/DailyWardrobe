// Build the assembled outfit pictures on this computer and upload them to the worker, so phones download each look's picture
// instead of putting it together themselves (assemble.js: asmGetPre). It runs the app itself in a headless browser, connected as
// the owner: the wardrobe comes from the backup, the masters from the worker, and every picture is made by the same code a phone
// runs, so it is the picture a phone would make. A look whose picture on the worker is already current is skipped.
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run assemble -- [options]
//
//   --days N      how far ahead to plan (default 120)
//   --jobs N      how many pictures are painted at once (default: half the computer's logical cores, at most 16)
//   --profile D   keep the browser's data in folder D between runs: the wardrobe, the masters and each master's worked-out part
//                 stay there, and so does a record of what was uploaded (made-pictures.json), so a run starts warm
//   --watch M     keep running: every M minutes (default 5) look for a change in the wardrobe, the plan or the app and build only
//                 what changed; it ends with code 10 when main has moved on GitHub (C:\code\assemble-watch.ps1 then updates and restarts it)
//   --dry         build and report, upload nothing
//   --save D      keep a copy of every picture in folder D (named <first day>-<key>.jpg)
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
const DRY=has('dry'),DAYS=Math.max(1,Math.min(400,+arg('days',120)||120)),SAVE=arg('save',''),PROFILE=arg('profile','');
const JOBS=Math.max(1,Math.min(32,+arg('jobs',Math.min(16,Math.max(1,Math.floor(os.cpus().length/2))))||1));   // half the logical cores (one a physical core on a hyperthreaded CPU), at most 16
const WATCH=has('watch')?Math.max(1,+arg('watch',5)||5):0;
const ORIGIN=String(arg('origin','https://marshalneubauer.github.io/DailyWardrobe/')).replace(/\/?$/,'/');
const WORKER=String(process.env.DW_WORKER||arg('worker','')).replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN||'';
if(has('help')||!WORKER.startsWith('http')||!TOKEN){
  console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> npm run assemble -- [--days 120] [--jobs 16] [--profile <folder>] [--watch 5] [--dry] [--save <folder>] [--origin <app url>]');
  process.exit(has('help')?0:1)}
const TYPES={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',json:'application/json',webmanifest:'application/manifest+json'};
// (with the app's own origin: the worker refuses a write from any other, ALLOWED_ORIGIN)
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});
const now=()=>new Date().toLocaleTimeString();
// what this computer uploaded (key -> signature), kept with the profile: a look whose key and signature match was not changed since
const MADE=PROFILE?path.join(PROFILE,'made-pictures.json'):'';
let made={};try{if(MADE&&fs.existsSync(MADE))made=JSON.parse(fs.readFileSync(MADE,'utf8'))}catch{made={}}
const saveMade=()=>{if(MADE&&!DRY)try{fs.writeFileSync(MADE,JSON.stringify(made))}catch(e){console.warn('could not save made-pictures.json',e.message)}};
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
    if(q.method()==='PUT'&&new URL(q.url()).pathname.endsWith('/sync'))return route.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({rev:0,saved:Date.now()})});
    try{const res=await route.fetch({headers:{...q.headers(),'x-app-token':TOKEN}});return route.fulfill({response:res,headers:{...res.headers(),...CORS}})}
    catch(e){return route.abort()}});
  const page=ctx.pages()[0]||await ctx.newPage();page.on('pageerror',e=>console.warn('page error:',e.message));
  page.on('requestfailed',r=>{if(r.url().startsWith(WORKER))console.warn('request failed:',r.method(),r.url().replace(WORKER,''),r.failure()&&r.failure().errorText)});
  await page.goto(ORIGIN+'index.html');await page.waitForFunction(()=>window.appReady,null,{timeout:60000});
  if(await page.evaluate(([w,t])=>{const same=localStorage.getItem('worker_url')===w&&localStorage.getItem('app_token')===t;localStorage.setItem('worker_url',w);localStorage.setItem('app_token',t);return !same},[WORKER,TOKEN])){
    await page.reload();await page.waitForFunction(()=>window.appReady,null,{timeout:60000})}
  // the app's own building ahead and Today's own pictures stay idle (this script does the building); a pool of Web Workers for the painting
  await page.evaluate(n=>{asmAheadSoon=()=>{};asmAhead=async()=>{};asmEnsure=async()=>{};
    const pool=[];window.__poolRun=(i,job)=>{let w=pool[i];if(!w){w=pool[i]={w:new Worker('asm-worker.js'),ready:null,seq:0,wait:new Map()};
        w.ready=new Promise(ok=>{w.w.onmessage=e=>{const d=e.data||{};if('ready' in d){ok(d.ready);return}const cb=w.wait.get(d.id);if(cb){w.wait.delete(d.id);d.error?cb.no(new Error(d.error)):cb.ok(d.res)}}})}
      return w.ready.then(ok=>{if(!ok)throw new Error('no Web Worker');return new Promise((ok2,no)=>{const id=++w.seq;w.wait.set(id,{ok:ok2,no});w.w.postMessage({id,job})})})};
    window.__poolN=n},JOBS);
  const head=WATCH?gitRemote():'';   // main on GitHub when the run began (not this checkout's own commit: a branch would always differ)
  // one cycle: bring the wardrobe and the weather up to date, list every coming look, paint the missing or changed ones
  let lastSig='';
  const cycle=async first=>{const t0=Date.now();
    const synced=await page.evaluate(async()=>{const ok=await syncNow();try{await loadClimate();await loadWeather()}catch(e){}cache={};return {ok,items:items.length,on:typeof ASM_ON!=='undefined'&&ASM_ON}});
    if(!synced.ok||!synced.items){console.error(`${now()} Could not load the wardrobe from the backup:`,await page.evaluate(()=>localStorage.getItem('sync_status')));if(first)process.exit(2);return}
    if(!synced.on){console.error('Assembled pictures are switched off in this checkout (ASM_ON in assemble.js).');process.exit(2)}
    // every look of the coming workdays, once: its key and, painted on a colour-coded master, its signature (known before painting)
    const looks=await page.evaluate(async days=>{await asmGet(asmMasterKey(),true);
      if(typeof ASM_CM_KINDS!=='undefined'){self.ASM_CM_SIZE=2880;for(const k of Object.keys(ASM_CM_KINDS))await asmCmGet(k)}   // painted here at 2880, scaled to 2048; every mask too, since a look's signature is its newest record's date
      const T=todayDate(),seen=new Map();
      for(let i=0;i<days;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
        const o=planOn(d);if(!o)continue;await asmCmLook(o);const kind=asmCmUse(o);if(!kind&&!asmCan(o))continue;const k=asmOutKey(o);
        if(!seen.has(k))seen.set(k,{first:isoKey(d),kind:kind||'',sig:kind?`asm/out/z${ASM_ZV}/${asmStamp(o)}`:''})}
      return [...seen].map(([key,v])=>({key,...v}))},DAYS);
    const sig=JSON.stringify(looks.map(l=>[l.key,l.sig]));
    if(!first&&sig===lastSig){return {quiet:true}}   // nothing changed since the last cycle
    // which looks are missing or out of date: one listing of the worker, then the record of earlier uploads (or, without one, a look each)
    let listed=null;try{const r=await api('render?list=1',{cache:'no-store'});if(r.ok)listed=new Set((await r.json()).keys||[])}catch{}
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
      failed++;return `upload refused: ${up.status} ${await up.text().catch(()=>'')}`};
    const paint=(l,wi)=>page.evaluate(async([first,wi])=>{const o=planOn(new Date(first+'T12:00:00'));await asmCmLook(o);const kind=asmCmUse(o);
      if(!kind){const r=await asmPrebuildOne(o);return r&&{...r,how:'(earlier way)'}}
      if(!await asmCmGet(kind))return {error:'its master is missing on the worker'};const job=await asmJob(o);if(!job)return {error:'no job'};job.diskCache=true;
      try{const res=await __poolRun(wi,job);return res&&res.url?{key:asmOutKey(o),sig:`asm/out/z${ASM_ZV}/${asmStamp(o)}`,img:res.url,how:`(colour-coded ${kind})`}:{error:'no picture'}}catch(e){return {error:String(e&&e.message||e)}}},[l.first,wi]);
    const one=async(l,wi)=>{const t1=Date.now(),r=await paint(l,wi);if(!r||r.error){failed++;report(l,`not made${r&&r.error?': '+r.error:''}`);return}
      report(l,`${await upload(l,r)} (${Date.now()-t1} ms)`)};
    // a master's first look on one worker first (it works the master out, or reads it back, and saves it), then that master's other workers
    const firstOf={};await Promise.all(runs.map(async run=>{if(!run.looks.length)return;
      if(!firstOf[run.kind]){let go;firstOf[run.kind]=new Promise(r=>go=r);await one(run.looks[0],run.wi);go();for(const l of run.looks.slice(1))await one(l,run.wi)}
      else{await firstOf[run.kind];for(const l of run.looks)await one(l,run.wi)}}));
    for(const l of old)await one(l,0);   // the earlier way: one at a time, in the page's own worker
    saveMade();lastSig=sig;
    console.log(`Done in ${Math.round((Date.now()-t0)/1000)} s: ${built} built, ${uploaded} uploaded, ${skipped} already current, ${failed} not made.`);
    // patterned pieces the pictures paint plain or generic (asm-color.js: asmCmRoute), so a gap is seen in the log, not only in a picture
    const gaps=await page.evaluate(()=>typeof asmCmGaps==='function'?asmCmGaps().map(x=>`${sentence(itemTitle(x.i))}: ${x.r.why}`):[]).catch(()=>[]);
    if(gaps.length)console.log(`Painted plain (${gaps.length}):\n`+gaps.map(g=>'  - '+g).join('\n'));
    return {failed}};
  await cycle(true);
  if(!WATCH){await ctx.close();if(browser)await browser.close();return}
  // --watch: keep the page and its workers (with their masters) open; look again every WATCH minutes
  console.log(`${now()} watching: every ${WATCH} min`);
  for(;;){await new Promise(r=>setTimeout(r,WATCH*60e3));
    const remote=gitRemote();if(head&&remote&&remote!==head){console.log(`${now()} main moved (${remote.slice(0,7)}): ending so the app can be updated`);await ctx.close();if(browser)await browser.close();process.exit(10)}
    try{const r=await cycle(false);if(r&&r.quiet)continue}catch(e){console.warn(`${now()} cycle failed:`,e&&e.message||e)}}
})().catch(e=>{console.error(e);process.exit(1)});
