/* Daily Wardrobe: photo tagging. The request to the worker (sharper photos, the fabric close-up, the owner's own colours and
   patterns, the corrections the owner made before), measuring the cloth's colour after white balance, tagging again from the
   close-up, adding a colour or pattern the lists lack, and the tagging benchmark. */

const TAG_MAX=2048,CLOSE_MAX=1536,TAG_Q=.92;
/* the colours and patterns the owner added, when there are any (the worker adds them to what the tagger may answer) */
const customForTag=()=>{const c=settings.custom||{};return (c.colors||[]).length||(c.patterns||[]).length?{colors:c.colors||[],patterns:c.patterns||[]}:undefined};
/* the latest corrections (another item's only: the benchmark must not hand an item its own answer) */
const tagFixes=skipId=>(settings.tagFixes||[]).filter(f=>f.id!==skipId).slice(-20).map(({field,type,from,to})=>({field,type,from,to}));
const tagExtras=(x={})=>({custom:customForTag(),corrections:tagFixes(x.skipId),...(x.closeup?{closeup:x.closeup}:{}),...(x.measured?{measured:x.measured}:{}),...(x.freeColors?{freeColors:true}:{}),...(x.freePattern?{freePattern:true}:{}),...(x.wb!=null?{wb:!!x.wb}:{})});

/* ---- tagging copies: the sharp photo sent to the tagger is kept on this device only (Cache Storage, not synced, not loaded
   at start-up), so the benchmark can re-tag an item from the same picture later ---- */
const TAGIMG_CACHE='dw-keep-tagimg';
/* (2026-11-14) signed with the item photo it belongs to (x-ph: phSigOf of the photo, like a close-up's texSig): after Replace photo, or an
   Undo back to another picture, the old copy is no longer handed out to "Read pattern from photo", Ask Claude or the recolouring, which
   sent the old picture. Replace and Rotate keep a new copy (keepPhotoCopy in app.js); a crop or an upgrade of the same picture signs the
   copy again (resignTagImg). tagImgOf(id) without the item (the crop's own similarity test) takes any copy. */
async function keepTagImg(id,url,photo){try{if(!url||!self.caches)return;const c=await caches.open(TAGIMG_CACHE);
  await c.put(new Request('tagimg/'+id),new Response(await (await fetch(url)).blob(),{headers:{'content-type':'image/jpeg',...(photo?{'x-ph':texSig(photo)}:{})}}))}catch(e){console.warn('tag copy not kept',e)}}
async function tagImgOf(id,it){try{if(!self.caches)return null;const c=await caches.open(TAGIMG_CACHE),r=await c.match(new Request('tagimg/'+id));if(!r)return null;
  const sig=r.headers.get('x-ph');if(it&&sig&&sig!==texSig(it.photo||''))return null;   // a copy of another picture than the item's photo now
  const b=await r.blob();return await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>ok(null);f.readAsDataURL(b)})}catch{return null}}
async function resignTagImg(id,photo){try{const u=await tagImgOf(id);if(u)await keepTagImg(id,u,photo)}catch{}}

/* the sharp close-up (CLOSE_MAX, on this device only, in the same cache): the synced close-up was 640 px until 2026-11-13 (TEX_MAX is now
   1536, the same), too small for a fine weave
   (the owner's mid grey blazer: a fine broken twill read as a false micro-check at 480x640). Kept with the synced close-up's
   signature, so a close-up replaced, removed or undone never sends the old sharp copy; another device sends the synced one. */
const texSig=u=>u?u.length+':'+u.slice(-48):'';
async function keepCloseImg(id,url,tex){try{if(!url||!tex||!self.caches)return;const c=await caches.open(TAGIMG_CACHE);
  await c.put(new Request('closeimg/'+id),new Response(await (await fetch(url)).blob(),{headers:{'content-type':'image/jpeg','x-tex':texSig(tex)}}))}catch(e){console.warn('sharp close-up not kept',e)}}
async function sharpCloseOf(it){if(!it||!it.texture)return null;
  try{if(self.caches){const c=await caches.open(TAGIMG_CACHE),r=await c.match(new Request('closeimg/'+it.id));
    if(r&&r.headers.get('x-tex')===texSig(it.texture)){const b=await r.blob();const u=await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>ok(null);f.readAsDataURL(b)});if(u)return u}}}catch{}
  return it.texture}

/* close-ups saved at 640 px before TEX_MAX was raised (2026-11-13): on the device that took them the sharp copy (CLOSE_MAX) is still kept,
   so the synced close-up is made again from it, once (localStorage tex_up). The sharp copy is the camera's light, the synced one may have
   been white-balanced from the item photo, so the new one keeps the old one's colour: each channel's mean (linear, on 64x64 copies) is
   matched, gains held to 0.6-1.6. The sharp copy is kept again under the new close-up's signature. Another device has nothing to do. */
const TEX_UP_FLAG='tex_up',TEX_UP_V='1536';
async function upgradeCloseups(){try{if(localStorage.getItem(TEX_UP_FLAG)===TEX_UP_V||!self.caches||typeof TEX_MAX==='undefined')return 0}catch{return 0}
  let n=0;const img=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
  const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)},gam=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
  const mean=im=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,64,64);const d=x.getImageData(0,0,64,64).data,m=[0,0,0];
    for(let k=0;k<d.length;k+=4)for(let q=0;q<3;q++)m[q]+=lin(d[k+q]);return m.map(v=>v/4096)};
  for(const it of items){if(!it.texture)continue;
    try{const sharp=await sharpCloseOf(it);if(!sharp||sharp===it.texture)continue;
      const [a,b]=await Promise.all([img(it.texture),img(sharp)]);if(Math.max(a.width,a.height)>=TEX_MAX*.9||Math.max(b.width,b.height)<=Math.max(a.width,a.height)*1.2)continue;
      const s=Math.min(1,TEX_MAX/Math.max(b.width,b.height)),W=Math.round(b.width*s),H=Math.round(b.height*s),c=document.createElement('canvas');c.width=W;c.height=H;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(b,0,0,W,H);const ma=mean(a),mb=mean(b),g=ma.map((v,q)=>Math.min(1.6,Math.max(.6,mb[q]>1e-4?v/mb[q]:1)));
      const d=x.getImageData(0,0,W,H),p=d.data,T=[0,1,2].map(q=>{const t=new Uint8ClampedArray(256);for(let v=0;v<256;v++)t[v]=Math.round(gam(Math.min(1,lin(v)*g[q])));return t});
      for(let k=0;k<p.length;k+=4){p[k]=T[0][p[k]];p[k+1]=T[1][p[k+1]];p[k+2]=T[2][p[k+2]]}x.putImageData(d,0,0);
      if(!stillCur(it))continue;it.texture=c.toDataURL('image/jpeg',.85);if(typeof refreshSwatch==='function')await refreshSwatch(it);await put(it);await keepCloseImg(it.id,sharp,it.texture);n++}
    catch(e){console.warn('close-up not upgraded',it.id,e)}}
  try{localStorage.setItem(TEX_UP_FLAG,TEX_UP_V)}catch{}
  if(n){cache={};if(typeof fixupRedraw==='function')fixupRedraw();toast(`${n} close-up${n===1?'':'s'} saved sharper (from this phone's copies).`,3500)}
  return n}

/* item photos saved at 720 px before PH_MAX was raised (2026-11-13, the owner: "upgrade the main photo size stored as well"): on the device
   that read them, the sharp copy (TAG_MAX, kept by keepTagImg) is still there; when it shows the same picture as the photo (cropSource's
   test: same shape, alike at 24x24, turned to match; a photo cropped or replaced since doesn't match and is left), the photo is made again
   at PH_MAX from it, in the old photo's colour (the old one was white-balanced on the Add card: each channel's mean matched, as for the
   close-ups). Once (localStorage photo_up). */
const PH_UP_FLAG='photo_up',PH_UP_V='1536';
async function upgradePhotos(){try{if(localStorage.getItem(PH_UP_FLAG)===PH_UP_V||typeof PH_MAX==='undefined'||typeof cropSource!=='function')return 0}catch{return 0}
  let n=0;const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)},gam=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
  const mean=im=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,64,64);const d=x.getImageData(0,0,64,64).data,m=[0,0,0];
    for(let k=0;k<d.length;k+=4)for(let q=0;q<3;q++)m[q]+=lin(d[k+q]);return m.map(v=>v/4096)};
  for(const it of items){if(!it.photo)continue;
    try{const ph=await imgOf(it.photo);if(Math.max(ph.naturalWidth,ph.naturalHeight)>=PH_MAX*.9)continue;
      const src=await cropSource(it);if(!src||src===ph||!src.getContext)continue;   // no sharp copy of this very picture on this device
      const s=Math.min(1,PH_MAX/Math.max(src.width,src.height)),W=Math.round(src.width*s),H=Math.round(src.height*s);if(Math.max(W,H)<=Math.max(ph.naturalWidth,ph.naturalHeight)*1.2)continue;
      const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,W,H);
      const ma=mean(ph),mb=mean(c),g=ma.map((v,q)=>Math.min(1.6,Math.max(.6,mb[q]>1e-4?v/mb[q]:1)));
      const d=x.getImageData(0,0,W,H),p=d.data,T=[0,1,2].map(q=>{const t=new Uint8ClampedArray(256);for(let v=0;v<256;v++)t[v]=Math.round(gam(Math.min(1,lin(v)*g[q])));return t});
      for(let k=0;k<p.length;k+=4){p[k]=T[0][p[k]];p[k+1]=T[1][p[k+1]];p[k+2]=T[2][p[k+2]]}x.putImageData(d,0,0);
      if(!stillCur(it))continue;it.photo=c.toDataURL('image/jpeg',.85);await resignTagImg(it.id,it.photo);if(typeof makeSmall==='function')await makeSmall(it);if(!it.texture&&typeof refreshSwatch==='function')await refreshSwatch(it);await put(it);n++}
    catch(e){console.warn('photo not upgraded',it.id,e)}}
  try{localStorage.setItem(PH_UP_FLAG,PH_UP_V)}catch{}
  if(n){cache={};if(typeof fixupRedraw==='function')fixupRedraw();toast(`${n} item photo${n===1?'':'s'} saved sharper (from this phone's copies).`,3500)}
  return n}

/* ---- the light reading of a picture: white-balance gains from its brightest near-neutral pixels, whether such a white
   reference is there at all, and how bright it is once corrected (for the exposure of a close-up with white paper in it) ---- */
function wbRead(c,{strict=false}={}){
  const k=Math.min(1,200/Math.max(c.width,c.height)),w=Math.max(1,Math.round(c.width*k)),h=Math.max(1,Math.round(c.height*k)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data,n=w*h,lums=new Float32Array(n);
  for(let i=0,j=0;i<d.length;i+=4,j++)lums[j]=(d[i]+d[i+1]+d[i+2])/3;
  const sorted=[...lums].sort((a,b)=>a-b),thr=Math.max(150,sorted[Math.floor(n*.95)]-12),p25=sorted[Math.floor(n*.25)];let R=0,G=0,B=0,m=0;
  for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
    if(mx>=250&&mn>=250)continue;   // clipped highlights say nothing about the light
    if((mx-mn)/mx<.35){R+=d[i];G+=d[i+1];B+=d[i+2];m++}}   // a white wall under tungsten light reads about 30% saturated
  if(m<n*.005||m>n*.85)return {gains:null,ref:false,refLum:0,frac:m/n};
  // a white reference is one solid area clearly brighter than the cloth (a wall, a white shirt under a tie, paper); the light
  // slubs and highlights of a khaki or beige cloth are scattered specks only a little brighter, and taking them for white would
  // turn the cloth grey
  const isRef=new Uint8Array(n);for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);if(!(mx>=250&&mn>=250)&&(mx-mn)/mx<.35)isRef[j]=1}
  let solid=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const j=y*w+x;if(isRef[j]&&isRef[j-1]+isRef[j+1]+isRef[j-w]+isRef[j+w]>=3)solid++}
  if(solid<m*.5||(R+G+B)/3/m<1.15*p25)return {gains:null,ref:false,refLum:0,frac:m/n};
  const st=strict?wbSolidStats(d,lums,isRef,w,h,(R+G+B)/3/m):null;
  if(st&&!wbSolidOk(st))return {gains:null,ref:false,refLum:0,frac:m/n,st};
  const g=(R+G+B)/3/m,cl=v=>Math.min(1.18,Math.max(.85,v)),gains={r:cl(g/(R/m)),g:cl(g/(G/m)),b:cl(g/(B/m))};
  const sig=Math.max(...Object.values(gains).map(v=>Math.abs(v-1)))>=.02;
  return {gains:sig?gains:null,ref:true,refLum:(R/m*gains.r+G/m*gains.g+B/m*gains.b)/3,frac:m/n,...(st?{st}:{})}}
