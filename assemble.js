// Assembled outfit photos (loaded after tagging.js). Instead of one generated photo per outfit, one MASTER photo fixes the pose and
// every item gets ONE photo, made by editing the master so that only that piece changes (the worker's swap jobs). An outfit's
// picture is then put together here, on the device, by copying each piece's pixels onto the master: no image model, no cost.
//   master  the pose, in the owner's dark grey herringbone suit, a white shirt and a burgundy tie (never shown as it is)
//   calib   four edits of the master in loud flat colours (jacket, shirt, tie, watch): where each differs from the master is that
//           piece's ZONE. They are only used to find the zones, once per master.
//   pieces  one edit of the master per jacket, shirt look, tie, tie bar and extra watch
// Order: master, then the jacket, shirt, tie, tie bar and watch; pixels along the joins are rebuilt from clean pixels either side.
// Today shows the assembled picture once the master, the zones and the outfit's pieces are on the device (asmFor / asmEnsure);
// an outfit it can't do (no jacket, no tie, a vest), or with a piece still missing, keeps its own photo.
const ASM_VER=2,ASM_DE=14,ASM_EDGE=3;
/* ASM_ZV: how zones are worked out. Zones and assembled pictures kept on a device carry it, so they are made again when it changes
   (2: a zone reaches the picture's edge) */
const ASM_ZV=2;   // ASM_DE: a colour difference (CIE Lab) that counts as "this pixel changed"
/* ASM_VER 2: the masters the owner approved, made from the redrawn figure (close framing, the lower hand at the waist button, the
   watch turned as worn, a blurred light office): his dark grey herringbone suit, a white shirt, a burgundy tie and his watch, and
   the same photo with the suit's waistcoat. Version 1's master (zoomed out, the lower hand too low) was rejected; every key
   carries the version, so its photos are simply no longer asked for.
   ASM_ON: are assembled pictures in use? Off, Today shows each outfit's own photo, nothing is fetched or made, and Settings hides
   Item photos (it was off between the two versions). */
let ASM_ON=true;
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
/* grow (any) or shrink a mask by r pixels (a square); a running count along rows, then columns, so a wide reach costs no more.
   Shrinking used to take a piece off wherever it reached the picture's edge (the reach ran off the picture and counted as "off"):
   closing a zone's gaps then cut its two outermost rows, and the master's white collar showed as a line along the top of a dark shirt */
function asmBox(m,W,r,any){const n=m.length,t=new Uint8Array(n),o=new Uint8Array(n),line=new Int32Array(W+1),pass=(a,b,step)=>{
    for(let u=0;u<W;u++){const at=step===1?u*W:u;line[0]=0;for(let p=0;p<W;p++)line[p+1]=line[p]+a[at+p*step];
      for(let p=0;p<W;p++){const lo=Math.max(0,p-r),hi=Math.min(W,p+r+1),c=line[hi]-line[lo];b[at+p*step]=any?(c?1:0):(c===hi-lo?1:0)}}};   // shrinking, what lies beyond the picture's edge doesn't count against a pixel
  pass(m,t,1);pass(t,o,W);return o}
/* smooth a mask's outline: a pixel is on when most of the square of r pixels around it is (ragged steps and spikes go) */
function asmMajor(m,W,r){const n=m.length,h=new Uint16Array(n),o=new Uint8Array(n),line=new Int32Array(W+1),half=((2*r+1)*(2*r+1))>>1;
  for(let y=0;y<W;y++){line[0]=0;for(let x=0;x<W;x++)line[x+1]=line[x]+m[y*W+x];for(let x=0;x<W;x++)h[y*W+x]=line[Math.min(W,x+r+1)]-line[Math.max(0,x-r)]}
  for(let x=0;x<W;x++){line[0]=0;for(let y=0;y<W;y++)line[y+1]=line[y]+h[y*W+x];for(let y=0;y<W;y++)o[y*W+x]=line[Math.min(W,y+r+1)]-line[Math.max(0,y-r)]>half?1:0}
  return o}
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
/* Where a waistcoat shows: its calibration photo is the vest master with the waistcoat in a loud colour, so the waistcoat is where
   the two differ (found against the plain master instead, a grey waistcoat over a shadowed white shirt left a ragged edge) */
function asmVestZone(vestMaster,calib,z){const W=z.W,N=W*W,L0=asmLab(vestMaster),L=asmLab(calib);let m=new Uint8Array(N);
  for(let i=0;i<N;i++)if(!z.watch[i]&&asmDE(L,L0,i)>ASM_DE)m[i]=1;
  m=asmBox(asmBox(m,W,2,true),W,2,false);const a=asmAreas(m,W);let top=0;for(let k=1;k<a.size.length;k++)if(!top||a.size[k]>a.size[top])top=k;
  return top?asmMajor(asmFill(asmBig(m,W,0,k=>a.size[k]>=N/1500||k===top),W,N/1500),W,2):m}
