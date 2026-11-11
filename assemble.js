// Assembled outfit photos (loaded after tagging.js). Instead of one generated photo per outfit, one MASTER photo fixes the pose and
// every item gets ONE photo, made by editing the master so that only that piece changes (the worker's swap jobs). An outfit's
// picture is then put together here, on the device, by copying each piece's pixels onto the master: no image model, no cost.
//   master  the pose, in plain placeholder clothes (never shown)
//   calib   four edits of the master in loud flat colours (jacket, shirt, tie, watch): where each differs from the master is that
//           piece's ZONE. They are only used to find the zones, once per master.
//   pieces  one edit of the master per jacket, shirt look, tie, tie bar and extra watch
// Order: master, then the jacket, shirt, tie, tie bar and watch; pixels along the joins are rebuilt from clean pixels either side.
// Not used by Today yet: asmPhoto(o) is what a later step shows; an outfit it can't do (no jacket, no tie, a vest) keeps its photo.
const ASM_VER=1,ASM_DE=14;   // ASM_DE: a colour difference (CIE Lab) that counts as "this pixel changed"
const asmImg=u=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(new Error('could not read a photo'));im.src=u});
/* a photo as pixels, W wide and high (its own width when not given: photos are square) */
async function asmData(u,W){const im=await asmImg(u),w=W||im.naturalWidth,c=document.createElement('canvas');c.width=c.height=w;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,w);return x.getImageData(0,0,w,w)}
/* colours as the eye tells them apart (CIE Lab), so a dark green and a dark navy of one brightness still differ; remembered per photo */
const ASM_LIN=Float32Array.from({length:256},(_,v)=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}),asmLabs=new WeakMap();
function asmLab(d){let o=asmLabs.get(d);if(o)return o;const p=d.data,n=p.length>>2,h=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;o=new Float32Array(3*n);
  for(let i=0,j=0;i<n;i++,j+=4){const r=ASM_LIN[p[j]],g=ASM_LIN[p[j+1]],b=ASM_LIN[p[j+2]],X=h((.4124*r+.3576*g+.1805*b)/.9505),Y=h(.2126*r+.7152*g+.0722*b),Z=h((.0193*r+.1192*g+.9505*b)/1.089);
    o[3*i]=116*Y-16;o[3*i+1]=500*(X-Y);o[3*i+2]=200*(Y-Z)}
  asmLabs.set(d,o);return o}
const asmDE=(A,B,i,j=i)=>Math.hypot(A[3*i]-B[3*j],A[3*i+1]-B[3*j+1],A[3*i+2]-B[3*j+2]);
/* ---- masks: one byte per pixel ---- */
/* grow (any) or shrink a mask by r pixels (a square); a running count along rows, then columns, so a wide reach costs no more */
function asmBox(m,W,r,any){const n=m.length,t=new Uint8Array(n),o=new Uint8Array(n),full=2*r+1,line=new Int32Array(W+1),pass=(a,b,step)=>{
    for(let u=0;u<W;u++){const at=step===1?u*W:u;line[0]=0;for(let p=0;p<W;p++)line[p+1]=line[p]+a[at+p*step];
      for(let p=0;p<W;p++){const lo=Math.max(0,p-r),hi=Math.min(W,p+r+1),c=line[hi]-line[lo];b[at+p*step]=any?(c?1:0):(c===full?1:0)}}};
  pass(m,t,1);pass(t,o,W);return o}
