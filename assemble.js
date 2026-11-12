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
  if(P.shirt){copy(P.shirt.data,z.shirt,2);
    // the shirt's own edge, like the jacket's: its zone stops a pixel or two short of the collar's edge against the neck, and the
    // master's white left there was a thin white line along a coloured collar. The ASM_EDGE pixels just outside the zone that no
    // piece has taken come from the shirt's photo too (elsewhere it is the master there: the skin, the wall)
    // (not beside the tie, whose edge and halo fill decide those pixels: there it put a hard step of light shirt above the knot)
    const ring=asmBox(z.shirt,W,px(ASM_EDGE),true),byTie=asmBox(z.tie,W,px(ASM_HALO+ASM_EDGE),true),sd=P.shirt.data;
    for(let i=0;i<N;i++)if(ring[i]&&!byTie[i]&&!lab[i]&&!z.shirt[i]&&!z.tie[i]&&!z.watch[i]&&!(V0&&V0[i])){const j=4*i;o[j]=sd[j];o[j+1]=sd[j+1];o[j+2]=sd[j+2];lab[i]=2}}
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
      // the tie's colour there: the mean of its clean pixels a little beyond the nearest (the nearest alone, copied outward, drew a
      // white figure near the edge out as a comb of short bars over the knot, 2026-11-12 at 2048)
      const rr=Math.sqrt(fb)+px(1),r2=rr*rr,RR=Math.ceil(rr),tc=[0,0,0];let tn=0;
      for(let dy=-RR;dy<=RR;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-RR;dx<=RR;dx++){const xx=x+dx;if(xx<0||xx>=W||dx*dx+dy*dy>r2)continue;const q=yy*W+xx;if(clean[q]){tc[0]+=T[4*q];tc[1]+=T[4*q+1];tc[2]+=T[4*q+2];tn++}}}
      for(let k=0;k<3;k++)o[j+k]=a*(tc[k]/tn)+(1-a)*pic[b+k];
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
    if(slot==='shirt'&&asmPaintable(i)){out.push({slot,key:asmPieceKey(slot,i),item:i,paint:colOf(i),wk:asmWeaveSig(i)});continue}   // painted here (its weave laid over): no photo
    if(slot==='tie'){out.push({slot,key:asmPieceKey(slot,i),item:i,tp:asmTieSig(i)});continue}   // a tie is painted here too (asmTiePaint): no photo
    if(slot==='jacket'&&asmSuitPaintable(i)){out.push({slot,vest:!!o.vest,key:asmPieceKey(o.vest?'vest':'jacket',i),item:i,sp:asmSuitSig(i)});continue}   // a solid suit or blazer is painted too (asmSuitPaint)
    out.push(slot==='jacket'&&o.vest?{slot,vest:true,key:asmPieceKey('vest',i),item:i}:{slot,key:asmPieceKey(slot,i),item:i})}   // a vest day: the suit's piece with its waistcoat
  return out}
/* A plain shirt (no pattern, no woven texture) needs no photo: the master's white shirt is painted in its colour (colOf: the tagged
   colour and its shade) on the device, keeping the master's folds and shadows (asmPaint). The owner's choice, 2026-11-12: eleven
   plain colours painted this way looked right, a navy one included, and their colour is the tagged one, where the generator pushed it. */
/* (since the woven shirts below) every shirt that is not striped, checked or figured is painted */
const asmPaintable=i=>!!i&&i.type==='shirt'&&(!shirtPatterned(i)||asmMotif(i));
/* a figured shirt (a small figure on a grid, read from its close-up: the owner's grey chevron dobby, his lavender micro-print neat) is
   painted too, in colour: one repeat of the app's own drawing of the reading (two cells each way), each pixel as its colour over the
   reading's ground, so the ground becomes the tagged colour and the figures keep their contrast to it (a dim close-up read the white
   chevron shirt's ground as #c9c9d4). The cell's size from the close-up (ASM_CLOSEUP_MM / cells seen in it), never finer than
   ASM_TEX_MIN_MM: Claude's count across the shirt is the server's cap (80) for both. Stripes and checks are still photographed. */
const asmMotif=i=>{const s=usableSett(i);return !!(s&&s.motif&&s.motif.figs&&s.motif.figs.length&&s.cr>0)};
/* Woven shirts are painted too, their weave laid over the colour (the owner's choice, 2026-11-12, from renders of his own shirts on
   the 2048 master): one repeat of the weave as the app draws it (fabricDef, from the saved reading), as a lightness ratio, multiplied
   into the painted shirt, upright on the front and along the arm on each cuff, with the swing the app gives that cloth (texTones' rule).
   asmWeave(i) -> null (plain), {f:'fleck'} or {f:'tile', mm, hb}:
   - herringbone: the size from Claude's count across the shirt (ASM_SHIRT_MM / sett.tr); a count at the server's cap (80) or none
     gives 12 mm (ASM_HB_TR 45: the owner's pink herringbone as he chose it)
   - a figured weave read from its close-up (dobby diamonds, basket, twill…): the repeat measured in the close-up (asmTexMm), never
     finer than ASM_TEX_MIN_MM: Claude's counts are capped (60 a close-up, 80 a shirt), and his white diamond's uncapped 65 was 3x too big
   - end-on-end, and a weave never read: plain with a faint thread-sized fleck (enlarged, end-on-end's one-thread reading became a
     pinstripe or a check) */
const ASM_TEXV=1;   // how weaves are drawn: in the picture's key, so a change makes the pictures again
const ASM_SHIRT_MM=550;   // what Claude's "repeats across the item" spans on a shirt
const ASM_TR_CAP=80;   // worker.js cleanPattern's cap on repeatsAcrossItem
const ASM_HB_TR=45;   // a herringbone without a real count: 12 mm
const ASM_CLOSEUP_MM=80;   // the width of cloth a phone close-up shows
const ASM_TEX_MIN_MM=2.9;   // a figured weave is never drawn finer (about 9 px at 2048)
const ASM_PX_MM=3.2;   // the 2048 master: about 32 px a centimetre (shoulder seams ~1460 px apart, ~46 cm; the tie ~6.7 cm mid-chest)
const ASM_FLECK_DL=2.5;   // the fleck's swing (L*): the least the app draws
const ASM_FLECK=96;   // the fleck tile, master pixels at 2048
function asmWeave(i){if(i&&i.type==='shirt'&&asmMotif(i)){const s=usableSett(i);return {f:'col',mm:2*Math.max(ASM_TEX_MIN_MM,ASM_CLOSEUP_MM/s.cr),rot:(+s.a||0)*Math.PI/180}}   // mm: the drawing's tile, two cells
  if(!i||!texPat('shirt',i.pattern))return null;const p=patBase(i.pattern),s=usableSett(i),t=s&&s.tex,k=t?t.kind:p;
  if(k==='herringbone'||(!t&&p==='herringbone')){const tr=+(s&&s.tr)||0;return {f:'tile',hb:true,mm:ASM_SHIRT_MM/(tr>0&&tr<ASM_TR_CAP?tr:ASM_HB_TR)}}
  if(!t||k==='end-on-end')return {f:'fleck'};
  return {f:'tile',mm:0}}
/* what decides how the weave looks (its reading, its count, its close-up), short, for the picture's key: '' for a plain shirt */
const asmWeaveSig=i=>{const w=asmWeave(i);if(!w)return '';const s=usableSett(i),c=i.texture||'';
  return fnv64(['w'+ASM_TEXV,w.f,w.hb?w.mm.toFixed(2):'',settSig(s),c.length+c.slice(-40)].join('|')).slice(0,10)};