const asmPackZones=z=>({v:ASM_ZV,W:z.W,jacket:asmPack(z.jacket),shirt:asmPack(z.shirt),tie:asmPack(z.tie),watch:asmPack(z.watch)});
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
function asmSeams(o,lab,W){const N=W*W,seam=new Uint8Array(N),J=v=>v===7?1:v;   // 7, the jacket's edge ring, is the jacket; where it meets the untouched master (0) the two photos agree: no join
  const join=(a,b)=>a!==b&&J(a)!==J(b)&&!((a===7&&b===0)||(a===0&&b===7));
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x,v=lab[i];if((x<W-1&&join(lab[i+1],v))||(y<W-1&&join(lab[i+W],v))){seam[i]=1;if(x<W-1&&join(lab[i+1],v))seam[i+1]=1;if(y<W-1&&join(lab[i+W],v))seam[i+W]=1}}
  const src=new Uint8ClampedArray(o);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!seam[i])continue;let r=0,g=0,b=0,w=0;
    for(let dy=-2;dy<=2;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-2;dx<=2;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const j=yy*W+xx;if(seam[j])continue;const k=1/(dx*dx+dy*dy);r+=src[4*j]*k;g+=src[4*j+1]*k;b+=src[4*j+2]*k;w+=k}}
    if(w){o[4*i]=r/w;o[4*i+1]=g/w;o[4*i+2]=b/w}}
  return seam}
/* master + zones + the outfit's piece photos {jacket, shirt, tie, bar, watch} (each optional: what is left out stays as the master
   shows it) -> the outfit's picture. info, when given, is filled with what was done (for tests). */
function asmCompose(master,z,P,info){const W=z.W,N=W*W,o=new Uint8ClampedArray(master.data),lab=new Uint8Array(N),V0=P.vest||null;   // V0: the waistcoat's zone (the jacket piece is then a suit with its waistcoat)
  // the shirt and tie run 3px under the waistcoat's edge where they meet it (along it the suit's photo still shows the master's
  // shirt and tie), but not where the waistcoat meets the jacket
  let V=null;if(V0){const open=new Uint8Array(N);for(let i=0;i<N;i++)if((z.shirt[i]||z.tie[i])&&!V0[i])open[i]=1;const near=asmBox(open,W,3,true);V=new Uint8Array(N);for(let i=0;i<N;i++)if(V0[i]&&!near[i])V[i]=1}
  const copy=(s,m,id)=>{for(let i=0;i<N;i++)if(m[i]&&!(V&&V[i]&&id!==1&&id!==5)){const j=4*i;o[j]=s[j];o[j+1]=s[j+1];o[j+2]=s[j+2];lab[i]=id}};   // nothing but the suit (and a watch) goes over the waistcoat
  if(P.jacket){copy(P.jacket.data,z.jacket,1);if(V0)copy(P.jacket.data,V0,1);
    // the jacket's own outline: its zone stops a pixel or two short of the cloth's soft edge, and the master's dark edge left there
    // read as an outline round a lighter or bluer jacket. The ASM_EDGE pixels just outside the zone, where no other piece is, come
    // from the jacket's photo too (it is the master there, but for its own edge)
    const ring=asmBox(V0?z.jacket.map((v,i)=>v||V0[i]):z.jacket,W,ASM_EDGE,true);
    for(let i=0;i<N;i++)if(ring[i]&&!lab[i]&&!z.shirt[i]&&!z.tie[i]&&!z.watch[i]){const j=4*i;o[j]=P.jacket.data[j];o[j+1]=P.jacket.data[j+1];o[j+2]=P.jacket.data[j+2];lab[i]=7}}
  if(V0&&P.jacket){   // the master's tie also shows in the suit's photo where no zone covers it (its tip below the waistcoat): small specks of its colour are filled from beside them
    const Lm=asmLab(master),Lp=asmLab(P.jacket);let ga=0,gb=0,n=0;for(let i=0;i<N;i++)if(z.tie[i]){ga+=Lm[3*i+1];gb+=Lm[3*i+2];n++}ga/=n||1;gb/=n||1;
    if(Math.hypot(ga,gb)>12){const g=new Uint8Array(N);for(let i=0;i<N;i++)if(lab[i]===1&&Math.hypot(Lp[3*i+1]-ga,Lp[3*i+2]-gb)<12)g[i]=1;
      const a=asmAreas(g,W);for(let i=0;i<N;i++){const k=a.lab[i];if(!k||a.size[k]>N/1500)continue;const x=i%W;let j=-1;for(let d=1;d<30&&j<0;d++){if(x-d>=0&&lab[i-d]===1&&!g[i-d])j=i-d;else if(x+d<W&&lab[i+d]===1&&!g[i+d])j=i+d}
        if(j>=0){o[4*i]=o[4*j];o[4*i+1]=o[4*j+1];o[4*i+2]=o[4*j+2]}}}}
  if(P.shirt)copy(P.shirt.data,z.shirt,2);
  let tieM=null;if(P.tie){tieM=asmTieMask(z,P.tie);
    if(V){   // under a waistcoat only the tie's top shows: the part joined to the knot
      for(let i=0;i<N;i++)if(V[i])tieM[i]=0;const a=asmAreas(tieM,W);let top=0;for(let i=0;i<N&&!top;i++){const k=a.lab[i];if(k&&a.size[k]>N/8000)top=k}
      tieM=asmBig(tieM,W,0,k=>k===top)}
    // where the master's tie shows and the new one doesn't (a narrower tie; its tip below a waistcoat), the master's green would be
    // left: each such pixel takes what is beside it in the picture so far (the outfit's shirt, the waistcoat, the lapel)
    for(let i=0;i<N;i++)if(z.tie[i]&&!tieM[i]&&!(V&&V[i])){const x=i%W;let j=-1;for(let k=1;k<48&&j<0;k++){if(x-k>=0&&!z.tie[i-k])j=i-k;else if(x+k<W&&!z.tie[i+k])j=i+k}
      if(j>=0){o[4*i]=o[4*j];o[4*i+1]=o[4*j+1];o[4*i+2]=o[4*j+2];lab[i]=lab[j]&&lab[j]!==7?lab[j]:6}}
    copy(P.tie.data,tieM,3)}
  let barM=null;if(P.bar&&!V){barM=asmBarMask(master,z,P.bar,tieM);if(barM)copy(P.bar.data,barM,4)}
  let w=null;if(P.watch){w=asmWatch(master,z,P.watch,P.shirt);copy(w.src,w.mask,5)}
  const seam=asmSeams(o,lab,W);
  if(info)Object.assign(info,{lab,seam,tie:tieM,bar:barM,watch:w&&w.mask,tinted:w?w.tinted:0});
  return new ImageData(o,W,W)}
