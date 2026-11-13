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
const ASM_EDGE_P=8;   // a painted suit's soft edge: how far past its zone the master's out-of-focus outline is laid over again
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
/* the nearest pixel of a mask, for every pixel (-1 where it has none): two passes over the picture, each pixel taking a neighbour's
   nearest when that is nearer (close to the true distance; a breadth-first search counts steps, which bends round corners) */
/* lim (optional): only its pixels are worked out (and pass a nearest on), the rest keep -1: a band round an edge costs a band */
function asmNear(m,W,lim){const n=m.length,H=n/W,s=new Int32Array(n).fill(-1),d=new Float32Array(n).fill(1e12);for(let i=0;i<n;i++)if(m[i]&&(!lim||lim[i])){s[i]=i;d[i]=0}
  let y0=0,y1=H-1;if(lim){while(y0<H&&!lim.subarray(y0*W,y0*W+W).includes(1))y0++;while(y1>=y0&&!lim.subarray(y1*W,y1*W+W).includes(1))y1--}
  const tryq=(i,x,y,q)=>{const t=s[q];if(t<0)return;const tx=t%W,ty=(t-tx)/W,e=(x-tx)*(x-tx)+(y-ty)*(y-ty);if(e<d[i]){d[i]=e;s[i]=t}};
  for(let y=y0;y<=y1;y++)for(let x=0;x<W;x++){const i=y*W+x;if(lim&&!lim[i]||!d[i])continue;if(x)tryq(i,x,y,i-1);if(y){tryq(i,x,y,i-W);if(x)tryq(i,x,y,i-W-1);if(x<W-1)tryq(i,x,y,i-W+1)}}
  for(let y=y1;y>=y0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(lim&&!lim[i]||!d[i])continue;if(x<W-1)tryq(i,x,y,i+1);if(y<H-1){tryq(i,x,y,i+W);if(x<W-1)tryq(i,x,y,i+W+1);if(x)tryq(i,x,y,i+W-1)}}
  return {s,d}}   // d: squared distance
/* a box blur of a float field, radius R (the edge pixel repeated beyond the picture) */
function asmBlurF(src,W,R){const N=src.length,H=N/W,t=new Float32Array(N),o=new Float32Array(N),n=2*R+1,col=new Float64Array(W);
  for(let y=0;y<H;y++){const a=y*W,f=src[a],l=src[a+W-1];let s=(R+1)*f;for(let x=1;x<=R;x++)s+=src[a+Math.min(x,W-1)];
    for(let x=0;x<W;x++){t[a+x]=s/n;const ad=x+R+1,rm=x-R;s+=(ad<W?src[a+ad]:l)-(rm>0?src[a+rm]:f)}}
  for(let x=0;x<W;x++)col[x]=(R+1)*t[x];for(let y=1;y<=R;y++){const a=Math.min(y,H-1)*W;for(let x=0;x<W;x++)col[x]+=t[a+x]}   // the columns' running sums, row by row
  for(let y=0;y<H;y++){const a=y*W,ad=Math.min(y+R+1,H-1)*W,rm=Math.max(y-R,0)*W;for(let x=0;x<W;x++){o[a+x]=col[x]/n;col[x]+=t[ad+x]-t[rm+x]}}
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
/* The tie bar, drawn (the owner's choice, 2026-11-13: the photographed bar came out of its photo as a dark slab with a rim of the
   master's green tie). A flat metal bar across the tie ASM_BAR_AT of the way down the tie that shows (from the knot to where the hand
   covers it), turned square to the tie's centre line there, ASM_BAR_LEN of the tie's width long and ASM_BAR_MM tall, with rounded
   ends. Shaded as brushed metal lit from the upper left like the master: a bright top bevel, a dark bottom one, a light streak along the
   face, the left end a little lighter, fine brushing along it, a touch of the tie's colour reflected low on the face; and a soft shadow
   on the tie below and right of it. Anti-aliased from its exact outline. -> the bar's mask */
const ASM_BARV=2,ASM_BAR_AT=.6,ASM_BAR_MM=5.5,ASM_BAR_LEN=.8;   // 2: clipped on from the tie's left edge (the owner: "it's a clip, it doesn't float")
/* its colour: a tie clip is its colour (no metal field). The metals have their own tones (a swatch colour is too flat for polished
   metal); any other colour is an enamel bar in that colour (colOf, so a custom colour works too), shaded the same way */
const ASM_METAL={silver:[200,201,204],white:[226,227,229],lightgrey:[190,192,196],midgrey:[172,174,178],grey:[160,162,166],gold:[208,168,84],rosegold:[206,148,128],gunmetal:[96,99,106]};
const asmBarRgb=i=>{const c=i&&i.primaryColor;if(ASM_METAL[c])return ASM_METAL[c];const h=String(colOf(i)).replace('#','');return [0,2,4].map(k=>parseInt(h.slice(k,k+2),16)||128)};
const asmBarSig=i=>'b'+ASM_BARV+asmBarRgb(i).join('.');
function asmBarDraw(o,tieM,W,rgb,lab){const N=W*W,s=W/ASM_SIZE,m=new Uint8Array(N);let first=-1;for(let i=0;i<N&&first<0;i++)if(tieM[i])first=i;if(first<0)return null;
  const a=asmAreas(tieM,W),k=a.lab[first],xl=new Float32Array(W).fill(-1),xr=new Float32Array(W).fill(-1);let y0=W,y1=-1;
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){if(a.lab[y*W+x]!==k)continue;if(xl[y]<0)xl[y]=x;xr[y]=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(y1-y0<40*s)return null;
  const yb=Math.round(y0+ASM_BAR_AT*(y1-y0)),R=Math.round(10*s),D=Math.round(40*s);
  const at=(y,f)=>{const v=[];for(let yy=y-R;yy<=y+R;yy++)if(yy>=0&&yy<W&&xl[yy]>=0)v.push(f(yy));v.sort((p,q)=>p-q);return v.length?v[v.length>>1]:NaN};
  const ctr=y=>at(y,yy=>(xl[yy]+xr[yy])/2),wd=at(yb,yy=>xr[yy]-xl[yy]+1);let cx=ctr(yb);if(!isFinite(cx)||!isFinite(wd))return null;
  let sl=(ctr(Math.min(y1,yb+D))-ctr(Math.max(y0,yb-D)))/(Math.min(y1,yb+D)-Math.max(y0,yb-D));if(!isFinite(sl))sl=0;
  const nn=Math.hypot(1,sl),ux=1/nn,uy=-sl/nn,vx=sl/nn,vy=1/nn;   // u along the bar (square to the tie), v down the tie
  const Lh=ASM_BAR_LEN*wd/nn/2,Hh=ASM_BAR_MM*ASM_PX_MM*s/2,r=.42*Hh,bev=Math.max(1.2,.3*Hh),base=Array.isArray(rgb)?rgb:ASM_METAL[rgb]||ASM_METAL.silver;   // (a metal's name also works: the tests)
  // a clip slides on from the side: its folded end sits on the tie's left edge (a pixel past it, where it turns round the tie)
  const sh0=-(wd/nn/2)+Lh-1;cx+=sh0*ux;const cy=yb+sh0*uy;
  const rr=u=>u<0?.12*Hh:r;   // the folded end (left) is nearly square; the free end rounded
  const sdf=(u,v)=>{const R0=rr(u),qx=Math.abs(u)-(Lh-R0),qy=Math.abs(v)-(Hh-R0);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-R0};
  const sx=.45*Hh,sy=.75*Hh,sb=.38*Hh,lx=-.42,ly=-.91;   // the shadow's offset and softness; the light comes from the upper left
  const hash=n=>{n=Math.imul(n^61^(n>>>16),9);n^=n>>>4;n=Math.imul(n,0x27d4eb2d);n^=n>>>15;return (n>>>0)/4294967296};
  const ext=Lh+Hh+sx+3*sb,x0=Math.max(0,Math.floor(cx-ext)),x1=Math.min(W-1,Math.ceil(cx+ext)),ya=Math.max(0,Math.floor(cy-ext)),yz=Math.min(W-1,Math.ceil(cy+ext));
  const src=new Uint8ClampedArray(o);
  for(let y=ya;y<=yz;y++)for(let x=x0;x<=x1;x++){const i=y*W+x,j=4*i,dx=x-cx,dy=y-cy,u=dx*ux+dy*uy,v=dx*vx+dy*vy;
    // the shadow on the tie (only the tie: the bar never reaches past it)
    if(tieM[i]){const us=(dx-sx)*ux+(dy-sy)*uy,vs=(dx-sx)*vx+(dy-sy)*vy,ds=sdf(us,vs),sh=.55/(1+Math.exp(ds/sb));for(let c=0;c<3;c++)o[j+c]=src[j+c]*(1-sh)}
    const d=sdf(u,v),cov=Math.min(1,Math.max(0,.5-d));if(cov<=0)continue;
    const vn=v/Hh,e=-d;   // vn: -1 at the top edge, 1 at the bottom; e: how far inside the outline
    // the face, polished: lighter at the top, a sharp bright streak above the middle, a darker band (the room reflected) below it
    let f=.98-.42*(vn+1)/2+.5*Math.exp(-Math.pow((vn+.42)/.12,2))-.26*Math.exp(-Math.pow((vn-.28)/.2,2));
    f*=1+.08*(-u/Lh)+.16*Math.exp(-Math.pow((u/Lh+.4)/.28,2));   // lit from the left
    const fold=(u+Lh)/(1.6*Hh);if(fold<1)f*=.62+.38*fold*fold*(3-2*fold);   // where it turns round the tie's edge, away from the light
    if(e<bev){const R0=rr(u),qx=Math.abs(u)-(Lh-R0),qy=Math.abs(v)-(Hh-R0);let nx=Math.max(qx,0)*Math.sign(u),ny=Math.max(qy,0)*Math.sign(v);if(!nx&&!ny){if(qx>qy)nx=Math.sign(u);else ny=Math.sign(v)}
      const nl=Math.hypot(nx,ny)||1,w=1-Math.max(0,e)/bev;f*=1+w*(.9*((nx*lx+ny*ly)/nl)-.1)}   // the bevel: bright facing the light, dark away from it
    f*=1+.035*(hash(Math.floor((v+Hh)*1.6)+977)-.5)+.02*(hash(i)-.5);   // brushed along the bar
    const refl=.1+.18*Math.max(0,vn);   // the tie's colour seen in the face, most low down
    const glint=255*.22*Math.exp(-Math.pow((vn+.42)/.12,2))*(1-.3*u/Lh)*Math.min(1,(u+Lh)/(1.6*Hh));   // a white glint on the streak: a dark enamel bar shines too
    for(let c=0;c<3;c++){const mc=Math.min(255,base[c]*f+glint)*(1-refl)+src[j+c]*1.4*refl;o[j+c]=cov*Math.min(255,mc)+(1-cov)*o[j+c]}
    if(cov>=.5){m[i]=1;if(lab)lab[i]=4}}
  return m}
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
/* The waistcoat's edge over the shirt and the tie (V: where the waistcoat covers them). Its zone's outline was a hard staircase of
   pixels, the tie simply cut off by it, flat. In a photo the waistcoat lies ON the tie: its edge is a clean line of cloth, and the
   tie and shirt just inside it are in its soft shadow (the reference photo: darkest at the edge, gone about 5px in at 900).
   The outline is smoothed (the zone blurred over 3px, at half), the pixels along it are the waistcoat over what is beside it in the share of the waistcoat
   around them (2px), and the shirt and tie within ASM_VSH of it are darkened toward the edge. Marked soft: asmSeams leaves them. */
const ASM_VSH=5;
const ASM_VSH_K=.45;   // the shadow's depth at the edge (a share of the light)
function asmVestEdge(o,lab,V,W,soft){const N=W*W,px=n=>asmPx(n,W),L=ASM_LIN,gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  // (the zone's outline is a staircase of 2-4px steps, which a 5x5 majority keeps: it is smoothed over 3px, at half)
  const open=i=>lab[i]===2||lab[i]===3||lab[i]===6,src=new Uint8ClampedArray(o),Vs=asmBlurF(Float32Array.from(V),W,px(3)),Vm=new Uint8Array(N);for(let i=0;i<N;i++)if(Vs[i]>.5)Vm[i]=1;
  const vw=new Uint8Array(N),opn=new Uint8Array(N);for(let i=0;i<N;i++){if(V[i]&&lab[i]===1)vw[i]=1;else if(!V[i]&&open(i))opn[i]=1}
  const Ds=px(ASM_VSH),R=Ds+px(4),Vr=asmBlurF(Float32Array.from(V),W,R),near=new Uint8Array(N);for(let i=0;i<N;i++)if(Vr[i]>0&&Vr[i]<1)near[i]=1;   // a band along the edge: all that changes
  const inV=asmNear(vw,W,near),inO=asmNear(opn,W,near),dV=asmNear(Vm,W,near),Vb=asmBlurF(Float32Array.from(Vm),W,px(1));
  const col=(k,c)=>L[src[4*k+c]];
  for(let i=0;i<N;i++){if(!near[i])continue;const b=Vb[i];
    if(Vm[i]){if(!(V[i]&&lab[i]===1)&&!open(i))continue;const w=V[i]&&lab[i]===1?i:inV.s[i],q=inO.s[i];if(w<0)continue;   // the waistcoat (where the smoothed outline took in a pixel of the opening, its nearest)
      if(w===i&&(b>=1||q<0||inO.d[i]>9*px(1)*px(1)))continue;for(let c=0;c<3;c++)o[4*i+c]=gam(q>=0?b*col(w,c)+(1-b)*col(q,c):col(w,c));lab[i]=1;soft[i]=1;continue}   // with what lies beyond the edge showing through a little
    if(!open(i)&&!(V[i]&&lab[i]===1))continue;const s=open(i)?i:inO.s[i];if(s<0||(s!==i&&inO.d[i]>16*px(1)*px(1)))continue;   /* (waistcoat beside a hand stays: only the opening's own pixels lie within 4px) */const sl=lab[s],d=Math.sqrt(dV.d[i]),q=inV.s[i];
    const t=d<Ds?1-d/Ds:0,f=1-ASM_VSH_K*t*t*(sl===2?.75:1);
    for(let c=0;c<3;c++){let v=col(s,c)*f;if(b>0&&q>=0)v=b*col(q,c)+(1-b)*v;o[4*i+c]=gam(v)}if(s!==i)lab[i]=sl;soft[i]=1}}
/* the shirt's zone without what the shirt's piece left as the master shows it, when the piece changed the shirt (a painted shirt
   paints only the master's shirt): the SAM zone reaches over the lapel's edge in places, and there the piece is the master's grey
   jacket, laid in as shirt: a pale notch at the lapel by the collar. Those pixels are left to the jacket (its edge ring). */
function asmShirtOwn(master,z,shirt){const N=z.W*z.W,M=master.data,S=shirt.data,d=i=>Math.abs(M[4*i]-S[4*i])+Math.abs(M[4*i+1]-S[4*i+1])+Math.abs(M[4*i+2]-S[4*i+2]);let n=0,c=0;
  for(let i=0;i<N;i+=7)if(z.shirt[i]){n++;if(d(i)>30)c++}if(!n||c/n<.5)return z;const s=new Uint8Array(z.shirt);for(let i=0;i<N;i++)if(s[i]&&d(i)<3)s[i]=0;return Object.assign({},z,{shirt:s})}
function asmCompose(master,z,P,info){if(P.shirt&&P.jacket)z=asmShirtOwn(master,z,P.shirt);const W=z.W,N=W*W,o=new Uint8ClampedArray(master.data),lab=new Uint8Array(N),soft=new Uint8Array(N),V0=P.vest||null,px=n=>asmPx(n,W);   // V0: the waistcoat's zone (the jacket piece is then a suit with its waistcoat)
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
    const own=V0?z.jacket.map((v,i)=>v||V0[i]):z.jacket,ring=asmBox(own,W,px(P.jacket.edge||ASM_EDGE),true),Lm=asmLab(master),Lj=asmLab(P.jacket),isSkin=(L,i)=>L[3*i+1]>8&&L[3*i+2]>10&&L[3*i]>50;   // lit skin: the dark rim of a hand over the master's burgundy tie is reddish too, and is not kept
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
    // on a waistcoat day the master's tie below the V lies under the waistcoat, and the suit's photo (or painting) shows the
    // waistcoat there even where the waistcoat's zone stops short of the hand: a pixel of the tie's zone that the suit's photo shows
    // as neither the master's tie (its hue) nor the master's skin takes the suit's photo. (Filled from beside it instead, the few
    // waistcoat pixels in reach by the knuckles were each copied over a whole patch: flat blocks, grey-green while they were the
    // hand's rim.)
    const Lp=V0&&P.jacket?asmLab(P.jacket):null,gt=g[2]?[g[0]/g[2],g[1]/g[2]]:[0,0],under=i=>Lp&&z.tie[i]&&!(Lt[3*i+1]>8&&Lt[3*i+2]>10&&Lt[3*i]>35)&&Math.hypot(Lp[3*i+1]-gt[0],Lp[3*i+2]-gt[1])>ASM_KEY_DE;
    const R=px(14),SHIRT_PREF=.25;for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!need[i])continue;const want=zid(i);let j=-1,best=1e9;
      if(under(i)){const J=P.jacket.data;o[4*i]=J[4*i];o[4*i+1]=J[4*i+1];o[4*i+2]=J[4*i+2];lab[i]=1;continue}
      for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx,k=zid(q);
        if(k&&(!want||k===want)&&!need[q]&&!tieM[q]&&!z.watch[q]&&!(V&&V[q])&&lab[q]!==7){const d=(dx*dx+dy*dy)*(!want&&k===2?SHIRT_PREF:1);if(d<best){best=d;j=q}}}}
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
  if(V&&P.jacket)asmVestEdge(o,lab,V,W,soft);
  const seam=asmSeams(o,lab,W,soft);
  if(P.barDraw&&!V&&tieM)barM=asmBarDraw(o,tieM,W,P.barDraw,lab);   // drawn after the joins, so its edge stays crisp
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
/* the outfit is painted on a colour-coded master (asm-color.js): its kind has one and that master is on this device (asmEnsure and
   asmPrebuildOne look for it first); a worker without them leaves every outfit to the earlier way */
