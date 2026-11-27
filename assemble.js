// Assembled outfit pictures (loaded after tagging.js, before asm-color.js and asm-gl.js; also in asm-worker.js).
// Every outfit picture is painted on a colour-coded master (asm-color.js: the masters, the painting; asm-gl.js: the same painting on the
// graphics chip). This file holds what the painting shares (the cloth tiles and drawings: suit cloth, twill, tweed, linen, ties, shirt
// weaves; the sleeves' tubes and the body's stripe flow; the drawn tie bar) and the plumbing around it: the Web Worker that paints off
// the page, the pictures kept on the device, looks' pictures already on the worker, building ahead and Today's hook (asmFor / asmEnsure).
// (2026-11-14, the owner's order after the audit: the earlier photo-per-item assembler, its master, calibration photos, pieces, zones
// and the atlas-painting trial were deleted; a look with no colour-coded master shows its own photo or the drawing.)
import {ask} from './bus.js';
import {srgbLin8} from './srgb.js';
const ASM_VER=3;   // in every key (asmKey): the colour-coded masters' keys too, so it never changes
const ASM_SIZE=2048;   // a phone paints at 2048 (a larger ASM_CM_SIZE, as some tests set, paints larger and scales to this)
/* ASM_ON: are assembled pictures in use? Off, Today shows each outfit's own photo or drawing and nothing is fetched or painted */
let ASM_ON=!self.ASM_TEST_OFF;   // (tests switch assembled pictures off unless the test file says module.exports.assembled=true: tests/run.js)
try{for(const k of ['asm_paint2','asm_none','asm_vest'])localStorage.removeItem(k)}catch{}   // the earlier assembler's settings on a phone (2026-11-14: deleted)
const asmImg=u=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(new Error('could not read a photo'));im.src=u});
/* a photo as pixels, W wide and high (its own width when not given: photos are square) */
let asmData=async function asmData(u,W){const im=await asmImg(u),w=W||im.naturalWidth,c=document.createElement('canvas');c.width=c.height=w;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,w);return x.getImageData(0,0,w,w)};
/* colours as the eye tells them apart (CIE Lab), so a dark green and a dark navy of one brightness still differ; remembered per photo */
const ASM_LIN=Float32Array.from({length:256},(_,v)=>srgbLin8(v)),asmLabs=new WeakMap();   // (srgb.js)
function asmLab(d){let o=asmLabs.get(d);if(o)return o;const p=d.data,n=p.length>>2,h=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;o=new Float32Array(3*n);
  for(let i=0,j=0;i<n;i++,j+=4){const r=ASM_LIN[p[j]],g=ASM_LIN[p[j+1]],b=ASM_LIN[p[j+2]],X=h((.4124*r+.3576*g+.1805*b)/.9505),Y=h(.2126*r+.7152*g+.0722*b),Z=h((.0193*r+.1192*g+.9505*b)/1.089);
    o[3*i]=116*Y-16;o[3*i+1]=500*(X-Y);o[3*i+2]=200*(Y-Z)}
  asmLabs.set(d,o);return o}
/* connected areas of a mask: each pixel's area number, each area's size and whether it touches the picture's edge */
function asmAreas(m,W){const n=m.length,lab=new Int32Array(n),size=[0],edge=[0],st=[];let k=0;
  for(let s=0;s<n;s++){if(!m[s]||lab[s])continue;k++;size.push(0);edge.push(0);lab[s]=k;st.push(s);
    while(st.length){const i=st.pop(),x=i%W,y=(i-x)/W;size[k]++;if(!x||!y||x===W-1||y===W-1)edge[k]=1;
      if(x&&m[i-1]&&!lab[i-1]){lab[i-1]=k;st.push(i-1)}if(x<W-1&&m[i+1]&&!lab[i+1]){lab[i+1]=k;st.push(i+1)}
      if(y&&m[i-W]&&!lab[i-W]){lab[i-W]=k;st.push(i-W)}if(y<W-1&&m[i+W]&&!lab[i+W]){lab[i+W]=k;st.push(i+W)}}}
  return {lab,size,edge}}
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
/* Woven shirts are painted with their weave laid over the colour (the owner's choice, 2026-11-12, from renders of his own shirts on the
   2048 master). asmWeave(i) -> null (plain), {f:'fleck'}, {f:'col', mm, rot} (a figured shirt) or {f:'tile', mm, hb}:
   - herringbone: the size from Claude's count across the shirt (ASM_SHIRT_MM / sett.tr); a count at the server's cap (80) or none
     gives 12 mm (ASM_HB_TR 45: the owner's pink herringbone as he chose it)
   - a figured weave read from its close-up (dobby diamonds, basket, twill…): the repeat measured in the close-up (asmTexMm), never
     finer than ASM_TEX_MIN_MM: Claude's counts are capped (60 a close-up, 80 a shirt), and his white diamond's uncapped 65 was 3x too big
   - end-on-end, and a weave never read: plain with a faint thread-sized fleck (enlarged, end-on-end's one-thread reading became a
     pinstripe or a check) */
