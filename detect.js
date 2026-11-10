/* Daily Wardrobe: pattern detection from item photos (main thread: needs canvas) */
/* Pattern detection from the item photo.
   - stripes:     1-D band sequence + angle            (stripe, pinstripe, chalk stripe)
   - checks:      two perpendicular band sequences      (check, gingham, tattersall, windowpane, glen check)
   Fine weaves (herringbone, birdseye, nailhead, sharkskin, twill) are not measured: a phone photo of a whole
   garment doesn't resolve them reliably, so they use drawn tiles with the correct orientation.
   Colours always come from the item's tagged colours, matched by brightness rank, so photo colour casts don't leak in. */
const STRIPE_PATS=['stripe','pinstripe','fine-stripe','chalk-stripe'],CHECK_PATS=['check','gingham','tattersall','windowpane','glen-check'];
const DETECT_PATS=[...STRIPE_PATS,...CHECK_PATS];

/* region -> luminance grid (downscaled to at most 256px) */
function lumGrid(src,sx,sy,size){
  const N=Math.max(48,Math.round(Math.min(256,size)));
  const cv=document.createElement('canvas');cv.width=cv.height=N;
  const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(src,sx,sy,size,size,0,0,N,N);
  const d=g.getImageData(0,0,N,N).data,L=new Float32Array(N*N);
  for(let i=0;i<N*N;i++)L[i]=(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255;
  return {N,L,scale:size/N};
}
const boxBlur=(a,N)=>{const o=new Float32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){let s=0,c=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<N&&Y<N){s+=a[Y*N+X];c++}}o[y*N+x]=s/c}return o};
function sobel(B,N){const gx=new Float32Array(N*N),gy=new Float32Array(N*N);
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){const p=(X,Y)=>B[Y*N+X];
    gx[y*N+x]=(p(x+1,y-1)+2*p(x+1,y)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x-1,y)+p(x-1,y+1));
    gy[y*N+x]=(p(x-1,y+1)+2*p(x,y+1)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x,y-1)+p(x+1,y-1));}
  return {gx,gy}}
/* average a per-pixel map along lines perpendicular to angle -> 1-D profile along the angle */
function project(M,N,ang){const R=Math.ceil(N*Math.SQRT1_2)+1,len=2*R,sum=new Float64Array(len),cnt=new Float64Array(len),cs=Math.cos(ang),sn=Math.sin(ang);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=Math.floor((x-N/2)*cs+(y-N/2)*sn+R);sum[t]+=M[y*N+x];cnt[t]++}
  const pr=[];for(let i=0;i<len;i++)if(cnt[i]>=N/3)pr.push(sum[i]/cnt[i]);return pr}
