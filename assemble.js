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
const ASM_VER=3;
/* ASM_VER 3 (2026-11-12): masters at 2048 (ASM_SIZE): a plain mid grey suit (a flecked master left a dotted outline), a white shirt, a
   bright kelly green tie (a colour none of the owner's ties has: burgundy, his own, confused the halo of the master's tie), his
   Seiko with its dial turned as worn by hand (the generator always drew it upright); the waistcoat master is that photo with a
   low-cut waistcoat copied in. Masters and calibration photos were made outside the app and put on the worker by hand. */
const ASM_SIZE=2048,ASM_SZ=ASM_SIZE+'x'+ASM_SIZE;   // every job asks the worker for the masters' size: a piece is an edit of a master and must line up with it
const ASM_DE=14;
const ASM_EDGE=3;
const ASM_HALO=4;
const ASM_TINT=5;
const ASM_HAND=4;
const ASM_SOFT=2;
/* ASM_ZV: how zones are worked out. Zones and assembled pictures kept on a device carry it, so they are made again when it changes
   (2: a zone reaches the picture's edge; 3, 4: no halo of the master's tie; 5: the edge ring keeps off the hands' shadow line; 6: no rim of a piece's own skin round the fist; 7: the tie's smooth outline and soft edge; 8: the whole edge ring away from the hands) */
const ASM_ZV=9;   // 9: pixel distances scale with the picture (asmPx). ASM_DE: a colour difference (CIE Lab) that counts as "this pixel changed"
/* ASM_VER 2: the masters the owner approved, made from the redrawn figure (close framing, the lower hand at the waist button, the
   watch turned as worn, a blurred light office): his dark grey herringbone suit, a white shirt, a burgundy tie and his watch, and
   the same photo with the suit's waistcoat. Version 1's master (zoomed out, the lower hand too low) was rejected; every key
   carries the version, so its photos are simply no longer asked for.
   ASM_ON: are assembled pictures in use? Off, Today shows each outfit's own photo, nothing is fetched or made, and Settings hides
   Item photos (it was off between the two versions). */
let ASM_ON=!self.ASM_TEST_OFF;   // (tests switch assembled pictures off unless the test file says module.exports.assembled=true: tests/run.js)
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
/* every distance in pixels below was tuned on 900px pictures: asmPx(n, W) is that distance at width W (900: n itself, 2048: about
   2.3n). At 2048 the 900px distances left the waistcoat's edge wavy (its zone smoothed over 2px) and the jacket's edge ring too thin */
const ASM_BASE=900,asmPx=(n,W)=>W<=ASM_BASE?n:Math.round(n*W/ASM_BASE);   // never smaller than tuned (a small test picture keeps them)
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
function asmZones(master,calib){const W=master.width,N=W*W,L0=asmLab(master),best=new Float32Array(N),who=new Uint8Array(N),slots=['jacket','shirt','tie','watch'],px=n=>asmPx(n,W);
  slots.forEach((s,k)=>{if(!calib[s])return;const L=asmLab(calib[s]);for(let i=0;i<N;i++){const d=asmDE(L,L0,i);if(d>best[i]){best[i]=d;who[i]=k+1}}});
  const min={jacket:N/400,shirt:N/3000,tie:N/7000,watch:N/4000},hole={jacket:N/350,shirt:N/2500,tie:N/2500,watch:N/2500},z={W};
  slots.forEach((s,k)=>{let m=new Uint8Array(N);for(let i=0;i<N;i++)if(who[i]===k+1&&best[i]>ASM_DE)m[i]=1;
    m=asmBox(asmBox(m,W,px(2),true),W,px(2),false);z[s]=asmFill(asmBig(m,W,min[s]),W,hole[s])});
  // the watch is one thing: its biggest area and what lies right next to it
  if(asmCount(z.watch)){const a=asmAreas(z.watch,W);let top=1;for(let k=2;k<a.size.length;k++)if(a.size[k]>a.size[top])top=k;const near=asmBox(asmBig(z.watch,W,0,k=>k===top),W,px(12),true);for(let i=0;i<N;i++)if(!near[i])z.watch[i]=0}
  // one zone per pixel: the watch over the tie over the shirt over the jacket
  for(let i=0;i<N;i++){if(z.watch[i])z.tie[i]=z.shirt[i]=z.jacket[i]=0;else if(z.tie[i])z.shirt[i]=z.jacket[i]=0;else if(z.shirt[i])z.jacket[i]=0}
  return z}
/* Where a waistcoat shows: its calibration photo is the vest master with the waistcoat in a loud colour, so the waistcoat is where
   the two differ (found against the plain master instead, a grey waistcoat over a shadowed white shirt left a ragged edge) */
function asmVestZone(vestMaster,calib,z){const W=z.W,N=W*W,L0=asmLab(vestMaster),L=asmLab(calib),px=n=>asmPx(n,W);let m=new Uint8Array(N);
  for(let i=0;i<N;i++)if(!z.watch[i]&&asmDE(L,L0,i)>ASM_DE)m[i]=1;
  m=asmBox(asmBox(m,W,px(2),true),W,px(2),false);const a=asmAreas(m,W);let top=0;for(let k=1;k<a.size.length;k++)if(!top||a.size[k]>a.size[top])top=k;
  return top?asmMajor(asmFill(asmBig(m,W,0,k=>a.size[k]>=N/1500||k===top),W,N/1500),W,px(2)):m}
/* Zones of a picture bigger than ASM_BASE are worked out at ASM_BASE (where every distance in asmZones and asmVestZone was tuned) and
   then enlarged: each pixel takes the zone its four nearest small pixels vote for, weighted by how near they are, so the outlines
   come out smooth and no pixel is left between two zones. Worked out at 2048 instead (every distance scaled), the smoothing filled
   the gap between a knuckle and the lapel and the jacket's zone cut a corner off the hand; with the 900 distances at 2048 the
   waistcoat's edge was wavy. */
function asmUpLabels(lab,w,W){const o=new Uint8Array(W*W),k=w/W,v=new Float32Array(5);
  for(let y=0;y<W;y++){const sy=Math.min(w-1,Math.max(0,(y+.5)*k-.5)),y0=Math.floor(sy),y1=Math.min(w-1,y0+1),fy=sy-y0;
    for(let x=0;x<W;x++){const sx=Math.min(w-1,Math.max(0,(x+.5)*k-.5)),x0=Math.floor(sx),x1=Math.min(w-1,x0+1),fx=sx-x0;v.fill(0);
      v[lab[y0*w+x0]]+=(1-fx)*(1-fy);v[lab[y0*w+x1]]+=fx*(1-fy);v[lab[y1*w+x0]]+=(1-fx)*fy;v[lab[y1*w+x1]]+=fx*fy;
      let b=0;for(let c=1;c<5;c++)if(v[c]>v[b])b=c;o[y*W+x]=b}}
  return o}
const ASM_SLOTS=['jacket','shirt','tie','watch'];
function asmUpZones(z,W){if(z.W===W)return z;const w=z.W,lab=new Uint8Array(w*w);ASM_SLOTS.forEach((s,k)=>{for(let i=0;i<w*w;i++)if(z[s][i])lab[i]=k+1});
  const up=asmUpLabels(lab,w,W),o={W};ASM_SLOTS.forEach((s,k)=>{const m=new Uint8Array(W*W);for(let i=0;i<W*W;i++)if(up[i]===k+1)m[i]=1;o[s]=m});return o}
const asmUpMask=(m,w,W)=>w===W?m:asmUpLabels(m,w,W);
/* a mask made smaller (the nearest pixel): the watch's zone, to work the waistcoat's zone out at ASM_BASE */
function asmDownMask(m,W,w){const o=new Uint8Array(w*w),k=W/w;for(let y=0;y<w;y++){const yy=Math.min(W-1,Math.floor((y+.5)*k));for(let x=0;x<w;x++)o[y*w+x]=m[yy*W+Math.min(W-1,Math.floor((x+.5)*k))]}return o}
const asmPackZones=z=>({v:ASM_ZV,W:z.W,jacket:asmPack(z.jacket),shirt:asmPack(z.shirt),tie:asmPack(z.tie),watch:asmPack(z.watch)});
const asmUnpackZones=p=>{const n=p.W*p.W;return {W:p.W,jacket:asmUnpack(p.jacket,n),shirt:asmUnpack(p.shirt,n),tie:asmUnpack(p.tie,n),watch:asmUnpack(p.watch,n)}};
/* are these zones believable? each piece has to be there and of a sensible size (a calibration edit that changed nothing, or the whole
   picture, gives zones that would ruin every outfit) */
function asmZonesOk(z){const N=z.W*z.W,f=s=>asmCount(z[s])/N;return f('jacket')>.2&&f('jacket')<.8&&f('shirt')>.01&&f('shirt')<.2&&f('tie')>.004&&f('tie')<.08&&f('watch')>.002&&f('watch')<.05}
/* ---- one outfit ---- */
/* The tie's own outline in its photo. A new tie is a pixel or two wider or narrower than the master's, so inside a band around the
   zone's edge each pixel is tie or not by the colours next to it: nearer to a tie pixel just inside, or to the cloth just outside? */
/* master (optional): outside the master's tie the tie's photo is the master unchanged, so a pixel there that still matches it is not
   tie. Without it, the shirt's grey shadow beside the tie (nearer the dark tie's colour than the lit shirt's) was taken as tie: a
   pale line along a tie on a very dark shirt (2026-11-12, 2048) */
