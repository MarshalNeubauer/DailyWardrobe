/* Daily Wardrobe: photo tagging, the start-up remakes (split from tagging.js, Round B CR-2-17): close-ups and item photos saved smaller
   before, made again from this device's sharp copies; black backdrops of cut-out photos; Claude-read patterns recoloured. Each runs once
   (a localStorage flag) and, on a connected phone, within the day's remakes (REMAKE_DAY). */

/* close-ups saved at 640 px before TEX_MAX was raised (2026-11-13): on the device that took them the sharp copy (CLOSE_MAX) is still kept,
   so the synced close-up is made again from it, once (localStorage tex_up). The sharp copy is the camera's light, the synced one may have
   been white-balanced from the item photo, so the new one keeps the old one's colour: each channel's mean (linear, on 64x64 copies) is
   matched, gains held to 0.6-1.6. The sharp copy is kept again under the new close-up's signature. Another device has nothing to do. */
/* a picture's mean colour in linear light (on a 64x64 copy), and a canvas's colours scaled so its mean matches another's, each channel's
   gain held to 0.6-1.6: the two remakes below (one copy: CR-2-15) */
function linMean64(im){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,64,64);const d=x.getImageData(0,0,64,64).data,m=[0,0,0];
  for(let k=0;k<d.length;k+=4)for(let q=0;q<3;q++)m[q]+=srgbLin8(d[k+q]);return m.map(v=>v/4096)}
function matchMean(x,W,H,want,has){const g=want.map((v,q)=>Math.min(1.6,Math.max(.6,has[q]>1e-4?v/has[q]:1)));
  const d=x.getImageData(0,0,W,H),p=d.data,T=[0,1,2].map(q=>{const t=new Uint8ClampedArray(256);for(let v=0;v<256;v++)t[v]=Math.round(linSrgb8(Math.min(1,srgbLin8(v)*g[q])));return t});
  for(let k=0;k<p.length;k+=4){p[k]=T[0][p[k]];p[k+1]=T[1][p[k+1]];p[k+2]=T[2][p[k+2]]}x.putImageData(d,0,0)}
const TEX_UP_FLAG='tex_up',TEX_UP_V='1536';
async function upgradeCloseups(){try{if(localStorage.getItem(TEX_UP_FLAG)===TEX_UP_V||!self.caches||typeof TEX_MAX==='undefined')return 0}catch{return 0}
  let n=0,more=false;const img=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
  for(const it of items){if(!it.texture)continue;
    try{const sharp=await sharpCloseOf(it);if(!sharp||sharp===it.texture)continue;
      const [a,b]=await Promise.all([img(it.texture),img(sharp)]);if(Math.max(a.width,a.height)>=TEX_MAX*.9||Math.max(b.width,b.height)<=Math.max(a.width,a.height)*1.2)continue;
      if(remakeLeft()<1){more=true;break}
      const s=Math.min(1,TEX_MAX/Math.max(b.width,b.height)),W=Math.round(b.width*s),H=Math.round(b.height*s),c=document.createElement('canvas');c.width=W;c.height=H;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(b,0,0,W,H);matchMean(x,W,H,linMean64(a),linMean64(b));
      if(!stillCur(it))continue;it.texture=c.toDataURL('image/jpeg',.85);if(typeof refreshSwatch==='function')await refreshSwatch(it);await put(it);await keepCloseImg(it.id,sharp,it.texture);remakeSpend(1);n++}
    catch(e){console.warn('close-up not upgraded',it.id,e)}}
  if(!more)try{localStorage.setItem(TEX_UP_FLAG,TEX_UP_V)}catch{}
  if(n){cache={};if(typeof fixupRedraw==='function')fixupRedraw();toast(`${n} close-up${n===1?'':'s'} saved sharper (from this phone's copies).${more?' The rest follow over the next days.':''}`,3500)}
  return n}

/* (2026-11-16, the audit's W1-1-02: an update that remade every photo cost a tester about 3 server writes an item on one morning, and ten
   testers updating on the same day would use up everyone's allowance) every picture remade at start-up (a sharper photo or close-up, a small
   copy) is a new server value: a connected phone remakes at most REMAKE_DAY a day (localStorage remake_day {d, n}), the rest on the next
   days; a phone with no connection writes nothing to the server and has no limit */
