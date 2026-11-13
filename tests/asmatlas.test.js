// The master atlas (tools/asm-atlas.js, tools/atlas-measure.js, tools/atlas.js; assemble.js asmAtlas*): the painter's work for the
// master measured once on a computer and kept on the worker as three pictures, which a phone decodes instead of working it out (and
// then needs no black calibration photo); the full per-pixel atlas of both masters for work on the computer, and its reader.
const fs=require('fs'),path=require('path'),os=require('os');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();let seed;
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const url=async n=>{const d=await asmData('tests/fixtures/asm-'+n+'.jpg'),c=document.createElement('canvas');c.width=c.height=d.width;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/jpeg',.9)};
      const put=(k,img,t,sig='')=>{renders[k]={sig,img,model:'',t}},out={};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),jk=I('suit','navy'),tie=I('tie','burgundy'),navy=I('shirt','navy'),hb=I('shirt','pink',{pattern:'herringbone'});items=[watch,jk,tie,navy,hb];
      put(asmMasterKey(),await url('master'),100,asmMasterSig({watch,shirt:asmMasterItem('shirt','white')}));put(asmCalibKey('shirt'),await url('shirt-black'),200);
      put(asmPieceKey('jacket',jk),await url('jacket'),150);put(asmPieceKey('tie',tie),await url('tie'),150);
      // the zones' pictures, made here from the fixture's calibration photos (SAM's are made outside the app the same way: white = the piece)
      const M=await asmData(renders[asmMasterKey()].img),W=M.width,c={jacket:await asmData(await url('jacket')),shirt:await asmData(await url('shirt-black')),tie:await asmData(await url('tie')),watch:await asmData(await url('watch'))};
      const z=asmZones(M,c),pic=m=>{const cv=document.createElement('canvas');cv.width=cv.height=W;const x=cv.getContext('2d'),d=x.createImageData(W,W);for(let i=0;i<W*W;i++){const v=m[i]?255:0;d.data.set([v,v,v,255],4*i)}x.putImageData(d,0,0);return cv.toDataURL('image/png')};
      ASM_ZONE_SLOTS.forEach((s,i)=>put(asmZoneKey(s),pic(z[s]),300+i));
      const vm=await url('vestmaster');put(asmVestKey(),vm,500);put(asmZoneKey('vest'),pic(asmVestZone(await asmData(vm),await asmData(await url('vestcalib')),z)),510);
      // the computer's measurement, and the pictures decoded as a phone decodes them
      const A=await asmAtlasBuild(),dec=asmAtlasDecode(await asmData(A.imgs.a,W),await asmData(A.imgs.m,W),await asmData(A.imgs.c,W));
      let dA=0,dS=0,dg=0,bg=0,same=A.P.idx.length===dec.idx.length;for(let q=0;same&&q<dec.idx.length;q++){if(A.P.idx[q]!==dec.idx[q]){same=false;break}
        dA=Math.max(dA,Math.abs(A.P.A[q]-dec.A[q]));dS=Math.max(dS,Math.abs(A.P.sm[q]-dec.sm[q]),Math.abs(A.P.sc[q]-dec.sc[q]));dg=Math.max(dg,Math.abs(A.P.ang[q]-dec.ang[q]));if(A.P.bg[q]!==dec.bg[q])bg++}
      Object.assign(out,{sig:A.sig,n:A.n,same,dA,dS,dg,bg,W});
      const diff=(a,b)=>{let m=0;for(let i=0;i<a.data.length;i+=4)for(let k=0;k<3;k++)m=Math.max(m,Math.abs(a.data[i+k]-b.data[i+k]));return m};
      const T=asmTexReady(await asmTexFor(hb,colOf(hb),asmWeaveSig(hb)),colOf(hb),W);
      out.paint=[diff(asmPaint(M,null,'#1b2a4a',A.P),asmPaint(M,null,'#1b2a4a',dec)),diff(asmPaint(M,null,'#f1c4cd',A.P),asmPaint(M,null,'#f1c4cd',dec)),diff(asmPaint(M,null,colOf(hb),A.P,T),asmPaint(M,null,colOf(hb),dec,T))];
      // a phone holding the atlas and no black shirt: the job takes the atlas, and the picture is the one the black shirt gives
      ASM_ATLAS.forEach(q=>put(asmAtlasKey(q),A.imgs[q],400,A.sig));const calib=renders[asmCalibKey('shirt')];delete renders[asmCalibKey('shirt')];
      const o={top:jk,shirt:navy,tie,watch,suitDay:true};out.okNoCalib=asmAtlasOk();const job=await asmJob(o);out.job=!!(job&&job.paintAtlas&&!job.paintCalib);
      const u1=await asmPhoto(o);renders[asmCalibKey('shirt')]=calib;const keep=ASM_ATLAS.map(q=>renders[asmAtlasKey(q)]);ASM_ATLAS.forEach(q=>delete renders[asmAtlasKey(q)]);
      const job2=await asmJob(o);out.job2=!!(job2&&job2.paintCalib&&!job2.paintAtlas);const u2=await asmPhoto(o);ASM_ATLAS.forEach((q,i)=>renders[asmAtlasKey(q)]=keep[i]);
      if(u1&&u2){const a=await asmData(u1),b=await asmData(u2),zz=asmBox(z.shirt,W,3,false);let s=0,k=0;for(let i=0;i<W*W;i++)if(zz[i]){k++;s+=Math.abs(a.data[4*i+2]-b.data[4*i+2])}out.pic=s/k}else out.pic=null;
      // made from other photos: a master or a zone made again, or another black shirt than the one it holds, and the phone works it out itself
      out.okCalib=asmAtlasOk();const t0=renders[asmMasterKey()].t;renders[asmMasterKey()].t=101;out.okNewMaster=asmAtlasOk();renders[asmMasterKey()].t=t0;
      renders[asmCalibKey('shirt')]={...calib,t:201};out.okNewCalib=asmAtlasOk();renders[asmCalibKey('shirt')]=calib;
      renders[asmAtlasKey('m')]={...renders[asmAtlasKey('m')],sig:'asm/atlas/v1 {}'};out.okMixed=asmAtlasOk();renders[asmAtlasKey('m')]=keep[1];
      window.__seed=Object.fromEntries([asmMasterKey(),asmVestKey(),asmCalibKey('shirt'),...ASM_ZONE_SLOTS.map(asmZoneKey),asmZoneKey('vest')].map(k=>[k,renders[k]]));
      out.keys=ASM_ATLAS.map(asmAtlasKey);return out});
    ok(r.same&&r.n>1000,`the phones' atlas keeps every painted pixel of the master (${r.n} at ${r.W}px)`);
    ok(r.dA<=.5/255+1e-6&&r.dS<2e-5&&r.dg<.007&&r.bg===0,`decoded as a phone decodes it, its numbers are the painter's own (share within ${(r.dA*255).toFixed(2)}/255, shading within ${r.dS.toExponential(1)}, direction within ${(r.dg*180/Math.PI).toFixed(2)}°, ${r.bg} edges blending elsewhere)`);
    ok(r.paint.every(v=>v<=1),`a shirt painted from it is the one painted from the photos, to within one level (navy ${r.paint[0]}, light pink ${r.paint[1]}, pink herringbone ${r.paint[2]})`);
    ok(r.okNoCalib&&r.job&&r.job2,'a phone holding the atlas uses it and needs no black calibration photo; without it the job takes the black shirt as before');
    ok(r.pic!==null&&r.pic<.5,`the whole picture built from the atlas in the Web Worker is the one built from the black shirt (shirt ${r.pic&&r.pic.toFixed(3)} levels apart on average)`);
    ok(r.okCalib&&!r.okNewMaster&&!r.okNewCalib&&!r.okMixed,'an atlas measured from other photos (a master or black shirt made again) or a mixed set is not used');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    seed=await p.evaluate(()=>window.__seed);seed.atlasKeys=r.keys;seed.sig=r.sig;
  }finally{await browser.close()}
  // ---- the computer's script, end to end, against a worker on this machine holding those photos
  const {spawnSync,spawn}=require('child_process'),s=path.join(ROOT,'tools','asm-atlas.js');
  const h=spawnSync(process.execPath,[s,'--help'],{encoding:'utf8'}),n=spawnSync(process.execPath,[s],{encoding:'utf8',env:{...process.env,DW_WORKER:'',DW_TOKEN:''}});
  ok(h.status===0&&/npm run atlas/.test(h.stdout)&&n.status===1,'tools/asm-atlas.js explains its use, and needs DW_WORKER and DW_TOKEN');
  const {pathToFileURL}=require('url'),http=require('http'),worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  for(const k of seed.atlasKeys)store.delete('render:'+k);
  for(const [k,v] of Object.entries(seed))if(v&&v.img)store.set('render:'+k,JSON.stringify({sig:v.sig,img:v.img,model:'',t:v.t}));
  store.set('wardrobe:v1',JSON.stringify({rev:1,saved:1,data:{items:[],days:[],tombstones:{},settings:{setupDone:1,updated:1}}}));
  let puts=0;const env={APP_TOKEN:'owner-code',WARDROBE:KV};
  const srv=http.createServer(async(q,res)=>{let b='';for await(const c of q)b+=c;if(q.method==='PUT'&&/\/render/.test(q.url))puts++;
    const o=await worker.fetch(new Request('http://w'+q.url,{method:q.method,headers:q.headers,body:['GET','HEAD','OPTIONS'].includes(q.method)?undefined:b}),env);
    res.writeHead(o.status,Object.fromEntries(o.headers));res.end(Buffer.from(await o.arrayBuffer()))});
  await new Promise(x=>srv.listen(0,'127.0.0.1',x));const W=`http://127.0.0.1:${srv.address().port}/`,OUT=fs.mkdtempSync(path.join(os.tmpdir(),'dw-atlas-'));
  const run=()=>new Promise(res=>{const c=spawn(process.execPath,[s,'--out',OUT,'--origin','http://127.0.0.1:9/dw/'],{env:{...process.env,DW_WORKER:W,DW_TOKEN:'owner-code'}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
  try{const r1=await run(),p1=puts,r2=await run();
    const recs=seed.atlasKeys.map(k=>store.has('render:'+k)?JSON.parse(store.get('render:'+k)):null);
    ok(r1.code===0&&p1===3&&recs.every(x=>x&&x.sig===seed.sig&&/^data:image\/png;base64,/.test(x.img)),`npm run atlas measures the master and uploads the phones' three pictures, signed with the photos it measured (${p1} uploads${r1.code?': '+r1.out.slice(-400):''})`);
    ok(r2.code===0&&puts===p1&&/3 already current/.test(r2.out),'a second run uploads nothing: the worker already has this atlas');
    const A=require(path.join(ROOT,'tools','atlas.js')).open(OUT),man=A.manifest;
    const shirt=A.part('suit','shirt'),pl=A.layer('suit','part'),cv=A.layer('suit','cover'),SW=A.W('suit');let k0=-1;for(let k=0;k<pl.length;k++)if(pl[k]===6&&cv[k]===255&&A.layer('suit','edge')[k]>=4){k0=k;break}
    const px=A.pixel('suit',k0%SW,Math.floor(k0/SW));
    ok(man.masters.suit&&man.masters.vest&&Object.keys(man.masters.suit.layers).length===11&&fs.existsSync(path.join(OUT,'suit','preview-part.png'))&&fs.existsSync(path.join(OUT,'phone','paint-a.png')),
      `the full atlas has both masters, 11 layers each, pictures to look at and the phones' share (${Object.keys(man.masters).join(', ')})`);
    ok(shirt&&shirt.pixels>1000&&A.part('suit','tie')&&A.part('suit','jacket')&&A.part('vest','waistcoat')&&A.part('suit','skin'),`the parts are measured: ${man.masters.suit.parts.map(q=>q.name+' '+q.pixels).join(', ')}; the waistcoat master's waistcoat ${A.part('vest','waistcoat')&&A.part('vest','waistcoat').pixels}`);
    ok(px.partName==='shirt'&&px.rgb.length===3&&px.lab[0]>50&&px.shade>.3&&px.black>0&&px.thread===0&&px.cover>0,`a pixel of the shirt reads back every property (${JSON.stringify(px).slice(0,240)})`);
    const cuff=A.part('suit','cuffL')||A.part('suit','cuffR');
    ok(!cuff||Math.abs(cuff.thread)>30,`a cuff's weave runs along the arm (${cuff?cuff.name+' '+cuff.thread+'°':'no cuff found'})`);
    const cli=spawnSync(process.execPath,[path.join(ROOT,'tools','atlas.js'),OUT,'pixel','suit','10','10'],{encoding:'utf8'});
    ok(cli.status===0&&/"partName"/.test(cli.stdout),'node tools/atlas.js <folder> pixel suit x y prints a pixel');
  }finally{srv.close();fs.rmSync(OUT,{recursive:true,force:true})}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