const wbGains=c=>wbRead(c).gains;
/* a close-up's white reference must be a real patch of paper (or a white shirt's front), not the cloth's own light parts (2026-11-14,
   the new-user walkthrough: "white paper" was found in close-ups of a light blue shirt, cream trousers, a white/blue stripe and a check
   blazer, and their exposure was corrected the wrong way). Three tests on the reference pixels (isRef, at most 200 px):
   - a solid core: what is left after taking 2 px off every edge covers WB_CORE (1%) of the picture (a check's light lines, a stripe's
     narrow white and a fold's highlight are thinner than that);
   - set apart in lightness: the reference is WB_GAP (28 levels) brighter than the cloth's median, and few pixels (under WB_TRANS, 7%)
     lie between half way and the reference (paper's edge is a thin line; a light cloth's own highlights shade into it).
   (Its hue is not tested: under warm light white paper leans the same way as a brown cloth.) Each of the walkthrough's false references
   fails the core, the gap or the in-between test. */
const WB_CORE=.01,WB_GAP=28,WB_TRANS=.07;
function wbSolidStats(d,lums,isRef,w,h,refLum){const n=w*h;let core=0;
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let all=1;for(let j=-2;j<=2&&all;j++)for(let i=-2;i<=2;i++)if(!isRef[(y+j)*w+x+i]){all=0;break}core+=all}
  const cl=[];let ra=0,rb=0,rn=0;const ca=[],cb=[];
  for(let j=0;j<n;j++){if(isRef[j]){const l=rgbLab(d[4*j],d[4*j+1],d[4*j+2]);ra+=l[1];rb+=l[2];rn++}else{cl.push(lums[j]);if(j%3===0){const l=rgbLab(d[4*j],d[4*j+1],d[4*j+2]);ca.push(l[1]);cb.push(l[2])}}}
  cl.sort((a,b)=>a-b);const med=cl.length?cl[cl.length>>1]:0,gap=refLum-med;
  let trans=0;for(const v of cl)if(v>med+gap*.5)trans++;
  const md=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:0},cA=md(ca),cB=md(cb),Cc=Math.hypot(cA,cB),rA=rn?ra/rn:0,rB=rn?rb/rn:0,Cr=Math.hypot(rA,rB);
  let hue=180;if(Cc>0&&Cr>0){hue=Math.abs(Math.atan2(rB,rA)-Math.atan2(cB,cA))*180/Math.PI;if(hue>180)hue=360-hue}
  return {core:core/n,gap,trans:trans/n,Cc,Cr,hue}}
function wbSolidOk(s){
  return !(s.core<WB_CORE||s.gap<WB_GAP||s.trans>WB_TRANS)}
/* the light reading of a close-up: strict about what counts as white paper */
const closeRead=c=>wbRead(c,{strict:true});

/* ---- measuring the cloth: the median CIELAB colour of a region (a box in thousandths, or the middle of the picture), after
   the white-balance gains; with a white reference (paper in the close-up) the exposure is also set from it, so lightness is
   trustworthy. Shadows and highlights (the darkest and brightest tenth) and the reference itself are left out. ---- */