/* connected areas of a mask: each pixel's area number, each area's size and whether it touches the picture's edge */
function asmAreas(m,W){const n=m.length,lab=new Int32Array(n),size=[0],edge=[0],st=[];let k=0;
  for(let s=0;s<n;s++){if(!m[s]||lab[s])continue;k++;size.push(0);edge.push(0);lab[s]=k;st.push(s);
    while(st.length){const i=st.pop(),x=i%W,y=(i-x)/W;size[k]++;if(!x||!y||x===W-1||y===W-1)edge[k]=1;
      if(x&&m[i-1]&&!lab[i-1]){lab[i-1]=k;st.push(i-1)}if(x<W-1&&m[i+1]&&!lab[i+1]){lab[i+1]=k;st.push(i+1)}
      if(y&&m[i-W]&&!lab[i-W]){lab[i-W]=k;st.push(i-W)}if(y<W-1&&m[i+W]&&!lab[i+W]){lab[i+W]=k;st.push(i+W)}}}
  return {lab,size,edge}}
/* keep the areas of at least min pixels (keep(k, size) can choose instead) */
function asmBig(m,W,min,keep){const a=asmAreas(m,W),o=new Uint8Array(m.length);for(let i=0;i<m.length;i++){const k=a.lab[i];if(k&&(keep?keep(k,a):a.size[k]>=min))o[i]=1}return o}
/* fill the holes of at most max pixels (areas of "off" the picture's edge can't reach) */
function asmFill(m,W,max){const inv=new Uint8Array(m.length);for(let i=0;i<m.length;i++)inv[i]=m[i]?0:1;const a=asmAreas(inv,W),o=new Uint8Array(m);
  for(let i=0;i<m.length;i++){const k=a.lab[i];if(k&&!a.edge[k]&&a.size[k]<=max)o[i]=1}return o}
const asmCount=m=>{let n=0;for(let i=0;i<m.length;i++)n+=m[i];return n};
/* a mask as run lengths (off, on, off, …) and back: a few thousand numbers instead of a million bytes, to keep in storage */
function asmPack(m){const r=[];let v=0,n=0;for(let i=0;i<m.length;i++){if(m[i]===v)n++;else{r.push(n);v=m[i];n=1}}r.push(n);return r}
function asmUnpack(r,n){const m=new Uint8Array(n);let i=0,v=0;for(const k of r){if(v)m.fill(1,i,i+k);i+=k;v^=1}return m}
/* ---- zones: where each piece is on the master ---- */
/* Each calibration photo is the master with one piece in a loud colour. A pixel belongs to the piece whose calibration photo changed
   it most (an edit also shifts other pixels a little: the watch's dial in the jacket photo), if that change is real (ASM_DE). */
function asmZones(master,calib){const W=master.width,N=W*W,L0=asmLab(master),best=new Float32Array(N),who=new Uint8Array(N),slots=['jacket','shirt','tie','watch'];
  slots.forEach((s,k)=>{if(!calib[s])return;const L=asmLab(calib[s]);for(let i=0;i<N;i++){const d=asmDE(L,L0,i);if(d>best[i]){best[i]=d;who[i]=k+1}}});
  const min={jacket:N/400,shirt:N/3000,tie:N/7000,watch:N/4000},hole={jacket:N/350,shirt:N/2500,tie:N/2500,watch:N/2500},z={W};
  slots.forEach((s,k)=>{let m=new Uint8Array(N);for(let i=0;i<N;i++)if(who[i]===k+1&&best[i]>ASM_DE)m[i]=1;
    m=asmBox(asmBox(m,W,2,true),W,2,false);z[s]=asmFill(asmBig(m,W,min[s]),W,hole[s])});
  // the watch is one thing: its biggest area and what lies right next to it
  if(asmCount(z.watch)){const a=asmAreas(z.watch,W);let top=1;for(let k=2;k<a.size.length;k++)if(a.size[k]>a.size[top])top=k;const near=asmBox(asmBig(z.watch,W,0,k=>k===top),W,12,true);for(let i=0;i<N;i++)if(!near[i])z.watch[i]=0}
  // one zone per pixel: the watch over the tie over the shirt over the jacket
  for(let i=0;i<N;i++){if(z.watch[i])z.tie[i]=z.shirt[i]=z.jacket[i]=0;else if(z.tie[i])z.shirt[i]=z.jacket[i]=0;else if(z.shirt[i])z.jacket[i]=0}
  return z}
