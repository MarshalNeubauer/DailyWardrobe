/* The day's watch painted over the colour-coded master's own (2026-11-14, the owner's gold watch: the masters show his steel Seiko and the
   painter keeps the watch zone as the master's pixels, so another watch never showed). Loaded after asm-color.js, on the page and in
   asm-worker.js. It works on the finished picture (assemble.js asmBuild: a JPEG, or the PC's graphics-chip worker's raw pixels), only in
   the watch's square, and only for a watch that doesn't look like the master's (asmWatchPaints); the master's own watch keeps every
   picture's key and pixels as they were.
   - watch/<kind>.png: per master a square crop at 2048 (R dial, G case with bezel, crown and pushers, B strap), soft; watch/geo.json is
     inlined below (its offset, the dial's centre, the strap's axis). Placed on the masters by hand (dial and bezel ellipses on zoomed crops,
     the strap beyond the case along its axis), C:\code\watch-test\... was not needed: the tools are in the session that made them.
   - watch/leather.jpg: 640 px from ambientCG Leather038 (CC0): R grain x128, G relief (lit from the upper left) x128, B roughness.
   The painting is the owner's chosen mockup ("round 3"): from the master's own light, a polished case in the watch's metal, the dial in
   its colour (on a dark dial the printing turned light), and a leather strap (the scan's grain along the strap, a broad calf sheen,
   darker painted edges, a stitch line) or a metal bracelet in the case's metal. The open-collar masters share their buttoned masters'
   watch. Its own version (ASM_WATCHV) is in the look's key (asmWatchSig in asm-color.js asmCmSig). */
const ASM_WATCHV=1;
const ASM_WATCH_GEO={suit:{x:1129,y:1049,n:255,cx:1274,cy:1177,ax:[.312,-.9501]},vest:{x:1123,y:1052,n:267,cx:1275,cy:1180,ax:[.319,-.9478]},
  'shirt-tie':{x:1164,y:630,n:193,cx:1276,cy:742,ax:[.3947,-.9188]},'shirt-open':{x:1171,y:682,n:189,cx:1279,cy:784,ax:[.4391,-.8984]}};
const ASM_WATCH_MASTER={'suit-open':'suit','vest-open':'vest'};
/* the masters' watch: silver, white dial, a metal bracelet. Any other is painted */
const asmWatchPaints=w=>{if(!w||w.type!=='watch')return false;const o=watchOpts(w);return (w.metal||'silver')!=='silver'||o.dial!=='white'||o.band==='leather'};
const asmWatchSig=w=>{const o=watchOpts(w);return ['w'+ASM_WATCHV,w.metal||'silver',o.dial,o.band,o.band==='leather'?colOf(w):''].join('/')};
/* the case's tones per metal: [highlight, colour, shadow]. Gold is the approved mockup's; gunmetal ('other') METAL_TONES.other's, written
   out: the picture worker loads this file without core.js, so nothing of core.js may be read at load time (only inside asmWatchJob,
   asmWatchPaints and asmWatchSig, which run on the page) */
const ASM_WATCH_TONES={gold:['#fff0b8','#c9a227','#5a4310'],rosegold:['#ffe1cf','#c98f78','#5e3426'],other:['#d2d4d7','#868a90','#45494e']};
const asmWatchMetal=w=>{const m=w.metal||'silver';return m==='gold'&&w.primaryColor==='rosegold'?'rosegold':m};
/* the job's part (assemble.js asmJob): what to paint, or null */
function asmWatchJob(o,kind){const w=o&&o.watch;if(!kind||!asmWatchPaints(w))return null;const k=ASM_WATCH_MASTER[kind]||kind,g=ASM_WATCH_GEO[k];if(!g)return null;
  const op=watchOpts(w);return {k,g,metal:asmWatchMetal(w),dial:COLORS[op.dial]||COLORS.charcoal,dark:asmWatchDark(op.dial),band:op.band,strap:colOf(w),mask:'watch/'+k+'.png',leather:'watch/leather.jpg'}}