const sLin=u=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92},linS=u=>255*(u>.0031308?1.055*u**(1/2.4)-.055:12.92*u);
function measureCloth(c,box,{gains=null,refLum=0}={}){
  const W=c.width,H=c.height,bx=box?{x:box.x/1000*W,y:box.y/1000*H,w:box.w/1000*W,h:box.h/1000*H}:{x:W*.15,y:H*.15,w:W*.7,h:H*.7};
  const k=Math.min(1,120/Math.max(bx.w,bx.h)),w=Math.max(1,Math.round(bx.w*k)),h=Math.max(1,Math.round(bx.h*k)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,bx.x,bx.y,bx.w,bx.h,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
  const g=gains||{r:1,g:1,b:1},ex=refLum?sLin(243)/sLin(Math.min(250,refLum)):1;
  let px=[];for(let i=0;i<d.length;i+=4){const rgb=[d[i]*g.r,d[i+1]*g.g,d[i+2]*g.b].map(v=>linS(Math.min(1,sLin(Math.min(255,v))*ex)));px.push(rgb)}
  const ok=new Uint8Array(px.length).fill(1);
  if(refLum){let n=0;const no=px.map(([r,gg,b])=>{const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);return mx>225&&(mx-mn)/mx<.12});for(const v of no)if(!v)n++;if(n>=px.length*.2)no.forEach((v,j)=>{if(v)ok[j]=0})}   // not the paper
  const all=px.map(p=>rgbLab(...p)),edge=measEdgeCut(all,ok,w,h);
  const labs=all.filter((_,j)=>ok[j]).sort((a,b)=>a[0]-b[0]),cut=Math.floor(labs.length*.1),mid=labs.slice(cut,labs.length-cut||labs.length);
  const med=j=>{const v=mid.map(l=>l[j]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};
  const lab=[med(0),med(1),med(2)].map(v=>Math.round(v*10)/10),dl=labs.map(l=>Math.hypot(l[0]-lab[0],l[1]-lab[1],l[2]-lab[2])).sort((a,b)=>a-b);
  const out={lab,hex:labHex(lab),ref:!!refLum,spread:Math.round(10*(dl[dl.length>>1]||0))/10,edge:Math.round(100*edge)/100};
  Object.defineProperty(out,'px',{value:labs,enumerable:false});   // the cloth's pixels (for the pattern's colours), never saved or sent
  return out}
/* the background, or a collar or shirt caught at the crop's edge (2026-11-14: the walkthrough's belt measured the wall behind it): pixels
   far from the cloth's own colour (ΔE76 over 14, or 3 times the usual distance) that are joined to the region's edge are left out, when
   they are under MEAS_EDGE_MAX (45%) of it (more than that is the cloth itself, a stripe touching the edge everywhere) */
const MEAS_EDGE_MAX=.45;
function measEdgeCut(all,ok,w,h){const n=all.length,idx=[];for(let j=0;j<n;j++)if(ok[j])idx.push(j);if(idx.length<50)return 0;
  const md=k=>{const v=idx.map(j=>all[j][k]).sort((a,b)=>a-b);return v[v.length>>1]},m=[md(0),md(1),md(2)];
  const d=new Float32Array(n);for(const j of idx)d[j]=Math.hypot(all[j][0]-m[0],all[j][1]-m[1],all[j][2]-m[2]);
  const ds=idx.map(j=>d[j]).sort((a,b)=>a-b),thr=Math.max(14,3*ds[ds.length>>1]),far=j=>ok[j]&&d[j]>thr;
  const cut=new Uint8Array(n),st=[];for(let x=0;x<w;x++)for(const y of [0,h-1]){const j=y*w+x;if(far(j)&&!cut[j]){cut[j]=1;st.push(j)}}
  for(let y=0;y<h;y++)for(const x of [0,w-1]){const j=y*w+x;if(far(j)&&!cut[j]){cut[j]=1;st.push(j)}}
  let c=st.length;while(st.length){const j=st.pop(),x=j%w,y=(j/w)|0;for(const k of [x>0?j-1:-1,x<w-1?j+1:-1,y>0?j-w:-1,y<h-1?j+w:-1])if(k>=0&&!cut[k]&&far(k)){cut[k]=1;c++;st.push(k)}}
  if(c>idx.length*MEAS_EDGE_MAX||!c)return 0;for(let j=0;j<n;j++)if(cut[j])ok[j]=0;return c/idx.length}
/* the colour each name has in this wardrobe: the median of the owner's own measured items of that colour (the same kind of
   item), once there are two; otherwise the app's swatch. Measurements with a white reference count first. */
/* (2026-11-14) only plain cloth teaches it: a solid, or a one-colour weave (twill, herringbone, a shirt's dobby) with no second colour.
   The walkthrough's plain brown tie measured nearest navy after two navy patterned ties had taught "navy" their stripes' average. An
   item never teaches its own measurement (skip: its id), so a card or the calibration can't confirm itself. */
const typeGroup=t=>['suit','blazer','pants','overcoat','raincoat'].includes(t)?'cloth':t;
const ONE_COL_WEAVES=['solid','twill','herringbone','birdseye','nailhead','sharkskin','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','knit','tweed'];
const plainCloth=i=>!!i&&ONE_COL_WEAVES.includes(patBase(i.pattern)||'solid')&&!i.secondaryColor;
function calibLab(c,type,skip){const ms=items.filter(i=>i.id!==skip&&primaryCol(i)===c&&i.meas&&i.meas.lab&&plainCloth(i)&&typeGroup(i.type)===typeGroup(type)).map(i=>i.meas),good=ms.filter(m=>m.ref),use=good.length>=2?good:ms;
  if(use.length<2)return null;const med=j=>{const v=use.map(m=>m.lab[j]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};return [med(0),med(1),med(2)]}
/* how much lightness counts: fully with a white reference; a close-up without one is exposed by the phone to a mid tone whatever
   the cloth (a white shirt reads light grey, navy reads lighter), so its lightness counts a third; a photo's half */
const measKL=m=>m&&m.ref?1:m&&m.src==='closeup'?MEAS_KL_CLOSE:2,MEAS_KL_CLOSE=3;
const colRef=(c,type,skip,accent)=>(!accent&&calibLab(c,type,skip))||labOf(c);
function nearestCols(type,lab,ref,o={}){const kL=o.kL||(ref?1:2);return colsFor(type,o.accent).filter(c=>COLORS[c]).map(c=>({c,d:Math.round(dE00(lab,colRef(c,type,o.skip,o.accent),kL)*10)/10})).sort((a,b)=>a.d-b.d).slice(0,3)}
const FAR_DE=12;   // further than this from every allowed colour: offer to add a new one
/* the measured colour disagrees with the tag: the closest listed colour is near (ΔE ≤ 8) and the tagged one is clearly further
   (4+ ΔE more). Claude once kept "brown" on a muted, almost grey mink suit whose close-up measured deep taupe at ΔE 4 (brown 12).
   Only a close-up or a measurement with a white reference counts: the same suit's photo alone, too dark, measured nearest black. */
/* (2026-11-14) now one verdict per colour (colourVerdicts): measuredAlt is the main colour's, when it disagrees enough to say so */
const MEAS_NEAR=8,MEAS_GAP=4;
function measuredAlt(q){const v=(q.measV||colourVerdicts(q)).find(x=>x.f==='primaryColor');return v&&v.mode?{c:v.to,d:v.d,tagged:v.dTag,mode:v.mode,conf:v.conf}:null}
/* the card's measurement: the close-up when there is one (with its own white reference if it has one, else the item photo's
   light reading), otherwise the plain-cloth box Claude pointed at in the item photo */
/* (2026-11-14) with both, the photo is measured too (photo: its box) so the two can be compared (one of the confidence's parts); the
   close-up's white reference must be a real patch (closeRead); its sharpness is kept (sharp) */
function measureCard(q){
  let m=null;
  if(q.raw&&q.raw.tex){const r=closeRead(q.raw.tex);
    m=Object.assign(measureCloth(q.raw.tex,null,r.ref?{gains:r.gains,refLum:r.refLum}:{gains:q.wbOff?null:q.wb}),{src:'closeup',sharp:sharpness(q.raw.tex)})}
  if(q.clothBox&&q.raw&&q.raw.big){const p=Object.assign(measureCloth(q.raw.big,q.clothBox,{gains:q.wbOff?null:q.wb}),{src:'photo'});
    if(m)m.photo={lab:p.lab,hex:p.hex,spread:p.spread};else m=p}
  if(m){m.near=nearestCols(q.type,m.lab,m.ref,{kL:measKL(m),skip:q.id});m.parts=measureParts(q,m);if(m.parts)m.groundNear=nearestCols(q.type,m.parts[0].lab,m.ref,{kL:measKL(m),skip:q.id})}
  q.meas=m;q.measV=m?colourVerdicts(q):[];return m}
/* what the tagger is told: for a patterned cloth its ground (the whole picture's median of a white/blue stripe is a grey nobody wears) */
const measHint=m=>m&&{lab:m.parts?m.parts[0].lab:m.lab,hex:m.parts?m.parts[0].hex:m.hex,ref:m.ref,src:m.src,near:m.parts&&m.groundNear?m.groundNear:m.near,...(m.parts?{parts:m.parts.map(p=>({role:p.role,hex:p.hex,share:p.share}))}:{})};

/* ---- a patterned cloth's colours, measured one by one (2026-11-14, the owner's design): a white/blue stripe must read white and blue,
   not the grey in between. With a band reading (detect.js analyzeSett, or Claude's reading coloured from the pixels) the widest band
   is the ground and the band furthest from it the stripe or check; with none yet, the cloth's pixels are split in two (measSplit). The
   ground is compared with the main colour, the stripe with the second. A one-colour weave (twill, a dobby) is measured whole. ---- */
const MULTI_PATS=()=>[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS,'paisley','tonal-check'];
const multiCol=i=>!!i&&MULTI_PATS().includes(patBase(i.pattern)||'solid');
function measureParts(q,m){if(!multiCol(q)||!m||!m.px)return null;const L=h=>rgbLab(...hexRgb(h));
  const s=q.sett&&!q.settOff?q.sett:null;let seed=null;
  // the reading's colours come from another picture or exposure (the item photo's box, Claude's hexes): they only seed the split of
  // this picture's own pixels, moved by the difference between the two medians
  if(s&&s.bands&&s.bands.length>=2){const g=s.bands.reduce((a,b)=>b[1]>a[1]?b:a),gl=L(g[0]);let ln=null,bd=-1;
    for(const b of s.bands)if(b!==g){const dd=dE00(L(b[0]),gl);if(dd>bd){bd=dd;ln=b}}
    if(ln&&bd>=6)seed=[gl,L(ln[0])]}
  else if(s&&s.motif&&s.motif.figs[0])seed=[L(s.motif.ground),L(s.motif.figs[0].cols[0])];
  const parts=measSplit(m.px,seed);if(!parts)return null;
  // two colours in about equal shares (a repp tie's navy and blue): which is the "ground" is the tagger's call, so the parts are named
  // in the order nearest the tags
  if(parts[0].share<.65&&q.secondaryColor&&COLORS[q.secondaryColor]&&COLORS[primaryCol(q)]){const P=labOf(primaryCol(q)),S=labOf(q.secondaryColor),[a,b]=parts;
    if(dE00(a.lab,S)+dE00(b.lab,P)<dE00(a.lab,P)+dE00(b.lab,S))return [{...b,role:'ground'},{...a,role:'line'}]}
  return parts}
/* the cloth's pixels in two groups (k-means in Lab, from its two most different tenths, or from the reading's two colours): the larger
   is the ground; a thin stripe is blurred with the ground beside it, so of the other group the half furthest from the ground gives its
   colour */
function measSplit(px,seed){if(px.length<60)return null;const n=px.length,st=Math.max(1,Math.floor(n/4000)),P=[];for(let j=0;j<n;j+=st)P.push(px[j]);
  const md=k=>{const v=P.map(p=>p[k]).sort((a,b)=>a-b);return v[v.length>>1]},m=[md(0),md(1),md(2)],dm=p=>Math.hypot(p[0]-m[0],p[1]-m[1],p[2]-m[2]);
  const far=P.slice().sort((a,b)=>dm(b)-dm(a)),c1=far[Math.floor(far.length*.05)];let A=m.slice(),B=c1.slice(),lab=new Uint8Array(P.length);
  if(seed){const sm=[0,1,2].map(k=>seed[0][k]*.8+seed[1][k]*.2),off=m.map((v,k)=>v-sm[k]);A=seed[0].map((v,k)=>v+off[k]);B=seed[1].map((v,k)=>v+off[k])}
  for(let it=0;it<10;it++){const sa=[0,0,0,0],sb=[0,0,0,0];P.forEach((p,j)=>{const da=Math.hypot(p[0]-A[0],p[1]-A[1],p[2]-A[2]),db=Math.hypot(p[0]-B[0],p[1]-B[1],p[2]-B[2]);lab[j]=db<da?1:0;const s=lab[j]?sb:sa;s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++});
    if(!sa[3]||!sb[3])return null;A=sa.slice(0,3).map(v=>v/sa[3]);B=sb.slice(0,3).map(v=>v/sb[3])}
  let nb=lab.reduce((s,v)=>s+v,0);if(nb>P.length/2){[A,B]=[B,A];lab=lab.map(v=>1-v);nb=P.length-nb}
  if(dE00(A,B)<8||nb<P.length*.04)return null;   // one colour, or a few specks
  const G=P.filter((_,j)=>!lab[j]),gm=[0,1,2].map(k=>{const v=G.map(p=>p[k]).sort((a,b)=>a-b);return v[v.length>>1]});
  const Ls=P.filter((_,j)=>lab[j]).sort((a,b)=>Math.hypot(b[0]-gm[0],b[1]-gm[1],b[2]-gm[2])-Math.hypot(a[0]-gm[0],a[1]-gm[1],a[2]-gm[2])),half=Ls.slice(0,Math.max(6,Ls.length>>1));
  const lm=[0,1,2].map(k=>half.reduce((s,p)=>s+p[k],0)/half.length),r=v=>v.map(x=>Math.round(x*10)/10);
  return [{role:'ground',lab:r(gm),hex:labHex(gm),share:Math.round(100*(1-nb/P.length))/100,src:'pixels'},{role:'line',lab:r(lm),hex:labHex(lm),share:Math.round(100*nb/P.length)/100,src:'pixels'}]}

/* ---- the close-up's sharpness (0-1): the fine detail's share of the detail at four times the scale, on a 400 px copy. A soft close-up
   (a crop of a web photo, a shaken phone) has lost its fine detail; a plain cloth photographed sharply still has its grain and noise.
   Under BLUR_SHARP the card warns that the weave can't be read (the walkthrough's pinstripe close-up was read as a check). ---- */
const BLUR_SHARP=.25,sharpMemo=new WeakMap();
function sharpness(c){if(!c||!c.width)return null;if(sharpMemo.has(c))return sharpMemo.get(c);
  const grey=(S)=>{const k=Math.min(1,S/Math.max(c.width,c.height)),w=Math.max(8,Math.round(c.width*k)),h=Math.max(8,Math.round(c.height*k)),t=document.createElement('canvas');t.width=w;t.height=h;
    const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data,g=new Float32Array(w*h);for(let j=0;j<w*h;j++)g[j]=.299*d[4*j]+.587*d[4*j+1]+.114*d[4*j+2];return {g,w,h}};
  const lap=({g,w,h})=>{let s=0,n=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const j=y*w+x;s+=Math.abs(4*g[j]-g[j-1]-g[j+1]-g[j-w]-g[j+w]);n++}return n?s/n:0};
  const fine=lap(grey(400)),coarse=lap(grey(100)),v=Math.round(100*fine/(fine+coarse+1e-6))/100;sharpMemo.set(c,v);return v}

/* ---- the verdict on each colour: does the measurement agree with the tag, and how sure is it (2026-11-14, the owner's design: colour
   recognition runs on every item and, when confident, overrules the tag; when unsure it only asks). The confidence (0-1) comes from:
   a white reference in the picture, the close-up's sharpness, how even the cloth (or the band) is, how much nearer the measured colour
   is than the tagged one (ΔE00), how near it is at all, and whether the item photo agrees with the close-up. MEAS_AUTO is the
   confidence that changes the colour, chosen on the owner's wardrobe so auto-changes were right 95% of the time; between MEAS_FLAG_GAP
   and that, the card asks ("Measured: charcoal?") without changing it. A field set by hand (q.edited) is never overruled. ---- */
/* calibrated 2026-11-14 on the owner's 42 items with a close-up (a read-only copy of his backup) and the walkthrough's 24: each item
   measured as tagged and as tagged with its nearest other colour, and his own corrections replayed. No confidence reached 95% right:
   the most confident wrong change (his pale pink herringbone shirt "white", 0.69) sat above every right one, so MEAS_AUTO is above
   all of them (no colour changed by itself on either set) and stays there until the measuring earns it; MEAS_FLAG (0.4) asks about 4
   of his 42 correct main colours (the old "Use …" offer came on 13 of them; on the walkthrough 1 of 24, was 14) */
const MEAS_AUTO=.75,MEAS_FLAG=.4,MEAS_FLAG_GAP=3;
const clamp01=v=>Math.max(0,Math.min(1,v));
function measConf({gap,best,spread,sharp,ref,src,agree,part,cal}){
  const g=clamp01((gap-1)/8),nr=clamp01((12-best)/8),u=spread==null?.6:clamp01((16-spread)/12),s=sharp==null?.7:clamp01((sharp-BLUR_SHARP*.8)/(.55-BLUR_SHARP*.8));
  // cal: how many of the two colours (the tag's, the measured one's) are known from the owner's own plain items; a bare swatch is only
  // a name's usual shade (the owner's pale pink shirt measured far from the app's pink, and nearest white)
  const base=Math.sqrt(g*nr)*(.65+.35*u)*(.55+.45*s)*(ref?1:src==='closeup'?.88:.6)*(agree===true?1.1:agree===false?.6:1)*(part?.85:1)*[.6,.8,1][cal??2];
  return Math.round(100*clamp01(base))/100}
function colourVerdicts(q){const m=q.meas;if(!m||!m.lab||!q.type)return [];const out=[],kL=measKL(m);
  const parts=m.parts,fields=[['primaryColor',parts?parts.find(p=>p.role==='ground'):null]];
  if(parts&&q.secondaryColor)fields.push(['secondaryColor',parts.find(p=>p.role==='line')]);
  for(const [f,part] of fields){const tag=f==='primaryColor'?primaryCol(q):q[f];if(!tag||!COLORS[tag])continue;const accent=f!=='primaryColor',lab=part?part.lab:m.lab;
    const near=nearestCols(q.type,lab,m.ref,{kL,skip:q.id,accent}),best=near[0];if(!best)continue;
    const dTag=Math.round(dE00(lab,colRef(tag,q.type,q.id,accent),kL)*10)/10,gap=Math.round((dTag-best.d)*10)/10;
    let agree=null;if(m.photo&&!part){const pn=nearestCols(q.type,m.photo.lab,false,{kL:2,skip:q.id})[0];agree=!!pn&&(pn.c===best.c||dE00(m.photo.lab,m.lab,3)<5)}
    const cal=(accent?0:!!calibLab(tag,q.type,q.id)+!!calibLab(best.c,q.type,q.id));
    const conf=best.c===tag?0:measConf({gap,best:best.d,spread:part?null:m.spread,sharp:m.sharp,ref:m.ref,src:m.src,agree,part:!!part,cal});
    const ai=aiFor(q,f,tag,best.c),mode=verdictMode({same:best.c===tag,inList:colsFor(q.type,accent).includes(best.c),trusted:m.src==='closeup'||!!m.ref,ref:!!m.ref,conf,canFlag:gap>=MEAS_FLAG_GAP&&best.d<=FAR_DE},ai);
    out.push({f,from:tag,to:best.c,d:best.d,dTag,gap,conf,mode,part:part?part.role:null,lab,cal,...(ai?{ai:ai.c}:{})})}
  return out}
/* ---- Claude's own signals in the verdict (2026-11-14, the owner's "Do 2"): how sure Claude was of the colour and its runner-up
   (q.tagAI, from the same answer: no extra call) weigh with the measurement. Only while the field still holds Claude's answer.
   - Claude unsure (low) and its runner-up is the measured colour: the measurement decides from AI_LOW_AUTO (close-up or white
     reference), and asks from AI_LOW_FLAG
   - Claude sure (high) and no white reference: never changed; asked only from AI_HIGH_FLAG
   - otherwise (medium, no signals, a runner-up that is a third colour): the measurement alone, as before (MEAS_AUTO, MEAS_FLAG)
   A runner-up that agrees is no evidence by itself: tagging again with the close-up tells Claude the measurement and asks it to
   name the measured colour as runner-up when it picks another (worker.js), so it nearly always agrees. ---- */
/* calibrated 2026-11-14 by replaying mocked answers over the owner's 42 close-up items and the walkthrough's 24 (no saved item had
   Claude's confidence yet): 0 wrong changes on both when Claude, right, says high or medium; recall is small (the measuring itself
   matches his tags 40% of the time) and is an estimate until items are tagged with the signals saved (item.tagAI) */
const AI_LOW_AUTO=.55,AI_LOW_FLAG=.25,AI_HIGH_FLAG=.6;
function aiFor(q,f,tag,to){const t=q.tagAI;if(f!=='primaryColor'||!t||t.col!==tag||!t.conf||!t.conf.primaryColor)return null;
  return {c:t.conf.primaryColor,agree:!!t.alt&&t.alt===to}}
function verdictMode(x,ai){if(x.same||!x.inList)return null;const c=ai&&ai.c;
  if(c==='high'&&!x.ref)return x.canFlag&&x.conf>=AI_HIGH_FLAG?'flag':null;
  if(c==='low'&&ai.agree&&x.trusted&&x.conf>=AI_LOW_AUTO)return 'auto';
  if(x.trusted&&x.conf>=MEAS_AUTO)return 'auto';
  return x.canFlag&&x.conf>=(c==='low'?AI_LOW_FLAG:MEAS_FLAG)?'flag':null}
/* what of Claude's answer is kept (on the card, then the saved item): the colour it gave, how sure it was of each field, its
   runner-ups, and whether it was told the measurement (seen). tag-many gives one confidence for the whole item */
function aiSignals(ai,seen){if(!ai)return null;const c=ai.conf||(typeof ai.confidence==='string'?{type:ai.confidence,primaryColor:ai.confidence,pattern:ai.confidence}:null);
  return {col:aiFields(ai).primaryColor,conf:c?{type:c.type||null,primaryColor:c.primaryColor||null,pattern:c.pattern||null}:null,alt:ai.altColor||null,altPat:ai.altPattern||null,seen:!!seen}}
/* the card takes a confident measurement: the colour changes and the card says so with an Undo; a field set by hand, or one whose
   change was undone, stays */
function applyMeasured(q){if(!q||q.manual)return [];const done=[];q.auto=q.auto||{};
  for(const f of Object.keys(q.auto))if(q[f]!==q.auto[f].to)delete q.auto[f];   // Claude's answer (tagging again) or the owner changed it since
  for(const v of q.measV||[]){if(v.mode!=='auto'||(q.edited&&q.edited[v.f])||(q.autoUndo&&q.autoUndo[v.f]===v.to)||q[v.f]===v.to)continue;
    q.auto[v.f]={from:q[v.f],to:v.to,src:q.meas.src,conf:v.conf,...(v.ai?{ai:v.ai}:{})};q[v.f]=v.to;done.push(v.f)}
  if(done.length){if(q.texCanvas&&typeof generateSwatch==='function')generateSwatch(q);q.measV=colourVerdicts(q)}
  return done}
function undoMeasured(i,f){const q=queue[i];if(!q||!q.auto||!q.auto[f])return;const a=q.auto[f];q[f]=a.from;delete q.auto[f];q.autoUndo={...q.autoUndo,[f]:a.to};q.edited={...q.edited,[f]:true};
  if(q.texCanvas&&typeof generateSwatch==='function')generateSwatch(q);q.measV=colourVerdicts(q);renderAdd()}
/* measure the card and take what is sure (the first tag, tagging again from the close-up, Try again) */
function measureAndApply(q){measureCard(q);missedPattern(q);return applyMeasured(q)}

/* ---- tagging again once the close-up is in: both photos and the measurement go to the tagger; fields the owner has set by
   hand stay, the rest take the new answer, and the card says what changed ---- */
const TAG_FIELDS=['type','primaryColor','secondaryColor','tertiaryColor','pattern'];
const fieldLabel={type:'item',primaryColor:'colour',secondaryColor:'second colour',tertiaryColor:'third colour',pattern:'pattern'};
const valName=(k,v)=>!v?'none':k==='type'?(TYPES[v]||v).toLowerCase():k==='pattern'?patName(v):colName(v);
/* what the tagger answered, as the card's values (the same normalising as a first tag) */
function aiFields(ai){return {type:ai.type,primaryColor:COLORS[ai.primaryColor]?ai.primaryColor:'grey',secondaryColor:ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null,
  tertiaryColor:ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null,pattern:normPat(ai.type,ai.pattern)}}
function takeExtras(q,ai,seen){q.tagAI=aiSignals(ai,seen);Object.assign(q,{conf:ai.conf||null,altColor:ai.altColor||null,altPattern:ai.altPattern||null,newColor:ai.newColor||null,newPattern:ai.newPattern||null,clothBox:ai.clothBox||q.clothBox||null,
    patternBox:ai.patternBox||q.patternBox||null,weave:ai.weave||q.weave||null});
  q.aiTag={...aiFields(ai)};readSett(q)}
async function closeTagImg(q){const r=closeRead(q.raw.tex),g=r.ref?r.gains:(q.wbOff?null:q.wb);return applyWb(q.raw.tex,g).toDataURL('image/jpeg',TAG_Q)}
async function refineFromCloseup(i){const q=queue[i];if(!q||!q.raw||!q.raw.tex)return;measureCard(q);
  if(!q.tagImg||!localStorage.getItem('worker_url')){renderAdd();return}
  q.refining=1;renderAdd();
  const hint=measHint(q.meas),ai=await ask(q.tagImg,{closeup:await closeTagImg(q),measured:hint,wb:!!(q.wb&&!q.wbOff)});const k=queue.indexOf(q);q.refining=0;
  if(!ai||!ai.type){q.refineNote=aiError||'Tagging again from the close-up didn’t work; the first tags stay.';if(k>=0)renderAdd();return}
  const f=aiFields(ai),changes=[];
  for(const key of TAG_FIELDS)if(!(q.edited&&q.edited[key])&&f[key]!==q[key]){changes.push(`${fieldLabel[key]} ${valName(key,q[key])} → ${valName(key,f[key])}`);q[key]=f[key]}
  if(changes.some(c=>c.startsWith('item ')))q.pattern=normPat(q.type,q.pattern);
  takeExtras(q,ai,!!hint);measureAndApply(q);q.model=ai.model||q.model;
  q.refineNote=changes.length?'Updated from the close-up: '+changes.join(', ')+'.':'The close-up confirmed the tags.';if(k>=0)renderAdd();
  readPatternWithClaude(q)}

/* ---- the card's tagging notes: how sure Claude was, its runner-up (one tap to take it), the measured colour, and an offer to
   add a colour or pattern when none of the listed ones fits ---- */
const confTxt=c=>c?['type','primaryColor','pattern'].filter(k=>c[k]&&c[k]!=='high').map(k=>`${fieldLabel[k]}: ${c[k]} confidence`).join(' · '):'';
function tagNotes(q,i){if(q.manual)return '';const out=[];if(q.meas)q.measV=colourVerdicts(q);   // against the tags as they are now
  if(q.refining)out.push('<p class="tagnote mut"><small>Tagging again with the close-up…</small></p>');
  else if(q.refineNote)out.push(`<p class="tagnote"><small>${esc(q.refineNote)}</small></p>`);
  const ct=confTxt(q.conf),alts=[q.altColor&&q.altColor!==q.primaryColor&&colsFor(q.type).includes(q.altColor)?`<button type="button" class="chipbtn" onclick="setq(${i},'primaryColor','${q.altColor}')">or ${esc(colName(q.altColor))}</button>`:'',
    q.altPattern&&q.altPattern!==q.pattern&&(PATS_BY[q.type]||[]).includes(q.altPattern)?`<button type="button" class="chipbtn" onclick="setq(${i},'pattern','${q.altPattern}')">or ${esc(patName(q.altPattern))}</button>`:''].join('');
  if(ct||alts)out.push(`<p class="tagnote mut"><small>${ct}</small>${alts}</p>`);
  out.push(settNote(q,i));
  const m=q.meas;
  if(m&&m.near&&m.near.length){const n=m.near,pv=(q.measV||[]).filter(v=>v.part);
    out.push(pv.length?`<p class="tagnote measrow">${m.parts.map(p=>`<span class="msw" style="background:${p.hex}" title="${p.hex}"></span>`).join('')}<small>Measured ${m.src==='closeup'?'in the close-up':'in the photo'}${m.ref?' (white reference)':''}: ${pv.map(v=>`${v.part==='ground'?'ground':'stripe'} closest to ${esc(colName(v.to))}`).join(', ')}</small></p>`
      :`<p class="tagnote measrow"><span class="msw" style="background:${m.hex}" title="${m.hex}"></span><small>Measured ${m.src==='closeup'?'in the close-up':'in the photo'}${m.ref?' (white reference)':''}: closest ${n.map(x=>`${esc(colName(x.c))} (ΔE ${x.d})`).join(', ')}</small></p>`)}
  // changed by the measurement (with Undo), or asked about when it is not sure
  for(const [f,a] of Object.entries(q.auto||{}))out.push(`<div class="offer measauto" data-f="${f}"><small>Changed ${f==='primaryColor'?'':fieldLabel[f]+' '}${esc(colName(a.from))} → <b>${esc(colName(a.to))}</b> (measured from ${a.src==='closeup'?'your close-up':'your photo'}${a.ai==='low'?'; Claude wasn’t sure':''})</small><button type="button" class="chipbtn" onclick="undoMeasured(${i},'${f}')">Undo</button></div>`);
  for(const v of q.measV||[])if(v.mode==='flag'&&!(q.edited&&q.edited[v.f])&&!(q.auto&&q.auto[v.f]))out.push(`<div class="offer measalt" data-f="${v.f}"><small>Measured${v.f==='primaryColor'?'':` ${fieldLabel[v.f]}`}: <b>${esc(colName(v.to))}</b>?</small><button type="button" class="chipbtn" onclick="setq(${i},'${v.f}','${v.to}')">Use ${esc(colName(v.to))}</button></div>`);
  const mp=q.missed&&q.raw&&q.missed.c===q.raw.tex?q.missed.p:null;   // (missedPattern, worked out when the card was measured)
  if(mp&&(patBase(q.pattern)||'solid')==='solid'&&!(q.edited&&q.edited.pattern))out.push(`<div class="offer measpat"><small>The close-up shows ${/check|pane/.test(mp)?'a check':'stripes'}: <b>${esc(patName(mp))}</b>?</small><button type="button" class="chipbtn" onclick="setq(${i},'pattern','${mp}')">Use ${esc(patName(mp))}</button></div>`);
  if(m&&m.src==='closeup'&&m.sharp!=null&&m.sharp<BLUR_SHARP&&TEXTURE_TYPES.includes(q.type))out.push(`<p class="tagnote blurnote"><small>The close-up is too blurry to read the weave: retake it?</small></p>`);
  if(FABRIC.includes(q.type)||COLS_BY[q.type]){const pv=(q.measV||[]).find(v=>v.f==='primaryColor'),far=m&&m.src==='closeup'&&!(m.sharp!=null&&m.sharp<BLUR_SHARP)&&pv&&pv.d>FAR_DE;   // (a blurry or photo-only measurement is no reason to add a colour)
    if(q.colForm)out.push(newColForm(q,i));
    else if(q.newColor||far)out.push(`<div class="offer"><small>${q.newColor?`None of your colours quite fit: Claude calls it <b>${esc(q.newColor.name)}</b>${q.newColor.why?`, ${esc(q.newColor.why)}`:''}.`:'The measured colour is far from every colour for this item.'}</small><button type="button" class="chipbtn" onclick="openColForm(${i})">Add as a new colour</button></div>`)}
  if(PATS_BY[q.type]){if(q.patForm)out.push(newPatForm(q,i));
    else if(q.newPattern)out.push(`<div class="offer"><small>No listed pattern fits: Claude calls it <b>${esc(q.newPattern.name)}</b>${q.newPattern.why?`: ${esc(q.newPattern.why)}`:''}.</small><button type="button" class="chipbtn" onclick="openPatForm(${i})">Add this pattern</button></div>`)}
  return out.join('')}

/* ---- adding a colour or a pattern (settings.custom, synced; see applyCustom in core.js) ---- */
const COL_GROUPS=[['suit','blazer','pants'],['overcoat','raincoat'],['shirt'],['tie'],['socks'],['shoes','belt']];
const groupOf=t=>COL_GROUPS.find(g=>g.includes(t))||[t];
function openColForm(i){const q=queue[i];q.colForm={name:q.newColor?q.newColor.name:'',hex:q.meas?q.meas.hex:COLORS[q.primaryColor]||'#888888',types:groupOf(q.type),accent:false};
  const lab=rgbLab(...hexRgb(q.colForm.hex));q.colForm.base=Object.keys(COLORS).filter(c=>!CUSTOM_COL[c]&&!SHIRT_ONLY.includes(c)).sort((a,b)=>dE00(lab,labOf(a))-dE00(lab,labOf(b)))[0];renderAdd()}
function newColForm(q,i){const f=q.colForm,bases=Object.keys(COLORS).filter(c=>!CUSTOM_COL[c]&&!SHIRT_ONLY.includes(c)).sort();
  return `<div class="newform"><b>New colour</b>
  <label>Name <input type="text" maxlength="24" value="${esc(f.name)}" oninput="queue[${i}].colForm.name=this.value"></label>
  <label>Shade <input type="color" value="${f.hex}" oninput="queue[${i}].colForm.hex=this.value"></label>
  <label>Behaves like <select onchange="queue[${i}].colForm.base=this.value">${bases.map(c=>`<option value="${c}"${c===f.base?' selected':''}>${esc(colName(c))}</option>`).join('')}</select></label>
  <small class="mut">The outfit rules treat it like this colour; it keeps its own shade in the drawings.</small>
  <div class="typechecks">${Object.keys(COLS_BY).map(t=>`<label><input type="checkbox" ${f.types.includes(t)?'checked':''} onchange="colFormType(${i},'${t}',this.checked)"> ${TYPES[t]}</label>`).join('')}</div>
  <label><input type="checkbox" ${f.accent?'checked':''} onchange="queue[${i}].colForm.accent=this.checked"> Also offer it for stripes and motifs</label>
  <p class="mut formerr" id="colerr-${i}"></p>
  <div class="btns"><button type="button" class="pri" onclick="saveColForm(${i})">Add colour</button><button type="button" onclick="queue[${i}].colForm=null;renderAdd()">Cancel</button></div></div>`}
function colFormType(i,t,on){const f=queue[i].colForm;f.types=on?[...new Set([...f.types,t])]:f.types.filter(x=>x!==t)}
async function addCustomColor({name,hex,base,types,accent}){name=String(name||'').trim();const key=ownColKey(name);
  if(key.length<5)throw new Error('Give it a name of at least two letters.');if(COLORS[key])throw new Error('There is already a colour with that name.');
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('Pick a shade.');if(!COLORS[base]||CUSTOM_COL[base])throw new Error('Choose what it behaves like.');
  if(!types.length)throw new Error('Tick at least one kind of item.');
  const cu=settings.custom||{};settings.custom={...cu,colors:[...(cu.colors||[]),{key,name,hex:hex.toLowerCase(),base,types,accent:!!accent}]};
  applyCustom(settings.custom);await saveUserSettings();return key}
async function saveColForm(i){const q=queue[i];try{const key=await addCustomColor(q.colForm);q.colForm=null;q.newColor=null;q.primaryColor=key;q.edited={...q.edited,primaryColor:true};
  if(q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);renderAdd();toast(`${colName(key)} added to your colours.`)}catch(e){const el=$('#colerr-'+i);if(el)el.textContent=e.message}}
/* a new pattern's "drawn like" from the words in its name and description (2026-11-13: the owner's "fine worsted twill" and "melange
   twill" were left drawn like solid, so the outfit pictures painted them plain): the longest listed pattern named in them, a few
   other words for one, else what the card was tagged */
const PAT_WORDS=[[/prince of wales|glen ?plaid/i,'glen-check'],[/plaid|tartan/i,'check'],[/serge|gabardine|cavalry/i,'twill'],[/pin ?stripe/i,'pinstripe'],[/chalk ?stripe/i,'chalk-stripe'],[/dots?\b|spots?\b/i,'polka-dot'],[/neat|micro.?print/i,'foulard']];
function guessPatBase(name,desc,type,fallback){const t=`${name||''} ${desc||''}`,ok=p=>(PATS_BY[type]||[]).includes(p)&&!CUSTOM_PAT[p];
  const list=(PATS_BY[type]||[]).filter(p=>p!=='solid'&&p!=='other'&&ok(p)).sort((a,b)=>b.length-a.length);
  for(const p of list)if(new RegExp('\\b'+p.replace(/-/g,'[- ]?')+'\\b','i').test(t))return p;
  for(const [re,p] of PAT_WORDS)if(re.test(t)&&ok(p))return p;
  return fallback}
function openPatForm(i){const q=queue[i],name=q.newPattern?q.newPattern.name:'',desc=q.newPattern?q.newPattern.why:'';
  q.patForm={name,desc,base:guessPatBase(name,desc,q.type,q.pattern&&!CUSTOM_PAT[q.pattern]?q.pattern:'solid'),types:[q.type]};renderAdd()}
/* while the base was not picked by hand, it follows the name and description as they are typed */
function patFormText(i,field,v){const q=queue[i],f=q.patForm;f[field]=v;if(f.baseSet)return;const b=guessPatBase(f.name,f.desc,q.type,null);
  if(b&&b!==f.base){f.base=b;const s=document.querySelector(`#patbase-${i}`);if(s)s.value=b}}
function newPatForm(q,i){const f=q.patForm,bases=(PATS_BY[q.type]||['solid']).filter(p=>!CUSTOM_PAT[p]);
  return `<div class="newform"><b>New pattern</b>
  <label>Name <input type="text" maxlength="24" value="${esc(f.name)}" oninput="patFormText(${i},'name',this.value)"></label>
  <label>How it looks <input type="text" maxlength="150" value="${esc(f.desc)}" oninput="patFormText(${i},'desc',this.value)"></label>
  <label>Drawn like <select id="patbase-${i}" onchange="queue[${i}].patForm.base=this.value;queue[${i}].patForm.baseSet=true">${bases.map(p=>`<option value="${p}"${p===f.base?' selected':''}>${esc(patLabel(p))}</option>`).join('')}</select></label>
  <small class="mut">The drawings and the outfit rules use this pattern for it; your close-up shows the real thing.</small>
  <div class="typechecks">${Object.keys(PATS_BY).map(t=>`<label><input type="checkbox" ${f.types.includes(t)?'checked':''} onchange="patFormType(${i},'${t}',this.checked)"> ${TYPES[t]}</label>`).join('')}</div>
  <p class="mut formerr" id="paterr-${i}"></p>
  <div class="btns"><button type="button" class="pri" onclick="savePatForm(${i})">Add pattern</button><button type="button" onclick="queue[${i}].patForm=null;renderAdd()">Cancel</button></div></div>`}
function patFormType(i,t,on){const f=queue[i].patForm;f.types=on?[...new Set([...f.types,t])]:f.types.filter(x=>x!==t)}
async function addCustomPattern({name,desc,base,types}){name=String(name||'').trim();const key=ownPatKey(name);
  if(key.length<6)throw new Error('Give it a name of at least two letters.');if(CUSTOM_PAT[key]||Object.values(PATS_BY).some(l=>l.includes(key)))throw new Error('There is already a pattern with that name.');
  types=types.filter(t=>PATS_BY[t]&&PATS_BY[t].includes(base));if(!types.length)throw new Error('Tick at least one kind of item that has the "drawn like" pattern.');
  const cu=settings.custom||{};settings.custom={...cu,patterns:[...(cu.patterns||[]),{key,name,desc:String(desc||'').trim().slice(0,150),base,types}]};
  applyCustom(settings.custom);await saveUserSettings();return key}
async function savePatForm(i){const q=queue[i];try{const key=await addCustomPattern(q.patForm);q.patForm=null;q.newPattern=null;q.pattern=key;q.edited={...q.edited,pattern:true};renderAdd();toast(`${patName(key)} added to your patterns.`)}
  catch(e){const el=$('#paterr-'+i);if(el)el.textContent=e.message}}
/* Settings: the colours and patterns you added; one no item uses can be removed */
function renderCustomUI(){const el=$('#custom-list');if(!el)return;const cu=settings.custom||{},cols=cu.colors||[],pats=cu.patterns||[];
  const used=(k,f)=>items.filter(i=>f(i,k)).length;
  el.innerHTML=!cols.length&&!pats.length?'<p class="mut"><small>None yet. When a photo shows a colour or pattern the lists lack, the Add card offers to add it.</small></p>':
    [...cols.map(c=>{const n=used(c.key,(i,k)=>[i.primaryColor,i.secondaryColor,i.tertiaryColor].includes(k));return `<div class="custrow"><span class="msw" style="background:${c.hex}"></span><span><b>${esc(c.name)}</b><br><small class="mut">behaves like ${esc(colName(c.base))} · ${c.types.map(t=>TYPES[t]).join(', ')}${n?` · ${n} item${n>1?'s':''}`:''}</small></span>${n?'':`<button type="button" onclick="removeCustom('colors','${c.key}')">Remove</button>`}</div>`}),
     ...pats.map(p=>{const n=used(p.key,(i,k)=>i.pattern===k);return `<div class="custrow"><span class="msw pat">▦</span><span><b>${esc(p.name)}</b><br><small class="mut">drawn like ${esc(patLabel(p.base))} · ${p.types.map(t=>TYPES[t]).join(', ')}${n?` · ${n} item${n>1?'s':''}`:''}</small></span>${n?'':`<button type="button" onclick="removeCustom('patterns','${p.key}')">Remove</button>`}</div>`})].join('')}
async function removeCustom(kind,key){const cu=settings.custom||{};settings.custom={...cu,[kind]:(cu[kind]||[]).filter(x=>x.key!==key)};applyCustom(settings.custom);cache={};await saveUserSettings();renderCustomUI()}

/* ---- what the tagger learns from: when an AI-tagged card is saved with a field changed, the change is kept (the latest 60)
   and the latest 20 go with every tagging request; the counts give the accuracy on the stats page ---- */
async function recordTagResult(q,it){if(!q.ai||!q.aiTag)return;const st={n:0,wrong:{},...(settings.tagStats||{})};st.wrong={...st.wrong};st.n++;
  const fixes=[...(settings.tagFixes||[])];
  for(const f of ['type','primaryColor','secondaryColor','pattern']){const from=q.aiTag[f]||'none',to=it[f]||'none';if(f==='pattern'&&!FABRIC.includes(it.type))continue;
    if(from!==to){st.wrong[f]=(st.wrong[f]||0)+1;if(from!=='none'||to!=='none')fixes.push({field:f,type:it.type,from,to,id:it.id,t:Date.now()})}}
  settings.tagStats=st;settings.tagFixes=fixes.slice(-60);await saveUserSettings()}
function tagStatsCard(){const st=settings.tagStats||{n:0,wrong:{}},fx=(settings.tagFixes||[]).slice(-8).reverse();
  const pct=f=>st.n?Math.round(100*(1-(st.wrong[f]||0)/st.n)):null;
  return `<section class="card st-card" id="st-tagging"><h3>Photo tagging</h3>
  ${st.n?`<p class="mut"><small>Of the ${st.n} item${st.n===1?'':'s'} tagged by AI and saved since this was added, how often you kept each tag as it was.</small></p>
    ${['type','primaryColor','pattern','secondaryColor'].map(f=>`<div class="st-miss"><b>${fieldLabel[f][0].toUpperCase()+fieldLabel[f].slice(1)}</b><span class="mut">${pct(f)}% right</span><span class="st-bar"><i style="width:${Math.max(2,pct(f))}%"></i></span></div>`).join('')}`
    :'<p class="mut"><small>No AI-tagged items saved yet since this was added.</small></p>'}
  ${fx.length?`<p class="mut" style="margin-top:8px"><small>Your latest corrections (the tagger is shown them):</small></p><ul class="fixlist">${fx.map(f=>`<li><small>${esc(TYPES[f.type]||f.type)} ${fieldLabel[f.field]}: ${esc(valName(f.field,f.from==='none'?null:f.from))} → <b>${esc(valName(f.field,f.to==='none'?null:f.to))}</b></small></li>`).join('')}</ul>`:''}
  </section>`}

/* ---- what one tagging call costs (the colour picker's "Ask Claude" shows it): Claude Opus 5.5 prices, visual tokens of the photo and
   its close-up, and a usual answer. (The accuracy check that used it, Settings → Photo tagging → Advanced, was removed 2026-11-13.) ---- */
const PRICE_IN=4,PRICE_OUT=20;   // Claude Opus 5.5, $ per million tokens (the worker's default model)
/* visual tokens of a picture (28-pixel patches, capped like the API) */
const visTok=(w,h)=>{const s=Math.min(1,2576/Math.max(w,h));w*=s;h*=s;const t=Math.ceil(w/28)*Math.ceil(h/28);return Math.min(4784,t)};
/* (2026-11-14) at the sizes really sent: the sharp photo (TAG_MAX, a phone's 4:3) and the sharp close-up (CLOSE_MAX); it assumed 1024 and
   half a 640 close-up, about 30% low (the audit) */
function benchEstimate(n,{img=[TAG_MAX,TAG_MAX*.75],close=[CLOSE_MAX,CLOSE_MAX*.75]}={}){const per=(visTok(...img)+(close?visTok(...close):0)+4000)*PRICE_IN/1e6+2500*PRICE_OUT/1e6;return n*per}

/* ---- the full pattern (detect.js analyzeSett): read in colour from the sharp item photo (Claude's patternBox: the largest
   area that is all patterned cloth), else from the close-up, else from Claude's own reading (weave.colours). Claude's
   weave also gives the direction (for a close-up, whose angle says nothing), the repeats across the item (the drawing's
   scale on the figure) and a description for the photo generator. ---- */
const SETT_PATS={tie:[...STRIPE_PATS,...CHECK_PATS,'tonal-check','other',...MOTIF_PATS],shirt:[...STRIPE_PATS,...CHECK_PATS,'other',...TEXTURE_PATS],suit:[...STRIPE_PATS,...CHECK_PATS],blazer:[...STRIPE_PATS,...CHECK_PATS],pants:[...STRIPE_PATS,...CHECK_PATS]};
const settable=(type,pat,weave)=>{const p=patBase(pat)||'solid';return p!=='solid'&&((SETT_PATS[type]||[]).includes(p)||!!(weave&&weave.layout&&FABRIC.includes(type)))};
const DIR_ANG={'upper-left to lower-right':-45,'lower-left to upper-right':45,vertical:0,horizontal:90};
const WEAVE_W={hairline:.02,narrow:.05,medium:.12,wide:.25};
function settFromWeave(w){const c=(w&&w.colours||[]).filter(x=>/^#[0-9a-f]{6}$/i.test(x.hex));if(c.length<2)return null;const tot=c.reduce((s,x)=>s+(WEAVE_W[x.width]||.12),0);
  return {v:2,a:DIR_ANG[w.direction]??-45,bands:c.map(x=>[x.hex.toLowerCase(),+((WEAVE_W[x.width]||.12)/tot).toFixed(3)]),cross:null,cr:1,src:'claude'}}
/* the sett for a card, or for a saved item from its kept pictures */
/* both pictures when there are both: the item photo gives the scale and the direction; a close-up that shows at least one and a half
   repeats resolves fine stripes far better (a pinstripe a pixel wide in the whole-jacket photo is a crisp line up close), so
   its bands and crossing lines are used */
/* white balance and, when the picture has a white reference (a white shirt under the tie, a white wall, paper), exposure set
   from it too: an underexposed photo otherwise reads every band too dark (a cream reads grey). At most 1.6x, in linear light. */
/* (2026-11-14, strict: a close-up) the white balance only from a real patch of paper (closeRead); the exposure may still be raised from the
   cloth's own white threads (at most 1.6x, never lowered): a tie's thin white edging and a white dobby's ground read white, as before */
function settCanvas(c,wb,strict){const r=wbRead(c),g=wb||(strict?closeRead(c).gains:r.gains),out=applyWb(c,g);if(!r.ref||r.refLum>=235||r.frac<.03)return out;   // a few white threads are no reference (partly blended, they read dim)
  const k=Math.min(1.6,sLin(243)/sLin(Math.max(1,r.refLum))),x=out.getContext('2d',{willReadFrequently:true}),D=x.getImageData(0,0,out.width,out.height),d=D.data,lut=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++)lut[v]=Math.round(linS(Math.min(1,sLin(v)*k)));for(let i=0;i<d.length;i+=4){d[i]=lut[d[i]];d[i+1]=lut[d[i+1]];d[i+2]=lut[d[i+2]]}x.putImageData(D,0,0);return out}
/* a reading takes 1.8-2.5 s at phone speed and the card asked for the same one again and again (every re-tag, toggle and Claude's
   answer): each input's reading is kept (by the card's own canvases, which live as long as the card), so it is worked out once */
const settMemo=new WeakMap();
function settFrom(a){const k0=a.tex||a.full;if(!k0)return settFromRaw(a);const key=JSON.stringify([a.full?1:0,a.tex?1:0,a.box||null,a.weave||null,a.wb||null,a.type||null]);
  let m=settMemo.get(k0);if(!m){m=[];settMemo.set(k0,m)}const hit=m.find(e=>e.full===a.full&&e.tex===a.tex&&e.key===key);if(hit)return hit.s&&JSON.parse(JSON.stringify(hit.s));
  const s=settFromRaw(a);m.push({full:a.full,tex:a.tex,key,s:s&&JSON.parse(JSON.stringify(s))});return s}
function settFromRaw({full,box,tex,weave,wb,type}){let s=null,c=null;
  const opt={straight:!!type&&type!=='tie'};   // a jacket's, shirt's or trousers' pattern is straight in the photo
  try{if(full&&box){s=settFromCanvas(settCanvas(full,wb),box,opt);if(s){s.src='photo';s.tr=+(s.cr/.8).toFixed(2)}}   // the box spans about 80% of the item's width
    if(tex){const r=closeRead(tex);c=settFromCanvas(settCanvas(tex,r.ref?r.gains:wb,true),null,opt);if(c){c.src='closeup';c.tr=1.5}}}catch(e){console.warn('pattern not read',e)}
  // the close-up's colours are moved so its ground matches the item photo's: the item photo usually has a white wall behind it to
  // set its exposure, the close-up of a khaki cloth has nothing white in it and reads darker
  if(s&&c&&c.cr>=1.5){const g=b=>b.reduce((x,y)=>y[1]>x[1]?y:x),L=h=>rgbLab(...hexRgb(h)),d=L(g(s.bands)[0]).map((v,k)=>v-L(g(c.bands)[0])[k]);
    const mv=h=>h&&labHex(L(h).map((v,k)=>v+d[k]));
    s={...s,bands:c.bands.map(([h,w])=>[mv(h),w]),cross:c.cross?{...c.cross,d:s.cross?s.cross.d:c.cross.d,bands:c.cross.bands.map(([h,w])=>[mv(h),w])}:s.cross,cr:c.cr,src:'photo+closeup'}}   // the swatch sits beside the close-up: its scale
  else if(!s)s=c;
  if(!s&&weave)s=settFromWeave(weave);
  if(s&&weave){if(weave.repeatsAcross&&!(type==='tie'&&/photo/.test(s.src)))s.tr=weave.repeatsAcross;   // a tie's box spans most of its width: its own count beats Claude's estimate (a jacket's box is only part of it)
    if(s.src==='closeup'&&DIR_ANG[weave.direction]!=null)s.a=DIR_ANG[weave.direction]}   // a close-up's angle says nothing
  return s}
const motifPat=p=>MOTIF_PATS.includes(patBase(p)||'');
/* patterns only Claude's reading can draw (the band reader would turn them into stripes) */
/* a tie tagged woven or tonal check (2026-11-13): never read before, so painted plain; the owner's charcoal & grey woven tie is a grid of
   tiny light dots, which Claude reads as a motif (the tie painter draws motifs and bands; a pure weave, layout texture, stays plain) */
const claudeOnly=(t,p)=>motifPat(p)||texPat(t,p)||tieWeave(t,p);
/* a card's pattern can be read: a band pattern, a weave Claude described, or a pattern only Claude can read (a motif, a shirt's weave) */
const readable=(t,p,w)=>settable(t,p,w)||claudeOnly(t,p);
/* Claude's reading drawn with the photo's colours: bands (stripes, checks, plaids) or a motif (small figures on a grid) */
const specSett=(spec,args)=>spec&&(spec.texture?(args.type==='shirt'||args.type==='tie'?texFromSpec(spec,args):null):spec.motif?motifFromSpec(spec,args):spec.across?settFromSpec(spec,args):null);
function readSett(q){const ok=!q.settOff&&readable(q.type,q.pattern,q.weave)&&q.raw,args={full:q.raw&&q.raw.full,box:q.patternBox,tex:q.raw&&q.raw.tex,wb:q.wbOff?null:q.wb,type:q.type};q.settReject=null;
  let s=null;if(ok&&q.spec)s=specSett(q.spec,args);
  if(!s)s=ok&&!claudeOnly(q.type,q.pattern)?settFrom({full:q.raw.full,box:q.patternBox,tex:q.raw.tex,weave:q.weave,wb:q.wbOff?null:q.wb,type:q.type}):null;
  const chk=settCheck(q.type,q.pattern,s);if(chk.reject){q.settReject=chk.reject;s=null}else s=chk.s;
  q.sett=s;return s}
/* a band reading that contradicts the tag is not used (2026-11-14: the walkthrough's soft pinstripe close-up was read as level bands at
   -84° with lines crossing them, and Today drew the suit as a brown windowpane): a stripe has no crossing lines, and on a jacket, shirt
   or trousers it runs upright; read level from a close-up (or by Claude) it is only turned upright, since a close-up can be held either
   way, but level in the item photo it is a misreading */
function settCheck(type,pat,s){if(!s||!s.bands||type==='tie')return {s};const p=patBase(pat)||'';if(!STRIPE_PATS.includes(p))return {s};   // (a tie keeps any reading: a plaid tie is often tagged stripe)
  // crossing lines: a jacket's or trousers' stripe read with them is a misreading (the pinstripe drawn as a windowpane); on a shirt
  // they are the weave or a stray fold at most, so they are only dropped (the walkthrough's white/blue shirt kept its stripes)
  if(s.cross&&s.cross.bands&&s.cross.bands.some(b=>b[0])){if(['suit','blazer','pants'].includes(type))return {reject:'cross'};s={...s,cross:null}}
  const a=((s.a%180)+180)%180;if(a<20||a>160)return {s};
  return /photo/.test(s.src||'')?{reject:'level'}:{s:{...s,a:0}}}
/* a pattern the tag missed: a close-up of cloth tagged plain that clearly shows stripes or a check (bands 12+ ΔE00 apart, two repeats or
   more, a sharp close-up) is suggested, never set */
function missedPattern(q){if(!q||!q.raw||!q.raw.tex||(patBase(q.pattern)||'solid')!=='solid'||!PATS_BY[q.type])return null;
  if(q.missed&&q.missed.c===q.raw.tex)return q.missed.p;let p=null;
  if((sharpness(q.raw.tex)||0)>=BLUR_SHARP){const s=settFrom({tex:q.raw.tex,wb:q.wbOff?null:q.wb,type:q.type});
    if(s&&s.bands&&s.bands.length>=2&&s.cr>=2){const L=h=>rgbLab(...hexRgb(h)),g=s.bands.reduce((a,b)=>b[1]>a[1]?b:a),gl=L(g[0]),con=Math.max(...s.bands.filter(b=>b!==g).map(b=>dE00(L(b[0]),gl))),line=1-g[1];
      const cross=s.cross&&s.cross.bands.some(b=>b[0]),jacket=['suit','blazer','pants'].includes(q.type);
      if(con>=12)p=cross?(jacket?(line<.15?'windowpane':'glen-check'):'check'):(jacket?(line<.15?'pinstripe':'chalk-stripe'):q.type==='shirt'&&line<.15?'fine-stripe':'stripe');
      if(p&&!(PATS_BY[q.type]||[]).includes(p))p=null}}
  q.missed={c:q.raw.tex,p};return p}
function toggleSett(i){const q=queue[i];q.settOff=!q.settOff;readSett(q);if(q.meas)measureAndApply(q);renderAdd()}
const settSummary=s=>s.tex?`a ${TEX_WORDS[s.tex.kind]||'woven texture'} (${s.tex.grid[0].length}×${s.tex.grid.length} repeat), read by Claude with the contrast from the close-up`:s.motif?`${s.motif.figs.length===1?'one figure':s.motif.figs.length+' figures'} on a ${s.motif.grid} grid, read by Claude with the colours from the photo`:s.src==='claude+pixels'?`${s.bands.length} band${s.bands.length===1?'':'s'}${s.cross?' and lines the other way':''}, read by Claude with the colours from the photo`:`${s.bands.length} colour band${s.bands.length===1?'':'s'}${s.cross?' with lines crossing the other way':''}, read from ${s.src==='photo'?'the photo':s.src==='closeup'?'the close-up':s.src==='photo+closeup'?'the photo and the close-up':'Claude\'s description'}`;
function settNote(q,i){if(!readable(q.type,q.pattern,q.weave))return '';
  if(q.patternReading)return '<p class="tagnote mut"><small><span class="spin" aria-hidden="true"></span>Claude is reading the pattern…</small></p>';
  if(q.settOff)return `<p class="tagnote mut"><small>Drawn with the simple ${esc(patName(q.pattern))} pattern.</small><button type="button" class="chipbtn" onclick="toggleSett(${i})">Use the pattern from the photo</button></p>`;
  if(q.settReject)return `<p class="tagnote settrej"><small>The pattern reader saw ${q.settReject==='cross'?'lines crossing the stripes':'level bands'}, which isn't ${esc(patName(q.pattern).toLowerCase())}: drawn with the simple pattern.</small></p>`;
  return q.sett?`<p class="tagnote"><small>Pattern: ${settSummary(q.sett)}.</small><button type="button" class="chipbtn" onclick="toggleSett(${i})">Use the simple pattern</button></p>`:''}
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
/* Wardrobe editor: read it again from the kept sharp copy (or the close-up) */
async function rereadSett(id){const it=items.find(x=>x.id===id);if(!it)return;
  const toCanvas=async src=>{if(!src)return null;try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c}catch{return null}};
  const full=it.pbox?await toCanvas(await tagImgOf(it.id,it)):null,tex=await toCanvas(it.texture);
  let spec=null;const img=await tagImgOf(it.id,it)||it.photo;if(localStorage.getItem('worker_url')&&img){toast('Claude is reading the pattern…');spec=await claudePattern({image:img,closeup:await sharpCloseOf(it),type:it.type})}
  const full2=full||(it.photo?await toCanvas(it.photo):null);
  const s=specSett(spec,{full:full2,box:it.pbox,tex,type:it.type})||(claudeOnly(it.type,it.pattern)?null:settFrom({full,box:it.pbox,tex,weave:it.weave,wb:null,type:it.type}));   // the kept copy is already white-balanced
  if(spec){it.patternSpec=spec;if(spec.description)it.patternText=spec.description}
  const chk=settCheck(it.type,it.pattern,s);if(chk.reject){toast(`The reading showed ${chk.reject==='cross'?'lines crossing the stripes':'level bands'}, which isn't ${patName(it.pattern).toLowerCase()}: the pattern stays as it was.`);return}
  if(!chk.s){toast('No clear pattern found. Add a fabric close-up (or a sharper photo) and try again.');return}
  it.sett=chk.s;delete it.stripes;await put(it);cache={};renderWardrobe();toast(`Pattern read: ${settSummary(s)}.`)}

