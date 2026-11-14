// The master atlas: every pixel of the assembled pictures' masters measured once, on this computer.
//
// It runs the app itself in a headless browser, connected as the owner, so it measures the very photos a phone downloads (the master,
// the waistcoat master, the black calibration shirt and the zones' pictures, from the worker). Two results:
//   - the phone's share: what the painter works out for the master (assemble.js asmAtlasBuild: three pictures), uploaded to the worker
//     so phones download it instead of working it out (asmGetAtlas); a phone uses it only while the photos it was measured from are
//     the ones it holds. Three KV writes, and none when the worker already has this very atlas.
//   - the full atlas, for work on this computer (tools/atlas-measure.js): every pixel's colour, part, edge, light, detail, surface and
//     weave direction, for the suit master and the waistcoat master, written to --out as one gzipped typed array per property, with
//     atlas.json saying what each holds and how it is scaled, and pictures of some of them; tools/atlas.js reads it back.
//   - the same for each colour-coded master on the worker (asm-color.js: cm-suit, cm-vest, cm-shirt-tie, cm-shirt-open), at 2048 as a
//     phone paints them, from the painter's own work on it (asmCmPrep: the soft zones, each zone's light, sleeves, tie, cuffs). Nothing of
//     these is uploaded: the phones work it out themselves.
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run atlas -- [--out <folder>] [--parts <folder>] [--dry] [--origin <app url>]
//
//   --out     where the full atlas goes (default: ./atlas, which git ignores)
//   --parts   a folder of finer part pictures made with SAM (zone-lapelL-2048.png, zone-lapelR-…, zone-sleeveL-…, zone-sleeveR-…;
//             white = the part): without it the jacket is one part
//   --dry     measure and write the full atlas, upload nothing
//   --origin  the app's address (default https://marshalneubauer.github.io/DailyWardrobe/), as for npm run assemble
// Run it again whenever a master, the black calibration shirt or a zone picture is made again. The token is read from the
// environment only.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),budget=require('./upload-budget.js');
const ROOT=path.join(__dirname,'..');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const DRY=process.argv.includes('--dry'),OUT=path.resolve(arg('out',path.join(process.cwd(),'atlas'))),PARTS=arg('parts',''),CM_SIZE=+arg('cm-size',0)||0;   // (--cm-size: the colour-coded masters at another size than a phone's 2048, for the tests)
const ORIGIN=String(arg('origin','https://marshalneubauer.github.io/DailyWardrobe/')).replace(/\/?$/,'/');
const WORKER=String(process.env.DW_WORKER||arg('worker','')).replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN||'';
if(process.argv.includes('--help')||!WORKER.startsWith('http')||!TOKEN){
  console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> npm run atlas -- [--out <folder>] [--parts <folder>] [--dry] [--origin <app url>]');
  process.exit(process.argv.includes('--help')?0:1)}
const TYPES={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',json:'application/json',webmanifest:'application/manifest+json'};
// (with the app's own origin: the worker refuses a write from any other, ALLOWED_ORIGIN)
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});
const dataUrl=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const writeUrl=(f,u)=>fs.writeFileSync(f,Buffer.from(u.split(',')[1],'base64'));