const ASM_SHIRT_MM=550;   // what Claude's "repeats across the item" spans on a shirt
const ASM_TR_CAP=80;   // worker.js cleanPattern's cap on repeatsAcrossItem
const ASM_HB_TR=45;   // a herringbone without a real count: 12 mm
const ASM_CLOSEUP_MM=80;   // the width of cloth a phone close-up shows
const ASM_TEX_MIN_MM=2.9;   // a figured weave is never drawn finer (about 9 px at 2048)
const ASM_PX_MM=3.2;   // the 2048 master: about 32 px a centimetre (shoulder seams ~1460 px apart, ~46 cm; the tie ~6.7 cm mid-chest)
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
/* ---- the jackets' cloths (suits and blazers; also a suit's own trousers on the shirt masters) ---- */
const ASM_SUITV=7;   // how suits are painted: in every look's key (asmSuitSig), so it never changes without a repaint
/* a twill jacket with no band reading (a suit or blazer tagged twill, or the owner's own pattern drawn like twill) is painted with its
   ribs (2026-11-13, his mid grey & brown and light grey & tan twill suits and his charcoal twill blazer): its
   colour with the twill's diagonal ribs in the shading (asmClothOf's twill), fainter than under a stripe
   (amp: at the stripes' .16 the ribs read as lines at this distance, where a real twill reads as a fine texture), and on a two-colour
   twill (a second colour) the ribs lean toward it (mix at a rib's crest). asmTwillTex is the one-colour tile. */
const ASM_TWILL={amp:.06,mix:.22,fleck:.025};
/* (2026-11-13 audit) herringbone jackets with no band reading were flat colour (the owner's charcoal tonal herringbone), and so were his
   own patterns named twill but based on solid (black fine worsted twill, mid grey melange twill): the weave is read from the pattern's
   own name or Claude's description too (asmSuitWeave), and a herringbone gets the herringbone cloth, columns ASM_HB_MM wide */
const ASM_HB_MM=5.4,ASM_HB_AMP=.28,ASM_HB_RIB=3.6,ASM_HB_FLECK=.16,ASM_HB_YARN=.5,ASM_HB_BREAK=0,ASM_HB_THIN=0,ASM_HB_MOTTLE=.13,ASM_HB_FLOAT=.7,ASM_HB_FLOATL=1.1,ASM_HB_SOFT=0,ASM_HB_GRAIN=.1,ASM_HB_SNAP=1,ASM_HB_PBRK=.25;   // a herringbone's ribs are stronger than a plain twill's (.06): at .06 the charcoal tonal herringbone read flat; its close-up shows columns about 5 mm wide
/* a herringbone's ribs meet in clean V's at each column edge only when the column is a whole number of half rib-spacings wide
   (2026-11-13: at 4.4 mm columns and 1.7 mm ribs every rib met its partner 0.18 of a rib off, which the owner saw as jagged V's) */
const asmHbCw=()=>Math.max(1,Math.round(ASM_HB_MM/(ASM_HB_RIB/2)))*ASM_HB_RIB/2;
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
/* (page side) the jacket's drawing, lines widened to ASM_LINE_PX at its painted size -> {c, TW, TH, mm (one repeat across), linen} */
const asmSuitTexMemo=new Map();
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
/* the same choice while painting (asmTubeAt), in whole numbers (2026-11-14, WebGL stage 2): the point in 1/16 px, the lines' points in 1/16
   px and their directions in 1/1024, the products summed in integers, which the graphics chip (asm-gl.js) reproduces exactly; in floats a
   point a hair from the line went to one part here and the other there. (asmTubeTabs keeps the float rule: the setup's key is unchanged) */