/* (2026-11-13) or the worker's list says it keeps that master: a phone then needn't download a master (and its masks) just to learn it
   exists; it downloads them only to paint a look the computer hasn't built (asmCmEnsure) */
/* (and the masters the last list showed are remembered, localStorage.asm_cm_listed: at start a phone holding no master would otherwise
   wait for the list before showing a picture it already keeps) */
let asmCmListed=null;
const asmCmSeen=k=>{if(!asmCmListed){try{asmCmListed=new Set(JSON.parse(localStorage.getItem('asm_cm_listed')||'[]'))}catch{asmCmListed=new Set()}}return asmCmListed.has(k)};
const asmCmHeld=k=>{const m=asmCmKey(k,'master');return !!(renders[m]||(asmList?asmList.has(m):asmCmSeen(m)))};
const asmCmUse=o=>{if(!ASM_ON||typeof asmCmKind!=='function')return null;const k=asmCmKind(o);return k&&asmCmHeld(k)?k:null};
/* look for the outfit's colour-coded master on the worker, once a session: in the worker's list (one small request), else by downloading it */
const asmCmLook=async o=>{if(!ASM_ON||typeof asmCmKind!=='function')return;const k=asmCmKind(o);if(!k)return;
  if(!renders[asmCmKey(k,'master')]){const L=await asmListGet();if(!(L&&L.has(asmCmKey(k,'master')))&&!asmTried.has(asmCmKey(k,'master')))await asmCmGet(k)}
  // the background (asm-color.js), once a session: its date is in every look's key, so a phone needs it to find the computer's pictures
  if(asmCmHeld(k))await asmCmBgGet()};
const asmCmAny=()=>typeof asmCmKey==='function'&&Object.keys(ASM_CM_KINDS).some(asmCmHeld);
/* the worker's list of the photos it keeps (GET /render?list=1: keys only, a few KB), refreshed after ASM_LIST_MS: which looks the
   computer has built (npm run assemble) and which colour-coded masters are there. Asked for once per refresh, by everything that needs
   it at once; null when the worker can't list (the daily listing allowance): then a look is asked for by itself, as before */
let asmList=null,asmListAt=0,asmListing=null;const ASM_LIST_MS=5*60e3;
function asmListGet(force){const W=workerBase();if(!W)return Promise.resolve(null);if(asmListing)return asmListing;
  if(asmList&&!force&&Date.now()-asmListAt<ASM_LIST_MS)return Promise.resolve(asmList);
  asmListing=(async()=>{try{const r=await fetch(W.url+'?list=1',{headers:{'x-app-token':W.tok},cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
      if(j&&Array.isArray(j.keys)){asmList=new Set(j.keys);asmListAt=Date.now();
        if(typeof ASM_CM_KINDS!=='undefined'){asmCmListed=new Set(Object.keys(ASM_CM_KINDS).map(k=>asmCmKey(k,'master')).filter(m=>asmList.has(m)));try{localStorage.setItem('asm_cm_listed',JSON.stringify([...asmCmListed]))}catch{}}}}
    catch(e){console.warn('no list',e)}
    finally{asmListing=null}return asmList})();
  return asmListing}
/* the piece photos an outfit needs: [{slot, key, item}] */
function asmParts(o){const inf=asmInfo()||{},out=[];
  for(const slot of ['jacket','shirt','tie','bar','watch']){const i=o[ASM_SLOT[slot]];if(!i||(slot==='bar'&&o.vest))continue;const sig=asmLook(slot,i);
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt))continue;   // as the master shows it
    if(slot==='shirt'&&asmPaintable(i)){out.push({slot,key:asmPieceKey(slot,i),item:i,paint:colOf(i),wk:asmWeaveSig(i)});continue}   // painted here (its weave laid over): no photo
    if(slot==='tie'){out.push({slot,key:asmPieceKey(slot,i),item:i,tp:asmTieSig(i)});continue}   // a tie is painted here too (asmTiePaint): no photo
    if(slot==='bar'){out.push({slot,key:asmPieceKey(slot,i),item:i,db:asmBarSig(i)});continue}   // a tie bar is drawn (asmBarDraw): no photo
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
const asmPhotoParts=o=>asmCmUse(o)?[]:asmParts(o).filter(p=>!p.paint&&!p.tp&&!p.sp&&!p.db);   // the parts that need a photo from the worker
/* ---- solid suits and blazers are painted on the master too (the owner's choice, 2026-11-12, from a prototype of his brown and very
   dark navy suits, with and without the waistcoat): the master's jacket zone (on a waistcoat day: the waistcoat master's, and the
   waistcoat zone with it) in the suit's tagged colour (colOf), shaded by the master's plain grey suit and the red jacket calibration
   photo (the orange waistcoat calibration for the waistcoat), each pixel's lightness over its lit cloth (75th percentile), averaged; the
   master suit's own fine grain comes through as a natural cloth texture. The suit's soft grey edge just outside the zone (near-grey,
   within 22 L* of the master suit's median, not skin) is painted from the master's lightness alone, so no grey outline is left. The
   painted picture is the suit's piece (as a photo of the suit with its waistcoat would be), so asmCompose's jacket edge handling
   applies. Patterned suits (pinstripe, windowpane, twill, herringbone…) are still photographed. */
const ASM_SUITV=7;   // how suits are painted: in the picture's key (5: pinstripes follow the body; 6: the edge fixes, so kept pictures are painted again; 7: the sleeves' stripe flow)
const asmSuitPaintable=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&((patBase(i.pattern)==='solid'&&!usableSett(i))||asmSuitBands(i)||asmSuitTwill(i)||asmSuitTweed(i));
/* a twill jacket with no band reading (a suit or blazer tagged twill, or the owner's own pattern drawn like twill) is painted too
   (2026-11-13, his mid grey & brown and light grey & tan twill suits and his charcoal twill blazer, which had to be photographed): its
   colour with the twill's diagonal ribs in the shading (asmClothOf's twill, through asmSuitPaintTex), fainter than under a stripe
   (amp: at the stripes' .16 the ribs read as lines at this distance, where a real twill reads as a fine texture), and on a two-colour
   twill (a second colour) the ribs lean toward it (mix at a rib's crest). asmTwillTex is the one-colour tile. */
const ASM_TWILL={amp:.06,mix:.22,fleck:.025};
/* (2026-11-13 audit) herringbone jackets with no band reading were flat colour (the owner's charcoal tonal herringbone), and so were his
   own patterns named twill but based on solid (black fine worsted twill, mid grey melange twill): the weave is read from the pattern's
   own name or Claude's description too (asmSuitWeave), and a herringbone gets the herringbone cloth, columns ASM_HB_MM wide */
const ASM_HB_MM=5.4,ASM_HB_AMP=.28,ASM_HB_RIB=3.6,ASM_HB_FLECK=.16,ASM_HB_YARN=.5,ASM_HB_BREAK=0,ASM_HB_THIN=0,ASM_HB_MOTTLE=.13,ASM_HB_FLOAT=.7,ASM_HB_FLOATL=1.1,ASM_HB_SOFT=0,ASM_HB_GRAIN=.1,ASM_HB_SNAP=1,ASM_HB_PBRK=.25;   // a herringbone's ribs are stronger than a plain twill's (.06): at .06 the charcoal tonal herringbone read flat; its close-up shows columns about 5 mm wide
const asmSuitWeave=i=>{if(!i)return '';const b=patBase(i.pattern);if(b==='herringbone')return 'herringbone';if(b==='twill')return 'twill';
  if(b!=='solid'&&!/^own/.test(i.pattern||''))return '';
  const t=(i.pattern||'')+' '+((i.patternSpec&&i.patternSpec.description)||i.patternText||'');
  return /herringbone/i.test(t)?'herringbone':/twill|serge|gabardine/i.test(t)?'twill':''};
const asmSuitTwill=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&!!asmSuitWeave(i)&&!asmSuitBands(i);
/* a herringbone's ribs meet in clean V's at each column edge only when the column is a whole number of half rib-spacings wide
   (2026-11-13: at 4.4 mm columns and 1.7 mm ribs every rib met its partner 0.18 of a rib off, which the owner saw as jagged V's) */
const asmHbCw=()=>Math.max(1,Math.round(ASM_HB_MM/(ASM_HB_RIB/2)))*ASM_HB_RIB/2;
function asmTwillTex(i){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},c2=COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null;
  const hb=asmSuitWeave(i)==='herringbone';
  return {c:new Float32Array(lin(colOf(i))),TW:1,TH:1,mm:10,linen:asmLinen(i),cloth:{kind:hb?'herringbone':'twill',...(hb?{cw:asmHbCw()*ASM_PX_MM,off:0,pitch:ASM_HB_RIB*ASM_PX_MM,yarn:ASM_HB_YARN,brk:ASM_HB_BREAK,thin:ASM_HB_THIN,mottle:ASM_HB_MOTTLE,float:ASM_HB_FLOAT,floatL:ASM_HB_FLOATL,soft:ASM_HB_SOFT,grain:ASM_HB_GRAIN,pbrk:ASM_HB_PBRK}:{}),amp:hb?ASM_HB_AMP:ASM_TWILL.amp,c2,mix:c2?ASM_TWILL.mix:0,fleck:hb?ASM_HB_FLECK:ASM_TWILL.fleck,ss:true}}}
/* small woven figures (2026-11-13, the painters the routing test listed as missing): each is its thread grid, worked out as the cloth is
   woven where that is how the figure comes about (a houndstooth and a sharkskin are a 2/2 twill with dark and light yarns: 4 and 4 for
   the houndstooth, 1 and 1 for the sharkskin), drawn for birdseye and nailhead (a dark eye in a light ring; a light pin dot). g is each
   thread crossing's light, -1 (dark yarn) to +1; with a second colour (or a houndstooth's tonal dark) the dark crossings take it.
   ASM_MICRO: thread width (mm), shading swing, how far a dark crossing goes to the second colour */
const ASM_MICRO={houndstooth:{N:8,thr:.75,amp:.03,mix:.9},sharkskin:{N:4,thr:.45,amp:.12,mix:.45},birdseye:{N:4,thr:.5,amp:.14,mix:.45},nailhead:{N:3,thr:.5,amp:.16,mix:.4}};
const ASM_MICRO_KINDS=Object.keys(ASM_MICRO);
function asmMicroGrid(kind){const C=ASM_MICRO[kind],N=C.N,g=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let v=0;
    if(kind==='houndstooth'||kind==='sharkskin'){const h=kind==='houndstooth'?4:1,warpDark=Math.floor(x/h)%2===0,weftDark=Math.floor(y/h)%2===0,top=((x+y)%4)<2;v=(top?warpDark:weftDark)?-1:1}
    else if(kind==='birdseye'){const td=(a,b)=>{const d=Math.abs(a-b)%N;return Math.min(d,N-d)},dist=Math.min(td(x,1)+td(y,1),td(x,3)+td(y,3));v=dist===0?-1:dist===1?.6:0}   // eyes at (1,1) and (3,3), staggered
    else v=x===1&&y===1?1:-.25;
    g[y*N+x]=v}
  return g}
/* the weave a jacket or trousers is painted with when it is none of the band, twill or tweed painters': from its pattern, or an own
   pattern's name (a "micro houndstooth" drawn like solid) */
const asmMicroKind=i=>{if(!i)return '';const b=patBase(i.pattern);if(ASM_MICRO[b])return b;if(b!=='solid'&&!/^own/.test(i.pattern||''))return '';
  const t=(i.pattern||'')+' '+((i.patternSpec&&i.patternSpec.description)||i.patternText||'');return ASM_MICRO_KINDS.find(k=>new RegExp(k.replace('eye','[ -]?eye').replace('head','[ -]?head').replace('tooth','[ -]?tooth').replace('skin','[ -]?skin'),'i').test(t))||''};
function asmMicroTex(i,kind){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},C=ASM_MICRO[kind],c=lin(colOf(i));
  let c2=COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null;
  // a houndstooth with no second colour is tonal: its teeth a darker shade of the cloth (a dark cloth's lighter)
  if(!c2&&kind==='houndstooth'){const y=.2126*c[0]+.7152*c[1]+.0722*c[2],k=y>.05?.35:2.6;c2=c.map(v=>Math.min(1,v*k))}
  return {c:new Float32Array(c),TW:1,TH:1,mm:10,linen:false,cloth:null,wv:{kind,N:C.N,thr:C.thr,amp:c2&&kind!=='houndstooth'?C.amp*.5:C.amp,mix:c2?C.mix:0,c2:c2?new Float32Array(c2):null,g:asmMicroGrid(kind)}}}
/* a tweed jacket with no band reading (tagged tweed, or the owner's own pattern drawn like tweed) is painted too (2026-11-13, his slate
   blue-grey tweed blazer): its colour with the tweed texture in the shading (asmTweedTile, like the linen's), its flecks in the second
   colour when it has one (a Donegal). A tweed read as a check (CHECK_PATS) stays with the band painter. */
const asmSuitTweed=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&patBase(i.pattern)==='tweed'&&!asmSuitBands(i);
function asmTweedTex(i){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
  return {c:new Float32Array(lin(colOf(i))),TW:1,TH:1,mm:10,linen:false,tweed:true,cloth:null,c2:COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null,fmix:.85}}
const asmSuitTexFor=async i=>asmSuitBands(i)?await asmSuitTex(i):asmSuitTwill(i)?asmTwillTex(i):asmSuitTweed(i)?asmTweedTex(i):null;
const asmSuitCut=i=>asmSuitBands(i)||asmSuitTwill(i)||asmSuitTweed(i);   // the cloth runs its own way on the sleeves (their zone pictures)
const asmSuitSig=i=>fnv64(['s'+ASM_SUITV,colOf(i),asmSuitTwill(i)?'tw|'+ASM_TWILL.amp+'|'+ASM_TWILL.mix+'|'+ASM_TWILL.fleck+'|'+(COLORS[i.secondaryColor]||'')+'|'+asmLinen(i)+(asmSuitWeave(i)==='herringbone'?'|hb'+ASM_HB_MM+'|'+ASM_HB_AMP+'|'+ASM_HB_RIB+'|'+ASM_HB_FLECK+'|'+ASM_HB_YARN+'|'+ASM_HB_BREAK+'|s'+ASM_HB_THIN+'|m'+ASM_HB_MOTTLE+'|f'+ASM_HB_FLOAT+'/'+ASM_HB_FLOATL+'|o'+ASM_HB_SOFT+'|g'+ASM_HB_GRAIN+'|n'+ASM_HB_SNAP+'|p'+ASM_HB_PBRK:''):'',asmSuitTweed(i)?'td|'+JSON.stringify(ASM_TWEED)+'|'+(COLORS[i.secondaryColor]||''):'',asmSuitBands(i)?settSig(usableSett(i))+'|'+JSON.stringify(asmClothOf(i,usableSett(i),ASM_SHIRT_MM/(usableSett(i).tr||1)))+'|'+(i.patternSpec?JSON.stringify([i.patternSpec.across,i.patternSpec.along]):''):''].join('|')).slice(0,10);
/* ---- patterned jackets (a windowpane, a check, a stripe read in bands: the owner's khaki windowpane blazer, 2026-11-12) are painted
   too, from the reading: one repeat of the app's own drawing (fabricDef) in the reading's colours, sized by its repeats across the
   jacket (ASM_SHIRT_MM / sett.tr at ASM_PX_MM), upright on the body and along the arm on each sleeve (the sleeve zone pictures, made
   with SAM like the others), each pixel's colour times the suit's shading. Lines are painted bold: no line narrower than ASM_LINE_PX
   at 2048 (widened into the ground beside it), and lines crossing the other way at full strength (fabricDef draws them at half, for a
   swatch); a 2% line on a 5 cm pane was 3 px and read faint. A linen jacket (material, or Claude's description of the cloth) gets a
   linen texture in its shading: threads two pixels wide, each a little lighter or darker, plain-woven, with slubs. */
const asmSuitBands=i=>{const s=usableSett(i);return !!(s&&s.v===2&&s.bands&&s.bands.length>1&&s.tr>0&&[...CHECK_PATS,...STRIPE_PATS].includes(patBase(i.pattern)))};   // stripes too, since they are drawn at their own width on a herringbone or twill (2026-11-13)
const asmLinen=i=>!!i&&(/linen/i.test(i.material||'')||/linen/i.test((i.patternSpec&&i.patternSpec.description)||i.patternText||''));
const ASM_LINE_PX=4;   // the narrowest painted line at 2048 (a windowpane's, a check's)
const ASM_STRIPE_PX=3;   // a stripe's: a pinstripe is about a millimetre (3 px), and at 4 the owner's navy pinstripe read heavy and white
/* a stripe suit's line and cloth as they read in a photo (fitted to the owner's navy pinstripe close-up, 2026-11-13, by a score of
   stripe spacing, width, contrast, colours, weave and brokenness region by region, lit and shadowed): Claude's line colour is the
   stripe's brightest yarn, but a pinstripe is a few yarns half-hidden in the twill and at this scale reads only a share (mix) of the way
   from the ground to it; soft (a Gaussian across, soft px at 2048, so about 2.5 mm wide and chalky, not a crisp 1 mm line); slightly broken
   along its length (its strength varies by up to brk, over blen px); the weave under it faint (weave, of the visible brightness: at .2
   the herringbone showed as a pattern of its own). A dark cloth (ground under 6% light) is also less saturated (chroma) and its
   shading steeper (gain * shading^gam): a dark navy worsted's folds go nearly black and its lit parts are greyish, not royal blue;
   the master's grey suit's shading is flatter. Before: crisp, bright, high-contrast lines on a bright royal blue. */