const asmWatchDark=c=>{const h=COLORS[c]||'#000000',v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);return .2126*v[0]+.7152*v[1]+.0722*v[2]<.45};
const asmWatchMem=new Map();
async function asmWatchImg(u){if(!asmWatchMem.has(u))asmWatchMem.set(u,asmData(u).then(d=>d,e=>{asmWatchMem.delete(u);throw e}));return asmWatchMem.get(u)}
/* three box blurs ~ a Gaussian of sigma r, on a w x h float image */
function asmWatchBlur(a,w,h,r){if(r<=0)return a;const k=Math.max(1,Math.round(r*.9));let s=Float32Array.from(a),t=new Float32Array(a.length);
  const pass=(src,dst,horiz)=>{const n=horiz?w:h,m=horiz?h:w;for(let j=0;j<m;j++){let acc=0;const at=i=>{i=i<0?0:i>=n?n-1:i;return horiz?j*w+i:i*w+j};
      for(let i=-k;i<=k;i++)acc+=src[at(i)];for(let i=0;i<n;i++){dst[at(i)]=acc/(2*k+1);acc+=src[at(i+k+1)]-src[at(i-k)]}}};
  for(let q=0;q<3;q++){pass(s,t,true);pass(t,s,false)}return s}
const asmWatchPct=(a,m,p)=>{const v=[];for(let i=0;i<a.length;i++)if(m[i])v.push(a[i]);if(!v.length)return 1;v.sort((x,y)=>x-y);return v[Math.min(v.length-1,Math.floor(p*v.length))]||1e-3};
/* paint the watch on a finished picture: res {url} (a JPEG) or {px, S} (raw RGBA); returns res with the watch painted */
async function asmWatchPaint(res,W){if(!res||!W)return res;let img=null,px,S;
  if(res.px){px=res.px;S=res.S}else if(res.url){img=await asmData(res.url);px=img.data;S=img.width}else return res;
  const [M,T]=await Promise.all([asmWatchImg(W.mask),W.band==='leather'?asmWatchImg(W.leather):null]);
  asmWatchDo(px,S,W,M,T);
  if(img)res.url=await asmJpeg(img);return res}
