// PROTOTYPE bench (2026-11-14): the colour-coded painter's per-look pass on the CPU (asmCmBuild) against the WebGL2 prototype (asm-gl.js)
// at 2048, the 512 suit fixtures enlarged, in headless Chromium; the same looks painted both ways, timed (median of --runs) and compared
// pixel by pixel. Nothing here is used by the app.
//   node tools/asm-gl-bench.js [--out <dir>] [--size 2048] [--runs 5] [--gpu swiftshader|d3d11|both] [--throttle] [--half]
//   --gpu       swiftshader: headless shell, ANGLE on SwiftShader (a software GPU); d3d11: Chromium's new headless with ANGLE on D3D11
//               (the real GPU); both (default)
//   --throttle  also time with CDP CPU throttling 4x (a phone), in the Web Worker and on the page thread
//   --half      also try the kept zones' texture as RGBA16F (half the memory) and compare
// Writes <out>/<renderer>-<look>-{cpu,gl,diff,side}.png and <out>/results.json, and prints a table.
/* global asmGlInit, asmGlPack, asmGlUpload, asmGlPaint, asmGlCan, __save */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),FIX=path.join(ROOT,'tests','fixtures','cm');
const {chromium}=require('playwright');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]},has=n=>process.argv.includes('--'+n);
const OUT=path.resolve(arg('out',path.join(ROOT,'out'))),S=+arg('size',2048),RUNS=+arg('runs',5),GPU=arg('gpu','both'),THROTTLE=has('throttle'),HALF=has('half');
const ORIGIN='https://app.test/',HOST='https://w.test/';
const TYPES={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',json:'application/json',webmanifest:'application/manifest+json'};

/* runs in the bench's Web Worker (or on the page): every look painted both ways, timed, compared */
async function glBenchRun({jobs,runs,S,half,save,cpuOnly,looks}){
  const T=()=>performance.now(),med=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return +b[b.length>>1].toFixed(1)};
  const jpeg0=asmJpeg;let cap=null,jt=0;
  asmJpeg=async img=>{cap=img;const t=T(),r=await jpeg0(img);jt=T()-t;return r};   // asmCmBuild's own JPEG, timed apart
  const out={where:typeof document==='undefined'?'worker':'page',looks:[]},j0=jobs[0],key=j0.cm+'|'+j0.mk+'|'+j0.mt+'|'+(j0.rev||'')+'|'+j0.size;
  let t=T();const P=await asmCmPrep(j0);out.cpuPrep=T()-t;t=T();P.lx=asmCmLightPrep(P);out.cpuLight=T()-t;asmCmMem={list:[{key,P,lx:P.lx}]};
  let G=null;
  if(!cpuOnly){t=T();G=asmGlInit(S);out.glInit=+(T()-t).toFixed(1);
    if(G){out.renderer=G.renderer;t=T();const pk=asmGlPack(P);out.glPack=+(T()-t).toFixed(1);t=T();asmGlUpload(G,pk,{half});G.key=key;out.glUpload=+(T()-t).toFixed(1);
      const why=asmGlCan(j0,P);if(!why){t=T();await asmGlPaint(G,j0,P);out.glFirst=+(T()-t).toFixed(1)}}}
  const png=async(data,w,h)=>{const c=new OffscreenCanvas(w,h);c.getContext('2d').putImageData(new ImageData(data,w,h),0,0);return new Uint8Array(await (await c.convertToBlob({type:'image/png'})).arrayBuffer())};
  const files=[];
  for(const job of jobs){if(looks&&!looks.includes(job.name))continue;const why=asmGlCan(job,P),r={name:job.name,path:why?'falls back: '+why:'GL'};
    const cpu=[],cpuJ=[];for(let i=0;i<runs;i++){t=T();await asmCmBuild(job);cpu.push(T()-t-jt);cpuJ.push(jt)}
    const cpx=new Uint8ClampedArray(cap.data);r.cpu=med(cpu);r.cpuJpeg=med(cpuJ);r.cpuAll=cpu.map(v=>+v.toFixed(0));
    if(G&&!why){const gl=[],glJ=[];let px=null;for(let i=0;i<runs;i++){t=T();px=await asmGlPaint(G,job,P);gl.push(T()-t);t=T();await jpeg0(new ImageData(px,S,S));glJ.push(T()-t)}
      r.gl=med(gl);r.glJpeg=med(glJ);r.glAll=gl.map(v=>+v.toFixed(1));
      // the difference: per channel (RGB), and per pixel its largest channel
      const N=S*S,hist=[0,0,0,0,0,0],dif=new Uint8ClampedArray(4*N),zones={};let sum=0,mx=0,over=0,mxAt=-1;
      for(let k=0;k<N;k++){const j=4*k;let m=0;for(let q=0;q<3;q++){const d=Math.abs(cpx[j+q]-px[j+q]);sum+=d;if(d>m)m=d}
        if(m>mx){mx=m;mxAt=k}hist[m===0?0:m===1?1:m===2?2:m<=5?3:m<=10?4:5]++;
        if(m>2){over++;let bz='',ba=-1;for(const z of P.names)if(P.A[z][k]>ba){ba=P.A[z][k];bz=z}const edge=ba<248;const zk=bz+(edge?' (edge)':'');zones[zk]=(zones[zk]||0)+1}
        // the heatmap: the CPU picture dimmed to a quarter, a differing pixel blue (1), cyan (2), yellow (3-5), red (over 5)
        const g=(cpx[j]+cpx[j+1]+cpx[j+2])/12;const c=m===0?[g,g,g]:m===1?[30,60,255]:m===2?[0,220,255]:m<=5?[255,230,0]:[255,0,0];dif[j]=c[0];dif[j+1]=c[1];dif[j+2]=c[2];dif[j+3]=255}
      r.diff={mean:+(sum/(3*N)).toFixed(4),max:mx,maxAt:mxAt<0?null:[mxAt%S,Math.floor(mxAt/S)],over2:over,hist:{'0':hist[0],'1':hist[1],'2':hist[2],'3-5':hist[3],'6-10':hist[4],'>10':hist[5]},zonesOver2:zones};
      if(save){files.push([job.name+'-cpu.png',await png(cpx,S,S)],[job.name+'-gl.png',await png(px,S,S)],[job.name+'-diff.png',await png(dif,S,S)]);
        // side by side at half size: CPU | GL | difference
        const H=S/2,side=new OffscreenCanvas(3*H,H),sx=side.getContext('2d');let i=0;
        for(const d of [cpx,px,dif]){const c=new OffscreenCanvas(S,S);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d),S,S),0,0);sx.imageSmoothingQuality='high';sx.drawImage(c,i*H,0,H,H);i++}
        files.push([job.name+'-side.png',new Uint8Array(await (await side.convertToBlob({type:'image/png'})).arrayBuffer())])}}
    out.looks.push(r)}
  asmJpeg=jpeg0;out.cpuPrep=+out.cpuPrep.toFixed(0);out.cpuLight=+out.cpuLight.toFixed(0);return {out,files}}