/* ---- keys, and what an outfit needs ---- */
/* ASM_VEST: which vest master this is. Its photos (the vest master, its calibration photo, each suit's vest piece) carry it in their
   keys, so a remade vest master replaces the old one on every device: version 1 drew a seven-button waistcoat */
const ASM_VEST=2,asmVestTag=(v=ASM_VEST)=>v>1?String(v):'';
const asmKey=t=>'c'+fnv64('asm/'+ASM_VER+'/'+t),asmMasterKey=()=>asmKey('master/jacket'),asmCalibKey=(s,v)=>asmKey('calib/'+s+(s==='vest'?asmVestTag(v):''));
/* the vest master: the master with a waistcoat added. A suit worn with its waistcoat has a second piece ('vest'), an edit of this one */
const asmVestKey=v=>asmKey('master/vest'+asmVestTag(v));
const ASM_SLOT={jacket:'top',vest:'top',shirt:'shirt',tie:'tie',bar:'clip',watch:'watch'};   // a piece and the outfit slot it dresses
/* how a piece looks, for its key: lookSig, and for a shirt in a woven texture that was never read the weave's name too (lookSig
   counts those by colour alone; here every shirt look gets its own photo) */
const asmLook=(slot,i)=>lookSig(ASM_SLOT[slot],i)+(slot==='shirt'&&texPat('shirt',i.pattern)&&!shirtPatterned(i)&&!shirtTextured(i)?'/weave/'+patBase(i.pattern):'');
const asmPieceKey=(slot,i,v)=>asmKey('piece/'+slot+(slot==='vest'?asmVestTag(v):'')+'/'+asmLook(slot,i));
/* the master's clothes: a dark grey herringbone suit, a white shirt, a burgundy tie, and the owner's watch. The kept master was
   made from the owner's own items and put on the worker by hand; this describes it, for the day one has to be made again */
const asmMasterItem=(type,primaryColor,pattern='solid')=>({id:'asm-'+type,type,primaryColor,pattern});
function asmMasterOutfit(){const watch=items.find(i=>i.type==='watch'&&inRotation(i))||items.find(i=>i.type==='watch');
  return {top:asmMasterItem('suit','darkgrey','herringbone'),shirt:asmMasterItem('shirt','white'),tie:asmMasterItem('tie','burgundy'),watch,suitDay:true}}
/* what the kept master was made with (its watch and shirt need no piece of their own): {watch, shirt}, carried in the master
   photo's own record (sig 'asm/master {…}'), so every device that has the master knows */
const asmMasterSig=o=>'asm/master '+JSON.stringify({watch:o.watch?asmLook('watch',o.watch):'',shirt:asmLook('shirt',o.shirt)});
const asmInfo=()=>{const m=renders[asmMasterKey()];if(!m)return null;try{const j=JSON.parse(String(m.sig||'').replace(/^asm\/master /,''));return j&&typeof j==='object'?j:{}}catch{return {}}};
/* an outfit this can put together: a jacket (with or without its waistcoat), a shirt, a tie and a watch */
const asmCan=o=>!!(o&&o.top&&o.shirt&&o.tie&&o.watch);
/* the piece photos an outfit needs: [{slot, key, item}] */
function asmParts(o){const inf=asmInfo()||{},out=[];
  for(const slot of ['jacket','shirt','tie','bar','watch']){const i=o[ASM_SLOT[slot]];if(!i||(slot==='bar'&&o.vest))continue;const sig=asmLook(slot,i);
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt))continue;   // as the master shows it
    out.push(slot==='jacket'&&o.vest?{slot,vest:true,key:asmPieceKey('vest',i),item:i}:{slot,key:asmPieceKey(slot,i),item:i})}   // a vest day: the suit's piece with its waistcoat
  return out}