function asmWatchDo(px,S,W,M,T){const L=ASM_LIN,f=S/2048,g=W.g,pad=Math.ceil(14*f);
  const X0=Math.max(0,Math.floor(g.x*f)-pad),Y0=Math.max(0,Math.floor(g.y*f)-pad),X1=Math.min(S,Math.ceil((g.x+g.n)*f)+pad),Y1=Math.min(S,Math.ceil((g.y+g.n)*f)+pad),w=X1-X0,h=Y1-Y0,N=w*h;
  const lin=new Float32Array(3*N),Y=new Float32Array(N),D=new Float32Array(N),C=new Float32Array(N),SP=new Float32Array(N);
  const mn=M.width,md=M.data;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const q=j*w+i,p=4*((Y0+j)*S+X0+i);for(let c=0;c<3;c++)lin[3*q+c]=L[px[p+c]];Y[q]=.2126*lin[3*q]+.7152*lin[3*q+1]+.0722*lin[3*q+2];
    // the masks: this pixel in the crop's 2048 frame, bilinear
    const u=(X0+i+.5)/f-g.x-.5,v=(Y0+j+.5)/f-g.y-.5;if(u<0||v<0||u>=mn-1||v>=mn-1)continue;const a=Math.floor(u),b=Math.floor(v),fx=u-a,fy=v-b;
    const s=c=>{const o=4*(b*mn+a)+c,o2=o+4*mn;return ((md[o]*(1-fx)+md[o+4]*fx)*(1-fy)+(md[o2]*(1-fx)+md[o2+4]*fx)*fy)/255};D[q]=s(0);C[q]=s(1);SP[q]=s(2)}
  const out=Float32Array.from(lin),hex=hx=>[1,3,5].map(i=>L[parseInt(hx.slice(i,i+2),16)]),bl=(a,r)=>asmWatchBlur(a,w,h,r*f);
  // the metal: the master's light over the part's lit level (70th percentile); below toward a deep shadow, above toward the highlight
  const metal=(mask,set)=>{const tn=ASM_WATCH_TONES[W.metal];if(!tn)return null;const [HI,G,LO]=tn.map(hex),m=new Uint8Array(N);for(let q=0;q<N;q++)m[q]=mask[q]>.5;const ref=asmWatchPct(Y,m,.7);
    for(let q=0;q<N;q++){const a=mask[q];if(a<.004)continue;const s=Math.min(3,Y[q]/ref);for(let c=0;c<3;c++){const lo=LO[c]*.6,v=s<=1?lo+(G[c]-lo)*Math.pow(s,1.7):G[c]+(HI[c]-G[c])*Math.pow(Math.min(1,(s-1)/.9),.8);set(q,c,v,a)}}};
  const chg=new Uint8Array(N),put=(q,c,v,a)=>{out[3*q+c]=out[3*q+c]*(1-a)+v*a;chg[q]=1};
  // the strap first (it lies under the case), then the case, then the dial
  if(W.band==='leather'&&T){
    // a clean outline over the old bracelet's: smoothed from a lower cut, never inside the strap part, within the watch zone
    const z=new Float32Array(N);for(let q=0;q<N;q++)z[q]=D[q]+C[q]+SP[q]>.02?1:0;const zb=bl(z,1.5);
    let b=new Float32Array(N);for(let q=0;q<N;q++)b[q]=SP[q]>.3?1:0;b=bl(b,2.5);for(let q=0;q<N;q++)b[q]=b[q]>.42?1:0;let St=bl(b,.9);for(let q=0;q<N;q++)St[q]=zb[q]>.05?Math.max(St[q],SP[q]):0;
    const in5=bl(St,5),in16=bl(St,1.6),m=new Float32Array(N);for(let q=0;q<N;q++)m[q]=St[q]>.5?1:0;
    const num=bl(Float32Array.from(Y,(v,q)=>v*m[q]),14),den=bl(m,14),Ys=Float32Array.from(num,(v,q)=>v/Math.max(den[q],1e-3)),ref=asmWatchPct(Ys,m,.6);
    const LC=hex(W.strap),SH=hex('#e9cfa8'),ST=hex('#cdb088'),tn=T.width,td=T.data,TS=1.5,ax=g.ax,pxv=[-ax[1],ax[0]];
    const tx=(tu,tv,c)=>{tu=((tu%(tn-1))+(tn-1))%(tn-1);tv=((tv%(tn-1))+(tn-1))%(tn-1);const a=Math.floor(tu),b2=Math.floor(tv),fx=tu-a,fy=tv-b2,o=4*(b2*tn+a)+c,o2=o+4*tn;
      return (td[o]*(1-fx)+td[o+4]*fx)*(1-fy)+(td[o2]*(1-fx)+td[o2+4]*fx)*fy};
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){const q=j*w+i,a=St[q];if(a<.01)continue;
      const dx=(X0+i)/f-g.cx,dy=(Y0+j)/f-g.cy,u=dx*ax[0]+dy*ax[1],v=dx*pxv[0]+dy*pxv[1],tu=tn/2+v*TS,tv=tn/2+u*TS;
      const gr=tx(tu,tv,0)/128,rl=tx(tu,tv,1)/128,ro=tx(tu,tv,2)/255;
      const sh=Math.pow(Math.min(1.35,Math.max(.45,Ys[q]/ref)),1.2),edge=.5+.5*Math.min(1,Math.max(0,in5[q]*2-.45)),pe=Math.min(1,Math.max(0,(in16[q]-.5)*3));
      const k=sh*edge*Math.pow(Math.max(gr,1e-3),1.1)*Math.pow(Math.max(rl,1e-3),.7)*(.72+.28*pe);
      const lat=Math.min(1,Math.max(0,(in5[q]-.55)/.45)),sheen=Math.min(1,Math.max(0,Math.pow(lat,1.5)*Math.min(1,Math.max(0,sh-.8))*(1.25-ro)*Math.min(1.6,Math.max(.6,rl))))*.6;
      const stitch=in5[q]>.24&&in5[q]<.34&&Math.floor(u/4.5)%2===0;
      for(let c=0;c<3;c++){let vv=LC[c]*k;vv+=(SH[c]*.3-vv)*sheen;if(stitch)vv=vv*.45+ST[c]*.55;put(q,c,vv,a)}}}
  else if(W.band!=='leather')metal(SP,put);   // a metal bracelet in the case's metal (silver: as the master)
  metal(C,put);
  if(W.dial!==COLORS.white){const DC=hex(W.dial),MK=hex('#d9d4c4'),m=new Uint8Array(N);for(let q=0;q<N;q++)m[q]=D[q]>.5;const ref=asmWatchPct(Y,m,.75),big=bl(Y,9),sm=bl(Y,2.5);
    for(let q=0;q<N;q++){const a=D[q];if(a<.004)continue;
      if(W.dark){const fine=Math.min(1,Math.max(0,(sm[q]-Y[q])/ref)),k=Math.min(1.15,Math.max(.7,big[q]/ref)),t=Math.min(.9,fine*2.6);for(let c=0;c<3;c++){const d=DC[c]*k;put(q,c,d+(MK[c]-d)*t,a)}}
      else{const k=Math.min(1.1,Math.max(.35,Y[q]/ref));for(let c=0;c<3;c++)put(q,c,DC[c]*k,a)}}}   // a light dial: its colour, the printing as dark as before
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const q=j*w+i;if(!chg[q])continue;const p=4*((Y0+j)*S+X0+i);for(let c=0;c<3;c++)px[p+c]=gam(out[3*q+c])}}   // only what was painted