/* one repeat of the weave as the app draws it (fabricDef), as each pixel's light over the tile's mean -> {r, TW, TH, ar (height/width)} */
const asmTexMemo=new Map();
async function asmTexTile(i,wk){if(asmTexMemo.has(wk))return asmTexMemo.get(wk);
  const def=fabricDef('asmtx',i,'shirt'),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');if(!w||!h)return null;
  const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TW}" height="${TH}" viewBox="0 0 ${w} ${h}"><defs>${def}</defs><rect width="${w}" height="${h}" fill="url(#asmtx)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),c=document.createElement('canvas');c.width=TW;c.height=TH;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,TW,TH);const d=x.getImageData(0,0,TW,TH).data,r=new Float32Array(TW*TH);let s=0;
  for(let k=0;k<r.length;k++){const j=4*k;r[k]=.2126*L[d[j]]+.7152*L[d[j+1]]+.0722*L[d[j+2]];s+=r[k]}s/=r.length;if(!(s>0))return null;for(let k=0;k<r.length;k++)r[k]/=s;
  const t={r,TW,TH,ar:h/w};if(asmTexMemo.size>40)asmTexMemo.clear();asmTexMemo.set(wk,t);return t}
/* a figured shirt's repeat in colour: each pixel's linear colour over the reading's ground, per channel -> {c (3 a pixel), TW, TH, ar}.
   The drawing's own turn (a diagonal grid) is left out and applied when painting, so the tile repeats */
async function asmColTile(i,wk){const mk='c'+wk;if(asmTexMemo.has(mk))return asmTexMemo.get(mk);const s=usableSett(i),g=s&&s.motif&&s.motif.ground;if(!g)return null;
  const def=fabricDef('asmtx',i,'shirt').replace(/ patternTransform="[^"]*"/,''),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');if(!w||!h)return null;
  const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TW}" height="${TH}" viewBox="0 0 ${w} ${h}"><defs>${def}</defs><rect width="${w}" height="${h}" fill="url(#asmtx)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=TW;cv.height=TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,TW,TH);const d=x.getImageData(0,0,TW,TH).data,G=hexRgb(g).map(v=>Math.max(.004,L[v])),c=new Float32Array(3*TW*TH);
  for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)c[3*k+q]=Math.min(8,L[d[4*k+q]]/G[q]);
  const t={c,TW,TH,ar:h/w};if(asmTexMemo.size>40)asmTexMemo.clear();asmTexMemo.set(mk,t);return t}
/* the weave's repeat across a close-up, in its pixels: the first correlation peak (shifted sideways) whose double comes back too (a
   true repeat does; grain and noise don't), after a 3x3 blur (noise) less a 49x49 one (light falloff, folds) -> px, or 0 */
function asmRepeatPx(d){const w=d.width,h=d.height,p=d.data,L=new Float32Array(w*h);for(let k=0;k<w*h;k++)L[k]=.3*p[4*k]+.59*p[4*k+1]+.11*p[4*k+2];
  const blur=(S,R)=>{const t=new Float32Array(w*h),o=new Float32Array(w*h),cl=(v,n)=>v<0?0:v>n-1?n-1:v,n=2*R+1;
    for(let y=0;y<h;y++){let s=0;for(let q=-R;q<=R;q++)s+=S[y*w+cl(q,w)];for(let q=0;q<w;q++){t[y*w+q]=s/n;s+=S[y*w+cl(q+R+1,w)]-S[y*w+cl(q-R,w)]}}
    for(let q=0;q<w;q++){let s=0;for(let y=-R;y<=R;y++)s+=t[cl(y,h)*w+q];for(let y=0;y<h;y++){o[y*w+q]=s/n;s+=t[cl(y+R+1,h)*w+q]-t[cl(y-R,h)*w+q]}}return o};
  const a1=blur(L,1),a2=blur(L,24),hp=new Float32Array(w*h);for(let k=0;k<w*h;k++)hp[k]=a1[k]-a2[k];
  const M=Math.min(110,(w>>1)-31),ac=dx=>{let s=0,n=0;for(let y=30;y<h-30;y+=2)for(let q=30;q<w-30-dx;q+=2){s+=hp[y*w+q]*hp[y*w+q+dx];n++}return n?s/n:0};
  if(M<8)return 0;const a0=ac(0);if(!(a0>0))return 0;const c=[0];for(let dx=1;dx<=M;dx++)c.push(ac(dx)/a0);
  let best=0,bs=-1;for(let k=3;k<M;k++)if(c[k]>c[k-1]&&c[k]>=c[k+1]&&c[k]>.04){const k2=2*k,c2=k2+1<=M?Math.max(c[k2-1],c[k2],c[k2+1]):0,sc=c[k]+.5*c2;if(sc>bs){bs=sc;best=k}}
  return best}
/* a figured weave's repeat in mm, measured in its close-up (ASM_CLOSEUP_MM across), never finer than ASM_TEX_MIN_MM */
const asmMmMemo=new Map();
async function asmTexMm(i){const c=i.texture||'',k=i.id+'|'+c.length+c.slice(-40);if(asmMmMemo.has(k))return asmMmMemo.get(k);let mm=0;
  if(c)try{const d=await asmData(c),n=asmRepeatPx(d);if(n)mm=ASM_CLOSEUP_MM*n/d.width}catch{}
  mm=Math.max(ASM_TEX_MIN_MM,mm);asmMmMemo.set(k,mm);return mm}
/* what the pixel work needs to lay a shirt's weave (page side): the tile, its size in mm and its swing, or {fleck} */
async function asmTexFor(i,hex,wk){const w=asmWeave(i);if(!w)return null;if(w.f==='fleck')return {fleck:true,dL:ASM_FLECK_DL};
  if(w.f==='col'){const t=await asmColTile(i,wk);return t?{col:true,c:t.c,TW:t.TW,TH:t.TH,ar:t.ar,mm:w.mm,rot:w.rot}:null}
  const t=await asmTexTile(i,wk);if(!t)return {fleck:true,dL:ASM_FLECK_DL};const s=usableSett(i),rel=(s&&s.tex&&s.tex.rel)||.1,L0=rgbLab(...hexRgb(hex))[0];
  return {r:t.r,TW:t.TW,TH:t.TH,ar:t.ar,mm:w.hb?w.mm:await asmTexMm(i),dL:Math.max(2.5,Math.min(7,.4*rel*Math.max(L0,25)))}}
/* (either thread) the tile scaled to its swing on that colour (its 5th to 95th percentile spread = dL in L*, around 1) and to the
   picture (px a repeat): {r, TW, TH, rx, ry}. A fleck: one-pixel columns (warp threads) in short runs of random light, the same on
   every device */