const asmTq=v=>Math.round(v*16),asmTqn=v=>Math.round(v*1024),asmTqr=r=>Math.round(-1.3*r*16384);
const asmTubePartQ=(g,X,Y)=>{const k=g.crease;if(!k)return g.parts[0];const U=g.parts[0],L=g.parts[1],x=asmTq(X),y=asmTq(Y),d=(px,py,nx,ny)=>(x-asmTq(px))*asmTqn(nx)+(y-asmTq(py))*asmTqn(ny);
  return d(k.x,k.y,k.mx,k.my)>0?(d(L.x,L.y,L.nx,L.ny)<asmTqr(k.r1)?U:L):(d(U.x,U.y,U.nx,U.ny)<asmTqr(k.r0)?L:U)};
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
function asmTubeAt(g,X,Y){const p=asmTubePartQ(g,X,Y),r=asmTubeRaw(p,X,Y),t=p.t;if(!t)return r;
  let f=(r[1]-t.a0)/t.bs-.5;f=f<0?0:f>t.n-1?t.n-1:f;const i=Math.floor(f),j=Math.min(t.n-1,i+1),w=f-i,c=t.c[i]*(1-w)+t.c[j]*w,Rh=t.R[i]*(1-w)+t.R[j]*w,R=Rh*ASM_TUBE_K;
  let dx=r[0]-c,al=r[1],k=1;const fd=p.fd;
  if(fd){const F=ASM_SLEEVE_FLOW,NS=F.ns,NT=F.nt,Ln=t.n*t.bs;let a=(r[1]-t.a0)/Ln*(NS-1),b=(dx/Rh+1)*(NT-1)/2;a=a<0?0:a>NS-1?NS-1:a;b=b<0?0:b>NT-1?NT-1:b;
    const i0=Math.min(NS-2,a|0),j0=Math.min(NT-2,b|0),fa=a-i0,fb=b-j0,q=i0*NT+j0,lk=T=>(T[q]*(1-fb)+T[q+1]*fb)*(1-fa)+(T[q+NT]*(1-fb)+T[q+NT+1]*fb)*fa;
    dx-=Ln*lk(fd.D);al+=Rh*lk(fd.G);k=fd.k}
  const x=dx/R,ax=Math.abs(x);   // past 0.95 of the radius (a bulge wider than the sleeve's usual width) the cloth carries on at the slope there
  return [(ax<.95?R*Math.asin(x):Math.sign(x)*R*(1.2532+(ax-.95)*3.2026))/k,al/k]}
/* ---- ties (the owner's choice, 2026-11-12, from a prototype of his black, navy & pink stripe, charcoal check and purple foulard ties):
   the tie zone is painted with one repeat of the app's own drawing of the tie's reading (fabricDef, its turn and the swatch's faint
   sheen line left out, rendered three tiles each way and the middle one read, since a lone tile's edges antialias into lines), in the
   reading's own colours (they come from the owner's photos; matching the main colour to the tag shifted the others: a pink stripe went
   lavender), at the reading's angle on the blade and a quarter turn more in the knot (the silk wraps across it), sized by the repeats
   across the blade. A tie with no reading is its tagged colour. */
