// Build the assembled outfit pictures on this computer and upload them to the worker, so phones download each look's picture
// instead of putting it together themselves (assemble.js: asmGetPre). It runs the app itself in a headless browser, connected as
// the owner: the wardrobe comes from the backup, the master, calibration photos and pieces from the worker, and every picture is
// made by the same code a phone runs (asmPrebuildOne), so it is the picture a phone would make. Run it after the masters,
// calibration photos and item pieces are made (or a piece is made again): a look whose picture on the worker is already current
// is skipped, so a second run uploads only what changed.
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run assemble -- [--days 120] [--jobs 8] [--dry] [--save <folder>] [--origin <app url>]
//
//   --days    how far ahead to plan (default 120)
//   --jobs    how many looks are built at once, each in a page of its own (default: half the computer's cores, at most 8)
//   --dry     build and report, upload nothing
//   --save    a folder to keep a copy of every picture in, to look at (named <first day>-<key>.jpg)
//   --origin  the app's address (default https://marshalneubauer.github.io/DailyWardrobe/): the page is served from this
//             computer under that address, so a worker that only answers the app's own origin (ALLOWED_ORIGIN) answers it
// Each upload is one KV write (the free plan allows 1,000 a day for everything); the token is read from the environment only.
//
// Speed: a colour-coded look's key and signature are known before it is painted (asmCmLook, asmOutKey, asmStamp), so a look already
// current on the worker is not painted at all; the looks are sorted by master and shared out in runs, so each page works out each
// master's colour-free part once (asm-color.js keeps all four at 2880), and the pages paint at the same time, each in its own
// Web Worker.
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const DRY=process.argv.includes('--dry'),DAYS=Math.max(1,Math.min(400,+arg('days',120)||120)),SAVE=arg('save','');
const JOBS=Math.max(1,Math.min(32,+arg('jobs',Math.min(8,Math.max(1,Math.floor(os.cpus().length/2))))||1));
const ORIGIN=String(arg('origin','https://marshalneubauer.github.io/DailyWardrobe/')).replace(/\/?$/,'/');
const WORKER=String(process.env.DW_WORKER||arg('worker','')).replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN||'';
if(process.argv.includes('--help')||!WORKER.startsWith('http')||!TOKEN){
  console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> npm run assemble -- [--days 120] [--jobs 8] [--dry] [--save <folder>] [--origin <app url>]');
  process.exit(process.argv.includes('--help')?0:1)}
const TYPES={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',json:'application/json',webmanifest:'application/manifest+json'};
// (with the app's own origin: the worker refuses a write from any other, ALLOWED_ORIGIN)
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});