/* ---- the pattern for the photo generator. Claude's words alone were not enough: on a plaid tie its description had the stripes
   rising the wrong way and the generator followed it, and it said nothing of how much of each colour there is. So a read
   pattern is also described from the measurements (direction as the viewer sees it, each colour's share, pinlines, crossing
   lines), any direction in Claude's words is taken out, and a drawing of the pattern goes along as a reference. ---- */
/* a band's name: the nearest of Claude's own colour names for this cloth (so the measured shares and its description use one
   vocabulary; lightness counts half, a photo's exposure being the least certain), else the nearest of the app's colours */
const nearName=(hex,named)=>{const l=rgbLab(...hexRgb(hex));
  // hue counts most here: a greyed steel blue in a dim photo is still the blue band, not the beige one of the same lightness
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2]));
  if(named&&named.length>=2){let best=named[0],bd=1e9;for(const c of named){const d=dist(l,rgbLab(...hexRgb(c.hex)));if(d<bd){bd=d;best=c}}return String(best.name).toLowerCase()}
  let best=null,bd=1e9;for(const c of Object.keys(COLORS)){if(CUSTOM_COL[c])continue;const d=dE00(l,labOf(c));if(d<bd){bd=d;best=c}}return colName(best)};
/* which way the stripes run as the viewer sees them (sett.a is the angle across them; on a jacket or shirt they are snapped straight) */
function settDirText(s,role){const a=role==='tie'?s.a:Math.round(s.a/90)*90,phi=((a+90)%180+180)%180;   // the stripes' own direction, 0 = horizontal, y down
  if(phi<15||phi>165)return 'horizontal stripes';if(phi>75&&phi<105)return 'vertical stripes';
  return phi<90?'diagonal stripes running from the upper left down to the lower right, as the viewer sees them':'diagonal stripes running from the lower left up to the upper right, as the viewer sees them'}
