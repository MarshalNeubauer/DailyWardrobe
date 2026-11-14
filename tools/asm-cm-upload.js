// The colour-coded masters onto the worker (asm-color.js): for each kind, the master (2880, as a JPEG), its zone masks (2048 PNGs) and
// its sleeve and lapel masks, as photo records under the keys the app asks for (asmCmKey). A record already there with the same
// signature is left alone (no KV write). Then it writes the manifest (asm-color.js asmCmMfKey: every record's date), so a device that
// holds an older copy of a re-uploaded file downloads it again and the looks painted from it are painted again. Run it after any
// master, mask, part or the background is made again (and once to write the first manifest).
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run cm-upload -- --dir <colormaster folder> [--dry] [--kinds suit,vest]
//
//   --dir    the folder colormaster.js writes: out-<kind>\colormaster-2880.png, alpha-<zone>.png, sleeve-sleeve?.png, lapel-lapel?.png, and
//            when there, uv-u.png and uv-v.png (the solved cloth positions, geo3d\flatten)
//   --dry    say what would go up, upload nothing
//   --bg <file>  the background behind every master (asm-color.js asmCmBgKey: an empty, out-of-focus room, square), as a JPEG; with --bg alone
//                only the background goes up
// The token is read from the environment only.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
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
const ASM_LAPELS=new Set(['suit','vest','suit-open','vest-open']),OPTIONAL=new Set(['suit-open','vest-open']);
const KINDS=DIR?String(arg('kinds',Object.keys(ZONES).filter(k=>!OPTIONAL.has(k)||fs.existsSync(path.join(DIR,'out-'+k))).join(','))).split(','):[];
const MF_IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';   // (the worker keeps photo records only: the manifest carries a 1x1 picture)
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});
(async()=>{
  const {chromium}=require('playwright');const browser=await chromium.launch(),page=await browser.newPage();
  const jpeg=async f=>page.evaluate(async u=>{const i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=u});const c=new OffscreenCanvas(i.width,i.height);c.getContext('2d').drawImage(i,0,0);
    const b=await c.convertToBlob({type:'image/jpeg',quality:.93});return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)})},'data:image/'+(/\.jpe?g$/i.test(f)?'jpeg':/\.webp$/i.test(f)?'webp':'png')+';base64,'+fs.readFileSync(f).toString('base64'));
  const png=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
  let up=0,same=0,bytes=0;const dates={};   // key -> the record's date on the worker, for the manifest
  const groups=KINDS.map(kind=>[kind,path.join(DIR,'out-'+kind)]);if(BG)groups.push(['all',null]);
  for(const [kind,out] of groups){if(out&&!fs.existsSync(out)){console.error('missing '+out);process.exit(2)}
    const files=kind==='all'?[['background',BG,true]]:[['master',path.join(out,'colormaster-2880.png'),true],...ZONES[kind].map(z=>['mask/'+z,path.join(out,'alpha-'+z+'.png')]),
      ...['sleeveR','sleeveL'].map(s=>['part/'+s,path.join(out,'sleeve-'+s+'.png')]),...(ASM_LAPELS.has(kind)?['lapelR','lapelL'].map(s=>['part/'+s,path.join(out,'lapel-'+s+'.png')]):[])];
    // the solved cloth positions (asm-color.js asmGeoPrep: geo3d/flatten), when the folder has them: lossless PNGs, never re-encoded
    if(out)for(const c of ['u','v']){const f=path.join(out,'uv-'+c+'.png');if(fs.existsSync(f))files.push(['geo/'+c,f])}
    for(const [name,f,isJpeg] of files){if(!fs.existsSync(f)){console.error('missing '+f);process.exit(2)}
      const key=cmKey(kind,name),sum=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0,16),sig=`asm/cm ${JSON.stringify({kind,name,v:ASM_CMV,sum})}`;
      if(DRY){console.log(`${kind} ${name} -> ${key} (${Math.round(fs.statSync(f).size/1024)} KB file)`);continue}
      const cur=await api('render?key='+key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
      if(cur&&cur.sig===sig){same++;dates[key]=+cur.t||0;continue}
      const img=isJpeg?await jpeg(f):png(f);bytes+=img.length;const t=Date.now();
      const r=await api('render',{method:'PUT',body:JSON.stringify({key,rec:{sig,img,model:'colormaster',t}})});
      if(!r.ok){console.error(`${kind} ${name}: upload refused ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}
      dates[key]=t;up++;console.log(`${kind} ${name} uploaded (${Math.round(img.length/1024)} KB)`)}}
  await browser.close();
  if(DRY){console.log('Dry run: nothing uploaded.');return}
  // the manifest (asm-color.js asmCmMfKey): every colour-coded record's date, merged with the one already there (a run with --kinds or
  // --bg alone keeps the other kinds' dates). Phones and the computer's pre-build read it and download again what they hold older copies
  // of; it is written only when a date changed (one KV write)
  const mfKey=cmKey('all','manifest'),RE=/^asm\/cm-manifest (\{.*\})$/;
  const curMf=await api('render?key='+mfKey,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);let old={};
  try{const m=curMf&&RE.exec(String(curMf.sig||''));if(m)old=JSON.parse(m[1]).keys||{}}catch{}
  const keys={...old,...dates},changed=Object.keys(keys).some(k=>old[k]!==keys[k]);
  if(changed){const r=await api('render',{method:'PUT',body:JSON.stringify({key:mfKey,rec:{sig:'asm/cm-manifest '+JSON.stringify({keys}),img:MF_IMG,model:'manifest',t:Date.now()}})});
    if(!r.ok){console.error(`manifest: upload refused ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}console.log(`manifest written (${Object.keys(keys).length} records)`)}
  console.log(`${up} uploaded (${Math.round(bytes/1048576)} MB), ${same} already current.`);
  if(up||changed)console.log('Next: phones take the new files the next time they read the manifest (within a few minutes while open). The PC watcher (C:\\code\\assemble-watch.ps1) repaints every look within a few minutes; without it, run npm run assemble.')})().catch(e=>{console.error(e.message||e);process.exit(1)});