function asmTieMask(z,tie,master){const W=z.W,N=W*W,L=asmLab(tie),Lm=master?asmLab(master):null,px=n=>asmPx(n,W),core=asmBox(z.tie,W,px(3),false),wide=asmBox(z.tie,W,px(3),true),m=new Uint8Array(core),R=px(6);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!wide[i]||core[i])continue;if(Lm&&!z.tie[i]&&asmDE(L,Lm,i)<ASM_DE){m[i]=0;continue}let dT=1e9,dS=1e9;
    for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const j=yy*W+xx;
      if(core[j]){const d=asmDE(L,L,i,j);if(d<dT)dT=d}else if(!wide[j]){const d=asmDE(L,L,i,j);if(d<dS)dS=d}}}
    m[i]=dT===1e9?z.tie[i]:dS===1e9?1:dT<=dS?1:0}
  return asmBig(asmMajor(asmBox(asmBox(m,W,px(1),true),W,px(1),false),W,px(2)),W,N/20000)}   // asmMajor: each pixel was decided by itself, which left the outline ragged
/* the tie bar in its photo: the biggest thing on the tie that the master (which has none) doesn't show */
function asmBarMask(master,z,bar,tieM){const W=z.W,N=W*W,L0=asmLab(master),L=asmLab(bar),px=n=>asmPx(n,W),on=asmBox(tieM||z.tie,W,px(3),true);let m=new Uint8Array(N);
  for(let i=0;i<N;i++)if(on[i]&&asmDE(L,L0,i)>ASM_DE+4)m[i]=1;
  m=asmBox(asmBox(m,W,px(1),true),W,px(1),false);const a=asmAreas(m,W);let top=0;for(let k=1;k<a.size.length;k++)if(!top||a.size[k]>a.size[top])top=k;
  return top&&a.size[top]>=N/40000?asmBox(asmBig(m,W,0,k=>k===top),W,px(1),true):null}
/* another watch: the master watch's zone and whatever the new one changed around it. Where a smaller watch uncovers the cuff, its
   photo shows the MASTER's shirt there: those pixels (the cuff's colour, and joined to the cuff) are tinted to the outfit's shirt. */
function asmWatch(master,z,watch,shirt){const W=z.W,N=W*W,L0=asmLab(master),L=asmLab(watch),px=n=>asmPx(n,W),near=asmBox(z.watch,W,px(20),true);let m=new Uint8Array(N);
  for(let i=0;i<N;i++)if(z.watch[i]||(near[i]&&asmDE(L,L0,i)>ASM_DE+4))m[i]=1;
  m=asmBox(asmBox(m,W,px(2),true),W,px(2),false);const a=asmAreas(m,W),hit=new Set();for(let i=0;i<N;i++)if(z.watch[i]&&a.lab[i])hit.add(a.lab[i]);
  m=asmBox(asmBig(m,W,0,k=>hit.has(k)),W,px(1),true);
  const src=new Uint8ClampedArray(watch.data);let tinted=0;
  if(shirt){const zone=asmBox(m,W,px(28),true),from=[0,0,0],to=[0,0,0];let n=0;
    for(let i=0;i<N;i++)if(zone[i]&&z.shirt[i]&&!m[i]){n++;for(let k=0;k<3;k++){from[k]+=master.data[4*i+k];to[k]+=shirt.data[4*i+k]}}
    if(n>20){const f=from.map(v=>v/n),t=to.map(v=>v/n),fl=asmLab(new ImageData(new Uint8ClampedArray([...f,255]),1,1)),cuff=i=>Math.hypot(L[3*i]-fl[0],L[3*i+1]-fl[1],L[3*i+2]-fl[2])<12;
      // from the cuff's edge inward, through cuff-coloured pixels only (a white dial in the middle of the watch is not reached)
      const seen=new Uint8Array(N),st=[];for(let i=0;i<N;i++)if(m[i]&&cuff(i)){const x=i%W;if((x&&z.shirt[i-1]&&!m[i-1])||(x<W-1&&z.shirt[i+1]&&!m[i+1])||(i>=W&&z.shirt[i-W]&&!m[i-W])||(i<N-W&&z.shirt[i+W]&&!m[i+W])){seen[i]=1;st.push(i)}}
      while(st.length){const i=st.pop(),x=i%W;for(const j of [x?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(j>=0&&j<N&&m[j]&&!seen[j]&&cuff(j)){seen[j]=1;st.push(j)}}
      for(let i=0;i<N;i++)if(seen[i]){tinted++;for(let k=0;k<3;k++)src[4*i+k]=watch.data[4*i+k]*t[k]/Math.max(1,f[k])}}}
  return {mask:m,src,tinted}}
/* Pixels on a join between two pieces carry a little of the wrong neighbour (a tie made over a white shirt has a pale edge): each is
   rebuilt from the clean pixels around it, nearer ones counting more. */
function asmSeams(o,lab,W,soft){const N=W*W,seam=new Uint8Array(N),J=v=>v===7?1:v,S=asmPx(2,W);   // 7, the jacket's edge ring, is the jacket; S: how far round a seam pixel clean pixels are looked for
  const join=(a,b)=>J(a)!==J(b);   // (soft: pixels of the tie's soft edge, already blended: not rebuilt)
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x,v=lab[i];if((x<W-1&&join(lab[i+1],v))||(y<W-1&&join(lab[i+W],v))){seam[i]=1;if(x<W-1&&join(lab[i+1],v))seam[i+1]=1;if(y<W-1&&join(lab[i+W],v))seam[i+W]=1}}
  if(soft)for(let i=0;i<N;i++)if(soft[i])seam[i]=0;
  const src=new Uint8ClampedArray(o);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!seam[i])continue;let r=0,g=0,b=0,w=0;
    for(let dy=-S;dy<=S;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-S;dx<=S;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const j=yy*W+xx;if(seam[j])continue;const k=1/(dx*dx+dy*dy);r+=src[4*j]*k;g+=src[4*j+1]*k;b+=src[4*j+2]*k;w+=k}}
    if(w){o[4*i]=r/w;o[4*i+1]=g/w;o[4*i+2]=b/w}}
  return seam}
/* master + zones + the outfit's piece photos {jacket, shirt, tie, bar, watch} (each optional: what is left out stays as the master
   shows it) -> the outfit's picture. info, when given, is filled with what was done (for tests). */
/* The master's tie is a bright green none of the owner's ties has, so in another piece's photo green beside the tie can only be the
   master's tie left over. A piece that redrew it a little to one side (the pink herringbone shirt's, 15px left, 2026-11-12) put a
   green strip into the shirt's zone, wider than the halo band. Near the tie (ASM_KEY_NEAR), a jacket or shirt pixel within
   ASM_KEY_DE of the master tie's hue, in a zone whose own cloth is not that hue, takes the nearest clean pixel of its own piece. */
const ASM_KEY_NEAR=40,ASM_KEY_DE=16;
function asmKeyFill(o,lab,z,master,W){const N=W*W,px=n=>asmPx(n,W),Lm=asmLab(master);let ga=0,gb=0,n=0;
  for(let i=0;i<N;i++)if(z.tie[i]){ga+=Lm[3*i+1];gb+=Lm[3*i+2];n++}if(!n)return 0;ga/=n;gb/=n;if(Math.hypot(ga,gb)<20)return 0;   // a dull master tie: nothing to key on
  const Lo=asmLab(new ImageData(new Uint8ClampedArray(o),W,W)),near=asmBox(z.tie,W,px(ASM_KEY_NEAR),true),hue=i=>Math.hypot(Lo[3*i+1]-ga,Lo[3*i+2]-gb)<ASM_KEY_DE;
  const m=[0,[0,0,0],[0,0,0]];for(let i=0;i<N;i++){const k=lab[i];if((k===1||k===2)&&!near[i]){m[k][0]+=Lo[3*i+1];m[k][1]+=Lo[3*i+2];m[k][2]++}}
  const keyed=[false,...[1,2].map(k=>!m[k][2]||Math.hypot(m[k][0]/m[k][2]-ga,m[k][1]/m[k][2]-gb)>ASM_KEY_DE*2)];   // a green suit or shirt is left alone
  let g=new Uint8Array(N),c=0;for(let i=0;i<N;i++){const k=lab[i];if(near[i]&&!z.tie[i]&&(k===1||k===2)&&keyed[k]&&hue(i)){g[i]=1;c++}}if(!c)return 0;
  g=asmBox(g,W,px(2),true);for(let i=0;i<N;i++)if(g[i]&&lab[i]!==1&&lab[i]!==2)g[i]=0;   // and the soft pixels around each (with 1px a pale line of its edge was left)
  // each green area is covered with a copy of the cloth beside it, moved sideways by the area's widest run plus 2px, the same shift
  // for the whole area so a weave carries on (filling each pixel from its nearest clean one smeared a herringbone into streaks)
  const src=new Uint8ClampedArray(o),R=px(14),A=asmAreas(g,W),K=A.size.length,run=new Int32Array(K);
  for(let y=0;y<W;y++){let x=0;while(x<W){const k=A.lab[y*W+x];if(!k){x++;continue}let e=x;while(e<W&&A.lab[y*W+e]===k)e++;run[k]=Math.max(run[k],e-x);x=e}}
  const ok=(i,j)=>j>=0&&j<N&&Math.abs((j%W)-(i%W))<W/2&&lab[j]===lab[i]&&!g[j],side=new Int32Array(K),cnt=[new Int32Array(K),new Int32Array(K)];
  for(let i=0;i<N;i++){const k=A.lab[i];if(!k)continue;const s=run[k]+px(2);if(ok(i,i-s))cnt[0][k]++;if(ok(i,i+s))cnt[1][k]++}
  for(let k=1;k<K;k++)side[k]=cnt[0][k]>=cnt[1][k]?-(run[k]+px(2)):run[k]+px(2);
  for(let i=0;i<N;i++){const k=A.lab[i];if(!k)continue;const j=i+side[k];if(ok(i,j)){o[4*i]=src[4*j];o[4*i+1]=src[4*j+1];o[4*i+2]=src[4*j+2];g[i]=2}}
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(g[i]!==1)continue;let j=-1,best=1e9;   // what the shift couldn't reach: the nearest clean pixel
    for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx,d=dx*dx+dy*dy;if(d<best&&lab[q]===lab[i]&&!g[q]){best=d;j=q}}}
    if(j>=0){o[4*i]=src[4*j];o[4*i+1]=src[4*j+1];o[4*i+2]=src[4*j+2]}}
  return c}