(async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch();
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await ctx.route(ORIGIN+'**',route=>{const u=new URL(route.request().url());let f=path.join(ROOT,decodeURIComponent(u.pathname.slice(new URL(ORIGIN).pathname.length))||'index.html');
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');
    route.fulfill({status:200,contentType:TYPES[f.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(f)})});
  // the worker through this script (as npm run assemble does); nothing the app tries to upload reaches it
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
  await ctx.route(WORKER+'**',async route=>{const q=route.request();
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
    if(q.method()!=='GET')return route.fulfill({status:200,headers:CORS,contentType:'application/json',body:JSON.stringify({ok:true,rev:0,saved:Date.now()})});
    try{const res=await route.fetch({headers:{...q.headers(),'x-app-token':TOKEN}});return route.fulfill({response:res,headers:{...res.headers(),...CORS}})}
    catch(e){return route.abort()}});
  const page=await ctx.newPage();page.on('pageerror',e=>console.warn('page error:',e.message));
  await page.goto(ORIGIN+'index.html');await page.waitForFunction(()=>window.appReady,null,{timeout:60000});
  await page.evaluate(([w,t])=>{localStorage.setItem('worker_url',w);localStorage.setItem('app_token',t)},[WORKER,TOKEN]);
  await page.reload();await page.waitForFunction(()=>window.appReady,null,{timeout:60000});
  await page.evaluate(()=>{asmAheadSoon=()=>{};asmAhead=async()=>{}});
  // the photos, as a phone downloads them
  const src=await page.evaluate(async()=>{const keys={master:asmMasterKey(),vest:asmVestKey(),calib:asmCalibKey('shirt'),...Object.fromEntries(ASM_ZONE_SLOTS.map(s=>['zone-'+s,asmZoneKey(s)])),'zone-vest':asmZoneKey('vest')};
    const out={};for(const [n,k] of Object.entries(keys)){await asmGet(k,true);out[n]={key:k,t:renders[k]?renders[k].t:null}}return out});
  const miss=Object.entries(src).filter(([n,v])=>!v.t&&n!=='vest'&&n!=='zone-vest').map(([n])=>n);
  if(miss.length){console.error('The worker lacks: '+miss.join(', ')+'. Make or upload the masters, the black calibration shirt and the zones\' pictures first.');process.exit(2)}
  fs.mkdirSync(OUT,{recursive:true});
  // ---- the phone's share
  const ph=await page.evaluate(async()=>{const r=await asmAtlasBuild();return r&&{sig:r.sig,W:r.W,n:r.n,imgs:r.imgs,keys:Object.fromEntries(ASM_ATLAS.map(p=>[p,asmAtlasKey(p)]))}});
  if(!ph){console.error('Could not measure the master for the phones.');process.exit(2)}
  fs.mkdirSync(path.join(OUT,'phone'),{recursive:true});let up=0,cur=0;
  const todo=[];
  for(const [p,k] of Object.entries(ph.keys)){writeUrl(path.join(OUT,'phone','paint-'+p+'.png'),ph.imgs[p]);
    const now=await api('render?key='+k,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
    if(now&&now.sig===ph.sig){cur++;continue}if(!DRY)todo.push([p,k])}
  // this computer's daily cap (tools/upload-budget.js): the pictures still needed are reserved together, all or none
  if(todo.length&&!budget.take(todo.length)){console.error(`The phones' atlas needs ${todo.length} uploads, but ${budget.why()}: nothing uploaded.`);process.exit(4)}
  for(const [p,k] of todo){
    const r=await api('render',{method:'PUT',body:JSON.stringify({key:k,rec:{sig:ph.sig,img:ph.imgs[p],model:'atlas',t:Date.now()}})});
    if(!r.ok){console.error(`Upload of the phones' atlas (${p}) refused: ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}up++}
  console.log(`Phones: the painter's ${ph.n.toLocaleString()} shirt pixels at ${ph.W}px, ${DRY?'not uploaded (dry run)':up?up+' of 3 pictures uploaded':''}${cur?(up?', ':'')+cur+' already current':''}.`);
  // ---- the full atlas
  await page.addScriptTag({path:path.join(__dirname,'atlas-measure.js')});
  const fine={};if(PARTS)for(const n of ['lapelL','lapelR','sleeveL','sleeveR']){const f=path.join(PARTS,`zone-${n}-2048.png`);if(fs.existsSync(f))fine[n]=dataUrl(f)}
  const man={version:1,built:new Date().toISOString(),pxPerMm:ASM_PX_MM_NOTE(),sources:src,phone:{sig:ph.sig,keys:ph.keys,files:Object.fromEntries(Object.keys(ph.keys).map(p=>[p,'phone/paint-'+p+'.png'])),
    encoding:'a: R shirt share 1-255 (0 = not painted), G blend-toward offset (dx+7)*16+(dy+7) (0 = itself), B weave direction (deg+90)/180*254; m, c: R*256+G over 65535 x 1.6 = white / black shirt shading'},
    fineParts:Object.keys(fine),masters:{}};
  for(const m of ['suit','vest']){if(!src[m==='suit'?'master':'vest'].t){console.log('No waistcoat master on the worker: only the suit master is measured.');continue}
    const r=await page.evaluate(async([m,fine])=>{const k=m==='suit'?asmMasterKey():asmVestKey(),zs=asmZoneImgs()||{},parts={jacket:zs.jacket,shirt:zs.shirt,tie:zs.tie,watch:zs.watch,...fine};
      if(m==='vest'&&renders[asmZoneKey('vest')])parts.waistcoat=renders[asmZoneKey('vest')].img;
      return atlasMeasure({img:renders[k].img,parts,calib:m==='suit'?renders[asmCalibKey('shirt')].img:null})},[m,fine]);
    const dir=path.join(OUT,m);fs.mkdirSync(dir,{recursive:true});const layers={};
    for(const [name,[type,ch,scale,meaning]] of Object.entries(r.layers)){const b=Buffer.from(await page.evaluate(n=>atlasLayer(n),name),'base64'),file=`${m}/${name}.${type}.gz`;
      fs.writeFileSync(path.join(OUT,file),zlib.gzipSync(b,{level:6}));layers[name]={file,type,channels:ch,scale,meaning,bytes:b.length}}
    const pv=await page.evaluate(()=>atlasPreviews());for(const [n,u] of Object.entries(pv))writeUrl(path.join(dir,'preview-'+n+'.png'),u);
    man.masters[m]={W:r.W,layers,parts:r.parts,previews:Object.keys(pv).map(n=>`${m}/preview-${n}.png`)};man.partNames=r.names;
    console.log(`${m==='suit'?'Suit master':'Waistcoat master'}: ${r.W}x${r.W}, ${Object.keys(layers).length} layers, ${r.parts.length} parts (${r.parts.map(p=>p.name).join(', ')}), ${(r.ms/1000).toFixed(1)} s`)}
  // ---- the colour-coded masters (asm-color.js), each at the size a phone paints it: what the painter works out for it, pixel by pixel
  man.version=2;
  for(const kind of await page.evaluate(()=>typeof ASM_CM_KINDS==='undefined'?[]:Object.keys(ASM_CM_KINDS))){
    const r=await page.evaluate(async([kind,S])=>{if(!await asmCmGet(kind))return null;const r=await atlasMeasureCm(kind,S||ASM_SIZE);
      return r&&{...r,keys:asmCmAssets(kind),t:renders[asmCmKey(kind,'master')].t}},[kind,CM_SIZE]);
    if(!r){console.log(`Colour-coded ${kind} master: not on the worker, not measured.`);continue}
    const name='cm-'+kind,dir=path.join(OUT,name);fs.mkdirSync(dir,{recursive:true});const layers={};
    for(const [n,[type,ch,scale,meaning]] of Object.entries(r.layers)){const b=Buffer.from(await page.evaluate(n=>atlasLayer(n),n),'base64'),file=`${name}/${n}.${type}.gz`;
      fs.writeFileSync(path.join(OUT,file),zlib.gzipSync(b,{level:6}));layers[n]={file,type,channels:ch,scale,meaning,bytes:b.length}}
    const pv=await page.evaluate(()=>atlasPreviews());for(const [n,u] of Object.entries(pv))writeUrl(path.join(dir,'preview-'+n+'.png'),u);
    man.masters[name]={W:r.W,colourCoded:true,kind,master:{key:r.keys[0],t:r.t},layers,parts:r.parts,zones:r.zones,geometry:r.geo,previews:Object.keys(pv).map(n=>`${name}/preview-${n}.png`)};man.partNames=r.names;
    console.log(`Colour-coded ${kind} master: ${r.W}x${r.W}, ${Object.keys(layers).length} layers, ${r.parts.length} parts (${r.parts.map(p=>p.name).join(', ')}), ${(r.ms/1000).toFixed(1)} s`)}
  fs.writeFileSync(path.join(OUT,'atlas.json'),JSON.stringify(man,null,1));
  const size=d=>fs.readdirSync(d,{withFileTypes:true}).reduce((s,e)=>s+(e.isDirectory()?size(path.join(d,e.name)):fs.statSync(path.join(d,e.name)).size),0);
  console.log(`Full atlas written to ${OUT} (${(size(OUT)/1048576).toFixed(1)} MB). Look things up with: node tools/atlas.js "${OUT}" pixel suit <x> <y>`);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
/* the scale (assemble.js ASM_PX_MM, for the 2048 masters): one figure, since a single photo can't tell depth pixel by pixel */
function ASM_PX_MM_NOTE(){return {at2048:3.2,note:'about 32 px a cm on the 2048 masters (shoulder seams ~1460 px apart, ~46 cm); one figure for the whole picture'}}
