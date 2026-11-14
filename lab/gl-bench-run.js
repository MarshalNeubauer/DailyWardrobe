/* DailyWardrobe lab (not part of the app): the WebGL2 painter bench's runner (lab/gl-bench.html). It runs in the bench's Web Worker
   (put together by the page from ../assemble.js, ../asm-color.js, asm-gl.js and this file) or on the page thread: the suit master's
   setup once, then every look painted on the CPU (asmCmBuild with job.gl false) and on the GPU (asm-gl.js), timed, and the two pictures
   compared pixel by pixel. Nothing is sent anywhere: the results go back to the page only. Adapted from tools/asm-gl-bench.js (PR #355). */
/* global asmCmFinish, asmCmPrep, asmCmLightPrep, asmCmBuild, asmCmCanvas, asmGlContext, asmGlProgram, asmGlRenderer, asmGlPack, asmGlUpload, asmGlUploadGeo, asmGlPaint, asmGlWhy, asmJpeg:writable, asmData:writable, asmCmMem:writable, asmGlState:writable, FileReaderSync */
const GLB_IN_WORKER=typeof document==='undefined';
/* WebGL2 for the bench: the app prototype's own (an OffscreenCanvas), else a page canvas (iOS below 17 has no WebGL in OffscreenCanvas) */
function glbContext(S){let gl=null,kind='OffscreenCanvas';try{gl=asmGlContext(S)}catch{gl=null}
  if(!gl&&!GLB_IN_WORKER){kind='canvas';try{const cv=document.createElement('canvas');cv.width=cv.height=S;
    gl=cv.getContext('webgl2',{antialias:false,depth:false,stencil:false,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(gl&&gl.getParameter(gl.MAX_TEXTURE_SIZE)<S)gl=null}catch{gl=null}}
  return gl?{gl,kind}:null}
const glbErr=e=>{const m=String(e&&e.message||e);return (e&&e.name&&e.name!=='Error'?e.name+': ':'')+m+(/memory|allocation|RangeError/i.test(m+(e&&e.name))?' (out of memory?)':'')};
const glbGlErr=gl=>{const c=gl.getError();return c===gl.NO_ERROR?null:c===gl.OUT_OF_MEMORY?'GL_OUT_OF_MEMORY':c===gl.CONTEXT_LOST_WEBGL?'CONTEXT_LOST':'GL error 0x'+c.toString(16)};
const glbYield=()=>new Promise(r=>setTimeout(r,GLB_IN_WORKER?0:25));   // (on the page: long enough for the progress to be drawn)
/* a small copy of a picture (RGBA, S x S) for the page: {w,h,data} */
async function glbThumb(px,S,T){const big=asmCmCanvas(S,S);big.getContext('2d').putImageData(new ImageData(px instanceof Uint8ClampedArray?px:new Uint8ClampedArray(px),S,S),0,0);
  const sm=asmCmCanvas(T,T),x=sm.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(big,0,0,T,T);
  const d=x.getImageData(0,0,T,T);big.width=big.height=1;return {w:T,h:T,data:d.data}}
/* the run. o: {jobs, S, runs, cpuRuns, half, thumb}; prog({msg, done, total}) after every step; returns {out, thumbs} */
async function glbRun(o,prog){
  const T=()=>performance.now(),med=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return +b[b.length>>1].toFixed(1)},r1=v=>+v.toFixed(1);
  const {jobs,S}=o,runs=o.runs||5,cpuRuns=o.cpuRuns==null?runs:o.cpuRuns,TH=o.thumb||180;
  const out={where:GLB_IN_WORKER?'worker':'page',size:S,runs,cpuRuns,half:!!o.half,looks:[],errors:[]},thumbs={};
  let done=0,total=2+jobs.length*(cpuRuns+runs)+4;const step=async msg=>{done++;prog({msg,done,total});await glbYield()};
  // asmCmBuild's own JPEG, timed apart and kept out of the CPU time (as the PC bench); its picture is the CPU's pixels
  const jpeg0=asmJpeg;let FIN=null;let cap=null,jt=0;asmJpeg=async img=>{cap=img;const t=T(),r=await jpeg0(img);jt=T()-t;return r};
  let G=null,lost=null;
  try{
    const j0=jobs[0],key=j0.cm+'|'+j0.mk+'|'+j0.mt+'|'+(j0.rev||'')+'|'+j0.size;
    prog({msg:'Setting up the suit master at '+S+' (the slow part)',done,total});await glbYield();
    let t=T(),P;try{P=await asmCmPrep(j0)}catch(e){throw new Error('setup failed: '+glbErr(e))}out.cpuPrep=Math.round(T()-t);await step('Setup done ('+out.cpuPrep+' ms); lighting');
    t=T();try{P.lx=asmCmLightPrep(P)}catch(e){throw new Error('lighting setup failed: '+glbErr(e))}out.cpuLight=Math.round(T()-t);asmCmMem={list:[{key,P,lx:P.lx}]};await step('Lighting done ('+out.cpuLight+' ms)');
    // the GPU: context and shader, the master's pack and upload, the first look
    if(o.gl!==false){t=T();const c=glbContext(S);
      if(!c)out.glWhy='no WebGL2 context at '+S+(GLB_IN_WORKER?' in this Worker (OffscreenCanvas)':' on this page');
      else{const gl=c.gl;out.glCanvas=c.kind;out.renderer=asmGlRenderer(gl);out.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if(gl.canvas&&gl.canvas.addEventListener){gl.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost='WebGL context lost';out.errors.push('webglcontextlost: the GPU dropped the context')});
          gl.canvas.addEventListener('webglcontextcreationerror',e=>out.errors.push('webglcontextcreationerror: '+(e.statusMessage||'')))}
        try{G={gl,S,prog:asmGlProgram(gl),renderer:out.renderer};asmGlState=G;out.glInit=r1(T()-t)}catch(e){out.glWhy='shader: '+glbErr(e);G=null}}
      await step(G?'GL ready ('+out.glInit+' ms)':'GL not available: '+out.glWhy);
      if(G){const why=asmGlWhy(j0,P);if(why){out.glWhy='the graphics chip leaves this look to the CPU: '+why;G=null}}
      if(G){try{t=T();const pk=asmGlPack(P);out.glPack=r1(T()-t);await step('GL pack '+out.glPack+' ms');
          t=T();asmGlUpload(G,pk);asmGlUploadGeo(G,null);G.key=key;out.glUpload=r1(T()-t);const ge=glbGlErr(G.gl);if(ge)throw new Error('upload: '+ge);if(lost)throw new Error(lost);await step('GL upload '+out.glUpload+' ms');
          t=T();await asmGlPaint(G,j0,P);out.glFirst=r1(T()-t);const ge2=glbGlErr(G.gl);if(ge2)throw new Error('first look: '+ge2);if(lost||G.gl.isContextLost())throw new Error(lost||'WebGL context lost');
          out.glSetup=r1(out.glInit+out.glPack+out.glUpload+out.glFirst);await step('GL first look '+out.glFirst+' ms')}
        catch(e){out.glWhy='GL setup failed: '+glbErr(e);out.errors.push(out.glWhy);G=null}}}
    else out.glWhy='GL not asked for here';
    if(!G)total=done+jobs.length*cpuRuns;
    // every look: the CPU, then the GPU, then the difference
    for(const job of jobs){const r={name:job.name};out.looks.push(r);
      try{
        if(cpuRuns>0){const cpu=[],cpuJ=[];cap=null;for(let i=0;i<cpuRuns;i++){t=T();await asmCmBuild({...job,gl:false});cpu.push(T()-t-jt);cpuJ.push(jt);await step(job.name+': CPU run '+(i+1)+'/'+cpuRuns+' '+Math.round(cpu[i])+' ms')}
          r.cpu=med(cpu);r.cpuJpeg=med(cpuJ);r.cpuAll=cpu.map(v=>Math.round(v))}
        const cpx=cap&&cap.data;cap=null;
        if(cpx&&TH)thumbs[job.name+'|cpu']=await glbThumb(cpx,S,TH);
        if(G){const why=asmGlWhy(job,P);r.path=why?'falls back: '+why:'GL';
          if(!why){const gl=[];let px=null;
            for(let i=0;i<runs;i++){t=T();px=await asmGlPaint(G,job,P);gl.push(T()-t);const ge=glbGlErr(G.gl);if(ge)throw new Error('GL paint: '+ge);if(lost||G.gl.isContextLost())throw new Error(lost||'WebGL context lost');
              await step(job.name+': GL run '+(i+1)+'/'+runs+' '+gl[i].toFixed(1)+' ms')}
            r.gl=med(gl);r.glAll=gl.map(r1);
            // (2026-11-14) the finishing pass both painters share (asm-color.js asmCmFinish: the outline softened into the room, the room's
            // grain), as asmGlTry runs it after the chip's pixels are read back; outside the timings above
            if(px&&typeof asmCmFinish==='function'&&job.look!==false&&job.bg){FIN=FIN&&FIN.P===P?FIN:{P};asmCmFinish(px,FIN)}
            if(TH)thumbs[job.name+'|gl']=await glbThumb(px,S,TH);
            if(cpx){const N=S*S,hist=[0,0,0,0,0,0];let sum=0,mx=0,over=0,mxAt=-1;
              for(let k=0;k<N;k++){const j=4*k;let m=0;for(let q=0;q<3;q++){const d=Math.abs(cpx[j+q]-px[j+q]);sum+=d;if(d>m)m=d}
                if(m>mx){mx=m;mxAt=k}if(m>2)over++;hist[m===0?0:m===1?1:m===2?2:m<=5?3:m<=10?4:5]++}
              r.diff={mean:+(sum/(3*N)).toFixed(4),max:mx,maxAt:mxAt<0?null:[mxAt%S,Math.floor(mxAt/S)],over2:over,over2Pct:+(100*over/N).toFixed(3),
                hist:{'0':hist[0],'1':hist[1],'2':hist[2],'3-5':hist[3],'6-10':hist[4],'>10':hist[5]}};
              if(r.cpu&&r.gl)r.speedup=+(r.cpu/r.gl).toFixed(1)}}
          else total-=runs}}
      catch(e){r.error=glbErr(e);out.errors.push(job.name+': '+r.error);if(lost||(G&&G.gl.isContextLost()))G=null}}
  }catch(e){out.fatal=glbErr(e);out.errors.push(out.fatal)}
  finally{asmJpeg=jpeg0;asmCmMem=null;
    if(G&&G.gl){try{for(const tx of G.tex||[])G.gl.deleteTexture(tx);if(G.bgt)G.gl.deleteTexture(G.bgt);const lx=G.gl.getExtension('WEBGL_lose_context');if(lx)lx.loseContext()}catch{}}asmGlState=null}
  prog({msg:'Done',done:total,total});return {out,thumbs}}