function asmCompose(master,z,P,info){const W=z.W,N=W*W,o=new Uint8ClampedArray(master.data),lab=new Uint8Array(N),soft=new Uint8Array(N),V0=P.vest||null,px=n=>asmPx(n,W);   // V0: the waistcoat's zone (the jacket piece is then a suit with its waistcoat)
  // the shirt and tie run 3px under the waistcoat's edge where they meet it (along it the suit's photo still shows the master's
  // shirt and tie), but not where the waistcoat meets the jacket
  let V=null;if(V0){const open=new Uint8Array(N);for(let i=0;i<N;i++)if((z.shirt[i]||z.tie[i])&&!V0[i])open[i]=1;const near=asmBox(open,W,px(3),true);V=new Uint8Array(N);for(let i=0;i<N;i++)if(V0[i]&&!near[i])V[i]=1}
  const copy=(s,m,id)=>{for(let i=0;i<N;i++)if(m[i]&&!(V&&V[i]&&id!==1&&id!==5)){const j=4*i;o[j]=s[j];o[j+1]=s[j+1];o[j+2]=s[j+2];lab[i]=id}};   // nothing but the suit (and a watch) goes over the waistcoat
  if(P.jacket){copy(P.jacket.data,z.jacket,1);if(V0)copy(P.jacket.data,V0,1);
    // the jacket's own outline: its zone stops a pixel or two short of the cloth's soft edge, and the master's dark edge left there
    // read as an outline round a lighter or bluer jacket. The ASM_EDGE pixels just outside the zone, where no other piece is, come
    // from the jacket's photo too (it is the master there, but for its own edge)
    // Away from the hands every ring pixel is taken: there the jacket's photo is the master but for its own edge. (Taking only the
    // pixels of the master jacket's colour left a dotted outline: the master's herringbone is light and dark dots, and only the dark
    // ones passed.) Within ASM_HAND+2 of the master's skin, only what is cloth in both photos: never skin, the master's or the piece's
    // (a suit's photo redraws the hands a little, and its fist's outline came out ragged).
    const own=V0?z.jacket.map((v,i)=>v||V0[i]):z.jacket,ring=asmBox(own,W,px(ASM_EDGE),true),Lm=asmLab(master),Lj=asmLab(P.jacket),isSkin=(L,i)=>L[3*i+1]>8&&L[3*i+2]>10&&L[3*i]>50;   // lit skin: the dark rim of a hand over the master's burgundy tie is reddish too, and is not kept
    const skin=new Uint8Array(N);for(let i=0;i<N;i++)if(!own[i]&&!z.shirt[i]&&!z.tie[i]&&!z.watch[i]&&isSkin(Lm,i))skin[i]=1;
    const byHand=asmBox(asmBox(skin,W,px(1),false),W,px(ASM_HAND+2),true);
    for(let i=0;i<N;i++){if(!ring[i]||lab[i]||z.shirt[i]||z.tie[i]||z.watch[i])continue;if(byHand[i]&&(isSkin(Lm,i)||isSkin(Lj,i)))continue;
      const j=4*i;o[j]=P.jacket.data[j];o[j+1]=P.jacket.data[j+1];o[j+2]=P.jacket.data[j+2];lab[i]=7}}
  if(P.jacket){   // A suit's photo redraws the hands a little (most with a waistcoat): where its hand is a pixel or two larger than the
    // master's, a rim of ITS skin lies in the jacket's zone, outside the master's hand, and reads as a dotted outline round the fist.
    // Beside the master's skin, a jacket pixel that is the master's skin colour there and not the cloth's takes the nearest cloth.
    const Lm=asmLab(master),Lp=asmLab(P.jacket),skin=new Uint8Array(N);for(let i=0;i<N;i++)if(!lab[i]&&!z.shirt[i]&&!z.tie[i]&&!z.watch[i]&&Lm[3*i+1]>8&&Lm[3*i+2]>10&&Lm[3*i]>35)skin[i]=1;
    const core=asmBox(skin,W,px(1),false),by=asmBox(core,W,px(ASM_HAND),true),far=asmBox(core,W,px(ASM_HAND+6),true),over=new Uint8Array(N),R=px(ASM_HAND+6);
    for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(lab[i]!==1||!by[i])continue;let s=[0,0,0,0],c=[0,0,0,0];
      for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx;
        if(core[q]){s[0]+=Lm[3*q];s[1]+=Lm[3*q+1];s[2]+=Lm[3*q+2];s[3]++}else if(lab[q]===1&&!by[q]){c[0]+=Lp[3*q];c[1]+=Lp[3*q+1];c[2]+=Lp[3*q+2];c[3]++}}}
      if(!s[3]||!c[3])continue;const dS=Math.hypot(Lp[3*i]-s[0]/s[3],Lp[3*i+1]-s[1]/s[3],Lp[3*i+2]-s[2]/s[3]),dC=Math.hypot(Lp[3*i]-c[0]/c[3],Lp[3*i+1]-c[1]/c[3],Lp[3*i+2]-c[2]/c[3]);
      if(dS<dC&&Math.hypot(s[0]/s[3]-c[0]/c[3],s[1]/s[3]-c[1]/c[3],s[2]/s[3]-c[2]/c[3])>20)over[i]=1}   // nearer the skin than the cloth (a skin-coloured jacket is left alone)
    const from=new Uint8ClampedArray(o);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!over[i])continue;let j=-1,best=1e9;
      for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const d=dx*dx+dy*dy,q=yy*W+xx;if(d<best&&lab[q]===1&&!over[q]&&far[q]){best=d;j=q}}}
      if(j>=0){o[4*i]=from[4*j];o[4*i+1]=from[4*j+1];o[4*i+2]=from[4*j+2]}}}
  if(V0&&P.jacket){   // the master's tie also shows in the suit's photo where no zone covers it (its tip below the waistcoat): small specks of its colour are filled from beside them
    const Lm=asmLab(master),Lp=asmLab(P.jacket);let ga=0,gb=0,n=0;for(let i=0;i<N;i++)if(z.tie[i]){ga+=Lm[3*i+1];gb+=Lm[3*i+2];n++}ga/=n||1;gb/=n||1;
    if(Math.hypot(ga,gb)>12){const g=new Uint8Array(N);for(let i=0;i<N;i++)if(lab[i]===1&&Math.hypot(Lp[3*i+1]-ga,Lp[3*i+2]-gb)<12)g[i]=1;
      const a=asmAreas(g,W);for(let i=0;i<N;i++){const k=a.lab[i];if(!k||a.size[k]>N/1500)continue;const x=i%W;let j=-1;for(let d=1;d<px(30)&&j<0;d++){if(x-d>=0&&lab[i-d]===1&&!g[i-d])j=i-d;else if(x+d<W&&lab[i+d]===1&&!g[i+d])j=i+d}
        if(j>=0){o[4*i]=o[4*j];o[4*i+1]=o[4*j+1];o[4*i+2]=o[4*j+2]}}}}
  if(P.shirt)copy(P.shirt.data,z.shirt,2);
  asmKeyFill(o,lab,z,master,W);
  let tieM=null;if(P.tie){tieM=asmTieMask(z,P.tie,master);
    if(V){   // under a waistcoat only the tie's top shows: the part joined to the knot
      for(let i=0;i<N;i++)if(V[i])tieM[i]=0;const a=asmAreas(tieM,W);let top=0;for(let i=0;i<N&&!top;i++){const k=a.lab[i];if(k&&a.size[k]>N/8000)top=k}
      tieM=asmBig(tieM,W,0,k=>k===top)}
    // where the master's tie shows and the new one doesn't (a narrower tie; its tip below a waistcoat), the master's green would be
    // left: each such pixel takes what is beside it in the picture so far (the outfit's shirt, the waistcoat, the lapel)
    // The same goes for the master tie's soft edge, which lies just OUTSIDE its zone: every other piece's photo shows the master's
    // tie, so pixels within ASM_HALO of the zone carry a little of its colour (a red halo round a navy tie on a black shirt). A
    // pixel there is TINTED when its colour leans from its own piece's toward the master tie's by more than ASM_TINT; tinted pixels,
    // the zone's leftovers and the cracks between the tie's zone and another take the nearest clean pixel of their own piece, in
    // any direction. (Filling the whole band from the side put lapel grey into the slivers of shirt beside the tie: two bumps.)
    // Never the hands or the wall: what belongs to no piece and is more than a crack between two.
    const halo=asmBox(z.tie,W,px(ASM_HALO),true),free=new Uint8Array(N);for(let i=0;i<N;i++)if(!(z.shirt[i]||z.jacket[i]||z.tie[i]||z.watch[i]||(V0&&V0[i])))free[i]=1;
    const open=asmBox(asmBox(free,W,px(3),false),W,px(4),true),hand=i=>free[i]&&open[i],zid=i=>z.tie[i]?0:z.shirt[i]?2:(z.jacket[i]||(V0&&V0[i])||lab[i]===7)?1:0;
    const src=new Uint8ClampedArray(o),Lo=asmLab(new ImageData(src,W,W)),Lt=asmLab(master),mean=[null,[0,0,0],[0,0,0]],g=[0,0,0];
    for(let i=0;i<N;i++){if(z.tie[i]){g[0]+=Lt[3*i+1];g[1]+=Lt[3*i+2];g[2]++}else if(!halo[i]){const k=zid(i);if(k){mean[k][0]+=Lo[3*i+1];mean[k][1]+=Lo[3*i+2];mean[k][2]++}}}
    const dir=[null,null,null];for(const k of [1,2]){const m=mean[k];if(!m[2]||!g[2])continue;const dx=g[0]/g[2]-m[0]/m[2],dy=g[1]/g[2]-m[1]/m[2],len=Math.hypot(dx,dy);if(len>=12)dir[k]=[m[0]/m[2],m[1]/m[2],dx/len,dy/len]}   // a tie near the cloth's own colour leaves no halo to see
    const tinted=i=>{const d=dir[zid(i)];return !!d&&(Lo[3*i+1]-d[0])*d[2]+(Lo[3*i+2]-d[1])*d[3]>ASM_TINT};
    const need=new Uint8Array(N);for(let i=0;i<N;i++)if(!tieM[i]&&!(V&&V[i])&&!z.watch[i]&&(z.tie[i]||(halo[i]&&!hand(i)&&(zid(i)?tinted(i):true))))need[i]=1;
    // (what the master's wider tie leaves uncovered is shirt, which the tie lies on, even where a lapel is nearer: a shirt pixel counts as SHIRT_PREF nearer)
    const R=px(14),SHIRT_PREF=.25;for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!need[i])continue;const want=zid(i);let j=-1,best=1e9;
      for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx,k=zid(q);
        if(k&&(!want||k===want)&&!need[q]&&!tieM[q]&&!z.watch[q]&&!(V&&V[q])){const d=(dx*dx+dy*dy)*(!want&&k===2?SHIRT_PREF:1);if(d<best){best=d;j=q}}}}
      if(j<0&&z.tie[i])for(let k=1;k<px(48)&&j<0;k++){if(x-k>=0&&!z.tie[i-k]&&!z.watch[i-k])j=i-k;else if(x+k<W&&!z.tie[i+k]&&!z.watch[i+k])j=i+k}   // the master's tie must not stay
      if(j>=0){o[4*i]=src[4*j];o[4*i+1]=src[4*j+1];o[4*i+2]=src[4*j+2];if(z.tie[i]||!lab[i])lab[i]=lab[j]&&lab[j]!==7?lab[j]:6}}
    copy(P.tie.data,tieM,3);
    // The tie's SOFT EDGE. Its photo was made over the master's white shirt, so the outermost pixels of its outline are part tie,
    // part white: laid on as they are they left a pale rim, and rebuilding the join blurred and stepped it. The outline is taken
    // as a shape instead: along it (within 1px), each pixel is the tie's clean colour from just inside, over the outfit's colour
    // from just outside, in the share of the tie's mask around it. (Reading that share from the colours of the tie's photo put
    // white specks on a plaid tie beside a lapel: there is no telling a pale stripe from the white shirt.)
    const T=P.tie.data,clean=asmBox(tieM,W,px(2),false),in1=asmBox(tieM,W,px(1),false),out1=asmBox(tieM,W,px(1),true),pic=new Uint8ClampedArray(o),Q=px(ASM_SOFT+3),cnt=new Uint16Array(N),C2=px(2);
    for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!out1[i]||in1[i])continue;let c=0,n=0;for(let dy=-C2;dy<=C2;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-C2;dx<=C2;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;n++;c+=tieM[yy*W+xx]}}cnt[i]=1+Math.round(1000*c/n)}
    for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!cnt[i]||z.watch[i]||(V&&V[i])||(!tieM[i]&&hand(i)))continue;let ft=-1,fb=1e9,bq=-1,bb=1e9;
      for(let dy=-Q;dy<=Q;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-Q;dx<=Q;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx,d=dx*dx+dy*dy;
        if(clean[q]){if(d<fb){fb=d;ft=q}}else if(!out1[q]&&!z.watch[q]&&!(V&&V[q])&&d<bb){bb=d;bq=q}}}
      if(ft<0||(tieM[i]&&bq<0))continue;const a=(cnt[i]-1)/1000,j=4*i,b=tieM[i]?4*bq:j;
      for(let k=0;k<3;k++)o[j+k]=a*T[4*ft+k]+(1-a)*pic[b+k];
      soft[i]=1}}
  let barM=null;if(P.bar&&!V){barM=asmBarMask(master,z,P.bar,tieM);if(barM)copy(P.bar.data,barM,4)}
  let w=null;if(P.watch){w=asmWatch(master,z,P.watch,P.shirt);copy(w.src,w.mask,5)}
  const seam=asmSeams(o,lab,W,soft);
  if(info)Object.assign(info,{lab,seam,tie:tieM,bar:barM,watch:w&&w.mask,tinted:w?w.tinted:0});
  return new ImageData(o,W,W)}