const WORKER=`importScripts('/assemble.js','/asm-color.js','/asm-gl.js','/__glbench/runner.js');
asmData=async(u,W)=>{const bm=await createImageBitmap(await (await fetch(u)).blob()),w=W||bm.width,c=new OffscreenCanvas(w,w),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bm,0,0,w,w);if(bm.close)bm.close();return x.getImageData(0,0,w,w)};
asmJpeg=async img=>{const c=new OffscreenCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);
  return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/jpeg',quality:.9}))};
onmessage=async e=>{try{const r=await glBenchRun(e.data);postMessage(r,r.files.map(f=>f[1].buffer))}catch(err){postMessage({error:String(err&&err.stack||err)})}};`;

async function session(mode){
  const opts=mode==='d3d11'?{channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-webgpu']}
    :{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
  const browser=await chromium.launch({headless:true,...opts});
  try{const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await ctx.route(ORIGIN+'**',route=>{const u=new URL(route.request().url());
      if(u.pathname==='/__glbench/worker.js')return route.fulfill({status:200,contentType:'text/javascript',body:WORKER});
      if(u.pathname==='/__glbench/runner.js')return route.fulfill({status:200,contentType:'text/javascript',body:String(glBenchRun)});
      let f=path.join(ROOT,decodeURIComponent(u.pathname.slice(1))||'index.html');if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');
      route.fulfill({status:200,contentType:TYPES[f.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(f)})});
    const served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();p.on('pageerror',e=>console.log('page error',e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console',m.text().slice(0,300))});
    await p.goto(ORIGIN+'index.html');await p.waitForFunction(()=>window.appReady,null,{timeout:90000});
    await p.addScriptTag({url:ORIGIN+'asm-gl.js'});await p.addScriptTag({url:ORIGIN+'__glbench/runner.js'});
    const recs={};const d=path.join(FIX,'suit');for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
      recs['suit|'+n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(d,f)).toString('base64'),model:'colormaster',t:1000}}
    const keys=await p.evaluate(rs=>{const o={};for(const k of rs){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.keys(recs));
    for(const [k,r] of Object.entries(recs))served[keys[k]]=r;
    // the looks; a stand-in background picture (a cream wall, a window on the left, a desk and laptop at the lower right, blurred)
    const jobs=await p.evaluate(async([h,S])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=S;asmAheadSoon=()=>{};asmAhead=async()=>{};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const W={watch:I('watch','silver',{metal:'silver'}),navy:I('suit','navy'),grey:I('suit','midgrey'),twc:I('suit','charcoal',{pattern:'twill'}),twn:I('suit','navy',{pattern:'twill'}),
        tw2:I('suit','tan',{pattern:'twill',secondaryColor:'brown'}),hb:I('suit','midgrey',{pattern:'herringbone'}),shirt:I('shirt','pink'),shirtw:I('shirt','white'),tie:I('tie','burgundy'),tien:I('tie','navy')};
      items=Object.values(W);await asmCmGet('suit');
      const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');let g=x.createLinearGradient(0,0,1024,0);g.addColorStop(0,'#efe9df');g.addColorStop(1,'#d9d1c4');x.fillStyle=g;x.fillRect(0,0,1024,1024);
      x.fillStyle='#fbf8f2';x.fillRect(40,90,250,560);x.fillStyle='#cfc6b8';for(let i=0;i<4;i++)x.fillRect(40,90+i*140,250,8);x.fillStyle='#7a5c40';x.fillRect(600,760,424,40);x.fillStyle='#5a4330';x.fillRect(640,800,40,224);
      x.fillStyle='#2b2d31';x.fillRect(760,640,190,120);x.fillStyle='#45484e';x.fillRect(740,752,230,10);
      const id=x.getImageData(0,0,1024,1024);for(let k=0;k<id.data.length;k+=4){const v=(Math.random()-.5)*6;id.data[k]+=v;id.data[k+1]+=v;id.data[k+2]+=v}x.putImageData(id,0,0);
      const b=document.createElement('canvas');b.width=b.height=1024;const bx=b.getContext('2d');bx.filter='blur(6px)';bx.drawImage(c,0,0);
      renders[asmCmBgKey()]={img:b.toDataURL('image/jpeg',.9),t:4242,sig:'asm/cm-bg bench'};
      const looks=[['plain-navy',W.navy,W.shirt,W.tie],['plain-midgrey',W.grey,W.shirtw,W.tien],['twill-charcoal',W.twc,W.shirt,W.tie],['twill-navy',W.twn,W.shirtw,W.tie],['twill2-tan-brown',W.tw2,W.shirt,W.tien],['herringbone',W.hb,W.shirt,W.tie]];
      const out=[];for(const [name,top,shirt,tie] of looks){const j=await asmCmJob({shirt,watch:W.watch,top,tie});j.diskCache=false;j.name=name;out.push(j)}return out},[HOST,S]);
    if(!jobs[0].bg)throw new Error('no background in the job');
    // (diagnostic) --no-fleck: the twill's fleck (a hash of the floored cloth position) off in both painters, to see whether the few
    // larger differences are fleck cells flipping where float32 and double land either side of a cell edge
    if(has('no-fleck'))for(const j of jobs){const T=j.cloth.jacket&&j.cloth.jacket.suit;if(T&&T.cloth)T.cloth.fleck=0}
    await p.exposeFunction('__save',(name,b64)=>{fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,name),Buffer.from(b64,'base64'))});
    const inWorker=async(o)=>p.evaluate(async([o,prefix])=>{const w=new Worker('/__glbench/worker.js');const r=await new Promise((ok,no)=>{w.onmessage=e=>e.data.error?no(new Error(e.data.error)):ok(e.data);w.onerror=e=>no(new Error(e.message));w.postMessage(o)});w.terminate();
      const b64=u=>{let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};for(const [n,u] of r.files)await __save(prefix+n,b64(u));return r.out},[{...o,jobs},mode+'-']);
    const onPage=async(o)=>p.evaluate(async o=>(await glBenchRun(o)).out,{...o,jobs});
    const res={mode};
    res.worker=await inWorker({runs:RUNS,S,half:false,save:true});
    if(HALF)res.workerHalf=await inWorker({runs:3,S,half:true,save:false,looks:['plain-navy','twill-charcoal']});
    if(THROTTLE){const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      res.workerThrottled=await inWorker({runs:RUNS,S,half:false,save:false,looks:['plain-navy','twill-charcoal']});
      res.pageThrottled=await onPage({runs:RUNS,S,half:false,save:false,looks:['plain-navy','twill-charcoal']});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1})}
    return res}
  finally{await browser.close()}}

