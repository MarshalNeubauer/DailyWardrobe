// Assembled pictures from colour-coded masters (asm-color.js): which master an outfit is painted on (by the day's dress), the masters and
// masks downloaded from the worker, the picture painted in the Web Worker, its key following the cloth, the earlier way kept when the
// worker has no colour-coded master, the switch in Settings, the dress code in asmNeeds, and the upload script's keys.
// Fixtures: the suit and shirt-and-tie masters and their masks at 512 (tests/fixtures/cm/<kind>/).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/',FIX=path.join(__dirname,'fixtures','cm');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const asked=[];let served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');if(k)asked.push(k);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the fixtures as worker records, under the keys the app asks for
    const recs={};for(const kind of ['suit','shirt-tie']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
      recs[kind+'|'+n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(d,f)).toString('base64'),model:'colormaster',t:1000}}}
    const keys=await p.evaluate(rs=>{const o={};for(const k of Object.keys(rs)){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.fromEntries(Object.keys(recs).map(k=>[k,1])));
    for(const [k,r] of Object.entries(recs))served[keys[k]]=r;
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const W={watch:I('watch','silver',{metal:'silver'}),suit:I('suit','navy'),shirt:I('shirt','pink'),shirt2:I('shirt','lightblue'),tie:I('tie','burgundy'),pants:I('pants','khaki'),belt:I('belt','brown',{leather:'calf'}),shoes:I('shoes','brown',{leather:'calf'})};
      items=Object.values(W);window.__W=W},HOST);
    // which master, by the day's dress
    const kinds=await p.evaluate(()=>{const W=__W,o={shirt:W.shirt,watch:W.watch};
      return [asmCmKind({...o,top:W.suit,tie:W.tie}),asmCmKind({...o,top:W.suit,tie:W.tie,vest:true}),asmCmKind({...o,top:W.suit}),asmCmKind({...o,bot:W.pants,belt:W.belt,tie:W.tie}),
        asmCmKind({...o,bot:W.pants,belt:W.belt}),asmCmKind({...o,bot:W.pants,tie:W.tie}),asmCmKind({top:W.suit,tie:W.tie})].map(String).join()});
    ok(kinds==='suit,vest,suit-open,shirt-tie,shirt-open,null,null',`a jacket and tie: the suit master (the waistcoat master on a waistcoat day); no jacket: shirt and tie, or open collar; a jacket without a tie: the open-collar jacket master; no belt or no shirt: none (${kinds})`);
    // a no-jacket day, painted: the master and masks come from the worker, the picture is made in the Web Worker and kept
    const a=await p.evaluate(async()=>{const W=__W,o={shirt:W.shirt,watch:W.watch,bot:W.pants,belt:W.belt,tie:W.tie,shoes:W.shoes};
      const before={use:asmCmUse(o),can:asmCan(o)};await asmEnsure(o);before.after=asmCmUse(o);const f=asmFor(o),k=asmOutKey(o);
      // a pixel in the middle of the shirt, left of the tie: pink, as the shirt
      let px=null;if(f){const im=new Image();await new Promise(r=>{im.onload=r;im.src=f.img});const c=document.createElement('canvas');c.width=c.height=im.width;const x=c.getContext('2d');x.drawImage(im,0,0);px=[...x.getImageData(Math.round(im.width*.36),Math.round(im.width*.34),1,1).data].slice(0,3)}
      const o2={...o,shirt:W.shirt2};return {before,img:f&&f.img.slice(0,23),w:f&&(await new Promise(r=>{const im=new Image();im.onload=()=>r(im.width);im.src=f.img})),px,k,k2:asmOutKey(o2),kept:!!(await metaGet('asm:out:'+k)),
        offPage:asmOffPage(),pending:asmPending(o),parts:asmPhotoParts(o).length}});
    ok(a.before.use===null&&a.before.after==='shirt-tie'&&a.before.can===false&&a.img==='data:image/jpeg;base64,'&&a.kept,`a shirt-and-tie day (which the earlier assembler can't make): its master is looked for, then the day is painted on it and kept (${JSON.stringify(a.before)})`);
    ok(a.w===512&&a.offPage,`painted in the Web Worker at the job's size (${a.w} px)`);
    ok(a.px&&a.px[0]>a.px[2]+15&&a.px[0]>150,`the shirt comes out pink (${a.px})`);
    ok(a.k!==a.k2&&a.parts===0&&a.pending===false,'another shirt colour is another picture; nothing is photographed or queued for it');
    const want=Object.keys(recs).filter(k=>k.startsWith('shirt-tie|')).map(k=>keys[k]);
    ok(want.every(k=>asked.includes(k))&&!Object.keys(recs).filter(k=>k.startsWith('suit|')).some(k=>asked.includes(keys[k])),`it downloads that master's ${want.length} records, and not another master's`);
    // a suit day with a waistcoat: no colour-coded waistcoat master on this worker, so the earlier way (no master there either): nothing
    const v=await p.evaluate(async()=>{const W=__W,o={shirt:W.shirt,watch:W.watch,top:W.suit,tie:W.tie,vest:true};await asmEnsure(o);return {use:asmCmUse(o),for:!!asmFor(o),wants:asmWants(o),earlier:asmWants0(o)}});
    ok(v.use===null&&!v.for&&!v.wants,`a kind whose master the worker lacks falls back to the earlier way (${JSON.stringify(v)})`);
    // a suit day: painted on the suit master (the jacket's sleeves and lapels from their masks)
    const s=await p.evaluate(async()=>{const W=__W,o={shirt:W.shirt,watch:W.watch,top:W.suit,tie:W.tie};await asmEnsure(o);const f=asmFor(o);return {use:asmCmUse(o),img:f&&f.img.length}});
    ok(s.use==='suit'&&s.img>10000,`a suit day is painted on the suit master (${JSON.stringify(s)})`);
    // a master's setup kept packed (asmCmPack, the phone's disk cache): read back, it paints the very same picture
    const pk=await p.evaluate(async()=>{const W=__W,o={shirt:W.shirt,watch:W.watch,top:W.suit,tie:W.tie},job=await asmCmJob(o);
      const P=await asmCmPrep(job),pack=await asmCmPack(P),Q=await asmCmUnpack(pack,job);const k0=job.cm+'|'+job.mk+'|'+job.mt+'|'+job.size;
      asmCmMem={list:[{key:k0,P}]};const a=await asmCmBuild({...job,diskCache:false});asmCmMem={list:[{key:k0,P:Q}]};const b=await asmCmBuild({...job,diskCache:false});
      let raw=0;const walk=x=>{if(ArrayBuffer.isView(x)){raw+=x.byteLength;return}if(x&&typeof x==='object')for(const v of Object.values(x))walk(v)};walk({...P,M:null});
      return {same:a.url===b.url,gz:pack&&pack.gz.byteLength,raw,M:Q&&Q.M.length===P.M.length}});
    ok(pk.same&&pk.M&&pk.gz<pk.raw/5,`a master's setup packed (${(pk.raw/1024|0)} KB -> ${(pk.gz/1024|0)} KB gzipped) and read back paints the identical picture`);
    // the cloth look (ASM_CM_LOOK): a black suit is no longer a flat silhouette (lifted, with more variation: folds, sheen, weave); a navy
    // keeps its blue; job.look false paints as before
    const lk=await p.evaluate(async()=>{const W=__W,px=async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height).data};
      const run=async(col,look)=>{const o={shirt:W.shirt,watch:W.watch,top:{...W.suit,id:'lk-'+col,primaryColor:col},tie:W.tie},job=await asmCmJob(o);return px((await asmCmBuild({...job,look,diskCache:false})).url)};
      const b0=await run('black',false),b1=await run('black'),n1=await run('navy');const idx=[];
      for(let k=0;k<b0.length;k+=4)if(b0[k]+b0[k+1]+b0[k+2]<3*40&&Math.abs(b0[k]-b0[k+2])<8)idx.push(k);   // the black jacket's pixels, painted as before
      const st=d=>{let s=0,s2=0;for(const k of idx){const v=(d[k]+d[k+1]+d[k+2])/3;s+=v;s2+=v*v}const m=s/idx.length;return {m,sd:Math.sqrt(s2/idx.length-m*m)}};
      let nb=0;for(const k of idx)nb+=n1[k+2]-n1[k];
      // a lighter cloth keeps its colour (only its folds' lighting changes); a pinstripe is painted exactly as before
      const runI=async(top,look)=>{const o={shirt:W.shirt,watch:W.watch,top,tie:W.tie},job=await asmCmJob(o);return px((await asmCmBuild({...job,look,diskCache:false})).url)};
      const grey={...W.suit,id:'lk-grey',primaryColor:'grey'},pin={...W.suit,id:'lk-pin',primaryColor:'navy',pattern:'pinstripe',sett:{v:2,a:0,bands:[['#1b2a4a',.95],['#c8cbd2',.05]],tr:30}};
      const g0=await runI(grey,false),g1=await runI(grey),p0=await runI(pin,false),p1=await runI(pin);let pd=0;for(const k of idx)pd+=Math.abs(p1[k]-p0[k])+Math.abs(p1[k+1]-p0[k+1])+Math.abs(p1[k+2]-p0[k+2]);
      return {n:idx.length,before:st(b0),after:st(b1),blue:nb/idx.length,grey0:st(g0),grey1:st(g1),pin:pd/idx.length/3}});
    ok(lk.n>1000&&lk.after.m>lk.before.m+4&&lk.after.sd>lk.before.sd*1.3,`a black suit is lifted and shows its folds and sheen (mean ${lk.before.m.toFixed(1)} -> ${lk.after.m.toFixed(1)}, spread ${lk.before.sd.toFixed(1)} -> ${lk.after.sd.toFixed(1)})`);
    ok(lk.blue>12,`a navy suit stays blue under the look (blue over red ${lk.blue.toFixed(1)})`);
    ok(Math.abs(lk.grey1.m-lk.grey0.m)<4&&lk.grey1.sd>lk.grey0.sd,`a grey suit keeps its colour and gains shape (mean ${lk.grey0.m.toFixed(1)} -> ${lk.grey1.m.toFixed(1)}, spread ${lk.grey0.sd.toFixed(1)} -> ${lk.grey1.sd.toFixed(1)})`);
    ok(lk.pin<.5,`a pinstripe jacket is painted exactly as before (mean difference ${lk.pin.toFixed(2)} levels)`);
    // the shirt's buttons are drawn (ASM_CM_BTN): on a pink shirt a pearl button where the painted cloth was pink
    const bt=await p.evaluate(async()=>{const W=__W,o={shirt:W.shirt,watch:W.watch,bot:W.pants,belt:W.belt,tie:W.tie,shoes:W.shoes},job=await asmCmJob(o);
      const px=async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return {w:im.width,d:x.getImageData(0,0,im.width,im.height).data}};
      const a=await px((await asmCmBuild({...job,look:false,diskCache:false})).url),b=await px((await asmCmBuild({...job,diskCache:false})).url),[bx,by]=ASM_CM_BTN['shirt-tie'][0],f=a.w/2048;
      const at=(im,dx,dy)=>{const j=4*(Math.round(by*f+dy)*im.w+Math.round(bx*f+dx));return [im.d[j],im.d[j+1],im.d[j+2]]};
      // the button's rim, a little up and left of its centre (its holes are in the middle)
      return {before:at(a,-1,-1),after:at(b,-1,-1)}});
    ok(bt.after[0]-bt.after[2]<bt.before[0]-bt.before[2]-8&&bt.after[1]>bt.before[1],`a pink shirt's cuff button is drawn pearl, not pink (${bt.before} -> ${bt.after})`);
    // every shirt's buttons are white tinted with its colour (the owner, 2026-11-13: on a coloured shirt they were the cloth's own colour)
    const tb=await p.evaluate(()=>{const lin=h=>[1,3,5].map(i=>ASM_LIN[parseInt(h.slice(i,i+2),16)]),L=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
      return ['#1f2a44','#3a6fc4','#f4f4f2'].map(h=>{const s=lin(h),b=asmCmBtnCol(s);return {L:L(b),blue:b[2]-b[0],sb:s[2]-s[0]}})});
    ok(tb.every(x=>x.L>.6)&&tb[0].blue>.05&&tb[1].blue>.05&&Math.abs(tb[2].blue-(-.06*.85))<.02,`a navy, blue or white shirt's buttons are white, tinted toward the shirt (${tb.map(x=>x.L.toFixed(2)+'/'+x.blue.toFixed(3)).join(', ')})`);
    // the hand's outline follows the master's colour: white shirt pixels the skin mask took go to the shirt, skin the shirt mask took to the skin
    const he=await p.evaluate(()=>{const S=8,N=64,A={skin:new Uint8Array(N),shirt:new Uint8Array(N)},M=new Uint8ClampedArray(4*N);
      for(let k=0;k<N;k++){const x=k%S,sk=x<4;A.skin[k]=sk?255:0;A.shirt[k]=sk?0:255;const white=x<2||x>=6?false:x===2||x===3;M.set(white?[245,244,240,255]:x<2?[200,150,120,255]:[246,245,242,255],4*k)}
      // columns 0-1 skin-coloured, 2-3 white but in the skin mask, 4-7 white shirt
      asmCmHandEdge(A,M,S,N);return {wasSkinWhite:A.shirt[2],realSkin:A.skin[0]}});
    ok(he.wasSkinWhite===255&&he.realSkin===255,`white shirt between the fingers goes to the shirt, the skin stays skin (${JSON.stringify(he)})`);
    // the background picture (asmCmBgKey): once the worker has one, the wall is that picture (here a flat green), and every look's key changes
    const bgKey=await p.evaluate(()=>asmCmBgKey());
    served[bgKey]={sig:'asm/cm bg',model:'colormaster',t:2000,img:await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#2f7a3a';x.fillRect(0,0,64,64);return c.toDataURL('image/png')})};
    const bg=await p.evaluate(async k=>{const W=__W,o={shirt:W.shirt2,watch:W.watch,top:W.suit,tie:W.tie};const k0=asmOutKey(o);asmTried.delete(k);
      await asmCmLook(o);const k1=asmOutKey(o);await asmEnsure(o);const f=asmFor(o);let px=null;
      if(f){const im=new Image();await new Promise(r=>{im.onload=r;im.src=f.img});const c=document.createElement('canvas');c.width=c.height=im.width;const x=c.getContext('2d');x.drawImage(im,0,0);px=[...x.getImageData(3,3,1,1).data].slice(0,3)}
      return {held:!!renders[k],changed:k0!==k1,px}},bgKey);
    ok(bg.held&&bg.changed&&bg.px&&bg.px[1]>bg.px[0]+25&&bg.px[1]>bg.px[2]+25,`with a background on the worker, the wall is that picture and the look's key changes (corner ${bg.px})`);
    // the switch in Settings: off on this phone, every outfit goes the earlier way
    const sw=await p.evaluate(()=>{openSettings('photos');renderAsmUI();const sel=document.querySelector('#cfg-cm');const r={there:!!sel,val:sel&&sel.value};
      asmCmSet('off');const W=__W;r.off=asmCmKind({shirt:W.shirt,bot:W.pants,belt:W.belt,tie:W.tie});asmCmSet('on');r.on=asmCmKind({shirt:W.shirt,bot:W.pants,belt:W.belt,tie:W.tie});closeSettings&&closeSettings();return r});
    ok(sw.there&&sw.val==='on'&&sw.off===null&&sw.on==='shirt-tie',`Settings → Item photos has the switch, on by default; off, no outfit is painted on a colour-coded master (${JSON.stringify(sw)})`);
    // the dress code: no jacket pieces are asked for when jackets aren't worn
    const nd=await p.evaluate(()=>{const r={};settings.dress={jacket:true,tie:true};r.with=asmNeeds().filter(n=>n.slot==='jacket').length;settings.dress={jacket:false,tie:true};r.without=asmNeeds().filter(n=>n.slot==='jacket'||n.kind==='vestmaster').length;settings.dress={jacket:true,tie:true};return r});
    ok(nd.without===0,`with no jackets in the dress code, no jacket pieces or waistcoat master are listed (${JSON.stringify(nd)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
  // a fresh phone with the worker's list (2026-11-13): a look the computer built is shown from its picture alone, without the master, its
  // masks or parts; a look nobody built is left to the computer while building ahead, and painted here for the day on screen
  {const browser=await chromium.launch();
    try{const ctx=await browser.newContext({viewport:{width:390,height:844}});const asked=[],served={};let listed=0;
      await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');if(k)asked.push(k);
        const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
        if(u.pathname==='/render'&&u.searchParams.get('list')){listed++;return j({keys:Object.keys(served)})}
        if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
        if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
        if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
      const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
      const recs={};const d=path.join(FIX,'suit');for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
        recs[n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(d,f)).toString('base64'),model:'colormaster',t:1000}}
      const keys=await p.evaluate(ns=>ns.map(n=>asmCmKey('suit',n)),Object.keys(recs));Object.keys(recs).forEach((n,i)=>served[keys[i]]=recs[n]);const masterKeys=new Set(keys);
      const bgKey=await p.evaluate(()=>asmCmBgKey());served[bgKey]={sig:'asm/cm bg',model:'colormaster',t:2000,img:recs.master.img};   // (the background: in every look's key)
      await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{};
        let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
        window.__W={watch:I('watch','silver',{metal:'silver'}),suit:I('suit','navy'),shirt:I('shirt','pink'),shirt2:I('shirt','lightblue'),tie:I('tie','burgundy')};items=Object.values(__W)},HOST);
      // the computer's picture of one suit day, under that look's key
      const built=await p.evaluate(async()=>{await asmListGet(true);const W=__W,o={shirt:W.shirt,watch:W.watch,top:W.suit,tie:W.tie};const k0=asmOutKey(o);await asmCmLook(o);return {k0,k:asmOutKey(o),zv:ASM_ZV,use:asmCmUse(o)}});
      served[built.k]={sig:`asm/out/z${built.zv}/2000`,img:recs.master.img,model:'',t:2000};
      const r1=await p.evaluate(async()=>{await asmListGet(true);const W=__W,o={shirt:W.shirt,watch:W.watch,top:W.suit,tie:W.tie};await asmEnsure(o);const f=asmFor(o);return {use:asmCmUse(o),shown:!!f,master:!!renders[asmCmKey('suit','master')]}});
      const a1=asked.slice(),name=k=>masterKeys.has(k)?'master record':k===built.k?'the picture':k===bgKey?'the background':k;
      ok(built.use==='suit'&&built.k0!==built.k&&r1.shown&&!r1.master&&a1.length===2&&a1.includes(built.k)&&a1.includes(bgKey),`a look the computer built: only the background (once, it is in every look's key) and the picture are downloaded, not the master, its masks or parts (asked for ${a1.length}: ${a1.map(name).join(', ')})`);
      const r2=await p.evaluate(async()=>{const W=__W,o={shirt:W.shirt2,watch:W.watch,top:W.suit,tie:W.tie};await asmEnsure(o,true);const a=!!asmFor(o);await asmEnsure(o);return {ahead:a,screen:!!asmFor(o),master:!!renders[asmCmKey('suit','master')]}});
      const a2=asked.slice(a1.length);
      ok(!r2.ahead&&a2.filter(k=>masterKeys.has(k)).length===masterKeys.size&&r2.screen&&r2.master,`a look nobody built: left to the computer while building ahead (nothing downloaded), painted here for the day on screen (${a2.length} records downloaded then)`);
      ok(listed<=3,`the worker's list is asked for once per refresh, not per look (${listed} times)`);
      // the earlier way's photos: with the suit and waistcoat masters on the worker, the start-up check downloads none of them
      const vk=await p.evaluate(()=>asmCmKey('vest','master'));served[vk]=recs.master;const n0=asked.length;
      const old=await p.evaluate(async()=>{await asmListGet(true);const st=await asmSync(true);openSettings('photos');renderAsmUI();
        return {cm:!!st.cm,missing:st.missing.length,text:(document.querySelector('#asm-status')||{}).textContent||'',old:[asmMasterKey(),asmVestKey(),...['jacket','shirt','tie','watch','vest'].map(s=>asmCalibKey(s))]}});
      const a3=asked.slice(n0);
      ok(old.cm&&old.missing===0&&!a3.some(k=>old.old.includes(k))&&/no item photos are needed/.test(old.text),`with colour-coded masters, the earlier way's master, waistcoat master and calibration photos are not downloaded (asked for ${a3.length}), and Settings says no item photos are needed`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    finally{await browser.close()}}
  // the upload script: the app's keys, from a folder laid out as colormaster.js writes it
  {const os=require('os'),{spawnSync}=require('child_process'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cm-')),d=path.join(tmp,'out-suit');fs.mkdirSync(d);
    const src=path.join(FIX,'suit');fs.copyFileSync(path.join(src,'master.jpg'),path.join(d,'colormaster-2880.png'));
    for(const f of fs.readdirSync(src)){if(f.startsWith('mask-'))fs.copyFileSync(path.join(src,f),path.join(d,'alpha-'+f.slice(5)));if(f.startsWith('part-'))fs.copyFileSync(path.join(src,f),path.join(d,(f.includes('lapel')?'lapel-':'sleeve-')+f.slice(5)))}
    const r=spawnSync(process.execPath,[path.join(__dirname,'..','tools','asm-cm-upload.js'),'--dir',tmp,'--dry','--kinds','suit'],{encoding:'utf8'});
    const fnv=t=>{let h=0xcbf29ce484222325n;for(const c of Buffer.from(t,'utf8')){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}return h.toString(16).padStart(16,'0')};
    const ver=/const ASM_VER=(\d+)/.exec(fs.readFileSync(path.join(__dirname,'..','assemble.js'),'utf8'))[1],cmv=/const ASM_CMV=(\d+)/.exec(fs.readFileSync(path.join(__dirname,'..','asm-color.js'),'utf8'))[1];
    const want='c'+fnv(`asm/${ver}/cm${cmv}/suit/master`);
    ok(r.status===0&&r.stdout.includes('suit master -> '+want)&&/lapelL/.test(r.stdout),`tools/asm-cm-upload.js puts each record under the app's own key (${(r.stdout.match(/suit master -> \S+/)||[r.stderr])[0]})`);
    const rb=spawnSync(process.execPath,[path.join(__dirname,'..','tools','asm-cm-upload.js'),'--bg',path.join(src,'master.jpg'),'--dry'],{encoding:'utf8'});
    ok(rb.status===0&&rb.stdout.includes('all background -> c'+fnv(`asm/${ver}/cm${cmv}/all/background`)),`--bg puts the background under the app's key (${(rb.stdout.match(/all background -> \S+/)||[rb.stderr])[0]})`);
    fs.rmSync(tmp,{recursive:true,force:true})}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