/* ---- keys, and what an outfit needs ---- */
/* ASM_VEST: which vest master this is. Its photos (the vest master, its calibration photo, each suit's vest piece) carry it in their
   keys, so a remade vest master replaces the old one on every device: version 1 drew a seven-button waistcoat */
const ASM_VEST=3,asmVestTag=(v=ASM_VEST)=>v>1?String(v):'';
const asmKey=t=>'c'+fnv64('asm/'+ASM_VER+'/'+t),asmMasterKey=()=>asmKey('master/jacket'),asmCalibKey=(s,v)=>asmKey('calib/'+s+(s==='vest'?asmVestTag(v):''));
/* the vest master: the master with a waistcoat added. A suit worn with its waistcoat has a second piece ('vest'), an edit of this one */
const asmVestKey=v=>asmKey('master/vest'+asmVestTag(v));
/* zones made outside the app (version 3: SAM 2 on the masters, checked by eye): one black-and-white picture per piece, white = the
   piece, kept on the worker like any photo. When they are there the app reads its zones from them; without them it works the zones
   out from the calibration photos as before. The waistcoat's zone belongs to the vest master and carries its version. */
const ASM_ZONE_SLOTS=['jacket','shirt','tie','watch'],asmZoneKey=s=>asmKey('zone/'+(s==='vest'?'vest'+asmVestTag():s));
const asmZoneImgs=()=>{const o={};for(const s of ASM_ZONE_SLOTS){const r=renders[asmZoneKey(s)];if(!r)return null;o[s]=r.img}return o};
/* the zones from their pictures: white (over half) is the piece; one zone per pixel, the watch over the tie over the shirt over the jacket */
async function asmZonesFromImgs(imgs,W){const z={W},N=W*W;for(const s of ASM_ZONE_SLOTS){const d=(await asmData(imgs[s],W)).data,m=new Uint8Array(N);for(let i=0;i<N;i++)if(d[4*i]>127)m[i]=1;z[s]=m}
  for(let i=0;i<N;i++){if(z.watch[i])z.tie[i]=z.shirt[i]=z.jacket[i]=0;else if(z.tie[i])z.shirt[i]=z.jacket[i]=0;else if(z.shirt[i])z.jacket[i]=0}
  return z}
async function asmMaskFromImg(img,W){const d=(await asmData(img,W)).data,N=W*W,m=new Uint8Array(N);for(let i=0;i<N;i++)if(d[4*i]>127)m[i]=1;return m}
/* the zones' pictures onto the device when no zones are kept: true when all four are there */
const asmGetZones=async()=>(await Promise.all(ASM_ZONE_SLOTS.map(s=>asmGet(asmZoneKey(s))))).every(Boolean);
const ASM_SLOT={jacket:'top',vest:'top',shirt:'shirt',tie:'tie',bar:'clip',watch:'watch'};   // a piece and the outfit slot it dresses
/* how a piece looks, for its key: lookSig, and for a shirt in a woven texture that was never read the weave's name too (lookSig
   counts those by colour alone; here every shirt look gets its own photo) */
