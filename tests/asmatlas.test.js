// The master atlas (tools/asm-atlas.js, tools/atlas-measure.js, tools/atlas.js): the full per-pixel atlas of the earlier assembler's two
// masters and of each colour-coded master on the worker, for work on the computer, and its reader. Nothing is uploaded (the phones'
// share, which the earlier assembler's shirt painter read, went with it on 2026-11-14). The earlier masters' zone pictures are fixtures
// (tests/fixtures/asm-zone-*.png, made from the calibration photos the way SAM's were: white = the piece).
const fs=require('fs'),path=require('path'),os=require('os');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();let seed;
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const F=(n,type='jpeg')=>`data:image/${type};base64,`+fs.readFileSync(path.join(ROOT,'tests','fixtures',n)).toString('base64');
    const keys=await p.evaluate(()=>({master:asmMasterKey(),vest:asmVestKey(),calib:asmCalibKey('shirt'),zones:ASM_ZONE_SLOTS.map(s=>[s,asmZoneKey(s)]),zvest:asmZoneKey('vest'),gone:typeof asmAtlasBuild==='undefined'&&typeof asmGetAtlas==='undefined'}));
    ok(keys.gone,'the phones\' share of the atlas (asmAtlasBuild, asmGetAtlas) is gone with the earlier assembler');
    seed={[keys.master]:{sig:'asm/master {}',img:F('asm-master.jpg'),t:100},[keys.calib]:{sig:'',img:F('asm-shirt-black.jpg'),t:200},[keys.vest]:{sig:'',img:F('asm-vestmaster.jpg'),t:500},
      [keys.zvest]:{sig:'',img:F('asm-zone-vest.png','png'),t:510}};
    keys.zones.forEach(([s,k],i)=>seed[k]={sig:'',img:F('asm-zone-'+s+'.png','png'),t:300+i});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // the colour-coded suit master (tests/fixtures/cm/suit, 512), under the keys the app asks the worker for
    const FIX=path.join(__dirname,'fixtures','cm','suit'),files=fs.readdirSync(FIX),names=files.map(f=>f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'));
    const ck=await p.evaluate(ns=>ns.map(n=>asmCmKey('suit',n)),names);
    files.forEach((f,i)=>{seed[ck[i]]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),t:1000}});
  }finally{await browser.close()}
  // ---- the computer's script, end to end, against a worker on this machine holding those photos
  const {spawnSync,spawn}=require('child_process'),s=path.join(ROOT,'tools','asm-atlas.js');
  const h=spawnSync(process.execPath,[s,'--help'],{encoding:'utf8'}),n=spawnSync(process.execPath,[s],{encoding:'utf8',env:{...process.env,DW_WORKER:'',DW_TOKEN:''}});
  ok(h.status===0&&/npm run atlas/.test(h.stdout)&&n.status===1,'tools/asm-atlas.js explains its use, and needs DW_WORKER and DW_TOKEN');
  const {pathToFileURL}=require('url'),http=require('http'),worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  for(const [k,v] of Object.entries(seed))if(v&&v.img)store.set('render:'+k,JSON.stringify({sig:v.sig,img:v.img,model:'',t:v.t}));
  store.set('wardrobe:v1',JSON.stringify({rev:1,saved:1,data:{items:[],days:[],tombstones:{},settings:{setupDone:1,updated:1}}}));
  let puts=0;const env={APP_TOKEN:'owner-code',WARDROBE:KV};
  const srv=http.createServer(async(q,res)=>{let b='';for await(const c of q)b+=c;if(q.method==='PUT'&&/\/render/.test(q.url))puts++;
    const o=await worker.fetch(new Request('http://w'+q.url,{method:q.method,headers:q.headers,body:['GET','HEAD','OPTIONS'].includes(q.method)?undefined:b}),env);
    res.writeHead(o.status,Object.fromEntries(o.headers));res.end(Buffer.from(await o.arrayBuffer()))});
  await new Promise(x=>srv.listen(0,'127.0.0.1',x));const W=`http://127.0.0.1:${srv.address().port}/`,OUT=fs.mkdtempSync(path.join(os.tmpdir(),'dw-atlas-'));
  const run=()=>new Promise(res=>{const c=spawn(process.execPath,[s,'--out',OUT,'--origin','http://127.0.0.1:9/dw/','--cm-size','512'],{env:{...process.env,DW_WORKER:W,DW_TOKEN:'owner-code',DW_UPLOAD_LEDGER:require('path').join(require('os').tmpdir(),'dw-ledger-test-'+process.pid+'.json')}});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
  try{const r1=await run();
    ok(r1.code===0&&puts===0,`npm run atlas measures the masters and uploads nothing (${puts} uploads${r1.code?': '+r1.out.slice(-400):''})`);
    const A=require(path.join(ROOT,'tools','atlas.js')).open(OUT),man=A.manifest;
    const shirt=A.part('suit','shirt'),pl=A.layer('suit','part'),cv=A.layer('suit','cover'),SW=A.W('suit');let k0=-1;for(let k=0;k<pl.length;k++)if(pl[k]===6&&cv[k]===255&&A.layer('suit','edge')[k]>=4){k0=k;break}
    const px=A.pixel('suit',k0%SW,Math.floor(k0/SW));
    ok(man.masters.suit&&man.masters.vest&&Object.keys(man.masters.suit.layers).length===11&&fs.existsSync(path.join(OUT,'suit','preview-part.png'))&&!fs.existsSync(path.join(OUT,'phone'))&&!man.phone,
      `the full atlas has both masters, 11 layers each, and pictures to look at (${Object.keys(man.masters).join(', ')})`);
    ok(shirt&&shirt.pixels>1000&&A.part('suit','tie')&&A.part('suit','jacket')&&A.part('vest','waistcoat')&&A.part('suit','skin'),`the parts are measured: ${man.masters.suit.parts.map(q=>q.name+' '+q.pixels).join(', ')}; the waistcoat master's waistcoat ${A.part('vest','waistcoat')&&A.part('vest','waistcoat').pixels}`);
    ok(px.partName==='shirt'&&px.rgb.length===3&&px.lab[0]>50&&px.shade>.3&&px.black>0&&px.thread===0&&px.cover>0,`a pixel of the shirt reads back every property (${JSON.stringify(px).slice(0,240)})`);
    const cuff=A.part('suit','cuffL')||A.part('suit','cuffR');
    ok(!cuff||Math.abs(cuff.thread)>30,`a cuff's weave runs along the arm (${cuff?cuff.name+' '+cuff.thread+'°':'no cuff found'})`);
    // the colour-coded master on the worker is measured too (the other three kinds are not there: skipped)
    const cm=man.masters['cm-suit'],cp=n=>A.part('cm-suit',n);
    ok(cm&&cm.colourCoded&&Object.keys(cm.layers).length===11&&cm.layers.next&&!cm.layers.black&&!man.masters['cm-vest']&&/shirt-tie master: not on the worker/.test(r1.out)&&fs.existsSync(path.join(OUT,'cm-suit','preview-part.png')),
      `the colour-coded suit master is measured (11 layers, with next and no black shirt), the kinds the worker lacks are skipped (${Object.keys(man.masters).join(', ')})`);
    ok(cp('jacket')&&cp('sleeveL')&&cp('sleeveR')&&cp('lapelL')&&cp('lapelR')&&cp('tie')&&cp('shirt')&&cp('skin')&&cp('watch')&&(cp('cuffL')||cp('cuffR')),`its parts, sleeves, lapels and cuffs from the painter: ${cm&&cm.parts.map(q=>q.name+' '+q.pixels).join(', ')}`);
    ok(cm&&cm.geometry&&cm.geometry.garment==='jacket'&&cm.geometry.sleeves===2&&cm.geometry.tie&&cm.zones.shirt&&cm.zones.shirt.litPct===90&&cm.zones.jacket.painted&&!cm.zones.skin.painted,`the painter's geometry and each zone's lit level are kept (${JSON.stringify(cm&&cm.geometry)})`);
    {const pl=A.layer('cm-suit','part'),cv=A.layer('cm-suit','cover'),W2=A.W('cm-suit');let k1=-1,k2=-1;for(let k=0;k<pl.length;k++){if(k1<0&&pl[k]===9&&cv[k]===255)k1=k;if(k2<0&&cv[k]>60&&cv[k]<190)k2=k}
      const a=A.pixel('cm-suit',k1%W2,Math.floor(k1/W2)),b=A.pixel('cm-suit',k2%W2,Math.floor(k2/W2));
      ok(a.partName==='tie'&&a.cover===1&&a.next[1]===0&&a.shade>0&&a.shade<=1.6&&b.next[1]>0&&b.nextName&&b.nextName!==b.partName,`a pixel inside the tie and one on a zone's soft edge read back (${a.partName} ${a.shade}; edge ${b.partName} ${b.cover} next ${b.nextName} ${b.next[1]})`)}
    // as the painter (ASM_CM_RIM): no body pixel is left between a sleeve and the wall
    {const pl=A.layer('cm-suit','part'),W2=A.W('cm-suit'),sl=new Set([4,5]);let left=0,sleeveEdge=0;
      for(let k=W2;k<pl.length-W2;k++){const x=k%W2;if(x<1||x>W2-2)continue;const nb=[pl[k-1],pl[k+1],pl[k-W2],pl[k+W2]];
        if(pl[k]===1&&nb.includes(0)&&nb.some(v=>sl.has(v)))left++;if(sl.has(pl[k])&&nb.includes(0))sleeveEdge++}
      // (without it: 255 and 5 on the 512 fixture; a few stay where the body, a sleeve and the wall meet at the shoulder)
      ok(left<20&&sleeveEdge>500,`the sleeves reach the wall, as the painter paints them (${left} body pixels between a sleeve and the wall; ${sleeveEdge} sleeve pixels on the wall)`)}
    const cli=spawnSync(process.execPath,[path.join(ROOT,'tools','atlas.js'),OUT,'pixel','suit','10','10'],{encoding:'utf8'});
    ok(cli.status===0&&/"partName"/.test(cli.stdout),'node tools/atlas.js <folder> pixel suit x y prints a pixel');
  }finally{srv.close();fs.rmSync(OUT,{recursive:true,force:true})}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