const REMAKE_DAY=10;
const remakeOn=()=>typeof syncNeedsPull==='function'&&syncNeedsPull();
const remakeRead=()=>{try{const r=JSON.parse(localStorage.getItem('remake_day')||'null');return r&&r.d===isoKey(new Date())?+r.n||0:0}catch{return 0}};
const remakeLeft=()=>remakeOn()?Math.max(0,REMAKE_DAY-remakeRead()):Infinity;
function remakeSpend(k){if(!remakeOn())return;try{localStorage.setItem('remake_day',JSON.stringify({d:isoKey(new Date()),n:remakeRead()+k}))}catch{}}
/* item photos saved at 720 px before PH_MAX was raised (2026-11-13, the owner: "upgrade the main photo size stored as well"): on the device
   that read them, the sharp copy (TAG_MAX, kept by keepTagImg) is still there; when it shows the same picture as the photo (cropSource's
   test: same shape, alike at 24x24, turned to match; a photo cropped or replaced since doesn't match and is left), the photo is made again
   at PH_MAX from it, in the old photo's colour (the old one was white-balanced on the Add card: each channel's mean matched, as for the
   close-ups). Once (localStorage photo_up). */
const PH_UP_FLAG='photo_up',PH_UP_V='1536';
async function upgradePhotos(){try{if(localStorage.getItem(PH_UP_FLAG)===PH_UP_V||typeof PH_MAX==='undefined'||typeof cropSource!=='function')return 0}catch{return 0}
  let n=0,more=false;
  for(const it of items){if(!it.photo)continue;
    try{const ph=await imgOf(it.photo);if(Math.max(ph.naturalWidth,ph.naturalHeight)>=PH_MAX*.9)continue;
      const src=await cropSource(it);if(!src||src===ph||!src.getContext)continue;   // no sharp copy of this very picture on this device
      const s=Math.min(1,PH_MAX/Math.max(src.width,src.height)),W=Math.round(src.width*s),H=Math.round(src.height*s);if(Math.max(W,H)<=Math.max(ph.naturalWidth,ph.naturalHeight)*1.2)continue;
      if(remakeLeft()<2){more=true;break}   // (the day's remakes used up: the rest on the next days)
      const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,W,H);
      matchMean(x,W,H,linMean64(ph),linMean64(c));
      if(!stillCur(it))continue;it.photo=c.toDataURL('image/jpeg',.85);await resignTagImg(it.id,it.photo);if(typeof makeSmall==='function')await makeSmall(it);if(!it.texture&&typeof refreshSwatch==='function')await refreshSwatch(it);await put(it);remakeSpend(2);n++}
    catch(e){console.warn('photo not upgraded',it.id,e)}}
  if(!more)try{localStorage.setItem(PH_UP_FLAG,PH_UP_V)}catch{}
  if(n){cache={};if(typeof fixupRedraw==='function')fixupRedraw();toast(`${n} item photo${n===1?'':'s'} saved sharper (from this phone's copies).${more?' The rest follow over the next days.':''}`,3500)}
  return n}
/* a transparent picture saved as an item photo before shrink() gave it a backdrop (2026-11-14, the owner's socks: a cut-out PNG whose
   photo showed on black, a JPEG having no transparency): a photo whose edge is nearly all pure black (BB_EDGE of it under BB_DARK) and
   whose item isn't dark itself has the black joined to its edge (under BB_FILL: the JPEG's soft fringe too) made white, the one-pixel
   rim beside it half way; a dark item, or a photo with a real dark backdrop, is left. Once (localStorage black_bd). Its sharp copy
   keeps the black, so it isn't signed again (a crop then cuts from the photo itself). */