const variance=pr=>{const m=pr.reduce((a,b)=>a+b,0)/pr.length;return pr.reduce((a,v)=>a+(v-m)**2,0)/pr.length};
const normAng=t=>{while(t<=-Math.PI/2)t+=Math.PI;while(t>Math.PI/2)t-=Math.PI;return t};
/* repeat length of a profile via autocorrelation (sub-sample precision) */
function period(prof,minLag=6){return periodCh([prof],[1],minLag)}
/* the same over several channels at once (L*, a*, b*): a red line and a green one of the same lightness are told apart */
function periodCh(chs,wts,minLag=6){
  const Ps=chs.map(ch=>{const m=ch.reduce((a,b)=>a+b,0)/ch.length;return ch.map(v=>v-m)}),N=Ps[0].length;
  const ac=l=>{let a=0,b=0,c=0;Ps.forEach((P,k)=>{const w=wts[k];for(let i=0;i+l<N;i++){a+=w*P[i]*P[i+l];b+=w*P[i]*P[i];c+=w*P[i+l]*P[i+l]}});return a/(Math.sqrt(b*c)||1)};
  const P=Ps[0];
  const maxLag=Math.floor(P.length*.67),r=[];for(let l=0;l<=maxLag;l++)r.push(l<minLag-1?-1:ac(l));
  let best=-1,T=0;for(let l=minLag;l<maxLag;l++)if(r[l]>r[l-1]&&r[l]>=r[l+1]&&r[l]>best){best=r[l];T=l}
  if(!T||best<.35)return null;
  // a clean pattern matches itself almost as well at two or three repeats: take the shortest whole fraction that matches nearly as well
  for(let k=6;k>=2;k--){const f=Math.round(T/k);if(f<minLag)continue;let m=f;for(let d=-2;d<=2;d++)if(r[f+d]>r[m])m=f+d;if(r[m]>.9*best&&r[m]>=r[m-1]&&r[m]>=(r[m+1]??-1)){T=m;break}}
  const y0=r[T-1],y1=r[T],y2=r[T+1]??y1,den=y0-2*y1+y2;
  return {T:T+(den?.5*(y0-y2)/den:0),corr:best};
}
/* fold one repeat and cluster it into k brightness levels -> [[rank, fraction], ...] (rank 0 = darkest) */
function foldBands(prof,nColors){
  const pd=period(prof);if(!pd)return null;const Tf=pd.T;
  const M=Math.max(12,Math.round(Tf)),fs=new Float64Array(M),fc=new Float64Array(M);
  prof.forEach((v,i)=>{const k=Math.floor(((i%Tf)/Tf)*M)%M;fs[k]+=v;fc[k]++});
  const F=[...fs].map((v,k)=>v/(fc[k]||1));
  const k=Math.max(2,Math.min(3,nColors)),lo=Math.min(...F),hi=Math.max(...F);
  if(hi-lo<.04)return null;
  let C=k===2?[lo,hi]:[lo,(lo+hi)/2,hi],lab=new Array(M).fill(0);
  for(let it=0;it<20;it++){
    lab=F.map(v=>{let bi=0;for(let j=1;j<k;j++)if(Math.abs(v-C[j])<Math.abs(v-C[bi]))bi=j;return bi});
    C=C.map((c,j)=>{const m=F.filter((_,i)=>lab[i]===j);return m.length?m.reduce((a,b)=>a+b,0)/m.length:c});
  }
  const order=C.map((c,j)=>[c,j]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]),rank=[];order.forEach((j,ri)=>rank[j]=ri);
  lab=lab.map(j=>rank[j]);
  let runs=[];for(let i=0;i<M;i++){if(runs.length&&runs[runs.length-1][0]===lab[i])runs[runs.length-1][1]++;else runs.push([lab[i],1])}
  if(runs.length>1&&runs[0][0]===runs[runs.length-1][0])runs[0][1]+=runs.pop()[1];
  const minW=Math.max(1,M*.025);
  for(let pass=0;pass<3;pass++){
    runs=runs.filter((rn,i)=>{if(rn[1]<minW&&runs.length>2){runs[(i+runs.length-1)%runs.length][1]+=rn[1];return false}return true});
    const m=[];for(const rn of runs){if(m.length&&m[m.length-1][0]===rn[0])m[m.length-1][1]+=rn[1];else m.push(rn)}
    if(m.length>1&&m[0][0]===m[m.length-1][0])m[0][1]+=m.pop()[1];runs=m;
  }
  if(runs.length<2||runs.length>14)return null;
  let out=runs.map(([c,w])=>[c,w/M]),T=Tf;
  // the autocorrelation sometimes locks onto two repeats: collapse a sequence that is its own half twice
  const h=out.length/2;
  if(out.length>=4&&out.length%2===0&&out.slice(0,h).every((r,i)=>r[0]===out[i+h][0]&&Math.abs(r[1]-out[i+h][1])<.06)){
    const half=out.slice(0,h).map((r,i)=>[r[0],r[1]+out[i+h][1]]);out=half;T=Tf/2;
  }
  return {runs:out,T};
}