function asmTexReady(T,hex,W){if(!T)return null;let r,TW,TH,rx,ry;
  if(T.col){rx=T.mm*ASM_PX_MM*W/ASM_SIZE;return {col:true,c:T.c,TW:T.TW,TH:T.TH,rx,ry:rx*T.ar,rot:T.rot||0}}   // a figured shirt: its colours as drawn
  if(T.fleck){TW=TH=ASM_FLECK;r=new Float32Array(TW*TH);let seed=7;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296};
    for(let x=0;x<TW;x++){const col=(rnd()-.5)*.6;let y=0;while(y<TH){const len=2+Math.floor(rnd()*4),v=col+(rnd()-.5);for(let k=0;k<len&&y<TH;k++,y++)r[y*TW+x]=v}}
    rx=ry=ASM_FLECK*W/ASM_SIZE}
  else{TW=T.TW;TH=T.TH;r=Float32Array.from(T.r);rx=T.mm*ASM_PX_MM*W/ASM_SIZE;ry=rx*T.ar}
  const h=String(hex).replace('#',''),Y0=[0,2,4].reduce((s,k,c)=>s+[.2126,.7152,.0722][c]*ASM_LIN[parseInt(h.slice(k,k+2),16)||0],0),f=Y0>.008856?Math.cbrt(Y0):7.787*Y0+16/116,L0=116*f-16;
  const Yl=L=>{const g=(L+16)/116;return g>6/29?g*g*g:3*(6/29)**2*(g-4/29)},want=(Yl(Math.min(100,L0+T.dL/2))-Yl(Math.max(0,L0-T.dL/2)))/Math.max(1e-4,Yl(L0));
  const srt=Float32Array.from(r).sort(),sp=srt[Math.floor(srt.length*.95)]-srt[Math.floor(srt.length*.05)];let m=0;for(const v of r)m+=v;m/=r.length;
  const g=sp>0?want/sp:0;for(let k=0;k<r.length;k++)r[k]=1+(r[k]-m)*g;return {r,TW,TH,rx,ry}}
const asmPhotoParts=o=>asmParts(o).filter(p=>!p.paint&&!p.tp&&!p.sp);   // the parts that need a photo from the worker
/* ---- solid suits and blazers are painted on the master too (the owner's choice, 2026-11-12, from a prototype of his brown and very
   dark navy suits, with and without the waistcoat): the master's jacket zone (on a waistcoat day: the waistcoat master's, and the
   waistcoat zone with it) in the suit's tagged colour (colOf), shaded by the master's plain grey suit and the red jacket calibration
   photo (the orange waistcoat calibration for the waistcoat), each pixel's lightness over its lit cloth (75th percentile), averaged; the
   master suit's own fine grain comes through as a natural cloth texture. The suit's soft grey edge just outside the zone (near-grey,
   within 22 L* of the master suit's median, not skin) is painted from the master's lightness alone, so no grey outline is left. The
   painted picture is the suit's piece (as a photo of the suit with its waistcoat would be), so asmCompose's jacket edge handling
   applies. Patterned suits (pinstripe, windowpane, twill, herringbone…) are still photographed. */
const ASM_SUITV=2;   // how suits are painted: in the picture's key
const asmSuitPaintable=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&((patBase(i.pattern)==='solid'&&!usableSett(i))||asmSuitBands(i));
const asmSuitSig=i=>fnv64(['s'+ASM_SUITV,colOf(i),asmSuitBands(i)?settSig(usableSett(i))+'|'+(asmLinen(i)?'linen':'')+'|'+(i.patternSpec?JSON.stringify([i.patternSpec.across,i.patternSpec.along]):''):''].join('|')).slice(0,10);
/* ---- patterned jackets (a windowpane, a check, a stripe read in bands: the owner's khaki windowpane blazer, 2026-11-12) are painted
   too, from the reading: one repeat of the app's own drawing (fabricDef) in the reading's colours, sized by its repeats across the
   jacket (ASM_SHIRT_MM / sett.tr at ASM_PX_MM), upright on the body and along the arm on each sleeve (the sleeve zone pictures, made
   with SAM like the others), each pixel's colour times the suit's shading. Lines are painted bold: no line narrower than ASM_LINE_PX
   at 2048 (widened into the ground beside it), and lines crossing the other way at full strength (fabricDef draws them at half, for a
   swatch); a 2% line on a 5 cm pane was 3 px and read faint. A linen jacket (material, or Claude's description of the cloth) gets a
   linen texture in its shading: threads two pixels wide, each a little lighter or darker, plain-woven, with slubs. */
// windowpanes and checks only: the owner's navy pinstripe suit, painted, came out bright royal blue with crisp white stripes where
// his close-up is a muted navy twill with soft stripes (Claude's colours and the bold-line rule both suit a windowpane, not that)
const asmSuitBands=i=>{const s=usableSett(i);return !!(s&&s.v===2&&s.bands&&s.bands.length>1&&s.tr>0&&CHECK_PATS.includes(patBase(i.pattern)))};
const asmLinen=i=>!!i&&(/linen/i.test(i.material||'')||/linen/i.test((i.patternSpec&&i.patternSpec.description)||i.patternText||''));
const ASM_LINE_PX=4;   // the narrowest painted line at 2048
const ASM_SLEEVES=['sleeveR','sleeveL'];
const asmSleeveImgs=()=>{const o={};for(const s of ASM_SLEEVES){const r=renders[asmZoneKey(s)];if(!r)return null;o[s]=r.img}return o};
/* (page side) the jacket's drawing, lines widened to ASM_LINE_PX at its painted size -> {c, TW, TH, mm (one repeat across), linen} */
const asmSuitTexMemo=new Map();
async function asmSuitTex(i){const k=asmSuitSig(i);if(asmSuitTexMemo.has(k))return asmSuitTexMemo.get(k);const s=usableSett(i),mm=ASM_SHIRT_MM/s.tr,px=mm*ASM_PX_MM;
  const bold=bands=>{if(!bands)return bands;const g=bands.reduce((a,b)=>b[1]>a[1]?b:a)[0],min=ASM_LINE_PX/px,out=bands.map(b=>[b[0],b[1]]);let need=0;
      for(const b of out)if(b[0]&&b[0]!==g&&b[1]<min){need+=min-b[1];b[1]=min}
      const gw=out.filter(b=>!b[0]||b[0]===g).reduce((a,b)=>a+b[1],0);if(gw>need)for(const b of out)if(!b[0]||b[0]===g)b[1]*=1-need/gw;return out};
  // Claude's own colours, band by band, where the reading has them (the owner's choice, 2026-11-12): measured from the pixels, a thin
  // line is blurred into the ground and reads weak (his windowpane's off-white #e6ddcf for Claude's #eeeadf, its blue #a1bbd3 for #8eb2d6)
  const sp=i.patternSpec,cl=(bands,spec,cross)=>spec&&spec.bands&&spec.bands.length===bands.length?bands.map((b,k)=>[cross&&!b[0]?null:spec.bands[k].hex,b[1]]):bands;
  const sb=cl(s.bands,sp&&sp.across,false),sc=s.cross?cl(s.cross.bands,sp&&sp.along,true):null;
  const it={...i,sett:{...s,bands:bold(sb),cross:s.cross?{...s.cross,bands:bold(sc)}:null}};
  const def=fabricDef('asmsuit',it,'blazer').replace(/ patternTransform="[^"]*"/,'').replace(/ opacity="\.5"/g,''),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');
  if(!w||!h)return null;const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#asmsuit)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,c=new Float32Array(3*TW*TH);
  for(let q=0;q<TW*TH;q++)for(let j=0;j<3;j++)c[3*q+j]=L[d[4*q+j]];
  const r={c,TW,TH,mm,linen:asmLinen(i)};if(asmSuitTexMemo.size>20)asmSuitTexMemo.clear();asmSuitTexMemo.set(k,r);return r}
/* a linen texture, 256 px square, the same on every device: each light factor around 1 (threads two pixels wide, each a little
   lighter or darker, plain-woven warp over weft in turn, with slubs: a run of thicker, lighter thread every so often) */