const asmLook=(slot,i)=>lookSig(ASM_SLOT[slot],i)+(slot==='shirt'&&texPat('shirt',i.pattern)&&!shirtPatterned(i)&&!shirtTextured(i)?'/weave/'+patBase(i.pattern):'');
const asmPieceKey=(slot,i,v)=>asmKey('piece/'+slot+(slot==='vest'?asmVestTag(v):'')+'/'+asmLook(slot,i));
/* the master's clothes: a dark grey herringbone suit, a white shirt, a burgundy tie, and the owner's watch. The kept master was
   made from the owner's own items and put on the worker by hand; this describes it, for the day one has to be made again */
const asmMasterItem=(type,primaryColor,pattern='solid')=>({id:'asm-'+type,type,primaryColor,pattern});
function asmMasterOutfit(){const watch=items.find(i=>i.type==='watch'&&inRotation(i))||items.find(i=>i.type==='watch');
  return {top:asmMasterItem('suit','midgrey','solid'),shirt:asmMasterItem('shirt','white'),tie:asmMasterItem('tie','green'),watch,suitDay:true}}   // (the kept master's tie is a bright kelly green; the app's list has only a darker green)
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
    if(slot==='shirt'&&asmPaintable(i)){out.push({slot,key:asmPieceKey(slot,i),item:i,paint:colOf(i)});continue}   // painted here: no photo
    out.push(slot==='jacket'&&o.vest?{slot,vest:true,key:asmPieceKey('vest',i),item:i}:{slot,key:asmPieceKey(slot,i),item:i})}   // a vest day: the suit's piece with its waistcoat
  return out}
/* A plain shirt (no pattern, no woven texture) needs no photo: the master's white shirt is painted in its colour (colOf: the tagged
   colour and its shade) on the device, keeping the master's folds and shadows (asmPaint). The owner's choice, 2026-11-12: eleven
   plain colours painted this way looked right, a navy one included, and their colour is the tagged one, where the generator pushed it. */
const asmPaintable=i=>!!i&&i.type==='shirt'&&!shirtPatterned(i)&&!shirtTextured(i)&&!texPat('shirt',i.pattern);
const asmPhotoParts=o=>asmParts(o).filter(p=>!p.paint);   // the parts that need a photo from the worker
/* The master with its shirt painted in hex, the way the owner's chosen recolour was made (shirt-recolor.js, 2026-11-12), with the
   shirt's black calibration photo (asmCalibKey('shirt')): a pixel is shirt where the master is near-grey and the calibration photo much
   darker (soft from 0.12 to 0.37 in cube-root lightness), specks dropped (7x7 majority), its edge softened (5x5); the shading mixes,
   by the colour's lightness, the white shirt's folds (the master, against its 90th-percentile lit cloth, up to 1.15) and the black
   shirt's (the calibration photo, up to 1.6): a light colour keeps the white shirt's shadows, a dark one the black shirt's highlights.
   The first painter (the master's shading alone) gave dark shirts a flat, washed look. asmPaintPrep does the colour-free part once. */
/* full (optional): pixels painted whole whatever the mask says, the shirt beside the master's tie (asmBuild): the mask leaves out the
   master tie's green edge and softens toward it, which kept a share of the master's white there, a pale line beside the tie on a dark
   shirt (very dark navy, 2026-11-12); that join is the tie's to make (its soft edge, the halo fill) */
function asmPaintPrep(master,calib,full){const W=master.width,H=master.height,N=W*H,M=master.data,C=calib.data,L=ASM_LIN;
  const Y=(d,j)=>.2126*L[d[j]]+.7152*L[d[j+1]]+.0722*L[d[j+2]],a=new Float32Array(N);
  for(let k=0;k<N;k++){const j=4*k,chroma=Math.max(M[j],M[j+1],M[j+2])-Math.min(M[j],M[j+1],M[j+2]);if(chroma>=40)continue;
    const drop=Math.cbrt(Y(M,j))-Math.cbrt(Y(C,j));a[k]=drop<=.12?0:drop>=.37?1:(drop-.12)/.25}
  const box=(src,R)=>{const t=new Float32Array(N),o=new Float32Array(N),cl=(v,n)=>v<0?0:v>n-1?n-1:v,n=2*R+1;
    for(let y=0;y<H;y++){let s=0;for(let x=-R;x<=R;x++)s+=src[y*W+cl(x,W)];for(let x=0;x<W;x++){t[y*W+x]=s/n;s+=src[y*W+cl(x+R+1,W)]-src[y*W+cl(x-R,W)]}}
    for(let x=0;x<W;x++){let s=0;for(let y=-R;y<=R;y++)s+=t[cl(y,H)*W+x];for(let y=0;y<H;y++){o[y*W+x]=s/n;s+=t[cl(y+R+1,H)*W+x]-t[cl(y-R,H)*W+x]}}return o};
  const maj=box(a,3);for(let k=0;k<N;k++)if(maj[k]<=.5)a[k]=0;
  const A=box(a,2),idx=[];if(full)for(let k=0;k<N;k++)if(full[k])A[k]=1;for(let k=0;k<N;k++)if(A[k]>0)idx.push(k);
  const lit=(d)=>{const v=[];for(const k of idx)if(A[k]>.9)v.push(Y(d,4*k));v.sort((x,y)=>x-y);return v[Math.floor(v.length*.9)]||1},Rm=lit(M),Rc=lit(C);
  const n=idx.length,P={idx:Int32Array.from(idx),A:new Float32Array(n),sm:new Float32Array(n),sc:new Float32Array(n)};
  for(let q=0;q<n;q++){const k=idx[q],j=4*k;P.A[q]=A[k];P.sm[q]=Math.min(1.15,Y(M,j)/Rm);P.sc[q]=Math.min(1.6,Y(C,j)/Rc)}
  return P}
function asmPaint(master,calib,hex,prep){const P=prep||asmPaintPrep(master,calib),s=master.data,d=new Uint8ClampedArray(s),L=ASM_LIN;
  const h=String(hex).replace('#',''),t=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),w=Math.cbrt(.2126*t[0]+.7152*t[1]+.0722*t[2]);
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  for(let q=0;q<P.idx.length;q++){const j=4*P.idx[q],A=P.A[q],sh=w*P.sm[q]+(1-w)*P.sc[q];
    for(let c=0;c<3;c++)d[j+c]=Math.round(A*gam(t[c]*sh)+(1-A)*s[j+c])}
  return new ImageData(d,master.width,master.height)}
const asmVestKept=async()=>{const r=renders[asmVestKey()],k=r&&await metaGet('asm:vest:'+asmVestKey());return !!(k&&k.t===r.t&&k.v===ASM_ZV)};
/* Did an edit keep the picture? Outside its own piece (and a margin) a photo must still be the master. The generator once answered
   a swap with a collage: the figure moved aside, the reference photos pasted beside it. -> the share of outside pixels that changed */
const ASM_DRIFT=.12;
function asmDrift(master,z,slot,piece,vest){const W=z.W,N=W*W,L0=asmLab(master),L=asmLab(piece),own=asmBox(slot==='bar'?z.tie:z[slot],W,asmPx(slot==='watch'?24:10,W),true),v=vest?asmBox(vest,W,asmPx(10,W),true):null;let n=0,ch=0;
  for(let i=0;i<N;i+=3){if(own[i]||(v&&v[i]))continue;n++;if(asmDE(L,L0,i)>ASM_DE+4)ch++}return n?ch/n:1}
/* ---- putting the picture together off the page. The pixel work takes about a second on a computer and three or four on a phone,
   in blocks of up to two seconds, which on the page froze swipes and scrolling; it runs in a Web Worker (asm-worker.js, which loads
   this file and swaps in its own asmData and asmJpeg), and on the page only where no worker can (no OffscreenCanvas). ---- */
/* everything the pixel work needs, as plain data (photos as data URLs, kept zones packed), or null when something is missing */
async function asmJob(o){if(!asmCan(o))return null;const mk=asmMasterKey(),m=renders[mk];if(!m)return null;
  const parts=asmParts(o);if(parts.some(p=>!p.paint&&(!renders[p.key]||asmBad.has(p.key))))return null;
  const kz=await metaGet('asm:zones:'+mk),job={mk,mt:m.t,master:m.img,zones:kz&&kz.v===ASM_ZV?kz:null,calib:null,vest:null,
    parts:parts.map(p=>p.paint?{slot:p.slot,key:p.key,paint:p.paint}:{slot:p.slot,vest:!!p.vest,key:p.key,img:renders[p.key].img})};
  if(parts.some(p=>p.paint)){const c=renders[asmCalibKey('shirt')];if(!c)return null;job.paintCalib={t:c.t,img:c.img}}   // a painted shirt takes its shading from the black calibration shirt too
  if(!job.zones){job.zoneImg=asmZoneImgs();   // zones made outside the app, when they're here; else the calibration photos
    if(!job.zoneImg){job.calib={};for(const s of ['jacket','shirt','tie','watch']){const r=renders[asmCalibKey(s)];if(!r)return null;job.calib[s]=r.img}}}
  if(o.vest){const vk=asmVestKey(),r=renders[vk];if(!r)return null;const kv=await metaGet('asm:vest:'+vk);
    job.vest={k:vk,t:r.t,kept:kv&&kv.t===r.t&&kv.v===ASM_ZV?kv:null};
    if(!job.vest.kept){const zv=renders[asmZoneKey('vest')];if(zv)job.vest.zoneImg=zv.img;
      else{const c=renders[asmCalibKey('vest')];if(!c)return null;job.vest.img=r.img;job.vest.calib=c.img}}}
  return job}