/* in the bench's Worker: decode with createImageBitmap, encode on an OffscreenCanvas (as asm-worker.js), and answer the page */
if(GLB_IN_WORKER){
  asmData=async(u,W)=>{const bm=await createImageBitmap(await (await fetch(u)).blob()),w=W||bm.width,c=new OffscreenCanvas(w,w),x=c.getContext('2d',{willReadFrequently:true});
    x.drawImage(bm,0,0,w,w);if(bm.close)bm.close();return x.getImageData(0,0,w,w)};
  asmJpeg=async img=>{const c=new OffscreenCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);
    return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/jpeg',quality:.9}))};
  self.addEventListener('error',e=>{try{postMessage({type:'error',error:'worker error: '+(e.message||e)})}catch{}});
  self.addEventListener('unhandledrejection',e=>{try{postMessage({type:'error',error:'worker promise: '+glbErr(e.reason)})}catch{}});
  onmessage=async e=>{const d=e.data||{};
    if(d.type==='probe'){const r={offscreen:typeof OffscreenCanvas!=='undefined',bitmap:typeof createImageBitmap!=='undefined',frs:typeof FileReaderSync!=='undefined'};
      try{const c=new OffscreenCanvas(8,8),gl=c.getContext('webgl2');r.webgl2=!!gl;if(gl){r.renderer=asmGlRenderer(gl);r.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);const lx=gl.getExtension('WEBGL_lose_context');if(lx)lx.loseContext()}}
      catch(err){r.webgl2=false;r.err=glbErr(err)}
      try{r.canvas2d=!!new OffscreenCanvas(8,8).getContext('2d')}catch{r.canvas2d=false}
      postMessage({type:'probe',probe:r});return}
    if(d.type==='run'){try{const r=await glbRun(d.o,p=>postMessage({type:'progress',...p}));
        postMessage({type:'result',out:r.out,thumbs:r.thumbs},Object.values(r.thumbs).map(t=>t.data.buffer))}
      catch(err){postMessage({type:'error',error:glbErr(err)})}}};
  postMessage({type:'ready'})}
