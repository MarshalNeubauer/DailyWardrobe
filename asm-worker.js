/* Assembled outfit pictures, put together off the page (assemble.js: asmRun). It loads assemble.js for the pixel work and swaps in
   its own decoder and encoder, since a worker has no <img> or <canvas>: photos are decoded with createImageBitmap and drawn on an
   OffscreenCanvas. One picture at a time, in the order they come. Without OffscreenCanvas it says so ({ready:false}) and the page
   builds the pictures itself. */
importScripts('assemble.js');
const ASM_CAN=typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap!=='undefined'&&typeof FileReaderSync!=='undefined';
asmData=async(u,W)=>{const bm=await createImageBitmap(await (await fetch(u)).blob()),w=W||bm.width,c=new OffscreenCanvas(w,w),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bm,0,0,w,w);if(bm.close)bm.close();return x.getImageData(0,0,w,w)};
asmJpeg=async img=>{const c=new OffscreenCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);
  return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:'image/jpeg',quality:.9}))};
let asmChain=Promise.resolve();
onmessage=e=>{const {id,job}=e.data||{};
  asmChain=asmChain.then(async()=>{try{postMessage({id,res:await asmBuild(job)})}catch(err){postMessage({id,error:String(err&&err.message||err)})}})};
postMessage({ready:ASM_CAN});