let asmLinenMemo=null;
function asmLinenTile(){if(asmLinenMemo)return asmLinenMemo;const T=256,n=T/2,r=new Float32Array(T*T);let seed=11;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296};
  const warp=[],weft=[];for(let k=0;k<n;k++){warp.push((rnd()-.5)*.9);weft.push((rnd()-.5)*.9)}
  const slubW=new Float32Array(T*n),slubF=new Float32Array(T*n);for(let k=0;k<n;k++)for(let t=0;t<2;t++){const at=Math.floor(rnd()*T),len=8+Math.floor(rnd()*26),v=.9+rnd()*.8;
    for(let s=0;s<len;s++){slubW[k*T+(at+s)%T]=v;slubF[k*T+(at+s)%T]=v*(rnd()<.5?1:.6)}}
  for(let y=0;y<T;y++)for(let x=0;x<T;x++){const cx=x>>1,cy=y>>1,up=(cx+cy)%2===0;r[y*T+x]=up?warp[cx]+slubW[cx*T+y]:weft[cy]+slubF[cy*T+x]}
  let m=0,v=0;for(const a of r)m+=a;m/=r.length;for(const a of r)v+=(a-m)*(a-m);const sd=Math.sqrt(v/r.length)||1;for(let k=0;k<r.length;k++)r[k]=1+(r[k]-m)/sd*.055;   // about 5% of the light
  return asmLinenMemo={r,T}}
/* each sleeve's direction: on a 16 px grid, the second moments of the sleeve within 96 px give its local axis; the axes are split in two
   (upper arm and forearm) when they differ by over 25°; each group's pixels take its mean axis around its own centre -> {seg (0 = the
   body, upright), segs:[{cs, sn, cx, cy}]} for the base picture */
function asmSleeveSegs(masks,W,N){const seg=new Uint8Array(N),segs=[{cs:1,sn:0,cx:0,cy:0}],f=Math.max(1,Math.round(W/512)),S=Math.ceil(W/f),G=Math.max(2,Math.round(16/f)),R=Math.round(96/f),GC=Math.ceil(S/G);   // worked out on a copy f times smaller
  for(const mf of masks){const m=new Uint8Array(S*S);for(let y=0;y<S;y++)for(let x=0;x<S;x++)m[y*S+x]=mf[Math.min(W-1,y*f)*W+Math.min(W-1,x*f)];
    const I=[0,1,2,3,4,5].map(()=>new Float64Array((S+1)*(S+1)));   // integral images: n, x, y, xx, yy, xy
    for(let y=0;y<S;y++){const rs=[0,0,0,0,0,0];for(let x=0;x<S;x++){const v=m[y*S+x]?1:0;rs[0]+=v;rs[1]+=v*x;rs[2]+=v*y;rs[3]+=v*x*x;rs[4]+=v*y*y;rs[5]+=v*x*y;
        for(let q=0;q<6;q++)I[q][(y+1)*(S+1)+x+1]=I[q][y*(S+1)+x+1]+rs[q]}}
    const box=(q,x0,y0,x1,y1)=>I[q][y1*(S+1)+x1]-I[q][y0*(S+1)+x1]-I[q][y1*(S+1)+x0]+I[q][y0*(S+1)+x0];
    const pts=[];for(let y=G>>1;y<S;y+=G)for(let x=G>>1;x<S;x+=G){if(!m[y*S+x])continue;const x0=Math.max(0,x-R),y0=Math.max(0,y-R),x1=Math.min(S,x+R),y1=Math.min(S,y+R),n=box(0,x0,y0,x1,y1);if(n<20)continue;
      const mx=box(1,x0,y0,x1,y1)/n,my=box(2,x0,y0,x1,y1)/n,cxx=box(3,x0,y0,x1,y1)/n-mx*mx,cyy=box(4,x0,y0,x1,y1)/n-my*my,cxy=box(5,x0,y0,x1,y1)/n-mx*my,th=.5*Math.atan2(2*cxy,cxx-cyy);
      pts.push({x,y,c:Math.cos(2*th),s:Math.sin(2*th)})}
    if(!pts.length)continue;
    // two groups by the doubled angle (k-means, started from the two most different axes)
    const away=from=>pts.reduce((s,p)=>(p.c*from.c+p.s*from.s)<(s.c*from.c+s.s*from.s)?p:s,pts[0]),b=away(pts[0]),a=away(b);
    let A={c:a.c,s:a.s},B={c:b.c,s:b.s},grp=new Uint8Array(pts.length);
    for(let it=0;it<8;it++){const sum=[[0,0,0],[0,0,0]];pts.forEach((p,k)=>{grp[k]=(p.c*B.c+p.s*B.s)>(p.c*A.c+p.s*A.s)?1:0;const t=sum[grp[k]];t[0]+=p.c;t[1]+=p.s;t[2]++});
      for(const [g,t] of [[A,sum[0]],[B,sum[1]]])if(t[2]){const l=Math.hypot(t[0],t[1])||1;g.c=t[0]/l;g.s=t[1]/l}}
    const ang=g=>.5*Math.atan2(g.s,g.c),split=Math.abs(Math.atan2(Math.sin(2*(ang(A)-ang(B))),Math.cos(2*(ang(A)-ang(B)))))/2>25*Math.PI/180;
    if(!split)grp.fill(0);const groups=split?[A,B]:[{c:(A.c+B.c),s:(A.s+B.s)}];
    const cell=new Int16Array(GC*GC).fill(-1);pts.forEach((p,k)=>{cell[Math.floor(p.y/G)*GC+Math.floor(p.x/G)]=grp[k]});
    const base=segs.length,cent=groups.map(()=>[0,0,0]),cg=new Int16Array(GC*GC).fill(-1);   // each grid cell's group, gaps filled from the nearest
    for(let gy=0;gy<GC;gy++)for(let gx=0;gx<GC;gx++){let g=cell[gy*GC+gx];for(let r2=1;g<0&&r2<6;r2++)for(let dy=-r2;dy<=r2&&g<0;dy++)for(let dx=-r2;dx<=r2&&g<0;dx++){const xx=gx+dx,yy=gy+dy;if(xx>=0&&yy>=0&&xx<GC&&yy<GC)g=cell[yy*GC+xx]}cg[gy*GC+gx]=g<0?0:g}
    // one upper arm and one forearm: the groups smoothed (majority within 2 cells, 4 times), then every island but each group's
    // largest joins the group around it (cell by cell the axes were mixed, and the panes broke into blocks and crosses)
    if(split){const inside=new Uint8Array(GC*GC);for(let k=0;k<GC*GC;k++)inside[k]=cell[k]>=0?1:0;
      // first by position: a cell joins the part whose arm line (through the part's centre, along its axis) is nearer; the strip along
      // a forearm's underside read the upper arm's direction and stayed with it
      const ctr=[[0,0,0],[0,0,0]];for(let k=0;k<GC*GC;k++)if(inside[k]){const t=ctr[cg[k]];t[0]+=k%GC;t[1]+=Math.floor(k/GC);t[2]++}
      if(ctr[0][2]&&ctr[1][2]){const lines=[A,B].map((g,k)=>{const th=ang(g);return {x:ctr[k][0]/ctr[k][2],y:ctr[k][1]/ctr[k][2],c:Math.cos(th),s:Math.sin(th)}});
        for(let k=0;k<GC*GC;k++){if(!inside[k])continue;const x=k%GC,y=Math.floor(k/GC),d=lines.map(l=>Math.abs(-(x-l.x)*l.s+(y-l.y)*l.c));cg[k]=d[1]<d[0]?1:0}}
      for(let pass=0;pass<4;pass++){const nx=cg.slice();for(let gy=0;gy<GC;gy++)for(let gx=0;gx<GC;gx++){if(!inside[gy*GC+gx])continue;let a1=0,n1=0;
          for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=gx+dx,yy=gy+dy;if(xx<0||yy<0||xx>=GC||yy>=GC||!inside[yy*GC+xx])continue;n1++;a1+=cg[yy*GC+xx]}
          nx[gy*GC+gx]=a1*2>n1?1:0}cg.set(nx)}
      const comp=new Int32Array(GC*GC).fill(-1),size=[],grpOf=[];
      for(let s0=0;s0<GC*GC;s0++){if(!inside[s0]||comp[s0]>=0)continue;const id=size.length,st=[s0];comp[s0]=id;let n2=0;
        while(st.length){const c=st.pop();n2++;const cx=c%GC,cy=(c-cx)/GC;for(const [xx,yy] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]){if(xx<0||yy<0||xx>=GC||yy>=GC)continue;const d2=yy*GC+xx;if(inside[d2]&&comp[d2]<0&&cg[d2]===cg[s0]){comp[d2]=id;st.push(d2)}}}
        size.push(n2);grpOf.push(cg[s0])}
      const big=[0,1].map(g=>size.reduce((b,s2,k)=>grpOf[k]===g&&(b<0||s2>size[b])?k:b,-1));
      for(let k=0;k<GC*GC;k++)if(inside[k]&&comp[k]>=0&&!big.includes(comp[k]))cg[k]=1-cg[k]}
    for(let k=0;k<N;k++){if(!mf[k])continue;const x=k%W,y=(k-x)/W,g=cg[Math.min(GC-1,Math.floor(y/f/G))*GC+Math.min(GC-1,Math.floor(x/f/G))];seg[k]=base+g;const c=cent[g];c[0]+=x;c[1]+=y;c[2]++}
    groups.forEach((g,k)=>{const th=ang(g)-Math.PI/2,c=cent[k];segs.push({cs:Math.cos(th),sn:Math.sin(th),cx:c[2]?c[0]/c[2]:0,cy:c[2]?c[1]/c[2]:0})})}
  return {seg,segs}}