/* the zones of the kept master: from storage, else worked out from the four calibration photos and kept */
let asmZ=null;
async function asmZonesFor(master){const mk=asmMasterKey();if(asmZ&&asmZ.k===mk&&asmZ.z.W===master.width)return asmZ.z;
  const kept=await metaGet('asm:zones:'+mk);if(kept&&kept.W===master.width&&kept.v===ASM_ZV){asmZ={k:mk,z:asmUnpackZones(kept)};return asmZ.z}
  const calib={};for(const s of ['jacket','shirt','tie','watch']){const r=renders[asmCalibKey(s)];if(!r)return null;calib[s]=await asmData(r.img,master.width)}
  const z=asmZones(master,calib);if(!asmZonesOk(z))return null;
  await metaPut('asm:zones:'+mk,asmPackZones(z));asmZ={k:mk,z};return z}
/* the waistcoat's zone for the kept vest master: from storage, else worked out from the vest master and its calibration photo and kept */
let asmV=null;
async function asmVestFor(z){const vk=asmVestKey(),r=renders[vk];if(!r)return null;if(asmV&&asmV.k===vk&&asmV.t===r.t&&asmV.m.length===z.W*z.W)return asmV.m;
  const kept=await metaGet('asm:vest:'+vk);if(kept&&kept.W===z.W&&kept.t===r.t&&kept.v===ASM_ZV){asmV={k:vk,t:r.t,m:asmUnpack(kept.m,z.W*z.W)};return asmV.m}
  const c=renders[asmCalibKey('vest')];if(!c)return null;
  const m=asmVestZone(await asmData(r.img,z.W),await asmData(c.img,z.W),z),share=asmCount(m)/(z.W*z.W);if(share<.01||share>.2)return null;   // no waistcoat, or half the picture: not believable
  await metaPut('asm:vest:'+vk,{v:ASM_ZV,W:z.W,t:r.t,m:asmPack(m)});asmV={k:vk,t:r.t,m};return m}
const asmVestKept=async()=>{const r=renders[asmVestKey()],k=r&&await metaGet('asm:vest:'+asmVestKey());return !!(k&&k.t===r.t&&k.v===ASM_ZV)};
/* Did an edit keep the picture? Outside its own piece (and a margin) a photo must still be the master. The generator once answered
   a swap with a collage: the figure moved aside, the reference photos pasted beside it. -> the share of outside pixels that changed */
const ASM_DRIFT=.12;
function asmDrift(master,z,slot,piece,vest){const W=z.W,N=W*W,L0=asmLab(master),L=asmLab(piece),own=asmBox(slot==='bar'?z.tie:z[slot],W,slot==='watch'?24:10,true),v=vest?asmBox(vest,W,10,true):null;let n=0,ch=0;
  for(let i=0;i<N;i+=3){if(own[i]||(v&&v[i]))continue;n++;if(asmDE(L,L0,i)>ASM_DE+4)ch++}return n?ch/n:1}
/* the outfit's assembled picture as a JPEG data URL, or null when it can't be made (yet): no master, a piece missing or one that
   came out wrong (asmBad), an outfit of another kind */
const asmBad=new Set();
async function asmPhoto(o){if(!asmCan(o))return null;const m=renders[asmMasterKey()];if(!m)return null;
  const parts=asmParts(o);if(parts.some(p=>!renders[p.key]||asmBad.has(p.key)))return null;
  const master=await asmData(m.img),z=await asmZonesFor(master);if(!z)return null;
  const V=o.vest?await asmVestFor(z):null;if(o.vest&&!V)return null;
  const P={};for(const p of parts){const d=await asmData(renders[p.key].img,master.width);if(asmDrift(master,z,p.slot,d,p.vest?V:null)>ASM_DRIFT){asmBad.add(p.key);return null}P[p.slot]=d}
  if(V)P.vest=V;
  const img=asmCompose(master,z,P),c=document.createElement('canvas');c.width=c.height=img.width;c.getContext('2d').putImageData(img,0,0);
  return c.toDataURL('image/jpeg',.9)}
/* ---- on Today: the assembled picture stands in for the outfit's photo ---- */
/* assembled pictures are kept on the device (meta 'asm:out:<key>', the newest ASM_KEEP), each with the newest date among the photos
   it was made from: a piece made again makes it stale */