function settText(i,role){const s=usableSett(i);if(s&&s.tex)return `measured: a tone-on-tone ${TEX_WORDS[s.tex.kind]||'woven texture'}, ${s.tex.contrast}`;if(s&&s.motif)return motifText(s,role);if(!s||!s.bands)return '';
  const named=[...(i.patternSpec?[i.patternSpec.across,i.patternSpec.along].filter(Boolean).flatMap(d=>d.bands.map(b=>({name:b.name,hex:b.hex}))):[]),...(i.weave&&i.weave.colours||[])].filter(c=>c&&c.name&&/^#[0-9a-f]{6}$/i.test(c.hex||''));
  const share={},thin={};for(const [h,w] of s.bands){const n=nearName(h,named);if(w<.035)thin[n]=1;else share[n]=(share[n]||0)+w}
  const tot=Object.values(share).reduce((a,b)=>a+b,0)||1,parts=Object.entries(share).sort((a,b)=>b[1]-a[1]).map(([n,w])=>`${Math.max(1,Math.round(100*w/tot/5)*5)}% ${n}`);
  const pins=Object.keys(thin);
  const cross=s.cross?[...new Set(s.cross.bands.filter(b=>b[0]).map(b=>nearName(b[0],named)))]:[];
  return `measured: ${settDirText(s,role)}; the bands are about ${parts.join(', ')}${pins.length?`, with thin ${pins.join(' and ')} pinlines`:''}`+
    (cross.length?`; fine ${cross.join(' and ')} lines cross them in the other direction`:'')}
const DIR_RE=/(?:rising|running|descending|slanting|sloping|going|that run|which run)?\s*(?:diagonally\s+)?(?:from\s+)?(?:the\s+)?(?:upper|lower|top|bottom)[ -](?:left|right)\s+(?:down\s+|up\s+)?(?:to|towards)\s+(?:the\s+)?(?:upper|lower|top|bottom)[ -](?:left|right)(?:\s+as (?:seen|worn))?/gi;
const dropDir=t=>String(t||'').replace(DIR_RE,'').replace(/\s+([,.:;])/g,'$1').replace(/\s{2,}/g,' ').trim();
/* what the photo prompt says of an item's pattern */
function patternPrompt(i,role){if(!i)return '';const m=settText(i,role),d=m?dropDir(i.patternText):i.patternText||'';
  return [m,d.replace(/\.$/,'')].filter(Boolean).join('. ')}
/* the drawing of a read pattern for the generator: a tie as its blade (tip down, the pattern at the angle it is worn), anything else
   as a square of its cloth; on a light grey ground, sharp */
function patternDiagram(i,role){const fab=i.sett&&i.sett.tex?{def:id=>fabricDef(id,i,'shirt','dia')}:figFabric(i,role);if(!fab)return Promise.resolve(null);
  const tie=role==='tie',vb=tie?'168 46 54 214':'0 0 200 200',W=tie?360:600,H=tie?Math.round(360*214/54):600;
  const shape=tie?'<path d="M 182 50 L 208 50 C 211 60 210 70 205 79 C 199 83 191 83 185 79 C 180 70 179 60 182 50 Z" fill="url(#pd)"/><path d="M 186 74 L 204 74 C 207 120 212 172 217 222 L 195 256 L 173 222 C 178 172 183 120 186 74 Z" fill="url(#pd)"/>':'<rect width="200" height="200" fill="url(#pd)"/>';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vb}"><defs>${fab.def('pd',0)}</defs><rect x="-10" y="-10" width="400" height="400" fill="#ececea"/>${shape}</svg>`;
  return new Promise(ok=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(im,0,0,W,H);ok(c.toDataURL('image/png'))};im.onerror=()=>ok(null);
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)})}
/* the references with the pattern drawings put in after their item's photos; a tie sent without its photo (outfitRefs) has its
   drawing right before its close-up (at most 8 in all) */
