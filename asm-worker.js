/* Assembled outfit pictures, put together off the page (assemble.js: asmRun). It loads assemble.js for the pixel work and swaps in
   its own decoder and encoder, since a worker has no <img> or <canvas>: photos are decoded with createImageBitmap and drawn on an
   OffscreenCanvas. One picture at a time, in the order they come. Without OffscreenCanvas it says so ({ready:false}) and the page
   builds the pictures itself. */
importScripts('assemble.js','asm-color.js','asm-gl.js','asm-watch.js');   // (asm-gl.js: the looks the graphics chip covers are painted there, WebGL2 on an OffscreenCanvas)
const ASM_CAN=typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap!=='undefined'&&typeof FileReaderSync!=='undefined';
// (stage 6) asm-worker.js?nogl=1: a worker that never touches the graphics chip (the PC pre-build's CPU pool; its one GPU worker has no flag)
const ASM_NOGL=/[?&]nogl=1/.test(self.location&&self.location.search||'');
asmData=async(u,W)=>{const bm=await createImageBitmap(await (await fetch(u)).blob()),w=W||bm.width,c=new OffscreenCanvas(w,w),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bm,0,0,w,w);if(bm.close)bm.close();return x.getImageData(0,0,w,w)};
asmJpeg=async img=>{const c=new OffscreenCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);
  return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/jpeg',quality:.9}))};
let asmChain=Promise.resolve();
/* (stage 6, the PC pre-build) {setup: job}: the master's setup only (asmCmSetup, processor work), so the GPU bursts hold only painting;
   {probe: 1}: the WebGL2 renderer's name and largest texture, a 1x1 context let go at once; a CPU picture of a job that allowed the chip
   says why the chip didn't paint it (glWhy) */
const asmProbe=()=>{try{const gl=new OffscreenCanvas(1,1).getContext('webgl2');if(!gl)return {renderer:null,max:0};const r={renderer:asmGlRenderer(gl),max:gl.getParameter(gl.MAX_TEXTURE_SIZE)};
  const x=gl.getExtension('WEBGL_lose_context');if(x)x.loseContext();return r}catch(e){return {renderer:null,max:0,error:String(e&&e.message||e)}}};
/* (2026-11-14, the PC pre-build) {encode:{px,S}}: finished pixels from the GPU worker -> the JPEG (asmGlEncode), on a CPU pool worker;
   a job with job.hk (the master's key) and no master is the look alone: the worker fills in the master's files it kept from the last
   whole job with that key (a job is 13-40 MB with them), or says it needs the whole job; a picture returned as pixels (job.raw) is
   handed over, not copied */
let asmHeavy=null;const ASM_HEAVY=['master','masks','parts','geoU','geoV','light'];
onmessage=e=>{const {id,job,setup,probe,encode}=e.data||{};
  asmChain=asmChain.then(async()=>{try{
    if(probe){postMessage({id,res:ASM_NOGL?{renderer:null,max:0}:asmProbe()});return}
    if(setup){await asmCmSetup(setup);postMessage({id,res:{ok:true}});return}
    if(encode){postMessage({id,res:{url:await asmGlEncode(encode.px,encode.S)}});return}
    let j0=job;if(j0&&j0.hk){if(j0.master)asmHeavy={k:j0.hk,f:Object.fromEntries(ASM_HEAVY.map(n=>[n,j0[n]]))};else if(asmHeavy&&asmHeavy.k===j0.hk)j0={...j0,...asmHeavy.f};else throw new Error('needs the full job')}
    const j=ASM_NOGL&&j0?{...j0,gl:false}:j0,res=await asmBuild(j);if(res&&res.gl===false&&j&&j.gl!==false&&asmGlNot)res.glWhy=asmGlNot;
    postMessage({id,res},res&&res.px?[res.px.buffer]:[])}catch(err){postMessage({id,error:String(err&&err.message||err)})}})};
postMessage({ready:ASM_CAN,gl:ASM_CAN&&!ASM_NOGL&&asmGlProbe()});   // gl: WebGL2 here (without it the page paints the covered looks on its own, asmGlOnPage)
