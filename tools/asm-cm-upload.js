// The colour-coded masters onto the worker (asm-color.js): for each kind, the master (2880, as a JPEG), its zone masks (2048 PNGs) and
// its sleeve and lapel masks, as photo records under the keys the app asks for (asmCmKey). A record already there with the same
// signature is left alone (no KV write).
//
//   DW_WORKER=https://<worker>.workers.dev DW_TOKEN=<owner code> npm run cm-upload -- --dir <colormaster folder> [--dry] [--kinds suit,vest]
//
//   --dir    the folder colormaster.js writes: out-<kind>\colormaster-2880.png, alpha-<zone>.png, sleeve-sleeve?.png, lapel-lapel?.png
//   --dry    say what would go up, upload nothing
// The token is read from the environment only.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const DRY=process.argv.includes('--dry'),DIR=arg('dir','');
const ORIGIN=String(arg('origin','https://marshalneubauer.github.io/DailyWardrobe/')).replace(/\/?$/,'/');
const WORKER=String(process.env.DW_WORKER||'').replace(/\/?$/,'/'),TOKEN=process.env.DW_TOKEN||'';
if(!DIR||!fs.existsSync(DIR)||(!DRY&&(!WORKER.startsWith('http')||!TOKEN))){
  console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> npm run cm-upload -- --dir <colormaster folder> [--dry] [--kinds suit,vest]');process.exit(1)}
// the app's keys: asmKey = 'c' + fnv64('asm/' + ASM_VER + '/' + t) (app.js fnv64, assemble.js ASM_VER), asmCmKey = asmKey('cm' + ASM_CMV + '/' + kind + '/' + name)
const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const ASM_VER=+/const ASM_VER=(\d+)/.exec(src('assemble.js'))[1],ASM_CMV=+/const ASM_CMV=(\d+)/.exec(src('asm-color.js'))[1];
const fnv64=t=>{let h=0xcbf29ce484222325n;for(const c of Buffer.from(t,'utf8')){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}return h.toString(16).padStart(16,'0')};
const cmKey=(kind,name)=>'c'+fnv64('asm/'+ASM_VER+'/cm'+ASM_CMV+'/'+kind+'/'+name);
const ZONES={suit:['jacket','tie','background','skin','shirt','dark','watch'],vest:['jacket','waistcoat','tie','background','skin','shirt','dark','watch'],
  'shirt-tie':['trousers','belt','tie','buckle','background','skin','shirt','dark','watch'],'shirt-open':['trousers','belt','buckle','background','skin','shirt','dark','watch']};
const KINDS=String(arg('kinds',Object.keys(ZONES).join(','))).split(',');
const api=(p,opt={})=>fetch(new URL(p,WORKER).href,{...opt,headers:{'x-app-token':TOKEN,'content-type':'application/json',origin:new URL(ORIGIN).origin,...(opt.headers||{})}});
(async()=>{
  const {chromium}=require('playwright');const browser=await chromium.launch(),page=await browser.newPage();
  const jpeg=async f=>page.evaluate(async u=>{const i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=u});const c=new OffscreenCanvas(i.width,i.height);c.getContext('2d').drawImage(i,0,0);
    const b=await c.convertToBlob({type:'image/jpeg',quality:.93});return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)})},'data:image/png;base64,'+fs.readFileSync(f).toString('base64'));
  const png=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
  let up=0,same=0,bytes=0;
  for(const kind of KINDS){const out=path.join(DIR,'out-'+kind);if(!fs.existsSync(out)){console.error('missing '+out);process.exit(2)}
    const files=[['master',path.join(out,'colormaster-2880.png'),true],...ZONES[kind].map(z=>['mask/'+z,path.join(out,'alpha-'+z+'.png')]),
      ...['sleeveR','sleeveL'].map(s=>['part/'+s,path.join(out,'sleeve-'+s+'.png')]),...(kind==='suit'||kind==='vest'?['lapelR','lapelL'].map(s=>['part/'+s,path.join(out,'lapel-'+s+'.png')]):[])];
    for(const [name,f,isJpeg] of files){if(!fs.existsSync(f)){console.error('missing '+f);process.exit(2)}
      const key=cmKey(kind,name),sum=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0,16),sig=`asm/cm ${JSON.stringify({kind,name,v:ASM_CMV,sum})}`;
      if(DRY){console.log(`${kind} ${name} -> ${key} (${Math.round(fs.statSync(f).size/1024)} KB file)`);continue}
      const cur=await api('render?key='+key,{cache:'no-store'}).then(x=>x.ok?x.json():null).catch(()=>null);
      if(cur&&cur.sig===sig){same++;continue}
      const img=isJpeg?await jpeg(f):png(f);bytes+=img.length;
      const r=await api('render',{method:'PUT',body:JSON.stringify({key,rec:{sig,img,model:'colormaster',t:Date.now()}})});
      if(!r.ok){console.error(`${kind} ${name}: upload refused ${r.status} ${await r.text().catch(()=>'')}`);process.exit(3)}
      up++;console.log(`${kind} ${name} uploaded (${Math.round(img.length/1024)} KB)`)}}
  await browser.close();console.log(DRY?'Dry run: nothing uploaded.':`${up} uploaded (${Math.round(bytes/1048576)} MB), ${same} already current.`)})().catch(e=>{console.error(e.message||e);process.exit(1)});