/* every drawing is added; trimRefs keeps the 8 that matter most */
async function outfitRefsFull(o){const {refs,labels}=outfitRefs(o),slots=[['tie','tie','the tie'],['top','top',o.suitDay?'the suit':'the blazer'],['shirt','shirt','the shirt'],...(o.top?[]:[['bot','bot','the trousers']])];
  for(const [s,role,name] of slots){const i=o[s];if(!i||!usableSett(i)||(i.sett.tex&&s!=='shirt'))continue;const img=await patternDiagram(i,role);if(!img)continue;
    let at=labels.findIndex(l=>l.startsWith(name));at=at>=0?at+1:role==='tie'?labels.findIndex(l=>l.startsWith('a close-up of the tie fabric')):-1;if(at<0)at=refs.length;
    refs.splice(at,0,img);labels.splice(at,0,i.sett.tex?`a drawing of the shirt's weave texture, its contrast exaggerated so it can be seen: weave this ${TEX_WORDS[i.sett.tex.kind]||'texture'} into the shirt cloth, tone on tone and subtle, at about the scale of the shirt's close-up`:`a drawing of ${name.replace(/^the /,'the ')}'s measured pattern${role==='tie'?' as worn':''}: copy ${i.sett.motif?'its figures, their shapes, colours, arrangement and size':'its colours, their order and proportions and the stripe direction'} exactly, rendered as real woven ${role==='tie'?'silk':'cloth'}`)}
  const wk=labels.findIndex(l=>l.startsWith('the wristwatch'));   // the watch is small in the picture: its dial enlarged is a second reference
  if(wk>=0){const src=refs[wk],t=await turnBy(src,WATCH_TURN),d=await dialCrop(src),dt=d&&await turnBy(d,WATCH_TURN);
    refs.splice(wk,1);labels.splice(wk,1);
    // the watch goes FIRST, right after the illustration, and its dial enlarged as a reference of its own (refRank 9: never trimmed):
    // last in the list and its dial halved in a shared image, the generator drew a stock chronograph
    const w=[[t||src,t?WATCH_WORN:'the wristwatch (copy it exactly: case, bezel, dial and subdials, hands, bracelet links)'],...(dt?[[dt,WATCH_DIAL]]:[])];
    refs.unshift(...w.map(x=>x[0]));labels.unshift(...w.map(x=>x[1]))}
  return trimRefs(refs,labels)}