const ASM_STRIPE={mix:.18,soft:2,weave:.08,brk:.3,blen:8,chroma:.4,gam:1.4,gain:.9};
/* the cloth's own weave laid in the shading, from its material or Claude's description: linen (asmLinenTile), herringbone or twill
   (diagonal lines 4 px apart at 2048, 20% (twill 16%) of the visible brightness, with an 8% fleck along each thread; a herringbone's columns turn at each break, half a stripe repeat wide with its
   breaks on the stripes for a stripe, as on the owner's pinstripe, else 8 mm) -> {kind, cw, off, amp} in px at 2048, or null */
function asmClothOf(i,s,mm){const t=((i.patternSpec&&i.patternSpec.description)||i.patternText||'')+' '+(i.material||'')+' '+(i.pattern||'');
  if(asmLinen(i))return {kind:'linen'};
  const stripe=STRIPE_PATS.includes(patBase(i.pattern))&&s&&s.bands;
  if(/herringbone/i.test(t)){let cw=8*ASM_PX_MM,off=0;
    if(stripe){const rp=mm*ASM_PX_MM,g=s.bands.reduce((a,b)=>b[1]>a[1]?b:a)[0];let x=0,c=0;for(const b of s.bands){if(b[0]!==g){c=x+b[1]/2;break}x+=b[1]}cw=rp/2;off=c*rp}
    return {kind:'herringbone',cw,off,amp:stripe?ASM_STRIPE.weave:.2}}
  if(/twill|serge|gabardine/i.test(t))return {kind:'twill',amp:.16};
  return null}
/* the parts of a jacket whose cloth runs its own way: each sleeve (an upper arm and a forearm) and each lapel (one straight part: on the
   owner's windowpane blazer the panes run along the lapel, 2026-11-12); zone pictures made with SAM; the sleeves are needed, the lapels
   used when they are there */
const ASM_SLEEVES=['sleeveR','sleeveL'],ASM_LAPELS=['lapelR','lapelL'],ASM_CUTS=[...ASM_SLEEVES,...ASM_LAPELS];
const asmSleeveImgs=()=>{const o={};for(const s of ASM_SLEEVES){const r=renders[asmZoneKey(s)];if(!r)return null;o[s]=r.img}for(const s of ASM_LAPELS){const r=renders[asmZoneKey(s)];if(r)o[s]=r.img}return o};
/* (page side) the jacket's drawing, lines widened to ASM_LINE_PX at its painted size -> {c, TW, TH, mm (one repeat across), linen} */
const asmSuitTexMemo=new Map();
async function asmSuitTex(i){const k=asmSuitSig(i);if(asmSuitTexMemo.has(k))return asmSuitTexMemo.get(k);const s=usableSett(i),mm=ASM_SHIRT_MM/s.tr,px=mm*ASM_PX_MM;
  const bold=bands=>{if(!bands)return bands;const g=bands.reduce((a,b)=>b[1]>a[1]?b:a)[0],min=(STRIPE_PATS.includes(patBase(i.pattern))?ASM_STRIPE_PX:ASM_LINE_PX)/px,out=bands.map(b=>[b[0],b[1]]);let need=0;
      for(const b of out)if(b[0]&&b[0]!==g&&b[1]<min){need+=min-b[1];b[1]=min}
      const gw=out.filter(b=>!b[0]||b[0]===g).reduce((a,b)=>a+b[1],0);if(gw>need)for(const b of out)if(!b[0]||b[0]===g)b[1]*=1-need/gw;return out};
  // Claude's own colours, band by band, where the reading has them (the owner's choice, 2026-11-12): measured from the pixels, a thin
  // line is blurred into the ground and reads weak (his windowpane's off-white #e6ddcf for Claude's #eeeadf, its blue #a1bbd3 for #8eb2d6)
  const sp=i.patternSpec,cl=(bands,spec,cross)=>spec&&spec.bands&&spec.bands.length===bands.length?bands.map((b,k)=>[cross&&!b[0]?null:spec.bands[k].hex,b[1]]):bands;
  const stp=STRIPE_PATS.includes(patBase(i.pattern)),sb=cl(s.bands,sp&&sp.across,false),sc=s.cross?cl(s.cross.bands,sp&&sp.along,true):null;
  const it={...i,sett:{...s,bands:bold(sb),cross:s.cross?{...s.cross,bands:bold(sc)}:null}};
  const def=fabricDef('asmsuit',it,'blazer').replace(/ patternTransform="[^"]*"/,'').replace(/ opacity="\.5"/g,''),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');
  if(!w||!h)return null;const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#asmsuit)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,c=new Float32Array(3*TW*TH);
  for(let q=0;q<TW*TH;q++)for(let j=0;j<3;j++)c[3*q+j]=L[d[4*q+j]];
  const r={c,TW,TH,mm,linen:asmLinen(i),cloth:asmClothOf(i,s,mm)};
  if(stp){const bb=it.sett.bands,gb=bb.reduce((a,b)=>b[1]>a[1]?b:a),hx=String(gb[0]||'#000').replace('#',''),g=[0,2,4].map(q=>L[parseInt(hx.slice(q,q+2),16)||0]);
    let x0=0,lo=0;for(const b of bb){if(b!==gb&&b[0]){lo=(x0+b[1]/2)/bb.reduce((a,b)=>a+b[1],0);break}x0+=b[1]}
    const Z=ASM_STRIPE,dark=.2126*g[0]+.7152*g[1]+.0722*g[2]<.06,ch=dark?Z.chroma:1,chr=v=>{const Y=.2126*v[0]+.7152*v[1]+.0722*v[2];for(let q=0;q<3;q++)v[q]=Math.max(0,Y+ch*(v[q]-Y))};   // the stripe's place in the repeat (lo), the ground's colour (g)
    if(ch!==1){chr(g);const t=[0,0,0];for(let q=0;q<TW*TH;q++){for(let j=0;j<3;j++)t[j]=c[3*q+j];chr(t);for(let j=0;j<3;j++)c[3*q+j]=t[j]}}
    if(Z.soft>0){const sg=Z.soft*TW/(mm*ASM_PX_MM),R=Math.ceil(3*sg),kw=[];for(let o=-R;o<=R;o++)kw.push(Math.exp(-o*o/(2*sg*sg)));const ks=kw.reduce((a,b)=>a+b),t=new Float32Array(c.length);
      for(let y=0;y<TH;y++)for(let x=0;x<TW;x++)for(let j=0;j<3;j++){let a=0;for(let o=-R;o<=R;o++)a+=kw[o+R]*c[3*(y*TW+((x+o)%TW+TW)%TW)+j];t[3*(y*TW+x)+j]=a/ks}
      c.set(t)}
    Object.assign(r,{g,k:Z.mix,brk:Z.brk,blen:Z.blen,gam:dark?Z.gam:1,gain:dark?Z.gain:1,loff:lo})}if(asmSuitTexMemo.size>20)asmSuitTexMemo.clear();asmSuitTexMemo.set(k,r);return r}
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
/* a tweed texture, 512 px square, the same on every device (2026-11-13, the owner's slate blue-grey tweed blazer: a melange of mid,
   lighter and darker yarns, nubby, slightly crosshatched): r, each light factor around 1, and f, where a fleck is (0..1) for a second
   colour. Threads two pixels wide, plain-woven like the linen; along each thread the yarn's shade changes every few pixels (a melange:
   ASM_TWEED.yarn of the spread), short nubs (lighter or darker, 3-6 px), and rare flecks, light or dark, 2-3 px; spread ASM_TWEED.sd */
const ASM_TWEED={sd:.13,light:.35,dark:.2,nub:.2,fleck:.018,fleckL:.5};
let asmTweedMemo=null;
function asmTweedTile(){if(asmTweedMemo)return asmTweedMemo;const T=512,n=T/2,r=new Float32Array(T*T),f=new Float32Array(T*T),Z=ASM_TWEED;let seed=29;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296};
  // a melange: each short pick of yarn (1-3 px) is a light yarn (Z.light of them), a dark one (Z.dark) or the ground's; long runs
  // of one shade read as slubbed silk streaks (the first try, 2-7 px runs and 6 nubs a thread, 2026-11-13)
  const thread=()=>{const a=new Float32Array(T);let x=0;while(x<T){const len=1+Math.floor(rnd()*3),q=rnd(),v=q<Z.light?1:q<Z.light+Z.dark?-.7:0;for(let s=0;s<len&&x<T;s++)a[x++]=v}
    for(let k=0;k<3;k++){const at=Math.floor(rnd()*T),len=2+Math.floor(rnd()*3),v=(rnd()<.5?1:-1)*Z.nub;for(let s=0;s<len;s++)a[(at+s)%T]+=v*Math.sin(Math.PI*(s+.5)/len)}   // a few short nubs
    return a};
  const warp=[],weft=[];for(let k=0;k<n;k++){warp.push(thread());weft.push(thread())}
  for(let y=0;y<T;y++)for(let x=0;x<T;x++){const cx=x>>1,cy=y>>1,up=(cx+cy)%2===0;r[y*T+x]=up?warp[cx][y]:weft[cy][x]}
  let m=0,v=0;for(const a of r)m+=a;m/=r.length;for(const a of r)v+=(a-m)*(a-m);const sd=Math.sqrt(v/r.length)||1;for(let k=0;k<r.length;k++)r[k]=1+(r[k]-m)/sd*Z.sd;
  // flecks: a few in every hundred 2 px cells, light (most) or dark, 2-3 px across; f marks them for a second colour
  for(let cy=0;cy<n;cy++)for(let cx=0;cx<n;cx++){if(rnd()>Z.fleck)continue;const light=rnd()<.7,s=rnd()<.5?2:3;
    for(let a=0;a<s;a++)for(let b=0;b<s;b++){const k=((2*cy+a)%T)*T+(2*cx+b)%T;r[k]=light?1+Z.fleckL:1-Z.fleckL*.6;f[k]=1}}
  return asmTweedMemo={r,f,T}}
/* The jacket's parts whose cloth runs its own way -> {seg (0 = the body, upright; per pixel), segs:[…]}: a lapel ({m, one}) is one
   straight part along the whole lapel's long axis ({cs, sn, cx, cy}); a sleeve is one tube of cloth bent at the elbow ({poly, cum}).
   A sleeve's centre line: its two ends are the points of the sleeve furthest apart travelling inside it (the shoulder and the cuff);
   between them a straight line for the upper arm and one for the forearm, meeting at the elbow, rounded (below). Each point of the sleeve is then placed by how far along that line it is and how far to one side (asmTubeAt), so a stripe
   runs down the upper arm and round the elbow onto the forearm unbroken, and on the inside of the bend the cloth gathers into the crease.
   An elbow bent over ASM_CREASE_DEG instead has a crease right across (see below), and every part is a cylinder (asmTubeTabs).
   (Before: the sleeve was split into an upper arm and a forearm turned apart, and the owner's windowpane panes met in a broken line; then
   one line through both parts' axes, which misplaced the elbow on his right arm and ran the line back on itself.) Worked out on a copy at
   most 512 px. */
function asmSleeveSegs(masks,W,N){const seg=new Uint8Array(N),segs=[{cs:1,sn:0,cx:0,cy:0}],f=Math.max(1,Math.round(W/512)),S=Math.ceil(W/f),SS=S*S;
  for(const mm of masks){const mf=mm&&(mm.m||mm),one=!!(mm&&mm.one);if(!mf)continue;const base=segs.length;let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
    for(let k=0;k<N;k++){if(!mf[k])continue;const x=k%W,y=(k-x)/W;seg[k]=base;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y}
    if(!n)continue;const mx=sx/n,my=sy/n;
    if(one){const th=.5*Math.atan2(2*(sxy/n-mx*my),(sxx/n-mx*mx)-(syy/n-my*my))-Math.PI/2;segs.push({cs:Math.cos(th),sn:Math.sin(th),cx:mx,cy:my});continue}
    const m=new Uint8Array(SS);for(let y=0;y<S;y++)for(let x=0;x<S;x++)m[y*S+x]=mf[Math.min(W-1,y*f)*W+Math.min(W-1,x*f)]?1:0;
    const nb=k=>{const x=k%S,y=(k-x)/S,o=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<S&&yy<S&&m[yy*S+xx])o.push(yy*S+xx)}return o};
    const far=src=>{const d=new Int32Array(SS).fill(-1),q=new Int32Array(SS);let h=0,t=0,last=src;d[src]=0;q[t++]=src;while(h<t){const c=q[h++];last=c;for(const o of nb(c))if(d[o]<0){d[o]=d[c]+1;q[t++]=o}}return last};
    let s0=-1;for(let k=0;k<SS&&s0<0;k++)if(m[k])s0=k;if(s0<0)continue;const A=far(s0),B=far(A);
    // the upper arm and the forearm: the sleeve's cells ordered by their distance from the shoulder end travelling inside the sleeve, and
    // split where a straight line fits each side best (the least spread across the lines); a sleeve no better fitted by two lines than
    // by one stays straight. The elbow is where the two lines cross, at the outer corner of the bend, rounded. (A path along the middle
    // cut across the corner where the forearm crosses in front of the upper arm, and the forearm's stripes ran diagonally.)
    const dA=new Int32Array(SS).fill(-1),qq=new Int32Array(SS);{let h=0,t=0;dA[A]=0;qq[t++]=A;while(h<t){const c=qq[h++];for(const o of nb(c))if(dA[o]<0){dA[o]=dA[c]+1;qq[t++]=o}}}
    const maxd=Math.max(1,dA[B]),bins=Array.from({length:maxd+1},()=>[0,0,0,0,0,0]);
    for(let k=0;k<SS;k++){if(!m[k]||dA[k]<0)continue;const o=bins[Math.min(maxd,dA[k])],x=k%S+.5,y=Math.floor(k/S)+.5;o[0]++;o[1]+=x;o[2]+=y;o[3]+=x*x;o[4]+=y*y;o[5]+=x*y}
    const fit=o=>{if(o[0]<3)return null;const x=o[1]/o[0],y=o[2]/o[0],cxx=o[3]/o[0]-x*x,cyy=o[4]/o[0]-y*y,cxy=o[5]/o[0]-x*y,th=.5*Math.atan2(2*cxy,cxx-cyy),
        tr=cxx+cyy,det=cxx*cyy-cxy*cxy,lmin=tr/2-Math.sqrt(Math.max(0,tr*tr/4-det));return {x,y,dx:Math.cos(th),dy:Math.sin(th),err:lmin*o[0],r:Math.sqrt(3*Math.max(0,lmin))}};
    const pre=[[0,0,0,0,0,0]];for(const o of bins)pre.push(pre[pre.length-1].map((v,j)=>v+o[j]));const sum=(a,b)=>pre[b].map((v,j)=>v-pre[a][j]);
    const all=fit(sum(0,maxd+1));let best=null;
    for(let sp=Math.round(maxd*.25);sp<=Math.round(maxd*.75);sp++){const u=fit(sum(0,sp)),l=fit(sum(sp,maxd+1));if(!u||!l)continue;const e=u.err+l.err;if(!best||e<best.e)best={e,u,l}}
    const cell=k=>[k%S+.5,Math.floor(k/S)+.5],onto=(L,p)=>{const t=(p[0]-L.x)*L.dx+(p[1]-L.y)*L.dy;return [L.x+L.dx*t,L.y+L.dy*t]},sc=p=>[p[0]*f,p[1]*f];
    let pts;const bent=best&&all&&best.e<all.err*.8&&Math.abs(best.u.dx*best.l.dy-best.u.dy*best.l.dx)>.25;
    // a real elbow (bent over ASM_CREASE_DEG): the forearm lies in front, and the upper arm's cloth ends in a crease across the sleeve
    // from the crook (the inside corner) out to the elbow, half way between square to the upper arm and along the forearm (the target
    // photo and the master both: the upper arm's stripes stop at the forearm's top fold, the forearm's run on to the elbow's edge)
    if(bent){const sA=cell(A)[1]<cell(B)[1],Up=sA?best.u:best.l,Lo=sA?best.l:best.u,S0=sc(cell(sA?A:B)),C0=sc(cell(sA?B:A)),dn=Up.dx*Lo.dy-Up.dy*Lo.dx,
        t0=((Lo.x-Up.x)*Lo.dy-(Lo.y-Up.y)*Lo.dx)/dn,E=[(Up.x+Up.dx*t0)*f,(Up.y+Up.dy*t0)*f],nrm=v=>{const l=Math.hypot(v[0],v[1])||1;return [v[0]/l,v[1]/l]};
      let ud=[Up.dx,Up.dy],ld=[Lo.dx,Lo.dy];if((E[0]-S0[0])*ud[0]+(E[1]-S0[1])*ud[1]<0)ud=[-ud[0],-ud[1]];if((C0[0]-E[0])*ld[0]+(C0[1]-E[1])*ld[1]<0)ld=[-ld[0],-ld[1]];
      const cb=ud[0]*ld[0]+ud[1]*ld[1];
      if(cb<Math.cos(ASM_CREASE_DEG*Math.PI/180)){
        const mk=(pU,ud,rU,pL,ld,rL)=>{const cb=ud[0]*ld[0]+ud[1]*ld[1],nU=nrm([cb*ud[0]-ld[0],cb*ud[1]-ld[1]]),nL=nrm([ud[0]-cb*ld[0],ud[1]-cb*ld[1]]);   // outward normals
          // the crook: where the upper arm's and the forearm's inside edges meet
          const b1=nU[0]*pU[0]+nU[1]*pU[1]-rU,b2=nL[0]*pL[0]+nL[1]*pL[1]-rL,dd=nU[0]*nL[1]-nU[1]*nL[0],K=Math.abs(dd)>.2?[(b1*nL[1]-b2*nU[1])/dd,(nU[0]*b2-nL[0]*b1)/dd]:E;
          const q=nrm([nU[0]-ld[0],nU[1]-ld[1]]);let mv=[-q[1],q[0]];if(mv[0]*(C0[0]-K[0])+mv[1]*(C0[1]-K[1])<0)mv=[-mv[0],-mv[1]];
          return asmTubeTabs({crease:{x:K[0],y:K[1],mx:mv[0],my:mv[1],r0:rU,r1:rL},parts:[{x:pU[0],y:pU[1],dx:ud[0],dy:ud[1],nx:nU[0],ny:nU[1]},{x:pL[0],y:pL[1],dx:ld[0],dy:ld[1],nx:nL[0],ny:nL[1]}]},mf,W,N)};
        let g=mk([Up.x*f,Up.y*f],ud,Up.r*f,[Lo.x*f,Lo.y*f],ld,Lo.r*f);
        // the fitted lines straightened by the middles of the cloth across (the forearm's line took in some of the elbow), then the parts again
        const re=p=>{const t=p.t;if(!t)return [[p.x,p.y],[p.dx,p.dy],0];const hs=Array.from(t.R).sort((a,b)=>a-b),med=hs[hs.length>>1];let n=0,sa=0,sc2=0,saa=0,sac=0;
          for(let i=Math.floor(t.n*.15);i<Math.ceil(t.n*.85);i++){const a=t.a0+(i+.5)*t.bs,c=t.c[i];n++;sa+=a;sc2+=c;saa+=a*a;sac+=a*c}
          const sl=n>2?(n*sac-sa*sc2)/Math.max(1e-6,n*saa-sa*sa):0,c0=n?(sc2-sl*sa)/n:0,d=nrm([p.dx+sl*p.nx,p.dy+sl*p.ny]);return [[p.x+c0*p.nx,p.y+c0*p.ny],d,med]};
        for(let it=0;it<2;it++){const a=re(g.parts[0]),b=re(g.parts[1]);g=mk(a[0],a[1],a[2]||Up.r*f,b[0],b[1],b[2]||Lo.r*f)}
        segs.push(asmSleeveFlow(g));continue}}
    if(bent){const U=best.u,Lw=best.l,den=U.dx*Lw.dy-U.dy*Lw.dx,t=((Lw.x-U.x)*Lw.dy-(Lw.y-U.y)*Lw.dx)/den,E=[U.x+U.dx*t,U.y+U.dy*t],P0=onto(U,cell(A)),P2=onto(Lw,cell(B));
      const r=Math.min(.35*Math.hypot(P0[0]-E[0],P0[1]-E[1]),.35*Math.hypot(P2[0]-E[0],P2[1]-E[1]),30),tw=(P,d)=>{const l=Math.hypot(P[0]-E[0],P[1]-E[1])||1;return [E[0]+(P[0]-E[0])/l*d,E[1]+(P[1]-E[1])/l*d]},Q1=tw(P0,r),Q2=tw(P2,r);
      pts=[P0,Q1];for(let s2=1;s2<16;s2++){const u=s2/16,v=1-u;pts.push([v*v*Q1[0]+2*v*u*E[0]+u*u*Q2[0],v*v*Q1[1]+2*v*u*E[1]+u*u*Q2[1]])}pts.push(Q2,P2)}
    else if(all)pts=[onto(all,cell(A)),onto(all,cell(B))];else continue;
    pts=pts.map(sc);
    const ext=(a,b)=>{const dx=a[0]-b[0],dy=a[1]-b[1],l=Math.hypot(dx,dy)||1,d=400*W/ASM_SIZE;return [a[0]+dx/l*d,a[1]+dy/l*d]};
    pts.unshift(ext(pts[0],pts[1]));pts.push(ext(pts[pts.length-1],pts[pts.length-2]));
    const poly=new Float32Array(pts.flat()),cum=new Float32Array(pts.length);for(let q=1;q<pts.length;q++)cum[q]=cum[q-1]+Math.hypot(pts[q][0]-pts[q-1][0],pts[q][1]-pts[q-1][1]);
    segs.push(asmTubeTabs({parts:[{poly,cum}]},mf,W,N))}
  return {seg,segs}}