/* the decoded master and its unpacked zones, kept between pictures in whichever thread builds them */
let asmMem=null;
/* build one picture from a job -> {url} (a JPEG data URL), or {bad: a piece's key} for a piece that didn't keep the picture, or {};
   with zones worked out here, {zones} / {vestZone} to keep (packed) */
async function asmBuild(job){
  if(!asmMem||asmMem.k!==job.mk||asmMem.t!==job.mt)asmMem={k:job.mk,t:job.mt,d:await asmData(job.master)};
  const M=asmMem,master=M.d,W=master.width,out={};
  if(!M.z){if(job.zones&&job.zones.W===W)M.z=asmUnpackZones(job.zones);
    else if(job.zoneImg){if(M.zbad)return out;const z=await asmZonesFromImgs(job.zoneImg,W);if(!asmZonesOk(z)){M.zbad=true;return out}M.z=z;out.zones=asmPackZones(z)}   // made outside the app
    else{if(M.zbad||!job.calib)return out;const zw=Math.min(W,ASM_BASE),m0=zw<W?await asmData(job.master,zw):master,c={};for(const s of ASM_SLOTS)c[s]=await asmData(job.calib[s],zw);
      const z0=asmZones(m0,c);if(!asmZonesOk(z0)){M.zbad=true;return out}M.z=asmUpZones(z0,W);out.zones=asmPackZones(M.z)}}   // worked out at ASM_BASE, enlarged to the picture
  const z=M.z;let V=null;
  if(job.vest){const J=job.vest;
    if(M.v&&M.v.k===J.k&&M.v.t===J.t)V=M.v.m;
    else if(J.kept&&J.kept.W===W){V=asmUnpack(J.kept.m,W*W);M.v={k:J.k,t:J.t,m:V}}
    else if(J.zoneImg){if(M.vbad===J.k+J.t)return out;const m=await asmMaskFromImg(J.zoneImg,W),share=asmCount(m)/(W*W);
      if(share<.005||share>.2){M.vbad=J.k+J.t;return out}V=m;M.v={k:J.k,t:J.t,m};out.vestZone={v:ASM_ZV,W,t:J.t,m:asmPack(m)}}   // made outside the app
    else{if(!J.img||(M.vbad===J.k+J.t))return out;const zw=Math.min(W,ASM_BASE),zs=zw<W?{W:zw,watch:asmDownMask(z.watch,W,zw)}:z;
      const m=asmUpMask(asmVestZone(await asmData(J.img,zw),await asmData(J.calib,zw),zs),zw,W),share=asmCount(m)/(W*W);   // at ASM_BASE too, then enlarged
      if(share<.01||share>.2){M.vbad=J.k+J.t;return out}   // no waistcoat, or half the picture: not believable
      V=m;M.v={k:J.k,t:J.t,m};out.vestZone={v:ASM_ZV,W,t:J.t,m:asmPack(m)}}}
  if(job.paintCalib&&(!M.pp||M.ppt!==job.paintCalib.t)){const nt=asmBox(z.tie,W,asmPx(ASM_HALO+2,W),true);for(let i=0;i<W*W;i++)nt[i]=nt[i]&&z.shirt[i]?1:0;M.pp=asmPaintPrep(master,await asmData(job.paintCalib.img,W),nt);M.ppt=job.paintCalib.t;M.paint={}}
  const P={};for(const p of job.parts){if(p.paint){M.paint=M.paint||{};P[p.slot]=M.paint[p.paint]=M.paint[p.paint]||asmPaint(master,null,p.paint,M.pp);continue}   // nothing outside the shirt changes: no drift to check
    const d=await asmData(p.img,W);if(asmDrift(master,z,p.slot,d,p.vest?V:null)>ASM_DRIFT){out.bad=p.key;return out}P[p.slot]=d}
  if(V)P.vest=V;
  out.url=await asmJpeg(asmCompose(master,z,P));return out}