/* how the watch's photo is turned before it is sent, in degrees clockwise (its photos are taken upright, 12 o'clock at the top) */
const WATCH_TURN=180;
/* the whole dial turns with the crown (never mirrored): with the crown toward the hand, what is at 6 o'clock on an upright watch is at
   the top (the owner's chronograph shows the time in its 6 o'clock subdial, and it came back with the crown turned and that subdial not) */
const WATCH_DIAL="an enlargement of the same wristwatch's dial, turned the same way: copy its subdials, their places and sizes, the hands and the markings exactly";
/* turned by a multiple of 90° clockwise */
const turnBy=(u,deg)=>new Promise(ok=>{const q=((deg/90|0)%4+4)%4;if(!q)return ok(u);const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),side=q%2;
  c.width=side?im.height:im.width;c.height=side?im.width:im.height;const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(q*Math.PI/2);
  x.drawImage(im,-im.width/2,-im.height/2);ok(c.toDataURL('image/jpeg',.9))};im.onerror=()=>ok(null);im.src=u});
/* the middle of the watch's photo (DIAL_PART of its shorter side), enlarged: with the whole watch alone the generator drew a generic
   dial, with this it drew the owner's white dial and its subdials */
/* on the left wrist, the arm across the chest and the back of the hand to the camera, a watch is seen half a turn round: the crown
   toward the hand, 12 o'clock at the bottom. From upright photos the generator drew it upright, the crown toward the elbow (the
   owner: "backwards") */
const WATCH_WORN="the wristwatch, turned as worn: crown toward the hand, the whole dial turned with it, 6 o'clock at the top (copy case, bezel, dial, bracelet exactly)";
const DIAL_PART=.48;
const dialCrop=u=>new Promise(ok=>{const im=new Image();im.onload=()=>{const s=Math.min(im.width,im.height)*DIAL_PART,c=document.createElement('canvas');c.width=c.height=640;
  c.getContext('2d').drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,640,640);ok(c.toDataURL('image/jpeg',.9))};im.onerror=()=>ok(null);im.src=u});
/* the worker takes 8 references: when there are more, the least needed go first (the watch dial's enlargement, then the shirt's
   close-up, then the shirt's texture drawing, then the other drawings and close-ups), never an item's own photo. Cutting the
   list at 8 dropped the watch, which comes last, once the pattern drawings were added, and the generator drew a generic one.
   The shirt's close-up used to go first (shot in dim light it reads grey, and the generator is told to match its colour); the
   owner asked for it to be sent, in the place of the tie's photo (outfitRefs). With that photo gone at most one reference is
   over, so only the enlargement ever goes: in a fully patterned outfit, where it was dropped before too. */
/* (since the watch's dial came back generic: its enlargement is never trimmed, so the shirt's close-up goes first again) */
function refRank(l){return /^an enlargement/.test(l)?9:/^a close-up of the shirt/.test(l)?.5:/^a drawing of the shirt/.test(l)?1:/^a drawing of/.test(l)?2:/^a close-up of the tie/.test(l)?3:/^a close-up/.test(l)?4:9}
function trimRefs(refs,labels,max=8){const keep=refs.map((_,k)=>k);
  while(keep.length>max){let worst=0;for(let n=1;n<keep.length;n++)if(refRank(labels[keep[n]])<refRank(labels[keep[worst]]))worst=n;keep.splice(worst,1)}
  return {refs:keep.map(k=>refs[k]),labels:keep.map(k=>labels[k])}}

/* ---- the pattern read by Claude (worker POST /pattern) and coloured from the pixels. The pixel reader alone is thrown by the
   noise in a photo (a seam, moire, panes made uneven by drape); Claude reports the pattern as woven: every band of a repeat each
   way, in order, with its width. The exact colours come from the photos: each named thread is matched to its own pixels, the
   close-up's exposure is matched to the item photo's (which has a white wall to set it), and where a thread's pixels read grey
   though Claude sees a colour (a light-blue line woven into khaki linen), the pixels keep the lightness and Claude the hue.
   Without the worker, or when Claude finds no pattern, the pixel reader (settFrom) is used. ---- */
async function claudePattern({image,closeup,type,wb}){const w=localStorage.getItem('worker_url');if(!w||!image)return null;
  try{const r=await fetch(new URL('pattern',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image,...(closeup?{closeup}:{}),type,...(typeof wb==='boolean'?{wb}:{})})});   // wb: both pictures white-balanced (worker.js)
    const j=await r.json().catch(()=>({}));if(r.status===429&&j.message&&typeof limitNote==='function')limitNote(j.message);   // today's limit on pattern readings: say so (the pixel reader takes over)
    return r.ok&&(j.across||j.motif||j.texture)&&j.layout!=='none'?j:null}catch{return null}}
function sampleLabs(c){const x=c.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,c.width,c.height).data,st=Math.max(1,Math.round(c.width*c.height/120000)),out=[];
  for(let i=0;i<d.length;i+=4*st)out.push(rgbLab(d[i],d[i+1],d[i+2]));return out}
const medLab=ls=>[0,1,2].map(k=>{const v=ls.map(l=>l[k]).sort((a,b)=>a-b);return v[v.length>>1]});
function cropCanvas(c,box){const x=box.x/1000*c.width,y=box.y/1000*c.height,w=Math.max(1,box.w/1000*c.width),h=Math.max(1,box.h/1000*c.height),o=document.createElement('canvas');
  o.width=Math.round(w);o.height=Math.round(h);o.getContext('2d').drawImage(c,x,y,w,h,0,0,o.width,o.height);return o}