const asmPackZones=z=>({W:z.W,jacket:asmPack(z.jacket),shirt:asmPack(z.shirt),tie:asmPack(z.tie),watch:asmPack(z.watch)});
const asmUnpackZones=p=>{const n=p.W*p.W;return {W:p.W,jacket:asmUnpack(p.jacket,n),shirt:asmUnpack(p.shirt,n),tie:asmUnpack(p.tie,n),watch:asmUnpack(p.watch,n)}};
/* are these zones believable? each piece has to be there and of a sensible size (a calibration edit that changed nothing, or the whole
   picture, gives zones that would ruin every outfit) */
function asmZonesOk(z){const N=z.W*z.W,f=s=>asmCount(z[s])/N;return f('jacket')>.2&&f('jacket')<.8&&f('shirt')>.01&&f('shirt')<.2&&f('tie')>.004&&f('tie')<.08&&f('watch')>.002&&f('watch')<.05}
/* ---- one outfit ---- */
/* The tie's own outline in its photo. A new tie is a pixel or two wider or narrower than the master's, so inside a band around the
   zone's edge each pixel is tie or not by the colours next to it: nearer to a tie pixel just inside, or to the cloth just outside? */
function asmTieMask(z,tie){const W=z.W,N=W*W,L=asmLab(tie),core=asmBox(z.tie,W,3,false),wide=asmBox(z.tie,W,3,true),m=new Uint8Array(core),R=6;
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!wide[i]||core[i])continue;let dT=1e9,dS=1e9;
    for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const j=yy*W+xx;
      if(core[j]){const d=asmDE(L,L,i,j);if(d<dT)dT=d}else if(!wide[j]){const d=asmDE(L,L,i,j);if(d<dS)dS=d}}}
    m[i]=dT===1e9?z.tie[i]:dS===1e9?1:dT<=dS?1:0}
  return asmBig(asmBox(asmBox(m,W,1,true),W,1,false),W,N/20000)}
/* the tie bar in its photo: the biggest thing on the tie that the master (which has none) doesn't show */
function asmBarMask(master,z,bar,tieM){const W=z.W,N=W*W,L0=asmLab(master),L=asmLab(bar),on=asmBox(tieM||z.tie,W,3,true);let m=new Uint8Array(N);
  for(let i=0;i<N;i++)if(on[i]&&asmDE(L,L0,i)>ASM_DE+4)m[i]=1;
  m=asmBox(asmBox(m,W,1,true),W,1,false);const a=asmAreas(m,W);let top=0;for(let k=1;k<a.size.length;k++)if(!top||a.size[k]>a.size[top])top=k;
  return top&&a.size[top]>=N/40000?asmBox(asmBig(m,W,0,k=>k===top),W,1,true):null}
/* another watch: the master watch's zone and whatever the new one changed around it. Where a smaller watch uncovers the cuff, its
   photo shows the MASTER's shirt there: those pixels (the cuff's colour, and joined to the cuff) are tinted to the outfit's shirt. */