(async()=>{fs.mkdirSync(OUT,{recursive:true});const all=[];
  for(const m of GPU==='both'?['swiftshader','d3d11']:[GPU]){console.log('== '+m);try{const r=await session(m);all.push(r);
      for(const [k,v] of Object.entries(r)){if(k==='mode')continue;console.log(`-- ${k} (${v.where}) renderer: ${v.renderer||'-'}; CPU setup ${v.cpuPrep} ms + light ${v.cpuLight} ms; GL init ${v.glInit} ms, pack ${v.glPack} ms, upload ${v.glUpload} ms, first look ${v.glFirst} ms`);
        for(const l of v.looks)console.log(`   ${l.name.padEnd(18)} CPU ${String(l.cpu).padStart(7)} ms (+JPEG ${l.cpuJpeg})   GL ${String(l.gl==null?'-':l.gl).padStart(7)} ms (+JPEG ${l.glJpeg==null?'-':l.glJpeg})   ${l.path==='GL'?'':l.path}${l.diff?`   diff mean ${l.diff.mean} max ${l.diff.max} >2: ${l.diff.over2}`:''}`)}}
    catch(e){console.log('failed',m,e.message);all.push({mode:m,error:e.message})}}
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(all,null,1));console.log('wrote',OUT)})().catch(e=>{console.error(e);process.exit(1)});