(async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch();
  // one app, connected as the owner, with its wardrobe from the backup: in a context of its own (its own storage, so pages building
  // at the same time don't share a database)
  const openApp=async()=>{const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    // the app's files from this checkout, under the app's own address
    await ctx.route(ORIGIN+'**',route=>{const u=new URL(route.request().url());let f=path.join(ROOT,decodeURIComponent(u.pathname.slice(new URL(ORIGIN).pathname.length))||'index.html');
      if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');
      route.fulfill({status:200,contentType:TYPES[f.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(f)})});
    // every request the page makes to the worker goes through this script (route.fetch), so neither the worker's allowed origins nor
    // the browser's cross-origin rules stand in the way. Read-only towards the backup: the app's sync may download the wardrobe, but
    // its upload is answered here and never reaches the worker
    const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
    await ctx.route(WORKER+'**',async route=>{const q=route.request();
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
      if(q.method()==='PUT'&&new URL(q.url()).pathname.endsWith('/sync'))return route.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({rev:0,saved:Date.now()})});
      try{const res=await route.fetch({headers:{...q.headers(),'x-app-token':TOKEN}});return route.fulfill({response:res,headers:{...res.headers(),...CORS}})}
      catch(e){return route.abort()}});
    const page=await ctx.newPage();page.on('pageerror',e=>console.warn('page error:',e.message));
    page.on('requestfailed',r=>{if(r.url().startsWith(WORKER))console.warn('request failed:',r.method(),r.url().replace(WORKER,''),r.failure()&&r.failure().errorText)});
    await page.goto(ORIGIN+'index.html');await page.waitForFunction(()=>window.appReady,null,{timeout:60000});
    await page.evaluate(([w,t])=>{localStorage.setItem('worker_url',w);localStorage.setItem('app_token',t)},[WORKER,TOKEN]);
    await page.reload();await page.waitForFunction(()=>window.appReady,null,{timeout:60000});
    // the app's own building ahead stays idle (this script does the building, one look at a time)
    await page.evaluate(()=>{asmAheadSoon=()=>{};asmAhead=async()=>{}});
    const synced=await page.evaluate(async()=>{const ok=await syncNow();return {ok,items:items.length,on:typeof ASM_ON!=='undefined'&&ASM_ON}});
    if(!synced.ok||!synced.items){console.error('Could not load the wardrobe from the backup:',await page.evaluate(()=>localStorage.getItem('sync_status')));process.exit(2)}
    if(!synced.on){console.error('Assembled pictures are switched off in this checkout (ASM_ON in assemble.js).');process.exit(2)}
    // the colour-coded masters (asm-color.js): painted here at their full 2880 and scaled to 2048 (a phone paints at 2048)
    await page.evaluate(async()=>{await asmGet(asmMasterKey(),true);if(typeof ASM_CM_KINDS!=='undefined'){self.ASM_CM_SIZE=2880;for(const k of Object.keys(ASM_CM_KINDS))await asmGet(asmCmKey(k,'master'),true)}});
    return {page,items:synced.items}};
  const first=await openApp();
  // every look of the coming workdays, once, with its master
  const looks=await first.page.evaluate(async days=>{const T=todayDate(),seen=new Map();
    for(let i=0;i<days;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
      const o=planOn(d);if(!o||!(asmCan(o)||asmCmUse(o)))continue;const k=asmOutKey(o);if(!seen.has(k))seen.set(k,{first:isoKey(d),kind:asmCmUse(o)||'earlier'})}
    return [...seen].map(([key,v])=>({key,...v}))},DAYS);
  looks.sort((a,b)=>a.kind<b.kind?-1:a.kind>b.kind?1:a.first<b.first?-1:1);   // by master: each page works out a master's colour-free part once
  const jobs=Math.max(1,Math.min(JOBS,looks.length));
  console.log(`${first.items} items; ${looks.length} looks to put together in the next ${DAYS} days, ${jobs} at a time${DRY?' (dry run: nothing is uploaded)':''}`);
  let built=0,skipped=0,uploaded=0,failed=0,done=0;const t0=Date.now();
  // the looks shared out in runs (contiguous: a page meets as few masters as it can)
  const shares=Array.from({length:jobs},(_,j)=>looks.slice(Math.floor(j*looks.length/jobs),Math.floor((j+1)*looks.length/jobs)));
  const apps=[first,...await Promise.all(shares.slice(1).map(()=>openApp()))];
  const one=async(page,l)=>{const t1=Date.now();
    // a colour-coded look's key and signature before it is painted: already current on the worker, it is not painted at all
    const pre=await page.evaluate(async first=>{const o=planOn(new Date(first+'T12:00:00'));await asmCmLook(o);return asmCmUse(o)?{key:asmOutKey(o),sig:`asm/out/z${ASM_ZV}/${asmStamp(o)}`}:null},l.first);
    if(pre){const cur=await api('render?key='+pre.key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
      if(cur&&cur.sig===pre.sig){skipped++;return `${pre.key} current, skipped (${Date.now()-t1} ms)`}}
    const r=await page.evaluate(async first=>{const d=new Date(first+'T12:00:00'),o=planOn(d);try{const r=await asmPrebuildOne(o);return r&&{...r,how:asmCmUse(o)?'(colour-coded '+asmCmUse(o)+')':'(earlier way)'}}catch(e){return {error:String(e&&e.message||e)}}},l.first);
    if(!r||r.error){failed++;return `not made${r&&r.error?': '+r.error:' (a piece or the master is missing)'}`}
    built++;
    // already on the worker as this very picture (same zones, same photos)? then no write
    if(!pre){const cur=await api('render?key='+r.key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
      if(cur&&cur.sig===r.sig){skipped++;return `${r.key} current, skipped (${Date.now()-t1} ms)`}}
    if(SAVE){fs.mkdirSync(SAVE,{recursive:true});fs.writeFileSync(path.join(SAVE,`${l.first}-${r.key}.jpg`),Buffer.from(r.img.split(',')[1],'base64'))}   // --save <folder>: a copy of each picture, to look at
    if(DRY)return `${r.key} built (${Math.round(r.img.length/1024)} KB, ${Date.now()-t1} ms)${r.how?' '+r.how:''}`;
    const up=await api('render',{method:'PUT',body:JSON.stringify({key:r.key,rec:{sig:r.sig,img:r.img,model:'assembled',t:Date.now()}})});
    if(up.ok){uploaded++;return `${r.key} uploaded (${Math.round(r.img.length/1024)} KB, ${Date.now()-t1} ms)${r.how?' '+r.how:''}`}
    failed++;return `upload refused: ${up.status} ${await up.text().catch(()=>'')}`};
  await Promise.all(shares.map(async(share,j)=>{for(const l of share){const msg=await one(apps[j].page,l);done++;console.log(`[${done}/${looks.length}] ${l.first} ${msg}`)}}));
  console.log(`Done in ${Math.round((Date.now()-t0)/1000)} s: ${built} built, ${uploaded} uploaded, ${skipped} already current, ${failed} not made.`);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