/* the stripes' path over the body (the fronts and the waistcoat): a stripe-flow template learned from the owner's target photo of a
   navy pinstripe three-piece (every stripe traced by ridge tracking, `pinbench/b2/tools`), as the stripes' outward slope dx/dy
   (positive = a stripe moves away from the body's midline going down) on a grid in body units: |u| = distance from the midline,
   v = height below the shoulder line, both in half shoulder widths (|u| 0..1 by .1, v -0.2..2.8 by .1, rows by v; past the grid the
   edge values hold). Read off it: the stripes lean in toward the neck at the shoulders (0.15), straighten by mid chest, close in
   toward the waist round the darts (-0.13 at v 1.2, |u| .7) while those nearer the front edge open out, and spread out over the hips
   (0.1-0.17). The same numbers fitted the master's proportions (its waist button at v 1.66, the target's at 1.60) */
const ASM_FLOW={nu:11,nv:31,v0:-.2,d:.1,s:[2,3,3,5,7,11,15,18,17,13,10,2,2,3,4,7,11,17,20,18,13,8,2,2,2,3,6,11,17,19,17,12,6,2,2,2,2,3,9,14,16,15,11,7,1,1,1,-1,0,5,11,13,12,10,9,1,1,0,-1,-1,4,9,11,10,8,9,1,1,0,-1,2,6,9,10,8,5,5,2,1,0,-1,3,7,9,9,5,2,3,2,2,1,1,4,7,8,6,3,2,3,3,3,2,3,5,7,6,3,1,2,4,4,4,4,5,6,6,3,-1,-2,2,5,5,5,6,7,6,4,-1,-6,-7,-2,3,6,7,8,9,6,1,-6,-11,-12,-8,-3,7,8,9,9,6,-1,-9,-14,-15,-11,-6,7,8,9,8,4,-4,-11,-15,-15,-10,-6,7,7,7,6,2,-5,-12,-15,-14,-9,-5,6,6,6,3,-1,-7,-11,-13,-12,-6,-2,6,6,5,2,-2,-6,-9,-10,-7,-2,2,5,6,5,2,-1,-3,-4,-4,1,5,7,3,4,5,4,3,1,1,3,7,11,13,1,1,2,4,5,5,5,6,10,15,17,-1,-2,0,4,6,6,7,9,13,17,19,0,-1,0,4,6,8,10,13,16,18,19,3,2,3,5,6,8,11,14,16,17,17,7,7,7,7,7,8,10,13,15,16,16,10,10,10,9,8,8,10,12,14,15,16,13,13,12,10,9,9,11,13,14,14,14,14,14,13,11,10,10,11,13,14,14,14,15,15,14,12,10,10,11,12,13,13,13,15,16,15,13,11,10,11,12,12,12,12,15,15,15,13,11,11,11,11,12,12,12]};
/* the body's frame from the master's own zones: the shoulder points are the tops of the two sleeve zones, the midline half way between
   them, the unit half the distance, the shoulder line the jacket zone's top at the shoulder points. From the template: D = the slope
   summed down each column (the stripe's sideways shift, its mean over the body taken out so the stripes keep their spacing on average)
   and G = the slope summed out along each row (the cross lines of a check or windowpane bend with it, square to the stripes). null
   without both sleeve zones (the body stays upright) */
function asmBodyFlow(zj,masks,W,H){const tops=[];for(const mm of masks||[]){if(!mm||mm.one)continue;const m=mm.m||mm;let k=0;const N=W*H;while(k<N&&!m[k])k++;if(k<N)tops.push(k%W)}
  if(tops.length!==2)return null;tops.sort((a,b)=>a-b);const hw=(tops[1]-tops[0])/2;if(hw<W*.15)return null;
  let ys=0,n=0;for(const x0 of tops)for(let x=x0-3;x<=x0+3;x++){let y=0;while(y<H&&!zj[y*W+x])y++;if(y<H){ys+=y;n++}}if(!n)return null;
  const F=ASM_FLOW,NU=F.nu,NV=F.nv,s=F.s.map(v=>v/100),D=new Float32Array(NU*NV),G=new Float32Array(NU*NV);
  for(let i=0;i<NU;i++){let c=0,m=0,q=0;for(let j=0;j<NV;j++){if(j)c+=.5*(s[j*NU+i]+s[(j-1)*NU+i])*F.d;D[j*NU+i]=c;const v=F.v0+j*F.d;if(v>=0&&v<=2.6){m+=c;q++}}for(let j=0;j<NV;j++)D[j*NU+i]-=m/q}
  for(let j=0;j<NV;j++){let c=0;for(let i=0;i<NU;i++){if(i)c+=.5*(s[j*NU+i]+s[j*NU+i-1])*F.d;G[j*NU+i]=c}}
  return {mid:(tops[0]+tops[1])/2,hw,ysh:ys/n,D,G}}
/* a body pixel's [across, along] (px) in the stripe flow */
function asmFlowAt(f,X,Y){const F=ASM_FLOW,NU=F.nu,NV=F.nv,u=(X-f.mid)/f.hw,au=u<0?-u:u;let x=au/F.d,y=((Y-f.ysh)/f.hw-F.v0)/F.d;if(x>NU-1)x=NU-1;if(y<0)y=0;if(y>NV-1)y=NV-1;
  const i=Math.min(NU-2,x|0),j=Math.min(NV-2,y|0),fx=x-i,fy=y-j,k=j*NU+i,w00=(1-fx)*(1-fy),w01=fx*(1-fy),w10=(1-fx)*fy,w11=fx*fy,
    d=f.D[k]*w00+f.D[k+1]*w01+f.D[k+NU]*w10+f.D[k+NU+1]*w11,g=f.G[k]*w00+f.G[k+1]*w01+f.G[k+NU]*w10+f.G[k+NU+1]*w11;
  return [X-(u<0?-1:1)*f.hw*d,Y+f.hw*g]}
const ASM_CREASE_DEG=30;   // a sleeve bent further than this has an elbow crease (below it, one tube bent round a rounded line)
const ASM_TUBE_K=1.15;   // a sleeve seen as a cylinder: the cloth at its edges turns away, the stripes there closer together; the cylinder's
                         // radius is this times half the sleeve's width (1: the edge exactly side-on, stripes squeezed to nothing)
/* a point's place on a polyline (the nearest point) -> [across (signed, px), along (px)] */
function asmPolyAt(g,X,Y){const p=g.poly,n=p.length/2;let best=Infinity,u=0,v=0;
  for(let q=0;q<n-1;q++){const ax=p[2*q],ay=p[2*q+1],dx=p[2*q+2]-ax,dy=p[2*q+3]-ay,l2=dx*dx+dy*dy||1;let t=((X-ax)*dx+(Y-ay)*dy)/l2;t=t<0?0:t>1?1:t;
    const px=ax+dx*t,py=ay+dy*t,d2=(X-px)*(X-px)+(Y-py)*(Y-py);if(d2<best){best=d2;const l=Math.sqrt(l2);u=((X-ax)*dy-(Y-ay)*dx)/l;v=g.cum[q]+t*l}}
  return [u,v]}
/* which part a point is: past the crease the forearm, before it the upper arm; but a point on a part's inside (towards the other part)
   over 1.3 of its half width from its line belongs to the other one (the forearm's top edge by the cuff is not upper arm, nor is the
   upper arm's inside below the crook forearm) */
const asmTubePart=(g,X,Y)=>{const k=g.crease;if(!k)return g.parts[0];const U=g.parts[0],L=g.parts[1];
  return (X-k.x)*k.mx+(Y-k.y)*k.my>0?((X-L.x)*L.nx+(Y-L.y)*L.ny<-1.3*k.r1?U:L):((X-U.x)*U.nx+(Y-U.y)*U.ny<-1.3*k.r0?L:U)};
const asmTubeRaw=(p,X,Y)=>{if(p.poly)return asmPolyAt(p,X,Y);const dx=X-p.x,dy=Y-p.y;return [dx*p.nx+dy*p.ny,dx*p.dx+dy*p.dy]};
/* each part's width along its length, from the sleeve's own outline: every 8 px (at 2048) along it, the middle of the cloth across (c)
   and half its width (R), kept within 0.7–1.2 of the part's usual half width (a seam, a hand or the crease cuts the outline short) and
   smoothed over about 40 px either way; the middle follows the arm's real line where the fitted straight line misses it */
function asmTubeTabs(g,mf,W,N){const bs=Math.max(2,Math.round(W/256)),sm=Math.max(1,Math.round(W/51/bs)),np=g.parts.length,amin=new Array(np).fill(Infinity),amax=new Array(np).fill(-Infinity);
  for(let k=0;k<N;k++){if(!mf[k])continue;const x=k%W+.5,y=(k-k%W)/W+.5,pi=g.parts.length>1&&asmTubePart(g,x,y)===g.parts[1]?1:0,a=asmTubeRaw(g.parts[pi],x,y)[1];if(a<amin[pi])amin[pi]=a;if(a>amax[pi])amax[pi]=a}
  const T=g.parts.map((p,pi)=>{if(!(amax[pi]>=amin[pi]))return null;const n=Math.floor((amax[pi]-amin[pi])/bs)+1;return {a0:amin[pi],bs,n,lo:new Float32Array(n).fill(Infinity),hi:new Float32Array(n).fill(-Infinity),ct:new Int32Array(n)}});
  for(let k=0;k<N;k++){if(!mf[k])continue;const x=k%W+.5,y=(k-k%W)/W+.5,pi=g.parts.length>1&&asmTubePart(g,x,y)===g.parts[1]?1:0,t=T[pi];if(!t)continue;const r=asmTubeRaw(g.parts[pi],x,y),i=Math.min(t.n-1,Math.floor((r[1]-t.a0)/bs));
    if(r[0]<t.lo[i])t.lo[i]=r[0];if(r[0]>t.hi[i])t.hi[i]=r[0];t.ct[i]++}
  g.parts.forEach((p,pi)=>{const t=T[pi];if(!t)return;const n=t.n,ok=[];for(let i=0;i<n;i++)if(t.ct[i]>=2)ok.push(i);if(!ok.length)return;
    const hw=ok.map(i=>(t.hi[i]-t.lo[i])/2).sort((a,b)=>a-b),med=hw[hw.length>>1]||1,c=new Float32Array(n),R=new Float32Array(n);let j=0;
    // a cross-section much narrower than usual is cut short (the shoulder's point, the cuff under the hand, the crease): it takes the
    // nearest full one's, so the stripes run on straight and the outline cuts them
    const full=ok.filter(i=>t.hi[i]-t.lo[i]>=1.5*med);if(full.length)ok.splice(0,ok.length,...full);
    for(let i=0;i<n;i++){while(j<ok.length-1&&Math.abs(ok[j+1]-i)<=Math.abs(ok[j]-i))j++;const s=ok[j],h=(t.hi[s]-t.lo[s])/2;c[i]=(t.hi[s]+t.lo[s])/2;R[i]=h<.7*med?.7*med:h>1.2*med?1.2*med:h}
    const box=(a,sm)=>{for(let rep=0;rep<2;rep++){const b=Float32Array.from(a);for(let i=0;i<n;i++){let s=0,m=0;for(let d=-sm;d<=sm;d++){const ii=i+d;if(ii>=0&&ii<n){s+=b[ii];m++}}a[i]=s/m}}};
    for(let i=0;i<n;i++)c[i]=Math.max(-.35*med,Math.min(.35*med,c[i]));box(c,3*sm);box(R,sm);
    p.t={a0:t.a0,bs,n,c,R}});
  return g}
/* the stripes' path along a bent sleeve (2026-11-13): learned from the owner's target photo as ASM_FLOW was for the body (every stripe
   on both sleeves traced by ridge tracking along each arm part, `pinbench/s1/tools`), less what the cylinders already give, as the
   stripes' outward drift per length along the part (dx/dy, + = toward the outer side, away from the other part, going from the
   shoulder to the elbow on the upper arm and from the elbow to the cuff on the forearm), x100, on s = 0..1 along (rows, by .1) and
   t = -1..1 across (the inside edge to the outside edge, by .5, in half widths). X: an arm bent over 60° (the forearm across the body),
   H: one bent less (the arm hanging). Read off it: on the arm across the body the forearm's stripes leave the elbow curving and lean
   out about 0.1 toward the cuff, the upper arm's outer stripes fan out under the shoulder and close in toward the elbow; on the
   hanging arm the forearm's stripes come out of the bend still turned toward the upper arm (0.25-0.3, the bend taken gently rather
   than at the crease) and the upper arm's lean out toward the elbow (0.1-0.2) */
const ASM_SLEEVE_FLOW={ns:11,nt:5,X:{u:[-3,-4,0,10,17,-3,-4,-1,9,16,0,-4,-2,8,15,2,-3,-1,7,13,-1,-3,1,7,10,-8,-4,2,6,6,-12,-6,1,2,2,-12,-7,-3,-3,-3,-7,-5,-4,-5,-5,0,2,4,1,-3,4,8,13,10,1],f:[-12,-12,1,7,4,-12,-12,4,9,3,-12,-12,8,9,3,-4,4,11,9,4,14,14,11,8,6,20,14,9,8,9,17,10,6,8,10,10,7,7,9,11,6,7,8,12,14,6,7,9,14,18,6,7,9,14,20]},H:{u:[20,17,15,17,21,18,13,9,14,20,11,5,2,9,18,-3,-5,-4,5,15,-12,-12,-8,0,10,-12,-12,-8,-3,4,-12,-9,-2,-1,4,-4,6,9,7,9,12,18,18,14,14,18,23,22,17,17,19,23,23,17,17],f:[-6,9,30,30,30,-6,9,30,30,30,-6,9,27,30,28,-8,6,20,20,14,-12,0,10,8,4,-12,-4,8,7,5,-12,2,15,17,14,3,12,23,25,23,12,18,24,26,26,14,18,22,25,28,14,17,20,23,28]}};
const ASM_FORE_K=1.15;   // the forearm lies nearer the camera than the upper arm: its stripes (and panes) this much larger (target: 22-23 px apart on the forearms, 18-20 on the upper arms)
/* a creased sleeve's parts get the flow (their drift summed along: D, in part lengths; and across: G, in half widths, so a windowpane's
   cross lines stay square to its stripes) and the forearm its scale */