const ASM_TIEV=1;   // how ties are painted: in the picture's key
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
/* a picture as a JPEG data URL (the worker has its own, on an OffscreenCanvas) */
const setAsmData=f=>{asmData=f},setAsmJpeg=f=>{asmJpeg=f};   // (asm-worker.js and lab/gl-bench-run.js swap in their own decoder and encoder)
let asmJpeg=async function asmJpeg(img){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').putImageData(img,0,0);return c.toDataURL('image/jpeg',.9)};
/* the worker: one picture at a time; the day on screen goes to the front of the line (asmRun(job, true)) */
let asmW=null;
const asmQ=[];
function asmWorker(){if(asmW!==null)return asmW;asmW=false;
  if(typeof Worker==='undefined'||window.ASM_NO_WORKER)return asmW;
  try{const w=new Worker('asm-worker.js',{type:'module'}),st={w,ok:null,busy:null};
    w.onmessage=e=>{const d=e.data||{};if('ready' in d){st.ok=!!d.ready;st.gl=!!d.gl;if(!st.ok)asmWorkerDown();else{asmPump();asmIdleArm()}return}
      if('saving' in d){st.saving=d.saving;asmIdleArm();return}   // (a setup still being saved to disk: asm-worker.js)
      clearTimeout(st.timer);const b=st.busy;st.busy=null;if(b&&b.id===d.id){if(d.error)b.no(new Error(d.error));else b.ok(d.res)}asmPump();asmIdleArm()};
    w.onerror=e=>{e.preventDefault&&e.preventDefault();asmWorkerDown()};
    asmW=st}catch(e){console.warn('no assembly worker',e)}
  return asmW}
/* the worker can't run (it failed to load, or the browser has no OffscreenCanvas): what is waiting is built on the page */
function asmWorkerDown(){const st=asmW;asmW=false;if(st)clearTimeout(st.timer);if(st&&st.w)try{st.w.terminate()}catch{}
  // (a step of asmRunPage's is not a picture: it fails, and asmRunPage paints the look on the page as without a worker)
  const left=[...(st&&st.busy?[st.busy]:[]),...asmQ.splice(0)];for(const t of left){if(t.step)t.no(new Error('the painting worker stopped'));else ask('asm-build',t.job).then(t.ok,t.no)}}
let asmSeq=0;
function asmPump(){const st=asmW;if(!st||!st.ok||st.busy||!asmQ.length)return;clearTimeout(asmIdleT);const t=asmQ.shift();st.busy=t;st.timer=setTimeout(()=>asmStuck(st,t),ASM_RUN_MS);
  st.w.postMessage({id:t.id,job:t.job,...t.step},t.tr||[]);t.tr=null}
/* one message for the worker, in the line (front: the day on screen's, first) -> its answer */
function asmPost(job,front,step,tr){return new Promise((ok,no)=>{const t={id:++asmSeq,job,step,tr,ok,no};if(front)asmQ.unshift(t);else asmQ.push(t);asmPump()})}
/* (CR-8-01, 2026-11-17) the worker is let go when nothing is left to paint, ASM_IDLE_MS after its last answer, and as soon as the app
   is hidden: after one picture it held the master's setup (about 146 MB at 2048) and its graphics-chip textures (about 176 MB) for as
   long as the app was open, in the same memory as the page on an iPhone. Not while a picture is under way or waiting, building ahead or
   warming runs, a step of asmRunPage's is under way, or a setup is still being saved to disk (st.saving): the next picture starts a new
   worker (asmWorker), which reads the setup back from disk (asmCmUnpack, about 0.6 s at phone speed; v3 measured +1.4 s on the next
   repaint, all off the page). The page's own graphics state (asmRunPage's) goes with it (asm-gl.js asmGlFree). Hidden, it is tried
   again every second until it is idle */
let ASM_IDLE_MS=150e3,asmIdleT=0,asmPageN=0;
function asmIdle(){const st=asmW;return !!st&&!!st.w&&!st.busy&&!asmQ.length&&!st.saving&&!asmAheadOn&&!asmPageN&&!ask('asm-cm-warming')}
function asmIdleArm(){clearTimeout(asmIdleT);const st=asmW;if(!st||!st.w)return;asmIdleT=setTimeout(asmIdleEnd,document.hidden?0:ASM_IDLE_MS)}
function asmIdleEnd(){const st=asmW;if(!st||!st.w)return;if(!asmIdle()){if(document.hidden)asmIdleT=setTimeout(asmIdleEnd,1000);return}
  clearTimeout(st.timer);try{st.w.terminate()}catch{}asmW=null;ask('asm-gl-free')}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)asmIdleArm()});
/* (2026-11-14 audit) a picture the worker hasn't answered in ASM_RUN_MS (a hung or crashed worker): it fails, the worker is replaced and
   the line goes on; before, nothing came back and every later picture waited behind it until the app was restarted */
const ASM_RUN_MS=180e3;
function asmStuck(st,t){if(asmW!==st||st.busy!==t)return;console.warn('assembly worker stuck: starting a new one');st.busy=null;try{st.w.terminate()}catch{}
  asmW=null;t.no(new Error('the picture took too long'));asmWorker()}
/* is the picture work off the page (or still finding out)? the build-ahead runs only then */
const asmOffPage=()=>{const st=asmWorker();return !!st&&st.ok!==false};
function asmRun(job,front){const st=asmWorker();if(!st)return ask('asm-build',job);clearTimeout(asmIdleT);
  // (2026-11-14) a worker without WebGL2 (an iPhone before iOS 17 has OffscreenCanvas but no WebGL in a worker): a look the graphics chip
  // covers is drawn on the page's own (asm-gl.js asmGlOnPage), with every CPU part in the worker (asmRunPage); everything else goes to the worker
  const note=r=>{ask('asm-gl-note',r);return r};
  if(ask('asm-gl-on-page',job,st))return asmRunPage(job,front).then(note);
  return asmPost(job,front).then(note)}