function settFromSpec(spec,{tex,full,box,wb,type}){
  const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
  let src=null;try{src=tex?settCanvas(tex,closeRead(tex).ref?null:wb,true):full&&box?cropCanvas(settCanvas(full,wb),box):null}catch{}
  const labs=src?sampleLabs(src):[],ground=labs.length?medLab(labs):null;   // the whole cloth's median: for the exposure match only (below)
  // the close-up's exposure matched to the item photo's (the median of the patterned area in each); only with the pattern's box:
  // a whole photo's median takes in the wall and the next jackets (it turned a navy pinstripe lavender)
  let delta=[0,0,0];if(tex&&full&&box&&ground)try{const g2=medLab(sampleLabs(cropCanvas(settCanvas(full,wb),box)));delta=g2.map((v,k)=>v-ground[k])}catch{}
  // every distinct thread colour Claude named, with its share of the cloth
  const threads=new Map();for(const d of [spec.across,spec.along])if(d)for(const b of d.bands){const t=threads.get(b.hex)||{share:0,role:b.role};t.share+=b.w/(spec.along?2:1);if(b.role==='ground')t.role='ground';threads.set(b.hex,t)}
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2])),dE76=(x,y)=>Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);
  const groundHex=[...threads].filter(([,t])=>t.role==='ground').sort((a,b)=>b[1].share-a[1].share)[0];
  const colour=new Map(),near=(cl,share,from)=>{const top=from.slice().sort((a,b)=>dist(a,cl)-dist(b,cl)).slice(0,Math.max(12,Math.round(from.length*share*.5)));
    return top.length>=6?[0,1,2].map(j=>top.reduce((s,p)=>s+p[j],0)/top.length):null};
  // the ground: the pixels nearest Claude's ground colour, like the lines. It was the median of the whole close-up, which is the ground
  // only when the ground covers most of the cloth: on the owner's half-navy, half-blue repp stripe it landed between the two (#344a71
  // for Claude's #1e2347), and his navy came out slate
  // (a ground covering most of the cloth, 70% or more, keeps the median: it is the ground there, and it was tuned on the owner's photos)
  const gl=groundHex&&labs.length&&groundHex[1].share<.7?near(L(groundHex[0]),groundHex[1].share,labs):null,gref=gl||ground;
  for(const [hex,t] of threads){const cl=L(hex);let m=null;
    if(labs.length){if(groundHex&&hex===groundHex[0])m=gref;
      else{const cand=labs.filter(p=>dE76(p,gref)>6);m=near(cl,Math.min(.2,t.share),cand);
        // a thin line (10% of the repeat or less, all its stripes together) is a few pixels wide in a close-up and blurred with the ground beside it: of its
        // pixels, the half furthest from the ground (a tie's thin white edging read #b6b9b8, light grey, beside a grey band)
        if(m&&t.share<=.1){const top=cand.slice().sort((a,b)=>dist(a,cl)-dist(b,cl)).slice(0,Math.max(12,Math.round(cand.length*t.share*.5))).sort((a,b)=>dE76(b,gref)-dE76(a,gref)),h=top.slice(0,Math.max(6,top.length>>1));
          m=[0,1,2].map(j=>h.reduce((s,p)=>s+p[j],0)/h.length)}}
      // a coloured thread that reads grey in the pixels keeps the pixels' lightness and takes Claude's hue
      if(m&&t.role!=='ground'&&C(cl)>10&&C(m)<.6*C(cl)){const s=Math.max(C(m),.75*C(cl))/C(cl);m=[m[0],cl[1]*s,cl[2]*s]}
      // a line's threads cross the ground's (a white line reads cream, not paper white): a quarter of the ground's lightness. Not on a
      // tie: its stripes are woven floats of their own yarn, and the mix darkened a blue stripe and turned a thin white line grey
      if(m&&t.role!=='ground'&&type!=='tie')m=[.75*m[0]+.25*gref[0],m[1],m[2]]}
    if(m)colour.set(hex,m)}
  // the measured ground far (ΔE00 over 15) from Claude's: first without the exposure match, else Claude's colours
  const gm=groundHex&&colour.get(groundHex[0]),gc=groundHex&&L(groundHex[0]),far=d=>gm&&dE00(gm.map((v,k)=>v+d[k]),gc)>15;
  const use=!far(delta)?delta:!far([0,0,0])?[0,0,0]:null;
  for(const [hex] of threads){const m=colour.get(hex);colour.set(hex,m&&use?labHex(m.map((v,k)=>v+use[k])):hex)}
  const run=d=>{const out=[];for(const b of d.bands){const h=colour.get(b.hex);if(out.length&&out[out.length-1][0]===h)out[out.length-1][1]+=b.w;else out.push([h,b.w])}return out.map(([h,w])=>[h,+w.toFixed(4)])};
  const bands=run(spec.across);if(bands.length<2)return null;
  const gH=groundHex&&colour.get(groundHex[0]),along=spec.along?run(spec.along).map(([h,w])=>[h===gH?null:h,w]):null;
  const a=type==='tie'?(DIR_ANG[spec.stripeDirection]??-45):spec.stripeDirection==='horizontal'?90:0;
  return {v:2,a,bands,cross:along&&along.some(b=>b[0])?{d:90,bands:along,r:+spec.paneAspect.toFixed(2)}:null,cr:+(+spec.repeatsInCloseup).toFixed(2),tr:+(+spec.repeatsAcrossItem).toFixed(2),src:'claude+pixels'}}
/* ask Claude for a card's pattern once it has a close-up (the noise it strips is what the pixel reader can't) */
async function readPatternWithClaude(q){if(!q||!queue.includes(q)||!q.raw||!q.raw.tex||!q.tagImg||!readable(q.type,q.pattern,q.weave)||!localStorage.getItem('worker_url'))return;   // a card saved or skipped meanwhile: no paid call
  q.patternReading=1;renderAdd();const closeup=await closeTagImg(q);if(!queue.includes(q)){q.patternReading=0;return}
  const spec=await claudePattern({image:q.tagImg,closeup,type:q.type,wb:!!(q.wb&&!q.wbOff)});q.patternReading=0;   // wb: one flag for both pictures (the close-up takes the photo's correction, or its own paper's)
  if(spec){q.spec=spec;if(spec.description)q.weave={...(q.weave||{}),description:spec.description}}else q.specFailed=1;
  readSett(q);if(q.meas)measureAndApply(q);if(queue.includes(q))renderAdd()}

/* ---- a motif (small figures on a grid: a neat or foulard, mini squares, dots) as Claude read it, each colour taken from its own
   pixels. A band reader can't draw these: it turns a checkerboard of mini squares into a diagonal plaid. Claude gives the grid,
   the ground and each figure (shape, place, colours, size); the pixels give each colour, like settFromSpec: the close-up's exposure
   matched to the item photo's, and Claude's hue kept where a colour's pixels read grey. ---- */
function motifFromSpec(spec,{tex,full,box,wb}){const m=spec&&spec.motif;if(!m||!m.ground||!m.figures||!m.figures.length)return null;
  const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
  let src=null;try{src=tex?settCanvas(tex,closeRead(tex).ref?null:wb,true):full?(box?cropCanvas(settCanvas(full,wb),box):settCanvas(full,wb)):null}catch{}
  const labs=src?sampleLabs(src):[],med=labs.length?medLab(labs):null;
  // only with a box on the cloth: the whole photo's median is mostly its background (a tie on a grey wall)
  let delta=[0,0,0];if(tex&&full&&box&&med)try{const g2=medLab(sampleLabs(cropCanvas(settCanvas(full,wb),box)));delta=g2.map((v,k)=>v-med[k])}catch{}
  // each colour's share of the cloth: a figure covers size² of its cell (half the cells when it alternates), split between its colours
  const share=new Map(),add=(h,w)=>share.set(h,(share.get(h)||0)+w);let figs=0;
  for(const f of m.figures){const a=f.size*f.size*(f.placement==='alternate-cells'?.5:1);figs+=a;f.colours.forEach(c=>add(c.hex,a*(f.centre?.85:1)/f.colours.length));if(f.centre)add(f.centre.hex,a*.15)}
  add(m.ground.hex,Math.max(.05,1-Math.min(1,figs)));
  const dist=(x,y)=>Math.hypot((x[0]-y[0])/2,1.4*(x[1]-y[1]),1.4*(x[2]-y[2]));
  const colour=new Map();
  for(const [hex,sh] of share){const cl=L(hex);let mm=null;
    if(labs.length>=40){const k=Math.max(12,Math.round(labs.length*Math.min(.25,sh)*.5)),top=[...labs].sort((a,b)=>dist(a,cl)-dist(b,cl)).slice(0,k);
      if(dist(top[top.length>>1],cl)<40)mm=[0,1,2].map(j=>top.reduce((s,p)=>s+p[j],0)/top.length);   // nothing near Claude's colour: keep Claude's
      if(mm&&C(cl)>10&&C(mm)<.6*C(cl)){const s=Math.max(C(mm),.75*C(cl))/C(cl);mm=[mm[0],cl[1]*s,cl[2]*s]}}
    colour.set(hex,mm?labHex(mm.map((v,k)=>v+delta[k])):hex)}
  const c=h=>colour.get(h)||h;
  return {v:3,motif:{grid:m.grid,ground:c(m.ground.hex),groundName:m.ground.name,figs:m.figures.map(f=>({shape:f.shape,place:f.placement,size:+f.size.toFixed(3),cols:f.colours.map(x=>c(x.hex)),names:f.colours.map(x=>x.name),centre:f.centre?c(f.centre.hex):null,centreName:f.centre?f.centre.name:null,...(f.bitmap?{bmp:f.bitmap}:{}),...(f.name?{name:f.name}:{})})),...(m.cellAspect&&m.cellAspect!==1?{aspect:+(+m.cellAspect).toFixed(3)}:{}),...(m.rowOffset==='half'?{off:1}:{})},
    a:m.grid==='diagonal'?45:0,cr:+(+spec.repeatsInCloseup||1).toFixed(2),tr:+(+spec.repeatsAcrossItem||1).toFixed(2),src:'claude+pixels'}}
/* ---- a dress shirt's weave texture (dobby diamonds, herringbone, oxford) as Claude read it: a small bitmap of one repeat. The
   cloth is one colour, so the drawing keeps the tagged colour and takes from the close-up only how strong the texture is: the
   lightness swing between the raised threads and the ground, after the photo's own light falloff is taken out, as a share of
   the close-up's lightness (a white shirt's close-up often reads grey, but the share holds). ---- */
const TEX_WORDS={diamond:'small diamond dobby weave',herringbone:'fine herringbone weave',twill:'fine twill weave',oxford:'oxford weave','royal-oxford':'royal oxford weave',pinpoint:'pinpoint weave','end-on-end':'end-on-end weave',birdseye:'birdseye weave',honeycomb:'honeycomb weave','dobby-dot':'small dobby dot weave',basket:'basket weave',other:'woven texture'};
const TEX_REL={faint:.04,subtle:.08,clear:.14};
function texContrast(c,cells){const W=Math.min(320,c.width),H=Math.max(8,Math.round(c.height*W/c.width)),s=document.createElement('canvas');s.width=W;s.height=H;
  const x=s.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,W,H);const d=x.getImageData(0,0,W,H).data,L=new Float32Array(W*H);
  for(let i=0;i<W*H;i++)L[i]=rgbLab(d[4*i],d[4*i+1],d[4*i+2])[0];
  // a box blur wider than a repeat is the light falloff and folds; what is left is the texture
  const R=Math.max(3,Math.min(W>>2,Math.round(1.2*W/Math.max(1,cells)))),I=new Float64Array((W+1)*(H+1));
  for(let y=0;y<H;y++){let r=0;for(let q=0;q<W;q++){r+=L[y*W+q];I[(y+1)*(W+1)+q+1]=I[y*(W+1)+q+1]+r}}
  const res=[];for(let y=R;y<H-R;y+=1)for(let q=R;q<W-R;q+=1){const a=(y-R)*(W+1)+q-R,b=(y-R)*(W+1)+q+R+1,e=(y+R+1)*(W+1)+q-R,f=(y+R+1)*(W+1)+q+R+1;
    res.push(L[y*W+q]-(I[f]-I[b]-I[e]+I[a])/((2*R+1)**2))}
  if(res.length<200)return null;res.sort((a,b)=>a-b);const med=[...L].sort((a,b)=>a-b)[L.length>>1];
  return Math.max(.015,Math.min(.35,(res[Math.floor(res.length*.92)]-res[Math.floor(res.length*.08)])/Math.max(20,med)))}
function texFromSpec(spec,{tex}){const t=spec&&spec.texture;if(!t||!t.grid||t.grid.length<2)return null;
  let rel=null;if(tex)try{rel=texContrast(settCanvas(tex,null,true),+spec.repeatsInCloseup||8)}catch{}
  const L=h=>rgbLab(...hexRgb(h))[0];
  return {v:4,tex:{kind:t.kind,grid:t.grid,aspect:+(+t.aspect||t.grid.length/t.grid[0].length).toFixed(2),lighter:L(t.raised.hex)>=L(t.ground.hex),contrast:t.contrast,rel:+(rel??TEX_REL[t.contrast]??.08).toFixed(3),measured:rel!=null},
    a:0,cr:+(+spec.repeatsInCloseup||8).toFixed(2),tr:+(+spec.repeatsAcrossItem||100).toFixed(2),src:'claude+pixels'}}
/* the motif in words for the photo generator */
const figWord=f=>f.shape==='figure'&&f.name?`${f.name}s`:SHAPE_WORDS[f.shape]||'small figures';
const SHAPE_WORDS={square:'small squares','square-with-dot':'tiny squares with a dot in the middle',diamond:'small diamonds',dot:'dots',ring:'small rings',cross:'small crosses',flower:'small flowers',other:'small figures'};
function motifText(s,role){const m=s.motif,figs=m.figs.map((f,n)=>{const cols=f.names.length===2?`alternating ${f.names[0]} and ${f.names[1]}`:f.names[0];
    const where=f.place==='corner'?(n?' where the corners meet':' at the grid corners'):f.place==='alternate-cells'?' in every other cell':'';
    return `${f.shape==='figure'?'small ':''}${cols} ${figWord(f)}${f.centreName?` (each with a ${f.centreName} dot)`:''}${where}`});
  const lay=m.grid==='diagonal'?'diagonal (45°) grid':m.off?'grid with every other row shifted half a step':m.aspect&&m.aspect<.85?'grid of columns, the figures stacked closer than the columns are apart':'straight grid';
  return `measured: a neat pattern on a ${lay}: ${figs.join(', with ')}, on a ${m.groundName} ground; about ${Math.round(s.tr)} repeats across the ${role==='tie'?'tie':'cloth'}`}