let asmOut={};const ASM_KEEP=80,asmBusy=new Set(),asmTried=new Set();
const asmOutKey=o=>asmKey('out/z'+ASM_ZV+'/'+asmParts(o).map(p=>p.key).join('+'));
const asmStamp=o=>[renders[asmMasterKey()],o.vest&&renders[asmVestKey()],...asmParts(o).map(p=>renders[p.key])].reduce((t,r)=>Math.max(t,r&&r.t||0),0);
const asmWants=o=>ASM_ON&&asmCan(o)&&!!renders[asmMasterKey()]&&(!o.vest||!!renders[asmVestKey()]);   // a vest day needs the vest master too
/* the picture to show for an outfit, like a kept photo's record, or null. A photo made for this very outfit after the master
   (Settings: Regenerate) wins: that was the owner's choice. */
function asmFor(o){if(!asmWants(o))return null;const full=renders[comboKey(o)];if(full&&full.t>renders[asmMasterKey()].t)return null;
  const a=asmOut[asmOutKey(o)];return a&&a.stamp===asmStamp(o)?{img:a.img,model:'assembled',t:a.t,sig:comboSig(o)}:null}
async function asmLoad(){try{const all=await txs('meta','readonly',st=>st.getAll());asmOut={};for(const x of all||[])if(String(x.k).startsWith('asm:out:'))asmOut[x.k.slice(8)]=x.v}catch(e){console.warn(e)}
  await asmDropOld()}
/* photos made from an earlier vest master that this device still holds are dropped, once per version (localStorage.asm_vest) */
async function asmDropOld(){const had=+localStorage.getItem('asm_vest')||1;if(had>=ASM_VEST)return 0;let n=0;const del=k=>txs('meta','readwrite',st=>st.delete(k));
  try{for(let v=had;v<ASM_VEST;v++){const keys=[asmVestKey(v),asmCalibKey('vest',v),...items.filter(i=>i.type==='suit').map(i=>asmPieceKey('vest',i,v))];
      for(const k of keys)if(renders[k]){delete renders[k];await del('render:'+k);n++}
      await del('asm:vest:'+asmVestKey(v))}
    localStorage.setItem('asm_vest',String(ASM_VEST))}catch(e){console.warn(e)}
  return n}
/* one photo from the worker onto the device (each asked for once a session; a queued photo arrives by itself) */
async function asmGet(key,force){if(renders[key])return true;const W=workerBase(),mk=asmMasterKey();if(!W||asmTried.has(key))return false;
  // a worker with no master yet is not asked again at every start (ASM_NONE_MS), only when Settings looks
  if(key===mk&&!force&&Date.now()-(+localStorage.getItem('asm_none')||0)<ASM_NONE_MS)return false;
  asmTried.add(key);
  try{const r=await fetch(W.url+'?key='+key,{headers:{'x-app-token':W.tok},cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
    if(j&&j.img){await keepRender(key,{sig:j.sig||'',img:await shrinkUrl(j.img,900),model:j.model||'',t:j.t||Date.now()},false);if(key===mk)localStorage.removeItem('asm_none');return true}
    if(key===mk&&r.status===404)localStorage.setItem('asm_none',String(Date.now()))}catch(e){console.warn('piece unavailable',e)}
  return false}
const ASM_NONE_MS=6*3600e3;
const asmZonesKept=async()=>{const k=await metaGet('asm:zones:'+asmMasterKey());return !!(k&&k.v===ASM_ZV)};
/* bring what this outfit needs onto the device, put its picture together, keep it and show it */
async function asmEnsure(o){if(!ASM_ON||!asmCan(o)||asmFor(o))return;const mk=asmMasterKey();if(asmBusy.has(mk+comboKey(o)))return;asmBusy.add(mk+comboKey(o));
  try{if(!await asmGet(mk)||(o.vest&&!await asmGet(asmVestKey())))return;
    if(o.vest&&!await asmVestKept())await asmGet(asmCalibKey('vest'));
    const parts=asmParts(o),got=await Promise.all(parts.map(p=>asmGet(p.key)));if(got.includes(false))return;
    if(!await asmZonesKept())await Promise.all(['jacket','shirt','tie','watch'].map(s=>asmGet(asmCalibKey(s))));
    const img=await asmPhoto(o);if(!img)return;
    const k=asmOutKey(o),rec={img,stamp:asmStamp(o),t:Date.now()};asmOut[k]=rec;await metaPut('asm:out:'+k,rec);
    const old=Object.keys(asmOut).sort((a,b)=>asmOut[b].t-asmOut[a].t).slice(ASM_KEEP);for(const x of old){delete asmOut[x];txs('meta','readwrite',st=>st.delete('asm:out:'+x))}
    const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)refreshToday()}
  catch(e){console.warn('could not assemble',e)}finally{asmBusy.delete(mk+comboKey(o))}}
/* are any of this outfit's pieces being made right now? */
const asmPending=o=>asmWants(o)&&asmParts(o).some(p=>queuedKeys().includes(p.key)&&!renderStalled(p.key));
/* ---- every photo the wardrobe needs, and making the missing ones ---- */
const ASM_TYPE={suit:'jacket',blazer:'jacket',shirt:'shirt',tie:'tie',tieclip:'bar',watch:'watch'},ASM_COST={master:.24,calib:.065,vestmaster:.065,vestcalib:.065,piece:.08};
function asmNeeds(){const out=[],seen=new Set(),add=(kind,slot,item,k,what)=>{if(!seen.has(k)){seen.add(k);out.push({kind,slot,item,key:k,what})}},inf=asmInfo()||{};
  add('master',null,null,asmMasterKey(),'the master pose');
  for(const sl of ['jacket','shirt','tie','watch'])add('calib',sl,null,asmCalibKey(sl),'finding the '+sl);
  // waistcoats: the vest master, and a second piece for every suit that has one (unless vests are never worn)
  const vests=settings.vestMode==='never'?[]:items.filter(i=>i.type==='suit'&&i.vest!=='no'&&inRotation(i));
  if(vests.length){add('vestmaster',null,null,asmVestKey(),'the pose with a waistcoat');add('vestcalib','vest',null,asmCalibKey('vest'),'finding the waistcoat')}
  for(const i of items){const slot=ASM_TYPE[i.type];if(!slot||!inRotation(i))continue;const sig=asmLook(slot,i);
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt))continue;add('piece',slot,i,asmPieceKey(slot,i),nm(i));
    if(vests.includes(i))add('piece','vest',i,asmPieceKey('vest',i),nm(i)+' with its waistcoat')}
  return out}