/* (CR-8-02, 2026-11-17) a covered look where the worker has no WebGL2: the worker sets the master up and packs its textures, the page
   draws, the worker finishes the picture (asm-gl.js asmGlPrepOff, asmGlPage, asmGlFinOff); the page never works a setup out nor paints
   on its CPU. The worker's CPU paints the look instead when the setup shows it isn't covered after all (asmGlWhy with the setup) or the
   page's chip fails. One look at a time on the page; a step the stopped worker can't answer paints the look on the page, as without a
   worker */
let asmPageChain=Promise.resolve();
function asmRunPage(job,front){const run=async()=>{asmPageN++;
    try{for(let i=0;i<2;i++){const G=ask('asm-gl-state'),have=G&&!G.gl.isContextLost()&&i===0?{key:G.key,gk:G.gk}:{};
        const prep=await asmPost(job,front,{glPrep:have});if(!prep||prep.why)break;
        const fin=await ask('asm-gl-page',job,prep);if(!fin)break;if(fin.again)continue;
        return await asmPost(job,true,{glFin:fin},[fin.o.buffer])}
      return await asmPost({...job,gl:false},true)}   // (the worker has no WebGL2: its CPU)
    catch(e){if(asmW===false)return ask('asm-build',job);throw e}
    finally{asmPageN--;asmIdleArm()}};
  const p=asmPageChain.then(run,run);asmPageChain=p.catch(()=>{});return p}
const ASM_KEEP=150,asmBusy=new Set(),asmTried=new Set();   // 150: the next 60 days' looks (about 43 workdays) and the days before
/* ---- looks' pictures already on the worker ----
   Until 2026-11-16 a computer (the PC builder, since removed) painted the owner's coming looks with this very code and uploaded each
   picture to the worker as an ordinary photo record under its look key (render:<asmOutKey>), signed 'asm/out/cm<ASM_CMV>/<stamp>' (the
   colour-coded masters' version and the newest record date the look is painted from, asmCmStamp). Nothing uploads new ones now; a phone
   still asks for one before it downloads a master (asmGetPre, once a session per look; a look not there is a 404 and is painted here). */
const ASM_PRE_RE=/^asm\/out\/(z|cm)(\d+)\/(\d+)$/;   // ('z': the earlier assembler's pictures, still on the worker, never taken)
/* (listed: the worker's list says it has the picture: asked for even if an earlier ask this session found none, since the computer built
   it since; one download at a time per look) */
/* (2026-11-14 audit) a listed picture that was refused (another signature) is not downloaded again until the list is read again
   (asmPreNo: key -> the list's time): building ahead used to download every refused picture again on every pass. A failed download (no
   network, the worker busy) is not counted as tried: it is asked again after ASM_RETRY_MS */
const asmPreGetting=new Map(),asmPreNo=new Map(),asmRetryAt=new Map(),ASM_RETRY_MS=30e3;
/* (2026-11-14 audit) kept pictures are read by their key range only (start-up read the whole meta store here and again in loadRenders),
   and kept as Blobs (rec.blob): IndexedDB hands back a Blob as a handle, so only stamps and dates are in memory and a picture's bytes are
   read when it is shown (asmImgOf: an object URL). 150 pictures of 0.4-1.4 MB used to sit in memory as base64. A record kept as base64
   before (rec.img) still works and is turned into a Blob a few seconds after start (asmBlobUp) */
const ASM_OUT_RANGE=()=>IDBKeyRange.bound('asm:out:','asm:out;',false,true);   // (';' follows ':')
const asmUrls=new Map();
/* the picture's address for an <img> (and the share sheet's fetch): a Blob's object URL, made once per record; an old record's data URL */
const asmImgOf=(k,a)=>{if(!a)return null;if(!a.blob)return a.img||null;const u=asmUrls.get(k);if(u&&u.b===a.blob)return u.url;if(u)URL.revokeObjectURL(u.url);
  const url=URL.createObjectURL(a.blob);asmUrls.set(k,{b:a.blob,url});return url};
/* one photo record from the worker onto the device (a master, a mask…: each asked for once a session). One download at a time per
   photo: a second ask while the first is on its way waits for it (it used to answer "missing" at once, because the key was already
   marked as tried: the PC builder, since removed, met Today's own download at start-up) */