/* a picture as a JPEG data URL (the worker has its own, on an OffscreenCanvas) */
async function asmJpeg(img){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').putImageData(img,0,0);return c.toDataURL('image/jpeg',.9)}
/* the worker: one picture at a time; the day on screen goes to the front of the line (asmRun(job, true)) */
let asmW=null;
const asmQ=[];
function asmWorker(){if(asmW!==null)return asmW;asmW=false;
  if(typeof Worker==='undefined'||window.ASM_NO_WORKER)return asmW;
  try{const w=new Worker('asm-worker.js'),st={w,ok:null,busy:null};
    w.onmessage=e=>{const d=e.data||{};if('ready' in d){st.ok=!!d.ready;if(!st.ok)asmWorkerDown();else asmPump();return}
      const b=st.busy;st.busy=null;if(b&&b.id===d.id){if(d.error)b.no(new Error(d.error));else b.ok(d.res)}asmPump()};
    w.onerror=e=>{e.preventDefault&&e.preventDefault();asmWorkerDown()};
    asmW=st}catch(e){console.warn('no assembly worker',e)}
  return asmW}
/* the worker can't run (it failed to load, or the browser has no OffscreenCanvas): what is waiting is built on the page */
function asmWorkerDown(){const st=asmW;asmW=false;if(st&&st.w)try{st.w.terminate()}catch{}
  const left=[...(st&&st.busy?[st.busy]:[]),...asmQ.splice(0)];for(const t of left)asmBuild(t.job).then(t.ok,t.no)}
let asmSeq=0;
function asmPump(){const st=asmW;if(!st||!st.ok||st.busy||!asmQ.length)return;const t=asmQ.shift();st.busy=t;st.w.postMessage({id:t.id,job:t.job})}
/* is the picture work off the page (or still finding out)? the build-ahead runs only then */
const asmOffPage=()=>{const st=asmWorker();return !!st&&st.ok!==false};
function asmRun(job,front){const st=asmWorker();if(!st)return asmBuild(job);
  return new Promise((ok,no)=>{const t={id:++asmSeq,job,ok,no};if(front)asmQ.unshift(t);else asmQ.push(t);asmPump()})}
/* the outfit's assembled picture as a JPEG data URL, or null when it can't be made (yet): no master, a piece missing or one that
   came out wrong (asmBad), an outfit of another kind. Zones worked out on the way are kept (meta) */
const asmBad=new Set();
async function asmPhoto(o,front){const job=await asmJob(o);if(!job)return null;const r=await asmRun(job,front);
  if(r.zones)await metaPut('asm:zones:'+job.mk,r.zones);
  if(r.vestZone)await metaPut('asm:vest:'+job.vest.k,r.vestZone);
  if(r.bad){asmBad.add(r.bad);return null}
  return r.url||null}
/* ---- on Today: the assembled picture stands in for the outfit's photo ---- */
/* assembled pictures are kept on the device (meta 'asm:out:<key>', the newest ASM_KEEP), each with the newest date among the photos
   it was made from: a piece made again makes it stale */
let asmOut={};const ASM_KEEP=150,asmBusy=new Set(),asmTried=new Set();   // 150: the next 60 days' looks (about 43 workdays) and the days before
const asmOutKey=o=>asmKey('out/z'+ASM_ZV+'/'+asmParts(o).map(p=>p.key+(p.paint?'='+p.paint:'')).join('+'));   // a painted shirt's colour is in the key: a new shade is a new picture
const asmStamp=o=>[renders[asmMasterKey()],o.vest&&renders[asmVestKey()],...asmPhotoParts(o).map(p=>renders[p.key])].reduce((t,r)=>Math.max(t,r&&r.t||0),0);
const asmWants=o=>ASM_ON&&asmCan(o)&&!!renders[asmMasterKey()]&&(!o.vest||!!renders[asmVestKey()]);   // a vest day needs the vest master too
/* the picture to show for an outfit, like a kept photo's record, or null. A photo made for this very outfit after the master
   (Settings: Regenerate) wins: that was the owner's choice. */
/* a photo made for this outfit after the master (Settings: Regenerate): it is shown, and nothing is put together for the outfit */
const asmFullWins=o=>{const full=renders[comboKey(o)],m=renders[asmMasterKey()];return !!(full&&m&&full.t>m.t)};
function asmFor(o){if(!asmWants(o)||asmFullWins(o))return null;
  const a=asmOut[asmOutKey(o)];return a&&asmFresh(o,a)?{img:a.img,model:'assembled',t:a.t,sig:comboSig(o)}:null}
/* ---- pictures built ahead on a computer (tools/asm-prebuild.js, npm run assemble) ----
   The computer runs this very code on the owner's wardrobe and uploads each look's picture to the worker as an ordinary photo
   record under its look key (render:<asmOutKey>), signed 'asm/out/z<ASM_ZV>/<stamp>': the zone version and the newest date among
   the master and the pieces it was made from (asmStamp). A phone asks for that before it downloads the look's pieces (asmGetPre,
   once a session per look; a look nobody built is a 404 and is made here as before). A picture made from older photos than this
   phone holds (a piece made again since), or with other zones, is not used. */
const ASM_PRE_RE=/^asm\/out\/z(\d+)\/(\d+)$/;
/* is a kept picture still right? Made here: its stamp is the stamp now. Built on the computer: no older than any photo this phone
   holds for the look (the phone may not hold the pieces at all: it never needed them) */
const asmFresh=(o,a)=>a.stamp===asmStamp(o)||(!!a.pre&&a.stamp>=asmStamp(o));
function asmTrim(){const old=Object.keys(asmOut).sort((a,b)=>asmOut[b].t-asmOut[a].t).slice(ASM_KEEP);for(const x of old){delete asmOut[x];txs('meta','readwrite',st=>st.delete('asm:out:'+x))}}
async function asmGetPre(o){const k=asmOutKey(o),W=workerBase();if(!W||asmTried.has('pre:'+k))return false;asmTried.add('pre:'+k);
  try{const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
    const m=j&&j.img&&ASM_PRE_RE.exec(String(j.sig||''));if(!m||+m[1]!==ASM_ZV)return false;
    const rec={img:j.img,stamp:+m[2],t:Date.now(),pre:true};if(!asmFresh(o,rec))return false;
    asmOut[k]=rec;await metaPut('asm:out:'+k,rec);asmTrim();return true}
  catch(e){console.warn('no built picture',e);return false}}
/* for the computer: one look's picture made exactly as a phone makes it -> {key, sig, img}, or null when it can't be (a piece missing,
   one that came out wrong). It downloads what the look needs like asmEnsure, but never takes a picture built earlier */
async function asmPrebuildOne(o){if(!ASM_ON||!asmCan(o))return null;
  if(!await asmGet(asmMasterKey(),true)||!asmWants(o)||(o.vest&&!await asmGet(asmVestKey())))return null;
  if(o.vest&&!await asmVestKept()&&!await asmGet(asmZoneKey('vest')))await asmGet(asmCalibKey('vest'));
  if((await Promise.all(asmPhotoParts(o).map(p=>asmGet(p.key)))).includes(false))return null;
  if(asmParts(o).some(p=>p.paint)&&!await asmGet(asmCalibKey('shirt')))return null;
  if(!await asmZonesKept()&&!await asmGetZones())await Promise.all(['jacket','shirt','tie','watch'].map(s=>asmGet(asmCalibKey(s))));   // the zones' pictures first, the calibration photos only without them
  const img=await asmPhoto(o,true);return img?{key:asmOutKey(o),sig:`asm/out/z${ASM_ZV}/${asmStamp(o)}`,img}:null}
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
/* one download at a time per photo: a second ask while the first is on its way waits for it (it used to answer "missing" at once,
   because the key was already marked as tried: the computer's build, tools/asm-prebuild.js, met Today's own download at start-up) */
const asmGetting=new Map();
function asmGet(key,force){if(renders[key])return Promise.resolve(true);if(asmGetting.has(key))return asmGetting.get(key);
  const p=asmGetOnce(key,force).finally(()=>asmGetting.delete(key));asmGetting.set(key,p);return p}
async function asmGetOnce(key,force){if(renders[key])return true;const W=workerBase(),mk=asmMasterKey();if(!W||asmTried.has(key))return false;
  // a worker with no master yet is not asked again at every start (ASM_NONE_MS), only when Settings looks
  if(key===mk&&!force&&Date.now()-(+localStorage.getItem('asm_none')||0)<ASM_NONE_MS)return false;
  asmTried.add(key);
  try{const r=await fetch(W.url+'?key='+key,{headers:{'x-app-token':W.tok},cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
    if(j&&j.img){await keepRender(key,{sig:j.sig||'',img:j.img/* kept as made (it was shrunk to 900px): the zones are measured at the masters' size */,model:j.model||'',t:j.t||Date.now()},false);if(key===mk)localStorage.removeItem('asm_none');return true}
    if(key===mk&&r.status===404)localStorage.setItem('asm_none',String(Date.now()))}catch(e){console.warn('piece unavailable',e)}
  return false}
const ASM_NONE_MS=6*3600e3;
const asmZonesKept=async()=>{const k=await metaGet('asm:zones:'+asmMasterKey());return !!(k&&k.v===ASM_ZV)};
/* bring what this outfit needs onto the device, put its picture together, keep it and show it */
/* not for an outfit whose own photo wins (asmFullWins): asmFor gives null for it, and taking that as "not made yet" put the picture
   together and redrew Today again and again after a Regenerate, which kept the phone busy and cut off every swipe and scroll */
async function asmEnsure(o,ahead){if(!ASM_ON||!asmCan(o))return;if(!ahead&&renders[asmMasterKey()])asmAheadSoon();if(asmFullWins(o)||asmFor(o))return;const mk=asmMasterKey();if(asmBusy.has(mk+comboKey(o)))return;asmBusy.add(mk+comboKey(o));
  try{if(!await asmGet(mk)||asmFullWins(o)||(o.vest&&!await asmGet(asmVestKey())))return;
    if(await asmGetPre(o)){const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow();return}   // built on the computer: no pieces to download, nothing to compute
    if(o.vest&&!await asmVestKept()&&!await asmGet(asmZoneKey('vest')))await asmGet(asmCalibKey('vest'));
    const parts=asmPhotoParts(o),got=await Promise.all(parts.map(p=>asmGet(p.key)));if(got.includes(false))return;
    if(asmParts(o).some(p=>p.paint)&&!await asmGet(asmCalibKey('shirt')))return;   // the black shirt a painted shirt is shaded from
    if(!await asmZonesKept()&&!await asmGetZones())await Promise.all(['jacket','shirt','tie','watch'].map(s=>asmGet(asmCalibKey(s))));   // the zones' pictures first, the calibration photos only without them
    const img=await asmPhoto(o,!ahead);if(!img)return;
    const k=asmOutKey(o),rec={img,stamp:asmStamp(o),t:Date.now()};asmOut[k]=rec;await metaPut('asm:out:'+k,rec);asmTrim();
    const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow()}
  catch(e){console.warn('could not assemble',e)}finally{asmBusy.delete(mk+comboKey(o))}}
/* the day on screen's picture is ready: Today is redrawn, but not under a finger (a redraw removes what the touch started on and the
   swipe or scroll stops); then it waits for the finger to lift */
let asmTouch=0,asmLate=false;
function asmTouchWatch(){if(asmTouchWatch.on)return;asmTouchWatch.on=true;
  addEventListener('touchstart',e=>{asmTouch=e.touches.length},{passive:true,capture:true});
  const up=e=>{asmTouch=e.touches.length;if(!asmTouch&&asmLate){asmLate=false;setTimeout(()=>{if(!$('#today').hidden)refreshToday()},250)}};
  addEventListener('touchend',up,{passive:true,capture:true});addEventListener('touchcancel',up,{passive:true,capture:true})}
function asmShow(){asmTouchWatch();if(asmTouch){asmLate=true;return}refreshToday()}
/* ---- building ahead: the outfits of the next ASM_AHEAD days are put together in the background, nearest the day on screen first,
   so swiping to a day shows its picture at once instead of the drawing for the seconds the picture takes. Only off the page (the
   worker), one at a time, and only from photos the worker already keeps: nothing is ordered or paid for. It starts a moment after
   Today is drawn (asmAheadSoon, from asmEnsure) and starts over when the day on screen or the plan changes; a built look is skipped. */
const ASM_AHEAD=60;
const ASM_AHEAD_WAIT=1200;
let asmAheadT=0,asmAheadOn=false,asmAheadAgain=false;
function asmAheadSoon(){clearTimeout(asmAheadT);asmAheadT=setTimeout(asmAhead,ASM_AHEAD_WAIT)}
/* the workdays from today to ASM_AHEAD days on, with the day on screen and its neighbours first: [[date, outfit]] (planned a day at a
   time with a pause between, so planning months ahead doesn't hold the page either) */
async function asmAheadDays(){const T=todayDate(),c=+new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),out=[];
  for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
    if(i&&i%10===0)await new Promise(r=>setTimeout(r,0));if(asmAheadAgain)return [];
    const o=planOn(d);if(o&&asmWants(o))out.push([Math.abs(+d-c),o])}
  return out.sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
async function asmAhead(){if(!ASM_ON||!renders[asmMasterKey()]||!asmOffPage()||document.hidden)return;if(asmAheadOn){asmAheadAgain=true;return}asmAheadOn=true;
  try{do{asmAheadAgain=false;const seen=new Set();
      for(const o of await asmAheadDays()){if(asmAheadAgain||document.hidden||!asmOffPage())break;const k=asmOutKey(o);if(seen.has(k))continue;seen.add(k);
        if(asmFullWins(o)||asmFor(o))continue;await asmEnsure(o,true)}}
    while(asmAheadAgain)}
  catch(e){console.warn('building ahead stopped',e)}finally{asmAheadOn=false}}
/* are any of this outfit's pieces being made right now? */
const asmPending=o=>asmWants(o)&&asmPhotoParts(o).some(p=>queuedKeys().includes(p.key)&&!renderStalled(p.key));
/* ---- every photo the wardrobe needs, and making the missing ones ---- */
const ASM_TYPE={suit:'jacket',blazer:'jacket',shirt:'shirt',tie:'tie',tieclip:'bar',watch:'watch'},ASM_COST={master:.46,calib:.13,vestmaster:.44,vestcalib:.13,piece:.14};   // at 2048 (measured 2026-11-12: master and waistcoat master at high 44-46¢, a medium edit about 12-14¢)
function asmNeeds(){const out=[],seen=new Set(),add=(kind,slot,item,k,what)=>{if(!seen.has(k)){seen.add(k);out.push({kind,slot,item,key:k,what})}},inf=asmInfo()||{};
  add('master',null,null,asmMasterKey(),'the master pose');
  for(const sl of ['jacket','shirt','tie','watch'])add('calib',sl,null,asmCalibKey(sl),'finding the '+sl);
  // waistcoats: the vest master, and a second piece for every suit that has one (unless vests are never worn)
  const vests=settings.vestMode==='never'?[]:items.filter(i=>hasVest(i)&&inRotation(i));
  if(vests.length){add('vestmaster',null,null,asmVestKey(),'the pose with a waistcoat');add('vestcalib','vest',null,asmCalibKey('vest'),'finding the waistcoat')}
  for(const i of items){const slot=ASM_TYPE[i.type];if(!slot||!inRotation(i))continue;const sig=asmLook(slot,i);
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt)||(slot==='shirt'&&asmPaintable(i)))continue;add('piece',slot,i,asmPieceKey(slot,i),nm(i));   // a plain shirt is painted: nothing to make
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
async function asmMake(list){const W=workerBase();if(!W)throw new Error('Connect in ⚙ Settings first.');let sent=0;
  for(const n of list){const job=n.kind==='master'?await asmMasterJob():n.kind==='calib'||n.kind==='vestcalib'?asmCalibJob(n.slot):n.kind==='vestmaster'?asmVestMasterJob():await asmPieceJob(n.slot,n.item);if(asmBad.has(n.key))job.replace=true;
    const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify(job)}),j=await r.json().catch(()=>({}));
    if(r.ok&&j.queued){asmBad.delete(n.key);delete renders[n.key];if(n.kind==='master')localStorage.removeItem('asm_none');const q=rqGet();q.keys=[...new Set([...q.keys,n.key])];q.total=(q.total||0)+1;q.sentAt=Date.now();q.at={...(q.at||{}),[n.key]:q.sentAt};q.failed=q.failed||[];rqSet(q);sent++}
    else if(r.ok&&j.exists){asmTried.delete(n.key);await asmGet(n.key)}
    else throw new Error(j.message||j.error||`HTTP ${r.status}`)}
  asmState.missing=asmState.missing.filter(n=>!list.includes(n));if(sent)startQueueWatch();return sent}