function asmSleeveFlow(g){if(!g.crease||g.parts.length<2)return g;const U=g.parts[0],L=g.parts[1],F=ASM_SLEEVE_FLOW,NS=F.ns,NT=F.nt,ds=1/(NS-1),dt=2/(NT-1);
  const T=F[U.dx*L.dx+U.dy*L.dy<.5?'X':'H'];
  [[U,T.u,1],[L,T.f,ASM_FORE_K]].forEach(([p,tab,k])=>{const s=tab.map(v=>v/100),D=new Float32Array(NS*NT),G=new Float32Array(NS*NT),m=(NT-1)/2;
    for(let j=0;j<NT;j++){let c=0;for(let i=0;i<NS;i++){if(i)c+=.5*(s[i*NT+j]+s[(i-1)*NT+j])*ds;D[i*NT+j]=c}}
    for(let i=0;i<NS;i++){let c=0;for(let j=m+1;j<NT;j++){c+=.5*(s[i*NT+j]+s[i*NT+j-1])*dt;G[i*NT+j]=c}c=0;for(let j=m-1;j>=0;j--){c-=.5*(s[i*NT+j]+s[i*NT+j+1])*dt;G[i*NT+j]=c}}
    p.fd={D,G,k}});
  return g}
/* a point's place on a sleeve -> [across (px of cloth, from the middle; the cylinder turned flat), along (px)]: its part (the upper arm
   or, past the crease, the forearm), its place across and along that part, moved by the part's stripe flow (asmSleeveFlow), and
   across, the cloth turned flat (a point at x of a cylinder of radius R from its middle is R·asin(x/R) of cloth from it) */
function asmTubeAt(g,X,Y){const p=asmTubePart(g,X,Y),r=asmTubeRaw(p,X,Y),t=p.t;if(!t)return r;
  let f=(r[1]-t.a0)/t.bs-.5;f=f<0?0:f>t.n-1?t.n-1:f;const i=Math.floor(f),j=Math.min(t.n-1,i+1),w=f-i,c=t.c[i]*(1-w)+t.c[j]*w,Rh=t.R[i]*(1-w)+t.R[j]*w,R=Rh*ASM_TUBE_K;
  let dx=r[0]-c,al=r[1],k=1;const fd=p.fd;
  if(fd){const F=ASM_SLEEVE_FLOW,NS=F.ns,NT=F.nt,Ln=t.n*t.bs;let a=(r[1]-t.a0)/Ln*(NS-1),b=(dx/Rh+1)*(NT-1)/2;a=a<0?0:a>NS-1?NS-1:a;b=b<0?0:b>NT-1?NT-1:b;
    const i0=Math.min(NS-2,a|0),j0=Math.min(NT-2,b|0),fa=a-i0,fb=b-j0,q=i0*NT+j0,lk=T=>(T[q]*(1-fb)+T[q+1]*fb)*(1-fa)+(T[q+NT]*(1-fb)+T[q+NT+1]*fb)*fa;
    dx-=Ln*lk(fd.D);al+=Rh*lk(fd.G);k=fd.k}
  const x=dx/R,ax=Math.abs(x);   // past 0.95 of the radius (a bulge wider than the sleeve's usual width) the cloth carries on at the slope there
  return [(ax<.95?R*Math.asin(x):Math.sign(x)*R*(1.2532+(ax-.95)*3.2026))/k,al/k]}
/* the colour-free part, once per base picture and calibration: the pixels to paint and their shading. base: the master, or the
   waistcoat master on a waistcoat day; zj: the jacket zone; zv, cv (waistcoat days): the waistcoat zone and its calibration photo */
function asmSuitPrep(base,cj,zj,zv,cv,sleeves){const P=asmSuitPrep0(base,cj,zj,zv,cv);if(sleeves&&sleeves.length){const s=asmSleeveSegs(sleeves,base.width,base.width*base.height);P.seg=s.seg;P.segs=s.segs;P.flow=asmBodyFlow(zj,sleeves,base.width,base.height);
    // the painted ring just outside the jacket's zone takes the part beside it: as the body's, it put short upright dashes along a sleeve's edge
    const W=base.width,sg=s.seg;let todo=[];for(const k of P.idx)if(!zj[k]&&!sg[k])todo.push(k);
    for(let it=0;it<8&&todo.length;it++){const set=[],left=[];for(const k of todo){const x=k%W,v=x>0&&sg[k-1]||x<W-1&&sg[k+1]||k>=W&&sg[k-W]||sg[k+W]||0;if(v)set.push(k,v);else left.push(k)}
      for(let q=0;q<set.length;q+=2)sg[set[q]]=set[q+1];todo=left}}
  return P}
function asmSuitPrep0(base,cj,zj,zv,cv){const W=base.width,N=W*base.height,L=ASM_LIN,B=base.data,Y=(d,j)=>.2126*L[d[j]]+.7152*L[d[j+1]]+.0722*L[d[j+2]];
  const own=zv?zj.map((v,k)=>v||zv[k]):zj,E=asmPx(ASM_EDGE_P,W),ring=asmBox(own,W,E,true),kind=new Uint8Array(N);let n=0;
  for(let k=0;k<N;k++){if(zv&&zv[k])kind[k]=3;else if(zj[k])kind[k]=1;else if(ring[k])kind[k]=2;if(kind[k])n++}
  const pct=(d,want)=>{const v=[];for(let k=0;k<N;k+=5)if(kind[k]===want)v.push(Y(d,4*k));v.sort((a,b)=>a-b);return v[Math.floor(v.length*.75)]||1};
  // The base's own light is read against ONE lit level for the jacket and the waistcoat (the waistcoat's own level stepped the
  // shading along the zones' boundary, a staircase of the zone's pixels where the lapel lies over the waistcoat).
  // A calibration photo's light counts only where it shows its own flat colour, away from its edge (feathered over 2px): the
  // waistcoat's orange is painted flat with a dark, ragged rim of its own, a pixel or two off the waistcoat master's edge, and averaged
  // in it drew a dark ragged line along every edge of the waistcoat (and the red jacket's rim against the wall a light one)
  const Rm=pct(B,1),Rc=pct(cj.data,1),Rcv=zv&&cv?pct(cv.data,3):1,rel=new Float32Array(N);
  const chrom=(d,want,R)=>{let sr=0,sg=0,c=0;for(let k=0;k<N;k+=5)if(kind[k]===want){const j=4*k,r=L[d[j]],g=L[d[j+1]],b=L[d[j+2]],s=r+g+b+1e-6;sr+=r/s;sg+=g/s;c++}
    const mr=sr/(c||1),mg=sg/(c||1);for(let k=0;k<N;k++)if(kind[k]===want){const j=4*k,r=L[d[j]],g=L[d[j+1]],b=L[d[j+2]],s=r+g+b+1e-6;if(Math.hypot(r/s-mr,g/s-mg)<.06&&Y(d,j)>.2*R)rel[k]=1}};
  chrom(cj.data,1,Rc);if(zv&&cv)chrom(cv.data,3,Rcv);
  const rw=asmBlurF(rel,W,asmPx(2,W));for(let k=0;k<N;k++)rw[k]=rw[k]>.7?(rw[k]-.7)/.3:0;   // feathered, and none within about a pixel of the edge
  const bb=new Float32Array(N);for(let k=0;k<N;k++)if(ring[k]&&!own[k])bb[k]=1;const bf=asmBlurF(bb,W,2),band=new Uint8Array(N);for(let k=0;k<N;k++)if(bf[k]>0)band[k]=1;const near=asmNear(own,W,band).s,out=new Uint8Array(N);for(let k=0;k<N;k++)if(!own[k]&&!ring[k])out[k]=1;const far=asmNear(out,W,band).s;
  // where the calibration doesn't count, the base's own light smoothed over the cloth stands in for it (its own light alone gave the
  // edges twice the grain of the cloth beside them: a speckled band along the waistcoat's edge)
  const mo=new Float32Array(N),oo=new Float32Array(N);for(let k=0;k<N;k++)if(own[k]){mo[k]=Y(B,4*k)/Rm;oo[k]=1}
  const mb=asmBlurF(mo,W,asmPx(2,W)),ob=asmBlurF(oo,W,asmPx(2,W));
  const idx=new Int32Array(n),sh=new Float32Array(n),ea=new Float32Array(n),bg=new Int32Array(n),qk=new Int32Array(N).fill(-1);let q=0;
  for(let k=0;k<N;k++){const t=kind[k];if(!t)continue;const j=4*k,m=Y(B,j)/Rm,c=t===3?(cv?Y(cv.data,j)/Rcv:m):t===1?Y(cj.data,j)/Rc:m,w=t===2?0:rw[k],f=ob[k]>.01?mb[k]/ob[k]:m;let s=.5*(m+w*c+(1-w)*f);
    idx[q]=k;sh[q]=s<.05?.05:s>1.6?1.6:s;ea[q]=1;bg[q]=k;qk[k]=q;q++}
  // the jacket's soft edge (ASM_EDGE_P past its zone): the master's out-of-focus outline is a blend of its cloth and what lies beyond
  // (the wall, a hand); left as it was, the master's grey half of it was a pale rim round a brown jacket. Each pixel there is the
  // painted cloth (lit as the zone's nearest pixel) over the base's pixel beyond the edge, in the share its colour shows: where it lies
  // on the line from that pixel's colour to the cloth's (linear light). Beyond a colour like the cloth's the old 3px rule decides.
  const E0=asmPx(ASM_EDGE,W),SO=new Float32Array(N);for(let q=0;q<n;q++)if(kind[idx[q]]!==2)SO[idx[q]]=sh[q];const SB=asmBlurF(SO,W,asmPx(2,W));   // the edge lit as the cloth beside it, smoothed: the nearest pixel's own light, copied outward, drew hair-like streaks
  for(let q=0;q<n;q++){const k=idx[q];if(kind[k]!==2)continue;const c=near[k],b=far[k];if(c<0)continue;sh[q]=ob[c]>.01?SB[c]/ob[c]:sh[qk[c]];
    const cx=c%W,cy=(c-cx)/W;let C=[0,0,0],cn=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=cx+dx,yy=cy+dy;if(xx<0||yy<0||xx>=W||yy*W+xx>=N)continue;const p=yy*W+xx;if(!own[p])continue;for(let e=0;e<3;e++)C[e]+=L[B[4*p+e]];cn++}
    C=C.map(v=>v/cn);const x=k%W,y=(k-x)/W,dd=Math.hypot(x-cx,y-cy);let a;
    if(b<0)a=1;else{const G=[0,1,2].map(e=>L[B[4*b+e]]),P=[0,1,2].map(e=>L[B[4*k+e]]),D=[C[0]-G[0],C[1]-G[1],C[2]-G[2]],dl=D[0]*D[0]+D[1]*D[1]+D[2]*D[2];
      if(dl<4e-3)a=dd<=E0?1:0;else{a=((P[0]-G[0])*D[0]+(P[1]-G[1])*D[1]+(P[2]-G[2])*D[2])/dl;a=a<0?0:a>1?1:a}bg[q]=b}
    ea[q]=a}
  // each pixel's share decided alone was a hairy edge (the master's weave is light and dark flecks), and harder than the master's
  // blur (its cloth darkens toward the edge, which reads as all cloth): the shares are smoothed over 2px (the zone counts as cloth)
  const A=new Float32Array(N);for(let k=0;k<N;k++)if(own[k])A[k]=1;for(let q=0;q<n;q++)if(kind[idx[q]]===2)A[idx[q]]=ea[q];
  const As=asmBlurF(A,W,asmPx(1,W));for(let q=0;q<n;q++)if(kind[idx[q]]===2)ea[q]=Math.min(ea[q],As[idx[q]]);
  return {base,idx,sh,ea,bg}}
/* the painted suit's soft edge laid over what lies beyond it (asmSuitPrep0's ea, bg); the picture says how far its edge reaches */
function asmSuitEdge(P,img){const d=img.data,B=P.base.data,L=ASM_LIN,gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  if(P.ea)for(let q=0;q<P.idx.length;q++){const a=P.ea[q];if(a>=1)continue;const j=4*P.idx[q],b=4*P.bg[q];for(let c=0;c<3;c++)d[j+c]=Math.round(gam(a*L[d[j+c]]+(1-a)*L[B[b+c]]))}
  img.edge=ASM_EDGE_P;return img}
/* the base picture with a patterned jacket painted (an ImageData): T from asmSuitTex; each pixel the drawing's colour (bilinear, 2x2
   points a pixel) in its part's direction, times its shading, and the linen texture's light when the cloth is linen */