const BB_FLAG='black_bd',BB_V='1',BB_DARK=12,BB_FILL=48,BB_EDGE=.9;
function blackBackdrop(c){const W=c.width,H=c.height,x=c.getContext('2d',{willReadFrequently:true}),D=x.getImageData(0,0,W,H),p=D.data,mx=k=>Math.max(p[4*k],p[4*k+1],p[4*k+2]);
  let e=0,n=0;const edge=[];for(let X=0;X<W;X++)edge.push(X,(H-1)*W+X);for(let Y=1;Y<H-1;Y++)edge.push(Y*W,Y*W+W-1);
  for(let i=0;i<edge.length;i+=2){n++;if(mx(edge[i])<=BB_DARK)e++}if(e<BB_EDGE*n)return false;
  const bg=new Uint8Array(W*H),st=new Int32Array(W*H);let sp=0;for(const k of edge)if(!bg[k]&&mx(k)<=BB_FILL){bg[k]=1;st[sp++]=k}
  while(sp){const k=st[--sp],X=k%W;for(const j of [X>0?k-1:-1,X<W-1?k+1:-1,k-W,k+W])if(j>=0&&j<W*H&&!bg[j]&&mx(j)<=BB_FILL){bg[j]=1;st[sp++]=j}}
  for(let k=0;k<W*H;k++){if(bg[k]){p[4*k]=p[4*k+1]=p[4*k+2]=255;continue}const X=k%W;
    if((X>0&&bg[k-1])||(X<W-1&&bg[k+1])||(k>=W&&bg[k-W])||(k+W<W*H&&bg[k+W]))for(let q=0;q<3;q++)p[4*k+q]=Math.round((p[4*k+q]+255)/2)}
  x.putImageData(D,0,0);return true}
/* within the day's remakes like the other start-up remakes (CR-2-12: a wardrobe of cut-out PNGs was written all at once), and done only
   once nothing is left: a photo that failed, or waits for the next day, is tried again at the next start */
async function fixBlackBackdrops(){try{if(localStorage.getItem(BB_FLAG)===BB_V)return 0}catch{return 0}
  let n=0,more=false;
  for(const it of items){if(!it.photo)continue;
    try{const h=String(colOf(it)).replace('#',''),lum=.3*parseInt(h.slice(0,2),16)+.59*parseInt(h.slice(2,4),16)+.11*parseInt(h.slice(4,6),16);if(!(lum>=70))continue;   // a dark item's own black can't be told from the backdrop
      const ph=await imgOf(it.photo),c=document.createElement('canvas');c.width=ph.naturalWidth;c.height=ph.naturalHeight;c.getContext('2d').drawImage(ph,0,0);
      if(!blackBackdrop(c)||!stillCur(it))continue;
      if(remakeLeft()<2){more=true;break}   // (a photo and its small copy: the rest on the next days)
      it.photo=c.toDataURL('image/jpeg',.85);if(typeof makeSmall==='function')await makeSmall(it);if(!it.texture&&typeof refreshSwatch==='function')await refreshSwatch(it);await put(it);remakeSpend(2);n++}
    catch(e){more=true;console.warn('backdrop not fixed',it.id,e)}}
  if(!more)try{localStorage.setItem(BB_FLAG,BB_V)}catch{}
  if(n){cache={};if(typeof fixupRedraw==='function')fixupRedraw()}
  return n}

/* once: Claude-read patterns saved without a pattern box were exposure-matched to the whole item photo (wall and all, a navy
   pinstripe came out lavender): recolour them from the saved reading and the close-up, no new call to Claude */
/* (2: again, once, after settFromSpec took the ground from the pixels nearest Claude's ground and stopped dulling tie stripes) */
/* (3: again, and now readings with a pattern box too, read as a new reading is (rereadSett): the box in the sharp copy kept on this
   device, else in the item photo. Skipped before, the owner's khaki windowpane blazer kept dull lines (#e0d9c9 for Claude's #eeeadf) */
async function recolourSpecSetts(){if(localStorage.getItem('spec_recolour')==='3')return 0;let n=0;
  const canvasOf=async src=>{if(!src)return null;const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c};
  for(const it of items)if(it.patternSpec&&it.patternSpec.across&&it.sett&&it.sett.src==='claude+pixels'&&it.texture)try{
    const c=await canvasOf(it.texture),full=it.pbox?await canvasOf(await tagImgOf(it.id,it)||it.photo):null;
    const s=settFromSpec(it.patternSpec,it.pbox&&full?{tex:c,full,box:it.pbox,type:it.type}:{tex:c,type:it.type});
    if(s&&stillCur(it)&&(JSON.stringify(s.bands)!==JSON.stringify(it.sett.bands)||JSON.stringify(s.cross)!==JSON.stringify(it.sett.cross))){it.sett=s;await put(it);n++}}catch(e){console.warn(e)}
  localStorage.setItem('spec_recolour','3');if(n)cache={};return n}