function asmWatch(master,z,watch,shirt){const W=z.W,N=W*W,L0=asmLab(master),L=asmLab(watch),near=asmBox(z.watch,W,20,true);let m=new Uint8Array(N);
  for(let i=0;i<N;i++)if(z.watch[i]||(near[i]&&asmDE(L,L0,i)>ASM_DE+4))m[i]=1;
  m=asmBox(asmBox(m,W,2,true),W,2,false);const a=asmAreas(m,W),hit=new Set();for(let i=0;i<N;i++)if(z.watch[i]&&a.lab[i])hit.add(a.lab[i]);
  m=asmBox(asmBig(m,W,0,k=>hit.has(k)),W,1,true);
  const src=new Uint8ClampedArray(watch.data);let tinted=0;
  if(shirt){const zone=asmBox(m,W,28,true),from=[0,0,0],to=[0,0,0];let n=0;
    for(let i=0;i<N;i++)if(zone[i]&&z.shirt[i]&&!m[i]){n++;for(let k=0;k<3;k++){from[k]+=master.data[4*i+k];to[k]+=shirt.data[4*i+k]}}
    if(n>20){const f=from.map(v=>v/n),t=to.map(v=>v/n),fl=asmLab(new ImageData(new Uint8ClampedArray([...f,255]),1,1)),cuff=i=>Math.hypot(L[3*i]-fl[0],L[3*i+1]-fl[1],L[3*i+2]-fl[2])<12;
      // from the cuff's edge inward, through cuff-coloured pixels only (a white dial in the middle of the watch is not reached)
      const seen=new Uint8Array(N),st=[];for(let i=0;i<N;i++)if(m[i]&&cuff(i)){const x=i%W;if((x&&z.shirt[i-1]&&!m[i-1])||(x<W-1&&z.shirt[i+1]&&!m[i+1])||(i>=W&&z.shirt[i-W]&&!m[i-W])||(i<N-W&&z.shirt[i+W]&&!m[i+W])){seen[i]=1;st.push(i)}}
      while(st.length){const i=st.pop(),x=i%W;for(const j of [x?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(j>=0&&j<N&&m[j]&&!seen[j]&&cuff(j)){seen[j]=1;st.push(j)}}
      for(let i=0;i<N;i++)if(seen[i]){tinted++;for(let k=0;k<3;k++)src[4*i+k]=watch.data[4*i+k]*t[k]/Math.max(1,f[k])}}}
  return {mask:m,src,tinted}}
/* Pixels on a join between two pieces carry a little of the wrong neighbour (a tie made over a white shirt has a pale edge): each is
   rebuilt from the clean pixels around it, nearer ones counting more. */
function asmSeams(o,lab,W){const N=W*W,seam=new Uint8Array(N);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x,v=lab[i];if((x<W-1&&lab[i+1]!==v)||(y<W-1&&lab[i+W]!==v)){seam[i]=1;if(x<W-1&&lab[i+1]!==v)seam[i+1]=1;if(y<W-1&&lab[i+W]!==v)seam[i+W]=1}}
  const src=new Uint8ClampedArray(o);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!seam[i])continue;let r=0,g=0,b=0,w=0;
    for(let dy=-2;dy<=2;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-2;dx<=2;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const j=yy*W+xx;if(seam[j])continue;const k=1/(dx*dx+dy*dy);r+=src[4*j]*k;g+=src[4*j+1]*k;b+=src[4*j+2]*k;w+=k}}
    if(w){o[4*i]=r/w;o[4*i+1]=g/w;o[4*i+2]=b/w}}
  return seam}
/* master + zones + the outfit's piece photos {jacket, shirt, tie, bar, watch} (each optional: what is left out stays as the master
   shows it) -> the outfit's picture. info, when given, is filled with what was done (for tests). */
function asmCompose(master,z,P,info){const W=z.W,N=W*W,o=new Uint8ClampedArray(master.data),lab=new Uint8Array(N);
  const copy=(s,m,id)=>{for(let i=0;i<N;i++)if(m[i]){const j=4*i;o[j]=s[j];o[j+1]=s[j+1];o[j+2]=s[j+2];lab[i]=id}};
  if(P.jacket)copy(P.jacket.data,z.jacket,1);
  if(P.shirt)copy(P.shirt.data,z.shirt,2);
  let tieM=null;if(P.tie){tieM=asmTieMask(z,P.tie);
    // where the new tie is narrower than the master's, the shirt shows: the tie's photo has the master's shirt there, so take the outfit's shirt colour from next door
    if(P.shirt)for(let i=0;i<N;i++)if(z.tie[i]&&!tieM[i]){const x=i%W;let j=-1;for(let k=1;k<12&&j<0;k++){if(x-k>=0&&z.shirt[i-k])j=i-k;else if(x+k<W&&z.shirt[i+k])j=i+k}if(j>=0){o[4*i]=P.shirt.data[4*j];o[4*i+1]=P.shirt.data[4*j+1];o[4*i+2]=P.shirt.data[4*j+2];lab[i]=2}}
    copy(P.tie.data,tieM,3)}
  let barM=null;if(P.bar){barM=asmBarMask(master,z,P.bar,tieM);if(barM)copy(P.bar.data,barM,4)}
  let w=null;if(P.watch){w=asmWatch(master,z,P.watch,P.shirt);copy(w.src,w.mask,5)}
  const seam=asmSeams(o,lab,W);
  if(info)Object.assign(info,{lab,seam,tie:tieM,bar:barM,watch:w&&w.mask,tinted:w?w.tinted:0});
  return new ImageData(o,W,W)}