function analyzeStripes(src,sx,sy,size,nColors){
  const {N,L,scale}=lumGrid(src,sx,sy,size),B=boxBlur(boxBlur(L,N),N),{gx,gy}=sobel(B,N);
  let jxx=0,jyy=0,jxy=0;for(let i=0;i<N*N;i++){jxx+=gx[i]*gx[i];jyy+=gy[i]*gy[i];jxy+=gx[i]*gy[i]}
  const coh=Math.sqrt((jxx-jyy)**2+4*jxy*jxy)/((jxx+jyy)||1);if(coh<.25)return null;
  // tensor angle can be 1-2 degrees off, which smears thin lines: keep the sharpest projection nearby.
  // Profiles use the unblurred image: averaging along the stripe already removes the weave texture.
  let th=.5*Math.atan2(2*jxy,jxx-jyy),bt=th,bv=-1;
  for(let dd=-4;dd<=4;dd+=.25){const a=th+dd*Math.PI/180,v=variance(project(L,N,a));if(v>bv){bv=v;bt=a}}
  th=normAng(bt);
  const f=foldBands(project(L,N,th),nColors);if(!f)return null;
  return {kind:'stripes',a:Math.round(th*180/Math.PI),runs:f.runs,Tpx:f.T*scale};
}

function analyzeChecks(src,sx,sy,size,nColors){
  const {N,L,scale}=lumGrid(src,sx,sy,size);
  // the axis pair whose two projections are jointly sharpest
  const score=a=>variance(project(L,N,a))+variance(project(L,N,a+Math.PI/2));
  let ba=0,bs=-1;for(let d=0;d<90;d+=2){const a=d*Math.PI/180,s=score(a);if(s>bs){bs=s;ba=a}}
  for(let dd=-2;dd<=2;dd+=.25){const a=ba+dd*Math.PI/180,s=score(a);if(s>bs){bs=s;ba=a}}
  const pu=project(L,N,ba),pv=project(L,N,ba+Math.PI/2),vu=variance(pu),vv=variance(pv);
  const fu=foldBands(pu,nColors),fv=foldBands(pv,nColors);
  // one strong axis only -> it's really a stripe
  if(fu&&(!fv||vv<.2*vu))return {kind:'stripes',a:Math.round(normAng(ba)*180/Math.PI),runs:fu.runs,Tpx:fu.T*scale};
  if(fv&&(!fu||vu<.2*vv))return {kind:'stripes',a:Math.round(normAng(ba+Math.PI/2)*180/Math.PI),runs:fv.runs,Tpx:fv.T*scale};
  if(!fu||!fv)return null;
  return {kind:'check',a:Math.round(normAng(ba)*180/Math.PI),runs:fu.runs,vruns:fv.runs,ratio:fv.T/fu.T,Tpx:fu.T*scale};
}

/* map brightness ranks onto colour roles. A missing secondary still gets the auto accent colour (role 's'),
   so a grey suit tagged with one colour keeps a lighter pinstripe. */
function mapRuns(runs,item){
  const roles=[['p',COLORS[primaryCol(item)]]];
  roles.push(['s',item.secondaryColor&&COLORS[item.secondaryColor]||accentOf(item)]);
  if(item.tertiaryColor&&COLORS[item.tertiaryColor])roles.push(['t',COLORS[item.tertiaryColor]]);
  roles.sort((a,b)=>lum(a[1])-lum(b[1]));
  const k=Math.max(...runs.map(r=>r[0]))+1;
  const use=k>=roles.length?roles:roles.filter(r=>r[0]!=='t').slice(0,k);
  const pick=rk=>use[Math.round(rk*(use.length-1)/Math.max(1,k-1))][0];
  let bands=runs.map(([rk,f])=>[pick(rk),+f.toFixed(3)]);
  let si=0,bw=-1;bands.forEach((b,i)=>{if(b[0]==='p'&&b[1]>bw){bw=b[1];si=i}});
  return bands.slice(si).concat(bands.slice(0,si));
}
function detectPattern(item,src,sx,sy,size){
  const p=item.pattern,n=[primaryCol(item),item.secondaryColor,item.tertiaryColor].filter(Boolean).length;
  let r=null;
  if(CHECK_PATS.includes(p))r=analyzeChecks(src,sx,sy,size,n);
  else if(STRIPE_PATS.includes(p))r=analyzeStripes(src,sx,sy,size,n);
  if(!r)return null;
  const out={kind:r.kind,a:r.a,b:mapRuns(r.runs,item)};
  if(r.kind==='check'){out.v=mapRuns(r.vruns,item);out.r=+Math.max(.33,Math.min(3,r.ratio)).toFixed(2)}
  return out;
}
/* for a queued item: swatch region first, then a larger area */
function detectQueued(q,it){
  if(!DETECT_PATS.includes(it.pattern))return null;
  const src=q.big;if(!src)return null;
  const W=src.width,H=src.height,mn=Math.min(W,H),cx=(Number(q.cx)||.5)*W,cy=(Number(q.cy)||.5)*H;
  for(const sz of [mn*(.5/(Number(q.zoom)||1)),mn*.7]){
    const sx=Math.max(0,Math.min(W-sz,cx-sz/2)),sy=Math.max(0,Math.min(H-sz,cy-sz/2));
    const r=detectPattern(it,src,sx,sy,sz);if(r)return r;
  }
  return null;
}