/* asmState: what a look at the worker found. missing: photos nobody has made (or that came out wrong) */
let asmState={checked:false,missing:[],total:0},asmSyncing=null;
/* look at the worker: bring home what it has, note what it lacks. One look at a time; a forced one (Settings, a new item) waits for
   the look under way and then looks again, asking afresh for photos that were missing before. */
function asmSync(force){if(!ASM_ON||!workerBase())return Promise.resolve(asmState);if(asmSyncing)return force?asmSyncing.then(()=>asmSync(true)):asmSyncing;
  asmSyncing=(async()=>{
    try{if(force)asmTried.clear();const has=await asmGet(asmMasterKey(),force),kept=await asmZonesKept();if(has&&asmNeeds().some(n=>n.kind==='vestmaster'))await asmGet(asmVestKey());
      // no master on the worker: nothing else is asked for (the pieces are edits of it). Calibration photos are not needed once their zones are kept
      const vkept=await asmVestKept(),needs=asmNeeds().filter(n=>!(n.kind==='calib'&&kept)&&!(n.kind==='vestcalib'&&vkept)),lack=has?needs.filter(n=>!renders[n.key]):[];let i=0;
      const one=async()=>{while(i<lack.length){const n=lack[i++];await asmGet(n.key)}};await Promise.all([one(),one(),one()]);
      asmState.missing=needs.filter(n=>!renders[n.key]||asmBad.has(n.key));asmState.total=needs.filter(n=>n.kind==='piece').length;asmState.checked=true}
    catch(e){console.warn('assembled photos: could not check the worker',e)}
    asmSyncing=null;
    if(typeof renderAsmUI==='function')renderAsmUI();
    const cur=planFor()[key(sel)];if(cur&&asmCan(cur)&&!asmFor(cur)&&!$('#today').hidden)refreshToday();
    return asmState})();
  return asmSyncing}
/* send these to the worker's queue; they come home like any queued photo */
async function asmMake(list){const W=workerBase();if(!W)throw new Error('Set the Worker URL and App Token in ⚙ Settings first.');let sent=0;
  for(const n of list){const job=n.kind==='master'?await asmMasterJob():n.kind==='calib'||n.kind==='vestcalib'?asmCalibJob(n.slot):n.kind==='vestmaster'?asmVestMasterJob():await asmPieceJob(n.slot,n.item);if(asmBad.has(n.key))job.replace=true;
    const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify(job)}),j=await r.json().catch(()=>({}));
    if(r.ok&&j.queued){asmBad.delete(n.key);delete renders[n.key];if(n.kind==='master')localStorage.removeItem('asm_none');const q=rqGet();q.keys=[...new Set([...q.keys,n.key])];q.total=(q.total||0)+1;q.sentAt=Date.now();q.at={...(q.at||{}),[n.key]:q.sentAt};q.failed=q.failed||[];rqSet(q);sent++}
    else if(r.ok&&j.exists){asmTried.delete(n.key);await asmGet(n.key)}
    else throw new Error(j.error||`HTTP ${r.status}`)}
  asmState.missing=asmState.missing.filter(n=>!list.includes(n));if(sent)startQueueWatch();return sent}
const asmCostOf=list=>list.reduce((t,n)=>t+ASM_COST[n.kind],0);
/* Today's Generate for an outfit that can be assembled: make its missing pieces (about 8¢ each) instead of a whole photo */
async function asmQueueOutfit(o){const have=new Set(queuedKeys()),miss=asmParts(o).filter(p=>(!renders[p.key]||asmBad.has(p.key))&&!have.has(p.key)).map(p=>({kind:'piece',slot:p.slot,item:p.item,key:p.key,what:nm(p.item)}));
  if(miss.length)await asmMake(miss);else await asmEnsure(o);return 'asm'}
