/* Assembled outfit pictures, put together off the page (assemble.js: asmRun). It loads assemble.js for the pixel work and swaps in
   its own decoder and encoder, since a worker has no <img> or <canvas>: photos are decoded with createImageBitmap and drawn on an
   OffscreenCanvas. One picture at a time, in the order they come. Without OffscreenCanvas it says so ({ready:false}) and the page
   builds the pictures itself. */
importScripts('assemble.js','asm-color.js','asm-gl.js');   // (asm-gl.js: the looks the graphics chip covers are painted there, WebGL2 on an OffscreenCanvas)
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
onmessage=e=>{const {id,job,setup,probe}=e.data||{};
  asmChain=asmChain.then(async()=>{try{
    if(probe){postMessage({id,res:ASM_NOGL?{renderer:null,max:0}:asmProbe()});return}
    if(setup){await asmCmSetup(setup);postMessage({id,res:{ok:true}});return}
    const j=ASM_NOGL&&job?{...job,gl:false}:job,res=await asmBuild(j);if(res&&res.gl===false&&j&&j.gl!==false&&asmGlNot)res.glWhy=asmGlNot;
    postMessage({id,res})}catch(err){postMessage({id,error:String(err&&err.message||err)})}})};
postMessage({ready:ASM_CAN,gl:ASM_CAN&&!ASM_NOGL&&asmGlProbe()});   // gl: WebGL2 here (without it the page paints the covered looks on its own, asmGlOnPage)