function asmSuitPaintTex(P,T){const W=P.base.width,L=ASM_LIN,d=new Uint8ClampedArray(P.base.data),rep=T.mm*ASM_PX_MM*W/ASM_SIZE,repv=rep*T.TH/T.TW,cm=[0,0,0],
    gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},lin=T.linen?asmLinenTile():T.tweed?asmTweedTile():null,ls=W/ASM_SIZE;
  const at=(u,v)=>{const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
    for(let q=0;q<3;q++){const G=(a,b)=>T.c[3*(((b+T.TH)%T.TH)*T.TW+(a+T.TW)%T.TW)+q];cm[q]+=(G(x0,y0)*(1-fx)+G(x0+1,y0)*fx)*(1-fy)+(G(x0,y0+1)*(1-fx)+G(x0+1,y0+1)*fx)*fy}};
  const body={cs:1,sn:0,cx:0,cy:0},fl=P.flow,b0=P.segs&&P.segs[0],uv=(g,X,Y)=>g.parts?asmTubeAt(g,X,Y):fl&&(g===body||g===b0)?asmFlowAt(fl,X,Y):[(X-g.cx)*g.cs+(Y-g.cy)*g.sn,(Y-g.cy)*g.cs-(X-g.cx)*g.sn];   // across, along (px); the body follows the stripe flow
  const st=T.k!=null,cl=T.cloth,hb=cl&&(cl.kind==='herringbone'||cl.kind==='twill'),pitch=4*ls,cw=cl&&cl.cw?cl.cw*W/ASM_SIZE:0,off=cl&&cl.off?cl.off*W/ASM_SIZE:0;
  for(let q=0;q<P.idx.length;q++){const k=P.idx[q],j=4*k,x=k%W,y=(k-x)/W,g=P.seg?P.segs[P.seg[k]]||body:body;cm[0]=cm[1]=cm[2]=0;
    for(let a=0;a<2;a++)for(let e=0;e<2;e++){const c=uv(g,x+(e+.5)/2,y+(a+.5)/2);at(c[0]/rep,c[1]/repv)}
    let sh=P.sh[q],tw=1;
    if(st){const c=uv(g,x+.5,y+.5),si=Math.floor(c[0]/rep-T.loff+.5),tt=c[1]/(T.blen*ls),j0=Math.floor(tt),f0=tt-j0,fs=f0*f0*(3-2*f0),hh=j=>((Math.imul(si|0,374761393)^Math.imul(j|0,668265263))>>>0)%2048/1024-1,nz=Math.max(0,1+T.brk*(hh(j0)*(1-fs)+hh(j0+1)*fs));
      for(let e=0;e<3;e++)cm[e]=4*T.g[e]+(cm[e]-4*T.g[e])*T.k*nz;sh=T.gain*Math.pow(sh,T.gam)}
    if(lin||hb){const c=uv(g,x+.5,y+.5);
      if(lin){const u=Math.floor((T.tweed?x:c[0])/ls),v=Math.floor((T.tweed?y:c[1])/ls),li=(((v%lin.T)+lin.T)%lin.T)*lin.T+(((u%lin.T)+lin.T)%lin.T);sh*=lin.r[li];
        // a tweed is sampled upright: it has no direction, and along a sleeve's tube it streaked where the cloth gathers at the crease
        if(T.c2&&lin.f&&lin.f[li])for(let e=0;e<3;e++)cm[e]=cm[e]*(1-T.fmix)+4*T.c2[e]*T.fmix}   // a tweed's fleck in its second colour
      // diagonal twill lines, turning at each herringbone column, as a share of the visible brightness: as a share of linear light, 5%
      // of a dark navy was under one level of 255 and the owner's herringbone did not show
      else{const col=cl.kind==='herringbone'?Math.floor((c[0]-off)/cw):0,dir=col&1?-1:1,h=(Math.imul(Math.floor((c[0]+dir*c[1])/2)|0,73856093)^Math.imul(Math.floor(c[1]/3)|0,19349663))>>>0;   // a fleck along each thread: lighter fibres, and a stripe slightly broken
        // a plain twill (cl.ss) averages its rib over the pixel's four points: one point a pixel beat against the grid into columns
        let ph=0;if(cl.ss){for(let a=0;a<2;a++)for(let e=0;e<2;e++){const s=uv(g,x+(e+.5)/2,y+(a+.5)/2);ph+=Math.cos(2*Math.PI*(s[1]+dir*s[0])/pitch)/4}}
        else ph=Math.cos(2*Math.PI*(c[1]+dir*c[0])/pitch);
        tw=1+cl.amp*ph+(cl.fleck!=null?cl.fleck:.08)*((h%1024)/512-1);
        if(cl.c2){const m=cl.mix*(1+ph)/2;for(let e=0;e<3;e++)cm[e]=cm[e]*(1-m)+4*cl.c2[e]*m}}}   // a two-colour twill: the ribs lean toward its second colour
    for(let c=0;c<3;c++)d[j+c]=Math.round(gam(cm[c]/4*sh)*tw)}
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
async function asmTieTile(i){const def=fabricDef('asmtie',i,'tie',(usableSett(i)||{}).tex?'asmtie':undefined).replace(/ patternTransform="[^"]*"/,'').replace(/<path [^>]*stroke="#fff"[^>]*\/>/g,''),
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
/* a tie's weave repeats at most this many times across the tie: about 4 px a repeat at 2048 (the tie ~214 px mid-chest); Claude counted 80
   ribs on the owner's burgundy twill, under 3 px each, and they blurred into flat colour (2026-11-13) */
const ASM_TIE_TEX_MAX=50;
/* a figured weave (a dobby's diamonds, not a twill's ribs) at most 22 repeats across: on a phone the picture is shrunk about 1.75 times,
   and at 32 the owner's black tonal-check tie's diamond grid (about 6 px a repeat) averaged out to flat black (2026-11-13) */
const ASM_TIE_FIG_MAX=22;
const asmTieMemo=new Map();
async function asmTieFor(i){const k=asmTieSig(i);if(asmTieMemo.has(k))return asmTieMemo.get(k);const s=usableSett(i),hex=colOf(i);let r={hex};
  // a woven tie's weave (tex) too: its raised grid, a tile repeated tr times across
  if(s&&(s.bands||s.motif||s.tex)){const t=await asmTieTile(i);if(t){let across=+s.tr||1.5;if(s.tex)across=Math.min(across,['twill','herringbone'].includes(s.tex.kind)?ASM_TIE_TEX_MAX:ASM_TIE_FIG_MAX);
      if(s.bands&&!s.cross&&i.texture&&s.cr>0)try{const n=asmStripeCount(await asmData(i.texture));if(n&&(n/s.cr>1.35||n/s.cr<.74))across*=n/s.cr}catch{}   // the close-up shows another count
      r={hex,c:t.c,TW:t.TW,TH:t.TH,motif:!!s.motif,across,ang:(+s.a||0)*Math.PI/180}}}
  if(asmTieMemo.size>40)asmTieMemo.clear();asmTieMemo.set(k,r);return r}
const asmTieSig=i=>{const s=usableSett(i),c=i.texture||'';return fnv64(['t'+ASM_TIEV+(s&&s.tex?'k'+TIE_TEX_K+'m'+ASM_TIE_TEX_MAX+'f'+ASM_TIE_FIG_MAX+'d'+TIE_DARK_L+'x'+TIE_DARK_X:''),colOf(i),settSig(s),c.length+c.slice(-40)].join('|')).slice(0,10)};
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
  // (in the atlas's steps, 1/254 of a half turn: a phone decoding the atlas draws the weave exactly where this does; off by a step, a
  // herringbone moved a few pixels at the far side of the picture, since it turns about the picture's corner)
  const ang=parts.map((p,i)=>{if(i===front||p.n<big)return 0;let t=p.th;while(t>Math.PI/2)t-=Math.PI;while(t<-Math.PI/2)t+=Math.PI;return Math.round((t+Math.PI/2)/Math.PI*254)/254*Math.PI-Math.PI/2});
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
async function asmJob(o,p2){if(asmCmUse(o))return asmCmJob(o);if(!asmCan(o))return null;const mk=asmMasterKey(),m=renders[mk];if(!m)return null;   // p2: atlas painting (undefined: as this phone is set)
  const parts=asmParts(o);if(parts.some(p=>!p.paint&&!p.tp&&!p.sp&&!p.db&&(!renders[p.key]||asmBad.has(p.key))))return null;
  const kz=await metaGet('asm:zones:'+mk),job={mk,mt:m.t,master:m.img,zones:kz&&kz.v===ASM_ZV?kz:null,calib:null,vest:null,p2:(p2===undefined?asmP2On():!!p2)&&asmP2Able(o),
    parts:await Promise.all(parts.map(async p=>p.sp?{slot:p.slot,vest:!!p.vest,key:p.key,sp:p.sp,hex:colOf(p.item),tex:await asmSuitTexFor(p.item)}:p.tp?{slot:p.slot,key:p.key,tp:p.tp,tie:await asmTieFor(p.item)}:p.db?{slot:p.slot,key:p.key,db:p.db,rgb:asmBarRgb(p.item)}:p.paint?{slot:p.slot,key:p.key,paint:p.paint,wk:p.wk,tex:p.wk?await asmTexFor(p.item,p.paint,p.wk):null}:{slot:p.slot,vest:!!p.vest,key:p.key,img:renders[p.key].img}))};   // a woven shirt's weave is drawn here (the tile needs the page)
  if(parts.some(p=>p.paint)){if(asmAtlasOk())job.paintAtlas={t:renders[asmAtlasKey('a')].sig,...Object.fromEntries(ASM_ATLAS.map(p=>[p,renders[asmAtlasKey(p)].img]))};   // measured on a computer: nothing to work out
    else{const c=renders[asmCalibKey('shirt')];if(!c)return null;job.paintCalib={t:c.t,img:c.img}}}   // a painted shirt takes its shading from the black calibration shirt too
  if(parts.some(p=>p.tp)){const c=renders[asmCalibKey('tie')];if(!c)return null;job.tieCalib={t:c.t,img:c.img}}   // a painted tie is shaded from the master's tie and the magenta calibration tie
  if(!job.zones){job.zoneImg=asmZoneImgs();   // zones made outside the app, when they're here; else the calibration photos
    if(!job.zoneImg){job.calib={};for(const s of ['jacket','shirt','tie','watch']){const r=renders[asmCalibKey(s)];if(!r)return null;job.calib[s]=r.img}}}
  if(parts.some(p=>p.sp)){const c=renders[asmCalibKey('jacket')];if(!c)return null;job.suitCalib={t:c.t,img:c.img}}   // a painted suit is shaded from the master's suit and the red calibration suit
  if(parts.some(p=>p.sp&&asmSuitCut(p.item)))job.sleeveImg=asmSleeveImgs();   // a patterned jacket's sleeves run along the arm (upright everywhere without them)
  if(o.vest){const vk=asmVestKey(),r=renders[vk];if(!r)return null;const kv=await metaGet('asm:vest:'+vk);
    job.vest={k:vk,t:r.t,kept:kv&&kv.t===r.t&&kv.v===ASM_ZV?kv:null};
    if(parts.some(p=>p.sp)){const c=renders[asmCalibKey('vest')];if(!c)return null;job.suitVest={t:r.t+'|'+c.t,img:r.img,calib:c.img}}   // painted on the waistcoat master, the waistcoat from its own calibration photo
    if(!job.vest.kept){const zv=renders[asmZoneKey('vest')];if(zv)job.vest.zoneImg=zv.img;
      else{const c=renders[asmCalibKey('vest')];if(!c)return null;job.vest.img=r.img;job.vest.calib=c.img}}}
  return job}
/* the shirt beside the tie, painted whole (asmPaintPrep's full) */
function asmPaintFull(z,W){const nt=asmBox(z.tie,W,asmPx(ASM_HALO+2,W),true);for(let i=0;i<W*W;i++)nt[i]=nt[i]&&z.shirt[i]?1:0;return nt}
/* ---- the master's atlas, the phone's share (tools/asm-atlas.js measures the master on a computer and keeps this on the worker):
   what the painter works out for the master (asmPaintPrep: which pixels are shirt and how much, what a soft edge blends toward, the
   white and the black shirt's shading, the weave's direction), so a phone downloads it instead of working it out, and needs no
   black calibration photo. Three pictures at the master's size, all opaque (a canvas premultiplies alpha, which would lose values):
   'a' R the shirt's share of the pixel (1..255, 0 = not painted), G the pixel a soft edge blends toward ((dx+7)*16+(dy+7), 0 = its
   own), B the weave's direction ((angle+90°)/180° x 254); 'm' and 'c' the master's and the black calibration shirt's shading over
   their lit cloth, 16 bits (R*256+G over 65535 = 0..ASM_ATLAS_MAX). Signed with the record dates of what it was measured from: the
   master, the black shirt and the shirt and tie zones (asmAtlasNow); a phone uses it only while those match the photos it holds
   (the black shirt only if it holds one), else it works the painter out as before. ---- */
const ASM_ATLAS=['a','m','c'];
const ASM_ATLAS_MAX=1.6;
const asmAtlasKey=p=>asmKey('atlas/paint-'+p);
const asmAtlasNow=()=>{const r=k=>renders[k]&&renders[k].t||0;return {m:r(asmMasterKey()),c:r(asmCalibKey('shirt')),s:r(asmZoneKey('shirt')),t:r(asmZoneKey('tie'))}};
const asmAtlasSig=()=>{const s=asmAtlasNow();return Object.values(s).every(Boolean)?'asm/atlas/v1 '+JSON.stringify(s):''};
function asmAtlasOk(){const now=asmAtlasNow();if(!now.m||!now.s||!now.t)return false;const sigs=ASM_ATLAS.map(p=>renders[asmAtlasKey(p)]&&renders[asmAtlasKey(p)].sig);
  if(!sigs[0]||sigs.some(s=>s!==sigs[0])||!/^asm\/atlas\/v1 /.test(sigs[0]))return false;let j;try{j=JSON.parse(sigs[0].slice(13))}catch{return false}
  return !!j&&j.m===now.m&&j.s===now.s&&j.t===now.t&&(!now.c||j.c===now.c)}
/* the atlas onto the device (once a session): true when it is here and matches; one from other photos is asked for again */
async function asmGetAtlas(){if(asmAtlasOk())return true;for(const p of ASM_ATLAS){const k=asmAtlasKey(p);if(renders[k]&&!asmTried.has(k))delete renders[k]}
  return (await Promise.all(ASM_ATLAS.map(p=>asmGet(asmAtlasKey(p))))).every(Boolean)&&asmAtlasOk()}
function asmAtlasEncode(P,W){const N=W*W,mk=()=>{const d=new Uint8ClampedArray(4*N);for(let i=3;i<4*N;i+=4)d[i]=255;return d},a=mk(),m=mk(),c=mk();
  const q16=(v,d,j)=>{const u=Math.max(0,Math.min(65535,Math.round(v/ASM_ATLAS_MAX*65535)));d[j]=u>>8;d[j+1]=u&255};
  for(let q=0;q<P.idx.length;q++){const k=P.idx[q],j=4*k,b=P.bg[q],dx=b%W-k%W,dy=((b/W)|0)-((k/W)|0);
    a[j]=Math.max(1,Math.round(P.A[q]*255));a[j+1]=b===k?0:(dx+7)*16+(dy+7);a[j+2]=Math.round(((P.ang?P.ang[q]:0)+Math.PI/2)/Math.PI*254);q16(P.sm[q],m,j);q16(P.sc[q],c,j)}
  return {a:new ImageData(a,W,W),m:new ImageData(m,W,W),c:new ImageData(c,W,W)}}
function asmAtlasDecode(a,m,c){const W=a.width,N=W*W,A=a.data,idx=[];for(let k=0;k<N;k++)if(A[4*k])idx.push(k);const n=idx.length;
  const P={idx:Int32Array.from(idx),A:new Float32Array(n),sm:new Float32Array(n),sc:new Float32Array(n),bg:new Int32Array(n),ang:new Float32Array(n)};
  for(let q=0;q<n;q++){const k=idx[q],j=4*k,g=A[j+1];P.A[q]=A[j]/255;P.bg[q]=g?k+((g&15)-7)*W+((g>>4)-7):k;P.ang[q]=A[j+2]/254*Math.PI-Math.PI/2;
    P.sm[q]=(m.data[j]*256+m.data[j+1])/65535*ASM_ATLAS_MAX;P.sc[q]=(c.data[j]*256+c.data[j+1])/65535*ASM_ATLAS_MAX}
  return P}
/* (the computer, tools/asm-atlas.js) the atlas measured from the photos on this device: {sig, W, n, imgs:{a,m,c} as PNG data URLs, P},
   or null without the master, the black shirt or the zones' pictures */
async function asmAtlasBuild(){const s=asmAtlasSig(),zi=asmZoneImgs(),m=renders[asmMasterKey()],c=renders[asmCalibKey('shirt')];if(!s||!zi||!m||!c)return null;
  const master=await asmData(m.img),W=master.width,z=await asmZonesFromImgs(zi,W),P=asmPaintPrep(master,await asmData(c.img,W),asmPaintFull(z,W)),e=asmAtlasEncode(P,W);
  const png=d=>{const cv=document.createElement('canvas');cv.width=cv.height=W;cv.getContext('2d').putImageData(d,0,0);return cv.toDataURL('image/png')};
  return {sig:s,W,n:P.idx.length,imgs:Object.fromEntries(ASM_ATLAS.map(p=>[p,png(e[p])])),P}}
/* ---- atlas painting (a trial, the owner's, 2026-11-13; off unless switched on, per phone: Settings → Realistic photos → Advanced).
   A second way to put the picture together when the suit, the shirt and the tie are all painted, from prototypes compared with the
   owner on four of his outfits at 2048 (the khaki windowpane blazer among them):
   1. edges: every boundary between pieces is blended by how much of each edge pixel is which piece, unmixed from the base picture's
      own colours on either side, instead of asmCompose's per-piece halo / edge-ring / skin-rim rules (it left no smears of the
      master's tie by the fist, and a crisp tie edge)
   2. a pattern bends with the folds: its light (patterned over plain) is read from a point moved along the slope of the base's
      large-scale shading, up to about 4 px at 2048 (the windowpane bends round the elbow and the chest)
   3. on a cloth with a new weave or pattern the base's fine grain is smoothed out of the shading first (a box of 7, twice); a plain
      cloth keeps it (without it a plain brown suit looked plastic)
   The pieces come from the zones (jacket and waistcoat, shirt and cuffs, tie, watch) and skin found by colour; near every boundary
   each pixel goes to the piece its colour matches best; the waistcoat's light rim along the V is given to the shirt and tie (its
   inner 3 px, as asmCompose does) and drawn crisp. ---- */
const ASM_P2='asm_paint2';   // localStorage: '1' = atlas painting on this phone
const asmP2On=()=>{try{return localStorage.getItem(ASM_P2)==='1'}catch{return false}};
/* an outfit it can paint: the suit, the shirt and the tie all painted, nothing photographed (another watch, a tie bar) */
const asmP2Able=o=>{if(!asmCan(o))return false;const ps=asmParts(o);return ps.some(p=>p.sp)&&ps.some(p=>p.paint)&&ps.some(p=>p.tp)&&!ps.some(p=>p.db)&&!asmPhotoParts(o).length};   // (a tie bar keeps today's way)
/* distance to the nearest pixel of another label (chamfer 3-4: 3 a pixel) */
function asmChamfer(G,W){const N=W*W,d=new Float32Array(N).fill(1e9);for(let k=0;k<N;k++){const x=k%W,p=G[k];if((x>0&&G[k-1]!==p)||(x<W-1&&G[k+1]!==p)||(k>=W&&G[k-W]!==p)||(k+W<N&&G[k+W]!==p))d[k]=0}
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const k=y*W+x;let v=d[k];if(x>0)v=Math.min(v,d[k-1]+3);if(y>0){v=Math.min(v,d[k-W]+3);if(x>0)v=Math.min(v,d[k-W-1]+4);if(x<W-1)v=Math.min(v,d[k-W+1]+4)}d[k]=v}
  for(let y=W-1;y>=0;y--)for(let x=W-1;x>=0;x--){const k=y*W+x;let v=d[k];if(x<W-1)v=Math.min(v,d[k+1]+3);if(y<W-1){v=Math.min(v,d[k+W]+3);if(x<W-1)v=Math.min(v,d[k+W+1]+4);if(x>0)v=Math.min(v,d[k+W-1]+4)}d[k]=v}return d}
/* the mean of src over a box of 2r+1 (twice) taken only over the pixels of mask (-> the full picture; 0 where none is near) */
function asmBoxMean(src,mask,r,W){const N=W*W,F=new Float32Array(N),C=new Float32Array(N);for(let k=0;k<N;k++)if(mask[k]){F[k]=src[k];C[k]=1}
  const box=(s0,rr)=>{const t=new Float32Array(N),o=new Float32Array(N),cl=v=>v<0?0:v>W-1?W-1:v,n=2*rr+1;
    for(let y=0;y<W;y++){let s=0;for(let x=-rr;x<=rr;x++)s+=s0[y*W+cl(x)];for(let x=0;x<W;x++){t[y*W+x]=s/n;s+=s0[y*W+cl(x+rr+1)]-s0[y*W+cl(x-rr)]}}
    for(let x=0;x<W;x++){let s=0;for(let y=-rr;y<=rr;y++)s+=t[cl(y)*W+x];for(let y=0;y<W;y++){o[y*W+x]=s/n;s+=t[cl(y+rr+1)*W+x]-t[cl(y-rr)*W+x]}}return o};
  let f=F,c=C;for(let it=0;it<2;it++){f=box(f,r);c=box(c,r)}const o=new Float32Array(N);for(let k=0;k<N;k++)o[k]=c[k]>0?f[k]/c[k]:0;return o}
/* a painter's per-pixel values (idx order) smoothed within its own pixels */
function asmSmoothIdx(idx,vals,W,r){const N=W*W,m=new Uint8Array(N),s=new Float32Array(N);for(let q=0;q<idx.length;q++){m[idx[q]]=1;s[idx[q]]=vals[q]}
  const b=asmBoxMean(s,m,r,W),o=new Float32Array(idx.length);for(let q=0;q<idx.length;q++)o[q]=b[idx[q]]||vals[q];return o}
/* each pixel's piece: 1 suit (jacket, waistcoat), 2 shirt (front, cuffs), 3 tie, 4 watch, 5 skin, 0 background; waistcoat pixels in wv */
function asmP2Pieces(base,z,V,W){const N=W*W,G=new Uint8Array(N),wv=new Uint8Array(N);
  for(let k=0;k<N;k++){if(z.jacket[k])G[k]=1;if(z.shirt[k])G[k]=2;if(z.tie[k])G[k]=3;if(V&&V[k]){G[k]=1;wv[k]=1}if(z.watch[k])G[k]=4}
  // skin: what no zone claims, skin-coloured, in regions of at least 0.1% of the picture that touch the outfit (the desk is skin-coloured too)
  const L=asmLab(base),sk=k=>{if(G[k])return false;const l=L[3*k],a=L[3*k+1],b=L[3*k+2];return l>20&&l<88&&a>5&&a<38&&b>8&&b<45&&b>a*.6},seen=new Uint8Array(N);
  for(let s=0;s<N;s++){if(seen[s]||!sk(s))continue;const st=[s],pix=[];seen[s]=1;let touch=false;
    while(st.length){const k=st.pop(),x=k%W;pix.push(k);for(const q of [x>0?k-1:-1,x<W-1?k+1:-1,k-W,k+W]){if(q<0||q>=N)continue;if(G[q])touch=true;else if(!seen[q]&&sk(q)){seen[q]=1;st.push(q)}}}
    if(touch&&pix.length>=N*.001)for(const k of pix)G[k]=5}
  return {G,wv}}