const asmCostOf=list=>list.reduce((t,n)=>t+ASM_COST[n.kind],0);
/* Today's Generate for an outfit that can be assembled: make its missing pieces (about 8¢ each) instead of a whole photo */
async function asmQueueOutfit(o){const have=new Set(queuedKeys()),miss=asmPhotoParts(o).filter(p=>(!renders[p.key]||asmBad.has(p.key))&&!have.has(p.key)).map(p=>({kind:'piece',slot:p.slot,item:p.item,key:p.key,what:nm(p.item)}));
  if(miss.length)await asmMake(miss);else await asmEnsure(o);return 'asm'}
/* Settings: Realistic photos, "Item photos" */
function renderAsmUI(){const st=$('#asm-status'),btn=$('#asm-btn'),auto=$('#cfg-asm-auto'),grp=$('#asm-group');if(grp)grp.hidden=!ASM_ON;if(!st||!btn||!ASM_ON)return;if(auto)auto.value=settings.asmAuto===false?'off':'on';
  const money=v=>v<1?Math.round(v*100)+'¢':'$'+v.toFixed(2),queued=new Set(queuedKeys()),m=asmState.missing.filter(n=>!queued.has(n.key)),making=asmNeeds().filter(n=>queued.has(n.key)).length;
  if(!workerBase()){st.textContent='';btn.textContent='Make item photos';needConn(btn);return}needConn(btn);
  if(!asmState.checked){st.textContent='Looking at which photos are already made…';btn.disabled=true;btn.textContent='Make item photos';return}
  const master=m.find(n=>n.kind==='master'),pieces=m.filter(n=>n.kind==='piece').length,have=asmState.total-asmState.missing.filter(n=>n.kind==='piece').length;
  if(master){st.textContent='Outfit pictures can be put together on this device from one photo per item, instead of a new photo for every outfit. It starts with one master photo of the pose (about '+money(ASM_COST.master)+').';btn.disabled=false;btn.textContent='Make the master photo';return}
  if(making&&!m.length){st.textContent=`${making} photo${making===1?' is':'s are'} being made. They appear as they finish; you can close the app.`;btn.disabled=true;btn.textContent='Making…';return}
  if(!m.length){st.textContent=`All ${asmState.total} item photos are here. Outfit pictures are put together on this device at no cost.`;btn.disabled=true;btn.textContent='All item photos made';return}
  st.textContent=`${have} of ${asmState.total} item photos are here. ${m.length} to make, about ${money(asmCostOf(m))}${pieces?` (${money(ASM_COST.piece)} an item)`:''}: ${m.slice(0,4).map(n=>n.what).join(', ')}${m.length>4?` and ${m.length-4} more`:''}.`;
  btn.disabled=false;btn.textContent=`Make ${m.length} photo${m.length===1?'':'s'}`}
async function asmMakeMissing(){const queued=new Set(queuedKeys()),m=asmState.missing.filter(n=>!queued.has(n.key));if(!m.length)return;const master=m.find(n=>n.kind==='master'),list=master?[master]:m;
  if(!await askConfirm(`Make ${list.length} photo${list.length===1?'':'s'}?\n\nAbout $${asmCostOf(list).toFixed(2)}. They are made in the background: once they’re sent you can close the app.`,{ok:'Make'}))return;
  const st=$('#asm-status'),btn=$('#asm-btn');if(btn)btn.disabled=true;if(st)st.textContent='Sending…';
  try{await asmMake(list)}catch(e){if(st){st.textContent='Couldn’t send them: '+(e.message||e);return}}
  renderAsmUI();renderBatchUI()}
function setAsmAuto(v){settings.asmAuto=v!=='off';saveUserSettings()}
/* a new item (or one put back in rotation): make its photo by itself. At most ASM_AUTO at a time: a restore or a changed wardrobe
   that suddenly needs many is left to the button in Settings, with its cost shown. */
let asmAutoTimer=0,ASM_AUTO_MS=4000;const ASM_AUTO=3;
function asmAutoSoon(){if(!ASM_ON)return;clearTimeout(asmAutoTimer);asmAutoTimer=setTimeout(async()=>{if(settings.asmAuto===false||!workerBase())return;
  try{const stt=await asmSync(),queued=new Set(queuedKeys()),m=stt.missing.filter(n=>n.kind==='piece'&&!queued.has(n.key));
    if(!renders[asmMasterKey()]||!m.length||m.length>ASM_AUTO||stt.missing.some(n=>n.kind!=='piece'))return;
    const n=await asmMake(m);if(n)toast(`Making ${n===1?'a photo of '+m[0].what:n+' item photos'} (about ${Math.round(asmCostOf(m)*100)}¢).`,5000)}catch(e){console.warn('automatic item photo failed',e)}},ASM_AUTO_MS)}
/* ---- the worker jobs that make the photos (sent by a later step; each is one POST /render {mode:'queue'}) ---- */
const ASM_CALIB={jacket:'a jacket of exactly the same cut in a solid, flat, bright pure red cloth with no pattern or texture',shirt:'a plain solid black dress shirt',
  tie:'a plain solid bright magenta tie with no pattern',vest:'a waistcoat of exactly the same cut and buttons in a solid, flat, bright pure orange cloth with no pattern or texture',watch:'a wristwatch of the same size with a bright blue case, a bright blue dial and a bright blue rubber strap'};
async function asmMasterJob(){const o=asmMasterOutfit(),{refs,labels}=await outfitRefsFull(o);
  return {mode:'queue',key:asmMasterKey(),image:await figurePng(o),refs,labels,outfit:outfitText(o),sig:asmMasterSig(o),master:true,quality:'high',size:ASM_SZ}}
/* the waistcoat is cut low, to show as much tie as possible (the owner's choice, version 3) */
const asmVestMasterJob=()=>({mode:'queue',key:asmVestKey(),baseKey:asmMasterKey(),refs:[],labels:[],sig:'asm/master/vest',quality:'high',size:ASM_SZ,swap:{what:'waistcoat',add:true,
  text:'a matching waistcoat (vest) in exactly the same cloth as the suit jacket, worn under the jacket and buttoned. It is cut LOW: a deep, narrow V opening whose bottom point is just above the hand that rests on the chest, so the shirt and the tie show all the way down to there, as much of the tie as possible. Below the V the tie runs behind the waistcoat, and the waistcoat fills the opening of the jacket from the V down to the jacket\'s button. Do not move either hand: where a hand lies over the waistcoat, the waistcoat goes under it'}});
const asmCalibJob=s=>({mode:'queue',key:asmCalibKey(s),baseKey:s==='vest'?asmVestKey():asmMasterKey(),swap:{what:s==='vest'?'waistcoat':s,text:ASM_CALIB[s]},refs:[],labels:[],sig:'asm/calib/'+s,size:ASM_SZ});
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
  return {mode:'queue',key:asmPieceKey(slot,i),baseKey:slot==='vest'?asmVestKey():asmMasterKey(),swap:{what:slot==='bar'?'tie bar':slot==='vest'?'jacket':slot,text:prettyCols(text),...(slot==='bar'?{add:true}:{})},refs,labels,sig:'asm/piece/'+slot+'/'+asmLook(slot,i),size:ASM_SZ}}