const asmGetting=new Map();
/* ---- building ahead: the outfits of the next ASM_AHEAD days are painted in the background, nearest the day on screen first, so
   swiping to a day shows its picture at once instead of the drawing for the seconds the picture takes. Only off the page (the
   worker), one at a time, and only from what the worker already keeps: nothing is ordered or paid for. It starts a moment after
   Today is drawn (asmAheadSoon, from asmEnsure) and starts over when the day on screen or the plan changes; a built look is skipped. */
const ASM_AHEAD=60;
const ASM_AHEAD_WAIT=1200;
const ASM_AHEAD_N=3;   // pictures already on the worker downloaded at once while building ahead (one at a time took about 80 s for 40 on 4G)
let asmAheadOn=false;
const setAsmAheadOn=v=>{asmAheadOn=v};   // (asm-today.js asmAhead)
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,get ASM_IDLE_MS(){return ASM_IDLE_MS},set ASM_IDLE_MS(v){ASM_IDLE_MS=v},ASM_RUN_MS,ASM_VER,get asmAheadOn(){return asmAheadOn},asmIdleEnd,asmImgOf,asmLab,asmOffPage,asmPreGetting,asmPreNo,asmQ,asmRetryAt,asmShirtAngles,asmStuck,get asmW(){return asmW},set asmW(v){asmW=v},asmWorker,asmWorkerDown,get ASM_ON(){return ASM_ON},set ASM_ON(v){ASM_ON=v},get asmJpeg(){return asmJpeg},set asmJpeg(v){asmJpeg=v},ASM_AHEAD,ASM_LIN,ASM_METAL,ASM_PX_MM,ASM_SIZE,ASM_TIE_FIG_MAX,ASM_TIE_TEX_MAX,asmBarDraw,asmBusy,get asmData(){return asmData},set asmData(v){asmData=v},asmLinenTile,asmMicroGrid,asmRun,asmSleeveSegs,asmStripeCount,asmTexMm,asmTried,asmTubeAt,asmTubePart,asmTubePartQ,asmTweedTile};
export {setAsmAheadOn,setAsmData,setAsmJpeg,ASM_VER,ASM_SIZE,asmImg,ASM_LIN,asmLab,asmAreas,ASM_BAR_AT,ASM_BAR_MM,ASM_BAR_LEN,ASM_METAL,asmBarDraw,ASM_SHIRT_MM,ASM_TR_CAP,ASM_HB_TR,ASM_CLOSEUP_MM,ASM_TEX_MIN_MM,ASM_PX_MM,asmRepeatPx,asmTexMm,ASM_SUITV,ASM_TWILL,ASM_HB_MM,ASM_HB_AMP,ASM_HB_RIB,ASM_HB_FLECK,ASM_HB_YARN,ASM_HB_BREAK,ASM_HB_THIN,ASM_HB_MOTTLE,ASM_HB_FLOAT,ASM_HB_FLOATL,ASM_HB_SOFT,ASM_HB_GRAIN,ASM_HB_SNAP,ASM_HB_PBRK,asmHbCw,ASM_MICRO,ASM_MICRO_KINDS,asmMicroGrid,asmLinen,ASM_LINE_PX,ASM_STRIPE_PX,ASM_STRIPE,asmLinenTile,ASM_TWEED,asmTweedTile,asmSleeveSegs,ASM_FLOW,asmBodyFlow,asmFlowAt,ASM_CREASE_DEG,ASM_TUBE_K,asmPolyAt,asmTubePart,asmTq,asmTqn,asmTqr,asmTubePartQ,asmTubeRaw,asmTubeTabs,ASM_SLEEVE_FLOW,ASM_FORE_K,asmSleeveFlow,asmTubeAt,ASM_TIEV,asmStripeCount,ASM_TIE_TEX_MAX,ASM_TIE_FIG_MAX,asmShirtAngles,asmQ,asmWorker,asmWorkerDown,asmIdleEnd,ASM_RUN_MS,asmStuck,asmOffPage,asmRun,asmBusy,asmTried,asmPreGetting,asmPreNo,asmRetryAt,ASM_RETRY_MS,asmImgOf,ASM_AHEAD,asmAheadOn,ASM_ON,asmW,ASM_IDLE_MS,asmData,asmJpeg,ASM_BARV,asmSuitTexMemo,asmTieMemo,asmGetting,ASM_KEEP,asmUrls,ASM_PRE_RE,ASM_OUT_RANGE,ASM_AHEAD_WAIT,ASM_AHEAD_N,asmIdleArm};