/* the colour-free part, once per base picture and calibration: the pixels to paint and their shading. base: the master, or the
   waistcoat master on a waistcoat day; zj: the jacket zone; zv, cv (waistcoat days): the waistcoat zone and its calibration photo */
function asmSuitPrep(base,cj,zj,zv,cv,sleeves){const P=asmSuitPrep0(base,cj,zj,zv,cv);if(sleeves&&sleeves.length){const s=asmSleeveSegs(sleeves,base.width,base.width*base.height);P.seg=s.seg;P.segs=s.segs}return P}
function asmSuitPrep0(base,cj,zj,zv,cv){const W=base.width,N=W*base.height,L=ASM_LIN,B=base.data,Y=(d,j)=>.2126*L[d[j]]+.7152*L[d[j+1]]+.0722*L[d[j+2]],lab=asmLab(base);
  const zl=[];for(let k=0;k<N;k+=7)if(zj[k])zl.push(lab[3*k]);zl.sort((a,b)=>a-b);const Lmed=zl[zl.length>>1]||50;
  const ring=asmBox(zj,W,asmPx(3,W),true),kind=new Uint8Array(N);let n=0;
  for(let k=0;k<N;k++){if(zv&&zv[k])kind[k]=3;else if(zj[k])kind[k]=1;else if(ring[k]&&Math.hypot(lab[3*k+1],lab[3*k+2])<8&&Math.abs(lab[3*k]-Lmed)<22)kind[k]=2;if(kind[k])n++}
  const pct=(d,want)=>{const v=[];for(let k=0;k<N;k+=5)if(kind[k]===want)v.push(Y(d,4*k));v.sort((a,b)=>a-b);return v[Math.floor(v.length*.75)]||1};
  const Rm=pct(B,1),Rc=pct(cj.data,1),Rmv=zv?pct(B,3):1,Rcv=zv&&cv?pct(cv.data,3):1,idx=new Int32Array(n),sh=new Float32Array(n);let q=0;
  for(let k=0;k<N;k++){const t=kind[k];if(!t)continue;const j=4*k;let s=t===3?(cv?.5*(Y(B,j)/Rmv+Y(cv.data,j)/Rcv):Y(B,j)/Rmv):t===2?Y(B,j)/Rm:.5*(Y(B,j)/Rm+Y(cj.data,j)/Rc);
    idx[q]=k;sh[q]=s<.05?.05:s>1.6?1.6:s;q++}
  return {base,idx,sh}}
/* the base picture with a patterned jacket painted (an ImageData): T from asmSuitTex; each pixel the drawing's colour (bilinear, 2x2
   points a pixel) in its part's direction, times its shading, and the linen texture's light when the cloth is linen */
function asmSuitPaintTex(P,T){const W=P.base.width,L=ASM_LIN,d=new Uint8ClampedArray(P.base.data),rep=T.mm*ASM_PX_MM*W/ASM_SIZE,repv=rep*T.TH/T.TW,cm=[0,0,0],
    gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},lin=T.linen?asmLinenTile():null,ls=W/ASM_SIZE;
  const at=(u,v)=>{const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
    for(let q=0;q<3;q++){const G=(a,b)=>T.c[3*(((b+T.TH)%T.TH)*T.TW+(a+T.TW)%T.TW)+q];cm[q]+=(G(x0,y0)*(1-fx)+G(x0+1,y0)*fx)*(1-fy)+(G(x0,y0+1)*(1-fx)+G(x0+1,y0+1)*fx)*fy}};
  const body={cs:1,sn:0,cx:0,cy:0};
  for(let q=0;q<P.idx.length;q++){const k=P.idx[q],j=4*k,x=k%W,y=(k-x)/W,g=P.seg?P.segs[P.seg[k]]||body:body;cm[0]=cm[1]=cm[2]=0;
    for(let a=0;a<2;a++)for(let e=0;e<2;e++){const X=x+(e+.5)/2-g.cx,Y=y+(a+.5)/2-g.cy;at((X*g.cs+Y*g.sn)/rep,(Y*g.cs-X*g.sn)/repv)}
    let sh=P.sh[q];if(lin){const X=x-g.cx,Y=y-g.cy,u=Math.floor((X*g.cs+Y*g.sn)/ls),v=Math.floor((Y*g.cs-X*g.sn)/ls);sh*=lin.r[(((v%lin.T)+lin.T)%lin.T)*lin.T+(((u%lin.T)+lin.T)%lin.T)]}
    for(let c=0;c<3;c++)d[j+c]=Math.round(gam(cm[c]/4*sh))}
  return new ImageData(d,W,P.base.height)}
/* the base picture with the suit painted in hex (an ImageData) */
function asmSuitPaint(P,hex){const L=ASM_LIN,h=String(hex).replace('#',''),t=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),d=new Uint8ClampedArray(P.base.data),
    gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},G=new Uint8ClampedArray(3*1601);
  for(let c=0;c<3;c++)for(let s=0;s<=1600;s++)G[c*1601+s]=Math.round(gam(t[c]*s/1000));   // the colour at each shading, a thousandth apart
  for(let q=0;q<P.idx.length;q++){const j=4*P.idx[q],s=Math.round(P.sh[q]*1000);d[j]=G[s];d[j+1]=G[1601+s];d[j+2]=G[3202+s]}
  return new ImageData(d,P.base.width,P.base.height)}