/* Settings: Realistic photos, "Item photos" */
function renderAsmUI(){const st=$('#asm-status'),btn=$('#asm-btn'),auto=$('#cfg-asm-auto'),grp=$('#asm-group');if(grp)grp.hidden=!ASM_ON;if(!st||!btn||!ASM_ON)return;if(auto)auto.value=settings.asmAuto===false?'off':'on';
  const money=v=>v<1?Math.round(v*100)+'¢':'$'+v.toFixed(2),queued=new Set(queuedKeys()),m=asmState.missing.filter(n=>!queued.has(n.key)),making=asmNeeds().filter(n=>queued.has(n.key)).length;
  if(!workerBase()){st.textContent='Set the Worker URL and App Token first.';btn.disabled=true;btn.textContent='Make item photos';return}
  if(!asmState.checked){st.textContent='Looking at what your worker has…';btn.disabled=true;btn.textContent='Make item photos';return}
  const master=m.find(n=>n.kind==='master'),pieces=m.filter(n=>n.kind==='piece').length,have=asmState.total-asmState.missing.filter(n=>n.kind==='piece').length;
  if(master){st.textContent='Outfit pictures can be put together on this device from one photo per item, instead of a new photo for every outfit. It starts with one master photo of the pose (about '+money(ASM_COST.master)+').';btn.disabled=false;btn.textContent='Make the master photo';return}
  if(making&&!m.length){st.textContent=`Your worker is making ${making} photo${making===1?'':'s'}. They appear as they finish; you can close the app.`;btn.disabled=true;btn.textContent='Making…';return}
  if(!m.length){st.textContent=`All ${asmState.total} item photos are here. Outfit pictures are put together on this device at no cost.`;btn.disabled=true;btn.textContent='All item photos made';return}
  st.textContent=`${have} of ${asmState.total} item photos are here. ${m.length} to make, about ${money(asmCostOf(m))}${pieces?` (${money(ASM_COST.piece)} an item)`:''}: ${m.slice(0,4).map(n=>n.what).join(', ')}${m.length>4?` and ${m.length-4} more`:''}.`;
  btn.disabled=false;btn.textContent=`Make ${m.length} photo${m.length===1?'':'s'}`}
async function asmMakeMissing(){const queued=new Set(queuedKeys()),m=asmState.missing.filter(n=>!queued.has(n.key));if(!m.length)return;const master=m.find(n=>n.kind==='master'),list=master?[master]:m;
  if(!confirm(`Make ${list.length} photo${list.length===1?'':'s'} on your worker?\n\nAbout $${asmCostOf(list).toFixed(2)} (OpenAI). They are made in the background: once they're sent you can close the app.`))return;
  const st=$('#asm-status'),btn=$('#asm-btn');if(btn)btn.disabled=true;if(st)st.textContent='Sending…';
  try{await asmMake(list)}catch(e){if(st){st.textContent='Couldn’t send them to your worker: '+(e.message||e);return}}
  renderAsmUI();renderBatchUI()}
function setAsmAuto(v){settings.asmAuto=v!=='off';saveUserSettings()}
/* a new item (or one put back in rotation): make its photo by itself. At most ASM_AUTO at a time: a restore or a changed wardrobe
   that suddenly needs many is left to the button in Settings, with its cost shown. */
let asmAutoTimer=0,ASM_AUTO_MS=4000;const ASM_AUTO=3;
function asmAutoSoon(){if(!ASM_ON)return;clearTimeout(asmAutoTimer);asmAutoTimer=setTimeout(async()=>{if(settings.asmAuto===false||!workerBase())return;
  try{const stt=await asmSync(),queued=new Set(queuedKeys()),m=stt.missing.filter(n=>n.kind==='piece'&&!queued.has(n.key));
    if(!renders[asmMasterKey()]||!m.length||m.length>ASM_AUTO||stt.missing.some(n=>n.kind!=='piece'))return;
    const n=await asmMake(m);if(n)toast(`Making ${n===1?'a photo of '+m[0].what:n+' item photos'} on your worker (about ${Math.round(asmCostOf(m)*100)}¢).`,5000)}catch(e){console.warn('automatic item photo failed',e)}},ASM_AUTO_MS)}
/* ---- the worker jobs that make the photos (sent by a later step; each is one POST /render {mode:'queue'}) ---- */
const ASM_CALIB={jacket:'a jacket of exactly the same cut in a solid, flat, bright pure red cloth with no pattern or texture',shirt:'a plain solid black dress shirt',
  tie:'a plain solid bright magenta tie with no pattern',vest:'a waistcoat of exactly the same cut and buttons in a solid, flat, bright pure orange cloth with no pattern or texture',watch:'a wristwatch of the same size with a bright blue case, a bright blue dial and a bright blue rubber strap'};