/* ---- the full sett from a close-up (a woven stripe, check or plaid, in its real colours) ----
   The close-up is white-balanced and taken for its colour, so here the colours DO come from the photo: the bands of one
   repeat across the main stripes (median CIELAB per band, merged until neighbours differ visibly), and the lines that cross
   them in the other direction (what is left once the main stripes are taken out). Result (item.sett):
   {v:2, a: angle across the main stripes (deg, in the close-up), bands:[[hex,w]...] (w: share of one repeat),
    cross: {d: angle between the two directions, bands:[[hex|null,w]...], r: cross repeat / main repeat} or null,
    cr: repeats across the close-up's width (the swatch draws the same scale), src:'closeup'} */
function labGrid(src,sx,sy,sw,sh,N=280){
  const k=N/Math.max(sw,sh),W=Math.max(16,Math.round(sw*k)),H=Math.max(16,Math.round(sh*k));
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(src,sx,sy,sw,sh,0,0,W,H);
  const d=g.getImageData(0,0,W,H).data,n=W*H,L=new Float32Array(n),A=new Float32Array(n),Bb=new Float32Array(n),Y=new Float32Array(n);
  for(let i=0;i<n;i++){const l=rgbLab(d[i*4],d[i*4+1],d[i*4+2]);L[i]=l[0];A[i]=l[1];Bb[i]=l[2];Y[i]=(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255}
  return {W,H,L,A,B:Bb,Y}}
/* the projection index of every pixel along an angle, for a W x H grid */
function projIdx(W,H,ang){const R=Math.ceil(Math.hypot(W,H)/2)+1,cs=Math.cos(ang),sn=Math.sin(ang),idx=new Int32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)idx[y*W+x]=Math.floor((x-W/2)*cs+(y-H/2)*sn+R);return {idx,len:2*R}}
function projAvg(M,P){const s=new Float64Array(P.len),c=new Float64Array(P.len);for(let i=0;i<M.length;i++){s[P.idx[i]]+=M[i];c[P.idx[i]]++}
  return {avg:[...s].map((v,i)=>c[i]?v/c[i]:0),cnt:[...c]}}
const boxBlurWH=(a,W,H)=>{const o=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0,c=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<W&&Y<H){s+=a[Y*W+X];c++}}o[y*W+x]=s/c}return o};
/* fold a Lab profile on its repeat (or take it whole) and merge it into bands */
/* one repeat in M steps, each the median colour of its pixels (a median, so lines crossing the band don't tint it) */
function foldMedian(G,P,first,len,okIdx,T,skip){const M=Math.max(24,Math.min(400,Math.round(T))),bins=Array.from({length:M},()=>[[],[],[]]);
  for(let i=0;i<G.L.length;i++){const pi=P.idx[i],t=pi-first;if(t<0||t>=len||!okIdx[pi]||skip&&skip[i])continue;const b=bins[Math.floor(((t%T)/T)*M)%M];b[0].push(G.L[i]);b[1].push(G.A[i]);b[2].push(G.B[i])}
  const med=v=>{v.sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};return bins.filter(b=>b[0].length).map(b=>[med(b[0]),med(b[1]),med(b[2])])}