/* ---- ties are painted on the master too (the owner's choice, 2026-11-12, from a prototype of his black, navy & pink stripe, charcoal
   check and purple foulard ties): the master's tie zone is painted with one repeat of the app's own drawing of the tie's reading
   (fabricDef, its turn and the swatch's faint sheen line left out, rendered three tiles each way and the middle one read, since a lone
   tile's edges antialias into lines), in the reading's own colours (they come from the owner's photos; matching the main colour to
   the tag shifted the others: a pink stripe went lavender), at the reading's angle on the blade and a quarter turn more in the knot
   (the silk wraps across it), sized by the repeats across the blade. Shading: the master's green tie and the magenta calibration tie,
   each pixel's lightness over its lit cloth (75th percentile), averaged. A tie with no reading is its tagged colour. The painted picture
   is then the tie piece, so asmCompose's tie mask, halo fill and soft edge apply. */
const ASM_TIEV=1;   // how ties are painted: in the picture's key
async function asmTieTile(i){const def=fabricDef('asmtie',i,'tie').replace(/ patternTransform="[^"]*"/,'').replace(/<path [^>]*stroke="#fff"[^>]*\/>/g,''),
    num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');if(!w||!h)return null;
  const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#asmtie)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,c=new Float32Array(3*TW*TH);
  for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)c[3*k+q]=L[d[4*k+q]];return {c,TW,TH}}
/* a striped tie's close-up: the stripes' direction (the projection with the sharpest profile, 2° steps) and their spacing (the
   profile's first autocorrelation peak past the silk's rib) -> repeats across the close-up's width, or 0. The reading's count can be
   half the truth (the owner's navy & pink: 1.7 read, 3.6 seen) */
function asmStripeCount(d){const S=Math.min(1,220/d.width),w=Math.round(d.width*S),h=Math.round(d.height*S),p=d.data,L=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=4*(Math.floor(y/S)*d.width+Math.floor(x/S));L[y*w+x]=.3*p[j]+.59*p[j+1]+.11*p[j+2]}
  const R=Math.ceil(Math.hypot(w,h)),prof=a=>{const cs=Math.cos(a),sn=Math.sin(a),s=new Float32Array(2*R+1),n=new Float32Array(2*R+1);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const t=Math.round((x-w/2)*cs+(y-h/2)*sn)+R;s[t]+=L[y*w+x];n[t]++}const o=[];for(let t=0;t<s.length;t++)if(n[t]>Math.min(w,h)*.5)o.push(s[t]/n[t]);return o};
  let best=null,bv=-1;for(let g=0;g<180;g+=2){const o=prof(g*Math.PI/180),m=o.reduce((a,b)=>a+b,0)/o.length,v=o.reduce((a,b)=>a+(b-m)*(b-m),0)/o.length;if(v>bv){bv=v;best=o}}
  const o=best,n=o.length,m=o.reduce((a,b)=>a+b,0)/n,z=o.map(v=>v-m),ac=k=>{let s=0;for(let t=0;t+k<n;t++)s+=z[t]*z[t+k];return s/(n-k)},a0=ac(0);if(!(a0>0)||n<20)return 0;
  const c=[1];for(let k=1;k<n/2;k++)c.push(ac(k)/a0);for(let k=4;k<c.length-1;k++)if(c[k]>.25&&c[k]>=c[k-1]&&c[k]>=c[k+1])return w/k;return 0}
/* what the pixel work needs to paint a tie (page side): {hex} for a plain one, or the tile, the angle and the repeats across */
const asmTieMemo=new Map();
async function asmTieFor(i){const k=asmTieSig(i);if(asmTieMemo.has(k))return asmTieMemo.get(k);const s=usableSett(i),hex=colOf(i);let r={hex};
  if(s&&(s.bands||s.motif)){const t=await asmTieTile(i);if(t){let across=+s.tr||1.5;
      if(s.bands&&!s.cross&&i.texture&&s.cr>0)try{const n=asmStripeCount(await asmData(i.texture));if(n&&(n/s.cr>1.35||n/s.cr<.74))across*=n/s.cr}catch{}   // the close-up shows another count
      r={hex,c:t.c,TW:t.TW,TH:t.TH,motif:!!s.motif,across,ang:(+s.a||0)*Math.PI/180}}}
  if(asmTieMemo.size>40)asmTieMemo.clear();asmTieMemo.set(k,r);return r}
const asmTieSig=i=>{const s=usableSett(i),c=i.texture||'';return fnv64(['t'+ASM_TIEV,colOf(i),settSig(s),c.length+c.slice(-40)].join('|')).slice(0,10)};
/* the colour-free part, once per master and tie calibration: the tie zone's pixels, their shading, the knot (the rows above the narrowest
   row under it, in the tie's top 30%), the blade's lean (second moments) and its width */
function asmTiePrep(master,calib,zt){const W=master.width,N=W*W,L=ASM_LIN,Y=(d,j)=>.2126*L[d[j]]+.7152*L[d[j+1]]+.0722*L[d[j+2]],idx=[];for(let k=0;k<N;k++)if(zt[k])idx.push(k);if(!idx.length)return null;
  const pct=d=>{const v=idx.map(k=>Y(d,4*k)).sort((a,b)=>a-b);return v[Math.floor(v.length*.75)]||1},Rm=pct(master.data),Rc=pct(calib.data);
  let y0=W,y1=0;const wid=new Int32Array(W);for(const k of idx){const y=(k/W)|0;wid[y]++;if(y<y0)y0=y;if(y>y1)y1=y}
  const top=y0+Math.round((y1-y0)*.3);let ymax=y0;for(let y=y0;y<top;y++)if(wid[y]>wid[ymax])ymax=y;let yk=ymax;for(let y=ymax;y<top;y++)if(wid[y]<wid[yk])yk=y;
  const gap=Math.round(W/50);let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0,bw=0;for(const k of idx){const x=k%W,y=(k-x)/W;if(y<=yk+gap)continue;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y}
  for(let y=yk+gap;y<=y1;y++)bw=Math.max(bw,wid[y]);let lean=0;if(n){const mx=sx/n,my=sy/n;lean=.5*Math.atan2(2*(sxy/n-mx*my),(sxx/n-mx*mx)-(syy/n-my*my))-Math.PI/2;while(lean>Math.PI/2)lean-=Math.PI;while(lean<-Math.PI/2)lean+=Math.PI}
  const sh=new Float32Array(idx.length);for(let q=0;q<idx.length;q++){const j=4*idx[q];sh[q]=Math.max(.15,Math.min(1.5,.5*(Y(master.data,j)/Rm+Y(calib.data,j)/Rc)))}
  return {idx:Int32Array.from(idx),sh,yk,lean,bw:bw||W/10}}
