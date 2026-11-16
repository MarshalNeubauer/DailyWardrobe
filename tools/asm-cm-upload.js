// The colour-coded masters onto the worker (asm-color.js): for each kind, the master (2880, as a JPEG), its zone masks (2048 PNGs) and
// its sleeve and lapel masks, as photo records under the keys the app asks for (asmCmKey). A record already there with the same
// signature is left alone (no KV write). Then it writes the manifest (asm-color.js asmCmMfKey: every record's date), so a device that
// holds an older copy of a re-uploaded file downloads it again and the looks painted from it are painted again. Run it after any
// master, mask, part or the background is made again (and once to write the first manifest). Last, the list of master records testers may
// read from the owner's (the worker's cm:shared), written only when it changed.
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run cm-upload -- --dir <colormaster folder> [--dry] [--kinds suit,vest]
//
//   --dir    the folder colormaster.js writes: out-<kind>\colormaster-2880.png, alpha-<zone>.png, sleeve-sleeve?.png, lapel-lapel?.png, and
//            when there, uv-u.png and uv-v.png (the solved cloth positions, geo3d\flatten) and light.png (the light map)
//   --dry    say what would go up, upload nothing
//   --bg <file>  the background behind every master (asm-color.js asmCmBgKey: an empty, out-of-focus room, square), as a JPEG; with --bg alone
//                only the background goes up
// The token is read from the environment only.
// The records to write and the manifest are reserved from this computer's daily cap first (tools/upload-budget.js, 300 a day for every
// tool together): too few left and nothing is uploaded (exit code 4), so a master is never left half new.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),budget=require('./upload-budget.js');
const ROOT=path.join(__dirname,'..');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const DRY=process.argv.includes('--dry'),DIR=arg('dir',''),BG=arg('bg','');
const ORIGIN=String(arg('origin','https://marshalneubauer.github.io/DailyWardrobe/')).replace(/\/?$/,'/');
const WORKER=String(process.env.DW_WORKER||'').replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN||'';
if((!DIR&&!BG)||(DIR&&!fs.existsSync(DIR))||(BG&&!fs.existsSync(BG))||(!DRY&&(!WORKER.startsWith('http')||!TOKEN))){
  console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> npm run cm-upload -- --dir <colormaster folder> [--dry] [--kinds suit,vest] [--bg <background file>]');process.exit(1)}
// the app's keys: asmKey = 'c' + fnv64('asm/' + ASM_VER + '/' + t) (app.js fnv64, assemble.js ASM_VER), asmCmKey = asmKey('cm' + ASM_CMV + '/' + kind + '/' + name)
const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const ASM_VER=+/const ASM_VER=(\d+)/.exec(src('assemble.js'))[1],ASM_CMV=+/const ASM_CMV=(\d+)/.exec(src('asm-color.js'))[1];
const fnv64=t=>{let h=0xcbf29ce484222325n;for(const c of Buffer.from(t,'utf8')){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}return h.toString(16).padStart(16,'0')};
const cmKey=(kind,name)=>'c'+fnv64('asm/'+ASM_VER+'/cm'+ASM_CMV+'/'+kind+'/'+name);
const ZONES={suit:['jacket','tie','background','skin','shirt','dark','watch'],vest:['jacket','waistcoat','tie','background','skin','shirt','dark','watch'],
  'shirt-tie':['trousers','belt','tie','buckle','background','skin','shirt','dark','watch'],'shirt-open':['trousers','belt','buckle','background','skin','shirt','dark','watch'],
  // the open-collar jacket masters (2026-11-13: a jacket taken off the tie): uploaded once their out-<kind> folder exists
  'suit-open':['jacket','background','skin','shirt','dark','watch'],'vest-open':['jacket','waistcoat','background','skin','shirt','dark','watch']};
// (2026-11-16) the new garments' masters (asm-kinds.js ASM_NK): the casual tops on the open-shirt master's zones, the cardigan and chore
// jacket on the open-collar jacket's (the chore jacket's collar as lapels); uploaded once their out-<kind> folder exists
for(const k of ['tee','polo','henley','sweater','sweatshirt','hoodie','qzip'])ZONES[k]=ZONES['shirt-open'];
for(const k of ['cardigan','chore'])ZONES[k]=ZONES['suit-open'];
const NEW_KINDS=['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore'];
const ASM_LAPELS=new Set(['suit','vest','suit-open','vest-open','chore']),OPTIONAL=new Set(['suit-open','vest-open',...NEW_KINDS]);
// (2026-11-16) a master's faded copy for jeans (asm-kinds.js asmJfKey: record 'master-jeans'), when the folder has colormaster-jeans-2880.png
const JEANS_FILE='colormaster-jeans-2880.png';
const KINDS=DIR?String(arg('kinds',Object.keys(ZONES).filter(k=>!OPTIONAL.has(k)||fs.existsSync(path.join(DIR,'out-'+k))).join(','))).split(','):[];
const MF_IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';   // (the worker keeps photo records only: the manifest carries a 1x1 picture)
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});
(async()=>{
  const {chromium}=require('playwright');const browser=await chromium.launch(),page=await browser.newPage();
  const jpeg=async f=>page.evaluate(async u=>{const i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=u});const c=new OffscreenCanvas(i.width,i.height);c.getContext('2d').drawImage(i,0,0);
    const b=await c.convertToBlob({type:'image/jpeg',quality:.93});return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)})},'data:image/'+(/\.jpe?g$/i.test(f)?'jpeg':/\.webp$/i.test(f)?'webp':'png')+';base64,'+fs.readFileSync(f).toString('base64'));
  const png=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
  let up=0,same=0,bytes=0;const dates={},todo=[];   // key -> the record's date on the worker, for the manifest
  const groups=KINDS.map(kind=>[kind,path.join(DIR,'out-'+kind)]);if(BG)groups.push(['all',null]);
  for(const [kind,out] of groups){if(out&&!fs.existsSync(out)){console.error('missing '+out);process.exit(2)}
    const files=kind==='all'?[['background',BG,true]]:[['master',path.join(out,'colormaster-2880.png'),true],...ZONES[kind].map(z=>['mask/'+z,path.join(out,'alpha-'+z+'.png')]),
      ...['sleeveR','sleeveL'].map(s=>['part/'+s,path.join(out,'sleeve-'+s+'.png')]),...(ASM_LAPELS.has(kind)?['lapelR','lapelL'].map(s=>['part/'+s,path.join(out,'lapel-'+s+'.png')]):[])];
    // the solved cloth positions (asm-color.js asmGeoPrep: geo3d/flatten), when the folder has them: lossless PNGs, never re-encoded
    if(out)for(const c of ['u','v']){const f=path.join(out,'uv-'+c+'.png');if(fs.existsSync(f))files.push(['geo/'+c,f])}
    // (2026-11-14) the light map (asm-color.js asmCmLightKeys: form light, edge glow, collar shadow), when the folder has one: a lossless PNG
    if(out){const f=path.join(out,'light.png');if(fs.existsSync(f))files.push(['light',f])}
    if(out){const f=path.join(out,JEANS_FILE);if(fs.existsSync(f))files.push(['master-jeans',f,true])}   // the faded master for jeans (a JPEG like the master)
    for(const [name,f,isJpeg] of files){if(!fs.existsSync(f)){console.error('missing '+f);process.exit(2)}
      const key=cmKey(kind,name),sum=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0,16),sig=`asm/cm ${JSON.stringify({kind,name,v:ASM_CMV,sum})}`;
      if(DRY){console.log(`${kind} ${name} -> ${key} (${Math.round(fs.statSync(f).size/1024)} KB file)`);continue}
      const cur=await api('render?key='+key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
      if(cur&&cur.sig===sig){same++;dates[key]=+cur.t||0;continue}
      todo.push({kind,name,key,f,isJpeg,sig})}}
  if(DRY){await browser.close();console.log('Dry run: nothing uploaded.');return}
  // this computer's daily cap (tools/upload-budget.js): the whole batch and the manifest are reserved first, all or none, so a master is
  // never left half new (a new uv-u beside an old uv-v paints wrongly)
  const need=todo.length+1;
  if(todo.length&&!budget.take(need)){await browser.close();console.error(`${todo.length} records need uploading, but ${budget.why()} (${budget.left()} left today): nothing uploaded.`);process.exit(4)}
  for(const {kind,name,key,f,isJpeg,sig} of todo){
    const img=isJpeg?await jpeg(f):png(f);bytes+=img.length;const t=Date.now();
    const r=await api('render',{method:'PUT',body:JSON.stringify({key,rec:{sig,img,model:'colormaster',t}})});
    if(!r.ok){console.error(`${kind} ${name}: upload refused ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}
    dates[key]=t;up++;console.log(`${kind} ${name} uploaded (${Math.round(img.length/1024)} KB)`)}
  await browser.close();
  // the manifest (asm-color.js asmCmMfKey): every colour-coded record's date, merged with the one already there (a run with --kinds or
  // --bg alone keeps the other kinds' dates). Phones read it and download again what they hold older copies
  // of; it is written only when a date changed (one KV write)
  const mfKey=cmKey('all','manifest'),RE=/^asm\/cm-manifest (\{.*\})$/;
  const curMf=await api('render?key='+mfKey,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);let old={};
  // a manifest that is there but can't be read (cut off, 2026-11-16) is never replaced by this run's records alone: that dropped every
  // other kind from it; stop instead (the records above are uploaded; rerun once the manifest reads)
  let unreadable=!!(curMf&&curMf.sig);
  try{const m=curMf&&RE.exec(String(curMf.sig||''));if(m){old=JSON.parse(m[1]).keys||{};unreadable=false}}catch{}
  if(unreadable&&!process.argv.includes('--rebuild-manifest')){console.error('The manifest on the worker can\'t be read (cut off?), so it was not rewritten with this run\'s records alone. Run every kind with --rebuild-manifest to write it whole.');process.exit(5)}
  const keys={...old,...dates},changed=Object.keys(keys).some(k=>old[k]!==keys[k]);
  if(changed&&!todo.length&&!budget.take(1)){console.error(`The manifest needs writing, but ${budget.why()}.`);process.exit(4)}
  if(!changed&&todo.length)budget.give(1);   // the manifest's reserved write was not needed
  if(changed){const r=await api('render',{method:'PUT',body:JSON.stringify({key:mfKey,rec:{sig:'asm/cm-manifest '+JSON.stringify({keys}),img:MF_IMG,model:'manifest',t:Date.now()}})});
    if(!r.ok){console.error(`manifest: upload refused ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}
    // read it back: a manifest the worker cut off can't be read by phones (or by the next run)
    const back=await api('render?key='+mfKey,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null),bm=back&&RE.exec(String(back.sig||''));
    let n=-1;try{n=bm?Object.keys(JSON.parse(bm[1]).keys||{}).length:-1}catch{}
    if(n!==Object.keys(keys).length){console.error(`manifest: read back ${n<0?'unreadable':n+' records'}, expected ${Object.keys(keys).length}: the worker may have cut it off`);process.exit(5)}console.log(`manifest written (${Object.keys(keys).length} records)`)}
  // (2026-11-14) the shared list (worker/records.js cm:shared, owner-only PUT /cm-shared): exactly the render keys testers may read from the
  // owner's records: every record in the manifest, the manifest, the background and each master's 2048 copy for phones (asm-color.js
  // asmCmCopyKey, uploaded by the PC builder until it was removed on 2026-11-16; the copies already there stay listed). Written only when it changed (one KV write); the worker also skips an unchanged list
  const shared=[...new Set([...Object.keys(keys),mfKey,cmKey('all','background'),...Object.keys(ZONES).filter(k=>keys[cmKey(k,'master')]).map(k=>cmKey(k,'master2048'))])].sort();
  const curSh=await api('cm-shared',{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
  if(!(curSh&&Array.isArray(curSh.keys)&&[...curSh.keys].sort().join()===shared.join())){
    if(!budget.take(1)){console.error(`The shared list for testers needs writing, but ${budget.why()}.`);process.exit(4)}
    const r=await api('cm-shared',{method:'PUT',body:JSON.stringify({keys:shared})});
    if(!r.ok){budget.give(1);console.error(`shared list: refused ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}
    console.log(`shared list for testers written (${shared.length} records)`)}
  console.log(`${up} uploaded (${Math.round(bytes/1048576)} MB), ${same} already current.`);
  if(up||changed)console.log('Next: phones take the new files the next time they read the manifest (within a few minutes while open) and paint the looks again themselves.')})().catch(e=>{console.error(e.message||e);process.exit(1)});