/* the picture, the trial's way (an ImageData); M: asmMem with the painters' preparations (spp/sppv, pp, tpp) */
function asmComposeP2(M,job,z,V,master){const W=master.width,N=W*W,LIN=ASM_LIN,px=n=>Math.max(1,Math.round(n*W/ASM_SIZE));
  const gam=v=>{v=v<0?0:v>1?1:v;return Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055))};
  const ps=job.parts.find(p=>p.sp),pt=job.parts.find(p=>p.tp),pp=job.parts.find(p=>p.paint),prS=ps.vest?M.sppv:M.spp,prT=M.tpp,prP=M.pp,base=prS.base,Lb=asmLab(base);
  const {G,wv}=asmP2Pieces(base,z,ps.vest?V:null,W);
  // 3. the grain out of the shading where a new weave or pattern is drawn; the shirt painted whole wherever its painter reaches (the
  //    edges are mixed below; a part-painted pixel is half the master's grey, and in a cuff's deep shadow the painter only part-paints)
  const RT=pp.tex&&pp.wk?asmTexReady(pp.tex,pp.paint,W):null,R3=px(3);
  const prS2=ps.tex?{...prS,sh:asmSmoothIdx(prS.idx,prS.sh,W,R3)}:prS,prT2=pt.tie.c?{...prT,sh:asmSmoothIdx(prT.idx,prT.sh,W,R3)}:prT;
  const prP2={...prP,A:new Float32Array(prP.idx.length).fill(1),...(RT?{sm:asmSmoothIdx(prP.idx,prP.sm,W,R3),sc:asmSmoothIdx(prP.idx,prP.sc,W,R3)}:{})};
  // cracks: unclaimed pixels showing the base's grey suit (between a cuff and its sleeve) are suit
  {const js=[];for(let k=0;k<N;k+=9)if(G[k]===1)js.push(k);const med=c=>{const v=js.map(k=>Lb[3*k+c]).sort((a,b)=>a-b);return v[v.length>>1]},mL=med(0),ma=med(1),mb=med(2);
    const nearSuit=asmBox(G.map(g=>g===1?1:0),W,px(4),true);for(let k=0;k<N;k++)if((G[k]===0||G[k]===5)&&nearSuit[k]&&Math.hypot(Lb[3*k]-mL,Lb[3*k+1]-ma,Lb[3*k+2]-mb)<14)G[k]=1}
  // the waistcoat's rim: the shirt and tie take its inner 3 px where they meet it (not beside the hand), and that edge is drawn crisp
  const hard=new Uint8Array(N);
  if(ps.vest&&V){const open=new Uint8Array(N);for(let k=0;k<N;k++)if((G[k]===2||G[k]===3)&&!wv[k])open[k]=1;const nearO=asmBox(open,W,px(3),true);
    const src=new Int32Array(N).fill(-1);for(let k=0;k<N;k++)if(open[k])src[k]=k;
    for(let it=0;it<px(3)+1;it++){const nx=new Int32Array(src);for(let k=0;k<N;k++)if(src[k]<0&&nearO[k]){const x=k%W,q=x>0&&src[k-1]>=0?k-1:x<W-1&&src[k+1]>=0?k+1:k>=W&&src[k-W]>=0?k-W:k+W<N&&src[k+W]>=0?k+W:-1;if(q>=0)nx[k]=src[q]}src.set(nx)}
    const nearSkin=asmBox(G.map(g=>g===5?1:0),W,px(6),true);for(let k=0;k<N;k++)if(wv[k]&&nearO[k]&&src[k]>=0&&!nearSkin[k])G[k]=G[src[k]];
    const both=new Uint8Array(N);for(let k=0;k<N;k++)if(wv[k]||open[k])both[k]=1;const nb=asmBox(both,W,px(5),true);
    for(let k=0;k<N;k++)if(nb[k]&&(wv[k]||G[k]===2||G[k]===3)){const x=k%W;let t=wv[k]===1;for(const q of [k-1,k+1,k-W,k+W])if(q>=0&&q<N&&Math.abs(q%W-x)<=1&&((G[q]===1)!==(G[k]===1)))t=true;if(t)hard[k]=1}
    hard.set(asmBox(hard,W,px(4),true))}
  // the pieces tightened to the base's colours: within 4 px of a boundary each pixel goes to the piece whose clean pixels nearby (over
  // 4 px from a boundary, within 8 px) it looks most like (not the watch: its metal is too varied to judge by)
  {const dd=asmChamfer(G,W),G2=new Uint8Array(G),R=px(8),st=Math.max(1,Math.round(R/4));
    for(let k=0;k<N;k++){if(dd[k]>12||G[k]===4||hard[k])continue;const x=k%W,y=(k-x)/W,s=new Float64Array(18),n=new Uint32Array(6);
      for(let dy=-R;dy<=R;dy+=st){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx+=st){const xx=x+dx;if(xx<0||xx>=W)continue;const q=yy*W+xx;if(dd[q]<12)continue;const g=G[q];if(g===4)continue;n[g]++;s[3*g]+=Lb[3*q];s[3*g+1]+=Lb[3*q+1];s[3*g+2]+=Lb[3*q+2]}}
      let best=G[k],bd=Infinity;for(let g=0;g<6;g++){if(n[g]<4)continue;const e=Math.hypot(Lb[3*k]-s[3*g]/n[g],Lb[3*k+1]-s[3*g+1]/n[g],Lb[3*k+2]-s[3*g+2]/n[g]);if(e<bd){bd=e;best=g}}
      G2[k]=best}
    G.set(G2)}
  const lay={1:{plain:asmSuitPaint(prS2,ps.hex),tex:ps.tex?asmSuitPaintTex(prS2,ps.tex):null},2:{plain:asmPaint(master,null,pp.paint,prP2),tex:RT?asmPaint(master,null,pp.paint,prP2,RT):null},
    3:{plain:asmTiePaint(master,prT2,{hex:pt.tie.hex}),tex:pt.tie.c?asmTiePaint(master,prT2,pt.tie):null}};
  // 2. a pattern bent by the folds (bicubic, so the weave stays sharp; near the piece's edge the pixel's own)
  const Yb=new Float32Array(N);for(let k=0;k<N;k++){const j=4*k;Yb[k]=.2126*LIN[base.data[j]]+.7152*LIN[base.data[j+1]]+.0722*LIN[base.data[j+2]]}
  const bent={},cr=t=>{const a=Math.abs(t);return a<1?1.5*a*a*a-2.5*a*a+1:a<2?-.5*a*a*a+2.5*a*a-4*a+2:0};
  for(const g of [1,2,3]){const Lp=lay[g].plain.data,Lt=lay[g].tex&&lay[g].tex.data;if(!Lt){bent[g]=Lp;continue}
    const mask=new Uint8Array(N);for(let k=0;k<N;k++)mask[k]=G[k]===g?1:0;const S=asmBoxMean(Yb,mask,px(14),W),H=new Float32Array(N);for(let k=0;k<N;k++)H[k]=mask[k]?Math.log(S[k]+.003):0;
    const gx=new Float32Array(N),gy=new Float32Array(N),mags=[];for(let y=1;y<W-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x;if(!mask[k]||!mask[k-1]||!mask[k+1]||!mask[k-W]||!mask[k+W])continue;gx[k]=(H[k+1]-H[k-1])/2;gy[k]=(H[k+W]-H[k-W])/2;if((k&15)===0)mags.push(Math.hypot(gx[k],gy[k]))}
    mags.sort((a,b)=>a-b);const s=4*W/ASM_SIZE/(mags[Math.floor(mags.length*.95)]||1),out=new Uint8ClampedArray(Lp),rat=(c,k)=>{const p=LIN[Lp[4*k+c]];return p>1e-4?LIN[Lt[4*k+c]]/p:1};
    for(let k=0;k<N;k++){if(!mask[k])continue;const x=k%W,y=(k-x)/W,X=x+Math.max(-6,Math.min(6,s*gx[k])),Y=y+Math.max(-6,Math.min(6,s*gy[k])),x0=Math.floor(X),y0=Math.floor(Y),fx=X-x0,fy=Y-y0;
      const wx=[-1,0,1,2].map(i=>cr(fx-i)),wy=[-1,0,1,2].map(i=>cr(fy-i));let ok=x0>=1&&y0>=1&&x0<W-2&&y0<W-2;if(ok)for(let j=-1;j<=2&&ok;j++)for(let i=-1;i<=2;i++)if(!mask[(y0+j)*W+x0+i]){ok=false;break}
      for(let c=0;c<3;c++){let r=0;if(ok){for(let j=0;j<4;j++)for(let i=0;i<4;i++)r+=wx[i]*wy[j]*rat(c,(y0+j-1)*W+x0+i-1);r=Math.max(0,r)}else r=rat(c,k);out[4*k+c]=gam(LIN[Lp[4*k+c]]*r)}}
    bent[g]=out}
  // where each painter painted the new cloth whole; a piece's pixel its painter didn't reach takes its nearest painted one
  const near={};for(const [g,pr] of [[1,prS],[2,prP],[3,prT]]){const src=new Int32Array(N).fill(-1);for(const k of pr.idx)src[k]=k;
    for(let it=0;it<10;it++){const nx=new Int32Array(src);for(let k=0;k<N;k++)if(src[k]<0&&G[k]===g){const x=k%W,q=x>0&&src[k-1]>=0?k-1:x<W-1&&src[k+1]>=0?k+1:k>=W&&src[k-W]>=0?k-W:k+W<N&&src[k+W]>=0?k+W:-1;if(q>=0)nx[k]=src[q]}src.set(nx)}near[g]=src}
  const at=(g,k,c)=>{if(g>=1&&g<=3){const s=near[g][k]>=0?near[g][k]:k;return bent[g][4*s+c]}return base.data[4*k+c]};
  // 1. the edges: within 3 px of another piece a pixel is unmixed from the base's colours either side (the means of their clean pixels
  //    within 7 px) and made that share of each piece's new colour (from its nearest clean pixel); nearly all one piece is that piece
  const d=asmChamfer(G,W),BAND=9,CLEAN=12,RR=px(7),o=new Uint8ClampedArray(base.data);
  for(let k=0;k<N;k++){const j=4*k,p=G[k];if(d[k]>BAND){for(let c=0;c<3;c++)o[j+c]=at(p,k,c);continue}
    const x=k%W,y=(k-x)/W;let q=-1,bq=1e9;for(let dy=-4;dy<=4;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-4;dx<=4;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const kk=yy*W+xx,e=dx*dx+dy*dy;if(G[kk]!==p&&e<bq){bq=e;q=G[kk]}}}
    if(q<0){for(let c=0;c<3;c++)o[j+c]=at(p,k,c);continue}
    const Cp=[0,0,0],Cq=[0,0,0];let np=0,nq=0,kp=-1,kq=-1,bp=1e9,bb=1e9;
    for(let dy=-RR;dy<=RR;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-RR;dx<=RR;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const kk=yy*W+xx;if(d[kk]<CLEAN)continue;const g=G[kk],e=dx*dx+dy*dy;
      if(g===p){np++;for(let c=0;c<3;c++)Cp[c]+=LIN[base.data[4*kk+c]];if(e<bp){bp=e;kp=kk}}else if(g===q){nq++;for(let c=0;c<3;c++)Cq[c]+=LIN[base.data[4*kk+c]];if(e<bb){bb=e;kq=kk}}}}
    if(!np||!nq){for(let c=0;c<3;c++)o[j+c]=at(p,k,c);continue}
    for(let c=0;c<3;c++){Cp[c]/=np;Cq[c]/=nq}const dv=[Cp[0]-Cq[0],Cp[1]-Cq[1],Cp[2]-Cq[2]],dd2=dv[0]*dv[0]+dv[1]*dv[1]+dv[2]*dv[2];let a;
    if(dd2<.0009||p===4||q===4||(hard[k]&&(p===1||q===1))){let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=y+dy,xx=x+dx;if(yy<0||yy>=W||xx<0||xx>=W)continue;n++;if(G[yy*W+xx]===p)s++}a=s/n}   // alike colours, the watch, the waistcoat's rim: by count
    else{const m=[0,1,2].map(c=>LIN[base.data[j+c]]-Cq[c]);a=(m[0]*dv[0]+m[1]*dv[1]+m[2]*dv[2])/dd2;a=(a-.15)/.7;a=a<0?0:a>1?1:a;a=a*a*(3-2*a)}
    for(let c=0;c<3;c++)o[j+c]=gam(a*LIN[at(p,kp,c)]+(1-a)*LIN[at(q,kq,c)])}
  return new ImageData(o,W,W)}
/* Settings → Realistic photos → Advanced: the switch and the comparison (drawn into the Item photos group by renderAsmUI) */
function asmP2UI(){const grp=$('#asm-group');if(!grp)return;let b=$('#p2-box');if(!b){b=document.createElement('div');b.id='p2-box';b.className='sgroup';grp.appendChild(b)}
  b.innerHTML=`<div class="slabel">Atlas painting (trial)</div><label class="srow">On this phone <select id="cfg-p2" onchange="asmP2Set(this.value)"><option value="off">Off: as now</option><option value="on">On: edges, folds and grain from the atlas</option></select></label>
    <div class="btns"><button type="button" id="p2-cmp-btn" onclick="asmP2Compare()">Compare on the day shown</button></div><div class="snote">Only outfits whose suit, shirt and tie are all painted; the others are put together as now.</div>`;
  $('#cfg-p2').value=asmP2On()?'on':'off'}
function asmP2Set(v){try{if(v==='on')localStorage.setItem(ASM_P2,'1');else localStorage.removeItem(ASM_P2)}catch{}asmOut={};asmTried.clear();refreshToday()}
/* the day shown, both ways, in one full-screen view: a tap switches between them */
async function asmP2Compare(){const o=planFor()[key(sel)],btn=$('#p2-cmp-btn');if(!o||!asmP2Able(o)){tell('The day shown can’t be painted this way: its suit, shirt and tie must all be painted (no other watch or tie bar).');return}
  if(btn){btn.disabled=true;btn.textContent='Putting it together both ways…'}
  try{if(o.vest)await asmGet(asmVestKey());   // (asmPrebuildOne wants the waistcoat master on the phone already)
    if(!await asmPrebuildOne(o)&&!await asmPhoto(o,true,false)){tell('Its photos aren’t all on this phone yet.');return}
    const a=await asmPhoto(o,true,false),b=await asmPhoto(o,true,true);if(!a||!b){tell('It couldn’t be put together.');return}asmP2Show(a,b)}
  finally{if(btn){btn.disabled=false;btn.textContent='Compare on the day shown'}}}
function asmP2Show(a,b){let v=$('#p2-view');if(!v){v=document.createElement('div');v.id='p2-view';document.body.appendChild(v)}let on=0;
  v.style.cssText='position:fixed;inset:0;z-index:2100;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:pinch-zoom';
  const draw=()=>{v.innerHTML=`<div style="color:#fff;font:600 16px system-ui;padding:12px;text-align:center">${on?'Atlas painting':'As now'} · tap the picture to switch</div><img alt="${on?'Atlas painting':'As now'}" src="${on?b:a}" style="max-width:100%;max-height:calc(100% - 110px);object-fit:contain"><button type="button" style="margin:12px;min-height:44px;padding:0 20px">Close</button>`;
    v.querySelector('img').onclick=()=>{on^=1;draw()};v.querySelector('button').onclick=()=>v.remove()};draw()}
/* the decoded master and its unpacked zones, kept between pictures in whichever thread builds them */
let asmMem=null;
/* build one picture from a job -> {url} (a JPEG data URL), or {bad: a piece's key} for a piece that didn't keep the picture, or {};
   with zones worked out here, {zones} / {vestZone} to keep (packed) */