function settBands(labs,minShare){
  let bands=labs.map(lab=>({lab,w:1,steps:[lab]}));
  const mergeInto=(to,k)=>{const x=bands[to],y=bands[k],w=x.w+y.w;bands[to]={lab:x.lab.map((v,i)=>(v*x.w+y.lab[i]*y.w)/w),w,steps:to<k?[...x.steps,...y.steps]:[...y.steps,...x.steps]};bands.splice(k,1)};
  const nb=i=>(i+1)%bands.length,merge=i=>{const j=nb(i);if(j===0){bands.unshift(bands.pop());mergeInto(0,1)}else mergeInto(i,j)};
  // merge the most alike neighbours while they are hard to tell apart, or while there are too many
  for(;;){if(bands.length<3)break;let bi=-1,bd=1e9;for(let i=0;i<bands.length;i++){const d=dE00(bands[i].lab,bands[nb(i)].lab);if(d<bd){bd=d;bi=i}}
    if(bd>=5&&bands.length<=24)break;merge(bi)}
  // a band one or two steps wide whose colour lies between its two neighbours is the blur where they meet, not a band of its own
  // (a real pinline is darker or lighter than both and stays)
  const between=(c,a,b)=>{const ab=a.map((v,i)=>b[i]-v),t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(c[i]-a[i]),0)/(ab.reduce((s,v)=>s+v*v,0)||1)));
    return Math.hypot(...c.map((v,i)=>v-(a[i]+t*ab[i])))<Math.max(6,.25*Math.hypot(...ab))&&t>.1&&t<.9};   // a camera's blend of two colours bows away from the straight line in Lab
  for(let pass=0;pass<40&&bands.length>2;pass++){const k=bands.findIndex((b,i)=>b.w<=2.5&&between(b.lab,bands[(i+bands.length-1)%bands.length].lab,bands[nb(i)].lab));if(k<0)break;
    const p=(k+bands.length-1)%bands.length,q=nb(k);mergeInto(dE00(bands[k].lab,bands[p].lab)<dE00(bands[k].lab,bands[q].lab)?p:q,k)}
  // slivers (the blur between two bands) join the neighbour they look most like; then neighbours that became alike merge
  for(let pass=0;pass<12;pass++){const tot=bands.reduce((s,b)=>s+b.w,0);const k=bands.findIndex(b=>b.w/tot<minShare);if(k<0||bands.length<3)break;
    const p=(k+bands.length-1)%bands.length,q=nb(k),to=dE00(bands[k].lab,bands[p].lab)<dE00(bands[k].lab,bands[q].lab)?p:q;mergeInto(to,k)}
  for(let i=0;i<bands.length&&bands.length>2;){if(dE00(bands[i].lab,bands[nb(i)].lab)<5)merge(i);else i++}
  // a sequence that is k copies of itself (the repeat was taken k times over) keeps one copy
  for(let k=4;k>=2;k--){if(bands.length%k)continue;const n=bands.length/k;
    if(bands.every((b,i)=>i<n||dE00(b.lab,bands[i%n].lab)<6&&Math.abs(b.w-bands[i%n].w)<=Math.max(2,bands[i%n].w*.25))){bands=bands.slice(0,n).map((b,i)=>({lab:b.lab,w:bands.filter((_,j)=>j%n===i).reduce((s,x)=>s+x.w,0),steps:b.steps}));break}}
  // a narrow band (a pinstripe, a pinline) is blurred into its neighbours by the camera: its colour is its strongest step
  // (the one furthest from the colour around it) and its width the steps at half that contrast or more
  if(bands.length>=2)bands=bands.map((b,i)=>{if(b.steps.length>6||b.w/bands.reduce((s,x)=>s+x.w,0)>.2)return b;
    const nb2=[bands[(i+bands.length-1)%bands.length],bands[(i+1)%bands.length]],ground=nb2[0].w>=nb2[1].w?nb2[0].lab:nb2[1].lab;
    const con=b.steps.map(st=>dE00(st,ground)),pk=Math.max(...con),k=con.indexOf(pk);if(pk<8)return b;
    return {lab:b.steps[k],w:Math.max(1,con.filter(c=>c>=pk*.5).length),steps:b.steps}});
  const tot=bands.reduce((s,b)=>s+b.w,0);return bands.map(b=>({lab:b.lab,w:b.w/tot}))}
