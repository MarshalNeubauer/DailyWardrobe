/* Assembled outfit pictures, put together off the page (assemble.js: asmRun). It loads assemble.js for the pixel work and swaps in
   its own decoder and encoder, since a worker has no <img> or <canvas>: photos are decoded with createImageBitmap and drawn on an
   OffscreenCanvas. One picture at a time, in the order they come. Without OffscreenCanvas it says so ({ready:false}) and the page
   builds the pictures itself. */
importScripts('assemble.js','asm-color.js','asm-gl.js','asm-watch.js','asm-kinds.js');   // (asm-gl.js: the looks the graphics chip covers are painted there, WebGL2 on an OffscreenCanvas)
const ASM_CAN=typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap!=='undefined'&&typeof FileReaderSync!=='undefined';
asmData=async(u,W)=>{const bm=await createImageBitmap(await (await fetch(u)).blob()),w=W||bm.width,c=new OffscreenCanvas(w,w),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bm,0,0,w,w);if(bm.close)bm.close();return x.getImageData(0,0,w,w)};
asmJpeg=async img=>{const c=new OffscreenCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);
  return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/jpeg',quality:.9}))};
let asmChain=Promise.resolve();
/* (2026-11-16: the PC builder's own messages, {setup}, {probe}, {encode}, a job without its master's files (job.hk) and the CPU-only
   worker asm-worker.js?nogl=1, were removed with the builder; a phone only ever sent {id, job}) */
onmessage=e=>{const {id,job}=e.data||{};
  asmChain=asmChain.then(async()=>{try{
    const res=await asmBuild(job);
    postMessage({id,res},res&&res.px?[res.px.buffer]:[])}catch(err){postMessage({id,error:String(err&&err.message||err)})}})};
postMessage({ready:ASM_CAN,gl:ASM_CAN&&asmGlProbe()});   // gl: WebGL2 here (without it the page paints the covered looks on its own, asmGlOnPage)