/* the master with its tie painted (an ImageData the size of the master) */
function asmTiePaint(master,P,T){const W=master.width,L=ASM_LIN,d=new Uint8ClampedArray(master.data),gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  const h=String(T.hex).replace('#',''),tg=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),rep=T.c?(T.motif?2:1)*P.bw/Math.max(.5,T.across):0,repv=T.c?rep*T.TH/T.TW:0,cm=[0,0,0];
  const at=(u,v)=>{const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
    for(let q=0;q<3;q++){const G=(a,b)=>T.c[3*(((b+T.TH)%T.TH)*T.TW+(a+T.TW)%T.TW)+q];cm[q]+=(G(x0,y0)*(1-fx)+G(x0+1,y0)*fx)*(1-fy)+(G(x0,y0+1)*(1-fx)+G(x0+1,y0+1)*fx)*fy}};
  for(let q=0;q<P.idx.length;q++){const k=P.idx[q],j=4*k,sh=P.sh[q];let col=tg;
    if(T.c){const x=k%W,y=(k-x)/W,th=P.lean+T.ang+(y<P.yk?Math.PI/2:0),cs=Math.cos(th),sn=Math.sin(th);cm[0]=cm[1]=cm[2]=0;
      for(let a=0;a<3;a++)for(let e=0;e<3;e++){const X=x+(e+.5)/3,Y=y+(a+.5)/3;at((X*cs+Y*sn)/rep,(Y*cs-X*sn)/repv)}col=[cm[0]/9,cm[1]/9,cm[2]/9]}
    for(let c=0;c<3;c++)d[j+c]=Math.round(gam(col[c]*sh))}
  return new ImageData(d,W,master.height)}
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
  // the soft edge's outer pixels that are the master's lit white shirt (near-grey, at least half as light as its lit cloth) are shirt,
  // not a share of something else: left part-painted they were a pale line along the collar against the neck on a black shirt (skin
  // is too coloured to pass; the wall beyond the shirt's zone is never copied)
  for(const k of idx)if(A[k]<1){const j=4*k,ch=Math.max(M[j],M[j+1],M[j+2])-Math.min(M[j],M[j+1],M[j+2]);if(ch<25&&Y(M,j)>Rm*.5)A[k]=1}
  // what a soft edge pixel is mixed with: the nearest pixel beyond the shirt (A 0), not the master's own pixel, which is part white
  // shirt itself (where the collar meets the neck it was half skin, half white collar: a grey dotted line along a coloured collar)
  const n=idx.length,P={idx:Int32Array.from(idx),A:new Float32Array(n),sm:new Float32Array(n),sc:new Float32Array(n),bg:new Int32Array(n)},R=6;
  for(let q=0;q<n;q++){const k=idx[q],j=4*k;P.A[q]=A[k];P.sm[q]=Math.min(1.15,Y(M,j)/Rm);P.sc[q]=Math.min(1.6,Y(C,j)/Rc);P.bg[q]=k;
    if(A[k]>=1)continue;const x=k%W,y=(k/W)|0;let best=1e9;
    for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const p=yy*W+xx,d=dx*dx+dy*dy;if(!A[p]&&d<best){best=d;P.bg[q]=p}}}}
  P.ang=asmShirtAngles(A,idx,W,H);return P}
/* which way a woven shirt's threads run, per painted pixel (P.idx order): the shirt's pieces (the front with its collar, each cuff)
   are its connected parts; the front's weave is upright, a cuff's runs along the arm, so the tile's width follows the visible band
   (its long axis, from its second moments). Soft edge pixels take the part beside them; a speck goes with the front */
function asmShirtAngles(A,idx,W,H){const N=W*H,lab=new Int32Array(N).fill(-1),parts=[];
  for(const s of idx){if(lab[s]>=0||A[s]<=.5)continue;const id=parts.length,st=[s];lab[s]=id;let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
    while(st.length){const k=st.pop(),x=k%W,y=(k-x)/W;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
      if(x>0&&lab[k-1]<0&&A[k-1]>.5){lab[k-1]=id;st.push(k-1)}if(x<W-1&&lab[k+1]<0&&A[k+1]>.5){lab[k+1]=id;st.push(k+1)}
      if(y>0&&lab[k-W]<0&&A[k-W]>.5){lab[k-W]=id;st.push(k-W)}if(y<H-1&&lab[k+W]<0&&A[k+W]>.5){lab[k+W]=id;st.push(k+W)}}
    const mx=sx/n,my=sy/n;parts.push({n,th:.5*Math.atan2(2*(sxy/n-mx*my),(sxx/n-mx*mx)-(syy/n-my*my))})}
  const front=parts.reduce((b,p,i)=>p.n>(parts[b]?parts[b].n:-1)?i:b,0),big=parts.length?parts[front].n*.02:0;
  const ang=parts.map((p,i)=>{if(i===front||p.n<big)return 0;let t=p.th;while(t>Math.PI/2)t-=Math.PI;while(t<-Math.PI/2)t+=Math.PI;return t});
  for(let pass=0;pass<6;pass++)for(const k of idx)if(lab[k]<0){const x=k%W;const q=x>0&&lab[k-1]>=0?k-1:x<W-1&&lab[k+1]>=0?k+1:k>=W&&lab[k-W]>=0?k-W:k+W<N&&lab[k+W]>=0?k+W:-1;if(q>=0)lab[k]=lab[q]}
  const out=new Float32Array(idx.length);for(let q=0;q<idx.length;q++){const l=lab[idx[q]];out[q]=l>=0?ang[l]:0}return out}
/* tex (optional, asmTexReady): the weave, multiplied into each pixel's light, averaged over 3x3 points a pixel so a fine weave
   doesn't shimmer, turned by the pixel's part (P.ang) */