async function asmBuild(job){
  if(job.cm)return asmCmBuild(job);   // a colour-coded master (asm-color.js)
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
  if(job.paintAtlas&&(!M.pp||M.ppt!==job.paintAtlas.t)){const J=job.paintAtlas;M.pp=asmAtlasDecode(await asmData(J.a,W),await asmData(J.m,W),await asmData(J.c,W));M.ppt=J.t;M.paint={}}
  if(job.paintCalib&&(!M.pp||M.ppt!==job.paintCalib.t)){M.pp=asmPaintPrep(master,await asmData(job.paintCalib.img,W),asmPaintFull(z,W));M.ppt=job.paintCalib.t;M.paint={}}
  if(job.tieCalib&&(!M.tpp||M.tppt!==job.tieCalib.t)){M.tpp=asmTiePrep(master,await asmData(job.tieCalib.img,W),z.tie);M.tppt=job.tieCalib.t;M.ties={}}
  const slv=job.sleeveImg&&job.parts.some(p=>p.sp&&p.tex)?'s'+Object.keys(job.sleeveImg).length:'';   // the sleeves are worked out only for a patterned jacket
  if(slv&&(!M.sleeves||M.sleevesN!==Object.keys(job.sleeveImg).length)){M.sleeves=await Promise.all(ASM_CUTS.map(async s=>job.sleeveImg[s]?{m:await asmMaskFromImg(job.sleeveImg[s],W),one:ASM_LAPELS.includes(s)}:null));M.sleevesN=Object.keys(job.sleeveImg).length}
  const sl=slv?M.sleeves:null;
  if(job.suitCalib&&job.parts.some(p=>p.sp&&!p.vest)&&(!M.spp||M.sppt!==job.suitCalib.t+slv)){M.spp=asmSuitPrep(master,await asmData(job.suitCalib.img,W),z.jacket,null,null,sl);M.sppt=job.suitCalib.t+slv;M.suits={}}
  if(job.suitCalib&&job.suitVest&&V&&(!M.sppv||M.sppvt!==job.suitVest.t+'|'+job.suitCalib.t+slv)){M.sppv=asmSuitPrep(await asmData(job.suitVest.img,W),await asmData(job.suitCalib.img,W),z.jacket,V,await asmData(job.suitVest.calib,W),sl);M.sppvt=job.suitVest.t+'|'+job.suitCalib.t+slv;M.suits={}}
  const P={};for(const p of job.parts){if(p.sp){const pr=p.vest?M.sppv:M.spp;if(!pr)return out;M.suits=M.suits||{};const k=p.sp+(p.vest?'v':'');if(!M.suits[k]&&Object.keys(M.suits).length>=4)M.suits={};   // a painted suit: no drift to check
      P.jacket=M.suits[k]=M.suits[k]||asmSuitEdge(pr,p.tex?asmSuitPaintTex(pr,p.tex):asmSuitPaint(pr,p.hex));continue}
    if(p.db){P.barDraw=p.rgb;continue}   // a drawn tie bar: asmCompose draws it on the tie
    if(p.tp){if(!M.tpp)return out;M.ties=M.ties||{};P.tie=M.ties[p.tp]=M.ties[p.tp]||asmTiePaint(master,M.tpp,p.tie);continue}   // a painted tie: only its zone changes
    if(p.paint){M.paint=M.paint||{};const pk=p.paint+(p.tex&&p.wk?'~'+p.wk:'');   // nothing outside the shirt changes: no drift to check
      P[p.slot]=M.paint[pk]=M.paint[pk]||asmPaint(master,null,p.paint,M.pp,p.tex&&p.wk?asmTexReady(p.tex,p.paint,W):null);continue}
    const d=await asmData(p.img,W);if(asmDrift(master,z,p.slot,d,p.vest?V:null)>ASM_DRIFT){out.bad=p.key;return out}P[p.slot]=d}
  if(V)P.vest=V;
  if(job.p2&&P.jacket&&P.shirt&&P.tie&&M.pp&&M.tpp){out.url=await asmJpeg(asmComposeP2(M,job,z,V,master));return out}   // the trial's way (atlas painting)
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
async function asmPhoto(o,front,p2){const job=await asmJob(o,p2);if(!job)return null;const r=await asmRun(job,front);
  if(r.zones)await metaPut('asm:zones:'+job.mk,r.zones);
  if(r.vestZone)await metaPut('asm:vest:'+job.vest.k,r.vestZone);
  if(r.bad){asmBad.add(r.bad);return null}
  return r.url||null}
/* ---- on Today: the assembled picture stands in for the outfit's photo ---- */
/* assembled pictures are kept on the device (meta 'asm:out:<key>', the newest ASM_KEEP), each with the newest date among the photos
   it was made from: a piece made again makes it stale */
let asmOut={};const ASM_KEEP=150,asmBusy=new Set(),asmTried=new Set();   // 150: the next 60 days' looks (about 43 workdays) and the days before
const asmOutKey=o=>asmCmUse(o)?asmCmOutKey(o):asmKey('out/z'+ASM_ZV+'/'+asmParts(o).map(p=>p.key+(p.paint?'='+p.paint+(p.wk?'~'+p.wk:''):'')+(p.tp?'='+p.tp:'')+(p.sp?'='+p.sp:'')+(p.db?'='+p.db:'')).join('+')+(asmP2On()&&asmP2Able(o)?'/p2':''));   // (atlas painting: a picture of its own)   // a painted shirt's colour (and weave) is in the key: a new shade is a new picture
const asmStamp=o=>asmCmUse(o)?asmCmStamp(o):[renders[asmMasterKey()],o.vest&&renders[asmVestKey()],...asmPhotoParts(o).map(p=>renders[p.key])].reduce((t,r)=>Math.max(t,r&&r.t||0),0);
const asmWants=o=>{const k=asmCmUse(o);return k?asmCmHeld(k):asmWants0(o)};
const asmWants0=o=>ASM_ON&&asmCan(o)&&!!renders[asmMasterKey()]&&(!o.vest||!!renders[asmVestKey()]);   // a vest day needs the vest master too
/* the picture to show for an outfit, like a kept photo's record, or null. A photo made for this very outfit after the master
   (Settings: Regenerate) wins: that was the owner's choice. */
/* a photo made for this outfit after the master (Settings: Regenerate): it is shown, and nothing is put together for the outfit */
const asmFullWins=o=>{const k=asmCmUse(o),full=renders[comboKey(o)],m=renders[k?asmCmKey(k,'master'):asmMasterKey()];return !!(full&&m&&full.t>m.t)};
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
/* (listed: the worker's list says it has the picture: asked for even if an earlier ask this session found none, since the computer built
   it since; one download at a time per look) */
const asmPreGetting=new Map();
function asmGetPre(o,listed){const k=asmOutKey(o);if(asmPreGetting.has(k))return asmPreGetting.get(k);const p=asmGetPre1(o,listed).finally(()=>asmPreGetting.delete(k));asmPreGetting.set(k,p);return p}
async function asmGetPre1(o,listed){const k=asmOutKey(o),W=workerBase();if(!W||(!listed&&asmTried.has('pre:'+k)))return false;asmTried.add('pre:'+k);
  try{const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'}),j=r.ok?await r.json().catch(()=>null):null;
    const m=j&&j.img&&ASM_PRE_RE.exec(String(j.sig||''));if(!m||+m[1]!==ASM_ZV)return false;
    const rec={img:j.img,stamp:+m[2],t:Date.now(),pre:true};if(!asmFresh(o,rec))return false;
    asmOut[k]=rec;await metaPut('asm:out:'+k,rec);asmTrim();return true}
  catch(e){console.warn('no built picture',e);return false}}
/* for the computer: one look's picture made exactly as a phone makes it -> {key, sig, img}, or null when it can't be (a piece missing,
   one that came out wrong). It downloads what the look needs like asmEnsure, but never takes a picture built earlier */
async function asmPrebuildOne(o){await asmCmLook(o);if(asmCmUse(o))return asmCmPrebuild(o);   // (its master not on the worker: the earlier way)
  if(!ASM_ON||!asmCan(o))return null;
  if(!await asmGet(asmMasterKey(),true)||(o.vest&&!await asmGet(asmVestKey()))||!asmWants(o))return null;   // the vest master first: asmWants needs it here (every look was refused on a waistcoat day)
  if(o.vest&&!await asmVestKept()&&!await asmGet(asmZoneKey('vest')))await asmGet(asmCalibKey('vest'));
  if((await Promise.all(asmPhotoParts(o).map(p=>asmGet(p.key)))).includes(false))return null;
  if(asmParts(o).some(p=>p.tp)&&!await asmGet(asmCalibKey('tie')))return null;
  if(asmParts(o).some(p=>p.sp)&&(!await asmGet(asmCalibKey('jacket'))||(o.vest&&!await asmGet(asmCalibKey('vest')))))return null;
  if(asmParts(o).some(p=>p.sp&&asmSuitCut(p.item)))await Promise.all(ASM_CUTS.map(s=>asmGet(asmZoneKey(s))));
  if(!await asmZonesKept()&&!await asmGetZones())await Promise.all(['jacket','shirt','tie','watch'].map(s=>asmGet(asmCalibKey(s))));   // the zones' pictures first, the calibration photos only without them
  if(asmParts(o).some(p=>p.paint)&&!await asmGetAtlas()&&!await asmGet(asmCalibKey('shirt')))return null;   // the master's atlas, else the black shirt to work it out from
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
async function asmEnsure(o,ahead){await asmCmLook(o);if(asmCmUse(o)){if(!ahead)asmAheadSoon();return asmCmEnsure(o,ahead)}   // (its master not on the worker: the earlier way)
  if(!ASM_ON||!asmCan(o))return;if(!ahead&&renders[asmMasterKey()])asmAheadSoon();if(asmFullWins(o)||asmFor(o))return;const mk=asmMasterKey();if(asmBusy.has(mk+comboKey(o)))return;asmBusy.add(mk+comboKey(o));
  try{if(!await asmGet(mk)||asmFullWins(o)||(o.vest&&!await asmGet(asmVestKey())))return;
    if(await asmGetPre(o)){const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow();return}   // built on the computer: no pieces to download, nothing to compute
    if(o.vest&&!await asmVestKept()&&!await asmGet(asmZoneKey('vest')))await asmGet(asmCalibKey('vest'));
    const parts=asmPhotoParts(o),got=await Promise.all(parts.map(p=>asmGet(p.key)));if(got.includes(false))return;
    if(asmParts(o).some(p=>p.tp)&&!await asmGet(asmCalibKey('tie')))return;   // the magenta tie a painted tie is shaded from
    if(asmParts(o).some(p=>p.sp)&&(!await asmGet(asmCalibKey('jacket'))||(o.vest&&!await asmGet(asmCalibKey('vest')))))return;   // the red suit (and orange waistcoat) a painted suit is shaded from
    if(asmParts(o).some(p=>p.sp&&asmSuitCut(p.item)))await Promise.all(ASM_CUTS.map(s=>asmGet(asmZoneKey(s))));   // the sleeves' zone pictures (without them the pattern stays upright)
    if(!await asmZonesKept()&&!await asmGetZones())await Promise.all(['jacket','shirt','tie','watch'].map(s=>asmGet(asmCalibKey(s))));   // the zones' pictures first, the calibration photos only without them
    if(asmParts(o).some(p=>p.paint)&&!await asmGetAtlas()&&!await asmGet(asmCalibKey('shirt')))return;   // the master's atlas (measured on a computer), else the black shirt a painted shirt is shaded from
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
const ASM_AHEAD_N=3;   // pictures built on the computer downloaded at once while building ahead (one at a time took about 80 s for 40 on 4G)
let asmAheadT=0,asmAheadOn=false,asmAheadAgain=false;
function asmAheadSoon(){clearTimeout(asmAheadT);asmAheadT=setTimeout(asmAhead,ASM_AHEAD_WAIT)}
/* the workdays from today to ASM_AHEAD days on, with the day on screen and its neighbours first: [[date, outfit]] (planned a day at a
   time with a pause between, so planning months ahead doesn't hold the page either) */
async function asmAheadDays(){const T=todayDate(),c=+new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),out=[];
  for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
    if(i&&i%10===0)await new Promise(r=>setTimeout(r,0));if(asmAheadAgain)return [];
    const o=planOn(d);if(o&&asmWants(o))out.push([Math.abs(+d-c),o])}
  return out.sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
async function asmAhead(){if(!ASM_ON||!(renders[asmMasterKey()]||asmCmAny())||!asmOffPage()||document.hidden)return;if(asmAheadOn){asmAheadAgain=true;return}asmAheadOn=true;
  try{do{asmAheadAgain=false;const seen=new Set(),todo=[];
      for(const o of await asmAheadDays()){const k=asmOutKey(o);if(seen.has(k))continue;seen.add(k);if(!asmFullWins(o)&&!asmFor(o))todo.push(o)}
      // (2026-11-13) the looks the computer built first, ASM_AHEAD_N at a time (only their pictures are downloaded); then the rest, one at
      // a time and grouped by master, so a master's setup is read once for all its looks (asmCmBuild keeps one in memory on a phone)
      const L=await asmListGet(),built=todo.filter(o=>asmCmUse(o)&&L&&L.has(asmOutKey(o))),rest=todo.filter(o=>!built.includes(o));
      const stop=()=>asmAheadAgain||document.hidden||!asmOffPage();let i=0;
      await Promise.all(Array.from({length:ASM_AHEAD_N},async()=>{while(i<built.length&&!stop())await asmEnsure(built[i++],true)}));
      rest.sort((a,b)=>String(asmCmUse(a)||'').localeCompare(String(asmCmUse(b)||'')));   // (a stable sort: nearest first within a master)
      for(const o of rest){if(stop())break;await asmEnsure(o,true)}}
    while(asmAheadAgain)}
  catch(e){console.warn('building ahead stopped',e)}finally{asmAheadOn=false}}
/* are any of this outfit's pieces being made right now? */
const asmPending=o=>!asmCmUse(o)&&asmWants(o)&&asmPhotoParts(o).some(p=>queuedKeys().includes(p.key)&&!renderStalled(p.key));
/* ---- every photo the wardrobe needs, and making the missing ones ---- */
const ASM_TYPE={suit:'jacket',blazer:'jacket',shirt:'shirt',tie:'tie',tieclip:'bar',watch:'watch'},ASM_COST={master:.46,calib:.13,vestmaster:.44,vestcalib:.13,piece:.14};   // at 2048 (measured 2026-11-12: master and waistcoat master at high 44-46¢, a medium edit about 12-14¢)
function asmNeeds(){const out=[],seen=new Set(),add=(kind,slot,item,k,what)=>{if(!seen.has(k)){seen.add(k);out.push({kind,slot,item,key:k,what})}},inf=asmInfo()||{};
  if(typeof wearsJacket==='function'&&!wearsJacket())return out;   // no jackets in the dress code: this way makes no picture (it needs a jacket); colour-coded masters need nothing made
  add('master',null,null,asmMasterKey(),'the master pose');
  for(const sl of ['jacket','shirt','tie','watch'])add('calib',sl,null,asmCalibKey(sl),'finding the '+sl);
  // waistcoats: the vest master, and a second piece for every suit that has one (unless vests are never worn)
  const vests=settings.vestMode==='never'||(typeof wearsJacket==='function'&&!wearsJacket())?[]:items.filter(i=>hasVest(i)&&inRotation(i));
  if(vests.length){add('vestmaster',null,null,asmVestKey(),'the pose with a waistcoat');add('vestcalib','vest',null,asmCalibKey('vest'),'finding the waistcoat')}
  for(const i of items){const slot=ASM_TYPE[i.type];if(!slot||!inRotation(i)||(slot==='jacket'&&typeof wearsJacket==='function'&&!wearsJacket()))continue;const sig=asmLook(slot,i);   // (the dress code leaves jackets out: no jacket pieces)
    if((slot==='watch'&&sig===inf.watch)||(slot==='shirt'&&sig===inf.shirt)||(slot==='shirt'&&asmPaintable(i))||slot==='tie'||slot==='bar'||(slot==='jacket'&&asmSuitPaintable(i)))continue;add('piece',slot,i,asmPieceKey(slot,i),nm(i));   // a plain or woven shirt is painted: nothing to make
    if(vests.includes(i))add('piece','vest',i,asmPieceKey('vest',i),nm(i)+' with its waistcoat')}
  return out}
/* asmState: what a look at the worker found. missing: photos nobody has made (or that came out wrong) */
let asmState={checked:false,missing:[],total:0},asmSyncing=null;
/* look at the worker: bring home what it has, note what it lacks. One look at a time; a forced one (Settings, a new item) waits for
   the look under way and then looks again, asking afresh for photos that were missing before. */
function asmSync(force){if(!ASM_ON||!workerBase())return Promise.resolve(asmState);if(asmSyncing)return force?asmSyncing.then(()=>asmSync(true)):asmSyncing;
  asmSyncing=(async()=>{
    // (2026-11-13, the owner's ask) the colour-coded masters paint every look the earlier way could (a jacket and a tie: the suit and
    // waistcoat masters): its master, waistcoat master, calibration photos and pieces (about 2.8 MB) are then neither downloaded nor listed
    if(typeof asmCmPref==='function'&&asmCmPref()){await asmListGet();if(asmCmHeld('suit')&&asmCmHeld('vest')){asmState={checked:true,missing:[],total:0,cm:true};asmSyncing=null;if(typeof renderAsmUI==='function')renderAsmUI();return asmState}}
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
function renderAsmUI(){const st=$('#asm-status'),btn=$('#asm-btn'),grp=$('#asm-group');if(grp)grp.hidden=!ASM_ON;if(ASM_ON){asmP2UI();if(typeof asmCmUI==='function')asmCmUI()}if(!st||!btn||!ASM_ON)return;
  const money=v=>v<1?Math.round(v*100)+'¢':'$'+v.toFixed(2),queued=new Set(queuedKeys()),m=asmState.missing.filter(n=>!queued.has(n.key)),making=asmNeeds().filter(n=>queued.has(n.key)).length;
  if(!workerBase()){st.textContent='';btn.textContent='Make item photos';needConn(btn);return}needConn(btn);
  if(!asmState.checked){st.textContent='Looking at which photos are already made…';btn.disabled=true;btn.textContent='Make item photos';return}
  if(asmState.cm){st.textContent='Outfit pictures are painted on the colour-coded masters: no item photos are needed.';btn.disabled=true;btn.textContent='No item photos needed';return}
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
  renderAsmUI()}
/* no photo is ever made by itself (the owner, 2026-11-13: nothing that costs money without a tap; the app is moving to the masters
   and painting). A new or changed item's photo waits for the button above, which shows the cost; the automatic maker that ran 4 s
   after every save of a jacket, shirt, tie, clip or watch (asmAutoSoon, "New items: Make their photo when added") is gone. */
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
  else{o=null;text=`a slim ${clipWord(i)} tie bar, clipped horizontally across the tie about halfway between the knot and the hand, a little narrower than the tie is wide`}
  let refs=[],labels=[];if(o){const r=await outfitRefsFull(o),k=r.labels.map((l,n)=>re.test(l)?n:-1).filter(n=>n>=0);refs=k.map(n=>r.refs[n]);labels=k.map(n=>r.labels[n])}
  if(slot==='shirt'&&i.photo){refs.unshift(i.photo);labels.unshift('the shirt')}   // an outfit's references leave the shirt's photo out (photos are shared by colour); its own piece needs it
  if(slot==='tie'&&i.photo&&!labels.includes('the tie')){refs.unshift(i.photo);labels.unshift('the tie')}   // so do they a tie's photo when it has a close-up (the place goes to the shirt's close-up); its own piece keeps it
  return {mode:'queue',key:asmPieceKey(slot,i),baseKey:slot==='vest'?asmVestKey():asmMasterKey(),swap:{what:slot==='bar'?'tie bar':slot==='vest'?'jacket':slot,text:prettyCols(text),...(slot==='bar'?{add:true}:{})},refs,labels,sig:'asm/piece/'+slot+'/'+asmLook(slot,i),size:ASM_SZ}}