/* ---- keys, and what an outfit needs ---- */
const asmKey=t=>'c'+fnv64('asm/'+ASM_VER+'/'+t),asmMasterKey=()=>asmKey('master/jacket'),asmCalibKey=s=>asmKey('calib/'+s);
const ASM_SLOT={jacket:'top',shirt:'shirt',tie:'tie',bar:'clip',watch:'watch'};   // a piece and the outfit slot it dresses
const asmPieceKey=(slot,i)=>asmKey('piece/'+slot+'/'+lookSig(ASM_SLOT[slot],i));
/* the master's placeholder clothes: a plain mid-grey suit, a white shirt, a green tie, and the owner's watch */
const asmMasterItem=(type,primaryColor)=>({id:'asm-'+type,type,primaryColor,pattern:'solid'});
function asmMasterOutfit(){const watch=items.find(i=>i.type==='watch'&&inRotation(i))||items.find(i=>i.type==='watch');
  return {top:asmMasterItem('suit','midgrey'),shirt:asmMasterItem('shirt','white'),tie:asmMasterItem('tie','green'),watch,suitDay:true}}
/* what the kept master was made with (its watch and shirt need no piece of their own): {key, watch, shirt}, set when it is queued */
const asmInfo=()=>{try{const j=JSON.parse(localStorage.getItem('asm_master')||'null');return j&&j.key===asmMasterKey()?j:null}catch{return null}};
/* an outfit this can put together: a jacket (no vest), a shirt, a tie and a watch */
const asmCan=o=>!!(o&&o.top&&o.shirt&&o.tie&&o.watch&&!o.vest);
/* the piece photos an outfit needs: [{slot, key, item}] */
function asmParts(o){const inf=asmInfo()||{},out=[];
  for(const slot of ['jacket','shirt','tie','bar','watch']){const i=o[ASM_SLOT[slot]];if(!i)continue;const sig=lookSig(ASM_SLOT[slot],i);
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt))continue;   // as the master shows it
    out.push({slot,key:asmPieceKey(slot,i),item:i})}
  return out}
/* the zones of the kept master: from storage, else worked out from the four calibration photos and kept */
let asmZ=null;
async function asmZonesFor(master){const mk=asmMasterKey();if(asmZ&&asmZ.k===mk&&asmZ.z.W===master.width)return asmZ.z;
  const kept=await metaGet('asm:zones:'+mk);if(kept&&kept.W===master.width){asmZ={k:mk,z:asmUnpackZones(kept)};return asmZ.z}
  const calib={};for(const s of ['jacket','shirt','tie','watch']){const r=renders[asmCalibKey(s)];if(!r)return null;calib[s]=await asmData(r.img,master.width)}
  const z=asmZones(master,calib);if(!asmZonesOk(z))return null;
  await metaPut('asm:zones:'+mk,asmPackZones(z));asmZ={k:mk,z};return z}
/* the outfit's assembled picture as a JPEG data URL, or null when it can't be made (yet): no master, a piece missing, an outfit of
   another kind. Made once per combination and remembered while the app is open. */