async function asmMasterJob(){const o=asmMasterOutfit(),{refs,labels}=await outfitRefsFull(o);
  return {mode:'queue',key:asmMasterKey(),image:await figurePng(o),refs,labels,outfit:outfitText(o),sig:asmMasterSig(o),master:true,quality:'high'}}
const asmVestMasterJob=()=>({mode:'queue',key:asmVestKey(),baseKey:asmMasterKey(),refs:[],labels:[],sig:'asm/master/vest',swap:{what:'waistcoat',add:true,
  text:'a matching waistcoat (vest) in exactly the same cloth as the suit jacket, worn under the jacket and buttoned up. Its V-shaped opening shows the shirt collar, the tie knot and the top of the tie; lower down the tie runs behind the waistcoat, and the waistcoat fills the opening of the jacket above its button'}});
const asmCalibJob=s=>({mode:'queue',key:asmCalibKey(s),baseKey:s==='vest'?asmVestKey():asmMasterKey(),swap:{what:s==='vest'?'waistcoat':s,text:ASM_CALIB[s]},refs:[],labels:[],sig:'asm/calib/'+s});
/* A shirt's description for its piece. A woven texture is asked for bolder than life: at this size (the shirt shows in a strip either
   side of the tie) a true-to-life weave can't be seen at all. The wording matters: "easy to see in this photo" made the generator
   paste the reference photos into the picture. */
const ASM_WEAVE={woven:'woven texture',textured:'woven texture','fine-texture':'fine woven texture',dobby:'dobby weave',oxford:'oxford weave',pinpoint:'pinpoint oxford weave','royal-oxford':'royal oxford weave',twill:'twill weave','end-on-end':'end-on-end weave',herringbone:'herringbone weave',chambray:'chambray weave'};
function asmShirtText(i){const c=colName(primaryCol(i));if(shirtPatterned(i)){const t=patternPrompt(i,'shirt');return `a ${c} ${patName(i.pattern)} dress shirt${t?` (${t})`:''}`}
  const kind=shirtTextured(i)?TEX_WORDS[i.sett.tex.kind]||'woven texture':texPat('shirt',i.pattern)?ASM_WEAVE[patBase(i.pattern)]||'woven texture':'';
  return kind?`a ${c} dress shirt in a bold tone-on-tone ${kind}: the pattern of the weave is clearly visible on the collar, the chest and the cuffs, drawn a little larger and with more contrast than life, in slightly darker and lighter shades of the same ${c}; the weave is in the cloth itself, not a print, stripes or checks`:`a plain ${c} dress shirt`}
/* one item's photo: the master with only that piece changed, from the item's own photos (and pattern drawing) and its description */
async function asmPieceJob(slot,i){const pt=role=>{const t=patternPrompt(i,role);return t?` (${t})`:''},blank={type:'suit'};
  let text,o,re;
  if(slot==='jacket'){o={top:i,suitDay:i.type==='suit'};re=/\b(suit|blazer)\b/;text=`a ${nm(i)}${pt('top')}`}
  else if(slot==='vest'){o={top:i,suitDay:true};re=/\bsuit\b/;text=`a ${nm(i)}${pt('top')}, a three-piece suit: the jacket and the waistcoat under it are both made of this same cloth (the waistcoat changes with the jacket; its cut and buttons stay where they are)`}
  else if(slot==='tie'){o={top:blank,tie:i};re=/\btie\b/;text=`a ${nm(i)}${pt('tie')}`}
  else if(slot==='shirt'){o={top:blank,shirt:i};re=/\bshirt\b/;text=asmShirtText(i)}
  else if(slot==='watch'){o={top:blank,watch:i};re=/wristwatch/;text=watchText(i)}
  else{o=null;text=`a slim ${metalWord(i)} tie bar, clipped horizontally across the tie about halfway between the knot and the hand, a little narrower than the tie is wide`}
  let refs=[],labels=[];if(o){const r=await outfitRefsFull(o),k=r.labels.map((l,n)=>re.test(l)?n:-1).filter(n=>n>=0);refs=k.map(n=>r.refs[n]);labels=k.map(n=>r.labels[n])}
  if(slot==='shirt'&&i.photo){refs.unshift(i.photo);labels.unshift('the shirt')}   // an outfit's references leave the shirt's photo out (photos are shared by colour); its own piece needs it
  if(slot==='tie'&&i.photo&&!labels.includes('the tie')){refs.unshift(i.photo);labels.unshift('the tie')}   // so do they a tie's photo when it has a close-up (the place goes to the shirt's close-up); its own piece keeps it
  return {mode:'queue',key:asmPieceKey(slot,i),baseKey:slot==='vest'?asmVestKey():asmMasterKey(),swap:{what:slot==='bar'?'tie bar':slot==='vest'?'jacket':slot,text:prettyCols(text),...(slot==='bar'?{add:true}:{})},refs,labels,sig:'asm/piece/'+slot+'/'+asmLook(slot,i)}}