/* the sett of a rectangle of a canvas (sx, sy, sw, sh in its pixels). The directions are found on a 320px copy; the bands and
   lines are measured on a sharper one (up to 900px), so a pinstripe a pixel or two wide keeps its width and colour. */
const detrend=(a,w)=>{const n=a.length,pre=[0];for(const v of a)pre.push(pre[pre.length-1]+v);   // minus a moving average: slow light falloff and folds go
  return a.map((v,i)=>{const lo=Math.max(0,i-w),hi=Math.min(n,i+w+1);return v-(pre[hi]-pre[lo])/(hi-lo)})};
function analyzeSett(src,sx,sy,sw,sh){
  const g0=labGrid(src,sx,sy,sw,sh,320),Bl=boxBlurWH(boxBlurWH(g0.Y,g0.W,g0.H),g0.W,g0.H);
  let jxx=0,jyy=0,jxy=0;for(let y=1;y<g0.H-1;y++)for(let x=1;x<g0.W-1;x++){const p=(X,Y)=>Bl[Y*g0.W+X];
    const gx=(p(x+1,y-1)+2*p(x+1,y)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x-1,y)+p(x-1,y+1)),gy=(p(x-1,y+1)+2*p(x,y+1)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x,y-1)+p(x+1,y-1));
    jxx+=gx*gx;jyy+=gy*gy;jxy+=gx*gy}
  const coh=Math.sqrt((jxx-jyy)**2+4*jxy*jxy)/((jxx+jyy)||1);if(coh<.08)return null;
  const keepOf=(c,G)=>c.map(v=>v>=Math.min(G.W,G.H)/3);
  // the main direction: the projection whose colour (L*, chroma at half weight) varies most near the tensor angle
  const colVar=ang=>{const P=projIdx(g0.W,g0.H,ang),l=projAvg(g0.L,P),a=projAvg(g0.A,P),b=projAvg(g0.B,P),k=keepOf(l.cnt,g0),pick=v=>v.avg.filter((_,i)=>k[i]);return variance(pick(l))+.5*(variance(pick(a))+variance(pick(b)))};
  let th=.5*Math.atan2(2*jxy,jxx-jyy),bt=th,bv=-1;for(let dd=-8;dd<=8;dd+=.5){const a=th+dd*Math.PI/180,v=colVar(a);if(v>bv){bv=v;bt=a}}th=normAng(bt);
  // the crossing direction, on the small copy: the residual (each pixel minus its main band), detrended, varies most across it
  const P0=projIdx(g0.W,g0.H,th),l0=projAvg(g0.L,P0),res0=new Float32Array(g0.L.length);for(let i=0;i<res0.length;i++)res0[i]=g0.L[i]-l0.avg[P0.idx[i]];
  const resVar=(G,res,d)=>{const Q=projIdx(G.W,G.H,th+d*Math.PI/180),r=projAvg(res,Q),k=keepOf(r.cnt,G),f0=k.indexOf(true),f1=k.lastIndexOf(true),rp=r.avg.slice(f0,f1+1);
    return {Q,f0,rp:detrend(rp,Math.max(9,Math.round(rp.length*.2)))}};
  let ca=0,cv=-1;for(let d=30;d<=150;d+=2){const v=variance(resVar(g0,res0,d).rp);if(v>cv){cv=v;ca=d}}
  // the sharp copy: profile, repeat, bands
  const G=labGrid(src,sx,sy,sw,sh,Math.max(320,Math.min(900,Math.round(Math.max(sw,sh))))),{W,H}=G,n=W*H;
  const P=projIdx(W,H,th),pl=projAvg(G.L,P),pa=projAvg(G.A,P),pb=projAvg(G.B,P),ok=keepOf(pl.cnt,G),first=ok.indexOf(true),last=ok.lastIndexOf(true);
  const cut=a=>a.slice(first,last+1),prof={L:cut(pl.avg),A:cut(pa.avg),B:cut(pb.avg)};
  const pd=periodCh([prof.L,prof.A,prof.B],[1,.7,.7],Math.max(8,Math.round(prof.L.length*.02)));   // in colour; not the weave's own texture
  const T=pd&&pd.T<prof.L.length*.8?pd.T:prof.L.length;   // no repeat inside the picture: what is seen counts as one repeat
  const cvMain=variance(prof.L);let cross=null,inLine=null;
  if(self.SETT_DEBUG)console.log('sett',JSON.stringify({W,H,coh:+coh.toFixed(2),th:Math.round(th*180/Math.PI),T:+T.toFixed(1),len:prof.L.length,cv:+cv.toFixed(2),ca,cvMain:+cvMain.toFixed(1)}));
  if(cv>Math.max(2,cvMain*.005)){   // lines of about 1.5 L* or more stand out, whatever the main stripes do
    const res=new Float32Array(n),resA=new Float32Array(n),resB=new Float32Array(n);for(let i=0;i<n;i++){const pi=P.idx[i];res[i]=G.L[i]-pl.avg[pi];resA[i]=G.A[i]-pa.avg[pi];resB[i]=G.B[i]-pb.avg[pi]}
    const {Q,f0,rp}=resVar(G,res,ca),rA=resVar(G,resA,ca).rp,rB=resVar(G,resB,ca).rp;
    const cp=periodCh([rp,rA,rB],[1,.7,.7],Math.max(8,Math.round(rp.length*.04))),   // crossing lines are never as close as the weave's texture
      Tc=cp&&cp.T<rp.length*.8?cp.T:rp.length;
    // one repeat of the residual, smoothed, in three levels: lighter lines, nothing, darker lines
    const M=Math.max(24,Math.min(400,Math.round(Tc))),fold=new Float64Array(M),fc=new Float64Array(M);rp.forEach((v,i)=>{const q=Math.floor(((i%Tc)/Tc)*M)%M;fold[q]+=v;fc[q]++});
    const f0v=[...fold].map((v,q)=>v/(fc[q]||1)),fv=f0v.map((_,q)=>(f0v[(q+M-1)%M]+2*f0v[q]+f0v[(q+1)%M])/4),fsd=Math.sqrt(variance(fv));
    const thr=Math.min(fsd*1.1,.6*Math.max(...fv.map(Math.abs))),lvl=fv.map(v=>v>thr?1:v<-thr?-1:0);   // (a gingham's even square wave never passes 1.1 x its own spread)
    for(let q=0;q<M;q++)if(lvl[q]&&lvl[(q+M-1)%M]!==lvl[q]&&lvl[(q+1)%M]!==lvl[q])lvl[q]=0;   // a line is at least two steps wide
    // runs of one level; each line run gets its own thread colour (a tattersall's red and green lines stay apart):
    // a crossing is about half band, half thread, so thread = 2 x pixel - band
    const rid=new Int32Array(M).fill(-1),runs=[];for(let q=0;q<M;q++){if(q&&lvl[q]===lvl[q-1])rid[q]=runs.length-1;else{runs.push({l:lvl[q],w:0,s:[0,0,0,0]});rid[q]=runs.length-1}runs[rid[q]].w++}
    if(runs.length>1&&runs[0].l===runs[runs.length-1].l){const a=runs.pop();runs[0].w+=a.w;for(let q=0;q<M;q++)if(rid[q]===runs.length)rid[q]=0}
    // the pixels under the scarcer kind of line are left out when the bands are measured (with lines all across, like a gingham's
    // alternating weft, masking both would leave nothing)
    const wOf=l=>runs.filter(r=>r.l===l).reduce((a,r)=>a+r.w,0),maskL=wOf(1)&&wOf(-1)?(wOf(1)<wOf(-1)?1:-1):(wOf(1)?1:-1);
    inLine=new Uint8Array(n);
    for(let i=0;i<n;i++){const t=Q.idx[i]-f0;if(t<0||t>=rp.length)continue;const q=Math.floor(((t%Tc)/Tc)*M)%M,ru=runs[rid[q]];if(!ru||!ru.l)continue;if(ru.l===maskL||!(wOf(1)&&wOf(-1)))inLine[i]=ru.l===maskL?1:0;
      if(Math.sign(res[i])!==ru.l)continue;const pi=P.idx[i];ru.s[0]+=2*G.L[i]-pl.avg[pi];ru.s[1]+=2*G.A[i]-pa.avg[pi];ru.s[2]+=2*G.B[i]-pb.avg[pi];ru.s[3]++}
    const labOfRun=ru=>{if(!ru.s[3])return null;const a=ru.s[1]/ru.s[3],b=ru.s[2]/ru.s[3],C=Math.hypot(a,b),k=C>70?70/C:1;   // capped: a cloth is not neon
      return [Math.max(0,Math.min(100,ru.s[0]/ru.s[3])),a*k,b*k]};
    // threads that look alike share one colour (so the drawing isn't speckled with near-identical shades)
    const cols=[];for(const ru of runs){const lab=ru.l&&labOfRun(ru);if(!lab){ru.hex=null;continue}let c=cols.find(c=>dE00(c.lab,lab)<10);if(!c){c={lab,n:0,sum:[0,0,0]};cols.push(c)}c.n++;c.sum=c.sum.map((v,k)=>v+lab[k]);ru.c=c}
    for(const c of cols)c.hex=labHex(c.sum.map(v=>v/c.n));
    const out=[];for(const ru of runs){const h=ru.l&&ru.c?ru.c.hex:null;if(out.length&&out[out.length-1][0]===h)out[out.length-1][1]+=ru.w;else out.push([h,ru.w])}
    if(out.some(x=>x[0]))cross={d:ca,bands:out.map(([c,w])=>[c,+(w/M).toFixed(3)]),r:+Math.max(.2,Math.min(5,Tc/T)).toFixed(2)};else inLine=null;
    if(self.SETT_DEBUG)console.log('cross',JSON.stringify({Tc:+Tc.toFixed(1),len:rp.length,fsd:+fsd.toFixed(2),runs:runs.length,cols:cols.map(c=>c.hex)}));
  }
  // the bands: per-step medians, leaving out the pixels under crossing lines (a gingham's white stays white)
  const bands=settBands(foldMedian(G,P,first,prof.L.length,ok,T,inLine),.008);if(bands.length<2)return null;
  // start the repeat at its widest band, so the drawing and the description agree on where it begins
  let si=0;bands.forEach((b,i)=>{if(b.w>bands[si].w)si=i});const ord=bands.slice(si).concat(bands.slice(0,si));
  return {v:2,a:Math.round(th*180/Math.PI),bands:ord.map(b=>[labHex(b.lab),+b.w.toFixed(3)]),cross,cr:+Math.max(.3,Math.min(60,Math.min(W,H)/T)).toFixed(2)}}
/* a sett from a whole canvas (its middle 90%): a close-up */
function settFromCanvas(c,box){if(box){const b={x:box.x/1000*c.width,y:box.y/1000*c.height,w:box.w/1000*c.width,h:box.h/1000*c.height};return analyzeSett(c,b.x,b.y,b.w,b.h)}
  return analyzeSett(c,c.width*.05,c.height*.05,c.width*.9,c.height*.9)}