const asmMade=new Map();
async function asmPhoto(o){if(!asmCan(o))return null;const m=renders[asmMasterKey()];if(!m)return null;
  const parts=asmParts(o);if(parts.some(p=>!renders[p.key]))return null;
  const ck=comboKey(o);if(asmMade.has(ck))return asmMade.get(ck);
  const master=await asmData(m.img),z=await asmZonesFor(master);if(!z)return null;
  const P={};for(const p of parts)P[p.slot]=await asmData(renders[p.key].img,master.width);
  const img=asmCompose(master,z,P),c=document.createElement('canvas');c.width=c.height=img.width;c.getContext('2d').putImageData(img,0,0);
  const url=c.toDataURL('image/jpeg',.9);if(asmMade.size>40)asmMade.clear();asmMade.set(ck,url);return url}
/* ---- the worker jobs that make the photos (sent by a later step; each is one POST /render {mode:'queue'}) ---- */
const ASM_CALIB={jacket:'a jacket of exactly the same cut in a solid, flat, bright pure red cloth with no pattern or texture',shirt:'a plain solid black dress shirt',
  tie:'a plain solid bright magenta tie with no pattern',watch:'a wristwatch of the same size with a bright blue case, a bright blue dial and a bright blue rubber strap'};
async function asmMasterJob(){const o=asmMasterOutfit(),{refs,labels}=await outfitRefsFull(o);
  return {mode:'queue',key:asmMasterKey(),image:await figurePng(o),refs,labels,outfit:outfitText(o),sig:'asm/master',master:true,quality:'high'}}
const asmCalibJob=s=>({mode:'queue',key:asmCalibKey(s),baseKey:asmMasterKey(),swap:{what:s,text:ASM_CALIB[s]},refs:[],labels:[],sig:'asm/calib/'+s});
/* one item's photo: the master with only that piece changed, from the item's own photos (and pattern drawing) and its description */
async function asmPieceJob(slot,i){const pt=role=>{const t=patternPrompt(i,role);return t?` (${t})`:''},blank={type:'suit'};
  let text,o,re;
  if(slot==='jacket'){o={top:i,suitDay:i.type==='suit'};re=/\b(suit|blazer)\b/;text=`a ${nm(i)}${pt('top')}`}
  else if(slot==='tie'){o={top:blank,tie:i};re=/\btie\b/;text=`a ${nm(i)}${pt('tie')}`}
  else if(slot==='shirt'){o={top:blank,shirt:i};re=/\bshirt\b/;
    text=shirtPatterned(i)?`a ${colName(primaryCol(i))} ${patName(i.pattern)} dress shirt${pt('shirt')}`:shirtTextured(i)?shirtTexText(i):`a plain ${colName(primaryCol(i))} dress shirt`}
  else if(slot==='watch'){o={top:blank,watch:i};re=/wristwatch/;text=watchText(i)}
  else{o=null;text=`a slim ${metalWord(i)} tie bar, clipped horizontally across the tie about halfway between the knot and the hand, a little narrower than the tie is wide`}
  let refs=[],labels=[];if(o){const r=await outfitRefsFull(o),k=r.labels.map((l,n)=>re.test(l)?n:-1).filter(n=>n>=0);refs=k.map(n=>r.refs[n]);labels=k.map(n=>r.labels[n])}
  if(slot==='shirt'&&i.photo){refs.unshift(i.photo);labels.unshift('the shirt')}   // an outfit's references leave the shirt's photo out (photos are shared by colour); its own piece needs it
  return {mode:'queue',key:asmPieceKey(slot,i),baseKey:asmMasterKey(),swap:{what:slot==='bar'?'tie bar':slot,text:prettyCols(text),...(slot==='bar'?{add:true}:{})},refs,labels,sig:'asm/piece/'+slot+'/'+lookSig(ASM_SLOT[slot],i)}}
