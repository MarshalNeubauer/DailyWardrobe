/* Assembled outfit pictures, put together off the page (assemble.js: asmRun). It loads assemble.js for the pixel work and swaps in
   its own decoder and encoder, since a worker has no <img> or <canvas>: photos are decoded with createImageBitmap and drawn on an
   OffscreenCanvas. One picture at a time, in the order they come. Without OffscreenCanvas it says so ({ready:false}) and the page
   builds the pictures itself.
   A module worker (assemble.js asmWorker starts it with {type: 'module'}; Round C, wave C3, 2026-11-24): the painter's files are ES
   modules, which importScripts can't load. The imports run them in the order importScripts did; each file's bridge puts its names on the
   worker's globalThis, where the other files and the lines below read them, and the lines below replace asmData, asmJpeg, asmCmPack and
   asmCmDiskPut through the bridge's setters (the files' own calls then reach the replacements, as when they shared one global scope).
   (asm-gl.js: the looks the graphics chip covers are painted there, WebGL2 on an OffscreenCanvas) */
import './srgb.js';
import './asm-keys.js';
import './assemble.js';
import './asm-color.js';
import './asm-gl.js';
import './asm-watch.js';
import './asm-pocket.js';
import './asm-kinds.js';
import './asm-ocp.js';
const ASM_CAN=typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap!=='undefined'&&typeof FileReaderSync!=='undefined';
asmData=async(u,W)=>{const bm=await createImageBitmap(await (await fetch(u)).blob()),w=W||bm.width,c=new OffscreenCanvas(w,w),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bm,0,0,w,w);if(bm.close)bm.close();return x.getImageData(0,0,w,w)};
asmJpeg=async img=>{const c=new OffscreenCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);
  return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/jpeg',quality:.9}))};
/* (CR-8-01, 2026-11-17) the page ends this worker when it is idle (assemble.js asmIdleEnd), but not while a master's setup is still being
   saved to disk (asmCmSetup saves it after the picture is answered): {saving: n} tells the page, a moment after each change, so a put that
   follows its pack is counted before the page hears 0. (asmCmPack and asmCmDiskPut are in no code fingerprint: tests/asmcode.test.js) */
let asmSaving=0,asmSavingT=0;
const asmSaveTell=()=>{clearTimeout(asmSavingT);asmSavingT=setTimeout(()=>postMessage({saving:asmSaving}),0)};
const asmSaveCount=f=>function(...a){asmSaving++;asmSaveTell();return Promise.resolve(f.apply(this,a)).finally(()=>{asmSaving--;asmSaveTell()})};
asmCmPack=asmSaveCount(asmCmPack);asmCmDiskPut=asmSaveCount(asmCmDiskPut);
let asmChain=Promise.resolve();
/* {id, job}: paint it (asmBuild) -> {id, res} or {id, error}. A worker without WebGL2 also takes (CR-8-02, asm-gl.js asmRunPage's steps)
   {id, job, glPrep: {key, gk}}: the master set up and its textures packed for the page (asmGlPrepOff, transferred), and
   {id, job, glFin: {o, ms, renderer}}: the page's drawn pixels finished into the picture (asmGlFinOff). (2026-11-16: the PC builder's
   own messages, {setup}, {probe}, {encode}, a job without its master's files (job.hk) and the CPU-only worker asm-worker.js?nogl=1, were
   removed with the builder) */
onmessage=e=>{const {id,job,glPrep,glFin}=e.data||{};
  asmChain=asmChain.then(async()=>{try{
    if(glPrep){const {res,tr}=await asmGlPrepOff(job,glPrep);postMessage({id,res},tr);return}
    const res=glFin?await asmGlFinOff(job,glFin):await asmBuild(job);
    postMessage({id,res})}catch(err){postMessage({id,error:String(err&&err.message||err)})}})};
postMessage({ready:ASM_CAN,gl:ASM_CAN&&asmGlProbe()});   // gl: WebGL2 here (without it the page draws the covered looks and this worker does the rest, asmRunPage)