function asmPaint(master,calib,hex,prep,tex){const P=prep||asmPaintPrep(master,calib),s=master.data,d=new Uint8ClampedArray(s),L=ASM_LIN,W=master.width;
  const h=String(hex).replace('#',''),t=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),w=Math.cbrt(.2126*t[0]+.7152*t[1]+.0722*t[2]);
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  const T=tex,at=T&&((u,v)=>{const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,
    g=(i,j)=>T.r[((j+T.TH)%T.TH)*T.TW+(i+T.TW)%T.TW];return (g(x0,y0)*(1-fx)+g(x0+1,y0)*fx)*(1-fy)+(g(x0,y0+1)*(1-fx)+g(x0+1,y0+1)*fx)*fy});
  // a figured shirt (T.col): each point's colour over the ground, per channel, bilinear like the weave, 3x3 points a pixel
  const cat=T&&T.col&&((u,v,o)=>{const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
    for(let c=0;c<3;c++){const G=(i,j)=>T.c[3*(((j+T.TH)%T.TH)*T.TW+(i+T.TW)%T.TW)+c];
      o[c]+=(G(x0,y0)*(1-fx)+G(x0+1,y0)*fx)*(1-fy)+(G(x0,y0+1)*(1-fx)+G(x0+1,y0+1)*fx)*fy}}),cm=[0,0,0];
  for(let q=0;q<P.idx.length;q++){const k=P.idx[q],j=4*k,b=4*P.bg[q],A=P.A[q];let sh=w*P.sm[q]+(1-w)*P.sc[q];
    if(cat){const x=k%W,y=(k-x)/W,th=(P.ang?P.ang[q]:0)+T.rot,cs=Math.cos(th),sn=Math.sin(th);cm[0]=cm[1]=cm[2]=0;
      for(let a=0;a<3;a++)for(let e=0;e<3;e++){const X=x+(e+.5)/3,Y=y+(a+.5)/3;cat((X*cs+Y*sn)/T.rx,(Y*cs-X*sn)/T.ry,cm)}
      for(let c=0;c<3;c++)d[j+c]=Math.round(A*gam(t[c]*sh*cm[c]/9)+(1-A)*s[b+c]);continue}
    if(T){const x=k%W,y=(k-x)/W,th=P.ang?P.ang[q]:0,cs=Math.cos(th),sn=Math.sin(th);let m=0;
      for(let a=0;a<3;a++)for(let e=0;e<3;e++){const X=x+(e+.5)/3,Y=y+(a+.5)/3;m+=at((X*cs+Y*sn)/T.rx,(Y*cs-X*sn)/T.ry)}sh*=m/9}
    for(let c=0;c<3;c++)d[j+c]=Math.round(A*gam(t[c]*sh)+(1-A)*s[b+c])}
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
  const parts=asmParts(o);if(parts.some(p=>!p.paint&&!p.tp&&!p.sp&&(!renders[p.key]||asmBad.has(p.key))))return null;
  const kz=await metaGet('asm:zones:'+mk),job={mk,mt:m.t,master:m.img,zones:kz&&kz.v===ASM_ZV?kz:null,calib:null,vest:null,
    parts:await Promise.all(parts.map(async p=>p.sp?{slot:p.slot,vest:!!p.vest,key:p.key,sp:p.sp,hex:colOf(p.item),tex:asmSuitBands(p.item)?await asmSuitTex(p.item):null}:p.tp?{slot:p.slot,key:p.key,tp:p.tp,tie:await asmTieFor(p.item)}:p.paint?{slot:p.slot,key:p.key,paint:p.paint,wk:p.wk,tex:p.wk?await asmTexFor(p.item,p.paint,p.wk):null}:{slot:p.slot,vest:!!p.vest,key:p.key,img:renders[p.key].img}))};   // a woven shirt's weave is drawn here (the tile needs the page)
  if(parts.some(p=>p.paint)){const c=renders[asmCalibKey('shirt')];if(!c)return null;job.paintCalib={t:c.t,img:c.img}}
  if(parts.some(p=>p.tp)){const c=renders[asmCalibKey('tie')];if(!c)return null;job.tieCalib={t:c.t,img:c.img}}   // a painted tie is shaded from the master's tie and the magenta calibration tie   // a painted shirt takes its shading from the black calibration shirt too
  if(!job.zones){job.zoneImg=asmZoneImgs();   // zones made outside the app, when they're here; else the calibration photos
    if(!job.zoneImg){job.calib={};for(const s of ['jacket','shirt','tie','watch']){const r=renders[asmCalibKey(s)];if(!r)return null;job.calib[s]=r.img}}}
  if(parts.some(p=>p.sp)){const c=renders[asmCalibKey('jacket')];if(!c)return null;job.suitCalib={t:c.t,img:c.img}}   // a painted suit is shaded from the master's suit and the red calibration suit
  if(parts.some(p=>p.sp&&asmSuitBands(p.item)))job.sleeveImg=asmSleeveImgs();   // a patterned jacket's sleeves run along the arm (upright everywhere without them)
  if(o.vest){const vk=asmVestKey(),r=renders[vk];if(!r)return null;const kv=await metaGet('asm:vest:'+vk);
    job.vest={k:vk,t:r.t,kept:kv&&kv.t===r.t&&kv.v===ASM_ZV?kv:null};
    if(parts.some(p=>p.sp)){const c=renders[asmCalibKey('vest')];if(!c)return null;job.suitVest={t:r.t+'|'+c.t,img:r.img,calib:c.img}}   // painted on the waistcoat master, the waistcoat from its own calibration photo
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
  if(job.tieCalib&&(!M.tpp||M.tppt!==job.tieCalib.t)){M.tpp=asmTiePrep(master,await asmData(job.tieCalib.img,W),z.tie);M.tppt=job.tieCalib.t;M.ties={}}
  const slv=job.sleeveImg&&job.parts.some(p=>p.sp&&p.tex)?'s':'';   // the sleeves are worked out only for a patterned jacket
  if(slv&&!M.sleeves)M.sleeves=await Promise.all(ASM_SLEEVES.map(s=>asmMaskFromImg(job.sleeveImg[s],W)));
  const sl=slv?M.sleeves:null;
  if(job.suitCalib&&job.parts.some(p=>p.sp&&!p.vest)&&(!M.spp||M.sppt!==job.suitCalib.t+slv)){M.spp=asmSuitPrep(master,await asmData(job.suitCalib.img,W),z.jacket,null,null,sl);M.sppt=job.suitCalib.t+slv;M.suits={}}
  if(job.suitCalib&&job.suitVest&&V&&(!M.sppv||M.sppvt!==job.suitVest.t+'|'+job.suitCalib.t+slv)){M.sppv=asmSuitPrep(await asmData(job.suitVest.img,W),await asmData(job.suitCalib.img,W),z.jacket,V,await asmData(job.suitVest.calib,W),sl);M.sppvt=job.suitVest.t+'|'+job.suitCalib.t+slv;M.suits={}}
  const P={};for(const p of job.parts){if(p.sp){const pr=p.vest?M.sppv:M.spp;if(!pr)return out;M.suits=M.suits||{};const k=p.sp+(p.vest?'v':'');if(!M.suits[k]&&Object.keys(M.suits).length>=4)M.suits={};   // a painted suit: no drift to check
      P.jacket=M.suits[k]=M.suits[k]||(p.tex?asmSuitPaintTex(pr,p.tex):asmSuitPaint(pr,p.hex));continue}
    if(p.tp){if(!M.tpp)return out;M.ties=M.ties||{};P.tie=M.ties[p.tp]=M.ties[p.tp]||asmTiePaint(master,M.tpp,p.tie);continue}   // a painted tie: only its zone changes
    if(p.paint){M.paint=M.paint||{};const pk=p.paint+(p.tex&&p.wk?'~'+p.wk:'');   // nothing outside the shirt changes: no drift to check
      P[p.slot]=M.paint[pk]=M.paint[pk]||asmPaint(master,null,p.paint,M.pp,p.tex&&p.wk?asmTexReady(p.tex,p.paint,W):null);continue}
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
const asmOutKey=o=>asmKey('out/z'+ASM_ZV+'/'+asmParts(o).map(p=>p.key+(p.paint?'='+p.paint+(p.wk?'~'+p.wk:''):'')+(p.tp?'='+p.tp:'')+(p.sp?'='+p.sp:'')).join('+'));   // a painted shirt's colour (and weave) is in the key: a new shade is a new picture
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
  if(asmParts(o).some(p=>p.tp)&&!await asmGet(asmCalibKey('tie')))return null;
  if(asmParts(o).some(p=>p.sp)&&(!await asmGet(asmCalibKey('jacket'))||(o.vest&&!await asmGet(asmCalibKey('vest')))))return null;
  if(asmParts(o).some(p=>p.sp&&asmSuitBands(p.item)))await Promise.all(ASM_SLEEVES.map(s=>asmGet(asmZoneKey(s))));
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
    if(asmParts(o).some(p=>p.tp)&&!await asmGet(asmCalibKey('tie')))return;   // the magenta tie a painted tie is shaded from
    if(asmParts(o).some(p=>p.sp)&&(!await asmGet(asmCalibKey('jacket'))||(o.vest&&!await asmGet(asmCalibKey('vest')))))return;   // the red suit (and orange waistcoat) a painted suit is shaded from
    if(asmParts(o).some(p=>p.sp&&asmSuitBands(p.item)))await Promise.all(ASM_SLEEVES.map(s=>asmGet(asmZoneKey(s))));   // the sleeves' zone pictures (without them the pattern stays upright)
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
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt)||(slot==='shirt'&&asmPaintable(i))||slot==='tie'||(slot==='jacket'&&asmSuitPaintable(i)))continue;add('piece',slot,i,asmPieceKey(slot,i),nm(i));   // a plain or woven shirt is painted: nothing to make
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
